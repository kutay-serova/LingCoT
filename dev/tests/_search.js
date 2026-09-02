/**
 * _search.js — the shared harness for the two Search-B guards.
 *
 * WHY THIS FILE EXISTS. `search_matcher_test.js` and
 * `search_concordance_test.js` each carried their own ~50-line copy of the
 * same context assembly: the DOM stubs, the `sliceFn` brace matcher, the hoist,
 * the three sliced field extractors, and the corpus seeding. The two copies had
 * already drifted — one built `S.sentById` and the other did not, one sliced
 * function bodies by the first `{` and the other stepped over the parameter
 * list first — and neither drift was visible from either file. PRACTICES §4:
 * two writers of one thing means one of them is wrong.
 *
 * WHAT IT SEEDS, AND WHY MORE THAN BEFORE. The old harnesses loaded a corpus and
 * nothing else, so `S.lemmas` and `S.dictByLemmaId` were empty and every
 * `field: 'lemma'` search returned zero hits — a whole matcher path that could
 * not be reached, in the guard whose job is to reach them. `seed` loads the
 * dictionary companion too and splits it into entries and lemma records the way
 * `applyDict` does, so the lemma path has something to walk.
 *
 * `seed` REPLACES the previous corpus rather than adding to it, so a case block
 * states which language it is asserting against and cannot silently inherit the
 * other. Seeding both at once is the deliberate exception, for the one claim
 * that is about walking more than one document.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT        = path.resolve(__dirname, '..', '..');
const HTML_FILE   = path.join(ROOT, 'source', 'LingCoT.html');
const SEARCH_JS   = path.join(ROOT, 'source', 'modules', 'search.js');
const SEARCH_B_JS = path.join(ROOT, 'source', 'modules', 'search.js');
const { requireCorpusOrDisable, requireCompanion, loadCorpus, loadCompanion } = require('./_fixture.js');

/* @fn sliceFn, lift one top-level function out of a source file.
   Steps over the PARAMETER LIST before looking for the body: a default value
   containing a brace (`opts = {}`) would otherwise be read as the body's start
   and the slice would end in the middle of the function. The matcher guard's
   copy did this and the concordance guard's did not; this is the one that is
   right, and now the only one. */
function sliceFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('sliceFn: cannot find ' + name);
  let p = src.indexOf('(', start), pd = 0, q = p;
  for (; q < src.length; q++) {
    if (src[q] === '(') pd++;
    else if (src[q] === ')') { pd--; if (!pd) { q++; break; } }
  }
  let i = src.indexOf('{', q), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(start, i);
}

const hoist = s => s.replace(/^let /gm, 'var ').replace(/^const /gm, 'var ');

/* @fn boot, assemble the module context once. Returns the two corpus paths so a
   guard can name what it is asserting against in its own output. */
function boot(what, why) {
  const TURKISH = requireCorpusOrDisable('turkish', what, why);
  const CHINESE = requireCorpusOrDisable('chinese', what, why);

  const _noop = () => {};
  const _elem = new Proxy({}, { get: () => _noop, set: () => true });
  global.document = { getElementById: () => _elem, querySelector: () => _elem,
                      querySelectorAll: () => [], createElement: () => _elem,
                      addEventListener: _noop };
  global.window    = { addEventListener: _noop };
  global.navigator = { onLine: true, language: 'en' };
  global.render = _noop; global.logEvent = _noop; global.go = _noop;
  global.setTimeout = () => 0; global.clearTimeout = _noop;
  global.alert = _noop; global.confirm = () => false;
  global.esc = s => String(s == null ? '' : s);
  global.escAttr = s => String(s == null ? '' : s);

  const _LOCALE = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'source', 'resources', 'locale', 'en.json'), 'utf8'));
  global.t = (k, vars) => {
    let s = _LOCALE[k] ?? k;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, n) => (vars[n] ?? ''));
    return s;
  };

  global._dataGen = 0;
  global.mutate   = () => { global._dataGen++; };
  global.S = { docs: [], dictionary: [], lemmas: [], dictByLemmaId: new Map(),
               translitLabels: new Set(), posValues: new Set(),
               morphTypes: new Set(), sentById: new Map() };

  /* B-120: `normForm` delegates to `dictKey`, which is locale- and
     script-tailored and lives in normalize.js. Without it loaded the fold
     silently degrades to `toLowerCase()`, and a Turkish `İ` stops folding to
     `i` — the exact defect B-120 was filed for, restored inside the guard that
     is supposed to catch it. It is a global here because that is how `normForm`
     reaches it in the app. */
  const N = require(path.join(ROOT, 'source', 'modules', 'normalize.js'));
  global.setFoldContext = N.setFoldContext;
  global.dictKey        = N.dictKey;

  const appJs = fs.readFileSync(HTML_FILE, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const helpers = ['wordGloss', 'wordTranslit', 'normForm'].map(n => sliceFn(appJs, n)).join('\n');
  try {
    vm.runInThisContext(helpers, { filename: 'lingcot-helpers.js' });
    vm.runInThisContext(hoist(fs.readFileSync(SEARCH_JS,   'utf8')), { filename: 'search.js' });
    vm.runInThisContext(hoist(fs.readFileSync(SEARCH_B_JS, 'utf8')), { filename: 'search.js' });
  } catch (e) {
    console.error('Context assembly failed:', e.message, '\n', e.stack);
    process.exit(1);
  }
  return { TURKISH, CHINESE };
}

/* @fn seed, install a set of corpus files as the whole of S.

   Bumps `_dataGen` because the substrate caches token streams on the sentence
   and paragraph objects and keys them by that counter. Different objects each
   time makes the bump redundant today and correct the day a guard seeds the
   same corpus twice. */
