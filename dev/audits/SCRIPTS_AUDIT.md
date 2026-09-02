# SCRIPTS AUDIT: the CLI tools write a schema the app stopped reading
**Updated:** 2026-08-28 · **Version:** v3.14.149  
*Frozen. The version is the build this was written against, not the current one.*

> ### S1, S2 and S3 shipped at v3.14.151 (B-078)
> The ingester writes the current schema, `corpus_annotate.py` reads and writes
> `translations` through one pair of helpers, and `cli_schema_test.js` now
> ingests a real file and conforms the result. **S3 failed on its first run**, on
> residue S1 had not touched: six bibliographic metadata fields, which were
> documented rather than deleted, and `schema_version`, which was removed.
> **S4 closed at v3.14.152**, by correcting the README rather than moving the
> file: the load path works, and moving it would be churn with no bug prevented.
> **S5 remains.**

**Status:** findings only when written; §7 records what has since shipped. This is **D36**, opened because the
README documents these tools and nobody had checked whether the documentation, or
the tools, were still true.

**Examined:** all four `source/scripts/*.py`, `dict_dedupe.js`, each run rather
than read: `--help` on every entry point, a full ingest of a new text file, and
`corpus_annotate --stats` against `samples/turkish-test`.

---

## 0. The finding, in one line

**`corpus_ingest.py` writes a pre-G31 schema, and the app's own schema guard
rejects its output.** A corpus built from the command line opens in the app with
its translations invisible.

---

## 1. Do they run?

All five parse and all five start. Nothing is broken in the sense of crashing.

| script | runs | verdict |
|---|---|---|
| `corpus_ingest.py` | yes, ingested a 2-sentence file end to end | **writes the wrong schema**, see §2 |
| `corpus_annotate.py` | yes, `--stats` and `--help` | **counts the wrong field**, see §3 |
| `corpus_optimize.py` | `--help` only (benchmarks need the model) | not re-examined; no schema surface |
| `dict_export.py` | **not a CLI tool at all**, see §4 | mis-documented |
| `dict_dedupe.js` | yes, prints usage | current, earns its place |

The v3.14.146 workspace rename holds through the CLI: the ingester wrote to
`~/LingCoT-Data/corpora/audit_test/` without being told to.

---

## 2. `corpus_ingest.py` writes fields the app does not read

Ingesting a plain text file produces sentences shaped like this:

```json
{"id": "doc_001.sec_001.p_001.s_001", "sentence_index": 0, "text": "…",
 "free_translation": null, "prov": {…}, "annotations": {}, "words": [
   {"id": "…w_001", "form": "Merhaba", "transliteration": null, …}]}
```

Three fields are from a schema the app has retired:

| the CLI writes | the app reads | consequence |
|---|---|---|
| `free_translation` | `translations: [{label, text}]` | **a CLI translation is invisible in the app.** `sentTrans()` reads `translations` and has no fallback |
| `transliteration` (scalar) | `transliterations: [{label, text}]` | survives, `wordTranslit()` still falls back to the legacy scalar |
| `annotations: {}` | nothing, retired at G34 | dead weight on every object |

**The app's own guard already knows.** Pointed at the ingested corpus,
`schema_conformance_test.js` fails on every sentence and every word:

```
sent @ doc_001.sec_001.p_001.s_001: undocumented field(s) ["free_translation"]
word @ doc_001.sec_001.p_001.s_001.w_001: undocumented field(s) ["transliteration"]
…
0 passed, 1 failed
```

It has never run against CLI output because `_fixture.js` looks only in
`samples/` and the workspace. The guard is right, the fixture set is too narrow.

---

## 3. `corpus_annotate.py` reports translation coverage it cannot see

Against the shipped fixture, whose 13 sentences all carry `translations`:

```
$ corpus_annotate.py samples/turkish-test/turkish-test_corpus.jsonl --stats
  Total sentences:      13
  Already translated:   0  (0.0%)
  Remaining:            13
```

