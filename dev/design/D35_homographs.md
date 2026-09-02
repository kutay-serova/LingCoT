# D35: Homographs — distinct objects that share a form · ✅ COMPLETE v3.14.282
**Updated:** 2026-08-30 · **Version:** v3.14.282

*Why the code is shaped this way, kept because the code does not say it. Stages
A (v3.14.183–185), B1–B6 (v3.14.277–282) and C (v3.14.282) all shipped; the plan
scaffolding was removed at v3.14.283 now that there is nothing left to schedule.
FROZEN: stamped with the build a stage shipped against.*

| | | |
|---|---|---|
| [A](#stage-a--the-model) | the model | ✅ v3.14.183–185 |
| [B1](#b1--the-read-path-stops-guessing) | the read path stops guessing | ✅ v3.14.277 |
| [B2](#b2--the-chooser) | the chooser | ✅ v3.14.277 |
| [B3](#b3--not-this-one) | "not this one" | ✅ v3.14.277 |
| [B4](#b4--the-last-two-first-picks) | the last two first-picks | ✅ v3.14.281 |
| [B5](#b5--the-lemma-group) | the lemma group | ✅ v3.14.282 |
| [B6](#b6--orphaned-lemma-records) | orphaned lemma records | ✅ v3.14.282 |
| [C](#stage-c--the-deliberate-guard-edit) | the deliberate guard edit | ✅ v3.14.282 |

**What remains of the thread is B-114**, a discriminator on a lemma record. B4
refused to draw a lemma picker because two records would have been two identical
rows; B5's group view is what makes them tellable apart, so it is buildable now
and is a bug rather than a stage.

---

## The problem, and why it was urgent

Two different linguistic objects can share a surface form — *bank* (riverside)
against *bank* (financial), or two affixes spelled `-de`. For a
language-documentation tool that is not a missing convenience; it is a missing
part of the data model, and the reporter flagged it as determining whether the
app could be used for proper annotation at all.

**Homographs are not senses.** *bank*(river) and *bank*(money) are two entries;
"a financial institution" and "the building housing it" are two senses of one
entry. Conflating them produces a model that expresses neither, which is why
**D28 stays separate**.

## Stage A — the model

| | Decision | Where |
|---|---|---|
| 1 | the discriminator is a **stored number**, `homograph: 2`, never renumbered | A1, v3.14.183 |
| 2 | the lemma layer is an id without an entry; `lemma_id` names a group | A2, v3.14.184 |
| 3 | a unique form match auto-links, stamped derived; an ambiguous one writes **nothing** | A3, v3.14.185 |

**Two alternatives were rejected and should not be re-proposed.** *Deriving the
number from bucket order* renumbers the survivors when a sibling is deleted, and
a citation that moves is not a citation. *Deriving identity from POS and gloss*
fails because two homographs can share both — the app would offer two
identical-looking choices.

**A2 settled a question the original plan left open:** the citation form is
**stored**, in a lemma registry sharing the dictionary file on
`record_type: 'lemma'` lines, not derived from a member form. In Turkish the
citation form is usually not a token form at all — `olmak` never appears in a
text.

**Why A came first, which is the reasoning and not the history.** Measured on
`samples/turkish-test`: 19 of 20 morphemes linked to an entry against **12 of 98
words**. The gap was structural — a morpheme got `dict_id` from the fill path, a
word only when the annotator ticked "save to dictionary". A discriminator and a
picker can arrive at any time without touching a stored record; **a link that was
never written cannot be backfilled**, because the intent was never captured.
Every token annotated before A3 is resolvable by form only, forever.

## Stage B — behaviour, no migration

**The surface was chosen before it was drawn**, from three mocked options: the
word view with an immediate write, the editor with a staged one, or both. The
word view won because an ambiguous token has **no link at all** — choosing is a
complete act with nothing to carry into a save, and it is resolvable while
reading rather than only from inside the editor.

### B1 — the read path stops guessing

`dictResolution(obj)` returns `{ state, entry, cands, derived }` with `state` one
of `linked` / `unique` / `ambiguous` / `none`; `resolveDictEntry` is a thin
reading of it. The old single-entry return had four questions to answer and could
serve one (PRACTICES §3).

**`cands` means *the entries this FORM offers*, in every state** — not the
resolution's own. The first draft read it the other way, which put a linked
token's count at 1 and sent every rejection down B3's second path. A field that
means two things is how that happens.

### B2 — the chooser

`_ambCardHtml`: the Lexicon card's shell with a list body, so an ambiguous form
and a resolved one are one object in two states rather than two unrelated
widgets. **Not an offer strip** — D42 owns "a value you can take into a field",
and this is a choice between objects.

Each row carries `type` as well as gloss because **A1 rejected identity-by-POS-
and-gloss**, and the only ambiguous form in `samples/` is exactly that: two NOUNs
glossed `text` differing solely in `type`. A chooser omitting it would have
rebuilt the rejected model in the interface. Past four candidates they fold
(D45) rather than truncate. Choosing calls `linkTo(…, {chosen: true})`, which is
the single case that flag was written for.

### B3 — "not this one"

The card takes D43's treatment of a derived value: a quiet `·auto`, who and when
on hover, **never a banner**. That restraint is load-bearing rather than taste —
most links in an annotated corpus are matched rather than chosen, so a louder
mark would shout on nearly every word.

**The reject branches on the form, not on the link:**

| entries sharing the form | "not this one" does | why |
|---|---|---|
| several | clears the link and its stamp; the chooser answers | `linkTo` refuses an ambiguous form on every later save, so the rejection sticks |
| one | opens D51's panel with `new_anyway` | clearing alone would be undone by the next save's auto-link. The only way to reject a unique match is to create the sibling that makes the form ambiguous |

**`new_anyway` is declared, not inferred.** `createEntries` re-asks the
dictionary itself, and every signal available to it — a matching form, a matching
type — is exactly what a FILL looks like. The panel's live re-check honours it
too, so retyping the form does not quietly turn the sibling back into a fill.

### B4 — the last two first-picks

Four places answered "which entry is this form?" with `[0]` of a Map bucket.
`linkTo` stopped at v3.14.260, `dictResolution` at v3.14.277; these are the
remaining two, and they took **opposite** answers.

**`suggestParseEntries` offers all of them.** It took `entries[0]`, so a
homograph past the first could not become an offer at all. Every entry for a
segment is offered now, with the homograph number leading the chip's meta line —
plain text, not `homographSup`'s markup, because `offerStripHtml` escapes both
label and meta and a chip is one component (D44).

**`resolveLemma` refuses, and offers nothing.** A bucket of two returns
`ambiguous`; `_resolveOrCreateLemma` writes neither a link nor a third record.
**No picker, and that is the decision:** a lemma record had no discriminator, so
a chooser would have drawn two identical rows. *Creating a third record on an
ambiguous citation was the tempting alternative. It is how the pile got there.*

### B5 — the lemma group

`lemmaGroup(id)` asks `dictByLemmaId` **and** `corpusLemmaRefs`, both of which
already existed and were already maintained — which is why B-106 turned out to be
a view rather than a model change.

**The two lists are not merged**, and that is the design: an entry carrying
`lemma_id` is a lexicographer's statement about the lexeme, a token carrying one
is a per-occurrence annotation the model deliberately never auto-reconciles with
it. One list would assert an agreement the data does not claim.

**A group with no entries is the NORMAL case** — 19 of 33 live lemmas — because an
annotator of an agglutinative language does not want a word entry for
`giydiklerini`. The view says so in words rather than rendering an empty box.

*The alternative was to fill the entry side by linking the lemma to the root
morpheme's entry when a push creates no word entry. **B-069** established the app
cannot justify that call: whether a stem is free or bound is a fact about the
language, not a position in a string. One option describes what the data is; the
other changes the data to fit a dictionary-shaped answer.*

The lemma value on the Lexicon card navigates here. A2 left that badge as plain
text naming a dictionary entry that no longer existed, and a link to nothing is
worse than no link. `S.lemmaId` joins the render cache key — two groups visited
in a row are one view at one `_dataGen`, which is B-011's shape exactly.

### B6 — orphaned lemma records

`orphanLemmas()` reports; an entry delete says how many now exist; the group view
offers to delete **one**, and refuses while anything still points at it.

**Collected, never swept.** A lemma record is an annotation object with a citation
form somebody typed, and **one created ahead of its members is indistinguishable
from one left behind** — elicitation is what the blank add-entry door exists for.
So nothing removes one without being asked.

## Stage C — the deliberate guard edit

`variation_fields_test.js` read "neither `variants` nor `allomorphs` may become
matchable **while D35 is open**". That clause expiring is the whole reason C
exists as a named step: a guard whose stated reason has lapsed gets repaired in
passing by whoever meets it next, and repaired means weakened.

**The assertion did not change. The reason did.** D35 removed the stated blocker
and not the actual one. B-044 decided what these fields ARE: `variants` is
documentation-only, and inflected forms went to **D37**. Matching a token against
a variant is a claim that a surface form belongs to a lexeme — a paradigm
question — and D37 has not said what an inflected form is. Standing rule, owned
by D37; overturning it belongs in D37's design document, not in a guard comment.
`dictResolution` and `resolveLemma` joined the same check rather than being
exempt for being newer.

**The rule had already been applied once, at v3.14.277.** `push_to_dict_test.js`
asserted `resolveDictEntry({form:'bank'}).id === 'd_river'` against a fixture
holding two `bank` entries — a guard pinning the guess, insertion order standing
in for an answer. It was rewritten to assert `ambiguous` on the same fixture
rather than repaired to match the new return.

**B-048**'s reference counting is harder to read with siblings sharing a form.
That is D35's problem rather than the delete path's, and it is unresolved.

## What this did not break

**B-043, B-057 and the S1–S3 linking work** each assumed form → one object. None
became wrong; each became ambiguous, which is what A3 and B1 are for.
