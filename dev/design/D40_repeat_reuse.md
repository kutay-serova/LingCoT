# D40: reuse of repeated content, implementation plan
**Updated:** 2026-09-22 · **Version:** v3.14.411

Implementation plan for D40. The reasoning behind the feature stays in
`dev/design/D40_reuse_earlier_work.md` (frozen, v3.14.274); this file carries
the decisions taken on 2026-09-22 and the build order.

## 1. Evidence

Session of 2026-09-22 (`logs/app_2026-09-22_115937.log`, `…_144237.log`),
`turkish_folk_songs_corpus`:

| where | what happened | time |
|---|---|---|
| p1 s1 | `Hasan`, `dar`, `geçmek` each annotated twice by hand (w_004/w_010, w_006/w_012, w_007/w_013); `Hasan` and `dar` re-edited again | ~28 min, 13 tokens |
| p1 s2 | annotated by hand | ~7 min, 7 tokens |
| p1 s3 | same text as s2; nothing carried over | full cost again |
| p3 s2/s3, p2 s2/p4 s2 | same saved sizes (2,071 / 2,085 chars); likely refrain repeats | not yet annotated |
| dictionary fill offer | 2 morphemes | tokens with no morphemes are never offered (`dictFillProposal` walks `word.morphemes` only) |

Prerequisites named in the 2026-08-30 spec are both closed: D35 ✅ v3.14.282,
B-144 ✅ v3.14.298.

## 2. Decisions (2026-09-22)

| # | question | decision |
|---|---|---|
| 1 | repeated sentence: copy or link | **copy**, each token owns its values, marked with where they came from |
| 2 | offer or auto-apply | **offer**; nothing is written before the annotator has seen the values |
| 3 | sentence identity | **folded text**: case, punctuation and spacing differences do not block the offer |
| 4 | post-save propagation toast | **rejected**: the annotator must see the text before deciding |
| 5 | bulk fill panel for words | **rejected**, same reason |
| 6 | translation pre-fill at input | **accepted**, as chips (2026-09-23): a first build wrote into the field and was easy to miss |
| 7 | transliteration sources | **corpus only**: a word transliteration is offered only from an identical word form, a sentence transliteration only from an identical sentence. No rule-based transliteration |
| 8 | offers on filled fields | **word editor only**: a filled field whose value differs from other occurrences shows a `differs` note (§3 D). Stage C stays fill-only; a conflict there is shown and not writable |

## 3. Stages

| stage | what | size | depends on | state |
|---|---|---|---|---|
| A | runtime sentence-text index | S | — | planned |
| B | translation and transliteration offers in sentence edit/add forms | XS–S | A | built |
| C | sentence copy offer with review panel | M | A | planned |
| D | word chips and `differs` notes in the word editor | S–M | — | planned |

Build order A → B → D → C (changed 2026-09-23: repeated words cost more than
repeated sentences in the 2026-09-22 session). A, B and D are released together.

What each field gets, once all four stages ship:

| field | empty, new or annotated token | filled, value differs from other occurrences |
|---|---|---|
| sentence `translations` | B offer · C copy | C shows the conflict, not writable |
| sentence `transliterations` | B offer · C copy | C shows the conflict, not writable |
| word `gloss`, `morphological_parse`, `part_of_speech`, lemma, `transliterations` | C copy · D chip | C shows the conflict · D `differs` note |
| `head`, `dep_rel` | C copy (head remapped) | C shows the conflict, not writable |

Unchanged and available throughout: gloss and `dep_rel` autocomplete, the
dictionary parse and POS chips, the D61 lemma chips, machine translation.

### A · sentence-text index

- `sentKey(sent)`: `normForm` of each non-punctuation token, joined by a single
  space. Punctuation is decided by the same test the IGT renderer uses to draw a
  token as punctuation. A sentence without words is keyed from its tokenized
  text, so a sentence just added is findable before anyone opens it.
- `sentTextIndex()`: `key → [sent_id]`. **Built as a lazy cache on `_dataGen`
  and `_foldGen`** (changed at build time from "maintained by every save path":
  one writer instead of five, and the per-sentence key is memoised against its
  text, so a rebuild after a word save is one Map insert per sentence).
  `sameTextSentences(sentOrText)` is the reader.
- Runtime only. Nothing is written to any file.
- Lookups are by id, never by text-to-object map: B-057 lost data because a Map
  keyed by sentence text kept only the first of two identical sentences.
- The key changes with the fold context, so `refreshFoldContext` bumps
  `_foldGen` and the index re-keys.
- `sentKey` folds each run of letters, digits and combining marks with
  `normForm` and drops everything else, rather than reusing the IGT
  punctuation test on tokens: it has to work on a bare text before tokenizing.

