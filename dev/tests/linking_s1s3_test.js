#!/usr/bin/env node
/* =============================================================================
   linking_s1s3_test.js, the miss is shared, visible, and reported
   Run:  node dev/tests/linking_s1s3_test.js
   =============================================================================
   LINKING_AUDIT §8 S1–S3, closing B-047 and B-046.

   THE RULE: a link that fails to match must not resolve itself silently, and it
   must not resolve itself DIFFERENTLY depending on which panel you are in.
   Before v3.14.108 the word editor minted a lemma on a miss while the
   dictionary editor discarded the annotator's input, same field, same key,
   opposite outcome, both without a word.

   The collator half is executed against real Turkish, because the case where a
   near match matters is exactly the case B-043 was about.

   ── v3.14.265, D51 stage 0 ──────────────────────────────────────────────────
   Everything above this line was a source scan. Unified audit §4.3 measured the
   consequence: **8 of 34 assertions executed anything, and gutting `takeOffer`
   left all 34 green.** A guard that reads source cannot fail on a rewrite that
   preserves the spellings it matches, and D51 stage 2 rewrites exactly the
   machinery this file names — `_pushTokenToDict` becomes `createEntries`, and
   the link path goes with it.

   So §B below runs the machinery instead of reading it. Six functions in a `vm`
   with a small `S`: `resolveLemma`, `_resolveOrCreateLemma`, `lemmaCandidates`,
   `lookupLemma`, `linkTo` and `takeOffer`. The claims are the same ones the
   scan half makes; what changes is that a rewrite has to keep them true rather
   than keep the words.
   ============================================================================= */

const vm   = require('vm');
const path = require('path');
const { SRC, read, fnSrc, decomment } = require('./_source.js');
const N = require(path.join(SRC, 'modules', 'normalize.js'));

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const html = read('LingCoT.html');
const ev   = read('modules/events.js');

