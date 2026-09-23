## Pseudo-locale check of every view, in the slow run (2026-09-23)
**Version:** pending · **Type:** chore · **Archives:** `dev/archive/changes/pseudo-locale/` (v3.14.419)
**Touched:** dev/tests/pseudo_locale_test.js (new) · dev/tests/run_all.sh · dev/PRACTICES.md
**Change:** `pseudo-locale` · **Order:** 6

**What changed.** `pseudo_locale_test.js` builds a pseudo-locale in memory (every `en.json` text run prefixed `§`), switches the app to it in Chromium, and draws the 22 views, both header menus and the autosave dialog on `samples/turkish-test`. Visible text and title/placeholder/aria-label values without the mark fail, unless they are string values from the fixture or the bundled resources (whole words, case-insensitive; a "[...]" preview may end mid-value) or on its short exempt list. In `SLOW`: it needs Chromium.

**Why.** `i18n_literal_test.js` reads code patterns; the tb-strings run of this check found 23 strings it could not see.

**Guard.** Mutations: two strings put back as literals (a table header, a view title) fail it. Blind spot: a single word that is also a data value.

**Verification.** `./dev/tests/run_all.sh` — 100 passed, 0 failed. `pseudo_locale_test.js` 6 passed in Chromium, 8 s.
