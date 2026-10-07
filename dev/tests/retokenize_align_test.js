#!/usr/bin/env node
/* =============================================================================
   retokenize_align_test.js, re-tokenizing must not silently destroy annotation
   Run:  node dev/tests/retokenize_align_test.js
   =============================================================================
   B-057. Rebuilding a sentence's words reused an old object via
   `findIndex(first unused with the same form)`, a BAG match applied to a
   SEQUENCE edit. Three consequences, all silent:

     1. exact `===` meant lower-casing a sentence-initial word discarded its
        gloss, morphemes, lemma, dict link, POS and provenance;
     2. first-unused mis-attributed: deleting the FIRST of two identical tokens
        left the survivor holding the deleted one's annotation;
     3. the sentence-level twin keyed a Map by text with `if (!has)`, so a
        repeated sentence lost its words on a save that changed nothing.

   THE RULE: **an edit to a sequence must be aligned, and annotation must never
   be discarded without asking.**

   This guard EXECUTES the shipped alignTokens/hasAnnotation out of
   LingCoT.html. It is written deliberately before the save paths were changed:
   no guard in this suite executes saveSentence, saveSection or saveParagraph,
   and that gap is what let B-062 ship.
   ============================================================================= */

const vm   = require('vm');
const path = require('path');
const { SRC, read, fnSrc: src } = require('./_source.js');
const _FILE = 'LingCoT.html';

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Slice the real functions out of the shipped file and run them. A reimplementation
   here would test the reimplementation. */
const html = read('LingCoT.html');
// The shared slicer, see _source.js. The local copies all closed on a default
// parameter's `{}` and returned a 41-character stub.
const fnSrc = name => src(_FILE, name);

/* D48 stage D: hasAnnotation reads the field table rather than a list written
   inside it, so the REAL table is what comes into the context. This guard is
   about what survives re-tokenization, and stubbing the table here would let it
   pass while the shipped predicate protected a different set of fields. */
const F = require('../../source/modules/field_spec.js');
const ctx = vm.createContext({
  normForm: f => String(f || '').normalize('NFC').toLocaleLowerCase('tr').normalize('NFC'),
  annotationKeys: F.annotationKeys,
  logEvent: () => {}, t: (k, v) => k, confirm: () => true, console
});
for (const n of ['_lcsPairs', 'alignTokens', '_humanField', '_fieldFilled', 'hasAnnotation',
                 'alignMorphemes', '_afterPlan', 'unpairedMorphemes'])
  vm.runInContext(fnSrc(n), ctx);
const { alignTokens, hasAnnotation, alignMorphemes, unpairedMorphemes } = ctx;

const align = (oldForms, newForms) =>
  alignTokens(oldForms.map(f => ({ form: f })), newForms);

console.log('\nB-057 defect 1 — a case edit must keep its annotation\n');
{
  const r = align(['Uçak', 'uçar'], ['uçak', 'uçar']);
  check(r.pairs.length === 2 && r.unmatchedOld.length === 0,
        'lower-casing a sentence-initial word re-pairs, losing nothing',
        `         pairs=${JSON.stringify(r.pairs)} unmatchedOld=${JSON.stringify(r.unmatchedOld)}`);
  check(r.pairs.some(([o, n]) => o === 0 && n === 0),
        'and it pairs with ITS OWN token, not a neighbour');
  // the old rule, for contrast, must genuinely have failed
  check(!(['Uçak','uçar'].findIndex(f => f === 'uçak') !== -1),
        'the old exact rule really did miss it — this case is not vacuous');
}

console.log('\nB-057 defect 2 — order is preserved, not bag-matched\n');
{
  // delete the FIRST of two identical tokens: the survivor is new[0]
  const r = align(['kedi', 'kedi'], ['kedi']);
  check(r.pairs.length === 1, 'one pair for one surviving token');
  check(r.unmatchedOld.length === 1, 'exactly one old token is reported unmatched');
  // insertion in the middle must not shift everything
  const ins = align(['a', 'c'], ['a', 'b', 'c']);
  check(ins.pairs.length === 2
        && ins.pairs.some(([o, n]) => o === 0 && n === 0)
        && ins.pairs.some(([o, n]) => o === 1 && n === 2),
        'inserting a word keeps both neighbours aligned to themselves',
        `         got ${JSON.stringify(ins.pairs)} — a bag match would still work here, `
      + 'but a positional one would not');
  check(ins.unmatchedNew.length === 1 && ins.unmatchedNew[0] === 1,
        'and reports the inserted token as new');
  // deletion in the middle
  const del = align(['a', 'b', 'c'], ['a', 'c']);
  check(del.pairs.length === 2 && del.unmatchedOld.length === 1 && del.unmatchedOld[0] === 1,
        'deleting a middle word drops exactly that word');
}

