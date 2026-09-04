#!/usr/bin/env node
/* =============================================================================
   row_editor_test.js, one descriptor drives every repeated-row collection
   Run:  node dev/tests/row_editor_test.js
   =============================================================================
   I2, v3.14.404. `INPUT_UX_AUDIT` §3.1 found five near-copies: each collection
   with its own builder, `render*Editor`, `read*Editor`, add/remove `data-action`
   and handler, the handlers differing in exactly three things — the builder
   called, the class removed, the child focused.

   THIS GUARD EXECUTES THE DESCRIPTOR. The property is not "the file contains a
   descriptor" — that is satisfiable by a constant nothing reads. It is that
   adding, removing and reading a row all go through the one path, for every
   declared collection, against a real DOM. So it builds rows, clicks nothing but
   calls what the handler calls, and reads the values back.

   AND IT WATCHES FOR THE FIFTH. `sel` is in the descriptor because its two
   differences are declarable: rows found through the enclosing frame (`rows`),
   and never left empty (`minOne`). A regression that quietly drops it back to a
   special case would leave the other four passing, so `minOne` is asserted by
   behaviour, not by presence.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { ROOT, read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* The stylesheet, and the two readers §4 and §6 share. Hoisted rather than
   block-scoped: both sections ask the same question of it, and a second copy
   is the thing this file exists to stop. */
const css = fs.readFileSync(path.join(ROOT, 'source', 'LingCoT.css'), 'utf8');
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // a comment before a rule
const ruleCount = (sel) => {                           // joins its selector otherwise
  let n = 0;
  for (const m of bare.matchAll(/([^{}]+)\{([^}]*)\}/g))
    if (m[1].split(',').map(x => x.trim()).includes(sel) && m[2].trim()) n++;
  return n;
};
const hasRule = (sel) => ruleCount(sel) > 0;

console.log('\none descriptor, every row collection\n');

/* Lift the descriptor and its four functions out of participants.js and run
   them. The row builders are stubbed: what is under test is the ONE path, not
   the markup each collection happens to produce. */
