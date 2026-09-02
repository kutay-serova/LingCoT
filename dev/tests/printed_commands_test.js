#!/usr/bin/env node
/* =============================================================================
   printed_commands_test.js, a command a script prints must run where the user is
   Run:  node dev/tests/printed_commands_test.js
   =============================================================================
   B-207, v3.14.394, found by doing gate 2's fresh-machine install for real:
   cloning the published repository onto a clean machine and running setup.

   Setup SUCCEEDED, and then the last thing it printed was:

       .venv/bin/python3 scripts/corpus_annotate.py <corpus> --translate …

   which fails with "No such file or directory". So did the two NLLB follow-ups
   it printed, and so did all six examples in `setup.py --help`. Six sites, and
   every one of them is the FIRST thing a new user does after a successful
   install — the moment a tester decides whether this project is careful.

   THE SHAPE, because it will recur. `build_env.py` and `setup.py` live in
   `source/`, so their authors wrote paths relative to themselves. But
   `setup.command` does `cd "$(dirname "$0")"` — the PROJECT ROOT — and then
   invokes `python3 source/build_env.py`. The user is one directory above where
   the printing script lives, always. The `.command` and `.bat` launchers had it
   right all along (`source/scripts/corpus_annotate.py`), which is what made the
   disagreement invisible: two writers, and the correct one was not the one
   talking to the user at the end of setup.

   WHY THIS IS A GUARD AND NOT A ONE-LINE FIX. Nothing about the six sites was
   detectable by reading them — each looks perfectly reasonable in the file it
   sits in. The defect only exists relative to the user's working directory, so
   the check has to be the same question the user asks: does this path exist
   from the root? PRACTICES §6.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { ROOT, SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\na printed command resolves from the project root\n');

/* Every file that talks to a user who is standing at the project root. */
const FILES = [
  'source/build_env.py', 'source/setup.py',
  'source/scripts/corpus_annotate.py', 'source/scripts/corpus_ingest.py',
  'source/scripts/corpus_optimize.py', 'source/scripts/dict_export.py',
  'setup.command', 'setup.bat', 'LingCoT.command', 'LingCoT.bat',
  'setup_NLLB.command', 'setup_NLLB.bat',
  'dev/new_version.py', 'dev/tools/ship_disclosure.py',
].filter(f => fs.existsSync(path.join(ROOT, f)));

/* Named, not counted. A `>= 10` floor let `setup.py` — which held 21 of the 67
   broken commands — be dropped from the list without the guard noticing, because
   13 is still ten. A count floor answers "did we scan enough things"; the
   question is "did we scan THE things". */
const REQUIRED = ['source/build_env.py', 'source/setup.py',
                  'source/scripts/corpus_annotate.py', 'source/scripts/corpus_ingest.py',
                  'source/scripts/corpus_optimize.py', 'source/scripts/dict_export.py',
                  'setup.command', 'LingCoT.command'];
const unscanned = REQUIRED.filter(f => !FILES.includes(f));
check(unscanned.length === 0,
      `all ${REQUIRED.length} required file(s) are in the sweep (${FILES.length} scanned)`,
      `         not scanned: ${unscanned.join(', ')}\n`
    + '         every one of these prints commands a new user pastes after install');

/* A COMMAND, not a mention. "corpus_annotate.py will use this config" is prose
   and names no path to resolve; "python3 build_env.py --tier nllb" is something
   a person pastes. The discriminator is an interpreter or the venv's bin. */
/* `.pyw?` and the negative lookahead, both learned the hard way in the same
   hour: `LingCoT.command` launches `source/LingCoT.pyw`, and a bare `\.py`
   matched the first three of those four characters and reported a real file as
   missing. A guard's own false positive is a guard nobody trusts. */
const RUNNER = /(?:python3?|\.venv\/bin\/python3?|\.venv\\Scripts\\python\.exe)\s+([A-Za-z0-9_./\\-]+\.pyw?)(?![A-Za-z0-9_])/g;

/* SCANNED EVERYWHERE, not only on lines that call print().

   The first version of this guard gated on `print|echo` appearing on the same
   line, and it was hollow: `setup.py`'s six broken examples live inside an
   argparse `epilog=(...)` string, whose continuation lines contain no `print`
   at all, and `build_env.py`'s live in a header comment and a second epilog.
   The gate skipped the exact six sites B-207 was filed for and passed. It only
   looked like it worked because two OTHER occurrences happened to sit on
   printed lines.

   So: every occurrence, in a comment or a string, is checked. That is not
   over-reach — a usage line in a header comment is read by someone who then
   types it, and they are standing at the root like everyone else. The shebang
   is the one exclusion, because it names an interpreter and not a script. */
const broken = [];
let commands = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const line of src.split('\n')) {
    if (/^#!/.test(line)) continue;
    for (const m of line.matchAll(RUNNER)) {
      const p = m[1].replace(/\\/g, '/');
      if (p.includes('<') || p.includes('{') || p.includes('$')) continue;  // a placeholder
      commands++;
      if (!fs.existsSync(path.join(ROOT, p)))
        broken.push(`         ${f}: "${m[0]}"\n`
                  + `           → ${p} does not exist from the project root, which is where the user stands`);
    }
  }
}

check(commands >= 25, `${commands} printed command(s) found`,
      '         the regex matched too few — it has stopped seeing what it is for');
check(broken.length === 0,
      `every printed command names a path that exists from the root`,
      broken.join('\n') + '\n         a user pastes this immediately after a successful install');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
