#!/usr/bin/env node
/* =============================================================================
   prov_presentation_test.js, provenance has one presentation, and derived shows
   Run:  node dev/tests/prov_presentation_test.js
   =============================================================================
   D43. Provenance had FIVE presentations: a line under 21 edit fields
   (`fieldProvHint`), a tier in the IGT (`.igt-t-prov`), a line in the expanded
   morpheme column (`.morph-col-prov`), a CSS hover bubble at 2 sites, and the
   native title attr on the IGT tiers. The lines are gone; the bubble is the rule
   and the native title is the documented exception, because a CSS bubble is
   clipped by `.igt-wrap`'s overflow-x.

   The half that must NOT move to hover is `derived`. A value the app inferred
   should not read like one a person typed — that is what B-061 got wrong twice —
   so it keeps a permanent mark on the value itself.

   This guard executes the shipped `provTipAttr` rather than reading it, because
   the derived test is a condition and a condition can be inverted while the
   source still mentions every right word.
   ============================================================================= */

const vm = require('vm');
const { read, fnSrc, decomment } = require('./_source.js');
const _FILE = 'LingCoT.html';

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read(_FILE);
const css  = read('LingCoT.css');

/* ── The retired presentations are gone, not merely unused ───────────────── */
for (const [what, needle] of [
  ['fieldProvHint',   'function fieldProvHint'],
  ['the IGT prov tier', 'igt-t-prov'],
  ['the morpheme column prov line', 'morph-col-prov'],
]) {
  check(!html.includes(needle), `${what} is gone from the markup`);
  check(!css.includes(needle.replace('function ', '')), `${what} is gone from the stylesheet`);
}
check(!/\bshowProv\b/.test(html), 'the showProv tier toggle is gone with the tier');

/* ── The surviving one is used, and used widely ──────────────────────────── */
/* Counting CALL SITES was a proxy for coverage, and D48 stage B broke the proxy:
   renderField calls provTipAttr once for every field of every generated level,
   so one site now serves 31 fields. Count what the question actually is —
   fields reached — which is the literal sites plus the generated ones. */
