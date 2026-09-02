#!/usr/bin/env node
/* =============================================================================
   locale_key_test.js, every locale key referenced in code must exist
   Run:  node dev/tests/locale_key_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   `t()` returns the KEY ITSELF when a key is missing:

       function t(key, vars) { let s = _LOCALE[key] ?? key; .. }

   That is a good failure mode for the user (they see `btn.editor.save` rather
   than a blank button) and a terrible one for us, nothing throws, nothing logs,
   and a typo'd or renamed key ships silently. The i18n migration moved ~493
   strings across many commits, so a broken reference is exactly the kind of
   residue that survives such a pass unnoticed. B-008 was itself introduced by
   that migration.

   TWO REFERENCE MECHANISMS, both must be counted
   -----------------------------------------------
   Keys reach the UI by two different routes, and an audit that knows about only
   one produces garbage. Rendered markup calls `t('key')`; the static HTML
   shell (header, menus, modals) carries `data-i18n`, `data-i18n-placeholder`,
   `data-i18n-title` and `data-i18n-aria` attributes, applied once at boot by
   the sweep near LingCoT.html:7090. Counting only `t()` reports every static
   key as an orphan, 122 false alarms on first run.

   CHECKS
   ------
   1. Every literal `t('key')` and every `data-i18n*` attribute resolves in
      en.json.
   1b. The static HTML shell contains no `${…}`, it is never interpolated, so a
      template expression there renders as visible source text (B-012).
   2. Every key referenced by a resource resolver, selRelDesc / selTplLabel /
      posDesc, added in D27 P3, resolves for the bundled resource entries.
      (A miss here is not fatal at runtime, since tRes() falls back to the JSON's
      own text, so this is reported as a WARNING, not a failure. Corpus-specific
      entries are expected to have no key.)
   3. Orphan keys: en.json entries no code path references. Reported for
      information, some are legitimately reached dynamically.

   LIMITS, deliberately a lint, not a proof:
   · Keys built at runtime (`'label.sel.status.' + v`) can't be read literally.
     Known dynamic prefixes are listed in DYNAMIC_PREFIXES and excluded from the
     orphan report so it stays signal.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const LOCALE = path.join(SRC, 'resources', 'locale', 'en.json');
const FILES  = ['LingCoT.html',
  ...fs.readdirSync(path.join(SRC, 'modules')).map(f => path.join('modules', f))];

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const locale   = JSON.parse(fs.readFileSync(LOCALE, 'utf8'));
const known    = new Set(Object.keys(locale));
const src_html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');

/* Key families assembled at runtime, the literal never appears in source. */
const DYNAMIC_PREFIXES = [
  'label.sel.status.',   // 'label.sel.status.' + v
  'sel.rel.',            // selRelDesc(tag)
  'sel.tpl.',            // selTplLabel(tpl)
  'pos.',                // posDesc(tag)
  'dep.',                // depRelNameOf / depRelDescOf
  'gloss.',              // leipzigMeaning(abbr)
  'type.',               // typeDesc(tag)
  /* D34's panel, v3.14.308. `gap.name.<level|kind>` is built from a level or a
     record kind and `gap.field.<key>` from a field key, both read out of the
     field table at render time — so neither can be seen literally here.
     `session_panel_test.js` is where they are actually checked: it loads en.json
     into the running app and fails if a counted field has no name. */
  'gap.name.',           // _gapName(kind, n)
  'gap.field.',          // _gapFieldName(key)
];

/* Keys that exist for reasons other than being read by code. */
const NON_KEYS = new Set(['_meta']);

