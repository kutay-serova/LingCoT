#!/usr/bin/env node
/* =============================================================================
   autolink_test.js, a word gets the dictionary link a morpheme always got
   Run:  node dev/tests/autolink_test.js
   =============================================================================
   D35 stage A3. Measured on the fixture before this landed: 19 of 20 morphemes
   carried a dict_id, against 12 of 98 words. A morpheme gets one from the fill
   path; a word only got one if the annotator ticked "save to dictionary". The
   gap is the two paths differing, and it is the only part of D35 that expires,
   because a link never written cannot be reconstructed afterwards.

   Three rules, and the third is the one that is easy to lose:

     one match   → link, stamped derived
     several     → write NOTHING (the guess is what LINKING_AUDIT called
                   "arbitrary, not correct")
     an existing link is never overwritten, because it may have been chosen
     against a homograph and this code cannot know better

   "Stamped derived" is load-bearing rather than cosmetic: it is what lets the
   rest of the app tell a match the app made from a link a person checked.
   B-061 got that wrong twice and B-083 is the same distinction again.
   ============================================================================= */

const { read, fnSrc, decomment } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read('LingCoT.html');
const src  = decomment(html);

/* -- 1. it exists and the save path calls it ----------------------------- */
check(/function autoLinkToken\s*\(/.test(html), 'autoLinkToken() is defined');
check(/function autoLinkWord\s*\(/.test(html),  'autoLinkWord() is defined');

const saveWord = fnSrc('LingCoT.html', 'saveWord');
check(/autoLinkWord\(word\)/.test(saveWord), 'saveWord links the token it just saved');

/* The push may create the very entry the token should link to, so the link has
   to happen after it, not before. */
const iPush = saveWord.indexOf('createEntries(');   // v3.14.267, was _pushTokenToDict
const iLink = saveWord.indexOf('autoLinkWord(');
check(iPush !== -1 && iLink > iPush,
      'the link runs after the dictionary push',
      'linking first misses the entry the push just created');

/* -- 2. run the rules ----------------------------------------------------- */
{
  const dict = [];
  const notes = [];
  const ctx = {
    lookupDict: form => dict.filter(e => e.form.toLowerCase() === form.toLowerCase()),
    linkNote:   (key, vars) => notes.push({ key, vars }),
    _derivedFieldProv: () => ({ annotator_id: null, annotator: 'auto (lexicon)',
                                date: '2026-01-01', derived: true }),
  };
  /* v3.14.260: autoLinkToken is a caller of linkTo now, which is where the
     rule lives, so the chokepoint comes along. */
  /* v3.14.261, B-137: linkTo writes through `stampField`, the one writer of a
     field_prov entry. Stubbed to record the moment un-interned, because what
     these cases assert is WHICH moment was chosen, not the table mechanics —
     prov_intern_test owns those. */
  const fn = new Function('lookupDict', 'linkNote', '_derivedFieldProv', 'prov', 'stampField',
    `${fnSrc('LingCoT.html', 'linkTo')}\n${fnSrc('LingCoT.html', 'autoLinkToken')}\nreturn autoLinkToken;`
  )(ctx.lookupDict, ctx.linkNote, ctx._derivedFieldProv,
    () => ({ annotator_id: 'ann_x', date: '2026-01-01', time: '10:00:00' }),
    (o, f, m) => { if (!o.field_prov) o.field_prov = {}; if (m == null) delete o.field_prov[f]; else o.field_prov[f] = m; });

  // No entry at all.
  const w0 = { form: 'yok' };
  check(fn(w0) === null && !w0.dict_id, 'a form with no entry is left alone');

  // Exactly one.
  dict.push({ id: 'e1', form: 'güneş', type: 'word' });
  const w1 = { form: 'güneş' };
  check(fn(w1) === 'linked', 'a unique match links');
  check(w1.dict_id === 'e1', 'and writes the entry id', `got ${w1.dict_id}`);
  check(w1.field_prov?.dict_id?.derived === true,
        'and stamps it derived, never as a human choice',
        JSON.stringify(w1.field_prov));
  check(w1.field_prov.dict_id.annotator_id === null,
        'with no annotator id, because nobody chose it');

  // Case folding follows lookupDict, as everywhere else.
  const w1b = { form: 'Güneş' };
  check(fn(w1b) === 'linked' && w1b.dict_id === 'e1', 'a case variant still links');

  // Two entries: nothing is written.
  dict.push({ id: 'e2', form: 'yüz', type: 'word' });
  dict.push({ id: 'e3', form: 'yüz', type: 'word' });
  const w2 = { form: 'yüz' };
  check(fn(w2) === 'ambiguous', 'an ambiguous form reports ambiguity');
  check(!w2.dict_id, 'and writes nothing at all', `got ${w2.dict_id}`);
  check(!w2.field_prov, 'not even a provenance stamp');
  check(notes.some(n => n.key === 'note.link.ambiguous'),
        'and says so, rather than failing silently');

  // An existing link is authoritative.
  const w3 = { form: 'güneş', dict_id: 'chosen-by-hand' };
  check(fn(w3) === null && w3.dict_id === 'chosen-by-hand',
        'an existing link is never overwritten',
        'it may have been chosen against a homograph');

  // A blank form is not a lookup.
  check(fn({ form: '' }) === null, 'a token with no form is skipped');
}

/* -- 3. the word AND its morphemes -------------------------------------- */
{
  const body = fnSrc('LingCoT.html', 'autoLinkWord');
  check(/autoLinkToken\(word\)/.test(body), 'the word itself is linked');
  check(/word\.morphemes/.test(body) && /autoLinkToken\(m\)/.test(body),
        'and every morpheme, which is where the link was already reliable');
}

/* -- 4. ONE writer, not an inventory of them -----------------------------
   This was an allow-list of six functions, with a comment per name saying
   whether that writer stamped the link as human or as derived. The comment
   beside the push read "the annotator ticked the box, so the link is
   theirs", and the push stamped nothing at all: 91 of the live
   corpus's 92 links went out unsigned while this guard was green (B-121).

   An allow-list records intentions. `linkTo` (v3.14.260) makes the intention
   structural: `dict_id` and its stamp are written together, in one place, and a
   seventh writer cannot forget the half this one forgot. */
{
  const marks = [...html.matchAll(/\/\/ @fn (\w+)/g)];
  const owner = idx => {
    let last = null;
    for (const m of marks) { if (m.index > idx) break; last = m[1]; }
    return last;
  };
  /* `x.dict_id = …` where x is the token. A provenance MAP also has a
     `dict_id` key — `morphFieldProv.dict_id = mp` in saveWord is the stamp for
     an offer-chip link, not the link — so prov-shaped owners are excluded by
     name. Getting this wrong would report the stamp as an unstamped write. */
  const writers = new Set(
    [...html.matchAll(/\b(\w+)\.dict_id\s*=[^=]/g)]
      .filter(m => !/field_?prov/i.test(m[1]))
      .map(m => owner(m.index))
  );
  const stray = [...writers].filter(w => w !== 'linkTo');
  check(stray.length === 0 && writers.has('linkTo'),
        `dict_id is assigned in exactly one function (${[...writers].join(', ') || 'none'})`,
        `         also written by: ${stray.join(', ')}\n`
        + '         Route it through linkTo(obj, { entry } | { cands }), which writes the\n'
        + '         link and its provenance together. A writer that sets one without the\n'
        + '         other is B-121, and it cannot be repaired afterwards: a stamp records\n'
        + '         who and when, and for a link already written there is neither left.');

  /* And the stamp is not optional inside it. */
  const body = fnSrc('LingCoT.html', 'linkTo');
  check(/stampField\(obj, 'dict_id',/.test(body),
        'and that function stamps in the same breath as it links',
        '         v3.14.261: through stampField, the one writer of a field_prov entry (B-137)');
  check(/chosen \? prov\(\) : _derivedFieldProv\(\)/.test(body),
        'with the who decided by `chosen`, not by which caller it is',
        '         B-122: six writers under two different ambiguity rules is what this replaced');
}

/* The un-interning stamp stub, shared by the behavioural cases below. */
const STAMP = (o, f, m) => { if (!o.field_prov) o.field_prov = {};
  if (m == null) delete o.field_prov[f]; else o.field_prov[f] = m; };

/* -- 5. B-122: ambiguity is resolved in one place, one way ----------------
   `autoLinkToken` refused an ambiguous form and said so; `_dictFillForForm`
   took `cands.find(word || bound.morpheme) || cands[0]` silently, and wrote 76
   of the live corpus's 77 morpheme links that way. It cost nothing only because
   no form in that dictionary is ambiguous, which is luck rather than design. */
{
  const fill = fnSrc('LingCoT.html', '_dictFillForForm');
  check(!/dict_id:/.test(fill),
        '_dictFillForForm no longer picks a link',
        '         it hands over the candidates; linkTo applies the one rule');
  check(/dict_cands:\s*cands/.test(fill),
        'and passes the candidates instead, so the caller cannot silently take the first');

  const body = fnSrc('LingCoT.html', 'linkTo');
  check(/list\.length > 1/.test(body) && /note\.link\.ambiguous/.test(body),
        'linkTo refuses an ambiguous form and says so, for every caller');

  /* Behavioural, not just source: two candidates must produce no link. */
  const two = [{ id: 'd1', form: 'yüz', type: 'word' }, { id: 'd2', form: 'yüz', type: 'root' }];
  const notes = [];
  const fn2 = new Function('lookupDict', 'linkNote', '_derivedFieldProv', 'prov', 'stampField',
    `${fnSrc('LingCoT.html', 'linkTo')}\nreturn linkTo;`
  )(() => two, (k, v) => notes.push(k), () => ({ derived: true }), () => ({}), STAMP);
  const amb = { form: 'yüz' };
  check(fn2(amb) === 'ambiguous' && !amb.dict_id,
        'two candidates: nothing is written, and the caller is told',
        `         got ${JSON.stringify(amb.dict_id)} — the old fill path took cands[0] here`);
  check(notes.includes('note.link.ambiguous'), 'and the annotator sees why');

  const one = { form: 'yüz' };
  const fn3 = new Function('lookupDict', 'linkNote', '_derivedFieldProv', 'prov', 'stampField',
    `${fnSrc('LingCoT.html', 'linkTo')}\nreturn linkTo;`
  )(() => [two[0]], () => {}, () => ({ derived: true }), () => ({ annotator_id: 'ann_x' }), STAMP);
  check(fn3(one) === 'linked' && one.dict_id === 'd1' && one.field_prov.dict_id.derived === true,
        'one candidate: linked, and stamped derived because the app matched it');

  const picked = { form: 'yüz' };
  check(fn3(picked, { entry: two[1], chosen: true }) === 'linked'
        && picked.field_prov.dict_id.annotator_id === 'ann_x',
        'an entry a person picked is stamped as theirs, not derived',
        '         this is what makes "chosen by a person" mean something when D35 B4 lands');
}

console.log('\nB-123 — the backfill, over the tokens nobody opened\n');
{
  const vm = require('vm');
  /* Two words never opened in the editor: one whose form has exactly one entry,
     one whose form has two. Plus a token already linked, which must not move —
     that is the property a backfill is most likely to break and least likely to
     be noticed breaking. */
  const mk = (id, form, extra = {}) => ({ id, form, morphemes: [], ...extra });
  const w1 = mk('w1', 'ev');                                  // unique   → linked
  const w2 = mk('w2', 'yüz');                                 // ambiguous → left
  const w3 = mk('w3', 'ev', { dict_id: 'd_curated' });        // linked    → untouched
  const w4 = mk('w4', 'zzz');                                 // no entry  → counted
  const w5 = mk('w5', 'evler', { morphemes: [{ form: 'ev' }, { form: 'ler' }] });

  const S = {
    wordById: new Map([['w1', { word: w1 }], ['w2', { word: w2 }], ['w3', { word: w3 }],
                       ['w4', { word: w4 }], ['w5', { word: w5 }]]),
    dictById: new Map([['d_curated', { id: 'd_curated', form: 'ev', type: 'word' }]]),
    dictByForm: new Map([
      ['ev',  [{ id: 'd_ev', form: 'ev', type: 'word' }]],
      ['yüz', [{ id: 'd_y1', form: 'yüz' }, { id: 'd_y2', form: 'yüz' }]],
    ]),
  };
  const stamped = [];
  const ctx = vm.createContext({ S, console,
    normForm: x => String(x || '').toLowerCase(),
    lookupDict: f => S.dictByForm.get(String(f).toLowerCase()) || [],
    linkNote: () => {}, prov: () => ({ annotator_id: 'ann_x' }),
    _derivedFieldProv: () => ({ derived: true }),
    stampField: (o, f, m) => { stamped.push([o.id || o.form, f]); (o.field_prov ||= {})[f] = m; },
    isDerived: r => !!r && r.derived === true, fieldProv: (o, k) => (o.field_prov || {})[k] || null });
  for (const n of ['linkTo', 'dictResolution', 'backfillLinks'])
    vm.runInContext(fnSrc('LingCoT.html', n), ctx, { filename: n + '.js' });

  /* Dry run FIRST, and it must write nothing — the confirm is built from it, so
     a dry run with a side effect would do the work before the annotator agreed. */
  const pre = vm.runInContext('backfillLinks({ dryRun: true })', ctx);
  check(pre.linked === 2, `the preview counts what would be linked (${pre.linked})`,
        '         w1 and w5\'s first morpheme; both forms have exactly one entry');
  check(pre.ambiguous === 1 && [...pre.ambiguousForms][0] === 'yüz',
        'and names the ambiguous forms rather than totalling them',
        '         a count of forms that need a person is a fact nobody can act on');
  check(!w1.dict_id && stamped.length === 0, 'a dry run writes nothing at all',
        '         the confirm is built from this, so a side effect here does the work uninvited');

  const r = vm.runInContext('backfillLinks()', ctx);
  check(r.linked === pre.linked, `the run links what the preview promised (${r.linked}/${pre.linked})`,
        '         a confirm that says one number and does another is worse than no confirm');
  check(w1.dict_id === 'd_ev', 'a token with one candidate is linked');
  check(w5.morphemes[0].dict_id === 'd_ev', 'morphemes too, not only words');
  check(!w2.dict_id && r.ambiguous === 1, 'an ambiguous form is left alone, as linkTo refuses it');
  check(w3.dict_id === 'd_curated' && r.alreadyLinked >= 1,
        'and a link that already exists is never overwritten',
        '         a bulk pass that reconsiders settled links is how a backfill loses curation');
  check(!w4.dict_id && r.none >= 1, 'a form with no entry is counted, not invented');
  check(w1.field_prov.dict_id.derived === true,
        'every link it makes is stamped derived — the app matched this, nobody chose it');
  check(r.words.has(w1) && r.words.has(w5),
        'and the words it rewrote are reported, because they are what must be journalled');

  /* No second linking rule. Every safety property above is linkTo's, and a
     backfill that re-implemented one would be B-121 and B-122's shape again. */
  const body = decomment(fnSrc('LingCoT.html', 'backfillLinks'));
  check(/linkTo\(/.test(body), 'the backfill goes through linkTo');
  check(!/\.dict_id\s*=[^=]/.test(body), 'and assigns no dict_id of its own',
        '         a bulk writer with its own linking rule is exactly B-122, at scale');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
