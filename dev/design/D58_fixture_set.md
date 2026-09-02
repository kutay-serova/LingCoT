# D58: what the shipped test data contains
**Updated:** 2026-08-31 · **Version:** v3.14.327 (header restamped v3.14.390)
*Design record, written before the work. **BUILT — §3 taken v3.14.386, the swap
executed v3.14.384, §4.2 closed v3.14.385; §§7-10 carry the execution and are the
part to read for what happened.** The body above them is frozen as written and
still says "not built" in places: that is the record of the decision, not the
state. Read it before touching `samples/`, `dev/tests/fixtures/`,
`dev/tests/_fixture.js`, or `samples/README.md`.*

> **Two pointers this record cannot have known, v3.14.390.** §4.2 says the two
> disabled guards would be *re-pointed* at Mandarin; they were **rewritten and
> renamed** instead — `search_matcher_test.js`, `search_concordance_test.js`,
> harness `_search.js` (v3.14.385/388, `dev/RENAMES.md`), and a third,
> `search_invariants_test.js`, replaced the retired parity guard. And the "still
> open" item DEV_PLAN §2 quotes from §1 — a declared field with no instance in
> either corpus — is **annotation, not code**, and is still open at v3.14.390.

**Decided 2026-08-31**, from an audit of the guards, the field table, the design
records and the bug history against the three corpora that exist. Measured, not
recalled: every number below was produced by walking the files.

---

## 0 · The finding that reframes the question

**`samples/` is being asked to serve two audiences whose requirements are
opposite, and every unresolved question in this audit is that one conflict.**

A user opening `samples/` should see a corpus worth imitating: real structure,
honest partial annotation, nothing preset that is theirs to choose. Several
guards need the exact opposite — data no user should ever imitate:

| a guard needs | so that | a user must never see |
|---|---|---|
| an **empty dictionary** | B-163's `+ dict` no-op is reachable at all — it hides the moment a corpus is annotated once | a corpus with no lexicon |
| a **pre-interning, `record_type`-less** file | `isDocument`'s `Array.isArray(r.sections)` fallback and `splitEvents`' no-events path are exercised | the format the app stopped writing at v3.14.225 |
| **dangling** `dict_id`/`lemma_id` | the dangling-reference reporter has something to report | a corpus that teaches dangling is normal |
| an **ambiguous** form | B-122's `cands[0]` cannot pass by luck again | a lexicon that cannot decide what a word is |

Trying to satisfy both from one directory is why `samples/turkish-test` is
simultaneously the only fixture in a format the app no longer writes (**L-007**)
and the thing we hand a new user as an example.

**Decision: split the fixture set by audience.**

- **`samples/`** — exemplary. What a fieldworker should see and copy. Shipped,
  public, and every file in it is a thing we would be pleased to have imitated.
- **`dev/tests/fixtures/`** — specimens. Small, purpose-built, degenerate on
  purpose, each named for the guard or bug it serves and each carrying a one-line
  header saying why it is malformed. Never offered as an example.

This is not a new idea in this repository, it is an existing one made explicit:
`prov_intern_test.js:457` already *strips* `record_type` at runtime to recreate a
shape `samples/` happens to have. That is a specimen built in code because there
was nowhere to put one.

## 1 · What `samples/` contains

**Two corpora, typologically contrastive.** Turkish (agglutinative, Latin script,
dotted-I casing) and Mandarin (isolating, non-Latin, pinyin transliteration).
The pair is load-bearing, not decorative:

| bug | why one corpus hid it |
|---|---|
| **B-120** | search folded with `toLowerCase`; three `İkna` invisible. A non-Turkish corpus hides it |
| **B-144** | raw vs `normForm` form keys — *"0 lost in Mandarin, invisible in one of the two corpora"* |
| **B-027** | `CLF` ×3 in Mandarin against an 18-tag vocabulary with no classifier |
| `search_parity_test` | NOTEs that it *"proves less"* against one corpus — its point is the contrast, not the comparison count |

