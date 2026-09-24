# LingCoT: Open Bugs
**Updated:** 2026-09-24 · **Version:** v3.15.1

Running list of reported defects. Fixed entries move to `edit_log.md` with their fix.
Severity: **S1** blocks use · **S2** visible/wrong but workable · **S3** cosmetic.

## Open bugs at a glance

**6 open** · 0 S1 · 0 S2 · 6 S3  |  **210 fixed**  |  **1 withdrawn** (B-096)

*Three states, not two. Counting ids without the third comes up one short — which
is how a consistency script found it at v3.14.397.*

| Sev | Count | What it means | Open |
|---|---|---|---|
| **S1** | 0 | blocks use, or loses data silently | none |
| **S2** | 0 | visible and wrong, but workable | none |
| **S3** | 6 | cosmetic, or contained | B-028, B-029, B-035, B-136, B-170, B-181 |

Counts are checked by `doc_integrity_test.js`, so they cannot drift from the
entries below. Update them in the same commit that opens or closes a bug.

### By theme

*Only themes with an open bug. Compressed v3.14.387: nine of the eleven rows had
emptied and the table had become an index of closed work, which the Fixed table
below already is.*

| Theme | Bugs | Waiting on |
|---|---|---|
| export and output | B-028 | a decision, not a patch |
| vocabularies and stored data | B-029, B-035, B-136 | nothing — three separate small decisions |
| tooling | B-170, B-181 | B-170 wants a vacuity floor; B-181 is `new_version.py --add` |

**Eight themes emptied**, and two are worth remembering for how they closed
rather than that they did: *an edit that does not take* — B-175, B-176, B-178 and
one more, **all four found by `gui_crud_test.js` on its first run** (v3.14.341),
which is the argument for a guard that drives the real UI; and *one act, two
doors* (B-171), whose shape recurs often enough that D45's drawer was built to
make it structural.

## Guards

**The count is in `dev/PRACTICES.md` §6**, the only place it is written down;
this line held a copy and drifted. Every guard must pass before a release — run
`--slow` — and a filter narrows the suite (`./dev/tests/run_all.sh dep`). How to write one, and the
thirteen that once reported success while checking nothing, are in
`dev/PRACTICES.md` §6–7.

| Guard | Holds the line on | Bought with |
|---|---|---|
| `translit_model_test.js` | D32's two decisions: the join is computed at read time and never stored, and a label is raw free text harvested from every level and offered back | B-045, B-093, B-142, B-145 |
| `form_index_test.js` | the form index has one identity rule: three accessors own the maps, both writer and reader fold, an index/deindex round trip empties them — and the strip that previews a derivation promises exactly what the save writes | B-144, D53 A+C |
| `dict_delete_refs_test.js` | that a clear and a merge find the same references, that a merge moves every one of them and drops none, that fill-only holds, and that a moved link keeps the stamp the annotator earned | B-048, B-155 |
| `project_files_test.js` | the four names a project has, in one table on each side of the language boundary — compared literally, round-tripped through the opener, and no other file may spell a role suffix | B-149, B-150 |
| `venv_bootstrap_test.js` | that the venv re-exec fires on RUN and never on import — a hermetic project in a temp directory, the real script imported and run against a stub interpreter — and that the four copies of the block stay byte-identical | B-179 |
| `section_editor_test.js` | D59: the section editor commits at Save and only there — the delegation selector is evaluated against the buttons the app renders, every `data-arr` has a branch, and the handler names nothing belonging to the document | B-175, B-178 |
| `undefined_call_test.js` | a function that is CALLED must EXIST — and reads **inside** template literals, where this app makes almost every call | B-081, B-062 |
| `boot_smoke_test.js` | top-level JS actually executes | — |
| `render_untranslated_test.js` | renderers survive an untranslated sentence. **The only guard that executes a renderer** | B-008 |
| `render_cache_test.js` | view state a renderer reads can reach the screen | B-008, B-011, B-019 |
| `locale_key_test.js` | every `t()` and `data-i18n*` key resolves — `t()` returns the key on a miss, so a break is otherwise silent | — |
| `locale_shadow_test.js` | nothing shadows the global `t()` | B-008 |
| `selector_audit_test.js` | no JS selector targets a class nothing emits | B-007 |
| `ui_wiring_test.js` | what looks interactive is **reachable**, **operable** and **derived**. Merges the former modal_wiring, dict_chip, section_link | I9, I11 |
| `affordance_test.js` | what looks clickable is clickable; a variant is a class, not an inline style. Both halves of the sort affordance | I9, I11 |
| `chip_system_test.js` | one chip in two kinds. Reads radii out of the stylesheet, so a new family is measured too; reduced opacity on the chip element only | D44 |
| `tag_control_test.js` | the app does not assert which categories a language has. No literal tag subset; at most two tags scope-narrowed; grouping is data | D45 |
| `suggest_mechanism_test.js` | one way to propose a value. Refuses `list=` and `<datalist>` outright | D42 |
| `required_marker_test.js` | a field the app refuses to save says so in its label. Starts from every `alert.validation` call and asserts the count | I1 |
| `input_attrs_test.js` | linguistic fields resist macOS autocorrect; prose fields deliberately do not | B-009 |
| `theme_audit_test.js` | dark-mode CSS hazards | B1 |
| `prov_presentation_test.js` | provenance has ONE presentation and `derived` is not hidden behind hover. Executes `provTipAttr` | D43 |
| `derived_prov_test.js` | a value copied from the lexicon is not signed by the annotator. Runs the shipped back-propagation block | B-061 |
| `push_to_dict_test.js` | the lexicon upsert fills empty fields, never clobbers curated ones, and pushes **only the forms selected**. Counts entries that arrived | B-068 |
| `normalize_test.js` | the dictionary key folds everything that is **not** a distinction in the language and nothing that is. Both halves | B-043 |
| `linking_s1s3_test.js` | a link that fails to match must not resolve silently, or differently per panel. Executes the collator against real Turkish | B-047 |
| `variation_fields_test.js` | `allomorphs` is CONDITIONED variation, `variants` is not, and **neither is matchable while D35 is open** | B-044 |
| `dict_delete_refs_test.js` | deleting an entry leaves nothing pointing at it | B-048 |
| `ensure_morphemes_test.js` | E26 morpheme materialisation, corpus ↔ lexicon | E26 |
| `retokenize_align_test.js` | an edit to a sequence must be ALIGNED, annotation never discarded without asking. Executes `alignTokens`/`hasAnnotation` | B-057 |
| `save_advance_test.js` | Save advances on an **annotation**, stays on a **revision**; state sampled BEFORE the write | B-065 |
| `autosave_target_test.js` | a `mutate()` save-target label covers every store the function writes | B-055 |
| `schema_conformance_test.js` | schema drift: unknown field names rejected, and since v3.14.214 values checked against the pool each field declares | B-027 |
| `cli_schema_test.js` | the CLI and the GUI write **one** schema. Ingests a real file with the shipped ingester | D36 S3 |
| `igt_align_test.js` | a rendered gloss line carries one element per morpheme, and the gap is RENDERED, never stored | B-059 |
| `id_sort_test.js` | no variable-key comparator ever sorts on `id` — asserted in the comparators and in the markup that feeds them | D33 |
| `dep_root_test.js` | "root" is derived from `head === null`, never stored, and a dependency parse was SEEN at all. Counts `head` keys, `dep_rel` labels, parsed sentences | B-015, B-125 |
| `dep_parse_test.js` | D25 P1: id-suffix extraction, head resolution, the has-parse predicate | D25 |
| `dep_arc_test.js` | D25 P2: which arcs are drawn and how they stack | B-013 |
| `nav_traversal_test.js` | D30: executes the traversal engine — punctuation skipped, the end does not wrap | D30 |
| `selection_test.js` | D27 P1: derived labels, canonical serialisation, the autocomplete filter | D27 |
| `word_edit_pos_test.js` | word-edit morpheme rows + POS chip wiring | — |
| `search_b_test.js` · `search_b_matcher_test.js` · `search_b_concordance_test.js` | Search-B substrate · matcher goldens · KWIC and frequency builders. **The last two are DISABLED**, pending a Korean fixture | D21 |
| `search_parity_test.js` | Search-B reproduces Search-A, 1174/1174 | F7 |
| `xlate_settings_test.js` | a chosen translation mode survives every way of closing the modal | B-020 |
| `nllb_diag_test.py` | the NLLB server's failure reaches the caller. Run with `python3` | B-016–B-018 |
| `lang_resolve_test.js` | every language resolves from every shape a user might type. Executes the real map-builder over all 71 entries | B-031 |
| `license_assets_test.js` | anything shipped that somebody else made is named in `LICENSE.txt`, and the licence file it points at exists | B-066, B-067 |
| `gitignore_test.js` | what git ACTUALLY ignores, asked of `git check-ignore` in a scratch repo | B-080 |
| `workspace_test.js` | user corpora are never written inside the app folder. Shells out to `python3` | B-022–B-024 |
| `venv_tier_test.js` | setup never uninstalls what a previous setup installed. Executes `build_env.py` | — |
| `log_triage.js` | the retained logs contain no unacknowledged error | B-008 |
| `doc_integrity_test.js` | DEV_PLAN/BUGS sections must not vanish and cross-references must resolve | 2026-08-24 |
| `readme_tree_test.js` | every path the README draws exists | — |
| `session_panel_test.js` | the queue, the session record, and that every box on the shared modal rule is either scrollable or exempted with a reason | B-162 |
| `search_b_routing_test.js` | Search-B's routing, validation and error paths, against a synthetic corpus — the half that never needed a language (L-019) | — |
| `corpus_load_test.js` | that a corpus reaches the tree only through the path that replays its journal, and that a journal from another base is refused out loud | B-171 |
| `fixture_resolve_test.js` | which corpus a `prefer` string resolves to, shallowest-wins, ties refused — and the gate-1 swap layout, pinned before the swap | B-168 |
| `help_coverage_test.js` | every view has help, in the locale, and no help entry names a view that is gone | B-038 |

