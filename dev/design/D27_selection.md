# D27: Selection (argument structure on a dictionary entry)
**Updated:** 2026-08-27 · **Version:** v3.14.134  
*Frozen at the version it was moved out of DEV_PLAN. Not bumped again.*

**Moved out of `DEV_PLAN.md` on 2026-08-27** at v3.14.134, when the plan was trimmed to
open work. Nothing was edited: the text below is the design as it was written and
shipped. It is kept because it explains *why the current code is shaped this way*,
which the code alone does not say.

**What it explains:** `entry.selects[]`, `renderSelectionEditor` / `readSelectionEditor`, `selection_relations.json` and `selection_templates.json`. Guarded by `selection_test.js`.

**Indexed from** DEV_PLAN §5. Lives in `dev/design/`, which SHIPS: this is
reference for anyone reading the code, not developer history.

---

### D27: Selection

Records **what an entry combines with**. Not verb-specific: adjectives select nouns, adverbs select verb phrases or clauses, nouns take clausal complements (*rumour that he lost the money*), adpositions select nominals. Enables learner-facing dictionary display, search and filter by frame, and eventual corpus-grounded verification.

**Design session 2026-08-06.** spec settled below; reasoning recorded in `edit_log.md`.

#### Why "selection", not "subcategorization frames"

The original spec was verb-shaped and broke on the non-verb cases:

- **`position` (subject/object) was dropped.** It's verb-argument vocabulary. Meaningless for the CP in *rumour that…* or the N that `old` modifies. Its useful content folded into `relation`, where `subject` is now a *value* rather than an axis.
- **No word order is recorded at all.** Linear position is a property of the utterance, not the lexical entry, and encoding it would be wrong for free-order languages (Turkish, Warlpiri, Latin, Japanese scrambling). *Consequence:* the classic `DP __ CP` frame notation is itself a word-order statement, so a shorthand-notation input was rejected, see "Input model" below.
- **"Arguments of a head" → "what this word combines with."** For `believe` the entry is the head; for `old` the noun is the head and the dependency arc points `old → dog`. Only the combinatorial framing covers both, and it stays theory-light.
- **`semantic_role` dropped for P1.** Most theory-contentious and most laborious field. Purely additive later, absent means unannotated, no migration.

#### Schema: `entry.selection[]`

Backward-compatible: absent means no frames. Applies to any entry `type`.

```json
{
  "label": "",
  "notes": "",
  "selects": [
    {"category": "NOUN",   "relation": "subject",    "status": "obligatory"},
    {"category": "CLAUSE", "relation": "complement", "status": "obligatory"}
  ]
}
```

**Frames nest, and the nesting is load-bearing.** Each frame is one *alternative*. `give` = subject + direct object + indirect object is **one** frame with three selects; `eat` transitive-or-intransitive is **two** frames. A flat list cannot distinguish "three arguments together" from "three competing analyses", and for verbs that distinction is most of the point.

| Field | Vocabulary | Notes |
|---|---|---|
| `category` | `POS_CHOICES` + `CLAUSE` + harvested | Open string. Build a separate pool at the point of use rather than mutating the shared array, see note below. |
| `relation` | `resources/selection_relations.json` | Open string. subject · direct object · indirect object · argument · complement · **modification** · adjunct. `modification` names the relation rather than either participant, avoiding the direction trap that `modifier` (the selected N is not the modifier, the entry is) and `modified` both fall into. |
| `status` | closed enum | `obligatory` · `optional` · `""` (unannotated). Empty rather than an `unlabeled` sentinel, matching D25 P1. |
| `label` | free text, optional | Derived when blank, see below. |

**`label` is optional and auto-derived.** Blank renders a summary from the selects list ("noun subject + clause complement"), the same relationship `wordGloss()` has to morphemes: explicit value wins, derivation fills the gap. Requiring it would produce naming drift (`transitive` / `trans` / `TR`) that makes it useless for filtering anyway; omitting it entirely would leave the dict view and PDF export with nothing readable to print.

