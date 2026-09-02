#!/usr/bin/env node
/* =============================================================================
   theme_audit_test.js, dark-mode CSS hazards
   Run:  node dev/tests/theme_audit_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-001 (2026-08-06): sentence text rendered black-on-dark in the paragraph
   view.  Cause: `.sent-card` is a <button>, and buttons do NOT inherit `color`, the UA stylesheet forces `buttontext` (black).  The rule set background and
   border but no colour, so in light mode it looked right by accident.

   Auditing it turned up three more of the same family, all invisible in light
   mode and none caught by any existing test:
     · `.hdr-btn`, same missing-colour hazard.
     · `.latex-panel*`, dark overrides were written against `.latex-section*`,
       a class name no element carries, so the export panel kept its near-white
       background while `.latex-pre` inherited near-white `var(--text)`.
     · `--success` / `--danger`, referenced but never defined.

   The checks below are static and cheap.  They cannot prove a theme looks good,
   only that these specific, repeat-offender hazards are absent.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const css  = fs.readFileSync(path.join(SRC, 'LingCoT.css'), 'utf8');
let html   = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
for (const f of fs.readdirSync(path.join(SRC, 'modules'))) {
  html += '\n' + fs.readFileSync(path.join(SRC, 'modules', f), 'utf8');
}

/* Strip comments before deciding whether a class name is emitted.
   Found 2026-08-24: `.translate-btn.done` had been an orphaned rule for an
   unknown length of time, and this check passed only because the bare word
   "done" appeared inside a COMMENT in modules/search.js ("must be done BEFORE
   <BREAK> splitting"). Deleting that dead code removed the comment and exposed
   the orphan. A guard that treats prose as evidence reports on the wrong file, the same mistake the icon-sprite check and the section-link pin each made. */
html = html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/[^\n]*/gm, ' ');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Rules, as [selectorList, body] pairs.  Good enough for a flat stylesheet with
   no nesting or @media blocks containing braces in values. */
const CSS_NC = css.replace(/\/\*[\s\S]*?\*\//g, "");
const RULES = [...CSS_NC.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => [m[1].trim(), m[2]]);

/* The element a selector actually styles is its LAST compound, `.a .b` styles
   `.b`, not `.a`.  Getting this wrong made the first pass of this audit report
   `.sent-card` as fine, because `.sent-card .trl` sets a colour. */
const subject = sel => sel.trim().split(/\s*[>+~]\s*|\s+/).pop();

const declaresColor = cls =>
  RULES.some(([sels, body]) => {
    const b = body.replace(/(background|border|outline|text-decoration)-color/g, '');
    if (!/(?<![-\w])color\s*:/.test(b)) return false;
    return sels.split(',').some(s =>
      new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(subject(s)));
  });

/* ── 1. Every <button> must get a colour from at least one of its classes ── */
console.log('\nbuttons must not fall back to UA buttontext');
{
  const combos = new Set();
  for (const m of html.matchAll(/<button[^>]*?class="([^"]*)"/g)) {
    const cls = m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/).filter(Boolean).sort();
    if (cls.length) combos.add(cls.join(' '));
  }
  const bad = [...combos].filter(c => !c.split(' ').some(declaresColor));
  check(bad.length === 0,
        `${combos.size} button class combos all declare a colour`,
        bad.map(c => `         no colour: <button class="${c}">`).join('\n'));
}

/* ── 2. Dark overrides must target selectors that exist elsewhere ────────── */
console.log('\ndark overrides must target real selectors');
{
  const orphans = [];
  for (const [sels] of RULES) {
    for (const sel of sels.split(',')) {
      const s = sel.trim();
      if (!s.startsWith(':root[data-theme="dark"]')) continue;
      const bare = s.replace(/^:root\[data-theme="dark"\]\s*/, '').trim();
      if (!bare) continue;
      // Every class named in the override should appear somewhere in the markup.
      for (const cls of bare.match(/\.[\w-]+/g) || []) {
        const name = cls.slice(1);
        if (!new RegExp(`["'\\s]${name}(?![\\w-])`).test(html)) orphans.push(`${bare}  →  .${name} unused`);
      }
    }
  }
  check(orphans.length === 0,
        'no dark override targets a class no element carries',
        [...new Set(orphans)].map(o => `         ${o}`).join('\n'));
}

