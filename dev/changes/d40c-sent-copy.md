## D40 stage C: copy a sentence's annotation to one with the same text (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/d40c-sent-copy/` (v3.14.415)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · dev/tests/sentence_copy_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/tests/render_cache_test.js
**Change:** `d40c-sent-copy` · **Order:** 1

**What changed.** On the sentence view, a banner above the interlinear gloss
when a sentence with the same folded text (stage A) would fill something empty
here, and, on an annotated sentence, when it would fill its repeats. *Review
copy* opens a panel: source and target, one row per word with translit, parse,
gloss, POS and lemma, each shown as to write, already present, or conflict
(both values; never written), a checkbox per row, tabs when matching sentences
are annotated differently, one block per repeat in the outgoing direction.
Copy writes the ticked rows' empty fields, morphemes with their links, and the
dependency head remapped through the alignment, in one `mutate`, stamped
`_copyFieldProv(<source sentence>)`. *Undo copy* restores an in-memory
snapshot for the session. Comments are not copied. The panel leads with what will be
written (accent), marks matches with a tick and conflicts as `kept ≠ source`,
and hides rows that already match behind a toggle; a first layout, tried in
the app, was 380 px wide (the shared modal rule came later in the file) and
gave every cell the same weight.

**Why.** p1 s3 repeats p1 s2 and was annotated from nothing. D40 decisions 1
to 3 and 8; the panel follows the mockup agreed 2026-09-23.

**Guard.** `sentence_copy_test.js`, 58 checks, runs the real plan, apply and
undo: the cell states, the head remap (with target ids that differ from the
source's), ticked and unticked rows, the stamps, a re-plan finding only what
was left, and an undo restoring the target byte for byte. Five mutations, five
failures. The first draft of the remap check could not fail, since source and
target shared their id suffixes. `render_cache_test` lists `_copyPanel` as
repainted outside `render()`; `autolink_test` held `dict_id` to `linkTo`.

**Verification.** `./dev/tests/run_all.sh` — **97 passed, 0 failed, 0 disabled.** Tried in the app 2026-09-23; the panel was reworked after it.
