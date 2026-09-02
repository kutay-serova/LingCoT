# ANNOTATION FILL AUDIT: what fills what, on what condition, and how it matches
**Updated:** 2026-08-25 · **Version:** v3.14.109  
*Frozen. The version is the build this was written against, not the current one.*

**Date:** 2026-08-25 · **Against:** v3.14.109 · **Status:** findings only, nothing changed.
The other half of **B-033** (the linking half is `LINKING_AUDIT.md`).
Bugs filed: **B-056 · B-057 · B-058 · B-059 · B-060 · B-061**.

**Method.** Every fill path read in `LingCoT.html`, `events.js` and `participants.js`,
then the consequential ones **executed** against real Turkish. Two of the findings
below are demonstrations, not readings, because the difference between "this looks
wrong" and "here is the input that loses your data" is the difference between a
note and a bug.

---

## 1. The fill graph

Direction matters more than the list. There are **three** derivation directions,
and they are not symmetric.

> **Superseded in part, v3.14.333.** §1's three tables were measured at
> v3.14.115 and five rows are now false. Re-measured by UNIFIED_AUDIT §7:
>
> - **§1.2's transliteration row is wholly obsolete** — D32 removed the
>   derivation (`LingCoT.html:2308-2328`), so "label hard-coded `'Translit'`" and
>   "never cleared" describe nothing. §6's "invents a label" row goes with it.
> - **§1.1's "`part_of_speech` is not in the list"** — `_dictFillForForm` returns
>   it now (`:1759`). *Inheritance* is still refused, correctly; the sentence as
>   written is not true, and POS is offered to morpheme rows and, since B-166, to
>   the word.
> - **§1.1's dict→`dict_id` "fill-only, matches by normForm"** — no longer
>   unconditional: `linkTo` refuses an ambiguous form (`:4237`) and stamps.
> - **§1.1 row 4's "exact `===`"**, and §2's four case regimes — replaced by
>   `alignTokens`/`alignMorphemes` with a `normForm` second pass, plus a loss
>   warning. B-057 and B-120 closed.
> - **§1.3's "`saveNewDictEntry` back-propagates less than `saveDictEntry`"
>   (B-058)** — closed; that function is gone and both routes share
>   `backPropagate`. §1.3's push trigger is a candidate picker with three entry
>   routes, not a checkbox.
> - **§5's `inferPos`** — deleted at D53 stage D.
>
> §7's own table replaces these three. This document is kept for its reasoning
> and for §7-§8, which are still the record of why the fill rules are what they
> are.

### 1.1 Downward: parse → morphemes

| source → target | trigger | condition | mode | matches by |
|---|---|---|---|---|
| `morphological_parse` → morpheme rows | render + **every keystroke** in `#ew-parse` | parse non-empty | rebuild | `split('-')`, positional |
| `morphological_parse` → `word.morphemes[]` | corpus load · dict load · dict save | `morphemes.length === 0` | materialize | positional |
| dictionary → `gloss`·`transliterations`·`type`·`dict_id` | same | field empty | **fill-only** | `normForm` (the real key) |
| stored morpheme → rebuilt row | render, save | form matches | carry `id`·`translit`·`type`·`dict_id` | **exact `===`** |

`_dictFillForForm` composes **per field, from different entries.** the gloss may
come from one dictionary entry and the transliterations from another. That is
deliberate and documented in the code. **`part_of_speech` is not in the list**:
a morpheme never inherits POS from the lexicon.

### 1.2 Upward: morphemes → word

`_deriveWordFields`, fill mode everywhere except `saveWord`, which overwrites:

| target | derived as | cleared when empty? |
|---|---|---|
| `word.gloss` | morpheme glosses `.join('-')` | yes (overwrite mode) |
| `word.morphological_parse` | morpheme forms `.join('-')`, **only if > 1 morpheme** | yes |
| `word.transliterations` | morpheme translit **[0]** `.join('-')`, label hard-coded `'Translit'` | **no, never cleared** |

That last asymmetry is real: emptying the gloss field re-derives or nulls, emptying
the transliteration field leaves the old value standing.

### 1.3 Sideways: dictionary ↔ token

| source → target | screen | condition | mode |
|---|---|---|---|
| `entry.gloss` → `word.gloss` | dict **edit** save | `wordId` present, word gloss empty | fill-only |
| `entry.constituent_forms` → `word.morphological_parse` | dict **edit** save | parse empty | fill-only |
| `entry.lemma_id` → `word.lemma_id` | dict edit + dict add | word has none | fill-only |
| token analysis → dictionary entry | word save, `ew-push-dict` checked | - | fill-only upsert |

