## D40 stage D: the word editor offers the same word's analyses from elsewhere in the corpus; B-211, B-212 (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/d40d-word-chips/` (v3.14.412)
**Touched:** source/LingCoT.html · source/modules/events.js · source/resources/locale/en.json · dev/tests/word_chip_test.js (new) · dev/tests/suggest_mechanism_test.js · dev/tests/word_edit_pos_test.js · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/new_version.py · dev/tests/doc_integrity_test.js · dev/tests/change_files_test.js · dev/BUGS.md · dev/tests/log_triage.js
**Change:** `d40d-word-chips` · **Order:** 3

**What changed.** The word editor gets a strip under the title: one chip per
distinct analysis of the same folded form elsewhere in the corpus
(transliterations, POS, gloss, parse, morpheme rows, lemma), commonest first,
labelled *same word, P1 S2*, shown while it would fill something empty. A click
fills only empty fields; morpheme rows by position; the lemma by the source's
lemma id, so a homograph is not asked again. Under each filled field that other
tokens answer differently, a *differs* note lists their values; a click
replaces. Taken values carry `offerSrc` `corpus:<word id>`, which `_offerMoment`
stamps as `_copyFieldProv` at the three stamp sites (the lemma's now reads its
mark, as D61 intended). Typing clears the mark.

**Found testing it, fixed here.** B-211: a homograph lemma pick was stored but
the strip kept asking; `lemmaStripHtml` now takes the chosen id. B-212: the word
view did not draw the word's transliterations. The take also repaints the
morphology strip, which it had left stale. `--release` writes the version into
BUGS.md rows fixed in `pending:<slug>`.

**Why.** The 2026-09-22 session annotated `Hasan`, `dar` and `geçmek` twice each
by hand; the POS strip offered only what the dictionary held. D40 decisions 2,
7 and 8.

**Guard.** `word_chip_test.js`, 39 checks, against a stand-in for the editor's
fields: what is offered and in what order, what a take fills and leaves alone,
the differs notes, the stamp, B-211 and B-212. Eight mutations, eight failures;
one first escaped because the field stayed empty while marked. Two static
guards follow the stamp sites to `_offerMoment`. `change_files_test` checks the
`pending:` replacement; `doc_integrity_test` refuses a `pending:` slug with no
open change and now holds change files to the 400-word cap. `log_triage`
acknowledges the three stale-strip warnings.

**Verification.** `./dev/tests/run_all.sh` — **96 passed, 0 failed, 0 disabled.** Stage D tried in the app 2026-09-23; the fixes not yet.
