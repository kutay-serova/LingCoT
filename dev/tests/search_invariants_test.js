#!/usr/bin/env node
/**
 * search_invariants_test.js — properties the engine must have, over harvested queries
 * =============================================================================
 * WHAT THIS REPLACED, AND WHY IT IS NOT THE SAME GUARD. Until v3.14.388 this file
 * was `search_parity_test.js`, and it proved the engine reproduced a previous one
 * across a Level x Field x Pattern x Case matrix. Its own header called it "the F7
 * gate before retiring Search-A". That gate was passed at v3.14.38 and the old
 * engine's view went with it — but three of its scan runners stayed alive for six
 * years of versions BECAUSE THIS GUARD CALLED THEM, which is a reader whose only
 * producer is its own test. D58 §3 asks of every such reader: who writes this
 * today? Nobody did.
 *
 * So the second engine went (v3.14.388) and this guard lost the thing it compared
 * against. **Parity with nothing is not a property.** What survives is the part
 * that was always doing the work: the harvest — every form, gloss,
 * transliteration and translation word taken from the corpora themselves, so no
 * hand-labelled ground truth is needed — and the two-corpus sweep.
 *
 * WHAT IT ASSERTS NOW. Properties the engine must have on its own, each of which
 * relates two INDEPENDENT paths through it, so a break in one shows as a
 * disagreement rather than needing a golden:
 *
 *   1. a harvested form finds itself                 (the harvest is real data)
 *   2. a wildcard never loses an exact match          (glob widening)
 *   3. case-insensitive never loses a case-sensitive match
 *   4. an anchored regex equals the exact glob        (two compilers, one answer)
 *   5. a word-level hit's sentence is also a sentence-level hit  (two scan loops)
 *   6. every matched word id is really in the sentence the hit names
 *
 * 2 to 5 are the ones with teeth: each compares two code paths that were written
 * separately and can disagree. Golden cases for specific values live in
 * `search_matcher_test.js`; this is the sweep that runs them over everything the
 * corpora contain.
 *
 * Run:  node dev/tests/search_invariants_test.js   (exit 0 = all pass)
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { requireCorpusDir, corpusFilesIn, loadCorpus, requireCompanion, loadCompanion } = require('./_fixture.js');

const ROOT      = path.resolve(__dirname, '..', '..');
const HTML_FILE = path.join(ROOT, 'source', 'LingCoT.html');
const SEARCH_JS = path.join(ROOT, 'source', 'modules', 'search.js');
const CORPORA = Object.fromEntries(
  corpusFilesIn(requireCorpusDir('search invariants'))
    .map(p => [path.basename(p).replace(/_corpus\.jsonl$/, ''), p]));

// ── DOM / window stubs (search.js touches these only inside fn bodies) ────────
const _noop = () => {};
const _elem = new Proxy({}, { get: () => _noop, set: () => true });
global.document = { getElementById: () => _elem, querySelector: () => _elem,
                    querySelectorAll: () => [], createElement: () => _elem, addEventListener: _noop };
global.window = { addEventListener: _noop };
global.navigator = { onLine: true, language: 'en' };
global.render = _noop; global.logEvent = _noop; global.go = _noop;
global.setTimeout = () => 0; global.clearTimeout = _noop; global.alert = _noop; global.confirm = () => false;
global.esc = s => String(s == null ? '' : s); global.escAttr = global.esc;
global.t = k => k;
global._dataGen = 0;
global.mutate = () => { global._dataGen++; };
global.S = { docs: [], dictionary: [], lemmas: [], dictByLemmaId: new Map(),
             translitLabels: new Set(), posValues: new Set(), morphTypes: new Set(), sentById: new Map() };

function sliceFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('sliceFn: cannot find ' + name);
  let p = src.indexOf('(', start), pd = 0, q = p;
  for (; q < src.length; q++) { if (src[q] === '(') pd++; else if (src[q] === ')') { pd--; if (!pd) { q++; break; } } }
  let i = src.indexOf('{', q), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(start, i);
}
const hoist = s => s.replace(/^let /gm, 'var ').replace(/^const /gm, 'var ');
const appJs = fs.readFileSync(HTML_FILE, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const N = require(path.join(ROOT, 'source', 'modules', 'normalize.js'));
global.setFoldContext = N.setFoldContext; global.dictKey = N.dictKey;
vm.runInThisContext(['wordGloss', 'wordTranslit', 'normForm'].map(n => sliceFn(appJs, n)).join('\n'));
vm.runInThisContext(hoist(fs.readFileSync(SEARCH_JS, 'utf8')), { filename: 'search.js' });

// ── corpus swap ──────────────────────────────────────────────────────────────
function eachSent(docs, fn) {
  for (const d of docs) for (const sec of (d.sections || []))
    for (const p of (sec.paragraphs || [])) for (const st of (p.sentences || [])) fn(st);
}
function setCorpus(file) {
  const docs = loadCorpus(file).items;
  S.docs = docs; S.dictionary = []; S.lemmas = []; S.dictByLemmaId = new Map();
  S.translitLabels = new Set();
  const dict = loadCompanion(requireCompanion(file, 'dictionary')).items;
  for (const r of dict) (r && r.record_type === 'lemma' ? S.lemmas : S.dictionary).push(r);
  for (const e of S.dictionary) {
    if (!e || !e.lemma_id) continue;
    if (!S.dictByLemmaId.has(e.lemma_id)) S.dictByLemmaId.set(e.lemma_id, []);
    S.dictByLemmaId.get(e.lemma_id).push(e);
  }
  eachSent(docs, st => { for (const w of (st.words || [])) {
    for (const t of (w.transliterations || [])) if (t.label) S.translitLabels.add(t.label);
    for (const m of (w.morphemes || [])) for (const t of (m.transliterations || [])) if (t.label) S.translitLabels.add(t.label);
  }});
  /* The app binds the fold to the open corpus; a sweep that skips it tests a
     different fold from the one users get (B-120). */
  const lang = String(((docs[0] || {}).metadata || {}).language || '').trim();
  if (lang) setFoldContext(lang === 'tur' ? 'tr' : lang === 'zho' ? 'zh' : lang, '');
  mutate();                       // bust the gen-keyed substrate caches
  return docs;
}

