## B-228 to B-230: projects open whole; dictionary-only sessions; switching asks only when work would be lost (2026-10-07)
**Version:** pending · **Type:** fix · **Archives:** `dev/archive/changes/bundle-open/` (v3.15.4)
**Touched:** source/LingCoT.html · source/modules/events.js · source/LingCoT.css · source/LingCoT.pyw · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/project_files_test.js · dev/tests/gui_crud_test.js · dev/tests/_gui.js · dev/tests/corpus_load_test.js · dev/tests/session_panel_test.js · source/modules/project_files.js · dev/BUGS.md · dev/DEV_PLAN.md
**Closed:** B-228, B-229, B-230
**Change:** `bundle-open` · **Order:** 1

**What changed.**
- A `_dictionary.jsonl` picked in Open or dropped on the window opens its project through the sibling corpus, like the journal and participants files (B-184). With no corpus beside it, or with no role suffix, it opens as a dictionary-only session: bound to that file, Dictionary view as home, corpus controls hidden.
- The project's dictionary is applied on every load, empty or not (B-228).
- Removed: the companion banner, the corpus/dictionary pair memory, the "Replace the dictionary?" dialog, and the per-file Change buttons in the save panel (B-229). Paths are read-only; new buttons Save Project As and Show in Finder. One chooser, `chooseProjectPath`, sets all three paths and refuses a location whose companion files belong to another project.
- Opening another project asks only when something would be lost (an editor with changes, or edits with no save path). Pending records are flushed, and compacted when autosave is on, before the switch.
- `LingCoT.pyw`: `path_exists`, `reveal_path`.
- B-230: `projectPrefix` also strips a role suffix from a name whose extension is already gone, which is what the loaders pass.

**Why.** Post-test review: a dictionary picked on its own mixed into the open project, and the replace-corpus confirm accounted for the 4 to 6 s "slow open" seen in the tester logs (a wait for a click, not load time).

**Guard.** `gui_crud_test.js` scenario G (G0 to G11) drives the real UI: dictionary file opens its project, the previous project's entries stay out of the next one's file, lone and hand-named dictionaries open alone, an edited editor makes the switch ask. `project_files_test.js` and `corpus_load_test.js` cover the chooser and the dictionary role.

**Verification.** `./dev/tests/run_all.sh`: 103 passed, 1 failed (`log_triage.js`, a pre-existing warning that logs a form; closed in the next change). `gui_crud_test.js`: 58 passed; scenario G fails 8 of 12 checks against the archived pre-edit app.
