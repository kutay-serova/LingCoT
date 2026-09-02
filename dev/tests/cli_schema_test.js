#!/usr/bin/env node
/* =============================================================================
   cli_schema_test.js, the CLI writes the schema the app reads
   Run:  node dev/tests/cli_schema_test.js
   =============================================================================
   D36 / SCRIPTS_AUDIT S3. corpus_ingest.py wrote `free_translation`, a scalar
   `transliteration` and `annotations: {}` — a pre-G31 schema — for however long
   it took someone to audit it. The app reads `translations[]` and
   `transliterations[]`, and sentTrans() had no fallback, so **a corpus built at
   the command line opened with its translations invisible**.

   schema_conformance_test.js would have caught it on contact. It never did,
   because _fixture.js looks only at samples/ and the workspace, and no fixture
   was ever produced by the CLI. The guard was right; it was pointed the wrong
   way.

   THE RULE: the CLI and the GUI write ONE schema. This guard ingests a real file
   with the shipped ingester and conforms the result against the same allow-lists
   schema_conformance_test.js uses, so the two entry points cannot drift again
   without a test going red.

   Ingestion runs in a temporary workspace via LINGCOT_WORKSPACE, so the guard
   never touches the user's corpora.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, SRC, disabled } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\nCLI ingest → the app’s schema\n');

/* One derivation, shared with schema_conformance_test.js, in _schema.js.
   This used to READ that file with a regex and eval the literal it found —
   better than a copy, but it broke the moment the literal became a computed
   value, and a guard that parses another guard's source is one refactor away
   from silently checking nothing. B-037 put the derivation in one place. */
const { ALLOW } = require('./_schema.js');
const { loadCorpus } = require('./_fixture.js');   // B-128, one corpus parse
check(Object.keys(ALLOW).length >= 6,
      `allow-lists derived from FIELD_SPEC (${Object.keys(ALLOW).length} kinds)`,
      '         a copy here would be a second source of truth for one schema');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-cli-'));
