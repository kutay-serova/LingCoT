#!/usr/bin/env node
/* =============================================================================
   dep_root_test.js, "root" is derived from head === null, never stored
   Run:  node dev/tests/dep_root_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   B-015 (2026-08-24). DEV_PLAN's D25 schema said `dep_rel` carries `"root"` on
   the root token. No root token in any corpus did: 3 of 3 in `ucak` had
   `head: null` and no `dep_rel`, because nothing ever wrote it.

   Two coherent resolutions existed, store it and migrate, or derive it and
   correct the doc. Derive won, on the project's own G28 principle: `head === null`
   already determines rootness, so a stored `dep_rel: "root"` would be a second
   source of truth for one fact and could drift out of agreement with `head`
   after a later edit.

   That decision only holds if it is enforced in three places at once, which is
   what this checks:

     1. Something DERIVES it, depRelOf() returns 'root' for head === null, so
        the value exists for every reader that needs it. A CoNLL-U exporter in
        particular must have it: the format requires DEPREL=root where HEAD=0,
        and it is nowhere in the stored data.
     2. Nothing STORES it, the editor's read-back normalises a typed "root" on
        a root token away instead of persisting it.
     3. Readers go THROUGH the helper rather than touching `w.dep_rel` raw, or
        the derived value silently disappears at that call site.

   Plus a data check: no corpus on disk carries the redundant field.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { requireCorpusDir, loadCorpus } = require('./_fixture.js');

const { ROOT, SRC } = require('./_source.js');
const html = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Returns '' rather than throwing when a function is absent. A guard that dies
   on the very condition it is testing for reports nothing about the checks that
   follow, and "absent" is exactly the pre-fix state this must describe. */
function extract(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) return '';
  let depth = 0;
  for (let j = html.indexOf('{', start); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(start, j + 1);
  }
  return '';
}

/* ── 1. It is derived ─────────────────────────────────────────────────────── */
console.log('\n"root" is derived from head === null\n');
{
  const src = extract('depRelOf');
  if (!src) {
    check(false, 'depRelOf() exists',
          '         no depRelOf() in LingCoT.html — nothing derives "root", so a\n' +
          '         CoNLL-U exporter would emit an empty DEPREL for every root.');
  }
  const depRelOf = src ? new Function(`${src}; return depRelOf;`)() : () => '';

  check(depRelOf({ head: null }) === 'root',
        'head === null derives "root", with nothing stored');
  check(depRelOf({ head: 'w_003', dep_rel: 'nsubj' }) === 'nsubj',
        'a stored relation is returned unchanged');
  check(depRelOf({}) === '',
        'an unassigned token derives nothing');
  check(depRelOf({ head: 'w_003' }) === '',
        'a head with no relation derives nothing — head alone is not a relation');
  check(depRelOf(null) === '',
        'a missing word does not throw');
  /* head === null must win: it is the authoritative fact, and a stale stored
     value must never be able to contradict it. */
  check(depRelOf({ head: null, dep_rel: 'nsubj' }) === 'root',
        'head === null outranks a stale stored relation');
}

/* ── 2. It is never stored ────────────────────────────────────────────────── */
console.log('\n…and never written back');
{
  const reader = extract('_depReadEditor');
  check(/relIsDerivedRoot/.test(reader),
        'the editor read-back recognises a typed "root" on a root token');
  check(/head === null && relVal\.toLowerCase\(\) === 'root'/.test(reader),
        'matched case-insensitively against head === null, not by string alone');
  check(/if \(relVal && !relIsDerivedRoot\) w\.dep_rel = relVal;/.test(reader),
        'and drops it rather than persisting it');
}

/* ── 3. Readers use the helper ────────────────────────────────────────────── */
console.log('\nreaders go through depRelOf(), not raw w.dep_rel');
{
  const arcData = extract('_depArcData');
  check(/depRelOf\(w\)/.test(arcData),
        'the arc diagram reads through depRelOf()');
  check(!/w\.dep_rel\s*\|\|\s*''/.test(arcData),
        'and no longer reads w.dep_rel raw');

  /* The schema comment must state the rule, or the next person stores it again. */
  check(/"root" is DERIVED from head === null and is\s*\n?\s*\*?\s*NEVER STORED/.test(html)
        || /NEVER STORED/.test(html),
        'the schema block records that "root" is derived, never stored');
}

