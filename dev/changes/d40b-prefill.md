## D40 stage B: translation and transliteration offered from a sentence with the same text (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/d40b-prefill/` (v3.14.412)
**Touched:** source/LingCoT.html · source/modules/participants.js · source/modules/events.js · source/resources/locale/en.json · dev/tests/sentence_prefill_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/DEV_PLAN.md
**Change:** `d40b-prefill` · **Order:** 2

**What changed.** The sentence edit and add forms show an offer strip under
the translation and transliteration editors (`offerStripHtml`, as for POS and
lemma): one chip per value in use on sentences with the same folded text
(stage A), commonest first, labelled *same text, P1 S2*. Translation chips
appear while the form has no translation; transliteration chips for labels it
does not have. A click fills an empty row or adds one (`takeOffer`, act
`copy-row`); the add form's strip follows the typed text. Saved unchanged, the
value is stamped `_copyFieldProv(<sentence id>)`: derived, with a new optional
`from` key that `_provKeyOf` includes and `provDisplayName` shows as *copied
from P1 S2*. Edited, it is the annotator's. The rows' copy marks are stripped by
`takeCopyMarks` before `applyForm`, so none reaches the file.

**Why.** The 2026-09-22 session typed the same translation twice for p1 s2/s3.
D40 decisions 2, 6 and 7. A first build pre-filled the field; tried in the app,
that was easy to miss and unlike the other offers, so it was replaced before
release.

**Guard.** `sentence_prefill_test.js`, 41 checks, runs the save path from
`readForm`'s output through `takeCopyMarks`, `applyForm` with the field table,
`assignList` and `stampCopies`: what is offered and in what order, that the
form draws the sentence as stored, the three outcomes of Save, and a moment
without `from` keying exactly as before. Ten mutations across both builds, ten
failures; the ranking one first escaped because the fixture's commonest value
was also its first.

**Verification.** `./dev/tests/run_all.sh` — **95 passed, 0 failed, 0 disabled.**
