#!/usr/bin/env node
/* =============================================================================
   suggest_mechanism_test.js, one way to propose a value
   Run:  node dev/tests/suggest_mechanism_test.js
   =============================================================================
   D42. Four mechanisms proposed a value to the annotator: the native
   <datalist>, the custom dropdown, chip rows, and the lemma strip. The rule now
   is that if it responds to keystrokes it floats, and if it describes the
   field's standing state it sits — two components, not four.

   The native list is the one being retired, and it is the one that can come
   back by accident: `list="..."` is four characters and looks like it works.
   It does not, reliably: WebKit will not open it on an empty field and ignores
   <option label>, which is why the custom dropdown was written in the first
   place. So this guard refuses it outright.
   ============================================================================= */

const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read('LingCoT.html');
const mods = moduleFiles();
/* Comments are stripped before matching. Every explanation of WHY the native
   list was retired names the tag, and a guard that reads its own rationale as a
   violation is the trap this project keeps falling into. */
const all  = decomment([html, ...mods.map(m => m[1])].join('\n'));

/* ── The native list is gone, and stays gone ─────────────────────────────── */
const listAttrs = [...all.matchAll(/<input[^>]*\slist="([\w-]+)"/g)];
check(listAttrs.length === 0, 'no field uses a native <datalist>',
      listAttrs.map(m => '       list="' + m[1] + '"').join('\n'));

const dlEls = [...all.matchAll(/<datalist[ >]/g)];
check(dlEls.length === 0, 'no <datalist> element is emitted', `${dlEls.length} found`);

/* ── Every field that autocompletes declares which pool it draws from ────── */
const pools = new Set([...html.matchAll(/AC_POOLS = \{([\s\S]*?)\n\};/g)]
  .flatMap(m => [...m[1].matchAll(/^\s{2}(\w+):/gm)].map(x => x[1])));
check(pools.size >= 5, `AC_POOLS defines ${pools.size} pools`,
      'expected at least category, relation, dep_rel, lemma, domain');
for (const need of ['lemma', 'domain'])
  check(pools.has(need), `AC_POOLS.${need} exists`,
        `the ${need} field was moved off <datalist> and needs somewhere to draw from`);

const used = [...all.matchAll(/data-ac-pool="(\w+)"/g)].map(m => m[1]);
check(used.length > 0, `${used.length} fields declare a pool`);
for (const u of new Set(used))
  check(pools.has(u), `data-ac-pool="${u}" names a pool that exists`,
        'a field pointing at a missing pool silently offers nothing');

/* A field can only reach the dropdown if the delegated listeners match it.
   They key on AC_SELECTOR, so a pool without the class is a dead field. */
const sel = /const AC_SELECTOR = '([^']+)'/.exec(html);
check(!!sel, 'AC_SELECTOR is still the single source of truth for which fields autocomplete');
if (sel) {
  const usesClass = sel[1].includes('.ac-input');
  check(usesClass, 'AC_SELECTOR admits .ac-input');
  const poolFields = [...all.matchAll(/<input[^>]*data-ac-pool="[^"]*"[^>]*>/g)].map(m => m[0]);
  const classless = poolFields.filter(f => !/class="[^"]*\bac-input\b/.test(f));
  check(classless.length === 0, 'every pool field carries the class the listeners match',
        classless.map(f => '       ' + f.slice(0, 110)).join('\n'));
}

/* ── The pools are read live, not snapshotted ────────────────────────────── */
/* The quick-create lemma panel used to append an <option> so the new lemma was
   offered immediately. With a live pool that is unnecessary; with a snapshot it
   would be necessary again and nobody would notice it missing. */
const evs = mods.find(m => m[0] === 'events.js');
check(!!evs && !/qlDatalist/.test(evs[1]),
      'the quick-lemma panel no longer tops up a list by hand');

