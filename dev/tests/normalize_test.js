#!/usr/bin/env node
/* =============================================================================
   normalize_test.js, the dictionary key, EXECUTED
   Run:  node dev/tests/normalize_test.js
   =============================================================================
   B-043. The key was `form.toLowerCase()`; in Turkish that maps "İstanbul" to
   "i"+U+0307, so a token never matched its own lemma and the miss branch, which
   IS the create branch, forked the entry silently.

   THE RULE THIS GUARD HOLDS: a dictionary key must fold everything that is not
   a distinction in the language, and NOTHING that is. Both halves fail
   silently, so both are asserted:

     vectors[]   pairs that MUST collide   (under-folding → duplicate entries)
     distinct[]  pairs that MUST NOT       (over-folding → merged real words)

   `distinct` is the half that is easy to forget and expensive to get wrong.
   Stripping Latin diacritics or folding Arabic taa marbuta would pass every
   `vectors` assertion here while destroying real contrasts in exactly the
   fieldwork languages this tool exists for.

   ANTI-VACUITY: every vector is also run through the OLD key. A vector the old
   key already satisfied is proving nothing, and is reported as VACUOUS and
   failed. Fourteen guards in this project have reported success while checking
   nothing; this one refuses to be the fifteenth.
   ============================================================================= */

const path = require('path');
const { SRC } = require('./_source.js');
const N = require(path.join(SRC, 'modules', 'normalize.js'));

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const keyV1 = f => (f || '').toLowerCase();   // the pre-v3.14.103 key

console.log('\nB-043 — the reported bug, against the key that caused it\n');
{
  const trPairs = [['İstanbul', 'istanbul'], ['Isparta', 'ısparta'], ['İĞNE', 'iğne']];
  for (const [a, b] of trPairs) {
    check(N.dictKeyIn(a, 'tr', 'Latn') === N.dictKeyIn(b, 'tr', 'Latn'),
          `tr: ${a} matches ${b}`,
          `         got ${JSON.stringify(N.dictKeyIn(a, 'tr', 'Latn'))} vs `
        + `${JSON.stringify(N.dictKeyIn(b, 'tr', 'Latn'))}`);
    check(keyV1(a) !== keyV1(b),
          `tr: ${a}/${b} genuinely broke under the old key — the vector is not vacuous`);
  }
  // The tailoring must NOT leak into languages that do not want it.
  check(N.dictKeyIn('Istanbul', null, 'Latn') === N.dictKeyIn('istanbul', null, 'Latn'),
        'en: plain I still lowercases to plain i when no tailoring applies');
  check(N.dictKeyIn('Isparta', 'tr', 'Latn') !== N.dictKeyIn('isparta', 'tr', 'Latn'),
        'tr: dotless ı and dotted i stay DISTINCT — they are different letters');
}

console.log('\nL0 — Unicode form, every script\n');
{
  const nfc = '한글'.normalize('NFC'), nfd = '한글'.normalize('NFD');
  check(nfc !== nfd, 'the Korean NFC/NFD pair is genuinely different as raw text');
  check(N.dictKeyIn(nfd, null, 'Hang') === N.dictKeyIn(nfc, null, 'Hang'),
        'Hangul composed and decomposed produce one key');
  check(keyV1(nfc) !== keyV1(nfd),
        'and the old key kept them apart — not vacuous');
  check(N.dictKeyIn('é', null, 'Latn') === N.dictKeyIn('é'.normalize('NFD'), null, 'Latn'),
        'precomposed and decomposed Latin accents produce one key');
}

console.log('\nL1 — the case tailoring list is complete and closed\n');
{
  check(Object.keys(N.CASE_TAILORED_LOCALES).sort().join(',') === 'az,lt,tr',
        'exactly three locales are tailored — Unicode SpecialCasing has no others',
        `         got: ${Object.keys(N.CASE_TAILORED_LOCALES).join(',')}`);
  // Cases people assume need a table, which the DEFAULT mapping already handles.
  check(N.dictKeyIn('ΟΔΟΣ', null, 'Grek') === N.dictKeyIn('οδος', null, 'Grek'),
        'Greek final sigma needs no tailoring — default case mapping handles it');
}

