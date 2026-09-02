#!/usr/bin/env node
/* =============================================================================
   journal_replay_test.js — D50: a journal of whole-record snapshots replays
   into the same state as the live tree
   =============================================================================
   The claim this guard exists to hold: a `put` record that INLINES its
   provenance can be replayed against an untouched base and produce a byte-
   identical serialization, including for moments minted after the base was
   written.

   Why it matters. Under D50 the base file is rewritten only at compaction, and
   compaction renumbers the provenance table densely. A journal record that
   referenced that table by index would silently mean a different moment after
   the next compaction. expandProv() inlines instead, and replay interns through
   adoptProvEvents — the path that has handled pre-v3.14.226 inline stamps since
   interning shipped.

   This is the reconciliation check that D50 stage 3 runs at every compaction,
   executed here against a real corpus rather than a fixture, so that a call site
   which mutates without journalling is caught before it can lose data. Under the
   old full-rewrite autosave a missed mutate() was merely slow; under a journal
   it is permanent loss, so this assertion is load-bearing in a way the autosave
   guards never had to be.
   ============================================================================= */
const path = require('path');
const fs   = require('fs');
const vm   = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, loadCorpus } = require('./_fixture.js');

/* Any corpus will do: the property under test is about the journal, not about
   this corpus. So it takes the first one the fixture set offers and FAILS with
   none, rather than disabling — a guard with no data has checked nothing. */
// B-128: read through the shared loader, which also proves the file parses.
const raw = loadCorpus(requireCorpus(null, 'journal replay'), 'journal replay').raw;

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(detail);
  ok ? pass++ : fail++;
};

/* A booted app, twice: one plays the session, the other reloads and replays. */
function boot() {
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  if (errs.length) {
    console.log(`  FAIL the app did not load: ${errs[0][0]} — ${errs[0][1].message}`);
    process.exit(1);
  }
  return ctx;
}
const ADOPT = `
  var rows = parseJsonlText(__raw);
  var _pe  = splitProvEvents(rows);
  S.provEvents = []; _provEventKey = new Map();
  var __adopted = adoptProvEvents(_pe.items, _pe.events);
  S.docs = _pe.items;
  buildCorpusIndex();
`;

console.log('\na journal of whole-record snapshots replays to the same state\n');

// ── the session ──────────────────────────────────────────────────────────────
const a = boot();
a.__raw = raw;
const runA = e => vm.runInContext(e, a);
runA(ADOPT);
runA(`
  globalThis.__journal = [];
  var ids = Array.from(S.wordById.keys()).slice(0, 25);
  for (var i = 0; i < ids.length; i++) {
    var w = S.wordById.get(ids[i]).word;
    w.gloss = 'probe-' + i;
    if (!w.field_prov) w.field_prov = {};
    /* A moment the base's table does not contain, which is the case that fails
       if a journal record carries an index instead of the moment. */
    w.field_prov.gloss = internProv({ annotator_id: 'ann_001', date: '2026-08-30',
                                      time: '00:2' + (i % 10) + ':00' });
    __journal.push(JSON.stringify({ op: 'put', kind: 'word', id: w.id, rec: expandProv(w) }));
  }
  globalThis.__eventsGrewBy = S.provEvents.length - _pe.events.length;
  globalThis.__liveText    = serializeRecords(S.docs, true);
  globalThis.__journalText = __journal.join('\\n');
`);
check(runA('__journal.length') === 25, `25 edits journalled`);
check(runA('__eventsGrewBy') > 0,
      `the session minted moments the base's table does not hold (${runA('__eventsGrewBy')})`,
      '         without this the test would pass even if ids were being copied');
