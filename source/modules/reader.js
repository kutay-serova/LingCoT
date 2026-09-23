/* =============================================================================
   reader.js, D41 Reader Mode
   Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
   =============================================================================
   The document read continuously, without editors. Read-only by design: the
   sentence popup shows fields and links to the annotation view, and writes
   nothing (dev/design/D41_reader_mode.md).

   Modes: 'cols' (B, text against translation, tb-reader-cols) and 'igt'
   (A, interlinear, tb-reader-igt). _readerMode, _readerTiers and _readerHl are
   in render()'s cache key (readerCacheKey).

   Word highlight in A (decided at tb-reader-igt): by default the words with the
   same spelling (normForm); if the hovered word has a dict_id, only the words
   with that dict_id. The toolbar switch "lemma" uses lemma_id instead, falling
   back to the default for a word without one. The word popup names the rule.

   Scope is the open document. Paragraphs render in batches of
   READER_PARA_BATCH; the rest load as the sentinel scrolls into view, like the
   section view.
   ============================================================================= */

let _readerMode = 'cols';
const READER_PARA_BATCH = 30;
// Section to scroll to after the next render (set by the section view's Read button).
let _readerScrollSi = null;
// Mode A: which tiers are drawn, and what a word highlight matches.
let _readerTiers = { translit: true, parse: true, gloss: true, translation: true };
let _readerHl = 'word';   // 'word' | 'lemma'

/* @fn readerCacheKey, the reader's view state, for render()'s cache key. */
function readerCacheKey() {
  return `|${_readerMode}|${_readerHl}|${Object.keys(_readerTiers).filter(k => _readerTiers[k]).join(',')}`;
}

/* @fn readerParas, every paragraph of the open document in reading order. */
function readerParas() {
  const out = [];
  sections().forEach((sec, si) =>
    (sec.paragraphs || []).forEach((p, pi) => out.push({ si, pi, p })));
  return out;
}

/* @fn readerSectionTitle */
function readerSectionTitle(si) {
  const sec = sections()[si];
  return (sec && sec.title) || t('label.view.section_n', { n: si + 1 });
}

/* @fn renderReaderColsBatch, one row per paragraph: text | translation.
   Sentences are .s-span with data-sid, so the existing pair-highlight on hover
   works unchanged; a click opens the popup instead of navigating (events.js). */
function renderReaderColsBatch(items) {
  return items.map(({ si, pi, p }) => {
    const head = pi === 0
      ? `<h2 class="reader-sec" id="reader-sec-${si}">${esc(readerSectionTitle(si))}</h2>` : '';
    const sents = p.sentences || [];
    const src = sents.map(s =>
      `<span class="s-span" data-sid="${escAttr(s.id)}" tabindex="0">${esc(s.text || '')}</span>`).join(' ');
    const trl = sents.map(s => {
      const tr = sentTrans(s);
      return tr
        ? `<span class="s-span" data-sid="${escAttr(s.id)}">${esc(tr)}</span>`
        : `<span class="s-span no-data" data-sid="${escAttr(s.id)}">${t('status.no_translation')}</span>`;
    }).join(' ');
    return `${head}<div class="reader-row" data-si="${si}" data-pi="${pi}">
      <div class="reader-src">${src}</div>
      <div class="reader-trl">${trl}</div>
    </div>`;
  }).join('');
}

/* @fn readerWordHtml, one interlinear column. data-nf / data-did / data-lid
   carry what the highlight compares. */
function readerWordHtml(w, sid) {
  const punct = !_navIsToken(w);
  const gloss = wordGloss(w);
  const tl = wordTranslit(w);
  let h = `<span class="rd-w${punct ? ' punct' : ''}" data-wid="${escAttr(w.id)}" data-sid="${escAttr(sid)}"`
        + ` data-nf="${escAttr(normForm(w.form || ''))}"`
        + (w.dict_id ? ` data-did="${escAttr(w.dict_id)}"` : '')
        + (w.lemma_id ? ` data-lid="${escAttr(w.lemma_id)}"` : '') + '>'
        + `<span class="rd-f">${esc(w.form || '')}</span>`;
  if (_readerTiers.translit) h += `<span class="rd-tl">${tl ? esc(tl) : '&nbsp;'}</span>`;
  if (_readerTiers.parse)    h += `<span class="rd-p">${w.morphological_parse ? esc(w.morphological_parse) : '&nbsp;'}</span>`;
  if (_readerTiers.gloss)    h += `<span class="rd-g">${gloss && !punct ? esc(gloss) : '&nbsp;'}</span>`;
  return h + '</span>';
}

