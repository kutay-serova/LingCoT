#!/usr/bin/env node
/* =============================================================================
   field_spec_test.js, the table agrees with the data on disk
   Run:  node dev/tests/field_spec_test.js
   =============================================================================
   D48 stage A. The table is only worth having if it is COMPLETE: the moment a
   field exists in a corpus and not in the table, every consumer built on it —
   the counter, the marking, the renderer — is silently blind to that field.
   That is B-093 and B-094's failure mode exactly, arrived at from the inside.

   So the important half of this guard does not read the table against the
   schema comment, which is prose and can drift with it. It walks the FIXTURE
   and requires every key on every stored object to be declared. Execute, do not
   read: this is the rule that found B-097 and B-100 in the same week.
   ============================================================================= */

const fs = require('fs');
const F  = require('../../source/modules/field_spec.js');
const { requireCorpus, requireCompanion, loadCorpus, loadCompanion } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

/* ── 1. the table is well formed ─────────────────────────────────────────── */
for (const [level, fields] of Object.entries(F.FIELD_SPEC)) {
  const keys = fields.map(f => f.key);
  check(new Set(keys).size === keys.length, `${level}: no duplicate field keys`,
        keys.filter((k, i) => keys.indexOf(k) !== i).join(', '));
  const badTier = fields.filter(f => !F.FIELD_TIERS.includes(f.tier));
  check(badTier.length === 0, `${level}: every field carries a known tier`,
        badTier.map(f => `${f.key}=${f.tier}`).join(', '));
  /* A field is drawn by a generic control, or by a named bespoke surface, or it
     is derived and drawn by nothing. A fourth case is a field nobody can fill,
     which is what B-093 was. */
  const DRAWN_BY_NOTHING = ['derived', 'legacy'];
  const noSurface = fields.filter(f => !DRAWN_BY_NOTHING.includes(f.tier) && !f.control && !f.surface);
  check(noSurface.length === 0,
        `${level}: every non-derived field says how it is presented`,
        noSurface.map(f => f.key).join(', ') + ' — a field with no control and no surface is unfillable');
}

/* ── 2. identity is the save rule, and it is deliberate everywhere ───────── */
{
  /* Identity is a SAVE rule — the field a form refuses to be saved without — so
     it is asked only of levels a person fills in. Two are not:
       paragraph    a container; its text is its sentences
       prov_events  the provenance table (B-119). Nothing draws it and nothing
                    prompts for it; it is a stored record the conformance guard
                    walks, and giving it a nominal identity field to satisfy this
                    check would state something false about how it is written. */
  const NO_IDENTITY = ['paragraph', 'prov_events'];
  for (const [level, fields] of Object.entries(F.FIELD_SPEC)) {
    const ids = fields.filter(f => f.tier === 'identity');
    if (NO_IDENTITY.includes(level))
      check(ids.length === 0, `${level}: no identity field, by design`,
            'listed in NO_IDENTITY, so its absence is a decision rather than an omission');
    else
      check(ids.length === 1, `${level}: exactly one identity field (${ids.map(f => f.key)})`,
            `found ${ids.length}: an object with two ways to be identified has none`);
  }
  check(F.blocksSave('sentence', 'text') === true, 'blocksSave is true for an identity field');
  check(F.blocksSave('word', 'gloss') === false,
        'and false for core — importance does not block',
        'refusing the save produces a placeholder, not a value');
}

/* ── 3. an undeclared key is a miss, not a default ───────────────────────── */
check(F.tierOf('word', 'no_such_field') === null,
      'tierOf returns null for an undeclared key',
      'defaulting to a tier would hide exactly the gap section 4 looks for');
check(F.tierOf('no_such_level', 'form') === null, 'and for an unknown level');

