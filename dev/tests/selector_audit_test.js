#!/usr/bin/env node
/* =============================================================================
   selector_audit_test.js. JS selectors must target classes that exist
   Run:  node dev/tests/selector_audit_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   Twice now a rename has updated the CSS and the markup and left selectors
   behind, and both times the result shipped silently because a selector that
   matches nothing throws no error:

     B-002 (2026-08-06), dark-mode overrides targeted `.latex-section*`, a class
       no element carries.  The LaTeX export panel stayed near-white in dark mode
       with near-white text: invisible.  Caught by theme_audit_test.js check 2,
       which compares CSS selectors against the markup.

     B-007 (2026-08-06), the v3.13.4–8 chip unification renamed every chip class
       to `.chip`, updated the CSS and the markup, and left TWELVE JavaScript
       selectors on `.pos-chip`, `.morph-chip`, `.dict-type-chip`, `.ann-chip`.
       Four whole features stopped responding to clicks.  Nothing caught it, theme_audit only looks at CSS, and the one unit test that would have
       noticed was asserting the old names too.

   This file closes that gap for the JS side: every class named in a
   querySelector / querySelectorAll / closest / matches call must appear in some
   `class="…"` in the markup.

   LIMITS, deliberately a lint, not a proof:
   · Class names built at runtime (`'.' + x`) are invisible here.
   · A class emitted anywhere counts as emitted; this cannot tell you the element
     is the *right* one, only that the name is not extinct.
   · Dynamically added classes (classList.add) are collected as emitted, since a
     selector may legitimately target them.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const FILES = ['LingCoT.html',
  ...fs.readdirSync(path.join(SRC, 'modules')).map(f => path.join('modules', f))];

let corpus = '';
const perFile = {};
for (const f of FILES) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  perFile[f] = text;
  corpus += '\n' + text;
}

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Every class name that reaches the DOM: literal class="…" attributes, plus
   classList.add/toggle/remove and className assignments. */
const emitted = new Set();
for (const m of corpus.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (c) emitted.add(c);
}
for (const m of corpus.matchAll(/classList\.(?:add|remove|toggle)\(\s*'([^']+)'/g)) emitted.add(m[1]);
/* I2, v3.14.404: `rowEditorHtml` writes `class="${editorClass}"`, and line 60
   strips `${...}` — correctly, since it cannot know the value. The values are
   still literals, one directory over, at the four call sites that name them. A
   class declared as a property is emitted exactly as much as one written into an
   attribute; this harvests those three keys so the scanner keeps seeing them. */
for (const m of corpus.matchAll(/(?:editorClass|rowsClass|addClass):\s*'([\w-]+)'/g)) emitted.add(m[1]);
for (const m of corpus.matchAll(/className\s*=\s*'([^']+)'/g)) {
  for (const c of m[1].split(/\s+/)) if (c) emitted.add(c);
}
/* Class names produced by template interpolation, e.g. `class="chip ${cls}"`, collect the literal strings those variables can hold, conservatively, by
   sweeping every quoted word that looks like a class in a ternary. */
for (const m of corpus.matchAll(/\?\s*'\s*([\w-]+)\s*'\s*:/g)) emitted.add(m[1]);

/* Selectors used from JS.  Only simple leading-class selectors are checked, attribute qualifiers and descendant parts are stripped first. */
const SELECTOR_CALL = /(?:querySelectorAll|querySelector|closest|matches)\(\s*'([^']+)'/g;

/* KNOWN DEAD SELECTORS, recorded, not ignored.
   Each of these targets markup that was deliberately removed.  None breaks a
   working feature: they sit behind null guards or alongside live alternatives.
   They are listed here so the audit can catch NEW drift while the existing
   residue stays visible and attributable.  Delete the code, then the entry. */
const KNOWN_DEAD = {
  // (Search-A's five slot-builder selectors lived here until v3.14.74, when the
  //  dead half of modules/search.js was deleted and the queries went with it.
  //  The anti-rot check below is what flagged them as stale.)
  // (The morpheme transliteration input lived here from v4.0.9 until D42 at
  //  v3.14.172, which rewrote the offer path and removed the last read of it.
  //  The anti-rot check flagged it, which is the check doing its job.)
  // (`.sec-del-btn` sat here from the day this list was written until B-175 at
  //  v3.14.343. This check HAD flagged it as never matching anything, and the
  //  resolution written down was "the section editor has no delete button" —
  //  which was false: LingCoT.html renders one, and the reason the selector
  //  never matched is that the restyle had changed its class. An exemption list
  //  is a declaration, and a declaration is only as good as what it admits
  //  exists (PRACTICES §5). The handler now binds on [data-arr] and the selector
  //  is gone from the source, so the entry goes too.)
};

