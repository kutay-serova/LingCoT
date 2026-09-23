## Tester build prep: interface-text guard, B-213 hook fix, export language deferred (2026-09-23)
**Version:** pending · **Type:** chore · **Archives:** `dev/archive/changes/tb-prep/` (v3.14.419)
**Touched:** hooks/prepare-commit-msg · dev/tests/change_files_test.js · dev/DEV_PLAN.md · dev/BUGS.md · dev/PRACTICES.md · dev/tests/i18n_literal_test.js (new) · dev/tests/i18n_allow.json (new) · dev/tests/vendor/ (new)
**Change:** `tb-prep` · **Order:** 1

**What changed.**
- `i18n_literal_test.js`: the I18N audit's scanner as a guard. Every user-visible literal outside `en.json` must be in `i18n_allow.json`, as `exempt` (11: names, licences, host error details) or `pending` under its audit id (51). New literals fail; stale entries fail.
- acorn 8.18.0 and acorn-walk 8.3.5 vendored in `dev/tests/vendor/` (MIT, 262 KB, guards only). parse5 not taken; the static shell uses a small tokenizer.
- The guard found S7: `modal.autosave.hint` holds `<strong>` under `data-i18n`, which sets `textContent`. Added to step 3.
- B-213: `prepare-commit-msg` skipped any subject naming a version; only a leading stamp counts now.
- B-214: the B-213 edit left the hook non-executable, so the first `tb-prep` commit carried no label. Mode restored; amended into that commit.
- DEV_PLAN §3: export language stays English, deferred with a trigger.

**Guard.** `i18n_literal_test.js` (3 checks; mutations: a changed literal and a localized one each fail it). `change_files_test.js` +2 for B-213, +4 for B-214 (each hook executable on disk and in the index).

**Verification.** `./dev/tests/run_all.sh` — 98 passed, 0 failed.
