# LingCoT: Consolidated Dev Plan
**Updated:** 2026-09-23 · **Version:** v3.14.415

| § | What is in it |
|---|---|
| [1. NEXT UP](#1-next-up) | the queue · the four gates · current state |
| [2. OPEN FEATURES](#2-open-features) | one row per `Dnn`; the spec is in `dev/design/` |
| [3. DEFERRED](#3-deferred-decided-awaiting-a-trigger) | decided, awaiting a trigger |
| [4. SUPERSEDED](#4-superseded-do-not-implement-as-written) | do not implement as written |
| [5. COMPLETED](#5-completed-index-only) | index only; detail in `edit_log.md` |

**Shipped:** §A–§C (exc. C19) · §E · §F · §G · B1–B3 · D21–D23.
**How to work on this project:** `dev/PRACTICES.md`. **Bug counts:** `dev/BUGS.md`.
**Audit status:** `dev/audits/AUDIT_INDEX.md`. Nothing is repeated here.

*Framing: the only shipped corpus is tiny (`turkish-test`, 13 sentences / 98
words; `korean-test` removed v3.14.120 for licence reasons and is owed a
replacement), so no efficiency work is current pain. The lazy `_dataGen`-keyed
cache idiom (Search-B `sbSent*`, `_exampleCacheGen`) is the standard mechanism
for any new cache.*

---

## 1. NEXT UP

**Everything up to gate 2 is finished.** Gate 1 taken and published
(v3.14.391–392), chains A and B closed (v3.14.358–379), the fixture swap executed
(v3.14.384–386). **§5 indexes all of it.** What follows is only what is not done.

*Restructured v3.14.398: this section was 348 lines and 172 of them described
finished work, so the answer to "what is next" was below the fold. Finished
accounts are in §5 and in `edit_log.md`; procedures that outlive their occasion
are in `PRACTICES.md`.*

### What to do next

**6 open bugs, 9 open findings, 3 live conflicts**, sorted by what each buys.
*`BUGS.md` and `UNIFIED_AUDIT.md` are the sources — take the counts from their
tables rather than from this line, which has been wrong twice.*

#### C · Provenance honesty — becomes urgent the moment A5 is machine-assisted

| | item | why |
|---|---|---|
| C1 | **B-157 · L-027** a CLI machine translation is stored as a person's work | 44 free translations seeded by machine would ship as 44 claims a human wrote them |

#### D · Structural, and cheap because the design is already decided

| | item | why |
|---|---|---|
| D1 | **D56** undo | D60 has an argument that **expires** when this ships: links are offered rather than automated only because a link is reversible in principle and not in fact. Also the only reversal D59 gives the section editor |
| D2 | **B-161** a second lemma for an existing form can only be created once two already exist | S2, and homographs are exactly what a two-language fixture set produces |

#### E · Guard quality — the suite's own honesty

| | item | why |
|---|---|---|
| E1 | **L-006** the suite's mutation score, last taken at v3.14.229 | **still the right target, and the only guards item open.** The five versions to v3.14.362 are the evidence: **thirteen** guards written in them were caught passing against broken code by mutation *before* they shipped. Every one shared an assumption with the code it checked — a fixture folding the same under both rules, a table keyed the way the guard asked for it. **The score itself has not been re-taken since v3.14.229** and should not be quoted until it is |
| ~~E2~~ | ~~**L-042** the tally depends on which corpus resolves~~ | **✅ CLOSED v3.14.384, re-measured v3.14.402.** The swap made `samples/` byte-identical to the live corpora, and the suite now returns **90 passed, 0 failed, 0 disabled** both ways — against `samples/` and against the live pair staged per PRACTICES §10. Pointing it at `~/mnt/corpora` *unstaged* gives 84/6, which is **B-168 refusing a directory with `archive/` beside the candidates** — the guard working, not a tally difference, and the distinction is why step 2 says "only them" |
| E3 | **B-170** `schema_conformance_test` has no vacuity floor, so a trivial corpus conforms | one guard, one floor. Unchanged |

#### H · Controls and presentation, new v3.14.405

| | item | why |
|---|---|---|
| ~~H1~~ | ~~**L-044** `list` edits an array through one comma-separated text box~~ | **absorbed into D62 A, v3.14.408.** The comma and the missing per-element provenance are one control change, not two tasks. Gate 3 |
| ~~H2~~ | ~~**L-045** four row collections, four CSS treatments~~ | ✅ v3.14.407. `ROW_EDITORS` declares `layout`; one `.row-ed` component with two variants, one `.row-x`, one `.row-add`. Borrowed classes gone |
| ~~H3~~ | ~~**L-046** four typographies for one data shape~~ | ✅ containers v3.14.407, typography v3.14.410. `LIST_VIEWS` declares `primary`, `secondary`, `emphasis` and reads `layout` off `ROW_EDITORS`; one `.lv-row` component, two sizes |
| H4 | **L-043** the inventory itself: 21 array fields, six controls, three declaring none | the frame for H1 to H3 rather than a task. **Deferred by decision, v3.14.408** (D62 B): the declaration lands in the first version that adds an array-shaped field, and converts the existing 21 with it. Trigger is **D28 or D37**, whichever is scheduled first |

#### F · Real but not now

**L-039** `pinned_examples` is swept by nothing · **L-041** an offer that cannot be
taken (`data-offer-translit`) · **⑦** the wanted mark reaches neither the word
editor nor the morpheme rows · **B-136** `word_index` written by two writers and
read by nobody · **L-030 · L-022 · ⑥ ⑫** documentation debt.

*Three items left this cluster at v3.14.408 and one at v3.14.403, all by being
decided rather than done: **B-027** was fixed at v3.14.373 and this line
described the pre-fix state for 29 versions; **B-139** and **L-013** are
superseded by D62 A and the D46 appendix; **⑪** was settled at v3.14.392–393 and
moved to the audit's §5.2 at v3.14.397. A cluster called "real but not now" is
where a decided item goes to look open.*

#### G · Cosmetic tail

**B-028** PDF page numbers · **B-029** autocapitalize residue · **B-035** two
languages, one native name · **B-109** dict-browse type filter · **B-181**
`new_version.py --add` archives a file already edited.

**One rule for reading this.** A is the only cluster with a deadline attached to
it, because `git init` is irreversible and everything before it is cheap to
change. B pays for itself inside A. Everything else can wait for a version where
it is the point rather than a detour.

---

### The four gates

Each gate exists because crossing it makes the previous stage's mistakes
permanent or expensive. The question is not *what is left* but *what has to be
true before each audience sees this*. Set v3.14.188.

| Gate | Before | The question | Open |
|---|---|---|---|
| ~~[1](#gate-1--before-git-init)~~ | `git init` | can history start clean? | **✅ TAKEN v3.14.391–392** — 214 files, disclosed, signed off, and **B-206** found by the hook on the first commit |
| [2](#gate-2--before-a-testers-build) | a testers' build | can a non-author annotate a text end to end? | 4 |
| [3](#gate-3--before-the-first-stable-version) | the first stable version | is the data model settled enough that users' files keep opening? | 8 |
| [4](#gate-4--can-wait-for-the-next-stable) | — | new capability and the cosmetic tail | 12 |

**Format decisions are all closed.** They were tracked separately because their
cost is driven by time rather than audience — every corpus annotated in the
current shape makes changing that shape dearer. B-116 ✅ v3.14.253 · interning
✅ v3.14.225–226 · file layout ✅ v3.14.233 (`dev/design/file_layout_options.md`)
· save format ✅ v3.14.233 (`dev/design/save_format_decision.md`, with the
options in `dev/design/save_architecture_options.md`) · B-135 ✅ v3.14.258 ·
B-121 + B-122 ✅ v3.14.260.

**What can run in parallel.** Gate 1 needs no code, so corpus building proceeds
alongside anything. Both holds on this claim are lifted (gate 1's own
prerequisites at v3.14.250; D50's migration at v3.14.249).

---

#### Gate 1 — ✅ TAKEN v3.14.391–392

**Both halves done**, and the repository is published: first commit `51658b8`,
214 files, 6.4 MB, `github.com/kutay-serova/LingCoT`. `PIPELINE_AUDIT` **S1**
closes with it. Account: `edit_log.md` v3.14.391–397, `dev/design/D58_fixture_set.md` §§7–10.

**What the gate bought — the argument for having one.** Three defects found
before the first commit landed rather than after: **B-156**, **B-205**, **B-206**.
All one shape — *a rule that named `samples/` and did not know about the second
cleared location*. Two were `.gitignore` patterns that read as active and were
inert; the third was `hooks/pre-commit`, and it surfaced **by refusing the first
commit**. None was findable by reading. Any would have been permanent.

**Two things it left behind, both live.** The swap procedure moved to
`dev/PRACTICES.md` §10, because it is written for the next swap rather than as
history. And `dev/archive/` — **280 MB** — is now a disk question rather than a
guard question: v3.14.393 kept the property those checks defended by asking git
instead (`doc_integrity_test.js` §8b), so PIPELINE 2.1's freeze can be decided on
its own merits. **Not before several versions carry their own commit**, and not
in the same version as anything else.

*The shipping-disclosure section that stood here is gone, v3.14.398: every
argument in it — why it discloses rather than excludes, why no filename scope,
why it is not in `run_all.sh` — is in `dev/tools/ship_disclosure.py`'s own
docstring, where it is read at the point of use. Two writers of one thing.*

#### Gate 2 — before a testers' build

Can someone who is not the author annotate a text end to end without losing work
or hitting a wall?

| Sev | Item | Why here |
|---|---|---|
| — | ~~**B-093** morpheme `transliterations` settable nowhere~~ | ✅ both halves: type v3.14.193, transliteration v3.14.303 with **D32** |
| — | **D46** the pipeline audit | belongs *inside* this gate: the order the work takes is only observable while someone is doing it. **Now gated only on the macOS install half** — the quickstart shipped at v3.14.395 and asks its readers the D46 question directly (*what order did you want to fill things in?*), so a tester's answer arrives with their other feedback rather than needing a separate sitting |
| ◑ | a fresh-machine install | `setup.py` has never been run by anyone but its author. **Half taken v3.14.394**: the published repo was cloned onto a clean Linux machine and `build_env.py` run for real. It **succeeded** — venv built, all packages resolved, `~/LingCoT-Data/` created — and then every command it printed afterwards failed (**B-207**, 67 of them). What is still owed is the half this cannot reach: **macOS, by double-click, on a machine with no developer tooling.** `setup.command` opens a browser when python3 is absent, and the Gatekeeper refusal path in `setup.md` has never been walked by a stranger |
| ✅ | an annotator quickstart | **`QUICKSTART.md`, v3.14.395**, linked from README Contents. Grew past "half a page" on purpose: it is a guided tour of every major feature in the order a first session meets them — corpus, ingest, gloss, dictionary and the offer strip, translation, dependency parse, search, Progress, export — because a tester who never reaches search cannot report on it. GUI only, **no terminal commands**: the audience is linguists, not developers, and the Section text box makes the whole path clickable. Guarded by `quickstart_labels_test.js` |

#### Gate 3 — before the first stable version

The theme is the data model: past this point there are users' files that must
keep opening.

| Item | Why it must precede stable |
|---|---|
| ~~**D52** the entry merge~~ | ✅ v3.14.291–292, all four stages. `dev/design/D52_entry_merge.md` |
| ~~**B-033** auto-linking has no definition~~ | ✅ v3.14.302. **D53 was the definition**, six stages, all closed |
| ~~**D32** one transliteration model~~ | ✅ v3.14.303. **B-045**, **B-093**, **B-142** and **B-145** closed with it |
| ~~**B-053 · D33** full-dictionary scans~~ | ✅ v3.14.309 · D33 retired v3.14.273. **Corrected twice, and this row carried the second error until v3.14.310**: L-014 named `pos` and `type` as the expensive pools; measured, they are 0.034 ms and 0.020 ms, and the expensive one is `AC_POOLS.gloss` at **0.248 ms** — a pool that did not exist when L-014 was written, and the only one whose length grows with the corpus rather than with a fixed inventory. Cached on `_dataGen` and the locale; the cheap two are deliberately left uncached |
| ~~**B-027** POS not validated against `pos_tags.json`~~ | ✅ **v3.14.373**, and this row described the pre-fix state for 29 versions. **The decision it was waiting on was taken**: an unknown tag is *stored*, reported at the save from `stampFieldProv` (`unknownTag()`), and adoptable from the tag drawer, which writes it to the project vocabulary file. **Refusing was ruled out by evidence** — `CLF` was the RIGHT tag and the shipped list lacked it, so a refusal would have blocked correct annotation. Verified v3.14.403 by reading the mechanism, not the row |
| ~~**I2** unify the row editors~~ | ✅ **v3.14.404.** One `ROW_EDITORS` descriptor in `participants.js`; **ten handler blocks in `events.js` became one**, and four `render*`/`read*` pairs became one line each. `sel` is in it rather than excluded: its two differences — rows found through the enclosing frame, and never being left empty — are declared as `rows` and `minOne`. **D39 and D31 are unblocked**; keyboard and reordering work now has one place to land. `row_editor_test.js` executes the descriptor |
| **D62 A · per-element identity for the five string lists** | **Decided v3.14.408, first item in this gate.** `variants`, `constituent_forms`, `source_ids`, `allomorphs` and `pinned_examples` become object elements carrying an annotator id and a date, and move from the `list` control to a row editor. Measured across both shipped corpora: **2 non-empty instances**, so the migration is free now and is a migration path after the first tester types a variant. **Supersedes B-139**, whose reasoning holds only while the control is a CSV box, and **absorbs L-044** — the comma bug is fixed by the same control change. `dev/design/D62_list_field_presentation.md` |
| ~~**D62 C · one read-only list presentation**~~ | ✅ **v3.14.410.** Four properties, four sizes down to two, transliteration text monospace. The per-collection row classes went with them. §4 of the same record |
| **D48 · the word editor** | *Was "stages C and D", which was wrong twice: **stage C shipped** v3.14.196–210 and **there is no stage D** — D48 names only stages A to C. Corrected v3.14.403.* What actually remains is one thing D48's last section names: **the word editor was never converted to a generated form.** D48 says it "stays available", and that the argument for it is now **the marking and the field order** — which is D46's target order, not drift. **The order was decided v3.14.408 and BUILT v3.14.409**: transliteration, POS, word gloss, parse, morpheme rows, lemma, with the IGT legend and the dependency table header moved onto `label.editor.word_gloss`. What remains of this row is the conversion itself — word-edit is still the level that does not read the field table, and the field order was the argument for leaving it that way |
| **D39** keyboard shortcuts | a tool used for hours at a stretch. **I2 ✅ v3.14.404 unblocked it** — one add handler, one remove handler, one reader, so Enter-to-commit and reordering are one edit rather than five. Carries D43's debt: `[data-prov-tip]` has no focus state |

#### Gate 4 — can wait for the next stable

New capability rather than model correctness, plus the cosmetic tail.

| | |
|---|---|
| **Features** | D37 · D28 · D31 · D34 · D40 · D41 · D25 P3 · D20 · D24 · D29 P2 |
| **Bugs** | B-028 PDF page numbers · B-029 autocapitalize residue · B-035 two languages, one native name · B-094 five document fields stored and never shown |
| **Retired** | F5, the parse field as primary surface — on evidence 2026-08-29: D46's session put POS *before* the parse, so the parse is the pivot for what sits below it, not the opening move. **Half of it shipped anyway**: D53 stage E ✅ v3.14.300 built the per-segment lexicon offer under the parse field, which was F5's other claim. Only "primary surface" was retired (UNIFIED conflict ⑮, settled v3.14.310) |

---

### Data integrity · the model gaps that remain

*The 2026-08-30 sweeps are retired (`dev/audits/retired/`) — they measured corpora
that no longer exist. Their five attribution findings all closed at v3.14.260–280
(**B-121**, **B-138**, **B-134**, **B-141**), and the rule that survives them is
**seed-on-next-write, not migrate**: a stamp records what was believed when it was
written, so nothing is retro-corrected. What is still open is below.*

#### Model gaps, not data errors — re-measured v3.14.397

*The 2026-08-30 figures were taken on corpora that no longer exist. These are the
shipped pair, both files, today.*

| | |
|---|---|
| **17 of 46 lemma groups have no member entry** | tolerated by design (`lemma_id` is a per-occurrence annotation), but the group view shows nothing while the corpus claims membership. **All 17 are in `turkish-test`; `chinese-test` has none of 13** — so this is a property of how one corpus was built, not of the model, which the single-corpus measurement could not have shown |
| ~~**`homograph` set on 0 of 52 entries**~~ | **no longer true.** It is set on **6** of 77 — 4 Turkish, 2 Mandarin — since **B-143** numbered loaded homographs at v3.14.290. The example that made the point still stands as a *shape*: two morphemes glossed "swim" and "peel" linking to one `yüz` entry is what D35's remaining half is about |
| **B-136** | `word_index` written by two writers, read by nobody |
| **B-139** | `source_ids`, `variants`, `constituent_forms` hold plain strings, so no per-element stamp. Changing the element shape is a format decision; **all three are still empty in both corpora**, so it becomes urgent the first time somebody types a variant |

### Where things stand

**The guard count and the suite's standing state live in `dev/PRACTICES.md` §6**,
which is the only place either is written down. Setup, fixtures and the corpus
variable are in the same section.

*And it went stale again, v3.14.398.* This paragraph named "the 2 disabled" as
the Search-B pair waiting on a replacement corpus — **nothing has been disabled
since v3.14.385**, when those two were rewritten against the new fixtures. It was
already carrying a warning that it had been 9 guards stale, and it had drifted a
second time under that warning. **The lesson is not "be careful"; it is that a
sentence naming a number is a second writer whatever it says about itself.**

### The audits

`dev/audits/AUDIT_INDEX.md` is the answer and the file to read: a verdict per
document plus what in each is false. `UNIFIED_AUDIT.md` is the live audit of
record and computes its own counts from its own tables.

**No summary is kept here** — a second copy of the index is exactly what went
stale, for 128 versions. *And the sentence declaring that kept one anyway: "the
**24** `L-nnn` findings, 12 closed as of v3.14.272", against 42 and 35 today.
Removed v3.14.398, 126 versions after it was written.* Two items the index does
not cover:

| | from | state |
|---|---|---|
| **S5** | `SCRIPTS_AUDIT.md` | whether `corpus_optimize.py` earns its place. Decide when D29 P2 is scoped |
| **F2–F5** | `ANNOTATION_FILL_AUDIT.md` | resolved, do not carry as work. F2 ⊂ D40 · F3 ✅ v3.14.269 · F4's residue ✅ v3.14.266 · F5 absorbed into and corrected by D46 |

---

## 2. OPEN FEATURES

One row per feature. **The spec is the design doc**; this table is the status and
the gate, and each section below carries only the current decision and what to do
next. **A feature that has shipped leaves this section** — its row and its body go
to §5 as one line pointing at `dev/design/`, because a section headed OPEN that
holds finished work makes the reader check each one to find out. Six left at
v3.14.363 (D32, D55, D57, D59, D60, D61), which was 10 KB of this file.

***Enforced again v3.14.397, and it had drifted back.* D53, D34 and D58 were
still here with full bodies — 120 lines describing work that shipped at
v3.14.298–302, v3.14.306–319 and v3.14.384–386. One line each in §5 now; their
design records hold the detail. **Their genuine residue is not deleted** — it is
in §3, because it is real open work that is no longer a feature in progress.*

| id | What | Size | Blocked by | State | Spec |
|---|---|---|---|---|---|
| [D54](#d54-interlinear-pinned-examples) | interlinear pinned examples | M | — (D32 ✅) | **PLANNED v3.14.301** | `dev/design/D54_igt_pinned_examples.md` |
| [D49](#d49-machine-parseable-lexicon-export) | machine-parseable lexicon export | S | — | **UNGATED v3.14.282** | `dev/design/D49_lexicon_export.md` |
| [D25 P3](#d25-p3-constituency-parse) | constituency parse | ? | — | unscoped | `dev/design/D25_dependency_parse.md` (P1/P2) |
| [D31](#d31-ordering-of-multi-entry-fields) | ordering of multi-entry fields | XS | I2 | REDUCED v3.14.273 | `dev/design/D31_multi_entry_order.md` |
| [D40](#d40-offer-the-annotators-own-earlier-work) | offer the annotator their own earlier work: repeated sentences and word forms | A S · B XS–S · C M · D S–M | — | **PLANNED v3.14.411**, stages A–D | `dev/design/D40_repeat_reuse.md` (plan) · `dev/design/D40_reuse_earlier_work.md` (reasoning) |
| [D41](#d41-reader-mode) | Reader Mode | B: S–M, A: M–L | D39 | not scheduled | `dev/design/D41_reader_mode.md` |
| [D39](#d39-standardized-keyboard-shortcuts) | standardized keyboard shortcuts | S | I2 | gate 3 | — |
| [D37](#d37-derived-forms-and-paradigms) | derived forms and paradigms | ? | — | not scheduled; owns `variants` matching since D35 C | `dev/design/D37_paradigms.md` |
| [D46](#d46-the-annotation-pipeline) | the annotation pipeline audit | M | — | gate 2, run it *during* annotation | `dev/design/D46_pipeline_ux.md` |
| [D28](#d28-dictionary-senses) | dictionary senses | ? | — | findings only, not scheduled | `dev/audits/DICT_SENSE_AUDIT.md` |
| [D29](#d29-nllb) | NLLB diagnostics, then in-GUI download | P2: M | — | **P1 ✅ v3.14.63–64**, P2 open | `dev/design/D29_nllb.md` |
| [D24](#d24-language-porting) | language porting | ? | — | not scoped | — |
| [D20](#d20-corpus-combiner) | corpus combiner | ? | — | not scoped | — |

### D56: Undo

**Raised 2026-08-31 with D55**, by the user, as the thing that decision makes
overdue rather than as a consequence of it: *"overwrite, but underlines the need
for an undo/rollback type mechanism."*

**The app has no undo of any kind.** Not for a take, not for a save, not for a
delete. Every destructive act to date has been small enough or gated enough to
live without one; D55 adds an act that replaces saved annotation in one click,
which is where the absence starts to cost real work.

**What already exists, and what it is not.** The temptation is to reach for the
journal (D50) and call this nearly done. It is not:

| | Holds | Why it is not undo |
|---|---|---|
| `*.journal.jsonl` | whole records, append-only, last-write-wins | folded into the base and **emptied** on compaction; prior values do not survive it |
| `prov_history` | interned ids into `prov_events` | records **that** a field changed and by whom — never what it was |
| `data-original` | the stored value, per input | one field, one editor session, gone on re-render |

So the substrate is a genuine gap, not a wiring job, and that is the finding
worth keeping from this entry. `data-original` is the only place a previous
value lives, and it lives there for exactly as long as the editor is open.

**Scope is the first question, before any mechanism.** Three candidates, in
ascending cost:

1. **Undo the take.** A take is one click writing ≤3 fields of one word, and the
   previous values are in `data-original` at the moment it happens. An undo
   scoped to *the last take, while the editor is still open* needs no storage
   layer at all — and it is exactly the act D55 introduces.
2. **Undo the save.** Requires the base record before the write, i.e. a real
   before-image, which is where the journal's compaction rules out reuse.
3. **A history you can walk.** A different product, and one this project has
   said no to before under other names.

**(1) is the one D55 obliges**; (2) and (3) are open. Deciding it as (1) first
also keeps the promise honest: an "Undo" control that covers takes and silently
does not cover deletes would be worse than none, so whatever ships must say what
it undoes.

### D54: Interlinear pinned examples

**Planned 2026-08-31**, split out of D53 stage F. `dict_export.py` renders a
corpus-pinned example as sentence text plus a translation and **no gloss line at
all**, while `buildLatexLinguex` has produced correct four-line IGT in the app
since v3.14.132 — so the one artifact a project hands outside itself is the one
whose examples are not interlinear.

**`gaps: true` is not optional there**: a published example is where a dropped
position is least recoverable, because the reader has no parse to check against.

**The work is column alignment in `fpdf`**, which lays out text and not columns —
measured per token and drawn, or set monospace and accepted as approximate. That
is why this is not a small change and did not belong inside F.

### D49: Machine-parseable lexicon export

**Decided 2026-08-29.** A format selector plus a second writer behind the export
modal's existing options object; the modal already collects everything a data
export needs and writes PDF only. **One-way by design** — for other tools, not
for import; only interchange has the identity problem.

**UNGATED v3.14.282.** The gate was "the linkage settled, which is B5 plus
B-106", and both shipped: the group is computed from tokens as well as entries,
so the 19 lemmas with no member entry are a shape the model states rather than a
hole in it. The figures are unchanged — 33 lemma headwords, 52 sense entries,
**14 of 52** carrying `lemma_id` — and are what an export has to represent
honestly rather than flatten.

**Two decisions left open until the writer is built:** the format
(TSV + JSON sidecar, CLDF, LIFT, plain JSON) and whether attribution re-expands
`annotator_id` — a publication decision, and B-129 ✅ v3.14.244 is what made the
dictionary PI-free.

### D25 P3: Constituency parse

The dependency half shipped v3.14.48–50; read `dev/design/D25_dependency_parse.md`
before touching `word.head` or `word.dep_rel`. Constituency is **not** derived
from it — a sentence may carry both, either or neither — and needs its own design
pass on storage (bracket string vs nested nodes), an editor and a render. The
retired `syntactic_parse` free-text field is not its starting point. Also open,
later: cross-sentence dependencies · enhanced dependencies as
`word.deps = [[head, rel], …]`, which the P1 schema was left able to take.

### D31: Ordering of multi-entry fields

**REDUCED v3.14.273.** Measured across 561 annotatable objects in both corpora:
**the maximum length of any multi-entry list is 1**, so every "which comes first"
question is unobservable. The storage half is done — `assignList` (B-138)
reconciles by content, not index, so there is no migration and no provenance
work. **What survives: one ▲▼ control on one row editor, as a consumer of I2.**
The open question it still owns — **is position meaning, or is primacy a flag?**
— decides **B-139** for free.

### D40: Offer the annotator their own earlier work

**Planned v3.14.411.** Plan: `dev/design/D40_repeat_reuse.md`. Reasoning:
`dev/design/D40_reuse_earlier_work.md`. Both prerequisites closed (D35 ✅
v3.14.282, B-144 ✅ v3.14.298).

| stage | what | size |
|---|---|---|
| A | runtime sentence-text index, keyed on folded text | S |
| B | translation and transliteration offers (chips) in the sentence forms | XS–S |
| C | sentence copy offer, with review panel and bulk-from-source; fill-only | M |
| D | word chips, one per distinct analysis incl. transliterations; `differs` note on filled fields | S–M |

Decided 2026-09-22: copy, not link · offer, never apply · folded-text identity ·
no post-save propagation and no bulk word fill (the annotator sees the values
before anything is written) · transliterations offered only from an identical
form or sentence, never by rule · filled fields get a `differs` note in the word
editor only.

**Branch:** `d40-annotation-offers`. Released in two batches: A+B+D, then C.
Procedure: `PRACTICES.md` §1 Branches. No file-format change beyond an optional
`from` key on derived prov moments; plan §5 has the compatibility table.

### D41: Reader Mode

Every view in the app is an *annotation* surface; there is no way to **read** a
corpus. Two modes: **A. Interlinear** (the whole text as continuous IGT, tiers
toggleable, hover-highlighting, click-popup) and **B. Column View** (text against
translation, aligned).

**B is closer to a promotion than a build** — `renderParaBatch` already emits the
two-column layout, sentence-level hover-highlighting already works, and
`SECTION_PARA_BATCH = 30` already lazy-loads. **A is the larger half**: per-word
highlighting needs an identity rule (form, `dict_id` or lemma — D35 again) and
the IGT renderer has only ever run one sentence at a time. **Read-only is the
smaller promise and the one the name implies.** Any new view must reach
`_renderCacheKey`: tier toggles change the screen without changing nav state,
which is the B-008 / B-011 / B-019 family.

### D39: Standardized keyboard shortcuts

Keyboard behaviour is per-view and incomplete: D30 added `[` / `]` traversal in
the two render views and nothing else is systematic. **The intention is one table
of shortcuts that holds everywhere** — at minimum Esc to cancel or exit, Enter to
commit where committing is unambiguous, plus the traversal keys.

**Sequenced after the input audit deliberately**: a shortcut table is a promise
about what the surfaces have in common, and assigning Esc a meaning before
knowing how many kinds of surface it must close produces a table with exceptions,
which is the state we are in. **Follow the D30 gate** — never while a text field
or `contenteditable` has focus, never with a modifier, so browser and OS
shortcuts stay untouched. `nav_traversal_test.js` asserts all three.

### D37: Derived forms and paradigms

Every inflected form becomes its own `type: 'word'` entry: `metnine`, `metin` and
a future `metinler` are three unrelated entries sharing a lemma link. The
*grouping* is real (`_resolveOrCreateLemma`, `dictByLemmaId`); what is missing is
any statement of the **relation** — inflected form, derivation, or spelling
variant are all stored identically.

**Four distinctions that must stay separate**, because conflating any two
produces a model expressing neither: **homograph** (D35) different lexemes, one
form · **sense** (D28) one lexeme, several meanings · **paradigm member** (D37)
`metin`/`metnine` · **derivation** (D37) `göz` → `gözlük`. The fourth is the hard
one and languages differ, so the model should let the annotator say which they
mean. B-044 ✅ v3.14.138 sent inflected forms here by ruling them *out* of
`alternate_forms`. **D35 landed at v3.14.282, and its stage C handed this the
`variants` matching question**: neither variation field is matchable until D37
says what an inflected form is.

### D46: The annotation pipeline

**An audit, not a build:** every surface where annotation is entered or advanced,
against the order the work actually moves. Deliverable is an audit under
`dev/audits/`, findings ranked, in the same shape as the others.

**The measured case.** `renderWordEdit` asks transliteration, word gloss, POS,
lemma, parse, morpheme glosses, push-to-dictionary. **Fields 2–4 are asked before
the field that determines them.** An annotation session at v3.14.220 gave the
real order and corrected D46's own claim: the annotator puts **POS before the
parse** — knowing a token is a verb is what tells you how to segment it.

**Target order:** transliteration · POS · parse · morpheme rows · lemma · gloss ·
push. Two long moves and two short ones — **and it is a change to markup, not to
the table**, because five levels take their order from `FIELD_SPEC` and word-edit
does not. A second argument for converting it first.

### D28: Dictionary senses

Findings only, nothing implemented: `dev/audits/DICT_SENSE_AUDIT.md` (2026-08-06,
against v3.14.53), which says of itself *"do not start this next."* One form with
different selectional frames often needs different definitions and the dictionary
has **no sense layer at all**; frame and sense co-vary but not reliably enough to
hard-wire. Re-derive from the audit before acting — **this section is a
reconstructed pointer**, the original text was lost to a careless slice on
2026-08-24 and predates every archived copy.

### D29: NLLB

**P1 ✅ v3.14.63.** Captured stderr, a `crashed` state with `exit_code` +
`stderr_tail`, and the settings modal renders it; guarded by
`dev/tests/nllb_diag_test.py`. **It answered immediately** (B-016, fixed
v3.14.64): the app never stopped the server it started, so quitting left an
orphan on port 5001, and the health check tested liveness rather than identity.
Both standing hypotheses were wrong — kept in the design doc as a record that two
days of inspection settled less than one captured stderr line.

**P2, in-GUI model download (M).** Decided 2026-08-24: a full download, not a
copy-button, running `setup.py --nllb` as a managed subprocess on the existing
server bridge. **The new piece is a progress channel** — preferred, a JSON status
file the GUI polls each second. Also needs a size warning up front (~1.2 GB
transits, ~600 MB lands), cancellability, resumability and honest failure
reporting. **Open, not settled:** `setup.py --nllb` also mutates the venv, and
downloading a model is a different act of consent from changing someone's Python
environment.

### D24: Language porting

Per-field multilingual fillers, expandable later. **Not yet scoped.**

### D20: Corpus combiner

Merge corpus files; resolve conflicting field values and annotator info. **Not
yet scoped.**

---

## 3. DEFERRED (decided, awaiting a trigger)


**From D34, and it is a question for the annotator rather than a finding.**
`paragraph.translations` is reported missing in both corpora and no join for it
exists in the app — the rule is documented only in the pre-G31 CLI's README.
Every sentence in both corpora is translated, so a paragraph translation would be
redundant with work already done. **Deciding it is the last thing between five
counted rows and four**, and it is the one part of D34 nobody has answered.

**From D58, and it is annotation rather than code.** Eight declared fields have
no instance in either corpus — `comments` at every level, `variants`,
`allomorphs`, `selection`, `semantic_domain`, `usage_notes`, `pinned_examples`,
`section.source_ids`. **A field with no instance cannot tell a reader that works
from a reader that does not**, which is what B-202 and B-203 cost to learn. The
trigger is a tester annotating (gate 2), not a code change.

| | | Trigger |
|---|---|---|
| **C19** `prov_history` size cap | measured out of D50 stage 4, not built. Longest history anywhere is **5**, mean 1.36; since stage 4b an entry is an interned id costing ~3 bytes, so a cap of 100 would never fire and would save ~300 bytes if it did. Shape if needed: optional `max_prov_history` → drop oldest + `history_truncated:true` | a real session past ~50 |
| **D22 Option B** | in-app NLLB download with streaming progress (A+D ✅ v3.14.43) | D29 P2 |
| **D23 stretch** | PDF reverse-index appendix; thematic section headers when sorted by domain | — |
| **D26** | morpheme-level `lemma_id` (word level shipped). Nothing writes the field, so there is no migration to carry — it is a feature | whenever it is built |
| **G32 Option C** | manual homograph-picker UI (id-first resolution shipped) | D35 B2 |
| **Search-B v1.1** | CSV/TSV export · result cap + pagination · n-grams · G²/PMI collocate stats | — |

## 4. SUPERSEDED (do not implement as written)

| | Resolved as |
|---|---|
| Dict Prompt modal + companion-banner removal | banner *kept* (i18n-migrated v3.14.7); `showDictPrompt()` never built |
| GUI icon choices | shipped `ph-book-open` for Corpus. Dictionary `📖` A/B swap still open |
| POS/type constant duplication | `POS_CHOICES`/`TYPE_CHOICES` overridable from `resources/*.json` (v3.13.4) |
| L2 schema-version gate | moot, `migrateDoc` removed |
| C12 norm-sentence cache · C18 migration shim | folded into §F · moot |
| D25 auto-parse | spaCy/stanza assisted parsing dropped, manual entry only |

**Superseded docs** in `dev/archive/docs/superseded_plans/`:
`LingCoT_efficiency_analysis.md` · `efficiency_action_plan_v3.11.md` ·
`RESTRUCTURE_PLAN.md` · `audit_2026-05-25.md` · `plan_unified_load_save.md` ·
`plan_annotator_tracking.md` · `plan_annotators_sources.md` ·
`GUI_dev_plan_2026-05-29.md` · `April2026_dev_goals.txt` · `search_test_report.md`.

## 5. COMPLETED: index only

*One line per body of work, with the versions to search for. Full detail in
`edit_log.md`; the reasoning behind each shipped design is in `dev/design/`.*

| | Shipped | What, and where the reasoning is |
|---|---|---|
| **The queue · chains A and B** | v3.14.358–384 | the ordering that emptied gate 1. **A finished the corpora** — A1 the missing 只 lemma, A2 `metadata.tracked` stripped, A3 dependency parses, A4 the neutral participant identity, A5 the free translations, A6 **B-169** — and **B made finishing them faster**: D61's lemma chip, B-108, L-040/B-191, L-038. Then steps 1–8: the save path (B-110/149/150), **B-143** numbering loaded homographs, **D52**, **B-154**, **B-114**, **B-123**'s backfill last, the fixture swap, and the two search guards rewritten. **The ordering was the product**: B-143 first meant every later step could ask *which of these two?* and be answered; D52 before B-123 meant the backfill could not manufacture duplicates nothing could undo |
| **Two warnings that outlived the chains** | — | **A3's first re-measurement reported zero roots in both corpora and was wrong twice over** — it looked for `dep_head` where the field is `head`, and counted `dep_rel === 'root'`, which **B-015** decided is never stored. *A check whose answer is fixed by a design decision, read as a measurement.* And **D61's source 1 fires on ZERO tokens in these corpora**, because every linked token already carries a lemma; anyone building on it should re-measure rather than assume it is idle only for now |
| **D58** | v3.14.384–386 | the shipped test data: `samples/` is two typologically contrastive corpora, byte-identical to the live ones, and `dev/tests/fixtures/` holds specimens named for the guard or bug they serve. **The split is by AUDIENCE** — a user should see a corpus worth imitating, and several guards need data no user should imitate. §3's rule, *a specimen with no reader is not a keepsake*, deleted six reader paths, the `legacy` tier and `legacyKey`. `dev/design/D58_fixture_set.md` |
| **D34** | v3.14.306–319 | session tracker & missing-annotation panel, all five stages. **"Missing" is three reasons, not one** — derived-when-applicable, inapplicable-to-the-project, genuinely missing; a counter built from the `core` tier would have opened by reporting 301 missing parses, every one wrong. The tracked set is the annotator's, not the table's. `dev/design/D34_session_tracker.md` |
| **D53** | v3.14.298–302 | the fill pipeline, all six stages, closing **B-033**. The line that held throughout: **these stages offer, they do not apply.** `dev/design/D53_fill_pipeline.md` |
| **D61** | v3.14.362 | the lemma chip: the field proposes when it is empty, from the token's entry, the same form already lemmatised in this corpus (with its count), and the root the parse names written through `source/resources/citation_forms.json`. Source 4, string similarity, deferred by decision — it knows no morphology. Nothing writes; an accepted chip is stamped `derived`. `dev/design/D61_lemma_suggestion.md` |
| **D60** | v3.14.347–348 | a derived value never occupies the annotator's answer. The dictionary's bulk fill became an offer that shows what it would do; `storedWordGloss` made "typed" and "composed" tellable apart at both ends. Closed L-035, B-176, B-180, B-186. `dev/design/D60_derived_values.md` |
| **D59** | v3.14.343 | the document editor commits at Save and only there: every control edits a buffer, `saveDocument` is the only writer of `d.sections`. Closed L-036, B-175, B-178. `dev/design/D59_section_editor_commit.md` |
| **D57** | v3.14.331 | the morpheme route into the dictionary. `dev/design/D57_morpheme_dict_route.md` |
| **D55** | v3.14.330 | an explicit take overwrites, and `offerWrites` is the one predicate the chip and the fill both ask — which is what made B-108 findable. D55, written inside `dev/design/D53_fill_pipeline.md` rather than as its own record |
| **D32** | v3.14.303 | one transliteration model: the derivation is computed at read time and never stored. `dev/design/D32_transliteration_model.md` |
| **D35** | v3.14.183–282 | homographs: two objects can share a form, and the model now says which is which. **A** the stored discriminator, the lemma registry, and an ambiguous form writing nothing · **B1–B4** the four silent `[0]`s closed and the chooser built · **B5** the lemma group, computed from tokens as well as entries · **B6** orphans collected, never swept · **C** the deliberate guard edit. Closed B-106; ungated D49. **Residue: B-114**, a discriminator on a lemma record. `dev/design/D35_homographs.md` |
| **D51** | v3.14.263–271 | one add-to-dictionary surface: `candidateRows` decides, the panel draws, `createEntries` writes, `backPropagate` gives the token back. Closed B-058, B-111, B-112, B-113, B-140, F3, F4's residue, I6; retired `_pushTokenToDict`, the push picker, the completion modal, `renderDictAdd`, `saveNewDictEntry`, the `dict-add` view. `dev/design/D51_add_to_dictionary.md` |
| **D50** | v3.14.235–250 | the save migration: an append-only journal, so save cost stops depending on corpus size. Provenance interned (−18.4%), companions bound, `record_type` declared. `dev/design/D50_save_migration.md` |
| **D48** | v3.14.196–210, ext. v3.14.262 | one field table (`source/modules/field_spec.js`): what exists at each level, in what order, how much it matters, where its control is and who writes it. Closed B-091, B-092, B-094, B-099, B-083, D47, I1, B-117, B-118; found B-107. `dev/design/D48_field_table.md` |
| **D47** | v3.14.198–201 | one renderer per object — every add/edit pair had drifted, the add half collecting fewer fields. Built as D48 stage B |
| **D33** | closed | scale and the id-sort trap. Ids are safe; `id_sort_test.js` guards `w_1000` vs `w_999`, generalised by B-135: ids are opaque. Scale figures superseded by B-116. Retired v3.14.273 — the datalist half described elements D42 deleted, and `tagUsage()` measures at **0.034 ms** |
| **D46 prep · D38** | v3.14.158, ext. v3.14.166 | input UX audit, `dev/audits/INPUT_UX_AUDIT.md`, findings I1–I15; §16 filed B-091–B-094 and D47 |
| **D45** | v3.14.174 | the tag control. Six visibility constants deleted; the drawer groups by corpus use. **Binds:** open/closed class rejected as a European-centric claim (false for Japanese, Thai, Khmer pronouns); scope narrows only AFFIX and PHRASE, because a root morpheme can be a NOUN |
| **D44** | v3.14.173 | one chip, two kinds, 12px, filled accent, opacity for disabled only. Absorbed I8, I10 |
| **D43** | v3.14.168 | provenance on hover: `provTipAttr()` + `[data-prov-tip]` replaced 21 lines and five presentations. **Binds:** the tooltip cannot sit on the value (a replaced element has no pseudo-elements); MT provenance has no `derived` flag. **Debt:** no focus state, inherited by D39 |
| **D42** | v3.14.171–172 | one suggestion mechanism: the offer strip for what is on screen, `AC_POOLS` for what is typed. **The contract binds:** the accept handler marks `data-offer-src` and `stampFieldProv` reads that mark, so a provider that forgets to stamp cannot repeat B-061 |
| **D36** | v3.14.149 | CLI scripts audit, `dev/audits/SCRIPTS_AUDIT.md`. Found B-078. S5 is the only residue |
| **D30** | — | next/previous navigation, `dev/design/D30_navigation.md` |
| **D27** | — | selection, `dev/design/D27_selection.md` |
| **D25 P1/P2** | v3.14.48, .50 | dependency parse, `dev/design/D25_dependency_parse.md` (P3 constituency still open, §2) |
| **D21 · D22 · D23** | — | Search-B (see §F) · A+D offline-model linking v3.14.43 · dictionary + PDF export v3.14.44–47 (schema, add/edit parity, pinned examples, browse columns, fpdf2 export) |
| **A** | v3.14.12–17 | UX bugs: legacy Annotations field · section-nav · Edit-History panel · pywebview `FileDialog` enum · unified source-picker |
| **B** | v3.14.12–13, 24 | icons & visual polish · **B1** dark mode v3.14.33 · **B2** translation settings v3.14.35, .42 · **B3** `--content-max` + `viewHeader()` v3.14.34 · S2–S6 2026-06-20/21 |
| **C** | — | architecture/efficiency: C13 annotator WeakMap · C14 delegated handlers · C15 `_positionDropdown` · C16 source-picker header · C17 `VIEW_RENDERERS` · C20 search back-nav · C21 Escape handler · C22 settings.json boot fix (v3.14.14–25) |
| **E** | v3.14.18, .21 | corpus ↔ lexicon integrity: E26 `ensureMorphemesFromParse` · E27 word-level `lemma_id` |
| **F** | v3.14.15–38 | Search-B concordance refactor (realizes D21): substrate · matcher · KWIC · frequency · sort-by-context · collocates · parity 1174/1174, Search-A retired |
| **G** | — | data-model consolidation (`dev/audits/DATA_MODEL_AUDIT.md`): G28 segmentation chokepoint · G29 fill/derive rule · G30 SCHEMA + conformance · G31 transliteration rename · G32 `dict_id` resolution · G33 entry-point consolidation (`dev/audits/ANNOTATION_UX_AUDIT.md`) · G34 legacy `annotations:{}` retired |
| **H** | v3.14.56–75 | session of 2026-08-24: **21 bugs closed (B-001…B-021)**, 14 in one day, four S1. Search-A's dead half deleted (14 functions, 45 KB). Guards 3 → 26 |
| **I** | v3.14.76 | `dev/` and `dev/archive/` sorted and indexed, moves only, 403 files before and after. `dev/archive/README.md` is the index |
| **J** | v3.14.77–81 | corpora moved out of the repository, and the four bugs that took (B-022–B-025). `source/workspace.py` defines the workspace once. Guards 26 → 28 |
| **Historical** | pre-§A | efficiency audits #1–2 · v4 schema restructure · annotator tracking · annotators/sources schema · unified `open_project()` · multi-file partitioning · chip unification · i18n ~493 strings · Phosphor sprite · lemma/Entry-Sheet/`<BREAK>` search · search validated 78/78 + 67/67 |
