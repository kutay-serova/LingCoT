#!/usr/bin/env node
/* =============================================================================
   tag_control_test.js, the tag control asserts nothing about a language
   Run:  node dev/tests/tag_control_test.js
   =============================================================================
   D45. The POS and type control showed six of eighteen tags, twelve behind an
   unlabelled `…`, and WHICH six was written into a constant:
   POS_VISIBLE_DEFAULT said NOUN·PROPN·PRON·VERB·ADJ·ADV for every language the
   app would ever open. POS_VISIBLE_MORPH existed because that claim fails on
   the first agglutinative corpus. Six such constants existed.

   The thing this guard defends is not a layout. It is that the app does not
   assert which categories a language has. So it checks the constants are gone
   and cannot come back, that the shipped scope values stay minimal, and that
   grouping is DATA rather than code — a project may group its own tags, and the
   default groups by a count of the file on disk, which asserts nothing.

   Open versus closed class is the arrangement to watch for: it is the obvious
   one to reach for and it is false for the pronoun systems of Japanese, Thai
   and Khmer, which are the languages this tool exists for.
   ============================================================================= */

const fs = require('fs');
const path = require('path');
const { read, moduleFiles, decomment, SRC, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = decomment(read('LingCoT.html'));
const mods = moduleFiles();
const all  = decomment([read('LingCoT.html'), ...mods.map(m => m[1])].join('\n'));
const tags = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'pos_tags.json'), 'utf8'));

/* ── The six constants are gone, and no seventh has appeared ─────────────── */
const visibleConsts = [...all.matchAll(/\b(POS|TYPE)_VISIBLE_\w+/g)].map(m => m[0]);
check(visibleConsts.length === 0,
      'no hand-curated "which tags are common" constant survives',
      [...new Set(visibleConsts)].join(', '));

/* The same claim can return under any name: a literal array of tag strings
   assigned to a const is what one looks like. POS_CHOICES and TYPE_CHOICES are
   the full pools and are the exception. */
/* Anchored at line start and limited to the SCREAMING_CASE these constants all
   used: stripping block comments can otherwise join a `const` on one side to a
   word on the other and invent a match. */
const tagLiterals = [...html.matchAll(/^(?:const|let)\s+([A-Z][A-Z0-9_]+)\s*=\s*\[\s*'(?:[A-Z]{2,}|word|lemma)'[^\]]*\]/gm)]
  .map(m => m[1])
  .filter(n => !/^(POS_CHOICES|TYPE_CHOICES|SELECTION_STATUSES)$/.test(n));
check(tagLiterals.length === 0,
      'and no new literal tag subset has taken their place',
      tagLiterals.join(', '));

/* ── Scope is minimal, and is what narrows a field ───────────────────────── */
check(tags.every(t => t.scope), 'every shipped tag declares a scope');
const narrowed = tags.filter(t => t.scope !== 'any').map(t => `${t.tag}:${t.scope}`);
check(narrowed.length <= 2,
      'at most two tags are narrowed, and only by their own definition',
      narrowed.join(' · ') + '\n       a root morpheme can be a NOUN; narrowing more is a typology');
check(narrowed.includes('AFFIX:morpheme'), 'AFFIX is bound, so it is morpheme-scoped');
check(/function tagsInScope\(/.test(read('LingCoT.html')), 'tagsInScope is what applies it');
check(/'morpheme'\)/.test(read('LingCoT.html')), 'and a morpheme row asks for morpheme scope');

/* ── Grouping is data, and the default asserts nothing ───────────────────── */
check(!tags.some(t => t.group),
      'the shipped file defines NO display groups',
      'a grouping of parts of speech is an analytic claim; it belongs to the project');
check(/\(POS_META\[tag\] \|\| \{\}\)\.group/.test(read('LingCoT.html')),
      'but a project that sets one is honoured');
