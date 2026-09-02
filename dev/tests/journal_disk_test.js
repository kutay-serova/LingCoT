#!/usr/bin/env node
/* =============================================================================
   journal_disk_test.js — D50 stage 3b: a journal written to disk and replayed
   reconstructs exactly what the live tree held
   Run:  node dev/tests/journal_disk_test.js
   =============================================================================
   This is the reconciliation check the design calls for at every compaction,
   run here as a guard: play a session against a real corpus, take the records
   the real mutate() produced, replay them onto a FRESH load of the untouched
   base, and compare the serializations byte for byte.

   It covers what journal_replay_test.js does not: the three ops rather than
   plain puts, shallow records and their child order, and the idempotence that
   lets compaction replace the base before emptying the journal. If replay were
   not idempotent that ordering would be unsafe, and the ordering is what makes
   an interrupted compaction survivable.
   ============================================================================= */
const path = require('path');
const fs   = require('fs');
const vm   = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, requireCompanion } = require('./_fixture.js');

const corpusPath = requireCorpus(null, 'journal disk round trip');
const rawCorpus  = fs.readFileSync(corpusPath, 'utf8');
const rawDict    = fs.readFileSync(requireCompanion(corpusPath, 'dictionary'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(detail);
  ok ? pass++ : fail++;
};

function boot() {
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  if (errs.length) {
    console.log(`  FAIL the app did not load: ${errs[0][0]} — ${errs[0][1].message}`);
    process.exit(1);
  }
  ctx.__corpus = rawCorpus; ctx.__dict = rawDict;
  vm.runInContext(`
    var _pe = splitProvEvents(parseJsonlText(__corpus));
    S.provEvents = []; _provEventKey = new Map();
    adoptProvEvents(_pe.items, _pe.events);
    S.docs = _pe.items;
    var _pd = splitProvEvents(parseJsonlText(__dict));
    adoptProvEvents(_pd.items, _pd.events);
    var _sp = splitDictFile(_pd.items);
    S.dictionary = _sp.entries; S.lemmas = _sp.lemmas;
    buildCorpusIndex(); buildDictIndex();
    journalReset();
  `, ctx);
  return ctx;
}

console.log('\na session, journalled to text, replayed onto the untouched base\n');

const a = boot();
const runA = e => vm.runInContext(e, a);

/* Every op, on real objects. Written through mutate() rather than by hand, so
   what is under test is the path the app actually takes. */
runA(`
  var w  = S.wordById.values().next().value.word;
  var sr = S.sentById.values().next().value;
  var sent = sr.sent, para = sr.para;

  // put, deep: a word and its morphemes
  w.gloss = 'REPLAYED';
  if (!w.field_prov) w.field_prov = {};
  w.field_prov.gloss = internProv({ annotator_id: 'ann_001', date: '2026-08-30', time: '02:00:00' });
  mutate('corpus', [w]);

  // put, shallow: a sentence field, leaving its words alone
  sent.comments = [{ text: 'a shallow put', source_id: null, date: '2026-08-30' }];
  mutate('corpus', [{ rec: sent, shallow: true }]);

  // add: a new sentence under its paragraph
  var fresh = { id: sent.id + '_NEW', text: 'Yeni cümle.', words: [],
                translations: [], transliterations: [], comments: [], ...initProv() };
  para.sentences.push(fresh);
  mutate('corpus', [{ rec: fresh, parent: para.id, index: para.sentences.length - 1 }]);

  // dict: a put on an existing entry, and one that is really a creation
  var e0 = S.dictionary[0];
  e0.gloss = 'entry-replayed';
  var minted = { id: 'dict_replay_probe', form: 'yeni', type: 'word', gloss: 'new',
                 comments: [], ...initProv() };
  S.dictionary.push(minted);
  mutate('dict', [e0, minted]);

  // del: remove the entry we just minted's neighbour
  var doomedId = S.dictionary[1].id;
  S.dictionary.splice(1, 1);
  mutate('dict', { dict: [{ del: doomedId }] });

  /* A REORDER, which is the only reason a shallow put carries child ids. Without
     a case that actually moves children, deleting the reorder line leaves this
     guard green — found by falsifying it. Needs two children to be meaningful,
     so it is skipped on a fixture too small and says so. */
  globalThis.__reordered = false;
  /* Any container with two children will do — the first section of a fixture
     may well have one paragraph, as samples/ does. */
  for (var d0 of S.docs) {
    for (var sc of (d0.sections || [])) {
      if ((sc.paragraphs || []).length > 1) {
        sc.paragraphs.reverse();
        mutate('corpus', [{ rec: sc, shallow: true }]);
        globalThis.__reordered = true;
        break;
      }
      for (var pp of (sc.paragraphs || [])) {
        if ((pp.sentences || []).length > 1) {
          pp.sentences.reverse();
          mutate('corpus', [{ rec: pp, shallow: true }]);
          globalThis.__reordered = true;
          break;
        }
      }
      if (__reordered) break;
    }
    if (__reordered) break;
  }

  globalThis.__journalText = journalText();
  globalThis.__ops   = _journal.map(r => r.op).join(',');
  globalThis.__live  = serializeRecords(S.docs, true) + '\\u0000' + serializeRecords(dictFileItems(), true);
`);
check(runA('_journalComplete') === true, 'the session journalled completely');
check(runA('__ops').startsWith('put,put,add,put,put,del'),
      `every op appears: ${runA('__ops')}`,
      '         a shape that never occurs is a shape this guard does not test');

// ── replay onto a fresh load of the SAME base ───────────────────────────────
const b = boot();
b.__journalText = runA('__journalText');
const runB = e => vm.runInContext(e, b);
runB(`
  globalThis.__rep = replayJournal(__journalText);
  buildCorpusIndex(); buildDictIndex();
  globalThis.__after = serializeRecords(S.docs, true) + '\\u0000' + serializeRecords(dictFileItems(), true);
`);
const rep = runB('__rep');
check(rep.unresolved === 0, 'every record resolved',
      `         ${rep.unresolved} unresolved — a record that resolves to nothing is lost annotation`);
check(rep.applied === (runA('__reordered') ? 7 : 6), `all ${rep.applied} records applied`);
check(runA('__reordered'),
      'the fixture has a section with two paragraphs, so the reorder case runs',
      '         without it the child-order half of a shallow put is never exercised');

const live = runA('__live'), after = runB('__after');
let detail = '';
if (live !== after) {
  let i = 0; while (i < live.length && live[i] === after[i]) i++;
  detail = `         first divergence at byte ${i}\n`
         + `         live  : ${live.slice(Math.max(0, i - 70), i + 70)}\n`
         + `         replay: ${after.slice(Math.max(0, i - 70), i + 70)}`;
}
check(live === after, 'base + journal is byte-identical to the live tree', detail);

console.log('\nreplay is idempotent, which is what makes compaction safe\n');
runB(`
  globalThis.__rep2 = replayJournal(__journalText);
  globalThis.__again = serializeRecords(S.docs, true) + '\\u0000' + serializeRecords(dictFileItems(), true);
`);
check(runB('__again') === after,
      'replaying the same journal twice changes nothing',
      '         compaction replaces the base BEFORE emptying the journal, so a crash\n'
      + '         in between replays an already-folded journal. That must be a no-op.');
check(runB('__rep2').skipped >= 1,
      'and the add is recognised as already present rather than duplicated',
      `         skipped ${runB('__rep2').skipped}`);

/* ═══ B-199 · the two halves of a mismatch ═══════════════════════════════════
   Reported from use as *"the unsaved edits beside turkish-test_corpus were
   written against a different version"*, and traced to a chain that starts one
   session earlier.

   HOW THE MISMATCH IS MANUFACTURED. `compact()` writes the base and THEN
   truncates the journal, in that order and for a good reason — a crash between
   them leaves a stale journal, which survives, where the reverse loses one,
   which does not. `beforeunload` called `compact('exit')` and **cannot await**:
   the base landed and the truncation did not. `write_abs` logs `File saved`
   AFTER `os.replace`, so a half-run leaves no line saying it happened.

   WHAT THE REFUSAL COST. The load refuses such a journal — correctly — but the
   refusal `return`ed out of the rest of the load, including the step that arms
   autosave. `journalPath()` is derived from `_savePath`, so with none set it is
   `''` and `flushJournal` writes nothing. **Every save in that session reported
   success and reached no file.** A refused journal is a reason not to REPLAY,
   never a reason not to SAVE. */
console.log('\nB-199 — an exit that cannot finish must not start\n');
{
  const { read, decomment } = require('./_source.js');
  const ev  = decomment(read('modules/events.js'));
  const app = decomment(read('LingCoT.html'));

  /* ── half one: the exit does one step, not two ────────────────────────── */
  const exit = /addEventListener\('beforeunload'[\s\S]{0,300}?\n  \}\);/.exec(ev);
  check(!!exit, 'the exit handler found');
  const E = exit ? exit[0] : '';
  check(!/compact\(/.test(E),
        'the exit does NOT start a compaction',
        '         compact() writes the base then truncates the journal, and the\n'
      + '         window goes away between them — the base lands, the truncation\n'
      + '         does not, and the pair disagree from then on');
  check(/flushJournal\(/.test(E),
        'it flushes the journal instead — one append, complete in itself',
        '         an append either lands or does not; either way nothing on disk\n'
      + '         contradicts anything else');

  /* Blur still compacts: it CAN finish, and the journal would grow forever
     otherwise. The distinction is the whole fix, so it is asserted. */
  const blur = /addEventListener\('blur'[\s\S]{0,240}?\n  \}\);/.exec(ev);
  /* Asked of the CONDITION, not of the call. `if (false) compact(...)` still
     contains `compact(` and the first draft of this passed on it — the shape of
     a call is not a call being made. */
  check(blur && /_journalBytes[\s\S]{0,60}?compact\(/.test(blur[0]),
        'while blur still compacts when there is something to compact',
        '         removing that leaves the journal to grow without bound, because\n'
      + '         the exit no longer compacts at all');
  check(blur && /_lastCompactMs/.test(blur[0]),
        'and still refuses when the last one was slow',
        '         a 13 s freeze on a window blur is worse than what it replaced');

  /* ── half two: a refused journal still lets the session save ──────────── */
  const load = app.slice(app.indexOf('journalBaseMismatch(project.journalText'));
  const upto = load.slice(0, load.indexOf('reportDangling'));
  check(!/alert\(t\('alert\.file\.journal_mismatch'[\s\S]{0,200}?\breturn;/.test(upto),
        'the mismatch no longer returns out of the load',
        '         the corpus is already applied at that point, so the project IS\n'
      + '         open — returning skipped the step that arms autosave, and with\n'
      + '         no save path journalPath() is empty and flushJournal writes\n'
      + '         nothing: the whole session becomes unsaveable, silently');
  check(/journalRefused/.test(upto),
        'it records the refusal and carries on');

  /* The step that must survive it. Named explicitly: this is the one whose
     absence made the session unsaveable. */
  check(/promptLoadedCorpusAutosave\(/.test(app.slice(app.indexOf('journalBaseMismatch(project.journalText'))),
        'and promptLoadedCorpusAutosave is still reached afterwards',
        '         it is what sets _savePath, which is what journalPath() derives\n'
      + '         the journal location from');

  /* ── the chain that made it lossy, asserted where it lives ────────────── */
  const jp = /function journalPath\(\)[\s\S]*?\n\}/.exec(app);
  check(jp && /_savePath \|\| _dictSavePath/.test(jp[0]),
        'journalPath still derives from the save paths (B-150, one derivation)',
        '         this is the link that turns "no save path" into "no journal"');
  const fj = /async function flushJournal\(\)[\s\S]*?\n\}/.exec(app);
  check(fj && /if \(!path\) return 0;/.test(fj[0]),
        'and flushJournal still returns 0 on no path — which is why half two matters',
        '         it is silent by design; the fix is to never leave it pathless');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
