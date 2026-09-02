/*
  =============================================================================
  Linguistic Corpus Toolkit (LingCoT), dev/tests/id_sort_test.js
  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
  =============================================================================

  D33's id-sort guard, written at D50 stage 4d because D33's own trigger for
  writing it has been met (L-015).

  THE INVARIANT: nothing sorts records by `.id`.

  Ids in this corpus encode position — `doc_1787.sec_001.p_001.s_001.w_001` —
  but ARRAY POSITION is ground truth, and the two diverge the moment anything is
  inserted or reordered. A sentence added between s_001 and s_002 gets an id
  ending s_013, and sorting by id then puts it at the end of the paragraph
  rather than where it is. The data would not be wrong; the display would be,
  silently, and only for corpora that had been edited.

  D33 said to write this guard when a SECOND sort site appeared. Two
  variable-key comparators now exist — `_getDictSorted` sorts by `a[_dictSort]`
  and `renderAnnotatorsView` by `a[_annViewSort.col]` — and both take their key
  from a `data-` attribute in rendered markup. So the rule stopped being a pin
  with no violations and became one key assignment away from one.

  Two checks, because a variable-key comparator cannot be read off its own body:
    1. no comparator names `.id` as its sort key
    2. no markup can hand one the string 'id'

  This is a prerequisite of the line-oriented format (DEV_PLAN §D50, "deliberately
  not in this migration"): flattening makes parents hold child id LISTS, and an
  id list whose order is meaningful is exactly the trap above.
  ============================================================================= */

const { read, decomment, moduleFiles, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok && detail) console.log(detail);
  ok ? pass++ : fail++;
};

console.log('\nD33 / L-015 — nothing sorts by id\n');

const sources = [['LingCoT.html', decomment(read('LingCoT.html'))]]
  .concat(moduleFiles().map(([f, src]) => [f, decomment(src)]));

/* ── 1. comparators ────────────────────────────────────────────────────────
   Take the text of every `.sort(` call up to its matching close paren, so a
   multi-line comparator is read whole rather than one line at a time. */
function sortBodies(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf('.sort(', i)) !== -1) {
    let depth = 0, j = i + 5, inStr = false, q = '', esc = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === q) inStr = false;
      } else if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; }
      else if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    out.push([i, src.slice(i, j)]);
    i = j;
  }
  return out;
}

