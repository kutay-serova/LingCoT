/*
  =============================================================================
  Linguistic Corpus Toolkit (LingCoT), modules/events.js
  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
  =============================================================================

  Event binding module: bindEvents() (per-render form wiring) and
  initDelegatedListeners() (once-at-boot delegated handlers).
  Loaded by LingCoT.html via: <script src="modules/events.js"></script>

  Depends on globals from LingCoT.html and all other modules:
  S, go(), render(), mutate(), save*(), open*(), close*(), esc(), etc.
  =============================================================================
*/

// @fn toggleLatexPanel
/* LaTeX export, show/hide the export panel and sync the toolbar button's
   active state.  Extracted from bindEvents() in the C14 delegation migration
   (v3.14.14); invoked from the delegated [data-action="latex-toggle"] handler. */
function toggleLatexPanel() {
  const panel = document.getElementById('latex-panel');
  const btn   = document.getElementById('latex-export-btn');
  if (!panel || !btn) return;
  const opening = !panel.classList.contains('open');
  panel.classList.toggle('open', opening);
  btn.classList.toggle('active',  opening);
}

// @fn copyLatexPre
/* LaTeX export, copy a <pre> block's text to the clipboard and flash the
   matching copy button.  preId is supplied via data-latex-pre on the button;
   the button itself is re-located by its data-action / data-latex-pre pair so
   the flash works regardless of which format (standard / gb4e) was copied. */
function copyLatexPre(preId) {
  const pre = document.getElementById(preId);
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    const btn = document.querySelector(`[data-action="latex-copy"][data-latex-pre="${preId}"]`);
    if (!btn) return;
    btn.innerHTML = `${icon('check-circle')} ${t('status.copied')}`;
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = `${icon('copy')} ${t('btn.view.sent.copy')}`; btn.classList.remove('copied'); }, 1600);
  });
}

// @fn translateSentence
/* Sentence "Translate" button action (extracted from bindEvents() for the C14
   delegation migration).  Uses the shared translateText() and applyTranslation()
   helpers.  Source language comes from corpus metadata, auto-detection is
   intentionally disabled.  applyTranslation() always appends; it never
   overwrites an existing translation. */
async function translateSentence() {
  const r = findSent(S.sentId);
  if (!r) return;
  const { sent } = r;
  if (!sent.text?.trim()) return;

  // Language validation, warn and bail out if the document language is missing or unsupported.
  const srcLang = doc()?.metadata?.language || null;
  // B-064: checkLangForBackend returns an issue object now, not a string.
  const langErr = checkLangForBackend(srcLang, XLATE_SETTINGS.backend);
  if (langErr) { alert(langIssueText(langErr, 'alert')); return; }

  const btn = document.getElementById('translate-btn');
  if (!btn || btn.classList.contains('loading')) return;

  btn.innerHTML = `${icon('hourglass')} ${t('status.translating')}`;
  btn.classList.add('loading');
  logEvent('info', 'translation started', { backend: XLATE_SETTINGS.backend, lang: srcLang, sentId: S.sentId });

  const result = await translateText(sent.text, srcLang);

  btn.classList.remove('loading');
  btn.innerHTML = `${icon('translate')} ${t('btn.view.sent.translate')}`;

  if (result) {
    logEvent('info', 'translation complete', { method: result.method, sentId: S.sentId });
    applyTranslation(sent, result);
    render();  // re-renders to show new translation + provenance badge
  } else {
    logEvent('warn', 'translation failed (no result)', { backend: XLATE_SETTINGS.backend, sentId: S.sentId });
    showXlateFailModal();
  }
}

// @fn translateParagraphAll
/* Paragraph "Translate All" button action (extracted from bindEvents() for the
   C14 delegation migration).  Translates only sentences missing a translation
   (v2-aware: checks translations[]).
   Batching strategy (respects XLATE_SETTINGS.backend):
     Google: all sentences fired in parallel via Promise.allSettled().
     NLLB:   single POST /translate_batch -> ctranslate2 batch call.
     auto:   Google-first when online; NLLB-first when offline (navigator.onLine).
   Progress counter shown in the button while running.  Language auto-detection
   is disabled, the document's Language field must be set.  On failure shows
   showXlateFailModal() with backend-specific instructions. */
