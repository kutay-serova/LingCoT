/**
 * word_edit_pos_test.js, word-edit morpheme-row render + POS chip wiring
 *
 * Slices morphEditRowsHtml + chipRowHtml out of LingCoT.html and renders sample
 * rows, asserting the realigned stacked layout and that each row's gloss/POS input
 * ids and POS chip targets stay in sync per position. Guards the S2-chips / morph
 * realign work (no browser needed).
 *
 * Run:  node dev/tests/word_edit_pos_test.js   (exit 0 = pass)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');
const JS   = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

function sliceFn(name) {
  const start = JS.indexOf('function ' + name);
  if (start < 0) throw new Error('cannot slice ' + name);
  let p = JS.indexOf('(', start), pd = 0, q = p;
  for (; q < JS.length; q++) {
    if (JS[q] === '(') pd++;
    else if (JS[q] === ')') { pd--; if (pd === 0) { q++; break; } }
  }
  let i = JS.indexOf('{', q), depth = 0;
  for (; i < JS.length; i++) {
    if (JS[i] === '{') depth++;
    else if (JS[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return JS.slice(start, i);
}

// ── Stubs ─────────────────────────────────────────────────────────────────────
global.esc      = s => String(s == null ? '' : s);
global.escAttr  = s => String(s == null ? '' : s);
/* v3.14.108 (S2): morpheme rows now carry a dictionary-link badge, so the
   extracted builder calls icon() and t(). Stubbed rather than removed from the
   app, the badge is what makes an assigned link visible, and a guard that
   forced it out of the markup would be testing a version nobody runs. */
global.icon     = n => `<svg data-icon="${n}"></svg>`;
if (typeof global.t !== 'function') global.t = (k) => k;
global.t        = k => k;
/* D43 replaced fieldProvHint with provTipAttr. The real one is sliced in below
   rather than stubbed, so the row markup this guard checks carries the same
   provenance attributes the app ships. */
/* B-009: morphEditRowsHtml now interpolates the shared input-attribute
   constants, so the eval'd copy needs them defined or it throws on an undefined
   reference. Mirrors the real values rather than stubbing them empty, so this
   file also proves the emitted rows actually carry the protections. */
/* D27 P4: chipRowHtml now shows a description tooltip on PoS/type chips, so the
   eval'd copy needs the resolvers. Stubbed to a recognisable value rather than
   '' so the assertions below could tell a missing tooltip from an empty one. */
global.posDesc            = tag => `desc:${tag}`;
/* D45: the drawer groups by corpus usage and narrows by scope, so the harness
   supplies both. POS_META empty means every tag is word-scope, which is what a
   project that has not set `scope` gets. */
global.POS_META           = { AFFIX: { scope: 'morpheme' }, PHRASE: { scope: 'multiword' } };
global._dataGen           = 1;
global._tagUsage          = null;
global._tagUsageGen       = -1;
/* B-087: per field, not one flag for the screen. The guard below asserts two
   rows get two independently-addressed drawers. */
global._tagDrawersOpen    = new Set();
global.S = Object.assign(global.S || {}, {
  wordById:   new Map(),
  dictionary: [{ form: 'ev', part_of_speech: 'NOUN', type: 'word' }],
  /* D50 stage 4a. Index 0 is deliberately a real moment: objProv resolving an
     id to nothing would otherwise look the same as an object with no stamp. */
  provEvents: [{ annotator_id: 'ann_001', date: '2026-08-30', time: '10:00:00' }],
  annotatorsById: new Map([['ann_001', { id: 'ann_001', name: 'Deniz' }]]),
});
global.displayName = a => a && a.name;
/* v3.14.262, L-017: the row draws a comments editor now. The real one lives in
   participants.js and has its own guards; here it only has to exist, so the row
   renders and the assertions below can be about the row. */
global.renderCommentsEditor = (id, list) =>
  `<div class="comments-editor" id="${id}"><div class="comment-rows" id="${id}-rows"></div>` +
  `<button data-action="comment-add" data-container="${id}"></button></div>`;
