#!/usr/bin/env node
/* =============================================================================
   i18n_literal_test.js, user-visible text that does not come from the locale
   Run:  node dev/tests/i18n_literal_test.js [--list]
   =============================================================================
   Scans the interface for English that a translation cannot reach:
     · the static shell: text and title/placeholder/aria-label/alt with no
       data-i18n* marker on the element or an ancestor, and data-i18n elements
       holding child markup (textContent drops it; use data-i18n-html)
     · the inline script and source/modules/*.js: markup in template literals,
       strings passed to alert/confirm or assigned to textContent/title/...,
       label-like object values, label maps, t('key') || 'fallback' where the
       key is missing from en.json
     · LingCoT.pyw: window titles and strings returned to the page
   Every hit must be in i18n_allow.json, either as an exemption (not interface
   text) or as pending under its audit id. A new literal fails, and so does an
   entry that no longer matches anything, so the pending list only shrinks.
   Source: dev/audits/I18N_AUDIT_2026-09-24.md. --list prints every hit.

   Reach: object maps are caught only when every value is Capitalized words, and
   helper arguments only when Capitalized; a string built elsewhere and passed in
   (R6) is not caught. The pseudo-locale sweep in tb-strings found what this missed.
   ============================================================================= */

const fs = require('fs'), path = require('path');
const acorn = require('./vendor/acorn.js');
const walk = require('./vendor/walk.js');
const { SRC, read } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const EN = JSON.parse(read('resources/locale/en.json'));
const ALLOW = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n_allow.json'), 'utf8'));
const html = read('LingCoT.html');

const hits = [];
const norm = s => s.replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const add = (file, line, kind, text) => hits.push({ file, line, kind, text: norm(text) });

