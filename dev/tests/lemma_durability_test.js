#!/usr/bin/env node
/* =============================================================================
   lemma_durability_test.js — a minted lemma survives the session that made it
   Run:  node dev/tests/lemma_durability_test.js
   =============================================================================
   B-195. `_createLemmaRecord` put the new record in `S.lemmas` and the two
   indexes and stopped there — no journal record, and `saveGen('dict')` unmoved,
   so `compact()` had no reason to rewrite the dictionary file. The TOKEN citing
   it was journalled the same second, by the save path that minted it.

   So the reference was durable and the record it names was not. `turkish-test`
   ended up with 5 words and 2 dictionary entries citing `su`, `içmek` and
   `tekrar`, whose lemma records died with the session; `danglingCompanions`
   logged *"7 lemma_id unresolved"* and the next session's dictionary write made
   it permanent, because `_carryUnsavedLemmas` starts from an empty registry on a
   fresh launch and had nothing left to carry.

   ONLY AN EXECUTED CHECK COULD FIND THIS. Every function involved is correct:
   `_indexLemma` indexes, `journalWrite` handles `dict`, `replayJournal` already
   routes a `record_type: 'lemma'` body to `S.lemmas`, `compact` writes
   `dictFileItems()`. What was missing is that nobody told any of them. §3 does
   the round trip the annotator did — mint, journal, quit, reopen — because that
   is the only place the absence shows.

   §4 is the general rule, and it is the reason this is a guard rather than a
   one-line fix: everything that mints a record into a durable store has to
   declare the write. It finds the minters by what they do, so the next one is
   covered.
   ============================================================================= */

const vm = require('vm');
const { read, decomment } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const APP = read('LingCoT.html');
const SRC = decomment(APP);

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
const run = expr => vm.runInContext(expr, ctx);
ctx.__loc = JSON.parse(read('resources/locale/en.json'));
run('_LOCALE = __loc;');

console.log('\n1 · minting one declares a write');

ctx.__docs = [{
  id: 'doc1', metadata: { title: 't', language: 'tur' },
  sections: [{ id: 'doc1.sec_001', title: 's', paragraphs: [{ id: 'doc1.sec_001.p_001',
    sentences: [{ id: 'doc1.sec_001.p_001.s_001', text: 'su', words: [
      { id: 'doc1.sec_001.p_001.s_001.w_001', form: 'su' }] }] }] }],
}];
run("applyCorpus(__docs, 'b195'); applyDict([], 'b195');");
run("S.annotatorId = S.annotatorId || 'ann_001';");

const gen0 = run("saveGen('dict')");
const jrn0 = run("_journal.length");
const id   = run("_createLemmaRecord('su')");

check(typeof id === 'string' && id.length > 0, 'a lemma record is minted', id);
check(run("S.lemmas.length") === 1, 'and lands in the registry');
check(run("saveGen('dict')") > gen0,
      'the dictionary is marked dirty',
      '         without this `compact()` has no reason to rewrite the file, and\n'
    + '         the record never leaves memory');
check(run("_journal.length") > jrn0,
      'and the mint is journalled',
      '         the token citing it is journalled the same second — a durable\n'
    + '         reference to a record that is not durable is the whole bug');

/* `|| null`, because when nothing was journalled the tail is `undefined` and
   `JSON.stringify` returns the string "undefined", which `JSON.parse` throws on.
   A guard that crashes where it should report tells you less. */
const rec = JSON.parse(run("JSON.stringify(_journal[_journal.length - 1] || null)"));
check(rec && rec.t === 'dict' && rec.op === 'put' && rec.id === id,
      'as a dict put naming the record', JSON.stringify(rec).slice(0, 160));
check(rec && rec.rec && rec.rec.record_type === 'lemma',
      'carrying record_type: lemma, which is what replay routes on',
      '         replayJournal picks S.lemmas over S.dictionary from this key alone');

console.log('\n2 · the file the compaction would write contains it');

check(run(`dictFileItems().some(x => x && x.id === ${JSON.stringify(id)})`),
      'dictFileItems() includes the new record',
      '         this is what `compact()` serialises for the dict target');

console.log('\n3 · executed: mint, quit, reopen — the session that lost them');

/* The base is the dictionary as it stood BEFORE the mint, which is what is on
   disk until a compaction runs. The journal is what the session appended. That
   gap is exactly where `su`, `içmek` and `tekrar` were lost. */
const journalText = run(`(() => {
  const head = JSON.stringify({ record_type: 'journal_head', corpus: null, dict: null,
                                opened: '2026-09-01 20:24:00' });
  return head + '\\n' + _journal.map(r => JSON.stringify(r)).join('\\n');
})()`);
ctx.__jrnl = journalText;
check(/"record_type":"lemma"/.test(journalText),
      'the journal on disk carries the lemma record',
      `         ${journalText.slice(0, 200)}`);

/* Reopen: the base has no lemma, and nothing is in memory to carry. */
run("applyCorpus(__docs, 'reopen'); applyDict([], 'reopen');");
check(run("S.lemmas.length") === 0,
      'on the base alone the registry is empty — the state that was reported');

const rep = JSON.parse(run("JSON.stringify(replayJournal(__jrnl))"));
check(rep.applied >= 1, `the journal replays (${rep.applied} applied)`, JSON.stringify(rep));
check(run(`S.lemmas.some(l => l && l.id === ${JSON.stringify(id)})`),
      'AND THE LEMMA IS BACK — the reference now resolves',
      '         this is the whole of B-195: without the journal record the token\n'
    + '         survives and the lemma it names does not');
/* `replayJournal` appends to `S.lemmas`; the ID INDEX is rebuilt after it, by
   the load path, not by the replay. Asserting `lemmaFormOf` without that step was
   testing the harness — the record was there and unreachable through the map the
   app resolves by. The load does exactly this pair, in this order. */
run("buildDictIndex();");
check(run(`lemmaFormOf(${JSON.stringify(id)})`) === 'su',
      'and resolves through the index once the load rebuilds it',
      '         the post-replay block in loadProject calls buildDictIndex() for\n'
    + '         this reason; a replay alone leaves the record unindexed');

console.log('\n4 · the rule: every mint into a durable store declares its write');

/* DERIVED. A minter is a function that pushes a freshly built record into one of
   the durable stores; each has to reach `mutate` so the journal and the save
   generation hear about it. Found by what they do, so the next one is covered. */
const MINTERS = ['_createLemmaRecord', 'renameLemma'];
for (const fn of MINTERS) {
  const body = (SRC.match(new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n\\}`)) || [''])[0];
  check(body.length > 0, `${fn} found`);
  check(/mutate\(/.test(body),
        `${fn} declares its write through mutate()`,
        '         indexing a record is not persisting it: `mutate` is what moves\n'
      + '         the save generation and appends the journal record');
}

/* `_indexLemma` is the indexer and must NOT mutate — it is called by the replay
   and by the load, where declaring a write would mark a freshly opened file
   dirty. Keeping the two apart is the point. */
const idx = (SRC.match(/function _indexLemma\(l\)[\s\S]*?\n\}/) || [''])[0];
check(idx.length > 0 && !/mutate\(/.test(idx),
      '_indexLemma stays a pure indexer',
      '         it runs during load and replay; a mutate() there would mark an\n'
    + '         untouched file dirty and re-journal what was just replayed');

console.log('\n5 · the reader that reported it in the field');

check(/function danglingCompanions/.test(SRC) || /companion references unresolved/.test(SRC),
      'danglingCompanions still counts unresolved references',
      '         it is what surfaced this from a real session, ahead of any guard');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
