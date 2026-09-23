## Interface language picker, English fallback, haw.json placeholder; B-210 (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-i18n/` (v3.14.419)
**Touched:** source/LingCoT.html · source/LingCoT.pyw · source/LingCoT.css · source/resources/locale/en.json · source/resources/locale/haw.json (new) · dev/tests/locale_parity_test.js (new) · dev/tests/locale_key_test.js · dev/tests/translit_model_test.js · dev/tests/_gui.js · dev/tests/i18n_allow.json · dev/BUGS.md · dev/DEV_PLAN.md · dev/PRACTICES.md
**Change:** `tb-i18n` · **Order:** 3

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
