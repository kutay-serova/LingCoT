# D50: the save migration — journal, binding, and the format
**Updated:** 2026-08-30 · **Version:** v3.14.252  
*Frozen at the version it was moved out of DEV_PLAN. Not bumped again.*

**Design record. Moved out of `dev/DEV_PLAN.md` at v3.14.252**, when the plan's
entry for it had grown to 24 KB, most of it an account of work already shipped.
The plan keeps the decision, the stage table and what is left; the reasoning and
the shipped detail are here.

Same convention as `D25_dependency_parse.md`, `D27_selection.md` and
`D30_navigation.md`: read this before touching the journal, `serializeRecords`,
`adoptProvEvents` or the compaction triggers. The reasoning is not in the code,
and several of the decisions below were taken against a measurement that is
recorded nowhere else.

**Shipped v3.14.235 through v3.14.250.** Stages 1 to 4 are complete; stage 5's
code half is complete and its fixture swap is blocked on fieldwork. The stage
table in `DEV_PLAN.md` is the current status; this file is not updated to track
it.

**Where the numbers came from:** `save_architecture_options.md` (the options and
their benchmarks), `save_format_decision.md` (the one-choice brief) and
`file_layout_options.md` (the layout question). `dev/audits/AUDIT_INDEX.md`
records that all three are now implemented.

---

#### Stage 3, designed 2026-08-29 (v3.14.234)

**Journal records inline their provenance** (`expandProv`, v3.14.235), so no
part of the journal depends on the base's event table staying numbered as it is.

**Records are whole-record snapshots, two ops.** `put` carries a record at the
level the handler already works on, `del` carries an id. There is **no
field-level edit in this app to journal**: all ~20 `mutate()` sites are
save-a-whole-object functions, and `saveWord` rebuilds the word from the DOM
rather than reporting which field changed. A 70-byte field op would mean
inventing change detection that does not exist, and a diff that silently misses
a field is the class of defect this project keeps finding. Measured cost of a
snapshot at the live density: **1,481 bytes per word-put**, against 56 MB for a
full rewrite at 50,000 words. Re-measured after stage 4: **~1,930 bytes**, which
is the inlined provenance the base no longer stores.

**`mutate(target, written)` — records, not stores.** This is the correctness
requirement, and the naive version fails it. One user action writes many objects:
`saveDictEntry` loops over every corpus word referencing the entry and inherits
gloss, seeds `morphological_parse`, materializes morphemes and sets `lemma_id` on
each, then calls `mutate(['corpus', 'dict'])` — which names two *stores*, not the
dozens of objects touched. `_pushTokenToDict`, `autoLinkWord`,
`inheritMorphemeTypes` and the delete path's reference repair do the same.

**And the failure mode inverts.** Today a missed `mutate()` is harmless — the
next autosave rewrites everything from the live tree, which is why the function's
own comment says a call site that says nothing *"is merely slow, never stale"*.
Under a journal nothing else ever writes that object, so a missed record is
permanent loss. The B-030 comment records three dictionary paths that mutated
without calling `mutate()` at all.

**Reconciliation is what makes it defensible.** Compaction serializes the live
tree anyway, so it also replays base + journal and compares. A divergence means a
write escaped the journal: log it with the diverging ids and compact from the
live tree, which is truth. Costs nothing extra, and turns an invisible
correctness bug into a detected one. The same check is the guard: script a set of
edits, assert replay equals the live tree.

**Structural changes journal the parent container**, so a `put` only ever updates
a record in place — a snapshot keyed by id says what a record contains, not where
it belongs, so creation and reordering are properties of the parent. Deletion
journals the `del` **and** the repaired referrers.

**Participants stays on full rewrite.** 845 bytes. Journaling it buys nothing and
adds a third replay path.

##### Shipped at v3.14.239 (3a): the records, and the contract

