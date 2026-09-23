#!/usr/bin/env node
/* =============================================================================
   sent_key_test.js, which sentences count as "the same text" (D40 stage A)
   Run:  node dev/tests/sent_key_test.js
   =============================================================================
   D40 decision 3: sentences match on folded text, so case, punctuation and the
   spacing between tokens do not block an offer. Spacing INSIDE a token does:
   `sularıda` and `suları da` are different words.

   The index is a lazy cache on `_dataGen` and `_foldGen`. Section 3 holds it to
   both: a mutation or a change of corpus language must rebuild it, and nothing
   else should. Section 4 is B-057's case, two identical sentences.
   ============================================================================= */

const vm = require('vm');
const { read, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* The real fold from normalize.js. The locale is switchable so section 3 can
   change it the way refreshFoldContext does. */
const N = require('../../source/modules/normalize.js');
let LOCALE = 'tr';
const ctx = vm.createContext({
  S: { docs: [] }, _dataGen: 0, _foldGen: 0, console,
  normForm: f => N.dictKeyIn(String(f || ''), LOCALE, 'Latn'),
});
vm.runInContext('var _sentTextIdx = { gen: -1, fold: -1, map: new Map() }; var _sentKeyMemo = new WeakMap();', ctx);
for (const fn of ['sentKey', '_sentKeyOf', 'sentTextIndex', 'sameTextSentences']) {
  const src = fnSrc('LingCoT.html', fn);
  check(!!src, `${fn}() is defined`);
  if (src) vm.runInContext(src, ctx, { filename: fn + '.js' });
}
const key = t => ctx.sentKey(t);

console.log('\n1 · what folds and what does not\n');
{
  const base = 'Soğuktur suları da, Hasan, bir tas içilmez.';
  check(key(base) === key('soğuktur SULARI da Hasan bir tas içilmez'),
        'case and punctuation do not count');
  check(key(base) === key('  Soğuktur   suları da ,Hasan ,  bir tas içilmez !'),
        'spacing around punctuation and between tokens does not count');
  check(key(base) !== key('Soğuktur sularıda, Hasan, bir tas içilmez.'),
        'a space inside a token does: sularıda is not suları da');
  check(key('İÇİLMEZ') === key('içilmez') && key('ISLAK') === key('ıslak'),
        'Turkish dotted and dotless i fold by the corpus language');
  check(key('ISLAK') !== key('islak'), 'and do not collapse into each other');
  check(key('...') === '' && key('') === '', 'punctuation only has no key');
}

console.log('\n2 · the index finds the other sentences, never the sentence itself\n');
const mk = (id, text) => ({ id, text, words: [] });
const s1 = mk('d1.s1', 'Soğuktur suları da, Hasan, bir tas içilmez.');
const s2 = mk('d1.s2', 'Drama köprüsü dar Hasan geçilmez');
const s3 = mk('d1.s3', 'soğuktur suları da Hasan bir tas içilmez');
const s4 = mk('d2.s1', 'Soğuktur suları da, Hasan, bir tas içilmez!');
const s5 = mk('d2.s2', '—');
ctx.S.docs = [
  { sections: [{ paragraphs: [{ sentences: [s1, s2] }, { sentences: [s3] }] }] },
  { sections: [{ paragraphs: [{ sentences: [s4, s5] }] }] },
];
{
  const got = ctx.sameTextSentences(s1);
  check(JSON.stringify(got) === JSON.stringify(['d1.s3', 'd2.s1']),
        `s1 matches s3 and the sentence in the other document, in corpus order (${got})`);
  check(ctx.sameTextSentences(s2).length === 0, 'a sentence with no twin matches nothing');
  check(ctx.sameTextSentences(s5).length === 0, 'a punctuation-only sentence matches nothing');
  const bare = ctx.sameTextSentences('soğuktur suları da hasan bir tas içilmez');
  check(bare.length === 3, `a bare text, as the add form asks, finds all three (${bare.length})`);
}

console.log('\n3 · the cache rebuilds on a mutation or a fold change, not otherwise\n');
{
  const m1 = ctx.sentTextIndex();
  check(ctx.sentTextIndex() === m1, 'with nothing changed the same map is returned');

  s2.text = 'Soğuktur suları da Hasan bir tas içilmez';
  check(ctx.sameTextSentences(s1).length === 2, 'an edit without a mutation is not seen (the cache idiom)');
  ctx._dataGen++;
  check(ctx.sameTextSentences(s1).length === 3, 'after the mutation the edited sentence is found');

  /* Under a non-Turkish fold, I lower-cases to i, so these two meet. */
  const a = mk('d3.s1', 'ISLAK'), b = mk('d3.s2', 'islak');
  ctx.S.docs.push({ sections: [{ paragraphs: [{ sentences: [a, b] }] }] });
  ctx._dataGen++;
  check(ctx.sameTextSentences(a).length === 0, 'Turkish fold: ISLAK and islak differ');
  LOCALE = 'en';
  check(ctx.sameTextSentences(a).length === 0, 'a fold change without _foldGen is not seen');
  ctx._foldGen++;
  /* Both directions: asking from `a` alone passes against a stale index by
     coincidence, because b's old key is a's new one. */
  check(JSON.stringify(ctx.sameTextSentences(a)) === '["d3.s2"]' &&
        JSON.stringify(ctx.sameTextSentences(b)) === '["d3.s1"]',
        'after refreshFoldContext bumps _foldGen, both the memo and the index re-key');
  LOCALE = 'tr'; ctx._foldGen++;
}

console.log('\n4 · B-057: two identical sentences are two entries\n');
{
  const x = mk('d4.s1', 'Aynı cümle.'), y = mk('d4.s2', 'Aynı cümle.');
  ctx.S.docs.push({ sections: [{ paragraphs: [{ sentences: [x, y] }] }] });
  ctx._dataGen++;
  check(JSON.stringify(ctx.sameTextSentences(x)) === '["d4.s2"]' &&
        JSON.stringify(ctx.sameTextSentences(y)) === '["d4.s1"]',
        'each finds the other; neither is dropped');
}

console.log('\n5 · wiring\n');
{
  const rf = fnSrc('LingCoT.html', 'refreshFoldContext') || '';
  check(/_foldGen\+\+/.test(rf), 'refreshFoldContext bumps _foldGen');
  const writers = (read('LingCoT.html').match(/_sentTextIdx\s*=/g) || []).length;
  check(writers === 2, `_sentTextIdx is assigned only at its declaration and in sentTextIndex (${writers})`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