/* ── 4. THE ONE THAT MATTERS: the fixture holds nothing the table omits ──── */
{
  const corpusPath = requireCorpus('turkish', 'the field table against real data');
  /* v3.14.242: [0] used to be the document. A corpus saved since interning opens
     with a prov_events line, so taking the first record blind walked the event
     table and reached three levels instead of eight. B-128 moved the parse and
     the lifting into the shared loader at v3.14.245. */
  const _corpus = loadCorpus(corpusPath, 'the field table against real data');
  const _recs = _corpus.records;
  const doc = _corpus.items[0];

  const seen = {};                       // level → Set(keys actually present)
  const note = (level, obj) => {
    if (!obj || typeof obj !== 'object') return;
    (seen[level] = seen[level] || new Set());
    for (const k of Object.keys(obj)) seen[level].add(k);
  };

  /* The event table is a stored record too, declared at B-119, so its keys are
     walked like any other level's rather than skipped. */
  for (const ev of _recs.filter(r => r.record_type === 'prov_events')) note('prov_events', ev);
  note('document', doc.metadata);
  for (const sec of doc.sections || []) {
    note('section', sec);
    for (const para of sec.paragraphs || []) {
      note('paragraph', para);
      for (const sent of para.sentences || []) {
        note('sentence', sent);
        for (const w of sent.words || []) {
          note('word', w);
          for (const m of w.morphemes || []) note('morpheme', m);
        }
      }
    }
  }

  const dictPath = requireCompanion(corpusPath, 'dictionary');
  /* v3.14.247: `.items`, not `.records`. The dictionary gained an event table
     at D50 stage 4b, and reading it as a dictionary entry reported its `events`
     key as an undeclared dict_entry field. The table's own keys are walked
     below, at the prov_events level, together with the corpus's. */
  const _dict = loadCompanion(dictPath, 'dictionary field names');
  for (const r of _dict.items) {
    note(r.record_type === 'lemma' || r.record === 'lemma' || r.type === 'lemma' ? 'lemma' : 'dict_entry', r);
  }
  for (const ev of _dict.format) note('prov_events', ev);

  const partPath = requireCompanion(corpusPath, 'participants');
  const _parts = loadCompanion(partPath, 'participant field names');
  for (const r of _parts.items) {
    note(r.record_type === 'source' ? 'source' : 'annotator', r);
  }
  for (const ev of _parts.format) note('prov_events', ev);

  const ignored = new Set([...F.UNIVERSAL_KEYS, ...F.CONTAINER_KEYS]);
  let levelsChecked = 0;
  for (const [level, keys] of Object.entries(seen)) {
    levelsChecked++;
    const undeclared = [...keys].filter(k => !ignored.has(k) && F.tierOf(level, k) === null);
    check(undeclared.length === 0,
          `${level}: all ${keys.size} key(s) on disk are declared`,
          `undeclared: ${undeclared.join(', ')} — every consumer of this table would be blind to them`);
  }
  check(levelsChecked >= 7,
        `walked ${levelsChecked} levels of real data`,
        'too few levels reached — the walk is not exercising the fixture');
}

