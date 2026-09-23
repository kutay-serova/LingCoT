#!/usr/bin/env node
/* =============================================================================
   search_routing_test.js. Search-B's corpus-independent half
   Run:  node dev/tests/search_routing_test.js
   =============================================================================
   UNIFIED L-019. `search_matcher_test` and `search_concordance_test` assert
   hand-written Korean forms — `언어학` typed by hand — so they disable
   themselves when no Korean corpus is in the fixture set, which is every clone.
   Measured in the audit: forcing them to run against Turkish still passed 5 of
   15 matcher and 4 of 17 concordance assertions, because the empty-query,
   validation, routing, error-path and sort-order blocks never look at the
   language. **100% of both guards was off to protect two thirds of them.**

   THE SPLIT IS BY FILE, and it has to be. `run_all.sh` reports one state per
   file — passed, failed, disabled — so a guard that runs four of seventeen
   assertions can only lie in one direction or the other: exit 0 and claim to
   have checked the matcher, or exit 2 and throw away four real results. Two
   files, two honest states.

   THE CORPUS HERE IS SYNTHETIC AND THAT IS THE POINT. These claims are about
   what the query compiler does with a query, not about what any language
   contains, so building the corpus in this file makes them independent of the
   fixture set for good — including of the gate-1 swap (D58), after which the
   golden half re-points at Mandarin and this half does not move.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT        = path.resolve(__dirname, '..', '..');
const HTML_FILE   = path.join(ROOT, 'source', 'LingCoT.html');
const SEARCH_JS   = path.join(ROOT, 'source', 'modules', 'search.js');
const SEARCH_B_JS = path.join(ROOT, 'source', 'modules', 'search.js');

// ─── Minimal DOM/window stubs (search.js touches these only inside fn bodies) ──
const _noop = () => {};
const _elem = new Proxy({}, { get: () => _noop, set: () => true });
global.document = { getElementById: () => _elem, querySelector: () => _elem,
                    querySelectorAll: () => [], createElement: () => _elem,
                    addEventListener: _noop };
global.window    = { addEventListener: _noop };
global.navigator = { onLine: true, language: 'en' };
global.render = _noop; global.logEvent = _noop; global.go = _noop;
global.setTimeout = () => 0; global.clearTimeout = _noop;
global.alert = _noop; global.confirm = () => false;
// tb-strings: search.js messages come from the locale.
const _EN = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', '..', 'source', 'resources', 'locale', 'en.json'), 'utf8'));
global.t = (k, vars) => (_EN[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => (vars && vars[n] !== undefined ? vars[n] : ''));

global._dataGen = 0;
global.mutate   = () => { global._dataGen++; };
global.S        = { docs: [], dictionary: [], dictByLemmaId: new Map(),
                    translitLabels: new Set(), posValues: new Set(), morphTypes: new Set() };

function sliceFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('sliceFn: cannot find ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const hoist = s => s.replace(/^let /gm, 'var ').replace(/^const /gm, 'var ');

const htmlSrc = fs.readFileSync(HTML_FILE, 'utf8');
const appJs   = (htmlSrc.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];
const helpers = ['wordGloss', 'wordTranslit', 'normForm'].map(n => sliceFn(appJs, n)).join('\n');
try {
  vm.runInThisContext(helpers, { filename: 'lingcot-helpers.js' });
  vm.runInThisContext(hoist(fs.readFileSync(SEARCH_JS, 'utf8')),   { filename: 'search.js' });
  vm.runInThisContext(hoist(fs.readFileSync(SEARCH_B_JS, 'utf8')), { filename: 'search.js' });
} catch (e) {
  console.error('Context assembly failed:', e.message, '\n', e.stack);
  process.exit(1);
}

/* Two sentences, ASCII, no transliterations and no dictionary. Deliberately
   uninteresting: every assertion below is about routing, and a corpus with
   anything notable in it would invite assertions that belong in the golden
   guard. */
const w = (i, form, gloss) => ({ id: `d.s.p.s1.w_${i}`, form, gloss });
global.S.docs = [{
  id: 'd', record_type: 'document', metadata: { language: 'xx' },
  sections: [{ id: 'd.s', paragraphs: [{ id: 'd.s.p', sentences: [
    { id: 'd.s.p.s1', text: 'alpha beta', translations: [{ text: 'one two' }],
      words: [w(1, 'alpha', 'ALPHA'), w(2, 'beta', 'BETA')] },
    { id: 'd.s.p.s2', text: 'gamma', translations: [],
      words: [w(3, 'gamma', 'GAMMA')] },
  ] }] }],
}];

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
function test(name, fn) {
  try { fn(); check(true, name); }
  catch (e) { check(false, name, `         ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

console.log('\nSearch-B routing and validation — no language assumed\n');

test('empty query → no hits, no error', () => {
  const r = runSearch({ query: '   ', field: 'text', level: 'word' });
  assert(r.hits.length === 0 && r.error === null, 'empty handled');
});

test('sentence-level >1 <BREAK> → error, and the message names it', () => {
  const r = runSearch({ query: 'a <BREAK> b <BREAK> c', field: 'text', level: 'sentence' });
  assert(r.error && /BREAK/.test(r.error), 'break error surfaced');
});

test('lemma field with an empty dictionary → no hits, no error', () => {
  const r = runSearch({ query: 'alpha', field: 'lemma', level: 'word' });
  assert(r.hits.length === 0 && r.error === null, 'no lemmas → empty, not a throw');
});

test('a query nothing matches → empty result set, no spurious hits', () => {
  const r = runSearch({ query: 'zzzznotacorpusword', field: 'text', level: 'word' });
  assert(r.hits.length === 0, `no spurious hits, got ${r.hits.length}`);
});

/* The routing claims are only worth anything if the engine CAN hit on this
   corpus — otherwise "no hits" above is true for the wrong reason, which is the
   degenerate pass B-125 fixed in `dep_root_test`. */
test('the engine reaches this corpus at all — a control for the four above', () => {
  const r = runSearch({ query: 'alpha', field: 'text', level: 'word' });
  assert(r.error === null, `unexpected error: ${r.error}`);
  assert(r.hits.length === 1, `expected 1 hit, got ${r.hits.length}`);
});

test('sentence level searches sentence text, not tokens', () => {
  const r = runSearch({ query: 'alpha beta', field: 'text', level: 'sentence' });
  assert(r.error === null && r.hits.length === 1, `got ${r.hits.length} hit(s), error ${r.error}`);
});

test('a field the corpus leaves empty yields nothing rather than throwing', () => {
  const r = runSearch({ query: 'anything', field: 'translit', level: 'word' });
  assert(r.error === null, `errored instead of returning empty: ${r.error}`);
  assert(r.hits.length === 0, 'no transliterations in this corpus');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
