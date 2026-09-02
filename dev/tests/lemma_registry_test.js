#!/usr/bin/env node
/* =============================================================================
   lemma_registry_test.js, a lemma is a group, not a dictionary entry
   Run:  node dev/tests/lemma_registry_test.js
   =============================================================================
   D35 stage A2. A lemma names a group of entries. It has no gloss, no part of
   speech and no morphology, and nothing points at it as an analysis. Storing it
   as a dictionary row with `type: 'lemma'` meant every consumer had to remember
   to filter it out, and the ones that forgot inflated the entry count, the
   duplicate-form report and the export type filter.

   What this guard is protecting:

     1. nothing puts a lemma back into the entry stream. That is the whole
        change, and it is one careless push away from undone.
     2. every write of the dictionary file goes through dictFileItems(). A path
        that writes S.dictionary alone silently deletes every lemma record in
        the project on the next save, and leaves the corpus full of lemma_ids
        pointing at nothing.
     3. the migration keeps ids. A converted lemma with a new id orphans every
        lemma_id in the corpus, which is unrecoverable rather than annoying.

   Section 4 is executed rather than read, against the real fixture dictionary.

   D58 §3, v3.14.386: the two older spellings — `record: 'lemma'` (v3.14.184–237)
   and `type: 'lemma'` (before that) — are no longer converted, because nothing
   has written either since v3.14.237 and the last file holding one was
   `samples/turkish-test`, retired at v3.14.384. This guard's job changed with
   them: it used to prove the migration converted them, and now proves there is
   nothing left to convert — in the CODE and in the DATA, because either alone
   would be a claim about half the question.
   ============================================================================= */

const fs   = require('fs');
const { read, fnSrc, decomment, moduleFiles } = require('./_source.js');
const { requireCorpus, requireCompanion, loadCompanion, companionsIn } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html  = read('LingCoT.html');
const files = Object.fromEntries([['LingCoT.html', html], ...moduleFiles()]);
const all   = decomment(Object.values(files).join('\n'));

/* -- 1. the registry exists and is indexed -------------------------------- */
for (const fn of ['_indexLemma', 'buildLemmaIndex', 'splitDictFile', 'dictFileItems',
                  'lemmaById', 'lemmaFormOf'])
  check(new RegExp(`function ${fn}\\s*\\(`).test(html), `${fn}() is defined`);

check(/lemmaById:\s*new Map\(\)/.test(html) && /lemmaByForm:\s*new Map\(\)/.test(html),
      'S carries both registry indexes');
check(/buildLemmaIndex\(\)/.test(fnSrc('LingCoT.html', 'buildDictIndex')),
      'buildDictIndex rebuilds the registry too',
      'a full rebuild that skips the registry leaves stale lemma lookups');

/* One place appends to the registry, so the two indexes cannot drift from it. */
check((decomment(html).match(/S\.lemmas\.push\(/g) || []).length === 1,
      'S.lemmas is appended to in exactly one place, _indexLemma',
      'a second append site is how an index goes stale without anyone noticing');

/* -- 2. no lemma goes back into the entry stream -------------------------- */
const strayPush = [...all.matchAll(/S\.dictionary\.push\((\w+)\)/g)].filter(m => {
  const before = all.slice(Math.max(0, m.index - 700), m.index);
  return new RegExp(`${m[1]}\\s*=\\s*\\{[\\s\\S]*?record_type:\\s*'lemma'`).test(before);
});
check(strayPush.length === 0,
      'nothing pushes a lemma into S.dictionary',
      strayPush.map(m => m[0]).join(', '));

/* D58 §3: ZERO, not "confined to the migration". The cap was 1, then 2 as
   B-119 added a second spelling; each move was a decision that the shape still
   had a producer. It does not, so the number is the one that cannot be moved by
   accident.

   The lookbehind matters: `record_type: 'lemma'`, the CURRENT spelling, contains
   the substring `type: 'lemma'`, so without it the guard counts every correct
   write as a legacy one. */
const legacy = [...all.matchAll(/(?<!record_)type:\s*'lemma'|(?<!record_)type === 'lemma'|type !== 'lemma'|(?<!_)record:\s*'lemma'|(?<!_)record === 'lemma'/g)];
check(legacy.length === 0,
      'no legacy lemma spelling is named anywhere in the source',
      `${legacy.length} reference(s) left: ${legacy.map(m => m[0]).join(', ')}`);

/* -- 3. every dictionary write goes through dictFileItems ------------------
   The autosave ledger is the only writer today. The check is written against
   the write rather than the function name, so a second writer added later is
   caught by the same rule. */
const events = decomment(files['events.js'] || '');
const dictWrites = [...events.matchAll(/consider\('dict',[^)]*\)/g)];
check(dictWrites.length > 0, `found ${dictWrites.length} dictionary write site(s)`);
for (const m of dictWrites)
  check(/dictFileItems\(\)/.test(m[0]),
        `the dictionary write passes dictFileItems()`,
        'writing S.dictionary alone deletes every lemma record in the project');

