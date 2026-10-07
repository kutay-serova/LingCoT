## A one-morpheme word with one new row is added to the dictionary without the panel, with Undo (2026-10-07)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/autopush/` (v3.15.4)
**Touched:** source/LingCoT.html · source/modules/events.js · source/LingCoT.css · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/push_to_dict_test.js · dev/tests/outcome_channel_test.js · dev/tests/gui_crud_test.js
**Change:** `autopush` · **Order:** 3

**What changed.**
- `pickerNeeded(word, rows)`: false for a word of at most one morpheme whose one visible row is ticked, new, and clashes with nothing. `saveWord` then pushes `defaultCandidates(rows)` without opening the panel; every other case opens it as before.
- The status line says what was added and carries an Undo button (8 s). `undoAutoPush` deletes the entries that push created, clearing their links, without a confirm (`deleteDictEntry(id, { ask: false, stay: true })`).
- `flashSaveStatus(msg, { action, label })`: an optional action button; severity is still read from the message.
- Log: `add-to-dictionary picker skipped`, `dictionary push undone`.

**Why.** Post-test item 5b. In the Mandarin tester logs 70 of 74 saves through the panel spent under 2 s in it: a confirmation click on a single row.

**Guard.** `gui_crud_test.js` scenario H (H1 to H5): no panel and an entry for a one-morpheme word, Undo removes entry and link, a two-morpheme word still opens the panel; H1 to H3 fail on the archived pre-change app. `push_to_dict_test.js`: `pickerNeeded` executed on the skip case and three ask cases.

**Verification.** `./dev/tests/run_all.sh`: 105 passed. `gui_crud_test.js`: 63 passed.