{
  const offenders = [];
  let total = 0;
  for (const [file, src] of sources) {
    for (const [at, body] of sortBodies(src)) {
      total++;
      /* `.id` read as the VALUE being compared. `a.id === x` is an equality
         test, not a sort key, and appears legitimately inside comparators that
         break ties on identity — so the pattern requires the read to reach a
         comparison operator or a localeCompare, not merely to appear. */
      const hit = /\b[a-z]\.id\b\s*(?:[<>]|-\s*[a-z]\.id|\.localeCompare)/i.exec(body)
               || /\breturn\s+[a-z]\.id\b/i.exec(body)
               || /\[['"]id['"]\]\s*(?:[<>]|\.localeCompare)/.exec(body);
      if (hit) {
        const line = src.slice(0, at).split('\n').length;
        offenders.push(`         ${file}:${line}  ${hit[0]}  in  ${body.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
  }
  check(total > 10, `${total} sort call(s) found to check`,
        '         too few: the scan is not reaching the source it claims to read');
  check(offenders.length === 0,
        'no comparator sorts by .id',
        offenders.join('\n') + '\n         Ids encode position; array position is ground truth. '
        + 'Sorting by id reorders an edited corpus silently.');
}

/* ── 2. what can reach a variable-key comparator ───────────────────────────
   Both comparators read `a[<key>]` where the key comes from a `data-` attribute
   the app renders. So the question is not what the comparator says, it is which
   strings the markup can put in front of it. */
{
  const html = decomment(read('LingCoT.html'));
  const parts = decomment(read('modules/participants.js'));

  // The dictionary browse columns: data-sort-col="${c.key}", keys from COLS.
  const colsBlock = /const COLS = \[([\s\S]*?)\n  \];/.exec(html);
  check(!!colsBlock, 'found the dictionary browse column list');
  const dictKeys = colsBlock
    ? [...colsBlock[1].matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]) : [];
  check(dictKeys.length >= 5, `it declares ${dictKeys.length} sortable column(s)`);
  check(!dictKeys.includes('id'),
        'and none of them is id, so a header click cannot set _dictSort to it',
        `         columns: ${dictKeys.join(', ')}`);

  /* Both participant views: data-psort="${col}", every col passed to
     participantTh(). B-115 (v3.14.309) gave the sources table the same sort, so
     this list covers two tables rather than one — and it covers them because
     they go through one emitter, which is the check immediately below. */
  const annKeys = [...parts.matchAll(/participantTh\(_\w+, '([^']+)'/g)].map(m => m[1]);
  check(annKeys.length >= 7, `the participant views declare ${annKeys.length} sortable column(s)`);
  check(!annKeys.includes('id'),
        'and none of them is id either',
        `         columns: ${annKeys.join(', ')}`);

  /* Any OTHER emission of these attributes — a literal in static markup, a
     second templated site — would bypass both lists above. There should be
     exactly one emitter each. */
  for (const [attr, src, file] of [['data-sort-col', html, 'LingCoT.html'],
                                   ['data-psort', parts, 'modules/participants.js']]) {
    const sites = [...src.matchAll(new RegExp(attr + '="([^"]*)"', 'g'))];
    check(sites.length === 1,
          `${attr} is emitted in exactly one place (${file})`,
          `         ${sites.length} site(s): ${sites.map(m => m[0]).join(' | ')}\n`
          + '         A second emitter is a second vocabulary, and only one of them is checked above.');
    check(sites.length === 1 && /^\$\{/.test(sites[0][1]),
          `and it is templated from the column list, not a literal`,
          `         got ${sites.length ? sites[0][0] : '(none)'}`);
  }
}

/* ── 3. nothing reads structure out of an id ───────────────────────────────
   B-135, decided v3.14.258. An id is an identity, not a path. It looks
   structural, and six sentences in the live corpus have ids naming a paragraph
   they are not in, because `saveSection` reuses sentence objects across a
   re-parse to preserve their annotations. That is correct: `word.head`, the
   journal and every by-id map hang off ids, so renaming one to keep up
   appearances would break real references.

   Which makes "never parse a parent out of an id" a rule the code has to keep.
   The shapes that would break it are splitting an id and taking anything but
   the last component, or matching a level component out of the middle. */
{
  const ALLOWED = ['depLocalId'];   // takes the LAST component, to shorten a head for display
  const offenders = [];

  for (const [file, src] of sources) {
    let fn = '';
    src.split('\n').forEach((L, i) => {
      const d = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(L)
             || /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.exec(L);
      if (d) fn = d[1];
      if (ALLOWED.includes(fn)) return;

      /* `id.split('.')` indexed by anything other than the last element, or
         sliced to drop the tail — both are reading structure. `.pop()` and
         `.at(-1)` are the last component and are fine. */
      const split = /\b(?:id|Id)\b[^\n;]{0,30}\.split\(\s*['"]\.['"]\s*\)\s*(\[\s*\d|\.slice\(|\.shift\(|\[\s*0\s*\])/.exec(L);
      if (split) offenders.push(`         ${file}:${i + 1}  in ${fn || '(top level)'}  ${L.trim().slice(0, 84)}`);

      /* A regex pulling a named level out of an id. */
      const lvl = /\.(?:match|exec|replace)\([^)]*(?:sec_|p_|s_|w_|m_)\\?\.?[^)]*\)/.exec(L);
      if (lvl && /\bid\b/i.test(L))
        offenders.push(`         ${file}:${i + 1}  in ${fn || '(top level)'}  ${L.trim().slice(0, 84)}`);
    });
  }
  check(offenders.length === 0,
        'nothing parses a parent or a level out of an id',
        offenders.join('\n')
        + '\n         Ids are identities (B-135). Array position is ground truth for parentage;\n'
        + '         walk the tree, or use S.sentById / S.wordById. depLocalId is the one\n'
        + '         allowed reader and it takes only the last component.');
}

/* The decision has to be findable by someone reading a corpus file, since the
   ids are what they will see and the appearance is the misleading part. */
{
  const html = read('LingCoT.html');
  check(/IDS ARE OPAQUE/.test(html),
        'the SCHEMA block states the rule');
  check(/ARRAY POSITION is ground truth/.test(html),
        'and says what is authoritative instead');
  const rm = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'samples', 'README.md'), 'utf8');
  check(/opaque/i.test(rm) && /B-135/.test(rm),
        'and samples/README.md tells a corpus consumer, who cannot read the source',
        '         the published corpus is where this matters most: an id is a citation handle');
}

/* The divergence must announce itself where it is created. It took a full
   integrity sweep to find the six that already exist — and a second sweep, of
   `turkish-test` at v3.14.376, to find that the section MERGE was making the
   same divergence one level up and saying nothing (B-198). So this asks it of
   EVERY structural edit that can move a child, found by what they do, rather
   than of the one path that happened to be written first. */
{
  const html = decomment(read('LingCoT.html'));
  check(/_reparented/.test(html),
        'saveSection records a sentence whose id now names another parent');
  check(/function reportReparented/.test(html),
        'and there is ONE reporter for it',
        '         two writers of one statement is how they come to disagree\n'
      + '         about what they are reporting (PRACTICES §4)');
  check(/logEvent\('info', `\$\{kind\} ids now name a former parent`/.test(html),
        'and logs it, so the next one is visible on the day it happens',
        '         info, not warn: nothing is wrong. The alternative would break references');

  /* DERIVED. Every structural edit that can move a child under a new parent has
     to reach the reporter. Found by what they do — a save handler that
     concatenates or re-groups a child array — so the next one is covered without
     an edit here. `saveDocument` is the one this check was written for: it
     concatenated paragraphs into the surviving section and reported nothing, and
     the divergence it made was found by a sweep of the file months later, which
     is exactly the outcome the comment beside `saveSection` names. */
  const MOVERS = ['saveSection', 'saveDocument'];
  for (const fn of MOVERS) {
    const body = (html.match(new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n\\}`)) || [''])[0];
    check(body.length > 0, `${fn} found`);
    check(/reportReparented\(/.test(body),
          `${fn} reports a child it has given a new parent`,
          '         it moves children between containers and keeps their ids,\n'
        + '         which is right (B-135) — but a silent divergence is one\n'
        + '         nobody finds until an integrity sweep months later');
  }

}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
