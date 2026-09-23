#!/usr/bin/env node
/* =============================================================================
   reader_igt_test.js, D41 Reader Mode A: interlinear, word highlight, popup
   Run:  node dev/tests/reader_igt_test.js
   =============================================================================
   The highlight rule, as decided at tb-reader-igt:
     · default: same spelling (normForm)
     · if the hovered word has a dict_id: same dict_id only
     · switch "lemma": same lemma_id; a word without one falls back to the above
     · the popup names the rule that matched
   Also: tiers toggle, every word carries what the rule compares, the view state
   reaches the render cache key, and the popup cannot edit.
   ============================================================================= */

const vm = require('vm');
const { read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const EN = JSON.parse(read('resources/locale/en.json'));
const W = (id, form, extra = {}) => ({ id, form, morphemes: [], ...extra });
const s1 = { id: 's1', text: 'Dağ dağ gördü .', translations: [{ text: 'The mountain saw.' }], words: [
  W('s1.w1', 'Dağ', { dict_id: 'd1', lemma_id: 'L1', gloss: 'mountain', morphological_parse: 'dağ',
      transliterations: [{ label: 'IPA', text: 'daɰ' }], part_of_speech: 'NOUN',
      morphemes: [{ form: 'dağ', gloss: 'mountain', type: 'root' }], dep_rel: 'nsubj', head: 'w_003' }),
  W('s1.w2', 'dağ', { lemma_id: 'L1' }),
  W('s1.w3', 'gördü', { id: 's1.w_003' }),
  W('s1.w4', '.'),
] };
s1.words[2].id = 's1.w_003';
const SECS = [{ title: 'One', paragraphs: [{ sentences: [s1] }] }];
const byWord = new Map(s1.words.map(w => [w.id, { word: w, sent: s1 }]));

const ctx = vm.createContext({
  S: { sentById: new Map([['s1', { sent: s1 }]]) },
  doc: () => ({ id: 'd', metadata: { title: 'D' }, sections: SECS }), sections: () => SECS,
  t: (k, v) => (EN[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] !== undefined ? v[n] : '')),
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  escAttr: s => String(s).replace(/"/g, '&quot;'),
  icon: n => `<svg data-i="${n}"></svg>`, viewHeader: (a, l) => `<div ${a}>${l}</div>`, deadEndHtml: k => k,
  sentTrans: s => s.translations?.[0]?.text || null, sentPosLabel: id => `@${id}`,
  normForm: f => String(f).toLocaleLowerCase('tr'),
  _navIsToken: w => /\p{L}/u.test(w.form || ''),
  wordGloss: w => w.gloss || '', wordTranslit: w => (w.transliterations || [])[0]?.text || '',
  findWord: id => byWord.get(id) || null, findDictEntry: id => (id === 'd1' ? { gloss: 'mountain', meaning: 'a high hill' } : null),
  lemmaFormOf: id => (id === 'L1' ? 'dağ' : ''), depLocalId: id => id.split('.').pop(),
  CSS: { escape: s => String(s) },
  document: { querySelectorAll: () => [1, 2] },
});
vm.runInContext(read('modules/reader.js'), ctx, { filename: 'reader.js' });
const run = e => vm.runInContext(e, ctx);
const el = (w, extra = '') => `({ classList: { contains: c => ${extra.includes('punct')} && c === 'punct' }, dataset: { wid: '${w.id}', sid: 's1', nf: '${w.form.toLocaleLowerCase('tr')}'${w.dict_id ? `, did: '${w.dict_id}'` : ''}${w.lemma_id ? `, lid: '${w.lemma_id}'` : ''} } })`;

console.log('\nthe interlinear rows\n');
{
  run("_readerMode = 'igt'");
  const html = run('renderReaderIgtBatch(readerParas())');
  const words = [...html.matchAll(/<span class="rd-w[^"]*" ([^>]*)>/g)].map(m => m[1]);
  check(words.length === 4 && words.every(a => /data-wid=/.test(a) && /data-nf=/.test(a)), 'every word carries its id and folded form');
  check(/data-wid="s1\.w1"[^>]*data-did="d1"[^>]*data-lid="L1"/.test(html) && !/data-wid="s1\.w2"[^>]*data-did=/.test(html),
        'dict_id and lemma_id only where the word has them');
  check(/data-nf="dağ"/.test(html) && (html.match(/data-nf="dağ"/g) || []).length === 2, '"Dağ" and "dağ" fold to one spelling');
  check(/class="rd-w punct"/.test(html), 'punctuation is marked, and gets no highlight or popup');
  check(/rd-tl">daɰ/.test(html) && /rd-p">dağ/.test(html) && /rd-g">mountain/.test(html) && /‘The mountain saw\.’/.test(html),
        'all four tiers are drawn by default');
  run("_readerTiers.translit = false; _readerTiers.translation = false");
  const off = run('renderReaderIgtBatch(readerParas())');
  check(!/rd-tl/.test(off) && !/rd-tr/.test(off) && /rd-p/.test(off), 'a tier switched off is not drawn at all');
  const k1 = run('readerCacheKey()');
  run("_readerTiers.translit = true; _readerTiers.translation = true");
  check(k1 !== run('readerCacheKey()'), 'the tiers are in the render cache key');
  const k2 = run('readerCacheKey()'); run("_readerHl = 'lemma'");
  check(k2 !== run('readerCacheKey()'), 'and so is the highlight switch');
  run("_readerHl = 'word'");
}

console.log('\nthe highlight rule\n');
{
  const rule = (w, hl) => { run(`_readerHl = '${hl}'`); return JSON.parse(run(`JSON.stringify(readerHlRule(${el(w)}))`)); };
  const [w1, w2, w3] = s1.words;
  let r = rule(w1, 'word');
  check(r.rule === 'dict' && /data-did="d1"/.test(r.sel), 'a word with a dict_id matches that dict_id only');
  r = rule(w2, 'word');
  check(r.rule === 'form' && /data-nf="dağ"/.test(r.sel), 'a word without one matches the same spelling');
  r = rule(w2, 'lemma');
  check(r.rule === 'lemma' && /data-lid="L1"/.test(r.sel), 'with the switch on lemma, the same lemma_id');
  r = rule(w1, 'lemma');
  check(r.rule === 'lemma', 'which outranks the dict_id');
  r = rule(w3, 'lemma');
  check(r.rule === 'form', 'a word with no lemma_id falls back to the default rule');
  run("_readerHl = 'word'");
}

console.log('\nthe word popup\n');
{
  const pop = run(`readerWordPopHtml(${el(s1.words[0])})`);
  check(pop.includes(EN['label.reader.hl_rule.dict'].replace('{n}', '2')), 'it names the rule that matched, and the count');
  check(/daɰ/.test(pop) && /IPA/.test(pop) && /NOUN/.test(pop) && /a high hill/.test(pop) && /root/.test(pop),
        'transliteration, POS, the entry and the morphemes are shown');
  check(/nsubj → gördü/.test(pop), 'the dependency relation names its head');
  check(!/<(input|textarea|select)\b|contenteditable/.test(pop), 'nothing in it can edit');
  const buttons = [...pop.matchAll(/<button[^>]*>/g)].map(m => m[0]);
  check(buttons.length === 2 && buttons.some(b => /data-go="word"[^>]*data-wid="s1\.w1"/.test(b)),
        'its only buttons are close and "open in annotation view" for the word');
}

console.log('\nwiring\n');
{
  const ev = read('modules/events.js'), rj = read('modules/reader.js');
  check(/closest\('\.reader-igt \.rd-w'\)[\s\S]{0,120}openReaderWordPop/.test(ev), 'a click on a word opens its popup');
  check(/mouseover[\s\S]{0,160}readerHighlight\(w, true\)/.test(ev) && /mouseout[\s\S]{0,160}readerHighlight\(w, false\)/.test(ev),
        'hover sets and clears the highlight');
  check(/data-action="reader-mode"|'reader-mode'/.test(rj) && /\['cols',[^\]]*\], \['igt'/.test(rj), 'the toolbar switches between the two modes');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
