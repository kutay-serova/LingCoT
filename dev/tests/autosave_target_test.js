#!/usr/bin/env node
/* =============================================================================
   autosave_target_test.js, a mutate() label must match what the function writes
   Run:  node dev/tests/autosave_target_test.js
   =============================================================================
   B-055. Autosave now skips a target whose generation has not moved, so
   `mutate('dict')` in a function that also edits the corpus leaves the corpus
   file STALE on disk while the status line says "autosaved".

   The two runtime brakes cannot catch this. The generation brake is what is
   being lied to, and the fingerprint brake never runs on a target the
   generation already excluded, serialising every target every time to check
   would reintroduce exactly the cost B-055 removed, so it is caught here, statically: a function's label must cover every store
   its body writes.

     writes S.docs / a document, section, paragraph, sentence, word  → 'corpus'
     writes S.dictionary / a dict entry                              → 'dict'
     writes S.annotators / S.sources                                 → 'parts'

   THE RULE: `mutate()` with no argument is always safe, it bumps everything,
   which is the pre-B-055 behaviour. Only a NARROWER label than the truth is a
   defect. This guard therefore never complains about an unlabelled call.

   VERIFIED against a deliberately mislabelled copy, see the self-check at the
   end, which mutates the parsed source in memory and asserts the guard fails.
   ============================================================================= */

const path = require('path');
const { SRC, read, decomment, moduleFiles, fnSrc } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* Which store does a line of code write to? Assignment and mutating-method
   patterns only, a read is not a write. */
