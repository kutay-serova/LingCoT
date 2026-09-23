#!/usr/bin/env node
/* =============================================================================
   user_settings_test.js, settings come from the workspace over the repo defaults
   Run:  node dev/tests/user_settings_test.js
   =============================================================================
   tb-settings. The page reads resources/locale/settings.default.json (repo,
   read-only) and overlays settings.json from the workspace (read_user_file).
   Checked by running the real loadLocale / toggleTheme against a stub bridge:
     · the workspace value wins over the default
     · a missing workspace file falls back to the defaults, without an error
     · a theme toggle before the settings are read does not write the file,
       so it cannot replace a saved locale with the default
     · a toggle after keeps the other keys
   The host side (paths, allowlist, migration) is in workspace_test.js.
   ============================================================================= */

const vm = require('vm');
const { read } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

// A context with a stub bridge. `user` is the workspace settings.json, or null.
function boot(user) {
  const ctx = makeCtx({ hasId: () => true });
  ctx.__reads = []; ctx.__writes = [];
  ctx.pywebview = { api: {
    read_file: async f => {
      ctx.__reads.push(f);
      if (f === 'resources/locale/settings.default.json') return '{"ui_locale":"en","theme":"dark"}';
      if (/^resources\/locale\/\w+\.json$/.test(f)) return read('resources/locale/en.json');
      return '[]';
    },
    read_user_file: async f => (f === 'settings.json' ? user : null),
    write_user_file: async (f, c) => { ctx.__writes.push([f, c]); return true; },
    get_workspace: async () => ({}),
    get_app_info:  async () => ({}),
  } };
  const errs = loadApp(ctx, appSources());
  return { ctx, errs, run: e => vm.runInContext(e, ctx) };
}
const settle = () => new Promise(r => setTimeout(r, 20));

(async () => {
  console.log('\nthe workspace file wins over the defaults\n');
  {
    const { ctx, errs, run } = boot('{"ui_locale":"haw"}');
    check(!errs.length, 'the app loads into the stub DOM', errs.map(([f, e]) => `       ${f}: ${e.message}`).join('\n'));
    await run('loadLocale()'); await settle();
    check(ctx.__reads.includes('resources/locale/haw.json'), 'ui_locale from the workspace picks the locale file',
          `       read ${JSON.stringify(ctx.__reads.filter(f => f.startsWith('resources/locale')))}`);
    check(run('_settings.theme') === 'dark', 'a key the workspace file lacks comes from the defaults');
    run('toggleTheme()'); await settle();
    const w = ctx.__writes.pop();
    const saved = w ? JSON.parse(w[1]) : {};
    check(w && w[0] === 'settings.json', 'a toggle after loading writes the workspace settings.json');
    check(saved.ui_locale === 'haw' && (saved.theme === 'light' || saved.theme === 'dark'),
          'and keeps the locale beside the new theme', `       wrote ${w && w[1]}`);
  }

  console.log('\nno workspace file yet\n');
  {
    const { ctx, run } = boot(null);
    run('toggleTheme()'); await settle();
    check(ctx.__writes.length === 0, 'a toggle before the settings are read writes nothing',
          '       it would write the in-memory defaults over a saved ui_locale');
    await run('loadLocale()'); await settle();
    check(ctx.__reads.includes('resources/locale/en.json'), 'the default locale is used');
    check(!ctx.__reads.includes('resources/locale/settings.json'), 'the old in-repo settings.json is not read by the page');
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
