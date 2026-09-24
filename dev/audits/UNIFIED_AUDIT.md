# UNIFIED AUDIT: the audit of record
**Updated:** 2026-09-24 · **Version:** v3.15.2
*LIVE. Started against v3.14.221 and bumped with every version since, because a
stale audit of record is worse than none. Findings keep the build they were found
against. `dev/audits/AUDIT_INDEX.md` indexes the frozen audits this replaced.*

## How to read this

**Organised by subject, not by date.** Findings arrived in three waves — the
original lines at v3.14.221, the code audit at v3.14.313, the fill/UI/backend/
timing audit at v3.14.333 — and were filed in that order until v3.14.334, so
everything about provenance sat in three places. They are grouped by what they
are about now; the `L-nnn` ids are unchanged and the wave each came from is in
its own line.

| | |
|---|---|
| **[§1 The board](#1-the-board)** | every open item in one ranked table — start here |
| **[§2 Findings](#2-findings-in-full-by-subject)** | the open bodies, by subject. A body is the instruction for the work. §2.7 added v3.14.405 |
| **[§3 Conflicts](#3-conflicts-still-live)** | five places two documents or two code paths disagree |
| **[§4 Combinable work](#4-combinable-work)** | where one pass closes several items |
| **[§5 Ledgers](#5-ledgers)** | everything closed, one row each |
| **[§6 Checked and correct](#6-checked-and-found-correct)** | what the next pass may skip, and against which build |
| **[§7 Limits](#7-what-no-pass-could-do)** | what none of the three waves could reach |
| **[§8 Notes from the passes](#8-notes-kept-from-the-passes)** | what each wave examined · the journal session · the refuted guard proposal |
| **[§9 How this audit has been wrong](#9-how-this-audit-has-been-wrong)** | its own corrections, kept because the pattern repeats |

**46 findings — 38 closed, 0 half, 8 open. 18 conflicts — 15 settled, 3 live.**
Every count is computed from the table that holds the rows and never carried
forward: §1's board has the **11** rows still outstanding — 8 open findings and
the 3 live conflicts — and §5's ledgers hold what is done. v3.14.314 changed two
states and miscounted the header by one in the same edit; **so did the line this
replaces**, which said 32 closed / 2 half against a ledger holding 31 and 3, and
"20 rows" against a board of 15. Recomputed from the tables at v3.14.387 —
counting by hand is how this row keeps failing, so the figures above were taken
by a script that parses the two tables.

**Method, all three waves:** every number computed and never recalled, labelled
with the corpus and build it came from; executed rather than read wherever the
question allowed; a cost under 1 ms at real size reported as **not worth
fixing**. What each wave examined is in §8.1.

---

## 1. The board

Every open finding and live conflict, ranked by what leaving it costs. **S** is
the severity if it is also a bug.

| id | subject | S | in one line | bug |
|---|---|---|---|---|
| **L-043** | controls | — | 21 array-shaped fields, six controls, three declaring none. Deferred by decision v3.14.408; trigger is D28 or D37 | — |
| **L-044** | controls | — | `list` edits an array through one comma-separated text box. Absorbed into D62 A v3.14.408; still unfixed, tracked in gate 3 | **B-139** |
| **L-006** | guards | — | The suite's mutation score is 56%, and 31% of assertion sites are regexes against source text | — |
| **L-013** | fill · timing | — | The observed annotation order corrects D46. Order decided v3.14.408, built v3.14.409; still n=1 | — |
| **L-039** | references | — | `pinned_examples` is a reference nothing sweeps and nothing counts | — |
| **L-041** | the view | — | An offer that cannot be taken: `data-offer-translit` has no consumer | — |
| **L-030** | documents | — | The numbers in the files that exist to stop stale numbers | — |
| **L-022** | documents | — | Disposition of the twelve superseded audits, mostly unapplied | — |
| **⑥** | fill · timing | — | Two shipped word field orders, neither matching the observed one | — |
| **⑦** | the view | — | The wanted mark reaches neither the word editor nor the morpheme rows — and a guard holds the gap open | — |
| **⑫** | documents | — | The interchange decision was taken on a miscounted key | — |

**The guards-and-fixtures line is closed.** L-007, L-019, L-021 and L-042 were
one question in four places — *is the fixture worth the guards that read it?* —
and the fixture swap (v3.14.384) answered all four. What that line leaves behind
is in §5.1 and in D58 §§8–10; **L-006's mutation score is the only guards item
still open**, and it is about the guards rather than about the data.

**Two subjects carry the weight.** Provenance of what the app writes was one
question in three places — *when the app supplies a value, does the record say
so?* — and **all three are closed**: L-031 and L-032 at v3.14.335, and **L-027,
the one that crosses into Python, at v3.14.365 with B-157**. References and
integrity is the other — *what happens to the thing that pointed at it?* — and
**L-033, the one that lost data, closed at v3.14.336** and **L-036 at v3.14.343
with D59**, leaving **L-039** alone. L-034, the largest measured lever in the
document and not a defect, closed at v3.14.416 with D40.

*Corrected v3.14.396, twice over: this paragraph said L-027 "remains" for 31
versions after §5's ledger recorded it closed, and said the same of L-036 for 53.
The second was found only by sweeping every id the ledger marks ✅ against §1's
text — the first correction had preserved it verbatim while fixing the sentence
beside it, which is how a stale summary survives being edited. §1's own table never listed it, so the board and
the ledger agreed and only the prose between them was wrong — which is the worst
place for it, because a summary is what gets read instead of the table. It sent a
reader to re-open a fixed bug. **A count belongs in one place** (this file's own
header rule), and so does a status; prose that restates one is a second writer
of it.*

---

## 2. Findings in full, by subject

*Open bodies, plus any closed since the last comb. A body is removed at the comb
that FOLLOWS its closing, not at the moment it closes: a **CLOSED** paragraph is
written into it first, so the account of what the fix turned out to be travels
with the finding into `dev/archive/changes/`, and the comb leaves one row in §5.
L-035, L-036, L-038 and L-040 were retired that way at v3.14.363 — the first comb
to run under the rule as written. It said bodies went at the moment of closing
until v3.14.358, and those four were sitting under a sentence that declared them
already gone. The bodies below are kept whole: a body is the instruction for the
work.*

### 2.1 Provenance — does the record say who decided? · ✅ CLOSED

*One question in three places: when the app supplies a value, does the record say
so? **All three are closed** — L-031 (a part of speech nobody chose) and L-032
(a fill into a shared entry that left no trace) at v3.14.335, and L-027, the one
that crosses the language boundary, at v3.14.365 with **B-157**. Bodies are in
§5.1; this heading stays so the numbering below it does not move.*

*Compressed v3.14.397. It kept a ten-line intro whose last sentence — "what
remains is the one that crosses the language boundary" — was **the third copy of
the L-027 error**, after §1's prose and §5's own summary. A subject with nothing
open does not need an argument, only a pointer.*



### 2.2 Fill and timing — the right value, at the right moment

*What the app proposes or writes on its own, in which direction, and when. L-034,
the largest measured item in this document, closed at v3.14.416 (D40); its body
goes at the next comb.*

*Restored v3.14.397. This heading was deleted at v3.14.387 by a compression pass
that removed the section and left both its bodies in place — so §2 ran 2.1 → 2.3
with a hole, and L-034 and L-013 read as **provenance** findings when §1's own
board files both as fill·timing. One heading, two errors, and neither was visible
from the text either side of it.*

#### L-034 · B · The unit of work is the token, and 44% of the work is re-work

Measured independently of the pass that proposed it, over both live corpora,
counting only glossed tokens:

| | glossed tokens | recurring forms | tokens they cover | **re-decisions** | forms taking exactly one gloss |
|---|---|---|---|---|---|
| `turkish-test` | 130 | 18 | 65 (50%) | **47** | 16 of 18 |
| `chinese-test` | 180 | 31 | 119 (66%) | **88** | 28 of 31 |

**135 of 310 decisions are re-decisions of a form already decided**, and ~90% of
recurring forms take one gloss throughout — the exceptions (`bir`, `yürüyordu`,
`的`, `只`, `长`) are exactly the homographs `linkTo`'s `ambiguous` state already
refuses to guess at.

The session log shows the cost directly: `bir` was edited three times — **32 s,
101 s, 129 s** — for three byte-identical results, and the later two cost *more*
than the first despite the lexicon holding `bir` from second 32. Five more `bir`
tokens are still untouched.

**The app has every piece of a form-at-a-time pass and has never assembled one**:
the form index folded by `normForm` (B-144), `parseSegmentState`'s
unique/ambiguous line, `linkTo`'s refusal, the `derived` stamp, and
`_fillMorphRows`' mode switch. D40 specced it, measured it, and it was never
built. This is the largest single lever in the audit.

---

#### L-013 · B · The observed annotation order corrects D46, and F5 with it

The session worked in this order: transliteration, part of speech, morphological
parse, morpheme fields, lemma, then the rest. The view asks in a different one.

Two of D46's claims hold. The word gloss is asked second and answered last,
because it is derived from the morphemes. The lemma is asked fourth and answered
fifth.

**One is wrong, and it is F5's.** D46 and F5 both put the parse first, F5 calling
it the primary surface and the highest-leverage change available. The annotator
puts POS before the parse — which is the better order, since knowing a token is a
verb is what tells you how to segment it. The parse is the pivot for everything
below it, not the opening move.

Target order: transliteration, POS, parse, morpheme rows, lemma, gloss, push.
Two long moves and two short ones. And it is markup work, because word-edit is
the level that does not read the field table.

> **Still open at v3.14.314, and the reorder is deliberately not done.** The
> observation is n=1: one session, one annotator, one language. Reordering the
> editor on it would be acting on a single measurement, which is the mistake D34
> was built to stop making with numbers. **What is recorded is the correction**
> — DEV_PLAN retired F5 on this evidence and states the target order — and what
> is waiting is a second pass to confirm it. Gate 2's D46 is that pass.
> **Conflict ⑥ is this finding from the other side**: it names the disagreement
> between the two orders the code ships, where this names the order the work
> actually took.

> **The reorder was decided at v3.14.408, and it does not adopt this order.**
> The decided sequence is transliteration, POS, **word gloss**, parse, morpheme
> rows, lemma. Three of the four moves are this finding's: POS rises above the
> parse, the lemma falls below the morpheme rows, the parse moves up. **The word
> gloss does not fall to the end.** It goes third, above the parse, which is the
> one place the decision contradicts the measurement.
>
> The reason is recorded in the D46 appendix and is worth repeating here because
> this finding is the evidence it argues against. The session answered the gloss
> last because the field was *pre-filled with the app's derivation* by the time
> it got there — B-187 and B-191 are four attempts at the consequences of that.
> Asked before the parse the field can only hold the annotator's own whole-word
> gloss, which is the value it exists to hold. So the measurement recorded when
> the annotator *could* answer, and the decision changes what the question is.
> n=1 either way. **Gate 2's D46 pass now runs against the decided order**, and
> QUICKSTART asks the question directly.
>
> **Built v3.14.409.** `field_order_test.js` is D46's pass 1 as a guard: the
> sequence asserted against the decision, and the two real dependencies
> asserted against the code. **This finding stays open** — what is unresolved
> is not the order but the n=1, and only a second annotator settles that.

---

### 2.3 References and integrity — what happens to the thing that pointed at it


#### L-039 · A · `pinned_examples` is a reference nothing sweeps and nothing counts

`pinDictExample` stores `{type:'corpus', sentence_id, token_id}` (`:12305`).
`_pinnedCorpusExHtml` (`:8492`) returns `''` when the token id misses — the
curated example vanishes from the view and stays on disk. `dictEntryRefs`
(`:12373`) walks `dict_id` and `lemma_id` only; `danglingCompanions` (`:1097`)
counts `dict_id`, `lemma_id`, `annotator_id`. Re-tokenization can delete the
token a pin points at.

Compare `_depSweepHeads` (`:9728`), which clears dangling heads **and alerts**,
under a comment saying silent loss is the worse error. Zero pins exist in either
corpus today, which is why this is A and not C — and why it is worth writing
down before there are any.

---

### 2.4 The annotator's view — can they tell, and can they choose?


#### L-041 · A · An offer that cannot be taken

`offerStripHtml` emits `data-offer-translit` (`:3536`); `takeOffer` never reads
it and `_fillMorphRows` has no transliteration parameter. Its only producer reads
`e.transliteration` (`:5546`), the legacy scalar the current schema never writes,
so it is always empty anyway. **B-060 in a new shape** — an attribute that looks
like a contract and has no consumer.

---

### 2.5 Guards and fixtures — does green mean checked?

*L-018, L-019's matcher half, L-025, L-026, L-028, L-029 and L-037 closed at
v3.14.337–338; what is left here is the fixture, which is data rather than code,
and the mutation score.*

#### L-006 · E · The guard suite's mutation score is 56%, and one guard is entirely hollow

> **Re-measured in part, v3.14.402.** The **score** has not been re-taken since
> v3.14.229 and must not be quoted until it is — `GUARD_MUTATION_2026-08-30`
> rec 8 says the same and is also untaken. What *was* re-measured is the second
> half of this finding, *"31% of assertion sites are regexes against source
> text"*: counted across all `dev/tests/*_test.js`, **290 of 2,050 `check()`
> sites — 14%**, against 31% when this was written.
>
> **Not a refutation, and the direction matters.** The proportion fell because
> the denominator grew: the suite went from ~66 guards to 92, and the ones added
> since execute. The absolute count of source-text assertions is what would have
> to fall for the finding to be answered, and nothing here shows that it has.
> *Method: a `check(` site counts as source-text if its first 220 characters
> both test a string and name one of the source readers — a proxy, stated so it
> can be argued with rather than trusted.*

> **The headline figure has not been re-taken since v3.14.254, and a great deal
> has changed under it.** Between v3.14.370 and v3.14.386 individual guards were
> mutation-tested as they were written or rewritten — 7/7, 25/25, 13/13 on the
> Search-B pair and the D58 §3 deletion — and several of the hollow ones named
> below were replaced outright. **None of that is a suite-wide score**, which is
> the only number this finding is about, and a per-guard pass is not evidence
> about the guards nobody touched. *Re-running the 39-function sweep is the work
> this finding asks for; noting here that the score is stale is not doing it.*

Thirty-nine top-level functions were gutted one at a time, body replaced and name
kept. **Twenty-two mutants killed, seventeen survived** — including
`requireIdentity` (the save gate), `makeWordObj`, `confirmAnnotationLoss`,
`renderSectionAdd` and `offerSrcOf`.

**`linking_s1s3_test.js` is proven worthless.** Gutting the five functions it
names — including the whole 3,270-character `takeOffer()` — left **all 34 of its
assertions passing**, and only one unrelated guard noticed. Its checks are of the
form `check(/function takeOffer\(/.test(html))`: a record that the feature was
once written, not that it works.

**✅ v3.14.265, D51 stage 0.** A behavioural half was added: 35 assertions that
run `resolveLemma`, `_resolveOrCreateLemma`, `lemmaCandidates`, `lookupLemma`,
`linkTo`, `lemmaStripHtml` and `takeOffer` in a `vm` with the real normaliser and
the Turkish collator. 69 assertions now, and five mutations were tried against
it, each caught: gutting `takeOffer`'s `set` branch (1 failure — the exact
mutation that used to leave 34/34 green), `linkTo` resolving ambiguity by
`list[0]` (3), lemma creation going silent (2), a near match returned as exact
(5), and an automatic link signed by a person rather than derived (1). It was
built before D51 stage 2 rather than after, because stage 2 rewrites the
machinery this file names.

Across the suite, **313 of ~1,009 assertion sites (31%) are a regex against
source text**, and 59 of those assert *absence*, which is permanently green.
`required_marker_test.js:106` asserts `wantedMark()` "is defined"; gutting
`wantedMark` failed no guard in the suite, including that one.

**Three more instances, v3.14.245–250.** All three are the `takeOffer` shape: a
guard keyed to a spelling rather than to the thing the spelling stood for.

- `prov_intern_test`'s check that every prov-shaped field is thinned grepped
  `serializeRecords` for the literal `o.<key>`, once per declared field. Stage 4b
  replaced those named reads with a loop over `PROV_STAMP_KEYS`, so the grep went
  dead in the same edit that would have made it useful. It asserts against the
  constant now, which is what the load, save and journal layers share: a
  prov-shaped field added to the table and not to the list fails there rather
  than reaching a file.
- The same guard's size assertion compared its output against the file on disk.
  Run against a corpus that is **already interned** it reports ~0% and fails,
  because the feature had worked. It is the failure mode §5.3 named one version
  earlier, written again immediately after it was named. The baseline is built
  rather than read now: expand the loaded tree back to inline moments and
  serialise that, which is true whatever state the fixture is in.
- `word_edit_pos_test` extracts the functions it exercises by name. The morpheme
  row's move onto `objProv` / `provById` at stage 4a (B-130) therefore required
  editing that list by hand. A guard keyed to a function name cannot notice a
  call site that moves; it can only be told about it afterwards.

---

*L-007, L-021 and L-042 closed at v3.14.384 and their bodies were removed at the
comb, as §5 prescribes. All three were the same finding seen from three angles —
a fixture in a format the app no longer wrote, with no dependency data, and a
tally that differed depending on which corpus resolved. The swap answered them
together: `samples/` is now the two live corpora, byte-identical, so the format
question is gone, the parses are in it, and the two tallies are the same run.
The full text is in `dev/archive/changes/`; what survives is in §5.1, and the
reasoning that replaced them is D58 §§8–10.*

---

### 2.6 Cost, documents and dead code

*Emptied at v3.14.337–338 except for the disposition of the twelve audits. The
dead-code pass is worth reading in §5 for what it cost: a duplicate id that read
as untidiness was a live bug (**B-174**), and my own first list of 24 dead
classes had four survivors — `help-*` is emitted from locale strings, and `tall`
was a substring match on "install".*


---

---

#### L-030 · E · The numbers in the files that exist to stop stale numbers

| the file says | measured at v3.14.313 |
|---|---|
| `run_all.sh:35` — "19.3 s all in, **4.9 s without it**" | 21.5 s all in, **7.5 s** without. The 14.4 s for `nllb_diag_test.py` reproduces at 14.0; the 4.9 s is off by 53% |
| `corpus_optimize.py:17-21` — a STRUCTURE map naming `benchmark_config()`, `run_benchmark()`, `test_google()` | an `ast` walk finds 10 defs and **none of those three**. Its *Usage* and *Output* sections are still right, so **S5's question answers: the behaviour yes, the map no** |
| `corpus_optimize.py:10` — writes `annotator_config.json` "at the project root" | `main:592` writes `source/config/`; `--output`'s help says a third thing |
| `LingCoT.pyw:1000` — tells the user to run `node dev/log_triage.js` | the file is `dev/tests/log_triage.js`. A user-facing dead end |

**GUARD_MUTATION rec 5, re-counted: 20, not 16, and none cleaned up.** Fifteen of
its sixteen identifiers still appear in zero files under `source/`; the
sixteenth, `syncPushDictState`, now has one hit — a tombstone comment, not code.
Four more were missed: `ew-push-dict-word`, `morph-push-cb`, `pk-pos-0`, and
`inferPos`. **`inferPos` is the instructive one**: it appears at
`LingCoT.html:8016`, but only in a comment, and the guard tests `decomment(…)` —
so that assertion is *structurally incapable of firing*.

---

---

#### L-022 · F · Disposition of the twelve

> **Re-checked v3.14.310.** "Superseded" overstates what happened. Two documents
> were retired at v3.14.230 (`LINKING_AUDIT`, `LEMMA_LAYER_AUDIT`); the other ten
> are still in `dev/audits/`, and the per-document corrections `AUDIT_INDEX.md`
> §2 prescribes are unapplied — `SCRIPTS_AUDIT.md` has no strikethrough,
> `DATA_MODEL_AUDIT.md` still carries §1. The v3.14.310 re-check adds a second
> disposition problem the original did not see: **two documents this index calls
> LIVE declare themselves frozen in their own headers** (`L_STATUS`,
> `UX_CLUSTER`), and one of them is 55 versions stale.


Superseded by this document: `DATA_MODEL`, `LEMMA_LAYER`, `LINKING`,
`ANNOTATION_FILL`, `INPUT_UX` (its answered half), `SCRIPTS`, and D33 as recorded
in DEV_PLAN. Kept as the reasoning behind a decision, not as work:
`ANNOTATION_UX`, `GUI_DESIGN`, `DOCS`, `PIPELINE`, `SEARCH_B_DESIGN`.
`DICT_SENSE` is a proposal awaiting a decision and was never an audit.

**F2 to F5 resolved.** F2 is a subset of D40 and should be closed rather than
carried. F5 is absorbed into D46 and corrected by L-013.

**F3 and F4 are both closed now**, and this paragraph was the last place saying
otherwise. F4's mechanism shipped as B-089 (`inheritMorphemeTypes`, measured: 7
morphemes carrying a lexicon-stamped type) and the "one field missing from one
literal" it left — `_dictFillForForm` dropping `part_of_speech` — closed at
**v3.14.266**, offer-only and guarded, because a morpheme still never INHERITS a
part of speech from the lexicon. **F3** closed at **v3.14.269** with D51: an
opened candidate row IS a derived value shown before it is written. The line
*"F3 alone stands, and its priority should rise"* was right and was acted on;
what it called the cheapest partial answer to L-009 arrived after L-009 itself
closed at v3.14.260.

### 2.7 Controls and presentation, by field shape

*Inventory taken v3.14.405 against `field_spec.js`, `renderField`, every form
element emitted in `LingCoT.html`, `participants.js`, `events.js` and
`search.js`, and the 1,030 rules in `LingCoT.css`. Counts are computed, not
recalled.*

**The shape of the app's input layer.**

| | count |
|---|---|
| declared fields in `field_spec.js` | 83 |
| distinct `control` values declared | 15 |
| fields declaring no control | 21 |
| control branches in `renderField` | 11 |
| `<input>` emitted (49 of them `type="text"`) | 62 |
| `<textarea>` | 13 |
| `<select>` | 6 |

#### L-043 · A · 21 array-shaped fields, six controls, three with none

Every field below stores a list. The control column is what `field_spec.js`
declares, and it decides which of four structurally different editors appears.

| control | n | fields | editor produced |
|---|---|---|---|
| `comments` | 6 | `comments` at 6 levels | row editor: textarea, source chip picker, date, remove |
| `translits` | 5 | `transliterations` at 5 levels | row editor: two plain inputs, remove. No source, no date |
| `translations` | 2 | `paragraph`, `sentence` | row editor: textarea, source chip picker, date, remove |
| `sources` | 2 | `document`, `section` `source_ids` | chip picker, multi-select, no rows |
| `list` | 2 | `dict_entry.constituent_forms`, `.variants` | one `<input class="edit-input">`, comma-separated |
| `tokenize` | 1 | `sentence.words` | one `<input>`, re-split on save |
| none | 3 | `word.morphemes`, `dict_entry.allomorphs`, `.pinned_examples` | hand-written surfaces, no declaration |

`comments` and `translations` produce the same editor from two code paths.
`translits` stores the same list shape and produces a different one. The three
undeclared fields are the same shape again and are drawn by hand.

> **Deferred by decision, v3.14.408** (D62 B). Declaring presentation across all
> 83 field entries prevents a sixth treatment, and there is no sixth field
> queued. The declaration lands in the first version that adds an array-shaped
> field, and converts these 21 with it; the trigger is **D28** or **D37**. The
> vocabulary that version should use is worked out in D62 §4.

#### L-044 · B · `list` edits an array through one text box

`renderField`'s `list` branch emits a single text input. `LingCoT.html:10299`
joins on render (`(cur || []).join(', ')`) and `:10533` splits on read
(`.split(',').map(x => x.trim()).filter(Boolean)`).

Consequences, all measurable:

- A value containing a comma cannot be entered.
- There is no per-element identity, so no per-element provenance. This is the UI
  half of **B-139**, which records the same fact from the data side for
  `source_ids`, `variants` and `constituent_forms`.
- `variants` and `constituent_forms` are the only list fields with no add or
  remove control, so I2's descriptor does not reach them.

> **Absorbed into D62 A, v3.14.408.** Not closed by a fix, closed by being the
> same task as something else: the comma and the missing per-element provenance
> are both consequences of the control, and one control change answers both.
> `dev/design/D62_list_field_presentation.md` §2.

#### ~~L-045~~ · B · Four row collections, four CSS treatments, two with none · ✅ v3.14.407

Measured in `LingCoT.css`:

| rule | declaration | axis |
|---|---|---|
| `.translit-row` | `display: flex; align-items: center; gap: 8px` | horizontal |
| `.allomorph-row` | `display: flex; align-items: center; gap: 6px; margin-bottom: 5px` | horizontal |
| `.sel-row` | `display: flex; align-items: center; gap: 6px` | horizontal |
| `.comment-row` | `display: flex; flex-direction: column; gap: 4px` plus border, radius, padding, background | vertical, boxed |
| `.translation-row` | identical to `.comment-row` | vertical, boxed |

Two visual families, not five variations. Three collections lay their fields out
in a line with no container; two stack a textarea over a meta line inside a
bordered card. The two that share a declaration are the two that already share an
editor shape (L-043). No `*-rows` container has a rule of its own.

> **Closed v3.14.407.** `ROW_EDITORS` declares `layout: 'inline' | 'stacked'`.
> `.row-ed`, `.row-ed--inline` and `.row-ed--stacked` carry the layout;
> `.row-x` and `.row-add` are one remove and one add control for all five
> collections. The five per-collection layout rules are gone, and so are the six
> borrowed button rules. The per-collection classes stay, because the reader
> queries them.

*Re-measured v3.14.406. The first version of this table was wrong: the selector
match was not anchored, so `.translit-row` picked up the declaration of
`.translit-row .translit-label` and reported `width: 150px; flex-shrink: 0`. That
is the label's width, not the row's. The corrected reading is a stronger finding,
because two families that differ by layout axis are a clearer divergence than five
unrelated rules.*

Button classes, same file:

| class | defined |
|---|---|
| `.translit-remove`, `.comment-remove`, `.translation-remove` | yes |
| `.allomorph-remove`, `.sel-remove` | **no rule exists** |
| `.translit-add-btn`, `.comment-add-btn`, `.translation-add-btn` | yes |
| `.allomorph-add-btn` | **no rule exists** |

The allomorph and selection remove buttons therefore carry
`class="translit-remove"`, and the allomorph add button carries
`class="translit-add-btn"`. Every row collection is styled by a class named after
one of them. `INPUT_UX_AUDIT` §3.1 noted the markup side; the CSS side is why it
had to be that way.

#### ~~L-046~~ · B · The read-only side diverges further, and three wrappers are unstyled · ✅ v3.14.407 · v3.14.410

Five `render*View` functions serve the same list shapes.

| class | emitted | CSS rules |
|---|---|---|
| `.comments-view` | yes | **0** |
| `.transliterations-view` | yes | **0** |
| `.translations-view` | yes | **0** |
| `.allomorphs-view` | yes | 1 (`display: flex; flex-direction: column; gap: 2px`), 1000 lines away in the dictionary block |

Three wrappers exist in the DOM and carry no styling. `selector_audit_test`
checks the opposite direction (a selector nothing emits) and cannot see this.

Row typography for the same data shape, re-measured v3.14.407:

| row | row rule | secondary part |
|---|---|---|
| `.comment-view-row` | `padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem` (`:last-child` drops the rule) | `.comment-view-meta` `0.77rem`, muted, `margin-top: 3px` |
| `.translation-view-row` | `padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; font-style: italic` (`:last-child` drops the rule) | `.translation-view-meta` `0.76rem`, muted, `font-style: normal` |
| `.translit-view-row` | `display: flex; gap: 8px; font-size: 0.87rem; padding: 3px 0` | `.translit-view-label` `0.75rem`, weight 600, muted, bordered pill |
| `.allomorph-view-row` | `display: flex; gap: 8px; align-items: baseline; font-size: 0.85rem` | `.allomorph-view-form` mono `0.83rem`; `.allomorph-view-env` muted `0.78rem` |

Four sizes for one data shape: 0.88, 0.9, 0.87, 0.85 rem. Two rows separate their
elements with a rule and two with whitespace. Two render the secondary part below
the primary and two beside it. One row is italic, one part is monospace, one label
is a pill. No declaration in `field_spec.js` records which a list field should
get, so the choice lives only in whichever `render*View` was written at the time.

*This table was wrong until v3.14.407, in the same way L-045's was: the
unanchored selector match reported `.comment-view-row:last-child`'s
`border-bottom: none` as the row's whole rule, and `.translit-view-label`'s
declaration as `.translit-view-row`'s. The corrected reading is a sharper
finding — the divergence is four sizes and three separator conventions, not two
plain rows and two decorated ones.*

> **Half closed, v3.14.407.** All four view containers now share one rule. The
> `.allomorphs-view` row of the table above was misread on the first pass as a
> row layout; it was a column, the same stacking the other three needed, so
> there is nothing to override. `row_editor_test` now counts declarations per
> selector, not just presence, because the dead duplicate this correction
> removed was invisible to a presence check. **The typography half is answered
> by D62 C, v3.14.408** and **built v3.14.410**. `LIST_VIEWS` declares
> `primary`, `secondary` and `emphasis`, and reads `layout` off `ROW_EDITORS`
> rather than restating it. One `.lv-row` component, four sizes down to two,
> transliteration text in `--mono` for the reason the allomorph form already
> is. The four per-collection row classes are deleted rather than kept: they
> were queried by nothing, and four names with no rule is this finding one
> level down. **The typography half is still open** and is a design question rather
> than a defect, carried as the open remainder of this finding.

**What these four have in common.** The data model says list; the presentation
layer says six things. I2 (v3.14.404) unified the *behaviour* of five row
collections behind one descriptor and deliberately left markup and CSS alone. The
descriptor is where a presentation declaration would go if these are to converge.

---

## 3. Conflicts, still live

*Where two documents, or two code paths, disagree. Added v3.14.229 by reading
every `L-nnn`, `D-nn` and open `B-nnn` together and asking which touch each
other. The thesis held: a backlog filed one item at a time contradicts itself
wherever the facts moved after an item was written — and **six of the eighteen
were settled by D50 stage 4 completing at v3.14.249**, which is the case for
doing format work as one migration.*

**Re-checked v3.14.315, all five live then; ⑪ and ⑰ settled at v3.14.392–393
(see their bodies).** Each against the code: ⑥
`field_spec`'s word order and `renderWordEdit`'s DOM order still differ, and
neither is L-013's observed one · ⑦ `wantedMark` has four sites and none is
`renderWordEdit` or `morphEditRowsHtml` · ⑫ the miscount survives in
`dev/design/file_layout_options.md:27-29` verbatim. **⑪ and ⑰ were the two whose
resolution depended on an act rather than an argument, and the act was `git
init`:** ⑰ needed the disclosure run and signed, which happened at v3.14.392, and
⑪ needed the archive's property to survive on a clone, which v3.14.393 did by
replacing it rather than by freezing anything.

**⑪ and ⑰ moved to §5.2 at v3.14.397, and the move is the point.** Both were
settled at v3.14.392–393 and both were left sitting here under a heading that
says *still live*, with a SETTLED banner inside them — which is **exactly the
failure §9 records about this document**: *a closed item under a live heading,
and the heading is what gets read.* Two settled bodies were 86 of this section's
lines. **Three remain: ⑥, ⑦, ⑫.**

### ⑥ Two shipped word field orders, neither matching the observed one

`field_spec.js` declares `word: [form, morphological_parse, morphemes,
part_of_speech, gloss, lemma_id, transliterations, …]`, commented *"first,
because everything below derives from it"*. `renderWordEdit` draws translit,
gloss, POS, lemma, parse. L-013's observed order is **translit, POS, parse,
morphemes, lemma, gloss**. All three differ.

`FIELD_SPEC.word` embeds the exact claim L-013 disproved, and it is the array
D34 is specified to count from.

**The second half of this finding is now false, and how it became false is worth
more than the finding.** It read: *"`FIELD_SPEC.word` is consumed by nothing.
`formBodyHtml` renders five levels from the table; `renderWordEdit` hand-writes
its own markup and was excluded from both D47 and D48 stage B."* True when
written. Since **v3.14.262** the word level declares its element ids in the table
(`domId`), `surface_conformance_test.js` holds the markup to them, `applyForm`
writes through it and `field_spec_test` exercises `tierOf('word', …)`. The table
is consumed without the conversion, which is why §4 row 2 was re-weighed and
the conversion is now optional.

**What survives:** the three orders still differ, and D48's estimate that *"D46
may reorder the word level, which is a change to one array"* is still false — it
is markup **and** the array. The ordering half of this conflict is untouched by
v3.14.262 and is what D46 has to answer.

### ⑦ B-099 is closed on a claim that is not true at the word or morpheme level

> **Still live, and now guarded open (v3.14.310).** `wantedMark` has four sites
> in `LingCoT.html` — its definition, `renderField`, and the dict-entry path.
> Neither `renderWordEdit` nor `morphEditRowsHtml` calls it. And
> `required_marker_test.js` asserts *"the wanted mark is applied in one place
> only"*, so the gap is now held in place by a guard: closing this conflict means
> editing that guard as well, which is the right shape but has to be said.


D48 stage C: *"a `core` field that is empty is marked. One rule, every view,
rather than a decision per box."* `wantedMark()` is called at exactly two sites,
`renderField` and the dict-entry path. `renderWordEdit` and `morphEditRowsHtml`
call neither.

So `morphological_parse`, `part_of_speech`, `gloss` and every morpheme
`gloss` / `part_of_speech` / `type` — **the densest concentration of `core`
fields in the app** — carry no mark. An unfiled regression hiding behind a closed
bug, and D34's counter would report as missing exactly the fields the view never
asked for.

**Sharpened v3.14.304, and one of the four is not a gap at all.**
`morphological_parse` is empty on **301 of the 310 navigable words** in the two
live corpora, because `joinParse` returns null for a monomorphemic word and most
of them are. Marking it as wanted would nag on nearly every word in the app;
D34's counter asks the derivation instead (stage B, rule 1). The mark's absence
on the other three is still the regression this conflict names.

### ⑫ The interchange decision was taken on a miscounted key

> **Narrowed v3.14.310.** `DEV_PLAN.md` no longer carries the miscount; only
> `dev/design/file_layout_options.md` §0 does, verbatim. The re-count in this
> conflict is itself now superseded: `chinese-test` has **two** entries carrying
> `homograph` (assigned by `numberAllHomographs`, B-143 ✅ v3.14.290), against
> the "still zero" recorded here — and the live `turkish-test` dictionary is a
> **0-byte file**, because that corpus has no dictionary yet (0 `dict_id` and 0
> `lemma_id` references in it, so nothing was lost). Any third count has to name
> which corpus it is counting.


`file_layout_options.md` §0 says `type` is null on 29 of 75 dictionary entries,
therefore `(normForm, type, homograph)` is *"an intention, not a key"*. The nulls
are exactly the lemma records, which have no `type` by design.

**Re-counted at v3.14.250**, on a dictionary that has since grown and been
migrated. The discriminator is `record_type` (B-119, v3.14.238), not `record`.
85 rows: **33 lemma records, none carrying a `type`**, and **52 of 52 sense
entries carrying one**, being 34 `word`, 17 `bound.morpheme` and 1 `root`.
Still zero `homograph`. The structure of the correction holds on the larger
dictionary; only the totals moved.

The silent-wrong-link argument against interchange stands on its own and the
decision should not be reopened. But one of its two supporting measurements does
not survive checking, and it is the one quoted into DEV_PLAN §1, where both it
and `file_layout_options.md` §0 still carry the miscount.

## 4. Combinable work


*Re-checked and condensed v3.14.317. Where one pass closes several items. **A
done row is one line**, the same rule the findings table follows; the five still
open keep their reasoning, because that is the instruction for doing them.*

| # | one pass | state |
|---|---|---|
| **1** | one format decision then one migration, carrying ten items that change what is on disk | ✅ **v3.14.233–249 as D50.** The highest-value consolidation on the board, and it paid: six of §3's conflicts were settled by the migration completing, and the live corpus went **104,991 → 85,677 bytes, −18.4%**. The merge was reversed; C19 and D26 were *measured out rather than built* |
| **3** | one `linkDict()` chokepoint | ✅ **v3.14.260 as `linkTo()`**, finished v3.14.294 with B-123's backfill — which runs *through* it rather than beside it, so the rule was unified before 16 more unsigned links were written |
| **4** | one sweep of the nine save handlers | ✅ **v3.14.262, and not as a sweep**: assignment moved into one writer (`applyForm`) driven by the field table, so there was nothing left to sweep |
| **5** | one re-measurement pass on the post-interning shape | ✅ **superseded v3.14.310 by re-measurement rather than by the pass** — D33 retired, B-116 and B-053 closed, L-002 moot |
| **7** | one lemma-group decision | ✅ B-106 · D35 B5 · **B-114 v3.14.293** · D49 ungated v3.14.282 |
| **8** | one push surface | ✅ **v3.14.269–271 as D51**, and it grew past this row: drawing the routes found what the audit did not have — a word not on screen could not be added at all (**B-140**). **None of the five UX audits held the missing route**, because an audit describes the surfaces that exist |
| **9** | one discriminator decision | ✅ **v3.14.237–238**, and the answer was neither option: the app had two vocabularies, so `record` became `record_type` |
| **2** | **convert `renderWordEdit` to `formBodyHtml`** | **open, and no longer the highest-leverage item.** v3.14.262 gave the word and morpheme surfaces declared element ids held to the table by `surface_conformance_test`, which was most of what a conversion would buy. What is left is conflict ⑦'s marking and L-013's order — and L-013 is waiting on a second observation, so this waits with it. *Re-checked v3.14.317: `renderWordEdit` is still hand-written.* |
| **6** | **`data-original` as the shared substrate** | ◑ B-113 ✅ v3.14.266 gave the predicate — current DOM value ≠ stored value. **I5's dirty-state tracking does not exist**: *re-checked v3.14.317, zero references to any dirty flag in `LingCoT.html` or `events.js`.* D46 question 3 rides with it |
| **10** | **D32 and D31 as one spec** | ◑ **and they were not specced together.** D32 ✅ v3.14.303 alone; D31 was reduced at v3.14.273 and its ▲▼ ordering control still does not exist (*0 references, v3.14.317*), waiting on I2 |
| **11** | ✅ **one fixture pass — done v3.14.384** | and it closed four findings at once (L-007, L-019, L-021, L-042), which is what this row predicted a combined pass would do. `samples/` is the two live corpora, byte-identical; the two Korean guards were re-pointed at v3.14.385; D58 §§8–10 hold the account. **Two of its cheap additions were not made**: a non-empty lemma residue field and a `prov_history` longer than 5 still have no instance anywhere |
| **12** | ◑ **one identity/read-view sweep** | **B-115 ✅ v3.14.309 — and closing it did not close I13**, which is the useful result. The shared piece is the sortable header *cell*; `viewHeader()` still has 19 call sites and *none in `participants.js`* (v3.14.317), and `.ann-view-topbar` / `.src-view-topbar` are still two rules. I12 is partly built, I14 untouched. The twins had less in common than the pairing implied |
| **13** | ✅ **`git init` — done v3.14.391–392**, and the transition handled at v3.14.393 | **The prediction was half right, and the wrong half is the instructive one.** `git init` landed without the freeze, and the suite did NOT break the day after: `doc_integrity_test.js` already skipped the archive checks honestly on a clone, so what actually happened was 86/0/**1**, measured on a real clone the same hour. The freeze was never the only move — §8b keeps the *property* on any clone by asking git instead of the archive, so PIPELINE 2.1's freeze and the **280 MB** are now a question about disk rather than about a guard. **S1 closes; S6 does not** |

---

## 5. Ledgers

### 5.1 Findings closed

*Every finding that is closed — 38 of 46, and none is half any more. The other 8 are open: §1 ranks them and §2 carries their bodies, so repeating them here would be a second place to keep in step. The line each came from is a field rather than part of the id, so an item can move between subjects without going stale. A closed body is removed at the comb after it closes (see §2); the full text is in `dev/archive/changes/`.*

| L | line | finding | state | what survives |
|---|---|---|---|---|
| **L-001** | G1 · S2 | A 300,000-word glossed corpus cannot be loaded or saved at all | ✅ v3.14.253 | — |
| **L-002** | G1 | D33 measured a bare corpus and reported it as annotated | ✅ moot v3.14.273 | the rule: a scale figure names the corpus it was taken from, or it is not a figure |
| **L-003** | A · S2 | The translation language is drawn, typed, stamped, and discarded | ✅ v3.14.262 | B-072's other half |
| **L-004** | A · S2 | Editing a dictionary headword discards the change and stamps provenance for it | ✅ v3.14.262 | — |
| **L-005** | A · S2 | The current lemma format is undeclared, and two guards fail on real data | ✅ v3.14.238 | — |
| **L-007** | E | The fixture is weaker than the guards it feeds, and in a format the app no longer writes | ✅ v3.14.384 | the direction that closed it: **the fixture was refreshed, not the guards weakened**. B-128's one loader (v3.14.245) was the guards' half; the swap was the data's |
| **L-008** | C · S2 | Search folds object-language forms with `toLowerCase`, and misses real tokens | ✅ v3.14.279 | the count it corrected: **four** notions of "same form" by design, and four in the source |
| **L-009** | C | 82 of 83 dictionary links carry no provenance at all | ✅ v3.14.260 | — |
| **L-010** | G1 | Half of every annotated word is a record of who typed it | ✅ moot v3.14.310 | the method: price the record against the annotation, not against the file — the ratio is what moved, and only a re-measurement could show it |
| **L-011** | C | Auto-linking is reachable from exactly one place | ✅ v3.14.294 | the measurement that made a backfill safe: every *touched* word whose form has an entry was already linked, so all 16 misses were untouched tokens carrying nothing to conflict with |
| **L-012** | C | Two functions write the same field under opposite rules | ✅ v3.14.260 | — |
| **L-014** | G1 | The per-keystroke scan is real, and B-053 names the wrong pool | ✅ v3.14.309 | superseded by **L-028**, which found the per-record cost this finding looked for and missed |
| **L-015** | G1 | D33's own trigger for writing the id-sort guard has been met | ✅ v3.14.249 | — |
| **L-016** | A | A word save silently deletes morpheme keys the table declares | ✅ v3.14.236 | **B-134**: the morpheme revision trail, a key `mergeMorpheme` never wrote |
| **L-017** | A | Fields declared fillable that no editor draws | ✅ v3.14.262, less one | B-093 / B-045, the transliteration half — under **D32** |
| **L-020** | A | The legacy tier, per field | ✅ v3.14.249, **deleted v3.14.386** | the tier was created so a consumer built from the field table could not be blind to a key on disk (PRACTICES §5). When its fourteen members lost their last writer it became the failure it existed to prevent, running the other way, and went with them (D58 §3) |
| **L-021** | A | The sample swap would silently delete the suite's only dependency coverage | ✅ v3.14.384 | B-125 made the guard fail loudly rather than pass on nothing (v3.14.250); the swap supplied the data. **The guard half landed 134 versions before the data half**, which is the gap this row is worth keeping for |
| **L-042** | E | The suite's tally depends on which corpus resolves | ✅ v3.14.384 | `metadata.tracked` stripped at v3.14.379 and `samples/` is now the live corpora, so the two tallies are one run. The property itself does not go away — a tally names the data it was taken against, which is **B-168**'s lesson one level up — and the swap procedure's step-1/step-4 comparison is where it is now asserted rather than remembered |
| **L-023** | C | The stamping system had ten writers and one of them interned | ✅ v3.14.261 | `stampField` is the only writer now (**B-137**) |
| **L-024** | C | A list field's provenance could only name whoever touched it last | ✅ v3.14.261, less B-139 | **B-139**: string lists still cannot carry a per-element stamp |
| **L-031** | C · S2 | A part of speech nobody chose, signed by the annotator | ✅ v3.14.335 · **B-172** | the rule: a suggestion belongs in the placeholder, because a value in the box is saved as a decision |
| **L-032** | C · S2 | Filling somebody else's dictionary entry leaves no provenance | ✅ v3.14.335 · **B-173** | the asymmetry that survived it: the values are the pusher's, the link is derived — two different questions |
| **L-035** | C | A dictionary load bulk-filling the corpus before anyone had decided anything | ✅ v3.14.348 · **D60**, **B-180** | it computes and shows; grouped by form, 19 writes become 3 decisions |
| **L-036** | C · S2 | Section merge wrote to the tree on click; Cancel left paragraphs under two parents | ✅ v3.14.343 · **D59**, **B-178** | the fix was one commit model, not a confirm on the second one |
| **L-027** | C · S2 | The Python side could not say a value was machine-made | ✅ v3.14.365 · **B-157** | the audit's first pass filed it against the app and would have changed correct code to suit a broken writer; reading the comment beside it is what caught that. Two things the write-up did not have: the unstamped element is RE-STAMPED as the saver's on the next save, and the CLI's `label` put it outside `_listKeyOf`'s identity, which made that certain |
| **L-040** | B | Ingest mints "this word is monomorphemic", then defends it against the annotator | ✅ v3.14.360 · **B-191** | the measurement moved the target twice: the morpheme was not empty (301 of 365 carry the gloss), and the gloss was not being lost — it was being rescued by accident and stored as the annotator's own |
| **L-038** | D | Every outcome, including "Save failed", was 2.5 s of the palette's quietest text | ✅ v3.14.358 | severity is derived from the icon the caller already sends, so nothing had to be told twice — and a failure does not expire |
| **L-033** | C · S1 | A second corpus door that skips the journal | ✅ v3.14.336 · **B-171** | the shape, not the patch: two doors into one act, closed by making one of them the only one |
| **L-018** | E | The suite costs 17.9 s, and one guard is 80% of it | ✅ v3.14.338 | the smaller half was the real one: `undefined_call_test` did its work on every clone and exited 2, discarding it. Its self-proof is constructed now, not archived |
| **L-019** | E | The two disabled guards are gated on a filename, and two thirds of them do not need it | ✅ v3.14.385 | the split is BY FILE, because `run_all.sh` reports one state per file. Both halves ran again when the goldens were rewritten against the shipped corpora — **265 versions dark**, which is what a guard that disables itself honestly still costs |
| **L-025** | E | `modules/search.js` documents an architecture that was deleted | ✅ v3.14.338 | the danger was never the prose: `autolink_test` attributes code to the nearest preceding `@fn`, so an orphan marker hands the next block to the wrong name |
| **L-026** | A | The autosave debounce is documented three times and two are wrong | ✅ v3.14.337 | — |
| **L-028** | G1 | The gap counter pays for the field table once per record, and the panel asks twice | ✅ v3.14.337 | the memo, not the walk: one slot against two questions meant every repaint paid twice — `gapRows()` repeated 2.68 → **0.156 ms** |
| **L-029** | A | Dead code, verified against the interpolation trap | ✅ v3.14.337 · **B-174** | the finding was right twice over: the duplicate id was a live bug, not a styling untidiness — `getElementById` took the header and the annotator preview overwrote the app title |
| **L-037** | D · S2 | Machine translations are indistinguishable from human ones | ✅ v3.14.338 | setting a class nothing had set showed the rule was wrong too: dimming means ABSENT on that card, so it takes D43’s `·auto` mark |
| **L-034** | B | The unit of work is the token, and 44% of the work is re-work | ✅ v3.14.416 · **D40** | offered, never applied: a copy is a chip or a reviewed panel row, fills only empty fields, and names its source in `from` |

### 5.2 Conflicts settled

*The 15 settled. The three live ones — ⑥, ⑦, ⑫ — are in §3 with the whole argument, because that argument is the instruction for resolving them. **⑪ and ⑰ moved here at v3.14.397**, having been settled at v3.14.392–393 and left under §3's live heading until this comb.*

| # | conflict | state | what survives |
|---|---|---|---|
| **①** | B-116's numbers pre-date interning, and the whole "before the gates" section rests on them | ✅ v3.14.231, re-measured through v3.14.250 | L-001's second half — nothing sizes the string before building it |
| **②** | The append-only journal is incompatible with the interning that just shipped | ✅ v3.14.235 | — |
| **③** | Merging the dictionary into the corpus makes every dictionary edit rewrite the corpus | ✅ v3.14.233 | — |
| **④** | Interning moved the attribution dependency onto the one file the layout decision keeps separate | ✅ v3.14.234 | the rule: a loss is graded by what it costs — a missing journal is refused, a missing companion warns. **B-130** was the same fact one level down |
| **⑤** | `field_prov` is simultaneously the thing to delete and the thing to add to | ✅ v3.14.231 | "remove `field_prov`" is no longer an available branch; interning already externalised it |
| **⑧** | D34 cannot be built as specified | ✅ **v3.14.304** | resolved in D34's spec, and by dissolving the question: the tier was never the right instrument |
| **⑨** | Gate 1 says it needs no code; gate 1's blockers are code | ✅ v3.14.250 | — |
| **⑩** | Gate 1 produces a hand-annotated artefact in a shape two open decisions are about to change | ✅ v3.14.249 | — |
| **⑬** | Flattening to real JSONL breaks D33's "never sort by id" invariant | ✅ v3.14.249 | deferred with the flatten; the guard is written |
| **⑭** | F2 has three live, mutually exclusive dispositions | ✅ v3.14.299 | building it collapsed them; the "third scan on the hot path" objection was answered by joining `tagUsage`'s existing walk, and again by the v3.14.309 cache |
| **⑮** | F5 was retired by a correction that only addressed half of it | ✅ v3.14.300 | delivered as a per-segment offer strip and one bulk fill, not the in-input ghost text F5 asked for — the substitution is recorded in D53 stage E |
| **⑯** | The `--slow` flag is rejected and re-proposed in two current documents | ✅ dissolved v3.14.269 | the flag shipped and PRACTICES documents it; the rejection text is gone, so there is nothing left to re-litigate |
| **⑱** | B-037 sits at gate 4 and is the cause of a gate-1 blocker | ✅ v3.14.237 | — |
| **⑪** | Freezing the archive breaks the two mechanisms that substitute for git | ✅ **v3.14.393** | it predicted the state `git init` produced, and was measured on a real clone: **86 passed, 0 failed, 1 disabled**. Resolved by replacing the property rather than freezing anything — `doc_integrity_test.js` §8b asks GIT whether every **Touched:** file really changed, which works on any clone. **Its one wrong word was *silent***: the runner names the disabled guard every run. The archive checks are kept until several versions carry their own commit; PIPELINE 2.1's freeze and the 280 MB are then a disk question, not a guard's hostage |
| **⑰** | The privacy constraint and the version-control plan carve out the same file | ✅ **v3.14.392** | settled by the act it was always waiting for. `ship_disclosure.py` ran twice before the first commit, printed both participants files field by field, and traced two names to **58 occurrences across 20 files** — the number that shows why an exclusion was never the answer. Signed off 2026-09-02. **"No guard checks its contents" is now the point rather than the defect**: a guard that judged them would be deciding what a person may publish about themselves. What the tooling owes is that nobody publishes unknowingly |

### 5.3 What the passes settled

| | |
|---|---|
| settled by checking rather than reasoning | **②** assumed journal records must reference the event table · **③** recommended a merge without pricing its save cost. Both were argued the wrong way round |
| settled by D50 stage 4 completing | ①'s numbers · ②'s one surviving obligation · ⑨ · ⑩ · ⑫'s vocabulary · ⑬'s guard |
| combinable passes completed | **1** (D50, v3.14.233–249) · **3** (`linkTo`) · **4** (`applyForm`) · **5** (superseded by re-measurement) · **7** · **8** (D51) · **9** |


---

## 6. Checked, and found correct

*Three waves of "this is fine", merged and ordered by subject rather than by
date, so the next pass has one place to look before re-opening something. Where
two waves checked the same thing the later measurement stands and the earlier is
dropped. Each row names the build it was taken at.*

### 6.1 Data and references

| checked | build | result |
|---|---|---|
| dangling references, both corpora | **333** | `turkish-test` **zero**. `chinese-test` one lemma id missing, referenced twice — the documented B-154 state, with `repairDanglingLemma` offering the fix in the UI |
| duplicate and missing ids, orphan lemmas | 221 | zero of each. LINKING_AUDIT §0's headline held 116 builds |
| round trip | 221 | both corpora are stable fixed points; a load-then-save changes nothing but the sample's ten legacy lemma rows, losslessly |
| personal data | 221 | nothing needing redaction in either corpus; all provenance names are test or automatic identities. The sample participants file is the exception and is conflict ⑰ |
| `.gitignore` | 221 | covers `source/models/` (601 MB of CC-BY-NC weights), `dev/archive/`, `dev/_to_delete/` — asked of `git check-ignore`, not read |

### 6.2 Behaviour and surfaces

| checked | build | result |
|---|---|---|
| `data-action` orphans | **333** | none. All 22 views rendered, all 56 emitted actions cross-checked. **About 22 *look* unhandled** to a grep for `case 'x'` because dedicated delegated listeners claim them via `closest('[data-action="x"]')` — a future auditor will "find" these and be wrong |
| destructive confirms | **333** | state the blast radius in numbers (`confirm.retokenize.loses_annotation` names up to eight lost tokens). L-036 and the section-delete message are the two paths that fell out of the pattern, not evidence against it |
| `.offer-chip.offer-taken` | **333** | a filled accent, and its `cursor: default` was deliberately removed (D55). Reduced opacity means disabled throughout this stylesheet; dimming it would re-file B-108 backwards |
| `fillParseFromLexicon` | **333** | skips ambiguous segments and uses `'fill'` mode, sparing saved values |
| `derivePreviewHtml` | **333** | shares `joinParse`/`joinGloss` with the writer, so the promise and the write cannot diverge — true by construction |
| `mutate('dict', [])` / `mutate('corpus', [])` naming no records | **333** | both follow `journalReset()`; `autosave_target_test` asserts exactly this |
| `section.ingest` / `paragraph.ingest`, `core` with no writer | **333** | `stored: false` controls, excluded by `isCounted` |
| the retired notion of "same form" | 221 | ANNOTATION_FILL's exact-`===` regime is gone: `alignTokens` runs exact first and folds the leftovers, so exact is a preference inside one answer rather than a competing answer |
| both identity modals | 221 | all 16 declared `modalId`s resolve to exactly one element |
| dark mode | 313 | all 23 `:root[data-theme="dark"]` rules target a selector with a light counterpart; B-002's class has no residue |

### 6.3 Cost — measured at 212 tokens and at 20–100× — v3.14.313

**Nothing on an interactive path is slow, and the evidence is that it is flat.**

| | 212 tokens | scaled |
|---|---|---|
| every view renderer, cache bypassed | slowest `sentence-edit` **0.94 ms**, most under 0.25 | at 21,200 only `document` (10.4 ms), `document-edit` (1.8), `dict-browse` (1.4) pass 1 ms — `sentence-edit`, `word-edit`, `dict-edit`, `sentence`, `word` are **flat across 100×**, the evidence they are scoped to the record being edited |
| a full `render()` | 0.68–0.76 ms | unchanged at any size |
| every per-keystroke path | `syncMorphemeRows` 0.52, `refreshMorphSuggest` 0.12, `refreshLemmaStrip` 0.020, `refreshDerivePreviews` 0.014, `refreshChipsFor` 0.009 | all **fall** at 20×: 0.39, 0.05, 0.011, 0.008, 0.006 |

**Structural, and therefore durable:** the nested-scan candidates are already
Maps (`lookupDict`, `lemmaById`, `findWord`, `findSent`, `findDictEntry`) —
B-052's fix holds, and the remaining linear dictionary scans are on delete and
journal replay, not an interactive path. **No second tree walk exists**: the nine
`for (const d of S.docs)` loops in the search modules are Enter-triggered and
memoised on `_dataGen`, and `annotationGaps` demonstrably reuses `_navIndex`'s
output, which is why its cost (L-028) is lookup overhead rather than a walk.
Index construction is single-pass; nothing is quadratic on load (221).

### 6.4 The code itself — v3.14.313

**No helper is duplicated** between `LingCoT.html` and a module — every top-level
function name diffed against the other, zero overlap. **Python has no dead
functions**: every module-level def in nine files is reachable; the five that
looked otherwise were `BaseHTTPRequestHandler` overrides and an
`atexit.register` reference passed without parens. **TODO/FIXME residue is nil**
under `source/`, and dozens of deliberate tombstones were checked — each
correctly says the thing is gone, with a guard keeping it gone. **The rot is
concentrated in one file**, and that is L-025. **No dead identifiers in the
guards** (221): every identifier asserted by every guard regex resolves against
the current source; the one apparent miss was a deliberate test input.

---

## 7. What no pass could do

*Merged from three sections. Not to be read as clean — an unexamined area is not a checked one.*

### 7.1 The original lines, v3.14.221

The guard suite was run against a snapshot missing `README.md`, `LICENSE.txt`,
`.gitignore` and `dev/edit_log.md`, so five guards failed on absent inputs rather
than on defects. That is an artefact of the snapshot — but it exposed a real
inconsistency: those five crash with a Node stack trace where `run_all.sh`'s own
protocol says a missing input should exit 2 as DISABLED.

The pywebview bridge cost remains unmeasured, as it was for D33. The JS half is
now known — `JSON.stringify` of a 50,000-word glossed corpus takes 764 ms, which
consumes half the 1.5 s autosave debounce before a byte crosses — but the
transfer itself needs the real app.

Lines D and G2 were not run, for the reason in §0.

### 7.2 The code audit, v3.14.313 — the bridge dropped partway through every pass

The bridge dropped partway through every pass. Not completed, and **not to be
read as clean**: the duplicate-definition and unreachable-branch sweeps;
locale-key residue; write-never-read state beyond `word_index`; the numeric
re-measurement of eight comment claims; the inline-`style=` census and the
static-shell unreachable-id sweep; the five silent `except: pass` handlers in
Python (located, call sites unread); duplicated logic across the three CLI
scripts; and the guard suite's copy-pasted-helper analysis.

### 7.3 The fill/UI/backend/timing pass, v3.14.333

- The pywebview bridge is deliberately absent from `_dom.js`, so L-033 is read
  rather than executed: the door was traced in source, not opened.
- No pinned examples exist, so L-039's failure mode is reasoned, not observed.
- Timing findings rest on one 22-minute session by the app's own author. A
  session by someone else would be worth more than another pass over this one.

---

## 8. Notes kept from the passes

### 8.1 What each wave examined

**v3.14.221, the original six lines.** A (the record), B (the order of work),
C (fill, matching, linking), E (the toolchain and its guards), G1 (cost at
scale), F (disposition). D (input surfaces) and G2 (structure) were deferred
deliberately: both read code that was about to change. Twelve audits written
against v3.14.21–v3.14.158 are superseded. The plan those six lines came from was
not kept — this file replaced it, and the pointer to it dangled for 141 versions.

**v3.14.313, the code audit.** Six parallel passes. Costs at two sizes — live
`chinese-test`, 212 tokens, and a 4,240-token corpus built by cloning its
sections **and rebuilding the indexes through `buildCorpusIndex()`**. That clause
is not decoration: the first run grew the tree without reindexing, so `tally`
could not resolve most ids and every number came back *smaller* at the larger
size. A growth harness that does not rebuild what the app rebuilds measures
nothing.

**v3.14.333, fill/UI/backend/timing.** Every propagation and link path outward
from `_dictFillForForm`, `backPropagate`, `_deriveWordFields`, `_fillMorphRows`,
`offerWrites`, `linkTo`, `createEntries`, `autoLinkWord` and
`_resolveOrCreateLemma`; every `render*`, the `events.js` dispatch and every
`en.json` string, for feedback and affordance; every delete and edit path with
`danglingCompanions()` run against both live corpora; and the timing of every
fill against `logs/app_2026-08-31_131943.log`, one real 22-minute session.

### 8.2 The first session on the journal, 2026-08-30

The first real annotation session run against D50's journal, and what it
established: the journal carried the session without a full rewrite, compaction
fired on the thresholds it was given rather than on a guess, and the provenance
thinning held — **19 inlined annotator names → 0**. What is lost is per-field
granularity for sessions since v3.14.226, and it cannot be recovered because it
was never written; object-level `prov` and `prov_history` are intact.

### 8.3 The guard-suite streamlining proposal, refuted by mutation

*Condensed v3.14.317. The measurements moved to **L-018** and **L-030**, which
carry the current ones; what is kept is the reasoning, because it is the part
that does not go stale.*

**Proposed:** merge seven guards into five, 61 executables → 53, 18.4 s → 4.0 s.
**Done:** nothing merged, and the time came from elsewhere.

**Every proposed merge loses coverage, tested by deleting the second guard and
mutating what it covered** — not by reading headers, which is how the proposal
was made and why it was wrong. The headers describe adjacent topics; the
assertions do not overlap. `render_untranslated` holds the only assertions that a
placeholder and a real translation both reach output (3); `dep_root` holds
`depRelOf` entirely (16); `affordance` the scoping rules and the inline-badge
sweep (10); `ui_wiring` the delegation table and the `mutate()` chokepoint (12);
`prov_clock` the local-clock rule entirely (21). `style_wiring_test.js`, named in
the original row, **does not exist**.

**The executable count was never what cost the time.** One guard was 75% of it,
and `--slow` moved it — so the saving the proposal wanted came from a flag, not
from deleting assertions.

**Re-verification found two hollow guards, both fixed v3.14.254.**
`suggest_mechanism` set its fixture's POS to the same value the offer delivered,
so the assertion held whichever gate the code used and **reverting B-082 verbatim
left the suite green** (B-131). `prov_clock`'s rollover check ran in the
machine's own timezone; B-105 is a west-of-Greenwich bug, so **on a UTC CI box
nothing behavioural guarded it** (B-132). It now runs the helper in a child
process either side of Greenwich.

**The method is what to keep.** Deleting a function body flatters every guard
that greps a body; prepending `return null;` leaves the text intact and is the
harder test. Score per guard, not suite-wide.

---

## 9. How this audit has been wrong

*Kept because the pattern repeats, and because a document of record that hides
its own corrections is asking to be trusted more than it has earned.*

| when | what happened | the rule it produced |
|---|---|---|
| v3.14.310 | Five items were answered and still written as open — L-011 and conflicts ⑧, ⑭, ⑮, ⑯ — and three more were true when written and no longer (L-002, L-010, L-014). **That is the failure this audit exists to prevent, committed by this audit.** Five stale open items read as a week of imaginary work | re-check item by item against the code, never against this document |
| v3.14.314 | L-010 and L-014 carried bodies reading NO LONGER TRUE while their rows still read **open**, and the header counted them so — *introduced by the version written to fix exactly that*, in the harder direction: a closed item under a live row, which is what the count is read from. The same edit changed two states and miscounted the header by one | the count is computed from the table, never carried forward |
| v3.14.315 | **L-029 was wrong twice.** It reported `case 'sb-toggle'` as dead code in `events.js`; it is in `search_b.js`, and it was not dead but the surviving half of a live break — three Search-B toggles that did nothing, filed and fixed as **B-158**. A dead-code finding that is really a broken-feature finding is the most expensive kind to get wrong, because the proposed action is *delete the evidence* | verify a finding against the file, not against the report — and the finding's own method is what caught it |
| v3.14.333 | §7 re-verified five load-bearing claims first-hand before writing them down, on the strength of the row above | a claim reaches this document executed, or labelled as read |

**Compression history.** v3.14.317 applied the closed-body rule rather than
cutting prose: two closed bodies removed, the combinable-work done rows to one line each,
the guard-suite proposal's superseded measurements moved into L-018 and L-030
with the reasoning kept, the session account condensed. 71.8 KB → 58.5 KB, −19%, and no open item
lost a line. **v3.14.334 reorganised by subject** — findings had been filed in
three date-ordered waves, so one question lived in three sections — and merged
three "checked and correct" lists and three "could not do" lists into one each.
No open body was shortened in either pass: the instruction for outstanding work
is the one thing this document cannot afford to lose.
