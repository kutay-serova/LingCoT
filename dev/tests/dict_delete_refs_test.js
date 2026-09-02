#!/usr/bin/env node
/* =============================================================================
   dict_delete_refs_test.js, deleting a dictionary entry leaves nothing dangling
   Run:  node dev/tests/dict_delete_refs_test.js
   =============================================================================
   B-048. `deleteDictEntry` cleaned four dictionary indexes and never looked at
   the corpus, so `word.dict_id`, `morpheme.dict_id` and `word.lemma_id` were
   left pointing at an entry that no longer existed. The two consequences were
   not equally visible, which is why this sat unnoticed:

     - a dangling dict_id was MASKED, resolveDictEntry falls back to a form
       lookup and degrades quietly;
     - a dangling lemma_id rendered as an EMPTY Lemma field in word-edit, and
       the next save wrote null over it. The reference was destroyed rather
       than repaired, silently.

   THE POLICY (decided 2026-08-27): count the references, say how many, and on
   confirm clear all of them. Not refuse, not re-point.

   This guard executes the shipped dictEntryRefs / clearDictEntryRefs against a
   synthetic corpus. A count that misses a reference class is the failure mode,
   so each class is asserted on its own.
   ============================================================================= */

const vm = require('vm');
const { read, fnSrc: src } = require('./_source.js');
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

/* A corpus with one reference of every kind pointing at dict_1, plus decoys
   pointing at dict_2 that must survive. */
function fixture() {
  const w1 = { id: 'w_001', form: 'evler', dict_id: 'dict_1',
               morphemes: [{ form: 'ev', dict_id: 'dict_1' }, { form: 'ler', dict_id: 'dict_2' }] };
  const w2 = { id: 'w_002', form: 'evi', lemma_id: 'dict_1', morphemes: [] };
  const w3 = { id: 'w_003', form: 'kedi', dict_id: 'dict_2', lemma_id: 'dict_2', morphemes: [] };
  const eLemmaChild = { id: 'dict_3', form: 'evler', lemma_id: 'dict_1' };
  const S = {
    wordById: new Map([['w_001', { word: w1 }], ['w_002', { word: w2 }], ['w_003', { word: w3 }]]),
    dictByLemmaId: new Map([['dict_1', [eLemmaChild]], ['dict_2', [w3]]]),
    corpusLemmaRefs: new Map([['dict_1', [{ word_id: 'w_002' }]]]),
  };
  return { S, w1, w2, w3, eLemmaChild };
}

function load(S) {
  /* D52 put the clear and the repoint on one walker, and the walker moves a
     `dict_id` through `linkTo`'s move mode. So the stubs `linkTo` needs are
     here. `stampField` RECORDS rather than throws: a throw would crash the run
     at whichever section reached it first, and a guard that crashes says less
     than one that names what happened. `ctx.stamps` is the assertion. */
  const stamps = [];
  const ctx = vm.createContext({ S, console, stamps,
    lookupDict: () => [], linkNote: () => {},
    stampField: (o, k) => stamps.push(k),
    prov: () => ({}), _derivedFieldProv: () => ({}) });
  ctx.stamps = stamps;
  for (const n of ['dictEntryRefs', 'dictEntryRefCount', 'clearDictEntryRefs',
                   'repointDictEntryRefs', '_rewriteDictEntryRefs', 'linkTo',
                   '_setWordLemma', '_indexWordLemma'])
    vm.runInContext(fnSrc(n), ctx);
  return ctx;
}

console.log('\nevery reference class is found, and only the right entry\n');
{
  const f = fixture();
  const ctx = load(f.S);
  const refs = ctx.dictEntryRefs('dict_1');
  check(refs.words.length === 1 && refs.words[0].id === 'w_001', 'word.dict_id');
  check(refs.morphemes.length === 1 && refs.morphemes[0].m.form === 'ev', 'morpheme.dict_id');
  check(refs.lemmaWords.length === 1 && refs.lemmaWords[0].id === 'w_002', 'word.lemma_id');
  check(refs.entries.length === 1 && refs.entries[0].id === 'dict_3', 'a dict entry citing it as lemma');
  check(ctx.dictEntryRefCount(refs) === 4, 'the count the confirm dialog shows is 4');
  check(ctx.dictEntryRefCount(ctx.dictEntryRefs('dict_9')) === 0,
        'an unreferenced entry counts 0, so its delete keeps the plain confirm');
}

