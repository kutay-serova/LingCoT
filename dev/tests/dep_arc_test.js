#!/usr/bin/env node
/* =============================================================================
   dep_arc_test.js. D25 P2 arc diagram geometry
   Run:  node dev/tests/dep_arc_test.js
   =============================================================================
   Covers the two pure functions behind the diagram: which arcs get drawn
   (_depArcData) and how they stack (_depArcLevels).  The drawing pass itself
   needs real layout measurement and is out of scope here, boot_smoke_test.js
   covers that it loads, and the rest is visual.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');

function extract(name) {
  const start = SRC.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`extract: ${name} not found in LingCoT.html`);
  let depth = 0;
  for (let j = SRC.indexOf('{', start); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`extract: unbalanced braces in ${name}`);
}

// B-015: _depArcData now reads relations through depRelOf(), so that helper has
// to come along or the eval'd copy throws on an undefined reference.
// B-034 (v3.14.295): `_depArcAnchors` decides where each arc MEETS its tokens.
const NAMES = ['depLocalId', 'depRelOf', '_depArcData', '_depArcLevels', '_depArcAnchors'];
/* `_ARC_ANCHOR_PITCH` is a module-level const, and `extract` slices FUNCTIONS —
   so it is read out of the source and declared alongside them. Read rather than
   restated: a guard carrying its own copy of the number would keep passing while
   the diagram drew at a different one. */
const CONSTS = ['_ARC_ANCHOR_PITCH', '_ARC_ANCHOR_SPAN'].map(n => {
  const m = new RegExp(`const ${n} = \\d+;`).exec(SRC);
  if (!m) throw new Error(`${n} not found in LingCoT.html`);
  return m[0];
});
const numOf = decl => Number(/= (\d+)/.exec(decl)[1]);
const PITCH = numOf(CONSTS[0]), SPAN = numOf(CONSTS[1]);
const { depLocalId, _depArcData, _depArcLevels, _depArcAnchors } =
  new Function(CONSTS.join('\n') + '\n' + NAMES.map(extract).join('\n')
             + `\nreturn {${NAMES.join(',')}};`)();

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

/* B-034's section asserts properties rather than exact values, so it needs a
   boolean form of `eq`. Same counters, so one summary covers the file. */
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const w = (n, form, extra = {}) =>
  ({ id: `doc_1.sec_001.p_001.s_001.w_${String(n).padStart(3, '0')}`, form, ...extra });
const sent = words => ({ id: 'doc_1.sec_001.p_001.s_001', words });

/* Yaşlı köpek bahçede sessizce uyudu .
   1→2 amod · 2→5 nsubj · 3→5 obl · 4→5 advmod · 5 root · 6→5 punct        */
const TR = sent([
  w(1, 'Yaşlı',    { head: 'w_002', dep_rel: 'amod'   }),
  w(2, 'köpek',    { head: 'w_005', dep_rel: 'nsubj'  }),
  w(3, 'bahçede',  { head: 'w_005', dep_rel: 'obl'    }),
  w(4, 'sessizce', { head: 'w_005', dep_rel: 'advmod' }),
  w(5, 'uyudu',    { head: null,    dep_rel: 'root'   }),
  w(6, '.',        { head: 'w_005', dep_rel: 'punct'  }),
]);

