#!/usr/bin/env node
/* =============================================================================
   id_mint_test.js — a new child never takes an id a sibling still holds
   Run:  node dev/tests/id_mint_test.js
   =============================================================================
   B-194. The three add paths minted an id from the container's LENGTH —
   `sections.length + 1`, `paragraphs.length + 1`, `sentences.length + 1`. A count
   answers *how many are there*; they asked it as though it answered *what comes
   next*, and those are the same number only until something is deleted.

   Reported from use. A section was deleted from `turkish-test`, leaving `sec_001`
   and `sec_003`; adding a section would then have minted `sec_003`, an id the
   section below it still held. **Nothing would have thrown.** Ids are opaque
   (B-135) and everything resolves through `S.wordById` / `S.sentById`, so a
   duplicate does not fail loudly — one of the two objects becomes unreachable and
   edits land on whichever the index happened to keep. §4 is that scenario, run.

   WHY THIS IS A GUARD AND NOT THREE FIXES. `id_sort_test` already holds that ids
   are opaque and must not be compared as numbers; this holds the other half, that
   they must be UNIQUE. Section 3 finds the mint sites by scanning for the shape
   that caused it — `<container>.length` reaching an id template — so a fourth add
   path written next month fails here rather than shipping the same defect. That
   is the only reason this file exists rather than three edits.
   ============================================================================= */

const vm = require('vm');
const { read, decomment } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const APP = read('LingCoT.html');
const SRC = decomment(APP);

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
const run = expr => vm.runInContext(expr, ctx);
const next = (sibs, kind) => {
  ctx.__sibs = sibs;
  return run(`nextChildIndex(__sibs, ${JSON.stringify(kind)})`);
};

console.log('\n1 · executed: the number a new sibling gets');

check(next([], 'sec') === 1, 'an empty container starts at 1');
check(next([{ id: 'd.sec_001' }, { id: 'd.sec_002' }], 'sec') === 3,
      'an untouched container counts on, as it always did');

/* THE REPORTED STATE, exactly: sec_002 deleted, sec_001 and sec_003 left. */
check(next([{ id: 'd.sec_001' }, { id: 'd.sec_003' }], 'sec') === 4,
      'a GAP does not reopen — after deleting sec_002 the next section is sec_004',
      '         3 is the count + 1, and sec_003 is still on the page');

check(next([{ id: 'd.s_001' }], 's') === 2,
      'deleting the LAST child does reuse its number, which is correct',
      '         nothing holds that id any more, so nothing collides');

/* The re-tokenize paths append a random suffix (`p_002_x7k`) to dodge this same
   collision. Their numbers still have to count, or the two schemes disagree
   about what is taken. */
check(next([{ id: 'a.p_001' }, { id: 'a.p_002_x7k' }], 'p') === 3,
      'a random-suffixed sibling still counts',
      '         `\\d{3}` instead of `\\d+` would miss it and mint p_002 again');

check(next([{ id: 'a.p_010' }, { id: 'a.p_002' }], 'p') === 11,
      'the HIGHEST is taken, not the last in the array');
check(next([null, { }, { id: '' }, { id: 'a.p_004' }], 'p') === 5,
      'junk siblings do not derail it');

console.log('\n2 · the three add paths use it');

