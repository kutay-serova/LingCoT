#!/usr/bin/env node
/* =============================================================================
   nav_exits_test.js — every navigation lands, and every view can be left
   Run:  node dev/tests/nav_exits_test.js
   =============================================================================
   Two defects reported together at v3.14.359, and they are one story: a door
   that goes to the wrong place, and a wrong place with no way out.

     B-189  The push-to-dictionary panel's "Edit Entry" door called
            `go('dict', { dictForm, entryId })`. `go()` reads `dictEntryId` —
            `entryId` is what the ATTRIBUTE is called, and `resolveGoOpts` in
            events.js is where the two names are reconciled, FOR THE DECLARATIVE
            PATH ONLY. So an imperative caller was a second reader of one
            contract (PRACTICES §4): the named homograph was never surfaced, and
            the dropped `wordId` left `renderDict`'s back target as
            `data-go="word" data-wid=""`.

     B-190  Which landed on `renderWord`'s not-found return: a bare paragraph,
            no header, no back, and a breadcrumb built from the same state that
            had just failed to resolve. Fifteen renderers ended that way. The
            annotator was not told the app was confused; they were parked.

   BOTH CHECKS ARE DERIVED. Section 1 reads the keys `go()` itself consumes, so
   adding a routing option needs no edit here; section 2 finds the renderers by
   their error returns rather than from a list. A list would have to be
   remembered, and neither of these was noticed for as long as it existed.

   Section 3 EXECUTES the exit — PRACTICES §6, a shape is not a behaviour. That
   the helper is called proves nothing about whether what it emits can be
   clicked.
   ============================================================================= */

const vm = require('vm');
const { read, decomment, moduleFiles } = require('./_source.js');
const { appSources, makeCtx, loadApp, stubEl } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const htmlSrc = read('LingCoT.html');
const eventsSrc = read('modules/events.js');
const html = decomment(htmlSrc);
const js   = decomment([htmlSrc, ...moduleFiles().map(([, c]) => c)].join('\n'));

console.log('\n1 · every go() call passes keys the router reads');

/* What `go()` actually consumes, from `go()`. `opts.X` covers every assignment
   in its body; the two it reads for logging are included by the same scan. */
const body = (js.match(/function go\(view, opts = \{\}\)\s*\{[\s\S]*?\n\}/) || [''])[0];
check(body.length > 0, 'go() found in the source');
const KNOWN = new Set([...body.matchAll(/opts\.([A-Za-z_]\w*)/g)].map(m => m[1]));
check(KNOWN.size >= 8, `${KNOWN.size} routing keys read by go(): ${[...KNOWN].sort().join(', ')}`);

/* Every imperative call with an object literal. Shorthand (`{ entryId }`) is
   the shape B-189 arrived in, so it is matched as carefully as `k: v`. */
