#!/usr/bin/env node
/* =============================================================================
   change_files_test.js, versioning on a branch: change files, labels, release
   Run:  node dev/tests/change_files_test.js
   =============================================================================
   v3.14.412. On main, new_version.py assigns a number when a change starts. On
   any other branch it writes dev/changes/<slug>.md instead, labels the build
   `<base>+<slug>`, and --release numbers the change files at the stage
   boundary. PRACTICES.md §1 has the reasons.

   Runs the real script and the real commit hook in a throwaway repository, so
   nothing here touches this checkout's history.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, disabled } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\nchange files on a branch, numbered at release\n');

try { execFileSync('git', ['--version'], { stdio: 'pipe' }); }
catch { disabled('git is not installed', 'the branch path asks git which branch it is on'); }

// ── a minimal project: the files new_version.py reads and stamps ───────────
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-changes-'));
const w = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(T, rel)), { recursive: true });
                          fs.writeFileSync(path.join(T, rel), txt); };
const r = rel => fs.readFileSync(path.join(T, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(T, rel));

w('dev/DEV_PLAN.md', '# Plan\n**Updated:** 2026-01-01 · **Version:** v3.14.1\n');
w('dev/BUGS.md',     '# Bugs\n**Updated:** 2026-01-01 · **Version:** v3.14.1\n\n| **B-001** | S3 | pending:d40a-index | a bug |\n');
w('dev/edit_log.md', '# Log\n**Updated:** 2026-01-01 · **Version:** v3.14.1\n\n---\n\n'
                   + '## First (2026-01-01)\n**Version:** v3.14.1 · **Type:** chore · **Archives:** none\n'
                   + '**Touched:** — documentation only\n\n---\n');
w('source/version.py', '__version__ = "3.14.1"\n');
w('source/app.txt', 'one\n');
fs.mkdirSync(path.join(T, 'dev', 'archive', 'changes'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'dev', 'new_version.py'), path.join(T, 'dev', 'new_version.py'));
fs.mkdirSync(path.join(T, 'hooks'));
fs.copyFileSync(path.join(ROOT, 'hooks', 'prepare-commit-msg'), path.join(T, 'hooks', 'prepare-commit-msg'));
fs.chmodSync(path.join(T, 'hooks', 'prepare-commit-msg'), 0o755);

const git = (...a) => execFileSync('git', ['-C', T, ...a], { encoding: 'utf8', stdio: 'pipe' });
const nv  = (...a) => spawnSync('python3', [path.join(T, 'dev', 'new_version.py'), ...a],
                                { cwd: T, encoding: 'utf8' });
const version = () => (/__version__ = "([^"]*)"/.exec(r('source/version.py')) || [])[1];
const subject = () => git('log', '-1', '--format=%s').trim();

git('init', '-q');
git('config', 'user.email', 'test@example.invalid');
git('config', 'user.name', 'test');
git('config', 'core.hooksPath', 'hooks');
fs.writeFileSync(path.join(T, '.gitignore'), 'dev/archive/\n');
git('add', '-A'); git('commit', '-q', '-m', 'base');
git('branch', '-M', 'main');

try {
  // ── 1. on a branch, a change file instead of a number ─────────────────────
  git('switch', '-q', '-c', 'feat');
  let res = nv('--type', 'feature', 'd40a-index', 'source/app.txt');
  check(res.status === 0, 'starting a change on a branch succeeds', res.stderr);
  check(exists('dev/changes/d40a-index.md'), 'it writes dev/changes/d40a-index.md');
  check(/\*\*Version:\*\* pending/.test(r('dev/changes/d40a-index.md')),
        'the change file says **Version:** pending');
  check(version() === '3.14.1+d40a-index', `the build is labelled (${version()})`);
  check(/v3\.14\.1\b/.test(r('dev/DEV_PLAN.md')) && !/v3\.14\.2/.test(r('dev/edit_log.md')),
        'no version is assigned and no doc is stamped');
  check(exists('dev/archive/changes/d40a-index/app_pre_d40a-index.txt'),
        'the pre-edit copy is archived under the slug');

  res = nv('--type', 'feature', 'a-slug-that-is-far-too-long');
  check(res.status !== 0, 'a slug too long to be a build label is refused');

  // ── 2. commits carry the label ────────────────────────────────────────────
  w('source/app.txt', 'two\n');
  git('add', '-A'); git('commit', '-q', '-m', 'index');
  check(subject() === '[d40a-index] — index', `the hook prefixes the label (${subject()})`);

  // ── 3. a second change on the same branch ─────────────────────────────────
  res = nv('--type', 'feature', 'd40b-prefill', 'source/app.txt');
  check(/\*\*Order:\*\* 2/.test(r('dev/changes/d40b-prefill.md')), 'the second change is Order 2');
  check(version() === '3.14.1+d40b-prefill', 'and the label moves to it');
  w('source/app.txt', 'three\n');
  git('add', '-A'); git('commit', '-q', '-m', 'prefill');
  check(subject() === '[d40b-prefill] — prefill', 'its commits carry its own label');

  // B-213: a version named inside the subject is not a stamp.
  w('source/app.txt', 'three-b\n');
  git('add', '-A'); git('commit', '-q', '-m', 'planned as v3.15.0');
  check(subject() === '[d40b-prefill] — planned as v3.15.0', `a version in the text still gets the stamp (${subject()})`);
  git('commit', '-q', '--amend', '-m', subject());
  check(subject() === '[d40b-prefill] — planned as v3.15.0', 'an amend does not stamp twice');

  // ── 4. release refuses untitled entries ───────────────────────────────────
  res = nv('--release');
  check(res.status !== 0 && /title/.test(res.stderr + res.stdout),
        'release refuses while an entry is still titled TITLE');

  for (const s of ['d40a-index', 'd40b-prefill'])
    w(`dev/changes/${s}.md`, r(`dev/changes/${s}.md`).replace(/^## TITLE/, `## Stage ${s}`));

  // ── 5. release numbers in order, newest first ─────────────────────────────
  res = nv('--release');
  check(res.status === 0, 'release succeeds', res.stderr);
  const log = r('dev/edit_log.md');
  // ' ·' skips the header stamp, which also reads v3.14.3 after release.
  const iB = log.indexOf('**Version:** v3.14.3 ·'), iA = log.indexOf('**Version:** v3.14.2 ·');
  check(iA > 0 && iB > 0 && iB < iA, 'd40b-prefill is v3.14.3 above d40a-index v3.14.2');
  check(/## Stage d40a-index[\s\S]*?\*\*Change:\*\* `d40a-index`/.test(log) && !/\*\*Order:\*\*/.test(log),
        'released entries keep **Change:** and drop **Order:**');
  check(version() === '3.14.3', `version.py is the final number, unlabelled (${version()})`);
  check(/\*\*Version:\*\* v3\.14\.3/.test(r('dev/DEV_PLAN.md')) && /\*\*Version:\*\* v3\.14\.3/.test(r('dev/BUGS.md')),
        'the docs are stamped once, to the final number');
  check(/\| \*\*B-001\*\* \| S3 \| v3\.14\.2 \|/.test(r('dev/BUGS.md')),
        'a bug fixed in pending:<slug> gets that change\'s version');
  check(!exists('dev/changes/d40a-index.md') && exists('dev/archive/changes/d40a-index/change_d40a-index.md'),
        'change files move into their archive folders');
  check(/git merge --ff-only feat/.test(res.stdout), 'it prints the fast-forward merge');

  git('add', '-A'); git('commit', '-q', '-m', 'v3.14.2, v3.14.3 — release');
  check(subject() === 'v3.14.2, v3.14.3 — release', 'the release commit is not relabelled');

  // ── 6. release on main is refused; main still mints at start ──────────────
  git('switch', '-q', 'main'); git('merge', '-q', '--ff-only', 'feat');
  res = nv('--release');
  check(res.status !== 0, 'release is refused on main');
  res = nv('--type', 'chore', 'hotfix', 'source/app.txt');
  check(res.status === 0 && version() === '3.14.4' && !exists('dev/changes/hotfix.md'),
        'on main a change gets its number at once, as before');
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}

// B-214: git ignores a hook without the executable bit, silently. An editor
// that rewrites the file can drop it; both the checkout and the index must keep it.
console.log('\nthe hooks are executable\n');
for (const h of ['pre-commit', 'prepare-commit-msg']) {
  const p = path.join(ROOT, 'hooks', h);
  check(fs.existsSync(p) && (fs.statSync(p).mode & 0o111) !== 0, `hooks/${h} is executable on disk`);
  const idx = spawnSync('git', ['--no-optional-locks', 'ls-files', '-s', `hooks/${h}`], { cwd: ROOT, encoding: 'utf8' });
  if (idx.status === 0 && idx.stdout.trim())
    check(idx.stdout.startsWith('100755'), `and in the git index (${idx.stdout.slice(0, 6)})`,
          `         git update-index --chmod=+x hooks/${h}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