console.log('\nclearing removes every reference and nothing else\n');
{
  const f = fixture();
  const ctx = load(f.S);
  const refs = ctx.dictEntryRefs('dict_1');
  ctx.clearDictEntryRefs('dict_1', refs);

  check(!('dict_id' in f.w1), 'the word link is gone');
  check(!('dict_id' in f.w1.morphemes[0]), 'the morpheme link is gone');
  check(!('lemma_id' in f.w2), 'the word lemma is gone');
  check(!('lemma_id' in f.eLemmaChild), 'the dict entry lemma is gone');
  check(ctx.dictEntryRefCount(ctx.dictEntryRefs('dict_1')) === 0,
        'a second scan finds nothing, which is the whole point');

  check(f.w1.morphemes[1].dict_id === 'dict_2' && f.w3.dict_id === 'dict_2'
        && f.w3.lemma_id === 'dict_2',
        'references to OTHER entries are untouched',
        '         an over-broad clear is the same bug pointing the other way');
}

console.log('\nthe indexes are patched, not just the data\n');
{
  const f = fixture();
  const ctx = load(f.S);
  ctx.clearDictEntryRefs('dict_1', ctx.dictEntryRefs('dict_1'));
  check(!f.S.corpusLemmaRefs.has('dict_1'), 'corpusLemmaRefs drops the bucket');
  check(!f.S.dictByLemmaId.has('dict_1'), 'dictByLemmaId drops the bucket');
  check(f.S.dictByLemmaId.has('dict_2'), 'and keeps the others');
}

