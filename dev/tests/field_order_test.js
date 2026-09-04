/**
 * field_order_test.js, the order an editor asks its fields in
 *
 * D46 proposed comparing the DOM order of each editor against the order the
 * work can actually be done in, and said pass 1 was scriptable rather than
 * eyeballed. This is that pass, for the word editor, run as a guard.
 *
 * The order was decided at v3.14.408 (D46 appendix) and built at v3.14.409.
 * Two properties are checked, and they are different in kind:
 *   - the SEQUENCE, which is the decision and can only be re-decided;
 *   - the DEPENDENCIES, which are facts about the code — the lemma is read
 *     off the stem, the morpheme rows are built from the parse — and hold
 *     whatever anyone decides.
 * A sequence that violates a dependency is a bug in the decision. Both are
 * asserted so that changing one without the other fails here.
 *
 * Run:  node dev/tests/field_order_test.js   (exit 0 = pass)
 */

const fs   = require('fs');
const path = require('path');

const HTML = fs.readFileSync(
  path.join(__dirname, '..', '..', 'source', 'LingCoT.html'), 'utf8');

let pass = 0, fail = 0;
function check(cond, label, detail) {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label); if (detail) console.log(detail); }
}

/* Slice renderWordEdit's template rather than the whole file: `edit-group`
   appears in other editors, and a guard that matched them all would report the
   wrong view's order and be impossible to read. */
function sliceFn(name) {
  const start = HTML.indexOf('function ' + name);
  if (start < 0) throw new Error('cannot slice ' + name);
  let p = HTML.indexOf('(', start), pd = 0, q = p;
  for (; q < HTML.length; q++) {
    if (HTML[q] === '(') pd++;
    else if (HTML[q] === ')') { pd--; if (pd === 0) { q++; break; } }
  }
  let i = HTML.indexOf('{', q), depth = 0;
  for (; i < HTML.length; i++) {
    if (HTML[i] === '{') depth++;
    else if (HTML[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return HTML.slice(start, i);
}

const SRC = sliceFn('renderWordEdit');

/* One field is identified by the prov key it declares, one by the editor it
   calls, one by its label key. Reading whichever the markup actually carries is
   the point: a field renamed on one axis still reports under the others. */
const MARKERS = [
  ['transliteration', /renderTransliterationsEditor\('ew-translit'/],
  ['part_of_speech',  /provTipAttr\(word, 'part_of_speech'\)/],
  ['gloss',           /provTipAttr\(word, 'gloss'\)/],
  ['parse',           /provTipAttr\(word, 'morphological_parse'\)/],
  ['morpheme_rows',   /label\.editor\.morpheme_glosses/],
  ['lemma',           /provTipAttr\(word, 'lemma_id'\)/],
  ['comments',        /provTipAttr\(word, 'comments'\)/],
  ['push_dict',       /ew-pushdict-group/],
];

console.log('\nthe word editor asks in the decided order\n');

const found = MARKERS
  .map(([name, re]) => [name, SRC.search(re)])
  .filter(([, at]) => at >= 0);

check(found.length === MARKERS.length,
      `all ${MARKERS.length} fields located in renderWordEdit`,
      '         missing: ' + MARKERS.map(m => m[0])
        .filter(n => !found.some(f => f[0] === n)).join(', ')
      + '\n         a marker that stops matching makes every order check below vacuous');

const order = found.sort((a, b) => a[1] - b[1]).map(([n]) => n);

/* D46 appendix, v3.14.408. */
const DECIDED = ['transliteration', 'part_of_speech', 'gloss', 'parse',
                 'morpheme_rows', 'lemma', 'comments', 'push_dict'];

check(order.join(' > ') === DECIDED.join(' > '),
      'the sequence is the decided one',
      '         decided: ' + DECIDED.join(' > ')
    + '\n         actual:  ' + order.join(' > ')
    + '\n         the decision is in dev/design/D46_pipeline_ux.md, appended v3.14.408.'
    + '\n         Changing the order here without changing it there leaves two writers.');

console.log('\nand no field is asked before what it is read from\n');

/* Facts about the code, not about the decision. Each pair is [field, what it
   needs first], and each is checked against the source below so that a
   dependency which stops being true fails here rather than silently constraining
   an order for a reason that has gone. */
const DEPENDS = [
  ['morpheme_rows', 'parse',         /ensureMorphemesFromParse|syncMorphemeRows/],
  ['lemma',         'morpheme_rows', /_resolveOrCreateLemma|lemmaStripHtml/],
];

for (const [field, needs, evidence] of DEPENDS) {
  check(evidence.test(HTML), `${field} really is derived from ${needs} (mechanism present)`,
        '         the dependency is asserted from the code, not from this list');
  check(order.indexOf(field) > order.indexOf(needs),
        `${field} is asked after ${needs}`,
        `         ${needs} is at ${order.indexOf(needs)}, ${field} at ${order.indexOf(field)}`
      + '\n         a field cannot be answered before the thing it is read off');
}

/* The gloss is the one field deliberately asked BEFORE the thing that can
   derive it, and the reason is that being asked first is what stops it holding
   a derivation. B-187 and B-191 are four attempts at the other arrangement. */
check(order.indexOf('gloss') < order.indexOf('parse'),
      'the word gloss is asked before the parse, on purpose',
      '         D46 measured the annotator answering it last and the appendix'
    + '\n         diverges deliberately: asked after the parse the field arrives'
    + '\n         pre-filled with the app\'s join, which is B-187 and B-191.');

console.log('\nthe two word-level Gloss labels follow the editor\n');

/* label.editor.word_gloss at word level, label.editor.gloss at morpheme and
   entry level. The IGT legend and the dependency table are the two word-level
   sites; the rest are scoped in the D46 appendix and stay as they are. */
const legend = HTML.match(/legend-gloss[\s\S]{0,200}?\$\{t\('(label\.editor\.[a-z_]+)'\)\}/);
check(legend && legend[1] === 'label.editor.word_gloss',
      'the IGT legend swatch says Word Gloss',
      '         found: ' + (legend ? legend[1] : 'no match')
    + '\n         the IGT gloss line is the word gloss; the morpheme line names itself');

const depHdr = HTML.match(
  /<th>\$\{t\('label\.editor\.form'\)\}<\/th>\s*<th>\$\{t\('(label\.editor\.[a-z_]+)'\)\}<\/th>/);
check(depHdr && depHdr[1] === 'label.editor.word_gloss',
      'the dependency table column says Word Gloss',
      '         found: ' + (depHdr ? depHdr[1] : 'no match')
    + '\n         one row per word, so the column is the word gloss');

/* The other direction: the morpheme row must NOT have been renamed with them.
   A blanket replace of label.editor.gloss would pass both checks above and be
   wrong at three levels. */
const morphRow = HTML.match(/es-lbl">\$\{t\('(label\.editor\.[a-z_]+)'\)\}<\/span>\s*<div \$\{provTipAttr\(m, 'gloss'\)\}/);
check(morphRow && morphRow[1] === 'label.editor.gloss',
      'the morpheme row still says Gloss',
      '         found: ' + (morphRow ? morphRow[1] : 'no match')
    + '\n         morpheme level. Renaming this one would claim a word gloss'
    + '\n         sits on a morpheme, which is the distinction D60 exists for');

const LOCALE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '..', 'source', 'resources', 'locale', 'en.json'), 'utf8'));
check(LOCALE['label.editor.word_gloss'] && LOCALE['label.editor.gloss']
      && LOCALE['label.editor.word_gloss'] !== LOCALE['label.editor.gloss'],
      'the two keys exist and read differently',
      '         one key doing both jobs is what the rename was for');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
