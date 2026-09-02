#!/usr/bin/env node
/* =============================================================================
   morpheme_merge_test.js — B-124: a word save keeps morpheme keys it does not
   own, and still drops the ones it deliberately clears
   Run:  node dev/tests/morpheme_merge_test.js
   =============================================================================
   Two failures pull in opposite directions, and a fix for either one alone
   causes the other:

     the literal    saveWord rebuilt word.morphemes from an object literal
                    naming nine keys, so every OTHER key was deleted on every
                    save — `comments`, which the field table declares fillable
                    at morpheme level, among them.

     a bare spread  would carry those keys through, and would also resurrect
                    `dict_id`, `type` and `part_of_speech` after the annotator
                    cleared their controls, which the panel drops on purpose.

   So this guard asserts both directions at once. It EXECUTES the rule rather
   than reading it: saveWord touches the DOM for its whole length, which is why
   B-046 and B-124 both had to be found in a real corpus instead of by a guard.
   mergeMorpheme exists as a separate function so that this file can call it.

   It also checks the rule against the field table rather than a hand-written
   list, so a field declared at morpheme level later is covered without anyone
   remembering to come back here.
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

console.log('\na word save keeps what it does not own\n');

/* The panel's own keys, read off the call in saveWord rather than retyped, so
   the two cannot drift apart. */
const { fnSrc, decomment } = require('./_source.js');
const save = decomment(fnSrc('LingCoT.html', 'saveWord'));
const callM = /mergeMorpheme\(existing,\s*\{([\s\S]*?)\n      \}\)/.exec(save);
check(!!callM, 'saveWord builds its morpheme through mergeMorpheme',
      'the rebuild is an object literal again, which is B-124 exactly');
/* Both spellings: `key: value` and the shorthand `key,` — missing the
   shorthand made this guard report `form` as un-owned on its first run. */
const owned = callM
  ? [...callM[1].matchAll(/^\s{8}([a-z_]+)\s*(?::|,\s*$)/gm)].map(m => m[1])
  : [];
check(owned.length >= 8, `the panel names ${owned.length} of its own keys`,
      `parsed: ${owned.join(', ') || '(none)'}`);

// ── 1. a key the panel does not own survives ────────────────────────────────
ctx.__existing = {
  id: 'w.m_001', form: 'giy', gloss: 'wear', type: 'word',
  comments: [{ text: 'checked against the grammar', date: '2026-08-30' }],
  some_future_field: 'kept',
};
ctx.__managed = { id: 'w.m_001', form: 'giy', gloss: 'wear-NEW', type: 'word' };
run('globalThis.__out = mergeMorpheme(__existing, __managed)');
check(run('__out.comments && __out.comments.length === 1'),
      'a morpheme comment survives a save that did not touch it',
      `comments came back as ${JSON.stringify(run('__out.comments'))}`);
check(run("__out.some_future_field === 'kept'"),
      'so does any other key the panel does not name');
check(run("__out.gloss === 'wear-NEW'"), 'and the panel’s own value still wins');

// ── 2. the deliberate drops are still deliberate ────────────────────────────
ctx.__existing2 = {
  id: 'w.m_002', form: 'DIk', gloss: 'NMLZ',
  dict_id: 'dict_1', type: 'bound.morpheme', part_of_speech: 'AFFIX',
  comments: [{ text: 'keep me' }],
};
// what the panel passes when the annotator has cleared all three controls
ctx.__managed2 = { id: 'w.m_002', form: 'DIk', gloss: 'NMLZ',
                   dict_id: undefined, type: undefined, part_of_speech: undefined };
run('globalThis.__out2 = mergeMorpheme(__existing2, __managed2)');
for (const k of ['dict_id', 'type', 'part_of_speech'])
  check(run(`!('${k}' in __out2)`), `clearing ${k} still drops the key`,
        `a bare spread would have resurrected ${JSON.stringify(run(`__out2.${k}`))}`);
check(run('__out2.comments && __out2.comments.length === 1'),
      'and the unowned key survives that too');

// ── 3. every morpheme field the table declares is either owned or carried ───
run(`globalThis.__declared = fieldsOf('morpheme').filter(f => f.stored !== false).map(f => f.key)`);
const declared = run('__declared');
const carried = declared.filter(k => !owned.includes(k));
ctx.__probe = Object.fromEntries(carried.map(k => [k, 'PROBE']));
ctx.__probe.id = 'w.m_003';
run('globalThis.__out3 = mergeMorpheme(__probe, { id: "w.m_003", form: "x" })');
const lost = carried.filter(k => run(`__out3.${k}`) !== 'PROBE');
check(lost.length === 0,
      `all ${carried.length} declared morpheme field(s) the panel does not own are carried through`,
      `lost: ${lost.join(', ')}`);


/* ── 4. B-134: the edit trail ────────────────────────────────────────────────
   Two rules, and the second is why the first was not enough on its own.

   appendProv is THE writer, and it SEEDS. Before v3.14.276 applyProvToObj
   assigned obj.prov and then created an empty history, so an object that
   arrived with a stamp and no trail — everything corpus_ingest.py writes, and
   every morpheme — lost its creation moment to the first edit.

   The morpheme row is GATED. The stamp used to be
   `prov: gloss ? prov() : (existing?.prov || null)`, which re-stamped every
   glossed morpheme on every word save. Appending on that basis makes the trail
   a log of saves rather than of edits, so the gate is part of the fix, not a
   tidy-up beside it. */