const pj = read('modules/participants.js');
const slice = (name) => {
  const i = pj.indexOf(name);
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0, j = pj.indexOf('{', i);
  for (let k = j; k < pj.length; k++) {
    if (pj[k] === '{') d++;
    else if (pj[k] === '}') { d--; if (!d) return pj.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + name);
};

const src = [
  slice('const ROW_EDITORS = {') + ';',
  slice('function rowsElFor('),
  slice('function addRowTo('),
  slice('function removeRowFrom('),
  slice('function readRowEditor('),
  /* D62 C, v3.14.410: the read-only half, executed the same way. */
  slice('const LIST_VIEWS = {') + ';',
  slice('function _srcDateMeta('),
  slice('function listViewHtml('),
  'const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");',
  'const sourceById = (id) => ({ src_1: { name: "Speaker A" } })[id] || null;',
].join('\n');

/* A DOM small enough to read and real enough to mean something. */
const { JSDOM } = (() => { try { return require('jsdom'); } catch { return {}; } })();
let ctx;
if (JSDOM) {
  const dom = new JSDOM('<body></body>');
  ctx = vm.createContext({ document: dom.window.document, console });
} else {
  /* No jsdom here — a tiny stand-in with only what the four functions touch. */
  const mk = (cls) => {
    const el = { className: cls, children: [], parentElement: null, _html: '' };
    el.querySelector = (sel) => el.children.find(c => '.' + c.className === sel
      || (c.fields && sel.startsWith('.') && c.className === sel.slice(1))) || null;
    el.querySelectorAll = (sel) => el.children.filter(c => '.' + c.className === sel);
    el.insertAdjacentHTML = (_, html) => {
      const c = mk(/class="([\w-]+)"/.exec(html)?.[1] || 'row');
      c.parentElement = el; el.children.push(c); el.lastElementChild = c;
    };
    Object.defineProperty(el, 'lastElementChild', {
      get() { return el.children[el.children.length - 1] || null; }, configurable: true });
    el.remove = () => { const p = el.parentElement;
      if (p) p.children = p.children.filter(c => c !== el); };
    return el;
  };
  const byId = {};
  ctx = vm.createContext({ console, document: {
    getElementById: id => byId[id] || null,
  }, __mk: mk, __byId: byId });
}
vm.runInContext(src, ctx);
const D = vm.runInContext('ROW_EDITORS', ctx);

/* ── 1 · every collection is declared, and declares what it needs ───────── */
const KINDS = ['comment', 'translit', 'allomorph', 'translation', 'sel'];
check(Object.keys(D).length >= 5,
      `${Object.keys(D).length} collection(s) declared`,
      '         the audit measured five; fewer means one went back to a special case');
for (const k of KINDS) {
  check(!!D[k], `${k} is declared`, '         it was one of the five §3.1 counted');
  if (!D[k]) continue;
  check(typeof D[k].build === 'function' && typeof D[k].rowClass === 'string' && typeof D[k].focus === 'string',
        `${k} declares build, rowClass and focus`,
        '         these are the three the ten handlers differed in — all three, or the handler is back');
}

/* ── 2 · the four that are read declare how ─────────────────────────────── */
for (const k of ['comment', 'translit', 'allomorph', 'translation']) {
  check(typeof D[k]?.fields === 'function' && typeof D[k]?.keep === 'function',
        `${k} declares fields and keep`,
        '         the reader is driven by these; without them readRowEditor returns []');
}

/* ── 3 · keep, EXECUTED — the emptiness rule each collection actually has ── */
const KEEP = [
  ['comment',     { text: '' },                       false, 'a comment with no text'],
  ['comment',     { text: 'x' },                      true,  'a comment with text'],
  ['translit',    { label: '', text: '' },            false, 'B-142: an emptied row is dropped, so the field can be CLEARED'],
  ['translit',    { label: 'IPA', text: '' },         true,  'a label alone is still an answer'],
  ['allomorph',   { form: '', environment: '/_#' },   false, 'an environment with no form says nothing'],
  ['allomorph',   { form: 'a' },                      true,  'a form alone is enough'],
  ['translation', { text: '' },                       false, 'a translation with no text'],
];
for (const [k, v, want, why] of KEEP)
  check(D[k].keep(v) === want,
        `${k}.keep(${JSON.stringify(v)}) is ${want}`, `         ${why}`);

/* ── 4 · sel's two differences are DECLARED, not special-cased ──────────── */
check(typeof D.sel.rows === 'function',
      'sel finds its rows through the enclosing frame, declared',
      '         the other four use `<container>-rows` by id; sel cannot, and the\n'
    + '         descriptor has to be able to say so or sel goes back to a handler');
check(D.sel.minOne === true,
      'sel refuses to be left with zero rows, declared',
      '         a frame with no selects is unreadable and is dropped on save');
check(!D.comment.minOne && !D.translit.minOne,
      'and minOne is not on the collections that do not want it',
      '         a flag that is always true is not a flag');

/* ── 4b · layout is DECLARED, and the CSS carries the two variants ──────── */
{
  const undeclared = KINDS.filter(k => !['inline', 'stacked'].includes(D[k]?.layout));
  check(undeclared.length === 0, 'every collection declares layout: inline or stacked',
        `         missing or invalid: ${undeclared.join(', ')}\n`
      + '         five collections were never five variations, they are two families by axis');

  const inline  = KINDS.filter(k => D[k].layout === 'inline');
  const stacked = KINDS.filter(k => D[k].layout === 'stacked');
  check(inline.length >= 3 && stacked.length >= 2,
        `${inline.length} inline, ${stacked.length} stacked`,
        '         one family with every collection in it is not a distinction');

  /* EXACT, not "mentioned". `.row-ed--stacked` also appears in
     `.row-ed--stacked + .row-ed--stacked` and `.row-ed--stacked .row-x`, so a
     substring test passed while the rule itself had been deleted. The selector
     has to be the whole selector, or one member of a comma list. */
  for (const sel of ['.row-ed', '.row-ed--inline', '.row-ed--stacked', '.row-x', '.row-add'])
    check(hasRule(sel), `${sel} has a rule of its own`,
          '         the component the descriptor names must exist in the stylesheet');

  /* The borrowed names are gone from both sides. A rule with no emitter is dead;
     an emitter with no rule is what L-045 was. */
  const pj2 = read('modules/participants.js');
  for (const gone of ['translit-add-btn'])
    check(!new RegExp('class="[^"]*' + gone).test(pj2), `nothing emits ${gone} any more`,
          '         allomorph and sel borrowed it because they had no rule of their own');

  /* L-046: the four view containers are emitted; none may be unstyled. */
  const views = ['comments-view', 'transliterations-view', 'translations-view', 'allomorphs-view'];
  const unstyled = views.filter(v => !hasRule('.' + v));
  check(unstyled.length === 0, 'every emitted view container has a rule',
        unstyled.map(v => `         .${v} is emitted with no CSS`).join('\n')
      + '\n         three of these had zero rules until v3.14.407');

  /* Once, not once-per-place. `.allomorphs-view` was declared twice, 1000 lines
     apart, and the later one silently won: a container written as a row read as
     a column and nothing said so. Same for the component itself. */
  for (const sel of ['.comments-view', '.transliterations-view', '.translations-view',
                     '.allomorphs-view', '.row-ed', '.row-ed--inline', '.row-ed--stacked',
                     '.row-x', '.row-add']) {
    const n = ruleCount(sel);
    check(n === 1, `${sel} is declared once`,
          `         declared ${n} times; the last one in the file wins and the`
        + '\n         earlier ones are dead text that still reads as the rule');
  }
}

/* ── 5 · nothing bespoke survived in events.js ──────────────────────────── */
{
  const ev = read('modules/events.js');
  const strays = [];
  for (const k of KINDS)
    for (const verb of ['add', 'remove'])
      if (new RegExp(`closest\\('\\[data-action="${k}-${verb}"\\]'\\)`).test(ev))
        strays.push(`         [data-action="${k}-${verb}"] still has its own block`);
  check(strays.length === 0, 'no per-collection row handler survives in events.js',
        strays.join('\n') + '\n         ten blocks became one; a returning block is the duplication returning');
  check(/ROW_EDITORS\[/.test(ev), 'the one handler consults the descriptor',
        '         without this the handler is a switch by another name');
}

/* ── 6 · the read-only side declares, and reuses the editor's answer ────── */
console.log('\nthe read-only views are declared, not drawn four ways\n');
{
  const V = vm.runInContext('LIST_VIEWS', ctx);
  const build = vm.runInContext('listViewHtml', ctx);
  const VIEWS = ['comment', 'translation', 'translit', 'allomorph'];

  check(Object.keys(V).length === VIEWS.length,
        `${Object.keys(V).length} view(s) declared`,
        '         L-046 counted four render*View functions for one data shape');

  /* Every property is declared and its value is one of the known ones. An
     undeclared property is how the fifth treatment gets invented. */
  const PRIMARY   = ['prose', 'segment'];
  const SECONDARY = ['attribution', 'qualifier', 'scheme'];
  const EMPHASIS  = ['none', 'meta-language'];
  for (const k of VIEWS) {
    const d = V[k] || {};
    check(PRIMARY.includes(d.primary) && SECONDARY.includes(d.secondary)
          && EMPHASIS.includes(d.emphasis) && typeof d.container === 'string',
          `${k} declares container, primary, secondary and emphasis`,
          `         got ${JSON.stringify({ primary: d.primary, secondary: d.secondary,
                                            emphasis: d.emphasis })}`);
  }

  /* The assignment itself, asserted literally. Without this the section above is
     self-consistent and says nothing: it reads the declared value and checks the
     class matches it, so a view that changed its own mind would pass. D62 §4.2
     is the decision; this is the copy that fails when they diverge. */
  const DECIDED = {
    comment:     { primary: 'prose',   secondary: 'attribution', emphasis: 'none' },
    translation: { primary: 'prose',   secondary: 'attribution', emphasis: 'meta-language' },
    translit:    { primary: 'segment', secondary: 'scheme',      emphasis: 'none' },
    allomorph:   { primary: 'segment', secondary: 'qualifier',   emphasis: 'none' },
  };
  for (const k of VIEWS) {
    const want = DECIDED[k], got = V[k] || {};
    check(want.primary === got.primary && want.secondary === got.secondary
          && want.emphasis === got.emphasis,
          `${k} is declared as D62 §4.2 decided`,
          `         decided ${JSON.stringify(want)}`
        + `\n         actual  ${JSON.stringify({ primary: got.primary,
              secondary: got.secondary, emphasis: got.emphasis })}`
        + '\n         re-deciding is allowed; re-deciding in one place is not');
  }

  /* Every declared value reaches the stylesheet or is one of the two that
     deliberately take the base rule with no modifier. A value with neither is a
     class emitted against nothing, which is L-046's original complaint. */
  const BASE = ['.lv-primary--prose', '.lv-secondary--attribution', '.lv-secondary--qualifier'];
  const orphans = [];
  for (const k of VIEWS) {
    for (const sel of [`.lv-primary--${V[k].primary}`, `.lv-secondary--${V[k].secondary}`])
      if (!hasRule(sel) && !BASE.includes(sel)) orphans.push(`         ${sel} (${k})`);
  }
  check(orphans.length === 0, 'every declared value has a rule, or is a documented base',
        orphans.join('\n') + '\n         a modifier class with no rule is a declaration nothing reads');

  /* The point of the whole exercise: layout is declared ONCE, on the editor,
     and the view reads it. A LIST_VIEWS entry that grew its own `layout` would
     be the second writer this was built to remove. */
  const restated = VIEWS.filter(k => 'layout' in (V[k] || {}));
  check(restated.length === 0, 'no view restates layout; it is read off ROW_EDITORS',
        '         restated by: ' + restated.join(', ')
      + '\n         the editor and the view are two presentations of one collection');

  /* Executed, not read. Build each view and assert what came out. */
  const SAMPLE = {
    comment:     [{ text: 'checked with speaker', source_id: 'src_1', date: '2026-02-01' }],
    translation: [{ text: 'the child ran', source_id: 'src_1', date: '2026-02-01' }],
    translit:    [{ label: 'IPA', text: 'tʃoˈdʒuk' }],
    allomorph:   [{ form: '-lAr', environment: '/ back V _' }],
  };
  for (const k of VIEWS) {
    const html   = build(k, SAMPLE[k]);
    const layout = vm.runInContext(`ROW_EDITORS['${k}'].layout`, ctx);
    check(html.includes(`lv-row--${layout}`), `${k} row carries its editor's layout (${layout})`,
          `         got: ${html.slice(0, 120)}`);
    check(html.includes(`lv-primary--${V[k].primary}`)
          && html.includes(`lv-secondary--${V[k].secondary}`),
          `${k} row carries the primary and secondary it declares`,
          `         got: ${html.slice(0, 200)}`);
    check(html.includes(V[k].container), `${k} sits in .${V[k].container}`);
    check(!/-view-row/.test(html), `${k} emits no per-collection row class`,
          '         four names with no rule is the half of L-046 this closed');
  }

  /* Order within the row is part of the declaration: a scheme name leads, a
     qualifier follows. Asserted by position, because both are "beside". */
  const tr = build('translit', SAMPLE.translit);
  check(tr.indexOf('lv-secondary') < tr.indexOf('lv-primary'),
        'a scheme label leads its value',
        '         it repeats down the column, so it reads as a header not a suffix');
  const al = build('allomorph', SAMPLE.allomorph);
  check(al.indexOf('lv-primary') < al.indexOf('lv-secondary'),
        'a qualifier follows its value');

  /* meta-language is italic AND quoted, and only translations have it. */
  const tl = build('translation', SAMPLE.translation);
  check(tl.includes('lv-row--meta') && tl.includes("'the child ran'"),
        'a translation is marked meta-language and quoted');
  check(!build('comment', SAMPLE.comment).includes('lv-row--meta'),
        'a comment is not',
        '         the comment is in the object language or about it, not a rendering of it');

  /* Empty in, empty out — four functions each had their own version of this. */
  for (const k of VIEWS)
    check(build(k, []) === '' && build(k, null) === '' && build(k, [{}]) === '',
          `${k} renders nothing for an empty list`,
          '         and nothing for a list whose entries are all blank');

  /* The stylesheet defines each declared value exactly once. Same count-not-
     presence check as §4, for the same reason. */
  for (const sel of ['.lv-row', '.lv-row--inline', '.lv-row--stacked', '.lv-row--meta',
                     '.lv-primary', '.lv-primary--segment', '.lv-secondary',
                     '.lv-secondary--scheme']) {
    const n = ruleCount(sel);
    check(n === 1, `${sel} is declared once`,
          `         declared ${n} times`);
  }

  /* The finding was FOUR SIZES for one shape. One size for the primary, one for
     the secondary, and no row rule of its own — that is the property, and a
     guard that checked the look instead could not fail for this reason. */
  const sizes = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(m => /\.lv-(row|primary|secondary)/.test(m[1]))
    .map(m => (m[2].match(/font-size:\s*([^;]+)/) || [])[1])
    .filter(Boolean).map(v => v.trim());
  check(new Set(sizes).size === 2, `two font sizes across the component (${[...new Set(sizes)].join(', ')})`,
        '         L-046 measured four, between 0.85 and 0.9 rem, none chosen'
      + '\n         against the other three');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
