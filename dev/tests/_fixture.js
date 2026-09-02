/* =============================================================================
   _fixture.js, where the guards find a corpus to test against
   =============================================================================
   Thirteen guards need real corpus data (six when this file was written).
   Until v3.14.79 they read it from
   <app>/corpora/, which was also where the USER's fieldwork lived, the layout
   B-022/B-023 removed. Their inputs are now gone, and that is correct: test
   fixtures belong to the repository, private corpora do not.

   Resolution order:
     1. LINGCOT_TEST_CORPUS, an explicit directory, for trying a candidate
        replacement without editing six files
     2. <app>/samples/, the shipped test corpora (the intended home)
     3. <app>/corpora/, legacy, pre-v3.14.79

   THE RULE THIS FILE EXISTS TO ENFORCE: a guard with no data must FAIL, loudly
   and with an actionable message. It must never pass.

   `dep_root_test.js` did exactly that, it wrapped its corpus walk in a bare
   try/catch, so with the corpora gone it reported "0 root tokens across 0 corpus
   files" and printed `ok`. Ten guards in this project have now passed for the
   wrong reason. Absent input is the loudest kind of failure available, because
   the suite's whole value is the claim that green means checked.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// @fn corpusDir
function corpusDir() {
  const candidates = [
    process.env.LINGCOT_TEST_CORPUS && path.resolve(ROOT, process.env.LINGCOT_TEST_CORPUS),
    path.join(ROOT, 'samples'),
    path.join(ROOT, 'corpora'),
  ].filter(Boolean);
  for (const d of candidates) {
    if (fs.existsSync(d) && corpusFilesIn(d).length) return d;
  }
  return null;
}

// @fn corpusFilesIn, every *_corpus.jsonl below dir, recursively
function corpusFilesIn(dir) {
  const out = [];
  const walk = d => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /_corpus\.jsonl$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

// @fn die, one shared, actionable failure message
function die(what) {
  console.error(`\n  FAIL  no test corpus available — cannot check ${what}\n`);
  console.error('  The guards read fixtures from, in order:');
  console.error('    1. $LINGCOT_TEST_CORPUS');
  console.error(`    2. ${path.join(ROOT, 'samples')}      (intended home)`);
  console.error(`    3. ${path.join(ROOT, 'corpora')}      (legacy, pre-v3.14.79)`);
  console.error('\n  The user\'s corpora moved to ~/LingCoT/ in v3.14.79 and are');
  console.error('  deliberately NOT test inputs — private fieldwork must not gate');
  console.error('  the suite. A purpose-built test corpus belongs in samples/.');
  console.error('\n  This is a real failure, not a skip: a guard with no data has');
  console.error('  checked nothing, and must never report success.\n');
  process.exit(1);
}

/* @fn pickOne, the one corpus a `prefer` string names — or a refusal.

   B-168, v3.14.326. This used to be `files.find(f => f.includes(prefer))`: the
   FIRST substring match in a recursive, sorted walk. With
   `LINGCOT_TEST_CORPUS` pointed at a corpora root, `requireCorpus('turkish')`
   returned `archive/turkish_test_corpus_old/…` — 79 words, 8 sentences — rather
   than the live `turkish-test/…` of 153 and 22. No guard was WRONG, because
   their claims are structural; but every number quoted from such a run named a
   corpus it had not read, and this project quotes numbers constantly.

   Two rules, in order, and both are about refusing to guess:

   SHALLOWEST WINS. A fixture set's own corpora sit at its top level; anything
   nested deeper is subordinate to one of them — an archive, a variant, a
   backup. That is structural, not a claim about what the word "archive" means,
   which is the kind of claim `POS_VISIBLE_MORPH` taught this project not to
   make.

   A TIE IS A FAILURE. Two corpora at the same depth both matching is a question
   the caller has not answered, and picking one would be the original defect
   with a different sort order. The message names every candidate and says how
   to disambiguate, because `_fixture.js`'s whole reason for existing is that a
   guard which cannot get its input must fail LOUDLY and ACTIONABLY. */
