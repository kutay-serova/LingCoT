/**
 * schema_conformance_test.js. G30: catch schema drift mechanically.
 *
 * Walks the korean-test corpus + dictionary and asserts every object uses ONLY
 * fields documented in the SCHEMA block (LingCoT.html, top of the <script>). The
 * allow-lists below mirror that block, when a new field is added to the data,
 * this test fails until the SCHEMA block (and this list) are updated, so the doc
 * can't silently drift from the code again.
 *
 * Run: node dev/tests/schema_conformance_test.js   (exit 0 = conformant)
 */

const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { requireCorpusDir, corpusFilesIn, requireCompanion, loadCorpus, loadCompanion } = require('./_fixture.js');

/* B-128: one loader for the suite. This guard used to carry its own brace-
   scanning JSONL parse, and it had no idea a corpus can open with a format
   record — it would have validated the provenance event table as a document.

   A corpus gives its documents; a companion gives every row, because in a
   dictionary or a participants file nothing is a document. */
const load = (file) => /_corpus\.jsonl$/.test(file)
  ? loadCorpus(file, 'schema conformance').items
  : loadCompanion(file, 'schema conformance').records;
/* Hoisted for B-037: the allow-lists are derived from it below. */
const F = require('../../source/modules/field_spec.js');

/* v3.14.114: this used to take `requireCorpus(null, …)`, the FIRST corpus in the
   fixture set and nothing else. With two fixtures installed it walked 54 objects
   and reported "conformant", while 1,700 objects in the other corpus went
   unchecked. Schema drift is exactly the defect that hides in the corpus you did
   not look at, so it now walks EVERY corpus present and says how many. */
const CORPORA = corpusFilesIn(requireCorpusDir('schema conformance'));
if (!CORPORA.length) { console.error('\n  FAIL  no corpus in the fixture set\n'); process.exit(1); }


/* B-037: the allow-lists are DERIVED from FIELD_SPEC, in dev/tests/_schema.js,
   which says why and what changed. They used to be hand-typed here to mirror the
   prose SCHEMA block, and cli_schema_test.js scraped this file for a third copy. */
const { ALLOW, kindOf } = require('./_schema.js');

/* ── B-027: field VALUES, not just field names ───────────────────────────────
   This guard has always checked that every object uses only documented field
   NAMES. Nothing checked the values against the resource files that define
   them, which is how `CONJ` (this project spells it `COORD`) and a lower-case
   `affix` reached a published dictionary PDF, noticed by reading it.

   D48 gave the check a source of truth it did not have: `FIELD_SPEC` says which
   vocabulary each tag field draws on, so this is a check against the field's
   declared pool rather than a rule invented here. Three of the five fields
   declared no pool until v3.14.214; they do now, which is most of what made
   this cheap.

   The resource files are read, not the defaults hard-coded in LingCoT.html:
   `pos_tags.json` is a user extension point, and a guard that ignored it would
   fail on a legitimately extended vocabulary. */
const tagsIn = j => new Set(j.map(x => (typeof x === 'string' ? x : x.tag || x.value || x.name)));
const POOLS = {
  POS_CHOICES:  tagsIn(JSON.parse(fs.readFileSync(path.join(ROOT, 'source/resources/pos_tags.json'), 'utf8'))),
  TYPE_CHOICES: tagsIn(JSON.parse(fs.readFileSync(path.join(ROOT, 'source/resources/type_choices.json'), 'utf8'))),
};
// The three levels that carry tag fields. A kind with no level is not checked.
const KIND_LEVEL = { word: 'word', morph: 'morpheme', dict: 'dict_entry' };

let pass = 0, fail = 0; const fails = [];
let vPass = 0, vFail = 0; const vFails = [];

