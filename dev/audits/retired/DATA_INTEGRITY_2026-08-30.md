# Data integrity assessment — LingCoT / Corpus Builder v3.14.254
**Updated:** 2026-08-30 · **Version:** v3.14.256  
*Frozen at the version it was taken. Not bumped again.*

> **RETIRED at v3.14.390 — both of the two corpora it measures are gone.** It was
> indexed **LIVE**, with "the fixture half only" open. The fixture half was
> `samples/turkish-test`, **retired rather than migrated** at v3.14.384
> (`dev/design/D58_fixture_set.md` §8), and the live half was
> `~/mnt/turkish_test_corpus`, which became a shipped fixture and has been
> annotated further since. So **both columns of every table below are stale, not
> one**: the corpus now shipped as `samples/turkish-test` holds 108 words / 116
> morphemes / 17 sentences against the 162 / 77 / 12 measured here, and 54
> dictionary entries and 33 lemmas against 52 and 33. Nothing below can be
> checked against anything that exists.
>
> **What was open, and where it went.** The eight findings with no live instance
> were listed in `AUDIT_INDEX.md` item 34; the ones that outlived the data are
> carried as `L-nnn` rows in `UNIFIED_AUDIT.md`, which is the live audit of
> record and computes its own counts.
>
> **Still worth reading, and the reason this is retired rather than deleted:**
> **§5, what the format cannot express and what nothing adjudicates.** Those
> seven items are about the schema, not about a corpus — a stamp records who and
> when and never what changed (§5e), `prov_history` is documented append-only and
> is not (§5b), a translation carries no language (§5c), a morpheme links to one
> entry with no sense (§5d, which is D28). Re-measuring the data would not touch
> any of them, and no other document states them together. **§Method** is also
> the clearest statement of the on-disk vs loaded distinction, which every later
> measurement pass has used.


Scope: the live corpus at `~/mnt/turkish_test_corpus/` and the shipped fixture at
`samples/turkish-test/`. Read-only; nothing in either corpus or in the repository was
modified.

## Method, and what "on-disk" vs "loaded" means below

Two shapes were measured separately because they differ.

* **On-disk** — the JSONL as stored, parsed with `dev/tests/_fixture.js`'s `loadCorpus` /
  `loadCompanion`.
* **Loaded** — the app booted in the VM stub (`dev/tests/_dom.js` `makeCtx` + `loadApp`,
  the pattern in `dev/tests/prov_intern_test.js`), then
  `applyCorpus()` / `applyDict()` / `applyParticipants()`, and `S.docs`, `S.dictionary`,
  `S.lemmas`, `S.provEvents` dumped to JSON. This is the post-migration shape: provenance
  interning, `record_type` declaration and the legacy dictionary migration have all run.

Every count says which shape it comes from. Where a load-then-save would change the bytes,
the serialized output was compared against disk record-by-record.

Sizes:

| | live | samples |
|---|---|---|
| corpus file | 78,282 B / 78,024 chars, 2 records (event table + 1 document) | 50,349 B / 50,241 chars, 1 record (document only) |
| dictionary file | 26,709 B / 26,676 chars, 85 records | 12,932 B / 12,921 chars, 32 records |
| participants | 3 records (1 annotator, 2 sources) | 3 records |
| journal | 1 record | absent |
| loaded tree | 1 doc, 3 sections, 7 paragraphs, 12 sentences, 162 words, 77 morphemes | 1 doc, 2 sections, 5 paragraphs, 13 sentences, 98 words, 20 morphemes |
| loaded lexicon | 52 entries, 33 lemmas, 99 prov events | 22 entries, 10 lemmas, 45 prov events |

Neither corpus file ends with a newline. The live corpus is *half*-interned on disk:
`field_prov` values are already integers (358 of them) but `prov` (134), `prov_history` (75)
and `metadata_prov` (1) are still inline objects. `samples/` is fully pre-intern: 291 inline
stamps, no event table.

---

## 1. Referential integrity

**Result: no dangling references in either corpus.** Every id resolves.

Live corpus, loaded shape, references counted and all resolved:

| reference | count | resolves against |
|---|---|---|
| `dict_id` on morphemes | 76 | `S.dictionary` (52 entries) |
| `dict_id` on words | 16 | `S.dictionary` |
| `lemma_id` on words | 36 | `S.lemmas` (33) |
| `lemma_id` on dict entries | 14 | `S.lemmas` |
| `source_ids` on sections | 1 | participants |
| `comment.source_id` | 1 | participants |
| `prov_event.annotator_id` | 76 of 99 events | participants (`ann_001`) |