function pickOne(files, prefer, root) {
  const depth = f => path.relative(root, f).split(path.sep).length;
  const all = files.filter(f => f.includes(prefer));
  if (!all.length) return { hit: null, all };
  const min = Math.min(...all.map(depth));
  const best = all.filter(f => depth(f) === min);
  return { hit: best.length === 1 ? best[0] : null, all, best };
}

/* @fn requireCorpus, absolute path to one corpus file.
   `prefer` names one by substring, shallowest first and never ambiguously.
   Omit it for "any corpus" — declared arbitrary, which is honest for a guard
   whose claim does not depend on which corpus it reads. Passing a string that
   matches every corpus (`'_corpus.jsonl'`) is NOT the way to say that: it reads
   as a choice and resolves as one. */
function requireCorpus(prefer, what) {
  const d = corpusDir();
  if (!d) die(what || 'anything');
  const files = corpusFilesIn(d);
  if (!prefer) return files[0];

  const { hit, all, best } = pickOne(files, prefer, d);
  if (hit) return hit;
  if (!all.length) {
    console.error(`\n  FAIL  no corpus matching ${JSON.stringify(prefer)} in ${d}`);
    console.error(`        found: ${files.map(f => path.basename(f)).join(', ') || '(none)'}\n`);
    process.exit(1);
  }
  console.error(`\n  FAIL  ${JSON.stringify(prefer)} matches ${best.length} corpora in ${d},`);
  console.error('        all at the same depth, so this guard would be reading whichever');
  console.error('        one sorted first — the B-168 defect. Candidates:');
  for (const f of best) console.error(`          ${path.relative(d, f)}`);
  console.error('\n        Point $LINGCOT_TEST_CORPUS at the one you mean, or give');
  console.error('        `prefer` enough of the path to name it.\n');
  process.exit(1);
}

/* @fn requireCorpusOrDisable, like requireCorpus, but exits 2 (DISABLED) rather
   than 1 (FAIL) when the specific corpus this guard was written against is not
   in the fixture set.

   For guards whose assertions are golden values in one language, exact forms
   like '언어학' typed by hand, pointing them at a different corpus is not a
   softer version of the same check, it is a different and meaningless one. The
   honest states are "ran" and "could not run", never "ran against whatever was
   there".

   Exit 2 is tallied by run_all.sh under DISABLED and never as a pass, and the
   reason is printed on every run so the missing coverage stays visible. Nothing
   has to be un-commented to re-enable this: drop a matching corpus into the
   fixture set and the guard runs again. */
function requireCorpusOrDisable(prefer, what, why) {
  const d = corpusDir();
  const files = d ? corpusFilesIn(d) : [];
  /* B-168: the same resolution as requireCorpus. A guard that disables itself
     for want of one corpus must not re-enable itself against a different one —
     that is the ambiguity defect wearing the "it came back!" disguise. An
     ambiguous match here stays DISABLED rather than exiting 1, because the
     honest states for this family are still "ran" and "could not run". */
  const hit = d ? pickOne(files, prefer, d).hit : null;
  if (!hit) {
    console.log(`\n  DISABLED  ${what}`);
    console.log(`            needs a corpus matching ${JSON.stringify(prefer)}; `
              + `fixture set has: ${files.map(f => path.basename(f)).join(', ') || '(none)'}`);
    console.log(`            ${why}`);
    console.log(`            This is NOT a pass. Re-enables itself when the corpus returns.\n`);
    process.exit(2);
  }
  return hit;
}

/* @fn requireCompanion, the dictionary/participants file beside a corpus. */
function requireCompanion(corpusPath, kind) {
  const p = corpusPath.replace(/_corpus\.jsonl$/, `_${kind}.jsonl`);
  if (!fs.existsSync(p)) {
    console.error(`\n  FAIL  ${path.basename(corpusPath)} has no ${kind} companion\n`);
    process.exit(1);
  }
  return p;
}

