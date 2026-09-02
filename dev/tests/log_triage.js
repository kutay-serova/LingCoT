#!/usr/bin/env node
/* =============================================================================
   log_triage.js, the logs must not accumulate unexamined errors
   Run:  node dev/tests/log_triage.js          (guard: fails on unacknowledged errors)
         node dev/tests/log_triage.js --report (never fails; prints the full picture)
   =============================================================================
   WHY THIS EXISTS
   ---------------
   On 2026-08-24 a grep of the retained logs found this in
   `logs/app_2026-05-29_154303.log`:

       TypeError: t is not a function. (In 't('status.no_translation')', 't' is null)

   That is B-008, the defect that killed section view and five Save buttons. It
   was captured perfectly, with level, message, source line and full stack, on
   **2026-05-29**, and went unread for nearly three months.

   The logging was never insufficient. Nothing ever *looked*, so the answer to
   "should logging be more detailed?" is no, 65 lines a session is scannable in
   ten seconds, and burying three important lines in three hundred would have
   hidden B-008 better, not worse. What was missing is this: something that reads
   the logs on every run of the suite and fails when they contain an error nobody
   has accounted for.

   HOW IT WORKS
   ------------
   Every WARNING/ERROR/CRITICAL line across `logs/` is reduced to a SIGNATURE, the message with volatile parts (timestamps, ports, ids, paths, line/column
   numbers, byte counts) masked out, so the same defect recurring in nine
   sessions is one finding, not nine.

   Each signature must appear in ACKNOWLEDGED below, with what happened to it.
   An unrecognised signature fails the guard. That is the same idiom
   `selector_audit_test.js` uses for KNOWN_DEAD: residue stays visible and
   attributable rather than silently skipped.

   WHEN A GUARD FAILS HERE, THE FIX IS NOT TO ADD AN ENTRY. Read the error, fix
   the defect or confirm it is already fixed, and *then* record it with the
   version that resolved it. An entry is a claim that someone looked.

   LIMITS
   ------
   · Signature masking is heuristic; two unrelated errors could collide. The
     failure direction is safe (one gets acknowledged with the other's reason),
     and the report mode prints full examples so collisions are visible.
   · Logs are pruned to MAX_SESSION_LOGS (20) by log_setup.py, so history is
     bounded, an old defect can age out. That is fine: this guards the window
     the project actually keeps.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const LOGS = path.join(__dirname, '..', '..', 'logs');
const REPORT_ONLY = process.argv.includes('--report');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

/* ── Known signatures, each with what happened to it ──────────────────────────
   Key, the masked signature (run --report to get the exact string).
   Value, what it was and how it was resolved. */
