/*
  =============================================================================
  Linguistic Corpus Toolkit (LingCoT), modules/search.js
  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
  =============================================================================

  Search: the query compiler, the matcher, the concordance builders and the view.

  ONE MODULE, ONE ENGINE, since v3.14.388. There were two of each. The original
  engine and its view — "Search-A" — were retired at v3.14.38 and deleted in
  pieces afterwards, and what stayed behind was a shared compiler layer in this
  file and a second engine called "Search-B" in `search_b.js` that called into
  it. That split described a migration that had finished: the two files could not
  be read separately, the compiler's state globals were set by one file and read
  by the other, and every name in the codebase carried a `B` distinguishing it
  from something that no longer existed.

  v3.14.388 merged them, deleted the last of Search-A, and dropped the `B`:
  `sbSearch` is `runSearch`, `_sb*` state folded into the `_srch*` globals it was
  already copying itself into, and the `sb-` CSS prefix joined `srch-`. The names
  the old engine's runners held — `_runTokenSearch`, `_runLemmaSearch`,
  `_runSentenceRx` — were free, and are used by the surviving engine's internals,
  which is where the `≈ runTokenSearch` comments used to point.

  WHAT IS HERE, in order:
    1. state              the toggles the view sets and the compiler reads
    2. the compiler       compileTokenQuery / parseQuery / parseBreakQuery /
                          compileCrossSentRx, plus the folds B-120 decided
    3. field extractors   normPunctForSearch, translitTextsForSearch,
                          translitMatchesQuery, collectTranslitLabels
    4. the substrate      sentTokens / paraTokens — the flat token streams the
                          matcher and the concordance both read
    5. the matcher        runSearch() and its seven runners
    6. concordance        buildKwic / buildFrequency / sortKwic / buildCollocates
    7. the view           renderSearch and its parts, plus renderSearchResults,
                          the IGT result-card builder the Sentences tab uses

  Loaded by LingCoT.html via: <script src="modules/search.js"></script>
  Depends on globals from LingCoT.html: S, go(), render(), esc(), mutate(),
  sentTrans(), normForm(), findSent(), findWord(), lookupDict(), etc.
  =============================================================================
*/

/* ── 1 · STATE ─────────────────────────────────────────────────────────────
   The toggles the view sets and the compiler reads. There were TWO sets of
   these until v3.14.388 — the view kept `_sb*` and copied them into `_srch*` on
   every search, because the compiler had been written for a different view. One
   set now, and `runSearch(opts)` still assigns from its argument so a guard can
   drive the engine without touching the view's state. */

/* The engine's result cap. The VIEW's cap is larger and separate — a
   concordance is read by scrolling and a hit list is not. */
const SEARCH_RESULT_CAP = 200;
const SEARCH_VIEW_CAP   = 1000;

let _srchField          = 'text';   // 'text'|'gloss'|'translit'|'translation'|'lemma'
let _srchLevel          = 'word';   // 'sentence'|'word'|'morpheme'
let _srchScope          = 'single'; // 'single'|'cross'
let _srchQuery          = '';
let _srchRegex          = false;    // raw JS regex instead of the wildcard syntax
let _srchCaseSensitive  = false;    // inoperable in regex mode: inline flags own case there
let _srchTranslitLabel  = 'any';    // 'any' | a specific label, e.g. 'RR' or 'Yale'
let _srchTranslitErr    = '';       // last regex parse error
let _srchTranslitWarnW  = false;    // pattern contains \w/\b/\W/\B (ASCII-only anchors)

/* View state: what is on screen, and the last run's output kept for the context
   rebuilds that do not need a re-search. */
let _srchContext    = 12;          // KWIC context tokens per side
let _srchFullPara   = false;       // show full-paragraph context
let _srchResultTab  = 'kwic';      // 'kwic'|'freq'|'coll'
let _srchHits       = null;        // last runSearch() hits
let _srchLines      = null;        // null = not run; [] = ran, no results
let _srchFreq       = null;
let _srchColl       = null;
let _srchError      = null;
let _srchSortAnchor = 'corpus';    // 'corpus'|'node'|'L1'..'L3'|'R1'..'R3'
let _srchSortDir    = 'asc';       // 'asc'|'desc'
let _srchCollWindow = 5;           // collocate window, ± tokens

/* ══════════════════════════════════════════════════════════════════════════════
   SEARCH  (Steps 1–4)
══════════════════════════════════════════════════════════════════════════════ */

/* ── Step 2b: compileTokenQuery ──────────────────────────────────────────
   Single entry point for compiling a user query string in either Glob or
   Regex mode.  Call this wherever parseQuery() would previously be called
   so that the Regex toggle takes effect consistently across all token, slot,
   and cross-sentence engines.

   Glob mode  (_srchRegex = false): delegates to parseQuery().
   Regex mode (_srchRegex = true):  compiles rawInput as a raw JS regex
     (case-insensitive, Unicode).  Sets _srchTranslitErr on parse failure
     and _srchTranslitWarnW when ASCII-only anchors like \w or \b are found.

   Returns { alternatives: [RegExp], hasNonPrefix: false } or null on empty/error. */
// @fn compileTokenQuery
function compileTokenQuery(rawInput, field = null) {
  const raw = rawInput.trim();
  if (!raw) return null;
  if (_srchRegex) {
    // Regex mode: compile as raw JS regex, always case-insensitive
    // (Case Sensitive toggle is grayed in Regex mode; users control case via inline flags)
    if (/\\[wWbB]/.test(raw)) _srchTranslitWarnW = true;
    try {
      // B-120: no fold in regex mode — the pattern is the user's, and folding
      // the subject under it would silently defeat a deliberate [A-Z].
      return _srchCompiled([new RegExp(raw, 'iu')], false, _SRCH_NO_FOLD);
    } catch (e) {
      _srchTranslitErr = e.message;
      return null;
    }
  }
  return parseQuery(raw, field);  // Glob mode
}

/* ── B-120, v3.14.279: the fold a FIELD is compared under ──────────────────
   `iu` is Unicode SIMPLE case folding, which does not map `İ` (U+0130) to `i` —
   the full mapping to "i" + U+0307 is excluded from it. So `/^ikna$/iu` did not
   match `İkna`, and searching a Turkish corpus for `ikna` returned none of its
   three occurrences. That is B-043 in a second module: the object language has
   its own casing rules and a regex flag does not know them.

   `normForm` is the app's object-language fold and already answers this — the
   same key every dictionary lookup uses. It is applied to BOTH sides, so the
   regex is built with `u` rather than `iu`: the fold does the case work, and
   leaving `i` on as well would hide which of the two was doing it.

   Only `text` folds this way. B-033's regime table is explicit that `gloss`,
   POS, definition and domain are METALANGUAGE — a Turkish corpus's English
   gloss "I" must not become "ı" — so they keep the regex flag. Case-sensitive
   mode folds nothing, which is the point of it, and regex mode is left to the
   user's own inline flags, which is its stated contract. */
/* One shared identity fold, so "is anything folding here?" is an identity test
   rather than a guess. A fresh arrow per call would make that test always true,
   and the `i` flag would come off the metalanguage fields too. */
const _SRCH_NO_FOLD = x => x || '';
// @fn srchFieldFold
function srchFieldFold(field) {
  return (field === 'text' && !_srchCaseSensitive && !_srchRegex && typeof normForm === 'function')
    ? normForm
    : _SRCH_NO_FOLD;
}

/* @fn _srchCompiled, a compiled query plus the one way to ASK it.
   Nine call sites did `alternatives.some(rx => rx.test(text))` by hand; a fold
   that half of them applied would be B-056's shape exactly. There is one
   reader now, and it owns both halves. */
function _srchCompiled(alternatives, hasNonPrefix, fold) {
  return {
    alternatives, hasNonPrefix, fold,
    /* Spelled `matches: function` rather than as a shorthand method, because
       `undefined_call_test.js` reads a bare `name(` at the start of a line as a
       CALL — and a call to something nothing defines is the ReferenceError it
       exists to catch (B-062). Being legible to the guard is worth two words. */
    matches: function (text) {
      const t = fold(text || '');
      return alternatives.some(rx => rx.test(t));
    },
  };
}

/* ── Step 2: parseQuery ───────────────────────────────────────────────────
   Pure function, no DOM access, no corpus access.
   Converts a raw user string into a list of RegExp alternatives.

   Supported syntax:
     *        anywhere in the token → matches any run of characters (like .* in regex)
     (x)      optional segment, expands into two branches: with x and without x
              multiple () groups are each expanded independently

   Returns { alternatives: RegExp[], hasNonPrefix: bool } or null if input is blank.
   hasNonPrefix is true when * appears somewhere other than the trailing position,
   which means we can't short-circuit on a simple prefix match (slower path). */
// @fn parseQuery
function parseQuery(rawInput, field = null) {
  const raw = rawInput.trim();
  if (!raw) return null;
  const fold = srchFieldFold(field);

  // Flag non-prefix wildcards: * at start or mid-token (not just at the very end)
  const hasNonPrefix = /^\*/.test(raw) || /\*./.test(raw);

  // Recursively expand (x) groups into separate variant strings.
  // Each (x) doubles the variant count, with x and without x.
  // Multiple groups are each handled in turn via recursion.
  function expandOpts(str) {
    const m = str.match(/\(([^)]*)\)/);  // find the first (..)
    if (!m) return [str];
    const before = str.slice(0, m.index);
    const inner  = m[1];
    const after  = str.slice(m.index + m[0].length);
    // Branch: include the inner content, or skip it entirely
    return [
      ...expandOpts(before + inner + after),
      ...expandOpts(before + after),
    ];
  }

  // Deduplicate (e.g. "()" with empty inner produces the same string twice)
  const variants = [...new Set(expandOpts(raw))];

  // Convert a variant string to an anchored RegExp.
  // Escape all regex metacharacters first, then un-escape our * wildcard.
  // Respects _srchCaseSensitive: uses 'u' (case-sensitive) or 'iu' (case-insensitive).
  function toRegex(str) {
    /* B-120: fold the PATTERN with the same key the subject will be folded
       with. `*` and the group parentheses are not letters, so they survive it
       untouched — and the groups are already expanded by this point. */
    const folded = fold(str);
    const escaped = folded.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); // escape meta
    const pattern = escaped.replace(/\*/g, '.*');               // * → .*
    // 'i' only where nothing folded: with a fold applied, it is the fold's job.
    const flags = (_srchCaseSensitive || fold !== _SRCH_NO_FOLD) ? 'u' : 'iu';
    return new RegExp(`^${pattern}$`, flags);  // whole-token, unicode
  }

  return _srchCompiled(variants.map(toRegex), hasNonPrefix, fold);
}

