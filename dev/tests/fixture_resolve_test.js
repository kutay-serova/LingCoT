#!/usr/bin/env node
/* =============================================================================
   fixture_resolve_test.js. B-168 — which corpus a guard actually reads
   Run:  node dev/tests/fixture_resolve_test.js
   =============================================================================
   The resolver is the one piece of the suite that decides what every other
   piece is measuring, and until v3.14.326 it decided by `Array.find` over a
   sorted recursive walk. `requireCorpus('turkish')` against a corpora root
   returned an ARCHIVED corpus — 79 words where the live one has 153 — and no
   guard failed, because their claims are structural. What was wrong was every
   NUMBER quoted from such a run.

   So this guard is about resolution and nothing else. It builds trees on disk
   rather than stubbing `fs`, because the defect lived in the interaction of a
   recursive walk, a sort and a substring, and a stub of any one of those is a
   stub of the thing under test.

   It also pins the gate-1 fixture swap: `samples/` is about to be replaced by
   the new turkish and chinese corpora, and the migration's whole risk is that a
   guard silently reads a different file afterwards. The final block asserts what
   the swapped layout must resolve to, and fails NOW if the layout it describes
   would be ambiguous — which is the point of writing it before the swap.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { pickOne } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(`         ${detail}`); }
};

/* A fixture set on disk, given as relative corpus paths. Real directories: the
   bug was in how a walk, a sort and a substring compose. */
function tree(rels) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-fx-'));
  for (const r of rels) {
    const p = path.join(root, r);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '{"record_type":"document","id":"d","sections":[]}\n');
  }
  return root;
}
const files = root => {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/_corpus\.jsonl$/.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out.sort();
};
const rel = (root, f) => f && path.relative(root, f);
const cleanup = [];
const build = rels => { const r = tree(rels); cleanup.push(r); return r; };

/* ── the defect, exactly as it was reported ──────────────────────────────────── */
console.log('\nthe archived twin');
{
  /* Sorted, `archive/…` precedes `turkish-test/…`, which is why the old
     `.find()` returned it. Both contain "turkish". */
  const root = build([
    'archive/turkish_test_corpus_old/turkish_test_corpus_corpus.jsonl',
    'turkish-test/turkish-test_corpus.jsonl',
  ]);
  const all = files(root);
  check(all[0].includes('archive'),
        'the archived copy still sorts first — the condition that produced B-168',
        all.map(f => rel(root, f)).join('  '));

  const { hit } = pickOne(all, 'turkish', root);
  check(rel(root, hit) === path.join('turkish-test', 'turkish-test_corpus.jsonl'),
        'and "turkish" now resolves to the live corpus, not the archived one',
        `got ${rel(root, hit)}`);
}

/* ── the rule, not the instance ──────────────────────────────────────────────── */
console.log('\nshallowest wins');
{
  const root = build([
    'turkish-test/turkish-test_corpus.jsonl',
    'turkish-test/backups/2026-01/turkish-test_corpus.jsonl',
    'aaa-deep/aaa/aaa/turkish-test_corpus.jsonl',
  ]);
  const { hit } = pickOne(files(root), 'turkish', root);
  check(rel(root, hit) === path.join('turkish-test', 'turkish-test_corpus.jsonl'),
        'a nested backup does not win, whatever it is called or how it sorts',
        `got ${rel(root, hit)}`);
}

console.log('\na tie is a refusal');
{
  const root = build([
    'turkish-test/turkish-test_corpus.jsonl',
    'turkish-pilot/turkish-pilot_corpus.jsonl',
  ]);
  const { hit, best } = pickOne(files(root), 'turkish', root);
  check(hit === null && best.length === 2,
        'two corpora at the same depth is unanswered, so nothing is chosen',
        `hit=${rel(root, hit)}`);
  /* The refusal has to be usable, or it is just a different silence. */
  const { hit: narrowed } = pickOne(files(root), 'turkish-test', root);
  check(rel(narrowed && root, narrowed) === path.join('turkish-test', 'turkish-test_corpus.jsonl'),
        'and a longer `prefer` resolves it — the message tells you to do this',
        `got ${rel(root, narrowed)}`);
}

console.log('\nno match');
{
  const root = build(['turkish-test/turkish-test_corpus.jsonl']);
  const { hit, all } = pickOne(files(root), 'korean', root);
  check(hit === null && all.length === 0,
        'an absent corpus is absent — requireCorpusOrDisable\'s case, not a near miss');
}

