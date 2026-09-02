#!/usr/bin/env node
/* =============================================================================
   prov_intern_test.js, a moment is stored once
   Run:  node dev/tests/prov_intern_test.js
   =============================================================================
   Interning, stage B. `field_prov` holds an index into a per-file table of
   moments rather than a copy of one, because 549 stamps in the live corpus share
   60 distinct (who, when) moments — one word save stamps gloss, POS, parse and
   lemma at the same instant — and the annotator's display name was repeated on
   every stamp although `annotator_id` derives it.

   This is a FORMAT change, so reading the source proves nothing worth having.
   The guard boots the whole app, loads the real corpus through the real loaders,
   serialises it, loads that back, and asks two questions:

     1. is the round trip stable — does writing what you read produce what you
        read, so autosave's fingerprint brake still compares like with like;
     2. does every stamp still resolve to the same person, moment and derived
        flag, which is the only definition of "no fact lost" that matters.

   The second is the one that would catch a renumbering bug. A table written in a
   different order than it is read is byte-unstable AND silently reattributes
   work, which is the most expensive failure this format has (B-054's family).
   ============================================================================= */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, requireCompanion, loadCorpus, loadCompanion } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const corpusPath = requireCorpus('turkish', 'provenance interning');
const dictPath   = requireCompanion(corpusPath, 'dictionary');
/* B-128: the shared parse. Rows go into the app's loaders as written, event
   table included — this guard is about what interning does to them. */
const jsonl = f => (/_corpus\.jsonl$/.test(f) ? loadCorpus(f) : loadCompanion(f)).records;

function boot(corpusRows, dictRows) {
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  if (errs.length) throw errs[0][1];
  ctx.__c = corpusRows; ctx.__d = dictRows;
  vm.runInContext("applyCorpus(__c, 'rt'); applyDict(__d, 'rt');", ctx);
  return ctx;
}
const run = (ctx, expr) => vm.runInContext(expr, ctx);

/* Every field's provenance as the app would SHOW it, which is the only view
   that has to survive. Sorted, so table order cannot flatter the comparison. */
const RESOLVE = `(function(){const out=[];const walk=o=>{
  if(Array.isArray(o)){o.forEach(walk);return;}
  if(!o||typeof o!=='object')return;
  for(const k of Object.keys(o.field_prov||{})){const r=fieldProv(o,k);
    out.push([o.id||'',k,provDisplayName(r),r&&r.date,r&&r.time,!!(r&&r.derived)].join('|'));}
  for(const k in o){if(k==='prov'||k==='prov_history'||k==='field_prov')continue;
    const v=o[k]; if(v&&typeof v==='object')walk(v);}};
  walk(S.docs); walk(S.dictionary); walk(S.lemmas); return out.sort();})()`;

const A = boot(jsonl(corpusPath), jsonl(dictPath));
const cOut = run(A, 'serializeRecords(S.docs, true)');
const dOut = run(A, 'serializeRecords(dictFileItems(), true)');
const before = run(A, RESOLVE);
/* B-201: the same count, over `S.docs` ALONE — the tree the damaged-load check
   below walks. `before` spans the dictionary and the lemma registry too, and a
   guard that compares one population against another is measuring the fixture's
   shape rather than the app's behaviour. */
const DOC_STAMPS = `(function(){let n=0;const walk=o=>{
  if(Array.isArray(o)){o.forEach(walk);return;}
  if(!o||typeof o!=='object')return;
  n += Object.keys(o.field_prov||{}).length;
  for(const k in o){if(k==='field_prov')continue;const v=o[k];
    if(v&&typeof v==='object')walk(v);}};walk(S.docs);return n;})()`;
const docStampsBefore = run(A, DOC_STAMPS);

check(before.length > 100, `the fixture carries ${before.length} field stamps to preserve`,
      'too few for this guard to prove anything');
check(run(A, 'S.provEvents.length') > 0, `they intern to ${run(A, 'S.provEvents.length')} distinct moments`);
check(run(A, 'S.provEvents.length') < before.length,
      'which is fewer than the stamps, or the interning bought nothing',
      `${run(A, 'S.provEvents.length')} events for ${before.length} stamps`);

/* The saving is the reason this exists, so it is asserted rather than admired —
   but only against a fixture that has not already been interned.

   v3.14.242: the live corpus was saved by a current build, so its stamps are
   ALREADY integers and re-writing it saves 0.7%. The guard failed, which was
   backwards: it was failing because the feature had worked. What can be asserted
   on an interned fixture is that the round trip below is exact; the SIZE claim
   only means something when there is something to shrink, so it is asserted when
   the input carries inline stamps and reported otherwise. */
const cWas = fs.statSync(corpusPath).size, dWas = fs.statSync(dictPath).size;
const wasInterned = /"record_type":"prov_events"/.test(fs.readFileSync(corpusPath, 'utf8'));
if (wasInterned) {
  console.log(`  note this fixture is already interned, so there is no saving left to`);
  console.log(`       measure — the round trip below is what it proves. Corpus rewrites`);
  console.log(`       to ${(100 * Buffer.byteLength(cOut) / cWas).toFixed(1)}% of its stored size, which should be ~100%.`);
  check(Buffer.byteLength(cOut) < cWas * 1.02,
        'an already-interned corpus does not GROW when written back',
        'interning a second time must be a no-op, not an accumulation');
} else {
  /* Measured at v3.14.226: corpus 67.9% of its old size, dictionary 82.7%. */
  check(Buffer.byteLength(cOut) < cWas * 0.80,
        `the corpus shrinks to ${(100 * Buffer.byteLength(cOut) / cWas).toFixed(1)}% of its stored size`,
        'the interning is meant to be worth roughly a third of the file');
  check(Buffer.byteLength(dOut) < dWas * 0.95,
        `and the dictionary to ${(100 * Buffer.byteLength(dOut) / dWas).toFixed(1)}%`,
        'the dictionary saves only the display name — no entry has per-field provenance (B-121)');
}

