## D40 stage B: translation and transliteration pre-filled from a sentence with the same text (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/d40b-prefill/` (v3.14.412)
**Touched:** source/LingCoT.html · source/modules/participants.js · source/modules/events.js · source/resources/locale/en.json · dev/tests/sentence_prefill_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md
**Change:** `d40b-prefill` · **Order:** 2

**What changed.** The sentence edit form pre-fills an empty translation, and
each transliteration label the sentence lacks, from sentences with the same
folded text (stage A). The row reads *From P1 S2*; other translations in use
are chips under it. The add form does the same as the text is typed. Saved
unchanged, a value is stamped `_copyFieldProv(<sentence id>)`: derived, with a
new optional `from` key that `_provKeyOf` includes and `provDisplayName` shows
as *copied from P1 S2*. Edited, it is the annotator's; cleared, nothing is
written. The form reads its marks back and `takeCopyMarks` strips them before
`applyForm`, so none reaches the file.

**Why.** The 2026-09-22 session typed the same translation twice for p1 s2/s3.
D40 decisions 2, 6 and 7.

**Guard.** `sentence_prefill_test.js`, 42 checks, runs the save path from
`readForm`'s output through `takeCopyMarks`, `applyForm` with the field table,
`assignList` and `stampCopies`: what is offered, that the form draws from a
copy, the three outcomes of Save, and a moment without `from` keying exactly as
before. Six mutations, six failures.

**Verification.** `./dev/tests/run_all.sh` — **95 passed, 0 failed, 0 disabled.**
