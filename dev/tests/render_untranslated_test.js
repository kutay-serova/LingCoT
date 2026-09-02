#!/usr/bin/env node
/* =============================================================================
   render_untranslated_test.js, the section/paragraph renderers must survive an
   untranslated sentence
   Run:  node dev/tests/render_untranslated_test.js [path/to/LingCoT.html]
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-008 (2026-08-24).  `renderParaBatch` and `renderParagraph` threw whenever a
   sentence had no translation, because a local `const t = sentTrans(s)` shadowed
   the global t() locale function and the null branch called t() as a function.
   A newly added section is 100% untranslated, so Save appeared to do nothing.

   `dev/tests/locale_shadow_test.js` is the general guard against that class of bug.
   THIS file is the behavioural counterpart, and it exists because of a separate
   lesson from the same investigation: every guard in dev/ inspects source text,
   and NONE of them executes a renderer.  That is precisely why B-008 shipped, so this one actually calls the renderers and asserts on the HTML they emit.

   Extend it when a renderer gains a new "empty / missing data" branch, those
   are the branches nobody exercises by hand.

   Pass a path to run it against an archived copy (useful for confirming a guard
   really does fail on the pre-fix source).
   ============================================================================= */

const fs = require('fs');
const nodePath = require('path');
const path = process.argv[2] || nodePath.join(__dirname, '..', '..', 'source', 'LingCoT.html');
const src = fs.readFileSync(path, 'utf8');

function extract(name) {
  const i = src.indexOf(`\nfunction ${name}(`);
  if (i === -1) throw new Error('not found: ' + name);
  let depth = 0, started = false, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
}

// Stubs, only what the two renderers touch.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escAttr = esc;
const icon = n => `<svg data-i="${n}"></svg>`;
const t = (k, v) => v ? `[${k}:${JSON.stringify(v)}]` : `[${k}]`;   // the real locale fn
const sentTransEl = s => (s.translations && s.translations[0]) || null;
const sentTrans   = s => (sentTransEl(s) || {}).text || null;
/* L-037, v3.14.338: the paragraph card now asks whether the translation it is
   about to show was machine-made, so the stubs have to answer. */
const objProv   = o => (o && o.prov) || null;
const isDerived = pv => !!(pv && pv.derived === true);
const provDisplayName = pv => (pv && pv.annotator_id) || '';
const provTipForEl = el => {
  const pv = objProv(el);
  return pv ? ` data-prov-tip="${esc(provDisplayName(pv))}"` : '';
};
const sourceById = () => null;
const collectAnnotatorIds = () => [];
const renderAnnotatorsRollup = () => '';
const renderCommentsView = () => '';
const renderTransliterationsView = () => '';
const _flattenParagraph = () => [];
const provFooter = () => '';
const viewHeader = (a, l) => `<div ${a}>${l}</div>`;
const SECTION_PARA_BATCH = 30;

// A paragraph whose sentences are ALL untranslated, the crashing condition.
const para = { id: 'p1', sentences: [
  { id: 's1', text: 'Bir uçak geldi.',   translations: [] },
  { id: 's2', text: 'İki kuş uçtu.',     translations: [{ text: 'Two birds flew.' }] },
  { id: 's3', text: 'Hiç kimse yoktu.',  translations: [] },
]};
const sec  = { id: 'sec1', title: 'Section 1', paragraphs: [para] };
const S    = { sectIdx: 0, paraIdx: 0 };
const sections = () => [sec];
const doc = () => ({ metadata: { title: 'Test doc' } });

eval(extract('renderParaBatch'));
eval(extract('renderSection'));
eval(extract('renderParagraph'));

console.log('\nsection/paragraph renderers must survive an untranslated sentence\n');
let ok = 0, bad = 0;
for (const [name, fn] of [['renderParaBatch', () => renderParaBatch([para], 0, 0)],
                          ['renderSection',   () => renderSection()],
                          ['renderParagraph', () => renderParagraph()]]) {
  try {
    const html = fn();
    const hit  = html.includes('[status.no_translation]');
    const keptReal = html.includes('Two birds flew.');
    if (hit && keptReal) { console.log(`  ok   ${name} — rendered, untranslated placeholder + real translation both present`); ok++; }
    else { console.log(`  FAIL ${name} — rendered but wrong: placeholder=${hit} realTranslation=${keptReal}`); bad++; }
  } catch (e) {
    console.log(`  FAIL ${name} — THREW: ${e.message}`); bad++;
  }
}
console.log(`\n${ok} passed, ${bad} failed  (${nodePath.basename(path)})`);
process.exit(bad ? 1 : 0);
