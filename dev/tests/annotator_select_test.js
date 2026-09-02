#!/usr/bin/env node
/* =============================================================================
   annotator_select_test.js, selecting an annotator writes both halves
   Run:  node dev/tests/annotator_select_test.js
   =============================================================================
   B-095. Selection lives in two places and both must be written:

     _activeAnnotatorId          the session's answer
     #edit-annotator .value and its data-ann-id   what readAnnotator() consults

   Writing only the first does not select anybody. It is worse than that: an
   empty bar is read by readAnnotator as an explicit deselection, and the
   emptiness is written back over the variable. So the auto-select applied when
   the first annotator was created was undone before it could be used, and the
   annotator had to be picked a second time from a list of one.

   The guard is an inventory. Every assignment to `_activeAnnotatorId` outside
   the two functions that own the pairing is a place where the two halves can
   drift again.
   ============================================================================= */

const { read, fnSrc, decomment, moduleFiles } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html  = read('LingCoT.html');
const parts = read('modules/participants.js');
const files = { 'LingCoT.html': html, ...Object.fromEntries(moduleFiles()) };

/* -- 1. one function owns the pairing ------------------------------------- */
check(/function selectAnnotator\s*\(/.test(parts), 'selectAnnotator() is defined');

const sel = (() => {
  const i = parts.indexOf('function selectAnnotator(');
  let d = 0, st = parts.indexOf('{', i);
  for (let k = st; k < parts.length; k++) {
    if (parts[k] === '{') d++;
    else if (parts[k] === '}' && --d === 0) return parts.slice(i, k + 1);
  }
  return '';
})();

check(/_activeAnnotatorId\s*=\s*ann\.id/.test(sel), 'it writes the session state');
check(/\.value\s*=\s*displayName\(ann\)/.test(sel), 'and the bar input the annotator reads');
check(/dataset\.annId\s*=\s*ann\.id/.test(sel),
      'and the data-ann-id readAnnotator() actually consults',
      'the visible name without the id leaves the bar looking right and reading empty');
check(/if \(el\)/.test(sel) || /el\s*&&/.test(sel),
      'and tolerates the bar being absent, which it is at load time');

/* -- 2. nobody else sets the active annotator ----------------------------- */
{
  const OWNERS = ['selectAnnotator', 'readAnnotator'];   // the pairing, and the deselect path
  /* Both the function marks and the assignments have to come from the SAME
     string: decomment() collapses block comments, so an index taken from the
     raw text does not name the right function in the stripped one. */
  const bare  = decomment(parts);
  const marks = [...bare.matchAll(/^function (\w+)/gm)];
  const ownerAt = idx => {
    let last = null;
    for (const m of marks) { if (m.index > idx) break; last = m[1]; }
    return last;
  };
  const writers = new Set(
    [...bare.matchAll(/_activeAnnotatorId\s*=[^=]/g)].map(m => ownerAt(m.index))
  );
  const stray = [...writers].filter(w => !OWNERS.includes(w));
  check(stray.length === 0,
        `${writers.size} function(s) in participants.js set the active annotator, all of them own the pairing`,
        `also set by: ${stray.join(', ')}`);
}
{
  /* LingCoT.html may only reset it (closing a corpus). Anything that SELECTS
     must go through selectAnnotator, or it repeats B-095. */
  const assigns = [...decomment(html).matchAll(/_activeAnnotatorId\s*=\s*([^;\n]+)/g)]
    .map(m => m[1].trim())
    .filter(v => !/^''$/.test(v) && !/^""$/.test(v));
  check(assigns.length === 0,
        'nothing outside participants.js selects an annotator directly',
        `found: ${assigns.join(' | ')}`);
}

/* -- 3. the two creation routes differ, on purpose ------------------------ */
{
  const show = fnSrc('modules/participants.js', 'showAnnModal');
  check(/select\s*=\s*false/.test(show),
        'showAnnModal takes a select flag, defaulting to not selecting');
  check(/_annModalSelect\s*=\s*!!select \|\| !!onSaved/.test(show),
        'and the first-use guard counts as a reason to select',
        'the guard exists precisely because nobody is selected yet');

  const save = fnSrc('modules/participants.js', 'saveAnnModal');
  check(/_annModalSelect && !_activeAnnotatorId/.test(save) && /selectAnnotator\(newAnn\)/.test(save),
        'a new annotator is selected only when asked for, and never over one already chosen');

  /* Opened from the picker: the point of creating them was to use them.
     Opened from the Annotators view: that is roster upkeep. */
  check(/showAnnModal\(null, null, true\)/.test(html),
        'the picker panel asks for the new annotator to be selected');
  const events = files['events.js'] || '';
  check(/ann-add-new[\s\S]{0,200}?showAnnModal\(null, null\)/.test(events),
        'the Annotators view does not, because adding a colleague is not becoming them');
}

/* ── B-054: an id is the next FREE number, never the count ──────────────────
   `annotator_id` is stamped into provenance on every annotated object, so a
   minted duplicate silently reattributes somebody's work to another person.
   That makes this the most expensive quiet failure in the app, and it was one
   `.length` away in two places.

   Executed rather than read: "does it collide" is arithmetic, and the two ways
   it broke (a spliced array, and ids that were never contiguous) are both
   states rather than syntax. */
{
  const partSrc = Object.fromEntries(moduleFiles())['participants.js'] || '';
  const src = /function nextParticipantId[\s\S]*?\n}/.exec(partSrc);
  check(!!src, 'nextParticipantId() is defined');
  const next = new Function(`${src[0]}\nreturn nextParticipantId;`)();

  check(next([], 'ann') === 'ann_001', 'the first id in an empty list is 001');
  check(next([{ id: 'ann_001' }, { id: 'ann_002' }], 'ann') === 'ann_003',
        'a contiguous list continues');

  /* The two failure modes B-054 named. Neither needs a delete to have happened:
     the second is just a file somebody edited or merged. */
  check(next([{ id: 'ann_001' }, { id: 'ann_003' }], 'ann') === 'ann_004',
        'a GAP does not mint a duplicate of the id above it',
        'length + 1 gives ann_003 here, which already exists');
  check(next([{ id: 'ann_003' }], 'ann') === 'ann_004',
        'and neither does a list whose only member is not ann_001',
        'this is what a spliced array looks like afterwards');

  /* An id that is not this app's convention is somebody else's, and must not
     drag the maximum down to zero. */
  check(next([{ id: 'imported-kx' }, { id: 'ann_002' }], 'ann') === 'ann_003',
        'an id outside the pattern is ignored rather than counted');
  check(next([{ id: 'imported-kx' }], 'ann') === 'ann_001',
        'a list of only foreign ids still starts at 001');
  check(next([{}, { id: null }, { id: 'ann_001' }], 'ann') === 'ann_002',
        'a record with no id at all does not throw');

  check(next([{ id: 'ann_999' }], 'ann') === 'ann_1000',
        'the series grows past 999 rather than truncating');
  check(next([{ id: 'src_001' }], 'src') === 'src_002', 'the same rule serves sources');
  check(next([{ id: 'src_009' }], 'ann') === 'ann_001',
        'and the prefixes do not see each other');

  /* Neither call site may go back to counting. */
  const ps = decomment(partSrc);
  check(!/S\.annotators\.length \+ 1|S\.sources\.length \+ 1/.test(ps),
        'neither call site derives an id from the array length',
        'that is B-054 exactly');
  check((ps.match(/nextParticipantId\(/g) || []).length === 3,
        'one definition, two callers',
        'a third minting site would be a third chance to get this wrong');
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
