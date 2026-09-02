# D34: Session tracker & missing-annotation panel
**Updated:** 2026-08-31 · **Version:** v3.14.318

Status: **A–E ✅**, A–D v3.14.306–308, E v3.14.318–319. All five stages built. Raised 2026-08-25;
unblocked when **D32 ✅ v3.14.303** settled the transliteration model.

| Stage | What | Depends on |
|---|---|---|
| A | `annotationGaps()` — the counter ✅ **v3.14.306** | — |
| B | the applicability rules: derived, inapplicable, missing ✅ **v3.14.307** | A |
| C | the panel — counts, and click-to-navigate through D30 ✅ **v3.14.308** | A, B |
| D | "what changed this session", from the journal's own ids ✅ **v3.14.308** | — |
| E | the tracked set is the annotator's, not the table's ✅ **v3.14.318–319** | B, evidence |

---

## What the measurement changed

The four design questions were asked in the abstract in 2026-08. Answered here
against the two corpora being annotated now.

| | turkish-test | chinese-test |
|---|---|---|
| words / navigable / punctuation | 153 / 130 / 23 | 212 / 180 / 32 |
| morphemes | 130 | 182 |
| word without `morphological_parse` | **130** | **171** |
| word without `transliterations` | **130** | 0 |
| word without `part_of_speech` | 130 | 171 |
| morpheme without `part_of_speech` | 130 | 171 |
| morpheme without `type` | 130 | 168 |
| sentence without a translation | 0 | 0 |

**A counter built from the `core` tier would open by reporting 301 missing
morphological parses and 130 missing transliterations, and every one of those
numbers would be wrong.** That is the failure the original spec predicted —
"a counter you learn to ignore is worse than no counter" — arriving on day one.

## Stage B · three reasons a field is empty, and only one is "missing" ✅ v3.14.307

This is the spec's central claim, and it replaces the original's call for a
manual *not applicable* marker.

**1 · Derived when applicable.** `morphological_parse` is absent on 301 words
because `joinParse` returns `null` for a word with one morpheme, and most words
in both corpora are monomorphemic. Nothing is missing. **The counter asks the
derivation, not the field** — a field with a `join*` behind it is missing only
when the join would produce something and the field is empty.

*Amended by stage A's measurement (v3.14.306):* this is not one case.
`paragraph.translations` is empty in 6 of 6 paragraphs and is derivable by the
ingester's own documented rule — join the sentence translations with a space —
and every sentence in both corpora is translated. Two derived fields, two
`join*`s, one rule.

**2 · Inapplicable to the project.** Turkish is written in the Latin script and
does not want a transliteration at all; Mandarin does, and has 180. The app
already resolves a script — `setFoldContext(canon, sample)` returns one and
`refreshFoldContext` logs it. **A field may declare an applicability test**, and
transliteration's is "the object language is not written in the metalanguage's
script". One rule, in the table, not a per-corpus setting to forget.

**3 · Genuinely missing.** What is left: part of speech at both levels, and
morpheme `type`. Roughly 600 items across the two corpora, which is the number
the panel exists to show.

**Punctuation is not a fourth reason — it is `_navIsToken`.** D30 skips
punctuation because 116 of 563 tokens carried no annotation and never would, and
B-151 made that the app's one punctuation test. **The counter counts what
traversal lands on**, which excludes 55 tokens here and needs no new concept.

**This closes UNIFIED conflict ⑧**, which said D34 cannot be built as specified
because `transliterations` is `aux` — *"counting it contradicts the table; not
counting it contradicts D34's own spec"*. Both horns assumed the tier decides
what the counter reports. It does not: the tier is global and the question is
per-project. The field stays `aux`, no table edit, no migration.

### What stage B built, and the two things it changed

**Two rules, declared in the field table by name** and resolved by `_GAP_RULES` in
the app — the same arrangement as `tags:`, and for the same reason: the module is
required by Node and the predicates read app state.

| declared | scope | reads | on |
|---|---|---|---|
| `vacuousWhen: 'monomorphemic'` | per record | `joinParse(rec.morphemes) === null` | `word.morphological_parse` |
| `appliesWhen: 'scriptDiffers'` | per project, asked once | `detectScript` of the object text vs of the translations | `word.transliterations` |