**All 13 are translated.** The script tests `sent.get('free_translation')` at
`:545` and `:696`, so it reads 0 and would re-translate the entire corpus,
spending API calls to overwrite nothing and writing the results where the app
cannot see them. `--translate`'s own help text promises to "Add free_translation
to sentences that are missing one", which is at least honest about what it does.

---

## 4. `dict_export.py` is not a script

It has no `argparse`, no `main()`, no `__main__` guard and no `sys.argv`. Running
it produces no output and exits 0. It is a **module**, imported by name from
`LingCoT.pyw:770` to serve the app's PDF export, and its public surface is one
function, `export_dict_pdf(options)`.

The README lists it under *Command-line tools (see setup.md)* as
"Dictionary → PDF", which invites a user to run something that silently does
nothing.

---

## 5. Two smaller divergences

**Document ids.** The CLI mints `doc_001`; the GUI mints `doc_1787630594398`.
Both are valid under the dotted-id rule and both exist in real corpora, so
anything parsing ids must not assume either shape. The README says so as of
v3.14.144, but it describes only the GUI's form.

**`schema_version`.** `corpus_ingest.py` is the only writer of this key, and
nothing reads it. See README §JSONL Schema, which now says as much.

---

## 6. Does each script earn its place?

| script | verdict |
|---|---|
| `corpus_ingest.py` | **yes**, it is the only bulk entry point into the format. Fix the schema |
| `corpus_annotate.py` | **yes**, batch translation and the NLLB server both live here. Fix the field |
| `corpus_optimize.py` | **probably**, but it benchmarks a machine for a model most users will not install. Revisit after D29 P2 puts the download in the GUI |
| `dict_export.py` | **yes as a module.** Move it out of `scripts/` or stop calling it a CLI tool |
| `dict_dedupe.js` | **yes.** Small, current, reports without rewriting, which is the right shape for a data tool |

---

## 7. Proposals, in order

**S1 ✅ v3.14.151. Make `corpus_ingest.py` write the current schema.** `translations: []`
instead of `free_translation: null`, `transliterations: []` instead of the
scalar, and drop `annotations`. Smallest change with the largest effect: it is
the difference between a CLI corpus opening correctly and opening empty.

**S2 ✅ v3.14.151. Point `corpus_annotate.py` at `translations`.** Both the `--stats` count
and the write path. Until S1 and S2 land together, the CLI translation pipeline
is writing to a field nothing displays.

**S3 ✅ v3.14.151. Add CLI output to the guard's fixture set.** The defect above is exactly
what `schema_conformance_test.js` exists to catch, and it never saw it. Either
`_fixture.js` gains a CLI-produced corpus, or a guard ingests a small file and
conforms the result. **This is the one that stops it recurring**, and it should
land with S1 rather than after it.

**S4 ✅ v3.14.152. Reclassify `dict_export.py`.** The README's tree said
`scripts/ — Command-line tools` and listed four entries, one of which is a module;
`setup.md` documented the other three and not this one. Corrected in place rather
than moving the file: `LingCoT.pyw` loads it by path and that works, so a move is
churn with no bug prevented. `dict_dedupe.js` was missing from the tree and is
now listed too.

A **CLI** for it is a separate question and was considered rather than assumed.
`export_dict_pdf()` takes in-memory entries and a sentence map, not file paths, so
a command-line version must load the dictionary, load the corpus for pinned
examples, and design a field-selection interface: a feature, not a wrapper. Not
built, because nobody has asked.

**S5. Decide about `corpus_optimize.py`** when D29 P2 is scoped, not before.

**Not proposed: a migration for existing CLI corpora.** The reader-side fallback
for the legacy transliteration scalar already exists; adding one for
`free_translation` would be the cheaper half of S1 and is worth considering
together with it, but no corpus in this repository needs it.