/* B-093 · D32, v3.14.303: the row draws a transliterations editor too. Same
   arrangement as the comments one above — the real component is guarded where it
   lives; here it only has to exist so the row renders. */
global.renderTransliterationsEditor = (id, list) =>
  `<div class="transliterations-editor" id="${id}"><div class="translit-rows" id="${id}-rows"></div>` +
  `<button data-action="translit-add" data-container="${id}"></button></div>`;
global.typeDesc           = tag => `desc:${tag}`;
global.LING_ATTRS         = 'autocapitalize="none" autocorrect="off" spellcheck="false"';
global.LING_ATTRS_UPPER   = 'autocapitalize="characters" autocorrect="off" spellcheck="false"';
global.POS_CHOICES        = ['NOUN','PROPN','PRON','VERB','AUX','ADJ','ADV','ADP','PART','LINK','COORD','DET','NUM','INTJ','SYM','AFFIX','UNK','PHRASE'];
global.POS_VISIBLE_MORPH  = ['AFFIX','NOUN','VERB'];
// B-093: the morpheme row carries a type field now, with its own chip row.
global.TYPE_CHOICES       = ['word','bound.morpheme','phrase','functional.word','root','stem','interjection','symbol','punctuation'];

/* B-027, v3.14.373: the drawer asks whether the field's value is in the pool,
   so it needs the reader that answers. `TAG_POOLS` comes with it — a const, not
   a function, so it is spliced in beside them. */
global.normMeta = x => String(x == null ? '' : x).normalize('NFC').toLowerCase();
{
  const { read, decomment } = require('./_source.js');
  const m = /const TAG_POOLS = \{[\s\S]*?\n\};/.exec(decomment(read('LingCoT.html')));
  if (m) eval(m[0].replace('const TAG_POOLS', 'global.TAG_POOLS'));
}

for (const fn of ['unknownTag', 'tagsInScope', 'tagUsage', 'tagDrawerHtml', 'tagDrawerIsOpen', 'chipRowHtml',
                  'morphPosDefault',
                  /* v3.14.225: provTipAttr resolves through fieldProv and
                     provDisplayName now, so the interning can move where a
                     field's provenance is stored without touching its readers. */
                  /* v3.14.246, D50 stage 4a: the morpheme row's stamp resolves through
                     objProv and provDisplayName now, so a stored id renders and B-130's
                     raw-field read cannot come back. */
                  'fieldProv', 'provDisplayName', 'provTipAttr', 'provById', 'objProv', '_morphRowProv',
                  'morphEditRowsHtml', '_fixMorphRowIds']) {
  vm.runInThisContext(sliceFn(fn), { filename: fn + '.js' });
}

// ── Minimal DOM mock for _fixMorphRowIds (no jsdom available) ──────────────────
// Builds a morpheme row as it looks right after morphEditRowsHtml([m]), i.e. all
// ids/targets carry index 0, so we can assert the reconcile re-stamps them to mi.
function mockNode(cls, attrs = {}) {
  return {
    cls, id: attrs.id || '', attrs: { ...attrs },
    setAttribute(k, v) { if (k === 'id') this.id = v; else this.attrs[k] = v; },
    getAttribute(k) { return k === 'id' ? this.id : this.attrs[k]; },
  };
}
/* B-007 (2026-08-06): this mock previously answered to '.pos-chip-row' and
   '.pos-chip', class names retired by the v3.13.4–8 chip unification and
   emitted by nothing since.  That made it a mock of a DOM that cannot exist, so
   it validated _fixMorphRowIds against fiction and passed while the real
   selectors matched nothing.  The class names below are pinned to what
   chipRowHtml actually emits by the guard test at the bottom of this file. */
const CHIP_ROW_CLASS = 'chip-row';
const CHIP_CLASS     = 'chip';

/* One field's input, its chip row, and the wrapper they share.

   B-093: the wrapper is not decoration in this mock. The row now holds TWO
   chip-bearing fields, so _fixMorphRowIds can no longer take "the first
   .chip-row in the row" — with two of them that silently meant the POS one for
   both. It reaches the chip row through the input's own parentElement instead,
   which is how the markup actually nests, so the mock has to nest too. A mock
   that stays flat here would keep passing while the product mixed up two
   fields' drawers, which is B-007 exactly. */
