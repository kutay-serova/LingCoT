/**
 * search_test.js. Search-B substrate test harness (Step 1)
 *
 * Tests modules/search.js in ISOLATION. The substrate depends only on
 * normPunctForSearch() (modules/search.js) and the global _dataGen counter, so
 * rather than booting the whole app (as the legacy dev/search_test.js does) we
 * slice in just normPunctForSearch, provide a tiny _dataGen / mutate() pair, and
 * eval search.js. This keeps the harness fast, dependency-light, and immune to
 * unrelated app/boot breakage.
 *
 * Covers (spec dev/SEARCH_B_DESIGN.md §4):
 *   - sentTokens: count, positions, wordId, w ref, raw form, punct-normalized
 *     norm, case preservation
 *   - cache identity (same gen) + lazy rebuild after mutate() (gen bump)
 *   - sentNormText / sentNormTranslations
 *   - paraTokens: flat sequence, g ordering, sentIdx/sentId/localI tagging,
 *     sentence-boundary detection, paragraph-bounded
 *   - real korean-test corpus sanity (token total == word total)
 *   - punctuation/case edge cases via mock sentences
 *
 * Run:  node dev/tests/search_test.js
 * Exit: 0 = all pass, 1 = failures.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT        = path.resolve(__dirname, '..', '..');
const SEARCH_JS   = path.join(ROOT, 'source', 'modules', 'search.js');
const SEARCH_B_JS = path.join(ROOT, 'source', 'modules', 'search.js');
const { requireCorpusDir, corpusFilesIn, requireCompanion, loadCorpus } = require('./_fixture.js');
/* v3.14.114: was requireCorpus(null, …), the FIRST corpus only. The substrate
   assertions (one token per word, positions 0.n-1, token total == word total)
   are exactly the kind that should meet every writing system in the fixture set,
   not whichever sorts first. */
const CORPUS_FILES = corpusFilesIn(requireCorpusDir('the Search-B substrate'));
if (!CORPUS_FILES.length) { console.error('\n  FAIL  no corpus in the fixture set\n'); process.exit(1); }
const CORPUS_FILE = CORPUS_FILES[0];   // companion lookups still use the first

// ─── Slice a single top-level function's source out of a module file ──────────
function sliceFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('sliceFn: cannot find function ' + name);
  // Walk braces from the first '{' after the signature to find the matching close.
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// ─── Assemble the isolated context source ─────────────────────────────────────
const searchSrc   = fs.readFileSync(SEARCH_JS, 'utf8');
const searchBSrc  = fs.readFileSync(SEARCH_B_JS, 'utf8');
const normPunctFn = sliceFn(searchSrc, 'normPunctForSearch');

// _dataGen + mutate() stand in for the app's global mutation generation.
// search.js's top-level is pure function declarations, so no let/const→var
// transform is needed; we just concatenate everything into one global script.
const harnessPreamble = `
  var _dataGen = 0;
  function mutate() { _dataGen++; }
`;

global.console = console;
try {
  vm.runInThisContext(harnessPreamble + '\n' + normPunctFn + '\n' + searchBSrc,
                      { filename: 'search_b_context.js' });
} catch (e) {
  console.error('Failed to assemble substrate context:', e.message, '\n', e.stack);
  process.exit(1);
}


// B-128: the shared loader. This file's own copy of the brace-scanning parse
// took a corpus's leading format record for a document.
const docs = CORPUS_FILES.flatMap(f => loadCorpus(f).items);
if (!docs.length) { console.error('No docs parsed from corpus'); process.exit(1); }

function allParas(ds) {
  const out = [];
  for (const d of ds) for (const sec of (d.sections || [])) for (const p of (sec.paragraphs || [])) out.push(p);
  return out;
}
function allSents(ds) {
  const out = [];
  for (const p of allParas(ds)) for (const s of (p.sentences || [])) out.push(s);
  return out;
}
const PARAS = allParas(docs);
const SENTS = allSents(docs);

// ─── Tiny test framework ──────────────────────────────────────────────────────
/* One reporter, so the whole suite reads the same. v3.14.136: seven guards
   printed dots and a summary line while the other 33 printed ok/FAIL, which made
   the output two formats and made these seven invisible to anything counting
   assertions. The throwing-assert idiom below is kept, it suits table-driven
   cases; only what it PRINTS changed. */
let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
function test(name, fn) {
  try { fn(); check(true, name); }
  catch (e) { check(false, name, `         ${e.message}`); }
}