/* @fn renderReaderIgtBatch, each sentence as wrapping interlinear columns,
   its first translation below. */
function renderReaderIgtBatch(items) {
  return items.map(({ si, pi, p }) => {
    const head = pi === 0
      ? `<h2 class="reader-sec" id="reader-sec-${si}">${esc(readerSectionTitle(si))}</h2>` : '';
    const sents = (p.sentences || []).map(s => {
      const tr = _readerTiers.translation ? sentTrans(s) : null;
      return `<div class="rd-sent" data-sid="${escAttr(s.id)}">
        <div class="rd-words">${(s.words || []).map(w => readerWordHtml(w, s.id)).join('')}</div>
        ${_readerTiers.translation
          ? `<div class="rd-tr${tr ? '' : ' no-data'}">${tr ? `‘${esc(tr)}’` : t('status.no_translation')}</div>` : ''}
      </div>`;
    }).join('');
    return `${head}<div class="rd-para" data-si="${si}" data-pi="${pi}">${sents}</div>`;
  }).join('');
}

/* @fn renderReaderBatch, the batch renderer for the active mode. */
function renderReaderBatch(items) {
  return _readerMode === 'igt' ? renderReaderIgtBatch(items) : renderReaderColsBatch(items);
}

/* @fn readerToolbarHtml, mode switch; in mode A also tiers and the highlight rule. */
function readerToolbarHtml() {
  const seg = (action, cur, opts) => `<span class="seg" role="group">${opts.map(([v, label]) =>
    `<button class="seg-btn${cur === v ? ' active' : ''}" data-action="${action}" data-v="${v}" aria-pressed="${cur === v}">${label}</button>`).join('')}</span>`;
  let h = seg('reader-mode', _readerMode, [['cols', t('btn.reader.mode_cols')], ['igt', t('btn.reader.mode_igt')]]);
  if (_readerMode === 'igt') {
    h += `<span class="reader-tools-lbl">${t('label.reader.tiers')}</span>`
      + ['translit', 'parse', 'gloss', 'translation'].map(k =>
          `<button class="chip chip-choice${_readerTiers[k] ? ' active' : ''}" data-action="reader-tier" data-v="${k}" aria-pressed="${!!_readerTiers[k]}">${t('btn.reader.tier_' + k)}</button>`).join('')
      + `<span class="reader-tools-lbl">${t('label.reader.highlight')}</span>`
      + seg('reader-hl', _readerHl, [['word', t('btn.reader.hl_word')], ['lemma', t('btn.reader.hl_lemma')]]);
  }
  return `<div class="reader-tools">${h}</div>`;
}

/* @fn renderReader, the 'reader' view. */
function renderReader() {
  if (!doc()) return deadEndHtml('status.error.no_document');
  const items = readerParas();
  const first = renderReaderBatch(items.slice(0, READER_PARA_BATCH));
  const title = doc().metadata?.title || doc().id || '';
  return `
    ${viewHeader('data-go="document"', esc(title))}
    <div class="reader-bar">
      <span class="reader-bar-title">${icon('book-open')} ${t('label.reader.title')}</span>
      <span class="text-sm text-muted">${t(_readerMode === 'igt' ? 'hint.reader.read_only_igt' : 'hint.reader.read_only')}</span>
    </div>
    ${readerToolbarHtml()}
    <div class="reader ${_readerMode === 'igt' ? 'reader-igt' : 'reader-cols'}">
      ${_readerMode === 'cols' ? `<div class="reader-colhead" aria-hidden="true">
        <span>${t('label.reader.text')}</span><span>${t('label.editor.translation')}</span>
      </div>` : ''}
      ${first || `<p class="text-muted text-italic">${t('status.empty.paragraphs')}</p>`}
      ${items.length > READER_PARA_BATCH
        ? `<div id="reader-sentinel" data-next="${READER_PARA_BATCH}"></div>` : ''}
    </div>`;
}

/* @fn observeReaderSentinel, append the next batch when the sentinel is near. */
function observeReaderSentinel(sentinel) {
  const items = readerParas();
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    const next = parseInt(sentinel.dataset.next, 10);
    const temp = document.createElement('div');
    temp.innerHTML = renderReaderBatch(items.slice(next, next + READER_PARA_BATCH));
    while (temp.firstChild) sentinel.parentNode.insertBefore(temp.firstChild, sentinel);
    _sSpanCache.clear();   // new spans for the hover pairing
    if (next + READER_PARA_BATCH < items.length) {
      sentinel.dataset.next = next + READER_PARA_BATCH;
      observeReaderSentinel(sentinel);
    } else sentinel.remove();
  }, { rootMargin: '300px' });
  observer.observe(sentinel);
}

