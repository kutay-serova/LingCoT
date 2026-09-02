# The file split: options

**Updated:** 2026-08-29 · **Version:** v3.14.228  
*Written against v3.14.227, kept as the reasoning behind the decision. Not bumped again.*

---

## 0. Two corrections before the options

**This is not a consequence of interning.** `dict_id` has linked by opaque id
since long before v3.14.226. Interning changed where *provenance* is stored, not
where *links* point. So dictionary swapping is not newly broken — it has never
worked, and nothing about it got worse this week.

**Re-linking is not the heuristic nightmare it looks like.** Measured on the
live corpus and dictionary:

| | |
|---|---|
| corpus links to dictionary entries | **84** |
| re-findable by `(normForm, type)` | **83 — 98.8%** |
| ambiguous under that key | **0** |
| already dangling | 1 |
| `(form, type)` keys that collide | **0 of 46** |

**Corrected the same day.** The third component is not actually stored.
Measured on the live dictionary: `homograph` is present on **0 of 75** entries,
and `type` is null on **29 of 75**. D35 A1 designed the discriminator; nothing
writes it. So `(normForm, type, homograph)` is an intention, not a key, and the
98.8% above is re-finding a corpus's links in *its own* dictionary, which is the
easy direction.

The hard direction is a dictionary built in a different corpus, and it has three
failure modes rather than one:

| | |
|---|---|
| **miss** | the lexeme is absent. Harmless if counted and reported |
| **false miss** | present but keyed differently, because two annotators typed the form or assigned `type` differently. Recoverable, manual |
| **silent wrong link** | two projects both hold `kaz` as `word`, meaning different lexemes. A form-based re-linker connects them and says nothing |

The third rules out automatic swapping. Homograph indices do not save it: they
are per-dictionary sequence numbers, so `(kaz, word, 2)` in two dictionaries are
not the same claim. The problem is not that links are opaque ids. It is that
**no stored property identifies a lexeme outside the corpus that created it.**

That does not make swapping *desirable*. It does mean the cost of keeping the
split is much lower than assumed, so the decision should be made on what the
dictionary IS rather than on fear of the re-linker.

---

## 1. The real question

The three files exist for three different reasons, and only one of them is about
privacy.

- **participants** is separate because it holds real people: names, affiliation,
  birth decade, contact details.
- **dictionary** is separate because a lexicon might be *reused* — one Turkish
  lexicon across five texts.
- **corpus** is the thing itself.

So: **is a dictionary a shared artefact or a per-corpus one?** If it is
per-corpus, the split buys nothing and costs a companion that can go missing. If
it is shared, the split is the whole point.

Measured, weakly: **45 of 46 entries (98%) have their form somewhere in this
corpus.** That looks per-corpus — but this is a test corpus built from one text
by one person, which is exactly the case that would look that way regardless. It
is evidence, not proof, and it is the one number here I would not lean on.

---

## 2. Options

### A · One file for everything, PI extracted by procedure

Corpus, dictionary, provenance events and participants in a single file; a
"prepare for sharing" step strips participants before publication.

**Pros.** Nothing can be lost or mismatched. Every id always resolves. One thing
to hand someone. Kills the whole dangling-companion class (B-126 and its
relatives) by construction.

**Cons.** **PI separation becomes a procedure rather than a structure, and this
is the decisive objection.** A procedure can be skipped, forgotten, or run on the
wrong copy, and the failure is unrecoverable: names in a public repository, in
git history, permanently. Your own precautions run the other way — gitignore by
pattern, a pre-commit hook, participants denied by name — all structural. And
interning made the corpus and dictionary PI-free — **with a correction added
2026-08-30**: that was measured on a round-tripped file, and a file the app
actually writes was not, because `thinProv` ran only at load. Measured on the
live corpus after a real session, 19 occurrences remained in the corpus and 22 in
the dictionary. **B-129 fixed it at v3.14.244**, so the property now holds of
what the app writes as well as of what it reads — but the argument below rested
on it for a fortnight while it was half true. The decision does not change: it
turns on participants, which can never merge, not on this.

### B · Two files: work + people

Corpus and dictionary merged; participants stay their own file.

**Pros.** Everything A gives, except that PI separation stays structural — the
sensitive file is never joined, so it cannot be accidentally shared. The merged
file is PI-free by construction, which is now true and worth keeping. No
companion mismatch for the thing that actually links by id.