/* ── the gate-1 swap, pinned before it happens ───────────────────────────────── */
console.log('\nthe fixture swap (gate 1)');
{
  /* What `samples/` becomes: the two live corpora, replacing the single one
     shipped today. Every `prefer` string in the suite is asserted against it. */
  const root = build([
    'turkish-test/turkish-test_corpus.jsonl',
    'chinese-test/chinese-test_corpus.jsonl',
  ]);
  const all = files(root);
  for (const [prefer, want] of [
    ['turkish', 'turkish-test/turkish-test_corpus.jsonl'],
    ['chinese', 'chinese-test/chinese-test_corpus.jsonl'],
  ]) {
    const { hit } = pickOne(all, prefer, root);
    check(rel(root, hit) === want.split('/').join(path.sep),
          `after the swap, ${JSON.stringify(prefer)} resolves to ${want}`,
          `got ${rel(root, hit)}`);
  }
  /* The string three journal guards used to pass. It matches BOTH corpora at the
     same depth, so under the new rule it is a refusal — which is why they were
     changed to `requireCorpus(null, …)`, "any corpus", declared rather than
     disguised as a choice. This asserts the trap is still a trap. */
  const { hit } = pickOne(all, '_corpus.jsonl', root);
  check(hit === null,
        '"_corpus.jsonl" is not a way to say "any corpus" — it matches both and refuses');
}

/* ── every prefer string the suite actually uses ─────────────────────────────── */
console.log('\nthe suite\'s own prefer strings');
{
  const dir = path.join(__dirname);
  const used = new Set();
  for (const f of fs.readdirSync(dir).filter(f => /_test\.js$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/require(?:Corpus|CorpusOrDisable)\(\s*'([^']+)'/g))
      used.add(m[1]);
  }
  /* A new `prefer` string appearing here without a line in this guard is how the
     swap gets missed: the migration is not "edit samples/", it is "every string
     that names a corpus still names the one it meant". */
  const known = new Set(['turkish', 'chinese', 'korean']);
  const strays = [...used].filter(u => !known.has(u));
  check(strays.length === 0,
        `all ${used.size} prefer string(s) in the suite are ones this guard checks`,
        `unchecked: ${strays.join(', ')} — add them here and to the swap block above`);
}

/* ═══ B-169 · every corpus-reading guard goes through the resolver ══════════
   The swap rehearsal points `$LINGCOT_TEST_CORPUS` at a candidate corpus and
   runs the suite. That is the migration's entire safety, and it is worth exactly
   as much as the number of guards it actually redirects.

   `variation_fields_test` built its dictionary list from `path.join(ROOT,
   'samples')` by hand, so the rehearsal validated the SHIPPED dictionaries
   whatever it was pointed at — a candidate with a malformed `variants` or
   `allomorphs` passed the rehearsal and would have failed after the swap, at
   the one moment the rehearsal exists to prevent.

   DERIVED, and that is the whole point of putting it here rather than fixing
   the one file: any guard that reaches for `samples/` by name has opted out of
   the resolver, and the next one to do it fails here. `_fixture.js` is exempt —
   it is the resolver, and `samples/` is one of its candidates. */