const slug = s => String(s || '').trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/* ── 1. Every literal t('…') and data-i18n* attribute resolves ────────────── */
console.log('\nevery referenced locale key must exist in en.json\n');
{
  const referenced = new Set();
  const missing = [];
  const at = (text, i) => text.slice(0, i).split('\n').length;

  for (const f of FILES) {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');

    // a) t('literal'), but NOT t('prefix.' + v), where the literal is only the
    //    first half of a runtime-built key. Detect by looking past the quote.
    for (const m of text.matchAll(/\bt\(\s*'([^']+)'(\s*\+)?/g)) {
      const key = m[1];
      if (m[2]) continue;                      // concatenation → dynamic key
      if (/[${}]/.test(key)) continue;         // interpolated → dynamic key
      referenced.add(key);
      if (!known.has(key)) missing.push(`         ${f}:${at(text, m.index)}  t('${key}')`);
    }

    // b) data-i18n and every -suffix variant (-placeholder, -title, -aria,
    //    -html). Matching the suffix openly rather than listing them means a
    //    new variant is covered the day it is introduced.
    for (const m of text.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) {
      const key = m[1];
      if (/[${}]/.test(key)) continue;
      referenced.add(key);
      if (!known.has(key)) missing.push(`         ${f}:${at(text, m.index)}  ${m[0]}`);
    }
  }

  check(missing.length === 0,
        `${referenced.size} distinct keys referenced (t() + data-i18n), all resolve`,
        missing.join('\n'));
  global.__referenced = referenced;
}

/* ── 2. Bundled resource entries should have keys (warning only) ──────────── */
console.log('\nbundled resource entries should have locale keys');
{
  const readJson = p => JSON.parse(fs.readFileSync(path.join(SRC, 'resources', p), 'utf8'));
  const expected = [];
  for (const r of readJson('selection_relations.json'))
    expected.push([`sel.rel.${slug(r.tag)}.desc`, `selection_relations: ${r.tag}`]);
  for (const tp of readJson('selection_templates.json'))
    expected.push([`sel.tpl.${slug(tp.pos)}.${slug(tp.label)}`, `selection_templates: ${tp.pos}/${tp.label}`]);
  for (const p of readJson('pos_tags.json'))
    expected.push([`pos.${slug(p.tag)}.desc`, `pos_tags: ${p.tag}`]);
  // D27 P4, the remaining three resource files.
  for (const r of readJson('dep_relations.json')) {
    if (r.name)        expected.push([`dep.${slug(r.tag)}.name`, `dep_relations: ${r.tag} (name)`]);
    if (r.description) expected.push([`dep.${slug(r.tag)}.desc`, `dep_relations: ${r.tag} (desc)`]);
  }
  for (const g of readJson('leipzig_glosses.json'))
    if (g.meaning) expected.push([`gloss.${slug(g.abbr)}.meaning`, `leipzig_glosses: ${g.abbr}`]);
  for (const tg of readJson('type_choices.json'))
    if (tg.description) expected.push([`type.${slug(tg.tag)}.desc`, `type_choices: ${tg.tag}`]);

  const gaps = expected.filter(([k]) => !known.has(k));
  check(gaps.length === 0,
        `${expected.length} bundled resource entries all have locale keys`,
        gaps.map(([k, who]) => `         ${who} → ${k} (falls back to JSON text)`).join('\n'));

  /* Slug collisions would silently merge two entries onto one string. */
  const bySlug = {};
  for (const [k, who] of expected) (bySlug[k] ||= []).push(who);
  const clashes = Object.entries(bySlug).filter(([, v]) => v.length > 1);
  check(clashes.length === 0,
        `${expected.length} resource slugs are unique`,
        clashes.map(([k, v]) => `         ${k} ← ${v.join('  AND  ')}`).join('\n'));
}

/* ── 3. No template interpolation in the static HTML shell ────────────────────
   B-012 (2026-08-24). A label in the Add Source modal was written as

       <label class="ann-modal-label" for="sm-type">${t('label.editor.type')}</label>

   in the STATIC HTML, outside the <script> block, so nothing ever interpolates
   it. The browser rendered the source text verbatim, and `text-transform:
   uppercase` on the label class turned it into `${T('LABEL.EDITOR.TYPE')}` on
   screen. Every other label in that modal correctly uses `data-i18n`.

   Check 1 could not catch this: the key it references is real and resolves, so
   the reference looks healthy. The defect is the mechanism, not the key.

   This check is exact rather than heuristic, because the static shell is
   precisely "everything outside the inline <script>…</script>". A `${` there is
   always a bug, static HTML has no interpolation. */
