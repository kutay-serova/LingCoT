/**
 * ensure_morphemes_test.js. E26 morpheme materialization tests
 *
 * Verifies ensureMorphemesFromParse / reconcileMorphemesFromParse (corpus↔lexicon
 * de-synch fix) in isolation. Slices the routine + its real corpus-index deps
 * (normForm, lookupDict, indexWordForms, deindexWordForms) out of LingCoT.html and
 * stubs prov/logEvent/S, so the FILL-ONLY-EMPTY invariant and index upkeep are
 * exercised against the actual code.
 *
 * Run:  node dev/tests/ensure_morphemes_test.js   (exit 0 = pass)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');
const JS   = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

function sliceFn(name) {
  const start = JS.indexOf('function ' + name);
  if (start < 0) throw new Error('cannot slice ' + name);
  // Skip past the parameter list first, so `{}` in a default param (e.g.
  // `opts = {}`) doesn't get mistaken for the function body's opening brace.
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
const logCalls = [];
const noteCalls = [];
global.logEvent = (lvl, msg, meta) => logCalls.push({ lvl, msg, meta });
// B-073: _deriveWordFields now reports a hyphenated morpheme gloss through the
// link-note strip. Stubbed rather than made optional in the app: a `typeof fn`
// guard around a real call is how B-062 hid a ReferenceError for eight versions.
global.linkNote = (key, vars) => noteCalls.push({ key, vars });
global.prov = () => ({ annotator_id: 'ann_real', annotator: 'Tester', date: '2026-06-13', time: '12:00:00' });
/* B-180: the one chokepoint. Recorded rather than ignored, because "this path
   writes without telling the journal" is the defect, and a stub that swallowed
   the call would make it untestable. */
const mutateCalls = [];
global.mutate = (target, written) => mutateCalls.push({ target, written });
global._deriveWordFields = global._deriveWordFields || (() => new Set());
global.S = { docs: [], dictByForm: new Map(), wordFormRefs: new Map(), morphFormRefs: new Map() };


/* v3.14.261, B-137: `stampField` is the one writer of a field_prov entry and it
   INTERNS, so the runtime provenance table comes with it. Real functions rather
   than stubs, because what these guards assert is which moment was stored, and a
   stub that skipped interning would assert the shape the format left behind. */
global.S = Object.assign(global.S || {}, { provEvents: [] });
global._provEventKey = new Map();
// Real deps + the routine under test.
/* D53 stage A: the form indexes are reached only through the three accessors
   now, so they come along or indexWordForms throws on an undefined reference. */
/* D53 stage C: the three join rules are named functions now, shared with the
   preview strip, so they come along with the deriver that calls them. */
for (const fn of ['normForm', 'lookupDict', 'formRefMap', 'addFormRef', 'removeFormRef',
                  'formRefs', 'indexWordForms', 'deindexWordForms',
                  'joinParse', 'joinGloss', 'joinTranslit', 'wordGloss', 'storedWordGloss',
                  '_derivedFieldProv', '_dictFillForForm', '_deriveWordFields',
                  /* v3.14.260: dict_id and its stamp are written together by linkTo
                     now, so every path that links needs it loaded (B-121). */
                  'internProv', 'thinProv', '_provKeyOf', 'stampField', 'fieldProv', 'linkTo',   /* linkNote stays the stub above: this guard asserts
                                 which notes were raised, not how they are stored */
                  'morphFillPlan', 'applyFillPlan',
                  'ensureMorphemesFromParse', 'reconcileMorphemesFromParse',
                  'dictFillProposal', 'acceptFillGroups', 'offerCounts', 'offerFieldSummary']) {
  vm.runInThisContext(sliceFn(fn), { filename: fn + '.js' });
}

// ── Dictionary builder ────────────────────────────────────────────────────────
function setDict(entries) {
  S.dictByForm = new Map();
  for (const e of entries) {
    const k = e.form.toLowerCase();
    if (!S.dictByForm.has(k)) S.dictByForm.set(k, []);
    S.dictByForm.get(k).push(e);
  }
}
const SENT = { id: 's1' };

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