/* ── 5. it is consumed, and only through the accessors ────────────────────────
   This check used to assert the opposite: at stage A nothing read the table,
   and it said in its own failure message to delete it when stage B landed. It
   is replaced rather than removed, because the rule that matters now is the one
   D48's second decision rests on — every consumer asks `tierOf` and friends
   rather than reaching into FIELD_SPEC, so making the tiers per-project later
   is a change to one function instead of twenty views. A direct read is that
   change becoming impossible, one site at a time. */
{
  const { read, moduleFiles, decomment } = require('./_source.js');
  const others = [['LingCoT.html', read('LingCoT.html')],
                  ...moduleFiles().filter(([n]) => n !== 'field_spec.js')];
  const callers = others.filter(([, src]) => /\btierOf\s*\(/.test(decomment(src)));
  check(callers.length > 0, `the table is read by ${callers.map(c => c[0]).join(', ')}`,
        'stages B and C consume it; nothing reading it means the wiring is gone');
  const reachIn = others.filter(([, src]) => /\bFIELD_SPEC\s*\[/.test(decomment(src)));
  check(reachIn.length === 0,
        'no consumer indexes FIELD_SPEC directly',
        `${reachIn.map(c => c[0]).join(', ')} bypasses the accessors, which is the `
        + 'seam D48 exists to keep');
  check(/<script src="modules\/field_spec\.js"><\/script>/.test(read('LingCoT.html')),
        'and the app loads it');
}

/* ── B-177: a declared fold is applied ─────────────────────────────────────
   `fold:` sat on five fields from the day the table was written and NOTHING read
   it. The chip drawer folded inline with a literal argument; every writer stored
   what was typed. So the two ways into one field disagreed — `NOUN` from the
   chips, `noun` from the keyboard — and they are different values to every index,
   count and search. Found by `gui_crud` A4, which types `noun` and asks the file
   for `NOUN`.

   DERIVED from the table both ways round, so a sixth declaration is covered the
   day it is written and a fold that stops being applied is caught the day it
   stops. A list here would need remembering, and not remembering is the whole
   defect. */
console.log('\na declared fold is applied, and only where it is declared\n');
{
  const declared = [];
  for (const level of Object.keys(F.FIELD_SPEC))
    for (const f of F.fieldsOf(level))
      if (f.fold) declared.push([level, f.key, f.fold]);

  check(declared.length >= 5, `${declared.length} field(s) declare a fold`,
        '       if this collapses to nothing the checks below assert nothing');

  for (const [level, key, fold] of declared) {
    const probe = fold === 'upper' ? 'mIxEd' : 'MiXeD';
    const want  = fold === 'upper' ? 'MIXED' : 'mixed';
    check(F.foldValue(level, key, probe) === want,
          `${level}.${key} folds ${fold}`,
          `       ${probe} -> ${F.foldValue(level, key, probe)}, want ${want}`);
  }

  /* And nothing else is touched. A gloss is the annotator's text and case IS
     information in it — the app rewriting that would be the thing B-073 and D53
     stage F refused. */
  const untouched = [['word', 'gloss'], ['dict_entry', 'meaning'], ['sentence', 'text']]
    .filter(([l, k]) => F.fieldOf(l, k));
  check(untouched.length > 0, `${untouched.length} unfolded field(s) to check`);
  for (const [level, key] of untouched)
    check(F.foldValue(level, key, 'MiXeD Case') === 'MiXeD Case',
          `${level}.${key} is left exactly as typed`);

  check(F.foldValue('word', 'part_of_speech', null) === null
        && F.foldValue('word', 'part_of_speech', undefined) === undefined,
        'and an absent value stays absent rather than becoming "NULL"');

  /* The writers ask the table rather than spelling the rule again — the drift
     this closes was a second place that knew what `upper` meant. */
  const { read, decomment } = require('./_source.js');
  const html = decomment(read('LingCoT.html'));
  for (const [what, re] of [
    ['the generated forms, on read', /out\[f\.key\] = foldValue\(level, f\.key,/],
    ['the word editor\'s part of speech', /wPos\s*=\s*foldValue\('word', 'part_of_speech'/],
    ['a morpheme\'s part of speech', /foldValue\('morpheme', 'part_of_speech'/],
    ['a morpheme\'s type', /foldValue\('morpheme', 'type'/],
  ]) check(re.test(html), `${what} folds through the table`,
           '       a writer that folds inline is the second place that knows the\n'
         + '       rule, which is what left `fold:` unread for the whole life of\n'
         + '       the table');
}

/* ═══ B-200 · a field the app mints must be declared at the level it mints it ══
   `homograph` is written onto a LEMMA by `_indexLemma` exactly as it is written
   onto an ENTRY by `_indexDictEntry` (B-114, D35 A1) — and only `dict_entry`
   declared it. Every consumer of the table was blind to it on a lemma, and
   `schema_conformance` called two live records drift in the annotator's data.

   It stayed invisible because no corpus had a numbered lemma pair until one was
   annotated: `samples/` has none, and D58 names that absence as a measured gap.
   This check needs no such pair — it asks the SOURCE which levels take part in
   numbering, so it holds whatever the fixture happens to contain. */
console.log('\n  B-200 — every level a numbering writer touches declares the number');
{
  const { read: _rd, decomment: _dc } = require('./_source.js');
  const app = _dc(_rd('LingCoT.html'));
  for (const [fn, level] of [['_indexDictEntry', 'dict_entry'], ['_indexLemma', 'lemma']]) {
    const body = (app.match(new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n\\}`)) || [''])[0];
    check(body.length > 0, `${fn} found`);
    check(/homograph|_numberBucket|assignHomographs|assignLemmaHomographs/.test(body),
          `${fn} takes part in numbering`,
          '       if this is false the pairing below asserts nothing');
    check((F.fieldsOf(level) || []).map(f => f.key).includes('homograph'),
          `and '${level}' declares homograph`,
          `       ${fn} mints it and the table does not know — every consumer of\n`
        + '       the table is blind to it, and the conformance guard reads it\n'
        + '       as drift in the annotator\'s own data');
  }
}

/* ── D58 §3, v3.14.386: the `legacy` tier is gone, and stays gone ───────────
   The tier existed to admit keys that were on disk and drawn by nothing, so that
   a consumer built from the table could not be blind to them (PRACTICES §5).
   Every one of its fourteen members has since lost its writer, and the last file
   carrying any was retired with `samples/turkish-test` at v3.14.384 — so the
   tier had become the failure it was created to prevent, running the other way:
   a declaration admitting the existence of something that does not exist.

   Asserted here rather than left to the deletion, because re-adding a tier is
   one line and nothing else in the suite would notice. */
console.log('\nthe legacy tier is gone');
{
  check(!F.FIELD_TIERS.includes('legacy'),
        'FIELD_TIERS does not name it',
        `         ${F.FIELD_TIERS.join(', ')}`);
  const offenders = [];
  for (const lvl of Object.keys(F.FIELD_SPEC))
    for (const f of F.FIELD_SPEC[lvl])
      if (f.tier === 'legacy' || 'legacyKey' in f) offenders.push(`${lvl}.${f.key}`);
  check(offenders.length === 0,
        'and no field declares that tier, or a legacyKey fallback',
        `         ${offenders.join(', ')}`);
  /* Not vacuous: the table still has fields, and the tiers it does name are
     still in use. A table emptied by accident would pass the two checks above. */
  const used = new Set();
  for (const lvl of Object.keys(F.FIELD_SPEC)) for (const f of F.FIELD_SPEC[lvl]) used.add(f.tier);
  check(used.size >= 4 && [...used].every(t => t == null || F.FIELD_TIERS.includes(t)),
        `every tier in use is a declared one (${[...used].filter(Boolean).sort().join(', ')})`,
        '         a tier nothing declares is the same defect wearing the other face');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
