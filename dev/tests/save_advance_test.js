#!/usr/bin/env node
/* =============================================================================
   save_advance_test.js, save advances on annotation and stays on revision
   Run:  node dev/tests/save_advance_test.js
   =============================================================================
   B-065. D30 made Save mean "done with this one" and advance to the next token.
   That is right for a first pass. It is wrong for an edit: after changing
   something the annotator wants to land on the object and confirm the change
   took, and instead the app moved on and hid it.

   THE RULE: advance on ANNOTATION (the object had nothing, now it has
   something); stay on REVISION (the object already had content).

   Two things can rot here and neither is visible at runtime:

     1. the sample is taken AFTER the save writes, at which point every object
        looks annotated and nothing ever advances again;
     2. a new save path is added and nobody gates it.

   This guard executes the shipped hasAnnotation and reads the two save paths
   out of the source to check the ordering.
   ============================================================================= */

const vm = require('vm');
const { read, fnSrc: src } = require('./_source.js');
const _FILE = 'LingCoT.html';

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const html = read('LingCoT.html');
// The shared slicer, see _source.js. The local copies all closed on a default
// parameter's `{}` and returned a 41-character stub.
const fnSrc = name => src(_FILE, name);

/* D48 stage D: the field list is no longer written inside hasAnnotation, so the
   REAL table comes into the context. Stubbing it would let the predicate and
   the table disagree about which fields are annotation, which is the failure
   the stage exists to remove. */
const F = require('../../source/modules/field_spec.js');
const ctx = vm.createContext({ console, annotationKeys: F.annotationKeys });
/* B-083 split hasAnnotation into a loss question and a human-work question;
   its helpers come with it. */
/* fieldProv joins them at v3.14.225: _humanField resolves a field's
     provenance through the accessor now, so the interning can move the storage
     without touching its readers. */
  // v3.14.261: _humanField shares one derived test with provTipAttr now (B-137).
  for (const n of ['fieldProv', 'isDerived', '_humanField', '_fieldFilled', 'hasAnnotation'])
  vm.runInContext(fnSrc(n), ctx);
const { hasAnnotation } = ctx;

console.log('\nthe predicate separates a blank object from an annotated one\n');
{
  check(hasAnnotation({ form: 'ev' }) === false,
        'a bare token is not annotated, so its save advances');
  check(hasAnnotation({ form: 'ev', gloss: 'house' }) === true,
        'a glossed token is, so its save stays');
  check(hasAnnotation({ form: 'ev', part_of_speech: 'NOUN' }) === true,
        'a POS alone counts');
  check(hasAnnotation({ form: 'evler', morphemes: [{ form: 'ev' }, { form: 'ler', gloss: 'PL' }] }) === true,
        'so does a glossed morpheme below an otherwise bare word');
  check(hasAnnotation({ form: 'evler', morphemes: [{ form: 'ev' }, { form: 'ler' }] }) === false,
        'a bare morpheme split is not annotation, it is tokenization');
}

console.log('\na sentence is judged on its OWN fields, not its words\n');
{
  const sent = { text: 'Ev buyuk.', words: [{ form: 'Ev', gloss: 'house' }] };
  check(hasAnnotation(sent, false, false, 'sentence') === false,
        'deep=false ignores annotated words below an untouched sentence',
        '         otherwise a first sentence-level pass never advances');
  check(hasAnnotation(sent, true, false, 'sentence') === true,
        'the default is still deep, which is what B-057 re-tokenization needs');
  check(hasAnnotation({ text: 'Ev buyuk.', translations: [{ text: 'The house is big.' }] },
                      false, false, 'sentence') === true,
        'a sentence translation makes the next save a revision');
}

/* B-083: the predicate answers TWO questions and must answer them differently.
   Sampling at the right moment with the wrong question is exactly what shipped:
   every assertion above passed while Save refused to advance, because a word
   whose morphemes ensureMorphemesFromParse had auto-linked came back
   "annotated" before the annotator had touched it. */
console.log('\nderived work is not the annotator\'s work\n');
{
  const autoLinked = { form: 'evde', morphemes: [{ form: 'ev', dict_id: 'd1' }] };
  const derived    = { form: 'evde', gloss: 'house', field_prov: { gloss: { derived: true } } };
  const typed      = { form: 'evde', gloss: 'house' };
  const empty      = { form: 'evde' };

  // The loss question (B-057) must still count everything: a derived value that
  // vanishes has still vanished.
  check(hasAnnotation(autoLinked) === true, 'auto-linked morphemes DO count as something to lose');
  check(hasAnnotation(derived)    === true, 'so does a derived gloss');

  // The advance question (B-065) must count only what a person put there.
  check(hasAnnotation(autoLinked, true, true) === false,
        'but auto-linked morphemes are NOT the annotator\'s work',
        'this is B-083: Save saw a revision where there was a first annotation');
  check(hasAnnotation(derived, true, true) === false, 'and neither is a derived gloss');
  check(hasAnnotation(typed, true, true) === true,  'a typed gloss is');
  check(hasAnnotation(empty, true, true) === false, 'an empty word is not');

  // Legacy data carries no field_prov; someone still typed it.
  check(hasAnnotation({ gloss: 'house', field_prov: {} }, true, true) === true,
        'a value with no provenance counts as human — that is legacy data');
}