/* ── Search-time normalisation helpers ───────────────────────────────────
   normPunctForSearch, removes Unicode punctuation (\p{P}) and symbols (\p{S})
   from a string entirely (no replacement char), then collapses whitespace runs.
   Removing rather than replacing avoids false word-splits: "it's" → "its" not
   "it s"; "well-known" → "wellknown" not "well known".

   Applied at sentence level to the 'text' and 'translation' corpus strings AND
   to the user's query for those fields, so that sentence-final '.', commas, and
   similar characters never block a match.

   NOT applied to 'gloss' (hyphens such as language-TOP are linguistically
   significant and must not be modified) or 'translit' (morpheme-boundary hyphens
   are handled separately by translitTextsForSearch / sentTranslitByLabel).

   Using [\p{P}\p{S}] (punctuation + symbols) rather than just \p{P} eliminates
   the \p{P} vs \p{S} gap: after stripping, both corpus and query strings contain
   only letters, digits, marks, and whitespace, so inter-token gaps in the corpus
   (e.g. '@', '©', '–') can never block a match.

   Note: '<' and '>' are Unicode symbols (\p{S}), so <BREAK> markers must be
   detected in the raw query before normPunctForSearch is applied. */
// @fn normPunctForSearch
function normPunctForSearch(str) {
  if (!str) return '';
  return str.replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim();
}

/* ── Search-time transliteration helpers ─────────────────────────────────
   wordTranslit() joins morpheme transliterations with '-' (e.g. 있다 → 'it-da').
   For search we need two behaviours:

   • Specific label (e.g. 'RR', 'Yale'): test only that system → one value.
   • label = 'any': test ALL systems independently → one value per distinct label,
     so 'itda' (RR) OR 'issta' (Yale) can match the same word. Each system's
     morphemes are joined without hyphens; labels are never mixed across morphemes.

   translitTextsForSearch(w, label) → string[]
     Returns the deduplicated list of normalised (hyphen-stripped) translit strings
     that should be tested against the compiled query. Works for both words and
     morphemes. Display callers continue to call wordTranslit() directly. */
// @fn translitTextsForSearch
function translitTextsForSearch(w, label) {
  const out = new Set();
  const wanted = (label && label !== 'any') ? String(label) : null;

  /* B-203: the item's OWN elements, every one of them.
     This function used to answer only through `wordTranslit`, which returns THE
     reading for a label — one string, `arr.find(t => t.label === lbl)`. A list
     with two entries under one label is two readings, and the second was
     unreachable from search: the annotator could write it down, see it in the
     row editor, and never find it again. Unlabelled entries were worse, because
     the label set below skips them entirely and the whole item fell to the
     legacy scalar path, which is also first-only.

     Measured on the shipped fixtures: `turkish-test`'s morpheme `sıcak` carries
     `sïjak` and `sïdjak`, and `chinese-test`'s morpheme `过` carries `guò` and
     `guo4`. Before this, searching for `sïdjak` or `guo4` returned nothing.
     Invisible until a corpus had a multi-element list, which is what D58 asked
     for one for. */
  for (const t of (w.transliterations || [])) {
    if (!t || !t.text) continue;
    if (wanted !== null && (t.label || '') !== wanted) continue;
    const v = String(t.text).replace(/-/g, '');
    if (v) out.add(v);
  }

  /* And the DERIVED reading: a word's transliteration is the join of its
     morphemes' under one label, which is a string no single element holds. That
     is what `wordTranslit` is for, and it stays the only producer of it. */
  const labels = new Set();
  for (const t of (w.transliterations || []))    if (t.label) labels.add(t.label);
  for (const m of (w.morphemes       || []))
    for (const t of (m.transliterations || []))  if (t.label) labels.add(t.label);

  const derive = wanted !== null ? [wanted] : (labels.size ? [...labels] : [null]);
  for (const lbl of derive) {
    const t = (wordTranslit(w, lbl) || '').replace(/-/g, '');
    if (t) out.add(t);
  }
  return [...out];
}

// @fn translitMatchesQuery
// Returns true when any translit candidate for w matches any compiled alternative.
/* B-120: takes the COMPILED QUERY rather than its `alternatives`, so the fold
   travels with the pattern it belongs to. A transliteration is object-language
   material written in another script; it takes whatever fold the query carries,
   which for the translit field is the identity — its own fold is D32's question,
   not this one's. */
function translitMatchesQuery(w, label, q) {
  const alts = q.alternatives || q;                    // tolerate a bare array
  const fold = q.fold || _SRCH_NO_FOLD;
  return translitTextsForSearch(w, label).some(txt => alts.some(rx => rx.test(fold(txt))));
}

/* ── Step 4: renderSearchResults ─────────────────────────────────────────
   Renders an array of hit objects as result cards.

   Single-sentence hits:  { sentId, matchedWordIds }
   Cross-sentence hits:   { sentIds: string[], matchedWordIds: string[][] }  (N sentences)
   Legacy cross-sent:     { sentId, sentId2, matchedWordIds, matchedWordIds2 } (kept for compat)

   Each card shows:
     • one muted context line before the first sentence (if not first in paragraph)
     • a compact IGT block (word form + gloss tiers) with hits highlighted
     • for cross-sentence hits: a ↵ divider then a second IGT block
     • the free translation(s) if present
     • one muted context line after the last sentence (if not last in paragraph)
     • a breadcrumb footer with a "→ go to sentence" nav link            */
