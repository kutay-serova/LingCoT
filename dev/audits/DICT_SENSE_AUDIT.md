# Dictionary Sense Audit
**Updated:** 2026-08-25 · **Version:** v3.14.53  
*Frozen. The version is the build this was written against, not the current one.*

> ### ◻ Still open, status added 2026-08-25
> **This is the only audit here that has NOT been implemented.** It is DEV_PLAN
> §2 **D28**, audit complete and not scheduled.
>
> Written against v3.14.53; the D23 sense *fields* (`semantic_domain`,
> `usage_notes`, `allomorphs`, `pinned_examples`) had already shipped by then and
> do not answer it. The finding stands: one form with several distinct senses
> still cannot be expressed, because there is no sense layer.
>
> ### It is measurable again, v3.14.390
> Its counts have been unmeasurable since the fixtures it was taken on were
> deleted, and `AUDIT_INDEX.md` item 33 said the re-measure could only be done on
> `chinese-test` because the other corpus had a 0-byte dictionary. **The fixture
> swap at v3.14.384 replaced both.** The shipped pair now carries
> **54 entries / 33 lemmas** (`turkish-test`) and **25 / 13** (`chinese-test`) —
> two dictionaries, two typologies, and homographs in both. Nothing here is
> corrected on that basis: re-measuring is the first step of D28, not of reading
> this. **Still open, still unscheduled, and its own "do not start this next"
> still stands.**
>
> Since writing: D27 (Selection) shipped, which is what raised the question; and
> B-040 taught the schema guard about the four sense fields, so a dictionary using
> them no longer fails conformance.

**Date:** 2026-08-06 · **Against:** v3.14.53 · **Status:** findings only, nothing implemented
**Trigger:** while specifying D27 (Selection), the question arose of whether one form with different selectional frames should carry different definitions.

**Short answer:** yes, often, and the dictionary has no way to express it, because there is no sense layer at all.

---

## 1. Does frame correlate with sense?

Frequently. It's one of the better-established findings at the syntax/semantics interface: argument structure and lexical meaning co-vary systematically.

`believe` is the clean case:

| Frame | Sense | Example |
|---|---|---|
| `NOUN` complement | trust a person | *I believe you.* |
| `CLAUSE` complement | hold as true | *I believe that you left.* |
| `ADP:in` oblique | have faith in the existence or worth of | *I believe in ghosts.* |

Three frames, three genuinely different meanings. `run` behaves the same way. Move quickly / operate a business / encounter (with `into`).

**But the correlation is not reliable enough to hard-wire.** Two common counter-cases:

- **Unexpressed arguments.** `eat` transitive and intransitive is *one* sense; the object is simply not realised.
- **Valency alternations.** The causative alternation. *John broke the vase* / *the vase broke*, is one sense with two argument realisations. Whole verb classes behave this way.

**Design consequence:** the model must *allow* frames to differ by sense without *forcing* it. This is already satisfied by D27's shape, `selection[]` is an array, so one sense can hold several frames. Nothing about the frame schema needs to change; only where it attaches.

---

## 2. What the current design misses

### 2.1 There is no sense layer

Verified by grep: no "sense" concept exists anywhere in the codebase. `gloss` and `meaning` are single strings on the entry. `believe` therefore gets **one** definition, with its three frames sitting beside it and no way to say which belongs to which.

### 2.2 Six inherently sense-level fields are stranded at entry level

| Field | Why it is sense-level |
|---|---|
| `gloss` | The short equivalent differs per sense, *trust* vs *hold true*. |
| `meaning` | The definition **is** the sense. |
| `semantic_domain` | `believe`-trust is Cognition; `believe in` is closer to Belief/Religion. |
| `usage_notes` | Register and dialect restrictions attach to a sense, not a lexeme. |
| `selection[]` | See §1. |
| `pinned_examples[]` | **The sharpest case.** an example sentence illustrates a *sense*. There is currently no way to record which one, so a curated example for sense 2 sits in an undifferentiated list. |

### 2.3 The obvious escape hatch is already occupied

`lookupDict(form)` returns an **array** and `renderDict` loops over it, so multiple entries per form is supported. It would be natural to assume that is where polysemy lives.

It isn't. In `ucak_dictionary.jsonl`, all 14 forms with more than one entry are lemma/word pairs from E27:

```
veya   type=lemma  gloss=or    ·  type=functional.word  gloss=or
baş    type=lemma  gloss=head  ·  type=word             gloss=head
hava   type=lemma  gloss=air   ·  type=word             gloss=air
```

Entry-type distribution across that dictionary: 23 `word`, 15 `lemma`, 10 `bound.morpheme`, 1 `functional.word`. The multi-entry channel is carrying the **lemma layer**. Overloading it with senses would put two orthogonal jobs on one mechanism and make `dict_id` resolution and homograph selection ambiguous. Which entry is "the" entry for a token when the array mixes lemmas and senses?

### 2.4 Neither corpus currently works around it

Zero entries in either dictionary have a `meaning` string containing `1.`, `1)` or `;`. Nobody is cramming multiple senses into one definition **yet.** the dictionaries are small (155 and 49 entries) and early. The gap is latent, not yet painful, which makes this a good moment to decide but a poor moment to rush.

