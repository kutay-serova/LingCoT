#!/usr/bin/env node
/* =============================================================================
   surface_conformance_test.js, every hand-written surface answers to the table
   Run:  node dev/tests/surface_conformance_test.js
   =============================================================================
   Was modal_conformance_test.js. Renamed and widened at v3.14.262, because the
   two identity modals turned out not to be the only surface the table could not
   see. The settability survey found five fields that were declared and not
   settable, and they fell into exactly two shapes:

     · a level whose surface is HAND-WRITTEN has nothing binding it to the
       table. Generated levels cannot have this gap (form_render_test renders
       both modes and diffs the ids against the table) and the modals could not
       (this file). Word and morpheme could, and did: word.comments,
       morpheme.comments and morpheme.transliterations were declared and drawn
       nowhere.
     · a field can be drawn, read, validated and stamped and still never
       stored, because the ASSIGNMENT was the one half of the operation each
       save handler spelled out by hand. B-117 and B-118.

   So this holds every hand-written surface to the table, and §6 holds the
   writer to it as well.
   =============================================================================
   D48 stage B5, and deliberately NOT a conversion.

   The annotator and source modals are the two surfaces that never drifted: one
   modal has always served both create and edit, so there was never a second
   field list to disagree with (audit section 14). Regenerating 104 lines of
   working markup to prove a point about consistency would have risked two
   surfaces to prevent a failure they are built not to have.

   What they ARE exposed to is the other direction, and it is the one that
   matters now. Their fields live in static markup, so `field_spec_test.js`
   cannot see them — and a field added to a modal without being added to the
   table is invisible to everything the table feeds: the missing-annotation
   counter, the empty-field marking, the audit. That is B-093 and B-094's
   failure mode, and these two levels are currently the only place it can still
   happen quietly.

   So the table SPECIFIES the modals and this holds them to it: same fields, same
   order, identity marked, and every declared field actually saved. `domId`
   ties the two together, because the shipped element ids predate the table.
   ============================================================================= */

