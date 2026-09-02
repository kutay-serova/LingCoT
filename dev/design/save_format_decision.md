# Decision brief: the save format, and whether the dictionary merges into the corpus

**Updated:** 2026-08-29 · **Version:** v3.14.232  
*Frozen at the version it was written against. The decision it prepares is recorded in DEV_PLAN when taken.*

One decision, not two. The layout question (does the dictionary live in the
corpus file?) and the format question (what does saving cost?) were taken and
posed on the same day without reference to each other, and the answer to the
first depends entirely on the second.

Everything measured here was measured at the **real post-interning density**,
1,272 characters per fully annotated word, established when B-116 was re-measured
at v3.14.231. Container hardware; **field hardware is 2 to 4 times slower**, and
slower still on the write column with a spinning disk or an SD card.

---

## 1. What changed since the options were written

Three things, and each moves the decision.

**The string ceiling is gone as a constraint.** B-116 said a 300,000-word corpus
could not be loaded or saved at all. Re-measured post-interning, the ceiling
moved from ~216,000 to ~422,000 words. Nothing is impossible any more.

**What binds instead is memory and time**, and those numbers are worse than the
ceiling framing suggested:

| | 50,000 words (a book) | 300,000 words (40h speech) |
|---|---|---|
| corpus on disk | 56 MB | 335 MB |
| load, read + parse | **1.2 s** | **11.1 s** |
| **heap after parse** | 381 MB | **2,273 MB** |
| save, serialize + fingerprint + write | **1.5 s** | **13.3 s** |

2.3 GB of heap is the 300,000-word constraint. On the older field hardware this
tool is meant to run on, that is the number that decides whether it runs at all —
not V8's string limit.

**The save path costs more than "write the file".** `doAutoSave` debounces 1.5 s
and then, per target, builds the whole string, runs `_fingerprint` over it
character by character, and writes. At 300,000 words the fingerprint alone is
**1.15 s** of a per-character JavaScript loop, and it runs *before* the app knows
whether anything needs writing. The second brake is not free at scale.

---

## 2. What the merge actually costs

The merge is not expensive in the way it first looks. Measured on the live
corpus's own edit history — 70 distinct (date, time) moments across corpus and
dictionary:

| save moment | share | today | after the merge |
|---|---|---|---|
| corpus only | 41% | serialize corpus | unchanged |
| both (a word save that pushes to the lexicon) | 44% | serialize both | unchanged |
| **dictionary only** | **14%** | serialize the lexicon | **serialize everything** |

So only one save moment in seven gets dearer. But it gets *much* dearer, because
today that moment is the cheapest thing the app does:

| | 50,000 words | 300,000 words |
|---|---|---|
| dictionary-only save, today | **20 ms** | **235 ms** |
| the same save, merged | **1,929 ms** | **14,776 ms** |
| | **96× worse** | **63× worse** |

The real loss is structural rather than arithmetic. Three targets with
independent generation counters and independent fingerprints are the only reason
*any* save in this app is currently cheap. The merge deletes that mechanism, and
it deletes it for the file whose edits are most frequent during lexicon work.

**Under a journal none of this applies** — an appended edit costs 70 bytes and
0.002 ms whatever file it belongs to, and the distinction between targets stops
mattering. That is why this is one decision.

---

## 3. The options, priced

| | save one edit, 50k | save one edit, 300k | load, 300k | greppable | crash cost |
|---|---|---|---|---|---|
| **A · monolith, split files** (today) | 1.5 s corpus / 20 ms dict | 13.3 s / 235 ms | 11.1 s | yes | whole corpus |
| **B · monolith, merged** | 1.9 s, every edit | 14.8 s, every edit | 11.1 s | yes | whole corpus |
| **C · sentence-per-line, split** | 1.3 s (tail still moves) | 12 s | 11.1 s, incremental | yes, and diffs read | one sentence |
| **D · base + append journal** | **0.002 s** | **0.002 s** | 11.1 s + 80 ms replay | yes | one edit |
| **E · SQLite** | 0.01 ms, durable | 0.01 ms | none — 0.2 ms per sentence | **no** | one row |

Two supporting figures for D: 2,000 appended edits replay in **80 ms**, and the
journal for a full annotation session is well under a megabyte. Two for E: the
database is ~11% larger than the JSON, and it removes the 2.3 GB heap entirely
because nothing is ever fully loaded.

---

## 4. What each option implies for the merge

| format | merge? | why |
|---|---|---|
| A, today's monolith | **no** | it converts the cheapest 14% of saves into the most expensive, for no gain |
| B, monolith + merge | — | this *is* the merge under A; the row above is the argument against it |
| C, line-oriented | **no benefit, no harm** | the tail still moves either way; the merge neither helps nor hurts |
| D, journal | **yes, free** | save cost stops depending on which file or how big; the merge's only cost disappears |
| E, SQLite | **yes, by construction** | one database, tables rather than files; the question dissolves |

The layout decision recorded at v3.14.228 — corpus and dictionary merge,
participants stay separate — is therefore **correct under D or E and premature
under A**. It should be restated as conditional rather than reversed.

---

## 5. The conflict that constrains the choice

**A journal and the interning that shipped at v3.14.226 are structurally
opposed, and this has to be settled before either moves again.**