console.log('\ntiering — an exact match is never surrendered to a fuzzy one\n');
{
  // 'KEDI' folds to the same key as 'kedi' under tr, but 'kedi' is exact.
  const r = align(['kedi', 'KEDI'], ['kedi', 'KEDI']);
  check(r.pairs.length === 2
        && r.pairs.some(([o, n]) => o === 0 && n === 0)
        && r.pairs.some(([o, n]) => o === 1 && n === 1),
        'both exact matches win before folding is considered',
        `         got ${JSON.stringify(r.pairs)}`);
}

console.log('\nhasAnnotation — bare tokens must NOT trigger a prompt\n');
{
  check(!hasAnnotation({ form: 'kedi', gloss: null, morphemes: [] }),
        'a freshly tokenized word carries nothing',
        '         if this is ever true, the confirmation fires on every save and '
      + 'gets dismissed unread — which is how the silent branches were tolerated');
  check(!hasAnnotation({ form: 'x', morphemes: [{ form: 'x' }] }),
        'a morpheme with no content is not annotation');
  for (const [label, w] of [
    ['gloss',        { form: 'a', gloss: 'cat' }],
    ['POS',          { form: 'a', part_of_speech: 'NOUN' }],
    ['lemma link',   { form: 'a', lemma_id: 'dict_1' }],
    ['dict link',    { form: 'a', dict_id: 'dict_1' }],
    ['parse',        { form: 'a', morphological_parse: 'a-b' }],
    ['translit',     { form: 'a', transliterations: [{ label: null, text: 'a' }] }],
    ['comment',      { form: 'a', comments: [{ text: 'hm' }] }],
    ['dep root',     { form: 'a', head: null }],
    ['dep rel',      { form: 'a', dep_rel: 'nsubj' }],
    ['morph gloss',  { form: 'a', morphemes: [{ form: 'a', gloss: 'cat' }] }],
  ]) check(hasAnnotation(w), `${label} counts as annotation`);

  check(hasAnnotation({ text: 'Evet.', words: [{ form: 'evet', gloss: 'yes' }] }),
        'a sentence counts when any of its words is annotated (defect 3)');
  check(!hasAnnotation({ text: 'Evet.', words: [{ form: 'evet' }] }),
        'and does not when they are bare');
}

console.log('\ndefect 3 — repeated sentences must each keep their own words\n');
{
  const oldSents = [
    { text: 'Evet.', words: [{ form: 'evet', gloss: 'yes(1)' }] },
    { text: 'Evet.', words: [{ form: 'evet', gloss: 'yes(2)' }] }
  ];
  const r = alignTokens(oldSents, ['Evet.', 'Evet.'], s => s.text);
  check(r.pairs.length === 2 && r.unmatchedOld.length === 0,
        'two identical sentences align to two, not one',
        `         pairs=${JSON.stringify(r.pairs)} — the old Map kept only the first`);
  const byIdx = Object.fromEntries(r.pairs.map(([o, n]) => [n, o]));
  check(byIdx[0] === 0 && byIdx[1] === 1,
        'and each keeps ITS OWN words rather than both getting the first');
}

