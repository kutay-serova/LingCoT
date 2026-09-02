# LINKING AUDIT: how objects point at each other, and why annotators don't use it
**Updated:** 2026-08-25 · **Version:** v3.14.105 · §6 and S2 answered at v3.14.174  

> **RETIRED at v3.14.230.** 10 of its 13 findings shipped. Its coverage numbers
> were measured on a fixture that no longer exists and are wrong by 5×–34×
> (re-measured live: `word.dict_id` 9.9%, `word.lemma_id` 19.8%,
> `morpheme.dict_id` **100%**, 0 dangling). §6's headline — *"there is no UI
> anywhere that links a token to a chosen entry"* — is false: offers carry
> `data-offer-entry-id` and `takeOffer` writes `row.dataset.dictId`. Most
> dangerous of all, **every `type === 'lemma'` predicate in it is dead**: lemma
> records moved to their own registry at v3.14.184, so re-running this audit's
> walker reports 0 lemma entries and 32 dangling `word.lemma_id`, a phantom bug.
>
> **Still worth reading:** §1, on walkers that read structure without executing
> the code that interprets it. That caution was proved twice over during the
> review that retired this file.
>
> Current status: `dev/audits/AUDIT_INDEX.md`. Open residue: `variants` still
> has no consumer.
*Frozen. The version is the build this was written against, not the current one.
The two notes marked ANSWERED below were added later and say what closed them.*

**Date:** 2026-08-25 · **Against:** v3.14.105 · **Status:** findings only, nothing changed.
Deliverable of **B-033**. Supersedes that bug's original `ANNOTATION_FILL_AUDIT.md` scope.
Bugs filed from it: **B-046 · B-047 · B-048 · B-049 · B-050 · B-051**.

**Method.** Every link was counted by executing a walker over all three corpora. 13 documents, 20 sections, 26 paragraphs, 233 sentences, 823 words, 1,821
morphemes, 238 dictionary entries, 7 participants, and every write path was read
in `LingCoT.html` and `events.js` and then re-verified by direct inspection of the
lines it claimed. Two claims died that way and are recorded below, because a
finding that survived only because nobody re-checked it is not a finding.

---

## 0. The headline: nothing is broken, and almost nothing is used

Referential integrity is **clean**. Across all three corpora:

| link | dangling |
|---|---|
| `word.dict_id` → dictionary entry | 0 / 15 |
| `morpheme.dict_id` → dictionary entry | 0 / 52 |
| `word.lemma_id` → a `type:'lemma'` entry | 0 / 32 |
| `dictEntry.lemma_id` → a `type:'lemma'` entry | 0 / 27 |
| `annotator_id` → participant | 0 / 348 |
| `word.head` → a token in the same sentence | 0 / 11 |

The dependency parse is the healthiest structure in the app: 11 heads, 5 roots,
**zero** tokens with a `dep_rel` and no `head`, **zero** with a non-root `head`
and no `dep_rel`. D25's invariant holds exactly.

Then the coverage:

| link | populated |
|---|---|
| `word.dict_id` | **15 / 823 to 1.8%** |
| `word.lemma_id` | **32 / 823 to 3.9%** |
| `morpheme.dict_id` | **52 / 1,821 to 2.9%** |
| `dictEntry.alternate_forms` | **0 / 238 to 0%** |

**That is the finding.** The machinery works and the annotator is not using it.
Every diagnosis below is really an answer to that one number.

---

## 1. `word.head`: a caution about this audit's own method

The first integrity pass reported **100% of heads dangling** (4/4 and 7/7). That
was wrong. `head` stores an **id suffix** (`w_002`) while word ids are dotted
paths (`doc_…​.sec_001.p_001.s_001.w_002`); the app resolves it through
`depLocalId()` / `depResolveHead()`. Re-run with the app's own rule: **0
dangling.**

Recorded because it is the failure mode this project keeps hitting, a check that
reads a structure without executing the code that interprets it produces a
confident, specific, wrong answer. The number was alarming enough to be believed.

---

## 2. Two editors, one field, opposite behaviour on the same miss

This is the most consequential inconsistency in the app.

`word.lemma_id` and `dictEntry.lemma_id` are both set by typing a **citation form
into a text input**. What happens when that form matches nothing differs
completely depending on which panel you are standing in:

| panel | function | on miss |
|---|---|---|
| Word editor | `_resolveOrCreateLemma` (`:984`) | **creates** a new `type:'lemma'` entry, silently |
| Dictionary editor | `saveDictEntry` (`:6654`) | **discards the link**, silently, `newLemmaId` stays `null` |

