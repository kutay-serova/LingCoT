#!/usr/bin/env node
/* =============================================================================
   journal_record_test.js — D50 stage 3: what a save path declares becomes a
   journal record, and what it fails to declare is never silently dropped
   Run:  node dev/tests/journal_record_test.js
   =============================================================================
   The safety property this guard exists to hold. Under the old full rewrite a
   mutate() that named nothing was merely slow: the next save rebuilt the file
   from the live tree, which is why mutate's own comment says such a call site
   "is merely slow, never stale". Under a journal it would be permanent loss.

   So an undeclared write must mark the journal INCOMPLETE — which forces a full
   write — rather than producing an empty or partial record. Unknown degrades to
   yesterday's behaviour, never to silence. Every assertion below is about that
   or about the four record shapes that carry a declared write.

   It executes the real functions rather than reading them: the previous
   generation of this project's guards read source and reported success while
   the code did nothing (L-006), and a record builder is exactly the kind of
   thing that keeps its shape in the source while losing it in the output.
   ============================================================================= */
const vm = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(`         ${detail}`);
  ok ? pass++ : fail++;
};

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
if (errs.length) {
  console.log(`  FAIL the app did not load: ${errs[0][0]} — ${errs[0][1].message}`);
  process.exit(1);
}
const run = e => vm.runInContext(e, ctx);
const reset = () => run('journalReset()');

console.log('\nthe four record shapes\n');

// ── put, the plain case ─────────────────────────────────────────────────────
reset();
run(`journalWrite('corpus', [{ id: 'w1', form: 'giy', gloss: 'wear',
      field_prov: { gloss: internProv({ annotator_id: 'ann_001', date: '2026-08-30', time: '01:00:00' }) } }])`);
check(run('_journal.length') === 1, 'an object becomes one put');
check(run("_journal[0].op") === 'put' && run("_journal[0].t") === 'corpus'
      && run("_journal[0].id") === 'w1', 'carrying its op, store and id');
check(typeof run("_journal[0].rec.field_prov.gloss") === 'object',
      'with provenance INLINED, not indexed',
      'a record holding a table index would mean something else after the next compaction');

// ── add, which exists because parents are not always cheap ──────────────────
reset();
run(`journalWrite('corpus', [{ rec: { id: 's9', title: 'New' }, parent: 'doc_1', index: 3 }])`);
check(run("_journal[0].op") === 'add' && run("_journal[0].parent") === 'doc_1'
      && run("_journal[0].index") === 3,
      'a created record becomes an add, with its parent and position',
      'without it a new SECTION would have to journal the document — the whole corpus');

// ── del ─────────────────────────────────────────────────────────────────────
reset();
run(`journalWrite('dict', { dict: [{ del: 'dict_7' }] })`);
check(run("_journal[0].op") === 'del' && run("_journal[0].id") === 'dict_7' && !run("'rec' in _journal[0]"),
      'a removal becomes a del, and carries no body');

// ── shallow, and the child order it keeps ───────────────────────────────────
reset();
run(`journalWrite('corpus', [{ rec: { id: 'd1', metadata: { title: 'T' },
      sections: [{ id: 'a', paragraphs: [] }, { id: 'b', paragraphs: [] }] }, shallow: true }])`);
check(!run("'sections' in _journal[0].rec"),
      'a shallow put drops the child subtree');
/* Null-safe on purpose: dropping the order line leaves `order` absent, and a
   guard that throws instead of failing reports nothing useful about why. */
check(JSON.stringify(run("(_journal[0].order || {}).sections")) === '["a","b"]',
      'but keeps the child ids, in order, so a reorder or a removal still replays',
      'without this, dragging two sections into a new order would journal nothing');

console.log('\nan undeclared write is never silently dropped\n');

// ── the safety property ─────────────────────────────────────────────────────
reset();
run(`mutate('corpus')`);
check(run('_journal.length') === 0 && run('_journalComplete') === false,
      'mutate() with no records marks the journal incomplete',
      'silently journalling nothing is the failure this whole design has to avoid');

reset();
run(`mutate(['corpus', 'dict'], { corpus: [{ id: 'w1' }] })`);
check(run('_journalComplete') === false,
      'and so does naming two stores while listing records for one',
      'the missing store is a save path whose writes the journal would not carry');

reset();
run(`journalWrite('corpus', [null, { id: 'w2' }])`);
check(run('_journal.length') === 1 && run('_journalComplete') === false,
      'an entry that yields no record marks it incomplete too, and the rest still land');

reset();
run(`mutate('parts', undefined)`);
check(run('_journalComplete') === true,
      'participants are exempt: they stay on the full rewrite, so nothing is missing',
      '845 bytes — a journal would buy nothing and add a third replay path');

console.log('\nboth stores, from one action\n');
reset();
run(`journalWrite(['corpus', 'dict'], { corpus: [{ id: 'w1' }], dict: [{ id: 'e1' }, { del: 'e2' }] })`);
check(run('_journal.length') === 3, 'one call can carry writes to both stores');
check(run("_journal.filter(r => r.t === 'dict').length") === 2
      && run("_journal.find(r => r.op === 'del').id") === 'e2',
      'each record remembering which store it belongs to');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