console.log('\nstatic HTML must not contain template interpolation');
{
  const lines = src_html.split('\n');
  const open  = lines.findIndex(l => l.trim() === '<script>');
  const close = lines.findIndex(l => l.trim() === '</script>');
  const bad = [];
  const scan = (from, to) => {
    for (let i = from; i < to; i++)
      if (lines[i].includes('${')) bad.push(`         LingCoT.html:${i + 1}  ${lines[i].trim().slice(0, 120)}`);
  };
  if (open === -1 || close === -1) {
    check(false, 'inline <script> block located', '         could not find the script boundaries');
  } else {
    scan(0, open);
    scan(close + 1, lines.length);
    check(bad.length === 0,
          `static HTML (lines 1-${open} and ${close + 2}-${lines.length}) has no \${…} interpolation`,
          bad.join('\n') + '\n         fix: use data-i18n="key" — static HTML is never interpolated.');
  }
}

/* ── 3b. The resolvers must resolve in the right ORDER ────────────────────────
   Checks 1-3 prove keys EXIST. They say nothing about whether the code reads
   them, or what happens to a tag that has no key, which is the whole reason
   tRes() exists rather than t(). t() returns the key itself on a miss, so a
   corpus-specific relation would print `sel.rel.my_tag.desc` at the user.

   Contract: locale key → the JSON's own text → ''. */
console.log('\nresource resolvers: locale first, then the JSON, then empty');
{
  const grab = name => {
    const i = src_html.indexOf(`function ${name}(`);
    if (i === -1) return '';
    let depth = 0;
    for (let j = src_html.indexOf('{', i); j < src_html.length; j++) {
      if (src_html[j] === '{') depth++;
      else if (src_html[j] === '}' && --depth === 0) return src_html.slice(i, j + 1);
    }
    return '';
  };

  const names = ['tRes', 'resSlug', 'selRelDesc', 'posDesc', 'depRelNameOf', 'leipzigMeaning', 'typeDesc'];
  const missing = names.filter(n => !grab(n));
  check(missing.length === 0, `all ${names.length} resolvers exist`,
        missing.map(n => `         ${n}() not found`).join('\n'));

  if (!missing.length) {
    const fn = new Function(
      '_LOCALE', 'POS_DESCRIPTIONS', 'TYPE_DESCRIPTIONS',
      names.map(grab).join('\n') + `\nreturn {${names.join(',')}};`
    );
    const LOC = {
      'sel.rel.case_marking.desc': 'LOCALE-TEXT',
      'dep.nsubj.name':            'LOCALE-NAME',
      'gloss.abl.meaning':         'LOCALE-MEANING',
      'type.bound_morpheme.desc':  'LOCALE-TYPE',
      'pos.noun.desc':             'LOCALE-POS',
    };
    const R = fn(LOC, { NOUN: 'json-pos' }, { 'bound.morpheme': 'json-type' });

    check(R.resSlug('case marking') === 'case_marking',
          'resSlug turns a spaced tag into a key segment');
    check(R.resSlug('bound.morpheme') === 'bound_morpheme',
          'and a dotted one too');

    check(R.selRelDesc('case marking', 'json-fallback') === 'LOCALE-TEXT',
          'a translated relation uses the locale');
    check(R.selRelDesc('my custom tag', 'json-fallback') === 'json-fallback',
          'an UNtranslated relation keeps the JSON text — never the raw key');
    check(R.selRelDesc('my custom tag', undefined) === '',
          'and with no JSON text either, resolves to empty rather than the key');

    check(R.depRelNameOf('nsubj', 'json-name') === 'LOCALE-NAME',
          'dependency names resolve');
    check(R.leipzigMeaning('ABL', 'json-meaning') === 'LOCALE-MEANING',
          'Leipzig meanings resolve, case-insensitively via the slug');
    check(R.typeDesc('bound.morpheme') === 'LOCALE-TYPE',
          'entry-type descriptions resolve');
    check(R.typeDesc('unknown.type') === '',
          'and an unknown type resolves to empty');
    check(R.posDesc('NOUN') === 'LOCALE-POS', 'PoS descriptions resolve');
  }
}