```js
// word editor — the miss branch IS the create branch
const existing = S.dictionary.find(e => e.type === 'lemma' && normForm(e.form) === normForm(c));
if (existing) return existing.id;
/* ...otherwise build and push a new lemma... */

// dictionary editor — the miss branch is a shrug
const lemmaEntry = S.dictionary.find(e => e.type === 'lemma' && normForm(e.form) === normForm(lemmaFormTyped));
newLemmaId = lemmaEntry?.id || null;
```

Same field, same string-matching key, same typo, one panel mints an entry, the
other throws the annotator's input away without a word. **B-047.**

Neither behaviour is right on its own. Create-on-miss is how B-043 turned a
case-folding defect into duplicate data. Discard-on-miss loses work silently,
which is worse for trust. The correct answer is the same one for both: **a miss
must be visible, and must offer the annotator a choice.**

---

## 3. Saving a word destroys its morphemes' dictionary links

`saveWord` rebuilds `word.morphemes` from the DOM rows and reuses the matching
existing morpheme to carry values the panel does not show. It carries `id`,
`transliterations`, `type`, `part_of_speech`, `prov` and `field_prov`. It does
**not** carry `dict_id`, the key is simply absent from the returned literal
(`:6546-6559`).

So: link a morpheme to the lexicon, then edit anything about that word, a
typo in a gloss, and the link is gone. No warning, no provenance trace, and `ensureMorphemesFromParse`'s enrich branch is fill-only (`if (!m.dict_id …)`, at
`:1129`), so nothing ever puts it back.

This also explains the 2.9% figure. `morpheme.dict_id` is not rarely *created*, `_pushTokenToDict` sets it for every morpheme it touches. It is rarely
**surviving**. **B-046, S2.**

---

## 4. Nothing repairs a link when its target is deleted

`deleteDictEntry` (`:7106`) cleans `S.dictionary`, `dictByForm`, `dictById` and
`dictMorphemes`. It never touches `dictByLemmaId` or `corpusLemmaRefs`, and it
never scans the corpus for tokens pointing at the entry it just removed.

The consequences are quiet and asymmetric:

- `resolveDictEntry` **masks** a dangling `word.dict_id` by falling back to a
  form lookup, so the damage is invisible in the view.
- `renderWordEdit` renders a dangling `word.lemma_id` as an **empty** Lemma
  field, and saving that word then writes `_resolveOrCreateLemma('') === null`,
  which **deletes** the link. The stale reference is destroyed rather than
  repaired, and the annotator was never told either happened.

Today's corpora show 0 dangling references, so this has not yet cost anything, but that is because entries have not been deleted, not because deletion is safe.
**B-048.**

---

## 5. `alternate_forms`: 0% populated, and inert by construction

Confirmed against every entry: **all 238 carry `alternate_forms: []`** and not
one is populated. That is not annotator neglect; it is what the field is worth.
It is written on every save, rendered as chips, editable in two panels and
provenance-tracked, and **no lookup, search or link path ever reads it**
(`lookupDict` keys only on `dictByForm`; `search.js` and `search_b.js` expand by
lemma member forms). Recording an alternate form changes nothing at all.

Two further defects found in the same field:

- The schema comment (`:270`) declares `[ entry.id, ... ]`; the code stores
  **comma-split form strings**. Already **B-044**.
- `renderDictAdd` prefills it from `pre.alternateForms` (`:5517`), but
  `S.dictNewEntry` is built with only `form/gloss/translit/type/pos/constituentForms`
  (`events.js:846`). The prefill is **dead code** and always renders empty.
  **B-050.**

---

## 6. Every link is form-matched. Not one is picked.

There is **no UI anywhere** that links a token to a *chosen* dictionary entry.

- The "Potential Matches" chips carry `data-form`, `data-gloss`, `data-translit`, **never an entry id**. Clicking one edits *input text*; it assigns no link.
  > **ANSWERED v3.14.174.** The panel is gone; its suggestions are offers in the
  > one strip (D42), each carrying `data-offer-entry-id`, and `takeOffer` writes
  > `row.dataset.dictId` — so taking an offer chooses an **entry**. A homograph
  > can be picked deliberately, which is what §6 says nothing could do.
- The `#ew-lemma` datalist is a **string** autocomplete: it fills the box, and
  `saveWord` re-resolves that string through `_resolveOrCreateLemma`. Picking
  "run" from the list and typing a homograph of "run" are indistinguishable by
  the time the value is saved.
  > **Partly answered v3.14.171.** The datalist is gone; the field draws on
  > `AC_POOLS.lemma` through the shared dropdown, which shows each lemma's gloss
  > so two homographs are at least distinguishable on screen. The *resolution*
  > is still by string through `_resolveOrCreateLemma`, so the substance of this
  > paragraph stands until **D35**.