samples: 19 morpheme `dict_id`, 12 word `dict_id`, 11 word `lemma_id`, 9 entry `lemma_id`,
10 `translation.source_id`, 41 event `annotator_id` — all resolve. Booting either corpus
produces no unresolved-reference alert (`LingCoT.html:949-971` is the reporter; it fired zero
times).

Both participants files are fully used: `ann_001`, `src_001` and `src_002` are all referenced.
No orphan participant records.

### 1a. Lemma groups with no member entry — live, 19 of 33

Not dangling, but broken as a grouping. A lemma "names a GROUP of dictionary entries"
(`field_spec.js:270`). 19 of the 33 lemma records in the live dictionary are pointed at only by
corpus words; no dictionary entry carries their id, so `S.dictByLemmaId` is empty for them and a
group view shows nothing while the corpus claims membership.

In 11 of the 19 cases an identically-formed entry exists and simply lacks the back-pointer, and
its id was minted 1 ms after the lemma's — the pair was created in one action and only one half
was linked:

* lemma `dict_1787953919714_w33fi` "kuzey" ← word `doc_1787952635085.sec_001.p_001.s_001.w_001`;
  entry `dict_1787953919715_pr0yk` "kuzey" has no `lemma_id`.
* lemma `dict_1787953976957_pf9by` "rüzgar" ← `…s_001.w_002`; entry `dict_1787953976957_k7slx`
  has no `lemma_id`.
* lemma `dict_1787954361013_g0d10` "olmak" ← `…s_001.w_008`.

samples: 1 of 10 lemmas has no member entry.

This is **tolerated by design** — `LingCoT.html:259-260` and `:1543-1544` say a token's
`lemma_id` is a per-occurrence annotation allowed to differ from the entry's, and `linkLemma`
(`LingCoT.html:3304`) only fills an entry's `lemma_id` from the push-to-dict path. The
consequence is not designed: 19 of 33 groups are empty from the lexicon side. Classify as a
**model/UX gap**, not a data error to redo.

---

## 2. Provenance completeness

### 2a. Object-level stamps

Loaded shape, live:

| level | objects | with `prov` | with `prov_history` | with `field_prov` | field stamps |
|---|---|---|---|---|---|
| document | 1 | 1 | 1 | 1 | 1 |
| section | 3 | 3 | 3 | 1 | 1 |
| paragraph | 7 | 4 | 2 | 0 | 0 |
| sentence | 12 | 12 | 12 | 2 | 2 |
| word | 162 | 37 | 37 | 33 | 159 |
| morpheme | 77 | 77 | **0** | 67 | 195 |
| dict entry | 52 | 52 | 52 | 0 | 0 |
| lemma | 33 | 33 | 33 | 0 | 0 |

568 stamps in the live corpus tree in total.

### 2b. Every morpheme has lost its revision history — live 77/77, samples 20/20

**On disk and loaded.** All 77 live morphemes carry `prov` and none carries `prov_history`.
Example, verbatim from `turkish_test_corpus_corpus.jsonl`:

```
{"id":"doc_1787952635085.sec_001.p_001.s_001.w_001.m_001","form":"kuzey",…,
 "prov":{"annotator_id":"ann_001","date":"2026-08-28","time":"16:51:59"},
 "field_prov":{"gloss":1,"part_of_speech":1},"dict_id":"dict_1787953919715_pr0yk"}
```

`ensureMorphemesFromParse` DOES write one (`LingCoT.html:1830-1831`,
`m.prov_history = [m.prov]`). The word-save rebuild does not: the object literal at
`LingCoT.html:9084-9098` sets `prov: gloss ? prov() : (existing?.prov || null)` and names no
`prov_history`. `mergeMorpheme` spreads `existing`, so a morpheme matched to an existing one
keeps its history — but a morpheme whose row did not match an existing object (`existing` is
`undefined`) is built fresh from that literal, with a `prov` and no history. Every morpheme in
both corpora is in that state, so in practice the trail never survives a word save.

The schema block already licenses this (`LingCoT.html:293`: "prov / field_prov (prov_history
optional)"), which is why no guard catches it. Effect: at the level carrying the most annotation
in this corpus (195 of 568 field stamps), only the latest edit is attributable; earlier ones are
unrecoverable.

**CODE defect.** No annotation to redo.

### 2c. `dict_id` is written without a stamp — live 91 of 92, samples 31 of 31

Loaded shape. Live: 76 morpheme `dict_id` (0 stamped) and 16 word `dict_id` (1 stamped).
samples: 19 + 12, none stamped.

