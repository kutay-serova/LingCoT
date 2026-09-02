#!/usr/bin/env node
/* =============================================================================
   xlate_settings_test.js, a mode you picked must survive every way of leaving
   Run:  node dev/tests/xlate_settings_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-020 (2026-08-24). Choosing "Offline model" in the translation settings
   highlighted its row at once, and then committed the value only if the Save
   button was pressed. FOUR paths dismissed the modal without it: the Cancel
   button, the X, a click on the backdrop, and Escape. Any of them discarded the
   choice while the highlight had already told the user it was applied, so the
   mode appeared to revert to Auto next time the modal was opened.

   Reported as "translation mode does not persist globally". The setting object
   was fine; the commit point was wrong.

   WHAT THIS CHECKS
   ----------------
   Source-level, because the modal needs a DOM this suite does not have:
     1. The radio `change` handler assigns XLATE_SETTINGS.backend and persists, i.e. the choice is applied at the moment the UI says it is.
     2. Every dismiss path is still just a removal, so none of them can be the
        thing that commits (or fails to commit) the value.
     3. The dismiss button is labelled Close, not Cancel: nothing is cancelled.
     4. The free-text server URL still commits on Save, the split is deliberate,
        not an oversight.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
const en   = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'locale', 'en.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* The radio change handler, from its addEventListener to the end of the forEach. */
const i = html.indexOf("modal.querySelectorAll('input[name=\"xlate-backend\"]').forEach");
const changeHandler = html.slice(i, html.indexOf('document.getElementById(\'xlate-settings-save\')', i));

console.log('\nthe chosen mode is applied when the UI says it is\n');

check(/XLATE_SETTINGS\.backend\s*=\s*radio\.value/.test(changeHandler),
      'the radio change handler assigns XLATE_SETTINGS.backend',
      '         the value is still committed only by Save — the B-020 trap');

check(/_saveXlateSettings\(\)/.test(changeHandler),
      'and persists it immediately');

check(/_renderCacheKey\s*=\s*null/.test(changeHandler),
      'and refreshes the view (B-019: backend feeds the sentence-view warning)');

console.log('\nno dismiss path can silently discard it');
{
  /* Each dismissal must be a bare removal. If one of them ever grows a
     "commit on close" branch, the commit point has moved back into the exits. */
  const saveIdx    = html.indexOf("document.getElementById('xlate-settings-save')");
  const dismissals = html.slice(saveIdx, saveIdx + 2400);
  const closeBtn = /getElementById\('xlate-settings-cancel'\)\s*\n?\s*\.addEventListener\('click',\s*\(\)\s*=>\s*modal\.remove\(\)\)/.test(dismissals);
  const backdrop = /modal\.addEventListener\('click',\s*e\s*=>\s*\{\s*if\s*\(e\.target === modal\)\s*modal\.remove\(\);\s*\}\)/.test(dismissals);
  const escape   = /e\.key === 'Escape'.*modal\.remove\(\)/s.test(dismissals);

  check(closeBtn, 'the close button only removes the modal');
  check(backdrop, 'a backdrop click only removes the modal');
  check(escape,   'Escape only removes the modal');
}

console.log('\nthe label must not promise an undo that does not exist');
check(html.includes("t('btn.modal.xlate_settings.close')"),
      'the dismiss button uses the Close label');
check(en['btn.modal.xlate_settings.close'] === 'Close',
      `and it reads "Close" (got ${JSON.stringify(en['btn.modal.xlate_settings.close'])})`);

console.log('\nthe free-text URL still commits on Save — a deliberate split');
{
  const saveIdx  = html.indexOf("document.getElementById('xlate-settings-save')");
  const saveBody = html.slice(saveIdx, saveIdx + 1200);
  check(/XLATE_SETTINGS\.nllbUrl\s*=/.test(saveBody),
        'Save still commits the server URL');
}