/* ── 3. Custom properties must be defined before they are consumed ───────── */
console.log('\ncustom properties must be defined');
{
  const defined = new Set([...CSS_NC.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const used    = new Set([...CSS_NC.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
  const missing = [...used].filter(v => !defined.has(v));
  check(missing.length === 0,
        `${used.size} referenced custom properties are all defined`,
        missing.map(v => `         undefined: ${v}`).join('\n'));
}

/* ── 4. Theme tokens must exist in both themes ───────────────────────────── */
console.log('\ntheme tokens must be paired');
{
  const block = re => (css.match(re) || [''])[0];
  const light = block(/:root\s*\{[^}]*\}/);
  const dark  = block(/:root\[data-theme="dark"\]\s*\{[^}]*\}/);
  const names = b => new Set([...b.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const L = names(light), D = names(dark);
  // Layout/typography tokens are deliberately theme-invariant; only colour-ish
  // ones need a dark counterpart.
  const COLOURY = /^--(bg|surface|border|text|accent|hi|dict|trans|edit|on|warn|success|danger)/;
  const unpaired = [...L].filter(n => COLOURY.test(n) && !D.has(n));
  check(unpaired.length === 0,
        `${[...L].filter(n => COLOURY.test(n)).length} colour tokens have dark counterparts`,
        unpaired.map(n => `         light-only: ${n}`).join('\n'));
}

/* ── 5. A shared control class must carry the whole look ─────────────────── */
/* B-188, v3.14.359. `.hdr-btn` carried only metrics; the border, surface and
   hover were written once per BUTTON — `#searchtn`, `#project-btn`,
   `#file-btn` — so `#gaps-btn` (Progress), added later, inherited no appearance
   and rendered as a bare UA button in a header of three that did not.

   Same family as B-001 above, one step out: there the class was missing one
   declaration, here it was missing them because they lived somewhere else. The
   check is the rule, not the button list — a fifth header button must be
   covered without an edit here. */
console.log('\na shared control class carries its own look');
{
  const decls = cls => {
    const out = new Set();
    for (const [sels, body] of RULES) {
      if (!sels.split(',').some(x => new RegExp(`\\.${cls}(?![\\w-])$`).test(subject(x).trim()))) continue;
      for (const m of body.matchAll(/(^|;)\s*([a-z-]+)\s*:/g)) out.add(m[2]);
    }
    return out;
  };
  const d = decls('hdr-btn');
  /* `border-radius` is not a border. The first version of this check accepted it
     and a mutation that deleted the real border passed — the guard was reading
     the shorthand's PREFIX rather than the property. */
  const SKIP = new Set(['border-radius']);
  for (const prop of ['border', 'background', 'color'])
    check([...d].some(x => !SKIP.has(x) && (x === prop || x.startsWith(prop + '-'))),
          `.hdr-btn declares its own ${prop}`,
          `         without it a new header button gets the UA default, which is\n`
        + `         what B-188 was — and on WebKit an unstyled :active sticks dark`);

  /* And no id may re-declare it: a second writer is how the class came to be
     missing the look in the first place (PRACTICES §4). */
  const rogue = [];
  for (const [sels, body] of RULES) {
    if (!/(^|;)\s*(border|background)\s*:/.test(body)) continue;
    for (const sel of sels.split(',')) {
      const sub = subject(sel).trim();
      const m = sub.match(/^#([a-z0-9-]+)$/);
      if (m && new RegExp(`id="${m[1]}"[^>]*class="[^"]*hdr-btn`).test(html)) rogue.push(sub);
      if (m && new RegExp(`class="hdr-btn"[^>]*id="${m[1]}"`).test(html)) rogue.push(sub);
    }
  }
  check(rogue.length === 0,
        'no per-id rule re-declares a header button\'s look',
        rogue.map(r => `         ${r} sets border/background that .hdr-btn already owns`).join('\n'));
}

/* ── 6. A class the JS toggles must be a class the CSS knows ─────────────── */
/* B-188's other half, and the more general defect: `#gaps-btn` had no rule of
   ANY kind, so `classList.add('visible')` — one line below Search's, in two
   places — did nothing at all, and Progress sat in the header from launch
   offering a panel about a corpus that was not open. Nothing failed; the
   control simply could not be hidden. PRACTICES §7 one floor down. */
console.log('\nvisibility classes the JS adds must be styled');
{
  /* Asking about `#id.visible` alone was wrong on its first run: `#file-corpus-sep`
     is hidden and revealed through `.file-menu-sep`, and reporting it would have
     been a guard that made you edit the CSS to satisfy the guard. The question is
     about the ELEMENT, so it is asked of every selector that can reach it. */
  const ids = new Set();
  for (const m of html.matchAll(/getElementById\('([a-z0-9-]+)'\)\??\.classList\.add\('visible'\)/g))
    ids.add(m[1]);

  const classesOf = id => {
    const tag = new RegExp(`<[^>]*\\bid="${id}"[^>]*>`).exec(html);
    const cls = tag && /\bclass="([^"]*)"/.exec(tag[0]);
    return cls ? cls[1].trim().split(/\s+/) : [];
  };
  /* Does any rule reach this element, with or without `.visible`, and say what
     `display` it has? Both halves are needed: hidden by default, shown when the
     class is added. */
  const displayRules = (id, withVisible) => {
    const sels = ['#' + id, ...classesOf(id).map(c => '.' + c)];
    return RULES.some(([selList, body]) => {
      /* `display: none` for the default state, ANY display for the revealed one.
         Asking only for "a display" let `.hdr-btn { display: inline-flex }` stand
         in for the hiding rule, and a mutation that stopped hiding #gaps-btn
         passed — the guard was measuring that something set display, not that it
         set it to none. */
      const want = withVisible ? /(^|;)\s*display\s*:/ : /(^|;)\s*display\s*:\s*none/;
      if (!want.test(body)) return false;
      return selList.split(',').some(x => {
        const sub = subject(x).trim();
        const hasVis = /\.visible(?![\w-])/.test(sub);
        if (hasVis !== withVisible) return false;
        return sels.some(s => sub.startsWith(s) || sub.includes(s + '.') || sub === s);
      });
    });
  };

  check(ids.size > 0, `${ids.size} element(s) are revealed by adding .visible`);
  const never = [...ids].filter(id => !displayRules(id, false));
  const inert = [...ids].filter(id => !displayRules(id, true));
  check(never.length === 0,
        'each was hidden in the first place',
        never.map(id => `         #${id}: nothing gives it display:none, so it is on screen\n`
                      + `         from launch and the class that "reveals" it is a no-op`).join('\n'));
  check(inert.length === 0,
        'and each has a rule that shows it again',
        inert.map(id => `         #${id}: hidden, and no rule restores it — adding .visible\n`
                      + `         leaves it hidden, so the control can never appear`).join('\n'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
