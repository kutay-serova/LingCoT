# LingCoT: Annotation Entry-Points UX Audit (G33)
**Updated:** 2026-08-25 · **Version:** v3.14.21  
*Frozen. The version is the build this was written against, not the current one.*

> ### ✅ Implemented, status added 2026-08-25
> **S1–S4 all shipped**, as DEV_PLAN §G33 (annotation entry-point consolidation).
> This document is now the *reasoning behind the current design*, not a plan.
> Findings F1–F5 describe the state **before** that work; read them as history.

**Date:** 2026-06-13 · **Status:** audit + simplification proposals (no code change). For DEV_PLAN §G33.
**Context:** E26 (morpheme materialization) + E27 (per-token lemma) already made the surfaces **consistent and order-independent.** the historical "which surface, and when" desync is fixed. This audit is about the *remaining* overlap, asymmetry, and discoverability.

---

## 1. The surfaces that annotate a token

| Surface | Reached from | Writes to | Fields |
|---|---|---|---|
| **Word edit** (`renderWordEdit`/`saveWord`) | word view → "Annotate" (`note-pencil`) | **corpus token** | gloss, parse → morphemes (+ per-morpheme gloss), transliteration, lemma. Creates only a **lemma** dict entry (E27). |
| **Entry Sheet** (`renderEntrySheetHtml`/`saveEntrySheet`) | word view → "+ Lexicon" | **dictionary** (+ backfills token via E26) | word form/**type**/**POS**/gloss/lemma · per-morpheme **type**/**POS**/gloss · lemma form/POS/gloss |
| **Dict add** (`saveNewDictEntry`) | per-morpheme "+ dict"; dict view | **dictionary** | single entry (form/POS/type/gloss/meaning/translit/constituent_forms/lemma) |
| **Dict edit** (`saveDictEntry`) | dict view "Edit entry" | **dictionary** | edit one entry |

The word view already splits intent into two buttons: **Annotate** (= this token) and **+ Lexicon / Edit entry** (= the dictionary). That split is sound.

---

## 2. Findings

- **F1. Two token-analysis surfaces with overlapping fields.** gloss, parse/morphemes, and lemma all appear in *both* word-edit and the Entry Sheet, writing to different stores. "Annotate this word's gloss/morphemes/lemma" has two homes.
- **F2. The sync is one-directional (the real friction).** Entry Sheet → token is automatic (E26 backfill), but **word-edit → dictionary is not** (except the lemma), so if you richly annotate a token in word-edit and then want it in the shared dictionary, you must **re-enter it in the Entry Sheet.** double data entry. This is the biggest practical UX cost.
- **F3. POS is split / not token-editable.** The schema has `word.part_of_speech` and `morpheme.part_of_speech` (token-level), but the UI lets you set POS only on **dictionary** entries (Entry Sheet). You **cannot fix a corpus token's POS in word-edit.** token POS is effectively import-only.
- **F4. Three lexicon-creation granularities** (Entry Sheet rich / dict-add single / per-morpheme "+ dict"). Reasonable, but adds surface count.
- **F5. Discoverability.** The token-vs-lexicon distinction and the auto-sync are invisible; "Annotate" vs "+ Lexicon" hint at it but never explain it.

---

## 3. Simplifications (ranked by value)

**S1. Make annotation→lexicon bidirectional: a "save to dictionary" affordance in word-edit. _(Highest value, kills F2.)_**
On word-edit save, optionally create/update the lexicon entries (word + its morphemes + lemma) from the token's current analysis, reusing `saveEntrySheet`'s entry-creation. Word-edit becomes the canonical "annotate token" path that can *also* populate the dictionary in one pass; the Entry Sheet is no longer the only road to the lexicon. Directly realizes the plan's "one annotate-token path." Moderate work; touches `saveWord` (critical path) → behind tests.

**S2. Expose POS in word-edit. _(Fills F3.)_**
Add word POS + per-morpheme POS fields to word-edit so token POS is editable where you annotate, not only via the dictionary. Small–moderate.

**S3. Clarity pass. _(Low risk, worth doing regardless.)_**
Tooltips + a one-line hint on the word view making explicit: **Annotate** = this token's analysis (in the corpus); **+ Lexicon** = a reusable dictionary entry that auto-applies to the token. Closes F5 without restructuring.

**S4. Retire the Entry Sheet (consolidation, _after_ S1+S2). _(Biggest reduction.)_**
Once word-edit can do token + push-to-lexicon (S1) + POS (S2), the Entry Sheet is redundant for the common case. Reduce to: **word-edit** (the one token surface) + **dict add/edit** (pure lexicon management). Remove the Entry Sheet or keep it only as an advanced bulk-create. Do only after S1/S2 are validated.

---

## 4. Recommendation

Sequence: **S3 now** (safe, immediate clarity) → **S1 + S2** (the real simplification: word-edit becomes the single annotate-token path that can push to the lexicon and edit POS, eliminating double-entry) → **S4** as a later consolidation once S1/S2 prove out. S1 is the high-value item; S4 is the satisfying end-state but should follow, not lead.

Framing: nothing here is broken (E26/E27 closed the bug). This is friction + discoverability. If only one thing is done, do **S1** (removes the double data entry); if zero appetite for touching `saveWord`, do **S3**.
