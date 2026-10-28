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

console.log('\nevery source module imports under the oldest supported Python (B-236)');
// Python 3.9 evaluates annotations when a def or class body runs, so `X | Y` there
// raises TypeError on import unless the module has the __future__ import.
// Annotations inside function bodies are never evaluated and are skipped.
// The __future__ import is not safe with @dataclass in a module loaded by file
// path (workspace_test.js loads corpus_ingest.py that way): use Optional there.
// Read with ast, so signatures split over several lines are covered too.
const UNION_SCAN = `
import ast, json, sys
def unions(node):
    return [n.lineno for n in ast.walk(node)
            if isinstance(n, ast.BinOp) and isinstance(n.op, ast.BitOr)] if node else []
out = {}
for f in sys.argv[1:]:
    tree = ast.parse(open(f, encoding='utf8').read())
    if any(isinstance(n, ast.ImportFrom) and n.module == '__future__'
           and any(a.name == 'annotations' for a in n.names) for n in tree.body):
        out[f] = []
        continue
    hits = []
    def visit(body):
        for n in body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                a = n.args
                for arg in a.posonlyargs + a.args + a.kwonlyargs + [a.vararg, a.kwarg]:
                    if arg: hits.extend(unions(arg.annotation))
                hits.extend(unions(n.returns))
            elif isinstance(n, ast.ClassDef):
                visit(n.body)
            elif isinstance(n, ast.AnnAssign):
                hits.extend(unions(n.annotation))
            elif isinstance(n, (ast.If, ast.Try, ast.With)):
                visit(getattr(n, 'body', []))
    visit(tree.body)
    out[f] = sorted(set(hits))
print(json.dumps(out))
`;
const pyFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__pycache__', 'models'].includes(e.name)) walk(p); }
    else if (/\.pyw?$/.test(e.name)) pyFiles.push(p);
  }
})(SRC);
const unionHits = JSON.parse(execFileSync('python3', ['-c', UNION_SCAN, ...pyFiles], { encoding: 'utf8' }));
check(pyFiles.length >= 12, `I0  ${pyFiles.length} modules scanned under source/`);
for (const f of pyFiles) {
  const lines = unionHits[f], rel = path.relative(SRC, f);
  check(!lines.length, `I   ${rel}: no \`X | Y\` annotation evaluated on import`,
        lines.length ? `lines ${lines.join(', ')}; use Optional[...], or the __future__ import in a module without dataclasses` : '');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
