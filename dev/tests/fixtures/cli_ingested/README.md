# cli_ingested/ — `corpus_ingest.py`'s output, unmodified

**Updated:** 2026-09-02 · **Version:** v3.14.386  
*Frozen with the specimens it describes, not bumped with the build — the fixture is regenerated, not edited.*

**Regenerate, do not edit.** From the repository root:

    python3 source/scripts/corpus_ingest.py <a .txt file> \
        -o dev/tests/fixtures/cli_ingested/cli-ingested_corpus.jsonl \
        --title "CLI Ingested Specimen" --language tur --author synthetic \
        --source "purpose-built specimen, not fieldwork"

The source text is nine sentences of the same synthetic Turkish that
`samples/turkish-test` uses. There is no fieldwork here and no participant of any
kind; the `annotator` on every stamp is the CLI's own `automatically-parsed`.

## What it is for

**This is not a legacy format.** D58 §3 asked, of every shape the app still
reads, *who writes it today* — and this one has an answer. `corpus_ingest.py`
writes inline `prov` objects and no `prov_events` table, so **every corpus a user
starts from a text file is in this shape until the app first saves it.** The
audits had it filed as legacy for a year, because the only file in it happened to
be old.

It is a specimen rather than a sample because a user should never be handed a
corpus at this stage as an example of anything: it is the input to annotation,
not a picture of it.

## What it must keep

- **`record_type: "document"` declared.** The CLI writes it. D58 §3 deleted the
  shape-sniffing fallbacks in `isDocument` and `detectFileType` on the strength
  of that, so this file failing to declare it would break the reader rather than
  the guard. Regenerating after a CLI change is what keeps that true.
- **No `prov_events` line, and inline `prov` objects.** This is the whole point:
  `prov_intern_test`'s size claim only means something against a fixture that has
  not already been interned, and after the v3.14.384 fixture swap `samples/`
  carries no such file. Measured at v3.14.386: 70 inline stamps, 21,293 bytes.
- **`sentence_index` and `morphological_parse`.** The CLI still writes both, so
  `_migrateStripSentenceIndex` still has a producer. That is why it was NOT on
  D58 §3's deletion list, and this file is the evidence.
