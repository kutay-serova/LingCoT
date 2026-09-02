# Versioning, Edit-Log & Archiving Audit
**Updated:** 2026-08-25 · **Version:** v3.14.76  
*Frozen. The version is the build this was written against, not the current one.*

**Opened:** 2026-08-24 · **Revised:** 2026-08-25 · **Against:** v3.14.76

> ### ◐ Partly implemented, status added 2026-08-25
> | § | finding | status |
> |---|---|---|
> | 1 | No version control | ◻ **open.** `git init` still pending, gated on the replacement test corpus |
> | 2 | Two version numbers disagreeing | ✅ corrected; they are two legitimate streams; documented in `dev/archive/README.md`, and `doc_integrity_test.js` now fails if they are ever made equal |
> | 3 | The app cannot report its own version | ✅ **v3.14.88.** `source/version.py`, logged at startup, shown in the help panel, asserted against the docs |
> | 4 | Archive unindexed and inconsistent | ✅ **v3.14.76.** sorted into `app/` · `changes/` · `packaging/` · `fixtures/` · `docs/` with a README index |
> | 5 | Versions assigned by hand in prose | ◐ partly. Still by hand, but `dev/new_version.py` performs the ritual and `doc_integrity_test.js` checks four conventions that were previously memory |
> | 6 | No release or rollback concept | ◻ **open.** waits on git |
>
> Tier 1 recommendations 1.2 and 1.3 shipped in v3.14.88. **1.1 (`git init`) is the
> one thing this audit asked for that has not happened**, and it is deferred by
> choice: history must not start with fieldwork in it.
**Scope:** how changes are versioned, recorded, and preserved, not what the code does.

---

## Summary

The **recording** half of this pipeline is stronger than most professional projects. The **preservation** half is a hand-rolled reimplementation of version control that costs 88 MB, is growing, and gives none of version control's guarantees.

One finding dominates everything else: **there is no version control**, and `.gitignore`. Carefully written, with reasoned per-line comments, has been sitting in the repo root the whole time. Something was set up for git and git never arrived.

| | verdict |
|---|---|
| Edit log | **Above standard.** Root causes, failed hypotheses, verification. Rare. |
| Guards / verification discipline | **Above standard.** Every guard verified against a known-bad copy. |
| Doc consistency | **Above standard.** `doc_integrity_test.js` enforces it mechanically. |
| Version identity | **Broken.** Two undocumented streams, one of them non-monotonic; the app cannot report its own. |
| Preservation / rollback | **Below standard.** Manual copies, no diffs, no restore procedure. |
| Release / distribution | **Absent.** No concept of "what shipped". |

---

## 1. No version control · **S1**

`git rev-parse` fails: there is no `.git`. Meanwhile `.gitignore` exists and is thoughtful. It excludes `.venv/`, `source/models/`, `logs/*.log` with a `!logs/.gitkeep`, and machine-specific generated files, each with a comment explaining why.

Everything else in this audit is downstream of this. The archive folder, the version numbers in prose, the manual copy-before-edit ritual. All of it is version control, reimplemented by hand, without diffs, history, bisect, branches, integrity checking, or single-file restore.

**Cost of the substitute, measured:**

| | |
|---|---|
| `dev/archive/` | **88 MB, 403 files** |
| copies of `LingCoT.html` | **186 files, 76 MB** |
| live `LingCoT.html` | 448 KB |

186 near-identical copies of one 448 KB file. Git would store the same history in a few MB of deltas.

**A trap if git is initialized as-is:** `.gitignore` line 2 excludes `dev/`. That directory holds the edit log, the dev plan, the bug list, the audits, and **all 26 guards**. Those are source, not scratch. Initializing without changing that line would leave the project's most valuable artefacts untracked.

---

## 2. Two undocumented version streams, and one non-monotonic · **S2**

```
pyproject.toml   version = "1.2.0"
dev/edit_log.md  v3.14.75
```

**Correction (2026-08-25).** An earlier draft of this audit called the mismatch
an error. It is not. The archive survey shows **two legitimate, independent
streams**:

- **v1.x, packaging.** `setup.py`, `build_env.py`, `pyproject.toml`,
  `requirements.txt`, `README.md`, `corpus_*.py`. Active 2026-04-07 → 04-24,
  last at v1.2.3 / v1.6.1. This is the number `pyproject.toml` reports, and it
  is accurate for what it versions.
- **v3.x, the application.** Currently v3.14.75.

The defect is that **nothing anywhere states this**, so the two numbers read as
a contradiction to anyone, including a future maintainer, who has not read
the archive. `dev/archive/README.md` now documents it.

**The real versioning defect is that the app stream is non-monotonic.** Sorted
by date:

```
2026-04-25   v3.9.8
2026-04-26   v4.0.9      ← renumbering begun, then abandoned
2026-04-27   v3.10.1     ← work resumes below the number already reached
```

Ten files carry v4.0.0–v4.0.9. Two more re-use numbers already spent:
`LingCoT_pre_pos_refactor_v3.7.html` (04-26) and
`LingCoT_pre_search_fix_v3.8.html` (04-27) collide with the genuine v3.7.x /
v3.8.x of 04-18 → 04-24.

Consequence: **a version number does not order the archive.** Anyone
reconstructing history must sort by date. Git would have made the abandoned
branch a branch, and the collision impossible.

