## Settings and adopted tags move out of the app folder into the workspace (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-settings/` (v3.14.419)
**Touched:** source/LingCoT.pyw · source/workspace.py · source/LingCoT.html · source/resources/locale/settings.default.json (new) · .gitignore · dev/tests/user_settings_test.js (new) · dev/tests/workspace_test.js · dev/tests/tag_control_test.js · dev/tests/_gui.js · dev/PRACTICES.md
**Change:** `tb-settings` · **Order:** 2

**What changed.**
- Host: `write_file` removed; `read_user_file` / `write_user_file` read and write `workspace.USER_FILES` only (`settings.json`, `vocabulary/pos_tags.json`, `vocabulary/type_choices.json`). A missing file reads as null. Writes are atomic.
- `settings.json` is copied once from `source/resources/locale/` if only the old copy exists; that path is now in `.gitignore`. The repo default is `settings.default.json`.
- Page: `_settings` = defaults overlaid by the workspace file; `saveSettings()` writes it, and is a no-op until `loadLocale` has read it. Tags adopted in the tag drawer go to `vocabulary/`, merged over the shipped lists at load.
- Adopted tags already committed to the shipped lists stay there; nothing is migrated for vocabulary.

**Why.** Every theme toggle and every adopted tag changed a tracked file, and an update would overwrite a tester's choices.

**Guard.** `user_settings_test.js` (8; mutations: removing the pre-load guard, reversing the overlay order). `workspace_test.js` +8, executing the host methods with webview stubbed. `tag_control_test.js` +1.

**Verification.** `./dev/tests/run_all.sh` — 99 passed, 0 failed.
