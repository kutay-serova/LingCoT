/* =============================================================================
   reader.js, D41 Reader Mode
   Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
   =============================================================================
   The document read continuously, without editors. Read-only by design: the
   sentence popup shows fields and links to the annotation view, and writes
   nothing (dev/design/D41_reader_mode.md).

   Modes: 'cols' (B, text against translation, tb-reader-cols) and 'igt'
   (A, interlinear, tb-reader-igt). _readerMode is in render()'s cache key.

   Scope is the open document. Paragraphs render in batches of
   READER_PARA_BATCH; the rest load as the sentinel scrolls into view, like the
   section view.
   ============================================================================= */

let _readerMode = 'cols';
const READER_PARA_BATCH = 30;
// Section to scroll to after the next render (set by the section view's Read button).
let _readerScrollSi = null;

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

/* @fn renderReaderBatch, the batch renderer for the active mode. */
function renderReaderBatch(items) {
  return renderReaderColsBatch(items);
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
      <span class="text-sm text-muted">${t('hint.reader.read_only')}</span>
    </div>
    <div class="reader reader-${_readerMode}">
      <div class="reader-colhead" aria-hidden="true">
        <span>${t('label.reader.text')}</span><span>${t('label.editor.translation')}</span>
      </div>
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
  pop.dataset.sid = span.dataset.sid;
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
  if (pop) { pop.classList.remove('rp-visible'); delete pop.dataset.sid; }
}