async function translateParagraphAll() {
  const sec = sections()[S.sectIdx];
  const p   = sec?.paragraphs?.[S.paraIdx];
  if (!p) return;

  const btn = document.getElementById('para-translate-btn');
  if (!btn || btn.classList.contains('loading')) return;

  // Language validation, warn and bail out if the document language is missing or unsupported.
  const srcLang = doc()?.metadata?.language || null;
  // B-064: checkLangForBackend returns an issue object now, not a string.
  const langErr = checkLangForBackend(srcLang, XLATE_SETTINGS.backend);
  if (langErr) { alert(langIssueText(langErr, 'alert')); return; }

  // Normalise to Google BCP-47 for the Google endpoint; null = unsupported.
  const _canonical = LANG_TO_CANONICAL[srcLang] || LANG_TO_CANONICAL[(srcLang || '').toLowerCase()] || srcLang;
  const googleSrc  = CANONICAL_TO_GOOGLE[_canonical] || CANONICAL_TO_GOOGLE[(_canonical || '').toLowerCase()] || null;
  // Only process sentences that don't already have a translation (v2-aware).
  const pending = (p.sentences || []).filter(s => !sentTrans(s) && s.text?.trim());

  if (!pending.length) {
    btn.innerHTML = `${icon('check-circle')} ${t('status.translated_all')}`;
    setTimeout(() => { btn.innerHTML = `${icon('translate')} ${t('btn.view.para.translate_all')}`; }, 2000);
    return;
  }

  btn.classList.add('loading');
  btn.innerHTML = `${icon('hourglass')} 0 / ${pending.length}`;
  logEvent('info', 'translate-all started', { backend: XLATE_SETTINGS.backend, lang: srcLang, count: pending.length });

  const texts     = pending.map(s => s.text);
  const backend   = XLATE_SETTINGS.backend;
  // tryGoogle additionally requires a resolved Google BCP-47 code (no sl=auto fallback).
  const tryGoogle = (backend === 'google' || backend === 'auto') && !!googleSrc;
  const tryNllb   = backend === 'nllb'   || backend === 'auto';
  const nllbFirst = backend === 'nllb' || (backend === 'auto' && !navigator.onLine);

  let results = null;  // array of { text, method } | null, one entry per pending sentence

  // ── Google Translate, all sentences in parallel ──────────────────────
  async function _batchGoogle() {
    if (!tryGoogle || results) return;
    try {
      const settled = await Promise.allSettled(texts.map(async t => {
        const url = 'https://translate.googleapis.com/translate_a/single'
          + `?client=gtx&sl=${encodeURIComponent(googleSrc)}&tl=${encodeURIComponent(googleTarget())}`
          + `&dt=t&q=${encodeURIComponent(t)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) throw new Error('non-ok');
        const data = await resp.json();
        const txt  = (data[0] || []).map(c => c[0] || '').join('').trim();
        if (!txt) throw new Error('empty');
        return txt;
      }));
      // Only accept Google results if every sentence succeeded.
      if (settled.every(s => s.status === 'fulfilled')) {
        results = settled.map(s => ({ text: s.value, method: 'google-translate' }));
      }
    } catch (_) { /* network error */ }
  }

  // ── Local NLLB server, single batch request ──────────────────────────
  async function _batchNllb() {
    if (!tryNllb || results) return;
    try {
      const resp = await fetch('http://localhost:5001/translate_batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ texts, source_lang: srcLang, target_lang: translationTarget() }),
        signal:  AbortSignal.timeout(120000),  // batches can take longer
      });
      if (resp.ok) {
        const data = await resp.json();
        results = (data.translations || []).map(t => t ? { text: t, method: 'nllb-200' } : null);
      }
    } catch (_) { /* server not running */ }
  }

  if (nllbFirst) { await _batchNllb(); await _batchGoogle(); }
  else           { await _batchGoogle(); await _batchNllb(); }

  btn.classList.remove('loading');

  if (!results || results.every(r => !r)) {
    btn.innerHTML = `${icon('translate')} ${t('btn.view.para.translate_all')}`;
    logEvent('warn', 'translate-all failed (no results)', { backend: XLATE_SETTINGS.backend, lang: srcLang });
    showXlateFailModal();
    return;
  }

  const nSucceeded = results.filter(Boolean).length;
  logEvent('info', 'translate-all complete', { succeeded: nSucceeded, total: pending.length, method: results.find(Boolean)?.method });
  pending.forEach((sent, i) => {
    if (results[i]) applyTranslation(sent, results[i]);
  });
  btn.innerHTML = `${icon('translate')} ${t('btn.view.para.translate_all')}`;
  render();  // re-render to show updated translations in sentence cards
}

/* ══════════════════════════════════════════════════════════════════════════════
   EVENT BINDING
══════════════════════════════════════════════════════════════════════════════ */
// @fn bindEvents
function bindEvents() {
  // Per-render wiring ONLY.  Most click handling, save buttons, the translation
  // toolbar, LaTeX export, search (srch-*), dict-browse sort/filter, and the
  // morpheme / section-row containers, is now delegated once
  // at boot in initDelegatedListeners() via data-action attributes
  // (C14 migration, v3.14.14).  What stays here are the handlers that genuinely
  // need fresh per-render binding:
  //   • live <input ${LING_ATTRS}> sync that holds per-render closure state, and
  //   • the IntersectionObserver sentinel (re-created on every section render).
  // Note: autocapitalize="none" is stamped directly on every input[type="text"]
  // and textarea element, browser inheritance from <body> is not reliable.

  // If the Annotators view was opened via a prov history link, scroll the
  // highlighted row into view and then clear the focus so re-renders don't scroll.
  if (S.view === 'annotators' && _annFocusId) {
    const row = document.querySelector(`tr[data-ann-id="${CSS.escape(_annFocusId)}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    _annFocusId = null;  // clear after first scroll so re-sorts don't re-scroll
  }

  // If the Sources view was opened via a source chip link, scroll to that row.
  if (S.view === 'sources' && _srcFocusId) {
    const row = document.querySelector(`tr[data-src-id="${CSS.escape(_srcFocusId)}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    _srcFocusId = null;  // clear after first scroll so re-sorts don't re-scroll
  }

  /* D25 P2: draw the arc diagram once the sentence view is in the DOM.
     Must run here rather than inside the renderer, arc endpoints come from
     measured token positions, which only exist after insertion.  No-ops on
     every other view. */
  _depDrawArcs();

  /* ── D25 P1: dependency-parse editor bindings ────────────────────────────
     (a) Tokenization freeze notice.  The parse table deliberately does NOT
         rebuild as the tokenization field is typed into, unlike syncMorphemeRows, every
         head references another ROW, so a mid-edit rebuild would have to
         re-resolve all of them against a half-typed tokenization.  Instead the
         table freezes and a notice says it will reconcile on save.
     (b) Relation-name echo.  Originally a workaround for WebKit ignoring
         <option label> inside <datalist>; the field moved onto the shared
         autocomplete in v3.14.54, which renders hints properly.  The echo is
         kept anyway because it serves a different purpose, it names the
         COMMITTED value while the dropdown is closed, so "nsubj" reads as
         "nominal subject" without the user having to open anything. */
  // D48 stage B: the id comes from the field table, not from this file.
  const esWords = document.getElementById(fieldId('sentence', 'words'));
  const esStale = document.getElementById('es-dep-stale');
  if (esWords && esStale) {
    esWords.addEventListener('input', () => {
      const changed = esWords.value.trim() !== (esWords.dataset.original || '').trim();
      esStale.hidden = !changed;
    });
  }

  document.querySelectorAll('.dep-rel-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const span = document.getElementById(inp.dataset.relName || '');
      if (span) span.textContent = depRelName(inp.value);
    });
  });

  /* Live morpheme row sync + chip state when the parse field is edited.
     Re-builds the morpheme rows and the "From parse" chip section on each
     keystroke, so it is bound to the fresh #ew-parse element per render. */
  /* B-197: paint the link warnings once per render. `bindEvents` runs after
     every render, and the spans come out of the renderer empty — a warning that
     only ever appeared after a keystroke would miss the case that matters most,
     reopening a word whose link was already wrong. */
  refreshLinkClash();

  const ewParse = document.getElementById('ew-parse');
  if (ewParse) {
    ewParse.addEventListener('input', () => {
      syncMorphemeRows();      // rebuild the rows for the new parse
      refreshMorphSuggest();   // D42: one strip, rebuilt whole
      refreshLinkClash();      // B-197: the rows changed, so the links may not fit
    });
  }

  /* B-085: the "also save to dictionary" box needs no wiring now. It used to
     enable and disable a surface-form box and one checkbox per morpheme row,
     and to keep the surface-form default following the parse until the
     annotator touched it. There is one control, and WHICH forms is asked once
     by openPushPickModal at the moment of pushing. */

  /* ── Word-gloss ↔ morpheme-gloss synchronisation ──────────────────────────
     Condition (all three must hold at the time the edit view opens):
       1. No morphological parse is set.
       2. Morpheme Glosses shows exactly one row (the whole-word default row).
       3. The Word Gloss field and that single Morpheme Gloss field AGREE — which
          on a first visit means both are empty, and on a later one means the
          word's gloss is the morpheme's (B-187).
     Behaviour: typing in either field mirrors the value to the other in real
     time, letter-for-letter, so the user only has to type the gloss once.
     The mirror stays active as long as both fields hold the same text.  If
     either is edited independently so they diverge, mirroring stops.
     An additional guard prevents sync from running after the user fills in
     the Morphological Parse field (which would expand the morpheme rows and
     make the mirror semantically wrong).
     Kept per-render: the closure state (_lastSync) is intentionally scoped to a
     single edit view and must reset each time the view is re-rendered. */
  const _ewGloss  = document.getElementById('ew-gloss');
  const _ewMg0    = document.getElementById('ew-mg-0');
  const _ewParseF = document.getElementById('ew-parse');   // same element as ewParse above
  if (_ewGloss && _ewMg0 && _ewParseF) {
    const _hasParse  = _ewParseF.value.trim() !== '';
    const _singleRow = document.querySelectorAll('#ew-morph-rows .morph-edit-row').length === 1;
    /* B-187: they AGREE, which is what the rule above actually says — "the mirror
       stays active as long as both fields hold the same text". The attach test
       was `both are empty`, a special case of agreeing that was the only reachable
       one while the word gloss was always stored: reopening a glossed word put a
       value in both boxes, the mirror declined to attach, and clearing one left
       the other. Both empty is still the first-visit case and still attaches. */
    const _agree = _ewGloss.value === _ewMg0.value;
    if (!_hasParse && _singleRow && _agree) {
      // _lastSync tracks the last value we wrote via sync.
      // If the target field still holds that value, we know it hasn't been
      // independently edited, so it is safe to overwrite with the new value.
      let _lastSync = _ewGloss.value;
      _ewGloss.addEventListener('input', () => {
        if (_ewParseF.value.trim()) return;  // parse added, stop syncing
        if (_ewMg0.value === _lastSync) {
          _ewMg0.value = _ewGloss.value;
          _lastSync    = _ewGloss.value;
        }
      });
      _ewMg0.addEventListener('input', () => {
        if (_ewParseF.value.trim()) return;  // parse added, stop syncing
        if (_ewGloss.value === _lastSync) {
          _ewGloss.value = _ewMg0.value;
          _lastSync      = _ewMg0.value;
        }
      });
    }
  }

  /* Live text → word tokenization sync, sentence-add ONLY.

     D48 stage B made both modes share one pair of ids, which is the point — but
     it also means presence no longer tells the two views apart. Without the
     view check this would attach in sentence-EDIT and rewrite the tokenization
     of an existing sentence as its text was typed, discarding word objects that
     may carry a full analysis. The `manualEdit` flag would not save it: a
     freshly rendered edit form has not been touched, so the flag is unset.

     Creating is the only time a tokenization can be derived from the text
     without destroying something. */
  const saText  = S.view === 'sentence-add' ? document.getElementById(fieldId('sentence', 'text'))  : null;
  const saWords = S.view === 'sentence-add' ? document.getElementById(fieldId('sentence', 'words')) : null;
  if (saText && saWords) {
    saText.addEventListener('input', () => {
      // D40 stage B: pre-fill from a sentence with the same text, debounced
      clearTimeout(_addPrefillTimer);
      _addPrefillTimer = setTimeout(() => refreshAddPrefill(saText.value), 250);
      if (!saWords.dataset.manualEdit) {
        const trimmed = saText.value.trim();
        // Leave the tokenization field empty for scripts without word-spaces
        // (e.g. Chinese, Japanese) so the annotator fills it in manually.
        saWords.value = textUsesSpaces(trimmed)
          ? trimmed.split(/\s+/).filter(Boolean).join(' ')
          : '';
      }
    });
    saWords.addEventListener('input', () => { saWords.dataset.manualEdit = '1'; });
  }

  /* Live chip refresh when the annotator types into a POS or Type field. D44:
     one call for both, since the row now carries its own fold rule. */
  ['ed-pos', 'da-pos', 'ed-type', 'da-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => refreshChipsFor(id));
  });

  /* Dict browse, search filter (debounced).  _dbTimer is module-level (not
     declared here) so stale closures from previous renders can't fire on the
     wrong view.  Kept per-render: needs the fresh #db-search element and
     restores focus to it after the tbody repaint. */
  const dbSearch = document.getElementById('db-search');
  if (dbSearch) {
    dbSearch.addEventListener('input', () => {
      clearTimeout(_dbTimer);
      _dbTimer = setTimeout(() => {
        _dictFilter = dbSearch.value;
        rerenderDictTable();
        // Restore focus after tbody repaint
        dbSearch.focus();
      }, 120);
    });
  }

  /* Section view: lazy-load remaining paragraphs via IntersectionObserver.
     The sentinel div (if present) carries data-si and data-para-next so
     observeParaSentinel() knows which section and batch to load next.
     A fresh observer must be attached to the new sentinel on every render. */
  const paraSentinel = document.getElementById('section-para-sentinel');
  if (paraSentinel) observeParaSentinel(paraSentinel);

  /* The search query input. Enter runs it (per-render; the input is rebuilt). */
  document.getElementById('srch-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && typeof execSearch === 'function') {
      if (typeof _syncQuery === 'function') _syncQuery();
      execSearch();
      render();
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   HELP SIDEBAR
══════════════════════════════════════════════════════════════════════════ */

/* Per-view help now lives in the locale files, as help.view.<view>.title and
   help.view.<view>.body, see resources/locale/en.json.

   It used to be a 17 KB hardcoded English object here, which meant the most
   read-in-context documentation in the app could not be translated at all, and
   D24 (language porting) would have had to move it anyway. Rewritten shorter at
   the same time: 17,136 -> 6,421 characters, saying what each screen is for and
   what its controls do, and nothing else.

   The old object keyed the search view as `search`; the view is `search`, so
   that entry had been unreachable since Search-A was retired and the search
   screen showed "No additional help for this view" (B-038). Keys are checked
   against VIEW_RENDERERS by help_coverage_test.js. */

/* Inject view-specific help content into the sidebar.
   Called from render() whenever the sidebar is open, and from toggleHelp() on open. */
// @fn updateHelpContent
function updateHelpContent() {
  const el      = document.getElementById('help-view-content');
  const titleEl = document.getElementById('help-sidebar-title');
  if (!el) return;
  const v = S.view || 'empty';
  /* tRes-style fallback: t() returns the key itself on a miss, so compare against
     it rather than testing for undefined. A screen with no help says so plainly
     instead of printing "help.view.foo.body" at the user. */
  const key   = k => `help.view.${v}.${k}`;
  const body  = t(key('body'));
  const title = t(key('title'));
  el.innerHTML = (body === key('body')) ? t('help.view.fallback.body') : body;
  if (titleEl) titleEl.textContent = (title === key('title')) ? t('help.view.fallback.title') : title;
}

/* Open or close the help sidebar. */
// @fn toggleHelp
function toggleHelp() {
  const sidebar  = document.getElementById('help-sidebar');
  const backdrop = document.getElementById('help-backdrop');
  const btn      = document.getElementById('help-btn');
  if (!sidebar) return;
  const opening = !sidebar.classList.contains('open');
  sidebar.classList.toggle('open',  opening);
  backdrop.classList.toggle('open', opening);
  btn?.classList.toggle('active', opening);
  if (opening) updateHelpContent();
}

/* ══════════════════════════════════════════════════════════════════════════════
   AUTOSAVE
   Writes corpus changes to disk automatically via pywebview.api.write_abs().
   Paths are stored as absolute strings; the Python layer handles all file I/O.

   Flow:
     mutate()           → triggerAutoSave(), starts/resets the 400 ms debounce
     debounce fires     → saveTick(), APPENDS to the journal (D50 stage 3c)
     a compaction trigger → compact(), rewrites the base and empties the journal
     💾 Save btn        → openSavePanel(), modal: path + toggle + manual actions
     toggle → on        → if _savePath set, enable; else chooseSavePath() first
     new corpus created → promptNewCorpusAutosave(), creates corpora/NAME/ folder
     file loaded        → promptLoadedCorpusAutosave(), save back to source path
══════════════════════════════════════════════════════════════════════════════ */

/* Called by mutate() after every corpus/dict mutation.

   D50 stage 3c, and this is the change the whole thing was for. It used to
   debounce 1.5 s and then rebuild the entire corpus as one string: measured at
   **1.5 s for 50,000 words and 13.3 s for 300,000**, on every save. Now the
   annotator's edit costs an append of about 1.7 KB, and the full write happens
   on the triggers below instead — none of which is a keystroke.

   The debounce stays, at 400 ms rather than 1,500. It is no longer hiding a
   cost; it is only batching the appends of one action, which writes several
   records. */
// @fn triggerAutoSave
function triggerAutoSave() {
  if (!_autoSave) return;
  if (!_savePath && !_dictSavePath && !_participantsPath) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(saveTick, 400);
}

/* ── D50 compaction: when the base gets rewritten ────────────────────────────
   Four triggers, and only one of them is on any path the annotator is waiting
   for. Idle compaction is NOT crash protection — the journal is already on disk
   and the next open replays it. It buys currency: the base stays complete for
   backup tools, cloud sync, sharing, and the CLI scripts, which refuse to run
   while a journal exists. */
let _lastCompactMs = 0;      // how long the last full write took
let _idleTimer     = null;
let _journalBytes  = 0;      // journal size on disk, as append_abs reported it

/* @fn _compactionDue, has the journal earned a full write?
   Proportional, not absolute, and it self-corrects in the right direction: a
   56 MB corpus tolerates a 14 MB journal (~9,500 saves, ~100 ms to replay)
   before a 1.5 s compaction, and a 335 MB one tolerates 84 MB before a 13 s
   compaction. Replay is never the constraint — 20,000 records replay in 202 ms —
   so the reason to compact is tidiness and detection latency, not speed. The
   2 MB floor stops a small corpus compacting every few minutes; it is about
   1,400 word-saves, likely more than a day's work at that scale. */
function _compactionDue() {
  const baseBytes = (_lastWrite.corpus.bytes || 0) + (_lastWrite.dict.bytes || 0);
  return _journalBytes > Math.max(2 * 1024 * 1024, baseBytes * 0.25);
}

/* @fn _armIdleCompaction, compact once the session has clearly stopped.
   Two minutes is comfortably past a think-pause — reading a sentence, looking a
   word up — so it fires when the work has ended rather than paused. The back-off
   is the honest part: at 50,000 words a compaction is 1.5 s and firing often is
   free, but at 300,000 it is 13 s, and freezing for 13 s because someone stepped
   away and came back is exactly the interruption this change exists to remove.
   One measured number tunes it, and there is no second knob. */
function _armIdleCompaction() {
  clearTimeout(_idleTimer);
  if (!_autoSave || !_journalBytes) return;
  const wait = _lastCompactMs > 2000 ? 10 * 60 * 1000 : 2 * 60 * 1000;
  _idleTimer = setTimeout(() => compact('idle'), wait);
}

/* @fn saveTick, the hot path: append, then compact only if something says so. */
async function saveTick() {
  if (!_autoSave) return;
  await flushJournal();
  /* Participants are not journalled — 845 bytes, so a journal would buy nothing
     and add a third replay path — and are written in full whenever they change. */
  await writeParticipants();
  if (!_journalComplete || _compactionDue()) {
    /* An incomplete journal is a save path that did not say what it wrote. It is
       not an error the annotator can act on, and it is not data loss either: the
       full write below is exactly what the app did before D50. Unknown degrades
       to yesterday's behaviour. */
    await compact(_journalComplete ? 'size' : 'incomplete journal');
  } else {
    _armIdleCompaction();
    flashSaveStatus(`${icon('check-circle')} ${t('status.autosaved', { targets: 'journal' })}`);
  }
}

/* ── D50: the two triggers that are not timers ───────────────────────────────
   Closing the lid or switching away is the strongest available signal that a
   session has ended, and it costs nothing to use. Blur is guarded on the last
   compaction having been quick: a 13 s freeze on a window blur would be a worse
   interruption than the one this replaced.

   ── B-199 · AN EXIT THAT CANNOT FINISH MUST NOT START ──────────────────────
   `beforeunload` used to call `compact('exit')`, and the comment here said the
   full write was "best-effort; if it does not finish, the journal on disk is
   complete and the next open replays it."

   **It is not best-effort, because it is not one effort.** `compact` writes the
   base and THEN truncates the journal, in that order and deliberately — a crash
   between them leaves a stale journal, which is survivable. But `beforeunload`
   cannot await, and the window goes away between the two steps: the base lands
   and the truncation does not. `write_abs` logs `File saved` AFTER `os.replace`,
   so the evidence of the half-run is an absence, which is why this took a log
   sweep to find.

   What is left behind is a base the journal no longer fingerprints, and the load
   REFUSES such a journal — correctly, since a stale one replays record bodies as
   an earlier version wrote them, over a base that has moved on. The two halves
   of D50 disagreed about what a stale journal is, and the disagreement was
   manufactured here, on every clean exit that had pending records.

   So the exit does the ONE step that is complete in itself. `flushJournal` is an
   append: it either lands or it does not, and either way nothing on disk
   contradicts anything else. The base stays as it was; the journal beside it
   still fingerprints it; the next open replays and the pair is consistent. The
   only cost is a longer journal at the next open, which is what a journal is
   for. Compaction keeps happening on blur, on the size trigger, and on save. */
if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => {
    if (_autoSave && _journalBytes && _lastCompactMs <= 2000) compact('window blur');
  });
  window.addEventListener('beforeunload', () => {
    if (_autoSave) flushJournal();
  });
}

/* ── Corpus↔dictionary pair memory (localStorage) ────────────────────────────
   Stores which dictionary was last used with each corpus so that re-opening the
   corpus can suggest the companion. Keys are corpus base filenames (no extension). */
// @fn storePair
function storePair(corpusBase, dictBase) {
  try {
    const pairs = JSON.parse(localStorage.getItem('lingcot_pairs') || '{}');
    pairs[corpusBase] = dictBase;
    localStorage.setItem('lingcot_pairs', JSON.stringify(pairs));
  } catch (_) {}  // storage unavailable in some browser contexts, fail silently
}

// @fn getSavedCompanion
function getSavedCompanion(corpusBase) {
  try {
    const pairs = JSON.parse(localStorage.getItem('lingcot_pairs') || '{}');
    return pairs[corpusBase] || null;
  } catch (_) { return null; }
}

/* ── Companion banner ─────────────────────────────────────────────────────────
   Non-blocking prompt shown when a corpus is loaded without a dictionary.
   Hides automatically when a dictionary is loaded or the user dismisses it. */
// @fn showCompanionBanner
function showCompanionBanner() {
  if (S.dictionary.length) return;  // already have a dict
  /* B-160: "is a dictionary file bound" and "does it hold entries" are different
     questions, and this asked the second while saying the first. A project whose
     dictionary is empty is bound — its path is armed and the next entry saves
     there — so inviting the annotator to load one is an invitation to point the
     project at a foreign file. Nothing is missing; nothing has been written yet. */
  if (_dictSavePath) return;
  const companion = getSavedCompanion(S._corpusFilename);
  const msgEl = document.getElementById('companion-msg');
  if (msgEl) {
    msgEl.innerHTML = companion
      /* B-149: `companion` is a PREFIX now, so the banner derives the filename
         rather than the locale string appending `.jsonl` to whatever it got. */
      ? t('companion.has_dict', { name: projectFile(companion, 'dictionary') })
      : t('companion.no_dict');
  }
  document.getElementById('companion-banner')?.removeAttribute('hidden');
}

// @fn hideCompanionBanner
function hideCompanionBanner() {
  document.getElementById('companion-banner')?.setAttribute('hidden', '');
}

/* ── Shared dict-load trigger ─────────────────────────────────────────────────
   Used by both the header "Dictionary" button and the companion banner "Load" button.
   Shows a native OS file dialog via pywebview.api.open_dialog(). */
// @fn triggerDictLoad
async function triggerDictLoad() {
  await _pwReady;
  const result = await window.pywebview.api.open_dialog(
    ['JSONL Files (*.jsonl;*.json)', 'All files (*.*)']
  );
  if (result && result[0]) await handlePath(result[0]);
}

/* `writePath` lived here: a second serializer with no callers, which would have
   written the pre-v3.14.226 shape if anyone had wired it up. Deleted rather than
   fixed, for the same reason `.offer-taken` was a trap — dead code that looks
   like a working path is worse than no path. `serializeRecords` in LingCoT.html
   is the one serializer now, and `consider()` is its one caller. */

/* ── B-055 · autosave writes only what changed ────────────────────────────────
   Autosave used to rewrite all three files every time: one dictionary gloss
   rebuilt and rewrote the entire corpus. Two independent brakes now:

   1. GENERATION, mutate(target) bumps a per-target counter. A target whose
      counter has not moved since its last successful write is skipped without
      being serialised at all. mutate() with no argument bumps all three, so an
      unlabelled call site costs a redundant write, never a stale file.
   2. FINGERPRINT, a target the generation says is dirty is still serialised
      and fingerprinted before writing; an identical payload is not written.
      This catches the mutation that bumped a counter without changing anything
      (re-saving an unedited form), which is the common interactive case.

   The two brakes catch different things and neither subsumes the other. What
   NEITHER catches is a call site naming the WRONG target, that is checked
   statically by dev/tests/autosave_target_test.js, because catching it here
   would mean serialising every target every time, which is the cost we came to
   remove. */
const _lastWrite = {                    // per target: what we last put on disk
  /* `bytes` is D50's: the compaction threshold is a proportion of the base, so
     the size of the last full write is the number it compares against. */
  corpus: { gen: -1, fp: null, path: null, bytes: 0 },
  dict:   { gen: -1, fp: null, path: null, bytes: 0 },
  parts:  { gen: -1, fp: null, path: null, bytes: 0 }
};

/* FNV-1a over the payload. Not cryptographic and does not need to be, it is
   guarding against "identical", not against an adversary. Storing a 32-bit
   number rather than the payload matters: retaining the last-written text for
   comparison would double the memory cost of a large corpus. */
// @fn _fingerprint
function _fingerprint(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `${str.length}:${h.toString(16)}`;   // length too, cheap extra guard
}

/* The ledger records WHICH FILE each fingerprint describes, so it invalidates
   itself when a save path changes. Thirteen places assign a save path; requiring
   each to remember a reset call is the same mistake B-030 documented, and the
   failure would be a silently unwritten file. Comparing the path is free and
   cannot be forgotten. */
// @fn resetWriteLedger, explicit reset, for a deliberate "write everything"
function resetWriteLedger() {
  for (const k of Object.keys(_lastWrite)) {
    _lastWrite[k].gen = -1; _lastWrite[k].fp = null; _lastWrite[k].path = null;
    _lastWrite[k].bytes = 0;
  }
}

/* Silently write corpus and/or dictionary to their stored paths.
   Flash message is specific about what was saved. */
/* @fn writeParticipants, the one store that is not journalled.
   Split out of the old doAutoSave so the hot path can write it without dragging
   the corpus and the dictionary along. */
// @fn writeParticipants
async function writeParticipants() {
  if (!_participantsPath || !window.pywebview) return;
  const led = _lastWrite.parts;
  if (led.path === _participantsPath && saveGen('parts') === led.gen) return;
  const text = serializeRecords([...S.annotators, ...S.sources], false);
  const fp   = _fingerprint(text);
  if (led.path === _participantsPath && fp === led.fp) { led.gen = saveGen('parts'); return; }
  const gen = saveGen('parts');
  await window.pywebview.api.write_abs(_participantsPath, text);
  led.gen = gen; led.fp = fp; led.path = _participantsPath;
  logEvent('debug', 'participants written', String(text.length));
}

/* @fn compact, fold the journal into the base and empty it.

   Was doAutoSave, and it still does exactly what that did — the difference is
   WHEN. It runs on a trigger (exit, size, idle, blur, or a journal that could
   not be trusted), never on an edit.

   Order is load-bearing: write the base, then truncate the journal, never the
   other way round. Killed in between you get a new base beside a full journal,
   which replays as a no-op because replay is idempotent. Killed the other way
   round you would get a new base beside nothing, which is fine, and an OLD base
   beside nothing, which is a lost session. */
// @fn compact
async function compact(reason = 'manual') {
  /* B-110. `if (!_autoSave) return` used to be the first line here, so the one
     button an annotator presses BECAUSE autosave is off did nothing and logged
     nothing. The gate belongs on the automatic callers — a timer firing when
     autosave is off is meaningless — and not on a person asking for a write.
     `autosaveDue()` is where it lives now.

     And every exit says what happened. Three silent returns stacked up here and
     a no-op was indistinguishable from a failure, which is B-011's family and
     B-031's. The return value is that answer; the caller phrases it. */
  const _t0 = Date.now();
  const saved     = [];
  const unchanged = [];   // a path is set and the bytes already match
  const noTarget  = [];   // no path, so nothing to write to
  const tasks   = [];
  const pending = [];   // ledger updates, applied only after the write succeeds

  /* B-055: the emptiness test used to be `&& items.length`, which meant
     deleting the LAST dictionary entry wrote nothing, the deletion never
     reached disk, the old file survived, and the status line still said
     "autosaved". Emptiness is a legitimate state and must be persisted; the
     path being set is the only precondition. */
  const consider = (target, absPath, items, label) => {
    if (!absPath) { noTarget.push(label); return; }
    const led = _lastWrite[target];
    // A path change means the fingerprint describes a different file, always
    // re-write, whatever the generation says.
    if (led.path === absPath && saveGen(target) === led.gen) { unchanged.push(label); return; }  // brake 1
    /* Interning stage B: the corpus and the dictionary carry their own dense
       event table; participants have no provenance of their own. Deterministic,
       so brake 2's fingerprint still compares like with like. */
    /* B-116: the corpus is rebuilt as ONE string here, and past V8's
       536,870,888 characters that throws. A corpus that cannot be saved is
       worse than one that cannot be loaded, because the annotation is already
       done and only in memory, so the failure is caught and reported rather
       than left to surface as an unhandled throw with the session's work in it.

       D50 changed how OFTEN this runs, not whether: an edit appends to the
       journal, and only a compaction builds the whole string. So the journal is
       the reason this is survivable — the records are already on disk — and
       that is exactly what the message says to do. */
    let text;
    try {
      text = serializeRecords(items, target === 'corpus' || target === 'dict');
    } catch (e) {
      logEvent('error', 'corpus too large to serialize', `${target}: ${e && e.message}`);
      alert(t('alert.save.too_large', { target: label }));
      return;
    }
    if (text.length > _JS_STRING_WARN) warnStringSize(target, text.length);
    const fp   = _fingerprint(text);
    if (led.path === absPath && fp === led.fp) {             // brake 2
      led.gen = saveGen(target);                  // seen; nothing to write
      logEvent('debug', 'autosave skip — unchanged', target);
      unchanged.push(label);
      return;
    }
    const gen = saveGen(target);
    tasks.push(window.pywebview.api.write_abs(absPath, text));
    // D50: the base's size is what the proportional compaction threshold reads.
    pending.push(() => { led.gen = gen; led.fp = fp; led.path = absPath; led.bytes = text.length; });
    saved.push(label);
  };

  /* Any records still pending belong in the journal before the base is written,
     so that a failure below leaves them on disk rather than only in memory. */
  await flushJournal();

  consider('corpus', _savePath,     S.docs,      'corpus');
  // D35 A2: the dictionary file holds entries AND lemma records; dictFileItems()
  // is the one place that knows so, and every write path goes through it.
  consider('dict',   _dictSavePath, dictFileItems(), 'dictionary');
  // Participants file holds both annotators and sources in one JSONL
  consider('parts',  _participantsPath, [...S.annotators, ...S.sources], 'participants');

  /* Nothing to write is an OUTCOME, not an absence. It is reported, logged and
     returned, because "already up to date" and "there is nowhere to write this"
     are different answers and the annotator was given neither. */
  if (!tasks.length) {
    logEvent('info', 'nothing to write', `${reason}: ${unchanged.length} unchanged, ${noTarget.length} with no path`);
    return { written: [], unchanged, noTarget, ok: true };
  }
  try {
    await Promise.all(tasks);
    for (const commit of pending) commit();   // only now is it true of the disk
    /* D50: the full write just replaced the base, so the journal beside it is
       spent. Truncating AFTER the write, never before, is what makes an
       interrupted compaction safe: a stale journal replays as a no-op, a lost
       one does not. */
    if (saved.length && window.pywebview) {
      const jp = journalPath();
      if (jp) { try { await window.pywebview.api.truncate_abs(jp); } catch (_) {} }
      journalReset();
      _journalBytes = 0;
    }
    _lastCompactMs = Date.now() - _t0;
    clearTimeout(_idleTimer);
    flashSaveStatus(`${icon('check-circle')} ${t('status.autosaved', {targets: saved.join(' + ')})}`);
    logEvent('info', 'compacted', `${reason}, ${saved.join('+')}, ${_lastCompactMs} ms`);
    return { written: saved, unchanged, noTarget, ok: true };
  } catch (err) {
    console.error('Compaction failed:', err);
    flashSaveStatus(`${icon('warning')} ${t('status.save_failed')}`);
    logEvent('error', 'compaction failed', err.message || String(err));
    /* The journal is NOT truncated on a failure, so nothing is lost: the records
       are still on disk and still replay. */
    return { written: [], unchanged, noTarget, ok: false, err };
  }
}

/* @fn saveOutcomeMessage, B-110: what just happened, in one line.

   Kept beside `compact` rather than in the handler because three callers phrase
   the same four outcomes, and a no-op reported by only one of them is the bug
   this whole change is about. */
// @fn saveOutcomeMessage
function saveOutcomeMessage(r) {
  if (!r)        return t('status.save_nothing');
  if (!r.ok)     return t('status.save_failed');
  if (r.written.length) return t('status.saved_now', { targets: r.written.join(' + ') });
  if (r.unchanged.length) return t('status.save_unchanged', { targets: r.unchanged.join(' + ') });
  return t('status.save_no_target');
}

/* @fn exportProject, B-110: a real export, not the autosave path under a label.

   Writes a COPY of the whole project — corpus, dictionary and participants —
   where the annotator says, and leaves `_savePath`, `_dictSavePath`,
   `_participantsPath` and the autosave state exactly as they were. That is the
   difference between an export and a save, and the button said the first while
   doing the second.

   One dialog, not three: the annotator names the corpus file and the other two
   follow the project convention beside it (`project_files.js`). Naming them
   separately would let an export produce three files that are not a project. */
// @fn exportProject
async function exportProject() {
  await _pwReady;
  const prefix = S._corpusFilename || 'corpus';
  const target = await window.pywebview.api.save_dialog(
    projectFile(prefix, 'corpus'), ['JSONL (*.jsonl)', 'All files (*.*)']);
  if (!target) return null;

  /* Pending records first. An export that misses the last edit is worse than no
     export: it looks complete. The journal is NOT truncated — these bytes went
     to a copy, and the project's own base has not been rewritten. */
  await flushJournal();

  const parts = [
    ['corpus',       projectSibling(target, 'corpus'),       S.docs,                            true],
    ['dictionary',   projectSibling(target, 'dictionary'),   dictFileItems(),                   true],
    ['participants', projectSibling(target, 'participants'), [...S.annotators, ...S.sources],   false],
  ];
  const written = [];
  try {
    for (const [label, path, items, intern] of parts) {
      if (!items.length && label !== 'corpus') continue;   // an empty companion is not written
      await window.pywebview.api.write_abs(path, serializeRecords(items, intern));
      written.push(label);
    }
  } catch (err) {
    logEvent('error', 'export failed', err.message || String(err));
    flashSaveStatus(`${icon('warning')} ${t('status.export_failed')}`);
    alert(t('alert.export.failed', { err: err.message || String(err) }));
    return null;
  }
  logEvent('info', 'project exported', `${written.join('+')} → ${projectSibling(target, 'corpus')}`);
  flashSaveStatus(`${icon('check-circle')} ${t('status.exported', { targets: written.join(' + ') })}`);
  return { written, path: projectSibling(target, 'corpus') };
}

/* Show a native save dialog and store the chosen path as the corpus save target.
   forAutosave=true arms autosave on success. */
// @fn chooseSavePath
async function chooseSavePath(forAutosave = false) {
  await _pwReady;
  /* B-149: derived, not guessed. All three dialogs below ask projectFile() for
     the same prefix, so the name offered for one file is one the opener will
     derive the other three from. Before this each built its own, and every one
     of them was wrong in one of the two states `S._corpusFilename` could hold. */
  const suggested = (_savePath
    ? _savePath.replace(/\\/g, '/').split('/').pop()
    : projectFile(S._corpusFilename, 'corpus'));
  const path = await window.pywebview.api.save_dialog(
    suggested,
    ['JSONL (*.jsonl)', 'All files (*.*)']
  );
  if (!path) return false;
  _savePath = path;
  if (forAutosave) _autoSave = true;
  return true;
}

/* Show a native save dialog and store the chosen path as the dictionary save target. */
// @fn chooseDictSavePath
async function chooseDictSavePath() {
  await _pwReady;
  /* The dictionary's own prefix when one was loaded, otherwise the corpus's —
     a dictionary built in the app belongs to the project on screen, and offering
     the bare `dictionary.jsonl` made it a project of its own. */
  const suggested = (_dictSavePath
    ? _dictSavePath.replace(/\\/g, '/').split('/').pop()
    : projectFile(S._dictFilename || S._corpusFilename, 'dictionary'));
  const path = await window.pywebview.api.save_dialog(
    suggested,
    ['JSONL (*.jsonl)', 'All files (*.*)']
  );
  if (!path) return false;
  _dictSavePath = path;
  return true;
}

/* Show a native save dialog and store the chosen path as the participants save target. */
// @fn chooseParticipantsSavePath
async function chooseParticipantsSavePath() {
  await _pwReady;
  const suggested = (_participantsPath
    ? _participantsPath.replace(/\\/g, '/').split('/').pop()
    : projectFile(S._corpusFilename, 'participants'));
  const path = await window.pywebview.api.save_dialog(
    suggested,
    ['JSONL (*.jsonl)', 'All files (*.*)']
  );
  if (!path) return false;
  _participantsPath = path;
  return true;
}

/* Briefly show a status message next to the breadcrumb in the header. */
// @fn flashSaveStatus
/* @fn flashSaveStatus, the app's one channel for saying what just happened.

   L-038. Fourteen call sites in two files send everything through here —
   "Save failed", "Export failed", and all of `reportLinkNotes`'s counted
   statements — and it showed them at 0.72rem in `--text-muted`, in the header
   corner, for 2.5 s, unhoverable and with no history. The expensive half was
   already right: those messages are precise and honest. They were whispered.

   TWO changes, and both are derived rather than declared at the call sites:

   1. SEVERITY comes from the icon the caller already passes. Every one of the
      fourteen prefixes `check-circle`, `warning` or `book`, so nothing had to be told
      twice — and `outcome_channel_test` holds that, because a caller with no
      icon would silently be read as success.
   2. A FAILURE DOES NOT EXPIRE. It stays until it is replaced or clicked away.
      A message that says the save failed and then removes itself after two and
      a half seconds is worse than none: it is the app knowing and not saying.

   The history below is IN MEMORY and goes nowhere else — not to `logs/`, not to
   disk. Several of these messages name forms, and PRACTICES §9 is that
   annotation content is never logged. */
const OUTCOME_MAX = 40;
const _outcomes = [];       // newest first; capped; never persisted

// @fn outcomeHistory, what has been said this session
function outcomeHistory() { return _outcomes; }

function flashSaveStatus(msg) {
  const warn = /#ph-warning/.test(String(msg));
  _outcomes.unshift({ html: String(msg), warn, at: new Date() });
  if (_outcomes.length > OUTCOME_MAX) _outcomes.length = OUTCOME_MAX;
  /* The panel is a live view of this list, so it follows without being told. */
  if (typeof renderGapPanel === 'function'
      && !document.getElementById('gap-panel-box')?.hidden) renderGapPanel();

  const el = document.getElementById('save-status-flash');
  if (!el) return;
  el.innerHTML = msg;
  el.classList.add('visible');
  el.classList.toggle('flash-warn', warn);
  el.title = warn ? (typeof t === 'function' ? t('title.flash.dismiss') : '') : '';
  clearTimeout(el._flashTimer);
  if (warn) return;                       // stays until replaced or dismissed
  el._flashTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

/* ── Save settings panel ── */

/* Sync one path display element.
   absPath, full absolute path (set when user picks via Change…); shown as filename only.
   loadedPrefix, S._corpusFilename / S._dictFilename — a project PREFIX (B-149),
   never a filename. `role` turns it into one, so this row and the dialog behind
   its Change… button cannot name the same file two ways.
   Priority: absolute path > derived name (muted, no save target yet) > placeholder. */
// @fn _syncPanelPath
function _syncPanelPath(id, absPath, loadedPrefix, role) {
  const el = document.getElementById(id);
  if (!el) return;
  if (absPath) {
    // Show just the filename; store the full path in the title for reference
    el.textContent = absPath.replace(/\\/g, '/').split('/').pop();
    el.title = absPath;
    el.classList.remove('empty');
  } else if (loadedPrefix) {
    el.textContent = projectFile(loadedPrefix, role);
    el.classList.add('empty');   // muted, loaded but no save path set yet
    el.title = t('sp.status.loaded_no_path');
  } else {
    el.textContent = t('sp.status.no_file');
    el.classList.add('empty');
    el.title = '';
  }
}

/* Refresh path rows in-place (called by applyCorpus/applyDict so the panel
   stays up-to-date even if it happens to be open during a drag-and-drop load). */
// @fn refreshSavePanelPaths
function refreshSavePanelPaths() {
  const box = document.getElementById('save-panel-box');
  if (!box || box.hasAttribute('hidden')) return;
  _syncPanelPath('sp-corpus-path',       _savePath,         S._corpusFilename, 'corpus');
  _syncPanelPath('sp-dict-path',         _dictSavePath,     S._dictFilename || S._corpusFilename, 'dictionary');
  _syncPanelPath('sp-participants-path', _participantsPath, S._corpusFilename, 'participants');
  const dictRow  = document.getElementById('sp-dict-row');
  if (dictRow) dictRow.classList.toggle('sp-row-disabled', !S.dictionary.length && !_dictSavePath);
  const partRow = document.getElementById('sp-participants-row');
  if (partRow) partRow.classList.toggle('sp-row-disabled',
    !S.annotators.length && !S.sources.length && !_participantsPath);
}

// @fn openSavePanel
function openSavePanel() {
  _syncPanelPath('sp-corpus-path',       _savePath,         S._corpusFilename, 'corpus');
  _syncPanelPath('sp-dict-path',         _dictSavePath,     S._dictFilename || S._corpusFilename, 'dictionary');
  _syncPanelPath('sp-participants-path', _participantsPath, S._corpusFilename, 'participants');

  // Dim file rows when there is no data and no save path set for them.
  const dictRow = document.getElementById('sp-dict-row');
  if (dictRow) dictRow.classList.toggle('sp-row-disabled', !S.dictionary.length && !_dictSavePath);
  const partRow = document.getElementById('sp-participants-row');
  if (partRow) partRow.classList.toggle('sp-row-disabled',
    !S.annotators.length && !S.sources.length && !_participantsPath);

  const toggleEl = document.getElementById('sp-autosave-toggle');
  const hintEl   = document.getElementById('sp-hint');
  if (toggleEl) toggleEl.checked = _autoSave;
  if (hintEl) hintEl.textContent = _autoSave
    ? 'On — changes saved automatically'
    : 'Off — changes must be saved manually';

  // Show "Export as .zip" only when there is a managed corpus folder to zip
  const zipBtn = document.getElementById('sp-export-zip');
  if (zipBtn) zipBtn.style.display = _corpusFolder ? '' : 'none';

  document.getElementById('save-panel-backdrop').classList.add('open');
  document.getElementById('save-panel-box').removeAttribute('hidden');
}

// @fn closeSavePanel
function closeSavePanel() {
  document.getElementById('save-panel-backdrop').classList.remove('open');
  document.getElementById('save-panel-box').setAttribute('hidden', '');
}

/* ── Autosave prompt modal ───────────────────────────────────────────────────
   Generic modal used whenever we need to ask the user whether to enable
   autosave.  The caller passes a message string and two callbacks:
     onYes, called when the user clicks "Yes, autosave"
     onNo, called when the user clicks "Not now" or the backdrop

   Replaced the old showNewCorpusSavePrompt / closeNewCorpusSavePrompt pair
   so the same modal can handle both new-corpus and file-load flows. */

// @fn showAutosavePrompt
function showAutosavePrompt(message, onYes, onNo) {
  _ncsCallback = { onYes, onNo };
  document.getElementById('ncs-message').textContent = message;
  document.getElementById('ncs-backdrop').classList.add('open');
  document.getElementById('ncs-box').removeAttribute('hidden');
}

// @fn closeAutosavePrompt
function closeAutosavePrompt() {
  document.getElementById('ncs-backdrop').classList.remove('open');
  document.getElementById('ncs-box').setAttribute('hidden', '');
  _ncsCallback = null;
}

/* ── Missing-file modal ───────────────────────────────────────────────────────
   Shows a named modal when a companion file is absent from the project folder.
   Returns a Promise<bool>: true = user chose "Create new file", false = cancelled. */

// @fn showMissingFileModal
function showMissingFileModal(filename) {
  return new Promise(resolve => {
    _mfResolve = resolve;
    document.getElementById('mf-message').textContent =
      `"${filename}" was not found in this project folder.`;
    document.getElementById('mf-backdrop').classList.add('open');
    document.getElementById('mf-box').removeAttribute('hidden');
  });
}

// @fn closeMissingFileModal
function closeMissingFileModal(result) {
  document.getElementById('mf-backdrop').classList.remove('open');
  document.getElementById('mf-box').setAttribute('hidden', '');
  if (_mfResolve) { _mfResolve(result); _mfResolve = null; }
}

/* Iterate over project.missing and prompt for each non-corpus missing file.
   Returns true if we should proceed (all prompts accepted), false if cancelled.
   A missing corpus is a hard error, cannot load without it. */
// @fn checkMissingFiles
async function checkMissingFiles(project) {
  for (const fname of (project.missing || [])) {
    // B-149: which role a missing name IS, asked of the one table.
    if (fname.endsWith(PROJECT_ROLES.corpus)) {
      alert(t('alert.file.corpus_missing', { name: fname }));
      return false;
    }
    // Dictionary or participants, offer to create an empty file on next save
    const ok = await showMissingFileModal(fname);
    if (!ok) return false;
  }
  return true;
}

/* Prompt autosave setup after a brand-new corpus is created.
   Creates a managed <workspace>/corpora/CORPUSNAME/ folder via Python if the user
   agrees, outside the app folder, so fieldwork never lands in the Git repo.
   The prompt names the real absolute path, so the user learns where their data
   lives at the one moment they are actually thinking about it. */
// @fn promptNewCorpusAutosave
async function promptNewCorpusAutosave(title) {
  const safe = sanitizeFilename(title);
  showAutosavePrompt(
    t('modal.autosave.prompt.new_corpus',
      {title, path: _workspaceCorpora ? `${_workspaceCorpora}/${safe}` : safe}),
    async () => {
      // User said yes, create the managed folder and arm autosave
      try {
        await _pwReady;
        const result = await window.pywebview.api.setup_corpus_dir(safe);
        _savePath         = result.corpusPath;
        _dictSavePath     = result.dictPath;
        _participantsPath = result.participantsPath;
        _corpusFolder     = result.folder;
        _autoSave         = true;
        clearTimeout(_autoSaveTimer);
        await compact('autosave armed');
        flashSaveStatus(`${icon('check-circle')} ${t('status.autosave_on')}`);
        logEvent('info', 'new corpus created', result.folder);
        _syncPanelPath('sp-corpus-path', _savePath, S._corpusFilename, 'corpus');
        _syncPanelPath('sp-dict-path',   _dictSavePath, S._dictFilename || S._corpusFilename, 'dictionary');
      } catch (err) {
        console.error('setup_corpus_dir failed:', err);
        alert(t('alert.folder.create_failed', { err: err.message || String(err) }));
      }
      // New corpus always starts with an empty dict, companion banner is
      // irrelevant here; the dict path is already set by setup_corpus_dir.
    },
    () => {
      // User skipped autosave, corpus starts with empty dict, no banner needed.
      _autoSave = false;
    }
  );
}

/* Prompt autosave after a corpus file is loaded from disk (via dialog or drag-drop).
   absPath, the source path if known (dialog load); null for drag-drop.
   corpusBase, the display name (filename without extension).
   dictPath, companion dict path from open_project; arms _dictSavePath on accept. */
// @fn promptLoadedCorpusAutosave
async function promptLoadedCorpusAutosave(absPath, corpusBase, dictPath = null) {
  if (_autoSave) return;   // autosave already on, no need to prompt again
  if (absPath) {
    // File came from a known path, offer to save back there
    showAutosavePrompt(
      t('modal.autosave.prompt.load_file', {name: corpusBase}),
      () => {
        _savePath = absPath;
        // Arm dict save path if a companion was loaded but not yet pointed at a file
        if (dictPath && !_dictSavePath) {
          _dictSavePath = dictPath;
          _syncPanelPath('sp-dict-path', _dictSavePath, S._dictFilename || S._corpusFilename, 'dictionary');
        }
        _autoSave = true;
        _syncPanelPath('sp-corpus-path', _savePath, S._corpusFilename, 'corpus');
        flashSaveStatus(`${icon('check-circle')} ${t('status.autosave_on')}`);
      },
      () => { /* user skipped */ }
    );
  } else {
    // Drag-drop, no source path; offer a managed workspace folder instead
    const safe = sanitizeFilename(corpusBase);
    showAutosavePrompt(
      t('modal.autosave.prompt.load_dragged',
        {name: corpusBase, path: _workspaceCorpora ? `${_workspaceCorpora}/${safe}` : safe}),
      async () => {
        try {
          await _pwReady;
          const result = await window.pywebview.api.setup_corpus_dir(safe);
          _savePath         = result.corpusPath;
          _dictSavePath     = result.dictPath;
          _participantsPath = result.participantsPath;
          _corpusFolder     = result.folder;
          _autoSave         = true;
          clearTimeout(_autoSaveTimer);
          await compact('autosave armed');
          flashSaveStatus(`${icon('check-circle')} ${t('status.autosave_on')}`);
          logEvent('info', 'autosave folder created for loaded corpus', result.folder);
          _syncPanelPath('sp-corpus-path', _savePath, S._corpusFilename, 'corpus');
          _syncPanelPath('sp-dict-path',   _dictSavePath, S._dictFilename || S._corpusFilename, 'dictionary');
        } catch (err) {
          console.error('setup_corpus_dir failed:', err);
          alert(t('alert.folder.create_failed', { err: err.message || String(err) }));
        }
      },
      () => { /* user skipped */ }
    );
  }
}

/* ── One-time delegated listeners (attached at boot, never re-attached) ── */
// @fn initDelegatedListeners
function initDelegatedListeners() {
  const contentEl = document.getElementById('content');

  /* Navigation: [data-go], shared opts-parser for content and header listeners */
  function resolveGoOpts(el) {
    const target = el.dataset.go;
    const opts   = {};
    if (el.dataset.si      !== undefined) opts.sectIdx     = parseInt(el.dataset.si);
    if (el.dataset.pi      !== undefined) opts.paraIdx     = parseInt(el.dataset.pi);
    if (el.dataset.sid     !== undefined) opts.sentId      = el.dataset.sid;
    if (el.dataset.wid     !== undefined) opts.wordId      = el.dataset.wid;
    if (el.dataset.dform   !== undefined) opts.dictForm    = el.dataset.dform;
    if (el.dataset.entryId  !== undefined) opts.dictEntryId  = el.dataset.entryId;
    if (el.dataset.lemmaId  !== undefined) opts.lemmaId      = el.dataset.lemmaId;   // D35 B5
    if (el.dataset.dictBack !== undefined && el.dataset.dictBack !== '')
      opts.dictBackView = el.dataset.dictBack;
    if (el.dataset.dictParentForm !== undefined && el.dataset.dictParentForm !== '')
      opts.dictParentForm = el.dataset.dictParentForm;
    /* The `data-add-*` prefill went with `renderDictAdd` at v3.14.270. It was a
       contract between this reader and the "+ dict" chip that neither owned:
       B-050 found keys with no producer, B-060 found the one key with real user
       cost being dropped. The panel builds its row from the model instead. */
    return { target, opts };
  }

  /* [data-go] inside #content */
  contentEl.addEventListener('click', e => {
    const el = e.target.closest('[data-go]');
    if (!el) return;
    e.stopPropagation();
    const { target, opts } = resolveGoOpts(el);
    go(target, opts);
  });

  /* GUI-1c: keyboard activation for [data-go] elements that are focusable.
     These are <div>/<span> carrying data-go, so the browser gives them no
     keyboard behaviour of its own, a click handler alone makes them
     mouse-only. Scoped to elements that opted in with tabindex, so adding
     `role="link" tabindex="0"` to one element makes it fully operable without
     putting every data-go div in the tab order. Space is included because a
     role="link" element is expected to answer Enter, and Space is the habit
     users bring from buttons; preventDefault stops Space scrolling the page. */
  contentEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const goEl = e.target.closest('[data-go][tabindex]');
    if (goEl) {
      e.preventDefault();
      e.stopPropagation();
      const { target, opts } = resolveGoOpts(goEl);
      go(target, opts);
      return;
    }

    /* v3.14.97: the same courtesy for [data-action] elements that opted in with
       tabindex. `.ph-ann-link` in the provenance history was clickable, focusable
       nowhere, and answered no key, mouse-only, found by ui_wiring_test.js
       sweeping the markup rather than by anyone reporting it. Dispatching a
       click keeps one handler for both input methods, so they cannot diverge. */
    const actEl = e.target.closest('[data-action][tabindex]');
    if (actEl) {
      e.preventDefault();
      e.stopPropagation();
      actEl.click();
    }
  });

  /* ── D30: prev/next annotation traversal ──────────────────────────────
     The controls live in the RENDER views, so there is no unsaved-changes
     question to answer and no text input for the keyboard bindings to fight. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-nav][data-nav-to]');
    if (!btn) return;
    e.stopPropagation();
    const kind = btn.dataset.navKind;
    navGo(kind, btn.dataset.navTo, kind === 'word' ? S.wordId : S.sentId);
  });

  /* Keyboard traversal. Bound on the document rather than #content so it works
     without clicking into the pane first, and gated three ways:
       · only in the two render views that HAVE the control,
       · never while a text field or contenteditable has focus, the whole
         reason D30 put these controls outside the editors,
       · never with a modifier, so browser and OS shortcuts are untouched. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (S.view !== 'word' && S.view !== 'sentence') return;
    const el = document.activeElement;
    if (el && (el.matches('input, textarea, select') || el.isContentEditable)) return;
    const kind = S.view;
    const from = kind === 'word' ? S.wordId : S.sentId;
    const to   = navAdvance(kind, from, e.key === 'ArrowRight' ? +1 : -1);
    if (!to) return;                       // document edge, let the key do nothing
    e.preventDefault();                    // otherwise the pane scrolls sideways
    navGo(kind, to, from);
  });

  /* [data-go] inside #header, breadcrumb links live here, not in #content */
  const headerEl = document.getElementById('header');
  headerEl.addEventListener('click', e => {
    const el = e.target.closest('[data-go]');
    if (!el) return;
    e.stopPropagation();
    const { target, opts } = resolveGoOpts(el);
    go(target, opts);
  });

  /* Dictionary entry delete (data-action="dict-delete") */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="dict-delete"]');
    if (!btn) return;
    e.stopPropagation();
    deleteDictEntry(btn.dataset.entryId);
  });

  /* D52: merge this entry into a same-form sibling (data-action="dict-merge").
     `change`, not `click`: the control is a select and the choice IS the act. */
  contentEl.addEventListener('change', e => {
    const sel = e.target.closest('select[data-action="dict-merge"]');
    if (!sel || !sel.value) return;
    const mergedId = sel.dataset.entryId, survivorId = sel.value;
    const keep = S.dictById.get(survivorId), drop = S.dictById.get(mergedId);
    sel.value = '';                       // the menu is a verb, not a state
    if (!keep || !drop) return;

    /* B-155's own warning, enforced. Two entries of different TYPE are a genuine
       pair — `metin` as `word` and as `bound.morpheme` is the case `samples/`
       carries — so the annotator says so out loud rather than sliding past it. */
    if (keep.type && drop.type && keep.type !== drop.type &&
        !confirm(t('confirm.entry.merge_types', { a: drop.type, b: keep.type })))
      return;

    /* What moves, before it moves — the shape `deleteDictEntry`'s confirm uses,
       for the same reason: the annotator agrees to the blast radius, not to a verb. */
    const refs = dictEntryRefs(mergedId);
    if (!confirm(t('confirm.entry.merge', {
          from: drop.form + (drop.homograph ? '·' + drop.homograph : ''),
          into: keep.form + (keep.homograph ? '·' + keep.homograph : ''),
          n:          dictEntryRefCount(refs),
          words:      refs.words.length,
          morphemes:  refs.morphemes.length,
          lemmaWords: refs.lemmaWords.length,
          entries:    refs.entries.length })))
      return;

    const r = mergeDictEntries(survivorId, mergedId);
    if (!r.ok) { alert(t('alert.entry.merge_failed', { reason: r.reason })); return; }
    flashSaveStatus(`${icon('check-circle')} ${t('status.entry.merged', { n: r.moved })}`);
    if (r.filled.length)
      linkNote('note.entry.merge_filled', { n: r.filled.length, fields: r.filled.join(', ') });
    reportLinkNotes();
    go('dict', { dictForm: keep.form, dictEntryId: keep.id });
  });

  /* Quick-lemma inline panel (ql-toggle / ql-cancel / ql-save)
     These live inside renderDictEdit, rendered into contentEl. */
  contentEl.addEventListener('click', e => {
    // ── Toggle: open/close the inline create panel ─────────────────────────
    const toggleBtn = e.target.closest('[data-action="ql-toggle"]');
    if (toggleBtn) {
      e.stopPropagation();
      const panel = document.getElementById(toggleBtn.dataset.qlTarget);
      if (!panel) return;
      const opening = !panel.classList.contains('ql-open');
      panel.classList.toggle('ql-open', opening);
      // Pre-fill the form field from the lemma input when opening
      if (opening) {
        const src = document.getElementById(toggleBtn.dataset.qlSource);
        const lformEl = document.getElementById(panel.id.replace('-panel', '-lform'));
        if (lformEl && src?.value.trim()) lformEl.value = src.value.trim();
      }
      return;
    }

    // ── Cancel: collapse the panel ─────────────────────────────────────────
    const cancelBtn = e.target.closest('[data-action="ql-cancel"]');
    if (cancelBtn) {
      e.stopPropagation();
      const panel = document.getElementById(cancelBtn.dataset.qlTarget);
      if (panel) panel.classList.remove('ql-open');
      return;
    }

    // ── Save: create the lemma entry, fill the Lemma input, close panel ────
    const saveBtn = e.target.closest('[data-action="ql-save"]');
    if (saveBtn) {
      e.stopPropagation();
      if (!requireAnnotator()) return;

      const lForm  = document.getElementById(saveBtn.dataset.qlLform)?.value.trim()  || '';
      const lPos   = document.getElementById(saveBtn.dataset.qlLpos)?.value.trim()   || null;
      const lGloss = document.getElementById(saveBtn.dataset.qlLgloss)?.value.trim() || null;
      /* I1: the quick-lemma panel's ids are derived from the host input, so
         they are not the table's ids. The MESSAGE still comes from the table,
         which is where the rule now lives. */
      if (!lForm) {
        alert(t(fieldOf('lemma', 'form')?.emptyMsg || 'hint.identity.required'));
        document.getElementById(saveBtn.dataset.qlLform)?.focus();
        return;
      }

      // If a matching lemma already exists, just fill the field and close
      const existing = lookupLemma(lForm);   // B-052: indexed
      if (existing) {
        const inp = document.getElementById(saveBtn.dataset.qlInput);
        if (inp) inp.value = existing.form;
        const panel = document.getElementById(saveBtn.dataset.qlPanel);
        if (panel) panel.classList.remove('ql-open');
        return;
      }

      /* Create the new lemma record. D35 A2: a lemma names a group of entries
         and carries no analysis of its own, so the POS and gloss the panel
         collects are kept on the record but are not what identifies it. */
      const lemmaEntry = {
        id:             `dict_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        form:           lForm,
        record_type:    'lemma',   // B-119: one discriminator, see splitDictFile
        /* D50 stage 4d, L-020: `comments: []` was minted here on every new
           lemma — 33 in the live corpus, all empty, a field the table calls
           legacy. A key created empty is not "carried so nothing a project
           typed is thrown away". Gone; the load migration drops the existing
           empty ones.

           `part_of_speech` and `gloss` are NOT dropped, and the contradiction is
           left standing rather than resolved here: the table calls them legacy
           because D35 A2 says a lemma carries no analysis of its own, while this
           panel collects both from the annotator. One of those two is wrong, and
           deciding which is D35 B5's, not a cleanup's. Dropping them here would
           discard typed input on the strength of a tier label. */
        part_of_speech: lPos,
        gloss:          lGloss,
        ...initProv()
      };
      _indexLemma(lemmaEntry);

      /* D42: no datalist to top up any more. AC_POOLS.lemma reads S.lemmas
         live, and the record was indexed one line above, so the new lemma is
         offered on the next keystroke without anything being appended. */

      // Fill the Lemma field with the new form
      const inp = document.getElementById(saveBtn.dataset.qlInput);
      if (inp) inp.value = lForm;

      // Collapse the panel
      const panel = document.getElementById(saveBtn.dataset.qlPanel);
      if (panel) panel.classList.remove('ql-open');

      // Update dict status badge (was a hardcoded English string, i18n miss)
      updateDictStatus();
      // B-055: quick-lemma creates a dictionary entry only. D50: and says so.
      mutate('dict', [lemmaEntry]);
      return;
    }
  });

  /* Sentence span click (spans lack data-go, handled separately) */
  contentEl.addEventListener('click', e => {
    const span = e.target.closest('.s-span[data-sid]');
    if (!span || e.target.closest('[data-go]')) return;
    e.stopPropagation();
    go('sentence', { sentId: span.dataset.sid });
  });

  /* Choice-chip clicks and expand-button clicks. D44: pos-select and type-select
     did the same three lines with a different refresh; the row knows its fold.
     B-090 moved the body out of the listener: the completion modal lives outside
     #content and had grown its own half-copy of this, which knew about POS chips
     but not type chips and never opened a drawer. */
  contentEl.addEventListener('click', handleChipClick);

  /* ── Add to dictionary (S4) ─────────────────────────────────────────────────
     The Entry Sheet was retired; "+ Lexicon" now opens word-edit (the single
     annotate-token surface) with the "Also save to dictionary" box pre-checked,
     so dict creation flows through the consolidated path + completion modal.
     go() renders synchronously, so the checkbox exists right after navigation. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="annotate-to-dict"]');
    if (!btn) return;
    e.stopPropagation();
    go('word-edit', { wordId: btn.dataset.wid, sentId: btn.dataset.sid });
    const cb = document.getElementById('ew-push-dict');
    if (cb) cb.checked = true;   // the picker asks which forms, after the save
  });

  /* B1: light/dark theme toggle (fixed button, outside #content) */
  document.getElementById('theme-toggle')?.addEventListener('click', () => toggleTheme());
  if (typeof updateThemeToggle === 'function') updateThemeToggle();  // paint icon now (label fills in after locale)

  /* C21: Escape closes the topmost open anchored panel / popup. Edit views are
     intentionally left alone. Esc must never discard an in-progress edit (use the
     Cancel button). Modals (annotator/source/completion/xlate) keep their own Esc
     handlers; this covers the dropdown panels that previously closed on outside-
     click only. Closes one surface per keypress, in stacking-priority order. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const panels = [
      ['gloss-ac-drop',     'ac-visible',  hideGlossAC],
      ['lp-panel',          'lp-visible',  closeLeipzigPanel],
      ['ann-preview-panel', 'app-visible', closeAnnPreviewPanel],
      ['src-pick-panel',    'spp-visible', closeSrcPickPanel],
      ['ann-panel',         'ann-visible', closeAnnPanel],
    ];
    for (const [id, cls, close] of panels) {
      const el = document.getElementById(id);
      if (el && el.classList.contains(cls) && typeof close === 'function') { close(); return; }
    }
  });

  /* Paragraph span hover */
  contentEl.addEventListener('mouseover', e => {
    const span = e.target.closest('.p-span');
    if (span) span.classList.add('hi');
  });
  contentEl.addEventListener('mouseout', e => {
    const span = e.target.closest('.p-span');
    if (span) span.classList.remove('hi');
  });

  /* Sentence span hover, uses _sSpanCache to avoid a live DOM query on
     every mouse event.  The cache is keyed by sentence ID and populated
     lazily on the first hover of each sentence; render() clears it
     whenever the content area is replaced with new DOM. */
  const sSpansFor = sid => {
    if (!_sSpanCache.has(sid)) {
      _sSpanCache.set(sid,
        Array.from(contentEl.querySelectorAll(`.s-span[data-sid="${CSS.escape(sid)}"]`))
      );
    }
    return _sSpanCache.get(sid);
  };

  contentEl.addEventListener('mouseover', e => {
    const span = e.target.closest('.s-span[data-sid]');
    if (!span) return;
    sSpansFor(span.dataset.sid).forEach(s => s.classList.add('hi'));
  });
  contentEl.addEventListener('mouseout', e => {
    const span = e.target.closest('.s-span[data-sid]');
    if (!span) return;
    sSpansFor(span.dataset.sid).forEach(s => s.classList.remove('hi'));
  });

  /* ── Annotator panel, open button (delegated on #content) ─────────────── */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="open-ann"]');
    if (!btn) return;
    e.stopPropagation();
    const inputEl = document.getElementById(btn.dataset.annTarget);
    openAnnPanel(inputEl, btn);
  });

  /* ── Annotator preview panel, chip click in edit views (delegated) ─────── */
  contentEl.addEventListener('click', e => {
    const chip = e.target.closest('[data-action="preview-annotator"]');
    if (!chip) return;
    e.stopPropagation();
    openAnnPreviewPanel(chip.dataset.annId, chip);
  });

  /* ── Annotator clear button, deselects the current annotator from the bar ── */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="clear-annotator"]');
    if (!btn) return;
    e.stopPropagation();
    const inputEl = document.getElementById('edit-annotator');
    if (inputEl) {
      inputEl.value         = '';
      inputEl.dataset.annId = '';
    }
    // Re-render the bar so the × button disappears
    const bar = btn.closest('.edit-annotator-bar');
    if (bar) {
      // Remove the clear button (field stays visible, just empty)
      btn.remove();
    }
  });

  /* ── Participant views, sort and edit (delegated on #content) ──────────── */
  contentEl.addEventListener('click', e => {
    /* B-115: one attribute for both tables. The view says which state to
       toggle, so a third participant table would be a line here rather than a
       second handler — which is how the sources table came to have none. */
    const th = e.target.closest('[data-psort]');
    if (th) {
      participantSortClick(S.view === 'sources' ? _srcViewSort : _annViewSort,
                           th.dataset.psort);
      _renderCacheKey = null;   // force re-render
      render();
      return;
    }
    // Edit button in annotators view
    const editBtn = e.target.closest('[data-action="ann-edit"]');
    if (editBtn) { showAnnModal(editBtn.dataset.annId, null); return; }
    // Add new annotator from annotators view
    const addBtn = e.target.closest('[data-action="ann-add-new"]');
    if (addBtn) { showAnnModal(null, null); return; }
    // Edit button in sources view
    const srcEditBtn = e.target.closest('[data-action="src-edit"]');
    if (srcEditBtn) { showSrcModal(srcEditBtn.dataset.srcId); return; }
    // Add new source from sources view (no picker context)
    const srcAddBtn = e.target.closest('[data-action="src-add-new"]');
    if (srcAddBtn) { showSrcModal(null); return; }
    // Source picker, open floating panel
    const srcPickBtn = e.target.closest('[data-action="open-src-pick"]');
    if (srcPickBtn) { openSrcPickPanel(srcPickBtn.dataset.container, srcPickBtn); return; }
    // Source picker, remove a selected chip
    const srcRemoveBtn = e.target.closest('[data-action="src-pick-remove"]');
    if (srcRemoveBtn) {
      const chip = srcRemoveBtn.closest('.src-sel-chip');
      if (chip) chip.remove();
      // Refresh picker panel chip states if open for same container
      if (_srcPickTarget === srcRemoveBtn.dataset.container) {
        const filterEl = document.getElementById('src-pick-filter');
        _renderSrcPickChips(filterEl?.value || '');
      }
      return;
    }
    /* ── I2, v3.14.404: ONE add and ONE remove for every row collection ────
       Was ten blocks — five add, five remove — differing in the builder called,
       the class removed and the child focused. `ROW_EDITORS` in participants.js
       holds those three, plus the two things `sel` alone needs: rows found
       through the enclosing frame, and never being left empty.

       The `data-action` names are UNCHANGED on purpose. They are what
       `gui_crud_test.js` and `word_edit_pos_test.js` click and what the
       stylesheet hangs on, so renaming them would have made a consolidation into
       a migration. The kind is read off the action instead. */
    // D40 stage B: another translation from a sentence with the same text
    const copyAlt = e.target.closest('[data-action="copy-alt"]');
    if (copyAlt) { takeCopyAlt(copyAlt); return; }

    const rowBtn = e.target.closest('[data-action$="-add"], [data-action$="-remove"]');
    if (rowBtn) {
      const m = /^([a-z-]+)-(add|remove)$/.exec(rowBtn.dataset.action || '');
      if (m && typeof ROW_EDITORS === 'object' && ROW_EDITORS[m[1]]) {
        if (m[2] === 'add') addRowTo(m[1], rowBtn);
        else                removeRowFrom(m[1], rowBtn);
        return;
      }
      /* Not a row collection — `save-section-add`, `src-pick-add`, `tag-add`
         and the rest fall through to their own handlers below. */
    }
    /* ── Selection editor (D27 P1) ─────────────────────────────────────────
       All of these mutate the DOM in place rather than re-rendering the view,
       matching the allomorph/translit editors, a full render would discard any
       in-progress typing elsewhere on this long form. */

    // Apply a template: append a pre-filled frame, expanded and ready to edit.
    const selTplBtn = e.target.closest('[data-action="sel-template"]');
    if (selTplBtn) {
      const tpl = SELECTION_TEMPLATES[+selTplBtn.dataset.tplIdx];
      const framesEl = document.getElementById('ed-selection-frames');
      if (tpl && framesEl) {
        framesEl.insertAdjacentHTML('beforeend',
          _selFrameHtml({ label: tpl.label, selects: tpl.selects }, false));
        _selRefreshCount();
        framesEl.lastElementChild?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    // Reveal templates for other parts of speech, trends are surfaced by
    // filtering, never by removing options.
    const selTplAllBtn = e.target.closest('[data-action="sel-tpl-all"]');
    if (selTplAllBtn) {
      selTplAllBtn.closest('.sel-templates')?.classList.toggle('sel-show-all');
      return;
    }
    // Add a blank frame, expanded.
    const selFrameAddBtn = e.target.closest('[data-action="sel-frame-add"]');
    if (selFrameAddBtn) {
      const framesEl = document.getElementById('ed-selection-frames');
      if (framesEl) {
        framesEl.insertAdjacentHTML('beforeend', _selFrameHtml(null, false));
        _selRefreshCount();
        framesEl.lastElementChild?.querySelector('.sel-cat')?.focus();
      }
      return;
    }
    const selFrameRemoveBtn = e.target.closest('[data-action="sel-frame-remove"]');
    if (selFrameRemoveBtn) {
      selFrameRemoveBtn.closest('.sel-frame')?.remove();
      _selRefreshCount();
      return;
    }
    // Collapse / expand.  The collapsed summary is recomputed here rather than
    // kept live: it is only visible while collapsed, and the rows can only
    // change while expanded.
    const selFoldBtn = e.target.closest('[data-action="sel-frame-toggle"]');
    if (selFoldBtn) {
      const frame = selFoldBtn.closest('.sel-frame');
      if (frame) {
        frame.classList.toggle('collapsed');
        if (frame.classList.contains('collapsed')) _selRefreshSummary(frame);
      }
      return;
    }
  });

  /* ── S4: sentence-view secondary section expand/collapse (delegated) ─── */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="expand-section"]');
    if (!btn) return;
    const key = btn.dataset.sec;
    if (_sentExpanded.has(key)) _sentExpanded.delete(key);
    else _sentExpanded.add(key);
    // B-011: _sentExpanded is view-only state and is NOT part of render()'s cache
    // key, so nothing else about the navigation state has changed here, a bare
    // render() hits the `cacheKey === _renderCacheKey` early return and does
    // nothing at all. Every fold in the sentence view (Dependency Parse, its arc
    // diagram, Annotators, Transliterations, Comments) was inert because of it.
    // Same idiom as the annotators-view sort handler above.
    _renderCacheKey = null;   // force re-render
    render();
  });

  /* ── Prov history, annotator name link → Annotators view (delegated) ─── */
  contentEl.addEventListener('click', e => {
    const link = e.target.closest('[data-action="go-annotator"]');
    if (!link) return;
    e.stopPropagation();
    _annFocusId = link.dataset.annId || null;  // highlight target row
    go('annotators');
  });

  /* ── Source chip link → Sources view (delegated) ─────────────────────── */
  contentEl.addEventListener('click', e => {
    const link = e.target.closest('[data-action="go-source"]');
    if (!link) return;
    e.stopPropagation();
    _srcFocusId = link.dataset.srcId || null;  // highlight target row
    go('sources');
  });

  /* ── Leipzig panel, open button (delegated on #content) ──────────────── */
  /* Handles both the "Leipzig" button on word gloss and the "L" buttons on
     morpheme gloss rows.  data-lp-target holds the ID of the gloss <input ${LING_ATTRS}>. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="open-lp"]');
    if (!btn) return;
    e.stopPropagation();
    const inputEl = document.getElementById(btn.dataset.lpTarget);
    if (!inputEl) return;
    openLeipzigPanel(inputEl, btn);
  });

  /* ── Autocomplete triggers (delegated on #content) ───────────────────── */
  /* D27 P1: AC_SELECTOR covers gloss fields (Leipzig mode) and selection
     category/relation fields (term mode).  showGlossAC dispatches by mode. */
  /* B-082: `isTrusted` separates a person typing from the app writing. takeOffer
     and _fillMorphRows dispatch a synthetic `input` after filling a field, and
     without this gate the app writing a value looked exactly like a keystroke,
     so taking one chip opened the dropdown over every row it filled. The
     offerSrc-clearing listener below has gated on this since D42 for the same
     reason; these triggers were simply never given it. */
  contentEl.addEventListener('input', e => {
    if (!e.isTrusted) return;
    const inp = e.target;
    if (!inp.matches(AC_SELECTOR)) return;
    showGlossAC(inp);
  });

  /* Term-mode fields open their full list on focus even when empty, the
     behaviour <datalist> can't be relied on for in WebKit.  Gloss fields are
     excluded: focusing one shouldn't dump the whole Leipzig list over the form. */
  /* B-082 note: this one is deliberately NOT gated on `isTrusted`. A focusin the
     UA fires in response to element.focus() is still a UA event and reports
     isTrusted true, so the gate would read as protection and provide none. The
     way not to reopen the list on a fill is not to focus a field: see
     focusOfferChip, which puts the caret back on the chip strip. */
  contentEl.addEventListener('focusin', e => {
    const inp = e.target;
    if (!inp.matches || !inp.matches('.ac-input')) return;
    showGlossAC(inp);
  });

  /* Keyboard navigation for autocomplete dropdown. */
  contentEl.addEventListener('keydown', e => {
    const inp = e.target;
    if (!inp.matches(AC_SELECTOR)) return;
    const drop = document.getElementById('gloss-ac-drop');
    if (!drop?.classList.contains('ac-visible')) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); _acMoveFocus(+1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); _acMoveFocus(-1); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (_acFocusIdx >= 0) { e.preventDefault(); _acSelectFocused(); }
      else hideGlossAC();
    }
    else if (e.key === 'Escape') { e.preventDefault(); hideGlossAC(); }
  });

  /* Hide autocomplete when an autocompleting input loses focus (allow click on
     item first). */
  contentEl.addEventListener('focusout', e => {
    if (!e.target.matches(AC_SELECTOR)) return;
    // Small delay so click on dropdown item fires before we remove it
    setTimeout(() => {
      const drop = document.getElementById('gloss-ac-drop');
      if (!drop?.classList.contains('ac-visible')) return;
      // If focus moved to the dropdown itself, leave it open
      const active = document.activeElement;
      if (active && drop.contains(active)) return;
      hideGlossAC();
    }, 120);
  });

  /* ════════════════════════════════════════════════════════════════════════
     C14 migration (v3.14.14): form / toolbar / search action buttons.
     One delegated click listener on #content replaces ~20 per-render
     getElementById(..).addEventListener attaches that used to live in
     bindEvents().  Every migrated button carries data-action; its data-*
     payload is read here exactly as the old direct handlers read it from
     currentTarget.  Actions handled by the other delegated blocks above
     (dict-delete, ql-*, open-ann, etc.) simply fall through the switch.
     ════════════════════════════════════════════════════════════════════════ */
  contentEl.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const ds = el.dataset;
    switch (ds.action) {
      /* ── Empty-state: open a corpus ── */
      case 'open-corpus':        openCorpusDialog(); break;

      /* ── Save buttons (level editors / add forms / dictionary) ── */
      case 'save-paragraph':     saveParagraph(parseInt(ds.si), parseInt(ds.pi)); break;
      case 'save-sentence':      saveSentence(ds.sid); break;
      case 'save-word':          saveWord(ds.wid, ds.sid); break;
      case 'save-dict':          saveDictEntry(ds.entryId, ds.dform, ds.wid, ds.sid, ds.dictBack || null); break;
      /* D51 stage 5: one panel, three ways in. `save-dict-new` went with
         `renderDictAdd`; there is no create VIEW to save from any more. */
      case 'dict-add-morph':     addDictForMorpheme(ds.wid, ds.sid, Number(ds.mi)); break;
      case 'dict-new':           addDictBlank(); break;

      /* ── D35 stage B (v3.14.277): the homograph chooser ──────────────────
         Three actions on one surface, and all three are decisions about a LINK
         rather than values going into a field, which is why they are here and
         not in `takeOffer`. */
      case 'dict-choose':        chooseDictEntry(ds.wid, ds.sid, ds.entryId); break;
      case 'dict-reject':        rejectDictMatch(ds.wid, ds.sid); break;
      case 'dict-new-same-form': addDictSameForm(ds.wid, ds.sid); break;
      /* D35 B6: one record, asked for. Nothing sweeps orphans on its own. */
      case 'lemma-delete':       deleteLemmaRecord(ds.lemmaId); break;
      /* D53 stage E (F5): every unambiguous segment at once. The ambiguous ones
         keep their chips — a bulk fill is exactly where taking `cands[0]`
         silently would cost most (B-122). */
      case 'parse-fill-all': {
        const el = document.getElementById('ew-parse');
        if (!el) break;
        const r = fillParseFromLexicon(el.value);
        refreshMorphSuggest();
        flashSaveStatus(`${icon('check-circle')} ${t('status.pg.filled',
          { n: r.filled, ambiguous: r.ambiguous, none: r.none })}`);
        break;
      }
      /* B-123. The only bulk write in the app, so it is counted first and the
         annotator agrees to a number. The ambiguous forms are NAMED rather than
         totalled: those are the ones that need a person, and a count of them is
         a fact nobody can act on. */
      case 'dict-backfill': {
        const pre = backfillLinks({ dryRun: true });
        if (!pre.linked) {
          alert(t('alert.dict.backfill_none', { ambiguous: pre.ambiguous, none: pre.none }));
          break;
        }
        const forms = [...pre.ambiguousForms].slice(0, 8).join(', ');
        if (!confirm(t('confirm.dict.backfill', {
              n: pre.linked, ambiguous: pre.ambiguous, none: pre.none,
              forms: forms + (pre.ambiguousForms.size > 8 ? ' …' : '') })))
          break;
        drainLinkNotes();                    // S3: the notes below are this run's
        const r = backfillLinks();
        logEvent('info', 'link backfill',
                 `${r.linked} linked, ${r.ambiguous} ambiguous, ${r.none} with no candidate`);
        /* Every linked token was REWRITTEN, so the corpus is what changed and
           the words are what to journal — D50's rule for a write with a blast
           radius, the same shape deleteDictEntry uses. */
        if (r.linked) mutate(['corpus'], { corpus: [...r.words] });
        reportLinkNotes();
        flashSaveStatus(`${icon('check-circle')} ${t('status.dict.backfilled', { n: r.linked })}`);
        break;
      }
      /* D52 stage D. The confirm names the citation form the app GUESSED and
         where it got it, because a record made from evidence is not the same
         thing as one somebody typed, and the annotator is the one who can tell. */
      case 'lemma-repair': {
        const d = danglingLemmas().find(x => x.id === ds.lemmaId);
        if (!d) break;
        if (!confirm(t('confirm.lemma.repair',
              { form: d.form, entries: d.entries, tokens: d.tokens }))) break;
        const rec = repairDanglingLemma(ds.lemmaId);
        if (rec) go('lemma', { lemmaId: rec.id });
        break;
      }

      /* ── D23 P3: pinned examples ── */
      case 'dict-pin-example':           pinDictExample(ds.entryId, ds.sentId, ds.tokenId); break;
      case 'dict-unpin-example':         unpinDictExample(ds.entryId, ds.pinIdx); break;
      case 'dict-save-manual-example':   saveManualDictExample(ds.entryId); break;
      case 'dict-add-manual-example':    _openManualExampleForm(ds.entryId); break;
      case 'dict-cancel-manual-example': _closeManualExampleForm(ds.entryId); break;
      case 'save-document':      saveDocument(); break;
      case 'save-section':       saveSection(parseInt(ds.si)); break;
      case 'save-corpus-new':    saveNewCorpus(); break;
      case 'save-section-add':   saveSectionAdd(); break;
      case 'save-paragraph-add': saveParagraphAdd(parseInt(ds.si)); break;
      case 'save-sentence-add':  saveSentenceAdd(parseInt(ds.si), parseInt(ds.pi)); break;

      /* ── Translation toolbar (settings modal + the two translate buttons) ── */
      case 'xlate-settings':     showXlateSettingsModal(); break;
      case 'translate-sentence': translateSentence(); break;       // async helper
      case 'translate-para':     translateParagraphAll(); break;   // async helper

      /* ── LaTeX export panel ── */
      case 'latex-toggle':       toggleLatexPanel(); break;
      case 'latex-copy':         copyLatexPre(ds.latexPre); break;
    }
  });

  /* ── search: every srch-* action delegates to searchOnAction in search.js ── */
  contentEl.addEventListener('click', e => {
    const el = e.target.closest('[data-action^="srch-"]');
    if (!el || typeof searchOnAction !== 'function') return;
    searchOnAction(el);
  });

  /* ── Dict browse, sort column headers + type filter chips (delegated) ──────
     Partial DOM updates via rerenderDictTable(); no full re-render. */
  contentEl.addEventListener('click', e => {
    // Sort column headers, invalidate the sort cache before re-rendering.
    const th = e.target.closest('th[data-sort-col]');
    if (th) {
      const key = th.dataset.sortCol;
      if (_dictSort === key) _dictSortDir = _dictSortDir === 'asc' ? 'desc' : 'asc';
      else { _dictSort = key; _dictSortDir = 'asc'; }
      _dictSorted = null;           // sort params changed, rebuild cache
      rerenderDictTable(true);      // true = sort changed, rebuild thead too
      return;
    }
    /* B-109: the type filter is a chip row over the whole vocabulary now, and
       its clicks are handled by `handleChipClick` with every other chip in the
       app — one drawer, one accept path. The half-copy that lived here knew
       about three hard-coded values and nothing else. */
    // Domain column toggle, flip state, update button active class, rebuild table
    // with sortChanged=true so the thead (column count) is also repainted.
    if (e.target.closest('[data-action="dict-toggle-domain"]')) {
      _dictShowDomain = !_dictShowDomain;
      e.target.closest('[data-action="dict-toggle-domain"]')
              .classList.toggle('active', _dictShowDomain);
      rerenderDictTable(true);
      return;
    }
    /* B-042: show/hide transliterations beyond the first two. Repaints directly
       and nulls the render cache first, the flag is view state the cache key
       does not know about, which is exactly the shape of B-011 and B-019. */
    if (e.target.closest('[data-action="translit-toggle"]')) {
      _sentTranslitOpen = !_sentTranslitOpen;
      _renderCacheKey = null;
      render();
      return;
    }

    /* PDF export, only the OPEN button lives inside #content. The modal itself
       is appended to document.body, so clicks inside it never reach this
       listener; `dict-close-export` and `dict-run-export` were handled here and
       never fired once (B-026). They are bound on the modal element in
       openDictExportModal(). Do not re-add them here. */
    if (e.target.closest('[data-action="dict-open-export"]')) {
      openDictExportModal();
      return;
    }
  });

  /* ── Morpheme edit, "From parse" fill chips + suggestion chips (delegated) ─
     Both chip groups live inside the word-edit view, rebuilt on every render. */
  /* S1 · keep the lemma strip current as the annotator types, and let a
     candidate chip fill the field. Repaints ONE element rather than calling
     render(): a full re-render per keystroke would fight the caret, and the
     strip is view state the render cache key does not know about (B-011). */
  contentEl.addEventListener('input', e => {
    const el = e.target;
    /* D53 stage C: the three derived fields, and the morpheme rows they derive
       FROM, all change what the save will write. Repainting on any of them is
       what makes the strip a live promise rather than a snapshot of the state
       the view was rendered in. */
    if (el && (/^ew-(translit|gloss|parse)$/.test(el.id || '')
               || el.classList?.contains('morph-gloss-input')))
      refreshDerivePreviews();
    if (el && /^(ew|ed|da)-lemma$/.test(el.id || '')) {
      /* B-114: a typed character retracts the answer. The choice was about the
         form that was on screen when it was made; carrying it past an edit is
         how a stale pick would link a token to a lemma nobody chose for it.
         `takeOffer` re-dispatches `input` AFTER setting these, so its own write
         survives — the guard is `isTrusted`, which only a real keystroke has. */
      if (e.isTrusted) { el.dataset.lemmaId = ''; el.dataset.lemmaNew = ''; }
      refreshLemmaStrip(el.id);
    }
    /* B-166: the offer retracts what it has already said. Typing the tag the
       lexicon was offering leaves a chip advertising a value the field now
       holds, which is B-108's complaint in a second place. */
    if (el && el.id === 'ew-pos') refreshWordPosStrip();

    /* B-193, v3.14.367. And the THIRD place, which is the one B-166's comment
       was describing without reaching.

       The morpheme offer strip is drawn from `offerFillsNothing`, which reads
       the ROWS through `_morphRowsNow()` — their gloss, part of speech, type and
       link. It was repainted from two places: `#ew-parse`'s own listener, and
       `takeOffer` after a chip is taken. Typing into a row repainted the derive
       previews above and left the strip alone.

       So a chip computed while the rows were empty — correctly live then, it had
       three fields to write — was still live once the annotator had filled those
       fields by hand, and clicking it wrote nothing. Logged from real use as
       `offer filled nothing tilki · 2 row(s)` at 20:07:31, twenty-five seconds
       after the editor opened: the gap is the typing.

       THE SELECTORS ARE THE ONES `_morphRowsNow` READS, and that is the whole
       rule — a strip is a live promise about a state, so every input that state
       is built from has to repaint it. `offer_strip_live_test` derives this list
       from `_morphRowsNow` rather than trusting this line, because a fourth row
       field added there would otherwise reintroduce exactly this. */
    if (el && (el.classList?.contains('morph-gloss-input')
               || el.classList?.contains('morph-pos-input')
               || el.classList?.contains('morph-type-input'))) {
      refreshMorphSuggest();
      /* B-197, v3.14.375. The FOURTH thing computed from these same three
         fields, and the one that is a claim rather than an offer: whether the
         row still agrees with the dictionary entry it is linked to. Same
         inputs, same repaint, for the same reason — a warning computed when the
         view was rendered is a snapshot, and B-193 is what a stale one does. */
      refreshLinkClash();
    }
  });

  /* B-197: release a link the row no longer supports. The row keeps its typed
     values — the annotator is saying "not that lexeme", not "undo my work" —
     and the warning repaints itself away because the link is what it read. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="morph-unlink"]');
    if (!btn) return;
    const row = btn.closest('.morph-edit-row');
    if (!row) return;
    row.dataset.dictId = '';
    const badge = row.querySelector('.morph-link-badge');
    if (badge) badge.hidden = true;
    refreshLinkClash();
    refreshMorphSuggest();      // the offer changes with the link
  });

  /* I1 · D48 stage C: the identity rule, live. An identity field grows its
     verdict the moment the annotator empties it and loses it the moment they
     type, so the refusal is visible before the save button is reached rather
     than in a dialog after it. Untouched fields on a fresh create form stay
     quiet, because nothing has fired yet — no touched-state bookkeeping needed.
     Gated on isTrusted for the same reason the autocomplete triggers are: an
     app-written value is not the annotator emptying a box. */
  contentEl.addEventListener('input', e => {
    if (!e.isTrusted) return;
    const el = e.target;
    if (!el || !el.id || !document.getElementById(el.id + '-req')) return;
    identityStop(el.id, (el.value || '').trim() === '');
  });

  /* D42: a value stops being "taken from the lexicon" the moment the annotator
     types over it, or the next save would stamp their edit as derived.
     `isTrusted` is what separates a real keystroke from the input event
     takeOffer dispatches to refresh the strip — without it, the mark would be
     cleared by the act of setting it. */
  contentEl.addEventListener('input', e => {
    if (!e.isTrusted) return;
    if (e.target && e.target.dataset && e.target.dataset.offerSrc)
      delete e.target.dataset.offerSrc;
  });

  /* D42: one accept path. There were three — lemma-pick, parse-fill and
     morph-suggest — each writing a value into a field and none of them
     recording that the value came from the lexicon rather than from the person.
     takeOffer() does both, in LingCoT.html, so a new offer provider cannot
     forget the second half. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="offer-take"]');
    if (!btn || btn.classList.contains('offer-taken')) return;
    e.stopPropagation();
    takeOffer(btn);
  });

  /* ── Document-edit, section-row reorder / merge / delete (delegated) ───────
     ▲▼ reorder · ⤵ merge · ✕ delete.  Buttons live inside #sec-edit-list.

     B-175, v3.14.343. This delegated on three STYLE classes
     (`.sec-arr-btn, .sec-merge-btn, .sec-del-btn`) while reading `dataset.arr`
     for the action. A restyle gave the delete button the shared
     `btn btn-danger btn-sm` classes, and `sec-del-btn` then existed nowhere in
     `source/` except inside this selector — so section delete, the only
     entity-level delete the GUI offers, did nothing at all: no confirm, no row
     removed, no log line. Both halves were individually correct and only a real
     delegated click could prove they never met.

     Bind on the attribute the handler actually reads. One contract, and a
     restyle cannot silently unbind a control again.

     D59/B-178: every branch edits the BUFFER and redraws. Nothing here touches
     `d.sections`; `saveDocument` is the only writer. */
  contentEl.addEventListener('click', e => {
    const btn = e.target.closest('.sec-edit-row [data-arr]');
    if (!btn) return;
    const row = btn.closest('.sec-edit-row');
    if (!row) return;
    const list = document.getElementById('sec-edit-list');
    if (!list) return;
    const buf = secEditBuffer();
    const i   = Array.from(list.querySelectorAll('.sec-edit-row')).indexOf(row);
    if (i === -1 || !buf[i]) return;
    const arr = btn.dataset.arr;

    /* Before anything moves: the redraw rebuilds the inputs from the buffer, so
       a title typed and not yet saved lives only in the DOM until this runs. */
    secEditReadTitles();

    if (arr === 'up') {
      if (i === 0) return;
      buf.splice(i - 1, 0, buf.splice(i, 1)[0]);

    } else if (arr === 'down') {
      if (i >= buf.length - 1) return;
      buf.splice(i + 1, 0, buf.splice(i, 1)[0]);

    } else if (arr === 'merge') {
      if (i >= buf.length - 1) return;   // already the last section
      const next = buf.splice(i + 1, 1)[0];
      /* The absorbed row's OWN absorptions come across too, or a chain of merges
         drops every section but the last one taken. */
      buf[i].absorbed.push(next.si, ...next.absorbed);

    } else if (arr === 'del') {
      const { np, ns } = secEditCounts(buf[i]);
      const label = (buf[i].title || '').trim() || `Section ${i + 1}`;
      const msg   = np > 0
        ? t('confirm.section.delete_nonempty', { label, np, ns })
        : t('confirm.section.delete_empty', { label });
      if (!confirm(msg)) return;
      /* Takes its absorbed sections with it: the entry IS the row, and the row is
         what the annotator was shown the counts for. */
      buf.splice(i, 1);

    } else return;

    secEditRedraw();
  });
}

