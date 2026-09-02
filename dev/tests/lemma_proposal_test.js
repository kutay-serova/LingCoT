#!/usr/bin/env node
/* =============================================================================
   lemma_proposal_test.js — D61 sources 1-3, and the silence of source 3
   Run:  node dev/tests/lemma_proposal_test.js
   =============================================================================
   The lemma field is typed by hand for every token, and L-034 measured 135 of
   310 glossed-token decisions as re-decisions of a form already decided. D61
   proposes instead of asking again — from three places, each carrying where it
   came from, because the source is what makes a proposal decidable:

     1  the token's own dictionary entry   dict_id → lemma_id. Not a guess.
     2  the same form, already lemmatised  a decision the annotator made, given
                                           back with its count. The one that pays.
     3  the root the parse names           + the language's rule for writing a
                                           citation form. Silent without one.

   Source 4 of the sketch — string similarity — is DEFERRED, and section 5 holds
   that: `git`/`gid` is edit distance 1 and correct, `git`/`bit` is distance 1
   and a different word, so a shape match would have to be checked every time,
   which is most of the work this exists to save.

   EXECUTED. The proposer, the citation rule and the strip are all run against
   corpora built here, through `applyCorpus` and `applyDict` rather than by
   poking state — an earlier probe in this session set `S.dictionary` but not
   the index built beside it and reported a feature working that was not.

   WHAT SECTION 4 IS FOR. The whole argument for shipping source 3 is that it
   can say NOTHING. A rule table that always answers is a table that is wrong on
   every language nobody has written a rule for, and this project's own fixture
   set makes that concrete: Mandarin has no citation morphology at all.
   ============================================================================= */

const vm = require('vm');
const { read, readRoot } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
const run = expr => vm.runInContext(expr, ctx);

/* The SHIPPED table, not a fixture of one. The harness has no pywebview, so the
   file is read here and handed over exactly as `loadCitationForms` would — the
   rules being tested are then the rules that ship. */
ctx.__cf = JSON.parse(read('resources/citation_forms.json'));
run('CITATION_FORMS = __cf;');
ctx.__loc = JSON.parse(read('resources/locale/en.json'));
run('_LOCALE = __loc;');
check(Object.keys(ctx.__cf).filter(k => k !== '_doc').length >= 2,
      `citation_forms.json ships rules for ${Object.keys(ctx.__cf).filter(k => k !== '_doc').length} language(s)`);

/* THE REAL ALIAS MAP, built by the app's own code from the shipped file — the
   same slice `lang_resolve_test` takes. This is not ceremony: the first version
   of this table was keyed `tur`/`zho` (ISO 639-3, what the corpora store) while
   `_corpusLangCode` resolves those to `tr` and `zh-hans`, so the table was never
   consulted at all — and this guard passed, because it called `citationForm`
   with the same wrong code the table used. A guard that hard-codes the key
   cannot see that class of mistake. */
{
  const maps = read('modules/language_maps.js');
  const body = maps.slice(maps.indexOf('const ltc = {}'),
                          maps.search(/LANG_TO_CANONICAL\s*=\s*ltc\s*;/));
  ctx.__codes = JSON.parse(read('resources/language_codes.json'));
  run(`(() => { const langs = __codes.languages; ${body} LANG_TO_CANONICAL = ltc; })()`);
  check(run("Object.keys(LANG_TO_CANONICAL).length") > 100, 'the real language alias map is built');
}
const canon = raw => run(`LANG_TO_CANONICAL[${JSON.stringify(raw)}] || ${JSON.stringify(raw)}`);
const TR = canon('tur'), ZH = canon('zho');
check(TR === 'tr' && ZH.startsWith('zh'),
      `the corpora's codes resolve: tur → ${TR} · zho → ${ZH}`,
      '         the table must be keyed by what this resolves TO');
for (const [raw, code] of [['tur', TR], ['zho', ZH]])
  check(!!(ctx.__cf[code] || ctx.__cf[String(code).split('-')[0]]),
        `citation_forms.json has an entry reachable from "${raw}" (→ ${code})`,
        '         an entry keyed by a code the app never produces is dead data');

/* ── fixtures ──────────────────────────────────────────────────────────────── */
/* `record_type: 'lemma'` is what tells a lemma record from a dictionary entry in
   the one file they share (B-119). A fixture without it lands in `S.dictionary`
   instead of `S.lemmas`, `lemmaFormOf` returns '' for every id, and every
   source-2 check reports the feature broken when the fixture is. Written the
   way the app writes them. */