**Four files per corpus, named as the app names them**: `X_corpus.jsonl`,
`X_dictionary.jsonl`, `X_participants.jsonl`, `X.journal.jsonl`. The journal is
present and **empty** — which is what a folded journal looks like, so the shape
is taught without shipping unfolded state. Both live corpora already have one at
0 bytes; `samples/` has none.

**In the format the app writes today**: a `prov_events` record on line 1,
`record_type` on every row, interned provenance. `samples/turkish-test` has none
of these, which is how **B-146** shipped — `detectFileType` sniffed line 1 and
every file the app wrote was unopenable, while the fixture still opened because
it predated the format.

**Density floors, each traceable to an assertion:**

| | floor | guard |
|---|---|---|
| words | ≥ 25 | `journal_replay_test:87` |
| `field_prov` stamps | > 100 | `prov_intern_test:70` |
| dictionary entries | ≥ 2 | `journal_disk_test`, `session_panel_test:102` |
| a container with 2 children | ≥ 1 | `journal_disk_test`'s reorder |
| levels reachable from the tree | ≥ 7 | `field_spec_test:139` |
| non-empty search comparisons | ≥ 100 | `search_parity_test:300` |

**Annotation layers, each present at least once and visibly absent elsewhere.**
One fully worked sentence teaches the target; an unfinished remainder teaches
that partial annotation is the normal state and gives the Progress panel, the
fill offers and the parse guide something to do on first open. A uniformly
complete corpus makes half the interface inert.

Specifically required, with what asks for it:

- **Dependency parses with a root** — `head` incl. `head: null`, and `dep_rel`.
  `dep_root_test` fails loudly without them (**B-125** made it do so after it
  reported *"0 root tokens"* as a pass). The live corpora have **zero**; this is
  gate 1's fieldwork item and the swap cannot happen without it.
- **A numbered homograph pair.** Homographs are the model's central claim — D35,
  D37, D40 and D52 all turn on them — and **`samples/` has 8 duplicated forms and
  `homograph` set on 0 of 32 entries**, which is how **B-143** shipped. Mandarin's
  的:1 / 的:2 is the only numbered pair in existence; Turkish needs one too.
- **An ambiguous form** — two entries a link cannot choose between. **B-122**
  wrote 76 of 77 links correctly *"only because no live form was ambiguous —
  luck, not design"*.
- **A multi-element list.** The longest annotator-facing list in any of the three
  corpora is **one element**; the only lists reaching 2+ are derived
  `prov_history`. D31 decided multi-entry ordering and no fixture can show it.
  Two transliterations on one word, or two translations on one sentence.
- **A `lemma` with ≥2 members**, and `word` / `bound.morpheme` / `lemma` entry
  types — `dict_export`, D49, `lemma_registry_test`.
- **Morpheme breakdowns**, several per corpus, including one word of ≥3 morphemes.
- **A participants file that is obviously synthetic and schema-complete**: one
  annotator, both `source` types, `publication_restrictions` populated — that
  field is what governs whether a text may ship at all.

## 2 · What `samples/` must not contain

| | why |
|---|---|
| `metadata.tracked` | a view preference one person set on one afternoon. `turkish-test` carries `{on:["sentence.deps"]}`; shipping it hands every user someone else's choice. **Stripped during the swap** (decided 2026-08-31) |
| dangling `dict_id` / `lemma_id` | *"a fixture with dangling references teaches the guards that dangling is normal."* Mandarin currently has 1 word + 1 entry dangling; Turkish 2 |
| `*.b105-bak` files | three are on disk in `samples/` now; **B-156** was them nearly shipping with 273 inlined name occurrences |
| a real name, affiliation, birth decade or contact detail | the gate-1 disclosure, and `samples/README.md`'s own promise |
| an unfolded journal | state mid-flight is not a shape to teach |
| POS or type values outside the shipped vocabularies | the sample must not violate `pos_tags.json` — see §4 |