const ACKNOWLEDGED = {
  /* B-195, and the app found it before anyone asked. `danglingCompanions` counted
     7 unresolved lemma_id in turkish-test, which is exactly what an independent
     walk of the files finds: 5 words and 2 dictionary entries cite `su`, `içmek`
     and `tekrar`, whose lemma RECORDS are not in the dictionary file.

     Not the section deletion — those words are all in `sec_003`, which survived.
     The corpus is journalled on every save and the lexicon is not: the session
     that created the three lemmas (20:24–20:25, `app_2026-09-01_200551`) appended
     to the journal after each word and exited at 20:27:56 without ever writing
     the dictionary. The `lemma_id` on the token was durable; the record it names
     lived only in `S.lemmas`. The next session's dictionary save then wrote the
     loss in permanently, because `_carryUnsavedLemmas` starts from an empty
     registry on a fresh launch and had nothing to carry.

     Repairable: `danglingLemmas()` and the dict-browse repair banner exist for
     this (D52 stage D). Remove this entry when B-195 closes AND the fixture is
     repaired — the line is about the data, so it returns until both are done. */
  /* B-199, and the mechanism is in the timing of the log lines rather than in
     any one of them. `beforeunload` fires `compact('exit')`, which cannot be
     awaited: it writes the base and truncates the journal, in that order, and
     the window is gone before the second step. `write_abs` logs "File saved"
     AFTER `os.replace`, so a process that dies between the two leaves the base
     replaced and no line saying so — which is exactly the shape of
     `app_2026-09-01_220100`: an append at 22:13:43, "exited cleanly" at
     22:13:45, no save line, and a 1,685-char journal left on disk whose head
     fingerprints the base written at 22:11:10.

     The next open then REFUSES the project outright. The two halves of D50
     disagree about what a stale journal is: `compact` leaves one deliberately
     ("a stale journal replays as a no-op, a lost one does not") and the load
     treats the same artefact as a mispaired file and returns without opening
     anything. Remove this entry when B-199 closes. */
  "[JS] journal does not belong to this base corpus":
    "B-199, FIXED v3.14.382 — an exit-time compaction that got as far as the " +
    "base and not as far as the truncation. The corpus would not open; the " +
    "annotator's only route back in was editing files by hand.",

  /* The same defect naming both files. Worth its own line rather than a looser
     signature: `corpus+dictionary` means BOTH bases moved past the journal, which
     is what a session does when it writes one file and not the other — and it is
     the form that was live on 2026-09-01 23:59, the session where the abort left
     `_savePath` unset, `journalPath()` empty, and every edit unsaved. */
  "[JS] journal does not belong to this base corpus+dictionary":
    "B-199, FIXED v3.14.382 — the two-file form. The load aborted before autosave " +
    "is armed, so journalPath() is '' and flushJournal returns 0 silently: the " +
    "session reports every save and writes nothing at all.",

  "[JS] companion references unresolved N dict_id, N lemma_id, N provenance stamp(s) in turkish-test_corpus":
    "B-195, OPEN, 2026-09-02 — 7 unresolved lemma_id. The lexicon has no journal, " +
    "so three lemma records created at 20:24–20:25 died with the session that " +
    "made them while the tokens citing them were journalled and survived.",

  "[JS] companion references unresolved N dict_id, N lemma_id, N provenance stamp(s) in chinese-test_corpus":
    "B-154, FIXED v3.14.292 — danglingCompanions doing its job. Lemma record " +
    "dict_1788136387362_9g5m8 is named by the dictionary entry for the Chinese " +
    "classifier and by one corpus token, and no lemma row with that id is in the " +
    "dictionary file. The count is the REFERENCES, not the records, so 2 here is " +
    "one missing record seen from both sides. Remove this entry when B-154 " +
    "closes; the form-free signature means a second project hitting the same " +
    "thing surfaces as a new case rather than folding into this one. The cause " +
    "was applyDict replacing S.lemmas wholesale; D52 stage D can rebuild the " +
    "record from what still cites it. Remove this entry once the fixture is " +
    "repaired in the app and the warning stops appearing.",

  "[JS] render failed: dict Can't find variable: isLemma":
    "B-101, 2026-08-28 — D35 A2 deleted `const isLemma` from renderDict when a " +
    "lemma stopped being a dictionary entry, and left two consumers behind: the " +
    "Member Forms panel and the examples guard. The panel was dead code by then " +
    "(a lemma entry can no longer be navigated to), so it was removed rather " +
    "than repaired; D35 B5 builds the group view that replaces it. Same shape as " +
    "B-081 — a deleted declaration with surviving readers — and undefined_call_" +
    "test.js does not catch it, because it checks CALLS and this is a variable. " +
    "Fixed v3.14.194.",

  /* B-108, all four forms, FIXED v3.14.361. Kept until the log window prunes
     them: the lines are real history and an unacknowledged signature is a red
     suite. The explanation is written once here and the other three point at it.

     `renderMorphSuggestPanel` passed the RAW parse field to
     `suggestParseEntries` while `takeOffer`'s splice read `parse || word.form`.
     For a word with NO parse those disagreed: no parse matches meant an empty
     `parseForms`, so the filter whose job is "do not offer an entry that is
     already a segment" removed nothing, and the entry arrived as a form match
     (`set-parse`). `taken` is only computed for `fill-rows`, so a row that was
     already complete AND already linked got a live chip that wrote nothing.

     The per-form signature did its job exactly as designed: four fresh cases,
     and the pattern across them was the evidence that they were one case. */
  /* THE FIFTH FORM, and it is NOT B-108's case. Logged 2026-09-01 20:07 by a
     build running v3.14.365 — which already carries B-108's fix — so something
     else produces this line. Filed as B-193: the offer strip is repainted when
     `#ew-parse` changes and after a take, but NOT when a morpheme ROW is typed
     into. `refreshDerivePreviews` is called on `.morph-gloss-input`; the strip
     beside it is not. So a chip drawn while the rows were empty stays drawn
     after they are filled, and clicking it writes nothing.

     The 25 s between `navigate: word-edit` and this line, in the same log, is
     the typing. Remove this entry when B-193 closes. */
  "[JS] offer filled nothing tilki · N row(s) on screen":
    "B-193, FIXED v3.14.367 — a STALE strip, not B-108. Fired under v3.14.365, " +
    "which has B-108's fix. The chip was drawn against empty rows and clicked " +
    "after they were filled by hand; only #ew-parse and a take repainted the " +
    "strip. Typing in a row now repaints it too, on every field the offer reads. " +
    "Remove all five entries once the log window no longer holds these lines.",

  "[JS] offer filled nothing salkım · N row(s) on screen":
    "B-108, FIXED v3.14.361 — see the `ve` entry. Third form, from live use.",

  "[JS] offer filled nothing üzüm · N row(s) on screen":
    "B-108, FIXED v3.14.361 — see the `ve` entry. Fourth form, same session.",

  "[JS] offer filled nothing DA · N row(s) on screen":
    "B-108, FIXED v3.14.361 — see the `ve` entry. Second form, and the first " +
    "since D55 made a take overwrite; two rows on screen rather than one, so " +
    "it was never a single-morpheme artefact.",

  "[JS] offer filled nothing ve · N row(s) on screen":
    "B-108, FIXED v3.14.361. The first of four, 2026-08-28. The chip offered " +
    "`COORD · and` to a row that already said `COORD · and` and was already " +
    "linked to that entry, so taking it wrote nothing. Cause: the panel and the " +
    "splice read different answers to \"what is the parse\" when there is none — " +
    "the panel took the raw field, the splice fell back to the word's own form. " +
    "One `workingParse()` now, so the filter that suppresses an already-segmented " +
    "entry sees what the splice would do. Remove all four entries once the log " +
    "window no longer holds these lines.",


  "[JS] re-tokenization would discard N annotated morpheme(s)":
    "Not a defect — this is B-075's guard doing its job. Editing a parse that " +
    "would orphan an annotated morpheme asks before discarding it, and the " +
    "warning records that it asked. Expected whenever a parse is revised over " +
    "existing annotation; it is logged so a SILENT discard would be the " +
    "anomaly. Keep this entry.\n\n" +
    "The token used to be in the key (Turkish `hakk`), so every new form failed " +
    "the suite on correct behaviour — three of them by the first Chinese " +
    "session. Masked at v3.14.284; the form is in the log line, which is where " +
    "an instance belongs.",

  "[JS] google translate failed TypeError: Load failed":
    "B-086, FIXED v3.14.219, and this line still appears and still means " +
    "something. 'Load failed' is WebKit's wording for a request that never " +
    "completed, so the app is reporting truthfully: the request was refused or " +
    "blocked rather than slow, both attempts having failed inside one second " +
    "against an 8-second timeout.\n\n" +
    "What B-086 fixed is that the settings panel used to DISAGREE with this " +
    "line, reporting 'online' from navigator.onLine while every request failed. " +
    "It probes the real endpoint now and shows what came back, and the failure " +
    "modal carries the recorded error instead of guessing at 'you may be " +
    "offline'.\n\n" +
    "Keep this entry. The warning is expected whenever the endpoint is genuinely " +
    "unreachable. What to check on a recurrence is whether the Google row in " +
    "translation settings agrees with it: a panel saying 'reachable' while this " +
    "fires is a new bug.",

  "[JS] render failed: corpus-new Can't find variable: requiredMark":
    "B-081, 2026-08-28 — the D45 rewrite of chipRowHtml sliced back to the " +
    "nearest comment opener, which belonged to requiredMark() directly above " +
    "it. The function was deleted; its seven call sites were not, and every one " +
    "of them is inside a template literal, so corpus-new and five other views " +
    "threw on render. Fixed v3.14.177 by restoring the function AND by fixing " +
    "undefined_call_test.js, which had blanked template literals wholesale and " +
    "therefore could not see a call site in the only place this app makes them. " +
    "A recurrence means the guard regressed, not that the function is missing.",

  "[JS] re-tokenization would discard N annotated morpheme(s) (y)I":
    "NOT A DEFECT — this is B-057's protection announcing itself. Editing a " +
    "parse so that an annotated morpheme no longer aligns makes the app WARN and " +
    "ask before discarding it (confirmAnnotationLoss, four call sites), and the " +
    "warning is logged whether or not the annotator then confirms. Appeared " +
    "2026-08-28 during test-corpus annotation on the Turkish suffix (y)I. Expect " +
    "it whenever a parse is revised. Its absence would be the defect.",

  "[JS] fold-context: key version changed corpus was keyed under v1, now v2 — run dict_dedupe.js to check for duplicates the old key created":
    "NOT A DEFECT — this warning is working as designed, and it appeared for the " +
    "first time on 2026-08-25 only because B-062 had broken the call that emits " +
    "it. B-043 (v3.14.103) versioned the dictionary key; a corpus last handled " +
    "under v1 (bare toLowerCase) may hold entries the v2 key would have matched, " +
    "so the app says so once per load and points at source/scripts/dict_dedupe.js. " +
    "Expected on every pre-v3.14.103 corpus. Remove this entry only when no " +
    "v1-keyed corpus is in use.",

  "[JS] console.error: openCorpusDialog failed:":
    "B-062, 2026-08-25 — v3.14.103 introduced two calls to log(...) inside " +
    "refreshFoldContext(). There is no log() in this codebase; the logger is " +
    "logEvent(level, event, detail). applyCorpus() calls refreshFoldContext(), so " +
    "OPENING ANY CORPUS threw a ReferenceError for eight versions, and it reached " +
    "a user before any guard noticed. The log line shows '{}' because a " +
    "ReferenceError has no enumerable own properties, so console.error's object " +
    "serialised to nothing — the error was captured and still said almost " +
    "nothing. Reported to the user as 'Could not open file dialog', because " +
    "openCorpusDialog wrapped dialog + parse + applyCorpus in ONE try/catch whose " +
    "handler named only the dialog (B-063, same defect as B-031). Fixed v3.14.111: " +
    "both calls use logEvent, and the catch reports which stage failed. Guarded by " +
    "undefined_call_test.js — calling is not defining.",

  "[JS] console.error: get_workspace failed:":
    "B-024, 2026-08-25 — extracting WORKSPACE into source/workspace.py changed " +
    "its type from str to pathlib.Path. pywebview JSON-serialises API returns, " +
    "and a PosixPath is not serialisable, so get_workspace() failed opaquely; the " +
    "same Path reached create_file_dialog(directory=), which returned nothing, so " +
    "the Open Corpus File button did nothing AND logged nothing. Fixed v3.14.80: " +
    "LingCoT.pyw coerces both values to str at the import boundary. Guarded by " +
    "workspace_test.js, which now EXECUTES python3 to check the payload " +
    "serialises rather than reading the source for it.",

  "[JS] window.onerror: TypeError: t is not a function. (In 't('status.no_translation')', 't' is null)":
    "B-008 — a local `const t = sentTrans(s)` shadowed the global t() locale fn. " +
    "Fixed v3.14.57; guarded by locale_shadow_test.js and render_untranslated_test.js.",

  "read_file failed for 'PATH': [Errno N] No such file or directory: 'PATH'":
    "settings.json did not exist yet (seen 2026-05-29 → 2026-06-13). The file now " +
    "ships in source/resources/locale/ and the error has not recurred since.",

  "[JS] translation failed (no result)":
    "2026-08-23, backend 'auto' — Google unreachable AND the NLLB server not " +
    "responding, so both legs failed. This is the reported NLLB linking failure, " +
    "tracked as DEV_PLAN D29. NOT a separate defect: D29 P1 (capture the server's " +
    "stderr) is what will say why. Re-check this entry once D29 P1 lands.",

  "NLLB server exited immediately (code N). Output: PATH":
    "2026-08-23 — `OSError: [Errno 48] Address already in use`. The app never " +
    "stopped the server it started, so quitting left an orphan holding port 5001 " +
    "and the next Start died on the bind. Root cause fixed v3.14.64 (shutdown on " +
    "exit + port preflight + identity check); guarded by dev/tests/nllb_diag_test.py. " +
    "This entry covers the historic occurrence — a NEW one after v3.14.64 means " +
    "a different cause, so read it rather than widening this reason.",

  "start_nllb_server: port N is held by something that is not an NLLB server. Stop it, or change the server URL in Translation Settings.":
    "B-017, 2026-08-23 — a FALSE conflict. The probe bound without SO_REUSEADDR " +
    "while the server it gates sets allow_reuse_address, so a port in TIME_WAIT " +
    "(normal seconds after our own server stops) refused the test bind; and that " +
    "state was misreported as 'foreign' rather than 'unknown'. Fixed v3.14.65: " +
    "probe matches the server, and 'busy_unknown' proceeds instead of refusing. " +
    "A recurrence after v3.14.65 names the holder via lsof and IS a real conflict.",

  "Corpus file not found: serve":
    "2026-04-26, scripts log — `corpus_annotate.py` was invoked with a bare " +
    "`serve` rather than `--serve`, so it was taken as the positional corpus path. " +
    "Argument parsing is correct today (`--serve` is store_true, `corpus` is " +
    "nargs='?'), and it has not recurred in four months. Invocation mistake, not a bug.",
};

