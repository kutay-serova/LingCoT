#!/usr/bin/env node
/* =============================================================================
   pseudo_locale_test.js, every visible string comes from the locale file
   Run:  node dev/tests/pseudo_locale_test.js        (slow: ~15 s, needs Chromium)
   =============================================================================
   Complements i18n_literal_test.js, which reads the code and can only catch the
   patterns it knows. This one reads the screen. A pseudo-locale is built in
   memory from en.json with every text run prefixed "§", the app is switched to
   it, and every view, the two header menus and the autosave dialog are drawn.
   Visible text and title/placeholder/aria-label values without the mark fail,
   unless they are
     · data: any string value from the loaded corpus, dictionary, participants
       or bundled resource files (compared case-insensitively, as substrings)
     · in EXEMPT below: names, licences, field ids
   Found 23 strings the scanner could not see on its first run (tb-strings).
   Blind spot: a single word that is also a data value ("type", "gloss") passes.
   ============================================================================= */

const fs = require('fs'), path = require('path'), os = require('os');
const { SRC } = require('./_source.js');
const { boot } = require('./_gui.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const FIXTURE = path.join(SRC, '..', 'samples', 'turkish-test');
const PREFIX = 'turkish-test';
// Not interface text: product, licence and service names; the copyright line.
const EXEMPT_TEXT = ['LingCoT', '© 2026 Kutay Serova —', 'MIT License', 'NLLB-200', 'CC BY-NC 4.0', 'Google Translate'];
// Field ids, shown as ids on purpose.
const EXEMPT_SELECTORS = ['.gq-why'];

// ── the pseudo-locale ───────────────────────────────────────────────────────
const EN = JSON.parse(fs.readFileSync(path.join(SRC, 'resources/locale/en.json'), 'utf8'));
const mark = v => v.replace(/(^|>)([^<>]+)/g, (m, a, b) => a + (b.trim() ? '§' + b : b));
const PSEUDO = Object.fromEntries(Object.entries(EN).map(([k, v]) =>
  [k, k === '_meta' ? { ...v, locale: 'xx', language: 'Pseudo' } : mark(v)]));

// ── data strings ────────────────────────────────────────────────────────────
const data = new Set();
const collect = v => {
  if (typeof v === 'string') { if (/\p{L}{2,}/u.test(v)) data.add(v.toLocaleLowerCase()); }
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
for (const f of fs.readdirSync(FIXTURE))
  for (const line of fs.readFileSync(path.join(FIXTURE, f), 'utf8').split('\n'))
    if (line.trim()) collect(JSON.parse(line));
for (const f of fs.readdirSync(path.join(SRC, 'resources')).filter(f => f.endsWith('.json')))
  collect(JSON.parse(fs.readFileSync(path.join(SRC, 'resources', f), 'utf8')));
// Longest first, so a sentence is removed before the words inside it.
const DATA = [...data].sort((a, b) => b.length - a.length);
// Whole data values are removed, at word boundaries so a short value ("da")
// cannot eat part of a word. What is left must be empty, except that a preview
// cut short with "[...]" or "…" may end in the start of a value.
const L = /\p{L}/u;
const removeWord = (r, d) => {
  let i = 0, out = '';
  for (let j; (j = r.indexOf(d, i)) !== -1; i = j + d.length) {
    const ok = !L.test(r[j - 1] || '') && !L.test(r[j + d.length] || '');
    out += r.slice(i, j) + (ok ? '\u0000' : d);
  }
  return out + r.slice(i);
};
const isWhole = s => {
  let r = s.toLocaleLowerCase();
  for (const d of DATA) if (r.includes(d)) r = removeWord(r, d);
  return !r.split('\u0000').some(x => /\p{L}{2,}/u.test(x));
};
const isData = s => {
  const parts = s.split(/\[\.\.\.\]|…/);
  if (parts.length === 1) return isWhole(s);
  // Each cut part: whole values, then the start of one more value.
  return parts.every(part => {
    const seg = part.trim().toLocaleLowerCase();
    if (!/\p{L}{2,}/u.test(seg) || isWhole(seg)) return true;
    for (let k = 0; k < seg.length; k++) {
      if (k && L.test(seg[k - 1])) continue;
      const tail = seg.slice(k).trim();
      if (DATA.some(d => d.startsWith(tail)) && isWhole(seg.slice(0, k))) return true;
    }
    return false;
  });
};

// Visible, unmarked text in the page, as "where | text".
const sweep = (page, exemptSel) => page.evaluate(exemptSel => {
  const out = new Set();
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const skip = el => exemptSel.some(s => el.closest(s));
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const s = n.nodeValue.replace(/\s+/g, ' ').trim(), el = n.parentElement;
    if (!/\p{L}{2,}/u.test(s) || s.includes('§') || !el || !vis(el) || skip(el)) continue;
    out.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className || '').split(' ')[0]}\u0000${s}`);
  }
  for (const el of document.querySelectorAll('[title],[placeholder],[aria-label]')) {
    if (!vis(el) || skip(el)) continue;
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = (el.getAttribute(a) || '').trim();
      if (/\p{L}{2,}/u.test(v) && !v.includes('§')) out.add(`@${a} ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}\u0000${v}`);
    }
  }
  return [...out];
}, exemptSel);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot_pseudo_'));
  for (const f of fs.readdirSync(FIXTURE)) fs.copyFileSync(path.join(FIXTURE, f), path.join(dir, f));
  const H = await boot({ outDir: path.join(dir, 'out'), corpusPath: path.join(dir, `${PREFIX}_corpus.jsonl`) });
  const { page, api } = H;
  const readFile = api.read_file;
  api.read_file = rel => rel === 'resources/locale/xx.json' ? JSON.stringify(PSEUDO) : readFile(rel);

  const found = new Map();   // text -> first place seen
  const take = async where => {
    for (const x of await sweep(page, EXEMPT_SELECTORS)) {
      const [el, text] = x.split('\u0000');
      if (EXEMPT_TEXT.includes(text) || isData(text)) continue;
      if (!found.has(text)) found.set(text, `${where}: ${el}`);
    }
  };

  await page.evaluate(() => applyLocale('xx'));
  check(await page.evaluate(() => uiLocaleCode()) === 'xx', 'the pseudo-locale is active');
  await take('empty');
  await page.click('#file-btn'); await take('file menu');
  await page.click('#file-open-item'); await page.waitForTimeout(1500);
  check(await page.evaluate(() => S.docs.length) === 1, 'the fixture corpus opened');
  await take('autosave dialog');
  await page.evaluate(() => document.querySelector('#ncs-box button:not(.btn-primary)')?.click());
  await page.waitForTimeout(200);
  await page.click('#project-btn'); await take('project menu');
  await page.click('#project-btn');

  const views = await page.evaluate(() => Object.keys(VIEW_RENDERERS));
  const errs = [];
  for (const v of views) {
    const err = await page.evaluate(v => {
      try {
        const p = S.docs[0].sections[0].paragraphs[0], s = p.sentences[1] || p.sentences[0];
        Object.assign(S, { sectIdx: 0, paraIdx: 0, sentId: s.id, wordId: s.words[1].id, dictForm: s.words[1].form,
                           dictEntryId: (S.dictionary[0] || {}).id, lemmaId: ((S.lemmas || [])[0] || {}).id, view: v });
        _renderCacheKey = null; render(); return null;
      } catch (e) { return e.message; }
    }, v);
    if (err) errs.push(`${v}: ${err}`);
    await page.waitForTimeout(150);
    await take(v);
  }
  // Reader Mode A has its own toolbar and rows; draw it too.
  await page.evaluate(() => { S.view = 'reader'; _readerMode = 'igt'; _renderCacheKey = null; render(); });
  await page.waitForTimeout(150);
  await take('reader (interlinear)');
  await page.evaluate(() => { const w = document.querySelector('.reader-igt .rd-w:not(.punct)'); if (w) openReaderWordPop(w); });
  await take('reader word popup');
  check(views.length >= 20, `${views.length} views drawn`);
  check(!errs.length, 'no view threw', errs.map(e => `         ${e}`).join('\n'));
  check(!found.size, 'every visible string is from the locale, data, or exempt',
        [...found].map(([t, w]) => `         ${w} | ${t}`).join('\n')
        + '\n         move it to en.json (and haw.json), or exempt it here with the reason');
  check(!H.errors.length, 'no page errors', H.errors.map(e => `         ${e}`).join('\n'));

  await H.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL threw', e); process.exit(1); });