## 3. The app cannot report its own version · **S2**

The version exists **only in prose.** the DEV_PLAN header and the top edit-log entry. It is:

- not in the code,
- not displayed in the UI,
- not written to the session log.

The startup line records Python, PyWebView and OS, but not the app:

```
App starting — Python 3.13.13 | PyWebView unknown | Darwin 23.5.0
```

**Consequence, concretely.** This session diagnosed B-008 from a log written three months earlier. That worked because the bug was a stack trace. Had the question been *"which build was this?"* the log could not have answered it, and with 20 versions shipped in a single day, "which build" is exactly the question a returning bug report raises.

---

## 4. The archive is now sorted and indexed: but still a hand-rolled VCS · **S3**

It earns its keep: verifying a new guard against a pre-fix copy is a genuinely
good practice and this session used it more than a dozen times.

**Fixed 2026-08-25.** The 195 loose files and 71 folders were sorted into
`app/` (by era), `changes/`, `packaging/`, `fixtures/` and `docs/`, and
`dev/archive/README.md` was written as an index. It records the **six naming
conventions** the archive accumulated between 2026-04-07 and now, the two
version streams, and the procedure for finding the copy just before a given
change. 403 files before, 403 after, moves only, no renames, no deletions.

**Still open:**

- **No completeness rule.** Some entries archive one file, some six. Nothing
  says which files a given change touched, so a restore may be partial.
- **Unbounded.** 88 MB, growing ~0.5–1 MB per change.
- **Two folder conventions inside `changes/`.** semantic slugs
  (`b008_render_crash/`) and bare versions (`v3.14.29/`). The latter says
  nothing about what changed.

Under git the whole directory becomes `git show <ref>:path` and disappears.

## 5. Version numbers are assigned by hand, in prose · **S3**

Nothing ties a version to a change set. The number is written into the edit log and the DEV_PLAN header by whoever makes the change.

Partial mitigation exists and is good: `doc_integrity_test.js` fails when the DEV_PLAN header and the newest edit-log entry disagree. That catches the commonest slip. It does not catch a skipped number, a reused one, or a version that does not correspond to any actual change.

Also worth naming: **v3.14.x is a build counter, not semantic versioning.** 20 patch bumps in one day, several of them for documentation edits. That is fine for an application, but it should be called what it is, and it is a second reason `pyproject.toml`'s `1.2.0` cannot be reconciled by simply copying the number across.

---

## 6. No release or rollback concept · **S3**

There is no notion of "what shipped to a user". No tags, no built artefact, no changelog aimed at anyone but the developer. Rollback means manually copying files out of `dev/archive/` and hoping the set is complete.

For a single-user tool this is defensible today. It stops being defensible the moment a second person runs it, or the author needs to answer "what changed between the version I was using last month and now?"

---

## Recommendations

Ordered by value per unit of added complexity. **Tier 1 is most of the benefit.**

### Tier 1: do these

**1.1 `git init`, and fix `.gitignore` first.** Remove `dev/` from the ignore list; replace it with `dev/archive/` alone. The plans, logs, audits and guards must be tracked; they are the project's memory.

**1.2 One version, in one place, read by everything.** A single `source/version.py` holding `__version__ = "3.14.75"`:
- `pyproject.toml` reads it (or is generated from it),
- `LingCoT.pyw` logs it at startup,
- the UI shows it (the File menu or help sidebar).

This is perhaps 15 lines and closes findings 2 and 3 together.

**1.3 Extend `doc_integrity_test.js`** to assert the three now agree: `version.py` == DEV_PLAN header == newest edit-log entry. The mechanism already exists; it needs one more comparison.

### Tier 2: worth it, more effort

**2.1 Freeze `dev/archive/`, stop adding to it.** Once git holds history, archiving before an edit is redundant. Keep the existing 88 MB as-is (it is the only record of pre-git history) and add nothing further. Verifying against a pre-fix copy becomes `git stash` or `git show HEAD:source/LingCoT.html`.

**2.2 A commit-message convention that mirrors the edit log.** One line: `v3.14.75 — D30 next/previous traversal`. The edit log stays the narrative; the commit ties it to an actual diff.

**2.3 Tag releases.** Only when a version is actually used for real annotation work, not every patch. `git tag v3.15.0` when a state is worth returning to.

### Tier 3: explicitly NOT recommended

CI pipelines, PR review, automated changelog generation, semantic-release, coverage gates. **This is a solo project with a 26-guard suite that runs in under a minute.** Adding process machinery would cost more than it returns. The guard suite already *is* the CI; it just needs to be run, which is exactly the discipline the project already has.

---

## What is already good, and should not be traded away

Worth stating plainly, because the fixes above should not disturb any of it:

- **The edit log records root causes and failed hypotheses.** Most projects log what changed; this one logs *why the first explanation was wrong*. That is what made B-016's diagnosis cheap.
- **Every guard is verified against a known-bad copy before being trusted.** Four guards this session passed vacuously on first write and were caught by exactly this habit.
- **Docs are mechanically consistent.** `doc_integrity_test.js` catching a version mismatch or a deleted section is a discipline most teams lack.

Git replaces the *preservation* mechanism. It should not replace any of the above.
