#!/usr/bin/env node
/* =============================================================================
   reader_cols_test.js, D41 Reader Mode B: text against translation, read-only
   Run:  node dev/tests/reader_cols_test.js
   =============================================================================
   Runs reader.js against a stub document. Holds:
     · every sentence appears twice, text and translation, paired by data-sid
       (that pairing is what the existing hover highlight reads)
     · section headings in reading order; the first batch is READER_PARA_BATCH
       paragraphs and a sentinel carries the rest
     · nothing on the page or in the popup can edit: no inputs, no edit buttons
     · the popup shows every translation and transliteration
     · the view is registered, its mode is in the render cache key, a sentence
       click in the reader opens the popup, and navigating closes it
   ============================================================================= */

const vm = require('vm');
const { read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const EN = JSON.parse(read('resources/locale/en.json'));
const sent = (id, text, tr, extra = {}) => ({ id, text, translations: tr ? [{ text: tr }] : [], words: [], ...extra });
const para = (si, pi, n) => ({ sentences: Array.from({ length: n }, (_, k) => sent(`s${si}.${pi}.${k}`, `Src ${si}.${pi}.${k}`, k === 1 ? null : `Tr ${si}.${pi}.${k}`)) });
const SECS = [
  { title: 'First', paragraphs: Array.from({ length: 25 }, (_, pi) => para(0, pi, 2)) },
  { title: '',      paragraphs: Array.from({ length: 20 }, (_, pi) => para(1, pi, 2)) },
  { title: 'Empty', paragraphs: [] },
];
SECS[0].paragraphs[0].sentences[0] = sent('s0.0.0', 'Src 0.0.0', 'First translation', {
  translations: [{ text: 'First translation' }, { text: 'Second translation' }],
  transliterations: [{ label: 'IPA', text: 'sɾc' }], comments: [{ text: 'a note' }] });
const DOC = { id: 'd1', metadata: { title: 'Doc' }, sections: SECS };
const byId = new Map();
SECS.forEach(sec => sec.paragraphs.forEach(p => p.sentences.forEach(s => byId.set(s.id, { sent: s, sect: sec, para: p }))));

const ctx = vm.createContext({
  S: { sentById: byId },
  doc: () => DOC, sections: () => SECS,
  t: (k, v) => (EN[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] !== undefined ? v[n] : '')),
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/"/g, '&quot;'),
  icon: n => `<svg data-i="${n}"></svg>`,
  viewHeader: (a, l) => `<div class="back-btn" ${a}>${l}</div>`,
  deadEndHtml: k => `<p>${k}</p>`,
  sentTrans: s => (s.translations && s.translations[0] && s.translations[0].text) || null,
  sentPosLabel: id => `@${id}`,
});
vm.runInContext(read('modules/reader.js'), ctx, { filename: 'reader.js' });
const run = e => vm.runInContext(e, ctx);

console.log('\nthe column view\n');
const html = run('renderReader()');
const nSent = SECS.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + p.sentences.length, 0), 0);
{
  const rows = (html.match(/class="reader-row"/g) || []).length;
  const batch = run('READER_PARA_BATCH');
  check(rows === batch, `the first batch is ${batch} paragraphs (${rows})`);
  check(/id="reader-sentinel" data-next="30"/.test(html), 'and a sentinel carries the rest');
  const sids = [...html.matchAll(/class="s-span[^"]*" data-sid="([^"]+)"/g)].map(m => m[1]);
  const counts = sids.reduce((m, s) => m.set(s, (m.get(s) || 0) + 1), new Map());
  check([...counts.values()].every(n => n === 2), 'each sentence appears twice, text and translation, by data-sid');
  check(/no-data" data-sid="s0\.1\.1">/.test(html) && html.includes(EN['status.no_translation']),
        'a sentence with no translation says so in the translation column');
  check(html.indexOf('id="reader-sec-0"') < html.indexOf('id="reader-sec-1"') || !html.includes('id="reader-sec-1"'),
        'section headings in reading order');
  const rest = run('renderReaderBatch(readerParas().slice(30))');
  check(/id="reader-sec-1">Section 2</.test(run('renderReaderBatch(readerParas().slice(25, 26))')),
        'an untitled section is headed "Section n", from the locale');
  check(!/reader-sec-2/.test(html + rest), 'an empty section has no heading');
  const all = [...(html + rest).matchAll(/class="s-span[^"]*" data-sid="([^"]+)"/g)].map(m => m[1]);
  check(new Set(all).size === nSent, `every sentence of the document is reached (${new Set(all).size} of ${nSent})`);
  check(!/<(input|textarea|select)\b|contenteditable|edit-btn|data-action="(?!reader)/.test(html + rest),
        'nothing on the page can edit');
}

console.log('\nthe popup\n');
{
  const pop = run("readerPopHtml('s0.0.0')");
  check(/First translation/.test(pop) && /Second translation/.test(pop), 'it shows every translation');
  check(/IPA/.test(pop) && /sɾc/.test(pop), 'and each transliteration with its label');
  check(/a note/.test(pop), 'and comments');
  check(!/<(input|textarea|select)\b|contenteditable/.test(pop), 'and nothing in it can edit');
  const buttons = [...pop.matchAll(/<button[^>]*>/g)].map(m => m[0]);
  check(buttons.length === 2 && buttons.some(b => /reader-pop-close/.test(b)) && buttons.some(b => /data-go="sentence"/.test(b)),
        'its only buttons are close and "open in annotation view"');
  check(run("readerPopHtml('nope')") === '', 'an unknown sentence gives nothing');
}

console.log('\nwiring\n');
{
  const htmlSrc = read('LingCoT.html'), ev = read('modules/events.js');
  check(/'reader':\s+renderReader/.test(htmlSrc), "'reader' is a registered view");
  check(/<script src="modules\/reader\.js"><\/script>/.test(htmlSrc), 'reader.js is loaded');
  check(/const cacheKey = [^\n]*_readerMode/.test(htmlSrc), 'the reader mode is in the render cache key');
  check(/span\.closest\('\.reader'\)\) \{ openReaderPop\(span\); return; \}/.test(ev),
        'a sentence click inside the reader opens the popup instead of navigating');
  const goSrc = htmlSrc.slice(htmlSrc.indexOf('function go(view'), htmlSrc.indexOf('function goCorpusReturn'));
  check(/closeReaderPop\(\)[\s\S]*render\(\)/.test(goSrc), 'navigating closes the popup before rendering');
  check(/\['reader-pop',\s+'rp-visible',\s+closeReaderPop\]/.test(ev), 'Escape closes it');
  check(/data-action="reader-open"/.test(htmlSrc) && (htmlSrc.match(/data-action="reader-open"/g) || []).length >= 2,
        'the document and section views both have a Read button');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
