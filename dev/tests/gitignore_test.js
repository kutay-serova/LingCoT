#!/usr/bin/env node
/* =============================================================================
   gitignore_test.js, what git ACTUALLY ignores, asked of git
   Run:  node dev/tests/gitignore_test.js
   =============================================================================
   Found at v3.14.153, while testing the git-init gate rather than reading it:
   **git does not support a trailing comment on a pattern line.**

       source/models/  # downloaded model weights

   is the literal pattern `source/models/  # downloaded model weights`, and it
   matches nothing. Every commented line in this project's .gitignore was inert,
   including the two that keep **601 MB of CC-BY-NC model weights** and 103 MB of
   developer history out of a repository that is about to be public. The first
   commit would have carried both, and LICENSE.txt's claim that the weights are
   not distributed would have become false on contact.

   `license_assets_test.js` PARSED this file to decide an asset was "declared as
   not distributed", so it was trusting patterns git itself discards. A guard
   that reads a config format is guessing at the tool's behaviour.

   THE RULE: ask git. This runs `git check-ignore` against a scratch repository
   holding the real .gitignore, so what is asserted is what git does.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, disabled } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\nwhat git actually ignores\n');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-ignore-'));
const git = (...a) => execFileSync('git', ['-C', tmp, ...a], { stdio: 'pipe' });
try {
  git('init', '-q', '.');
} catch (e) {
  fs.rmSync(tmp, { recursive: true, force: true });
  disabled('git is not available here', String(e.message).slice(0, 140));
}
fs.copyFileSync(path.join(ROOT, '.gitignore'), path.join(tmp, '.gitignore'));

/* check-ignore needs no file on disk, it answers about a PATH. */
const ignored = p => {
  try { git('check-ignore', '-q', '--no-index', p); return true; }
  catch { return false; }
};

