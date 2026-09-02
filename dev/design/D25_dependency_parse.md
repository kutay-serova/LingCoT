# D25: Syntactic parse, the dependency design
**Updated:** 2026-08-27 · **Version:** v3.14.134  
*Frozen at the version it was moved out of DEV_PLAN. Not bumped again.*

**Moved out of `DEV_PLAN.md` on 2026-08-27** at v3.14.134, when the plan was trimmed to
open work. Nothing was edited: the text below is the design as it was written and
shipped. It is kept because it explains *why the current code is shaped this way*,
which the code alone does not say.

**What it explains:** `word.head` / `word.dep_rel` in `LingCoT.html`, the P1 table editor, the P2 arc diagram (`_depArcData`), and `depRelOf`. Guarded by `dep_root_test.js`, `dep_parse_test.js`, `dep_arc_test.js`.

**Indexed from** DEV_PLAN §5. Lives in `dev/design/`, which SHIPS: this is
reference for anyone reading the code, not developer history.

---

### D25: Syntactic parse: input, storage & render

**Formalism:** dependency only. CoNLL-U-compatible, works cross-linguistically without committing to a phrase-structure theory, flat per-token schema.

**Design decisions (2026-08-06).** P1 is fully specced below; design session recorded in `edit_log.md`.

- **No automated parsing.** The former P2 (spaCy/stanza auto-parse) is dropped. Parses are entered by hand. This avoids a fourth dependency tier and keeps a parser's tagset assumptions out of the corpus.
- **`sentence.syntactic_parse` is fully replaced**, no back-compatibility. See P1 step 1.
- **Dependency and constituency are independent features.** Constituency is a planned extension with its own schema and its own editor (P3), not a relabelling of the old free-text field. D25 P1/P2 concern dependency only; the two coexist on a sentence and neither derives from the other.
- **`enhanced` dropped.** Enhanced UD is a graph, not a tree. A token gets multiple heads, held in CoNLL-U's own `DEPS` column. A boolean can't express it and basic dependencies cover documentation work. If ever wanted; it arrives additively as `word.deps = [[head, rel], …]`; nothing in the P1 schema blocks that.

#### Storage: decided

Per-token fields **on the word object**, not a parallel `sentence.dep_parse[]` array:

```
word.head     — sentence-local token id suffix ("w_001") · null = root · key absent = unassigned
word.dep_rel  — relation string ("nsubj") · key absent = unassigned
              · "root" is DERIVED from head === null, never stored (B-015, v3.14.69)
```

Rationale, in order of weight:

1. **No parallel structure, so no drift.** A second array indexed over the same tokens is the exact failure class G28 identified (parse string vs `morphemes[]`) and E26 had to heal.
**B-015 (2026-08-24), "root" is derived, not stored.** This spec originally said `dep_rel` carries `"root"` on the root token. Nothing ever wrote it, and no corpus had it: 3 of 3 root tokens in `ucak` had `head: null` and no `dep_rel`. Rather than make the data match the doc, the doc was corrected, `head === null` already determines rootness, so storing it again is a second source of truth for one fact, which is precisely the failure class §G28 exists to remove.

Read it through **`depRelOf(word)`**, which returns `"root"` when `head === null` and the stored relation otherwise. `head === null` deliberately outranks any stored value, so a relation left behind by an earlier edit can never contradict it. **A CoNLL-U exporter must go through that helper.** the format requires `DEPREL=root` where `HEAD=0`, and the value exists nowhere in the stored data. `_depReadEditor` normalises a typed `"root"` away on save. Guarded by `dev/tests/dep_root_test.js`, which also scans every corpus on disk for the redundant field.

2. **Re-tokenization is nearly free.** `saveSentence` already carries surviving word objects across by form matching, so `head`/`dep_rel` ride along untouched. Only dangling heads need a sweep (P1 step 5).
3. **Provenance is free.** `word.field_prov` + `stampFieldProv` already exist → per-token provenance with no new plumbing.
4. **Cheapest of the reorder-safe shapes.** Measured on both corpora (198 and 351 words, pretty-printed files):

   | Shape | B/token | korean-test | ucak |
   |---|---|---|---|
   | parallel array, full ids | 227 | +44 KB (+12%) | +78 KB (**+101%**) |
   | parallel array, indices | 55 | +11 KB (+3%) | +19 KB (+24%) |
   | on word, full head id | 110 | +21 KB (+6%) | +38 KB (+49%) |
   | **on word, local suffix** | **69** | **+13 KB (+4%)** | **+24 KB (+31%)** |
   | on word, index | 63 | +12 KB (+3%) | +22 KB (+28%) |

   Indices are 6 B/token cheaper but corrupt silently on reorder, and `saveSentence` preserves words by *form*, not position, so reordering is a live path. The local suffix is unique within a sentence for both id formats in the wild (`w_001` from ingest, `w001_abc` from `saveSentence`).

`0` is a **UI convention only** (root in the head dropdown); it is never stored. Storage uses `null`.

#### D25 P1: Manual table editor ✅ v3.14.48