`serializeRecords` builds the provenance event table per full serialization: it
assigns local ids in order of first appearance, emits a dense table, and
renumbers on every save, dropping events nothing references. The table is
deliberately the **first** line — that is B-126's fix, so that a truncated file
loses visible sentences rather than invisible provenance.

A 70-byte appended edit cannot reference a `field_prov` integer whose meaning is
fixed by a table at the head of the file and renumbered at the next compaction.
And appending to the tail can never extend a first-line table.

Three ways out, in order of preference:

1. **Stable global event ids**, minted once and never renumbered. The table stops
   being dense; compaction garbage-collects it. This is a small change to
   `internProv` and `serializeRecords` and it is the right answer under D.
2. **Journal records carry inline provenance**, compacted into the table at the
   next full write. Simpler, but it re-inflates in the journal exactly what
   interning removed from the base, and a long session's journal grows fast.
3. **Compact on every Nth edit** so the window of inconsistency is small. This is
   a mitigation, not a design.

**Consequence for sequencing:** do not push interning into `prov_history` — the
~40% further reduction the options document recommends next — until this is
settled. Under (1) that work is done once; done now it is done twice.

---

## 6. Recommendation

**Take D, the append-only journal, with stable global event ids. Merge the
dictionary as part of that same migration. Keep participants separate and bind
it.**

The reasoning:

**Save cost is already bad, and it is bad at the size you actually care about.**
1.5 seconds of frozen UI per autosave at 50,000 words — three to six seconds on
field hardware — is not a 300,000-word problem. It is a problem for a
hundred-page text, which is the ordinary case. D fixes it completely and makes
the cost independent of corpus size, which is exactly the property the
field-hardware goal needs.

**It is the only option that makes the merge free**, and the merge is worth
having: it removes the whole dangling-companion class that produced B-126, and
that class is not theoretical — it cost an S1 three versions ago.

**It gives up nothing.** The corpus stays plain text, greppable, diffable,
readable with `less` in twenty years. E is technically better and asks you to
trade that away; for a linguistics artefact meant to outlive the app, that is a
decision about what the project is, and it does not have to be made now.

**Load stays unfixed, and that is acceptable for now.** 11.1 s and 2.3 GB at
300,000 words is untouched by D. The answer, when it is needed, is lazy parsing
on top of C's line-oriented base — which composes with D rather than competing
with it. At 50,000 words load is 1.2 s and 381 MB, which is fine.

**What I would not do:** merge under today's monolith (the measured 96× on
dictionary-only saves), or adopt SQLite now (largest rewrite, gives up the
archival property, and `mutate()` and the render cache both assume the whole tree
is in memory).

---

## 7. What this decision settles, and what follows automatically

Deciding D settles, without further argument:

- **conflict ②** — the journal/interning incompatibility, via stable ids
- **conflict ③** — the merge's save cost, which disappears
- **conflict ⑬** — flattening's id-sort trap is not triggered, because D keeps
  the tree in the base file rather than splitting it into lines
- the ordering of ten separate items that each change what is on disk, which
  become **one migration**: the merge, B-119's `record` declaration, L-020's
  legacy field drop, `lemma.comments`, `alternate_forms`, C19's `prov_history`
  cap, `prov_history` interning, and D26

Still to decide separately, and cheap:

- **what binds the participants companion** (conflict ④) — it is now the only
  companion and it carries attribution, so a corpus opened without it renders
  `ann_001` everywhere
- **is `transliterations` core or aux** (conflicts ⑦/⑧) — a table edit today, a
  migration later, and D34 is unbuildable until it is answered

---

## 8. What must not happen before this is decided

| | why |
|---|---|
| pushing interning into `prov_history` | spends the work twice under D (§5) |
| hand-annotating gate 1's replacement corpus | its dependency parses are the most expensive part and the most likely to be disturbed by the migration |
| implementing the merge as decided at v3.14.228 | correct under D, a 96× regression under A |
| B-124's fix landing *after* the migration | `saveWord` drops undeclared morpheme keys, so a migration running through it loses what it is trying to preserve |

---

## 9. Open question this brief cannot answer

**How often does the annotator actually pause for 1.5 seconds?** Every figure
above is per-save. The debounce means a save fires once per idle window, and the
observed workflow — transliteration, POS, parse, morpheme fields, lemma — has a
natural pause after each field commit. If that is roughly one save per field,
then a 50,000-word corpus writes 56 MB per annotated field, which would be the
most wasteful thing in the system and would make D urgent rather than merely
right. Instrumenting `doAutoSave` with a counter for one session would settle it
in an afternoon, and it is the single cheapest measurement left.

---

## 10. The density every figure above uses is 21% high — corrected v3.14.390

**Not a change of mind, a change in the data.** Everything here was measured at
1,272 characters per fully annotated word, established when B-116 was re-measured
at v3.14.231. **D50 stage 4 brought it to 1,050** — provenance interning, taken
after this brief was written and partly because of it. So every disk, load, heap
and save figure in §§2-8 is about a fifth high, and the ratios between the
options are unaffected because all four columns move together.

**What this does not touch is the constraint that decided it:** the ceiling is
the heap, not V8's string limit, and a fifth less per word does not change which
of the two binds first. Recorded here rather than corrected in place because the
brief is the reasoning behind a decision that shipped at v3.14.250, and a
measurement rewritten after the fact stops being evidence of what was known.

**§9's open question is still open** — nothing has instrumented `doAutoSave`
with a per-save counter, and it is still the cheapest measurement left.