`fieldProv(obj, key)` (`LingCoT.html:2553`) returns `null` when there is no field stamp — it does
not fall back to the object's `prov`. So for 91 of 92 links the app can say nothing about who or
what created them.

Two writers, one stamps and one does not:

* `autoLinkToken` (`LingCoT.html:3204-3206`) sets `obj.dict_id` and then
  `obj.field_prov.dict_id = _derivedFieldProv()`. This produced the single stamped case,
  `doc_1787952635085.sec_001.p_001.s_001.w_001` (`field_prov.dict_id: 2`, event 2 =
  `{"annotator_id":null,"annotator":"auto (lexicon)","derived":true}`).
* `ensureMorphemesFromParse` (`LingCoT.html:1822`) does
  `if (fill.dict_id) m.dict_id = fill.dict_id;` and stamps `gloss`, `transliterations` and
  `type` on the next four lines but not `dict_id`.

Examples of unstamped links: `doc_1787952635085.sec_001.p_001.s_001.w_001.m_001`,
`…s_001.w_002.m_001`, `…s_001.w_003` (word level).

**CODE defect**, and it matters more than a missing stamp usually would: an unstamped `dict_id`
is indistinguishable from a human-chosen one, which is the exact distinction
`LingCoT.html:3186-3189` says must be preserved.

### 2d. Annotated values with no per-field stamp — live 80 of 436

Loaded shape, live, counting only fields that are non-empty. 356 of 436 have their own
`field_prov` entry; 80 do not, so `fieldProv` returns null and the only attribution is the
object's `prov`, i.e. whoever last touched the object for any reason.

Worst by field:

| field | unstamped / filled | example ids |
|---|---|---|
| `morpheme.form` | 77 / 77 | `…s_001.w_001.m_001`, `…s_001.w_002.m_001` |
| `word.morphemes` | 37 / 37 | `…s_001.w_001`, `…s_001.w_002` |
| `sentence.text` | 12 / 12 | `…p_001.s_001`, `…p_001.s_002` |
| `sentence.words` | 12 / 12 | same |
| `morpheme.gloss` / `.part_of_speech` / `.type` | 10 each / 77, 77, 71 | `…s_002.w_011.m_001`, `…w_011.m_002` |
| `sentence.translations` | 8 / 10 | `…p_001.s_001`, `…p_001.s_002` |
| `word.morphological_parse` / `.part_of_speech` / `.gloss` / `.lemma_id` | 4 each | `…p_001.s_002.w_011`, `…w_013` |
| `paragraph.translations` / `.comments` | 2 each | `…sec_001.p_001`, `…sec_002.p_001` |
| `section.title` | 2 / 3 | `…sec_001`, `…sec_003` |
| `document.title` / `.language` / `.source_ids` / `.comments` | 1 each | `doc_1787952635085` |

The pattern is that the *container and identity* fields — sentence text, the word list, the
morpheme list, morpheme forms — are never stamped anywhere in either corpus. `paragraph` has
**zero** field stamps in both corpora, so a paragraph translation is attributable only to the
paragraph's last edit.

samples is worse proportionally: 47 of 162 filled fields unstamped, including `sentence.text`
13/13 and `sentence.translations` 11/13.

**CODE** for the container fields (nothing stamps them at all). **DATA** is not implicated —
there is no field where the annotator supplied a value that a stamp then failed to describe
because of the annotator's action.

### 2e. Stamps for values that are not there

* Live: `doc_1787952635085` carries `metadata.field_prov = {"translation_language": 0}` but
  `metadata` has no `translation_language` key. A stamp records that someone set the field at
  event 0 (`ann_001`, 2026-08-29 13:50:58); the value is gone and the format cannot say whether
  it was cleared or lost.
* samples: 3 words carry `field_prov.head` with an empty `head` —
  `doc_1787630594398.sec_001.p_001.s_001.w001_ucp`, `…s_002.w_003`, `…sec_002.p_001.s_001.w_008`.

The app deliberately drops a key when its control is cleared (`LingCoT.html:2168`,
`:9095-9097`) but does not drop the stamp. **CODE defect**, low severity, but it is the only
trace that a value once existed, and it reads as a value that failed to save.

### 2f. The corpus is not PI-free where the design says it should be

`thinProv` removes an annotator display name the participants file can derive (B-129,
`prov_intern_test.js`). Occurrences of the literal `Test Annotator #1` still on disk:

