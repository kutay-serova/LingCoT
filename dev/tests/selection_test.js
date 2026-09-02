#!/usr/bin/env node
/* =============================================================================
   selection_test.js. D27 P1 selection frame logic
   Run:  node dev/tests/selection_test.js
   =============================================================================
   Covers the DOM-free half: derived labels, canonical serialisation for change
   detection, harvesting, and the shared autocomplete's filter/sort.  The row
   editors themselves need a DOM and are covered by boot_smoke_test.js loading
   plus manual use.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const PARTS = fs.readFileSync(path.join(SRC, 'modules', 'participants.js'), 'utf8');
const HTML  = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');

function extract(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`extract: ${name} not found`);
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`extract: unbalanced braces in ${name}`);
}

const { selDeriveLabel, selCanonical } = new Function(
  extract(PARTS, 'selDeriveLabel') + '\n' + extract(PARTS, 'selCanonical') +
  '\nreturn { selDeriveLabel, selCanonical };')();

const { _indexSelectionLabels } = new Function('S',
  extract(HTML, '_indexSelectionLabels') + '\nreturn { _indexSelectionLabels };');

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

const F = (...selects) => ({ selects });
const S_ = (category, relation, status) => ({ category, relation, status });

console.log('\nselDeriveLabel');
eq(selDeriveLabel(F(S_('NOUN', 'subject', 'obligatory'), S_('CLAUSE', 'complement', 'obligatory'))),
   'noun subject + clause complement', 'verb with clausal complement');
eq(selDeriveLabel(F(S_('NOUN', 'modification', 'obligatory'))),
   'noun modification', 'adjective modifying a noun');
eq(selDeriveLabel(F(S_('NOUN', '', ''))), 'noun', 'category alone when no relation');
eq(selDeriveLabel(F()), '', 'empty frame derives nothing');
eq(selDeriveLabel(null), '', 'null frame is safe');
eq(selDeriveLabel(F(S_('', 'subject', ''), S_('NOUN', 'subject', ''))),
   'noun subject', 'selects with no category are skipped');

console.log('\nselCanonical — change detection');
{
  // The reason this exists: a frame loaded from JSONL has whatever key order the
  // file had, while readSelectionEditor builds its own.  Both must serialise
  // identically or every save would re-stamp provenance on an untouched entry.
  const fromFile   = [{ notes: '', selects: [{ status: 'obligatory', relation: 'subject', category: 'NOUN' }], label: '' }];
  const fromEditor = [{ selects: [{ category: 'NOUN', relation: 'subject', status: 'obligatory' }] }];
  eq(selCanonical(fromFile), selCanonical(fromEditor), 'key order does not affect the canonical form');
  eq(selCanonical(fromFile) === '', false, 'canonical form of a real frame is non-empty');
}
eq(selCanonical([]), '', 'no frames → empty string');
eq(selCanonical(null), '', 'null → empty string');
eq(selCanonical([{ selects: [] }]), '', 'frame with no selects is dropped');
eq(selCanonical([{ selects: [{ category: '' }] }]), '', 'select with no category is dropped');
{
  const a = selCanonical([F(S_('NOUN', 'subject', 'obligatory'))]);
  const b = selCanonical([F(S_('NOUN', 'subject', 'optional'))]);
  eq(a === b, false, 'a status change is detected');
}
{
  // Frame ORDER is meaningful, reordering alternatives is a real edit.
  const a = selCanonical([F(S_('NOUN', 'subject', '')), F(S_('CLAUSE', 'complement', ''))]);
  const b = selCanonical([F(S_('CLAUSE', 'complement', '')), F(S_('NOUN', 'subject', ''))]);
  eq(a === b, false, 'frame order is significant');
}

console.log('\n_indexSelectionLabels — harvested vocabularies');
{
  const S = { selectionCategories: new Set(), selectionRelations: new Set() };
  const { _indexSelectionLabels } = new Function('S',
    extract(HTML, '_indexSelectionLabels') + '\nreturn { _indexSelectionLabels };')(S);
  _indexSelectionLabels({ selection: [F(S_('NOUN', 'subject', ''), S_('SERIAL', 'co-verb', ''))] });
  eq([...S.selectionCategories].sort(), ['NOUN', 'SERIAL'], 'custom category harvested');
  eq([...S.selectionRelations].sort(), ['co-verb', 'subject'], 'custom relation harvested');
  _indexSelectionLabels({});
  eq(S.selectionCategories.size, 2, 'entry with no selection changes nothing');
  _indexSelectionLabels({ selection: [F(S_('NOUN', 'subject', ''))] });
  eq(S.selectionCategories.size, 2, 'repeat values do not duplicate');
}

console.log('\nresource files');
{
  const rels = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'selection_relations.json'), 'utf8'));
  const tags = rels.map(r => r.tag);
  eq(tags.includes('modification'), true, 'modification relation present');
  eq(tags.includes('modifier'), false, 'modifier absent — it points the wrong way');
  eq(new Set(tags).size, tags.length, 'relation tags are unique');
  eq(rels.every(r => r.tag && r.description), true, 'every relation has a description');

  /* D27 P3, the functional relations. The original nine were all argument or
     property relations, so a determiner had to be filed as `modification`, which
     is wrong: `the` adds no property to `dog`, it fixes reference. */
  for (const tag of ['determination', 'quantification', 'case marking', 'linking'])
    eq(tags.includes(tag), true, `functional relation '${tag}' present`);

  /* The DET template must NOT point at modification any more, that pairing is
     the exact confusion D27 P3 removed. */
  const tplsForDet = JSON.parse(fs.readFileSync(
    path.join(SRC, 'resources', 'selection_templates.json'), 'utf8')).filter(t => t.pos === 'DET');
  eq(tplsForDet.length > 0, true, 'DET has at least one template');
  eq(tplsForDet.every(t => t.selects.every(s => s.relation !== 'modification')), true,
     'no DET template files a determiner as modification');

  /* Every relation a template names must exist in the relation vocabulary, a typo there would silently seed frames with an unknown relation. */
  const allTplRels = JSON.parse(fs.readFileSync(
    path.join(SRC, 'resources', 'selection_templates.json'), 'utf8'))
    .flatMap(t => t.selects.map(s => s.relation)).filter(Boolean);
  const unknownRels = [...new Set(allTplRels)].filter(r => !tags.includes(r));
  eq(unknownRels.length, 0, `every template relation is in the vocabulary${unknownRels.length ? ' — unknown: ' + unknownRels.join(', ') : ''}`);

  const tpls = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'selection_templates.json'), 'utf8'));
  eq(tpls.every(t => t.pos && t.label && Array.isArray(t.selects) && t.selects.length), true,
     'every template has pos, label and at least one select');
  eq(tpls.every(t => t.selects.every(s => s.category)), true,
     'every template select has a category');
  const verbLabels = tpls.filter(t => t.pos === 'VERB').map(t => t.label);
  eq(verbLabels.includes('transitive') && verbLabels.includes('intransitive'), true,
     'verb base cases covered');
  eq(tpls.some(t => t.pos === 'ADJ') && tpls.some(t => t.pos === 'ADV') && tpls.some(t => t.pos === 'NOUN'), true,
     'non-verb categories covered — selection is not verb-only');
}