check(/label\.tag\.used_here/.test(read('LingCoT.html')),
      'and the fallback groups by what this corpus has used');

/* The rejected arrangement, named so it is not proposed again. */
for (const banned of ['open class', 'closed class', 'content word', 'function word'])
  check(!new RegExp(banned, 'i').test(JSON.stringify(tags)),
        `pos_tags.json does not group by "${banned}"`);

/* ── Positions must be learnable ─────────────────────────────────────────── */
/* The tiers may change membership; the order inside them must not depend on
   usage, or the grid reorders as the annotator works and can never be learned. */
const drawer = /function tagDrawerHtml\([\s\S]*?\n\}/.exec(read('LingCoT.html'));
check(!!drawer, 'tagDrawerHtml is present to be checked');
if (drawer) {
  check(/localeCompare/.test(drawer[0]), 'the drawer sorts alphabetically inside a group');
  check(!/sort\([^)]*usage|usage[^)]*sort\(/.test(drawer[0]),
        'and never by usage, which would reorder the grid as the corpus grows');
}

/* ── The disclosure says how many, because an ellipsis says nothing ──────── */
check(/btn\.tag\.all/.test(read('LingCoT.html')), 'the disclosure is labelled with a count');
check(!/es-expand-btn/.test(all), 'the unlabelled … expander is gone');

