# LingCoT Edit Log
**Updated:** 2026-09-24 · **Version:** v3.15.4

**Earlier entries are archived, verbatim, in `dev/archive/docs/edit_log/`:**
`edit_log_2026-05_to_2026-06.md` (71 entries, 2026-08-24) and
`edit_log_2026-08_v3.14.048_to_v3.14.299.md` (257 entries, 2026-09-01).
This file keeps v3.14.300 onward — **80 entries** — which is the work D55
through D61 and clusters A and B belong to. Cut by version rather than by date
because a month boundary means nothing here: 302 of the 306 entries were one
month. **The next cut is the fixture swap**, not a number: everything before it
is the app being made ready, everything after is the app with its shipped data,
and that boundary means something in a way that "50 entries" did not — this line
said 50 for thirty entries.

**House style:** an entry is *what changed · why · the guard · verification*, a few lines. Reasoning that a future reader needs belongs in a code comment, where it is read at the point of use rather than found by archaeology. The long-form entries below 2026-08-24 predate this rule; they are kept as written.

---

## B-227: release page download; setup_NLLB.command executable (2026-09-24)
**Version:** v3.15.4 · **Type:** fix · **Archives:** `dev/archive/changes/release_page/` (v3.15.3)
**Touched:** README.md · TESTERS.md · setup.md · setup_NLLB.command · dev/tests/hooks_executable_test.js · dev/BUGS.md
**Closed:** B-227

**What changed.** Testers get the build from a GitHub release page with a zip asset, `LingCoT-3.15.4-macOS.zip`, made by `git archive` from the tag.
- README: download from the latest release is Option A; cloning is Option B, with `--branch <tag>` for a particular release and the Command Line Tools prompt on a Mac. The link to an empty Releases page is gone.
- TESTERS.md: a first step, "Get the build", linking the v3.15.4 release page.
- setup.md: what to do when macOS blocks a downloaded `.command` (right-click Open on macOS 14 and earlier, Privacy & Security on 15 and later, or `bash setup.command` from Terminal).
- B-227: `setup_NLLB.command` is recorded 100755.

**Why.** The README pointed at a Releases page with nothing on it, cloning gave `main` rather than the tester build, and TESTERS.md never said how to get the build. Checking the tag zip found B-227.

**Guard.** `hooks_executable_test.js`: every tracked `.command` and `.sh` file is recorded 100755. Fails on the v3.15.3 index.

**Verification.** `./dev/tests/run_all.sh`: 103 passed; `hooks_executable_test.js` passes (6) once the mode change is staged and fails before it. The v3.15.3 tag zip unpacks with `setup.command` and `LingCoT.command` executable; `git archive` keeps the bits.
---

## B-218 to B-223: fixes from the scripted tester session; tester build macOS-only (2026-09-24)
**Version:** v3.15.3 · **Type:** fix · **Archives:** `dev/archive/changes/tb_session_fixes/` (v3.15.2)
**Touched:** source/LingCoT.html · source/modules/field_spec.js · source/LingCoT.pyw · source/resources/locale/en.json · source/resources/locale/haw.json · QUICKSTART.md · TESTERS.md · setup.md · README.md · dev/BUGS.md · dev/tests/printed_commands_test.js · dev/tests/annotation_gaps_test.js · dev/tests/journal_disk_test.js · dev/tests/linking_s1s3_test.js · dev/tests/normalize_test.js
**Closed:** B-218, B-219, B-220, B-221, B-222, B-223 · **Opened:** B-224, B-225, B-226

**What changed.** A fresh clone of v3.15.2 was installed in a clean Linux container and the real app was driven through QUICKSTART under a virtual display (new corpus, annotator, section, translation, word analysis, dictionary, Reader, interface language, search, Progress, reopen, reopen after a forced kill). Data survived both reopens.
- B-218: the word gloss row declares `filledWhen: 'hasWordGloss'`, which reads `wordGloss`.
- B-219: `reportLinkNotes` logs the number of notes; the text stays on the status line.
- B-220: `append_abs` opens the journal 0600 and tightens an existing one.
- B-221: NLLB commands in the app use `source/scripts/` and `source/setup.py`.
- B-222: `saveNewCorpus` stamps the current `dict_key_version` before binding the fold.
- B-223: autosave hint, source hint, annotator filter message and QUICKSTART name the controls on screen.
- The tester build is macOS-only. TESTERS.md, README and setup.md say so and describe the Linux failure (B-224) and the Qt dialog text (B-225). B-226 (help button over the File menu) is recorded, not fixed.

**Why.** Found in the session log review for the tester build; each is something a tester would meet in the first half hour.

**Guard.** `annotation_gaps_test` (a morpheme-glossed word is glossed), `linking_s1s3_test` (a note reaches the screen, not the log), `journal_disk_test` (journal mode 0600, new and existing), `printed_commands_test` (now scans LingCoT.html), `normalize_test` (key version stamped before the fold binds). Each fails against the pre-fix code.

**Verification.** `./dev/tests/run_all.sh`: 104 passed, 0 failed.
---

## Fewer interface strings, shorter tooltips, hints and help (2026-09-24)
**Version:** v3.15.2 · **Type:** chore · **Archives:** `dev/archive/changes/ui_strings_merge/` (v3.15.1)
**Touched:** source/resources/locale/en.json · source/resources/locale/haw.json · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · dev/tests/session_panel_test.js · QUICKSTART.md

**What changed.** Distinct English UI strings 862 → 795 before the help-text pass; keys 1257 → 1219.
- 29 lowercase copies of labels (`gap.name.*`, `gap.field.*`, `label.kind.*`, `copy.key.there`) removed. `tInline()` lowercases the label; a locale can still set the key. `label.editor.push_morph` (unused) removed.
- The "+" on create buttons is drawn by CSS (`.add-mark`), so "Add Source" is one string for button and dialog title. ＋ and + unified.
- "New Paragraph/Section/Sentence" for breadcrumb, header and the button that opens the form; the form's submit reads "Save".
- Tooltips and help titles in Title Case; six "Remove …" tooltips read "Remove"; six "… not found" statuses read "Not found"; near-duplicates merged (Create Lemma, e.g. placeholders, Leipzig Glosses, Select Sources, Transliteration, file read/parse errors).
- Paragraph and sentence counts read "Paragraphs: {n}"; the `_1` keys are gone.
- Required-field alerts use the inline marker's wording, and the empty box is outlined (`markMissing`).
- Five hints named buttons by their old labels; updated. QUICKSTART follows.
- 34 tooltips shortened from the help-text review (551 → 381 words in `title.*`); the three HTML fallback titles follow.
- 29 field hints shortened (725 → 417 words in `hint.*`). Four unused hint keys removed: `hint.editor.notes`, `hint.editor.sources`, `hint.editor.word_forms`, `hint.es.word_morpheme_list`.
- 31 help texts rewritten in plain language (1,289 → 988 words in `help.*`), with out-of-date descriptions corrected: File menu, KWIC and Sentences tabs, space-separated word tokenization, no Dependency parse button, no Potential matches chips, no drag and drop. The help sidebar's HTML fallback text follows. `help.faq.open.p2` now says the companion dictionary opens with the corpus; `help.faq.open.p3` (swapping dictionaries) removed.

**Why.** Less to translate before the Hawaiian pass. Nouns are not inserted into templates: Hawaiian ka/ke depends on the noun.

**Guard.** `session_panel_test.js` accepts a field name from `_INLINE_LABEL`; `theme_audit_test.js` caught the class on two id-styled buttons.

**Verification.** `./dev/tests/run_all.sh`: 104 passed. `gui_crud_test.js` 46 passed, `pseudo_locale_test.js` 6 passed. Document, section and New Section views checked in Chromium.

---

## English interface wording normalized before translation (2026-09-24)
**Version:** v3.15.1 · **Type:** chore · **Archives:** `dev/archive/changes/locale_wording_cleanup/` (v3.15.0)
**Touched:** source/resources/locale/en.json · source/resources/locale/haw.json · QUICKSTART.md

**What changed.** 194 of 1,257 strings in `en.json`; `haw.json` copied from it again (still a placeholder). Source: the wording review page (64 of 73 groups decided), then rules applied across the file:
- 60 review edits applied. 25 held lowercase: `gap.name.*`, `gap.field.*`, `label.kind.*` are inserted into sentences ("3 words need a gloss"). 8 "Use for all" spillovers not applied: the dictionary card title, the copy-review key, a badge, two dialog titles.
- Terms: "lexicon"/"dict" to "dictionary" (8), "POS"/"PoS" to "part of speech" (2).
- Title Case for 98 short labels and buttons that start with a capital; lowercase fragments, statuses and tooltips unchanged.
- 18: no trailing colon on short labels, no arrow on labels, no ellipsis on buttons or placeholders. 17: no full stop on short status lines.
- QUICKSTART: five bold labels follow the new wording.
- `doc_integrity_test.js` §8b: a **Touched:** folder (`dev/tests/vendor/`) counts as changed when anything under it did; v3.14.420 failed on it.

**Left open.** Review groups g054 and g062; the `＋`/`+` prefix, quotation marks, em dashes and `(s)` plurals are not decided.

**Guard.** `locale_style_test.js` (6): one name per concept, Title Case on 353 short labels, lowercase inserted words, no ellipsis or arrows on controls. Mutation: the pre-change `en.json` fails 5 of 6.

**Verification.** `./dev/tests/run_all.sh` 104 passed; `gui_crud_test.js` 46 passed; `pseudo_locale_test.js` 6 passed; placeholders and HTML tags identical in every string before and after.
---

## Tester build v3.15.0: TESTERS.md, the reader in the quickstart, --release --minor (2026-09-24)
**Version:** v3.15.0 · **Type:** feature · **Archives:** `dev/archive/changes/tb-release/` (v3.14.419)
**Touched:** TESTERS.md (new) · QUICKSTART.md · README.md · dev/new_version.py · dev/tests/change_files_test.js · dev/tests/doc_integrity_test.js · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/changes/README.md
**Change:** `tb-release`

**What changed.**
- `TESTERS.md`, linked first from README Contents and from the quickstart: install and first session, what is new, known issues (B-028, B-035, English exports), and what a report needs (steps, expected and actual, the version line from the help sidebar, the newest `app_….log`). A live document: `new_version.py` stamps it, `doc_integrity_test.js` checks the stamp.
- QUICKSTART §12, *Read it*: both reader modes and the language picker.
- `new_version.py --release --minor`: the last change takes X.Y+1.0, the others patch numbers, so this build is exactly v3.15.0.
- DEV_PLAN gate 2: D41 and the picker done, 2 items open (the macOS clean-machine install on v3.15.0, D46 answers from testers).

**Guard.** `change_files_test.js` +2 (`--minor` in a temp repository: v3.14.5 then v3.15.0, build 3.15.0). `quickstart_labels_test.js` covers the new bold labels. §B-208's live-document list includes `TESTERS.md`. §8a fails on a change file still titled `TITLE`: two were, and only `--release` noticed.

**Verification.** `./dev/tests/run_all.sh` — 103 passed, 0 failed; `doc_integrity_test.js` 83 passed.

---

## Bugs recorded on branches cannot be lost unnoticed: report, id allocation, table check (2026-09-24)
**Version:** v3.14.429 · **Type:** feature · **Archives:** `dev/archive/changes/bug-safeguards/` (v3.14.419)
**Touched:** dev/new_version.py · dev/tests/change_files_test.js · dev/tests/doc_integrity_test.js · dev/PRACTICES.md · dev/changes/README.md
**Change:** `bug-safeguards`

**What changed.**
- `new_version.py --bug-report`: for each local and remote branch not merged into `main`, the bug ids its `BUGS.md` has and `main`'s does not. It also runs, silent when empty, at every start on `main` and at `--release`; `doc_integrity_test.js` prints it on every run.
- `new_version.py --next-bug`: the next free B-nnn after reading `BUGS.md` on every branch.
- `doc_integrity_test.js` §8a: every B-nnn a change file names must have a row in `BUGS.md`.
- PRACTICES §1 Branches: four rules, including fixing a bug that is also in `main`'s code on `main` first.

**Why.** A bug recorded on a branch reaches `main` only by the merge. An abandoned or deleted branch loses it, two branches can take the same id, and a bug named only in change notes is not in the table. B-215 showed the fourth case: in `main`'s code, fixed only on the branch.

**Guard.** `change_files_test.js` +4 in a temp repository: the report names the branch and only the bug `main` lacks, `--next-bug` counts the branch's ids, the current branch does not report itself, a merged branch drops out. §8a's new check (mutation: an id with no row, added to a change file, fails it).

**Verification.** `./dev/tests/run_all.sh` — 103 passed, 0 failed. `--bug-report` on this repository: no unmerged branch holds a bug main lacks; `--next-bug`: the id after the highest on any branch.

---

## B-216, B-217: tests no longer write to logs/, and pruning goes by age (2026-09-24)
**Version:** v3.14.428 · **Type:** fix · **Archives:** `dev/archive/changes/b216-b217-logs/` (v3.14.419)
**Touched:** source/log_setup.py · dev/tests/_source.js · dev/tests/run_all.sh · dev/tests/cli_prov_test.py · dev/tests/nllb_diag_test.py · dev/tests/hooks_executable_test.js · dev/tests/log_setup_test.js (new) · dev/BUGS.md · dev/PRACTICES.md
**Change:** `b216-b217-logs`

**What changed.**
- `log_setup.py`: `LINGCOT_LOG_DIR` overrides the logs directory. Pruning sorts by modification time and never deletes the file the session just created.
- `_source.js`, `cli_prov_test.py`, `nllb_diag_test.py` default `LINGCOT_LOG_DIR` to a temp dir; `run_all.sh` exports it and fails if the names in `logs/` changed during the run.
- `hooks_executable_test.js` also checks every file git records as 100755 is executable in the checkout: editing `run_all.sh` on this mount dropped its bit and the suite would not start (the B-214 cause, again).

**Why.** A tester session log was lost: B-216 filled `logs/` with 20 test logs named in UTC, then B-217 pruned the session's own log, named in local time, at startup. Earlier session logs were lost the same way; they are not recoverable.

**Guard.** `log_setup_test.js` (8, executes `log_setup.py`): a local-clock session among 25 UTC-named logs keeps its own log and 20 remain, oldest by age removed (mutation: name sort fails 3). `run_all.sh`'s `logs/` check. `hooks_executable_test.js` +1 (mutation: `chmod -x run_all.sh` fails it).

**Verification.** `./dev/tests/run_all.sh` — 103 passed, 0 failed; `nllb_diag_test.py` passed; `logs/` unchanged (104 files) across both.

---

## D41 Reader Mode A: interlinear reading, word highlight, read-only word popup (2026-09-23)
**Version:** v3.14.427 · **Type:** feature · **Archives:** `dev/archive/changes/tb-reader-igt/` (v3.14.419)
**Touched:** source/modules/reader.js · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/reader_igt_test.js (new) · dev/tests/reader_cols_test.js · dev/tests/pseudo_locale_test.js · dev/PRACTICES.md
**Change:** `tb-reader-igt`

**What changed.**
- Reader toolbar: **Columns / Interlinear**. Interlinear draws each sentence as wrapping word columns (form, transliteration, parse, word gloss) with the first translation below. **Show:** switches each of the four tiers. Same batching and section entry as Columns.
- Word highlight, as decided: same spelling (`normForm`) by default; a word with a `dict_id` matches that `dict_id` only; **Highlight: Lemma** matches `lemma_id`, and a word without one falls back to the default. Punctuation is not highlighted.
- Word click opens a read-only popup: the rule that matched and the count in view, transliterations, parse, word gloss, POS, lemma, dictionary entry, morphemes, dependency relation and head, and **Open in annotation view**.
- `readerCacheKey()` carries mode, tiers and highlight rule into `render()`'s key.
- 15 keys; the view's help describes Interlinear.

**Guard.** `reader_igt_test.js` (21): the rule in all five cases (mutation: dict_id ahead of lemma fails it), tiers, cache key, popup read-only, wiring. `pseudo_locale_test.js` now also draws Interlinear and the word popup.

**Verification.** `./dev/tests/run_all.sh` — 102 passed, 0 failed. `gui_crud_test.js` 46 passed; `pseudo_locale_test.js` 6 passed. In Chromium on `samples/turkish-test`: 108 words, 33 with a `dict_id`, 56 with a `lemma_id`; hovering one "Tilki" highlights 8 (same entry) of 13 same-spelling tokens, 9 with Lemma.

---

## D41 Reader Mode B: the document as text against translation, read-only (2026-09-23)
**Version:** v3.14.426 · **Type:** feature · **Archives:** `dev/archive/changes/tb-reader-cols/` (v3.14.419)
**Touched:** source/modules/reader.js (new) · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/reader_cols_test.js (new) · dev/PRACTICES.md
**Change:** `tb-reader-cols`

**What changed.**
- View `reader` (`modules/reader.js`). The open document in reading order: section headings, then one row per paragraph, text left and first translation right. Sentences are `.s-span` with `data-sid`, so the existing pair highlight on hover works as is.
- Batches of 30 paragraphs, the rest loaded by a sentinel, as in the section view.
- Entry: **Read** on the document view (opens at the top) and on the section view (opens at that section; an empty section falls through to the next heading). Breadcrumb: Document › Reader.
- A sentence click, or Enter on it, opens a read-only popup: location, text, every transliteration and translation, comments, word count, and **Open in annotation view**. Esc, outside click, or any navigation closes it.
- `_readerMode` ('cols' now, 'igt' in tb-reader-igt) is in the render cache key.
- 12 keys, including the view's help. Three `Section ${n}` / 'Section' / 'Paragraph' literals in the section and breadcrumb code now read `label.view.section_n` / `bc.section`.

**Guard.** `reader_cols_test.js` (22): pairing, batching, every sentence reached, no editing control on the page or in the popup, wiring. `pseudo_locale_test.js` covers the new view.

**Verification.** `./dev/tests/run_all.sh` — 101 passed, 0 failed. `gui_crud_test.js` 46 passed; `pseudo_locale_test.js` 6 passed. Checked in Chromium on `samples/turkish-test`: hover pairing, popup open/Esc/link, section entry.

---

## Pseudo-locale check of every view, in the slow run (2026-09-23)
**Version:** v3.14.425 · **Type:** chore · **Archives:** `dev/archive/changes/pseudo-locale/` (v3.14.419)
**Touched:** dev/tests/pseudo_locale_test.js (new) · dev/tests/run_all.sh · dev/PRACTICES.md
**Change:** `pseudo-locale`

**What changed.** `pseudo_locale_test.js` builds a pseudo-locale in memory (every `en.json` text run prefixed `§`), switches the app to it in Chromium, and draws the 22 views, both header menus and the autosave dialog on `samples/turkish-test`. Visible text and title/placeholder/aria-label values without the mark fail, unless they are string values from the fixture or the bundled resources (whole words, case-insensitive; a "[...]" preview may end mid-value) or on its short exempt list. In `SLOW`: it needs Chromium.

**Why.** `i18n_literal_test.js` reads code patterns; the tb-strings run of this check found 23 strings it could not see.

**Guard.** Mutations: two strings put back as literals (a table header, a view title) fail it. Blind spot: a single word that is also a data value.

**Verification.** `./dev/tests/run_all.sh` — 100 passed, 0 failed. `pseudo_locale_test.js` 6 passed in Chromium, 8 s.

---

## Machine translation defaults to English, not the interface language (2026-09-23)
**Version:** v3.14.424 · **Type:** decision · **Archives:** `dev/archive/changes/xlate-target-en/` (v3.14.419)
**Touched:** source/LingCoT.html · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/xlate_settings_test.js
**Change:** `xlate-target-en`

**The decision.** With no `translation_language` on the document, `translationTarget()` returns English. The interface language is no longer a fallback. The CLI already resolved this way (`corpus_translation_language(...) or 'en'`). The field placeholder says "default: English".

**Alternatives considered, and why not.** Interface language first (B-072, v3.14.217): with a language picker, switching the UI to `haw` would change what machine translation writes into a corpus, and `haw.json` is an English placeholder. Setting `translation_language` on the sample corpora only: covers the samples, not a tester's own corpus.

**What this binds.** The translation target depends on corpus metadata only. `xlate_settings_test.js` asserts English for `tr` and `haw` locales with nothing declared (mutation: the old fallback fails 2 checks).

---

## Interface strings all in the locale file; B-215 Search view fixed (2026-09-23)
**Version:** v3.14.423 · **Type:** feature · **Archives:** `dev/archive/changes/tb-strings/` (v3.14.419)
**Touched:** source/LingCoT.html · source/LingCoT.pyw · source/modules/participants.js · source/modules/search.js · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/i18n_allow.json · dev/tests/i18n_literal_test.js · dev/tests/render_smoke_test.js · dev/tests/search_routing_test.js · dev/BUGS.md · dev/audits/AUDIT_INDEX.md
**Change:** `tb-strings`

**What changed.**
- Every pending finding of `I18N_AUDIT_2026-09-24.md` (S1–S7, R1, R3–R13, H1) now reads from the locale; `i18n_allow.json` has no pending entries. R6 split into `confirm.dict.replace` / `_1`. The host window title is the product name only.
- A pseudo-locale run (every value prefixed, every view rendered in Chromium, untagged visible text listed) found 23 more in 6 places: participant table headers and detail rows, the lexicon card labels, paragraph/sentence counts, the unknown-annotator fallback, and the help version line, which was painted before the strings loaded and showed its key. All moved; the version line is repainted by `applyLocale`.
- 46 keys added to `en.json` and `haw.json` (1,230). Existing `option.src_type.*` and `option.pub_restrict.*` keys are now used by `srcTypeLabel` / `srcRestrictLabel`.
- The morpheme-example cache is keyed on the locale as well as `_dataGen`.
- B-215: the dead Search-A branch removed from the cache key.
- Remaining English by design: product, licence and service names, host error details, field ids in the Progress panel.

**Guard.** `i18n_literal_test.js` now also flags Capitalized labels passed to helpers (14 hits on the pre-fix code, 0 false). `render_smoke_test.js` renders every view through `render()` (fails on the pre-fix file with the B-215 ReferenceError).

**Verification.** `./dev/tests/run_all.sh` — 100 passed, 0 failed. `gui_crud_test.js` 46 passed. Pseudo-locale run over all 22 views: only corpus data, names and field ids left untagged.

---

## Interface language picker, English fallback, haw.json placeholder; B-210 (2026-09-23)
**Version:** v3.14.422 · **Type:** feature · **Archives:** `dev/archive/changes/tb-i18n/` (v3.14.419)
**Touched:** source/LingCoT.html · source/LingCoT.pyw · source/LingCoT.css · source/resources/locale/en.json · source/resources/locale/haw.json (new) · dev/tests/locale_parity_test.js (new) · dev/tests/locale_key_test.js · dev/tests/translit_model_test.js · dev/tests/_gui.js · dev/tests/i18n_allow.json · dev/BUGS.md · dev/DEV_PLAN.md · dev/PRACTICES.md
**Change:** `tb-i18n`

**What changed.**
- `t()` and `tRes()` fall back to English (`_LOCALE_EN`, always loaded) before the raw key.
- `loadLocale` split: settings, then `applyLocale(lang)`, which reloads the strings, re-runs the `data-i18n*` sweeps, sets `<html lang>`, and repaints. An unreadable locale file falls back to English.
- Host `list_locales()`: every `resources/locale/<code>.json` whose `_meta.locale` is `<code>`.
- Picker: File menu, under the theme toggle. Saves `ui_locale` and applies without restart. The render cache key includes the locale.
- `haw.json`: copy of `en.json`, `_meta` `locale: "haw"`, `language: "ʻŌlelo Hawaiʻi"`.
- 4 keys: the picker label and aria text, and the legend's transliteration labels (R2 of the I18N audit).
- B-210: the legend asks `wordHasStoredTranslit()`, which reads `transliterations[]`.

**Guard.** `locale_parity_test.js` (16; mutations: English fallback removed, a key removed from `haw.json`). `translit_model_test.js` +4 for B-210. `locale_key_test.js` passes `_LOCALE_EN`.

**Verification.** `./dev/tests/run_all.sh` — 100 passed, 0 failed. `gui_crud_test.js` 46 passed.

---

## Settings and adopted tags move out of the app folder into the workspace (2026-09-23)
**Version:** v3.14.421 · **Type:** feature · **Archives:** `dev/archive/changes/tb-settings/` (v3.14.419)
**Touched:** source/LingCoT.pyw · source/workspace.py · source/LingCoT.html · source/resources/locale/settings.default.json (new) · .gitignore · dev/tests/user_settings_test.js (new) · dev/tests/workspace_test.js · dev/tests/tag_control_test.js · dev/tests/_gui.js · dev/PRACTICES.md
**Change:** `tb-settings`

**What changed.**
- Host: `write_file` removed; `read_user_file` / `write_user_file` read and write `workspace.USER_FILES` only (`settings.json`, `vocabulary/pos_tags.json`, `vocabulary/type_choices.json`). A missing file reads as null. Writes are atomic.
- `settings.json` is copied once from `source/resources/locale/` if only the old copy exists; that path is now in `.gitignore`. The repo default is `settings.default.json`.
- Page: `_settings` = defaults overlaid by the workspace file; `saveSettings()` writes it, and is a no-op until `loadLocale` has read it. Tags adopted in the tag drawer go to `vocabulary/`, merged over the shipped lists at load.
- Adopted tags already committed to the shipped lists stay there; nothing is migrated for vocabulary.

**Why.** Every theme toggle and every adopted tag changed a tracked file, and an update would overwrite a tester's choices.

**Guard.** `user_settings_test.js` (8; mutations: removing the pre-load guard, reversing the overlay order). `workspace_test.js` +8, executing the host methods with webview stubbed. `tag_control_test.js` +1.

**Verification.** `./dev/tests/run_all.sh` — 99 passed, 0 failed.

---

## Tester build prep: interface-text guard, B-213 hook fix, export language deferred (2026-09-23)
**Version:** v3.14.420 · **Type:** chore · **Archives:** `dev/archive/changes/tb-prep/` (v3.14.419)
**Touched:** hooks/prepare-commit-msg · dev/tests/change_files_test.js · dev/DEV_PLAN.md · dev/BUGS.md · dev/PRACTICES.md · dev/tests/i18n_literal_test.js (new) · dev/tests/i18n_allow.json (new) · dev/tests/vendor/ (new)
**Change:** `tb-prep`

**What changed.**
- `i18n_literal_test.js`: the I18N audit's scanner as a guard. Every user-visible literal outside `en.json` must be in `i18n_allow.json`, as `exempt` (11: names, licences, host error details) or `pending` under its audit id (51). New literals fail; stale entries fail.
- acorn 8.18.0 and acorn-walk 8.3.5 vendored in `dev/tests/vendor/` (MIT, 262 KB, guards only). parse5 not taken; the static shell uses a small tokenizer.
- The guard found S7: `modal.autosave.hint` holds `<strong>` under `data-i18n`, which sets `textContent`. Added to step 3.
- B-213: `prepare-commit-msg` skipped any subject naming a version; only a leading stamp counts now.
- B-214: the B-213 edit left the hook non-executable, so the first `tb-prep` commit carried no label. Mode restored; amended into that commit.
- DEV_PLAN §3: export language stays English, deferred with a trigger.

**Guard.** `i18n_literal_test.js` (3 checks; mutations: a changed literal and a localized one each fail it). `change_files_test.js` +2 for B-213, +4 for B-214 (each hook executable on disk and in the index).

**Verification.** `./dev/tests/run_all.sh` — 98 passed, 0 failed.

---

## Tester's build planned as v3.15.0; interface text audited before translation (2026-09-23)
**Version:** v3.14.419 · **Type:** decision · **Archives:** `dev/archive/changes/tester_build_plan/` (v3.14.418)
**Touched:** dev/DEV_PLAN.md · dev/audits/I18N_AUDIT_2026-09-24.md (new) · dev/audits/AUDIT_INDEX.md

**The decision.** Gate 2 gains D41 (both modes, read-only popup) and an
interface language picker with `haw.json` as a placeholder copy of `en.json`.
Six steps on branch `tester-build`, released as v3.15.0 (DEV_PLAN gate 2).
Reader Mode A highlights by spelling, narrowed to `dict_id` when the word has
one, with a switch to `lemma_id`. Windows moves to gate 4.

**The audit.** `dev/audits/I18N_AUDIT_2026-09-24.md`: every user-visible string
checked against `en.json`. 6 static-shell findings, 31 rendered strings in 13
places, 1 host string. Resource descriptions (257 keys) and fonts (ʻokina,
kahakō) are covered.

**Alternatives considered, and why not.** Translating before the strings move
would hand the translator an incomplete file. Keeping `settings.json` in the
repo would put every tester's theme and locale into `git status`.

**What this binds.** Step order: settings, i18n, strings, then the two reader
modes. `--minor` is added to `new_version.py` in the last step.

---

## DEV_PLAN §1 checked against BUGS and the audit: four closed items removed (2026-09-24)
**Version:** v3.14.418 · **Type:** chore · **Archives:** `dev/archive/changes/devplan_stale_items/` (v3.14.417)
**Touched:** dev/DEV_PLAN.md · dev/tests/doc_integrity_test.js

**What changed.** `DEV_PLAN.md` §1 "What to do next": C1 (**B-157 · L-027**)
and D2 (**B-161**) removed, both already closed; cluster C removed with C1.
The cosmetic tail and gate 4's bug row dropped **B-109** and **B-094**, also
closed, and gained **B-210**, open since v3.14.413 and listed nowhere. A note
under the counts records the check.

**Why.** Asked to check and fix C1 and D2. Neither needed code: B-157 shipped
at v3.14.365 (`corpus_annotate.py --translate` stamps each translation with
`derived_prov`; `cli_prov_test.py`, 36 checks) and B-161 at v3.14.370 (the
exact-match lemma strip offers *New anyway*; `linking_s1s3_test`, 132 checks,
and `lemma_proposal_test`, 42). Both guards were run and pass. The rows had
outlived the fixes by 48 and 43 versions.

**Guard.** `doc_integrity_test.js` §11a: every bug id in §1's clusters and gate
4's bug row must be open in BUGS.md; struck rows and italic notes are skipped as
history. Run against the pre-edit DEV_PLAN it names exactly the four.

**Verification.** `./dev/tests/run_all.sh` — **97 passed, 0 failed, 0 disabled.**

---

## D40 closed: moved to the completed index, L-034 closed (2026-09-24)
**Version:** v3.14.417 · **Type:** chore · **Archives:** `dev/archive/changes/d40_closed/` (v3.14.416)
**Touched:** dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md · dev/design/D40_repeat_reuse.md

**What changed.** D40 leaves `DEV_PLAN.md` §2 (row and section) for one row
in §5, and leaves gate 4's feature list. `UNIFIED_AUDIT.md`: L-034 off the
board and into the §5.1 ledger at v3.14.416; counts 37 → 38 closed, 9 → 8 open,
board 12 → 11 rows; its body goes at the next comb. `DEV_PLAN.md` §1's summary
line corrected to 7 open bugs (B-210 was opened at v3.14.413) and 8 findings.
The D40 plan records that it shipped.

**Why.** D40 stage C shipped at v3.14.416, the last of four.

**Guard.** `doc_integrity_test.js`: the orphan check caught
`D40_reuse_earlier_work.md` unnamed once the §2 row went, so the §5 row names
both design files.

**Verification.** `./dev/tests/run_all.sh` — **97 passed, 0 failed, 0 disabled.**

---

## D40 stage C: copy a sentence's annotation to one with the same text (2026-09-23)
**Version:** v3.14.416 · **Type:** feature · **Archives:** `dev/archive/changes/d40c-sent-copy/` (v3.14.415)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · dev/tests/sentence_copy_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/tests/render_cache_test.js
**Change:** `d40c-sent-copy`

**What changed.** On the sentence view, a banner above the interlinear gloss
when a sentence with the same folded text (stage A) would fill something empty
here, and, on an annotated sentence, when it would fill its repeats. *Review
copy* opens a panel: source and target, one row per word with translit, parse,
gloss, POS and lemma, each shown as to write, already present, or conflict
(both values; never written), a checkbox per row, tabs when matching sentences
are annotated differently, one block per repeat in the outgoing direction.
Copy writes the ticked rows' empty fields, morphemes with their links, and the
dependency head remapped through the alignment, in one `mutate`, stamped
`_copyFieldProv(<source sentence>)`. *Undo copy* restores an in-memory
snapshot for the session. Comments are not copied. The panel leads with what will be
written (accent), marks matches with a tick and conflicts as `kept ≠ source`,
and hides rows that already match behind a toggle; a first layout, tried in
the app, was 380 px wide (the shared modal rule came later in the file) and
gave every cell the same weight.

**Why.** p1 s3 repeats p1 s2 and was annotated from nothing. D40 decisions 1
to 3 and 8; the panel follows the mockup agreed 2026-09-23.

