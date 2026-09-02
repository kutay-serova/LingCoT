# D54 — Interlinear pinned examples
**Updated:** 2026-08-31 · **Version:** v3.14.301

Status: **planned, not scheduled.** Split out of **D53 stage F** at v3.14.301,
where it was the one real gap left under F6 and too large to fold into a
"fill the gaps at export" pass.

## The gap

`dict_export.py` renders a corpus-pinned example as the sentence text with the
target word bracketed, plus the first translation:

```
    [tilki] üzümlere baktı .
    the fox looked at the grapes
```

There is **no gloss line at all** — not a misaligned one, none. So the one
artifact a project hands to someone outside it carries its examples
un-interlinearised, while `buildLatexLinguex` has produced correct four-line IGT
in the app since v3.14.132.

## What it has to produce

The linguex builder is the reference, and the shape is settled by it rather than
by this document:

| line | source | present in the PDF today |
|---|---|---|
| native | `sent.text` | ✅ (bracketed target) |
| transliteration | `wordTranslit(w)`, falling back to the form | ❌ |
| gloss | `wordGloss(w, { gaps: true })` | ❌ |
| translation | `sentTrans(sent)` | ✅ |

**`gaps: true` is not optional here.** A published example is exactly where a
dropped position is least recoverable — the reader has no parse to check it
against. B-059's rule holds: rendered, never stored.

## The three questions this needs answered

1. **Alignment in a PDF.** `fpdf` lays out text, not columns. Linguex gets
   alignment from LaTeX; here it has to be measured per token and drawn, or set
   in a monospace face and accepted as approximate. This is the whole of the
   work and the reason it is not a small change.
2. **Which transliteration.** A corpus may carry several labelled systems
   (D32). The export modal already collects a transliteration toggle; it does
   not collect a *label*.
3. **Punctuation.** `buildLatexLinguex` drops punctuation from the aligned
   lines and keeps it in the native line. A PDF example should do the same, and
   the punctuation test is `_navIsToken` now (B-151), not a form list.

## Depends on

- **D32** for question 2, or the export picks the first label and says so.
- Nothing else. The data is complete: every renderer this needs already exists
  and is guarded by `igt_align_test.js`.

## Not in scope

The manual pinned example (`type: 'manual'`) already carries its own gloss
string, typed by the annotator. It is not built from morphemes and gets no
placeholder treatment — a manual example is a quotation, not a derivation.