check(!/consider\('dict',[^)]*S\.dictionary\b/.test(events),
      'no write path serialises S.dictionary on its own');

/* -- 3b. one discriminator, executed rather than read ---------------------- */
{
  /* B-119 added a third shape and no fixture held one, so the branch reading the
     CURRENT spelling was exercised by no corpus on disk — found by falsification,
     deleting it left every guard green. That is still true, so this still runs
     the real `splitDictFile` over rows built here.

     D58 §3: what it asserts is now the SHRUNKEN contract. One spelling reaches
     the registry; anything else is a dictionary entry, which is what the default
     branch has always said about a row that declares nothing. The older
     spellings are included so the case states what became of them rather than
     leaving it to be discovered. */
  const split = new Function(`${fnSrc('LingCoT.html', 'splitDictFile')}\nreturn splitDictFile;`)();
  const rows = [
    { id: 'l1', form: 'yüz', record_type: 'lemma' },              // the only shape
    { id: 'l2', form: 'geç', record: 'lemma' },                   // v3.14.184–237
    { id: 'l3', form: 'kuzey', type: 'lemma' },                   // pre-v3.14.184
    { id: 'e1', form: 'yüzmek', type: 'word', gloss: 'to swim' }, // a real entry
  ];
  const { entries, lemmas, migrated } = split(rows);
  check(lemmas.length === 1 && lemmas[0].id === 'l1',
        'only the current spelling reaches the registry',
        `${lemmas.length} reached it: ${lemmas.map(l => l.id).join(', ')}`);
  check(migrated === 0,
        'and nothing is migrated, because nothing is converted any more',
        `migrated ${migrated}`);
  check(entries.length === 3,
        'the older spellings fall through to the entry stream, like any undeclared row',
        '         this is what makes the data check in §4 load-bearing rather than a formality: '
      + 'nothing in the code would notice such a row now');
  check(entries.every(e => e.record_type === 'dict_entry'),
        'and every one of them is declared on the way through');
}

/* -- 4. and the DATA holds none of them, in every fixture ------------------
   The other half of D58 §3. With the converter gone, a stray `record: 'lemma'`
   row would be filed as a dictionary entry and its group would vanish from the
   registry — silently, and with every `lemma_id` in the corpus still pointing at
   it. The code check above says nothing about that; this does, and it walks
   EVERY dictionary in the fixture set rather than the first, because one clean
   file is not the claim. */
{
  const dicts = companionsIn('dictionary');
  check(dicts.length > 0, `${dicts.length} dictionary file(s) to check`,
        'a data check with no data is not a check');
  let rowsSeen = 0, lemmasSeen = 0;
  const offenders = [];
  for (const p of dicts) {
    const rows = loadCompanion(p, 'lemma shapes').records;
    rowsSeen += rows.length;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      if (r.record_type === 'lemma') { lemmasSeen++; continue; }
      if (r.record === 'lemma' || r.type === 'lemma')
        offenders.push(`${require('path').basename(p)}:${r.id || '(no id)'}`);
    }
  }
  check(offenders.length === 0,
        `no shipped dictionary row carries an older lemma spelling (${rowsSeen} rows)`,
        `         ${offenders.length}: ${offenders.slice(0, 5).join(', ')}\n`
      + '         such a row would now load as a dictionary ENTRY and its group would be lost');
  check(lemmasSeen > 0,
        `and ${lemmasSeen} row(s) do carry the current one, so the check is not vacuous`,
        'no lemma records at all means this walked nothing that could fail');

  /* An already-declared file passes through untouched, which is what makes
     opening one twice a no-op rather than a repeated migration report. */
  const dictPath = requireCompanion(requireCorpus('turkish', 'lemma registry'), 'dictionary');
  const rows = loadCompanion(dictPath, 'lemma registry').records;
  const split = new Function(`${fnSrc('LingCoT.html', 'splitDictFile')}\nreturn splitDictFile;`)();
  const { entries, lemmas, migrated } = split(rows);
  check(migrated === 0, 'the fixture needs no migration', `migrated ${migrated}`);
  check(entries.length + lemmas.length === rows.length,
        'nothing is dropped and nothing is duplicated',
        `${entries.length} + ${lemmas.length} vs ${rows.length}`);
  check(lemmas.length > 0 && lemmas.every(l => l.record_type === 'lemma'),
        `every one of its ${lemmas.length} lemma records is marked`);
  const second = split([...entries, ...lemmas]);
  check(second.lemmas.length === lemmas.length, 'and a second load finds every one again');
}

