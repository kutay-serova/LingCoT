# D37: Derived forms and paradigms, rather than one entry per surface form
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Raised 2026-08-26.** Every inflected or derived form currently becomes its own
`type: 'word'` dictionary entry. `metnine`, `metin` and a future `metinler` are
three unrelated entries that happen to share a lemma link. For a documentation
tool working on agglutinative or richly inflecting languages, that is a design
choice the annotator was never offered.

**What exists today.** A lemma layer: `_resolveOrCreateLemma` creates
`type: 'lemma'` entries and `dictByLemmaId` groups members under one, which the
Member Forms panel displays. So the *grouping* is real. What is missing is any
statement of the **relation** between a member and its lemma: whether `metnine`
is an inflected form of `metin`, a derivation with its own lexical identity, or a
spelling variant. All three are stored identically.

**`alternate_forms` was meant to be this, and B-044 decided it is not.** At
v3.14.138 the field split on *conditioning*, as FLEx does: `allomorphs` for
conditioned alternation, `variants` for the unconditioned rest, and **inflected
forms sent here, to D37**. So the prerequisite is met, and it was met by ruling
this work *out* of that field rather than into it. Neither field is matched
against corpus tokens, deliberately, until D35 decides how an ambiguous form
resolves (`variation_fields_test.js` holds that line).

**B-068 forced the question, and its mechanical half is fixed** (v3.14.157: each
form carries its own choice, and the surface form defaults off once the word has
a parse). What it raised is not fixed. Deciding what a derived form *is* — an
inflected member, a new lexeme, a spelling variant — is the larger question
behind it, and the model still stores all three identically.

**Distinctions to keep separate, because conflating any two produces a model that
expresses neither:**

| | what it is | example |
|---|---|---|
| **homograph** (D35) | different lexemes, same form | *bank* river / *bank* money |
| **sense** (D28) | one lexeme, several meanings | *bank* the institution / the building |
| **paradigm member** (D37) | one lexeme, inflected forms | *metin* / *metnine* / *metinler* |
| **derivation** (D37) | new lexeme formed from another | *göz* "eye" / *gözlük* "glasses" |

The fourth is the hard one: a derivation is arguably a new lexeme and arguably a
member of a paradigm, and languages differ. The model should let the annotator
say which they mean rather than deciding for them.

**Prerequisites:** ~~B-044~~ ✅ v3.14.138. **D35 should still land first**, since
both touch how an entry is identified. *(This cited `LEMMA_LAYER_AUDIT.md`, which
was retired to `dev/audits/retired/` at v3.14.230 — consumed and closed by D35
A2, verdict MOOT. The path did not resolve.)* Not scheduled.

---