const LEM  = { record_type: 'lemma', id: 'lem_yur', form: 'yürümek' };
const LEM2 = { record_type: 'lemma', id: 'lem_bah', form: 'bahçe' };
const ENTRY = { id: 'ent_1', form: 'yürüyordu', type: 'word', part_of_speech: 'VERB',
                gloss: 'was walking', lemma_id: 'lem_yur' };

const word = (o) => Object.assign({ id: 'w_x', form: 'x', morphemes: [] }, o);

function corpus(words, lang) {
  return [{
    id: 'doc1', metadata: { title: 't', language: lang },
    sections: [{ id: 's1', title: 's', paragraphs: [{ id: 'p1', sentences: [
      { id: 'sent1', text: words.map(w => w.form).join(' '), words }] }] }],
  }];
}
function load(words, lang, dict) {
  ctx.__docs = corpus(words, lang);
  ctx.__dict = dict || [];
  run("applyCorpus(__docs, 'd61'); applyDict(__dict, 'd61'); _lemmaSeenCache = { key: '', out: null };");
}
const forms = ps => ps.map(p => p.form);
const props = id => run(`JSON.stringify(lemmaProposals(findWord('${id}')?.word))`);
const P     = id => JSON.parse(props(id));

console.log('\n1 · source 2 — the decision already made, handed back');

load([
  word({ id: 'w1', form: 'yürüyordu', lemma_id: 'lem_yur' }),
  word({ id: 'w2', form: 'yürüyordu', lemma_id: 'lem_yur' }),
  word({ id: 'w3', form: 'yürüyordu' }),                    // the one being annotated
], 'tur', [LEM]);

{
  const p = P('w3');
  check(forms(p).includes('yürümek'),
        'a form lemmatised elsewhere in this corpus is proposed',
        `         got ${JSON.stringify(p)}`);
  const hit = p.find(x => x.form === 'yürümek');
  check(hit && hit.src === 'corpus', 'and it is labelled as coming from the corpus');
  check(hit && /\b2\b/.test(hit.why),
        'with the COUNT, which is the evidence',
        `         why = ${hit && JSON.stringify(hit.why)} — "2 tokens" is what makes\n`
      + '         this decidable rather than a guess with a button');
}

/* A token must not propose its own lemma back to itself. */
load([word({ id: 'w1', form: 'yürüyordu', lemma_id: 'lem_yur' })], 'tur', [LEM]);
check(P('w1').every(x => x.src !== 'corpus'),
      'a token is not its own evidence',
      '         one lemmatised token would otherwise propose its own answer and\n'
    + '         report "1 token of this form" for itself');

/* Two lemmas for one form: BOTH, with counts. Zero forms in the live corpora
   disagree today — that is a fact about today, not a rule (B-161). */
load([
  word({ id: 'w1', form: 'yüz', lemma_id: 'lem_yur' }),
  word({ id: 'w2', form: 'yüz', lemma_id: 'lem_bah' }),
  word({ id: 'w3', form: 'yüz', lemma_id: 'lem_bah' }),
  word({ id: 'w4', form: 'yüz' }),
], 'tur', [LEM, LEM2]);
{
  const p = P('w4').filter(x => x.src === 'corpus');
  check(p.length === 2, 'a homograph proposes BOTH lemmas, not a winner',
        `         got ${JSON.stringify(forms(p))} — picking one asserts an identity\n`
      + '         the data does not support');
  check(p[0] && p[0].form === 'bahçe',
        'ordered by how often each was chosen',
        `         got ${JSON.stringify(forms(p))}; 2 tokens should outrank 1`);
}

/* THE FOLD, and a case where the wrong one is visibly wrong. Turkish `I` lowers
   to `i` under `toLowerCase` and to `ı` under the language's own rule, so these
   two tokens are the same word to `normForm` and two different words to a naive
   comparison (B-043). Every other fixture here folds identically under both,
   which is why a mutation swapping them in passed. */
/* Through the canonical code, as `refreshFoldContext` does. `CASE_TAILORED_LOCALES`
   is keyed `tr`; passing the corpus's raw `tur` sets no locale and folds nothing,
   which is how the first run of this check reported the app broken. */
run(`setFoldContext(${JSON.stringify(TR)}, '');`);
load([
  word({ id: 'w1', form: 'Işık', lemma_id: 'lem_bah' }),
  word({ id: 'w2', form: 'ışık' }),
], 'tur', [LEM2]);
check(P('w2').some(x => x.src === 'corpus'),
      'a sentence-initial Turkish I folds to the same form as ı',
      `         got ${JSON.stringify(P('w2'))} — under toLowerCase these are\n`
    + '         "işık" and "ışık", two different words, and the proposal vanishes');