/* @fn companionsIn, every corpus's companion of one kind, under the fixture dir.

   B-169. `variation_fields_test` built its dictionary list from
   `path.join(ROOT, 'samples')` by hand, so it was the one corpus-reading guard
   that ignored `$LINGCOT_TEST_CORPUS` — and the gate-1 swap rehearsal, which is
   the migration's whole safety, silently did not cover it. A candidate corpus
   with a malformed `variants` or `allomorphs` would have passed the rehearsal
   and failed after the swap, which is the one moment the rehearsal exists for.

   Here rather than in that guard, because "which corpora am I looking at" is
   this module's question and answering it twice is how the two came to disagree.
   Returns [] when the directory has no corpora, so the caller can say what an
   empty walk means for it — for that guard a zero is a broken walk, and it
   checks. Missing companions are SKIPPED, not fatal: a corpus with no dictionary
   is a legitimate state (B-163) and `requireCompanion` is for the guards that
   genuinely need one. */
function companionsIn(kind, dir) {
  const d = dir || corpusDir();
  if (!d) return [];
  return corpusFilesIn(d)
    .map(f => f.replace(/_corpus\.jsonl$/, `_${kind}.jsonl`))
    .filter(p => fs.existsSync(p));
}

/* @fn requireCorpusDir, the directory itself, for guards that walk everything. */
function requireCorpusDir(what) {
  const d = corpusDir();
  if (!d) die(what || 'the corpora on disk');
  return d;
}


/* @fn splitEvents, lift a corpus file's provenance event table out of its
   records — the one line that is not a document.

   Added v3.14.242, after the first corpus saved by a current build broke four
   guards at once. Every guard that reads a corpus file has its own JSONL parse,
   and none of them expected a first line that is not a document, because
   `samples/` has never had one: it predates interning. So they took the event
   table for the document and read `.sections` off it.

   That is the fixture-is-weaker-than-the-guards problem (L-007) arriving from
   the other direction, and it is exactly what gate 1's fixture swap would have
   hit. One helper, so the next format record is handled in one place. */
function splitEvents(records) {
  const items = [], events = [], format = [];
  for (const r of records || []) {
    if (isDocument(r)) { items.push(r); continue; }
    format.push(r);
    if (r && r.record_type === 'prov_events') events.push(...(r.events || []));
  }
  return { items, events, format };
}

/* @fn isDocument, what counts as a corpus document rather than a format record.

   v3.14.245, B-128: naming the format records one by one is how the suite got
   here. `prov_events` was added to the file format and eleven guards each
   decided for themselves what a first line was. The test is now positive —
   a document declares itself, or it has sections — so an unrecognised record
   is treated as format and stays out of the tree walk, whatever it is called.

   `sections` is kept as an alternative because the `record` declaration
   B-119 plans for every row has not been written yet, and the shipped
   `samples/` corpora predate it. */
function isDocument(r) {
  if (!r || typeof r !== 'object') return false;
  /* D58 §3, v3.14.386: a document DECLARES itself, and the shape fallback that
     used to answer for undeclared files is gone.

     The fallback's own comment named its two producers: files the app saved
     before v3.14.248, and `corpus_ingest.py` output "from an older build". The
     first became a closed set the moment `samples/` was regenerated at
     v3.14.384 — that comment said "until it is regenerated", and it has been —
     and the second is not what the shipped CLI writes: it emits
     `record_type: "document"`, which `dev/tests/fixtures/cli_ingested/` exists
     to keep true.

     Telling rows apart by what they LACK is how the provenance event table broke
     four guards at once (B-128). This is the same argument one step further: a
     negative test is not improved by being a fallback. */
  return (r.record_type || r.record) === 'document';
}


/* @fn parseRecords, one JSONL parse for the whole suite.

   ONE shape, because one shape is written: one JSON object per line.

   D58 §3, v3.14.386: this used to try three, falling back to a single
   pretty-printed object and then to a brace scan over concatenated objects.
   Asked who writes those — nobody. The app writes JSONL; `corpus_ingest.py`
   writes JSONL; the only `json.dumps(indent=2)` in the scripts writes
   `corpus_annotate.py`'s CURSOR file, which is not a corpus and is never read
   through here. The brace scan was carried into this file from private copies
   in the search guards, and it protected a shape none of them had either.

   A file that is not JSONL is a FAILURE, not an empty result — `dep_root_test`
   used to swallow the error and walk zero documents, which is the failure mode
   that matters and the one thing kept from the old version. */
