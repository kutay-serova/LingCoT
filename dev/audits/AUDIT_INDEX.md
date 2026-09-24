# AUDIT INDEX: every audit and design document, what it is worth, and what in it is false
**Updated:** 2026-09-23 · **Version:** v3.15.0

This file is **live**. `new_version.py` stamps it and `doc_integrity_test.js`
checks it, which is the whole reason it exists: the frozen documents it indexes
carry a version stamp but nothing has ever checked whether their *claims* are
still true. Twelve of them turned out to assert, in the present tense, things
the code contradicts.

It replaces the table in `DEV_PLAN.md` §1, which was itself wrong in five places
(§3 below).

| § | What is in it |
|---|---|
| [0. How to read the verdict](#0-how-to-read-the-verdict) | LIVE · SPENT · WRONG · MOOT · IMPLEMENTED |
| [1. The index](#1-the-index) | one row per document — verdict, open items, retire? |
| [2. What is false in each](#2-what-is-false-in-each-in-order-of-how-much-damage-it-does) | claims 6–31, per document, that would mislead someone acting on them |
| [3. Where DEV_PLAN was wrong](#3-where-dev_plans-own-audit-table-was-wrong) | the table this file replaced |
| [4. Numbers that disagree](#4-numbers-that-disagree-across-live-documents) | reconciled, and still disagreeing |
| [5. Documents with no owner](#5-two-live-documents-with-no-owner) | nothing bumps them, no guard reads them |
| [6. Retirement](#6-retirement--done-v314230) | done v3.14.230 |
| [7. The v3.14.310 re-check](#7-the-v314310-re-check) | every open item, re-verified against the code |

---

## 0. How to read the verdict

| verdict | meaning | what to do with it |
|---|---|---|
| **LIVE** | still generating work; findings open | read it, act on it |
| **SPENT** | every finding closed; kept for the reasoning | read for history, never for status |
| **WRONG** | asserts things about the code that are no longer true, in the present tense | **do not quote without checking**; either corrected or retired |
| **MOOT** | its subject was deleted or the question was answered elsewhere | retire |
| **IMPLEMENTED** | a decision record whose decision has shipped | read for why the code is shaped as it is, never for what is left |

A document can be both LIVE and WRONG. Several are. That combination is the
dangerous one, because the open findings lend credibility to the false ones.

**Method.** Each document was read in full and every finding checked against the
code and the live corpus. Verdicts cite what was found, not what the document
claims about itself.

**Re-checked in full at v3.14.310** — every open item in all sixteen documents,
against the code and both live corpora, by six independent passes. What it found
is in §7. The short version: **of the items recorded open, about a third were
already answered**, and two documents this index calls LIVE declare themselves
frozen in their own headers.

**Re-checked at v3.14.252** against the code, and in places at v3.14.266–272 where D51 moved the ground under an entry (items 9, 11, 23). Entries whose action is finished
are kept to a line or two saying what was wrong, what was done and when; entries
still outstanding keep their full detail, because that detail is the instruction
for doing the work. No indexed audit has been corrected in place since
v3.14.230, so every sentence listed in §2 is still readable as true in its own
document unless the entry says otherwise.

---

## 1. The index

| document | written against | verdict | open items | retire? |
|---|---|---|---|---|
| `UNIFIED_AUDIT.md` | v3.14.221 | **LIVE** | **Its own Status block is the count — this row deliberately does not copy it.** It did until v3.14.379, and said *"read the Status block at its head — it is the count"* in the same breath as a stale copy of that count: 28 closed / 12 open here against 32 / 8 there. A second writer of a number, in the document whose whole job is saying which numbers have drifted. §6 (v3.14.313) added L-025 to L-030 from the code audit | no, now the live audit of record |
| `INPUT_UX_AUDIT.md` | v3.14.158 | **LIVE**, §1 wrong throughout | ~~I2~~ ✅ **v3.14.404** · I5, I13, I14 · I12 partly built. **I2 is built as §3.1 specified it** — one descriptor, one add, one remove, one reader — and `sel` is in it rather than excluded, because its two differences are declarable. The audit's *five* was right for what it scoped; the app had grown two more row families (morpheme, section) which carry parse and ingest logic and were deliberately left out | no |
| `GUI_DESIGN_AUDIT.md` | v3.14.34 | **LIVE** | F13 · F3, F8, F10, §4.2 all **partly** closed (item 32) | no |
| `SEARCH_B_DESIGN.md` | v3.14.38 | **LIVE** | n-grams, stoplist, CSV export, pagination | no |
| `ANNOTATION_FILL_AUDIT.md` | v3.14.109 | **SPENT**, prose wrong | **none.** `inferPos` deleted ✅ v3.14.302 · F2 ✅ v3.14.299 · F5 ✅ v3.14.300 · B-058 ✅ v3.14.267 · F3 ✅ v3.14.269 · F4's residue ✅ v3.14.266 | no — needs correction |
| `DICT_SENSE_AUDIT.md` | v3.14.53 | thesis LIVE, evidence **WRONG** and now unmeasurable as written | D28, unscheduled. Re-measure on `chinese-test` — the live `turkish-test` has no dictionary (item 33) | no |
| `PIPELINE_AUDIT.md` | v3.14.76 | **LIVE**, numbers wrong | ~~S1 (git)~~ **✅ v3.14.391–392** · S6 (release). Its 2.1 recommended freezing `dev/archive/` once git holds history; v3.14.393 took the other route — keep the *property*, ask git for it (conflict ⑪) — so the freeze is now a disk question, not a guard question | no — needs correction |
| `DATA_MODEL_AUDIT.md` | v3.14.31 | **SPENT**, §1 wrong | F1/R28 dual representation | §1 only |
| `SCRIPTS_AUDIT.md` | v3.14.149 | **SPENT** | S5 — **answered v3.14.313**: `corpus_optimize.py` still does what its *Usage* and *Output* say; its STRUCTURE map names three functions that do not exist (L-030) | title needs a strikethrough |
| `DOCS_AUDIT.md` | v3.14.100 | **SPENT**, inventory wrong | none | inventory only |
| `ANNOTATION_UX_AUDIT.md` | v3.14.21 | **SPENT** | none | keep as history |
| `retired/DATA_INTEGRITY_2026-08-30.md` | v3.14.256 | **MOOT** — *both* corpora it measured are gone. The fixture half it was kept LIVE for was `samples/turkish-test`, retired at v3.14.384, and the live half became a shipped fixture and has been annotated since (item 34) | none. §5, on what the format cannot express, is schema and outlives the data | ✅ retired v3.14.390 |
| `GUARD_MUTATION_2026-08-30.md` | v3.14.259 | **LIVE** | recs 3 and 5 only; 1, 2 and 4 done, 6 and 7 answered by keeping (item 35) | no |
| `GUI_MODALITY_2026-08-31.md` | v3.14.341 | **SPENT** | nothing open. B-175, B-178 ✅ v3.14.343 · B-176 ✅ v3.14.347 · B-177 ✅ v3.14.355 — and B-183, B-186, B-187 came out of the same guard afterwards. Its follow-up (`_gui.js` printing the version it ran against) was already done when it was written. **The run it describes was 31/6; at v3.14.355 the same guard is 46/0** | no — it is the record of what the third modality found on its first run, and that is worth keeping |
| `retired/L_STATUS_2026-08-30.md` | v3.14.254 | **SPENT / FROZEN** — its own header says so, and this index was wrong to call it live | none. Six of its nine "still open" have shipped; it predates L-023 and L-024 entirely, and the audit now runs to L-042 (item 36) | ✅ retired v3.14.390 — UNIFIED's own table is the reconciliation |
| `UX_CLUSTER_2026-08-30.md` | v3.14.272 | **FROZEN** — its own header says so | none. D32 ✅ v3.14.303 and **all five** of B-141…B-145 are fixed; D31, D37, D40 live on in DEV_PLAN, not here (item 37) | keep as the measurement record |
| `I18N_AUDIT_2026-09-24.md` | v3.14.419 | **SPENT** (`tb-strings`) | none. All of §2 moved to `en.json`; `i18n_literal_test.js` guards it. **Incomplete as written:** a pseudo-locale sweep of every view found 23 strings its scanner could not see (labels passed to helpers, label arrays, a pluralised count, the unknown-annotator fallback) plus S7; the scanner now catches the helper-argument case | no, it is the record of the method and of what it missed |
| `retired/LINKING_AUDIT.md` | v3.14.105 | **WRONG** | `variants` has no consumer | ✅ retired v3.14.230 |
| `retired/LEMMA_LAYER_AUDIT.md` | v3.14.139 | **MOOT** | none | ✅ retired v3.14.230 |

**`dev/design/` — all 27, added v3.14.390.** This index carried **six** of them
for 250 versions and every record from D29 to D61 was absent, which made it a
partial index reading as a complete one. They are here because a design record
answers the same question §1 asks of an audit — *is this still true, and is
anything still owed?* — and DEV_PLAN §2 only lists the ones still open.

| document | written against | verdict | open items | retire? |
|---|---|---|---|---|
| `D25_dependency_parse.md` | v3.14.134 | frozen design | D25 P3, constituency | no |
| `D27_selection.md` | v3.14.134 | frozen design | none | no |
| `D29_nllb.md` | v3.14.274 | frozen design | **P2**, in-GUI download; the venv-consent question is undecided | no |
| `D30_navigation.md` | v3.14.134 | frozen design | none | no |
| `D31_multi_entry_order.md` | v3.14.274 | frozen design, **REDUCED** | one ▲▼ control, gated on I2; "is position meaning?" decides B-139 | no |
| `D32_transliteration_model.md` | v3.14.303 | **IMPLEMENTED** v3.14.303 | none | no |
| `D34_session_tracker.md` | v3.14.318 | **IMPLEMENTED** A–E, v3.14.306–319 | one, and it is a question for the annotator, not code: `paragraph.translations` | no |
| `D35_homographs.md` | v3.14.282 | **IMPLEMENTED** A, B1–B6, C | residue **B-114**, a discriminator on a lemma record | no |
| `D37_paradigms.md` | v3.14.274 | frozen design | all of it; owns `variants` matching since D35 C | no |
| `D40_reuse_earlier_work.md` | v3.14.274 | frozen design | all of it; **B-144 ✅ v3.14.298 unblocked it** | no |
| `D41_reader_mode.md` | v3.14.274 | frozen design | both modes; A needs D35's identity rule, B is near-promotion | no |
| `D46_pipeline_ux.md` | v3.14.274 | frozen design, **appended v3.14.408**: the word-editor field order is decided ahead of the audit (transliteration, POS, word gloss, parse, morpheme rows, lemma) and the two word-level *Gloss* labels are scoped | the audit itself, gate 2, to be run *during* annotation, against the order **built v3.14.409** and guarded by `field_order_test.js` | no |
| `D48_field_table.md` | v3.14.262 | **IMPLEMENTED** A–C + the v3.14.262 extension | none. The `legacy` tier it declared was deleted at v3.14.386 | no |
| `D49_lexicon_export.md` | v3.14.274 | frozen design, **UNGATED** v3.14.282 | the writer, and two decisions held until it is built: the format, and whether attribution re-expands `annotator_id` | no |
| `D50_save_migration.md` | v3.14.252 | **IMPLEMENTED** — stages 0–4 by v3.14.252, stage 5 at v3.14.384 | none | no |
| `D51_add_to_dictionary.md` | v3.14.271 | **IMPLEMENTED** v3.14.263–271 | none | no |
| `D52_entry_merge.md` | v3.14.288 | **IMPLEMENTED** A–D, v3.14.291–292 | none | no |
| `D53_fill_pipeline.md` | v3.14.297 | **IMPLEMENTED** all six stages, v3.14.298–302 | none. Closed **B-033** with it | no |
| `D54_igt_pinned_examples.md` | v3.14.301 | frozen design, **planned** | the whole build; the work is `fpdf` column alignment | no |
| `D57_morpheme_dict_route.md` | v3.14.324 | **IMPLEMENTED** all three stages, v3.14.331 | none | no |
| `D58_fixture_set.md` | v3.14.327 | **IMPLEMENTED** — swap v3.14.384, §4.2 v3.14.385, §3 v3.14.386. **Its §§0–6 still read "not built"**; the header was restamped at v3.14.390 and §§7–10 carry the execution | §1's remaining ask is **annotation, not code**: `comments`, `variants`, `allomorphs`, `selection`, `semantic_domain`, `usage_notes`, `pinned_examples`, `section.source_ids` have no instance in either corpus | no |
| `D59_section_editor_commit.md` | v3.14.343 | **IMPLEMENTED** v3.14.343 | none | no |
| `D60_derived_values.md` | v3.14.346 | **IMPLEMENTED** §1 v3.14.347, §2 v3.14.348 | none | no |
| `D61_lemma_suggestion.md` | v3.14.362 | **IMPLEMENTED** sources 1–3, v3.14.362 | source 4, string similarity — **deferred by decision**, not owed | no |
| `D62_list_field_presentation.md` | v3.14.408 | **C IMPLEMENTED v3.14.410**; A and B decided, not built. Three decisions: A per-element identity for the five string lists, B dispatch-on-shape deferred, C the read-only list presentation | A is gate 3 and first in it; B's trigger is **D28 or D37** | no |
| `file_layout_options.md` | v3.14.227 | **IMPLEMENTED** v3.14.250 | none | no |
| `save_architecture_options.md` | v3.14.227 | **IMPLEMENTED** v3.14.250 | none | no |
| `save_format_decision.md` | v3.14.232 | **IMPLEMENTED** v3.14.250; measurements a fifth high, **admitted in the document itself at v3.14.390** (new §10) | §9's open question: nothing has instrumented `doAutoSave` with a per-save counter | no |

**The three save and layout documents are decision records whose decision has
shipped.** D50 was taken at v3.14.233 and is complete: stages 0 to 4 landed by
v3.14.252, and stage 5's fixture swap at **v3.14.384**. Read them for why the
format is shaped as it is, not for what is left.
`save_format_decision.md` carried a false number for 158 versions: it measured
everything at 1,272 characters per fully annotated word and stage 4 brought that
to 1,050, so its disk, load, heap and save columns are about a fifth high. **Its
own new §10 says so as of v3.14.390** — appended rather than corrected in place,
because a brief is evidence of what was known when a decision was taken. The
constraint it names, heap rather than V8's string ceiling, is unaffected, and so
are the ratios between its four options: all the columns move together.

---

## 2. What is false in each, in order of how much damage it does

Only claims that would mislead someone acting on them. Line numbers are excluded
— nearly all have drifted, which is expected of a frozen document. **Numbering
runs 6–37 and does not restart**, so existing references still resolve; the
retired documents' entries were condensed at v3.14.252.

### LINKING_AUDIT.md — retired v3.14.230

| the claim | what is true |
|---|---|
| §6 *"there is **no UI anywhere** that links a token to a chosen entry"* · every `e.type === 'lemma'` predicate · §0's coverage table | named in its own retirement banner. Lemmas moved to their own registry at v3.14.184, so re-running its walker reports a **phantom dangling-link bug** |
| §2: the dictionary editor "discards the link, silently" | it calls the shared resolver |
| §6: *"the `#ew-lemma` datalist is a string autocomplete"* | no field uses a `<datalist>`; the eight occurrences left are comments — one of which still mentions the completion modal, retired v3.14.269 |

Coverage re-measured v3.14.250 through the app's own loaders, over 162 words and
77 morphemes: `word.dict_id` **9.9%** · `word.lemma_id` **22.2%** ·
`morpheme.dict_id` **98.7%** · `variants` **0%** · **0 dangling**. Open residue:
`variants` still has no consumer.

### ANNOTATION_FILL_AUDIT.md — correct in place

| | the claim | what is true |
|---|---|---|
| 6 | §2 *"the app does not have one notion of 'same form'. It has four."* | **adjudicated v3.14.272, §4 below.** This file said three, UNIFIED said five, B-033 said four — all counting different sets, and this line, by its own admission the most-quoted sentence in `dev/audits/`, was the one being quoted |
| 7 | §3 *"re-tokenization silently discards annotated tokens"* | the save aligns and confirms (`confirmAnnotationLoss`) |
| 8 | §4 *"the app's own export produces misaligned IGT"* | false since B-059 |
| 9 | §6 dict-add POS `'affix'` "is not in `POS_CHOICES`" | it emitted `'AFFIX'`, which is — and the surface retired v3.14.270, so the correction is a note about a screen that is gone |
| 10 | §6 dict-edit gloss back-propagation "attributed to the human" | `_derivedFieldProv()`, and since v3.14.267 through the one tail (`backPropagate`) both routes share |
| 11 | F4 reads as unbuilt | **it shipped** — `data-offer-pos` → `_fillMorphRows`; DEV_PLAN repeated the error. Its residue (`_dictFillForForm` dropping `part_of_speech`) ✅ v3.14.266, offer-only and guarded: a morpheme never INHERITS a POS from the lexicon, and that rule is asserted rather than written in prose |

### DATA_MODEL_AUDIT.md — cut §1

| | the claim | what is true |
|---|---|---|
| 12 | §1's record shapes — `type: 'lemma'` entries, `saveEntrySheet`, the Entry Sheet, `field_prov` as an object per field | **every shape §1 draws is now wrong in at least one key**, and §1 is what a newcomer reads first. Since D50 stage 4: `field_prov`, `prov` and `prov_history` hold an integer index into a per-file `prov_events` table; every row carries `record_type`; `alternate_forms`, `definition` and the lemma residue are dropped on load |
| 13 | the banner's *"G28–G34 all shipped"* | reads as though F1/R28 were resolved. G28 shipped a **chokepoint**, not a single source of truth — the parse string and `morphemes[]` are still two representations healed at load |

### DICT_SENSE_AUDIT.md — re-measure before D28

| | the claim | what is true |
|---|---|---|
| 14 | §2.3 *"the multi-entry channel is carrying the lemma layer"*, so senses would make homograph selection ambiguous | **its main structural objection, and it has evaporated** — lemmas left that channel at v3.14.184. **D28 is easier than this document says, not harder.** *Corrected v3.14.310:* "the live dictionary has 0 duplicate entry forms" is no longer true — `chinese-test` has one form carried by two entries, both numbered by `numberAllHomographs` (B-143 ✅ v3.14.290). The thesis survives; the channel is homographs now, and it is in use |
| 15 | every count in it (`ucak_dictionary.jsonl`, "155 and 49 entries", the §4 call-site table) | measured on fixtures that no longer exist. *Re-measured v3.14.310 and the "2–10× larger" is wrong in direction*: four of the six sense fields have **fewer** sites than in 2026-08-06 (`semantic_domain`, `usage_notes`, `pinned_examples`, `selection`), because D48 moved field emission into `field_spec.js`. Only `gloss` and `meaning` grew |
| 16 | §5 *"four features shipped without ever being rendered in a browser"* | the app has been used for real annotation since — and this sentence is the sole justification for *"do not start this next"* |

### PIPELINE_AUDIT.md — correct in place

| | the claim | what is true |
|---|---|---|
| 17 | *"a trap if git is initialized as-is: `.gitignore` line 2 excludes `dev/`"* | already fixed in the **opposite** direction — `.gitignore` explicitly ships `dev/`, so **acting on this sentence breaks a correct file**. The real trap is `dev/BUGS.html` and `dev/DEV_PLAN.html`, 1.3 MB of stale renders that are *not* ignored |
| 18 | *"88 MB, 403 files, 186 HTML copies"* | **220 MB, 1,474 files, 302 copies** at v3.14.310 (154 MB / 1,060 / 274 at v3.14.252). Anyone quoting the original to defer the git migration is 60% low, and the gap widens every version |
| 19 | *"a 26-guard suite"* | **73 executables** at v3.14.310, 18,988 lines against the application's 21,196 |

### DOCS_AUDIT.md — cut the inventory

| | the claim | what is true |
|---|---|---|
| 20 | *"only `DICT_SENSE_AUDIT.md` remains an open finding"* | five audits have residue. It had also been copied into `PRACTICES.md`, corrected v3.14.229; `DOCS_AUDIT.md` still carries it |
| 21 | its "what exists now" table | `~/LingCoT/README.txt` was renamed `~/LingCoT-Data` at v3.14.146; "audits × 7" is now 13+; it predates `PRACTICES.md` and `dev/README.md` existing at all |

### SCRIPTS_AUDIT.md — one strikethrough

| | the claim | what is true |
|---|---|---|
| 22 | the title, *"the CLI tools write a schema the app stopped reading"*, and §0's *"a corpus built from the command line opens with its translations invisible"* | untrue since v3.14.151 for **every** script. The banner says so; **the title is what gets quoted** |

### INPUT_UX_AUDIT.md — re-run the tool, replace §1

| | the claim | what is true |
|---|---|---|
| 23 | §1 *"118 input controls"*, *"two views hold a quarter of the app's inputs"* | **94 controls** at v3.14.310, re-run with `dev/tools/input_inventory.py` (93 at v3.14.272, 92 at v3.14.252), and **neither renderer owns any** — D48 moved field emission into `renderField`, and `renderDictAdd` no longer exists. §3.6 and §9.1 both reason from this table. *Every row of §1's three tables is now false except two:* `contenteditable` 1, and "static markup 20". The widget counts read text 67 → **49**, textarea 18 → **13**, datalist 9 → **5**, checkbox 7 → **8**, select 10 → **11** |
| 24 | §15.3 cites `fieldProvHint` and `.fph-claude` | both deleted by D43 |

### SEARCH_B_DESIGN.md — three ticks

| | the claim | what is true |
|---|---|---|
| 25 | §10's parity checklist shows nine unticked boxes | against its own banner and a green `search_parity_test.js` |
| 26 | §13 step 2 *"still inert, not wired to UI"* | `renderSearchB` is the only search view in `VIEW_RENDERERS` |
| 27 | §8 records "1,000 with pagination/virtualization" as resolved | the cap shipped; pagination and virtualization do not exist |

### GUI_DESIGN_AUDIT.md — renumber, mark §4.2

| | the claim | what is true |
|---|---|---|
| 28 | §4.2's class-mapping table sits beside rows that shipped | so it reads as executed. The `.edit-btn` / `.latex-btn` / `.translate-btn` / `.help-faq-btn` row never was |
| 29 | §4.1 *"weights 400/500 only"* | describes a target as achieved; **49** `font-weight:700` declarations remain at v3.14.310 |
| 30 | **numbering hazard** | §1 uses **F7** for the sentence-view finding while §2–§4 use F7 to mean "Search-A retires". Two findings, one id, one document |
| 31 | its banner *"the code they analyse no longer exists"* | overshoots — `modules/search.js` still loads and 25 `.srch-*` rules survive, reused by Search-B |

### GUI_DESIGN_AUDIT.md — four items are partly closed, not open

| | the claim | what is true |
|---|---|---|
| 32 | F3, F8, F10 and §4.2 read as untouched | **all four are partly executed** (v3.14.310). Chips became one component, so F8's chip half and F10's radius half are done and guarded; buttons are not — `.btn` plus six modifiers coexists with **28** bespoke `*-btn` classes. F3 was fixed in `renderDictBrowse` (B-140) and **not** in `renderDict`, which is the branch F3 actually named. §4.2's first two rows shipped; the `.edit-btn` / `.latex-btn` / `.translate-btn` row never did. And **`.chip-toggle`, which §4.1 and §4.2 both name as the target, was never built** — `.chip-choice` shipped instead and a guard now asserts `.chip-toggle`'s absence, so those two sections are wrong rather than pending |

### DICT_SENSE_AUDIT.md — and what it can be re-measured against

| | the claim | what is true |
|---|---|---|
| 33 | its counts can be re-taken on the live corpora | ~~only on **`chinese-test`**; the live `turkish-test_dictionary.jsonl` is a 0-byte file~~ — **true at v3.14.310, false since the fixture swap at v3.14.384.** Both shipped corpora now carry a dictionary: `turkish-test` **54 entries / 33 lemmas**, `chinese-test` **25 / 13**, and homographs in both. The re-measure D28 needs has two typologies available to it rather than one |

### DATA_INTEGRITY_2026-08-30.md — ✅ RETIRED v3.14.390, and item 34 is why

| | the claim | what is true |
|---|---|---|
| 34 | everything it calls "live" | **it measured a corpus that is now `corpora/archive/turkish_test_corpus_v2_old/`.** Every figure reproduces there exactly, so the audit was sound — and none of it describes live data. Eight findings have **no live instance**: the six wrong sentence ids, the empty `sec_003`, the `3050-01-01` comment date, the orphan entry, the gloss/entry contradictions. What survives is the **fixture** half, and it survives entirely: `samples/` still has 0 of 20 morphemes with `prov_history`, 0 of 31 stamped `dict_id`s, 3 ghost field stamps and 205+64 inlined annotator names, where both live corpora now have none. Three further corrections: **§4g is wrong** — the B-105 repair *was* run on `samples/` (2026-08-30 07:05, 196 stamps, verified against `.b105-bak`), so "the suite is green against provenance dates known to be wrong" is no longer true; **§6's round-trip figures are stale** — the fixture was regenerated and all 32 dictionary rows carry `record_type`; and **§8.7's *"no guard in `dev/tests/` reads the live corpus at all"* is false** since `annotation_gaps_test.js` (v3.14.306) |

### GUARD_MUTATION_2026-08-30.md — three of five recommendations are done

| | the claim | what is true |
|---|---|---|
| 35 | §0's baseline and recommendations 1, 2, 4 | baseline stale: **73 executables and 18,988 lines**, not 68 and 14,240; 70 pass / 0 fail / 2 disabled. Rec 1 ✅ v3.14.254 (the vacuous B-082 fixture replaced, and v3.14.309 added an executed cache check to the same guard), rec 2 ✅ (`linking_s1s3_test.js` rewritten to 733 lines with a `vm` that executes twelve functions), rec 4 ✅ v3.14.254 (`prov_clock_test.js` re-runs `localDate` in child processes under two timezones). Recs 6 and 7 were answered by keeping the files. **Recs 3 and 5 are untouched**: `required_marker_test.js` is still 180 lines of source regex with no `vm`, and 15 of the 16 identifiers the absence sweep pins still appear in zero files under `source/` |

### L_STATUS_2026-08-30.md — ✅ RETIRED v3.14.390; UNIFIED's own table is the reconciliation

| | the claim | what is true |
|---|---|---|
| 36 | that it is a live reconciliation | **it says otherwise in its own header** — *"Frozen at the version it was taken. Not bumped again"*, audited against **v3.14.254** — and this index called it LIVE for 56 versions, which is the exact failure it was written to fix, one level up. Six of its nine "still open" have shipped: L-003 and L-004 (v3.14.262), L-009 and L-012 (v3.14.260), L-008 (v3.14.279), L-011 (v3.14.294). It covers L-001…L-022 and so predates **L-023 and L-024** entirely. Its own count line — "5 fixed, 8 partly fixed or superseded, 9 still open" — also disagrees with its own summary table, which tallies 5 / 9 / 8 |

### UX_CLUSTER_2026-08-30.md — frozen, and its subject is closed

| | the claim | what is true |
|---|---|---|
| 37 | that D32 is pending and B-141…B-145 are open | **D32 ✅ v3.14.303** and **all five bugs are fixed** — B-141 v3.14.280, B-142 and B-145 v3.14.303, B-143 v3.14.290, B-144 v3.14.298, which also unblocked D40. The document reads throughout as though the transliteration model is still an open question. Its measurements were taken against what is now the archived corpus and reproduce there exactly; stated against live data the index figure is **90 raw / 85 folded** on `turkish-test` and **94 / 94** on `chinese-test`, not 101 / 99. Its header already says *Frozen*; this index called it LIVE |

### LEMMA_LAYER_AUDIT.md — retired v3.14.230

Answered by D35 A2 at v3.14.184; its banner records the headline count, the five
`type !== 'lemma'` filters and §5's "two options" framing as superseded. Two the
banner does not carry: *"D35 is therefore partly self-inflicted"* (the homograph
machinery now excludes lemmas explicitly), and the banner's own count — 29 lemma
records against the **33** measured at v3.14.250, 0 duplicated forms either way.

---

## 3. Where DEV_PLAN's own audit table was wrong

Recorded because the table was the project's status of record until this file
replaced it.

| DEV_PLAN said | actually |
|---|---|
| `LEMMA_LAYER_AUDIT` "feeds D35" | D35 A2 consumed and closed it at v3.14.184 |
| `DATA_MODEL_AUDIT` "nothing outstanding" | F1/R28 open; and its conformance guard now **fails on the live corpus** |
| `PIPELINE_AUDIT` "partly implemented", naming only the moot finding | silently drops S1 (no version control) and S6 (no release), the two the audit calls dominant |
| `GUI_DESIGN_AUDIT` "nothing outstanding" | F3, F8, F10, F13 and §4.2 are open |
| F4 "not built" | shipped; its `_dictFillForForm` omission ✅ v3.14.266, offer-only and guarded |
| "Four more sit in `dev/audits/`…" then names five | five |
| `ANNOTATION_FILL_AUDIT` "five bugs filed" | six, B-056…B-061 |

---

## 4. Numbers that disagree across live documents

One fact stated differently in several places that are all supposed to be
current. Re-measured **v3.14.272**, and again at **v3.14.363** — where two rows
had drifted in the way this table exists to catch, including its own.

### Reconciled

| fact | settled at | how it drifted |
|---|---|---|
| **the guard count** | v3.14.349, and no longer stated here | This row used to carry the number and it drifted again — it said **70 executables, 67 by default** while the suite had grown to 84 and 82. That is this table's own subject arriving in this table. **`PRACTICES.md` §6 is now the ONE place the count is written down**, `doc_integrity_test.js` counts the directory and checks that line, and every other document points at it instead of copying it. The original drift is worth keeping: five documents agreed on 66 for twenty versions because one was copied — **agreement is not verification** |
| **`samples/` corpus: 13 sentences, 98 words** | v3.14.250 | `samples/README.md` said 3 and 17 |
| **notions of "same form": four, and four in the source** | v3.14.272; the defect closed v3.14.279; the last raw key closed v3.14.298 | `normForm`/`dictKey` 43 sites, the link key (B-043) · `normMeta` 9 sites, deliberate since v3.14.131 because a dictionary row holds two languages · `toUpperCase` 14 sites, a display fold not a link fold · `Intl.Collator` base, a re-check and never a key. The fifth was `search_b.js`'s `.toLowerCase()` and it was a defect: **B-120 ✅ v3.14.279**, folded onto `normForm`. Three claims had disagreed because they counted different sets — "three" predates `normMeta`, "four" is the pre-v3.14.131 shape, "five" counted the defect alongside the four. **A fifth site survived the adjudication**: the form index was keyed raw, not by a different fold but by none — `B-144 ✅ v3.14.298`, D53 stage A. Counting the folds did not catch it because it used no fold |
| **characters per fully annotated word: 1,050** | v3.14.251 | three values (924, 950, 1,050) came off the same data on one day because the definition differed. **B-116 owns the figure and states the method**; DEV_PLAN and UNIFIED L-001 cite it. Residue: UNIFIED §4.1 ① still states 924 on its own account |

### Still disagreeing

| fact | measured | claimed in |
|---|---|---|
| `dev/archive/` size | **261 MB, 1,746 files** (v3.14.363; 180 MB / 1,250 at v3.14.283) | PIPELINE "88 MB, 403". `archive/README.md` corrected v3.14.278 and now **owned** by `doc_integrity_test.js` — §5's first item is closed. It grows about 27 MB per 40 versions, which is the cost of the pre-edit rule and is being paid deliberately |
| suite runtime | **7.9 s** by default at 84 guards (v3.14.363); ~50 s with `--slow`, which is `gui_crud_test.js`'s real browser | PIPELINE "under a minute" |
| input controls | **94** — re-run at v3.14.363 with `dev/tools/input_inventory.py`, unchanged since v3.14.310 (93 at v3.14.272, 92 at v3.14.252) | INPUT_UX "118". This row said **93** while row 23 of §2 said **94**, both in this file: the table that adjudicates disagreements was carrying one with itself. The tool is the owner; quote it or re-run it |
| corpus-reading guards | **20** at v3.14.363 (`grep -l _fixture dev/tests/*.js`), 13 at v3.14.272 | this table's own "15" (wrong) · DEV_PLAN "twelve" · PRACTICES "fifteen" — all corrected v3.14.272, and the number has since grown with the suite. Derived from the tree by that one command rather than counted by hand |

**The archive row is the point §5 makes:** the measured column has drifted
further from the truth than the frozen claims it corrects, because nothing
derives any of these from the thing itself.

**The corpus-reading row is the one worth learning from.** This table existed to
adjudicate that disagreement and **had the losing number in its own *measured*
column** while four documents carried four values (12, 13, 15, 15). The README,
which the table was correcting, was right.

---

## 5. Two live documents with no owner — both closed v3.14.278

| | what is wrong |
|---|---|
| **`dev/archive/README.md`** ✅ | ✅ **v3.14.278.** `doc_integrity_test.js` gained a third document category — owned, stamped, checked WHEN PRESENT — because `dev/archive/` is gitignored and the LIVE list fails on a missing file, so joining it would have turned every clone red. Its figures, its stale version claim and its two dead paths are corrected |
| **`dev/BUGS.html`, `dev/DEV_PLAN.html`, `dev/archive/README.html`** ✅ | ✅ **v3.14.278 / v3.14.283.** `dev/*.html` is gitignored (scoped, because `source/LingCoT.html` IS the application) and `gitignore_test.js` asks `git check-ignore` for both; all three renders then moved to `dev/_to_delete/` |

---

## 6. Retirement — done v3.14.230

`LINKING_AUDIT.md` (10 of 13 findings shipped; its walker produces a phantom bug
report on live data) and `LEMMA_LAYER_AUDIT.md` (answered by D35 A2) both moved
to `dev/audits/retired/` — **not** `dev/archive/`, which is gitignored and would
put them out of a clone's reach. Each carries a banner naming what is false, what
is still worth reading, and what answered it; `doc_integrity_test.js` walks the
directory, so they stay stamped. **Being answered is not being unowned**, and
each holds one paragraph still the best thing written on its subject: LINKING §1
on walkers that read structure without executing the code that interprets it, and
LEMMA §4.1 on a stable `lemma_id`.

Citations were repaired in the same version — `normalize.js` and `search_b.js`
re-pointed, and the widened reference guard caught the last stale link, in
`BUGS.md`, on the first run after the move.


---

## 7. The v3.14.310 re-check

Every open item in all sixteen documents, re-verified against the v3.14.309 code
and both live corpora rather than against the documents. Six independent passes,
each required to cite the command it ran or the line it read.

### What it found

| | |
|---|---|
| items recorded open | ~40 across the sixteen |
| **already answered, still written as open** | **9** — L-011 (v3.14.294), conflicts ⑧ (v3.14.304), ⑭ (v3.14.299), ⑮ (v3.14.300), ⑯ (v3.14.269), `inferPos` (v3.14.302), F2, F5, and GUARD_MUTATION recs 1, 2, 4 |
| **true when written, not true now** | **6** — L-002, L-010, L-014, DATA_INTEGRITY's eight live findings, DICT_SENSE's counts, UX_CLUSTER's index figures |
| genuinely open | the rest, and they are correctly stated |

### The two failures worth naming

**A closed item under a live heading.** UNIFIED_AUDIT's conflict ⑧ was ticked in
the summary table at v3.14.304 and its body left in place under a heading reading
*"The nine still live"*. The heading is what gets read. Four bodies were removed
at v3.14.310 and the heading now counts what follows it.

**Two frozen documents indexed as LIVE.** `L_STATUS` and `UX_CLUSTER` each say
*Frozen* in their own headers; this index called both LIVE, one of them for 56
versions. That is this file's own failure mode — the thing it was written to
catch, one level up — and the reason §1's verdict column must be taken from the
document's header rather than from what it was commissioned as.

### Method note, for the next re-check

The expensive half was not reading the audits; it was **re-measuring**. Six of
the corrections are not errors of reasoning but figures whose subject moved —
above all `DATA_INTEGRITY` and `UX_CLUSTER`, which measured a corpus now sitting
in `corpora/archive/`. Their numbers reproduce there **exactly**, which is worth
recording: the audits were right, and a measurement without the name of what it
measured goes stale silently. Every table in a future audit should carry the
corpus and the build in its caption, not in the document's header.

---

## 8. The v3.14.390 status pass

**What it was.** Every file in `dev/audits/` and `dev/design/` read against
v3.14.389 — the first pass since the fixture swap moved the data half of this
project. **Frozen documents were not rewritten.** Where one is wrong, a stamped
banner or a stamped final section was appended and the body left as written,
which is the convention D31 and D58 §§7–10 set: a design record is evidence of
what was decided and known, and an edited one stops being that.

**What it found, in order of how long it had been wrong.**

| | |
|---|---|
| **21 of 27 design records were not in §1 at all** | every record from **D29 to D61** — the index carried six, all from v3.14.134, and read as complete. The design half of `dev/design/` had no index for 250 versions while the audit half had this file. **Fixed**: §1 now carries all 27 |
| **`D58_fixture_set.md` still said "Not built"** | six versions after it was built. Its §§7–10 record the execution and its header did not; a reader arriving at the top would have believed the opposite of the truth. **Fixed**: header restamped, two pointers §4.2 could not have known added |
| **`save_format_decision.md` never admitted its density figure** | this index has recorded that drift since v3.14.310 and the document has not, which is PRACTICES §5 — a declaration is only as good as what it admits exists. **Fixed**: its own §10 |
| **item 33 was inverted by the swap** | it said only `chinese-test` could be measured because the other dictionary was a 0-byte file. Both ship dictionaries now |
| **`SEARCH_B_DESIGN.md` is titled after a name that no longer exists** | Search-B became `search` at v3.14.388, files merged and every identifier renamed. The spec is unaffected — only the spelling moved. **Annotated**, not renamed: `dev/RENAMES.md` is where a frozen document's old paths are resolved |

**Two retirements, both because the data moved rather than because the finding
was answered.** `DATA_INTEGRITY_2026-08-30.md` and `L_STATUS_2026-08-30.md` both
measured `samples/turkish-test` and `~/mnt/turkish_test_corpus`, and the fixture
swap replaced both. Each keeps a banner naming what is false, what answered it,
and the one part still worth reading — §6's rule, unchanged: **being answered is
not being unowned.**

**Nothing else was retired, and that is deliberate.** Five documents are SPENT
with no open items — `ANNOTATION_FILL_AUDIT`, `SCRIPTS_AUDIT`, `DOCS_AUDIT`,
`ANNOTATION_UX_AUDIT`, `GUI_MODALITY_2026-08-31` — and §0's table does not make
SPENT a retirement criterion. **MOOT and WRONG retire; SPENT is kept for the
reasoning**, and each of those five is the only account of its own subject.

**What is still open after the pass, unchanged:** `INPUT_UX_AUDIT` I2, I5, I13,
I14 and half of I12 · `GUI_DESIGN_AUDIT` F13, and F3, F8, F10, §4.2 partly ·
`SEARCH_B_DESIGN`'s four view features · `PIPELINE_AUDIT` S1 and S6 ·
`DATA_MODEL_AUDIT` F1/R28 · `DICT_SENSE_AUDIT` as D28 ·
`GUARD_MUTATION_2026-08-30` recs 3 and 5, **re-verified by execution at
v3.14.390**: `required_marker_test.js` still reads `renderField` through
`fnSrc` rather than running it, and `suggest_mechanism_test.js` still spends
twelve assertions on six retired class names. Rec 8, re-measuring the mutation
score, has not been taken since v3.14.254.