console.log('\n_depArcData');
{
  const { arcs, root } = _depArcData(TR);
  eq(root, 4, 'root index found (0-based)');
  eq(arcs.length, 5, 'five arcs — root contributes none');
  eq(arcs[0], { dep: 0, head: 1, rel: 'amod' }, 'first arc dep/head are 0-based indices');
  eq(arcs.map(a => a.rel), ['amod', 'nsubj', 'obl', 'advmod', 'punct'], 'relations in token order');
  eq(arcs.some(a => a.dep === 4), false, 'root token is not also a dependent');
}
{
  const s = sent([w(1, 'a'), w(2, 'b')]);
  eq(_depArcData(s), { arcs: [], root: -1 }, 'unparsed sentence → nothing to draw');
}
{
  const s = sent([w(1, 'a', { head: 'w_099', dep_rel: 'nsubj' }), w(2, 'b')]);
  eq(_depArcData(s).arcs, [], 'dangling head is skipped, not drawn wrong');
}
{
  const s = sent([w(1, 'a', { head: 'w_001', dep_rel: 'dep' })]);
  eq(_depArcData(s).arcs, [], 'self-loop is skipped');
}
{
  const s = sent([w(1, 'a', { head: 'w_002' }), w(2, 'b', { head: null })]);
  eq(_depArcData(s).arcs[0].rel, '', 'head without relation still draws, unlabelled');
}
{
  // Head appearing before its dependent, arcs must work right-to-left too.
  const s = sent([w(1, 'ate', { head: null, dep_rel: 'root' }),
                  w(2, 'rice', { head: 'w_001', dep_rel: 'obj' })]);
  eq(_depArcData(s).arcs[0], { dep: 1, head: 0, rel: 'obj' }, 'backward arc recorded as-is');
}

console.log('\n_depArcLevels');
{
  const { arcs } = _depArcData(TR);
  const lv = _depArcLevels(arcs);
  //  amod(0–1)=1 · nsubj(1–4) contains obl+advmod · obl(2–4) contains advmod
  //  advmod(3–4)=1 · punct(4–5)=1
  eq(lv, [1, 3, 2, 1, 1], 'nested arcs stack above the ones they contain');
}
{
  eq(_depArcLevels([]), [], 'no arcs → no levels');
}
{
  // Two disjoint arcs never stack, nesting, not overlap, drives height.
  const arcs = [{ dep: 0, head: 1 }, { dep: 2, head: 3 }];
  eq(_depArcLevels(arcs), [1, 1], 'disjoint arcs share level 1');
}
{
  // Crossing (neither contains the other) also stays flat.
  const arcs = [{ dep: 0, head: 2 }, { dep: 1, head: 3 }];
  eq(_depArcLevels(arcs), [1, 1], 'crossing arcs are not treated as nested');
}
{
  // Three-deep nesting.
  const arcs = [{ dep: 0, head: 5 }, { dep: 1, head: 4 }, { dep: 2, head: 3 }];
  eq(_depArcLevels(arcs), [3, 2, 1], 'levels increase outward');
}
{
  // Equal spans must not stack on each other (strict containment only),
  // otherwise two parallel arcs would drift apart for no reason.
  const arcs = [{ dep: 0, head: 2 }, { dep: 2, head: 0 }];
  eq(_depArcLevels(arcs), [1, 1], 'equal spans stay at the same level');
}

/* ── B-013: the measurement origin ────────────────────────────────────────────
   The drawing pass needs real layout, so its geometry cannot be asserted here.
   What CAN be pinned is which origin it measures against, and that is exactly
   what broke: `_depDrawArcs` used `el.offsetLeft`, which is relative to the
   nearest POSITIONED ancestor. Neither .dep-arc-wrap nor .dep-arc-row is
   positioned, so offsetParent walked up to the page and every x carried the
   left inset of the centred content column, arcs drawn hundreds of pixels
   right of their tokens, while the SVG's own x=0 sat at the wrap's left edge.

   The fix measures each token against the SVG's own bounding rect, which is
   immune to padding, margins and offsetParent entirely. This pin fails if
   anyone reintroduces offset-based measurement. */
console.log('\narc measurement origin (B-013)');
{
  // Strip comments first: the fix's own explanatory comment names offsetLeft,
  // and a pin that matches prose rather than code is worthless.
  const draw = extract('_depDrawArcs')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  eq(/getBoundingClientRect/.test(draw), true,
     'centres are measured with getBoundingClientRect');
  eq(/svgLeft/.test(draw), true,
     'measured against the SVG\'s own left edge, the arcs\' x=0');
  eq(/\.offsetLeft/.test(draw), false,
     'offsetLeft is NOT used in code — it depends on an offsetParent nothing establishes');
}

