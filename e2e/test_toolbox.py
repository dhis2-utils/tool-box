"""Browser tests for the DHIS2 Admin Toolbox, run through e2e/run.sh.

Implements the e2e contract in dhis2-utils/reference-tool-conventions
(TESTING.md, contract version 1): installs APP_ZIP and two older tool
releases, seeds a user without ALL who may open only the Toolbox, runs the
checks, cleans up and writes $RESULTS_DIR/results.json. Use a disposable
instance only.
"""

import base64
import json
import os
import re
import secrets
import string
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

CONTRACT_VERSION = 1
REPO = "tool-box"
STATE_PATH = f"/api/dataStore/e2e-state/{REPO}"
INDEX_URL = "https://dhis2-utils.github.io/tool-box/releases.json"

# Older releases of two listed tools, so the table has an "Update available"
# row. Each is matched to its tools.json entry by manifest name, like the app.
FIXTURE_APPS = [
    "https://github.com/dhis2-utils/tool-job-status/releases/download/v0.2.0/tool-job-status.zip",
    "https://github.com/dhis2-utils/tool-dashboard-pruner/releases/download/v0.1.7/tool-dashboard-pruner.zip",
]

TABLE = "[data-test='dhis2-uicore-datatable']"
ROW = "[data-test='dhis2-uicore-datatablerow']"
NOTICE = "[data-test='dhis2-uicore-noticebox']"
ANY_CONTENT = f"{TABLE}, {NOTICE}"

UP_TO_DATE = "Up to date"
UPDATE_AVAILABLE = "Update available"
NOT_INSTALLED = "Not installed"
NO_RELEASE = "No release yet"
NOT_INSTALLED_CELL = "-"
LIMITED_TITLE = "Limited view of installed apps"
# The platform's PWA code logs this when the instance is served over plain
# HTTP on a non-localhost host, as test instances are.
INSECURE_CONTEXT = "not a secure context"
# The header bar asks for a custom logo; instances without one answer 404.
EXPECTED_404 = "/staticContent/logo_banner"


class SetupError(Exception):
    """The suite could not run: exit code 2 under the contract."""


def env(name, required=True, default=None):
    value = os.environ.get(name, default)
    if required and not value:
        raise SetupError(f"{name} is not set")
    return value


BASE_URL = ""
ADMIN = ("", "")
RESULTS_DIR = None
LABEL = ""


# --- DHIS2 API -------------------------------------------------------------


def auth_header(user, password):
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    return f"Basic {token}"


def parse(text):
    try:
        return json.loads(text) if text else None
    except ValueError:
        return text


def api(method, path, body=None, raw=None, content_type=None, auth=None):
    headers = {"Authorization": auth or auth_header(*ADMIN), "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    elif raw is not None:
        data = raw
        headers["Content-Type"] = content_type
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            return response.status, parse(response.read().decode())
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode(errors="replace")


def api_ok(method, path, **kwargs):
    status, payload = api(method, path, **kwargs)
    if not 200 <= status < 300:
        raise SetupError(f"{method} {path}: HTTP {status}: {str(payload)[:300]}")
    return payload


def installed_apps(auth=None):
    return api_ok("GET", "/api/apps", auth=auth)


def find_app(name, apps=None):
    for app in apps if apps is not None else installed_apps():
        if app["name"].lower() == name.lower():
            return app
    return None


def install_zip(path):
    boundary = secrets.token_hex(16)
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
        f"filename=\"{Path(path).name}\"\r\nContent-Type: application/zip\r\n\r\n"
    ).encode() + Path(path).read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    # 201 on 2.42+, 204 on 2.41 and earlier.
    api_ok("POST", "/api/apps", raw=body, content_type=f"multipart/form-data; boundary={boundary}")


def uninstall_app(name):
    app = find_app(name)
    if app is not None:
        api("DELETE", f"/api/apps/{app['key']}")


def manifest(path):
    with zipfile.ZipFile(path) as bundle:
        return json.loads(bundle.read("manifest.webapp"))