// ── harvest: every probe comes from the corpus itself ────────────────────────
const noWs = s => s && !/\s/.test(s);
/* A probe that normalises to nothing (a bare comma) would make the level
   comparison in §5 compare a token against a string it was stripped out of. */
const usable = s => noWs(s) && normPunctForSearch(s) === s && s.length > 1;
const uniqCap = (set, n) => [...set].filter(usable).sort().slice(0, n);
function harvest(docs) {
  const forms = new Set(), glosses = new Set(), translit = new Set(), transWords = new Set();
  eachSent(docs, st => {
    for (const tr of (st.translations || [])) for (const w of String(tr.text || '').split(/\s+/))
      if (w.length > 2) transWords.add(w);
    for (const w of (st.words || [])) {
      forms.add(w.form);
      for (const t of (w.transliterations || [])) if (t.text)
        for (const tok of String(t.text).split(/[-\s]/)) translit.add(tok);
      for (const m of (w.morphemes || [])) {
        if (m.gloss) glosses.add(m.gloss);
        for (const t of (m.transliterations || [])) if (t.text)
          for (const tok of String(t.text).split(/[-\s]/)) translit.add(tok);
      }
    }
  });
  return { forms: uniqCap(forms, 12), glosses: uniqCap(glosses, 12),
           translit: uniqCap(translit, 8), transWords: uniqCap(transWords, 10) };
}
const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── reporting: one line per corpus, as the scanning guards do ────────────────
let pass = 0, fail = 0, checked = 0, nonEmpty = 0;
const failures = [];
const perCorpus = new Map();
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
function assertProp(corpus, label, fn) {
  checked++;
  const rec = perCorpus.get(corpus) || { ran: 0, failed: 0 };
  rec.ran++;
  try { fn(); } catch (e) { rec.failed++; failures.push(`${corpus} | ${label}: ${e.message}`); }
  perCorpus.set(corpus, rec);
}
const sents = r => { const s = new Set(); for (const h of (r.hits || [])) for (const id of h.sentIds) s.add(id); return s; };
const subset = (a, b) => [...a].every(x => b.has(x));
const eqSet  = (a, b) => a.size === b.size && subset(a, b);