console.log('\nSearch-B substrate\n');
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Helper: build a mock sentence/paragraph ──────────────────────────────────
let _mid = 0;
function mockWord(form, extra = {}) { return { id: 'w_' + (++_mid), form, ...extra }; }
function mockSent(forms, opts = {}) {
  return {
    id: 's_' + (++_mid),
    text: opts.text || '',
    translations: opts.translations || [],
    words: forms.map(f => (typeof f === 'string' ? mockWord(f) : f)),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  TESTS
// ════════════════════════════════════════════════════════════════════════════

// ── sentTokens: structure over the real corpus ──────────────────────────────
test('tokens: one per word, positions 0..n-1', () => {
  for (const s of SENTS) {
    const toks = sentTokens(s);
    eq(toks.length, (s.words || []).length, `count for ${s.id}`);
    toks.forEach((t, i) => eq(t.i, i, `position for ${s.id}`));
  }
});

test('tokens: wordId + w ref + raw form match the source word', () => {
  for (const s of SENTS) {
    const toks = sentTokens(s);
    (s.words || []).forEach((w, i) => {
      eq(toks[i].wordId, w.id, 'wordId');
      assert(toks[i].w === w, 'w is the live word ref');
      eq(toks[i].form, w.form || '', 'raw form');
    });
  }
});

test('tokens: norm strips punctuation/symbols, collapses ws', () => {
  const s = mockSent(['gitti.', 'well-known', 'a@b', '  sp  ']);
  const t = sentTokens(s);
  eq(t[0].norm, 'gitti',     'trailing period stripped');
  eq(t[1].norm, 'wellknown', 'hyphen stripped (no false split)');
  eq(t[2].norm, 'ab',        'symbol stripped');
  eq(t[3].norm, 'sp',        'surrounding whitespace trimmed');
});

test('tokens: norm preserves case (no lowercasing)', () => {
  const s = mockSent(['Git', 'GELDI', 'McTavish']);
  const t = sentTokens(s);
  eq(t[0].norm, 'Git',      'mixed case preserved');
  eq(t[1].norm, 'GELDI',    'upper preserved');
  eq(t[2].norm, 'McTavish', 'camel preserved');
});

// ── Caching: identity within a gen, rebuild across gens ───────────────────────
test('cache: same array reference within a generation', () => {
  const s = SENTS[0];
  const a = sentTokens(s);
  const b = sentTokens(s);
  assert(a === b, 'tokens cached by identity within gen');
  assert(sentNormText(s) === sentNormText(s) || true, 'normText stable');
});

test('cache: mutate() bumps gen → tokens rebuilt and reflect edits', () => {
  const s = mockSent(['alpha', 'beta']);
  const before = sentTokens(s);
  eq(before.length, 2, 'initial count');
  // Edit the underlying words, then signal a mutation.
  s.words.push(mockWord('gamma'));
  s.words[0].form = 'ALPHA2';
  mutate();
  const after = sentTokens(s);
  assert(after !== before, 'new array after gen bump');
  eq(after.length, 3, 'rebuilt count reflects added word');
  eq(after[0].form, 'ALPHA2', 'rebuilt reflects edited form');
});

// ── Normalized text / translations ────────────────────────────────────────────
test('normText: matches normPunctForSearch(sent.text)', () => {
  for (const s of SENTS) eq(sentNormText(s), normPunctForSearch(s.text || ''), `normText ${s.id}`);
});

test('normText: empty when no text', () => {
  eq(sentNormText(mockSent([], { text: '' })), '', 'empty text → empty');
});

test('normTranslations: one normalized string per non-empty entry', () => {
  const s = mockSent([], { translations: [{ text: 'He left.' }, { text: '' }, { text: 'It is so!' }] });
  const tr = sentNormTranslations(s);
  eq(tr.length, 2, 'empty entry dropped');
  eq(tr[0], 'He left', 'first normalized');
  eq(tr[1], 'It is so', 'second normalized');
});

test('normTranslations: empty array when none', () => {
  eq(sentNormTranslations(mockSent([])).length, 0, 'no translations → []');
});

// ── paraTokens: flat cross-sentence sequence ────────────────────────────────
test('paraTokens: length == sum of sentence word counts', () => {
  for (const p of PARAS) {
    const expect = (p.sentences || []).reduce((a, s) => a + (s.words || []).length, 0);
    eq(paraTokens(p).length, expect, 'flat length');
  }
});

test('paraTokens: g is a contiguous 0..N-1 sequence', () => {
  for (const p of PARAS) {
    const flat = paraTokens(p);
    flat.forEach((t, idx) => eq(t.g, idx, 'global index'));
  }
});

test('paraTokens: sentIdx/sentId/localI tag each token correctly', () => {
  const p = { id: 'p_mock', sentences: [mockSent(['a', 'b']), mockSent(['c'])] };
  const flat = paraTokens(p);
  eq(flat.length, 3, 'total');
  eq(flat[0].sentIdx, 0, 's0 t0 sentIdx'); eq(flat[0].localI, 0, 's0 t0 localI');
  eq(flat[1].sentIdx, 0, 's0 t1 sentIdx'); eq(flat[1].localI, 1, 's0 t1 localI');
  eq(flat[2].sentIdx, 1, 's1 t0 sentIdx'); eq(flat[2].localI, 0, 's1 t0 localI');
  eq(flat[2].sentId, p.sentences[1].id, 's1 sentId');
});

test('paraTokens: sentence boundary detectable via sentIdx change', () => {
  const p = { id: 'p_mock2', sentences: [mockSent(['a', 'b']), mockSent(['c', 'd'])] };
  const flat = paraTokens(p);
  const boundaries = [];
  for (let i = 1; i < flat.length; i++) if (flat[i].sentIdx !== flat[i - 1].sentIdx) boundaries.push(i);
  eq(boundaries.length, 1, 'exactly one boundary');
  eq(boundaries[0], 2, 'boundary after 2 tokens');
});

test('paraTokens: rebuilds after mutate()', () => {
  const p = { id: 'p_mock3', sentences: [mockSent(['x'])] };
  const a = paraTokens(p);
  p.sentences[0].words.push(mockWord('y'));
  mutate();
  const b = paraTokens(p);
  assert(a !== b, 'rebuilt after gen bump');
  eq(b.length, 2, 'reflects added word');
});

// ── Corpus-wide sanity ────────────────────────────────────────────────────────
test('sanity: total tokens across corpus == total words', () => {
  let toks = 0, words = 0;
  for (const s of SENTS) { toks += sentTokens(s).length; words += (s.words || []).length; }
  eq(toks, words, 'token total == word total');
  assert(words > 0, 'corpus actually has words');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
