#!/usr/bin/env node
/* =============================================================================
   undefined_call_test.js, a function that is called must exist
   Run:  node dev/tests/undefined_call_test.js
   =============================================================================
   B-062. v3.14.103 introduced two calls to `log(..)`. There is no `log()` in
   this codebase, the logger is `logEvent(level, event, detail)`. The calls sat
   inside `refreshFoldContext()`, which `applyCorpus()` invokes, so **opening any
   corpus threw a ReferenceError** for eight versions. It reached a user before
   any guard noticed.

   Why nothing caught it: 34 guards, and not one executes `applyCorpus`.
   `boot_smoke_test` runs top-level statements; `render_untranslated_test` runs
   renderers. A ReferenceError inside a function nobody calls is invisible to
   source reading and to both of those.

   THE RULE, and it is the third in this family:
       importing is not calling · calling is not reaching · CALLING IS NOT DEFINING

   This guard extracts every identifier used in call position and checks it is
   defined somewhere in the bundle, or is a known runtime global. It is a
   source-reading guard, which this project distrusts, so it verifies itself
   below against constructed sources: one it must report and four it must not.
   That used to be done against an archived pre-fix copy, which meant every clone
   ran the real check and then discarded it as DISABLED (L-018).

   ALLOWLIST POLICY: entries below are locals (callbacks, parameters, destructured
   helpers) that the flat regex cannot see the binding for. Adding a name here is
   a claim that it is locally bound. Do NOT add a name to silence a real miss.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Runtime globals the app legitimately calls. Browser + a few host APIs. */
const GLOBALS = new Set(`alert confirm prompt parseInt parseFloat isNaN isFinite
  setTimeout setInterval clearTimeout clearInterval requestAnimationFrame
  encodeURIComponent decodeURIComponent encodeURI decodeURI fetch require
  structuredClone queueMicrotask btoa atob`.split(/\s+/).filter(Boolean));

/* Locally-bound names the flat scan cannot resolve. Each is a callback or a
   parameter, verified by hand. */
/* v3.14.338: `buildLatexGb4e` was here and is a defined function — the check
   below found it. An allowlist entry for something that exists silences nothing
   and outlives the reason it was added. */
const LOCAL_BINDINGS = new Set(`async getCandidates getStrs getStr cb r renderFn
  commit close descendants
  eq formOf
  onDone done`.split(/\s+/).filter(Boolean));
  /* eq, formOf, parameters of _lcsPairs/alignTokens (B-057). Verified by hand
     as parameters, not missing globals. This is the allowlist doing its job:
     it forced a look rather than a shrug.

     onDone, done: B-085's push picker is asynchronous, so saveWord hands it a
     continuation. `onDone` is openPushPickModal's parameter and `done` is the
     const closePushPickModal reads it back into. Both checked by hand, both
     genuinely local. Deciding this without an allowlist needs scope analysis,
     which is the same reason B-102 asked for an executing harness rather than
     a wider static check. */

const KEYWORDS = new Set(`if for while switch catch return typeof function new
  delete void do else try throw case await yield in of instanceof`.split(/\s+/).filter(Boolean));

/* Strip comments and string literals, three guards in this project have passed
   by matching their own prose, and a locale string can contain anything.

   B-081: template literals are NOT stripped wholesale, they are unwrapped.
   This app is built out of them — every render function is one long template —
   so a helper called from `${...}` is real code in the only place most helpers
   are ever called. Blanking the whole literal hid all of it, and the guard
   passed for three versions while `requiredMark()` was called at seven sites
   and defined at none. Only the literal TEXT is dropped; each interpolation is
   kept, recursively, because they nest. */