function mockField(inputCls, id) {
  const inp   = mockNode(inputCls, { id });
  const chips = [mockNode(CHIP_CLASS, { 'data-chip-target': id }),
                 mockNode(CHIP_CLASS, { 'data-chip-target': id })];
  /* D45 replaced the … expander with a drawer. Both the drawer's id and the
     button's target derive from the input's id, so both must move on reconcile
     — the same regression the expander had, one element further along. */
  const drawer = mockNode('tag-drawer', { id: `${id}-drawer` });
  const dBtn   = mockNode('tag-drawer-btn', { 'data-drawer-for': id });
  const chipRow = {
    cls: CHIP_ROW_CLASS, id: `${id}-chips`,
    querySelectorAll: sel => sel === '.' + CHIP_CLASS ? chips : [],
    querySelector: sel => sel === '.tag-drawer' ? drawer
                        : sel === '[data-action="tag-drawer"]' ? dBtn : null,
  };
  inp.parentElement = {
    querySelector: sel => sel === '.' + CHIP_ROW_CLASS ? chipRow : null,
  };
  return { inp, chips, drawer, dBtn, chipRow };
}

function mockRowAtIndex0() {
  const gloss = mockNode('morph-gloss-input', { id: 'ew-mg-0' });
  const pos   = mockField('morph-pos-input',  'ew-mp-0');
  const type  = mockField('morph-type-input', 'ew-mt-0');   // B-093
  const row = {
    querySelector: sel => ({
      '.morph-gloss-input': gloss,
      '.morph-pos-input':   pos.inp,
      '.morph-type-input':  type.inp,
    })[sel] || null,
  };
  return { row, gloss,
           posInp: pos.inp,   chips: pos.chips,  drawer: pos.drawer,
           dBtn: pos.dBtn,    chipRow: pos.chipRow,
           type };
}

// ── Tiny framework ────────────────────────────────────────────────────────────
/* One reporter, so the whole suite reads the same. v3.14.136: seven guards
   printed dots and a summary line while the other 33 printed ok/FAIL, which made
   the output two formats and made these seven invisible to anything counting
   assertions. The throwing-assert idiom below is kept, it suits table-driven
   cases; only what it PRINTS changed. */
let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
function test(name, fn) {
  try { fn(); check(true, name); }
  catch (e) { check(false, name, `         ${e.message}`); }
}

console.log('\nWord-edit POS render\n');
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const html = morphEditRowsHtml([
  { form: 'cat', gloss: 'cat', part_of_speech: 'NOUN', prov: { annotator: 'Ann', date: '2026-06-13' } },
  { form: '-s',  gloss: 'PL' },
]);

/* ── B-093: the morpheme type, which no surface could set until v3.14.193 ──
   `type` is defined by the schema and read by the exporter, and the only way a
   morpheme ever acquired one was inheritance from a dictionary entry (B-089).
   The field is here now, and these say what it must and must not do. */
test('B-093: every row carries a type field, addressed by its own index', () => {
  assert(html.includes('id="ew-mt-0"'), 'type input id 0');
  assert(html.includes('id="ew-mt-1"'), 'type input id 1');
  assert((html.match(/class="[^"]*morph-type-input/g) || []).length === 2,
         'both rows carry the class saveWord reads');
  assert(html.includes('id="ew-mt-0-chips"') && html.includes('id="ew-mt-1-chips"'),
         'each type field owns its chip row, so one drawer is not shared by two');
});

test('B-093/B-069: the type is never defaulted', () => {
  /* Whether a stem is free or bound is a fact about the language, not a position
     in a string. The POS field beside it DOES seed a default (B-071); this one
     must not, or every first morpheme would claim a type nobody chose — which
     is the claim B-069 removed from the push for the same reason. */
  const typeInputs = html.match(/<input[^>]*morph-type-input[^>]*>/g) || [];
  assert(typeInputs.length === 2, 'two type inputs to check');
  for (const tag of typeInputs)
    assert(/value=""/.test(tag), `an unset type renders empty, got: ${tag.slice(0, 120)}`);
});