**Guard.** `sentence_copy_test.js`, 58 checks, runs the real plan, apply and
undo: the cell states, the head remap (with target ids that differ from the
source's), ticked and unticked rows, the stamps, a re-plan finding only what
was left, and an undo restoring the target byte for byte. Five mutations, five
failures. The first draft of the remap check could not fail, since source and
target shared their id suffixes. `render_cache_test` lists `_copyPanel` as
repainted outside `render()`; `autolink_test` held `dict_id` to `linkTo`.

**Verification.** `./dev/tests/run_all.sh` — **97 passed, 0 failed, 0 disabled.** Tried in the app 2026-09-23; the panel was reworked after it.

---

## D40 stage D: the word editor offers the same word's analyses from elsewhere in the corpus; B-211, B-212 (2026-09-23)
**Version:** v3.14.415 · **Type:** feature · **Archives:** `dev/archive/changes/d40d-word-chips/` (v3.14.412)
**Touched:** source/LingCoT.html · source/modules/events.js · source/resources/locale/en.json · dev/tests/word_chip_test.js (new) · dev/tests/suggest_mechanism_test.js · dev/tests/word_edit_pos_test.js · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/new_version.py · dev/tests/doc_integrity_test.js · dev/tests/change_files_test.js · dev/BUGS.md · dev/tests/log_triage.js
**Change:** `d40d-word-chips`

**What changed.** The word editor gets a strip under the title: one chip per
distinct analysis of the same folded form elsewhere in the corpus
(transliterations, POS, gloss, parse, morpheme rows, lemma), commonest first,
labelled *same word, P1 S2*, shown while it would fill something empty. A click
fills only empty fields; morpheme rows by position; the lemma by the source's
lemma id, so a homograph is not asked again. Under each filled field that other
tokens answer differently, a *differs* note lists their values; a click
replaces. Taken values carry `offerSrc` `corpus:<word id>`, which `_offerMoment`
stamps as `_copyFieldProv` at the three stamp sites (the lemma's now reads its
mark, as D61 intended). Typing clears the mark.

**Found testing it, fixed here.** B-211: a homograph lemma pick was stored but
the strip kept asking; `lemmaStripHtml` now takes the chosen id. B-212: the word
view did not draw the word's transliterations. The take also repaints the
morphology strip, which it had left stale. `--release` writes the version into
BUGS.md rows fixed in `pending:<slug>`.

**Why.** The 2026-09-22 session annotated `Hasan`, `dar` and `geçmek` twice each
by hand; the POS strip offered only what the dictionary held. D40 decisions 2,
7 and 8.

**Guard.** `word_chip_test.js`, 39 checks, against a stand-in for the editor's
fields: what is offered and in what order, what a take fills and leaves alone,
the differs notes, the stamp, B-211 and B-212. Eight mutations, eight failures;
one first escaped because the field stayed empty while marked. Two static
guards follow the stamp sites to `_offerMoment`. `change_files_test` checks the
`pending:` replacement; `doc_integrity_test` refuses a `pending:` slug with no
open change and now holds change files to the 400-word cap. `log_triage`
acknowledges the three stale-strip warnings.

**Verification.** `./dev/tests/run_all.sh` — **96 passed, 0 failed, 0 disabled.** Stage D tried in the app 2026-09-23; the fixes not yet.

---

## D40 stage B: translation and transliteration offered from a sentence with the same text (2026-09-23)
**Version:** v3.14.414 · **Type:** feature · **Archives:** `dev/archive/changes/d40b-prefill/` (v3.14.412)
**Touched:** source/LingCoT.html · source/modules/participants.js · source/modules/events.js · source/resources/locale/en.json · dev/tests/sentence_prefill_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md · dev/DEV_PLAN.md
**Change:** `d40b-prefill`

**What changed.** The sentence edit and add forms show an offer strip under
the translation and transliteration editors (`offerStripHtml`, as for POS and
lemma): one chip per value in use on sentences with the same folded text
(stage A), commonest first, labelled *same text, P1 S2*. Translation chips
appear while the form has no translation; transliteration chips for labels it
does not have. A click fills an empty row or adds one (`takeOffer`, act
`copy-row`); the add form's strip follows the typed text. Saved unchanged, the
value is stamped `_copyFieldProv(<sentence id>)`: derived, with a new optional
`from` key that `_provKeyOf` includes and `provDisplayName` shows as *copied
from P1 S2*. Edited, it is the annotator's. The rows' copy marks are stripped by
`takeCopyMarks` before `applyForm`, so none reaches the file.

**Why.** The 2026-09-22 session typed the same translation twice for p1 s2/s3.
D40 decisions 2, 6 and 7. A first build pre-filled the field; tried in the app,
that was easy to miss and unlike the other offers, so it was replaced before
release.

**Guard.** `sentence_prefill_test.js`, 41 checks, runs the save path from
`readForm`'s output through `takeCopyMarks`, `applyForm` with the field table,
`assignList` and `stampCopies`: what is offered and in what order, that the
form draws the sentence as stored, the three outcomes of Save, and a moment
without `from` keying exactly as before. Ten mutations across both builds, ten
failures; the ranking one first escaped because the fixture's commonest value
was also its first.

**Verification.** `./dev/tests/run_all.sh` — **95 passed, 0 failed, 0 disabled.**

---

## D40 stage A: find the sentences with the same text (2026-09-23)
**Version:** v3.14.413 · **Type:** feature · **Archives:** `dev/archive/changes/d40a-index/` (v3.14.412)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/tests/sent_key_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md
**Change:** `d40a-index`

**What changed.** `sentKey(text)` folds a sentence to its runs of letters,
digits and combining marks, each through `normForm`. `sentTextIndex()` maps
that key to sentence ids across every document, and `sameTextSentences()`
reads it, from a stored sentence or a bare text. Built lazily on `_dataGen` and
a new `_foldGen`, which `refreshFoldContext` bumps; each sentence's key is
memoised against its text. Nothing is stored and nothing on screen changes yet.
B-210 filed.

**Why.** Stages B and C look up sentences by this key. The plan had the index
maintained by five save paths; a lazy cache has one writer and cannot drift.
D40 plan §3 A updated.

**Guard.** `sent_key_test.js`, 23 checks: what folds (case, punctuation,
spacing between tokens, Turkish i/ı) and what does not (a space inside a
token); a sentence never matches itself; B-057's two identical sentences are
two entries; the cache rebuilds on `_dataGen` and on `_foldGen` and not
otherwise. Four mutations, four failures. The fold-change one first escaped: a
lookup from one side passed against a stale index by coincidence, so the check
asks from both sides.

**Verification.** `./dev/tests/run_all.sh` — **94 passed, 0 failed, 0 disabled.**

---

## Branch work gets change files; version numbers are assigned at release (2026-09-23)
**Version:** v3.14.412 · **Type:** chore · **Archives:** `dev/archive/changes/versioning_change_files/` (v3.14.411)
**Touched:** dev/new_version.py · hooks/prepare-commit-msg · dev/tests/doc_integrity_test.js · dev/tests/change_files_test.js (new) · dev/changes/README.md (new) · dev/PRACTICES.md · dev/README.md

**What changed.** On any branch other than `main`, `new_version.py` writes the
entry to `dev/changes/<slug>.md` with `**Version:** pending`, archives under the
slug, and labels the build `<base>+<slug>` in `source/version.py`.
`--release` numbers the open change files in the order they were started,
prepends them to `edit_log.md`, stamps the docs once and moves each file into
its archive folder. `--relabel` resets the label after merging `main` in;
`--main` forces a number on a branch. The commit hook prefixes `[<slug>]` while
the build is labelled. On `main` nothing changes.

**Why.** Every version rewrote the stamp line in 12 files and the top of
`edit_log.md`, so two branches minting versions conflicted on the same lines
whatever numbers they used. Numbers are now assigned only on `main`.
`PRACTICES.md` §1 Branches.

**Guard.** `change_files_test.js`, 22 checks, runs the script and the hook in a
throwaway repository. Three mutations (hook label, release order, build label)
each fail it; the release-order one first escaped because the header stamp
matched the version string. `doc_integrity_test.js`: open change files checked
like entries (§8a); §8b credits a released change with its `[<slug>]` commits
and matches whole version strings only; the version.py check accepts a label
that names an open change file.

**Verification.** `./dev/tests/run_all.sh` — **93 passed, 0 failed, 0 disabled.**

---

## D40 planned: reuse of repeated sentences and word forms (2026-09-22)
**Version:** v3.14.411 · **Type:** decision · **Archives:** `dev/archive/changes/d40_repeat_reuse_plan/` (v3.14.410)
**Touched:** dev/design/D40_repeat_reuse.md (new) · dev/DEV_PLAN.md · dev/PRACTICES.md

**The decision.** D40 is built in four stages: a runtime sentence-text index
(A), translation pre-fill in the sentence forms (B), a sentence copy offer with
a review panel (C), and word chips in the word editor (D). Copy, not link;
offer, never apply; sentences match on folded text. Transliterations, word and
sentence, are offered only from an identical form or sentence, never by rule. A
filled word field that differs from other occurrences gets a `differs` note in
the word editor; the sentence copy panel stays fill-only.

**Why.** Session of 2026-09-22 on `turkish_folk_songs_corpus`: p1 s3 repeats
p1 s2 and started empty; three forms in p1 s1 were annotated twice by hand.
The dictionary fill offer never reaches tokens without morphemes.

**Alternatives considered, and why not.** A `repeat_of` link: new schema field,
and search, export, LaTeX and re-tokenizing would all need to follow it. A
post-save propagation toast and a bulk word-fill panel: both write values the
annotator has not seen in context. Encoding the source in the `annotator` name:
compatible, but it is the name-sniffing B-137 removed.

**What this binds.** No stored change beyond an optional `from` key on derived
prov moments; existing corpora open and save unchanged. Plan §5.

**Branching.** D40 is the first feature built on a branch. `PRACTICES.md` §1
gains the rules: one branch mints versions at a time, one commit per version,
fast-forward merges at stage boundaries, no squash.

---

## L-046 closed: one read-only list presentation, declared (2026-09-04)
**Version:** v3.14.410 · **Type:** feature · **Archives:** `dev/archive/changes/d62c_read_only_list_presentation/` (v3.14.409)
**Touched:** source/modules/participants.js · source/LingCoT.css · dev/tests/row_editor_test.js · dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md

**What changed.** `LIST_VIEWS` declares three properties per collection —
`primary` (prose or segment), `secondary` (attribution, qualifier or scheme),
`emphasis` (none or meta-language) — and **does not declare `layout`**, which it
reads off `ROW_EDITORS`. One builder, `listViewHtml`, replaces the four
`render*View` bodies; each is now a one-liner, as the editor pairs became at
v3.14.404. The stylesheet loses eleven rules and gains one component: `.lv-row`
with two layout variants, `.lv-primary`, `.lv-secondary`, and one modifier each
for the two values that need one. Four font sizes become two. Transliteration
text is monospace.

**Why.** L-046 measured four presentations of one data shape: sizes 0.85, 0.87,
0.88 and 0.9 rem, three separator conventions, two placements for the secondary
part. None of those differences was chosen against the other three. The
divergence that survives is the one with a reason behind it — a scheme name
leads its value because it repeats down the column and reads as a header; a
translation is italic and quoted because it is not in the object language; a
segment string is monospace because a length mark, a schwa, or a combining
diacritic against a precomposed one is the information, and a proportional face
is free to make those pairs look alike. That last argument was already accepted
for the allomorph form and is now applied to transliterations, which is the one
visible change.

**The per-collection row classes are gone, not kept.** `.comment-view-row` and
its three siblings were queried by nothing outside the function that emitted
them. Keeping them once the layout is declared would leave four names with no
rule, which is L-046's own complaint one level down. `.comments-view .lv-row`
targets one if it ever needs its own.

**Guard.** `row_editor_test.js` grows from 45 to 89 checks; §6 executes
`listViewHtml` against sample rows rather than reading the descriptor. Three
things are asserted separately because they fail for different reasons: that
each view **declares** all three properties with known values; that the
assignment **is the one D62 §4.2 decided**, which is the check that stops the
section being self-consistent and empty; and that each declared value **reaches
the stylesheet** or is one of the three documented bases. Plus: no view restates
`layout`; a scheme leads and a qualifier follows, asserted by position; two font
sizes across the whole component, which is the finding stated as a property.
Mutation-tested seven ways: 1, 1, 1, 1, 1, 2, 4.

**Verification.** `./dev/tests/run_all.sh` — 92 passed, 0 failed, 0 disabled.
`gui_crud_test.js` in a real browser — 46 passed, 0 failed.

---

## The word editor asks in the decided order (2026-09-04)
**Version:** v3.14.409 · **Type:** feature · **Archives:** `dev/archive/changes/d46_word_editor_order/` (v3.14.408)
**Touched:** source/LingCoT.html · dev/tests/field_order_test.js (new) · QUICKSTART.md · dev/design/D46_pipeline_ux.md · dev/PRACTICES.md · dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md

**What changed.** `renderWordEdit` asks transliteration, POS, word gloss, parse,
morpheme rows, lemma, comments, save-to-dictionary. Two moves: POS rises above
the gloss, the lemma drops below the morpheme rows. The IGT legend swatch and
the dependency table's column header move onto `label.editor.word_gloss`;
`label.editor.gloss` stays the morpheme-level and entry-level label at the other
eight sites. QUICKSTART §4 lists the fields in the order a tester now meets
them, and names the lemma, which it had not.

**Why.** D46 measured the editor asking three fields before the field that
determines them, and this takes the part of that which holds. The lemma really
cannot be answered early: it is read off the stem and the stem comes out of the
parse. The word gloss is the deliberate exception and goes third, above the
parse — asked after it, the field arrives pre-filled with `wordGloss`'s join and
the annotator edits the app's answer instead of giving one, which is B-187 and
B-191 and the two before them. POS goes first of the three because it is a
closed vocabulary answered in a click and it seeds `morphPosDefault` for the
rows the parse is about to build. The reasoning is in the D46 appendix and at
the point of use.

**Guard.** `field_order_test.js`, new, 11 checks. It is D46's pass 1 — "the DOM
order is scriptable, so pass 1 can be executed rather than eyeballed" — written
as a guard. Two kinds of assertion, kept apart on purpose: the **sequence**,
which is a decision and can be re-decided, and the **dependencies**, which are
facts about the code and are asserted by checking the mechanisms exist
(`ensureMorphemesFromParse`, `_resolveOrCreateLemma`). Conflating them would
report a re-decision as a broken dependency. It also asserts the morpheme row
still says Gloss, which is what a blanket rename would break while passing every
other check. Mutation-tested five ways: 1, 1, 1, 2, 2.

**Verification.** `./dev/tests/run_all.sh` — 92 passed, 0 failed, 0 disabled.
`gui_crud_test.js` in a real browser — 46 passed, 0 failed; the word editor is
what most of its scenarios drive, so the reorder is exercised rather than
inspected. Guard count in PRACTICES §6: 93 → 94.

---

## D62 and the word-editor order: four decisions taken on the open findings (2026-09-03)
**Version:** v3.14.408 · **Type:** decision · **Archives:** `dev/archive/changes/d62_list_element_identity/` (v3.14.407)
**Touched:** dev/design/D62_list_field_presentation.md (new) · dev/design/D46_pipeline_ux.md · dev/DEV_PLAN.md · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md

**The decision.** Four, on what L-043 to L-046 and D46 left open.

**A · a list element records who added it and when.** `variants`,
`constituent_forms`, `source_ids`, `allomorphs` and `pinned_examples` become
object elements carrying an annotator id and a date, and move off the `list`
control onto a row editor. Measured across both shipped corpora: **2 non-empty
instances**. First item in gate 3, because a format change is free exactly once
and testers are the next milestone.

**B · dispatch-on-shape waits.** Declaring presentation across 83 field entries
prevents a sixth treatment, and no sixth field is queued. The trigger is the
first version that adds an array-shaped field; D62 §4 is the vocabulary it
should use.

**C · one read-only list presentation.** Four properties — `layout`, `primary`,
`secondary`, `emphasis` — and the four views fall out of them. Four sizes become
two. One substantive change: transliteration text goes monospace, for the reason
the allomorph form already is.

**D · the word editor asks in a decided order**: transliteration, POS, word
gloss, parse, morpheme rows, lemma. Appended to D46, which is frozen.

**Alternatives considered, and why not.** Kept in the records rather than here.
The two worth naming: **B-139 decided the opposite of A at v3.14.372** and its
reasoning is still correct for the control it was decided against, so A changes
the control first and the stamp second; a stamp on a CSV box would be the thing
B-139 refused. And **D contradicts L-013's measurement in one place** — the
session answered the word gloss last, and the decision asks it third. L-013
measured when the annotator *could* answer a field that was already pre-filled
with the app's derivation (B-187, B-191, four attempts). Asked before the parse
the field can only hold their own gloss, which is what it exists to hold.

**What this binds.** Gate 3 opens with A. L-044 is absorbed into A and stops
being a separate task. L-043 is deferred with a named trigger rather than left
open indefinitely. L-046's typography half becomes a build. D46's audit still
runs, now against the decided order, and QUICKSTART already asks its question.

**Bookkeeping caught in the same pass.** DEV_PLAN §1's cluster F, "real but not
now", was carrying four items that are not: **B-027** fixed 35 versions ago,
**B-139** and **L-013** superseded here, **⑪** settled at v3.14.392 and moved to
the audit's §5.2 at v3.14.397. Its count line said 11 open findings against a
board of 9 plus 1 half. Both corrected; the section's own note already says to
take counts from the tables, which is the second time that note has earned
itself.

**Verification.** Docs only, no behaviour change. `doc_integrity_test.js` — 74
passed. `./dev/tests/run_all.sh` — 91 passed, 0 failed, 0 disabled. B-139's row
was recompressed to 509 characters in the same edit; the append pushed it past
the 600 the Fixed table guards.

---

## L-045 closed: one row component, two layout variants, declared (2026-09-03)
**Version:** v3.14.407 · **Type:** feature · **Archives:** `dev/archive/changes/l045_l046_row_presentation_declared/` (v3.14.406)
**Touched:** source/modules/participants.js · source/LingCoT.css · dev/tests/row_editor_test.js · dev/tests/gui_crud_test.js · dev/audits/UNIFIED_AUDIT.md · dev/DEV_PLAN.md

**What changed.** Every `ROW_EDITORS` descriptor now declares
`layout: 'inline' | 'stacked'`, and the row builders emit
`class="<rowClass> row-ed row-ed--<layout>"`. Remove buttons are `row-x`, add
buttons are `row-add`, in all five collections. In the stylesheet the five
per-collection layout rules and the six button rules collapse into one
component: `.row-ed` plus two variants, one remove control, one add control.
The per-collection classes stay because the readers query them; they now carry
only what is genuinely per-collection (`position: relative` on the two boxed
ones), and the three that were left empty are deleted. The four `*-view`
containers get one shared rule.

**Why.** L-045 measured two visual families across five rules, two of them
achieved by wearing another collection's class: `.allomorph-remove` and
`.sel-remove` had no rule and were written as `translit-remove`. That is a name
that lies, and it made the CSS unreadable in the direction a reader actually
asks (what does an allomorph row look like). I2 unified the behaviour and left
markup and CSS alone on purpose; this is the other half. The layout axis is the
real distinction, so it is what the descriptor declares.

**Guard.** `row_editor_test.js` grows from 24 to 45 checks: every descriptor
declares a known layout, every builder emits the variant class its descriptor
names, no builder emits a borrowed class, and each `.row-ed*`, `.row-x`,
`.row-add` and `*-view` selector is declared exactly **once**. Counting rather
than testing presence is the check that earned itself: `.allomorphs-view` was
declared twice, 1000 lines apart, and the later one won, so the override written
here was dead the moment it was typed. `hasRule` matches an anchored selector
after stripping comments, because an unanchored match is what made L-045's and
L-046's first tables wrong; both are re-measured in this version. Mutation-tested
six ways: 1, 1, 1, 1, 1, 1. `gui_crud_test.js` B3 clicked `.translit-remove` on an allomorph
row and had to be retargeted to `[data-action="translit-remove"]`, which is the
same rename showing up in a test that hung on the borrowed name.

**Verification.** `./dev/tests/run_all.sh` — 91 passed, 0 failed, 0 disabled.
`gui_crud_test.js` in a real browser — 46 passed, 0 failed.

---

## L-045 re-measured, the first table was wrong (2026-09-03)
**Version:** v3.14.406 · **Type:** chore · **Archives:** `dev/archive/changes/l045_row_css_remeasured/` (v3.14.405)
**Touched:** dev/audits/UNIFIED_AUDIT.md

**What changed.** L-045's CSS table in §2.7, one version after it was written.

**Why.** The selector match used to build it was not anchored:
`re.escape(sel) + r'\s*[,{][^{]*\{'` matches a descendant selector as well as an
exact one, so `.translit-row` picked up the declaration belonging to
`.translit-row .translit-label` and the table reported
`width: 150px; flex-shrink: 0` as the row's rule. That is the label's width.

**What is actually there**, anchored so the selector must be the whole selector or
one member of a comma list:

| rule | declaration |
|---|---|
| `.translit-row`, `.allomorph-row`, `.sel-row` | `display: flex; align-items: center; gap: 6-8px` |
| `.comment-row`, `.translation-row` | `display: flex; flex-direction: column` plus border, radius, padding, background |

Two families rather than five variations: three collections lay their fields out
in a line with no container, two stack a textarea over a meta line inside a
bordered card. No `*-rows` container has a rule of its own.

**The corrected reading is the stronger finding**, which is why it is worth the
version: two families differing by layout axis is a clearer statement of the
divergence than five unrelated rules, and it is the shape any convergence has to
reconcile.

**The rest of §2.7 stands.** The button families with no rule, the three view
wrappers with zero rules, the four view typographies and the L-043 control table
were all read from counts rather than from that regex, and re-checking them
against the anchored matcher changed nothing.

**Verification.** `doc_integrity` 74/0, `./dev/tests/run_all.sh` 91/0/0.

---

## GUI control inventory, UNIFIED §2.7 (2026-09-03)
**Version:** v3.14.405 · **Type:** chore · **Archives:** `dev/archive/changes/gui_control_inventory/` (v3.14.404)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/DEV_PLAN.md
**Examined:** field_spec.js's 83 field declarations; renderField's 11 control branches; every input, textarea and select emitted across LingCoT.html, participants.js, events.js and search.js; LingCoT.css's 1,030 rules for the row, button and view class families

**What changed.** UNIFIED gains §2.7, four findings (**L-043** to **L-046**), and
DEV_PLAN gains cluster **H**. Counts recomputed from the tables: 46 findings, 35
closed, 11 open.

**What was measured.** 83 declared fields, 15 control values, 21 fields declaring
none, 11 branches in `renderField`, 62 inputs (49 `type="text"`), 13 textareas, 6
selects.

**L-043.** 21 fields store a list. They use six controls plus three declaring
none. `comments` (6 fields) and `translations` (2) produce the same editor from
two code paths; `translits` (5) stores the same shape and produces a different
one, with no source and no date. `sources` (2) is a chip picker with no rows.

**L-044.** `renderField`'s `list` branch emits one text input, joined with
`', '` at `LingCoT.html:10299` and split on `,` at `:10533`. A value containing a
comma cannot be entered, and there is no per-element identity, so no per-element
provenance. Same fact as **B-139** from the UI side. `variants` and
`constituent_forms` are the only list fields with no add or remove control, so
I2's descriptor does not reach them.

**L-045.** `.translit-row` is `width: 150px; flex-shrink: 0`; `.comment-row` and
`.translation-row` are `width: 100%; box-sizing: border-box`; `.allomorph-row` is
`flex: 1`; `.sel-row` sets a height. `.allomorph-remove`, `.sel-remove` and
`.allomorph-add-btn` have no rule in the stylesheet, which is why those buttons
carry `.translit-remove` and `.translit-add-btn`. INPUT_UX §3.1 recorded the
markup side; the CSS side is the reason.

**L-046.** `.comments-view`, `.transliterations-view` and `.translations-view`
are emitted and have zero CSS rules. Row typography for one data shape has four
treatments: two plain, one small-bold-muted, one monospace.
`selector_audit_test` checks selectors nothing emits, not classes nothing styles,
so it cannot see either.

**Guard.** None added. This is an inventory; the findings are open work.

**Verification.** Every figure computed by script against the current tree.
`doc_integrity` 74/0, `./dev/tests/run_all.sh` 91/0/0.

---

## I2 — one row-editor descriptor (2026-09-03)
**Version:** v3.14.404 · **Type:** feature · **Archives:** `dev/archive/changes/i2_one_row_editor_descriptor/` (v3.14.403)
**Touched:** source/modules/participants.js · source/modules/events.js · dev/tests/row_editor_test.js (new) · dev/tests/translit_model_test.js · dev/tests/selector_audit_test.js · dev/tests/ui_wiring_test.js · dev/PRACTICES.md · dev/DEV_PLAN.md · dev/audits/AUDIT_INDEX.md

**What changed.** `ROW_EDITORS` in `participants.js` holds what differs between
the five repeated-row collections. **Ten handler blocks in `events.js` became
one**; four `render*Editor`/`read*Editor` pairs became one line each.

**`sel` is in the descriptor, not excluded.** Its two differences are real, and
declarable: rows found through the enclosing frame (`rows`) and never left empty
(`minOne`). Excluding it was the easy move and the wrong one — a descriptor that
cannot say those two things is not describing the app.

**The `data-action` names are unchanged, deliberately.** They are what
`gui_crud_test` clicks and what the stylesheet hangs on; renaming would have made
a consolidation into a migration. The handler reads the kind off the action.

**Three guards failed, and none of them was a regression.** All three asserted
against *source text*, and I2 moved the text:
`translit_model_test` looked for the literal `filter(t => t.label || t.text)`;
`selector_audit_test` could not see `class="${editorClass}"`; `ui_wiring_test`
could not see a handler that matches by computation. **This is L-006 happening to
the guards** — a source-text assertion breaks on consolidation and reports a
defect that does not exist. `translit_model_test` now **executes** the predicate
(B-142: an emptied row is dropped). The other two were taught the descriptor's
shape and remain text scanners, which L-006 still counts.

**Not included, and the audit is why:** `sel-frame` (frames carry collapse state,
a derived summary and templates), and the morpheme and section editors in
`LingCoT.html`, which carry parse and ingest logic. §3.1 scoped I2 to five.

**Guard.** `row_editor_test.js` **executes** the descriptor rather than checking
it exists — a constant nothing reads would satisfy the latter. 27 checks: every
collection declares the three things the handlers differed in, `keep` is run for
each collection's real emptiness rule, `sel`'s two exceptions are asserted by
behaviour, and no per-collection block survives in `events.js`. **92 → 93.**

**Verification.** `run_all.sh` 91/0/0. **`gui_crud_test.js` 46/0 in a real
browser**, which is what proves rows still add, remove and read. Mutation-tested
4/4: `sel` dropped from the descriptor (2 named failures), `minOne` dropped,
`keep` loosened so B-142 regresses, and a bespoke handler returned to
`events.js`. Both files restored byte-identical.

---

## Gate 3's rows, checked against the code (2026-09-03)
**Version:** v3.14.403 · **Type:** chore · **Archives:** `dev/archive/changes/gate3_rows_checked_against_code/` (v3.14.402)
**Touched:** dev/DEV_PLAN.md · dev/audits/AUDIT_INDEX.md
**Examined:** B-027's mechanism in `LingCoT.html` and `en.json`; every `data-action="*-add|remove"` pair in the source; `dev/design/D48_field_table.md` end to end

**What changed.** Three of Gate 3's five open rows. Asked for by name — *check
B-027 and I2* — and the third fell out of reading D48 to settle the second.

**B-027 was closed 29 versions ago and this row described the state before it.**
✅ v3.14.373. The decision the row said was outstanding — *refuse, warn or
accept* — **was taken**: an unknown tag is stored, reported at the save from
`stampFieldProv` via `unknownTag()`, and adoptable from the tag drawer, which
writes the project vocabulary file. Verified by reading the mechanism and its
locale strings, not the row. **Refusing was ruled out by evidence**: `CLF` was
the right tag and the shipped list lacked it, so refusal would have blocked
correct annotation.

**I2 is open and has grown.** No `rowEditor` descriptor exists anywhere. The
audit counted **five** repeated-row editors at v3.14.158; there are now **six**
add/remove families — `translit`, `translation`, `allomorph`, `comment`, `sel`,
`sel-frame` — **plus morpheme and section rows** on their own verbs. *Not acting
on a unification item makes it bigger*, which is the argument D39 inherits, since
D39 needs I2 first.

**"D48 stages C and D" was wrong twice.** Stage C **shipped** v3.14.196–210, and
**there is no stage D** — D48 names only A to C. What actually remains is the one
thing its last section states: **the word editor was never converted to a
generated form**, which D48 says "stays available" and whose argument is now the
marking and the field order — D46's target order, not drift. The row now says
that.

**Guard.** None. The audit's own figure is left as written and the drift recorded
in `AUDIT_INDEX.md`, per the frozen-document rule.

**Verification.** `doc_integrity` 74/0, `./dev/tests/run_all.sh` — 90 passed, 0
failed, 0 disabled.

---

## Cluster E re-measured — one item was already closed (2026-09-03)
**Version:** v3.14.402 · **Type:** chore · **Archives:** `dev/archive/changes/cluster_e_re_measured/` (v3.14.401)
**Touched:** dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md
**Examined:** cluster E's three items, executed: the suite against `samples/` and against the live corpora staged per PRACTICES §10; and every `check()` site in `dev/tests/*_test.js` counted for source-text assertions

**What changed.** Cluster E's row for E2 struck through with the measurement that
closes it, and L-006's body in UNIFIED gains what was re-measured. No code.

**What was examined.** DEV_PLAN §1's cluster **E · Guard quality**, item by item,
plus B-157, L-027 and B-161 re-checked from the tables that hold them — all three
closed (v3.14.365, v3.14.365, v3.14.370), neither bug in Open, L-027 not on the
board.

**What was found.**

**E2 was closed and still listed as work.** L-042 — *the tally depends on which
corpus resolves* — was ✅ at v3.14.384, and its row in a section headed *what to
do next* still said "worth re-measuring after". So it was re-measured:
**90 passed, 0 failed, 0 disabled both ways**, against `samples/` and against the
live pair. Struck through with the numbers.

**And the re-measurement found a trap worth recording.** Pointed at
`~/mnt/corpora` *unstaged*, the suite returns **84/6** — which is **B-168
refusing a directory with `archive/` beside the candidates**, not a tally
difference. Read carelessly it looks like L-042 reopening. That is exactly why
PRACTICES §10 step 2 says *"only them"*, and it is the first time the rule has
been demonstrated rather than asserted.

**E1's second half moved, and not the way it reads.** *"31% of assertion sites
are regexes against source text"* is now **290 of 2,050 — 14%**. But the
proportion fell because the denominator grew: 66 guards to 92, and the additions
execute. The absolute count is what must fall, and nothing shows it has. **The
mutation score itself is untaken since v3.14.229** and should not be quoted;
`GUARD_MUTATION` rec 8 has said so for 148 versions.

**E3 (B-170) is unchanged** — `schema_conformance_test` still has no vacuity
floor.

**Guard.** None added — this is a measurement pass. `run_all.sh` was the
instrument, run three ways.

**Verification.** `./dev/tests/run_all.sh` — 90 passed, 0 failed, 0 disabled.
Nothing filed. E is down to two items, and E1's headline number is still
unmeasured.

---

## B-209 — the privacy hook has never run on a clone (2026-09-03)
**Version:** v3.14.401 · **Type:** fix · **Archives:** `dev/archive/changes/b209_hooks_are_not_executable_in_git/` (v3.14.400)
**Touched:** hooks/pre-commit · hooks/prepare-commit-msg (new) · dev/tests/hooks_executable_test.js (new) · dev/BUGS.md · dev/PRACTICES.md

**What was being built.** `hooks/prepare-commit-msg`, which puts the version from
`source/version.py` into the subject so `doc_integrity` §8b can find a version's
commit. It edits and never refuses; merges and already-stamped messages are left
alone. Executed against five message shapes.

**What building it found, and it is worse.** `hooks/pre-commit` was mode **100644
in every commit, including the first.** Git runs a hook only if it is executable
and **says nothing when it is not** — so the second of the two layers refusing
fieldwork has never existed for anyone who cloned this repository, public since
v3.14.392.

**Why nothing caught it: it fired.** B-206 was this hook refusing the first
commit, for real — because the working copy carried the bit from a `chmod +x`
while the index recorded 100644, and the working copy is the one git runs. A
clone gets the index's version, verified by cloning. **`chmod` is the trap**: it
changes the checkout and leaves the index wrong. The fix is
`git update-index --chmod=+x`, now half of PRACTICES §8's install line.

**Guard.** `hooks_executable_test.js` asks **git** for the recorded mode
(`ls-files -s`), not the filesystem — `statSync` answers about the checkout,
which was the half already right and is not what ships. It names the two hooks
that must be tracked, so losing one fails rather than shrinking the sweep.
**91 → 92.**

***And §8b caught this entry, on its first real run.*** The commit carrying this
version was the first stamped by `prepare-commit-msg`, so the check could finally
see it — and it failed: the **Touched:** line named
`dev/tests/gitignore_test.js`, archived because the version was *started* with
that file listed, and then never edited. Corrected above. **That is the property
working on the first commit it could see**, and the false claim was mine.

**Verification.** `doc_integrity` 74/0, `run_all.sh` 90/0/0 once the index was
repaired — 2 versions now verifiable against their commits, up from 1.

---

## "Claude outputs/" is ignored (2026-09-03)
**Version:** v3.14.400 · **Type:** chore · **Archives:** `dev/archive/changes/ignore_claude_outputs/` (v3.14.399)
**Touched:** .gitignore · dev/tests/gitignore_test.js

**What changed.** `Claude outputs/` is gitignored, with five cases in
`gitignore_test.js`.

**Why, and it is not about disk.** The desktop app writes files it hands back
into `Claude outputs/`, and when the session's working folder is this repository
they land inside it. Both files there were **copies of tracked ones**:
`README.md` byte-identical to the live README, and `README-1.md` a renamed copy
of `samples/README.md` that had collided with the first. 60 KB, and it would have
gone into the next commit.

**The risk is a second copy of a tracked file inside the working tree.** Someone
edits the copy and the edit is invisible to every guard that reads the real path
— which is the same reason `dev/*.html` is ignored, and PRACTICES §4 arriving
through the filesystem rather than through the code. Disk was never the argument.

**The name carries a space**, which is fine mid-pattern; only a *trailing* space
needs escaping. That was verified with `git check-ignore -v` rather than by
reading the file, per the note this `.gitignore` carries at its head — the
v3.14.153 defect where every commented pattern was inert.

**Guard.** Three cases that the folder is ignored — including
`Claude outputs/anything.txt`, so the rule is the folder and not two filenames —
and two that it does **not** swallow `README.md` or `samples/README.md`.

**Verification.** `git check-ignore -v` resolves all three paths to
`.gitignore:132`; `ls-files --others --exclude-standard` returns 0 under it and
the rest of the commit set is unchanged. `gitignore_test.js` 49 passed.
Mutation-tested in both directions: removing the pattern fails 3 cases, and a
pattern widened to `README*` fails the two that keep the real files tracked.

---

## B-208 — four live documents the bump never owned (2026-09-03)
**Version:** v3.14.399 · **Type:** fix · **Archives:** `dev/archive/changes/b208_live_docs_the_bump_does_not_own/` (v3.14.398)
**Touched:** README.md · QUICKSTART.md · setup.md · samples/README.md · dev/new_version.py · dev/tests/doc_integrity_test.js · dev/tests/quickstart_labels_test.js · dev/tests/fixtures/README.md · dev/tests/fixtures/cli_ingested/README.md · dev/BUGS.md

**What changed.** `README.md`, `setup.md`, `QUICKSTART.md` and
`samples/README.md` carry an **Updated / Version** stamp, and `new_version.py`
bumps all four — its tuple goes from 8 documents to 12.

**Why.** They carried **no stamp of any kind.** Every live document under `dev/`
had one; the four a *cloner* actually reads had none, so nothing said which build
they describe. The version numbers a grep finds in `README.md` (v3.14.151) and
`setup.md` (v3.14.81) are incidental mentions in body prose, which is worse than
nothing — they read as stamps and are 248 and 318 versions old.

**This is the third occurrence, and that is why the fix is not another list.**
`new_version.py`'s own comment records the first two: BUGS.md "would have rotted
by the next version if the bump did not own it", and RENAMES.md did rot, five
versions after being added by hand. **A rule stated in a comment and enforced by
memory is not enforced.**

**Guard.** `doc_integrity_test.js` **reads the bumper's tuple** rather than
keeping a second copy of it — the two writers become one. Add a document there
and the guard covers it on the next run. It also sweeps the repository root,
`samples/` and `dev/tests/fixtures/` for markdown with no stamp, so a new
unstamped document cannot appear beside them; the two fixture READMEs are named
as deliberate exceptions, **frozen with the specimens they describe** rather than
bumped with the build, because `cli_ingested/README.md` says *regenerate, do not
edit* and bumping its header would be editing it.

**And adding a stamp broke a guard that reads one.** `quickstart_labels_test.js`
parses bold spans out of `QUICKSTART.md` as claimed UI labels, so the stamp's own
`**Updated:**` and `**Version:**` failed it within the minute. Fixed by dropping
the stamp line **by shape**, not by whitelisting two words — any document that
gains a stamp later will not break it again.

**Verification.** `./dev/tests/run_all.sh` — 89 passed, 0 failed, 0 disabled;
`doc_integrity` 73/0, up from 60. Mutation-tested 3/3: a stamp reverted to an old
version FAILS, a document removed from the bumper's tuple FAILS, and a new
unstamped `.md` at the root FAILS.

---

## NEXT UP holds only what is next (2026-09-03)
**Version:** v3.14.398 · **Type:** chore · **Archives:** `dev/archive/changes/next_up_holds_only_what_is_next/` (v3.14.397)
**Touched:** dev/DEV_PLAN.md · dev/PRACTICES.md

**What changed.** §1: **348 lines → 198**, of which 172 had described finished
work. Reported by the user, in the only terms that matter: the answer to *what is
next* was below the fold.

**Where it went, and nothing was deleted outright.**

- **The queue and chains A and B** → two §5 rows. One indexes the work; the
  other keeps the two warnings that outlived it — A3's re-measurement that read
  `dep_head` for `head` and counted a `dep_rel` **B-015 decided is never stored**
  (*a check whose answer is fixed by a design decision, read as a measurement*),
  and D61's source 1 firing on zero tokens here.
- **The fixture-swap procedure** → `PRACTICES.md` **§10**. It says of itself that
  it is written for the next swap rather than kept as history, which makes it a
  practice and not a plan item. Gate 1 is taken; the procedure is not spent.
- **The shipping-disclosure section** → deleted, 41 lines. Every argument in it —
  why it discloses rather than excludes, why no filename scope, why it is not in
  `run_all.sh`, the 3-records-vs-269-strings measurement — is already in
  `ship_disclosure.py`'s own docstring, where it is read at the point of use.
  **Two writers of one thing** (PRACTICES §4).
- **Gate 1** → 26 lines: what it bought, and the two live things it left behind.

**Two paragraphs that exist to prevent stale copies had gone stale under their
own warnings.** *Where things stand* named "the 2 disabled" guards — nothing has
been disabled since v3.14.385 — while already carrying a note that it had once
been 9 guards stale. *The audits* says **"no summary is kept here"** and then kept
one: "the 24 `L-nnn` findings, 12 closed", against 42 and 35 today, 126 versions
on. **The lesson is not "be careful": a sentence naming a number is a second
writer whatever it says about itself.**

**Verification.** `doc_integrity` 60/0, `./dev/tests/run_all.sh` — 89 passed, 0
failed, 0 disabled. DEV_PLAN 900 → 555 lines across v3.14.397–398.

---

## A comb through the three live documents (2026-09-02)
**Version:** v3.14.397 · **Type:** chore · **Archives:** `dev/archive/changes/comb_three_live_documents/` (v3.14.396)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/DEV_PLAN.md · dev/BUGS.md

**What changed.** 2,233 lines → 1,999, and none of it by deleting an argument.

**Method: a script first, prose second.** A sweep cross-checked every `B-nnn`,
`L-nnn`, `Dnn`, path, version and stated count across the three files and the
tree. **It came back almost clean** — every count already reconciled with the
table holding it. Two flags were the sweep's own fault: bug-row severities appear
as `-`, `S1` AND `**S1**` across three eras of that table, and `run_all.sh`
enumerates `*_test.js log_triage.js *_test.py`, so PRACTICES's 91 was right and a
naive glob was wrong. **A sweep that disagrees with a document is not yet
evidence.**

**The defects were structural, not numeric.**

- **UNIFIED §3 "Conflicts, still live" held two settled ones.** ⑪ and ⑰,
  settled v3.14.392–393, left there with SETTLED banners inside them — **the
  exact failure §9 records about this document**: *a closed item under a live
  heading, and the heading is what gets read.* Moved to §5.2.
- **UNIFIED had no §2.2.** v3.14.387 deleted the heading *"Fill and timing"* and
  left its bodies, so numbering ran 2.1 → 2.3 and L-034 and L-013 read as
  provenance findings while §1's board filed them fill·timing. One heading, two
  errors. §2.1, which had no open findings left, is a pointer now.
- **DEV_PLAN §2 broke its own written rule** — *a feature that has shipped leaves
  this section*. D53, D34, D58 were there with 120 lines of finished work. One
  line each in §5; **residue moved to §3, not deleted.**
- **Gate 1: 188 → 90 lines.** What went was reasoning written in prospect that
  the event has settled. The fixture-swap procedure is kept whole.

**Three figures re-measured rather than carried; two had moved.** `homograph` is
set on **6 of 77** entries, not 0 of 52 — B-143 numbered them at v3.14.290.
Orphan lemma groups: **17 of 46, all Turkish**; `chinese-test` has none, which one
corpus could not have shown. And **B-136** is sharper than recorded —
`word_index` is on **108 of 108** Turkish words and **0 of 132** Mandarin.
All-or-nothing per corpus, because jieba segmentation passes through neither
writer, so a reader added today would be right on one shipped corpus and silently
wrong on the other.

**Verification.** Sweep clean both directions. `doc_integrity` 60/0,
`run_all.sh` 89/0/0.

---

## §1's prose said open, §5's ledger said closed (2026-09-02)
**Version:** v3.14.396 · **Type:** chore · **Archives:** `dev/archive/changes/l027_prose_says_open_ledger_says_closed/` (v3.14.395)
**Touched:** dev/audits/UNIFIED_AUDIT.md

**What changed.** Two stale claims in §1's summary paragraph. It said **L-027**
"remains" — 31 versions after §5 recorded it ✅ v3.14.365 with **B-157** — and
that L-033 closing left **L-036** open, 53 versions after D59 closed it at
v3.14.343.

**Why it matters more than two words.** §1's *table* never listed either as open,
and §5's ledger had both closed. Board and ledger agreed; only the prose between
them was wrong. **That is the worst place for it**, because a summary is what
gets read *instead of* the table — and it did exactly that: it sent a reader to
re-open two fixed bugs. This file's own header rule is that a count is computed
from the table that holds the rows and never carried forward. A **status** is a
count of one and obeys the same rule; prose that restates one is a second writer
of it (PRACTICES §4).

**How the second one was found, which is the part worth keeping.** Not by
reading. The first correction rewrote the sentence containing L-027 and preserved
"leaving L-036 and L-039" **verbatim**, because it was not what I was looking at.
A sweep — every id §5 marks ✅, checked against §1's full text — is what caught
it. Editing a stale summary is not the same as checking one, and the edit is what
makes the survivors invisible.

**Verified by execution, not by the ledger.** `cli_prov_test.py` §7 runs a real
`--translate` write end to end and asserts the element arrives with a **derived**
stamp and no `label` — B-157's whole content. 36 passed. `cli_schema_test.js`
15 passed. So the ledger was right and the prose was wrong, established the way
round PRACTICES §6 asks for.

**Also checked, and already done:** **B-161** ✅ v3.14.370 — `lemmaStripHtml`'s
`exact` branch offers the `lemma-new` door.

**Verification.** Table and ledger now cross-checked by script in both
directions: the seven ids §1 lists as open (L-006, L-013, L-022, L-030, L-034,
L-039, L-041) appear nowhere in the closed ledger. `./dev/tests/run_all.sh` — 89
passed, 0 failed, 0 disabled.

---

## QUICKSTART.md — the way in, for someone who is not a developer (2026-09-02)
**Version:** v3.14.395 · **Type:** feature · **Archives:** `dev/archive/changes/quickstart_for_testers/` (v3.14.394)
**Touched:** QUICKSTART.md (new) · README.md · dev/tests/quickstart_labels_test.js · dev/PRACTICES.md · dev/DEV_PLAN.md

**What changed.** A guided first session, linked from README Contents. Gate 2's
third item, and the second of its three now done.

**Two decisions the user made, both correcting a first draft.**
**No terminal commands at all** — the audience is documentary linguists, and a
draft that opened with `mkdir -p` and `cp -R` was written for the wrong person.
**And it teaches the features rather than only the first five minutes**: a tester
who never reaches search cannot report on search.

Both were possible because of something the draft did not know: the Add Section
form has a **Section text** box that takes a raw paste and auto-parses it into
paragraphs, sentences and words. So the whole path is clickable, and the tester
uses *their own text* — which is a better test than any fixture.

**What writing it found.** Three names `README.md` uses do not exist in the app:
the button is **LaTeX**, not `TeX`; **Potential Matches** was retired by D42 and
suggestions are one offer strip marked `take:`; the control reads **Add
selection**, not "Selection relations". The quickstart uses the real labels. The
README is not corrected here — that is its own version.

**Also measured, and not used:** `samples/turkish-test` has 90 content words of
which **7** are fully annotated, and its section 3 is empty (`DATA_INTEGRITY`
§3d).

**Guard.** `quickstart_labels_test.js` parses the bold spans out of the
quickstart itself — not a curated list beside it, which would be a second writer
(PRACTICES §4) — and checks each against `en.json`. **Guard count 90 → 91.**

**What it cannot do, recorded rather than implied.** It proves a label exists in
the app's vocabulary, not that it sits on the named control: `Progress` is the
value of two keys, so renaming the button alone still passes. Mutation-tested
3/3 by intent — renaming a label with a UNIQUE value fails, and the two
collision cases are documented in the guard's own header. The failure worth
catching is a label leaving the app entirely, and that is caught.

**Verification.** `./dev/tests/run_all.sh` — 89 passed, 0 failed, 0 disabled.

---

## B-207 — every command setup printed failed (2026-09-02)
**Version:** v3.14.394 · **Type:** fix · **Archives:** `dev/archive/changes/b207_printed_commands_dont_resolve/` (v3.14.393)
**Touched:** source/build_env.py · source/setup.py · source/scripts/corpus_annotate.py · source/scripts/corpus_ingest.py · source/scripts/corpus_optimize.py · source/scripts/dict_export.py · dev/tests/printed_commands_test.js · dev/PRACTICES.md · dev/BUGS.md · dev/DEV_PLAN.md

**What changed.** 67 printed command paths across six files, made
root-relative — `scripts/corpus_annotate.py` → `source/scripts/…`, `setup.py` →
`source/setup.py`, `build_env.py` → `source/build_env.py`.

**Why.** `build_env.py` and `setup.py` live in `source/`, so their usage lines
were written relative to themselves. `setup.command` does `cd "$(dirname "$0")"`
— the project ROOT — and runs `python3 source/build_env.py`. **The user is always
one directory above the script that is talking to them.** So the last thing a
successful install printed was a command that fails with *No such file or
directory*, and so did all six examples in `setup.py --help`.

**How it was found, which is the part worth keeping.** By doing gate 2's
fresh-machine item literally: clone the PUBLISHED repository onto a clean
machine, run setup, then run what setup tells you to run. Setup itself worked
perfectly. Everything it said afterwards was wrong. **No amount of reading those
files finds this** — each line is correct relative to the file it sits in, and
the `.command`/`.bat` launchers had the right paths all along, which is exactly
what hid the disagreement: two writers, and the correct one was not the one
talking to the user at the end of setup.

**Guard.** `printed_commands_test.js` — every interpreter-plus-path in a
user-facing file must resolve from the root. **Guard count 89 → 90**
(PRACTICES §6).

**Two escapes of my own, both recorded because they are the guard's own
lesson.** Its first version gated on `print|echo` appearing on the same line and
so skipped every argparse `epilog` — the exact 27 sites the bug was filed for —
and passed. Its first vacuity floor was `FILES.length >= 10`, which let
`setup.py` (21 of the 67) be dropped from the sweep with 13 files still scanned.
A count answers *did we scan enough things*; the question is *did we scan THE
things*, so the required files are named. A bare `\.py` also matched the first
three characters of `LingCoT.pyw` and reported a real file missing.

**Verification.** `./dev/tests/run_all.sh` — 88 passed, 0 failed, 0 disabled.
Mutation-tested 2/2 after the tightening. Then re-verified where it matters: on
the clean machine, `corpus_annotate.py --help`, `build_env.py --check` and
`setup.py --check` all run.

---

## Conflict ⑪ — the archive check becomes a git check (2026-09-02)
**Version:** v3.14.393 · **Type:** feature · **Archives:** `dev/archive/changes/c11_git_backed_touched_check/` (v3.14.392)
**Touched:** dev/tests/doc_integrity_test.js · dev/tools/ship_disclosure.py · dev/audits/UNIFIED_AUDIT.md · dev/DEV_PLAN.md

**What changed.** `doc_integrity_test.js` §8b asks GIT the question the archive
checks asked the filesystem: **every file an entry says it touched actually
changed in that version.** Touched ⊆ the commit's diff — never equality, because
a version's commit also carries the header bumps `new_version.py` makes. The root
commit is exempt **by name**, versions predating git are counted rather than
ignored, and `RENAMES.md` resolves a path that moved.

**Why.** UNIFIED conflict ⑪, which `git init` made live. `dev/archive/` is
gitignored, so on every clone the two archive checks print `-- skipped` and the
project's strongest documentation guard verifies nothing for anyone but the
author. Measured on a real clone: **86 passed, 0 failed, 1 disabled.** ⑪ called
it silent; it is not — the runner names it every run. The property was
unverified, never quietly claimed.

**The archive checks are kept.** They work for the author today and §8b needs
history before it bites; deleting the working half the day the replacement is
born leaves a window with neither. Delete them once several versions carry a
commit — then PIPELINE 2.1's freeze and the 280 MB are a disk question rather
than a guard's hostage.

**⑰ settled too, by the act rather than by code**: the disclosure ran, printed
both participants files field by field, and was signed. **PIPELINE S1 closes.**

**`ship_disclosure.py` now names what it cannot read.** It greps text, so a name
in a screenshot is invisible to it — found by opening
`docs/images/sentence-view.png` before the first push. Three non-text files ship;
empty files are excluded, because listing `logs/.gitkeep` trains the reader to
skim the one list that must not be skimmed. PRACTICES §5.

**Guard.** §8b guards itself: with zero checkable versions it reports DISABLED
rather than passing, so it cannot claim success before it is able to fail
(PRACTICES §7). It clears on the next commit, which gives it a parent to diff.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 1 disabled
(§8b, until this version is committed). Mutation-tested 2/2 in a scratch clone
carrying a second commit: an entry claiming an untouched file, and one naming a
path that had been renamed away. Both named the file and the commit.

---

## B-206 — the hook refused the first commit (2026-09-02)
**Version:** v3.14.392 · **Type:** fix · **Archives:** `dev/archive/changes/b206_hook_and_gitignore_disagree/` (v3.14.391)
**Touched:** hooks/pre-commit · dev/tests/gitignore_test.js · dev/BUGS.md · dev/DEV_PLAN.md

**What changed.** `hooks/pre-commit` section 2 exempts `samples/*` **and**
`dev/tests/fixtures/*`. Both prefixes are literal and neither ends in a wildcard
segment, so the exemption still cannot quietly widen.

**Why.** `dev/tests/fixtures/` was created at v3.14.386 and re-admitted to
`.gitignore` at v3.14.389 (**B-205**). Nothing told the hook. So git tracked
`cli-ingested_corpus.jsonl` and the hook refused it, and the disagreement
surfaced the only way it could: **the first commit of the project was refused.**
Two writers of one rule — *which cleared data may ship* — PRACTICES §4.

**The third instance of one shape.** B-156, B-205 and this are each a rule that
named `samples/` and did not know about the second legitimate location. All three
were found by executing rather than reading. This one could not have been found
earlier by any amount of reading, because a hook only runs at commit.

**Section 1 is deliberately NOT widened.** A participants file stays exempt under
`samples/` only: `dev/tests/fixtures/` holds none, and a hook stricter than
`.gitignore` fails safe. Looser is what B-206 was. The asymmetry is asserted, not
just commented.

**Guard.** `gitignore_test.js` gains §B, which **executes the hook** — a hook is
a program and its rules are `case` patterns, so a guard that greps for
`dev/tests/fixtures` would pass against a file that never runs (PRACTICES §6, and
the trailing-comment defect at the top of that same file is what reading a config
format buys). Seven path cases, plus the property that matters: every data file
git would actually commit must be one the hook accepts — **7 found, 7 allowed** —
which would have caught this without anyone naming the file. A vacuity check
guards the sweep itself (PRACTICES §7).

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled.
Mutation-tested 3/3, each restored byte-identical: the fix reverted (2 named
failures), section 1 widened to fixtures (1), and the corpus pattern made
unmatchable (2).

---

## Gate 1 taken — `git init`, and the disclosure that gated it (2026-09-02)
**Version:** v3.14.391 · **Type:** chore · **Archives:** `dev/archive/changes/git_init/` (v3.14.390)
**Touched:** dev/DEV_PLAN.md
**Examined:** dev/tools/ship_disclosure.py, run twice against the v3.14.390 tree: 214 files, 7 of them .jsonl, 2 people-records, 58 name occurrences across 20 files

**What changed.** The project has version control. `git init -b main`; identity
written to `.git/config` rather than `--global`, so it travels with the
repository instead of depending on the machine; `core.hooksPath=hooks` and
`chmod +x hooks/pre-commit`. Gate 1 closes in DEV_PLAN, and **PIPELINE_AUDIT S1
closes with it** — along with everything that audit called downstream of it.

**Why, and what the disclosure found.** The commit set was enumerated two
independent ways *before* a `.git` existed: `git ls-files --others
--exclude-standard` against a throwaway bare repo, and `ship_disclosure.py`. Both
said **214 files, 6.4 MB**, and the staged set then diffed **empty** against that
list — so what was signed off and what was committed are the same set, checked
rather than assumed.

Two people-records ship, both placeholders, both in `samples/`: `Test Annotator
#1` and `Google Translate`. They occur **58 times across 20 files** — not only
the participants files but `LICENSE.txt`, `README.md`, `pyproject.toml`,
`en.json`, four CLI scripts and two retired audits. That spread is the tool's
whole argument: an exclusion would have covered one file of twenty. **Signed off
by the author, 2026-09-02**, as content to publish permanently.

**Guard.** `hooks/pre-commit`, and the `core.hooksPath` line above is what makes
it run at all — **git runs no hook a clone has not opted into**, so that config
is part of setting up any working copy and not a one-time step here.
`gitignore_test.js` holds both directions of every negation.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled.
Beyond the declared exclusions git skips **11 `.pyc` files and nothing else**,
each confirmed with `git check-ignore -v` rather than by reading `.gitignore` —
which is how B-156 and B-205 were both found, one of them at v3.14.389. No live
corpus, no participant file outside `samples/`, no `.b105-bak`, no
`source/models/` (601 MB, CC-BY-NC), no `dev/archive/`.

---

## Every audit and design record re-read against the current version (2026-09-02)
**Version:** v3.14.390 · **Type:** chore · **Archives:** `dev/archive/changes/audit_design_status_pass/` (v3.14.389)
**Touched:** dev/audits/AUDIT_INDEX.md · dev/audits/retired/DATA_INTEGRITY_2026-08-30.md · dev/audits/retired/L_STATUS_2026-08-30.md · dev/audits/SEARCH_B_DESIGN.md · dev/audits/DICT_SENSE_AUDIT.md · dev/design/D58_fixture_set.md · dev/design/save_format_decision.md · dev/DEV_PLAN.md · dev/RENAMES.md

**What changed.** Full account in `dev/audits/AUDIT_INDEX.md` §8. Five stamped
annotations, appended — no frozen body was rewritten. D58's header said **"Not
built"** six versions after it was built; `save_format_decision` now admits in
its own new §10 the density figure this index has recorded as wrong since
v3.14.310; `SEARCH_B_DESIGN` is annotated for the v3.14.388 rename; `DICT_SENSE`
records that both shipped corpora carry a dictionary now; index item 33, which
said one of them was a 0-byte file, is struck. **Two retirements:**
`DATA_INTEGRITY_2026-08-30` and `L_STATUS_2026-08-30`, each with a banner, both
because the swap replaced the corpora they measured.

**Why.** First pass since the fixture swap. The finding that made it worth doing:
**21 of the 27 design records were absent from `AUDIT_INDEX` §1** — every one
from D29 to D61. It carried six, all stamped v3.14.134, and read as a complete
index for 250 versions, so the half of `dev/design/` that was still owed work had
no place saying so outside DEV_PLAN §2. §1 now carries all 27 with a verdict and
an open-items column each.

Nothing SPENT was retired. §0's table makes MOOT and WRONG the criteria, and §6
already settled that being answered is not being unowned.

**Guard.** `doc_integrity_test.js` — it walks `audits/retired/`, so both moved
files stay stamped, and it consults `dev/RENAMES.md`, which took a row each so
frozen citations to the old paths still resolve.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled.
Recs 3 and 5 of `GUARD_MUTATION` were re-checked by execution rather than
believed: `required_marker_test.js` still reaches `renderField` through `fnSrc`,
`suggest_mechanism_test.js` still spends twelve assertions on six names.

---

## B-205 — the CLI specimen would not have been committed (2026-09-02)
**Version:** v3.14.389 · **Type:** fix · **Archives:** `dev/archive/changes/b205_the_cli_specimen_would_not_have_been_committed/` (v3.14.388)
**Touched:** .gitignore · dev/tests/gitignore_test.js · dev/new_version.py · dev/RENAMES.md · dev/BUGS.md · dev/edit_log.md

**What changed.** `!dev/tests/fixtures/**` re-admits the purpose-built specimens,
with `dev/tests/fixtures/**/*.b105-bak` restated after it, the way `samples/`
already does both.

**Why.** `dev/tests/fixtures/cli_ingested/cli-ingested_corpus.jsonl` is
`corpus_ingest.py`'s own output, built at v3.14.386 so `prov_intern_test`'s "not
yet interned, must shrink" branch has a fixture again. It carries the name the
CLI writes and the loader resolves — so **`*_corpus.jsonl` caught it**, and the
first commit would have shipped a guard that fails on a fresh clone: the guard
asserts the file exists and fails when it does not, which is correct, and would
have been a cloner's first impression of the project.

**The same shape as B-156, one directory over**, and found the same way — by
asking git what it would take rather than by reading the file. The pre-`git init`
sweep is what this class of defect is caught by; reading `.gitignore` is what it
survives.

**Guard.** `gitignore_test.js` +4, both directions: the specimen and its README
ship, a corpus one directory up (`dev/tests/other_corpus.jsonl`) stays ignored,
and a repair backup stays out even inside the fixture directory. Mutation-tested
3/3 — the negation removed, the negation widened to all of `dev/tests/`, and the
`*.b105-bak` restatement removed.

**Three more things the same sweep found**, none a bug and all of them things a
first commit would have carried: `_to_delete/` at the repository root (the ignore
rule names `dev/_to_delete/`), `dev/tests/_scratch/` — sixteen throwaway probe
scripts, six of them exact duplicates, nothing referencing any — and
`dev/tests/_probe.txt`, a pasted fragment. All moved under `dev/_to_delete/`,
which is ignored. **232 files became 215.**

And `RENAMES.md` was not in `new_version.py`'s header bump, five versions after
the comment in that very function says why BUGS.md had to be: *"it would have
rotted by the next version if the bump did not own it."* It had, by one version.

**Verification.** `./dev/tests/run_all.sh` — 87/0/0; `--slow` 88/0/1; against a
staging set 87/0/0; `gui_crud` 46/0 where Chromium exists. **Every guard in the
suite has now run and passed at this version.**

---

## Search-A removed, Search-B renamed to search (2026-09-02)
**Version:** v3.14.388 · **Type:** chore · **Archives:** `dev/archive/changes/search_a_removed_and_search_b_renamed_to_search/` (v3.14.387)
**Touched:** source/modules/search.js · source/modules/search_b.js · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · README.md · dev/tests/search_parity_test.js · dev/tests/search_b_test.js · dev/tests/search_b_routing_test.js · dev/tests/search_b_matcher_test.js · dev/tests/search_b_concordance_test.js · dev/tests/_search_b.js · dev/tests/_source.js · dev/tests/igt_align_test.js · dev/tests/input_attrs_test.js · dev/tests/normalize_test.js · dev/tests/render_cache_test.js · dev/tests/doc_integrity_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/edit_log.md

**What changed.** Two files into one, the last of the retired engine deleted, the
`B` dropped everywhere. `search.js` is now the compiler, matcher, concordance
builders and view, in that order. `sbSearch` is `runSearch`; `_sb*` folded into
the `_srch*` globals it was already copying itself into; `sb-` joined `srch-`.
The retired engine's names were free, so the matcher's internals took them.

**Why the split stopped meaning anything.** Search-A's view went at v3.14.38,
leaving a shared compiler in one file and a second engine calling into it from
the other, its state set by one and read by the other. 147 lines of dead runners
went, plus nine dead view globals and three unreachable branches.

**The parity guard was the whole decision.** It drove those three runners, so
Search-A survived only inside the test written to justify removing it — D58 §3's
shape one level up. Deleting it cost 1,322 comparisons, so it was converted
instead: `search_invariants_test` keeps the harvest and the two-corpus sweep,
asserting properties needing no second engine (a wildcard never loses an exact
match; an anchored regex equals the exact glob; a word-level hit's sentence is a
sentence-level hit). **958 property checks**, each relating two independent
paths.

**B-204, found by the refactor and older than it.** The substrate parks caches on
the annotator's own records, and the serializer writes whatever a record
enumerates: a save after a concordance wrote every word into the file again.
**85,964 characters clean, 230,125 after one KWIC.** Non-enumerable now — a
mechanism, not an exclusion list a future serializer must remember.

**`dev/RENAMES.md` is new**, and its own header says why.

**Guard.** Mutation-tested: the invariants guard catches a glob that stops
widening, an unanchored glob, a wrong `matchedWordIds` and a skipped paragraph;
the goldens catch the dropped fold and `<BREAK>` parsing; B-204's catches an
enumerable cache. `igt_align` changed job: its "the matcher did not opt into
gaps" asked the question of a FILE, and the merge put a renderer that
legitimately opts in beside the matcher.

**Verification.** `./dev/tests/run_all.sh` — 87/0/0, twice.

---

## the stale entries fixed, the finished work compressed (2026-09-02)
**Version:** v3.14.387 · **Type:** chore · **Archives:** `dev/archive/changes/stale_entries_fixed_and_completed_work_compressed/` (v3.14.386)
**Touched:** README.md · dev/README.md · dev/DEV_PLAN.md · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md · source/resources/locale/en.json · dev/edit_log.md

**What changed.** Five statements the last three versions made false, and a comb
of the finished work in the three live documents. No code except one orphaned
locale key.

**The false statements.** The **shipped** README said files written before
v3.14.248 still load (they do not, v3.14.386) and that `samples/` is still in the
older shape (regenerated, v3.14.384); it also said three guards are disabled on a
fresh clone (none are, v3.14.385). `dev/README.md` said the loader handles three
file shapes; there is one. `AUDIT_INDEX` said D50 stage 5 waits on corpus data.
And `label.view.annotations` was left in `en.json` by v3.14.386's deletion of
`renderAnnotations` — a one-key, two-line diff, found because the orphan count
moved 111 → 112.

**Four findings closed in UNIFIED_AUDIT**, all one question seen from four
angles: **L-007** (a fixture weaker than its guards, in a format the app no
longer wrote), **L-019** (two guards gated on a filename), **L-021** (the swap
would delete the only dependency coverage) and **L-042** (the tally depends on
which corpus resolves). The swap answered all four together. Its header counts
were recomputed from the tables by script — the line they replace said 32 closed
/ 2 half against a ledger holding 31 and 3, and "20 rows" against a board of 15,
which is this document's own subject arriving in this document for the third time.

**The comb.** DEV_PLAN −18% (D34's 105-line build diary → 36, D58's 76 → 42, the
swap's 111 → 48, clusters A and B 39 → 28); UNIFIED_AUDIT −4%. **BUGS did not
shrink and should not have**: its Fixed table is already one line per bug, and
the four longest rows were checked by hand — every sentence is a distinct fact.
What it got instead is a NUMBER for its own re-compression trigger (196 rows,
median 259, p90 559, max 594, 38 over 500), because "the next time it starts
growing" is a feeling until somebody measures it.

**What compression is allowed to remove**: a second copy of something that has a
frozen home (D34's diary belongs to its design record — keeping both is
PRACTICES §4 in the documentation), and a table of closed rows. **Not** a lesson:
the two kept from clusters A and B are that a check whose answer is fixed by a
design decision is not a measurement (B-015), and that D61's source 1 fires on
zero tokens today.

**Guard.** None added. Verified by comparing the B/L/D reference sets before and
after rather than by reading: ten ids were dropped, three were pointers worth
keeping (B-163, B-199, B-168) and were restored, and the rest name closed work
that lives elsewhere.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled.

---

## D58 §3 — the dead readers deleted (2026-09-02)
**Version:** v3.14.386 · **Type:** chore · **Archives:** `dev/archive/changes/d58_s3_dead_readers_deleted/` (v3.14.385)
**Touched:** source/LingCoT.html · source/modules/field_spec.js · source/scripts/corpus_annotate.py · dev/tests/_fixture.js · dev/tests/prov_intern_test.js · dev/tests/schema_conformance_test.js · dev/tests/lemma_registry_test.js · dev/tests/field_spec_test.js · dev/tests/corpus_load_test.js · dev/tests/annotation_gaps_test.js · dev/tests/variation_fields_test.js · dev/tests/fixture_resolve_test.js · dev/tests/render_smoke_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/design/D58_fixture_set.md · dev/edit_log.md

**What changed.** D58 §3's six reader paths deleted, with the four companions it
names. New: `dev/tests/fixtures/cli_ingested/`, built from the shipped CLI. Full
account in **D58 §10**, appended.

**Why.** §3 asks *who produces that shape today*, not when it was written. Six
answers were nobody. The fixture swap made that a measurement rather than an
argument: two guards lost checks on branches the new corpora cannot enter.
**This was the last version in which the deletion was free** — after `git init`
a removed reader is a breaking change.

**Three more went that §3 does not list**, or the deletion is the half-done state
it warns about: `detectFileType`'s shape sniff and `parseJsonlText`'s
single-object fallback are the app-side twins of items 1 and 5, and
`_migrateDeclareRecordType` is what §3's own companion — `prov_intern`'s runtime
`record_type` strip — existed to exercise. **And one in the CLI**:
`corpus_annotate.py` still READ `free_translation` and was its last WRITER until
v3.14.151 — the reader outlived the writer by 235 versions inside one file.

**Guard.** The companions changed job rather than going quiet. `lemma_registry`
proved the migration converted the old spellings; it now proves there is nothing
to convert — in the code (`=== 0`, not a cap that has moved twice) and in **every
shipped dictionary**, since a stray row would load as an entry and lose its group
silently. `variation_fields` moved from "is the fallback present" to "is the key
gone everywhere". `annotation_gaps` asserts undeclared AND unread. Re-adding a
fallback breaks nothing, so two new sections hold the deletion itself:
`field_spec_test` the tier, `corpus_load_test` the sniffers.
Mutation-tested **13/13**, two escaping first: an unreadable file must FAIL
rather than return fewer rows, and the CLI is half of "nothing reads this".

**Incidental.** `render_smoke_test` loaded companions through the corpus loader,
printing four spurious NOTE lines a run.

**The cost, irreversible.** The two corpora under `corpora/archive/` report
`detectFileType → unknown` and no longer open. v3.14.329 decided this; it is
measured here.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled,
against `samples/` and against a staging directory holding only the live corpora.
`--slow`: 88/0/1.

---

## the two Search-B guards, re-pointed at the shipped corpora (2026-09-02)
**Version:** v3.14.385 · **Type:** chore · **Archives:** `dev/archive/changes/search_b_guards_repointed_at_the_shipped_corpora/` (v3.14.384)
**Touched:** source/modules/search.js · dev/tests/_search_b.js · dev/tests/search_b_matcher_test.js · dev/tests/search_b_concordance_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/design/D58_fixture_set.md · dev/edit_log.md

**What changed.** Both Search-B guards rewritten against `turkish-test` +
`chinese-test`, every golden hand-derived. New shared harness
`dev/tests/_search_b.js`. **The suite has nothing disabled for the first time:
87 pass, 0 fail, 0 disabled** — they had been dark for 265 versions (D58 §4.2).

**Why the goldens are hand-derived.** Each was read off the corpus JSON and then
confirmed against an independent walk written in another language; none was
recorded from `sbSearch`. A golden taken from the thing it checks is a
tautology, which is what a "re-pointed" guard would otherwise have become.

**What they now cover.** 44 + 28 checks over every matcher and builder path,
weighted to targets that straddle a level object: a morpheme sequence running off
the end of one word into the next (`DAn sonra`, `过 花` — and 过花 is no word), a
sequence spanning a sentence but never a paragraph, `<BREAK>` anchors, and the
lemma path, which reaches a token sharing one letter with its citation form. One
gloss asked at four levels gives four answers, all four asserted.

**Two defects the rewrite found.** **B-203**, fixed here:
`translitTextsForSearch` answered through `wordTranslit`, which returns *the*
reading for a label — one string — so a second transliteration under the same
label was writable, displayable and unfindable. And the harness itself never
loaded `normalize.js`, so `normForm` degraded to `toLowerCase` and the Turkish
fold B-120 exists for was absent from the guard that should catch its loss.

**Also fixed.** The two guards each carried their own drifted copy of the
harness. The shared one seeds the DICTIONARY too: without it `S.lemmas` was empty
and every `field: 'lemma'` search returned zero hits against an empty index —
passing, and checking nothing.

**Guard.** Mutation-tested **25/25**: punctuation breaking adjacency, morphemes
unflattened, strict adjacency ignored, the `<BREAK>` boundary dropped, the token
stream built per sentence, each lemma branch alone, cross-sentence testing one
side, translit first-element-only and label-ignoring, the text fold removed,
`wordGloss` not deriving, and ten equivalents across KWIC, frequency, sort and
collocates. Three escaped first time and each named a path no golden reached.

**Verification.** `./dev/tests/run_all.sh` — 87 passed, 0 failed, 0 disabled.

---

## the fixture swap — samples/ replaced with turkish-test and chinese-test (2026-09-02)
**Version:** v3.14.384 · **Type:** chore · **Archives:** `dev/archive/changes/fixture_swap_samples_replaced_with_turkish_and_chinese/` (v3.14.383)
**Touched:** samples/README.md · dev/DEV_PLAN.md · dev/design/D58_fixture_set.md · dev/edit_log.md

**What changed.** `samples/` is now `turkish-test/` + `chinese-test/`, each a
corpus, a dictionary and a participants file, byte-identical to the live corpora.
The old `samples/turkish-test/` is retired to
`corpora/archive/samples_turkish-test_retired-v3.14.384/` with its three
`*.b105-bak` files and `.prov_date_repair.json`. **The corpus data is not
archived under `dev/archive/changes/`** — corpora do not go in the repository,
which is what `hooks/pre-commit` is for; the retired copy lives with the other
corpora.

**Why.** DEV_PLAN's *The fixture swap, step by step*, steps 1–4. Step 5
(`ship_disclosure.py`, sign-off, `git init`) is gate 1's other half and was not
taken.

**Guard.** None added: the swap is the guards' input, and the whole suite is what
checks it. Step 0 was folding both journals, which is where **B-202** came from.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled**,
and the number that matters is not that one. **The post-swap tally is identical
to the step-2 rehearsal, check for check** — `diff` of the two per-guard tallies
is empty. Against step 1's baseline, five guards move and none changes outcome:
three gain checks from the second corpus, and two lose checks on branches the
current-shape data cannot enter (`lemma_registry` −2, `prov_intern` −1). Both are
D58 §3's dead-reader deletion arriving as a measurement instead of an argument;
neither is fixed here.

**Two things this surfaced, both recorded rather than decided.** DEV_PLAN's
v3.14.363 corpus figures (22 · 153 · 138) **do not reproduce** — the corpora hold
17 · 108 · 116 and 15 · 132 · 117 — and no annotation was lost: every id in the
superseded fork copy is in the merged one, checked id by id. And two shipped
`turkish-test` translations are stamped `auto-nllb-200`: machine output, honestly
labelled because B-157 was fixed, and about to be committed into an MIT
repository that excludes the NLLB weights because they are CC-BY-NC. **A licence
question for the author, before the commit.**

---

## B-202 — a replayed parent orphans its children (2026-09-02)
**Version:** v3.14.383 · **Type:** fix · **Archives:** `dev/archive/changes/b202_a_replayed_parent_orphans_its_children/` (v3.14.382)
**Touched:** source/LingCoT.html · dev/tests/journal_replay_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `_mapInto(map, o, parent, key, index)` split out of `_idMap`,
and called after every `add` and every `put` in `replayJournal`. The map is
refreshed during the replay, not only built before it.

**Why.** A deep put replaces a container's children — `Object.assign(hit.obj,
r.rec)` installs the journal's `words` array, whole. Every descendant the map
knew about is then an object no longer in the tree, and a later record naming one
of them updates a detached copy. **That is the ordinary save order**: save a
sentence, then a word inside it. Replay reported `applied: 2, unresolved: 0` and
the corpus came out with the OLDER value — last-write-wins, inverted, silently.

It stayed invisible in two directions at once. Views resolve through
`S.wordById`, which still named the detached object, so the app showed the edit;
serialisation walks `S.docs`, so the file never got it. Then
`buildCorpusIndex()` — which `loadProject` runs next — re-read the tree and the
edit left the screen too. No error anywhere: the replay reports success.

**How it was found.** Folding `turkish-test`'s journal into its base as step 0
of the fixture swap: a transliteration went missing, two before and one after,
and an instrumented probe put the loss between `replayJournal` and
`buildCorpusIndex`. It surfaced only now because the corpus had finally been
given a multi-element list — with one element the stale copy and the fresh one
are indistinguishable. **D58 asked for that list and said no fixture could show
what it was for.** This is what it was for.

**Guard.** `journal_replay_test.js` +6: a base with a one-element list, a parent
put carrying the child as it stood, then a child put with the newer value —
asserted against the TREE, not the index, since the index is what hid it; then
the same shape on `add`, where the parent is new. Mutation-tested 7/7: removing
either refresh, `_mapInto` not recursing, a refresh that will not overwrite an
existing entry, the refresh moved before the assign, an add-side refresh that
indexes the record but not its children, and the pre-fix code.

**Verification.** `./dev/tests/run_all.sh` — 85 passed, 0 failed, 2 disabled.

---

## B-199 — an exit that cannot finish must not start (2026-09-02)
**Version:** v3.14.382 · **Type:** fix · **Archives:** `dev/archive/changes/b199_an_exit_that_cannot_finish_must_not_start/` (v3.14.381)
**Touched:** source/LingCoT.html · source/modules/events.js · dev/tests/journal_disk_test.js · dev/tests/log_triage.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `beforeunload` flushes the journal instead of compacting. A
refused journal sets `journalRefused` instead of returning out of the load.

**Two defects, and the second is the one that lost work.**

**How the mismatch was manufactured.** `compact()` writes the base and THEN
truncates the journal, deliberately — a crash between them leaves a stale
journal, which survives, where the reverse loses one, which does not. But
`beforeunload` cannot await, and the window goes away between the two steps: the
base lands and the truncation does not. `write_abs` logs `File saved` after
`os.replace`, so a half-run leaves no line saying it happened, which is why this
took a log sweep to find. **An exit that cannot finish must not start a
two-step operation.** It appends now — one step, complete in itself, and the
pair on disk never contradict each other. Blur still compacts, because blur can
finish, and without it the journal would grow without bound.

**What the refusal took with it.** Refusing a stale journal is right: it replays
record bodies as an earlier version wrote them, over a base that has moved on.
But the refusal `return`ed out of the rest of the load — and the corpus and
dictionary are applied well above that point, so the project was already OPEN.
What it skipped was `promptLoadedCorpusAutosave`. With no `_savePath`,
`journalPath()` returns `''` and `flushJournal` returns 0 silently: **the journal
is inert for the whole session**, every save reports success, and nothing reaches
disk at all. Measured — `app_2026-09-01_235857` logged two dictionary saves, no
`File saved`, no journal line, then exited. **A refused journal is a reason not
to REPLAY, never a reason not to SAVE.**

**Guard.** `journal_disk_test.js` +9, both halves, plus the chain that makes the
second lossy: `journalPath` derives from the save paths (B-150) and
`flushJournal` is silent without one. Four mutations, four named — after one
escaped: `if (false) compact(…)` still contains `compact(`, and the check asked
whether the call appears rather than whether the condition survives. **The shape
of a call is not a call being made.**

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled**,
and the same against the live corpora.

---

## B-201 — a guard comparing two populations (2026-09-02)
**Version:** v3.14.381 · **Type:** fix · **Archives:** `dev/archive/changes/b201_a_guard_comparing_two_populations/` (v3.14.380)
**Touched:** dev/tests/prov_intern_test.js · dev/tests/log_triage.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `prov_intern_test`'s damaged-load check takes its baseline from
the same tree it walks. A `log_triage` acknowledgement for B-199's two-file form.

**Why.** The check holds that a file whose event table has been lost keeps its
references rather than tidying them away — *"deleting an unresolvable id destroys
the only evidence the file was damaged"*. It walked `S.docs` and compared against
`RESOLVE`, which walks `S.docs`, `S.dictionary` **and** `S.lemmas`. Those agree
only while the dictionary carries no field stamp — true of `samples/`, false the
first time somebody edited one field of one entry. It then reported 646 against
648 and read the corpus as damaged because two stamps live in the dictionary.

**A guard measuring the fixture's shape rather than the app's behaviour**, which
is L-007's family: it could only pass on a corpus poorer than the ones the app
produces, and the gate-1 rehearsal is where that surfaced.

**Mutations, honestly.** Two named: the comparison made vacuous, and the old
wider baseline restored, which reproduces 646-against-648 exactly. A third — the
app actually deleting unresolvable ids — I could not land: the damaged path never
reaches the branch I injected into, because a file with no table row does not
call the adopter at all. **The check asserts an absence, and nothing in the app
today would delete them**, so a faithful mutation has to invent the code first.
Said here rather than counted as three.

**And the log signature that came with it.** B-199 has a two-file form,
`corpus+dictionary`, and it is the worse one: the abort leaves `_savePath` unset,
so `journalPath()` returns `''` and `flushJournal` returns 0 silently. The
session of 2026-09-01 23:59 reported two dictionary saves and **wrote nothing at
all** — the journal, D50's whole safety net, is inert for such a session.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled**,
and the same against the live corpora, which is the rehearsal passing.

---

## B-200 — a numbered lemma is undeclared (2026-09-02)
**Version:** v3.14.380 · **Type:** fix · **Archives:** `dev/archive/changes/b200_a_numbered_lemma_is_undeclared/` (v3.14.379)
**Touched:** source/modules/field_spec.js · dev/tests/field_spec_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** One line: `homograph` declared `derived` at the `lemma` level.

**Why.** `_indexLemma` numbers a citation-form bucket exactly as
`_indexDictEntry` numbers a form bucket — B-114, D35 A1 — and only `dict_entry`
was declared. So every consumer of the field table was blind to a field the app
writes, and `schema_conformance` reported two live lemma records as drift in the
annotator's own data. Not residue: it is minted today.

**Found by the gate-1 rehearsal, which is the point of rehearsing.** It could not
show up in the suite, because no corpus had a numbered lemma pair until one was
annotated this week: `samples/` has none, and **D58 names that absence as a
measured gap**. The fixture surfaced a real defect before the swap rather than
after — the argument for the rehearsal step, made by the rehearsal.

**Guard.** `field_spec_test.js` +6, and it needs no such pair: it asks the SOURCE
which levels take part in numbering and requires each to declare the number, so
it holds whatever the fixture happens to contain. Two mutations, two named — one
per level, because a check that only knew about lemmas would have let the
original defect back in at the other end.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**
Against the live corpora: `field_spec_test` 78/0 and `schema_conformance` clean,
both of which failed before this.

---

## The pre-migration document pass (2026-09-02)
**Version:** v3.14.379 · **Type:** chore · **Archives:** `dev/archive/changes/pre_migration_document_pass/` (v3.14.378)
**Touched:** dev/DEV_PLAN.md · dev/design/D58_fixture_set.md · dev/audits/AUDIT_INDEX.md · dev/edit_log.md

**What changed.** Every live document re-taken against the files. No code, and
**no frozen document edited** — the audits and stamped designs stay as written;
D58 gets an appended §7 rather than a rewrite, which is what D31 got at v3.14.372.

**Cluster A is closed**, and re-measuring moved every line in it. A1, A3 and A5
were already done before anyone looked; A2 was done in this version; A4 was done
by the annotator; A6 shipped at v3.14.378. A5's "22/22" predated the corpora
changing shape — they are 17/17 and 15/15.

**D58 §7.** Three of its four measured gaps have closed by annotation: dependency
parses with a root (3 and 2, well-formed), a numbered homograph pair, an
ambiguous form. **One is left** — a multi-element list, and one instance in one
corpus is thin for the question D31 owns.

**A second writer of a number, in the document whose job is finding them.**
`AUDIT_INDEX` carried *"42 findings; 28 closed, 2 half, 12 open"* beside the
instruction *"read the Status block at its head — it is the count"*. The Status
block says 32 / 2 / 8. The row points at the source now and copies nothing.

**The swap is blocked, and the guards are what found it.** Rehearsing against the
live corpora gives 78 pass, 7 fail, all one cause: the turkish folder holds two
corpora. Six guards hit `pickOne`'s B-168 protection and refuse to guess; the
seventh cannot resolve a companion for the doubled name. Step 2's "a directory
holding **only** the candidates" is the assumption that breaks. Recorded in the
swap procedure rather than left for whoever runs it to rediscover.

**Two things for gate 1, neither a defect.** `samples/`'s three `.b105-bak` files
are correctly ignored (B-156's fix, asserted by `gitignore_test`), and
`ship_disclosure.py` runs clean — 276 occurrences, all synthetic. What it does
NOT print is `contact_info` and `birth_decade`, which D58 §2 forbids and which
`samples/turkish-test_participants.jsonl` populates. **Eyeball those two fields at
the disclosure**, per the standing instruction to plan a check rather than
hard-code an exclusion.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-169 — the rehearsal covers the variation guard (2026-09-02)
**Version:** v3.14.378 · **Type:** fix · **Archives:** `dev/archive/changes/b169_the_rehearsal_covers_the_variation_guard/` (v3.14.377)
**Touched:** dev/tests/variation_fields_test.js · dev/tests/_fixture.js · dev/tests/fixture_resolve_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `_fixture.companionsIn(kind, dir)` — every corpus's companion
of one kind, under the resolved fixture directory — and `variation_fields_test`
asks it instead of walking `samples/` by hand.

**Why.** Cluster A6, and the only code item in A. That guard was the one
corpus-reader that ignored `$LINGCOT_TEST_CORPUS`, so the gate-1 swap rehearsal
validated the SHIPPED dictionaries whatever it was pointed at. A candidate corpus
with a malformed `variants` or `allomorphs` would have passed the rehearsal and
failed after the swap — the one moment the rehearsal exists to prevent. Nineteen
other corpus-reading guards go through `_fixture`; this was the twentieth.

**In `_fixture`, not in the guard.** "Which corpora am I looking at" is that
module's question, and the hand-rolled walk was a second answer to it. A missing
companion is skipped rather than fatal: a corpus with no dictionary is a
legitimate state (B-163), and D58 wants one in the specimen set.

**Guard.** `fixture_resolve_test.js` +5, and the derived half is the point: **no
`_test.js` may build a path to `samples/` itself.** Fixing the one file would
have left the next one free to do it again. Four mutations, four named — after
two escaped: the scanner reported ITSELF, because it carries the pattern as a
regex literal and again in its failure message (**a guard matching its own prose,
now in four files this session**), and dropping the existence filter changed
nothing against corpora where every corpus has a dictionary, so the check needed
a tree where one is missing.

**Named exclusion, not a looser pattern.** The scanner skips itself by name; a
pattern loosened to accommodate it is how the next real offender gets missed.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## Retire the document-comment report (2026-09-02)
**Version:** v3.14.377 · **Type:** chore · **Archives:** `dev/archive/changes/retire_the_document_comment_report/` (v3.14.376)
**Touched:** dev/BUGS.md · dev/tests/log_triage.js · dev/edit_log.md

**What changed.** A **Withdrawn** entry, W-01; **B-199** filed open; an
acknowledgement in `log_triage`. No code.

**Why.** Reported as *"I see no way to edit the comment on the document"*, quoting
the fixture's description text; withdrawn by the reporter, who found the field in
a collapsed menu. Recorded rather than dropped, because that section exists for
reports where the design is right and unobvious — which is where the next person
files the same bug again.

**What it actually was.** A document has **two** free-prose fields and the report
was about the wrong one. `comments` is tier `aux`, renders inline, always has,
and was empty. The quoted text is `notes`, tier `extra` — and `extra` is the one
tier behind a disclosure, labelled for a document as *"Bibliographic details"*.
So the annotator found an empty comments editor in plain sight and their own text
under a fold whose label does not suggest prose about the corpus.

**Measured before writing it.** `renderDocumentEdit` in the stub: one `<details>`
on the screen, "Bibliographic details", with the comments editor outside it.
`turkish-test`'s `metadata.comments` is `[]` and its `notes` holds the quoted
text. The entry names the cheap answers so a recurrence starts from them.

**And an unacknowledged ERROR, found while verifying this.** `log_triage` failed
on *"journal does not belong to this base — corpus"*: the project refused to
open. `beforeunload` fires `compact('exit')`, which cannot be awaited and which
writes the base before truncating the journal — safe for a crash, not for a
teardown. `write_abs` logs `File saved` after `os.replace`, so the evidence is an
absence: an append at 22:13:43, "exited cleanly" at 22:13:45, no save line, and a
journal left fingerprinting the base from 22:11:10. **Filed as B-199 rather than
acknowledged as benign**: the two halves of D50 disagree about what a stale
journal is — `compact` leaves one believing it *"replays as a no-op"*, the load
refuses it as mispaired — and the fingerprint cannot tell "a journal from another
corpus" from "a journal the base has moved past". The fix is a decision, so it is
written down rather than guessed at.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-198 — a merge reparents in silence (2026-09-02)
**Version:** v3.14.376 · **Type:** fix · **Archives:** `dev/archive/changes/b198_a_merge_reparents_in_silence/` (v3.14.375)
**Touched:** source/LingCoT.html · dev/tests/section_editor_test.js · dev/tests/id_sort_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `reportReparented(kind, pairs)` — one reporter — and a call
from the merge in `saveDocument`, collecting the paragraphs that arrive under a
section their id does not name. `saveSection`'s existing log goes through it too.

**Why.** Asked to check whether merging two sections in `turkish-test` broke
anything. It did not: 236 ids, no duplicates, no dangling references, every
object indexed under the section it sits in, complete traversal, dep heads all
resolve, `danglingCompanions` 0/0/0. The one divergence — `sec_005` holding a
paragraph called `…sec_006.p_001` — is B-135's rule working. Renaming a moved
child would break `word.head`, the journal and every by-id map to preserve an
appearance.

**What was missing is the report.** `saveSection`'s re-parse has logged exactly
this since B-135, and its comment says why: *"the only reason this was ever found
was a sweep of the file months afterwards."* The merge made the same divergence
one level up and said nothing — and it was found by a sweep of the file, which is
the outcome that comment exists to prevent, reached by the route it names. Two
paths, one situation, one of them reporting: **one reporter now**, because two
writers of one statement is how they come to disagree about what they report.

**Guard.** `section_editor_test.js` +12, executed: a real merge through the real
buffer, then the id kept, the index resolving the moved word to the section it is
NOW in, and the report. `id_sort_test` holds the static half with the rule it
belongs to, and asks it of every handler that moves a child rather than of the
one written first. Seven mutations, seven named — after one escaped: reporting
EVERY absorbed paragraph. Merge B into A and A back into B and a paragraph goes
home; calling that a former parent is false, and a report that is sometimes false
is one that gets ignored.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**
Both corpora swept: 659 objects, 0 duplicate ids, 1 id naming a former parent.

---

## B-197 — a corrected row keeps the wrong link (2026-09-02)
**Version:** v3.14.375 · **Type:** fix · **Archives:** `dev/archive/changes/b197_a_corrected_row_keeps_the_wrong_link/` (v3.14.374)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · dev/tests/push_to_dict_test.js · dev/tests/offer_strip_live_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `morphLinkClash` (B-196's `candidateClash`, asked of a row and
the entry it links to); `refreshLinkClash`, wired into the same delegated `input`
handler as the offer strip, into `bindEvents` for the first paint, and into both
`takeOffer` tails; a `morph-unlink` action; a link note at the save; and
`_CLASH_DECIDES`.

**Why.** Taking an offer chip does two things in one act: it fills fields and it
writes `dataset.dictId`. D42 releases the first the instant the annotator types
over it. **Nothing released the second**, and the link is the stronger claim —
this token is an occurrence of that lexeme.

**Found in the file.** `turkish-test`'s `…w_006.m_001` is
`too`·`PART`·`functional.word` carrying the `dict_id` of the entry saying
`LOC`·`AFFIX`·`bound.morpheme`; `…w_006.m_002` is the `-AmA-` negative-potential
suffix linked to the entry for `ama` "but". Nothing could see either: the ids
resolve, so `danglingCompanions` is quiet by construction.

**Shown, not guessed.** Auto-unlinking would drop a link somebody chose and then
refined; auto-keeping produced the live case. The row says the two disagree and
offers to release only the link; the save reports it in the linking channel.

**The threshold was measured, and measuring changed it.** B-196's three clash
fields find **13** contradicting links across both corpora; two are defects. The
rest are `bir` glossed `a` against an entry saying `one`, `的` `of` against
`LNK`, `yine` `ADJ` against `ADV`. A warning firing thirteen times where two
matter is one nobody reads. The app's own comments already named the deciding
field — B-166: a part of speech is a claim about *this token in this sentence*;
B-069: free or bound is *"a fact about the language"*, a property of the LEXEME.
So the panel reports every difference and only `type` asserts two lexemes.
**B-196 shipped with the wrong threshold; this corrects it.**

**Guard.** `push_to_dict_test.js` +6. Eleven mutations, eleven named.

**Live repair.** Both wrong links removed with their `dict_id` stamps — no entry
exists for either token's analysis, so unlinking is the whole repair. Backup at
`/tmp/corpus_backup_b197.jsonl`. **274 links, 0 now contradict on type.**

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-196 — a clashing entry is not a fill (2026-09-02)
**Version:** v3.14.374 · **Type:** fix · **Archives:** `dev/archive/changes/b196_a_clashing_entry_is_not_a_fill/` (v3.14.373)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/tests/push_to_dict_test.js · dev/tests/morph_type_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `_CLASH_FIELDS` and `candidateClash`; the row carries `clash`;
`pkStateHtml` stops asserting the identity when the two sides contradict;
`pkFillsHtml` names what the entry says and offers the sibling door both ways.
`candidateRows` honours `new_anyway`, so `existing` has one decider. The draw and
wiring moved to `_pkRender`. Readonly boxes now look readonly.

**Why.** Reported: *"the add-to-dictionary copied the chip values not the updated
ones … and the type, POS, and gloss entries cannot be edited"*. Both halves, one
cause. For a morpheme `existing` is `found[0]` — the first entry with that form,
whatever its type, and the comment beside it is right that a morpheme may be
recorded as a `word`, a `root` or a `bound.morpheme`. Turkish `DA` is two
morphemes: the locative suffix and the particle "too". The annotator annotated
the particle; the panel showed the suffix's three values, said "nothing left to
fill", drew them readonly because the push is fill-only, and offered no way to
say these are different words. **The values were not stale — they were another
lexeme's, presented as this one's.**

**A missing field is nothing to argue with; two different answers are.** That is
the whole rule. `new_anyway` was already the model's word for it, already
honoured by `createEntries`, and settable from exactly one route — B-140's typed
blank row. The model could say it and no surface could.

**Live.** `w_006.m_001` in `turkish-test` is `too`/`PART`/`functional.word` and
carries `dict_id` of the `LOC` entry. That link is **B-197**, filed.

**Guard.** `push_to_dict_test.js` +8. Eleven mutations, eleven named — after two
escaped: the row renderer ignoring the decision (the test had simulated the
handler instead of exercising the coupling) and a CSS check that matched the
`:focus` rule and passed with the resting style gone.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-027 — an unknown tag becomes a decision (2026-09-02)
**Version:** v3.14.373 · **Type:** fix · **Archives:** `dev/archive/changes/b027_an_unknown_tag_becomes_a_decision/` (v3.14.372)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/tests/tag_control_test.js · dev/tests/word_edit_pos_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `TAG_POOLS`, `unknownTag(field, value)` and `noteUnknownTag`;
one call from `stampFieldProv`; an unknown-value group at the head of the tag
drawer offering the near match and `tag-add`; `adoptTag`, which extends the pool
in memory and appends to the project's vocabulary file; `rebuildTagDrawer`.

**Why not refuse.** The corpus ruled it out. `chinese-test` used `CLF` — the
right tag for a Mandarin classifier, absent from the shipped 18. The annotator
needed a tag the app did not have and nothing offered a way to add one. So the
question was never "refuse or warn" but *how does a project extend the
inventory*, and the answer already existed: `loadPosTags` overrides the embedded
array from `pos_tags.json`, and `schema_conformance_test` reads the same file, so
extending it extended both. It had no door. This is the door.

**Why `stampFieldProv`.** It is the one loop that already knows a field's name,
its new value, and that the value CHANGED — the last of which is why the report
fires when someone writes a tag rather than on every re-save of a record that has
carried one for months. A check in each save handler is the rule each caller must
remember, which is not a rule (B-030).

**Two readings, neither taken.** `affix` beside `AFFIX` is a typo; `CLF` is a
gap. The app cannot tell, so the drawer offers both and neither happens without a
click, and the value is never rewritten — silently correcting a tag is the app
asserting an analysis nobody made, which is what B-166 exists to prevent.

**A declaration that got a reader.** `chipRowHtml` has written
`data-drawer-action`, `-scope` and `-field` since D45 and nothing read them (§5).
`rebuildTagDrawer` does.

**Guard.** `tag_control_test.js` +21, executed. Nine mutations, nine named —
including "blocks the save" and "writes memory but not the file", the two
plausible half-fixes. The section first exited silently mid-file and looked like
a pass: `_pwReady` is a const resolved at load, the stub fires no
`pywebviewready`, and **an unresolved promise does not hold node's event loop
open**. The bridge stub goes on before `loadApp` now.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**
Both live corpora: 266 tag values, 0 outside their pools.

---

## B-139 — three string lists, and the question was asked of the wrong property (2026-09-02)
**Version:** v3.14.372 · **Type:** fix · **Archives:** `dev/archive/changes/b139_three_string_lists_three_answers/` (v3.14.371)
**Touched:** source/LingCoT.html · dev/tests/variation_fields_test.js · dev/BUGS.md · dev/design/D31_multi_entry_order.md · dev/edit_log.md

**What changed.** No code. The decision, written where `assignList` explains the
split, and a guard section that holds the premise it rests on.

**The decision.** `source_ids`, `variants` and `constituent_forms` need no
per-element provenance. B-139 grouped them by STORAGE SHAPE — string versus
object — and treated that as the thing to fix. The property that decides it is
the **control**, and the split is already written down in `applyForm` as
`_PROV_LIST_CONTROLS` against `_ARRAY_CONTROLS`. B-138's argument for stamping
elements is that "two translations added by different people years apart" is the
ordinary case, and that case exists only in a ROW EDITOR. These three are written
by whole-value controls — `list` is one text input holding `a, b, c`, `sources`
is a picker returning the whole selection — so every element is one person's
single act. A per-element stamp records the same moment N times, which is what
one field stamp already says, without a format change or readers to follow.

`constituent_forms` makes the point twice: `backPropagate` reads it as
`.join('-')` to seed a parse, so the order is the analysis. D31 said B-139 was
decided by *is position meaning, or is primacy a flag?* for free. It is.

**A wrong mechanism, caught by measuring.** The first draft argued `variants` has
no editor and nothing to attribute. It has one — `field_spec.js`, tier `extra`,
`control: 'list'` — and the claim came from grepping for assignments rather than
reading the field table, which settled it.

**Corrected evidence.** BUGS.md said all three fields are empty in both corpora
and rested the priority on it. `variants` and `constituent_forms` are; each
corpus's document metadata carries one `source_ids` entry.

**Guard.** `variation_fields_test.js` +9. Derived: it reads the two control lists
out of `applyForm`, requires them disjoint, looks each field's control up in the
table, and fails when one moves to a row editor — the one line that reopens this.
Five mutations, five named, after the fourth escaped a check that matched the
COMMENT recording this decision. Third time in this project (`input_attrs_test`,
`cli_prov_test`): the file decomments now.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-109 — the browse filter shows the vocabulary (2026-09-02)
**Version:** v3.14.371 · **Type:** fix · **Archives:** `dev/archive/changes/b109_dict_browse_filter_shows_the_vocabulary/` (v3.14.370)
**Touched:** source/LingCoT.html · source/modules/events.js · source/LingCoT.css · source/resources/locale/en.json · dev/tests/tag_control_test.js · dev/tests/render_cache_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `dictTypeFilterHtml()` builds the row through `chipRowHtml`
over the whole of `TYPE_CHOICES`; `chipRowHtml` gains `lead` and `label`; the
half-copy of the click handler in `events.js` is gone and `handleChipClick` takes
a `type-filter` action beside `pos-select` and `type-select`. The row moved out of
the toolbar onto its own line, because the drawer opens downward.

**Why.** Three of nine, chosen once, for every language the app will ever open —
"phrases only" could not be asked. B-084 fixed the export dialog's copy of the
same triple and left this mirror. `tag_control_test.js` had asserted the triple
as still-present so that fixing it would fail there and force the note to be
rewritten, which is what happened.

**A shadow, found while reading.** The old chips were built by `.map(t => …)`,
which shadowed the translation function, so the row physically could not call
`t()` — its labels were a hard-coded `'All'` and two raw values. The l10n hole
and the vocabulary hole had one cause.

**Guard.** `tag_control_test.js` +16, half executed: every type reachable, the
pseudo-value out of the vocabulary, the active chip asked of the CHIP rather than
the row, and the click driven through `handleChipClick`. Nine mutations, nine
named — but only after two escaped a first draft, both the same mistake: **a
check scoped to the whole file instead of to the repaint's own body**, and **no
check on the click at all**. Every drawing check passes on a control nothing
listens to. That is the second repaint-shaped escape today; B-161's was the first.

**A guard corrected on the way.** `render_cache_test.js` reported
`_dictTypeFilter` as a dead allowlist entry, because it modelled a renderer as
reading its state directly and the read had moved into a helper. Naming a live
entry as rot is worse than missing a dead one — the fix it proposes deletes a
refresh path. The staleness check follows one level of call now; the mutation
scan stays direct, because widening it attributed `t()`'s reads to 29 renderers.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**

---

## B-161 — the exact lemma match gets a door out (2026-09-02)
**Version:** v3.14.370 · **Type:** fix · **Archives:** `dev/archive/changes/b161_exact_lemma_gets_a_door_out/` (v3.14.369)
**Touched:** source/LingCoT.html · source/resources/locale/en.json · dev/tests/linking_s1s3_test.js · dev/BUGS.md · dev/edit_log.md

**What changed.** `lemmaStripHtml`'s `exact` branch now offers `lemma-new`, and
carries a second state for when that door has been taken: the verdict becomes
*will create a second lemma* and offers `lemma-pick` back. `refreshLemmaStrip`
passes the field's standing choice through. Two locale keys.

**Why.** The branches did not offer the same doors — `exact` offered none — so
`lemma-new`, which B-114 built for exactly this decision, was reachable only from
`ambiguous`, and a form is ambiguous only once two records carry it. **The one
state in which an annotator can be certain the app matched the wrong lemma was
the one state with no way to say so**, and saying it meant manufacturing the
collision by hand in the dictionary view. Reported from live annotation of
`turkish-test`. The taken state exists because a door that leaves the verdict
reading "will link" is B-108 / B-166 / B-193 one field over.

**A gate that came with it.** `newAnyway` is now set routinely rather than only
inside a collision, so `_resolveOrCreateLemma` checks it against the form as it
has checked `chosenId` since B-114 — `sibling` changes the note, and "a second
record for X" where there is no first is a false statement in a research record.

**Guard.** `linking_s1s3_test.js` §B4, +9. The derived check is not "the exact
branch has a door": the first draft asserted that of every branch and failed
honestly on `new`-with-no-candidates, which has no other outcome to offer. It is
**every branch resolving onto an EXISTING record offers not to** — `exact` and
`ambiguous` — so a fifth linking branch is asked the same question.

**The mutation that mattered.** Six of seven were named by a provider-level
check. The seventh — `refreshLemmaStrip` dropping the flag on its way to the
provider — walked through, and that is the LIVE path: the taken verdict would
paint once and revert on the next keystroke, B-193's exact shape. The repaint is
executed against `__els` now. **A provider tested alone is a shape**, and this
file had asked the provider alone since B4 was written.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**
Seven mutations, seven named failures.

---

## B-195 — minting a record is a write (2026-09-02)
**Version:** v3.14.369 · **Type:** fix · **Archives:** `dev/archive/changes/b195_a_minted_lemma_is_a_write/` (v3.14.368)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/PRACTICES.md · dev/tests/lemma_durability_test.js

**What changed.** One line: `mutate('dict', [lemma])` in `_createLemmaRecord`.

**Why.** It indexed the new record into `S.lemmas` and returned. No journal
record, and `saveGen('dict')` unmoved, so `compact()` had no reason to rewrite the
dictionary. **The token citing it was journalled the same second**, by the save
path that minted it — so the reference was durable and the record it names was
not. `turkish-test` ended with 5 words and 2 entries citing `su`, `içmek` and
`tekrar`; the session that made them exited without a compaction and the next
session's dictionary write made the loss permanent, because
`_carryUnsavedLemmas` starts from an empty registry and had nothing to carry.

**Every function involved was already correct.** `journalWrite` handles `dict`,
`replayJournal` routes a `record_type: 'lemma'` body to `S.lemmas`, `compact`
serialises `dictFileItems()`. Nothing was missing except telling them. The fix
goes at the MINT rather than at the call sites: `saveDictEntry` already listed a
new lemma in its own `mutate` and `saveWord`'s push path did not, and B-030's
comment two functions away makes exactly this argument — a rule each caller must
remember is not a rule. The duplicate from `saveDictEntry` costs nothing; a
journalled put is idempotent.

**Severity S1.** It is silent, it loses annotation, and the loss is written in by
the next ordinary save.

**Guard.** `lemma_durability_test.js` (19). §3 does the round trip the annotator
did — mint, journal, quit, reopen — because that is the only place an absence
shows; every unit involved passes on its own. §4 is the rule: a minter declares
its write, and `_indexLemma` must NOT, because it runs during load and replay
where a `mutate` would mark an untouched file dirty. §6's count 88 → 89.

**Verification.** `./dev/tests/run_all.sh` — **85 passed, 0 failed, 2 disabled.**
Seven mutations, seven named failures, including "marks dirty but does not
journal" — the plausible half-fix. Two crashed before reporting on the first pass
(`JSON.stringify` of an absent journal tail returns the string "undefined") and
now report.

**Found by the app, not by the suite.** `danglingCompanions` had logged
*"0 dict_id, 7 lemma_id, 0 provenance stamp(s) unresolved"* in the field, and it
matched an independent walk of the files exactly. The diagnostic that costs
nothing until something is wrong is what surfaced this.

---

## B-194 — a count is not a next id (2026-09-02)
**Version:** v3.14.368 · **Type:** fix · **Archives:** `dev/archive/changes/b194_a_count_is_not_a_next_id/` (v3.14.367)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/PRACTICES.md · dev/tests/id_mint_test.js · dev/tests/log_triage.js

**What changed.** `nextChildIndex(siblings, kind)` — the highest existing number
plus one — replaces `container.length + 1` in `saveSectionAdd`,
`saveParagraphAdd` and `saveSentenceAdd`.

**Why.** Found by checking what a reported section deletion had done. The deletion
broke nothing — no renumbering, every child id still names its real parent across
209 ids, no dangling references, no orphans. What it left is a GAP (`sec_001`,
`sec_003`), and the add paths mint from a count, so *Add section* would produce
`sec_003`, still held. **Nothing would throw**: ids are opaque (B-135), so a
duplicate is silent — one object becomes unreachable and edits land on whichever
the index kept. Deleting the LAST child still reuses its number, correctly. The
re-tokenize paths had already dodged this with a random suffix; the add paths had
not, which is the tell that the risk was seen once and not generalised.

**Guard.** `id_mint_test.js` (19). §1 executes the rule, including the reported
state. §4 loads a corpus with the gap and shows the old rule minting a taken id,
so §4's own check is not vacuous. §3 is the one that matters longest: it finds
the SHAPE — a container length reaching an id template — so a fourth add path
written later fails here rather than shipping this again. §6's count 87 → 88.

**Verification.** `./dev/tests/run_all.sh` — **84 passed, 0 failed, 2 disabled.**
Six mutations, six named failures. §3 caught none of the first three until it was
widened: it looked for `.length` inside the call, and all three sites read
`const si = d.sections.length` and then `padId(si + 1)`. The check that existed to
cover the future case was blind to exactly how the past cases were written; it
resolves one level of variable now.

**Found alongside, not fixed here: B-195.** `turkish-test` has 5 words and 2
entries citing three lemma records that no longer exist — the corpus is journalled
on every save and the lexicon is not, so the session that created them exited
without a dictionary write and took them with it. `danglingCompanions` had already
logged it; `log_triage` now carries the acknowledgement.

---

## B-193 — the fourth strip is a live promise too (2026-09-02)
**Version:** v3.14.367 · **Type:** fix · **Archives:** `dev/archive/changes/b193_the_offer_strip_is_a_live_promise/` (v3.14.366)
**Touched:** source/modules/events.js · dev/BUGS.md · dev/PRACTICES.md · dev/tests/offer_strip_live_test.js · dev/tests/log_triage.js

**What changed.** Typing in a morpheme row repaints the offer strip, on **every
field the offer reads** — gloss, part of speech and type — not just the one.

**Why.** The word editor draws four strips that each say what the save will do.
Three were repainted as the annotator types; the morpheme offer was rebuilt only
by `#ew-parse` and by taking a chip. So a chip computed while the rows were empty
— correctly live then, it had three fields to write — was still live after those
fields had been typed by hand, and clicking it wrote nothing.

**Third occurrence of one complaint.** B-108, then B-166 on the word POS field
— whose comment says *"which is B-108's complaint in a second place"*. This is the
third, and the comment above this very handler stated the rule it did not follow:
*"Repainting on any of them is what makes the strip a live promise rather than a
snapshot."*

**Guard.** `offer_strip_live_test.js` (14). §1 asks the question of all four
strips by name. §2 takes the selectors out of `_morphRowsNow` — the function the
offer is computed from — and requires the handler to cover each, so a fourth row
field added there fails until it is wired. §4 executes the transition: the same
chip live against an empty row, taken against a filled one. §6's count 86 → 87.

**Verification.** `./dev/tests/run_all.sh` — **83 passed, 0 failed, 2 disabled.**
Seven mutations, seven named failures, including the partial fix (gloss only) and
the future case §2 exists for (a new row field read but not wired). Two guard bugs
first: the handler regex matched the autocomplete's `input` listener rather than
the strips' — there are two on `#content` and it took the first — and the selector
scrape picked up the row container alongside the inputs.

**Found in the logs**, while closing B-192 — an unacknowledged `offer filled
nothing` signature. `log_triage` asking for one acknowledgement per form is what
made a fifth case legible as a different mechanism rather than more of the same.

---

## B-192 — the offer was computed one step before the journal that answers it (2026-09-02)
**Version:** v3.14.366 · **Type:** fix · **Archives:** `dev/archive/changes/b192_offer_computed_before_the_journal/` (v3.14.365)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/PRACTICES.md · dev/tests/offer_after_replay_test.js · dev/tests/log_triage.js

**What changed.** One call: `offerDictFill()` in the post-replay block of
`loadProject`.

**Why.** Reported from use — accepted auto-fills were offered again on every open.
Every part was individually right: `offerDictFill` is raised by `applyDict`, and
the journal replays LAST so a journalled record naming a dictionary entry can find
it. The consequence is that the proposal was computed against the corpus as it
sits on disk, one step before the journal carrying the accepted fills was applied.
It repeats until a full write compacts the journal into the base — on
`chinese-test`, whose corpus file had not been rewritten in two days, that was
every open. **The block this joins already re-ran the migrations and both indexes
for exactly this reason**; its comment says *"every migration has that hole"*, and
the offer had it too.

**Guard.** `offer_after_replay_test.js` (16), executed: it builds the state, takes
the offer, journals the acceptance, reloads from base + journal and asserts the
offer is empty. §5 asks the general question — everything `applyDict` raises is
classified as corpus-derived or not, so the next addition there is covered.
§6's count 85 → 86.

**Verification.** `./dev/tests/run_all.sh` — **82 passed, 0 failed, 2 disabled.**
Removing the fix and moving it before the replay each produce two named failures.
Two mutations were no-ops against the fixture rather than escapes, and are recorded
as such rather than counted as catches.

**A second bug found on the way, not fixed here.** `log_triage` surfaced a fifth
`offer filled nothing` — under v3.14.365, which already has B-108's fix. It is a
different mechanism: the offer strip is repainted on `#ew-parse` and after a take,
but not when a morpheme ROW is typed into, so a chip drawn against empty rows is
still live once they are filled. Filed as **B-193** with the log timings that show
it. One call fixes it; it gets its own version and a guard that asks for both
strips.

---

## B-157 — the CLI can say what it made (2026-09-02)
**Version:** v3.14.365 · **Type:** fix · **Archives:** `dev/archive/changes/b157_cli_says_what_it_made_scripts_audit/` (v3.14.364)
**Touched:** source/prov.py · source/scripts/corpus_annotate.py · source/scripts/corpus_ingest.py · source/scripts/corpus_optimize.py · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/PRACTICES.md · dev/tests/cli_prov_test.py

**What changed.** New `source/prov.py`: `make_prov` (unchanged in shape),
`init_prov`, and the two things no Python here could do — `derived_prov()`,
which writes the app's own derived stamp, and `stamp_element()`. Both scripts
import it and neither defines a stamp of its own. `set_sent_translation` writes
`{text, source_id, date}` with a **derived element stamp** and no `label`, and
drops the field-level stamp nothing read. Three STRUCTURE maps corrected (L-030's
shape, in all three scripts). `TODAY` is asked for per stamp, not at import.

**Why.** `grep -rn "'derived'" source/scripts/` returned zero: the CLI had no way
to say the machine made a value, so a `--translate` run's output read as a
person's and D34's panel counted it finished. The app was never the defect — its
rule that an unstamped element is human is deliberate and right. Two things found
while fixing it made the case sharper: `assignList` **stamps** any element that
arrives without a `prov` with the saver's moment, so the silence became a false
claim on the next save; and the `label` the CLI added is absent from the schema,
read by nothing, and sits inside `_listKeyOf`'s identity — so the app could never
reconcile a CLI translation with its own rebuild, which made that re-stamp certain
rather than likely.

**Guard.** `cli_prov_test.py`, 36 checks — the first provenance guard on the
Python side, which is what L-027 asked for. It reads the app's `_derivedFieldProv`,
`isDerived`, `assignList` and `readTranslationsEditor` rather than restating them,
and §7 runs the real writer end to end. §6's count 84 → 85.

**Verification.** `./dev/tests/run_all.sh` — **81 passed, 0 failed, 2 disabled.**
Eight mutations, eight named failures — after three fixes to the guard. Two
escaped: swapping `derived_prov` for `make_prov` at the one call site (every
earlier check built its own stamp, so none looked at the caller), and hoisting the
clock into a module constant (the check searched for a literal `date.today()`; it
asks the syntax tree now). A third crashed instead of reporting. And the guard's
first run failed three of its own checks by reading its own docstring — the same
prose-as-evidence defect `theme_audit_test` and `hidden_attr_test` each shipped
with.

**One process note.** A splice in this version cut on a marker that appears twice
in `corpus_ingest.py` and duplicated 54 lines. The pre-edit archive restored it in
one command; that rule paid for itself here.

---

## A re-read of the CLI provenance gap: the silence does not last (2026-09-02)
**Version:** v3.14.364 · **Type:** chore · **Archives:** `dev/archive/changes/b157_becomes_a_positive_claim/` (v3.14.363)
**Touched:** dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md

**What changed.** B-157 and L-027 gain the consequence neither had, and their line
numbers are refreshed (they had drifted ~50 lines). No application change.

**What was found.** `assignList` reconciles a list field on every save and stamps
any element that arrives without a `prov` — which is exactly what
`set_sent_translation` writes. So the first ordinary GUI save of a `--translate`d
sentence converts *"nobody said who made this"* into *"ann_001 wrote this"*, in
the file, permanently. The bug was recorded as "the CLI has no way to say what it
made"; the sharper statement is that **the silence is temporary and what replaces
it is false**. The window for any remedy is the minutes between the CLI run and
the next save of that sentence.

`assignList` is not the defect — B-138's rule that an unstamped element counts as
human is deliberate and right, for the same reason `_humanField`'s is. The CLI
remains the only place this can be fixed, which is what B-157 already said; what
changes is what it costs to leave.

**And the v3.14.363 provenance question is answered: no.** Three writers produce
three distinguishable shapes — CLI `{label, text}` with no element stamp; in-app
machine translate `date: today()` with a `derived` stamp; hand entry
`date: null` stamped by the person on save. All 44 free translations in the live
corpora are the third. This bug never touched them, and the app's own machine
translator marks its output correctly.

**Verification.** `./dev/tests/run_all.sh` — **80 passed, 0 failed, 2 disabled.**
Every line number in both write-ups re-resolved against the current files.
**What follows.** (bugs filed, or explicitly nothing)

---

## The live documents combed: six corrections, and 22 KB that had stopped earning its place (2026-09-01)
**Version:** v3.14.363 · **Type:** chore · **Archives:** `dev/archive/changes/comb_live_docs_v363/` (v3.14.362)
**Touched:** README.md · dev/README.md · dev/DEV_PLAN.md · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md

**Corrections, each measured rather than reasoned about.**

1. **A5 was already done.** DEV_PLAN said free translations were `0/22` in both
   corpora; they are **22/22**, real English, written 2026-08-31. The largest
   item in cluster A had been sitting on the board as open.
2. **The gate-1 rehearsal was six versions stale.** Re-run: **77 pass, 3 fail**
   against the live corpora, the same three, all in data. The pass count moved
   only because four guards were added.
3. **README.md** said four guards are disabled on a clone and two need
   `dev/archive/`. It is three, and one.
4. **dev/README.md** said `undefined_call_test.js` needs the archive. L-018 fixed
   that at v3.14.338 — its self-proof is constructed now. Its `new_version.py`
   line also omitted `--type`, which is required.
5. **AUDIT_INDEX §4 had drifted in the way §4 exists to catch**, twice: it still
   claimed **70 guard executables, 67 by default** (actual 84 / 80), and it
   carried **93** input controls while §2 of the same file said **94**. The count
   row now points at PRACTICES §6 instead of restating it; the controls row names
   the tool that owns the number. Archive re-measured 180 MB → **261 MB**, runtime
   19 s → **7.9 s**.
6. **A dangling pointer to `UNIFIED_AUDIT_PLAN.md`**, a file that has never
   existed in this tree, live for 141 versions.

**Compression, and it is rule-driven rather than tidying.** UNIFIED_AUDIT §2's own
rule says a closed body is retired at the comb that follows its closing; this is
that comb, so **L-035, L-036, L-038 and L-040 left** (68 → 60 KB), each already
carrying its §5 row. DEV_PLAN §2 is headed OPEN FEATURES and held six shipped
ones — **D32, D55, D57, D59, D60, D61 moved to §5** as one line each pointing at
`dev/design/` (76 → 65 KB). D61's entry still read "sketch, not decided".

**Guard.** None added. `doc_integrity_test.js` already holds the counts that can
be checked mechanically; the six above are the class it cannot see, which is why
a comb is a scheduled act and not a guard.

**Verification.** `./dev/tests/run_all.sh` — **80 passed, 0 failed, 2 disabled.**
Rehearsal re-run against a staging copy of the two live corpora. Every file
reference in the six live documents checked against the tree; the remaining
"missing" ones are correct as written — archived plans named as archived, a
`package.json` this repo deliberately does not have, and a `v.py` that a bug
report cites precisely because it does not exist.

---

## D61 — the lemma field proposes, from three places, each naming its evidence (2026-09-01)
**Version:** v3.14.362 · **Type:** feature · **Archives:** `dev/archive/changes/d61_lemma_proposals_sources_1_to_3/` (v3.14.361)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/design/D61_lemma_suggestion.md · dev/PRACTICES.md · source/resources/citation_forms.json · dev/tests/lemma_proposal_test.js

**What changed.** `lemmaProposals(word)` returns a ranked list — the token's
dictionary entry, the same form already lemmatised in this corpus (with its
count), and the root the parse names written through a per-language citation
rule. `lemmaStripHtml` shows them when the field is EMPTY, the one state it had
nothing to say in. New resource `citation_forms.json`; source 4 deferred.

**Why.** L-034 measured 135 of 310 glossed-token decisions as re-decisions of a
form already decided, and the lemma is typed in full every time. Each chip
carries its source because that is what makes it decidable. Nothing writes:
`_resolveOrCreateLemma` stays the only thing that makes a record, and an accepted
chip is stamped `derived` (B-165) — the defect this project has now filed four
times.

**Guard.** `lemma_proposal_test.js`, 42 checks, executed. §6's count 83 → 84.

**Verification.** `./dev/tests/run_all.sh` — **80 passed, 0 failed, 2 disabled.**
13 mutations, 13 named failures — but **four escaped the first draft**, each the
guard sharing an assumption with the code: harmony fixtures whose first and last
vowel agree (fixed with the disharmonic `kaybet`); folds that agree under
`toLowerCase` (fixed with `Işık`/`ışık`); a `src: 'lexicon'` check matching the
POS strip's copy; and a suffixing fixture that cannot tell "first free morpheme"
from "first morpheme".

**And one the guard could not have caught, because it shared the mistake.** The
table was keyed `tur`/`zho` — what the corpora store — while `_corpusLangCode`
resolves those to `tr`/`zh-hans`, so **it was never consulted at all**. Every
source-3 check passed because it called `citationForm` with the same wrong code.
Found by a fold check failing for an unrelated reason. The guard now builds the
real alias map from `language_codes.json` with the app's own code and derives the
key, so a table keyed by a code the app never produces fails loudly.

**Measured after building**, against the live corpora: 29 un-lemmatised tokens
would be offered a chip — 28 from source 2, 1 from source 3, **0 from source 1**,
because every linked token in these corpora already carries a lemma.

---

## B-108 — one answer to "what is the parse" (2026-09-01)
**Version:** v3.14.361 · **Type:** fix · **Archives:** `dev/archive/changes/b108_working_parse_one_value/` (v3.14.360)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/tests/log_triage.js · dev/tests/suggest_mechanism_test.js

**What changed.** `workingParse(parseVal, wordForm)` — the parse field if it has
one, the word's own form if it does not — and both `renderMorphSuggestPanel` and
`takeOffer`'s splice read it.

**Why.** They disagreed, for exactly the words with no parse. The splice has
always fallen back to the word form; the panel passed the raw field to
`suggestParseEntries`, so there were no parse matches, so `parseForms` was empty,
so the filter whose job is *do not offer an entry that is already a segment*
removed nothing. The entry came through as a form match, `taken` is only computed
for `fill-rows`, and a row that was already complete and already linked got a live
chip that wrote nothing when clicked. **v3.14.213's fix was real and this chip
never reached it.**

**Guard.** `suggest_mechanism_test.js` gains eight checks (135 total), executed
against the record that produced the log lines: the chip is still DRAWN, it is a
parse match, it is marked taken — and an empty row is still live, and an entry for
part of the word is still spliced. The cheap wrong fix is to filter the entry out;
that fails five of them.

**Verification.** `./dev/tests/run_all.sh` — **79 passed, 0 failed, 2 disabled.**
Five mutations; four caught, the fifth a no-op given the real fix, so the wrong
fix was run instead and named five failures. The four `offer filled nothing`
acknowledgements are marked FIXED rather than deleted — the lines are still in the
retained window, and an unacknowledged signature is a red suite.

**A method note.** Three readings of this code produced three wrong mechanisms.
What settled it was pulling `salkım` and `üzüm` out of the live corpus and running
the real panel over them. The first probe of that showed no chips at all — it set
`S.dictionary` but not `S.dictMorphemes`, and would have reported the bug fixed
before it was. The guard goes through `buildDictIndex()` for that reason.

---

## B-191 and L-040 — a word's gloss, where it comes from and what it may claim (2026-09-01)
**Version:** v3.14.360 · **Type:** fix · **Archives:** `dev/archive/changes/b191_untyped_word_gloss_l040_promote_and_show_both/` (v3.14.359)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/PRACTICES.md · dev/tests/word_gloss_source_test.js · dev/tests/igt_align_test.js · dev/tests/retokenize_align_test.js

**What changed.** Three things, one field. **B-191:** a word gloss is stored only
when the person TOUCHED the box — `value !== dataset.original` — instead of when
the value differs from the morpheme join. **L-040:** segmenting a whole-word
morpheme promotes its `gloss` and `part_of_speech` to the word, carrying the
original stamp, so nothing is lost and the confirm has nothing to ask; `type` and
`dict_id` are not promoted and still raise it. **Decided:** a stored word gloss
stays primary in the interlinear and the morpheme join gets its own muted line,
drawn only where the two disagree.

**Why.** The finding said the app invents "this word is monomorphemic" and then
makes the annotator dismiss a dialog to withdraw it — on 3 of 11 words, the ones
where the work is. Measuring it moved the target twice: the morpheme is not empty
(301 of 365 carry the gloss, and in `turkish-test` it is the only copy), and the
gloss was not being lost — it was being rescued by accident, through the input
box, and stored as the annotator's own. Three live words were sitting under a
word gloss that overrode their segmentation.

**Guard.** `word_gloss_source_test.js` (26), new: the plan, the loss test and the
interlinear are EXECUTED; `saveWord`'s wiring is read, and the guard says so
rather than blurring the two. §6's count 82 → 83.

**Verification.** `./dev/tests/run_all.sh` — **79 passed, 0 failed, 2 disabled.**
Ten mutations, ten named failures — one only after the fixture was fixed: the
"they agree" case was being erased by B-186's load migration before the render,
so the check had been measuring nothing. Two existing guards were loosened where
they read a literal space in aligned source; the second was one I had written an
hour after loosening the first.

---

## B-188, B-189, B-190 — a button nothing styled, a door with the wrong key, and fifteen rooms with no exit (2026-09-01)
**Version:** v3.14.359 · **Type:** fix · **Archives:** `dev/archive/changes/b188_header_button_look_b189_edit_entry_door_b190_dead_ends/` (v3.14.358)
**Touched:** source/LingCoT.css · source/LingCoT.html · source/modules/events.js · dev/BUGS.md · dev/PRACTICES.md · dev/tests/theme_audit_test.js · dev/tests/nav_exits_test.js · dev/tests/log_triage.js

**What changed.** **B-188:** the border, surface and hover moved off `#search-btn`,
`#project-btn` and `#file-btn` onto `.hdr-btn`, and `#gaps-btn` joined Search's
hide/reveal pair. **B-189:** the Edit Entry door passes `dictEntryId` (not
`entryId`) and carries `wordId`/`sentId`. **B-190:** one `deadEndHtml(key, vars)`
replaces fifteen bare-paragraph error returns; it offers the last corpus position
when one is recorded and still resolves, section 0 otherwise, and nothing at all
when no corpus is open.

**Why.** Both reports are §4: one look written three times, so the fourth button
got none of it (and its `.visible` was inert, so Progress showed from launch);
one contract with two readers, so the imperative caller missed the translation
`resolveGoOpts` does. `go()` nulls every field its opts do not name, so a dropped
`wordId` became `data-wid=""` — and Back landed on a page with no exits, which is
why it was reported as going nowhere.

**Guard.** `nav_exits_test.js` (19), new: the keys `go()` reads are taken from
`go()`, so every call is checked against the router itself, and the exit is
EXECUTED — stale position, no corpus, dict-to-dict, message retained.
`theme_audit_test.js` gains §5–6 (11 total): a shared control class must carry
its own look, no id may re-declare it, and a `.visible` the JS adds must both
hide and reveal. §6's count 81 → 82.

**Verification.** `./dev/tests/run_all.sh` — **78 passed, 0 failed, 2 disabled.**
Ten mutations, ten named failures — but three were caught missing first:
`border-radius` satisfied "declares a border", any `display` satisfied "was
hidden", and searching the whole handler satisfied "carries the key". §7, found
by trying to break them.

**Also acknowledged.** Two new `offer filled nothing` signatures from the same
session (`salkım`, `üzüm`). Both are B-108, whose entry asks for one case per form
because "the pattern across them is the evidence". Four now, all one case: a chip
advertising agreement. **B-108 is ready to close.**

---

## A failure that does not unsay itself, and a record of what the app said (2026-09-01)
**Version:** v3.14.358 · **Type:** feature · **Archives:** `dev/archive/changes/l038_outcomes_are_visible/` (v3.14.357)
**Touched:** source/modules/events.js · source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/audits/UNIFIED_AUDIT.md · dev/PRACTICES.md · dev/tests/outcome_channel_test.js

**What changed.** L-038, in two parts. `flashSaveStatus` now derives severity from
the icon the caller already passes (`/#ph-warning/`) and **a warning no longer
expires** — it stays until it is replaced or clicked away, styled `--danger` and
clickable only while it is one. Every outcome is also kept on an in-memory list,
capped at 40, newest first, rendered as a collapsed `<details>` in the Progress
panel with the count in its summary; the panel redraws when the list changes.

**Why.** Fourteen call sites send everything through this channel — `save_failed`,
`export_failed`, all of `reportLinkNotes` — and it whispered them for 2.5 s in the
header corner with no history. Deriving severity meant none of the fourteen
changed: a second parameter would have been a second writer of one thing (§4).
The list is never persisted; these messages name forms, and §9 keeps annotation
content out of `logs/`. The finding said 15 sites across five files; it is 14 in
two, and the guard measures it now.

**Guard.** `outcome_channel_test.js`, 34 checks, and it **executes** the channel in
the stub DOM rather than reading it (§6 — a shape is not a behaviour): it calls
`flashSaveStatus`, runs the timers under its own control, and looks at what is on
the element. Its load-bearing section is the derivation's soft spot — a caller
with no icon, or an unclassified one, would read as success. §6's count 80 → 81.

**Verification.** `./dev/tests/run_all.sh` — **77 passed, 0 failed, 2 disabled.**
Nine mutations, nine named failures: drop a caller's icon (2 fails) · let a
warning expire · uncap the history · push instead of unshift (2) · stop redrawing
the open panel · make anything dismissible · hard-code `warn = false` (6) ·
un-fold the history · take the warning's pointer events away.

---

## The swap re-rehearsed, the open work clustered, and one finding nine versions stale (2026-09-01)
**Version:** v3.14.357 · **Type:** chore · **Archives:** `dev/archive/changes/comb_and_cluster/` (v3.14.356)
**Touched:** dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md

**What changed.** Gate 1 carries the measured state instead of a stale rehearsal:
**73 pass, 3 fail** against the live corpora, down from five failures, and all
three are in the data. Each is named to the record — one lemma (`只` in
`chinese-test`), one key (`metadata.tracked`), a few dependency parses. DEV_PLAN
gains a clustered list of the open work, A through G, sorted by what each buys.
**L-036 is closed in the audit**: D59 fixed it at v3.14.343 as B-178 and the board
never heard.

**Why.** The comb at v3.14.349 was about size; this one is about accuracy. The
gate's rehearsal table had been read four times since it was written and two of
its five rows were already resolved — CLF joined the vocabulary, the
`doc_integrity` row was always in-flight noise. A plan that overstates what
remains is as costly as one that understates it.

**Three measurements the gate did not have.** The glossing is **done** — 137/137
and 182/182 morphemes — and what is missing is free translations (**0 of 22**,
both) and parses. `samples/` carries 13 `head` and 10 `dep_rel`, which is one or
two sentences: the guards need something that can fail, not coverage, and the
plan now says so rather than implying twenty-two. And the privacy exposure is
**four records**, not 269 strings: interning left no human name in either
corpus's `prov_events`, so substituting the neutral identity is an edit, and it
belongs BEFORE the remaining annotation rather than at the disclosure.

**One connection worth having written down.** If the 44 free translations are
machine-seeded, **B-157** means they ship as 44 claims a person wrote them. That
moves B-157 from "open S2" to "blocks a specific next step", which is what the
clustering is for.

**Guard.** None; this is a plan and an audit. `doc_integrity_test.js` checks the
stamps and the counts, and caught the audit's own arithmetic when L-036 moved.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.
Rehearsal: `LINGCOT_TEST_CORPUS=<staging> ./dev/tests/run_all.sh` — 73 passed, 3
failed, 2 disabled.

---

## The GUI guard is green: 31/6 on its first run, 46/0 on this one (2026-09-01)
**Version:** v3.14.356 · **Type:** chore · **Archives:** `dev/archive/changes/gui_modality_all_closed/` (v3.14.355)
**Touched:** dev/audits/AUDIT_INDEX.md

**What changed.** `GUI_MODALITY_2026-08-31.md` moves from LIVE to SPENT in the
index: nothing in it is open. B-175 and B-178 closed at v3.14.343, B-176 at
v3.14.347, B-177 at v3.14.355, and its one follow-up was already done when it was
written. The audit itself is not edited — it is frozen at v3.14.341 and is an
accurate record of what that run found.

**Why.** The index is where "is this still true" lives, and a row saying four
bugs are open when none is would send the next reader looking for work that does
not exist. It is also worth stating the arithmetic once: **the guard was 31
passed / 6 failed on its first run and is 46 passed / 0 failed now**, and the
extra eleven checks are the ones written for what it found — C2a/C2b, E3b, F0–F5.

**What that number does not mean.** Green is the third modality agreeing, not the
app being correct. Of the seven defects this guard is responsible for, **four were
reported by the annotator using the app before any guard saw them** — B-182 and
B-183 needed a screenshot, B-184 needed the log, B-187 needed someone to look at
an empty box and know it should not be empty. PRACTICES §8 stands: most defects
here were found by launching the app. The guard is what stops them coming back.

**Guard.** None; this is an index row. `doc_integrity_test.js` checks the stamps.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.
`gui_crud_test.js` at v3.14.355 on a machine with Chromium: **46 passed, 0
failed** (50.9 s).

---

## B-177: a declared fold is applied (2026-09-01)
**Version:** v3.14.355 · **Type:** fix · **Archives:** `dev/archive/changes/b177_fold_the_tag_at_the_writer/` (v3.14.354)
**Touched:** source/modules/field_spec.js · source/LingCoT.html · dev/BUGS.md · dev/tests/field_spec_test.js

**What changed.** `foldValue(level, key, value)` in `field_spec.js`, which owns
the declaration, applied at the four places that store a tag: `readForm`'s `tag`
case for every generated form, and the word editor's three hand-read inputs.
Part of speech folds upper, morpheme type folds lower, everything else is
untouched.

**Why.** `fold:` had been on five fields since the table was written and nothing
read it — the chip drawer folds inline with a literal argument, and every writer
stored what was typed. So the two ways into one field disagreed: `NOUN` from the
chips, `noun` from the keyboard, and they are different values to every index,
count and search in the app. Found by `gui_crud` A4, which types `noun` and asks
the file for `NOUN`.

**The decision, because it is one.** Case is not information in a tag — `noun`
and `NOUN` are the same claim and nobody means them differently — so the app may
normalise it. That is what separates a tag from a gloss, where rewriting the
annotator's text would destroy a distinction they might mean, which B-073 and
D53 stage F both refused. The fold lives in the table, not at the writers: a
second place that knows what `upper` means is the drift that left the
declaration unread for the table's whole life.

**Measured first.** Both live corpora already hold only correctly-cased values —
6 and 7 distinct POS, 3 types each — so the hazard was real and had cost nothing,
which is why this was S3 and why no migration is needed.

**Guard.** Derived from the table both ways: every field that declares a fold has
it applied, and three that do not are left exactly as typed. A sixth declaration
is covered the day it is written, and a fold that stops being applied is caught
the day it stops. Plus the four writers, each asserted to go through the table
rather than fold inline. Six mutations, all named — including one that folds
correctly but inline, which is the shape that hid this for so long.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.
`gui_crud` A4 needs a browser and is what closes this.

---

## B-187: the word-gloss field shows the word's gloss (2026-09-01)
**Version:** v3.14.354 · **Type:** fix · **Archives:** `dev/archive/changes/b187_word_gloss_field_shows_the_gloss/` (v3.14.353)
**Touched:** source/LingCoT.html · source/modules/events.js · dev/tests/gui_crud_test.js · dev/tests/word_edit_pos_test.js · dev/BUGS.md

**What changed.** `#ew-gloss` and its `data-original` are filled from
`wordGloss(word)`, not from the stored `gloss` key. The word↔morpheme mirror
attaches when the two fields **agree** rather than only when both are empty, and
starts from the value they agree on.

**Why.** Since B-176/B-186 a word gloss equal to the morpheme join is not stored,
and for a monomorphemic word that is the ordinary case — so the editor drew an
EMPTY box over a word that had a gloss. The annotator was shown nothing to clear,
cleared nothing, and the gloss stood. The mirror would have fixed it on the way
out, but its attach test was `both are empty`: the only reachable case while the
gloss was always stored, and not the case after B-186. Its own comment already
said the rule was *"as long as both fields hold the same text"* — the comment was
right and the code was narrower.

**This is what C2 had been reporting for two versions.** It went green at B-176
because it read the stored key, which B-176 had emptied — passing for the
storage change, not because clearing worked. Switching it to the reader at
v3.14.353 turned it red again and I read that as fallout; it was the original
defect, never fixed, one layer down.

**And I recommended a redesign for it.** "One control per value; for a
monomorphemic word the morpheme row loses its gloss input" — proposed without
reading `events.js:279`, where the app decided that question in 2026-06 with a
two-way mirror that works. The fix is a two-line generalisation of a mechanism
that already existed. Third time today that reasoning about a mechanism cost more
than reading it.

**Guard.** `word_edit_pos_test.js` holds the STRUCTURE and says so: the field is
filled from the reader, `data-original` with it, and the mirror's attach test is
agreement. Four mutations, all named. What the annotator sees is `gui_crud` C2a
and C2b — reopening a glossed word shows the gloss, in both boxes — because a
shape is not a behaviour (PRACTICES §6).

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.
C2/C2a/C2b need a browser and have not been run here.

---

## B-186: the save and the load agree about the word gloss (2026-09-01)
**Version:** v3.14.353 · **Type:** fix · **Archives:** `dev/archive/changes/b186_save_and_load_agree_on_the_gloss/` (v3.14.352)
**Touched:** source/LingCoT.html · dev/tests/gui_crud_test.js · dev/tests/ensure_morphemes_test.js · dev/tests/igt_align_test.js · dev/BUGS.md

**What changed.** `storedWordGloss(value, ms)` — a typed value equal to the
morpheme join is not stored, anything else is — and both `_deriveWordFields` and
`_migrateDropDerivedWordGloss` ask it.

**Why.** D60 left one case unanswered: what if what the annotator typed IS the
join? The editor mirrors a word gloss into the single morpheme row, so that is
the ordinary case. The save stored it; the migration dropped it on the next load,
so a file the app had just written held a field it removed on reading it back and
**save → open → save was not stable** — two writers of one rule (PRACTICES §4).

**How it was found.** Both ends are correct in isolation and every fast guard
agreed with both. It took `gui_crud` E3/E4 — a real browser, a real file, closed
and reopened. E4 is the only assertion in the suite that spans a close and a
reopen.

**Guard.** Executed in `ensure_morphemes_test.js`: a value equal to the join is
not stored and the reader still composes it, one that differs is kept, and a word
with no morphemes keeps its own.

**And five more `gui_crud` checks moved, which is the real blast radius.** A1,
A3, A9, A10 and C4b read `word.gloss` from the written file to ask whether a
value was trimmed, kept verbatim, survived at 2000 characters, kept its NFC/NFD
distinction, or survived a re-tokenisation. Every one of those claims still
holds; the value simply lives on the morpheme now. They ask a `gloss()` helper
that slices the app's own `wordGloss` into a VM — not a join re-written in the
guard, which would let the file and the guard drift and leave the guard asserting
its own arithmetic. Plus the structural half: the migration must ASK
the predicate, not repeat the comparison — two spellings of one rule is what
drifted. **E3b asserts the stamp survives on the morpheme**, which measures what
D60 actually gave up. Four mutations, all named.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.
`gui_crud` needs a browser; E3/E4 are what settle this and have not been run here.

---

## B-183, again: the tick leaves the summary (2026-09-01)
**Version:** v3.14.352 · **Type:** fix · **Archives:** `dev/archive/changes/b183_tick_leaves_the_summary/` (v3.14.351)
**Touched:** source/LingCoT.html · source/LingCoT.css · dev/BUGS.md · dev/PRACTICES.md · dev/tests/push_to_dict_test.js · dev/tests/gui_crud_test.js

**What changed.** The add-to-dictionary tick is now a sibling of the row's
`<details>` rather than a child of its `<summary>`; the row divider moves to the
wrapper. Its wiring is one `change` listener — no capture, no `preventDefault`,
no `stopPropagation`.

**Why. v3.14.350's fix was worse than the bug and I shipped it.** Opening a
`<details>` is the summary's activation behaviour — the default action of the
click. `stopPropagation` cannot cancel a default action, so v3.14.269 did
nothing. `preventDefault` cancels *both* defaults, and a checkbox's canceled
activation restores the state the browser flipped **before any listener ran**, so
v3.14.350 stopped the tick moving at all. Reported within the hour. The structure
removes the conflict instead of timing around it: a control that is not in the
summary was never the summary's business.

**Guard, and the reason the last one was useless.** `push_to_dict_test.js`
asserted capture + preventDefault + a manual flip — the SHAPE of the fix — and
passed against a control that could not toggle. It now asserts the structural
claim only (the tick is not a descendant of the summary), which no timing can
undo, and says that is what it is asserting. The behavioural claim went to
`gui_crud_test.js` scenario **F**, in a real browser: one click changes the tick,
does not fold the row, and a second click puts it back — because "it moved once"
is also what a double-toggle looks like. F5 checks the summary still folds on its
own, so the fix did not cost the disclosure.

**Not verified here.** There is no browser in this environment; F has not been
run. `./dev/tests/run_all.sh --slow` on a machine with Chromium is what settles
it, and until then this fix is reasoned, not observed — which is exactly the
state that produced v3.14.350.

**PRACTICES §6 gains the rule this cost twice:** a shape is not a behaviour.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.

---

## B-184 + B-185: a companion file opens its project, and an absence names itself (2026-09-01)
**Version:** v3.14.351 · **Type:** fix · **Archives:** `dev/archive/changes/b184_companion_file_opens_its_project/` (v3.14.350)
**Touched:** source/modules/project_files.js · source/LingCoT.html · source/resources/locale/en.json · dev/BUGS.md · dev/tests/corpus_load_test.js · dev/tests/project_files_test.js · dev/tests/render_smoke_test.js

**What changed.** `projectRole()` joins `projectFile()` in the module that owns
the four names — one builds a name from a role, the other reads the role back
out. `loadProjectFromPath` uses it: a journal or a participants file opens the
corpus beside it, through the same door (B-171), and when there is no corpus
there the message names both the file picked and the file to open. Four renderers
now answer "there is no document" before asking for a section.

**Why.** Reported from use, and the log said what the screen could not: the
annotator picked the journal, then participants, then the dictionary — and never
a corpus. `.` sorts before `_`, so `<name>.journal.jsonl` is the first file in
every project folder and is where the dialog lands. A journal is usually 0 bytes,
so `detectFileType` called it `unknown` and the app said it could not tell what
the file was. **It could — it wrote the name.** The "Section not found." that
followed was the second defect: an empty corpus reported as a missing section.

**Guard.** The companion route is EXECUTED through the real door in
`corpus_load_test.js`, with `read_abs` recording what it was asked for, because
the claim is that the loader asks for the corpus beside the file it was handed.
`projectFile`/`projectRole` are round-tripped over every role in the table rather
than spot-checked. B-185's guard is derived — every renderer that indexes
`sections()[S.sectIdx]` must test `doc()` first — **and it immediately found two
more, `renderParagraph` and `renderParagraphEdit`, which nobody had looked at.**
Five mutations, all named.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.

---

## B-182 + B-183: `hidden` that did not hide, and a tick that only collapsed (2026-09-01)
**Version:** v3.14.350 · **Type:** fix · **Archives:** `dev/archive/changes/b182_b183_hidden_panels_and_pk_toggle/` (v3.14.349)
**Touched:** source/LingCoT.css · source/LingCoT.html · dev/BUGS.md · dev/PRACTICES.md · dev/tests/hidden_attr_test.js (new) · dev/tests/push_to_dict_test.js · dev/tests/session_panel_test.js · dev/tests/log_triage.js

**What changed.** One CSS rule, `[hidden] { display: none !important; }`.
`#offer-panel-box` and `#offer-panel-backdrop` join the shared panel rules, which
they had been left out of. The add-to-dictionary tick cancels its click in the
CAPTURE phase and flips itself.

**Why.** An author `display:` outranks the UA stylesheet's `[hidden]` rule, so
B-162's `display: flex` on `#gap-panel-box` (v3.14.332) disabled `el.hidden`
without touching a line of JS. Silent in both directions: the property is set,
`el.hidden` reads back true, `mutate()`'s `if (!box.hidden)` behaves, and every
guard that asks the DOM agrees the panel is closed. **Only a person looking at
the screen can see it** — a screenshot, 17 versions later. The offer panel
inherited the shape at v3.14.348, which is why its last Accept looked like a
no-op: it writes (the log shows 12 + 5 + 2 links, all journalled) and then calls
`closeOfferPanel()`, which changed nothing on screen. B-183 is the same kind of
mistake one layer down: `stopPropagation` cannot cancel a default action, and a
`<details>` opens by default action.

**Guard.** `hidden_attr_test.js`, 10 checks, deriving the elements it covers from
the JS that toggles them rather than from a list — the whole class is that nobody
remembers the rule. Plus positioning for anything named `*-panel-box`. The tick's
three parts (capture, preventDefault, manual flip) are asserted in
`push_to_dict_test.js`, because any one alone is wrong. Six mutations, all named.

**And the guard had the bug it was written to find.** Walking selector/body pairs
over raw CSS reads a comment above a rule as part of its selector — so the
comment naming `#offer-panel-box` made the rule beneath it look as though it
covered that id, and the check passed against the broken state. A mutation caught
it. `session_panel_test.js` had the same latent defect and broke on the same
comment; both strip comments now.

**Also:** `log_triage` surfaced a new B-108 instance, `DA · 2 rows` — the first
since D55 made a take overwrite, which narrows what that warning now means.

**Verification.** `./dev/tests/run_all.sh` — 76 passed, 0 failed, 2 disabled.

---

## Combing the live documents: three copies of one number, and two recipes that could not be followed (2026-09-01)
**Version:** v3.14.349 · **Type:** chore · **Archives:** `dev/archive/changes/comb_live_docs_v2/` (v3.14.348)
**Touched:** dev/edit_log.md · dev/DEV_PLAN.md · dev/PRACTICES.md · dev/BUGS.md · dev/audits/AUDIT_INDEX.md · dev/tests/run_all.sh · dev/tests/_gui.js · dev/tests/doc_integrity_test.js · dev/design/D60_derived_values.md

**What changed.** `edit_log.md` **781 KB → 123 KB**: 257 entries below v3.14.300
moved verbatim to `dev/archive/docs/edit_log/edit_log_2026-08_v3.14.048_to_v3.14.299.md`,
leaving the 50 that cover D55–D60. Cut by version, not by date — 302 of the 306
entries were one month, so a month boundary said nothing.

The guard count lived in three documents and two were stale (70 and 77 against an
actual 79). PRACTICES §6 is the only copy now; DEV_PLAN and BUGS point at it.
D60 is marked built in DEV_PLAN and in its own header; AUDIT_INDEX's row for
UNIFIED_AUDIT said 30 findings when it holds 42. Four rows of the Fixed table had
grown back into write-ups and are one line again.

Two recipes nobody could follow: `run_all.sh`'s DISABLED footer named two causes
and there have been three since v3.14.340 (a missing browser), and `_gui.js`
printed `npm init -y` for a dot-named folder, which npm refuses — its first line
failed for anyone who followed it.

**Why.** Every one of these is a document asserting something the code
contradicts, which is the class `AUDIT_INDEX.md` exists to catch and had itself
joined. A note saying "re-compress this when it grows" is worth what nothing
checking it is worth: it said so in v3.14.272's words and four rows grew back
anyway.

**Guard.** Two new sections in `doc_integrity_test.js`. The guard count in
PRACTICES §6 is compared against the directory, and DEV_PLAN and BUGS are checked
for a re-introduced second copy. No Fixed row may exceed 600 characters — the
file's own number. Mutation-tested three ways: a stale count, and a second copy
re-appearing in each of the two documents. All three named.

**Verification.** `./dev/tests/run_all.sh` — 75 passed, 0 failed, 2 disabled.

---

## L-035 + B-180: the dictionary offers, the annotator decides (2026-09-01)
**Version:** v3.14.348 · **Type:** fix · **Archives:** `dev/archive/changes/l035_b180_dict_fill_offer/` (v3.14.347)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/BUGS.md · dev/audits/UNIFIED_AUDIT.md · dev/tests/ensure_morphemes_test.js · dev/tests/morph_type_test.js · dev/tests/suggest_mechanism_test.js · dev/tests/render_cache_test.js

**What changed.** `applyDict` computes instead of writing. `morphFillPlan` says
what the dictionary would put on a morpheme — through `_dictFillForForm` and a
new dry run of `linkTo`, so the offer and the accept cannot decide differently —
and `applyFillPlan` is the only writer of one, stamping every field it writes.
`dictFillProposal` groups the plans by form; a banner opens a panel that shows
each form's proposed values, its source entry and the words it touches, with
Accept / Skip per form. `acceptFillGroups` writes through **`mutate()`**.
`ensureMorphemesFromParse` fills only when a caller asks (`backPropagate` does,
the load does not); `reconcileMorphemesFromParse` is repair only and reports
through `mutate()` too. Empty-morpheme materialisation no longer fills content —
D60 as amended at v3.14.346.

**Why.** D60. Fill-only and derived-stamped was never the problem; writing 19
links with `sessionChanges()` reporting 0 and the journal empty was. Grouping by
form is what makes it reviewable: measured on the real corpora, **19 writes are 3
decisions** on Turkish (`Tilki`×12, `bir`×5, `sonra`×2) and 6 are 2 on Chinese —
the counts the old pass wrote silently, now the counts the panel offers.

**Guard.** In the guards that own each claim, not a new file: the walk writes
nothing, the panel's own summary names the value the accept writes, the accept
goes through `mutate()`, `applyDict` calls no writer, the fill is off unless
asked in **both** branches, and B-180's repair path mutates. `morph_type_test`
now names the functions that read the dictionary's type instead of counting
assignments; `suggest_mechanism_test`'s part-of-speech rule is asked of the whole
function rather than of an assignment, because the plan's `{field, value}` shape
defeated both old regexes. Nine mutations; the two that first escaped are the two
those rewrites exist for.

**Verification.** `./dev/tests/run_all.sh` — 75 passed, 0 failed, 2 disabled.
Proposal executed against both live corpora: the numbers match the writes the old
pass made, exactly.

---

## B-176: the word gloss stores only what a person typed (2026-09-01)
**Version:** v3.14.347 · **Type:** fix · **Archives:** `dev/archive/changes/b176_word_gloss_not_stored/` (v3.14.346)
**Touched:** source/LingCoT.html · dev/BUGS.md · source/resources/locale/en.json · dev/tests/ensure_morphemes_test.js · dev/tests/form_index_test.js · dev/tests/igt_align_test.js · dev/tests/corpus_load_test.js

**What changed.** `_deriveWordFields` no longer assembles `word.gloss` from the
morphemes, and an empty explicit gloss deletes the key. `wordGloss()` composes
the join on read as it always has; its heuristic for guessing who wrote a stored
value is gone. `_migrateDropDerivedWordGloss` drops a stored gloss equal to the
join, with its `field_prov` stamp. The derive strip says which promise it is
making — `hint.derive.shown` for the two fields nothing stores, `hint.derive.will`
for the parse, which is the only one still written.

**Why.** D60. The field held a typed value or the join with nothing to tell them
apart, so an empty explicit gloss was indistinguishable from *never set* and the
save re-derived. Measured on both live corpora: 306 of 310 stored glosses were
the join, **`wordGloss()` and its gapped form changed for 0 of 365 words**, and
the 4 that stay are compounds whose meaning is not their parts (`öğleden` "noon",
`bir` "one", 炎热 "hot", 下午 "afternoon"). The migration is idempotent — a second
run drops 0.

**Guard.** No new file: the claims went to the guards that already own them —
`ensure_morphemes_test.js` (nothing derived, an empty gloss deletes),
`form_index_test.js` (the strip's promise is now kept by the reader, not the
save), `igt_align_test.js` (a typed value equal to the join is still theirs; the
migration executed against real record shapes; and **nothing in the whole source
assembles a stored gloss**). Six mutations, all named.

**A hole the mutations found, which was not B-176's.** Removing the migration's
call site broke nothing: five load-time migrations existed and no guard reached
any of them — B-022 and B-023 exactly. And the JOURNAL is not migrated; replay
puts record bodies written by older versions onto the cleaned tree, which is a
hole in every migration, not the new one. So they are one sequence,
`_migrateCorpusRecords`, called at both doors, and `corpus_load_test.js` derives
the set from the definitions and asserts both doors, both orders. Five more
mutations, all named.

**Note.** Five files were `--add`ed after editing, so their archives are
post-edit. Filed as **B-181**.

**Verification.** `./dev/tests/run_all.sh` — 75 passed, 0 failed, 2 disabled.

---

## D60 amended: the load pass materialises structure only (2026-09-01)
**Version:** v3.14.346 · **Type:** decision · **Archives:** `dev/archive/changes/d60_amend_materialise_structure_only/` (v3.14.345)
**Touched:** dev/design/D60_derived_values.md · dev/DEV_PLAN.md

**The decision.** D60's first draft exempted `reconcileMorphemesFromParse(false)`
as "structural repair, not a content decision". That was wrong about the code:
the materialise branch fills gloss, type and transliterations from
`_dictFillForForm` and links, in the same expression that creates each morpheme.
The division is inside the function, not between its callers, so the exemption as
written would have left the whole of L-035 running through a door this record had
declared closed. The load pass now materialises **structure only**, and the fill
is a per-call flag: `backPropagate` keeps it, because it runs inside an annotator
act that already has a moment and a witness.

**Alternatives considered, and why not.** Keeping the fill on materialisation was
weighed against one real cost — a corpus that used to open with glosses opening
without them. Measured: **0 morpheme-less words carrying a parse in either live
corpus**, and `corpus_ingest.py:1110` writes `morphological_parse: None` beside
`morphemes: []`, so a fresh corpus cannot reach that branch either. The cost is
zero on anything this project can produce, so the argument did not need winning.

**What this binds.** The measurements go into the record rather than the
reasoning they replaced: an exemption defended by argument is worth less than one
defended by a zero. Also recorded for B-176's build: **306 of 310 stored word
glosses across both corpora are exactly the morpheme join** and will be dropped by
the migration with no display change, leaving 4 typed values — all compounds whose
meaning is not their parts. And `wordGloss`'s gap heuristic collapses to
`!w.gloss` afterwards, with no behaviour change.

---

## D60: a derived value never occupies the annotator's answer (2026-09-01)
**Version:** v3.14.345 · **Type:** decision · **Archives:** `dev/archive/changes/d60_derived_values_and_moments/` (v3.14.344)
**Touched:** dev/design/D60_derived_values.md (new) · dev/DEV_PLAN.md · dev/BUGS.md

**The decision.** B-176 and L-035 are one question in two places. (1) `word.gloss`
stores only what a person typed; the morpheme join is computed at read time and
never stored — D32 step 2 applied to the second field with the same defect.
(2) `applyDict`'s corpus-wide fill computes and writes nothing until the
annotator accepts, through a review surface grouped by form, links included,
acceptance going through `mutate()`. Not sticky. Full record:
`dev/design/D60_derived_values.md`.

**Alternatives considered, and why not.** For B-176, distinguishing *cleared*
from *never set* at the save closes the reported case and not the next door:
fill-mode derivation asks only `!word.gloss`, so a cleared gloss returns through
`ensureMorphemesFromParse`. Surviving that needs a tri-state field, which is
worse than the defect. For L-035, links were nearly left automatic — a link on an
unambiguous form is not a judgement — but **19 of the 22 measured writes were
links**, so that would have left the bulk of what happened invisibly still
happening invisibly. A modal was rejected as adjudication demanded at the wrong
moment; a bare banner as an offer nobody opens, which fills nothing.

**What this binds.** B-176 first, then L-035 — the first settles what a derived
value may occupy, the second when the app may write one, and doing it in that
order removes a field from the second. `reconcileMorphemesFromParse(false)` stays
automatic: materialising the morphemes a parse already implies is structural
repair, not a content decision. The cost of (1) is stated and accepted — a typed
gloss identical to the join becomes unrepresentable, authorship the corpus is
currently recording wrongly in 13 of 13 measured cases. Also filed: **B-180**.

---

## B-179: the venv re-exec fired on import, and execv does not return (2026-08-31)
**Version:** v3.14.344 · **Type:** fix · **Archives:** `dev/archive/changes/b179_venv_bootstrap_on_import/` (v3.14.343)
**Touched:** source/setup.py · source/scripts/corpus_ingest.py · source/scripts/corpus_annotate.py · source/scripts/corpus_optimize.py · dev/BUGS.md · dev/tests/venv_bootstrap_test.js (new)

**What changed.** The bootstrap block in all four scripts is now one function
called under `if __name__ == "__main__"`, finds the venv by walking up (bounded
at four levels) so the one line that differed between copies is gone, and knows
`.venv\Scripts\python.exe` as well as `.venv/bin/python`. The four blocks are
byte-identical and a guard holds them that way.

**Why.** `os.execv` at module level fires on import and never returns, so any
Python program importing one of these scripts was replaced by a fresh
interpreter running its own argv. Under `python -c` that argv is `['-c']` — the
script text is not in it — so the re-exec built `python -c` with nothing after
it. `workspace_test.js` imports `corpus_ingest.py` to ask where the CLI writes
fieldwork (B-041) and got `Argument expected for the -c option` instead of the
module; it had been red on macOS and green anywhere without a `.venv`, which is
why it read as environmental. Windows had never been adopting the venv at all.

**Guard.** `venv_bootstrap_test.js`, 15 checks. The executed half builds a
hermetic project in a temp directory — the real script copied at its real depth,
beside a `.venv/bin/python` that is a shell stub printing a marker — then
imports it (the marker must not appear) and runs it (the marker must appear, with
the command line intact). The stub is what makes the second half safe: exec'ing
into a real interpreter that is not really a venv would re-exec forever.
Mutation-tested with nine restorations, applied to one copy and to all four —
module-level execv, the convenience deleted rather than fixed, argv dropped, the
Windows layout removed, the walk unbounded, one copy drifting — **all nine
named**.

**Verification.** `./dev/tests/run_all.sh` — 75 passed, 0 failed, 2 disabled.
`workspace_test.js` goes green on the user's machine with no change to the guard,
which is the outcome wanted: the guard was right.

---

## B-175 + B-178: the document editor commits at Save, and only there (2026-08-31)
**Version:** v3.14.343 · **Type:** fix · **Archives:** `dev/archive/changes/b175_b178_section_editor_buffer/` (v3.14.342)
**Touched:** source/LingCoT.html · source/modules/events.js · dev/BUGS.md · dev/tests/section_editor_test.js (new) · dev/tests/render_cache_test.js · dev/tests/selector_audit_test.js · dev/design/D59_section_editor_commit.md (new) · dev/tests/doc_integrity_test.js · dev/DEV_PLAN.md

**What changed.** The section-row handler binds on `.sec-edit-row [data-arr]` —
the attribute it already read — instead of three style classes, one of which
(`sec-del-btn`) the markup stopped carrying at a restyle and which then existed
only inside that selector. Every branch now edits `_secEdit`, a buffer of
`{ si, absorbed, title }` built per open; `saveDocument` is the only writer of
`d.sections`, applies the merges on the way to disk, and calls
`buildCorpusIndex()` when the structure changed. `go()` clears the draft on the
way out of the view.

**Why.** One handler, two answers to *when does this reach the document?* —
`del` deferred to Save (and never fired), `merge` wrote on the click. **D59**
answers it once. The index rebuild is B-175's tail: it turns on a delete path
that has never run, whose words would otherwise stay in `S.wordById`, the form
refs and `corpusLemmaRefs`.

**Guard.** `section_editor_test.js`, 24 checks: the selector is evaluated against
the buttons the app actually renders (a matcher that fails loudly on a shape it
cannot read), every `data-arr` has a branch and every branch a button, the
handler names nothing belonging to the document, and the counts and rows are
executed from a buffer. Mutation-tested with **eight** restorations — the class
selector, the on-click merge, titles read late, no `go()` clear, a reset in the
renderer, no index rebuild, counts ignoring `absorbed`, `data-si` returning —
**all eight named**. `selector_audit_test.js` loses its `sec-del-btn` exemption,
which had recorded "the section editor has no delete button": it had seen this
bug and written down a false resolution (PRACTICES §5).

**Note.** The three guard files were named with `--add` after being edited;
their archive copies were reconstructed by reversing the known edits.

**Verification.** `./dev/tests/run_all.sh` — 74 passed, 0 failed, 2 disabled.
`gui_crud_test.js` in a real browser, the modality that found this pair: **35
passed, 2 failed**, up from 31/6. D0b, D0c, D2 and D4 all green; the two
remaining are A4 (B-177) and C2 (B-176), untouched and still open.

---

## The GUI guard's one dependency lives outside the repo (2026-08-31)
**Version:** v3.14.342 · **Type:** chore · **Archives:** `dev/archive/changes/gui_deps_outside_repo/` (v3.14.341)
**Touched:** dev/tests/_gui.js · dev/README.md

**What changed.** `_gui.js` resolves playwright from outside the tree before it
looks inside: `$LINGCOT_PLAYWRIGHT`, then `~/.lingcot-dev/node_modules`, then
`npm root -g`, with ordinary resolution tried first so a local install still
wins. When none holds it exits 2 and prints every path it tried.

**Why.** This repo has no `package.json` and no `node_modules` — every guard but
this one runs on Node builtins, and a clone needs nothing installed. Requiring
`npm i -D playwright` would have put 19 MB of `node_modules` in the tree and a
`.gitignore` line to hide it, to serve one guard that is not in the default run.
The browser was never the problem: playwright caches it per MACHINE, in
`~/Library/Caches/ms-playwright`, shared across projects and downloaded once.

**Guard.** Both branches exercised by hand: with bare resolution blocked it booted
from `~/.lingcot-dev`, and with nothing installed anywhere it exited 2 listing all
six paths. The second DISABLED message — browser missing rather than package
missing — was reached and names the exact executable path.

**Verification.** `node dev/tests/doc_integrity_test.js` — 52 passed, 0 failed.
`./dev/tests/run_all.sh` — 73 passed, 0 failed, 2 disabled.

---

## B-175 to B-178, opened by the first GUI-modality run (2026-08-31)
**Version:** v3.14.341 · **Type:** chore · **Archives:** `dev/archive/changes/gui_modality/` (v3.14.340)
**Touched:** dev/BUGS.md · dev/audits/AUDIT_INDEX.md · dev/audits/GUI_MODALITY_2026-08-31.md (new) · dev/tests/_gui.js · dev/tests/gui_crud_test.js
**Examined:** LingCoT v3.14.340 driven headlessly through dev/tests/gui_crud_test.js
**Filed:** B-175, B-176, B-178 (S2) · B-177 (S3)

**What changed.** `dev/audits/GUI_MODALITY_2026-08-31.md`, and four entries in
BUGS.md — 11 open → 15. The Guards blurb's numbers were 75 of 76 and "for 71";
they are 75 of 77 and 77.

**Why.** 35 checks, 31 passed, 6 failed, and the six are four defects: the section
delete button matches a class nothing renders (B-175); a word gloss cannot be
cleared because the empty field means *derive from the morphemes* (B-176);
`fold:` is declared five times and read nowhere (B-177); `merge` mutates the
document before Save while its sibling `del` waits for one (B-178). B-175 and
B-178 are the same asymmetry in one handler and should be settled together.

**Type is `chore`, not `finding`.** `doc_integrity_test.js` is explicit that a
finding writes up its audit *and nothing else*; a version that also opens bug
entries is a fix or a chore. The `**Examined:**` line is kept because the
provenance is the point.

**Withdrawn before filing.** The same run also reported B-146 and B-147 as open.
Both were fixed at v3.14.284; the guard had been pointed at a copy of `source/`
taken earlier that day. Caught because filing needs a `B-nnn` and BUGS.md already
had them. Audit §4; the follow-up is to make `_gui.js` print the version it ran
against.

**Guard changes in the same version.** `_gui.js` now prints the app version it
drove, closing the audit's §4 follow-up. `gui_crud_test.js` dismisses the
new-corpus autosave prompt: B-147's fix restored it, and its backdrop swallows
every click behind it, so the guard written against the broken build could not run
against the fixed one.

**Verification.** `node dev/tests/doc_integrity_test.js` — 52 passed, 0 failed.
`./dev/tests/run_all.sh` — 73 passed, 0 failed, 2 disabled. Each of the four
traced to its line of source before being filed.

---

## A third guard modality: the app in a real browser, asserting on files (2026-08-31)
**Version:** v3.14.340 · **Type:** chore · **Archives:** `dev/archive/changes/gui_guard/` (v3.14.339)
**Touched:** dev/PRACTICES.md · dev/README.md · dev/tests/run_all.sh · dev/tests/_gui.js (new) · dev/tests/gui_crud_test.js (new)

**What changed.** `dev/tests/_gui.js` runs `LingCoT.html` in headless Chromium and
supplies `window.pywebview.api` backed by a real directory; `gui_crud_test.js` is
35 checks over input modalities, edit, deletion and the save→open round trip, each
of the shape *act through a control → press Save → read the FILE → compare*. Both
are in `SLOW`, so the default run is unchanged at 75. PRACTICES §6 gains the
three-modality table and rule 11; the §6 counts were 70/69/67 and are now 77/75/73.

**Why.** `_dom.js` says so itself: a stub that exists so evaluation and the
renderers can run, where the thing caught is an exception. Nothing in the suite
could ask whether a control puts the right bytes on disk. Its first clean run
against v3.14.340 is **31 passed, 6 failed** — four live defects, B-175 to B-178,
in three classes the other two modalities cannot see. See v3.14.341 and
`dev/audits/GUI_MODALITY_2026-08-31.md`.

It also re-found **B-146 and B-147 on a stale snapshot of `source/`** and they had
to be withdrawn. That is the guard's own hazard and worth stating: it reads the
working tree at the moment it runs, so a stale copy reports fixed bugs as open.

**Guard.** It is the guard. Verified against its own known-bad: the D-scenario's
first draft passed while the delete button did nothing, so D0b/D0c now assert the
app **asked** before asserting what it did (§7's lesson from the other end).

**Verification.** `./dev/tests/run_all.sh` — 73 passed, 0 failed, 2 disabled,
`gui_crud_test.js` and `nllb_diag_test.py` reported NOT RUN with their reasons.
`node dev/tests/doc_integrity_test.js` — 52 passed, 0 failed. The guard itself:
31 passed, 6 failed, 45.4 s against v3.14.340, every failure traced to a line of
source before being called a defect.

---

## The audit, DEV_PLAN and BUGS after the dead-code pass (2026-08-31)
**Version:** v3.14.339 · **Type:** chore · **Archives:** `dev/archive/changes/docs_after_dead_code/` (v3.14.338)
**Touched:** dev/audits/UNIFIED_AUDIT.md, dev/DEV_PLAN.md, dev/BUGS.md

Seven findings closed across v3.14.337–338 — L-018, L-025, L-026, L-028, L-029,
L-037, and L-019's matcher half — moved to §5's ledger with what each leaves
behind. The audit is **13 open and 2 half, from 23**; §2.6 is empty but for the
disposition of the twelve audits, and §2.5 is down to the fixture and the
mutation score.

**Two counting errors were found and fixed while doing it, and they are the same
one twice.** Closing a finding means removing its board row, removing its body,
and adding a ledger row — and the ledger insert anchors on `| **L-034** |`, which
occurs in the BOARD first. So v3.14.335's and v3.14.336's ledger rows for L-031,
L-032 and L-033 were written into the board, where they sat as closed items under
a heading that means outstanding. That is §9's second entry exactly — *a closed
item under a live row, which is what the count is read from* — committed twice
more by the versions that closed those findings.

**So the counts are now derived, not asserted.** Verified by walking the file:
the board holds 15 findings and 5 conflicts, and its 15 are exactly the 15 bodies
in §2; the ledger holds 29; 15 ∪ 29 is 42 distinct with L-007 and L-021 in both,
being half closed. 27 closed + 2 half + 13 open = 42.

**Verification:** documentation only, no code changed. `run_all.sh` 73 pass, 0
fail, 2 disabled; `--slow` 74. `doc_integrity` 52/52.
---

## L-018, L-019, L-037: two guards that discarded their own work, and a mark nothing set (2026-08-31)
**Version:** v3.14.338 · **Type:** chore · **Archives:** `dev/archive/changes/guards_and_translation_marks/` (v3.14.337)
**Touched:** source/LingCoT.html, source/LingCoT.css, dev/tests/undefined_call_test.js, dev/tests/search_b_routing_test.js, dev/tests/render_untranslated_test.js, dev/tests/annotation_gaps_test.js, dev/audits/UNIFIED_AUDIT.md
**Closed:** L-018, L-037 · L-019 half

**L-037: the paragraph view says which translations the app wrote.**
`.sent-card .trl.derived` had been in the stylesheet since B-002 with nothing
emitting it — the intent recorded and never built, while the surface where
translations are reviewed in bulk showed a machine's and a person's identically.
`sentTrans` returned the TEXT, so no reader could ask; `sentTransEl` returns the
element, whose stamp is where a list field's provenance lives (B-138).

**Setting the class showed the rule was also wrong.** `.trl` is already dim and
italic and `.trl.empty` is `--text-muted`, so "derived" as written was
indistinguishable from *no translation at all* — dimming means ABSENT on that
card. It takes D43's `·auto` mark instead, which is the app's existing vocabulary
for exactly this, plus the provenance tooltip.

**L-018: a guard that did its work and threw it away.** `undefined_call_test`
proved it could fail against an archived pre-fix copy, and `dev/archive/` is
gitignored — so on **every clone** it analysed 500-odd functions and then exited
2 as DISABLED. `analyse` is a pure function of a string, so the proof needs no
historical file: five constructed sources now, one that must be reported and four
that must not, which is the half a single positive case leaves unguarded. It also
gained a check that no allowlisted name is a defined function — **and that
immediately found `buildLatexGb4e`**, allowlisted and real, silencing nothing and
outliving its reason.

**L-019: split by file, because a file has one state.** The two Korean guards
disable themselves whole, and the audit measured that 5 of 15 matcher and 4 of 17
concordance assertions never look at the language. `run_all.sh` reports one state
per file, so a guard running four of seventeen can only lie in one direction —
claim to have checked the matcher, or discard four real results. The routing and
validation half is now `search_b_routing_test.js` against a **synthetic** corpus,
which makes it independent of the fixture set for good, including of the gate-1
swap. It carries a control assertion — the engine must actually hit on that
corpus — because otherwise "no hits" is true for the wrong reason, which is the
degenerate pass B-125 fixed in `dep_root_test`. **The concordance half is left**:
its portable share is thin and entangled with the goldens, and D58 §4.2 already
decides both guards re-point at Mandarin at the swap.

**Mutation-tested:** the `<BREAK>` validation removed, the empty-query
short-circuit removed, and the engine detached from the corpus — each fails by
name, the last one through the control.

**Verification:** `run_all.sh` 73 pass, 0 fail, 2 disabled (76 executables).
`doc_integrity` 52/52.
---

## Dead code and dead documentation — L-025, L-026, L-028, L-029 (2026-08-31)
**Version:** v3.14.337 · **Type:** chore · **Archives:** `dev/archive/changes/dead_code_and_docs/` (v3.14.336)
**Touched:** source/LingCoT.html, source/LingCoT.css, source/modules/search.js, source/modules/events.js, source/modules/participants.js, dev/tests/affordance_test.js, dev/BUGS.md, dev/audits/UNIFIED_AUDIT.md
**Closed:** L-025, L-026, L-028, L-029 · **B-174** filed and fixed

**A dead-code pass found a live bug, which is L-029's own lesson repeating.**
`#app-name` was on two elements — the header's title block and the annotator
preview panel's span — and `getElementById` returns the first in document order.
So `showAnnPreview` replaced *"LingCoT / Linguistic Corpus Toolkit"* with the
annotator's name, for the rest of the session, and left the panel's own span
empty. Filed and fixed as **B-174**. The audit recorded this as "the second block
silently shadows the first's font and colour"; the shadowing was the harmless
half.

**L-029, and the numbers were re-derived rather than trusted** — the audit's own
warning is that an unverified dead-code report is two thirds noise. My own first
list was 24 classes; four survived checking. `help-h`, `help-kv`, `help-list` are
emitted from **locale strings**, and `help-table` was kept with them: help is
built from data a translator can extend, so its CSS is not dead the way an
app-emitted class is. `tall` was a substring match on "install". **30 rules
removed** across 20 classes and 3 ids, plus `SENT_PUNCT`. `.igt-t-trans` is worth
naming: a near-miss of the live `.igt-t-translit`, which is the dangerous kind —
a reader would think it styles the column.

**A guard was holding dead CSS in place.** `affordance_test` asserted
`.edit-badge-dict is defined`; nothing has emitted it since D51 retired the
dict-add surface. It now asks the question that would actually break — every
badge variant the stylesheet defines is emitted — and gained the id check that
would have caught B-174, scoped to the markup outside `<script>` so a render's
mutually exclusive branches are not reported as duplicates.

**L-025**: `search.js`'s header named two runners that do not exist and promised
a prune that had already happened; two banner comments described pruned
functions; a full algorithm description survived three deleted ones. And three
`@fn` markers had no function under them — `autolink_test` attributes code to
the nearest preceding marker, so an orphan hands the next block to the wrong
name and the guard cannot fail. A third turned up while restoring: `sentTrans`
was marked twice. 2 KB out of `search.js`.

**L-028, measured before and after** on `chinese-test`: `annotationGaps()` cold
1.42 → **0.927 ms**, `gapRows()` cold 2.68 → **1.555 ms**, and — the larger win —
`gapRows()` repeated went to **0.156 ms** because the memo now hits. It held one
slot and the panel asks twice with different signatures, so each call evicted the
other and every repaint paid the full walk twice. Two slots keyed on `_dataGen`,
and the per-level field-table lookups hoisted out of the per-record loop.

**L-026**: two of three copies of the debounce said 1.5 s and one said the timer
precedes a disk write. It is 400 ms and it precedes a journal append. The two
remaining mentions are historical narrative and correct as written.

**One mistake worth recording.** The first `SENT_PUNCT` removal used
`rindex('/*')` to find its comment and deleted from there — swallowing
`wordGloss` and `wordTranslit`. Five guards went red at once, which is the suite
doing its job; restored from the pre-edit archive and redone with exact anchors.
A deletion script that searches backwards for a boundary is guessing.

**Verification:** `run_all.sh` 72 pass, 0 fail, 2 disabled. CSS re-parsed after
the deletions — every chunk between braces holds exactly one block, and the two
that do not are `@keyframes`. `doc_integrity` 52/52.
---

## B-171: one door into a loaded corpus (2026-08-31)
**Version:** v3.14.336 · **Type:** fix · **Archives:** `dev/archive/changes/b171_one_corpus_door/` (v3.14.335)
**Touched:** source/LingCoT.html, dev/tests/corpus_load_test.js, dev/BUGS.md, dev/audits/UNIFIED_AUDIT.md
**Closed:** B-171 (S1) · UNIFIED L-033

**The last S1.** `replayJournal` was called from one place and `handlePath` — the
header Dictionary button and the companion banner's Load — was not it. A corpus
opened that way held a tree without its journalled records, and `compact()`
writes the base from the tree and *then* truncates the journal, so the next save
wrote them out of existence.

**Not by copying the four lines across.** Two doors into one act is the shape
this project keeps filing — B-058's two save tails, B-030's five callers of a
"single writer", and `mutate`'s own comment that a shared writer every caller
must remember to invoke is not shared. `loadProjectFromPath` is the dispatch now;
`handlePath` owns its error message and `openCorpusDialog` owns the dialog and
its staged `_stage` reporting, which is the part that was genuinely each
function's.

**A second disagreement turned up in the merge, and it went the other way.**
`open_project` derives its paths from a filename's role suffix, so a corpus named
by hand — `mytext.jsonl` rather than `mytext_corpus.jsonl` — came back with an
empty `corpusText` and its own name in `missing`, which `checkMissingFiles`
treats as a hard abort. `handlePath` could open such a file because it read the
file itself; `openCorpusDialog` could not open one at all. The loader reads the
picked file first and treats it as the corpus whatever its name, taking only the
companions from the bundle — so the permissive door's one real advantage
survived rather than being lost to the tidy-up.

**The guard is executed**, because the claim is behavioural: a corpus loaded
through the door the annotator actually uses comes back carrying what the journal
held. `corpus_load_test.js` (new, 12 checks) stubs the two Python methods the
loader asks for, loads a one-word corpus with a journalled part of speech, and
asserts it is on the tree. It also asserts a hand-named file loads, that a
journal from another base is refused **and said out loud**, and — structurally,
so a third door cannot be added quietly — that `applyCorpus` has exactly one
caller and that caller replays.

**The trick worth keeping**: the pywebview stub is attached *before* the app is
loaded. `_pwReady` resolves immediately when `window.pywebview` is already there
and otherwise waits on an event the harness cannot fire, so attaching it
afterwards leaves every `await _pwReady` hanging for ever — a test that reports
nothing rather than failing, which is worse than a red one. The first draft did
exactly that and printed one line.

**Mutation-tested**: the defect restored (4 named failures), the `missing` filter
removed (1), the base-mismatch check removed (3).

**Verification:** `run_all.sh` 72 pass, 0 fail, 2 disabled (75 executables).
`doc_integrity` 52/52. **No S1 open.**
---

## B-172 and B-173: two values the record attributed to the wrong author (2026-08-31)
**Version:** v3.14.335 · **Type:** fix · **Archives:** `dev/archive/changes/b172_b173_provenance/` (v3.14.334)
**Touched:** source/LingCoT.html, dev/tests/word_edit_pos_test.js, dev/tests/push_to_dict_test.js, dev/BUGS.md, dev/audits/UNIFIED_AUDIT.md
**Closed:** B-172, B-173 · UNIFIED L-031, L-032

**B-172: the seed is a placeholder now.** It used to fill `value=` while
`data-original` kept the stored value — empty — so `_mStamp` saw a change on
save and wrote `prov()`. Saving any multi-morpheme word put `AFFIX` on every
non-initial morpheme and recorded a person as having decided it, and because a
non-empty value counts as filled, D34's panel then reported those fields done.

**Measured, and that settled the design question rather than argument.** In
`chinese-test` the two non-initial morphemes carry **ADJ** and **NOUN**, type
`word` — compound members, not affixes. "Non-initial means affix" is false in the
second of the two shipping sample languages, which is the `POS_VISIBLE_MORPH` and
`inferPos` pattern exactly. The `type` field twelve lines below already followed
the right rule and says so in its own comment: *a fact about the language is not
a position in a string.* POS follows it now — the suggestion still shows, greyed,
and the existing chip row accepts it in one click, but nothing is stored until
somebody does. One rule, no special case for position 0: a nominalised verb is
the ordinary reason a stem need not share its word's part of speech.

**B-173: a push stamps what it writes.** The existing-entry branch wrote
`existing[f] = c[f]` and nothing else while `linkTo` on the next line stamped the
link, so an entry another annotator curated acquired a gloss and a part of speech
still attributed to its original author. Every filled field now carries a field
stamp, the entry gets an object stamp and a trail entry, and the lemma — equally
unattributed — is stamped too. **The pusher's own `prov()`, not derived**, and
the asymmetry with the link is the decision: they saw these values in D51's
panel, which names the fields it will fill, and ticked the row. A person decided
the values; the link is derived because `linkTo` resolved which entry by form
match, and nobody chose that.

**Guards.** `word_edit_pos_test`'s seven B-071 assertions were rewritten rather
than deleted — the rule changed by decision, and each now states the new one and
why. `push_to_dict_test` gained three: a fill is stamped, a lemma-only fill is
stamped, and **a push that fills nothing stamps nothing**.

**Mutation-tested, five ways, and the fourth mattered.** Removing the object
stamp survived the first draft because the test word carried a lemma, and the
lemma branch stamps the object too — masking the missing stamp on the fields
branch. Split into a lemma-free case and a fields-complete case, each of which
can only be satisfied by the branch it names. All five fail by name now.

**Live effect:** no existing data changes — 0 non-initial morphemes lack a part
of speech in either corpus. The two Chinese compound members that carry ADJ and
NOUN are the evidence the seed was wrong, caught by hand at the time.

**Verification:** `run_all.sh` 71 pass, 0 fail, 2 disabled. `doc_integrity` 52/52.
---

## UNIFIED_AUDIT reorganised by subject (2026-08-31)
**Version:** v3.14.334 · **Type:** chore · **Archives:** `dev/archive/changes/unified_audit_reorg/` (v3.14.333)
**Touched:** dev/audits/UNIFIED_AUDIT.md

**The problem was the filing order.** Findings arrived in three waves — the
original lines at v3.14.221, the code audit at v3.14.313, the fill/UI/backend
pass at v3.14.333 — and were filed in that order, so the same question lived in
three sections: provenance was L-027 in §6, L-031 and L-032 in §7, and the
conflict that pairs with it in §4.1. A reader asking "what is open about X" had
to read the whole document.

**Now: §1 a board of all 30 open items in one ranked table, then §2 the bodies
grouped by subject** — provenance · fill and timing · references and integrity ·
the annotator's view · guards and fixtures · cost, documents and dead code. The
`L-nnn` ids are unchanged and each keeps the line it came from, which is why the
line was a field and not part of the id.

**Compression came from removing duplication, not from cutting instructions.**
§5's ledgers held all 42 findings and all 18 conflicts while §1 and §2 held the
open ones again — the ledgers are now the 19 closed and the 13 settled, which is
also one fewer place to keep in step. Three findings still carried a superseded
body under "the original finding follows" after a re-check had replaced it
(L-007, L-018, L-021); those bodies went to the archive, the same rule a closed
finding already followed. Seven paragraph-length "done" rows in the combinable
table became one line each, as that table's own caption already required. Three
"checked and correct" lists and three "could not do" lists merged into one each,
ordered by subject, later measurements superseding earlier — the dangling-
reference count now appears once, at v3.14.333, rather than twice with different
answers.

**73.4 KB → 72.0 KB, and that is the point rather than a disappointment**: 46% of
the document is the 25 open bodies and 10% the five live conflicts, and those are
the instruction for outstanding work. What was removed was repetition; what was
added was navigation.

**Counts now say where they came from.** Each is computed from the table that
holds the rows — the board for open, the ledgers for closed — because v3.14.314
changed two states and miscounted the header by one in the same edit. Verified:
19 + 23 = 42, 13 + 5 = 18, and the board's 30 rows are the 23 open findings plus
the five live conflicts and the two half-closed.

**Verification:** documentation only, no code changed. Bodies were extracted and
reassembled programmatically rather than retyped, so no open finding could lose a
line in the move. `doc_integrity_test` 52/52.
---

## The fill, UI, backend and timing audit — UNIFIED §7 (2026-08-31)
**Version:** v3.14.333 · **Type:** chore · **Archives:** `dev/archive/changes/audit_fill_ui_backend_logic/` (v3.14.332)
**Touched:** dev/audits/UNIFIED_AUDIT.md, dev/audits/ANNOTATION_FILL_AUDIT.md, dev/BUGS.md
**Filed:** B-171, B-172, B-173 · **Findings:** L-031 to L-042

Four passes over v3.14.332: what the app writes on its own, whether the
annotator can see it and choose, whether the references hold, and whether the
direction and timing suit a session. Full write-up in UNIFIED_AUDIT §7.

**Three became bugs the same day.** **B-171 (S1)**: `replayJournal` is called
from one place, and `handlePath` — the header Dictionary button and the companion
banner's Load — is not it, so a corpus opened by that door loses everything since
the last compaction at the next save. **B-172 (S2)**: the morpheme POS box is
seeded `AFFIX` by position while `data-original` stays empty, so saving a word
writes a part of speech nobody chose and stamps a person as having chosen it —
sharper than B-165, and in the one field the app declares off-limits to
inheritance. **B-173 (S2)**: filling a shared dictionary entry writes no
provenance at all, while the link written three lines later does.

**The largest finding is not a bug (L-034).** Measured independently over both
corpora: **135 of 310 glossed-token decisions are re-decisions of a form already
decided**, and ~90% of recurring forms take one gloss throughout. The session log
shows `bir` edited three times — 32 s, 101 s, 129 s — for three identical
results, the later two costing more than the first. Every piece of a
form-at-a-time pass exists (the folded form index, `parseSegmentState`'s
ambiguity line, `linkTo`'s refusal, the `derived` stamp, `_fillMorphRows`' mode
switch) and D40 specced it; it was never assembled.

**L-042 corrects a number this project has been quoting**, including in these
entries: 71 pass is true of `samples/` and not of the live corpora, where
`session_panel_test` fails 2 because `turkish-test` carries `metadata.tracked`.
Same class as B-168. D58 §2 already strips it at the swap.

`ANNOTATION_FILL_AUDIT.md` §1 was marked superseded in part — five of its rows
are now false, each named, with what replaced it.

**Verification:** documentation only, no code changed. Five load-bearing claims
were re-verified first-hand before being written down, because L-029 is this
audit's own record of a finding that was wrong in two ways. `doc_integrity_test`
52/52.
---

## B-162: the progress panel scrolls (2026-08-31)
**Version:** v3.14.332 · **Type:** fix · **Archives:** `dev/archive/changes/b162_gap_panel_scroll/` (v3.14.331)
**Touched:** source/LingCoT.css, dev/tests/session_panel_test.js, dev/BUGS.md
**Closed:** B-162

**My own regression from v3.14.319.** `#gap-panel-box` took the shared modal rule
— `overflow: hidden`, no height — which is safe for its three neighbours only
because each holds a fixed number of rows. This one's height is a function of the
field table and of how many fields the annotator tracks, so the tracking toggle's
~13 untracked rows put the fold past the viewport. And a centred box grows off
BOTH edges: `translate(-50%, -50%)` pushed the header off the top, so there was
nothing left on screen to scroll with even if it had scrolled.

`max-height: 82vh`, and the BODY scrolls rather than the box — a close button
that leaves with the content makes a panel a trap. `min-height: 0` on the body,
because a flex child will not shrink below its content by default, which is the
usual reason an `overflow-y` inside a flex column does nothing.

**The guard inverts the burden rather than naming the offender.** Every id on the
shared rule must declare a max-height, or be listed as fixed-content with the
reason it is. A box added to that rule without being classified fails here,
instead of waiting for someone to open a fold on a large corpus. Its exemptions
are checked back against the rule, so one left behind after its box is gone fails
too. The rule is found by what it does — a multi-selector rule setting
`position: fixed` and clipping — not by its literal text, because a guard that
matched the selector string would break silently in the direction of passing.

**Mutation-tested**, five ways: the max-height removed, the body's scroll
removed, an unclassified box added to the rule, an exemption left stale, and the
rule's `overflow: hidden` dropped. Each fails by name with an actionable message.

**Verification:** `run_all.sh` 71 pass, 0 fail, 2 disabled. `doc_integrity` 52/52.
---

## B-163: `+ dict` on a morpheme, and the door out of the add panel (2026-08-31)
**Version:** v3.14.331 · **Type:** fix · **Archives:** `dev/archive/changes/d57_build/` (v3.14.330)
**Touched:** source/LingCoT.html, source/LingCoT.css, source/resources/locale/en.json, dev/tests/push_to_dict_test.js, dev/tests/form_render_test.js, dev/BUGS.md, dev/DEV_PLAN.md, dev/design/D57_morpheme_dict_route.md
**Closed:** B-163 · D57 built, all three stages

**§1, one line.** B-111's merge belongs to the SAVE panel, where a monomorphemic
word offering one lexeme as two ticked rows is the defect. `+ dict` names one
morpheme by index, so there is nothing to deduplicate — and hiding the only row
asked for left the panel with nothing to draw, which its bail-out read as a skip.
A merged row now hands off to the row it was merged into: the merge's own claim
is that they are one lexeme. B-148's carry made that lossless, as predicted —
the survivor arrives with the morpheme's `type`, `gloss` and `part_of_speech`.

**§2** splits the bail-out. No overlay is a missing element and the defaults
stand; no ROW is a bad question, and it warns. Sharing one line was half of
B-163: with nothing to draw, "take the defaults" means take nothing.

**§3, the door.** The panel was already honest — a stored field renders readonly
and the row says "will fill: none" — so the annotator could see and not fix.
`createEntries` stays fill-only, because an entry is shared and a push must not
replace what somebody curated; the row gets an **Edit entry →** instead, which
closes the panel (writing nothing) and opens the entry. `openAddDict` already
ended there, but only after committing to a write, which is too late to be a way
out.

**Measured, both live corpora, empty dictionary** — the state that makes the case
reachable at all: **134 `+ dict` links offered in Turkish, 182 in Mandarin, 0
dead clicks.** Before: 3 dead of 19 morphemes, every one a monomorphemic word.

**The guard is the lesson.** Its first draft reimplemented the selection inside
the test and asserted against its own copy, so replacing the handoff with
`row = row` restored the bug with every check green — caught by mutation. It now
loads `addDictForMorpheme` and stubs only its edges, asserting what it hands the
panel. Two further assertions were rewritten because they matched strings that
survived elsewhere in the same function. Five mutations fail by name.

**Verification:** `run_all.sh` 71 pass, 0 fail, 2 disabled. `doc_integrity` 52/52.
---

## B-164, B-165, B-166: the part-of-speech chain (2026-08-31)
**Version:** v3.14.330 · **Type:** fix · **Archives:** `dev/archive/changes/pos_chain_d55_b165_b166/` (v3.14.329)
**Touched:** source/LingCoT.html, source/LingCoT.css, source/modules/events.js, source/resources/locale/en.json, dev/tests/suggest_mechanism_test.js, dev/tests/morph_type_test.js, dev/tests/tag_control_test.js, dev/tests/linking_s1s3_test.js, dev/tests/word_edit_pos_test.js, dev/BUGS.md, dev/DEV_PLAN.md
**Closed:** B-164, B-165, B-166 · D55 built

**B-166 was re-diagnosed before it was fixed, and that is the entry's core.** It
was filed as "`backPropagate` forgot the part of speech". It did not forget:
ANNOTATION_FILL §1.1 and `suggest_mechanism_test` hold a deliberate rule — *a
morpheme takes a POS from a person or from an offer they took, never from a
lookup* — and the rule is right, because a gloss translates the lexeme while a
part of speech is a claim about this token in this sentence. **The gap was a
missing OFFER, not a missing inheritance.** The reasoning is in
`wordPosStripHtml`'s header, at the point of use.

**One predicate first (D55 §3).** `offerFillsNothing` read each input's value and
`mayFill` read `data-original` — two answers to *would this change anything*,
disagreeing on a seeded default. `offerWrites(entry, row, mode)` is the only one
now, used by the chip's appearance and by the click.

**D55: a take overwrites**, with a `mode` the spec had not foreseen — D53 stage
E's bulk parse fill uses the same writer, and one click there touches many rows,
which is B-122's lesson at scale. Bulk stays fill-only and names its mode at the
call site.

**B-165: every field an offer writes is marked and stamped.** Three literals
became one rule per input. The word-level half was worse: `part_of_speech` was
the one line in `saveWord`'s `stampFieldProv` literal with no `from:`, and the
guard hand-listed three fields, so removing it was invisible. **The guard takes
its list from the literal now** — the same shape as the bug it missed.

**Measured live:** 19 of 142 Turkish words lacking a part of speech are now
offered one, 11 of 203 Chinese — bounded by dictionaries of 14 and 12 entries,
and growing with the lexicon rather than with the code.

**Verification:** `run_all.sh` 71/0/2. Seven mutations, each failing by name; two
assertions were rewritten because they survived one — the hand-listed stamp
fields, and a regex for `seen.add(` that a one-chip-ever dedupe passed. Both are
executed now.
---

## Eleven part-of-speech tags, and the legacy corpora retired (2026-08-31)
**Version:** v3.14.329 · **Type:** feature · **Archives:** `dev/archive/changes/pos_tags_11/` (v3.14.328)
**Touched:** source/resources/pos_tags.json, source/resources/locale/en.json, source/LingCoT.html, dev/design/D58_fixture_set.md, dev/DEV_PLAN.md, dev/BUGS.md
**Decided:** no legacy parity, no legacy openability; `samples/turkish-test` retired

**CLF, PUNCT, NEG, COP, DEM, QUANT, CLASS, PREP, POSTP, DISC, IDEO** — 18 tags to
29, and **no code changed to accept them**. `pos_tags.json` is the declared
extension point and `schema_conformance_test` reads the file rather than
`LingCoT.html`'s defaults, so extending the file extended the guard:
`chinese-test` now conforms, 58 tag values in vocabulary and 0 outside. That
closes the gate-1 rehearsal's `CLF` finding.

Two descriptions were reworded because the additions made them false: `SYM` no
longer says "or punctuation" now that `PUNCT` exists, and `ADP` names `PREP`/
`POSTP` as the specific pair rather than claiming to be both. The embedded
`POS_CHOICES` fallback in `LingCoT.html` was regenerated from the JSON in the
same edit — it is the second writer of one list (PRACTICES §4) and exists only
for a missing resource file. `en.json` gained the eleven `pos.<tag>.desc` keys
`locale_key_test` derives from the resource file.

**No legacy parity, no legacy openability.** The archived corpora are not
required to keep opening, so D58 §3's deletion list is taken in full rather than
trimmed to protect a file somebody might want later. **`samples/turkish-test` is
retired, not migrated** — it was the only artefact arguing for any of it, and the
reason the audits kept describing a historical format as live. **No old corpus
enters `dev/tests/fixtures/`**: those specimens are purpose-built or
CLI-produced, which is the difference between a fixture and a keepsake.

**Sequencing, recorded because it would bite:** retiring it empties `samples/`,
and `_fixture.js` is built to fail loudly with no corpus — thirteen guards would
go red, correctly and uselessly. The retirement ships in the **same version** as
the replacement, never before it.

**B-027 stays open**, with the instance separated from the bug: the tag is added,
but the app still accepts any typed value, so `CONJ` and `affix` would be stored
today as they were. A larger inventory makes a typo likelier, not less. The open
half is now shaped — a save-time offer to add an unknown tag to the project's
`pos_tags.json`, through the mechanism that already exists. Detail in its entry.

**Verification:** `./dev/tests/run_all.sh` 71 pass, 0 fail, 2 disabled.
`schema_conformance_test` against `chinese-test` 2/2. `doc_integrity_test` 52/52.
---

## D58: the legacy readers are deleted, and the Korean guards become Mandarin (2026-08-31)
**Version:** v3.14.328 · **Type:** decision · **Archives:** `dev/archive/changes/d58_legacy_and_korean/` (v3.14.327)
**Touched:** dev/design/D58_fixture_set.md, dev/DEV_PLAN.md
**Decided:** D58 §3 (specimens), D58 §4.2 (Korean → Mandarin)

**The question that settles the legacy half: who produces that shape today?** Not
when it was written, which is what the word "legacy" invites. There are no users
and no corpora outside this repository, so a shape with no current producer has
no reader to protect — and keeping a broken corpus to exercise a reader nothing
writes is two dead things holding each other up.

**One answer inverted the plan.** `corpus_ingest.py` writes `record_type` but
**inline, uninterned `prov` and no `prov_events` line** — verified by running the
CLI, and `grep -rn "prov_events" source/scripts/` returns nothing. So the
uninterned shape is a *current input format*, not a historical one; it has been
standing in the audits as legacy only because the one file in it happened to be
old. Its specimen is therefore `cli_ingested/`, produced by running the shipped
CLI and regenerated when the CLI changes, which also closes SCRIPTS_AUDIT's
*"the fixture set is too narrow"* behind B-157.

**Deleted instead of specimened**, each checked for a producer: `isDocument`'s
`Array.isArray(r.sections)` fallback, the `type:'lemma'`/`record:'lemma'`
migration, the pre-D35 lemma model, `_migrateDictLegacy`'s `alternate_forms`, and
`parseRecords`' pretty-printed and concatenated scans — the only
`json.dumps(indent=2)` in the scripts writes `corpus_annotate.py`'s cursor file,
not a corpus. The `legacy` tier goes with them: 0 occurrences in all three
corpora. What must go too, or the deletion misleads the next reader:
`schema_conformance`'s `type:'lemma'` exemption, `prov_intern_test:457`'s runtime
`record_type` strip, `lemma_registry_test`'s legacy branch, and `field_spec.js`'s
`legacyKey` mechanism.

**This is the last moment deletion is free.** After `git init` and a testers'
build someone holds a file in an old shape and removing a reader is a breaking
change.

**Korean → Mandarin.** The two guards need non-Latin script and transliteration
labels, which Mandarin supplies. Goldens are **rewritten, not translated** — a
golden is a value someone checked by hand, and one carried across untested is
worse than a disabled guard. They stay dark until the swap rather than run
against a corpus they were not written for.

**Verification:** documentation only, no code changed. The CLI claim was executed
— a corpus ingested and its first line read. `doc_integrity_test.js` 52/52.
---

## D58: what the shipped test data contains (2026-08-31)
**Version:** v3.14.327 · **Type:** decision · **Archives:** `dev/archive/changes/d58_fixture_set/` (v3.14.326)
**Touched:** dev/DEV_PLAN.md, dev/BUGS.md, samples/README.md, dev/design/D58_fixture_set.md
**Decided:** D58 — the fixture set splits by audience
**Filed:** B-169, B-170

**The finding, from auditing guards, field table, designs and bug history against
all three corpora that exist:** `samples/` serves two audiences whose
requirements are opposite. A user should see a corpus worth imitating; several
guards need data no user should imitate — an empty dictionary (B-163 is
unreachable once a corpus is annotated once), a pre-interning file
(`isDocument`'s fallback, `splitEvents`' no-events path), dangling references,
an ambiguous form (B-122 wrote 76 of 77 links correctly *"only because no live
form was ambiguous — luck, not design"*). Every unresolved question in the audit
is that one conflict, and trying to satisfy both from one directory is why the
shipped fixture is in a format the app no longer writes (L-007).

**So `samples/` becomes exemplary and `dev/tests/fixtures/` holds specimens** —
small, degenerate on purpose, each named for the guard or bug it serves.
Precedent, not invention: `prov_intern_test:457` already strips `record_type` at
runtime to build a specimen in code because there was nowhere to put one.

**Measured gaps the replacement must close** — dependency parses with a root
(zero in both live corpora), a numbered homograph pair (8 duplicated forms in
`samples/` and `homograph` set on 0 of 32, which is how B-143 shipped), an
ambiguous form, and a multi-element list: the longest annotator-facing list in
any of the three corpora is **one** element, so D31 has never had a fixture.
Two corpora is load-bearing, not decorative — B-120, B-144 and B-027 were each
invisible in one of the two. Detail in the design record.

**Filed.** B-169: `variation_fields_test` builds its list from `samples/`
directly, so it is the one corpus-reading guard `$LINGCOT_TEST_CORPUS` cannot
redirect — the swap rehearsal silently does not cover it, and its
`includes('dictionary')` filter matches the `.b105-bak` files B-156 was about.
B-170: `schema_conformance_test` asserts no floor on objects examined, so a
one-document corpus prints two green lines having proved nothing — the
`dep_root_test` shape B-125 fixed.

**Verification:** documentation only, no code changed. Every number was produced
by walking the files, not recalled. `doc_integrity_test.js` 52/52.
---

## B-167 and B-168: what a toggle costs, and which corpus a guard reads (2026-08-31)
**Version:** v3.14.326 · **Type:** fix · **Archives:** `dev/archive/changes/b167_b168_fixture_paths/` (v3.14.325)
**Touched:** source/LingCoT.html, dev/tests/_fixture.js, dev/tests/journal_binding_test.js, dev/tests/journal_disk_test.js, dev/tests/journal_replay_test.js, dev/tests/annotation_gaps_test.js, dev/tests/fixture_resolve_test.js, dev/BUGS.md, dev/DEV_PLAN.md
**Closed:** B-167, B-168

**B-167, one word.** `setTracked` put the document deep, so one checkbox
journalled the whole tree — 123,229 chars in a real session. The shallow shape
already existed for this and carries the children's ids and order, so replay is
unchanged: `mutate('corpus', [{ rec: d, shallow: true }])`. The rule is in the
comment beside it.

**B-168, the resolver.** `requireCorpus(prefer)` was the first substring match in
a recursive sorted walk. Now shallowest wins — structural, not a claim about what
"archive" means — and **a tie fails**, naming every candidate, because picking one
is the same defect with a different sort order. `requireCorpusOrDisable` shares
it, so a guard cannot re-enable itself against a different corpus. The three
journal guards passed `'_corpus.jsonl'` to mean "any corpus"; that reads as a
choice and now resolves as one, so they say `requireCorpus(null, …)`.

**Guards.** `fixture_resolve_test.js` (new, 10 checks) builds real trees on disk,
because the defect was in how a walk, a sort and a substring compose. It pins the
post-swap layout **before** the swap and fails when a `prefer` string appears in
the suite it does not check — the check that makes a missed redirection
impossible rather than unlikely. `annotation_gaps_test` gained B-167's, asserted
on the journal record rather than the source.

**Mutation-tested.** Deep put restored → 3 named failures; `pickOne` reverted →
2, including the archived twin by name.

**The swap, rehearsed.** Gate 1 gained *The fixture swap, step by step*, and its
rehearsal was run: 5 guards fail against the candidate corpora, 4 of them
findings — no dependency parses, `CLF` outside `POS_CHOICES`, 2 dangling
`lemma_id`s, and `metadata.tracked` baked into `turkish-test` by one afternoon's
toggle. Detail in DEV_PLAN gate 1.

**Verification:** `run_all.sh` 71 pass, 0 fail, 2 disabled. `doc_integrity` 52/52.
---

## Where annotation time actually goes (2026-08-31)
**Version:** v3.14.325 · **Type:** chore · **Archives:** `dev/archive/changes/annotation_bottleneck/` (v3.14.324)
**Touched:** dev/BUGS.md
**Examined:** logs/app_2026-08-31_131943.log (one real 22-minute session, 11 words); gapRows() and per-field counts over both live corpora through the _dom.js harness; backPropagate; setTracked; requireCorpus resolution
**Filed:** B-166, B-167, B-168

**What was examined.** A real annotation session end to end, then the two live
corpora counted field by field through the app's own counter rather than by
reading the writers.

**What was found.** The bottleneck is **part of speech**, and the data has the
shape of the writer. `backPropagate` carries a gloss from the linked entry to the
token and does not carry a part of speech; nothing else supplies one. Result, on
both corpora: **85% glossed, 4–7% with a part of speech** — same corpus, same
annotator, same effort. The dictionary already holds the answer (14 of 22 Turkish
entries carry a POS, exactly as many as carry a gloss). **B-166.** D34's counter
had already ranked `word.part_of_speech` the largest live row on both corpora,
which is the counter doing what it was built to do.

Two smaller findings from the same pass. **B-167:** toggling one tracker checkbox
appended 123,229 chars to the journal — `setTracked` stores in `doc().metadata`
and `mutate`s the document, and D50's journal writes whole records. My own
regression from v3.14.319; the prior question is whether a per-sitting view
preference belongs in the document at all, which D51 §3 answered "no" for the
push's remembered habit. **B-168:** `LINGCOT_TEST_CORPUS` pointed at the corpora
root resolves `turkish` to `archive/turkish_test_corpus_old/` — 79 words — rather
than the live 153-word corpus. No guard is wrong, because their claims are
structural; but a measurement quoted from such a run names the wrong corpus, and
this session produced one before catching it. AUDIT_INDEX §7's rule with teeth.

**Session cost, for the record.** 11 words in ~16 minutes of editing, median ~58 s
per word. The four monomorphemic words took 22–34 s; the three that got a
morphological parse took 82–152 s. Parsing is 3–5× a bare token, which is where
D53's parse guide is aimed and where the next measurement should look.

**Verification:** documentation only, no code changed. Every number above was
executed, not read. `doc_integrity_test.js` 52/52.
---

## D57: the morpheme route into the dictionary, re-specced (2026-08-31)
**Version:** v3.14.324 · **Type:** decision · **Archives:** `dev/archive/changes/d57_morpheme_dict_route/` (v3.14.323)
**Touched:** dev/DEV_PLAN.md, dev/BUGS.md, dev/design/D57_morpheme_dict_route.md
**Decided:** D57 §1 the merge handoff, §2 the bail-out split, §3 the "Edit entry →" door
**Re-diagnosed:** B-163

**B-163's first diagnosis was wrong, and that is the entry's more useful half.**
It read `token pushed to dictionary (0 new entries)` in the session log and
blamed the push for being a silent fill-only upsert. That line is `_finishSave`'s
— the word-save checkbox — which opens the D51 panel and works. `+ dict` is
`btn.editor.morph_add_dict`, a different route. The log named which function ran
and the diagnosis matched the report to it by plausibility instead (PRACTICES §6).

**The real defect: five correct lines composing into a no-op.**
`addDictForMorpheme` selects the row whose `link` is that morpheme; B-111's merge
has marked it `mergedInto`; `visibleRows` drops it; `openAddDictModal`'s
no-overlay bail-out reads the empty draw as a skip; `openAddDict` finds no
`onSkip`. No panel, no write, no log line. **Measured against `turkish-test` with
an empty dictionary — the state a first session is in — 3 of 19 morphemes**:
`güneş`, `daha`, `ileri`, every one a monomorphemic word. It survived D51's six
stages because the column offers `+ dict` only when the form is absent from the
dictionary, so any check run against an annotated corpus passes while the bug is
present.

**Decided.** The merge belongs to the push, not to the model: a merged row hands
off to the row it was merged into, the merge's own claim being that they are one
lexeme (verified, 3 → 0; not a second seed path, which would restate B-069 and
B-068 — PRACTICES §4). The bail-out splits: no overlay stays silent, no drawable
row warns. And the instruction's second half — *see and fix* — is answered with a
per-row **"Edit entry →"** into `renderDictEdit` before the write, keeping
fill-only rather than making the panel a second entry editor (B-058's shape).

**Verification:** documentation only, no code changed. The claim was executed,
not read — `candidateRows` + `visibleRows` over both live corpora through the
`_dom.js` harness, with and without the proposed handoff. `doc_integrity_test.js`
52/52.
---

## D55: an explicit take overwrites; D56: undo is owed (2026-08-31)
**Version:** v3.14.323 · **Type:** decision · **Archives:** `dev/archive/changes/d55_take_overwrite/` (v3.14.322)
**Touched:** dev/DEV_PLAN.md, dev/BUGS.md
**Decided:** D55 (both halves of B-164), D56 raised
**Filed:** B-165

**D55, both halves, decided by the user.**

*The chip overwrites.* `mayFill`'s `data-original`-empty gate is B-082's rule for
a fill **the app performs on its own**, and D53's fill-only rule is about
automatic propagation. A click is neither: it is a person naming an entry. The
exposure is bounded, because `_fillMorphRows` writes to inputs and never to
`word.morphemes` — an unwanted take is undone by not saving, the same exposure as
typing over a field.

*`offer-taken` stays live.* Once a take can overwrite, "this row already says
everything the entry does" means "clicking writes the same values back", which is
harmless. `cursor: default` and `title.offer.agreed` describe an inert control
and must be reworded.

**Two things the decision obliges, both before or with the build.** The single
predicate (`offerFillsNothing` reads `.value`, `_fillMorphRows` reads
`data-original` — PRACTICES §4, and they already disagree on an app-seeded
default) is a prerequisite, not a follow-up: doing it after would build the
disagreement into a rule that now writes over saved data. And **B-165**, filed
here: `saveWord` stamps a changed gloss `derived` from `offerSrc` but stamps PoS
and type as the annotator unconditionally, so an overwriting chip would replace a
person's judgement with a dictionary's and sign it with the person's name.

**D56, raised by the user on deciding D55**: *"overwrite, but underlines the need
for an undo/rollback type mechanism."* The finding worth keeping is that the
substrate does not exist. The journal is folded and **emptied** on compaction;
`prov_history` records that a field changed and by whom, never what it was;
`data-original` is the only place a previous value lives and it lives there only
while the editor is open. Scope is the open question — undo the take (free, and
the act D55 introduces), undo the save (needs a real before-image), or a walkable
history (a different product).

**Verification:** documentation only, no code changed. `doc_integrity_test.js`
52/52; the BUGS.md severity counts are checked against the entries.
---

## Four UX reports from live annotation, diagnosed and filed (2026-08-31)
**Version:** v3.14.322 · **Type:** chore · **Archives:** `dev/archive/changes/ux_four_reports/` (v3.14.321)
**Touched:** dev/BUGS.md
**Examined:** four UX reports from live annotation of turkish-test: lemmaStripHtml exact branch (LingCoT.html:3560-3612), #gap-panel-box rules (LingCoT.css:183-187, 3012), the +dict push path (LingCoT.html:11836-11852) with logs/app_2026-08-31_131943.log lines 86/163, and takeOffer/_fillMorphRows/offerFillsNothing (LingCoT.html:3625-3790, 5443)
**Filed:** B-161, B-162, B-163, B-164

Four reports, four causes, no code changed — this version is the diagnosis.

**B-161 (S2)** `lemmaStripHtml`'s `exact` branch returns a verdict with no offers,
so `lemma-new` — B-114's door for *this is a different word, spelled the same* —
exists only in the `ambiguous` branch, i.e. only once two entries already share
the form. **B-162 (S2)** `#gap-panel-box` takes the shared modal rule with
`overflow: hidden` and declares no `max-height`; v3.14.319's untracked rows made
its fold unreachable — my own regression. **B-163 (S3)** `+dict` on a form the
dictionary already has creates nothing by design, logs the 0, and tells the
annotator nothing; the link that *did* happen is the sentence worth saying.
**B-164 (S2)** `_fillMorphRows`'s `mayFill` gate (`data-original` empty) is
B-082's rule for a *background* fill and refuses an explicit click too — the
entry link lands, the three advertised values do not, and `filled` reaching 1
suppresses the 'offer filled nothing' warning. `offerFillsNothing` answers the
same question from `.value` instead, so the chip's appearance and the click's
effect can already disagree on an app-seeded default (PRACTICES §4).

**Verification:** `doc_integrity_test.js` 52/52 (the severity counts in BUGS.md's
at-a-glance table are checked against the entries). No guard covers B-162's class
yet; BUGS.md names the rule one would hold.

---

## B-160 — an empty dictionary left the project unbound (2026-08-31)
**Version:** v3.14.321 · **Type:** fix · **Archives:** `dev/archive/changes/b160_empty_dict_binding/` (v3.14.320)
**Touched:** source/LingCoT.html · source/modules/events.js · dev/tests/project_files_test.js · dev/BUGS.md · dev/edit_log.md

**Reported from real use**, which is why it is worth more than the message
suggested: opening `turkish-test` said *"No dictionary loaded"* about a project
whose dictionary file sat beside the corpus and had just been read.

**Two questions, and both sites asked the wrong one.**
`applyProjectBundle` armed `_dictSavePath` **inside** `if (project.dictText)`, so
a 0-byte companion left the path unset — and an empty dictionary is the ordinary
state of a corpus somebody has started glossing before starting a lexicon. The
first entry created would then have gone through `chooseDictSavePath` and asked
for a location: **a project of four files silently becoming three plus a stray.**
`showCompanionBanner` had the same shape one level up, gating on
`S.dictionary.length` while saying "no dictionary loaded" — so it invited the
annotator to point the project at a foreign file.

**Bind on the FILE, apply on the CONTENT.** Whether a dictionary exists and
whether it holds entries are different facts with different consequences, and one
`if` was answering for both.

**The log said nothing**, and correctly: nothing failed. All three files loaded,
the app exited clean. This is the class of defect that only shows up as a
sentence on screen being wrong, which is why "run the app, read `logs/`" needs
the first half as much as the second.

**Guard.** `project_files_test.js` owns the four-name contract, so it owns this:
the path is armed from the file, armed *before* the content branch, assigned in
one place, and the banner asks whether a dictionary is bound rather than whether
it has entries. Three mutations, three named failures. **The guard's own first
draft sliced from `function openProject`, which does not exist** — it found
nothing and failed against correct code; it uses `fnSrc` now.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled;
`project_files_test` 54.
---

## B-159 — every container save reported as a removal (2026-08-31)
**Version:** v3.14.320 · **Type:** fix · **Archives:** `dev/archive/changes/b159_document_kind/` (v3.14.319)
**Touched:** source/LingCoT.html · dev/tests/session_panel_test.js · dev/BUGS.md · dev/edit_log.md

**What was wrong.** `_recordKind` resolved a journalled id through the four flat
indexes — words, sentences, dictionary entries, lemmas. Documents, sections and
paragraphs have none, so their ids fell through to `null`, and `null` is the
**removed** branch. `saveDocument` journals the document and its retitled
sections, so **retitling a corpus reported "removed 1"**, and had done since D34
stage D shipped at v3.14.308.

**The branch was right and its input was wrong**, which is why it read as
plausible: "an id that no longer resolves is removed" is a deliberate rule, added
so a record deleted by a path that journalled nothing is still reported. It
assumed every kind had an index.

**Fixed by walking rather than indexing.** `saveDocument` is the only route here,
so this runs a handful of times per save and never on a render; a fifth map to
keep in lock-step for a lookup nothing hot makes would cost more than it saves.

**Found by looking at the rendered panel, not by a guard.** Three assertions
covered the removal branch — a journalled `del`, an id that stops resolving, and
a false start — and **none asked what a container id does**. That is the shape of
a guard that tests the cases its author thought of; the new ones drive all three
container levels through `mutate` and check the kind that comes back.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled;
`session_panel_test` 52. One mutation, one named failure.
---

## D34 stage E — the tracker's fields are the annotator's (2026-08-31)
**Version:** v3.14.319 · **Type:** feature · **Archives:** `dev/archive/changes/d34_stage_e_toggle/` (v3.14.318)
**Touched:** source/modules/field_spec.js · source/LingCoT.html · source/LingCoT.css · source/resources/locale/en.json · dev/tests/annotation_gaps_test.js · dev/tests/session_panel_test.js · dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/edit_log.md

**D34 is complete.** A queue row carries an `×` that stops tracking it; the fold
carries a **Track** button beside every field that is not counted and its reason.
No settings screen, no switch bank, and the resting panel is unchanged — the
toggle is a move between two lists the panel already drew.

**The rule is pure and lives beside the table.** `resolveTracked(level,
overrides)` takes the overrides as an argument rather than reading app state, so
it is testable without a document. `trackedKeys()` is the single accessor and
both the counter and the panel go through it.

**Overrides are stored, never the resolved list** — a project that saved
`['word.gloss', …]` would silently fail to track a `core` field added next year,
which is the hand-written-list failure this project has removed four times.
`toggleTracked` also **cancels rather than accumulates**: a field returned to its
default leaves no override, because one restating the default is a claim about
the table that goes wrong when the table does.

**An override admits only trackable keys**, so a hand-edited file cannot make the
tracker count `field_prov`. And `document.tracked` is **declared** in the table:
it is a key on disk, and `schema_conformance_test` refuses undeclared ones — the
first save after this shipped would have written one.

**Nine mutations; three survived the first pass and all three were my
assertions, not the code.** Asserting only the `off` key let a resolved-list
store through; no case fed a junk override; and the "not a button in a button"
check tested adjacency, so it passed against markup nesting them three spans
deep. Rewritten, all three now fail.

**Found while looking at the rendered panel, not by a guard**: changing a setting
reported as *"removed 1"* in the session half. It predates this — `saveDocument`
has journalled the document since stage D and `_recordKind` never knew what a
document was, so **editing a corpus title has reported a removal since
v3.14.308**. Filed as B-159 and fixed at v3.14.320.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled;
`annotation_gaps_test` 76, `session_panel_test` 49.
---

## D34 stage E — the tracked set is the annotator's, not the table's (2026-08-31)
**Version:** v3.14.318 · **Type:** feature · **Archives:** `dev/archive/changes/d34_tracked_set/` (v3.14.317)
**Touched:** source/modules/field_spec.js · source/LingCoT.html · source/resources/locale/en.json · dev/tests/annotation_gaps_test.js · dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/edit_log.md

**Stage E arrived from the opposite side to the one the spec reserved it for.**
It expected "stop nagging me about this"; what came was "count this too", so the
marker is a **toggle**. Three corrections, all the annotator's.

**The script test stops deciding.** Asserting that a Latin-script language wants
no transliteration is wrong for a practical orthography with a phonemic line —
**the same error as the six typology constants D45 deleted**. It becomes a
default the annotator overrides.

**`source_ids` is `aux` everywhere.** It was `core` on a section and `aux` on a
document, so the panel nagged about sources on 6 sections while **both live
documents already recorded one**.

**The dependency parse is a row with no field.** `sentence.deps` declares
`filledWhen: 'hasDepParse'`, and the predicate is **read, not rewritten** — a
root stores `head === null`, so `'head' in w` is the test and a truthiness check
misses every root. Both corpora now report **22 sentences need a dependency
parse**: gate 1's blocker made visible.

**Bibliographic metadata is not trackable**, derived from `LEVEL_EXTRA_LABEL`
rather than from five field names — which is why `word.head` and `word.dep_rel`,
also `extra`, stay trackable.

**The surface is decided, not built.** A switch bank makes the resting panel two
live rows and eleven toggles — the ledger the queue was chosen over. The answer
is that **the panel already has both halves**: the queue is what is tracked, the
fold what is not, so the toggle is an `×` on a row and a **Track** button in the
fold. Resting view unchanged. Reasoning in `D34_session_tracker.md`.

**Guard.** `annotation_gaps_test.js` 59 → **74**, exercising a project's opt-in
through `countedKeys` — the door the stored override will use. Six mutations, six
named failures, including the truthiness rewrite of `depHasParse`, which fails on
the root case alone.

**A process failure, caught by the guard.** `en.json` was edited without being
named at the start, so no pre-edit copy was taken. Reconstructed by reversing the
five added keys and **verified by replaying forward to a byte-identical file**,
per PRACTICES — not filed as a post-edit copy under a `_pre_` name.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
---

## Combinable work re-checked; UNIFIED_AUDIT compressed 19% (2026-08-31)
**Version:** v3.14.317 · **Type:** chore · **Archives:** `dev/archive/changes/audit_compress/` (v3.14.316)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/edit_log.md
**Examined:** all 13 rows of §4.2 against the code; the whole document for material the project's own rules say should not still be in it.

**Five rows open, and each was verified rather than carried forward.** Row 2:
`renderWordEdit` is still hand-written. Row 6: **zero** references to any dirty
flag in `LingCoT.html` or `events.js`, so I5 is untouched. Row 10: D31's ▲▼
control does not exist. Row 12: `viewHeader()` has 19 call sites and **none in
`participants.js`** — B-115 closed the row's data half and did not close I13, and
the row now says so. Row 13: no `.git`, and `dev/archive/` is **224 MB** against
the 88 MB this row was written against.

**Two rows changed state on the evidence.** Row 5 is superseded rather than
pending — D33 retired, B-116 and B-053 closed, L-002 moot — and the synthetic
corpus nothing depends on was never regenerated. Row 11's gap has *widened*:
`samples/` now carries 26 `head` and 20 `dep_rel` against both live corpora's
zero, so the swap would delete more coverage than the row claims.

**Compressed by applying the document's own rule, not by cutting prose.**
*A closed finding is one row.* L-010 and L-014 lost their bodies to
`dev/archive/changes/`; §4.2's eight done rows went to one line each; §4.3's
measurements moved to L-018 and L-030, which carry the current ones, keeping the
reasoning that does not go stale — every proposed guard merge loses coverage,
tested by mutation rather than by reading headers, and the time the proposal
wanted came from a flag rather than from deleting assertions. §5 kept what it
established.

**71.8 KB → 58.5 KB, −19%, and no open item lost a line.** That is the whole
discipline: the instruction for outstanding work is the one thing this document
cannot afford to shorten, and everything removed was either closed or superseded
and is in the archive.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
---

## Every open finding and every live conflict, re-checked (2026-08-31)
**Version:** v3.14.316 · **Type:** chore · **Archives:** `dev/archive/changes/l_and_conflict_recheck/` (v3.14.315)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/edit_log.md
**Examined:** all 11 open findings, both half-closed ones and all 18 conflicts, against the v3.14.315 code and both live corpora.

**The sweep produced a bug.** L-029 reported `case 'sb-toggle'` as an unreachable
branch in `events.js`. It is in `search_b.js`, and it is not dead code — it is
the surviving half of a live break, three Search-B toggles that did nothing.
Filed and fixed as **B-158** at v3.14.315, and the entry withdrawn here.
**A dead-code finding that is really a broken-feature finding is the most
expensive kind to get wrong, because the proposed action is *delete the
evidence*.**

**Five conflicts, all still live**, each checked against the code: ⑥ the two
shipped word orders still differ and neither is L-013's · ⑦ `wantedMark` has four
sites and none is the word or morpheme surface · ⑪ no `.git`, `dev/archive/` now
**224 MB** (154 MB at v3.14.252, 88 MB when filed) · ⑫ the miscount survives only
in `file_layout_options.md:27-29` · ⑰ still a path exemption, but its resolution
is decided rather than open since v3.14.311. The four settled at v3.14.310 were
spot-checked and stayed settled.

**Open findings, confirmed with one correction each where the number moved.**
L-006's named hollow guard is fixed — `linking_s1s3_test.js` runs 123 assertions
through a `vm` — and the suite-wide score is still unmeasured, which is the half
that remains. L-018 is down to one clause: `undefined_call_test.js:252` still
exits 2 without `dev/archive/`. L-019's two guards still exit 2 for want of
Korean. L-021 holds and its figure moved: `samples/` now carries **26 `head` and
20 `dep_rel`** against 13 and 10 when filed, and both live corpora still carry
zero — so the swap would delete more coverage than the finding says, not less.
L-022 stands: ten documents still in `dev/audits/`, two retired.

**Header arithmetic corrected.** v3.14.314 changed two states and miscounted by
one in the same edit; the count is now taken from the table — **17 closed · 2
half · 11 open**. The lesson is small and worth the line: a count carried forward
by hand is a second writer of something the table already knows.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
---

## B-158, three Search-B toggles that did nothing (2026-08-31)
**Version:** v3.14.315 · **Type:** fix · **Archives:** `dev/archive/changes/b158_seg_action/` (v3.14.314)
**Touched:** source/modules/search_b.js · dev/tests/ui_wiring_test.js · dev/BUGS.md · dev/edit_log.md

**What was wrong.** `tog()` (`search_b.js:859`) emits `data-action="seg"`; the
dispatcher read `case 'sb-toggle'`. Nothing handled `seg`, so **Regex**, **Case**
and **Full-paragraph** were inert. `render()` runs after the switch whether or not
a case matched, so every click repainted the same state — the control looked like
it was refusing, not broken, which is why it survived. The CSS comment at
`LingCoT.css:2398` dates the rename: the segmented control "replaces
`.sb-group`/`.sb-toggle`". It reached the emitter and not the handler.

**How it was found, which is the part worth keeping.** The code audit's dead-code
pass reported `case 'sb-toggle'` as an unreachable branch and put it in
`events.js`. It is in `search_b.js`, and it is not dead code — it is the
surviving half of a live break. Re-checking the finding against the file rather
than the report is what turned "one line to delete" into "three controls that do
nothing".

**The guard stated the rule and applied it to eight instances.**
`ui_wiring_test.js` has said since D35 that *"a data-action with no case is a
button that does nothing"* — over a hand-written list of eight actions. That is
the list this project has removed three times elsewhere, and it cost exactly what
such a list costs. It now **derives** the set: every literal `data-action` any
renderer emits must reach a `case`, an `a === '…'`, a `ds.action === '…'` or a
`[data-action="…"]` listener. 76 emitted actions checked. Interpolated actions are
skipped and named as `id_sort_test`'s territory.

**Two mutations, two named failures**: reverting the fix reports
`data-action="seg"` emitted and handled nowhere, and renaming a live emitter
reports the new orphan. The guard would have caught B-158 on the day it was
introduced.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled;
`ui_wiring_test.js` 39 passed.
---

## L-010 and L-014 were closed in their bodies and open in their rows (2026-08-31)
**Version:** v3.14.314 · **Type:** chore · **Archives:** `dev/archive/changes/l010_l014_states/` (v3.14.313)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/edit_log.md

**Reported by the user, as a question about three findings.** Two of the three
were not open.

**L-010 ✅ moot v3.14.310** — its body has read *NO LONGER TRUE* since that
version, with the re-measurement in it: provenance is 9.2% of annotated-word
bytes on `turkish-test` and 14.0% on `chinese-test`, not half. **L-014 ✅
v3.14.309** — B-053 closed, and its body has said *half wrong, corrected* ever
since. Both rows still read **open**, and the header counted them.

**This is v3.14.310's own defect, committed while fixing it.** That version
removed conflict ⑧'s body because it sat under a heading reading "the nine still
live" after the table had ticked it, and wrote that *a closed item under a live
heading is worse than an uncorrected one, because the heading is what gets read*.
Then it added re-check notes to five finding bodies and changed none of their
states. Same shape, harder direction: a row is what the **count** is read from,
and the count is the first thing in the document.

**L-013 is genuinely open**, and its row now says what kind of open. The
correction it records is done — DEV_PLAN retired F5 on this evidence and states
the target order — but the reorder is deliberately not done, because the
observation is one session with one annotator in one language, and acting on n=1
is the mistake D34 exists to stop making with numbers. Gate 2's D46 is the second
pass. Its row also now points at conflict ⑥, which is the same subject from the
other side.

**Header: 30 findings · 16 closed · 2 half · 12 open.**

**What would have caught it.** Nothing does. `doc_integrity_test.js` checks that
a bug closed in the edit log is indexed in BUGS.md at the same version; there is
no equivalent for an audit finding whose body and row disagree. That is a real
guard, and it is cheap — parse the state column, parse the body for a verdict
line, fail when they differ. Filed as a note here rather than built, because the
audit is one document and a guard for one document wants a second instance before
its shape is decided.

**Verification.** Documentation only. `./dev/tests/run_all.sh` — 70 passed,
0 failed, 2 disabled.
---

## The code audit — six passes, measured (2026-08-31)
**Version:** v3.14.313 · **Type:** chore · **Archives:** `dev/archive/changes/code_audit_v312/` (v3.14.312)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md · dev/BUGS.md · dev/edit_log.md
**Examined:** `source/` in full — the app file, 8 modules, the CSS, the `.pyw` and the CLI scripts — plus all 72 guards, by six parallel passes against v3.14.312: dead code, comments, algorithmic cost, duplication, stylesheet, Python and suite. Filed as a chore rather than a finding because it also writes BUGS.md.

**Six findings, L-025 to L-030, in UNIFIED_AUDIT §6.** One bug filed: **B-157**.

**The one that matters is B-157**, and how it was nearly filed wrong is the
useful part. `corpus_annotate.py --translate` writes a machine translation with
no element-level `prov`, and `_humanField` reads element-level provenance for
list fields — so the app stores NLLB output as a person's work, and D34's counter
reports it as finished. The first pass filed that against `_humanField`. The
comment beside it says why the rule is what it is: *an element with no stamp
counts as human, because calling somebody else's unattributed work automatic is
the worse error.* **The app is right; the CLI has no way to say what it made** —
no Python writes `derived` at all. Trusting the code and not the comment would
have changed correct code to accommodate a broken writer.

**Two measurement lessons, both recorded in §6 rather than in the numbers.**
The growth harness first cloned the corpus without calling `buildCorpusIndex()`,
so `tally` could not resolve the new ids and every figure came back *smaller* at
20× the size. And the dead-CSS count went **78 → 58 → 31** as comments were
stripped and interpolated class stems checked: two thirds of an unverified
dead-code report is noise, so §6 states each count with how it was taken.

**L-028 is mine, from five versions ago**, and it is why the audit measured
rather than trusted: `annotationGaps()` re-derives the field spec per record, so
the tree walk is 10% of its cost, and `gapRows()` asks twice against a one-slot
memo — 1.42 ms and 2.68 ms at 212 tokens, 25.8 and 50.4 at 4,240. Not urgent;
both fixes local.

**The negative results are half the value.** Every renderer and every
per-keystroke path measured under 1 ms and flat across a 100× corpus; the
nested-scan candidates are already Maps; dark mode has no residue; no helper is
duplicated between the app file and a module; Python has no dead functions.
Recorded so nobody re-opens them.

**What did not finish** is in §3, not left to look clean: the bridge to the
machine dropped partway through every pass, costing eight sub-passes.

**Verification.** Documentation only, no code touched. `./dev/tests/run_all.sh` —
70 passed, 0 failed, 2 disabled.
---

## B-156 — `!samples/**` was broader than its purpose (2026-08-31)
**Version:** v3.14.312 · **Type:** fix · **Archives:** `dev/archive/changes/b156_samples_negation/` (v3.14.311)
**Touched:** .gitignore · dev/tests/gitignore_test.js · dev/BUGS.md · dev/edit_log.md

**What was wrong.** `.gitignore` line 23 ignores `*.b105-bak` — the pre-repair
backups, whose own comment says shipping them would put two versions of one
fixture in the repository, one of them known-wrong. Line 67, `!samples/**`, was
written to re-admit three fixture files and, naming a whole subtree, re-admitted
everything that lands there. A later pattern wins, so under `samples/` the
backups were not ignored: **three files, 72 KB, carrying 273 occurrences of a
participant name, would have gone into the first commit.**

**How it was found, which is the point.** `dev/tools/ship_disclosure.py` on its
first run — the gate-1 disclosure decided one version ago, run *before* `git
init` rather than after. Reading `.gitignore` would not have shown it: line 23 is
active, and inert only for a subset of paths. That is the same shape as the
v3.14.153 defect this file's header commemorates, and the reason the rule there
is **ask git, do not read the config**.

**The fix restates rather than narrows.** `samples/**/*.b105-bak` after the
negation, because `!samples/**` is doing a job and a cleverer glob that did both
jobs would be one nobody could read.

**Guard.** `gitignore_test.js` had 26 assertions asking `git check-ignore`
directly and no case for this path — a guard that could not fail for the thing
that was wrong. Two cases added, and the mutations prove both directions:
removing the fix fails on two backups being tracked, widening the new pattern
fails on all three fixtures becoming ignored. That second one matters more than
it looks: it is what stops the fix from being "improved" into one that deletes
the suite's own inputs.

**A note the disclosure also produced.** The names in that fixture appear in
`dev/edit_log.md` and two audits as well. Documentation is not a place a
filename-scoped check would have looked, which is the argument for the tool's
shape rather than a defect in itself.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled;
`gitignore_test.js` 31 passed.
---

## Conflict ⑰ decided — disclose what ships, do not exclude it (2026-08-31)
**Version:** v3.14.311 · **Type:** decision · **Archives:** `dev/archive/changes/ship_disclosure/` (v3.14.310)
**Touched:** dev/DEV_PLAN.md · dev/edit_log.md
**Examined:** `samples/` and both live corpora, counting where participant names actually occur; `.gitignore` and `hooks/pre-commit`; `gitignore_test.js`'s check-ignore technique.

**Decided.** `samples/` ships a participants file, because it is the file
structure a user will have — corpus, dictionary, participants, journal — and a
sample set missing one of the four teaches the wrong shape. Its contents being
non-genuine is a fieldwork decision, not one the repository can make for itself.
So gate 1 gains a **disclosure** run once before `git init`, and no exclusion:
no `.gitignore` rule, no allow-list, no pattern for what a synthetic name looks
like. A pattern would be a claim about what a real name can be, which is the
same kind of claim as `POS_VISIBLE_MORPH` and wrong for the same reason.

**A filename exclusion would have been the wrong instrument anyway, and the
measurement is why.** `samples/turkish-test_participants.jsonl` holds **3** named
records; the corpus and dictionary beside it hold **269 occurrences** of those
same names inlined in provenance — 205 and 64. A check scoped to
`*_participants.jsonl` would have read 3 records and missed 269 strings. Both
live corpora hold **0**, because interning thins provenance into `prov_events`;
`samples/` predates it. **That is L-007's fixture-format finding arriving from
the privacy side, and it means the gate-1 corpus swap fixes this by
construction** — the disclosure is what verifies that it did, rather than
assuming it.

**Shape**, specified in DEV_PLAN gate 1 and built as
`dev/tools/ship_disclosure.py`: ask git what would ship (`check-ignore` against a
scratch repo, not a hand-written list); take the search set from the data — every
`name` on every shipping `annotator` and `source` record — and count each across
every other shipping file. It reports; there is no pass.

**Deliberately not in `run_all.sh`.** A guard that reads participant data would
print it on every run and would become a guard that cannot fail the day the data
is clean. One disclosure before an irreversible act, to a terminal, never to
`logs/`. The sign-off is the `git init` entry's own `--examined` line, which is
what stops the check from quietly not having been run.

**Nothing built.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
---

## Every audit re-checked against the code (2026-08-31)
**Version:** v3.14.310 · **Type:** chore · **Archives:** `dev/archive/changes/audit_recheck_v309/` (v3.14.309)
**Touched:** dev/audits/UNIFIED_AUDIT.md · dev/audits/AUDIT_INDEX.md · dev/DEV_PLAN.md · dev/edit_log.md
**Examined:** all 16 documents in `dev/audits/`, every open item re-verified against the v3.14.309 code and both live corpora by six independent passes, each required to cite the command it ran or the line it read.

**What it found.** Of roughly forty items recorded open, **nine had already
shipped** and **six were true when written and are not now**. The shipped ones:
L-011 (B-123, v3.14.294), conflicts ⑧ ⑭ ⑮ ⑯, `inferPos`'s deletion, F2, F5, and
three of GUARD_MUTATION's five recommendations. The moved ones are measurements,
not reasoning — above all L-010, where interning did its job: provenance is 9.2%
and 14.0% of annotated-word bytes, not "half".

**Two failures worth naming.** UNIFIED_AUDIT ticked conflict ⑧ in its summary
table at v3.14.304 and left the body under a heading reading *"The nine still
live"* — the heading is what gets read. And `L_STATUS` and `UX_CLUSTER` each say
*Frozen* in their own headers while AUDIT_INDEX called both **LIVE**, one of them
for 56 versions. That is the index's own failure mode, one level up.

**What was edited, and what deliberately was not.** UNIFIED_AUDIT and
AUDIT_INDEX are live and were corrected in place: four closed conflict bodies
removed, L-002 and L-011 collapsed to rows, five open findings given dated
re-check notes, headers re-counted (**14 closed · 8 open · 5 live conflicts**).
The frozen audits were **not** touched — this project's convention since
v3.14.230 is that corrections to a frozen document live in AUDIT_INDEX §2, so
every sentence in it stays readable as written. Six new entries there, 32–37.

**The method note is the durable part.** Six corrections exist because a figure's
subject moved rather than because anyone reasoned wrongly: `DATA_INTEGRITY` and
`UX_CLUSTER` measured a corpus now sitting in `corpora/archive/`, and their
numbers reproduce there **exactly**. A measurement that does not name what it
measured goes stale silently. §7 records the rule for the next audit: the corpus
and the build belong in each table's caption, not in the document's header.

**Also corrected.** DEV_PLAN carried L-014's wrong pool ranking in gate 3, and
listed B-034 and B-051 as open bugs after both were closed. Its "Retired: F5" row
now records that half of F5 shipped as D53 stage E.

**Verification.** Documentation only, no code touched. `./dev/tests/run_all.sh` —
70 passed, 0 failed, 2 disabled.
---

## B-115 the Sources table sorts · B-053 measured and cached · B-051 closed (2026-08-31)
**Version:** v3.14.309 · **Type:** fix · **Archives:** `dev/archive/changes/b115_sources_sort/` (v3.14.308)
**Touched:** source/LingCoT.html · source/modules/participants.js · source/modules/events.js · source/LingCoT.css · dev/tests/ui_wiring_test.js · dev/tests/affordance_test.js · dev/tests/id_sort_test.js · dev/tests/suggest_mechanism_test.js · dev/tests/tag_control_test.js · dev/BUGS.md · dev/edit_log.md

**B-115 ✅.** The sources table sorts. Not by copying the annotators' sort block —
that is the divergence I13 is open about — but by extracting the three pieces both
need: `participantSort`, `participantTh`, `participantSortClick`, one `data-psort`
attribute, one delegated handler picking the state by view. Columns order **by
what they display**: a source's type renders through `srcTypeLabel`, so ordering
on the stored value orders by something no reader can see. The stylesheet's I9
comment explained its scoping by saying the Sources view has no sorting; that
reason is gone, the rule it names is not.

**B-053 ✅, after measuring twice.** The entry's absolute numbers never
reproduced, and its ranking had gone stale too: `AC_POOLS.gloss`, added
v3.14.303, costs **0.248 ms** against `pos`'s 0.034 — and it is the only pool
whose length is the corpus's rather than a fixed inventory's (207 rows against 18
and 9). The one edit it asked for went to the pool it turned out to be about,
memoised on `_dataGen` **and the locale**, since the hints are `t()` output.
0.248 → 0.003 ms warm. The cheap two stay uncached: a staleness class (B-011,
B-019, B-043) bought for 30 µs.

**B-051 ✅ at v3.14.257**, closed here. Fixed for 52 versions with nobody
updating the list; verified by running the command. It archives the named files
rather than refusing, the opposite of what the entry recommended — and right: a
`decision` that also edits a live document is the common case, three times in
this session alone.

**Guards.** `ui_wiring_test` executes the sorter; `suggest_mechanism_test` builds
the gloss pool and changes first the data, then the locale, because a cache here
fails one way — a key missing something the value depends on. `affordance_test`
**replaced** an assertion pinning the defect ("the sources table does not claim
to sort") with the rule under it: a header carries the attribute exactly when it
sorts. Six mutations, six named failures.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
Two guards failed mid-work and both were right: `undefined_call_test` on a local
holding a looked-up function, and `tag_control_test`, which lifts the gloss pool
into its own VM.
---

## D34 stages C and D — the progress panel (2026-08-31)
**Version:** v3.14.308 · **Type:** feature · **Archives:** `dev/archive/changes/d34_stages_c_d_panel/` (v3.14.307)
**Touched:** source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/modules/field_spec.js · source/resources/locale/en.json · dev/tests/annotation_gaps_test.js · dev/tests/session_panel_test.js (new) · dev/tests/locale_key_test.js · dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/edit_log.md

**What changed.** A `Progress` button in the header opens a panel with two
halves. **This session** (stage D): `_sessionNote` keeps the ids `_journalOne`
already computed and threw away; `sessionChanges()` resolves each through the
indexes at read time, so a record deleted after being edited reports as removed
rather than as a word. **Still to do** (stage C): `gapRows()` ranks the live rows
and collapses the settled ones behind one line that names each and why. Five live
rows on both corpora.

**Navigation is D30's, and stops where D30 does.** A row hands `navGo` its first
id; a morpheme row carries the WORD's id, once per word. Section and paragraph
rows are drawn without a destination — traversal covers words and sentences, and
inventing a second way to reach a section is what this spec keeps saying not to
do. Ids are collected only for rows that have somewhere to go.

**Three things only running it said.** *Loading is not editing* — `applyCorpus`
journals nothing, so the panel opens empty; that was true by luck until a guard
held it, and the mutation that breaks it is one `mutate('corpus', S.docs)` in the
load path. *A label is not a name*: the first render read "3 sections need a
source(s)", because `label.editor.sources` names a box and a row names a missing
thing — counted fields now carry `gap.field.<key>` and the guard fails when one
does not. *The file and the app differ by three*: `morpheme.type` is 168 missing
on disk, 165 after the load-time fill. The panel counts the loaded state.

**Guard.** `session_panel_test.js` (new, 35 checks) boots the app in
`render_smoke_test`'s harness, loads the real corpus through the real loaders and
en.json into `_LOCALE`, then reads back what the panel drew. Fifteen mutations;
**three survived the first pass** and each was a check passing for the wrong
reason — a Map deduped what the code was supposed to, and one fixture reached two
branches at once. All three were replaced by assertions that fail.

**Verification.** `./dev/tests/run_all.sh` — 70 passed, 0 failed, 2 disabled.
---

## D34 stage B — the three reasons a field is empty (2026-08-31)
**Version:** v3.14.307 · **Type:** feature · **Archives:** `dev/archive/changes/d34_stage_b_reasons/` (v3.14.306)
**Touched:** source/modules/field_spec.js · source/LingCoT.html · dev/tests/annotation_gaps_test.js · dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/edit_log.md

**What changed.** A counted row now reports `{missing, vacuous, total, applies}`.
Two rules, declared in the field table by NAME and resolved by `_GAP_RULES` in the
app — the `tags:` arrangement, and for the same reason. `vacuousWhen:
'monomorphemic'` on `word.morphological_parse` asks `joinParse`, per record.
`appliesWhen: 'scriptDiffers'` on `word.transliterations` compares
`detectScript` of the object text against `detectScript` of the translations,
once per project. `_metaSampleText()` is the second sample, kept beside
`_foldSampleText` so the two cannot drift apart.

**The flag the spec asked for was the wrong one.** It proposed `counted: false`;
what was needed is `counted: true`, an opt-in against the tier — UNIFIED conflict
⑧ in one word. `aux` is the right global answer for transliteration and the wrong
one for a Mandarin project, and now both can be true with no tier move and no
migration.

**Named for the record, not for the join.** `joinGloss` returns the same `null`
for a word whose morphemes carry no glosses, and that is not vacuity — it is the
thing the panel exists to report. `derivedBy: 'joinGloss'` would have made the fix
reintroduce the failure it fixes. Guarded.

**Unknown counts as applies.** Only two scripts that both resolve and are equal
switch a row off. The obvious spelling, `obj !== meta`, gets two `null`s wrong
silently; a fixture with an undetectable script on both sides catches it.

**What it did to the numbers.** Both corpora: the 301-item parse row reads *done*
— every multimorphemic word already has its parse — and the transliteration row is
complete in Mandarin, not applicable in Turkish. Six live rows to five. The fifth,
`paragraph.translations`, is left reported: no join for it exists in the app, so
the counter does not invent one.

**Guard.** `annotation_gaps_test.js` extended to 59 checks. Eleven mutations,
eleven named failures — including one that survived the first pass and got a
fixture of its own.

**Verification.** `./dev/tests/run_all.sh` — 69 passed, 0 failed, 2 disabled
against `samples/`. `undefined_call_test.js` failed mid-work on two locals holding
looked-up predicates and was right to: they are now `_fieldApplies` and
`_fieldVacuous`.
---

## D34 stage A — the missing-annotation counter (2026-08-31)
**Version:** v3.14.306 · **Type:** feature · **Archives:** `dev/archive/changes/d34_stage_a_gap_counter/` (v3.14.305)
**Touched:** source/modules/field_spec.js · source/LingCoT.html · dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/BUGS.md · dev/edit_log.md · dev/tests/annotation_gaps_test.js (new)

**What changed.** `annotationGaps(opts)` → `{level: {key: {missing, total, ids}}}`
for the open document. Ids are opt-in and the memo keys on the request as well as
on `_dataGen`. `countedKeys(level)` in `field_spec.js` derives the counted set —
`core`, minus containers, minus `stored: false`, minus `planned` — so the third
hand-written field list D48 exists to delete never gets written. `_navIndex` now
keeps the sections and paragraphs it already reached and discarded.

**Two things the spec got wrong, both found by building it.** It named
`tagUsage`'s walk, which has the wrong scope (every open document plus the
dictionary, no sentences) and no document order for stage C, so the counter rides
`_navIndex`. No tree walk added — one walks, the other iterates its flat lists,
both memoise on `_dataGen`. And the `counted: false` flag it asked for is absent:
every field that would have carried it is already excluded by a named rule.

**One blindness, declared not papered over.** `sentTrans` reads the pre-G31
`free_translation` scalar and the field table did not admit the key exists, so the
counter would report a legacy corpus as untranslated. Now declared `legacy` at
both levels — not `legacyKey`, which feeds `renderField` and would hand a string
to a control expecting `[{label, text}]`. The real fix is a load migration.

**What the first run said.** Six live rows in both corpora, not the four the queue
was chosen on: no section records its source, no paragraph carries a translation.
Two of the six are derivable, which makes stage B a prerequisite rather than a
refinement. Recorded in the spec and DEV_PLAN.

**Guard.** `annotation_gaps_test.js` (new), 44 checks: the derivation, the
exclusions at the instance that would slip through, "the counter names no field of
its own", execution against a document built to exercise every rule at once, then
the real corpora with the numbers printed. Eight mutations, eight named failures.

**Verification.** `./dev/tests/run_all.sh` — **69 passed, 0 failed, 2 disabled**
against `samples/`; 68 passed, 1 failed against the live corpora. That one failure
is `schema_conformance_test.js` and it is not this version's: it reproduces
identically against the archived pre-edit sources. `CLF` ×3 in `chinese-test`,
filed as new evidence under B-027.

---

## D34's surface decided — the queue (2026-08-31)
**Version:** v3.14.305 · **Type:** decision · **Archives:** `dev/archive/changes/d34_surface_choice/` (v3.14.304)
**Touched:** dev/design/D34_session_tracker.md · dev/DEV_PLAN.md

**Decided by drawing them.** Three panels were mocked against the real counts
from both live corpora rather than described: a ledger, a queue, and a queue with
the ledger behind a fold. The sentence map was dropped before the second round.

**The queue, chosen.** What settled it is a measurement rather than a
preference: **both corpora reduce to four live rows.** At that size a to-do list
is the honest shape and a dashboard is furniture — the count is secondary to the
verb, and the rows it does not show collapse into one line.

**Recorded as a choice, not an oversight**: B gives up overall progress at a
glance, and puts the three reasons a field is empty one click away instead of on
screen. That makes the collapsed "N not counted" line the whole of the design's
honesty rather than decoration — it must name each excluded field and its
reason, or the counter has no way to be trusted when it is doubted.

**And one thing the mockup exposed that the spec had not.** In a queue a *done*
field disappears entirely: `gloss 130/130` is neither a queue row nor a
not-counted row, so completion is stated only by silence. Smallest answer taken:
the collapsed line reads **"3 done · 2 not counted"** and lists both, which costs
a clause and no surface.

**Why the recommendation lost, in fairness to it.** R was strictly more
informative and needed one renderer instead of one-and-a-fragment; it also asked
the annotator to open a fold for a question — "how far along am I overall" —
that may simply not get asked during a fieldwork pass. Four rows and a verb is
the smaller claim about how the work is done, and the smaller claim is the one
to build first.

**Nothing built.** `./dev/tests/run_all.sh` — 68 passed, 0 failed, 2 disabled.
---

## D34 specced — and measuring changed three of the four answers (2026-08-31)
**Version:** v3.14.304 · **Type:** decision · **Archives:** `dev/archive/changes/d34_spec/` (v3.14.303)
**Touched:** dev/design/D34_session_tracker.md · dev/DEV_PLAN.md · dev/audits/UNIFIED_AUDIT.md

**Unblocked by D32 ✅ v3.14.303**, which was the stated dependency. Five stages,
and the spec is mostly a set of answers to questions asked in the abstract in
2026-08 and now asked of the corpora being annotated.

**The finding that shaped it.** A counter built from the `core` tier would open
by reporting **301 missing morphological parses and 130 missing
transliterations**, and every one of those numbers would be wrong — which is the
failure the original spec predicted for itself ("a counter you learn to ignore
is worse than no counter"), arriving on day one.

So "missing" splits into **three reasons a field is empty**, and only one of them
is missing: *derived when applicable* — the parse is absent on 301 words because
`joinParse` returns null for a monomorphemic one, so the counter asks the
derivation rather than the field; *inapplicable to the project* — Latin-script
Turkish wants no transliteration and Mandarin has 180, and the app already
resolves a script through `setFoldContext`; and *genuinely missing*, ~600
part-of-speech and morpheme-type items, which is what the panel is for.

**Punctuation is not a fourth reason — it is `_navIsToken`.** D30 skips it and
B-151 made that the app's one punctuation test, so the counter counts what
traversal lands on and needs no new concept for the 55 tokens involved.

**The manual "not applicable" marker the original spec asked for is deferred to
stage E**, to be built only if a residue survives the three rules. A marker added
first is a field to fill before the panel can be trusted.

**Neither half needs new machinery.** The counter joins `tagUsage`'s single
`_dataGen`-keyed walk exactly as D53 stage B added `gloss` to it, so B-053 is not
repeated. And "this session" is already recorded: `mutate()` → `journalWrite` →
`_journalOne` reduces every write to `{op, t, id}` and throws the ids away —
stage D keeps them.

**Which fields is NOT the `core` tier as it stands**: `sentence.core` holds
`words` and `section.core` holds `ingest`. A declared subset in `field_spec.js`,
not a hand-written list in the panel, which is the second field list D48 exists
to delete.

**UNIFIED conflict ⑧ closes with it**, by dissolving rather than deciding. It
said D34 cannot be built as specified because `transliterations` is `aux` —
counting it contradicts the table, not counting it contradicts the spec. Both
horns assume the TIER decides what the counter reports; the tier is global and
the question is per-project. D48 was right about the condition ("a non-Latin-script
project") and wrong to express it as a promotion. The field stays `aux`, no table
edit, no migration. Conflict ⑦ is sharpened in the same pass: one of the four
fields it says carries no wanted-mark is `morphological_parse`, empty on 301 of
310 navigable words and not a gap at all.

**Nothing built.** `./dev/tests/run_all.sh` — 68 passed, 0 failed, 2 disabled.
---

## D32 — one transliteration model, and four bugs that were one mismatch (2026-08-31)
**Version:** v3.14.303 · **Type:** feature · **Archives:** `dev/archive/changes/d32_translit_model/` (v3.14.302)
**Touched:** source/LingCoT.html · source/modules/field_spec.js · dev/tests/translit_model_test.js (new) · dev/tests/surface_conformance_test.js · dev/tests/ensure_morphemes_test.js · dev/tests/form_index_test.js · dev/tests/word_edit_pos_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/design/D32_transliteration_model.md

**Decided against the corrected corpus**, which is what step 1 existed for.
B-141 ✅ v3.14.280 fixed the provenance; re-measured: `chinese-test` holds **180
word elements, all hand-typed pinyin, all signed by a person, none derived**,
morphemes none, `turkish-test` none, nothing carries a second label. **Zero
stored derivations existed** — no migration now, one later.

**Step 2 — computed at read time, never stored.** `wordTranslit()` always joined
the morphemes as a read-path fallback and `_deriveWordFields` stored the same
join under a minted label: two writers of one value, and the stored copy is what
made `transliterations` mean two things. The deriver no longer mentions the
field; `applyForm` writes the list through `assignList`, so the word level gains
B-138's per-element reconciliation. Reasoning at the point of use.

**Step 4 — raw free text with an autocomplete recommendation**, not folded and
not a vocabulary: a project may mean what it likes by a label. What the app owes
instead is that every label already in it is offered back, so a second spelling
is a choice — `indexTranslitLabels` harvests at all seven levels where B-145
harvested two, which is why `samples/`' two spellings could not have been
prevented.

**Step 3 — the surfaces.** B-045 and B-093 were one mismatch at two levels: a
field declared `translits` and drawn as a single box. Both use the shared editor
now, the morpheme's folded, and **B-142** falls out of it.

**The exemption B-045 predicted.** `surface_conformance_test.js` declined to
check the control kind and said why: *"which of the two is wrong is D32's
question, not this guard's."* Answered, so the exemption goes, and the kind check
replacing it is what would have caught both bugs. Mutating the word back to a
single box still passed at first — the guard read the COMMENT naming the editor;
it decomments the markup now.

`doc_integrity_test.js` also learned that a bug can close in halves: B-093's type
half shipped at v3.14.193 and this is its other half, and requiring one version
per row made a split bug a documentation error.

**Verification.** `./dev/tests/run_all.sh` — 68 passed, 0 failed, 2 disabled.
---

## D53 stage D closed — and D53 with it (2026-08-31)
**Version:** v3.14.302 · **Type:** chore · **Archives:** `dev/archive/changes/d53_d_close_infer_pos/` (v3.14.301)
**Touched:** source/LingCoT.html · dev/tests/tag_control_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/design/D53_fill_pipeline.md

**Both halves of F4's proposal were already built**, in pieces and under other
numbers — `_dictFillForForm` has returned `part_of_speech` since v3.14.266, the
chip has shown and delivered it since B-082, and stage E carries it in bulk. So
what remained of stage D was **the half F4 ruled against**.

`inferPos(gloss)` sat uncalled in `renderWordView` from before v3.14.21. It was
the losing side of a decision already taken, left in the source where the next
reader would find it and wire it — and F4's wording is explicit: *"rather than
wire `inferPos`"*. It also asserted what it had no standing to: its list ran
`ATTR.PRES`, `DECL.POL2`, `PST.DECL` — one language's gloss inventory — and
returned `N` for anything else, which is exactly the claim `tag_control_test.js`
exists to keep out of an app for undescribed languages.

**Guarded by shape, not by name.** Renaming the function would defeat a name
check, so the guard refuses any `infer*Pos` / `guess*Pos` declaration, asserts
the built half still works (the fill carries POS, a chip writes it into an empty
field, the bulk fill carries it), and asserts that the two automatic paths still
never WRITE one. Mutation-tested three ways — a renamed guesser, the fill
dropping POS, a morpheme inheriting one — 1, 1, 1.

**D53 is complete**, and B-033 with it. One line held across all six stages:
these offer, they do not apply. B-123's backfill writes links, which are
derived-stamped and repairable; a gloss or a part of speech becomes the record.

**Verification.** `./dev/tests/run_all.sh` — 67 passed, 0 failed, 2 disabled.
---

## D53 stage F closed, D54 opened (2026-08-31)
**Version:** v3.14.301 · **Type:** decision · **Archives:** `dev/archive/changes/d53_f_close_d54_open/` (v3.14.300)
**Touched:** source/LingCoT.html · dev/tests/igt_align_test.js · dev/design/D54_igt_pinned_examples.md (new) · dev/DEV_PLAN.md · dev/design/D53_fill_pipeline.md · dev/BUGS.md

**F's headline was already built.** B-059 shipped the rendered placeholder at
v3.14.132, 168 versions before D53 named F6 as open. Closing the stage was three
answers, not code — which is worth recording, because "the audit lists it" is not
the same as "it is undone".

**The gap → D54.** `dict_export.py` renders a corpus-pinned example as sentence
text plus a translation and no gloss line at all, while `buildLatexLinguex` has
produced correct four-line IGT since v3.14.132. The artifact a project hands
outside itself is the one whose examples are not interlinear. Split out rather
than folded in: the work is column alignment in `fpdf`, which lays out text and
not columns, and that is a feature rather than a fill pass.

**`-` inside a gloss → warn, never rewrite; the control is the annotator's.**
The audit asked for a deliberate answer and this is it. Escaping or refusing the
hyphen would be the app ruling that a gloss may not contain a character Leipzig
uses inside one; `a lot-ACC` is a real gloss and `formatGlossForLatex` already
handles it at the subpart level. The misreading is real and is said out loud —
editing the annotator's text to protect a line count is not the app's call.
Reasoning is at the point of use. Measured: **0 hyphenated glosses** in either
live corpus, so this cost nothing now and would have been a migration later.

**Search matches the compact gloss → documented and guarded.** `???` is a
rendering and must not be findable text, or a search for the placeholder returns
every partly-glossed word as though somebody had annotated it. It was true by
accident — no caller stated it — and `igt_align_test.js` now asserts that no
search site passes `gaps`, that neither the deriver nor the join rewrites a
gloss, and that the IGT export still does pass them. Mutation-tested three ways:
1, 1, 2.

**Verification.** `./dev/tests/run_all.sh` — 67 passed, 0 failed, 2 disabled.
---

## D53 stage E — the parse field says what the lexicon knows, position by position (2026-08-31)
**Version:** v3.14.300 · **Type:** feature · **Archives:** `dev/archive/changes/d53_e_parse_surface/` (v3.14.299)
**Touched:** source/LingCoT.html · source/modules/events.js · source/LingCoT.css · source/resources/locale/en.json · dev/tests/suggest_mechanism_test.js · dev/tests/input_attrs_test.js · dev/BUGS.md · dev/DEV_PLAN.md · dev/design/D53_fill_pipeline.md

**What changed.** `parseSegmentState` reads a parse position by position and
gives each segment one of `linkTo`'s three states. `parseGuideHtml` draws it
under the field — the gloss beneath each segment, coloured by state.
`fillParseFromLexicon` takes every unambiguous segment at once, carrying gloss,
POS, type and entry id, and **skips the ambiguous ones**; their chips remain.
Repainted inside `refreshMorphSuggest`, because the chips and the guide answer
the same keystroke.

**Why a new reader.** `suggestParseEntries` dedupes and drops the misses, which
is right for a chip strip and useless here: the annotator is looking at
`ev-ler-de` and needs to know which of the three positions is a gap. A deduped
list of entries cannot say that.

**Why not literal ghost text.** F5 asks for the gloss inline in the field. Real
ghost text inside an `<input>` needs an overlay tracking the caret through a
proportional font in any script a corpus uses. The strip says what an overlay
could not — which segments the lexicon has nothing for — and those are the work.
**The "one key" is D39's**: the action has a button, and binding a keystroke
belongs with the shortcut scheme rather than ahead of it.

**Guard.** `suggest_mechanism_test.js` — whose static half UNIFIED L-006 calls
hollow — gains a behavioural section: every segment reported in order with its
state, a repeated segment reported at each position, the bulk fill writing
exactly the unambiguous ones with everything the entry knows, **an ambiguous
segment never guessed**, no guide for a one-segment parse, no button when
nothing matches, and the repaint living with the chips. Mutation-tested four
ways: 3, 1, 1, 1.

**A guard corrected on the way.** `input_attrs_test.js` scanned the raw source
and matched `<input>` written in PROSE — a comment explaining why the guide is
not an overlay was reported as an unprotected control with "(no id)". It had
never come up because no comment had named the tag, which is luck rather than
coverage. It decomments now.

**Verification.** `./dev/tests/run_all.sh` — 67 passed, 0 failed, 2 disabled.
---

