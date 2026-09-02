#!/usr/bin/env node
/* =============================================================================
   nav_traversal_test.js. D30 annotation traversal
   Run:  node dev/tests/nav_traversal_test.js
   =============================================================================
   Executes the traversal engine against a synthetic document rather than only
   reading the source, because the two rules that matter are behavioural:

     · punctuation is stepped OVER (20% of real tokens; only ever annotated as
       UD `punct`, which is assigned from the sentence editor, not here)
     · a step crosses sentence, paragraph and section boundaries, and STOPS at
       the document end rather than wrapping

   The synthetic document is shaped to exercise both at once: two sections, a
   multi-paragraph section, sentences that end in punctuation, and a sentence
   made of nothing but punctuation (which must be skipped through entirely).
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC, decomment, fnSrc } = require('./_source.js');
const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
const evts = fs.readFileSync(path.join(SRC, 'modules', 'events.js'), 'utf8');
// B-151 reads two more files: the second IGT surface, and the styling that says
// whether the link it now carries looks like one.
const srch = fs.readFileSync(path.join(SRC, 'modules', 'search.js'), 'utf8');
const css  = fs.readFileSync(path.join(SRC, 'LingCoT.css'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

function extract(name) {
  const i = html.indexOf(`function ${name}(`);
  if (i === -1) return '';
  let depth = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(i, j + 1);
  }
  return '';
}

/* ── A synthetic document with every boundary the engine must cross ────────── */
let idc = 0;
const W = form => ({ id: `w${++idc}`, form });
const SENT = (id, forms) => ({ id, words: forms.map(W) });

const DOC = [
  { paragraphs: [                                    // section 0
      { sentences: [ SENT('s1', ['Bu', 'bir', 'deneme', '.']),
                     SENT('s2', ['İki', 'kuş', '.']) ] },
      { sentences: [ SENT('s3', ['Yeni', 'paragraf', '.']) ] },   // para boundary
  ]},
  { paragraphs: [                                    // section 1, sect boundary
      { sentences: [ SENT('s4', ['!', '?']),                       // ALL punctuation
                     SENT('s5', ['Son', 'cümle', '.']) ] },
  ]},
];

/* Index the fixture the way the app does, so wordById/sentById carry the
   positions navCrossing reads. */
const S = { wordById: new Map(), sentById: new Map() };
DOC.forEach((sect, si) =>
  (sect.paragraphs || []).forEach((para, pi) =>
    (para.sentences || []).forEach((sent, sx) => {
      S.sentById.set(sent.id, { sent, para, paraIdx: pi, sect, sectIdx: si, sentIdx: sx, docIdx: 0 });
      (sent.words || []).forEach(w =>
        S.wordById.set(w.id, { word: w, sent, para, paraIdx: pi, sect, sectIdx: si }));
    })));

const NAMES = ['_navIsToken', '_navIndex', 'navAdvance', 'navCrossing'];
const missing = NAMES.filter(n => !extract(n));
check(missing.length === 0, `all ${NAMES.length} traversal functions exist`,
      missing.map(n => `         ${n}() not found`).join('\n'));
if (missing.length) { console.log(`\n${pass} passed, ${fail} failed\n`); process.exit(1); }

/* `_navCache` is module state in the app, so declare it inside the sandbox or
   the extracted functions have nothing to read. `_dataGen` is fixed: the cache
   keys on it and this fixture never mutates. */
const api = new Function('S', 'sections',
  'let _navCache = { gen: -1, words: [], sents: [], pos: new Map(), navigable: new Set() };\n' +
  'const _dataGen = 1;\n' +
  NAMES.map(extract).join('\n') + `\nreturn {${NAMES.join(',')}};`
)(S, () => DOC);

const { _navIsToken, navAdvance, navCrossing } = api;
const form = id => (S.wordById.get(id) || {}).word.form;

console.log('\npunctuation is not a stop\n');
{
  check(_navIsToken({ form: 'deneme' }) === true,  'a word is navigable');
  check(_navIsToken({ form: '.' })      === false, 'a full stop is not');
  check(_navIsToken({ form: 'İki' })    === true,  'non-ASCII letters count (Turkish İ)');
  check(_navIsToken({ form: '3' })      === true,  'digits count — numerals are annotated');
  check(_navIsToken({ form: '' })       === false, 'an empty form is not navigable');

  // 'deneme' is followed by '.', then sentence s2 starts with 'İki'.
  const afterDeneme = navAdvance('word', 'w3', +1);
  check(form(afterDeneme) === 'İki',
        "next from the last word steps OVER the full stop into the next sentence",
        `         got ${JSON.stringify(form(afterDeneme))}`);
}

console.log('\ntraversal crosses every level, and stops at the document end');
{
  // s2 'kuş' -> s3 'Yeni' crosses a PARAGRAPH.
  const a = navAdvance('word', 'w6', +1);
  check(form(a) === 'Yeni', 'steps across a paragraph boundary', `         got ${form(a)}`);
  check(navCrossing('word', 'w6', a) === 'paragraph', 'and reports it as a paragraph crossing');

  // s3 'paragraf' -> section 1. s4 is ALL punctuation, so it must be skipped
  // through entirely, landing on s5's first word.
  const b = navAdvance('word', 'w9', +1);
  check(form(b) === 'Son',
        'skips a sentence made only of punctuation and lands in the next one',
        `         got ${JSON.stringify(form(b))}`);
  check(navCrossing('word', 'w9', b) === 'section', 'and reports a section crossing');

  // Ends.
  const first = navAdvance('word', 'w1', -1);
  check(first === null, 'prev at the first word is null — no wrap to the end');
  const lastWord = [...S.wordById.keys()].filter(id => _navIsToken(S.wordById.get(id).word)).pop();
  check(navAdvance('word', lastWord, +1) === null,
        'next at the last word is null — no wrap to the start');
}

