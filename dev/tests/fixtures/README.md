# dev/tests/fixtures/ — specimens

**Not examples.** Everything here is small, purpose-built and, where the guard
needs it, degenerate on purpose. `samples/` is the folder a fieldworker should
open and imitate; this is the folder a guard opens to reach a shape no annotator
should ever produce. D58 §0 split the two, after `samples/turkish-test` had spent
a year being both at once.

Each specimen carries a header saying **why it is the way it is** and **which
guard or bug it serves**. A specimen with no reader is not a keepsake — delete
it; that is D58 §3, and it is what emptied this folder's predecessor.

| specimen | serves | why it looks like that |
|---|---|---|
| `cli_ingested/` | `prov_intern_test` — the "not yet interned, must shrink" branch | it is the shipped CLI's own output, which is a **current input format**: every corpus a user starts from a text file is in this shape until the app first saves it |