test('B-093: a stored type is shown', () => {
  const withType = morphEditRowsHtml([{ form: 'gel', type: 'root' }]);
  assert(/id="ew-mt-0" value="root"/.test(withType), 'the stored value reaches the field');
});

test('B-093: saveWord reads the field back and stamps it', () => {
  const save = sliceFn('saveWord');
  assert(/morph-type-input/.test(save), 'saveWord collects the type inputs');
  /* v3.14.330, B-165: the three stamps were three literals and only the gloss
     asked whether the value came from an offer, so a type taken from the lexicon
     was recorded as the annotator's. One rule now, applied per field — so the
     assertion is that type goes THROUGH it. */
  assert(/_mStamp\('type'/.test(save),
         'and stamps provenance when it changed — a type the annotator typed is theirs, '
         + 'which is what distinguishes it from the derived stamp B-089 writes');
  assert(/dataset\.offerSrc \? _offerMoment\(el\.dataset\.offerSrc\)/.test(save),
         'and a type that arrived from an offer is stamped derived instead (B-165)');
  /* v3.14.236: spelled `type: (mType || existing?.type) || undefined` since
     B-124 moved the rebuild into mergeMorpheme. Same rule; that the cleared
     case still DELETES the key is executed by morpheme_merge_test.js. */
  assert(/type:\s*\(mType \|\| existing\?\.type\) \|\| undefined/.test(save),
         'and persists the field rather than only carrying the old value forward');
});

test('B-093: a live parse edit does not drop the type', () => {
  const sync = sliceFn('syncMorphemeRows');
  assert(/orig_type/.test(sync) && /type:\s*persisted\?\.type/.test(sync),
         'syncMorphemeRows reseeds type from persisted data, as it does for POS');
});

/* ── B-103: the row draws what the view actually hands it ──────────────────
   B-093 added a type field to the morpheme row and the tests above passed,
   because they call morphEditRowsHtml with objects they build themselves. The
   VIEW builds those objects in three literals inside renderWordEdit, and none
   of them carried `type` — so a stored type rendered as an empty box and looked
   like the app had discarded it.

   The gap is the same shape as testing formBodyHtml instead of the view: a
   component proven correct against a mock its caller does not produce. So this
   compares the two directly — every key the row reads must be a key the view
   supplies. */
test('B-103: renderWordEdit supplies every key the morpheme row reads', () => {
  const rowSrc  = sliceFn('morphEditRowsHtml');
  const viewSrc = sliceFn('renderWordEdit');
  const reads = new Set([...rowSrc.matchAll(/\bm\.(\w+)/g)].map(m => m[1]));
  // `orig_*` are the row's own convention for a pre-edit value, checked with them.
  const missing = [...reads].filter(k =>
    !new RegExp(`(^|[\\s{,])${k}:`, 'm').test(viewSrc));
  assert(missing.length === 0,
         `renderWordEdit never sets: ${missing.join(', ')} — the row reads them and gets undefined`);
});

test('Stacked layout: form header + fields grid present per row', () => {
  assert((html.match(/class="morph-edit-row"/g) || []).length === 2, 'two rows');
  assert((html.match(/class="morph-edit-row-hdr"/g) || []).length === 2, 'two headers');
  assert((html.match(/class="morph-edit-fields"/g) || []).length === 2, 'two field grids');
});

// ── B-071: POS defaults in the word annotation view ───────────────────────────
// The stem carries the word's POS, later morphemes are affixes, and a stored
// value always wins over the default. Executed against the shipped function.
/* ── B-130 and D50 stage 4a: the morpheme row's stamp ──────────────────────
   This line read `m.prov.annotator` — the stored field, not the derived name —
   and `thinProv` deletes that field wherever `annotator_id` can derive it. In
   the live corpus 67 of 77 morpheme stamps rendered as an empty name and a
   dangling separator. Nothing asserted on this span, which is why it survived
   the interning that created the condition.

   Three cases, because the three are stored differently on purpose:
     · a person's stamp, name derived from annotator_id
     · an automatic stamp, name stored because annotator_id is null and the
       name IS its identity
     · an INTERNED stamp, an integer into S.provEvents, which is what stage 4b
       will start writing */
test('B-130: a person\'s morpheme stamp renders the derived name, not blank', () => {
  const h = morphEditRowsHtml([{ form: 'kedi',
    prov: { annotator_id: 'ann_001', date: '2026-08-30', time: '10:00:00' } }]);
  const m = /<span class="morph-row-prov">([^<]*)<\/span>/.exec(h);
  assert(m, 'the stamp span should be emitted');
  assert(m[1] === 'Deniz \u00b7 2026-08-30',
         `expected "Deniz \u00b7 2026-08-30", got ${JSON.stringify(m[1])}`);
});

test('an automatic stamp keeps its stored name', () => {
  const h = morphEditRowsHtml([{ form: 'kedi',
    prov: { annotator: 'auto (lexicon)', annotator_id: null, date: '2026-08-30', derived: true } }]);
  const m = /<span class="morph-row-prov">([^<]*)<\/span>/.exec(h);
  assert(m[1] === 'auto (lexicon) \u00b7 2026-08-30', `got ${JSON.stringify(m[1])}`);
});

test('stage 4a: an interned stamp resolves through the table', () => {
  const h = morphEditRowsHtml([{ form: 'kedi', prov: 0 }]);
  const m = /<span class="morph-row-prov">([^<]*)<\/span>/.exec(h);
  assert(m[1] === 'Deniz \u00b7 2026-08-30',
         `an integer stamp must resolve; got ${JSON.stringify(m[1])}`);
});

test('a morpheme with no stamp renders nothing, not a bare separator', () => {
  const h = morphEditRowsHtml([{ form: 'kedi' }]);
  const m = /<span class="morph-row-prov">([^<]*)<\/span>/.exec(h);
  assert(m[1] === '', `got ${JSON.stringify(m[1])}`);
});

/* B-172, v3.14.335. These asserted the seed landed in `value=`, which is what
   made it saveable: `data-original` kept the stored value (empty), so `_mStamp`
   saw a change on save and stamped `prov()` — a part of speech nobody chose,
   recorded as the annotator's. The seed is a PLACEHOLDER now. Same suggestion,
   same positions, same uppercase; it simply is not an answer until somebody
   gives one. The measurement that settled it: `chinese-test`'s two non-initial
   morphemes are ADJ and NOUN, compound members, so `AFFIX` by position is false
   in one of the two shipping languages. */
const ph = (html, i) =>
  (new RegExp(`id="ew-mp-${i}"[^>]*placeholder="([^"]*)"`).exec(html) || [])[1];
const val = (html, i) =>
  (new RegExp(`id="ew-mp-${i}" value="([^"]*)"`).exec(html) || [])[1];

test('B-172: a lone morpheme is SUGGESTED the word POS, and stores nothing', () => {
  const html = morphEditRowsHtml([{ form: 'kedi' }], 'NOUN');
  assert(ph(html, 0) === 'NOUN', `lone morpheme should suggest the word POS, got ${ph(html, 0)}`);
  assert(val(html, 0) === '', 'and hold no value — an untouched box must not be saved as a decision');
});

test('B-172: stem suggests the word POS, suffixes suggest AFFIX', () => {
  const html = morphEditRowsHtml(
    [{ form: 'metin' }, { form: '(s)I(n)' }, { form: '(y)A' }], 'NOUN');
  assert(ph(html, 0) === 'NOUN',  'stem should suggest NOUN');
  assert(ph(html, 1) === 'AFFIX', 'first suffix should suggest AFFIX');
  assert(ph(html, 2) === 'AFFIX', 'second suffix should suggest AFFIX');
  assert([0, 1, 2].every(i => val(html, i) === ''),
         'and none of the three is a stored value');
});

test('B-172: AFFIX is uppercase, matching POS_CHOICES', () => {
  const html = morphEditRowsHtml([{ form: 'gel' }, { form: 'DI' }], 'VERB');
  assert(!/placeholder="affix"/.test(html),
         'a lowercase affix would suggest a different string than the chip writes');
});

test('B-172: a stored POS is a VALUE, and displaces the suggestion', () => {
  const html = morphEditRowsHtml(
    [{ form: 'metin', part_of_speech: 'PROPN' }, { form: 'lAr', part_of_speech: 'NOUN' }], 'NOUN');
  assert(val(html, 0) === 'PROPN', 'stored stem POS must show as a value');
  assert(val(html, 1) === 'NOUN',  'stored suffix POS must win over the AFFIX suggestion');
  assert(ph(html, 1) !== 'AFFIX',
         'and the suggestion goes, or the box advertises an answer it does not hold');
});

test('B-172: an unset word POS suggests nothing for the stem rather than guessing', () => {
  const html = morphEditRowsHtml([{ form: 'metin' }, { form: 'lAr' }], '');
  assert(ph(html, 0) !== 'AFFIX' && ph(html, 0) !== '', 'the stem falls back to the field label');
  assert(ph(html, 1) === 'AFFIX', 'suffixes are still suggested AFFIX');
});

test('B-172: posOffset positions a single re-rendered row correctly', () => {
  // syncMorphemeRows rebuilds one row at a time; array index is always 0 there,
  // so the real position has to be passed in or every rebuilt row reads as a stem.
  const stem   = morphEditRowsHtml([{ form: 'metin' }], 'NOUN', 0);
  const suffix = morphEditRowsHtml([{ form: '(y)A' }], 'NOUN', 2);
  assert(ph(stem, 0) === 'NOUN',    'position 0 is the stem');
  assert(ph(suffix, 0) === 'AFFIX', 'position 2 is an affix, not a stem');
});

test('B-172: the chip row highlights nothing while the box is empty', () => {
  const html = morphEditRowsHtml([{ form: 'metin' }, { form: 'lAr' }], 'NOUN');
  const affixChip = /data-chip="AFFIX"[^>]*>/.exec(html);
  assert(affixChip, 'the AFFIX chip is drawn, so the suggestion can be accepted in one click');
  assert(!/class="[^"]*chip-on[^"]*"[^>]*data-chip="AFFIX"/.test(html)
      && !/data-chip="AFFIX"[^>]*class="[^"]*chip-on/.test(html),
         'but it is not shown as chosen — nothing has been chosen yet');
});



