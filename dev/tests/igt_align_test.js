#!/usr/bin/env node
/* =============================================================================
   igt_align_test.js, the gloss line carries one element per morpheme
   Run:  node dev/tests/igt_align_test.js
   =============================================================================
   B-059. `wordGloss` joined morpheme glosses after `filter(Boolean)`, so an
   un-glossed morpheme was dropped without a placeholder:

       parse  git-ti-m      (3 morphemes)
       gloss  go-1SG        (2 elements)

   Leipzig rule 2 asks the two lines to carry the same number of
   hyphen-separated elements, and a partly glossed word is the normal state of a
   corpus in progress, so the app produced misaligned IGT as a matter of course.
   Worse, the two-element output is indistinguishable from a genuinely
   two-morpheme word: the reader cannot tell that anything is missing.

   THE RULE: a rendered gloss line has one element per morpheme, and the gap is
   RENDERED, never STORED. Stored emptiness is what D34's missing-annotation
   panel counts.

   The second half of that rule is why `gaps` is opt-in: search, the concordance
   index and the PUNCT comparison must keep seeing the stored value.
   ============================================================================= */

const vm = require('vm');
const { read, decomment, fnSrc: src } = require('./_source.js');
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

const gapM = html.match(/const GLOSS_GAP = '([^']+)'/);
const ctx = vm.createContext({ GLOSS_GAP: gapM && gapM[1], console });
vm.runInContext(fnSrc('wordGloss'), ctx);
vm.runInContext(fnSrc('joinGloss'), ctx);
vm.runInContext(fnSrc('storedWordGloss'), ctx);   // B-186: the migration asks it
vm.runInContext(fnSrc('_migrateDropDerivedWordGloss'), ctx);
const { wordGloss, _migrateDropDerivedWordGloss } = ctx;

const word = (...glosses) => ({
  form: 'gittim',
  morphemes: glosses.map((g, i) => g === null ? { form: `m${i}` } : { form: `m${i}`, gloss: g }),
});
const elems = s => (s || '').split('-').length;

console.log('\nthe reported case\n');
{
  const w = word('go', null, '1SG');
  check(wordGloss(w, { gaps: true }) === `go-${gapM[1]}-1SG`,
        `3 morphemes, middle un-glossed → go-${gapM[1]}-1SG`,
        `         got ${wordGloss(w, { gaps: true })}`);
  check(elems(wordGloss(w, { gaps: true })) === w.morphemes.length,
        'element count equals morpheme count, which is Leipzig rule 2');
  check(wordGloss(word('go', '1SG'), { gaps: true }) === 'go-1SG',
        'and a genuinely 2-morpheme word still gives 2 elements');
  check(wordGloss(w, { gaps: true }) !== wordGloss(word('go', '1SG'), { gaps: true }),
        'so the two are no longer indistinguishable, which was the real defect');
}

