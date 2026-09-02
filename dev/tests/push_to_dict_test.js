/**
 * push_to_dict_test.js. S1 "save token to dictionary" tests
 *
 * Verifies the push (word-edit → lexicon upsert, audit finding F2) in
 * isolation. Slices the routine + its real deps (normForm, lookupDict,
 * _makeDictEntry, _indexDictEntry) out of LingCoT.html and stubs initProv/S, so
 * the FILL-ONLY-UPSERT invariant (never clobber curated dict values) and index
 * upkeep are exercised against the actual shipped code.
 *
 * Run:  node dev/tests/push_to_dict_test.js   (exit 0 = pass)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');
const JS   = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

// Brace-matching slicer (skips the param list so `opts = {}` doesn't fool it).
function sliceFn(name) {
  const start = JS.indexOf('function ' + name);
  if (start < 0) throw new Error('cannot slice ' + name);
  let p = JS.indexOf('(', start), pd = 0, q = p;
  for (; q < JS.length; q++) {
    if (JS[q] === '(') pd++;
    else if (JS[q] === ')') { pd--; if (pd === 0) { q++; break; } }
  }
  let i = JS.indexOf('{', q), depth = 0;
  for (; i < JS.length; i++) {
    if (JS[i] === '{') depth++;
    else if (JS[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return JS.slice(start, i);
}

// ── Harness globals / stubs ───────────────────────────────────────────────────
global.initProv = () => ({ prov: { annotator_id: 'ann_real', date: '2026-06-13' }, prov_history: [] });
/* v3.14.108 (S3): the push now reports what it did instead of filling
   silently. Captured rather than discarded, so the assertions below can check
   the REPORT as well as the data, a fill nobody is told about is the defect
   S3 exists to remove. */
global._notes   = [];
global.linkNote = (key, vars) => global._notes.push({ key, vars });
/* v3.14.260: linkTo writes the link AND its stamp, so the two stamp makers come
   along. Stubbed rather than loaded: prov() reaches into annotator session state
   this guard has no business setting up, and what is asserted here is WHICH of
   the two was used, not what either produces. */
global._derivedFieldProv = () => ({ annotator_id: null, annotator: 'auto (lexicon)',
                                    date: '2026-06-13', derived: true });
global.prov              = () => ({ annotator_id: 'ann_real', date: '2026-06-13' });
global.S = {
  dictionary:    [],
  dictByForm:    new Map(),
  dictById:      new Map(),
  dictByLemmaId: new Map(),
  dictMorphemes: [],
};


/* v3.14.261, B-137: `stampField` is the one writer of a field_prov entry and it
   INTERNS, so the runtime provenance table comes with it. Real functions rather
   than stubs, because what these guards assert is which moment was stored, and a
   stub that skipped interning would assert the shape the format left behind. */
global.S = Object.assign(global.S || {}, { provEvents: [] });
global._provEventKey = new Map();
// D35 A1: _indexDictEntry now numbers homographs, so the numbering pair loads too.
for (const fn of ['normForm', 'normMeta', 'lookupDict', 'dictResolution', 'resolveDictEntry', 'homographSiblings',
                  '_numberBucket', 'assignHomographs', '_makeDictEntry', '_indexDictEntry',
                  'internProv', 'thinProv', '_provKeyOf', 'stampField', 'fieldProv',   // B-137
                  /* B-173, v3.14.335: a fill into a shared entry now stamps the
                     fields and the object, so the real writers load with it. */
                  'applyProvToObj', 'appendProv', 'carryProv',
                  'isDerived',   // D35 B1: dictResolution reads the dict_id stamp
                  'linkTo',   // v3.14.260, B-121
                  /* v3.14.267, D51 stage 2: the writer takes CANDIDATES now, and
                     building them from a word is `tokenCandidates`. Both load,
                     because the cases below are about the pair — which forms
                     become entries, and what happens when they do. */
                  /* v3.14.268, stage 3: the deciding is `candidateRows`, and
                     `tokenCandidates` is that plus an answer. */
                  /* B-196, v3.14.374: a row now carries what it and the entry
                     it would fold into DISAGREE about, so the reader loads too. */
                  'candidateClash', 'clashDecides',
                  /* B-197: the same reader, asked of a morpheme row and its link. */
                  'findDictEntry', 'morphLinkClash',
                  '_wordSeeds', 'candidateRows', 'visibleRows', 'rememberPush',
                  'resetPushMemory', 'tokenCandidates', 'createEntries']) {
  vm.runInThisContext(sliceFn(fn), { filename: fn + '.js' });
}
/* Taken from the source rather than restated: the list of fields a candidate
   may carry is the writer's contract, and a copy here would let the two drift
   exactly the way the two save tails did (B-058). */
{
  const src = require('./_source.js').read('LingCoT.html');
  for (const name of ['_CANDIDATE_FIELDS', '_CLASH_FIELDS', '_CLASH_DECIDES', '_ROW_ONLY', '_PK_BUCKETS']) {
    const decl = new RegExp(`const ${name} = \\[[^\\]]*\\];`).exec(src);
    if (!decl) throw new Error(`${name} declaration not found in LingCoT.html`);
    vm.runInThisContext(decl[0], { filename: name + '.js' });
  }
  vm.runInThisContext('let _pkMemory = { word: null, first: null, later: null };');
}

// Reset dictionary state between tests.
function resetDict(entries = []) {
  S.dictionary    = [];
  S.dictByForm    = new Map();
  S.dictById      = new Map();
  S.dictByLemmaId = new Map();
  S.dictMorphemes = [];
  for (const e of entries) _indexDictEntry(e);
}
const wordEntries = f => lookupDict(f).filter(e => e.type === 'word');

// ── Tiny framework ────────────────────────────────────────────────────────────
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

/* The old signature, kept as a helper so every case below still reads as
   "push this token". `push(word, pick)` was exactly this pair, and
   what stage 2 changed is that they can now be called apart — a candidate with
   no `link` is an entry created from nothing, which is B-140's case. */
const push = (word, pick) => createEntries(tokenCandidates(word, pick)).created;

console.log('\nS1 the push: tokenCandidates + createEntries\n');
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ════════════════════════════════════════════════════════════════════════════
test('Creates a word entry from a token with no existing dict entry', () => {
  resetDict();
  const word = { id: 'w1', form: 'cats', gloss: 'feline.PL', part_of_speech: 'NOUN', morphemes: [] };
  const n = push(word).length;
  eq(n, 1, 'one new entry');
  const we = wordEntries('cats');
  eq(we.length, 1, 'one word entry');
  eq(we[0].gloss, 'feline.PL', 'gloss copied');
  eq(we[0].part_of_speech, 'NOUN', 'pos copied');
  eq(we[0].type, 'word', 'type word');
  assert(S.dictById.has(we[0].id), 'indexed by id');
  // G32: the token is linked to the created entry by stable id.
  eq(word.dict_id, we[0].id, 'word.dict_id stamped to new entry');
});

test('G32: push stamps dict_id on word + morphemes (create AND match)', () => {
  resetDict();
  const word = {
    id: 'w1', form: 'cats', gloss: 'cat.PL',
    morphemes: [{ form: 'cat', gloss: 'cat', type: 'root' }, { form: '-s', gloss: 'PL' }],
  };
  push(word);
  eq(word.dict_id, wordEntries('cats')[0].id, 'word linked');
  eq(word.morphemes[0].dict_id, lookupDict('cat')[0].id, 'morpheme cat linked');
  eq(word.morphemes[1].dict_id, lookupDict('-s')[0].id, 'morpheme -s linked');

  /* B-121, v3.14.260. This test has been called "push stamps dict_id" since it
     was written, and "stamps" meant "sets the id": it asserted the three lines
     above and nothing about provenance, while `the push` wrote the link
     at four sites and stamped at none. 91 of the live corpus's 92 links went out
     unsigned with this green. The name now describes what it checks.

     Derived, not human. The annotator ticked a box to push the token; they did
     not choose WHICH entry, the app matched it. Claiming their name here would
     make "chosen by a person" meaningless before D35 B4 makes it possible. */
  for (const [label, obj] of [['word', word], ['morpheme cat', word.morphemes[0]],
                              ['morpheme -s', word.morphemes[1]]]) {
    /* v3.14.261: resolved, not read raw — `field_prov` holds an index now that
       B-137 made every writer intern, and the moment is what this asserts on. */
    const fp = fieldProv(obj, 'dict_id');
    assert(fp, `${label}: the link carries a stamp`);
    assert(fp.derived === true,
           `${label}: stamped derived — the app matched it, nobody chose it`);
  }
  // Re-push (idempotent) → links resolve to the same matched entries.
  const before = word.dict_id;
  push(word);
  eq(word.dict_id, before, 'word stays linked to same entry on re-push');
});

/* D35 B1, v3.14.277. EDITED ON PURPOSE, which is the rule stage C states for
   `variation_fields_test.js` and applies here for the same reason: this guard
   asserted the GUESS. Its "form fallback" case set up two entries for `bank`,
   asked for one, and pinned whichever the Map bucket happened to yield first —
   insertion order standing in for an answer, asserted as correct.

   What replaces it is the same fixture asking the same question and getting
   `ambiguous`. The three cases that were never about ambiguity are unchanged. */