### B · translation and transliteration offers

- Sentence edit and add forms: an offer strip (`offerStripHtml`) under the
  translation and transliteration editors. One chip per value in use on
  sentences with the same key, commonest first, a tie to the first in corpus
  order; meta *same text, P1 S2*, with a count when more than one sentence
  carries it. Long translations are cut at 60 characters on the chip.
- Translation chips while the form holds no translation; transliteration chips
  for labels the form does not hold. The strip reads the form, so it updates
  when a row is taken or removed, and on the add form as the text is typed
  (250 ms).
- A click fills an empty row or adds one, marked with its source (*From P1 S2*
  under the row). Nothing is stored before Save.
- Stamping on Save: unchanged text → copy moment (§4); edited text → the save's
  own moment (human); removed → nothing written.
- Each matching sentence contributes its first translation.
- Comments are not offered; they are about one occurrence.

### C · sentence copy offer

**Where.** A banner on the sentence view, above the interlinear gloss, shown
only when a sentence with the same key would fill at least one empty field here:
`Same text as P1 S2 · 7 words annotated · Review copy`. Not sticky: a
dismissal is not remembered (same rule as the D60 offer).

**Review panel.** Source and target text at the top, then a sentence block and
one row per target word, with a column per field and a checkbox per row. The
Copy button carries the count of what it will write and writes nothing that is
not on screen. Sketch for p1 s3 of `turkish_folk_songs_corpus` (POS and lemma
values illustrative):

```
Copy annotation from P1 S2
Source   Soğuktur suları da, Hasan, bir tas içilmez.
Target   Soğuktur suları da, Hasan, bir tas içilmez.

Sentence
 [x] translation      'It's waters are cold, O Hasan, ...'      already present
 [x] transliteration  —                                          nothing to copy

Words                parse       gloss               POS    lemma   translit
 [x] Soğuktur        soğuk-DIr   cold-DECL           ADJ    soğuk   so'ɰuktur
 [x] suları          su-lAr-sI   water-PL-POSS       N      su      sula'ɾɯ
 ...
 [x] içilmez         iç-Il-mAz   drink-PASS-NEG.AOR  VERB   içmek   itʃil'mez
     , , .           punctuation, skipped

 dependencies: 6 heads, remapped to this sentence

                                  [Cancel]   [Copy 7 words, 36 fields]
```

| cell state | shown as | written on Copy |
|---|---|---|
| target field empty, source has a value | the value | yes, if the row is ticked |
| target field has the same value | greyed, `already present` | no |
| target field has a different value | both values, marked as a conflict | no; the word editor's `differs` note (§3 D) is where it is changed |
| source has no value | `—` | no |
| target token with no aligned source token | row reads `no match`, no checkbox | no |
| dictionary or lemma link whose record no longer exists | omitted | no |

**Several sources.** Matching sentences annotated differently appear as one tab
per distinct annotation, each with the number of sentences sharing it. The tab
with the most filled fields opens first. Sentences annotated identically share
a tab.

**Alignment.** `alignTokens(sourceWords, targetForms)`: exact pass, then the
folded pass. Punctuation tokens are skipped; they carry no annotation.

**What is copied, per aligned word** (fill-only, field by field):

| field | rule |
|---|---|
| `gloss`, `part_of_speech`, `morphological_parse`, `transliterations` | copied when empty on the target |
| `morphemes` | copied as a set only when the target has none; new ids minted with the existing `${word.id}.m_NNN` pattern; each morpheme keeps its `dict_id` |
| `dict_id`, `lemma_id` | copied only if the entry or lemma still exists (`findDictEntry`, lemma lookup); dangling ids are dropped from the plan |
| `head`, `dep_rel` | head remapped through the alignment: source head suffix → aligned target word → its sentence-local suffix. If the head's token is unaligned, neither is copied |
| word comments | not copied |

Sentence level: `translations` and `transliterations` when empty on the target.
Sentence comments are not copied.

**Bulk from the source.** Opened on an annotated sentence, the banner reads
`3 other sentences have this text`. The panel lists each target as its own
block, with its own text, its own table as above and one checkbox per target.
Same rules as above; nothing written that is not listed.

**Log line.** `repeat copy accepted  <n> word(s), <f> field(s)`, counts only.

**Writing.** One writer, `acceptSentenceCopy(plan)`, through `mutate('corpus',
words)` so the journal and session tracker are correct by construction, then
`_deriveWordFields` and the form re-index per touched word, as
`acceptFillGroups` does now.

**Undo.** D56 is open. Until it ships, the panel keeps an in-memory snapshot of
the touched words and offers `Undo copy` for the rest of the session. It is not
persisted; after a restart the copy is reverted by hand like any other edit.

