# D51: one add-to-dictionary surface
**Updated:** 2026-08-30 · **Version:** v3.14.271  
*Design record, written before the work and closed after it. **Shipped
v3.14.263–271.** Read it before touching `openAddDictModal`, `candidateRows`,
`createEntries` or `backPropagate`; the reasoning is not in the code.*

**Decided 2026-08-30**, from gathering every open item that touches entry
creation and finding that they are one surface's problems rather than eleven
bugs. Read this before touching `openPushPickModal`, `openCompletionModal`,
`renderDictAdd`, `_pushTokenToDict` or the `+ dict` link.

---

## 0 · The finding that reframed the spec

**`dict-add` has exactly one entry point in the whole app.** One
`data-go="dict-add"` exists in the source, on the `+ dict` link under a morpheme
column in the word view. Dict-browse has no create affordance, the dictionary
view has none, there is no menu item, and `renderDictAdd`'s own cancel and back
buttons target `word` with a word id and a sentence id they assume are there.

So the dictionary cannot be given a word that is not a morpheme of a token the
annotator has open. A word they thought of, a word a speaker gave them in
elicitation before any text exists, a word that is in the corpus but in a token
they have not opened — none of these has a route. Filed as **B-140**.

This was found by drawing the routes from the source, not from the audits, and
none of the five UX audits records it. It matters here because the question that
prompted the spec — *does one merged surface make adding a new word harder* —
turns out to be unanswerable as posed: adding a new word is not currently
possible, so the merge cannot make it worse, and the missing route argues for
the wider scope rather than against it.

## 1 · The four cases, and why they are one surface

| case | today | steps |
|---|---|---|
| push a token and its morphemes | word save → checkbox → picker → `_pushTokenToDict` → completion modal | three surfaces |
| one morpheme, deliberately | `+ dict` → `renderDictAdd`, 15 flat fields | one, dense |
| correct an entry that exists | dict-browse → `renderDictEdit`, 14 fields | one |
| add a word from nothing | — | **no route** |

Four cases, three surfaces, and every one of them writes a `dict_entry`. The
same fields, the same defaults, the same fill-only rule, and three places that
each know part of it. B-058 is the direct consequence: `saveDictEntry` and
`saveNewDictEntry` back-propagate different amounts to the corpus word, and
nothing records that as a choice.

**Decision: one surface, with context as a parameter rather than an assumption.**
It takes zero or more candidate forms and an optional corpus word. Given a word
it is the push. Given one morpheme it is `+ dict`. Given an entry it is the
editor. Given nothing it is the new-entry screen B-140 asks for.

## 2 · Where it lives

**A modal, opened before anything is written.** This keeps B-085's rule, which
was decided against the alternative and still holds: asking first beats minting
entries and ids and then unminting them, because an entry that briefly existed is
one another save can already have linked to.

This **supersedes the 2026-08-26 "Option B, the candidate list" decision**, which
put the list inline under the push checkbox in word-edit. That decision was taken
before the completion modal was recognised as a second step, and an inline panel
cannot serve the three cases that have no word view to sit in. Option B's
substance survives — the candidate list, the per-row expansion, the defaults
table — and only its placement is overturned. The record is corrected rather
than left with two contradictory decisions, which is how B-112 came to describe a
flow nobody had chosen.

## 3 · The row

Collapsed by default: a tick, the form, the gloss, and an existence marker.
Expanded: type, part of speech, gloss, definition — the four the completion modal
asks today. Anything past those stays in the full entry editor; this surface is
for making an entry that is not wrong, not for finishing it.

**A form already in the dictionary shows the stored entry, with the fields this
push would fill marked.** The push has always been fill-only and has never said
so, which is the specific thing B-112 objects to: *"the annotator cannot see what
is being written or correct it"*. This also settles where the existence marker
sits, which Option B left open — it sits on the row, and expanding the row is
what explains it.

**Selection is remembered per session, in three buckets** — the word form, the
first morpheme, later morphemes — and **is not persisted.** An annotator settles
into a habit within a sitting and remembering the habit is what saves the clicks;
remembering individual forms would not generalise to the next word. Not persisted
because a stale habit that follows the annotator into a different corpus is worse
than three clicks, and because persisting it is a format question this does not
need to open.

Defaults, when there is no remembered state, are B-068's rule unchanged: each
morpheme on, the word form off when the word has a parse, on when it does not.

## 4 · What folds in