function checkValues(kind, obj, where) {
  const level = KIND_LEVEL[kind];
  if (!level) return;
  /* A lemma record is a group, not an entry: no type, no part of speech.
     D58 §3, v3.14.386: the two exemptions for the OLDER spellings —
     `record: 'lemma'` and `type: 'lemma'` — went with the migration that
     converted them. They exempted a shape no file holds; the guard below
     asserts that, rather than this one quietly tolerating it. */
  if (kind === 'dict' && obj.record_type === 'lemma') return;
  for (const f of F.fieldsOf(level)) {
    const pool = F.tagPoolOf(level, f.key);
    if (!pool) continue;
    const v = obj[f.key];
    if (v == null || v === '') continue;      // empty is legitimate, see D48
    if (POOLS[pool].has(v)) { vPass++; continue; }
    vFail++;
    vFails.push(`${level}.${f.key} @ ${where}: ${JSON.stringify(v)} is not in ${pool}`);
  }
}

function check(kind, obj, where) {
  const allow = new Set(ALLOW[kind]);
  const extra = Object.keys(obj).filter(k => !allow.has(k));
  if (extra.length) { fail++; fails.push(`${kind} @ ${where}: undocumented field(s) ${JSON.stringify(extra)}`); }
  else pass++;
  checkValues(kind, obj, where);
}

for (const CORPUS of CORPORA) {
const DICT = requireCompanion(CORPUS, 'dictionary');
const docs = load(CORPUS);
if (!docs.length) { console.error(`No corpus parsed: ${CORPUS}`); process.exit(1); }
for (const d of docs) {
  /* B-119: a corpus file's first line is the provenance event table since
     interning, not a document. Routed by its discriminator rather than by
     position, so a file written in either order is read correctly. */
  check(kindOf(d, 'doc'), d, d.id);
  if (d.metadata) check('meta', d.metadata, `${d.id}.metadata`);
  for (const sec of (d.sections || [])) {
    check('section', sec, sec.id);
    for (const p of (sec.paragraphs || [])) {
      check('para', p, p.id);
      for (const st of (p.sentences || [])) {
        check('sent', st, st.id);
        for (const w of (st.words || [])) {
          check('word', w, w.id);
          for (const m of (w.morphemes || [])) check('morph', m, m.id);
        }
      }
    }
  }
}
for (const e of load(DICT)) check(kindOf(e, 'dict'), e, e.id);
}

/* One reporter, so the whole suite reads the same (v3.14.136). This guard walks
   every object in every corpus, so it reports the scan as one line rather than
   one line per object, the same shape theme_audit and selector_audit use. */
const names = CORPORA.map(f => path.basename(path.dirname(f))).join(', ');
console.log('\nschema conformance\n');
if (fail === 0) {
  console.log(`  ok   ${pass} object(s) conform to the schema  (${CORPORA.length} corpus/corpora: ${names})`);
} else {
  console.log(`  FAIL ${fail} object(s) drift from the schema, of ${pass + fail} walked  (${names})`);
  for (const f of fails.slice(0, 25)) console.log('         ' + f);
  if (fails.length > 25) console.log(`         … and ${fails.length - 25} more`);
}
/* B-027: reported separately from the name check, because they fail for
   different reasons and want different fixes. A drifted NAME is a schema
   change nobody wrote down; a drifted VALUE is annotation that needs deciding
   about, and deciding is not this guard's job. */
if (!vFail) {
  console.log(`  ok   ${vPass} tag value(s) are in the vocabulary their field declares`);
} else {
  console.log(`  FAIL ${vFail} tag value(s) are outside the declared vocabulary, of ${vPass + vFail} checked`);
  for (const f of vFails.slice(0, 25)) console.log('         ' + f);
  if (vFails.length > 25) console.log(`         … and ${vFails.length - 25} more`);
  console.log('         B-027: correcting these changes annotation, so it is a migration, not a fix');
}

const bad = fail || vFail;
console.log(`\n${bad ? 0 : 2} passed, ${bad ? 1 : 0} failed\n`);
process.exit(bad ? 1 : 0);