/* ── 4. Orphan keys (informational) ───────────────────────────────────────────
   Check 1 can only see keys in call shapes it recognises. Plenty are reached
   another way, `t(online ? 'a' : 'b')`, a key held in a variable, a key built
   from a ternary. Testing "does this key's literal text appear ANYWHERE in the
   source" is far more robust for the orphan question, and its failure mode is
   the harmless direction: a key mentioned in a comment counts as used. */
console.log('\norphan keys in en.json (informational — not a failure)');
{
  const corpus = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  const orphans = [...known].filter(k =>
    !corpus.includes(`'${k}'`) && !corpus.includes(`"${k}"`) &&
    !NON_KEYS.has(k) && !DYNAMIC_PREFIXES.some(p => k.startsWith(p)));
  if (orphans.length) {
    console.log(`  note ${orphans.length} keys defined but never mentioned in source:`);
    for (const k of orphans) console.log(`         ${k}`);
  } else {
    console.log('  ok   no orphan keys');
  }
}


/* ── the other direction: text that reaches the UI without a key at all ─────
   v3.14.271, D51 stage 6. Everything above asks whether a REFERENCED key
   exists. It cannot see the opposite failure, which is a string that was never
   keyed: `+ dict` and `dict →` sat in the word view in English for the life of
   the feature, and neither this guard, `locale_shadow_test` nor
   `render_untranslated_test` could see them — one checks references, one checks
   shadowing, one executes empty-data branches.

   The scan found eighteen when it was first run. Seventeen were keyed at
   v3.14.271; what is left is named below, with the reason.

   Scoped to the RENDERERS. The static shell carries its English inline and
   swaps it through `data-i18n` at boot, which is a different mechanism and has
   its own guard above; a renderer has no such mechanism, so a literal there is
   simply untranslated. */
{
  const { fnSrc, read, decomment } = require('./_source.js');
  const code = decomment(read('LingCoT.html'));

  /* Proper nouns. `linguex` and `gb4e` are LaTeX package names — the thing the
     block produces is called that in every language, and translating it would
     make the copy button paste something that does not compile. */
  const KEEP = new Set(['linguex', 'gb4e']);

  const renderers = [...new Set([...code.matchAll(/function ((?:render|open|pk)\w+)\s*\(/g)]
    .map(m => m[1]))];
  check(renderers.length > 20, `${renderers.length} renderers to scan`);

  const found = [];
  for (const name of renderers) {
    let body;
    try { body = decomment(fnSrc('LingCoT.html', name)); } catch { continue; }
    for (const m of body.matchAll(/>([^<>\n\\`$]{2,60})</g)) {
      const txt = m[1].trim();
      if (!/[A-Za-z]{2}/.test(txt)) continue;          // punctuation, digits, marks
      if (/^[\s\d.,:;·—–\-\/()%+]*$/.test(txt)) continue;
      /* A `>` and a `<` can also be two ends of one JS expression spanning
         lines inside a template literal. Those carry code punctuation and no
         sentence does, which is how they are told apart. */
      if (/[}{)('"]|=>|\|\|/.test(txt)) continue;
      if (KEEP.has(txt)) continue;
      found.push(`${name}: ${txt}`);
    }
  }
  check(found.length === 0,
        `no renderer emits unkeyed English (${renderers.length} scanned, ${KEEP.size} named exceptions)`,
        found.map(f => `         ${f}`).join('\n')
        + '\n         a literal here ships in English in every locale, and nothing else looks');

  /* The exceptions have to be real, or the allowlist becomes a place to hide
     things. Both must still be in the source; one that has gone is one that
     stopped needing an excuse. */
  for (const k of KEEP)
    check(new RegExp(`>${k}<`).test(code), `the named exception "${k}" is still there`,
          '         an allowlist entry with nothing behind it is a licence, not a decision');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