console.log('\nB-034 — every endpoint at a token has its own x\n');
{
  check(PITCH > 0 && SPAN > 0,
        `pitch and span are read from the source (${PITCH}px, ${SPAN}px)`,
        'a pitch of 0 makes every assertion below vacuously true');

  /* The reported case: a token that is BOTH a head and a dependent. Sentence
     `a b c` with b → c and a → b, so `b` carries its own outgoing tail and an
     incoming arrowhead from `a`. Before this, all three landed on b's centre. */
  const arcs = [{ dep: 1, head: 2, rel: 'obj' },    // b's tail, at b
                { dep: 0, head: 1, rel: 'nsubj' }]; // a's arrowhead, at b
  const an = _depArcAnchors(arcs);
  eq(an.length, 2, 'one anchor pair per arc');
  const atB = [an[0].depDx, an[1].headDx];
  check(atB[0] !== atB[1],
        `the tail and the arrowhead at b get different x (${atB.join(' / ')})`,
        '       B-034: centred on the token, the arrowhead belonged to every arc landing there');

  /* And the ORDER is the rule, not merely the separation: b's tail reaches
     RIGHT to c, a's arc reaches LEFT from a, so the tail must sit right of the
     arrowhead or the two cross each other in the last pixels before they land. */
  check(an[0].depDx > an[1].headDx,
        'the endpoint reaching right attaches right of the one reaching left',
        `       tail ${an[0].depDx} should exceed arrowhead ${an[1].headDx}`);

  // A token with ONE endpoint is untouched, which is almost every token.
  check(an[0].headDx === 0 && an[1].depDx === 0,
        'a token with a single endpoint keeps the centre it always had');

  /* Symmetric, so the row still reads as centred however many arcs land. */
  const many = [{ dep: 0, head: 3 }, { dep: 1, head: 3 }, { dep: 2, head: 3 }, { dep: 4, head: 3 }];
  const am = _depArcAnchors(many);
  const heads = am.map(a => a.headDx);
  eq(new Set(heads).size, 4, `four arrowheads at one token get four x values (${heads.join(', ')})`);
  check(Math.abs(heads.reduce((s, x) => s + x, 0)) < 1e-9,
        'and they fan symmetrically about the centre',
        `       sum ${heads.reduce((s, x) => s + x, 0)} — an asymmetric fan drags the token off-centre`);
  check(heads[0] < heads[1] && heads[1] < heads[2] && heads[2] < heads[3],
        'ordered by where each arc comes from, so none of them cross at the landing');

  /* Anchors must not disturb what was already right: the levels are unchanged,
     and dep_arc_test's own geometry section above still passes on them. */
  /* The fan stays inside the token. A verb with six dependents at full pitch
     would spread 35px and start pointing at its neighbours, so the pitch closes
     up rather than the span growing. */
  const wide = Array.from({ length: 7 }, (_, i) => ({ dep: i, head: 7 }));
  const aw = _depArcAnchors(wide).map(a => a.headDx);
  check(Math.max(...aw) - Math.min(...aw) <= SPAN + 1e-9,
        `seven arrowheads still fan within ${SPAN}px (${(Math.max(...aw) - Math.min(...aw)).toFixed(1)})`,
        '       a fan wider than its token points at the tokens beside it');
  eq(new Set(aw).size, 7, 'and all seven remain distinct');

  const before = JSON.stringify(_depArcLevels(many));
  _depArcAnchors(many);
  eq(JSON.stringify(_depArcLevels(many)), before, 'and the stacking levels are untouched');

  /* The drawing pass has to USE them, at both ends and for the arrowhead —
     computing anchors and drawing on the centre is the defect with a function. */
  const drawSrc = extract('_depDrawArcs');
  check(/_depArcAnchors\(/.test(drawSrc), 'the draw pass asks for the anchors');
  check(/centre\(a\.dep\)\s*\+\s*anchors\[k\]\.depDx/.test(drawSrc)
     && /centre\(a\.head\)\s*\+\s*anchors\[k\]\.headDx/.test(drawSrc),
        'and both endpoints are drawn at them, not at the token centre');
  const tip = /dep-arc-tip[^`]*/.exec(drawSrc);
  check(!!tip && !/centre\(/.test(tip[0]),
        'the arrowhead is drawn from x2, which now carries the arc\'s own offset',
        '       an arrowhead re-derived from the token centre is B-034 again');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
