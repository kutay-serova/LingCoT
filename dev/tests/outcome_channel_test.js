#!/usr/bin/env node
/* =============================================================================
   outcome_channel_test.js — the app's one channel for saying what happened
   Run:  node dev/tests/outcome_channel_test.js
   =============================================================================
   L-038. Fourteen call sites in two files send every outcome through
   `flashSaveStatus`, and after that finding two properties became load-bearing:

     1. SEVERITY IS DERIVED, not declared. `flashSaveStatus` reads the icon the
        caller already passes — `/#ph-warning/` against the rendered sprite ref —
        so no call site had to be told twice and none of the fourteen changed.
        The cost of deriving is that a caller who passes NO icon, or a new icon
        name nobody has classified, is silently read as success. That is what
        section 2 holds, and it is the only thing standing between a future
        "export failed" and a message that whispers and then removes itself.

     2. A FAILURE DOES NOT EXPIRE. Success clears itself after 2.5 s; a warning
        stays until it is replaced or clicked away. An app that knows the save
        failed and unsays it after two and a half seconds is worse than one that
        never said anything.

   EXECUTED, NOT READ. PRACTICES §6: a shape is not a behaviour. Sections 3–5
   load the real app into the stub DOM, call `flashSaveStatus`, run the timers,
   and look at what is on the element and in the list afterwards — because the
   defect this replaced (B-183) passed a guard that asserted the shape of a fix
   against a control that could not toggle.

   Section 6 is the one thing that must stay a source check: PRACTICES §9. The
   history holds messages that name forms, and the guard has to show that no
   path carries it to disk — an absence cannot be executed.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { read, decomment, moduleFiles, SRC } = require('./_source.js');
const { appSources, makeCtx, loadApp, stubEl } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const htmlSrc = read('LingCoT.html');
const js = decomment([htmlSrc, ...moduleFiles().map(([, c]) => c)].join('\n'));

console.log('\n1 · the derivation is anchored to what icon() actually emits');

/* If `icon()` ever stops emitting `#ph-<name>`, severity silently becomes
   "always success" and every guard below still passes, because they all go
   through the same helper. This is the one assertion about the other end. */
check(/function icon\(name\)\s*\{[^}]*#ph-\$\{name\}/.test(read('LingCoT.html')),
      "icon('warning') emits a `#ph-warning` sprite reference",
      '         flashSaveStatus derives severity from that string; if the sprite\n'
    + '         reference changes shape, every failure reads as a success');

