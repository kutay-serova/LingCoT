#!/usr/bin/env node
/* =============================================================================
   render_smoke_test.js, does every view actually render?
   Run:  node dev/tests/render_smoke_test.js
   =============================================================================
   B-102. Twice now a declaration has been deleted and its readers left behind:
   B-081 removed `requiredMark()` and left seven call sites, B-101 removed
   `const isLemma` and left two. Both reached the annotator as a whole view that
   would not draw, because a ReferenceError inside a template literal aborts the
   entire string. `undefined_call_test.js` catches the first shape and cannot
   catch the second: it checks CALLS, and a bare identifier is invisible to it.

   B-102 rejected a wider static check for a good reason — deciding whether an
   identifier resolves needs scope analysis, and an approximation would either
   miss cases or cry wolf on destructuring and loop variables — and asked for
   this instead. Executing the renderer settles the question rather than
   inferring an answer from the text.

   The proof that it was needed: v3.14.211 deleted `_mHas`, and the only thing
   that noticed was two OTHER guards crashing on it. Nothing was asking whether
   the views still drew.

   WHAT THIS IS NOT. It is not a rendering test. Nothing here looks at the HTML
   beyond whether there is any, because the failure being caught is an
   exception. A renderer that produces beautiful wrong markup passes, and should:
   that is the job of the guards that read what it produced.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, requireCompanion, loadCorpus, loadCompanion } = require('./_fixture.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

/* The page has been painted by the time a view renders, so every id resolves.
   boot_smoke_test.js uses the same harness with the opposite rule; see _dom.js. */
const sources = appSources();
const ctx = makeCtx({ hasId: () => true });
const bootErrs = loadApp(ctx, sources);
if (bootErrs.length) {
  for (const [label, err] of bootErrs) console.log(`  FAIL ${label}: ${err.message}`);
  console.log('\n  the app does not boot, so no view can be rendered');
  console.log('\n  0 passed, 1 failed');
  process.exit(1);
}

const run = expr => vm.runInContext(expr, ctx);
/* B-128: one parse for the suite. This guard feeds the app's OWN loaders, so
   it passes `.records` — the file as written, format lines included, which is
   what applyCorpus expects to receive. */
/* v3.14.386: by KIND, not one loader for all three. `loadCorpus` reports a row
   it cannot place as an undeclared format record, so pointing it at a dictionary
   printed four NOTE lines every run about `dict_entry`, `lemma`, `annotator` and
   `source` — none of them a problem, all of them noise, and noise in the one
   channel that exists to name a real one. `.records` is the same either way,
   which is why this was invisible for so long. */
const jsonl = f => (/_corpus\.jsonl$/.test(f) ? loadCorpus(f) : loadCompanion(f)).records;

/* ── Real data, through the real loaders ─────────────────────────────────────
   A hand-built S would drift from what the app actually holds, and the defects
   this is looking for live in the branches that only real data reaches: a word
   with morphemes, an entry with a lemma, a sentence with a dependency parse. */
const corpusPath = requireCorpus('turkish', 'render smoke');
const dictPath   = requireCompanion(corpusPath, 'dictionary');
const partPath   = requireCompanion(corpusPath, 'participants');

ctx.__corpus = jsonl(corpusPath);
ctx.__dict   = jsonl(dictPath);
ctx.__parts  = jsonl(partPath);
run("applyCorpus(__corpus, 'smoke');");
run("applyDict(__dict, 'smoke');");
run(`S.annotators = __parts.filter(p => p.record_type !== 'source');
     S.sources    = __parts.filter(p => p.record_type === 'source');
     _rebuildParticipantMaps();`);
check(run('S.docs.length > 0'), `corpus loaded: ${run('S.docs.length')} document(s)`);
check(run('S.dictionary.length > 0'), `dictionary loaded: ${run('S.dictionary.length')} entries, ${run('S.lemmas.length')} lemmas`);