| file | count |
|---|---|
| `samples/turkish-test/turkish-test_corpus.jsonl` | 205 |
| `samples/turkish-test/turkish-test_dictionary.jsonl` | 64 |
| `turkish_test_corpus_corpus.jsonl` | 19 |
| `turkish_test_corpus_dictionary.jsonl` | 22 |
| `turkish_test_corpus.journal.jsonl` | 2 |

The 19/22 in the live files are the residue B-129 measured and are removed by the next save
(verified: a round-trip write contains zero). The 205/64 in `samples/` are pre-migration and will
persist until the fixture is regenerated. The 2 in the journal are **not** removed by any path:
journal records inline their provenance via `expandProv` (`LingCoT.html:182`, `:824`) and
`thinProv` is not applied to them. **DATA** for `samples/`, **CODE** for the journal.

---

## 3. Orphans and unreachable data

### 3a. Dictionary entries nothing points at — live 1, samples 1

* live: `dict_1787962948292_11kzk`, form `hakk`.
* samples: `dict_1787705786501_stixg`, form `(y)I`.

Both are legitimate lexicon rows (a lexicon may contain entries not yet attested), so this is not
a defect. Reported for completeness.

Coverage the other way: 51 of 134 distinct token forms in the live corpus have a dictionary entry
of the same form; 20 of 60 in samples.

### 3b. Lemma records nothing points at — 0 in both

Every lemma is reached from at least one word or entry. See §1a for the 19 that are reached only
from the corpus side.

### 3c. Morphemes whose parent word has no `morphological_parse` — live 3, samples 2

Live:

* `doc_1787952635085.sec_001.p_001.s_001.w_006` "daha" → 1 morpheme "daha" / "more" /
  `dict_1787954212945_r3s9g`
* `doc_1787952635085.sec_002.p_001.s_001_kh3.w_002` "yüz" → 1 morpheme "yüz" / "hundred"
* `doc_1787952635085.sec_002.p_001.s_001_kh3.w_003` "kere" → 1 morpheme "kere" / "instance"

samples: `doc_1787630594398.sec_002.p_001.s_001.w_005` "bre", `…w_006` "Hasan".

Not unreachable — the word editor draws morpheme rows regardless — but `ensureMorphemesFromParse`
regenerates from the parse and returns early when the parse is empty (`LingCoT.html:1809`), so
these morphemes have no source of truth above them. The reverse case (a parse with no morphemes)
does not occur: 0 in both corpora.

### 3d. Empty containers — live 1

`doc_1787952635085.sec_003` has a title, a `prov` and a `prov_history` and zero paragraphs.
0 empty paragraphs, 0 empty sentences. samples has none.

### 3e. Stored and read by nothing: `word_index`

`word_index` is written in exactly one place (`LingCoT.html:8287`, `makeWordObj`) and read in
none. `grep -rn word_index source/` returns four hits: the schema comment (`:252`), the write and
its comment (`:8286-8287`), and the field table (`field_spec.js:182`). The comment claims it is
"used by search"; neither `search.js` nor `search_b.js` mentions it.

Its sibling `sentence_index` was retired properly — stripped on load
(`LingCoT.html:4325-4334`), "array position is ground truth" (`:8301`), with a fallback reader at
`:1434`. `word_index` got neither the strip nor a reader. **CODE**: dead stored field, and
inconsistent (see §4c).

### 3f. Unreferenced provenance events — 0

All 99 live events and all 45 samples events are referenced once the dictionary and lemma
records are counted (they intern into the same in-memory table). No duplicate moments in either
table.

---

## 4. Internal consistency

### 4a. `morphological_parse` vs the morpheme list — 0 disagreements

34 live words and 11 samples words carry a parse. Splitting on `-`, `=` and `+` and comparing
segment-for-segment against `morphemes[].form` gives an exact match in every case, including
`rüzgar-(s)I(n)` → `["rüzgar", "(s)I(n)"]`. The materializer splits on `-` only
(`LingCoT.html:1810`), which is consistent with the data present.

### 4b. Word forms vs sentence text — 0 disagreements

For all 12 live and 13 samples sentences, concatenating `words[].form` and stripping whitespace
reproduces `text` exactly.

Note on what that check cannot see: tokens carry punctuation glued on
(`"İkna`, `yeğdir".`, `ki:` in the journalled sentence), and samples has a standalone `.` token
(`doc_1787630594398.sec_001.p_001.s_001.w002_s67`). The two corpora disagree about whether
punctuation is a token, and nothing records which convention a corpus uses.

### 4c. Ids vs array position — live 6 sentences wrong, samples 0

**This is the strongest evidence the live corpus has been edited after ingest.** Array position
is ground truth; six sentence ids encode a different one.

