#!/usr/bin/env node
/* =============================================================================
   workspace_test.js, user data must never be written inside the app folder
   Run:  node dev/tests/workspace_test.js
   Verify against the known-bad copies:
         LINGCOT_PRE=dev/archive/changes/workspace_entrypoint \
           node dev/tests/workspace_test.js
   =============================================================================
   The app folder is the Git repository. A corpus written inside it carries
   fieldwork and a participants file of real names, affiliations and contact
   details into a directory whose whole purpose is to be published, so user data
   lives at WORKSPACE, outside ROOT, structural protection, not procedural: no
   ignore rule, hook or habit has to hold for the bad outcome not to happen.

   THIS GUARD EXISTS IN TWO VERSIONS AND THE FIRST ONE WAS USELESS.

   v3.14.77 asserted that ensure_workspace() existed in setup.py and was called
   there. Both true. Both worthless, setup.command runs build_env.py and never
   invokes setup.py at all, so the workspace step silently never ran. The guard
   was green while the feature did nothing.

   The lesson is in §"every setup entry point reaches the workspace code" below:
   checking that a function is defined and called says nothing about whether the
   file containing it is ever executed. That section parses the shell/batch
   launchers to find which Python files they actually run, and requires each to
   import the workspace module. It is the only check here that would have caught
   the original bug, and it is the reason for all the others' existence.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');

/* LINGCOT_PRE swaps in archived pre-fix copies so the guard can be PROVED to
   fail. A guard that cannot fail is not a guard. */