console.log('\nrenderer ↔ reader contract');
{
  /* readSelectionEditor finds fields by class name.  If the renderer ever emits
     a different class the reader silently returns nothing and the user's work
     vanishes on save, no error anywhere.  This pins the two together. */
  const stub = {
    t: k => k, esc: s => String(s ?? ''), escAttr: s => String(s ?? ''),
    icon: () => '<svg></svg>',
    /* v3.14.125 (B-032): selection rows now take their input attributes from the
       shared constants, so the sliced builder needs them in scope. */
    LING_ATTRS:       'autocapitalize="none" autocorrect="off" spellcheck="false"',
    LING_ATTRS_UPPER: 'autocapitalize="characters" autocorrect="off" spellcheck="false"',
    SELECTION_STATUSES: ['obligatory', 'optional'],
    SELECTION_TEMPLATES: [{ pos: 'VERB', label: 'transitive', selects: [{ category: 'NOUN' }] }],
    // D27 P3: the template chip label now resolves through selTplLabel(), which
    // lives in LingCoT.html. Stubbed to the identity so this file keeps testing
    // the renderer↔reader contract rather than the locale lookup, that is
    // dev/tests/locale_key_test.js's job.
    selTplLabel: tpl => tpl.label,
    selDeriveLabel, selCanonical,
  };
  const fn = new Function(...Object.keys(stub),
    extract(PARTS, '_selRowHtml') + '\n' + extract(PARTS, '_selFrameHtml') + '\n' +
    extract(PARTS, '_selTemplatesHtml') + '\n' + extract(PARTS, 'renderSelectionEditor') + '\n' +
    'return { _selRowHtml, _selFrameHtml, renderSelectionEditor };');
  const { _selRowHtml, renderSelectionEditor } = fn(...Object.values(stub));

  const reader = extract(PARTS, 'readSelectionEditor');
  const rowHtml = _selRowHtml(S_('NOUN', 'subject', 'obligatory'));

  for (const cls of ['sel-cat', 'sel-rel', 'sel-status', 'sel-row']) {
    eq(rowHtml.includes(cls), true, `row renders .${cls}`);
    eq(reader.includes(cls), true, `reader queries .${cls}`);
  }
  for (const cls of ['sel-frame', 'sel-label', 'sel-notes']) {
    const full = renderSelectionEditor('ed-selection', [F(S_('NOUN', 'subject', ''))], 'VERB');
    eq(full.includes(cls), true, `editor renders .${cls}`);
    eq(reader.includes(cls), true, `reader queries .${cls}`);
  }
  const full = renderSelectionEditor('ed-selection', [F(S_('NOUN', 'subject', ''))], 'VERB');
  eq(full.includes('id="ed-selection-frames"'), true,
     'frames container id matches what the reader and handlers look up');
  eq(full.includes('data-ac-pool="category"') && full.includes('data-ac-pool="relation"'), true,
     'both term fields declare an autocomplete pool');
  eq(full.includes('ac-input'), true, 'term fields carry the AC_SELECTOR class');
  eq(rowHtml.includes('selected'), true, 'existing status round-trips as the selected option');
  // A frame rendered with no selects must still show one blank row to type into.
  eq(_selRowHtml(null).includes('sel-row'), true, 'blank row renders');
}