console.log('\nthe save paths sample BEFORE they write, and gate the advance\n');
/* B-083: both sites now pass human:true. The literal is pinned because the
   third argument is the whole fix — sampling the right moment with the wrong
   question is what shipped, and it looked correct at every other assertion. */
/* D48 stage D added the level. The exact call is asserted rather than a loose
   match, because passing the wrong level here is silent: a sentence read as a
   word finds none of its fields and every save looks like a first annotation. */
for (const [fn, sample] of [['saveWord', "hasAnnotation(word, true, true, 'word')"],
                            ['saveSentence', "hasAnnotation(sent, false, true, 'sentence')"]]) {
  const src = fnSrc(fn);
  const iSample  = src.indexOf('_wasAnnotated =');
  const iAdvance = src.indexOf('navAdvance(');
  check(iSample !== -1, `${fn} samples the pre-save state`);
  check(iSample !== -1 && src.slice(iSample, iSample + 80).includes(sample),
        `${fn} samples it with ${sample}`);
  check(iSample !== -1 && iAdvance !== -1 && iSample < iAdvance,
        `${fn} samples before it advances`,
        '         a sample taken after the write makes every object look annotated');
  check(/_wasAnnotated \? null : navAdvance\(/.test(src),
        `${fn} gates navAdvance on it`);
  /* The write must not happen before the sample. Both paths read their form
     fields first, so the first assignment to the object is the boundary. */
  const iWrite = src.search(/\n\s+(word|sent)\.\w+\s*=|deindexWordForms\(/);
  check(iWrite === -1 || iSample < iWrite,
        `${fn} samples before the first write to the object`,
        `         sample at ${iSample}, first write at ${iWrite}`);
}

console.log('\nno other save path advances\n');
{
  // v3.14.270: `saveNewDictEntry` retired; `openAddDict` is the route that
  // replaced it, and it must not advance either.
  for (const fn of ['saveParagraph', 'saveSection', 'saveDictEntry', 'openAddDict']) {
    const src = fnSrc(fn);
    check(!src.includes('navAdvance('),
          `${fn} returns to a parent view rather than advancing`,
          '         if it starts advancing it needs the B-065 gate too');
  }
}

/* ── D48 stage D: the level is passed, and it matters ───────────────────────
   A word with no parse and a morpheme are the same shape. The old predicate
   read one list for both and could not tell them apart; the new one asks the
   table, so the level has to be right, and a wrong one is silent. */
console.log('\nthe level selects the field list\n');
{
  // `type` is core at morpheme level and is not a word field at all.
  check(hasAnnotation({ form: 'ler', type: 'bound.morpheme' }, true, false, 'morpheme') === true,
        'a morpheme with only a type is annotated — B-069 asks for it, so it counts');
  check(hasAnnotation({ form: 'ler', type: 'bound.morpheme' }, true, false, 'word') === false,
        'the same object read as a word is not, because type is not a word field');

  // translations belong to sentences and paragraphs, never to words.
  const tr = { translations: [{ text: 'the house' }] };
  check(hasAnnotation(tr, false, false, 'sentence') === true, 'a translation counts at sentence level');
  check(hasAnnotation(tr, false, false, 'word') === false, 'and is not a word field');

  /* aux is annotation. This is the whole of the stage-D decision: the question
     is "is there work here", not "is it finished", and the caller that matters
     is the prompt before re-tokenization discards a morpheme. A core-only list
     fails here, which is the point. */
  check(hasAnnotation({ transliterations: [{ label: 'IPA', text: 'ev' }] }, true, false, 'word') === true,
        'a transliteration is annotation, though it is aux');
  check(hasAnnotation({ comments: ['check this'] }, true, false, 'word') === true,
        'so is a comment');
  check(hasAnnotation({ lemma_id: 'lem_1' }, true, false, 'word') === true,
        'so is a lemma link a person made');
  check(hasAnnotation({ dep_rel: 'nsubj' }, true, false, 'word') === true,
        'and so is a dependency relation, which lives on another screen entirely');

  // An empty row somebody added and never filled is not annotation.
  check(hasAnnotation({ transliterations: [{ label: 'IPA', text: '' }] }, true, false, 'word') === false,
        'an empty transliteration row is not annotation');

  // head 0 is the root, and `!0` is why presence is the test.
  check(hasAnnotation({ head: 0 }, true, false, 'word') === true,
        'head 0 counts: it means root, and it is the value a truthiness test loses');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