/* ── B-127: a stamp written NOW reaches the file ─────────────────────────────
   The gap this closes is where the bug lived. Every assertion in this guard
   asked what `stampFieldProv` put in the object, and the answer was always
   right; nothing asked what came out of `serializeRecords`, and for seventeen
   versions the answer there was nothing at all. A stamp written during a session
   was an object, `local` was built only from numbers, and the replacer writes a
   key only when it finds one — so it was dropped, silently, on every save.

   So these assert on the SERIALIZED TEXT, and on both writers: the one that goes
   through stampFieldProv and one that leaves an object behind, which is what
   every writer did until this version. */
{
  const C = boot(jsonl(corpusPath), jsonl(dictPath));
  run(C, `S.provEvents = []; _provEventKey = new Map();
          _activeAnnotatorId = 'ann_zz'; _activeAnnotatorName = 'Probe';
          var _w = { id: 'probe_w', form: 'x', field_prov: {} };
          stampFieldProv(_w, { gloss: { orig: '', cur: 'NEWLY-TYPED' } });
          var _d = { id: 'probe_d', metadata: {},
                     sections: [{ id: 's', paragraphs: [{ id: 'p',
                       sentences: [{ id: 'sn', words: [_w] }] }] }] };
          globalThis.__txt = serializeRecords([_d], true);`);
  const txt = run(C, '__txt');
  const fp = /"field_prov":\{[^}]*\}/.exec(txt.split('\n').pop());
  check(!!fp && fp[0] !== '"field_prov":{}',
        'a stamp written this session reaches the file',
        `serialized as ${fp ? fp[0] : '(absent)'} — B-127: dropped for 17 versions because\n`
        + '         the value was an object and the table was built only from numbers');
  check(/"record_type":"prov_events"/.test(txt.split('\n')[0]),
        'and the event table it points into is written beside it');

  run(C, `var _w2 = { id: 'probe_w2', form: 'y',
                      field_prov: { gloss: { annotator_id: 'ann_zz', date: '2026-08-30', time: '03:00:00' } } };
          var _d2 = { id: 'probe_d2', metadata: {},
                      sections: [{ id: 's', paragraphs: [{ id: 'p',
                        sentences: [{ id: 'sn', words: [_w2] }] }] }] };
          globalThis.__txt2 = serializeRecords([_d2], true);
          globalThis.__norm = typeof _w2.field_prov.gloss;`);
  const fp2 = /"field_prov":\{[^}]*\}/.exec(run(C, '__txt2').split('\n').pop());
  check(!!fp2 && fp2[0] !== '"field_prov":{}',
        'a stamp left as an OBJECT by any other writer is interned, not dropped',
        'adoptProvEvents has tolerated both shapes since interning shipped; this is the writer half');
  check(run(C, '__norm') === 'number',
        'and normalised in place, so a second save has nothing left to convert');
}

/* ── B-129: a name the participants file can derive is not written ──────────
   thinProv ran only at LOAD, so an object the session created or touched kept
   the annotator's display name until the file had been read back once. Measured
   on the live corpus after a real session: 19 occurrences in the corpus, 22 in
   the dictionary. Two costs — it partly undoes what interning bought, and it
   makes the corpus not PI-free, which is the property the file-layout decision
   was partly argued from. */
{
  const D = boot(jsonl(corpusPath), jsonl(dictPath));
  run(D, `S.provEvents = []; _provEventKey = new Map();
          var _w = { id: 'pw', form: 'x', field_prov: {},
            prov: { annotator_id: 'ann_zz', annotator: 'A Person', date: '2026-08-30', time: '03:00:00' },
            prov_history: [{ annotator_id: 'ann_zz', annotator: 'A Person', date: '2026-08-30', time: '03:00:00' }] };
          var _a = { id: 'pa', form: 'y',
            prov: { annotator_id: null, annotator: 'auto (lexicon)', date: '2026-08-30', time: '03:00:00' } };
          var _d = { id: 'pd', metadata: {}, sections: [{ id: 's',
                      paragraphs: [{ id: 'p', sentences: [{ id: 'sn', words: [_w, _a] }] }] }] };
          globalThis.__t3 = serializeRecords([_d], true);`);
  const t3 = run(D, '__t3');
  check(!/A Person/.test(t3),
        'a display name the participants file can derive is not written to the corpus',
        'it was written until v3.14.244, because thinProv ran only at load');
  check(/auto \(lexicon\)/.test(t3),
        'and an automatic stamp keeps its name, which IS its identity',
        'nothing derives "auto (lexicon)" from an id, so dropping it would lose the fact');

  /* metadata_prov is prov-shaped and its key is not `prov`, so it survived the
     first version of this fix and left exactly one name in the file — found by
     counting what was left rather than by assuming none was. Asserted from the
     field table, so a prov-shaped field declared later is covered here without
     anyone remembering to come back. */
  run(D, `var _md = { id: 'pm', metadata: { title: 'T',
            metadata_prov: { annotator_id: 'ann_zz', annotator: 'A Person',
                             date: '2026-08-30', time: '03:00:00' } }, sections: [] };
          globalThis.__t4 = serializeRecords([_md], true);`);
  check(!/A Person/.test(run(D, '__t4')),
        'and every prov-shaped field is thinned, not only the one called prov',
        'metadata_prov is the second; the table declares which fields are prov-shaped');
}
{
  /* v3.14.247: this used to grep serializeRecords for the literal `o.<key>`,
     which stopped meaning anything the moment stage 4b replaced the named reads
     with a loop over PROV_STAMP_KEYS. The assertion is now against the constant
     itself, which is what all three layers share — load, save and journal — so
     a prov-shaped field added to the table and not to the list fails here
     rather than reaching a file, and renaming the loop variable cannot break it.

     L-006's list again: a guard keyed to a spelling rather than to the thing it
     means. Four this session. */
  const declared = require('../../source/modules/field_spec.js')
    .fieldsOf('document').map(f => f.key).filter(k => /_prov$|^prov$/.test(k));
  const m = /const PROV_STAMP_KEYS = \[([^\]]*)\]/.exec(require('./_source.js').read('LingCoT.html'));
  const listed = new Set((m ? m[1] : '').split(',')
    .map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean));
  check(listed.size > 0, `PROV_STAMP_KEYS is declared and parseable (${[...listed].join(', ')})`,
        'the three layers agree by sharing this constant; if it cannot be read, nothing checks that');
  /* field_prov is a MAP of stamps and prov_history an ARRAY of them. Both have
     their own branch in all three layers, so neither belongs in this list. */
  const missed = declared.filter(k => k !== 'field_prov' && k !== 'prov_history' && !listed.has(k));
  check(missed.length === 0,
        `all ${declared.length} prov-shaped field(s) the table declares are in PROV_STAMP_KEYS`,
        `missing: ${missed.join(', ')} — it would keep its display name and stay uninterned`);
}

