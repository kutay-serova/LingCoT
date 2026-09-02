# Save architecture: options with measurements

**Updated:** 2026-08-29 · **Version:** v3.14.228  
*Written against v3.14.227, kept as the reasoning behind the decision. Not bumped again.*

---

## 0. What the corpus file actually is

Measured on the live Turkish corpus:

| | |
|---|---|
| physical records in `*_corpus.jsonl` | **1** |
| that record | the entire document tree, 108,549 chars |
| dictionary records | 74, one entry per line |

So despite the `.jsonl` extension, the corpus is not line-oriented. It is a single
JSON object on a single line. Every save serialises and rewrites the whole
document, whatever changed. At 162 words this is invisible. It is the thing that
decides whether 50k or 300k is possible.

Per-word cost, measured on the live file:

| | own bytes |
|---|---|
| bare (unannotated) word | 146 |
| fully annotated word | 1,136 |
| morpheme | 675 |
| morphemes per annotated word | 2.03 |
| sentence overhead per word | ~50 |

A fully annotated word therefore costs about **2.5 KB** before interning, and
about **1.7 KB** after (using the measured 32.1% reduction). A synthetic corpus
with interning applied to every stamp including `prov_history` comes out at
**0.97 KB/word**, which is the floor if interning is pushed all the way.

Provenance is **74.5% of an annotated word record** and **69.7% of a morpheme
record**. That is why interning paid so well, and it is worth knowing that the
remaining bulk is now mostly real linguistic content.

### Projected file sizes, fully annotated

| corpus | at 1.7 KB/word | at 0.97 KB/word |
|---|---|---|
| 5k words (short text) | 8.5 MB | 4.9 MB |
| 50k words (100-page book) | **85 MB** | 49 MB |
| 300k words (40h recorded speech) | **510 MB** | 291 MB |

---

## 1. Measurements

Benchmarks run on a synthetic corpus of the shape above (278 MB at 300k words),
Node 22, warm page cache. **Field hardware will be roughly 2 to 4 times slower**,
and an older spinning disk or a slow SD card slower still on the write column.
The ratios between options are what matter; the absolute numbers are a floor.

### 50k words (46 MB)

| | read | parse | **load total** | stringify | write | **save total** |
|---|---|---|---|---|---|---|
| A · monolithic (today) | 216 ms | 315 ms | **531 ms** | 283 ms | 256 ms | **539 ms** |

Half a second of frozen UI on every autosave, at the size of one book. On field
hardware, one to two seconds. This is the number that should decide the question.

### 300k words (278 MB)

| option | load | save one edit | bytes written per edit | peak heap |
|---|---|---|---|---|
| **A · one JSON line** (today) | **4.2 s** | **5.0 s** | 278 MB | 1.0 GB |
| **B · sentence-per-line JSONL** | 6.4 s | 2.4 s (full rewrite) | 278 MB | ~1 GB |
| **C · snapshot + append journal** | 6.1 s base, 6 ms journal | **0.002 ms** | **75 bytes** | 1.0 GB |
| **D · SQLite, row per word** | never (query) | 0.01 ms committed | ~1 KB page | ~0 |
| **E · file per paragraph** | 2 ms per unit | 0.4 ms | 333 KB | proportional |
| E' · file per section | 132 ms per unit | 12 ms | 13 MB | proportional |

Two supporting figures for D: a single sentence loads in **0.2 ms**, and the
database is 310 MB against 278 MB of JSON, so SQLite costs about 11% in size and
removes the load step entirely.

---

## 2. The options

### A · Keep the monolith

**Pros.** Zero work. One file, greppable, diffable, human-readable, recoverable
with a text editor. Every id resolves because everything is present.

**Cons.** Save cost is proportional to corpus size and independent of edit size.
At 50k it is a visible half-second hitch; at 300k it is five seconds and a
gigabyte of heap. A power cut mid-write destroys the whole corpus rather than one
record, which no amount of care in the app prevents.

**Verdict.** Fine to about 10k words. Not a field-hardware answer.

### B · Real JSONL, one record per sentence

Flatten the tree so parents hold child ids and each sentence is its own line.

**Pros.** Load becomes incremental, so a progress bar is possible and a corrupt
line costs one sentence rather than everything. Stays greppable and diffable, and
diffs become readable instead of one enormous changed line. This is the single
biggest gain in recoverability for the least conceptual change.

**Cons.** On its own it does **not** fix save cost. Rewriting one line means
rewriting the tail of the file, so a mid-corpus edit still moves most of the
bytes. Measured full rewrite at 300k is 2.4 s, better than A's 5.0 s only because
serialisation is cheaper per line, not because less is written.

