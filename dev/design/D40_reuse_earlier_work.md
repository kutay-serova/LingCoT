# D40: Offer the annotator their own earlier work on an identical form
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Raised 2026-08-28. Re-scoped v3.14.273 to word level, with the value measured.**
When a word form recurs, the annotation already exists somewhere in the corpus
and the annotator retypes it; the ask is for the app to **recommend copying**
what it has seen before.

**Measured, both corpora.** Live: 22 word forms occur more than once, and the
tokens sharing a form disagree on gloss, POS or parse in **exactly one** of them.
Sample: 18 repeated forms, **zero** disagreements. The addressable set — a token
empty on a field where a same-form sibling has a value — is **17 of 162 words**
live and 19 of 98 sample.

**Morpheme level gains nothing and is dropped from the scope.** 0 of 77 live
morphemes have an empty gloss; the level is saturated, so there is nothing to
offer.

**The one disagreement is a homograph, which is why the D35 gate is real rather
than cautious.** Live corpus, word level: `yüzdüm` → `swim-PST-1.SG` and
`peel-PST-1.SG`. Morpheme level, same accident: `yüz` → glosses `hundred`,
`swim`, `peel`, POS `NUM` and `VERB`. A silent copy would be wrong 1 time in 22,
and wrong specifically where the language is hardest.

**A prerequisite the spec did not know it had: B-144.** D40 settles identity on
`normForm`, and `S.wordFormRefs` is keyed on the RAW form — 101 keys against 99
folded ones live. The index it names cannot answer its own question.

**Most of the machinery is already built.** `S.wordFormRefs` maps
`word.form → [{word_id}]` and `S.morphFormRefs` maps
`morph.form → [{word_id, morpheme_id}]`, both maintained in lock-step at the
mutation chokepoint. Finding every earlier occurrence of a form is therefore an
O(1) lookup that costs nothing new; what does not exist is the offer.

**This is F2 to F4 of the fill audit, generalised.** F2 proposed gloss
autocomplete from this corpus, F4 the lexicon's POS as a chip. D40 is the same
move made once, for every field, from the corpus rather than the lexicon. If it
is built, F2 and F4 are subsets of it and should not be built separately.

**Four decisions it cannot avoid.**

1. **Offer, never apply.** The fill audit's closing line rules out "any bulk fill
   on load", and the S1 lemma strip (v3.14.108) is the shape that works: say what
   would happen, beside the field, and let the annotator take it. A silent copy
   is how create-on-miss produced duplicates.
2. **Identical by which rule?** `normForm` for the object language, and that is
   settled since every accidental matching regime closed at v3.14.143. For
   sentences, exact text or folded text, and note that `alignTokens` already
   distinguishes the two.
3. **Homographs make this wrong sometimes.** Two tokens sharing a form may be
   different lexemes; copying a gloss between them asserts they are not. **This
   is gated on D35** for the same reason `variants` matching is: it is another
   path from a form to an analysis. Until then, an offer must show *where* the
   earlier annotation came from so the annotator can decline.
4. **Provenance.** A copied field was not annotated by the person who accepted
   it, and B-061 was exactly this mistake. `_derivedFieldProv()` already exists
   for lexicon fills (`annotator_id: null`, `annotator: 'auto (lexicon)'`,
   `derived: true`); a copy needs its own marker, naming the source occurrence
   rather than the lexicon.

**Sentence-level is the sharper version and the riskier one.** A repeated
sentence carrying a full parse is the largest saving in the app; it is also
where B-057 lost data, because a Map keyed by sentence text kept only the first
of two identical sentences. Read that entry before building this.

**Size: M**, most of it interface rather than data. **Prerequisite: D35.**
Not scheduled.

---
