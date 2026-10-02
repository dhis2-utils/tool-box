# Browser tests

**Use a disposable instance only.** The suite installs and uninstalls apps, and creates and
deletes a user role and a user.

`run.sh` follows the e2e contract in
[reference-tool-conventions](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/TESTING.md)
(contract version 1). It works on DHIS2 2.40 and later; on 2.42+ it finds the app inside the
global shell's iframe.

## Run

```bash
pip install -r e2e/requirements.txt && playwright install chromium
pnpm build
mkdir -p /tmp/out
DHIS2_URL=http://dhis2-x:8080 DHIS2_USER=local_admin DHIS2_PASS=district \
RESULTS_DIR=/tmp/out APP_ZIP=$PWD/build/bundle/tool-box-1.0.0.zip \
  e2e/run.sh
```

`DHIS2_USER` must be a superuser (on the Sierra Leone demo databases, `local_admin`, not
`admin`). Optional: `LABEL` (default: the server version) and `APP_KEY` (default: the key DHIS2
reports for the installed zip). Results, screenshots included, go to `RESULTS_DIR`; the exit
code is 0 when every test passed, 1 when one failed and 2 when the suite could not run.

## What it does

1. Deletes whatever an earlier, interrupted run recorded in the dataStore at
   `e2e-state/tool-box`.
2. Installs `APP_ZIP`, plus Job Status Tool 0.2.0 and Dashboard Pruner Tool 0.1.7 from their
   GitHub releases, so the table has rows that are behind the index. Apps that are already
   installed are left alone.
3. Creates a user role whose only authority is the Toolbox's, and a user with that role, both
   named `E2E tool-box <run id>`. Each object is recorded before it is created.
4. Runs the checks. Expected rows come from the live release index and `/api/apps`, not from
   fixed values.
5. Deletes what it created, uninstalls the apps it installed, deletes the record and writes
   `results.json`.
