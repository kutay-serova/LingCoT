#!/usr/bin/env node
/* =============================================================================
   doc_integrity_test.js, the dev docs must not lose sections silently
   Run:  node dev/tests/doc_integrity_test.js
   =============================================================================
   WHY THIS EXISTS
   ---------------
   On 2026-08-24, rewriting DEV_PLAN's D30 section replaced everything between
   its heading and `## 3. DEFERRED`. D30 had been inserted mid-§2, so that slice
   silently destroyed **D28, D29, D24 and D20**. Nobody noticed for several
   edits; it surfaced only when a later scripted edit failed to find a string it
   expected inside D29.

   D24 and D20 were recovered verbatim from `dev/archive/dev_plan/`. D29 was
   rewritten from the same session's text. **D28 predated every archived copy and
   could not be recovered**, it survives as a reconstructed pointer to
   `dev/DICT_SENSE_AUDIT.md`, which is a permanent loss of the original wording.

   Prose has no compiler, so a scripted edit to a markdown file is exactly as
   dangerous as one to source and has none of the safety. These checks are the
   minimum that would have caught it immediately.

   CHECKS
   ------
   1. Every `§2 Dnn` / `see D29`-style cross-reference in DEV_PLAN resolves to a
      heading that actually exists in the file.
   2. Feature sections never disappear: every Dnn heading recorded in
      EXPECTED_SECTIONS below must be present.
   3. Every `dev/*.md` file referenced by DEV_PLAN or BUGS exists on disk.
   4. The version line in DEV_PLAN's header matches the newest edit_log entry, so
      the two cannot drift apart unnoticed.

   EDIT-LOG CHECKS (added v3.14.86)
   -------------------------------
   The log was previously unread by any guard, so four standing conventions were
   held by memory alone. Each had already been broken at least once:

   5. Every `**Archives:**` path an entry claims exists on disk.
   6. Versions are unique and strictly descending (entries prepend). A reused or
      skipped number makes the log unorderable, the archive is already
      non-monotonic across an abandoned v4.0 renumbering, see
      dev/archive/README.md.
   7. Every file an entry lists as `**Touched:**` has a pre-edit copy in that
      entry's archive folder. THIS IS THE COMPLETENESS RULE. v3.14.83 edited
      three files and archived two; restoring from that folder would have left
      JS referencing a locale key absent from en.json.
   8. Every bug an entry closes appears in BUGS.md's Fixed table at the same
      version, so a fix cannot be logged and then lost from the index.

   Checks 7 and 8 apply from TOUCHED_FROM onward, earlier entries predate the
   convention and their archive folders are the record.

   ENTRY TYPES (added v3.14.87)
   ---------------------------
   9. Every recent entry declares a `**Type:**` from a fixed set, and its other
      fields agree with it.

   The trigger for a log entry used to be "a file changed". That is the wrong
   trigger: on 2026-08-25 a review of an exported PDF produced three defects and
   no entry at all, because nothing on disk had changed. Making `finding` a real
   type says that a change to what the project KNOWS is a change worth versioning.

      fix      closes a bug, the title names a B-nnn, and check 8 verifies it
      feature  new capability
      finding  something learned by examining an artefact; no CODE diff. It may
               create its own write-up under dev/audits/, that is part of the
               finding. Touching anything else makes it a fix or a chore.
               Requires `**Examined:**`, the provenance. A finding whose basis
               is not recorded cannot be re-checked, and is then just an opinion.
               `**Filed:**` lists any bugs it produced.
      decision a choice made and its reasoning; binds future work
      chore    tooling, docs, archiving, no behaviour change

   A finding that finds NOTHING is still worth an entry. "We looked at X and it
   was clean" is information, and its absence is why B-008 sat in a log unread
   for three months.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const { DEV, ROOT, SRC, isGitignored, archiveAvailable } = require('./_source.js');
let GIT_TOUCHED_RAN = false;
const PLAN = path.join(DEV, 'DEV_PLAN.md');
const BUGS = path.join(DEV, 'BUGS.md');
const LOG  = path.join(DEV, 'edit_log.md');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const plan = fs.readFileSync(PLAN, 'utf8');
const bugs = fs.readFileSync(BUGS, 'utf8');
const elog = fs.readFileSync(LOG, 'utf8');

/* Feature sections that must never vanish. Add one when a new Dnn is created;
   remove one only when it is deliberately retired into §4 SUPERSEDED.

   Since v3.14.134 a section may also live in dev/archive/docs/features/ instead
   of in the plan: shipped designs were moved out so §2 holds open work only.
   That is a MOVE, not a deletion, so the section still has to be accounted for,
   and it takes all three of a file, a §5 pointer, and the id in the pointer. A
   design that is merely gone still fails. */
const EXPECTED_SECTIONS = ['D20', 'D24', 'D25', 'D27', 'D28', 'D29', 'D30'];

