# dev/: plans, history, and the guard suite
**Updated:** 2026-09-22 · **Version:** v3.14.411

This directory is the development record. It is not needed to run LingCoT; see
the top-level `README.md` and `setup.md` for that.

| file | what it is |
|---|---|
| `DEV_PLAN.md` | what is planned, what is deferred, and why. Start here. |
| `BUGS.md` | open bugs in full, fixed bugs as a one-line index |
| `PRACTICES.md` | the conventions, each attached to the bug that taught it |
| `edit_log.md` | one entry per version: what changed, why, how it was verified |
| `audits/` | longer investigations, each stating whether it is implemented, open, or moot |
| `design/` | design documents for features that have shipped, kept because they explain the shape of the code |
| `tests/` | the guard suite. `./dev/tests/run_all.sh` runs the default set; `--slow` adds the two release checks |
| `tests/_gui.js` | the app in headless Chromium, with the pywebview bridge backed by a real directory. Needs Playwright; exits 2 without it |
| `archive/` | pre-edit snapshots, one folder per change. Not committed; see below |
| `new_version.py` | starts a version: bumps, archives the files you are about to edit, stubs the log entry |

## How this record was written

**The development log, plans, bug write-ups and audits in this directory were
written by an AI assistant (Claude, Anthropic) working with the author.** The
code was written the same way.

The archive is excluded from version control, so in a fresh clone the two
`doc_integrity_test.js` checks that read it are skipped and the guard exits 2,
DISABLED. That is expected, not a broken checkout — everything else in it runs,
and the exit code exists so a partial run is never read as a full one.

`undefined_call_test.js` used to do the same and no longer does: L-018 found it
running its real check on every clone and then discarding the result as DISABLED
because its self-proof was an archived copy. The self-proof is constructed now
(v3.14.338), so the guard is strictly stronger and needs nothing.

## Conventions worth knowing before contributing

- **Start a version with `python3 dev/new_version.py --type <type> <slug> <files…>`.** It
  archives the named files before you edit them, which is the whole point of the
  ordering. It also bumps the version, stamps the live documents and prepends a
  stub log entry with the `**Touched:**` line filled in.
- **Every log entry declares a type**, in its `**Type:**` line: one of `fix`,
  `feature`, `finding`, `decision` or `chore`, passed to `new_version.py` as
  `--type`. A `fix` names its `B-nnn` in the title. A `finding` needs an
  `**Examined:**` line, and may write up its own audit but must not touch the
  application. `doc_integrity_test.js` checks all of that, along with the
  archive completeness rule.
- **Write a guard only when a bug reveals a rule**, not to pin the instance that
  broke. `DEV_PLAN.md` §1 has the test for telling those apart.
- **Read a corpus through `tests/_fixture.js`**, not with a private JSONL parse.
  `loadCorpus` and `loadCompanion` resolve the fixture, read the one file shape
  that exists on disk — JSONL, one object per line — and lift out the format rows
  so a tree walk sees documents only. It handled three until v3.14.386, when the
  other two were found to have no writer. **Twenty** guards read their files
  through it (13 when the rule was made at v3.14.245); before that each had its
  own parse, and one new format row broke four of them at once. The figure is
  `grep -l _fixture dev/tests/*.js` — take it rather than trust this line.
- **Verify a new guard against a known-bad copy** before trusting it. Guards that
  pass while checking nothing have been a recurring problem here, and the archive
  exists partly so a guard can be run against the version that failed.
- **Assert on the file, not on `S.docs`.** For anything a control writes, read
  the saved JSONL back — the object the writer was handed is not the bytes it
  produced (B-127). `tests/_gui.js` exports `readCorpus`/`walkWords`/`walkSents`
  for exactly that. `PRACTICES.md` §6 has the three modalities and what each is
  blind to.
- **The two release checks are not in the default run.** `nllb_diag_test.py` and
  `gui_crud_test.js` run under `./dev/tests/run_all.sh --slow`. Without a browser
  the second exits 2, DISABLED, which is why it is not a save-loop guard.
- **This tree has no `package.json` and no `node_modules`, and should keep it that
  way.** Every guard but one runs on Node builtins; a clone needs nothing
  installed. `gui_crud_test.js` needs playwright, so `_gui.js` looks for it
  OUTSIDE the repo first — `~/.lingcot-dev/`, then a global install, then
  `$LINGCOT_PLAYWRIGHT` — and falls back to normal resolution. Install once per
  machine:

      mkdir -p ~/.lingcot-dev && cd ~/.lingcot-dev
      npm init -y && npm i playwright        # 19 MB
      npx playwright install chromium        # 195 MB, cached per MACHINE

  The browser lands in `~/Library/Caches/ms-playwright` (macOS) or
  `~/.cache/ms-playwright` (Linux), shared by every project and downloaded once;
  `PLAYWRIGHT_BROWSERS_PATH` moves it. Neither ever sits inside this tree, so
  neither needs a `.gitignore` line. When nothing is found the guard exits 2 and
  prints every path it looked in.
- **Run the app.** Most defects in this project were found by using it, not by
  the suite. A green suite is not a substitute.