console.log('\nrenderSelectionView (D27 P2)');
{
  const stub = { esc: s => String(s ?? ''), t: k => k.split('.').pop() };
  const { renderSelectionView } = new Function(...Object.keys(stub),
    extract(PARTS, 'renderSelectionView') + '\nreturn { renderSelectionView };')(...Object.values(stub));

  const labelled = [
    { label: 'clausal complement', selects: [S_('NOUN', 'subject', 'obligatory'), S_('CLAUSE', 'complement', 'obligatory')] },
    { label: 'transitive', notes: 'Object droppable.', selects: [S_('NOUN', 'subject', 'obligatory'), S_('NOUN', 'direct object', 'optional')] },
  ];
  const h = renderSelectionView(labelled);

  eq((h.match(/<table/g) || []).length, 1, 'one table for the whole entry, not one per frame');
  eq(h.includes('rowspan="2"'), true, 'label spans its frame rows');
  eq(h.includes('rowspan="3"'), true, 'label rowspan grows by one when the frame has a note');
  eq((h.match(/dsel-boundary/g) || []).length, 1, 'boundary rule on every frame after the first');
  eq(h.includes('colspan="2"'), true, 'note spans category + relation only, not the label column');
  eq(h.includes('dsel-nolabel'), false, 'label column kept when a frame is labelled');

  // Status: only `optional` is tagged.
  eq((h.match(/dsel-tag/g) || []).length, 1, 'exactly one status tag — obligatory is silent');
  eq(h.includes('>optional<'), true, 'the tagged one is the optional select');

  // No derived label leaks into the view, the rows are visible beside it.
  eq(h.includes('noun subject'), false, 'no derived summary in the label cell');

  // Adaptive: unlabelled frames drop the column entirely.
  const unlabelled = [{ selects: [S_('NOUN', 'subject', '')] }, { selects: [S_('CLAUSE', 'complement', '')] }];
  const h2 = renderSelectionView(unlabelled);
  eq(h2.includes('dsel-nolabel'), true, 'no labels anywhere → column dropped');
  eq(h2.includes('dsel-label'), false, 'no label cells rendered at all');
  eq((h2.match(/dsel-boundary/g) || []).length, 1, 'boundary still marks the frame split');

  // Mixed: one labelled frame is enough to keep the column.
  const mixed = [{ label: 'transitive', selects: [S_('NOUN', 'subject', '')] }, { selects: [S_('CLAUSE', 'complement', '')] }];
  const h3 = renderSelectionView(mixed);
  eq(h3.includes('dsel-nolabel'), false, 'one labelled frame keeps the column');
  eq((h3.match(/dsel-label/g) || []).length, 2, 'unlabelled frame still gets an empty label cell');

  // Empty / malformed input must render nothing rather than an empty table.
  eq(renderSelectionView([]), '', 'no frames → no markup');
  eq(renderSelectionView(null), '', 'null → no markup');
  eq(renderSelectionView([{ selects: [] }]), '', 'frame with no selects → no markup');
  eq(renderSelectionView([{ selects: [{ category: '' }] }]), '', 'selects with no category → no markup');

  // A single-row frame is the common non-verb case.
  const adj = renderSelectionView([{ label: 'attributive', selects: [S_('NOUN', 'modification', '')] }]);
  eq((adj.match(/<tr/g) || []).length, 1, 'adjective with one selection is a single row');
  eq(adj.includes('rowspan="1"'), true, 'rowspan is 1, not omitted');
}

console.log('\nCLAUSE must not leak into the PoS pool');
{
  const posTags = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'pos_tags.json'), 'utf8'))
    .map(d => d.tag);
  eq(posTags.includes('CLAUSE'), false,
     'pos_tags.json has no CLAUSE — it would appear in all seven PoS pickers');
  eq(/push\(\s*['"]CLAUSE['"]\s*,/.test(HTML), true,
     'CLAUSE is composed into the category pool at the point of use');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