**`saveNewDictEntry` back-propagates less than `saveDictEntry`.** it does not copy
the gloss and does not seed the parse. Creating an entry and editing an entry
therefore leave the token in different states. Nothing documents this as a choice.
**B-058.**

---

## 2. Case matching: four different regimes, in one codebase

This was the sharpest question asked, and the answer is that the app does **not**
have one notion of "same form". It has four.

| regime | where | folds |
|---|---|---|
| `dictKey` / `normForm` | all dictionary lookups, chip fills, the reconcile coverage check | NFC + script fold + locale-aware case (B-043) |
| **exact `===`** | morpheme reuse in the editor (`:5149`, `:5361`), morpheme reuse on save (`:6747`), **word reuse on re-tokenization** (`:6674`), sentence reuse in section-edit (`:6483`) | nothing |
| raw `.toLowerCase()` | the dictionary **browse filter** (`:4378‑4383`), the morph-suggest chip splice | ASCII case only; this is the pre-B-043 key |
| `.toUpperCase()` | selection-template POS matching | ASCII case only |

**The exact-`===` regime is where the damage is.** It is used for the one question
that decides whether an annotator's work survives an edit: *is this the same token
I already annotated?*

**B-043's fix did not reach the browse filter.** Executed:

```
browse-search "istanbul" against "İstanbul"   current: MISS   with the real key: HIT
browse-search "ısparta"  against "ISPARTA"    current: MISS   with the real key: HIT
```

So the dictionary key was fixed and the dictionary *search box* still has the bug.
**B-056.**

---

## 3. Re-tokenization silently discards annotated tokens

The most expensive finding. `saveSentence` rebuilds `sent.words` and reuses an old
word only on `w.form === form`, exact, case-sensitive:

```js
const matchIdx = oldWords.findIndex((w, wi) => !usedOldIdx.has(wi) && w.form === form);
```

Executed against a real annotated token:

```
edit "Uçak" -> "Uçak"    exact===: KEPT   dictKey: KEPT
edit "Uçak" -> "uçak"    exact===: LOST   dictKey: KEPT
edit "Uçak" -> "UÇAK"    exact===: LOST   dictKey: KEPT
```

"LOST" means the word object is replaced by a bare one: **gloss, morphemes,
morpheme glosses, `lemma_id`, `dict_id`, POS and all provenance are gone.** No
confirmation, no count, no undo.

**And the app already knows how to warn.** Immediately below, `_depSweepHeads`
clears orphaned dependency heads and *alerts*, its comment says "a silently
dropped head would be invisible data loss." That is exactly right, and the code
one screen up drops whole annotated words in silence. The same reasoning was
applied to the cheaper loss and not the expensive one. **B-057, S1.**

`saveSection` and `saveParagraph` have the same shape one level up, keyed on
**exact sentence text** (`oldSentByText`), so correcting one character of a
sentence discards every word and annotation under it.

---

## 4. Interlinear alignment is broken by construction

`_deriveWordFields` joins morpheme glosses with `-` after `filter(Boolean)`.
Un-glossed morphemes are dropped with **no placeholder**:

```
3 morphemes, middle unglossed -> "go-1SG"
2 morphemes, both glossed     -> "go-1SG"
indistinguishable: true          (parse says git-ti-m, gloss says go-1SG)
```

For interlinear glossed text this is not cosmetic. Leipzig rule 2 requires the
morpheme line and gloss line to have the **same number of hyphen-separated
elements**. The app's own export therefore produces misaligned IGT whenever a
word is partially glossed, which is the normal state of a corpus in progress.

The same join is also **not escaped**, and `-` is a legal character inside a
gloss:

```
morphemes [ev "house-LOC"], [de "at"]  ->  "house-LOC-at"   (3 segments from 2 morphemes)
```

**B-059.** The fix is a placeholder for un-glossed positions and a decision about
`-` inside a gloss; both are data-format choices, so they need to be made
deliberately rather than patched.

---

## 5. Dead and half-wired fill paths

Confirmed by grep across `source/`:

- **`inferPos(gloss)`** (`:3976`) infers a POS from a gloss abbreviation and is
  **never called**. A gloss→POS inference already exists, written and unused.
- **`pre.translit`** is captured into `S.dictNewEntry` and then dropped:
  `renderDictAdd` calls `renderTransliterationsEditor('da-translit', [])` with a
  hard-coded empty array. Typing a transliteration on a morpheme and clicking
  "+ dict" silently loses it.