**The flag needed was `counted: true`, not `counted: false`.** Stage C proposed an
opt-*out* for fields no person fills; nothing needed one. What was needed is the
opposite — an opt-**in** against the tier — and it is UNIFIED conflict ⑧ in one
word. `aux` is the right *global* answer for transliteration and the wrong one for
a Mandarin project; `counted: true` plus `appliesWhen` lets the counter say so
with no tier move and no migration, which is exactly what closing ⑧ required.

**The rule is named for the record, not for the join — and that is what stopped
`gloss` being excused.** `joinGloss` also returns `null`, for a word whose
morphemes carry no glosses, and that is not vacuity: it means the annotation
upstream is missing too, and an unglossed word is precisely what the panel should
report. Two joins, the same `null`, opposite meanings. Had the rule been
`derivedBy: 'joinGloss'` the counter would have quietly stopped reporting
unglossed words — the failure mode being fixed, reintroduced by the fix.

**Unknown counts as applies.** Only two scripts that both resolve *and* are equal
switch a row off. A corpus with nothing translated yet has no metalanguage sample,
and a field that switches itself off on ignorance is worse than one that
over-reports. Guarded in both directions, because `obj !== meta` — the obvious
spelling — gets exactly this case wrong, silently, when both are `null`.

**Only the word level carries the transliteration pair.** Sentence, paragraph and
morpheme transliterations are empty in both corpora and nothing has measured
whether a project wants them there; morpheme transliteration only became fillable
at v3.14.303. Turning on three unmeasured levels at once is the expansion this
project keeps having to undo.

### Stage E arrived from the other direction — v3.14.318

The spec reserved a manual *not applicable* marker and said build it only if a
residue survived a real pass. **The residue came from the opposite side**: not
"stop nagging me about this", but "count this too". Asked for by the annotator,
2026-08-31, with three decisions, and the marker turns out to be a **toggle**
rather than a field to fill.

**1 · The script test stops deciding.** `scriptDiffers` asserted that a
Latin-script language does not want a transliteration. It does that for a Turkish
practical orthography with a phonemic line, which is ordinary fieldwork — **the
same error as the six typology constants D45 deleted**, the app asserting a fact
about the language. It becomes the **default**, chosen once, and the annotator
overrides it.

**2 · `source_ids` is `aux` at every level.** It was `core` on a section and `aux`
on a document, so one question was counted at one level and not the other.
Measured: the panel nagged about sources on 6 sections while **both live
documents already recorded one**. One concept, one tier.

**3 · The dependency parse is a row with no field.** It is stored on the words as
`head` and `dep_rel` and asked about at the sentence — counting the word fields
gives *"130 words need a head"*, which is not how anyone asks. `sentence.deps`
now declares `filledWhen: 'hasDepParse'`, and the predicate is **read, not
rewritten**: `depHasParse` already answers this for the editor's own fold, and it
is subtle — a root stores `head === null`, so `'head' in w` is the test and a
truthiness check misses every root. Both corpora now report **22 sentences need a
dependency parse**, which is gate 1's blocker made visible.

**4 · Bibliographic metadata is not trackable.** Author, publisher, date and the
rest are facts about the text as a publication, not annotation anybody finishes,
and *"1 document needs a publisher"* beside *"171 words need a lemma"* buries the
second. Derived from `LEVEL_EXTRA_LABEL`, which already declares that grouping —
not from a list of five names. `word.head` and `word.dep_rel` are `extra` too and
stay trackable, which is why the rule is about the grouping and not the tier.

**The surface, decided: the panel already has both halves.** Not a settings
screen and not a bank of switches — a switch bank makes the resting panel two
live rows and eleven toggles, which is the ledger the queue was chosen over. The
**queue is what is tracked** and the **fold is what is not**, and the fold has
been required since v3.14.305 to name every excluded field and its reason. So
turning a row off is an `×` on it, appearing on hover; turning one on is a
**Track** button in the fold, beside the reason it is not counted. **The resting
view does not change at all**, and *"you turned this off"* becomes a fourth
reason alongside *done*, *nothing to hold* and *off by default*.

