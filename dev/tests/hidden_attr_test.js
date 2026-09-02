#!/usr/bin/env node
/* =============================================================================
   hidden_attr_test.js — `el.hidden = true` actually hides it
   Run:  node dev/tests/hidden_attr_test.js
   =============================================================================
   B-182. An author `display:` on an element ALWAYS beats the UA stylesheet's
   `[hidden] { display: none }` — author rules outrank UA rules — so giving a
   panel a display of its own silently disables the attribute that closes it.

   Silent in both directions, which is why it survived 17 versions: the property
   is set, `el.hidden` reads back `true`, `mutate()`'s `if (!box.hidden)` behaves,
   and every guard that asks the DOM agrees the panel is closed. Only a person
   looking at the screen can see that it is not. B-162 gave `#gap-panel-box`
   `display: flex` at v3.14.332 to fix its scrolling and closed the Progress
   panel's close button in the same line; `#offer-panel-box` inherited it at
   v3.14.348 and made Accept look like it had done nothing.

   DERIVED, NOT LISTED. The elements checked are the ones the JS actually toggles
   — `<id>.hidden = …`, resolved back to the id through the `getElementById` that
   fetched it — so a panel added next month is covered without an edit here. A
   list would have to be remembered, and the whole class of defect is that nobody
   remembers this one.
   ============================================================================= */

const path = require('path');
const { read, decomment, moduleFiles } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Comments stripped, and it matters: the rules below are matched by walking
   selector/body pairs, and a comment sitting above a rule is swallowed into the
   selector half. A comment that NAMES an id — the one above the shared panel
   rule names `#offer-panel-box` — then makes that rule look as though it covers
   it. Caught by a mutation, which is the only reason this line is here. */
const css = read('LingCoT.css').replace(/\/\*[\s\S]*?\*\//g, '');
const js  = decomment([read('LingCoT.html'), ...moduleFiles().map(([, c]) => c)].join('\n'));

console.log('\n1 · the one rule that makes the attribute mean something');

/* `!important` is the point, not decoration: without it the next `display:` on
   any panel silently takes the attribute away again, which is exactly how this
   arrived twice. */
check(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css),
      'a global [hidden] { display: none !important } exists',
      '         without it, any author `display:` on a panel outranks the UA rule\n'
    + '         and `el.hidden = true` stops hiding anything');

console.log('\n2 · every element the code hides this way, found by following the code');

/* Two shapes, because the app uses both: a variable fetched by id and then
   assigned, and the id fetched inline. The first is resolved by walking back to
   the `getElementById` that produced the variable, inside the same function. */
const ids = new Set();
for (const m of js.matchAll(/getElementById\('([a-z0-9-]+)'\)\s*\??\.hidden\s*=/g)) ids.add(m[1]);
for (const m of js.matchAll(/\b(\w+)\.hidden\s*=\s*(?:true|false)/g)) {
  const before = js.slice(Math.max(0, m.index - 600), m.index);
  const decl = [...before.matchAll(new RegExp(`\\b${m[1]}\\s*=\\s*document\\.getElementById\\('([a-z0-9-]+)'\\)`, 'g'))].pop();
  if (decl) ids.add(decl[1]);
}

check(ids.size > 0, `${ids.size} element(s) are hidden through the attribute: ${[...ids].join(', ')}`,
      '         if this finds nothing the checks below assert nothing — the two\n'
    + '         shapes it knows are in its own source, extend them');

/* A `display:` of its own is not forbidden — §1's rule outranks it. What IS
   forbidden is a `display:` with no such rule, which is the state that shipped.
   Checked per element so the failure names the panel, not the file. */
for (const id of ids) {
  const own = [...css.matchAll(new RegExp(`(^|[,}])\\s*#${id}\\b[^{,]*\\{([^}]*)\\}`, 'gm'))]
                .concat([...css.matchAll(new RegExp(`#${id}\\b[^{]*\\{([^}]*)\\}`, 'g'))]);
  const hasDisplay = own.some(m => /display\s*:/.test(m[m.length - 1] || ''));
  check(!hasDisplay || /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css),
        `#${id} — a display of its own is safe, because the global rule outranks it`,
        `         #${id} sets display: and nothing beats it for [hidden]`);
}

console.log('\n3 · a panel that can be opened can be closed');

/* The pair, not just the opener. A close function that writes `hidden = true`
   is the whole mechanism; if one exists the element must be in §2's set, or it
   is being closed by an attribute nothing enforces. */
const closers = [...js.matchAll(/function\s+(close\w+)\s*\(\)\s*\{([\s\S]{0,400}?)\n\}/g)]
                  .filter(m => /\.hidden\s*=\s*true/.test(m[2]));
check(closers.length > 0, `${closers.length} close function(s) work by setting hidden`);
for (const [, name, body] of closers) {
  const m = body.match(/getElementById\('([a-z0-9-]+)'\)/);
  check(!!m && ids.has(m[1]),
        `${name}() closes #${m ? m[1] : '?'}, which §2 covers`,
        '         a closer whose element §2 did not find means the detection above\n'
      + '         missed a shape — fix the detection, not this line');
}

console.log('\n4 · and a panel is positioned as one');

/* The other half of what shipped at v3.14.348: `#offer-panel-box` was left out
   of the shared `position: fixed; top: 50%; …` rule, so it had no position, no
   background and no z-index and rendered in normal flow at the foot of the
   document. Hiding correctly and being in the wrong place are different
   failures, and the screenshot showed both at once. */
for (const id of [...ids].filter(x => /-panel-box$/.test(x))) {
  const positioned = new RegExp(`#${id}\\b[^{]*\\{[^}]*position:\\s*fixed`).test(css)
    || [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
         .some(m => new RegExp(`#${id}\\b`).test(m[1]) && /position:\s*fixed/.test(m[2]));
  check(positioned, `#${id} is positioned by a rule that sets position: fixed`,
        `         nothing gives #${id} a position — it will lay out in normal flow\n`
      + '         at the foot of the document, which is where the offer panel was');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
