#!/usr/bin/env node
/* =============================================================================
   boot_smoke_test.js, does the app's JavaScript survive top-level execution?
   Run:  node dev/tests/boot_smoke_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   On 2026-08-06 the app launched to a blank, unresponsive window.  Cause: a
   temporal-dead-zone ReferenceError thrown during top-level evaluation of the
   inline script, which aborted the entire script before the pywebview bridge
   initialised.  Nothing caught it, `node --check` only validates syntax, and
   every unit suite here calls functions directly rather than booting the file.

   The bug had shipped six weeks earlier and went unnoticed because the failure
   is silent: pywebview opens the window regardless, and the Python log records a
   clean start and a clean exit.  The only symptom is a dead window.

   WHAT THIS CHECKS
   ----------------
   Loads every module plus the inline script into a VM with a DOM stub that
   mimics the real parse order: getElementById returns an element ONLY for ids
   present in the static markup ABOVE the <script> tags, and null for everything
   else, exactly what a browser does at the moment the inline script runs.  That
   fidelity matters: a stub that returns an element for every id produces false
   failures, and one that returns null for every id hides real ones.

   Any exception during top-level evaluation fails the test.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const { SRC } = require('./_source.js');
/* v3.14.216: the DOM stub, the context and the script order moved to _dom.js
   when B-102's render_smoke_test.js needed the same three things. Two copies
   would have drifted, and the newer one would have quietly become the more
   permissive of the two. What stays HERE is the part that is this guard's
   argument rather than shared machinery: `hasId` mimics the real parse order,
   returning an element only for ids in the markup above the script tags and
   null for everything else. That fidelity is the test. A stub that found every
   id would hide real failures, and one that found none would invent them. */
const { appSources, makeCtx } = require('./_dom.js');

const { html, MODULE_ORDER, INLINE, STATIC_IDS } = appSources();
const ctx = makeCtx({ hasId: id => STATIC_IDS.has(id) });

let failed = 0, passed = 0;
const run = (label, code) => {
  try {
    vm.runInContext(code, ctx, { filename: label });
    passed++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${label}`);
    console.log(`         ${err.constructor.name}: ${err.message}`);
    const m = new RegExp(`${label}:(\\d+)`).exec(err.stack || '');
    if (m) {
      const n = +m[1], lines = code.split('\n');
      console.log('         --- context ---');
      for (let i = Math.max(0, n - 3); i < Math.min(lines.length, n + 2); i++) {
        console.log(`         ${i + 1 === n ? '>>' : '  '} ${lines[i]}`);
      }
    }
  }
};

console.log(`\nBoot smoke test  (${STATIC_IDS.size} static ids, ${MODULE_ORDER.length} modules)\n`);
for (const f of MODULE_ORDER) run(f, fs.readFileSync(path.join(SRC, 'modules', f), 'utf8'));
run('INLINE', INLINE);

/* Boot-order sanity: any identifier read during top-level execution must be
   declared before the statement that reads it.  The TDZ check above catches this
   dynamically; this is a static backstop for the specific pattern that bit us. */
const themeIdx  = INLINE.indexOf('function updateThemeToggle');
const localeIdx = INLINE.indexOf('let _LOCALE');
if (localeIdx === -1 || themeIdx === -1) {
  console.log('  warn _LOCALE / updateThemeToggle not found — update this check');
} else if (localeIdx > themeIdx) {
  failed++;
  console.log('  FAIL _LOCALE is declared after updateThemeToggle — TDZ hazard at boot');
} else {
  passed++;
  console.log('  ok   _LOCALE declared before updateThemeToggle');
}

/* v3.14.136: 'all passed' told you nothing about how much was checked. The
   suite's tail is a count everywhere else, so it is a count here too. */
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