test('Row 0 ids: gloss/POS inputs + chip row aligned to index 0', () => {
  assert(html.includes('id="ew-mg-0"'), 'gloss input id 0');
  assert(html.includes('id="ew-mp-0"'), 'pos input id 0');
  assert(html.includes('id="ew-mp-0-chips"'), 'chip row id 0');
  assert(html.includes('data-chip-target="ew-mp-0"'), 'chips target input 0');
});

test('Row 1 ids: gloss/POS inputs + chip row aligned to index 1', () => {
  assert(html.includes('id="ew-mg-1"'), 'gloss input id 1');
  assert(html.includes('id="ew-mp-1"'), 'pos input id 1');
  assert(html.includes('id="ew-mp-1-chips"'), 'chip row id 1');
  assert(html.includes('data-chip-target="ew-mp-1"'), 'chips target input 1');
});

test('Current POS chip is marked active', () => {
  /* B-007: this asserted 'pos-chip pc-active', neither of which chipRowHtml has
     emitted since the chip unification.  It was the only assertion in this file
     touching real rendered output rather than the mock, so it was the only one
     that failed, and it was reported as a test defect for weeks while the real
     bug (12 JS selectors left on the old names) went unnoticed. */
  const chipTag = html.slice(html.indexOf('data-chip="NOUN"'));
  const openTag = html.slice(0, html.indexOf('data-chip="NOUN"')).lastIndexOf('<button');
  const tag = html.slice(openTag, html.indexOf('>', html.indexOf('data-chip="NOUN"')) + 1);
  assert(/class="chip chip-choice active"/.test(tag), 'NOUN chip carries chip-choice + active');
  assert(/data-action="pos-select"/.test(tag), 'and the action the handler keys off');
});

