## Re-tokenization keeps annotation: a merge makes morphemes, a split makes words (2026-10-07)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/retok-carry/` (v3.15.4)
**Touched:** source/LingCoT.html · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/retokenize_align_test.js · dev/tests/gui_crud_test.js · dev/tests/prov_intern_test.js
**Change:** `retok-carry` · **Order:** 5

**What changed.**
- `retokenizeCarryPlan`: among the tokens `alignTokens` leaves unpaired, a run of two or more old words whose forms join to one new form is a merge; an old word whose morpheme forms equal that many consecutive new forms is a split. Forms compare folded, ignoring apostrophes and hyphens (`İstanbul 'da` merges into `İstanbul'da`). Anything else goes to the existing loss prompt.
- `buildMergedWord`: the old words become the new word's morphemes. Gloss, transliterations, part of speech and comments are carried and stamped `carried (merge)` with `from` the old word id. Type, dictionary links and lemma are not carried.
- `buildSplitWords`: each morpheme record moves intact under its own word; the word's part of speech is copied from it, stamped `carried (split)`. A split word with word-level work its parts cannot hold (typed gloss, transliteration, lemma, comments) still asks.
- `retokenizeRemapHeads`: heads pointing at a replaced word follow it; a merged word keeps its parts' outward head and relation; internal heads are dropped.
- `saveSentence` plans the carry before the loss prompt. Status line and log line report counts.

**Why.** Post-test item 4. In the Mandarin tester log (2026-09-27 14:48) merging 走 过 into 走过 discarded the annotation on 走.

**Guard.** `retokenize_align_test.js` M1 to M9, S1 to S5, D1, D2, W1 execute the shipped functions, including the Turkish cases (`kahvaltı` is not a merge, `ev de` arrives stamped as carried, `dA` splits fall back). `gui_crud_test.js` scenario J (J1 to J5): merge and split through the sentence editor without a prompt, glosses back on their words in the file; J1 to J5 fail on the archived pre-change app. `prov_intern_test.js` lists `buildMergedWord` as a provenance writer.

**Verification.** `./dev/tests/run_all.sh`: 106 passed after this entry. `gui_crud_test.js`: 80 passed. `retokenize_align_test.js`: 52 passed.