/* ── D50 stage 4b: prov and prov_history reach the file as ids ──────────────
   These assert on the SERIALIZED TEXT, which is B-127's whole lesson. The
   stage-4a guards asserted that the resolvers read both shapes; nothing there
   would notice if the serializer kept writing objects and the stage did nothing
   at all.

   Read the fixture, write it back, and look at what came out. */
{
  const E = boot(jsonl(corpusPath), jsonl(dictPath));
  const out = run(E, 'serializeRecords(S.docs, true)');
  const rows = out.split('\n').filter(Boolean).map(JSON.parse);
  const table = rows.find(r => r.record_type === 'prov_events');
  const body  = rows.filter(r => r.record_type !== 'prov_events');

  let asObject = 0, asId = 0, histObject = 0, histId = 0, outOfRange = 0;
  const size = table ? table.events.length : 0;
  const walk = o => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== 'object') return;
    for (const k of ['prov', 'metadata_prov']) {
      const v = o[k];
      if (v == null) continue;
      if (typeof v === 'number') { asId++; if (!(v >= 0 && v < size)) outOfRange++; }
      else asObject++;
    }
    for (const h of o.prov_history || []) {
      if (typeof h === 'number') { histId++; if (!(h >= 0 && h < size)) outOfRange++; }
      else histObject++;
    }
    for (const k in o) {
      if (['prov', 'metadata_prov', 'prov_history', 'field_prov'].includes(k)) continue;
      const v = o[k];
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(body);

  /* Both counts in the label, not just the good one. The first draft of this
     printed a literal "0 left inline" beside a live count of ids, so a failing
     run read "0 of them, 0 left inline" and looked like an empty corpus rather
     than like 55 uninterned stamps. A guard whose message misreports the state
     is how B-127 got explained away for seventeen versions. */
  check(asId > 0 && asObject === 0,
        `every single stamp is written as an id (${asId} ids, ${asObject} left inline)`,
        `${asObject} were still objects — stage 4b's serializer branch is not reached`);
  check(histId > 0 && histObject === 0,
        `every prov_history entry is written as an id (${histId} ids, ${histObject} left inline)`,
        `${histObject} were still objects`);
  check(outOfRange === 0,
        `and all ${asId + histId} ids point inside this file's own table of ${size}`,
        'an id past the end of the table is a file that cannot be read back');

  /* ── B-146, v3.14.284: the app must be able to OPEN what it writes ────────
     Interning put `{record_type:"prov_events"}` on line 1 of every file the app
     saves. `detectFileType` inspected `objs[0]` only, so it found no `sections`
     and no `form`, returned `unknown`, and both open paths refused the file —
     **a corpus the app saved could not be reopened by the app**, for 58
     versions. Not a provenance bug, but interning is what caused it, and this
     is the guard that already has a serialized corpus in hand.

     The round trip is the assertion: serialize, then ask the detector, in that
     order and on the same bytes. Reading the detector's source would not have
     caught it, because the detector was correct about every file that existed
     when it was written. */
  {
    const vm2 = require('vm');
    const { read: _read, fnSrc: _fnSrc, moduleFiles } = require('./_source.js');
    const dctx = {};
    vm2.createContext(dctx);
    const _fmt  = /const _FORMAT_ROWS = \[[^\]]*\];/.exec(_read('LingCoT.html'));
    const _kind = /const _KIND_ROWS = \{[\s\S]*?\n\};/.exec(_read('LingCoT.html'));
    check(!!_fmt, 'the format-row list is declared once',
          '         a hand-written list per reader is how line 1 came to be missed');
    check(!!_kind, 'and so is the list of declarations each kind is recognised by');
    if (_fmt)  vm2.runInContext(_fmt[0], dctx);
    if (_kind) vm2.runInContext(_kind[0], dctx);

    /* B-153, and rule 5: a declaration is only as good as what it admits exists.
       The first draft of `detectFileType` matched `'entry'`, which no writer
       emits — the value is `'dict_entry'` — and the branch was dead for two
       versions because the `lemma` row and the shape fallback answered anyway.
       So the list is held against the WRITERS rather than read: every value
       `_KIND_ROWS` names must be one some `record_type:` literal produces. */
    {
      const written = new Set();
      for (const [, src] of [['LingCoT.html', _read('LingCoT.html')], ...moduleFiles()])
        for (const m of src.matchAll(/record_type:\s*'([\w.]+)'/g)) written.add(m[1]);
      check(written.size > 3, `the writers declare ${written.size} record_type value(s)`,
            '         if this collapses the sweep below is checking nothing');
      /* Read out of the vm, not off the sandbox: a `const` run through
         runInContext lives in the context's lexical scope and never becomes a
         property of the object. The first draft read `dctx._KIND_ROWS`, got
         undefined, and reported "0 declarations" — a guard checking nothing. */
      const named = vm2.runInContext('Object.values(_KIND_ROWS).flat()', dctx);
      const fmt   = vm2.runInContext('_FORMAT_ROWS', dctx);
      check(named.length > 0, `_KIND_ROWS names ${named.length} declaration(s)`);
      const unwritten = named.filter(v => !written.has(v));
      check(unwritten.length === 0,
            'every declaration the detector matches on is one a writer emits',
            `         dead branch(es): ${unwritten.join(', ')} — nothing in the app writes this`);
      /* And the other direction, for the kinds that HAVE a file of their own:
         a stored row whose type no kind claims makes that file undetectable. */
      const unclaimed = [...written].filter(v =>
        !named.includes(v) && !fmt.includes(v));
      check(unclaimed.length === 0,
            'and every stored record_type belongs to some kind',
            `         unclaimed: ${unclaimed.join(', ')} — a file of these alone detects as unknown`);
    }
    vm2.runInContext(_fnSrc('LingCoT.html', 'detectFileType'), dctx, { filename: 'detectFileType.js' });
    dctx.__rows = rows;
    check(vm2.runInContext('detectFileType(__rows)', dctx) === 'corpus',
          'a corpus this app just serialized is detected as a corpus',
          '         B-146: the event table is line 1, and the detector read line 1 only');
    dctx.__body = body;
    check(vm2.runInContext('detectFileType(__body)', dctx) === 'corpus',
          'and so is the same corpus with no format line at all — order-independent, like the reader');
    dctx.__fmtOnly = [rows.find(r => r.record_type === 'prov_events')].filter(Boolean);
    check(vm2.runInContext('detectFileType(__fmtOnly)', dctx) === 'unknown',
          'a file that is nothing but a format line is still unknown',
          '         "skip the format rows" must not become "call anything a corpus"');
  }

  /* ── B-134, v3.14.276: the trail and the latest stamp must agree ──────────
     `prov` is the latest moment and `prov_history` is the log that ends in it,
     so an object carrying both must have `prov_history[last] === prov`. That is
     the property the morpheme writer broke: it refreshed `prov` on every word
     save and never touched the history, and for seventeen months nothing asked
     whether the two still described the same edit.

     Objects with a `prov` and NO history are exempt and COUNTED, not failed.
     They are the pre-fix corpora, and the decision at v3.14.276 was to seed the
     trail on the next write rather than migrate files nobody asked to change —
     so this number falls as annotation continues, and a guard that went red on
     it would be red on every existing corpus and switched off by the first
     person in a hurry (UNIFIED §5.3, the guard that goes red on success). */
  let agree = 0, disagree = 0, noHistory = 0;
  const firstBad = [];
  const trail = o => {
    if (Array.isArray(o)) { o.forEach(trail); return; }
    if (!o || typeof o !== 'object') return;
    const h = o.prov_history;
    if (Array.isArray(h) && h.length) {
      if (h[h.length - 1] === o.prov) agree++;
      else { disagree++; if (firstBad.length < 3) firstBad.push(`${o.id || '(no id)'}: prov ${JSON.stringify(o.prov)} vs last ${JSON.stringify(h[h.length - 1])}`); }
    } else if (o.prov != null) noHistory++;
    for (const k in o) {
      if (['prov', 'metadata_prov', 'prov_history', 'field_prov'].includes(k)) continue;
      const v = o[k];
      if (v && typeof v === 'object') trail(v);
    }
  };
  trail(body);
  check(agree > 0 && disagree === 0,
        `every object with a trail ends it in its own prov (${agree} checked)`,
        firstBad.join('\n         ') || 'a prov refreshed without appending is B-134');
  console.log(`  note ${noHistory} object(s) carry a prov and no trail yet — pre-B-134 data,`);
  console.log(`       seeded on next write, not migrated. This falls as annotation continues.`);

  /* The size claim. The obvious version — compare the output against the file on
     disk — is the fault B-128 named and I wrote again anyway: run it against a
     corpus that is ALREADY interned and it reports 0.0% and fails, because the
     feature had worked. A guard whose assertion inverts once its subject
     succeeds gets switched off by whoever meets it in a hurry.

     So the baseline is built rather than read: expand the loaded tree back to
     inline moments and serialize THAT, which is what the same corpus would
     weigh with no interning at all. True whatever state the fixture is in.

     No threshold on the percentage: the ratio depends on annotation density,
     which is a property of the data, not of the code. */
  const plain = run(E, 'serializeRecords(S.docs.map(expandProv), false)').length;
  check(out.length < plain,
        `interning shrank the corpus: ${plain} bytes inline, ${out.length} interned `
        + `(${((out.length - plain) / plain * 100).toFixed(1)}%)`,
        'the interned form must be smaller than the same tree with moments inline');
}