**Cons.** A dictionary can no longer be reused across corpora without an
import step. If lexicon reuse is real, this is the option that forbids it.

### C · Keep the split, make entries re-findable

Add the declared key `(normForm, type, homograph)` as a secondary identity, so a
corpus can re-link to a different dictionary when ids miss.

**Pros.** Preserves reuse. Makes swapping actually work. No format upheaval.
Measured cost is low: 98.8% resolve on the first try with zero ambiguity.

**Cons.** Two identities for one thing is a standing source of disagreement — the
id says one entry, the key says another, and something has to arbitrate. The
ambiguous residue needs a review surface, which is real UI work for a case that
may never arise.

### D · Keep the split, bind it

Stamp the corpus with the dictionary's identity and a content hash, so a
mismatched companion is **detected and refused** rather than silently dangling.

**Pros.** Cheap — a day. Kills the silent failure without touching the format.
Honest: the app stops pretending a wrong dictionary is a right one.

**Cons.** Does not enable reuse; it forbids it more loudly. Solves the safety
half of the problem and none of the workflow half.

### E · Embedded by default, lexicon export and import

The dictionary lives in the corpus file (as B), plus explicit **export lexicon**
and **import lexicon** operations, where import merges by the declared key and
shows what it matched before committing.

**Pros.** The common case is safe and single-file; the reuse case is possible and
*deliberate*. A merge you reviewed is a different act from a swap that happened
to you, and the ambiguity is surfaced once, at import, rather than lurking.

**Cons.** The most work — B plus C's key plus a review surface. Two
representations of a lexicon to keep honest.

---

## 3. Recommendation

**B now, E when lexicon reuse turns out to be real**, and **D's binding regardless
if the split survives at all.**

The reasoning is mostly about PI. Merging participants would trade a structural
guarantee for a procedural one, on the single axis where a mistake is permanent
and public — and it would do so in the same week that interning made the other
two files clean. That is a bad trade at any price, and A is the only option that
asks for it.

Between B and C, the honest position is that **you do not yet know whether a
dictionary is shared**, and the measurement that looks like an answer is from a
corpus that could not have said otherwise. B is reversible: a lexicon can be
exported out of a merged file later. C is also reversible but carries the
two-identities problem indefinitely for a benefit that may never be used.

**What I would do first, regardless of which you pick:** the dangling case is
live right now and says nothing. Sharing a corpus without its dictionary produces
83 links that resolve to nothing, silently — the same class as B-126, one level
up. D's binding, or at minimum a count and a warning on load, is worth having
before any of the larger decisions.


---

## 4. Decided, 2026-08-29

**Option B, plus a one-way dictionary export.**

Corpus and dictionary merge into one work file; participants stay their own file,
so PI separation stays structural rather than procedural.

The addition, which is better than option E and replaces it: **export the
lexicon in a machine-parseable form, and do not pretend it can be imported into
another corpus.** This separates two things the options above had bundled
together.

- **Portability** is getting the lexicon into other linguistic tools. Named
  targets: FLEx, ELAN, Praat. Timestamp handling for the last two is its own
  discussion.
- **Interchange** is linking a corpus to a foreign dictionary. Only this one has
  the identity problem, and a one-way export does not attempt it. The worst case
  becomes a consumer that misreads a column, which is visible immediately.

**Deferred deliberately, to be decided when the feature is built:** the export
format, and whether annotator attribution appears in it. Interning has just made
the dictionary PI-free for the first time, so an export writer that re-expands
`annotator_id` into a display name would undo that on the one surface intended
for sharing. That is a publication decision, not a formatting one.

**Gated behind lemma/sense structure.** The dictionary is two-level and the
linkage is incomplete. Measured on the live dictionary, 2026-08-29:

| | |
|---|---|
| `record: "lemma"` headwords | 29 |
| sense entries | 46 |
| sense entries carrying `lemma_id` | **14 of 46** |
| senses with no lemma | 32 |
| lemmas with no senses | 15 |

Exporting now would flatten a hierarchy that is already broken, and publish that
flattening as though it were the model. **D35 stage B and B-106 come first.**

**A safe middle exists for later, if lexicon reuse turns out to be real:** a
*seed import* that reads an exported lexicon and creates new entries, never
linking to foreign ids. It claims no identity, so it cannot produce a silent
wrong link. It only saves retyping. Not scheduled.
