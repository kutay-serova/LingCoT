# D60: a derived value never occupies the annotator's answer, and never arrives unasked
**Updated:** 2026-09-01 · **Version:** v3.14.346 (§2 amended, see *Measured*)
*Design record, written before the work. **Built v3.14.347 (§1) and v3.14.348
(§2, with B-180).** Read it before touching `_deriveWordFields`, `wordGloss`,
`morphFillPlan`, `ensureMorphemesFromParse` or `applyDict`.*

**Decided 2026-09-01**, out of **B-176** and **L-035**, which are one question
asked in two places: *what may the app write into the field where the
annotator's own answer belongs, and when?*

## The four writers, and which two are wrong

| writer | its moment | can the annotator see it | fill-only |
|---|---|---|---|
| `_fillMorphRows` — a chip take | the click | yes, DOM inputs; undone by not saving | no, D55 lets a take overwrite |
| `backPropagate` — saving a dict entry | the save | partly, `reportLinkNotes` | yes, derived-stamped |
| `_deriveWordFields` overwrite, from `saveWord` | the save | `derivePreviewHtml` | **no — an empty field is refilled** ← B-176 |
| `reconcileMorphemesFromParse(true)`, from `applyDict` | **none** | **no** | yes, derived-stamped ← L-035 |

The first two have a moment and a witness. The last two are the subject.

---

## 1. The stored word gloss goes (B-176)

`word.gloss` holds two different things — what a person typed, and the join of
the morpheme glosses — and nothing distinguishes them. The reader has been
guessing for as long as that has been true; `wordGloss` (`:1450`) says so
outright:

> *A word-level gloss the annotator typed themselves is recognised by NOT being
> the compact join, which is what the derivation stores, and wins.*

**A field that needs a heuristic to say who wrote it is storing two things.**
That is also the whole of B-176: clearing the field cannot work, because an
empty explicit gloss is indistinguishable from *never set*, so the save derives
from the morpheme — which exists only because `saveWord` created it when the
gloss was first typed.

**DECIDED: `word.gloss` stores only what a person typed. The join is computed at
read time and never stored.** This is D32 step 2 (v3.14.303) applied to the
second field that had the same defect; `_deriveWordFields`'s own comment on the
transliteration case gives the reasoning and it transfers unchanged — two writers
of one value (PRACTICES §4), and the stored copy is the one that made the field
mean two things.

Three things fall out rather than needing rules: clearing works, because there is
nothing left to resurrect; the heuristic at `:1450` is deleted, because the field
means one thing; and `derived.add('gloss')` goes, taking B-141's stamp problem
for that field with it.

**Why not the cheap fix.** Distinguishing *cleared* from *never set* at the save
is a few lines and closes the reported case. It does not close the next door
along: fill-mode derivation asks only `!word.gloss`, so clearing a gloss and then
loading a dictionary or editing the parse brings it back through
`ensureMorphemesFromParse` → `_deriveWordFields`. "Cleared" would have to be
recorded to survive, which means a tri-state field — absent, `null`, value —
and that is worse than the defect.

**What this costs, stated because it is real.** After the migration, *"the
annotator typed a value identical to the join"* is unrepresentable: it will read
as derived. The text is never lost, only the authorship. B-141 measured **13 of
13** word glosses in `samples/turkish-test` that are exactly the join and all 13
signed by a person who did not type them — so the authorship this narrowing gives
up is authorship the corpus is currently recording wrongly. D32 made the same
trade knowingly for transliterations.

**Scope.** 19 direct reads of `word.gloss`, all in `LingCoT.html` — every module
already goes through `wordGloss()`. Plus a one-time migration (drop a stored
gloss equal to the join) and a pass over export and search.

**The migration, counted at v3.14.345 before anything rewrites a file:**

| | Turkish | Chinese |
|---|---|---|
| words with a stored gloss | 130 | 180 |
| **exactly the morpheme join → dropped** | **128** | **178** |
| differs from the join → kept | 2 | 2 |
| no morphemes at all → kept | 0 | 0 |

**306 of 310 stored word glosses are the join, and the display changes for none
of them** — `wordGloss()` returns the same string. What goes is 306 records
claiming a person typed something they did not: B-141's finding at full scale.

The four that survive are what a typed word gloss is *for* — a compound whose
meaning is not its parts:

```
öğleden   stored 'noon'       join 'noon-ABL'
bir       stored 'one'        join 'a'
炎热       stored 'hot'        join 'scorch-hot'
下午       stored 'afternoon'  join 'down-noon'
```

After the migration that is the only kind of value in the field.

**A consequence worth having.** `wordGloss`'s gap heuristic
`(!w.gloss || w.gloss === compact)` collapses to `!w.gloss`, with no behaviour
change — a stored gloss is typed by definition once the join is not stored. It is
marginally better, too: someone who deliberately types the join now gets their own
value back instead of gap markers.

---

## 2. The bulk fill becomes an offer (L-035)

`applyDict` calls `reconcileMorphemesFromParse(true)`, which walks every word in
the corpus — including complete ones — filling gloss, type and transliterations
and linking, before the annotator has looked at anything.

**Measured, both live corpora, v3.14.342:**

| | Turkish | Chinese |
|---|---|---|
| `dict_id` links written on load | 15 → **34** | 19 → **22** |
| `type` written | — | 14 → **17** |
| stamps | derived 32 · human 2 | — |
| journal records | **0** | **0** |
| `sessionChanges().total` afterwards | **0** | **0** |