| item | what it becomes here |
|---|---|
| **B-112** | the surface itself |
| **B-111** | a row rule: when a word has one morpheme that folds to the same form, offer one row, not two |
| **B-113** | the taken-state predicate reads the rows' current values as well as the store, through the `data-original` the fill already gates on |
| **B-058** | dissolves — one surface writes, so add and edit cannot back-propagate different amounts |
| **B-140** | the zero-context case |
| **F4 residue** | `_dictFillForForm` returns `part_of_speech`, so the lexicon's POS can be offered as a chip rather than silently withheld |
| **F3** | a derived value is shown before it is written, which is what an expanded row is |
| the two untranslated strings | `+ dict` and `dict →` are hard-coded English in the word view |
| §4.2 row 8 | the audit row this closes |

**Not folded in, deliberately:** B-106 and B-114 are lemma questions and belong
to D35 stage B5, which is where lemma ambiguity was already going to be answered.
B-123's backfill is a one-shot data operation, not a surface. D28's senses are
explicitly unscheduled and would change what a row means. B-093's transliteration
half waits on D32.

## 5 · The constraint to design against — resolved at stage 2

**The candidate shape, as built at v3.14.267.** This is what stage 3 produces and
stage 4 edits, so it is recorded here rather than left in the source:

```
{ form, kind: 'word' | 'morpheme', type, part_of_speech, gloss, meaning,
  lemma_id, link }
```

`kind` decides two things the old branches encoded separately: which existing
entry counts as a match (a surface form looks for a `word`-typed entry, a
morpheme takes any, which is what keeps a second push idempotent), and whether a
lemma link applies at all. `link` is the corpus object to link back to and it is
**optional** — a candidate with no link is an entry created from nothing, which
is the zero-context case. `_CANDIDATE_FIELDS` declares which fields a candidate
carries into an entry, so a field added to a row at stage 4 is written without
anyone editing the writer.

## 5 · The constraint to design against

Every part of the push chain currently assumes a token. `openPushPickModal` takes
a `word`. `_pushTokenToDict` takes a `word`, reads `word.morphemes`, and links
back to the word it was given. The zero-context case has no word to link to and
no morphemes to enumerate, so the writer has to be told *what to create* rather
than *which parts of this word to create*.

That is the real work, and it is the same shape as the last four chokepoint
fixes: the question is not how to add a screen but where the one writer goes.
Getting it wrong means the standalone case becomes a second path with its own
defaults, which is exactly the state this spec exists to leave.

## 6 · The order, decided v3.14.264

Data before pixels. Every stage below 4 can be proved headless, which is the
whole reason for the split: the writer and the candidate model are where a defect
would be expensive, and neither needs a DOM to be wrong in front of a guard.

| | stage | why here |
|---|---|---|
| **0** | give `linking_s1s3_test` a behavioural half | 26 checks, no `vm`, no `runInContext` — it scans source. Stage 2 rewrites what it nominally guards, and a hollow guard passes through a rewrite in silence. Already on §4.3's list; a prerequisite now rather than suite hygiene |
| **1** | F4's field · B-113's predicate · the interim door for B-140 | Not small-first: `_dictFillForForm` returns gloss, transliterations, type and `dict_cands` and **no `part_of_speech`**, and stage 3's rows have to ask it what the lexicon offers. B-113 is in the same word-edit machinery. The door is a new-entry button in dict-browse opening `renderDictAdd` with no prefill and a back target that does not assume a word — deliberately throwaway, superseded at stage 5, because B-140 is S2 and a tester meets it in the first session |
| ~~**2**~~ | ✅ **v3.14.267.** `tokenCandidates(word, pick)` decides which forms, `createEntries(candidates)` writes, `backPropagate(entry, word, sent)` is the one tail. **B-058 closed**, mechanically. Equivalence verified by running the old writer and the new pair over every word of both corpora — identical dictionaries, identical `dict_id` written back, identical lemma index |
| ~~**3**~~ | ✅ **v3.14.268.** `candidateRows(ctx)`, taking `{ word }` or `{ seeds }`. A row is a candidate plus `on`, `bucket`, `existing` and `fills`; `_ROW_ONLY` strips those at the writer's boundary. B-111's dedup is MARKED (`mergedInto`) rather than applied, because the picker still addresses rows by index — `visibleRows` is what stage 4 draws. The falsification was taken and came back clean: the old picker's defaults against the new model's, plus the candidate list under six pick shapes, for every word of both corpora, zero differences |
| ~~**4**~~ | ✅ **v3.14.269.** `openAddDictModal(rows, onDone)` — takes rows, hands back edited candidates, decides nothing. **B-112** and **B-111** closed; **F3** arrived as the opened row. The completion modal, `backToWordFromCompletion` (B-104) and `#cd-overlay` went with it: B-104 existed because the modal opened after the write, and nothing is written before the answer now |
| ~~**5**~~ | ✅ **v3.14.270.** `openAddDict(rows, opts)` — writes, back-propagates when there is a token, opens the entry in the editor. **B-140 closed** by a row with no form and no link. §6's open question answered: `renderDictAdd` **retires**; the panel creates and `renderDictEdit` refines, because twelve fields on a first-run screen is I6 and two surfaces creating one record is B-058 |
| ~~**6**~~ | ✅ **v3.14.271.** Both strings keyed — and the scan for the class found **eighteen** unkeyed English strings in renderers, of which seventeen were keyed and two are named exceptions (`linguex`, `gb4e`, LaTeX package names). `locale_key_test` gained the check that finds them: it asked whether a referenced key exists and could not see a string that was never keyed at all. The checkbox stays; its hint says what saving will do instead of describing a control that no longer exists |