/* Every moment must survive the move, not just its count. An id that resolves to
   the WRONG moment is the failure this cannot be allowed to have, and it looks
   identical to success from a byte count. */
{
  const F = boot(jsonl(corpusPath), jsonl(dictPath));
  const key = r => [r.annotator_id || '', r.annotator || '', r.date || '', r.time || '',
                    r.derived ? 1 : ''].join('');
  const collect = ctx => run(ctx, `(function(){
      const out = [];
      const walk = o => {
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (!o || typeof o !== 'object') return;
        for (const k of ['prov', 'metadata_prov']) { const r = k === 'prov' ? objProv(o)
          : (typeof o[k] === 'number' ? provById(o[k]) : o[k]); if (r) out.push([o.id || '?', k, r]); }
        provHistory(o).forEach((r, i) => out.push([o.id || '?', 'h' + i, r]));
        for (const k in o) { if (['prov','metadata_prov','prov_history','field_prov'].includes(k)) continue;
          const v = o[k]; if (v && typeof v === 'object') walk(v); }
      };
      walk(S.docs); return out;
    })()`);

  const before = collect(F).map(([id, k, r]) => `${id}${k}${key(r)}`);
  const text   = run(F, 'serializeRecords(S.docs, true)');
  const G = boot(text.split('\n').map(JSON.parse), jsonl(dictPath));
  const after  = collect(G).map(([id, k, r]) => `${id}${k}${key(r)}`);

  check(before.length > 0 && before.length === after.length,
        `all ${before.length} object-level stamps survive a write and a read`);
  const moved = before.filter((b, i) => b !== after[i]);
  check(moved.length === 0,
        'and every one still names the same person, moment and derived flag',
        moved.slice(0, 5).map(x => '         ' + x).join('\n')
        + '\n         An id resolving to the WRONG moment weighs the same as one resolving right.');
}

/* ── D50 stage 4c: every stored row declares its kind ───────────────────────
   Two of the five kinds carried no discriminator: a document, and a dictionary
   entry. Both were "whatever is left", so every reader told rows apart by what
   they LACK — and a negative test claims every row nobody has met yet, which is
   how one new format record broke four guards at once (B-128).

   Asserted on what a save WRITES, not on what is on disk: `samples/` predates
   the declaration and must keep loading, which is the whole point of the
   migration being tolerant. */
{
  const H = boot(jsonl(corpusPath), jsonl(dictPath));
  for (const [what, expr, kinds] of [
    ['corpus',     'serializeRecords(S.docs, true)',          ['document']],
    ['dictionary', 'serializeRecords(dictFileItems(), true)', ['dict_entry', 'lemma']],
  ]) {
    const rows = run(H, expr).split('\n').filter(Boolean).map(JSON.parse);
    const bare = rows.filter(r => !r.record_type);
    check(bare.length === 0,
          `every ${what} row a save writes declares record_type`,
          `         ${bare.length} row(s) wrote none: `
          + bare.slice(0, 3).map(r => r.id || JSON.stringify(r).slice(0, 60)).join(', '));
    const seen = new Set(rows.map(r => r.record_type));
    const missing = kinds.filter(k => !seen.has(k));
    check(missing.length === 0,
          `and the ${what} actually contains ${kinds.join(' and ')}, so that is not vacuous`,
          `         never saw: ${missing.join(', ')}`);
    const undeclared = [...seen].filter(k => ![...kinds, 'prov_events'].includes(k));
    check(undeclared.length === 0,
          `and nothing else`, `         unexpected kind(s): ${undeclared.join(', ')}`);
  }
}

