# Search-B: Design Spec (DRAFT)
**Updated:** 2026-08-25 · **Version:** v3.14.38  
*Frozen. The version is the build this was written against, not the current one.*

> ### ✅ Built, status added 2026-08-25
> No longer a draft. **F1–F7 all shipped, v3.14.15–38**: substrate · matcher ·
> KWIC · frequency/distribution · sort-by-context · collocates · cross-engine
> parity (1174/1174), after which Search-A was retired.
>
> Kept as the **spec of record.** it explains why the engine is shaped as it is.
> For what it does *now*, the README's Search chapters were rewritten from
> `search_b.js` in v3.14.98 and describe the shipped behaviour.
>
> ### The name this document is titled after is gone, v3.14.388
> Search-A was retired at v3.14.38 and deleted long before v3.14.388, at which
> point "Search-B" named the only engine there was. The two module files were
> **merged into one, `source/modules/search.js`**, and every `sb`/`sb-` prefix in
> it renamed: `sbSearch` → `runSearch`, `renderSearchB` → `renderSearch`,
> `SB_RESULT_CAP` → `SEARCH_VIEW_CAP`, the `_sb*` state to `_srch*`, the CSS
> classes and the `data-action` prefix with them. `dev/RENAMES.md` maps every old
> path and the guards' new names. **Nothing in the design below changed** — the
> substrate, the matcher's routing, the four concordance builders and their
> contracts are as specced; only the spelling moved. Read `search_b.js` in this
> text as `search.js`.
>
> **Still open here, unchanged at v3.14.390:** n-grams (§7.4's second half),
> the stoplist, CSV export, pagination.

**Date:** 2026-06-12 · **Status:** Workshop draft, pre-implementation. No code yet.
**Owner decisions captured:** full concordancer (all 4 functions); Word+Sentence bridging (paragraph deferred); engine audited (recommendation below); **staged replacement** of Search-A, build to parity + concordance, then retire A.

This document is the agreed spec to react to *before* building. As of 2026-06-12, **all 8 open decisions are resolved** (see §12). Spec is ready for build sign-off.

---

## 1. Purpose & relationship to Search-A

Search-B is a new search/concordance surface that will **eventually replace** the current Search tab. It is built in parallel ("Search-B" label during transition), must reach **feature parity** with Search-A (see §10 checklist), and then adds concordance capabilities Search-A lacks. Search-A is retired only when the parity checklist is fully green.

**Reused from Search-A (do not rebuild):** field extraction (`word.form`, `wordGloss`, `translitTextsForSearch` multi-label, sentence translation, lemma expansion), the glob/regex compiler (`compileTokenQuery` → `parseQuery`), and `normPunctForSearch` normalization. These are sound and carry parity.

**Net-new in Search-B:** concordance output layer, a unified query/boundary model, and a shared token-stream substrate.

---

## 2. Goals & non-goals

**Goals**
1. Concordance: **KWIC view, sort-by-context, frequency & distribution, collocates/n-grams** (all four).
2. Wildcard at two levels. Within-word (`git*k` → `gitmek`, `gittik`, never `gitti dedik`) and across word/sentence boundaries (sequence matching that may bridge sentence boundaries inside a paragraph).
3. Search by **form, transliteration(s), translation(s), gloss(es)** (parity already covers these).
4. Efficient at realistic scale.

**Non-goals (deferred, not designed here)**
- Cross-**paragraph** bridging (revisit if a use case appears).
- SQLite/FTS5 backend (ruled out for parity, see §3).
- Real indexing for scale in v1 (architected as a future bolt-on, see §3, §9).

---

## 3. Engine decision (audited)

**Decision: in-memory linear scan + a cached token-stream substrate. Defer indexing. FTS5 off the table.**

Rationale, grounded in measured data (current corpora: 12–17 sentences, ~200–350 word tokens; largest file 388 KB):

| Option | Verdict |
|---|---|
| **A. Scan + token substrate** | **Chosen.** Feature-complete for parity (infix wildcards, full regex, derived multi-label translit, live edits with zero sync cost). Fast to ~30k sentences for the worst case (infix/regex ≈ 500 ms); sub-200 ms for prefix queries even at 100k. |
| **B. In-memory inverted/trigram index** | Future bolt-on. Only helps wildcards if it's a **character-trigram** index. Adds incremental-update cost on every edit. Worth it only past ~30k sentences. Designed so it attaches to the §4 substrate without touching the concordance layer. |
| **C. SQLite FTS5** | **Rejected for parity.** No infix/suffix wildcard (standard tokenizer prefix-only; trigram tokenizer needs ≥3-char terms, no regex, ASCII-ish folding only). Regex → host `REGEXP` fn → full scan, across an async pywebview bridge. Requires JSONL↔DB sync on live edits. Only viable as a prefix pre-filter past ~100k sentences. |

**Measured/projected latency** (in-JS): see audit table in workshop notes. Scan worst case (infix/regex) ≈ 15 ms @1k, 150 ms @10k, 1.5 s @100k; prefix queries stay <200 ms throughout.

**Trigger to revisit (add B):** any single corpus approaching ~30k sentences, or sustained infix/regex search latency >500 ms.

---

## 4. Core substrate: cached token stream

A single per-sentence structure that **all** concordance features read from. Built lazily, cleared on edit (ties into DEV_PLAN C12/H1, currently open).

```
sent._tokens = [            // built lazily in buildCorpusIndex/indexSent; cleared in reindexSentWords
  {
    i:       0,             // 0-based token position within the sentence
    wordId:  'w_…',         // owning word id (for highlight + navigation)
    form:    'gitmek',      // raw surface form
    norm:    'gitmek',      // normalized per normPunctForSearch + case rules
    // derived field values are resolved on demand via existing helpers, not stored:
    //   gloss  → wordGloss(word)
    //   translit(label) → translitTextsForSearch(word, label)
  }, …
]

sent._normText         = '…'    // normalized sentence text (translation-field & text scans)
sent._normTranslations = ['…']  // normalized translation strings, one per translation entry
```

**Cross-boundary windows (Word+Sentence scope):** built on the fly per paragraph by concatenating member sentences' `_tokens` with a sentence-boundary tag on each token (`sentIdx`), so the matcher can slide a run across a sentence boundary while staying inside the paragraph and within a window of `W` sentences (default `W=2`). No paragraph-spanning.

**Lifecycle:** build on first access per sentence; invalidate the sentence's `_tokens`/`_normText`/`_normTranslations` in `reindexSentWords` (already the invalidation point for word edits). Zero global rebuild on edit.

**Why this matters:** KWIC alignment (needs token positions), collocates (needs ±window tokens), sentence bridging (needs a contiguous token sequence), and frequency (needs token surface forms) all read this one structure. It's required regardless of engine choice, and it's the seam Option B attaches to later.

---

## 5. Query model

A query is a **sequence of token-slot patterns** plus a **field** and a **scope**.

### 5.1 Token-slot pattern (one token)
Inherits Search-A's compiler exactly:
- `*`, any run of characters **within a single token** (`git*k`). Never crosses a token boundary.
- `(x)`, optional segment (branch with/without).
- **Regex mode.** the slot is a raw JS regex anchored to the whole token.
- Case sensitivity toggle; `normPunctForSearch` applied to both token and pattern (except gloss/translit, per existing rules).

### 5.2 Sequence (across tokens)
- Multiple slot patterns separated by spaces match a **contiguous run of tokens** in order.
- A single-slot query = single-token search (today's word/morpheme search).
- This is how "across word boundaries" is expressed, naturally, by listing more than one slot.

### 5.3 Scope (across sentences): **RESOLVED**
- **Single-sentence** (default): the token run must lie within one sentence.
- **Cross-sentence**: the run may bridge up to `W` consecutive sentences within the same paragraph (`W=2` default).
- Expression (**RESOLVED: both**):
  - **Scope selector** Word / Sentence (a UI toggle; "Sentence" enables bridging) for the common case.
  - **Inline boundary anchor.** an optional marker between two slots forcing a sentence boundary there (the cleaner successor to today's `<BREAK>`), as an advanced affordance for precision.

### 5.4 Field: **RESOLVED**
Fields: **Form · Transliteration(label) · Translation · Gloss** (+ Lemma, parity).
- Form / Gloss / Translit are **token-level** → slot patterns apply per token; KWIC node = matched token run.
- Translation is **sentence-level text** → the query matches as substring/regex over `_normTranslations`; KWIC node = matched substring within the translation. (Asymmetry is inherent and documented.)
- **RESOLVED: one field per query** in v1 (matches Search-A; simpler). Per-slot fields = future.

### 5.5 Level (parity)
Sentence / Word / Morpheme. At morpheme level the slot matches morpheme forms/glosses; **RESOLVED:** the KWIC node centers on the **whole word** containing the matched morpheme (consistent with word-level KWIC; click-through lands on the word). The matched morpheme is sub-highlighted within the node.

---

## 6. Matching semantics (precise)

- **Token** = one `word` (or `morpheme` at morpheme level). Punctuation handled by `normPunctForSearch` (strip `\p{P}\p{S}`, collapse spaces) for Form/Translation; **not** applied to Gloss (hyphens significant) or Translit (handled by translit helpers).
- A **hit** = a contiguous token run matching the slot sequence in order, honoring scope.
- **Overlapping hits:** **RESOLVED: report all matches.** Every starting position that yields a match is reported, even when spans overlap. Implication: a token may appear in multiple KWIC lines, and node-type frequency counts every match occurrence (overlaps included), accepted by design.
- **Result shape** (generalized from Search-A's `{sentId, matchedWordIds}`):
  ```
  { paraRef, sentIds:[…], nodeWordIds:[…], nodeSpan:{startSentIdx,startTok,endSentIdx,endTok} }
  ```
  carries enough for KWIC context extraction and highlight.

---

## 7. Concordance layer

### 7.1 KWIC (keyword-in-context)
- Line = **left context · node · right context**, node centered/aligned in a fixed column.
- Context window (**RESOLVED**): unit = **tokens**, default **12 each side** (adjustable in UI), plus a **"show full paragraph"** toggle that expands a line's context to the whole containing paragraph.
- Boundary crossing (**RESOLVED**): context **may cross sentence boundaries** within the paragraph, marked with a subtle `‖` glyph so the crossing is visible. (Full-paragraph mode naturally spans all sentence boundaries in the paragraph, each marked.)
- Click a line → open the source sentence (reuse existing `go('sentence', …)`).

### 7.2 Sort by context
- Sort keys: node form, then `L1, L2, …` (tokens left of node) and/or `R1, R2, …` (right). User picks anchor + direction.
- Sort on `norm` (case/punct-folded) for stable ordering; tie-break by corpus order.

### 7.3 Frequency & distribution
- **Node-type frequency:** collapse wildcard/variant matches to their surface `form`; table of `form → count`, sortable.
- **Distribution:** counts per **document** and per **section**; total hits; optional normalized rate (hits per 1k tokens).

### 7.4 Collocates / n-grams
- Collocates: tokens within ±`W_c` of the node (default `W_c=5`), aggregated, ranked.
- Ranking: **RESOLVED: raw frequency in v1.** Association measures (log-likelihood G² / PMI) deferred to v1.1.
- n-grams: frequency list of token sequences of length n around/including the node. **[OPEN]** scope of n-grams (whole corpus vs around node).
- Stopword/punct handling: punctuation already stripped; **[OPEN]** optional stoplist.

### 7.5 Export: **RESOLVED (v1.1)**
CSV/TSV export of KWIC lines and of frequency/collocate tables (the app already writes files via the Python bridge). **Not in v1, added in v1.1.**

---

## 8. UI

- New tab/label **"Search-B"** beside Search during transition; becomes "Search" at retirement.
- Query bar: field selector, level selector, scope toggle (§5.3), case/regex toggles (reuse existing chips), slot/sequence input.
- Results pane modes: **KWIC table** (new, default) with a toggle to **sentence-card view** (reuse `renderSearchResults`), plus **Frequency** and **Collocates** sub-tabs/panels.
- Result cap: **RESOLVED: 1,000 with pagination/virtualization** (Search-A's 200 is too low for concordance work).

---

## 9. Performance plan

- v1: scan + §4 substrate. Add `_normText`/`_normTranslations`/`_tokens` caches (closes DEV_PLAN C12/H1 en route).
- Frequency/collocates computed in the **same single pass** as matching where possible.
- Future (≥~30k sentences): attach a character-trigram postings index to the §4 substrate for infix-wildcard acceleration; exact/prefix via a token postings map. No concordance-layer changes required.
- FTS5: not pursued (§3).

---

## 10. Parity checklist (gate for retiring Search-A)

Search-B must match every Search-A capability before A is removed:

- [ ] Fields: Form, Gloss, Transliteration (multi-label incl. "any"), Translation, Lemma
- [ ] Levels: Sentence, Word, Morpheme
- [ ] Wildcard glob (`*`, `(x)`), whole-token anchoring
- [ ] Raw regex mode (with `\w/\b` ASCII warning)
- [ ] Case-sensitive toggle
- [ ] Cross-sentence (today's `<BREAK>`/concat behavior), covered by §5.3 scope
- [ ] Punctuation/Unicode normalization (`normPunctForSearch`)
- [ ] Result highlighting + click-through to source sentence
- [ ] Passes the existing search test matrix (67/67 + 78/78 korean-test) ported to Search-B

---

## 11. Test plan

- Port the existing Level×Field×Pattern×Case matrix (67/67) and korean-test (78/78) to Search-B; must stay green (parity gate).
- New concordance tests: KWIC alignment correctness, context-sort ordering, frequency/distribution totals vs brute-force counts, collocate windows at sentence boundaries, cross-sentence window bounds (no paragraph leakage).
- Mock corpus with deliberate boundary cases (sentence-final/initial nodes, adjacent duplicate forms, overlapping candidate runs).

---

## 12. Decisions

**Resolved (2026-06-12):**
1. **Cross-boundary expression** (§5.3): ✅ **both.** scope selector + optional inline boundary anchor.
2. **Field scope** (§5.4): ✅ **one field per query** in v1.
4. **Overlapping hits** (§6): ✅ **report all matches** (overlaps included; inflates frequency counts by design).
6. **Collocate measure** (§7.4): ✅ **raw frequency v1**; G²/PMI deferred to v1.1.
7. **Export** (§7.5): ✅ CSV/TSV for KWIC + freq/collocate tables, **v1.1, not v1**.
8. **Result cap** (§8): ✅ **1,000 + pagination/virtualization**.

**Resolved (cont.):**
3. **Morpheme-level KWIC node** (§5.5): ✅ **whole word** (morpheme sub-highlighted within it).
5. **KWIC context** (§7.1): ✅ **tokens, 12/side** (UI-adjustable) + **"show full paragraph"** toggle; context **crosses sentence boundaries** with a `‖` glyph.

**All §12 decisions resolved as of 2026-06-12 to spec ready for build sign-off.**

---

## 13. Suggested build sequence (post-spec, for later)

1. ~~Substrate (§4) + `_normText` caches~~ ✅ **v3.14.15.** `modules/search_b.js` (`sbSentTokens`/`sbSentNormText`/`sbSentNormTranslations`/`sbParaTokens`, lazy `_dataGen`-keyed). Tested by `dev/tests/search_b_test.js` (16/16). Closes data-side of C12/H1.
2. ~~Query model + matcher (§5–6) to parity~~ ✅ **v3.14.16.** `sbSearch()` in `modules/search_b.js`: live-parity routing (token/sentence/lemma, single+cross-sentence, `<BREAK>`, glob/regex/case), reusing Search-A's compiler + extractors. Validated by curated golden cases in `dev/tests/search_b_matcher_test.js` (13/13). Dormant slot POS/morph-type/optional deferred (spec §5.4). Token-level matching reads RAW fields (bit-for-bit parity); substrate `norm` reserved for the concordance layer. _Still inert, not wired to UI._
3. KWIC view + click-through (§7.1, §8).
4. Frequency & distribution (§7.3).
5. Sort-by-context (§7.2).
6. Collocates/n-grams (§7.4).
7. Parity sign-off (§10) → retire Search-A.
