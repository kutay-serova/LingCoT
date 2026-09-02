#!/usr/bin/env node
/* =============================================================================
   lang_resolve_test.js, language resolution, EXECUTED against the real table
   Run:  node dev/tests/lang_resolve_test.js
   =============================================================================
   B-031. "Cannot reach Google Translate" was reported on a machine that was
   online. translateText() gates Google on `!!googleSrc`:

       const tryGoogle = (backend === 'google' || backend === 'auto') && !!googleSrc;

   so a Language field that does not resolve means Google is never called, and
   the user is told it could not be reached. A typo and an outage look identical.

   Resolution is therefore load-bearing, and it had never been tested. This runs
   the REAL map-building code from language_maps.js against the REAL
   language_codes.json and probes every input shape a user might type:

     canonical code · ISO 639-1 · ISO 639-3 · NLLB flores code · Google BCP-47
     English name · native name · every declared alias
     each of those upper-cased, lower-cased and title-cased

   Slicing the shipped function rather than reimplementing it is the point: a
   copy would test the copy. Fourteen guards in this project have reported
   success while checking nothing, and most were reading source instead of
   running it.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const maps = fs.readFileSync(path.join(SRC, 'modules', 'language_maps.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(
  path.join(SRC, 'resources', 'language_codes.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* ── Build the maps using the app's own loop, executed ─────────────────────── */
const bodyOf = (src, from) => {
  let depth = 0;
  for (let k = src.indexOf('{', from); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(from, k + 1);
  }
  return '';
};
/* Slice exactly the table-building region, `const ltc = {}` through the end of
   the population loop, and no further. Taking the whole function body dragged in
   its surrounding try/catch and would not parse; taking less would test a copy. */
const _start = maps.indexOf('const ltc = {}');
const _end   = maps.search(/LANG_TO_CANONICAL\s*=\s*ltc\s*;/);
const inner  = _start !== -1 && _end !== -1 ? maps.slice(_start, _end) : '';

let LANG_TO_CANONICAL = {}, CANONICAL_TO_GOOGLE = {};
{
  const build = new Function('data', `
    const langs = data.languages || {};
    ${inner}
    return { ltc, ctg };
  `);
  let built = null;
  try { built = build(data); } catch (e) { /* reported below */ }
  check(built !== null && Object.keys(built.ltc || {}).length > 100,
        'the shipped map-builder runs and produces a populated table',
        '         could not execute loadLanguageMaps()’ body — the slice may have\n'
        + '         drifted; every check below would be vacuous');
  if (!built) { console.log(`\n${pass} passed, ${fail} failed\n`); process.exit(1); }
  LANG_TO_CANONICAL = built.ltc;
  CANONICAL_TO_GOOGLE = built.ctg;
}

const langs = data.languages;
const codes = Object.keys(langs);
const resolve = v => LANG_TO_CANONICAL[v] || LANG_TO_CANONICAL[String(v).toLowerCase()] || null;

console.log(`\n${codes.length} languages, ${Object.keys(LANG_TO_CANONICAL).length} aliases\n`);

console.log('every declared form of every language resolves');
{
  const FIELDS = ['iso639_1', 'iso639_3', 'nllb_code', 'english_name', 'native_name'];
  const misses = [];
  for (const code of codes) {
    const info = langs[code];
    const shapes = [code, ...FIELDS.map(f => info[f]).filter(Boolean),
                    ...(info.aliases || [])];
    for (const shape of shapes) {
      const got = resolve(shape);
      if (got !== code)
        misses.push(`         ${code}: ${JSON.stringify(shape)} -> ${JSON.stringify(got)}`);
    }
  }
  /* One collision is real and documented: словѣньскъ is the native name of BOTH
     Old Church Slavonic (cu) and Old Russian (orv), differing only in initial
     capital, so the lowercased table keeps whichever is built last. Filed as
     B-035. Listed here explicitly so this guard still fails on a NEW collision, an allowlist is the wrong shape for a coverage check, but the right one for
     "nothing has changed since we looked". */
  const KNOWN_COLLISIONS = [['cu', 'словѣньскъ']];
  const isKnown = m => KNOWN_COLLISIONS.some(([c, form]) =>
    m.includes(`${c}: ${JSON.stringify(form)}`));
  const unexpected = misses.filter(m => !isKnown(m));
  const knownSeen  = misses.filter(isKnown);

  check(unexpected.length === 0,
        'canonical · ISO 639-1 · ISO 639-3 · NLLB · English name · native name · aliases',
        unexpected.slice(0, 12).join('\n')
        + (unexpected.length > 12 ? `\n         …${unexpected.length - 12} more` : ''));
  check(knownSeen.length > 0,
        'the documented cu/orv collision is still present — B-035 not yet fixed',
        '         it resolved cleanly, so B-035 is fixed: delete KNOWN_COLLISIONS\n'
        + '         and close the bug, or this check will hide the next one');
}

