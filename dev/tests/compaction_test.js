#!/usr/bin/env node
/* =============================================================================
   compaction_test.js — D50 stage 3c: an edit appends, and only a trigger writes
   Run:  node dev/tests/compaction_test.js
   =============================================================================
   The change this guards is the one the whole of D50 was for: an annotator's
   save used to rebuild the entire corpus as one string — 1.5 s at 50,000 words,
   13.3 s at 300,000 — and now costs an append of about 1.7 KB.

   So the assertions are mostly about what must NOT happen on the hot path, and
   about the ordering that makes an interrupted compaction survivable: the base
   is replaced BEFORE the journal is emptied, never after. Replay is idempotent,
   so a crash between the two costs nothing; the other order loses a session.

   It executes the real functions against a stubbed pywebview, so what is under
   test is the sequence of calls the app actually makes rather than the shape of
   its source.
   ============================================================================= */
const vm = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { read, decomment, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(`         ${detail}`);
  ok ? pass++ : fail++;
};

/* A booted app with a recording bridge, so every disk call is visible. */
function boot() {
  const ctx = makeCtx({ hasId: () => true });
  const calls = [];
  const held = [];   // pending write_abs resolvers, released by the test
  /* Only the three D50 calls are recorded. Everything else the app asks the
     bridge for on boot answers emptily, so an unrelated stack trace does not
     land in the middle of this guard's output. */
  const api = new Proxy({
    append_abs:   (p, c) => { calls.push(['append', p, c.length]);   return Promise.resolve(c.length + 100); },
    /* Deferred on purpose. `consider()` CALLS write_abs eagerly and awaits the
       promises later, so recording call order proves nothing about ordering —
       the first version of this guard could not tell a truncate-first bug from
       a correct one. Holding the write open until the test releases it makes
       the assertion about COMPLETION, which is the property that matters: the
       journal must not be emptied until the base is actually on disk. */
    write_abs:    (p, c) => { calls.push(['write-called', p, c.length]);
                              return new Promise(res => held.push(() => {
                                calls.push(['write-done', p]); res(true); })); },
    truncate_abs: (p)    => { calls.push(['truncate', p]);           return Promise.resolve(true); },
  }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve({})) });
  ctx.window.pywebview = { api };
  const errs = loadApp(ctx, appSources());
  if (errs.length) {
    console.log(`  FAIL the app did not load: ${errs[0][0]} — ${errs[0][1].message}`);
    process.exit(1);
  }
  vm.runInContext(`
    _autoSave = true;
    _savePath = '/tmp/probe/x_corpus.jsonl';
    _dictSavePath = '/tmp/probe/x_dictionary.jsonl';
    S.docs = [{ id: 'doc_1', metadata: { title: 'T' }, sections: [] }];
    S.dictionary = []; S.lemmas = [];
    journalReset();
  `, ctx);
  return { ctx, calls, held, run: e => vm.runInContext(e, ctx) };
}

async function main() {
console.log('\nan edit appends, and does not rewrite the corpus\n');
{
  const { calls, held, run } = boot();
  run(`journalWrite('corpus', [{ id: 'doc_1', metadata: { title: 'T2' } }])`);
  const tick = run(`saveTick()`);
  await new Promise(r => setImmediate(r));
  held.forEach(release => release());
  await tick;
  const kinds = calls.map(c => c[0]);
  check(kinds.includes('append'), 'the edit reached the journal', `saw: ${kinds.join(', ') || 'nothing'}`);
  check(!kinds.includes('write-called'),
        'and the base was NOT rewritten',
        'a full write on the hot path is the 1.5 s stall this change removes');
}

console.log('\na trigger compacts, in the order that survives a crash\n');
{
  const { calls, held, run } = boot();
  run(`journalWrite('corpus', [{ id: 'doc_1', metadata: { title: 'T2' } }])`);
  const done = run(`compact('test')`);
  await new Promise(r => setImmediate(r));      // let compact reach its await
  const before = calls.map(c => c[0]);
  check(!before.includes('truncate'),
        'the journal is NOT emptied while the base write is still in flight',
        `saw: ${before.join(' → ')}\n`
        + '         emptying first means a crash in between loses a whole session;\n'
        + '         this way it replays an already-folded journal, which is a no-op');
  held.forEach(release => release());           // the writes land
  await done;
  const kinds = calls.map(c => c[0]);
  if (process.env.SHOW_ORDER) console.log('   order:', kinds.join(' → '));
  check(kinds.includes('write-done'), 'compaction writes the base');
  check(kinds.includes('truncate'), 'and empties the journal');
  check(kinds.lastIndexOf('write-done') < kinds.indexOf('truncate'),
        'only after every write has actually landed',
        `order was: ${kinds.join(' → ')}`);
}

console.log('\nan undeclared write forces the old behaviour, never silence\n');
{
  const { calls, held, run } = boot();
  run(`mutate('corpus')`);                 // says nothing about what it wrote
  const tick = run(`saveTick()`);
  await new Promise(r => setImmediate(r));
  held.forEach(release => release());
  await tick;
  check(calls.some(c => c[0] === 'write-called'),
        'an incomplete journal compacts instead of trusting the journal',
        'unknown must degrade to what the app did before D50, not to a partial file');
}

console.log('\nthe compaction threshold is proportional\n');
{
  const { run } = boot();
  run(`_lastWrite.corpus.bytes = 56 * 1024 * 1024; _journalBytes = 8 * 1024 * 1024;`);
  check(run(`_compactionDue()`) === false,
        'an 8 MB journal beside a 56 MB corpus is not yet due',
        'a fixed threshold would compact a large corpus constantly');
  run(`_journalBytes = 20 * 1024 * 1024;`);
  check(run(`_compactionDue()`) === true, 'a 20 MB one is');
  run(`_lastWrite.corpus.bytes = 100 * 1024; _journalBytes = 1024 * 1024;`);
  check(run(`_compactionDue()`) === false,
        'and the 2 MB floor stops a small corpus compacting every few minutes',
        '2 MB is roughly 1,400 word-saves — likely more than a day at that scale');
}

console.log('\nthe idle back-off is measured, not guessed\n');
{
  const src = decomment(fnSrc('modules/events.js', '_armIdleCompaction'));
  check(/_lastCompactMs > 2000/.test(src) && /10 \* 60 \* 1000/.test(src) && /2 \* 60 \* 1000/.test(src),
        'idle waits 2 minutes, or 10 when the last compaction took over 2 s',
        'a 13 s freeze because someone stepped away is the interruption this replaced');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
}
main();
