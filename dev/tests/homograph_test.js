#!/usr/bin/env node
/* =============================================================================
   homograph_test.js, the discriminator that lets two entries share a form
   Run:  node dev/tests/homograph_test.js
   =============================================================================
   D35 stage A1. Two dictionary entries may spell the same thing and be different
   words. The number that tells them apart is STORED, not derived from position,
   because a citation is only worth writing down if it stays true after a sibling
   is deleted.

   Three properties are worth guarding, and each has already been got wrong in
   some form elsewhere in this codebase:

     1. every path that creates a dictionary entry numbers it. Three separate
        places in this app build and index an entry, and D35 stage B adds more.
        A creation path that skips the call leaves a homograph pair unnumbered,
        which looks exactly like a duplicate.
     2. a number, once assigned, is never taken away or reassigned. That is what
        distinguishes a citation from a row index.
     3. a lone form gets no number, so the field stays out of the file for the
        overwhelming majority of entries and the display stays clean.

   The numbering function is also executed here against a small fake dictionary,
   because reading it cannot show that the third entry for a form gets 3.
   ============================================================================= */

const { read, fnSrc, decomment } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html = read('LingCoT.html');
const src  = decomment(html);

/* ── 1. the pieces exist ─────────────────────────────────────────────────── */
for (const fn of ['assignHomographs', 'homographSiblings', 'homographSup'])
  check(new RegExp(`function ${fn}\\s*\\(`).test(html), `${fn}() is defined`);

/* ── 2. every entry-creation path numbers ─────────────────────────────────────
   An entry becomes visible to the rest of the app when it is pushed into
   S.dictionary. Each such push must be followed by a numbering call within the
   same function, or a homograph pair can exist unnumbered. */
/* v3.14.270: there is exactly ONE such site. This asked for two or more, which
   was the right shape while `saveNewDictEntry` and `_pushTokenToDict` each
   pushed their own; D51 collapsed them into `_indexDictEntry`, and one path is
   the strongest version of this claim rather than a weaker one. Pinned at
   exactly one, so a second creation path fails here instead of shipping
   unnumbered. */
const pushes = [...src.matchAll(/S\.dictionary\.push\((\w+)\)/g)];
check(pushes.length === 1,
      `exactly one S.dictionary.push site (${pushes.length}), so one place numbers`,
      'a second creation path is how a homograph pair ends up looking like a duplicate');
for (const m of pushes) {
  const name = m[1];
  const after = src.slice(m.index, m.index + 1200);
  /* Lemmas are not dictionary entries in the D35 model and are never numbered:
     a citation form names a group, and two groups with the same citation form
     are the same group. */
  const isLemma = /type:\s*'lemma'/.test(src.slice(Math.max(0, m.index - 900), m.index));
  if (isLemma) { check(true, `push of ${name} is a lemma, correctly not numbered`); continue; }
  check(new RegExp(`assignHomographs\\(${name}\\.form\\)`).test(after),
        `the entry pushed as ${name} is numbered`,
        'a creation path that skips assignHomographs leaves a pair looking like a duplicate');
}

/* ── 3. the number is never removed or overwritten ───────────────────────────
   Reassignment is the failure D35 rejected explicitly: deriving the number from
   bucket order renumbers the survivors when a sibling is deleted. */
/* v3.14.290: the rule moved into `_numberBucket` so the load pass and the
   per-entry call could not disagree about it. This reads the rule wherever it
   lives; `assignHomographs` is now the caller that supplies one form's bucket. */
const body = fnSrc('LingCoT.html', '_numberBucket') || '';
check(/if \(!e\.homograph\)/.test(body),
      'assignHomographs only fills an unset number',
      'an unconditional write would renumber entries that have already been cited');
check(!/delete\s+\w+\.homograph/.test(src),
      'nothing deletes a homograph number');

/* ── 4. a lone form is left unnumbered ───────────────────────────────────── */
check(/sibs\.length < 2/.test(body) || /length\s*<\s*2/.test(body),
      'a form with one entry is left without a number');