console.log('\nL2 — every script profile, executed against its own vectors\n');
{
  let vectors = 0, vacuous = 0;
  for (const [script, prof] of Object.entries(N.SCRIPT_PROFILES)) {
    for (const [a, b, why] of (prof.vectors || [])) {
      vectors++;
      check(N.dictKeyIn(a, null, script) === N.dictKeyIn(b, null, script),
            `${script}: ${why}`,
            `         ${JSON.stringify(a)} → ${JSON.stringify(N.dictKeyIn(a, null, script))}\n`
          + `         ${JSON.stringify(b)} → ${JSON.stringify(N.dictKeyIn(b, null, script))}`);
      if (keyV1(a) === keyV1(b)) {
        vacuous++;
        check(false, `${script}: VACUOUS — the old key already matched "${why}"`,
              '         this vector proves nothing; replace it with one that failed before');
      }
    }
    for (const [a, b, why] of (prof.distinct || [])) {
      check(N.dictKeyIn(a, null, script) !== N.dictKeyIn(b, null, script),
            `${script}: ${why} (must stay distinct)`,
            `         both folded to ${JSON.stringify(N.dictKeyIn(a, null, script))} `
          + '— this profile is over-folding and is destroying a real contrast');
    }
    // A profile that folds must say what it folds and prove it.
    if (prof.fold) {
      check((prof.vectors || []).length > 0,
            `${script}: an active fold profile carries vectors`,
            '         a fold rule with no vector is untested code that fails invisibly');
    }
  }
  console.log(`\n  (${vectors} fold vectors executed, ${vacuous} vacuous)`);
}

console.log('\nscript detection, from text rather than metadata\n');
{
  const cases = [['İstanbul', 'Latn'], ['한글', 'Hang'], ['العربية', 'Arab'],
                 ['שלום', 'Hebr'], ['ｶﾀｶﾅ', 'Jpan'], ['カタカナ', 'Jpan'],
                 ['Ελληνικά', 'Grek'], ['русский', 'Cyrl'], ['देवनागरी', 'Deva'],
                 ['', null], ['123 …', null]];
  for (const [text, want] of cases)
    check(N.detectScript(text) === want,
          `detectScript(${JSON.stringify(text)}) → ${want}`,
          `         got ${N.detectScript(text)}`);
  check(N.detectScript('日本語のテキスト') === 'Jpan',
        'Han mixed with kana is Japanese, not Han — kana are checked first');
}