## 3 · The specimens — decided v3.14.328, and mostly by deletion

**The question that settles this: who produces that shape today?** Not *when was
it written*, which is what the word "legacy" invites and what kept these paths
alive. There are **no users and no corpora in the world** except the ones in this
repository, so a shape with no current producer has no reader to protect.

Asked producer by producer, and one answer inverted the plan.

### Alive — and one of them is not legacy at all

**Uninterned provenance with no `prov_events` line is `corpus_ingest.py`'s output
today.** Verified by running it (v3.14.328): the CLI writes one line, with
`record_type: "document"` and inline `prov` objects
(`{"annotator": "automatically-parsed", "date": …}`), and **no Python anywhere
writes a `prov_events` table** — `grep -rn "prov_events" source/scripts/` returns
nothing. So every corpus a user starts from a text file is in that shape until
the app first saves it. This is a **current input format**, and it has been
standing in the audits as a legacy one because the only file in it happened to be
old.

That changes what the specimen is. It is not `legacy_uninterned.jsonl`, kept for
history; it is **`cli_ingested/`, a corpus produced by running the shipped CLI**,
regenerated when the CLI changes. It covers `splitEvents`' no-events path,
`loadCorpus`'s empty `events`, `prov_intern_test`'s "not yet interned, must
shrink" branch — and it closes **B-157**'s companion complaint, which
`SCRIPTS_AUDIT.md:78` states plainly: *"`_fixture.js` looks only in `samples/`
and the workspace. The guard is right, the fixture set is too narrow."*

Also alive, and needing specimens for the reason §0 gives rather than for
history: **`empty_dictionary/`** (B-163), **`dangling_refs.jsonl`**, and
**`ambiguous_form/`** (B-122).

### Dead — no producer, no user, delete rather than preserve

| path | who writes it | verdict |
|---|---|---|
| `isDocument`'s `Array.isArray(r.sections)` fallback | nobody — the app and `corpus_ingest.py` both write `record_type: "document"` | delete |
| `type: 'lemma'` / `record: 'lemma'` → `record_type` migration | the v3.14.184–237 builds only | delete |
| the pre-D35 lemma model (`lemma_id` → a **dict_entry** id) | nobody; it exists in `samples/` and nowhere else | delete |
| `_migrateDictLegacy`'s `alternate_forms` → `variants` (B-044) | nobody; 0 occurrences outside `samples/` | delete |
| `parseRecords`' pretty-printed and concatenated fallbacks | nobody — the only `json.dumps(indent=2)` in the scripts writes `corpus_annotate.py`'s **cursor file**, not a corpus | delete |
| the `legacy` tier generally — `free_translation`, `sentence`/`word.annotations`, `dict_entry.definition`, `alternate_forms` | nobody; **0 occurrences in all three corpora** | delete with the rest |

**Keeping a broken corpus to exercise a reader that nothing writes is two dead
things holding each other up.** The reader is not protecting a user — there is no
user — it is protecting a fixture that exists to exercise the reader. The
argument for keeping the fallback was *"deleting it because no fixture exercises
it would break the people it was written for"*; measured, those people do not
exist, and will never come into existence, because **the first commit has not
happened yet.**

**This is the last moment it is free.** After `git init` and a testers' build,
someone somewhere has a file in an old shape and deleting a reader becomes a
breaking change. Before it, deletion costs one version and removes six paths, a
field tier, and a whole category of fixture.

**What must go with them**, or the deletion is half-done and the next reader is
misled: `schema_conformance_test`'s `type: 'lemma'` exemption, `prov_intern_test:457`'s
runtime `record_type` strip, `lemma_registry_test`'s legacy-shape branch, and
`field_spec.js`'s `legacyKey` mechanism and `legacy` tier if nothing else claims
them. A declaration is only as good as what it admits exists (PRACTICES §5), and
a `legacy` tier with no members is a declaration that something is there.