/* [path, shouldBeIgnored, why it matters if wrong] */
const CASES = [
  ['source/models/nllb/model.bin',   true,  '601 MB of CC-BY-NC weights in an MIT repo; LICENSE.txt says they are not distributed'],
  ['dev/archive/changes/x/y.html',   true,  '103 MB of pre-edit snapshots'],
  ['dev/_to_delete/old.md',          true,  'staged for deletion, not for publication'],
  ['dev/BUGS.html',                  true,  'a stale pandoc render of BUGS.md; git init would put 1.3 MB of out-of-date duplicates of the source-of-truth documents into history permanently'],
  ['dev/DEV_PLAN.html',              true,  'ditto, and its newest version reference is v3.14.99'],
  ['.venv/bin/python',               true,  'a virtualenv'],
  ['source/__pycache__/x.pyc',       true,  'bytecode'],
  ['annotator_config.json',          true,  'machine-specific tuning'],
  ['source/config/annotator_config.json', true, 'the directory holds only that file'],
  ['x.cursor',                       true,  'annotation resume state'],
  ['logs/app_2026.log',              true,  'session logs carry an absolute home path'],
  ['logs/stray.txt',                 true,  'ignored as a directory, so a non-.log file cannot slip in'],
  ['LingCoT-v1-setup-test.zip',      true,  'build artefacts belong in dev/archive/packaging/'],
  ['.DS_Store',                      true,  'OS noise'],

  ['samples/turkish-test/turkish-test_corpus.jsonl.b105-bak', true,
   'B-156: `*.b105-bak` is ignored everywhere EXCEPT under samples/, where `!samples/**` '
 + 'out-ranked it — three backups, 72 KB, two versions of one fixture with the known-wrong '
 + 'one included. The negation is broader than its purpose and only a path test shows it'],
  ['samples/turkish-test/turkish-test_participants.jsonl.b105-bak', true,
   'the same, on the file that carries the names — 4 occurrences of them'],
  ['fieldwork_participants.jsonl',   true,  'REAL PEOPLE: names, affiliations, contact details'],
  ['a/b/my_corpus.jsonl',            true,  'recorded speech, collected under consent'],
  ['my_dictionary.jsonl',            true,  'a corpus companion'],

  // …and the things that MUST ship.
  ['samples/turkish-test/turkish-test_participants.jsonl', false, 'the synthetic fixture the guards run against'],
  ['samples/turkish-test/turkish-test_corpus.jsonl',       false, 'ditto'],
  ['samples/turkish-test/turkish-test_dictionary.jsonl',   false, 'ditto'],
  /* B-205, v3.14.389: the SAME defect as B-156, one directory over. The
     purpose-built specimens under `dev/tests/fixtures/` carry the names the
     producers write — `cli-ingested_corpus.jsonl` is what `corpus_ingest.py`
     emits and what the loader resolves — so `*_corpus.jsonl` caught it and the
     first commit would have shipped a guard that fails on a fresh clone.
     `prov_intern_test` asserts the file exists and fails when it does not, which
     is correct, and would have been a cloner's first impression of the project. */
  ['dev/tests/fixtures/cli_ingested/cli-ingested_corpus.jsonl', false,
   'B-205: the CLI specimen prov_intern_test needs; without it a clone fails on its first run'],
  ['dev/tests/fixtures/cli_ingested/README.md', false, 'how to regenerate it'],
  /* …and the negation must not become a hole. A corpus is ignored everywhere
     else, including one directory up from the fixtures. */
  ['dev/tests/other_corpus.jsonl', true,
   'the negation is scoped to the fixture directory, not to dev/tests/'],
  ['dev/tests/fixtures/cli_ingested/x.jsonl.b105-bak', true,
   'and a repair backup stays out even inside it, the way it does under samples/'],
  ['README.md',                      false, 'the landing page'],
  ['source/LingCoT.html',            false, 'the application — the reason dev/*.html is scoped and not a bare *.html'],
  ['dev/tests/fixtures/x.html',      false, 'only dev/*.html itself is stale output; a guard fixture below it is input'],
  ['dev/tests/run_all.sh',           false, 'the guard suite ships (B-074)'],
  ['dev/PRACTICES.md',               false, 'the development record ships'],
  ['docs/images/sentence-view.png',  false, 'the README embeds it'],
  ['hooks/pre-commit',               false, 'the hook must be in the repo to be installable'],
  ['logs/.gitkeep',                  false, 'keeps the logs directory'],
];

for (const [p, want, why] of CASES) {
  const got = ignored(p);
  check(got === want,
        `${want ? 'ignored ' : 'tracked '} ${p}`,
        `         got ${got ? 'IGNORED' : 'tracked'} — ${why}`);
}

console.log('\nno pattern carries a trailing comment\n');
{
  /* The defect itself, as a rule. A pattern line with a `#` after it is almost
     never intended literally, and git will not warn. */
  const lines = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n');
  const bad = lines
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => l.trim() && !l.trim().startsWith('#') && /\s#/.test(l))
    .map(([n, l]) => `         ${n}: ${l.trim()}`);
  check(bad.length === 0, 'every pattern line is a bare pattern',
        bad.join('\n') + '\n         git reads the comment as part of the pattern, so the line matches nothing');
}

/* ═══════════════════════════════════════════════════════════════════════════
   B · the hook and .gitignore are two writers of ONE rule — B-206, v3.14.392
   ═══════════════════════════════════════════════════════════════════════════
   Everything above asks git what it ignores. That is half the rule. The other
   half is `hooks/pre-commit`, which refuses fieldwork that .gitignore let past,
   and the two carry SEPARATE lists of which cleared data may ship.

   They disagreed, and the disagreement surfaced at the worst available moment:
   **the first commit of the project was refused.** `dev/tests/fixtures/` was
   created at v3.14.386 and re-admitted to .gitignore at v3.14.389 (B-205); the
   hook still named `samples/` alone, so `cli-ingested_corpus.jsonl` was tracked
   by git and refused by the hook.

   This section EXECUTES the real hook — it does not read it. A hook is a
   program, its rules are `case` patterns, and a guard that greps for
   `dev/tests/fixtures` would pass against a file that never runs (PRACTICES §6,
   and the trailing-comment defect at the top of this file is what reading a
   config format buys you).

   The asymmetry in section 1 is deliberate and asserted below: a participants
   file is exempt under `samples/` only. STRICTER than .gitignore fails safe;
   looser is what B-206 was. */