const { read, fnSrc, decomment } = require('./_source.js');
const F = require('../../source/modules/field_spec.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html  = read('LingCoT.html');
const parts = decomment(read('modules/participants.js'));

/* The static markup of one modal box. */
function modalMarkup(boxId) {
  const i = html.indexOf(`id="${boxId}"`);
  if (i === -1) return null;
  const j = html.indexOf('</div>\n</div>', i);
  return j === -1 ? null : html.slice(i, j);
}

const MODALS = [
  { level: 'annotator', box: 'ann-modal-box', save: 'saveAnnModal' },
  { level: 'source',    box: 'src-modal-box', save: 'saveSrcModal' },
];

/* ── no domId is claimed by two levels ─────────────────────────────────── */
{
  const all = MODALS.flatMap(m => F.fieldsOf(m.level).map(f => f.domId)).filter(Boolean);
  check(new Set(all).size === all.length, 'every domId is unique across levels',
        all.filter((x, i) => all.indexOf(x) !== i).join(', '));
}

for (const { level, box, save } of MODALS) {
  console.log(`\n${level}\n`);
  const markup = modalMarkup(box);
  check(!!markup, `${box} is in the markup`);
  if (!markup) continue;

  const fields = F.fieldsOf(level).filter(F.isFillable);

  /* ── 1. the table names an element for every field ─────────────────────── */
  const undeclared = fields.filter(f => !f.domId);
  check(undeclared.length === 0,
        `every ${level} field names its element`,
        `${undeclared.map(f => f.key).join(', ')} — without a domId the field cannot be checked at all`);

  /* ── 2. the markup holds exactly those elements, in that order ──────────── */
  const inMarkup = [...markup.matchAll(/<(?:input|select|textarea)[^>]*id="([\w-]+)"/g)].map(m => m[1]);
  const declared = fields.map(f => f.domId);

  const extra = inMarkup.filter(id => !declared.includes(id));
  check(extra.length === 0,
        `${level}: the modal holds no field the table does not declare`,
        `${extra.join(', ')} — a field the table cannot see is invisible to the counter, `
        + 'the marking and the audit, which is the whole failure this guard exists for');

  const missing = declared.filter(id => !inMarkup.includes(id));
  check(missing.length === 0,
        `${level}: every declared field is in the modal`,
        `${missing.join(', ')} — declared but not rendered`);

  check(JSON.stringify(inMarkup) === JSON.stringify(declared),
        `${level}: and in the order the table declares`,
        `markup: ${inMarkup.join(', ')}\n       table:  ${declared.join(', ')}`);

  /* ── 3. identity is marked, and only identity ──────────────────────────── */
  const idField = F.fieldsInTier(level, 'identity')[0];
  check(!!idField, `${level}: has an identity field (${idField?.key})`);
  if (idField) {
    const lbl = new RegExp(
      `<label[^>]*for="${idField.domId}"[^>]*>([\\s\\S]{0,300}?)</label>`).exec(markup);
    check(!!lbl, `${level}: the identity field has a label`);
    check(!!lbl && /class="required"/.test(lbl[1]),
          `${level}: and it is marked required`,
          'identity is the only tier the save refuses empty, so it is the only one marked');
  }

  /* ── 4. every declared field is actually saved ──────────────────────────
     A field that renders and is never read is worse than a missing one: the
     annotator types into it and the value goes nowhere. */
  const saveSrc = fnSrc('modules/participants.js', save);
  const unsaved = fields.filter(f => !saveSrc.includes(`'${f.domId}'`));
  check(unsaved.length === 0,
        `${save} reads all ${fields.length} declared fields`,
        `${unsaved.map(f => f.domId).join(', ')} — rendered, typed into, and dropped`);
}

/* ── 5. the conditional groups stay where they are ───────────────────────── */
check(/function _srcModalUpdateFields/.test(parts)
   && /sm-human-fields/.test(html) && /sm-nonhuman-fields/.test(html),
      'the source modal keeps its own human / non-human condition',
      'the table declares no showIf, on purpose: a rule no reader honours is worse than none');

/* ── 6 · the hand-written surfaces that are not modals ────────────────────
   Word and morpheme. Their editors stay hand-written on purpose — autocomplete,
   the lemma offer strip, per-row chip drawers are not what a generated form is
   for — but they do not get to keep a private list of element names. Each field
   declares `domId` (a unique control) or `domSel` (one that repeats per row),
   and both the markup and the save path are held to it.

   Until v3.14.303 this did NOT check the control kind against the markup, on
   the grounds that "word-level transliteration is declared `translits` and drawn
   as a single box, and which of the two is wrong is D32's question". D32 answered
   it — B-045 ✅, B-093 ✅ — so the exemption goes with the mismatch it was
   written around, which is what B-045's own entry said would have to happen.
   A guard left permissive after the thing it excused is fixed is how the next
   mismatch arrives unannounced. */
const SURFACES = [
  { level: 'word',     render: 'renderWordEdit',     save: 'saveWord' },
  { level: 'morpheme', render: 'morphEditRowsHtml',  save: 'saveWord' },
];

for (const { level, render, save } of SURFACES) {
  console.log(`\n${level}\n`);
  /* DECOMMENTED, like the save source beside it. Found by mutation at
     v3.14.303: replacing the word's editor with a bare `<input>` still passed,
     because the comment above it NAMES `renderTransliterationsEditor` while
     explaining why it is there. A guard that reads prose is checking the
     documentation, and the documentation is the half that stays right. */
  const markup  = decomment(fnSrc('LingCoT.html', render) || '');
  const saveSrc = decomment(fnSrc('LingCoT.html', save));
  check(!!markup, `${render} is in the source`);
  if (!markup) continue;

  const fields  = F.fieldsOf(level).filter(F.isFillable);
  const blocked = fields.filter(f => f.blocked);
  const live    = fields.filter(f => !f.blocked);

  /* A block is a decision, so it is named on every run rather than passing
     silently — the failure mode this prevents is a block quietly becoming an
     omission. `morpheme.transliterations` was the only one and it waited for D32
     from B-093 until v3.14.303; the loop stays because the next block should be
     as visible as that one was. */
  for (const f of blocked)
    check(true, `${level}.${f.key} is blocked on ${f.blocked}, deliberately not drawn`);

  const undeclared = live.filter(f => !f.domId && !f.domSel);
  check(undeclared.length === 0,
        `every ${level} field names its element`,
        `${undeclared.map(f => f.key).join(', ')} — without a domId or domSel the field `
        + 'cannot be checked at all, which is how word.comments went four versions undrawn');

  for (const f of live) {
    const sel = F.selectorFor(level, f);
    /* The markup carries the id or the class literally. Matching the literal
       rather than a regex over it is deliberate: a template that computes its
       own id is exactly the drift the declaration exists to remove. */
    const needle = f.domSel ? f.domSel.split(' ')[0].replace(/^\./, '') : f.domId;
    check(markup.includes(needle),
          `${level}.${f.key}: ${render} draws ${sel}`,
          'declared in the table and drawn by nothing is a field nobody can fill');

    /* Read back, either by naming the element or by reaching it through the
       table. The second is the better spelling and this accepts both. */
    /* v3.14.303: the CONTROL KIND, checked against the markup. A `translits`
       field must be drawn by the shared multi-label editor and not by a lone
       `<input>` — that mismatch is what B-045 and B-093 both were, and it went
       unseen for as long as this guard declined to look. Only the kinds with an
       unmistakable component are asserted; a `text` field is an input on every
       surface and asserting that says nothing. */
    const KIND_DRAWN_BY = {
      translits:    'renderTransliterationsEditor',
      comments:     'renderCommentsEditor',
      translations: 'renderTranslationsEditor',
    };
    const drawnBy = KIND_DRAWN_BY[f.control];
    if (drawnBy)
      check(markup.includes(drawnBy),
            `${level}.${f.key}: drawn by ${drawnBy}, as its control declares`,
            `       declared \`${f.control}\` and drawn by something else is B-045 and B-093,\n`
            + '       which between them cost one field at two levels for ~40 versions');

    if (f.control === 'readonly') continue;
    const named   = saveSrc.includes(`'${f.domId}'`) || (f.domSel && saveSrc.includes(f.domSel))
                 || saveSrc.includes(needle);
    const viaSpec = new RegExp(`fieldOf\\('${level}', '${f.key}'\\)`).test(saveSrc);
    check(named || viaSpec,
          `${level}.${f.key}: ${save} reads it back`,
          'rendered, typed into, and dropped — the B-117 shape');
  }
}

/* ── 7 · one writer, everywhere ──────────────────────────────────────────
   The other half of the survey. Reading and stamping were both derived from
   the table; the assignment was not, so `document.translation_language` was
   drawn, read, validated and stamped for four versions and stored by nothing
   (B-117), and `dict_entry.form` — the identity field of a dictionary entry —
   could not be corrected at all (B-118).

   A handler that reads a level's form and then assigns by hand can reintroduce
   both, so the rule is stated where it can be checked: if you called readForm,
   you call applyForm. */
{
  console.log('\nthe writer\n');
  const src = decomment(read('LingCoT.html'));
  const fns = [...src.matchAll(/function (\w+)\s*\([^)]*\)\s*\{/g)].map(m => m[1]);
  const readers = [];
  for (const fn of fns) {
    const body = decomment(fnSrc('LingCoT.html', fn) || '');
    if (/readForm\('/.test(body)) readers.push({ fn, body });
  }
  check(readers.length >= 8,
        `${readers.length} handlers read a form through the table`);
  const handRolled = readers.filter(r => !/applyForm\(/.test(r.body)).map(r => r.fn);
  check(handRolled.length === 0,
        'every one of them writes through applyForm',
        `${handRolled.join(', ')} — a handler that assigns by hand decides for itself `
        + 'which declared fields get stored, which is what B-117 and B-118 were');

  /* And the writer answers to the table rather than to a list of its own. */
  const w = decomment(fnSrc('LingCoT.html', 'applyForm') || '');
  check(/for \(const f of fieldsOf\(level\)\)/.test(w),
        'applyForm walks the table rather than a list of keys');
  check(/f\.store/.test(w) && /f\.manual/.test(w),
        'and honours `store` and `manual`, which is how the two exceptions stay declared',
        'an exception written into the writer is an exception nothing can find');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