/* @fn readerAfterRender, called by bindEvents after each render of 'reader'.
   Loads batches up to a requested section, then scrolls to it. */
function readerAfterRender() {
  const sentinel = document.getElementById('reader-sentinel');
  if (_readerScrollSi != null) {
    const si = _readerScrollSi;
    _readerScrollSi = null;
    const items = readerParas();
    const upto = items.findIndex(x => x.si === si);
    if (sentinel && upto >= READER_PARA_BATCH) {
      // Render straight through to the target so the anchor exists.
      const next = parseInt(sentinel.dataset.next, 10);
      const end = Math.ceil((upto + 1) / READER_PARA_BATCH) * READER_PARA_BATCH;
      const temp = document.createElement('div');
      temp.innerHTML = renderReaderBatch(items.slice(next, end));
      while (temp.firstChild) sentinel.parentNode.insertBefore(temp.firstChild, sentinel);
      if (end < items.length) sentinel.dataset.next = end; else sentinel.remove();
    }
    // An empty section has no heading; the next one that has is where it would be.
    const target = [...document.querySelectorAll('.reader-sec')]
      .find(h => parseInt(h.id.slice('reader-sec-'.length), 10) >= si);
    // After go()'s smooth scroll to the top has started; an instant scroll cancels it.
    setTimeout(() => target?.scrollIntoView({ block: 'start', behavior: 'instant' }), 0);
  }
  if (sentinel && sentinel.isConnected) observeReaderSentinel(sentinel);
}

/* @fn openReader, enter Reader Mode, optionally at a section. */
function openReader(si) {
  _readerScrollSi = (si === undefined || si === null) ? null : si;
  go('reader');
}

/* ── popup ─────────────────────────────────────────────────────────────────── */

/* @fn readerPopHtml, a sentence's fields, read-only. */
function readerPopHtml(sid) {
  const e = S.sentById.get(sid);
  if (!e) return '';
  const s = e.sent;
  const row = (label, html) => html ? `<div class="rp-row"><div class="rp-lbl">${label}</div><div class="rp-val">${html}</div></div>` : '';
  const list = (arr, fmt) => (Array.isArray(arr) ? arr : []).map(fmt).filter(Boolean).join('');
  const translits = list(s.transliterations, x => x && x.text
    ? `<div>${x.label ? `<span class="rp-tag">${esc(x.label)}</span> ` : ''}${esc(x.text)}</div>` : '');
  const trans = list(s.translations, x => x && x.text ? `<div>${esc(x.text)}</div>` : '');
  const comments = list(s.comments, x => {
    const text = typeof x === 'string' ? x : x && x.text;
    return text ? `<div>${esc(text)}</div>` : '';
  });
  const nWords = (s.words || []).length;
  return `
    <div class="rp-head">
      <span class="rp-loc">${esc(sentPosLabel(sid))}</span>
      <button class="rp-close" data-action="reader-pop-close" aria-label="${escAttr(t('aria.btn.close'))}">${icon('x')}</button>
    </div>
    <div class="rp-body">
      <div class="rp-text">${esc(s.text || '')}</div>
      ${row(t('label.editor.transliterations'), translits)}
      ${row(t('label.editor.translations'), trans || `<span class="text-muted">${t('status.no_translation')}</span>`)}
      ${row(t('label.editor.comments'), comments)}
      ${row(t('label.reader.words'), String(nWords))}
    </div>
    <div class="rp-foot">
      <button class="btn btn-sm btn-ghost" data-go="sentence" data-sid="${escAttr(sid)}">${t('btn.reader.open_sentence')}</button>
    </div>`;
}

/* @fn openReaderPop, show the popup for a sentence, anchored to its span. */
function openReaderPop(span) {
  const pop = document.getElementById('reader-pop');
  if (!pop || !span) return;
  pop.innerHTML = readerPopHtml(span.dataset.sid);
  placeReaderPop(pop, span);
}

/* @fn placeReaderPop, show the popup below its anchor, or above if no room. */
function placeReaderPop(pop, span) {
  pop.classList.add('rp-visible');
  const r = span.getBoundingClientRect();
  const h = pop.offsetHeight || 200, w = pop.offsetWidth || 320;
  const top = (window.innerHeight - r.bottom - 8 >= h) ? r.bottom + 6 : r.top - h - 6;
  pop.style.top  = Math.max(8, top) + 'px';
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
}