check(!/"field_prov":\{"[a-z_]+":[0-9]/.test(runA('__journalText')),
      'no journal record carries a bare field_prov table index',
      '         expandProv must inline the moment, not the index into a table');

/* v3.14.247, D50 stage 4b: `prov` and `prov_history` are interned in the base
   now, so they need the same assertion field_prov already had. A journal record
   that shipped `"prov":7` would name whatever moment index 7 held after the
   NEXT compaction renumbered the table — silently, and only for records edited
   in the window between two compactions.

   Checked as a shape, not as a count: an id is a bare number, an inlined moment
   is an object, and no correct journal record has the former. */
{
  const jt = runA('__journalText');
  const bareStamp = /"(?:prov|metadata_prov)":[0-9]/.exec(jt);
  check(!bareStamp, 'no journal record carries a bare prov index',
        `         found ${bareStamp && bareStamp[0]} — expandProv must inline the moment`);
  const bareHist = /"prov_history":\[[0-9]/.exec(jt);
  check(!bareHist, 'and none carries a bare prov_history index',
        `         found ${bareHist && bareHist[0]}`);
  check(/"prov":\{"annotator/.test(jt) || /"prov":\{"date/.test(jt),
        'and the moments ARE inlined, so the check above is not vacuous',
        '         no journalled record carried a prov at all; the assertion proves nothing');
}

// ── the reload ───────────────────────────────────────────────────────────────
const b = boot();
b.__raw = raw;                       // the SAME base: compaction has not run
b.__journalText = runA('__journalText');
const runB = e => vm.runInContext(e, b);
runB(ADOPT);
runB(`
  var applied = 0, missed = 0;
  var lines = __journalText.split('\\n');
  for (var i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    var o = JSON.parse(lines[i]);
    var ref = S.wordById.get(o.id);
    if (!ref) { missed++; continue; }
    adoptProvEvents([o.rec], []);           // interns the inlined moments
    for (var k in ref.word) delete ref.word[k];
    Object.assign(ref.word, o.rec);
    applied++;
  }
  globalThis.__applied = applied; globalThis.__missed = missed;
  globalThis.__replayText = serializeRecords(S.docs, true);
`);
check(runB('__missed') === 0, `every journalled record found its target on replay`,
      `         ${runB('__missed')} record(s) referenced an id not in the reloaded corpus`);

const live = runA('__liveText'), replay = runB('__replayText');
let detail = '';
if (live !== replay) {
  let i = 0; while (i < live.length && live[i] === replay[i]) i++;
  detail = `         first divergence at byte ${i}\n`
         + `         live  : ${live.slice(Math.max(0, i - 70), i + 70)}\n`
         + `         replay: ${replay.slice(Math.max(0, i - 70), i + 70)}`;
}
check(live === replay,
      'base + journal replays byte-identical to the live tree', detail);

/* ═══ B-202 · a replayed parent must not orphan its children ════════════════
   `replayJournal` builds `_idMap(S.docs)` once, before applying anything. A deep
   put then REPLACES a container's children — `Object.assign(hit.obj, r.rec)`
   installs the journal's `words` array whole — and every descendant the map knew
   about becomes an object no longer in the tree. A later record naming one of
   them updates a detached copy.

   The failure is invisible for exactly as long as it takes to re-index: views
   resolve through `S.wordById`, so the app SHOWS the edit; serialisation walks
   `S.docs`, so the file never gets it; and `buildCorpusIndex()` — which
   `loadProject` runs immediately after the replay — re-reads the tree and the
   edit vanishes from both.

   MEASURED in `turkish-test`: a sentence put carrying its words, then a word put
   adding a second transliteration. Replay reported `applied: 2, unresolved: 0`
   and the corpus came out with the OLDER value. **Last-write-wins inverted, on
   the ordinary save order** — save a sentence, then a word inside it.

   Found by the fixture swap, and only because the corpus finally had a
   multi-element list: with one element, the stale copy and the fresh one are
   indistinguishable. D58 asked for that list and said no fixture could show what
   it was for. This is what it was for. */
console.log('\nB-202 — a replayed parent must not orphan its children\n');
{
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  check(errs.length === 0, 'the app loads into the stub DOM',
        errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
  const run = e => vm.runInContext(e, ctx);

  /* One sentence, one word, one morpheme carrying a one-element list. */
  const BASE = [{
    id: 'd1', metadata: { title: 't' },
    sections: [{ id: 'd1.s1', title: 'a', paragraphs: [{ id: 'd1.s1.p1', sentences: [
      { id: 'd1.s1.p1.sent1', text: 'x', words: [
        { id: 'd1.s1.p1.sent1.w1', form: 'x', morphemes: [
          { id: 'd1.s1.p1.sent1.w1.m1', form: 'x',
            transliterations: [{ label: '', text: 'one' }] }] }] }] }] }],
  }];
  ctx.__base = JSON.parse(JSON.stringify(BASE));

  /* THE ORDER THAT MATTERS: the parent first, carrying the child as it stood,
     then the child with the newer value. That is what saving a sentence and then
     a word inside it produces. */
  const sentRec = JSON.parse(JSON.stringify(BASE[0].sections[0].paragraphs[0].sentences[0]));
  const wordRec = JSON.parse(JSON.stringify(sentRec.words[0]));
  wordRec.morphemes[0].transliterations.push({ label: '', text: 'two' });
  ctx.__j = [
    JSON.stringify({ record_type: 'journal_head', corpus: null, dict: null, opened: '2026-09-02 00:00' }),
    JSON.stringify({ op: 'put', t: 'corpus', id: sentRec.id, rec: sentRec }),
    JSON.stringify({ op: 'put', t: 'corpus', id: wordRec.id, rec: wordRec }),
  ].join('\n');

  run("applyCorpus(__base, 'b202'); buildCorpusIndex();");
  const inTree = () => run(`(function(){let n=-1;const w=o=>{if(Array.isArray(o))return o.forEach(w);
    if(!o||typeof o!=='object')return;
    if(o.id==='d1.s1.p1.sent1.w1'){const m=(o.morphemes||[])[0];n=m?(m.transliterations||[]).length:-1;}
    for(const k in o){const v=o[k];if(v&&typeof v==='object')w(v);}};w(S.docs);return n;})()`);
  check(inTree() === 1, 'the base carries one element');

  const rep = JSON.parse(run("JSON.stringify(replayJournal(__j))"));
  check(rep.applied === 2 && rep.unresolved === 0,
        `both records apply (${JSON.stringify(rep)})`,
        '         the bug reported success — it is what happened after that was wrong');

  /* THE TREE, not the index. `findWord` resolves through `S.wordById`, which
     still names the detached object, so asking it would have reported the fix
     working while the file lost the edit. */
  check(inTree() === 2,
        'and the LATER record wins, in the tree',
        `         got ${inTree()} — the parent put replaced the words array, and the\n`
      + '         child put then landed on an object no longer in the tree');

  /* The two ways it stayed invisible, asserted so neither comes back. */
  run("buildCorpusIndex();");
  check(inTree() === 2,
        'and survives the index rebuild the load does next',
        '         buildCorpusIndex re-reads the tree; before the fix this is where\n'
      + '         the edit disappeared from the screen as well as the file');
  const out = String(run("serializeRecords(S.docs, true)"));
  check((out.match(/"text":"two"/g) || []).length === 1,
        'and reaches the file the next save writes',
        '         serialisation walks the tree, which is why a detached update is\n'
      + '         shown to the annotator and never stored');

  /* THE SAME BUG ON `add`. An added sentence carries its words, so a put naming
     one of them has to find the object that went INTO the tree — not one the map
     never heard of. This is the case a two-put journal cannot reach: the entries
     are new, so a map built before the replay has nothing stale to keep. */
  const sent2 = JSON.parse(JSON.stringify(sentRec));
  const bump = (o, id) => JSON.parse(JSON.stringify(o).split(sentRec.id).join(id));
  const s2 = bump(sent2, 'd1.s1.p1.sent2');
  const w2 = JSON.parse(JSON.stringify(s2.words[0]));
  w2.morphemes[0].transliterations.push({ label: '', text: 'three' });
  const j2 = [
    JSON.stringify({ record_type: 'journal_head', corpus: null, dict: null, opened: '2026-09-02 00:00' }),
    JSON.stringify({ op: 'add', t: 'corpus', id: s2.id, parent: 'd1.s1.p1', index: 1, rec: s2 }),
    JSON.stringify({ op: 'put', t: 'corpus', id: w2.id, rec: w2 }),
  ].join('\n');
  const rep2 = JSON.parse(run(`JSON.stringify(replayJournal(${JSON.stringify(j2)}))`));
  check(rep2.applied === 2 && rep2.unresolved === 0,
        `an add carrying children, then a put on one of them, both apply (${JSON.stringify(rep2)})`,
        '         a put that cannot find its target is reported unresolved — that is\n'
      + '         the loud half of this bug, and not the half that lost data');
  const in2 = () => run(`(function(){let n=-1;const w=o=>{if(Array.isArray(o))return o.forEach(w);
    if(!o||typeof o!=='object')return;
    if(o.id==='d1.s1.p1.sent2.w1'){const m=(o.morphemes||[])[0];n=m?(m.transliterations||[]).length:-1;}
    for(const k in o){const v=o[k];if(v&&typeof v==='object')w(v);}};w(S.docs);return n;})()`);
  check(in2() === 2,
        'and the put lands on the added record, in the tree',
        `         got ${in2()} — the add spliced the record in without indexing what it\n`
      + '         carried, so the put either missed it or hit a copy');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
