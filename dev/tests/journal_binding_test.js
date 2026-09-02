#!/usr/bin/env node
/* =============================================================================
   journal_binding_test.js — D50 stage 3d: a journal knows which base it belongs
   to, and a missing companion is counted rather than merely noticed
   Run:  node dev/tests/journal_binding_test.js
   =============================================================================
   Two kinds of companion, bound two different ways on purpose.

   The JOURNAL is bound by fingerprint and a mismatch is REFUSED. Replaying a
   journal onto a base it was not written against would apply edits to objects
   that are not the ones they were made on — silently and completely, because a
   put is last-write-wins. Refusing leaves both files exactly as they were.

   The DICTIONARY and PARTICIPANTS are not bound by a recorded expectation at
   all. The corpus already contains its references, so a missing companion is
   simply the state in which they do not resolve, and counting them says more
   than a filename would. Their loss costs resolution and attribution and no
   data, so it warns and opens.

   The participants half is conflict ④ of the unified audit made visible:
   interning moved display names behind `annotator_id`, so a corpus opened
   without its participants file renders identifiers where it used to render
   names — and nothing counted that until this did.
   ============================================================================= */
const vm = require('vm');
const fs = require('fs');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, requireCompanion, splitEvents } = require('./_fixture.js');

const corpusPath = requireCorpus(null, 'journal binding');
const rawCorpus  = fs.readFileSync(corpusPath, 'utf8');
const rawDict    = fs.readFileSync(requireCompanion(corpusPath, 'dictionary'), 'utf8');
const rawParts   = fs.readFileSync(requireCompanion(corpusPath, 'participants'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(`         ${detail}`);
  ok ? pass++ : fail++;
};

function boot(withParticipants = true, withDict = true) {
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  if (errs.length) {
    console.log(`  FAIL the app did not load: ${errs[0][0]} — ${errs[0][1].message}`);
    process.exit(1);
  }
  ctx.__c = rawCorpus; ctx.__d = rawDict; ctx.__p = rawParts;
  vm.runInContext(`
    var _pe = splitProvEvents(parseJsonlText(__c));
    S.provEvents = []; _provEventKey = new Map();
    adoptProvEvents(_pe.items, _pe.events); S.docs = _pe.items;
    S.dictionary = []; S.lemmas = []; S.annotators = []; S.sources = [];
    if (${withDict}) {
      var _pd = splitProvEvents(parseJsonlText(__d));
      adoptProvEvents(_pd.items, _pd.events);
      var sp = splitDictFile(_pd.items);
      S.dictionary = sp.entries; S.lemmas = sp.lemmas;
    }
    if (${withParticipants}) {
      var rows = parseJsonlText(__p) || [];
      S.annotators = rows.filter(r => r.record_type === 'annotator');
      S.sources    = rows.filter(r => r.record_type === 'source');
    }
    _rebuildParticipantMaps();
    buildCorpusIndex(); buildDictIndex();
  `, ctx);
  return { ctx, run: e => vm.runInContext(e, ctx) };
}

console.log('\na journal says which base it belongs to\n');
{
  const { run } = boot();
  run(`_lastWrite.corpus.fp = _fingerprint(__c); _lastWrite.dict.fp = _fingerprint(__d);
       globalThis.__head = journalHead();`);
  check(run('__head.record_type') === 'journal_head', 'the header is a declared record kind');
  check(!!run('__head.corpus') && !!run('__head.dict'),
        'and fingerprints both files it was opened beside');

  run(`globalThis.__jrnl = JSON.stringify(__head) + '\\n'
        + JSON.stringify({ op: 'put', t: 'corpus', id: 'nope', rec: { id: 'nope' } }) + '\\n';`);
  check(run(`journalBaseMismatch(__jrnl, __c, __d)`) === null,
        'against the files it names, there is no mismatch');

  const bad = run(`journalBaseMismatch(__jrnl, __c + ' ', __d)`);
  check(bad && bad.files.includes('corpus'),
        'a corpus that has changed under it IS a mismatch',
        'replaying onto the wrong base applies edits to the wrong records, silently');

  check(run(`journalBaseMismatch(JSON.stringify({op:'put',t:'corpus',id:'x'}) + '\\n', __c, __d)`) === null,
        'a journal with no header is not treated as a mismatch',
        'one written before this version still holds a real session; refusing it would lose that session');

  run(`globalThis.__rep = replayJournal(__jrnl)`);
  check(run('__rep.unresolved') === 1 && run('__rep.applied') === 0,
        'and the header is not mistaken for an edit',
        `applied ${run('__rep.applied')}, unresolved ${run('__rep.unresolved')} — `
        + 'the one unresolved is the deliberately bogus put, not the header');
}

console.log('\na missing companion is counted, not just noticed\n');
{
  const all = boot(true, true);
  const d0 = all.run('danglingCompanions()');
  check(d0.dictIds === 0 && d0.lemmaIds === 0 && d0.stamps === 0,
        'with every file present, nothing dangles',
        `saw ${JSON.stringify(d0)}`);

  const noDict = boot(true, false);
  const d1 = noDict.run('danglingCompanions()');
  check(d1.dictIds > 0,
        `without the dictionary, ${d1.dictIds} link(s) to ${d1.entries} entr(y/ies) resolve to nothing`,
        'a corpus shared without its lexicon degrades quietly; this is what makes it say so');

  const noParts = boot(false, true);
  const d2 = noParts.run('danglingCompanions()');
  check(d2.stamps > 0,
        `without participants, ${d2.stamps} provenance stamp(s) from ${d2.annotators} annotator(s) show as ids`,
        'conflict ④: interning moved names behind annotator_id, and nothing counted the cost');
  check(d2.dictIds === 0,
        'and that is counted separately from the lexicon, since they are different losses');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
