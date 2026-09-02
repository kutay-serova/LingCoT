#!/usr/bin/env node
/* =============================================================================
   dict_dedupe.js — find dictionary entries the OLD key forked apart
   Run:  node source/scripts/dict_dedupe.js <corpus-dir-or-dictionary.jsonl> [lang]
   =============================================================================
   B-043. Until v3.14.103 the dictionary key was `form.toLowerCase()`. In
   Turkish that maps "İstanbul" to "i"+U+0307 rather than "istanbul", so a
   capitalised token never matched its own lemma and `_resolveOrCreateLemma`
   created a second entry — silently, because its miss branch is its create
   branch.

   This REPORTS; it never rewrites. Merging two dictionary entries is a
   linguistic judgement (they may be genuine homographs), and the whole reason
   B-043 was destructive is that a program made that judgement without asking.

   It imports the real key from modules/normalize.js rather than reimplementing
   it — a copy would test the copy (B-037).
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const N    = require(path.join(__dirname, '..', 'modules', 'normalize.js'));

const target = process.argv[2];
const lang   = process.argv[3] || null;
if (!target) {
  console.error('usage: node source/scripts/dict_dedupe.js <corpus-dir|dictionary.jsonl> [lang]');
  process.exit(2);
}

let dictPath = target;
if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
  const hit = fs.readdirSync(target).find(f => /_dictionary\.jsonl$/.test(f));
  if (!hit) { console.error(`no *_dictionary.jsonl in ${target}`); process.exit(2); }
  dictPath = path.join(target, hit);
}
if (!fs.existsSync(dictPath)) { console.error(`not found: ${dictPath}`); process.exit(2); }

const entries = fs.readFileSync(dictPath, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const sample = entries.map(e => e.form || '').join(' ');
const script = N.detectScript(sample);
const locale = N.CASE_TAILORED_LOCALES[(lang || '').toLowerCase().split(/[-_]/)[0]] || null;

const keyV1 = f => (f || '').toLowerCase();
const keyV2 = f => N.dictKeyIn(f, locale, script);

console.log(`\n${path.basename(dictPath)} — ${entries.length} entries`);
console.log(`fold context: locale=${locale || 'default'}  script=${script || 'none'}`
          + (lang ? '' : '   (no language given — pass one to enable case tailoring)'));

const groups = new Map();
for (const e of entries) {
  const k = keyV2(e.form) + ' ' + (e.type || '');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(e);
}

let forks = 0, homographs = 0;
for (const [k, g] of groups) {
  if (g.length < 2) continue;
  const oldKeys = new Set(g.map(e => keyV1(e.form)));
  if (oldKeys.size < 2) { homographs++; continue; }
  forks++;
  console.log(`\n  -- ${g[0].type || '(no type)'} · ${g.map(e => JSON.stringify(e.form)).join('  vs  ')}`);
  for (const e of g) {
    const gloss = e.gloss || e.meaning || '—';
    console.log(`     ${e.id}  form=${JSON.stringify(e.form)}  pos=${e.part_of_speech || '—'}  gloss=${gloss}`);
  }
}

console.log(`\n${forks} probable fork(s) — same entry, split by the old key`);
console.log(`${homographs} same-key group(s) the old key ALSO merged `
          + `— pre-existing homographs, not caused by B-043`);
if (forks) console.log('\nNothing was changed. Merge by hand in the app, or confirm they are genuine homographs.\n');
else       console.log('\nNo forks found.\n');