console.log('\nE26 ensureMorphemesFromParse + G28/G29\n');
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ════════════════════════════════════════════════════════════════════════════
test('Materialize: builds morphemes from parse + fills gloss/translit/type from dict', () => {
  setDict([
    { form: '언어', type: 'root', gloss: 'language', transliterations: [{ label: 'RR', text: 'eoneo' }] },
    { form: '학',   type: 'bound.morpheme', gloss: 'study' },
  ]);
  const word = { id: 'w1', form: '언어학', morphological_parse: '언어-학' }; // no morphemes
  const changed = ensureMorphemesFromParse(word, SENT, { fill: true });
  assert(changed === true, 'returns true');
  eq(word.morphemes.length, 2, 'two morphemes');
  eq(word.morphemes[0].form, '언어', 'form 0'); eq(word.morphemes[1].form, '학', 'form 1');
  eq(word.morphemes[0].gloss, 'language', 'gloss 0'); eq(word.morphemes[1].gloss, 'study', 'gloss 1');
  eq(word.morphemes[0].id, 'w1.m_001', 'id scheme');
  eq(word.morphemes[0].transliterations[0].text, 'eoneo', 'translit filled');
  eq(word.morphemes[0].type, 'root', 'type filled');
  /* D60/B-176, v3.14.347: the join is NOT stored. This asserted the opposite for
     as long as it was written, which is what made the field mean two things and
     made clearing it impossible. The reader is unaffected — that is the whole
     claim, so it is the second half of this check rather than a separate one. */
  eq(word.gloss, undefined, 'the word gloss is NOT stored, like the transliteration (D60)');
  eq(wordGloss(word), 'language-study', 'and wordGloss() composes the same string on read');
  assert(S.morphFormRefs.has('언어') && S.morphFormRefs.has('학'), 'morphFormRefs updated');
});

test('Materialize: derived field-prov has annotator_id null (invisible to rollup)', () => {
  setDict([{ form: 'a', gloss: 'A' }]);
  const word = { id: 'w2', form: 'a', morphological_parse: 'a' };
  ensureMorphemesFromParse(word, SENT, { fill: true });
  /* v3.14.261: through the resolver. `field_prov` holds an INDEX into the
     provenance table since interning, and B-137 made every writer honour that,
     so reaching into the raw map reads a number. Asserting on the stored shape
     rather than on the resolved moment is L-006's pattern. */
  const fp = fieldProv(word.morphemes[0], 'gloss');
  eq(fp.annotator_id, null, 'derived annotator_id null');
  eq(fp.derived, true, 'derived flag');
  eq(word.morphemes[0].prov.annotator_id, null, 'object prov also null annotator');
});

test('Materialize: no dict entries → forms only, glosses null, still materialized', () => {
  setDict([]);
  const word = { id: 'w3', form: 'xy', morphological_parse: 'x-y' };
  const changed = ensureMorphemesFromParse(word, SENT, { fill: true });
  assert(changed, 'changed');
  eq(word.morphemes.length, 2, 'materialized forms');
  eq(word.morphemes[0].gloss, null, 'no gloss');
  assert(!word.morphemes[0].field_prov, 'no field_prov when nothing filled');
});

test('FILL-ONLY: Enrich fills empty gloss but never overwrites a user gloss', () => {
  setDict([{ form: '언어', gloss: 'language' }, { form: '학', gloss: 'study' }]);
  const word = { id: 'w4', form: '언어학',
    morphemes: [
      { id: 'w4.m_001', form: '언어', gloss: 'MY-LEMMA-GLOSS', transliterations: [] },
      { id: 'w4.m_002', form: '학',   gloss: null,            transliterations: [] },
    ] };
  const changed = ensureMorphemesFromParse(word, SENT, { fill: true });
  assert(changed, 'changed (학 filled)');
  eq(word.morphemes[0].gloss, 'MY-LEMMA-GLOSS', 'user gloss preserved');
  eq(word.morphemes[1].gloss, 'study', 'empty gloss filled');
  assert(!word.morphemes[0].field_prov, 'untouched morpheme keeps no derived prov');
  eq(fieldProv(word.morphemes[1], 'gloss').annotator_id, null, 'filled morpheme marked derived');
});