console.log('\n2 · source 1 — the link the token already carries');

load([word({ id: 'w1', form: 'yürüyordu', dict_id: 'ent_1' })], 'tur', [LEM, ENTRY]);
{
  const p = P('w1');
  const hit = p.find(x => x.src === 'entry');
  check(!!hit && hit.form === 'yürümek',
        "a linked token proposes its entry's lemma",
        `         got ${JSON.stringify(p)}`);
  check(p[0] && p[0].src === 'entry',
        'and it ranks first — it is not a guess at all',
        `         got ${JSON.stringify(p.map(x => x.src))}`);
}

console.log('\n3 · source 3 — the root, written the way the language writes a lemma');

/* Turkish -mAk, both harmony classes, from the shipped table. */
const cf = (root, pos, lang) => run(`citationForm(${JSON.stringify(root)}, ${JSON.stringify(pos)}, ${JSON.stringify(lang)})`);
check(cf('yürü', 'VERB', TR) === 'yürümek', "front vowels take -mek",  `         got ${cf('yürü','VERB',TR)}`);
check(cf('git',  'VERB', TR) === 'gitmek',  "and 'git' likewise",       `         got ${cf('git','VERB',TR)}`);
check(cf('oku',  'VERB', TR) === 'okumak', "back vowels take -mak",    `         got ${cf('oku','VERB',TR)}`);
/* DISHARMONIC ROOTS, and they are the only ones that test the rule. `yürü`,
   `oku` and `salla` all have their first and last vowel in the SAME class, so a
   rule reading the first vowel gets every one of them right — the first draft of
   this check used `salla` and a mutation that read the first vowel passed. These
   two are real Turkish verbs whose vowels disagree. */
check(cf('kaybet', 'VERB', TR) === 'kaybetmek',
      "a disharmonic root cites by its LAST vowel — kaybet + mek",
      `         got ${cf('kaybet','VERB',TR)}; reading the first vowel (a, back)\n`
    + '         gives the non-word "kaybetmak"');
check(cf('affet', 'VERB', TR) === 'affetmek',
      "and affet likewise",
      `         got ${cf('affet','VERB',TR)}`);
check(cf('bahçe', 'NOUN', TR) === 'bahçe', 'a Turkish noun cites as the bare root');

/* The root the parse names. */
load([word({ id: 'w1', form: 'yürüyordu', part_of_speech: 'VERB',
             morphological_parse: 'yürü-yor-DI',
             morphemes: [{ form: 'yürü', type: 'word' },
                         { form: 'yor', type: 'bound.morpheme' },
                         { form: 'DI',  type: 'bound.morpheme' }] })], 'tur', []);
{
  const p = P('w1');
  check(forms(p).includes('yürümek'),
        'the parse gives the root and the table writes the citation form',
        `         got ${JSON.stringify(p)}`);
  check(p.find(x => x.form === 'yürümek')?.src === 'parse', 'labelled as coming from the parse');
}

/* A PREFIX, because a suffixing fixture cannot tell "the first free morpheme"
   from "the first morpheme". The app supports prefixes and the rule has to be
   about boundness, not position — a mutation dropping the type test passed
   against Turkish alone. */
check(run(`_lemmaRoot(${JSON.stringify({ form: 'unhappy', morphological_parse: 'un-happy',
  morphemes: [{ form: 'un', type: 'bound.morpheme' }, { form: 'happy', type: 'word' }] })})`) === 'happy',
      'the root is the first FREE morpheme, not the first one',
      '         a prefix is not a lexeme, and citing from it gives "unmek"');

/* A word with no parse is one segment — its own form. */
load([word({ id: 'w1', form: 'bahçe', part_of_speech: 'NOUN' })], 'tur', []);
check(forms(P('w1')).includes('bahçe'),
      'a word with no parse is one segment, so its own form is the root',
      `         got ${JSON.stringify(P('w1'))}`);

console.log('\n4 · source 3 must be able to say NOTHING');

check(cf('下午', 'NOUN', ZH) === null,
      'Mandarin has no citation morphology, and the table says so',
      '         `zho: {}` is present and empty ON PURPOSE — an omission would\n'
    + '         read as "not written yet" and invite someone to fill it in');
check(Object.prototype.hasOwnProperty.call(ctx.__cf, String(ZH).split('-')[0]),
      'and it is present rather than omitted, so the silence is a decision');
check(cf('x', 'VERB', 'xyz') === null, 'an unknown language proposes nothing');

