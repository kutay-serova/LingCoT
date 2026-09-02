#!/usr/bin/env node
/* =============================================================================
   dep_parse_test.js. D25 P1 dependency-parse logic tests
   Run:  node dev/tests/dep_parse_test.js
   =============================================================================
   Exercises the pure (DOM-free) half of the dependency-parse implementation:
   id-suffix extraction, head resolution, the has-parse predicate, and the
   dangling-head sweep that runs after a re-tokenization.

   The functions under test are extracted from source/LingCoT.html by regex so
   this file can never drift from the implementation, if a function is renamed
   or deleted, extraction fails loudly rather than testing a stale copy.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');

/* Pull a top-level `function name(..) { .. }` out of the source by brace
   matching from its opening brace.  Simple and sufficient: these four
   functions contain no template literals or regexes with unbalanced braces. */
function extract(name) {
  const start = SRC.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`extract: function ${name} not found in LingCoT.html`);
  let i = SRC.indexOf('{', start), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`extract: unbalanced braces in ${name}`);
}

const NAMES = ['depLocalId', 'depResolveHead', 'depHasParse', '_depSweepHeads'];
const ctx = {};
new Function(NAMES.map(extract).join('\n') + `\nreturn {${NAMES.join(',')}};`)
  .call(null) && Object.assign(ctx,
    new Function(NAMES.map(extract).join('\n') + `\nreturn {${NAMES.join(',')}};`)());

const { depLocalId, depResolveHead, depHasParse, _depSweepHeads } = ctx;

/* ── Tiny assertion harness ─────────────────────────────────────────────── */
let pass = 0, fail = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

/* Both id formats that exist in the wild. */
const INGEST = 'doc_1777181860383.sec_001.p_001.s_001.w_001';   // corpus_ingest.py
const SAVED  = 'doc_1777181860383.sec_001.p_001.s_001.w002_x7q'; // saveSentence

const mkSent = words => ({ id: 'doc_1.sec_001.p_001.s_001', words });
const mkWord = (n, form, extra = {}) =>
  ({ id: `doc_1.sec_001.p_001.s_001.w_${String(n).padStart(3, '0')}`, form, ...extra });

console.log('\ndepLocalId');
eq(depLocalId(INGEST), 'w_001',    'ingest-style id → suffix');
eq(depLocalId(SAVED),  'w002_x7q', 'saveSentence-style id → suffix');
eq(depLocalId('w_001'), 'w_001',   'bare suffix passes through');
eq(depLocalId(null),   '',         'null id → empty string');
eq(depLocalId(undefined), '',      'undefined id → empty string');

console.log('\ndepLocalId uniqueness within a sentence');
{
  const s = mkSent([mkWord(1, 'a'), mkWord(2, 'b'), mkWord(3, 'c')]);
  const suffixes = s.words.map(w => depLocalId(w.id));
  eq(new Set(suffixes).size, 3, 'three tokens yield three distinct suffixes');
}

console.log('\ndepResolveHead');
{
  const s = mkSent([mkWord(1, 'Yaşlı'), mkWord(2, 'köpek'), mkWord(3, 'uyudu')]);
  eq(depResolveHead(s, 'w_002').form, 'köpek', 'resolves to the right token');
  eq(depResolveHead(s, 'w_009'), null, 'unknown suffix → null (dangling)');
  eq(depResolveHead(s, ''),      null, 'empty suffix → null');
  eq(depResolveHead(s, null),    null, 'null suffix → null');
}

console.log('\ndepHasParse');
eq(depHasParse(mkSent([mkWord(1, 'a'), mkWord(2, 'b')])), false,
   'bare tokens → no parse');
eq(depHasParse(mkSent([mkWord(1, 'a'), mkWord(2, 'b', { head: 'w_001' })])), true,
   'one assigned head → has parse');
eq(depHasParse(mkSent([mkWord(1, 'a', { head: null })])), true,
   'root (head === null) counts as parsed — key present is what matters');
eq(depHasParse(mkSent([mkWord(1, 'a', { dep_rel: 'nsubj' })])), true,
   'relation without head still counts');