test('A non-current chip is NOT marked active', () => {
  const i = html.indexOf('data-chip="VERB"');
  const openTag = html.slice(0, i).lastIndexOf('<button');
  const tag = html.slice(openTag, html.indexOf('>', i) + 1);
  assert(!/\bactive\b/.test(tag), 'VERB chip is inactive when the value is NOUN');
});

test('B-087: each row addresses its own drawer', () => {
  // One flag for the screen meant opening the word's drawer opened all five on
  // a four-morpheme word. The ids and targets must differ per row.
  assert(html.includes('data-drawer-for="ew-mp-0"'), 'row 0 targets its own');
  assert(html.includes('data-drawer-for="ew-mp-1"'), 'row 1 targets its own');
  assert(html.includes('id="ew-mp-0-drawer"') && html.includes('id="ew-mp-1-drawer"'),
         'and the drawers themselves are separately addressable');
});

test('B-088: the morpheme POS field draws on the POS pool', () => {
  // It had no autocomplete source at all, which is what was reported.
  assert(/id="ew-mp-0"/.test(html), 'the field is there');
  const tag = html.slice(html.lastIndexOf('<input', html.indexOf('id="ew-mp-0"')),
                         html.indexOf('>', html.indexOf('id="ew-mp-0"')) + 1);
  assert(/data-ac-pool="pos"/.test(tag), 'and names the pool it draws from');
  assert(/\bac-input\b/.test(tag), 'and carries the class the listeners match');
});