**Three ops, not two.** The design above said structural changes journal their
parent. That is cheap at the bottom of the tree — a new word journals its
sentence, 13 KB — and catastrophic at the top, where a new SECTION would journal
the document, which is the whole corpus. So `add` carries a parent and an index,
and `put` never has to stand in for a creation.

**And a fourth shape, `shallow`.** A put of a container carries its subtree,
which is right but expensive when a save path touched only the container's own
fields. A shallow put drops the children and keeps their **ids, in order**, so a
reorder or a removal still replays: `saveDocument` can drag sections into a new
order, and that is now a list of ids rather than the corpus.

**What the call sites had to be told.** Twenty `mutate()` calls now name their
records. Three of them were writing more than anyone would guess from the
function name, and each was found by asking rather than by reading:

| | |
|---|---|
| `saveWord` | `_pushTokenToDict` FILLS existing entries as well as creating them, and returned only the created ones. It now reports every entry it touched; the completion modal's list was the wrong set to journal from |
| `saveNewDictEntry` | `assignHomographs` numbers **every sibling entry sharing the form** the moment a second one appears, so a new entry writes to entries nobody named |
| `deleteDictEntry` | clearing references REWRITES every referrer — words by `dict_id`, by `lemma_id`, through a morpheme, and entries citing it as their lemma |

**One correction to the analysis.** The unified audit said `saveDictEntry` loops
over every corpus word referencing the entry. It does not: the back-propagation
is scoped to the single word passed in from the word-edit context. The blast
radius is real but smaller than filed.

**The safety property, which is the point of doing 3a alone.** A `mutate()` that
does not say what it wrote marks the journal **incomplete**, and an incomplete
journal will force a full write. Unknown degrades to today's behaviour rather
than to silence — the same shape as mutate's own rule that an unknown label must
never mean "skip everything". Guarded twice: `journal_record_test.js` executes
it, and `autosave_target_test.js` fails when any call on a journalled store names
a store without records.

##### Shipped at v3.14.240 (3b): disk and replay

**The Python half, proven against a real filesystem before any JS was wired to
it.** `write_abs` became **atomic** — temp file in the same directory, flush,
fsync, `os.replace` — so a crash mid-write leaves the previous corpus rather than
a truncated one. It had been writing in place, which at 56 MB is a wide window in
which to lose everything. `append_abs` fsyncs per action and returns the
journal's size, which is what the size trigger will read. `truncate_abs` empties
the journal, and is called only ever AFTER the base has been replaced.

**`replayJournal` is idempotent by construction**: a put is last-write-wins on
one id, an `add` whose id is already present is skipped, a `del` of something
already gone is a no-op. That is what lets compaction replace the base *before*
emptying the journal — a crash in between replays an already-folded journal,
which must cost nothing. An unresolvable record is counted and reported, never
dropped, the same rule `adoptProvEvents` follows and for the same reason.

**Still not the hot path.** The debounced full rewrite is still the authority.
The journal is appended first and truncated after, so the ordering is already
the one 3c needs, and the machinery is being exercised on every save without
being trusted with anything yet.

**Two bugs the guard found on its first run, both in the same mistake.**
`CONTAINER_KEYS` was used to walk the tree, and **`words` is deliberately not in
it** — it answers "is this key a field of the level, or the nesting itself",
which is a question about the field table, not about traversal. So replay never
reached a word: every journalled word edit came back unresolved, and a shallow
put of a sentence still carried its entire word list. `CHILD_KEYS` now exists
beside it, with the distinction written down.

**And one the falsification found.** A shallow put cleared the object and
reassigned, which moved the surviving child list to the front, because key order
in JavaScript is insertion order. The data was identical and the file was not —
which the reconciliation check compares, and which would make every diff of a
saved corpus unreadable. It now deletes only what the record does not restate.

##### Shipped at v3.14.241 (3c): the hot path

