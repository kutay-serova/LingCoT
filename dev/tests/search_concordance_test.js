#!/usr/bin/env node
/**
 * search_concordance_test.js — Search-B F3–F6: KWIC, frequency, sort, collocates
 * =============================================================================
 * WHAT THESE FOUR BUILDERS DO, AND WHERE THEY GO WRONG. They consume `runSearch`
 * hits and turn them into what the annotator reads: a concordance line with a
 * node and its context, a type/distribution table, a sort by that context, and a
 * collocate ranking. All four read the PARAGRAPH token stream rather than the
 * sentence, and that is the whole of their difficulty — the window around a
 * match runs past the end of its sentence and keeps going. A builder that
 * clamped at the sentence would look right on every short example and be wrong
 * on every real one.
 *
 * WHY THE STREAM THEY READ IS NOT THE STREAM THE MATCHER READ. `_runConcat`
 * filters pure-punctuation words out before testing adjacency; `paraTokens`
 * does not filter at all, because a concordance line has to show the comma. Two
 * tokens the matcher called adjacent can therefore be two apart here, and a run
 * that looks contiguous splits into two lines. That is asserted below rather
 * than left as a surprise.
 *
 * WHERE THE GOLDENS COME FROM. The 44-token stream of `turkish-test`'s first
 * paragraph is written out in full in §1 and every expected value below is read
 * off it by hand, then confirmed against an independent walk of the JSONL. None
 * was recorded from the builders.
 *
 * Run:  node dev/tests/search_concordance_test.js
 * Exit: 0 = all pass, 1 = failures, 2 = fixture absent (DISABLED, not a pass).
 */

const H = require('./_search.js');
const { assert, eq, sameSet } = H;

const { TURKISH, CHINESE } = H.boot(
  'the KWIC, frequency, sort and collocate builders',
  'Its golden cases are hand-checked against turkish-test and chinese-test; running them '
+ 'against another corpus would assert nothing real.');

const { check, test, done } = H.reporter();

const TR_DOC = 'doc_1788140930631';
const tr = (sec, s) => `${TR_DOC}.${sec}.p_001.${s}`;
const forms = toks => toks.map(t => t.form);

console.log('\nSearch-B concordance (F3–F6) — golden cases over the shipped corpora\n');
H.seed([TURKISH]);

// ════════════════════════════════════════════════════════════════════════════
console.log('1 · the substrate every builder reads\n');
/* `turkish-test` sec_001.p_001, five sentences, 44 tokens INCLUDING punctuation:

     s_001  0 Sıcak    1 bir      2 öğleden   3 sonra    4 aç
            5 bir      6 tilki    7 bahçede   8 yürüyordu  9 .
     s_002 10 Yüksek  11 bir     12 asmada   13 sallanan 14 bir
           15 salkım  16 olgun   17 üzüm     18 gördü    19 .
     s_003 20 Tilki   21 ayağa   22 fırladı  23 ama      24 üzümlere
           25 ulaşamadı                      26 .
     s_004 27 Tekrar  28 tekrar  29 denedi   30 ama      31 yine
           32 de      33 onlara  34 ulaşamadı            35 .
     s_005 36 Sonunda 37 tilki   38 uzaklaşıp 39 üzümlerin 40 ekşi
           41 olduğunu 42 söylemiş           43 .

   Every golden below is read off this table. If the fixture is extended, this
   table is what has to be re-derived first — it is a copy of something the file
   already knows, and it is here because a reader cannot check a window without
   it. */