test('D35 B1 dictResolution: id wins, a unique form resolves, an ambiguous one does not', () => {
  resetDict([
    { id: 'd_river', form: 'bank', type: 'word', gloss: 'riverbank',
      alternate_forms: [], comments: [], transliterations: [] },
    { id: 'd_money', form: 'bank', type: 'word', gloss: 'financial institution',
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  // A stored link is authoritative, ambiguity or not — that is what A1 bought.
  const linked = dictResolution({ form: 'bank', dict_id: 'd_money' });
  eq(linked.state, 'linked', 'a stored id resolves');
  eq(linked.entry.id, 'd_money', 'and picks the right homograph');
  eq(resolveDictEntry({ form: 'bank', dict_id: 'd_money' }).id, 'd_money', 'the thin reader agrees');

  // THE CHANGE: no id, two candidates → nothing is chosen, and both are offered.
  const amb = dictResolution({ form: 'bank' });
  eq(amb.state, 'ambiguous', 'an ambiguous form resolves to ambiguous, not to entries[0]');
  eq(amb.entry, null, 'and to NO entry — a guess is not an answer');
  eq(amb.cands.length, 2, 'both candidates come back for the chooser');
  eq(resolveDictEntry({ form: 'bank' }), null, 'so the thin reader returns null');

  // The link survives a form edit, and a stale id is not a link.
  eq(resolveDictEntry({ form: 'banks', dict_id: 'd_money' }).id, 'd_money', 'link survives form edit');
  eq(dictResolution({ form: 'bank', dict_id: 'gone' }).state, 'ambiguous',
     'a stale id falls through to the form, which is ambiguous — it does not invent a link');
  eq(dictResolution({ form: 'zzz', dict_id: 'gone' }).state, 'none', 'no match → none');
  eq(resolveDictEntry({ form: 'zzz', dict_id: 'gone' }), null, 'and the thin reader returns null');

  // A unique form still resolves, and says the app matched it rather than a person.
  resetDict([{ id: 'd_one', form: 'kuzey', type: 'word', gloss: 'north',
               alternate_forms: [], comments: [], transliterations: [] }]);
  const uniq = dictResolution({ form: 'kuzey' });
  eq(uniq.state, 'unique', 'one entry for the form resolves');
  eq(uniq.entry.id, 'd_one', 'to that entry');
  eq(uniq.derived, true, 'and is marked derived: it is a match nobody wrote');
});

/* D35 B3, v3.14.277. A second entry for a form that already has one.
   `createEntries` re-asks the dictionary itself, so the panel's own answer is
   not enough — every signal it has (a matching form, a matching type) is
   exactly what a FILL looks like, which is why the intent is declared on the
   candidate rather than inferred from it. */
test('D35 B3: new_anyway creates a sibling instead of filling the entry it names', () => {
  resetDict([{ id: 'd_first', form: 'metin', type: 'word', gloss: 'text',
               alternate_forms: [], comments: [], transliterations: [] }]);
  const before = S.dictionary.length;

  // Without the flag this is the ordinary idempotent push: fill, never create.
  createEntries([{ form: 'metin', kind: 'word', type: 'word', gloss: 'text' }]);
  eq(S.dictionary.length, before, 'a plain candidate for an existing form creates nothing');

  const { created } = createEntries([{ form: 'metin', kind: 'word', type: 'word',
                                       gloss: 'body of a text', new_anyway: true }]);
  eq(S.dictionary.length, before + 1, 'new_anyway creates the sibling');
  eq(created.length, 1, 'and reports it as created, not as a fill');
  eq(created[0].gloss, 'body of a text', 'with its own values, not the first entry’s');
  eq(created[0].id !== 'd_first', true, 'and its own id');
  eq(lookupDict('metin').find(e => e.id === 'd_first').gloss, 'text',
     'the entry it was rejected in favour of is untouched');

  // D35 A1's retroactive numbering does its job the moment the form is shared.
  const sibs = lookupDict('metin');
  eq(sibs.every(e => !!e.homograph), true, 'both entries are numbered once the form is ambiguous');
  eq(new Set(sibs.map(e => e.homograph)).size, sibs.length, 'and the numbers are distinct');
});

test('Creates morpheme entries for each morpheme', () => {
  resetDict();
  const word = {
    id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN',
    morphemes: [
      { form: 'cat', gloss: 'cat', part_of_speech: 'NOUN', type: 'root' },
      { form: '-s',  gloss: 'PL',  part_of_speech: 'AFFIX' },
    ],
  };
  const n = push(word).length;
  eq(n, 3, 'word + 2 morphemes');
  eq(lookupDict('cat')[0].type, 'root', 'morpheme type preserved');
  eq(lookupDict('-s')[0].type, 'bound.morpheme', 'default morpheme type');
  eq(lookupDict('-s')[0].gloss, 'PL', 'morpheme gloss copied');
  eq(lookupDict('-s')[0].part_of_speech, 'AFFIX', 'morpheme pos copied');
});

test('FILL-ONLY: existing entry with values is NOT overwritten', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: 'CURATED', part_of_speech: 'PROPN',
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  const word = { id: 'w1', form: 'cats', gloss: 'token-gloss', part_of_speech: 'NOUN', morphemes: [] };
  const n = push(word).length;
  eq(n, 0, 'no new entry');
  const we = wordEntries('cats');
  eq(we.length, 1, 'still one entry (no dup)');
  eq(we[0].gloss, 'CURATED', 'curated gloss untouched');
  eq(we[0].part_of_speech, 'PROPN', 'curated pos untouched');
});

test('FILL-ONLY: existing entry with EMPTY fields gets filled', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: null, part_of_speech: null,
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  const word = { id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN', morphemes: [] };
  const n = push(word).length;
  eq(n, 0, 'no new entry (filled existing)');
  const we = wordEntries('cats');
  eq(we[0].gloss, 'cat.PL', 'empty gloss filled');
  eq(we[0].part_of_speech, 'NOUN', 'empty pos filled');
});

/* B-173, v3.14.335. A dictionary is shared: a push writes into entries other
   people made, and until now it wrote them with no provenance at all — no
   `stampField`, no object stamp, no history — while `linkTo` on the next line
   stamped the link. Every surface still named the entry's original author. */
test('B-173: a fill into somebody else’s entry is stamped', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: null, part_of_speech: null,
      prov: { annotator_id: 'ann_other', date: '2020-01-01' },
      prov_history: [{ annotator_id: 'ann_other', date: '2020-01-01' }],
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  /* NO lemma on this word, deliberately: the lemma branch stamps the object too,
     so a word carrying one would mask a missing stamp on the fields branch —
     verified by mutation, where it did exactly that. */
  const word = { id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN',
                 morphemes: [] };
  push(word);
  const e = wordEntries('cats')[0];

  assert(e.field_prov && e.field_prov.gloss != null,
         'the gloss it wrote carries a field stamp');
  assert(e.field_prov.part_of_speech != null, 'and so does the part of speech');

  /* The pusher's own, not derived, and the asymmetry with the link is the
     decision: they saw these values in the panel — which names the fields it
     will fill — and ticked the row. A person decided the VALUES. The link is
     derived because `linkTo` resolved which entry by form match, and nobody
     chose that. */
  eq(fieldProv(e, 'gloss').annotator_id, 'ann_real',
     'stamped as the annotator who pushed, because they chose to push it');
  assert(!isDerived(fieldProv(e, 'gloss')),
         'not derived — the panel showed these values and they ticked the row');

  eq(e.prov.annotator_id, 'ann_real', 'the entry has a last person to touch it');
  assert((e.prov_history || []).length > 1,
         'and the trail grew rather than being replaced',
         JSON.stringify(e.prov_history));
  eq(e.prov_history[0].annotator_id, 'ann_other',
     'the original author is still at the head of it');
});

test('B-173: and the lemma it links is stamped too', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: 'cat.PL', part_of_speech: 'NOUN',
      prov: { annotator_id: 'ann_other', date: '2020-01-01' },
      prov_history: [{ annotator_id: 'ann_other', date: '2020-01-01' }],
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  /* Every field already filled, so ONLY the lemma changes — the fields branch
     cannot supply the stamps this asserts. */
  push({ id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN',
         lemma_id: 'lem_cat', morphemes: [] });
  const e = wordEntries('cats')[0];
  eq(e.lemma_id, 'lem_cat', 'the lemma is linked');
  assert(e.field_prov && e.field_prov.lemma_id != null,
         'and stamped — it is a claim about the lexeme and was equally unattributed');
  eq(e.prov.annotator_id, 'ann_real', 'and the entry records who made that claim');
});

test('B-173: an entry a push does not change is not stamped', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: 'cat.PL', part_of_speech: 'NOUN',
      prov: { annotator_id: 'ann_other', date: '2020-01-01' },
      prov_history: [{ annotator_id: 'ann_other', date: '2020-01-01' }],
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  push({ id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN', morphemes: [] });
  const e = wordEntries('cats')[0];
  eq(e.prov.annotator_id, 'ann_other',
     'a push that fills nothing leaves the entry attributed to whoever made it');
  eq((e.prov_history || []).length, 1, 'and adds nothing to the trail');
});

test('Links lemma_id onto a newly created word entry', () => {
  resetDict();
  const word = { id: 'w1', form: 'cats', gloss: 'cat.PL', lemma_id: 'lem_cat', morphemes: [] };
  push(word);
  const we = wordEntries('cats')[0];
  eq(we.lemma_id, 'lem_cat', 'lemma linked');
  assert(S.dictByLemmaId.get('lem_cat')?.includes(we), 'indexed by lemma');
});

test('Links lemma onto an existing unlinked word entry (fill-only)', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: 'cat.PL',
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  const word = { id: 'w1', form: 'cats', lemma_id: 'lem_cat', morphemes: [] };
  push(word);
  const we = wordEntries('cats')[0];
  eq(we.lemma_id, 'lem_cat', 'lemma linked onto existing entry');
  assert(S.dictByLemmaId.get('lem_cat')?.includes(we), 'lemma index updated');
});