const headings = new Set(
  [...plan.matchAll(/^###\s+(D\d+)\b/gm)].map(m => m[1])
);

const FEATURES_DIR = path.join(DEV, 'design');   // ships; see .gitignore
const archived = new Map();   // Dnn -> filename
if (fs.existsSync(FEATURES_DIR))
  for (const f of fs.readdirSync(FEATURES_DIR)) {
    const m = /^(D\d+)_/.exec(f);
    if (m) archived.set(m[1], f);
  }

console.log('\nDEV_PLAN section integrity\n');
{
  const missing = EXPECTED_SECTIONS.filter(d =>
    !headings.has(d) && !(archived.has(d) && plan.includes(archived.get(d))));
  check(missing.length === 0,
        `${EXPECTED_SECTIONS.length} feature sections all present or indexed as archived`,
        missing.map(d => `         ${d}: no '### ${d}' heading, and no archived design named in the plan`).join('\n'));

  const orphaned = [...archived.entries()].filter(([, f]) => !plan.includes(f));
  check(orphaned.length === 0,
        `${archived.size} archived design(s) are all pointed at from the plan`,
        orphaned.map(([d, f]) => `         ${f} exists but nothing in DEV_PLAN names it — ${d} is unreachable`).join('\n'));
}

{
  /* Cross-references like "see §2 D29", "See §2 D29 P1.", "tracked as D29".
     No leading \b, `§` is not a word character, so \b never matches before it
     and the first draft of this check silently found zero references, which is
     precisely the kind of vacuous green this file exists to prevent. */
  const refs = new Set(
    [...plan.matchAll(/(?:§2\s+|\bsee\s+|\bSee\s+|\btracked as\s+|\bDEV_PLAN\s+)(D\d+)\b/g)].map(m => m[1])
  );
  const dangling = [...refs].filter(d => !headings.has(d));
  check(dangling.length === 0,
        `${refs.size} cross-reference(s) to Dnn sections all resolve`,
        dangling.map(d => `         DEV_PLAN points at ${d}, which has no heading in this file`).join('\n'));
}

/* ── BUGS.md entries must not vanish ──────────────────────────────────────────
   The same range-slice mistake that destroyed four DEV_PLAN sections happened a
   second time on 2026-08-24, in BUGS.md: moving B-015 from Open to Fixed sliced
   from its heading to the "## Fixed" marker and took B-009, the only other open
   bug, with it. Twice is a pattern, so bug entries get the same protection as
   plan sections. */
console.log('\nBUGS.md entries must not vanish');
{
  // Match B-nnn ANYWHERE, not just in a heading: since 2026-08-24 the Fixed
  // section is a one-line table and the narratives live in the edit log.
  const seen = new Set([...bugs.matchAll(/\bB-(\d{3})\b/g)].map(m => m[1]));

  // A check that passes when it finds nothing is worse than no check. When the
  // Fixed section became a table this scan matched zero headings, Math.max()
  // returned -Infinity, the loop body never ran, and it reported "all present
  // (0 entries)", a green tick for a file it had not actually inspected.
  check(seen.size >= 20,
        `${seen.size} bug ids found in BUGS.md`,
        '         found almost none — has the file been restructured past this matcher?');

  if (seen.size) {
    const highest = Math.max(...[...seen].map(Number));
    const missing = [];
    for (let n = 1; n <= highest; n++) {
      const id = String(n).padStart(3, '0');
      if (!seen.has(id)) missing.push(`         B-${id} is absent — removed by an edit?`);
    }
    check(missing.length === 0,
          `B-001…B-${String(highest).padStart(3, '0')} all present, none skipped`,
          missing.join('\n'));
  }
}

console.log('\nthe open-bug tally matches the entries');
{
  /* A hand-maintained count drifts the first time someone closes a bug and
     forgets the header. B-031 sat in both Open and Fixed for 20 versions before
     the tally was added and this check found it. */
  const openSec = bugs.slice(bugs.indexOf('\n## Open'), bugs.indexOf('\n## Fixed'));
  const rows = [...openSec.matchAll(/^### (B-\d{3}) \u00b7 (S\d|\u2014) \u00b7 /gm)];
  const bySev = {};
  for (const [, id, sev] of rows) (bySev[sev] = bySev[sev] || []).push(id);
  const fixedIds = [...bugs.matchAll(/^\| \*\*(B-\d{3})\*\* \|/gm)].map(m => m[1]);

  const both = rows.map(r => r[1]).filter(id => fixedIds.includes(id));
  check(both.length === 0,
        'no bug is listed as both open and fixed',
        `         ${both.join(', ')} appear in each section`);

  const hdr = /\*\*(\d+) open\*\*\s*\u00b7\s*(\d+) S1\s*\u00b7\s*(\d+) S2\s*\u00b7\s*(\d+) S3[^|]*\|\s*\*\*(\d+) fixed\*\*/.exec(bugs);
  check(hdr !== null, 'the summary line is present and parseable',
        '         expected "**N open** \u00b7 N S1 \u00b7 N S2 \u00b7 N S3  |  **N fixed**"');
  if (hdr) {
    const want = [rows.length, (bySev.S1||[]).length, (bySev.S2||[]).length,
                  (bySev.S3||[]).length, fixedIds.length];
    const got  = hdr.slice(1, 6).map(Number);
    const lbl  = ['open', 'S1', 'S2', 'S3', 'fixed'];
    const wrong = lbl.map((l, i) => got[i] === want[i] ? null : `${l}: header says ${got[i]}, entries say ${want[i]}`)
                     .filter(Boolean);
    check(wrong.length === 0, 'every count in the summary matches the entries below',
          wrong.map(w => `         ${w}`).join('\n'));
  }

  // Each severity row must list exactly the ids of that severity, in order.
  const rowWrong = [];
  for (const sev of ['S1', 'S2', 'S3']) {
    const want = (bySev[sev] || []).slice().sort();
    const m = new RegExp(`\\| \\*\\*${sev}\\*\\* \\| \\d+ \\| [^|]+\\| ([^|]*)\\|`).exec(bugs);
    if (!m) { rowWrong.push(`         ${sev} row missing from the tally table`); continue; }
    const got = m[1].trim() === 'none' ? [] : m[1].trim().split(/,\s*/);
    if (got.join(',') !== want.join(','))
      rowWrong.push(`         ${sev}: table lists ${got.length}, entries have ${want.length}`
                  + (got.length === want.length ? ' (different ids or order)' : ''));
  }
  check(rowWrong.length === 0, 'each severity row lists exactly its own bug ids, sorted',
        rowWrong.join('\n'));
}

console.log('\nreferenced dev docs must exist');
{
  const missing = [];
  /* v3.14.229: widened from {DEV_PLAN, BUGS} to every live doc and every audit
     and design. dev/archive/README.md cited dev/PIPELINE_AUDIT.md for months —
     a path that moved to dev/audits/ — and nothing looked, because the loop ran
     over two filenames. */
  const _srcs = [['DEV_PLAN.md', plan], ['BUGS.md', bugs]];
  for (const d of ['audits', 'design']) {
    const dir = path.join(DEV, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md')))
      _srcs.push([`${d}/${f}`, fs.readFileSync(path.join(dir, f), 'utf8')]);
  }
  /* v3.14.388: a FROZEN document is never rewritten, so a file rename breaks
     every frozen citation of it at once — and the two ways out of that were
     rewriting frozen documents or never renaming a file. `dev/RENAMES.md` is the
     third: an old path resolves to what it became, and a path in neither the
     filesystem nor the ledger still fails. */
  const renamed = new Set();
  const ledger = path.join(DEV, 'RENAMES.md');
  if (fs.existsSync(ledger))
    for (const m of fs.readFileSync(ledger, 'utf8').matchAll(/^\| `([^`]+)` \|/gm))
      renamed.add(m[1]);
  check(renamed.size > 0, `the rename ledger lists ${renamed.size} retired path(s)`,
        '         dev/RENAMES.md is missing or unparseable, so every rename below is a false pass');

  for (const [src, text] of _srcs) {
    for (const m of text.matchAll(/`dev\/([A-Za-z0-9_./-]+\.(?:md|js|py))`/g)) {
      const f = m[1];
      // A gitignored path (dev/archive/...) is absent on a clone by design.
      if (isGitignored(`dev/${f}`)) continue;
      if (renamed.has(`dev/${f}`)) continue;
      if (!fs.existsSync(path.join(DEV, f))) missing.push(`         ${src} references dev/${f} — not on disk`);
    }
  }
  check(missing.length === 0, 'all referenced dev/ files exist', [...new Set(missing)].join('\n'));
}

console.log('\nthe version agrees in all three places');
{
  /* Three copies, and until v3.14.88 only two of them existed, the version was
     prose only, so the app could not report it and a user's log could not be
     tied to a build. source/version.py is now the source of truth; these two
     assertions are what stop it drifting from the docs. */
  const planV = /\*\*Version:\*\*\s*(v[\d.]+)/.exec(plan);
  /* The newest ENTRY, not the file header. edit_log.md gained a header stamp at
     v3.14.134, and reading the first match in the file would compare the header
     with itself: a check that cannot fail. Entries prepend, so the first
     `**Version:**` AFTER the first `## ` heading is the newest one. */
  const firstEntry = elog.indexOf('\n## ');
  const logV  = /\*\*Version:\*\*\s*(v[\d.]+)/.exec(elog.slice(firstEntry));
  check(planV && logV && planV[1] === logV[1],
        `DEV_PLAN ${planV ? planV[1] : '?'} matches newest edit_log entry ${logV ? logV[1] : '?'}`,
        `         DEV_PLAN header and the top edit_log entry disagree — one of them was not updated.`);

  /* BUGS.md carries the same stamp, added at v3.14.133. A doc with no version
     on it cannot be tied to a build any more than the app could before
     v3.14.88, and a reader has no way to tell whether the tally is current. */
  /* A fence with prose stuck to it does not close the block, and everything
     after it renders as code. Found 2026-08-27: one such line in BUGS.md had
     been swallowing the entire Fixed index. A balanced COUNT of fences does not
     catch it, because the broken line still counts as one. */
  for (const [name, text] of [['BUGS.md', bugs], ['DEV_PLAN.md', plan], ['edit_log.md', elog]]) {
    const bad = [];
    let open = false;
    text.split('\n').forEach((line, i) => {
      if (!/^```/.test(line)) return;
      const rest = line.slice(3);
      if (open && rest.trim() !== '') bad.push(`${i + 1}: ${line.slice(0, 70)}`);
      // An opening fence may carry a language token; a closing one may carry nothing.
      if (!open && /\s/.test(rest.trim())) bad.push(`${i + 1}: ${line.slice(0, 70)}`);
      open = !open;
    });
    check(bad.length === 0 && !open, `${name}: every code fence opens and closes cleanly`,
          bad.map(b => '         ' + b).join('\n') || '         a fence is left open at end of file');
  }

  const bugsV = /\*\*Version:\*\*\s*(v[\d.]+)/.exec(bugs);
  const bugsD = /\*\*Updated:\*\*\s*([\d-]+)/.exec(bugs);
  check(!!bugsV && !!bugsD, 'BUGS.md carries an Updated / Version header');
  check(bugsV && logV && bugsV[1] === logV[1],
        `BUGS.md ${bugsV ? bugsV[1] : '?'} matches newest edit_log entry ${logV ? logV[1] : '?'}`,
        '         new_version.py stamps it; a mismatch means the doc was edited outside the bump');

  const vpPath = path.join(DEV, '..', 'source', 'version.py');
  check(fs.existsSync(vpPath), 'source/version.py exists',
        '         without it the app cannot report its own version, and a bug\n'
        + '         report cannot be tied to a build');
  if (fs.existsSync(vpPath)) {
    const vp = fs.readFileSync(vpPath, 'utf8');
    /* v3.14.412: on a branch the string is `<base>+<label>`, and the label must
       name an open change file in dev/changes/. The number still has to match
       the docs, because nothing is numbered until --release. */
    const codeV = /^__version__\s*=\s*["']([\d.]+)(?:\+([a-z0-9_-]+))?["']/m.exec(vp);
    check(codeV && planV && `v${codeV[1]}` === planV[1],
          `source/version.py ${codeV ? 'v' + codeV[1] : '?'} matches the docs ${planV ? planV[1] : '?'}`,
          '         the shipped version and the documented version disagree —\n'
          + '         every log line and bug report from this build would be mislabelled');
    if (codeV && codeV[2])
      check(fs.existsSync(path.join(DEV, 'changes', `${codeV[2]}.md`)),
            `the build label +${codeV[2]} names an open change file`,
            `         dev/changes/${codeV[2]}.md is missing — run new_version.py --relabel`);

    /* pyproject.toml versions the SEPARATE v1.x packaging stream and must not be
       dragged into line. Assert the two are still distinct so nobody "fixes" it. */
    const pyproj = path.join(DEV, '..', 'pyproject.toml');
    if (fs.existsSync(pyproj) && codeV) {
      const pv = /^version\s*=\s*["']([\d.]+)["']/m.exec(fs.readFileSync(pyproj, 'utf8'));
      check(!pv || pv[1] !== codeV[1],
            'pyproject.toml still versions the packaging stream, not the app',
            `         both now read ${codeV[1]} — if that was deliberate, delete this\n`
            + '         check and say so in dev/archive/README.md; if not, it is the\n'
            + '         "reconciliation" that audit section 2 warns against');
    }
  }
}

/* ── edit_log integrity ─────────────────────────────────────────────────────
   Parse entries rather than slicing: each begins at a `## ` heading and its
   metadata lines follow immediately. */
const TOUCHED_FROM = [3, 14, 76];          // v3.14.76, when the convention began
const vNum = v => v.replace(/^v/, '').split('.').map(Number);
const cmp  = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const entries = [];
{
  const re = /^## (.+)$/gm;
  const heads = [...elog.matchAll(re)];
  for (let i = 0; i < heads.length; i++) {
    const body = elog.slice(heads[i].index,
                            i + 1 < heads.length ? heads[i + 1].index : elog.length);
    const v = /\*\*Version:\*\*\s*(v[\d.]+)/.exec(body);
    if (!v) continue;
    const arc = /\*\*Archives:\*\*\s*(.+)/.exec(body);
    const tch = /\*\*Touched:\*\*\s*(.+)/.exec(body);
    entries.push({
      title: heads[i][1].trim(),
      version: v[1],
      archives: arc ? arc[1].trim() : '',
      touched:  tch ? tch[1].trim() : null,
      body,
    });
  }
}

console.log('\nedit_log integrity');
{
  check(entries.length > 20, `parsed ${entries.length} edit_log entries`,
        '         parsed too few — the checks below would be vacuous');

  /* 5. Archive paths exist. Skipped on a clone, see the exit at the foot. */
  const HAVE_ARCHIVE = archiveAvailable();
  const badArc = [];
  if (HAVE_ARCHIVE) {
  for (const e of entries)
    for (const m of e.archives.matchAll(/`(dev\/archive\/[A-Za-z0-9_./-]+)`/g))
      if (!fs.existsSync(path.join(DEV, '..', m[1])))
        badArc.push(`         ${e.version} claims ${m[1]} — not on disk`);
  check(badArc.length === 0, 'every **Archives:** path exists', badArc.join('\n'));
  } else console.log('  --   **Archives:** paths — skipped, dev/archive/ is not distributed');

  /* 6. Versions unique and strictly descending. */
  const seen = new Map(), order = [];
  for (const e of entries) {
    if (seen.has(e.version))
      order.push(`         ${e.version} appears twice — "${seen.get(e.version)}" and "${e.title}"`);
    else seen.set(e.version, e.title);
  }
  for (let i = 1; i < entries.length; i++)
    if (cmp(vNum(entries[i - 1].version), vNum(entries[i].version)) <= 0)
      order.push(`         ${entries[i - 1].version} is listed above ${entries[i].version}`
               + ` — entries must prepend, newest first`);
  check(order.length === 0, 'versions are unique and strictly descending',
        [...new Set(order)].join('\n'));

  /* 7. THE COMPLETENESS RULE. */
  const recent = entries.filter(e => cmp(vNum(e.version), TOUCHED_FROM) >= 0);
  check(recent.length > 0, `${recent.length} entries are subject to the **Touched:** rule`,
        '         none matched — TOUCHED_FROM may be wrong, making check 7 vacuous');

  const noTouched = recent.filter(e => e.touched === null).map(e => `         ${e.version} has no **Touched:** line`);
  check(noTouched.length === 0, 'every recent entry declares what it touched', noTouched.join('\n'));

  const incomplete = [];
  for (const e of recent) {
    e.type = e.type || (/\*\*Type:\*\*\s*([a-z]+)/.exec(e.body) || [])[1];
    /* "documentation only" is the marker for an entry that touched no file.
       It was written as a leading em dash until v3.14.115, when the docs were
       rewritten to a neutral register and the dashes were removed; both spellings
       are accepted so historical entries keep validating. */
    if (!e.touched || /^—/.test(e.touched) || /^documentation only/i.test(e.touched)) continue;
    // A finding's own audit write-up has no pre-edit copy: it did not exist.
    if (e.type === 'finding' &&
        e.touched.split('·').every(f => /dev\/audits\//.test(f))) continue;
    /* An entry may name SEVERAL archive folders, a change that spans source and
       guards often splits them. Search all of them before reporting a miss. */
    const dirs = [...e.archives.matchAll(/`(dev\/archive\/[A-Za-z0-9_./-]+)`/g)].map(m => m[1]);
    if (!dirs.length) { incomplete.push(`         ${e.version} lists touched files but names no archive folder`); continue; }
    const archived = dirs
      .map(d => path.join(DEV, '..', d))
      .filter(fs.existsSync)                                  // check 5 already reported absent ones
      .flatMap(a => fs.readdirSync(a))
      .join('\n');

    for (const raw of e.touched.split('·').map(x => x.trim()).filter(Boolean)) {
      /* Two annotations are exempt, and both must be written down rather than
         inferred, a file silently skipped is indistinguishable from one
         forgotten, which is the whole failure this check exists to catch:
           `path (new)`, created by this change; nothing existed to copy
           `path (moved)`, relocated unchanged; the copy is under its OLD path
           `path (no pre-copy)`, a known, deliberate gap; explain it in the entry */
      const ann = /\((new|moved|no pre-copy)\)\s*$/.exec(raw);
      if (ann) continue;
      const f = raw.replace(/\s*\([^)]*\)\s*$/, '');
      /* An extensionless file (.gitignore, setup.command) broke this twice over:
         `basename.replace(/\.[a-z]+$/)` ate the whole name, and interpolating an
         empty `ext` left `\$` in the pattern, an ESCAPED dollar, so the regex
         looked for a literal "$" and no archived copy could ever match.
         v3.14.135: take the extension only when there is one. */
      const ext  = path.extname(f);
      const base = ext ? path.basename(f, ext) : path.basename(f);
      const esc  = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // an archived copy is <base>…<ext>; the version suffix convention varies
      const re = new RegExp(`^${esc(base)}[A-Za-z0-9_.-]*${esc(ext)}$`, 'm');
      if (!re.test(archived))
        incomplete.push(`         ${e.version} touched ${f} — no pre-edit copy in ${dirs.join(', ')}`);
    }
  }
  if (HAVE_ARCHIVE)
    check(incomplete.length === 0,
          'every touched file has a pre-edit copy in its archive folder',
          incomplete.join('\n') + '\n         → a partial archive cannot restore the change');
  else
    console.log('  --   pre-edit copies — skipped, dev/archive/ is not distributed');

  /* ── 8a. Change files on a branch — v3.14.412 ─────────────────────────────
     An entry waiting in dev/changes/ for --release. Same shape as an edit_log
     entry except the version, which is `pending`, and the same completeness
     rule: every touched file has a pre-edit copy under the change's slug. */
  {
    const chDir = path.join(DEV, 'changes');
    const chFiles = fs.existsSync(chDir)
      ? fs.readdirSync(chDir).filter(f => f.endsWith('.md') && f !== 'README.md') : [];
    const bad = [], orders = new Map();
    for (const f of chFiles) {
      const slug = f.slice(0, -3), body = fs.readFileSync(path.join(chDir, f), 'utf8');
      if (!/^## .+/m.test(body)) bad.push(`         ${f} has no ## heading`);
      if (!/\*\*Version:\*\*\s*pending\b/.test(body)) bad.push(`         ${f} is not **Version:** pending`);
      const t = (/\*\*Type:\*\*\s*([a-z]+)/.exec(body) || [])[1];
      if (!['fix', 'feature', 'finding', 'decision', 'chore'].includes(t)) bad.push(`         ${f} has no valid **Type:**`);
      const ch = /\*\*Change:\*\*\s*`([^`]+)`\s*·\s*\*\*Order:\*\*\s*(\d+)/.exec(body);
      if (!ch || ch[1] !== slug) { bad.push(`         ${f} does not name itself on its **Change:** line`); continue; }
      if (orders.has(ch[2])) bad.push(`         ${f} and ${orders.get(ch[2])} share **Order:** ${ch[2]}`);
      orders.set(ch[2], f);
      const tch = (/\*\*Touched:\*\*\s*(.+)/.exec(body) || [])[1];
      if (!tch) { bad.push(`         ${f} has no **Touched:** line`); continue; }
      /* The edit-log word cap, checked here so it fails before --release. */
      if (body.split(/\s+/).length > 400 && !/dev\/audits\//.test(body))
        bad.push(`         ${f} is over the 400-word edit-log cap`);
      if (!HAVE_ARCHIVE || /^—|^documentation only/i.test(tch)) continue;
      const dir = path.join(DEV, 'archive', 'changes', slug);
      const have = fs.existsSync(dir) ? fs.readdirSync(dir).join('\n') : '';
      for (const raw of tch.split('·').map(x => x.trim()).filter(Boolean)) {
        if (/\((new|moved|no pre-copy)\)\s*$/.test(raw)) continue;
        const ext = path.extname(raw), base = ext ? path.basename(raw, ext) : path.basename(raw);
        const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`^${esc(base)}_pre_${esc(slug)}${esc(ext)}$`, 'm').test(have))
          bad.push(`         ${f} touched ${raw} — no pre-edit copy in dev/archive/changes/${slug}/`);
      }
    }
    /* A bug fixed on the branch waits in BUGS.md as `pending:<slug>`; the slug
       must be an open change, or --release would never replace it. */
    const bugsTxt = fs.readFileSync(path.join(DEV, 'BUGS.md'), 'utf8');
    for (const m of bugsTxt.matchAll(/pending:([a-z0-9_-]+)/g))
      if (!chFiles.includes(`${m[1]}.md`)) bad.push(`         BUGS.md says fixed in pending:${m[1]}, and no such change is open`);
    /* bug-safeguards: a bug a change file names must have a row in BUGS.md.
       Otherwise it exists only in the change notes and is lost from the table. */
    const known = new Set([...bugsTxt.matchAll(/(?:\*\*|^### )B-(\d{3,})\b/gm)].map(m => m[1]));
    for (const f of chFiles)
      for (const m of new Set([...fs.readFileSync(path.join(chDir, f), 'utf8').matchAll(/\bB-(\d{3,})\b/g)].map(x => x[1])))
        if (!known.has(m)) bad.push(`         ${f} names B-${m}, which has no row in BUGS.md`);
    if (chFiles.length || /pending:/.test(bugsTxt))
      check(bad.length === 0, `${chFiles.length} open change file(s) are well-formed and archived`, bad.join('\n'));
    else
      console.log('  --   change files — none open (main, or a branch before its first change)');
  }

  /* ── 8a'. Bugs on unmerged branches — bug-safeguards ──────────────────────
     Reported, not failed: a feature branch holding a new bug is normal. What
     must not happen is not noticing it, so every run prints it. */
  {
    const r = require('child_process').spawnSync('python3', [path.join(DEV, 'new_version.py'), '--bug-report'],
                                                  { encoding: 'utf8' });
    if (r.status === 0 && /not merged/.test(r.stdout))
      console.log(r.stdout.trim().split('\n').map(l => `  --   ${l.trim()}`).join('\n'));
  }

  /* ── 8b. The same property, asked of GIT — conflict ⑪, v3.14.393 ──────────
     The two checks above read `dev/archive/`, which is gitignored, so on every
     clone they print `-- skipped` and the strongest documentation guard in the
     project verifies nothing for anyone but the author. That was UNIFIED_AUDIT
     conflict ⑪, and `git init` at v3.14.391-392 is what made it live.

     The property worth keeping is not "a copy exists in a folder" — it is
     **every file an entry says it touched actually changed in that version**,
     and git answers that for real, on any clone, from the history itself.

     THREE THINGS THIS DELIBERATELY DOES NOT ASSERT.
     · The reverse direction. A version's commit also carries the header bumps
       `new_version.py` makes (DEV_PLAN, BUGS, PRACTICES, edit_log, RENAMES, the
       two audits, source/version.py), and those are not on the Touched line. So
       the assertion is Touched ⊆ diff, never equality.
     · The root commit. Its diff is the whole tree by definition, so "did this
       file change" has no meaning there. Exempted by name, not skipped silently.
     · A version with no commit. History starts at v3.14.392; every earlier entry
       predates git and is unverifiable here, which is a fact about the past
       rather than a failure.

     A rename moves a path, so an entry naming the old one would look unchanged.
     `dev/RENAMES.md` is the ledger for that and is consulted the same way the
     reference check above does it.

     VACUITY. With one commit in the repository there is nothing this can check,
     and a check that cannot fail is not a check (PRACTICES §7). So when zero
     versions are verifiable it reports DISABLED rather than passing — and it
     clears itself on the very next commit, because that commit gives it a
     parent to diff against. */
  const gitDir = fs.existsSync(path.join(ROOT, '.git'));
  let gitCheckable = 0;
  if (!gitDir) {
    console.log('  --   **Touched:** against git — skipped, no .git (a tarball, not a clone)');
  } else {
    const g = (...a) => {
      try { return require('child_process')
        .execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: 'pipe' }); }
      catch { return null; }
    };
    const renamed = new Map();
    for (const m of fs.readFileSync(path.join(DEV, 'RENAMES.md'), 'utf8')
                      .matchAll(/^\| `([^`]+)` \| `([^`]+)`/gm)) renamed.set(m[1], m[2]);

    const log = g('log', '--format=%H%x1f%B%x1e') || '';
    const commits = log.split('\x1e').map(r => r.replace(/^\n/, '')).filter(r => r.trim())
      .map(r => { const i = r.indexOf('\x1f'); return { sha: r.slice(0, i).trim(), msg: r.slice(i + 1) }; });

    const missing = [], rootExempt = [];
    /* Whole version only: `v3.14.41` must not match a message naming v3.14.412. */
    const namesVersion = (msg, v) =>
      new RegExp(`(^|[^\\d.])${v.replace(/\./g, '\\.')}(?![\\d])`).test(msg);
    const diffOf = sha => (g('diff', '--name-only', sha + '^', sha) || '').split('\n').filter(Boolean);
    for (const e of entries) {
      const c = commits.find(c => namesVersion(c.msg, e.version));
      if (!c) continue;
      if (g('rev-parse', '--verify', '-q', c.sha + '^') === null) { rootExempt.push(e.version); continue; }
      const changed = new Set(diffOf(c.sha));
      /* v3.14.412: a version released from a change file did its work in the
         branch commits carrying `[slug]`; the release commit only numbers it. */
      const slug = (/\*\*Change:\*\*\s*`([^`]+)`/.exec(e.body) || [])[1];
      if (slug)
        for (const sc of commits.filter(x => x.msg.includes(`[${slug}]`)))
          if (g('rev-parse', '--verify', '-q', sc.sha + '^') !== null)
            for (const f of diffOf(sc.sha)) changed.add(f);
      const named = (e.touched && !/^—/.test(e.touched) && !/^documentation only/i.test(e.touched))
        ? e.touched.split('·').map(x => x.trim().replace(/\s*\([^)]*\)\s*$/, '')).filter(Boolean) : [];
      if (!named.length) continue;
      gitCheckable++;
      for (const f of named)
        if (!changed.has(f) && !changed.has(renamed.get(f)))
          missing.push(`         ${e.version} says it touched ${f}, and ${c.sha.slice(0, 8)} did not change it`);
    }
    if (gitCheckable) {
      GIT_TOUCHED_RAN = true;
      check(missing.length === 0,
            `every **Touched:** file really changed, across ${gitCheckable} version(s) with a commit`,
            missing.join('\n') + '\n         the entry and the history disagree about what the version did');
    } else {
      console.log(`  --   **Touched:** against git — 0 verifiable version(s)`
        + `${rootExempt.length ? `; ${rootExempt.join(', ')} is the root commit, whose diff is the whole tree` : ''}`);
      console.log('       history begins at the first commit; this clears itself on the next one');
    }
  }

  /* 9. Entry types, and the fields each one implies. */
  const TYPES = ['fix', 'feature', 'finding', 'decision', 'chore'];
  const badType = [], badShape = [];
  for (const e of recent) {
    const t = (/\*\*Type:\*\*\s*([a-z]+)/.exec(e.body) || [])[1];
    if (!t) { badType.push(`         ${e.version} declares no **Type:**`); continue; }
    if (!TYPES.includes(t)) {
      badType.push(`         ${e.version} has **Type:** ${t} — not one of ${TYPES.join(', ')}`);
      continue;
    }
    e.type = t;

    if (t === 'finding') {
      /* Provenance is what separates a finding from an assertion. */
      if (!/\*\*Examined:\*\*/.test(e.body))
        badShape.push(`         ${e.version} is a finding with no **Examined:** line\n`
                    + `         → without the artefact named, nobody can re-check it`);
      /* A finding may create its OWN write-up, an audit under dev/audits/ is
         part of the finding, not a separate change. What it must not do is
         change the application. Original rule was "no touched files at all",
         which this guard rejected DOCS_AUDIT.md under; the rule was wrong, not
         the entry. */
      const touchedFiles = (e.touched && !/^—/.test(e.touched) && !/^documentation only/i.test(e.touched))
        ? e.touched.split('·').map(x => x.trim().replace(/\s*\([^)]*\)\s*$/, '')).filter(Boolean)
        : [];
      const codeTouched = touchedFiles.filter(f => !/^dev\/audits\//.test(f));
      if (codeTouched.length)
        badShape.push(`         ${e.version} is a finding but touches `
                    + `${codeTouched.join(', ')} — a finding may write up its own\n`
                    + `         audit under dev/audits/ and nothing else; this is a fix or a chore`);
      /* Any bug it claims to have filed must exist. */
      const filed = (/\*\*Filed:\*\*\s*(.+)/.exec(e.body) || [])[1] || '';
      for (const m of filed.matchAll(/\bB-(\d{3})\b/g))
        if (!new RegExp(`\\bB-${m[1]}\\b`).test(bugs))
          badShape.push(`         ${e.version} claims to have filed B-${m[1]} — absent from BUGS.md`);
    }

    if (t === 'fix' && !/\bB-\d{3}\b/.test(e.title))
      badShape.push(`         ${e.version} is a fix but its title names no B-nnn`);
  }
  check(badType.length === 0, `every recent entry declares a valid **Type:**`, badType.join('\n'));
  check(badShape.length === 0, 'each entry\u2019s fields agree with its type', badShape.join('\n'));

  /* 8. Closed bugs reach the BUGS index. */
  const missingBug = [];
  for (const e of recent) {
    for (const m of e.title.matchAll(/\bB-(\d{3})\b/g)) {
      const id = `B-${m[1]}`;
      /* An entry that FILES, investigates or RE-MEASURES a bug also names it, and
         must not be read as closing it. The sanctioned markers are
         `filed (open)`, `instrumented` and `re-measured`. The test used to be
         written twice over, once with an extra `fixed` alternative that the
         second half then discarded; same behaviour, said once.

         `re-measured` was added at v3.14.253, when B-116 was finally closed and
         the v3.14.231 entry that re-measured it started reading as a second
         closure at a different version. Re-measuring a bug is a recurring act
         here — three of B-116's own entries are that and nothing else — and it
         is the opposite of closing one. */
      /* `opened` joined them at v3.14.343, and its absence is the same defect
         this list exists to prevent. v3.14.341's title — "B-175 to B-178, opened
         by the first GUI-modality run" — is precisely the sanctioned act, said
         in the plainest available word, and it passed only for as long as those
         bugs were open: closing two of them turned an OPENING entry into a
         second closure at the wrong version. A list of sanctioned markers is a
         declaration, and a declaration is only as good as what it admits exists
         (PRACTICES §5). */
      if (/filed \(open\)|opened|instrumented|re-measured/i.test(e.title)) continue;
      /* `refined` (v3.14.296) is the fourth of these, and the narrowest: an
         entry that changes a fix already shipped. B-034 produced two versions —
         one that made the arrowheads unambiguous and one that made them
         look right after the annotator saw them — and a legibility fix getting
         a second pass is a recurring act here, not an anomaly.

         Narrow on purpose: it is only honoured when the bug ALREADY appears in
         the Fixed table at some version. A "refinement" of a bug nothing ever
         closed still fails, which is the case this check exists for. */
      const closedSomewhere = new RegExp(`\\|\\s*\\*\\*${id}\\*\\*\\s*\\|`).test(bugs);
      if (/\brefined\b/i.test(e.title) && closedSomewhere) continue;
      /* The version appears ANYWHERE in the "Fixed in" cell, not alone in it.
         A bug closed in halves has two closing versions and both are real —
         B-093's type half shipped at v3.14.193 and its transliteration half at
         v3.14.303 (D32), and the row is honest only if it says both. Requiring
         the cell to hold one version turned a split bug into a documentation
         error. The cell is still bounded by pipes, so this cannot drift into
         matching the next column. */
      const row = new RegExp(`\\|\\s*\\*\\*${id}\\*\\*\\s*\\|[^|]*\\|[^|]*\\b${e.version.replace(/\./g, '\\.')}\\b[^|]*\\|`);
      /* An OPEN bug named in a title is fine: its own `### B-nnn` heading is
         proof it is indexed. Bold-only matching failed the first entry to
         mention an open bug (v3.14.141, B-033), because an open entry's heading
         is not bold. */
      const anywhere = new RegExp(`\\*\\*${id}\\*\\*|^### ${id}\\b`, 'm');
      if (!anywhere.test(bugs))
        missingBug.push(`         ${e.version} closes ${id} — absent from BUGS.md entirely`);
      else if (!row.test(bugs) && !new RegExp(`### ${id}\\b`).test(bugs))
        missingBug.push(`         ${e.version} closes ${id} — BUGS.md lists it at a different version`);
    }
  }
  check(missingBug.length === 0, 'bugs closed in the log are indexed in BUGS.md at the same version',
        [...new Set(missingBug)].join('\n'));
}

/* 10. The guard count is written down once, and it is right.

   v3.14.349. THREE live documents each carried their own copy of it — PRACTICES
   §6, DEV_PLAN's "Where things stand", BUGS' Guards section — and two were
   stale: 70 and 77 against an actual 79. Nothing had ever compared any of them
   to the directory. That is PRACTICES §4 in the documentation rather than in the
   code, and it is worse there, because a wrong number in a document is what
   somebody plans against.

   PRACTICES §6 is now the only copy and this counts the files. The other two
   point at it, which is checked below: a re-introduced number is a
   re-introduced second writer. */
/* 11. The Fixed table stays a table.

   Its own header says "one line each: what the defect WAS, not how it was fixed"
   and records that 21 rows had grown to 600–1,250 bytes before v3.14.272
   re-compressed them — "the version this note exists to make visible the next
   time the table starts growing". By v3.14.349 four had grown back, which is
   what a note that nothing checks is worth.

   600 is the file's own number for too long. The write-up belongs in the edit
   log, which is where the row already tells you to look. */
/* 11a. The plan's work list names only open bugs.
   v3.14.418: DEV_PLAN §1 carried B-157 and B-161 as work for 48 and 43 versions
   after they were fixed, and B-109 and B-094 in the cosmetic tail. A struck-out
   (~~…~~) mention is history and is skipped. */
console.log('\nthe plan\'s work list names only open bugs\n');
{
  const plan  = fs.readFileSync(path.join(DEV, 'DEV_PLAN.md'), 'utf8');
  const bugsT = fs.readFileSync(path.join(DEV, 'BUGS.md'), 'utf8');
  /* The clusters under "What to do next", and gate 4's bug row. A struck row
     (first cell ~~…~~) and an italic paragraph are history, and are skipped. */
  const a = plan.indexOf('### What to do next'), b = plan.indexOf('### The four gates');
  const clusters = a >= 0 && b > a ? plan.slice(a, b) : '';
  const gate4 = (plan.match(/^\| \*\*Bugs\*\* \|.*$/m) || [''])[0];
  const live = [clusters, gate4].join('\n\n').split(/\n\s*\n/)
    .filter(par => !/^\*[^*]/.test(par.trim()))
    .join('\n\n').split('\n').filter(l => !/^\|\s*~~/.test(l)).join('\n')
    .replace(/~~[\s\S]*?~~/g, '');
  const openIds = new Set([...bugsT.matchAll(/^### (B-\d{3})\b/gm)].map(m => m[1]));
  const fixedIds = new Set([...bugsT.matchAll(/^\| \*\*(B-\d{3})\*\* \|/gm)].map(m => m[1]));
  const named = [...new Set([...live.matchAll(/\bB-\d{3}\b/g)].map(m => m[0]))];
  check(named.length > 0, `${named.length} bug id(s) named in §1's work list and gate tables`);
  const closed = named.filter(id => fixedIds.has(id) && !openIds.has(id));
  check(closed.length === 0, 'none of them is already fixed',
        closed.map(id => `         ${id} is in BUGS.md's Fixed table`).join('\n')
        + '\n         remove it from the list, or strike it through with the version that closed it');
}

console.log('\nthe Fixed table stays one line per bug\n');
{
  const bugs = fs.readFileSync(path.join(DEV, 'BUGS.md'), 'utf8');
  const rows = bugs.slice(bugs.indexOf('## Fixed')).split('\n')
                   .filter(l => /^\| \*\*B-\d{3}\*\* \|/.test(l));
  check(rows.length > 100, `${rows.length} fixed rows to check`);
  const long = rows.filter(l => l.length > 600)
                   .map(l => `         ${l.slice(0, 24)}… ${l.length} chars`);
  check(long.length === 0,
        'none is longer than 600 characters',
        long.join('\n') + '\n         the full write-up lives in dev/edit_log.md, which the row\n'
      + '         already points at by version');
}

console.log('\nthe guard count is written down once, and it is right\n');
{
  const dir   = fs.readdirSync(path.join(DEV, 'tests'));
  const real  = dir.filter(f => /_test\.(js|py)$/.test(f) || f === 'log_triage.js').length;
  const pr    = fs.readFileSync(path.join(DEV, 'PRACTICES.md'), 'utf8');
  const m     = pr.match(/\*\*(\d+) in `dev\/tests\/`/);
  check(!!m, 'PRACTICES §6 states the guard count');
  if (m) check(Number(m[1]) === real,
        `and it matches the directory (${real} file(s))`,
        `         PRACTICES says ${m[1]}, dev/tests/ holds ${real}\n`
      + '         update §6 — it is the one place this number lives');

  for (const [file, label] of [['DEV_PLAN.md', 'DEV_PLAN'], ['BUGS.md', 'BUGS']]) {
    const txt = fs.readFileSync(path.join(DEV, file), 'utf8');
    const copy = /\b\d+\s+guards? in `dev\/tests\/`|runs \d+ of \d+/.test(txt);
    check(!copy, `${label} does not keep a second copy of it`,
          '         it points at PRACTICES §6 instead; both copies were stale by\n'
        + '         v3.14.349, which is what a second writer is for');
  }
}

console.log('\nevery dev document says when it was written and against what\n');
{
  /* A document with no version cannot be tied to a build, which is the problem
     the app itself had before v3.14.88. Two classes, and they are stamped
     differently on purpose:

       LIVE     bumped by new_version.py, must equal the current version
       FROZEN   audits and archived designs, carry the version they were written
                against and are never bumped

     Pre-existing snapshots under dev/archive/ (packaging READMEs, old plans,
     the pre-edit copies in changes/) are out of scope: their identity is their
     filename, and stamping them would rewrite history. */
  const LIVE = ['DEV_PLAN.md', 'BUGS.md', 'PRACTICES.md', 'README.md', 'edit_log.md',
  /* v3.14.229: the unified audit and its index are LIVE. Every other audit
     records the build it was written against and is never bumped; these two
     are the current status of the others, so a stale stamp on them is the
     defect rather than the convention. */
                'audits/UNIFIED_AUDIT.md', 'audits/AUDIT_INDEX.md'];
  const _entryStart = elog.indexOf('\n## ');
  const _curM = /\*\*Version:\*\*\s*(v[\d.]+)/.exec(elog.slice(_entryStart));
  const cur = _curM ? _curM[1] : null;

  for (const f of LIVE) {
    const full = path.join(DEV, f);
    if (!fs.existsSync(full)) { check(false, `dev/${f} exists`); continue; }
    const head = fs.readFileSync(full, 'utf8').split('\n').slice(0, 3).join('\n');
    const m = /\*\*Updated:\*\*\s*(\d{4}-\d{2}-\d{2})\s*·\s*\*\*Version:\*\*\s*(v[\d.]+)/.exec(head);
    check(!!m, `dev/${f} carries an Updated / Version stamp in its header`,
          '         new_version.py stamps every live doc; a missing one means it was created outside the bump');
    if (m) check(m[2] === cur, `dev/${f} is stamped ${cur}`,
                 `         stamped ${m[2]}, current is ${cur}`);
  }

  /* ── B-208, v3.14.399: the LIVE list is READ FROM new_version.py ──────────
     The list above is `dev/`-scoped, so `README.md` in it means `dev/README.md`.
     The repository's own README, `setup.md`, `QUICKSTART.md` and
     `samples/README.md` were in no list at all and carried **no stamp of any
     kind** — the first two being what a cloner reads first.

     This is the third time. `new_version.py`'s own comment records the first two:
     BUGS.md would have rotted "by the next version if the bump did not own it",
     and RENAMES.md did rot, five versions after being added by hand. A rule
     stated in a comment and enforced by memory is not enforced.

     So the two writers become one: the bumper's tuple IS the list, parsed out of
     it here. Add a document there and this guard covers it on the next run; put
     one in this guard's scope that the bumper does not own and it fails. */
  {
    const nv = fs.readFileSync(path.join(DEV, 'new_version.py'), 'utf8');
    const blk = nv.slice(nv.indexOf('for label, doc in ('));
    const owned = [...blk.slice(0, blk.indexOf('):')).matchAll(/\('([^']+)',\s*([A-Z_]+)\)/g)]
      .map(m => m[1]);
    check(owned.length >= 12, `new_version.py owns ${owned.length} live document(s)`,
          '         parsed too few — the tuple moved and this guard stopped seeing it');

    /* The four outside dev/, resolved by the same names the bumper uses. */
    const ROOTLIVE = { 'README': 'README.md', 'QUICKSTART': 'QUICKSTART.md',
                       'setup.md': 'setup.md', 'samples/README': 'samples/README.md',
                       'TESTERS': 'TESTERS.md' };
    for (const [label, rel] of Object.entries(ROOTLIVE)) {
      check(owned.includes(label), `new_version.py bumps ${rel}`,
            `         it is live and user-facing; unowned, it rots by the next version`);
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) { check(false, `${rel} exists`); continue; }
      const head = fs.readFileSync(full, 'utf8').split('\n').slice(0, 10).join('\n');
      const m = /\*\*Updated:\*\*\s*(\d{4}-\d{2}-\d{2})\s*·\s*\*\*Version:\*\*\s*(v[\d.]+)/.exec(head);
      check(!!m, `${rel} carries a stamp`,
            '         a cloner cannot tell which build these describe');
      if (m) check(m[2] === cur, `${rel} is stamped ${cur}`,
                   `         stamped ${m[2]}, current is ${cur}`);
    }

    /* And nothing new can appear unstamped beside them. Frozen exceptions are
       named, so adding one is a decision rather than an omission. */
    const FROZEN_OK = new Set(['dev/tests/fixtures/README.md',
                               'dev/tests/fixtures/cli_ingested/README.md']);
    const strays = [];
    for (const dir of ['.', 'samples', 'dev/tests/fixtures', 'dev/tests/fixtures/cli_ingested']) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const f of fs.readdirSync(abs)) {
        if (!f.endsWith('.md')) continue;
        const rel = dir === '.' ? f : `${dir}/${f}`;
        if (Object.values(ROOTLIVE).includes(rel)) continue;
        const head = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').slice(0, 10).join('\n');
        if (!/\*\*Version:\*\*\s*v[\d.]+/.test(head) && !FROZEN_OK.has(rel)) strays.push(rel);
      }
    }
    check(strays.length === 0, 'no unstamped markdown beside the live documents',
          strays.map(f => `         ${f} has no version stamp`).join('\n')
        + '\n         add it to new_version.py\'s tuple, or stamp it frozen and name it here');
  }

  /* ── v3.14.278: documents that are OWNED but may be absent ────────────────
     `dev/archive/README.md` was in neither list, so nothing bumped it and no
     guard read it — while `source/version.py` and this very file send the
     reader to it as the authority on the project's two version streams. It
     drifted accordingly: a header stamped v3.14.134 over a body saying
     "Currently v3.14.75", an archive size four versions of growth out of date,
     and a citation to a path that moved a hundred versions ago.

     It cannot join LIVE, because `dev/archive/` is gitignored and LIVE fails on
     a missing file — every clone would go red. So it is checked WHEN PRESENT
     and skipped when the tree it lives in was not distributed, which is the
     same rule the referenced-file scan already applies. Stamped, not bumped:
     it describes the archive, not the build. */
  for (const rel of ['archive/README.md']) {
    const full = path.join(DEV, rel);
    if (!fs.existsSync(full)) {
      if (!isGitignored(`dev/${rel}`)) check(false, `dev/${rel} exists`);
      continue;                                   // absent BY DESIGN on a clone
    }
    const head = fs.readFileSync(full, 'utf8').split('\n').slice(0, 3).join('\n');
    check(/\*\*Updated:\*\*\s*\d{4}-\d{2}-\d{2}\s*·\s*\*\*Version:\*\*\s*v[\d.]+/.test(head),
          `dev/${rel} carries an Updated / Version stamp`,
          '         it is cited as an authority by source/version.py and by this guard');
  }

  const FROZEN_DIRS = [path.join(DEV, 'audits'),
                       /* v3.14.230: retired audits are still stamped and still
                          read; being answered is not being unowned. */
                       path.join(DEV, 'audits', 'retired'),
                       path.join(DEV, 'design')];
  let frozen = 0, unstamped = [];
  for (const dir of FROZEN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
      if (LIVE.includes(path.relative(DEV, path.join(dir, f)))) continue;
      frozen++;
      const head = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').slice(0, 3).join('\n');
      if (!/\*\*Updated:\*\*\s*\d{4}-\d{2}-\d{2}\s*·\s*\*\*Version:\*\*\s*v[\d.]+/.test(head))
        unstamped.push(path.relative(DEV, path.join(dir, f)));
    }
  }
  check(frozen > 0, `${frozen} frozen document(s) found to check`,
        '         zero means the walk broke, not that the tree is clean');
  check(unstamped.length === 0, 'every audit and archived design is stamped too',
        unstamped.map(f => `         dev/${f} has no stamp`).join('\n'));
}

console.log('\nedit_log entries stay short, or say where the long version lives\n');
{
  /* House style says an entry is a few lines. The median is well past that and
     drifting, and a long entry is usually reasoning that belongs somewhere it
     will actually be read: a comment at the point of use, or an audit.

     SOFT, deliberately. Over the cap is allowed when the entry names an audit
     under dev/audits/, because that is the sanctioned home for long reasoning.
     Entries written before this rule are grandfathered by version. */
  const CAP = 400;
  const RULE_FROM = 135;          // v3.14.135 onward
  const entries = elog.split(/\n## /).slice(1);
  const over = [];
  for (const e of entries) {
    const v = /\*\*Version:\*\*\s*v3\.14\.(\d+)/.exec(e);
    if (!v || Number(v[1]) < RULE_FROM) continue;
    const words = e.split(/\s+/).length;
    if (words > CAP && !/dev\/audits\//.test(e))
      over.push(`v3.14.${v[1]}: ${words} words, and names no audit`);
  }
  check(over.length === 0, `entries from v3.14.${RULE_FROM} are under ${CAP} words, or name an audit`,
        over.map(o => '         ' + o).join('\n')
        + '\n         Move the reasoning to a code comment at the point of use, or to an audit.');
}

/* ── new_version.py's docs-only path takes pre-edit copies too ──────────────
   v3.14.257. A docs-only version type (`finding`, `decision`, `--docs-only`)
   used to ignore any files named on the command line: it created no archive
   folder, copied nothing, and said nothing about either. `--add` afterwards then
   dead-ended with "start the version first" when the version HAD been started,
   so there was nowhere to put a copy even for someone who reached for one before
   editing. The only honest record left was `(no pre-copy)`, and three of those
   were filed in one session before the pattern was noticed.

   Asserted on the tool rather than on its output, because the failure is a path
   nobody takes deliberately: you meet it once, mid-change, with the files
   already edited. */
{
  const nv = fs.readFileSync(path.join(DEV, 'new_version.py'), 'utf8');

  check(/if docs_only and not files:/.test(nv),
        'docs-only with NO files still records "none — documentation only"',
        '         a finding that writes one new audit has nothing to copy, and must not be made to invent a folder');
  check(/elif docs_only:/.test(nv),
        'and docs-only WITH files archives them like any other type',
        '         naming files and having them silently ignored is how a pre-edit copy goes missing\n'
        + '         without anyone being told it went missing');

  /* Both branches must copy through the same call, or they drift. */
  const copies = (nv.match(/shutil\.copy2\(src, os\.path\.join\(arc_dir, f'\{base\}_pre_\{new\}\{ext\}'\)\)/g) || []).length;
  check(copies === 2,
        `both start-of-version paths take the copy the same way (${copies} sites)`,
        '         one path copying differently from the other is the drift this guard exists to catch');

  check(/def _slug_of_entry\(/.test(nv) && /slug_now = _slug_of_entry\(cur\)/.test(nv),
        '--add recovers the slug from the entry rather than guessing it');
  check(/os\.makedirs\(target, exist_ok=True\)/.test(nv),
        'and creates the folder when a docs-only version left none',
        '         without this, --add cannot rescue a change that grew past its original file list');
  /* v3.14.412: the branch path. change_files_test.js runs it for real. */
  check(/def start_change\(/.test(nv) && /def release\(/.test(nv) && /def relabel\(/.test(nv),
        'the branch path exists: start_change, release, relabel');
  check(/_pre_\{slug\}\{ext\}/.test(nv),
        'a change file archives under its slug, not a version it does not have yet');
  check(/no archive folder holds/.test(nv) === false,
        'the dead-end message is gone, because the dead end is gone',
        '         it told the developer to start a version that was already started');
}

console.log(`\n${pass} passed, ${fail} failed\n`);

/* Two edit_log checks — that every **Archives:** path resolves, and that every
   **Touched:** file has a pre-edit copy — read dev/archive/, which is 103 MB of
   snapshots and is not distributed. They were SKIPPED above on a clone, so this
   run verified less than a full one and must not report a plain pass. Exit 2:
   run_all.sh tallies DISABLED separately and names it on every run. */
{
  const why = [];
  if (!archiveAvailable())
    why.push('2 archive check(s) — dev/archive/ is not distributed');
  if (!GIT_TOUCHED_RAN)
    why.push('the **Touched:**-against-git check — no version yet has a commit with a parent');
  if (why.length && !fail) {
    console.log(`  DISABLED: ${why.join('; ')}.`);
    console.log('            Everything above did run. Those properties are unverified here.\n');
    process.exit(2);
  }
}
process.exit(fail ? 1 : 0);
