#!/usr/bin/env node
/* =============================================================================
   license_assets_test.js, every bundled asset is accounted for in LICENSE.txt
   Run:  node dev/tests/license_assets_test.js
   =============================================================================
   B-066 and B-067 were both found by looking, not by any process: a CC BY-SA
   corpus in an MIT repo, then 1.1 MB of OFL fonts named nowhere. Two in a row
   is a missing check, not bad luck.

   THE RULE: anything shipped that somebody else made must be named in
   LICENSE.txt, and any licence file that entry points at must exist.

   A licence notice added after publication does not cover copies already taken,
   so this has to hold at `git init` and every commit after it.

   Scope note: this guard reads what is in the tree. An asset that is
   gitignored is checked differently, it must be named as NOT distributed, which
   is the NLLB weights case (CC-BY-NC, incompatible with MIT).
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { ROOT, SRC, isGitignored } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const LICENSE = fs.readFileSync(path.join(ROOT, 'LICENSE.txt'), 'utf8');

/* Third-party file types. Source code in this tree is the author's; binaries
   and vendored data are what arrive from elsewhere. */
const ASSET_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot',
                           '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
                           '.bin', '.model', '.onnx', '.pt', '.safetensors']);
const SKIP_DIR  = new Set(['__pycache__', '.git', 'node_modules', '.venv']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(dir, e.name), out); }
    else out.push(path.join(dir, e.name));
  }
  return out;
}

const files  = walk(SRC);
const assets = files.filter(f => ASSET_EXT.has(path.extname(f).toLowerCase()));

/* Directory prefixes .gitignore excludes. An asset under one of these is not
   distributed, so it is accounted for by being named as excluded rather than
   by being licensed. */
const { ignoredDirs: _igDirs } = require('./_source.js');
const ignoredDirs = _igDirs();
const isIgnored = rel => isGitignored(rel);

console.log('\nevery bundled asset is named in LICENSE.txt\n');
{
  check(assets.length > 0, `found ${assets.length} asset file(s) to account for`,
        '         zero means the walk broke, not that the tree is clean');
  for (const a of assets) {
    const rel  = path.relative(ROOT, a);
    const base = path.basename(a);
    const dir  = path.relative(ROOT, path.dirname(a));
    if (isIgnored(rel)) {
      // Not shipped. It still has to be declared, so nobody commits it later.
      const prefix = ignoredDirs.find(d => rel.startsWith(d));
      check(LICENSE.includes(prefix),
            `${rel} is gitignored, and ${prefix} is declared as not distributed`,
            '         an excluded asset nobody wrote down gets committed by the next person');
      continue;
    }
    // Named directly, or by the directory that holds it. Either identifies it.
    check(LICENSE.includes(base) || LICENSE.includes(dir) || LICENSE.includes(dir + '/'),
          `${rel} is named`,
          '         an unnamed binary is exactly how B-067 happened');
  }
}

console.log('\nlicence files the notice points at exist and say what they claim\n');
{
  const ofl = path.join(SRC, 'resources', 'fonts', 'OFL.txt');
  check(fs.existsSync(ofl), 'source/resources/fonts/OFL.txt exists',
        '         the OFL requires the licence text to travel with the font');
  if (fs.existsSync(ofl)) {
    const t = fs.readFileSync(ofl, 'utf8');
    check(/SIL OPEN FONT LICENSE Version 1\.1/.test(t), 'and it is OFL 1.1, not a summary');
    check(/Copyright 2015-2021 Google LLC/.test(t),
          'and it carries the font\'s own copyright line',
          '         condition 2 requires the notice, not just the licence body');
    check(/TERMINATION/.test(t) && /DISCLAIMER/.test(t), 'and it is the complete text');
  }
  // Every path LICENSE.txt names must resolve.
  const refs = [...LICENSE.matchAll(/source\/[A-Za-z0-9_\-./]+/g)]
    .map(m => m[0].replace(/\.$/, ''));   // a path at the end of a sentence
  /* A gitignored path is SUPPOSED to be absent on a clone: source/models/ is
     named precisely to say the weights are not distributed. Requiring it to
     exist made this guard fail on every clone (v3.14.135). */
  const missing = [...new Set(refs)]
    .filter(r => !isGitignored(r) && !fs.existsSync(path.join(ROOT, r)));
  check(missing.length === 0,
        `${new Set(refs).size} path(s) in LICENSE.txt resolve, or are declared as not distributed`,
        `         missing: ${missing.join(', ')}`);
}

console.log('\nthe non-commercial weights are excluded, and said to be\n');
{
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  check(/^source\/models\//m.test(gi), '.gitignore excludes source/models/',
        '         CC-BY-NC weights in an MIT repo is a licence conflict, not untidiness');
  check(/CC-BY-NC/.test(LICENSE) && /Not Distributed/i.test(LICENSE),
        'LICENSE.txt says the weights are not distributed and why');
}

console.log('\nthe vendored icon sprite is attributed\n');
{
  const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
  const hasSprite = html.includes('id="ph-sprite"');
  check(hasSprite, 'the Phosphor sprite is present in LingCoT.html');
  check(!hasSprite || /Phosphor Icons/.test(LICENSE),
        'and Phosphor Icons is named in LICENSE.txt',
        '         MIT still requires the copyright notice to travel with the copy');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