test('Does NOT relink lemma when existing entry already has one', () => {
  resetDict([
    { id: 'd1', form: 'cats', type: 'word', gloss: 'cat.PL', lemma_id: 'lem_OLD',
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  const word = { id: 'w1', form: 'cats', lemma_id: 'lem_NEW', morphemes: [] };
  push(word);
  eq(wordEntries('cats')[0].lemma_id, 'lem_OLD', 'existing lemma link preserved');
});

test('Idempotent: pushing the same token twice creates no duplicates', () => {
  resetDict();
  const word = {
    id: 'w1', form: 'cats', gloss: 'cat.PL', part_of_speech: 'NOUN',
    morphemes: [{ form: 'cat', gloss: 'cat', type: 'root' }],
  };
  const n1 = push(word).length;
  const n2 = push(word).length;
  eq(n1, 2, 'first push creates 2');
  eq(n2, 0, 'second push creates 0');
  eq(wordEntries('cats').length, 1, 'no word dup');
  eq(lookupDict('cat').length, 1, 'no morpheme dup');
});

test('Blank form / no morphemes is a no-op', () => {
  resetDict();
  eq(push({ id: 'w1', form: '', morphemes: [] }).length, 0, 'blank form → 0');
  eq(push(null).length, 0, 'null word → 0');
  eq(S.dictionary.length, 0, 'nothing added');
});

test('Morpheme matches an existing word-type entry (fills, no dup)', () => {
  // A morpheme form that already exists as a standalone word entry should be
  // filled, not duplicated as a separate bound.morpheme.
  resetDict([
    { id: 'd1', form: 'cat', type: 'word', gloss: null,
      alternate_forms: [], comments: [], transliterations: [] },
  ]);
  const word = { id: 'w1', form: 'cat', gloss: 'cat',
    morphemes: [{ form: 'cat', gloss: 'cat', type: 'root' }] };
  const n = push(word).length;
  // word 'cat' already exists (filled); morpheme 'cat' matches it too (filled) → 0 new
  eq(n, 0, 'no new entries');
  eq(lookupDict('cat').length, 1, 'no duplicate cat entry');
  eq(lookupDict('cat')[0].gloss, 'cat', 'gloss filled');
});

/* ── B-068, the push is per form, not per word ──────────────────────────────
   One checkbox used to mean five entries or none. These run the shipped
   routine with a selection and count what reached the dictionary, because the
   defect was never in the checkbox, it was that nothing downstream could
   express "the stem, not the three suffixes". */

const AGGLUT = () => ({
  id: 'w1', form: 'evde', gloss: 'at.the.house',
  morphemes: [
    { form: 'ev', gloss: 'house', type: 'root' },
    { form: 'de', gloss: 'LOC' },
  ],
});

test('B-068: stem only, the suffix and the surface form are skipped', () => {
  resetDict();
  const created = push(AGGLUT(), { word: false, morphemes: [true, false] });
  eq(created.length, 1, 'one entry created');
  eq(created[0].form, 'ev', 'and it is the stem');
  eq(wordEntries('evde').length, 0, 'no entry for the surface form');
  eq(lookupDict('de').length, 0, 'no entry for the suffix');
});

test('B-068: a skipped morpheme is not linked either', () => {
  resetDict();
  const w = AGGLUT();
  push(w, { word: false, morphemes: [true, false] });
  eq(!!w.morphemes[0].dict_id, true, 'pushed morpheme carries dict_id');
  eq(w.morphemes[1].dict_id, undefined, 'skipped morpheme has none');
  eq(w.dict_id, undefined, 'skipped word form has none');
});

test('B-068: the surface form can be pushed on its own', () => {
  resetDict();
  const created = push(AGGLUT(), { word: true, morphemes: [false, false] });
  eq(created.length, 1, 'one entry');
  eq(created[0].form, 'evde', 'the surface form');
});

test('B-068: no selection means push everything, as before', () => {
  resetDict();
  eq(push(AGGLUT()).length, 3, 'word + both morphemes');
  resetDict();
  eq(push(AGGLUT(), {}).length, 3, 'an empty selection is not a refusal');
});

test('B-068: an all-off selection writes nothing at all', () => {
  resetDict();
  eq(push(AGGLUT(), { word: false, morphemes: [false, false] }).length, 0, 'no entries');
  eq(S.dictionary.length, 0, 'dictionary untouched');
});

// ════════════════════════════════════════════════════════════════════════════
/* ── B-085: one control in the word view, the picker asks which forms ────────
   Word-edit used to carry three kinds of checkbox: a master, a
   disabled-until-master surface-form box, and one per morpheme row. The
   decision was spread across the form and had to be kept in sync as the parse
   was typed. The agreed design is one control, and WHICH forms asked once at
   the moment of pushing. */
{
  const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');
  const html = read('LingCoT.html');
  const all  = decomment([html, ...Object.values(Object.fromEntries(moduleFiles()))].join('\n'));
  const save0 = () => fnSrc('LingCoT.html', 'saveWord') || '';

  check(/id="ew-push-dict"/.test(html), 'word-edit still has its one push control');
  for (const gone of ['ew-push-dict-word', 'morph-push-cb', 'syncPushDictState'])
    check(!new RegExp(gone).test(all), `${gone} is gone, not merely unused`,
          'a control left in the markup with nothing reading it is the shape B-081 and B-101 both took');

  check(/function openAddDictModal\(/.test(html), 'openAddDictModal() is defined');
  check(/function closeAddDictModal\(/.test(html), 'closeAddDictModal() is defined');
  check(/id="pk-overlay"/.test(html) && /id="pk-box"/.test(html),
        'and it has an overlay');
  /* v3.14.269, B-112: there is ONE. The second overlay held the completion
     modal, which asked what the entries were after they had been written. */
  check(!/id="cd-overlay"/.test(html) && !/id="cd-box"/.test(html),
        'and only one — the completion modal\'s is gone with it',
        '       two panels, neither showing the whole thing being made, is B-112');

  /* B-068's rule has to survive the move: the surface form starts OFF for a
     word with a parse, because `evde` is not a lexeme and `ev` is, and ON for a
     word that has no parse and therefore IS its own form. */
  /* v3.14.268: B-068's defaults moved into the model, so they are EXECUTED here
     rather than matched in the picker's source. That is the better claim —
     the picker used to compute them and could drift from what the writer did. */
  const open = fnSrc('LingCoT.html', 'openAddDictModal') || '';
  check(/rows \|\| \[\]/.test(open) && /visibleRows\(/.test(open),
        'the panel takes ROWS rather than a word, and draws the visible ones',
        '       taking a word is the signature that made B-140 possible; stage 5 opens '
      + 'this from the dictionary, where there is no word');
  check(/candidateRows\(\{ word \}\)/.test(save0()),
        'and saveWord is what turns its word into rows');
  {
    resetDict();
    resetPushMemory();
    const parsed = { id: 'w1', form: 'evde', morphemes: [{ form: 'ev' }, { form: '-de' }] };
    const rows = candidateRows({ word: parsed });
    check(rows[0].kind === 'word' && rows[0].on === false,
          "B-068: the surface form starts OFF for a word with a parse",
          '       `evde` is not a lexeme and `ev` is');
    check(rows.slice(1).every(r => r.on === true), 'and every morpheme starts on');

    const bare = { id: 'w2', form: 'ev', morphemes: [] };
    check(candidateRows({ word: bare })[0].on === true,
          'a word with no parse starts ON, because it IS its own form');
  }

  /* Nothing may be written before the answer. This is the whole reason the
     picker precedes the push rather than living in the completion modal. */
  const save = save0();
  check(/openAddDictModal\(candidateRows\(\{ word \}\), _finishSave\)/.test(save),
        'saveWord hands the panel its continuation');
  const pushCalls = [...save.matchAll(/createEntries\(/g)];
  check(pushCalls.length === 1, 'saveWord writes entries in exactly one place');
  const finish = /const _finishSave = \(picked\) => \{[\s\S]*?\n  \};/.exec(save);
  check(!!finish, '_finishSave is where it happens');
  if (finish) {
    check(/if \(_finished\) return;/.test(finish[0]),
          'and runs once, however the panel was dismissed',
          'Escape and a button can both arrive; advancing twice would skip a word');
    check(/if \(picked && picked\.length\)/.test(finish[0]), 'a null answer pushes nothing');
    /* v3.14.269: the panel hands over candidates, so the handler has nothing
       left to decide and nothing left to ask afterwards. */
    check(!/openCompletionModal/.test(finish[0]),
          'and nothing is asked after the write, because nothing is left to ask');
    check(/logEvent\('info', 'word saved'/.test(finish[0]),
          'the word is still saved when nothing is pushed',
          'the word fields are already written by then, so a skip must not abandon them');
  }
  const cands = fnSrc('LingCoT.html', '_pkCandidates') || '';
  check(/out\.length \? out : null/.test(cands),
        'ticking nothing is treated as skipping');
}


/* ══ D51 stage 2 · the writer with no word behind it ═════════════════════════
   The whole reason the signature changed. `_pushTokenToDict(word, pick)` could
   not express "create this entry" without a word to point at, which is why the
   dictionary could only be written from a corpus token (B-140). A candidate
   carries no `link` in that case, and nothing else about the write changes. */
console.log('\ncreateEntries with no corpus token\n');

test('creates an entry from a candidate that links to nothing', () => {
  resetDict();
  const { created, touched } = createEntries([
    { form: 'bilgisayar', kind: 'word', type: 'word',
      part_of_speech: 'NOUN', gloss: 'computer', meaning: 'an electronic device' },
  ]);
  eq(created.length, 1, 'one entry created');
  eq(created[0].form, 'bilgisayar', 'with the form asked for');
  eq(created[0].gloss, 'computer', 'the gloss');
  eq(created[0].part_of_speech, 'NOUN', 'the part of speech');
  eq(created[0].meaning, 'an electronic device',
     'and the definition, which no push has ever carried');
  eq(touched.length, 1, 'and it is reported as written, so the journal has it');
  assert(S.dictById.has(created[0].id), 'indexed by id');
  eq(lookupDict('bilgisayar').length, 1, 'and by form');
});

test('a linkless candidate that matches an existing entry fills it and links nothing', () => {
  resetDict([_makeDictEntry('ev', 'word', null, null)]);
  const before = lookupDict('ev')[0];
  const { created } = createEntries([
    { form: 'ev', kind: 'word', type: 'word', part_of_speech: 'NOUN', gloss: 'house' },
  ]);
  eq(created.length, 0, 'nothing new, because the form is already there');
  eq(before.gloss, 'house', 'the empty field was filled');
  eq(before.part_of_speech, 'NOUN', 'and so was the other one');
});

test('fill-only holds without a link, exactly as it does with one', () => {
  const kept = _makeDictEntry('ev', 'word', 'PROPN', 'curated');
  resetDict([kept]);
  createEntries([{ form: 'ev', kind: 'word', type: 'word', part_of_speech: 'NOUN', gloss: 'house' }]);
  eq(kept.gloss, 'curated', 'a curated gloss survives');
  eq(kept.part_of_speech, 'PROPN', 'and a curated part of speech');
});

test('a candidate with no form is skipped rather than making an empty entry', () => {
  resetDict();
  eq(createEntries([{ kind: 'word', gloss: 'x' }, null, { form: '', kind: 'word' }]).created.length, 0,
     'three unusable candidates, no entries');
  eq(S.dictionary.length, 0, 'and nothing in the dictionary');
});

test('kind decides which existing entry counts as a match', () => {
  /* A word looks for a word-typed entry; a morpheme takes whatever is there.
     This is the difference the two old branches encoded separately, and it is
     what keeps a second push of the same token idempotent. */
  resetDict([_makeDictEntry('ev', 'bound.morpheme', null, null)]);
  const asWord = createEntries([{ form: 'ev', kind: 'word', type: 'word' }]);
  eq(asWord.created.length, 1, 'a word candidate does not match a bound.morpheme entry');
  resetDict([_makeDictEntry('ev', 'bound.morpheme', null, null)]);
  const asMorph = createEntries([{ form: 'ev', kind: 'morpheme', type: 'bound.morpheme' }]);
  eq(asMorph.created.length, 0, 'a morpheme candidate does');
});

test('a lemma belongs to the lexeme, so only a word candidate carries one', () => {
  resetDict();
  const { created } = createEntries([
    { form: 'ev',  kind: 'word',     type: 'word',           lemma_id: 'L1' },
    { form: '-de', kind: 'morpheme', type: 'bound.morpheme', lemma_id: 'L1' },
  ]);
  eq(created[0].lemma_id, 'L1', 'the word entry takes it');
  assert(!created[1].lemma_id, 'the morpheme entry does not');

  /* And the same on the FILL path, which is a separate branch and was the one
     a mutation slipped through: an existing morpheme entry must not acquire a
     lemma either, or `dictByLemmaId` starts holding affixes. */
  const wordE  = _makeDictEntry('ev',  'word', null, null);
  const morphE = _makeDictEntry('-de', 'bound.morpheme', null, null);
  resetDict([wordE, morphE]);
  createEntries([
    { form: 'ev',  kind: 'word',     type: 'word',           lemma_id: 'L2' },
    { form: '-de', kind: 'morpheme', type: 'bound.morpheme', lemma_id: 'L2' },
  ]);
  eq(wordE.lemma_id, 'L2', 'an existing word entry is linked to the lemma');
  assert(!morphE.lemma_id, 'an existing morpheme entry is not');
  eq((S.dictByLemmaId.get('L2') || []).length, 1,
     'and the lemma bucket holds the word entry only');
});


/* ══ D51 stage 3 · the candidate model ═══════════════════════════════════════
   Pure: context in, rows out. Everything below runs it. */
console.log('\ncandidateRows: what is on offer, and how it starts\n');

test('B-111: a monomorphemic word and its only morpheme are marked as one', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'Ben', morphemes: [{ form: 'ben' }] };
  const rows = candidateRows({ word: w });
  eq(rows.length, 2, 'both are still rows — the index shape the picker uses is untouched');
  eq(rows[1].mergedInto, 0, 'the morpheme is marked as the word row');
  eq(visibleRows(rows).length, 1, 'and a surface draws one of them');
  /* The case must fold, because that is why the two look like duplicates: a
     sentence-initial capital and the segment it parses to. */
  assert(normForm('Ben') === normForm('ben'), 'the guard\'s own premise holds');
});

test('B-148: the surviving row keeps what the annotator said on the merged one', () => {
  resetDict(); resetPushMemory();
  /* The rule, not the instance: whatever the annotator DECLARED on the lone
     morpheme is what the one remaining row offers. `'word'` on the word seed is
     minted by `_wordSeeds` for every word alike and loses to a statement. */
  const w = { id: 'w1', form: '\u708e\u70ed',
              morphemes: [{ form: '\u708e\u70ed', type: 'root', gloss: 'hot' }] };
  const rows = candidateRows({ word: w });
  const [shown] = visibleRows(rows);
  eq(rows.length, 2, 'still two rows — the merge marks, it does not remove');
  eq(shown.kind, 'word', 'and the word row is the one that survives');
  eq(shown.type, 'root', 'carrying the morpheme\'s declared type, not the minted \'word\'');
  eq(shown.gloss, 'hot', 'and its gloss, because the word row had none');

  /* The word's own values are the annotator's too, and are not overwritten. */
  const w2 = { id: 'w2', form: 'ev', gloss: 'house', part_of_speech: 'NOUN',
               morphemes: [{ form: 'ev', gloss: 'dwelling' }] };
  const [kept] = visibleRows(candidateRows({ word: w2 }));
  eq(kept.gloss, 'house', 'the word\'s gloss stands');
  eq(kept.type, 'word', 'and an undeclared morpheme type carries nothing up');

  /* And the carry reaches the WRITE, not just the row. */
  const { created } = createEntries(tokenCandidates(w, [0]));
  eq(created.length, 1, 'one entry');
  eq(created[0].type, 'root', 'stored with the declared type');
});

test('and a word whose morpheme differs is two rows, still', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'evde', morphemes: [{ form: 'ev' }, { form: '-de' }] };
  eq(visibleRows(candidateRows({ word: w })).length, 3, 'word plus two morphemes');
  const one = { id: 'w2', form: 'evler', morphemes: [{ form: 'ev' }] };
  eq(visibleRows(candidateRows({ word: one })).length, 2,
     'one morpheme that is NOT the word is not merged away');
});

test('the existence lookup says which entry a form has and what would be filled', () => {
  const bare = _makeDictEntry('ev', 'word', null, null);
  resetDict([bare]); resetPushMemory();
  const w = { id: 'w1', form: 'ev', gloss: 'house', part_of_speech: 'NOUN', morphemes: [] };
  const [row] = candidateRows({ word: w });
  eq(row.existing, bare, 'the entry already there is attached to the row');
  eq(JSON.stringify(row.fills), JSON.stringify(['part_of_speech', 'gloss']),
     'and the fields this push would fill are named');

  /* The fill-only rule, from the row's side: a curated field is not in `fills`,
     which is what makes the marker honest rather than decorative. */
  const curated = _makeDictEntry('ev', 'word', 'PROPN', 'curated');
  resetDict([curated]);
  eq(candidateRows({ word: w })[0].fills.length, 0,
     'an entry that already says everything would have nothing filled');
});

test('and `fills` agrees with what the writer actually does', () => {
  /* The two could drift, and that drift IS B-112: a marker that says one thing
     while the write does another is worse than no marker. Both come off
     _CANDIDATE_FIELDS, and this proves it by running the write. */
  const e = _makeDictEntry('ev', 'word', null, null);
  resetDict([e]); resetPushMemory();
  const w = { id: 'w1', form: 'ev', gloss: 'house', part_of_speech: 'NOUN', morphemes: [] };
  const promised = candidateRows({ word: w })[0].fills.slice();
  const before = Object.fromEntries(promised.map(f => [f, e[f]]));
  createEntries(tokenCandidates(w, null));
  for (const f of promised) assert(e[f] && e[f] !== before[f], `${f} was actually filled`);
  eq(candidateRows({ word: w })[0].fills.length, 0, 'and nothing is promised twice');
});

test('a seed with no corpus token gets a row too', () => {
  resetDict(); resetPushMemory();
  const [row] = candidateRows({ seeds: [{ form: 'bilgisayar', kind: 'word', type: 'word',
                                          bucket: 'word', on: true, gloss: 'computer' }] });
  eq(row.form, 'bilgisayar', 'the form comes through');
  eq(row.existing, null, 'nothing exists for it yet');
  assert(!row.link, 'and there is nothing to link back to — B-140\'s case');
});

console.log('\nthe session habit: three buckets, and no further\n');

test('a remembered bucket overrides the default, and only that bucket', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'evde', morphemes: [{ form: 'ev' }, { form: '-de' }] };
  const rows = candidateRows({ word: w });
  eq(rows[0].on, false, 'the surface form starts off, as B-068 says');

  // The annotator keeps the surface form and drops the affix.
  rememberPush(rows, [true, true, false]);

  const next = candidateRows({ word: { id: 'w2', form: 'evler',
                                       morphemes: [{ form: 'ev' }, { form: '-ler' }] } });
  eq(next[0].on, true,  'the next word remembers that the surface form was kept');
  eq(next[1].on, true,  'the first morpheme is unchanged');
  eq(next[2].on, false, 'and later morphemes are off, which is the habit');
});

test('the buckets are three, not one per form', () => {
  resetDict(); resetPushMemory();
  const rows = candidateRows({ word: { id: 'w1', form: 'evde',
                                       morphemes: [{ form: 'ev' }, { form: '-de' }, { form: '-ki' }] } });
  eq(JSON.stringify(rows.map(r => r.bucket)),
     JSON.stringify(['word', 'first', 'later', 'later']),
     'word, first morpheme, later morphemes');
  /* Remembering a habit per FORM would not generalise to the next word, which is
     the whole argument for buckets. Keeping one late affix and dropping another
     records "later morphemes: yes", because the habit is whether to push affixes
     at all, not which ones. */
  rememberPush(rows, [false, true, true, false]);
  const next = candidateRows({ word: { id: 'w2', form: 'yoldan',
                                       morphemes: [{ form: 'yol' }, { form: '-dan' }] } });
  eq(next[2].on, true, 'any kept row in a bucket makes the bucket a yes');
});

test('a bucket that was not on screen is not recorded', () => {
  resetDict(); resetPushMemory();
  const bare = candidateRows({ word: { id: 'w1', form: 'ev', morphemes: [] } });
  rememberPush(bare, [false]);   // only the word bucket was offered
  const parsed = candidateRows({ word: { id: 'w2', form: 'evde',
                                         morphemes: [{ form: 'ev' }, { form: '-de' }] } });
  eq(parsed[0].on, false, 'the word bucket was recorded');
  eq(parsed[1].on, true,  'the morpheme buckets keep their defaults');
  eq(parsed[2].on, true,  'a word with no morphemes says nothing about morphemes');
});

test('opening a corpus clears it, because the habit is about a language', () => {
  const { decomment, fnSrc } = require('./_source.js');
  const apply = decomment(fnSrc('LingCoT.html', 'applyCorpus') || '');
  check(/resetPushMemory\(\)/.test(apply),
        'applyCorpus resets the push habit',
        '       a habit that followed the annotator into another corpus is a claim '
      + 'about a different language, which is why it is not persisted either');
});

test('the habit is session state, and clearing it restores the defaults', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'evde', morphemes: [{ form: 'ev' }, { form: '-de' }] };
  rememberPush(candidateRows({ word: w }), [true, false, false]);
  eq(candidateRows({ word: w })[1].on, false, 'the habit is in force');
  resetPushMemory();
  eq(candidateRows({ word: w })[1].on, true, 'and gone when the session is reset');
});

