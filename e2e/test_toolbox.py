"""Browser tests for the installed DHIS2 Admin Toolbox.

Runs against an instance where the built zip is installed, with Job Status
Tool 0.2.0 and Dashboard pruner tool 0.1.7 also installed, and a user
without ALL who may only open the Toolbox (see e2e/README.md).

    DHIS2_URL=http://dhis2-agent-x:8080 python3 e2e/test_toolbox.py
"""

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("DHIS2_URL", "").rstrip("/")
ADMIN = (os.environ.get("DHIS2_USER", "local_admin"), os.environ.get("DHIS2_PASS", "district"))
LIMITED = (os.environ.get("DHIS2_LIMITED_USER", "toolbox_viewer"), os.environ.get("DHIS2_LIMITED_PASS", "Toolbox123!"))
LABEL = os.environ.get("DHIS2_LABEL", "run")
OUT_DIR = Path(__file__).parent / "results"

APP_KEY = "DHIS2-Admin-Toolbox"
INDEX_URL = "https://dhis2-utils.github.io/tool-box/releases.json"
TABLE = "[data-test='dhis2-uicore-datatable']"
ROW = "[data-test='dhis2-uicore-datatablerow']"
NOTICE = "[data-test='dhis2-uicore-noticebox']"
ANY_CONTENT = f"{TABLE}, {NOTICE}"

TOOLBOX = "DHIS2 Admin Toolbox"
JOB_STATUS = "Job Status Tool"
PRUNER = "Dashboard pruner tool"
UP_TO_DATE = "Up to date"
LIMITED_TITLE = "Limited view of installed apps"
# The platform's PWA code logs this when the instance is served over plain
# HTTP on a non-localhost host, as test instances are.
INSECURE_CONTEXT = "not a secure context"
# The header bar asks for a custom logo; instances without one answer 404.
EXPECTED_404 = "/staticContent/logo_banner"


def session_cookie(user, password):
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    req = urllib.request.Request(f"{BASE_URL}/api/me", headers={"Authorization": f"Basic {token}"})
    with urllib.request.urlopen(req) as response:
        for header in response.headers.get_all("Set-Cookie") or []:
            name, _, value = header.split(";", 1)[0].partition("=")
            if "JSESSIONID" in name:
                return name.strip(), value.strip()
    raise RuntimeError("no session cookie")


def live_index():
    with urllib.request.urlopen(INDEX_URL) as response:
        return json.load(response)


def index_tool_count():
    return len(live_index()["tools"])


class Run:
    """One browser context logged in as one user, with its event streams."""

    def __init__(self, browser, user, password):
        name, value = session_cookie(user, password)
        host = BASE_URL.split("//", 1)[1].split(":")[0].split("/")[0]
        self.context = browser.new_context(viewport={"width": 1280, "height": 900})
        self.context.add_cookies([{"name": name, "value": value, "domain": host, "path": "/"}])
        self.page = self.context.new_page()
        self.console_errors, self.http_errors = [], []
        self.page.on("console", self._on_console)
        self.page.on("pageerror", lambda e: INSECURE_CONTEXT in str(e) or self.console_errors.append(str(e)))
        self.page.on("response", self._on_response)

    def _on_console(self, message):
        # Resource 404s are judged by URL in _on_response.
        ignored = (INSECURE_CONTEXT, "status of 404")
        if message.type == "error" and not any(i in message.text for i in ignored):
            self.console_errors.append(message.text)

    def _on_response(self, response):
        if response.status >= 400 and not response.url.endswith(EXPECTED_404):
            self.http_errors.append((response.status, response.url))

    def open_app(self):
        self.page.goto(f"{BASE_URL}/api/apps/{APP_KEY}/index.html")
        return self.app_frame()

    def app_frame(self):
        # 2.42+ serves installed apps inside the global shell's iframe.
        self.page.wait_for_selector("iframe, " + ANY_CONTENT, timeout=60_000)
        for _ in range(120):
            for frame in self.page.frames:
                if frame.locator(ANY_CONTENT).count() > 0:
                    return frame
            self.page.wait_for_timeout(500)
        raise AssertionError("app content never appeared in any frame")

    def screenshot(self, name):
        OUT_DIR.mkdir(exist_ok=True)
        self.page.screenshot(path=str(OUT_DIR / f"{LABEL}-{name}.png"), full_page=True)

    def close(self):
        self.context.close()