const WRITE_PATTERNS = {
  dict: [
    /\bS\.dictionary\s*(?:=|\.push\(|\.splice\()/,
    /\b_indexDictEntry\s*\(/,
    /\b_resolveOrCreateLemma\s*\(/,     // creates a dictionary entry on miss
    /\b_pushTokenToDict\s*\(/,
    /\bentry\.\w+\s*=/,                 // dict-entry field writes
    /\bnewEntry\.\w+\s*=/
  ],
  corpus: [
    /\bS\.docs\s*(?:=|\.push\(|\.splice\()/,
    /\b(?:word|w|sent|sn|para|p|sec|d|doc)\.\w+\s*=(?!=)/,
    /\b_setWordLemma\s*\(/,
    /\bensureMorphemesFromParse\s*\(/,
    /\b_deriveWordFields\s*\(/
  ],
  parts: [
    /\bS\.annotators\s*(?:=|\.push\(|\.splice\()/,
    /\bS\.sources\s*(?:=|\.push\(|\.splice\()/
  ]
};

/* @fn fnSrcOf, one function's body out of an already-decommented blob.
   `_source.fnSrc` reads a FILE; this reads the concatenation, because the
   journal's writers and its reader live in different files. */
function fnSrcOf(src, name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  return j < 0 ? null : src.slice(i, j + 3);
}

/* Pull every function that calls mutate(), with its body and its label. */
function collect(src) {
  const out = [];
  const lines = src.split('\n');
  let fnName = null, fnStart = -1, depth = 0, started = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = /^(?:async\s+)?function\s+(\w+)/.exec(l);
    if (m && depth === 0) { fnName = m[1]; fnStart = i; started = false; depth = 0; }
    if (fnName !== null) {
      for (const ch of l) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
      if (started && depth <= 0) {
        const body = lines.slice(fnStart, i + 1).join('\n');
        if (/\bmutate\s*\(/.test(body)) out.push({ name: fnName, body });
        fnName = null; depth = 0; started = false;
      }
    }
  }
  return out;
}

/* Strip comments and strings so prose and locale text cannot match a pattern, three guards in this project have passed by matching their own comments. */
const clean = s => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

function labelsOf(body) {
  const calls = [...body.matchAll(/\bmutate\s*\(([^)]*)\)/g)].map(m => m[1].trim());
  if (!calls.length) return null;
  if (calls.some(a => a === '')) return 'ALL';        // unlabelled → safe
  const set = new Set();
  for (const a of calls) for (const q of a.matchAll(/'(\w+)'/g)) set.add(q[1]);
  return set;
}

function audit(src, file) {
  const problems = [];
  for (const fn of collect(src)) {
    const labels = labelsOf(fn.body);
    if (labels === null || labels === 'ALL') continue;
    const body = clean(fn.body);
    for (const [target, pats] of Object.entries(WRITE_PATTERNS)) {
      if (labels.has(target)) continue;
      const hit = pats.find(re => re.test(body));
      if (hit) problems.push(
        `         ${file}:${fn.name}() labels [${[...labels].join(', ')}] but writes '${target}' — ${hit}`);
    }
  }
  return problems;
}

console.log('\nevery mutate() label covers the stores its function writes\n');
const files = ['LingCoT.html', 'modules/events.js', 'modules/participants.js'];
let all = [];
for (const f of files) all = all.concat(audit(read(f), f));
check(all.length === 0,
      'no function names a narrower save target than it actually writes',
      all.join('\n'));

console.log('\nthe mechanism is present and safe by default\n');
{
  const html = read('LingCoT.html');
  check(/function mutate\(target, written\)/.test(html),
        'mutate() takes a target AND what was written (D50)',
        '         a store name is not enough to journal from: one action writes many objects');
  check(/function _bumpSaveGen[\s\S]{0,400}if \(!target\) \{[\s\S]{0,120}\+\+/.test(html),
        'mutate() with NO target still bumps every generation — unlabelled is safe',
        '         if this ever stops being true, every unlabelled call site becomes a stale-file bug');
  check(/unknown save target/.test(html),
        'an UNKNOWN target degrades to writing everything, and says so',
        '         a typo\'d label must never mean "skip all three"');

  const ev = read('modules/events.js');
  check(/led\.path === absPath && saveGen\(target\) === led\.gen/.test(ev),
        'the generation brake also requires the path to match — a new file is always written');
  check(/_fingerprint\(/.test(ev) && /fp === led\.fp/.test(ev),
        'a dirty target is still fingerprinted, so an unchanged payload is not rewritten');
  check(!/&&\s*S\.dictionary\.length\s*\)/.test(ev) && !/&&\s*participants\.length\s*\)/.test(ev),
        'emptiness no longer suppresses the write (B-055) — deleting the last entry persists',
        '         `_dictSavePath && S.dictionary.length` meant an emptied file was never saved');
  check(/for \(const commit of pending\) commit\(\)/.test(ev),
        'the ledger is updated only AFTER the write resolves',
        '         recording a write that then failed would skip the retry');
  check(/mutate\('parts'\)/.test(read('modules/participants.js')),
        'participants go through mutate() — a bare triggerAutoSave() would never mark them dirty');
}

console.log('\nD50: every journalled store says what it wrote\n');
{
  /* Under the old full rewrite a mutate() that named no records was merely
     slow. Under a journal it would be permanent loss, so the contract is that
     every call touching corpus or dict passes a second argument. A call that
     does not is not a crash — journalWrite marks the journal incomplete and a
     full write happens — but it is a save path that silently costs the journal
     its reason to exist, so it is caught here rather than at runtime. */
  const bodies = [read('LingCoT.html'), ...moduleFiles().map(([, c]) => c)].join('\n');
  const calls = [...decomment(bodies).matchAll(/\bmutate\(([^;]*?)\);/gs)];
  const bare = calls.filter(m => {
    const arg = m[1];
    if (/^\s*'parts'\s*$/.test(arg)) return false;        // not journalled
    if (/^\s*target\s*,\s*written\s*$/.test(arg)) return false;  // the definition
    return !/,/.test(arg);                                  // no second argument
  });
  check(bare.length === 0,
        `all ${calls.length - 2} mutate() call(s) on a journalled store declare their writes`,
        bare.map(m => `         mutate(${m[1].trim().slice(0, 60)}) — names a store, not the records`).join('\n'));
}

console.log('\nD50 stage 5: an empty write list is a claim, and the journal believes it\n');
{
  /* `mutate('corpus', [])` says "this store is dirty and I wrote no records".
     The journal believes it: nothing is appended, and the store is still marked
     dirty, so the next compaction rewrites the base. That is CORRECT after a
     load or a create, where the file on disk IS the base and there is nothing
     pending against it — both such call sites run `journalReset()` first.

     Anywhere else it is silent loss: the edit never reaches the journal, and a
     crash before the next compaction takes it. So the rule is not "no empty
     lists" but "an empty list belongs to a function that just reset the
     journal", which is checkable and is what the two real sites do. */
  const src = decomment(read('LingCoT.html')) + '\n' + moduleFiles().map(([, c]) => decomment(c)).join('\n');
  const fns = collect(src);
  const offenders = [], ok = [];
  for (const fn of fns) {
    if (!/\bmutate\(\s*(?:'[a-z]+'|\[[^\]]*\])\s*,\s*\[\s*\]\s*\)/.test(fn.body)) continue;
    (/\bjournalReset\s*\(\s*\)/.test(fn.body) ? ok : offenders).push(fn.name);
  }
  check(ok.length > 0, `${ok.length} function(s) declare an empty write list: ${ok.join(', ')}`,
        '         none found — the pattern moved, and this check now proves nothing');
  check(offenders.length === 0,
        'and every one of them resets the journal first, so the empty claim is true',
        offenders.map(n => `         ${n}() passes [] without journalReset() — `
          + 'the edit is never appended, and a crash before the next compaction loses it').join('\n'));
}

console.log('\nD50 stage 5: every journal record shape has a caller\n');
{
  /* `_journalOne` understands four shapes. A shape nothing constructs is dead
     replay code that will be trusted the first time somebody writes a call site
     for it — and replay is the path with no second chance. This is coverage of
     the WRITERS against the reader, which is the comparison B-127 says nobody
     was making when field_prov moved. */
  const src = decomment(read('LingCoT.html')) + '\n' + moduleFiles().map(([, c]) => decomment(c)).join('\n');
  const one = fnSrcOf(src, '_journalOne');
  check(!!one, 'found _journalOne');

  const SHAPES = [
    ['del',            /\bitem\.del\b/,                     /\{\s*del:/],
    ['add',            /\bitem\.parent\b|\bparent\b/,       /\{\s*rec:[^}]*parent:/],
    ['shallow put',    /\bitem\.shallow\b|\bshallow\b/,     /\{\s*rec:[^}]*shallow:|shallow:\s*true/],
    ['whole-record put', /\breturn\b/,                      /mutate\(\s*(?:'[a-z]+'|\[[^\]]*\])\s*,\s*(?:\[\s*[a-zA-Z_]|\{)/],
  ];
  for (const [name, inReader, inCaller] of SHAPES) {
    check(one && inReader.test(one), `_journalOne handles the "${name}" shape`);
    check(inCaller.test(src), `and at least one call site constructs it`,
          `         no caller builds a "${name}" record — replay would be handling a shape nothing writes`);
  }
}

console.log('\nself-check: the guard can actually fail\n');
{
  /* v3.14.239: the call carries a `written` argument now, so the known-bad copy
     has to be built from the current spelling. */
  const broken = read('LingCoT.html')
    .replace(/mutate\(\['corpus', 'dict'\], \{ corpus: \[word\]/, "mutate('dict', { corpus: [word]");
  const problems = audit(broken, 'broken');
  check(problems.length > 0,
        'mislabelling saveWord() as dict-only is detected',
        '         the guard passed on a known-bad copy — it is not checking anything');
  if (problems.length) console.log(`         (detected: ${problems[0].trim().slice(0, 96)}…)`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
