#!/usr/bin/env node
/* =============================================================================
   word_chip_test.js, the same word elsewhere in the corpus (D40 stage D)
   Run:  node dev/tests/word_chip_test.js
   =============================================================================
   The word editor offers the analyses other tokens of the same folded form
   carry: one chip per distinct analysis, which fills only EMPTY fields, and a
   `differs` note under a filled field whose value other tokens do not share.

   Sections 3 and 4 run the take against a small stand-in for the editor's
   fields, because the property that matters is what a click writes and what it
   leaves alone. Section 5 is the stamp: `corpus:<id>` becomes a copy moment
   naming the source word, and every other mark stays a plain derived stamp.
   ============================================================================= */

const vm = require('vm');
const { fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

// ── a stand-in for the word editor ─────────────────────────────────────────
const input = (value = '') => ({ value, dataset: {}, dispatchEvent() {} });
let els, rows, translitRows, added;
const reset = (vals = {}) => {
  els = {
    'ew-pos': input(vals.pos), 'ew-gloss': input(vals.gloss), 'ew-parse': input(vals.parse),
    'ew-lemma': input(vals.lemma), 'ew-translit': input(),
    'ew-translit-rows': { querySelectorAll: () => [], insertAdjacentHTML: (_, h) => { added += h; } },
    'ew-seen-strip': { innerHTML: '' }, 'ew-pos-differs': { innerHTML: '' }, 'ew-gloss-differs': { innerHTML: '' },
    'ew-parse-differs': { innerHTML: '' }, 'ew-lemma-differs': { innerHTML: '' }, 'ew-translit-differs': { innerHTML: '' },
  };
  translitRows = vals.translits || [];
  added = '';
  rows = (vals.rows || []).map(g => {
    const r = { '.morph-gloss-input': input(g), '.morph-pos-input': input(), '.morph-type-input': input() };
    return { querySelector: sel => r[sel] || null, r };
  });
};

// ── the corpus: `hasan` four times, one of them the token being edited ─────
const W = (id, form, a = {}) => ({ id, form, morphemes: [], transliterations: [], ...a });
const lemmas = { l1: 'Hasan' };
const words = [
  W('w_edit', 'Hasan'),
  W('w1', 'Hasan', { part_of_speech: 'PROPN', lemma_id: 'l1', transliterations: [{ label: 'IPA', text: "ha'san" }],
                     morphemes: [{ gloss: 'Hasan', part_of_speech: 'PROPN', type: 'root' }] }),
  W('w2', 'hasan', { part_of_speech: 'PROPN', lemma_id: 'l1', transliterations: [{ label: 'IPA', text: "ha'san" }],
                     morphemes: [{ gloss: 'Hasan', part_of_speech: 'PROPN', type: 'root' }] }),
  W('w3', 'HASAN', { part_of_speech: 'NOUN', gloss: 'handsome', transliterations: [{ label: 'IPA', text: 'hasan' }] }),
  W('w4', 'Hasan'),                                        // unannotated: offers nothing
];
const byId = new Map(words.map(w => [w.id, { word: w, sent: { id: 's' } }]));
const logged = [];

const ctx = vm.createContext({
  S: { view: 'word-edit', wordId: 'w_edit', wordById: byId, sentById: new Map(), provEvents: [] },
  console,
  document: {
    getElementById: id => els[id] || null,
    querySelectorAll: sel => (sel === '#ew-morph-rows .morph-edit-row' ? rows : []),
  },
  Event: class { constructor(type) { this.type = type; } },
  formRefs: (kind, form) => words.filter(w => w.form.toLowerCase() === form.toLowerCase()).map(w => ({ word_id: w.id })),
  findWord: id => byId.get(id) || null,
  wordGloss: w => w.gloss || (w.morphemes || []).map(m => m.gloss).filter(Boolean).join('-'),
  lemmaFormOf: id => lemmas[id] || '',
  readTransliterationsEditor: () => translitRows,
  ROW_EDITORS: { translit: { rowClass: 'translit-row', fields: () => ({ label: '', text: '' }),
                             build: r => `[${r.label}:${r.text}]` } },
  provFromLabel: id => `@${id}`,
  t: (k, p) => k + (p ? JSON.stringify(p) : ''),
  esc: s => String(s), escAttr: s => String(s),
  logEvent: (...a) => logged.push(a),
  prov: () => ({ annotator_id: 'ann_1', date: '2026-09-23', time: '10:00:00' }),
});
vm.runInContext("var _ewAnalyses = []; var OFFER_MARKS = { will: '=', new: '+', stop: '!', differs: '≠' };", ctx);
for (const fn of ['_rankValues', 'wordAnalysisOf', 'wordAnalyses', '_ewFormState', '_analysisFills',
                  '_wordOfferMeta', 'refreshWordOffers', '_ewSet', 'takeWordAnalysis', 'offerStripHtml',
                  '_offerMoment', '_copyFieldProv', '_derivedFieldProv']) {
  const src = fnSrc('LingCoT.html', fn);
  check(!!src, `${fn}() is defined`);
  if (src) vm.runInContext(src, ctx, { filename: fn + '.js' });
}
const edited = byId.get('w_edit').word;

console.log('\n1 · which analyses are offered\n');
{
  const an = ctx.wordAnalyses(edited);
  check(an.length === 2, `two distinct analyses; the token itself and an unannotated one are left out (${an.length})`);
  check(an[0].n === 2 && an[0].a.pos === 'PROPN' && an[0].from === 'w1',
        'the commonest first, from its first token, across case differences in the form');
  check(an[1].a.pos === 'NOUN' && an[1].a.stored === 'handsome', 'the other analysis follows');
  edited.part_of_speech = 'SELF';
  check(!ctx.wordAnalyses(edited).some(o => o.a.pos === 'SELF'), 'the token being edited never offers itself');
  delete edited.part_of_speech;
}

console.log('\n2 · an analysis is offered only while it would fill something\n');
{
  reset();
  ctx.refreshWordOffers();
  check((els['ew-seen-strip'].innerHTML.match(/data-offer-act="word-analysis"/g) || []).length === 2,
        'an empty form is offered both');
  reset({ pos: 'PROPN', gloss: 'Hasan', lemma: 'Hasan', parse: '',
          translits: [{ label: 'IPA', text: "ha'san" }] });
  ctx.refreshWordOffers();
  check(!/word-analysis/.test(els['ew-seen-strip'].innerHTML),
        'a form with everything filled is offered nothing');
}

console.log('\n3 · a take fills empty fields, marked with the source\n');
{
  reset({ rows: [''] });                       // a monomorphemic word: one empty row
  const row = rows[0].r;
  ctx.refreshWordOffers();
  ctx.takeWordAnalysis({ dataset: { offerValue: '0' } });
  check(els['ew-pos'].value === 'PROPN' && els['ew-pos'].dataset.offerSrc === 'corpus:w1', 'POS, marked corpus:w1');
  check(els['ew-lemma'].value === 'Hasan' && els['ew-lemma'].dataset.offerSrc === 'corpus:w1', 'lemma, marked');
  check(els['ew-lemma'].dataset.lemmaId === 'l1', 'and the lemma is the source\'s own record, so a homograph is not asked again');
  check(row['.morph-gloss-input'].value === 'Hasan' && row['.morph-type-input'].value === 'root' &&
        row['.morph-gloss-input'].dataset.offerSrc === 'corpus:w1', 'the morpheme row, marked');
  check(els['ew-gloss'].value === '' && !els['ew-gloss'].dataset.offerSrc,
        'a composed gloss is not typed into the word gloss, nor is the field marked');
  check(added === "[IPA:ha'san]" && els['ew-translit'].dataset.offerSrc === 'corpus:w1',
        'the transliteration row is added and the list is marked');
  check(logged.some(a => a[1] === 'word chip taken'), 'the log line names no content');

  reset();
  ctx.refreshWordOffers();
  ctx.takeWordAnalysis({ dataset: { offerValue: '1' } });
  check(els['ew-gloss'].value === 'handsome', 'a typed gloss on the source is offered as typed');
}

console.log('\n4 · and leaves filled fields alone\n');
{
  reset({ pos: 'NOUN', lemma: 'Hasan', translits: [{ label: 'IPA', text: 'mine' }] });
  ctx.refreshWordOffers();
  ctx.takeWordAnalysis({ dataset: { offerValue: '0' } });
  check(els['ew-pos'].value === 'NOUN' && !els['ew-pos'].dataset.offerSrc, 'a filled POS is untouched and unmarked');
  check(added === '' && !els['ew-translit'].dataset.offerSrc, 'a label the token has is not added again');

  ctx.refreshWordOffers();
  check(/data-offer-act="set"[\s\S]*data-offer-value="PROPN"/.test(els['ew-pos-differs'].innerHTML) &&
        /offer\.differs\{"n":2/.test(els['ew-pos-differs'].innerHTML),
        'the filled POS gets a differs note: 2 other tokens say PROPN');
  check(/data-offer-src="corpus:w1"/.test(els['ew-pos-differs'].innerHTML),
        'its chip carries the source, so taking it stamps a copy');
  check(els['ew-lemma-differs'].innerHTML === '', 'a lemma every other token agrees with gets no note');
  check(/translit-set/.test(els['ew-translit-differs'].innerHTML), 'a transliteration that differs gets a note');
}

console.log('\n5 · the stamp\n');
{
  const c = ctx._offerMoment('corpus:w1');
  check(c.derived === true && c.annotator_id === null && c.from === 'w1', 'corpus:<id> is a copy naming the word');
  const l = ctx._offerMoment('lexicon');
  check(l.derived === true && !l.from, 'any other mark is a plain derived stamp, as before');
}

console.log('\n6 · found testing stage D: B-211 and B-212\n');
{
  const cands = [{ id: 'l1', form: 'dA', homograph: 1 }, { id: 'l2', form: 'dA', homograph: 2 }];
  vm.runInContext(fnSrc('LingCoT.html', 'lemmaStripHtml'), ctx);
  ctx.resolveLemma = () => ({ status: 'ambiguous', candidates: cands });
  ctx.lemmaGroup = () => ({ entries: [], tokens: [] });
  const before = ctx.lemmaStripHtml('dA', 'ew-lemma');
  check(/offer-stop/.test(before) && !/offer-taken/.test(before), 'B-211: with nothing chosen the strip asks');
  const after = ctx.lemmaStripHtml('dA', 'ew-lemma', '', null, false, 'l2');
  const chipOf = id => after.split('<button').find(b => b.includes(`data-offer-entry-id="${id}"`)) || '';
  check(/offer-will/.test(after) && /offer-taken/.test(chipOf('l2')) && !/offer-taken/.test(chipOf('l1')),
        'B-211: after a pick it says which, and marks that one chip taken');
  const rf = fnSrc('LingCoT.html', 'refreshLemmaStrip') || '';
  check(/chosenId\)/.test(rf) && /dataset\.lemmaId/.test(rf), 'B-211: the repaint passes the field\'s choice');
  const rw = fnSrc('LingCoT.html', 'renderWord') || '';
  check(/renderTransliterationsView\(word\.transliterations\)/.test(rw), 'B-212: the word view draws the word\'s transliterations');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
