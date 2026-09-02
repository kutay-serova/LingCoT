#!/usr/bin/env node
/* =============================================================================
   help_coverage_test.js, every screen has help, and it is translatable
   Run:  node dev/tests/help_coverage_test.js
   =============================================================================
   B-038. Per-view help was a 17 KB hardcoded English object in events.js. Two
   consequences:

     · it could not be translated at all, while every other string in the app
       could, and D24 (language porting) would have had to move it anyway
     · nothing checked its keys against the view list, so the entry for the
       search screen was keyed `search` while the view is `search-b`. It had been
       unreachable since Search-A was retired, and the search screen, the most
       feature-dense in the app, showed "No additional help for this view".

   Help now lives in the locale files as help.view.<view>.{title,body}. This
   guard pairs the two lists so a new view cannot ship without help, and a
   renamed view cannot silently orphan the help it had.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
const evts = fs.readFileSync(path.join(SRC, 'modules', 'events.js'), 'utf8');
const css  = fs.readFileSync(path.join(SRC, 'LingCoT.css'), 'utf8');
const en   = JSON.parse(fs.readFileSync(
  path.join(SRC, 'resources', 'locale', 'en.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* The authoritative view list. */
const block = html.slice(html.indexOf('const VIEW_RENDERERS = {'));
const views = [...block.slice(0, block.indexOf('};')).matchAll(/'([a-z-]+)':/g)].map(m => m[1]);

console.log(`\n${views.length} views in VIEW_RENDERERS\n`);
check(views.length > 15, 'the view list parsed', '         too few — every check below would be vacuous');

console.log('every view has help, in the locale file');
{
  const missing = views.filter(v => !en[`help.view.${v}.body`] || !en[`help.view.${v}.title`]);
  check(missing.length === 0, `all ${views.length} views have a title and body`,
        missing.map(v => `         ${v} — no help.view.${v}.title/body`).join('\n')
        + '\n         → that screen shows the fallback, saying there is no help');

  const orphans = Object.keys(en)
    .filter(k => /^help\.view\.[a-z-]+\.body$/.test(k))
    .map(k => k.split('.')[2])
    .filter(v => v !== 'fallback' && !views.includes(v));
  check(orphans.length === 0,
        'no help entry names a view that does not exist',
        orphans.map(v => `         help.view.${v}.* has no matching view — renamed or deleted?\n`
                       + `         this is exactly how the search help went dark (B-038)`).join('\n'));

  check(!!en['help.view.fallback.body'] && !!en['help.view.fallback.title'],
        'a fallback exists for a view that has none');
}

console.log('\nhelp is not hardcoded any more');
{
  check(!/_HELP_CONTENT/.test(evts),
        'the hardcoded _HELP_CONTENT object is gone from events.js',
        '         while it exists, help cannot be translated and drifts from the locale');
  check(/help\.view\.\$\{v\}|help\.view\.\$\{/.test(evts) || /`help\.view\./.test(evts),
        'updateHelpContent() reads help.view.<view>.* from the locale');
}

console.log('\nthe help button sits below anything that opens over it');
{
  /* B-039: at z-index 400 it floated in front of the File dropdown and every
     modal backdrop, which are all 300. */
  const m = /#help-btn\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(css);
  check(m !== null, '#help-btn declares a z-index');
  if (m) {
    const btn = Number(m[1]);
    const overlays = [...css.matchAll(/#file-dropdown\s*\{[\s\S]*?z-index:\s*(\d+)/g)]
                       .map(x => Number(x[1]));
    check(overlays.length > 0, 'the File dropdown declares one too');
    check(overlays.every(o => btn < o),
          `#help-btn (${btn}) is below the File dropdown (${overlays.join(', ')})`,
          '         a persistent affordance must not float in front of a menu that opens');
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
