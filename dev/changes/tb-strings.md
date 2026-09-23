## Interface strings all in the locale file; B-215 Search view fixed (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-strings/` (v3.14.419)
**Touched:** source/LingCoT.html · source/LingCoT.pyw · source/modules/participants.js · source/modules/search.js · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/i18n_allow.json · dev/tests/i18n_literal_test.js · dev/tests/render_smoke_test.js · dev/tests/search_routing_test.js · dev/BUGS.md · dev/audits/AUDIT_INDEX.md
**Change:** `tb-strings` · **Order:** 4

**What changed.**
- Every pending finding of `I18N_AUDIT_2026-09-24.md` (S1–S7, R1, R3–R13, H1) now reads from the locale; `i18n_allow.json` has no pending entries. R6 split into `confirm.dict.replace` / `_1`. The host window title is the product name only.
- A pseudo-locale run (every value prefixed, every view rendered in Chromium, untagged visible text listed) found 23 more in 6 places: participant table headers and detail rows, the lexicon card labels, paragraph/sentence counts, the unknown-annotator fallback, and the help version line, which was painted before the strings loaded and showed its key. All moved; the version line is repainted by `applyLocale`.
- 46 keys added to `en.json` and `haw.json` (1,230). Existing `option.src_type.*` and `option.pub_restrict.*` keys are now used by `srcTypeLabel` / `srcRestrictLabel`.
- The morpheme-example cache is keyed on the locale as well as `_dataGen`.
- B-215: the dead Search-A branch removed from the cache key.
- Remaining English by design: product, licence and service names, host error details, field ids in the Progress panel.

**Guard.** `i18n_literal_test.js` now also flags Capitalized labels passed to helpers (14 hits on the pre-fix code, 0 false). `render_smoke_test.js` renders every view through `render()` (fails on the pre-fix file with the B-215 ReferenceError).

**Verification.** `./dev/tests/run_all.sh` — 100 passed, 0 failed. `gui_crud_test.js` 46 passed. Pseudo-locale run over all 22 views: only corpus data, names and field ids left untagged.
