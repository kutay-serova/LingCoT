#!/usr/bin/env node
/* =============================================================================
   offer_strip_live_test.js — a strip is a live promise, not a snapshot
   Run:  node dev/tests/offer_strip_live_test.js
   =============================================================================
   The word editor draws four strips that each say what the SAVE will do:

     the derive previews     what the save will compose from the morphemes
     the lemma strip         whether saving links, creates, or is ambiguous
     the word POS strip      what the lexicon would put in the POS field
     the morpheme offer      which fields a dictionary entry would fill

   Every one of them is computed from fields the annotator is at that moment
   typing into, so every one has to be repainted as they type. Three were. The
   fourth was repainted only when `#ew-parse` changed and after a chip was taken,
   so typing a gloss into a row left the chip above it advertising a fill it
   would no longer perform. Clicking it wrote nothing and logged
   `offer filled nothing` — **B-193**, and the third occurrence of one complaint:

     B-108  a chip that would change nothing looked like one that would
     B-166  the word POS chip, same thing, fixed by repainting on `#ew-pos`
     B-193  the morpheme offer, same thing, and B-166's own comment describes it

   WHAT THIS GUARD ASKS, AND WHY IT IS NOT A LIST OF FIELDS. The inputs a strip
   must repaint on are exactly the inputs it READS. So §2 takes the selectors out
   of `_morphRowsNow` — the function the offer is computed from — and requires
   the handler to cover each one. Add a fourth field to the row and this fails
   until the handler is told, which is the only reason it will not be B-193 again.

   §4 EXECUTES the thing itself: rows filled by hand, strip recomputed, chip must
   come back marked taken. A wiring check alone would pass on a handler that
   repaints with the wrong function.
   ============================================================================= */

const vm = require('vm');
const { read, decomment } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const APP    = read('LingCoT.html');
const EVENTS = decomment(read('modules/events.js'));

console.log('\n1 · the four strips, and what repaints each');

/* THE STRIP handler, and there is more than one `input` listener on #content —
   the autocomplete has its own, and it comes first in the file. The first draft
   of this guard took the first match and reported all four strips unwired. The
   one wanted is identified by what it does, not by its position. */
const handlers = [...EVENTS.matchAll(/contentEl\.addEventListener\('input',[\s\S]*?\n  \}\);/g)]
  .map(m => m[0]);
const H = handlers.find(h => h.includes('refreshDerivePreviews')) || '';
check(!!H, `the strip input handler found (${handlers.length} input listener(s) on #content)`,
      '         none of them repaints a strip');

for (const [fn, why] of [
  ['refreshDerivePreviews', 'the derive previews'],
  ['refreshLemmaStrip',     'the lemma strip'],
  ['refreshWordPosStrip',   'the word POS strip (B-166)'],
  ['refreshMorphSuggest',   'the morpheme offer strip (B-193)'],
])
  check(H.includes(fn + '('), `${why} is repainted as the annotator types`,
        `         ${fn}() is not called from the input handler — the strip it\n`
      + '         draws is a snapshot of the state the view was rendered in');

console.log('\n2 · the offer repaints on every input it READS');

/* DERIVED from `_morphRowsNow`, the function `offerFillsNothing` is computed
   from. A field added there and not here is B-193 again, and this is the check
   that says so. `.morph-edit-form-label` is excluded deliberately: it is a
   LABEL, its text comes from the parse, and `#ew-parse` has its own listener. */
const rowsNow = APP.match(/function _morphRowsNow\(\)[\s\S]*?\n\}/);
check(!!rowsNow, '_morphRowsNow found');
/* Only the typed INPUTS: `.morph-edit-row` is the container the walk starts from
   and `.morph-edit-form-label` is a label whose text comes from the parse, which
   has its own listener. Deduped — the function reads each selector twice, once
   for the value and once for `data-original`. */
const readSel = [...new Set(
  [...(rowsNow ? rowsNow[0] : '').matchAll(/'\.(morph-[a-z-]+)'/g)].map(m => m[1])
)].filter(c => c.endsWith('-input'));
check(readSel.length >= 3,
      `it reads ${readSel.length} typed row field(s): ${readSel.join(', ')}`);

const missing = readSel.filter(c => !H.includes(c));
check(missing.length === 0,
      'the input handler names every one of them',
      missing.map(c => `         .${c} is read by the offer and never repaints it`).join('\n')
    + '\n         a chip drawn before that field was filled stays drawn after');

/* And the repaint has to be the OFFER's, not just any strip's.

   B-197 put a second call in this branch — the link warning is computed from
   the same three fields — so the pattern can no longer assume the branch is one
   statement. It matches the branch and asks what is INSIDE it, which is the
   question either shape answers. */
const offerBranch = H.match(
  /if \(el && \(el\.classList\?\.contains\('morph-[\s\S]{0,400}?(?:\n\s*\}|refresh\w+\(\);)/g) || [];
check(offerBranch.some(b => b.includes('refreshMorphSuggest')),
      'and the branch that names them calls refreshMorphSuggest',
      '         repainting the derive previews instead leaves the chip stale');

console.log('\n3 · the two paths that already worked are still wired');

check(/ewParse\.addEventListener\('input'[\s\S]{0,200}?refreshMorphSuggest\(\)/.test(EVENTS),
      'the parse field still rebuilds the rows and the strip');
check(/refreshMorphSuggest\(\);[\s\S]{0,120}?focusOfferChip/.test(decomment(APP)),
      'and a taken chip still repaints it');

console.log('\n4 · executed: a chip goes from live to taken as the rows fill');

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
const run = expr => vm.runInContext(expr, ctx);
ctx.__loc = JSON.parse(read('resources/locale/en.json'));
run('_LOCALE = __loc;');

/* `_morphRowsNow` reads the DOM; the stub returns null for it, so the offer
   falls back to the stored morphemes. That fallback is what this drives: an
   EMPTY morpheme is the state the chip was drawn against, a FILLED one is the
   state it was clicked in, and the chip has to change between them. */
ctx.__entry = { id: 'd1', form: 'tilki', type: 'word', part_of_speech: 'NOUN', gloss: 'fox' };
const panel = (morph) => {
  ctx.__word = { id: 'w1', form: 'tilkiyi', morphological_parse: 'tilki-I',
                 morphemes: [morph, { form: 'I', type: 'bound.morpheme' }] };
  run("S.dictionary = [__entry]; buildDictIndex(); _morphSuggestLast = null;");
  return String(run("renderMorphSuggestPanel(__word.form, __word.morphological_parse, __word)"));
};

const before = panel({ form: 'tilki' });
check(/offer-chip/.test(before) && !/offer-taken/.test(before),
      'against an EMPTY row the chip is live — it has three fields to write',
      `         ${before.slice(0, 140)}`);

const after = panel({ form: 'tilki', gloss: 'fox', type: 'word',
                      part_of_speech: 'NOUN', dict_id: 'd1' });
check(/offer-taken/.test(after),
      'once the row is filled by hand the SAME chip is marked taken',
      '         this is B-193: without a repaint the annotator still sees the\n'
    + '         first state, clicks it, and the app writes nothing');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
