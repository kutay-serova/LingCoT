#!/usr/bin/env node
/* =============================================================================
   sentence_prefill_test.js, translation and transliteration pre-fill (D40 B)
   Run:  node dev/tests/sentence_prefill_test.js
   =============================================================================
   A sentence whose folded text matches another is offered that sentence's
   translation, when it has none, and its transliterations, per label it does
   not have. The offer is a pre-filled row; nothing is stored before Save.

   What Save writes is the part that matters, so sections 3 and 4 run the real
   save path from readForm's output onward: takeCopyMarks, applyForm with the
   field table, assignList, stampCopies. An unchanged pre-filled value is a
   copy and says where it came from; an edited one is the annotator's; the
   marks themselves never reach the record.
   ============================================================================= */

const vm = require('vm');
const { fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const N  = require('../../source/modules/normalize.js');
const FS = require('../../source/modules/field_spec.js');
const logged = [];
const ctx = vm.createContext({
  S: { docs: [], sentById: new Map(), wordById: new Map(), provEvents: [] },
  _dataGen: 0, _foldGen: 0, console,
  normForm: f => N.dictKeyIn(String(f || ''), 'tr', 'Latn'),
  t: (k, p) => k + (p ? ' ' + JSON.stringify(p) : ''),
  prov: () => ({ annotator_id: 'ann_1', date: '2026-09-23', time: '10:00:00' }),
  logEvent: (...a) => logged.push(a),
  fieldsOf: FS.fieldsOf, isFillable: FS.isFillable, isEmptyValue: FS.isEmptyValue,
});
vm.runInContext(`var _sentTextIdx = { gen: -1, fold: -1, map: new Map() };
                 var _sentKeyMemo = new WeakMap(); var _provEventKey = new Map();
                 var _PROV_LIST_CONTROLS = ['translations', 'translits', 'comments'];
                 var _ARRAY_CONTROLS = ['sources', 'list'];`, ctx);
for (const fn of ['sentKey', '_sentKeyOf', 'sentTextIndex', 'sameTextSentences',
                  '_rankValues', 'sentencePrefill', 'withPrefill', 'takeCopyMarks', 'stampCopies',
                  '_derivedFieldProv', '_copyFieldProv', 'isDerived', '_provKeyOf', 'thinProv',
                  'internProv', 'stampElement', '_listKeyOf', 'assignList', 'applyForm']) {
  const src = fnSrc('LingCoT.html', fn);
  check(!!src, `${fn}() is defined`);
  if (src) vm.runInContext(src, ctx, { filename: fn + '.js' });
}

// A corpus: s1 and s3 share a translation, s4 has a different one; s2 is the one being edited.
const TEXT = 'Soğuktur suları da, Hasan, bir tas içilmez.';
const mk = (id, text, extra = {}) => ({ id, text, words: [], translations: [], transliterations: [], ...extra });
const s1 = mk('p1.s1', TEXT, { translations: [{ text: 'Its waters are cold.', source_id: 'src_1', date: null }],
                                transliterations: [{ label: 'IPA', text: 'so\'ɰuktur' }] });
const s2 = mk('p1.s2', 'soğuktur suları da Hasan bir tas içilmez');
const s3 = mk('p2.s1', TEXT, { translations: [{ text: 'Its waters are cold.', source_id: 'src_1', date: null }] });
const s4 = mk('p3.s1', TEXT, { translations: [{ text: 'The water is cold.', source_id: null, date: null }],
                                transliterations: [{ label: 'IPA', text: 'other' }, { label: 'Yale', text: 'y' }] });
const s5 = mk('p4.s1', 'Drama köprüsü dar', { translations: [{ text: 'x', source_id: null, date: null }] });
const para = sentences => ({ sentences });
const doc = { id: 'd1', sections: [{ paragraphs: [para([s1, s2]), para([s3]), para([s4]), para([s5])] }] };
ctx.S.docs = [doc];
for (const s of [s1, s2, s3, s4, s5]) ctx.S.sentById.set(s.id, { sent: s });

console.log('\n1 · what is offered\n');
{
  const pf = ctx.sentencePrefill(s2);
  check(pf.translation && pf.translation.text === 'Its waters are cold.',
        'the commonest translation is pre-filled (2 sentences against 1)');
  check(pf.translation.source_id === 'src_1', 'with its source attribution');
  check(pf.translation._copyFrom === 'p1.s1', 'from the first sentence carrying it, in corpus order');
  check(pf.translation._copyAlts.length === 1 && pf.translation._copyAlts[0].text === 'The water is cold.',
        'the other translation is an alternative');
  const labels = pf.transliterations.map(x => x.label).sort().join(',');
  check(labels === 'IPA,Yale', `a transliteration per label (${labels})`);
  check(pf.transliterations.find(x => x.label === 'IPA').text === 'so\'ɰuktur',
        'a tie between labels\' values goes to the first in corpus order');

  s2.translations = [{ text: 'mine', source_id: null, date: null }];
  s2.transliterations = [{ label: 'IPA', text: 'mine' }];
  ctx._dataGen++;
  const pf2 = ctx.sentencePrefill(s2);
  check(pf2.translation === null, 'nothing is offered for a translation already there');
  check(pf2.transliterations.length === 1 && pf2.transliterations[0].label === 'Yale',
        'only the labels this sentence does not have');
  s2.translations = []; s2.transliterations = [];
  ctx._dataGen++;

  check(ctx.sentencePrefill(s5).translation === null, 'no identical sentence, no offer');
  const bare = ctx.sentencePrefill(null, 'SOĞUKTUR SULARI DA HASAN BİR TAS İÇİLMEZ');
  check(bare.translation && bare.translation.text === 'Its waters are cold.',
        'the add form, with only the typed text, is offered the same');
}

console.log('\n2 · the form is drawn from a copy\n');
{
  const view = ctx.withPrefill(s2, ctx.sentencePrefill(s2));
  check(view !== s2 && view.translations.length === 1 && s2.translations.length === 0,
        'the pre-filled rows are on the copy, never on the sentence');
  check(ctx.withPrefill(s5, ctx.sentencePrefill(s5)) === s5, 'with nothing to offer the sentence itself is drawn');
}

/* What readForm returns for the edit form of s2, pre-filled rows included. */
const formValues = ({ editTranslation = false, clearYale = false } = {}) => ({
  text: s2.text,
  translations: [{ text: editTranslation ? 'Its waters are cold, Hasan.' : 'Its waters are cold.',
                   source_id: 'src_1', date: null, _copyFrom: 'p1.s1', _copyText: 'Its waters are cold.' }],
  transliterations: [
    { label: 'IPA', text: 'so\'ɰuktur', _copyFrom: 'p1.s1', _copyText: 'so\'ɰuktur', _copyLabel: 'IPA' },
    ...(clearYale ? [] : [{ label: 'Yale', text: 'y', _copyFrom: 'p3.s1', _copyText: 'y', _copyLabel: 'Yale' }]),
  ],
  comments: [],
});
const save = (target, v) => {
  const copies = ctx.takeCopyMarks(v);
  ctx.applyForm('sentence', target, v, ctx.prov());
  ctx.stampCopies(copies);
};
const momentOf = el => ctx.S.provEvents[el.prov];

console.log('\n3 · saved unchanged: a copy that says where it came from\n');
{
  const target = mk('t1', s2.text);
  save(target, formValues());
  const tr = target.translations[0];
  check(tr.text === 'Its waters are cold.', 'the translation is stored');
  check(!Object.keys(tr).some(k => k.startsWith('_copy')) &&
        !target.transliterations.some(x => Object.keys(x).some(k => k.startsWith('_copy'))),
        'no pre-fill mark reaches the record');
  const m = momentOf(tr);
  check(m && m.derived === true && m.annotator_id === null && m.from === 'p1.s1',
        `its stamp is a copy from p1.s1 (${JSON.stringify(m)})`);
  const yale = target.transliterations.find(x => x.label === 'Yale');
  check(momentOf(yale)?.from === 'p3.s1', 'each transliteration names its own source');
  check(logged.some(a => a[1] === 'sentence prefill kept' && a[2] === 3), 'the log line is a count, 3');
}

console.log('\n4 · edited or cleared: the annotator\'s, or nothing\n');
{
  const target = mk('t2', s2.text);
  save(target, formValues({ editTranslation: true, clearYale: true }));
  const m = momentOf(target.translations[0]);
  check(m && m.annotator_id === 'ann_1' && !m.derived && !m.from,
        'an edited translation is stamped with the save\'s own moment');
  check(!target.transliterations.some(x => x.label === 'Yale'), 'a cleared row writes nothing');
  check(momentOf(target.transliterations.find(x => x.label === 'IPA'))?.from === 'p1.s1',
        'the untouched row beside it is still a copy');

  const t3 = mk('t3', s2.text);
  const v = formValues();
  v.transliterations[0].label = 'IPA-broad';           // same text, label changed
  save(t3, v);
  check(!momentOf(t3.transliterations.find(x => x.label === 'IPA-broad'))?.from,
        'a transliteration moved to another label is the annotator\'s');
}

console.log('\n5 · `from` is part of a moment\'s identity\n');
{
  const a = ctx._copyFieldProv('p1.s1'), b = ctx._copyFieldProv('p3.s1');
  b.time = a.time; b.date = a.date;
  check(ctx._provKeyOf(a) !== ctx._provKeyOf(b), 'same second, different sources: two moments');
  const plain = { annotator_id: 'ann_1', date: '2026-09-23', time: '10:00:00' };
  check(ctx._provKeyOf(plain) === ['ann_1', '', '2026-09-23', '10:00:00', '', ''].join('\u0001'),
        'a moment without `from` keys exactly as before, so existing files intern the same');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