test('Morph POS is narrowed by SCOPE, and the whole inventory is one click away', () => {
  // D45: POS_VISIBLE_MORPH is gone. A morpheme row shows morpheme-scope tags,
  // which is what that constant was doing by hand for one language.
  assert(html.includes('data-chip="AFFIX"'), 'AFFIX offered on a morpheme row');
  assert(!html.includes('data-chip="PHRASE"'), 'PHRASE is not — it spans words by definition');
  assert(html.includes('data-chip="NOUN"'), 'NOUN still is — a root morpheme can be a noun');
  assert(/data-action="tag-drawer"/.test(html), 'the drawer disclosure is present');
  assert(!/es-expand-btn/.test(html), 'and the unlabelled … expander is gone');
});

test('Form header carries provenance when present, empty otherwise', () => {
  assert(html.includes('Ann · 2026-06-13'), 'prov shown for row 0');
});

test('Reconcile re-stamps every id that derives from the row index', () => {
  const m = mockRowAtIndex0();
  _fixMorphRowIds(m.row, 2);
  assert(m.gloss.id === 'ew-mg-2', 'gloss id → 2');
  assert(m.posInp.id === 'ew-mp-2', 'pos input id → 2');
  assert(m.chipRow.id === 'ew-mp-2-chips', 'chip row id → 2');
  assert(m.chips.every(c => c.getAttribute('data-chip-target') === 'ew-mp-2'), 'chip targets → 2');
  /* The regression, twice over: an element whose id is built from the row index
     and is not re-stamped points at row 0 forever. It was the … expander; D45
     made it the drawer, and this guard caught that in the same session. */
  assert(m.drawer.id === 'ew-mp-2-drawer', 'drawer id → 2');
  assert(m.dBtn.getAttribute('data-drawer-for') === 'ew-mp-2', 'drawer button target → 2');
  /* B-093: the type field is a second set of exactly the same derived ids, and
     it must move independently of the POS one. */
  assert(m.type.inp.id === 'ew-mt-2', 'type input id → 2');
  assert(m.type.chipRow.id === 'ew-mt-2-chips', 'type chip row id → 2');
  assert(m.type.chips.every(c => c.getAttribute('data-chip-target') === 'ew-mt-2'),
         'type chip targets → 2');
  assert(m.type.drawer.id === 'ew-mt-2-drawer', 'type drawer id → 2');
  assert(m.type.dBtn.getAttribute('data-drawer-for') === 'ew-mt-2',
         'type drawer button target → 2');
  assert(m.chipRow.id === 'ew-mp-2-chips' && m.type.chipRow.id === 'ew-mt-2-chips',
         'the two fields keep separate chip rows, not one shared by accident');
});