console.log('\ncase is not load-bearing');
{
  const misses = [];
  for (const code of codes) {
    const info = langs[code];
    for (const base of [code, info.iso639_3, info.english_name].filter(Boolean)) {
      const variants = [base.toUpperCase(), base.toLowerCase(),
                        base[0].toUpperCase() + base.slice(1).toLowerCase()];
      for (const v of variants)
        if (resolve(v) !== code) misses.push(`         ${code}: ${JSON.stringify(v)} did not resolve`);
    }
  }
  check(misses.length === 0, 'upper · lower · title case all resolve',
        misses.slice(0, 10).join('\n'));
}

console.log('\nGoogle reachability is knowable in advance');
{
  const withGoogle = codes.filter(c => langs[c].google_bcp47);
  const without    = codes.filter(c => !langs[c].google_bcp47);
  check(withGoogle.length > 40, `${withGoogle.length} languages carry a Google code`);
  check(without.length > 0,
        `${without.length} cannot use Google at all — a fact the UI must state, not discover`,
        '         these produce tryGoogle === false, i.e. a silent skip (B-031)');

  const broken = withGoogle.filter(c => {
    const canonical = resolve(c);
    return !(CANONICAL_TO_GOOGLE[canonical] || CANONICAL_TO_GOOGLE[String(canonical).toLowerCase()]);
  });
  check(broken.length === 0,
        'every language with a Google code resolves through to it',
        broken.map(c => `         ${c} declares google_bcp47 but CANONICAL_TO_GOOGLE misses it`).join('\n'));
}

/* ── suggestLanguage, executed ─────────────────────────────────────────────── */
console.log('\nnear misses get a suggestion instead of a dead end');
{
  const api = new Function('LANG_TO_CANONICAL', 'CANONICAL_TO_GOOGLE',
    maps.slice(maps.indexOf('function _editDistance')) +
    '\nreturn { suggestLanguage, googleCodeFor, _editDistance, _foldDiacritics };'
  )(LANG_TO_CANONICAL, CANONICAL_TO_GOOGLE);
  const { suggestLanguage, googleCodeFor } = api;

  const exact = suggestLanguage('Turkish');
  check(exact.exact === true && exact.canonical === 'tr',
        "'Turkish' resolves exactly, with no guessing",
        `         got ${JSON.stringify(exact)}`);

  const CASES = [
    ['Turkis',  'tr', 'a dropped letter'],
    ['turkihs', 'tr', 'transposed letters'],
    ['Turkce',  'tr', 'native name without diacritics'],
    ['turk',    'tr', 'a prefix'],
    ['Turkish ', 'tr', 'trailing whitespace'],
    ['Germn',   'de', 'a dropped letter'],
    ['Spanis',  'es', 'a dropped letter'],
  ];
  const bad = [];
  for (const [input, want, why] of CASES) {
    const r = suggestLanguage(input);
    const hit = r.exact ? r.canonical === want
                        : r.suggestions.some(s => s.canonical === want);
    if (!hit) bad.push(`         ${JSON.stringify(input)} (${why}) -> `
                     + `${JSON.stringify(r.suggestions.map(s => s.label))}, wanted ${want}`);
  }
  check(bad.length === 0, `${CASES.length} near misses all suggest the right language`,
        bad.join('\n'));

  check(suggestLanguage('').suggestions.length === 0 &&
        suggestLanguage('').canonical === null,
        'an empty Language field suggests nothing and resolves to nothing');

  const noise = suggestLanguage('qqqqzzzz');
  check(noise.canonical === null && noise.suggestions.length === 0,
        'unrelated input suggests nothing — the check is not a constant',
        `         got ${JSON.stringify(noise.suggestions.map(s => s.label))}`);

  check(googleCodeFor('tr') === 'tr' && googleCodeFor(null) === null,
        'googleCodeFor() answers for a supported language and for nothing');
}

