#!/usr/bin/env node
/* =============================================================================
   locale_style_test.js, en.json keeps the house style settled at v3.15.1
   Run:  node dev/tests/locale_style_test.js
   =============================================================================
   The wording review (v3.15.1) settled these; each check fails on the first
   string that drifts back. Linguistic resource strings (pos/dep/gloss/type/sel)
   are not interface wording and are exempt.
     · one name per concept: "dictionary", never "lexicon" or "dict";
       "part of speech", never "POS"/"PoS"
     · short labels and buttons that start with a capital are in Title Case
     · words inserted into other sentences (gap.name, gap.field, label.kind)
       start lowercase: "3 words need a gloss"
     · no ellipsis on buttons or placeholders, no arrows on labels
   ============================================================================= */

const { read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
const list = xs => xs.slice(0, 12).map(([k, v]) => `         ${k}: ${JSON.stringify(v)}`).join('\n')
  + (xs.length > 12 ? `\n         … and ${xs.length - 12} more` : '');

const EN = JSON.parse(read('resources/locale/en.json'));
const UI = Object.entries(EN).filter(([k]) => k !== '_meta' && !/^(pos|dep|gloss|type|sel)\./.test(k));
const plain = v => v.replace(/<[^>]+>/g, ' ');

console.log('\none name per concept\n');
{
  const bad = UI.filter(([, v]) => /\blexicons?\b|\bdict\b(?![_.])/i.test(plain(v)));
  check(!bad.length, '"dictionary", never "lexicon" or "dict"', list(bad));
  const pos = UI.filter(([, v]) => /\bPOS\b|\bPoS\b/.test(plain(v)));
  check(!pos.length, '"part of speech", never "POS" or "PoS"', list(pos));
}

console.log('\ncapitals\n');
{
  const SMALL = new Set(['a','an','the','and','or','nor','but','of','to','in','on','at','for','by','with','from','as','per','vs','into','via']);
  const capWord = (w, first) => (/[A-Z]/.test(w.slice(1)) || /\d|_/.test(w) || (SMALL.has(w.toLowerCase()) && !first))
    ? w : w[0].toUpperCase() + w.slice(1);
  // Same rule as the v3.15.1 normalizer: skip parentheses, {placeholders} and .extensions.
  const title = v => { let depth = 0, first = true;
    return v.split(/(\s+)/).map(t => {
      if (!t.trim()) return t;
      if (depth || t.startsWith('(') || t.includes('{') || t.startsWith('.')) {
        depth += (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length; first = false; return t; }
      const m = /^([^\w]*)([\w’'/-]+)(.*)$/.exec(t); if (!m) return t;
      const w = m[2].split(/([/-])/).filter(p => p !== '').map((p, i) => '/-'.includes(p) ? p : capWord(p, first && i === 0)).join('');
      first = false; return m[1] + w + m[3];
    }).join(''); };
  const content = v => (v.match(/[A-Za-z][\w’'/-]*/g) || []).filter(w => !SMALL.has(w.toLowerCase()));
  const short = UI.filter(([k, v]) =>
    /^(btn|label|bc|hdr|aria|option|chip|nav|copy\.col|offer\.field|sp\.label)\./.test(k) && !/\.status\./.test(k)
    && !/^(gap\.name|gap\.field|label\.kind|copy\.key)\./.test(k)
    && /^[+＋]?\s*[A-Z]/.test(v) && content(v).length <= 4
    && !/[.?!]\s*$|[.?!]\s|:|\n|<| — |·/.test(v) && !/^(The|A|An|No)\s/.test(v));
  const bad = short.filter(([, v]) => title(v) !== v).map(([k, v]) => [k, `${v} (expected ${title(v)})`]);
  check(short.length > 100 && !bad.length, `${short.length} short labels and buttons are in Title Case`, list(bad));
  const mid = UI.filter(([k, v]) => /^(gap\.name|gap\.field|label\.kind)\./.test(k) && /^[A-Z]/.test(v));
  check(!mid.length, 'words inserted into sentences start lowercase ("3 words need a gloss")', list(mid));
}

console.log('\npunctuation on controls\n');
{
  // An "e.g." list may trail off with …; that is content, not a control label.
  const ell = UI.filter(([k, v]) => /^(btn|placeholder)\./.test(k) && !/^e\.g\./.test(v) && /(…|\.\.\.)\s*$/.test(v));
  check(!ell.length, 'no ellipsis at the end of a button or placeholder', list(ell));
  const arrow = UI.filter(([k, v]) => /^(btn|label|title|bc|hdr|aria)\./.test(k) && v.length <= 60
    && (/^[→←]\s/.test(v) || /\s[→←]$/.test(v) || /\((→|←)\)\s*$/.test(v)));
  check(!arrow.length, 'no arrow at either end of a label, button or title', list(arrow));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