/* ── 4b. B-143: LOADING is not creating ──────────────────────────────────────
   `assignHomographs` was called from the two paths that create or rename, and
   `buildDictIndex` — how most entries arrive — called neither. The property
   sections 1–4 assert was true and insufficient: `samples/turkish-test` carries
   `metin` twice, both NOUN, both glossed `text`, and neither ever got a number.

   Executed against the real fixture, not read, because "the call is present" is
   what section 1 already says and is not what failed. */
{
  const idx = fnSrc('LingCoT.html', 'buildDictIndex') || '';
  check(/numberAllHomographs\(\)/.test(idx),
        'buildDictIndex numbers the homographs it just indexed',
        '       B-143: an entry that arrives from a file is created by nobody');
  /* AFTER the loop: a bucket numbered while its second member is still to come
     leaves the pair looking unique, which is the defect wearing a call. */
  check(idx.indexOf('numberAllHomographs()') > idx.indexOf('S.dictByForm.get(k).push(e)'),
        'and does it after the index is complete, not inside the loop',
        '       numbering entry 1 of 2 while entry 2 is still coming numbers neither');

  const nab = fnSrc('LingCoT.html', 'numberAllHomographs') || '';
  check(/_numberBucket\(/.test(nab),
        'the load pass uses the same rule as the per-entry call',
        '       a second copy of the rule is how the first call came to be missing');

  // The property, executed: a dictionary LOADED with two same-form entries is numbered.
  const S = { dictByForm: new Map() };
  const loaded = [{ form: 'metin', type: 'word' }, { form: 'metin', type: 'bound.morpheme' },
                  { form: 'ev', type: 'word' }];
  for (const e of loaded) {
    const k = e.form;
    if (!S.dictByForm.has(k)) S.dictByForm.set(k, []);
    S.dictByForm.get(k).push(e);
  }
  const run = new Function('S', `${body}\n${nab}\nreturn numberAllHomographs();`);
  const n = run(S);
  check(n === 2, `numbering a loaded dictionary numbers the pair (${n})`);
  check(loaded[0].homograph === 1 && loaded[1].homograph === 2,
        'oldest first, so file order decides and every later load agrees',
        `       got ${loaded[0].homograph} / ${loaded[1].homograph}`);
  check(loaded[2].homograph === undefined, 'and a unique form is still left alone');
  // Idempotent: a second load must not renumber what the first stored.
  const again = run(S);
  check(again === 0 && loaded[0].homograph === 1,
        'and running it twice changes nothing — the stored number is the identity');
}

/* ── 5. the display shows it only when it exists ─────────────────────────── */
const supBody = fnSrc('LingCoT.html', 'homographSup') || '';
check(/e\.homograph/.test(supBody) && /return\s+e\s*&&\s*e\.homograph|homograph\s*\?/.test(supBody),
      'homographSup renders nothing for an unnumbered entry');
check((src.match(/homographSup\(/g) || []).length >= 5,
      'homographSup is used at the places an entry form is displayed',
      `found ${(src.match(/homographSup\(/g) || []).length} references, expected the definition plus 4 call sites`);

/* ── 6. run the numbering against a fake dictionary ──────────────────────────
   Reading cannot show that a third entry for the same form gets 3, or that a
   pre-existing number survives. */
{
  const dict = [];
  const lookupDict = form => dict.filter(e => e.form.toLowerCase() === form.toLowerCase());
  const sibBody = fnSrc('LingCoT.html', 'homographSiblings') || '';
  const asgBody = fnSrc('LingCoT.html', 'assignHomographs') || '';
  const fn = new Function('lookupDict',
    `${sibBody}\n${body}\n${asgBody}\nreturn assignHomographs;`)(lookupDict);

  const add = (form, type = 'word', homograph) => {
    const e = { form, type };
    if (homograph) e.homograph = homograph;
    dict.push(e);
    fn(form);
    return e;
  };

  const a = add('bank');
  check(a.homograph === undefined, 'the first entry for a form gets no number');

  const b = add('bank');
  check(a.homograph === 1 && b.homograph === 2,
        'the second entry numbers both siblings, oldest first',
        `got ${a.homograph} / ${b.homograph}`);

  const c = add('bank');
  check(c.homograph === 3, 'a third entry continues the sequence', `got ${c.homograph}`);

  // Deleting the middle one must not move the others.
  dict.splice(dict.indexOf(b), 1);
  fn('bank');
  check(a.homograph === 1 && c.homograph === 3,
        'deleting a sibling leaves the survivors where they were',
        `got ${a.homograph} / ${c.homograph}`);

  const d = add('bank');
  check(d.homograph === 4, 'the next entry takes the free number above the highest, not the gap',
        `got ${d.homograph}`);

  // Case and accent folding is normForm's job everywhere else; the numbering
  // must agree with whatever lookupDict considers the same form.
  const e1 = add('Bank');
  check(e1.homograph === 5, 'a case variant counts as the same form', `got ${e1.homograph}`);

  /* Lemmas are not in S.dictionary at all since D35 A2, so they cannot consume a
     number by construction. The push-site check above is what keeps that true. */
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