def app_authority(short_name):
    # How DHIS2 names an app's access authority (see src/appIdentity.test.ts).
    return "M_" + short_name.replace(" ", "_").replace("-", "")


def new_uid():
    alphabet = string.ascii_letters + string.digits
    return secrets.choice(string.ascii_letters) + "".join(secrets.choice(alphabet) for _ in range(10))


# --- Seeding and cleanup ---------------------------------------------------
#
# Every object is written to the record at e2e-state/tool-box before it is
# created, so a killed run's leftovers are deleted at the start of the next.


class State:
    def __init__(self):
        self.entries = []

    def _save(self):
        status, _ = api("PUT", STATE_PATH, body={"entries": self.entries})
        if status == 404:
            api_ok("POST", STATE_PATH, body={"entries": self.entries})

    def record(self, kind, ref):
        self.entries.append({"type": kind, "ref": ref})
        self._save()

    def clear(self):
        api("DELETE", STATE_PATH)
        self.entries = []


def delete_entry(entry):
    kind, ref = entry["type"], entry["ref"]
    if kind == "app":
        uninstall_app(ref)
    else:
        api("DELETE", f"/api/{kind}/{ref}")


def clean_up(entries):
    # Reverse creation order: users before the roles and org units they use.
    for entry in reversed(entries):
        delete_entry(entry)


def clean_leftovers():
    status, payload = api("GET", STATE_PATH)
    if status == 200 and isinstance(payload, dict):
        clean_up(payload.get("entries", []))
    api("DELETE", STATE_PATH)


def download(url, directory):
    target = Path(directory) / url.rsplit("/", 1)[1]
    with urllib.request.urlopen(url, timeout=120) as response:
        target.write_bytes(response.read())
    return target


def install_fixture_apps(state, workdir):
    """Installs the older tool releases that are not already installed."""
    for url in FIXTURE_APPS:
        path = download(url, workdir)
        name = manifest(path)["name"]
        if find_app(name) is not None:
            continue  # leave an app the instance already had alone
        state.record("app", name)
        install_zip(path)


def root_org_unit(state, prefix, run_id):
    roots = api_ok("GET", "/api/organisationUnits?level=1&fields=id&paging=false")
    if roots["organisationUnits"]:
        return roots["organisationUnits"][0]["id"]
    uid = new_uid()
    state.record("organisationUnits", uid)
    api_ok("POST", "/api/organisationUnits", body={
        "id": uid, "name": prefix, "shortName": f"E2E {run_id}", "openingDate": "2020-01-01"})
    return uid


def seed_limited_user(state, toolbox_short_name, prefix, run_id):
    """A user without ALL whose only app authority is the Toolbox's."""
    org_unit = root_org_unit(state, prefix, run_id)
    role = new_uid()
    state.record("userRoles", role)
    api_ok("POST", "/api/userRoles", body={
        "id": role, "name": prefix, "authorities": [app_authority(toolbox_short_name)]})
    user = new_uid()
    username = f"e2e_toolbox_{run_id.lower()}"
    password = "E2e!" + secrets.token_hex(8) + "Aa1"
    state.record("users", user)
    api_ok("POST", "/api/users", body={
        "id": user, "username": username, "password": password,
        "firstName": "E2E", "surname": prefix,
        "userRoles": [{"id": role}], "organisationUnits": [{"id": org_unit}]})
    return username, password


# --- Expected values -------------------------------------------------------


def version_key(version):
    return [int(part) for part in re.findall(r"\d+", version or "")]


def expected_row(tool, apps):
    """What the Toolbox should show for one tool, from the server's own state."""
    app = find_app(tool["name"], apps)
    if tool["version"] is None:
        status = NO_RELEASE
    elif app is None:
        status = NOT_INSTALLED
    elif version_key(app["version"]) < version_key(tool["version"]):
        status = UPDATE_AVAILABLE
    else:
        status = UP_TO_DATE
    return (app["version"] if app else NOT_INSTALLED_CELL), status


def live_index():
    with urllib.request.urlopen(INDEX_URL, timeout=60) as response:
        return json.load(response)


