#!/usr/bin/env node
/* =============================================================================
   corpus_load_test.js. B-171 — there is ONE door into a loaded corpus
   Run:  node dev/tests/corpus_load_test.js
   =============================================================================
   `replayJournal` was called from exactly one place and `handlePath` was not it.
   The header Dictionary button and the companion banner's Load reached
   `applyCorpus` directly, so a corpus opened that way held a tree without its
   journalled records — and `compact()` writes the base from the tree and THEN
   truncates the journal, so the next save wrote them out of existence. Silently.

   EXECUTED, because the claim is behavioural: a corpus loaded through the door
   the annotator actually used comes back carrying what the journal held. A
   source scan would only prove the call is written down somewhere.

   The pywebview bridge is stubbed here — two methods, `read_abs` and
   `open_project`, returning texts this file builds — which is the whole of what
   the loader asks of Python.
   ============================================================================= */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { read, fnSrc, decomment } = require('./_source.js');
const { corpusDir, corpusFilesIn, loadCorpus } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* ── the smallest project that can lose something ────────────────────────────── */
const WORD = { id: 'd1.sec_001.p_001.s_001.w_001', form: 'ev', gloss: 'house' };
const DOC  = {
  record_type: 'document', id: 'd1',
  metadata: { title: 'T', language: 'tr' },
  sections: [{ id: 'd1.sec_001', title: 'S', paragraphs: [
    { id: 'd1.sec_001.p_001', sentences: [
      { id: 'd1.sec_001.p_001.s_001', text: 'ev', words: [WORD] }] }] }],
};
const CORPUS = JSON.stringify(DOC) + '\n';

/* One journalled edit, in the shape `_journalOne` writes: the same word, with a
   part of speech the base does not have. If it is on the tree after the load,
   the journal was read; if it is not, the next save would have erased it. */
const JOURNAL = JSON.stringify({
  op: 'put', t: 'corpus', id: WORD.id,
  rec: { ...WORD, part_of_speech: 'NOUN' },
}) + '\n';

function bootWith({ corpusText = CORPUS, journalText = JOURNAL, path = '/p/mytext.jsonl',
                    missing = [], dictText = '' } = {}) {
  const ctx = makeCtx({ hasId: () => true });
  const seen = { alerts: [] };
  ctx.alert = m => seen.alerts.push(String(m));
  ctx.confirm = () => true;
  /* BEFORE the app is loaded, and that is the whole trick: `_pwReady` resolves
     immediately when `window.pywebview` is already there, and otherwise waits on
     a `pywebviewready` event the harness has no way to fire. Attaching the stub
     afterwards leaves every `await _pwReady` hanging for ever, which is a test
     that reports nothing rather than failing. */
  ctx.pywebview = {
    api: {
      read_abs: async () => corpusText,
      /* Boot asks for these and logs a stack when they are absent — noise that
         reads like a failure in a passing run. */
      get_workspace: async () => ({ workspace: '/w', corpora: '/w/corpora' }),
      open_project: async () => ({
        corpusText: '', dictText, participantsText: '', journalText,
        /* The derivation misses a hand-named file, which is the second way the
           two doors disagreed: `openCorpusDialog` could not open one at all. */
        corpusPath: '/p/mytext_corpus.jsonl',
        dictPath: '/p/mytext_dictionary.jsonl',
        participantsPath: '/p/mytext_participants.jsonl',
        missing, oversize: [],
      }),
    },
  };
  const errs = loadApp(ctx, appSources());
  if (errs.length) throw new Error(`boot: ${errs[0][0]} ${errs[0][1].message}`);
  return { ctx, seen, run: e => vm.runInContext(e, ctx) };
}