**Verdict.** Necessary groundwork, insufficient alone. Worth doing regardless of
what else is chosen.

### C · Immutable snapshot plus an append-only journal

Keep a base file. Every field edit appends one small record. Compact
periodically (on close, or every N edits).

**Pros.** The measurement is decisive: **75 bytes and 0.002 ms per edit**, against
278 MB and 5 s. Save cost becomes independent of corpus size, which is exactly
the property the field-hardware goal needs. Crash safety is close to free, since
an append either lands or does not and the base is never in a half-written state.
The journal doubles as an edit history, which the provenance model already wants.

**Cons.** Load still parses the base, so **6.1 s at 300k is unchanged**. Two
representations of truth exist between compactions, and every reader must know to
replay. Compaction is a new failure mode and needs its own guard. A journal left
unreplayed by an outside tool silently shows stale data.

**Verdict.** Solves the save half completely and the load half not at all.

### D · SQLite

One row per node, body as JSON, indexed by parent.

**Pros.** Removes both problems rather than one. There is no load: the app queries
the sentence it is showing in **0.2 ms**. Writes are 0.01 ms and durable. Memory
use drops from 1 GB to nothing in particular, which matters more than speed on
the hardware you are targeting. Transactions give real crash safety. Search stops
being a full scan.

**Cons.** The format stops being greppable, diffable, and hand-repairable, and
that is a genuine loss for a research artefact meant to outlive the app. Sharing
a corpus means sharing a binary. Costs 11% more space. It is the largest rewrite
here: every read path in the app currently assumes the whole tree is in memory,
and `mutate()` and the render cache are built on that assumption. Export to JSONL
would have to be maintained forever as the archival format, so you end up with
both formats anyway.

**Verdict.** Technically the right answer for 300k. Expensive, and it trades away
a property (a corpus you can read with `less` in twenty years) that a linguistics
project has good reason to value.

### E · Split by structural unit

One file per paragraph, or per section, plus an index.

**Pros.** Save cost drops to the edited unit: **333 KB and 0.4 ms** at paragraph
grain. Load can be lazy, so opening a corpus costs the index plus the visible
paragraph, 2 ms. Every file stays plain JSON and fully greppable, so nothing is
given up on the archival side. Conceptually the smallest change of the three that
actually work, because the record shapes do not change at all.

**Cons.** 858 files for a 300k corpus, which is awkward to hand to someone and
easy to partially copy. The dangling-companion problem you already have with the
dictionary multiplies by 858. Cross-paragraph operations (search, export,
validation) must open everything, so they get slower, not faster. Section grain
halves the file count problem but gives back most of the save gain (13 MB per
edit).

**Verdict.** Good numbers, and it keeps the format honest, but it makes the
"user mistakenly omitted a file" failure mode much worse at exactly the moment
you are trying to reduce it. A zip container would fix that and reintroduce
full-rewrite cost.

---

## 3. Combinations worth naming

- **B + C** (line-oriented base, append journal, periodic compaction). Save cost
  becomes constant, format stays text, crash safety arrives, load stays 6 s at
  300k and 0.5 s at 50k. Moderate work, no property given up.
- **B + C + lazy parse.** With sentence-per-line, load can parse only the section
  in view and defer the rest, which removes the last bad number without adopting
  a database. This is D's benefits at B's cost, and it is the option I would
  argue for if 300k is a real requirement.
- **D with a maintained JSONL export.** The performant answer plus the archival
  one, at the cost of keeping two writers correct forever.

---

## 4. Recommendation

**Do B and C. Defer D. Do not do E as files on disk.**

The reasoning is that the two problems have different urgencies. Save cost is
already bad at 50k (half a second per autosave, one to two seconds in the field)
and it is fixed cheaply and completely by C, at 75 bytes an edit. Load cost is
only bad at 300k, which is the case you have said is unusual, and it is fixed by
lazy parsing on top of B without a format change. D solves both but asks you to
give up a plain-text corpus, and that is a decision about what the project is,
not about performance.

Two things worth doing first, both small:

1. **Measure the real autosave frequency.** Everything above is per-save cost. If
   the app saves on every field commit, a 50k corpus is already writing 85 MB per
   annotated word, which would be the most wasteful thing in the system and worth
   knowing before any redesign.
2. **Push interning to `prov_history`.** The synthetic shows 0.97 KB/word against
   the current 1.7, so roughly another 40% is available from work already
   understood, with no format upheaval and no new failure modes.
