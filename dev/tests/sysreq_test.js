#!/usr/bin/env node
/* =============================================================================
   sysreq_test.js, setup refuses unsupported systems before installing anything
   Run:  node dev/tests/sysreq_test.js
   =============================================================================
   source/sysreq.py holds the minimums (Python 3.9, macOS 11, Windows 10, 64-bit;
   NLLB: no Intel Mac, glibc 2.28 on Linux). The checks are executed with
   overridden system values; build_env.py and setup.py are read for where they
   call them. B-236: build_env.py used `str | None` in signatures and could not
   be imported by the Python 3.9 its own pyproject.toml declares supported.
   ============================================================================= */

const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};
const py = expr => JSON.parse(execFileSync('python3', ['-c',
  `import sys, json; sys.path.insert(0, ${JSON.stringify(SRC)}); import sysreq as s; print(json.dumps(${expr}))`],
  { encoding: 'utf8' }).trim());

console.log('\nthe minimums');
check(py("s.check_base('Darwin', (3,13), (14,5), None, 64)").length === 0, 'R1  macOS 14, Python 3.13, 64-bit passes');
check(py("s.check_base('Darwin', (3,8), (14,5), None, 64)").some(m => /Python 3\.9/.test(m)), 'R2  Python 3.8 is refused, naming 3.9');
check(py("s.check_base('Darwin', (3,13), (10,15), None, 64)").some(m => /macOS 11/.test(m)), 'R3  macOS 10.15 is refused');
check(py("s.check_base('Darwin', (3,13), (10,16), None, 64)").length === 0, 'R4  10.16 (Big Sur seen through an old SDK) counts as 11');
check(py("s.check_base('Windows', (3,12), None, 6, 64)").some(m => /Windows 10/.test(m)), 'R5  Windows 7/8.1 (major 6) is refused');
check(py("s.check_base('Windows', (3,12), None, 10, 32)").some(m => /64-bit/.test(m)), 'R6  a 32-bit Python is refused');
check(py("s.check_base('Linux', (3,12), None, None, 64)").length === 0, 'R7  64-bit Linux with Python 3.12 passes the base check');

console.log('\noffline translation');
check(py("s.check_nllb('Darwin', 'arm64')").length === 0, 'N1  Apple Silicon passes');
check(py("s.check_nllb('Darwin', 'x86_64', rosetta=False)").some(m => /Apple Silicon/.test(m) && /Google/.test(m)),
      'N2  an Intel Mac is refused, and told online translation works');
check(py("s.check_nllb('Darwin', 'x86_64', rosetta=True)").some(m => /Rosetta/.test(m)),
      'N3  an Intel Python under Rosetta is told to install a native one instead');
check(py("s.check_nllb('Linux', 'x86_64', '2.27')").some(m => /glibc 2\.28/.test(m)), 'N4  glibc 2.27 is refused');
check(py("s.check_nllb('Linux', 'x86_64', '2.35')").length === 0, 'N5  glibc 2.35 passes');

console.log('\nwhere setup asks');
const be = fs.readFileSync(path.join(SRC, 'build_env.py'), 'utf8');
const main = be.slice(be.indexOf('def main('));
const at = s => main.indexOf(s);
check(at('_sysreq.check_base()') !== -1 && at('_sysreq.check_base()') < at('if args.show:')
      && at('_sysreq.check_base()') < at('VENV_DIR.exists()'),
      'W1  build_env checks before the venv is touched (after the workspace step, B-023)');
check(/args\.tier == TIER_NLLB:\s*\n\s*problems \+= _sysreq\.check_nllb\(\)/.test(main), 'W2  and adds the NLLB check for that tier');
const st = fs.readFileSync(path.join(SRC, 'setup.py'), 'utf8');
const dl = st.slice(st.indexOf('def download_nllb('));
check(dl.indexOf('sysreq.check_nllb()') !== -1 && dl.indexOf('sysreq.check_nllb()') < dl.indexOf('if not ensure_nllb_packages()'),
      'W3  the NLLB download checks before installing packages');

console.log('\nsetup imports under the oldest supported Python (B-236)');
for (const f of ['build_env.py', 'setup.py', 'log_setup.py', 'workspace.py', 'version.py', 'sysreq.py']) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  const sigs = src.split('\n').filter(l => /^\s*def .*(\|\s*None|\b(list|dict|tuple|set)\[)/.test(l));
  check(!sigs.length || /^from __future__ import annotations/m.test(src),
        `I   ${f}: ${sigs.length ? 'newer annotations, with the __future__ import' : 'no 3.10-only annotations in signatures'}`,
        sigs.slice(0, 3).join('\n       '));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
