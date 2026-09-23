## D41 Reader Mode A: interlinear reading, word highlight, read-only word popup (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-reader-igt/` (v3.14.419)
**Touched:** source/modules/reader.js · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/reader_igt_test.js (new) · dev/tests/reader_cols_test.js · dev/tests/pseudo_locale_test.js · dev/PRACTICES.md
**Change:** `tb-reader-igt` · **Order:** 8

**What changed.**
- Reader toolbar: **Columns / Interlinear**. Interlinear draws each sentence as wrapping word columns (form, transliteration, parse, word gloss) with the first translation below. **Show:** switches each of the four tiers. Same batching and section entry as Columns.
- Word highlight, as decided: same spelling (`normForm`) by default; a word with a `dict_id` matches that `dict_id` only; **Highlight: Lemma** matches `lemma_id`, and a word without one falls back to the default. Punctuation is not highlighted.
- Word click opens a read-only popup: the rule that matched and the count in view, transliterations, parse, word gloss, POS, lemma, dictionary entry, morphemes, dependency relation and head, and **Open in annotation view**.
- `readerCacheKey()` carries mode, tiers and highlight rule into `render()`'s key.
- 15 keys; the view's help describes Interlinear.

**Guard.** `reader_igt_test.js` (21): the rule in all five cases (mutation: dict_id ahead of lemma fails it), tiers, cache key, popup read-only, wiring. `pseudo_locale_test.js` now also draws Interlinear and the word popup.

**Verification.** `./dev/tests/run_all.sh` — 102 passed, 0 failed. `gui_crud_test.js` 46 passed; `pseudo_locale_test.js` 6 passed. In Chromium on `samples/turkish-test`: 108 words, 33 with a `dict_id`, 56 with a `lemma_id`; hovering one "Tilki" highlights 8 (same entry) of 13 same-spelling tokens, 9 with Lemma.