```
doc_1787952635085.sec_001.p_001.s_003          in doc_1787952635085.sec_001.p_002_u4m at position 0
doc_1787952635085.sec_001.p_001.s_004          in doc_1787952635085.sec_001.p_002_u4m at position 1
doc_1787952635085.sec_001.p_001.s_005          in doc_1787952635085.sec_001.p_003_hru at position 0
doc_1787952635085.sec_001.p_001.s_006          in doc_1787952635085.sec_001.p_003_hru at position 1
doc_1787952635085.sec_001.p_001.s_007          in doc_1787952635085.sec_001.p_003_hru at position 2
doc_1787952635085.sec_002.p_004_v9c.s_001_u19  in doc_1787952635085.sec_002.p_003 at position 0
```

Two distinct failures. The first five: a paragraph split moved sentences into `p_002_u4m` /
`p_003_hru` and renamed neither the parent component nor the position component, so both halves
of the id are wrong. The sixth: a sentence named for `p_004_v9c` — a paragraph that does not
exist anywhere in the corpus — sits in `p_003`.

Nothing in the app parses a parent out of an id (the only id-splitting code is `depLocalId`,
`LingCoT.html:6999-7003`, which takes the last component only), so the app is not broken by this.
Any external consumer, any sort by id, and any human reading the file is.

Related, and documented rather than wrong: two word-id formats coexist. `makeWordObj`
(`:8283`) mints `…s_001.w_001`; the re-tokenization path (`:8968`) mints
`…s_002.w001_xr3` — no underscore after `w`, plus a random suffix. `LingCoT.html:6994-6996`
declares both formats. Live has 2 (`…p_001.s_002.w001_xr3`, `…w002_1mg`), samples 2
(`w001_ucp`, `w002_s67`). Same for paragraphs (`p_002_u4m`, `p_003_hru`, `p_004_m9b`) and
sentences (`s_001_led`, `s_001_kh3`, `s_001_wjm`, `s_002_ut9`).

Those same four words are the only ones in either corpus with **no `word_index`** — the literal
at `LingCoT.html:8968` omits it, and `reindexSentWords` (`:1447`) rebuilds lookup maps only. The
32 other words in the same sentences carry it. **CODE defect**, currently harmless only because
nothing reads the field (§3e).

No duplicate ids anywhere: 0 in the corpus tree, 0 in the dictionary, 0 among lemmas, in either
corpus.

### 4d. A token's own annotation contradicts the dictionary entry it is linked to — live 3

| token | token gloss / POS | linked entry | entry gloss / POS |
|---|---|---|---|
| `doc_1787952635085.sec_002.p_001.s_001_kh3.w_006.m_001` "yüz" | swim / VERB | `dict_1788030181960_6ukia` | hundred / NUM |
| `doc_1787952635085.sec_002.p_001.s_001_kh3.w_015.m_001` "yüz" | peel / VERB | `dict_1788030181960_6ukia` | hundred / NUM |
| `doc_1787952635085.sec_001.p_001.s_002.w_003.m_001` "ki" | COMP / PART | `dict_1787963541808_kimzt` | COMPL / PART |

The `yüz` pair is a genuine homograph collapse. `dict_1788030181960_6ukia` is the **only** entry
with form `yüz` in the dictionary; there is no entry for `yüz` "swim" or `yüz` "peel". Both
morphemes were linked to it because linking is by form. `autoLinkToken` refuses an ambiguous
form (`LingCoT.html:3197-3202`) but this form is not ambiguous — it is under-populated, and no
check compares the token's own gloss against the entry's.

`homograph`, the field that exists for this (`field_spec.js:255`, `LingCoT.html:3123-3150`), is
set on **0 of 52** live entries and 0 of 22 in samples. Live form+type collisions in the
dictionary: 0. So the machinery has never been exercised by this data.