// Human text: a run of 2+ letters, and not a key, class list, URL or tag constant.
const LETTERS = /\p{L}{2,}/u;
const looksHuman = s => {
  const x = norm(s);
  if (!LETTERS.test(x)) return false;
  if (/^[a-z0-9_.:-]+$/.test(x)) return false;
  if (/^[\w-]+(\s+[\w-]+)*$/.test(x) && x === x.toLowerCase() && /-/.test(x)) return false;
  if (/^(https?:|#|\.|\/|mailto:)/.test(x)) return false;
  if (/^[A-Z_]+$/.test(x)) return false;
  return true;
};

// ── 1 · static shell ───────────────────────────────────────────────────────
// Small tokenizer: the shell is hand-written, well-formed HTML.
{
  const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
  const SKIP = new Set(['script', 'style', 'svg', 'symbol']);
  const ATTRS = { title: 'data-i18n-title', placeholder: 'data-i18n-placeholder', 'aria-label': 'data-i18n-aria', alt: null };
  const lineAt = i => html.slice(0, i).split('\n').length;
  const stack = [];                      // { name, covered, i18n, line }
  const covered = () => stack.some(e => e.covered);
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let last = 0, m;
  const text = (s, at) => { if (!covered() && looksHuman(s)) add('LingCoT.html', lineAt(at), 'shell text', s); };
  while ((m = re.exec(html))) {
    if (m.index > last) text(html.slice(last, m.index), last);
    last = re.lastIndex;
    if (m[1]) {                          // closing tag
      const name = m[1].toLowerCase();
      const i = stack.map(e => e.name).lastIndexOf(name);
      if (i >= 0) stack.length = i;
      continue;
    }
    if (!m[2]) continue;                 // comment or doctype
    const name = m[2].toLowerCase();
    if (SKIP.has(name)) {                // jump past the element's body
      const end = html.toLowerCase().indexOf(`</${name}`, re.lastIndex);
      if (end > 0) { re.lastIndex = html.indexOf('>', end) + 1; last = re.lastIndex; }
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const line = lineAt(m.index);
    const parent = stack[stack.length - 1];
    if (parent?.i18n && !parent.flagged) {
      add('LingCoT.html', parent.line, 'markup inside data-i18n', parent.key);
      parent.flagged = true;
    }
    for (const [k, marker] of Object.entries(ATTRS))
      if (attrs[k] && looksHuman(attrs[k]) && !(marker && marker in attrs))
        add('LingCoT.html', line, `shell ${k}`, attrs[k]);
    if (VOID.has(name) || m[4]) continue;
    stack.push({ name, line, i18n: 'data-i18n' in attrs, key: attrs['data-i18n'],
                 covered: 'data-i18n' in attrs || 'data-i18n-html' in attrs });
  }
}

// ── 2 · JavaScript ─────────────────────────────────────────────────────────
const scripts = [];
{
  const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) scripts.push({ file: 'LingCoT.html', code: m[1], offset: html.slice(0, m.index).split('\n').length - 1 });
  for (const f of fs.readdirSync(path.join(SRC, 'modules')).sort())
    if (f.endsWith('.js')) scripts.push({ file: 'modules/' + f, code: read('modules/' + f), offset: 0 });
}
// Calls whose string arguments are selectors, keys, patterns or log text.
const SKIP_CALLS = /^(logEvent|querySelector|querySelectorAll|getElementById|closest|matches|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|hasAttribute|RegExp|require|fetch|postMessage|insertAdjacentHTML|toggle|add|remove|contains|split|join|replace|startsWith|endsWith|includes|indexOf|test|match|padStart|normalize|t|tRes|esc|escAttr|dispatchEvent|Event|createElement|log|warn|error|info|debug)$/;
const UI_CALLS = /^(alert|confirm|prompt|showToast|toast|setStatus|flash|notify|showError)$/;
const UI_PROPS = /^(textContent|innerText|title|placeholder|ariaLabel)$/;
const TABLE_KEYS = /^(label|title|hint|desc|description|name|text|msg|message|verdict|caption|tooltip|placeholder|help)$/;
// Inline fallback for resources/dep_relations.json; the dep.* keys translate it.
const SKIP_DECLS = new Set(['DEP_RELATIONS']);

const calleeName = c => c.type === 'Identifier' ? c.name
  : c.type === 'MemberExpression' ? (c.property.name || c.property.value || '') : '';

for (const s of scripts) {
  let ast;
  try { ast = acorn.parse(s.code, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true }); }
  catch (e) { check(false, `${s.file} parses`, `         ${e.message}`); continue; }
  const line = n => n.loc.start.line + s.offset;

  // A label map: every string value Capitalized words ({ human: 'Human Source', ... }).
  // Marked first: fullAncestor visits children before their parent.
  walk.simple(ast, { ObjectExpression(node) {
    const vals = node.properties.filter(p => p.type === 'Property' && p.value.type === 'Literal' && typeof p.value.value === 'string');
    if (vals.length >= 2 && vals.length === node.properties.length &&
        vals.every(p => /^\p{Lu}\p{L}*( \p{L}+)*$/u.test(p.value.value)) && vals.some(p => / /.test(p.value.value)))
      for (const p of vals) p.value._labelMap = true;
  } });

  walk.fullAncestor(ast, (node, _st, anc) => {
    const parent = anc[anc.length - 2];
    if (anc.some(a => a.type === 'VariableDeclarator' && SKIP_DECLS.has(a.id.name))) return;
    if (anc.some((a, i) => a.type === 'CallExpression' && i < anc.length - 1 && a.arguments.includes(anc[i + 1]) &&
                           SKIP_CALLS.test(calleeName(a.callee)))) return;
    if (anc.some(a => a.type === 'TaggedTemplateExpression')) return;

    if (node.type === 'TemplateLiteral') {
      const joined = node.quasis.map(q => q.value.cooked ?? q.value.raw).join('\u0000');
      if (!/</.test(joined)) {
        if ((parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && UI_PROPS.test(parent.left.property.name || '')) ||
            (parent?.type === 'CallExpression' && UI_CALLS.test(calleeName(parent.callee))))
          if (node.quasis.some(q => looksHuman(q.value.cooked || '')))
            add(s.file, line(node), 'template to UI', node.quasis.map(q => q.value.cooked).join('${…}'));
        return;
      }
      // HTML scan over the whole template, ${…} held as \0, so a tag spanning an
      // expression is still a tag.
      let st = 'text', buf = '', attr = '', q = '';
      const flush = () => { for (const p of buf.split('\u0000')) if (looksHuman(p) && !/[{};]|=>/.test(p)) add(s.file, line(node), 'markup text', p); buf = ''; };
      for (let i = 0; i < joined.length; i++) {
        const ch = joined[i];
        if (st === 'text') {
          if (ch === '<' && /[a-zA-Z\/!]/.test(joined[i + 1] || '')) { flush(); st = 'tag'; attr = ''; }
          else buf += ch;
        } else if (st === 'tag') {
          if (ch === '>') st = 'text';
          else if (ch === '"' || ch === "'") { q = ch; st = 'val'; buf = ''; }
          else if (/\s/.test(ch)) attr = '';
          else if (ch !== '=') attr += ch;
        } else if (ch === q) {
          const m = /(title|placeholder|aria-label|alt)$/.exec(attr);
          if (m) for (const p of buf.split('\u0000')) if (looksHuman(p)) add(s.file, line(node), `markup ${m[1]}`, p);
          buf = ''; attr = ''; st = 'tag';
        } else buf += ch;
      }
      if (st === 'text') flush();
      return;
    }

    if (node.type !== 'Literal' || typeof node.value !== 'string') return;
    const v = node.value;
    if (!looksHuman(v)) return;
    if (node._labelMap) return add(s.file, line(node), 'label map', v);
    if (parent?.type === 'LogicalExpression' && parent.right === node &&
        parent.left.type === 'CallExpression' && /^(t|tRes)$/.test(calleeName(parent.left.callee))) {
      const k = parent.left.arguments[0];
      if (k?.type === 'Literal' && !(k.value in EN)) add(s.file, line(node), `fallback, ${k.value} missing`, v);
      return;
    }
    if (parent?.type === 'CallExpression' && UI_CALLS.test(calleeName(parent.callee)))
      return add(s.file, line(node), 'UI call', v);
    if (parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && UI_PROPS.test(parent.left.property.name || ''))
      return add(s.file, line(node), 'UI property', v);
    if (/<\w[^>]*>[^<]*\p{L}{2,}/u.test(v))
      return add(s.file, line(node), 'string with markup', v);
    if (parent?.type === 'Property' && parent.value === node && TABLE_KEYS.test(parent.key.name || parent.key.value || ''))
      return add(s.file, line(node), 'label-like value', v);
    // A label handed to a helper: participantTh(state, 'name', 'Name'), rows.push(['Role', v]).
    const LABEL = /^\p{Lu}\p{Ll}+( \p{L}+){0,3}$/u;
    const call = parent?.type === 'CallExpression' ? parent
               : (parent?.type === 'ArrayExpression' && anc[anc.length - 3]?.type === 'CallExpression') ? anc[anc.length - 3] : null;
    if (call && LABEL.test(v) && !UI_CALLS.test(calleeName(call.callee)))
      return add(s.file, line(node), 'label argument', v);
    if (parent?.type === 'BinaryExpression' && parent.operator === '+' && / /.test(v) && /\p{Lu}|\p{L}{3,} \p{L}{3,}/u.test(v))
      return add(s.file, line(node), 'concatenated', v);
  });
}

// ── 3 · Python host ────────────────────────────────────────────────────────
// Status codes are mapped by the page; only prose and window titles count.
read('LingCoT.pyw').split('\n').forEach((l, i) => {
  if (/^\s*#/.test(l)) return;
  let m;
  if ((m = /['"](error|message|msg|detail)['"]\s*:\s*f?['"]([^'"]*\p{L}{2,}[^'"]*)['"]/u.exec(l))) add('LingCoT.pyw', i + 1, `returned ${m[1]}`, m[2]);
  else if ((m = /\btitle\s*=\s*f?['"]([^'"]*\p{L}{2,}[^'"]*)['"]/u.exec(l))) add('LingCoT.pyw', i + 1, 'dialog title', m[1]);
  else if ((m = /create_window\(\s*f?['"]([^'"]+)['"]/.exec(l))) add('LingCoT.pyw', i + 1, 'window title', m[1]);
});

// ── 4 · against the allowlist ──────────────────────────────────────────────
if (process.argv.includes('--list'))
  for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.kind}  | ${h.text}`);

const keyOf = e => `${e.file}\u0000${norm(e.text)}`;
const entries = [...ALLOW.exempt.map(e => ({ ...e, bucket: 'exempt' })), ...ALLOW.pending.map(e => ({ ...e, bucket: 'pending' }))];
const allowed = new Map(entries.map(e => [keyOf(e), e]));
const seen = new Set(hits.map(keyOf));

console.log(`\n${hits.length} literal(s) found: ${[...new Set(hits.map(keyOf))].length} distinct\n`);
const fresh = hits.filter(h => !allowed.has(keyOf(h)));
check(!fresh.length, 'every literal is exempt or pending',
      fresh.map(h => `         ${h.file}:${h.line}  ${h.kind}  | ${h.text}`).join('\n')
      + '\n         put it in en.json and call t(); or, if it is not interface text, add it to\n'
      + '         i18n_allow.json "exempt" with the reason');
const stale = entries.filter(e => !seen.has(keyOf(e)));
check(!stale.length, 'every allowlist entry still matches something',
      stale.map(e => `         ${e.bucket}: ${e.file} | ${e.text}`).join('\n')
      + '\n         remove it: the literal is gone or was localized');
check(entries.length === allowed.size, 'no allowlist entry is listed twice');

const byId = {};
for (const e of ALLOW.pending) byId[e.id] = (byId[e.id] || 0) + 1;
console.log(`\n  pending, by audit id: ${Object.entries(byId).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