### D · word chips

- In the word editor, a strip `Seen in this corpus`, built from
  `formRefs('word', form)` minus this token. Identity is `normForm`; nothing is
  proposed for a form that occurs nowhere else.
- An analysis is the tuple (parse, gloss, POS, lemma, transliterations). One
  chip per distinct analysis, with count and first location; hover lists every
  location. With more than one analysis no chip is preselected; this is the
  homograph case (`yüzdüm` → swim / peel).
- A click fills the editor's fields. Nothing is stored until Save. Fields saved
  unchanged are stamped with the copy moment naming a source word; fields edited
  first are the annotator's.
- Empty fields: a chip fills them. Transliterations are matched per label, so a
  token with IPA and no Yale is offered the Yale text only.
- Filled fields, decision 8: where the token's value differs from the value in
  one or more other occurrences, the field shows a `differs` note, e.g.
  `3 other suları: water-PL-3.POSS`. Clicking a value replaces the field's
  content in the editor; nothing is stored until Save. The wording is neutral
  (`differs`, not `inconsistent`), because a homograph differs legitimately.
- The strip is hidden when every field agrees with every other occurrence, or
  when the form occurs nowhere else.
- Reuses the D61 lemma-strip layout and the `lemmaSeenAs` counting.

## 4. Provenance

- New helper `_copyFieldProv(fromId)`:
  `{ annotator_id: null, annotator: 'copy (corpus)', date, time, derived: true, from: <source id> }`.
  `from` is a sentence id for C, a word id for D, and the source sentence id
  for B.
- `_provKeyOf` adds `from` to the identity key. Without it, two copies made in
  the same second from different sources would intern to one moment.
- `provTipAttr` shows `copied from P1 S2`, resolving the id through `sentById` /
  `wordById` and walking the tree for the position. An id no longer in the
  corpus reads `copied from <id> (no longer in corpus)`.
- `hasAnnotation(…, human = true)` already treats derived fields as not human,
  so Save-advance (B-065) behaves as for a lexicon fill. `_fieldFilled` does
  not look at provenance, so the gap counter counts copied values as filled.

## 5. Compatibility with existing corpus files

| change | stored | existing files, new build | new files, v3.14.410 and earlier | scripts (`corpus_ingest.py`, `prov.py`, `dict_export.py`) |
|---|---|---|---|---|
| sentence-text index | no, runtime | unaffected | unaffected | unaffected |
| copied values | existing fields only | no migration, nothing rewritten on load | load and save normally | unaffected |
| morpheme ids | existing id pattern | — | ids are opaque already | unaffected |
| `from` on derived moments | optional key in `prov_events` rows | moments without `from` intern exactly as now | key kept on load (`internProv` stores the whole object); ignored by the old `_provKeyOf`, so two copy moments made in the same second from different sources merge at an old-build save and keep one `from`. Values and `derived: true` survive | never read |
| journal records | inline moments, as now | replay unchanged | a journal written by the new build replays in the old one with the same caveat | — |
| dictionary file | unchanged; copies only link to existing entries | — | — | — |

No new record types, no new object fields, no required keys, no id changes, no
load-time migration. `_schema.js` does not check moment keys, so
`schema_conformance_test` needs no change.

Not chosen: encoding the source in the `annotator` name (`copy (s_002)`). Fully
compatible with old builds, but it is name-sniffing, which B-137 removed.

## 6. Guards

| guard | asserts |
|---|---|
| `sent_key_test.js` | folding (case, punctuation, spacing, Turkish i/ı under `lang=tr`); index maintained across add, edit, re-parse, delete; two identical sentences both indexed (B-057) |
| `repeat_copy_test.js` | fill-only; conflicts never written; alignment with an extra or missing token; head remap and unaligned head; dangling `dict_id` dropped; every written field carries `from`; running the same copy twice writes nothing the second time |
| `sentence_prefill_test.js` | translations and transliterations (per label): unchanged → copy moment, edited → human, cleared → nothing; nothing offered without an identical sentence |
| `word_chip_test.js` | grouping by analysis including transliterations; per-label transliteration fill; no preselection with more than one analysis; `differs` note on a filled field and none when all occurrences agree; nothing stored before Save |
| `prov_intern_test.js` (extended) | `from` part of the key; a file with no `from` round-trips byte-identical |

## 7. Logging

Per the logging policy: counts only, never annotation content.
`repeat copy accepted  <n> word(s), <f> field(s)` · `sentence prefill kept` /
`edited` / `cleared` · `word chip taken` · `word differs taken`. These give before/after timing against
the §1 figures.
