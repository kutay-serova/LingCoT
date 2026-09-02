# D59: The document editor commits at Save, and only there
**Updated:** 2026-08-31 · **Version:** v3.14.343
*Design record, written with the fix. **Built v3.14.343.** Read it before touching the section-row handler in `modules/events.js` or `saveDocument`.*

**Decided 2026-08-31, v3.14.343**, out of **B-175** and **B-178** — which are not
two bugs but one handler disagreeing with itself.

## The question

`events.js`'s section-row handler had four branches and two different answers to
*when does this reach the document?*

| branch | what it did | when it took effect |
|---|---|---|
| `up` / `down` | reordered DOM rows | at Save, which rebuilt `d.sections` from them |
| `del` | `row.remove()` | at Save — except the selector never matched, so never (B-175) |
| `merge` | `secA.paragraphs.push(...secB.paragraphs)` | **on the click** (B-178) |

One of the two is wrong. Fixing either bug without answering which would have
built the disagreement into the fix.

## The answer

**The editor is a buffer. Nothing it does reaches the document until Save, and
leaving without saving discards it.**

Three reasons, in the order they matter:

1. **It is what the rest of the app already promises.** D55 rests on exactly this
   for the word editor — *"an unwanted take is undone by leaving the editor
   without saving"*. A document editor with a Cancel button that means "except
   the merges" is not a form.
2. **There is no undo (D56).** Leaving without saving is the only reversal this
   app offers, and `merge` sits one button away from `del` in the same row.
   Making a mis-clicked merge permanent is the wrong trade.
3. **`del` already assumed it**, and `saveDocument` was already written for it.

## What the buffer is, and what it deliberately is not

**Not** DOM attributes carrying pending operations. That was the first sketch —
`data-absorb` lists on the surviving row — and it means inventing a small
language: absorb lists, inheritance across chained merges, `data-si` still
pointing into the live array. Every one of those is a correctness question
answered by hand.

**Instead**: `_secEdit`, one entry per section — `{ si, absorbed, title }`. The
controls edit it and redraw from it; `saveDocument` is the only writer of
`d.sections`. "Leave without saving discards it" is then true by construction
rather than by bookkeeping, and the guard is one sentence long: *the section
editor never writes to `d.sections`.*

Two consequences fall out rather than needing rules. Deleting a row that has
absorbed others takes them with it, because the entry **is** the row. Reorder
needs no proof of its own, because nothing in the buffer can reach the document.

## The three things this design has to get right

- **The typed title.** A redraw rebuilds the inputs from the buffer, so a title
  typed and not saved lives only in the DOM until `secEditReadTitles()` runs.
  It runs before every redraw and before the save, and before the first branch —
  reading it after a splice attributes one row's title to another.
- **The draft's lifetime is `go()`'s, not the renderer's.** `renderDocumentEdit`
  re-runs whenever the render cache key moves — an autosave bumping `_dataGen` is
  enough — so a reset there would discard a merge made seconds earlier. `go()`
  clears `_secEdit` on the way out of the view, which is where "leaving discards
  it" actually belongs.
- **The index after a structural save.** B-175 turns on a delete path that has
  never run. A reorder moves `sectIdx` on every word and sentence after it; a
  merge re-parents paragraphs; a delete leaves its words in `S.wordById`, in the
  form refs and in `corpusLemmaRefs` as phantom hits. `saveDocument` calls
  `buildCorpusIndex()` when the structure changed — rebuild rather than patch,
  because this runs on an explicit document save, not per word, and one call
  cannot forget a map the way a hand-written deindex can. That also closes the
  reorder case, stale since sections became reorderable and never noticed because
  no delete worked to expose it.

## The journal

A shallow put carries child ids and order, which is enough to replay a reorder or
a removal. A merge is not: paragraphs change parent, and a shallow put would name
child ids under a section that has never journalled them. So a **structural** save
writes its sections whole and a title-only save stays shallow.

## What stays open

`del` still asks before it removes a row, even though nothing is destroyed until
Save. Deleting fieldwork should ask, and the ask is what `gui_crud_test.js`
D0b/D0c observe — a delete that silently does nothing is what a naive "is it
still there?" check calls a pass.