# --- Browser ---------------------------------------------------------------


def session_cookie(user, password):
    req = urllib.request.Request(f"{BASE_URL}/api/me", headers={"Authorization": auth_header(user, password)})
    with urllib.request.urlopen(req) as response:
        for header in response.headers.get_all("Set-Cookie") or []:
            name, _, value = header.split(";", 1)[0].partition("=")
            if "JSESSIONID" in name:
                return name.strip(), value.strip()
    raise SetupError(f"no session cookie for {user}")


class Run:
    """One browser context logged in as one user, with its event streams."""

    def __init__(self, browser, app_key, user, password):
        name, value = session_cookie(user, password)
        host = BASE_URL.split("//", 1)[1].split(":")[0].split("/")[0]
        self.app_key = app_key
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
        self.page.goto(f"{BASE_URL}/api/apps/{self.app_key}/index.html")
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
        self.page.screenshot(path=str(RESULTS_DIR / f"{LABEL}-{name}.png"), full_page=True)

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


# --- Checks ----------------------------------------------------------------


def check_admin_table(ctx):
    run = Run(ctx["browser"], ctx["app_key"], *ADMIN)
    try:
        frame = run.open_app()
        rows = rows_by_name(frame)
        run.screenshot("admin")
        index, apps = live_index(), installed_apps()
        assert len(rows) == len(index["tools"]), f"{len(rows)} rows, index has {len(index['tools'])}"
        for tool in index["tools"]:
            assert_row(rows, tool["name"], *expected_row(tool, apps))
        statuses = {cells[4] for cells in rows.values()}
        assert UPDATE_AVAILABLE in statuses or not ctx["fixtures_installed"], statuses
        assert frame.get_by_text("Index updated").count() == 1
        assert frame.get_by_text(LIMITED_TITLE).count() == 0
        assert frame.get_by_text("The tool index is out of date").count() == 0
        hrefs = frame.locator(f"{TABLE} a").evaluate_all("els => els.map(e => e.href)")
        assert all(h.startswith("https://github.com/") for h in hrefs), hrefs
        assert not run.http_errors, run.http_errors
        assert not run.console_errors, run.console_errors
    finally:
        run.close()


def check_limited_user(ctx):
    user, password = ctx["limited_user"]
    run = Run(ctx["browser"], ctx["app_key"], user, password)
    try:
        frame = run.open_app()
        rows = rows_by_name(frame)
        run.screenshot("limited")
        assert frame.get_by_text(LIMITED_TITLE).count() == 1
        # DHIS2 lists only the apps this user may open: the Toolbox, not the
        # fixture tools.
        visible = installed_apps(auth=auth_header(user, password))
        visible_names = {a["name"].lower() for a in visible}
        assert ctx["toolbox_name"].lower() in visible_names, visible_names
        hidden = [n for n in ctx["fixture_names"] if n.lower() in visible_names]
        assert not hidden, f"visible without their authority: {hidden}"
        for tool in live_index()["tools"]:
            assert_row(rows, tool["name"], *expected_row(tool, visible))
    finally:
        run.close()


def check_index_unreachable(ctx):
    run = Run(ctx["browser"], ctx["app_key"], *ADMIN)
    try:
        run.page.route(INDEX_URL, lambda route: route.abort())
        frame = run.open_app()
        frame.get_by_text("Could not load the tool index").wait_for(timeout=30_000)
        run.screenshot("index-unreachable")
        assert frame.get_by_text(INDEX_URL).count() == 1
        assert frame.locator(TABLE).count() == 0
    finally:
        run.close()


def check_stale_index(ctx):
    run = Run(ctx["browser"], ctx["app_key"], *ADMIN)
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


def check_apps_unavailable(ctx):
    run = Run(ctx["browser"], ctx["app_key"], *ADMIN)
    app_path = f"/{ctx['app_key']}/"

    def fail_for_app_frame(route):
        # On 2.42+ the global shell reads /api/apps too, to find the app it
        # frames; only the Toolbox's own request may fail.
        if app_path in route.request.frame.url:
            route.fulfill(status=500, body="{}")
        else:
            route.continue_()

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


