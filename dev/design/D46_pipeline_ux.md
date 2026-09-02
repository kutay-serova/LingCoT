# D46: The annotation pipeline: what the app asks for, against the order the work happens in
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Raised 2026-08-28, from annotation.** The word-edit view asks for its fields in
an order that does not match the order an annotator fills them, and the report
was that this "conflicts with the order of annotations the user will likely do".
That is one view. The request is to audit the **whole pipeline**, every input
view, end to end.

**The concrete case, measured.** `renderWordEdit` asks, top to bottom:

| | asked | when it can be answered |
|---|---|---|
| 1 | transliteration | any time |
| 2 | **word gloss** | **only after the morphemes are glossed**, for a multi-morphemic word — it is derived from them |
| 3 | word POS | after the parse, usually |
| 4 | lemma | after the stem is identified, so after the parse |
| 5 | **morphological parse** | **first** — it creates the morpheme rows everything below depends on |
| 6 | morpheme glosses | after 5 |
| 7 | save to dictionary | last, correctly |

**Fields 2 to 4 are asked before the field that determines them.** The parse is
the pivot of the whole view — `syncMorphemeRows` rebuilds rows from it on every
keystroke, `_deriveWordFields` computes the word gloss out of the morpheme
glosses, and `_resolveOrCreateLemma` wants the stem. An annotator working top to
bottom fills in the wrong order, or scrolls past three fields to reach the one
that unlocks them.

This is not a layout complaint. **The fill audit's F5 already proposed the
answer** — "make the parse field the primary surface", called there "the single
highest-leverage change for annotation speed" — and it was never scheduled.
D46 is that proposal generalised from one field to the whole flow.

#### Observed, 2026-08-29: the first real evidence, and it corrects D46

An annotation session against v3.14.220 reported the order actually worked in:

| | observed | the view asks it at |
|---|---|---|
| 1 | transliteration | 1 ✓ |
| 2 | part of speech | 3 |
| 3 | morphological parse | **5** |
| 4 | morpheme fields | 6 |
| 5 | lemma | **4** |
| 6 | the rest, including word gloss | **2** |

**Two of D46's three claims hold.** The word gloss is asked second and answered
last: it is derived from the morphemes, and the annotator does not touch it
until they exist. The lemma is asked fourth and answered fifth, after the
morphemes rather than before them.

**One claim is wrong, and it is F5's.** D46 and F5 both put the parse first, F5
calling it the primary surface. The annotator puts **part of speech before the
parse**. On reflection that is the more sensible order: knowing a token is a
verb is what tells you how to segment it, and POS is available from the surface
form without any analysis. The parse is the pivot for everything *below* it, not
the opening move.

**So the target order is** transliteration, POS, parse, morpheme rows, lemma,
gloss, push to dictionary. Against the current order that is two long moves —
gloss from 2 to 6, parse from 5 to 3 — and two short ones.

**And it is a change to markup, not to the table.** Five levels take their order
from `FIELD_SPEC` and word-edit does not, so this reorder is hand-work on the
one view that was left hand-written. A second argument for converting it, and a
reason to do the conversion before the reorder rather than after.

*F5 should be rewritten rather than closed: its diagnosis was right and its
prescription was one position out.*

---

#### Scope

Every surface where annotation is entered or advanced, in the order the work
actually moves:

1. **corpus → document → section → paragraph → sentence.** Five add-views, each
   a separate page. Whether that ladder matches how a text arrives (usually as
   one block of text to be split, not as a hierarchy to be built).
2. **sentence-edit**, where tokenization happens — the only place words come
   from, and nothing on the sentence view says so (`INPUT_UX_AUDIT` §4).
3. **word-edit**, the case above.
4. **The add-to-dictionary panel and `renderDictEdit`**, both reached
   mid-annotation from a word: four fields and fourteen. *(Was "dict-add /
   dict-edit … 15 and 14 fields (I6)"; the 15-field screen retired at v3.14.270
   and I6 closed with it, so what D46 has to observe here is the panel.)*
5. **the return path**: save, advance, and what the annotator sees next. B-065
   settled advance-on-annotation; **B-083** shows the predicate behind it may be
   answering for the app rather than for the annotator.

#### Questions it must answer, not merely raise

1. **What is the unit of work?** The app assumes a word. An annotator may work a
   sentence at a time across one tier — all the glosses, then all the POS — which
   is how interlinear text is produced on paper and what D41's Reader Mode would
   make visible. Neither is wrong; the app supports only one.
2. **Which field determines which?** Draw the real dependency order once, then
   compare it with the DOM order in each view. Where they disagree, say whether
   the fix is reordering, deferring, or deriving.
3. **Where does the annotator lose their place?** Advance, cancel, and the
   breadcrumb all move the view. `INPUT_UX_AUDIT` §3.5 found no dirty-state
   tracking, so some of those movements discard work silently.
4. **What does a second pass look like?** Every consumer here assumes a first
   pass. Correcting a whole corpus's glosses after a decision changes is the
   normal fieldwork motion and has no surface at all.
5. **Which steps are forced and which are habit?** The parse must precede
   morpheme glosses. Nothing forces transliteration first — it is first because
   it was added first.

#### Method

Same shape as `INPUT_UX_AUDIT`: inventory before judgement. The dependency order
is readable from the source (`_deriveWordFields`, `syncMorphemeRows`,
`ensureMorphemesFromParse`, `_resolveOrCreateLemma`) and the DOM order is
scriptable, so pass 1 can be **executed** rather than eyeballed — the two orders
compared automatically, per view. Passes 2 and 3 are judgement and cannot.

**Deliverable:** `PIPELINE_UX_AUDIT.md`, alongside the other audits, findings ranked, each marked
consolidation or new mechanism, in the same shape as the other audits.

**Size: M.** **Related:** absorbs **F5**, which was filed as a fill-audit
proposal and is really this. Feeds **D34** (the session tracker is a
pipeline surface) and **D41** (Reader Mode is the tier-at-a-time motion made
visible). **Not blocked by anything**, and unlike D38 it should be run *while*
annotation is happening rather than after — the order the work takes is only
observable when someone is doing it.

---
