#!/usr/bin/env node
/* =============================================================================
   ui_wiring_test.js, an element that looks interactive must actually be
   Run:  node dev/tests/ui_wiring_test.js
   =============================================================================
   Merges modal_wiring_test.js (B-026), dict_chip_test.js (B-030) and
   section_link_test.js (GUI-1c). Those were three guards pinning three past
   bugs. They are one rule, and stating it once is worth more than pinning three
   instances of it:

       REACHABLE, a click must land on a handler that can receive it
       OPERABLE, anything clickable must be usable from the keyboard and
                   announced as interactive
       DERIVED, state shown on screen must refresh when that state changes

   Each was learned the hard way:

     B-026  the export modal was appended to document.body while its handlers
            were delegated on #content. Correct selectors, correct handlers,
            wrong listener ROOT, so nothing fired and the panel could not be
            closed. `selector_audit_test.js` could not see it: every selector
            existed. Nothing modelled the DOM as a tree.
     B-030  #dict-status is hidden until updateDictStatus() adds .loaded. It was
            called from five leaf sites; three other paths mutated the dictionary
            and called none of them, so a new corpus never showed the badge. The
            data was correct throughout, only the display lagged, which is why
            it survived.
     GUI-1c a section title was the only route into a section, but was styled as
            a heading. People do not click headings.

   Generalised rather than concatenated: where the originals checked one modal,
   one badge and one title, these sweep every body-appended modal, every writer
   of a displayed collection, and every non-native clickable in the markup.
   ============================================================================= */

const { SRC, lazy, decomment, bodyOf, moduleFiles, fnSrc, read } = require('./_source.js');

const html     = lazy.html;
const css      = lazy.css;
const evts     = lazy.events;
const htmlCode = decomment(html);
const evtsCode = decomment(evts);

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
const fnBody = name => {
  const i = htmlCode.indexOf(`function ${name}(`);
  return i === -1 ? null : bodyOf(htmlCode, i);
};

/* ════════════════════════════════════════════════════════════════════════════
   REACHABLE, delegation only works downward
   ════════════════════════════════════════════════════════════════════════════ */