const F = require('../../source/modules/field_spec.js');
const FORM_LEVELS = JSON.parse(
  (/const FORM_LEVELS = (\[[^\]]*\])/.exec(html) || [])[1].replace(/'/g, '"'));
const generated = FORM_LEVELS.reduce(
  (n, lv) => n + F.fieldsOf(lv).filter(F.isFillable).length, 0);
/* v3.14.225: provTipAttr takes the OWNING OBJECT, not its field_prov, because
   resolving an interned id needs the lookup and no caller should have to know
   that. The check follows the signature rather than being relaxed. */
check(/provTipAttr\(obj, f\.key\)/.test(html),
      'renderField carries provenance for every field it draws',
      'one missing call here silently un-provenances every generated field');
const tips = [...html.matchAll(/provTipAttr\(/g)].length - 1 + generated;
check(tips >= 20, `provenance reaches ${tips} fields (${generated} of them generated)`,
      'D43 moved 21 line sites onto it; far fewer means some fields lost provenance entirely');

/* Every one must sit on an element that can host a ::after. A text field cannot,
   which is the whole reason the attribute goes on the enclosing element. */
const onInput = [...html.matchAll(/<input[^>]*\$\{provTipAttr\(/g)];
check(onInput.length === 0, 'no tooltip is attached to a control that cannot render one',
      `${onInput.length} sit directly on a text control, where ::after never paints`);

/* ── The IGT exception is deliberate and still documented ────────────────── */
check(/overflow-x/.test(html) && /title attrs used here/.test(html),
      'the IGT keeps native title=, with the reason written beside it',
      'the comment explaining why .igt-wrap cannot use the CSS bubble has gone');

/* ── derived stays visible ───────────────────────────────────────────────── */
/* v3.14.225: provTipAttr takes the owning object and resolves through
   fieldProv, so the record is passed the way the app holds it. `S` is stubbed
   with an empty event table: these cases all use the inline object shape, so the
   interned branch is never taken — and if it ever were, an empty table would
   return null and the assertions below would fail rather than pass quietly. */
const ctx = vm.createContext({
  escAttr: s => String(s == null ? '' : s),
  S: { provEvents: [], annotatorsById: new Map() },
  displayName: a => (a && a.name) || '',
});
// v3.14.261: provTipAttr resolves derived-ness through isDerived now (B-137).
for (const fn of ['fieldProv', 'provDisplayName', 'isDerived', 'provTipAttr'])
  vm.runInContext(fnSrc(_FILE, fn), ctx);
const call = (fp) => ctx.provTipAttr({ field_prov: { f: fp } }, 'f');

check(call({ annotator: 'Real Person', date: '2026-08-28' }).includes('data-prov-tip'),
      'a human edit gets a tooltip');
check(!call({ annotator: 'Real Person', date: '2026-08-28' }).includes('data-prov-derived'),
      'and is NOT marked derived');
check(call({ annotator: 'auto (lexicon)', date: '2026-08-28', derived: true }).includes('data-prov-derived'),
      'a lexicon fill is marked derived');
/* v3.14.261, B-137. This case used to assert that an MT stamp is marked derived
   "which has no derived flag of its own" — a guard holding the WORKAROUND in
   place. `provTipAttr` recovered derived-ness by matching /^auto/ against a
   display name, and `_humanField` never did, so the two readers disagreed and a
   machine translation counted as a person's work in `hasAnnotation`.

   Every derived writer sets the flag now, so the assertion is the invariant
   rather than the rescue: the flag decides, and a name that merely looks
   automatic does not. */
check(call({ annotator: 'auto-nllb-200', date: '2026-08-28', derived: true }).includes('data-prov-derived'),
      'an MT stamp is marked derived, by its flag');
check(!call({ annotator: 'auto-ish person', date: '2026-08-28' }).includes('data-prov-derived'),
      'and a NAME that starts with "auto" is not enough on its own',
      '         the /^auto/ test would have claimed this one; a person may be called anything');
check(!/\/\^auto\//.test(decomment(read('LingCoT.html'))),
      'no reader recovers derived-ness from a display name any more',
      '         one flag, one test: isDerived(). Decommented, because three comments '
      + 'describe the retired test, and describing it is not doing it.');

check(/\[data-prov-derived\][^{]*\{/.test(css), 'the derived mark is styled');
check(/\[data-prov-tip\]:hover::after/.test(css), 'the tooltip still opens on hover');

/* D43 recorded this debt against D39. Failing here would be wrong — the fix is
   not owed yet — but it must not be forgotten either, so it is stated. */
if (!/\[data-prov-tip\]:focus-within::after/.test(css))
  console.log('  note the tooltip has no focus state, so it is invisible to the keyboard.\n' +
              '       D43 assigned this to D39: add [data-prov-tip]:focus-within::after.');

/* ── Interning stage A: one reader, so stage B is one edit ──────────────────
   The whole point of the accessor is that `field_prov` moves from holding
   inline objects to holding indexes into `S.provEvents` without any consumer
   noticing. That only works if no consumer reaches into it directly, which
   fourteen call sites and three inline template reads did before v3.14.225. */
{
  const { decomment, moduleFiles } = require('./_source.js');
  const all = decomment([html, ...Object.values(Object.fromEntries(moduleFiles()))].join('\n'));

  /* A read is `.field_prov` followed by a property or an index. Writes and
     deletes are not reads and stay as they are — stage B converts them. */
  const reads = [...all.matchAll(/field_prov(\?)?\.(\w+)(\?)?\.(\w+)/g)]
    .filter(m => !/^(gloss|type|dict_id|transliterations|morphological_parse|translations|head|syntactic_parse|lemma_id|part_of_speech)$/.test(m[2]) || /\.(annotator|date|time|derived)$/.test(m[0]));
  check(reads.length === 0,
        'nothing reads a provenance record straight out of field_prov',
        reads.map(m => m[0]).join(', ') + ' — go through fieldProv(obj, key)');

  check(/function fieldProv\(obj, key\)/.test(html), 'fieldProv() is the accessor');
  check(/function provDisplayName\(rec\)/.test(html), 'provDisplayName() resolves the name');
  check(/typeof v === 'number'/.test(fnSrc(_FILE, 'fieldProv')),
        'and it already tolerates an interned id',
        'stage B stores integers; a reader that assumes an object would blank every tooltip');

  /* The display name is stored only where it cannot be derived. Stage B drops it
     everywhere else, and this is what makes that safe: an automatic stamp has no
     annotator_id, so its name IS its identity and must survive. */
  /* Executed, because the source checks below cannot separate the two paths:
     every record in the cases above carries an inline name, so reading it
     directly and resolving it give the same answer. A record with an id and no
     name is the case stage B creates, and only the lookup answers it. */
  {
    const c2 = vm.createContext({
      escAttr: x => String(x == null ? '' : x),
      S: { provEvents: [], annotatorsById: new Map([['ann_001', { name: 'Real Person' }]]) },
      displayName: a => (a && a.name) || '',
    });
    for (const fn of ['fieldProv', 'provDisplayName', 'isDerived', 'provTipAttr'])
      vm.runInContext(fnSrc(_FILE, fn), c2);
    const named = c2.provTipAttr({ field_prov: { f: { annotator_id: 'ann_001', date: '2026-08-29' } } }, 'f');
    check(named.includes('Real Person'),
          'a record with an id and no name resolves to the person',
          'this is the shape stage B stores; reading rec.annotator gives undefined');
    const unknown = c2.provTipAttr({ field_prov: { f: { annotator_id: 'ann_404', date: '2026-08-29' } } }, 'f');
    check(unknown.includes('ann_404'),
          'and an id with no participant loaded falls back to the id itself');
  }

  const pdn = fnSrc(_FILE, 'provDisplayName') || '';
  check(/if \(rec\.annotator\) return rec\.annotator;/.test(pdn),
        'a stored name wins, which is how automatic stamps keep their identity');
  check(/annotatorsById\.get/.test(pdn),
        'and a person is looked up, so renaming an annotator renames their work');
  check(/rec\.annotator_id \|\| ''/.test(pdn),
        'with the bare id as the fallback when participants have not loaded',
        'a corpus can be opened without its companion file; that is a real state');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