console.log('\nthe delete path uses all of it\n');
{
  const src = fnSrc('deleteDictEntry');
  check(/dictEntryRefs\(/.test(src), 'deleteDictEntry scans for references');
  check(src.indexOf('dictEntryRefs(') < src.indexOf('confirm('),
        'and scans BEFORE the confirm, so the dialog can state the count');
  check(/confirm\.entry\.delete_refs/.test(src),
        'and uses the counted message when there are references');
  check(/clearDictEntryRefs\(/.test(src), 'and clears them');
  check(/refs\.words[\s\S]{0,120}refs\.lemmaWords[\s\S]{0,160}refs\.entries/.test(src),
        'and journals every referrer the repair rewrote (D50)',
        '         a delete that journals only the removal loses the repairs, '
        + 'which under a journal is permanent rather than merely slow');
  /* v3.14.239: mutate now also carries WHAT was written, so the call spans two
     lines. The assertion is unchanged in substance — the corpus must be named
     when references were cleared — and gains a second half: the journal must
     carry the repaired referrers, not only the removal. */
  check(/mutate\(nRefs \? \['corpus', 'dict'\] : 'dict',/.test(src),
        'and marks the corpus dirty too, since clearing wrote to it',
        '         a dict-only label leaves the cleared links unsaved (B-055)');
}


console.log('\nD52 · repointing moves the same references somewhere else\n');
{
  const f = fixture();
  const ctx = load(f.S);
  f.S.dictById = new Map([['dict_2', { id: 'dict_2', form: 'evler' }]]);

  const before = ctx.dictEntryRefCount(ctx.dictEntryRefs('dict_1'));
  const moved  = ctx.repointDictEntryRefs('dict_1', ctx.dictEntryRefs('dict_1'), 'dict_2');

  /* THE central property, and the one a count can state without knowing what
     moved where: nothing is dropped in transit. A merge that loses a reference
     is the failure mode, and it looks exactly like a merge that worked. */
  check(moved === before, `every reference is moved, none dropped (${moved}/${before})`);
  check(ctx.dictEntryRefCount(ctx.dictEntryRefs('dict_1')) === 0,
        'and nothing still points at the entry that is going away');
  check(f.w1.dict_id === 'dict_2', 'the word link moved');
  check(f.w1.morphemes[0].dict_id === 'dict_2', 'the morpheme link moved');
  check(f.w2.lemma_id === 'dict_2', 'the word lemma moved');
  check(f.eLemmaChild.lemma_id === 'dict_2', 'the citing entry moved');
  check((f.S.dictByLemmaId.get('dict_2') || []).includes(f.eLemmaChild),
        'and the lemma index knows it, or the group view loses a member',
        '         _setWordLemma patches the token side; the entry side is this walker\'s');
  check(!f.S.dictByLemmaId.has('dict_1') && !f.S.corpusLemmaRefs.has('dict_1'),
        'the old id is out of both lemma indexes');
}

console.log('\nD52 · a repoint is a move, not a new link\n');
{
  const f = fixture();
  const ctx = load(f.S);
  f.S.dictById = new Map([['dict_2', { id: 'dict_2', form: 'evler' }]]);
  /* If the repoint ever falls through to the linking path it stamps, and the
     annotator's decision is silently re-attributed to whoever pressed Merge —
     B-121's damage reversed, and unrepairable for the same reason: the original
     who and when are gone. */
  ctx.repointDictEntryRefs('dict_1', ctx.dictEntryRefs('dict_1'), 'dict_2');
  check(ctx.stamps.length === 0, 'no stamp is written when a link is moved',
        `         stamped: ${ctx.stamps.join(', ')} — a move must carry the original, not replace it`);

  // And a move must name the id it replaces, or it is an unstamped blind write.
  const w = { form: 'evler', dict_id: 'dict_9' };
  check(ctx.linkTo(w, { entry: { id: 'dict_2' }, moveFrom: 'dict_1' }) === null && w.dict_id === 'dict_9',
        'a move whose moveFrom does not match is refused',
        '         otherwise the merge could repoint a token that was never on the old entry');
  check(ctx.repointDictEntryRefs('dict_1', ctx.dictEntryRefs('dict_1'), 'dict_1') === 0,
        'and merging an entry into itself moves nothing');
}

console.log('\nD52 · the merge itself, executed\n');
{
  const F = require('../../source/modules/field_spec.js');
  const f = fixture();
  /* The reported case: two entries for one form, one of them holding a field the
     other lacks, and one of them holding a field the survivor must NOT lose. */
  const keep = { id: 'dict_1', form: 'evler', type: 'word', part_of_speech: 'NOUN',
                 gloss: 'houses', meaning: null, homograph: 1, prov_history: [7] };
  const drop = { id: 'dict_2', form: 'evler', type: 'word', part_of_speech: 'VERB',
                 gloss: 'CURATED-OTHER', meaning: 'dwellings', homograph: 2, prov_history: [3, 7] };
  f.S.dictionary   = [keep, drop];
  f.S.dictById     = new Map([['dict_1', keep], ['dict_2', drop]]);
  f.S.dictByForm   = new Map([['evler', [keep, drop]]]);
  f.S.dictMorphemes = [keep, drop];
  // every reference in the fixture points at dict_1; re-aim them at the row that goes
  f.w1.dict_id = 'dict_2'; f.w1.morphemes[0].dict_id = 'dict_2';
  f.w2.lemma_id = 'dict_2'; f.eLemmaChild.lemma_id = 'dict_2';
  f.S.dictByLemmaId = new Map([['dict_2', [f.eLemmaChild]]]);
  f.S.corpusLemmaRefs = new Map([['dict_2', [{ word_id: 'w_002' }]]]);

  const ctx = load(f.S);
  Object.assign(ctx, {
    annotationKeys: F.annotationKeys, isEmptyValue: F.isEmptyValue,
    normForm: x => String(x || '').toLowerCase(),
    carryProv: () => {}, mutate: () => {}, logEvent: () => {},
    homographSiblings: form => f.S.dictByForm.get(form.toLowerCase()) || [],
    _dictSorted: null, _morphSuggestLast: null,
  });
  for (const n of ['_numberBucket', 'assignHomographs', 'mergeProvTrails', 'mergeDictEntries'])
    vm.runInContext(fnSrc(n), ctx);

  const before = ctx.dictEntryRefCount(ctx.dictEntryRefs('dict_2'));
  const r = ctx.mergeDictEntries('dict_1', 'dict_2');

  check(r.ok && r.moved === before,
        `the merge moves every reference the delete would have cleared (${r.moved}/${before})`,
        '         a merge that drops one looks exactly like a merge that worked');
  check(keep.gloss === 'houses' && keep.part_of_speech === 'NOUN',
        'FILL-ONLY: what the survivor already said is untouched',
        '         a stored value is somebody\'s, and a merge is not the moment to discard it');
  check(keep.meaning === 'dwellings' && r.filled.includes('meaning'),
        'and an empty field is filled from the row that goes');
  check(keep.id === 'dict_1', 'the survivor keeps its id — a citation that moves is not a citation');
  check(keep.homograph === 1, 'and its number, so a citation still resolves');
  check(f.w1.dict_id === 'dict_1' && f.w2.lemma_id === 'dict_1',
        'and every reference now names it');

  check(!f.S.dictById.has('dict_2') && !f.S.dictionary.includes(drop)
        && !(f.S.dictByForm.get('evler') || []).includes(drop)
        && !f.S.dictMorphemes.includes(drop),
        'the merged entry is out of all four indexes',
        '         a row left in one of them comes back on the next save or search');
  check(keep.prov_history.includes(3) && keep.prov_history.includes(7)
        && keep.prov_history.length === 2,
        'the trails are one, deduplicated — the edits happened and still show',
        `         got ${JSON.stringify(keep.prov_history)}`);

  // Refusals: the two cases where a merge is not what the annotator means.
  check(ctx.mergeDictEntries('dict_1', 'dict_1').ok === false, 'an entry cannot be merged into itself');
  const other = { id: 'dict_7', form: 'kedi', type: 'word' };
  f.S.dictById.set('dict_7', other);
  check(ctx.mergeDictEntries('dict_1', 'dict_7').reason === 'form',
        'and two different forms are not a merge, whatever the annotator clicked');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