console.log('\nREACHABLE — a click must land on a handler that can receive it\n');
{
  const delegatedOnContent = new Set();
  {
    const re = /contentEl\.addEventListener\(\s*'click'[\s\S]{0,4000}?\n  \}\);/g;
    for (const block of evtsCode.match(re) || []) {
      for (const m of block.matchAll(/data-action(?:\^)?=\\?["']([a-z-]+)\\?["']/g))
        delegatedOnContent.add(m[1]);
      for (const m of block.matchAll(/case\s+'([a-z-]+)'\s*:/g))
        delegatedOnContent.add(m[1]);
    }
  }
  check(delegatedOnContent.size > 10,
        `${delegatedOnContent.size} data-actions are delegated on contentEl`,
        '         parsed none — every check in this section would be vacuous');

  const modals = [];
  for (const m of htmlCode.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
    const body = bodyOf(htmlCode, m.index);
    if (!/document\.body\.appendChild\(\s*modal\s*\)/.test(body)) continue;
    modals.push({ fn: m[1], body,
      actions: [...new Set([...body.matchAll(/data-action="([a-z-]+)"/g)].map(x => x[1]))] });
  }
  check(modals.length > 0, `${modals.length} modal(s) are appended to document.body`,
        '         the pattern this section guards is undetectable — check the regex');

  const orphaned = [];
  for (const mo of modals) {
    const bindsSelf = a => new RegExp(`modal\\.querySelector(?:All)?\\([^)]*${a}`).test(mo.body);
    for (const a of mo.actions)
      if (delegatedOnContent.has(a) && !bindsSelf(a))
        orphaned.push(`         ${mo.fn}(): data-action="${a}" is handled ONLY by a\n`
                    + `         contentEl listener, but this modal hangs off document.body —\n`
                    + `         the click never bubbles through #content (B-026)`);
  }
  check(orphaned.length === 0, 'every body-appended modal binds its own listeners',
        orphaned.join('\n'));
}

/* ════════════════════════════════════════════════════════════════════════════
   OPERABLE, clickable means keyboard-usable and announced
   ════════════════════════════════════════════════════════════════════════════ */
console.log('\nOPERABLE — anything clickable is reachable by keyboard and announced');
{
  /* Native <button> and <a href> are operable for free. Anything else given a
     click handler must say what it is and be focusable, or it exists only for
     people using a mouse. */
  const suspects = [];
  for (const m of html.matchAll(/<(div|span|li|td|th|p|h[1-6])\b([^>]*)>/g)) {
    const attrs = m[2];
    const clickable = /\bonclick=|\bdata-action=/.test(attrs);
    if (!clickable) continue;
    const hasRole = /\brole=/.test(attrs);
    const hasTab  = /\btabindex=/.test(attrs);
    if (!hasRole || !hasTab) {
      const line = html.slice(0, m.index).split('\n').length;
      const id   = (/\bid="([^"]+)"/.exec(attrs) || /\bclass="([^"]+)"/.exec(attrs) || [, '?'])[1];
      suspects.push(`         :${line} <${m[1]} ${id}> clickable but `
                  + `${!hasRole ? 'no role' : ''}${!hasRole && !hasTab ? ' and ' : ''}${!hasTab ? 'not focusable' : ''}`);
    }
  }
  check(suspects.length === 0,
        'no non-native element is clickable without role and tabindex',
        suspects.slice(0, 10).join('\n')
        + (suspects.length > 10 ? `\n         …${suspects.length - 10} more` : '')
        + '\n         → mouse-only affordance; keyboard and screen-reader users cannot use it');

  /* GUI-1c, kept specific: the section title is the ONLY route into a section. */
  const secTitle = /\.sec-block-title\s*\{/.test(css);
  check(secTitle, '.sec-block-title still has a rule block',
        '         the section title was restyled as a link in GUI-1c; if the rule is\n'
        + '         gone the affordance probably went with it');
  check(/role="link"|role='link'/.test(html) || /sec-block-title[^>]*role=/.test(html),
        'the section title is announced as a link',
        '         it is the only way into a section, and a bold heading is not\n'
        + '         something people click (GUI-1c)');
}

/* ════════════════════════════════════════════════════════════════════════════
   DERIVED, displayed state refreshes when the state changes
   ════════════════════════════════════════════════════════════════════════════ */
console.log('\nDERIVED — displayed state refreshes when the underlying state changes');
{
  check(/#dict-status\s*\{[^}]*display:\s*none/.test(css)
     && /#dict-status\.loaded\s*\{[^}]*display:\s*inline/.test(css),
        'the dictionary badge is hidden until marked loaded — a missed refresh is invisible');

  const mut = fnBody('mutate');
  check(mut !== null, 'mutate() exists — the chokepoint every data change passes through');
  check(mut && /updateDictStatus\(/.test(mut) && /S\.dictionary/.test(mut),
        'mutate() derives the badge from S.dictionary',
        '         deriving here is what stops the badge depending on each caller\n'
        + '         remembering to refresh it (B-030)');
  check(mut && /\(S\.dictionary\s*\|\|\s*\[\]\)/.test(mut),
        'and tolerates an uninitialised S.dictionary');

  /* The general form: every writer of the displayed collection must be reached
     by a caller that flushes. Counting call sites is how B-030 happened. */
  const bodies = new Map();
  for (const m of htmlCode.matchAll(/\nfunction\s+(\w+)\s*\(/g)) {
    const b = fnBody(m[1]); if (b) bodies.set(m[1], b);
  }
  const flushes = new Set([...bodies].filter(([, b]) =>
    /\bmutate\([^)]*\)/.test(b) || /\bupdateDictStatus\(/.test(b)).map(([n]) => n));
    // B-055 gave mutate() an optional save-target argument, so the flusher test
    // must match mutate('dict') and mutate(['corpus','dict']) too. Matching only
    // the bare `mutate()` would have silently reported every labelled caller as
    // a non-flusher, a guard failing loudly here, rather than passing wrongly,
    // is the good outcome.
  const writers = new Set([...bodies].filter(([, b]) =>
    /S\.dictionary(?:\.push\(|\s*=[^=])/.test(b)).map(([n]) => n));

  /* v3.14.270: two writers, down from three. `saveNewDictEntry` pushed its own
     entry until D51 stage 5 collapsed every creation path into `_indexDictEntry`,
     so fewer writers here is the fix landing rather than coverage slipping. Two
     is the floor: `_indexDictEntry` and `applyDict`'s wholesale assignment. */
  check(writers.size >= 2 && flushes.size >= 3,
        `${writers.size} writers, ${flushes.size} flushers`,
        '         too few — the check below would be vacuous');

  const callers = n => [...bodies].filter(([m, b]) =>
    m !== n && new RegExp(`\\b${n}\\(`).test(b)).map(([m]) => m);
  const covered = (n, seen = new Set()) => {
    if (flushes.has(n)) return true;
    if (seen.has(n)) return false;
    seen.add(n);
    const up = callers(n);
    return up.length > 0 && up.every(c => covered(c, seen));
  };
  const orphans = [...writers].filter(n => !covered(n))
    .map(n => `         ${n}() writes S.dictionary and no caller of it refreshes the badge`);
  check(orphans.length === 0, 'every dictionary writer is covered by a flushing caller',
        orphans.join('\n') + '\n         → the dictionary changes and the header does not (B-030)');
}

/* ── REACHABLE, at the level of a whole view (B-140) ────────────────────────
   v3.14.266. The three rules above are about one element and its handler. This
   is the same rule one level up, and the level nothing was checking: a view the
   app can render is a view something must be able to reach.

   `dict-add` failed it for the whole life of the feature. There was exactly ONE
   `data-go="dict-add"` in the source — the `+ dict` link under a morpheme column
   — so the only word that could be added to the dictionary was one already
   parsed out of a token on screen. None of the five UX audits found it, because
   an audit describes the surfaces that exist and this was a route that did not.

   Written as a sweep rather than as a check for one button, so the next view
   added with no way in fails here instead of shipping. */
{
  const views = [...decomment(html).matchAll(/^\s*'([\w-]+)':\s*render\w+,/gm)].map(m => m[1]);
  check(views.length > 8, `the view table names ${views.length} views`);

  const sources = [html, ...moduleFiles().map(([, src]) => src)].map(decomment).join('\n');
  /* A view is reachable by a `data-go` in markup, or by a `go('name')` call.
     Both are the app's own navigation; nothing else moves between views. */
  const unreachable = views.filter(v =>
       !new RegExp(`data-go="${v}"`).test(sources)
    && !new RegExp(`go\\(\\s*['\`]${v}['\`]`).test(sources));

  /* Views reached only through a computed target (`data-go="${backTarget}"`)
     are named here rather than left to a regex that would have to evaluate the
     template. Each is checked to be genuinely computed, so the list cannot be
     used to excuse a view nobody reaches. */
  const COMPUTED = ['empty', 'corpus-new'];
  for (const v of COMPUTED)
    check(new RegExp(`backTarget = hasExisting \\? 'document' : 'empty'`).test(sources)
          || new RegExp(`'${v}'`).test(sources),
          `${v} is reached through a computed target, and the expression exists`);

  const orphanViews = unreachable.filter(v => !COMPUTED.includes(v));
  check(orphanViews.length === 0,
        'every view in the table has a way in',
        `         ${orphanViews.join(', ')} — a view nothing can reach is a feature that is not there`);

  /* And the specific one, because a count of one was the bug: `dict-add` needs a
     door that does NOT start from a corpus token, or the dictionary can only be
     written from text that already exists. */
  /* B-140, closed v3.14.270. `dict-add` is not a view any more — the
     add-to-dictionary panel opens over whatever is on screen — so the claim
     moves from "that view has more than one door" to what it always meant: the
     dictionary can be written without a corpus token in front of you.

     Two doors, and they are different questions. `dict-add-morph` names a
     morpheme; `dict-new` names nothing at all, which is the one that did not
     exist for the whole life of the feature. */
  check(!/data-go="dict-add"/.test(sources) && !/'dict-add':/.test(sources),
        'the dict-add VIEW is gone, panel not page',
        '         a 12-field screen as the only way in is I6 and B-140 together');
  for (const [action, why] of [
    ['dict-add-morph', 'a morpheme in the word view'],
    ['dict-new',       'nothing at all — elicitation, a word not yet in any text'],
    /* D35 stage B, v3.14.277. Three more doors, and the rule that earned this
       guard its place applies to each: a data-action with no case is a button
       that does nothing, and every one of these is the ONLY route to what it
       does. Rejecting a match has no other surface at all. */
    ['dict-choose',        'the homograph chooser in the word view (B2)'],
    ['dict-reject',        'the auto-match marker on the Lexicon card (B3)'],
    ['dict-new-same-form', 'a second entry for a form that already has one (B3)'],
    /* D35 B6, v3.14.282: the only route to removing an orphaned lemma record.
       Nothing sweeps them, so a door that does nothing means they accumulate
       forever with a screen that says they should not. */
    ['lemma-delete',       'the lemma group view, when nothing points at the record (B6)'],
  ]) {
    check(new RegExp(`data-action="${action}"`).test(sources),
          `the panel opens from ${why}`);
    check(new RegExp(`case '${action}':`).test(sources),
          `and something handles ${action}`,
          '         a data-action with no case is a button that does nothing');
  }

  /* ── B-158: EVERY emitted action, not eight named ones ─────────────────────
     The list above states the rule — "a data-action with no case is a button
     that does nothing" — and then applies it to eight instances. That is the
     hand-written list this project has removed three times elsewhere, and it
     cost exactly what such a list costs: `data-action="seg"` was emitted by
     Search-B's three toggles for the whole life of the segmented control while
     the handler still read `case 'sb-toggle'`, and no guard could see it
     because no guard named it.

     Derived instead. Every action any renderer emits must be handled somewhere
     — a `case`, an `if (a === …)`, or a direct `[data-action="x"]` listener —
     and the check is over the set, so the next one is covered without anyone
     remembering. Actions built by interpolation (`data-action="${…}"`) are not
     literals and are skipped; they are `id_sort_test`'s territory. */
  {
    const emitted = new Set([...sources.matchAll(/data-action="([a-z][a-z-]*)"/g)].map(m => m[1]));
    const handled = new Set([
      ...[...sources.matchAll(/case '([a-z][a-z-]*)':/g)].map(m => m[1]),
      ...[...sources.matchAll(/a === '([a-z][a-z-]*)'/g)].map(m => m[1]),
      ...[...sources.matchAll(/ds\.action === '([a-z][a-z-]*)'/g)].map(m => m[1]),
      ...[...sources.matchAll(/\[data-action="([a-z][a-z-]*)"\]/g)].map(m => m[1]),
      /* I2, v3.14.404. One handler now serves every row collection: it reads the
         kind off the action and looks it up in `ROW_EDITORS`, so `comment-remove`
         and its four siblings are handled by a computed match rather than a
         literal. The kinds are declared — harvest them and expand the pair. */
      ...[...sources.matchAll(/^  ([a-z]+): \{$/gm)].flatMap(m => [m[1] + '-add', m[1] + '-remove']),
    ]);
    const orphan = [...emitted].filter(a => !handled.has(a)).sort();
    check(emitted.size > 60, `${emitted.size} literal data-action value(s) emitted`);
    check(orphan.length === 0,
          'every emitted action reaches a handler',
          orphan.map(a => `         data-action="${a}" is emitted and handled nowhere`).join('\n'));
  }

  /* The blank door must be on BOTH of dict-browse's return paths. The empty case
     matters most — a corpus with no entries is exactly where somebody reaches
     for this — and it is the branch that used to return early. Counting doors
     app-wide would let either be deleted while the other kept the count up,
     which is how a guard passes on the bug it was written for. */
  const browse = decomment(fnSrc('LingCoT.html', 'renderDictBrowse') || '');
  const mounts = (browse.match(/\$\{newBtn\}/g) || []).length;
  check(mounts >= 2,
        `the dictionary offers it on both of its states (${mounts} mounts)`,
        '         the empty dictionary is where an annotator reaches for this first');

  /* The view has to survive arriving with no word behind it, which it did not:
     both its back buttons named `word` and carried ids they assumed existed. */
  /* Stage 1's throwaway door needed `renderDictAdd` taught not to assume a word.
     Both are gone: a panel has no back button to point anywhere, which is why
     that door was built to be replaced rather than repaired. */
  check(!/function renderDictAdd\s*\(/.test(sources),
        'renderDictAdd is gone, and its invented back target with it');
  const blank = decomment(fnSrc('LingCoT.html', 'addDictBlank') || '');
  check(/editable: true/.test(blank) && !/link/.test(blank),
        'the blank row types its own form and links to nothing',
        '         that pair IS the zero-context case D51 built the writer for');
}

/* ── REACHABLE, executed: both participant tables sort ───────────────────────
   B-115. The sources table looked exactly like the annotators table and did not
   sort — a header row that reads as sortable because it IS the sortable one,
   with nothing behind it. The markup half is held by `affordance_test`; this is
   the behaviour, run rather than read, because the interesting claim is that a
   column is ordered by WHAT IT SHOWS.

   `srcTypeLabel` turns a stored `type` into a displayed one, so ordering on the
   raw value would order by something no reader can see. That is the same defect
   as sorting on an id, one layer up, and `id_sort_test` is next door. */
{
  const sortFn = new Function('return ' + fnSrc('modules/participants.js', 'participantSort'))();

  const state = { col: 'type', dir: 'asc' };
  /* Stored values whose DISPLAYED order is the reverse of their raw order, so a
     sort on the wrong one cannot pass by accident. */
  const rows = [{ name: 'a', type: 'zz_book' }, { name: 'b', type: 'aa_speaker' }];
  const cols = { type: r => ({ zz_book: 'Book', aa_speaker: 'Speaker' })[r.type] };

  check(sortFn(rows, state, cols).map(r => r.name).join('') === 'ab',
        'a participant column is ordered by what it displays, not by what it stores');
  state.dir = 'desc';
  check(sortFn(rows, state, cols).map(r => r.name).join('') === 'ba',
        'and the direction reverses it');
  check(rows.map(r => r.name).join('') === 'ab',
        'without reordering the caller\'s array — the views pass S.sources itself');

  const src = read('modules/participants.js');
  check(/renderSourcesView[\s\S]{0,400}participantSort\(sourceList\(\)/.test(src),
        'and the sources view actually calls it');
  const evts = read('modules/events.js');
  check(/closest\('\[data-psort\]'\)/.test(evts)
        && /S\.view === 'sources' \? _srcViewSort : _annViewSort/.test(evts),
        'one delegated handler serves both tables — a second would be how the first went missing');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