**Decided 2026-08-31: no legacy parity and no legacy openability.** The archived
corpora under `corpora/archive/` are the author's own and are not required to
keep opening. So there is no reader to preserve for them either, and the
deletion list above is taken in full rather than trimmed to protect a file
somebody might want later.

**`samples/turkish-test` is retired, not migrated.** It was the only artefact
arguing for any of this — the last file in the old shape, and the reason the
audits kept describing a historical format as though it were live. It goes when
the replacement arrives; nothing is carried across, and **no old corpus is copied
into `dev/tests/fixtures/`**. The specimens there are all purpose-built or
CLI-produced, which is the difference between a fixture and a keepsake.

**Sequencing, so this does not break the suite:** retiring it empties `samples/`,
and `_fixture.js` is built to FAIL loudly with no corpus — thirteen guards would
go red, correctly and uselessly. **The retirement happens in the same version as
the replacement**, not before it, and the swap procedure's step 1 tally is what
proves nothing else moved with it.

## 4 · Open, and for the user to decide

1. ~~**`CLF` and `pos_tags.json`.**~~ **Done v3.14.329: eleven tags added** —
   CLF, PUNCT, NEG, COP, DEM, QUANT, CLASS, PREP, POSTP, DISC, IDEO, taking the
   vocabulary from 18 to 29. `pos_tags.json` is the declared extension point and
   `schema_conformance_test` reads the file rather than the hard-coded defaults,
   so extending the file extended the guard: `chinese-test` now conforms, 58 tag
   values in vocabulary, 0 outside. Two descriptions were reworded because the
   additions made them wrong — `SYM` no longer says "or punctuation" now that
   `PUNCT` exists, and `ADP` names `PREP`/`POSTP` as the specific pair rather
   than claiming to be both.
2. ~~**The two Korean guards.**~~ **Decided 2026-08-31: re-point them at
   Mandarin at the fixture replacement.** `search_b_concordance_test` and
   `search_b_matcher_test` have been DISABLED since the fixture moved; what they
   need is non-Latin script and transliteration labels, which Mandarin supplies.
   Their goldens are hand-typed Korean forms (`언어학`) and must be **rewritten,
   not translated** — a golden is a value someone checked by hand, and one
   carried over untested is worse than a disabled guard. `requireCorpusOrDisable('korean')`
   becomes `('chinese')` in the same version; until it does they stay dark rather
   than run against something they were not written for. 2 of 74 guards return.
3. ~~**How much history to keep.**~~ **Answered by §3: almost none.** The
   pre-D35 lemma model has no producer and no user, so it is deleted rather than
   specimened.

## 5 · Two guard defects the audit found

Filed as **B-169** and **B-170**; both are about the fixture set and both would
survive the swap silently.

## 6 · Where this leaves gate 1

The swap procedure in `DEV_PLAN.md` stands. This record answers what the
replacement must *contain*; the procedure answers how to move it without
misdirecting a guard. The rehearsal's four findings are all covered above:
no dependency parses (§1), `CLF` (§4.1), `metadata.tracked` (§2), dangling
references (§2).

---

## 7 · Re-measured against the live corpora, v3.14.379

*Appended, not merged. The record above is stamped v3.14.327 and stays as
written; this says what has changed under it. Every figure here came from the
app's own readers.*

**§1's four measured gaps: three have closed by annotation.**

| gap | v3.14.327 | v3.14.379 |
|---|---|---|
| dependency parses with a root | zero in both | ✅ **3 in `turkish-test`, 2 in `chinese-test`** — one root each, every token headed, arcs = tokens − 1 |
| a numbered homograph pair | 的 only, `homograph` on 0 of 32 | ✅ `turkish-test` has `da` and `ama` numbered; 4 of 53 and 2 of 24 entries carry a number |
| an ambiguous form | none | ✅ `da` resolves to two lemma records — B-196 and B-161 were both found on it |
| **a multi-element list** | one element, everywhere | ◻ **still open.** `turkish-test`'s longest is 1 across every list field; `chinese-test` has exactly one — two transliterations on one morpheme |