/* ── the two behavioural claims, in one async pass ───────────────────────────── */
async function behavioural() {
  console.log('\nthe journal survives the load');
  {
    const { ctx, run } = bootWith();
    ctx.__p = '/p/mytext.jsonl';
    let threw = null;
    try { await run('handlePath(__p)'); } catch (e) { threw = e; }
    check(!threw, 'handlePath runs and resolves', threw && `         ${threw.message}`);

    check(run('S.docs.length') === 1, 'the corpus is loaded',
          `         ${run('S.docs.length')} document(s)`);
    const word = JSON.parse(run('JSON.stringify([...S.wordById.values()][0]?.word || null)') || 'null');
    check(!!word, 'and the word is in the index');
    check(word && word.part_of_speech === 'NOUN',
          'carrying the JOURNALLED part of speech — the journal was replayed',
          `         got ${JSON.stringify(word && word.part_of_speech)}.\n`
        + '         B-171: this door reached applyCorpus without replayJournal, so the\n'
        + '         next compact() wrote the base from a tree missing this edit and then\n'
        + '         truncated the journal that held it.');
  }

  console.log('\na corpus named by hand');
  {
    /* `open_project` derives its paths from the role suffix, so for
       `mytext.jsonl` it reports `mytext_corpus.jsonl` missing — and
       `checkMissingFiles` treats a missing corpus as a hard abort. The picked
       file IS the corpus. `openCorpusDialog` could not open one of these at all,
       which is the second way the two doors disagreed. */
    const { ctx, seen, run } = bootWith({ missing: ['mytext_corpus.jsonl'] });
    ctx.__p = '/p/mytext.jsonl';
    await run('handlePath(__p)');
    check(run('S.docs.length') === 1,
          'a file whose name carries no role suffix still loads',
          `         alerts: ${JSON.stringify(seen.alerts)}`);
  }

  console.log('\na companion file opens its project');
  {
    /* B-184, reported from use twice. `.` sorts before `_`, so
       `<name>.journal.jsonl` is the FIRST file in every project folder and is
       what the dialog lands on — and a journal is usually 0 bytes, so the
       content detector calls it `unknown` and the app said it could not tell
       what the file was. It could: the app wrote the name.

       Executed through the real door, with `read_abs` recording what it was
       asked for, because the claim is that the loader ASKS for the corpus beside
       the file it was handed. */
    for (const companion of ['/p/mytext.journal.jsonl', '/p/mytext_participants.jsonl']) {
      const { ctx, seen, run } = bootWith();
      const asked = [];
      const inner = ctx.pywebview.api.read_abs;
      ctx.pywebview.api.read_abs = async pth => { asked.push(pth); return inner(pth); };
      ctx.__p = companion;
      await run('handlePath(__p)');
      check(asked.includes('/p/mytext_corpus.jsonl'),
            `${companion.split('/').pop()} asks for the corpus beside it`,
            `         asked for: ${JSON.stringify(asked)}`);
      check(run('S.docs.length') === 1,
            'and the project is loaded, not refused',
            `         alerts: ${JSON.stringify(seen.alerts)}`);
      check(seen.alerts.length === 0,
            'with nothing to dismiss on the way',
            `         ${JSON.stringify(seen.alerts)}`);
    }

    /* And when there is no corpus beside it, the message names BOTH files — the
       one picked and the one to open. The old one named neither. */
    const { ctx, seen, run } = bootWith();
    ctx.pywebview.api.read_abs = async pth =>
      (/_corpus\.jsonl$/.test(pth) ? null : '');
    ctx.__p = '/p/mytext.journal.jsonl';
    await run('handlePath(__p)');
    /* The harness's `t()` returns the key, so the KEY is what is asserted here
       and the message's shape is asserted against the locale: it must name both
       files, the one picked and the one to open. The old message named neither,
       and `unknown_type` — which is what a 0-byte journal used to get — cannot
       name them, because it does not know there is a project. */
    check(seen.alerts.length === 1 && seen.alerts[0] === 'alert.file.companion_no_corpus',
          'a companion with no corpus beside it gets the companion message',
          `         ${JSON.stringify(seen.alerts)}`);
    const msg = JSON.parse(read(path.join('resources', 'locale', 'en.json')))['alert.file.companion_no_corpus'];
    check(!!msg && msg.includes('{name}') && msg.includes('{corpus}'),
          'and that message names both the file picked and the file to open',
          `         ${JSON.stringify(msg)}`);
  }

  console.log('\na journal that belongs to another base is refused');
  {
    /* Replaying one applies edits to objects they were not made on, silently,
       because a put is last-write-wins. Refusing keeps both intact. */
    const head = JSON.stringify({ record_type: 'journal_head', opened: '2026-01-01',
                                  corpus: 'not-this-corpus' }) + '\n';
    const { ctx, seen, run } = bootWith({ journalText: head + JOURNAL });
    ctx.__p = '/p/mytext.jsonl';
    await run('handlePath(__p)');
    const word = JSON.parse(run('JSON.stringify([...S.wordById.values()][0]?.word || null)') || 'null');
    check(!word || !word.part_of_speech,
          'the foreign journal is NOT applied',
          `         got ${JSON.stringify(word && word.part_of_speech)}`);
    check(seen.alerts.length > 0, 'and the refusal is said out loud, not logged and swallowed',
          '         a base and a journal that disagree is the one case where silence loses both');
  }

  structural();
}