- The only way a token acquires `dict_id` is the `ew-push-dict` checkbox, which
  takes `lookupDict(form).find(e => e.type === 'word')`, **the first match, in
  insertion order**, with no user choice among homographs, so the app has a stable-id link layer that the interface gives nobody a way to
address. Every id in the data was assigned by a form match that happened to be
unambiguous. That is the deep reason B-043 was dangerous: **the surface form is
not a supporting key; it is the only key**, and ids are a downstream artefact.

---

## 7. A latent render-cache defect, of the B-011 family

`S.dictNewEntry` is interpolated into the render cache key (`:2934`), as an
object. Every non-null prefill therefore stringifies to the same
`[object Object]`, so two different "+ Lexicon" prefills are indistinguishable to
the cache. It is masked today because `S.wordId` usually differs alongside it.

`render_cache_test.js` did not catch this: the guard checks that state which
reaches the screen **appears** in the key, and this state does appear. It does
not check that it appears *distinguishably*. **B-049**, and the guard should
learn the stronger rule.

---

## 8. Streamlining: the input process, and why coverage is 2%

The linking flow costs the annotator far more than it looks, and the cost is
mostly hidden. To link one token today:

1. open the word editor
2. type the citation form into `#ew-lemma`, free text, unvalidated
3. tick `ew-push-dict`, which is **never checked by default** in the render and
   is pre-checked only when arriving via "+ Lexicon"
4. save, and only now discover what happened, because every consequential
   branch (created a lemma? filled an entry? matched a homograph?) is silent
5. if new entries were created, complete them in a modal whose save is
   **not** fill-only and will overwrite

Four proposals, in the order I would do them:

**S1, make the miss visible, and make it a choice.** One shared resolver for
both panels, replacing the create/discard split of §2. On a miss: offer the near
matches, offer "create new", and let the annotator decide. This is the piece that
also absorbs L3 spelling variation, which no key can reach (see B-043's entry).
`Intl.Collator(locale, {sensitivity:'base'})` is the right engine for the
candidate pass; it is locale-aware, needs no table, and returns 0 for
`İstanbul`/`istanbul`. It has **no sort-key API**, so it cannot back a `Map`; it
is a re-check over candidates, not a replacement key.

**S2, let chips carry ids.** ✅ **Done, v3.14.112, and generalised at v3.14.174.**
The Potential Matches panel already computes the matching entries; it discarded
their ids and passed text. Carrying the id turned the app's one existing "here
are your options" surface into an actual linking affordance. D42 then made it
the rule rather than one surface's feature: **every** offer carries its entry id
and reaches one accept path, so a new offer provider gets the linking behaviour
without knowing it exists.

> One thing S2 did not anticipate, recorded because it is the other half of the
> same idea: an offer that assigns a link is also a value the annotator did not
> type. `takeOffer` marks the field and `stampFieldProv` stamps it derived, so
> the link and its provenance are written by the same act. **B-061** was that
> half going wrong, twice.

**S3, say what happened.** Every branch in `_pushTokenToDict` and
`_resolveOrCreateLemma` is currently silent. "Linked to existing entry",
"created lemma *X*", "filled 2 empty fields", the completion modal already
exists for created entries, so the shape is there; it just never reports the
non-creating outcomes.

**S4, decide what `alternate_forms` is for, then make it do that.** Either it
becomes matchable (and inherits the homograph problem from §6, which S1 then
has to answer) or it is honestly documentation and should stop looking like a
link. **Do not make it matchable before S1 lands.**

Not proposed: auto-linking everything on load. The corpora show the machinery is
accurate when it runs; the reason to be cautious is that a silent bulk link is
exactly how create-on-miss produced duplicates, and at 823 words the annotator
can afford to be asked.

---

## 9. What was checked and found clean

Recorded so the next audit does not redo it:

- dependency parse, heads, roots, `dep_rel` agreement: **exact**
- `annotator_id` across 348 stamped objects: **all resolve**
- `_pushTokenToDict`'s fill-only-never-clobber invariant: **holds**, verified at
  `:1344-1347`
- `ensureMorphemesFromParse` enrich branch: **fill-only throughout**
- parse/morpheme mismatch: warns and leaves the data alone rather than
  re-segmenting, **correct**, and the log line already exists

## 10. Noted in passing, outside this audit's scope

`korean-test_corpus.jsonl` is **pretty-printed JSON, not JSONL.** one object
across 10,189 lines, while its dictionary and participants files are true JSONL.
The app reads it, so nothing is broken, but any line-oriented tool over
`*_corpus.jsonl` will fail on it. Relevant to the replacement test corpus and to
`corpus_ingest.py`; not filed as a bug because the format contract has never been
stated.