---

## Open

### B-181 · S3 · `new_version.py --add` archives a file that has already been edited

**Found 2026-09-01**, on the third consecutive version where it happened.

`--add` exists for a file discovered mid-session, and it copies the file **as it
is at the moment of the call** — which is correct for a file not yet touched and
wrong for one already edited, where it stores a post-edit copy under a
`_pre_<version>` name. Three versions in a row (v3.14.343, .344, .347) named a
guard with `--add` after editing it; the first two were reconstructed by
reversing the known edits, the third was not.

Nothing detects it. `doc_integrity_test.js` checks that every touched file HAS an
archive copy, not that the copy predates the edit — the same shape as the
v3.14.76 tidy that `new_version.py` was written to prevent, arriving through the
one door that was added later.

**The fix is a warning, not a refusal**: compare the file's mtime against the
version's start (the archive folder's own mtime is already the right clock) and
say so. A refusal would leave no way to record a file that genuinely must be
added late.

S3 because the archive of the file that matters — the one the fix edits — is
taken correctly by the main invocation; it is the late additions that lose their
history.

### B-170 · S3 · `schema_conformance_test` has no vacuity floor, so a trivial corpus conforms

**Found 2026-08-31** by the D58 fixture audit, asking of each guard *what would
this say against an empty corpus?*

`schema_conformance_test.js` walks every object in every corpus and dictionary,
checks each key against the field table and each POS/type value against the
shipped vocabularies. Its only quantity assertions are `CORPORA.length` (`:35`)
and a per-file document count. **Nothing asserts that it examined any objects.**
A corpus of one document with no sections prints `ok 2 object(s) conform` and
`ok 0 tag value(s) are outside the declared vocabulary` — two green lines for a
file it has proved nothing about.

This is the `dep_root_test` shape exactly, which **B-125** fixed by making the
guard fail when the fixture carries no dependency parse: *"0 root tokens across 0
corpus files"* reported as a pass. The same fix belongs here — a floor on objects
checked and on tag values checked, sized to the fixture set rather than to a
constant, so it fails when the fixture thins rather than when a number drifts.

`annotation_gaps_test.js:463-474` has a milder version of the same shape: its
four per-document assertions are equalities between two counts derived from the
same walk, so an empty document satisfies every one. It is less dangerous because
that guard's other 60 checks are behavioural, but the floor is worth adding in
the same pass.

**Why this matters now rather than generally**: the fixture set is about to be
replaced. A guard that cannot notice a thinner fixture is precisely the one that
will not notice a bad swap — and this project's own rule is that *a guard that
cannot fail is not a guard* (PRACTICES §7).

### B-136 · S3 · `word_index` is written by two writers and read by nobody

**Found 2026-08-30**, same sweep (§3e). `makeWordObj` (`LingCoT.html:12839`) and
`corpus_ingest.py:1083` both write it; its comment says it is *"used by search"*,
and **`search.js` contains zero references to it** — re-verified v3.14.397, along
with the rest of `source/`, `docs/` and `dev/tests/`. Same shape as `definition`
before v3.14.249: a field whose comment claims a reader that does not exist.

**Re-measured v3.14.397 on the shipped pair, and it is sharper than first
recorded.** Not "some path omits it sometimes" — it is **all or nothing, per
corpus**:

| | words carrying `word_index` |
|---|---|
| `turkish-test` | **108 of 108** |
| `chinese-test` | **0 of 132** |

The v3.14.273 figures (160 of 162, 96 of 98) were taken on corpora that have since
been retired, and the two-stragglers reading they suggested was wrong. The
mechanism is the producer: `chinese-test` was segmented with jieba and
hand-corrected, so its words never passed through either writer. **So a reader
added today would be correct on one shipped corpus and silently wrong on the
other** — which is the argument for deciding it rather than leaving it. Either
something should read it, or it should follow `definition` out.

---



### B-035 · S3 · Two languages claim the same native name; one silently wins

**Found 2026-08-25** by `lang_resolve_test.js` on its first run. `словѣньскъ` is
the `native_name` of **both** `cu` (Old Church Slavonic) and `orv` (Old Russian),
differing only in initial capital; `loadLanguageMaps()` lowercases every alias, so
they collide and the last built wins — currently `orv`, with no indication
anything was substituted.

Impact is bounded: both have `google_bcp47: null`. It matters for NLLB and for
anything identifying a document's language from the field.

**Fix is a data decision.** Disambiguate the aliases, or make the builder detect a
collision and refuse to overwrite, surfacing the ambiguity. The second is more
work and generalises. `lang_resolve_test.js` carries this as a one-item
`KNOWN_COLLISIONS` list and **fails when the collision disappears**, so fixing it
forces the list to be emptied rather than left to mask the next one.

---

### B-028 · S3 · Exported PDF has no page numbers or running header

**Found 2026-08-25** in the same PDF. Page 1 carries the title; pages 2–8 carry
nothing, so there is no way to cite or re-find an entry in a document meant to be
printed. Also inconsistent in the same output: `PARTS` renders its value far to
the right of its label while `DEFINITION` puts it on the next line, indented —
one of the two is wrong. `dict_export.py` is the only place either needs fixing.

---

### B-029 · S3 · Autocapitalize residue survives in existing gloss data

**Found 2026-08-25.** The `ara` entry glosses as `"Interval"` while every
neighbouring gloss is lowercase. B-009 (v3.14.71) stopped macOS autocapitalize
corrupting *new* input in 40 linguistic fields; it did not clean what was stored.
One confirmed instance, true count unknown — the corpora live outside the repo.

**Do not auto-fix.** Some glosses are legitimately capitalised. A scan that
reports candidates is the right first step, not a bulk rewrite.

**Re-measured v3.14.397, and the premise has changed under it.** The corpora no
longer live outside the repo — the fixture swap (v3.14.384) made the shipped pair
the live pair, so "true count unknown" is now answerable, and the answer is
**zero**: no capitalised gloss in either `samples/` corpus. The `ara` → `Interval`
instance was in a corpus that has since been retired. **The bug is not closed** —
it is about what B-009 did not clean in *a user's* stored data, and no user data
is reachable from here. What changed is that it can no longer be reproduced on
anything this repository ships, which is worth knowing before someone goes
looking.

## Fixed

One line each: what the defect WAS, not how it was fixed. **Full write-ups live
in the edit log** — search `dev/edit_log.md` (2026-08 onward) or
`dev/archive/docs/edit_log/` (earlier) for the version number.

*The rule was stated here and broken by every row added between v3.14.227 and
v3.14.270 — 21 of them had grown to 600–1,250 bytes, a full write-up each, all of
which the edit log already held. Re-compressed at v3.14.272, and
`doc_integrity_test.js` has enforced 600 since v3.14.349.*

**Where the table sits now, measured v3.14.387** — because "the next time it
starts growing" is a feeling unless somebody writes the number down: **196 rows,
median 259 characters, p90 559, max 594, 38 rows over 500.** Nothing breaches the
cap and nothing here is padding — each of the long rows is a distinct fact per
sentence, checked. But the mass has moved toward the cap since v3.14.272, so the
honest reading is that the NEXT re-compression is not due yet and will be when
the median passes ~350. Re-take these five numbers rather than trusting them; the
one-liner is in `dev/edit_log.md` under v3.14.387.*