Mixed **DATA** (two entries are missing; the annotations for `yüz` need redoing once they exist)
and **CODE** (a link is written and never re-examined when the token's own gloss and POS
contradict the entry's; nothing surfaces the contradiction).

### 4e. Paragraph and sentence translations disagree — live 1 substantive

`doc_1787952635085.sec_002.p_001` carries a paragraph translation and its sentence carries a
different one:

* paragraph: "I swam in this lake one hundred times. The stones were wet, so I fell and peeled my skin."
* sentence: "I've swum in this lake a hundred times, the rocks wet, I fell, and I swam my skin."

Beyond wording, they contradict each other on the same `yüz` from §4d ("peeled my skin" vs "swam
my skin"). Neither carries a per-field stamp (`paragraph` has 0 field stamps in the whole
corpus), so nothing dates or attributes either and nothing can adjudicate.

Four other paragraphs (`p_002_u4m`, `p_003_hru`, `p_004_m9b`, `sec_002.p_003`) have empty
paragraph translations while their sentences are translated; that is normal, not a conflict.

### 4f. Provenance dates

Live: after repair, the stamps are self-consistent. Reconstructing the true local date from the
epoch-ms instant embedded in each id at the offset the corpus vouches for (−05:00, derived from
85 of 86 id/stamp pairs) matches the stored date in 85 of 86 cases. The single mismatch is
`doc_1787952635085` itself, whose id was minted 2026-08-28 16:30 local while its only
`prov_history` entry is 2026-08-29 13:50:58 — the document's creation stamp was overwritten
rather than appended to (see §5b). Event dates are 2026-08-28 (57) and 2026-08-29 (42); no
malformed or implausible values.

Two repair markers sit beside the live corpus:

```
.prov_date_repair.json       {"when":"2026-08-29T03:50:13","utc_offset_hours":-5.0,"stamps_corrected":293,"bug":"B-105"}
.prov_date_repair.json.void  {"when":"2026-08-28T22:46:08","utc_offset_hours":-7.0,"stamps_corrected":303,"bug":"B-105"}
```

The repair ran twice, once at the wrong offset (−07:00, 303 stamps) and once at the right one
(−05:00, 293 stamps). The 10-stamp difference is the "ten stamps rolled back a day that should
not have moved" the script's own docstring records
(`dev/repair_prov_dates.py:30-35`). The verification above says the current state is correct, so
the second run undid the first.

### 4g. `samples/` still carries the B-105 date bug — 197 of 291 stamps

`samples/turkish-test/` has **no** `.prov_date_repair.json`; the repair was never run on it.

The corpus vouches for offset −05:00 (33 of 33 id/stamp pairs agree). At that offset the split is
exact at 19:00 local = 24:00 − 5 h, which is the B-105 signature:

* 8 objects whose first stamp is between 00:15:07 and 10:29:54 — date correct.
* 25 objects whose first stamp is between 19:54:09 and 23:15:55 — date one day too late.

Examples: `doc_1787630594398` stamped `2026-08-25 23:03:29`, minted 2026-08-24 23:03 local;
`dict_1787630850736_wxjmr` stamped `2026-08-25 23:07:30`, minted 2026-08-24 23:07;
`dict_1787631168821_fix9o` stamped `2026-08-25 23:12:48`, minted 2026-08-24 23:12.

Counting every inline stamp rather than only the ones pairable with an id: **197 of 291 stamps in
`samples/turkish-test/` carry a local time at or after 19:00 and therefore a date one day too
late.**

One direct corroboration inside the data: `doc_1787630594398.sec_001.p_001.s_002.w_003` has
`prov_history` in the order `2026-08-25 23:15:55` then `2026-08-25 10:28:18` — an append-only log
running backwards, which is what a wrong date on the earlier entry looks like. It is the only
non-chronological history in either corpus.

**DATA defect in the shipped fixture.** It is also the fixture every guard in `dev/tests/` reads
(`schema_conformance_test.js` reports "172 object(s) conform … 1 corpus/corpora: turkish-test"),
so the suite is green against provenance dates that are known to be wrong.

---

## 5. What the format cannot express, and what nothing adjudicates

### 5a. The journal holds a sentence the corpus file does not

`turkish_test_corpus.journal.jsonl` is one record: `{"op":"add","t":"corpus","id":
"doc_1787952635085.sec_002.p_003.s_003", …, "parent":"doc_1787952635085.sec_002.p_003",
"index":2}` — a 54-character sentence, "Bu hikayenin dersi budur ki: …", tokenized into 8 words,
none annotated, stamped `ann_001 2026-08-29 20:55:46`.

That sentence is not in `turkish_test_corpus_corpus.jsonl`. Replaying the journal through the
app's own `replayJournal` gives `{"applied":1,"unresolved":0,"skipped":0}` and `sec_002.p_003`
grows from 2 sentences to 3. So the *file* and the *project as the app opens it* are two
different corpora. Every measurement above is of the base file plus the loaded shape without
replay; with replay, live gains 1 sentence and 8 words.

The journal is also **unbound**. Since v3.14.243 a journal must open with a `journal_head` record
carrying the base fingerprints (`LingCoT.html:978-999`). This one opens with the `add`.
`journalBaseMismatch` returns `null` for a headless journal by design — "refusing to replay it
would lose the very session it is holding" (`:1002-1005`) — so this record would be applied to
*any* corpus placed beside it, silently. Verified: `journalBaseMismatch(journalText, …)` returns
`null`.

The base file's mtime (2026-08-30 01:54) is a minute *before* the journal's (01:55), so a
compaction wrote the base and then the journal was appended without the header a post-compaction
append is supposed to carry (`:1023-1025`). I could not determine from the files alone which
branch of `compact()` (`events.js:692-780`) left that state.

**CODE**, and the highest-risk item here: unreplayed annotation living in a file that will attach
itself to whatever base it finds.

### 5b. `prov_history` is documented as append-only and is not

`LingCoT.html:174` — "prov_history : [ int. ], append-only log". Live distribution of history
lengths across the whole project: 82 objects with none, 126 with 1, 10 with 2, 3 with 3, 1 with
5. `doc_1787952635085` has a single entry dated 2026-08-29 13:50:58 while its id says it was
created 2026-08-28 16:30 — the creation entry is gone. `prov` equals the last history entry in
100% of objects in both corpora, so `prov` is recoverable from the log, but the log is not a log.

### 5c. Translations carry no language and, in the live corpus, no attribution

12 translations in the live corpus. All 12 have `text`; **0** have a `source_id`; 2 have a
`date`. The record shape is `{"text":…, "source_id":null, "date":null}` — there is no
`language` key and no per-translation `prov`. Which language a translation is written *in* is
expressible only once, at document level, as `translation_language` — and the live document does
not have that field (only, as §2e notes, a stamp for it). So the live corpus does not record what
language its translations are in, and cannot at any finer grain than the whole document.

samples is better attributed (10 of 13 have `source_id`) but has the same missing
`translation_language`, with `metadata.language` recorded as the free string `"Turkish"` rather
than an ISO code (live uses `"tur"`). Nothing constrains that field.

### 5d. A morpheme can be linked to only one entry, with no sense

`dict_id` is a single string. §4d's `yüz` shows the cost: the annotator supplied "swim" and
"peel" as glosses on distinct occurrences of one form, and the link can name only one entry.
`homograph` exists to number senses and is unused (0 of 52). Nothing in the format lets a token
say "this form, that sense" when the entry for that sense has not been created.

### 5e. A stamp records who and when, never what changed

An event is `{annotator_id | annotator, date, time, derived}`. No previous value, no field-level
diff. Combined with §5b, a field edited twice retains only the second editor's name; the first
value and its author are unrecoverable from the corpus.

### 5f. Nothing adjudicates duplicated content

Two places store the same fact with no precedence rule and no cross-check: paragraph translation
vs the concatenation of its sentences' translations (§4e), and a token's `gloss`/`part_of_speech`
vs the linked dictionary entry's (§4d). In both cases the corpus is internally contradictory and
both records look equally authoritative.

### 5g. An implausible date passes with no complaint

`doc_1787952635085` metadata comment: `{"text":"Here is a test command","source_id":null,
"date":"3050-01-01"}`. Comment dates are typed free-form and unvalidated. 1 of 1 comment dates in
the live corpus is implausible; samples has none.

---

## 6. What a load-then-save would do to these files

Booting the app and serializing without any edit:

| file | on disk (chars) | rewritten (chars) | identical |
|---|---|---|---|
| live corpus | 78,024 | 65,903 (−15.5%) | no |
| live dictionary | 26,676 | 19,483 (−27.0%) | no |
| samples corpus | 50,241 | 31,954 (−36.4%) | no |
| samples dictionary | 12,921 | 7,094 (−45.1%) | no |

Compared record by record (262 corpus objects live, 139 samples), **no object is lost, no object
is added, and no value changes**. The differences are the pending migrations:

* live corpus: `record_type: "document"` added; `metadata_prov` interned from object to id.
* live dictionary: `record_type` added to 52 entries; an empty `comments` array dropped from 33
  lemma records (all empty — `field_spec.js:293` says a non-empty one is kept, and none is
  non-empty here).
* samples dictionary: `record_type` added to 32 rows; `alternate_forms` dropped from 27 rows (all
  empty; `variants` unaffected); `type`/`part_of_speech`/`gloss`/`comments`/`transliterations`
  dropped from the 10 lemma rows. The only non-empty value dropped anywhere is `type: "lemma"` on
  those 10, which is the pre-D35 discriminator replaced by `record_type: "lemma"` — an intended
  migration, not loss.

**No data loss on the round trip in either corpus.** Opening either project and letting autosave
run is safe, and would fix §2f's residue for the live files.

---

## 7. Summary table

| # | finding | corpus | count | layer |
|---|---|---|---|---|
| 5a | journal holds a sentence absent from the base, and is headless so it binds to any base | live | 1 record, 1 sentence, 8 words | CODE |
| 4g | `samples/` never had the B-105 date repair | samples | 197 of 291 stamps one day late | DATA |
| 2b | morphemes have no `prov_history` | both | 77/77, 20/20 | CODE |
| 2c | `dict_id` written without a stamp | both | 91/92, 31/31 | CODE |
| 4c | sentence ids name the wrong parent and the wrong position | live | 6 | DATA (id repair) |
| 4d | token gloss/POS contradicts the linked entry | live | 3 (2 substantive) | DATA + CODE |
| 4e | paragraph and sentence translations contradict each other | live | 1 | DATA |
| 2d | annotated values with no per-field stamp | both | 80/436, 47/162 | CODE |
| 1a | lemma groups with no member entry | both | 19/33, 1/10 | model gap |
| 2f | annotator display name still in stored files | both | 205+64 samples, 19+22+2 live | DATA (samples), CODE (journal) |
| 4c/3e | `word_index` missing on re-tokenized words; read by nothing | both | 2 + 2 | CODE |
| 2e | field stamp with no value | both | 1, 3 | CODE |
| 3c | morphemes under a word with no parse | both | 3, 2 | DATA |
| 3d | section with no paragraphs | live | 1 (`sec_003`) | DATA |
| 5g | implausible comment date `3050-01-01` | live | 1 | DATA |
| 3a | dictionary entry with no referrer | both | 1, 1 | benign |
| 1 | dangling `dict_id` / `lemma_id` / `source_id` / `annotator_id` | both | **0** | — |
| 4a | parse vs morpheme list disagreement | both | **0** | — |
| 4b | word forms vs sentence text disagreement | both | **0** | — |
| 4c | duplicate ids | both | **0** | — |
| 3f | unreferenced provenance events | both | **0** | — |

---

## 8. What could not be verified

1. **Whether the annotation is correct.** Every check here is structural. Whether "kuzey" is
   glossed right, whether `rüzgar-(s)I(n)` is the right segmentation, whether the translations
   are good Turkish→English — nothing in the data can answer that, and no second annotator's work
   exists to compare against. The corpus has one annotator (`ann_001`), so there is no
   inter-annotator agreement to compute.

2. **Whether the six mismatched sentence ids (§4c) are the only edit.** Position mismatches are
   detectable only where the id encodes a position. Suffixed ids (`p_002_u4m`, `s_001_kh3`,
   `w001_xr3`) still encode a position and were checked. But a *reordering* that renumbered
   correctly, or a deletion followed by a renumber, leaves no trace at all. There is no
   monotonically-increasing revision counter and no content hash in the files.

3. **Which branch of `compact()` left the journal headless (§5a).** The files record the end
   state, not the sequence. No application log covering 2026-08-30 01:54 was consulted; `logs/`
   holds development notes, not runtime event logs.

4. **Whether the B-105 double repair (§4f) is fully undone.** The self-check reconstructs the true
   local date only for objects whose id carries an epoch-ms instant AND which have a first stamp:
   86 of 347 records in the live project. The other 261 — every section, paragraph, sentence,
   word and morpheme, whose ids are hierarchical and carry no instant — cannot be checked this
   way at all. Their dates are consistent with the checkable ones, but that is inference, not
   verification.

5. **The `.b105-bak` files as a baseline.** `turkish_test_corpus_*.jsonl.b105-bak` are pre-repair
   snapshots (dictionary 56 records vs 85 now, participants 2 vs 3 — `src_002` and 29 dictionary
   entries were added after). They cannot serve as a reference for the current data because the
   corpus moved on. No id present in a backup is missing from the current file, so nothing was
   deleted between the two.

6. **Anything about a second corpus, a second annotator, or a larger corpus.** Both corpora here
   are small (162 and 98 words) and share one annotator and one source set. Failures that only
   appear at scale — the V8 string ceiling the code guards against (`_JS_STRING_MAX`), journal
   growth, compaction under load — are untested by this data.

7. **The `samples/` fixture against the guards' own claims.** `schema_conformance_test.js`,
   `doc_integrity_test.js`, `id_sort_test.js`, `dict_delete_refs_test.js` and
   `lemma_registry_test.js` were run and all pass. They read `samples/` only; **no guard in
   `dev/tests/` reads the live corpus at all**, so none of the live-corpus findings above is
   covered by the suite.