### The toggle, built v3.14.319

**`resolveTracked(level, overrides)`** in `field_spec.js` — pure, taking the
overrides as an argument rather than reading app state, so the rule is testable
without a document and lives beside the table it derives from. The app supplies
`doc().metadata.tracked`; `trackedKeys()` is the one accessor and both the
counter and the panel go through it, so the queue and the fold cannot disagree
about what is on.

**`toggleTracked` cancels rather than accumulates.** Turning a default-on field
off and on again leaves `{}`, not `{on:[x], off:[x]}` — an override that merely
restates the default is a claim about the table that goes wrong the day the table
changes. The first version of the guard asserted only the `off` key and let
exactly that through; it now asserts the whole object.

**An override admits only trackable keys.** A file naming `field_prov` or `text`
— hand-edited, or written by a later version that declared more — is ignored
rather than honoured. The tracker must not be a way to count what the app wrote.

**The setting is declared in the table** as `document.tracked`, tier `derived`.
It is a key on disk, and an undeclared key is what `schema_conformance_test`
refuses: the first save after this shipped would have written one.

**The surface cost nothing, as designed.** The `×` is a *sibling* of the row —
a `<button>` inside a `<button>` is invalid markup and the inner click never
arrives — hidden until hover or keyboard focus. The fold's **Track** buttons stay
visible, because the fold is the list you open in order to change what is
counted. Turning a field on moves it out of the fold and into the queue: one set,
drawn twice, never two lists to keep in step.

**Still to build: nothing.** The stored-override rule was the last of it: **Save the
annotator's overrides, not the resolved list.** A project that stores
`[word.pos, word.gloss, …]` silently fails to track a `core` field added to the
table next year — the hand-written-list failure, one more time. Store
`{on: [...], off: [...]}` and the default keeps deriving from the table forever.

**Stage E's original form, kept for the record.** A proper noun an annotator will never
gloss is a real case for a stored marker, and it is also speculative: build A–D,
run the panel over a real pass, and add the marker if the counts still nag. A
marker added first is a field to fill before the panel is trusted.

## Stage A · the counter ✅ v3.14.306

`annotationGaps(opts)` → `{ [level]: { [key]: { missing, total, ids } } }` for the
open document. Ids are opt-in (`opts.ids: ['word.gloss', …]`) and the memo keys on
the request as well as on `_dataGen`, so asking for a row's ids cannot be answered
from the id-less cache. Guarded by `annotation_gaps_test.js`, 44 checks, verified
by eight mutations — each caught by the assertion that names it.

**Which fields: derived, and the flag this spec asked for was not needed.**
`countedKeys(level)` in `field_spec.js` is the accessor — `core`, minus
containers, minus `stored: false`, minus `planned`. Stage C proposed a
`counted: false` flag for "fields no person fills"; writing the derivation showed
**no field needs one**, because everything that would have carried it is already
excluded by a rule that has a name. The flag is not there. A declaration nothing
honours is the failure this project has now hit at every stage of D48.

**One deliberate disagreement with `annotationKeys`: `sentence.words` is counted.**
Tokenization is not annotation, so "did somebody work here" says no. But an
untokenized sentence contributes no words, so without that row every word-level
count silently under-reports and says nothing about it. The row is what makes the
word numbers honest about what they could not see.

**Which walk: `_navIndex`, not `tagUsage`.** The spec named `tagUsage` and that
was wrong, for two reasons found by writing it. *Scope:* `tagUsage` walks
`S.wordById` — every open document — plus the dictionary, and knows nothing of
sentences; the panel reports one document, and half the counted levels are not on
that walk at all. *Order:* `_navIndex` is already an ordered list, which is what
stage C's "go to the next one lacking X" needs, and a Map's iteration order is not
a document order to rely on. B-053's rule is kept regardless: **this adds no tree
walk.** `_navIndex` walks the tree, `annotationGaps` iterates the flat lists it
produced, and both memoise on `_dataGen`. `_navIndex` now keeps the sections and
paragraphs it already reached and used to throw away — the same shape as stage D's
journal ids.