def rows_by_name(frame):
    frame.wait_for_selector(f"{TABLE} tbody {ROW}", timeout=30_000)
    result = {}
    for row in frame.locator(f"{TABLE} tbody {ROW}").all():
        cells = [c.inner_text().strip() for c in row.locator("td").all()]
        result[cells[0]] = cells
    return result


def assert_row(rows, name, installed, status):
    cells = rows[name]
    assert cells[1] == installed, f"{name}: installed {cells[1]!r}, expected {installed!r}"
    assert cells[4] == status, f"{name}: status {cells[4]!r}, expected {status!r}"


def check_admin_table(browser):
    run = Run(browser, *ADMIN)
    try:
        frame = run.open_app()
        rows = rows_by_name(frame)
        run.screenshot("admin")
        assert len(rows) == index_tool_count(), f"{len(rows)} rows"
        assert_row(rows, TOOLBOX, "1.0.0", UP_TO_DATE)
        assert_row(rows, JOB_STATUS, "0.2.0", UP_TO_DATE)
        assert_row(rows, PRUNER, "0.1.7", "Update available")
        not_installed = [n for n, c in rows.items() if c[4] == "Not installed"]
        assert len(not_installed) == len(rows) - 3, not_installed
        assert frame.get_by_text("Index updated").count() == 1
        assert frame.get_by_text(LIMITED_TITLE).count() == 0
        assert frame.get_by_text("The tool index is out of date").count() == 0
        hrefs = frame.locator(f"{TABLE} a").evaluate_all("els => els.map(e => e.href)")
        assert all(h.startswith("https://github.com/") for h in hrefs), hrefs
        assert not run.http_errors, run.http_errors
        assert not run.console_errors, run.console_errors
    finally:
        run.close()


def check_limited_user(browser):
    run = Run(browser, *LIMITED)
    try:
        frame = run.open_app()
        rows = rows_by_name(frame)
        run.screenshot("limited")
        assert frame.get_by_text(LIMITED_TITLE).count() == 1
        assert_row(rows, TOOLBOX, "1.0.0", UP_TO_DATE)
        # The user cannot open Job Status, so DHIS2 hides it from /api/apps.
        assert_row(rows, JOB_STATUS, "-", "Not installed")
    finally:
        run.close()


def check_index_unreachable(browser):
    run = Run(browser, *ADMIN)
    try:
        run.page.route(INDEX_URL, lambda route: route.abort())
        frame = run.open_app()
        frame.get_by_text("Could not load the tool index").wait_for(timeout=30_000)
        run.screenshot("index-unreachable")
        assert frame.get_by_text(INDEX_URL).count() == 1
        assert frame.locator(TABLE).count() == 0
    finally:
        run.close()


def check_stale_index(browser):
    run = Run(browser, *ADMIN)
    try:
        stale = {**live_index(), "generated_at": "2025-01-01T03:00:00Z"}
        run.page.route(INDEX_URL, lambda route: route.fulfill(
            json=stale, headers={"Access-Control-Allow-Origin": "*"}))
        frame = run.open_app()
        frame.get_by_text("The tool index is out of date").wait_for(timeout=30_000)
        rows_by_name(frame)
        run.screenshot("stale-index")
    finally:
        run.close()


def fail_for_app_frame(route):
    # On 2.42+ the global shell reads /api/apps too, to find the app it
    # frames; only the Toolbox's own request may fail.
    if f"/{APP_KEY}/" in route.request.frame.url:
        route.fulfill(status=500, body="{}")
    else:
        route.continue_()


def check_apps_unavailable(browser):
    run = Run(browser, *ADMIN)
    try:
        for pattern in ("**/api/apps", "**/api/*/apps"):
            run.page.route(pattern, fail_for_app_frame)
        frame = run.open_app()
        frame.get_by_text("Could not read installed apps").wait_for(timeout=30_000)
        rows = rows_by_name(frame)
        run.screenshot("apps-unavailable")
        assert {c[4] for c in rows.values()} == {"Unknown"}, rows
    finally:
        run.close()


CHECKS = [
    check_admin_table,
    check_limited_user,
    check_index_unreachable,
    check_stale_index,
    check_apps_unavailable,
]


def main():
    if not BASE_URL:
        sys.exit("set DHIS2_URL")
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for check in CHECKS:
            try:
                check(browser)
                print(f"PASS {LABEL} {check.__name__}")
            except Exception as error:  # report every check, not just the first failure
                failures += 1
                print(f"FAIL {LABEL} {check.__name__}: {error}")
        browser.close()
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