/* -- 5. lemma lookups do not go through the entry indexes ----------------- */
check(!/dictById\.get\(\w+\.lemma_id\)/.test(all),
      'no lemma is resolved through dictById',
      'the entry index no longer contains lemmas, so such a lookup returns null');
check(/S\.lemmaByForm\.get/.test(fnSrc('LingCoT.html', 'lookupLemma')),
      'lookupLemma reads the registry index');

/* ── D50 stage 4d, L-020: what is left of the legacy dictionary fields ──────
   Three cases were treated differently, and D58 §3 removed two of them:
     · `alternate_forms` → `variants` (B-044's rename) — deleted v3.14.386
     · `definition` → `meaning` — deleted v3.14.386
   Both existed for one file, the 19 occurrences in `samples/turkish-test`,
   retired at v3.14.384; no writer had emitted either key since v3.14.138.

   What remains is the lemma residue, dropped when empty and KEPT when not,
   because a project typed it and D35 B5 decides whether it survives, not a
   migration. It stays for that reason and not for back-compatibility: the KEEP
   branch is a rule about the annotator's work, and it is why this block did not
   go with the other two.

   Run against synthetic rows, not the fixture. Both corpora hold zero non-empty
   residue, so the KEEP branch has no coverage from real data at all. */
{
  const vm = require('vm');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fnSrc('LingCoT.html', '_migrateDictLegacy'), ctx);

  /* The two retired keys are passed in deliberately: with the migration gone
     they must be left ALONE rather than half-handled, and a reader who deleted
     the wrong loop would otherwise see nothing fail. */
  const entries = [
    { id: 'e1', form: 'a', alternate_forms: ['aa', 'ab'] },
    { id: 'e4', form: 'd', definition: 'an old definition' },
  ];
  const lemmas = [
    { id: 'l1', form: 'p', gloss: null, part_of_speech: null, comments: [], transliterations: [] },
    { id: 'l2', form: 'q', gloss: 'a real gloss somebody typed', comments: [] },
  ];
  ctx.__e = entries; ctx.__l = lemmas;
  const n = vm.runInContext('_migrateDictLegacy(__e, __l)', ctx);

  check('alternate_forms' in entries[0] && !('variants' in entries[0]),
        'a retired key is left untouched, not half-converted',
        '         the migration is gone; silently deleting the key instead would lose data '
      + 'from a file the deletion assumed does not exist');
  check(entries[1].definition === 'an old definition' && !('meaning' in entries[1]),
        'and so is the other one');
  check(n.variants === 0 && n.meaning === 0,
        'and the counters the loader logs report zero, which is the claim',
        `         got ${JSON.stringify(n)}`);

  check(!('gloss' in lemmas[0]) && !('comments' in lemmas[0]) && !('transliterations' in lemmas[0]),
        'empty lemma residue is dropped');
  check(lemmas[1].gloss === 'a real gloss somebody typed',
        'a NON-EMPTY lemma field is kept, not dropped',
        '         a tier label is not a reason to discard what somebody typed; D35 B5 decides this');
  check(n.lemmaKept === 1 && n.lemmaEmpty === 5,
        `and the counts say which happened (${n.lemmaEmpty} dropped, ${n.lemmaKept} kept)`,
        `         got ${JSON.stringify(n)}`);

  // Idempotent: a second pass on already-migrated rows must change nothing.
  const before = JSON.stringify([entries, lemmas]);
  vm.runInContext('_migrateDictLegacy(__e, __l)', ctx);
  check(JSON.stringify([entries, lemmas]) === before,
        'and running it twice changes nothing, so a re-save cannot drift');
}

/* Nothing mints a legacy lemma field empty any more. `comments: []` was written
   on every new lemma — 33 in the live corpus, all empty. */
{
  const sites = [['LingCoT.html', '_resolveOrCreateLemma']];
  for (const [file, fn] of sites) {
    const body = decomment(fnSrc(file, fn));
    check(!/comments:\s*\[\]/.test(body),
          `${fn} does not mint an empty comments array on a new lemma`);
  }
  const ev = decomment(read('modules/events.js'));
  const lemmaLit = /const lemmaEntry = \{[\s\S]*?\n      \};/.exec(ev);
  check(!!lemmaLit, 'found the lemma literal in events.js');
  check(lemmaLit && !/comments:\s*\[\]/.test(lemmaLit[0]),
        'and the quick-lemma panel does not mint one either');
}

