#!/usr/bin/env node
/* =============================================================================
   chip_system_test.js, one chip in two kinds
   Run:  node dev/tests/chip_system_test.js
   =============================================================================
   D44. `chip` named one visual idea and eight implementations of it: five corner
   radii, five ways of saying "chosen", three accents for one gesture, and two
   families that looked clickable and were not.

   The split is on what the chip IS, not on where it appears. A CHOICE is one of
   a set you are picking from; a TOKEN is a thing already attached. The gesture
   follows: a choice toggles, a token detaches.

   Three values are asserted here rather than trusted, because each drifted once
   already and none of them fails visibly:
     · radius 12px
     · chosen is a filled accent
     · reduced opacity means DISABLED, and nothing else
   The last is the one that changed a meaning rather than a look: a taken
   suggestion used to dim to 55%, in a stylesheet where .seg.chip-disabled uses
   opacity for exactly "you cannot have this".
   ============================================================================= */

const { read, moduleFiles, decomment } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const css  = decomment(read('LingCoT.css'));
const html = read('LingCoT.html');
const mods = moduleFiles();
const all  = decomment([html, ...mods.map(m => m[1])].join('\n'));

/* ── One radius ──────────────────────────────────────────────────────────── */
/* Every rule whose selector names a chip must agree. Read out of the stylesheet
   rather than listed here, so a new chip family is measured too. */
const chipRules = [...css.matchAll(/(^|\n)([^\n{}]*\bchip[\w-]*[^\n{}]*)\{([^}]*)\}/g)]
  .map(m => ({ sel: m[2].trim(), body: m[3] }))
  .filter(r => /border-radius:/.test(r.body));
check(chipRules.length > 0, `${chipRules.length} chip rules set a radius`);
const radii = new Set(chipRules.map(r => /border-radius:\s*([^;]+)/.exec(r.body)[1].trim()));
check(radii.size === 1 && radii.has('12px'),
      'every chip radius is 12px',
      [...radii].join(' · ') + '\n       ' + chipRules.map(r => r.sel).join('\n       '));

/* ── Two kinds, and both defined ─────────────────────────────────────────── */
check(/\.chip-choice\s*\{/.test(css), '.chip-choice is defined');
check(/\.chip-token\s*\{/.test(css),  '.chip-token is defined');
check(/\.chip-choice\.active\s*\{[^}]*background:\s*var\(--accent\)/.test(css),
      'a chosen choice is a FILLED accent, not a tint');
check(/\.chip-token \.chip-x/.test(css),
      'a token carries the × that detaches it — the gesture follows the kind');

/* ── Reduced opacity means disabled, and only that ───────────────────────── */
/* Only the chip ELEMENT is policed. Fading a sub-element inside a chip — its
   meta line, its × — is ordinary de-emphasis and says nothing about state; the
   defect was a whole chip dimmed to mean "already taken". A selector is a
   sub-element when its last simple selector is one of the parts. */
const PART = /[.\w-]*-(meta|label|x|meaning|type)$/;
const opacityRules = [...css.matchAll(/(^|\n)([^\n{}]*)\{([^}]*opacity:\s*0?\.\d+[^}]*)\}/g)]
  .map(m => m[2].trim())
  .filter(sel => /\bchip|\bseg\b/.test(sel))
  .filter(sel => !PART.test(sel.split(/\s+/).pop()));
const notDisabled = opacityRules.filter(sel => !/disabled|empty|:hover/.test(sel));
check(notDisabled.length === 0,
      'no chip uses reduced opacity for anything but disabled',
      notDisabled.join('\n       ') + '\n       dimming reads as "you cannot have this"');

/* ── The retired families are gone ───────────────────────────────────────── */
for (const gone of ['chip-toggle', 'src-sel-remove', 'trans-src-chip-set', 'spc-type-old'])
  check(!new RegExp('\\b' + gone + '\\b').test(all + css), `${gone} is gone`);

/* ── I8: the attribute vocabulary is not about parts of speech ───────────── */
check(!/data-pos-target|data-pos=/.test(all),
      'no chip attribute claims to be a part of speech',
      'chipRowHtml emits for every family, including type-select');
check(/data-chip-target=/.test(html) && /data-chip="/.test(html),
      'the renamed attributes are in use');
check(!/refreshPosChips|refreshTypeChips/.test(all.replace(/Replaces refresh\w+/g, '')),
      'one refresh, not one per vocabulary');
check(/data-chip-fold=/.test(html),
      'and the fold rule rides on the row, which is how one refresh can serve both');

/* ── The source chips really did become tokens ───────────────────────────── */
const parts = mods.find(m => m[0] === 'participants.js')[1];
for (const [what, re] of [
  ['the selected-source chip', /class="chip chip-token src-sel-chip"/],
  ['the row source chip',      /class="chip chip-token trans-src-chip/],
])
  check(re.test(parts), `${what} is a token`);
check(/chip\.className\s*=\s*'chip chip-token src-sel-chip'/.test(parts),
      'including the one built in script, which is where the two copies drifted before');

/* ── The segmented control is left alone, deliberately ───────────────────── */
/* .seg is a choice by semantics and a segmented control by presentation: one
   joined group, for switching a mode. D44's table lists it under choice; the
   thing that had to match is the CHOSEN treatment, and it already did. */
check(/\.seg\.active\s*\{[^}]*background:\s*var\(--accent\)/.test(css),
      '.seg says chosen the same way a choice chip does');
check(/\.seg-group\s*\{/.test(css),
      'and keeps its own group presentation, which nothing else duplicates');

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