console.log('\nthe hook and .gitignore agree about what may ship\n');
{
  const HOOK = path.join(ROOT, 'hooks', 'pre-commit');
  /* Stage a path in the scratch repo and run the real hook over it. `add -f`
     because several of these are ignored by design — the question is what the
     hook does once something IS staged, which is the only moment it runs. */
  const hookAccepts = (p) => {
    fs.mkdirSync(path.join(tmp, path.dirname(p)), { recursive: true });
    fs.writeFileSync(path.join(tmp, p), '');
    git('add', '-f', p);
    const r = require('child_process').spawnSync('bash', [HOOK],
      { cwd: tmp, encoding: 'utf8' });
    git('rm', '-q', '--cached', p);
    fs.rmSync(path.join(tmp, p), { force: true });
    return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
  };

  /* [path, hook must accept, why it matters if wrong] */
  const HOOK_CASES = [
    ['samples/turkish-test/turkish-test_corpus.jsonl', true,
     'the shipped fixture the whole guard suite runs against'],
    ['samples/turkish-test/turkish-test_participants.jsonl', true,
     'synthetic, and section 1 exempts samples/ by path'],
    ['dev/tests/fixtures/cli_ingested/cli-ingested_corpus.jsonl', true,
     'B-206 itself: .gitignore admits it and the hook refused it, so the first commit failed'],
    ['corpora/turkish-test/turkish-test_corpus.jsonl', false,
     'real fieldwork; refusing this is the hook\'s entire purpose'],
    ['dev/tests/fixtures/x_participants.jsonl', false,
     'the deliberate asymmetry: no fixture needs one, and stricter than .gitignore fails safe'],
    ['scratch/notes_dictionary.jsonl', false, 'a dictionary outside both cleared locations'],
    ['logs/session_2026-09-02.log', false, 'session logs carry an absolute home directory'],
  ];
  for (const [p, want, why] of HOOK_CASES) {
    const r = hookAccepts(p);
    check(r.ok === want,
          `hook ${want ? 'accepts' : 'REFUSES'} ${p}`,
          `         got ${r.ok ? 'accepted' : 'refused'} — ${why}\n`
        + `         hook said: ${r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 160)}`);
  }

  /* The property, rather than a list someone has to remember to extend: every
     path in the REAL repository that git would commit and that matches one of
     the hook's dangerous shapes must be one the hook accepts. This is the check
     that would have caught B-206 without anyone naming the file. */
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = d === '.' ? e.name : `${d}/${e.name}`;
      if (e.name === '.git' || e.name === 'dev' && false) continue;
      if (e.isDirectory()) { if (!ignored(rel + '/')) walk(rel, out); }
      else if (!ignored(rel)) out.push(rel);
    }
    return out;
  };
  const DANGEROUS = /(_corpus\.jsonl|_dictionary\.jsonl|_participants\.jsonl)$|^logs\/.*\.log$/;
  const shipping = walk('.').filter(p => DANGEROUS.test(p));
  const refused = shipping.filter(p => !hookAccepts(p).ok);
  check(shipping.length > 0, 'the sweep found data files to check at all',
        '         a sweep that matches nothing passes for the wrong reason (PRACTICES §7)');
  check(refused.length === 0,
        `every one of the ${shipping.length} data file(s) git would commit is one the hook allows`,
        `         refused: ${refused.join(', ')}\n`
      + '         .gitignore and hooks/pre-commit disagree; that is B-206 again');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