test('the paragraph stream is 44 tokens, punctuation included', () => {
  const para = S.sentById.get(tr('sec_001', 's_001')).para;
  const flat = paraTokens(para);
  eq(flat.length, 44, 'tokens');
  eq(flat[9].form, '.', 'the full stop is a token, or no line could show it');
  eq(flat[0].sentIdx, 0, 'first token is in the first sentence');
  eq(flat[43].sentIdx, 4, 'last token is in the fifth');
  eq(flat[20].sentId, tr('sec_001', 's_003'), 'and each token knows its own sentence');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n2 · KWIC — the window, and where it stops\n');
const uzum = runSearch({ query: 'üzüm*', field: 'text', level: 'word' }).hits;

test('the search that feeds §2 finds the three nodes at 17, 24 and 39', () => {
  eq(uzum.length, 3, 'hits');
});

test('context 3: left and right are read off the stream, punctuation and all', () => {
  const L = buildKwic(uzum, { context: 3 });
  eq(L.length, 3, 'one line per occurrence');
  sameSet(forms(L[0].node), ['üzüm'], 'node 1');
  eq(forms(L[0].left).join(' '),  'bir salkım olgun',   'left 1');
  eq(forms(L[0].right).join(' '), 'gördü . Tilki',      'right 1 — past the full stop and into the next sentence');
  eq(forms(L[1].left).join(' '),  'ayağa fırladı ama',  'left 2');
  eq(forms(L[1].right).join(' '), 'ulaşamadı . Tekrar', 'right 2');
  eq(forms(L[2].left).join(' '),  'Sonunda tilki uzaklaşıp', 'left 3');
  eq(forms(L[2].right).join(' '), 'ekşi olduğunu söylemiş',  'right 3');
});

test('crossesBoundary is a fact about the WINDOW, not about the node', () => {
  /* The same three hits, two context settings. At 3 the first two windows reach
     into the following sentence and the third does not; at 1 none of them does.
     A `crossesBoundary` computed from the node — or from the sentence the node
     is in — would give the same answer for both, and the concordance would draw
     the ‖ boundary glyph in the wrong places. */
  const wide   = buildKwic(uzum, { context: 3 });
  const narrow = buildKwic(uzum, { context: 1 });
  eq(wide.map(l => l.crossesBoundary).join(','),   'true,true,false',    'context 3');
  eq(narrow.map(l => l.crossesBoundary).join(','), 'false,false,false',  'context 1');
});

test('the window clamps at the paragraph, not at zero-minus-context', () => {
  const first = runSearch({ query: 'Sıcak', field: 'text', level: 'word' }).hits;
  const L = buildKwic(first, { context: 5 });
  eq(L.length, 1, 'lines');
  eq(L[0].left.length, 0, 'nothing to the left of the first token');
  eq(forms(L[0].right).join(' '), 'bir öğleden sonra aç bir', 'and five to the right');
});

test('fullParagraph ignores the context and takes everything either side', () => {
  const L = buildKwic(uzum, { context: 3, fullParagraph: true });
  eq(L[0].left.length,  17, 'everything before token 17');
  eq(L[0].right.length, 26, 'and everything after it, to the end of the paragraph');
  eq(L[0].left.length + L[0].node.length + L[0].right.length, 44, 'which is the whole stream');
  assert(L[0].crossesBoundary, 'and a whole-paragraph window crosses by definition');
});

test('adjacent matched tokens become ONE line with a two-token node', () => {
  /* `su içti` twice in one sentence. Each pair is adjacent in the stream, so
     each is one line whose node is both words — not two lines of one word. */
  const h = runSearch({ query: 'su içti', field: 'text', level: 'word' }).hits;
  eq(h.length, 2, 'hits');
  const L = buildKwic(h, { context: 2 });
  eq(L.length, 2, 'lines');
  assert(L.every(l => l.node.length === 2), 'each node is the whole matched span');
  eq(forms(L[0].node).join(' '), 'su içti', 'node 1');
  eq(L[0].wordIds.length, 2, 'and the line names both word ids');
});

test('but a span the matcher joined across punctuation splits into two lines', () => {
  /* `içti sonra` is adjacent among CONTENT words and two apart in the stream the
     concordance reads, because the comma is a token here and was filtered
     there. One hit, two runs, two lines — the consequence of two streams, made
     explicit so it is a decision rather than a surprise. */
  const h = runSearch({ query: 'içti sonra', field: 'text', level: 'word' }).hits;
  eq(h.length, 1, 'one hit');
  const L = buildKwic(h, { context: 1 });
  eq(L.length, 2, 'two lines');
  eq(forms(L[0].node).join(' '), 'içti',  'first run');
  eq(forms(L[1].node).join(' '), 'sonra', 'second run');
});

test('a sentence-level field has no token node and gets a sentence line', () => {
  const h = runSearch({ query: '*garden*', field: 'translation', level: 'sentence' }).hits;
  const L = buildKwic(h, { context: 3 });
  eq(L.length, 1, 'lines');
  eq(L[0].kind, 'sentence', 'kind');
  eq(L[0].sentId, tr('sec_001', 's_001'), 'sentence');
  eq(L[0].text, 'Sıcak bir öğleden sonra aç bir tilki bahçede yürüyordu.',
     'the RAW sentence text, for display');
  eq(L[0].matchedText, 'One hot afternoon a hungry fox walked through a garden',
     'and the normalised translation that actually matched');
});

test('the line cap is honoured', () => {
  const h = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  eq(buildKwic(h, { context: 2 }).length, 13, 'thirteen occurrences, thirteen lines');
  eq(buildKwic(h, { context: 2, cap: 5 }).length, 5, 'capped');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n3 · frequency — types fold, distribution counts lines\n');

test('three distinct forms are three types', () => {
  const f = buildFrequency(buildKwic(uzum, { context: 3 }));
  eq(f.total, 3, 'total');
  eq(f.types.length, 3, 'types');
  sameSet(f.types.map(t => t.form), ['üzüm', 'üzümlere', 'üzümlerin'], 'forms');
  assert(f.types.every(t => t.count === 1), 'each once');
});

test('and thirteen occurrences of one lemma-less form are ONE type', () => {
  /* B-120: the type key folds with `normForm`, the object-language key, so
     `Tilki` and `tilki` are one type and not two. Under `toLowerCase` this
     corpus would agree by luck; the fold is bound to Turkish here, which is
     where luck runs out. The displayed form keeps the first casing seen. */
  const h = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  const f = buildFrequency(buildKwic(h, { context: 2 }));
  eq(f.total, 13, 'total');
  eq(f.types.length, 1, 'types');
  eq(f.types[0].count, 13, 'count');
  eq(f.types[0].form, 'tilki', 'first-seen casing');
});

test('distribution names the document and the section it came from', () => {
  const h = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  const f = buildFrequency(buildKwic(h, { context: 2 }));
  eq(f.byDoc.length, 1, 'one document');
  eq(f.byDoc[0].title, 'Turkish Test Corpus', 'title');
  eq(f.byDoc[0].count, 13, 'count');
  eq(f.bySection.length, 2, 'two sections');
  eq(f.bySection[0].title, 'Turkish Test Corpus › Tekrar Testi', 'busiest section first');
  eq(f.bySection[0].count, 10, 'count');
  eq(f.bySection[1].title, 'Turkish Test Corpus › Tilki ve Üzümler', 'and the other');
  eq(f.bySection[1].count, 3, 'count');
});

test('a sentence line counts toward the total and the distribution, not the types', () => {
  const h = runSearch({ query: '*garden*', field: 'translation', level: 'sentence' }).hits;
  const f = buildFrequency(buildKwic(h, {}));
  eq(f.total, 1, 'total');
  eq(f.types.length, 0, 'no node, no type');
  eq(f.byDoc[0].count, 1, 'but it is still somewhere');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n4 · sort — by node, by context, and stable\n');
const L3 = buildKwic(uzum, { context: 3 });

test("'corpus' is the input, unchanged and unsorted", () => {
  eq(sortKwic(L3, 'corpus', 'asc'), L3, 'the same array');
  eq(sortKwic(L3, null, 'asc'), L3, 'and so is no anchor at all');
});

test('by node, both directions', () => {
  eq(sortKwic(L3, 'node', 'asc').map(l => l.node[0].form).join(' '),
     'üzüm üzümlere üzümlerin', 'asc');
  eq(sortKwic(L3, 'node', 'desc').map(l => l.node[0].form).join(' '),
     'üzümlerin üzümlere üzüm', 'desc');
});

test('by L1 — the token immediately LEFT of the node, not the leftmost', () => {
  /* Keys: olgun (üzüm), ama (üzümlere), uzaklaşıp (üzümlerin). Reading the far
     end of the window instead would key on bir/ayağa/Sonunda and order them
     differently, which is the whole reason this case names its expected order
     rather than just asserting it changed. */
  eq(sortKwic(L3, 'L1', 'asc').map(l => l.node[0].form).join(' '),
     'üzümlere üzüm üzümlerin', 'asc by ama < olgun < uzaklaşıp');
});

test('by R1 — the token immediately RIGHT', () => {
  eq(sortKwic(L3, 'R1', 'asc').map(l => l.node[0].form).join(' '),
     'üzümlerin üzüm üzümlere', 'asc by ekşi < gördü < ulaşamadı');
});

test('ties keep corpus order in BOTH directions', () => {
  /* Thirteen lines whose node key is the same string. `desc` flips the key
     comparison and must not flip the tie-break, or a re-sort would shuffle rows
     that are supposed to be identical. */
  const h  = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  const ln = buildKwic(h, { context: 2 });
  const ids = l => l.map(x => x.wordIds.join('|')).join(' ');
  eq(ids(sortKwic(ln, 'node', 'asc')),  ids(ln), 'asc');
  eq(ids(sortKwic(ln, 'node', 'desc')), ids(ln), 'desc');
});

test('an unparseable anchor sorts by an empty key rather than throwing', () => {
  const out = sortKwic(L3, 'Q7', 'asc');
  eq(out.length, 3, 'all lines survive');
  eq(out.map(l => l.node[0].form).join(' '), 'üzüm üzümlere üzümlerin', 'and corpus order holds');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n5 · collocates — the window that crosses a sentence\n');

test('window 1: one token either side of each of the three nodes', () => {
  const c = buildCollocates(uzum, { window: 1 });
  eq(c.window, 1, 'window');
  eq(c.nodeCount, 3, 'node occurrences');
  eq(c.items.length, 6, 'items');
  sameSet(c.items.map(i => i.form),
          ['olgun', 'gördü', 'ama', 'ulaşamadı', 'uzaklaşıp', 'ekşi'], 'forms');
  const g = f => c.items.find(i => i.form === f);
  eq(g('olgun').left, 1, 'olgun is on the left');  eq(g('olgun').right, 0, 'and only there');
  eq(g('gördü').right, 1, 'gördü is on the right'); eq(g('gördü').left, 0, 'and only there');
});

test('window 2: ten, not twelve, because punctuation is never a collocate', () => {
  /* Two of the six right-hand slots at distance 2 are full stops. They are in
     the stream — §1 asserts that — and they must not be counted. */
  const c = buildCollocates(uzum, { window: 2 });
  eq(c.items.length, 10, 'items');
  assert(!c.items.some(i => /^[.,;:!?]+$/.test(i.form)), 'no punctuation among them');
});

test('window 3: the window reaches into the next sentence, and the fold merges', () => {
  /* At distance 3 the first node's right window passes the full stop and takes
     `Tilki`, the opening word of the FOLLOWING sentence — a collocate collected
     across a sentence boundary, which is the whole reason these builders read
     the paragraph stream. It then folds together with the `tilki` in the third
     node's left window: one entry, count 2, once on each side. Sixteen distinct
     surface strings, fifteen items. */
  const c = buildCollocates(uzum, { window: 3 });
  eq(c.items.length, 15, 'items');
  const t = c.items.find(i => i.form === 'Tilki');
  assert(t, 'the cross-boundary collocate must be there');
  eq(t.count, 2, 'count');
  eq(t.left, 1, 'once on the left');
  eq(t.right, 1, 'and once on the right, from the other side of a sentence break');
  assert(!c.items.some(i => i.form === 'tilki'),
         'and not ALSO as a second entry, or the fold did nothing');
});

test('the node itself is never its own collocate', () => {
  const h = runSearch({ query: 'su içti', field: 'text', level: 'word' }).hits;
  const c = buildCollocates(h, { window: 3 });
  assert(!c.items.some(i => i.form === 'su' || i.form === 'içti'),
         'both node tokens must be excluded, at both occurrences');
  eq(c.nodeCount, 2, 'two node runs');
});

test('a repeated node is not its own collocate', () => {
  /* `…küçük bir tilki ve büyük bir tilki oturuyordu.` — two occurrences four
     tokens apart, so at window 5 each one's window contains the OTHER node.
     The node set is the only thing keeping the search term out of its own
     collocate table, and it is unreachable at any window narrow enough for the
     other cases here. The same windows also run off the end of the sentence and
     collect from the next one, which is asserted alongside so the case cannot
     pass by returning nothing. */
  const h = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  const pair = h.find(x => x.sentIds[0] === tr('sec_003', 's_005'));
  assert(pair && pair.matchedWordIds[0].length === 2,
         'the fixture must still hold a sentence with two of them');
  const c = buildCollocates([pair], { window: 5 });
  eq(c.nodeCount, 2, 'two node runs');
  assert(!c.items.some(i => normForm(i.form) === 'tilki'),
         `the node must not collocate with itself, got ${JSON.stringify(c.items.map(i => i.form))}`);
  assert(c.items.some(i => i.form === 'Nehir'),
         'and the window still reaches into the following sentence');
});

test('a sentence-level hit contributes no collocates and no node count', () => {
  const h = runSearch({ query: '*garden*', field: 'translation', level: 'sentence' }).hits;
  const c = buildCollocates(h, { window: 3 });
  eq(c.nodeCount, 0, 'nodes');
  eq(c.items.length, 0, 'items');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n6 · the other corpus, where a word is one morpheme wide\n');
H.seed([CHINESE]);

test('chinese: two matches in one sentence are two lines, not one node', () => {
  /* 狐狸看见了狐狸 — the two 狐狸 are positions 0 and 3 of the sentence with two
     tokens between them, so they are separate runs. An implementation that
     grouped by sentence rather than by contiguity would report one. */
  const h = runSearch({ query: '狐狸', field: 'text', level: 'word' }).hits;
  const first = h.find(x => x.sentIds[0].endsWith('sec_003.p_001.s_001'));
  assert(first, 'the repetition sentence must be among the hits');
  eq(first.matchedWordIds[0].length, 2, 'two matched words in one hit');
  const L = buildKwic([first], { context: 2 });
  eq(L.length, 2, 'two lines');
  eq(forms(L[0].node).join(''), '狐狸', 'node 1');
  eq(forms(L[1].node).join(''), '狐狸', 'node 2');
});

test('chinese: the frequency table folds nothing it should not', () => {
  const h = runSearch({ query: '狐狸', field: 'text', level: 'word' }).hits;
  const f = buildFrequency(buildKwic(h, { context: 2 }));
  eq(f.total, 15, 'occurrences');
  eq(f.types.length, 1, 'one type');
  eq(f.types[0].count, 15, 'count');
  eq(f.bySection.length, 2, 'across both sections');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n7 · B-204 — the substrate must not reach disk\n');
/* The caches are parked on the annotator's OWN records: a sentence gets
   `_srchTokens`, a paragraph `_srchParaTokens`. `serializeRecords` stringifies
   whatever a record enumerates, and `_srchTokens` holds one entry per word each
   carrying a REFERENCE to the word object — so a save after a concordance wrote
   every word into the file a second time, inside its own sentence.

   Measured before the fix, on `turkish-test`: 85,964 characters clean, **230,125
   after one KWIC**. The file grew 168% and gained 64 keys the format does not
   have. It had been true since the substrate was written; a search alone never
   showed it, because the matcher walks `S.docs` directly and only the
   CONCORDANCE touches the substrate.

   Asserted as bytes rather than as an absence of keys: a future cache under a
   different name has to pass this too. */
{
  const H2 = require('./_search.js');
  H2.seed([TURKISH]);
  /* `JSON.stringify` per record is exactly what `serializeRecords` does with
     `withEvents: false`, and it is the whole of the question here — which
     properties a record ENUMERATES. Using it keeps this guard out of the
     provenance-interning machinery it is not about. */
  const save = () => S.docs.map(d => JSON.stringify(d)).join('\n');
  const before = save();
  const h = runSearch({ query: 'tilki', field: 'text', level: 'word' }).hits;
  buildKwic(h, { context: 12 });
  buildCollocates(h, { window: 5 });
  sortKwic(buildKwic(h, { context: 3 }), 'node', 'asc');
  const after = save();
  check(after === before,
        'a save after a concordance is byte-identical to a save before it',
        `         ${before.length} → ${after.length} characters. The substrate is being\n`
      + '         written to the annotator\'s file. Park it with `_cache`, which defines\n'
      + '         the property non-enumerable so JSON.stringify cannot see it.');
  check(!/"_srch[A-Za-z]*"/.test(after),
        'and no cache key appears in the serialised output',
        `         found: ${[...new Set(after.match(/"_srch[A-Za-z]*"/g) || [])].join(', ')}`);
  /* Not vacuous: the caches must actually have been built, or this passes by
     never having touched the substrate at all. */
  const para = S.sentById.get(tr('sec_001', 's_001')).para;
  check(Object.prototype.hasOwnProperty.call(para, '_srchParaTokens'),
        'while the cache IS on the object, so the check above is not vacuous');
  check(Object.keys(para).indexOf('_srchParaTokens') === -1,
        'and is non-enumerable, which is the mechanism rather than a filter list',
        '         a serializer that has to remember to exclude a key is the next B-127');
}

done();
