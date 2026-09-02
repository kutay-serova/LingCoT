#!/usr/bin/env node
/* =============================================================================
   affordance_test.js, what looks clickable is clickable, and variants are classes
   Run:  node dev/tests/affordance_test.js
   =============================================================================
   Two findings from INPUT_UX_AUDIT part two, guarded together because both are
   the same mistake: a visual decision written where nothing can check it.

   I9. `.ann-table th` carried `cursor:pointer` and an accent hover. The Sources
   view reuses `.ann-table` and has no sorting, so every one of its column
   headers offered a hand cursor and a highlight for a click that does nothing.
   An affordance that lies is worse than one that is missing, and CSS reuse is
   how it happened: nothing connected the rule to the handler that makes it true.

   I11. The state badge had three variants and one class, the other two written
   as inline styles at five sites — four alike, one for the dictionary — with the
   ＋ mark on three of the five. The same defect as the required-field asterisk
   in §3.4, still being written after that one was found.

   Neither can be caught by reading a render function, so this reads the
   stylesheet and the markup together.
   ============================================================================= */

const { read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const css  = read('LingCoT.css');
const html = read('LingCoT.html');
const parts = read('modules/participants.js');

/* ── I9: the sort affordance is scoped to headers that sort ──────────────── */

// The rules that promise an action, matched loosely enough to catch a rewrite.
const pointerRule = /\.ann-table th([^{]*)\{[^}]*cursor:\s*pointer/.exec(css);
const hoverRule   = /\.ann-table th([^{]*):hover\s*\{[^}]*color:/.exec(css);

check(!!pointerRule || !!hoverRule, 'the sortable-header rules still exist to be checked',
      'neither a cursor nor a hover rule found on .ann-table th — has the table been renamed?');

for (const [name, m] of [['cursor', pointerRule], ['hover colour', hoverRule]]) {
  if (!m) continue;
  check(/\[data-psort\]/.test(m[1]),
        `the ${name} is scoped to [data-psort]`,
        `selector reads ".ann-table th${m[1].trim()}" — it promises a click to headers that do not sort`);
}

/* The scoping is only true while sortable headers actually carry the attribute,
   and unsortable ones do not. Both halves are asserted: a guard that checked the
   selector alone would pass if the attribute were added to every header.

   B-115 (v3.14.309) REPLACED the assertion that used to sit here. It read "the
   sources table does not claim to sort", which was a true description of a
   defect rather than a rule — the sources table did not sort, and the guard held
   it that way. The rule underneath is the one worth keeping: **a header carries
   the attribute exactly when it sorts**, which is what makes the cursor honest.
   Both tables now sort, and the check is that neither has a header claiming an
   action it does not perform. */
const annHeaders = /renderAnnotatorsView[\s\S]*?<\/table>/.exec(parts);
const srcHeaders = /renderSourcesView[\s\S]*?<\/table>/.exec(parts);
for (const [name, m] of [['annotators', annHeaders], ['sources', srcHeaders]]) {
  check(!!m && /participantTh\(/.test(m[0]),
        `the ${name} table marks its sortable headers, through the one helper`,
        `a hand-written <th> here is a second spelling of the affordance`);
  /* The edit column's header is blank and sorts nothing, so it must stay a bare
     <th>. If every header went through the helper, the cursor would be back on
     a column that does nothing — I9's original defect, arrived at from the
     other side. */
  check(!!m && /<th><\/th>/.test(m[0]),
        `and the ${name} table's action column still claims nothing`);
}

/* ── L-029 / B-174: an id is a name, so it names one thing ─────────────────── */
{
  /* `#app-name` was on the header's title block and on the annotator preview
     panel's span. `getElementById` returns the first in document order, so a
     panel meant to fill its own span overwrote the application's title instead —
     and the second CSS rule silently shadowed the first's font and colour. A
     duplicate id reads as a styling untidiness and is a wiring bug. */
  /* THE SHELL, meaning the markup outside `<script>`. Ids inside a template
     literal are emitted one branch at a time — `morph-suggest-panel` has two
     spellings in one function and only ever one in the DOM — so scanning the
     whole file would report a render's alternatives as duplicates and this
     check would be deleted as noise within a week. */
  const shell = html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
                    .replace(/<!--[\s\S]*?-->/g, '');
  const ids = [...shell.matchAll(/\sid="([^"${]+)"/g)].map(m => m[1]);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  check(dupes.length === 0,
        `every id in the static shell names one element (${ids.length} checked)`,
        `       ${dupes.join(', ')} appears more than once — getElementById takes the first,\n`
      + '       so the second is unreachable and its CSS shadows the first\'s');
}

/* ── I11: badge variants are classes ─────────────────────────────────────── */

check(/\.edit-badge-add\s*\{/.test(css),  '.edit-badge-add is defined');
/* v3.14.337, L-029: `.edit-badge-dict` was asserted here and emitted NOWHERE —
   a guard holding dead CSS in place, which is the shape L-006 is about. It went
   with D51's retired dict-add surface. What this line asks now is the thing that
   would actually break: a badge variant that no template emits. */
{
  const variants = [...css.matchAll(/\.edit-badge-([a-z-]+)\s*[{,:]/g)].map(m => m[1]);
  const orphans = [...new Set(variants)].filter(v => !html.includes(`edit-badge-${v}`));
  check(orphans.length === 0,
        `every badge variant the stylesheet defines is emitted (${variants.length} found)`,
        `       ${orphans.join(', ')} is styled and never rendered`);
}
check(/\.edit-badge-add::before/.test(css),
      'the ＋ mark lives in the stylesheet, not in eleven template literals');

const inlineBadge = [...html.matchAll(/<span class="edit-badge"[^>]*style="/g)];
check(inlineBadge.length === 0, 'no badge carries an inline style',
      `${inlineBadge.length} still do`);

/* The general form of I11, so the next component does not repeat it: an inline
   style that sets background AND colour AND border-color is a variant somebody
   declined to name. Spacing and sizing one-offs are left alone deliberately. */
const variantish = [...html.matchAll(/style="[^"]*background:[^"]*color:[^"]*border-color:[^"]*"/g)];
check(variantish.length === 0,
      'no inline style re-creates a component variant',
      variantish.map(m => '       ' + m[0].slice(0, 90)).join('\n'));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
