#!/usr/bin/env node
/* =============================================================================
   morph_type_test.js, a morpheme's type reaches the file it was annotated in
   Run:  node dev/tests/morph_type_test.js
   =============================================================================
   B-089 and B-090, both found by reading a real half-annotated corpus rather
   than the code, which is why neither had a guard.

   B-089: the type was filled only by the enrich pass that runs when a project
   is OPENED, so a morpheme annotated and pushed in one sitting was written to
   disk untyped and stayed that way. The measurement that found it: 19
   morphemes, 19 dictionary links, 0 types, against entries that all carried one.

   B-090: the completion modal printed the string "null" where an entry had no
   type, and gave no way to set one. B-069 leaves a first-of-several morpheme's
   type deliberately unset, which is right; never asking is not.

   The rule this guard states once: a value the dictionary supplied is stamped
   derived, everywhere it is supplied. Three sites fill this one field and each
   had to be found by hand, so the guard counts them.
   ============================================================================= */

const { read, fnSrc, decomment, moduleFiles } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read('LingCoT.html');
const all  = decomment([html, ...moduleFiles().map(([, c]) => c)].join('\n'));

/* -- B-089: the type is written when the word is saved -------------------- */
check(/function inheritMorphemeTypes\s*\(/.test(html), 'inheritMorphemeTypes() is defined');

const linkWord = fnSrc('LingCoT.html', 'autoLinkWord');
check(/inheritMorphemeTypes\(word\)/.test(linkWord),
      'the save path fills morpheme types',
      'without this the value only appears the next time the project is opened');

const inherit = fnSrc('LingCoT.html', 'inheritMorphemeTypes');
check(/if \(m\.type\) continue/.test(inherit),
      'it is fill-only and never overwrites a type someone set');
check(/_derivedFieldProv\(\)/.test(inherit),
      'and stamps the value derived, because the dictionary said it, not a person');

/* Every place that writes m.type from a dictionary fill stamps it.

   Counted, until v3.14.348, because two of the three sites were missing the
   stamp before B-089 and counting was the only way to notice a fourth. D60/L-035
   removed the counting problem instead: `morphFillPlan` decides what a morpheme
   should get and `applyFillPlan` writes it, and the write and the stamp are the
   same two lines, so a field cannot be filled without saying where it came from.

   So the claim is stronger and narrower now — ONE writer, which stamps whatever
   it writes — and the old shape is asserted absent, because a site that assigns
   `m.type = fill.type` on its own is exactly the thing that could have no stamp. */
{
  const plan  = decomment(fnSrc('LingCoT.html', 'morphFillPlan') || '');
  const apply = decomment(fnSrc('LingCoT.html', 'applyFillPlan') || '');
  check(plan !== '' && apply !== '', 'the plan and its applier are both in the source');
  check(/field:\s*'type',\s*value:\s*fill\.type/.test(plan),
        'the plan takes a morpheme type from the composed dictionary fill');
  check(/m\[op\.field\]\s*=\s*op\.value/.test(apply)
        && /stampField\(m,\s*op\.field,\s*_derivedFieldProv\(\)\)/.test(apply),
        'and the one writer stamps every field it writes, derived',
        '       the write and the stamp are two adjacent lines in one loop:\n'
      + '       there is no site that can do one without the other');

  /* And the sites are exactly two, each named by the function it is in. There is
     a second legitimate writer — `inheritMorphemeTypes`, B-089, which fills the
     type at word-save so the file on disk is complete when it is written — and it
     stamps for itself. Naming the enclosing function rather than counting matches
     is what tells a third site apart from a moved one: a new name here is a new
     writer, and a writer is where a missing stamp lives. */
  const bare  = decomment(html);
  const owner = idx => {
    const before = bare.slice(0, idx);
    const m = [...before.matchAll(/function\s+(\w+)\s*\(/g)].pop();
    return m ? m[1] : '(top level)';
  };
  const sites = [...new Set([...bare.matchAll(/\bfill\.type\b/g)].map(m => owner(m.index)))].sort();
  check(JSON.stringify(sites) === JSON.stringify(['inheritMorphemeTypes', 'morphFillPlan']),
        `the dictionary's type is read in exactly 2 place(s): ${sites.join(', ')}`,
        '       a third is not forbidden — it is unreviewed. Add it here with the\n'
      + '       stamp check below, or route it through applyFillPlan');
  /* Each of the two is one of two honest shapes: it writes and stamps in the same
     breath, or it writes nothing at all and hands an op to the one applier. The
     shape that has no name here is the one B-089 was — a function that writes the
     type and leaves the stamp to somebody else. */
  for (const fn of sites) {
    const body   = decomment(fnSrc('LingCoT.html', fn) || '');
    const writes = /\bm\.\w+\s*=[^=]/.test(body);
    check(writes ? /stampField\(/.test(body) : true,
          writes ? `${fn} writes the morpheme and stamps it in the same place`
                 : `${fn} writes nothing — it plans, and applyFillPlan stamps`,
          '       a writer that leaves the stamp to somebody else is B-089');
  }

  check(!/field_prov\s*=\s*\{/.test(apply),
        'and does not replace the whole field_prov map to do it',
        '       build-then-replace dropped linkTo\'s stamp at v3.14.260 (B-137)');
}

/* -- B-090: the surface shows a type or asks for one, never "null" --------
   v3.14.269: the completion modal is gone (D51 stage 4) and its row is the
   add-to-dictionary panel's. The claim is unchanged and the ids moved. */
{
  const modal = fnSrc('LingCoT.html', 'pkRowHtml');
  check(/r\.type \? `<span class="pk-form-tag">/.test(modal),
        'the type badge is rendered only when there is a type',
        'esc(type) on an unset type printed the word "null"');
  check(/pk-type-\$\{i\}/.test(modal),
        'and there is always an input to set one');
  check(/TYPE_CHOICES/.test(modal),
        'with the same chip vocabulary the dictionary editor offers');

  const read = fnSrc('LingCoT.html', '_pkCandidates');
  check(/read\('type', 'type'\)/.test(read),
        'and the panel reads the chosen type back',
        'a control whose value is never read is worse than no control');
  check(/S\.morphTypes\.add/.test(read),
        'a type typed here joins the label pool, like every other surface\'s');
}

/* -- B-104's way back, and why it is gone --------------------------------
   The completion modal opened AFTER the entries existed, so an annotator who
   noticed an empty gloss had no way back: Skip and × both left the entries as
   the bare push made them, and B-104 added a "Back to the word" button that
   re-ticked the push box so the next save re-offered.

   D51 stage 4 removes the situation. Nothing is written until the panel is
   answered, so "back" is what Escape already does, and the fields B-104 existed
   to let you fix are in front of you before the write. The guard keeps the
   claim that matters — the way out must not write anything — and drops the
   button with the modal. */
{
  /* B-196, v3.14.374: the panel's markup and listeners moved into `_pkRender`
     so that its one rebuilding control is a repaint rather than a third route
     in. The claims below are about the way OUT, which lives with them. */
  const open = fnSrc('LingCoT.html', '_pkRender');
  check(/data-action="pk-skip"/.test(open) && /closeAddDictModal\(null\)/.test(open),
        'skipping the panel writes nothing at all',
        'the completion modal could only be skipped AFTER the entries existed');
  check(/ev\.key === 'Escape'/.test(open) && (open.match(/closeAddDictModal\(null\)/g) || []).length >= 2,
        'and Escape means the same thing as Skip');
  check(!/function backToWordFromCompletion\s*\(/.test(html),
        'backToWordFromCompletion is gone with the modal that needed it');
  check(!/openCompletionModal|saveCompletionModal|_cdState/.test(decomment(html)),
        'and so is the rest of the completion modal',
        'a half-removed surface is two flows, which is what B-112 was about');
}

/* -- one chip handler, two surfaces --------------------------------------- */
check(/function handleChipClick\s*\(/.test(html), 'handleChipClick() is defined');
check((all.match(/handleChipClick/g) || []).length >= 3,
      'both #content and the add-to-dictionary panel use it',
      'the panel sits outside #content, and the modal it replaced used to carry '
    + 'its own half-copy, which knew POS chips but not type chips (B-090)');
check(!/closest\('\.chip\[data-action="pos-select"\]'\)/.test(all),
      'no surface keeps a private half-copy of the chip handler');

/* ── B-082: an offer that shows a type delivers one ─────────────────────────
   The morpheme row has carried a type control since B-093 and the dictionary
   entry has always known its type. Nothing joined them, so a `bound.morpheme`
   chip filled gloss and POS and left the field an annotator can least guess
   from the form. The chip now shows type in its meta line as well, because a
   value that arrives unannounced is the opposite defect. */
{
  const offerSrc = read('LingCoT.html').match(/const offer = \(e, act\) => \(\{[\s\S]*?\}\);/)?.[0] || '';
  check(/type:\s*e\.type/.test(offerSrc), 'the lexicon offer carries the entry type');
  check(/meta:[^\n]*e\.type/.test(offerSrc), 'and shows it in the chip meta line',
        'filling a field the chip never advertised is a surprise in the other direction');

  const fill = fnSrc('LingCoT.html', '_fillMorphRows') || '';
  check(/\(form, gloss, src, entryId, pos, type/.test(fill), '_fillMorphRows takes a type');
  check(/\.morph-type-input/.test(fill), 'and knows the row control to write it into');

  /* v3.14.330, D55. Type used to be a hand-written branch beside gloss and POS,
     each with its own copy of the gate — which is how B-082's fix reached two of
     the three and how B-165's stamp reached one. The three are now one list and
     one loop, so the assertion moves from "the type branch is correct" to "type
     is IN the list", which is the thing that cannot silently stop being true. */
  const decl = read('LingCoT.html').match(/const _OFFER_FIELDS = \[[^\]]*\];/)?.[0] || '';
  check(/'type'/.test(decl), 'and type is one of the fields an offer can write',
        `       _OFFER_FIELDS is ${decl || '(not found)'} — a field outside it is never written`);
  check(/entry\[key\]/.test(fill) && !/ty\.value = type/.test(fill),
        'written from the offer by name, not by a branch per field',
        'a per-field branch is what let the gate and the stamp diverge twice');
  check(/dataset\.offerSrc = src/.test(fill),
        'and every field it writes is marked, so saveWord stamps it derived (B-165)');

  /* The gate itself moved out and changed: D55 decided an explicit take
     overwrites. That is proved behaviourally in suggest_mechanism_test, which
     fills real rows in both modes; what belongs here is that this function no
     longer decides it privately. */
  check(/offerWrites\(/.test(fill) && !/mayFill/.test(fill),
        'the write/skip decision is the shared predicate, not a private gate',
        'B-082 was a wrong gate once already, and two functions answering one question is B-113');

  /* Both accept paths must pass it through, or the fix works from one chip
     shape and not the other. */
  const take = fnSrc('LingCoT.html', 'takeOffer') || '';
  const calls = [...take.matchAll(/_fillMorphRows\([\s\S]*?\);/g)];
  check(calls.length === 2, `both accept paths call _fillMorphRows (${calls.length})`);
  for (const c of calls)
    check(/offerType/.test(c[0]), 'the call passes the offered type', c[0].replace(/\s+/g, ' ').slice(0, 90));
}

/* ── B-108: an offer that can fill nothing says so ──────────────────────────
   `.offer-chip.offer-taken` was styled and the click handler already refused a
   click on it, and nothing anywhere added the class: a dead style plus a guard
   that never fires, which reads as a working feature. The predicate is executed
   rather than read, because "every row it matches already has every value it
   offers" is not something a regex can check. */
{
  const html = read('LingCoT.html');
  /* B-113, v3.14.266: the predicate reads the ROWS when there are any and falls
     back to the stored morphemes when there are not. Both are compiled in; the
     stored-data claims below run with no DOM, which is the first-render case,
     and the row case gets its own block after them. */
  /* v3.14.330: the predicate delegates to `offerWrites`, which is the whole
     point of D55 — one question, one answer, used by the chip and by the click.
     So the shared function and the field list it iterates are compiled in too;
     the list is read from source rather than restated, because a second copy of
     it here is exactly the divergence this guard is about. */
  const OFFER_DECL = html.match(/const _OFFER_FIELDS = \[[^\]]*\];/)?.[0];
  check(!!OFFER_DECL, '_OFFER_FIELDS is declared where the guard can read it');
  const build = getRows => new Function('normForm', 'document',
    `${OFFER_DECL}\n`
    + `${fnSrc('LingCoT.html', 'offerWrites')}\n`
    + `${fnSrc('LingCoT.html', '_morphRowsNow')}\n`
    + `${fnSrc('LingCoT.html', 'offerFillsNothing')}\nreturn offerFillsNothing;`
  )(f => String(f || '').normalize('NFC').toLocaleLowerCase('tr'), getRows);
  const fn = build(undefined);   // no DOM at all: the first-render source

  const entry = { id: 'd1', form: 'de', gloss: 'LOC', part_of_speech: 'AFFIX', type: 'bound.morpheme' };
  const full  = { form: 'de', gloss: 'LOC', part_of_speech: 'AFFIX', type: 'bound.morpheme', dict_id: 'd1' };

  check(fn(entry, [full]) === true, 'a row that already says all of it is agreed');
  for (const k of ['gloss', 'part_of_speech', 'type', 'dict_id']) {
    const gap = { ...full }; delete gap[k];
    check(fn(entry, [gap]) === false, `a row missing ${k} is still a live offer`);
  }
  check(fn(entry, [full, { form: 'de' }]) === false,
        'one empty row among several keeps the whole offer live',
        'the fill writes into every matching row, so any one of them is reason to offer');
  check(fn(entry, [{ form: 'ler', gloss: 'PL' }]) === false,
        'a form that matches no row is never agreed',
        'it is spliced into the parse instead, which always changes something');
  check(fn(entry, []) === false, 'and neither is a word with no morphemes at all');
  check(fn({ id: '', form: 'de', gloss: 'LOC' }, [{ form: 'De', gloss: 'LOC' }]) === true,
        'the form comparison folds, like every other form comparison here');

  /* An entry that carries nothing cannot fill anything, so it is agreed with
     any row. It should not have been offered, but saying "live" would put a
     chip on screen that does nothing when clicked. */
  check(fn({ id: '', form: 'de' }, [{ form: 'de' }]) === true,
        'an entry with no values to give is agreed rather than live');

  /* B-113. `_fillMorphRows` writes into the DOM inputs and never touches
     `word.morphemes`, so asking the stored data after a fill answered the
     question the annotator had already resolved: the chip redrew as live, and
     the taken state appeared only after a save and a re-open. The rows are the
     current source whenever they exist. */
  /* v3.14.330: an input carries `data-original` as well as a value — what a
     PERSON saved, beside what is in the box. `_morphRowsNow` reads both now,
     because D55's two modes differ on exactly that distinction. `saved` defaults
     to the shown value, which is the state after a load and before any edit. */
  const rowEl = (form, vals = {}, saved = null) => {
    const inp = k => ({ value: vals[k] || '',
                        dataset: { original: (saved ? saved[k] : vals[k]) || '' } });
    return {
      dataset: { dictId: vals.dict_id || '' },
      querySelector: sel => ({
        '.morph-edit-form-label': { textContent: form },
        '.morph-gloss-input':     inp('gloss'),
        '.morph-pos-input':       inp('part_of_speech'),
        '.morph-type-input':      inp('type'),
      }[sel] || null),
    };
  };
  const domWith = rows => ({
    getElementById: id => id === 'ew-morph-rows'
      ? { querySelectorAll: () => rows } : null,
  });

  const stale = [{ form: 'de' }];   // what the STORE still says after a fill
  const filled = build(domWith([rowEl('de', {
    gloss: 'LOC', part_of_speech: 'AFFIX', type: 'bound.morpheme', dict_id: 'd1' })]));
  check(filled(entry, stale) === true,
        'a row the annotator has just filled reads as agreed, before any save',
        '         B-113: the store is unchanged by a fill, so asking it redrew the chip as live');

  const partly = build(domWith([rowEl('de', { gloss: 'LOC' })]));
  check(partly(entry, stale) === false,
        'and a row filled only part-way is still a live offer');

  const emptyRows = build(domWith([rowEl('de')]));
  check(emptyRows(entry, [{ form: 'de', gloss: 'LOC', part_of_speech: 'AFFIX',
                            type: 'bound.morpheme', dict_id: 'd1' }]) === false,
        'the ROWS win over the store, not the other way round',
        '         a row cleared on screen is a row that can be filled again');

  const noRows = build(domWith([]));
  check(noRows(entry, [full]) === true,
        'no rows on screen falls back to the stored morphemes (first render)',
        '         the panel is built inside renderWordEdit\'s string, before any row exists');

  // The wiring: only a parse match can be inert, and the class must reach the chip.
  const panel = fnSrc('LingCoT.html', 'renderMorphSuggestPanel') || '';
  check(/taken:\s*act === 'fill-rows' && offerFillsNothing\(/.test(panel),
        'only a fill-rows offer is tested for it');
  const strip = fnSrc('LingCoT.html', 'offerStripHtml') || '';
  check(/o\.taken \? ' offer-taken' : ''/.test(strip), 'and the chip carries the class');
  check(/o\.taken \? t\('title\.offer\.agreed'\)/.test(strip),
        'with a title that says why it is inert rather than the meta line');
  check(/\.offer-chip\.offer-taken\s*\{/.test(read('LingCoT.css')),
        'the class is styled');
  /* v3.14.266: the panel still hands over the stored morphemes, and that is
     still right — it is the fallback for the first render, when the panel is
     built inside renderWordEdit's string and no row exists yet. What changed is
     that the predicate prefers the rows when there are any, which the block
     above executes. Both halves have to stay: the argument here, the preference
     there. */
  check(/word && word\.morphemes/.test(panel),
        'the panel still supplies the stored morphemes as the first-render source',
        'without them a freshly opened word has no source at all');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
