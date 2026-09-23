#!/usr/bin/env node
/* =============================================================================
   sentence_copy_test.js, copying a sentence's annotation (D40 stage C)
   Run:  node dev/tests/sentence_copy_test.js
   =============================================================================
   The review panel shows, per word, what copying from a sentence with the same
   text would do; Copy writes the ticked rows. The rules this holds:
     · only EMPTY fields are written; a different value is a conflict and stays
     · an unticked row is not touched
     · every written field says it was copied, and from which sentence
     · a dependency head is remapped to the target's own words
     · Undo puts the words back exactly as they were
     · planning again after a copy finds nothing left to do
   Runs the real plan, apply and undo; the index and derivation calls around
   them are stubs, because they have their own guards.
   ============================================================================= */

const vm = require('vm');
const { fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

// ── two sentences with the same text: s2 annotated, s3 partly ─────────────
const M = (form, gloss, extra = {}) => ({ form, gloss, ...extra });
const s2 = { id: 'p1.s2', text: 'Soğuktur suları da, Hasan', translations: [{ text: 'Its waters are cold, Hasan', source_id: 'src_1', date: null }],
  words: [
    { id: 'p1.s2.w_001', form: 'Soğuktur', part_of_speech: 'ADJ', morphological_parse: 'soğuk-DIr', lemma_id: 'l_soguk', dict_id: 'd_soguk',
      transliterations: [{ label: 'IPA', text: "so'ɰuktur" }], head: 'w_002', dep_rel: 'amod',
      morphemes: [M('soğuk', 'cold', { type: 'root', dict_id: 'd_soguk_m' }), M('DIr', 'DECL', { type: 'bound.morpheme' })] },
    { id: 'p1.s2.w_002', form: 'suları', part_of_speech: 'NOUN', head: null,
      morphemes: [M('su', 'water'), M('lAr', 'PL'), M('sI', 'POSS')], morphological_parse: 'su-lAr-sI' },
    { id: 'p1.s2.w_003', form: 'da', part_of_speech: 'PART', lemma_id: 'l_da2', morphemes: [M('dA', 'LNK')], head: 'w_002', dep_rel: 'dep' },
    { id: 'p1.s2.w_004', form: ',', morphemes: [] },
    { id: 'p1.s2.w_005', form: 'Hasan', part_of_speech: 'PROPN', morphemes: [M('Hasan', 'Hasan')], head: 'w_009', dep_rel: 'vocative' },
  ] };
const target = () => ({ id: 'p1.s3', text: 'soğuktur suları da Hasan', translations: [],
  words: [
    { id: 'p1.s3.t1', form: 'Soğuktur', morphemes: [] },
    { id: 'p1.s3.t2', form: 'suları', morphemes: [] },
    { id: 'p1.s3.t3', form: 'da', morphemes: [M('dA', 'and')] },
    { id: 'p1.s3.t4', form: ',', morphemes: [] },
    { id: 'p1.s3.t5', form: 'Hasan', part_of_speech: 'PROPN', morphemes: [] },
  ] });
let s3 = target();

const written = [], logged = [];
const lemmas = { l_soguk: { id: 'l_soguk', form: 'soğuk' }, l_da2: { id: 'l_da2', form: 'dA', homograph: 2 } };
const dict = { d_soguk: { id: 'd_soguk' }, d_soguk_m: { id: 'd_soguk_m' } };
const S = { docs: [], sentById: new Map(), wordById: new Map(), provEvents: [], corpusLemmaRefs: new Map() };
const register = () => {
  S.docs = [{ sections: [{ paragraphs: [{ sentences: [s2, s3] }] }] }];
  S.sentById = new Map([s2, s3].map(s => [s.id, { sent: s }]));
  S.wordById = new Map([s2, s3].flatMap(s => s.words.map(w => [w.id, { word: w, sent: s }])));
};
register();

const ctx = vm.createContext({
  S, console, _dataGen: 0, _foldGen: 0,
  normForm: f => String(f || '').toLocaleLowerCase('tr'),
  wordGloss: w => w.gloss || (w.morphemes || []).map(m => m.gloss).filter(Boolean).join('-'),
  lemmaById: id => lemmas[id] || null,
  findDictEntry: id => dict[id] || null,
  linkTo: (o, { entry }) => { if (entry && !o.dict_id) { o.dict_id = entry.id; return 'linked'; } return 'exists'; },
  deindexWordForms() {}, indexWordForms() {}, _deriveWordFields() {},
  hasAnnotation: w => !!(w.part_of_speech || (w.morphemes || []).some(m => m.gloss)),
  findSent: id => S.sentById.get(id) || null,
  findWord: id => S.wordById.get(id) || null,
  logEvent: (...a) => logged.push(a),
  mutate: (t, w) => written.push(...w),
  prov: () => ({ annotator_id: 'ann_1', date: '2026-09-24', time: '10:00:00' }),
});
vm.runInContext(`var _sentTextIdx = { gen: -1, fold: -1, map: new Map() }; var _sentKeyMemo = new WeakMap();
                 var _provEventKey = new Map(); var _copyPanel = null; var _copyUndo = null;`, ctx);
for (const fn of ['sentKey', '_sentKeyOf', 'sentTextIndex', 'sameTextSentences', '_lcsPairs', 'alignTokens',
                  'depLocalId', '_navIsToken', 'padId', 'wordAnalysisOf', 'lemmaFormOf',
                  '_copyCell', '_lemmaLabel', 'wordCopyPlan', 'sentenceCopyPlan', '_sentSignature', 'copyOffersFor',
                  'applyWordCopy', 'applySentenceCopy', 'undoSentenceCopy',
                  '_derivedFieldProv', '_copyFieldProv', '_provKeyOf', 'thinProv', 'internProv', 'stampField',
                  'stampElement', 'appendProv', '_setWordLemma', '_indexWordLemma']) {
  const src = fnSrc('LingCoT.html', fn);
  check(!!src, `${fn}() is defined`);
  if (src) vm.runInContext(src, ctx, { filename: fn + '.js' });
}
const moment = id => ctx.S.provEvents[id];
const fp = (o, k) => moment(o.field_prov?.[k]);

console.log('\n1 · the plan\n');
let plan = ctx.sentenceCopyPlan(s2, s3);
const [rS, rSu, rDa, rComma, rH] = plan.rows;
{
  check(rS.cells.translit.state === 'write' && rS.cells.parse.state === 'write' && rS.cells.gloss.state === 'write' &&
        rS.cells.pos.state === 'write' && rS.cells.lemma.state === 'write' && rS.cells.lemma.val === 'soğuk',
        'an empty word: every field is to be written');
  check(rDa.cells.gloss.state === 'conflict' && rDa.cells.gloss.cur === 'and' && rDa.cells.gloss.val === 'LNK',
        'a different gloss is a conflict, both values shown');
  check(rDa.cells.lemma.val === 'dA·2', 'a homograph lemma is shown with its number');
  check(rH.cells.pos.state === 'same', 'a value already there is "already present"');
  check(rComma.punct === true, 'punctuation is skipped');
  const dep = rS.ops.find(o => o.op === 'dep');
  check(dep && dep.head === 't2' && dep.rel === 'amod', 'the head is remapped to the target\'s own word (w_002 → t2)');
  check(!rH.ops.some(o => o.op === 'dep'), 'a head whose token has no match is not copied');
  check(plan.sent.cells.translation.state === 'write', 'the empty translation is to be written');
  check(plan.fields === plan.rows.reduce((n, r) => n + (r.fields || 0), 0) + 1, `the count adds up (${plan.fields} fields)`);
}

console.log('\n2 · the offers\n');
{
  const off3 = ctx.copyOffersFor(s3);
  check(off3.into.length === 1 && off3.into[0].plan.src === s2, 'the partly annotated sentence is offered a copy from its twin');
  const off2 = ctx.copyOffersFor(s2);
  check(off2.out.length === 1 && off2.out[0].tgt === s3, 'the annotated one is offered a copy to its twin');
}

console.log('\n3 · Copy writes the ticked rows, empty fields only\n');
const before = JSON.stringify(s3);
{
  ctx.applySentenceCopy([{ plan, rows: [0, 2], sent: true }]);   // Soğuktur and da; suları unticked
  const [wS, wSu, wDa] = s3.words;
  check(wS.part_of_speech === 'ADJ' && wS.morphological_parse === 'soğuk-DIr' && wS.lemma_id === 'l_soguk' && wS.dict_id === 'd_soguk',
        'the ticked empty word is filled');
  check(wS.morphemes.length === 2 && wS.morphemes[0].id === 'p1.s3.t1.m_001' && wS.morphemes[0].gloss === 'cold' &&
        wS.morphemes[0].dict_id === 'd_soguk_m', 'its morphemes are copied under its own ids, links included');
  check(wS.head === 't2' && wS.dep_rel === 'amod', 'the dependency is written, remapped');
  check(wDa.morphemes[0].gloss === 'and', 'the conflicting gloss is left as it was');
  check(wDa.part_of_speech === 'PART' && wDa.lemma_id === 'l_da2', 'the empty fields beside it are filled');
  check(!wSu.part_of_speech && !wSu.morphemes.length, 'the unticked row is untouched');
  const m = fp(wS, 'part_of_speech');
  check(m && m.derived === true && m.annotator_id === null && m.from === 'p1.s2', 'a written field is stamped as copied from p1.s2');
  check(fp(wS.morphemes[0], 'gloss')?.from === 'p1.s2', 'and so is a copied morpheme\'s');
  const tr = s3.translations[0];
  check(tr.text === 'Its waters are cold, Hasan' && moment(tr.prov)?.from === 'p1.s2', 'the translation, stamped as a copy');
  check(written.some(x => x === wS) && written.some(x => x.rec === s3 && x.shallow), 'one mutate names the words and the sentence');
  check(logged.some(a => a[1] === 'repeat copy accepted' && /^2 word/.test(a[2])), 'the log line is counts only');
}

console.log('\n4 · planning again finds only what was left\n');
{
  S.wordById = new Map([s2, s3].flatMap(s => s.words.map(w => [w.id, { word: w, sent: s }])));
  const again = ctx.sentenceCopyPlan(s2, s3);
  check(again.rows[0].fields === 0 && again.rows[2].fields === 0, 'the copied rows have nothing left to write');
  check(again.rows[1].fields > 0, 'the unticked row is still offered');
  check(again.rows[2].cells.gloss.state === 'conflict', 'and the conflict is still a conflict');
}

console.log('\n5 · Undo\n');
{
  ctx.undoSentenceCopy();
  check(JSON.stringify(s3) === before, 'the target is back exactly as it was');
  check(!(S.corpusLemmaRefs.get('l_soguk') || []).some(r => r.word_id === 'p1.s3.t1'), 'and the lemma index with it');
  check(ctx._copyUndo === null || vm.runInContext('_copyUndo', ctx) === null, 'the undo is spent');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