**`attestations[]` is deferred** to a later phase along with corpus seeding.

#### D27 P3: functional relations + resource i18n ✅ v3.14.58

Raised from a design question: a determiner↔noun relationship did not fit the list. The original nine relations were **all contentful.** argument roles or property contributions, so a determiner had to be filed as `modification`, which is wrong: `the` adds no property to `dog`, it fixes reference.

**Added:** `determination` · `quantification` · `case marking` · `linking`. `modification`, `complement` and `oblique` docstrings rewritten to draw the new boundaries. Templates 16 → 19: DET repointed off `modification`; NUM, ADP (`case marking`, alongside its existing `nominal complement`) and LINK added.

**No migration needed.** a scan of every `*dict*.jsonl` found **zero stored selection frames**. That window closes the moment anyone annotates one.

**Resource i18n mechanism** (`tRes` / `resSlug` / `selRelDesc` / `selTplLabel` / `posDesc`): locale key → the JSON's own description → `''`, so bundled vocabulary translates while corpus-specific vocabulary keeps its text. **Only descriptions are localized.** relation tags, PoS tags and template labels are written into `dict.jsonl` and must stay language-stable, or a corpus forks by whatever UI language it was annotated in. The embedded `SELECTION_RELATIONS` fallback was trimmed to tags only; it had already drifted from the JSON in three places, and localizing would have made a third copy.

**Decided 2026-08-25 to COORD selects two PHRASEs.** A coordinator links two things of the *same* category, which one `select` row cannot express. Of the three options. Two selects in one frame, a `PHRASE` category, or leave it hand-written, the decision is **both**: one frame carrying **two `PHRASE` selects**, each `relation: linking`, both obligatory. `PHRASE` was already in `POS_CHOICES`, so no vocabulary was added.

Two selects in one frame is exactly what a frame means (one alternative, several things selected), so the "reads oddly" objection was about the editor's presentation rather than the schema. If it reads badly, that is a D31 ordering/labelling matter, not a reason to bend the data model. Choosing `PHRASE` over `NOUN` keeps the template honest about coordination being category-neutral: *and* joins two nouns, two verbs or two clauses, and seeding `NOUN` would have quietly taught annotators otherwise.

**`PART` stays template-less.** particles are too heterogeneous cross-linguistically to seed a default, and that remains deliberate rather than open.

#### D27 P4: remaining resource strings ✅ v3.14.72

P3 localized the selection files plus `pos_tags` (50 keys; en.json 546 → 597). Remaining:

| file | strings |
|---|---|
| `dep_relations.json` | 74 (name + description) |
| `leipzig_glosses.json` | 112 meanings |
| `type_choices.json` | 10 |
| **total** | **197** |

Mechanical, generate the en.json entries with a script rather than by hand, exactly as P3 did. en.json would reach ~794 keys. Note the *abbreviations* themselves (`ABL`, `ACC`) are stored/displayed tokens and stay untranslated; only `meaning` gets a key. `dev/tests/locale_key_test.js` should gain each file to its bundled-coverage check as it lands.

**Shipped.** 196 keys (dep_relations 74, leipzig_glosses 112, type_choices 10); en.json 604 → 800. Resolvers `depRelNameOf` / `depRelDescOf` / `leipzigMeaning` / `typeDesc`, all consumers wired, abbreviations and tags left untranslated as planned.

One thing the plan did not anticipate: **`type_choices` descriptions had never been displayed anywhere.** `loadTypeChoices` discarded them, exactly as `loadPosTags` discarded the PoS descriptions before D27 P1. They are now kept in `TYPE_DESCRIPTIONS` and shown as tooltips on the type chips, so the strings are worth translating.

`locale_key_test.js` gained the three files (246 bundled entries, all keyed and slug-unique) **and eleven resolution-ORDER assertions.** the earlier checks proved keys existed but never that the code read them, nor that an unkeyed tag falls back to its JSON text rather than printing the raw key.
