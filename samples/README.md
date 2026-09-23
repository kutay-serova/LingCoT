# samples/: corpora that ship with the application

**Updated:** 2026-09-23 · **Version:** v3.14.412

**Everything in this folder is public.** It is inside the Git repository, under
the MIT licence. Nothing here may contain real fieldwork, and no participants
file here may contain a real person's name, affiliation, birth decade or contact
details.

Your own corpora do **not** belong here. They live in `~/LingCoT-Data/corpora/`,
outside the application folder, and LingCoT puts them there for you. See
*Where your data lives* in the top-level README.

What this folder should contain is decided in `dev/design/D58_fixture_set.md`,
which answers the question this folder cannot: it serves two audiences at once —
a person opening the app for the first time, and a guard suite — and D58 is where
they were separated. Degenerate shapes the guards need live in
`dev/tests/fixtures/`; this folder keeps only data worth imitating.

## What this folder is for

1. **The test fixtures the guard suite runs against.** Nineteen guards resolve a
   corpus, or a companion of one, through `dev/tests/_fixture.js`:

       annotation_gaps · cli_schema · dep_root · field_spec · fixture_resolve
       form_index · journal_binding · journal_disk · journal_replay
       lemma_registry · prov_intern · render_smoke · schema_conformance
       search_b · search_b_concordance · search_b_matcher · search_parity
       session_panel · variation_fields

   The resolution order is:

       $LINGCOT_TEST_CORPUS   →   <app>/samples/   →   <app>/corpora/   (legacy)

   They read the files through one shared loader (`loadCorpus`, `loadCompanion`,
   `companionsIn`, `parseRecords`, `splitEvents`, `isDocument`) rather than each
   carrying its own JSONL parse. **No guard may build a path to this folder
   itself** — `variation_fields_test.js` did, and was therefore the one guard the
   swap rehearsal could not cover (B-169, v3.14.378). `fixture_resolve_test.js`
   holds the rule.

   A guard with no corpus **fails**, it never skips. `dep_root_test.js` used to
   report "0 root tokens across 0 corpus files" as a pass, which is why. Since
   v3.14.250 (B-125) it also fails when the fixture set has a corpus but no
   dependency parses anywhere in it, which is the same hole one step further in.

2. **Something for a user to open on first run**, so the app has content to
   demonstrate and troubleshoot with.

3. **The file structure a user will actually deal with** — a corpus, its
   dictionary and its participants file, side by side under one directory named
   for the corpus. The participants file ships for that reason, and every value
   in both of them is invented.

## What ships today

**Two typologically contrastive corpora**, swapped in at v3.14.384 for the single
Turkish one that shipped before it. Measured through the app's own readers on
2026-09-02:

| | `turkish-test` | `chinese-test` |
|---|---|---|
| structure | 1 doc · 4 sections · 4 paragraphs | 1 doc · 2 sections · 2 paragraphs |
| sentences | 17 | 15 |
| words | 108 | 132 |
| morphemes | 116 | 117 |
| dependency parses | 3 sentences · 3 roots · 15 relations | 2 sentences · 2 roots · 8 relations |
| words linked to the dictionary | 56 | 16 |
| translations | 18 | 15 |
| transliterations | 4 | 115 |
| dictionary | 53 entries (35 `word`, 16 `bound.morpheme`, 1 `root`, 1 `functional.word`) + 33 lemma records | 24 entries (18 `word`, 5 `functional.word`, 1 `bound.morpheme`) + 13 lemma records |
| participants | 1 annotator, 1 source | 1 annotator, 1 source |
| distinct provenance moments | 254 | 91 |

Together: **646 objects** conform to the schema, against 172 with the old single
fixture, and `search_parity_test.js` makes **1,322 cross-engine comparisons**
across the pair — agglutinative against isolating, dense transliteration against
sparse, which is the contrast it was written for and could not have before.

Re-measure rather than trusting this table: it is a copy of something the files
already know, and it drifts every time a fixture is extended.