console.log('\nsentence-level traversal');
{
  check(navAdvance('sentence', 's1', +1) === 's2', 'next sentence within a paragraph');
  check(navAdvance('sentence', 's3', +1) === 's4',
        'crosses into the next section — punctuation-only sentences are still SENTENCES');
  check(navCrossing('sentence', 's3', 's4') === 'section', 'reported as a section crossing');
  check(navAdvance('sentence', 's5', +1) === null, 'stops at the last sentence');
  check(navCrossing('sentence', 's1', 's2') === 'sentence',
        'a same-paragraph step reports the sentence level');
}

console.log('\nwiring: controls in the render views, Save advances');
{
  check(/\$\{navControls\('word', S\.wordId\)\}/.test(html),
        'renderWord shows the control pair');
  check(/\$\{navControls\('sentence', S\.sentId\)\}/.test(html),
        'renderSentence shows the control pair');
  check(!/navControls\(/.test(html.slice(html.indexOf('function renderWordEdit'))) ||
        !/function renderWordEdit[\s\S]{0,4000}navControls\(/.test(html),
        'the EDIT views do not — that is what removes the unsaved-changes question');

  // B-065 amended D30: the advance is gated on the pre-save annotation state.
  // save_advance_test.js owns that rule; this guard only checks the call remains.
  check(/const nextWord = _wasAnnotated \? null : navAdvance\('word', wordId, \+1\)/.test(html),
        'saveWord advances to the next word, unless this was a revision');
  check(/const nextSent = _wasAnnotated \? null : navAdvance\('sentence', sentId, \+1\)/.test(html),
        'saveSentence advances to the next sentence, unless this was a revision');
  check(/else\s+go\('word', \{ wordId, sentId \}\);/.test(html),
        'and stays put at the document end rather than going nowhere');
}

console.log('\nwiring: keyboard is gated so it cannot fight a text field');
{
  check(/S\.view !== 'word' && S\.view !== 'sentence'/.test(evts),
        'only active in the two render views that have the control');
  check(/matches\('input, textarea, select'\)/.test(evts) && /isContentEditable/.test(evts),
        'never while a text field or contenteditable has focus');
  check(/metaKey \|\| e\.ctrlKey \|\| e\.altKey \|\| e\.shiftKey/.test(evts),
        'never with a modifier — browser and OS shortcuts untouched');
  check(/e\.preventDefault\(\)/.test(evts), 'and stops the pane scrolling sideways');
}

console.log('\nB-151: one question about punctuation, one answer');
{
  /* The rule, not the instance. Three surfaces asked "is this punctuation?" and
     gave three answers: `_navIsToken` (D30, the rule), a four-mark ASCII list in
     the sentence IGT, and `gloss === 'PUNCT' && !morphemes` in search. The list
     is what let all 32 Chinese `。`/`，` draw as live words while 4 Turkish marks
     were dead — so what is guarded is that no surface spells the test itself. */
  const surfaces = [['LingCoT.html', html], ['modules/search.js', srch]];
  for (const [name, src] of surfaces) {
    const decls = [...decomment(src).matchAll(/const\s+isPunct\s*=\s*([^;]+);/g)].map(m => m[1]);
    check(decls.length > 0, `${name} still decides punctuation somewhere`,
          '         if this goes to zero the sweep below checks nothing');
    for (const d of decls) {
      check(/_navIsToken\(/.test(d),
            `${name}: the punctuation test asks _navIsToken`,
            `         got: ${d.trim()} — D30's rule is the only one, and it is script-agnostic`);
      check(!/form\s*===\s*'[^']*'/.test(d),
            `${name}: and names no literal form`,
            '         a per-mark list is ASCII-only by construction: 。， are not in it');
    }
  }

  /* The other half of the answer: dimmed is not dead. Every IGT column carries
     the link, because D30's own comment leans on clicking as the way to reach a
     punctuation token — "only landing on one is prevented" — and this view was
     the surface that removed it. */
  const igt = fnSrc('LingCoT.html', 'renderSentence') || html;
  const col = /let col = `<div class="igt-word\$\{[^`]*`;/.exec(igt);
  check(!!col, 'the IGT column markup is where it is expected');
  if (col) {
    check(/data-go="word"/.test(col[0]), 'every IGT token carries the word link',
          '         punctuation included — it is the only route to its head/dep_rel here');
    check(!/isPunct \?[^:]*data-go/.test(col[0]) && !/!isPunct \?/.test(col[0]),
          'and the link is not conditional on the punctuation test',
          '         dimming says "traversal will not stop here", not "there is nothing here"');
  }
  check(!/\.igt-word\.punct\s*\{[^}]*cursor:\s*default/.test(css),
        'and the dimmed column keeps a pointer cursor',
        '         a link that looks unclickable is one nobody clicks');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
