## Machine translation defaults to English, not the interface language (2026-09-23)
**Version:** pending · **Type:** decision · **Archives:** `dev/archive/changes/xlate-target-en/` (v3.14.419)
**Touched:** source/LingCoT.html · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/xlate_settings_test.js
**Change:** `xlate-target-en` · **Order:** 5

**The decision.** With no `translation_language` on the document, `translationTarget()` returns English. The interface language is no longer a fallback. The CLI already resolved this way (`corpus_translation_language(...) or 'en'`). The field placeholder says "default: English".

**Alternatives considered, and why not.** Interface language first (B-072, v3.14.217): with a language picker, switching the UI to `haw` would change what machine translation writes into a corpus, and `haw.json` is an English placeholder. Setting `translation_language` on the sample corpora only: covers the samples, not a tester's own corpus.

**What this binds.** The translation target depends on corpus metadata only. `xlate_settings_test.js` asserts English for `tr` and `haw` locales with nothing declared (mutation: the old fallback fails 2 checks).