const badCalls = [];
for (const [file, src] of [['LingCoT.html', html], ...moduleFiles().map(([f, c]) => [f, decomment(c)])]) {
  for (const m of src.matchAll(/\bgo\(\s*(?:'[a-z-]+'|`[^`]*`|[A-Za-z_]\w*)\s*,\s*\{([^{}]*)\}/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    for (const k of m[1].matchAll(/(?:^|,)\s*([A-Za-z_]\w*)\s*(?::|,|$)/g)) {
      const key = k[1];
      if (!KNOWN.has(key)) badCalls.push({ file, line, key });
    }
  }
}
check(badCalls.length === 0,
      'no go() call passes a key the router ignores',
      badCalls.map(c => `         ${c.file}:${c.line} — go(…, { ${c.key} }) is never read`).join('\n')
    + '\n         `go()` assigns every field it knows and NULLS the rest, so an\n'
    + '         unread key is silently dropped AND the field it meant is cleared');

/* The door that started it: leaving by it must carry the word it was opened
   over, or `renderDict` builds a back target with an empty id. */
const door = html.match(/data-action="pk-edit-entry"\][\s\S]{0,900}?\}\)\);/);
check(!!door, 'the Edit Entry door is wired');
/* The keys must be in the go() CALL, not merely somewhere in the handler. The
   first version of this check searched the whole block and a mutation that
   dropped both from the call still passed, because the line that reads them out
   of S mentions them by name. */
const doorGo = door && door[0].match(/go\(\s*'dict'\s*,\s*\{([^{}]*)\}/);
check(!!doorGo, 'it leaves by go(\'dict\', …)');
for (const key of ['dictEntryId', 'wordId', 'sentId'])
  check(doorGo && new RegExp(`(^|,)\\s*${key}\\s*(:|,|$)`).test(doorGo[1]),
        `it carries ${key} through to go()`,
        `         got: go('dict', {${doorGo ? doorGo[1] : '?'}})\n`
      + '         renderDict builds its back target from S.wordId / S.sentId, and\n'
      + '         go() NULLS every field its opts do not name');

console.log('\n2 · no view renderer ends in a page with no exit');

/* An error return that is only a paragraph. `deadEndHtml` is the one way to
   write one now, so this looks for the shape it replaced. */
const stranded = [];
for (const m of html.matchAll(/return\s+`<p>\$\{(?:esc\()?t\('(status\.error\.[a-z_.]+)'/g)) {
  const line = html.slice(0, m.index).split('\n').length;
  stranded.push({ line, key: m[1] });
}
check(stranded.length === 0,
      'every status.error return goes through deadEndHtml',
      stranded.map(s => `         LingCoT.html:${s.line} — ${s.key} returned as a bare <p>`).join('\n')
    + '\n         the annotator lands on a message with no header, no back and an\n'
    + '         empty breadcrumb, because the breadcrumb reads the state that failed');

const uses = [...html.matchAll(/return deadEndHtml\('/g)].length;
check(uses >= 15, `${uses} renderers use it (B-190 converted 15)`,
      '         fewer means one has been written by hand again');

console.log('\n3 · executed: the exit it emits is one the app can follow');

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));

/* With no document there is nowhere in the corpus to go, and offering a link to
   section 0 of a corpus that is not open would be a second broken door. */
const bare = String(ctx.deadEndHtml('status.error.word_not_found'));
check(!/data-go/.test(bare),
      'with no corpus open it offers no link',
      '         a back button into a corpus that is not loaded is B-189 again');

/* With one, it must offer a target the delegated [data-go] listener can resolve.
   Reached through `vm.runInContext`, because `S` is a module-scope `const` and
   so is not a property of the context — the same reason `outcomeHistory()`
   exists next door. Loaded through `applyCorpus`, the app's own door, rather
   than by assigning the fields this guard imagines it sets: the word index that
   `findWord` reads is built there, and a fixture poked in by hand would be
   testing the guard's idea of the state instead of the app's. */
const run = expr => vm.runInContext(expr, ctx);
ctx.__docs = [{
  id: 'doc1', metadata: { title: 't' },
  sections: [{ id: 's1', title: 's', paragraphs: [{ id: 'p1', sentences: [
    { id: 'sent1', text: 'a b', words: [{ id: 'w1', form: 'a' }, { id: 'w2', form: 'b' }] }] }] }],
}];
run("applyCorpus(__docs, 'nav-exits');");
check(run('!!doc()'), 'the fixture document is loaded through applyCorpus',
      '         the checks below would be measuring the no-corpus branch');
check(run("!!findWord('w1')"), 'and its words are indexed',
      '         the stale-position check below needs a position that DOES resolve');

run('S.corpusReturn = null;');
const fallback = String(ctx.deadEndHtml('status.error.word_not_found'));
check(/data-go="section"/.test(fallback) && /data-si="0"/.test(fallback),
      'with no recorded position it falls back to section 0',
      `         got: ${fallback.slice(0, 160)}`);

run("S.corpusReturn = { view: 'word', sectIdx: 0, paraIdx: 0, sentId: 'sent1', wordId: 'w1' };");
const recorded = String(ctx.deadEndHtml('status.error.word_not_found'));
check(/data-go="word"/.test(recorded) && /data-wid="w1"/.test(recorded),
      'with one, it returns there',
      `         got: ${recorded.slice(0, 200)}`);

/* A STALE position must not be offered: it would move the annotator from one
   dead end to another, which is the failure this helper exists to end. */
run("S.corpusReturn = { view: 'word', sectIdx: 0, paraIdx: 0, sentId: 'sent1', wordId: 'gone' };");
const stale = String(ctx.deadEndHtml('status.error.word_not_found'));
check(/data-go="section"/.test(stale) && !/data-wid="gone"/.test(stale),
      'a recorded position that no longer resolves is not offered',
      `         got: ${stale.slice(0, 200)}`);

/* And never back into the dictionary: the dict views record no position of
   their own, so returning to one is how a loop starts. */
run("S.corpusReturn = { view: 'dict-browse', sectIdx: 0 };");
const fromDict = String(ctx.deadEndHtml('status.error.dict_entry_not_found'));
check(!/data-go="dict/.test(fromDict),
      'a dict view is never the way out of a dict error');

/* The message is still there. An exit that replaced the explanation would trade
   one silence for another. */
check(/<p>/.test(recorded) && recorded.indexOf('<p>') > recorded.indexOf('back-btn'),
      'the message is kept, below the way out');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