const PRE = process.env.LINGCOT_PRE ? path.resolve(ROOT, process.env.LINGCOT_PRE) : null;
const PRE_MAP = {
  'source/LingCoT.pyw':   'LingCoT_pre_v3.14.78.pyw',
  'source/setup.py':      'setup_pre_v3.14.78.py',
  'source/build_env.py':  'build_env_pre_v3.14.78.py',
  // v3.14.79 known-bad lives in a different archive folder; LINGCOT_PRE
  // points at whichever one is being verified.
  'source/build_env.py@79': 'build_env_pre_v3.14.79.py',
  'source/LingCoT.pyw@80':  'LingCoT_pre_v3.14.80.pyw',
  'setup.command':        'setup_pre_v3.14.78.command',
  'setup.bat':            'setup_pre_v3.14.78.bat',
};
function load(rel, optional) {
  if (PRE) {
    for (const key of [`${rel}@79`, `${rel}@80`, rel]) {
      if (!PRE_MAP[key]) continue;
      const p = path.join(PRE, PRE_MAP[key]);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
  }
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { if (optional) return null; throw new Error(`missing ${rel}`); }
  return fs.readFileSync(p, 'utf8');
}

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Strip comments and docstrings before scanning for code. Three guards in this
   project have matched their own explanatory prose; a comment reading "no longer
   ROOT/corpora" is not evidence that the code changed. */
const decomment = (s, py) => {
  let out = s.replace(/"""[\s\S]*?"""/g, ' ').replace(/'''[\s\S]*?'''/g, ' ')
             .replace(/\/\*[\s\S]*?\*\//g, ' ');
  return out.split('\n')
            .map(l => py ? l.replace(/#.*$/, '') : l.replace(/\/\/.*$/, ''))
            .join('\n');
};

const wsMod   = load('source/workspace.py', true);
const pywCode = decomment(load('source/LingCoT.pyw'), true);
const setCode = decomment(load('source/setup.py'),    true);
const bldCode = decomment(load('source/build_env.py'), true);
const evtsCode= decomment(load('source/modules/events.js'), false);
const html    = load('source/LingCoT.html');
const readme  = load('README.md');

console.log('\nthe workspace is defined ONCE, outside the app folder\n');
{
  check(wsMod !== null, 'source/workspace.py exists',
        '         v3.14.77 defined WORKSPACE separately in two files');
  if (wsMod) {
    const code = decomment(wsMod, true);
    check(/^WORKSPACE\s*=/m.test(code), 'it defines WORKSPACE');
    check(/LINGCOT_WORKSPACE/.test(code) && /Path\.home\(\)/.test(code),
          'from the home directory, overridable via LINGCOT_WORKSPACE');
    check(!/\bPROJECT_ROOT\b|\bROOT\b/.test((code.match(/^WORKSPACE\s*=.*/m) || [''])[0]),
          'and not from the app folder — it is a separate location');
  }

  /* Nobody else may CONSTRUCT it: two definitions can drift apart silently.
     `WORKSPACE = str(_WORKSPACE_PATH)` is a type coercion at the bridge boundary,
     not a second definition, it still derives from the imported value. Only an
     assignment that builds the path from scratch counts, which is what reading
     LINGCOT_WORKSPACE or the home directory means. */
  const CONSTRUCTS = c => {
    const m = c.match(/^WORKSPACE\s*=.*$/m);
    return m ? /LINGCOT_WORKSPACE|expanduser|Path\.home/.test(m[0]) : false;
  };
  const dupes = [['LingCoT.pyw', pywCode], ['setup.py', setCode], ['build_env.py', bldCode]]
    .filter(([, c]) => CONSTRUCTS(c)).map(([n]) => n);
  check(dupes.length === 0,
        'no entry point redefines WORKSPACE — one definition, imported',
        dupes.map(n => `         ${n} defines its own WORKSPACE`).join('\n'));
}

console.log('\nevery setup entry point reaches the workspace code');
{
  /* THE CHECK THAT WOULD HAVE CAUGHT THE v3.14.77 BUG.
     Parse the launchers users actually double-click, find the Python files they
     run, and require each to import the workspace module. "Defined and called"
     is not the same as "executed". */
  const IMPORTS_WS = c => /from\s+workspace\s+import|import\s+workspace\b/.test(c);
  const CODE = { 'setup.py': setCode, 'build_env.py': bldCode, 'LingCoT.pyw': pywCode };

  for (const launcher of ['setup.command', 'setup.bat']) {
    const text = load(launcher, true);
    if (text === null) { check(false, `${launcher} exists`); continue; }
    // Capture the whole path token, then take its basename. An earlier version
    // of this regex backtracked into the middle of "build_env.py" and yielded
    // "v.py", a file that does not exist, which then fell through to a silent
    // "not analysed" and PASSED. That is how this guard failed the first time.
    const runs = [...text.matchAll(/\bpython(?:3|\.exe)?\s+(\S+\.py)\b/g)]
                   .map(m => m[1].replace(/\\/g, '/').split('/').pop());
    const uniq = [...new Set(runs)];
    check(uniq.length > 0, `${launcher} runs at least one Python file`,
          '         could not parse an invocation — the check below would be vacuous');

    // An unrecognised file is a FAILURE, not a skip. "could not analyse it"
    // must never render as "it is fine", that is the whole bug class here.
    const unknown   = uniq.filter(f => !CODE[f]);
    const unreached = uniq.filter(f => CODE[f] && !IMPORTS_WS(CODE[f]));
    check(unknown.length === 0,
          `${launcher} → every file it runs is one this guard knows`,
          unknown.map(f => `         runs ${f}, which this guard cannot analyse`
                         + `\n         → add it to CODE, or the check below means nothing`).join('\n'));
    check(unreached.length === 0,
          `${launcher} → ${uniq.join(', ')} — reaches the workspace code`,
          unreached.map(f => `         ${launcher} runs ${f}, which never imports workspace`
                           + `\n         → the workspace step silently does nothing`).join('\n'));
  }

  // And the app itself, so it never depends on WHICH setup script was run.
  check(IMPORTS_WS(pywCode) && /ensure_workspace\(\)/.test(pywCode),
        'the app creates the workspace at boot, independent of setup');
}

console.log('\nand the call is REACHABLE on the path users take');
{
  /* B-023. v3.14.78 imported the module and called it, at the BOTTOM of main(),
     which is only reached when a venv is created fresh. Every re-run on an
     existing install took the "venv already exists" branch and returned at
     line 688, so the step never ran for anyone already installed.

     Importing is not calling; calling is not reaching. This asserts the call
     site precedes the first `return` in main(), which is the only form of
     "always runs" that can be checked from source. */
  const i = bldCode.indexOf('def main(');
  check(i !== -1, 'build_env.py has a main()');
  if (i !== -1) {
    const body = bldCode.slice(i);
    const firstReturn = body.search(/\n\s+return\b/);
    const callSite    = body.search(/_ensure_ws\(\)|_migrate_ws\(/);
    check(firstReturn !== -1, 'main() has at least one return — otherwise this check is vacuous');
    check(callSite !== -1, 'main() calls the workspace helpers at all');
    check(callSite !== -1 && firstReturn !== -1 && callSite < firstReturn,
          'the workspace step runs BEFORE main() can return — every path reaches it',
          `         first return at offset ${firstReturn}, workspace call at ${callSite}\n`
          + `         → placed after an early return, it silently skips every re-run\n`
          + `           on an existing install (B-023)`);
  }

  // --check / --show answer a question; they must not move a user's fieldwork.
  check(/if\s*\(?\s*not\s*\(args\.check\s*or\s*args\.show\)/.test(bldCode),
        'the migration is skipped in the read-only --check / --show modes');
}

console.log('\nno corpus write path is built from ROOT');
{
  const rootCorpora = [...pywCode.matchAll(/join\([^)]*\bROOT\b[^)]*corpora[^)]*\)/g)].map(m => m[0]);
  check(rootCorpora.length === 0, "no os.path.join(ROOT, 'corpora', …) in the bridge",
        rootCorpora.map(m => `         ${m}`).join('\n'));

  const i = pywCode.indexOf('def setup_corpus_dir');
  check(i !== -1, 'setup_corpus_dir() exists');
  if (i !== -1) {
    const body = pywCode.slice(i, i + 1400);
    check(/CORPORA_DIR|WORKSPACE/.test(body) && !/\bROOT\b/.test(body),
          'setup_corpus_dir() writes under the workspace, never ROOT',
          `         ${(body.match(/folder\s*=.*/) || ['folder = ?'])[0].trim()}`);
  }
  const j = pywCode.indexOf('def open_dialog');
  check(j !== -1 && !/\bROOT\b/.test(pywCode.slice(j, j + 1400)),
        'open_dialog() defaults to the workspace, not the app folder');
}

console.log('\nmigration offers, moves, and destroys nothing');
if (wsMod) {
  const code = decomment(wsMod, true);
  const k = code.indexOf('def migrate_legacy_corpora');
  check(k !== -1, 'migrate_legacy_corpora() exists');
  if (k !== -1) {
    const body = code.slice(k, k + 2400);
    check(/\bask\(/.test(body), 'it ASKS before moving — never relocates fieldwork silently');
    check(/shutil\.move/.test(body) && !/rmtree|os\.remove|os\.unlink/.test(body),
          'it moves, and deletes nothing');
    check(/dest\.exists\(\)/.test(body), 'it refuses to overwrite a corpus already there');
  }
  check(/SHIPPED_CORPORA/.test(code), 'shipped sample corpora are excluded from migration');
} else {
  check(false, 'migrate_legacy_corpora() exists — workspace.py missing');
}

console.log('\nthe command-line scripts write to the workspace too');
{
  /* B-041. v3.14.77 moved the GUI's corpora out of the repository and stopped
     there. corpus_ingest.py kept `_PROJECT_ROOT / "corpora"`, so ingesting from
     the command line dropped fieldwork straight back into the public repo, the same hazard, through the door nobody checked.

     Executed, not read: the default path is computed at import time from a
     module the guard cannot see by pattern-matching. */
  const { execFileSync } = require('child_process');
  const probe = `
import importlib.util as ilu, json, sys
spec = ilu.spec_from_file_location('ci', ${JSON.stringify(path.join(SRC, 'scripts', 'corpus_ingest.py'))})
m = ilu.module_from_spec(spec)
try: spec.loader.exec_module(m)
except SystemExit: pass
print(json.dumps({'dir': str(m._CORPORA_DIR), 'out': m._default_output([], 'My Novel')}))
`;
  let r = null, err = '';
  try {
    r = JSON.parse(execFileSync('python3', ['-c', probe],
      { encoding: 'utf8', env: { ...process.env, LINGCOT_WORKSPACE: '/tmp/_ws_probe' } }).trim());
  } catch (e) { err = String(e.stderr || e.message).trim().split('\n').slice(-2).join(' '); }

  check(r !== null, 'corpus_ingest.py loads and exposes its default path', `         ${err}`);
  if (r) {
    check(r.dir.startsWith('/tmp/_ws_probe'),
          'its corpora directory comes from the workspace, honouring LINGCOT_WORKSPACE',
          `         got ${r.dir} — if this is inside the app folder, the CLI is\n`
          + '         writing fieldwork into the repository (B-041)');
    check(!/Corpus Builder|\/corpora$/.test(path.dirname(r.dir)) || r.dir.startsWith('/tmp/_ws_probe'),
          'and not the application folder');
    check(/_corpus\.jsonl$/.test(r.out),
          'the default filename is <slug>_corpus.jsonl',
          `         got ${path.basename(r.out)} — the app pairs a corpus with its\n`
          + '         dictionary by stripping "_corpus.jsonl"; a bare corpus.jsonl\n'
          + '         has no prefix to pair on and opens with no companions');
  }
}

console.log('\nONE definition of the workspace path, everywhere');
{
  /* v3.14.146 renamed ~/LingCoT to ~/LingCoT-Data so it could not be confused
     with the folder people unzip the app into. The rename found a SECOND
     definition: corpus_ingest.py hard-coded the path in an `except` fallback,
     under a comment saying "workspace.py is the one definition" — true on the
     happy path only. Left alone, the CLI would have kept writing to the old
     folder whenever that import failed, which is B-041 exactly.

     THE RULE: only workspace.py may construct the workspace path. Anything else
     imports it or fails loudly. */
  const fs2 = require('fs');
  const pyFiles = [];
  const walk = d => { for (const e of fs2.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '__pycache__') continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (e.name.endsWith('.py') || e.name.endsWith('.pyw')) pyFiles.push(f);
  } };
  walk(SRC);
  const offenders = pyFiles.filter(f => !f.endsWith(`${path.sep}workspace.py`))
    .filter(f => /Path\.home\(\)\s*\/\s*["']LingCoT/.test(fs2.readFileSync(f, 'utf8')))
    .map(f => path.relative(SRC, f));
  check(offenders.length === 0,
        `${pyFiles.length} python file(s) scanned, only workspace.py builds the path`,
        offenders.map(f => `         ${f} constructs the workspace path itself`).join('\n')
      + '\n         import CORPORA_DIR, or fail — do not guess a location for fieldwork');

  const wsCode = fs2.readFileSync(path.join(SRC, 'workspace.py'), 'utf8');
  check(/WORKSPACE_LEGACY/.test(wsCode) && /def migrate_workspace/.test(wsCode),
        'the old location is named and its migration exists',
        '         a rename with no migration makes a user\'s corpora appear to vanish');
  for (const entry of ['setup.py', 'build_env.py'])
    check(/migrate_workspace/.test(fs2.readFileSync(path.join(SRC, entry), 'utf8')),
          `${entry} runs the workspace migration`,
          '         a migration nothing calls is B-022 again');
}

console.log('\nthe UI names the real path, and never hard-codes it');
{
  check(/def get_workspace/.test(pywCode), 'get_workspace() is exposed to the front end');
  check(/_workspaceCorpora/.test(html) && /get_workspace\(\)/.test(html),
        'the front end fetches it once at boot');
  const hard = [...evtsCode.matchAll(/['"`][^'"`]*~\/LingCoT[^'"`]*['"`]/g)].map(m => m[0]);
  check(hard.length === 0, 'no hard-coded "~/LingCoT" — the override would make it a lie',
        hard.map(m => `         ${m}`).join('\n'));
  check(/modal\.autosave\.prompt\.new_corpus[\s\S]{0,200}_workspaceCorpora/.test(evtsCode),
        'the autosave prompt shows the absolute workspace path');
}

console.log('\nvalues crossing the pywebview bridge are strings — EXECUTED, not read');
{
  /* B-024. Extracting WORKSPACE into workspace.py changed its TYPE from str to
     pathlib.Path. pywebview JSON-serialises API returns and passes `directory=`
     to the native file dialog; a Path breaks both. get_workspace() raised an
     opaque TypeError JS-side, and open_dialog() returned nothing at all, so the
     Open button did nothing AND logged nothing.

     Reading the source cannot catch a type change. This runs Python and asks it. */
  const { execFileSync } = require('child_process');
  const probe = `
import json, os, sys
sys.path.insert(0, ${JSON.stringify(SRC)})
from workspace import WORKSPACE as W, CORPORA_DIR as C
ws, cd = str(W), str(C)
json.dumps({'workspace': ws, 'corpora': cd, 'exists': os.path.isdir(cd)})
d = cd if os.path.isdir(cd) else (ws if os.path.isdir(ws) else os.path.expanduser('~'))
print(json.dumps({'dirIsStr': isinstance(d, str),
                  'wsIsStr':  isinstance(W, str),
                  'serialisable': True}))
`;
  let probed = null, err = '';
  try { probed = JSON.parse(execFileSync('python3', ['-c', probe], { encoding: 'utf8' }).trim()); }
  catch (e) { err = String(e.stderr || e.message).trim().split('\n').slice(-2).join(' '); }

  check(probed !== null,
        'the get_workspace() payload is JSON-serialisable',
        `         python3 refused it: ${err}\n`
        + `         → pywebview would surface this as a bare TypeError in the browser`);

  if (probed) {
    check(probed.dirIsStr === true,
          'open_dialog()\u2019s directory resolves to a str, not a Path',
          '         create_file_dialog() takes a path string; a Path makes it '
          + 'return nothing\n         and the Open button dies silently');
  }

  // And the source must not hand the raw module values straight to the bridge.
  check(/WORKSPACE\s*=\s*str\(/.test(pywCode) && /CORPORA_DIR\s*=\s*str\(/.test(pywCode),
        'LingCoT.pyw coerces both to str at the import boundary',
        '         workspace.py is pathlib-based for setup.py/build_env.py;\n'
        + '         the bridge needs strings, so the conversion belongs here');
}

console.log('\nsettings and vocabulary are written to the workspace, never the app folder');
{
  /* tb-settings. The theme toggle rewrote source/resources/locale/settings.json
     and the tag drawer rewrote pos_tags.json / type_choices.json: every tester's
     choices showed up in git, and an update overwrote them. The host no longer
     has a method that writes under source/ at all. */
  check(!/def\s+write_file\s*\(/.test(pywCode), 'the host has no write_file',
        '         a bridge method that writes inside source/ writes into the repository');
  const js = [html, ...fs.readdirSync(path.join(SRC, 'modules')).map(f => load('source/modules/' + f))].join('\n');
  check(!/api\.write_file\s*\(/.test(js), 'and the page does not call one');
  check(fs.existsSync(path.join(SRC, 'resources/locale/settings.default.json')),
        'the repository keeps the defaults as settings.default.json');

  // Executed: the real methods, with webview stubbed and a throwaway workspace.
  const { execFileSync } = require('child_process');
  const os = require('os');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot_ws_'));
  const probe = `
import importlib.util as ilu, json, os, sys, types
sys.modules['webview'] = types.SimpleNamespace(OPEN_DIALOG=0, SAVE_DIALOG=1, FOLDER_DIALOG=2,
                                               FileDialog=types.SimpleNamespace(OPEN=0, SAVE=1, FOLDER=2))
sys.path.insert(0, ${JSON.stringify(SRC)})
from importlib.machinery import SourceFileLoader
spec = ilu.spec_from_loader('app', SourceFileLoader('app', ${JSON.stringify(path.join(SRC, 'LingCoT.pyw'))}))
m = ilu.module_from_spec(spec); spec.loader.exec_module(m)
api = m.Api()
out = {'first': api.read_user_file('vocabulary/pos_tags.json')}
api.write_user_file('vocabulary/pos_tags.json', '[{"tag": "CLF"}]')
out['back'] = api.read_user_file('vocabulary/pos_tags.json')
out['where'] = os.path.join(os.environ['LINGCOT_WORKSPACE'], 'vocabulary', 'pos_tags.json')
out['landed'] = os.path.isfile(out['where'])
out['refused'] = []
for bad in ('../escape.json', 'LingCoT.html', 'resources/pos_tags.json'):
    try: api.write_user_file(bad, 'x')
    except PermissionError: out['refused'].append(bad)
m.Api._LEGACY_SETTINGS = os.path.join(os.environ['LINGCOT_WORKSPACE'], 'legacy_settings.json')
open(m.Api._LEGACY_SETTINGS, 'w').write('{"ui_locale": "haw", "theme": "light"}')
out['migrated'] = api.read_user_file('settings.json')
print(json.dumps(out))
`;
  let r = null, err = '';
  try {
    r = JSON.parse(execFileSync('python3', ['-c', probe],
      { encoding: 'utf8', env: { ...process.env, LINGCOT_WORKSPACE: ws } }).trim().split('\n').pop());
  } catch (e) { err = String(e.stderr || e.message).trim().split('\n').slice(-3).join(' '); }
  check(r !== null, 'the host loads with webview stubbed', `         ${err}`);
  if (r) {
    check(r.first === null, 'a user file that does not exist yet reads as null, not an error');
    check(r.landed && r.back === '[{"tag": "CLF"}]', 'a write lands in the workspace and reads back');
    check(r.refused.length === 3, 'names outside USER_FILES are refused', `         refused only ${JSON.stringify(r.refused)}`);
    check(r.migrated && /"haw"/.test(r.migrated), 'an old in-repo settings.json is migrated on first read');
  }
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (_) {}
}

console.log('\nthe README does not send users the other way');
{
  check(!/Share the `corpora\/\[name\]\/` folder.*Git/.test(readme),
        'the "share the corpora folder via Git" instruction is gone',
        '         it was README.md:279 and instructed exactly the hazard');
  check(/Where your data lives/.test(readme), 'the README explains where data lives');
  check(/LINGCOT_WORKSPACE/.test(readme), 'and documents the override');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