console.log('\nB-064 — the message must name the REAL reason\n');
{
  /* checkLangForBackend used to return finished ALERT prose, so the in-pane
     strip could not use it and re-derived its own from the backend. 'auto', the
     default, matched neither branch and fell through to "No language set", so an
     unrecognised language and an unset one were indistinguishable.

     THE RULE: the check reports a reason; the caller only chooses a register.
     Both halves are asserted, because either alone can rot: a reason with no
     string in one register falls through again, and a message re-derived from
     something other than the reason is the original bug. */
  const vm = require('vm');
  const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
  const { fnSrc } = require('./_source.js');
  const LOC = JSON.parse(fs.readFileSync(
    path.join(SRC, 'resources', 'locale', 'en.json'), 'utf8'));

  // t() returns the KEY on a miss, exactly as the app does, so a missing string
  // is visible rather than silently empty.
  const t = (k, v = {}) => (LOC[k] || k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
  const ctx = vm.createContext({
    LANG_TO_CANONICAL, CANONICAL_TO_GOOGLE, t, logEvent: () => {},
    suggestLanguage: () => null, console,
  });
  vm.runInContext(fnSrc('LingCoT.html', 'checkLangForBackend'), ctx);
  vm.runInContext(fnSrc('LingCoT.html', 'langIssueText'), ctx);
  const { checkLangForBackend, langIssueText } = ctx;

  const BACKENDS = ['auto', 'google', 'nllb'];
  const known = codes[0];                       // a language the table knows
  const CASES = [
    [null,       'not_set'],
    ['Hawaiian', 'unrecognised'],               // the reported case
    ['zzqqxx',   'unrecognised'],
  ];

  for (const [lang, wantReason] of CASES)
    for (const backend of BACKENDS) {
      const issue = checkLangForBackend(lang, backend);
      check(issue && issue.reason === wantReason,
            `lang=${lang ?? 'null'} backend=${backend} → reason "${wantReason}"`,
            `         got ${issue ? issue.reason : 'null'}`);
    }

  check(checkLangForBackend(known, 'auto') === null,
        `a known language (${known}) on the default backend reports no issue`,
        '         if this fails the check rejects valid input, which is worse than B-064');

  /* The reported symptom, stated as its own assertion: these two produced the
     same sentence, and that is what made the reporter think the field was
     being ignored. */
  const unrec = langIssueText(checkLangForBackend('Hawaiian', 'auto'), 'inline');
  const unset = langIssueText(checkLangForBackend(null, 'auto'), 'inline');
  check(unrec !== unset,
        'an unrecognised language and an unset one no longer read the same',
        `         both said: ${unset}`);
  check(/hawaiian/i.test(unrec), 'and the unrecognised message names the language typed',
        `         got: ${unrec}`);

  /* Every reason must have a string in BOTH registers. A reason with no inline
     string is exactly the hole 'auto' fell through. */
  const REASONS = ['not_set', 'unrecognised', 'google_unsupported', 'nllb_unsupported'];
  const holes = [];
  for (const reason of REASONS)
    for (const style of ['alert', 'inline']) {
      const msg = langIssueText({ reason, lang: 'X', suggestions: [] }, style);
      const key = `${style === 'inline' ? 'warn.xlate' : 'alert.lang'}.${reason}`;
      if (!msg || msg === key) holes.push(`         ${key} is missing`);
    }
  check(holes.length === 0, `all ${REASONS.length} reasons have both an alert and an inline string`,
        holes.join('\n'));

  // The two registers must differ: alert copy carries instructions, the strip is one line.
  const alertMsg = langIssueText({ reason: 'not_set', lang: null, suggestions: [] }, 'alert');
  check(alertMsg !== langIssueText({ reason: 'not_set', lang: null, suggestions: [] }, 'inline'),
        'the alert and inline registers are genuinely different strings');
  check(alertMsg.includes('\n'), 'the alert register keeps its instructions',
        '         if it collapses to one line the alert path lost its guidance');

  // No consumer may re-derive a message from the backend, which is the original bug.
  const strip = html.slice(html.indexOf('const _r4Lang'), html.indexOf('const langWarnHtml'));
  check(!/XLATE_SETTINGS\.backend ===/.test(strip),
        'the in-pane strip does not re-derive its message from the backend',
        '         re-deriving is how the default backend fell through to the wrong string');

  const ev = fs.readFileSync(path.join(SRC, 'modules', 'events.js'), 'utf8');
  check(!/alert\(langErr\)/.test(ev),
        'no caller alerts the issue object directly',
        '         that would print [object Object]');

  /* B-064 closed with a question: an unlisted language must cost TRANSLATION and
     nothing else. 71 entries is a small table for a documentation tool and
     Hawaiian is not an obscure choice, so this is the assertion that keeps the
     unrecognised path usable rather than a dead end. */
  const callSites = (src) => src.split('\n')
    .filter(l => /checkLangForBackend\(/.test(l)
              && !/function checkLangForBackend/.test(l)
              && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
  const callers = callSites(html) + callSites(ev);
  check(callers === 5, `${callers} call site(s) of checkLangForBackend — all translation or diagnostics`,
        '         a new caller may be gating something that is not translation;\n'
      + '         an unlisted language must never block annotation');
  const N = require(path.join(SRC, 'modules', 'normalize.js'));
  check(N.dictKeyIn('Aloha', 'Hawaiian', 'Latn') === 'aloha',
        'and an unlisted language still folds for the dictionary, so annotation works',
        '         the key must fall back, not throw, on a language the table lacks');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
