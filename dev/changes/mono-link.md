## Single-morpheme words: word and morpheme fields linked; existing data reconciled on load (2026-10-07)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/mono-link/` (v3.15.4)
**Touched:** source/LingCoT.html · source/modules/events.js · source/modules/reader.js · source/LingCoT.css · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/gui_crud_test.js · dev/PRACTICES.md · dev/tests/sentence_copy_test.js · dev/tests/word_chip_test.js · dev/tests/reader_igt_test.js · dev/tests/word_edit_pos_test.js · dev/tests/translit_model_test.js · dev/tests/mono_link_test.js (new)
**Change:** `mono-link` · **Order:** 4

**What changed.**
- Word editor, one morpheme row: gloss, part of speech and (when the morpheme has the word's form) transliteration are linked pairs. The side typed into first fills the other as it is typed; the copy is drawn muted; typing into the copy unlinks that pair. Pairs that differ on opening start unlinked. Replaces the B-187 gloss mirror (no parse, gloss only).
- Storage: gloss on the morpheme (word stores a typed gloss only when it differs, D60); transliteration on the morpheme, the word keeping a list only when it differs; part of speech on both.
- `_reconcileMonoMorphemes` on load and after replay: a word-only gloss or transliteration moves to the morpheme with its stamp; an equal word transliteration is dropped; a one-sided part of speech is copied. Differing values are kept. Logged once as counts.
- `translitRowsOf(w)` for the list readers (editor, chips, word view, reader popup); `wordHasStoredTranslit` counts a lone same-form morpheme as the word's own.

**Why.** Post-test item 3, and the source of the recurring fill banner (item 1, fix A): the editor saved transliterations on the word and the dictionary offer then proposed them for the morpheme.

**Guard.** `gui_crud_test.js` scenario I (I1 to I12): linking, unlinking, the archiphoneme case and what reaches the file. `mono_link_test.js` (new): reconciliation, stamps, idempotence, readers.

**Verification.** `./dev/tests/run_all.sh`: 106 passed. `gui_crud_test.js`: 75 passed; scenario I fails 9 of 12 on the archived pre-change app. `pseudo_locale_test.js`: 6 passed. On the live corpora (read-only): Mandarin 126 of 126 single-morpheme words reconciled, none left with a word-only transliteration; Turkish 40, the 8 left are `dA`/`mI` words, which keep their own by design.