/* Mask the volatile parts of a message so recurrences collapse to one finding. */
function signature(msg) {
  return msg
    .replace(/https?:\/\/[^\s"']+/g, 'URL')
    // Any quoted string containing a slash is a path, absolute or relative.
    // Matching only leading-'/' first left 'resources/locale/settings.json'
    // exposed, and the unquoted rule below then chewed its tail into
    // "'resourcesPATH'". Quoted first, greedy about slashes, is the stable order.
    .replace(/'[^']*\/[^']*'/g, "'PATH'")
    .replace(/"[^"]*\/[^"]*"/g, '"PATH"')
    // Unquoted absolute paths too. Without this, a message naming its own
    // timestamped log file kept a fragment of the timestamp in the signature, so
    // every recurrence looked like a brand-new finding.
    //
    // A space is consumed only when a later '/' shows it is still inside the
    // path, this project lives in "./Corpus Builder/.", and a first attempt
    // that stopped dead at whitespace produced the nonsense "PATH BuilderPATH".
    .replace(/\/(?:[^\s"']+|\s(?=\S*\/))+/g, 'PATH')
    .replace(/\{.*$/, '')                       // trailing JSON payload
    .replace(/\bdoc_\d+[\w.]*/g, 'ID')
    .replace(/\b[a-z_]+_\d{3,}\b/g, 'ID')
    .replace(/\bErrno \d+\b/g, 'Errno N')
    .replace(/\b\d[\d,]{2,}\b/g, 'N')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\s+/g, ' ')
    /* v3.14.284: for THIS message the trailing token is the instance, not the
       kind. The entry below says so itself — "the form is part of the signature,
       so a different word surfaces as a NEW entry… it would be noise once the
       bug is closed" — and for the retokenization warning it always was noise,
       because that warning is not a bug at all. A Chinese annotation session
       produced two more signatures in one sitting (`炎热`, `下午`) on top of
       Turkish `hakk`, so the suite went red on the app behaving correctly, which
       is the guard-that-goes-red-on-success shape (UNIFIED §5.3). B-108's entry
       keeps its form deliberately and is not masked. */
    .replace(/(re-tokenization would discard N annotated morpheme\(s\)).*$/, '$1')
    .trim();
}

const LINE = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}\s+(WARNING|ERROR|CRITICAL)\s+\S+\s+—\s+(.*)$/;

let files = [];
try {
  files = fs.readdirSync(LOGS).filter(f => f.endsWith('.log')).sort();
} catch {
  console.log('\n  note logs/ does not exist yet — nothing to triage\n');
  process.exit(0);
}

/* signature → { level, count, firstDate, lastDate, files:Set, example } */
const found = new Map();
for (const f of files) {
  const text = fs.readFileSync(path.join(LOGS, f), 'utf8');
  for (const raw of text.split('\n')) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const [, date, level, msg] = m;
    // The exit summary this guard's companion change added is a report ABOUT
    // errors, not an error. Counting it would make every noisy session produce
    // one extra permanent finding.
    if (/^App exited — THIS SESSION RECORDED/.test(msg)) continue;
    const sig = signature(msg);
    const e = found.get(sig) || { level, count: 0, firstDate: date, lastDate: date, files: new Set(), example: msg };
    e.count++;
    e.files.add(f);
    if (date < e.firstDate) e.firstDate = date;
    if (date > e.lastDate)  e.lastDate  = date;
    if (level === 'CRITICAL' || (level === 'ERROR' && e.level === 'WARNING')) e.level = level;
    found.set(sig, e);
  }
}

console.log(`\nlog triage — ${files.length} retained log file(s)\n`);

if (found.size === 0) {
  console.log('  ok   no warnings or errors in any retained log\n');
  process.exit(0);
}

/* ── The findings, newest activity first ─────────────────────────────────── */
const sorted = [...found.entries()].sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate));
for (const [sig, e] of sorted) {
  const known = ACKNOWLEDGED[sig];
  const mark  = known ? 'known  ' : 'NEW    ';
  console.log(`  ${mark}[${e.level}] ×${e.count}  ${e.firstDate} → ${e.lastDate}  (${e.files.size} session${e.files.size > 1 ? 's' : ''})`);
  console.log(`         ${e.example.slice(0, 150)}`);
  if (known) console.log(`         ↳ ${known}`);
  else       console.log(`         ↳ NOT ACKNOWLEDGED — read it, fix it, then record it in ACKNOWLEDGED.`);
  if (REPORT_ONLY) {
    console.log(`         signature: ${sig}`);
    console.log(`         files: ${[...e.files].join(', ')}`);
  }
  console.log('');
}

if (REPORT_ONLY) {
  console.log(`${found.size} distinct signature(s). Report mode — not failing.\n`);
  process.exit(0);
}

/* ── Guard assertions ─────────────────────────────────────────────────────── */
const unknown = sorted.filter(([sig]) => !ACKNOWLEDGED[sig]);
check(unknown.length === 0,
      `${found.size} distinct signature(s), all acknowledged`,
      unknown.map(([sig, e]) =>
        `         [${e.level}] ${e.firstDate} → ${e.lastDate}\n` +
        `         ${e.example.slice(0, 150)}\n` +
        `         signature: ${sig}`).join('\n\n'));

/* The acknowledgement list must not rot either: an entry matching nothing in the
   retained window is either stale or its signature drifted. Not a failure, logs are pruned, so entries ageing out is normal, but say so. */
const stale = Object.keys(ACKNOWLEDGED).filter(sig => !found.has(sig));
if (stale.length) {
  console.log(`\n  note ${stale.length} acknowledged signature(s) no longer appear in the retained window:`);
  for (const s of stale) console.log(`         ${s.slice(0, 120)}`);
  console.log('         (expected as logs are pruned — remove if permanently resolved)');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
