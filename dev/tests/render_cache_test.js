#!/usr/bin/env node
/* =============================================================================
   render_cache_test.js, view-only state must be able to reach the screen
   Run:  node dev/tests/render_cache_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   render() short-circuits when nothing it tracks has changed:

       const cacheKey = `${v}|${S.sectIdx}|…|${_dataGen}${searchKey}`;
       if (cacheKey === _renderCacheKey) return;

   That key covers navigation state and the data generation counter. It does NOT
   cover module-level VIEW state, which fold is open, which column is sorted, so a handler that flips such a variable and then calls a bare render() does
   nothing at all: no render, no error, no log line. The control is simply dead.

   This has now cost two bugs:

     B-008 (2026-08-24), the cache key was stamped BEFORE the render, so a
       renderer that threw poisoned it and every retry silently no-oped.

     B-011 (2026-08-24), `_sentExpanded` (the sentence view's fold state) was
       flipped and then handed to a bare render(). EVERY fold in the sentence
       view was inert: Dependency Parse and its arc diagram, Annotators,
       Transliterations, Comments. Reported as "the chip appears clickable but
       is unresponsive" and "the render view does not show the arc diagram", two symptoms, one cause.

   The codebase already knew the trap: the annotators-view sort handler writes
   `_renderCacheKey = null;   // force re-render` immediately before render().
   The sentence-fold handler, 180 lines away in the same file, did not.

   WHAT THIS CHECKS
   ----------------
   Every module-level `_state` variable that a render* function reads must have
   one of three ways to reach the screen:

     1. it appears in render()'s cacheKey expression; or
     2. every site that mutates it also sets `_renderCacheKey = null`; or
     3. it is listed in TARGETED_REFRESH below, with the reason, meaning it is
        repainted by a direct DOM update that never goes through render().

   LIMITS, deliberately a lint, not a proof:
   · "Mutation site" is matched textually (`_foo =`, `_foo.add(`, …).
   · Proximity to `_renderCacheKey = null` is checked within a small window, so a
     handler that nulls the key far from the mutation reads as unsafe. That is
     the conservative direction, keep the two adjacent anyway.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { ROOT, SRC } = require('./_source.js');
const FILES = ['LingCoT.html',
  ...fs.readdirSync(path.join(SRC, 'modules')).map(f => path.join('modules', f))];

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* State repainted by a targeted DOM update rather than by render().
   Each entry names the function that does the repainting, so a reader can check
   the claim. Delete the entry if that path ever goes away. */
const TARGETED_REFRESH = {
  _copyPanel:       'renderCopyPanel() repaints #copy-panel-body, which sits outside #content',
  _dictFilter:      'rerenderDictTable() repaints the tbody directly',
  _dictTypeFilter:  'rerenderDictTable() repaints the tbody directly',
  _dictShowDomain:  'rerenderDictTable(true) repaints thead + tbody directly',
  _lpHighlighted:   'the Leipzig panel toggles chip classes in place',
  _bcCache:         'renderBreadcrumb() owns it; not a render() input',
  _LEIPZIG_GLOSSES: 'load-once reference data, never mutated by a handler',
  _annFocusId:      'scroll-target hint, cleared after use; set alongside go()',
  _srcFocusId:      'scroll-target hint, cleared after use; set alongside go()',
  /* B-095 dropped the two annotator-modal entries. They were never read by a
     renderer; they were declared in the gap between renderAnnChips and the next
     function, and the slicing below reads that gap as part of the renderer.
     Moving the declarations up with the rest of the panel's state removed the
     need for the exemption. The source pair below is still in its equivalent
     gap, so its entries stay. */
  _srcModalCallback:'modal plumbing, not read during a cached render',
  _srcModalEditId:  'modal plumbing, not read during a cached render',
  _activeAnnotatorId:'mutations bump _dataGen via the annotator bar save path',
  _secEdit:         'secEditRedraw() repaints #sec-edit-list directly (D59)',
  _dictOffer:       'renderOfferPanel() repaints #offer-panel-body directly (D60)',
  _srchHits:          'set by the Search-B run, which re-renders through its own key',
  _srchFreq:          'set by the Search-B run, which re-renders through its own key',
  _srchColl:          'set by the Search-B run, which re-renders through its own key',

  /* Load-once configuration, not view state. Populated from resources/*.json at
     boot and never changed by a handler, so it cannot go stale mid-session. */
  POS_CHOICES:      'loaded once at boot from resources/pos_tags.json',
  TYPE_CHOICES:     'loaded once at boot from resources/type_choices.json',
  XLATE_SETTINGS:   'B-019: the settings modal nulls _renderCacheKey and re-renders on save',
};

