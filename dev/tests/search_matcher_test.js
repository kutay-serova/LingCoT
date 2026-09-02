#!/usr/bin/env node
/**
 * search_matcher_test.js — Search-B matcher, golden cases over the shipped corpora
 * =============================================================================
 * WHAT THIS GUARD IS FOR. `runSearch` routes one query to eight different
 * matchers by (field × level × scope × <BREAK>), and each of them answers a
 * different question about the same corpus. The router is where a wrong answer
 * is cheapest to produce and hardest to see: every path returns a plausible
 * number of hits, so the only thing that catches a mis-route is knowing what the
 * right answer WAS.
 *
 * WHERE THE GOLDENS COME FROM. Every expected value below was derived by reading
 * the corpus JSON — the sentence, the word, the morpheme — and then confirmed
 * against an independent walk of the same files written in another language. It
 * was NOT recorded from `runSearch`. A golden taken from the thing it is meant to
 * check is a tautology, which is what happened to the Korean pair these replace:
 * their values were hand-typed against a corpus that has not shipped since
 * v3.14.120, and they sat DISABLED for 265 versions rather than be re-pointed at
 * a corpus they were not written for (D58 §4.2).
 *
 * WHY BOTH CORPORA. The two are typologically opposed and the matcher's paths
 * split along exactly that seam. `turkish-test` is agglutinative — several
 * morphemes per word, so the morpheme level and the word level disagree, and
 * lemma citation forms differ from every surface form that realises them.
 * `chinese-test` is isolating with word-level transliterations under a named
 * label, so it is the corpus where the label argument can be wrong. Neither
 * corpus alone reaches half of what is here.
 *
 * THE THEME. Most cases below are about a target that STRADDLES a level object:
 * a sequence whose two halves live in different words, in different sentences,
 * or in the dictionary rather than the corpus at all. Those are the matches a
 * naive implementation cannot make and a broken one makes by accident.
 *
 * Run:  node dev/tests/search_matcher_test.js
 * Exit: 0 = all pass, 1 = failures, 2 = fixture absent (DISABLED, not a pass).
 */

const H = require('./_search.js');
const { assert, eq, sameSet, sentSet, wordIds, formsOf, shortIds } = H;

const { TURKISH, CHINESE } = H.boot(
  'the Search-B matcher',
  'Its golden cases are hand-checked against turkish-test and chinese-test; running them '
+ 'against another corpus would assert nothing real.');

const { check, test, done } = H.reporter();

const TR_DOC = 'doc_1788140930631';
const CN_DOC = 'doc_1788135547071';
/* Full ids. The short suffix repeats across sections — `s_001` names six
   different sentences in `turkish-test` — so a golden written short would be
   satisfied by the wrong sentence (B-036's shape, one level down). */
const tr = (sec, s) => `${TR_DOC}.${sec}.p_001.${s}`;
const cn = (sec, s) => `${CN_DOC}.${sec}.p_001.${s}`;

/* Every case states its field/level/scope so the router path is readable at the
   call site rather than inferred from the argument order. */
const find = o => runSearch(o);
const hitsOf = o => find(o).hits;

console.log('\nSearch-B matcher — golden cases over the shipped corpora\n');

// ════════════════════════════════════════════════════════════════════════════
console.log('1 · one gloss, four levels — the level IS the answer\n');
/* `grape` is written in three places in `turkish-test`: on the morpheme `üzüm`,
   on the word `üzümlerin` (typed), and derived onto `üzüm` (whose only morpheme
   carries it). Asking for it at four different levels must give four different
   answers, and each difference is a fact about the corpus rather than about the
   engine:
     word/gloss      2 — `üzümlere` is excluded, because `wordGloss` DERIVES
                         `grape-PL-DAT` for it and the glob is whole-token
     morpheme/gloss  3 — the morpheme `üzüm` is inside all three words
     sentence/gloss  3 — a substring over the joined word glosses, so the
                         derived `grape-PL-DAT` matches after all
     word/gloss `grape-PL-DAT`
                     1 — and it is exactly the word the word level missed
   If any two of these ever return the same set, a level has stopped meaning
   anything. */
H.seed([TURKISH]);

test('word/gloss "grape" finds the two words glossed exactly that', () => {
  const h = hitsOf({ query: 'grape', field: 'gloss', level: 'word' });
  sameSet(sentSet(h), [tr('sec_001', 's_002'), tr('sec_001', 's_005')], 'sentences');
  sameSet(formsOf(wordIds(h)), ['üzüm', 'üzümlerin'], 'forms');
});