test('Enrich: nothing fillable → no change, returns false (skip-complete path)', () => {
  setDict([{ form: 'a', gloss: 'A', transliterations: [{ label: 'X', text: 'a' }], type: 'root' }]);
  const word = { id: 'w5', form: 'a',
    morphemes: [{ id: 'w5.m_001', form: 'a', gloss: 'kept', transliterations: [{ label: 'X', text: 'kept' }], type: 'root' }] };
  const changed = ensureMorphemesFromParse(word, SENT, { fill: true });
  eq(changed, false, 'no change');
  eq(word.morphemes[0].gloss, 'kept', 'unchanged');
});

test('No parse + no morphemes → no-op (returns false)', () => {
  setDict([{ form: 'a', gloss: 'A' }]);
  const word = { id: 'w6', form: 'a' };
  eq(ensureMorphemesFromParse(word, SENT, { fill: true }), false, 'no-op');
  assert(!word.morphemes, 'no morphemes created');
});

test('Word-level gloss/parse re-derived ONLY when empty', () => {
  setDict([{ form: 'x', gloss: 'X' }, { form: 'y', gloss: 'Y' }]);
  const word = { id: 'w7', form: 'xy', morphological_parse: 'x-y', gloss: 'PRESET' };
  ensureMorphemesFromParse(word, SENT, { fill: true });
  eq(word.gloss, 'PRESET', 'preset word gloss not overwritten');
  eq(word.morphological_parse, 'x-y', 'preset parse unchanged');
});

test('Mismatch: parse names a segment the morphemes lack → enrich only, warn logged, no add', () => {
  logCalls.length = 0;
  setDict([{ form: '언어', gloss: 'language' }]);
  const word = { id: 'w8', form: '언어학', morphological_parse: '언어-학-extra',
    morphemes: [{ id: 'w8.m_001', form: '언어', gloss: null, transliterations: [] }] };
  ensureMorphemesFromParse(word, SENT, { fill: true });
  eq(word.morphemes.length, 1, 'no morpheme added for uncovered segment');
  eq(word.morphemes[0].gloss, 'language', 'existing enriched');
  assert(logCalls.some(c => /mismatch/.test(c.msg)), 'mismatch warning logged');
});

test('reconcile(false): materializes only morpheme-less+parse words', () => {
  setDict([{ form: 'p', gloss: 'P' }, { form: 'q', gloss: 'Q' }]);
  const wMissing  = { id: 'wa', form: 'pq', morphological_parse: 'p-q' };          // heal
  const wComplete = { id: 'wb', form: 'p', morphemes: [{ id: 'wb.m_001', form: 'p', gloss: 'kept', transliterations: [] }] };
  S.docs = [{ sections: [{ paragraphs: [{ sentences: [{ id: 's', words: [wMissing, wComplete] }] }] }] }];
  reconcileMorphemesFromParse();
  eq(wMissing.morphemes.length, 2, 'morpheme-less word materialized');
  eq(wComplete.morphemes[0].gloss, 'kept', 'complete word untouched in materialize-only mode');
});

/* D60/L-035, v3.14.348. `reconcile(true)` used to walk the whole corpus filling
   and linking the moment a dictionary loaded, before the annotator had looked at
   anything. It is gone; what replaces it computes the same plans and shows them.

   The three claims below are the whole of the decision: nothing is written by
   the walk, the plans say what accepting WOULD do, and accepting does exactly
   that and goes through mutate(). */
test('the dictionary proposes and writes nothing', () => {
  setDict([{ form: 'r', gloss: 'R', type: 'root' }]);
  const w = { id: 'wc', form: 'r', morphemes: [{ id: 'wc.m_001', form: 'r', gloss: null, transliterations: [] }] };
  S.docs = [{ sections: [{ paragraphs: [{ sentences: [{ id: 's', words: [w] }] }] }] }];
  const before = JSON.stringify(w);
  const groups = dictFillProposal();
  eq(groups.length, 1, 'one form has something to offer');
  eq(groups[0].form, 'r', 'and it is named by its form');
  eq(JSON.stringify(w), before, 'and the corpus is untouched by asking');
  const c = offerCounts(groups);
  assert(c.fields >= 1, 'the count says what accepting would write');
  /* And the panel's own summary names the same value. The summary is what the
     annotator reads before deciding; if it were computed from anything but the
     plan, the panel would be advertising a different write from the one the
     Accept button makes — which is the failure this whole design exists to
     avoid, arriving one function later. */
  const sum = offerFieldSummary(groups[0]);
  eq(JSON.stringify(sum.fields.find(f => f.field === 'gloss').values), '["R"]',
     'and the summary the annotator reads names that same value');

  /* And accepting does exactly what was shown, through the one chokepoint. */
  const nBefore = mutateCalls.length;
  const done = acceptFillGroups(groups);
  eq(w.morphemes[0].gloss, 'R', 'the gloss the panel showed is the gloss written');
  eq(done.fields, c.fields, 'and the count it promised is the count it wrote');
  assert(mutateCalls.length > nBefore, 'B-180: the write goes through mutate()');
  eq(mutateCalls[mutateCalls.length - 1].target, 'corpus', 'named as a corpus write');
});

