#!/usr/bin/env node
/* =============================================================================
   annotation_gaps_test.js. D34 stage A — the missing-annotation counter
   Run:  node dev/tests/annotation_gaps_test.js
   =============================================================================
   Three claims, and the first two are the ones that make the third worth
   printing:

     1. WHICH FIELDS COUNT is derived from the field table, not listed here or
        in the app. `countedKeys` is the accessor, `core` is the tier, and the
        exclusions are rules with names (containers, `stored: false`, planned).
     2. WHAT IS WALKED is the traversal's own index, so punctuation is skipped
        by B-151's one test and by no second one, and `store:` is honoured so a
        document's fields are looked for where the table says they live.
     3. THE COUNTS ARE RIGHT, executed against a synthetic document built to
        exercise every one of those rules at once, and then against the real
        corpora, where the numbers are printed because D34's whole argument is
        that a counter is only worth building if its numbers are believable.

   Stage B (v3.14.307) added the fourth: WHY a field is empty. Two declared
   rules — `vacuousWhen` per record, `appliesWhen` per project — and the thing
   worth guarding about them is that they cannot excuse a field by accident: a
   declared rule name that resolves to nothing, or an undetectable script, must
   count as "applies" rather than as "never mind".
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { SRC, read, decomment, fnSrc } = require('./_source.js');
const vm = require('vm');
const { corpusDir, corpusFilesIn, loadCorpus, requireCorpus } = require('./_fixture.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');
const F = require(path.join(SRC, 'modules', 'field_spec.js'));
const N = require(path.join(SRC, 'modules', 'normalize.js'));

const html = read('LingCoT.html');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* ── 1 · the counted set is derived, and the exclusions are the declared ones ─ */
console.log('\nwhich fields count — derived from the field table');
{
  const levels = Object.keys(F.FIELD_SPEC);

  /* `core` is the tier whose definition IS "empty means unfinished". The one
     other way in is `counted: true`, which is an explicit per-field opt-in
     against the tier (stage B, conflict ⑧) — and an opt-in that did not have to
     say so would be a hole rather than a decision. */
  const wrongTier = [];
  for (const lvl of levels)
    for (const k of F.countedKeys(lvl))
      if (F.tierOf(lvl, k) !== 'core' && F.fieldOf(lvl, k).counted !== true)
        wrongTier.push(`${lvl}.${k} is ${F.tierOf(lvl, k)} and does not opt in`);
  check(wrongTier.length === 0,
        'every counted field is `core`, or says `counted: true` out loud',
        wrongTier.map(x => `         ${x}`).join('\n'));

  /* The three exclusions, each named at the instance that would otherwise slip
     through. A rule with no case that exercises it is not being checked. */
  const counted = (l, k) => F.countedKeys(l).includes(k);
  check(!counted('word', 'morphemes') && !counted('document', 'metadata'),
        'containers are out — a word is not unfinished for having a structure');
  check(!counted('section', 'ingest') && !counted('paragraph', 'ingest'),
        '`stored: false` is out — a surface has nothing on disk to be empty');
  check(!counted('word', 'head') && !counted('word', 'dict_id')
        && !counted('sentence', 'deps') && !counted('word', 'comments'),
        'aux, extra and derived are out unless they opt in — `word.comments` is aux and silent');

  /* The one deliberate disagreement with annotationKeys, pinned so it stays a
     decision. Tokenization is not annotation, but an untokenized sentence
     contributes no words, so without this row every word-level count would
     under-report and say nothing about it. */
  check(counted('sentence', 'words') && !F.annotationKeys('sentence').includes('words'),
        'sentence.words IS counted and is NOT annotation — the two lists differ on purpose');

  /* ── v3.14.318: the trackable pool, and the three decisions behind it ────── */
  check(F.tierOf('section', 'source_ids') === 'aux'
        && F.tierOf('document', 'source_ids') === 'aux',
        'source_ids is aux at EVERY level — one concept, one tier',
        '         it was core on a section and aux on a document, so the panel '
      + 'nagged about sources both live corpora had already recorded');

  const deps = F.fieldOf('sentence', 'deps');
  check(deps.filledWhen === 'hasDepParse' && deps.stored === false,
        'the dependency parse is a row with no field — `filledWhen` names the predicate');
  check(F.trackableKeys('sentence').includes('deps') && !counted('sentence', 'deps'),
        'trackable, and off by default — a project that does no syntax is not nagged');
  check(!F.trackableKeys('sentence').includes('ingest'),
        'while `ingest`, a surface with no predicate, stays untrackable');

  /* Bibliographic metadata is not somebody's outstanding annotation, and a
     picker offering "1 document needs a publisher" beside "171 words need a
     lemma" buries the second. Derived from the grouping the table already
     declares, not from a list of five names. */
  for (const k of ['authors', 'publisher', 'content_date', 'content_sources', 'notes'])
    check(!F.trackableKeys('document').includes(k), `document.${k} is not trackable`);
  check(F.trackableKeys('word').includes('head') && F.trackableKeys('word').includes('dep_rel'),
        'but `extra` itself is not the rule — word.head and word.dep_rel stay trackable');

  /* Everything counted must be trackable, or a default could not be turned off. */
  const orphan = [];
  for (const lvl of Object.keys(F.FIELD_SPEC))
    for (const k of F.countedKeys(lvl))
      if (!F.trackableKeys(lvl).includes(k)) orphan.push(`${lvl}.${k}`);
  check(orphan.length === 0, 'every counted field is trackable — a default you cannot turn off is a rule',
        orphan.map(x => `         ${x}`).join('\n'));

  /* Stage B, v3.14.307. Both rules are declared in the table by NAME, the same
     arrangement as `tags:`, because the module is required by Node and the
     predicates read app state. */
  check(F.fieldOf('word', 'morphological_parse').vacuousWhen === 'monomorphemic',
        'the parse declares when a record has nothing for it to hold');
  check(!F.fieldOf('word', 'gloss').vacuousWhen,
        'and `gloss` does NOT — `joinGloss` returns the same null for an unglossed word, '
      + 'which is the thing to report rather than excuse');

  const tr = F.fieldOf('word', 'transliterations');
  check(tr.counted === true && tr.appliesWhen === 'scriptDiffers' && tr.tier === 'aux',
        'word.transliterations is counted by opt-in and stays `aux` — conflict ⓪ without a tier move'
          .replace('⓪', '⑧'));
  check(counted('word', 'transliterations') && !counted('morpheme', 'transliterations')
        && !counted('sentence', 'transliterations'),
        'and only at the level a measurement exists for');

  /* v3.14.319: the override store is itself a key on disk. An undeclared one is
     what `schema_conformance_test` refuses, and the first save after stage E
     shipped would have written exactly that. */
  check(F.tierOf('document', 'tracked') === 'derived',
        'the tracked-set override is declared in the table — it is a key on disk');
  check(!F.trackableKeys('document').includes('tracked'),
        'and is not itself trackable, which would be the tracker counting its own setting');

  /* v3.14.306 declared the pre-G31 scalar `free_translation` because `sentTrans`
     read it and a counter is exactly the consumer a missing declaration blinds.
     D58 §3, v3.14.386: the reader went, so the declaration went with it — a
     declared key nothing reads is the same failure in the other direction, and
     PRACTICES §5 does not distinguish them. The pair below is the shape of that
     argument, asserted rather than assumed: the field is undeclared AND unread,
     and if either half comes back alone this fails. */
  check(F.tierOf('sentence', 'free_translation') == null
        && F.tierOf('paragraph', 'free_translation') == null,
        'the retired translation scalar is declared at neither level');
  check(!/free_translation/.test(decomment(html)),
        '…and nothing in the app reads it, which is why undeclaring it was not cosmetic',
        '         decommented, because the comment recording this deletion names the key');
  /* The CLI is the half that matters most: it was the WRITER, until v3.14.151,
     and its reader outlived its writer by 235 versions. A check that read only
     the app would have watched the app forget a key the scripts still
     remembered - the two-writers shape (PRACTICES section 4) with the two
     writers in different languages.

     Matched as a QUOTED string rather than bare, and that is not a shortcut: a
     python file cannot be decommented reliably (a `#` inside a string is not a
     comment), and code that touches a key writes it quoted while the comments
     recording its retirement write it bare. Matching bare would fail on the two
     comments that exist to say the key is gone, which is the guard reporting
     its own success as a defect - `variation_fields_test` did exactly that
     three times before this. */
  {
    const named = ['corpus_annotate.py', 'corpus_ingest.py'].filter(n =>
      /['"]free_translation['"]/.test(fs.readFileSync(path.join(SRC, 'scripts', n), 'utf8')));
    check(named.length === 0,
          'and neither does the CLI, which used to be the one writing it',
          `         still named in: ${named.join(', ')}`);
  }
}

/* ── 2 · the app asks the table, and walks the traversal ─────────────────────── */
console.log('\nthe counter asks, rather than knows');
{
  const src = fnSrc('LingCoT.html', 'annotationGaps');
  check(!!src, 'annotationGaps() exists');

  check(/trackedKeys\(/.test(src),
        'it reads trackedKeys() — the table\'s default plus this project\'s changes');

  /* The failure this guards against is concrete: someone "simplifies" the
     derivation into a literal list, and the counter then silently stops
     counting the next field anyone declares. Any quoted field name inside the
     function is that mistake starting. */
  const lit = (decomment(src).match(/['"][a-z_]+['"]/g) || [])
        .filter(x => !/^['"](document|section|paragraph|sentence|word|morpheme)['"]$/.test(x));
  check(lit.length === 0,
        'and names no field of its own — no quoted field key survives in the body',
        lit.length ? `         found ${lit.join(', ')}` : '');

  check(/f\.store/.test(src),
        'it honours `store:` — document fields live under metadata and the table is what knows it');
  check(/navigable\.has\(/.test(src),
        'it skips punctuation through _navIndex().navigable — B-151\'s test, not a second one');
  check(!/for \(const sect of sections\(\)\)/.test(src),
        'and grows no tree walk of its own — B-053');

  const nav = fnSrc('LingCoT.html', '_navIndex');
  check(/sects\.push\(sect\)/.test(nav) && /paras\.push\(para\)/.test(nav),
        '_navIndex keeps the containers it already reached, rather than a second walk finding them');
}

/* ── 3 · executed ────────────────────────────────────────────────────────────── */
/* Module-level state the extracted functions read. Taken OUT OF THE SOURCE
   rather than restated: a declaration copied into a guard is a second spelling,
   and the guard would then pass against a shape the app no longer has. */
const consts = ['let _navCache = ', 'let _gapCache = ', 'const _GAP_LEVELS = ']
  .map(sig => {
    const i = html.indexOf(sig);
    if (i === -1) throw new Error(`annotation_gaps_test: ${sig.trim()} not found in LingCoT.html`);
    return html.slice(i, html.indexOf('\n', i));
  }).join('\n');

/* `_GAP_RULES` spans lines, so it is taken by brace matching rather than to the
   end of a line — and taken out of the source either way, for the same reason:
   the predicates ARE the stage B rules, and a guard that reimplemented them
   would be checking its own copy. */
const rulesSrc = (() => {
  const i = html.indexOf('const _GAP_RULES = {');
  if (i === -1) throw new Error('annotation_gaps_test: _GAP_RULES not found in LingCoT.html');
  let depth = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(i, j + 2);
  }
  throw new Error('annotation_gaps_test: _GAP_RULES unterminated');
})();

const NAMES = ['_navIsToken', '_navIndex', 'annotationGaps'];
const HELPERS = ['joinParse', 'sentTransEl', 'sentTrans', '_foldSampleText', '_metaSampleText',
                 '_fieldApplies', '_fieldVacuous', '_fieldFilledBy', 'depHasParse',
                 'trackedOverrides', 'trackedKeys'];

function counterFor(docRec, alsoCount) {
  const S = { docs: [docRec], wordById: new Map(), sentById: new Map() };
  (docRec.sections || []).forEach((sect, si) =>
    (sect.paragraphs || []).forEach((para, pi) =>
      (para.sentences || []).forEach((sent, sx) => {
        S.sentById.set(sent.id, { sent, para, paraIdx: pi, sect, sectIdx: si, sentIdx: sx, docIdx: 0 });
        (sent.words || []).forEach(w =>
          S.wordById.set(w.id, { word: w, sent, para, paraIdx: pi, sect, sectIdx: si }));
      })));
  return new Function('S', 'sections', 'doc', 'resolveTracked', 'fieldOf', 'isEmptyValue',
    'detectScript',
    'let _dataGen = 1;\n' + consts + '\n'
      + HELPERS.map(n => fnSrc('LingCoT.html', n)).join('\n') + '\n'
      + rulesSrc + '\n'
      + NAMES.map(n => fnSrc('LingCoT.html', n)).join('\n') +
    `\nreturn { ${NAMES.join(', ')}, _GAP_RULES, bump: () => { _dataGen++; } };`
  )(S, () => docRec.sections || [], () => docRec,
    /* A project opting a field in goes through `resolveTracked`, which is the
       door the stored override uses — so the guard exercises the same one. */
    (lvl) => F.resolveTracked(lvl, {
      on: [...((alsoCount && alsoCount[lvl]) || [])].map(k => `${lvl}.${k}`) }),
    F.fieldOf, F.isEmptyValue, N.detectScript);
}

/* A document shaped so that every rule above has a case: one field filled and
   one empty at each level, a metadata bag, an untokenized sentence, and a
   punctuation token carrying a morpheme that must not be counted. */
const FIX = {
  id: 'd1',
  metadata: { title: 'Fixture', language: 'tur' },       // translation_language absent
  sections: [
    { id: 'sec1', source_ids: ['src1'], paragraphs: [
      { id: 'p1', sentences: [
        { id: 's1', text: 'Bu evler.', translations: [{ label: '', text: 'These houses.' }],
          words: [
            /* Monomorphemic: no parse to hold, so an empty parse here is vacuous. */
            { id: 'w1', form: 'Bu', gloss: 'this',
              morphemes: [{ id: 'm1', form: 'Bu', gloss: 'this' }] },
            { id: 'w2', form: '.',
              morphemes: [{ id: 'm2', form: '.', gloss: 'PUNCT', part_of_speech: 'PUNCT', type: 'root' }] },
            /* Two morphemes and no parse: the same empty field, and this one IS
               missing. One fixture, both sides of the vacuity rule. */
            { id: 'w3', form: 'evler', gloss: 'houses',
              morphemes: [{ id: 'm3', form: 'ev' }, { id: 'm4', form: 'ler' }] },
          ] },
      ] },
    ] },
    { id: 'sec2', paragraphs: [                            // no source_ids
      { id: 'p2', sentences: [
        { id: 's2', text: 'Sonra.', words: [] },           // untokenized, untranslated
      ] },
    ] },
  ],
};

/* The same document in a non-Latin script, translated into a Latin one: the
   only difference is the script pair, which is the whole of the applicability
   rule. Kept minimal on purpose — anything else that differed would make a
   failure ambiguous. */
const FIX_CJK = {
  id: 'd2', metadata: { title: '书', language: 'cmn' },
  sections: [{ id: 'c1', source_ids: ['s'], paragraphs: [{ id: 'q1', sentences: [
    { id: 'z1', text: '书。', translations: [{ label: '', text: 'A book.' }],
      words: [{ id: 'v1', form: '书', gloss: 'book', morphemes: [{ id: 'n1', form: '书' }] }] },
  ] }] }],
};

console.log('\nexecuted against a document built to exercise every rule');
{
  const api = counterFor(FIX);
  const g = api.annotationGaps();
  const at = (l, k) => g[l][k];
  const say = (l, k) => `${l}.${k} = ${JSON.stringify({ missing: at(l, k).missing, total: at(l, k).total })}`;

  check(at('document', 'language').missing === 0 && at('document', 'language').total === 1,
        'a metadata field that is filled counts as filled', `         ${say('document', 'language')}`);
  check(at('document', 'translation_language').missing === 1,
        'and an absent one as missing — `store: metadata` is read',
        `         ${say('document', 'translation_language')}`);

  /* v3.14.318: `section.source_ids` is `aux` now — the same tier the document's
     has always had — so there is no section row at all by default. One concept,
     one tier; the tiers disagreeing was the defect. */
  check(!('source_ids' in g.section) && Object.keys(g.section).length === 0,
        'a section has no counted field — source_ids is aux at every level now',
        `         section rows: ${JSON.stringify(Object.keys(g.section))}`);
  check(at('paragraph', 'translations').total === 2 && at('paragraph', 'translations').missing === 2,
        'both paragraphs are visited', `         ${say('paragraph', 'translations')}`);

  check(at('sentence', 'words').total === 2 && at('sentence', 'words').missing === 1,
        'the untokenized sentence is reported, which is what keeps the word counts honest',
        `         ${say('sentence', 'words')}`);
  check(at('sentence', 'translations').missing === 1,
        'and its missing translation is separately reported',
        `         ${say('sentence', 'translations')}`);

  check(at('word', 'gloss').total === 2,
        'the full stop is NOT a word to count — 3 tokens, 2 counted',
        `         ${say('word', 'gloss')}`);
  check(at('word', 'gloss').missing === 0 && at('word', 'part_of_speech').missing === 2,
        'a filled field is 0 missing and an empty one counts every record',
        `         ${say('word', 'gloss')} · ${say('word', 'part_of_speech')}`);

  check(at('morpheme', 'gloss').total === 3,
        "the full stop's morpheme goes with it — ensureMorphemes gave it one, and it is not unglossed",
        `         ${say('morpheme', 'gloss')}`);
  check(at('morpheme', 'type').missing === 3 && at('morpheme', 'gloss').missing === 2,
        'the real morphemes are missing their tags',
        `         ${say('morpheme', 'type')} · ${say('morpheme', 'gloss')}`);

  /* A finished field must be PRESENT at zero, not absent: "nobody started" and
     "it is finished" are the same shape to a reader that only sees found keys. */
  check(at('word', 'gloss').missing === 0 && 'missing' in at('word', 'gloss'),
        'a finished field is present with missing 0 rather than absent');

  /* ── stage B · the two reasons that are not "missing" ───────────────────── */
  const parse = at('word', 'morphological_parse');
  check(parse.vacuous === 1 && parse.missing === 1 && parse.total === 2,
        'one empty parse is vacuous (one morpheme) and one is missing (two) — same empty field',
        `         ${JSON.stringify(parse)}`);

  const wt = at('word', 'transliterations');
  check(wt.applies === false && wt.missing === 0 && wt.total === 2,
        'Latin text translated into a Latin script wants no transliteration — the row is off, '
      + 'and still reports a real denominator',
        `         ${JSON.stringify(wt)}`);

  const cjk = counterFor(FIX_CJK).annotationGaps();
  check(cjk.word.transliterations.applies === true
        && cjk.word.transliterations.missing === 1,
        'the same field in Han text translated into Latin is on, and empty',
        `         ${JSON.stringify(cjk.word.transliterations)}`);

  /* Unknown must not excuse. A corpus with nothing translated yet has no
     metalanguage sample, so the comparison cannot be made — and a field that
     switches itself off on ignorance is worse than one that over-reports. */
  const untranslated = JSON.parse(JSON.stringify(FIX_CJK));
  untranslated.sections[0].paragraphs[0].sentences[0].translations = [];
  check(counterFor(untranslated).annotationGaps().word.transliterations.applies === true,
        'and an undetectable METAlanguage counts as applies — silence is not an exemption');

  /* And neither side detectable, which is the case a `obj !== meta` test would
     get wrong in the quiet direction: two nulls compare equal, and the field
     would switch itself off having learned nothing. A sample of numerals
     matches no script, which is the shape a freshly ingested corpus can have. */
  const noScript = JSON.parse(JSON.stringify(untranslated));
  noScript.sections[0].paragraphs[0].sentences[0].text = '123.';
  check(counterFor(noScript).annotationGaps().word.transliterations.applies === true,
        'and neither side detectable is still applies — two unknowns are not a match');

  /* A declared rule name that resolves to nothing would silently excuse nothing
     and count everything, or worse, be assumed to work. Every name in the table
     must exist in _GAP_RULES. */
  {
    const rules = Object.keys(api._GAP_RULES);
    const dangling = [];
    for (const lvl of Object.keys(F.FIELD_SPEC))
      for (const f of F.fieldsOf(lvl))
        for (const k of ['vacuousWhen', 'appliesWhen'])
          if (f[k] && !rules.includes(f[k])) dangling.push(`${lvl}.${f.key} ${k}=${f[k]}`);
    check(dangling.length === 0,
          `every declared rule name resolves — ${rules.length} in _GAP_RULES`,
          dangling.map(x => `         ${x}`).join('\n'));
  }

  /* `filledWhen`, executed — a row with no field of its own. */
  {
    const ON = { sentence: ['deps'] };
    check(g.sentence.deps === undefined, 'deps is absent until a project asks for it');

    const off = counterFor(FIX, ON).annotationGaps().sentence.deps;
    check(off && off.total === 2 && off.missing === 2,
          'opted in, both sentences report as needing a parse',
          `         ${JSON.stringify(off)}`);

    /* The ROOT case, which is the whole reason the predicate is `depHasParse`
       and not a truthiness test: a root stores `head === null`. A sentence whose
       only marked word is the root IS parsed. */
    const rooted = JSON.parse(JSON.stringify(FIX));
    rooted.sections[0].paragraphs[0].sentences[0].words[0].head = null;
    const r = counterFor(rooted, ON).annotationGaps().sentence.deps;
    check(r.missing === 1,
          'a sentence whose only mark is a root (head === null) counts as parsed',
          `         ${JSON.stringify(r)} — a truthiness check would miss every root`);

    /* And a dep_rel alone is enough, which is the other half of the predicate. */
    const rel = JSON.parse(JSON.stringify(FIX));
    rel.sections[0].paragraphs[0].sentences[0].words[0].dep_rel = 'nsubj';
    check(counterFor(rel, ON).annotationGaps().sentence.deps.missing === 1,
          'and so is a dep_rel with no head');
  }

  /* Ids are opt-in — the expensive half, held only for what a panel shows. */
  check(at('word', 'part_of_speech').ids === null,
        'ids are null when not asked for');
  const g2 = api.annotationGaps({ ids: ['word.part_of_speech', 'word.morphological_parse'] });
  check(JSON.stringify(g2.word.part_of_speech.ids) === '["w1","w3"]',
        'and are the ids of the records that lack the field when they are',
        `         got ${JSON.stringify(g2.word.part_of_speech.ids)}`);
  check(JSON.stringify(g2.word.morphological_parse.ids) === '["w3"]',
        'a vacuous record is NOT in the list — "go to the next one" must not stop where there is nothing to type',
        `         got ${JSON.stringify(g2.word.morphological_parse.ids)}`);
  check(g2.word.gloss.ids === null,
        'and only for the fields asked for — one row\'s ids do not pay for every row\'s');

  /* The memo keys on the REQUEST as well as _dataGen, or asking for ids would
     hand back the cached id-less answer forever. */
  check(api.annotationGaps({ ids: ['word.part_of_speech', 'word.morphological_parse'] }) === g2,
        'the same question is memoised');
  check(api.annotationGaps() !== g2,
        'a different question is not answered from that memo');
  const g3 = api.annotationGaps();
  api.bump();
  check(api.annotationGaps() !== g3, 'and a data change invalidates it');
}

/* ── 4 · the real corpora, printed ───────────────────────────────────────────── */
console.log('\nthe corpora on disk');
{
  const dir = corpusDir();
  if (!dir) {
    console.error('\n  FAIL  no test corpus available — cannot check the counter against real data\n');
    console.error('  Set $LINGCOT_TEST_CORPUS, or put a corpus in samples/.');
    console.error('  A guard with no data has checked nothing and must never report success.\n');
    process.exit(1);
  }
  const files = corpusFilesIn(dir);
  check(files.length > 0, `${files.length} corpus file(s) in ${dir}`);

  for (const file of files) {
    const { items } = loadCorpus(file, 'the missing-annotation counter');
    for (const d of items) {
      const api = counterFor(d);
      const g = api.annotationGaps();
      const nav = api._navIndex();
      console.log(`\n  ${path.basename(file)} — ${nav.sents.length} sentences · `
                + `${nav.words.length} tokens, ${nav.navigable.size} navigable`);

      let bad = [];
      for (const lvl of Object.keys(g)) {
        for (const [k, v] of Object.entries(g[lvl])) {
          if (v.missing > v.total || v.missing < 0) bad.push(`${lvl}.${k} ${v.missing}/${v.total}`);
          const flag = !v.applies ? '  not applicable'
                     : v.total === 0 ? '  (no records)'
                     : v.missing === 0 ? '  done' : '';
          const vac = v.vacuous ? `  · ${v.vacuous} with nothing to hold` : '';
          console.log(`      ${(lvl + '.' + k).padEnd(34)} ${String(v.missing).padStart(4)} missing`
                    + ` of ${String(v.total).padStart(4)}${flag}${vac}`);
        }
      }
      check(bad.length === 0, `${path.basename(file)}: no count exceeds its own total`,
            bad.map(x => `         ${x}`).join('\n'));
      const sums = [];
      for (const lvl of Object.keys(g))
        for (const [k, v] of Object.entries(g[lvl]))
          if (v.missing + v.vacuous > v.total) sums.push(`${lvl}.${k}`);
      check(sums.length === 0,
            `${path.basename(file)}: missing + vacuous never exceeds the records counted`,
            sums.map(x => `         ${x}`).join('\n'));
      check(g.word.gloss.total === nav.navigable.size,
            `${path.basename(file)}: word rows total exactly the navigable tokens`,
            `         ${g.word.gloss.total} counted vs ${nav.navigable.size} navigable`);
      check(g.sentence.words.total === nav.sents.length,
            `${path.basename(file)}: sentence rows total exactly the sentences`);
    }
  }
}

/* ── 5 · what a toggle costs (B-167) ─────────────────────────────────────────── */
console.log('\nthe tracker toggle is a metadata write');
{
  /* Measured in a real session before this was fixed: one checkbox appended
     123,229 chars to the journal, because `setTracked` mutated the document
     DEEP and D50 writes whole records. The tracked set is a field on the
     document and this path touches no child of it, so the claim is that the
     journal record it produces carries none of the tree.

     Asserted on the RECORD rather than on the source, because "does it say
     shallow: true" is a spelling and "does it carry 153 words" is the cost. */
  const ctx2 = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx2, appSources());
  if (errs.length) {
    check(false, 'the app boots for the toggle check', errs[0][1].message);
  } else {
    const run2 = e => vm.runInContext(e, ctx2);
    const cp = requireCorpus('turkish', 'the tracker toggle');
    ctx2.__corpus = loadCorpus(cp).records;
    run2("applyCorpus(__corpus, 'toggle');");
    run2("journalReset();");
    run2("setTracked('sentence', 'deps', true);");
    const recs = run2('_journal.map(r => ({ op: r.op, shallow: !!r.shallow, '
                    + 'bytes: JSON.stringify(r).length, kids: Object.keys(r.rec || {})'
                    + '.filter(k => CHILD_KEYS.includes(k)) }))');
    check(recs.length === 1, `one toggle is one journal record`,
          `${recs.length}: ${JSON.stringify(recs)}`);
    const r = recs[0] || {};
    check(r.shallow === true, 'and it is a shallow put', JSON.stringify(r));
    check((r.kids || []).length === 0,
          'carrying none of the document\'s children — CHILD_KEYS is what a shallow put strips',
          `carries ${JSON.stringify(r.kids)}`);
    /* The number is the point. A deep put of this corpus is tens of KB; the
       ceiling is generous so the guard survives a bigger fixture, and a deep
       put fails it by an order of magnitude rather than by a margin. */
    const whole = run2('JSON.stringify(doc()).length');
    check(r.bytes < whole / 4,
          `the record is a fraction of the document, not the whole of it`,
          `record ${r.bytes} B vs document ${whole} B`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