// ════════════════════════════════════════════════════════════════════════════
function sweep(name, file) {
  const docs = setCorpus(file);
  const P = harvest(docs);
  const byId = new Map();
  eachSent(docs, st => byId.set(st.id, st));

  /* 1 · the harvest is real data. A form taken out of the corpus must find at
     least the sentence it came from; if this fails everything below is
     comparing empty against empty, which two of anything do perfectly. */
  assertProp(name, 'a harvested form finds itself', () => {
    const probe = P.forms[0];
    const got = sents(runSearch({ query: probe, field: 'text', level: 'word' }));
    if (!got.size) throw new Error(`exact form "${probe}" matched nothing`);
  });

  const plans = [
    { field: 'text',        probes: P.forms,      levels: ['word', 'sentence'] },
    { field: 'gloss',       probes: P.glosses,    levels: ['word', 'morpheme', 'sentence'] },
    { field: 'translit',    probes: P.translit,   levels: ['word', 'morpheme', 'sentence'] },
    { field: 'translation', probes: P.transWords, levels: ['sentence'] },
  ];

  for (const { field, probes, levels } of plans) {
    for (const level of levels) {
      for (const probe of probes) {
        const base   = { query: probe, field, level };
        const exact  = runSearch(base);
        const eSents = sents(exact);
        if (eSents.size) nonEmpty++;

        /* 2 · a wildcard never LOSES a match the exact query found. Widening is
           the one thing a glob is for, and `parseQuery` builds a different regex
           for each shape. */
        for (const wide of [probe.slice(0, -1) + '*', '*' + probe.slice(1), '*' + probe + '*']) {
          assertProp(name, `${field}/${level} "${probe}" ⊆ "${wide}"`, () => {
            const w = sents(runSearch({ ...base, query: wide }));
            if (!subset(eSents, w))
              throw new Error(`widening lost ${[...eSents].filter(x => !w.has(x)).length} sentence(s)`);
          });
        }

        /* 3 · case-insensitive never loses a case-sensitive match. They take
           different branches: the fold, or the regex `i` flag (B-120). */
        assertProp(name, `${field}/${level} "${probe}" cs ⊆ ci`, () => {
          const cs = sents(runSearch({ ...base, caseSensitive: true }));
          if (!subset(cs, eSents))
            throw new Error(`case-sensitive found ${[...cs].filter(x => !eSents.has(x)).length} the insensitive scan did not`);
        });

        /* 4 · an anchored regex equals the exact glob. Two compilers — the glob
           expander and `new RegExp` — must agree on the one case where their
           meanings coincide. Word and morpheme level only: at sentence level the
           glob is a substring test and `^…$` is not. */
        if (level !== 'sentence') {
          assertProp(name, `${field}/${level} "${probe}" glob == /^…$/`, () => {
            const rx = sents(runSearch({ ...base, query: '^' + escRx(probe) + '$', regex: true }));
            if (!eqSet(rx, eSents))
              throw new Error(`glob ${eSents.size} vs regex ${rx.size}`);
          });
        }

        /* 5 · a word-level hit's sentence is also a sentence-level hit. Two
           independent scan loops over the same corpus: the token walk and the
           whole-string test. A token that matched is inside the string. */
        if (level === 'word' && levels.includes('sentence')) {
          assertProp(name, `${field} word ⊆ sentence for "${probe}"`, () => {
            const s = sents(runSearch({ ...base, level: 'sentence', query: '*' + probe + '*' }));
            if (!subset(eSents, s))
              throw new Error(`${[...eSents].filter(x => !s.has(x)).length} sentence(s) matched at word level and not at sentence level`);
          });
        }

        /* 6 · the hit shape is structurally true: every matched word id is a
           word of the sentence the hit names. */
        if (level !== 'sentence') {
          assertProp(name, `${field}/${level} "${probe}" hit shape`, () => {
            for (const h of exact.hits) h.sentIds.forEach((sid, k) => {
              const st = byId.get(sid);
              if (!st) throw new Error(`hit names unknown sentence ${sid}`);
              const have = new Set((st.words || []).map(w => w.id));
              for (const wid of (h.matchedWordIds[k] || []))
                if (!have.has(wid)) throw new Error(`word ${wid} is not in ${sid}`);
            });
          });
        }
      }
    }
  }
}

for (const [name, file] of Object.entries(CORPORA)) {
  process.stdout.write(`\n[${name}] `);
  sweep(name, file);
}

console.log('\n\nsearch invariants, over queries harvested from the corpora\n');
for (const [corpus, rec] of perCorpus)
  check(rec.failed === 0, `${corpus} — ${rec.ran} property check(s) hold`,
        failures.filter(f => f.startsWith(corpus)).slice(0, 20).map(f => `         ${f}`).join('\n'));

/* Not a pass on the properties but on whether they MEANT anything: every
   property above is vacuously true of a query that matches nothing. */
check(nonEmpty >= 40,
      `${nonEmpty} of the swept queries produced matches, so the properties are not vacuous`,
      '         under 40 means the sweep may be asserting about empty results');

/* The typological contrast is the point, not the number of checks: 600 property
   checks over one language prove much less than 200 over two. */
const names = Object.keys(CORPORA);
check(names.length >= 2, `swept ${names.length} corpora (${names.join(', ')})`,
      '         this sweep was written for a contrastive pair — agglutinative against\n'
    + '         isolating, with transliteration against without. One corpus proves less.');

if (failures.length > 20) console.log(`\n  … and ${failures.length - 20} more`);
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