const offenders = [];
for (const [file, text] of Object.entries(perFile)) {
  for (const m of text.matchAll(SELECTOR_CALL)) {
    const sel = m[1];
    // Split a compound/descendant selector into its class tokens.
    for (const cm of sel.matchAll(/\.([\w-]+)/g)) {
      const cls = cm[1];
      if (emitted.has(cls) || KNOWN_DEAD[cls]) continue;
      const line = text.slice(0, m.index).split('\n').length;
      offenders.push(`${file}:${line}  ${sel}  →  .${cls} is emitted by nothing`);
    }
  }
}

console.log('\nJS selectors must target classes the markup emits');
check(offenders.length === 0,
      `${Object.keys(perFile).length} files scanned, all JS class selectors resolve`,
      offenders.map(o => '         ' + o).join('\n'));

/* The allowlist must not rot either: an entry whose class is emitted again, or
   whose selector has been deleted, should be removed from KNOWN_DEAD. */
console.log('\nknown-dead list must stay accurate');
{
  const stale = [];
  for (const [cls, why] of Object.entries(KNOWN_DEAD)) {
    if (emitted.has(cls)) { stale.push(`.${cls} is emitted again — drop it from KNOWN_DEAD (${why})`); continue; }
    const stillQueried = new RegExp(
      `(?:querySelectorAll|querySelector|closest|matches)\\(\\s*'[^']*\\.${cls}(?![\\w-])`).test(corpus);
    if (!stillQueried) stale.push(`.${cls} is no longer queried — drop it from KNOWN_DEAD (${why})`);
  }
  check(stale.length === 0,
        `${Object.keys(KNOWN_DEAD).length} known-dead entries all still apply`,
        stale.map(s => '         ' + s).join('\n'));
}

/* Every icon('name') must have a matching <symbol id="ph-name"> in the sprite.
   A missing symbol renders NOTHING, no error, no console warning, just an empty
   box where the glyph should be. Written after GUI-1c reached for
   `icon('arrow-right')`, which the sprite does not contain; only the sprite dump
   revealed it. Same failure shape as a dead selector: a reference that resolves
   to nothing and says nothing. */
console.log('\nevery icon() name must exist in the sprite');
{
  const symbols = new Set([...corpus.matchAll(/id="ph-([a-z0-9-]+)"/g)].map(m => m[1]));
  // Strip comments first: a doc line reading `icon('name')` is prose, not a call,
  // and reporting it would train the reader to ignore this check.
  const code = corpus
    .replace(/<!--[\s\S]*?-->/g, ' ')          // HTML comments, the sprite's own header
    .replace(/\/\*[\s\S]*?\*\//g, ' ')          // JS block comments
    .replace(/^\s*\/\/[^\n]*/gm, ' ');          // JS line comments
  const used = new Set([...code.matchAll(/\bicon\(\s*'([a-z0-9-]+)'/g)].map(m => m[1]));
  const missing = [...used].filter(n => !symbols.has(n));
  check(missing.length === 0,
        `${used.size} icon name(s) used, all present in the sprite`,
        missing.map(n => `         icon('${n}') → no <symbol id="ph-${n}"> — renders as nothing`).join('\n'));
}

/* The four families B-007 retired, pinned by name so a revert is loud. */
console.log('\nretired chip class names must not return');
{
  const RETIRED = ['pos-chip', 'pos-chip-row', 'ann-chip', 'dict-type-chip', 'morph-chip'];
  const back = RETIRED.filter(c =>
    new RegExp(`(?:querySelectorAll|querySelector|closest|matches)\\(\\s*'[^']*\\.${c}(?![\\w-])`).test(corpus));
  check(back.length === 0,
        `${RETIRED.length} retired chip selectors stay retired`,
        back.map(c => `         .${c} is being queried again`).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
