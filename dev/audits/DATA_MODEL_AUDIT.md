# LingCoT: Data-Model & Annotation-Flow Audit
**Updated:** 2026-08-25 · **Version:** v3.14.31  
*Frozen. The version is the build this was written against, not the current one.*

> ### ✅ Implemented, status added 2026-08-25
> **G28–G34 all shipped** (DEV_PLAN §5 G): segmentation chokepoint · fill/derive
> rule · SCHEMA + conformance test · "transliteration" rename · `dict_id`
> resolution (v3.14.31) · annotation entry-point consolidation · legacy
> `annotations:{}` retired.
>
> Two things this audit set in motion are still live and worth knowing:
> **G28's "one source of truth per fact"** is the rule B-036, B-037 and B-040 all
> violated, and **G30's conformance test** is what caught them.

**Date:** 2026-06-13 · **Status:** audit (no code change). Drives DEV_PLAN §G (items 28–34).
**Scope:** data structures, new-entry/edit points, and the back-/forward-fill (derivation/inheritance) web. Verdict per the three questions asked: *sound? intuitive? too complicated?*

---

## 1. What exists (map)

**Corpus hierarchy** (JSONL canonical): `Document → Section → Paragraph → Sentence → Word → Morpheme`. Clean, standard, intuitive.

**Two stores:**
- Corpus. Inline token annotation (words/morphemes nested in sentences).
- Lexicon (dictionary JSONL). Reusable entries of `type` `word` / `bound.morpheme` / `lemma`, keyed by form, linked by `lemma_id`.
- Participants file, annotators + sources.

**Provenance** (every corpus object): `prov` (latest) + `prov_history` (append-only) + `field_prov` (per-field) + E26's *derived* markers (`annotator_id:null`). Consistent across objects.

**Edit points:** 14 `save*` functions (`saveDocument/Section/Paragraph/Sentence/Word`, `saveSectionAdd/ParagraphAdd/SentenceAdd`, `saveNewCorpus`, `saveDictEntry/NewDictEntry`, `saveEntrySheet`, `saveAnnModal/SrcModal`). Editors are componentized and reused (`renderSourcePicker`, `renderCommentsEditor`, `renderTranscriptionsEditor`).

**Fill / derive web (~5 directions):**
1. morphemes → word fields. `saveWord` derives `gloss` / `transliterations` / `morphological_parse` from morphemes (fill-only / on-explicit-absent).
2. parse string → morphemes. E26 `ensureMorphemesFromParse` (Materialize).
3. dictionary → corpus morphemes. E26 (Enrich), fill-only.
4. dictionary → word. `saveDictEntry` inherits `gloss` (if empty) + seeds `morphological_parse` from `constituent_forms` (if empty).
5. corpus → dictionary. Entry Sheet (`saveEntrySheet`) creates lexicon entries from the word's annotation.

---

## 2. Findings

### Sound?: functionally yes (post-E26), but structural + hygiene erosion

- **F1. Two sources of truth for segmentation.** `word.morphological_parse` (string) and `word.morphemes[]` (array) encode the same fact and must stay in lock-step (`saveWord` L5229–5235; E26). This is the *root cause* of the desync class. E26 is a guard, not a cure. Every new write path must remember to reconcile.
- **F2. Schema doc drift.** The `SCHEMA` block (LingCoT.html ~L139–224) is stale: Word omits `transliterations`, `part_of_speech`, `field_prov`; Dictionary entry says `transcriptions`/`definition` where code stores `transliterations`/`meaning`, and omits `lemma_id`, `constituent_forms`. A schema contract that lies is a latent-bug factory.
- **F3. Terminology conflation, transcription vs transliteration.** Stored key is `transliterations` everywhere (word/morph/sentence/paragraph/entry), but editors/labels use both "transcription" (`renderTranscriptionsEditor`, `label.editor.transcriptions`) and "transliteration" (`label.editor.transliteration`). These are different linguistic concepts (romanization vs phonetic/orthographic transcription) collapsed into one field with two names.
- **F4. Form-based corpus↔lexicon linking.** Corpus → lexicon is by surface form (`lookupDict(form)`), not stable id, fragile to form edits, blind to homographs. Lemma uses ids internally; E27 extends per-token ids (right direction).
- **F5. Legacy `annotations: {}`** retained on word/sentence (editors removed v3.14.12; field kept).

### Intuitive?: hierarchy yes, annotation flow no

- **I1. Multiple annotation surfaces with different side effects.** Morpheme/lemma annotation has 3+ entry points (word edit, Entry Sheet, dict add/edit); which one you use determines what gets written and in which direction. This is exactly why **ordering mattered** (the E26 bug). E26 made the *outcome* correct, but the *mental model* is still hard: "where did this gloss come from / why didn't my dict gloss appear on the token?" is not answerable from the UI.
- **I2. Invisible derivation.** Fill-only + derived provenance is correctly invisible (good), but invisibility × multiple entry points makes "why is this field filled/empty?" confusing.

### Too complicated?: essential vs accidental

- **Essential (keep):** multi-tier IGT, rich provenance, reusable lexicon separate from tokens.
- **Accidental (cut):**
  - **C1.** Dual parse-string/morphemes representation (forces reconciliation everywhere). [= F1]
  - **C2.** Backfill rules in ~4 places with subtly different behavior, e.g. `saveWord` never uses a morpheme *form* as a gloss fallback, but old `saveNewDictEntry` did (`m.gloss || m.form`; fixed in E26). The inconsistency shows the rules aren't centralized.
  - **C3.** Terminology + schema drift add cognitive load disproportionate to size. [= F2, F3]

---

## 3. Recommendations (priority order) → DEV_PLAN §G

28. **Single source of truth for segmentation.** Make `morphemes[]` canonical; derive the parse string on read (or keep the string canonical and materialize the array eagerly on every write). Eliminates the entire desync class; E26 becomes unnecessary. Biggest payoff, biggest change, scope carefully, behind tests.
29. **Centralize the fill/derive rules.** Finish the deferred E26 step: one shared morpheme/word-field deriver that `saveWord`, the Entry Sheet, and dict saves all delegate to, exactly one ruleset.
30. **Refresh the SCHEMA block + add a schema-conformance test** (assert sample corpus/dict objects only use documented fields) so drift is caught mechanically.
31. **Resolve transcription vs transliteration.** Decide one concept or two; rename storage/editors/labels consistently (migration if the stored key changes).
32. **Continue id-based token↔lexicon linking** (E27 for lemma; consider morpheme/word refs); document form-link fragility until then.
33. **Reduce/unify annotation entry points** so the flow is order-independent and discoverable (ideally one "annotate token" path; others become shortcuts into it).
34. **Finish retiring `annotations: {}`** (drop on next write; one-time strip at load).

**Framing:** the foundation is sound and most complexity is justified. Nothing is broken post-E26, so none of this is urgent. Items 28–31 give the largest soundness + intuitiveness gains; 28 + 29 together would retire the desync class that E26 currently guards.