/* Navigation state deep enough that every view has something to draw. Taken
   from the fixture rather than invented, so an id that does not resolve is a
   failure of the app rather than of the fixture. */
run(`
  S.sectIdx = 0; S.paraIdx = 0;
  const _p = S.docs[0].sections[0].paragraphs[0];
  const _s = _p.sentences[0];
  S.sentId = _s.id;
  S.wordId = (_s.words.find(w => (w.morphemes || []).length) || _s.words[0]).id;
  S.dictEntryId = S.dictionary[0].id;
  S.dictForm = S.dictionary[0].form;
  S.dictNewEntry = { form: 'smoke', gloss: '', translit: '', type: 'word', pos: '', constituentForms: '' };
  _activeAnnotatorId = (S.annotators[0] || {}).id || '';
`);
check(!!run('S.wordId'), `navigation state set (word ${run('S.wordId')})`);

/* ── Every registered view ───────────────────────────────────────────────────
   Read from VIEW_RENDERERS rather than listed here, so a view added later is
   covered without anyone remembering. That is the same rule the field table
   settled everywhere else this month. */
const views = run('Object.keys(VIEW_RENDERERS)');
check(views.length >= 20, `${views.length} registered view(s) to render`,
      'the dispatch table looks smaller than it should — is the read finding it?');

let drew = 0;
for (const v of views) {
  ctx.__view = v;
  let out = null, err = null;
  try { out = run('String(VIEW_RENDERERS[__view]() ?? "")'); }
  catch (e) { err = e; }
  if (err) {
    /* The message a ReferenceError gives is the whole value here: it names the
       identifier nobody defined, which is exactly what the annotator's blank
       screen did not. */
    check(false, `${v} renders`, `${err.constructor.name}: ${err.message}`);
  } else {
    check(true, `${v} renders (${out.length} chars)`);
    if (out.length > 200) drew++;
  }
}

/* A harness in which every renderer silently returns '' would report a clean
   pass while checking nothing, which is this project's recurring failure mode.
   Most views must produce real markup for the run to mean anything. */
check(drew >= Math.ceil(views.length * 0.6),
      `${drew} of ${views.length} views produced substantial markup`,
      'too many rendered almost nothing — the state is probably not reaching them');

/* ── B-185: name the absence that is actually there ────────────────────────
   Reported from use. With no corpus loaded, the section view said "Section not
   found." — which blames the section for the absence of the whole document and
   sends the annotator looking for a section rather than for a corpus. It is the
   message they saw after picking a companion file that loaded nothing (B-184),
   so the two arrived together and only one of them was the cause.

   Derived: every renderer that indexes `sections()[S.sectIdx]` is asked whether
   it checks `doc()` first. A renderer added later is covered without an edit. */
{
  const { read: rd, decomment: dc } = require('./_source.js');
  const src = dc(rd('LingCoT.html'));
  /* The head plus the first 400 characters, not the whole function: a renderer's
     body runs to hundreds of lines and the guard rail is at the TOP of it —
     whether the absence of a document is answered before a section is indexed. */
  const fns = [...src.matchAll(/function\s+(render\w+)\s*\(\)\s*\{/g)]
                .map(m => [m[0], m[1], src.slice(m.index, m.index + 400)])
                .filter(m => /sections\(\)\[S\.sectIdx\]/.test(m[2]));
  check(fns.length > 0, `${fns.length} renderer(s) index a section by position`,
        '       if this finds none the check below asserts nothing');
  for (const [, name, body] of fns) {
    const iDoc = body.search(/if\s*\(!doc\(\)\)/);
    const iSec = body.search(/sections\(\)\[S\.sectIdx\]/);
    check(iDoc !== -1 && iDoc < iSec,
          `${name} asks whether there is a document before it asks for a section`,
          '       otherwise a corpus that was never loaded is reported as a\n'
        + '       missing SECTION, and the annotator looks for the wrong thing');
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