**Not counted: the dictionary and the participants file.** `countedKeys('dict_entry')`
returns three fields and nothing asks it. "Which entries are unfinished" is a
question about a different file, asked on a different screen; answering it inside a
panel headed with the corpus name would be a fourth thing the number could mean.

**A blindness found and left recorded rather than papered over.** A corpus
ingested before v3.14.151 carries `free_translation`, a string that `sentTrans`
still reads and displays — and the field table did not admit the key existed at
either level it was written at. The counter is exactly the consumer a missing
declaration blinds: it would report every translated sentence of such a corpus as
untranslated. **The key is now declared `legacy` at sentence and paragraph level**
(v3.14.306), which makes the table true. It is deliberately *not* wired as
`legacyKey`: that fallback feeds `renderField`, and this is a string where the
control expects `[{label, text}]`. The fix is a load migration of the shape
`_migrateDictLegacy` already uses, and it is not stage A's.

## What stage A measured, and what it costs stage C

Run over the two live corpora. Every counted field, both projects, from the
counter itself rather than from a hand query:

| | turkish-test | chinese-test |
|---|---|---|
| section · source_ids | **3** of 3 | **3** of 3 |
| paragraph · translations | **3** of 3 | **3** of 3 |
| sentence · words | 0 of 22 · done | 0 of 22 · done |
| sentence · translations | 0 of 22 · done | 0 of 22 · done |
| word · morphological_parse | **130** of 130 | **171** of 180 |
| word · part_of_speech | **130** of 130 | **171** of 180 |
| word · gloss | 0 of 130 · done | 0 of 180 · done |
| morpheme · gloss | 0 of 130 · done | 0 of 182 · done |
| morpheme · part_of_speech | **130** of 130 | **171** of 182 |
| morpheme · type | **130** of 130 | **168** of 182 |
| document · translation_language | 0 of 1 · done | 0 of 1 · done |

**Six live rows, not four.** Stage C's decision was argued on "both corpora
reduce to four live rows", measured against the fields the mockup drew. The
counter counts two the mockup did not, and both are real: **no section in either
corpus records where its text came from**, and no paragraph carries a
translation. The choice of the queue survives — six rows is still a list rather
than a dashboard — but the margin is smaller than the argument claimed, and this
paragraph is the correction. *(Stage B took it back to five, and one of those
five is an open question — see below.)*

**Stage B is now load-bearing rather than an improvement.** The first run's top
row was the failure D34 exists to prevent, arriving on day one:
`word.morphological_parse`, 301 across both corpora, nearly all of it
monomorphemic words with nothing to join.

### After stage B (v3.14.307)

| | turkish-test | chinese-test |
|---|---|---|
| word · morphological_parse | **done** · 130 with nothing to hold | **done** · 171 with nothing to hold |
| word · transliterations | **not applicable** (Latn → Latn) | **done** · 180 of 180 |
| word · part_of_speech | 130 of 130 | 171 of 180 |
| morpheme · part_of_speech | 130 of 130 | 171 of 182 |
| morpheme · type | 130 of 130 | 168 of 182 |
| section · source_ids | 3 of 3 | 3 of 3 |
| paragraph · translations | 3 of 3 | 3 of 3 |
| everything else | done | done |

**Six live rows became five, and the largest one vanished.** Every multimorphemic
word in both corpora already carries its parse, so the row that would have opened
the panel with 301 items now reads *done*. The transliteration row arrived at the
same time and cost nothing: complete in Mandarin, switched off in Turkish, decided
from the corpus rather than from a setting.

**One row is a question, not a finding: `paragraph.translations`, 3 of 3 in both.**
The stage A note guessed it was derivable "the same way" — that guess is wrong and
this is the correction. *No join exists in the app.* The rule is documented only
in the pre-G31 CLI's README ("`paragraph.free_translation = null` → join the
sentence translations with a space"), and every sentence in both corpora is
translated, so a paragraph translation would be redundant with work already done.
Whether that makes the row derivable or genuinely missing is a decision about the
annotation model, not about the counter — so **the counter reports it, which is
the conservative answer**: it does not invent a derivation the app does not
perform. Deciding it is worth one sentence from the annotator, and it is the last
thing between five rows and four.

