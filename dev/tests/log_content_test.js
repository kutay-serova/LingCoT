#!/usr/bin/env node
/* =============================================================================
   log_content_test.js, no log call carries annotation content (B-231)
   Run:  node dev/tests/log_content_test.js
   =============================================================================
   PRACTICES §8: logs never hold annotation content. B-219 removed one instance
   and nothing guarded the rule, so eight more were found in the post-test
   review: forms in "dict entry saved", "dictionary entries added", "offer
   filled nothing", the re-tokenization warning, lemma lines and navigation.

   Reads every logEvent(...) call in the app's JavaScript and fails on an
   interpolated value that names content: `.form`, `.gloss`, `.text`, `.title`,
   `.translation`, a variable ending in `Form`, or a bare `form`, `names`,
   `gloss` or `text`. Ids, counts and outcomes are
   what a log line may carry.
   ============================================================================= */
const { read, moduleFiles } = require('./_source.js');
let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// @fn calls, every logEvent(...) call's argument text, balanced on parentheses
function calls(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('logEvent(', i)) !== -1) {
    if (/function\s+$/.test(src.slice(Math.max(0, i - 12), i))) { i += 9; continue; }
    let depth = 0, j = i + 8, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}

const CONTENT = /(\.(form|gloss|text|title|translation|citation)\b(?!\s*\.length))|\b\w+Form\b(?!\s*\.length)|(^|[^.\w])(form|forms|names|gloss|text)\b(?!\s*\.length)/;
// Expressions inside ${...}, and bare (non-literal) arguments after the first two.
const exprs = c => [...c.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1])
  .concat(c.replace(/`[^`]*`|'[^']*'|"[^"]*"/g, '""').split(',').slice(1).map(x => x.trim()));

const files = [['LingCoT.html', read('LingCoT.html')], ...moduleFiles()];
let total = 0;
const bad = [];
for (const [name, src] of files) {
  for (const c of calls(strip(src))) {
    total++;
    const hit = exprs(c).find(e => CONTENT.test(e));
    if (hit) bad.push(`${name}: ${c.replace(/\s+/g, ' ').slice(0, 140)}`);
  }
}
console.log('\nlog calls carry ids and counts, not annotation content\n');
check(total > 80, `${total} logEvent calls read`);
check(bad.length === 0, 'no logEvent call interpolates a form, gloss, text or title',
      bad.map(b => '         ' + b).join('\n'));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