**This is the change the whole of D50 was for.** An annotator's save used to
rebuild the entire corpus as one string — **1.5 s at 50,000 words, 13.3 s at
300,000** — and now costs an append of about 1.7 KB. `doAutoSave` became
`compact(reason)` and moved off the edit path entirely; `saveTick` replaced it on
the debounce, which dropped from 1,500 ms to 400 because it is no longer hiding a
cost, only batching the several records one action writes.

**Participants split out.** They are not journalled — 845 bytes — so
`writeParticipants` writes them in full on the hot path without dragging the
corpus and dictionary along, which is what the old single `doAutoSave` did.

**All four triggers are in**: exit and window blur (both guarded on the last
compaction having been quick, since a 13 s freeze on switching away would be a
worse interruption than the one this replaced), the proportional size threshold,
and the idle timer with its measured back-off. Plus a fifth that is not a
trigger so much as a refusal: **an incomplete journal compacts immediately**, so
a save path that did not say what it wrote degrades to exactly what the app did
before D50.

**The guard had to be rewritten before it proved anything.** Its first version
asserted the base is written before the journal is emptied by comparing the order
calls were *made* — but `consider()` calls `write_abs` eagerly and awaits the
promises later, so call order is the same whether the code is right or wrong. It
could not tell a truncate-first bug from a correct implementation. It now holds
the writes open and asserts on **completion**, which is the property that
matters, and fails on the injected bug.

##### The first real session, 2026-08-30

Run against the live corpus on v3.14.241, after backing it up. Annotated words,
pushed to and deleted from the dictionary, added a sentence, sat idle, switched
apps several times, then **force-quit**.

| | |
|---|---|
| appends | **10**, carrying **24 records** |
| compactions | **3**, at **12 ms, 19 ms and 36 ms** |
| what triggered them | **window blur, every time** |
| journal after the force-quit | 1 record, 1,638 bytes, intact |
| replay on reopen | **1 applied, 0 unresolved** — the added sentence back with its 8 words, at index 2 of its paragraph |
| replay run twice | **0 applied, 1 skipped** — idempotent, as compaction after a crash requires |
| provenance unresolved on load | **0** of 357 |

**Interning reached disk for the first time.** The corpus went from 108,795 to
**78,282 bytes, −28.0%**, while *gaining* 10 morphemes and 4 annotated words.
B-119's migration landed with it: 33 lemma records now carry `record_type` and
none carries the old key.

**The dictionary delete's blast radius is visible on disk**, which is what stage
3a's journalling was for: a corpus word's `dict_id` cleared to null, written as
part of the same action.

**Idle compaction never fired, and is still untested.** Every compaction was a
window blur, because switching apps pre-empted the two-minute timer each time —
and after a blur compaction the journal is empty, so idle correctly does nothing.
Not a defect, but worth knowing: for anyone who alt-tabs, **blur is doing
effectively all the work**, and the idle timer may be a fallback that rarely
matters. It should still be exercised deliberately before the first stable
version.

**One defect found, ~~B-127~~ ✅ v3.14.244, and it was larger than it first
looked.** Filed on the symptom that was looked at — ten morphemes created from
lexicon offers, saved with no per-field provenance at all. The cause was in the
serializer: since v3.14.226 it interned `field_prov` from a table built only from
values that were already numbers, so any stamp written during a session was
dropped rather than converted. Every per-field stamp written across seventeen
versions went to disk as `field_prov: {}`. Fixed by interning on sight when
writing, which is the writer half of the tolerance `adoptProvEvents` already
had. Per-field provenance now reaches disk on every save.

##### Shipped at v3.14.243 (3d): binding, and two kinds of it

The two companions are bound differently, on purpose, because losing them costs
different things.

**The journal is bound by fingerprint, and a mismatch is refused.** A journal
opens with a `journal_head` record naming the corpus and dictionary it was
written beside. The direction is the only one that can work: the base cannot
record what to expect of the journal, because the journal grows after the base is
written — but the journal can record what it expects of the base, because the
base does not change until the next compaction, which is the same moment the
journal is emptied. So the check is exact. Replaying onto the wrong base would
apply edits to objects that are not the ones they were made on, silently and
completely, because a put is last-write-wins. A journal with **no** header is not
a mismatch: one written before this version still holds a real session, and
refusing it would lose exactly what it exists to protect.