- **`data-add-constituent-forms`** has a consumer and **no producer**.
  `alternateForms`, `semanticDomain`, `usageNotes` are read by `renderDictAdd`
  and never written by `events.js`.
- The chip `data-translit` reads the **legacy scalar** `entry.transliteration`,
  which the current schema never writes, and fills `.morph-translit-input`, which
  was removed from the DOM in v4.0.9.

**B-060** covers the four dead prefills together; they are one defect (a prefill
contract nobody owns), not four.

---

## 6. Defaults that are decisions

| default | value | comment |
|---|---|---|
| dict entry type | `'word'` | reasonable |
| morpheme type on push | `'bound.morpheme'` | reasonable |
| dict-add POS for a non-initial morpheme | `'affix'` | **`affix` is not in `POS_CHOICES`.** related to B-027 |
| section title | `Section N` | positional; survives a reorder wrongly |
| synthesised translit label | `'Translit'` | invents a label the annotator never chose (D32) |
| derived field provenance | `annotator: 'auto (lexicon)'`, `derived: true` | good, derived values are honestly marked |
| MT translation provenance | `annotator: 'auto-<method>'` | good |
| dict-edit gloss back-propagation | `field_prov.gloss = prov()` | **attributed to the human**, though the human did not type it there, inconsistent with the two rows above. **B-061.** |

---

## 7. What auto-fill would actually help: proposal

The audit's real question. Grounded in the measured state: `word.dict_id` 1.8%,
`word.lemma_id` 3.9%, `morpheme.dict_id` 2.9%, and 823 words across three corpora.

**The pattern in the data is that annotators fill morphemes and not words.**
Morpheme transliterations are populated 17% against the word level's 1.4%. The
upward derivation already exploits this. The proposals follow the same grain:
*let the annotator work at the level they naturally work at, and derive the rest.*

**F1. Repair the matching before adding any new fill.** Every proposal below
makes the app write more automatically; doing that on top of §3 means
automatically-derived work is silently destroyed by a capitalisation fix. Order
matters: **B-057 first, then everything else.**

**F2. Gloss autocomplete from the lexicon, not just from Leipzig.** The gloss
field autocompletes Leipzig abbreviations (`_LEIPZIG_GLOSSES`) but **not the
glosses already used in this corpus**. In a fieldwork corpus the second is far
more valuable: the annotator is trying to gloss *consistently with themselves*.
The harvesting infrastructure already exists (`S.posValues`, `_indexSelectionLabels`
pattern) and would cost one more harvested set.

**F3. Show the derived value before it is written.** `_deriveWordFields` in
overwrite mode silently replaces the word gloss on every save. The annotator
cannot see what will be derived until after it happens. The **S1 lemma strip
pattern from v3.14.108 fits exactly**: one line under the field saying *"will
derive: go-PST-1SG"*, which also makes §4's misalignment visible at the moment it
is created rather than at export.

**F4. Propagate POS downward, offered not applied.** A morpheme never inherits
POS from the lexicon, and `inferPos` sits unused. Rather than wire `inferPos`
(gloss→POS guessing is unreliable cross-linguistically), offer the **lexicon's**
POS for a matched morpheme as a chip, the way the gloss chips already work. The
data is already in `_dictFillForForm`'s candidate set; only `part_of_speech` was
left out of the returned object.

**F5. Make the parse field the primary surface.** Typing a parse already
rebuilds the rows live. Extending that so a segment matching a lexicon entry
*shows* its gloss inline as ghost text, accepted with one key, would let a
whole word be annotated without leaving the parse field. This is the single
highest-leverage change for annotation speed, and it needs no new data model.

**F6. Fill the gaps at export, not in the data.** For §4, an un-glossed morpheme
should render as a visible placeholder in IGT output while staying empty in the
data. Filling the data with placeholders would make "unannotated" unfindable, and that is what D34's missing-annotation panel needs to count.

**Explicitly not proposed:** inferring glosses from morpheme forms, auto-applying
lexicon POS without confirmation, and any bulk fill on load. All three write
linguistic claims the annotator did not make, into fields whose emptiness is the
only record that the work is unfinished.

---

## 8. Checked and found correct

- `_pushTokenToDict` and the `ensureMorphemesFromParse` enrich branch are
  fill-only throughout, verified again here.
- Derived values carry honest provenance (`auto (lexicon)`, `derived: true`),
  with the one exception in §6.
- The parse/morpheme mismatch path warns and leaves data alone rather than
  re-segmenting.
- The `#ew-gloss` ↔ `#ew-mg-0` mirror stops the moment either field diverges,
  rather than fighting the annotator.
- MT translations **append** and never replace an existing translation.
