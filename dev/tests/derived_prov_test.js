#!/usr/bin/env node
/* =============================================================================
   derived_prov_test.js, inherited values are not signed by the annotator
   Run:  node dev/tests/derived_prov_test.js
   =============================================================================
   B-061. saveDictEntry copies a gloss, and a morphological parse, from a
   dictionary entry onto the word being annotated. The human did not type either
   one, so neither may carry their provenance. In a corpus whose point is
   knowing who claimed what, an inherited gloss that reads as hand-written is a
   quiet falsehood that accumulates at annotation speed.

   Reading the source for the string `_derivedFieldProv` would pass on a call
   that is never reached. So this guard cuts the back-propagation block out of
   the shipped saveDictEntry, runs it against a bare word with stubbed
   neighbours, and inspects what it wrote.
   ============================================================================= */

const vm = require('vm');
const { fnSrc, read } = require('./_source.js');
const _FILE = 'LingCoT.html';

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

/* v3.14.267, B-058. This used to slice the block out of `saveDictEntry` by two
   text markers, because the back-propagation lived inline there — and in a
   third of a copy inside `saveNewDictEntry`, which is the bug. It is one
   function now, so it is run rather than sliced, and the guard is stronger for
   the same reason the fix was worth making: there is one thing to run. */
const block = null;   // kept out of scope deliberately; nothing slices any more

// ── Harness ──────────────────────────────────────────────────────────────────
const HUMAN = { annotator_id: 'ann_real', annotator: 'Real Person', date: '2026-08-28', time: '10:00' };
let word;
const ctx = vm.createContext({
  console,
  prov: () => ({ ...HUMAN }),
  findWord: () => ({ word, sent: { id: 's1' } }),
  applyProvToObj: o => { o.prov = { ...HUMAN }; },
  ensureMorphemesFromParse: () => {},
  _setWordLemma: (w, id) => { w.lemma_id = id; },
});
vm.runInContext(fnSrc(_FILE, '_derivedFieldProv'), ctx);
vm.runInContext(fnSrc(_FILE, 'backPropagate'), ctx);
/* v3.14.261, B-137: the back-propagation writes through `stampField`. Stubbed
   un-interned: this guard asserts WHICH moment reaches the field. */
ctx.stampField = (o, f, m) => { if (!o.field_prov) o.field_prov = {};
  if (m == null) delete o.field_prov[f]; else o.field_prov[f] = m; };

// Run it once against an empty word and a filled-in dict entry.
function run(entry) {
  word = { id: 'w1', form: 'evde' };
  ctx.entry = entry; ctx.word = word;
  vm.runInContext('backPropagate(entry, word, { id: "s1" })', ctx);
  return word;
}

const w = run({
  type: 'word', gloss: 'house-LOC', constituent_forms: ['ev', 'de'], lemma_id: 'L1',
});

// ── The two inherited fields ─────────────────────────────────────────────────
check(w.gloss === 'house-LOC', 'gloss is inherited at all', `got ${w.gloss}`);
check(w.morphological_parse === 'ev-de', 'parse is seeded from constituent_forms',
      `got ${w.morphological_parse}`);

for (const f of ['gloss', 'morphological_parse']) {
  const p = (w.field_prov || {})[f];
  check(!!p, `${f} carries field provenance at all`);
  check(p && p.derived === true, `${f} is marked derived`,
        `field_prov.${f} = ${JSON.stringify(p)}`);
  check(p && p.annotator_id === null, `${f} is not attributed to the annotator`,
        `annotator_id = ${p && p.annotator_id}`);
}

/* The object-level stamp is a different claim: it records who last touched the
   word, and the human did initiate this save. It must still name them. */
check(w.prov && w.prov.annotator_id === 'ann_real',
      'object-level prov still names the human who saved', JSON.stringify(w.prov));

// ── A word that already has values must not be overwritten ───────────────────
word = { id: 'w1', form: 'evde', gloss: 'mine', morphological_parse: 'e-v-de' };
ctx.entry = { type: 'word', gloss: 'theirs', constituent_forms: ['ev', 'de'] };
ctx.word  = word;
vm.runInContext('backPropagate(entry, word, { id: "s1" })', ctx);
check(word.gloss === 'mine' && word.morphological_parse === 'e-v-de',
      'existing values are left alone (fill-only)', JSON.stringify(word));
check(!word.field_prov, 'no provenance is written when nothing is inherited');

/* ── B-058: ONE tail, and both handlers run it ─────────────────────────────
   `saveDictEntry` copied the gloss and seeded the parse; `saveNewDictEntry` did
   neither, so creating an entry from a token and editing one left the token in
   different states and nothing recorded that as a choice. D48 stage B4 narrowed
   it to this tail without closing it. Closed v3.14.267 by there being one. */
{
  /* v3.14.270: `saveNewDictEntry` retired with `renderDictAdd` (D51 stage 5),
     so the two handlers B-058 was about are one handler and one panel route.
     Both still go through the one tail, which is the claim. */
  const { decomment } = require('./_source.js');
  check(!/function saveNewDictEntry\s*\(/.test(read(_FILE)),
        'saveNewDictEntry is gone — the second creation handler with it');
  for (const fn of ['saveDictEntry', 'openAddDict']) {
    const body = decomment(fnSrc(_FILE, fn) || '');
    check(/backPropagate\(/.test(body),
          `${fn} gives the token back through the one tail`,
          '       a second inline copy is how the two drifted for four months');
    /* And neither carries its own: an inline assignment here is the defect
       returning under a different name. */
    check(!/\bw\.gloss\s*=|\bword\.gloss\s*=/.test(body),
          `${fn} does not inherit the gloss by hand`,
          '       fill-only or not, a second writer is a second behaviour');
  }

  /* The morpheme enrich is deliberately NOT under the type guard: enriching a
     word's morphemes from a bound-morpheme entry is exactly what that pass is
     for, and `saveDictEntry` used to skip it — the same asymmetry pointing the
     other way. Executed, because the guard structure is the whole claim. */
  ctx.__ran = 0;
  ctx.ensureMorphemesFromParse = () => { ctx.__ran++; };
  const m = run({ type: 'bound.morpheme', gloss: 'LOC', lemma_id: 'L9' });
  check(ctx.__ran === 1, 'a bound-morpheme entry still enriches the word\'s morphemes',
        '       that pass is what a morpheme entry is FOR');
  check(!m.gloss, 'but does not give the word its gloss',
        '       a morpheme\'s gloss is not the word\'s');
  check(!m.lemma_id, 'and does not give it a lemma, which only a word entry names');
  ctx.ensureMorphemesFromParse = () => {};
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
