#!/usr/bin/env node
/* =============================================================================
   mono_link_test.js, single-morpheme words keep one value per linked field
   Run:  node dev/tests/mono_link_test.js
   =============================================================================
   mono-link (post-test item 3): in the word editor, a word with one morpheme
   has its gloss, part of speech and (same form only) transliteration linked to
   the morpheme's. This guard executes the data half: the load-time
   reconciliation and the readers that show a word's transliteration rows.
   The editor half is gui_crud_test.js scenario I.
   ============================================================================= */
const vm = require('vm');
const { fnSrc } = require('./_source.js');
let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('         ' + detail); }
};
const EVENTS = Array.from({ length: 10 }, (_, i) => ({ annotator_id: 'a', date: `2026-09-0${i}` }));
const ctx = { logged: [], S: { provEvents: EVENTS },
  /* The one writer of a field stamp, reduced to what this guard asserts:
     which moment (by index) ends up on which object. */
  stampField: (o, f, m) => {
    o.field_prov = o.field_prov || {};
    if (m === null) delete o.field_prov[f]; else o.field_prov[f] = EVENTS.indexOf(m);
  } };
ctx.logEvent = (...a) => ctx.logged.push(a.join(' '));
vm.createContext(ctx);
for (const fn of ['normForm', 'monoMorpheme', 'translitRowsOf', 'wordHasStoredTranslit',
                  '_reconcileMonoMorphemes', '_logMonoReconciled'])
  vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

const tr = text => [{ label: 'Pinyin', text, prov: 3 }];
const doc = words => [{ sections: [{ paragraphs: [{ sentences: [{ words }] }] }] }];
const run = docs => { ctx.__d = docs; return vm.runInContext('_reconcileMonoMorphemes(__d)', ctx); };

console.log('\nload-time reconciliation\n');
{
  // Mandarin shape: transliteration typed on the word, morpheme empty.
  const w1 = { form: '的', transliterations: tr('de'), field_prov: { transliterations: 7 },
               morphemes: [{ form: '的', transliterations: [], gloss: 'ATTR' }] };
  // Both hold the same transliteration: the word copy goes.
  const w2 = { form: '一', transliterations: tr('yī'),
               morphemes: [{ form: '一', transliterations: tr('yī') }] };
  // A typed word gloss with an empty morpheme gloss moves down.
  const w3 = { form: 'Adam', gloss: 'man', field_prov: { gloss: 4 }, part_of_speech: 'NOUN',
               morphemes: [{ form: 'adam' }] };
  // Archiphonemic morpheme: transliteration stays on the word.
  const w4 = { form: 'de', transliterations: [{ label: 'IPA', text: 'de' }],
               morphemes: [{ form: 'dA', part_of_speech: 'CONJ' }] };
  // Values that differ are left alone.
  const w5 = { form: '花', transliterations: tr('huā'),
               morphemes: [{ form: '花', transliterations: tr('hua1') }] };
  // Two morphemes: untouched.
  const w6 = { form: 'evde', gloss: 'at.home', transliterations: tr('evde'),
               morphemes: [{ form: 'ev' }, { form: 'de' }] };
  const n = run(doc([w1, w2, w3, w4, w5, w6]));

  check(w1.morphemes[0].transliterations[0]?.text === 'de' && !w1.transliterations.length,
        'a word-only transliteration moves to the morpheme');
  check(w1.morphemes[0].field_prov?.transliterations === 7 && !(w1.field_prov.transliterations >= 0),
        'and its stamp moves with it');
  check(!w2.transliterations.length && w2.morphemes[0].transliterations[0].text === 'yī',
        'an equal word copy is dropped');
  check(w3.morphemes[0].gloss === 'man' && w3.gloss === null && w3.morphemes[0].field_prov?.gloss === 4,
        'a typed word gloss moves to an empty morpheme gloss, stamp included');
  check(w3.morphemes[0].part_of_speech === 'NOUN',
        'a part of speech on the word only is copied to the morpheme');
  check(w4.transliterations[0].text === 'de' && !(w4.morphemes[0].transliterations || []).length,
        'a morpheme of another form (dA) does not take the word\'s transliteration');
  check(w4.part_of_speech === 'CONJ', 'but its part of speech is copied up');
  check(w5.transliterations[0].text === 'huā' && w5.morphemes[0].transliterations[0].text === 'hua1',
        'differing values are left as they are');
  check(w6.gloss === 'at.home' && w6.transliterations.length === 1,
        'a word of two morphemes is not touched');
  check(n.translits === 2 && n.glosses === 1 && n.pos === 2, 'and the counts say so', JSON.stringify(n));

  const again = run(doc([w1, w2, w3, w4, w5, w6]));
  check(!again.glosses && !again.translits && !again.pos, 'a second pass changes nothing (idempotent)',
        JSON.stringify(again));
}

console.log('\nthe readers see the moved value\n');
{
  ctx.__w = { form: '的', transliterations: [], morphemes: [{ form: '的', transliterations: tr('de') }] };
  check(vm.runInContext('translitRowsOf(__w)[0].text', ctx) === 'de',
        'translitRowsOf returns the lone morpheme\'s rows');
  check(vm.runInContext('wordHasStoredTranslit(__w)', ctx) === true,
        'and the interlinear legend does not call it derived');
  ctx.__w2 = { form: 'evde', transliterations: [], morphemes: [{ form: 'ev', transliterations: tr('ev') }, { form: 'de' }] };
  check(vm.runInContext('translitRowsOf(__w2).length', ctx) === 0,
        'a word of two morphemes still has no rows of its own');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
