#!/usr/bin/env node
/* =============================================================================
   locale_shadow_test.js, nothing may shadow the global t() locale function
   Run:  node dev/tests/locale_shadow_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-008 (2026-08-24).  `renderParaBatch` and `renderParagraph` both did:

       const t = sentTrans(s);                    // shadows the global t()
       return t ? esc(t) : t('status.no_translation');   // t is null → TypeError

   `sentTrans()` returns null for an untranslated sentence, exactly the branch
   that then calls t() as a function, so any section or paragraph holding one
   untranslated sentence threw mid-render.  A brand-new section is 100%
   untranslated, so Save appeared to do nothing.

   The bug was introduced by the i18n pass: the string had been a hardcoded
   literal, and localizing it put a t(…) call inside a scope where a local named
   `t` already lived.  Neither the author nor any of the three existing guards
   could see it, none of them executes a renderer.

   WHAT THIS CHECKS
   ----------------
   For every scope that binds an identifier named `t` (const/let/var, arrow
   parameter, or function parameter), does that same scope also contain a call
   that looks like a locale lookup, t('some.dotted.key')?  If so, that call
   resolves to the local binding, not to the locale function, and will throw or
   silently misbehave.

   LIMITS, deliberately a lint, not a proof:
   · Scope is approximated by brace matching from the binding site.  A binding in
     an outer scope followed by a t('…') call in a nested function is reported;
     that is the conservative direction and such code should be renamed anyway.
   · Only `t` is checked.  If other globals become shadow-prone, add them to
     GUARDED.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const FILES = ['LingCoT.html',
  ...fs.readdirSync(path.join(SRC, 'modules')).map(f => path.join('modules', f))];

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Globals that must never be shadowed, with the call shape that proves the
   shadow is harmful.  A locale key is dotted, which is what distinguishes
   t('status.no_translation') from a local t being used as data. */
const GUARDED = [
  { name: 't', callRe: /\bt\(\s*['"][\w.]+\.[\w.]+['"]/ },
];

/* A binding sits INSIDE an already-open block, so its scope is that enclosing
   block, not a block opened after it.  Getting this backwards is what made the
   first draft of this guard silently pass on the very bug it was written for:
   scanning forward from `const t = …` hit the `{` of a template literal's
   `${…}` first and closed the scope one character later, before the offending
   call.  So: walk BACKWARDS to the nearest unmatched '{', then match FORWARD
   from there.  Template `${…}` braces are balanced, so they cancel either way.

   Strings and comments are not parsed out, which can only widen the scope, the
   conservative direction for a lint. */

/* Nearest unmatched '{' before `from`, the opening brace of the enclosing block. */
function scopeStart(text, from) {
  let depth = 0;
  for (let i = from; i >= 0; i--) {
    const ch = text[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return 0;
}

/* Matching closer for the opener at `open` (works for '{' or '('). */
function matchForward(text, open) {
  const OPEN = text[open], CLOSE = OPEN === '{' ? '}' : ')';
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === OPEN) depth++;
    else if (ch === CLOSE) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

/* A PARAMETER binding (`t => …`, `(t) => …`, `function f(t)`) scopes the body
   that FOLLOWS it, not the block it sits in, the opposite of a const/let/var
   binding.  Conflating the two made this guard report `renderDictBrowse`'s
   `.map(t => …)` as shadowing a `t('nav.back.word')` call in a different
   function further down the file.
     · block body  `t => { … }`  → the braces after the arrow
     · concise body `t => chip(t)` → to the closing paren of the enclosing call */
function paramScope(text, at) {
  const arrow = text.indexOf('=>', at);
  if (arrow !== -1 && arrow - at < 80) {
    let i = arrow + 2;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] === '{') return [i, matchForward(text, i)];
    const open = scopeStartOf(text, at, '(');       // the call this arrow is an argument to
    return [at, open === -1 ? at : matchForward(text, open)];
  }
  // function f(t) { … }, the brace after the parameter list
  const brace = text.indexOf('{', at);
  return brace === -1 ? [at, at] : [brace, matchForward(text, brace)];
}

/* Nearest unmatched opener of the given kind before `from`. */
function scopeStartOf(text, from, opener) {
  const closer = opener === '{' ? '}' : ')';
  let depth = 0;
  for (let i = from; i >= 0; i--) {
    const ch = text[i];
    if (ch === closer) depth++;
    else if (ch === opener) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

console.log('\nno scope may shadow a guarded global it also calls\n');

const offenders = [];
for (const f of FILES) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');

  for (const g of GUARDED) {
    const n = g.name;
    // Binding forms: `const t =` / `let t =` / `var t =`, `(t) =>` / `t =>`,
    // and `function foo(t` / `(a, t)` parameter lists.
    const bindings = [
      // declaration → scope is the enclosing block
      { re: new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=`, 'g'),                   kind: 'decl' },
      // parameter → scope is the body that follows
      { re: new RegExp(`(?:\\(\\s*${n}\\s*\\)|\\b${n}\\s*)=>`, 'g'),                kind: 'param' },
      { re: new RegExp(`function\\s*\\w*\\s*\\([^)]*\\b${n}\\b[^)]*\\)`, 'g'),      kind: 'param' },
    ];

    for (const { re, kind } of bindings) {
      for (const m of text.matchAll(re)) {
        const at = m.index;
        let from, end;
        if (kind === 'decl') {
          from = at;
          end  = matchForward(text, scopeStart(text, at));   // enclosing block
        } else {
          [from, end] = paramScope(text, at);                // body that follows
        }
        // Only the region from the binding onward can see the binding.
        const body = text.slice(from, end);

        if (g.callRe.test(body)) {
          const callAt = from + body.search(g.callRe);
          offenders.push(
            `         ${f}:${lineOf(text, at)}  binds \`${n}\`  →  ` +
            `${f}:${lineOf(text, callAt)} calls ${n}('…') in the same scope\n` +
            `           binding: ${text.slice(at, text.indexOf('\n', at)).trim()}\n` +
            `           call:    ${text.slice(callAt, text.indexOf('\n', callAt)).trim().slice(0, 110)}`
          );
        }
      }
    }
  }
}

check(offenders.length === 0,
      `${FILES.length} files scanned, no guarded global is shadowed where it is called`,
      offenders.join('\n\n'));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