/* D58 §3, v3.14.386: the runtime `record_type` strip is gone.

   It removed the discriminator from every row and asserted the load-time
   migration put it back — a specimen built in CODE because there was nowhere to
   put one, which D58 §0 named as the reason to have a `dev/tests/fixtures/` at
   all. The migration it exercised (`_migrateDeclareRecordType`) went with the
   rest of §3's list: an undeclared document has had no writer since v3.14.248,
   and the last file carrying one was retired at v3.14.384.

   What replaced it is not another strip but a real file — `cli_ingested/`, the
   shipped CLI's own output, which declares `record_type` and is the reason
   deleting the sniffing fallbacks was safe. It is loaded below. */

/* ── The round trip ────────────────────────────────────────────────────────*/
const B = boot(cOut.split('\n').map(JSON.parse), dOut.split('\n').map(JSON.parse));
check(run(B, 'serializeRecords(S.docs, true)') === cOut,
      'writing the corpus back produces exactly what was read',
      'unstable output defeats the autosave fingerprint and rewrites the file forever');
check(run(B, 'serializeRecords(dictFileItems(), true)') === dOut,
      'and the same for the dictionary');

const after = run(B, RESOLVE);
check(after.length === before.length,
      `every stamp survives the trip (${before.length})`, `${after.length} after`);
const same = JSON.stringify(before) === JSON.stringify(after);
check(same, 'and every one resolves to the same person, moment and derived flag',
      !same ? (before.find((x, i) => x !== after[i]) || '') + '  vs  ' +
              (after.find((x, i) => x !== before[i]) || '') : '');

/* ── The two shapes, and the one that must not be stored ──────────────────*/
check(run(B, `(function(){let bad=0;const walk=o=>{
    if(Array.isArray(o)){o.forEach(walk);return;}
    if(!o||typeof o!=='object')return;
    for(const v of Object.values(o.field_prov||{})) if(typeof v!=='number') bad++;
    for(const k in o){if(k==='field_prov')continue;const x=o[k];
      if(x&&typeof x==='object')walk(x);}};walk(S.docs);return bad;})()`) === 0,
      'after a load, every field_prov value is an id, not an inline record',
      'a mixed shape means the migration missed a path');

/* A name that can be derived is not stored. An automatic stamp has no id, so its
   name IS its identity and must survive — that asymmetry is the whole design. */
const names = run(B, `(function(){const out={withId:0,withIdAndName:0,noId:0,noIdNoName:0};
  for(const e of S.provEvents){ if(e.annotator_id){out.withId++; if(e.annotator)out.withIdAndName++;}
    else {out.noId++; if(!e.annotator)out.noIdNoName++;} } return out;})()`);
check(names.withIdAndName === 0,
      `no event stores a name it could derive (${names.withId} have an id)`,
      `${names.withIdAndName} carry both, which is the duplication this removes`);
check(names.noIdNoName === 0,
      `every automatic event keeps its name (${names.noId} have no id)`,
      'an automatic stamp with neither id nor name is unattributable');

/* ── What a damaged or partial file does ────────────────────────────────────
   Found by asking what happens when someone shares these files incorrectly,
   which is the normal way this format will travel. The first version of stage B
   failed this badly: the event table was the LAST line, so a truncated file
   resolved every stamp to nothing, opened cleanly, rendered every view, said
   nothing — and autosave would then have written the loss back over the
   original. Both halves of the fix are asserted here. */
{
  const full = cOut.split('\n');
  check(JSON.parse(full[0]).record_type === 'prov_events',
        'the event table is the FIRST line of the file',
        'last means a truncation costs all provenance invisibly; first means it costs visible data');

  // A file whose table has been lost must SAY so, and must not tidy the ids away.
  const c3 = makeCtx({ hasId: () => true });
  loadApp(c3, appSources());
  let warned = 0;
  c3.alert = () => { warned++; };
  c3.__c = full.slice(1).map(JSON.parse);
  vm.runInContext("applyCorpus(__c, 'damaged');", c3);
  check(warned === 1, 'losing the table warns the annotator, once',
        'silent is the failure mode: it opens, renders, and autosave makes it permanent');

  const kept = vm.runInContext(`(function(){let n=0;const walk=o=>{
      if(Array.isArray(o)){o.forEach(walk);return;}
      if(!o||typeof o!=='object')return;
      n += Object.keys(o.field_prov||{}).length;
      for(const k in o){if(k==='field_prov')continue;const v=o[k];
        if(v&&typeof v==='object')walk(v);}};walk(S.docs);return n;})()`, c3);
  /* B-201. Compared against `before.length` until v3.14.381, and those are two
     different populations: `RESOLVE` walks `S.docs`, `S.dictionary` AND
     `S.lemmas`, while this walk is `S.docs` alone. The two agree only while the
     dictionary carries no field stamp — true of `samples/`, and false the first
     time an annotator edited one field of one entry. It then reported 646
     against 648 and blamed the corpus for the two stamps living in the
     dictionary.

     Counted over the same tree it is asserting about. The claim is *this walk
     kept what this walk started with*, so the baseline is taken from the same
     walk before the damage rather than from a wider one. */
  check(kept === docStampsBefore,
        `and keeps all ${kept} references rather than deleting them`,
        `         started with ${docStampsBefore} in the corpus tree\n`
      + '         deleting an unresolvable id destroys the only evidence the file was damaged');
}