check(/function flashSaveStatus\(msg\)\s*\{\s*const warn = \/#ph-warning\/\.test/.test(js),
      'flashSaveStatus derives `warn` from the message, not from a parameter',
      '         a second parameter is a second writer of one thing (PRACTICES §4)');

console.log('\n2 · every caller passes an icon this channel can classify');

/* DERIVED, not listed: the call sites are found in the source, so a new one is
   covered without an edit here. The ALLOWED set is listed, and deliberately —
   adding a name to it is the moment someone decides what severity it carries. */
const ALLOWED = new Set(['check-circle', 'warning', 'book']);
const WARNING = new Set(['warning']);

const callSites = [];
for (const [file, body] of [['LingCoT.html', htmlSrc], ...moduleFiles()]) {
  const src = decomment(body);
  /* `(?<!function )` keeps the declaration out: it is not a caller, and counting
     it once made this guard report a call with no icon that does not exist —
     a false positive is as expensive as a miss, because it teaches the next
     person to read past this section. */
  const re = /(?<!function )\bflashSaveStatus\(\s*([\s\S]{0,120})/g;
  for (const m of src.matchAll(re)) {
    const line = src.slice(0, m.index).split('\n').length;
    callSites.push({ file, line, arg: m[1] });
  }
}

check(callSites.length >= 14,
      `${callSites.length} call sites found (L-038 counted 14; fewer means the scan broke)`,
      '         the count is a canary on the scan, not on the app: a regex that\n'
    + '         silently stops matching would pass every check below vacuously');

const noIcon = [], unknown = [];
for (const c of callSites) {
  const m = c.arg.match(/^\s*`\$\{icon\(\s*(?:'([a-z-]+)'|[^)]*\?\s*'([a-z-]+)'\s*:\s*'([a-z-]+)')/);
  if (!m) { noIcon.push(c); continue; }
  for (const name of [m[1], m[2], m[3]].filter(Boolean))
    if (!ALLOWED.has(name)) unknown.push({ ...c, name });
}

check(noIcon.length === 0,
      'every call site opens with an icon() the channel can read',
      noIcon.map(c => `         ${c.file}:${c.line} — ${c.arg.split('\n')[0].trim()}`).join('\n')
    + '\n         severity is DERIVED from that icon, so a message without one\n'
    + '         is shown as a success however bad the news is');

check(unknown.length === 0,
      `every icon used is one of {${[...ALLOWED].join(', ')}}`,
      unknown.map(c => `         ${c.file}:${c.line} — icon('${c.name}') is unclassified`).join('\n')
    + '\n         add it to ALLOWED here (and to WARNING if it means failure)\n'
    + '         so its severity is a decision someone made, not a default');

/* The two failure messages the app can send are the reason the whole channel
   was changed. If either stops carrying a warning icon, nothing else notices. */
for (const key of ['status.save_failed', 'status.export_failed']) {
  const site = callSites.find(c => c.arg.includes(key));
  check(site && [...WARNING].some(n => site.arg.includes(`icon('${n}')`)),
        `${key} is sent with a warning icon`,
        '         it is the message that must not remove itself');
}

console.log('\n3 · executed: what a success does, and what a failure does');

const sources = appSources();
const ctx = makeCtx({ hasId: () => true });

/* One element per id, so a class set by the app is still there when the guard
   looks — the shared stub returns a fresh object per call and would report
   every classList change as never having happened. */
const _els = new Map();
function liveEl(id) {
  const el = stubEl();
  el.id = id;
  const classes = new Set();
  el.classList = {
    add:    (...c) => c.forEach(x => classes.add(x)),
    remove: (...c) => c.forEach(x => classes.delete(x)),
    toggle: (c, on) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c))
                                         : (on ? classes.add(c) : classes.delete(c))),
    contains: c => classes.has(c),
  };
  el._classes = classes;
  return el;
}
ctx.document.getElementById = id => {
  if (!_els.has(id)) _els.set(id, liveEl(id));
  return _els.get(id);
};

/* Timers under the guard's control, so "clears itself after 2.5 s" and "does
   not" are two observable outcomes rather than two readings of the source. */
let _timers = [], _seq = 1;
ctx.setTimeout   = (fn, ms) => { const id = _seq++; _timers.push({ id, fn, ms }); return id; };
ctx.clearTimeout = id => { _timers = _timers.filter(x => x.id !== id); };
const runTimers = () => { const q = _timers; _timers = []; q.forEach(x => x.fn()); };

const errs = loadApp(ctx, sources);
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));

const flash = ctx.document.getElementById('save-status-flash');
/* The gap panel is closed for these three, so `flashSaveStatus` takes the plain
   path; section 5 opens it deliberately. */
ctx.document.getElementById('gap-panel-box').hidden = true;

const okMsg   = `<svg class="ph-icon"><use href="#ph-check-circle"/></svg> saved`;
const warnMsg = `<svg class="ph-icon"><use href="#ph-warning"/></svg> save failed`;

ctx.flashSaveStatus(okMsg);
check(flash.classList.contains('visible'), 'a success is shown');
check(!flash.classList.contains('flash-warn'), 'a success is not marked as a warning');
runTimers();
check(!flash.classList.contains('visible'),
      'a success clears itself when its timer fires');

ctx.flashSaveStatus(warnMsg);
check(flash.classList.contains('visible') && flash.classList.contains('flash-warn'),
      'a failure is shown, and marked');
check(flash.title !== '', 'a failure says it can be dismissed (title is set)');
runTimers();
check(flash.classList.contains('visible'),
      'A FAILURE DOES NOT EXPIRE — it is still on screen after the timers run',
      '         this is the whole of L-038: an app that unsays "save failed"\n'
    + '         after 2.5 s has told the annotator nothing');

/* Replacement is the other way out, and it must clear the warning marking or
   the next success inherits the red. */
ctx.flashSaveStatus(okMsg);
check(!flash.classList.contains('flash-warn'),
      'a later success replaces the failure and drops the warning marking');
runTimers();

console.log('\n4 · executed: the history is kept, capped, and newest first');

check(typeof ctx.outcomeHistory === 'function',
      'outcomeHistory() is the way in — the list itself is not global');

const before = ctx.outcomeHistory().length;
ctx.flashSaveStatus(warnMsg);
const first = ctx.outcomeHistory()[0];
check(ctx.outcomeHistory().length === before + 1, 'each outcome is recorded once');
check(first && first.warn === true, 'a failure is recorded as a failure');
check(first && first.at instanceof Date || (first && first.at && first.at.getHours),
      'each entry carries the time it was said');

for (let i = 0; i < 80; i++) ctx.flashSaveStatus(`${okMsg} ${i}`);
const capped = ctx.outcomeHistory();
check(capped.length <= 40,
      `the history is capped (${capped.length} after 80 more outcomes)`,
      '         uncapped, a long session grows a list of messages that name forms');
check(/79/.test(capped[0].html),
      'newest first — the most recent outcome is at the top',
      '         the panel renders the list in order and does not sort it');

console.log('\n5 · executed: the panel is a live view, not a snapshot');

/* Opening the panel and then saving must move the panel's count. The wiring is
   inside flashSaveStatus (`renderGapPanel` when the box is open), which is the
   kind of call that is easy to write and never exercise. */
ctx.document.getElementById('gap-panel-box').hidden = false;
let rendered = 0;
const realRender = ctx.renderGapPanel;
ctx.renderGapPanel = function () { rendered++; return realRender.apply(this, arguments); };
let threw = null;
try { ctx.flashSaveStatus(okMsg); } catch (err) { threw = err; }
check(threw === null, 'flashSaveStatus survives redrawing the open panel',
      threw ? `         ${threw.message}` : '');
check(rendered === 1, 'the open panel is redrawn when something happens');

ctx.renderGapPanel = realRender;
ctx.document.getElementById('gap-panel-box').hidden = true;
rendered = 0;
ctx.renderGapPanel = function () { rendered++; return realRender.apply(this, arguments); };
ctx.flashSaveStatus(okMsg);
check(rendered === 0, 'a closed panel is not redrawn');
ctx.renderGapPanel = realRender;

/* The rendered fold, from the real function, with the real list behind it.
   The warning goes in HERE and not earlier: the 80 successes above pushed the
   section-3 failure past the cap, and asserting `oc-warn` against a window that
   no longer holds one would have been a guard measuring its own setup. */
ctx.document.getElementById('gap-panel-box').hidden = false;
ctx.flashSaveStatus(warnMsg);
const foldHtml = String(ctx._outcomeHistoryHtml());
check(/<details class="gq-fold oc-fold">/.test(foldHtml),
      'the history renders as a collapsed <details>',
      '         the panel is a working surface; an expanded history would push\n'
    + '         the queue off the screen');
check((foldHtml.match(/class="oc-row/g) || []).length === ctx.outcomeHistory().length,
      'every recorded outcome has a row');
check(/oc-warn/.test(foldHtml), 'a failure is marked in the history too');

/* The count in the summary is read from the source and the locale rather than
   the rendered string: the stub has no fetch, so `t()` returns the key and the
   substitution never happens here. Asserting on the render would be asserting
   on the stub. */
check(/gap\.outcomes',\s*\{\s*n:\s*rows\.length\s*\}/.test(htmlSrc),
      'the summary is given the count',
      '         `t(\'gap.outcomes\', { n: rows.length })`');
check(/"gap\.outcomes":\s*"[^"]*\{n\}/.test(read('resources/locale/en.json')),
      'the locale string has somewhere to put it',
      '         a key that drops {n} makes the fold unreadable without opening it,\n'
    + '         which is the one thing a collapsed history must not require');

console.log('\n6 · the history goes nowhere — PRACTICES §9');

/* Several of these messages name forms ("linked 4 · sonra"), and annotation
   content is never logged. An absence cannot be executed, so this is read. */
const persisters = [];
for (const [file, body] of [['LingCoT.html', htmlSrc], ...moduleFiles()]) {
  const src = decomment(body);
  for (const m of src.matchAll(/(_outcomes|outcomeHistory\(\))/g)) {
    const around = src.slice(Math.max(0, m.index - 200), m.index + 200);
    if (/write_file|writeFile|localStorage|sessionStorage|logEvent|appendLog|journalPush|fetch\(/.test(around))
      persisters.push(`${file}: …${around.replace(/\s+/g, ' ').slice(150, 260)}…`);
  }
}
check(persisters.length === 0,
      'the outcome list is never written to disk, storage, or the journal',
      persisters.map(s => `         ${s}`).join('\n'));

check(/const _outcomes = \[\]/.test(read('modules/events.js')),
      'the list is a module-scope const, not on window',
      '         reachable only through outcomeHistory(), so there is one reader');

console.log('\n7 · dismissal is offered only where it is meant');

const listener = htmlSrc.match(
  /getElementById\('save-status-flash'\)\?\.addEventListener\('click',[\s\S]{0,300}?\n  \}\);/);
check(!!listener, 'the flash has a click listener');
check(listener && /classList\.contains\('flash-warn'\)/.test(listener[0]),
      'it dismisses only a warning',
      '         an ordinary outcome must not be dismissible: it dismisses itself,\n'
    + '         and a click that sometimes does nothing teaches nothing');
check(/#save-status-flash\.flash-warn\s*\{[^}]*pointer-events:\s*auto/.test(read('LingCoT.css')),
      'only a warning takes pointer events',
      '         otherwise the cursor promises a click that will not fire');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
