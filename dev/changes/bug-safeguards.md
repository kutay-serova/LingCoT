## Bugs recorded on branches cannot be lost unnoticed: report, id allocation, table check (2026-09-24)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/bug-safeguards/` (v3.14.419)
**Touched:** dev/new_version.py · dev/tests/change_files_test.js · dev/tests/doc_integrity_test.js · dev/PRACTICES.md · dev/changes/README.md
**Change:** `bug-safeguards` · **Order:** 10

**What changed.**
- `new_version.py --bug-report`: for each local and remote branch not merged into `main`, the bug ids its `BUGS.md` has and `main`'s does not. It also runs, silent when empty, at every start on `main` and at `--release`; `doc_integrity_test.js` prints it on every run.
- `new_version.py --next-bug`: the next free B-nnn after reading `BUGS.md` on every branch.
- `doc_integrity_test.js` §8a: every B-nnn a change file names must have a row in `BUGS.md`.
- PRACTICES §1 Branches: four rules, including fixing a bug that is also in `main`'s code on `main` first.

**Why.** A bug recorded on a branch reaches `main` only by the merge. An abandoned or deleted branch loses it, two branches can take the same id, and a bug named only in change notes is not in the table. B-215 showed the fourth case: in `main`'s code, fixed only on the branch.

**Guard.** `change_files_test.js` +4 in a temp repository: the report names the branch and only the bug `main` lacks, `--next-bug` counts the branch's ids, the current branch does not report itself, a merged branch drops out. §8a's new check (mutation: an id with no row, added to a change file, fails it).

**Verification.** `./dev/tests/run_all.sh` — 103 passed, 0 failed. `--bug-report` on this repository: no unmerged branch holds a bug main lacks; `--next-bug`: the id after the highest on any branch.
