# GUI modality: what a guard sees when it drives the real app
**Updated:** 2026-08-31 · **Version:** v3.14.341  
*Frozen at the version its findings were filed. Not bumped again.*

**Examined:** LingCoT v3.14.340 driven headlessly through
`dev/tests/gui_crud_test.js` (35 checks, Chromium, 45.4 s). Result: **31 passed,
6 failed**, the six being four distinct defects, filed as B-175 to B-178.

| § | What is in it |
|---|---|
| [1. Why a third modality](#1-why-a-third-modality) | what the other two cannot see, and why |
| [2. What it found](#2-what-it-found) | four defects, one row each |
| [3. What it confirmed](#3-what-it-confirmed) | the 31 that passed are not filler |
| [4. The stale-snapshot hazard](#4-the-stale-snapshot-hazard) | this audit's own near-miss |
| [5. What it still cannot see](#5-what-it-still-cannot-see) | scope, honestly |

---

## 1. Why a third modality

| guard reads | catches | blind to |
|---|---|---|
| source text | shapes, ids, coverage, table-vs-markup drift | anything only true at runtime; a type change (B-024) entirely |
| the app in `_dom.js` | throws during evaluation and render | anything needing layout, a real event, or a value read back |
| the app in `_gui.js` | what a control does to a **file** | pixels — deliberately; nothing here looks at one |

`_dom.js` says it of itself: *"not a DOM implementation and must not grow into
one… the thing being caught is an exception, not a wrong pixel."* That is the
right scope for it. It leaves a gap, and the gap has a shape: **three defect
classes live entirely inside it.**

| class | why neither other modality can reach it | instance |
|---|---|---|
| a selector that does not match its markup | both halves exist and are individually correct; only a real delegated click proves they never meet | B-175 |
| a value that lives in memory and dies in the writer | the object handed to the writer is not the bytes produced | B-127 (17 versions of `field_prov: {}`) |
| a declared contract nothing implements | the declaration is present, the consumer is absent, and nothing compares them | B-177 |

All four defects below are in those classes. None is subtle in hindsight; each
was invisible to 75 guards.

## 2. What it found

| id | Sev | what | the line |
|---|---|---|---|
| **B-175** | S2 | the section delete button does nothing — no confirm, no removal, no log | `events.js:2085` matches `.sec-del-btn`; `LingCoT.html` renders `class="btn btn-danger btn-sm" data-arr="del"`. `sec-del-btn` occurs **once in the codebase**, in that selector |
| **B-176** | S2 | a word gloss cannot be cleared; the old value returns on save | `_deriveWordFields`: `else if (!fill) word.gloss = joinGloss(ms)` — an empty explicit gloss means *derive from the morphemes*, and the morpheme carrying the old gloss exists only because `saveWord` created it |
| **B-177** | S3 | `fold:` is declared and read by nothing; typed `noun` stores `noun`, the chip stores `ADJ` | 5 `fold:` declarations in `field_spec.js`; no code reads `f.fold`. `saveWord` stores `wPos` raw |
| **B-178** | S2 | merging two sections mutates the model immediately; leaving the editor without saving does not undo it | `events.js:2111` `secA.paragraphs.push(...)`, while the sibling `del` branch only calls `row.remove()` and lets the save reconcile |

**B-175 and B-178 are the same asymmetry seen twice.** In one handler, `del`
defers to the save and `merge` does not. One of them is wrong about when a
section editor is allowed to change the document, and §4 of `PRACTICES.md` is the
question to ask: *would a change here reach every place that does this?*

## 3. What it confirmed

31 checks passed, and they are not filler — several pin behaviour that has been
broken before.

| area | confirmed |
|---|---|
| B-057, all three layers | untouched `words` does not rebuild (L0) · annotation survives on kept forms (L1) · dropping an annotated token asks, and **both** answers behave (L2) |
| round trip | the app opens what it saved · an annotation survives save→open · a second save of an untouched corpus is byte-identical in the document record |
| input | trimming · whitespace-only is empty, not spaces · typed markup stored verbatim **and rendered escaped** · a 2000-char value survives · NFC and NFD stay distinct · textarea newlines · disclosure-gated `extra` fields |
| row editors | order preserved · empty rows dropped · removing the first of two leaves the **second** |

The round-trip checks are the ones that would have caught **B-146** — a corpus
the app wrote and could not reopen — at the moment it was introduced.

## 4. The stale-snapshot hazard

**This audit's first draft filed B-146 and B-147 as open. Both were fixed at
v3.14.284.** The guard had been run against a copy of `source/` taken earlier the
same day, before those fixes landed, and reported them as live defects with
convincing reproductions.

| | |
|---|---|
| why it happened | the run reads whatever `_source.js` resolves at that moment; nothing in the output says which version that was |
| why it was caught | filing required a `B-nnn`, and `BUGS.md` already had both, marked fixed |
| the rule | **check the fix history before filing anything a runtime guard reports.** A static guard reads the tree you are in; a browser can be pointed at a copy |

Worth fixing at source: the guard should print the version it ran against.
Logged as a follow-up in B-175's entry rather than as its own bug, because it is
a line of `_gui.js`, not a defect in the app.

## 5. What it still cannot see

Stated so the guard is not over-trusted:

- **No pixels.** A renderer producing beautiful wrong markup passes, and should.
- **No pywebview.** The Python bridge is stubbed; `LingCoT.pyw`'s own paths —
  dialogs, the NLLB subprocess, workspace creation — are `nllb_diag_test.py`'s
  and `workspace_test.js`'s business, not this one's.
- **One browser.** Chromium, not the WKWebView the app actually ships in on
  macOS. B-116's string ceiling is precisely a place those two differ.
- **Not a substitute for using it.** `PRACTICES.md` §8 stands unchanged: most
  defects here were found by launching the app.
