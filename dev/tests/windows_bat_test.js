#!/usr/bin/env node
/* =============================================================================
   windows_bat_test.js, the Windows .bat files reach testers in a form cmd.exe reads
   Run:  node dev/tests/windows_bat_test.js
   =============================================================================
   B-237. The .bat files were stored with LF line endings and nothing converted
   them, so the zip made by `git archive` handed cmd.exe LF-only files, which it
   can misparse inside ( ) blocks. Their em dashes printed as mojibake in the
   default console code page. LingCoT.bat also started pythonw.exe, so an error
   at startup showed nothing at all.
   ============================================================================= */

const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const bats = fs.readdirSync(ROOT).filter(f => f.endsWith('.bat')).sort();
check(bats.length === 3, `W0  ${bats.length} .bat files in the project root`, bats.join(', '));

console.log('\nline endings and characters');
for (const f of bats) {
  // `git check-attr` reads .gitattributes, which also drives `git archive`.
  const attr = execFileSync('git', ['-C', ROOT, 'check-attr', 'eol', '--', f], { encoding: 'utf8' });
  check(/: eol: crlf$/m.test(attr), `W1  ${f}: written out with CRLF (eol=crlf)`, attr.trim());
  const bytes = fs.readFileSync(path.join(ROOT, f));
  const nonAscii = [...bytes].filter(b => b > 0x7f).length;
  check(nonAscii === 0, `W2  ${f}: ASCII only`, `${nonAscii} non-ASCII bytes`);
}

console.log('\nthe launcher shows why it stopped');
const lc = fs.readFileSync(path.join(ROOT, 'LingCoT.bat'), 'utf8');
check(/\\python\.exe" source\\LingCoT\.pyw 2> "logs\\launcher_stderr\.log"/.test(lc),
      'L1  runs python.exe with stderr to logs\\launcher_stderr.log');
check(!/pythonw\.exe/.test(lc.split('\n').filter(l => !/^::/.test(l)).join('\n')),
      'L2  does not start pythonw.exe, which has no console to show an error');
check(/if %errorlevel% neq 0 \([\s\S]*type "logs\\launcher_stderr\.log"[\s\S]*pause/.test(lc),
      'L3  on a non-zero exit, prints the log and waits');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