/* -- 5. the citation form is correctable ---------------------------------
   L-017, closed v3.14.262. A lemma's form was settable exactly once, in the
   quick-create panel, and nothing edited it afterwards — so a typo was
   permanent and the only route past it produced a SECOND lemma meaning the same
   thing, which is B-043's forking hazard by another road.

   Executed rather than read: the whole risk of renaming is the index, and a
   source scan cannot see whether a bucket was left behind. */
{
  const vm = require('vm');
  const ctx = {
    S: { lemmas: [], lemmaById: new Map(), lemmaByForm: new Map() },
    normForm: f => String(f || '').toLowerCase(),
    applyProvToObj: () => {},
    stampField: (o, f) => { (o.field_prov ||= {})[f] = 1; },
    prov: () => ({ annotator: 'Ann', date: '2026-08-30' }),
    linkNote: () => {}, logEvent: () => {},
    mutate: (t, w) => { ctx.__wrote = [t, w]; },
    console,
  };
  ctx._dictSorted = ['stale'];
  vm.createContext(ctx);
  for (const fn of ['_numberBucket', 'lemmaBucket', 'assignLemmaHomographs',
                    '_indexLemma', 'lemmaById', 'renameLemma'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });
  vm.runInContext("var _dictSorted = ['stale'];", ctx);

  const l = { id: 'L1', form: 'gitmek', record_type: 'lemma' };
  vm.runInContext('_indexLemma(__l)', Object.assign(ctx, { __l: l }));
  check(ctx.S.lemmaByForm.get('gitmek')?.[0] === l, 'a lemma indexes under its citation form');

  const out = vm.runInContext("renameLemma('L1', 'gitmék')", ctx);
  check(out === l && l.form === 'gitmék', 'renameLemma corrects the form in place');
  check(l.id === 'L1', 'and keeps the id, so every token that links here still does',
        'a rename that mints an id orphans every lemma_id in the corpus');
  check(!ctx.S.lemmaByForm.has('gitmek'), 'the old citation bucket is gone',
        'a stale bucket makes the typo still resolve, which is worse than not renaming');
  check(ctx.S.lemmaByForm.get('gitmék')?.[0] === l, 'and the new one holds the record');
  check(ctx.S.lemmaById.get('L1') === l, 'the id index is untouched');
  check(!!l.field_prov?.form, 'the form carries a field stamp',
        'a corrected citation form is a person\'s work and says so');
  check(ctx.__wrote && ctx.__wrote[0] === 'dict', 'and the write is journalled against the dict store');

  const same = vm.runInContext("renameLemma('L1', 'gitmék')", ctx);
  check(same === null, 'renaming to the form it already has does nothing');
  check(vm.runInContext("renameLemma('L1', '   ')", ctx) === null, 'and an empty form is refused');

  /* The offer that reaches it. A rename nobody can ask for is a dead function. */
  const strip = decomment(fnSrc('LingCoT.html', 'lemmaStripHtml'));
  check(/act: 'lemma-rename'/.test(strip),
        'the lemma strip offers the rename when the field was already linked');
  check(/renameLemma\(/.test(decomment(fnSrc('LingCoT.html', 'takeOffer'))),
        'and takeOffer is what performs it, like every other offer');
}

console.log('\nB-154: a load must not delete a record something still points at\n');
{
  /* The defect, reproduced, not described. `applyDict` replaces S.lemmas
     wholesale — which is what a load means — and a record created this session
     is in memory only, while the tokens and entries put on it keep their
     lemma_id. That is the state dev/fixtures/chinese-test is in: one record
     gone, an entry and a token still naming it. */
  const vm2 = require('vm');
  const w = { id: 'w_1', form: '\u53ea', lemma_id: 'L_unsaved', morphemes: [] };
  const S = {
    lemmas: [{ id: 'L_unsaved', form: '\u53ea', record_type: 'lemma' },
             { id: 'L_gone',    form: 'nothing-cites-me', record_type: 'lemma' }],
    wordById: new Map([['w_1', { word: w }]]),
  };
  const ctx = vm2.createContext({ S, console, logEvent: () => {} });
  vm2.runInContext(fnSrc('LingCoT.html', '_carryUnsavedLemmas'), ctx);

  // the file being loaded: an entry that cites the missing record, no lemma rows
  ctx.__incoming = [];
  ctx.__entries  = [{ id: 'd_1', form: '\u53ea', lemma_id: 'L_unsaved' }];
  const carried = vm2.runInContext('_carryUnsavedLemmas(__incoming, __entries)', ctx);

  check(carried.length === 1 && carried[0].id === 'L_unsaved',
        'a record the file lacks, that the corpus still cites, survives the load',
        '         B-154: the replacement deleted the record and left every reference to it');
  check(!carried.some(l => l.id === 'L_gone'),
        'and one nothing points at does not — a load is still a load',
        '         carrying everything would make applyDict a merge, which it is not');

  // The rule this restores, said out loud: deleteLemmaRecord refuses a record
  // with members, and a load must not do what a delete is forbidden to do.
  const del = decomment(fnSrc('LingCoT.html', 'deleteLemmaRecord'));
  check(/g\.entries\.length \|\| g\.tokens\.length/.test(del),
        'the delete still refuses a record with members, which is the rule being restored');

  // And applyDict actually asks, before it assigns.
  const ap = decomment(fnSrc('LingCoT.html', 'applyDict'));
  const call = /(?:const|let)\s+(\w+)\s*=\s*_carryUnsavedLemmas\(/.exec(ap);
  check(!!call, 'applyDict calls _carryUnsavedLemmas');
  const assign = /S\.lemmas\s*=\s*([^;]+);/.exec(ap);
  check(!!assign, 'and assigns S.lemmas');
  if (call && assign) {
    check(ap.indexOf('_carryUnsavedLemmas') < assign.index,
          'it asks BEFORE it replaces',
          '         asked after, S.lemmas is already the incoming list and the answer is always none');
    /* The mutation this exists for: calling the helper and then throwing the
       answer away passes every other check in this section. The value assigned
       has to be the one the carry produced. */
    check(new RegExp(`\\b${call[1]}\\b`).test(assign[1]),
          `and the carried records reach S.lemmas (${assign[1].trim()})`,
          '         a call whose result is discarded is the defect with a function name on it');
  }
}

console.log('\nD52 stage D: a lemma_id that resolves to nothing can be repaired\n');
{
  const vm2 = require('vm');
  const w = { id: 'w_1', form: '\u53ea\u6709', lemma_id: 'L_missing', morphemes: [] };
  const S = {
    lemmas: [], lemmaById: new Map(), lemmaByForm: new Map(),
    dictionary: [{ id: 'd_1', form: '\u53ea', lemma_id: 'L_missing' },
                 { id: 'd_2', form: 'ok', lemma_id: null }],
    wordById: new Map([['w_1', { word: w }]]),
  };
  const wrote = [];
  const ctx = vm2.createContext({ S, console, wrote,
    lemmaById: id => S.lemmaById.get(id) || null,
    normForm: x => String(x || '').toLowerCase(),
    _derivedFieldProv: () => ({ annotator_id: null, annotator: 'auto (lexicon)', derived: true }),
    logEvent: () => {}, mutate: (st) => wrote.push(st), _dictSorted: null });
  for (const n of ['danglingLemmas', 'repairDanglingLemma',
                   '_numberBucket', 'lemmaBucket', 'assignLemmaHomographs', '_indexLemma'])
    vm2.runInContext(fnSrc('LingCoT.html', n), ctx);

  const d = vm2.runInContext('danglingLemmas()', ctx);
  check(d.length === 1 && d[0].id === 'L_missing', `one dangling lemma found (${d.length})`);
  check(d[0].entries === 1 && d[0].tokens === 1, 'counted from both sides');
  /* The ENTRY's form, not the token's: an entry is a lexeme and a token is an
     inflected occurrence of one, so 只 beats 只有 as a citation form. */
  check(d[0].form === '\u53ea', 'the citation form comes from the entry, not the token',
        `         got ${d[0].form} — a token is an occurrence, an entry is the lexeme`);

  const rec = vm2.runInContext("repairDanglingLemma('L_missing')", ctx);
  check(rec && rec.id === 'L_missing',
        'the repair REUSES the id, which is what makes it a repair',
        '         a new id would leave every reference dangling and add a second group');
  check(rec.record_type === 'lemma', 'and declares what it is');
  check(rec.prov && rec.prov.derived === true,
        'stamped derived — the app named this record, not the annotator');
  check(vm2.runInContext('danglingLemmas()', ctx).length === 0,
        'and nothing dangles afterwards');
  check(S.lemmaById.get('L_missing') === rec && S.lemmas.includes(rec),
        'the record is in the registry, not only returned');
  check(wrote.length === 1 && String(wrote[0]).includes('dict'),
        'and the write is journalled against the dict store');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
