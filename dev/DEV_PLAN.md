# LingCoT: Consolidated Dev Plan
**Updated:** 2026-09-02 · **Version:** v3.14.393

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

### The queue

**Chains A and B are complete at v3.14.294. Steps 7 and 8 closed at
v3.14.384–385**, which empties this queue.
Set v3.14.288, closed v3.14.294; the ordering held — each step made the next
safe, and the bulk write went last.

| # | Item | What | Why here |
|---|---|---|---|
| 1 | ~~**the save path** — B-110, B-149, B-150~~ | ✅ v3.14.289 | `source/modules/project_files.js` + its Python twin; `project_files_test.js` compares them |
| 2 | ~~**B-143** number loaded homographs~~ | ✅ v3.14.290 | `buildDictIndex` numbers what it indexes. It was the prerequisite for 3–6 in general; it was **not** what made the reported 的 pair indistinguishable — those were numbered already |
| 3 | ~~**D52** merge two entries~~ | ✅ v3.14.291 (A–C) | stage D remains, and it is step 4 |
| 4 | ~~**B-154** the missing lemma record~~ | ✅ v3.14.292 | pinned to `applyDict`'s wholesale replace; D52 stage D is the repair |
| 5 | ~~**B-114** a lemma discriminator~~ | ✅ v3.14.293 | the strip asks instead of refusing, and "a different one" is sayable |
| 6 | ~~**B-123** the auto-link backfill~~ | ✅ v3.14.294 | ran last, as planned. `linkTo` over every unlinked token, previewed before it writes |
| 7 | ~~**the fixture swap**~~ | ✅ **v3.14.384**, steps 1–4 of the procedure. `samples/` is `turkish-test` + `chinese-test`, byte-identical to the live corpora | the post-swap run matched the rehearsal **check for check** — the point of rehearsing. Step 5 (`ship_disclosure.py`, sign-off, `git init`) is gate 1's other half and is not this item |
| 8 | ~~**the two Korean guards**~~ | ✅ **v3.14.385**, one version after the swap rather than in it. Both re-pointed at `turkish-test` + `chinese-test`, every golden rewritten by hand | **the suite has nothing disabled for the first time: 87 pass, 0 fail, 0 disabled.** They had been dark for 265 versions. Rewriting them found **B-203** — only the first transliteration under a label was searchable — which is the second bug the multi-element list has paid for |

**What the ordering bought.** B-143 first meant every later step could ask
"which of these two?" and be answered. D52 before B-123 meant the backfill could
not manufacture duplicates that nothing could undo — and the two 的 are exactly
why: `chinese-test` has 3 tokens the backfill will not touch until they are one
entry. B-123 last meant its bulk write ran against a lexicon every earlier step
had already made legible.

