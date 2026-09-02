#!/usr/bin/env node
/* =============================================================================
   input_attrs_test.js, every text control must resist macOS autocorrect
   Run:  node dev/tests/input_attrs_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-009 (2026-08-24). Typed text was being capitalized against the user's
   intent in the morphological parse, constituent morphemes and alternate forms.

   `autocapitalize` affects VIRTUAL keyboards only, per spec it does nothing on
   a physical keyboard, which is the only input method a desktop WKWebView sees.
   The app carried 70 of them and zero `autocorrect`, so its entire defence
   targeted a mechanism that never fires here. What actually capitalizes the text
   is macOS's text-checking layer, which WebKit gates on `autocorrect="off"`
   (with `spellcheck="false"` covering part of the same surface).

   THE RULE CHANGED AT v3.14.125, and the change is the interesting part.

   B-009 protected an allowlist of linguistic fields and deliberately left prose
   and personal names native, on the reasoning that a definition or a name wants
   a capital and a spell-check. That reasoning assumed the text would be English.

   It will not be. This is a language-documentation tool, it is meant to be
   ported, and any field can hold any language including low-resource ones. A
   definition written in Hawaiian, a consultant's name in a language macOS has
   never seen, a dictionary search for a Turkish form: autocorrect damages all of
   them, and a red underline under every word is noise rather than help. There is
   no field in this app that can be assumed to be English.

   So the rule is now universal, which also makes it checkable rather than
   curated: EVERY text-bearing control carries the shared constants. An allowlist
   has to be maintained and can drift; "all of them" cannot.

   WHAT THIS CHECKS
   ----------------
   1. No text-bearing control anywhere lacks autocorrect protection.
   2. The shared constants exist and are what fields use, so the policy stays one
      source of truth rather than N hand-edited tag sites.
   3. Non-text controls (checkbox, radio, number, file) are left alone.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { SRC, decomment } = require('./_source.js');
const FILES = [
  ['LingCoT.html',            path.join(SRC, 'LingCoT.html')],
  ['modules/participants.js', path.join(SRC, 'modules', 'participants.js')],
  ['modules/events.js',       path.join(SRC, 'modules', 'events.js')],
  ['modules/search.js',       path.join(SRC, 'modules', 'search.js')],
];

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Text-bearing means the user types free text into it: <textarea>, and <input>
   whose type is text/search or absent. Checkboxes and radios carry no text. */
function controls() {
  const out = [];
  for (const [name, p] of FILES) {
    if (!fs.existsSync(p)) continue;
    /* v3.14.300: comments are blanked before the scan. This matched `<input>`
       written in PROSE — a comment explaining why the parse guide is not an
       overlay was reported as an unprotected control with "(no id)". It had
       never come up because no comment had happened to name the tag, which is
       luck rather than coverage. `decomment` keeps line numbers, so the
       positions reported below are still the file's own. */
    const src = decomment(fs.readFileSync(p, 'utf8'));
    const sm = /<script(?![^>]*src=)[^>]*>/.exec(src);
    const scriptStart = sm ? sm.index : -1;
    const scriptEnd   = sm ? src.indexOf('</script>', scriptStart) : -1;
    for (const m of src.matchAll(/<(input|textarea)\b([^>]*)>/g)) {
      const [, tag, attrs] = m;
      const t = /type="([^"]+)"/.exec(attrs);
      const type = t ? t[1] : (tag === 'textarea' ? 'textarea' : 'text');
      const id = (/id="([^"]*)"/.exec(attrs) || [, '(no id)'])[1];
      /* A control in LingCoT.html's STATIC markup cannot use the constant:
         `${LING_ATTRS}` outside a template literal renders as visible source
         text, which is B-012. Those write the attributes literally instead, and
         the two regions are checked differently below. */
      const inScript = name !== 'LingCoT.html'
                    || (m.index > scriptStart && m.index < scriptEnd);
      out.push({ file: name, tag, attrs, type, id, inScript,
                 line: src.slice(0, m.index).split('\n').length });
    }
  }
  return out;
}

const all  = controls();
const text = all.filter(c => ['text', 'search', 'textarea'].includes(c.type));

console.log('\nevery text control resists autocorrect\n');
{
  check(text.length > 60, `${text.length} text controls found across ${FILES.length} files`,
        '         a sharp drop here means the scan stopped matching, not that fields vanished');

  const unprotected = text.filter(c => !/LING_ATTRS/.test(c.attrs) && !/autocorrect="off"/.test(c.attrs));
  check(unprotected.length === 0,
        'no text control is left unprotected',
        unprotected.map(c => `         ${c.file}:${c.line}  ${c.id}`).join('\n')
        + '\n         Any field may hold any language. There is no English-only field here.');
}

console.log('\nthe policy lives in shared constants, not in N tag sites\n');
{
  const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
  // (constants are declarations, not markup — read raw, comments and all)
  for (const [name, want] of [
    ['LING_ATTRS',       /const LING_ATTRS\s*=\s*'[^']*autocorrect="off"[^']*'/],
    ['LING_ATTRS_UPPER', /const LING_ATTRS_UPPER\s*=\s*'[^']*autocorrect="off"[^']*'/],
  ]) check(want.test(html), `${name} exists and carries autocorrect="off"`);

  check(/const LING_ATTRS\s*=\s*'[^']*spellcheck="false"/.test(html),
        'and spellcheck="false", which is the other half of the same surface',
        '         a red underline under every word of a low-resource language is noise, not help');

  const dyn    = text.filter(c => c.inScript);
  const static_ = text.filter(c => !c.inScript);

  const notConst = dyn.filter(c => !/LING_ATTRS/.test(c.attrs));
  check(notConst.length === 0,
        `all ${dyn.length} controls inside template literals use the constants`,
        notConst.map(c => `         ${c.file}:${c.line}  ${c.id}`).join('\n')
        + '\n         hand-written attributes drift; the constants are why this is one decision');

  const badStatic = static_.filter(c =>
    !/autocorrect="off"/.test(c.attrs) || !/spellcheck="false"/.test(c.attrs));
  check(badStatic.length === 0,
        `all ${static_.length} controls in static markup carry the attributes literally`,
        badStatic.map(c => `         ${c.file}:${c.line}  ${c.id}`).join('\n'));

  const leaked = static_.filter(c => /\$\{/.test(c.attrs));
  check(leaked.length === 0,
        'and none of them interpolates, which would render as visible source text (B-012)',
        leaked.map(c => `         ${c.file}:${c.line}  ${c.id}`).join('\n'));
}

console.log('\nnon-text controls are left alone\n');
{
  const others = all.filter(c => !['text', 'search', 'textarea'].includes(c.type));
  const meddled = others.filter(c => /LING_ATTRS|autocorrect=/.test(c.attrs));
  check(meddled.length === 0,
        `${others.length} checkbox/radio/number controls carry no text attributes`,
        meddled.map(c => `         ${c.file}:${c.line}  ${c.id} (${c.type})`).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