**1. Retire `syntactic_parse`.** Remove the field and its free-text input entirely from: SCHEMA block · `renderSentence` (`.syn-parse-box`) · `renderSentenceEdit` · `renderSentenceAdd` · `saveSentence` + its `stampFieldProv` entry · `corpus_ingest.py`. Existing values are stripped on load (same pattern as G34's legacy `annotations`). Constituency returns in P3 with a purpose-built schema. The old free-text field is not carried forward under a new name.

**2. Section placement.** Collapsible "Dependency parse" section in `renderSentenceEdit` only. Not `renderSentenceAdd`, since heads can't be assigned before tokens exist. Collapsed when no token has a `head`/`dep_rel`; expanded once any does. Empty `sent.words` renders a "tokenize this sentence first" message instead of a zero-row table.

**3. Table layout.** Five columns: `# | Form | Gloss | Head | Relation`.

- `#`, 1-based position, read-only.
- `Form`, read-only.
- `Gloss`, read-only, inherited from the word. Uses `wordGloss(w)`, so a derived gloss displays its derived form exactly as the IGT does. Display only; never written back.
- `Head`. `<select>`: blank (unassigned) · `0 — root` · every other token as `n — form`, **excluding self** (no self-loops).
- `Relation`, free-text `<input>` on the shared autocomplete (`data-ac-pool="dep_rel"`); free-form so any framework's labels work. Was a `<datalist>` until v3.14.54.
- Punctuation tokens get rows like any other token (CoNLL-U treats them as `punct`).

**4. `resources/dep_relations.json`.** Objects with descriptions, for user-facing explicitness. Shape matches the existing `pos_tags.json` convention (flat array, string entries also accepted):

```json
[{"tag": "nsubj", "name": "nominal subject",
  "description": "The syntactic subject of a clause."}]
```

Loader mirrors `loadPosTags` exactly. `read_file('resources/dep_relations.json')` via pywebview at boot, embedded `DEP_RELATIONS` default as the browser fallback (v3.13.4 pattern). _Resolved v3.14.54:_ the `<datalist>` was retired and the field moved onto the shared autocomplete (`AC_POOLS.dep_rel`), which renders hints properly and opens on empty focus. The relation-name echo is kept; it names the committed value while the dropdown is shut.

**5. Live behaviour while tokenization is edited.** The parse table **freezes.** it does not rebuild as `es-words` is typed into. An inline notice appears instead ("Tokenization changed. The parse will reconcile on save"), shown by an `input` listener on `es-words` comparing against its initial value. Deliberately *not* the `syncMorphemeRows` live-reconcile approach: heads reference other rows, so a mid-edit rebuild would have to re-resolve every head against a half-typed tokenization. Freezing keeps the table honest without pretending to be live.

**6. Save + reconcile.** Read the rows in `saveSentence`; write `head`/`dep_rel` onto each word; stamp via the existing `stampFieldProv(word, …)`. After `sent.words` is rebuilt and before `reindexSentWords`, sweep the sentence and clear any `head` that no longer resolves, reporting a count to the user.

**Defaultable during implementation:** collapsed-header content (nothing / "8 of 12 assigned" / validity badge) · long sentences (horizontal scroll, per `.igt-wrap` precedent) · validation strictness (lean: warn on cycles, multiple roots, unassigned tokens; never block save) · tab order · prefill (lean: blank, no auto-root) · whether P1 ships a plain-text read view or waits for P2.

#### D25 P2: Arc diagram (read-only visualization) ✅ v3.14.50

**Decision (2026-08-06): view only.** The arc diagram renders `word.head` / `word.dep_rel`; it never writes them. The P1 table stays the sole editing surface. This drops the click-to-link state machine, the relation picker, and arc deletion from the prototype, what remains is geometry and rendering.

- Placement: collapsible "Dependency parse" section in `renderSentence` (read view), default collapsed, rendered only when `depHasParse(sent)`.
- Tokens are ordinary HTML spans in a flex row; the SVG sits above as a sibling. Arc endpoints come from `offsetLeft + offsetWidth/2`. No font metrics, and **RTL works for free** because the browser lays out the row under `dir="auto"`.
- Arc stacking: level = 1 + max level of any arc strictly nested inside. O(n²), trivial at corpus scale.
- Root marked with a distinct glyph above its token. Relation label sits at each arc's apex on an opaque rect so it stays legible where arcs cross.
- Tokens clickable → word-edit view, reusing the existing `data-go` pattern. That is the only interaction.
- Horizontal scroll for long sentences, per the `.igt-wrap` precedent; arcs do not wrap across lines.
- _Architectural note:_ this can't be a pure string-returning render function; it must measure after insertion. `_positionDropdown` is the existing precedent for a post-render hook.

**Open:** whether the diagram also appears in `renderSentenceEdit` beneath the table as a live preview. Attractive, but the table is the source of truth there and the diagram would need re-measuring on every change, decide against a working read view first.

#### D25 P3: Constituency parse (independent extension)

Not a variant of the dependency work and not derived from it, a sentence may carry both, either, or neither. Unscoped; needs its own design pass covering storage (bracket string vs. nested node objects), an editor, and a render. The retired `syntactic_parse` free-text field is *not* its starting point.

**Open, later:** cross-sentence dependencies · enhanced dependencies as `word.deps`.

---
