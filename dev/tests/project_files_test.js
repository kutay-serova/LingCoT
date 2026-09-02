#!/usr/bin/env node
/* =============================================================================
   project_files_test.js, a project's four files are named in one place
   Run:  node dev/tests/project_files_test.js
   =============================================================================
   B-149 and B-150. The convention — `<prefix>_corpus.jsonl`, `_dictionary`,
   `_participants`, `.journal` — was spelled out in six places and no two agreed
   about every case. What made that survivable for months is that each spelling
   was right about the files its own author had in front of them.

   So this guard does three things no single-language test can:

     1. holds the JS table against the PYTHON one, literally. The convention
        crosses a language boundary; neither side can check the other, and the
        two halves drifting apart is exactly how `journalPath` came to write
        `X.jsonl.journal.jsonl` where `open_project` read `X.journal.jsonl`.
     2. round-trips every name a save dialog can offer: the opener must derive
        the same prefix back, or the file the annotator just agreed to is one
        the app cannot reopen as a project.
     3. asserts nobody ELSE spells it. A second writer of a filename is a second
        opinion about what a project is (rule 4).
   ============================================================================= */

const path = require('path');
const { read, moduleFiles, decomment, fnSrc } = require('./_source.js');
const P = require('../../source/modules/project_files.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};
const ROLES = ['corpus', 'dictionary', 'participants', 'journal'];

console.log('\nthe two halves of one convention\n');
{
  /* Parsed out of the Python source rather than imported: the app ships one
     .pyw and running it needs pywebview. A literal dict is readable without it,
     and reading it is the whole point — if this stops matching, say so. */
  const pyw = read('LingCoT.pyw');
  const blk = /_PROJECT_ROLES = \{([\s\S]*?)\}/.exec(pyw);
  check(!!blk, 'the Python half declares _PROJECT_ROLES',
        '       if this is gone the comparison below silently checks nothing');
  const py = {};
  if (blk) for (const m of blk[1].matchAll(/'([a-z]+)':\s*'([^']+)'/g)) py[m[1]] = m[2];
  check(Object.keys(py).length === ROLES.length,
        `and names all ${ROLES.length} roles (${Object.keys(py).length})`);
  for (const r of ROLES)
    check(py[r] === P.PROJECT_ROLES[r],
          `${r}: both halves say ${P.PROJECT_ROLES[r]}`,
          `       js ${P.PROJECT_ROLES[r]} · py ${py[r]} — a project written by one and read by the other`);

  // And the Python side must USE its own table, not the literals it replaced.
  const openProj = /def open_project[\s\S]*?(?=\n    def )/.exec(pyw);
  const setupDir = /def setup_corpus_dir[\s\S]*?(?=\n    def )/.exec(pyw);
  for (const [name, src] of [['open_project', openProj], ['setup_corpus_dir', setupDir]]) {
    check(!!src, `${name} is in the source`);
    if (!src) continue;
    check(/_project_file\(|_project_prefix\(/.test(src[0]),
          `${name} asks the table`,
          '       a hand-written suffix here is how the six spellings started');
    check(!/'_(corpus|dictionary|participants)\.jsonl'/.test(src[0]),
          `${name} names no role suffix of its own`);
  }
}

console.log('\nround trip: every name offered is a name the opener understands\n');
{
  /* The failing cases as they actually were, kept as data so a regression names
     the corpus it broke rather than an abstraction. */
  for (const prefix of ['chinese-test', 'chinese_test', 'my text 2', 'türkçe', '一个']) {
    const names = ROLES.map(r => P.projectFile(prefix, r));
    for (const n of names)
      check(P.projectPrefix(n) === prefix,
            `${n} → ${prefix}`,
            `       got ${P.projectPrefix(n)} — the opener would look for a different project`);
    check(new Set(names).size === ROLES.length, `${prefix}: the four names are distinct`);
  }
  /* A name with no role suffix keeps working: `open_project`'s splitext branch,
     and the reason a hand-named file still opens. */
  check(P.projectPrefix('mytext.jsonl') === 'mytext', 'a bare .jsonl name is its own prefix');
  /* The unnamed case. A fallback that is itself a role name gives
     `corpus_corpus.jsonl` — the shape `participants_participants.jsonl` had, and
     the tell that a default was being used as a name. Both halves say the same. */
  for (const r of ROLES)
    check(!P.projectFile('', r).startsWith(r),
          `an unnamed project's ${r} file is not ${r}_${r}…`,
          `       got ${P.projectFile('', r)}`);
  check(/_UNTITLED_PREFIX = '([a-z]+)'/.exec(read('LingCoT.pyw'))?.[1] === P.UNTITLED_PREFIX,
        `both halves fall back to '${P.UNTITLED_PREFIX}'`);
  check(P.projectPrefix('/a/b/chinese-test_corpus.jsonl') === 'chinese-test', 'a full path works too');
  check(P.projectSibling('/a/b/x_corpus.jsonl', 'journal') === '/a/b/x.journal.jsonl',
        'a sibling keeps the folder',
        '       B-150: the journal was written beside the corpus and read from elsewhere');
  /* B-150 exactly: the name chooseSavePath used to offer for a corpus made in
     the app, through the derivation that used to disagree with the reader. */
  check(P.projectSibling('/a/chinese_test_corpus.jsonl', 'journal') === '/a/chinese_test.journal.jsonl',
        'and the journal name matches what open_project derives');
}

console.log('\nnobody else spells it\n');
{
  const files = [['LingCoT.html', read('LingCoT.html')], ...moduleFiles()]
    .filter(([n]) => n !== 'project_files.js');
  const bad = [];
  for (const [name, src] of files)
    for (const m of decomment(src).matchAll(/'_(corpus|dictionary|participants)\.jsonl'|'\.journal\.jsonl'/g))
      bad.push(`${name}: ${m[0]}`);
  check(bad.length === 0, 'no source file outside project_files.js writes a role suffix',
        '       ' + bad.join('\n       ') + '\n       one writer, or the two disagree the way B-149 did');

  /* And the readers that used to build a name ask for one now. */
  const evts = decomment(read('modules/events.js'));
  for (const fn of ['chooseSavePath', 'chooseDictSavePath', 'chooseParticipantsSavePath']) {
    const src = new RegExp(`function ${fn}[\\s\\S]*?\\n\\}`).exec(evts);
    check(!!src && /projectFile\(/.test(src[0]), `${fn} asks projectFile()`,
          '       each of these built its own name, and each was wrong in one of two states');
  }
}

/* ── B-160: a project's fourth file is bound even when it is empty ───────────
   The four names are this file's subject, and binding is what makes them one
   project. An empty dictionary is the ordinary state of a corpus somebody has
   started glossing before starting a lexicon — `turkish-test` is exactly that —
   and gating the binding on the file's CONTENT unbound it, so the first entry
   created had nowhere to go and the four files became three plus a stray.

   Source-read rather than executed: `openProject` is 200 lines of pywebview
   plumbing around the two lines that matter, and those two lines are the rule. */
{
  /* `applyProjectBundle` is the function, taken through `fnSrc` rather than by
     slicing on a name that does not exist — the first draft of this guard sliced
     from `function openProject`, found nothing, and failed against correct code. */
  const body = fnSrc('LingCoT.html', 'applyProjectBundle');

  check(/if \(project\.dictPath\) _dictSavePath = project\.dictPath;/.test(body),
        'the dictionary path is armed from the FILE, before anything reads its content',
        '       gated on `dictText`, a 0-byte companion leaves the project unbound');

  const bindIdx = body.indexOf('_dictSavePath = project.dictPath');
  const textIdx = body.indexOf('if (project.dictText)');
  check(bindIdx > -1 && textIdx > -1 && bindIdx < textIdx,
        'and armed BEFORE the content branch, not inside it');
  check(!/if \(project\.dictText\)[\s\S]{0,400}_dictSavePath =/.test(body),
        'with no second assignment inside that branch — one writer, one place');

  const evts = read('modules/events.js');
  const banner = evts.slice(evts.indexOf('function showCompanionBanner'));
  check(/if \(_dictSavePath\) return;/.test(banner.slice(0, banner.indexOf('\n}'))),
        'and the "no dictionary" banner asks whether one is BOUND, not whether it has entries',
        '       a bound-but-empty dictionary invited the annotator to load a foreign file');
}

/* ── B-184: the role can be read back out of a name ────────────────────────
   `projectFile` builds a name from a role; `projectRole` reads the role out of a
   name, and the pair has to close. Round-tripped through every role rather than
   spot-checked, so a fifth role is covered the day it is added to the table.

   The reason it exists: the annotator picked `<name>.journal.jsonl` from the file
   dialog — `.` sorts before `_`, so it is the first file in every project folder
   — and a 0-byte journal cannot be recognised by its CONTENT. The name is the
   only thing that knows, and this module is where the names live. */
console.log('\nthe role of a name, read back out of it\n');
{
  const roles = Object.keys(P.PROJECT_ROLES);
  check(roles.length >= 4, `${roles.length} roles in the table`);
  for (const role of roles) {
    const name = P.projectFile('mytext', role);
    check(P.projectRole(name) === role,
          `${name} reads back as ${role}`,
          `       got ${P.projectRole(name)}`);
    check(P.projectRole('/a/b/' + name) === role,
          `and so does a full path to it`);
  }
  check(P.projectRole('mytext.jsonl') === null,
        'a name with no role suffix has no role',
        '       a hand-named corpus must not be mistaken for one of the four');
  check(P.projectRole('') === null && P.projectRole(null) === null,
        'and neither has nothing at all');
  /* Longest first: two suffixes that end the same way must not be decided by
     the order the table happens to be written in. */
  const src = decomment(read(path.join('modules', 'project_files.js')));
  check(/sort\(\(a, b\) =>[\s\S]{0,80}length - PROJECT_ROLES\[a\]\.length\)/.test(src),
        'and the match tries the longest suffix first, not the table order');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