console.log('\nS1 — one resolver, and both editors use it\n');
{
  check(/function resolveLemma\(/.test(html), 'resolveLemma() exists');

  // The defect: two panels, opposite miss behaviour.
  const bodyOf = (src, name) => {
    const i = src.indexOf(`function ${name}(`);
    if (i === -1) return '';
    let d = 0, started = false;
    for (let k = i; k < src.length; k++) {
      if (src[k] === '{') { d++; started = true; }
      else if (src[k] === '}') { d--; if (started && d === 0) return src.slice(i, k + 1); }
    }
    return '';
  };
  /* v3.14.270: `saveNewDictEntry` is gone with `renderDictAdd` (D51 stage 5), so
     the pair this defect lived between is one handler and one panel. B-047 was
     two editors disagreeing about a MISS; the panel does not offer a lemma
     field, so it has no typed lemma to discard — and that is the claim below.
     The editor still resolves through the shared path. */
  for (const fn of ['saveDictEntry']) {
    const b = bodyOf(html, fn);
    check(/_resolveOrCreateLemma\(/.test(b),
          `${fn}() resolves through the shared path (B-047)`,
          '         a bare lookup here silently discards the typed lemma on a miss');
  }
  check(!/function saveNewDictEntry\s*\(/.test(html),
        'and the second editor is gone rather than left to drift',
        '         B-047 was those two disagreeing about what a miss means');
  {
    /* A lemma field on the panel with no resolver behind it would be B-047
       again, wearing the new surface. There is no such field, and this is what
       says so. */
    const row = bodyOf(html, 'pkRowHtml');
    check(!/lemma/i.test(row),
          'the add-to-dictionary panel offers no lemma field to discard',
          '         a lemma typed into a surface that drops it is exactly B-047');
    const cands = bodyOf(html, '_pkCandidates');
    check(!/lemma/i.test(cands), 'and reads none back');
  }
  check(!/lookupLemma\([^)]*\)\?\.id/.test(html),
        'no editor still uses a bare lookup whose miss evaporates');

  /* Two mounts, two mechanisms since v3.14.201. Word-edit still writes its own;
     the dictionary pair renders the strip from the field table's `lemma`
     control, which is what closed the drift between them — dict-add's strip was
     an empty div while dict-edit's was populated, so the miss was visible in
     one editor and not the other. */
  check(/function lemmaStripHtml\(/.test(html) && /id="ew-lemma-strip"/.test(html),
        'the strip is mounted in word-edit');
  check(/<div id="\$\{id\}-strip">\$\{lemmaStripHtml\(orig, id\)\}<\/div>/.test(html),
        'and generated for every lemma control, so both dictionary forms show it',
        'a lemma field whose strip is an empty div hides the miss it exists to show');
  check(/refreshLemmaStrip\(/.test(ev) && /addEventListener\('input'/.test(ev),
        'the strip updates as the annotator types, before the save');
  /* D42 merged lemma-pick into the one offer path. The invariant is unchanged
     and is what is asserted: a candidate is one click, and something handles it. */
  check(/data-action="offer-take"/.test(html) && /offer-take/.test(ev),
        'a candidate can be chosen with one click, and the handler exists');
  check(/function takeOffer\(/.test(html),
        'and there is exactly one accept path for it to reach');
}

console.log('\nS1 — the collator, executed\n');
{
  const cmp = new Intl.Collator('tr', { sensitivity: 'base' });
  check(cmp.compare('İstanbul', 'istanbul') === 0,
        'tr collator treats İstanbul/istanbul as the same — no table needed');
  check(cmp.compare('resume', 'résumé') === 0,
        'and folds accents, which is the other half of "base" sensitivity');
  check(cmp.compare('kedi', 'köpek') !== 0, 'but does not collapse different words');

  /* MEASURED, and counter-intuitive enough to pin down: under `tr` the collator
     is STRICTER than the default, not looser.

        İstanbul ~ istanbul   tr: same     default: same
        kedi     ~ kedı       tr: DIFFERENT   default: different
        KEDI     ~ kedi       tr: DIFFERENT   default: same

     `i` and `ı` are separate letters of the Turkish alphabet, and `I`
     lowercases to `ı`, so `KEDI` really is a different word from `kedi`. This
     is correct and must not be "fixed": an i/ı slip in Turkish is a spelling
     error the annotator has to resolve, not a variant for us to fold away.
     Recorded because it looks like a bug to anyone who has not read this. */
  check(cmp.compare('kedi', 'kedı') !== 0,
        'tr keeps i and ı apart — they are different LETTERS, not case variants');
  check(cmp.compare('KEDI', 'kedi') !== 0,
        'and keeps KEDI from kedi, because Turkish I lowercases to ı',
        '         if this starts passing, the locale is not reaching the collator');
  check(new Intl.Collator(undefined, { sensitivity: 'base' }).compare('KEDI', 'kedi') === 0,
        'while the DEFAULT locale folds them — proving the tailoring is applied');

  // The division of labour the design depends on.
  check(typeof cmp.getSortKey === 'undefined',
        'Intl.Collator exposes NO sort-key API — it can only re-check candidates',
        '         if this ever changes, the exact-key index could be replaced by it');
  check(N.dictKeyIn('İstanbul', 'tr', 'Latn') === N.dictKeyIn('istanbul', 'tr', 'Latn'),
        'the exact key still does the real lookup (B-043)');
}

console.log('\nS2 — chips carry an entry id, and the link survives a save\n');
{
  /* D42 renamed the chips and moved the handler into LingCoT.html. The two
     things that matter are the same: the offer carries the entry id, and taking
     it writes a LINK rather than only text. */
  check(/data-offer-entry-id=/.test(html),
        'lexicon offers carry the entry id');
  check(/entryId:\s+e\.id/.test(html),
        'and the provider fills it in, so the attribute is never empty in practice');
  /* v3.14.330: `_fillMorphRows` composes the offer into one object and writes
     the fields `offerWrites` names, so the assignment reads `entry.id` rather
     than the old `entryId` parameter. The rule is unchanged and is what this
     asserts — the link is ASSIGNED, not merely offered as text. */
  check(/row\.dataset\.dictId = entry\.id/.test(html),
        'taking an offer ASSIGNS the link rather than only editing text (§6)');
  check(/class="morph-edit-row" data-dict-id=/.test(html),
        'the morpheme row carries its dict_id, so the choice can be saved');

  /* B-046: the key was simply missing from saveWord's rebuilt literal.
     Read the whole function rather than a byte window from an anchor: at
     v3.14.236 the window was 2,600 characters and the key sat at 2,586, so two
     added comment lines pushed it out of range and the guard failed on a change
     that did not touch the behaviour it guards. */
  const seg = fnSrc('LingCoT.html', 'saveWord');
  /* v3.14.236: the rebuild became mergeMorpheme(existing, {...}) for B-124, so
     the key is now spelled `dict_id: rowDictId || undefined` — same rule, and
     the deletion half of it is executed by morpheme_merge_test.js. */
  check(/dict_id:\s*rowDictId \|\| undefined/.test(seg),
        'saveWord carries dict_id through the DOM rebuild (B-046)',
        '         without it every word save silently deleted every morpheme link');
}

console.log('\nS3 — the silent branches now say what they did\n');
{
  check(/function linkNote\(/.test(html) && /function reportLinkNotes\(/.test(html),
        'the note buffer and its reporter exist');
  check((html.match(/linkNote\('note\.link\./g) || []).length >= 4,
        'the consequential branches report — linked · created · near · filled',
        `         found ${(html.match(/linkNote\('note\.link\./g) || []).length}`);
  check((html.match(/drainLinkNotes\(\);/g) || []).length >= 3
        && (html.match(/reportLinkNotes\(\);/g) || []).length >= 3,
        'every reporting save clears first and reports after',
        '         clearing first is what stops a failed save\'s notes being '
      + 'attributed to the next one');

  const locale = JSON.parse(read('resources/locale/en.json'));
  for (const k of ['note.link.lemma_linked', 'note.link.lemma_created',
                   'note.link.lemma_near', 'note.link.fields_filled',
                   'hint.lemma.will_create', 'hint.lemma.will_link',
                   'label.lemma.candidates', 'title.editor.morph_linked'])
    check(typeof locale[k] === 'string', `locale key ${k} exists`);
}

console.log('\nicons referenced must exist in the sprite (B-021)\n');
{
  /* Decomment first: the file explains the convention with a literal
     `icon('name')`, and matching that reported a missing icon called "name", the exact "a guard matched its own prose" failure this project has hit
     three times. */
  const code = html.replace(/<!--[\s\S]*?-->/g, ' ')      // HTML comments too, the
                   .replace(/\/\*[\s\S]*?\*\//g, ' ')      // sprite header is one
                   .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  const used = new Set([...code.matchAll(/icon\('([a-z-]+)'\)/g)].map(m => m[1]));
  const have = new Set([...html.matchAll(/id="ph-([a-z-]+)"/g)].map(m => m[1]));
  const missing = [...used].filter(n => !have.has(n));
  check(missing.length === 0,
        `all ${used.size} icon() names resolve in the sprite`,
        `         missing: ${missing.join(', ')} — icon('plus') rendered nothing for 20 versions (B-021)`);
}

/* ══ §B · THE BEHAVIOURAL HALF ═══════════════════════════════════════════════
   D51 stage 0. Built before stage 2 touches the writer, so the rewrite has
   something that can fail. */

/* One harness, rebuilt per case so no test inherits another's registry. */
function harness(opts = {}) {
  const notes = [];
  const ctx = {
    console,
    /* The real normaliser, not a stub: every claim below is about folding, and
       a stub here would let the guard pass under a broken key (B-043's shape). */
    normForm: f => N.dictKeyIn(String(f || ''), opts.lang || 'tr', 'Latn'),
    t: (k, v) => `${k}(${JSON.stringify(v || {})})`,
    S: {
      lemmas: [], lemmaById: new Map(), lemmaByForm: new Map(),
      dictionary: [], dictByForm: new Map(), dictById: new Map(),
      dictByLemmaId: new Map(), dictMorphemes: [],
      /* B-114: the ambiguous strip asks lemmaGroup how big each candidate is,
         so the harness carries both sides of a group even when a test has none. */
      wordById: new Map(), corpusLemmaRefs: new Map(),
    },
    prov: () => ({ annotator: 'Ann', annotator_id: 'ann_1', date: '2026-08-30', time: '10:00:00' }),
    _derivedFieldProv: (name = 'auto (lexicon)') =>
      ({ annotator_id: null, annotator: name, date: '2026-08-30', time: '10:00:00', derived: true }),
    stampField: (o, f, m) => { if (!o.field_prov) o.field_prov = {}; o.field_prov[f] = m; },
    initProv: () => ({ prov: { annotator: 'Ann' }, prov_history: [{ annotator: 'Ann' }] }),
    applyProvToObj: o => { ctx.__stamped.push(o); },
    logEvent: () => {},
    mutate: () => { ctx.__mutated++; },
    render: () => { ctx.__rendered++; },
    reportLinkNotes: () => {},
    /* D35 stage B: the three link decisions run against these. `openAddDict` is
       recorded rather than executed — what this guard asserts is WHICH branch a
       rejection takes, and the panel is D51's, already guarded there. */
    openAddDict: (rows, opts) => { ctx.__panel.push({ rows, opts }); },
    findWord: id => ctx.__words[id] || null,
    viewHeader: () => '', provFooter: () => '', go: v => { ctx.__went = v; },
    confirm: () => ctx.__confirm, alert: m => ctx.__alerts.push(m),
    __alerts: [], __confirm: true, __went: null,
    __stamped: [], __mutated: 0, __rendered: 0, __panel: [], __words: {},
    flashSaveStatus: null,
    icon: () => '',
    esc: x => String(x),
    escAttr: x => String(x),
    OFFER_MARKS: {},
    suppressAcOnce: () => {},
    Event: class { constructor(type) { this.type = type; } },
    document: { getElementById: id => ctx.__els[id] || null },
    __els: {},
    __notes: notes,
  };
  vm.createContext(ctx);
  vm.runInContext("let _linkNotes = []; let _lemmaCollator = null; let _lemmaCollatorLoc = '\\u0000'; let _dictSorted = null;", ctx);
  /* The collator's locale comes from the fold context in the app; here it is
     stated, because the Turkish tailoring is half of what B1 asserts. */
  ctx.getFoldContext = () => ({ locale: opts.lang || 'tr' });
  for (const fn of ['linkNote', 'drainLinkNotes', 'lookupDict', 'lookupLemma', '_collator',
                    'lemmaCandidates', 'lemmaBucket', 'resolveLemma', '_numberBucket',
                    'assignLemmaHomographs', '_indexLemma', '_createLemmaRecord', '_resolveOrCreateLemma',
                    'linkTo', 'lemmaStripHtml', 'offerStripHtml', 'takeOffer',
                    /* B-161: the repaint is the live path, and the first draft of
                       that guard read only the provider. See below. */
                    'refreshLemmaStrip',
                    /* D35 stage B, v3.14.277 */
                    'isDerived', 'fieldProv', 'homographSup', 'dictResolution',
                    '_ambCandRowHtml', '_ambCardHtml',
                    'chooseDictEntry', 'rejectDictMatch', 'addDictSameForm',
                    /* D35 B5/B6, v3.14.282 */
                    'lemmaById', 'lemmaGroup', 'orphanLemmas', 'deleteLemmaRecord'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  ctx.addLemma = form => {
    const l = { id: `L${ctx.S.lemmas.length + 1}`, form, record_type: 'lemma' };
    vm.runInContext('_indexLemma(__l)', Object.assign(ctx, { __l: l }));
    return l;
  };
  ctx.addEntry = (form, type) => {
    const e = { id: `E${ctx.S.dictionary.length + 1}`, form, type: type || 'word' };
    ctx.S.dictionary.push(e);
    ctx.S.dictById.set(e.id, e);
    const k = ctx.normForm(form);
    if (!ctx.S.dictByForm.has(k)) ctx.S.dictByForm.set(k, []);
    ctx.S.dictByForm.get(k).push(e);
    return e;
  };
  ctx.notesTaken = () => vm.runInContext('drainLinkNotes()', ctx);
  return ctx;
}

console.log('\nB1 — resolveLemma, executed against real Turkish\n');
{
  const h = harness();
  h.addLemma('olmak');
  const run = f => vm.runInContext(`resolveLemma(${JSON.stringify(f)})`, h);

  check(run('').status === 'empty', 'an empty field resolves to `empty`, not to a miss',
        '         empty and missed are different questions and only one of them warns');
  check(run('olmak').status === 'exact', 'a form already registered resolves exact');
  check(run('OLMAK').status === 'exact',
        'and so does its case variant, because the key folds (B-043)',
        '         if this fails the collator is doing the lookup, which it must not');
  check(run('gitmek').status === 'none', 'an unrelated form is a clean miss');

  /* The near case is the one the whole S1 design exists for. */
  h.addLemma('resume');
  const near = run('résumé');
  check(near.status === 'near' && near.candidates.length === 1,
        'an accent variant comes back `near`, with the candidate attached',
        `         got ${near.status}, ${near.candidates.length} candidate(s)`);
  check(near.entry === null,
        'and near does NOT resolve — a near match is a question, not an answer',
        '         resolving it here is precisely the silent branch B-047 was about');

  /* Measured and counter-intuitive, same as the collator block above: under `tr`
     an i/ı slip is a different word, so it must not even be offered. */
  h.addLemma('kedi');
  check(run('kedı').status === 'none',
        'kedı offers no candidate for kedi — different letters, not a variant',
        '         folding these away would silently merge two Turkish words');
}

console.log('\nB2 — _resolveOrCreateLemma: the miss is never silent\n');
{
  const h = harness();
  h.addLemma('olmak');
  const run = f => vm.runInContext(`_resolveOrCreateLemma(${JSON.stringify(f)})`, h);

  check(run('') === null, 'an empty citation creates nothing');
  check(h.notesTaken().length === 0, 'and says nothing, because nothing happened');

  const hit = run('olmak');
  check(hit === 'L1', 'an exact match returns the existing id rather than minting a second');
  const n1 = h.notesTaken();
  check(n1.length === 1 && /lemma_linked/.test(n1[0]),
        'and reports that it linked (S3)', `         got ${JSON.stringify(n1)}`);

  const made = run('gitmek');
  check(made && made !== 'L1', 'a miss CREATES, which is the word editor\'s old behaviour…');
  check(h.S.lemmaById.get(made)?.form === 'gitmek', '…and the record is in the registry');
  check(vm.runInContext("lookupLemma('gitmek')", h)?.id === made,
        'indexed by citation form, so the next resolve is a hit not a second mint');
  const n2 = h.notesTaken();
  check(n2.length === 1 && /lemma_created/.test(n2[0]),
        'and it says so — B-047 was this branch being silent',
        `         got ${JSON.stringify(n2)}`);

  /* The near branch creates too, and that is deliberate: they may be genuinely
     different lemmas. What must not happen is creating WITHOUT saying so. */
  h.addLemma('resume');
  const nearId = run('résumé');
  check(!!nearId && nearId !== h.S.lemmaByForm.get(h.normForm('resume'))[0].id,
        'a near match still creates rather than absorbing into its neighbour');
  const n3 = h.notesTaken();
  check(n3.some(x => /lemma_near/.test(x)) && n3.some(x => /lemma_created/.test(x)),
        'and reports BOTH the proximity and the creation',
        `         got ${JSON.stringify(n3)} — the near note is how B-043's silent fork is caught`);
}

console.log('\nB3 — linkTo: the one ambiguity rule, run\n');
{
  const h = harness();
  const ev = h.addEntry('ev', 'word');
  const run = (obj, opts) => {
    h.__obj = obj; h.__opts = opts || {};
    return vm.runInContext('linkTo(__obj, __opts)', h);
  };

  const w = { form: 'ev' };
  check(run(w) === 'linked', 'one candidate links');
  check(w.dict_id === ev.id, 'to that candidate');
  check(w.field_prov?.dict_id?.derived === true,
        'and the stamp is DERIVED, because nobody chose it (B-121)',
        '         an automatic link signed by a person is the defect B-137 generalised');

  check(run(w) === 'exists', 'an object that already carries a link is left alone',
        '         overwriting would lose a homograph choice a person made');

  h.addEntry('ev', 'bound.morpheme');
  const w2 = { form: 'ev' };
  check(run(w2) === 'ambiguous', 'two candidates do NOT link (B-122)',
        '         the old rule took cands.find(word) || cands[0] and wrote 76 of 77 live links that way');
  check(w2.dict_id === undefined, 'and nothing is written');
  const n = h.notesTaken();
  check(n.some(x => /note\.link\.ambiguous/.test(x)),
        'the ambiguity is reported rather than resolved silently',
        `         got ${JSON.stringify(n)}`);

  const w3 = { form: 'ev' };
  check(run(w3, { entry: ev, chosen: true }) === 'linked',
        'an explicitly chosen entry links despite the ambiguity');
  check(w3.field_prov?.dict_id?.derived !== true && !!w3.field_prov?.dict_id?.annotator_id,
        'and THAT stamp names the person, because they did choose (B-121)',
        '         chosen and derived are the distinction the whole stamp exists to carry');

  check(run({ form: 'yok' }) === null, 'a form with no candidate links to nothing');
  check(run({ }) === null, 'and an object with no form is refused rather than throwing');
}

console.log('\nB4 — the strip shows the miss, and takeOffer is the one accept path\n');
{
  const h = harness();
  h.addLemma('olmak');
  const strip = f => vm.runInContext(`lemmaStripHtml(${JSON.stringify(f)}, 'ew-lemma')`, h);

  check(strip('') === '', 'no field content, no strip');
  check(/will_link/.test(strip('olmak')),
        'an exact match says it will link — the verdict, before the save');

  /* ── B-161 ────────────────────────────────────────────────────────────────
     The three branches did not offer the same doors. `lemma-new` was reachable
     only from `ambiguous`, and a form is ambiguous only once two records carry
     it — so the annotator who is CERTAIN the app has matched the wrong lemma
     had to manufacture the collision before they could say so.

     THE RULE, and the reason this is not one assertion: every branch of this
     strip that states an outcome must offer the other one. A verdict with no
     door is a report, and the strip exists to be a decision. The loop below
     walks the branches rather than naming the fixed branch, so a fourth one
     added later is asked the same question. */
  {
    const doors = h2 => [...String(h2).matchAll(/data-offer-act="([a-z-]+)"/g)]
                          .map(m => m[1]);
    const exact = strip('olmak');
    check(doors(exact).includes('lemma-new'),
          'an exact match offers "a different one" — B-161',
          '         the one state where the annotator can be sure the app guessed\n'
        + '         wrong was the one state with no way to say so');

    /* And the choice has to SHOW. A door that leaves the verdict reading "will
       link" is B-108/B-166/B-193 one field over: a control whose effect is
       invisible reads as one that did nothing. */
    const taken = vm.runInContext(
      "lemmaStripHtml('olmak', 'ew-lemma', '', null, true)", h);
    check(/will_create_sibling/.test(taken),
          'and once taken the verdict CHANGES, so the click is visible',
          `         got: ${taken.slice(0, 160)}`);
    check(doors(taken).includes('lemma-pick'),
          'with the way back offered, so changing your mind costs no retyping',
          '         this is what made the ambiguous picker usable and the exact\n'
        + '         branch had neither half of it');

    /* DERIVED, and narrowed by what the first draft of it found. The rule is
       NOT "every branch offers a door": the `new` branch with no near match
       says "will create" and there is genuinely no other outcome to offer, and
       asserting otherwise would be demanding a button that means nothing.

       The rule is about the branches that resolve onto an EXISTING record —
       `exact` and `ambiguous`. Those are the two where the app has made a
       choice on the annotator's behalf, and a choice made for you that you
       cannot decline is the whole of B-161. A fifth branch that links to
       something is asked the same question here. */
    const h4 = harness();
    h4.addLemma('yüz'); h4.addLemma('yüz');       // ambiguous
    h4.addLemma('olmak');                          // exact
    const LINKING = [
      ['exact',     h, "lemmaStripHtml('olmak', 'ew-lemma')"],
      ['ambiguous', h4, "lemmaStripHtml('yüz', 'ew-lemma')"],
    ];
    for (const [name, hh, expr] of LINKING) {
      const out = String(vm.runInContext(expr, hh));
      const d = doors(out);
      check(/offer-verdict/.test(out) && d.includes('lemma-new'),
            `the ${name} branch links to a record AND offers not to`,
            `         doors: ${JSON.stringify(d)} — a choice made on the\n`
          + '         annotator\'s behalf that cannot be declined is B-161');
    }
  }

  /* THE REPAINT, EXECUTED — and the reason this section is not a source check.
     The first draft of the B-161 guard asked the provider directly and passed
     six mutations out of six. The seventh — `refreshLemmaStrip` dropping the
     standing choice on its way to the provider — walked straight through it,
     and that is the LIVE path: the taken verdict would have painted once and
     reverted on the next keystroke, which is precisely B-193's shape and
     precisely what this fix is for. A provider tested alone is a shape. */
  {
    const h5 = harness();
    h5.addLemma('olmak');
    const inp  = { value: 'olmak', dataset: { lemmaNew: '1', original: '' } };
    const host = { innerHTML: '' };
    h5.__els['ew-lemma'] = inp;
    h5.__els['ew-lemma-strip'] = host;
    vm.runInContext("S.wordId = null; refreshLemmaStrip('ew-lemma');", h5);
    check(/will_create_sibling/.test(host.innerHTML),
          'the REPAINT carries the standing choice through to the strip',
          `         got: ${String(host.innerHTML).slice(0, 160)}\n`
        + '         the strip is repainted on every keystroke; a repaint that\n'
        + '         forgets the choice reverts the verdict under the annotator');

    inp.dataset.lemmaNew = '';
    vm.runInContext("refreshLemmaStrip('ew-lemma');", h5);
    check(/will_link/.test(host.innerHTML) && !/will_create_sibling/.test(host.innerHTML),
          'and clearing it puts the link verdict back',
          `         got: ${String(host.innerHTML).slice(0, 160)}`);
  }

  /* The stale-flag gate. `chosenId` has been checked against the form since
     B-114 so a choice left on the field cannot link a token to an unrelated
     lemma; B-161 makes the SAME flag routine rather than rare, so it needs the
     same protection. `sibling` changes the note, and reporting "a second record
     for X" where there is no first is a false statement in a research record. */
  {
    const h3 = harness();
    h3.addLemma('olmak');
    h3.notesTaken();
    const id = vm.runInContext("_resolveOrCreateLemma('resume', { newAnyway: true })", h3);
    check(typeof id === 'string' && id,
          'a stale newAnyway on a form with no record still creates it');
    const notes = h3.notesTaken();
    check(notes.some(n => /lemma_created/.test(n.key || n))
          && !notes.some(n => /lemma_sibling/.test(n.key || n)),
          'but is reported as a creation, not as a sibling of nothing',
          `         notes: ${JSON.stringify(notes).slice(0, 140)}`);
  }
  const miss = strip('resume');
  check(/will_create/.test(miss),
        'a miss says it will CREATE, which is the whole of S1',
        '         a miss that looks like nothing is what both editors used to show');

  h.addLemma('resume');
  const nearStrip = strip('résumé');
  check(/will_create/.test(nearStrip) && /offer-take/.test(nearStrip),
        'a near match says create AND offers the neighbour in one click',
        '         predicting without offering leaves the annotator to retype it');

  /* The falsification §4.3 named: gutting takeOffer left all 34 assertions
     green. This is the assertion that stops being true. */
  const inp = { value: '', dataset: {}, focus() {}, dispatchEvent() { this.__fired = true; } };
  h.__els['ew-lemma'] = inp;
  h.__btn = { dataset: { offerAct: 'set', offerTarget: 'ew-lemma', offerValue: 'olmak', offerSrc: 'lexicon' } };
  vm.runInContext('takeOffer(__btn)', h);
  check(inp.value === 'olmak', 'taking an offer WRITES the value into the field',
        '         a gutted takeOffer passed every source-scan assertion in this file');
  check(inp.dataset.offerSrc === 'lexicon',
        'and marks where it came from, so the save stamps it derived (B-061)',
        '         the mark is why a provider cannot forget: it never had the chance');
  check(inp.__fired === true, 'and fires input, so the strip repaints on the new value');
}


/* ════════════════════════════════════════════════════════════════════════════
   §C — D35 stage B, v3.14.277: the homograph chooser
   ════════════════════════════════════════════════════════════════════════════
   Executed, not read. The rule §B exists for applies here unchanged: this
   machinery is about a link resolving itself, and the defect B1 closes is a
   read path resolving one SILENTLY where `linkTo` had already stopped.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nD35 stage B — an ambiguous form resolves to nothing, and asks\n');
{
  const h = harness();
  vm.runInContext('let _AMB_SHOWN = 4;', h);
  const e1 = h.addEntry('metin', 'bound.morpheme');
  const e2 = h.addEntry('metin', 'word');
  e1.homograph = 1; e2.homograph = 2; e1.gloss = 'text'; e2.gloss = 'text';

  // ── B1 ────────────────────────────────────────────────────────────────────
  h.__w = { id: 'w1', form: 'metin' };
  const res = vm.runInContext('dictResolution(__w)', h);
  check(res.state === 'ambiguous' && res.entry === null && res.cands.length === 2,
        'two entries for one form resolve to ambiguous, to NO entry, and to both candidates',
        `         got ${JSON.stringify({ state: res.state, entry: !!res.entry, n: res.cands.length })}`);

  h.__w2 = { id: 'w2', form: 'metin', dict_id: e2.id };
  check(vm.runInContext('dictResolution(__w2).state', h) === 'linked',
        'a stored link still wins over the ambiguity — which is what stage A bought');

  // ── B2, the card ──────────────────────────────────────────────────────────
  h.__cands = res.cands;
  const card = vm.runInContext('_ambCardHtml(__cands, "w1", "s1")', h);
  const rows = [...card.matchAll(/data-action="dict-choose"/g)].length;
  check(rows === 2, `the chooser draws one row per candidate (${rows})`);
  check(card.includes(`data-entry-id="${e1.id}"`) && card.includes(`data-entry-id="${e2.id}"`),
        'each row carries its own entry id, so the choice names an entry rather than a position');
  check(/<button type="button" class="amb-row"/.test(card),
        'the rows are <button>, so they are focusable and operable without a handler of their own',
        '         a div with a click handler is the mouse-only affordance ui_wiring_test exists for');
  check(/dict-new-same-form/.test(card),
        'and the card offers a second entry for the form, which is B3 reached from B2');
  check(/label\.amb\.title/.test(card) && !/offer-strip/.test(card),
        'the header carries the verdict — no offer strip is stacked above it',
        '         D42 owns "a value you can take into a field"; this is a choice between objects');

  check(vm.runInContext('_ambCardHtml([__cands[0]], "w1", "s1")', h) === '',
        'one candidate is not an ambiguity, and draws nothing');
  check(vm.runInContext('_ambCardHtml([], "w1", "s1")', h) === '',
        'and neither is none');

  /* D45: past the fourth, candidates FOLD. A truncation would hide part of a
     vocabulary behind an unlabelled ellipsis, which that section calls the
     defect rather than the fix. */
  h.__many = ['a', 'b', 'c', 'd', 'e', 'f'].map((x, i) => ({ id: `M${i}`, form: 'çok', type: 'word', homograph: i + 1 }));
  const big = vm.runInContext('_ambCardHtml(__many, "w1", "s1")', h);
  check([...big.matchAll(/data-action="dict-choose"/g)].length === 6,
        'six candidates produce six rows — none is dropped');
  check(/<details class="amb-fold"/.test(big),
        'with the ones past the fourth behind a labelled fold, not a truncation');

  // ── B2's accept path ──────────────────────────────────────────────────────
  h.__words['w1'] = { word: { id: 'w1', form: 'metin' }, sent: { id: 's1' } };
  vm.runInContext('chooseDictEntry("w1", "s1", ' + JSON.stringify(e2.id) + ')', h);
  const w1 = h.__words['w1'].word;
  check(w1.dict_id === e2.id, 'choosing a candidate writes the link');
  check(w1.field_prov && w1.field_prov.dict_id && w1.field_prov.dict_id.derived !== true,
        'and stamps it as the PERSON’s, not derived — the case linkTo’s `chosen` flag was written for',
        `         stamp came back ${JSON.stringify(w1.field_prov && w1.field_prov.dict_id)}`);
  check(h.__rendered > 0 && h.__mutated > 0,
        'and the write goes through mutate() and re-renders');

  // ── B3, and the branch that is not cosmetic ───────────────────────────────
  h.__words['w2'] = { word: { id: 'w2', form: 'metin', dict_id: e2.id,
                              field_prov: { dict_id: { annotator_id: null, derived: true } } },
                      sent: { id: 's1' } };
  vm.runInContext('rejectDictMatch("w2", "s1")', h);
  const w2 = h.__words['w2'].word;
  check(!w2.dict_id && !(w2.field_prov || {}).dict_id,
        'rejecting a match on an AMBIGUOUS form clears the link and its stamp',
        '         which reveals the chooser, and sticks: linkTo refuses an ambiguous form on every later save');
  check(h.__panel.length === 0, 'and does not open the new-entry panel — there are candidates to choose from');

  const solo = h.addEntry('kuzey', 'word');
  h.__words['w3'] = { word: { id: 'w3', form: 'kuzey', dict_id: solo.id,
                              field_prov: { dict_id: { annotator_id: null, derived: true } } },
                      sent: { id: 's1' } };
  vm.runInContext('rejectDictMatch("w3", "s1")', h);
  check(h.__words['w3'].word.dict_id === solo.id,
        'rejecting a match on a UNIQUE form does NOT just clear it',
        '         clearing would be undone by the next save’s auto-link, so the rejection would not stick');
  check(h.__panel.length === 1 && h.__panel[0].rows[0].new_anyway === true,
        'it opens the panel to create the sibling that makes the form ambiguous — B3 as filed',
        `         panel opened ${h.__panel.length} time(s) with ${JSON.stringify(h.__panel[0] && h.__panel[0].rows[0])}`);
  check(h.__panel[0].rows[0].form === 'kuzey',
        'seeded with the token’s own form, so "same form" is what it means');
}


/* ════════════════════════════════════════════════════════════════════════════
   §D — D35 stage B4, v3.14.281: the last two silent first-picks
   ════════════════════════════════════════════════════════════════════════════
   Four places answered "which entry is this form?" with `[0]` of a Map bucket.
   `linkTo` stopped at v3.14.260, the read path at v3.14.277; these are the
   remaining two. The lemma registry REFUSES rather than offers, deliberately:
   a lemma has no discriminator to tell two apart by, so a picker would draw two
   identical rows — that is B-114's first half and it waits for the group view.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nD35 B4 — a lemma bucket of two links to neither\n');
{
  const h = harness();
  h.addLemma('yüz');
  check(vm.runInContext('resolveLemma("yüz").status', h) === 'exact',
        'one record for a citation form still resolves to it');

  h.addLemma('yüz');                              // a second, same folded form
  const r = vm.runInContext('resolveLemma("yüz")', h);
  check(r.status === 'ambiguous',
        'two records for one citation form resolve to ambiguous, not to whichever came first',
        `         got ${r.status}`);
  check(r.entry === null && r.candidates.length === 2,
        'to NO record, and to both candidates');

  h.notesTaken();
  const id = vm.runInContext('_resolveOrCreateLemma("yüz")', h);
  check(id === null, 'so a save links nothing');
  check(vm.runInContext('S.lemmas.length', h) === 2,
        'and creates no third record — adding to the pile it cannot tell apart is how the pile got there');
  const notes = h.notesTaken();
  check(notes.some(n => /lemma_ambiguous/.test(n.key || n)),
        'and it SAYS so, which is S3’s whole rule',
        `         notes: ${JSON.stringify(notes).slice(0, 120)}`);

  const strip = vm.runInContext('lemmaStripHtml("yüz", "ew-lemma")', h);
  check(/offer-stop/.test(strip),
        'the strip warns before the save, where the decision is still cheap',
        '         `stop` is the verdict kind that means the save is blocked, which it is');

  /* This used to assert the strip offers NOTHING, and the reason it gave was a
     limitation, not a rule: "two lemma records are indistinguishable until B5
     draws their groups". B5 shipped and B-114 gave them numbers, so the
     limitation is gone and the assertion with it. Every candidate is offered,
     and each is a DIFFERENT row — a picker that draws two identical options is
     what B4 was right to refuse. */
  check((strip.match(/data-offer-act="lemma-pick"/g) || []).length === 2,
        'both records are offered, because they can now be told apart');
  check(/lemma-pick[\s\S]*data-offer-entry-id="L1"/.test(strip)
        && /data-offer-entry-id="L2"/.test(strip),
        'each option names the record it means, not just the form',
        '         the form is the same for both; the id is what the save links to');
  check(/data-offer-act="lemma-new"/.test(strip),
        'and "a different one" is offered, which the field could not say at all',
        '         D35 B3 gave a dictionary link exactly this; B-114 is it one layer over');
}

console.log('\nB-114 — the ambiguity is answerable, both ways\n');
{
  const h = harness();
  const a = h.addLemma('yüz'), b = h.addLemma('yüz');
  check(a.homograph === 1 && b.homograph === 2,
        'two records for one citation form are numbered as they are created',
        `         got ${a.homograph} / ${b.homograph} — D35 A1's rule, one layer over`);

  /* PICK: the save links to the record the annotator named, not to whichever
     the bucket holds first, and not to nothing. */
  h.notesTaken();
  const picked = vm.runInContext('_resolveOrCreateLemma("yüz", { chosenId: "L2" })', h);
  check(picked === 'L2', 'a chosen record is what the save links to');
  check(vm.runInContext('S.lemmas.length', h) === 2, 'and nothing is created');

  /* A stale choice cannot link a token to an unrelated lemma. The field keeps
     the id across a repaint, and a form edit that outruns the clear would
     otherwise write it. */
  const stale = vm.runInContext('_resolveOrCreateLemma("olmak", { chosenId: "L2" })', h);
  check(stale !== 'L2', 'a choice that does not match the form on the field is ignored',
        '         a stale pick would link this token to a lemma nobody chose for it');
  check(vm.runInContext('lemmaById(__id).form', Object.assign(h, { __id: stale })) === 'olmak',
        'and the form on the field is what it falls back to',
        '         ignoring the stale id must not also ignore what was typed');

  /* NEW ANYWAY: D35 B3's `new_anyway` one layer over. A third record, numbered,
     which is the whole point — an unnumbered third would rejoin the pile. */
  h.notesTaken();
  const nBefore = vm.runInContext('S.lemmas.length', h);
  const made = vm.runInContext('_resolveOrCreateLemma("yüz", { newAnyway: true })', h);
  check(vm.runInContext('S.lemmas.length', h) === nBefore + 1,
        'asking for a new one creates exactly one more record');
  const third = vm.runInContext('lemmaById(__id)', Object.assign(h, { __id: made }));
  check(third && third.homograph === 3, `and it is numbered ${third && third.homograph}, so it is addressable`);
  check(third.record_type === 'lemma', 'and declares what it is, like every other record');
  const notes = h.notesTaken();
  check(notes.some(n => /lemma_sibling/.test(n.key || n)),
        'and it SAYS a sibling was made, not that a lemma was created',
        `         notes: ${JSON.stringify(notes).slice(0, 120)}`);

  /* One minter. Two would be rule 4, and the second is the one that forgets
     record_type, or the stamp, or the numbering. */
  const rc = decomment(fnSrc('LingCoT.html', '_resolveOrCreateLemma'));
  check(!/record_type:\s*'lemma'/.test(rc),
        'the resolver does not mint a record itself',
        '         both routes go through _createLemmaRecord, or one of them forgets something');
}

console.log('\nD35 B4 — every homograph is offered, not just the first\n');
{
  const h = harness();
  vm.runInContext(fnSrc('LingCoT.html', 'suggestParseEntries'), h, { filename: 'spe.js' });
  const a = h.addEntry('yüz', 'bound.morpheme'); a.homograph = 1; a.gloss = 'hundred';
  const b = h.addEntry('yüz', 'word');           b.homograph = 2; b.gloss = 'face';
  h.addEntry('düm', 'bound.morpheme');

  const got = vm.runInContext('suggestParseEntries("yüz-düm")', h);
  const forYuz = got.filter(x => x.seg === 'yüz');
  check(forYuz.length === 2,
        `both entries for a segment become offers (${forYuz.length})`,
        '         entries[0] meant a homograph past the first could not be offered at all');
  check(new Set(forYuz.map(x => x.entry.id)).size === 2, 'and they are the two different entries');
  check(got.some(x => x.seg === 'düm'), 'the other segments still resolve');
}


/* ════════════════════════════════════════════════════════════════════════════
   §E — D35 B5/B6, v3.14.282: the lemma group, from both sides
   ════════════════════════════════════════════════════════════════════════════
   B-106's measurement is the whole argument: all 33 live lemmas are pointed at
   by a token and only 14 by an entry, so an entry-only view shows nineteen
   empty groups out of thirty-three. The guard asserts that both indexes are
   asked, which is the thing that would silently regress if someone "simplified"
   the query to `dictByLemmaId`.
   ════════════════════════════════════════════════════════════════════════ */
console.log('\nD35 B5 — a lemma group is everything that points at it\n');
{
  const h = harness();
  const lem = h.addLemma('olmak');
  const e1  = h.addEntry('ol', 'bound.morpheme'); e1.lemma_id = lem.id; e1.gloss = 'be';
  h.S.dictByLemmaId.set(lem.id, [e1]);

  const w1 = { id: 'w1', form: 'oldu',    lemma_id: lem.id, gloss: 'be-PST' };
  const w2 = { id: 'w2', form: 'olacak',  lemma_id: lem.id };
  h.S.wordById = new Map([['w1', { word: w1, sent: { id: 's1', text: 'Bu oldu.' } }],
                          ['w2', { word: w2, sent: { id: 's1', text: 'Bu oldu.' } }]]);
  h.S.corpusLemmaRefs = new Map([[lem.id, [{ word_id: 'w1' }, { word_id: 'w2' }, { word_id: 'gone' }]]]);

  const g = vm.runInContext(`lemmaGroup(${JSON.stringify(lem.id)})`, h);
  check(g.entries.length === 1, 'the entry side is asked');
  check(g.tokens.length === 2,
        `and the TOKEN side too (${g.tokens.length}) — an entry-only view showed 19 empty groups of 33`,
        '         this is the measurement B-106 was decided on');
  check(!g.tokens.some(t => t.word.id === 'gone'),
        'a stale corpusLemmaRefs entry resolves to nothing and is skipped, which is that index’s contract');

  /* The empty group is the normal case for an agglutinative language, not an
     error state — so it must be a group with no entries, not "not a group". */
  const lem2 = h.addLemma('giymek');
  h.S.corpusLemmaRefs.set(lem2.id, [{ word_id: 'w1' }]);
  w1.lemma_id = lem2.id;
  const g2 = vm.runInContext(`lemmaGroup(${JSON.stringify(lem2.id)})`, h);
  check(g2.entries.length === 0 && g2.tokens.length === 1,
        'a lemma with tokens and no entry is still a group — the case 19 of 33 live lemmas are in');
}

console.log('\nD35 B6 — an orphan is collected, never swept\n');
{
  const h = harness();
  const kept = h.addLemma('olmak');
  const orph = h.addLemma('yitik');
  h.S.wordById = new Map([['w1', { word: { id: 'w1', form: 'oldu', lemma_id: kept.id }, sent: { id: 's1' } }]]);
  h.S.corpusLemmaRefs = new Map([[kept.id, [{ word_id: 'w1' }]]]);

  const orphans = vm.runInContext('orphanLemmas()', h);
  check(orphans.length === 1 && orphans[0].id === orph.id,
        'a lemma nothing points at is reported, and one with a token is not');

  h.__confirm = true;
  vm.runInContext(`deleteLemmaRecord(${JSON.stringify(orph.id)})`, h);
  check(h.S.lemmas.length === 1 && !h.S.lemmaById.has(orph.id),
        'deleting one takes it out of the flat list and the id index');
  check(!(h.S.lemmaByForm.get(h.normForm('yitik')) || []).length,
        'and out of its citation bucket, which is the third half of its identity');

  /* The refusal is the design, not a safety net: this is reached from a view
     that has just drawn the members. */
  h.__alerts.length = 0;
  vm.runInContext(`deleteLemmaRecord(${JSON.stringify(kept.id)})`, h);
  check(h.S.lemmas.length === 1 && h.S.lemmaById.has(kept.id),
        'a lemma with members is NOT deleted');
  check(h.__alerts.length === 1, 'and the refusal says so rather than doing nothing');

  h.__confirm = false;
  const before = h.S.lemmas.length;
  const o2 = h.addLemma('başka');
  vm.runInContext(`deleteLemmaRecord(${JSON.stringify(o2.id)})`, h);
  check(h.S.lemmas.length === before + 1, 'declining the confirm keeps the record');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