/* The script-tag fallback, with a FIXTURE rule — and it needs one. The shipped
   `zh` entry is empty on purpose, so `zh-hans` and `zh` both correctly answer
   null and a mutation removing the fallback passed. This puts a rule under the
   base code and asks whether the script-tagged canonical reaches it, which is
   the only way to see the fallback at all. Restored immediately after. */
run("__saved = CITATION_FORMS['zh']; CITATION_FORMS['zh'] = { pos: { NOUN: { suffix: '\u00b7X' } } };");
check(cf('下午', 'NOUN', ZH) === '下午·X',
      `a script-tagged canonical (${ZH}) falls back to its base code`,
      `         got ${JSON.stringify(cf('下午', 'NOUN', ZH))} — citation morphology does\n`
    + '         not differ by script, and a table would otherwise need one entry\n'
    + '         per script tag for every language that has them');
run("CITATION_FORMS['zh'] = __saved;");
check(cf('下午', 'NOUN', ZH) === null, 'and the shipped table is restored');
check(cf('x', 'INTJ', TR) === null, 'a part of speech with no rule proposes nothing');
check(cf('x', '', TR) === null, 'no part of speech, no proposal');
check(cf('bcd', 'VERB', TR) === null,
      'a harmony rule whose class cannot be determined proposes nothing',
      '         a root with no vowel the table knows has no alternant, and\n'
    + '         guessing one is exactly what this source must not do');

load([word({ id: 'w1', form: '下午', part_of_speech: 'NOUN',
             morphemes: [{ form: '下' }, { form: '午' }] })], 'zho', []);
check(P('w1').every(x => x.src !== 'parse'),
      'and a Mandarin token gets no parse-based proposal at all',
      `         got ${JSON.stringify(P('w1'))}`);

console.log('\n5 · source 4 is deferred, and stays deferred');

const src = read('LingCoT.html');
check(!/levenshtein|editDistance|edit_distance|damerau/i.test(src),
      'no string-similarity measure has appeared',
      '         D61 defers source 4: `git`/`gid` is distance 1 and correct,\n'
    + "         `git`/`bit` is distance 1 and a different word — the measure\n"
    + '         cannot tell them apart and every proposal would need checking');

console.log('\n6 · executed: what the strip does with them');

load([
  word({ id: 'w1', form: 'yürüyordu', lemma_id: 'lem_yur' }),
  word({ id: 'w2', form: 'yürüyordu' }),
], 'tur', [LEM]);
{
  const w2 = run("JSON.stringify(findWord('w2').word)");
  ctx.__w = JSON.parse(w2);
  const empty = run("lemmaStripHtml('', 'ew-lemma', '', __w)");
  check(/offer-chip/.test(String(empty)),
        'an EMPTY lemma field offers the proposals',
        '         this is the state the strip previously had nothing to say in');
  check(/yürümek/.test(String(empty)), 'and names the proposed form');

  /* Once something is typed the annotator is answering, and the strip goes back
     to saying what saving will do. A proposer that kept arguing would be
     L-031's placeholder-versus-value mistake one field over. */
  const typed = String(run("lemmaStripHtml('yürüm', 'ew-lemma', '', __w)"));
  check(!/lemma\.why\.|token\(s\) of this form/.test(typed),
        'a field being typed into is not re-proposed at',
        `         ${typed.slice(0, 200)}`);

  /* And a lemma field with no token behind it — the dictionary entry editor —
     gets nothing, because "the same form elsewhere in the corpus" is a fact
     about a token and not about a lexicon record. */
  check(String(run("lemmaStripHtml('', 'dict-lemma', '')")) === '',
        'a lemma field with no token behind it proposes nothing');
}

console.log('\n7 · nothing here writes');

const fn = (src.match(/function lemmaProposals\(word\)[\s\S]*?\n\}/) || [''])[0];
check(fn.length > 0, 'lemmaProposals found');
check(!/mutate\(|\bword\.[a-z_]+\s*=|stampField|_resolveOrCreateLemma/.test(fn),
      'lemmaProposals only reads',
      '         a proposal is text in a field until it is accepted, and\n'
    + '         `_resolveOrCreateLemma` stays the only thing that makes a record');
/* Scoped to THIS branch. The bare string also appears in the POS strip, so an
   unscoped search passed while the lemma proposals had lost their mark. */
const stripFn = (src.match(/function lemmaStripHtml\([\s\S]*?\n  \}/) || [''])[0];
check(/act: 'set', src: 'lexicon'/.test(stripFn),
      "an accepted proposal is marked as the app's, not the annotator's",
      '         `src` becomes `dataset.offerSrc`, which saveWord reads to stamp\n'
    + '         the field derived (B-165). Four bugs in this project have been\n'
    + "         exactly this: the app's answer signed with a person's name");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