function stripCode(src) {
  /* One pass, because the pieces cannot be stripped in sequence without one
     corrupting the next. Stripping `//` first deletes the rest of any line
     holding a URL inside a template — closing backtick included — and the
     unwrapper then reads real code as literal text. Stripping templates first
     breaks on a backtick inside a line comment. So comments, quotes and
     templates are all recognised here, in one state machine.

     A mode stack, because templates nest: an interpolation can contain another
     template, which can contain another interpolation.
       code  copy through
       tmpl  drop through; a backtick closes it, ${ opens an interpolation */
  let out = '';
  const stack = [{ mode: 'code', braces: 0 }];
  for (let i = 0; i < src.length; i++) {
    const top = stack[stack.length - 1];
    const c = src[i], n = src[i + 1];

    if (top.mode === 'tmpl') {
      if (c === '\\') { i++; continue; }
      if (c === '`') { stack.pop(); continue; }
      if (c === '$' && n === '{') { stack.push({ mode: 'code', braces: 1 }); out += ' '; i++; continue; }
      continue;                                       // literal text, dropped
    }

    // code
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1; out += ' '; continue; }
    /* A regex literal can hold a quote or a backtick — `.replace(/'/g, …)` is
       all over this file — and reading one as a string start swallows code up
       to the next matching quote, definitions included. The classic
       regex-or-division ambiguity is resolved the classic way: a `/` after an
       operator or an opening bracket begins a regex; after a value it divides. */
    if (c === '/') {
      const prev = out.replace(/\s+$/, '').slice(-1);
      if (prev === '' || '(,=:[!&|?{};+-*%~^<>'.includes(prev)) {
        i++;
        for (let cls = false; i < src.length; i++) {
          const r = src[i];
          if (r === '\\') { i++; continue; }
          if (r === '[') cls = true;
          else if (r === ']') cls = false;
          else if (r === '/' && !cls) break;
          else if (r === '\n') break;              // not a regex after all
        }
        out += ' 0 ';                              // a value, so the next / divides
        continue;
      }
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      for (; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
      out += q + q;
      continue;
    }
    if (c === '`') { stack.push({ mode: 'tmpl', braces: 0 }); continue; }
    if (stack.length > 1) {
      if (c === '{') top.braces++;
      else if (c === '}') {
        top.braces--;
        if (top.braces === 0) { stack.pop(); out += ' '; continue; }
      }
    }
    out += c;
  }
  return out;
}

/* B-081: template literals are UNWRAPPED, not blanked. This app is built out of
   them — every render function is one long template — so a helper called from
   `${...}` is real code in the only place most helpers are ever called.
   Blanking the whole literal hid all of it, and this guard passed for three
   versions while `requiredMark()` was called at seven sites and defined at
   none, until corpus-new threw in front of the user. */
const strip = stripCode;

function scriptBodies(html) {
  return [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join('\n');
}

/* Build the bundle exactly as the browser sees it: inline <script> in the HTML
   plus every module loaded by a <script src>. */
function buildBundle(htmlPath, modulesDir) {
  let bundle = scriptBodies(fs.readFileSync(htmlPath, 'utf8'));
  for (const f of fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')))
    bundle += '\n' + fs.readFileSync(path.join(modulesDir, f), 'utf8');
  return strip(bundle);
}

function analyse(code) {
  const defined = new Set();
  for (const m of code.matchAll(/(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g))
    defined.add(m[1]);
  for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g))
    defined.add(m[1]);
  for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/g))
    defined.add(m[1]);

  const called = new Map();
  for (const m of code.matchAll(/(?:^|[^.\w$])([a-z][\w$]*)\s*\(/g))
    called.set(m[1], (called.get(m[1]) || 0) + 1);

  const missing = [...called].filter(([n]) =>
    !defined.has(n) && !KEYWORDS.has(n) && !GLOBALS.has(n) && !LOCAL_BINDINGS.has(n));
  return { defined, called, missing };
}

