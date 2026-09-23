# LingCoT: Development Practices
**Updated:** 2026-09-23 · **Version:** v3.14.412

How to work on this project. `DEV_PLAN.md` is *what* to build; this is *how*.
Every rule was bought with a bug, and the ids are kept: a rule without its
evidence is advice, and advice gets argued with.

| # | Rule | Read it before | Bought with |
|---|---|---|---|
| 1 | [Start a version with `new_version.py`, naming every file](#1-versioning) | any edit | v3.14.83, .257 |
| 2 | [Change a contract, then grep its call sites](#2-contracts) | changing what a function returns, means or costs | B-043→B-056, B-031→B-064, B-052 |
| 3 | [Return the fact, not the prose](#3-return-the-fact) | writing a check | B-064 |
| 4 | [Two writers of one thing means one is wrong](#4-one-writer) | adding a second writer | B-119, B-121, B-128, B-137 |
| 5 | [A declaration is only as good as what it admits exists](#5-declarations) | generating markup from a table | D48 stage B |
| 6 | [Execute, don't read; guard a rule, not an instance](#6-guards) | writing a guard | B-008, B-062, v3.14.97 |
| 7 | [A guard that cannot fail is not a guard](#7-hollow-guards) | writing a guard | 13 hollow guards |
| 8 | [Run the app, read `logs/`, ship to a clean machine](#8-running-it) | believing a green suite | B-022–B-025, B-062 |
| 9 | [Never log annotation content](#8-running-it) | any new log call | fieldwork licence |
| 10 | [Write docs table-first and short](#9-writing-docs) | any doc edit | v3.14.274 |
| 11 | [Assert on the FILE, not the object](#6-guards) | guarding anything a control writes | B-127, B-146, B-175 |
| 12 | [On a branch, change files; version numbers at release](#branches) | creating a branch | D40 (v3.14.411), v3.14.412 |

---

## 1. Versioning

**`python3 dev/new_version.py <slug> <files…>`** bumps, archives the named files
*before* you edit them, and stubs the entry. `--add` when the list grows;
`--type finding --examined "<artefact>"` for a review.

- **Pre-edit archiving is the whole mechanism.** Edit first and the file can only
  be recorded `(no pre-copy)`. If you slip, reverse the edit into the archived
  copy and replay forward to a byte-identical file — a post-edit copy filed under
  `_pre_` is worse than an absent one, because the guard then blesses it.
- **A finding that finds nothing still gets an entry.** Its absence is how a
  defect hides behind a green suite.
- `doc_integrity_test.js` enforces all of it — 15 checks on `edit_log.md`.

### Branches

**Set v3.14.412.** A version number is assigned on `main`, when a batch of work
reaches it, not when work starts on a branch. The stamp line in 12 files and
the top of `edit_log.md` are then only ever written on `main`, so two branches
never edit the same lines until one of them is released.

| on | start a change | commits | finish |
|---|---|---|---|
| `main` | `new_version.py <slug> <files>`: number assigned now, as before | subject gets `vX.Y.Z` | commit and push |
| a branch | the same command writes `dev/changes/<slug>.md` (`**Version:** pending`) and labels the build `<base>+<slug>` | subject gets `[<slug>]` | `new_version.py --release`, commit, `git merge --ff-only` into `main` |

| rule | why |
|---|---|
| **Commit on `main` before branching** | the branch starts from a clean, numbered tree |
| **A change file is a batch, not a commit** | one per D40 stage, say. It becomes one version and one edit-log entry; its commits are found by `[<slug>]` (`doc_integrity_test.js` §8b) |
| **Short slugs on a branch** | the slug is the build label in logs and bug reports: lower case, digits, `-`, `_`, at most 16 characters |
| **Release at a stage boundary, after `run_all.sh`** | the checked-out branch is the build used for annotation; `main` must stay usable |
| **`git merge --ff-only`** | linear history; fails loudly if `main` moved |
| **No squash merges** | a squash loses the `[<slug>]` commits §8b reads |
| **`main` moved while the branch was open** | merge `main` into the branch, keep `main`'s side of `source/version.py`, then `new_version.py --relabel` |
| **A fix that cannot wait for the release** | `new_version.py --main <slug> <files>` numbers it at once; merge `main` into the branch afterwards |
| **Before releasing a stage that changes the file format**, open a corpus saved by the branch build in the `main` build | D40 §5's compatibility claim, checked on real data |

Branch names: the feature id and a slug, e.g.
`d40-annotation-offers`. Delete the branch locally and on `origin` once its last
stage is released.

## 2. Contracts

**After changing what a function returns, means or costs, `grep` its name and
read every call site.** A minute's work; the highest-yield habit here.

| producer changed | consumer missed | result |
|---|---|---|
| B-043 gave `normForm` a four-layer key | dict browse kept bare `toLowerCase()` | B-056 |
| B-043 changed `normForm` again, 3 more sites | Leipzig filter, chip splice | B-056 again, v3.14.131 |
| B-031 made `checkLangForBackend` return prose | the pane re-derived its own message | B-064 |
| B-052 indexed the lemma lookup | nothing; caught by a scale question | 113 ms/save at 50k, 3 versions |

**Cheaper forwards.** B-059 read the call sites *before* adding `gaps` to
`wordGloss`, so it shipped opt-in — five display callers took it, three logic
callers did not. As a default it would have put a placeholder into search
matches, the index, and a `=== 'PUNCT'` test.

## 3. Return the fact

**A producer that returns PROSE serves exactly one consumer.** Return
`{ reason, lang, suggestions }`; let each caller choose its words. B-064 was one
function returning a finished sentence in one register for two registers.

## 4. One writer

**When two writers do the same thing, one is wrong and you cannot yet tell
which.** Four in one week — B-119 (two discriminator vocabularies), B-121 (six
writers of a dict link, one stamping), B-128 (thirteen private corpus parsers),
B-137 (ten writers of a prov stamp, one interning). Each fix was one chokepoint
plus a guard asserting there is only one. The question that finds them is not
"is this correct" but **"would a change here reach every place that does this".**

## 5. Declarations

**A declaration is only as good as what it admits exists.** D48 stage B generated
five levels of markup from the field table and produced six defects of one shape:
a detail the markup carried that the table did not. Every fix was to declare the
thing, not special-case it. Expect it again whenever something starts reading the
table that did not before.

## 6. Guards

**96 in `dev/tests/`. `run_all.sh` runs 94 by default — 94 pass, 0 disabled;
`--slow` adds `nllb_diag_test.py` and `gui_crud_test.js` for 96.** Run `--slow`
before a release.

**Two guards came out of gate 2 rather than out of the code.**
`printed_commands_test.js` (v3.14.394) exists because a *fresh-machine install*
was actually performed; `quickstart_labels_test.js` (v3.14.395) because writing
documentation for a stranger is its own kind of execution — it found three names
`README.md` still uses that the app does not have.

**Nothing has been dark since v3.14.385**, when the two search guards were
re-pointed from the Korean fixture retired at v3.14.120 at last. The count held
at 89 through v3.14.388's rename, which retired `search_parity_test.js` and added
`search_invariants_test.js` in its place — a replacement, not a deletion: what it
compared against is gone, and what it asserts now needs no second engine. They had been
disabled for 265 versions, which is the number worth remembering: a guard that
disables itself honestly is still a guard that is not running, and the honesty
is what made it comfortable to leave.

*This is the ONE place the count is written down.* `DEV_PLAN.md` and `BUGS.md`
each carried their own copy and both were stale by v3.14.349 — 70 and 77 against
an actual 79, which is PRACTICES §4 in the documentation rather than in the code.
They point here now, and `doc_integrity_test.js` counts the files and checks this
line, so it cannot drift again without a red suite.

### Three modalities, and what each one cannot see

| guard reads | catches | blind to | cost |
|---|---|---|---|
| source text | shapes, ids, coverage, drift between table and markup | anything only true at runtime; a type change (B-024) entirely | ms |
| the app in `_dom.js` | throws during evaluation and render | anything that needs layout, a real event, or a value read back | ms |
| the app in `_gui.js` | what a control does to a **file** | pixels — by design; nothing here looks at one | 42 s + a 195 MB Chromium |

**A SHAPE IS NOT A BEHAVIOUR.** B-183 shipped twice, and both times a guard
asserted the shape of the handler — the calls it makes, in the order it makes
them — while the control did not work. The second attempt was worse than the
bug: it could not toggle at all, and the guard was greener than before. When the
claim is *what a control does*, only the third modality can hold it; a source
guard can hold the STRUCTURE that makes the behaviour possible, which is a
different and weaker promise, and it should say which one it is making.

`_gui.js` runs `LingCoT.html` in headless Chromium and supplies the one thing a
browser lacks, `window.pywebview.api`, backed by a real directory. Everything
above that line is the shipped app. **It is a release check, not a save check**,
and is in `SLOW` for two reasons that are not the same: 42 s, and a browser a
clone does not have — without it the guard exits 2 and every default run would
carry a permanent DISABLED line.

**Three defect classes are invisible to the other two by construction:**

| class | instance |
|---|---|
| a selector that does not match its markup | `.sec-del-btn` exists once in the codebase — in the handler that looks for it. Section delete does nothing (B-175) |
| a value that lives in memory and dies in the serializer | B-127, seventeen versions of `field_prov: {}` |
| a declared contract nothing implements | `fold: 'upper'` on `part_of_speech`, read by no code (B-177) |

**Assert on the file, never on `S.docs`.** The object the writer was handed is
not the bytes it produced; B-127 is the whole argument. `_gui.js` exports
`readCorpus` / `walkWords` / `walkSents` so a check reads back what a reload
would see.

**A delete check that asserts only the outcome passes when the button is
dead.** The first draft of `gui_crud_test.js` D-scenario did exactly that: it
answered No to the confirm, found the section still present, and reported `ok` —
with no confirm ever raised. Assert that the app **asked** before asserting what
it did. §7 is the same lesson from the other end.

| | |
|---|---|
| corpus | `LINGCOT_TEST_CORPUS=<corpus dir>`, or the **13** corpus-dependent guards fail by design. Point it at the corpus dir itself — `_fixture.js` recurses, so a parent holding an old backup hides the difference |
| fixtures differ | `samples/` and the live corpus are not interchangeable; `dep_root_test.js` fails on the live corpus deliberately, which has no dependency parses (B-125) |
| runtime | 5.8 s default. `nllb_diag_test.py` is 14.4 s of real subprocess waits — it waits out the 1.5 s early-exit window B-016–B-018 lived in, so the time *is* the test |
| output format | `  ok   <label>` / `  FAIL <label>`, then `N passed, M failed`. A guard picks its granularity, not its format (v3.14.136, when 7 guards printed dots and were invisible to anything reading the suite) |
| cost | not runtime — **384 KB that must move when the app moves**. Relocating them once broke 26 path anchors |

**Three principles, each bought with a bug:**

| | |
|---|---|
| **Execute, don't read** | every guard once inspected source *text*, so three stayed green through an S1 render crash (B-008, and B-062 later) |
| **Tell the cache when the screen changes** | a handler that changes what is shown without changing nav state or `_dataGen` must null `_renderCacheKey` before `render()`, or repaint directly (B-008, B-011, B-019) |
| **Read the logs; do not enlarge them** | B-008 sat captured in a log for three months because nothing looked |

**Guard a RULE, never an instance.** Set 2026-08-25, after the suite grew 26 → 33
in a day and **not one of that day's eighteen bugs was found by it**.

| the bug taught us | verdict |
|---|---|
| derived state must refresh at the mutation chokepoint | rule — guard it |
| importing is not calling, calling is not reaching | rule — guard it |
| what looks interactive must be reachable, operable, derived | rule — guard it |
| the export modal binds its own listeners | pin — fold into the rule |
| the section title has `role=link` | pin — fold into the rule |

Three pins merged into `ui_wiring_test.js` at v3.14.97, and the merged guard
immediately found a mouse-only annotator link none of the three looked at.
**Prefer generalising an existing guard to adding one** — a new file is
expensive, one more assertion in a guard that already reads that file is nearly
free. **Extend `render_untranslated_test.js` whenever a renderer gains a new
empty/missing-data branch**; nobody exercises those by hand.

## 7. Hollow guards

**Verify every new guard against a known-bad archived copy. Mutate by prepending
`return null;`, not by deleting the body** — deleting flatters any guard that
greps that body, which then fails on the text disappearing rather than the
behaviour changing. Text-preserving mutation at v3.14.254 found three guards
fully green with ten functions disabled and 166 assertions between them (B-131,
B-132). **Score per guard, not suite-wide:** one number hides that the
behavioural guards score 6 of 6 while the static ones score by accident.

**Thirteen guards once reported success while checking nothing** — sharper than
missing coverage, because a green suite discourages looking:

| how | n |
|---|---|
| vacuous on first write — scope closing on `${}`; a `\b` that can never match before `§`; `Math.max()` of `[]` | 4 |
| matched explanatory prose in their own removal comments | 3 |
| `workspace_test.js`, three ways (B-022, B-023, a non-existent `v.py` filed as "not analysed") | 3 |
| `doc_integrity_test.js` filename regex excluded `/` | 1 |
| `dep_root_test.js` bare `try/catch` printed "0 of 0" as `ok` | 1 |
| `venv_tier_test.js` matched an unrelated `extra_map` | 1 |

Stated once: **importing is not calling, calling is not reaching, and "could not
be analysed" must never render as "it is fine".** A type change (B-024) is
invisible to source-reading entirely.

## 8. Running it

| | |
|---|---|
| **Launch it** | B-022–B-025 were all found this way, guards green throughout |
| **Read `logs/`** | `node dev/tests/log_triage.js` does it; it caught B-024 unprompted and fails the suite on any unacknowledged WARNING+. Verbosity was deliberately not increased |
| **Never log annotation content** | human-source fieldwork with publication restrictions, in files that persist 20 sessions unaudited |
| **Install the hooks, and check git's mode not the file's** | `git config core.hooksPath hooks` covers both. Then `git update-index --chmod=+x hooks/*` — **not `chmod`**: git runs a hook only if it is executable *in the index*, says nothing when it is not, and `chmod` changes only the checkout. That divergence is **B-209**, and it meant the fieldwork refusal never ran on a clone. `hooks_executable_test.js` asks git |
| **Package to a clean machine before believing green** | one hour found B-062, which eight versions of local work missed: `log()` never existed, but a corpus was already open locally so `applyCorpus` was never re-entered |

## 9. Writing docs

**Set v3.14.274.** The live docs had become prose that had to be read to be
navigated, when they are read mostly to answer "what is open, what blocks it,
what state is it in".

| rule | why |
|---|---|
| **Every section opens with a table** | status, blocker and size answerable without reading the body |
| **Cells are fragments, not sentences** | a table you read line-wrapped is a paragraph with pipes |
| **One reason, once** | reasoning lives in the design doc; the live doc carries the decision and a pointer |
| **Update a number, don't append to it** | `N` → `M`. If it needs a note: `N → M after <what>`, one clause |
| **No roll-calls of what is done** | `✅ vN` inline, or one row in the completed index. Never a paragraph |
| **Strike-through is transitional** | a struck item is deleted at the next doc pass, not carried |

**Never shortened away** — tooling and grep depend on these: `B-nnn` and `Dnn`
ids · `### Dnn` headings · cross-refs in the `see Dnn` / `§2 Dnn` shapes · named
`dev/*.md` paths · the `**Updated:** … · **Version:** …` stamp on line 2 · BUGS'
`### B-nnn · Sn · title` headings and `| **B-nnn** |` fixed rows · BUGS' summary
counts. `doc_integrity_test.js` checks every one; run it after any doc edit.

**Where displaced prose goes:** `dev/design/<Dnn>_<slug>.md` for a feature's
reasoning, `dev/audits/` for findings. Both are FROZEN — stamped with the version
they were written against, never bumped. A `Dnn_` design file must be named in
`DEV_PLAN.md` or the orphan check fails.

**`edit_log.md` entries are SHORT:** what changed · why · the guard · verification.
400-word cap, enforced, waived only when the entry names an audit. Detail a
future reader needs belongs in a **code comment**, read at the point of use
rather than found by archaeology.

**Restructuring a doc: parse on entry boundaries and assert counts on both
sides.** Never slice a range between two anchors — that deleted four DEV_PLAN
sections, and later B-009 from BUGS.md, on one day. `assert count == 1` protects
the anchor and says nothing about what the range swallowed.

**"Documentation is current" decays silently** — 128 versions here, while this
file claimed one audit was open and five had residue. `dev/audits/AUDIT_INDEX.md`
carries that status, is bumped with the version, and is **the only place it
should be stated**.

---

## 10. Swapping the fixture corpora

*Moved here from `DEV_PLAN.md` §1 at v3.14.398. It was written before the
v3.14.384 swap and says of itself that it is **written for the next swap, not
kept as history** — which makes it a practice, not a plan item. Gate 1 is taken;
this procedure is not spent.*

**The risk was never the corpus, it was the redirection.** Twenty guards resolve
their input through `_fixture.js`, and until **B-168** (v3.14.326) that resolver
returned the first substring match in a recursive sorted walk — so pointing
`LINGCOT_TEST_CORPUS` at a directory holding an `archive/` handed the suite an
archived corpus and reported the language's name.

**Keep this procedure.** It is written for the next swap, not kept as history:

| | step | why |
|---|---|---|
| **1** | `unset LINGCOT_TEST_CORPUS`, run the suite, record the tally | `corpusDir()` prefers the env var over `samples/`, so a stale export silently keeps the old data through the entire swap |
| **2** | stage the candidates in a directory holding **only** them, and rehearse: `LINGCOT_TEST_CORPUS=<staging> ./dev/tests/run_all.sh` | the whole migration, reversibly, before a file moves. **"Only them" is load-bearing**: a directory with an `archive/` beside the candidates is what B-168 refuses to guess between, and **B-199**'s fork put two `turkish-test` corpora in one directory for six versions — six guards refused and one could not find a companion |
| **3** | fix what step 2 names — in the CORPUS where it is a data problem, in the code where it is a code problem | the distinction matters: a guard failing on real data is usually the guard being right |
| **4** | replace `samples/`, `unset`, run again, and compare to step 1's tally | the two runs must differ only where step 3 predicted |
| **5** | `python3 dev/tools/ship_disclosure.py`, sign off, `git init` | gate 1's other half. **✅ TAKEN v3.14.391**, and the first commit refused by `hooks/pre-commit` — **B-206** ✅ v3.14.392 |

**What it bought, measured.** Steps 1–4 ran at v3.14.384: the post-swap run was
**identical to the step-2 rehearsal, check for check** — `diff` of the two
per-guard tallies was empty. Against step 1's baseline five guards moved, all in
check COUNTS and none in outcome.

**What it bought, measured.** Steps 1–4 ran at v3.14.384: the post-swap run was
**identical to the step-2 rehearsal, check for check** — `diff` of the two
per-guard tallies was empty. Against step 1's baseline five guards moved, all in
check COUNTS and none in outcome. That is what rehearsing is for, and it is the
first time it was collected.