**Not blockers:** the remaining hollow guards (`suggest_mechanism`'s static half,
`required_marker`'s §2–7), the retired-spelling absence assertions, the id-sort
work. Tracked in `dev/audits/UNIFIED_AUDIT.md` — §1 ranks every open item and §2
carries the bodies, reorganised by subject at v3.14.334.

**The audit's small items are cleared, v3.14.337–338.** L-018, L-025, L-026,
L-028, L-029 and L-037 closed, L-019 half; **B-174** was found by the dead-code
pass and fixed with it — `#app-name` was on two elements, so opening an annotator
preview replaced the application's own header title with the annotator's name.
The audit is down to **13 open findings and 2 half** from 23, and the remainder
is work rather than tidying: L-034's form-at-a-time pass, L-036's section merge,
L-006's mutation score and L-007/L-021's fixture, which is D58 and gate 1.

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

### What to do next, clustered — re-taken v3.14.387

The gates say what must be true before a milestone. This says what is worth doing
first, which is a different question: **6 open bugs, 7 open findings and 5 live
conflicts, sorted by what each one buys.** Ordered within each cluster.
*`BUGS.md` and `UNIFIED_AUDIT.md` are the sources — take the counts from their
tables rather than from this line, which has been wrong twice.*

**Clusters A and B are both finished** (v3.14.358–v3.14.379), and so is the
fixture swap that A existed to enable (v3.14.384–386).

#### A and B · both closed — ✅ v3.14.358–v3.14.379

*Compressed v3.14.387. The item tables are in `dev/edit_log.md` under their own
versions; what is kept here is what a re-reader would otherwise re-derive wrongly.*

**A finished the corpora, and therefore gate 1.** A1 the missing 只 lemma, A2
`metadata.tracked` stripped, A3 dependency parses, A4 the neutral participant
identity, A5 the free translations, A6 **B-169**. **B made finishing them
faster**: D61's lemma chip (sources 1–3), B-108, L-040/B-191, L-038.

**Two things they cost to learn, and both are still live warnings.**

- **A3's first re-measurement reported zero roots in both corpora and was wrong
  twice over.** It looked for `dep_head`, where the field is `head`; and it
  counted `dep_rel === 'root'`, which **B-015 decided is never stored** — root is
  derived from `head === null`. *A check whose answer is fixed by a design
  decision, read as a measurement.* `dep_root_test.js` exists and says so.
- **D61's source 1 fires on ZERO tokens in these corpora**, because every linked
  token already carries a lemma. Anyone building further on source 1 should
  re-measure first rather than assume it is idle only for now. Source 3 shipped
  beyond the sketch because it turned out cheap once the parse was trusted, but
  it needs vowel harmony, which lives in `citation_forms.json` as data.

**And one rule the cluster established:** every re-measurement in A moved a line,
and two of its six items were already done before anyone looked. That is the
argument for re-taking figures at every comb rather than carrying them forward.


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
| E1 | **L-006** mutation score 56%; 31% of assertion sites are regexes against source text | still the right target, and the five versions to v3.14.362 are the evidence: **thirteen** guards written in them were caught passing against broken code by mutation before they shipped. Every one was a guard sharing an assumption with the code it checked — a fixture folding the same under both rules, a table keyed the way the guard asked for it |
| E2 | **L-042** the tally depends on which corpus resolves — 71 on `samples/`, 69 on the live corpora | resolves itself at the swap; worth re-measuring after |
| E3 | **B-170** `schema_conformance_test` has no vacuity floor, so a trivial corpus conforms | one guard, one floor |

#### F · Real but not now

**L-039** `pinned_examples` is swept by nothing · **L-041** an offer that cannot be
taken (`data-offer-translit`) · **⑦** the wanted mark reaches neither the word
editor nor the morpheme rows · **B-027** POS not validated against `pos_tags.json`
(a decision: refuse, warn or accept) · **B-136** `word_index` written by two
writers and read by nobody · **B-139** string lists carry no per-element
provenance · **L-013** the observed annotation order corrects D46, n=1 ·
**L-030 · L-022 · ⑥ ⑪ ⑫** documentation debt.

#### G · Cosmetic tail

**B-028** PDF page numbers · **B-029** autocapitalize residue · **B-035** two
languages, one native name · **B-109** dict-browse type filter · **B-181**
`new_version.py --add` archives a file already edited.

**One rule for reading this.** A is the only cluster with a deadline attached to
it, because `git init` is irreversible and everything before it is cheap to
change. B pays for itself inside A. Everything else can wait for a version where
it is the point rather than a detour.

---

#### Gate 1 — ✅ TAKEN v3.14.391

A corpus or participant file committed once lives in every fork forever.

**Both halves are done.** The fieldwork half shipped as the fixture swap at
v3.14.384 (D58); the disclosure half was run twice and signed off at v3.14.391,
recorded in that entry's `**Examined:**` line. **214 files, 6.4 MB**, and the
staged set diffed empty against the list the disclosure printed before `.git`
existed. `PIPELINE_AUDIT.md` **S1 closes with it.**

**What the gate bought, stated because it is the argument for having one.**
**Three** defects were found before the first commit landed rather than after —
**B-156** (v3.14.312), **B-205** (v3.14.389) and **B-206** (v3.14.392). All three
are one shape: a rule that named `samples/` and did not know about the second
legitimate location. The first two were `.gitignore` patterns that read as active
and were inert; the third was `hooks/pre-commit` disagreeing with `.gitignore`
about which cleared data may ship, **and it surfaced by refusing the first commit
outright.** None was found by reading. Any of the three would have been permanent.

**`dev/archive/` — 280 MB, and now a disk question rather than a guard
question.** `PIPELINE_AUDIT` 2.1 wanted it frozen the day git arrived, and
UNIFIED ⑪ objected that freezing it kills `new_version.py`'s central purpose and
`doc_integrity`'s strongest check. **v3.14.393 took neither horn**: the property
those checks defended — *every file an entry says it touched actually changed in
that version* — is now asserted against git, on any clone. The archive checks are
kept until several versions carry their own commit, and then the 280 MB can be
decided on its own merits. **Do not freeze it before then**, and do not delete it
in the same version as anything else.

**That the hook fired is the gate working, not the gate failing.** Two
independent layers were built precisely because `.gitignore` is a default with
known ways past it, and the layer that caught this is the one that only ever runs
at the moment of commit — so nothing earlier could have executed it. The lasting
fix is neither file: `gitignore_test.js` §B now runs the hook against every path
`.gitignore` admits, which makes the two writers one checkable rule.

**The section below is kept as written**, because it is the reasoning and the
procedure, and the procedure is written for the next swap rather than as history.

| | State |
|---|---|
| **the replacement corpus in `samples/`** | ✅ **v3.14.384.** The fieldwork item. **What it must contain is decided: D58** (`dev/design/D58_fixture_set.md`). Requirements fixed: open-licence text, synthetic or consent-cleared, no real participant data. Decided 2026-08-28 — an original translation of *The North Wind and the Sun*, with a Mandarin counterpart, under a neutral identity |
| **the shipping disclosure** | ✅ **v3.14.391.** One deliberate run of `dev/tools/ship_disclosure.py` immediately before `git init`, and a human sign-off recorded in that version's entry. Specified below |

- **It must carry dependency parses — a few, not all.** ✅ **Done, v3.14.379.**
  `turkish-test` has 3 parsed sentences and `chinese-test` 2, each with exactly
  one root, every token headed, and arcs = tokens − 1. That is what
  `dep_root_test` and `dep_arc_test` need: a root that can be told from an
  unparsed word, and a relation the no-dep_rel-on-a-root rule can be true of.
  Parsing twenty-two sentences to satisfy a guard that needs two is the kind of
  cost this plan should name rather than imply, and it was not paid.
- **It will not re-enable the two Korean guards.** `search_b_concordance_test.js`
  and `search_b_matcher_test.js` assert hand-typed Korean forms. Turkish +
  Mandarin satisfies "typologically contrastive" and not those two.
- **The swap is no longer expected to break anything** — B-119 ✅ v3.14.238 and
  B-125 ✅ v3.14.250 fixed the defects L-007 predicted it would expose. Still
  worth making for density: `samples/turkish-test` is 50,349 bytes against the
  live corpus's 78,282 and predates `record_type` entirely.
- Nothing else blocks the commit; every open bug is in gitignore-clean code.
- **Conflict ⑰ resolves here rather than in `.gitignore`.** The audit framed it as
  the privacy rule and the version-control plan carving out the same file; the
  resolution is that they are not in conflict once the carve-out is a disclosure
  a person signs rather than a rule the repository enforces on data it cannot
  read.

##### The fixture swap, step by step — decided v3.14.326, executed v3.14.384

**The risk was never the corpus, it was the redirection.** Replacing `samples/`
is a file operation; what made it dangerous is that twenty guards resolve their
input through `_fixture.js`, and until **B-168** (v3.14.326) that resolver
returned the first substring match in a recursive sorted walk — so pointing
`LINGCOT_TEST_CORPUS` at a directory holding an `archive/` handed the suite an
archived corpus and reported the language's name. **The rehearsal is the
migration's whole safety, and B-168 is what makes it trustworthy.**

**Keep this procedure.** It is written for the next swap, not kept as history:

| | step | why |
|---|---|---|
| **1** | `unset LINGCOT_TEST_CORPUS`, run the suite, record the tally | `corpusDir()` prefers the env var over `samples/`, so a stale export silently keeps the old data through the entire swap |
| **2** | stage the candidates in a directory holding **only** them, and rehearse: `LINGCOT_TEST_CORPUS=<staging> ./dev/tests/run_all.sh` | the whole migration, reversibly, before a file moves. **"Only them" is load-bearing**: a directory with an `archive/` beside the candidates is what B-168 refuses to guess between, and **B-199**'s fork put two `turkish-test` corpora in one directory for six versions — six guards refused and one could not find a companion |
| **3** | fix what step 2 names — in the CORPUS where it is a data problem, in the code where it is a code problem | the distinction matters: a guard failing on real data is usually the guard being right |
| **4** | replace `samples/`, `unset`, run again, and compare to step 1's tally | the two runs must differ only where step 3 predicted |
| **5** | `python3 dev/tools/ship_disclosure.py`, sign off, `git init` | gate 1's other half. **✅ TAKEN v3.14.391**, and the first commit refused by `hooks/pre-commit` — **B-206** ✅ v3.14.392 |

**What it bought, measured.** Steps 1–4 ran at v3.14.384: **the post-swap run was
identical to the step-2 rehearsal, check for check** — `diff` of the two
per-guard tallies was empty. That is the whole point of rehearsing, and it is the
first time it has been collected. Against step 1's baseline five guards moved,
all in check COUNTS and none in outcome; the two that moved DOWN were D58 §3's
dead-reader branches, deleted at v3.14.386.

**Two things it surfaced that were not about the swap**, both recorded because
they are the kind of thing a swap is good at finding: DEV_PLAN's own v3.14.363
corpus figures did not reproduce (and no annotation was lost — checked id by id),
and two shipped translations are stamped `auto-nllb-200`. **The licence question
that raised was researched and closed: CC-BY-NC binds the weights, not the
strings**, so the translations stay and the stamp is the honest record.

##### What the corpora hold

**Do not copy the figures here.** `samples/README.md` carries the measured table
and is re-taken when the fixtures change; a second copy is how this section spent
three versions disagreeing with itself. Take them with
`node dev/tests/schema_conformance_test.js`, which prints the object count and
names the corpora it walked.

**What is worth stating rather than measuring:** both corpora are fully glossed
and fully translated, both carry dependency parses with a root, and D58 §1's four
measured gaps are closed. What they still lack is listed under D58 below, and it
is annotation rather than code.


##### Safe with respect to data — measured, and smaller than this gate assumed

The privacy prose above was written when `samples/` held **269 occurrences** of
real names inlined in provenance. The live corpora hold **none**: interning
(v3.14.225–226) thinned provenance into `prov_events`, and the only annotator
strings there are `auto (lexicon)` and `automatically-parsed`, machine labels,
against a single id `ann_001`.

**So the entire exposure is two records per corpus** — one `annotator`, one
`source` — carrying name, researcher, affiliation, role, `birth_decade` on one of
them, and the source's publication restrictions. Substituting a neutral identity
is editing four records, not sweeping a corpus.

**Which argues for doing it FIRST, not at the disclosure.** Annotating the rest
under the neutral identity keeps every new provenance event clean by
construction; substituting afterwards is a rewrite of records the guards read.
The disclosure then verifies a decision already taken rather than catching one
not yet made.

**What the swap costs that nothing has replaced.** `samples/turkish-test` is the
only fixture that predates interning and `record_type`: no `prov_events` line,
no `record_type: "document"`. `isDocument`'s `Array.isArray(r.sections)` fallback
and `splitEvents`' no-events path exist for exactly that shape, and after the
swap **nothing exercises either**. B-128 is what happens when a format path has
no fixture. Decide at step 3: keep one small legacy-shape corpus in `samples/`
for that coverage, or delete the fallbacks in the same version. Keeping a
fallback nothing tests is the worse of the two.

##### The shipping disclosure — decided v3.14.311

**`samples/` ships a participants file on purpose.** It is the file structure a
user will actually have — corpus, dictionary, participants, journal — and a
sample set that omits one of the four teaches the wrong shape. The requirement is
that its contents are not genuine, which is a fieldwork decision, not something
the repository can decide for itself.

**So the check discloses; it does not exclude.** No `.gitignore` rule, no
allow-list of acceptable names, no pattern for what "synthetic" looks like. A
pattern would be a claim about what a real name can be — the same kind of claim
as `POS_VISIBLE_MORPH`, and wrong for the same reason. The tool enumerates and a
person decides.

**Why a filename exclusion would have been the wrong instrument anyway**, measured
2026-08-31: the participants file holds **3** named records, and the corpus and
dictionary beside it hold **269 occurrences** of those same names inlined in
provenance — 205 and 64. A check scoped to `*_participants.jsonl` would have read
3 records and missed 269 strings. The live corpora have **0**, because interning
(v3.14.225–226) thins provenance into the `prov_events` table; `samples/` predates
it, which is L-007's fixture-format finding arriving from the privacy side. **The
corpus swap fixes this by construction — the disclosure is what verifies it did.**

What the tool does, in one run, printing to the terminal and writing nothing:

1. **Asks git what would ship**, via `git check-ignore` against a scratch repo —
   the technique `gitignore_test.js` already uses. Not a hand-written list: a
   check and a commit that disagree about what is being committed is two writers
   of one thing.
2. **Takes the names from the data, not from a pattern.** Every `name` on every
   `annotator` and `source` record that would ship becomes the search set; the
   tool then counts each one across every other shipping file. Derived from what
   is there, the way `countedKeys` reads the field table rather than listing
   fields.
3. **Prints every field carrying a value** on every shipping participant record,
   so the person signing off sees what they are signing off rather than a verdict.
4. **Reports, and returns nothing to act on automatically.** There is no pass.

**Not in `run_all.sh`, deliberately.** A guard that reads participant data would
print it on every run, and would become a guard that cannot fail on the day the
data is clean. This is a one-time disclosure before an irreversible act, and its
output belongs on a terminal and nowhere else — never in `logs/`.

**The sign-off is the record.** The `git init` version is a `decision` entry whose
`--examined` names the disclosure and what was concluded. That is what stops the
check from quietly not having been run.

#### Gate 2 — before a testers' build

Can someone who is not the author annotate a text end to end without losing work
or hitting a wall?

| Sev | Item | Why here |
|---|---|---|
| — | ~~**B-093** morpheme `transliterations` settable nowhere~~ | ✅ both halves: type v3.14.193, transliteration v3.14.303 with **D32** |
| — | **D46** the pipeline audit | belongs *inside* this gate: the order the work takes is only observable while someone is doing it |
| — | a fresh-machine install | `setup.py` has never been run by anyone but its author |
| — | an annotator quickstart | the README documents the developer path; a tester needs half a page — open, annotate a word, save |

#### Gate 3 — before the first stable version

The theme is the data model: past this point there are users' files that must
keep opening.

| Item | Why it must precede stable |
|---|---|
| ~~**D52** the entry merge~~ | ✅ v3.14.291–292, all four stages. `dev/design/D52_entry_merge.md` |
| ~~**B-033** auto-linking has no definition~~ | ✅ v3.14.302. **D53 was the definition**, six stages, all closed |
| ~~**D32** one transliteration model~~ | ✅ v3.14.303. **B-045**, **B-093**, **B-142** and **B-145** closed with it |
| ~~**B-053 · D33** full-dictionary scans~~ | ✅ v3.14.309 · D33 retired v3.14.273. **Corrected twice, and this row carried the second error until v3.14.310**: L-014 named `pos` and `type` as the expensive pools; measured, they are 0.034 ms and 0.020 ms, and the expensive one is `AC_POOLS.gloss` at **0.248 ms** — a pool that did not exist when L-014 was written, and the only one whose length grows with the corpus rather than with a fixed inventory. Cached on `_dataGen` and the locale; the cheap two are deliberately left uncached |
| **B-027** POS not validated against `pos_tags.json` | ◑ guard half ✅ v3.14.214. What is left is the decision — refuse, warn or accept an unknown tag — and what to do about entries already carrying one. Both change annotation |
| **I2** unify the five row editors | I1 ✅ v3.14.210 · I6 ✅ v3.14.270 |
| **D48 stages C and D** | the remainder of the field table (`dev/design/D48_field_table.md`) |
| **D39** keyboard shortcuts | a tool used for hours at a stretch. Needs I2 first, and carries D43's debt: `[data-prov-tip]` has no focus state |

#### Gate 4 — can wait for the next stable

New capability rather than model correctness, plus the cosmetic tail.

| | |
|---|---|
| **Features** | D37 · D28 · D31 · D34 · D40 · D41 · D25 P3 · D20 · D24 · D29 P2 |
| **Bugs** | B-028 PDF page numbers · B-029 autocapitalize residue · B-035 two languages, one native name · B-094 five document fields stored and never shown |
| **Retired** | F5, the parse field as primary surface — on evidence 2026-08-29: D46's session put POS *before* the parse, so the parse is the pivot for what sits below it, not the opening move. **Half of it shipped anyway**: D53 stage E ✅ v3.14.300 built the per-segment lexicon offer under the parse field, which was F5's other claim. Only "primary surface" was retired (UNIFIED conflict ⑮, settled v3.14.310) |

---

### Data integrity · measured 2026-08-30

Two sweeps at v3.14.254: `dev/audits/retired/DATA_INTEGRITY_2026-08-30.md`
measured both corpora through the app's own loaders, and
`dev/audits/retired/L_STATUS_2026-08-30.md` re-verified every `L-nnn` finding
against the code. **Both retired v3.14.390** — the corpora they measured were
replaced by the fixture swap, so their figures describe files that no longer
exist. What follows is the part that was about the *format* rather than the data,
which is why it is still here.

**Referential integrity is clean.** Zero dangling `dict_id`, `lemma_id`,
`annotator_id` or `source_ids`; zero duplicate ids; zero unreferenced provenance
events; `morphological_parse` agrees with the morpheme list; word forms
concatenate to sentence text. A load-then-save loses nothing. **The format is not
losing data** — what follows is about what it never captured.

#### Attribution — the sweep's findings, all closed

| what the sweep measured | live at the time | closed by |
|---|---|---|
| `dict_id` links carrying a stamp | 1 of 92 | B-121, v3.14.260 |
| paragraph-level field stamps | 0 | B-138, v3.14.261 |
| list fields stampable at all | none | B-138, v3.14.261, per element |
| morphemes with a revision trail | 0 of 77 | B-134, v3.14.276 |
| derived word fields signed by a person | 13 of 13 glosses, 6 of 6 translits | B-141, v3.14.280 |

**The counts stay until an object is next edited: decided seed-on-next-write, not
migrate.** A stamp records what was believed when it was written, so nothing is
retro-corrected.

*B-134 turned out to be three defects — nothing appended, `applyProvToObj`
overwrote the creation stamp before seeding an empty trail, and no script ever
wrote `prov_history` at all. Its two prerequisites are closed: the SCHEMA prose is
reconciled to the field table, and `sentence.text`'s path was verified rather than
assumed — 0 of 12 means nobody has edited a sentence's text, not that the path is
missing.*

#### Model gaps, not data errors

| | |
|---|---|
| **19 of 33 lemma groups have no member entry** | tolerated by design (`lemma_id` is a per-occurrence annotation), but the group view shows nothing while the corpus claims membership. In 11 of the 19 an identically-formed entry was minted 1 ms later — one action, one half linked |
| **`homograph` set on 0 of 52 entries** | two morphemes glossed "swim" and "peel" both link to the one `yüz` entry glossed "hundred". Nothing can adjudicate. D35's remaining half meeting real data |
| **B-136** | `word_index` written by two writers, read by nobody |
| **B-139** | `source_ids`, `variants`, `constituent_forms` hold plain strings, so no per-element stamp. Changing the element shape is a format decision; all three are empty in both corpora, so it becomes urgent the first time somebody types a variant |

### Where things stand

**The guard count and the suite's standing state live in `dev/PRACTICES.md` §6**,
which is the only place either is written down — this paragraph held a second
copy and was 9 guards stale. The 2 disabled are the Search-B pair, whose
assertions are hand-typed Korean, waiting on the replacement corpus (D58). Setup,
fixtures and the corpus variable are in the same section.

### The audits

`dev/audits/AUDIT_INDEX.md` is the answer and the file to read: a verdict per
document plus what in each is false. `UNIFIED_AUDIT.md` §1 carries the **24**
`L-nnn` findings, 12 closed as of v3.14.272.

**No summary is kept here** — a second copy of the index is exactly what went
stale, for 128 versions. Two items the index does not cover:

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

| id | What | Size | Blocked by | State | Spec |
|---|---|---|---|---|---|
| ~~[D53](#d53-the-fill-pipeline)~~ | the fill pipeline (**B-033**) | — | — | **✅ COMPLETE v3.14.298–302** | `dev/design/D53_fill_pipeline.md` |
| [D54](#d54-interlinear-pinned-examples) | interlinear pinned examples | M | — (D32 ✅) | **PLANNED v3.14.301** | `dev/design/D54_igt_pinned_examples.md` |
| [D49](#d49-machine-parseable-lexicon-export) | machine-parseable lexicon export | S | — | **UNGATED v3.14.282** | `dev/design/D49_lexicon_export.md` |
| [D25 P3](#d25-p3-constituency-parse) | constituency parse | ? | — | unscoped | `dev/design/D25_dependency_parse.md` (P1/P2) |
| [D31](#d31-ordering-of-multi-entry-fields) | ordering of multi-entry fields | XS | I2 | REDUCED v3.14.273 | `dev/design/D31_multi_entry_order.md` |
| [D40](#d40-offer-the-annotators-own-earlier-work) | offer the annotator their own earlier work | M | — | re-scoped to word level; **B-144 ✅ v3.14.298 unblocked it** | `dev/design/D40_reuse_earlier_work.md` |
| [D41](#d41-reader-mode) | Reader Mode | B: S–M, A: M–L | D39 | not scheduled | `dev/design/D41_reader_mode.md` |
| [D39](#d39-standardized-keyboard-shortcuts) | standardized keyboard shortcuts | S | I2 | gate 3 | — |
| [D37](#d37-derived-forms-and-paradigms) | derived forms and paradigms | ? | — | not scheduled; owns `variants` matching since D35 C | `dev/design/D37_paradigms.md` |
| [D46](#d46-the-annotation-pipeline) | the annotation pipeline audit | M | — | gate 2, run it *during* annotation | `dev/design/D46_pipeline_ux.md` |
| ~~[D34](#d34-session-tracker--missing-annotation-panel)~~ | session tracker & missing-annotation panel | — | — | **✅ A–E, v3.14.306–319** | `dev/design/D34_session_tracker.md` |
| [D28](#d28-dictionary-senses) | dictionary senses | ? | — | findings only, not scheduled | `dev/audits/DICT_SENSE_AUDIT.md` |
| [D29](#d29-nllb) | NLLB diagnostics, then in-GUI download | P2: M | — | **P1 ✅ v3.14.63–64**, P2 open | `dev/design/D29_nllb.md` |
| [D24](#d24-language-porting) | language porting | ? | — | not scoped | — |
| [D20](#d20-corpus-combiner) | corpus combiner | ? | — | not scoped | — |

### D58: what the shipped test data contains

**✅ SPECCED v3.14.327 · SWAPPED v3.14.384 · LEGACY READERS DELETED v3.14.386.**
Full record: `dev/design/D58_fixture_set.md`, whose §§8–10 carry the execution.
*Compressed v3.14.387: this was a 76-line paraphrase of a record that is now
finished, and its "measured gaps" table had been re-taken twice in two places.*

**The finding, which is the part worth keeping.** `samples/` was serving two
audiences whose requirements are opposite: a user should see a corpus worth
imitating, and several guards need data no user should imitate — an empty
dictionary (**B-163**'s no-op is unreachable once a corpus is annotated once),
dangling references, an ambiguous form (**B-122** passed on luck), a pre-interning
file. Every
unresolved question in the audit was that one conflict. **So they were split by
audience:** `samples/` is exemplary and public; `dev/tests/fixtures/` holds
specimens, each named for the guard or bug it serves.

**What shipped.** Two typologically contrastive corpora — the pair is
load-bearing, not decorative: B-120, B-144 and B-027 were each invisible in one
of the two, and B-202 and B-203 were each invisible until one of them carried a
**multi-element list**. That last gap was the one D58 §1 said no fixture could
show the value of, and it has now paid for itself twice in three versions.

**Two decisions that still bind.**

- **No legacy parity, no legacy openability** (v3.14.329). The archived corpora
  are not required to keep opening — measured at v3.14.386, they no longer do.
  `samples/turkish-test` was **retired, not migrated**, and no old corpus is
  copied into `dev/tests/fixtures/`: those specimens are purpose-built or
  CLI-produced, which is the difference between a fixture and a keepsake.
- **A specimen with no reader is not a keepsake — delete it.** That is §3, and
  taking it deleted six reader paths, the `legacy` field tier and `legacyKey`.
  The one shape that survived the question was `corpus_ingest.py`'s output, which
  turned out to be a **current input format** standing in the audits as a
  historical one because the only file in it happened to be old.

**Still open, and it is annotation rather than code:** D58 §1 asked for one of
each annotation layer against a visibly unfinished remainder, and several
declared fields have no instance in either corpus — `comments` at every level,
`variants`, `allomorphs`, `selection`, `semantic_domain`, `usage_notes`,
`pinned_examples`, `section.source_ids`. **A field with no instance cannot tell a
reader that works from a reader that does not**, which is exactly what B-202 and
B-203 cost to learn.

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

### D53: The fill pipeline

**Specced 2026-08-31, complete v3.14.302.** **B-033** closed with it — the
linking half finished at v3.14.108/138, this was the filling half from
`ANNOTATION_FILL_AUDIT.md` §7.

**A ✅ B-144.** F1's precondition: every later stage makes the app write more
automatically, and doing that on inconsistent matching spreads the damage.
B-057 ✅ v3.14.112 was F1's other half. Measured before the fix: `turkish-test`
had **90 raw form keys against 85 folded** — the fable's content words, each
split by a sentence-initial capital — and `chinese-test` lost nothing, having no
case. Three accessors own the maps now.

**C ✅** the derive preview, shipped with A rather than fourth: it was the stage
silently rewriting data on every save.

**B ✅ v3.14.299**, the gloss pool: 72 rows from `turkish-test` and 110 from
Leipzig, own first, deduped as metalanguage.

**E ✅ v3.14.300**, the parse guide: each segment marked `unique` / `ambiguous` /
`none`, and one action that fills every unambiguous one and leaves the rest
alone. The audit's highest-leverage change for annotation speed.

**F ✅ v3.14.301**, and closing it took three answers rather than code. Its
headline — a rendered placeholder, never a stored one — shipped as B-059 at
v3.14.132; what sat under it was one real gap, one undecided format question and
one undocumented choice. The gap is **D54**, split out because PDF column
alignment is the whole of the work. The `-`-inside-a-gloss question is decided:
**warn, never rewrite, and the eventual control belongs to the annotator.** The
search choice is documented and guarded.

**D ✅ v3.14.302, and it closes D53 and B-033 with it.** F4's proposal was
already built in pieces under other numbers; what was left was the half F4 ruled
*against* — `inferPos`, uncalled since before v3.14.21, asserting one language's
gloss inventory and returning `N` for the rest. Deleted, and refused by shape.

**All six stages are closed.** The line that held throughout: these stages
*offer*, they do not apply. B-123's backfill writes links — derived-stamped,
visible, repairable — where a gloss or a part of speech becomes the record.

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

**Re-scoped v3.14.273 to word level, with the value measured.** Live: 22 word
forms recur; the tokens sharing a form disagree in **exactly one**. The
addressable set is **17 of 162 words** live, 19 of 98 sample. **Morpheme level is
dropped** — 0 of 77 live morphemes have an empty gloss.

**The one disagreement is a homograph**, which is why the D35 gate is real rather
than cautious: `yüzdüm` → `swim-PST-1.SG` and `peel-PST-1.SG`. **A prerequisite
the spec did not know it had: B-144** — D40 settles identity on `normForm` while
`S.wordFormRefs` is keyed on the raw form (101 keys against 99 folded). Four
rules it cannot avoid: **offer, never apply** · `normForm` for the object
language · homographs make it wrong sometimes · a copied field carries its own
provenance marker, naming the source occurrence.

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

### D34: Session tracker & missing-annotation panel

**✅ all five stages, v3.14.306–319.** The build account was 105 lines here and
is now where it belongs: `dev/design/D34_session_tracker.md` (stamped
v3.14.318), plus the edit-log entries for each stage. *Compressed v3.14.387 —
this section had become a second writer of that record, which is PRACTICES §4 in
the documentation rather than in the code.*

**What is still load-bearing, and would be re-derived wrongly without it:**

- **"Missing" is three reasons, not one.** *Derived when applicable*
  (`vacuousWhen` — a monomorphemic word has no parse), *inapplicable to the
  project* (`appliesWhen`, asked once — Latin-script Turkish wants no
  transliteration), and *genuinely missing*. A counter built from the `core`
  tier would have opened by reporting 301 missing parses and 130 missing
  transliterations, every one of them wrong. Both rules are declared in the field
  table by name and resolved in the app.
- **Punctuation is not a fourth reason** — it is `_navIsToken`, so the counter
  counts what D30 traversal lands on.
- **The tracked set is the annotator's, not the table's** (stage E). The queue is
  what is tracked and the fold is what is not: an `×` on a row, a **Track** button
  in the fold, no settings screen.
- **A counted field carries a second name.** The first render read *"3 sections
  need a source(s)"* — an editor label is not a field's name in a sentence, and a
  new counted field cannot arrive without both.
- **The panel counts the LOADED state, not the file.** They disagree by three on
  `morpheme.type`, because of the load-time fill pass, and the loaded state is
  what the annotator is looking at.

**One row is still a question for the annotator, not a finding.**
`paragraph.translations` is reported as missing in both corpora, and no join for
it exists in the app — the rule is documented only in the pre-G31 CLI's README.
Every sentence in both corpora is translated, so a paragraph translation would be
redundant with work already done. **Deciding it is the last thing between five
rows and four**, and it is the one part of D34 nobody has answered.

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
| **D61** | v3.14.362 | the lemma chip: the field proposes when it is empty, from the token's entry, the same form already lemmatised in this corpus (with its count), and the root the parse names written through `source/resources/citation_forms.json`. Source 4, string similarity, deferred by decision — it knows no morphology. Nothing writes; an accepted chip is stamped `derived`. `dev/design/D61_lemma_suggestion.md` |
| **D60** | v3.14.347–348 | a derived value never occupies the annotator's answer. The dictionary's bulk fill became an offer that shows what it would do; `storedWordGloss` made "typed" and "composed" tellable apart at both ends. Closed L-035, B-176, B-180, B-186. `dev/design/D60_derived_values.md` |
| **D59** | v3.14.343 | the document editor commits at Save and only there: every control edits a buffer, `saveDocument` is the only writer of `d.sections`. Closed L-036, B-175, B-178. `dev/design/D59_section_editor_commit.md` |
| **D57** | v3.14.331 | the morpheme route into the dictionary. `dev/design/D57_morpheme_dict_route.md` |
| **D55** | v3.14.330 | an explicit take overwrites, and `offerWrites` is the one predicate the chip and the fill both ask — which is what made B-108 findable. `dev/design/D55` (in `D53_fill_pipeline.md`) |
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