console.log('\nevery called function is defined\n');
{
  const code = buildBundle(path.join(SRC, 'LingCoT.html'), path.join(SRC, 'modules'));
  const { defined, called, missing } = analyse(code);
  check(defined.size > 300, `${defined.size} functions defined, ${called.size} identifiers called`);
  check(missing.length === 0,
        'no identifier is called that nothing defines',
        missing.map(([n, c]) => `         ${n}()  — called ${c}x, defined nowhere`).join('\n'));

  // The specific shape of B-062: the logger is logEvent, not log.
  check(!/(?:^|[^.\w$])log\s*\(/.test(code),
        'nothing calls log() — the logger is logEvent(level, event, detail)',
        '         B-062: two log() calls in refreshFoldContext broke every corpus open');
  check(defined.has('logEvent'), 'logEvent() is defined');

  /* ── B-147, v3.14.284: an identifier READ, not called ─────────────────────
     `saveNewCorpus` ended with `setTimeout(() => promptNewCorpusAutosave(title))`
     and `title` is not a thing — the value is `v.title`. Everything above scans
     for `name(`, so a bare identifier passed AS AN ARGUMENT is invisible to it,
     and the throw happens inside a deferred callback where nothing surfaces it:
     no dialog, no log, no failed save. Every corpus ever created went unoffered
     autosave, and `setup_corpus_dir` therefore never ran.

     Scoped to deferred callbacks on purpose. A ReferenceError on the main path
     reaches the console and the log; one inside a `setTimeout` is swallowed, so
     that is where the cost of not checking is highest and where a narrow,
     parseable rule earns its place. Widening this to every identifier read in
     the file is a real scope analysis, which is the kind of parse that gets a
     guard quietly wrong. */
  const deferred = [...code.matchAll(/setTimeout\(\s*\(\)\s*=>\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)];
  check(deferred.length >= 3, `${deferred.length} deferred one-line callback(s) to check`,
        '         zero means the matcher broke, not that nothing is deferred');
  const bad = [];
  for (const m of deferred) {
    const fn = m[1];
    if (!defined.has(fn) && !GLOBALS.has(fn)) bad.push(`         setTimeout(… ${fn}()) — nothing defines ${fn}`);
    /* The arguments. A bare lowercase identifier that is neither a global, a
       known local binding, nor declared anywhere in the ENCLOSING function is
       the B-147 shape. Anything with a dot, a literal, or an operator is out of
       scope — this is deliberately the narrowest test that catches it. */
    const encl = code.slice(Math.max(0, m.index - 4000), m.index);
    for (const raw of m[2].split(',')) {
      const a = raw.trim();
      if (!/^[a-z_$][\w$]*$/.test(a)) continue;            // not a bare identifier
      if (GLOBALS.has(a) || KEYWORDS.has(a) || LOCAL_BINDINGS.has(a) || defined.has(a)) continue;
      const declared = new RegExp(`(?:const|let|var|function)\\s+${a}\\b|\\(\\s*${a}\\s*[,)]|,\\s*${a}\\s*[,)]`).test(encl);
      if (!declared) bad.push(`         setTimeout(… ${fn}(${a})) — ${a} is declared nowhere in scope`);
    }
  }
  check(bad.length === 0,
        'every deferred callback names things that exist',
        bad.join('\n') + '\n         a ReferenceError inside setTimeout is silent: no dialog, no log (B-147)');
}

console.log('\nthe guard can fail — verified against constructed sources\n');
{
  /* L-018, v3.14.338. This used to prove itself against
     `dev/archive/changes/b062_log_undefined/LingCoT_pre_v3.14.111.html` and, when
     that was absent, exit 2. `dev/archive/` is gitignored, so on EVERY CLONE the
     guard completed its real work — 500-odd functions, 400-odd identifiers — and
     then threw the result away as DISABLED. The suite's best signal was
     discarded to protect the suite's own self-verification.

     The proof does not need a historical file. `analyse` is a pure function of a
     string, so the strings can be built here: one that must report a miss, and
     several that must NOT, which is the half a single positive case leaves
     unguarded. Portable, deterministic, and strictly stronger — the archived
     copy proved one shape of miss and these prove five. */
  const finds = src => analyse(strip(src)).missing.map(([n]) => n);

  check(finds('function a(){ log("x"); }').includes('log'),
        'a call to an undefined function is reported — B-062\'s own shape',
        '         if this passes silently the guard is checking nothing');

  check(!finds('function log(){} function a(){ log("x"); }').includes('log'),
        'and one that IS defined is not');
  check(!finds('const log = () => 0; function a(){ log("x"); }').includes('log'),
        'including an arrow assigned to a const');
  check(!finds('const log = function(){}; function a(){ log("x"); }').includes('log'),
        'and a function expression');
  check(!finds('function a(o){ o.log("x"); }').includes('log'),
        'a METHOD call is not a bare call — `.log()` is somebody else\'s namespace');

  /* The allowlist is the guard's one soft edge: every name on it is a local the
     flat regex cannot see the binding for, so a name added by mistake hides a
     real miss for ever. It is asserted to be a list of locals, not a list of
     functions that exist. */
  const appCode = strip(scriptBodies(fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8')));
  const allow = [...LOCAL_BINDINGS];
  const stale = allow.filter(n => new RegExp(`function\\s+${n}\\b`).test(appCode));
  check(stale.length === 0,
        `no allowlisted name is actually a defined function (${allow.length} entries)`,
        `         ${stale.join(', ')} is defined, so allowlisting it hides nothing and\n`
      + '         should be removed — an allowlist that grows by habit stops meaning anything');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
