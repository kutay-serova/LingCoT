#!/usr/bin/env node
/* =============================================================================
   mac_app_test.js, setup builds a LingCoT.app that starts without Terminal
   Run:  node dev/tests/mac_app_test.js
   =============================================================================
   Post-test item 2. On macOS, setup.command clears the download quarantine flag
   on the folder and runs source/scripts/make_mac_app.sh, which writes
   LingCoT.app with the folder's absolute path inside its launcher.

   The generator is run for real, into a temporary folder whose name has a space
   and an apostrophe, because the tester's folder is a path nobody chose for
   the script's convenience. The launcher itself is not executed: on a Mac it
   would open dialogs.
   ============================================================================= */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const GEN = path.join(ROOT, 'source', 'scripts', 'make_mac_app.sh');
console.log('\nthe generator');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-app-'));
const home = path.join(tmp, "Kutay's LingCoT 3.15");
fs.mkdirSync(path.join(home, 'source'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'source', 'version.py'), path.join(home, 'source', 'version.py'));

let built = true;
try { execFileSync('bash', [GEN, home], { stdio: 'pipe' }); }
catch (e) { built = false; check(false, 'make_mac_app.sh runs', String(e.stderr || e.message)); }

if (built) {
  const app = path.join(home, 'LingCoT.app', 'Contents');
  const plist = fs.readFileSync(path.join(app, 'Info.plist'), 'utf8');
  const key = k => (new RegExp(`<key>${k}</key><string>([^<]*)</string>`).exec(plist) || [])[1];
  check(key('CFBundleName') === 'LingCoT' && key('CFBundlePackageType') === 'APPL',
        'A1  Info.plist names the app and marks it an application');
  const exe = path.join(app, 'MacOS', key('CFBundleExecutable') || '?');
  check(fs.existsSync(exe) && (fs.statSync(exe).mode & 0o111) !== 0,
        'A2  the executable the plist names exists and is executable');
  const ver = (/__version__ = "([^"+]*)/.exec(fs.readFileSync(path.join(ROOT, 'source', 'version.py'), 'utf8')) || [])[1];
  check(key('CFBundleShortVersionString') === ver, 'A3  the bundle version is the app version, without a branch label',
        `${key('CFBundleShortVersionString')} vs ${ver}`);

  const launcher = fs.readFileSync(exe, 'utf8');
  let syntaxOk = true;
  try { execFileSync('bash', ['-n', exe]); } catch (e) { syntaxOk = false; }
  check(syntaxOk, 'A4  the launcher is valid bash');
  const rootLine = launcher.split('\n').find(l => l.startsWith('ROOT='));
  const rootVal = rootLine && execFileSync('bash', ['-c', `${rootLine}; printf %s "$ROOT"`]).toString();
  check(rootVal === home, 'A5  the folder path survives quoting (space and apostrophe)', `${rootVal}`);
  check(/\.venv\/bin\/python" \]/.test(launcher) && launcher.indexOf('.venv/bin/python" ]') < launcher.indexOf('source/LingCoT.pyw'),
        'A6  the launcher checks setup before starting Python');
  check(/display dialog/.test(launcher) && /code -ne 0/.test(launcher) && /exit \$code/.test(launcher),
        'A7  a failed start is reported in a dialog and the exit code passed on');
  check(/2> "\$ROOT\/logs\//.test(launcher), 'A8  start-up errors go to the logs folder, not a Terminal');

  // Rebuilding replaces the app rather than nesting or failing.
  try { execFileSync('bash', [GEN, home], { stdio: 'pipe' }); check(true, 'A9  running it again rebuilds the app'); }
  catch (e) { check(false, 'A9  running it again rebuilds the app', String(e.stderr || e.message)); }
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nsetup.command and the repository');
const setup = fs.readFileSync(path.join(ROOT, 'setup.command'), 'utf8');
const darwin = setup.indexOf('"$(uname)" = "Darwin"');
check(darwin !== -1 && setup.indexOf('xattr -dr com.apple.quarantine') > darwin,
      'S1  setup clears the quarantine flag, on macOS only');
check(setup.indexOf('make_mac_app.sh') > setup.indexOf('xattr -dr com.apple.quarantine')
      && setup.indexOf('make_mac_app.sh') > setup.indexOf('BUILD_STATUS -ne 0'),
      'S2  and builds the app after the environment is in place');
check(/if bash source\/scripts\/make_mac_app\.sh/.test(setup),
      'S3  a failed app build does not fail setup; LingCoT.command remains');
let ignored = false;
try { execFileSync('git', ['-C', ROOT, 'check-ignore', '-q', 'LingCoT.app/Contents/Info.plist']); ignored = true; } catch (e) {}
check(ignored, 'S4  LingCoT.app is not committed (it holds one machine\'s path)');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