console.log('\nthe gap is rendered, never stored\n');
{
  const w = word('go', null, '1SG');
  check(wordGloss(w) === 'go-1SG',
        'without gaps the compact join is unchanged, so nothing downstream shifts');
  check(!JSON.stringify(w).includes(gapM[1]),
        'and asking for the rendered form does not write into the word',
        '         a stored placeholder makes an un-glossed morpheme look annotated to D34');

  const deriv = fnSrc('_deriveWordFields');
  check(!deriv.includes('GLOSS_GAP'),
        '_deriveWordFields does not know about the gap',
        '         a stored placeholder makes an un-glossed morpheme look annotated');
  /* B-176, and asked of the WHOLE source rather than of this one function: the
     defect was never that `_deriveWordFields` stored the join, it was that
     anything did. One composer, on read. A second writer anywhere puts the two
     meanings back in the field and `wordGloss` has no way to tell them apart. */
  const assemblers = [...decomment(html).matchAll(/\b\w*\.?gloss\s*=\s*joinGloss\s*\(/g)].map(m => m[0]);
  check(assemblers.length === 0,
        'and NOTHING in the source assembles a stored gloss from the morphemes (B-176)',
        `         found: ${assemblers.join(' , ')}\n`
      + '         the join is composed by wordGloss() at read time; storing it is\n'
      + '         what made the field mean two things and clearing it impossible');
}

console.log('\nedge cases that would each produce nonsense\n');
{
  check(wordGloss(word(null, null), { gaps: true }) === null,
        'no morpheme glossed at all → null, not ???-???',
        '         an untouched word must not look half-annotated');
  check(wordGloss({ form: 'ev', morphemes: [] }, { gaps: true }) === null,
        'no morphemes → null');
  check(wordGloss({ form: 'ev', gloss: 'house', morphemes: [] }, { gaps: true }) === 'house',
        'an unparsed word keeps its own gloss');
  check(wordGloss(word('go'), { gaps: true }) === 'go',
        'a single glossed morpheme is complete, not a gap');
}

console.log('\nan explicit word gloss wins over the derivation\n');
{
  const w = word('go', null, '1SG');
  w.gloss = 'went';                                  // the annotator typed this
  check(wordGloss(w, { gaps: true }) === 'went',
        'a word gloss that is not the compact join is the annotator\'s and is left alone');
  /* Until v3.14.347 this asserted the opposite: a stored value equal to the
     compact join was treated as the derivation and re-rendered with gaps, because
     `word.gloss` held both kinds of value and that comparison was the only way to
     tell them apart. D60/B-176 stopped storing the join, so a stored gloss is the
     annotator's by definition and the comparison is gone from `wordGloss`. */
  w.gloss = 'go-1SG';                                // typed, and equal to the join
  check(wordGloss(w, { gaps: true }) === 'go-1SG',
        'a typed gloss that happens to equal the join is still theirs, and wins',
        '         they typed it; the app no longer has a rival value to prefer');

  /* The reason that clause could go is the migration, not the renderer: legacy
     data written the old way is cleaned on the way in, so it reaches this
     function with no gloss and takes the gap path. Executed against the real
     migration rather than asserted about it. */
  const legacy = { id: 'w', form: 'gittim',
                   morphemes: [{ form: 'm0', gloss: 'go' }, { form: 'm1' }, { form: 'm2', gloss: '1SG' }],
                   gloss: 'go-1SG', field_prov: { gloss: 7 } };
  const docs = [{ sections: [{ paragraphs: [{ sentences: [{ words: [legacy] }] }] }] }];
  const dropped = _migrateDropDerivedWordGloss(docs);
  check(dropped === 1 && !('gloss' in legacy),
        'legacy data written as the join is dropped at load, not kept and guessed at',
        `         dropped ${dropped}, gloss ${JSON.stringify(legacy.gloss)}`);
  check(!(legacy.field_prov && 'gloss' in legacy.field_prov),
        'and its stamp goes with it, rather than describing a field that is gone');
  check(wordGloss(legacy, { gaps: true }) === `go-${gapM[1]}-1SG`,
        'so it still aligns — which is what the deleted clause was protecting',
        '         the protection moved from the renderer to the load, where it can\n'
      + '         be done once instead of guessed at on every read');

  const kept = { id: 'w2', form: 'öğleden',
                 morphemes: [{ form: 'öğle', gloss: 'noon' }, { form: 'den', gloss: 'ABL' }],
                 gloss: 'noon' };
  _migrateDropDerivedWordGloss([{ sections: [{ paragraphs: [{ sentences: [{ words: [kept] }] }] }] }]);
  check(kept.gloss === 'noon',
        'a gloss that differs from the join is a judgement about the word, and stays',
        '         this is one of the four that survive across both live corpora');
}

console.log('\ngaps are opt-in, and the right callers opted in\n');
{
  const src = html;
  const OPTED = [
    ['the LaTeX gloss line',      /formatGlossForLatex\(wordGloss\(w, \{ gaps: true \}\)/],
    ['the LaTeX per-word branch', /const g = wordGloss\(w, \{ gaps: true \}\)/],
    /* `\s*` after the key: this read `gloss: ` with one literal space and failed
       at v3.14.360 when the object was re-aligned to take a second field. The
       claim is that the tier asks for gaps, not how its author spaced it. */
    ['the PDF\/IGT tier',          /gloss:\s*wordGloss\(w, \{ gaps: true \}\)/],
    ['the word view',             /wordGloss\(word, \{ gaps: true \}\)/],
    ['the sentence IGT',          /const gloss = wordGloss\(w, \{ gaps: true \}\)/],
  ];
  for (const [label, re] of OPTED) check(re.test(src), `${label} asks for gaps`);

  check(/wordGloss\(w\) !== 'PUNCT'/.test(src),
        'the PUNCT comparison did NOT opt in',
        '         it compares against a stored value, not a rendered one');

  /* v3.14.388: this read `modules/search.js` and asked the question of a whole
     FILE. The merge put the matcher and the result-card RENDERER in one file, and
     a renderer opting in is correct — `renderSearchResults` draws IGT and must
     show the gaps. So the question is asked of the matcher's own functions, which
     is what its label always claimed. */
  const matcherSrc = ['_runTokenSearch', '_runConcat', '_runLemmaSearch', '_runSentenceRx',
                      '_runSentCross', '_runSentCrossSplit', 'runSearch']
    /* `src` is shadowed in this block by the HTML source string, so the two-arg
       accessor is reached under its own name. */
    .map(fn => { try { return require('./_source.js').fnSrc('modules/search.js', fn); }
                 catch { return ''; } }).join('\n');
  check(matcherSrc.length > 500, 'the matcher functions are there to read',
        `         got ${matcherSrc.length} characters — the names may have moved again`);
  check(!/wordGloss\([^)]*gaps/.test(matcherSrc),
        'the matcher and the search index did NOT opt in',
        '         a search over rendered placeholders matches text nobody typed');
  check(/wordGloss\(w, \{ gaps: true \}\)/.test(read('modules/search.js')),
        'while the result-card renderer in the same file DOES',
        '         if this fails the check above has stopped being a distinction');
}

console.log('\nB-073 — a hyphen inside a gloss is reported, not rewritten\n');
{
  const deriv = fnSrc('_deriveWordFields');
  check(/note\.link\.gloss_hyphen/.test(deriv),
        'the derivation warns when a morpheme gloss contains a hyphen');
  check(/_hyphenated\.length && ms\.length > 1/.test(deriv),
        'and only when there is more than one morpheme, since a lone one cannot misalign');
  check(!/replace\([^)]*\\\\-/.test(deriv) && !/escape/i.test(deriv),
        'and the annotator\'s text is not rewritten',
        '         escaping would store characters nobody typed, in a field nothing parses');

  const en = JSON.parse(read('resources/locale/en.json'));
  check(typeof en['note.link.gloss_hyphen'] === 'string',
        'the note has a locale entry');
  check(/morphemes themselves are unaffected/i.test(en['note.link.gloss_hyphen'] || ''),
        'and it says the data is fine, which is the part that stops a needless edit');
}

console.log('\nD53 stage F — the two choices, now decided rather than incidental\n');
{
  const { read, decomment, fnSrc, moduleFiles } = require('./_source.js');

  /* 1 · `-` inside a gloss: WARN, NEVER REWRITE (decided v3.14.301).
     The app must not edit the annotator's text to protect a line count — `a lot-ACC`
     is a real gloss and Leipzig uses the hyphen inside one. The warning above is
     already asserted; what is guarded here is the absence of a rewrite. */
  const der = decomment(fnSrc('LingCoT.html', '_deriveWordFields'));
  check(!/\.replace\([^)]*-[^)]*\)/.test(der) && !/escapeGloss|sanitizeGloss/.test(der),
        'the deriver rewrites no gloss to protect the element count',
        '       decided v3.14.301: warn, never rewrite; the control is the annotator\'s');
  const joinG = decomment(fnSrc('LingCoT.html', 'joinGloss'));
  check(!/replace|escape/.test(joinG), 'and neither does the join it goes through');

  /* 2 · SEARCH MATCHES THE COMPACT GLOSS, not the gapped one (documented
     v3.14.301). `???` is a rendering, and a rendering must not be findable text:
     searching for the placeholder would return every partly-glossed word in the
     corpus as though `???` were an annotation somebody made.

     This was true by accident — no caller stated it — so it is asserted here and
     the reason is written down. */
  const files = [['LingCoT.html', read('LingCoT.html')], ...moduleFiles()];
  const searchMatchers = [];
  for (const [name, src] of files) {
    if (!/search/.test(name)) continue;
    for (const m of decomment(src).matchAll(/matches\(wordGloss\(([^)]*)\)\)/g))
      searchMatchers.push({ name, arg: m[1] });
  }
  /* v3.14.388: the floor was 3 and two of those sites were the retired engine's
     `runTokenSearch` / `runLemmaSearch`, deleted with it. Two remain, in the
     surviving matcher, and the floor is what stops the sweep below from checking
     nothing — so it moves with the code rather than being left where it would
     pass by counting something that no longer exists. */
  check(searchMatchers.length >= 2,
        `${searchMatchers.length} search sites match on a word gloss`,
        '       if this collapses the sweep below is checking nothing');
  const gapped = searchMatchers.filter(m => /gaps/.test(m.arg));
  check(gapped.length === 0,
        'and none of them matches the GAPPED form',
        `       ${gapped.map(m => m.name + ': ' + m.arg).join(', ')}\n`
        + '       ??? is a rendering; making it findable would return every partly\n'
        + '       glossed word as though the placeholder were an annotation');

  /* And the other direction: the RENDERERS do pass gaps, or the alignment this
     whole guard is about is lost where a reader would see it. */
  const igt = decomment(fnSrc('LingCoT.html', 'buildLatexLinguex'));
  check(/wordGloss\(w, \{ gaps: true \}\)/.test(igt),
        'the IGT export still renders the gaps it must');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