/* ── B-084: the export filter draws from the vocabulary, not from a constant ──
   The same defect this guard was written about, one surface along. The dict
   export offered `all` or exactly one type, and the one came from a hard-coded
   `['all', 'word', 'bound.morpheme']` — two of the nine values in TYPE_CHOICES.
   "Words and bound morphemes but not phrases" could not be said at all.

   (The report's own example, excluding lemma shells, had already been settled
   by D35 A2: a lemma is not a dictionary entry any more, so `S.dictionary`
   never contained one. The all-or-one limit was the live half.) */
{
  const { read, fnSrc } = require('./_source.js');
  const html = read('LingCoT.html');

  const dialog = fnSrc('LingCoT.html', 'openDictExportModal') || '';
  check(!/\['all', 'word', 'bound\.morpheme'\]/.test(dialog),
        'the export dialog no longer hard-codes a pair',
        'two of nine, chosen once, for every language the app will ever open');
  check(!/dex-type-filter/.test(html),
        'and the single-choice <select> is gone with it');
  check(/TYPE_CHOICES\.map\(val =>[\s\S]{0,200}?dex-type-cb/.test(dialog),
        'the filter is built from TYPE_CHOICES',
        'a type added to type_choices.json must appear here without an edit');

  /* B-109 ✅ v3.14.371. The same triple survived in `renderDictBrowse`, found by
     this guard while B-084 was being fixed rather than by anyone looking. It was
     asserted as still-present for two versions so that fixing it would fail here
     and force this note to be rewritten rather than left stale — which is what
     happened, and this is the rewrite.

     The fix is the one the note predicted: chipRowHtml's disclosure, not nine
     more chips. So the assertion inverts. The filter is a chip row over the
     whole of TYPE_CHOICES now, and what this checks is that it went through the
     SHARED control rather than growing a second drawer beside it — two writers
     of one thing is rule 4, and a filter that drew its own would be the third
     copy of this triple rather than the end of it. */
  const browse = fnSrc('LingCoT.html', 'renderDictBrowse') || '';
  const filt   = fnSrc('LingCoT.html', 'dictTypeFilterHtml') || '';
  check(!/\['all', 'word', 'bound\.morpheme'\]/.test(browse + filt),
        'the dict-browse filter no longer hard-codes the pair either (B-109)',
        'three of nine, chosen once, for every language the app will ever open');
  check(/chipRowHtml\(/.test(filt) && /TYPE_CHOICES/.test(filt),
        'it builds from TYPE_CHOICES through the shared chip row',
        'a second drawer beside the first is rule 4, and would be a third copy\n'
      + '       of this triple rather than the end of it');
  /* Asked of the REPAINT's own body. The first draft asked whether the call
     appeared anywhere in the file, which the renderer's own call satisfies —
     so gutting `rerenderDictTable` back to toggling a class walked through it.
     That is the second repaint-shaped escape of the day (see B-161's own guard
     note): a live control has two painters and checking one is checking half. */
  const rerender = fnSrc('LingCoT.html', 'rerenderDictTable') || '';
  check(/dictTypeFilterHtml\(\)/.test(browse),
        'the first render builds the row from the one builder');
  check(/dictTypeFilterHtml\(\)/.test(rerender),
        'and so does the repaint, rather than toggling a class on it',
        'the old code built the chips inline and repainted `active` separately —\n'
      + '       two writers of one row, and the label and drawer state now depend\n'
      + '       on the filter too, so a half-repaint drifts by construction');

  /* An entry with no type is a real state: `type` is core and D48 deliberately
     does not default it (B-069). A strict membership test would drop those
     entries silently, so the box for them is explicit. */
  check(/data-type=""/.test(html),
        'entries with no type have their own box rather than falling through');

  const exp = fnSrc('LingCoT.html', 'runDictExport') || html;
  check(/wantTypes\.has\(e\.type \|\| ''\)/.test(exp),
        'and the filter matches them by the same rule as any other type');
  check(/\.dex-type-cb[\s\S]{0,120}?checked/.test(exp),
        'the set is read off the boxes that are ticked');
}

console.log('\nD53 stage D — POS comes from the lexicon, never from a gloss\n');
{
  /* F4 ruled against gloss→POS inference and for the lexicon's own answer,
     offered as a chip. The offer is built; what this refuses is the return of
     the other half. `inferPos` sat uncalled in the source for ~280 versions with
     a list running ATTR.PRES / DECL.POL2 / PST.DECL — one language's gloss
     inventory — and a fallback of `N` for everything else. Deleted v3.14.302.

     The rule, not the name: nothing may derive a part of speech from a gloss.
     Renaming the function would defeat a name check, so the shapes are what is
     searched for. */
  const all2 = decomment([read('LingCoT.html'), ...moduleFiles().map(m => m[1])].join('\n'));
  check(!/\binferPos\b/.test(all2), 'inferPos is gone, not merely uncalled',
        '       F4: "rather than wire inferPos" — leaving it in the source is an invitation');
  const guessers = [...all2.matchAll(/function\s+(\w*(?:infer|guess)\w*Pos\w*)\s*\(/gi)].map(m => m[1]);
  check(guessers.length === 0, 'and nothing else infers a POS',
        `       ${guessers.join(', ')} — gloss→POS guessing is unreliable across languages`);

  /* The half that IS built: the lexicon's answer reaches a morpheme row. */
  const fill = decomment(fnSrc('LingCoT.html', '_dictFillForForm'));
  check(/part_of_speech:\s*cands\.find/.test(fill),
        'the composed fill carries the entry\'s part of speech (v3.14.266)');
  const rows = decomment(fnSrc('LingCoT.html', '_fillMorphRows'));
  /* v3.14.330: `pos && mayFill(p)` is gone — D55 decided an explicit take
     overwrites, and the empty-field-only rule now belongs to the BULK path
     ('fill' mode) rather than to every write. What matters to this guard is
     unchanged: the lexicon's part of speech reaches a morpheme row when a person
     asks for it, and never by inheritance (asserted above). */
  check(/morph-pos-input/.test(rows) && /offerWrites\(/.test(rows),
        'and a taken chip writes it into the row, through the shared predicate');
  const bulk = decomment(fnSrc('LingCoT.html', 'fillParseFromLexicon'));
  check(/part_of_speech/.test(bulk), 'and stage E\'s bulk fill carries it too');

  /* OFFERED, never inherited. ANNOTATION_FILL §1.1 states that deliberately:
     the three automatic fill paths read every other key and never this one. */
  for (const fn of ['ensureMorphemesFromParse', 'inheritMorphemeTypes']) {
    const src = decomment(fnSrc('LingCoT.html', fn) || '');
    check(!!src, `${fn} is in the source`);
    check(src && !/\.part_of_speech\s*=/.test(src),
          `${fn} never writes a part of speech`,
          '       a morpheme does not INHERIT one; a person takes the chip');
  }
}

console.log('\nD53 stage B — the gloss pool offers this project back to itself\n');
{
  const vm = require('vm');
  const html = read('LingCoT.html');
  /* Extracted rather than re-implemented: the pool's whole job is a merge with
     an ordering and a dedupe, and a test that restates it tests its own copy. */
  const m = /gloss: \(\) => \{[\s\S]*?\n  \},/.exec(html);
  check(!!m, 'AC_POOLS.gloss is declared');
  if (m) {
    const S = {
      /* Two spellings of one gloss, one used more than the other; a gloss only
         a dictionary entry carries; and an abbreviation Leipzig also ships. */
      wordById: new Map([
        ['w1', { word: { gloss: 'PST', morphemes: [{ gloss: 'fox' }, { gloss: 'fox' }] } }],
        ['w2', { word: { gloss: 'PST', morphemes: [{ gloss: 'fox' }] } }],
        ['w3', { word: { gloss: 'pst', morphemes: [] } }],
      ]),
      dictionary: [{ gloss: 'riverbank' }],
    };
    /* `_LOCALE` because the pool has been memoised on the locale as well as on
       `_dataGen` since v3.14.309 (B-053) — the hints are `t()` output. Supplied
       as a real object rather than stubbed away, so the key this guard exercises
       is the key the app computes. */
    const ctx = vm.createContext({ S, console, _dataGen: 1, _LOCALE: { _meta: { locale: 'en' } },
      normMeta: x => String(x || '').normalize('NFC').toLowerCase(),
      t: (k, v) => `used ${v.n}x` });
    vm.runInContext('let _tagUsage = null, _tagUsageGen = -1;', ctx);
    /* The memo's own declaration, read out of the source rather than restated —
       a second spelling here would let the guard pass against a shape the app
       no longer has. */
    vm.runInContext(/let _glossPool = .*/.exec(html)[0], ctx);
    vm.runInContext(/let _LEIPZIG_GLOSSES = \[[\s\S]*?\n\];/.exec(html)[0], ctx);
    vm.runInContext(fnSrc('LingCoT.html', 'tagUsage'), ctx);
    vm.runInContext('function glossPool() ' + m[0].replace(/^gloss: \(\) => /, '').replace(/,$/, ''), ctx);
    const pool = vm.runInContext('glossPool()', ctx);
    const at = v => pool.findIndex(r => r.value === v);

    check(at('fox') === 0, `the most-used gloss leads (${pool[0] && pool[0].value})`,
          '       consistency with this project is the point; a list led by standard abbreviations buries it');
    check(at('riverbank') !== -1, 'a gloss only the dictionary carries is offered too');
    check(pool.filter(r => /^pst$/i.test(r.value)).length === 1,
          'PST and pst are ONE row, folded as metalanguage',
          '       offering both spellings is the disagreement this pool exists to end');
    const pstRow = pool.find(r => /^pst$/i.test(r.value));
    check(pstRow && /used 3x/.test(pstRow.hint),
          `and the counts are summed across spellings (${pstRow && pstRow.hint})`,
          '       a fold that hides one spelling must not lose the uses it had');
    check(pstRow && pstRow.value === 'PST',
          `the most-used spelling is the one shown (${pstRow && pstRow.value})`,
          '       PST is used twice and pst once; showing the rarer one teaches the wrong habit');

    /* Leipzig survives, after. F2 is "not JUST from Leipzig", not "instead of". */
    const leip = pool.filter(r => !/used /.test(r.hint));
    check(leip.length > 50, `Leipzig is still offered (${leip.length} rows)`);
    check(at('fox') < pool.findIndex(r => !/used /.test(r.hint)),
          'and every used gloss comes before the first proposal');
    check(!leip.some(r => /^pst$/i.test(r.value)),
          'an abbreviation already in use is not offered twice',
          '       Leipzig ships PST and so does this corpus; one row, the corpus spelling');
    check(pool.every(r => 'value' in r && 'hint' in r && !('n' in r)),
          'the pool yields {value, hint} only, like every other',
          '       `n` is bookkeeping for the merge and is not part of the contract');
  }

  /* Every gloss field asks for the pool, or the annotator gets consistency on
     some screens and not others — which is worse than none, because the gap is
     invisible. */
  const html2 = read('LingCoT.html');
  for (const id of ['ew-gloss', 'ew-mg-${mi}', 'pk-gloss-${i}']) {
    /* A window around the id, not the line: the D51 row's attributes wrap, and
       a line-based search reported that row as unwired while it was wired. */
    const at = html2.indexOf(`id="${id}"`);
    const win = at === -1 ? '' : html2.slice(Math.max(0, at - 300), at + 300);
    check(at !== -1 && /data-ac-pool="gloss"/.test(win), `${id} asks for the gloss pool`,
          '       consistency on some screens and not others is worse than none — the gap is invisible');
  }
  const spec = read('modules/field_spec.js');
  check(/key: 'gloss'[^}]*pool: 'gloss'/.test(spec),
        'and the generated dict_entry gloss declares it in the table, not the renderer',
        '       D48: the table is where a control says what it is');
}

/* ── B-109, EXECUTED. The checks above are source shapes, and a shape is not a
   behaviour (PRACTICES §6): a filter row that calls chipRowHtml with the right
   arguments and renders nothing clickable would pass every one of them. This
   builds the row and asks what an annotator can actually reach. ───────────── */
console.log('\nB-109 · the filter row, built');
{
  const vm2 = require('vm');
  const { appSources, makeCtx, loadApp } = require('./_dom.js');
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  check(errs.length === 0, 'the app loads into the stub DOM',
        errs.map(([f, e]) => `       ${f}: ${e.message}`).join('\n'));
  const run = e => vm2.runInContext(e, ctx);
  ctx.__loc = JSON.parse(read('resources/locale/en.json'));
  run('_LOCALE = __loc;');
  run("_tagDrawersOpen.add('db-type-filter');");   // the drawer, open

  const row  = String(run('dictTypeFilterHtml()'));
  const vals = [...row.matchAll(/data-chip="([^"]*)"/g)].map(m => m[1]);
  const pool = run('TYPE_CHOICES');

  const missing = pool.filter(v => !vals.includes(v));
  check(missing.length === 0,
        `every one of the ${pool.length} types is reachable`,
        `       unreachable: ${missing.join(', ')}\n`
      + '       "phrases only" could not be asked at all before this');
  check(vals.includes('all'),
        'and so is "any type", which is not a tag and must not be one',
        '       a filter has a third answer a field does not: no filter');
  check(!pool.includes('all'),
        'the pseudo-value stays OUT of the vocabulary',
        '       counted, grouped or scoped as a tag is how it would rot the drawer');

  /* The state has to SHOW. A drawer that hides which filter is active hides the
     reason the table looks short — the one thing the old three-chip row did
     right, and the reason the button carries a label override at all. */
  run("_dictTypeFilter = 'phrase';");
  const on = String(run('dictTypeFilterHtml()'));
  check(/phrase/.test(on.slice(0, on.indexOf('tag-drawer') + 200)),
        'the button names the active filter, not just the pool size',
        `       ${on.slice(0, 200)}`);
  /* Asked of the CHIP, not of the row. `/active/.test(row)` is satisfied by the
     "any type" chip and would pass with the drawer's own marking gone. */
  const chipFor = (h, v) => h.split('<button').find(b => b.includes(`data-chip="${v}"`)) || '';
  check(/chip-choice active/.test(chipFor(on, 'phrase')),
        'and the active chip is marked inside the drawer',
        `       ${chipFor(on, 'phrase').slice(0, 160)}`);
  check(!/chip-choice active/.test(chipFor(on, 'word')),
        'while the others are not');
  check(!/chip-choice active/.test(chipFor(on, 'all')),
        'and "any type" stops being active once a type is chosen');

  run("_dictTypeFilter = 'all';");
  const off = String(run('dictTypeFilterHtml()'));
  /* THE CLICK, EXECUTED. Every check above is about what the row DRAWS, and a
     row of chips nothing listens to draws exactly the same. Deleting the branch
     in `handleChipClick` escaped all of them. */
  {
    const acts = [...new Set([...row.matchAll(/data-action="([^"]*)"/g)].map(m => m[1]))]
                   .filter(a => a !== 'tag-drawer');
    check(acts.length === 1 && acts[0] === 'type-filter',
          `the row emits one action for its chips (${acts.join(', ')})`,
          '       two actions means two accept paths for one control');

    run('rerenderDictTable = () => { __repainted = (__repainted || 0) + 1; };');
    ctx.__repainted = 0;
    const click = chip => {
      ctx.__chip = { dataset: { chip, action: acts[0] } };
      run(`handleChipClick({ target: { closest: sel =>
             sel.includes('${acts[0]}') ? __chip : null } });`);
    };
    run("_dictTypeFilter = 'all';");
    click('phrase');
    check(run('_dictTypeFilter') === 'phrase',
          'clicking a type chip sets the filter',
          `       got ${run('_dictTypeFilter')} — the chips are drawn and nothing\n`
        + '       listens: every check above passes on a dead control');
    check(ctx.__repainted === 1, 'and repaints the table once');
    click('all');
    check(run('_dictTypeFilter') === 'all',
          'and clicking "any type" clears it');
  }

  run("_dictTypeFilter = 'phrase';");
  const on2 = String(run('dictTypeFilterHtml()'));
  check(/chip-choice active/.test(chipFor(on2, 'phrase')), 'the row still reflects the state after a click');
  run("_dictTypeFilter = 'all';");
  check(/chip-choice active/.test(chipFor(off, 'all')),
        '"any type" is the active chip when nothing is filtered',
        `       ${chipFor(off, 'all').slice(0, 160)}`);
  check(!/chip-choice active/.test(chipFor(off, 'phrase')),
        'and the type that was chosen is released');
}

/* ═══ B-027 · an unknown tag is reported, and can be adopted ════════════════
   `pos_tags.json` sanctions the inventory and nothing checked a stored value
   against it. `CONJ` ×3 and `affix` ×2 reached the `ucak` dictionary — a wrong
   tag and a wrong case — and were found by reading an exported PDF.

   REFUSING WOULD BE WRONG, and the corpus is what says so: `chinese-test` used
   `CLF`, the right tag for a Mandarin classifier and absent from the shipped
   file. The annotator needed a tag the app did not have. So what this guard
   holds is that an unknown tag is **stored, reported, and adoptable** — three
   assertions, and the first is as load-bearing as the others. A corpus is a
   research record; an app that drops or rewrites a value it does not recognise
   is asserting an analysis nobody made.

   THE SAVE-TIME HALF IS ASKED OF `stampFieldProv`, not of a save handler. That
   loop is the one place that already knows a field's name, its new value, and
   that the value changed — the last of which is why the note fires when someone
   writes a tag rather than on every re-save of a record that has carried one for
   months. A per-handler check is the rule each caller must remember. */
console.log('\nB-027 · an unknown tag');
{
  const vm3 = require('vm');
  const { appSources, makeCtx, loadApp } = require('./_dom.js');
  const ctx = makeCtx({ hasId: () => true });
  /* The bridge stub goes on BEFORE the app loads, because `_pwReady` is a const
     resolved at load: with no `window.pywebview` it waits on an event the stub
     never fires, and awaiting it hangs forever. An unresolved promise does not
     hold node's event loop open, so the first run of this section exited
     silently in the middle and looked like a pass. */
  ctx.__written = null;
  ctx.pywebview = {
    api: {
      read_file: async f => (f === 'resources/pos_tags.json'
        ? '[{"tag":"NOUN","description":"n"}]' : '[]'),
      // tb-settings: adopted tags live in the workspace, over the shipped list.
      read_user_file: async f => (f === 'vocabulary/pos_tags.json'
        ? '[{"tag":"CLF","description":""}]' : null),
      write_user_file: async (f, c) => { ctx.__written = [f, c]; return true; },
      /* Present because the bridge stub makes the boot path run: with no
         `pywebview` these are never reached, and with one they are. */
      get_workspace: async () => ({}),
      get_app_info:  async () => ({}),
    },
  };
  const errs = loadApp(ctx, appSources());
  check(errs.length === 0, 'the app loads into the stub DOM',
        errs.map(([f, e]) => `       ${f}: ${e.message}`).join('\n'));
  const run = e => vm3.runInContext(e, ctx);
  ctx.__loc = JSON.parse(read('resources/locale/en.json'));
  run('_LOCALE = __loc;');

  /* ── the reader ───────────────────────────────────────────────────────── */
  check(run("unknownTag('part_of_speech', 'NOUN')") === null,
        'a sanctioned tag is not an anomaly');
  check(run("unknownTag('part_of_speech', '')") === null,
        'and neither is an empty field — most fields are empty');
  check(run("unknownTag('gloss', 'zzz')") === null,
        'a field with no pool is not policed',
        '       a gloss is metalanguage the project invents; "not in Leipzig" is\n'
      + '       not a defect, and treating it as one would be noise on every save');

  const conj = JSON.parse(run("JSON.stringify(unknownTag('part_of_speech', 'CONJ'))"));
  check(conj && conj.value === 'CONJ', 'the reported wrong tag is caught');
  check(conj && conj.near === null,
        'and offered no near match, because there is none',
        `       got ${JSON.stringify(conj)} — COORD is the project's tag and is\n`
      + '       not a case variant of CONJ; guessing it would be the app\n'
      + '       asserting an analysis nobody made');

  const aff = JSON.parse(run("JSON.stringify(unknownTag('part_of_speech', 'affix'))"));
  check(aff && aff.near === 'AFFIX',
        'the reported wrong CASE is caught, with the right spelling named',
        `       got ${JSON.stringify(aff)} — this is the half a fold can answer`);

  /* Folded as METALANGUAGE. A tag is documentation-language, and folding it with
     the object language's casing is B-056: Turkish dotted I would make `IDEO`
     and `ideo` different tags in a Turkish corpus and the same in an English one. */
  check(run("unknownTag('type', 'WORD')") !== null
        && JSON.parse(run("JSON.stringify(unknownTag('type','WORD'))")).near === 'word',
        'the type pool is policed too, and folds the same way');

  /* ── the save-time report, executed ───────────────────────────────────── */
  run('_linkNotes = [];');
  ctx.__obj = {};
  run("stampFieldProv(__obj, { part_of_speech: { orig: '', cur: 'CONJ' } });");
  const notes = JSON.parse(run('JSON.stringify(_linkNotes)'));
  check(notes.length === 1 && /CONJ/.test(notes[0]),
        'saving an unknown tag reports it',
        `       notes: ${JSON.stringify(notes)}`);
  check(run("__obj.part_of_speech") === undefined && run("!!__obj.field_prov"),
        'and the save is not blocked — the stamp still happened',
        '       refusing a value the inventory lacks is how CLF would have been\n'
      + '       lost; the corpus is the record, not the vocabulary');

  run('_linkNotes = [];');
  run("stampFieldProv({}, { part_of_speech: { orig: 'CONJ', cur: 'CONJ' } });");
  check(JSON.parse(run('JSON.stringify(_linkNotes)')).length === 0,
        'an UNCHANGED unknown tag is not reported again',
        '       otherwise every re-save of a record re-reports a decision that\n'
      + '       was made months ago, and the channel stops being read');

  run('_linkNotes = [];');
  run("stampFieldProv({}, { part_of_speech: { orig: '', cur: 'NOUN' } });");
  check(JSON.parse(run('JSON.stringify(_linkNotes)')).length === 0,
        'and a sanctioned one is silent');

  /* ── the drawer's offer, and adopting ─────────────────────────────────── */
  const drawer = v => String(run(
    `tagDrawerHtml('ew-pos', ${JSON.stringify(v)}, POS_CHOICES, 'pos-select', 'upper', 'part_of_speech')`));
  const known = drawer('NOUN');
  check(!/tag-add/.test(known), 'a known tag raises no offer in the drawer');

  const d = drawer('affix');
  check(/data-action="tag-add"/.test(d) && /data-chip="affix"/.test(d),
        'an unknown one offers to be adopted',
        `       ${d.slice(0, 200)}`);
  check(/data-chip="AFFIX"/.test(d),
        'and offers the near match as the other reading',
        '       typo or gap: the app cannot tell, so it offers both and neither\n'
      + '       happens without a click');
  check(/data-tag-field="part_of_speech"/.test(d),
        'the adopt chip names the field whose pool it would extend',
        '       without it the handler has to guess which vocabulary is meant');

  const before = run('POS_CHOICES.length');
  run("adoptTag('part_of_speech', 'EVID')").then(ok => {
    check(ok === true, 'adopting reports that it happened');
    check(run('POS_CHOICES.length') === before + 1 && run("POS_CHOICES.includes('EVID')"),
          'the tag is in the pool immediately',
          '       the annotator is mid-edit; the drawer has to repaint now, and\n'
        + '       the file write is what makes it outlast the session');
    check(run("unknownTag('part_of_speech', 'EVID')") === null,
          'so it stops being reported as unknown');
    check(!/tag-add/.test(drawer('EVID')),
          'and the drawer stops offering to add it',
          '       an "add this" button for a tag already in the list is the\n'
        + '       offer-that-does-nothing shape (B-108, B-166, B-193)');
    const w = ctx.__written;
    check(run("POS_CHOICES.includes('CLF')") && run("POS_CHOICES.includes('NOUN')"),
          'the shipped list and the workspace vocabulary are both loaded');
    check(w && w[0] === 'vocabulary/pos_tags.json',
          'and it is written to the workspace vocabulary file, not only to memory',
          `       wrote: ${JSON.stringify(w && w[0])} — in memory only, the tag is\n`
        + '       gone next launch and the annotator is asked again');
    const back = w ? JSON.parse(w[1]) : [];
    check(back.some(x => x.tag === 'EVID') && back.some(x => x.tag === 'CLF') && !back.some(x => x.tag === 'NOUN'),
          'appended to what the file held, rather than replacing it',
          `       ${JSON.stringify(back)} — serialising the pool from memory\n`
        + '       would flatten the scope and group keys the app models loosely');

    return run("adoptTag('part_of_speech', 'EVID')").then(again => {
      check(again === false && run('POS_CHOICES.filter(x => x === "EVID").length') === 1,
            'adopting twice does not duplicate it');
      console.log(`\n  ${pass} passed, ${fail} failed`);
      process.exit(fail ? 1 : 0);
    });
  }).catch(err => { console.log('  FAIL adopt threw'); console.log(err); process.exit(1); });
}
