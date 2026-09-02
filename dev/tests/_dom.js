/* =============================================================================
   _dom.js, the browser this app is executed in by the guards that execute it
   =============================================================================
   Extracted at v3.14.216 from boot_smoke_test.js, which had been the only guard
   that ran the whole app. B-102 needed a second one — render_smoke_test.js —
   and two copies of a DOM stub is how the two would drift apart, with the newer
   one quietly becoming more permissive than the older.

   The stub is deliberately thin. It is not a DOM implementation and must not
   grow into one: it exists so that top-level evaluation and the view renderers
   can RUN, and the thing being caught is an exception, not a wrong pixel. A
   method added here should be one the app actually calls.

   `hasId` is the one thing the two callers disagree about, and the disagreement
   is the point:

     boot   the browser is mid-parse, so getElementById returns an element only
            for ids in the markup ABOVE the script tags, and null for the rest.
     render the page has been painted, so every id resolves.

   A stub that returned an element for every id during boot would hide real
   failures; one that returned null for every id at render time would invent
   them.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { SRC } = require('./_source.js');

/* @fn stubEl, an element that answers everything and remembers nothing. */
function stubEl() {
  const el = {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', id: '',
    hidden: false, checked: false, disabled: false, options: [], files: [],
    children: [], selectedIndex: 0, parentNode: null, firstChild: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    appendChild() {}, removeChild() {}, remove() {}, insertAdjacentHTML() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute: () => null,
    hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, contains: () => false, focus() {}, blur() {}, click() {},
    scrollIntoView() {}, cloneNode: () => stubEl(),
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  };
  return el;
}

/* @fn appSources, the app's scripts in the order the browser runs them. */
function appSources() {
  const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');
  return {
    html,
    MODULE_ORDER: [...html.matchAll(/<script[^>]*\bsrc="modules\/([^"]+)"/g)].map(m => m[1]),
    INLINE: html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1],
    /* Everything the browser has parsed by the time the inline script runs. */
    STATIC_IDS: new Set([...html.split('<script')[0].matchAll(/id="([^"]+)"/g)].map(m => m[1])),
  };
}

/* @fn makeCtx, a VM context the app can be evaluated in.
   `hasId(id)` decides whether getElementById finds something. */
function makeCtx({ hasId }) {
  const document = {
    documentElement: stubEl(), body: stubEl(), head: stubEl(),
    title: '', readyState: 'loading',
    getElementById: id => (hasId(id) ? stubEl() : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    createElement: () => stubEl(),
    createTextNode: () => stubEl(),
    createDocumentFragment: () => stubEl(),
    addEventListener() {}, removeEventListener() {}, execCommand() {},
    /* Read by the annotator-modal focus trap. */
    activeElement: null,
  };

  const ctx = {
    console, document,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage:   { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { language: 'en', userAgent: 'node', clipboard: { writeText: () => Promise.resolve() } },
    location: { href: '', search: '' },
    alert() {}, confirm: () => true, prompt: () => null,
    fetch: () => Promise.resolve({ ok: true, json: () => ({}), text: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: cb => cb(), cancelAnimationFrame() {},
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    CustomEvent: function () {}, Event: function () {}, Blob: function () {}, FileReader: function () {},
    /* B-108's chip lookup and the participants modals both use it. Node has no
       CSS global, and the real one only escapes, so this is the honest shape. */
    CSS: { escape: s => String(s).replace(/["\\\]]/g, '\\$&') },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.window.addEventListener = () => {};
  ctx.window.removeEventListener = () => {};
  /* The rest of what the app asks of `window`, taken from what it actually
     calls rather than guessed at one crash per run:
       grep -oh "window\.[a-zA-Z]*" source/LingCoT.html source/modules/*.js
     `pywebview` is deliberately absent. A browser opening this file directly
     has no bridge, the app is written to survive that, and stubbing it here
     would stop the guards from ever exercising the path that matters. */
  ctx.window.scrollTo = () => {};
  ctx.window.innerHeight = 900;
  ctx.window.innerWidth  = 1440;
  ctx.window.onerror = null;
  return vm.createContext(ctx);
}

/* @fn loadApp, evaluate every module then the inline script into `ctx`.
   Returns the list of [label, error] for anything that threw, so the caller
   decides whether that is a failure or the thing it is measuring. */
function loadApp(ctx, sources) {
  const errs = [];
  for (const f of sources.MODULE_ORDER) {
    try { vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', f), 'utf8'), ctx, { filename: f }); }
    catch (err) { errs.push([f, err]); }
  }
  try { vm.runInContext(sources.INLINE, ctx, { filename: 'INLINE' }); }
  catch (err) { errs.push(['INLINE', err]); }
  return errs;
}

module.exports = { stubEl, appSources, makeCtx, loadApp };