**`section.source_ids` is a real row nobody had counted.**

Six sections across two corpora, none of them saying who the text came from. That is fieldwork
bookkeeping rather than annotation, and it is exactly the kind of thing a pass
finishes without noticing — which is an argument for the panel that the spec had
not made.

## Stage C · the surface — **the queue**, decided v3.14.305

Three were drawn against the real counts and compared side by side:

| | what it is | why not |
|---|---|---|
| A · ledger | every field at every level, greyed rows carrying their reason | nine rows to read to find four; the reasons are shown whether or not anyone doubts the count |
| **B · queue** | **a ranked to-do list; the rows it drops collapse into one "N not counted" line** | **chosen** |
| R · one renderer | B with the settled rows behind a fold that restores A | more machinery for a question the annotator may not ask |
| C · map | one cell per sentence, coloured by completeness | dropped: shows *where* work clusters, but part of speech has barely started, so it draws a uniform grid. Revisit mid-pass |

**Both corpora reduce to four live rows**, which is what settled it: at that size
a to-do list is the honest shape and a dashboard is furniture. *(Stage A measured
six and stage B settled at five, one of them an open question — see the section
above. The choice stands; the margin was overstated, and closing that gap is what
made stage B a prerequisite rather than a refinement.)* The count is
secondary to the verb — *"130 · words need a part of speech ›"* — and the rows
it does not show collapse into a single line that can be opened.

**What B gives up, recorded so it is a choice and not an oversight:** overall
progress is not visible without opening the fold, and the three reasons a field
is empty are one click away rather than on screen. If the counter is ever
distrusted, that click is where the trust is rebuilt — so **the "N not counted"
line is not optional decoration**, it is the whole of B's honesty and must name
each excluded field and its reason.

**One question B leaves open.** A *done* field disappears entirely — "gloss,
130/130" is neither a queue row nor a not-counted row. Completion is real
information ("glossing is finished") and the queue currently says it only by
silence. Smallest answer: the collapsed line reads **"3 done · 2 not counted"**
and lists both, which costs one clause and no surface. Take it unless the fold
turns out to be opened so rarely that the done rows are never seen at all.

### What stage C built ✅ v3.14.308

A header button (`Progress`, revealed with Search when a corpus loads) opens a
panel with the two halves. `gapRows()` ranks the live rows by size; the settled
ones collapse into one line. **The panel renders and navigates; it never writes.**

**The queue as it stands on the two live corpora** — five rows, identical in both
but for the numbers:

> 130 · **words need a part of speech** ›
> 130 · **morphemes need a part of speech** ›
> 130 · **morphemes need a type** ›
> 3 · sections need a source
> 3 · paragraphs need a translation
> ▸ 7 done · 1 not counted

**Navigation is D30's, and where D30 does not go, neither does a row.** A word or
morpheme row hands `navGo` the first id it collected; a morpheme row carries its
WORD's id, once per word however many of its morphemes are unfinished, because
the morpheme rows live inside the word editor and there is nothing else to land
on. **Section and paragraph rows are not clickable** — traversal covers words and
sentences, "skip to the next item lacking X" is a D30 §1 follow-up, and inventing
a second way to reach a section here is the thing this spec keeps saying not to
do. Those two rows report and wait, drawn with a dashed border rather than
disabled: there is nothing wrong with them.

**Ids stay the expensive half.** Two passes: the first says which rows are live,
the second asks for ids only for those, and only for the levels that have
somewhere to go. The two non-navigable rows pay for nothing.

**A field's editor label is not its name in a sentence.** Found by drawing it:
`label.editor.sources` is "Source(s)" and `label.editor.translations` is
"Translations", so the first render read *"3 sections need a source(s)"* and
*"3 paragraphs need a translation**s***". A label names a control above a box; a
row names the thing that is missing. `gap.field.<key>` is the second name, keyed
by field rather than by level+field because a gloss is a gloss at three levels —
and the guard fails when a counted field has none, so the next one cannot arrive
unnamed. This is the same lesson as `normForm` versus `normMeta`, at a different
layer.

