# D30: Next / previous navigation
**Updated:** 2026-08-27 · **Version:** v3.14.134  
*Frozen at the version it was moved out of DEV_PLAN. Not bumped again.*

**Moved out of `DEV_PLAN.md` on 2026-08-27** at v3.14.134, when the plan was trimmed to
open work. Nothing was edited: the text below is the design as it was written and
shipped. It is kept because it explains *why the current code is shaped this way*,
which the code alone does not say.

**What it explains:** `navAdvance` / `navGo` / `navControls`, the keyboard gate, and the Save-advances rule as amended by B-065. Guarded by `nav_traversal_test.js`, `save_advance_test.js`.

**Indexed from** DEV_PLAN §5. Lives in `dev/design/`, which SHIPS: this is
reference for anyone reading the code, not developer history.

---

### D30: Next / previous navigation ✅ v3.14.75

Streamlines the core annotation loop. Requested 2026-08-24; **design settled 2026-08-24** after a first pass put the controls in the wrong place.

#### Settled

**1. The controls live in the RENDER views, not the edit views.** `renderWord` and `renderSentence` get the prev/next pair. The first draft put them in the editors, which was wrong twice over:

- It created an unsaved-changes problem that does not need to exist. "advance while dirty" had to either auto-save, prompt on every token, or refuse. **Moving the control out of the editor deletes the question rather than answering it.**
- **It would have made keyboard navigation fight the text inputs.** An edit view is wall-to-wall `<input>`; binding arrow keys or `n`/`p` there means intercepting keystrokes the annotator is aiming at a gloss field. A render view has no text inputs at all, so the same bindings are unambiguous. Keyboard support moves from "open question" to **P1 scope** on the strength of this.

**2. Save advances.** `edit → Save → the NEXT item's render view`, replacing today's `saveWord → go('word', {same id})` and `saveSentence → go('sentence', {same id})`.

**3. Cancel does NOT advance.** it returns to the same item's render view. The asymmetry is the point: Save means "done with this one", Cancel means "never mind".

The loop becomes: *render view → next → click a word → edit → Save → next word's render view.* One direction of travel, with the render view as the resting state.

#### Consequence to accept knowingly

**Save-and-advance means you never see the result of your own edit.** Today, saving a word lands you on that word's view, where the new gloss is visible. After D30 you land on the *next* word. This is a real loss and the mitigation is structural rather than incidental: you land in a render view whose **prev** button goes straight back to what you just saved. That only works because of decision 1. With the buttons in the editor there would be no way back.

#### Settled (2026-08-24, from corpus data)

**4. Word navigation SKIPS punctuation.** Measured across the corpora: **116 of 563 tokens (20%) are punctuation, and exactly 3 carry any annotation. All of them `head` + `dep_rel` only, never a gloss, parse or PoS.** That is UD `punct`, and it is assigned from the *sentence* editor's dependency table, a different surface reached as a whole sentence, so the word loop never needs to stop on a comma: skipping costs nothing and saves one keystroke in five. The skip is symmetric, `prev` never lands on punctuation either.

**5. Traversal is the whole DOCUMENT, a true linear pass.** The original question ("roll into the next sentence?") was too narrow: with punctuation skipped and **93% of sentences ending in punctuation**, the last content word is already the last stop, so *every* level is a potential dead end. Corpus shape: median **17 tokens/sentence**, 2–8 sentences/paragraph, 1–4 paragraphs/section, stopping at the sentence means a dead end every ~16 tokens, at the paragraph every ~50.

`next` therefore crosses sentence, paragraph and section boundaries. **It stops at the document end.** crossing into another document would change what `doc()` returns and the identity of the whole page, which is a navigation act, not an advance.

**6. Crossing is signalled by the breadcrumb plus a brief highlight** on the part that changed. Silent crossing risks losing the annotator's place; a confirm prompt every ~16 tokens would defeat the feature. *Implementation note:* that highlight is a post-render DOM tweak driven by comparing the previous position, so the flag holding it is **view state that must not go stale.** either in `render()`'s cache key or, better, applied directly and recorded in `render_cache_test.js`'s `TARGETED_REFRESH` with its repaint named. B-011 and B-019 were both this exact class.

**7. Corpus end disables, never wraps.** With 32 sentences total the end is reached often; wrapping to the beginning reads as a bug.

**8. Both levels ship in P1.** `renderWord` and `renderSentence`. Sentence-level next is how translation and dependency-parse passes move, which is a different pass from glossing and needs the same streamlining.

**9. Arrival from search means nothing to it.** `renderWord` is reachable from Search-B results and dictionary examples, but next/prev always means **corpus order**. C20's breadcrumb already offers "‹ Search results" for returning to the set, and a control that silently changes meaning based on how you arrived is worse than one that does a single thing. Result-set traversal, if wanted, belongs in the results view as its own affordance.

#### Still open

**Skip-to-unannotated** (advance only to tokens still missing a gloss or parse) is a **follow-up, not P1**. On a fresh corpus almost everything is unannotated, so the mode is indistinguishable from plain next; its value appears during cleanup passes.

#### Implementation notes

**No new index is required**, which is the cheap path and worth keeping:

- `S.sentById` already carries `{ sent, para, paraIdx, sect, sectIdx, sentIdx, docIdx }`, next sentence is `para.sentences[sentIdx + 1]`, O(1).
- `S.wordById` carries `{ word, sent, para, paraIdx, sect, sectIdx }`. Next word is `sent.words[indexOf(word) + 1]`, O(sentence), which is trivially small.
- `S.wordById` records have **no `sentIdx`/`docIdx`**, so crossing a sentence boundary from a word needs `S.sentById.get(rec.sent.id)` to get the full position. One extra map lookup; do that rather than widening the word records, which would cost memory on every token in the corpus for a field used only by this feature.

Best shape is a single `advance(kind, id, dir)` helper returning the next id or null, so the punctuation rule and the boundary rule each exist in exactly one place and the render views and the save paths share them.

**Prerequisite already met:** B-008's `render()` hardening is in, so a renderer failure during a rapid-advance loop surfaces as an error panel rather than a frozen view. Worth having before adding a control that re-renders on every click.

**Related, decide at design time:** `renderParagraph` and `renderSection` lack the same control. Whether the pattern extends up the hierarchy is cheaper to settle now than to retrofit.

---