const src = {};
for (const f of FILES) src[f] = fs.readFileSync(path.join(SRC, f), 'utf8');

/* render()'s cacheKey expression, including the searchKey it interpolates. */
const html     = src['LingCoT.html'];
const cacheExpr = html.slice(html.indexOf('const searchKey'),
                             html.indexOf('\n', html.indexOf('const cacheKey =') + 400));

/* Module-level mutable state. ANY name, not just _foo.
   B-019: this scanned only underscore-prefixed names, so `XLATE_SETTINGS`, read by renderSentence for its language-fit warning and absent from the cache
   key, was invisible to the guard that exists precisely to catch that. A
   naming convention is not a category; the category is "module-level `let`". */
const state = new Set();
for (const text of Object.values(src))
  for (const m of text.matchAll(/^(?:let|var)\s+([A-Za-z_]\w*)/gm)) state.add(m[1]);

/* Bodies of the render-ish functions. */
function renderBodies(text) {
  const out = {};
  const all = [...text.matchAll(/^(?:async )?function \w+\s*\(/gm)].map(m => m.index);
  for (const m of text.matchAll(/^function (render\w+)\s*\(/gm)) {
    const nxt = all.find(p => p > m.index);
    out[m[1]] = text.slice(m.index, nxt ?? text.length);
  }
  return out;
}

/* @fn fnBodies, every top-level function in a file, by name. */
function fnBodies(text) {
  const out = {};
  const heads = [...text.matchAll(/^(?:async )?function (\w+)\s*\(/gm)];
  heads.forEach((m, i) => {
    out[m[1]] = text.slice(m.index, heads[i + 1] ? heads[i + 1].index : text.length);
  });
  return out;
}

/* `readBy` is DIRECT reads, and stays direct: the mutation scan below is
   calibrated against it, and widening it attributes every read inside `t()` or
   `esc()` to all 29 renderers, which turns one shared helper into 29 false
   reports. */
const readBy = {};
for (const [f, text] of Object.entries(src))
  for (const [name, body] of Object.entries(renderBodies(text)))
    for (const s of state)
      if (new RegExp(`\\b${s}\\b`).test(body)) (readBy[s] ||= new Set()).add(name);

/* `readDeep` follows a renderer ONE level into the helpers it calls, and is used
   by exactly one check: whether an allowlist entry is dead.

   That check used to run off `readBy`, which models a renderer as reading its
   state directly — so the moment a chunk of one is extracted into a named
   helper, it reports the entry as rot and tells you to DELETE it. B-109 moved
   the dict-browse filter row into `dictTypeFilterHtml`, where `_dictTypeFilter`
   is still read, still on every render, and reachable only through the renderer
   that calls it; the guard said to drop its refresh path. **Naming a live entry
   as dead is worse than missing a dead one**, because the fix it proposes
   removes a guarantee. A helper read is proof the entry is alive, which is all
   that check needs — and it is not proof of a direct read, which is why the two
   maps stay apart. */
const readDeep = {};
for (const [f, text] of Object.entries(src)) {
  const fns = fnBodies(text);
  for (const [name, body] of Object.entries(renderBodies(text))) {
    let scan = body;
    for (const c of new Set([...body.matchAll(/\b([a-zA-Z_]\w*)\s*\(/g)].map(m => m[1])))
      if (fns[c] && !/^render/.test(c)) scan += '\n' + fns[c];
    for (const s of state)
      if (new RegExp(`\\b${s}\\b`).test(scan)) (readDeep[s] ||= new Set()).add(name);
  }
}

console.log('\nview state a renderer reads must be able to reach the screen\n');
{
  const unsafe = [];
  for (const s of Object.keys(readBy)) {
    if (new RegExp(`\\b${s}\\b`).test(cacheExpr)) continue;      // route 1
    if (TARGETED_REFRESH[s]) continue;                           // route 3

    // route 2, every mutation site nulls the cache key nearby
    const sites = [];
    for (const [f, text] of Object.entries(src)) {
      // Three mutation shapes. The third, property assignment, was missing,
      // so `XLATE_SETTINGS.backend = chosen` (B-019) was not seen as a mutation
      // at all and the whole variable looked untouched.
      const mut = new RegExp(
        `\\b${s}\\s*=[^=]`                          + '|' +   // whole-value assignment
        `\\b${s}\\.(?:add|delete|clear|set|push)\\(`  + '|' +   // collection mutation
        `\\b${s}\\.\\w+\\s*=[^=]`,                   'g');    // property assignment
      for (const m of text.matchAll(mut)) {
        // Skip the declaration itself. The old 6-character look-back missed
        // `let _annViewSort = {.}` and reported it as an unsafe mutation.
        const lineStart = text.lastIndexOf('\n', m.index) + 1;
        const line = text.slice(lineStart, text.indexOf('\n', m.index));
        if (/^\s*(?:let|var|const)\s/.test(line)) continue;

        // Skip resets performed by go(). Navigation always changes the cache key
        // (view / sectIdx / sentId / wordId are all in it), so a reset there
        // cannot leave a stale screen. Detected by the nearest preceding
        // top-level function declaration.
        const prevFn = text.lastIndexOf('\nfunction ', m.index);
        if (prevFn !== -1 && /^\nfunction go\s*\(/.test(text.slice(prevFn, prevFn + 14))) continue;
        const window_ = text.slice(m.index, m.index + 600);
        // B-019: this used to also require /\brender\(\)/ nearby, i.e. it only
        // caught state handed to a BARE render(). State that is mutated and then
        // never re-rendered AT ALL slipped through, which is the worse failure:
        // the screen simply keeps showing the old value forever. The requirement
        // is now unconditional, every mutation site either nulls the cache key
        // or the variable belongs in TARGETED_REFRESH with its repaint named.
        if (!/_renderCacheKey\s*=\s*null/.test(window_))
          sites.push(`${f}:${text.slice(0, m.index).split('\n').length}`);
      }
    }
    if (sites.length) {
      unsafe.push(`         ${s} — read by ${[...readBy[s]].join(', ')}\n` +
                  `           mutated without nulling the cache key at: ${sites.join(', ')}\n` +
                  `           fix: set \`_renderCacheKey = null;\` before render(), or add to TARGETED_REFRESH`);
    }
  }
  check(unsafe.length === 0,
        `${Object.keys(readBy).length} render-read state vars all have a refresh path`,
        unsafe.join('\n\n'));
}

/* The allowlist must not rot: an entry no renderer reads any more is dead. */
console.log('\ntargeted-refresh allowlist must stay accurate');
{
  const stale = Object.keys(TARGETED_REFRESH).filter(s => !readDeep[s]);
  check(stale.length === 0,
        `${Object.keys(TARGETED_REFRESH).length} allowlist entries all still apply`,
        stale.map(s => `         ${s} is no longer read by any renderer — drop it`).join('\n'));
}

/* B-008 pin: the cache key must be stamped only after a successful render. */
console.log('\ncache key must not be stamped before the render');
{
  const i = html.indexOf('if (cacheKey === _renderCacheKey) return;');
  const j = html.indexOf('el.innerHTML = renderFn()');
  const between = html.slice(i, j);
  check(!/_renderCacheKey\s*=\s*cacheKey/.test(between),
        'assigned after renderFn(), not before (B-008)',
        '         _renderCacheKey = cacheKey happens before the render again —\n' +
        '         a renderer that throws will poison the cache and silence its own retry.');
}

/* ── B-049: no object reaches the cache key ─────────────────────────────────
   An object interpolated into a template literal becomes `[object Object]`, so
   every distinct value of it produces the SAME key and the cache blocks a render
   that should have happened. This is invisible at the point of use: the key
   looks like it carries the state.

   v3.14.270: the instance is gone rather than fixed. `S.dictNewEntry` was the
   prefill for `renderDictAdd`, and D51 stage 5 retired both — "+ dict" opens a
   panel over the current view and renders nothing, so there is no key to get
   wrong. What is kept is the RULE, generalised: no object may be interpolated
   into the key, whatever it is called next time. */
{
  const { read, decomment, fnSrc } = require('./_source.js');
  const html = read('LingCoT.html');
  /* Decommented: three comments name the retired prefill on purpose, saying what
     it was and why it went. A guard that matched its own explanation is a
     failure this project has hit three times. */
  const code = decomment(html);
  const keyLine = /const cacheKey = `([^`]*)`/.exec(html);
  check(!!keyLine, 'found the cache key');
  const key = keyLine ? keyLine[1] : '';

  check(!/\$\{S\.dictNewEntry\}/.test(key) && !/dictNewEntry/.test(code),
        'the prefill that caused B-049 is gone, producer and consumer both',
        'a half-removed prefill contract is what B-050 filed');

  /* Every interpolation in the key must be something that stringifies to a
     value. Executed against a stand-in state, because "does it stringify" is
     not answerable by reading — that was the whole of B-049. */
  const slots = [...key.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1].trim());
  check(slots.length > 4, `the key interpolates ${slots.length} slots`);
  const bad = slots.filter(x => /^S\.\w+$/.test(x) === false && /^_?\w+$/.test(x) === false
                                && !/\(\)/.test(x));
  check(bad.length === 0, 'and every slot is a plain value or a call, not an expression',
        bad.join(', '));

  /* The falsifiable half: an object put in this key would be caught. */
  const stringifiesFlat = v => `${v}` === '[object Object]';
  check(stringifiesFlat({ a: 1 }),
        'the premise holds — an object in a template literal is [object Object]',
        'if this ever fails, B-049 stops being possible and this guard can go');

  /* ── v3.14.282: every NAVIGATION field is in the key ──────────────────────
     Added because D35 B5's `S.lemmaId` was not, and nothing here noticed. Two
     lemma groups visited in a row are the same view with the same `_dataGen`,
     so the second would not have repainted — B-011 exactly, in a view added
     eleven versions after the guard that exists for it.

     The list is DERIVED from `go()`, not written here: `go` is the one place a
     navigation field is assigned from `opts`, so a field added there and
     forgotten in the key is the whole of this defect, and a hand-written list
     would have to be remembered too. `sectIdx`/`paraIdx` and the rest all
     appear; the exclusions are named and argued rather than filtered by shape. */
  const goSrc = decomment(fnSrc('LingCoT.html', 'go'));
  const assigned = [...goSrc.matchAll(/S\.(\w+)\s*=\s*opts\.\w+\s*!==\s*undefined/g)]
    .map(m => m[1]);
  /* Not navigation: these say where BACK goes and how the entry was reached.
     Two routes to one screen must hit the same cache entry — that is the cache
     working, not failing. */
  const NOT_NAV = ['dictBackView', 'dictParentForm'];
  const want = assigned.filter(f => !NOT_NAV.includes(f));
  check(want.length >= 6, `go() assigns ${want.length} navigation field(s) from opts`,
        '         zero or few means the scan broke, not that go() is simple');
  const absent = want.filter(f => !key.includes(`S.${f}`));
  check(absent.length === 0,
        'and every one of them is interpolated into the cache key',
        `         missing: ${absent.map(f => 'S.' + f).join(', ')}\n`
      + '         a navigation field outside the key means two different screens\n'
      + '         share a cache entry, and the second one does not repaint (B-011)');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