/* ── D50 stage 4a: the reader chokepoint is actually a chokepoint ────────────
   `objProv` and `provHistory` are only worth having if nothing reads around
   them. This is the assertion B-127 says was missing when field_prov moved: the
   readers were changed, and nothing checked that every reader had been found.

   A source scan, because the failure it prevents is a call site nobody
   converted — which by definition no behaviour test reaches, since it is the
   one nobody thought about.

   WHAT IT FORBIDS is reading a field OFF a stamp (`x.prov.annotator`) or
   walking a history array. Those are the two things an integer breaks.

   WHAT IT ALLOWS is carrying the stored value forward unexamined
   (`prov: existing?.prov || null`), which appears in five object literals that
   rebuild a record. An id copies exactly as well as an object does, so those
   are shape-agnostic and converting them would be noise.

   The allow-list is the writers, the resolvers, and the format layer. */
{
  const { moduleFiles, read, decomment, fnSrc } = require('./_source.js');
  const ALLOWED = [
    ['LingCoT.html', 'applyProvToObj'], ['LingCoT.html', 'initProv'],
    ['LingCoT.html', 'appendProv'], ['LingCoT.html', 'carryProv'],   // B-134
    ['LingCoT.html', 'mergeProvTrails'],                   // D52: two trails become one
    ['LingCoT.html', 'ensureMorphemesFromParse'],          // writes m.prov + history
    ['LingCoT.html', 'objProv'], ['LingCoT.html', 'provHistory'],
    ['LingCoT.html', 'thinProv'], ['LingCoT.html', 'adoptProvEvents'],
    ['LingCoT.html', 'serializeRecords'], ['LingCoT.html', 'expandProv'],
  ];

  // moduleFiles() already returns [name, source] pairs.
  const sources = [['LingCoT.html', read('LingCoT.html')]].concat(moduleFiles());

  /* Blank the allowed functions rather than tracking which function a line is
     in: the enclosing-function question is exactly the kind of parse that gets
     a guard quietly wrong, and blanking is exact. Line numbers survive because
     each removed line becomes an empty one. */
  const blanked = new Map();
  for (const [file, raw] of sources) {
    let src = decomment(raw);
    for (const [f, fn] of ALLOWED) {
      if (f !== file) continue;
      let body; try { body = decomment(fnSrc(f === 'LingCoT.html' ? f : `modules/${f}`, fn)); }
      catch (_) { continue; }
      const at = src.indexOf(body);
      if (at < 0) continue;
      src = src.slice(0, at) + body.replace(/[^\n]/g, ' ') + src.slice(at + body.length);
    }
    blanked.set(file, src);
  }

  const offenders = [];
  for (const [file, src] of blanked) {
    src.split('\n').forEach((L, i) => {
      if (/\.prov\.\w|\.prov_history\b/.test(L))
        offenders.push(`         ${file}:${i + 1}  ${L.trim().slice(0, 88)}`);
    });
  }
  check(offenders.length === 0,
        'nothing outside the writers and resolvers reads a field off .prov or walks .prov_history',
        offenders.join('\n')
        + '\n         Use objProv(o) / provHistory(o), or add the function to ALLOWED if it writes.');
}