**The fold is checked for what it admits, not that it exists.** The guard reads
every settled row's name out of the rendered HTML and fails if the summary is a
bare count. That is the one assertion protecting the decision recorded above —
that "3 done · 2 not counted" is the whole of this design's honesty.

**One number moved between the file and the app**, worth knowing before the
counts are quoted anywhere: `morpheme.type` is 168 missing read straight from
`chinese-test` on disk and 165 after `applyCorpus`, because the load-time fill
pass derives some of what the file leaves empty. **The panel counts the loaded
state**, which is the state the annotator is looking at, and that is the right
answer — but a number taken from the file will not always match it.

## Stage C (cont.) · which fields, and click-to-navigate

**Not the `core` tier as it stands.** `core` answers "what is this level's
important content", which is why `sentence.core` contains `words` and
`word.core` contains `morphemes` — containers, excluded by `annotationKeys` for
exactly this reason — and why `section.core` contains `ingest`, which no
annotator fills. The counter needs its own declared subset: **`core`, minus
containers, minus fields no person fills.** One flag in `field_spec.js`
(`counted: false`, or a `CONTAINER_KEYS`-style list) rather than a hand-written
list in the panel, which is the second field list D48 exists to delete.

Navigation is **D30's**, not new: `navAdvance` already walks the document
skipping punctuation, and "skip to the next item lacking X" is the follow-up
D30 §1 item 5 already names. Fold it in rather than build beside it.

## Stage D · "this session" is already recorded ✅ v3.14.308

`mutate()` is the one chokepoint every data change passes through, and
`journalWrite` → `_journalOne` already reduces each write to `{op, t, id}`.
**The ids are computed today and thrown away**; stage D keeps them in a `Set`
per store.

**"This session" means process lifetime**, deliberately: the Set is built in
memory and a reload starts a new one, which is what an annotator means by the
word. Deriving it from `prov` timestamps instead would answer "today", which is
a different question and wrong across midnight.

Tracked **by id**, so a retokenization or an insert cannot scramble the list —
and an id that no longer resolves is reported as *removed* rather than dropped,
because that is a thing the annotator did.

### What stage D found by running

**Loading is not editing, and it is one line away from being.** `applyCorpus`
journals nothing, so opening a corpus leaves the session record empty — which is
correct and was not guaranteed by anything. A load path that declared what it had
read would make the panel open by claiming the annotator edited the whole corpus.
`session_panel_test` boots the app, loads the real corpus and asserts the record
is empty, and the mutation that proves it can fail is exactly that: one
`mutate('corpus', S.docs)` in the load path.

**Two rules that counting alone cannot show**, both now separately guarded
because the first pass had them passing for the wrong reason:

- *first write wins* — a record **created** this session and then edited is still
  an addition. Counting could not tell: a `Map` keyed by id dedupes either way.
- *a removal has two routes* — the journalled `del`, and an id that stops
  resolving. A fixture that did both at once let either one carry the test.

**Added and then removed in one session is neither.** It is a false start: no one
else ever saw the record, and reporting it as a removal would be reporting
nothing. That is a decision, not an omission, and it is in the code with its
reason.

**Fidelity is the journal's, deliberately.** A save path that declares a store
dirty and names nothing marks the journal incomplete, and the session record
misses it the same way. One record of what was written rather than two that can
disagree — the rule this project keeps arriving at.

## What this must not break

- **Emptiness stays the record.** D53 stage F: the panel counts stored
  emptiness, so nothing may fill a field with a placeholder to satisfy it.
- **One walk.** If the counter grows its own traversal, B-053 is back.
- **The panel reports; it does not annotate.** Every D53 stage held that line
  and this one is a counter, which is further from the data than an offer.

## Not in scope

Progress as a percentage of "done" — there is no definition of done for a
fieldwork corpus, and inventing one in a status panel is a claim about the
linguistics. Counts of what is empty, and a way to get there.