console.log('\nB-134: the edit trail\n');

const OLD = { annotator_id: 'ann_001', annotator: 'First', date: '2026-08-01', time: '09:00:00' };
const NEW = { annotator_id: 'ann_002', annotator: 'Second', date: '2026-08-30', time: '11:00:00' };

check(typeof run('typeof appendProv') === 'string' && run('typeof appendProv') === 'function',
      'appendProv exists as its own function, so a guard can execute it');

ctx.__seed = { id: 'w.m_010', form: 'giy', prov: OLD };   // a stamp, no trail
ctx.__NEW  = NEW;
run('globalThis.__s = appendProv(__seed, __NEW)');
check(run('__s.prov_history.length === 2'),
      'an object with a prov and no history is seeded from that prov, not started at the edit',
      `history came back as ${JSON.stringify(run('__s.prov_history'))}`);
check(run("__s.prov_history[0].annotator_id === 'ann_001'"),
      'and the creation moment is the first entry');

ctx.__grown = { id: 'w.m_011', prov: OLD, prov_history: [OLD] };
run('globalThis.__g = appendProv(__grown, __NEW)');
check(run('__g.prov_history.length === 2 && __g.prov_history[1].annotator_id === "ann_002"'),
      'an object that already has a history is appended to, never replaced');
check(run('__grown.prov_history.length === 1'),
      'and the caller’s array is not mutated behind its back');

run('globalThis.__b = appendProv({}, __NEW)');
check(run('__b.prov_history.length === 1'),
      'an object with neither gets a one-entry history');

check(run('[__s, __g, __b].every(o => o.prov_history[o.prov_history.length - 1] === o.prov)'),
      'in every case the last history entry IS the object’s prov — the corpus-wide invariant');

/* applyProvToObj must not be a second implementation of the same rule: it was
   one, and the two disagreed about seeding, which is the bug (PRACTICES §4). */
const apply = decomment(fnSrc('LingCoT.html', 'applyProvToObj'));
check(/appendProv\(/.test(apply),
      'applyProvToObj goes through appendProv rather than writing the rule again',
      `its body is now: ${apply.replace(/\s+/g, ' ').slice(0, 120)}`);
ctx.__mut = { id: 's_1', prov: OLD };
run('applyProvToObj(__mut)');
check(run('__mut.prov_history.length === 2 && __mut.prov_history[0].annotator_id === "ann_001"'),
      'and executing it seeds the same way',
      `history came back as ${JSON.stringify(run('__mut.prov_history'))}`);

/* The gate, read off the call rather than retyped. Static, deliberately: the
   comparisons it makes are DOM reads, and the property worth pinning is that
   the stamp is reached through a gate at all. */
check(/const mChanged\s*=/.test(save),
      'saveWord computes whether the morpheme row itself changed');
check(!/prov:\s*gloss\s*\?\s*prov\(\)/.test(save),
      'and no longer stamps every glossed morpheme on every save',
      'the ungated `prov: gloss ? prov() : ...` is back — B-134 exactly');
check(callM && /mChanged\s*\?\s*appendProv\(existing, mp\)/.test(callM[1]),
      'the trail is extended only when that row changed');
check(callM && /carryProv\(existing\)/.test(callM[1]),
      'and an unchanged row keeps the trail it had, through carryProv');

/* Composed with mergeMorpheme, which is what actually reaches the corpus. */
ctx.__ex4 = { id: 'w.m_012', form: 'giy', gloss: 'wear', prov: OLD, prov_history: [OLD] };
run(`globalThis.__unchanged = mergeMorpheme(__ex4, { id: 'w.m_012', form: 'giy',
       ...carryProv(__ex4) })`);
check(run('__unchanged.prov_history.length === 1 && __unchanged.prov.annotator_id === "ann_001"'),
      'an untouched morpheme comes out of a word save with the stamp it went in with');
run(`globalThis.__changed = mergeMorpheme(__ex4, { id: 'w.m_012', form: 'giy',
       ...appendProv(__ex4, __NEW) })`);
check(run('__changed.prov_history.length === 2 && __changed.prov.annotator_id === "ann_002"'),
      'and an edited one comes out with its trail one longer');

/* The `prov: null` half. A morpheme with no gloss used to be written with a
   null stamp, so a POS-only morpheme lost its attribution entirely. */
ctx.__noGloss = { id: 'w.m_013', form: 'lAr', part_of_speech: 'AFFIX', prov: OLD };
run(`globalThis.__ng = mergeMorpheme(__noGloss, { id: 'w.m_013', form: 'lAr',
       ...carryProv(__noGloss) })`);
check(run('__ng.prov && __ng.prov.annotator_id === "ann_001"'),
      'a morpheme with no gloss keeps its stamp instead of being written null');
check(run("!('prov_history' in __ng)"),
      'and gains no empty history key it never had');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