for (const [fn, kind, container] of [
  ['saveSectionAdd',   'sec', 'd.sections'],
  ['saveParagraphAdd', 'p',   'sec.paragraphs'],
  ['saveSentenceAdd',  's',   'para.sentences'],
]) {
  /* `\(\)` assumed no parameters and two of the three take them
     (`saveParagraphAdd(si)`, `saveSentenceAdd(si, pi)`), so the first run of this
     reported the fix missing from code that had it. */
  const body = (SRC.match(new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n\\}`)) || [''])[0];
  check(body.length > 0, `${fn} found`);
  check(new RegExp(`nextChildIndex\\(${container.replace('.', '\\.')}, '${kind}'\\)`).test(body),
        `${fn} mints from nextChildIndex(${container}, '${kind}')`,
        `         still using a count — that is B-194`);
}

console.log('\n3 · no add path goes back to counting');

/* THE SHAPE THAT CAUSED IT, wherever it appears: a `.length` feeding an id
   template. Derived, so a fourth add path is covered without an edit here. */
const offenders = [];
for (const m of SRC.matchAll(/const\s+\w+\s*=\s*`\$\{[^`]*\}\.(sec|p|s|w)_\$\{padId\(([^)]*)\)\}/g)) {
  const arg  = m[2].trim();
  const line = SRC.slice(0, m.index).split('\n').length;
  let why = null;
  if (/\.length/.test(arg)) why = arg;
  else {
    /* ONE LEVEL OF VARIABLE, because that is how the three sites actually read:
       `const si = d.sections.length;` then `padId(si + 1)`. The first version of
       this check looked only for `.length` inside the call, so reverting any of
       the three fixes walked past it — §2 caught them by name and §3, the one
       written to cover a FUTURE add path, did not. A new path would be written
       the same way. */
    const v = arg.match(/^([A-Za-z_]\w*)\s*\+\s*1$/);
    if (v) {
      const before = SRC.slice(Math.max(0, m.index - 500), m.index);
      const assign = new RegExp(`\\b(?:const|let|var)\\s+${v[1]}\\s*=\\s*([^;\\n]*\\.length)`);
      const a2 = assign.exec(before);
      if (a2) why = `${v[1]} = ${a2[1].trim()}`;
    }
  }
  if (why) offenders.push(`         LingCoT.html:${line} — ${kindName(m[1])} id from ${why}`);
}
function kindName(k) {
  return { sec: 'section', p: 'paragraph', s: 'sentence', w: 'word' }[k] || k;
}
check(offenders.length === 0,
      'no id is minted from a container length',
      offenders.join('\n')
    + '\n         a count is not a next id once anything has been deleted');

/* Word ids are exempt and it is worth saying why rather than leaving a hole:
   words are minted only for a sentence being CREATED, from the tokenizer, so
   there are no surviving siblings to collide with. */
check(/makeWordObj\(sentId, form, idx\)/.test(SRC),
      'word ids stay index-based, because a word is only minted with its sentence');

console.log('\n4 · executed: the collision the report was about');

ctx.__docs = [{
  id: 'doc1', metadata: { title: 't' },
  sections: [
    { id: 'doc1.sec_001', title: 'first', paragraphs: [{ id: 'doc1.sec_001.p_001', sentences: [
      { id: 'doc1.sec_001.p_001.s_001', text: 'a', words: [{ id: 'doc1.sec_001.p_001.s_001.w_001', form: 'a' }] }] }] },
    /* sec_002 deleted — this is `turkish-test` as it stands. */
    { id: 'doc1.sec_003', title: 'third', paragraphs: [{ id: 'doc1.sec_003.p_001', sentences: [
      { id: 'doc1.sec_003.p_001.s_001', text: 'b', words: [{ id: 'doc1.sec_003.p_001.s_001.w_001', form: 'b' }] }] }] },
  ],
}];
run("applyCorpus(__docs, 'b194');");
check(run("doc().sections.length") === 2, 'the fixture loads with a gap at sec_002');

const minted = `doc1.sec_${run("padId(nextChildIndex(doc().sections, 'sec'))")}`;
check(!run(`doc().sections.some(s => s.id === ${JSON.stringify(minted)})`),
      `the next section id (${minted}) is not already taken`,
      '         a duplicate id does not throw: one of the two objects becomes\n'
    + '         unreachable and edits land on whichever the index kept');

/* And the old rule, shown failing, so the check above is not vacuous. */
const old = `doc1.sec_${run("padId(doc().sections.length + 1)")}`;
check(run(`doc().sections.some(s => s.id === ${JSON.stringify(old)})`),
      `the OLD rule would have minted ${old}, which IS taken`,
      '         if this passes, the fixture has no gap and section 4 proves nothing');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