**The trigger stays the checkbox**, and the modal still opens on save. The
alternative — a button opening the modal mid-edit — is what INPUT_UX's *"a
checkbox here is neither a field nor a command"* argues for, and it was rejected
here for a concrete reason: mid-edit the word is not saved, so the candidates
would have to be read from the form's DOM, which is a third read path beside
`readForm` and the word editor's own. The store stays the single source, and
B-085's ordering is untouched.

## 7 · Open, and deliberately not decided here

- **B-112's extension**, from the report: if the annotator edits a field in the
  pop-up so it disagrees with the word annotation it came from, ask whether to
  fix the word too. Worth recording, not worth blocking on.
- ~~**Whether `renderDictAdd` retires or becomes the deep editor.**~~ **Decided
  v3.14.270: it retires.** The panel asks the four fields that make an entry
  usable and then opens it in `renderDictEdit`, where the other eight and the
  three bespoke editors already live. Create here, refine there. I6's density
  finding is answered by not having a twelve-field first-run screen rather than
  by folding one, and keeping it would have left two surfaces creating one
  record — the shape B-058 and B-112 were both about.
- **The guard.** It has to be written before the surface, and it has to make a
  claim behaviour can fail — `linking_s1s3_test` is the standing warning here,
  8 of 34 assertions executing anything and all 34 green with `takeOffer` gutted.


---

## 8 · Closed, v3.14.271

Nine versions, v3.14.263 to v3.14.271. Closed: **B-058**, **B-111**, **B-112**,
**B-113**, **B-140**, unified audit **§4.2 row 8** and **§4.3**'s
`linking_s1s3_test`, plus **F3**, **F4**'s residue and **I6**.

Retired: `_pushTokenToDict`, `openPushPickModal`, `openCompletionModal`,
`saveCompletionModal`, `closeCompletionModal`, `backToWordFromCompletion`,
`renderDictAdd`, `saveNewDictEntry`, `S.dictNewEntry`, the `data-add-*` prefill,
`#cd-overlay`, the `dict-add` view and its help entry, breadcrumb and cache key.

**The chain, in order of dependence:** `candidateRows(ctx)` decides what is on
offer · the panel draws and edits it · `createEntries(candidates)` writes ·
`backPropagate(entry, word, sent)` gives the token back. Each was proved against
both corpora before the layer above it existed.

### What the sequencing taught

**Data before pixels was worth the extra versions.** The writer and the model
were provable headless and were proved against the live corpus — 162 words, 134
entries, identical links — before any screen was built. Stage 4 then had nothing
to invent, and the two equivalence checks kept re-running clean through three
further rewrites of the surface above them.

**Two items filed as small turned out to gate the work.** `linking_s1s3_test` was
in §4.3 as suite quality: 26 assertions, none of which executed anything, over
exactly the machinery stage 2 was about to rewrite. A hollow guard passes through
a rewrite in silence, so it went first. `_dictFillForForm`'s missing
`part_of_speech` was filed as a one-field defect; it was what stage 3's rows had
to ask, so its position was decided by dependence rather than by size.

**Rewriting a guard is a chance to strengthen its claim.** Three keyed to the
retired surface came back stronger rather than merely edited: `homograph_test`
pins exactly one creation path where it asked for two or more, `render_cache_test`
keeps B-049's rule generalised after its instance disappeared, and
`form_render_test`'s prefill check is inverted so that neither producer nor
consumer may exist.

**The finding that started it came from drawing, not reading.** `dict-add` having
one door was invisible to five UX audits because an audit describes the surfaces
that exist. `ui_wiring_test` carries the general rule now: every view in the table
must have a way in.
