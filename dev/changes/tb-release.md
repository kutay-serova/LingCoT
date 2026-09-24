## Tester build v3.15.0: TESTERS.md, the reader in the quickstart, --release --minor (2026-09-24)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-release/` (v3.14.419)
**Touched:** TESTERS.md (new) · QUICKSTART.md · README.md · dev/new_version.py · dev/tests/change_files_test.js · dev/tests/doc_integrity_test.js · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/changes/README.md
**Change:** `tb-release` · **Order:** 11

**What changed.**
- `TESTERS.md`, linked first from README Contents and from the quickstart: install and first session, what is new, known issues (B-028, B-035, English exports), and what a report needs (steps, expected and actual, the version line from the help sidebar, the newest `app_….log`). A live document: `new_version.py` stamps it, `doc_integrity_test.js` checks the stamp.
- QUICKSTART §12, *Read it*: both reader modes and the language picker.
- `new_version.py --release --minor`: the last change takes X.Y+1.0, the others patch numbers, so this build is exactly v3.15.0.
- DEV_PLAN gate 2: D41 and the picker done, 2 items open (the macOS clean-machine install on v3.15.0, D46 answers from testers).

**Guard.** `change_files_test.js` +2 (`--minor` in a temp repository: v3.14.5 then v3.15.0, build 3.15.0). `quickstart_labels_test.js` covers the new bold labels. §B-208's live-document list includes `TESTERS.md`. §8a fails on a change file still titled `TITLE`: two were, and only `--release` noticed.

**Verification.** `./dev/tests/run_all.sh` — 103 passed, 0 failed; `doc_integrity_test.js` 83 passed.