/* ── Mock-fidelity guard (B-007) ────────────────────────────────────────────
   The reconcile test above can only be trusted if the mock answers to the same
   selectors the real markup carries.  When those drift apart the mock keeps
   passing while the product is broken, which is exactly what happened here for
   months.  Pin them together. */
test('Mock class names match what chipRowHtml actually emits', () => {
  const real = chipRowHtml('ew-mp-0', 'NOUN', global.POS_CHOICES, 'pos-select', 'upper',
                           global.POS_VISIBLE_MORPH);
  assert(real.includes(`class="${CHIP_ROW_CLASS}"`),
         `renderer emits .${CHIP_ROW_CLASS} (mock assumes it)`);
  assert(new RegExp(`class="${CHIP_CLASS} `).test(real),
         `renderer emits .${CHIP_CLASS} (mock assumes it)`);
  assert(real.includes('data-chip-target="ew-mp-0"'), 'renderer emits data-chip-target');
});

test('_fixMorphRowIds selectors match the emitted markup', () => {
  /* The guard that would have caught B-007 outright: the function must query
     the classes the renderer produces, not historical ones. */
  const src = sliceFn('_fixMorphRowIds');
  for (const sel of src.match(/querySelector(?:All)?\('\.([\w-]+)'\)/g) || []) {
    const cls = /'\.([\w-]+)'/.exec(sel)[1];
    const emittedByChips  = chipRowHtml('x', '', ['NOUN'], 'pos-select', 'upper').includes(cls);
    const emittedByRows   = html.includes(cls);
    assert(emittedByChips || emittedByRows, `_fixMorphRowIds queries .${cls}, which nothing emits`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
/* ── B-187: the word-gloss field shows the word's gloss ────────────────────
   Since B-176/B-186 a value equal to the morpheme join is not stored, and for a
   monomorphemic word that is the ordinary case — so an editor reading the stored
   `gloss` key draws an EMPTY box over a word that has one. The annotator is shown
   nothing to clear, clears nothing, and the gloss stands.

   READ, not executed, and it says so: this holds the STRUCTURE (the field is
   filled from the reader) which is what makes the behaviour possible. What the
   annotator actually sees is `gui_crud_test.js` C2a/C2b, in a browser. A shape is
   not a behaviour — B-183 cost two versions to learn that. */
{
  const { read: _rd, decomment, fnSrc: _fs } = require('./_source.js');
  const read = _rd, fnSrc = _fs;
  const ed = decomment(fnSrc('LingCoT.html', 'renderWordEdit') || '');
  check(ed !== '', 'the word editor is in the source');
  check(/const _ewGlossNow = wordGloss\(word\)/.test(ed),
        'the word-gloss field is filled from wordGloss(), not from the stored key',
        '       the stored key is empty for every word whose gloss equals the\n'
      + '       morpheme join, which is most of them');
  const inp = (ed.match(/id="ew-gloss"[^>]*>/) || [''])[0];
  check(/value="\$\{esc\(_ewGlossNow\)\}/.test(inp) && /data-original="\$\{esc\(_ewGlossNow\)\}/.test(inp),
        'and so is data-original, so change detection compares against what was shown',
        `       ${inp.slice(0, 120)}`);

  /* The mirror's attach test and its own documented rule had drifted apart: the
     comment said "as long as both hold the same text", the code said "both are
     empty" — the only reachable case while the gloss was always stored. */
  const ev = decomment(read(path.join('modules', 'events.js')));
  check(/const _agree = _ewGloss\.value === _ewMg0\.value;/.test(ev),
        'the word↔morpheme mirror attaches when the two agree',
        '       `both empty` is a special case of agreeing and was the only one\n'
      + '       that could happen; reopening a glossed word met neither');
  check(/let _lastSync = _ewGloss\.value;/.test(ev),
        'and starts from the value they agree on, not from empty');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