/* ── B-072: the translation target comes from the corpus, not from a literal ──
   The translation field holds the METALANGUAGE of the documentation. Four call
   sites sent `en`, and the source beside each one was resolved from the corpus,
   which is what made the hard-wired half easy to miss: the request looked
   parameterised. */
{
  const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');
  const html = read('LingCoT.html');
  const mods = Object.fromEntries(moduleFiles());
  const all  = decomment([html, ...Object.values(mods)].join('\n'));

  check(/function translationTarget\(\)/.test(html), 'translationTarget() is defined');
  check(/function googleTarget\(\)/.test(html), 'googleTarget() is defined');

  /* Neither backend may carry the literal again. Written against the REQUEST
     rather than against a function name, so a fifth call site added later is
     caught by the same rule. */
  check(!/target_lang:\s*'en'/.test(all), "no NLLB request sends target_lang: 'en'");
  check(!/[?&]tl=en\b/.test(all), 'no Google request sends tl=en');

  const nllb = [...all.matchAll(/target_lang:\s*([^,}]+)/g)].map(m => m[1].trim());
  check(nllb.length >= 2, `found ${nllb.length} NLLB target(s)`);
  for (const t of nllb)
    check(/translationTarget\(\)/.test(t), `an NLLB target is resolved: ${t}`);
  const goog = [...all.matchAll(/tl=\$\{([^}]+)\}/g)].map(m => m[1].trim());
  check(goog.length >= 2, `found ${goog.length} Google target(s)`);
  for (const t of goog)
    check(/googleTarget\(\)/.test(t), `a Google target is resolved: ${t}`);

  /* Executed: the fallback order is the decision, and reading cannot show it.
     Interface language before English, because someone running the app in
     Turkish is likelier to want Turkish. */
  {
    const ctx = { LANG_TO_CANONICAL: { turkish: 'tur', tr: 'tur' }, _LOCALE: {}, doc: () => null };
    const fn = new Function('LANG_TO_CANONICAL', '_LOCALE', 'doc',
      `${fnSrc('LingCoT.html', 'uiLocaleCode')}\n${fnSrc('LingCoT.html', 'translationTarget')}\nreturn translationTarget;`);
    const call = (declared, locale) => fn(
      ctx.LANG_TO_CANONICAL,
      locale ? { _meta: { locale } } : {},
      () => (declared === undefined ? null : { metadata: { translation_language: declared } })
    )();

    check(call('tur') === 'tur', "the corpus's own metalanguage wins");
    check(call('Turkish') === 'tur', 'and is resolved through LANG_TO_CANONICAL like the source');
    check(call(undefined, 'tr') === 'tur', 'with none declared, the interface language is used');
    check(call('', 'tr') === 'tur', 'and a blank value counts as none rather than as empty');
    check(call(undefined) === 'en', "English is the last resort, not the default");
    check(call('  tur  ') === 'tur', 'the declared value is trimmed');
  }

  /* The CLI follows, per B-072's second half. A flag still wins. */
  const cli = fs.readFileSync(path.join(SRC, 'scripts', 'corpus_annotate.py'), 'utf8');
  check(/'--target-lang', default=None/.test(cli),
        "the CLI's --target-lang no longer defaults to 'en'");
  check(/def corpus_translation_language\(/.test(cli),
        'and it can read the metalanguage out of the corpus');
  check(/args\.target_lang = corpus_translation_language\(corpus_path\) or 'en'/.test(cli),
        'resolved once, with the flag winning and English last');
}

/* ── B-086: the Test connection button tests the connection ─────────────────
   `_runXlateStatusChecks` reported "online" from `navigator.onLine`, which says
   only that the machine has a network interface. Five warnings in one session
   with the panel showing green is the panel and the translation answering two
   different questions. */
{
  const { read, fnSrc } = require('./_source.js');
  const html = read('LingCoT.html');

  check(/async function probeGoogle\(\)/.test(html), 'probeGoogle() is defined');
  const probe = fnSrc('LingCoT.html', 'probeGoogle') || '';
  check(/translate\.googleapis\.com/.test(probe),
        'and it probes the endpoint the translation actually uses',
        'a probe of some other host answers a question nobody asked');
  check(/translate_a\/single/.test(probe) && /dt=t&q=/.test(probe),
        'with the same request shape, not a bare GET',
        'D29 P1b: a service can serve a root document and refuse the real call');
  check(/resp\.json\(\)/.test(probe), 'and a body that will not parse is not a working endpoint');
  check(/AbortSignal\.timeout\(/.test(probe), 'bounded, so a hung probe cannot hang the panel');

  const checks = fnSrc('LingCoT.html', '_runXlateStatusChecks') || '';
  check(/await probeGoogle\(\)/.test(checks), 'the status strip runs it');
  check(/label\.xlate\.status\.google\b/.test(checks),
        'and shows a row for it, separate from the interface row');
  check(/google\.error \|\| _lastGoogleError/.test(checks),
        'reporting what came back rather than a generic line');

  /* The interface row must stop claiming more than it knows. */
  const loc = JSON.parse(read('resources/locale/en.json'));
  check(loc['label.xlate.status.internet'] === 'Network interface',
        'the navigator.onLine row is labelled for what it measures');
  for (const k of ['label.xlate.status.google', 'label.xlate.status.google_ok',
                   'label.xlate.status.google_down', 'modal.xlate_fail.recorded'])
    check(Object.prototype.hasOwnProperty.call(loc, k), `${k} exists in the locale`);

  /* And the failure modal shows the recorded error, which is the half the log
     had and the user did not. */
  check(/let _lastGoogleError = ''/.test(html), '_lastGoogleError is recorded');
  check(/_lastGoogleError = `\$\{err/.test(html), 'and written where the request fails');
  const fail = fnSrc('LingCoT.html', 'showXlateFailModal') || html;
  check(/modal\.xlate_fail\.recorded/.test(fail),
        'the failure modal shows it',
        'a refused request and a genuine outage read identically without this');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