/* ── 4. No corpus carries the redundant field ─────────────────────────────── */
console.log('\nno corpus on disk stores a redundant "root"');
{
  const corporaDir = requireCorpusDir('stored "root" values on disk');
  const offenders = [];
  let rootTokens = 0, files = 0, heads = 0, depRels = 0, parsedSents = 0;

  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.jsonl') && !/dict|participant|journal/.test(e.name)) {
        files++;
        /* B-128: the shared loader. This used to be a private parse whose
           fallback was `catch { return; }` — an unreadable corpus counted as a
           clean one, which is the same fault that let this guard pass on no
           data at all before v3.14.79. The loader fails instead. It also lifts
           the leading prov_events record, which this walk would otherwise have
           read `.sections` off. */
        const docs = loadCorpus(p, 'stored "root" values on disk').items;
        for (const d of docs)
          for (const sec of d.sections || [])
            for (const para of sec.paragraphs || [])
              for (const s of para.sentences || []) {
                if ((s.words || []).some(w => 'head' in w)) parsedSents++;
                for (const w of s.words || []) {
                  /* B-125: count the parses, not just the roots. `head === null`
                     is a root, but so is a word that has no dependency parse at
                     all — the key is simply absent. The two were indistinguishable
                     to the old count, which is why a corpus with no parses
                     reported "0 root tokens" and passed. */
                  if ('head' in w) heads++;
                  if (w.dep_rel) depRels++;
                  if (w.head === null) {
                    rootTokens++;
                    if (w.dep_rel) offenders.push(`${e.name}  ${w.id}  dep_rel=${w.dep_rel}`);
                  }
                }
              }
      }
    }
  };
  walk(corporaDir);

  /* Zero files used to print "0 root token(s) across 0 corpus file(s)" and pass.
     After the corpora moved to ~/LingCoT/ that became the live state of the
     suite: a guard reporting success having read nothing. requireCorpusDir()
     now exits before this point when there is no data, and this assertion
     covers the remaining case, a directory that exists but holds no corpus. */
  check(files > 0, 'found at least one corpus file to check',
        '         a walk over zero files cannot fail, so passing would mean nothing');

  check(offenders.length === 0,
        `${rootTokens} root token(s) across ${files} corpus file(s), none storing dep_rel`,
        offenders.map(o => '         ' + o).join('\n'));

  /* ── B-125 ────────────────────────────────────────────────────────────────
     The check above is about what a root must NOT store. It says nothing about
     whether any root was seen, so it reported "0 root token(s)" on a corpus with
     no dependency parses and passed — the degenerate pass `samples/README.md`
     records this guard as having been fixed to prevent, arriving one level up.

     This matters at the fixture swap: `samples/` holds the suite's ONLY
     dependency coverage (13 `head`, 10 `dep_rel`), and the live corpus has zero
     of either. Swapping without this assertion would delete that coverage in
     silence, with every guard still green.

     A FAILURE, not a disable: unlike a golden-value guard aimed at one language,
     this one checks an invariant every corpus must satisfy, and the fixture set
     having no parse to check it against is a gap in the fixture set. */
  check(heads > 0,
        `the fixture set actually has dependency parses to check `
        + `(${heads} head, ${depRels} dep_rel, across ${parsedSents} parsed sentence(s))`,
        '         ZERO parses. Every assertion above passed by walking nothing that could fail.\n'
        + '         A corpus with no dependency parse is not a corpus this guard can check:\n'
        + '         `head === null` means "root", and an ABSENT head means "never parsed",\n'
        + '         and counting only roots cannot tell them apart.\n'
        + '         The replacement corpus needs hand-annotated parses before the swap.');
  check(depRels > 0,
        `and dep_rel labels on ${depRels} of them, so the no-dep_rel-on-a-root rule has something to be true of`,
        '         a rule about what roots must not store is vacuous when nothing stores a relation');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