**The dictionary and participants are not bound by a recorded expectation at
all** — and this is the design decision worth keeping. The corpus already
contains its references, so a missing companion is simply the state in which they
do not resolve. Counting them says more than a recorded filename would: not "the
dictionary is absent" but, measured on the live corpus, **92 links to 51 entries
and 579 provenance stamps that mean nothing without it**. Their loss costs
resolution and attribution and no data, so it warns and opens.

**That closes conflict ④.** Interning moved display names behind `annotator_id`,
so a corpus opened without its participants file renders identifiers where it
used to render names. Nothing counted that cost until now.

**The CLI refuses while a journal exists.** `corpus_annotate.py` stops and says
how many bytes of annotation working from the corpus alone would overwrite.
Only that script: **`corpus_optimize.py` takes no corpus path** — it configures
NLLB — so the earlier note that both would need it was wrong.

##### Durability

The guarantee comes from two mechanics, not from any threshold:

- **fsync per action.** A flush leaves the record in the OS buffer where a power
  cut still loses it. Roughly 1 ms on SSD, perhaps 10 ms on slow field storage —
  invisible next to today's 1.5 s save.
- **Atomic compaction:** temp file, fsync, rename over the base, **then** truncate
  the journal. Killed anywhere in that sequence yields old base + full journal or
  new base + full journal, and both replay correctly, because whole-record
  snapshots are idempotent — last write per id wins and a repeated `del` is still
  a delete. **Replaying an already-folded journal is a no-op**, so truncation is
  never safety-critical.
- The loader discards a torn trailing line and reports it, costing at most the
  action in flight.

##### Compaction triggers

Idle compaction is **not** crash protection — the journal is already on disk and
the next open replays it. It buys currency: the base stays complete for backup
tools, cloud sync, sharing and the CLI scripts, and reconciliation runs sooner.

| trigger | value | why |
|---|---|---|
| **exit** | always, if the journal is non-empty | one guaranteed full write per session |
| **size** | journal > **max(2 MB, 25% of the base)** | proportional self-corrects in the right direction: a 56 MB corpus tolerates a 14 MB journal (~9,500 saves) before a 1.5 s compaction, a 335 MB corpus tolerates 84 MB before a 13 s one. The 2 MB floor stops a small corpus compacting constantly, and is about 1,400 word-saves |
| **idle** | **2 min**, backing off to **10 min** when the last compaction took over 2 s | two minutes is past a think-pause, so it fires when the session has genuinely stopped. The back-off is the honest part: freezing 13 s because someone stepped away is the interruption this change exists to remove. One measured number tunes it |
| **window blur** | when the journal is non-empty and the last compaction was under 2 s | closing the lid is the strongest available signal a session ended |

**Replay is not the constraint.** Measured: 500 records 10 ms · 2,000 records
38 ms · 5,000 records 44 ms · **20,000 records / 28 MB in 202 ms**. The reason to
compact is tidiness and detection latency, not speed, which is why the thresholds
can be generous.

##### The CLI scripts

`corpus_annotate.py` and `corpus_optimize.py` **refuse while a non-empty journal
exists** and say to open and close the app first. A few lines, and it can never
operate on a stale corpus. The alternative — replaying in Python — is a second
implementation that must stay byte-identical to the JavaScript one, which is the
two-writers problem that produced `SCRIPTS_AUDIT`.

##### Binding

The base records the companions it expects. **A missing or short journal is lost
annotation, so the loader refuses** and names what is missing. A missing
dictionary or participants file loses resolution and attribution but no data, so
it opens with a persistent warning naming the count of unresolved links or
stamps. Participants is now the companion that carries attribution, since
interning made display names derive from `annotator_id`.