---

## 3. Proposed rework

### 3.1 The field split

Standard, and the same line drawn by LMF, TEI dictionaries, and SIL FLEx:

| Lexeme level (stays on the entry) | Sense level (moves into a sense) |
|---|---|
| `form`, `transliterations`, `allomorphs`, `alternate_forms`, `constituent_forms`, `lemma_id`, `type`, `part_of_speech` | `gloss`, `meaning`, `semantic_domain`, `usage_notes`, `selection[]`, `pinned_examples[]` |
| `comments`, `prov`/`field_prov`, arguably either; suggest keeping at entry level for now | |

**FLEx matters specifically here.** It is the dominant tool in language documentation, its model is Entry → Sense with precisely this split, and annotators arriving from FLEx or Toolbox will expect senses and be surprised by their absence.

### 3.2 `entry.senses[]` with an implicit sense 0

```json
{ "form": "believe", "type": "word", "part_of_speech": "VERB",
  "senses": [
    { "gloss": "hold true", "meaning": "To accept a proposition as true.",
      "selection": [ { "label": "clausal complement", "selects": [ ... ] } ],
      "pinned_examples": [ ... ] },
    { "gloss": "trust", "meaning": "To regard a person as truthful.",
      "selection": [ { "label": "transitive", "selects": [ ... ] } ] }
  ] }
```

**When `senses` is absent, the entry's own top-level fields *are* the single sense.** Consequences:

- **Zero migration.** Every existing entry is already a valid single-sense entry.
- **Zero size cost** for the single-sense entries that will always be the majority.
- **No dual-source trap.** The two representations must never both be populated. One accessor. `entrySenses(entry)` returning a normalised array, and one writer, with a conformance test enforcing exclusivity. This is deliberately the lesson of G28 (parse string vs `morphemes[]`) and E26: a field readable from two places drifts.

`selection[]` moves inside a sense, so the D27 P1/P2 work **relocates rather than being discarded.** frames-within-sense stays an array, which is exactly what preserves the `eat` case from §1.

### 3.3 UI: progressive disclosure

The answer to "intuitive and easy to edit" is that **most entries have one sense and should show no extra chrome at all.**

- **Edit view.** Identical to today for a single-sense entry, plus one "Add sense" button. Adding a second converts the form into numbered sense blocks, each collapsible, the pattern D27 P1 already uses for frames.
- **Read view.** Numbered senses: **1.** gloss, definition, frames, examples; **2.** likewise. This is what every dictionary anyone has used looks like, so it reads as familiar rather than novel.
- **Browse table.** One row per entry, first sense's gloss as the preview, with a small sense-count badge. Not one row per sense, that would break the "one row per headword" reading.

---

## 4. What it touches

Measured by grep against v3.14.53. Call sites for the six sense-level fields: `gloss` 92, `semantic_domain` 23, `pinned_examples` 17, `usage_notes` 16, `selection` 16, `meaning` 15. Three files: `LingCoT.html`, `modules/participants.js`, `scripts/dict_export.py`.

Functions requiring change:

| Site | Change |
|---|---|
| `renderDict` | Numbered sense blocks |
| `renderDictEdit` | Sense blocks + "Add sense" |
| `renderDictAdd` | Single implicit sense; parity with edit |
| `dictBrowseFiltered` / `renderDictBrowse` | Preview from sense 0; filter and sort must span senses |
| `saveDictEntry` / `saveNewDictEntry` | Read sense blocks; field_prov per sense |
| `lookupDict` / `resolveDictEntry` / `buildDictIndex` | Sense-aware indexing |
| `_pushTokenToDict` | Which sense does a pushed token populate? |
| Search (`search_b.js`) | Dict-side gloss/meaning matching must span senses |
| `dict_export.py` | PDF renderer emits per-sense sections |
| `schema_conformance_test.js` | New shape |
| D27 P1/P2 editors and views | Reparented under a sense |

**Open question to settle early:** should `word.dict_id` gain a `sense_id`? For a corpus tool that is how sense-tagged text eventually becomes possible, and retrofitting it later means revisiting G32's resolution logic a second time. It could be deferred, but it should be *decided* now.

**Size: L.** Comparable to the v4 schema restructure, not a session's work.

---

## 5. Recommendation on sequencing

**Do not start this next.**

Four features. D25 P1, D25 P2, D27 P1, D27 P2, have shipped without ever being rendered in a browser. The last comparable gap concealed a blank-window bug for six weeks and a corrupted `en.json` alongside it. A dictionary-wide refactor layered on top of four unverified features would compound that, and every site in §4 is a site where a first-run bug could hide.

Suggested order:

1. Launch the app; annotate a handful of real entries using D27 P1/P2.
2. Return to this document. Real use will settle two things that are currently guesses: how often annotators actually want a second sense, and whether they reach for senses or for separate entries when they do.
3. Spec as **D28** if still wanted.

**Explicitly rejected as an interim step:** making `meaning` an array of numbered definitions. It buys polysemy in the definition only, leaves frames, domains and examples stranded, and would need unpicking later. The entire value of this change is the *linkage* between sense and frame, a half-measure delivers none of it.