console.log('\nrows carry presentation; candidates do not\n');

test('tokenCandidates hands the writer a candidate, never a row', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'ev', gloss: 'house', morphemes: [] };
  const [c] = tokenCandidates(w, null);
  for (const k of _ROW_ONLY)
    assert(!(k in c), `${k} does not reach the writer`);
  eq(c.form, 'ev', 'while the candidate itself is intact');
  eq(c.link, w, 'link included, because the writer needs it');
});

test('the pick still selects by word and morpheme, whatever the row order', () => {
  resetDict(); resetPushMemory();
  const w = { id: 'w1', form: 'evde', morphemes: [{ form: 'ev' }, { form: '-de' }] };
  const forms = p => tokenCandidates(w, p).map(c => c.form);
  eq(JSON.stringify(forms(null)), JSON.stringify(['evde', 'ev', '-de']), 'null is everything');
  eq(JSON.stringify(forms({ word: false, morphemes: [true, true] })),
     JSON.stringify(['ev', '-de']), 'the surface form can be dropped');
  eq(JSON.stringify(forms({ word: true, morphemes: [false, true] })),
     JSON.stringify(['evde', '-de']), 'and one morpheme');
  eq(forms({ word: false, morphemes: [false, false] }).length, 0, 'or all of them');
});


/* ══ D51 stage 4 · ONE surface, and it says what it will do ══════════════════
   B-112: "the picker asks which, without saying what; the second asks what, one
   at a time, after it is already saved." One panel now, before the write. What
   is executable here is the ROW — it is a pure function of a row object — so
   the markup is rendered and read rather than grepped. */