**Still short in one place.** `search_b_matcher_test.js` and
`search_b_concordance_test.js` remain **DISABLED** (exit 2, tallied separately,
never counted as a pass). Their golden cases are hand-written Korean strings and
`chinese-test` is what they should now be pointed at — but a golden is a value
someone checked by hand, and one carried over untested is worse than a disabled
guard, so they stay dark until the goldens are rewritten rather than translated.
D58 §4.2 owns that.

**The Korean fixture was removed at v3.14.120.** Its text came from Korean
Wikipedia and was therefore CC BY-SA inside an MIT repository (B-066). Removing
it resolved that rather than adding a licence note.

## The shape these files are in

**Current, as of the swap.** Both corpora were written by the app itself:
`record_type` on every row, provenance interned into a `prov_events` table on the
first line with `field_prov` holding indexes into it, `record_type: "lemma"` on
lemma records, `variants` rather than `alternate_forms`.

That is a change from what shipped before v3.14.384, and it has a consequence
worth stating plainly: **the legacy readers in the app now have no fixture at
all.** `D58 §3` decided that is correct — asked producer by producer, every one
of those shapes turned out to have no writer today — and lists the readers, the
`legacy` field tier and the guard branches that go with them. Until that deletion
lands, they are code no data exercises.

The one uninterned shape that *is* still produced is `corpus_ingest.py`'s output,
which is a **current input format** rather than a legacy one. Its specimen
belongs in `dev/tests/fixtures/`, produced by running the shipped CLI, not here.

## Ids are opaque

**Decided at v3.14.258 (B-135). This matters most to whoever reads these files
without reading the source.**

An id looks like a path — `doc_1787630594398.sec_001.p_001.s_003.w_002.m_001` —
and that appearance is historical. **It is an identity, not an address.** A
record's id does not tell you what contains it, and the two can legitimately
disagree: a re-parse reuses sentence objects to preserve their annotations and
keeps their ids, which is what `word.head`, the edit journal and every by-id
lookup depend on. A section merge does the same one level up (B-198).

If you are consuming a corpus from this folder:

- **Array position is ground truth** for order and for parentage. Walk the tree.
- **An id is stable forever** and is safe to cite. It never changes once minted,
  not on a split, a merge, a reorder or a re-parse.
- **Do not parse an id.** Do not split it to find a parent, do not read an index
  out of it, and do not sort by it. The trailing `_xxx` on some components is a
  uniqueness suffix and carries no meaning.

`dev/tests/id_sort_test.js` holds the application to all of this.

## Provenance indexes are file-local

The first line of a corpus file is its `prov_events` table, and every `field_prov`
value is an **integer index into that file's own table**. The tables are interned
per file and renumbered densely at compaction, so **an index copied from one file
to another names a different moment** — silently, and with no way to notice
afterwards. Resolve to the event and find-or-append it in the destination
instead. `prov_intern_test.js` holds this.

## Working on a fixture

While a fixture is still being built, keep it in `~/LingCoT-Data/corpora/` and
point the suite at it:

    LINGCOT_TEST_CORPUS=~/LingCoT-Data/corpora ./dev/tests/run_all.sh

Once it is ready, copy the folder here — the swap procedure in `dev/DEV_PLAN.md`
is how, and its step 2 rehearsal wants a staging directory holding **only** the
candidates, because the resolver refuses to guess between two corpora matching at
the same depth (B-168).

Autosave leaves a `<name>.journal.jsonl` beside a corpus that is open in the app.
**Fold it before copying**: the journal is not shipped, and a fixture whose
journal still holds unfolded edits is a fixture missing whatever they were.

## Before committing anything here

- [ ] every participants record is synthetic
- [ ] the corpus contains no material you were given under a consent agreement
- [ ] `annotator` names in provenance are ones you are willing to publish
- [ ] `node dev/tests/schema_conformance_test.js` passes against it
- [ ] no `.journal.jsonl` beside the corpus still holds unfolded edits
- [ ] no `*.b105-bak` or `.prov_date_repair.json` left by `dev/repair_prov_dates.py`
- [ ] `python3 dev/tools/ship_disclosure.py` before `git init`
