# D32: One transliteration model · ✅ BUILT v3.14.303
**Updated:** 2026-08-31 · **Version:** v3.14.303

## Decided and built, v3.14.303

| step | decision | closed |
|---|---|---|
| 1 | fix the provenance first | **B-141 ✅ v3.14.280** — what made the evidence below trustworthy |
| 2 | the join is **computed at read time and never stored** | a stored element is now always something a person wrote |
| 3 | word and morpheme both draw the shared multi-label editor | **B-045**, **B-093**, **B-142** |
| 4 | a label is **raw free text with an autocomplete recommendation**, harvested from all seven levels | **B-145** |

**Re-measured before deciding**, which is what step 1 bought: `chinese-test`
holds **180 word-level elements, all hand-typed pinyin, all signed by a person,
none derived**; morphemes hold none; `turkish-test` holds none; nothing anywhere
carries a second label. **Zero stored derivations existed**, so step 2 cost no
migration — and would have cost one had it been deferred again.

**Step 2's argument, in the end, was rule 4 rather than the model question.**
`wordTranslit()` had always joined the morphemes at read time; `_deriveWordFields`
stored the same join under a minted label. Two writers of one value, and the
stored copy is what made `transliterations` mean two things.

**Step 4 refused to adjudicate.** Folding the labels was on the table and was
declined: a project may mean what it likes by a label, which is the standing
`tag_control_test.js` defends for categories. What the app owes instead is that
every label already in the project is offered back — B-145 harvested two levels
of seven, which is why two spellings of one label could not have been prevented.

**Step 5 (D48's `core`/`aux` tier) was not taken** and does not block D34, whose
counter reads the `core` tier regardless.

*The re-spec that led here follows, unchanged.*

---

**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**The question changed when the data was measured.** D32 asked "is a word's
transliteration authored or derived", on the understanding that the derivation
was a read-path fallback. It is not: `_deriveWordFields` **stores** it, under a
label the annotator never typed, and the same label is minted when they DO type
one — so the two are indistinguishable in the file. Then `saveWord` signs it as
theirs.

**Measured 2026-08-30, both corpora.** 42 transliteration elements exist in
total. **39 carry the minted label `Translit`.** Of the 33 word-level stamps in
the live corpus, **30 are signed by a person and 0 are marked derived.** The
other three elements are the only hand-typed labels anywhere, and two of them
disagree with the third on case (`"test system"` / `"Test System"`, B-145).

**Nothing anywhere carries more than one transliteration.** Not one object at any
level in either corpus. B-042's show-two-fold-the-rest control has never fired on
real data.

#### The re-spec, in order

**1. Fix the provenance first (B-141).** A derived transliteration must be
stamped derived, through `_derivedFieldProv` and `stampField` like every other
derived value since B-137. This is a defect, not a design choice, and it is the
third occurrence of B-061's shape. **It also has to come first because the
evidence D32 would decide from is currently 93% machine output wearing an
author's signature.**

**2. Then decide the model, with honest data.** The choice is no longer
"authored or derived" in the abstract — the app does both and always has. It is:

  - **keep storing the derivation**, marked derived, so the file says which
    elements a person authored; or
  - **compute it at read time** and drop the 39 stored elements, so the file
    holds only what a person typed.

The second is smaller data and a migration; the first is no migration and a
permanent two-kinds-of-element rule. **Decide it against the corrected corpus,
not the current one.**

**3. Then the surfaces**, which are the same build either way: **B-045** (word
edit gets the multi-label row editor, or the box is honestly labelled an
override) and **B-093**'s transliteration half (morphemes get an editor). Both
are blocked here by their own text and neither can be built first without being
built twice. **B-142** — the box cannot clear the field — is fixed with them.

**4. Label identity, once, for three consumers.** Free text, folded text, or a
vocabulary. Whatever is chosen is also the rule for `loadLanguageMaps`'s aliases
(**B-035**) and for `_indexWordLabels`, which today harvests labels from words
and morphemes only, so three of the five levels contribute nothing to the
suggestion pool (**B-145**).

**5. D48's open tier.** `transliterations` is `aux` at every level and the
`core`/`aux` choice parks here — a one-word table edit plus a migration question.
Conflict ⑧ says D34 cannot be built until it lands; that is narrower than it
sounds, and D34's counter should read the `core` tier regardless.

**Not in scope:** what a compact view shows when several labels exist. That is
D31's, it has zero instances in the data, and it is answered for free by whatever
D31 decides about primacy.