/* The other half of B-180, and the older half: the load-time repair wrote
   morphemes and told nothing. Measured at v3.14.342: a load that changed 19
   records left the journal empty, sessionChanges() reporting zero, and
   _journalComplete still true — a journal claiming a completeness it did not
   have, which compaction then trusts. */
/* Read, not executed, and deliberately: `applyDict` is 200 lines of loading that
   this guard has no business running. The claim is about which door it opens.

   L-035 was one line here — `reconcileMorphemesFromParse(true)` — and putting it
   back is the whole regression, so the check names both halves: the offer is
   called, and no writer is. */
{
  const { decomment: dc, fnSrc: src } = require('./_source.js');
  const ad = dc(src('LingCoT.html', 'applyDict') || '');
  test('applyDict offers, and writes nothing itself', () => {
    assert(ad !== '', 'applyDict is in the source');
    assert(/offerDictFill\(/.test(ad), 'it computes the offer');
    for (const writer of ['applyFillPlan', 'acceptFillGroups', 'reconcileMorphemesFromParse'])
      assert(!new RegExp('\\b' + writer + '\\(').test(ad),
             `it does not call ${writer} — that was L-035`);
  });
}

test('B-180: the load-time repair says so through mutate()', () => {
  setDict([{ form: 'p', gloss: 'P' }, { form: 'q', gloss: 'Q' }]);
  const w = { id: 'wz', form: 'pq', morphological_parse: 'p-q' };
  S.docs = [{ sections: [{ paragraphs: [{ sentences: [{ id: 's', words: [w] }] }] }] }];
  const nBefore = mutateCalls.length;
  const healed = reconcileMorphemesFromParse();
  eq(healed, 1, 'one word repaired');
  assert(mutateCalls.length === nBefore + 1, 'and one mutate() for it');
  eq(mutateCalls[mutateCalls.length - 1].written[0], w, 'naming the record that changed');
  /* D60 amended: STRUCTURE only. The repair builds the objects the parse names
     and puts no dictionary answers in them — that is a content decision and it
     belongs to the offer. */
  eq(w.morphemes.length, 2, 'the objects the parse names are built');
  eq(w.morphemes[0].gloss, null, 'and left empty — the fill is the offer\'s, not the repair\'s');
});

/* The default, stated on its own so it cannot be lost in a call site. A caller
   that says nothing gets the repair, never the content. */
/* B-186. D60 said `word.gloss` holds only what a person typed, and did not say
   what to do when what they typed IS the join. The two ends of the app answered
   differently — the save stored it, the load-time migration dropped it — so a
   file the app wrote contained a field it removed the moment it read it back,
   and save → open → save was not stable. Found by `gui_crud` E3/E4 reopening a
   real file, because both ends are correct in isolation and only the round trip
   shows the disagreement. */
test('B-186: the save and the migration decide the stored gloss by one rule', () => {
  const ms = [{ form: 'a', gloss: 'A' }, { form: 'b', gloss: 'B' }];
  const same = { id: 'ws', morphemes: ms.map(m => ({ ...m })) };
  _deriveWordFields(same, { mode: 'overwrite', explicit: { gloss: 'A-B' } });
  eq('gloss' in same, false, 'a typed value equal to the join is not stored');
  eq(wordGloss(same), 'A-B', 'and the reader composes exactly that');

  const diff = { id: 'wd', morphemes: ms.map(m => ({ ...m })) };
  _deriveWordFields(diff, { mode: 'overwrite', explicit: { gloss: 'the whole thing' } });
  eq(diff.gloss, 'the whole thing', 'a value that differs is theirs and stays');

  const none = { id: 'wn', morphemes: [] };
  _deriveWordFields(none, { mode: 'overwrite', explicit: { gloss: 'solo' } });
  eq(none.gloss, 'solo', 'and so is one on a word with no morphemes to join');

  /* And the migration asks the same function rather than repeating the
     comparison — the disagreement this closes was two spellings of one rule. */
  const mig = require('./_source.js').decomment(sliceFn('_migrateDropDerivedWordGloss'));
  assert(/storedWordGloss\(/.test(mig),
         'the load-time migration asks the same predicate',
         '       a second spelling of the rule is how the two ends drifted apart');
});

test('ensureMorphemesFromParse does not fill unless asked', () => {
  setDict([{ form: 'z', gloss: 'Z' }]);
  // materialise
  const w = { id: 'wy', form: 'z', morphological_parse: 'z' };
  ensureMorphemesFromParse(w, SENT);
  eq(w.morphemes.length, 1, 'materialised');
  eq(w.morphemes[0].gloss, null, 'and not filled');
  ensureMorphemesFromParse(w, SENT, { fill: true });
  eq(w.morphemes[0].gloss, 'Z', 'filled only when the caller asks');

  /* And the ENRICH branch, separately. The two are different code paths and a
     default restored on one of them is a fill nobody asked for; asserting only
     the materialise half let exactly that mutation through. */
  const e = { id: 'wx', form: 'z', morphemes: [{ id: 'wx.m_001', form: 'z', gloss: null, transliterations: [] }] };
  eq(ensureMorphemesFromParse(e, SENT), false, 'an existing morpheme is not enriched by default');
  eq(e.morphemes[0].gloss, null, 'and stays empty');
  eq(ensureMorphemesFromParse(e, SENT, { fill: true }), true, 'and is enriched when asked');
  eq(e.morphemes[0].gloss, 'Z', 'with the dictionary\'s value');
});


// ── G28/G29 _deriveWordFields modes ─────────────────────────────────────────
test('deriveWordFields overwrite: explicit wins; else reflect morphemes; clear when empty', () => {
  const w = { id: 'w', morphemes: [{ form: 'a', gloss: 'A' }, { form: 'b', gloss: 'B' }], gloss: 'OLD' };
  _deriveWordFields(w, { mode: 'overwrite', explicit: { gloss: '', parse: '', translit: '' } });
  /* B-176: an empty explicit gloss DELETES the key. It used to re-derive 'A-B',
     which is why clearing the field could not work — the annotator's empty was
     read as "nothing was said" and answered with the morpheme join. Emptiness is
     an answer, and this is the one shape that can hold it. */
  eq(w.gloss, undefined, 'an empty explicit gloss deletes the key (B-176)');
  eq(wordGloss(w), 'A-B', 'and the reader still shows the join');
  eq(w.morphological_parse, 'a-b', 'overwrite derives parse from >1 morphemes');
  const w2 = { id: 'w2', morphemes: [{ form: 'x' }], gloss: 'OLD' };
  _deriveWordFields(w2, { mode: 'overwrite', explicit: { gloss: '' } });
  eq(w2.gloss, undefined, 'cleared with nothing to join, the key is gone rather than null');
  eq(wordGloss(w2), null, 'and the reader has nothing to compose');
  _deriveWordFields(w2, { mode: 'overwrite', explicit: {} });
  eq(w2.morphological_parse, null, 'overwrite clears parse for single morpheme');
  const w3 = { id: 'w3', morphemes: [{ form: 'a' }] };
  _deriveWordFields(w3, { mode: 'overwrite', explicit: { gloss: 'USER', parse: 'a' } });
  eq(w3.gloss, 'USER', 'explicit gloss wins'); eq(w3.morphological_parse, 'a', 'explicit parse wins');
  /* D32, DECIDED v3.14.303: this deriver does not touch transliterations at all,
     in either direction. The annotator's list is written by `applyForm` through
     `assignList` (per-element, matched by content), and the join is computed at
     READ time by `wordTranslit`. */
  eq(w3.transliterations, undefined, 'and it writes no transliteration, explicit or otherwise');
});

test('deriveWordFields fill: only fills empties, never overwrites/clears', () => {
  const w = { id: 'w', morphemes: [{ form: 'a', gloss: 'A' }, { form: 'b', gloss: 'B' }], gloss: 'KEPT' };
  _deriveWordFields(w);     // fill mode
  eq(w.gloss, 'KEPT', 'non-empty gloss preserved');
  eq(w.morphological_parse, 'a-b', 'empty parse filled from morphemes');
});

/* ── B-141, v3.14.280: it says WHICH fields it computed ──────────────────────
   The stamp is only as honest as this set. `saveWord` had one test — "did the
   value change" — which is true both when the annotator typed it and when the
   app assembled it from the morphemes, so both were signed by the person.
   Measured on samples/turkish-test before the fix: 13 of 13 word glosses that
   are exactly the morpheme join were signed by a person, none marked derived.

   Executed, and the negative case is asserted beside the positive: a field the
   ANNOTATOR typed must not appear here, or the fix would over-correct and sign
   their own work as the machine's. */
test('B-141 deriveWordFields reports what it derived, and only that', () => {
  const w = { id: 'w', morphemes: [{ form: 'a', gloss: 'A', transliterations: [{ label: 'T', text: 'ay' }] },
                                   { form: 'b', gloss: 'B', transliterations: [{ label: 'T', text: 'bee' }] }] };
  const d = _deriveWordFields(w, { mode: 'overwrite', explicit: { gloss: '', parse: '' } });
  eq(typeof d.has, 'function', 'it returns a Set');
  /* Was `true` until v3.14.347, when D60/B-176 decided the gloss join is computed
     at read time and never stored — the same sentence as the transliteration line
     below, for the same reason, in the second field that had the defect. There is
     nothing left to report as derived, because nothing is written. */
  eq(d.has('gloss'), false,              'a gloss is NOT derived here — B-176 composes it at read time');
  eq(w.gloss, undefined,                 'and none is stored, however much there was to join');
  eq(d.has('morphological_parse'), true, 'a parse assembled from their forms still is');
  /* Was `true` until v3.14.303, when D32 decided the transliteration join is
     computed at read time and never stored. The morphemes above carry two, and
     the word must come away with none: a stored derivation is what made
     `transliterations` mean two things. */
  eq(d.has('transliterations'), false,   'a transliteration is NOT derived here — D32 computes it at read time');
  eq(w.transliterations, undefined,      'and none is stored, however much there was to join');
  eq(w.morphological_parse, 'a-b', 'and the value that IS stored is still written');

  const w2 = { id: 'w2', morphemes: [{ form: 'a', gloss: 'A' }] };
  const d2 = _deriveWordFields(w2, { mode: 'overwrite',
                                     explicit: { gloss: 'MINE', parse: 'a' } });
  eq(d2.has('gloss'), false,               'a gloss the annotator typed is NOT derived');
  eq(d2.has('morphological_parse'), false, 'nor a parse they typed');
  eq(d2.has('transliterations'), false,    'and transliterations are not this function\'s business at all');
  eq(d2.size, 0, 'nothing else creeps in');

  // Nothing to derive from is not the same as deriving nothing-in-particular.
  const w3 = { id: 'w3', morphemes: [{ form: 'x' }] };
  const d3 = _deriveWordFields(w3, { mode: 'overwrite', explicit: {} });
  eq(d3.size, 0, 'a word with nothing to derive reports nothing');
  eq(w3.morphological_parse, null, 'and still clears the parse, which is the overwrite rule');
  /* B-176: with no explicit gloss handed in, the deriver does not touch the field
     in either direction. Overwrite is a rule about what the SAVE was told, not a
     licence to rewrite a field nobody mentioned. */
  eq('gloss' in w3, false, 'and does not invent a gloss key nobody asked about');

  // Fill mode is the load-time pass; it derives too, and says so.
  const w4 = { id: 'w4', morphemes: [{ form: 'a', gloss: 'A' }, { form: 'b', gloss: 'B' }] };
  const d4 = _deriveWordFields(w4);
  eq(d4.has('morphological_parse'), true, 'the fill pass reports its derivations as well');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
