#!/usr/bin/env node
/* =============================================================================
   session_panel_test.js. D34 stages C and D — the panel, and what changed
   Run:  node dev/tests/session_panel_test.js
   =============================================================================
   Executed, not read. The app is booted in the same harness `render_smoke_test`
   uses and the real corpus is loaded through the real loaders, because the two
   claims that matter are behavioural and neither can be inferred from the text:

     · LOADING IS NOT EDITING. `applyCorpus` runs before an annotator has
       touched anything; if it reaches the session record, the panel opens by
       claiming they edited the whole corpus. That is the failure this half is
       one line away from at all times, and only running it settles it.
     · A ROW GOES SOMEWHERE. The queue's whole shape is "count, verb, and a way
       in". A row whose id does not resolve is a dead end that looks like a
       feature, so the ids the counter collects are checked against the indexes
       `navGo` will look them up in.

   The DOM stub hands out a fresh element per getElementById, so `renderGapPanel`
   writing innerHTML would be unobservable. One cache is added below — the
   smallest change that lets the thing under test be read back, rather than a
   second DOM.
   ============================================================================= */

const vm = require('vm');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const { requireCorpus, requireCompanion, loadCorpus } = require('./_fixture.js');
const { read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const sources = appSources();
const ctx = makeCtx({ hasId: () => true });

/* One element per id, so what a render writes can be read. Nothing else about
   the stub changes; this is not a DOM, it is a memory. */
const _els = new Map();
const _mk = ctx.document.getElementById;
ctx.document.getElementById = id => {
  if (!_els.has(id)) _els.set(id, _mk(id));
  return _els.get(id);
};

const bootErrs = loadApp(ctx, sources);
if (bootErrs.length) {
  for (const [label, err] of bootErrs) console.log(`  FAIL ${label}: ${err.message}`);
  console.log('\n  the app does not boot, so the panel cannot be rendered\n');
  console.log('0 passed, 1 failed\n');
  process.exit(1);
}
const run = expr => vm.runInContext(expr, ctx);

/* The harness does not run the pywebview loader, so `_LOCALE` is empty and
   `t()` returns the key — which would make every rendered string look like a
   missing one. Loading en.json here is what turns "did it draw" into "did it
   draw ENGLISH", and that is a check `locale_key_test` cannot make for
   `gap.name.<kind>`: the key is built at runtime from a level or record kind,
   which is exactly the shape its DYNAMIC_PREFIXES list exempts. */
ctx.__locale = JSON.parse(read('resources/locale/en.json'));
run('_LOCALE = __locale;');
check(Object.keys(ctx.__locale).length > 500,
      `locale loaded: ${Object.keys(ctx.__locale).length} strings`);

const corpusPath = requireCorpus('turkish', 'the progress panel');
ctx.__corpus = loadCorpus(corpusPath).records;
ctx.__dict   = loadCorpus(requireCompanion(corpusPath, 'dictionary'), null, false).records;
run("applyCorpus(__corpus, 'panel');");
run("applyDict(__dict, 'panel');");
/* The fixture is mutated in place below (a word is deleted from an index to
   reach the unresolved-id branch), so the queue half re-loads rather than
   inheriting a corpus the session half took apart. */
run("__reindex = () => { applyCorpus(__corpus, 'panel'); applyDict(__dict, 'panel'); _sessionIds.clear(); };");
check(run('S.docs.length > 0'), `corpus loaded: ${run('S.docs.length')} document(s)`);

/* ── D · what changed this session ───────────────────────────────────────────── */
console.log('\nthis session');
{
  check(run('sessionChanges().total') === 0,
        'loading a corpus is not editing it — the session record is empty after applyCorpus',
        `         ${run('JSON.stringify(sessionChanges().total)')} ids recorded by the load`);

  /* Through `mutate`, which is the documented way any save path says what it
     wrote — not by poking the map, which would test the guard's own idea of it. */
  run("__w = [...S.wordById.values()][0].word; mutate('corpus', [__w]);");
  let c = run('sessionChanges()');
  check(c.total === 1 && c.edited.get('word') === 1,
        'one edited word is one edited word', `         ${JSON.stringify(c)}`);

  run("mutate('corpus', [__w]);");
  check(run('sessionChanges().total') === 1,
        'editing it twice is still one — the panel counts records, not saves');

  /* The rule the first-write-wins check actually enforces, which counting alone
     cannot show: a record CREATED this session and then edited is still an
     addition. "Created and then edited twice" is one fact about it, and the
     interesting half is the creation. */
  run(`_sessionIds.clear();
       __d = S.dictionary[1];
       mutate('dict', [{ rec: __d, parent: {}, index: 0 }]);
       mutate('dict', [__d]);`);
  check(run("sessionChanges().added.get('dict_entry')") === 1
        && run('sessionChanges().edited.size') === 0,
        'a record added and then edited is still an addition, not an edit');

  /* Two ways a removal reaches the panel, and they are different code:
     the journalled `del`, and an id that no longer resolves. Both are checked,
     because a fixture that did both at once would let either one carry it. */
  run(`_sessionIds.clear();
       mutate('corpus', [__w]);
       mutate('corpus', [{ del: __w.id }]);`);
  c = run('sessionChanges()');
  check(c.removed === 1 && c.edited.size === 0,
        'a journalled removal reports as removed even while the id still resolves',
        `         ${JSON.stringify(c)}`);

  run(`_sessionIds.clear();
       mutate('corpus', [__w]);
       S.wordById.delete(__w.id);`);
  c = run('sessionChanges()');
  check(c.removed === 1 && c.edited.size === 0,
        'and an id that no longer resolves is removed rather than dropped — '
      + 'a record deleted by a path that journalled nothing is still gone',
        `         ${JSON.stringify(c)}`);
  run('__reindex();');

  /* Added and removed inside one session is a false start, not a change: no
     one else ever saw the record, and reporting it would be reporting nothing. */
  run(`_sessionIds.clear();
       __n = { id: 'x-new-1' };
       mutate('corpus', [{ rec: __n, parent: {}, index: 0 }]);
       mutate('corpus', [{ del: __n.id }]);`);
  check(run('sessionChanges().total') === 0,
        'added and then removed in the same session is neither');

  /* B-159: the containers have no flat index, so before v3.14.320 a document,
     section or paragraph id resolved to nothing and reported as a REMOVAL.
     `saveDocument` journals the document and its retitled sections, so retitling
     a corpus said "removed 1" — and it had said so since stage D shipped. */
  for (const [what, expr] of [
    ['document',  'doc()'],
    ['section',   'doc().sections[0]'],
    ['paragraph', 'doc().sections[0].paragraphs[0]'],
  ]) {
    run(`_sessionIds.clear(); mutate('corpus', [${expr}]);`);
    const c2 = run('sessionChanges()');
    check(c2.removed === 0 && c2.edited.get(what) === 1,
          `a ${what} save reports as an edited ${what}, not as a removal`,
          `         ${JSON.stringify({ edited: [...c2.edited], removed: c2.removed })}`);
  }

  run(`_sessionIds.clear();
       __e = S.dictionary[0];
       mutate('dict', [{ rec: __e, parent: {}, index: 0 }]);`);
  c = run('sessionChanges()');
  check(c.added.get('dict_entry') === 1,
        'a kind is resolved through the indexes, so a dictionary entry says so',
        `         ${JSON.stringify(c)}`);
  run('_sessionIds.clear();');
}

/* ── C · the queue ───────────────────────────────────────────────────────────── */
console.log('\nthe queue');
{
  const rows = run('gapRows()');
  check(rows.live.length > 0 && rows.settled.length > 0,
        `${rows.live.length} live row(s), ${rows.settled.length} settled`);

  const desc = rows.live.every((r, i) => i === 0 || rows.live[i - 1].missing >= r.missing);
  check(desc, 'ranked by size, biggest first',
        `         ${rows.live.map(r => `${r.level}.${r.key}=${r.missing}`).join(' ')}`);

  check(rows.live.every(r => r.applies && r.missing > 0),
        'nothing settled reaches the queue');
  check(rows.settled.every(r => !r.applies || r.missing === 0),
        'and nothing live is hidden in the fold');

  /* Ids only where there is somewhere to go, which is what makes them cheap. */
  const navigable = rows.live.filter(r => run('_GAP_NAV')[r.level]);
  check(navigable.length > 0 && navigable.every(r => (r.ids || []).length > 0),
        `${navigable.length} navigable row(s), each carrying ids`);
  check(rows.live.filter(r => !run('_GAP_NAV')[r.level]).every(r => !r.ids),
        'and a row with nowhere to go pays for none — ids are the expensive half');

  /* The ids must resolve where navGo will look them up, or the row is a dead
     end that looks like a feature. */
  const dead = [];
  for (const r of navigable) {
    ctx.__ids = r.ids;
    const kind = run('_GAP_NAV')[r.level];
    const bad = run(`__ids.filter(id => !${kind === 'word' ? 'S.wordById' : 'S.sentById'}.has(id))`);
    if (bad.length) dead.push(`${r.level}.${r.key}: ${bad.slice(0, 3).join(', ')}`);
  }
  check(dead.length === 0, 'every id a row offers resolves where navGo will look for it',
        dead.map(x => `         ${x}`).join('\n'));

  /* A morpheme row navigates to the WORD, and says so once per word rather than
     once per morpheme — there is no morpheme view to land on. */
  const mrow = rows.live.find(r => r.level === 'morpheme');
  if (mrow) {
    ctx.__ids = mrow.ids;
    check(run('__ids.every(id => S.wordById.has(id))'),
          'a morpheme row carries word ids — the morpheme rows live in the word editor');
    check(new Set(mrow.ids).size === mrow.ids.length,
          'and no word twice, however many of its morphemes are unfinished',
          `         ${mrow.ids.length} ids, ${new Set(mrow.ids).size} distinct`);
  }
}

/* ── C · what the panel actually says ────────────────────────────────────────── */
console.log('\nrendered');
{
  let threw = null;
  try { run('renderGapPanel()'); } catch (e) { threw = e; }
  check(!threw, 'renderGapPanel() runs', threw && `         ${threw.message}`);
  const html = _els.get('gap-panel-body')?.innerHTML || '';
  check(html.length > 0, `${html.length} characters drawn`);

  check(/gq-row/.test(html), 'the queue is drawn');
  check(!/\bgap\.[a-z_.]+\b/.test(html),
        'and every string resolved — a missing locale key renders as the key itself',
        `         ${(html.match(/\bgap\.[a-z_.]+\b/g) || []).slice(0, 4).join(', ')}`);

  /* The collapsed line is the whole of this design's honesty: it must name each
     row it hides and why, not merely count them. */
  const rows = run('gapRows()');
  const fold = html.slice(html.indexOf('gq-fold'));
  const unnamed = rows.settled.filter(r => !fold.includes(r.key.replace(/_/g, ' '))
                                        && !new RegExp(r.key, 'i').test(fold)
                                        && !fold.includes(run(`t(labelKeyOf('${r.level}','${r.key}'))`)));
  check(unnamed.length === 0,
        `the fold names all ${rows.settled.length} settled rows, not just their number`,
        unnamed.map(r => `         ${r.level}.${r.key}`).join('\n'));
  check(/not applicable|done|nothing to fill in|no records/.test(fold),
        'and gives each one a reason');

  /* A field's editor LABEL is not its name in a sentence: `label.editor.sources`
     is "Source(s)", which read as "3 sections need a source(s)" the first time
     this was drawn. Every counted field needs a sentence name, and a field added
     to the counter without one must fail here rather than reach an annotator
     reading badly. */
  const unnamed2 = [];
  for (const lvl of run('_GAP_LEVELS'))
    for (const key of run(`countedKeys('${lvl}')`)) {
      const k = `gap.field.${key}`;
      // its own string, or a label the app lowercases (_INLINE_LABEL)
      if (ctx.__locale[k] === undefined && !run(`_INLINE_LABEL['${k}']`))
        unnamed2.push(`${lvl}.${key} → ${k}`);
    }
  check(unnamed2.length === 0,
        'every counted field has a name for the sentence, not only a label for its box',
        unnamed2.map(x => `         ${x}`).join('\n'));
  /* And the rows actually USED those names — asserted by value rather than by a
     spelling rule, because "gloss" ends in an s and "part of speech" does not
     begin with a capital, so any pattern for "looks like a label" is wrong in
     both directions. */
  const fieldKeys = new Set([...Object.keys(ctx.__locale), ...Object.keys(run('_INLINE_LABEL'))]
    .filter(k => k.startsWith('gap.field.')));
  const names = new Set([...fieldKeys].map(k => run(`tInline('${k}')`)));
  const drawn = [...html.matchAll(/needs? a ([^<]+)/g)].map(m => m[1].trim());
  const strays = drawn.filter(n => !names.has(n));
  check(drawn.length > 0 && strays.length === 0,
        `all ${drawn.length} rows name the field the way a sentence needs it`,
        strays.map(x => `         "${x}" is not a gap.field.* value`).join('\n'));
}

/* ── D34 stage E · the toggle, end to end ────────────────────────────────────
   Executed through `setTracked`, the function the panel's own handler calls, so
   what is tested is the door the × and the Track button actually use. */
console.log('\nturning fields on and off');
{
  const rows0 = run('gapRows()');
  const has = (rs, l, k) => rs.some(r => r.level === l && r.key === k);
  check(has(rows0.untracked, 'sentence', 'deps'),
        'the fold offers the dependency parse, which is off by default');
  check(!has(rows0.live, 'sentence', 'deps') && !has(rows0.settled, 'sentence', 'deps'),
        'and it is in neither the queue nor the settled list until asked for');

  run("setTracked('sentence', 'deps', true);");
  const rows1 = run('gapRows()');
  const dep = rows1.live.find(r => r.level === 'sentence' && r.key === 'deps');
  check(!!dep && dep.missing > 0,
        `turned on, it reports ${dep ? dep.missing : '—'} sentence(s) needing a parse`,
        '         the queue did not pick it up');
  check(!has(rows1.untracked, 'sentence', 'deps'),
        'and it leaves the fold — the two lists are one set, not two');

  /* Stored as an OVERRIDE, which is the design decision this guard exists for.
     A resolved list would silently miss a `core` field added to the table
     later; a difference keeps deriving the default forever. */
  const meta = run('doc().metadata.tracked');
  check(JSON.stringify(meta) === '{"on":["sentence.deps"]}',
        'stored as the difference from the default, not as the resolved list',
        `         got ${JSON.stringify(meta)}`);

  /* Turning a DEFAULT-ON field off, then back on, must leave nothing behind —
     an override restating the default is a claim about the table that goes
     wrong the day the table changes. */
  run("setTracked('sentence', 'words', false);");
  check(JSON.stringify(run('doc().metadata.tracked.off')) === '["sentence.words"]',
        'a default turned off is recorded');
  check(!run("gapRows().settled.concat(gapRows().live).some(r => r.level==='sentence' && r.key==='words')"),
        'and stops being counted');
  run("setTracked('sentence', 'words', true);");
  /* The WHOLE object, not just the `off` key: cancelling by moving the entry to
     `on` would leave an override restating the default, which is the failure
     this is about. Asserting one half let exactly that mutation through. */
  check(JSON.stringify(run('doc().metadata.tracked')) === '{"on":["sentence.deps"]}',
        'and returning it to the default cancels the override rather than restating it',
        `         got ${JSON.stringify(run('doc().metadata.tracked'))}`);

  /* A stored file can name anything — hand-edited, or written by a later version
     that declared more fields. An override must not be able to make the tracker
     count `field_prov`. */
  run(`doc().metadata.tracked = { on: ['sentence.field_prov', 'sentence.text',
                                       'word.dict_id', 'sentence.deps'] };
       _gapCache.gen = -1;`);
  const forced = run("trackedKeys('sentence')");
  check(!forced.includes('field_prov') && !forced.includes('text'),
        'an override naming a derived or identity field is ignored, not honoured',
        `         got ${JSON.stringify(forced)}`);
  check(!run("trackedKeys('word')").includes('dict_id'),
        'and the same at word level — the tracker is not a way to count what the app wrote');
  check(forced.includes('deps'), 'while a trackable one in the same list still works');
  run("doc().metadata.tracked = { on: ['sentence.deps'] }; _gapCache.gen = -1;");

  /* It rides the corpus file, so it survives a reload — the point of storing it
     on the document rather than in the session. */
  const before = run('JSON.stringify(doc().metadata.tracked)');
  run("__c2 = [JSON.parse(JSON.stringify(doc()))]; applyCorpus(__c2, 'reload');");
  check(run('JSON.stringify(doc().metadata.tracked)') === before,
        'and survives a reload of the corpus it is stored in');

  const html2 = (() => { run('renderGapPanel()'); return _els.get('gap-panel-body').innerHTML; })();
  check(/data-action="gap-untrack"/.test(html2) && /data-action="gap-track"/.test(html2),
        'the panel draws both doors — an × on a live row, Track in the fold');
  /* A <button> inside a <button> is invalid markup and the inner click never
     arrives — the × would render and do nothing. Checked by looking for a second
     `<button` before the first one closes, rather than for adjacency: the first
     spelling of this passed against markup that nested them three spans deep. */
  check(!/<button(?:(?!<\/button>)[\s\S])*<button/.test(html2),
        'and the × is a sibling of the row, not a button inside a button');
  run("setTracked('sentence', 'deps', false); _sessionIds.clear();");
}

/* ── wiring ──────────────────────────────────────────────────────────────────── */
console.log('\nwiring');
{
  const html = read('LingCoT.html');
  /* Comments stripped, v3.14.350. The checks below walk selector/body pairs, and
     a comment above a rule is swallowed into the selector half — so a comment
     that names an id makes the rule beneath it look as though it covers that id,
     and one that spans lines is read as several selectors of its own. Both
     happened the moment a comment was written above the shared panel rule. */
  const css  = read('LingCoT.css').replace(/\/\*[\s\S]*?\*\//g, '');

  check(/id="gaps-btn"/.test(html) && /id="gap-panel-box"/.test(html),
        'the header button and the panel are both in the shell');
  check(/getElementById\('gaps-btn'\)\.classList\.add\('visible'\)/.test(html),
        'and the button is revealed when a corpus loads');
  check((html.match(/getElementById\('gaps-btn'\)\.classList\.add\('visible'\)/g) || []).length === 2,
        'on BOTH paths that load one — open, and new corpus',
        '         one of the two reveal sites was missed');

  /* The [data-action] switch is bound to #content and the panel is a sibling of
     it, so a row's click would never reach that switch. */
  check(/getElementById\('gap-panel-box'\)\?\.addEventListener/.test(html),
        'the panel has its own delegated listener, not the #content one');
  check(/if \(!document\.getElementById\('gap-panel-box'\)\?\.hidden\) renderGapPanel\(\);/.test(html),
        'and an open panel is refreshed from mutate(), where every data change already passes');
  check(/if \(gp && !gp\.hidden\) \{ closeGapPanel\(\); return; \}/.test(html),
        'Escape closes it before anything else it might be over');

  check(/#gap-panel-box/.test(css) && /\.gq-row \{/.test(css),
        'the panel is styled');
  /* B-001: a <button> does not inherit colour, which is how black-on-dark got
     shipped. Every clickable row here is a button. */
  const rowRule = css.slice(css.indexOf('.gq-row {'), css.indexOf('.gq-row:hover'));
  check(/color:\s*var\(--/.test(rowRule),
        'and the row button sets its own colour — B-001 is a button that did not');

  /* ── B-162: a box whose height comes from the data must be scrollable ────────
     `#gap-panel-box` shared the modal rule — `overflow: hidden`, no height — and
     that rule is safe for its three neighbours only because each holds a fixed
     number of rows. This one's height is a function of the field table and of
     how many fields the annotator tracks, so v3.14.319's ~13 untracked rows put
     the fold off the bottom of the screen with nothing to scroll.

     The guard inverts the burden rather than listing the offender: EVERY id on
     the shared rule either declares a max-height and an overflow-y, or is named
     below with the reason it does not need one. A box added to that rule without
     being classified fails here — which is the failure that would otherwise wait
     for someone to open a fold on a large corpus. */
  {
    /* Found by what it DOES, not by its literal text: the rule that positions
       several boxes at once and clips them. A guard that matched the selector
       string would break the day someone reorders it, and break silently in the
       direction of passing. */
    const shared = [...css.matchAll(/([^{}]*#gap-panel-box[^{}]*)\{([^}]*)\}/g)]
      .find(m => /position:\s*fixed/.test(m[2]) && m[1].includes(','));
    check(!!shared, 'the shared modal rule positions #gap-panel-box with its neighbours',
          '         no multi-selector rule sets position:fixed on it — re-read the CSS');
    const selectors = (shared ? shared[1] : '').split(',').map(x => x.trim()).filter(Boolean);
    check(/overflow:\s*hidden/.test(shared ? shared[2] : ''),
          'and it still clips, which is what makes the classification necessary');

    /* Fixed content: these show the same rows every time they open, so their
       height cannot be surprised by a corpus. Each is a claim someone has to
       re-check if that stops being true. */
    const FIXED = {
      '#save-panel-box': 'three save targets, one row each',
      '#ncs-box':        'a new-corpus form with a fixed set of fields',
      '#mf-box':         'the missing-companion notice, one paragraph and two buttons',
    };
    const ownRules = sel => {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [...css.matchAll(new RegExp(`(^|,|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'gm'))]
        .map(m => m[2]).join(' ');
    };
    for (const sel of selectors) {
      if (FIXED[sel]) { pass++; console.log(`  ok   ${sel} is exempt: ${FIXED[sel]}`); continue; }
      check(/max-height:/.test(ownRules(sel)),
            `${sel} declares a max-height — its length comes from the data`,
            '         a centred box that outgrows the viewport goes off BOTH edges,\n'
          + '         so there is nothing left on screen to scroll with.\n'
          + '         If its content is fixed, say so in FIXED here and say why.');
    }
    /* A stale exemption is worse than none: it says a box was considered when it
       is no longer there to consider. */
    const stale = Object.keys(FIXED).filter(k => !selectors.includes(k));
    check(stale.length === 0, 'and every exemption still names a box on that rule',
          `         ${stale.join(', ')} is exempted and is not there`);

    /* The header must not scroll away with the content, or closing the panel
       means scrolling back up to find the button. */
    const gapBody = css.slice(css.indexOf('#gap-panel-box .sp-body'));
    check(/overflow-y:\s*auto/.test(gapBody.slice(0, 200)),
          'the BODY scrolls, not the box — the header and its close button stay put');
    check(/min-height:\s*0/.test(gapBody.slice(0, 200)),
          'and it may shrink below its content, which a flex child does not do by default',
          '         min-height: auto is the usual reason an overflow-y inside a flex column does nothing');
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
