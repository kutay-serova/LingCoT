#!/usr/bin/env node
/* =============================================================================
   locale_parity_test.js, every interface language has every key, and the
   picker and the English fallback work
   Run:  node dev/tests/locale_parity_test.js
   =============================================================================
   tb-i18n. A locale file is source/resources/locale/<code>.json with
   _meta.locale === <code>. Checked here:
     · each one has exactly en.json's keys, all string values
     · the host's list_locales() finds them (executed, webview stubbed)
     · t() falls back to English for a key the locale lacks, and a locale
       file that cannot be read falls back to English as a whole
     · the picker lists every locale and marks the current one
   Placeholders ({n}, {name}) are not compared: the translator keeps them by
   convention, decided at tb-i18n.
   ============================================================================= */

const fs = require('fs'), path = require('path'), vm = require('vm');
const { SRC } = require('./_source.js');
const { appSources, makeCtx, loadApp, stubEl } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const DIR = path.join(SRC, 'resources', 'locale');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('settings')).sort();
const load = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const EN = load('en.json');
const enKeys = Object.keys(EN).filter(k => k !== '_meta');

console.log('\nevery locale file matches en.json\n');
check(files.includes('en.json') && files.length >= 2, `locale files found: ${files.join(', ')}`);
for (const f of files) {
  let d;
  try { d = load(f); } catch (e) { check(false, `${f} parses`, `         ${e.message}`); continue; }
  const code = f.slice(0, -5);
  check(d._meta && d._meta.locale === code && typeof d._meta.language === 'string' && d._meta.language.trim(),
        `${f}: _meta names locale "${code}" and a language (${d._meta && d._meta.language})`);
  const keys = new Set(Object.keys(d).filter(k => k !== '_meta'));
  const missing = enKeys.filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !(k in EN));
  check(!missing.length && !extra.length, `${f}: same ${enKeys.length} keys as en.json`,
        [...missing.slice(0, 10).map(k => `         missing ${k}`), ...extra.slice(0, 10).map(k => `         extra   ${k}`)].join('\n'));
  const bad = [...keys].filter(k => typeof d[k] !== 'string');
  check(!bad.length, `${f}: every value is a string`, bad.slice(0, 10).map(k => `         ${k}`).join('\n'));
}

console.log('\nthe host lists them\n');
{
  const { execFileSync } = require('child_process');
  const probe = `
import importlib.util as ilu, json, sys, types
from importlib.machinery import SourceFileLoader
sys.modules['webview'] = types.SimpleNamespace(OPEN_DIALOG=0, SAVE_DIALOG=1, FileDialog=types.SimpleNamespace(OPEN=0, SAVE=1))
sys.path.insert(0, ${JSON.stringify(SRC)})
spec = ilu.spec_from_loader('app', SourceFileLoader('app', ${JSON.stringify(path.join(SRC, 'LingCoT.pyw'))}))
m = ilu.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(m.Api().list_locales(), ensure_ascii=False))
`;
  const os = require('os');
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot_ws_'));
  let r = null, err = '';
  try { r = JSON.parse(execFileSync('python3', ['-c', probe], { encoding: 'utf8', env: { ...process.env, LINGCOT_WORKSPACE: ws } }).trim().split('\n').pop()); }
  catch (e) { err = String(e.stderr || e.message).trim().split('\n').slice(-3).join(' '); }
  try { fs.rmSync(ws, { recursive: true, force: true }); } catch (_) {}
  check(Array.isArray(r), 'list_locales() runs', `         ${err}`);
  if (Array.isArray(r)) {
    check(r.map(x => x.locale).join(',') === files.map(f => f.slice(0, -5)).join(','),
          `and returns every locale file, settings excluded (${r.map(x => x.locale).join(', ')})`);
    check(r.every(x => x.language === load(x.locale + '.json')._meta.language), 'each with its language name');
  }
}

console.log('\nthe page: English fallback and the picker\n');
(async () => {
  const ctx = makeCtx({ hasId: () => true });
  const els = new Map();
  ctx.document.getElementById = id => { if (!els.has(id)) els.set(id, stubEl()); return els.get(id); };
  const PARTIAL = { _meta: { locale: 'zz', language: 'Zed' }, 'btn.nav.search': 'ZZ-SEARCH' };
  ctx.pywebview = { api: {
    read_file: async f => {
      if (f === 'resources/locale/en.json') return JSON.stringify(EN);
      if (f === 'resources/locale/zz.json') return JSON.stringify(PARTIAL);
      if (f === 'resources/locale/settings.default.json') return '{"ui_locale":"en"}';
      if (/^resources\/locale\//.test(f)) throw new Error('no such file');
      return '[]';
    },
    read_user_file: async () => null, write_user_file: async () => true,
    list_locales: async () => [{ locale: 'en', language: 'English' }, { locale: 'zz', language: 'Zed' }],
    get_workspace: async () => ({}), get_app_info: async () => ({}),
  } };
  const errs = loadApp(ctx, appSources());
  check(!errs.length, 'the app loads into the stub DOM', errs.map(([f, e]) => `       ${f}: ${e.message}`).join('\n'));
  const run = e => vm.runInContext(e, ctx);

  await run('loadLocale()'); await new Promise(r => setTimeout(r, 20));
  const sel = els.get('ui-locale-select');
  check(sel && /value="en" selected/.test(sel.innerHTML) && /value="zz"/.test(sel.innerHTML) && /Zed/.test(sel.innerHTML),
        'the picker lists every locale and marks the current one', `       ${sel && sel.innerHTML}`);

  await run("applyLocale('zz')");
  check(run("t('btn.nav.search')") === 'ZZ-SEARCH', 'a key the locale has is used');
  check(run("t('btn.nav.open')") === EN['btn.nav.open'], 'a key it lacks falls back to English, not the raw key',
        `       got ${run("t('btn.nav.open')")}`);
  check(run('uiLocaleCode()') === 'zz', 'and the locale code follows the file');

  await run("applyLocale('xx')");
  check(run('uiLocaleCode()') === 'en' && run("t('btn.nav.search')") === EN['btn.nav.search'],
        'a locale file that cannot be read falls back to English');

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL threw', e); process.exit(1); });