/* ── The strip is one component, not two ─────────────────────────────────── */
for (const gone of ['lemma-strip-ok', 'lemma-strip-new', 'morph-suggest-chips',
                    'morph-suggest-label', 'mc-used', 'mc-parse']) {
  check(!new RegExp(gone).test(all), `the retired class ${gone} is gone from the source`);
  check(!new RegExp('\\.' + gone).test(decomment(read('LingCoT.css'))),
        `and from the stylesheet`);
}
check(/function offerStripHtml\(/.test(html), 'offerStripHtml is the one strip renderer');
/* Delegation, checked against the function's actual body rather than a
   fixed-width window from its name. The window version failed at v3.14.191
   because renderMorphSuggestPanel gained a comment, which is not a change in
   what it delegates to. */
check(/offerStripHtml\(/.test(fnSrc('LingCoT.html', 'lemmaStripHtml')),
      'the lemma strip is a provider for it, not a second implementation');
check(/offerStripHtml\(/.test(fnSrc('LingCoT.html', 'renderMorphSuggestPanel')),
      'and so is the morpheme suggestion panel');

/* ── B-100: the panel that refreshes itself must exist to be refreshed ──────
   renderMorphSuggestPanel returned '' when there was nothing to offer, so the
   host element was absent from the DOM. refreshMorphSuggest opens by looking
   that element up and bailing when it is missing, so a word with no offers at
   the moment word-edit rendered could never acquire any, however much of the
   parse was typed afterwards. The suggestion machinery was not failing; it was
   never being asked.

   The rule stated once: a renderer whose output is later patched in place by id
   must always emit the element carrying that id. */
{
  const body = fnSrc('LingCoT.html', 'renderMorphSuggestPanel');
  const empty = /if \(!offers\.length\) return ([^;]+);/.exec(body);
  check(!!empty, 'renderMorphSuggestPanel has an explicit no-offers return');
  check(!!empty && /morph-suggest-panel/.test(empty[1]),
        'and it still renders the host element',
        `returns ${empty ? empty[1] : '(not found)'} — refreshMorphSuggest cannot find that`);

  const refresh = fnSrc('LingCoT.html', 'refreshMorphSuggest');
  check(/getElementById\('morph-suggest-panel'\)/.test(refresh) && /if \(!host/.test(refresh),
        'refreshMorphSuggest still bails on a missing host, which is why the above matters');
}

/* ── One accept path, and it is the thing that stamps provenance ─────────── */
const takes = [...all.matchAll(/data-action="offer-take"/g)].length;
check(takes >= 1, 'offers are taken through one action name');
check(/function takeOffer\(/.test(html), 'which reaches exactly one handler');

/* This is the point of D42 and the reason B-061 cannot recur: the accept path
   marks the field, and the save reads the mark. Assert BOTH ends — either alone
   is a mechanism that quietly does nothing. */
check(/dataset\.offerSrc = src/.test(html),
      'taking an offer marks the field it wrote into');
check(/from \? _offerMoment\(from\) : p/.test(html),
      'and stampFieldProv stamps a marked field as derived, not as the annotator');
/* D40 stage D: `_offerMoment` is derived either way; a `corpus:<id>` mark adds
   the source through _copyFieldProv, which spreads _derivedFieldProv. */
check(/_copyFieldProv\(src\.slice\(7\)\) : _derivedFieldProv\(\)/.test(fnSrc('LingCoT.html', '_offerMoment') || '') &&
      /\.\.\._derivedFieldProv\(/.test(fnSrc('LingCoT.html', '_copyFieldProv') || ''),
      'and _offerMoment is derived for every mark, naming the source for a corpus copy');
/* v3.14.280: was `from: offerSrcOf('ew-gloss')`, which pinned the spelling of
   ONE source of the mark. B-141 added a second — a value the app assembled from
   the morphemes is no more the annotator's than one taken from a chip — so the
   pin failed on a change that made the rule MORE true. Folded into the rule
   instead of repaired: what matters is that the word's three derived fields each
   reach `stampFieldProv` with a `from`, whatever computes it. */
{
  const save = decomment(fnSrc('LingCoT.html', 'saveWord'));
  /* v3.14.330. This used to name three fields — gloss, transliterations,
     morphological_parse — and `part_of_speech` was the fourth line in the same
     literal, without a `from:`, unchecked. That is B-165's shape exactly: a
     guard that lists what to check cannot notice the thing it was not told
     about, and a declaration is only as good as what it admits exists
     (PRACTICES §5).

     So the list comes from the CALL, not from here: every field in the
     `stampFieldProv` literal must carry a `from:`. A field added tomorrow is
     covered on the day it is added, and one quietly losing its mark fails by
     name. Verified by mutation — removing `part_of_speech`'s `from:` was
     invisible to the old assertion and is not to this one. */
  const lit = save.match(/stampFieldProv\(word,\s*\{([\s\S]*?)\n\s*\}\);/);
  check(!!lit, 'saveWord stamps the word\'s fields through one literal');
  const fields = [...(lit?.[1] || '').matchAll(/^\s{4}(\w+):\s*\{([^}]*)\}/gm)]
    .map(m => ({ key: m[1], body: m[2] }));
  check(fields.length >= 4,
        `${fields.length} word field(s) stamped there`,
        '         fewer than four means the match broke, not that the literal shrank');
  const missing = fields.filter(f => !/\bfrom:/.test(f.body)).map(f => f.key);
  check(missing.length === 0,
        'and EVERY field in it passes a mark — the list is the literal, not a list here',
        `         no \`from:\` for ${missing.join(', ')} — an unmarked field is stamped as the annotator's`);
  check(/offerSrcOf\(/.test(save) && /_derivedFields\.has\(/.test(save),
        'and the mark has both its sources: an offer taken, and a value derived here',
        '         B-061 was one of these; B-141 was the other, three occurrences later');
}
/* B-165, v3.14.330: the morpheme marks were three separate literals and only
   the gloss asked for `offerSrc`. One rule, read per input, so the assertion is
   that ALL THREE offerable fields reach the stamp through it — naming them
   individually is how two of them came to be missed. */
{
  const save = decomment(fnSrc('LingCoT.html', 'saveWord'));
  check(/dataset\.offerSrc\s*\?\s*_offerMoment\(el\.dataset\.offerSrc\)/.test(save),
        'a morpheme field marked by an offer is stamped derived, read from the input');
  const stamped = ['gloss', 'part_of_speech', 'type']
    .filter(f => new RegExp(`_mStamp\\('${f}'`).test(save));
  check(stamped.length === 3,
        'and every field an offer can write goes through it (gloss, POS, type)',
        `         only ${stamped.join(', ') || 'none'} — B-165 was the two that did not`);
}

/* A mark that is never cleared would stamp the annotator's own later edit as
   derived. It is cleared on a TRUSTED input event only, because takeOffer
   dispatches an untrusted one to refresh the strip. */
const evsrc = mods.find(m => m[0] === 'events.js')[1];
check(/isTrusted/.test(evsrc) && /delete e\.target\.dataset\.offerSrc/.test(evsrc),
      'typing over a taken value clears the mark, and only a real keystroke does');

/* ── B-082: an offer delivers what the chip advertises ───────────────────── */
/* The chip's meta line shows the entry's POS and gloss, so taking it must
   produce both. "Is the field empty?" was the wrong gate: a morpheme row is
   never empty when drawn — morphPosDefault seeds the POS — so the offer
   silently did nothing on the rows it is most useful for. The gate is now
   "did a person put this here?", read from data-original. */
{
  const vm2 = require('vm');
  /* D55, v3.14.330. The rows are stubs but the WRITER is the real one, lifted
     from source, because the claim is about what it does to a field — and the
     bug it replaces (B-164) was reported from annotation and could not be
     reproduced by reading.

     `shown` is what is in the box, `stored` is what a person saved. A seeded
     default is shown-but-not-stored; that distinction is B-082's and it is the
     only thing separating the two modes. */
  const mkRow = (form, stored, shown) => {
    const mk = (k) => ({ value: shown[k] || '', dataset: { original: stored[k] || '' },
                         dispatchEvent() {} });
    const g = mk('gloss'), p = mk('pos'), ty = mk('type');
    return { dataset: {}, _g: g, _p: p, _t: ty, querySelector(sel) {
      return sel === '.morph-edit-form-label' ? { textContent: form }
           : sel === '.morph-gloss-input'     ? g
           : sel === '.morph-pos-input'       ? p
           : sel === '.morph-type-input'      ? ty
           : sel === '.morph-link-badge'      ? { hidden: true } : null; } };
  };
  const fill = (row, mode) => {
    const c = vm2.createContext({
      console, logEvent: () => {},
      Event: class { constructor(t, o) { Object.assign(this, { type: t }, o); } },
      normForm: x => String(x || '').toLowerCase(),
      document: { querySelectorAll: () => [row], getElementById: () => null },
    });
    /* `_OFFER_FIELDS` is a const beside the predicate, not inside it, so the
       declaration is read out of the source rather than restated here — a
       second copy of the list is exactly what this guard exists to prevent. */
    const decl = require('./_source.js').read('LingCoT.html')
      .match(/const _OFFER_FIELDS = \[[^\]]*\];/);
    if (!decl) throw new Error('_OFFER_FIELDS declaration not found in LingCoT.html');
    vm2.runInContext(decl[0], c);
    for (const fn of ['offerWrites', '_fillMorphRows'])
      vm2.runInContext(require('./_source.js').fnSrc('LingCoT.html', fn), c);
    /* The offer: gloss LOC, POS AFFIX, type bound.morpheme, entry d2. */
    c._fillMorphRows('de', 'LOC', 'lexicon', 'd2', 'AFFIX', 'bound.morpheme', mode);
    return row;
  };
  const E = { gloss: '', pos: '', type: '' };

  let r = fill(mkRow('de', E, E), 'take');
  check(r._g.value === 'LOC' && r._p.value === 'AFFIX' && r._t.value === 'bound.morpheme'
        && r.dataset.dictId === 'd2',
        'an offer fills gloss, POS, type and the link on an empty row',
        `         ${JSON.stringify([r._g.value, r._p.value, r._t.value, r.dataset.dictId])}`);

  /* v3.14.254. This row used to be shown-POS === the POS the offer carries, so
     the assertion held whichever gate the code used and B-082 could be
     reintroduced verbatim with every assertion green. Verified by doing exactly
     that. The seeded value must DIFFER from what the offer delivers. */
  r = fill(mkRow('de', E, { pos: 'NOUN' }), 'fill');
  check(r._p.value === 'AFFIX',
        'a bulk FILL writes over a POS the app defaulted in — B-082',
        `         got ${JSON.stringify(r._p.value)}; a seed is not an annotation`);

  /* ── D55: the two modes, on the same row ─────────────────────────────────────
     This pair is the whole decision. A bulk fill is one click touching many
     rows, so it leaves saved work alone; a chip is a person naming one entry for
     one row, and refusing them was B-164. If these two ever agree, one of them
     is wrong. */
  const saved = { gloss: 'ABL', pos: 'NOUN', type: 'word' };

  r = fill(mkRow('de', saved, saved), 'fill');
  check(r._g.value === 'ABL' && r._p.value === 'NOUN' && r._t.value === 'word',
        'a bulk FILL never overwrites what was SAVED',
        `         ${JSON.stringify([r._g.value, r._p.value, r._t.value])}`);

  r = fill(mkRow('de', saved, saved), 'take');
  check(r._g.value === 'LOC' && r._p.value === 'AFFIX' && r._t.value === 'bound.morpheme',
        'an explicit TAKE overwrites all three — D55, and B-164 was the refusal',
        `         ${JSON.stringify([r._g.value, r._p.value, r._t.value])}\n`
        + '         D53\'s fill-only rule is about propagation the APP performs, not about a button');

  /* B-165: the mark is what saveWord reads to stamp the field derived. An
     overwriting take that marked only the gloss would replace a person's
     judgement with a dictionary's and sign it with the person's name. */
  check(r._g.dataset.offerSrc === 'lexicon' && r._p.dataset.offerSrc === 'lexicon'
        && r._t.dataset.offerSrc === 'lexicon',
        'and marks EVERY field it wrote, not only the gloss — B-165',
        `         ${JSON.stringify([r._g.dataset.offerSrc, r._p.dataset.offerSrc, r._t.dataset.offerSrc])}`);

  /* One predicate, or the chip and the click can part company again (PRACTICES
     §4). `offerFillsNothing` decides how the chip DRAWS; it must ask the same
     question, in the same mode, that clicking will answer. */
  const ofn = decomment(fnSrc('LingCoT.html', 'offerFillsNothing') || '');
  check(/offerWrites\(/.test(ofn) && /'take'/.test(ofn),
        'the chip\'s appearance is computed by the predicate the click uses, in take mode',
        '         two functions answering "would this change anything" is B-113/B-082 again');
  const fmr = decomment(fnSrc('LingCoT.html', '_fillMorphRows') || '');
  check(/offerWrites\(/.test(fmr) && !/mayFill/.test(fmr),
        'and the writer asks it too — `mayFill` is gone, not shadowed');

  /* The bulk path must stay 'fill'. A take-by-default there turns one click into
     an overwrite of every matched row, which is B-122's lesson at scale. */
  const bulk = decomment(fnSrc('LingCoT.html', 'fillParseFromLexicon') || '');
  check(/_fillMorphRows\([^)]*'fill'\s*\)/s.test(bulk),
        'stage E\'s bulk fill asks for fill mode by name',
        '         one click, many rows — the mode must be explicit at the call site');

  check(/data-offer-pos=/.test(html), 'the offer carries the POS it advertises');
}

/* ── B-088: coverage, so a field cannot be added with no source ──────────── */
/* Reported as "autocomplete on morpheme POS does not work"; the audit that
   followed found four more fields with no source at all. A field is checked by
   what it HOLDS, not by name: a POS field draws on the POS pool, a gloss field
   on the Leipzig list, a type field on the type pool. Nothing here can be
   satisfied by adding a name to a list — the assertion reads the markup. */
{
  const tagOf = id => {
    const i = all.indexOf(`id="${id}"`);
    if (i === -1) return null;
    return all.slice(all.lastIndexOf('<input', i), all.indexOf('>', i) + 1);
  };
  const EXPECT = [
    ['ew-mp-${mi}',   'pos',   'the morpheme POS field — the one that was reported'],
    ['ew-pos',        'pos',   'the word POS field'],
    ['pk-pos-${i}',   'pos',   'the add-to-dictionary panel POS field'],
    ['ew-lemma',      'lemma', 'the word lemma field'],
  ];
  /* D48 stage B: a generated field's id never appears in the source, so grepping
     for it proves nothing. The question is the same — does this field name a
     pool — but it is asked of the table and of the control that reads it. The
     dictionary pair's POS, type, lemma and semantic-domain fields are all here. */
  {
    const F = require('../../source/modules/field_spec.js');
    const POOLED = { tag: f => (f.tags === 'TYPE_CHOICES' ? 'type' : 'pos'),
                     lemma: () => 'lemma',
                     text:  f => f.pool || null };
    let checked = 0;
    for (const f of F.fieldsOf('dict_entry').filter(F.isFillable)) {
      const want = POOLED[f.control] ? POOLED[f.control](f) : null;
      if (!want) continue;
      checked++;
      const body = fnSrc('LingCoT.html', 'renderField');
      const re = new RegExp(`data-ac-pool="(\\$\\{[^}]*\\}|${want})`);
      check(re.test(body),
            `dict_entry.${f.key} draws on the '${want}' pool`,
            'the generated control emits no data-ac-pool, so the autocomplete never fires');
    }
    check(checked >= 4, `${checked} generated dictionary fields name a pool`);
  }

  for (const [id, pool, what] of EXPECT) {
    const tag = tagOf(id);
    check(!!tag, `${what} is present to be checked`, `no input with id="${id}"`);
    if (!tag) continue;
    check(new RegExp(`data-ac-pool="${pool}"`).test(tag), `${what} draws on the ${pool} pool`);
    check(/\bac-input\b/.test(tag), `${what} carries the class the listeners match`);
  }

  // Gloss fields take the Leipzig list, and are marked by one class rather than
  // by a list of ids — which is how the dictionary's own gloss fields were missed.
  for (const id of ['ew-gloss', 'pk-gloss-${i}']) {
    const tag = tagOf(id);
    check(!!tag && /\bgloss-input\b/.test(tag), `${id} is marked as a gloss field`);
  }
  /* The dictionary's two gloss fields are generated, so the class is declared in
     the table and applied by the control. Dropping `f.cls` in the conversion
     cost them the Leipzig list — B-088's defect, reintroduced by the machinery
     built to prevent that class of thing, and caught here. */
  {
    const F = require('../../source/modules/field_spec.js');
    check(F.fieldOf('dict_entry', 'gloss')?.cls === 'gloss-input',
          'the dictionary gloss field is declared as a gloss field in the table');
    check(/f\.cls \? ' ' \+ f\.cls : ''/.test(fnSrc('LingCoT.html', 'renderField')),
          'and renderField applies the declared class',
          'declared but unread is worse than undeclared — it looks handled');
  }
  check(/const AC_SELECTOR = '\.gloss-input, \.ac-input'/.test(html),
        'AC_SELECTOR matches by class only, so a new gloss field is covered by construction');
}

/* ── B-082: taking an offer must not open the floating mechanism ────────────
   D42's rule is that the floating list answers keystrokes and the sitting
   component describes standing state. Taking a chip IS the standing component
   speaking, so it must not summon the floating one. It did: both fill paths
   dispatch a synthetic `input` after writing a value, and the trigger did not
   ask who dispatched it, so one chip click opened the dropdown over every row
   it filled.

   The two triggers need different rules, and the difference is worth stating
   because gating both the same way looks tidier and is wrong. `input` from
   dispatchEvent reports isTrusted false, so a gate works. `focusin` fired by
   the UA in response to element.focus() reports isTrusted TRUE, so the same
   gate there would read as protection and provide none. That one is handled by
   the caller instead. */
{
  const ev = mods.find(([n]) => n === 'events.js')?.[1] || '';
  const inputTrigger = ev.match(/addEventListener\('input', e => \{[\s\S]*?showGlossAC\(inp\);[\s\S]*?\}\);/)?.[0] || '';
  check(inputTrigger !== '', 'found the input-driven autocomplete trigger');
  check(/if \(!e\.isTrusted\) return;/.test(inputTrigger),
        'the input trigger ignores events the app dispatched',
        'without this, writing a value into a field looks exactly like typing one');

  /* The focus half is the caller's job, so check the mechanism exists and that
     the one place taking an offer focuses a field uses it. */
  check(/function suppressAcOnce\(\)/.test(html), 'suppressAcOnce() is defined');
  check(/_acSuppressOnce/.test(fnSrc('LingCoT.html', 'showGlossAC') || ''),
        'showGlossAC honours the suppression');
  const take = fnSrc('LingCoT.html', 'takeOffer') || '';
  const focuses = [...take.matchAll(/(\w+)\.focus\(\);/g)];
  for (const f of focuses)
    check(new RegExp(`suppressAcOnce\\(\\);\\s*\\n?\\s*${f[1]}\\.focus`).test(take),
          `takeOffer suppresses the list before focusing ${f[1]}`,
          'ew-lemma is an .ac-input, so focusing it dumps the whole list over the form');

  /* And the morpheme path does not focus a field at all: the caret goes back to
     the strip, where the next offer is. */
  const fc = fnSrc('LingCoT.html', 'focusOfferChip') || '';
  check(fc !== '', 'focusOfferChip() is defined');
  check(/\.offer-chip/.test(fc) && !/\.ac-input|morph-\w+-input/.test(fc),
        'it focuses a chip, never a filled field');
}

/* ── F4's residue: the lexicon's part of speech is OFFERED, never inherited ──
   v3.14.266. ANNOTATION_FILL §1.1 states the rule deliberately: a morpheme
   inherits gloss, transliterations and type from the lexicon and never a part of
   speech. F4's proposal was to OFFER it as a chip, which shipped as B-082; what
   remained was that `_dictFillForForm`, the one function that composes "the fill
   for this form", dropped the field entirely — incomplete by omission rather
   than by rule.

   Adding it back makes the rule enforceable instead of a comment, and that is
   what this asserts: the field is there, and no automatic filler writes it.
   Without this the next caller inherits a POS by accident and the fill audit's
   distinction dies quietly. */
{
  const fill = fnSrc('LingCoT.html', '_dictFillForForm') || '';
  check(/part_of_speech:/.test(fill),
        '_dictFillForForm composes the part of speech like every other field',
        '       the candidates carry one and this was the only place that dropped it');
  check(/dict_cands:/.test(fill) && /gloss:/.test(fill) && /type:/.test(fill),
        'alongside the gloss, the type and the candidates it already returned');

  /* The three automatic fillers. Each reads `fill.<key>` and assigns it; the
     claim is that none of them does that with this one. Matched as an
     assignment rather than a mention, so reading it for a chip stays legal. */
  /* v3.14.348: `ensureMorphemesFromParse` no longer reads the composed fill
     itself — D60/L-035 moved the decision into `morphFillPlan`, which is shared
     with the offer panel so a proposal and its acceptance cannot disagree. The
     rule this guard exists for follows the decision: whichever function ASKS the
     dictionary what a morpheme should get is the one that must not ask it for a
     part of speech. */
  const AUTO = ['morphFillPlan', 'inheritMorphemeTypes'];
  for (const fn of AUTO) {
    const body = decomment(fnSrc('LingCoT.html', fn) || '');
    check(body !== '', `${fn}() is in the source`);
    check(/fill\.(gloss|type|transliterations|dict_cands)/.test(body),
          `${fn} reads the composed fill`,
          '       if it stopped, this guard would be asserting nothing');
    /* v3.14.348: these two patterns matched an ASSIGNMENT, which was the only
       shape a fill had when they were written. `morphFillPlan` builds an op
       instead — `{ field: 'type', value: fill.type }` — and a part of speech
       added the same way is caught by neither. So the question is asked of the
       whole function rather than of one syntax: NEITHER of these two mentions a
       part of speech at all. Neither has any business with one; the chip path
       that legitimately reads it is somewhere else, and is why this is scoped to
       these two rather than to the file. */
    check(!/part_of_speech/.test(body),
          `${fn} does NOT inherit the part of speech (ANNOTATION_FILL §1.1)`,
          '       a morpheme takes a POS from a person or from an offer they took, never from a lookup');
  }

  /* ── B-166: the word's own part of speech, offered ───────────────────────────
     Measured across both live corpora: 85% of words carry a gloss and 4–7% carry
     a part of speech, because a gloss has two automatic routes and a POS has
     none — correctly, per the rule just asserted above. The gap was never a
     missing inheritance; it was a missing OFFER. The word's field had a 29-tag
     palette and no suggestion, even where the dictionary already answers for
     that exact form. */
  {
    const strip = decomment(fnSrc('LingCoT.html', 'wordPosStripHtml') || '');
    check(strip !== '', 'the word part-of-speech strip exists');
    check(/lookupDict\(/.test(strip),
          'and asks the dictionary for this form',
          '       the entries are the source; a composed answer would be B-122');
    /* B-122: `_dictFillForForm` returns `cands.find(e => e.part_of_speech)`, a
       preference order — the shape that wrote 76 of 77 morpheme links without
       asking. Two entries that disagree must produce two chips. */
    check(!/_dictFillForForm/.test(strip),
          'and NOT the composed fill, which resolves ambiguity by preference (B-122)');
    /* EXECUTED. A regex for `seen.add(` asserts that a mechanism was written,
       not that it works — verified by mutation: changing the dedupe to
       `offers.length` (one chip, ever) left that assertion green. What the
       decision actually says is countable, so count it. */
    {
      const vmx = require('vm');
      const c = vmx.createContext({
        console,
        esc: x => String(x), escAttr: x => String(x), t: k => k,
        OFFER_MARKS: {},
        __dict: [],
        lookupDict: function (f) { return this.__dict.filter(e => e.form === f); },
      });
      c.lookupDict = f => c.__dict.filter(e => e.form === f);
      vmx.runInContext(fnSrc('LingCoT.html', 'offerStripHtml'), c);
      vmx.runInContext(fnSrc('LingCoT.html', 'wordPosStripHtml'), c);
      const chips = html2 => (html2.match(/class="chip offer-chip/g) || []).length;

      c.__dict = [{ form: 'yüz', part_of_speech: 'NOUN', gloss: 'face' },
                  { form: 'yüz', part_of_speech: 'NUM',  gloss: 'hundred' }];
      const both = c.wordPosStripHtml('yüz', '');
      check(chips(both) === 2,
            'two entries that disagree produce TWO chips — ambiguity is shown, not settled',
            `         ${chips(both)} chip(s); B-122 wrote 76 of 77 links by preferring cands[0]`);

      c.__dict = [{ form: 'ev', part_of_speech: 'NOUN' }, { form: 'ev', part_of_speech: 'NOUN' }];
      check(chips(c.wordPosStripHtml('ev', '')) === 1,
            'and two entries that agree produce one — distinct answers, not distinct entries');

      check(c.wordPosStripHtml('ev', 'NOUN') === '',
            'nothing is offered that the field already says (B-108)');
      check(c.wordPosStripHtml('yok', '') === '',
            'and a form the dictionary does not know offers nothing at all');

      c.__dict = [{ form: 'ev', part_of_speech: '' }];
      check(c.wordPosStripHtml('ev', '') === '',
            'an entry with no part of speech is not an empty chip');
    }
    check(/target: 'ew-pos'/.test(strip) && /src: 'lexicon'/.test(strip),
          'it targets the word POS field and marks the value as the lexicon\'s',
          '       the mark is what saveWord reads to stamp it derived rather than as the annotator\'s');

    const shell = read('LingCoT.html');
    check(/id="ew-pos-strip"/.test(shell) && /wordPosStripHtml\(word\.form/.test(shell),
          'the word editor renders it under the field');
    check(/refreshWordPosStrip/.test(read('modules/events.js') || ''),
          'and it is repainted as the field is typed, so a taken offer stops standing');
  }

  /* And the offer path DOES carry it, which is the half that shipped. */
  const panel = fnSrc('LingCoT.html', 'renderMorphSuggestPanel') || '';
  check(/pos:\s*e\.part_of_speech/.test(panel),
        'the offer chip still carries the entry\'s part of speech, so it can be taken',
        '       offered and inherited are the two halves of F4 and only one of them is automatic');
}

console.log('\nD53 stage E — the parse, segment by segment\n');
{
  const vm = require('vm');
  /* Executed, not read. UNIFIED L-006 says this guard's static half is hollow;
     this section is behavioural on purpose. */
  const nf = x => String(x || '').normalize('NFC').toLowerCase();
  const D = [
    { id: 'e1', form: 'ev',  gloss: 'house', type: 'word',           part_of_speech: 'NOUN' },
    { id: 'e2', form: 'de',  gloss: 'LOC',   type: 'bound.morpheme', part_of_speech: 'ADP'  },
    { id: 'e3', form: 'yüz', gloss: 'face',  type: 'word' },
    { id: 'e4', form: 'yüz', gloss: 'hundred', type: 'word' },
  ];
  const byForm = new Map();
  for (const e of D) { const k = nf(e.form); if (!byForm.has(k)) byForm.set(k, []); byForm.get(k).push(e); }
  const S = { dictionary: D, dictByForm: byForm };
  const filled = [];
  const ctx = vm.createContext({ S, console, normForm: nf, esc: x => String(x),
    lookupDict: f => byForm.get(nf(f)) || [],
    _fillMorphRows: (form, gloss, src, id, pos, type) => filled.push({ form, gloss, id, pos, type }),
    t: (k, v) => k + (v ? ':' + JSON.stringify(v) : '') });
  for (const fn of ['parseSegmentState', 'fillParseFromLexicon', 'parseGuideHtml'])
    vm.runInContext(fnSrc('LingCoT.html', fn), ctx, { filename: fn + '.js' });

  ctx.__p = 'ev-yüz-de-zzz';
  const st = vm.runInContext('parseSegmentState(__p)', ctx);
  check(st.length === 4, `every segment is reported, in order (${st.map(x => x.seg).join('-')})`,
        '       suggestParseEntries dedupes and drops the misses, which cannot say WHICH position is a gap');
  check(st.map(x => x.state).join(',') === 'unique,ambiguous,unique,none',
        `and each carries its state (${st.map(x => x.state).join(',')})`,
        '       the three are linkTo\'s: answerable, needs a person, is work');

  /* A repeated segment is reported at BOTH positions. The deduping reader would
     show one chip for it, and the annotator is looking at positions. */
  ctx.__p = 'ev-de-ev';
  check(vm.runInContext('parseSegmentState(__p)', ctx).length === 3,
        'a segment repeated in one parse is reported at each position');

  // The bulk fill: every unambiguous segment, and only those.
  ctx.__p = 'ev-yüz-de-zzz';
  const r = vm.runInContext('fillParseFromLexicon(__p)', ctx);
  check(r.filled === 2 && r.ambiguous === 1 && r.none === 1,
        `it fills the answerable and counts the rest (${JSON.stringify(
          { filled: r.filled, ambiguous: r.ambiguous, none: r.none })})`);
  check(filled.map(f => f.form).join(',') === 'ev,de',
        `and writes exactly those two (${filled.map(f => f.form).join(',')})`);
  check(!filled.some(f => nf(f.form) === 'yüz'),
        'AN AMBIGUOUS SEGMENT IS NEVER GUESSED',
        '       B-122: the silent writer took cands[0] and put 76 of 77 morpheme links there');
  check(filled[0].gloss === 'house' && filled[0].pos === 'NOUN' && filled[0].type === 'word',
        'each fill carries everything the entry knows, not just the gloss',
        '       B-082: a chip that shows three fields and delivers one');
  check(filled.every(f => f.id), 'and the entry id, so the row can link');

  // The surface says which positions are gaps — that is what it exists for.
  ctx.__p = 'ev-yüz-de-zzz';
  const gh = vm.runInContext('parseGuideHtml(__p)', ctx);
  check(/pg-unique/.test(gh) && /pg-ambiguous/.test(gh) && /pg-none/.test(gh),
        'the guide marks all three states, so a gap is findable without reading');
  check((gh.match(/pg-seg/g) || []).length === 4, 'one cell per segment');
  check(/data-action="parse-fill-all"/.test(gh), 'and offers the one action');

  // A single-segment parse is the word itself; a guide there is noise.
  ctx.__p = 'ev';
  check(vm.runInContext('parseGuideHtml(__p)', ctx) === '',
        'no guide for a parse with one segment',
        '       a word that is its own morpheme has nothing to lay out');
  // Nothing to offer at all → no action, and no empty button.
  ctx.__p = 'zzz-qqq';
  const none = vm.runInContext('parseGuideHtml(__p)', ctx);
  check(!/parse-fill-all/.test(none), 'and no fill button when the lexicon knows none of them');

  /* One keystroke, one repaint of both surfaces: the chip strip and the guide
     answer the same question and must not be refreshed from two listeners. */
  const rms = decomment(fnSrc('LingCoT.html', 'refreshMorphSuggest'));
  check(/parseGuideHtml\(/.test(rms),
        'the guide is repainted where the chips are',
        '       two refreshes of one field is how the three functions D42 replaced came to disagree');
}

/* ── B-053: the one memoised pool, and what invalidates it ────────────────────
   v3.14.309 cached `AC_POOLS.gloss` — the only pool whose length grows with the
   corpus (207 rows on chinese-test against 18 and 9 for the fixed
   vocabularies), measured at 0.248 ms per keystroke before and 0.003 ms after.

   A cache in this app has one failure mode and this project has met it three
   times (B-011, B-019, B-043): the key is missing something the value depends
   on. This pool depends on the data AND on `t()` output, so both are checked by
   BUILDING the pool, changing one thing, and asking again. A guard that read the
   key expression instead would pass on a key that names the right variables and
   compares them wrongly. */
{
  const vm = require('vm');
  const { appSources, makeCtx, loadApp } = require('./_dom.js');
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  check(errs.length === 0, 'the app boots, so the pool can be built',
        errs.map(([l, e]) => `         ${l}: ${e.message}`).join('\n'));
  if (!errs.length) {
    const run = e => vm.runInContext(e, ctx);
    run(`_LOCALE = { _meta: { locale: 'en' }, 'hint.gloss.used': 'used {n}x' };
         S.wordById = new Map([['w1', { word: { gloss: 'ALPHA', morphemes: [] } }]]);
         S.dictionary = []; _LEIPZIG_GLOSSES = [];`);
    const first = run('AC_POOLS.gloss()');
    check(first.length === 1 && first[0].value === 'ALPHA', 'the pool builds');
    check(run('AC_POOLS.gloss() === AC_POOLS.gloss()'),
          'and is memoised — the same array, not an equal one');

    run(`S.wordById.set('w2', { word: { gloss: 'BETA', morphemes: [] } }); mutate('corpus', []);`);
    check(run('AC_POOLS.gloss().length') === 2,
          'a data change rebuilds it — a gloss typed a moment ago is offered back',
          `         still ${run('AC_POOLS.gloss().length')} row(s) after mutate()`);

    const hintBefore = run('AC_POOLS.gloss()[0].hint');
    run("_LOCALE = { _meta: { locale: 'xx' }, 'hint.gloss.used': 'ANDERS {n}' };");
    check(run('AC_POOLS.gloss()[0].hint') !== hintBefore,
          'and a locale change rebuilds it too — the hints are t() output',
          `         hint stayed ${JSON.stringify(hintBefore)} after the language changed`);
  }
}

/* ── B-108: a chip that would change nothing must not look like an offer ──── */
/* v3.14.361. `renderMorphSuggestPanel` passed the RAW parse field to
   `suggestParseEntries` while `takeOffer`'s splice read `parse || word.form`.
   For a word with no parse the two disagreed: no parse matches meant an empty
   `parseForms`, so the filter whose job is "do not offer an entry that is
   already a segment" removed nothing, and the entry came through as a FORM
   match. `taken` is only ever computed for `fill-rows`, so a row that was
   already complete AND already linked got a live chip that wrote nothing when
   clicked. Four forms reached the logs that way before it was found.

   EXECUTED, against the records that produced those log lines. The `set-parse`
   case is checked in the same breath, because the cheap wrong fix here is to
   filter the entry out and take a real suggestion with it. */
{
  const vm = require('vm');
  const { appSources, makeCtx, loadApp } = require('./_dom.js');
  const ctx = makeCtx({ hasId: () => true });
  const errs = loadApp(ctx, appSources());
  check(errs.length === 0, 'the app loads into the stub DOM',
        errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
  const run = e => vm.runInContext(e, ctx);

  console.log('\nan offer that would write nothing is drawn as taken (B-108)');

  const panel = (entry, word) => {
    ctx.__entry = entry; ctx.__word = word;
    /* Through `buildDictIndex`, the app's own door: `suggestMorphemes` reads
       `S.dictMorphemes`, and a probe that set only `S.dictionary` produced no
       chips at all — it would have reported this fixed before it was. */
    run("S.dictionary = [__entry]; buildDictIndex(); _morphSuggestLast = null;");
    return String(run("renderMorphSuggestPanel(__word.form, __word.morphological_parse || '', __word)"));
  };
  const act = html => (html.match(/data-offer-act="([a-z-]+)"/) || [])[1] || null;

  const ENTRY = { id: 'd1', form: 'salkım', type: 'word', part_of_speech: 'NOUN', gloss: 'bunch' };
  /* The live record, exactly: no parse, one morpheme equal to the word, every
     field already agreeing with the entry, already linked to it. */
  const done = panel(ENTRY, { id: 'w', form: 'salkım', morphological_parse: null,
    morphemes: [{ form: 'salkım', gloss: 'bunch', part_of_speech: 'NOUN', type: 'word', dict_id: 'd1' }] });
  check(/offer-chip/.test(done), 'the chip is still drawn — the entry exists and the annotator may want to see it');
  check(act(done) === 'fill-rows',
        'a word with no parse is ONE segment, so its own entry is a parse match',
        `         got act=${act(done)} — 'set-parse' means the two readers of "what\n`
      + `         the parse is" have parted company again`);
  check(/offer-taken/.test(done),
        'and it is marked taken, so the click handler refuses it',
        '         this is the whole bug: clicking wrote nothing and logged\n'
      + '         "offer filled nothing", four times, in live use');

  /* The same word with an empty row must still be offered live, or the fix has
     simply turned the feature off. */
  const empty = panel(ENTRY, { id: 'w', form: 'salkım', morphological_parse: null,
    morphemes: [{ form: 'salkım' }] });
  check(act(empty) === 'fill-rows' && !/offer-taken/.test(empty),
        'the same entry over an EMPTY row is live — it has something to write',
        `         got act=${act(empty)} taken=${/offer-taken/.test(empty)}`);

  /* And a genuine form suggestion — an entry for a sub-part of the word — must
     stay a `set-parse` splice. */
  const sub = panel({ id: 'd3', form: 'ev', type: 'word', part_of_speech: 'NOUN', gloss: 'house' },
    { id: 'w', form: 'evde', morphological_parse: null, morphemes: [{ form: 'evde' }] });
  check(act(sub) === 'set-parse',
        'an entry for part of the word is still spliced into the parse',
        `         got act=${act(sub)} — filtering it out would fix the warning by\n`
      + '         removing the suggestion the panel exists to make');

  /* One value, one reader. */
  check(/const parseMatches = suggestParseEntries\(workingParse\(parseVal, wordForm\)\)/.test(read('LingCoT.html')),
        'the panel and the splice ask one function what the parse is',
        '         two readers of that is the defect itself (PRACTICES §4)');
  check(/const working  = workingParse\(parseEl\.value, findWord\(S\.wordId\)\?\.word\?\.form\)/.test(read('LingCoT.html')),
        'and the splice reads it through the same function');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