// @fn renderSearchResults
function renderSearchResults(hits) {

  // Helper: wrap the matched substring in <mark> for in-line highlighting.
  // rx is reset to avoid lastIndex issues with sticky/global flags.
  // Returns esc(rawText) unchanged if rx is null or no match found.
  function highlightMatch(rawText, rx) {
    if (!rawText || !rx) return esc(rawText || '');
    rx.lastIndex = 0;
    const m = rx.exec(rawText);
    if (!m || !m[0]) return esc(rawText);
    const before  = rawText.slice(0, m.index);
    const matched = m[0];
    const after   = rawText.slice(m.index + matched.length);
    return esc(before) + '<mark>' + esc(matched) + '</mark>' + esc(after);
  }

  // Helper: build one IGT block (form + optional translit + gloss rows) for a sentence.
  // hitSet is a Set of word IDs that should be highlighted.
  // translitLabel (optional): when set, wordTranslit uses this label for the translit row
  //   instead of the corpus default.  Pass _srchTranslitLabel when field=translit so the
  //   IGT shows the same label the user searched by.
  function igtBlock(sent, hitSet, translitLabel) {
    const words = sent.words || [];
    if (!words.length) {
      // No words tokenised yet, fall back to raw sentence text
      return `<div class="srch-ctx-text">${esc(sent.text)}</div>`;
    }
    // Pre-compute per-word values once so wordGloss/wordTranslit run exactly once each.
    // translitLabel may be undefined (→ wordTranslit uses corpus default) or a label string.
    // B-059: this row is IGT, so it asks for gaps. The PUNCT test below is
    // unaffected, punctuation has no morphemes and takes the compact path.
    const wExtras = words.map(w => ({ gloss: wordGloss(w, { gaps: true }), translit: wordTranslit(w, translitLabel) }));
    const showTranslit = wExtras.some(d => d.translit);
    const cols = words.map((w, wi) => {
      const { gloss, translit } = wExtras[wi];
      // B-151: the same test as the sentence IGT, which is the same question.
      const isPunct = !_navIsToken(w) || gloss === 'PUNCT';
      const hitCls  = hitSet.has(w.id) ? ' srch-hit' : '';
      const pCls    = isPunct ? ' punct' : '';
      return `<div class="srch-igt-word${hitCls}${pCls}">
          <div class="srch-igt-form">${esc(w.form)}</div>
          ${showTranslit ? `<div class="srch-igt-translit">${translit ? esc(translit) : ''}</div>` : ''}
          <div class="srch-igt-gloss">${gloss ? esc(gloss) : ''}</div>
        </div>`;
    }).join('');
    return `<div class="srch-igt-wrap">${cols}</div>`;
  }

  return hits.map(hit => {

    // ── New N-sentence result shape from runTokenSearchCrossSent ──────────
    // { sentIds: string[], matchedWordIds: string[][] }
    // Each sentIds[k] is one consecutive sentence; matchedWordIds[k] its highlights.
    if (hit.sentIds) {
      const sentRefs = hit.sentIds.map(id => S.sentById.get(id));
      if (sentRefs.some(r => !r)) return '';  // missing sentence, skip card

      const first   = sentRefs[0];
      const lastRef = sentRefs[sentRefs.length - 1];
      const { para, paraIdx, sect, sectIdx, docIdx } = first;
      const sentIdxFirst = first.sentIdx;
      const sentIdxLast  = lastRef.sentIdx;

      // docIdx stored in sentById at index time. O(1) instead of O(docs×sections) scan
      const parentDoc = S.docs[docIdx] || S.docs[S.docIdx];
      const docTitle  = parentDoc?.metadata?.title || parentDoc?.id || 'Document';
      const sectTitle = sect.title || `Section ${sectIdx + 1}`;

      const prevSent = sentIdxFirst > 0
        ? para.sentences[sentIdxFirst - 1] : null;
      const nextSent = sentIdxLast < para.sentences.length - 1
        ? para.sentences[sentIdxLast + 1] : null;

      // Build one card-body per sentence, joined by sentence-break dividers
      const DIVIDER = `
        <div class="srch-card-sent-break">
          <div class="srch-card-sent-break-line"></div>
          <span class="srch-card-sent-break-label">${t('label.sb.sent_break')}</span>
          <div class="srch-card-sent-break-line"></div>
        </div>`;
      // Determine the translit label to pass to igtBlock (only when field=translit).
      const igtTranslitLabel = _srchField === 'translit' ? _srchTranslitLabel : undefined;

      const bodies = sentRefs.map((ref, k) => {
        const hitSet = new Set(hit.matchedWordIds[k]);
        // Use the specific matched entry stored by the search engine, falling back to
        // the first translation if the result predates matchedTexts (e.g. legacy hits).
        const rawCardTrans = hit.matchedTexts?.[k] ?? sentTrans(ref.sent);
        // Use the per-sentence highlight regex stored by the search runner (if any).
        // For BREAK queries rx1/rx2 are exact; for spanning queries they are derived
        // via token-split search.  Falls back gracefully to no highlight when null.
        const hlRx = hit.matchedRxs?.[k] ?? null;
        const cardTransHtml = rawCardTrans
          ? `<div class="srch-card-trans">${highlightMatch(rawCardTrans, hlRx)}</div>`
          : '';
        return `<div class="srch-card-body">
          ${igtBlock(ref.sent, hitSet, igtTranslitLabel)}
          ${cardTransHtml}
        </div>`;
      }).join(DIVIDER);

      return `
      <div class="srch-card">
        ${prevSent ? `<div class="srch-ctx">${esc(prevSent.text)}</div>` : ''}
        ${bodies}
        ${nextSent ? `<div class="srch-ctx srch-ctx-after">${esc(nextSent.text)}</div>` : ''}
        <div class="srch-card-footer">
          <span class="srch-bc">
            <span class="srch-bc-link" data-go="document">${esc(docTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="section" data-si="${sectIdx}">${esc(sectTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="paragraph" data-si="${sectIdx}" data-pi="${paraIdx}">¶${paraIdx + 1}</span>
          </span>
          <span class="srch-go-sent"
                data-go="sentence"
                data-sid="${escAttr(hit.sentIds[0])}"
                data-si="${sectIdx}"
                data-pi="${paraIdx}">${t('btn.sb.goto_sentence')}</span>
        </div>
      </div>`;
    }

    // ── Legacy two-sentence shape from runSlotSearchCrossSent ─────────────
    // { sentId, sentId2, matchedWordIds, matchedWordIds2 }
    const isCrossSent = !!hit.sentId2;

    // Look up the first (or only) sentence
    const r1 = S.sentById.get(hit.sentId);
    if (!r1) return '';
    const { sent: sent1, para, paraIdx, sect, sectIdx, sentIdx: sentIdx1, docIdx } = r1;

    // Breadcrumb, docIdx stored in sentById at index time; O(1) lookup
    const parentDoc = S.docs[docIdx] || S.docs[S.docIdx];
    const docTitle  = parentDoc?.metadata?.title || parentDoc?.id || 'Document';
    const sectTitle = sect.title || `Section ${sectIdx + 1}`;

    if (isCrossSent) {
      // ── Cross-sentence card: two stacked IGT blocks with a ↵ divider ──
      const r2 = S.sentById.get(hit.sentId2);
      if (!r2) return '';
      const { sent: sent2, sentIdx: sentIdx2 } = r2;

      // Context: sentence before sent1 and sentence after sent2
      const prevSent = sentIdx1 > 0 ? para.sentences[sentIdx1 - 1] : null;
      const nextSent = sentIdx2 < para.sentences.length - 1
        ? para.sentences[sentIdx2 + 1] : null;

      const hitSet1 = new Set(hit.matchedWordIds);
      const hitSet2 = new Set(hit.matchedWordIds2);

      // Translit label for IGT display (only meaningful when field=translit)
      const legacyCsIgtLabel = _srchField === 'translit' ? _srchTranslitLabel : undefined;
      return `
      <div class="srch-card">
        ${prevSent ? `<div class="srch-ctx">${esc(prevSent.text)}</div>` : ''}
        <div class="srch-card-body">
          ${igtBlock(sent1, hitSet1, legacyCsIgtLabel)}
          ${sentTrans(sent1) ? `<div class="srch-card-trans">${esc(sentTrans(sent1))}</div>` : ''}
        </div>
        <div class="srch-card-sent-break">
          <div class="srch-card-sent-break-line"></div>
          <span class="srch-card-sent-break-label">${t('label.sb.sent_break')}</span>
          <div class="srch-card-sent-break-line"></div>
        </div>
        <div class="srch-card-body">
          ${igtBlock(sent2, hitSet2, legacyCsIgtLabel)}
          ${sentTrans(sent2) ? `<div class="srch-card-trans">${esc(sentTrans(sent2))}</div>` : ''}
        </div>
        ${nextSent ? `<div class="srch-ctx srch-ctx-after">${esc(nextSent.text)}</div>` : ''}
        <div class="srch-card-footer">
          <span class="srch-bc">
            <span class="srch-bc-link" data-go="document">${esc(docTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="section" data-si="${sectIdx}">${esc(sectTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="paragraph" data-si="${sectIdx}" data-pi="${paraIdx}">¶${paraIdx + 1}</span>
          </span>
          <span class="srch-go-sent"
                data-go="sentence"
                data-sid="${escAttr(hit.sentId)}"
                data-si="${sectIdx}"
                data-pi="${paraIdx}">${t('btn.sb.goto_sentence')}</span>
        </div>
      </div>`;
    }

    // ── Single-sentence card (original path) ──
    const hitSet  = new Set(hit.matchedWordIds);
    const prevSent = sentIdx1 > 0 ? para.sentences[sentIdx1 - 1] : null;
    const nextSent = sentIdx1 < para.sentences.length - 1
      ? para.sentences[sentIdx1 + 1] : null;

    // For the translation field, use the specific matched entry (hit.matchedText) rather
    // than always showing translations[0].  For other fields, fall back to the first entry.
    const rawTrans = (_srchField === 'translation' && hit.matchedText)
      ? hit.matchedText
      : sentTrans(sent1);
    // Highlight the matched substring when field=translation (rx is a single-sentence pattern
    // that can match within the displayed string).  Skip highlight for other fields because
    // the display string (translation) differs from the searched field (text/gloss/translit).
    const transHtml = rawTrans
      ? `<div class="srch-card-trans">${highlightMatch(rawTrans, _srchField === 'translation' ? _srchLastRx : null)}</div>`
      : '';

    // When field=translit, pass the searched label to igtBlock so the translit row shows
    // the same system the user searched by instead of the corpus default.
    const singleIgtLabel = _srchField === 'translit' ? _srchTranslitLabel : undefined;

    return `
      <div class="srch-card">
        ${prevSent ? `<div class="srch-ctx">${esc(prevSent.text)}</div>` : ''}
        <div class="srch-card-body">
          ${igtBlock(sent1, hitSet, singleIgtLabel)}
          ${transHtml}
        </div>
        ${nextSent ? `<div class="srch-ctx srch-ctx-after">${esc(nextSent.text)}</div>` : ''}
        <div class="srch-card-footer">
          <span class="srch-bc">
            <span class="srch-bc-link" data-go="document">${esc(docTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="section" data-si="${sectIdx}">${esc(sectTitle)}</span>
            <span class="srch-bc-sep">›</span>
            <span class="srch-bc-link" data-go="paragraph" data-si="${sectIdx}" data-pi="${paraIdx}">¶${paraIdx + 1}</span>
          </span>
          <span class="srch-go-sent"
                data-go="sentence"
                data-sid="${escAttr(hit.sentId)}"
                data-si="${sectIdx}"
                data-pi="${paraIdx}">${t('btn.sb.goto_sentence')}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Step 5c: Sentence-level cross-sentence search ───────────────────────
   Slides a 2-sentence window over each paragraph and tests whether the compiled
   pattern matches any pair of adjacent sentences.

   getStrs(sent) → string[]
     Returns the list of searchable strings for a sentence in the chosen field.
     For translation this is all translation texts (multiple entries); for other
     fields it is a single-element array. Combinations across all pairs of
     (s1_value, s2_value) are tried so that cross-entry matches are found.

   compileCrossSentRx(rawQuery) → RegExp | null
     In glob mode: splits the query on whitespace, escapes each token (preserving
     * → .*), then joins them with \s+ (plain whitespace).  Punctuation has already
     been stripped from both the query and the corpus strings for the 'text' and
     'translation' fields by normPunctForSearch() before this function is called,
     so the inter-token separator only needs to match whitespace.

     Behaviour summary (after normPunctForSearch applied by caller for text/translation):
       "humans It"   → humans\s+It, matches "humans It", "humans\nIt" ✓
       "humans. It"  → humans\s+It, query dot is stripped before compilation ✓
     For fields not normalised (gloss, translit), the query is passed as-is and
     \s+ matches the single space that separates tokens in those field strings.
*/
// @fn compileCrossSentRx
function compileCrossSentRx(rawQuery) {
  if (!rawQuery.trim()) return null;
  const flags = _srchCaseSensitive ? 'u' : 'iu';

  if (_srchRegex) {
    // Raw regex mode: compile the query as-is; user controls the pattern fully.
    // Note: for text/translation fields the corpus strings are punct-normalised,
    // so raw-regex patterns should not include punctuation characters.
    try { return new RegExp(rawQuery, flags); }
    catch (e) { _srchTranslitErr = e.message; return null; }
  }

  // Glob mode:
  //   1. Split on whitespace runs → individual tokens
  //   2. Escape regex metacharacters within each token, then * → .*
  //   3. Join with \s+, punctuation is pre-stripped so only whitespace remains
  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
  const parts  = tokens.map(tok =>
    tok.replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // escape regex metacharacters
       .replace(/\*/g, '.*')                     // glob wildcard
  );
  try {
    return new RegExp(parts.join('\\s+'), flags);
  } catch (e) {
    _srchTranslitErr = e.message;
    return null;
  }
}


// @fn collectTranslitLabels
// Returns sorted array of all transliteration label strings present in the corpus
// (e.g. 'RR', 'Yale'). Reads from S.translitLabels cache. O(labels.size) instead
// of O(corpus). Cache is built at load time and updated incrementally on word save.
function collectTranslitLabels() {
  return [...S.translitLabels].sort();
}


/* ── parseBreakQuery ──────────────────────────────────────────────────────
   Parse a raw query string for <BREAK> markers.

   Rules:
     · \<BREAK>         → literal string "<BREAK>" passed through unchanged
     · <BREAK> at start → sentence-initial anchor (sentInitial = true)
     · <BREAK> at end   → sentence-final anchor   (sentFinal = true)
     · <BREAK> between  → sentence-boundary constraint between those segments
     · Consecutive <BREAK> markers (empty middle segment) → error

   Returns:
     { segments: string[], trimmed, non-empty token-pattern strings
       sentInitial: bool, first match must be sentence-initial word
       sentFinal:   bool, last match must be sentence-final word
       hasBREAK:    bool, true if any unescaped <BREAK> was found
       error:       string|null }
// @fn parseBreakQuery */
function parseBreakQuery(raw) {
  // Protect escaped \<BREAK> with a placeholder before splitting
  const PLACEHOLDER = '\x00LITERALBREAK\x00';
  const guarded  = raw.replace(/\\<BREAK>/g, PLACEHOLDER);
  const rawParts = guarded.split('<BREAK>');

  // Restore placeholder to literal text and trim whitespace
  const parts = rawParts.map(p =>
    p.replace(new RegExp(PLACEHOLDER, 'g'), '<BREAK>').trim()
  );

  // No <BREAK> found, ordinary single-sentence query
  if (parts.length === 1) {
    return { segments: [parts[0]], sentInitial: false, sentFinal: false,
             hasBREAK: false, error: null };
  }

  // Consecutive <BREAK>: any middle segment (not first or last) that is empty
  for (let i = 1; i < parts.length - 1; i++) {
    if (parts[i] === '') {
      return { segments: [], sentInitial: false, sentFinal: false, hasBREAK: true,
               error: t('status.sb.break_consecutive') };
    }
  }

  // Edge-empty parts become positional anchor flags rather than search segments
  const sentInitial = parts[0] === '';
  const sentFinal   = parts[parts.length - 1] === '';

  const segments = parts.filter((p, i) => {
    if (i === 0                  && sentInitial) return false;
    if (i === parts.length - 1  && sentFinal)   return false;
    return true;  // keep all non-edge, and non-empty edge parts
  });

  // Guard: nothing left to match (e.g. a lone <BREAK>)
  if (segments.length === 0) {
    return { segments: [], sentInitial, sentFinal, hasBREAK: true,
             error: t('status.sb.break_empty') };
  }

  return { segments, sentInitial, sentFinal, hasBREAK: true, error: null };
}


/* ════════════════════════════════════════════════════════════════════════════
   THE SUBSTRATE — cached token streams, per sentence and per paragraph
   ────────────────────────────────────────────────────────────────────────────
   What every matcher and every concordance builder reads from: a cached,
   position-indexed token stream per sentence, the normalised text and
   translation caches beside it, and a per-paragraph flat sequence for the
   cross-boundary work.

   CACHING. Lazy build on first access, keyed to the global `_dataGen` counter
   that `mutate()` increments on every corpus edit. No work at load time; a
   sentence's caches are rebuilt only when something reads them after a
   mutation. `_dataGen` is global, so any edit logically invalidates every
   sentence's caches, but the cost is paid lazily and only where it is read.
   ════════════════════════════════════════════════════════════════════════════ */

/* @fn _cache, park a runtime value on a corpus object WITHOUT it reaching disk.

   B-204. These caches are written onto the annotator's own records — a sentence
   gets `_srchTokens`, a paragraph gets `_srchParaTokens` — and `serializeRecords`
   stringifies whatever a record enumerates. `_srchTokens` holds one entry per
   word, each carrying a REFERENCE to the word object, so saving after a
   concordance wrote every word into the file a second time inside its own
   sentence. **Measured on `turkish-test`: 85,964 characters clean, 230,125 after
   one KWIC — the file grew 168% and gained 64 keys the format does not have.**

   Non-enumerable, so `JSON.stringify` cannot see them and no serializer has to
   remember to exclude them. A plain assignment creates an enumerable property,
   which is how this happened, so nothing here may assign to a cache key
   directly — `_cache` is the one writer. */
function _cache(obj, key, value) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) { obj[key] = value; return value; }
  Object.defineProperty(obj, key, { value, writable: true, enumerable: false, configurable: true });
  return value;
}

/* ── Cache freshness guard ───────────────────────────────────────────────────
   All three per-sentence caches invalidate together on any data mutation, so a
   single generation stamp per sentence suffices. When the global generation has
   advanced past the stamp, clear the caches and re-stamp; the individual
   accessors below rebuild their field lazily on the next read. */
// @fn _ensureSentFresh
function _ensureSentFresh(sent) {
  if (sent._srchGen !== _dataGen) {
    _cache(sent, '_srchTokens', null);
    _cache(sent, '_srchNormText', null);
    _cache(sent, '_srchNormTrans', null);
    _cache(sent, '_srchGen', _dataGen);
  }
}

/* ── sentTokens ────────────────────────────────────────────────────────────
   Word-level token stream for one sentence: one token per word. Morpheme-level
   matching reads token.w.morphemes on demand, the KWIC node is always the whole
   word (spec §5.5), so the substrate does not pre-flatten morphemes.

   Token shape:
     {
       i:      0-based position of the word within the sentence,
       wordId: owning word id (for highlight + click-through),
       w:      reference to the word object, derived fields are resolved on
               demand by the matcher via wordGloss(w) / translitTextsForSearch(w,
               label); they are intentionally NOT stored here,
       form:   raw surface form, preserved for display / KWIC rendering,
       norm:   punctuation-normalized surface form, CASE PRESERVED.
     }

   Why norm preserves case: case folding is applied by the matcher through regex
   flags, the way `parseQuery` does. Lowercasing here would silently
   break case-sensitive search. normPunctForSearch() strips \p{P}\p{S} and
   collapses whitespace, which makes token matching punctuation-robust, a
   deliberate refinement over the raw-form word matching the first engine did (spec
   §6). Frequency/sort layers that want case-insensitive grouping fold case
   themselves at aggregation time. */
// @fn sentTokens
function sentTokens(sent) {
  _ensureSentFresh(sent);
  if (sent._srchTokens) return sent._srchTokens;

  const toks  = [];
  const words = sent.words || [];
  for (let i = 0; i < words.length; i++) {
    const w    = words[i];
    const form = w.form || '';
    toks.push({ i, wordId: w.id, w, form, norm: normPunctForSearch(form) });
  }
  return _cache(sent, '_srchTokens', toks);
  return toks;
}

/* ── sentNormText ──────────────────────────────────────────────────────────
   Normalized sentence text (punctuation stripped, whitespace collapsed). Used by
   the Text-field scan and by KWIC over raw sentence text. */
// @fn sentNormText
function sentNormText(sent) {
  _ensureSentFresh(sent);
  if (sent._srchNormText == null) _cache(sent, '_srchNormText', normPunctForSearch(sent.text || ''));
  return sent._srchNormText;
}

/* ── sentNormTranslations ──────────────────────────────────────────────────
   One normalized string per translation entry. The Translation field is
   sentence-level and a sentence may carry several translations, so this returns
   an array; empty results are dropped. */
// @fn sentNormTranslations
function sentNormTranslations(sent) {
  _ensureSentFresh(sent);
  if (sent._srchNormTrans == null) {
    _cache(sent, '_srchNormTrans', (sent.translations || [])
      .map(t => normPunctForSearch(t.text || ''))
      .filter(Boolean));
  }
  return sent._srchNormTrans;
}

/* ── paraTokens ────────────────────────────────────────────────────────────
   Flat token sequence spanning all sentences of a paragraph. This is the
   substrate for Word+Sentence cross-boundary matching and for KWIC context that
   bridges sentence boundaries (spec §4, §7.1). Cross-paragraph bridging is out of
   scope, so the sequence is bounded by the paragraph.

   Each entry extends an sentTokens entry with its position in the paragraph:
     {
       ..token,            // i, wordId, w, form, norm
       sentIdx:  index of the owning sentence within para.sentences,
       sentId:   owning sentence id,
       localI:   token index within its own sentence (=== token.i),
       g:        global index within this paragraph token sequence.
     }
   A sentence boundary sits between entries whose sentIdx differs; renderers use
   that to draw the ‖ boundary glyph (spec §7.1).

   Cached on the paragraph and gen-keyed like the sentence caches. Rebuilds are
   cheap: a concatenation of already-cached per-sentence token arrays. */
// @fn paraTokens
function paraTokens(para) {
  if (para._srchParaGen !== _dataGen) {
    _cache(para, '_srchParaTokens', null);
    _cache(para, '_srchParaGen', _dataGen);
  }
  if (para._srchParaTokens) return para._srchParaTokens;

  const flat  = [];
  const sents = para.sentences || [];
  let g = 0;
  for (let s = 0; s < sents.length; s++) {
    const sent = sents[s];
    for (const tok of sentTokens(sent)) {
      flat.push({ ...tok, sentIdx: s, sentId: sent.id, localI: tok.i, g: g++ });
    }
  }
  return _cache(para, '_srchParaTokens', flat);
}


/* ════════════════════════════════════════════════════════════════════════════
   5 · THE MATCHER
   ────────────────────────────────────────────────────────────────────────────
   Token-sequence matching over word and morpheme level, sentence-level string
   matching, all four fields (text/gloss/translit/translation) plus lemma, single
   and cross-sentence scope, <BREAK> anchors, glob/regex/case modes.

   *This was written to reproduce a previous engine exactly, and the block that
   stood here recorded every place it matched that engine bit-for-bit. The
   engine is gone (v3.14.38, deleted in full v3.14.388) and reproducing it is no
   longer a property anybody can check, so what follows is what the matcher DOES
   rather than what it once agreed with. Two of those notes were load-bearing and
   are kept below as rules in their own right.*

   TWO RULES ABOUT WHAT IS COMPARED, and they differ by level on purpose:
   - **Token level reads the RAW form, gloss or translit.** The substrate's
     punctuation-normalised `norm` is deliberately NOT used at match time; it is
     for the concordance, sort and collocate layers, where a comma should not
     count as a word.
   - **Sentence level DOES use the normalised caches** (`sentNormText`,
     `sentNormTranslations`), because a sentence-level query is matched against
     running text and punctuation there is noise.

   NOT BUILT: per-slot POS / morpheme-type filters and optional slots. The
   "Advanced" slot panel they belonged to was part of the retired view.

   ENTRY POINT
     runSearch(opts) → { hits, error }
       opts: { query, field='text', level='word', crossSent=false,
               translitLabel='any', regex=false, caseSensitive=false,
               cap=SEARCH_RESULT_CAP }
       field: 'text' | 'gloss' | 'translit' | 'translation' | 'lemma'
       level: 'sentence' | 'word' | 'morpheme'
     hit (unified shape):
       { sentIds: string[],            // 1 entry (single-sentence) or N (cross-sent)
         matchedWordIds: string[][],   // matched word ids per sentence, parallel to
                                       //   sentIds; [[]] for sentence-level fields
         matchedTexts?: string[],      // sentence-level: the field value(s) that matched
         matchedRxs?: (RegExp|null)[] }// sentence-level: per-sentence highlight regex

   `runSearch` assigns the shared toggle globals from `opts`, so a guard can
   drive it without touching the view's state — which is what every golden case
   in `search_matcher_test.js` does.
   ════════════════════════════════════════════════════════════════════════════ */

/* Pure-punctuation token detector. A word whose
   form has no letters or digits (e.g. "(", ",", "-") must not break adjacency
   between a sentence-final and sentence-initial content token. */
// @fn _isPunct
function _isPunct(f) { return /^[^\p{L}\p{N}]+$/u.test(f || ''); }

/* ── Single-token whole-corpus scan (≈ runTokenSearch) ───────────────────────
   One hit per matching sentence; matchedWordIds lists the matched words. */
// @fn _runTokenSearch
function _runTokenSearch(field, level, q, label, cap) {
  const out  = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || []))
        for (const sent of (para.sentences || [])) {
          const ids = [];
          for (const word of (sent.words || [])) {
            let m = false;
            if (level === 'word') {
              if (field === 'text')       m = q.matches(word.form);
              else if (field === 'gloss') m = q.matches(wordGloss(word));
              else                        m = translitMatchesQuery(word, label, q);
            } else {
              for (const morph of (word.morphemes || [])) {
                if (field === 'text')       { if (q.matches(morph.form))  { m = true; break; } }
                else if (field === 'gloss') { if (q.matches(morph.gloss)) { m = true; break; } }
                else                        { if (translitMatchesQuery(morph, label, q)) { m = true; break; } }
              }
            }
            if (m) ids.push(word.id);
          }
          if (ids.length) {
            out.push({ sentIds: [sent.id], matchedWordIds: [ids] });
            if (out.length >= cap) return out;
          }
        }
  return out;
}

/* ── Consecutive multi-token sliding window (≈ runConcatCrossSent) ───────────
   tokens, array of compiled token queries (one per slot in the sequence).
   breakSet, positions where a sentence boundary is required; breakSet.has(0) =
              sentence-initial anchor, breakSet.has(tokens.length) = sentence-final.
   strict, when true, non-BREAK adjacent tokens must stay in the same sentence
              (single-sentence multi-token search). With a non-empty breakSet,
              strict boundaries are implied.
   Paragraph-scoped; morpheme level expands words into individual morphemes and
   collapses matched morphemes to their parent word id in the output. */
// @fn _runConcat
function _runConcat(field, level, tokens, breakSet, strict, label, cap) {
  if (!tokens || tokens.length === 0) return [];
  const N   = tokens.length;
  const out = [];

  function itemMatches(item, q) {
    if (level === 'word') {
      if (field === 'text')  return q.matches(item.form);
      if (field === 'gloss') return q.matches(wordGloss(item));
      return translitMatchesQuery(item, label, q);
    }
    if (field === 'text')  return q.matches(item.form);
    if (field === 'gloss') return q.matches(item.gloss);
    return translitMatchesQuery(item, label, q);
  }

  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || [])) {
        // Build the level-appropriate flat list for this paragraph, excluding
        // pure-punctuation words so they don't break content adjacency.
        const flat  = [];
        const sents = para.sentences || [];
        for (let si = 0; si < sents.length; si++) {
          const sent  = sents[si];
          const words = (sent.words || []).filter(w => !_isPunct(w.form));
          if (level === 'morpheme') {
            for (let wi = 0; wi < words.length; wi++) {
              const word   = words[wi];
              const morphs = (word.morphemes && word.morphemes.length) ? word.morphemes : [word];
              for (let mi = 0; mi < morphs.length; mi++) {
                flat.push({
                  item: morphs[mi], wordId: word.id, sentId: sent.id, sentIdx: si,
                  isFirst: wi === 0 && mi === 0,
                  isLast:  wi === words.length - 1 && mi === morphs.length - 1,
                });
              }
            }
          } else {
            for (let wi = 0; wi < words.length; wi++) {
              const word = words[wi];
              flat.push({
                item: word, wordId: word.id, sentId: sent.id, sentIdx: si,
                isFirst: wi === 0, isLast: wi === words.length - 1,
              });
            }
          }
        }
        if (flat.length < N) continue;

        for (let start = 0; start <= flat.length - N; start++) {
          if (!itemMatches(flat[start].item, tokens[0])) continue;
          if (breakSet.has(0) && !flat[start].isFirst) continue;

          const strictBoundaries = strict || breakSet.size > 0;
          let ok = true;
          for (let i = 1; i < N; i++) {
            const cur = flat[start + i], prev = flat[start + i - 1];
            if (breakSet.has(i)) {
              if (cur.sentIdx === prev.sentIdx || !cur.isFirst) { ok = false; break; }
            } else if (strictBoundaries && cur.sentIdx !== prev.sentIdx) {
              ok = false; break;
            }
            if (!itemMatches(cur.item, tokens[i])) { ok = false; break; }
          }
          if (!ok) continue;
          if (breakSet.has(N) && !flat[start + N - 1].isLast) continue;

          const hit     = flat.slice(start, start + N);
          const sentIds = [];
          const seen    = new Set();
          for (const h of hit) if (!seen.has(h.sentId)) { sentIds.push(h.sentId); seen.add(h.sentId); }
          const matchedWordIds = sentIds.map(sid =>
            [...new Set(hit.filter(h => h.sentId === sid).map(h => h.wordId))]
          );
          out.push({ sentIds, matchedWordIds });
          if (out.length >= cap) return out;
        }
      }
  return out;
}

/* ── Lemma search (≈ runLemmaSearch) ─────────────────────────────────────────
   memberForms. Set of normForm()-keyed word forms expanded from matching lemmas.
   Matches any word whose normalized form is in the set. */
// @fn _runLemmaSearch
function _runLemmaSearch(memberForms, lemmaIds, cap) {
  const out = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || []))
        for (const sent of (para.sentences || [])) {
          const ids = [];
          for (const word of (sent.words || []))
            // E27: match by the token's own lemma_id, or by dictionary-expanded form.
            if ((word.lemma_id && lemmaIds && lemmaIds.has(word.lemma_id)) ||
                memberForms.has(normForm(word.form || ''))) ids.push(word.id);
          if (ids.length) {
            out.push({ sentIds: [sent.id], matchedWordIds: [ids] });
            if (out.length >= cap) return out;
          }
        }
  return out;
}

/* ── Sentence-level single-sentence string match (≈ runSentenceSearchRx) ─────
   getStr(sent) → primary searchable string; getCandidates(sent) → alternative
   representations (translit labels, translation entries) used both as a fallback
   and to record which specific value matched. */
// @fn _runSentenceRx
function _runSentenceRx(getStr, rx, getCandidates, cap) {
  const out = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || []))
        for (const sent of (para.sentences || [])) {
          const str = getStr(sent);
          let matchedText = null;
          if (str && rx.test(str)) {
            matchedText = str;
            if (getCandidates) {
              const cands = getCandidates(sent);
              matchedText = cands.find(c => c && rx.test(c)) ?? str;
            }
          } else if (getCandidates) {
            const hit = getCandidates(sent).find(c => c && rx.test(c));
            if (hit !== undefined) matchedText = hit;
          }
          if (matchedText !== null) {
            out.push({ sentIds: [sent.id], matchedWordIds: [[]], matchedTexts: [matchedText] });
            if (out.length >= cap) return out;
          }
        }
  return out;
}

/* ── Sentence-level cross-sentence (≈ runSentCrossSentSearch) ─────────────────
   2-sentence sliding window per paragraph; the query may span the boundary. */
// @fn _runSentCross
function _runSentCross(getStrs, rawQuery, cap) {
  const rx = compileCrossSentRx(rawQuery);
  if (!rx) return [];
  const out = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || [])) {
        const sents = para.sentences || [];
        for (let i = 0; i < sents.length - 1; i++) {
          const s1 = sents[i], s2 = sents[i + 1];
          const strs1 = getStrs(s1), strs2 = getStrs(s2);
          let found = false, mV1 = null, mV2 = null;
          outer2:
          for (const v1 of strs1)
            for (const v2 of strs2)
              if (rx.test(v1 + '\n' + v2)) { found = true; mV1 = v1; mV2 = v2; break outer2; }
          if (found) {
            let hlRx1 = null, hlRx2 = null;
            if (!_srchRegex) {
              const toks = rawQuery.trim().split(/\s+/).filter(Boolean);
              for (let k = 1; k < toks.length; k++) {
                const r1 = compileCrossSentRx(toks.slice(0, k).join(' '));
                const r2 = compileCrossSentRx(toks.slice(k).join(' '));
                if (r1 && r2 && (mV1 ? r1.test(mV1) : true) && (mV2 ? r2.test(mV2) : true)) {
                  hlRx1 = r1; hlRx2 = r2; break;
                }
              }
            }
            out.push({ sentIds: [s1.id, s2.id], matchedWordIds: [[], []],
                       matchedTexts: [mV1, mV2], matchedRxs: [hlRx1, hlRx2] });
            if (out.length >= cap) return out;
          }
        }
      }
  return out;
}

/* ── Sentence-level cross-sentence with explicit <BREAK> (≈ ..SearchSplit) ───
   rx1 tested against s1 alone, rx2 against s2 alone; a null rx = unconstrained. */
// @fn _runSentCrossSplit
function _runSentCrossSplit(getStrs, rx1, rx2, cap) {
  const out = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || [])) {
        const sents = para.sentences || [];
        for (let i = 0; i < sents.length - 1; i++) {
          const s1 = sents[i], s2 = sents[i + 1];
          const strs1 = getStrs(s1), strs2 = getStrs(s2);
          let found = false, mV1 = null, mV2 = null;
          outer2:
          for (const v1 of strs1) {
            if (rx1 && !rx1.test(v1)) continue;
            for (const v2 of strs2) {
              if (rx2 && !rx2.test(v2)) continue;
              found = true; mV1 = v1; mV2 = v2; break outer2;
            }
          }
          if (found) {
            out.push({ sentIds: [s1.id, s2.id], matchedWordIds: [[], []],
                       matchedTexts: [mV1, mV2], matchedRxs: [rx1 || null, rx2 || null] });
            if (out.length >= cap) return out;
          }
        }
      }
  return out;
}

/* ── runSearch, top-level router (mirrors the live paths of execSearch) ───────
   Pure-ish: sets the shared toggle globals from opts (these are the same globals
   the live UI chips set), then routes by level/field/scope. Returns hits + an
   optional error string (validation failures: bad regex, malformed <BREAK>). */
// @fn runSearch
function runSearch(opts) {
  opts = opts || {};
  const query = (opts.query || '').trim();
  const field = opts.field || 'text';
  const level = opts.level || 'word';
  const crossSent = !!opts.crossSent;
  const cap = opts.cap || (typeof SEARCH_RESULT_CAP !== 'undefined' ? SEARCH_RESULT_CAP : 200);

  // Adopt the shared toggle state (the reused compiler reads these globals).
  _srchRegex         = !!opts.regex;
  _srchCaseSensitive = !!opts.caseSensitive;
  _srchTranslitLabel = opts.translitLabel || 'any';
  _srchTranslitErr   = '';
  _srchTranslitWarnW = false;
  const label = _srchTranslitLabel;

  if (!query) return { hits: [], error: null };

  // Query normalizer for fields whose corpus strings are also normalized.
  const normQuery = part => (field === 'text' || field === 'translation') ? normPunctForSearch(part) : part;

  // ── Sentence-level ─────────────────────────────────────────────────────────
  if (level === 'sentence') {
    const translitLabels = (field === 'translit') ? collectTranslitLabels() : null;
    const sentTranslitByLabel = (sent, lbl) =>
      (sent.words || []).map(w => (wordTranslit(w, lbl) || '').replace(/-/g, '')).filter(Boolean).join(' ');

    const getStr =
        field === 'translation' ? (sent => sentNormTranslations(sent).join('\n'))
      : field === 'translit'    ? (sent => sentTranslitByLabel(sent, label === 'any' ? null : label))
      : field === 'gloss'       ? (sent => (sent.words || []).map(w => wordGloss(w)).filter(Boolean).join(' '))
      :                           (sent => sentNormText(sent));               // 'text'

    const getStrs =
        (field === 'translit' && label === 'any') ? (sent => {
          const lbls = (translitLabels && translitLabels.length) ? translitLabels : [null];
          return lbls.map(lbl => sentTranslitByLabel(sent, lbl)).filter(Boolean);
        })
      : field === 'translation' ? (sent => sentNormTranslations(sent))
      : (sent => { const v = getStr(sent); return v ? [v] : []; });

    const getCandidates =
        field === 'translation' ? (sent => sentNormTranslations(sent))
      : (field === 'translit' && label === 'any') ? (sent => {
          const lbls = (translitLabels && translitLabels.length) ? translitLabels : [null];
          return lbls.map(lbl => sentTranslitByLabel(sent, lbl)).filter(Boolean);
        })
      : null;

    // <BREAK> takes precedence over the cross-sentence toggle.
    const breakParts = query.split('<BREAK>');
    if (breakParts.length > 1) {
      if (breakParts.length > 2) return { hits: [], error: t('status.sb.break_one') };
      const q1 = normQuery(breakParts[0].trim());
      const q2 = normQuery(breakParts[1].trim());
      const rx1 = q1 ? compileCrossSentRx(q1) : null;
      const rx2 = q2 ? compileCrossSentRx(q2) : null;
      if ((q1 && !rx1) || (q2 && !rx2)) return { hits: [], error: _srchTranslitErr || 'Invalid pattern.' };
      return { hits: _runSentCrossSplit(getStrs, rx1, rx2, cap), error: null };
    }

    if (crossSent) {
      return { hits: _runSentCross(getStrs, normQuery(query), cap), error: null };
    }
    if (_srchRegex) {
      let rx;
      try { rx = new RegExp(query, 'iu'); }
      catch (e) { return { hits: [], error: e.message }; }
      return { hits: _runSentenceRx(getStr, rx, getCandidates, cap), error: null };
    }
    // Glob mode
    const escaped = normQuery(query).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const rx = new RegExp(escaped, _srchCaseSensitive ? 'u' : 'iu');
    return { hits: _runSentenceRx(getStr, rx, getCandidates, cap), error: null };
  }

  // ── Lemma (word/morpheme level) ─────────────────────────────────────────────
  if (field === 'lemma') {
    /* B-120: a lemma's citation form is object language, so it is compiled and
       compared under `text`'s fold, not the lemma field's own name. */
    const q = compileTokenQuery(query, 'text');
    if (!q) return { hits: [], error: _srchTranslitErr || 'Invalid pattern.' };
    // D35 A2: lemmas live in their own registry, not in the entry stream.
    const matchingLemmas = (S.lemmas || []).filter(e => q.matches(e.form));
    if (!matchingLemmas.length) return { hits: [], error: null };
    const memberForms = new Set();
    const lemmaIds    = new Set(matchingLemmas.map(l => l.id));   // E27: per-token lemma match
    for (const lem of matchingLemmas) {
      const members = (S.dictByLemmaId && S.dictByLemmaId.get(lem.id)) || [];
      for (const m of members) if (m.form) memberForms.add(normForm(m.form));
    }
    if (!memberForms.size && !lemmaIds.size) return { hits: [], error: null };
    return { hits: _runLemmaSearch(memberForms, lemmaIds, cap), error: null };
  }

  // ── Token search (word/morpheme level) ──────────────────────────────────────
  const parsed = parseBreakQuery(query);
  if (parsed.error) return { hits: [], error: parsed.error };

  if (parsed.hasBREAK) {
    const allTokens = [];
    const breakSet  = new Set();
    if (parsed.sentInitial) breakSet.add(0);
    let pos = 0;
    for (let si = 0; si < parsed.segments.length; si++) {
      const seg = parsed.segments[si];
      const segTokens = !_srchRegex ? seg.split(/\s+/).filter(Boolean) : [seg];
      if (segTokens.length === 0) continue;
      if (si > 0) breakSet.add(pos);
      for (const tok of segTokens) {
        const q = compileTokenQuery(tok, field);
        if (!q) return { hits: [], error: _srchTranslitErr || 'Invalid pattern.' };
        allTokens.push(q); pos++;
      }
    }
    if (parsed.sentFinal) breakSet.add(pos);
    if (!allTokens.length) return { hits: [], error: null };
    return { hits: _runConcat(field, level, allTokens, breakSet, false, label, cap), error: null };
  }

  const rawTokens = !_srchRegex ? parsed.segments[0].split(/\s+/).filter(Boolean) : [parsed.segments[0]];
  if (rawTokens.length <= 1) {
    const q = compileTokenQuery(parsed.segments[0], field);
    if (!q) return { hits: [], error: _srchTranslitErr || 'Invalid pattern.' };
    return { hits: _runTokenSearch(field, level, q, label, cap), error: null };
  }
  const compiled = [];
  for (const tok of rawTokens) {
    const q = compileTokenQuery(tok, field);
    if (!q) return { hits: [], error: _srchTranslitErr || 'Invalid pattern.' };
    compiled.push(q);
  }
  // crossSent toggle ON → free cross-sentence spanning (empty breakSet, strict=false);
  // OFF → single-sentence adjacency (strict=true).
  return { hits: _runConcat(field, level, compiled, new Set(), !crossSent, label, cap), error: null };
}


/* ════════════════════════════════════════════════════════════════════════════
   SEARCH-B CONCORDANCE BUILDERS  (F3 KWIC + F4 frequency / distribution)
   ────────────────────────────────────────────────────────────────────────────
   Pure functions over the substrate (paraTokens) + S.sentById; they consume
   runSearch() hits and produce render-ready data. No DOM. Spec §7.1 / §7.3.
   ════════════════════════════════════════════════════════════════════════════ */

// @fn buildKwic
/* hits, runSearch().hits. opts, { context=12, fullParagraph=false, cap }.
   Returns one concordance line per matched NODE occurrence:
     token line    : { kind:'kwic', sentId, wordIds:[…], left:[tok], node:[tok], right:[tok], crossesBoundary }
     sentence line : { kind:'sentence', sentId, text, matchedText }   (sentence-level fields have no token node)
   The matched words are grouped into maximal contiguous runs in the paragraph
   token stream, so a single-token search yields one line per occurrence and a
   sequence search yields one line per matched span. left/node/right are
   paraTokens entries (carry form + sentIdx for rendering the ‖ boundary). */
function buildKwic(hits, opts = {}) {
  const context = opts.context != null ? opts.context : 12;
  const full    = !!opts.fullParagraph;
  const cap     = opts.cap || (typeof SEARCH_RESULT_CAP !== 'undefined' ? SEARCH_RESULT_CAP : 1000);
  const lines = [];

  for (const hit of hits) {
    const ref = S.sentById.get(hit.sentIds[0]);
    if (!ref) continue;

    const flat    = paraTokens(ref.para);
    const posById = new Map();
    for (const tok of flat) posById.set(tok.wordId, tok.g);

    const gs = [];
    for (const ids of (hit.matchedWordIds || [])) for (const wid of ids) {
      const g = posById.get(wid);
      if (g != null) gs.push(g);
    }

    if (!gs.length) {
      // Sentence-level field (translation / whole-sentence text): no token node.
      lines.push({ kind: 'sentence', sentId: hit.sentIds[0], text: ref.sent.text || '',
                   matchedText: (hit.matchedTexts && hit.matchedTexts[0]) || null });
      if (lines.length >= cap) return lines;
      continue;
    }

    gs.sort((a, b) => a - b);
    const runs = [];
    let start = gs[0], prev = gs[0];
    for (let i = 1; i < gs.length; i++) {
      if (gs[i] === prev) continue;                 // dedupe
      if (gs[i] === prev + 1) { prev = gs[i]; }      // extend run
      else { runs.push([start, prev]); start = gs[i]; prev = gs[i]; }
    }
    runs.push([start, prev]);

    for (const [gStart, gEnd] of runs) {
      const node  = flat.slice(gStart, gEnd + 1);
      const left  = full ? flat.slice(0, gStart) : flat.slice(Math.max(0, gStart - context), gStart);
      const right = full ? flat.slice(gEnd + 1)  : flat.slice(gEnd + 1, gEnd + 1 + context);
      const win = left.concat(node, right);
      let crosses = false;
      for (let i = 1; i < win.length; i++) if (win[i].sentIdx !== win[i - 1].sentIdx) { crosses = true; break; }
      lines.push({ kind: 'kwic', sentId: node[0].sentId, wordIds: node.map(t => t.wordId),
                   left, node, right, crossesBoundary: crosses });
      if (lines.length >= cap) return lines;
    }
  }
  return lines;
}

// @fn buildFrequency
/* lines, buildKwic() output. Returns:
     { total, types:[{form,count}], byDoc:[{title,count}], bySection:[{title,count}] }
   Node-type frequency collapses each token node to its surface-form string
   (case-folded for grouping, display keeps first-seen casing). Sentence-level
   lines count toward total + distribution but not the type table. Distribution
   reads doc/section titles via S.sentById. */
function buildFrequency(lines) {
  const typeMap = new Map();   // norm key → { form, count }
  const docMap  = new Map();
  const secMap  = new Map();

  for (const ln of lines) {
    const ref = S.sentById.get(ln.sentId);
    if (ref) {
      const docTitle = (S.docs[ref.docIdx] && S.docs[ref.docIdx].metadata && S.docs[ref.docIdx].metadata.title) || `Document ${ref.docIdx + 1}`;
      const secTitle = (ref.sect && ref.sect.title) || `Section ${ref.sectIdx + 1}`;
      docMap.set(docTitle, (docMap.get(docTitle) || 0) + 1);
      const secKey = `${docTitle} › ${secTitle}`;
      secMap.set(secKey, (secMap.get(secKey) || 0) + 1);
    }
    if (ln.kind === 'kwic') {
      const surface = ln.node.map(t => t.form).join(' ');
      /* B-120: the type key is object language, so it folds with `normForm`.
         Under `toLowerCase` a Turkish corpus counted `İkna` and `ikna` as two
         types. Latent in the live corpus — 99 distinct types under either fold,
         because no token happens to carry both an I-form and an i-form — which
         is exactly the kind of thing that stops being latent the day a corpus
         has one. */
      const key = normForm(surface);
      const e = typeMap.get(key);
      if (e) e.count++; else typeMap.set(key, { form: surface, count: 1 });
    }
  }

  const byCount = (a, b) => b.count - a.count || a.form.localeCompare(b.form);
  return {
    total:     lines.length,
    types:     [...typeMap.values()].sort(byCount),
    byDoc:     [...docMap.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count),
    bySection: [...secMap.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count),
  };
}

// @fn sortKwic
/* F5, sort KWIC lines by context. anchor ∈ 'corpus' | 'node' | 'L1'…'Ln' | 'R1'…'Rn'
   (L1 = token immediately left of the node, R1 = immediately right). Keys use the
   substrate `norm` (punctuation-normalized), case-folded. Stable: ties keep corpus
   order in BOTH directions (the direction flips only the key comparison). Returns a
   new array; 'corpus' returns the input order unchanged. */
function sortKwic(lines, anchor, dir) {
  if (!anchor || anchor === 'corpus') return lines;
  const desc = dir === 'desc';
  const keyOf = ln => {
    /* B-120: sort keys fold the same way the grouping key does. A sort under
       one fold and a group under another puts a type's own occurrences either
       side of an unrelated row. */
    if (anchor === 'node') return ln.kind === 'sentence' ? normForm(ln.text || '')
                                                          : normForm(ln.node.map(t => t.norm).join(' '));
    if (ln.kind === 'sentence') return '';
    const m = /^([LR])(\d+)$/.exec(anchor);
    if (!m) return '';
    const n = parseInt(m[2]);
    const tok = m[1] === 'L' ? ln.left[ln.left.length - n] : ln.right[n - 1];
    return normForm(tok && tok.norm || '');
  };
  const tagged = lines.map((ln, i) => ({ ln, i, k: keyOf(ln) }));
  tagged.sort((a, b) => {
    let c = a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
    if (desc) c = -c;
    return c || (a.i - b.i);            // corpus-order tie-break, direction-independent
  });
  return tagged.map(x => x.ln);
}

// @fn buildCollocates
/* F6, collocates within ±window tokens of each node occurrence (default 5).
   Reads the paragraph token stream directly (independent of the KWIC display
   context). Skips the node tokens and pure-punctuation tokens (norm === '').
   Aggregates by case-folded `norm`; ranks by raw frequency (v1; G²/PMI = v1.1).
   Returns { window, nodeCount, items:[{ form, count, left, right }] }. */
function buildCollocates(hits, opts = {}) {
  const W = opts.window != null ? opts.window : 5;
  const map = new Map();        // norm key → { form, count, left, right }
  let nodeCount = 0;

  for (const hit of hits) {
    const ref = S.sentById.get(hit.sentIds[0]);
    if (!ref) continue;
    const flat = paraTokens(ref.para);
    const posById = new Map();
    for (const tok of flat) posById.set(tok.wordId, tok.g);

    const gs = [];
    for (const ids of (hit.matchedWordIds || [])) for (const wid of ids) {
      const g = posById.get(wid); if (g != null) gs.push(g);
    }
    if (!gs.length) continue;     // sentence-level field, no token node
    gs.sort((a, b) => a - b);
    const nodeSet = new Set(gs);

    // contiguous node runs
    const runs = []; let s = gs[0], p = gs[0];
    for (let i = 1; i < gs.length; i++) { if (gs[i] === p) continue; if (gs[i] === p + 1) p = gs[i]; else { runs.push([s, p]); s = gs[i]; p = gs[i]; } }
    runs.push([s, p]);

    const add = (tok, side) => {
      if (!tok || tok.norm === '' || nodeSet.has(tok.g)) return;   // skip punct + node tokens
      const key = normForm(tok.norm);   // B-120: object language, same fold as the types
      let e = map.get(key);
      if (!e) { e = { form: tok.form, count: 0, left: 0, right: 0 }; map.set(key, e); }
      e.count++; e[side]++;
    };
    for (const [gStart, gEnd] of runs) {
      nodeCount++;
      for (let g = Math.max(0, gStart - W); g < gStart; g++) add(flat[g], 'left');
      for (let g = gEnd + 1; g <= Math.min(flat.length - 1, gEnd + W); g++) add(flat[g], 'right');
    }
  }

  return {
    window: W, nodeCount,
    items: [...map.values()].sort((a, b) => b.count - a.count || a.form.localeCompare(b.form)),
  };
}


/* ════════════════════════════════════════════════════════════════════════════
   7 · THE VIEW — the query bar, the three result tabs, and the sentence cards
   ────────────────────────────────────────────────────────────────────────────
   Reached from its own header button at `S.view === 'search'`. It was a second,
   parallel view once, with its own state, "independent of Search-A's `_srch*`
   globals" — there is one view and one set of globals now (§1).
   ════════════════════════════════════════════════════════════════════════════ */

// @fn _syncQuery, capture the input value into state so toggles don't lose typed text
function _syncQuery() {
  const inp = document.getElementById('srch-input');
  if (inp) _srchQuery = inp.value;
}
function _clearResults() { _srchHits = null; _srchLines = null; _srchFreq = null; _srchColl = null; _srchError = null; }

// @fn execSearch, run the matcher, then build KWIC + frequency + collocates
function execSearch() {
  const q = (_srchQuery || '').trim();
  if (!q) { _clearResults(); return; }
  const { hits, error } = runSearch({
    query: q, field: _srchField, level: _srchLevel, crossSent: _srchScope === 'cross',
    translitLabel: _srchTranslitLabel, regex: _srchRegex, caseSensitive: _srchCaseSensitive, cap: SEARCH_VIEW_CAP,
  });
  _srchError = error || null;
  _srchHits  = error ? null : hits;
  rebuildKwic();
  rebuildColl();
}

// @fn rebuildKwic, rebuild KWIC + frequency from stored hits (context/full-para change)
function rebuildKwic() {
  if (!_srchHits) { _srchLines = _srchError ? [] : _srchLines; _srchFreq = null; return; }
  _srchLines = buildKwic(_srchHits, { context: _srchContext, fullParagraph: _srchFullPara, cap: SEARCH_VIEW_CAP });
  _srchFreq  = _srchLines.length ? buildFrequency(_srchLines) : null;
}

// @fn rebuildColl, rebuild collocates from stored hits (window change; context-independent)
function rebuildColl() {
  _srchColl = _srchHits ? buildCollocates(_srchHits, { window: _srchCollWindow }) : null;
}

/* ── Render: query bar ──────────────────────────────────────────────────────── */
// @fn renderQueryBar
function renderQueryBar() {
  const set = (k, v, cur, label, extra = '') =>
    `<button class="seg${cur === v ? ' active' : ''}${extra}" data-action="srch-set" data-k="${k}" data-v="${v}">${esc(label)}</button>`;
  const tog = (k, on, label, extra = '') =>
    `<button class="seg${on ? ' active' : ''}${extra}" data-action="seg" data-k="${k}">${esc(label)}</button>`;
  const ctx = v =>
    `<button class="seg${(!_srchFullPara && _srchContext === v) ? ' active' : ''}${_srchFullPara ? ' chip-disabled' : ''}" data-action="srch-context" data-v="${v}">${v}</button>`;

  const level = [['sentence', t('btn.sb.level.sentence')], ['word', t('btn.sb.level.word')], ['morpheme', t('btn.sb.level.morpheme')]].map(([v, l]) => set('level', v, _srchLevel, l)).join('');
  const field = [['text', t('btn.sb.field.text')], ['gloss', t('btn.sb.field.gloss')], ['translit', t('btn.sb.field.translit')], ['translation', t('btn.sb.field.translation')], ['lemma', t('btn.sb.field.lemma')]]
    .map(([v, l]) => set('field', v, _srchField, l)).join('');
  const scope = [['single', t('btn.sb.scope.single')], ['cross', t('btn.sb.scope.cross')]]
    .map(([v, l]) => set('scope', v, _srchScope, l, _srchLevel === 'sentence' && v === 'cross' ? ' chip-disabled' : '')).join('');

  let translitRow = '';
  if (_srchField === 'translit') {
    const labels = ['any', ...(typeof collectTranslitLabels === 'function' ? collectTranslitLabels() : [])];
    translitRow = `<div class="srch-row"><span class="srch-row-lbl">${t('label.sb.translit_label')}</span><div class="seg-group">${
      labels.map(l => set('translitLabel', l, _srchTranslitLabel, l === 'any' ? t('btn.sb.translit_label.any') : l)).join('')}</div></div>`;
  }

  return `<div class="srch-querybar">
    <div class="srch-row"><span class="srch-row-lbl">${t('label.sb.level')}</span><div class="seg-group">${level}</div></div>
    <div class="srch-row"><span class="srch-row-lbl">${t('label.sb.field')}</span><div class="seg-group">${field}</div></div>
    ${translitRow}
    <div class="srch-row"><span class="srch-row-lbl">${t('label.sb.scope')}</span><div class="seg-group">${scope}</div>
      <div class="seg-group">${tog('regex', _srchRegex, t('btn.sb.regex'))}${tog('case', _srchRegex ? false : _srchCaseSensitive, t('btn.sb.case'), _srchRegex ? ' chip-disabled' : '')}</div></div>
    <div class="srch-row"><span class="srch-row-lbl">${t('label.sb.context')}</span><div class="seg-group">${[5, 10, 12, 25].map(ctx).join('')}${tog('fullpara', _srchFullPara, t('btn.sb.fullpara'))}</div></div>
    <div class="srch-runrow">
      <input id="srch-input" class="srch-input" type="text" ${LING_ATTRS}
             value="${escAttr(_srchQuery)}" placeholder="${escAttr(t('placeholder.sb.query'))}" dir="auto">
      <button class="btn btn-primary" data-action="srch-run">${t('btn.sb.run')}</button>
    </div>
  </div>`;
}

/* ── Render: KWIC + frequency bodies ────────────────────────────────────────── */
// @fn _renderToks, join token surface forms, inserting ‖ at sentence boundaries
function _renderToks(toks) {
  let html = '', prevSent = null;
  for (const t of toks) {
    if (prevSent !== null && t.sentIdx !== prevSent) html += '<span class="srch-bound">‖</span> ';
    if (t.form) html += esc(t.form) + ' ';
    prevSent = t.sentIdx;
  }
  return html.trim();
}

// @fn renderSortBar. F5 sort-by-context controls
function renderSortBar() {
  // Tooltips explain the concordance jargon (Node / L-R positions) per the labels audit.
  const sortTitle = v =>
    v === 'corpus' ? t('title.sb.sort.corpus')
    : v === 'node' ? t('title.sb.sort.node')
    : t(v[0] === 'L' ? 'title.sb.sort.left' : 'title.sb.sort.right', { n: v.slice(1) });
  const a = (v, l) => `<button class="seg${_srchSortAnchor === v ? ' active' : ''}" data-action="srch-sort" data-v="${v}" title="${escAttr(sortTitle(v))}">${l}</button>`;
  const anchors = [['corpus', t('btn.sb.sort.corpus')], ['L3', 'L3'], ['L2', 'L2'], ['L1', 'L1'], ['node', t('btn.sb.sort.node')], ['R1', 'R1'], ['R2', 'R2'], ['R3', 'R3']];
  return `<div class="srch-sortbar"><span class="srch-row-lbl">${t('label.sb.sort')}</span>
    <div class="seg-group">${anchors.map(([v, l]) => a(v, l)).join('')}</div>
    <button class="seg" data-action="srch-sortdir" title="${escAttr(t('title.sb.sortdir'))}">${_srchSortDir === 'asc' ? t('btn.sb.sort.asc') : t('btn.sb.sort.desc')}</button>
  </div>`;
}

// @fn renderKwic
function renderKwic() {
  if (_srchError) return `<p class="srch-msg srch-err">${esc(_srchError)}</p>`;
  if (_srchLines === null) return `<p class="srch-msg">${t('status.sb.kwic_prompt')}</p>`;
  if (!_srchLines.length) return `<p class="srch-msg">${t('status.sb.no_matches')}</p>`;
  const lines = sortKwic(_srchLines, _srchSortAnchor, _srchSortDir);
  const rows = lines.map(ln => {
    if (ln.kind === 'sentence') {
      return `<tr class="srch-krow srch-ksent" data-action="srch-goto" data-sid="${escAttr(ln.sentId)}">
        <td colspan="3" class="srch-ksentcell">${esc(ln.text)}</td></tr>`;
    }
    return `<tr class="srch-krow" data-action="srch-goto" data-sid="${escAttr(ln.sentId)}">
      <td class="srch-kleft">${_renderToks(ln.left)}</td>
      <td class="srch-knode">${_renderToks(ln.node)}</td>
      <td class="srch-kright">${_renderToks(ln.right)}</td></tr>`;
  }).join('');
  const capped = _srchLines.length >= SEARCH_VIEW_CAP ? `<p class="srch-msg srch-cap">${t('status.sb.cap', { n: SEARCH_VIEW_CAP })}</p>` : '';
  return `${renderSortBar()}<div class="srch-kwicwrap"><table class="srch-kwic"><tbody>${rows}</tbody></table></div>${capped}`;
}

// @fn renderColl. F6 collocates panel
function renderColl() {
  const win = w => `<button class="seg${_srchCollWindow === w ? ' active' : ''}" data-action="srch-collwin" data-v="${w}">±${w}</button>`;
  const bar = `<div class="srch-row"><span class="srch-row-lbl">${t('label.sb.window')}</span><div class="seg-group">${[3, 5, 10].map(win).join('')}</div></div>`;
  if (_srchLines === null) return `${bar}<p class="srch-msg">${t('status.sb.coll_prompt')}</p>`;
  if (!_srchColl || !_srchColl.items.length) return `${bar}<p class="srch-msg">${t('status.sb.coll_none')}</p>`;
  const rows = _srchColl.items.map(x =>
    `<tr><td>${esc(x.form)}</td><td class="srch-num">${x.count}</td><td class="srch-num srch-dim">${x.left}</td><td class="srch-num srch-dim">${x.right}</td></tr>`).join('');
  return `${bar}
    <div class="srch-ftotal">${t('label.sb.coll_summary', { n: _srchColl.items.length, w: _srchColl.window, m: _srchColl.nodeCount })}</div>
    <table class="srch-ftable srch-colltable">
      <thead><tr><th>${t('label.sb.coll_collocate')}</th><th class="srch-num">${t('label.sb.coll_total')}</th><th class="srch-num">${t('label.sb.coll_l')}</th><th class="srch-num">${t('label.sb.coll_r')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
}

// @fn renderFreq
function renderFreq() {
  if (_srchLines === null) return `<p class="srch-msg">${t('status.sb.freq_prompt')}</p>`;
  if (!_srchFreq) return `<p class="srch-msg">${t('status.sb.no_matches')}</p>`;
  const tbl = (rows) => `<table class="srch-ftable"><tbody>${rows || '<tr><td>—</td></tr>'}</tbody></table>`;
  const tRows = _srchFreq.types.map(x => `<tr><td>${esc(x.form)}</td><td class="srch-num">${x.count}</td></tr>`).join('');
  const dRows = _srchFreq.byDoc.map(x => `<tr><td>${esc(x.title)}</td><td class="srch-num">${x.count}</td></tr>`).join('');
  const sRows = _srchFreq.bySection.map(x => `<tr><td>${esc(x.title)}</td><td class="srch-num">${x.count}</td></tr>`).join('');
  return `<div class="srch-freq">
    <div class="srch-ftotal">${t('label.sb.occurrences', { n: _srchFreq.total })}</div>
    <div class="srch-fgrid">
      <div class="srch-fcol"><h4>${t('label.sb.freq_forms')} (${_srchFreq.types.length})</h4>${tbl(tRows)}</div>
      <div class="srch-fcol"><h4>${t('label.sb.freq_bydoc')}</h4>${tbl(dRows)}</div>
      <div class="srch-fcol"><h4>${t('label.sb.freq_bysection')}</h4>${tbl(sRows)}</div>
    </div></div>`;
}

// @fn renderSentenceCards, sentence-card result mode (spec §8): reuse the
// renderSearchResults. Hits already carry the { sentIds, matchedWordIds }
// shape that renderer accepts, so each match shows as a full IGT card with a
// breadcrumb + "go to sentence" link (back-nav handled by C20 searchReturn).
function renderSentenceCards() {
  if (_srchError)           return `<p class="srch-msg srch-err">${esc(_srchError)}</p>`;
  if (_srchHits === null)   return `<p class="srch-msg">${t('status.sb.kwic_prompt')}</p>`;
  if (!_srchHits.length)    return `<p class="srch-msg">${t('status.sb.no_matches')}</p>`;
  const capped = _srchHits.length >= SEARCH_VIEW_CAP ? `<p class="srch-msg srch-cap">${t('status.sb.cap', { n: SEARCH_VIEW_CAP })}</p>` : '';
  return `<div class="srch-sentcards">${renderSearchResults(_srchHits)}</div>${capped}`;
}

// @fn renderSearch
function renderSearch() {
  if (!S.docs.length) return `<div class="srch-view"><p class="srch-msg">${t('status.sb.open_corpus')}</p></div>`;
  const count = (_srchLines && _srchLines.length) ? ` (${_srchLines.length})` : '';
  const tab = (id, label) => `<button class="tab${_srchResultTab === id ? ' active' : ''}" data-action="srch-tab" data-v="${id}"${id === 'kwic' ? ` title="${escAttr(t('title.sb.tab.kwic'))}"` : ''}>${label}</button>`;
  const body = _srchResultTab === 'freq' ? renderFreq()
             : _srchResultTab === 'coll' ? renderColl()
             : _srchResultTab === 'sent' ? renderSentenceCards()
             : renderKwic();
  return `<div class="srch-view">
    <div class="srch-head">
      <span class="srch-badge">${t('label.sb.badge')}</span>
      <span class="srch-sub">${t('label.sb.sub')}</span>
      <button class="srch-help-btn" data-action="srch-help" aria-label="${escAttr(t('title.sb.help'))}"
              title="${escAttr(t('title.sb.help'))}">?</button>
    </div>
    <div class="srch-help-popover" id="srch-help-popover" hidden>
      ${t('help.sb.popover')}
    </div>
    ${renderQueryBar()}
    <div class="tabs">${tab('kwic', t('btn.sb.tab.kwic') + count)}${tab('sent', t('btn.sb.tab.sent'))}${tab('freq', t('btn.sb.tab.freq'))}${tab('coll', t('btn.sb.tab.coll'))}</div>
    <div class="srch-resultbody">${body}</div>
  </div>`;
}

// @fn searchOnAction, single dispatch for all data-action="srch-*" clicks (called from events.js)
function searchOnAction(el) {
  const a = el.dataset.action;
  if (a === 'srch-goto') { go('sentence', { sentId: el.dataset.sid }); return; }  // go() re-renders
  if (a === 'srch-help') {
    const pop = document.getElementById('srch-help-popover');
    if (pop) { pop.hidden = !pop.hidden; } return;
  }
  // A disabled control (e.g. Case while Regex is on, Context while Full-paragraph)
  // must never change state, guard here in case CSS pointer-events is ever lost.
  if (el.classList && el.classList.contains('chip-disabled')) return;
  _syncQuery();
  switch (a) {
    case 'srch-set':
      if (el.dataset.k === 'field') {
        _srchField = el.dataset.v;
        if (_srchField !== 'translit') _srchTranslitLabel = 'any';
        if (_srchLevel === 'sentence' && _srchField === 'lemma') _srchLevel = 'word';
        if (_srchLevel !== 'sentence' && _srchField === 'translation') _srchLevel = 'sentence';
      } else if (el.dataset.k === 'level') {
        _srchLevel = el.dataset.v;
        if (_srchLevel !== 'sentence' && _srchField === 'translation') _srchField = 'text';
        if (_srchLevel === 'sentence' && _srchField === 'lemma') _srchField = 'text';
        if (_srchLevel === 'sentence') _srchScope = 'single';
      } else if (el.dataset.k === 'scope') {
        if (!(_srchLevel === 'sentence' && el.dataset.v === 'cross')) _srchScope = el.dataset.v;
      } else if (el.dataset.k === 'translitLabel') {
        _srchTranslitLabel = el.dataset.v;
      }
      _clearResults(); break;
    /* B-158, v3.14.315: this case read `srch-toggle` while `tog()` (:859) has
       emitted `data-action="seg"` since the segmented control replaced
       `.srch-group`/`.srch-toggle` — the presentation rename reached the emitter and
       not the handler. Regex, Case and Full-paragraph were inert: `render()`
       runs after the switch either way, so each click repainted the same state
       and the button looked like it simply refused. */
    case 'seg':
      if (el.dataset.k === 'regex') _srchRegex = !_srchRegex;
      else if (el.dataset.k === 'case') _srchCaseSensitive = !_srchCaseSensitive;
      else if (el.dataset.k === 'fullpara') { _srchFullPara = !_srchFullPara; rebuildKwic(); render(); return; }
      _clearResults(); break;
    case 'srch-context':  _srchContext = parseInt(el.dataset.v); _srchFullPara = false; rebuildKwic(); break;
    case 'srch-sort':     _srchSortAnchor = el.dataset.v; break;             // display-only re-sort
    case 'srch-sortdir':  _srchSortDir = _srchSortDir === 'asc' ? 'desc' : 'asc'; break;
    case 'srch-collwin':  _srchCollWindow = parseInt(el.dataset.v); rebuildColl(); break;
    case 'srch-run':      execSearch(); break;
    case 'srch-tab':      _srchResultTab = el.dataset.v; break;
  }
  render();
}
