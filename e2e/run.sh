#!/usr/bin/env bash
# e2e entry point, contract version 1 (dhis2-utils/reference-tool-conventions,
# TESTING.md). All inputs come from the environment:
#
#   DHIS2_URL, DHIS2_USER, DHIS2_PASS, APP_ZIP, RESULTS_DIR   required
#   LABEL, APP_KEY                                             optional
#
# Exit 0 when every test passed, 1 when one failed, 2 when the suite could not
# run. Writes $RESULTS_DIR/results.json. Disposable instances only.
set -uo pipefail

cd "$(dirname "$0")" || exit 2

if ! python3 -c 'import playwright' 2> /dev/null; then
    echo "run.sh: Python package playwright is missing (pip install -r e2e/requirements.txt)" >&2
    exit 2
fi

exec python3 test_toolbox.py
