# dev/changes/

Edit-log entries for work on a branch that has no version number yet.

`new_version.py` writes one file here per batch of work when it runs on any
branch other than `main`. The file is an ordinary edit-log entry with
`**Version:** pending`, plus a `**Change:**` line naming its slug and the order
it was started in. `new_version.py --release` numbers every file here, moves the
entries into `edit_log.md` and moves the files into `dev/archive/changes/<slug>/`.

On `main` this folder holds only this README.

| step | command |
|---|---|
| start a change on a branch | `python3 dev/new_version.py d40a-index source/LingCoT.html` |
| add a file to it | `python3 dev/new_version.py --add dev/BUGS.md` |
| after merging `main` into the branch | `python3 dev/new_version.py --relabel` |
| at the stage boundary | `python3 dev/new_version.py --release` |
| the last stage of a minor release | `python3 dev/new_version.py --release --minor`: the last change gets X.Y+1.0 |
| the next bug id | `python3 dev/new_version.py --next-bug` |
| bugs on unmerged branches | `python3 dev/new_version.py --bug-report` |

Procedure and reasons: `dev/PRACTICES.md` §1, Branches.