test('morpheme/gloss "grape" finds a third word the word level cannot', () => {
  const h = hitsOf({ query: 'grape', field: 'gloss', level: 'morpheme' });
  sameSet(sentSet(h), [tr('sec_001', 's_002'), tr('sec_001', 's_003'), tr('sec_001', 's_005')], 'sentences');
  sameSet(formsOf(wordIds(h)), ['üzüm', 'üzümlere', 'üzümlerin'], 'forms');
});

test('sentence/gloss "*grape*" reaches it too, by substring over the join', () => {
  const h = hitsOf({ query: '*grape*', field: 'gloss', level: 'sentence' });
  sameSet(sentSet(h), [tr('sec_001', 's_002'), tr('sec_001', 's_003'), tr('sec_001', 's_005')], 'sentences');
  assert(h.every(x => x.matchedWordIds.every(g => g.length === 0)),
         'a sentence-level field has no token node, so matchedWordIds must be empty');
});

test('word/gloss "grape-PL-DAT" is the word the word level missed', () => {
  const h = hitsOf({ query: 'grape-PL-DAT', field: 'gloss', level: 'word' });
  eq(h.length, 1, 'hits');
  sameSet(sentSet(h), [tr('sec_001', 's_003')], 'sentence');
  sameSet(formsOf(wordIds(h)), ['üzümlere'], 'form');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n2 · the single-token scan — _runTokenSearch\n');

test('word/text "tilki" — 11 sentences, 13 tokens, exact form only', () => {
  const h = hitsOf({ query: 'tilki', field: 'text', level: 'word' });
  eq(h.length, 11, 'one hit per matching sentence');
  eq(wordIds(h).length, 13, 'matched tokens');
  assert(!formsOf(wordIds(h)).includes('tilkiyi'), 'the glob is anchored: tilkiyi is not tilki');
});

test('word/text "tilki*" takes the two "tilkiyi" as well, in the same sentences', () => {
  const h = hitsOf({ query: 'tilki*', field: 'text', level: 'word' });
  eq(h.length, 11, 'hits');
  eq(wordIds(h).length, 15, 'matched tokens');
  eq(formsOf(wordIds(h)).filter(f => f === 'tilkiyi').length, 2, 'tilkiyi');
});

test('caseSensitive really is case-sensitive: 5 of the 13 survive', () => {
  const h = hitsOf({ query: 'tilki', field: 'text', level: 'word', caseSensitive: true });
  eq(h.length, 4, 'hits');
  eq(wordIds(h).length, 5, 'tokens');
  assert(formsOf(wordIds(h)).every(f => f === 'tilki'), 'no capitalised form may survive');
});

test('and without it the fold does the work: "TİLKİ" still finds all 13', () => {
  /* B-120: `text` is object language and folds with `normForm`, not with the
     regex `i` flag — simple case folding does not map Turkish İ to i. The
     pattern is folded too, which is what makes this pass. */
  const h = hitsOf({ query: 'TİLKİ', field: 'text', level: 'word' });
  eq(wordIds(h).length, 13, 'tokens');
});

test('regex mode "^tilki$" agrees with the anchored glob', () => {
  const h = hitsOf({ query: '^tilki$', field: 'text', level: 'word', regex: true });
  eq(h.length, 11, 'hits');
  eq(wordIds(h).length, 13, 'tokens');
});

test('morpheme/text "DI" finds the past tense inside 11 words', () => {
  const h = hitsOf({ query: 'DI', field: 'text', level: 'morpheme' });
  eq(h.length, 8, 'sentences');
  eq(wordIds(h).length, 11, 'words, collapsed from their morphemes');
  assert(!formsOf(wordIds(h)).includes('olduğunu'),
         'DIk is not DI — a whole-token glob must not match a longer morpheme');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n3 · transliterations — an element inside a morpheme inside a word\n');

test('turkish: BOTH transliterations of one morpheme are searchable', () => {
  /* `sıcak` carries two: `sïjak` and `sïdjak`. An engine that tested only the
     first element would pass every other case in this file. D58 asked the
     corpus for a multi-element list and this is what it is for — with one
     element the two behaviours are indistinguishable. */
  const a = hitsOf({ query: 'sïjak',  field: 'translit', level: 'morpheme' });
  const b = hitsOf({ query: 'sïdjak', field: 'translit', level: 'morpheme' });
  eq(a.length, 1, 'first element');
  eq(b.length, 1, 'second element');
  sameSet(sentSet(a), sentSet(b), 'both name the same sentence');
  sameSet(formsOf(wordIds(a)), ['Sıcak'], 'and the same word');
  sameSet(formsOf(wordIds(b)), ['Sıcak'], 'and the same word');
});

H.seed([CHINESE]);

test('chinese: word-level translit under a named label', () => {
  const h = hitsOf({ query: 'húli', field: 'translit', level: 'word', translitLabel: 'Translit' });
  eq(h.length, 11, 'sentences');
  eq(wordIds(h).length, 15, 'tokens');
  assert(formsOf(wordIds(h)).every(f => f === '狐狸'), 'every match is the same word');
});

test('the label ARGUMENT selects, it does not decorate', () => {
  /* `guo4` is the second transliteration of the morpheme 过, and it carries no
     label. Asking under 'Translit' must not find it; asking under 'any' must.
     An engine that ignored the label would return 1 for both, and an engine
     that only ever read the first element would return 0 for both. */
  const any  = hitsOf({ query: 'guo4', field: 'translit', level: 'morpheme', translitLabel: 'any' });
  const lbl  = hitsOf({ query: 'guo4', field: 'translit', level: 'morpheme', translitLabel: 'Translit' });
  eq(any.length, 1, "'any' reaches the unlabelled element");
  eq(lbl.length, 0, "'Translit' does not");
  sameSet(formsOf(wordIds(any)), ['走过'], 'and it is the morpheme 过 inside 走过');
});

test("and 'any' reaches the other element of the same morpheme", () => {
  const h = hitsOf({ query: 'guò', field: 'translit', level: 'morpheme', translitLabel: 'any' });
  eq(h.length, 1, 'hits');
  sameSet(formsOf(wordIds(h)), ['走过'], 'form');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n4 · sequences that straddle a word — _runConcat\n');
H.seed([TURKISH]);

test('punctuation does not break adjacency: "içti sonra" spans a comma', () => {
  /* `Tilki su içti , sonra tilki tekrar su içti .` — the two query tokens are
     not adjacent in the sentence, they are adjacent among its CONTENT words.
     `_isPunct` is the whole of this case; remove it and the hit disappears. */
  const h = hitsOf({ query: 'içti sonra', field: 'text', level: 'word' });
  eq(h.length, 1, 'hits');
  sameSet(sentSet(h), [tr('sec_003', 's_004')], 'sentence');
  sameSet(formsOf(wordIds(h)), ['içti', 'sonra'], 'forms');
});

test('morpheme sequence across a WORD boundary: "DAn sonra"', () => {
  /* `öğleden` is öğle + DAn; `sonra` is its own word. The sequence runs off the
     end of one word and into the next, which is only possible because the
     morpheme stream is flattened across the paragraph rather than per word.
     The output collapses back to the two PARENT words, which is the other half
     of the claim: a morpheme-level match is reported at word level. */
  const h = hitsOf({ query: 'DAn sonra', field: 'text', level: 'morpheme' });
  eq(h.length, 1, 'hits');
  sameSet(sentSet(h), [tr('sec_001', 's_001')], 'sentence');
  sameSet(formsOf(wordIds(h)), ['öğleden', 'sonra'], 'the two words it straddles');
});

H.seed([CHINESE]);

test('the same straddle in chinese: "过 花" is inside no word', () => {
  /* 走过 is 走 + 过 and 花园 is 花 + 园. The match is the last morpheme of one
     word and the first of the next — the string 过花 does not occur as a word
     anywhere in the corpus, which is what makes this a morpheme-stream match
     and not a text match wearing a different name. */
  const h = hitsOf({ query: '过 花', field: 'text', level: 'morpheme' });
  eq(h.length, 1, 'hits');
  sameSet(sentSet(h), [cn('sec_001', 's_001')], 'sentence');
  sameSet(formsOf(wordIds(h)), ['走过', '花园'], 'the two words it straddles');
  eq(hitsOf({ query: '过花', field: 'text', level: 'word' }).length, 0,
     'and no WORD is 过花, so the two levels genuinely disagree');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n5 · sequences that straddle a sentence — and stop at the paragraph\n');
H.seed([TURKISH]);

test('"koştu Tilki" is not a match inside one sentence', () => {
  eq(hitsOf({ query: 'koştu Tilki', field: 'text', level: 'word' }).length, 0,
     'strict adjacency is single-sentence');
});

test('and IS one across the boundary, twice, with both sentences named', () => {
  const h = hitsOf({ query: 'koştu Tilki', field: 'text', level: 'word', crossSent: true });
  eq(h.length, 2, 'hits');
  assert(h.every(x => x.sentIds.length === 2), 'each hit names the pair it spans');
  sameSet(h.map(x => x.sentIds.join('+')),
          [`${tr('sec_003', 's_002')}+${tr('sec_003', 's_003')}`,
           `${tr('sec_003', 's_003')}+${tr('sec_003', 's_004')}`], 'the pairs');
});

H.seed([CHINESE]);

test('chinese crosses the same way: 长 ends one sentence, 狐狸 opens the next', () => {
  eq(hitsOf({ query: '长 狐狸', field: 'text', level: 'word' }).length, 0, 'not within one');
  const h = hitsOf({ query: '长 狐狸', field: 'text', level: 'word', crossSent: true });
  eq(h.length, 1, 'hits');
  sameSet(h[0].sentIds, [cn('sec_003', 's_006'), cn('sec_003', 's_007')], 'the pair');
});

H.seed([TURKISH]);

test('but never across a PARAGRAPH, even with crossSent on', () => {
  /* `…bir cümle.` ends the first paragraph of the merged section and `Bu ise…`
     opens the second. The two are adjacent on screen and in the file; the token
     stream is built per paragraph, so they are not adjacent to the matcher.
     This is the boundary the cross-sentence toggle does NOT dissolve. */
  eq(hitsOf({ query: 'cümle Bu', field: 'text', level: 'word', crossSent: true }).length, 0,
     'paragraph-bounded');
  /* …and the two sentences really are consecutive, or the case above is vacuous. */
  const secs = S.docs[0].sections.filter(s => (s.paragraphs || []).length > 1);
  assert(secs.length === 1 && secs[0].paragraphs.length === 2,
         'the fixture must still hold one section with two paragraphs');
});

test('an empty section is walked without incident', () => {
  const empty = S.docs[0].sections.filter(s => !(s.paragraphs || []).length);
  assert(empty.length === 1, 'the fixture must still hold one section with no paragraphs');
  eq(hitsOf({ query: 'tilki', field: 'text', level: 'word' }).length, 11,
     'and it contributes nothing rather than throwing');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n6 · <BREAK> anchors — the boundary as part of the query\n');

test('<BREAK>tilki keeps only the sentence-initial ones: 8 of 13', () => {
  const h = hitsOf({ query: '<BREAK>tilki', field: 'text', level: 'word' });
  eq(h.length, 8, 'hits');
  eq(wordIds(h).length, 8, 'one token each');
});

test('gördü<BREAK> keeps only the sentence-final ones', () => {
  const h = hitsOf({ query: 'gördü<BREAK>', field: 'text', level: 'word' });
  eq(h.length, 3, 'hits');
  /* Sentence-final among CONTENT words: every one of the three is followed by a
     full stop, so `isLast` has to be computed after the punctuation filter. */
  sameSet(sentSet(h), [tr('sec_001', 's_002'), tr('sec_003', 's_001'), tr('sec_003', 's_010')], 'sentences');
});

test('koştu<BREAK>Tilki forces the boundary without the crossSent toggle', () => {
  const h = hitsOf({ query: 'koştu<BREAK>Tilki', field: 'text', level: 'word' });
  eq(h.length, 2, 'hits');
  assert(h.every(x => x.sentIds.length === 2), 'each spans two sentences');
});

test('and a <BREAK> between two ADJACENT words refuses them', () => {
  /* `su içti` occurs twice inside one sentence. `su<BREAK>içti` asks for the two
     with a sentence boundary between them, which never happens — so the answer
     is nothing, and the pair above proves the query itself is well formed.
     Without this, dropping the boundary requirement entirely leaves every
     <BREAK> case in this file passing: they all ask for a match that a boundary
     ALLOWS, and none for one it must forbid. */
  eq(hitsOf({ query: 'su içti', field: 'text', level: 'word' }).length, 2,
     'the sequence is really there, twice');
  eq(hitsOf({ query: 'su<BREAK>içti', field: 'text', level: 'word' }).length, 0,
     'and never across a boundary');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n7 · lemma — the straddle that leaves the corpus entirely\n');
/* A lemma search resolves through three stores: the lemma registry supplies the
   citation form, the dictionary supplies the surface forms filed under it, and
   the corpus supplies the tokens. Nothing else in the matcher reads more than
   one of those, and until this guard seeded a dictionary the whole path returned
   zero hits against an empty index — passing, and checking nothing. */

test('lemma "üzüm" finds three surface forms where text finds one', () => {
  const byText  = hitsOf({ query: 'üzüm', field: 'text',  level: 'word' });
  const byLemma = hitsOf({ query: 'üzüm', field: 'lemma', level: 'word' });
  eq(byText.length, 1, 'text: the citation form is also a token, once');
  eq(byLemma.length, 3, 'lemma: and two inflected forms besides');
  sameSet(formsOf(wordIds(byLemma)), ['üzüm', 'üzümlere', 'üzümlerin'], 'forms');
});

test('lemma "tilki" reaches two tokens the identical text query does not', () => {
  const byText  = hitsOf({ query: 'tilki', field: 'text',  level: 'word' });
  const byLemma = hitsOf({ query: 'tilki', field: 'lemma', level: 'word' });
  eq(wordIds(byText).length, 13, 'text');
  eq(wordIds(byLemma).length, 15, 'lemma, via the dictionary member "tilkiyi"');
  sameSet(sentSet(byText), sentSet(byLemma), 'in the same sentences, which is why a hit count would miss it');
});

test('a numbered homograph pair with no dictionary members still matches by id', () => {
  /* `da` is two lemma records (B-114 numbered them) and neither has a dictionary
     member, so `memberForms` is empty and the only route left is the token's own
     `lemma_id`. The token is `de` — it shares one letter with the citation form,
     so no string comparison anywhere could have found it. E27's path, alone. */
  const h = hitsOf({ query: 'da', field: 'lemma', level: 'word' });
  eq(h.length, 1, 'hits');
  sameSet(formsOf(wordIds(h)), ['de'], 'the surface form');
  eq(S.lemmas.filter(l => l.form === 'da').length, 2,
     'and the fixture must still hold the numbered pair, or this proves nothing');
});

H.seed([CHINESE]);

test('a citation form that is not a token at all: lemma 走 finds 走过', () => {
  eq(hitsOf({ query: '走', field: 'text',  level: 'word' }).length, 0, 'no token is 走');
  const h = hitsOf({ query: '走', field: 'lemma', level: 'word' });
  eq(h.length, 1, 'but one token is filed under it');
  sameSet(formsOf(wordIds(h)), ['走过'], 'form');
});

test('a lemma nothing matches returns no hits and no error', () => {
  const r = find({ query: 'zzzz', field: 'lemma', level: 'word' });
  eq(r.hits.length, 0, 'hits');
  eq(r.error, null, 'not finding something is not an error');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n8 · sentence level — _runSentenceRx\n');
H.seed([TURKISH]);

test('sentence/text "*üzümlere*" matches the normalised sentence, punctuation gone', () => {
  const h = hitsOf({ query: '*üzümlere*', field: 'text', level: 'sentence' });
  eq(h.length, 1, 'hits');
  sameSet(sentSet(h), [tr('sec_001', 's_003')], 'sentence');
  eq(h[0].matchedTexts[0], 'Tilki ayağa fırladı ama üzümlere ulaşamadı',
     'the matched text is the punctuation-stripped form, not the raw sentence');
});

test('sentence/translation searches EVERY translation and reports which matched', () => {
  /* The first sentence carries two translations. The query appears in both, and
     the reported value must be the one that matched rather than a join or the
     sentence text — the second half of D58s multi-element list, at sentence
     level this time. */
  const h = hitsOf({ query: '*garden*', field: 'translation', level: 'sentence' });
  eq(h.length, 1, 'hits');
  eq(h[0].matchedTexts[0], 'One hot afternoon a hungry fox walked through a garden', 'matched text');
  eq(S.sentById.get(tr('sec_001', 's_001')).sent.translations.length, 2,
     'and the fixture must still carry two translations there');
});

test('a translation only the SECOND element carries is still found', () => {
  const h = hitsOf({ query: '*was walking*', field: 'translation', level: 'sentence' });
  eq(h.length, 1, 'hits');
  eq(h[0].matchedTexts[0], 'A hot afternoon a hungry fox was walking through a garden',
     'and the second element is what is reported');
});

H.seed([CHINESE]);

test('sentence/translit joins the words of a sentence under one label', () => {
  const h = hitsOf({ query: '*húli*', field: 'translit', level: 'sentence', translitLabel: 'Translit' });
  eq(h.length, 11, 'hits');
  assert(/^yī ge yánrè /.test(h[0].matchedTexts[0]),
         `the joined reading, got: ${JSON.stringify(h[0].matchedTexts[0])}`);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n9 · sentence level across the boundary — and how the two ways differ\n');
H.seed([TURKISH]);

test('crossSent tests the JOINED pair, so a match inside one sentence counts', () => {
  /* "nehre koştu" is a sequence inside s_002 and s_003. The cross-sentence
     matcher builds `s1 + "\n" + s2` and tests the whole of it, so every pair
     that contains the sequence anywhere matches — three of them. That is the
     documented behaviour and it is what <BREAK> exists to narrow. */
  const h = hitsOf({ query: 'nehre koştu', field: 'text', level: 'sentence', crossSent: true });
  eq(h.length, 3, 'hits');
  assert(h.every(x => x.sentIds.length === 2), 'each names its pair');
});

test('<BREAK> at sentence level splits the test in two, and 3 becomes 1', () => {
  /* rx1 must match s1 ALONE and rx2 must match s2 ALONE. Only one pair has
     `nehre` on the left of the boundary and `koştu` on the right. */
  const h = hitsOf({ query: 'nehre<BREAK>koştu', field: 'text', level: 'sentence' });
  eq(h.length, 1, 'hits');
  sameSet(h[0].sentIds, [tr('sec_003', 's_002'), tr('sec_003', 's_003')], 'the pair');
});

test('<BREAK> on translations reads every element, not the first', () => {
  /* The cross-sentence and <BREAK> paths build their candidate strings through
     a DIFFERENT accessor from the single-sentence path, and only that one has
     been exercised so far. `was walking` is in the SECOND translation of s_001
     and `bunch` is in the only translation of s_002; if the accessor stops at
     the first element the pair disappears. */
  const h = hitsOf({ query: 'was walking<BREAK>bunch', field: 'translation', level: 'sentence' });
  eq(h.length, 1, 'hits');
  sameSet(h[0].sentIds, [tr('sec_001', 's_001'), tr('sec_001', 's_002')], 'the pair');
  eq(h[0].matchedTexts[0], 'A hot afternoon a hungry fox was walking through a garden',
     'and it reports the element that matched');
});

test('and the query that genuinely spans the join matches both ways', () => {
  const cross = hitsOf({ query: 'koştu Tilki', field: 'text', level: 'sentence', crossSent: true });
  const split = hitsOf({ query: 'koştu<BREAK>Tilki', field: 'text', level: 'sentence' });
  eq(cross.length, 2, 'crossSent');
  eq(split.length, 2, '<BREAK>');
  sameSet(cross.map(x => x.sentIds.join('+')), split.map(x => x.sentIds.join('+')),
          'the same pairs, reached by different code');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n10 · what the router refuses\n');

test('a malformed regex is reported, not thrown', () => {
  const r = find({ query: '[', field: 'text', level: 'sentence', regex: true });
  eq(r.hits.length, 0, 'hits');
  assert(r.error && typeof r.error === 'string' && r.error.length > 0,
         `an error string is required, got ${JSON.stringify(r.error)}`);
});

test('two <BREAK>s at sentence level are refused by name', () => {
  const r = find({ query: 'a<BREAK>b<BREAK>c', field: 'text', level: 'sentence' });
  eq(r.hits.length, 0, 'hits');
  eq(r.error, 'Only one <BREAK> is supported at sentence level.', 'error');
});

test('an empty query is no results and no error', () => {
  const r = find({ query: '   ', field: 'text', level: 'word' });
  eq(r.hits.length, 0, 'hits');
  eq(r.error, null, 'error');
});

test('the cap is honoured', () => {
  const h = hitsOf({ query: 'tilki', field: 'text', level: 'word', cap: 4 });
  eq(h.length, 4, 'hits');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n11 · more than one document in S.docs\n');

test('a search walks every document, not the first', () => {
  /* Both corpora gloss a morpheme `fox`, 11 sentences each. Seeded together the
     answer is the sum — and the hits must name sentences in both documents, or
     the walk stopped at the first. */
  H.seed([TURKISH, CHINESE]);
  eq(S.docs.length, 2, 'two documents seeded');
  const h = hitsOf({ query: 'fox', field: 'gloss', level: 'morpheme' });
  eq(h.length, 22, 'hits');
  const docs = new Set(sentSet(h).map(id => id.split('.')[0]));
  sameSet([...docs], [TR_DOC, CN_DOC], 'both documents are represented');
});

done();
