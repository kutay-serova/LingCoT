#!/usr/bin/env node
/* =============================================================================
   readme_tree_test.js, the README's File Structure must describe the real tree
   Run:  node dev/tests/readme_tree_test.js
   =============================================================================
   DOCS_AUDIT §1. The section listed seven paths at the repository root that
   actually live under source/, named a `data/` directory that does not exist,
   filed lang_utils.py under scripts/ when it is in resources/, and omitted
   source/modules/ entirely, five JS files and ~360 KB, where most of the app
   now lives. It is the first thing a contributor reads and following it led
   nowhere.

   It rotted because nothing checked it. A directory tree in prose is a second
   copy of something the filesystem already knows, and the two drift the moment
   anything moves, which they did, at the v3.14.76 restructure and again when
   version.py and workspace.py were added.

   This walks the tree the README draws and requires every path in it to exist.
   It deliberately does NOT require the reverse: a README that lists every file
   would be unreadable, and choosing what to show is editorial. What it enforces
   is that nothing shown is a lie.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC, isGitignored } = require('./_source.js');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Pull the fenced block out of the File Structure section. */
const secStart = readme.indexOf('## File Structure');
const secEnd   = readme.indexOf('\n## ', secStart + 5);
const section  = secStart === -1 ? '' : readme.slice(secStart, secEnd === -1 ? undefined : secEnd);
const fence    = /```\n([\s\S]*?)```/.exec(section);

console.log('\nthe section exists and draws a tree\n');
check(secStart !== -1, 'README has a File Structure section');
check(fence !== null, 'it contains a fenced tree block',
      '         nothing to verify — the checks below would be vacuous');
if (!fence) { console.log(`\n${pass} passed, ${fail} failed\n`); process.exit(1); }

/* Walk the ASCII tree, tracking indent depth to rebuild each full path. */
const entries = [];
{
  const stack = [];                       // directory name per depth level
  for (const line of fence[1].split('\n')) {
    const m = /^([│\s]*)[├└]──\s+([^\s]+)/.exec(line);
    if (!m) continue;
    const depth = Math.round(m[1].length / 4);
    let name = m[2];
    if (name === 'LingCoT/') continue;

    // "setup.command / setup.bat" and "README.md · setup.md · LICENSE.txt" list
    // siblings on one line; the regex takes the first, so split the whole line.
    const rest = line.slice(line.indexOf(name));
    const alts = rest.split(/\s+(?:\/|·)\s+/).map(x => x.trim().split(/\s{2,}/)[0]);

    const isDir = name.endsWith('/');
    const clean = n => n.replace(/\/$/, '');
    stack.length = depth;
    const parent = stack.slice(0, depth).map(clean).join('/');

    for (const a of alts) {
      if (!/^[A-Za-z0-9_.*-]+\/?$/.test(a)) continue;
      entries.push({ rel: parent ? `${parent}/${clean(a)}` : clean(a), raw: a, dir: a.endsWith('/') });
    }
    if (isDir) stack[depth] = name;
  }
}

console.log(`\nwalking ${entries.length} paths drawn in the tree`);
check(entries.length > 30, `${entries.length} paths parsed`,
      '         parsed too few — the tree format may have changed and this check\n'
      + '         would silently verify almost nothing');

{
  /* Entries that are generated, downloaded, or deliberately not distributed are
     legitimately absent from a fresh clone. v3.14.135 replaced the hand-list
     with .gitignore itself: an allowlist has to be maintained and this one had
     already drifted (it named source/config/annotator_config.json but not the
     directory holding it, and dev/archive/ was added to .gitignore later).
     `logs/` is kept by name because .gitignore excludes logs/*.log rather than
     the directory, and the directory is created at first run. */
  const MAY_BE_ABSENT = new Set(['logs']);
  const absentOnClone = rel => MAY_BE_ABSENT.has(rel) || isGitignored(rel);

  const missing = [];
  for (const e of entries) {
    if (absentOnClone(e.rel)) continue;
    // A wildcard entry (selection_*.json) must match at least one real file.
    if (e.raw.includes('*')) {
      const dir = path.join(ROOT, path.dirname(e.rel));
      const re  = new RegExp('^' + path.basename(e.rel).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      const hit = fs.existsSync(dir) && fs.readdirSync(dir).some(f => re.test(f));
      if (!hit) missing.push(`         ${e.rel} — no file matches this pattern`);
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, e.rel)))
      missing.push(`         ${e.rel} — drawn in the README, not on disk`);
  }
  check(missing.length === 0, 'every path drawn in the tree exists',
        missing.join('\n') + '\n         → the section a contributor reads first is wrong');
}

console.log('\nthe pieces that matter most are shown at all');
{
  /* Not a full inventory, just the things whose absence made the old section
     actively misleading. */
  const MUST_MENTION = ['source/', 'modules/', 'resources/', 'scripts/', 'dev/',
                        'LingCoT.html', 'LingCoT.pyw', 'locale/'];
  const absent = MUST_MENTION.filter(m => !section.includes(m));
  check(absent.length === 0, 'source/, modules/, resources/, scripts/, dev/ and locale/ appear',
        absent.map(a => `         ${a} is not shown — it was omitted before, and that\n`
                      + `         is what sent contributors to the wrong place`).join('\n'));

  check(/Where your data lives/.test(section),
        'and it points at Where your data lives',
        '         a tree of the app folder invites the assumption that corpora are\n'
        + '         in it; they have not been since v3.14.77');
}

console.log('\nlocal files the README links or embeds must exist\n');
{
  /* v3.14.150. The tree check above proves the drawn paths exist; it says nothing
     about the paths the prose LINKS. A README that renders a broken image is the
     first thing a visitor sees, and B-076 showed that nothing was checking README
     claims at all. External URLs are out of scope, they need the network. */
  const links = [...readme.matchAll(/!?\[[^\]]*\]\(([^)#][^)]*)\)/g)]
    .map(m => m[1].trim())
    .filter(l => !/^(https?:|mailto:|#)/.test(l));
  const missing = [...new Set(links)]
    .filter(l => !fs.existsSync(path.join(ROOT, l.replace(/^\.\//, ''))));
  check(links.length > 0, `${new Set(links).size} local link(s)/image(s) referenced`,
        '         zero means the scan broke, not that the README links nothing');
  check(missing.length === 0, 'every one of them resolves on disk',
        missing.map(l => `         ${l} — linked from the README, not on disk`).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