console.log('\nB-169 — no guard reaches past the resolver to samples/\n');
{
  const dir = __dirname;
  const offenders = [];
  /* ONE NAMED EXCLUSION: this file. It is the scanner, so it carries the
     pattern as a regex literal and again in its own failure message, and the
     first run of this check reported ITSELF — a guard matching its own prose,
     which this project has now done in four separate files. Excluded by name
     rather than by loosening the pattern, because a looser pattern is how the
     next real offender gets missed. `_fixture.js` is not scanned at all: it is
     not a `_test.js`, and `samples/` is one of its candidates by design. */
  const SCANNER = path.basename(__filename);
  for (const f of fs.readdirSync(dir).filter(n => /_test\.js$/.test(n)).sort()) {
    if (f === SCANNER) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    /* The shape, not the string: a guard may NAME samples/ in prose, and
       several explain the swap at length. What is not allowed is building a
       path to it. */
    const hits = [...src.matchAll(/path\.join\(\s*ROOT\s*,\s*['"]samples['"]/g)];
    if (hits.length) offenders.push(`         ${f} — ${hits.length} hand-built path(s)`);
  }
  check(offenders.length === 0,
        'no guard builds a path to samples/ itself',
        offenders.join('\n')
      + '\n         ask _fixture.js instead (corpusDir, corpusFilesIn,\n'
      + '         companionsIn, requireCorpus) — a guard that names the\n'
      + '         directory cannot be redirected, and the swap rehearsal is\n'
      + '         worth the guards it redirects and no more');

  /* And the helper that replaced the hand walk answers the same question the
     resolver does — one directory, one answer. */
  const { companionsIn, corpusDir } = require('./_fixture.js');
  const here = corpusDir();
  check(typeof companionsIn === 'function', '_fixture exports companionsIn');
  if (here) {
    const dicts = companionsIn('dictionary');
    check(dicts.every(p => p.startsWith(here)),
          `every companion it returns is under the resolved dir (${dicts.length})`,
          `         resolved: ${here}\n         got: ${dicts.join(', ')}`);
    check(dicts.every(p => /_dictionary\.jsonl$/.test(p)),
          'and is the kind that was asked for');
  }
  /* A directory with no corpora returns nothing rather than throwing: the
     caller decides what an empty walk means, and for `variation_fields_test`
     zero is a broken walk, which it checks for itself. */
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-empty-'));
  cleanup.push(empty);
  check(companionsIn('dictionary', empty).length === 0,
        'an empty directory yields no companions and does not throw');

  /* A CORPUS WITH NO DICTIONARY is a legitimate state — B-163 is unreachable
     once a corpus has been annotated once, which is why D58 wants an empty one
     in the specimen set. So a missing companion is SKIPPED, not returned and
     not fatal, and the only way to assert that is a tree where one is missing.
     Dropping the existence filter changed nothing against the live corpora,
     where every corpus has a dictionary — this is the fixture that catches it. */
  const mixed = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-mixed-'));
  cleanup.push(mixed);
  for (const n of ['alpha', 'beta']) fs.mkdirSync(path.join(mixed, n));
  fs.writeFileSync(path.join(mixed, 'alpha', 'alpha_corpus.jsonl'), '{"id":"a","sections":[]}');
  fs.writeFileSync(path.join(mixed, 'alpha', 'alpha_dictionary.jsonl'), '{"id":"e1","form":"x"}');
  fs.writeFileSync(path.join(mixed, 'beta', 'beta_corpus.jsonl'), '{"id":"b","sections":[]}');
  const got = companionsIn('dictionary', mixed);
  check(got.length === 1 && /alpha_dictionary\.jsonl$/.test(got[0]),
        'a corpus with no dictionary is skipped, not returned',
        `         got ${JSON.stringify(got.map(x => path.basename(x)))} — returning a\n`
      + '         path that does not exist hands the caller a read that throws,\n'
      + '         and refusing outright would make an empty dictionary fatal');
}

/* -- D58 section 3, v3.14.386: one shape, and an unreadable file FAILS -----
   `parseRecords` used to try three shapes: JSONL, one pretty-printed object,
   then a brace scan over concatenated objects. The last two had no writer.
   Deleting them leaves one property that must NOT go with them, and it is the
   older and more important one: **a file that does not parse is a failure, not
   an empty result.** `dep_root_test` once swallowed the error and reported "0
   root tokens across 0 corpus files" as a pass, which is the bug this loader
   exists to make impossible.

   Run in a child process, because the failure IS `process.exit(1)` and a guard
   cannot assert on its own death. */
{
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-parse-'));
  const probe = (name, text) => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, text, 'utf8');
    const r = require('child_process').spawnSync(process.execPath, ['-e',
      `const {parseRecords}=require(${JSON.stringify(path.join(__dirname, '_fixture.js'))});`
    + `const fs=require('fs');const rows=parseRecords(fs.readFileSync(${JSON.stringify(p)},'utf8'),'probe');`
    + `console.log('ROWS='+rows.length);`], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };

  const ok = probe('good.jsonl', '{"record_type":"document","id":"d1"}\n{"record_type":"document","id":"d2"}\n');
  check(ok.code === 0 && /ROWS=2/.test(ok.out), 'JSONL parses, two rows',
        `         exit ${ok.code}: ${ok.out.trim().slice(0, 120)}`);

  const pretty = probe('pretty.json', '{\n  "record_type": "document",\n  "id": "d1"\n}\n');
  check(pretty.code === 1,
        'a pretty-printed object is REFUSED, not silently accepted',
        '         nothing writes that shape; accepting it is how a hand-edited file becomes\n'
      + '         a fixture nobody meant to ship');

  const torn = probe('torn.jsonl', '{"record_type":"document","id":"d1"}\n{"record_type":"docum\n');
  check(torn.code === 1, 'and so is a file with one unreadable line',
        '         skipping the bad line and returning the rest is how a guard walks\n'
      + '         half a corpus and calls it a pass');
  check(/is not JSONL: line 2/.test(torn.out), 'and the failure says WHICH line',
        `         got: ${torn.out.trim().slice(0, 160)}`);

  const empty = probe('empty.jsonl', '\n\n  \n');
  check(empty.code === 1, 'an empty file is a failure, not zero records',
        '         "0 root tokens across 0 corpus files" was reported as a pass once');
  fs.rmSync(tmp, { recursive: true, force: true });
}

for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
