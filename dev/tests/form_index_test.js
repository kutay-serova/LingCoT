#!/usr/bin/env node
/* =============================================================================
   form_index_test.js, the form index has ONE identity rule
   Run:  node dev/tests/form_index_test.js
   =============================================================================
   D53 stage A · B-144. `S.wordFormRefs` and `S.morphFormRefs` were keyed on the
   raw form while every dictionary lookup keyed on `normForm` (B-043) and D40
   settles identity there too. Two rules for one question.

   The five `normForm` calls were not the fix — a sixth site would have been free
   to forget. Three accessors own the maps, and section 1 is what makes that
   true rather than merely current.

   Section 3 runs against the real corpus, because the interesting number is not
   "folding works" but "how much this corpus was losing": the Turkish fable's
   content words were each split in two by a sentence-initial capital, and
   Mandarin lost nothing at all, which is why nobody saw it.
   ============================================================================= */

const vm = require('vm');
const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');
const { requireCorpus } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const ACCESSORS = ['formRefMap', 'addFormRef', 'removeFormRef', 'formRefs', 'clearFormRefs'];

console.log('\n1 · nothing outside the accessors touches the maps\n');
{
  const owners = new Set(ACCESSORS);
  const stray = [];
  for (const [name, src] of [['LingCoT.html', read('LingCoT.html')], ...moduleFiles()]) {
    /* Marks and matches must be indexed into the SAME string. The first draft
       read `@fn` markers from the raw source and matched uses in the decommented
       one, then looked the owner up with `indexOf(..., 0)` — which returns the
       first occurrence in the file for every match alike, so every use was
       attributed to whichever function held the first one. It reported no
       strays while a deliberate one sat inside `indexWordForms`. */
    const clean = decomment(src);
    const marks = [...clean.matchAll(/function (\w+)\s*\(/g)];
    const ownerOf = idx => {
      let last = null;
      for (const m of marks) { if (m.index > idx) break; last = m[1]; }
      return last;
    };
    for (const m of clean.matchAll(/S\.(wordFormRefs|morphFormRefs)\b/g)) {
      // The declaration in the S literal is not a use.
      if (/:\s*new Map/.test(clean.slice(m.index, m.index + 40))) continue;
      const fn = ownerOf(m.index);
      if (!owners.has(fn)) stray.push(`${name}: S.${m[1]} in ${fn || '(top level)'}`);
    }
  }
  check(stray.length === 0, 'the two maps are reached only through the accessors',
        '       ' + stray.join('\n       ')
        + '\n       B-144 was five raw keys; the sixth site is what the accessors exist to stop');
  for (const fn of ACCESSORS)
    check(!!fnSrc('LingCoT.html', fn), `${fn}() is defined`);
  /* The fold is in ONE place, or the accessors are just a longer way to spell
     the same divergence. */
  const folding = ACCESSORS.filter(fn => /normForm\(/.test(fnSrc('LingCoT.html', fn) || ''));
  check(folding.length >= 3, `the fold happens inside the accessors (${folding.join(', ')})`);
}

console.log('\n2 · executed: fold on the way in AND on the way out\n');
{
  const S = { wordFormRefs: new Map(), morphFormRefs: new Map() };
  /* The REAL fold, from normalize.js, tailored to Turkish. A `toLowerCase()`
     stub would have been a different rule: `İ`.toLowerCase() is `i` plus a
     combining dot, which is B-043's whole subject and B-120's bug. A guard that
     approximates the key it is testing is checking its own approximation. */
  const N = require('../../source/modules/normalize.js');
  const ctx = vm.createContext({ S, console,
    normForm: f => N.dictKeyIn(String(f || ''), 'tr', 'Latn') });
  for (const fn of [...ACCESSORS, 'indexWordForms', 'deindexWordForms', 'findExamplesOnDemand'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  const w1 = { id: 'w1', form: 'Tilki', morphemes: [{ id: 'w1.m1', form: 'Tilki' }] };
  const w2 = { id: 'w2', form: 'tilki', morphemes: [{ id: 'w2.m1', form: 'tilki' }] };
  ctx.__w = w1; vm.runInContext('indexWordForms(__w)', ctx);
  ctx.__w = w2; vm.runInContext('indexWordForms(__w)', ctx);

  check(S.wordFormRefs.size === 1, `one key for both capitalisations (${S.wordFormRefs.size})`,
        '       B-144: Tilki and tilki were two words as far as this index knew');
  ctx.__f = 'Tilki';
  check(vm.runInContext("formRefs('word', __f)", ctx).length === 2,
        'and both occurrences come back');
  ctx.__f = 'TİLKİ';
  check(vm.runInContext("findExamplesOnDemand(__f, 'word')", ctx).length === 2,
        'the READER folds too, however the dictionary entry spells it',
        '       folding the writer alone moves the miss instead of fixing it — and makes it total');
  check(S.morphFormRefs.size === 1, 'morphemes are keyed the same way');

  /* Round trip. A deindex that misses leaves a ref under a folded key, and a
     folded key is far more likely to be FOUND — so the stale entry that used to
     hide now gets shown as an example of a word that is gone. */
  ctx.__w = w1; vm.runInContext('deindexWordForms(__w)', ctx);
  ctx.__w = w2; vm.runInContext('deindexWordForms(__w)', ctx);
  check(S.wordFormRefs.size === 0 && S.morphFormRefs.size === 0,
        'index then deindex leaves both maps empty',
        '       a bucket that never empties is a stale example under a key that now resolves');
}

console.log('\n3 · what this corpus was losing\n');
{
  const fs = require('fs'), path = require('path');
  const file = requireCorpus();   // an absolute path to one corpus file
  check(!!file, 'a corpus fixture is available');
  {
    {
      const nf = x => String(x || '').normalize('NFC').toLowerCase();
      const raw = new Set(), folded = new Set(), mraw = new Set(), mfolded = new Set();
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const o = JSON.parse(line);
        if (o.record_type === 'prov_events' || o.record_type === 'journal_head') continue;
        for (const sec of o.sections || []) for (const par of sec.paragraphs || [])
          for (const sen of par.sentences || []) for (const w of sen.words || []) {
            raw.add(w.form); folded.add(nf(w.form));
            for (const m of w.morphemes || []) { mraw.add(m.form); mfolded.add(nf(m.form)); }
          }
      }
      const lost = raw.size - folded.size, mlost = mraw.size - mfolded.size;
      console.log(`       ${path.basename(file)}: words ${raw.size} raw / ${folded.size} folded, `
                + `morphemes ${mraw.size} raw / ${mfolded.size} folded`);
      /* Not "lost must be > 0": Mandarin has no case and loses nothing, and a
         guard that demanded a split would fail on the corpus where the defect
         cannot occur. What is asserted is the RELATION — folding never invents
         keys — plus the count being reported, so the next reader sees it. */
      check(folded.size <= raw.size && mfolded.size <= mraw.size,
            `folding never adds keys (words −${lost}, morphemes −${mlost})`);
      check(folded.size > 0, 'and the corpus actually has forms in it, so this is not vacuous');
    }
  }
}

console.log('\n4 · D53 stage C: the strip promises exactly what the annotator gets\n');
{
  /* THE property. `_deriveWordFields` writes the joins and `derivePreviewHtml`
     reads them; two copies of a join fail quietly — the strip says one thing and
     the save does another, which is worse than no strip. So both go through the
     same three functions, and this executes them against one word rather than
     reading either. */
  const ctx = vm.createContext({ console, linkNote: () => {} });
  for (const fn of ['joinParse', 'joinGloss', 'joinTranslit', '_deriveWordFields', 'wordGloss'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  const ms = [{ form: 'ev', gloss: 'house', transliterations: [{ text: 'ev' }] },
              { form: 'de', gloss: 'LOC',   transliterations: [{ text: 'de' }] }];
  ctx.__ms = ms;
  const promised = {
    morphological_parse: vm.runInContext('joinParse(__ms)', ctx),
    gloss:               vm.runInContext('joinGloss(__ms)', ctx),
    transliterations:    vm.runInContext('joinTranslit(__ms)', ctx),
  };
  check(promised.gloss === 'house-LOC' && promised.morphological_parse === 'ev-de'
     && promised.transliterations === 'ev-de',
        `the joins produce what a reader would expect (${JSON.stringify(promised)})`);
  /* `joinTranslit` survives D32 and changes readers: `wordTranslit` computes it
     at READ time and nothing stores it, so it has no preview strip. The two
     below are what the save still writes. */

  // Now the WRITE, in the mode saveWord uses, with the fields left empty.
  ctx.__w = { id: 'w1', form: 'evde', morphemes: ms, gloss: null,
              morphological_parse: null, transliterations: [] };
  vm.runInContext("_deriveWordFields(__w, { mode: 'overwrite', explicit: {} })", ctx);
  /* D60/B-176, v3.14.347. The gloss joins the transliteration: nothing stores it,
     so the promise the strip makes about it is no longer "the save writes this"
     but "left empty, this is what you will read". `derivePreviewHtml` says which
     of the two it means (`hint.derive.shown` vs `hint.derive.will`), and the
     promise is kept by `wordGloss`, not by the save.

     The rigour is unchanged and the target moved: one join, computed once, and
     what the annotator was shown must be what they get. Two copies of a join
     fail quietly whichever end holds them. */
  check((ctx.__w.gloss ?? null) === null,
        'the save stores NO gloss — the join is composed on read (B-176)',
        `       wrote ${JSON.stringify(ctx.__w.gloss)} — storing the join is what made this`
        + '\n       field mean two things, and made clearing it impossible');
  check(vm.runInContext('wordGloss(__w)', ctx) === promised.gloss,
        'and the reader shows exactly what the strip promised',
        `       promised ${promised.gloss}, reads ${vm.runInContext('wordGloss(__w)', ctx)}`);
  check(ctx.__w.morphological_parse === promised.morphological_parse,
        'and the parse');
  check(Array.isArray(ctx.__w.transliterations) && ctx.__w.transliterations.length === 0,
        'and the empty transliteration list is left exactly as it was (D32, v3.14.303)',
        `       got ${JSON.stringify(ctx.__w.transliterations)} — the join is computed at read\n`
        + '       time; storing it is what made the field mean two things');

  /* A typed value wins, and the strip must then promise nothing — a preview
     under a filled field would predict a derivation that is not going to happen. */
  const prev = decomment(fnSrc('LingCoT.html', 'derivePreviewHtml'));
  check(/if \(\(current \|\| ''\)\.trim\(\)\) return ''/.test(prev),
        'the strip is silent when the field is filled in',
        '       the deriver takes an explicit value over a join, so a preview there is a false promise');
  /* The call is not the point, the USE is. The first draft matched
     `_morphRowsNow()` and passed while the result was computed and discarded —
     the same hole B-154's guard had, found the same way, by mutation. */
  const rowsVar = /(?:const|let)\s+(\w+)\s*=\s*_morphRowsNow\(\)/.exec(prev);
  check(!!rowsVar, 'the preview asks for the morpheme rows as typed');
  const msExpr = /const\s+ms\s*=([\s\S]*?);/.exec(prev);
  check(!!msExpr && rowsVar && new RegExp(`\\b${rowsVar[1]}\\b`).test(msExpr[1]),
        'and derives from them, not from the stored word',
        `       ms = ${(msExpr ? msExpr[1] : '?').trim()}\n`
        + '       the rows are what the save reads; previewing stored state promises the wrong data');

  /* Rule 4, structurally: the deriver must not carry its own copy of a join. */
  const der = decomment(fnSrc('LingCoT.html', '_deriveWordFields'));
  check(!/\.map\(m => m\.form\)\.join\('-'\)/.test(der)
     && !/parts\.join\('-'\)/.test(der),
        'and _deriveWordFields spells no join of its own',
        '       a second copy is how the strip and the save come to disagree');

  /* The repaint has to cover the fields the strip is drawn under AND the
     morpheme rows it derives from, or it is a snapshot pretending to be live. */
  const evts = decomment(read('modules/events.js'));
  check(/refreshDerivePreviews\(\)/.test(evts), 'something repaints the strips on input');
  check(/morph-gloss-input/.test(evts.slice(evts.indexOf('refreshDerivePreviews') - 400,
                                            evts.indexOf('refreshDerivePreviews') + 200)),
        'including when a morpheme gloss changes, which is what the join reads',
        '       repainting only on the word field leaves the promise stale as the rows are typed');

  // Every id the repaint knows about is an id the markup actually renders.
  const html = read('LingCoT.html');
  const ids = [...(/_DERIVE_PREVIEWS = \[[\s\S]*?\];/.exec(html)?.[0] || '')
                 .matchAll(/'(ew-[\w-]+)'/g)].map(m => m[1]);
  /* Two since v3.14.303: `transliterations` left when D32 stopped the save
     deriving one, because a strip promising a write that does not happen is
     worse than no strip — which is this section's own rule. */
  check(ids.length === 2, `the preview table names two fields (${ids.join(', ')})`);
  check(!ids.includes('ew-translit'),
        'and transliteration is not among them',
        '       nothing derives it on save any more, so there is nothing to promise');
  for (const id of ids)
    check(html.includes(`id="${id}-derive"`), `${id} has a host element in the markup`,
          '       a repaint target the render never draws is a strip that never appears');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