/* ── B-116: the string ceiling is measured before it is hit ─────────────────
   The whole corpus is read into one string on load and rebuilt as one on
   compaction. V8 stops at 536,870,888 characters. Nothing measured that, so the
   failure arrived late, unexplained, and worse on the save path than the load
   path, because on the save path the annotation is already done and only in
   memory.

   Three checks. The threshold is one constant on each side and they must agree;
   the save path must CATCH rather than let a throw escape with a session's work
   in it; and the load path must report before it parses, not after. */
{
  const { read, decomment, fnSrc } = require('./_source.js');
  const html = decomment(read('LingCoT.html'));
  const ev   = decomment(read('modules/events.js'));
  const pyw  = read('LingCoT.pyw');

  const jsMax = /_JS_STRING_MAX\s*=\s*(\d+)/.exec(html);
  const pyMax = /JS_STRING_MAX\s*=\s*([\d_]+)/.exec(pyw);
  check(!!jsMax && !!pyMax, 'both sides declare the string limit');
  check(jsMax && pyMax && Number(jsMax[1]) === Number(pyMax[1].replace(/_/g, '')),
        `and they agree (${jsMax && jsMax[1]})`,
        '         two limits that disagree means one side warns and the other does not');
  check(/JS_STRING_WARN\s*=\s*int\(JS_STRING_MAX \* 0\.8\)/.test(pyw)
        && /_JS_STRING_WARN\s*=\s*Math\.floor\(_JS_STRING_MAX \* 0\.8\)/.test(html),
        'and both warn at the same fraction of it',
        '         the warning is only useful before the wall; at the wall nothing can be done');

  /* The save path. `serializeRecords` is the call that throws, and the whole
     point is that it is not allowed to throw past `compact`. */
  const consider = /const consider = \(target[\s\S]*?\n  \};/.exec(ev);
  check(!!consider, 'found the write path');
  check(consider && /try \{[\s\S]*serializeRecords\([\s\S]*?\} catch/.test(consider[0]),
        'the write path catches a failed serialization instead of throwing out of compact()',
        '         an escaped throw takes the session with it: the edits are in memory, not the file');
  check(consider && /alert\(t\('alert\.save\.too_large'/.test(consider[0]),
        'and tells the annotator, naming the journal as what still holds their work',
        '         a silent failure here is the exact shape B-116 was filed as');
  check(consider && /_JS_STRING_WARN/.test(consider[0]),
        'and warns on approach, before the size becomes unrecoverable');

  /* The load path. Python measures the file before reading it, which is the one
     place a warning can precede the cost rather than follow the failure. */
  check(/oversize\.append/.test(pyw) && /'oversize':\s*oversize/.test(pyw),
        'the loader measures each project file and reports the oversize ones');
  const apply = fnSrc('LingCoT.html', 'applyProjectBundle');
  const iRep = apply.indexOf('reportOversizeOnLoad');
  const iParse = apply.indexOf('parseJsonlText');
  check(iRep > -1 && iParse > -1 && iRep < iParse,
        'and applyProjectBundle reports it BEFORE parsing, not after',
        '         reporting after the parse means reporting after the failure it predicts');

  // A warning that fires on every compaction is one the annotator learns to ignore.
  check(/_warnedStringSize/.test(html) && /_warnedStringSize\.has\(target\)/.test(html),
        'the approach warning fires once per store per session, not once per save');
}

/* ── B-137: one writer for a field_prov entry ───────────────────────────────
   There were ten, and one of them interned. The other nine assigned a raw
   moment in four spellings: direct assignment, build-then-replace, spread-and-
   replace, and one bespoke object literal. Three measured consequences:

     · the format says `field_prov` holds an INDEX and nine writers disagreed,
       harmless only because `serializeRecords` interns on sight — B-127's fix
       doing load-bearing work that nothing had written down;
     · build-then-replace dropped a stamp another writer had just made, which is
       what `ensureMorphemesFromParse` did to `linkTo` at v3.14.260;
     · the bespoke literal set no `derived` flag, so `provTipAttr` recovered it
       by matching /^auto/ on a display name and `_humanField` did not, and the
       two readers disagreed about the same stamp.

   The point of a chokepoint is that a future change to how a stamp is stored
   reaches every writer. This asserts there is only one to reach. */
{
  const { read, decomment, fnSrc, moduleFiles } = require('./_source.js');
  const sources = [['LingCoT.html', decomment(read('LingCoT.html'))]]
    .concat(moduleFiles().map(([f, src]) => [f, decomment(src)]));

  const ALLOWED = ['stampField'];
  const offenders = [];
  for (const [file, src] of sources) {
    let fn = '';
    src.split('\n').forEach((L, i) => {
      const d = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(L);
      if (d) fn = d[1];
      if (ALLOWED.includes(fn)) return;
      /* Assigning INTO a field_prov map, or replacing one wholesale. Reading is
         fine and `delete` is fine; `fieldProv()` and `stampFieldProv` are the
         readers and the semantic layer above the writer. */
      if (/\.field_prov\s*=\s*\{/.test(L) ||
          /\bfield_prov\[[^\]]+\]\s*=[^=]/.test(L) ||
          /\bfield_prov\.[A-Za-z_$][\w$]*\s*=[^=]/.test(L))
        offenders.push(`         ${file}:${i + 1}  in ${fn || '(top level)'}  ${L.trim().slice(0, 82)}`);
    });
  }
  check(offenders.length === 0,
        'nothing writes a field_prov entry except stampField()',
        offenders.join('\n')
        + '\n         Use stampField(obj, field, moment) — it interns, and a moment of null\n'
        + '         deletes the key. Replacing the whole map drops what another writer\n'
        + '         just put there, which is how B-121\'s stamp was lost the day it shipped.');

  const body = fnSrc('LingCoT.html', 'stampField');
  check(/internProv\(moment\)/.test(body),
        'and it interns, so the stored shape matches what the format declares');
  check(/if \(moment == null\)[\s\S]{0,80}delete/.test(body),
        'and a null moment deletes the key, which is what a cleared field means');
}

/* One moment shape, and one test for whether it was the app or a person. */
{
  const { read, decomment, fnSrc } = require('./_source.js');
  const src = decomment(read('LingCoT.html'));
  check(/function isDerived\(/.test(src), 'isDerived() is the one derived test');
  const readers = [...src.matchAll(/\.derived\s*===\s*true/g)].length;
  check(readers <= 1,
        `only isDerived() compares .derived directly (${readers} site${readers === 1 ? '' : 's'})`,
        '         two readers testing it separately is how they came to disagree');
  check(!/\/\^auto\//.test(src),
        'and nothing recovers derived-ness from a display name',
        '         a person may legitimately be called anything');
  const dfp = fnSrc('LingCoT.html', '_derivedFieldProv');
  check(/derived: true/.test(dfp) && /name = 'auto \(lexicon\)'/.test(dfp),
        'every derived moment comes from one factory, which takes the source name',
        '         machine translation used to mint its own shape with no flag at all');
}

/* ── B-138: list fields carry provenance per ELEMENT ────────────────────────
   A stamp on the ARRAY can only say "someone last touched this list", and the
   ordinary case is two translations added by different people years apart. The
   stamp goes on the element, under `prov` — the same key an object uses, so the
   whole stage-4 layer handles it already: `PROV_STAMP_KEYS` interns it,
   `adoptProvEvents` resolves it, `expandProv` inlines it for the journal. That
   was verified before the writer was built, not after.

   A list editor rebuilds its elements from the DOM on every save, so the risk is
   B-124's one level down: an unchanged element must keep its stamp, and only a
   new or edited one gets a fresh one. */
{
  const J = boot(jsonl(corpusPath), jsonl(dictPath));
  const r = run(J, `(function(){
    S.provEvents = []; _provEventKey = new Map();
    _activeAnnotatorId = 'ann_A'; _activeAnnotatorName = 'A';
    const sent = { id: 's1', translations: [] };
    assignList(sent, 'translations', [{ text: 'first', source_id: null, date: null }], prov());
    const first = sent.translations[0].prov;

    _activeAnnotatorId = 'ann_B'; _activeAnnotatorName = 'B';
    assignList(sent, 'translations',
      [{ text: 'first', source_id: null, date: null },
       { text: 'second', source_id: null, date: null }], prov());

    _activeAnnotatorId = 'ann_C'; _activeAnnotatorName = 'C';
    assignList(sent, 'translations',
      [{ text: 'second', source_id: null, date: null },
       { text: 'first, revised', source_id: null, date: null }], prov());

    const doc = { id:'d', record_type:'document', metadata:{},
                  sections:[{ id:'sc', paragraphs:[{ id:'p', sentences:[sent] }] }] };
    const txt = serializeRecords([doc], true);
    const rows = txt.split('\\n').map(JSON.parse);
    const els = rows[1].sections[0].paragraphs[0].sentences[0].translations;
    return {
      kept:      objProv(sent.translations[0]).annotator_id,   // 'second', added by B
      restamped: objProv(sent.translations[1]).annotator_id,   // text changed → C
      firstWasA: first != null,
      onDisk:    els.map(e => typeof e.prov),
      tableSize: rows[0].events.length,
    };
  })()`);

  check(r.kept === 'ann_B',
        'an element that survives a rebuild keeps the stamp it had',
        `         got ${r.kept} — the list editor rebuilds from the DOM every save, so this\n`
        + '         is B-124 one level down: reconcile by content, not by index');
  check(r.restamped === 'ann_C',
        'and one whose text changed is stamped by whoever changed it');
  check(r.kept === 'ann_B',
        'reordering costs nothing, because the key is the content and not the position');
  check(r.onDisk.every(t => t === 'number'),
        `every element reaches disk as an interned id (${r.onDisk.join(', ')})`,
        '         the element stamp goes through the same layer as an object stamp');
  check(r.tableSize >= 2,
        `and the moments are in the file's own table (${r.tableSize})`);
}

/* B-137 behaviourally: the machine-translation writer must produce a moment
   with the flag, not a name that merely looks automatic. Asserted on what
   `applyTranslation` WRITES — a source scan for `/^auto/` passes happily while a
   writer mints a flagless moment, which is how the two readers came to disagree
   in the first place. Found by falsification: the source check alone did not
   fail when the old literal was put back. */
{
  const K = boot(jsonl(corpusPath), jsonl(dictPath));
  const r = run(K, `(function(){
    const sent = { id: 's_mt', translations: [] };
    applyTranslation(sent, { text: 'a machine translation', method: 'nllb-200' });
    const el = sent.translations[0];
    const rec = objProv(el);
    return { onElement: el.prov != null, derived: rec && rec.derived === true,
             named: rec && rec.annotator, human: _humanField(sent, 'translations', true) };
  })()`);
  check(r.onElement, 'a machine translation is stamped on the element it added');
  check(r.derived === true,
        'and the moment carries derived: true',
        '         the old writer set only a name, so provTipAttr had to match /^auto/ and\n'
        + '         _humanField never did — the two readers disagreed about one stamp');
  check(r.named === 'auto-nllb-200', `and names the method (${r.named})`);
  check(r.human === false,
        'so _humanField agrees it is not a person\'s work',
        '         it said YES before B-137, and hasAnnotation(human) with it');
}

/* The paragraph level had no field stamping at all before B-137/B-138.
   v3.14.262 moved the assignment itself into applyForm, so there are no longer
   per-level assignList calls to count. The claim is now made once, where the
   writer is: applyForm routes every list control through assignList, and every
   save handler goes through applyForm. Both halves are checked, because either
   alone is the defect — a writer that reconciles nobody calls, or a handler
   that calls a writer which overwrites. */
{
  const { fnSrc, decomment, read } = require('./_source.js');
  const F = require('../../source/modules/field_spec.js');

  const writer = decomment(fnSrc('LingCoT.html', 'applyForm'));
  check(/_PROV_LIST_CONTROLS\.includes\(f\.control\)/.test(writer)
        && /assignList\(/.test(writer),
        'applyForm routes list-control fields through assignList',
        '         a bare `bag[key] = value` throws away every element stamp');

  const lists = decomment(read('LingCoT.html'))
    .match(/const _PROV_LIST_CONTROLS = \[([^\]]*)\]/);
  const declared = lists ? lists[1].match(/'(\w+)'/g).map(x => x.replace(/'/g, '')) : [];
  /* Named from the table, not from this file: a list control added to the table
     and forgotten here would otherwise be assigned raw and stamped by nothing. */
  const listControls = new Set();
  for (const lvl of Object.keys(F.FIELD_SPEC))
    for (const f of F.fieldsOf(lvl).filter(F.isFillable))
      if (['translations', 'translits', 'comments'].includes(f.control)) listControls.add(f.control);
  const unrouted = [...listControls].filter(c => !declared.includes(c));
  check(unrouted.length === 0,
        `every per-element list control the table uses is routed (${[...listControls].join(', ')})`,
        `         not in _PROV_LIST_CONTROLS: ${unrouted.join(', ')}`);

  for (const fn of ['saveParagraph', 'saveSentence', 'saveParagraphAdd', 'saveSentenceAdd']) {
    const body = decomment(fnSrc('LingCoT.html', fn));
    check(/applyForm\(/.test(body), `${fn} writes its fields through applyForm`,
          '         a handler that assigns by hand is the B-117 shape again');
  }
}

/* ── The saving, against a fixture that has not been interned ───────────────
   D58 §3, v3.14.386. The size claim above only means something when there IS
   something to shrink, and after the v3.14.384 fixture swap `samples/` carries
   nothing of the kind — every file in it was written by the app and arrives
   already interned, so the branch that measures the saving stopped being
   reachable and the guard lost a check without failing.

   `dev/tests/fixtures/cli_ingested/` is that fixture, and it is not a museum
   piece: it is `corpus_ingest.py`'s own output, which is what every corpus a
   user starts from a text file looks like until the app first saves it. D58 §3
   asked "who writes this shape today" of six readers and deleted them; this is
   the one that had an answer.

   Measured at v3.14.386: 70 inline stamps, 21,293 bytes. */
{
  const CLI = path.join(__dirname, 'fixtures', 'cli_ingested', 'cli-ingested_corpus.jsonl');
  check(fs.existsSync(CLI), 'the CLI-ingested specimen is present',
        `         ${CLI}\n         regenerate it with the command in its README`);
  if (fs.existsSync(CLI)) {
    const raw = fs.readFileSync(CLI, 'utf8');
    /* The two properties that make it the right fixture, asserted before it is
       used — a specimen that has quietly been re-saved by the app would pass
       every check below by measuring nothing. */
    check(!/"record_type":"prov_events"/.test(raw),
          'it carries no event table, so there is a saving left to measure',
          '         if this fails the specimen has been interned and must be regenerated');
    check(/"prov":\{/.test(raw),
          'and its stamps are inline objects',
          '         no inline stamp means nothing to intern');
    check(/"record_type":"document"/.test(raw),
          'while still DECLARING its kind, which is what let §3 delete the shape sniffers',
          '         a CLI that stopped declaring record_type would break isDocument and '
        + 'detectFileType, not just this guard');

    const C = boot(loadCorpus(CLI).records, []);
    const out = run(C, 'serializeRecords(S.docs, true)');
    const was = Buffer.byteLength(raw), now = Buffer.byteLength(out);
    /* Measured at v3.14.226 on the corpus of the day: 67.9%. The threshold is
       the one that entry set, not one fitted to this file. */
    check(now < was * 0.80,
          `interning shrinks it to ${(100 * now / was).toFixed(1)}% of its stored size`,
          '         the interning is meant to be worth roughly a third of the file');
    check(/^\{"record_type":"prov_events"/.test(out),
          'and the written form opens with the event table it did not have');

    /* And no fact is lost on the way — the same question the round trip asks of
       the interned fixture, asked of the uninterned one. */
    const D = boot(out.split('\n').map(JSON.parse), []);
    check(run(D, 'serializeRecords(S.docs, true)') === out,
          'writing it back a second time is byte-identical',
          '         an unstable output rewrites the file forever under autosave');
    /* OBJECT-level stamps, not field-level: the CLI writes `prov` on the record
       and leaves `field_prov` null, because nothing has edited a field yet. That
       is the shape of a corpus before annotation, and counting the wrong one
       here would have reported 0 = 0 and passed. B-201 was this mistake made
       against a different pair of populations. */
    const OBJ_STAMPS = `(function(){let n=0;const walk=o=>{
      if(Array.isArray(o)){o.forEach(walk);return;}
      if(!o||typeof o!=='object')return;
      if(o.prov!=null)n++;
      if(Array.isArray(o.prov_history))n+=o.prov_history.length;
      for(const k in o){if(k==='prov'||k==='prov_history')continue;
        const v=o[k]; if(v&&typeof v==='object')walk(v);}};walk(S.docs);return n;})()`;
    const nBefore = run(C, OBJ_STAMPS), nAfter = run(D, OBJ_STAMPS);
    check(nBefore > 0 && nAfter === nBefore,
          `every one of its ${nBefore} object stamps survives interning`,
          `         ${nAfter} after, ${nBefore} before`);
    check(run(C, DOC_STAMPS) === 0,
          'and it carries no FIELD stamps, which is what an unannotated corpus looks like',
          '         a specimen with field stamps has been edited and is no longer the CLI\'s output');
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