console.log('\nthe key is versioned, and the app agrees with the module\n');
{
  check(N.DICT_KEY_VERSION >= 2,
        'DICT_KEY_VERSION is past v1 (the bare toLowerCase that caused B-043)');
  const { readSrc } = (() => {
    const fs = require('fs');
    return { readSrc: f => fs.readFileSync(path.join(SRC, f), 'utf8') };
  })();
  const html = readSrc('LingCoT.html');
  check(/<script src="modules\/normalize\.js"><\/script>/.test(html),
        'LingCoT.html loads the module — a key nothing imports is not the key');
  check(/function normForm\(f\)\s*\{[\s\S]{0,200}dictKey\(f\)/.test(html),
        'normForm() delegates to dictKey() rather than carrying its own copy',
        '         B-037: a hand-copied rule tests the copy, not the rule');
  check(/refreshFoldContext\(/.test(html) && /buildDictIndex\(\)/.test(html),
        'the fold context is re-derived and the index rebuilt when it changes',
        '         an index built under one context and probed under another is B-043 again');

  /* B-097: the check above proves the mechanism exists, which is not the same as
     proving it runs. It did not run when a corpus was CREATED — only when one
     was opened, or when its language was edited afterwards — so the session that
     built a dictionary from nothing did so under the wrong fold, and reopening
     the file rebuilt the index under different keys.

     The rule, stated where it can be checked: a document arriving in S.docs
     brings a language with it, and the fold has to be bound before anything is
     keyed under it. Every site that installs one must say so. */
  {
    const bare  = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
    const marks = [...bare.matchAll(/^function (\w+)/gm)];
    const ownerAt = i => { let last = null; for (const m of marks) { if (m.index > i) break; last = m[1]; } return last; };
    const installers = new Set(
      [...bare.matchAll(/S\.docs\s*=\s*(?!\[\])|S\.docs\.push\(/g)].map(m => ownerAt(m.index))
    );
    check(installers.size > 0, `${installers.size} function(s) install a document into S.docs`);
    for (const fn of installers) {
      const body = (() => {
        const i = bare.indexOf('function ' + fn + '(');
        let d = 0, st = bare.indexOf('{', i);
        for (let k = st; k < bare.length; k++) {
          if (bare[k] === '{') d++;
          else if (bare[k] === '}' && --d === 0) return bare.slice(i, k + 1);
        }
        return '';
      })();
      check(/refreshFoldContext\(/.test(body),
            `${fn}() binds the fold context for the document it installs`,
            '         without it the corpus is keyed under whatever the last one left behind,\n' +
            '         and dict_key_version is never stamped (B-098)');
    }

    /* B-222: a corpus created in the app has nothing keyed under an older rule.
       refreshFoldContext warns about any document whose version is missing, so
       creation must stamp the current version before binding, or every new
       corpus starts its log with "key version changed, run dict_dedupe.js". */
    const i = bare.indexOf('function saveNewCorpus(');
    const body = bare.slice(i, bare.indexOf('\nfunction ', i + 10));
    const stamp = body.search(/metadata\.dict_key_version\s*=\s*DICT_KEY_VERSION/);
    const bind  = body.indexOf('refreshFoldContext(');
    check(i > -1 && stamp > -1 && bind > -1 && stamp < bind,
          'saveNewCorpus() stamps the current key version before binding the fold',
          '         otherwise a brand-new corpus logs a key-version warning (B-222)');
  }
}

console.log('\nB-056 — the CONSUMERS of the key, not just the key\n');
{
  const fs = require('fs');
  const files = ['LingCoT.html', 'modules/events.js', 'modules/search.js',
                 'modules/participants.js']
    .map(f => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]);

  /* THE RULE: a FORM is compared with the dictionary key. Bare toLowerCase() on
     a form is the pre-B-043 key wearing a different name, and B-056 is what it
     costs: an annotator could not find their own Turkish entries by typing them.

     Mechanical and un-driftable: no single line may hold both toLowerCase() and
     a form accessor. An allowlist of "audited" call sites is what let this one
     survive B-043, so there is none. */
  const FORM_ACCESSOR = /\b(?:e|entry|w|word|m|morph|morpheme|tok|token|seg)\.form\b|\bentry\.form\b|\bform\.toLowerCase/;
  let offenders = [];
  for (const [name, src] of files) {
    src.split('\n').forEach((line, i) => {
      if (/\.toLowerCase\(\)/.test(line) && FORM_ACCESSOR.test(line)
          && !/^\s*(\/\/|\*)/.test(line))
        offenders.push(`${name}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  check(offenders.length === 0, 'no form comparison uses bare toLowerCase()',
        offenders.map(o => '         ' + o).join('\n'));

  const html = files[0][1];
  check(/function normMeta\(s\)/.test(html),
        'normMeta() exists — the metalanguage fold is a separate function',
        '         one "same text" helper for both languages is how B-056 happened');

  // The browse filter, the reported surface.
  const bf = html.slice(html.indexOf('function dictBrowseFiltered'),
                        html.indexOf('function dictBrowseFiltered') + 2500);
  check(/normForm\(e\.form\)/.test(bf) && /normForm\(entryTranslit\(e\)\)/.test(bf),
        'the browse filter folds form and transliteration with the dictionary key');
  check(/normMeta\(e\.gloss\)/.test(bf) && /normMeta\(e\.meaning\)/.test(bf),
        'and folds gloss, POS, definition and domain as metalanguage');
  check(!/toLowerCase\(\)/.test(bf),
        'and nothing in it is left on the old key');

  // The executed half: the two cases the bug reported.
  const hit = (q, form) => N.dictKeyIn(form, 'tr', 'Latn').includes(N.dictKeyIn(q, 'tr', 'Latn'));
  check(hit('istanbul', 'İstanbul'), 'searching "istanbul" now finds "İstanbul"');
  check(hit('ısparta', 'ISPARTA'),   'searching "ısparta" now finds "ISPARTA"');
  check(!keyV1('İstanbul').includes(keyV1('istanbul')),
        'and the old key genuinely missed it, so the fix is not decoration');

  // The metalanguage fold must NOT apply Turkish casing to an English gloss.
  const normMeta = t => String(t || '').normalize('NFC').toLowerCase();
  check(normMeta('I') === 'i' && N.dictKeyIn('I', 'tr', 'Latn') === '\u0131',
        'and an English gloss "I" folds to "i", not to Turkish dotless \u0131',
        '         one fold for both languages breaks the other one');
}


/* ── B-120, v3.14.279: and SEARCH uses that key for the object language ──────
   The rule above is about the dictionary key. B-120 is the same rule one module
   over: `iu` is Unicode SIMPLE case folding, which does not map `İ` to `i`, so
   searching a Turkish corpus for `ikna` returned none of its three `İkna`.

   Executed, against the real compiler in `search.js`. The fold is a property of
   the FIELD, so the half that must not fold is asserted beside the half that
   must — over-folding the metalanguage would break an English gloss in exactly
   the way `distinct[]` above exists to catch. */
console.log('\nB-120 — the object language folds with that key; the metalanguage does not\n');
{
  const vm = require('vm');
  const fs = require('fs');
  const src = fs.readFileSync(path.join(SRC, 'modules', 'search.js'), 'utf8');
  const ctx = { console, RegExp, Set, Map, Array, String, Object,
                normForm: f => N.dictKeyIn(f || '', 'tr', 'Latn'),
                _srchTranslitErr: null, _srchTranslitWarnW: false };
  vm.createContext(ctx);
  vm.runInContext("let _srchRegex = false, _srchCaseSensitive = false;", ctx);
  /* Lifted whole from the shipped file, so a rewrite that changes the rule
     fails here rather than a copy of the rule agreeing with itself. */
  const lift = name => {
    const i = src.indexOf(`function ${name}(`);
    if (i < 0) return false;
    let d = 0, j = src.indexOf('{', i);
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } }
    vm.runInContext(src.slice(i, j), ctx);
    return true;
  };
  const nofold = /const\s+_SRCH_NO_FOLD\s*=\s*[^;]+;/.exec(src);
  check(!!nofold, 'search.js declares one shared identity fold',
        '         a fresh arrow per call makes "is anything folding?" always true');
  if (nofold) vm.runInContext(nofold[0], ctx);
  const lifted = ['srchFieldFold', '_srchCompiled', 'parseQuery', 'compileTokenQuery'].filter(lift);
  check(lifted.length === 4, `lifted ${lifted.length} of 4 compiler functions out of search.js`,
        '         a rename here means this guard is reading nothing');

  const T = (q, field, subject, cs = false, rx = false) => {
    vm.runInContext(`_srchCaseSensitive = ${cs}; _srchRegex = ${rx};`, ctx);
    Object.assign(ctx, { __q: q, __f: field, __s: subject });
    return vm.runInContext('compileTokenQuery(__q, __f).matches(__s)', ctx);
  };

  check(T('ikna', 'text', 'İkna'), 'searching "ikna" finds "İkna" — the reported case',
        '         /^ikna$/iu does not match İkna: simple case folding excludes U+0130');
  check(T('İkna', 'text', 'ikna'), 'and it holds in the other direction');
  check(T('kuzey', 'text', 'Kuzey'), 'ordinary case-insensitivity still works');
  check(T('güneş', 'text', 'GÜNEŞ'), 'as does it over Turkish diacritics');
  check(!T('gunes', 'text', 'GÜNEŞ'), 'and "gunes" still does NOT find "GÜNEŞ" — ü is a distinction',
        '         over-folding here would merge real words, which is `distinct[]`’s half of the rule');
  check(!T('IKNA', 'text', 'ikna'), 'Turkish dotless I is not i, so "IKNA" does not find "ikna"',
        '         this is the fold being CORRECT, not the fold being absent');
  check(T('me*', 'text', 'Metin') && T('*tin', 'text', 'Metin'),
        'wildcards survive the fold — * is not a letter, so the key passes it through');

  check(T('I', 'gloss', 'i'), 'a gloss is METALANGUAGE and keeps the regex flag',
        '         folding an English gloss "I" with Turkish rules gives ı — B-033’s regime table');
  check(!T('ikna', 'text', 'İkna', true), 'case-sensitive mode folds nothing, which is the point of it');
  check(T('ikna', 'text', 'ikna', true), 'and still matches what it should');
  check(!T('ikna', 'text', 'İkna', false, true), 'regex mode is left to the user’s own inline flags');

  /* The other half of B-120: the aggregation keys. Source-level, because these
     are keys inside a builder that needs a whole corpus to run — but specific,
     so a `toLowerCase` reintroduced as an object-language key fails here. */
  const sb = fs.readFileSync(path.join(SRC, 'modules', 'search.js'), 'utf8')
               .split('\n').filter(l => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n');
  const lows = [...sb.matchAll(/\.toLowerCase\(\)/g)].length;
  check(lows === 0, 'no toLowerCase survives in search.js as an object-language key',
        `         ${lows} left — the frequency type key, the collocate key and the two sort keys were four of them`);
  check(/const key = normForm\(surface\)/.test(sb) && /const key = normForm\(tok\.norm\)/.test(sb),
        'the frequency and collocate keys both fold with normForm',
        '         two keys over one vocabulary must agree, or a type is counted twice');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
