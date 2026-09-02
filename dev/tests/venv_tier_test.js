#!/usr/bin/env node
/* =============================================================================
   venv_tier_test.js, setup must never remove what a previous setup installed
   Run:  node dev/tests/venv_tier_test.js
   =============================================================================
   B-025. `uv sync` is EXACT by default: it deletes every package outside the
   resolved set for the extras it is handed. `setup.command` runs build_env.py
   with no --tier, so tier defaulted to "minimal" and the sync silently removed
   the user's nllb AND pdf packages, offline translation and PDF export both
   stopped working while the 601 MB NLLB model sat on disk with nothing able to
   load it. Nothing was logged: from uv's point of view the sync succeeded.

   The tiers were also mutually exclusive, so even `--tier pdf` would have
   removed the nllb packages. They are additive now.

   This guard EXECUTES build_env.py rather than reading it. An earlier guard in
   this project asserted a function was "defined and called" and was worthless
   because nothing ran the file; reading source cannot tell you what a command
   line will actually contain.
   ============================================================================= */

const path = require('path');
const fs   = require('fs');
const { execFileSync } = require('child_process');

const { ROOT, SRC } = require('./_source.js');
const BE   = path.join(ROOT, 'source', 'build_env.py');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const probe = `
import json, sys, importlib.util as ilu, tempfile, pathlib, shutil
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'source'))})
spec = ilu.spec_from_file_location('be', ${JSON.stringify(BE)})
be = ilu.module_from_spec(spec)
try: spec.loader.exec_module(be)
except SystemExit: pass

# Call through a shim so a pre-fix build_env (no extras kwarg) still produces a
# command to inspect. Otherwise the guard reports "could not load" instead of
# naming the actual defect, which is far less useful when it fires.
def cmd(tier, extras):
    try:
        return be._uv_sync_cmd('uv', tier, False, extras=extras)
    except TypeError:
        out['legacy_signature'] = True
        return be._uv_sync_cmd('uv', tier, False)

out = {}
out['minimal_nothing'] = cmd('minimal', set())
out['minimal_both']    = cmd('minimal', {'pdf','nllb'})
out['nllb_with_pdf']   = cmd('nllb', {'pdf'})
out.setdefault('legacy_signature', False)

if not hasattr(be, 'detect_installed_extras'):
    out['detected'] = None
    out['detected_empty'] = None
    print(json.dumps(out)); raise SystemExit(0)

# Detection must actually look at disk, not return a constant.
with tempfile.TemporaryDirectory() as td:
    sp = pathlib.Path(td) / 'lib' / 'python3.13' / 'site-packages'
    sp.mkdir(parents=True)
    (sp / 'fpdf').mkdir()
    (sp / 'ctranslate2').mkdir()
    be.VENV_DIR = pathlib.Path(td)
    out['detected'] = sorted(be.detect_installed_extras())
    for d in ('fpdf', 'ctranslate2'):
        shutil.rmtree(sp / d)
    out['detected_empty'] = sorted(be.detect_installed_extras())
print(json.dumps(out))
`;

let r = null, err = '';
try { r = JSON.parse(execFileSync('python3', ['-c', probe], { encoding: 'utf8' }).trim()); }
catch (e) { err = String(e.stderr || e.message).trim().split('\n').slice(-3).join('\n         '); }

check(r !== null, 'build_env.py loads and exposes the sync builder', `         ${err}`);
if (!r) { console.log(`\n${pass} passed, ${fail} failed\n`); process.exit(1); }

console.log('\na sync never removes what it did not install\n');
{
  check(r.minimal_nothing.includes('--inexact'),
        '--inexact is always passed',
        '         without it, `uv sync` deletes every package outside the resolved\n'
        + '         set — which is exactly how B-025 wiped two tiers');
  for (const k of ['minimal_both', 'nllb_with_pdf'])
    check(r[k].includes('--inexact'), `--inexact present for ${k}`);
}

console.log('\ninstalled extras survive a lower-tier run');
{
  const both = r.minimal_both.join(' ');
  check(both.includes('--extra pdf') && both.includes('--extra nllb'),
        'tier=minimal with pdf+nllb installed syncs BOTH, not neither',
        `         got: ${both}\n`
        + '         → setup.command passes no --tier; if this drops the extras,\n'
        + '           running setup UNINSTALLS the user’s features');

  const nllb = r.nllb_with_pdf.join(' ');
  check(nllb.includes('--extra nllb') && nllb.includes('--extra pdf'),
        'tiers are additive — asking for nllb does not remove pdf',
        `         got: ${nllb}`);
}

console.log('\ndetection actually looks at disk');
{
  check(r.detected !== null,
        'detect_installed_extras() exists',
        '         without it nothing can know what a re-run would delete');
  if (r.detected !== null) {
    check(JSON.stringify(r.detected) === JSON.stringify(['nllb', 'pdf']),
          'marker packages on disk are detected as their extras',
          `         got ${JSON.stringify(r.detected)}, expected ["nllb","pdf"]`);
    check(r.detected_empty.length === 0,
          'an empty site-packages detects nothing — the check is not a constant',
          `         got ${JSON.stringify(r.detected_empty)}`);
  }
  check(r.legacy_signature === false,
        '_uv_sync_cmd accepts the extras it must preserve',
        '         the pre-fix signature had no extras parameter at all');
}

console.log('\nsync_existing_venv actually uses the detection');
{
  const be = fs.readFileSync(BE, 'utf8');
  const i = be.indexOf('def sync_existing_venv');
  const body = i === -1 ? '' : be.slice(i, i + 2500);
  check(/detect_installed_extras\(\)/.test(body),
        'the upgrade-in-place path calls detect_installed_extras()',
        '         building the right command is useless if the path users take\n'
        + '           never asks what is installed');
  // Must be the RESULT of the detection, not merely the word "extras", the
  // pre-fix file contains `extra_map` and an `extras` mention in a docstring,
  // and a looser pattern passed against it.
  check(/_uv_sync_cmd\([^)]*extras\s*=\s*keep/.test(body),
        'and passes the detected set into the sync command',
        '         detecting what is installed and then not using it is the same\n'
        + '           as not detecting it');
}

console.log('\nthe failure is visible when it does happen');
{
  const pyw = fs.readFileSync(path.join(ROOT, 'source', 'LingCoT.pyw'), 'utf8');
  const i = pyw.indexOf('Could not load dict_export module');
  check(i !== -1 && /_log\.error\([^)]*dict_export/.test(pyw),
        'a missing pdf tier is LOGGED, not silently returned',
        '         this is the path a stripped venv hits; unlogged, the Export\n'
        + '           button appears to do nothing and the session log is empty');
  check(/install_hint/.test(pyw.slice(Math.max(0, i - 800), i + 800)),
        'and carries an install hint the UI already knows how to render');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