function parseRecords(raw, file) {
  const lines = raw.split('\n').filter(l => l.trim());
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    try { out.push(JSON.parse(lines[i])); }
    catch (e) {
      console.error(`\n  FAIL  ${file || 'corpus'} is not JSONL: line ${i + 1} does not parse`);
      console.error(`        ${e.message}\n`);
      process.exit(1);
    }
  }
  if (!out.length) {
    console.error(`\n  FAIL  ${file || 'corpus'} parsed to zero records\n`);
    process.exit(1);
  }
  return out;
}

/* @fn loadCorpus, B-128: the one place a guard reads a corpus file.

   Thirteen guards each had their own parse, and none of them expected a first
   line that is not a document. B-128 filed the count as eleven; two more
   turned up during the work, in `cli_schema_test` and `variation_fields_test`. A corpus written since interning opens with a
   `prov_events` record, and four guards broke on the first such file the suite
   ever saw. `splitEvents` fixed three of them; this fixes the shape rather than
   the instance, so the NEXT format record is handled in one place.

   Returns:
     .records  every record as written, event table included — for guards that
               feed the app's own loaders, which expect the real file
     .items    documents only, every format line lifted out — for guards that
               walk the tree themselves
     .format   the lifted format records, whatever they turn out to be
     .events   the provenance event table, flattened
     .raw      the file text, for guards asserting on bytes */
function loadCorpus(file, what, _isCorpus = true) {
  if (!fs.existsSync(file)) {
    console.error(`\n  FAIL  no such corpus file: ${file}` + (what ? ` (needed for ${what})` : '') + '\n');
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const records = parseRecords(raw, path.basename(file));
  const { items, events, format } = splitEvents(records);
  if (_isCorpus) noteUnknownFormat(format, path.basename(file));
  return { raw, records, items, events, format, path: file };
}

/* @fn noteUnknownFormat, say so when a lifted record is one nobody declared.

   Lifting unknown records keeps the tree walks correct, but done silently it
   would also hide a stray line — a half-written append, a stale journal record
   pasted in — as "some format thing". So a record_type this file has not been
   told about is printed once per run. Corpus files only: in a dictionary or a
   participants file nothing is a document, so every record would be reported. It is a NOTE, not a failure: the guard
   that owns the format is the one that should fail, not every guard that reads
   a file. */
const KNOWN_FORMAT = new Set(['prov_events']);
const _noted = new Set();
function noteUnknownFormat(format, file) {
  for (const r of format || []) {
    const kind = (r && (r.record_type || r.record)) || '(no record_type)';
    if (KNOWN_FORMAT.has(kind) || _noted.has(kind)) continue;
    _noted.add(kind);
    console.log(`  NOTE  ${file} carries an undeclared non-document record `
              + `"${kind}"; it was lifted out of the document list. `
              + `Add it to KNOWN_FORMAT in _fixture.js once it is part of the format.`);
  }
}

/* @fn loadCompanion, the same parse for a dictionary or participants file.

   Read `.items` for the entries and `.format` for the format lines. `.records`
   is still everything, which several guards want.

   The split is by a DIFFERENT rule than a corpus's, and it has to be: in a
   dictionary nothing is a document, so "is it a document" answers no for every
   row. Here the rule is the narrow one — a record whose `record_type` is a
   known format type is a format line, and everything else is content.

   v3.14.247: the dictionary gained its first format line at D50 stage 4b, when
   `prov` interning gave it an event table. Until then it had none, so
   `field_spec_test` read the table as a dictionary entry and reported its
   `events` key as an undeclared field. Found by running the suite against a
   corpus the new serializer had written, which is the check B-128 exists to
   make cheap. */
function loadCompanion(file, what) {
  const r = loadCorpus(file, what, false);
  const items = [], format = [];
  for (const rec of r.records) {
    if (rec && KNOWN_FORMAT.has(rec.record_type)) format.push(rec);
    else items.push(rec);
  }
  return { ...r, items, format };
}

module.exports = { corpusDir, corpusFilesIn, companionsIn, pickOne, requireCorpus,
                   requireCorpusOrDisable, splitEvents, requireCompanion, requireCorpusDir,
                   parseRecords, loadCorpus, loadCompanion, isDocument };