# Ids are stable: the monthly review compares results across runs by id.
CHECKS = [
    ("admin-table", check_admin_table),
    ("limited-user", check_limited_user),
    ("index-unreachable", check_index_unreachable),
    ("stale-index", check_stale_index),
    ("apps-unavailable", check_apps_unavailable),
]


# --- Run -------------------------------------------------------------------


def configure():
    global BASE_URL, ADMIN, RESULTS_DIR
    BASE_URL = env("DHIS2_URL").rstrip("/")
    ADMIN = (env("DHIS2_USER"), env("DHIS2_PASS"))
    RESULTS_DIR = Path(env("RESULTS_DIR"))
    if not RESULTS_DIR.is_dir():
        raise SetupError(f"RESULTS_DIR {RESULTS_DIR} is not a directory")
    app_zip = Path(env("APP_ZIP"))
    if not app_zip.is_file():
        raise SetupError(f"APP_ZIP {app_zip} does not exist")
    return app_zip


def run_checks(ctx):
    from playwright.sync_api import sync_playwright

    tests = []
    with sync_playwright() as p:
        ctx["browser"] = p.chromium.launch()
        try:
            for test_id, check in CHECKS:
                try:
                    check(ctx)
                    tests.append({"id": test_id, "status": "pass"})
                except Exception as error:  # report every check, not just the first failure
                    tests.append({"id": test_id, "status": "fail", "message": str(error)[:500]})
                print(f"{tests[-1]['status'].upper()} {LABEL} {test_id}", tests[-1].get("message", ""))
        finally:
            ctx["browser"].close()
    return tests


def write_results(results):
    (RESULTS_DIR / "results.json").write_text(json.dumps(results, indent=2) + "\n")


def main():
    global LABEL
    started = time.monotonic()
    results = {"contract_version": CONTRACT_VERSION, "tests": []}
    state = None
    try:
        app_zip = configure()
        server_version = api_ok("GET", "/api/system/info")["version"]
        LABEL = env("LABEL", required=False) or server_version
        toolbox = manifest(app_zip)
        results.update(label=LABEL, server_version=server_version, app_version=toolbox["version"])

        clean_leftovers()
        state = State()
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        prefix = f"E2E {REPO} {run_id}"

        state.record("app", toolbox["name"])
        install_zip(app_zip)
        installed = find_app(toolbox["name"])
        if installed is None:
            raise SetupError(f"{toolbox['name']} is not in /api/apps after install")
        app_key = env("APP_KEY", required=False) or installed["key"]
        results["app_key"] = app_key

        with tempfile.TemporaryDirectory() as workdir:
            install_fixture_apps(state, workdir)
        limited_user = seed_limited_user(state, toolbox["short_name"], prefix, run_id)

        results["tests"] = run_checks({
            "app_key": app_key,
            "limited_user": limited_user,
            "toolbox_name": toolbox["name"],
            "fixture_names": [e["ref"] for e in state.entries[1:] if e["type"] == "app"],
            "fixtures_installed": any(e["type"] == "app" for e in state.entries[1:]),
        })
    except Exception as error:
        results["error"] = f"{type(error).__name__}: {error}"
        print(f"ERROR {results['error']}", file=sys.stderr)
    finally:
        if state is not None:
            try:
                clean_up(state.entries)
                state.clear()
            except Exception as error:
                print(f"cleanup failed: {error}", file=sys.stderr)
        tests = results["tests"]
        results.update(
            duration_s=round(time.monotonic() - started),
            total=len(tests),
            passed=sum(t["status"] == "pass" for t in tests),
            failed=sum(t["status"] == "fail" for t in tests),
            skipped=sum(t["status"] == "skip" for t in tests),
        )
        if RESULTS_DIR is not None and RESULTS_DIR.is_dir():
            write_results(results)
    if "error" in results:
        sys.exit(2)
    sys.exit(1 if results["failed"] else 0)


if __name__ == "__main__":
    main()
