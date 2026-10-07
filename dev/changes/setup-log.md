## B-234, B-235: setup reports a failed check on an existing venv; setup.log gets headers only for sessions that log (2026-10-07)
**Version:** pending · **Type:** fix · **Archives:** `dev/archive/changes/setup-log/` (v3.15.4)
**Touched:** source/build_env.py · source/log_setup.py · dev/BUGS.md · dev/tests/log_setup_test.js · dev/tests/venv_tier_test.js
**Closed:** B-234, B-235
**Change:** `setup-log` · **Order:** 7

**What changed.**
- B-234: `build_env.main()`, existing-venv path: a failed sync or a failed `check_venv` returns 1 and logs an error; success logs `build_env complete … (existing venv synced)`. `setup.command` already stops on a non-zero status, so it no longer says Setup complete, or builds LingCoT.app, over missing packages.
- B-235: `setup_append_logger` writes the `Session started` header with the first record (`_SeparatorOnFirstRecord`, a filter on the file handler that never drops a record).

**Why.** The 2026-10-07 `setup.log` from a post-test run had no completion line for that run, and 1,094 of its 1,101 session headers were empty.

**Guard.** `venv_tier_test.js` executes `main()` with the sync and the check stubbed and the workspace steps stubbed out: a failed check returns 1, a passing one 0, both logged. `log_setup_test.js` executes `setup_append_logger`: no header for a silent session, one header before the first line, one more for the next session. Against the archived pre-change files: 2 and 3 failures.

**Verification.** `./dev/tests/run_all.sh`: 107 passed. `venv_tier_test.js` 17 passed, `log_setup_test.js` 11 passed.
