#!/usr/bin/env node
/* =============================================================================
   venv_bootstrap_test.js — the venv re-exec fires on RUN, never on import
   Run:  node dev/tests/venv_bootstrap_test.js
   =============================================================================
   B-179. Four scripts open by re-exec'ing themselves under `.venv`'s Python so
   nobody has to activate it by hand. The block sat at module level, so it fired
   on IMPORT too — and `os.execv` does not return, it REPLACES the process. Any
   Python program that imported one of these scripts was silently replaced by a
   fresh interpreter running that program's argv.

   Under `python -c`, `sys.argv` is `['-c']`: the script text is not in argv. So
   the re-exec built `python -c` with no argument, and the caller got
   `Argument expected for the -c option` where its module should have been. That
   is how this was found — `workspace_test.js` imports `corpus_ingest.py` to ask
   where the CLI writes fieldwork (B-041), and had been failing on the user's
   machine and passing everywhere without a `.venv`.

   HOW THIS IS TESTED. Not by reading for `__name__`, which would pass against a
   block that also re-exec'd somewhere else. A hermetic project is built in a
   temp directory — the REAL script, copied at its real depth, beside a
   `.venv/bin/python` that is a shell stub printing a marker — and the script is
   both imported and run:

       imported → the marker must NOT appear   (the bug)
       run      → the marker MUST appear       (the feature it must not lose)

   The stub is what makes the second half safe: exec'ing into a real interpreter
   that is not really a venv would re-exec forever, because `sys.prefix` never
   becomes the venv.

   ONE SCRIPT IS EXECUTED, FOUR ARE COVERED: §1 holds the four blocks
   byte-identical, which is also the answer to their having drifted (PRACTICES
   §4). They cannot share a module — the bootstrap has to run before anything is
   importable, which is the whole point of it.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const OPEN  = '# ── Environment bootstrap ─';
const CLOSE = '# ── end environment bootstrap ─';
const CARRIERS = ['setup.py', 'scripts/corpus_ingest.py',
                  'scripts/corpus_annotate.py', 'scripts/corpus_optimize.py'];

console.log('\n1 · one bootstrap, copied four times, byte for byte');

const blocks = {};
for (const rel of CARRIERS) {
  const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const i = src.indexOf(OPEN), j = src.indexOf(CLOSE);
  if (i === -1 || j === -1) { check(false, `${rel} carries a marked bootstrap block`); continue; }
  blocks[rel] = src.slice(i, src.indexOf('\n', j) + 1);
  check(true, `${rel} carries a marked bootstrap block`);
}

const names = Object.keys(blocks);
const first = names[0];
for (const rel of names.slice(1))
  check(blocks[rel] === blocks[first],
        `${rel} is byte-identical to ${first}`,
        '         they had already drifted once, in how each computed the project\n'
      + '         root. A block that must be duplicated is held identical, not\n'
      + '         trusted to stay that way (PRACTICES §4).');

console.log('\n2 · what the block must and must not contain');

const B = blocks[first] || '';
check(/if __name__ == "__main__":/.test(B),
      'the re-exec is reached only under __main__',
      '         module level means it fires on import, and execv never returns');
const guardAt = B.indexOf('if __name__ ==');
const execAt  = B.indexOf('_os.execv');
check(execAt !== -1 && guardAt !== -1 && execAt < guardAt,
      'and the execv itself lives in a function the guard calls',
      '         an execv AFTER the __main__ block is a second, unguarded path');
check((B.match(/_os\.execv/g) || []).length === 1,
      'there is exactly one execv in the block',
      '         a guard that finds one and a block that holds two is B-179 again');
check(/Scripts/.test(B) && /python\.exe/.test(B) && /_os\.name/.test(B),
      'the Windows interpreter layout is handled',
      '         .venv\\Scripts\\python.exe — a bin/python-only check silently\n'
    + '         never adopts the venv on Windows, the same layout fork\n'
    + '         nllb_diag_test.py already checks for the NLLB launcher');
check(/parents\)\[:\d+\]/.test(B),
      'the upward search for .venv is bounded',
      '         unbounded, a stray .venv in a parent directory becomes this\n'
    + '         project\'s interpreter');

console.log('\n3 · executed: a hermetic project, imported and run');

if (process.platform === 'win32') {
  console.log('  skip  the exec half needs a POSIX shebang stub; §1–2 still ran');
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-boot-'));
  const scriptDir = path.join(tmp, 'source', 'scripts');
  fs.mkdirSync(scriptDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, '.venv', 'bin'), { recursive: true });

  /* A stub, not an interpreter. Exec'ing into a real python that is not really a
     venv would satisfy the .exists() test and never satisfy the sys.prefix one,
     so the script would re-exec itself forever. */
  const stub = path.join(tmp, '.venv', 'bin', 'python');
  fs.writeFileSync(stub, '#!/bin/sh\necho "REEXEC:$@"\n');
  fs.chmodSync(stub, 0o755);

  const target = path.join(scriptDir, 'corpus_ingest.py');
  fs.copyFileSync(path.join(SRC, 'scripts', 'corpus_ingest.py'), target);

  /* Both runs may exit non-zero — the copy has no workspace.py beside it, so the
     import fails on its own terms. That is fine and is not what is measured:
     the marker on stdout is. */
  const runPy = args => {
    try { return execFileSync('python3', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return String(e.stdout || ''); }
  };

  const imported = runPy(['-c',
    `import sys; sys.path.insert(0, ${JSON.stringify(scriptDir)}); import corpus_ingest`]);
  check(!imported.includes('REEXEC'),
        'importing the script does NOT replace the caller\'s process',
        `         got: ${imported.trim().split('\n')[0] || '(nothing)'}\n`
      + '         this is B-179: under `python -c` the re-exec inherits argv\n'
      + '         [\'-c\'] and the caller gets an argv error, not its module');

  const ran = runPy([target, '--help']);
  check(ran.includes('REEXEC'),
        'running it directly still adopts the venv interpreter',
        `         got: ${ran.trim().split('\n')[0] || '(nothing)'}\n`
      + '         the fix must not be "delete the convenience" — a user who has\n'
      + '         never activated the venv still has to get the right python');
  check(/REEXEC:.*--help/.test(ran),
        'and passes the command line through unchanged',
        `         got: ${ran.trim().split('\n')[0]}`);

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