function seed(files) {
  global._dataGen++;
  S.docs = []; S.dictionary = []; S.lemmas = [];
  S.dictByLemmaId = new Map(); S.sentById = new Map(); S.translitLabels = new Set();

  for (const f of files) {
    S.docs.push(...loadCorpus(f).items);
    const dict = loadCompanion(requireCompanion(f, 'dictionary')).items;
    for (const r of dict) {
      if (r && r.record_type === 'lemma') S.lemmas.push(r);
      else S.dictionary.push(r);
    }
  }
  /* D35 A2: the lemma -> members index the lemma search expands through. The app
     builds it in `buildDictIndex`, which is not sliced in here, so it is built
     the same way from the same field rather than imported. */
  for (const e of S.dictionary) {
    if (!e || !e.lemma_id) continue;
    if (!S.dictByLemmaId.has(e.lemma_id)) S.dictByLemmaId.set(e.lemma_id, []);
    S.dictByLemmaId.get(e.lemma_id).push(e);
  }
  /* The app binds the fold to the open corpus in `refreshFoldContext`; a guard
     that skips it is testing a different fold from the one users get — and the
     difference is precisely B-120, so skipping it here would disarm the case
     written to catch B-120.

     The corpora store ISO 639-3 ("tur", "zho") and `CASE_TAILORED_LOCALES` keys
     on the 639-1 code, so the resolution is not optional. `loadLanguageMaps`
     owns the real alias table and needs the PyWebView bridge; this reads the
     same shipped file for the one field it needs and no more. */
  const lang = String((((S.docs[0] || {}).metadata) || {}).language || '').trim();
  if (typeof setFoldContext === 'function') setFoldContext(canonicalLang(lang), '');

  for (let di = 0; di < S.docs.length; di++) {
    const d = S.docs[di];
    (d.sections || []).forEach((sect, si) =>
      (sect.paragraphs || []).forEach((para, pi) =>
        (para.sentences || []).forEach((sent, senti) => {
          S.sentById.set(sent.id, { sent, para, paraIdx: pi, sect, sectIdx: si,
                                    sentIdx: senti, docIdx: di });
          for (const w of (sent.words || [])) {
            for (const t of (w.transliterations || [])) if (t.label) S.translitLabels.add(t.label);
            for (const m of (w.morphemes || []))
              for (const t of (m.transliterations || [])) if (t.label) S.translitLabels.add(t.label);
          }
        })));
  }
}

/* @fn canonicalLang, ISO 639-3 or a name to the key `language_codes.json` uses. */
let _langMap = null;
function canonicalLang(raw) {
  if (!raw) return '';
  if (!_langMap) {
    _langMap = new Map();
    const langs = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'source', 'resources', 'language_codes.json'), 'utf8')).languages || {};
    for (const [code, info] of Object.entries(langs)) {
      _langMap.set(code.toLowerCase(), code);
      for (const f of ['iso639_1', 'iso639_3']) if (info[f]) _langMap.set(String(info[f]).toLowerCase(), code);
      for (const a of (info.aliases || [])) _langMap.set(String(a).toLowerCase(), code);
    }
  }
  return _langMap.get(raw.toLowerCase()) || raw;
}

/* One reporter, so the whole suite reads the same (v3.14.136). */
function reporter() {
  const state = { pass: 0, fail: 0 };
  const check = (ok, label, detail) => {
    if (ok) { state.pass++; console.log(`  ok   ${label}`); }
    else    { state.fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
  };
  const test = (name, fn) => {
    try { fn(); check(true, name); }
    catch (e) { check(false, name, `         ${e.message}`); }
  };
  const done = () => {
    console.log(`\n${state.pass} passed, ${state.fail} failed\n`);
    process.exit(state.fail ? 1 : 0);
  };
  return { state, check, test, done };
}

function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function eq(a, b, m) {
  if (a !== b) throw new Error(`${m || 'mismatch'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function sameSet(a, b, m) {
  const A = [...new Set(a)].sort(), B = [...new Set(b)].sort();
  if (A.length !== B.length || A.some((x, i) => x !== B[i]))
    throw new Error(`${m || 'set mismatch'}\n   expected: ${JSON.stringify(B)}\n   got:      ${JSON.stringify(A)}`);
}

/* Hit-shape readers. A hit is per-OCCURRENCE, so several may name one sentence
   and one may name two; these are the two questions the goldens ask. */
const sentSet = hits => { const s = new Set(); for (const h of hits) for (const id of h.sentIds) s.add(id); return [...s]; };
const wordIds = hits => { const s = new Set(); for (const h of hits) for (const g of (h.matchedWordIds || [])) for (const w of g) s.add(w); return [...s]; };
/* The forms behind the matched ids, which is what a person checking a golden by
   hand actually reads. Order follows the corpus, not the hit list. */
function formsOf(ids) {
  const want = new Set(ids), out = [];
  for (const d of S.docs)
    for (const sect of (d.sections || []))
      for (const para of (sect.paragraphs || []))
        for (const sent of (para.sentences || []))
          for (const w of (sent.words || [])) if (want.has(w.id)) out.push(w.form);
  return out;
}
/* sec/sent shorthand for failure messages: full ids are unreadable in a diff and
   the short suffix alone repeats across sections. */
const shortIds = ids => ids.map(i => {
  const p = i.split('.');
  return `${p[1] || '?'}/${p[3] || p[2] || '?'}`;
});

module.exports = { boot, seed, reporter, assert, eq, sameSet,
                   sentSet, wordIds, formsOf, shortIds, sliceFn };
