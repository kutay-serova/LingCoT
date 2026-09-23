#!/usr/bin/env node
/* =============================================================================
   translit_model_test.js, D32 — one transliteration model
   Run:  node dev/tests/translit_model_test.js
   =============================================================================
   D32 asked "is a word's transliteration authored or derived" and the honest
   answer was "both, indistinguishably": `_deriveWordFields` STORED the morpheme
   join under a minted `Translit` label, the same label was minted when a person
   typed one, and `saveWord` signed both as theirs.

   Decided v3.14.303, against the corrected corpus (B-141 ✅ v3.14.280 is what
   made the evidence trustworthy — before it, 93% of the elements were machine
   output wearing an author's signature):

     1. the derivation is COMPUTED AT READ TIME and never stored, so a stored
        element is always something a person wrote;
     2. a label is RAW FREE TEXT with an autocomplete recommendation — not
        folded, not a vocabulary — and every label in the project is offered
        back, so a second spelling is a choice rather than an accident.

   Sections 1 and 2 are those two decisions. Section 3 is what they bought:
   B-045, B-093 and B-142 were one mismatch at two levels.
   ============================================================================= */

const vm = require('vm');
const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');
const F = require('../../source/modules/field_spec.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\n1 · the join is computed at read time and never stored\n');
{
  const ctx = vm.createContext({ console, linkNote: () => {} });
  for (const fn of ['joinParse', 'joinGloss', 'joinTranslit', '_deriveWordFields', 'wordTranslit'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  const ms = [{ form: 'ev', gloss: 'house', transliterations: [{ label: 'RR', text: 'ev' }] },
              { form: 'de', gloss: 'LOC',   transliterations: [{ label: 'RR', text: 'de' }] }];

  /* The read path answers, and has all along — which is why storing it was a
     second writer of one value rather than the only one. */
  ctx.__w = { id: 'w', form: 'evde', morphemes: ms };
  check(vm.runInContext('wordTranslit(__w)', ctx) === 'ev-de',
        'wordTranslit joins the morphemes at read time');

  // And the save writes nothing, however much there is to join.
  ctx.__w = { id: 'w2', form: 'evde', morphemes: ms, transliterations: [] };
  const d = vm.runInContext("_deriveWordFields(__w, { mode: 'overwrite', explicit: {} })", ctx);
  check(ctx.__w.transliterations.length === 0,
        'and the deriver stores none',
        '       a stored derivation is what made `transliterations` mean two things');
  check(!d.has('transliterations'),
        'nor reports one as derived, because it derived nothing');

  /* Structural, so the branch cannot come back quietly: the deriver must not
     mention the field at all. */
  const der = decomment(fnSrc('LingCoT.html', '_deriveWordFields'));
  check(!/word\.transliterations\s*=/.test(der),
        'the deriver assigns no transliteration anywhere in its body',
        '       D32: this field is written by applyForm, and joined by wordTranslit');

  /* The one writer, and it is the shared one — so the word level gets B-138's
     per-element reconciliation instead of a whole-array replacement. */
  const save = decomment(fnSrc('LingCoT.html', 'saveWord'));
  check(/applyForm\('word', word,[\s\S]{0,300}transliterations/.test(save),
        'saveWord writes the list through applyForm, like comments',
        '       assignList matches elements by CONTENT, so an untouched one keeps its stamp');
  check(/readTransliterationsEditor\('ew-translit'\)/.test(save),
        'and reads it from the shared editor');
}

console.log('\n2 · a label is raw free text, offered back from every level\n');
{
  /* B-145: harvesting from words and morphemes only meant a label typed at
     paragraph, sentence or entry level was never offered back — so the two
     spellings in `samples/turkish-test` could not have been prevented. RAW is
     the decision; OFFERED is the obligation that comes with it. */
  const S = { translitLabels: new Set(), posValues: new Set(), morphTypes: new Set() };
  const ctx = vm.createContext({ S, console });
  for (const fn of ['indexTranslitLabels', '_indexWordLabels'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  ctx.__o = { transliterations: [{ label: 'Test System', text: 'x' }] };
  vm.runInContext('indexTranslitLabels(__o)', ctx);
  ctx.__w = { transliterations: [{ label: 'test system', text: 'y' }], morphemes: [] };
  vm.runInContext('_indexWordLabels(__w)', ctx);
  check(S.translitLabels.size === 2,
        `two spellings stay two labels (${[...S.translitLabels].join(', ')})`,
        '       decided v3.14.303: raw free text — the app does not adjudicate what a project means');
  check(S.translitLabels.has('Test System'),
        'and a label from a NON-word level is harvested',
        '       B-145: harvesting two levels of five is why the divergence was unpreventable');

  /* Every level that can hold one must feed the pool. Read off the index
     builders rather than restated, so a new level cannot be forgotten silently. */
  const idx  = decomment(fnSrc('LingCoT.html', 'buildCorpusIndex'));
  const dict = decomment(fnSrc('LingCoT.html', 'buildDictIndex'));
  const calls = (idx.match(/indexTranslitLabels\(/g) || []).length;
  check(calls >= 4, `the corpus index harvests at ${calls} levels`,
        '       document, section, paragraph, sentence — words and morphemes go through _indexWordLabels');
  check(/indexTranslitLabels\(/.test(dict), 'and the dictionary index harvests too');

  // The pool is what turns "raw" into a recommendation rather than a free-for-all.
  const pools = decomment(read('LingCoT.html'));
  check(/translit_label:\s*\(\)\s*=>\s*\[\.\.\.S\.translitLabels\]/.test(pools),
        'AC_POOLS.translit_label offers the harvested set back');
  const rowSrc = decomment(read('modules/participants.js'));
  check(/class="translit-label ac-input" data-ac-pool="translit_label"/.test(rowSrc),
        'and every label input asks for it',
        '       raw text without the recommendation is B-145 with extra steps');
}

console.log('\n3 · one editor, at every level that declares one\n');
{
  /* B-045 and B-093 were one mismatch at two levels: a field declared
     `translits` and drawn as a single box, which could not carry a label, could
     not hold a second system, and at word level could not be CLEARED (B-142). */
  for (const [level, fn] of [['word', 'renderWordEdit'], ['morpheme', 'morphEditRowsHtml']]) {
    const src = decomment(fnSrc('LingCoT.html', fn) || '');
    check(/renderTransliterationsEditor\(/.test(src),
          `${level} draws the shared multi-label editor`);
    const f = F.fieldsOf(level).find(x => x.key === 'transliterations');
    check(f && !f.blocked, `${level}.transliterations is no longer blocked`,
          '       B-093 carried `blocked: D32` from v3.14.262 until v3.14.303');
    check(f && (f.domId || f.domSel), `${level}.transliterations names its element`);
  }

  /* B-142: clearing. The editor drops a row with neither label nor text, so an
     emptied field reaches the save as an empty list — where the single box's
     value simply fell through a guard and the old value stayed, silently. */
  /* v3.14.404: this asserted the literal `filter(t => t.label || t.text)` inside
     `readTransliterationsEditor`. I2 moved that predicate into `ROW_EDITORS`, and
     the guard failed while the behaviour was unchanged — **L-006's finding
     happening to this guard**: an assertion against source text breaks when the
     code is consolidated, and reports a defect that does not exist. So it runs
     the predicate now. The descriptor evaluates on its own: `build` refers to the
     row builders inside closures, so nothing is called at definition time. */
  const _pj = read('modules/participants.js');
  const _i  = _pj.indexOf('const ROW_EDITORS = {');
  let _d = 0, _j = _pj.indexOf('{', _i);
  for (let k = _j; k < _pj.length; k++) {
    if (_pj[k] === '{') _d++;
    else if (_pj[k] === '}') { _d--; if (!_d) { _j = k + 1; break; } }
  }
  const RE = vm.runInNewContext(_pj.slice(_i, _j) + '; ROW_EDITORS');
  check(RE.translit.keep({ label: '', text: '' }) === false,
        'an emptied row is dropped, so the field can be cleared (B-142)',
        '       the old box fell through `else if (!length)` and left the value in place');
}

console.log('\n4 · the legend says "derived" only when it is (B-210)\n');
{
  const ctx = vm.createContext({});
  vm.runInContext(fnSrc('LingCoT.html', 'wordHasStoredTranslit'), ctx);
  const has = w => vm.runInContext('wordHasStoredTranslit', ctx)(w);
  check(has({ transliterations: [{ label: 'IPA', text: "so'ɰuk" }] }), 'a typed transliteration is stored, not derived');
  check(!has({ transliterations: [], morphemes: [{ transliterations: [{ text: 'so' }] }] }),
        'a word with only morpheme transliterations has none stored');
  check(has({ transliteration: 'legacy' }), 'the pre-v3.14.303 scalar still counts');
  const legend = read('LingCoT.html').match(/legend-translit"><\/div><div class="igt-legend-label">([^\n]*)/);
  check(legend && /wordHasStoredTranslit\(words\[i\]\)/.test(legend[1]) && !/!words\[i\]\.transliteration\b/.test(legend[1]),
        'the legend asks wordHasStoredTranslit, not the legacy scalar alone');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