console.log('\nthe add-to-dictionary panel\n');
{
  const vmm = require('vm');
  const { fnSrc, decomment, read, locale } = require('./_source.js');
  const LOC = locale();
  const rowCtx = {
    console,
    t: (k, v) => {
      let out = LOC[k] !== undefined ? LOC[k] : `MISSING(${k})`;
      for (const [kk, vv] of Object.entries(v || {})) out = out.split(`{${kk}}`).join(vv);
      return out;
    },
    esc: x => String(x == null ? '' : x),
    escAttr: x => String(x == null ? '' : x),
    icon: () => '', wantedMark: () => '<span class="required">*</span>',
    homographSup: e => (e && e.homograph ? `<sup>${e.homograph}</sup>` : ''),
    chipRowHtml: id => `<div class="chip-row" id="${id}-chips"></div>`,
    tierOf: require('../../source/modules/field_spec.js').tierOf,
    isEmptyValue: require('../../source/modules/field_spec.js').isEmptyValue,
    fieldOf: require('../../source/modules/field_spec.js').fieldOf,
    LING_ATTRS: '', LING_ATTRS_UPPER: '',
    POS_CHOICES: ['NOUN'], TYPE_CHOICES: ['word'],
  };
  vmm.createContext(rowCtx);
  /* B-197: the state line asks whether a disagreement DECIDES identity. Read
     from the source rather than restated — a copy here would let the threshold
     drift, which is exactly the measurement that set it. */
  vmm.runInContext(/const _CLASH_DECIDES = \[[^\]]*\];/.exec(read('LingCoT.html'))[0], rowCtx);
  for (const fn of ['clashDecides', '_pkFieldLabel', 'pkStateHtml', 'pkFillsHtml', 'pkRowHtml'])
    vmm.runInContext(fnSrc('LingCoT.html', fn), rowCtx, { filename: fn });
  const draw = r => { rowCtx.__r = r; return vmm.runInContext('pkRowHtml(__r, 0)', rowCtx); };

  /* Every locale key the row names must exist, or the annotator reads the key.
     Asserted by rendering with a real locale, so a typo cannot pass. */
  // Nothing filled in: every core field is a question, which is why the panel exists.
  const anyRow = draw({ form: 'ev', kind: 'word', fills: [], existing: null, on: true });
  check(!/MISSING\(/.test(anyRow), 'every locale key the row uses exists',
        (anyRow.match(/MISSING\([^)]*\)/g) || []).join(', '));

  check(/id="pk-type-0"/.test(anyRow) && /id="pk-pos-0"/.test(anyRow)
     && /id="pk-gloss-0"/.test(anyRow) && /id="pk-meaning-0"/.test(anyRow),
        'a row shows the four fields the completion modal used to ask for, AFTER the write',
        '       B-112: what is committed — type, part of speech, the link — was shown by neither panel');
  check(/type="checkbox"/.test(anyRow), 'and the tick that says whether to create it at all',
        '       which is what the picker asked, in a different panel');

  /* D57 §3, rendered. "See AND fix": the row shows a stored entry readonly,
     because a push fills blanks and never overwrites, so the way to correct one
     is the entry editor. A row with nothing to edit must not offer the door —
     and this is checked by DRAWING both, because a door on every row is a
     dangling control, which is B-158's whole family. */
  check(!/pk-edit-entry/.test(anyRow),
        'a row with no existing entry offers no way to edit one',
        '       there is nothing behind that door until an entry exists');
  const hasRow = draw({ form: 'ev', kind: 'word', fills: [], on: true,
                        existing: { id: 'd1', form: 'ev', gloss: 'house' } });
  check(/pk-edit-entry/.test(hasRow) && /data-entry-id="d1"/.test(hasRow),
        'and a row that HAS one carries the door, addressed to that entry',
        '       the panel can hold several rows and only some have an answer to correct');
  check(!/MISSING\(/.test(hasRow), 'the door\'s own strings are in the locale',
        (hasRow.match(/MISSING\([^)]*\)/g) || []).join(', '));

  /* B-152. The rule, both ways: what is about to be written is open, what is
     not is folded. Read off `<details ... open>` rather than a class, because
     the fold is the browser's state and a class beside it would be a second
     writer of one thing. */
  {
    const offRow = draw({ form: 'ev', kind: 'word', fills: [], existing: null, on: false });
    const openAttr = html => /<details[^>]*\sopen[\s>]/.test(html);
    check(openAttr(anyRow), 'a ticked row opens on the panel it is drawn into',
          '       the annotator has to see what the tick commits, without a click per row');
    check(!openAttr(offRow), 'and an unticked one stays folded',
          '       a row that will not be written is a line to skim past');
    check(/class="pk-cand pk-on"/.test(anyRow) && /class="pk-cand"/.test(offRow),
          'the dim class still tracks the tick independently of the fold',
          '       the tick toggles the class at runtime and must not fight the fold');
  }

  /* B-099, carried across: an empty core field is a question and must look like
     one. `meaning` is aux and is never marked, which is the point. */
  {
    /* Per label, not "does the word 'required' appear": the first draft of this
       check was an `||` that passed whenever the mark appeared anywhere. */
    const labelled = lbl => new RegExp(
      `<span class="es-lbl">${lbl}<span class="required">`).test(anyRow);
    const F = require('../../source/modules/field_spec.js');
    const lab = k => rowCtx.t(F.fieldOf('dict_entry', k).label);
    for (const k of ['type', 'part_of_speech', 'gloss'])
      check(labelled(lab(k)), `${k} is core and empty, so it is marked (B-099)`,
            '       the panel exists because the push leaves fields empty; an empty box '
          + 'that does not look like a question is what B-099 was');
    check(!labelled(lab('meaning')),
          'and `meaning` is aux, so it is never marked',
          '       leaving a definition blank is a legitimate answer, which is the '
        + 'whole point of the tier distinction');
  }
  const full = draw({ form: 'ev', kind: 'word', type: 'word', gloss: 'house',
                      part_of_speech: 'NOUN', fills: [], existing: null, on: true });
  check(!/class="required"/.test(full), 'and a row with nothing missing carries no mark');

  /* The fill-only rule, said out loud — the half B-112 says the annotator could
     not see. An existing entry shows as existing, names what would be filled,
     and its stored values are not editable here because the write will keep
     them. */
  const stored = { id: 'e1', form: 'ev', type: 'word', gloss: 'curated' };
  const over = draw({ form: 'ev', kind: 'word', type: 'word', gloss: 'house',
                      part_of_speech: 'NOUN', existing: stored,
                      fills: ['part_of_speech'], on: true });
  check(/label.pk.exists|already in the dictionary/.test(over),
        'a form already in the dictionary says so');
  check(/will fill/.test(over), 'and names the fields this push would fill');
  check(/id="pk-gloss-0"[^>]*readonly/.test(over),
        'a stored value is shown read-only, because the push will not overwrite it',
        '       an editable box over a value the write keeps is a lie about what happens');
  check(/value="curated"/.test(over), 'and it is the STORED value that is shown');
  check(!/id="pk-pos-0"[^>]*readonly/.test(over),
        'while an empty field on that entry stays editable — it is the one in play');

  const nothingLeft = draw({ form: 'ev', kind: 'word', type: 'word', gloss: 'house',
                             existing: { id: 'e1', form: 'ev', type: 'word', gloss: 'house' },
                             fills: [], on: true });
  check(/nothing left to fill/.test(nothingLeft),
        'an entry this push would not change says that too',
        '       silence there reads as a failed push, which is how fill-only looked before');

  /* B-111 becomes visible: the model marks the merged row, the panel draws
     visibleRows, so the annotator is not asked to choose between duplicates. */
  /* B-196: the draw is `_pkRender` now; `openAddDictModal` decides `_pkDraw` and
     hands over. Both halves are asked, because splitting them is exactly how one
     could start drawing every row again. */
  const open = decomment(fnSrc('LingCoT.html', 'openAddDictModal'));
  const drawFn = decomment(fnSrc('LingCoT.html', '_pkRender'));
  check(/visibleRows\(_pkRows\)/.test(open + drawFn),
        'B-111: the panel draws the visible rows, not every row',
        '       `Ben` and its only morpheme `ben` were listed as two, both ticked');
  check(/_pkRows\.indexOf\(r\)/.test(drawFn),
        'while ids still index the full list, so the answer survives the filter');
  check(/r\.mergedInto !== undefined\) ticked\[i\] = ticked\[r\.mergedInto\]/.test(drawFn),
        'and a merged row takes the answer of the row it merged into',
        '       same lexeme, same decision — it is not a row that was silently dropped');

  /* Nothing is written until the panel is answered. B-085's rule, and the reason
     the merge went this way round rather than growing the completion modal. */
  const finish = decomment(fnSrc('LingCoT.html', 'saveWord'));
  const iOpen = finish.indexOf('openAddDictModal(');
  const iWrite = finish.indexOf('createEntries(');
  check(iOpen > -1 && iWrite > -1 && iWrite < iOpen,
        'the write is inside the continuation the panel is handed',
        '       minting entries and then unminting them is what B-085 rejected');
}

/* ══ D51 stage 5 · every route through one panel ═════════════════════════════
   Three ways in, one surface, one writer. B-140 closes here: the blank row is
   the case the app has never had. */