| Bug | Sev | Fixed in | What it was |
|---|---|---|---|
| **B-217** | S2 | v3.14.428 | **Log pruning sorted by file name, and the name carries local time.** Logs written under another clock sorted wrong: a session started at 19:17 local, with 20 logs named 22:50 to 23:06 (UTC) present, deleted its own log at startup. A DST change or travel west does the same. Found when a test session left no log. |
| **B-216** | S2 | v3.14.428 | **Guards that import the app wrote session logs into the repo's `logs/`**, about 40 in a day, and pruning then removed every real session log. `workspace_test.js` and `locale_parity_test.js` (tb-settings, tb-i18n). |
| **B-215** | S1 | v3.14.423 | **The Search view threw on every visit** from v3.14.388 on. The Search-A → Search rename left the old branch first in `render()`'s cache-key ternary, naming five variables deleted with Search-A. `render_smoke_test.js` called the renderers directly, bypassing that code. Found by the tb-strings pseudo-locale sweep. |
| **B-210** | S3 | v3.14.422 | **The gloss legend called every transliteration "derived".** It tested the pre-v3.14.303 scalar `transliteration`, which words no longer carry, so a typed IPA line was labelled *Transliteration (derived)*. Found in a screenshot of `turkish_folk_songs_corpus` p1 s2. |
| **B-214** | S3 | v3.14.420 | **The B-213 edit dropped `hooks/prepare-commit-msg`'s executable bit**, and git skips a non-executable hook without a word, so commit `2c3f407` went out unstamped. Found by reading `git log`. |
| **B-213** | S3 | v3.14.420 | **The commit hook skipped any subject that named a version anywhere.** `Tester's build planned as v3.15.0` was taken as already stamped, so commit `eb0c8b4` (v3.14.419) carries no version and §8b cannot find it. Only a leading stamp counts now. |
| **B-212** | S3 | v3.14.415 | **The word view never showed the word's transliterations.** The edit form wrote `transliterations[]` and the word view drew the parse and the gloss only, so a saved transliteration was visible in the sentence's gloss and nowhere on the word's own page. Found testing D40 stage D. |
| **B-211** | S2 | v3.14.415 | **Choosing between homograph lemmas (dA·1 / dA·2) looked like it did nothing.** The pick was stored and the save honoured it, but the strip's ambiguous branch repainted the same question: `lemmaStripHtml` was never told which lemma the field had chosen. B-161 had fixed the same thing in the exact branch. Found testing D40 stage D. |
| **B-209** | **S1** | v3.14.401 | **The privacy hook has never run on a clone.** `hooks/pre-commit` was mode **100644 in every commit**, including the first, and git skips a non-executable hook *silently* — so the second of the two layers refusing fieldwork did not exist for anyone who cloned. It looked fine because it fired for real at v3.14.392 (B-206): the author's working copy had the bit from a `chmod`, while the index recorded 100644, and the working copy is the one that ran. **`chmod` alone is the trap** — the fix is `git update-index --chmod=+x` |
| **B-208** | S3 | v3.14.399 | **Four live documents carried no version stamp at all**, `README.md` and `setup.md` among them — the two a cloner reads first. `new_version.py`'s tuple never owned them, and its own comment already stated the rule after BUGS.md and RENAMES.md rotted the same way: *a live document the bump does not own rots by the next version.* **Third occurrence, so the fix is not another list**: `doc_integrity_test.js` now parses the bumper's tuple and asserts it against the tree |
| **B-207** | S2 | v3.14.394 | **Every command setup printed failed.** `build_env.py` and `setup.py` live in `source/`, so their usage lines named paths relative to themselves — but `setup.command` leaves the user at the PROJECT ROOT, where `scripts/corpus_annotate.py` and `setup.py` do not exist. **67 occurrences across six files**, including the literal next step after a successful install. The `.command`/`.bat` launchers had it right, which is what hid it. Found by doing gate 2's fresh-machine install for real: clone the published repo, run setup, then run what it tells you |
| **B-206** | S1 | v3.14.392 | **The hook refused the first commit.** `hooks/pre-commit` exempted `samples/` alone, so the CLI specimen admitted to `.gitignore` at B-205 was tracked by git and refused by the hook. Two writers of one rule — *which cleared data may ship* — disagreeing by one directory (PRACTICES §4), and the third instance of the shape after B-156 and B-205. `gitignore_test.js` §B now EXECUTES the hook against every path `.gitignore` admits, so they cannot drift again |
| **B-205** | S2 | v3.14.389 | **The CLI specimen would not have been committed.** `dev/tests/fixtures/cli_ingested/cli-ingested_corpus.jsonl` carries the name `corpus_ingest.py` writes and the loader resolves, so `*_corpus.jsonl` caught it — and the first commit would have shipped a guard that fails on a fresh clone, `prov_intern_test` asserting a file the repository does not contain. The same shape as B-156 one directory over, found the same way: by asking git rather than reading `.gitignore` |
| **B-204** | S1 | v3.14.388 | **Opening the concordance and then saving wrote the search substrate into the corpus.** `sentTokens` and `paraTokens` park caches on the annotator's own records, and the serializer stringifies whatever a record enumerates — `_srchTokens` holds one entry per word, each a REFERENCE to the word object, so every word was written again inside its own sentence. `turkish-test`: 85,964 characters clean, **230,125 after one KWIC**. A search alone never showed it; only the concordance touches the substrate. Non-enumerable now |
| **B-203** | S2 | v3.14.385 | **Only the first transliteration under a label was searchable.** `translitTextsForSearch` answered through `wordTranslit`, which returns THE reading for a label — one string, `arr.find`. A second element under the same label, or any unlabelled second element, could be typed, saved and displayed, and then never found again. Found by the rewritten Search-B guards: `sïdjak` on `sıcak` and `guo4` on 过 both returned nothing. Every element is a candidate now, and the derived morpheme join stays `wordTranslit`'s |
| **B-202** | S1 | v3.14.383 | **Last-write-wins inverted, on the ordinary save order.** `replayJournal` built its id map once, before applying anything. A deep put replaces a container's children whole, so every descendant the map knew became an object no longer in the tree, and a later record naming one of them updated a detached copy. Save a sentence, then a word inside it: replay reported `applied: 2, unresolved: 0` and the OLDER value won, shown on screen and absent from the file |
| **B-157** | S2 | v3.14.365 | **A CLI machine translation was stored as a person's work — and the next save made it official.** `--translate` wrote `{label, text}` with no element stamp; the app reads list provenance from the ELEMENT, so it read as human and D34's panel counted machine output as finished. `assignList` then stamps any element with no `prov` with the saver's moment, and the CLI's `label` — absent from the schema, read by nothing — sat inside `_listKeyOf`'s identity, so the app could never match its own rebuild. One `source/prov.py` now |
| **B-199** | S2 | v3.14.382 | **A session that reported every save and wrote nothing.** `beforeunload` called `compact()`, which writes the base then truncates the journal — two steps the window disappears between, so the base landed and the truncation did not, leaving a journal the next open refuses. That refusal then `return`ed out of the load, skipping the step that arms autosave; `journalPath()` derives from the save path, so it was empty and `flushJournal` wrote nothing. The exit flushes instead of compacting, and a refused journal no longer stops the session saving |
| **B-201** | S3 | v3.14.381 | **A guard comparing two different populations.** `prov_intern_test` checks that a damaged load keeps every provenance reference rather than tidying it away — and compared a walk of `S.docs` against a baseline that walks `S.docs`, `S.dictionary` AND `S.lemmas`. The two agree only while the dictionary carries no field stamp: true of `samples/`, false the first time an annotator edited one field of one entry. It reported 646 against 648 and blamed the corpus for two stamps living in the dictionary. Counted over the same tree it asserts about now |
| **B-200** | S3 | v3.14.380 | **A field the app mints on a lemma was declared only for an entry.** `_indexLemma` numbers a citation-form bucket exactly as `_indexDictEntry` numbers a form bucket (B-114, D35 A1), and only `dict_entry` declared `homograph`. Every consumer of the field table was blind to it on a lemma, and `schema_conformance` read two live records as drift in the annotator's own data. Invisible until a corpus had a numbered lemma pair — `samples/` has none, which D58 names as a measured gap, so the gate-1 rehearsal surfaced it rather than the suite |
| **B-169** | S2 | v3.14.378 | **The swap rehearsal did not cover the guard that validates the dictionaries it rehearses.** `variation_fields_test` built its file list from `path.join(ROOT, 'samples')` by hand, so it was the one corpus-reading guard that ignored `$LINGCOT_TEST_CORPUS` — it validated the SHIPPED dictionaries whatever the rehearsal pointed at. A candidate with a malformed `variants` or `allomorphs` passed rehearsal and would have failed after the swap, at the one moment rehearsal exists to prevent. `companionsIn` answers it now, and no guard may name the directory |
| **B-198** | S3 | v3.14.376 | **A section merge gave paragraphs a new parent and said nothing.** Keeping their ids is correct — B-135: ids are identities, not paths, and renaming a moved child would break `word.head`, the journal and every by-id map to preserve an appearance. `saveSection`'s re-parse has logged exactly this since B-135, for the reason its own comment gives: *"the only reason this was ever found was a sweep of the file months afterwards."* The merge made the same divergence one level up in silence, and it was found by a sweep of `turkish-test`. One reporter now |
| **B-197** | S2 | v3.14.375 | **Correcting a filled row did not release the link the chip had assigned.** Taking an offer fills fields AND writes `dataset.dictId`; D42 releases the first the moment the annotator types over it, and nothing released the second — the stronger claim of the two. Found stored: `turkish-test`'s `…w_006.m_001` is `too`·`PART`·`functional.word` and points at the entry saying `LOC`·`AFFIX`·`bound.morpheme`. Invisible by construction, since the id resolves. Shown, not guessed: the row warns as they type, offers to unlink, and the save reports it |
| **B-196** | S2 | v3.14.374 | **The push panel showed one lexeme's fields under another lexeme's headword.** For a morpheme `existing` is `found[0]`, the first entry with that form whatever its type, and everything downstream reads a matching form as one lexeme. Turkish `DA` is two morphemes; the annotator annotated the particle (`functional.word`·`PART`·"too") and the panel showed the locative suffix's (`bound.morpheme`·`AFFIX`·`LOC`), said "nothing left to fill", drew them readonly, and gave no way to say they are two words. A missing field is nothing to argue with; two answers are |
| **B-027** | S3 | v3.14.373 | **Nothing checked a stored tag against the vocabulary that defines it.** `CONJ` ×3 and `affix` ×2 reached a dictionary — a wrong tag and a wrong case — found by reading an exported PDF. The guard half landed v3.14.214, but the app still accepted any typed value. Refusing was ruled out by the evidence: `CLF` was the RIGHT tag and the shipped list lacked it. So an unknown tag is stored, reported at the save from `stampFieldProv`, and adoptable from the tag drawer, which writes it to the project vocabulary file — the extension point that had no door |
| **B-139** | S3 | v3.14.372 | **Decided, not built, and grouped by the wrong property.** It asked about STORAGE SHAPE — string versus object — when the deciding property is the CONTROL: B-138 stamps elements because a row editor lets two people add rows years apart, while these three are written by whole-value controls, so every element is one person's single act and N identical stamps say less than one field stamp. **Superseded v3.14.408** by D62 A, which does not dispute that and changes the control |
| **B-109** | S3 | v3.14.371 | **The dictionary browse filter offered three of the nine entry types** — `all`, `word`, `bound.morpheme`, chosen once, for every language the app will ever open. "Phrases only" could not be asked. B-084 fixed the export dialog's copy of the same triple and left this mirror behind. D45's argument against `POS_VISIBLE_DEFAULT` is the same argument: a control showing part of a vocabulary makes a typological claim. It is a chip row over `TYPE_CHOICES` through the shared drawer now, with "any type" as a lead chip and the active filter in the button |
| **B-161** | S2 | v3.14.370 | **The one state where the annotator could be sure the app had matched the wrong lemma was the one state with no way to say so.** `lemmaStripHtml`'s branches did not offer the same doors: `lemma-new` — B-114's, for exactly this decision — was reachable only from `ambiguous`, and a form is ambiguous only once two records carry it. Saying *a different word spelled the same* meant creating the collision by hand in another view. Reported from live annotation. Taking the door now CHANGES the verdict and offers the way back |
| **B-195** | S1 | v3.14.369 | **A lemma record died with the session that minted it, while the token citing it survived.** `_createLemmaRecord` put the record in `S.lemmas` and the indexes and stopped — no journal record, `saveGen('dict')` unmoved, so `compact()` had no reason to rewrite the file. Found in `turkish-test`: 5 words and 2 entries citing `su`, `içmek`, `tekrar`, whose records were gone; the next session's dictionary write made it permanent. Every function was already right — `replayJournal` routes a lemma body to `S.lemmas` and was waiting to be sent one |
| **B-194** | S2 | v3.14.368 | **After a delete, the next added sibling took an id one still held.** The three add paths minted from the container's LENGTH — a count answers *how many are there*, asked as though it answered *what comes next*. Those agree only until something is deleted. Reported from use: `turkish-test` lost `sec_002`, so *Add section* would have minted `sec_003`, still held by the section below it. **Nothing would have thrown** — ids are opaque (B-135), so one object becomes unreachable and edits land on whichever the index kept |
| **B-193** | S2 | v3.14.367 | **A chip drawn against empty rows stayed drawn after they were filled.** The word editor draws four strips saying what the save will do; three repainted as the annotator types and the morpheme offer did not — only `#ew-parse` and a taken chip rebuilt it. So a chip computed while the rows were empty was still live once those fields were typed by hand, and clicking it wrote nothing. **Third occurrence of one complaint** (B-108, B-166), and B-166's own comment describes it. Found in the logs |
| **B-192** | S2 | v3.14.366 | **Reported from use: accepted auto-fills were offered again on every open.** `offerDictFill()` runs inside `applyDict`, and `loadProject` replays the journal LAST — so the proposal was computed against the corpus as it sits on disk, one step before the journal carrying the previous session's accepted fills was applied. It repeated until a full write compacted the journal into the base: two days, on the reported corpus. The post-replay block already re-ran the migrations and both indexes for this reason; the offer was not in it |
| **B-191** | S2 | v3.14.360 | **The app stored its own derivation as the annotator's answer, and it then overrode their segmentation.** `#ew-gloss` holds the derived join (B-187); `storedWordGloss` asked whether it equalled the join AFTER the save, which after a segmentation it never does — so the derived string was stored as typed, signed with their stamp, and won over the morphemes. Live: `öğleden` `noon` over `noon-ABL`, `下午` `afternoon` over `down-noon`. B-141's shape, fourth time. The test is now whether the person touched the field |
| **B-190** | S2 | v3.14.359 | **Fifteen error pages the annotator could not leave.** Every view renderer's not-found return was a bare paragraph — no header, no back, and a breadcrumb built from the state that had just failed to resolve, so it drew empty exactly when it was needed. Found through B-189, which is why it was reported as "Back fails to return anywhere": Back did go somewhere, and there was no way out of it. One helper, `deadEndHtml`, so the next renderer needing an error return gets the exit without knowing this happened |
| **B-189** | S2 | v3.14.359 | **Reported from use.** Add-to-dictionary → Edit Entry → Back stranded the annotator. The door called `go('dict', { …, entryId })`; `go()` reads `dictEntryId` — `entryId` is the ATTRIBUTE's name, reconciled in `resolveGoOpts` for the declarative `[data-go]` path only, so an imperative caller was a second reader of one contract. It also dropped the word context, and `go()` nulls every field its opts do not name, so `renderDict` built `data-go="word" data-wid=""`. Two effects, one line: the named homograph was never surfaced either |
| **B-188** | S3 | v3.14.359 | **Reported from use.** The Progress button was styled unlike every other header button — because it was styled by nothing. The border, surface and hover lived once per BUTTON (`#search-btn`, `#project-btn`, `#file-btn`) while `.hdr-btn` carried only metrics, so the fourth got the UA default. Its `.visible` class was inert for the same reason, and Progress sat in the header from launch offering a panel about a corpus that was not open. The look moved onto `.hdr-btn`; the guard asks the rule, not a list of buttons |
| **B-177** | S3 | v3.14.355 | `fold:` sat on five fields from the day the table was written and **nothing read it**: the chip drawer folded inline with a literal, every writer stored what was typed. So `NOUN` from the chips and `noun` from the keyboard were different values to every index, count and search, in one corpus. Decided at the writer — case is not information in a tag, unlike a gloss, where rewriting the annotator's text would destroy a distinction they might mean. Measured before the fix: both live corpora were already correctly cased, so the hazard had cost nothing yet |
| **B-187** | S2 | v3.14.354 | **The word-gloss field drew an empty box over a word that had a gloss.** Since B-186 a value equal to the morpheme join is not stored, and for a monomorphemic word that is the ordinary case — but the editor filled the field from the stored `gloss` key. So reopening a glossed word showed nothing to clear, clearing did nothing, and the gloss stood. The word↔morpheme mirror could not help: it attaches when the two fields agree, and its test was the narrower `both are empty`. **This is what `gui_crud` C2 had been reporting since B-176 was called closed** |
| **B-186** | S2 | v3.14.353 | The save and the load disagreed about one value. D60 said `word.gloss` holds only what a person typed and did not say what to do when what they typed IS the join: `saveWord` stored it, the load-time migration dropped it. So a file the app had just written contained a field it removed the moment it read it back, and save → open → save was not stable. One predicate, `storedWordGloss`, asked at both ends. Found by `gui_crud` E3/E4 reopening a real file — both ends are right alone, and only the round trip shows it |
| **B-184** | S2 | v3.14.351 | **Reported from use, twice.** Picking `<name>.journal.jsonl` from the file dialog loaded nothing: `.` sorts before `_`, so the journal is the FIRST file in every project folder, and a journal is usually 0 bytes — so the content detector called it `unknown` and the app said it could not tell what the file was. It could: the app wrote the name, and the name is the role. A participants file had the same shape with a politer message. Both open their project now, through the same one door |
| **B-185** | S3 | v3.14.351 | With no corpus loaded the section view said "Section not found.", blaming the section for the absence of the whole document and sending the annotator looking for the wrong thing. Found beside B-184, which is what produced the empty state. A derived guard found the same defect in `renderParagraph` and `renderParagraphEdit`, which nobody had looked at |
| **B-182** | S2 | v3.14.350 | **The Progress panel could not be closed, and sat on screen empty, for 17 versions.** An author `display:` beats the UA stylesheet's `[hidden] { display: none }`, so B-162's `display: flex` on `#gap-panel-box` silently disabled `el.hidden`; empty because `renderGapPanel()` runs only when it is OPENED. `#offer-panel-box` inherited it and was left out of the shared positioning rule too, so the dictionary offer's last Accept looked like a no-op. Nothing that asks the DOM can see this |
| **B-183** | S2 | v3.14.350, v3.14.352 | The add-to-dictionary tick sat inside the row's `<summary>`, and opening a `<details>` is the summary's ACTIVATION BEHAVIOUR — the click's default action, not a listener. One default served both controls: `stopPropagation` could not cancel it, and `preventDefault` cancelled both — a checkbox's canceled activation restores the state the browser flipped before any listener ran, so **v3.14.350 stopped the tick moving at all and its guard passed.** Closed structurally: the tick is a sibling of the details |
| **B-180** | S2 | v3.14.348 | `ensureMorphemesFromParse` wrote morphemes — gloss, type, transliterations, `dict_id` — and never called `mutate()`, the one chokepoint that journals a write and moves the session counters. A dictionary load wrote 19 links with `_dataGen` 0→1, **0 journal records, `sessionChanges()` 0, and `_journalComplete` still `true`**. An incomplete journal is survivable by design; one that claims a completeness it does not have is not, because compaction folds it into the base on that claim |
| **B-176** | S2 | v3.14.347 | A word gloss could not be cleared: emptying the field and saving brought the old value back. `word.gloss` stored either a typed value or the join of the morpheme glosses with nothing to tell them apart — `wordGloss` had to guess — so an empty explicit gloss was indistinguishable from *never set* and the save re-derived from the morpheme `saveWord` had created when the gloss was first typed. D60 stopped storing the join; 306 of 310 stored glosses across both corpora were it, and the display changed for none of them |
| **B-179** | S2 | v3.14.344 | The venv re-exec sat at module level in four scripts, so it fired on IMPORT — and `os.execv` does not return. Any Python program importing one was replaced by a fresh interpreter running its own argv; under `python -c`, `sys.argv` is `['-c']` with the script text absent, so the caller got `Argument expected for the -c option` in place of its module. Windows was never adopting the venv either (`bin/python` only), and the four copies had already drifted |
| **B-175** | S2 | v3.14.343 | **Section delete did nothing for ~200 versions.** The handler delegated on three style classes while reading `data-arr`; a restyle gave the delete button the shared `btn btn-danger btn-sm` and `.sec-del-btn` survived only inside that selector. No confirm, no row removed, no log line — and it was the only entity-level delete the GUI offers. `selector_audit_test.js` HAD flagged the dead selector and was answered with "the section editor has no delete button", which was false |
| **B-178** | S2 | v3.14.343 | `merge` pushed paragraphs into the surviving section on the click while `del` waited for Save, so leaving the editor without saving kept the merge |
| **B-174** | S2 | v3.14.337 | `#app-name` was on two elements, so opening an annotator preview overwrote the app's own header title |
| **B-171** | S1 | v3.14.336 | A second corpus door never replayed the journal, so a reopen could erase everything since the last compaction |
| **B-172** | S2 | v3.14.335 | Saving a word wrote `AFFIX` on every non-initial morpheme and recorded a person as having decided it |
| **B-173** | S2 | v3.14.335 | Filling a shared dictionary entry left no provenance, while the link beside it was stamped |
| **B-162** | S2 | v3.14.332 | The progress panel had no max-height, so its fold grew off both edges of the screen |
| **B-163** | S2 | v3.14.331 | `+ dict` on a monomorphemic word's morpheme did nothing at all — five correct lines composing into a no-op |
| **B-164** | S2 | v3.14.330 | Taking a lexicon chip linked the row and delivered none of the three values it advertised |
| **B-165** | S2 | v3.14.330 | A morpheme POS/type from an offer, and the word's own POS, were stored as the annotator's judgement |
| **B-166** | S2 | v3.14.330 | The word's part of speech had a 29-tag palette and no offer — 85% glossed against 4–7% tagged |
| **B-167** | S3 | v3.14.326 | One tracker checkbox appended 123,229 chars — `setTracked` put the document deep |
| **B-168** | S3 | v3.14.326 | `requireCorpus` took the first substring match; guards read an archived corpus and named the live one |
| **B-160** | S2 | v3.14.321 | **Reported from real use.** `applyProjectBundle` armed `_dictSavePath` *inside* `if (project.dictText)`, so a 0-byte companion — the ordinary state of a corpus glossed before a lexicon exists — left the path unset, and the first entry created would have gone somewhere of its own: a project of four files silently becoming three plus a stray. Bind on the file, apply on the content |
| **B-159** | S2 | v3.14.320 | D34's session half reported every document, section and paragraph save as a **removal**. `_recordKind` resolved ids through the four flat indexes and the containers have none, so an unresolved id fell to "removed" — the branch that exists for a record genuinely deleted. Retitling a corpus said *"removed 1"*, and had since stage D shipped at v3.14.308. Found by looking at the rendered panel, not by a guard: three assertions covered the removal branch and none asked what a container id does |
| **B-158** | S2 | v3.14.315 | Search-B's Regex, Case and Full-paragraph toggles did nothing: `tog()` has emitted `data-action="seg"` since the segmented control landed, and the handler still read `case 'sb-toggle'`. `render()` runs either way, so each click repainted identical state and the control looked like it was refusing rather than broken |
| **B-156** | S2 | v3.14.312 | `.gitignore`'s `!samples/**` out-ranked `*.b105-bak`, so the first commit would have carried three pre-repair backups — 72 KB, the known-wrong fixture included, 273 occurrences of a participant name. Inert only for a subset of paths, which is why reading it never showed it; found by `ship_disclosure.py` **before** `git init`. `gitignore_test.js` asks git in both directions now |
| **B-115** | S3 | v3.14.309 | the annotators view sorted and the sources view did not, and the two are the same table — same class, same header row, same edit column. I9 had scoped the pointer cursor away from the Sources headers *because* their click did nothing, so the stylesheet carried the divergence as a rule. One sorter, one header cell, one attribute, a state object per view |
| **B-053** | S3 | v3.14.309 | full-dictionary scans per keystroke. Re-measured twice: the entry's own numbers never reproduced, and by v3.14.309 its ranking was stale too — `AC_POOLS.gloss` (added v3.14.303) costs 0.248 ms against `pos`'s 0.034, and it is the only pool whose length grows with the corpus rather than with a fixed inventory. Cached on `_dataGen` **and the locale**; the cheap two are left alone, because a cache there is a staleness class bought for 30 µs |
| **B-051** | S3 | v3.14.257, v3.14.309 | `new_version.py` silently ignored files named alongside `--type decision` or `--type finding`, so a docs-only entry that also edited a live document got no pre-edit copy and no warning. Fixed by archiving them rather than by refusing, which the entry had preferred — a decision that also edits a live document turns out to be the common case, not the confused one. **Closed v3.14.309**, having sat fixed and unlisted for 52 versions |
| **B-155** | S2 | v3.14.291 | two identical entries for one form and no operation that made them one. `deleteDictEntry` CLEARED the references it counted, so the choice was two duplicates or one entry plus orphaned tokens. D52's merge repoints instead: `dev/design/D52_entry_merge.md` |
| **B-093** | S2 | v3.14.193, v3.14.303 | a morpheme's transliteration was settable NOWHERE — the input was pulled from the row in v4.0.9 as too cramped, every save preserved the value, and nothing could enter one. It waited for D32 because a single box would have recreated B-045's shape one level up; the row carries the shared multi-label editor now, folded |
| **B-045** | S3 | v3.14.303 | the word's transliteration was one unlabelled box over a multi-label array: no label, no second system, and `surface_conformance_test.js` declined to check the control kind because of it. Same editor as every generated level now, and the guard's exemption went with the mismatch it excused |
| **B-142** | S3 | v3.14.303 | emptying the word's transliteration box and saving left the old value, silently — an empty string fell through `else if (!length)`. The editor drops a row with neither label nor text, so the field can be cleared |
| **B-145** | S3 | v3.14.303 | `samples/turkish-test` carries `test system` ×2 and `Test System` ×1, and nothing could have prevented it: labels were harvested from words and morphemes only, so a sentence-level label was never offered back. Every level feeds the pool now — the labels stay raw by decision, and the recommendation is what makes a second spelling a choice |
| **B-033** | S2 | v3.14.302 | the fill relations between fields had no defined pipeline. The linking half closed at v3.14.108/138; the filling half is **D53**, six stages — one identity rule for the form index, a save that says what it will derive, a gloss pool of this project's own words, the parse field saying what the lexicon has per segment, and two decisions taken rather than coded. Every stage offers; none applies |
| **B-144** | S3 | v3.14.298 | `wordFormRefs`/`morphFormRefs` were keyed on the raw form while every dictionary lookup keyed on `normForm`. Measured on the corpus being annotated: 90 raw word keys against 85 folded, the fable's content words each split by a sentence-initial capital, and 0 lost in Mandarin — invisible in one of the two corpora. D53 stage A |
| **B-034** | S3 | v3.14.295 | every arc endpoint landed on its token's exact centre, so a token that was both head and dependent had its outgoing tail and one arrowhead per dependent converging on one point — and each arc arrives vertically, so the arrowhead had no stroke to belong to. Endpoints fan now, ordered by where the arc's other end sits |
| **B-123** | S3 | v3.14.294 | `autoLinkWord` was reached from one place — `_finishSave` in `saveWord` — so a token never opened in the word editor was never linked however unambiguous it was, and coverage was a function of what had been opened. `backfillLinks` runs `linkTo` over every unlinked token; measured on the fixtures, 19 links waiting in `turkish-test` and 11 in `chinese-test` |
| **B-114** | S3 | v3.14.293 | D35 A1 numbered dictionary entries and left lemma records with no discriminator, so `lookupLemma` returned whichever the bucket held first and a second `yüz` could not be created from the lemma field at all. B4 stopped the guess by refusing and named what was missing; this supplies it — the same `_numberBucket`, one layer over — and the strip asks instead of apologising |
| **B-154** | S2 | v3.14.292 | `applyDict` replaced `S.lemmas` wholesale, so a lemma record created this session and not yet written was deleted by the next load while every token and entry put on it kept its `lemma_id`. A load could do what `deleteLemmaRecord` is forbidden to do — remove a record that still has members. B-146 made reloading constant for the sessions that produced `chinese-test`, which is why it surfaced there |
| **B-143** | S2 | v3.14.290 | `assignHomographs` was called from the two paths that CREATE or rename an entry, and `buildDictIndex` — how most entries arrive — called neither, so an entry loaded from a file was never numbered and never would be. `samples/turkish-test`'s two `metin`, both NOUN, both glossed `text`, had no numbers and could not get any |
| **B-110** | S2 | v3.14.289 | "Export Corpus" called the autosave path, which `compact` declined outright when autosave was off — nothing written, nothing said, no log line, in the one case an annotator has most reason to press it. Three silent returns; a no-op was indistinguishable from a failure. Now "Save now" with a result line every time, and a real **Export…** beside it |
| **B-149** | S2 | v3.14.289 | the naming convention had six spellings and the three save dialogs each guessed. `S._corpusFilename` held a full basename after a load and a bare slug after a create, so the corpus dialog and the participants dialog were each right exactly when the other was wrong. One table now, `source/modules/project_files.js` and its Python twin |
| **B-150** | S2 | v3.14.289 | `journalPath()` stripped `_(corpus\|dictionary).jsonl` where the Python reader fell back to `splitext`, so on a base without a role suffix the journal was written to `X.jsonl.journal.jsonl` and read from `X.journal.jsonl`. Records since the last compaction were on disk and never replayed |
| **B-151** | S3 | v3.14.287 | three surfaces asked "is this punctuation?" and gave three answers. The sentence IGT's was a four-mark ASCII list, so all 32 Chinese `。`/`，` drew as live words and 4 Turkish marks were dead in the one view D30's comment leans on for reaching them. `_navIsToken` is the rule now, and the link stays on every token: dim, reachable, never landed on |
| **B-153** | S3 | v3.14.286 | B-146's own detector matched `record_type: 'entry'`, which no writer emits — the value is `dict_entry`. The branch was dead for two versions and the detector answered `dictionary` through the `lemma` row or the shape fallback, so nothing showed it. Rule 5, inside the fix for a rule-5 defect |
| **B-152** | S3 | v3.14.286 | the add-to-dictionary row was written to open when it is ticked and the `open` attribute was spelled as a space, so every row arrived folded and what the panel was about to write took a click per row to read |
| **B-148** | S2 | v3.14.285 | B-111 merges a lone morpheme into the word row, and the word row's `type` is the literal `'word'` `_wordSeeds` mints for every word — so the add-to-dictionary panel offered `word` for a morpheme the annotator had declared `root`, and the declaration was discarded on the way to the entry. B-069's rule, unapplied at the merge |
| **B-146** | S1 | v3.14.284 | `detectFileType` sniffed the shape of line 1, which since interning (v3.14.226) is the `prov_events` table — so **every file the app writes was unopenable**. `samples/turkish-test` opened only because it predates interning. The detector reads the `record_type` declaration now and skips the format rows; shape-sniffing is the fallback for pre-`record_type` files |
| **B-147** | S2 | v3.14.284 | `saveNewCorpus` deferred `promptNewCorpusAutosave(title)` where the variable is `v.title`, so the autosave prompt threw a ReferenceError 200 ms after every new corpus was saved and no one was ever offered autosave. A deferred callback is not checked until it fires |
| **B-106** | S2 | v3.14.282 | 19 of 33 lemmas were pointed at by a token and by no dictionary entry, so the dictionary side could not answer "which entries share this lemma" — closed as a VIEW that asks both indexes, not as a model change |
| **B-141** | S2 | v3.14.280 | a word field the app assembled from the morphemes — transliteration, gloss or parse — was stamped with the annotator’s own moment, because the only test was whether the value had changed. B-061’s shape, third occurrence |
| **B-120** | S2 | v3.14.279 | search compared object-language forms with the regex `iu` flag and grouped them with `toLowerCase`, so a Turkish corpus’s three `İkna` were invisible to a search for `ikna` — B-043 in a second module |
| **B-134** | S2 | v3.14.276 | every morpheme had lost its revision trail — `saveWord` refreshed `prov` and never appended, `applyProvToObj` overwrote the creation stamp before seeding an empty history, and no script ever wrote `prov_history` at all |
| **B-124** | S3 | v3.14.236 | `saveWord` rebuilt `word.morphemes` from a literal naming nine keys, so every other key was deleted on every save — `comments` among them. `mergeMorpheme` applies the panel's keys over the stored morpheme and carries the rest through, `undefined` meaning delete so the deliberate drops stay deliberate |
| **B-037** | S3 | v3.14.237 | Three hand-typed copies of the schema allow-lists, one of them regex-scraped from another and `eval`ed. It was the cause of B-119's guard failures, not a tidiness item; the lists derive from `field_spec.js` now |
| **B-119** | S2 | v3.14.238 | Two discriminator vocabularies for one idea — `record_type` for sources, annotators and the event table, `record` for lemmas. Settled on `record_type`; 29 rows migrated |
| **B-121** | S3 | v3.14.260 | Six functions wrote a token's `dict_id` and one stamped it, so **91 of the live corpus's 92 links carried no provenance** and not one was chosen by a person. `linkTo` is the one writer, and a chosen link stamps as theirs where an automatic one stamps derived |
| **B-122** | S3 | v3.14.260 | Two writers, two opposite ambiguity rules, and the silent one had the coverage: `_dictFillForForm` took `cands[0]` without asking and wrote **76 of 77 morpheme links** that way. It had cost nothing only because no live form was ambiguous — luck, not design |
| **B-140** | S2 | v3.14.270 | `dict-add` had exactly one `data-go` in the whole app and `renderDictAdd` assumed a word throughout, so a word that was not a morpheme of a token on screen could not be added at all. None of the five UX audits held it: an audit describes the surfaces that exist. Closed by D51's panel; `ui_wiring_test` now requires every view in the table to have a way in |
| **B-112** | S3 | v3.14.269 | The push asked two questions in two panels — which forms, then what they are, after the entries existed — and what it committed was shown by neither. One panel now, before the write, with an existing entry's stored values read-only and the fields it would fill named |
| **B-111** | S3 | v3.14.269 | `Ben` and its only morpheme `ben` were offered as two rows, both ticked — one lexeme presented as a choice between duplicates. No duplicate ever reached the dictionary, because the writer folds case; the defect was what the annotator was asked. The model marks the second row (`mergedInto`) rather than dropping it, so ids still index the full list and the merged row takes the answer of the row it merged into; `visibleRows` is what the panel draws |
| **B-058** | S3 | v3.14.267 | `saveDictEntry` gave the token back the entry's gloss and a seeded parse; `saveNewDictEntry` gave neither, so creating and editing left the token in different states and nothing recorded that as a choice. One tail now, `backPropagate`, called by both |
| **B-113** | S3 | v3.14.266 | `offerFillsNothing` asked the stored morphemes while `_fillMorphRows` writes the DOM, so a taken offer redrew as live until a save and a re-open — which is when it has stopped being feedback. The predicate reads the rows when there are any |
| **B-117** | S2 | v3.14.262 | `document.translation_language` was drawn by the generated form, validated, read by `translationTarget()` and by the CLI, provenance-stamped, and **assigned by nothing** — the live corpus held a `field_prov` entry for a value that was never stored, so that session's machine translations went to the fallback language. v3.14.217 wired the readers and not the writer. Not repaired in place: the assignment now comes off the field table like the read and the stamp already did, through `applyForm`, so the class is closed rather than the instance |
| **B-118** | S2 | v3.14.262 | `saveDictEntry` read the headword, validated it through `requireIdentity` and passed it to `stampFieldProv` — writing a `field_prov.form` record for a change it did not make — while never assigning `entry.form`. Add and edit disagreed, which is the drift D48 exists to delete. Closed by the same writer, and the form is the dictionary's KEY, so the handler now moves the entry between `dictByForm` buckets and renumbers homographs on both sides; the comment claiming the form is never edited here was the assumption that made the bug invisible |
| **B-138** | S3 | v3.14.261 | A stamp on a list field could only say who last touched the list, where the ordinary case is two translations added by different people years apart. Provenance moved onto the ELEMENT under `prov`, with **no format change**, and `assignList` reconciles by content so an unchanged element keeps its stamp |
| **B-137** | S2 | v3.14.261 | Ten functions wrote a `field_prov` entry in four spellings and **one of them interned**. Three measured consequences, the worst being that `provTipAttr` and `_humanField` disagreed about the same stamp, so a machine translation counted as a person's work. `stampField` is the one writer |
| **B-135** | S2 | v3.14.258 | Six sentence ids named a paragraph they were not in. Filed as a data defect and closed as a decision: `saveSection` reuses sentence objects so annotation survives a re-parse, and an id is an identity — renaming it would break every reference to preserve an appearance. Logged where it happens instead |
| **B-133** | S2 | v3.14.255 | B-105's code fix shipped and the live corpus was repaired, but **`samples/` was not**: 196 stamps in the published fixture carried a date one day late. The fixture every guard reads, shipped under MIT |
| **B-132** | S3 | v3.14.254 | `prov_clock_test`'s one behavioural assertion ran in the machine's own timezone, and B-105 was a west-of-Greenwich bug — so it passed in UTC and would have passed in Tokyo |
| **B-131** | S2 | v3.14.254 | `suggest_mechanism_test` could not catch B-082, the bug it was written for: its fixture set the displayed POS to the same value the offer delivers, so the assertion held whichever gate the code used |
| **B-116** | S2 | v3.14.253 | The corpus is read as one string and rebuilt as one on compaction, and **nothing measured the size before building it**, so past V8's 536,870,888-character limit the failure arrived late and unexplained — worst on save, where the annotation is already done and only in memory. Owns the characters-per-word figure (1,050) and states its method |
| **B-125** | S3 | v3.14.250 | The guard checked what a root must not store and never whether a root was SEEN, so it reported "0 root tokens" on a corpus with no parses and passed — the degenerate pass it existed to prevent, one level up |
| **B-130** | S3 | v3.14.246 | The morpheme row rendered the stored `annotator` field rather than the derived name, and `thinProv` deletes that field wherever it can be derived: **67 of 77 morpheme stamps rendered as an empty name, a dangling · and a date** |
| **B-128** | S3 | v3.14.245 | Thirteen guards each parsed corpus files their own way, four sharing a copied brace-scanner, and none expected a record that is not a document — so the first post-interning corpus broke four at once on its leading `prov_events` line. One loader now |
| **B-127** | **S1** | v3.14.244 | **Every per-field provenance stamp written since v3.14.226 was silently discarded on save.** `stampFieldProv` writes an OBJECT; interning made `serializeRecords` map `field_prov` through a table of values that were already numbers, and the replacer writes a key only when it finds one — so a stamp made during the session was dropped, not converted, not warned about. Seventeen versions went to disk as `field_prov: {}`. The guards asserted on what the writer put IN and nothing asserted on what came OUT of the serializer, which is exactly where this lived |
| **B-129** | S2 | v3.14.244 | `thinProv` ran only at LOAD, so any object a session touched was written with the display name inline: 19 occurrences in the corpus, 22 in the dictionary after one real session. It partly undid what interning bought |
| **B-126** | S1 | v3.14.227 | Found within an hour of shipping it by asking what a bad copy does. The provenance event table was the LAST line, so a truncated file resolved **every** stamp to nothing and `adoptProvEvents` then deleted the unresolvable ids. It is the first line now |
| **B-084** | S3 | v3.14.220 | The export type filter was a `<select>` offering everything or exactly one type, and the one came from a hard-coded `['all', 'word', 'bound.morpheme']`, two of the nine values in `TYPE_CHOICES`. Multi-select now, drawn from the vocabulary, everything on by default, with entries carrying no type given their own box rather than falling through the membership test. The report's own example, excluding lemma shells, had already been settled by D35 A2 |
| **B-086** | S3 | v3.14.219 | The settings panel reported "online" from `navigator.onLine`, which says only that the machine has a network interface, so the panel and the translation attempt answered two different questions and kept disagreeing. `probeGoogle()` makes the same request the app makes, against the same endpoint, and the strip shows what came back; the failure modal carries the recorded error rather than guessing at "you may be offline". Diagnostic rather than corrective, as the entry asked: the cause was never reproducible on demand |
| **B-085** | S3 | v3.14.218 | Word-edit carried three kinds of checkbox for one decision: a master, a disabled-until-master surface-form box, and one per morpheme row, with `syncPushDictState` keeping them in step as the parse was typed. One control now, and WHICH forms is asked once at the moment of pushing, before anything is written — by the picker then, by D51's panel since v3.14.269. B-068's rule survives as its defaults rather than as live syncing |
| **B-072** | S2 | v3.14.217 | The translation target was a literal `en` at four call sites, not the two the report named: the Google pair carried `tl=en` as well. The source beside each was resolved from the corpus, which is what made the hard-wired half easy to miss. `metadata.translation_language` now exists and the field table draws it; `translationTarget()` resolves it through `LANG_TO_CANONICAL` like the source, falling back to the interface language and only then to English. The CLI's `--target-lang` reads the corpus when no flag is given |
| **B-102** | S3 | v3.14.216 | Nothing caught a deleted declaration with surviving readers, and a `ReferenceError` inside a template literal aborts the whole string, so both instances (B-081, B-101) reached the annotator as a view that would not draw. `undefined_call_test.js` checks calls, not bare identifiers. `render_smoke_test.js` executes all 22 registered renderers against the fixture through the real loaders, so the question is settled rather than inferred. Verified against both original shapes: B-081's takes out eight views, B-101's exactly one |
| **B-054** | S3 | v3.14.215 | Both participant id sites minted `prefix_` + `list.length + 1`, under a comment that said "skip deleted to preserve stable IDs" while `.length` counted everything. A spliced array, or a file whose ids are simply not contiguous, mints a duplicate. `annotator_id` is stamped into provenance on every annotated object, so a collision reattributes somebody's work silently. `nextParticipantId` takes the highest number in use and ignores ids outside the pattern |
| **B-049** | S3 | v3.14.214 | The render cache key interpolated `S.dictNewEntry` itself, and an object stringifies to `[object Object]`, so every non-null prefill produced the same key and a second "+ dict" click did not re-render. `_dataGen` could not carry it either: opening dict-add mutates nothing. The discriminator is built from the object's own entries, so a prefill field added later is in the key without being named, which is the mistake B-050 made in this same path |
| **B-108** | S3 | v3.14.213, **completed v3.14.361** | An offer whose every value the row already had rendered like one that would fill three empty fields. v3.14.213 made the chip and the take ask one predicate — right, and not enough: `taken` is computed only for a `fill-rows` chip, and a word with NO parse never produced one. The panel read the raw parse field, the splice read `parse \|\| word.form`, so the filter suppressing an already-segmented entry saw nothing to suppress. One `workingParse()` now. Four forms reached the logs; the pattern across them was the evidence |
| **B-107** | S2 | v3.14.210 | Found by D48 stage C, not reported: three save paths validated their identity field not at all — both section handlers and the dictionary EDIT handler. A section could be saved with no title and an entry could have its form cleared away. Invisible to the old guard, which started from the alert call sites, and a check that does not exist writes no alert |
| **B-099** | S3 | v3.14.210 | An empty field in the completion modal looked the same as one deliberately left blank, in the one screen that exists because the push created empty fields. `core` and empty now carries its own mark, distinct from the identity asterisk, derived from the table in both the generated forms and this hand-written one. The type placeholder named two of the nine values as though they were the choice |
| **B-105** | S1 | v3.14.205 | `prov()` built its date with `toISOString()` (UTC) and its time with `toTimeString()` (local), so west of Greenwich every evening stamp carried tomorrow's date beside this evening's hour. 303 of 523 stamps in the Turkish corpus were wrong and nothing said so. `localDate()` / `localTime()` replace all three sites; `dev/repair_prov_dates.py` (v3.14.207, corrected v3.14.208) repaired the written records, reading the offset out of the ids rather than assuming it |
| **B-082** | S2 | v3.14.206 | Taking a lexicon chip filled gloss and POS and left `type` alone, because the offer never carried it and `_fillMorphRows` had no branch for it; the chip now shows the entry's type in its meta line and fills it behind the same `data-original` gate. Taking a chip also opened the autocomplete over every row it filled: the fill dispatches a synthetic `input` and the trigger did not ask who dispatched it. The caret returns to the chip strip, where the next offer is |
| **B-060** | S3 | v3.14.203 | The dict-add prefill contract was half-wired: `pre.translit` was dropped, so transliterating a morpheme and clicking "+ dict" lost it silently. The seed reads every key the producer sends now, and a guard compares the two directly |
| **B-050** | S3 | v3.14.203 | The prefill read keys nothing sets — `alternateForms`, and after the v3.14.201 rewrite `variants`, `semanticDomain`, `usageNotes`. A prefill that always resolves to '' reads as a working feature; the dead reads are deleted and the guard refuses new ones |
| **B-104** | S3 | v3.14.200 | The completion modal opened over the word view with no way back, so an empty gloss noticed too late could not be corrected. "Back to the word" returns with the push box still ticked; the push is a fill-only upsert, so re-saving fills the entry rather than duplicating it. Undoing the push was scoped out |
| **B-103** | S3 | v3.14.199 | `renderWordEdit` built the morpheme rows' data in three literals that omitted `type`, `dict_id` and the legacy `transliteration`, so a stored type rendered as an empty box and a linked morpheme showed no badge. B-093's tests passed because they built their own row objects |
| **B-094** | S3 | v3.14.198 | Five bibliographic fields written by `corpus_ingest.py` were stored and displayed nowhere. They render behind a disclosure in both document forms now, and are written back, so a wrong `--author` can be corrected |
| **B-092** | S3 | v3.14.198 | Paragraph-add collected three fields fewer than paragraph-edit, and sentence-add one fewer. Both now render from the same table, so the counts cannot differ. The line-aligned translation box at creation is still a bare string per sentence — that belongs to the ingest operation, not the field list, and is D46's |
| **B-091** | S2 | v3.14.198 | Section-add collected no source. Closed by construction rather than by adding the field: both modes render from one table now, so a form cannot be missing a field its twin has |
| **B-101** | S2 | v3.14.194 | D35 A2 deleted `const isLemma` from `renderDict` and left two readers, so the dict view threw on render. Same act as B-081; `undefined_call_test.js` misses it because it checks calls, not variables (B-102) |
| **B-098** | S3 | v3.14.192 | A corpus created in the app carried no `dict_key_version`. Same cause as B-097: `refreshFoldContext` is what stamps it, and the create path never called it |
| **B-097** | S2 | v3.14.192 | A corpus created in the app never bound a fold context, so the session that builds a dictionary from nothing ran under whatever fold the previous corpus left behind. Reopening the file bound the right one and rebuilt the index under different keys |
| **B-100** | S2 | v3.14.191 | `renderMorphSuggestPanel` returned `''` when it had nothing to offer, so the host element was absent and `refreshMorphSuggest` — which begins by looking it up and bailing — could never rebuild it. A word with no offers when word-edit rendered could never acquire any, however much of the parse was typed |
| **B-095** | S2 | v3.14.189 | Creating the first annotator set the session variable but not the annotator bar, and `readAnnotator` treats an empty bar as an explicit deselection, so the auto-select was written back to empty and the only annotator had to be picked a second time |
| **B-090** | S3 | v3.14.186 | The completion modal printed the string `null` as the type badge for an entry that had none, and offered no way to set one, so every first-of-several morpheme reached the dictionary unclassified |
| **B-089** | S2 | v3.14.186 | A morpheme's `type` was filled only by the enrich pass that runs when a project is opened, so a morpheme annotated and pushed in one sitting was written to disk untyped |
| **B-088** | S3 | v3.14.182 | Five fields had no autocomplete source; `AC_SELECTOR` named gloss fields by id, so any gloss field added elsewhere was invisible to the mechanism |
| **B-087** | S3 | v3.14.182 | One flag held the open state of every tag drawer, so a four-morpheme word opened five at once |
| **B-083** | S2 | v3.14.180 | Save refused to advance on a first annotation: `hasAnnotation` counted morpheme `dict_id`s that `ensureMorphemesFromParse` had assigned automatically, so a word nobody had touched read as already annotated |
| **B-081** | S1 | v3.14.177 | `requiredMark()` was deleted by the D45 rewrite while its seven call sites survived, so six views threw on render. `undefined_call_test.js` blanked template literals wholesale and could not see a call site in the only place this app makes them |
| **B-068** | S2 | v3.14.157 | "Save to dictionary" pushed the word form and every morpheme or nothing; each form now carries its own choice, and the surface form defaults off once the word has a parse |
| **B-061** | S3 | v3.14.156 | A gloss inherited from a dictionary entry was signed by the annotator who did not type it; the parse seeded beside it carried no provenance at all |
| **B-080** | S1 | v3.14.153 | `.gitignore` used trailing comments, which git treats as part of the pattern, so every commented rule was inert: the first commit would have carried 601 MB of CC-BY-NC weights and 103 MB of developer history |
| **B-079** | S3 | v3.14.152 | The README listed `dict_export.py` under command-line tools; it is a module the app imports, and running it does nothing |
| **B-078** | S2 | v3.14.151 | The CLI wrote a pre-G31 schema, so a command-line corpus opened with its translations invisible and `--stats` reported 0 of 13 translated for a fully translated corpus |
| **B-077** | S2 | v3.14.146 | The workspace `~/LingCoT` had the same name as the app folder; renamed `~/LingCoT-Data` with a migration, and a second definition of the path was found in the CLI ingester |
| **B-076** | S2 | v3.14.144 | README documented fields and an ID format that do not exist, and stated a `pre-commit` hook that was never written as a live protection |
| **B-075** | S2 | v3.14.143 | Morpheme rows re-paired on exact case-sensitive form, so a capitalisation fix in the parse discarded the whole morpheme record |
| **B-044** | S3 | v3.14.138 | `alternate_forms` meant nothing and matched nothing; split on conditioning into `allomorphs` and `variants`, both documentation until D35 |
| **B-064** | S2 | v3.14.137 | The check returned finished alert prose; the in-pane strip re-derived its own and the default backend fell through to "No language set" |
| **B-074** | S2 | v3.14.135 | The guard suite failed on a fresh clone: two guards asked whether a gitignored path existed, two needed `dev/archive/`, which is not distributed |
| **B-073** | S3 | v3.14.132 | A hyphen inside a morpheme gloss made the word-level summary read as more elements than there are morphemes; reported, not rewritten |
| **B-059** | S2 | v3.14.132 | Un-glossed morphemes were dropped from the gloss line; the gap is now rendered as `???` and still stored as empty |
| **B-056** | S2 | v3.14.131 | Browse filter, Leipzig filter and the chip splice were still on the pre-B-043 key; forms now fold with `normForm`, metalanguage with `normMeta` |
| **B-067** | S2 | v3.14.130 | Bundled OFL fonts named nowhere; the sweep also found the Phosphor sprite unattributed and the CC-BY-NC weights undeclared |
| **B-048** | S3 | v3.14.128 | Deleting a dictionary entry left corpus links dangling; the delete now counts them, says so, and clears them |
| **B-065** | S3 | v3.14.127 | Saving an edit advanced past it, hiding the result; save now advances on annotation and stays on revision |
| **B-032** | S2 | v3.14.125 | Autocorrect protection was a curated allowlist with 31 gaps; every text control is protected now, and the rule is universal |
| **B-057** | S1 | v3.14.112 | Re-tokenizing silently discarded annotated words; repeated sentences lost theirs on a no-op save |
| **B-071** | S3 | v3.14.124 | Morpheme rows had no POS default; the dict-add prefill wrote lowercase `affix` where the chip writes `AFFIX` |
| **B-069** | S2 | v3.14.123 | Every morpheme pushed to the dictionary was typed `bound.morpheme`, stems included |
| **B-070** | S3 | v3.14.122 | Schema guard rejected `metadata.dict_key_version`, added at v3.14.103 and masked by B-062 until v3.14.111 |
| **B-066** | S2 | v3.14.120 | CC BY-SA Wikipedia text in an MIT repo, resolved by removing the corpus rather than by a licence note |
| **B-062** | S1 | v3.14.111 | `log()` does not exist. Opening any corpus threw a ReferenceError for eight versions |
| **B-063** | S2 | v3.14.111 | Every failure in the corpus-open pipeline was reported as "Could not open file dialog" |
| **B-047** | S2 | v3.14.108 | The same lemma field created on miss in one panel and discarded on miss in the other |
| **B-046** | S2 | v3.14.108 | Saving a word silently deleted every morpheme’s dictionary link |
| **B-055** | S1 | v3.14.107 | Deleting the last dictionary entry was never written to disk, and the status line said "autosaved" |
| **B-052** | S2 | v3.14.106 | Four O(dictionary) lemma scans, 113 ms per word save at 50k entries |
| **B-043** | S2 | v3.14.103 | Dictionary key was `toLowerCase()`. Turkish `İ`/`I` forked lemmas silently |
| **B-042** | S3 | v3.14.101 | Sentence transliterations buried in a collapsed chip beside annotators |
| **B-041** | S2 | v3.14.99 | CLI ingestion wrote corpora into the repo, with a filename the app could not pair |
| **B-040** | S2 | v3.14.98 | Schema guard rejected the four D23 dictionary sense fields, same omission as B-036 |
| **B-038** | S2 | v3.14.95 | Search screen had no help, entry keyed `search`, view is `search-b` |
| **B-039** | S3 | v3.14.95 | Help button floated in front of open menus and modal backdrops |
| **B-036** | S2 | v3.14.93 | Schema guard rejected `head`/`dep_rel`, its copy of the schema was 45 versions stale |
| **B-031** | S2 | v3.14.91 | "Cannot reach Google Translate" when Google was never called, `auto` unvalidated, exception swallowed |
| **B-030** | S3 | v3.14.89 | Header dictionary chip absent on a new corpus, a "single writer" three paths never called |
| **B-026** | S2 | v3.14.84 | Export PDF panel unusable, a `document.body` modal wired through `contentEl` delegation |
| **B-025** | S1 | v3.14.81 | Running setup uninstalled the nllb and pdf tiers, `uv sync` is exact by default |
| **B-024** | S1 | v3.14.80 | Open Corpus File did nothing, a `Path` where the pywebview bridge needs `str` |
| **B-023** | S2 | v3.14.79 | The workspace step sat after `build_env.py`'s early return, skipped on every existing install |
| **B-022** | S2 | v3.14.78 | The workspace/migration step lived in `setup.py`, which `setup.command` never runs |
| **B-009** | S2 | v3.14.71 | Text inputs auto-capitalized on macOS, `autocapitalize` is a no-op on a physical keyboard |
| **B-021** | S3 | v3.14.70 | `icon('plus')` rendered nothing in three buttons |
| **B-015** | S3 | v3.14.69 | Root tokens carried no `dep_rel`, contradicting the D25 schema |
| **B-020** | S2 | v3.14.68 | The translation mode was discarded by every way of closing the modal |
| **B-019** | S2 | v3.14.67 | Translation mode change did not refresh the view |
| **B-018** | S2 | v3.14.66 | Pressing "Stop Server" reported a crash |
| **B-017** | S1 | v3.14.65 | The port probe was stricter than the server it gates |
| **B-016** | S1 | v3.14.64 | The NLLB server was never stopped, so it held its port forever |
| **B-014** | S3 | v3.14.61 | `navigate:` log line dropped the word id |
| **B-012** | S2 | v3.14.60 | `${t(...)}` in static HTML rendered as visible source text |
| **B-013** | S2 | v3.14.60 | Dependency arcs drawn hundreds of pixels right of their tokens |
| **B-011** | S1 | v3.14.59 | Every fold in the sentence view is inert, view state absent from the render cache key |
| **B-010** | S3 | v3.14.58 | File menu tooltip rendered a raw locale key |
| **B-008** | S1 | v3.14.57 | Section and paragraph views dead, a local shadows the `t()` locale function |
| **B-007** | S1 | v3.14.55 | Chip interactions dead app-wide, stale selectors after the chip unification |
| **B-001** | - | v3.14.51 | Dark mode: sentence text unreadable in paragraph view |
| **B-002** | - | v3.14.51 | LaTeX export panel invisible in dark mode |
| **B-003** | - | v3.14.51 | `--surface-raised` never defined |
| **B-004** | - | v3.14.51 | `--r-lg` never defined |
| **B-005** | - | v3.14.51 | `--success` / `--danger` never defined |
| **B-006** | - | v3.14.51 | `--font-mono` never defined |

