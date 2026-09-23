# Browser tests

`test_toolbox.py` drives the installed Toolbox on a DHIS2 instance with Playwright
(`pip install playwright && playwright install chromium`). Works on 2.40 and later; on 2.42+
it finds the app inside the global shell's iframe.

## Instance setup

Use a disposable instance. With `U` set to its URL and `A` set to an admin `user:password`:

```bash
# The app under test, plus one tool at its latest release and one behind it
curl -u $A -F "file=@\"build/bundle/DHIS2 Admin Toolbox-1.0.0.zip\"" $U/api/apps
curl -u $A -F file=@job-status-0.2.0.zip $U/api/apps      # github.com/dhis2/tool-job-status v0.2.0
curl -u $A -F file=@pruner-0.1.7.zip $U/api/apps          # github.com/dhis2/tool-dashboard-pruner v0.1.7

# A user without ALL who may open only the Toolbox: a user role with the app
# authority M_DHIS2_Admin_Toolbox, and a user toolbox_viewer / Toolbox123!
# with that role and any org unit (an empty instance needs one created first).
```

## Run

```bash
DHIS2_URL=http://dhis2-x:8080 DHIS2_LABEL=2.42 python3 e2e/test_toolbox.py
```

Optional: `DHIS2_USER`/`DHIS2_PASS` (admin, default `local_admin`/`district`) and
`DHIS2_LIMITED_USER`/`DHIS2_LIMITED_PASS`. Screenshots go to `e2e/results/` (gitignored).