const { fnSrc: FS, decomment: DC, read: RD } = require('./_source.js');
console.log('\nthe three routes\n');
{
  const fnSrc = FS, decomment = DC, read = RD;
  const src = decomment(read('LingCoT.html'));

  /* One place decides what happens after the write, so the routes cannot drift
     the way the two save handlers did (B-058). */
  const one = decomment(fnSrc('LingCoT.html', 'openAddDict'));
  check(/createEntries\(picked\)/.test(one), 'openAddDict writes through createEntries');
  check(/backPropagate\(e, opts\.word, opts\.sent\)/.test(one),
        'and gives the token back through the one tail, when there is a token');
  check(/if \(opts\.word\)/.test(one),
        'guarded, because two of the three routes have no word at all');
  check(/go\('dict'/.test(one),
        'then opens the entry it made in the editor',
        '       the panel asks four fields; the other eight live there');
  check(/created\[0\] \|\| touched\[0\]/.test(one),
        'the CREATED entry is the one opened, not one that was merely filled',
        '       a fill went into an entry that already existed; the annotator was not editing it');

  /* Every route reaches the panel, and only through this. */
  const callers = ['addDictForMorpheme', 'addDictBlank']
    .map(n => [n, decomment(fnSrc('LingCoT.html', n))]);
  for (const [n, body] of callers)
    check(/openAddDict\(/.test(body), `${n} goes through openAddDict`);
  /* saveWord is the exception and says why: it has a continuation of its own,
     because the word must be saved whether or not anything is pushed. */
  const sw = decomment(fnSrc('LingCoT.html', 'saveWord'));
  check(/openAddDictModal\(candidateRows\(\{ word \}\), _finishSave\)/.test(sw),
        'and saveWord keeps its own continuation, deliberately',
        '       a skipped push must still save the word');

  // The definition is not a call site, which is why this excludes it.
  const opens = (src.match(/(?<!function )openAddDictModal\(/g) || []).length;
  check(opens === 2,
        `the panel itself is opened from exactly two places (${opens})`,
        '       openAddDict for the two dictionary routes, saveWord for the push — '
      + 'a third would be a route that skipped one of them');
}

console.log('\nB-140: a word with nothing behind it\n');

test('the blank row is editable, unlinked, and starts ticked', () => {
  resetDict(); resetPushMemory();
  const body = FS('LingCoT.html', 'addDictBlank');
  assert(/form: ''/.test(body), 'no form: it is typed');
  assert(/editable: true/.test(body), 'so the row draws an input');
  assert(!/link/.test(body), 'and nothing to link back to');
  assert(/on: true/.test(body), 'ticked, because the annotator asked for it');
});

test('a typed form is read back, and an empty one makes nothing', () => {
  /* `_pkCandidates` reads `pk-form-<i>` only for the editable row, and refuses a
     candidate with no form — otherwise "New entry" then "Add" would create an
     entry with an empty headword, which `createEntries` would skip silently. */
  const body = FS('LingCoT.html', '_pkCandidates');
  assert(/read\('form', 'form'\)/.test(body), 'the typed form is read');
  assert(/if \(!c\.form\) return;/.test(body), 'and an empty one is refused here');
});

test('the panel re-asks the dictionary as the form is typed', () => {
  /* The existence marker is the whole of B-112's answer, and on a typed row it
     has to arrive before the save rather than after. */
  const open = DC(FS('LingCoT.html', '_pkRender'));
  assert(/\.pk-form-input/.test(open), 'the typed form has a listener');
  assert(/candidateRows\(\{ seeds: \[r\] \}\)/.test(open),
         'which re-asks the MODEL rather than looking up the dictionary itself');
  assert(/pkStateHtml\(r\)/.test(open) && /pkFillsHtml\(r, i\)/.test(open),
         'and repaints only the two spans that depend on the answer');
  assert(!/box\.innerHTML =[\s\S]{0,200}pkRowHtml/.test(open),
         'never the whole row, which would discard what has been typed into it');
});

test('a blank row becomes an entry, end to end', () => {
  /* The model and the writer, joined the way the panel joins them. */
  resetDict(); resetPushMemory();
  const [row] = candidateRows({ seeds: [{ form: 'bilgisayar', kind: 'word', type: 'word',
                                          bucket: 'word', on: true, editable: true }] });
  eq(row.existing, null, 'nothing exists for it');
  const c = { ...row };
  for (const k of _ROW_ONLY) delete c[k];
  c.gloss = 'computer';
  const { created } = createEntries([c]);
  eq(created.length, 1, 'one entry');
  eq(created[0].form, 'bilgisayar', 'with the typed form');
  eq(created[0].gloss, 'computer', 'and what was typed beside it');
  assert(!created[0].dict_id, 'and nothing was linked, because there was nothing to link');
});

/* ── D57 · the morpheme route into the dictionary ──────────────────────────────
   B-163: `+ dict` on the only morpheme of a monomorphemic word did nothing at
   all — no panel, no write, no log line. Five correct lines composed into it:
   `addDictForMorpheme` selects the row whose `link` is that morpheme, B-111's
   merge has marked that row `mergedInto`, `visibleRows` drops it,
   `openAddDictModal`'s no-overlay bail-out reads the empty draw as a skip, and
   `openAddDict` finds no `onSkip`.

   SYNTHETIC, AND WITH AN EMPTY DICTIONARY — both deliberate. The column offers
   `+ dict` only when the form is absent from the lexicon, so an annotated corpus
   hides the case entirely; that is how it survived D51's six stages and their
   falsification runs. And the rule is about SHAPE, not about three particular
   Turkish words, so it is built here rather than swept from a fixture that D58
   is about to replace. */
console.log('\n— D57: + dict on a morpheme —\n');
{
  const mono = { id: 'w1', form: 'daha', morphemes: [{ id: 'w1.m1', form: 'daha' }] };
  const poly = { id: 'w2', form: 'evde',
                 morphemes: [{ id: 'w2.m1', form: 'ev' }, { id: 'w2.m2', form: 'de' }] };

  /* THE REAL FUNCTION, executed. A first draft of this guard reimplemented the
     selection here and asserted against its own copy — which passes whatever the
     app does, and was caught by mutation: replacing the handoff with `row = row`
     restored B-163 with every check green. So `addDictForMorpheme` is loaded and
     run, and what it hands to `openAddDict` is what is asserted.

     Only its edges are stubbed: the corpus lookup, the panel, and the log. */
  let __handed = null, __warned = [];
  global.findWord   = id => __words[id] || null;
  global.openAddDict = (rows, opts) => { __handed = { rows, opts }; };
  global.logEvent   = (lvl, msg, det) => { if (lvl === 'warn') __warned.push(`${msg} ${det || ''}`); };
  vm.runInThisContext(sliceFn('addDictForMorpheme'), { filename: 'addDictForMorpheme.js' });

  let __words = {};
  /* Returns the row the panel would actually draw, or null — which is exactly
     what B-163 produced and nothing noticed. */
  const pick = (word, i) => {
    __words = { [word.id]: { word, sent: { id: 's1' } } };
    __handed = null; __warned = [];
    addDictForMorpheme(word.id, 's1', i);
    if (!__handed) return null;
    const drawn = visibleRows(__handed.rows);
    return drawn.length === 1 ? drawn[0] : null;
  };

  resetDict([]);
  resetPushMemory();

  /* The merge is right and stays: on SAVE, a word whose single morpheme folds to
     its own form must not be offered twice. This asserts the condition that made
     `+ dict` fail, so the fix cannot be "stop merging". */
  const monoRows = candidateRows({ word: mono });
  const merged = monoRows.find(r => r.mergedInto !== undefined);
  assert(!!merged && merged.link === mono.morphemes[0],
         'B-111 still merges the morpheme of a monomorphemic word into the word row');
  assert(visibleRows(monoRows).length === 1,
         'so the SAVE panel still offers one row for one lexeme, not two');

  /* THE DEFECT ITSELF, so the block below is not just the guard agreeing with
     its own copy of the fix. The selection B-163 shipped — filter to the row
     whose `link` is this morpheme — yields a row the panel will not draw, and
     the two selections must differ here or there was never a bug. */
  const naive = (word, i) =>
    candidateRows({ word }).filter(x => x.link === word.morphemes[i]);
  assert(visibleRows(naive(mono, 0)).length === 0,
         'the shipped selection finds a row the panel drops — B-163, reproduced');
  assert(visibleRows(naive(poly, 1)).length === 1,
         'and it worked for a multi-morpheme word, which is why this survived');

  /* The defect, and the rule. Every morpheme must lead somewhere drawable. */
  for (const [word, label] of [[mono, 'monomorphemic'], [poly, 'multi-morpheme']]) {
    for (let i = 0; i < word.morphemes.length; i++) {
      const row = pick(word, i);
      assert(!!row && row.mergedInto === undefined && visibleRows([row]).length === 1,
             `+ dict on ${label} ${JSON.stringify(word.form)} morpheme ${i} `
             + `(${JSON.stringify(word.morphemes[i].form)}) reaches a drawable row`);
    }
  }

  /* B-148's carry is what makes the handoff lossless: the surviving row must
     still say what the MORPHEME said, or `+ dict` on it would create an entry
     missing the annotator's own declaration. */
  const m = { id: 'w3.m1', form: 'tilki', type: 'root', gloss: 'fox', part_of_speech: 'NOUN' };
  const w3 = { id: 'w3', form: 'Tilki', gloss: '', morphemes: [m] };
  const handed = pick(w3, 0);
  eq(handed.type, 'root', 'the handoff carries the morpheme\'s own type (B-148)');
  eq(handed.gloss, 'fox', 'and its gloss');
  eq(handed.part_of_speech, 'NOUN', 'and its part of speech');
  eq(handed.kind, 'word',
     'as a word candidate — a single-morpheme word IS a word (B-069)');

  /* Case, because the merge folds and `Güneş`/`güneş` is the live instance. */
  const cased = { id: 'w4', form: 'Güneş', morphemes: [{ id: 'w4.m1', form: 'güneş' }] };
  assert(!!pick(cased, 0), '+ dict works where the word and its morpheme differ only in case');

  /* The row it hands over is TICKED — it was clicked, so the question the panel
     asks is what to create, not whether. */
  assert(pick(mono, 0).on === true, 'and the row arrives ticked, because it was clicked');

  /* And it never hands the panel a row the panel will drop, which is the whole
     of B-163 stated as a property of the handover. */
  __words = { [mono.id]: { word: mono, sent: { id: 's1' } } };
  __handed = null;
  addDictForMorpheme(mono.id, 's1', 0);
  assert(__handed && visibleRows(__handed.rows).length === __handed.rows.length,
         'every row handed to the panel is one the panel will draw');

  /* A morpheme index that does not exist is a warning, not a silent return —
     the silence is what made B-163 take a live session to notice. */
  __warned = [];
  addDictForMorpheme(mono.id, 's1', 7);
  assert(__warned.length === 1, 'a missing morpheme is logged, not swallowed');

  /* D57 §2: the two reasons a panel draws nothing are not the same reason. No
     overlay is a missing element and the defaults stand; no ROW is a bad
     question, and a bad question asked silently is B-163 again. */
/* B-196, v3.14.374: the panel's DRAW and WIRING moved into `_pkRender`, so that
   the sibling door — the one control that must rebuild its row — is visibly a
   repaint rather than a third route into the panel. `openAddDictModal` keeps the
   setup and the guards; assertions about markup and listeners read `_pkRender`. */
  const modal = require('./_source.js').fnSrc('LingCoT.html', 'openAddDictModal') || '';
  const draw  = require('./_source.js').fnSrc('LingCoT.html', '_pkRender') || '';
  assert(!/if \(!overlay \|\| !box \|\| !_pkDraw\.length\)/.test(modal),
         'openAddDictModal no longer folds "no overlay" and "no rows" into one bail-out');
  assert(/_pkDraw\.length/.test(modal) && /logEvent\('warn'/.test(modal),
         'and warns when it is handed nothing to draw');

  /* D57 §3: see AND fix. Stored fields are readonly because `createEntries` is
     fill-only, which is honest — but until now the only way out was to commit to
     a write first. */
  const rowHtml = require('./_source.js').fnSrc('LingCoT.html', 'pkRowHtml') || '';
  assert(/pk-edit-entry/.test(rowHtml),
         'a row with an existing entry offers a way into the entry editor');
  assert(/const editDoor = r\.existing/.test(rowHtml),
         'and ONLY a row that has one — there is nothing to edit otherwise');
  /* Order matters and is the decision: close (a skip, writing nothing), then
     navigate. Reversed, the door would push first and land wherever the
     continuation left the annotator. */
  assert(/closeAddDictModal\(null\);\s*\n?\s*go\('dict'/.test(draw),
         'taking that door closes the panel FIRST, so nothing is written, then navigates');
}

/* ── B-183: the tick is not inside the row's <summary> ─────────────────────
   Opening a `<details>` is the summary's ACTIVATION BEHAVIOUR — the default
   action of the click, not a listener on it — so a checkbox inside the summary
   shares one default action with the disclosure and no handler can separate
   them. `stopPropagation` does not cancel a default action; `preventDefault`
   cancels both, and a checkbox's canceled activation then restores the state the
   browser flipped before any listener ran, which stopped the tick moving at all.

   THE PREVIOUS VERSION OF THIS GUARD ASSERTED THE SHAPE OF THAT SECOND FIX —
   capture, preventDefault, manual flip — and passed against code that could not
   toggle. A shape is not a behaviour, and this is the third time that distinction
   has cost a version here. So the structural claim is what is asserted now (the
   tick is not a descendant of the summary, which no timing can undo) and the
   BEHAVIOURAL one is `gui_crud_test.js`'s, in a real browser, where a click can
   actually be made. */
{
  const rowHtml2 = DC(FS('LingCoT.html', 'pkRowHtml') || '');
  assert(rowHtml2 !== '', 'the row builder is in the source');
  const summary = (rowHtml2.match(/<summary>([\s\S]*?)<\/summary>/) || ['', ''])[1];
  assert(summary !== '', 'the row still has a summary');
  assert(!/type="checkbox"/.test(summary),
         'and the tick is NOT inside it',
         '       inside, the tick and the disclosure are one default action and\n'
       + '       every handler that tried to split them made it worse');
  assert(/<div class="pk-row">[\s\S]{0,240}type="checkbox"[\s\S]{0,240}<details/.test(rowHtml2),
         'the tick is a sibling of the details, before it in the row');

  /* Scoped to the TICK's wiring, not to the panel. `preventDefault` on the edit
     door two blocks down is correct and stays: a `<button type="button">` has no
     default action of its own, so cancelling there cancels only the summary's
     fold — which is the same analysis that says it is the wrong tool for a
     checkbox, where it cancels the tick too. */
  const modal = DC(FS('LingCoT.html', '_pkRender') || '');
  const wiring = (modal.match(/querySelectorAll\('\.pk-row'\)[\s\S]{0,400}?\n  \}\);/) || [''])[0];
  assert(wiring !== '', 'the tick wiring can be found');
  for (const [pat, why] of [
    [/stopPropagation/, 'it cannot cancel a default action'],
    [/preventDefault/,  'it cancels the tick as well as the disclosure'],
    [/\}, true\)/,      'capture runs after the browser has already flipped the tick'],
  ]) assert(!pat.test(wiring),
            `the tick's wiring does not reach for ${String(pat).slice(1, -1)} — ${why}`,
            '       the structure removed the conflict; a handler fighting it here\n'
          + '       is a sign the tick went back inside the summary');
}

/* ═══ B-196 · a form in the dictionary is not always the same word ══════════
   Reported: *"add-to-dict fields are out-of-date. I clicked the wrong chip, then
   fixed, but the add-to-dictionary copied the chip values not the updated ones.
   And the type, POS, and gloss entries cannot be edited in this window."*

   Both halves were the same cause. Turkish `DA` is two morphemes — the locative
   suffix (`bound.morpheme` · `AFFIX` · `LOC`) and the particle "too"
   (`functional.word` · `PART` · `too`). The annotator annotated the particle;
   `existing` is `found[0]`, the first entry with that form; the panel showed the
   SUFFIX's three values under the particle's headword, said "nothing left to
   fill", rendered them readonly because the push is fill-only, and offered no
   way to say these are different words. The values were not stale — they were a
   different lexeme's, presented as this one's.

   THE RULE. A missing field is nothing to argue with; two different answers are.
   `_CLASH_FIELDS` are the three short controlled claims about what a form IS, and
   the panel must not assert an identity that its own two sides contradict.

   `new_anyway` — D35 B3's — was already the model's word for "I know an entry
   with this form exists and I want a second one", already honoured by
   `createEntries`, and settable from exactly one route: B-140's typed blank row.
   The model could say it and no surface could. This is the surface. */
console.log('\nB-196 — a clashing entry is not a fill\n');
{
  /* The row renderers in their own sandbox, the same way the D51 §4 block above
     builds one — they are view code and need a DOM-shaped world, while
     everything else in this file runs against the model. */
  const rc = {
    console, t: (k, v) => `${k}(${JSON.stringify(v || {})})`,
    esc: x => String(x == null ? '' : x), escAttr: x => String(x == null ? '' : x),
    icon: () => '', wantedMark: () => '*',
    homographSup: e => (e && e.homograph ? `<sup>${e.homograph}</sup>` : ''),
    chipRowHtml: id => `<div class="chip-row" id="${id}-chips"></div>`,
    tierOf: require('../../source/modules/field_spec.js').tierOf,
    isEmptyValue: require('../../source/modules/field_spec.js').isEmptyValue,
    fieldOf: require('../../source/modules/field_spec.js').fieldOf,
    LING_ATTRS: '', LING_ATTRS_UPPER: '',
    POS_CHOICES: ['NOUN'], TYPE_CHOICES: ['word'],
  };
  vm.createContext(rc);
  vm.runInContext("const _CLASH_DECIDES = ['type'];", rc);
  for (const fn of ['clashDecides', '_pkFieldLabel', 'pkStateHtml', 'pkFillsHtml', 'pkRowHtml'])
    vm.runInContext(FS('LingCoT.html', fn), rc, { filename: fn });
  const pkStateHtml = r => { rc.__r = r; return String(vm.runInContext('pkStateHtml(__r)', rc)); };
  const pkFillsHtml = (r, i) => { rc.__r = r; return String(vm.runInContext(`pkFillsHtml(__r, ${i})`, rc)); };
  const pkRowHtml   = (r, i) => { rc.__r = r; return String(vm.runInContext(`pkRowHtml(__r, ${i})`, rc)); };

  const ENTRY = { id: 'e1', form: 'DA', type: 'bound.morpheme',
                  part_of_speech: 'AFFIX', gloss: 'LOC' };
  const PART  = { form: 'DA', kind: 'morpheme', type: 'functional.word',
                  part_of_speech: 'PART', gloss: 'too', bucket: 'first', on: true };

  test('the reader names what disagrees, and only that', () => {
    eq(JSON.stringify(candidateClash(PART, ENTRY)),
       JSON.stringify(['type', 'part_of_speech', 'gloss']),
       'all three of the live case disagree');
    eq(candidateClash({ form: 'DA' }, ENTRY).length, 0,
       'a candidate with nothing filled contradicts nothing — that is a FILL');
    eq(candidateClash({ ...PART, gloss: null }, ENTRY).length, 2,
       'an empty field on either side is not a disagreement');
    eq(candidateClash(PART, null).length, 0, 'and no entry is nothing to clash with');
    eq(candidateClash({ form: 'x', gloss: 'LOC' }, { form: 'x', gloss: 'loc' }).length, 0,
       'folded as METALANGUAGE — LOC and loc are one answer',
       );
    /* `meaning` is deliberately out: two people wording a definition differently
       is not a claim that they mean two lexemes. */
    eq(candidateClash({ form: 'x', meaning: 'a' }, { form: 'x', meaning: 'b' }).length, 0,
       'free prose is not a contradiction');
  });

  test('the row carries it, so the panel can draw it', () => {
    resetDict([ENTRY]); resetPushMemory();
    const [row] = candidateRows({ seeds: [{ ...PART }] });
    eq(row.existing && row.existing.id, 'e1', 'the form still finds the entry');
    eq(row.clash.length, 3, 'and the row knows the two are not the same word');
    eq(row.fills.length, 0, 'with nothing to fill, which is what it looked like before');
  });

  test('an honest fill is still an honest fill', () => {
    resetDict([{ id: 'e2', form: 'ev', type: 'word' }]); resetPushMemory();
    const [row] = candidateRows({ seeds: [
      { form: 'ev', kind: 'word', type: 'word', gloss: 'house', bucket: 'word', on: true }] });
    eq(row.clash.length, 0, 'an entry with empty fields contradicts nothing');
    assert(row.fills.includes('gloss'), 'and the gloss is still offered as a fill');
  });

  test('the panel says so, and offers both readings', () => {
    resetDict([ENTRY]); resetPushMemory();
    const [row] = candidateRows({ seeds: [{ ...PART }] });
    const state = pkStateHtml(row);
    assert(/is-clash/.test(state), 'the state is not "already in the dictionary"');
    /* And it says so only when the disagreement DECIDES. A row differing on the
       gloss alone is the same lexeme and must keep the ordinary state, or the
       panel cries wolf on eleven of thirteen live links. */
    const soft = candidateRows({ seeds: [{ form: 'DA', kind: 'morpheme', bucket: 'first',
                                           on: true, type: 'bound.morpheme',
                                           part_of_speech: 'AFFIX', gloss: 'in' }] })[0];
    eq(soft.clash.length, 1, 'the difference is still reported');
    assert(!/is-clash/.test(pkStateHtml(soft)),
           'but the state does not claim they are two words');
    assert(/in the dictionary|label\.pk\.exists/.test(pkStateHtml(soft)),
           'it is the ordinary "already there"');
    assert(!/label\.pk\.exists/.test(state),
           'asserting the identity is what the report was about');
    const fills = pkFillsHtml(row, 0);
    assert(/pk-new-anyway/.test(fills), 'the door to a second entry is offered');
    assert(/LOC/.test(fills) && /AFFIX/.test(fills),
           'and the entry\'s own values are named, so the annotator can see WHICH word it is');
  });

  test('taking the door changes what the boxes are', () => {
    resetDict([ENTRY]); resetPushMemory();
    const [row] = candidateRows({ seeds: [{ ...PART }] });

    const before = pkRowHtml(row, 0);
    assert(/value="LOC"/.test(before), 'folding, the boxes hold the ENTRY (fill-only)');
    assert(/readonly/.test(before), 'and are readonly, because the push will not overwrite');

    /* What the door does: it flips the flag and re-asks the MODEL. The handler
       does not clear `existing` itself — `candidateRows` honours `new_anyway`,
       so there is one decider and a surface cannot disagree with the writer. */
    row.new_anyway = true;
    const [again] = candidateRows({ seeds: [row] });
    eq(again.existing, null, 'candidateRows stops offering the entry to fold into');
    eq(again.clash.length, 0, 'so there is nothing left to clash with');
    Object.assign(row, { existing: again.existing, fills: again.fills, clash: again.clash });
    const after = pkRowHtml(row, 0);
    assert(/value="too"/.test(after) && /value="PART"/.test(after),
           'once it is a second entry the boxes hold the ANNOTATOR\'s values');
    assert(!/readonly/.test(after),
           'and are editable, because nothing of theirs is stored yet — this is\n'
         + '         the other half of the report');
    assert(/label\.pk\.new_sibling/.test(pkStateHtml(row)),
           'and the state says a second entry will be created');
    assert(/pk-new-anyway/.test(pkFillsHtml(row, 0)),
           'with the way back, because a mis-click is the other reading');

    /* And the row renderer does not depend on the model having cleared it. A
       row handed in with both `new_anyway` and `existing` set — which is what
       every caller looked like before `candidateRows` took the decision — must
       still draw the annotator's values, or the second decider comes back. */
    const both = pkRowHtml({ ...PART, new_anyway: true, existing: ENTRY, fills: [], clash: [] }, 0);
    assert(/value="too"/.test(both) && !/value="LOC"/.test(both),
           'the row folds by the DECISION, not by whether an entry exists');
    assert(!/readonly/.test(both), 'and nothing of the entry\'s is locked into it');
  });

  test('and the writer already knew how', () => {
    resetDict([ENTRY]); resetPushMemory();
    const made = createEntries([{ ...PART, new_anyway: true }]).created;
    eq(made.length, 1, 'a second entry is created rather than the first filled');
    eq(ENTRY.gloss, 'LOC', 'and the entry that was already there is untouched');
    eq(made[0].gloss, 'too', 'the new one carries the token\'s analysis');
  });

  test('the door rebuilds its row, and nothing typed is lost', () => {
    /* The one control in this panel that must re-render. Every other repaint
       touches two spans on purpose, because rebuilding discards typed input —
       so this one reads the form back into the model FIRST, with the same read
       `_pkCandidates` does at commit. Two readers of one form is how a panel
       comes to save something other than what it showed. */
    const sync = FS('LingCoT.html', '_pkSyncTyped') || '';
    assert(sync.length > 0, '_pkSyncTyped exists');
    for (const id of ['type', 'pos', 'gloss', 'meaning'])
      assert(sync.includes(`'${id}'`), `it reads pk-${id}-<i> back into the row`);
    assert(/el\.readOnly/.test(sync),
           'and skips a stored field, which is not in play');
    assert(/r\.on = cb\.checked/.test(sync),
           'the tick is read back too — a rebuild must not reset the answer');
    const draw = DC(FS('LingCoT.html', '_pkRender') || '');
    assert(/_pkSyncTyped\(\)/.test(draw), 'the door calls it before flipping');
    assert(/_pkSyncTyped[\s\S]{0,400}?_pkRender\(\)/.test(draw),
           'and redraws only after the model has the typed values');
  });

  test('readonly is visible, not merely enforced', () => {
    /* The report said the fields "cannot be edited", and they could not — by
       design, since D57 §3. Nothing said so: a readonly input focuses, selects,
       and looks exactly like one that takes text. */
    const css = RD('LingCoT.css');
    /* Asked of the RULE BODY, not of the selector appearing anywhere: the first
       draft matched the `:focus` rule and passed with the resting style gone,
       which is the style that does the telling. */
    const rule = /\.pk-fields input\[readonly\][^:{][^{]*\{([^}]*)\}/.exec(css);
    assert(!!rule, 'the panel styles its readonly boxes at rest');
    assert(/background|border-style|color/.test(rule[1]),
           'with something that reads as "not a box you type in"');
    assert(/\.pk-fields input\[readonly\]:focus[^{]*\{[^}]*outline/.test(css),
           'and drops the focus ring that made one look live');
  });
}

/* ═══ B-197 · a link the row no longer supports ═════════════════════════════
   Taking an offer chip does two things in one act: it fills fields and it
   assigns `dataset.dictId`. D42 releases the first the instant the annotator
   types over it, because the value stopped being the lexicon's. **Nothing
   released the second** — and the link is the stronger claim, that this token is
   an occurrence of that lexeme.

   FOUND IN THE FILE, not by reading. `turkish-test`'s `…w_006.m_001` is
   `too` · `PART` · `functional.word` and carries the `dict_id` of the entry
   that says `LOC` · `AFFIX` · `bound.morpheme`. The annotator took the wrong
   chip for `DA`, corrected all three fields, and the link stayed. Nothing could
   see it: the id resolves, so `danglingCompanions` is quiet by construction.

   SHOWN, NOT GUESSED. Auto-unlinking on a contradiction would drop a link the
   annotator chose deliberately and then refined; auto-keeping is what produced
   the live case. The row says the two disagree and offers to release it, and
   the save says so in the linking channel — a warning can be scrolled past, and
   what reached the file is the thing that mattered. */
console.log('\nB-197 — a corrected row keeps the wrong link\n');
{
  const ENTRY = { id: 'e9', form: 'DA', type: 'bound.morpheme',
                  part_of_speech: 'AFFIX', gloss: 'LOC' };

  test('the reader is the same one B-196 uses', () => {
    /* Not a second opinion about what "these disagree" means. One reader, three
       surfaces: the push panel, the morpheme row, and the save. */
    const src = DC(RD('LingCoT.html'));
    const fn = FS('LingCoT.html', 'morphLinkClash') || '';
    assert(fn.length > 0, 'morphLinkClash exists');
    assert(/candidateClash\(/.test(DC(fn)),
           'and asks candidateClash, rather than restating the comparison');
    assert(/findDictEntry\(/.test(DC(fn)),
           'resolving the link it is judging');
    assert((src.match(/_CLASH_FIELDS\.filter/g) || []).length === 1,
           'the comparison itself is written down once');
  });

  test('the threshold is `type`, and the corpora are why', () => {
    /* MEASURED. Across both live corpora `_CLASH_FIELDS` finds 13 linked objects
       that disagree with the entry they name. Two are the defect — `DA` and
       `AmA`, each disagreeing on all three. The other eleven are legitimate:
       `bir` glossed `a` against an entry saying `one`, `的` `of` against `LNK`,
       `yine` `ADJ` against `ADV`. A warning firing thirteen times where two
       matter is one nobody reads.

       The app's own comments had already said which field decides. B-166: a
       gloss translates the LEXEME, a part of speech is a claim about THIS TOKEN
       IN THIS SENTENCE. B-069: free or bound is a fact about the language — a
       property of the lexeme, so a token and its entry cannot honestly differ. */
    eq(clashDecides(['gloss']), false, 'a contextual gloss is not a second lexeme');
    eq(clashDecides(['part_of_speech']), false,
       'nor a per-token part of speech — B-166 is explicit that it is per token');
    eq(clashDecides(['type']), true, 'a bound morpheme and a word are two lexemes');
    eq(clashDecides(['gloss', 'part_of_speech', 'type']), true, 'in any company');
    eq(clashDecides([]), false, 'and nothing decides nothing');
  });

  test('it fires on the live case and stays quiet on an honest link', () => {
    resetDict([ENTRY]);
    const bad = morphLinkClash({ form: 'DA', gloss: 'too', part_of_speech: 'PART',
                                 type: 'functional.word', dict_id: 'e9' });
    assert(bad, 'the stored turkish-test row is reported');
    eq(bad.fields.length, 3, 'naming all three');
    eq(bad.entry.id, 'e9', 'and the entry it disagrees with');

    const good = morphLinkClash({ form: 'DA', gloss: 'LOC', part_of_speech: 'AFFIX',
                                  type: 'bound.morpheme', dict_id: 'e9' });
    eq(good, null, 'a row that agrees is not a clash');

    /* The eleven. A token that glosses its lexeme differently, or analyses this
       occurrence as a different part of speech, is doing its job. */
    eq(morphLinkClash({ form: 'DA', gloss: 'in', part_of_speech: 'AFFIX',
                        type: 'bound.morpheme', dict_id: 'e9' }), null,
       'a contextual gloss does not raise it — `bir` is `a` here and `one` there');
    eq(morphLinkClash({ form: 'DA', gloss: 'LOC', part_of_speech: 'ADV',
                        type: 'bound.morpheme', dict_id: 'e9' }), null,
       'nor a per-token part of speech — `yine` ADJ against an entry saying ADV');
    const partial = morphLinkClash({ form: 'DA', gloss: '', part_of_speech: '',
                                     type: '', dict_id: 'e9' });
    eq(partial, null, 'and an EMPTY row is not either — that is a fill waiting');
    eq(morphLinkClash({ form: 'DA', gloss: 'too' }), null, 'no link, nothing to contradict');
    eq(morphLinkClash({ form: 'DA', gloss: 'too', dict_id: 'gone' }), null,
       'a link to nothing is a dangling reference, which is another reader\'s job');
  });

  test('the row is repainted from every input the warning reads', () => {
    /* The rule `offer_strip_live_test` holds for the offer strip, applied to the
       second thing computed from those rows. A warning drawn when the view was
       rendered is a snapshot, and B-193 is what a stale one does. */
    const ev = DC(RD('modules/events.js'));
    /* THREE `input` listeners are delegated on #content — the autocomplete's, the
       identity rule's and the strips' — so the one that matters is found by what
       it contains, not by being first. `offer_strip_live_test` learned this the
       hard way and this file inherits the lesson rather than the bug. */
    const handlers = [...ev.matchAll(/contentEl\.addEventListener\('input', e => \{[\s\S]*?\n  \}\);/g)]
                       .map(m => m[0]);
    const handler = handlers.find(h => h.includes('refreshMorphSuggest'));
    assert(!!handler, 'the strip-repainting input handler found',
           `${handlers.length} delegated input listener(s), none of them the strips'`);
    assert(/refreshLinkClash\(\)/.test(handler),
           'the warning repaints as the annotator types');
    const rows = FS('LingCoT.html', '_morphRowsNow') || '';
    /* The typed FIELDS. `.morph-edit-row` is the container the scrape walks and
       `.morph-edit-form-label` is a label whose text comes from the parse, which
       has its own listener — neither is something the annotator types into. */
    const SKIP = new Set(['morph-edit-row', 'morph-edit-form-label']);
    for (const sel of [...rows.matchAll(/'\.(morph-[a-z-]+)'/g)].map(m => m[1])
                        .filter(c => !SKIP.has(c)))
      assert(handler.includes(sel),
             `.${sel} is read by the warning and must repaint it`);
    assert(/refreshLinkClash\(\);/.test(ev.slice(0, ev.indexOf("const ewParse"))),
           'and once per render, so reopening a bad word shows it before any keystroke');
  });

  test('there is a way to release it, and it releases only the link', () => {
    const ev = DC(RD('modules/events.js'));
    const unlink = /morph-unlink[\s\S]{0,600}?\n  \}\);/.exec(ev);
    assert(!!unlink, 'the unlink action is wired');
    assert(/dataset\.dictId = ''/.test(unlink[0]), 'it clears the link');
    assert(!/\.value\s*=/.test(unlink[0]),
           'and nothing else — the annotator said "not that lexeme", not "undo my work"');
    assert(/refreshLinkClash\(\)/.test(unlink[0]),
           'and repaints, because the warning read the link it just cleared');
  });

  test('the save says what it stored', () => {
    const save = DC(FS('LingCoT.html', 'saveWord') || '');
    assert(/morphLinkClash\(m\)/.test(save),
           'every saved morpheme is asked');
    assert(/linkNote\('note\.link\.clash'/.test(save),
           'and a contradiction reaches the linking channel (S3)');
    assert(!/dict_id = ''|delete m\.dict_id/.test(save),
           'the save does NOT unlink on its own',
           );
    /* The order matters: the check must run on the REBUILT morphemes, not on
       what was there when the editor opened. */
    const iBuild = save.indexOf('indexWordForms(word, r.sent)');
    const iCheck = save.indexOf('morphLinkClash(m)');
    assert(iBuild > 0 && iCheck > iBuild,
           'asked of the morphemes the save just built');
  });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
