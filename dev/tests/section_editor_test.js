#!/usr/bin/env node
/* =============================================================================
   section_editor_test.js — the document editor commits at Save, and only there
   Run:  node dev/tests/section_editor_test.js
   =============================================================================
   B-175 and B-178, v3.14.343, and D59 which decides them together.

   B-175: the row-control handler delegated on three STYLE classes while reading
   `dataset.arr` for the action. A restyle gave the delete button the shared
   `btn btn-danger btn-sm` classes and `.sec-del-btn` stopped existing anywhere
   except inside that selector, so section delete — the only entity-level delete
   the GUI offers — did nothing at all for ~200 versions. Both halves were
   individually correct: the handler was defined and reachable, the button
   rendered and was operable. Nothing but a delegated click proved they never
   met, and `selector_audit_test.js` had actually FLAGGED the dead selector and
   been answered with "the section editor has no delete button", which was false.

   B-178: in the same handler, `merge` wrote into `d.sections` on the click while
   `del` waited for Save, so leaving the editor without saving kept the merge.

   WHAT THIS GUARD DOES, and what it does not:

     EXECUTED  the rows are rendered by the app's own `secEditRowsHtml()` from a
               buffer this test puts in place, and the selector is the one in
               events.js. §1 asks whether that selector would match those
               buttons — which is the question the bug turned on — and §3 asks
               what the app draws and counts from a given buffer.
     READ      §2 and §4 are textual: that the handler names nothing belonging to
               the document, and that the draft's lifetime is `go()`'s. A guard
               cannot dispatch a delegated click without a real DOM, and a stub
               that pretended to would be asserting against itself.

   The end-to-end proof — press the button, answer the confirm, read the file —
   is `gui_crud_test.js` D0b/D0c/D2/D4, which is where this pair was found. That
   one needs a browser and 47 s. This one runs in the default suite so the drift
   that caused B-175 cannot survive a save.
   ============================================================================= */

const path = require('path');
const vm   = require('vm');
const { read, decomment, fnSrc } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const evts = read(path.join('modules', 'events.js'));

/* ── the section-row handler, sliced by its own marker ────────────────────── */
const MARK = 'Document-edit, section-row reorder / merge / delete';
const hi = evts.indexOf(MARK);
if (hi === -1) {
  console.log('  FAIL the section-row handler could not be found by its marker comment');
  console.log('\n  0 passed, 1 failed\n');
  process.exit(1);
}
/* From the listener, not from the marker: the marker sits INSIDE the header
   comment, so slicing there hands decomment() an unterminated block and leaves
   the prose in — which is how a check for "the handler never names d.sections"
   fails on a comment that explains why it must not. */
const hStart = evts.indexOf('contentEl.addEventListener', hi);
const hEnd   = evts.indexOf('\n  });', hStart);
const handler = evts.slice(hStart, hEnd);
const hBody   = decomment(handler);

console.log('\n1 · the delegation selector matches the buttons the app renders');

const sources = appSources();
const ctx = makeCtx({ hasId: () => true });
const bootErrs = loadApp(ctx, sources);
if (bootErrs.length) {
  for (const [label, err] of bootErrs) console.log(`  FAIL ${label}: ${err.message}`);
  console.log('\n  the app does not boot, so nothing below can be rendered');
  console.log('\n  0 passed, 1 failed\n');
  process.exit(1);
}
const run = expr => vm.runInContext(expr, ctx);

/* Three sections: one with two sentences, one with one, one empty. The counts
   in §3 are read off this and nowhere else. */
const DOC = {
  id: 'doc_g', metadata: { title: 'Guard' },
  sections: [
    { id: 'sec_1', title: 'One',   paragraphs: [{ id: 'p_1', sentences: [{ id: 's_1' }, { id: 's_2' }] }] },
    { id: 'sec_2', title: 'Two',   paragraphs: [{ id: 'p_2', sentences: [{ id: 's_3' }] }] },
    { id: 'sec_3', title: 'Three', paragraphs: [] },
  ],
};
/* `S` is a top-level `const`, so it is a lexical binding of the VM context and
   not a property of it: reachable through runInContext, not through ctx.S. */
run(`S.docs = [${JSON.stringify(DOC)}]; S.docIdx = 0;`);
const docBefore = run('JSON.stringify(S.docs[0])');