let docs = null;
try {
  const txt = path.join(tmp, 'sample.txt');
  fs.writeFileSync(txt, 'Merhaba dunya.\nBu bir deneme metnidir.\n', 'utf8');
  execFileSync('python3', [path.join(SRC, 'scripts', 'corpus_ingest.py'),
                           txt, '--title', 'Guard Fixture', '--language', 'tur'],
               { env: { ...process.env, LINGCOT_WORKSPACE: tmp },
                 stdio: 'pipe', timeout: 60000 });
  const dir = path.join(tmp, 'corpora', 'guard_fixture');
  const out = fs.readdirSync(dir).find(f => f.endsWith('_corpus.jsonl'));
  /* B-128: through the shared loader, so a format line the ingester starts
     writing does not become "the ingester produced two documents". */
  docs = loadCorpus(path.join(dir, out), 'the ingester output').items;
} catch (e) {
  fs.rmSync(tmp, { recursive: true, force: true });
  disabled('corpus_ingest.py could not be run',
           `python3 or the ingester is unavailable here: ${String(e.message).slice(0, 160)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });

check(docs && docs.length === 1, 'the ingester produced one document');

/* Walk it exactly as schema_conformance_test.js walks a corpus. */
const drift = [];
const conform = (kind, obj, where) => {
  const allow = new Set(ALLOW[kind]);
  const extra = Object.keys(obj).filter(k => !allow.has(k));
  if (extra.length) drift.push(`         ${kind} @ ${where}: ${JSON.stringify(extra)}`);
};
let sents = 0, words = 0;
for (const d of docs) {
  conform('doc', d, d.id);
  if (d.metadata) conform('meta', d.metadata, `${d.id}.metadata`);
  for (const sec of d.sections || []) {
    conform('section', sec, sec.id);
    for (const p of sec.paragraphs || []) {
      conform('para', p, p.id);
      for (const s of p.sentences || []) {
        conform('sent', s, s.id); sents++;
        for (const w of s.words || []) { conform('word', w, w.id); words++; }
      }
    }
  }
}
check(sents > 0 && words > 0, `${sents} sentence(s) and ${words} word(s) to check`,
      '         zero means the walk broke, not that the output is clean');
check(drift.length === 0, 'every ingested object conforms to the app’s schema',
      drift.slice(0, 12).join('\n'));

/* ── B-134, v3.14.276: the universal keys are PRESENT, not merely allowed ────
   Everything above asks whether an ingested object uses only KNOWN keys. That
   is a one-way test, and it is why no script wrote `prov_history` at any level
   for the whole life of the project while this guard stayed green: a missing
   key is not drift.

   `UNIVERSAL_KEYS` is the field table's own list, read from it rather than
   retyped here, so a key added there is required of the CLI without anyone
   remembering to come back. `id` and `record_type` are excluded: `record_type`
   is written on the document row only, and `deleted` is a tombstone nothing
   creates. What is asserted is the attribution trio every object carries from
   birth — the app's own initProv() writes all of it. */
{
  const F = require(path.join(ROOT, 'source', 'modules', 'field_spec.js'));
  const REQUIRED = (F.UNIVERSAL_KEYS || [])
    .filter(k => ['prov', 'prov_history'].includes(k));
  const missing = [];
  const need = (kind, o, where) => {
    for (const k of REQUIRED) if (!(k in o)) missing.push(`         ${kind} @ ${where}: no ${k}`);
    if (Array.isArray(o.prov_history) && o.prov_history.length === 0)
      missing.push(`         ${kind} @ ${where}: prov_history is empty`);
  };
  let seen = 0;
  for (const d of docs) {
    need('doc', d, d.id); seen++;
    for (const sec of d.sections || []) {
      need('section', sec, sec.id); seen++;
      for (const pa of sec.paragraphs || []) {
        need('para', pa, pa.id); seen++;
        for (const se of pa.sentences || []) {
          need('sent', se, se.id); seen++;
          for (const w of se.words || []) { need('word', w, w.id); seen++; }
        }
      }
    }
  }
  check(REQUIRED.length === 2 && seen > 10,
        `${seen} ingested object(s) checked for the ${REQUIRED.length} universal stamp key(s)`,
        '         zero of either means the walk or the field-table read broke');
  check(missing.length === 0,
        'every ingested object is born with a prov AND the trail that holds it',
        missing.slice(0, 8).join('\n'));
  const d0 = docs[0];
  check(Array.isArray(d0.prov_history) && d0.prov_history.length === 1
        && JSON.stringify(d0.prov_history[0]) === JSON.stringify(d0.prov),
        'and the trail starts as exactly the creation stamp',
        `         prov ${JSON.stringify(d0.prov)} vs trail ${JSON.stringify(d0.prov_history)}`);
}

console.log('\nthe fields the app actually reads are the ones written\n');
{
  const s0 = docs[0].sections[0].paragraphs[0].sentences[0];
  const w0 = s0.words[0];
  check(Array.isArray(s0.translations), 'sentence.translations is an array',
        '         sentTrans() reads translations[]; free_translation was invisible');
  check(!('free_translation' in s0), 'and the retired free_translation key is gone');
  check(Array.isArray(w0.transliterations), 'word.transliterations is an array');
  check(!('transliteration' in w0), 'and the scalar transliteration is gone');
  check(!('annotations' in s0) && !('annotations' in docs[0]),
        'annotations is not written at any level (retired at G34)');
}

console.log('\none reader and one writer for the translation field\n');
{
  const ann = fs.readFileSync(path.join(SRC, 'scripts', 'corpus_annotate.py'), 'utf8');
  check(/def sent_translation\(/.test(ann) && /def set_sent_translation\(/.test(ann),
        'corpus_annotate.py routes reads and writes through one pair of helpers');
  const body = ann.replace(/def sent_translation[\s\S]*?\n\n\n/, '')
                  .replace(/def set_sent_translation[\s\S]*?\n\n\n/, '');
  check(!/sent\w*\.get\('free_translation'\)/.test(body),
        'and nothing else reads free_translation directly',
        '         --stats read it and reported 0 of 13 translated for a corpus\n'
      + '         where all 13 were; --translate would then have redone all of them');
  const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
  check(/free_translation/.test(html),
        'the app still READS the legacy key, so pre-v3.14.151 corpora open',
        '         removing the fallback strands every corpus the CLI has produced');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