It is not destructive: fill-only, ambiguity-refusing, derived-stamped,
deterministic, and a wrong-language dictionary writes nothing (Turkish corpus +
Chinese dictionary: 15 links → 15, zero matching forms). It is wrong in the
*"you didn't ask and can't tell"* sense — 19 writes announced only by a
`logEvent('info')` nobody reads, invisible to the one surface that exists for
"what happened this session", outside the journal, with no undo.

**DECIDED: the walk computes, and writes nothing until the annotator accepts.**

### What is offered

**Both links and content.** The two were nearly split — a link on an unambiguous
form is not a judgement, `linkTo` already refuses ambiguity, and it is reversible
— but **19 of the 22 writes were links**, so automating them would leave the
bulk of what happened invisibly still happening invisibly. The exposure that
matters is not a wrong-*language* dictionary, which is self-limiting; it is a
*plausibly* wrong one — an older copy, a colleague's — where form overlap is near
total and it is precisely the links that go wrong at scale.

### The surface: visualize, then audit

Not a modal. Someone who opened a dictionary to do something else should not be
asked to adjudicate 34 items first. A bare banner is the opposite failure — an
offer nobody opens fills nothing, and the old behaviour was at least doing
something useful.

So: **a review surface that shows what would be written, grouped by form**, with
the proposed value and its source entry on every row, expandable to the words it
would touch. Accept per form, accept all, or dismiss.

Grouped by **form** because that is the unit the decision actually has: L-034
measured **135 of 310** glossed-token decisions as re-decisions of a form already
decided. Form is also what makes the list short enough to read, and what makes a
wrong dictionary obvious at a glance — the proposed values are on screen, in
another language.

**Acceptance goes through `mutate()`**, which makes the session tracker and the
journal correct for free rather than by a second mechanism.

### Not sticky

A dismissal is not remembered. Sticky-per-dictionary sounds right until you
notice the dictionary changes on every `+ dict` push, so "has it changed since
you said no" would be true nearly every session and the stickiness would be
theatre.

The repeat cost is smaller than it looks because **the fill is fill-only**: a
form annotated differently from the dictionary already has a value and never
appears in the offer at all. The only thing re-offered is a field left
deliberately blank, which is rarer than one filled differently. Paying for that
with new persistent state in the corpus schema is the wrong trade. A per-form
"never offer this" is a later feature if the offer turns out to nag, and it
composes with the grouping built here.

### What stays automatic — AMENDED v3.14.346

`reconcileMorphemesFromParse(false)`, at corpus load, materialises morphemes for
a word whose parse names segments that have no morpheme objects. **The line is
content, not writing**: building the objects a parse already implies is not
answering a question about the language.

**The first draft of this paragraph exempted that call and was wrong about the
code.** The materialise branch does not only build objects — it fills each new
morpheme's gloss, type and transliterations from `_dictFillForForm` and links it,
in the same expression that creates it:

```js
word.morphemes = segs.map((form, i) => {
  const fill = _dictFillForForm(form);
  const m = { id, form, transliterations: fill.transliterations || [], gloss: fill.gloss || null };
  if (fill.type) m.type = fill.type;
  linkTo(m, { cands: fill.dict_cands });
```

So the division is not between the two callers, it is inside one function, and an
exemption written along the wrong line would have left the whole of L-035 running
through a door this record had declared closed.

**DECIDED: the load pass materialises STRUCTURE ONLY.** The fill is a per-CALL
choice, not a property of the function — `ensureMorphemesFromParse` has exactly
two callers and they want opposite things. `reconcileMorphemesFromParse` asks for
structure; `backPropagate` asks for the fill and is entitled to it, because it
runs inside an annotator act that already has a moment and a witness. The flag
carries the decision to the place it is read.

### Measured before deciding, both live corpora, v3.14.345

| | Turkish | Chinese |
|---|---|---|
| words | 153 | 212 |
| **morpheme-less but carrying a parse** | **0** | **0** |
| morphemes the load pass would materialise | **0** | **0** |

**The branch fires on nothing.** It cannot fire on a fresh corpus either:
`corpus_ingest.py:1110` writes `morphological_parse: None` alongside
`morphemes: []`, so an ingested corpus has no parse to materialise from. The only
producer of a parse without morphemes is `backPropagate` seeding one from an
entry's `constituent_forms` — and it calls `ensureMorphemesFromParse` on the next
line, inside the act.

So structure-only costs nothing measurable on any corpus this project can
currently produce, and the regression the decision was weighed against — a corpus
that used to open with glosses opening without them — does not exist. **An
exemption defended by argument is worth less than one defended by a zero**, which
is why this paragraph now carries the number instead of the reasoning that
replaced it.

### And what the offer will actually hold

Empty fields are capacity, not what a dictionary can supply:

| | Turkish | Chinese |
|---|---|---|
| morphemes with no `dict_id` | 119 | 163 |
| …that `applyDict` links | **19** | **3** |
| morphemes with no `type` | 119 | 168 |
| …that `applyDict` fills | **0** | **3** |

The review surface has **19 rows on Turkish and 6 on Chinese**, not 34 and 22.
Small enough to read honestly, which makes the by-form grouping a convenience
rather than the thing that saves it.

---

## 3. Riding along, filed separately

`ensureMorphemesFromParse` writes without ever calling `mutate()`, so those
writes miss the journal while `_journalComplete` stays `true` — a completeness
claim the code does not hold. True regardless of what is decided above, so it is
**B-180**, fixed in whichever version touches that function first.

---

## Order

**B-176 first**, then L-035. B-176 settles what a derived value may *occupy*;
L-035 settles when the app may *write* one. Doing B-176 first also shrinks
L-035: once the derived gloss is not stored, the apply path has one less field
to propose and `_deriveWordFields` stops writing a gloss at all.