**The multi-element list is the last one, and one instance in one corpus is
thin.** D31 owns the question it exists to show — *is position meaning, or is
primacy a flag?* — and B-139 answered half of it at v3.14.372 without needing a
fixture, because the answer turned out to be about the CONTROL rather than the
order. What still has no fixture is a ROW EDITOR holding two elements: two
translations on one sentence, or two allomorphs on one entry.

**§2's exclusions.** `metadata.tracked` ✅ stripped from `turkish-test`
v3.14.379, both copies. Dangling `dict_id` / `lemma_id` ✅ zero in both, verified
through `danglingCompanions`. Real participant data ✅ — the annotator records
are placeholders and the same identity in both; the two `source` records are
`type: text` with `no_restriction`, a work rather than a person.

**§5's two guard defects.** **B-169 ✅ v3.14.378** — the rehearsal covers
`variation_fields_test` now, and no guard may build a path to `samples/` itself.
**B-170** remains open.

**§6, and the one thing that has moved against the swap.** The procedure still
stands and every code prerequisite is met. What blocks it today is not in this
record's scope and is worth naming here anyway: the live corpus directory holds
**two** `turkish-test` corpora (B-199's second-order damage), and step 2's
staging directory "holding **only** the candidates" is the assumption that
breaks. Six guards refuse to guess between them and one cannot resolve a
companion. The fixture content is ready; the directory is not.

---

## 8 · Executed, v3.14.384

*Appended. §§0–7 stand as written; this records what happened when the swap was
taken.*

**`samples/` is now `turkish-test/` + `chinese-test/`**, byte-identical to the
live corpora, each holding a corpus, a dictionary and a participants file and
nothing else. The old `samples/turkish-test/` is retired to
`corpora/archive/samples_turkish-test_retired-v3.14.384/` with its three
`*.b105-bak` files and `.prov_date_repair.json` — **archived, not carried
across**, exactly as §3 said.

**The rehearsal predicted the swap check for check.** Step 2 (staging) and step 4
(post-swap) produce identical per-guard tallies — `diff` is empty — at **85 pass,
0 fail, 2 disabled**, the same outcome as the pre-swap baseline. §6 said the
procedure answers "how to move it without misdirecting a guard"; this is the
measurement that it does.

**§1's four gaps are all closed.** §7 left one open — the multi-element list — and
it closed by annotation before the swap: two translations on one `turkish-test`
sentence, two transliterations on one `chinese-test` morpheme. **It paid for
itself the same day.** Folding the journal that carried it surfaced **B-202**: a
replayed parent orphaned its children, so saving a sentence and then a word
inside it made the OLDER value win, shown on screen and absent from the file.
With a one-element list the stale copy and the fresh one are indistinguishable
and no fixture could have shown it. §1 said as much about why the list was
wanted; this is the specific bug it was wanted for.

**§3's deletion did not go with the swap, and the swap measured what it costs to
defer.** Two guards run FEWER checks against the new fixtures, both on branches
the current-shape data cannot enter:

- `lemma_registry_test` −2 — its legacy-shape branch. `samples/` held 10
  pre-v3.14.184 lemma rows; the candidates carry 33 already-migrated records.
- `prov_intern_test` −1 net — its "not yet interned, must shrink" branch, replaced
  by the already-interned branch the old fixture never reached. §3 assigns that
  branch to **`cli_ingested/`**, and that specimen does not exist yet.

**That is §3's list arriving as a measurement rather than an argument.** Neither
is a defect; both are code no data exercises, which is the state §3 predicted and
called the reason to delete. Taking the deletion is its own version.

**§4.2 did not go with the swap either.** `search_b_concordance_test` and
`search_b_matcher_test` are still `requireCorpusOrDisable('korean')` and still
dark. §4.2 asked for the re-point in the same version; the reason it gave —
*"until it does they stay dark rather than run against something they were not
written for"* — is satisfied either way, because with no Korean corpus present
they disable themselves. Deferring costs nothing and rewriting eleven goldens by
hand inside a data migration would have mixed two kinds of risk in one version.
**The goldens are still to be rewritten, not translated.**

**§2's exclusions, re-verified at the swap.** No real participant data — the
author confirmed both corpora's participants and sources on 2026-09-02, and
`ship_disclosure.py` is still a deliberate run before `git init` rather than a
rule the repository enforces. `metadata.tracked` stripped. Zero dangling
`dict_id`/`lemma_id`. No `*.b105-bak` and no `.prov_date_repair.json` in
`samples/`.

**One thing the swap surfaced that this record did not anticipate.** Two of
`turkish-test`'s translations are stamped `auto-nllb-200` — machine output,
correctly labelled because B-157 was fixed, and about to be committed into an MIT
repository whose whole reason for excluding the NLLB weights is that they are
CC-BY-NC. §2 asks what `samples/` must not contain and answers it in terms of
people; this is the same question in terms of licences. **Recorded in DEV_PLAN as
a gate-1 decision for the author**, not settled here.

---

## 9 · §4.2 closed, v3.14.385

*Appended. §8 recorded the re-point as deferred one version; this records it
landing, and what it cost to do properly.*

**Both guards run.** `search_b_matcher_test` and `search_b_concordance_test` are
`requireCorpusOrDisable('turkish')` + `('chinese')` now, and **the suite has
nothing disabled for the first time: 87 pass, 0 fail, 0 disabled.** They were
dark from v3.14.120 to v3.14.385 — 265 versions.

**Every golden was rewritten, none translated**, which §4.2 asked for and is the
only reason the rewrite was worth the version it took. The values were derived by
reading the corpus JSON and then confirmed against an independent walk of the
same files written in another language; none was recorded from `sbSearch`. 72
checks across the two, mutation-tested 25/25 against deliberate breaks of every
matcher and builder path.

**The rewrite found a bug, and it is the same shape as B-202.** **B-203**:
`translitTextsForSearch` answered through `wordTranslit`, which returns *the*
reading for a label — one string. A second transliteration under the same label
was unreachable from search: writable, displayable, and unfindable. Measured on
both new fixtures — `sïdjak` on `sıcak`, `guo4` on 过 — and invisible before
them, because with one element per list the correct and the broken implementation
return the same thing.

**That is the multi-element list paying for itself twice in three versions.** §1
asked for one and said no fixture could show what it was for; §7 recorded it as
the last open gap; §8 recorded B-202. This is the second. The general form is
worth stating, because it is an argument for fixture CONTENT rather than for
guard count: **a list with one element cannot distinguish "reads the list" from
"reads the first element", and neither can any guard written against it.**

**One thing the rewrite changed that was not a bug.** The two guards each carried
their own copy of the harness — DOM stubs, the function slicer, the corpus
seeding — and the copies had drifted. They share `dev/tests/_search_b.js` now,
which also seeds the DICTIONARY: without it `S.lemmas` was empty and every
`field: 'lemma'` search returned zero hits against an empty index, passing while
checking nothing. The lemma path is the one that straddles corpus, dictionary and
lemma registry at once, and it had never been executed here.

---

## 10 · §3 taken, v3.14.386

*Appended. §3 stands as written; this records what happened when its deletion was
executed, one version after §8 measured the case for it.*

**All six went, and three more that would have left it half-done.**

| §3's list | what was removed |
|---|---|
| `isDocument`'s `sections` fallback | `dev/tests/_fixture.js` — a document declares itself |
| the `type:'lemma'` / `record:'lemma'` migration | `splitDictFile`'s two conversion branches |
| the pre-D35 lemma model | already gone; `lemmaById` had no `dictById` fallback left to remove, recorded rather than pretended |
| `_migrateDictLegacy`'s `alternate_forms` → `variants` | that loop, and `definition` → `meaning` with it |
| `parseRecords`' pretty-printed and concatenated scans | `parseRecords` reads JSONL, and fails loudly on anything else |
| the `legacy` tier | the tier, its fourteen declarations, three filters, and every reader: `sentTrans`'s `free_translation`, `renderAnnotations` and the G34 stripper, the inline `variants \|\| alternate_forms`, and `legacyKey` |

**The three not on the list, and why they had to go too.** `detectFileType`'s
shape sniff and `parseJsonlText`'s single-object fallback are the app-side twins
of items 1 and 5 under different names — leaving them would have deleted a
reader in the guards and kept it in the app, which is PRACTICES §4 with the two
writers one directory apart. `_migrateDeclareRecordType` went because §3's
companion list requires `prov_intern_test`'s runtime `record_type` strip to go,
and that strip existed to exercise exactly that migration.

**And one in the CLI.** `corpus_annotate.py` still read `free_translation`. It
was also its last WRITER, and stopped at v3.14.151 — so the reader outlived the
writer by 235 versions inside one file. That is the §3 shape at its purest, and
it was found only because a guard was pointed at the scripts as well as the app.

**What did NOT go, and the reason is the same question answered the other way.**
`_migrateStripSentenceIndex` stays: `corpus_ingest.py` still writes
`sentence_index`, and `cli_ingested/` is the file that proves it. The lemma
residue half of `_migrateDictLegacy` stays: its KEEP branch is a rule about the
annotator's work, which D35 B5 owns, not back-compatibility. `splitDictFile`'s
"whatever is left is an entry" stays: that is a DEFAULT, and a default is not a
legacy reader.

**The guards changed job rather than being deleted.** `lemma_registry_test` used
to prove the migration converted the old spellings; it now proves there is
nothing left to convert — in the code (`=== 0`, not "confined to the migration",
because a cap that moved from 1 to 2 is a cap that moves) **and in the data**,
walking every shipped dictionary, because a stray row would now load as an entry
and lose its group silently. `variation_fields_test` moved from "is the fallback
present" to "is the old key gone from every reader, writer and file".
`annotation_gaps_test` asserts the pair: undeclared AND unread, so neither half
can come back alone. Two new sections cover what deletion alone cannot —
`field_spec_test` on the tier, `corpus_load_test` on the sniffers — because
re-adding a fallback breaks nothing, which is exactly why it needs a guard.

**`dev/tests/fixtures/` exists now**, with `cli_ingested/` in it and a README
saying what a specimen is for. §0 predicted its first inhabitant would be the
`record_type` strip built in code; it turned out to be the opposite — a real file
from a real producer, which is a better first tenant than a synthetic one.

**Verification.** 87 passed, 0 failed, 0 disabled, against `samples/` and against
a staging directory holding only the two live corpora. Mutation-tested 13/13:
every deleted reader re-added one at a time, the CLI specimen interned, the CLI
told to stop declaring `record_type`, and `parseRecords` made to skip a bad line.
Two escaped first, and each named a property the deletion had quietly put at
risk — that an unreadable file must FAIL rather than return fewer rows, and that
the CLI is half of "nothing reads this key".

**The cost, stated because §3 authorised it and this is where it lands.** The two
corpora under `corpora/archive/` report `detectFileType → unknown` and no longer
open. v3.14.329 decided that ("no legacy parity and no legacy openability"), and
it is irreversible. **This was the last version in which the deletion was free**;
after `git init` and a testers' build it would have been a breaking change.
