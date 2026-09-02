#!/usr/bin/env node
/* =============================================================================
   form_render_test.js, create and edit render the same fields
   Run:  node dev/tests/form_render_test.js
   =============================================================================
   D48 stage B. §16 measured the drift between every add form and its editor and
   found it always ran the same way: the add form is written first as the
   minimum needed to bring an object into existence, and later fields are only
   ever added to the editor. B-091, B-092 and B-094 are three instances.

   The claim this guard has to make good is that the drift is now impossible
   rather than merely repaired. So it does not compare two templates. It RENDERS
   both modes and diffs the field ids, which is the only evidence that means
   anything: two lists built from one table, proven equal by construction.

   It also pins the other half of option (c) — that renderField and readForm
   agree about which controls exist. A control one draws and the other cannot
   read is a field that silently fails to save, which is worse than the drift
   this replaces.
   ============================================================================= */

const vm = require('vm');
const { read, fnSrc, decomment, locale } = require('./_source.js');
const F = require('../../source/modules/field_spec.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read('LingCoT.html');
const LOC  = locale();

/* ── 1. every level the renderer draws is fully declared ─────────────────── */
const FORM_LEVELS = JSON.parse(
  (/const FORM_LEVELS = (\[[^\]]*\])/.exec(decomment(html)) || [])[1].replace(/'/g, '"')
);
check(FORM_LEVELS.length > 0, `FORM_LEVELS names ${FORM_LEVELS.length} generated level(s): ${FORM_LEVELS}`);

const drawn = (fnSrc('LingCoT.html', 'renderField').match(/case '(\w+)':/g) || [])
  .map(m => /'(\w+)'/.exec(m)[1]);
const readable = (fnSrc('LingCoT.html', 'readForm').match(/case '(\w+)':/g) || [])
  .map(m => /'(\w+)'/.exec(m)[1]);

for (const level of FORM_LEVELS) {
  for (const f of F.fieldsOf(level).filter(F.isFillable)) {
    check(drawn.includes(f.control),
          `${level}.${f.key}: renderField implements '${f.control}'`,
          'an unimplemented control renders nothing, which is a field nobody can fill');
    check(readable.includes(f.control),
          `${level}.${f.key}: readForm can read '${f.control}'`,
          'a control that is drawn but not read is a field that silently fails to save');
    check(!!f.label && LOC[f.label] !== undefined,
          `${level}.${f.key}: declares a label key that exists (${f.label})`,
          't() returns the key itself on a miss, so the annotator would read the key');
    if (f.placeholder)
      check(LOC[f.placeholder] !== undefined,
            `${level}.${f.key}: its placeholder key exists too (${f.placeholder})`);
  }
}

/* ── 2. THE ONE THAT MATTERS: render both modes, diff the fields ─────────── */
{
  const ctx = {
    t:        k => `T(${k})`,
    esc:      s => String(s == null ? '' : s),
    escAttr:  s => String(s == null ? '' : s),
    LING_ATTRS: 'autocapitalize="none"',
    annotatorBar: () => '<div class="edit-annotator-bar"></div>',
    provTipAttr:  () => '',
    requiredMark: () => '<span class="required">*</span>',
    renderSourcePicker:         (id, v) => `<div class="src-picker" id="${id}" data-n="${v.length}"></div>`,
    renderTranslationsEditor:   (id, v) => `<div class="tr-ed" id="${id}" data-n="${v.length}"></div>`,
    renderTransliterationsEditor:(id, v) => `<div class="tl-ed" id="${id}" data-n="${v.length}"></div>`,
    renderCommentsEditor:       (id, v) => `<div class="cm-ed" id="${id}" data-n="${v.length}"></div>`,
    fieldId: F.fieldId, isFillable: F.isFillable, fieldsOf: F.fieldsOf,
    /* D48 stage C. The emptiness test is the REAL one, not a stub: the marking
       and the save gate have to agree on what empty means, and a stub here
       would let them diverge without the guard noticing. */
    isEmptyValue: F.isEmptyValue,
    LEVEL_EXTRA_LABEL: F.LEVEL_EXTRA_LABEL,
    POS_CHOICES: ['NOUN', 'VERB', 'AFFIX'], TYPE_CHOICES: ['word', 'bound.morpheme'],
    chipRowHtml: (id) => `<div class="chip-row" id="${id}-chips"></div>`,
    lemmaStripHtml: () => '<div class="offer-strip"></div>',
    lemmaFormOf: id => (id ? 'citation' : ''),
    quickLemmaPanelHtml: (id) => `<div class="ql-panel" id="${id}-ql-panel"></div>`,
    LING_ATTRS_UPPER: 'autocapitalize="characters"',
    console,
  };
  vm.createContext(ctx);
  for (const fn of ['wantedMark', 'renderField', 'formBodyHtml'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  const allIdsIn = h => [...h.matchAll(/id="(f-[\w.-]+)"/g)].map(m => m[1]).sort();
  /* A control may emit SUB-ids off its own: the chip row, the lemma strip, the
     quick-create panel. They all derive from the field id, so they belong to
     the field rather than being fields. The field diff compares exact ids; the
     sub-ids get their own check below, so a stray one cannot hide among them. */
  const idsIn = (h, level) => {
    const own = new Set(F.fieldsOf(level).filter(F.isFillable).map(f => F.fieldId(level, f.key)));
    return allIdsIn(h).filter(i => own.has(i)).sort();
  };

  for (const level of FORM_LEVELS) {
    /* A stand-in object carrying a value for every fillable field, so the edit
       render exercises the same controls the create render does. */
    const obj = { title: 'x', text: 'x', language: 'tur', words: [{ form: 'a' }] };
    for (const f of F.fieldsOf(level).filter(F.isFillable))
      if (obj[f.key] === undefined) obj[f.key] = [];
    const slots = { rollup: '<div class="rollup"></div>', ingest: '<div class="ingest"></div>' };
    const create = ctx.formBodyHtml(level, null, { ingest: slots.ingest });
    const edit   = ctx.formBodyHtml(level, obj, slots);
    const a = idsIn(create, level), b = idsIn(edit, level);
    check(a.length > 0, `${level}: the create form renders ${a.length} field(s)`);
    check(JSON.stringify(a) === JSON.stringify(b),
          `${level}: create and edit render the SAME fields`,
          `create: ${a.join(', ')}\n       edit:   ${b.join(', ')}`);

    const expected = F.fieldsOf(level).filter(F.isFillable).map(f => F.fieldId(level, f.key)).sort();
    check(JSON.stringify(a) === JSON.stringify(expected),
          `${level}: and exactly the fields the table declares`,
          `rendered: ${a.join(', ')}\n       table:    ${expected.join(', ')}`);

    /* The rollup is the one part that is genuinely edit-only: a new object has
       no annotators to roll up. Everything else must be in both. */
    /* Every generated id must belong to a declared field, exactly or as a
       suffix of one. An id belonging to nothing is a control inventing a name
       that readForm will never look for. */
    const own = F.fieldsOf(level).filter(F.isFillable).map(f => F.fieldId(level, f.key));
    const orphan = allIdsIn(edit).filter(i => !own.some(o => i === o || i.startsWith(o + '-')));
    check(orphan.length === 0,
          `${level}: every generated id belongs to a declared field`,
          `orphaned: ${orphan.join(', ')}`);

    check(!create.includes('class="rollup"') && edit.includes('class="rollup"'),
          `${level}: the annotator rollup is edit-only, and it is the only such part`);
    check(create.includes('edit-annotator-bar') && edit.includes('edit-annotator-bar'),
          `${level}: both modes carry the annotator bar`,
          'section-add had no annotator bar while paragraph-add and sentence-add did');
  }
}

/* ── 3. no handler names a generated id by hand ──────────────────────────── */
{
  const src = decomment(html) + decomment(read('modules/events.js'));
  const offenders = [];
  for (const level of FORM_LEVELS)
    for (const f of F.fieldsOf(level).filter(F.isFillable)) {
      const id = F.fieldId(level, f.key);
      if (new RegExp(`getElementById\\(['"]${id}['"]\\)`).test(src)) offenders.push(id);
    }
  check(offenders.length === 0,
        'nothing reads a generated field id directly',
        `${offenders.join(', ')} — readForm() is the only reader, which is what keeps the pair honest`);

  /* The retired ids must be gone from code, or two conventions are live at once. */
  for (const dead of ['se-title', 'se-sources', 'se-paras', 'sna-title', 'sna-text',
                      'pa-text', 'pa-trans', 'ep-sents', 'ep-translations', 'ep-translit',
                      'ep-comments', 'sa-text', 'sa-translations', 'sa-translit', 'sa-words',
                      'es-text', 'es-translations', 'es-translit', 'es-comments', 'es-words',
                      'cn-title', 'cn-language', 'cn-source-ids', 'cn-comments',
                      'de-title', 'de-language', 'de-sources', 'de-comments'])
    check(!new RegExp(`getElementById\\(['"]${dead}['"]\\)|id="${dead}"`).test(src),
          `the hand-picked id ${dead} is gone`);
}

/* ── 4. sharing ids between modes must not share BEHAVIOUR ────────────────
   The add and edit views now use one pair of ids, which is the point. It also
   means an `if (element exists)` listener attaches in both. The live
   text→tokenization sync is safe only while creating: in edit it would rewrite
   an existing sentence's tokenization as the text was typed, discarding word
   objects that may carry a full analysis. */
{
  const ev = decomment(read('modules/events.js'));
  const i  = ev.indexOf("fieldId('sentence', 'text')");
  check(i !== -1, 'the sentence-add sync reaches its field through the table');
  const around = ev.slice(Math.max(0, i - 400), i + 400);
  check(/S\.view === 'sentence-add'/.test(around),
        'and is gated on the view, not on the element existing',
        'shared ids mean presence no longer distinguishes create from edit');
}

/* ── 5. the dict-add prefill is gone, producer and consumer both ───────────
   B-050 and B-060: `renderDictAdd` seeded itself from `S.dictNewEntry`, which
   events.js built from the "+ dict" chip's data attributes. Three times the
   reader named keys the producer never wrote, and a prefill that always resolves
   to '' reads as a working feature to whoever extends the flow. The v3.14.201
   rewrite carried the defect forward under a new name, which is why this was a
   guard and not a fix.

   v3.14.270 removed the contract instead. "+ dict" opens the add-to-dictionary
   panel with a row built by `candidateRows`, so the defaults are stated once, in
   `_wordSeeds`, and there is no second place for them to drift from.

   The guard is kept and inverted, because a half-removal is the same defect: a
   producer with no consumer sends values nowhere, and a consumer with no
   producer reads ''. Neither may exist. */
{
  const ev   = decomment(read('modules/events.js'));
  const html2 = decomment(read('LingCoT.html'));
  check(!/dictNewEntry/.test(ev) && !/dictNewEntry/.test(html2),
        'no producer and no consumer of the retired prefill',
        'a half-wired contract is exactly what B-050 filed');
  check(!/data-add-(form|gloss|translit|type|pos|constituent)/.test(html2),
        'and the chip attributes it was built from are gone too',
        'attributes nothing reads are a contract that looks live');

  /* What replaced it: one row, from the model, carrying the link. */
  const morph = fnSrc('LingCoT.html', 'addDictForMorpheme') || '';
  check(/candidateRows\(\{ word: r\.word \}\)/.test(morph),
        '"+ dict" builds its row from the model');
  check(/find\(x => x\.link === m\)/.test(morph),
        'and takes the one for the morpheme that was clicked',
        'the whole word is a different question than the one the annotator asked');
  /* v3.14.331, D57/B-163: `.filter()` was the spelling, and the row it selected
     was the one B-111's merge had hidden — so on a monomorphemic word the panel
     was handed a row it would not draw and `+ dict` did nothing at all. The
     morpheme is still what is asked for; a merged answer hands off to the row it
     was merged into, which the merge itself declares is the same lexeme. */
  check(/mergedInto !== undefined/.test(morph),
        'and a merged row hands off rather than being dropped (B-163)',
        'hiding the only row asked for is how five correct lines composed into a no-op');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