console.log('\nB-075 — the same defect one level down, at the morphemes\n');
{
  /* Three sites paired parse segments to stored morphemes with an exact,
     case-sensitive `m.form === form`. Lower-casing a sentence-initial morpheme
     is the normal fix, and it paired with nothing: the row rendered blank and
     the save wrote the blank over the stored record.

     The loss was the WHOLE morpheme, not just its gloss, because saveWord's row
     literal takes id, transliterations, type, dict_id, prov and field_prov from
     the paired object. Both halves are asserted below. */
  const stored = () => [
    { id: 'w.m_001', form: 'Ev', gloss: 'house', dict_id: 'd1', type: 'root',
      transliterations: [{ label: 'T', text: 'ev' }], part_of_speech: 'NOUN',
      field_prov: { gloss: { annotator: 'K' } } },
    { id: 'w.m_002', form: 'de', gloss: 'LOC', dict_id: 'd2' },
  ];

  const paired = alignMorphemes(stored(), ['ev', 'de']);
  check(paired[0] && paired[0].id === 'w.m_001',
        'a case edit to the first morpheme still pairs with it',
        `         got ${paired[0] ? paired[0].id : 'null'} — the old rule got null`);
  check(paired[1] && paired[1].id === 'w.m_002', 'and the untouched one is unmoved');

  // The old rule, for contrast. If this ever stops failing, the fixture is wrong.
  check(!stored().find(m => m.form === 'ev'),
        'and the exact-match rule genuinely missed it, so the fix is not decoration');

  check(['gloss', 'dict_id', 'type', 'transliterations', 'field_prov', 'id']
          .every(k => paired[0][k] !== undefined),
        'the paired morpheme carries every field saveWord reads off it',
        '         id · transliterations · type · dict_id · prov · field_prov');

  console.log('');
  check(unpairedMorphemes(stored(), ['ev', 'de']).length === 0,
        'a case edit discards nothing, so no confirm fires',
        '         a prompt on every ordinary edit gets dismissed unread');
  const lost = unpairedMorphemes(stored(), ['de']);
  check(lost.length === 1 && lost[0].id === 'w.m_001',
        'deleting an annotated morpheme reports it as lost');
  check(unpairedMorphemes([{ form: 'ev' }, { form: 'de' }], ['de']).length === 0,
        'deleting a BARE morpheme reports nothing',
        '         hasAnnotation is what keeps the confirm rare enough to be read');

  console.log('');
  const src = fnSrc('saveWord');
  check(/unpairedMorphemes\(/.test(src) && /confirmAnnotationLoss\(_lostM/.test(src),
        'saveWord asks before discarding annotated morphemes');
  check(src.indexOf('confirmAnnotationLoss') < src.indexOf('deindexWordForms'),
        'and asks BEFORE it starts rebuilding',
        '         a confirm after the rebuild protects nothing');
  const { decomment } = require('./_source.js');
  check(!/find\(m => m\.form === form\)/.test(decomment(read('LingCoT.html'))),
        'no site is left on the exact-match rule',
        '         all three must move together: render and save pairing that\n'
      + '         disagree would show one row and save another');
}

/* Post-test item 4: a merge or split keeps the analysis. Guard 1 (forms must
   join exactly, ignoring case, apostrophe and hyphen), guard 2 (carried values
   stamped as carried), guard 3 (links, lemma and type not carried). */
{
  console.log('\nmerge and split carry annotation');
  const cctx = vm.createContext({
    normForm: f => String(f || '').normalize('NFC').toLocaleLowerCase('tr').normalize('NFC'),
    annotationKeys: F.annotationKeys,
    _derivedFieldProv: name => ({ annotator_id: null, annotator: name, date: 'd', time: 't', derived: true }),
    stampField: (o, k, m) => { (o.field_prov = o.field_prov || {})[k] = m; },
    console
  });
  for (const n of ['_lcsPairs', 'alignTokens', '_fieldFilled', 'joinParse', 'depLocalId',
                   '_retokKey', 'retokenizeCarryPlan', '_carriedProv', 'buildMergedWord',
                   'buildSplitWords', 'splitLoses', 'retokenizeRemapHeads'])
    vm.runInContext(fnSrc(n), cctx);
  const C = cctx;
  const plan = (oldWords, newForms) => {
    const a = C.alignTokens(oldWords, newForms);
    return C.retokenizeCarryPlan(oldWords, newForms, a.unmatchedOld, a.unmatchedNew);
  };
  const W = (id, form, extra) => ({ id: `s.${id}`, form, morphemes: [], ...extra });

  // The tester case: 走 annotated, 过 bare, merged into 走过.
  const zou = W('w002', '走', { morphemes: [{ id: 's.w002.m_001', form: '走', gloss: 'walk',
    transliterations: [{ label: 'Pinyin', text: 'zǒu' }], part_of_speech: 'VERB', type: 'word',
    dict_id: 'dict_zou' }], part_of_speech: 'VERB', lemma_id: 'lem_zou', dict_id: 'dict_zou' });
  const guo = W('w003', '过');
  const p1 = plan([W('w001', '人们'), zou, guo, W('w004', '她')], ['人们', '走过', '她']);
  check(p1.merges.length === 1 && p1.merges[0].newIdx === 1
        && p1.merges[0].oldIdxs.join() === '1,2' && !p1.splits.length,
        'M1  走 + 过 -> 走过 is planned as one merge of two old words');

  const mw = C.buildMergedWord([zou, guo], '走过', 's.w002_new');
  const m0 = mw.morphemes[0];
  check(mw.morphemes.map(m => m.form).join() === '走,过' && mw.morphological_parse === '走-过',
        'M2  the old words become the merged word\'s morphemes, in order');
  check(m0.gloss === 'walk' && m0.transliterations[0].text === 'zǒu' && m0.part_of_speech === 'VERB',
        'M3  gloss, transliteration and part of speech are carried');
  check(!m0.type && !m0.dict_id && !mw.lemma_id && !mw.dict_id,
        'M4  type, dictionary link and lemma are not carried (guard 3, decision 1)');
  check(m0.field_prov && m0.field_prov.gloss && m0.field_prov.gloss.derived
        && m0.field_prov.gloss.annotator === 'carried (merge)' && m0.field_prov.gloss.from === 's.w002',
        'M5  carried values are stamped as carried from the old word (guard 2)');
  check(m0.id === 's.w002_new.m_001' && mw.morphemes[1].id === 's.w002_new.m_002',
        'M6  morpheme ids follow the new word');

  const p2 = plan([W('a', 'İstanbul', { gloss: 'Istanbul' }), W('b', "'da", { gloss: 'LOC' })], ["İstanbul'da"]);
  check(p2.merges.length === 1, "M7  an apostrophe suffix merges: İstanbul 'da -> İstanbul'da");
  const p3 = plan([W('a', 'kahve', { gloss: 'coffee' }), W('b', 'altı', { gloss: 'under' })], ['kahvaltı']);
  check(!p3.merges.length && !p3.splits.length,
        'M8  an orthographic compound (kahve altı -> kahvaltı) is not a merge (guard 1)');
  const p4 = plan([W('a', 'ev', { gloss: 'house' }), W('b', 'de', { gloss: 'TOP' })], ['evde']);
  check(p4.merges.length === 1 && C.buildMergedWord([W('a', 'ev', { gloss: 'house' }), W('b', 'de', { gloss: 'TOP' })], 'evde', 'x')
        .morphemes[1].field_prov.gloss.annotator === 'carried (merge)',
        'M9  ev de -> evde merges, and the clitic\'s gloss arrives marked as carried, not confirmed');

  // Splits.
  const zouguo = W('w002', '走过', { morphemes: [
    { id: 's.w002.m_001', form: '走', gloss: 'walk', part_of_speech: 'VERB', dict_id: 'dict_zou' },
    { id: 's.w002.m_002', form: '过', gloss: 'PASS' }] });
  const p5 = plan([W('w001', '人们'), zouguo], ['人们', '走', '过']);
  check(p5.splits.length === 1 && p5.splits[0].newIdxs.join() === '1,2' && !p5.merges.length,
        'S1  走过 with morphemes 走-过 -> 走 过 is planned as a split');
  const sw = C.buildSplitWords(zouguo, ['走', '过'], ['s.n1', 's.n2']);
  check(sw[0].morphemes[0].gloss === 'walk' && sw[0].morphemes[0].dict_id === 'dict_zou'
        && sw[0].morphemes[0].id === 's.n1.m_001' && sw[1].morphemes[0].gloss === 'PASS',
        'S2  each morpheme record moves intact under its new word');
  check(sw[0].part_of_speech === 'VERB' && sw[0].field_prov.part_of_speech.annotator === 'carried (split)',
        'S3  the new word takes the morpheme\'s part of speech, stamped as carried');
  const evde = W('w1', 'evde', { morphemes: [{ form: 'ev', gloss: 'house' }, { form: 'dA', gloss: 'LOC' }] });
  check(!plan([evde], ['ev', 'de']).splits.length,
        'S4  a split along surface forms unlike the morpheme forms (dA) is left to the prompt');
  check(!C.splitLoses(zouguo) && C.splitLoses({ ...zouguo, lemma_id: 'l1' }),
        'S5  word-level work a split cannot hold (lemma, typed gloss, comments) is reported');

  // Dependency heads.
  const ren = W('w001', '人们', { head: 'w002', dep_rel: 'nsubj' });
  const zh = { ...zou, head: null, dep_rel: 'root' };
  const gh = { ...guo, head: 'w002', dep_rel: 'compound' };
  const merged = C.buildMergedWord([zh, gh], '走过', 's.w9');
  const sent = { words: [ren, merged] };
  const remap = new Map([['w002', merged], ['w003', merged]]);
  C.retokenizeRemapHeads(sent, remap, [{ word: merged, parts: [zh, gh] }]);
  check(ren.head === 'w9', 'D1  a head pointing at a merged word follows it');
  check(merged.head === null && merged.dep_rel === 'root',
        'D2  the merged word keeps its parts\' outward relation (here the root); the internal one is dropped');

  // Wiring.
  const ss = fnSrc('saveSentence');
  check(/retokenizeCarryPlan\(/.test(ss) && ss.indexOf('retokenizeCarryPlan') < ss.indexOf('confirmAnnotationLoss'),
        'W1  saveSentence plans the carry before deciding what would be lost');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