---

## Withdrawn (reported, investigated, not defects)

*Kept because the reasoning is worth more than the entry. A withdrawn report is
usually a place where the design is right and unobvious, which is where the next
person will file the same bug again.*

**W-01 · There is no way to edit the comment on the document.** Reported
2026-09-02 while annotating `turkish-test`, quoting the document's own
description text; withdrawn the same day, by the reporter, having found the field
"in a collapsed menu". Recorded because the next person will file it again.

There are **two** free-prose fields on a document and the report was about the
wrong one. `comments` is tier `aux`, so it renders inline and always has — a row
editor with an *Add comment* button, on the document edit form, not folded. It
was **empty**. The text the report quoted is `notes`, tier `extra`, and `extra`
is the one tier rendered behind a disclosure — `<details class="edit-extra">`,
labelled from `LEVEL_EXTRA_LABEL`, which for a document says **"Bibliographic
details"**.

So an annotator looking for "the comment on this corpus" finds an empty comments
editor in plain sight and their actual text under a fold whose label does not
suggest prose about the corpus. Both halves of that are defensible on their own —
`extra` means *never prompted, not never shown* (B-094), and four of the five
document `extra` fields (`authors`, `content_sources`, `content_date`,
`publisher`) genuinely are bibliographic. `notes` is the fifth, and it is the
only one of them that is neither bibliographic nor rarely used.

**Not filed as a defect**, at the reporter's request. If it recurs, the cheap
answers in order: move `notes` out of `extra` to `aux`; or give the document its
own extra-label that does not claim the fold is bibliographic; or decide whether
a document needs two prose fields at all, which is the real question and belongs
with D48's tier table rather than in a bug.

**B-096 · A morpheme recommendation never fires for an archiphoneme.** Filed
2026-08-28, withdrawn the same day. `suggestMorphemes` offers an entry whose form
is a **substring of the surface word**, and taking one splices that form into the
parse. A citation form like `(s)I(n)` is notation, not text, so it is not a
substring of *paltosunu* and is not meant to be matched there. The path for an
archiphoneme is the other half of the same strip, `suggestParseEntries`, which
matches parse segments exactly and resolves `(s)I(n)` correctly — verified
against the live dictionary.

What made it look broken was **B-100**: the strip's host element was not rendered
when there were no offers, so the parse-match half was never asked. One real bug
presenting as two, and the second description blamed the half that worked.

The lesson worth keeping: the two halves of that strip answer different
questions, and a report that one of them "did not trigger" should be tested
against the half that owns the case before anything is filed.
