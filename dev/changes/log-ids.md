## B-231, B-233: logs carry ids, not forms; a replayed journal is folded; one offer per load (2026-10-07)
**Version:** pending · **Type:** fix · **Archives:** `dev/archive/changes/log-ids/` (v3.15.4)
**Touched:** source/LingCoT.html · source/modules/events.js · dev/tests/log_triage.js · dev/tests/offer_after_replay_test.js · dev/tests/log_content_test.js (new) · dev/PRACTICES.md · dev/BUGS.md
**Closed:** B-231, B-233 · **Opened:** B-232
**Change:** `log-ids` · **Order:** 2

**What changed.**
- B-231: eleven `logEvent` calls carried forms; they carry ids and counts now. `navigate:` no longer logs a dictionary form.
- B-233: a replay that applies records bumps both save generations and counts the journal's bytes; arming autosave compacts when a journal is pending. The offer is computed once per load, after the replay (`applyDict(..., { offer: false })` during a project load).
- Fill-banner log line names the entry ids it offers (E, amended to ids).
- New lines: `lemma created <id>`; `add-to-dictionary picker: N picked[, dismissed], T s`. `repeat copy accepted` splits word fields from sentence fields.
- `log_triage.js`: the re-tokenization mask covers words as well as morphemes; the 2026-09-27 `dağ` line is acknowledged against B-232.

**Why.** Post-test log review (items 1 and 5).

**Guard.** `log_content_test.js` (new): reads every `logEvent` call; fails on 11 calls in the pre-change file. `offer_after_replay_test.js`: one offer per load, after the replay.

**Verification.** `./dev/tests/run_all.sh`: 105 passed, 0 failed (`log_triage.js` passes again). `gui_crud_test.js` 58 passed; `pseudo_locale_test.js` 6 passed. `log_content_test.js` lists 11 calls in the archived pre-change `LingCoT.html`.
