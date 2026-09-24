#!/usr/bin/env node
/* =============================================================================
   hooks_executable_test.js, a hook git records as non-executable never runs
   Run:  node dev/tests/hooks_executable_test.js
   =============================================================================
   B-209, v3.14.401. `hooks/pre-commit` was mode **100644 in every commit**,
   including the first. Git runs a hook only if the file is executable, and it
   says nothing when it is not — so on any clone the second of the two layers
   protecting fieldwork simply did not exist, silently, in a published
   repository.

   IT APPEARED TO WORK, which is why nothing caught it. The hook fired for real
   at v3.14.392 and refused the first commit (B-206). That happened because the
   author's WORKING COPY had the executable bit set from a `chmod +x`, while
   git's index recorded 100644. The two diverged, and the working copy is the
   one that ran. A clone gets git's version.

   SO THIS ASKS GIT, NOT THE FILESYSTEM. `fs.statSync().mode` answers about the
   checkout, which is the half that was already right and is not what ships. It
   is also unreliable here: the author's repository lives on a mount that does
   not always preserve the bit. `git ls-files -s` is the recorded mode, which is
   what a cloner receives.

   THE FIX IS ONE COMMAND, and it is not chmod:
       git update-index --chmod=+x hooks/pre-commit hooks/prepare-commit-msg
   `chmod` alone changes the checkout and leaves the index at 100644, which is
   exactly the state that produced this.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, disabled } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\nevery hook is executable in git, not just on disk\n');

if (!fs.existsSync(path.join(ROOT, '.git')))
  disabled('no .git here', 'the recorded mode is a property of the repository');

let out;
try {
  out = execFileSync('git', ['--no-optional-locks', '-C', ROOT, 'ls-files', '-s', 'hooks'],
                     { encoding: 'utf8' });
} catch (e) {
  disabled('git could not read the index', String(e.message).slice(0, 140));
}

const rows = out.trim().split('\n').filter(Boolean)
  .map(l => { const m = /^(\d{6})\s+\S+\s+\d+\s+(.+)$/.exec(l); return m && { mode: m[1], file: m[2] }; })
  .filter(Boolean);

check(rows.length > 0, `${rows.length} hook(s) tracked under hooks/`,
      '         a sweep that finds no hooks passes for the wrong reason (PRACTICES §7)');

/* Every tracked hook, by name, so adding one cannot quietly skip this. */
const bad = rows.filter(r => r.mode !== '100755');
check(bad.length === 0, 'every tracked hook is recorded 100755',
      bad.map(r => `         ${r.file} is ${r.mode} — git will SKIP it on any clone, silently`).join('\n')
    + '\n         fix: git update-index --chmod=+x ' + bad.map(r => r.file).join(' ')
    + '\n         chmod alone changes the checkout and leaves the index wrong, which is B-209');

/* The two that must exist. A hook can be lost as easily as it can be added, and
   `pre-commit` is the one that refuses fieldwork. */
for (const want of ['hooks/pre-commit', 'hooks/prepare-commit-msg'])
  check(rows.some(r => r.file === want), `${want} is tracked`,
        '         it is part of what a clone needs; untracked, nobody gets it');

/* The checkout too, for every file git records as executable. An editor that
   rewrites a file on this mount can drop the bit; run_all.sh lost it at
   b216-b217-logs and the suite refused to start. */
console.log('\nevery file git records as executable is executable on disk\n');
{
  const all = execFileSync('git', ['--no-optional-locks', '-C', ROOT, 'ls-files', '-s'], { encoding: 'utf8' })
    .trim().split('\n').map(l => /^100755\s+\S+\s+\d+\s+(.+)$/.exec(l)).filter(Boolean).map(m => m[1]);
  const bad = all.filter(f => { try { return !(fs.statSync(path.join(ROOT, f)).mode & 0o111); } catch { return false; } });
  check(all.length > 0 && !bad.length, `${all.length} executable file(s), all executable in the checkout`,
        bad.map(f => `         chmod +x ${f}`).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