eq(depHasParse(mkSent([mkWord(1, 'a', { dep_rel: '   ' })])), false,
   'whitespace-only relation does not count');
eq(depHasParse(mkSent([])), false, 'empty sentence → no parse');

console.log('\n_depSweepHeads — after a re-tokenization');
{
  // Token 3 was removed; token 2 pointed at it, token 1 pointed at token 2.
  const s = mkSent([
    mkWord(1, 'Yaşlı',  { head: 'w_002', dep_rel: 'amod'  }),
    mkWord(2, 'köpek',  { head: 'w_003', dep_rel: 'nsubj', field_prov: { head: { annotator: 'X' } } }),
  ]);
  eq(_depSweepHeads(s), 1, 'reports one cleared head');
  eq('head' in s.words[1], false, 'dangling head key deleted');
  eq(s.words[1].dep_rel, 'nsubj', 'relation is preserved — only the head was invalid');
  eq(s.words[1].field_prov.head, undefined, 'orphan head provenance removed');
  eq(s.words[0].head, 'w_002', 'still-valid head untouched');
}
{
  const s = mkSent([mkWord(1, 'uyudu', { head: null, dep_rel: 'root' })]);
  eq(_depSweepHeads(s), 0, 'root is never treated as dangling');
  eq(s.words[0].head, null, 'root head stays null');
}
{
  const s = mkSent([mkWord(1, 'a'), mkWord(2, 'b')]);
  eq(_depSweepHeads(s), 0, 'unparsed sentence sweeps cleanly');
  eq('head' in s.words[0], false, 'sweep does not introduce keys');
}
{
  // Survives the form-match preservation path: word objects carried across a
  // re-tokenization keep their ids, so their heads keep resolving.
  const kept = mkWord(1, 'köpek', { head: 'w_002', dep_rel: 'nsubj' });
  const s = mkSent([kept, mkWord(2, 'uyudu', { head: null, dep_rel: 'root' })]);
  eq(_depSweepHeads(s), 0, 'preserved word objects keep working heads');
}

console.log('\nrelation field uses the shared autocomplete, not <datalist>');
{
  /* v3.14.54 moved dep_rel off <datalist>.  The reason it had to move: WebKit, the only engine that ships here, will not reliably open a datalist on focus
     when the field is empty, and it ignores <option label> entirely, which is
     why the editor had to echo relation names into a span in the first place. */
  eq(/dep-rel-list/.test(SRC), false, 'no dep-rel-list datalist remains');
  eq(/function depRelDatalistHtml/.test(SRC), false, 'the datalist builder is gone');

  const row = SRC.slice(SRC.indexOf('class="edit-input ac-input dep-rel-input"'));
  const tag = row.slice(0, row.indexOf('>') + 1);
  eq(/\bac-input\b/.test(tag), true, 'relation input carries the AC_SELECTOR class');
  eq(/data-ac-pool="dep_rel"/.test(tag), true, 'relation input declares the dep_rel pool');
  eq(/\blist=/.test(tag), false, 'no list attribute left on the input');
  eq(/autocomplete="off"/.test(tag), true, 'native autofill suppressed so it cannot fight the widget');

  // AC_SELECTOR must actually cover it, or focus/input/keydown never fire.
  const sel = /const AC_SELECTOR = '([^']+)'/.exec(SRC)[1];
  eq(sel.includes('.ac-input'), true, 'AC_SELECTOR includes .ac-input');

  // The pool must exist and be keyed exactly as the input declares.
  eq(/dep_rel:\s*\(\)\s*=>\s*DEP_RELATIONS/.test(SRC), true, 'AC_POOLS.dep_rel is wired to DEP_RELATIONS');

  // The name echo survives the move, it names the committed value while the
  // dropdown is shut, which the dropdown itself cannot do.
  eq(/function depRelName/.test(SRC), true, 'depRelName retained');
  eq(/data-rel-name="es-dep-n-/.test(SRC), true, 'echo span still wired to its input');
}

console.log('\nsparseness — unparsed corpora gain no keys');
{
  const w = mkWord(1, 'a');
  eq(Object.keys(w).sort(), ['form', 'id'], 'bare word has only id + form');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
