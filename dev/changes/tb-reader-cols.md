## D41 Reader Mode B: the document as text against translation, read-only (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/tb-reader-cols/` (v3.14.419)
**Touched:** source/modules/reader.js (new) · source/LingCoT.html · source/LingCoT.css · source/modules/events.js · source/resources/locale/en.json · source/resources/locale/haw.json · dev/tests/reader_cols_test.js (new) · dev/PRACTICES.md
**Change:** `tb-reader-cols` · **Order:** 7

**What changed.**
- View `reader` (`modules/reader.js`). The open document in reading order: section headings, then one row per paragraph, text left and first translation right. Sentences are `.s-span` with `data-sid`, so the existing pair highlight on hover works as is.
- Batches of 30 paragraphs, the rest loaded by a sentinel, as in the section view.
- Entry: **Read** on the document view (opens at the top) and on the section view (opens at that section; an empty section falls through to the next heading). Breadcrumb: Document › Reader.
- A sentence click, or Enter on it, opens a read-only popup: location, text, every transliteration and translation, comments, word count, and **Open in annotation view**. Esc, outside click, or any navigation closes it.
- `_readerMode` ('cols' now, 'igt' in tb-reader-igt) is in the render cache key.
- 12 keys, including the view's help. Three `Section ${n}` / 'Section' / 'Paragraph' literals in the section and breadcrumb code now read `label.view.section_n` / `bc.section`.

**Guard.** `reader_cols_test.js` (22): pairing, batching, every sentence reached, no editing control on the page or in the popup, wiring. `pseudo_locale_test.js` covers the new view.

**Verification.** `./dev/tests/run_all.sh` — 101 passed, 0 failed. `gui_crud_test.js` 46 passed; `pseudo_locale_test.js` 6 passed. Checked in Chromium on `samples/turkish-test`: hover pairing, popup open/Esc/link, section entry.
