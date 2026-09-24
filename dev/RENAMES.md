# Renamed and removed files

**Updated:** 2026-09-24 · **Version:** v3.15.4

*A frozen document is stamped with the version it was written against and is
never rewritten (PRACTICES; `dev/audits/AUDIT_INDEX.md` records the drift). So
when a file is renamed, every frozen document that cites it keeps citing the old
path — and `doc_integrity_test.js` fails on a path that is not on disk.*

**The alternative was worse both ways round:** rewrite frozen documents, which
destroys the thing that makes them worth keeping, or never rename a file. This
ledger is the third option. `doc_integrity_test.js` consults it, so an old path
resolves to what it became and a genuinely dangling reference still fails.

**Add a row when you rename or delete a file that any document may cite.** The
reason column is not decoration: a reader who follows an old path wants to know
whether the thing moved or stopped existing.

| old path | became | when | why |
|---|---|---|---|
| `dev/tests/search_b_test.js` | `dev/tests/search_test.js` | v3.14.388 | the `B` distinguished it from an engine retired at v3.14.38 |
| `dev/tests/search_b_routing_test.js` | `dev/tests/search_routing_test.js` | v3.14.388 | same |
| `dev/tests/search_b_matcher_test.js` | `dev/tests/search_matcher_test.js` | v3.14.388 | same |
| `dev/tests/search_b_concordance_test.js` | `dev/tests/search_concordance_test.js` | v3.14.388 | same |
| `dev/tests/_search_b.js` | `dev/tests/_search.js` | v3.14.388 | same |
| `dev/tests/search_parity_test.js` | `dev/tests/search_invariants_test.js` | v3.14.388 | **not a rename.** It proved the engine matched a previous one; that engine is gone, and parity with nothing is not a property. The harvest and the two-corpus sweep survive, asserting properties the engine must have on its own |
| `source/modules/search_b.js` | `source/modules/search.js` | v3.14.388 | merged into it, with the last of the retired engine deleted |
| `dev/audits/DATA_INTEGRITY_2026-08-30.md` | `dev/audits/retired/DATA_INTEGRITY_2026-08-30.md` | v3.14.390 | retired: both corpora it measured were replaced by the fixture swap at v3.14.384, so both columns of every table in it are stale. §5 is schema and outlives the data |
| `dev/audits/L_STATUS_2026-08-30.md` | `dev/audits/retired/L_STATUS_2026-08-30.md` | v3.14.390 | retired: `UNIFIED_AUDIT.md` computes its own counts and runs to L-042; a second reconciliation of L-001…L-022 is PRACTICES §4 |