const rowsHtml = run('secEditReset(), secEditRowsHtml()');
const rendered = [...rowsHtml.matchAll(/<button\b([^>]*)>/g)].map(m => m[1])
  .map(attrs => ({
    arr:     (attrs.match(/\bdata-arr="([^"]+)"/)     || [])[1] || null,
    classes: ((attrs.match(/\bclass="([^"]*)"/)       || [])[1] || '').split(/\s+/).filter(Boolean),
    attrs:   [...attrs.matchAll(/\b([a-zA-Z-]+)=/g)].map(m => m[1]),
  }))
  .filter(b => b.arr);

check(rendered.length > 0, `${rendered.length} row control(s) rendered`,
      '         no [data-arr] button in secEditRowsHtml() output — the rest of\n'
    + '         this guard would then be checking an empty set');

const selMatch = handler.match(/closest\('([^']+)'\)/);
check(!!selMatch, 'the handler delegates through one closest() selector');
const SEL = selMatch ? selMatch[1] : '';

/* A deliberately small matcher: it understands a class, an attribute-presence
   test, and a descendant combinator whose ancestor is the row. Anything else is
   reported as UNKNOWN and fails, rather than being silently read as "no match"
   — a guard that answers a question it does not understand is the shape this
   project has shipped fourteen times. */
const unknown = [];
function matches(sel, btn) {
  return sel.split(',').map(s => s.trim()).filter(Boolean).some(alt => {
    const parts = alt.split(/\s+/);
    for (const anc of parts.slice(0, -1))
      if (anc !== '.sec-edit-row') { unknown.push(alt); return false; }
    const last = parts[parts.length - 1];
    if (/^\.[\w-]+$/.test(last))            return btn.classes.includes(last.slice(1));
    if (/^\[[\w-]+\]$/.test(last))          return btn.attrs.includes(last.slice(1, -1));
    unknown.push(alt);
    return false;
  });
}

const unmatched = rendered.filter(b => !matches(SEL, b));
check(unknown.length === 0,
      `the selector \`${SEL}\` is one this guard can evaluate`,
      `         did not understand: ${[...new Set(unknown)].join(' , ')}\n`
    + '         teach matches() this shape, or the check below means nothing');
check(unmatched.length === 0,
      'every rendered row control is reachable by that selector',
      `         unreachable: ${unmatched.map(b => `data-arr="${b.arr}" class="${b.classes.join(' ')}"`).join('\n                      ')}\n`
    + '         this is B-175 exactly: a button the handler can never see');

console.log('\n2 · every action the markup offers has a branch, and no branch is orphaned');

const drawn   = [...new Set(rendered.map(b => b.arr))].sort();
const branched = [...new Set([...hBody.matchAll(/arr\s*===\s*'([^']+)'/g)].map(m => m[1]))].sort();
check(drawn.length > 0 && branched.length > 0, `${drawn.length} drawn, ${branched.length} handled`);
check(drawn.every(a => branched.includes(a)),
      'every data-arr the renderer emits is handled',
      `         drawn but not handled: ${drawn.filter(a => !branched.includes(a)).join(', ')}`);
check(branched.every(a => drawn.includes(a)),
      'every branch corresponds to a button that exists',
      `         handled but never drawn: ${branched.filter(a => !drawn.includes(a)).join(', ')}\n`
    + '         a branch for a control nobody renders is the other half of B-175');

console.log('\n3 · the handler edits the draft, never the document (B-178 / D59)');

for (const forbidden of ['.paragraphs', 'd.sections', 'doc()', 'sections()'])
  check(!hBody.includes(forbidden),
        `the handler never names \`${forbidden}\``,
        `         B-178 was \`secA.paragraphs.push(...)\` on the click. Section\n`
      + '         controls edit the buffer; saveDocument is the only writer.');

check(hBody.includes('secEditReadTitles'),
      'it reads the typed titles back before it redraws',
      '         the redraw rebuilds the inputs from the buffer, so a title typed\n'
    + '         and not yet saved is discarded without this');
const iRead = hBody.indexOf('secEditReadTitles');
const iAct  = hBody.search(/arr\s*===\s*'/);
check(iRead !== -1 && iAct !== -1 && iRead < iAct,
      'and it reads them BEFORE the first branch, not after',
      '         reading after a splice attributes one row\'s title to another');

console.log('\n4 · the draft lives as long as the editor is open, and no longer');

const goSrc = fnSrc('LingCoT.html', 'go');
check(/if\s*\(view\s*!==\s*'document-edit'\)\s*_secEdit\s*=\s*null/.test(decomment(goSrc)),
      'go() discards the draft on the way out of the editor',
      '         that discard is the only undo this app offers for a merge or a\n'
    + '         delete (D56). Without it, leaving and returning shows stale rows.');

const rde = decomment(fnSrc('LingCoT.html', 'renderDocumentEdit'));
check(!/secEditReset\s*\(/.test(rde),
      'renderDocumentEdit does NOT reset it',
      '         this renderer re-runs whenever the cache key moves — an autosave\n'
    + '         bumping _dataGen is enough — and a reset here would throw away a\n'
    + '         merge the annotator made seconds ago');

const save = decomment(fnSrc('LingCoT.html', 'saveDocument'));
check(/secEditReadTitles\s*\(/.test(save), 'saveDocument reads the typed titles');
check(/buildCorpusIndex\s*\(/.test(save),
      'and rebuilds the corpus index when the structure changed',
      '         a reorder moves sectIdx on every word after it; a delete leaves\n'
    + '         its words in S.wordById, the form refs and corpusLemmaRefs as\n'
    + '         phantom hits. B-175 turned on the path that produces them.');

console.log('\n5 · what the app draws and counts from a given draft');

check(run('secEditBuffer().length') === 3, 'the buffer opens with one entry per section');
check(run("secEditCounts({ si: 0, absorbed: [] }).ns") === 2,
      'a row counts its own sentences');
check(run("secEditCounts({ si: 0, absorbed: [1] }).ns") === 3
   && run("secEditCounts({ si: 0, absorbed: [1] }).np") === 2,
      'a row that has absorbed another counts both',
      '         the delete confirm quotes these numbers, so a row that would\n'
    + '         discard three sections must not report one section\'s worth');

/* A draft in the shape a merge leaves: entry 0 has absorbed entry 1, and the
   absorbed row is gone from the list. Set here as STATE — the transition itself
   is the handler's, and gui_crud_test.js D4 is what presses the button. */
run("_secEdit[0].absorbed.push(_secEdit[1].si); _secEdit.splice(1, 1); _secEdit[0].title = 'Renamed';");
const merged = run('secEditRowsHtml()');
const rowCount = (merged.match(/class="sec-edit-row"/g) || []).length;
check(rowCount === 2, 'the redraw shows one row per buffer entry', `         got ${rowCount}`);
check(merged.includes('value="Renamed"'),
      'and the title as typed, not as stored',
      '         the buffer holds the typed value; re-reading the record here is\n'
    + '         how a retitle is lost across a merge');
check(!/data-si=/.test(merged),
      'the row carries no data-si — its place in the buffer is its identity',
      '         an index written into the markup is a second answer to the\n'
    + '         question the buffer already answers (PRACTICES §4)');

check(run('JSON.stringify(S.docs[0])') === docBefore,
      'and none of that touched the document',
      '         the buffer, the counts and the redraw are all read-only against\n'
    + '         d.sections. This is the whole of D59.');

/* ═══ B-198 · a merge reparents, and must say so ═════════════════════════════
   Reported as *"I merged two sections — check if that broke anything"*, and the
   answer is that it broke nothing. `turkish-test` came out of it with 236 ids,
   no duplicates, no dangling references, every object indexed under the section
   it sits in, and complete traversal. The one divergence — `sec_005` holding a
   paragraph whose id is `…sec_006.p_001` — is B-135's rule working: ids are
   IDENTITIES, NOT PATHS, and renaming a moved child would break `word.head`, the
   journal and every by-id map in order to preserve an appearance.

   WHAT WAS MISSING IS THE REPORT. `saveSection`'s re-parse has logged exactly
   this since B-135, and the comment beside it says why: *"the only reason this
   was ever found was a sweep of the file months afterwards."* The merge made the
   same divergence one level up and said nothing — and it was found by a sweep of
   the file, which is the outcome that comment exists to prevent, reached by the
   route it names. One reporter now, because two writers of one statement is how
   they come to disagree about what they are reporting.

   EXECUTED. The static half lives in `id_sort_test` with the rule it belongs to;
   this drives the merge and asks what the document looks like afterwards. */
console.log('\n5 · B-198 — the merge keeps ids and reports the divergence');
{
  const DOC = {
    id: 'd1', metadata: { title: 't' },
    sections: [
      { id: 'd1.sec_001', title: 'A', paragraphs: [
        { id: 'd1.sec_001.p_001', sentences: [
          { id: 'd1.sec_001.p_001.s_001', text: 'a',
            words: [{ id: 'd1.sec_001.p_001.s_001.w_001', form: 'a' }] }] }] },
      { id: 'd1.sec_002', title: 'B', paragraphs: [
        { id: 'd1.sec_002.p_001', sentences: [
          { id: 'd1.sec_002.p_001.s_001', text: 'b',
            words: [{ id: 'd1.sec_002.p_001.s_001.w_001', form: 'b' }] }] }] },
    ],
  };
  ctx.__doc = JSON.parse(JSON.stringify(DOC));
  run("applyCorpus([__doc], 'b198'); buildCorpusIndex();");
  ctx.__logged = [];
  run("logEvent = (lvl, msg, det) => { __logged.push([lvl, msg, String(det || '')]); };");

  /* The merge, as `saveDocument` performs it: section 1's paragraphs are
     concatenated into section 0 and section 1 goes. Driven through the real
     buffer so the shape is the app's, not this file's idea of it. */
  /* `saveDocument` refuses without an annotator (I1) and reads its own form; the
     stub answers every id, so the form comes back empty and the titles below are
     left as they are. What is being driven is the SECTION half. */
  run("S.annotatorId = 'ann_001'; S.annotators = [{ id: 'ann_001', name: 'A' }];");
  run("requireAnnotator = () => true; requireIdentity = () => true;");
  run("secEditReadTitles = () => {};");
  run(`secEditReset();
       _secEdit[0].absorbed.push(_secEdit[1].si);
       _secEdit.splice(1, 1);`);
  run("saveDocument();");

  const secs = run('JSON.stringify(doc().sections.map(s => s.id))');
  check(secs === '["d1.sec_001"]', 'the two sections became one',
        `         got ${secs}`);
  const paras = JSON.parse(run('JSON.stringify(doc().sections[0].paragraphs.map(p => p.id))'));
  check(paras.length === 2, 'holding both paragraphs', JSON.stringify(paras));
  check(paras[1] === 'd1.sec_002.p_001',
        'and the absorbed one KEEPS ITS ID, naming a section that no longer exists',
        '         renaming it would break word.head, the journal and every\n'
      + '         by-id map to preserve an appearance (B-135)');

  /* The rule is only safe because nothing resolves by prefix. Asked of the
     index, which is what everything actually resolves through. */
  const w = JSON.parse(run("JSON.stringify((() => { const r = S.wordById.get('d1.sec_002.p_001.s_001.w_001');"
                         + " return r ? { sect: r.sect.id, sectIdx: r.sectIdx } : null; })())"));
  check(w && w.sect === 'd1.sec_001' && w.sectIdx === 0,
        'and every word under it resolves to the section it is NOW in',
        `         got ${JSON.stringify(w)} — the index is rebuilt on a structural\n`
      + '         save (B-175); a stale sectIdx here is a phantom hit');

  const note = ctx.__logged.find(l => /former parent/.test(l[1]));
  check(!!note, 'the merge SAYS a paragraph now names a former parent',
        `         logged: ${JSON.stringify(ctx.__logged.map(l => l[1]))}\n`
      + '         silence is what left this to be found by a sweep of the file');
  check(note && note[0] === 'info',
        'at info, because nothing is wrong',
        '         a warning would say the corpus is damaged, and it is not');
  check(note && /d1\.sec_002\.p_001/.test(note[2]) && /B-135/.test(note[2]),
        'naming what moved, and the rule that says why it kept its id',
        `         ${note ? note[2] : '(none)'}`);

  /* A PARAGRAPH GOING HOME is not a reparent, and this is the case the first
     draft of the guard missed: reporting every absorbed paragraph passed all of
     the above, because in the fixture none of them belonged to the absorbing
     section already. Merge B into A, then A back into B, and a paragraph named
     `A.p_001` arrives in A — where it belongs. Saying it "now names a former
     parent" would be false, and a report that is sometimes false is one that
     gets ignored. */
  ctx.__home = {
    id: 'd2', metadata: { title: 't' },
    sections: [
      { id: 'd2.sec_001', title: 'A', paragraphs: [] },
      { id: 'd2.sec_002', title: 'B', paragraphs: [
        { id: 'd2.sec_001.p_001', sentences: [] },   // already A's, sitting in B
        { id: 'd2.sec_002.p_001', sentences: [] }] },
    ],
  };
  run("applyCorpus([__home], 'b198c'); buildCorpusIndex(); __logged = [];");
  run(`secEditReset();
       _secEdit[0].absorbed.push(_secEdit[1].si);
       _secEdit.splice(1, 1);
       saveDocument();`);
  const home = ctx.__logged.find(l => /former parent/.test(l[1]));
  check(!!home, 'merging back still reports the paragraph that is not home');
  check(home && /d2\.sec_002\.p_001/.test(home[2]),
        'naming the one that moved away from its own section',
        `         ${home ? home[2] : '(none)'}`);
  check(home && !/d2\.sec_001\.p_001/.test(home[2]),
        'and NOT the one that just went home',
        `         ${home ? home[2] : '(none)'} — it names the section it is now in,\n`
      + '         so calling it a former parent is simply false');

  /* And it stays quiet when nothing moved, or the log fills with a line that
     means nothing on every document save. */
  ctx.__doc2 = JSON.parse(JSON.stringify(DOC));
  run("applyCorpus([__doc2], 'b198b'); buildCorpusIndex(); __logged = [];");
  run("secEditReset(); saveDocument();");
  check(!ctx.__logged.some(l => /former parent/.test(l[1])),
        'and says nothing when no paragraph changed parent',
        `         logged: ${JSON.stringify(ctx.__logged.map(l => l[1]))}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