/* @fn closeReaderPop */
function closeReaderPop() {
  const pop = document.getElementById('reader-pop');
  if (pop) pop.classList.remove('rp-visible');
}

/* ── mode A: word highlight ───────────────────────────────────────────────── */

/* @fn readerHlRule, which words the hovered one matches, and the rule used.
   Returns { rule, sel } where sel selects the matching .rd-w elements. */
function readerHlRule(el) {
  const q = (attr, v) => `.reader-igt .rd-w[${attr}="${CSS.escape(v)}"]`;
  if (_readerHl === 'lemma' && el.dataset.lid) return { rule: 'lemma', sel: q('data-lid', el.dataset.lid) };
  if (el.dataset.did) return { rule: 'dict', sel: q('data-did', el.dataset.did) };
  return { rule: 'form', sel: q('data-nf', el.dataset.nf) };
}

/* @fn readerHighlight, mark (or clear) the words matching el. */
function readerHighlight(el, on) {
  if (!el || el.classList.contains('punct')) return;
  document.querySelectorAll(readerHlRule(el).sel).forEach(x => x.classList.toggle('hl', on));
}

/* @fn readerWordPopHtml, a word's fields, read-only. */
function readerWordPopHtml(el) {
  const r = findWord(el.dataset.wid);
  if (!r) return '';
  const w = r.word, sid = el.dataset.sid;
  const { rule, sel } = readerHlRule(el);
  const n = document.querySelectorAll(sel).length;
  const row = (label, html) => html ? `<div class="rp-row"><div class="rp-lbl">${label}</div><div class="rp-val">${html}</div></div>` : '';
  const tls = (w.transliterations || []).filter(x => x && x.text)
    .map(x => `<div>${x.label ? `<span class="rp-tag">${esc(x.label)}</span> ` : ''}${esc(x.text)}</div>`).join('');
  const entry = w.dict_id ? findDictEntry(w.dict_id) : null;
  const morphs = (w.morphemes || []).filter(m => m && (m.form || m.gloss))
    .map(m => `<div><span class="rp-mono">${esc(m.form || '')}</span>${m.gloss ? ` · ${esc(m.gloss)}` : ''}${m.type ? ` <span class="rp-tag">${esc(m.type)}</span>` : ''}</div>`).join('');
  const sent = r.sent || (S.sentById.get(sid) || {}).sent;
  const head = w.head && sent ? (sent.words || []).find(x => x.id === w.head || depLocalId(x.id) === w.head) : null;
  const dep = w.dep_rel ? `${esc(w.dep_rel)}${head ? ` → ${esc(head.form || '')}` : ''}` : '';
  return `
    <div class="rp-head">
      <span class="rp-loc">${esc(sentPosLabel(sid))}</span>
      <button class="rp-close" data-action="reader-pop-close" aria-label="${escAttr(t('aria.btn.close'))}">${icon('x')}</button>
    </div>
    <div class="rp-body">
      <div class="rp-text">${esc(w.form || '')}</div>
      <div class="rp-rule">${t('label.reader.hl_rule.' + rule, { n })}</div>
      ${row(t('label.editor.transliterations'), tls)}
      ${row(t('label.editor.parse'), w.morphological_parse ? `<span class="rp-mono">${esc(w.morphological_parse)}</span>` : '')}
      ${row(t('label.editor.word_gloss'), esc(wordGloss(w) || ''))}
      ${row(t('label.dict.lex.pos'), esc(w.part_of_speech || ''))}
      ${row(t('label.editor.lemma'), esc(w.lemma_id ? lemmaFormOf(w.lemma_id) : ''))}
      ${row(t('label.dict.lexicon'), entry ? esc([...new Set([entry.gloss, entry.meaning].filter(Boolean))].join(' · ') || entry.form || '') : '')}
      ${row(t('label.dict.morphemes'), morphs)}
      ${row(t('label.editor.dep_parse'), dep)}
    </div>
    <div class="rp-foot">
      <button class="btn btn-sm btn-ghost" data-go="word" data-sid="${escAttr(sid)}" data-wid="${escAttr(w.id)}">${t('btn.reader.open_word')}</button>
    </div>`;
}

/* @fn openReaderWordPop, the popup for a word in mode A. */
function openReaderWordPop(el) {
  const pop = document.getElementById('reader-pop');
  if (!pop || !el) return;
  pop.innerHTML = readerWordPopHtml(el);
  placeReaderPop(pop, el);
}