function structural() {
  /* ── the shape, so a third door cannot be added quietly ───────────────────── */
  console.log('\none door');
  const html = read('LingCoT.html');
  const calls = (decomment(html).match(/\bapplyCorpus\(/g) || []).length;
  check(calls === 2,
        `applyCorpus is defined once and called once (${calls} occurrences)`,
        '         a second caller is B-171 exactly: a path to a loaded corpus that\n'
      + '         does not pass the journal. Route it through loadProjectFromPath.');
  const bundle = decomment(fnSrc('LingCoT.html', 'applyProjectBundle') || '');
  check(/applyCorpus\(/.test(bundle) && /replayJournal\(/.test(bundle)
        && /journalBaseMismatch\(/.test(bundle),
        'and its one caller replays the journal, and refuses one that does not belong',
        '         both halves matter: replaying a journal from a different base applies\n'
      + '         edits to objects they were not made on, last-write-wins and silent');

  const loader = decomment(fnSrc('LingCoT.html', 'loadProjectFromPath') || '');
  check(loader !== '' && /applyProjectBundle\(/.test(loader),
        'the one loader hands a corpus to applyProjectBundle');
  for (const [fn, what] of [['handlePath', 'the dictionary button and the companion banner'],
                            ['openCorpusDialog', 'the Open dialog']]) {
    const body = decomment(fnSrc('LingCoT.html', fn) || '');
    check(/loadProjectFromPath\(/.test(body) && !/applyCorpus\(/.test(body),
          `${fn} (${what}) goes through it and does not load a corpus itself`);
  }

  /* ── every migration the load defines, the load runs ──────────────────────
     Added v3.14.347 with B-176, because a mutation found the hole: removing the
     new migration's call site broke NOTHING. Five load-time migrations existed
     and no guard asserted that any of them was reached.

     A migration nothing calls is B-022 and B-023 again — `workspace_test.js`
     carries the same sentence for the setup path, and B-023 was exactly this:
     a step placed after an early return, silently skipped on every re-run. The
     failure is invisible by construction, because a file that was never migrated
     opens fine and writes the old shape back.

     Derived, not listed: the set comes from the definitions, so a sixth
     migration is covered the day it is written rather than the day someone
     remembers to add it here. `_migrateDictLegacy` belongs to the dictionary
     door, so both loaders count as callers. */
  console.log('\na migration that exists is a migration that runs, at every door');
  const bare    = decomment(html);
  const defined = [...bare.matchAll(/function\s+(_migrate\w+)\s*\(/g)].map(m => m[1])
                    .filter(fn => fn !== '_migrateCorpusRecords');
  const seq     = decomment(fnSrc('LingCoT.html', '_migrateCorpusRecords') || '');
  const corpus  = decomment(fnSrc('LingCoT.html', 'applyCorpus') || '');
  const dict    = decomment(fnSrc('LingCoT.html', 'applyDict') || '');
  const bundle2 = decomment(fnSrc('LingCoT.html', 'applyProjectBundle') || '');

  /* D58 §3, v3.14.386: two of the seven went — `_migrateDeclareRecordType` and
     `_migrateStripAnnotations`, both readers for shapes nothing writes. The
     floor moves with them rather than being left where a future deletion would
     trip it, and it stays a floor: the point is that the list is not empty, not
     that it is a particular length. */
  check(defined.length >= 3, `${defined.length} record migration(s) defined`,
        '         if this collapses to nothing every check below is vacuous');
  const uncalled = defined.filter(fn => !new RegExp(`\\b${fn}\\(`).test(seq + dict));
  check(uncalled.length === 0,
        'every one is in the sequence, or is the dictionary’s',
        `         never called: ${uncalled.join(', ')}\n`
      + '         a migration nothing calls is B-022 again: the file opens fine\n'
      + '         and writes the un-migrated shape straight back');

  /* TWO doors, and the second is the one that was missing. The base file is
     migrated; the JOURNAL is not — it carries record bodies as some earlier
     version wrote them, and replay puts those onto the cleaned tree. Whatever
     the sequence holds has to run again after replay, or every migration in it
     is undone for exactly the records a journal was carrying. */
  for (const [where, body] of [['applyCorpus', corpus], ['applyProjectBundle, after replay', bundle2]])
    check(/_migrateCorpusRecords\(/.test(body),
          `the sequence runs in ${where}`,
          '         one list, both doors — a door with a shorter list is the hole\n'
        + '         B-176 was found through');
  check(bundle2.indexOf('replayJournal(') !== -1
        && bundle2.indexOf('_migrateCorpusRecords(') > bundle2.indexOf('replayJournal('),
        'and after the replay, not before it',
        '         migrating first and replaying second puts the old shapes back');

  /* And before the readers read. B-023 was a step placed after an early return;
     this is the same mistake with an index instead of a return. */
  for (const [where, body] of [['applyCorpus', corpus], ['applyProjectBundle', bundle2]]) {
    const at = body.indexOf('_migrateCorpusRecords(');
    const ix = body.indexOf('buildCorpusIndex(');
    check(at !== -1 && ix !== -1 && at < ix,
          `and before buildCorpusIndex in ${where}`,
          '         a migration that runs after the indexes are built has already\n'
        + '         been read from by everything that matters');
  }

  /* ── D58 §3, v3.14.386: a file says what it is ────────────────────────────
     Both readers that decide what KIND of thing a record is used to fall back to
     sniffing its shape — `isDocument` on "does it have sections", and
     `detectFileType` on sections/paragraphs/metadata, then form+gloss. Both
     fallbacks were for files written before v3.14.238, and `detectFileType`'s
     own comment named the only one that still existed: "which is what
     `samples/` is". It was regenerated at v3.14.384.

     Deleting a fallback is invisible — nothing fails when it comes back — so
     this is the check that makes it a decision rather than a state. B-146 is why
     it matters more here than elsewhere: `detectFileType` is the one place where
     deciding wrongly makes a file refuse to open. */
  console.log('\na file declares its kind, and is not sniffed');
  {
    const dt = decomment(fnSrc('LingCoT.html', 'detectFileType') || '');
    check(dt.length > 0, 'detectFileType is there to read');
    check(!/first\.sections|first\.paragraphs|first\.metadata|first\.form/.test(dt),
          'detectFileType decides by record_type alone, with no shape fallback',
          '         a shape test cannot be fooled by a row nobody has met yet — a negative one can');
    check(/_KIND_ROWS/.test(dt),
          'and it reads the declaration table, so a new kind is declared in one place');

    const fx = fs.readFileSync(path.join(__dirname, '_fixture.js'), 'utf8');
    const isDoc = decomment(fx.slice(fx.indexOf('function isDocument')).split('\n}')[0]);
    check(!/isArray\(r\.sections\)/.test(isDoc),
          'and the guards\' own isDocument does the same',
          '         the fixture loader and the app must agree about what a document is');

    /* And the data: every shipped corpus row declares, or the deletion above
       broke the reader rather than retired it. */
    const undeclared = [];
    for (const f of corpusFilesIn(corpusDir() || '')) {
      for (const r of loadCorpus(f).records)
        if (r && typeof r === 'object' && !r.record_type) undeclared.push(path.basename(f));
    }
    check(undeclared.length === 0,
          'and every row of every shipped corpus declares one',
          `         undeclared rows in: ${[...new Set(undeclared)].join(', ')}`);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

behavioural();
