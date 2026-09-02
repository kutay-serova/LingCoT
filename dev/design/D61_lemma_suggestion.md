# D61: a lemma suggestion chip
**Updated:** 2026-09-01 · **Version:** v3.14.362

**DECIDED and BUILT at v3.14.362: sources 1-3 ship, source 4 is deferred.**
The sketch below is kept as written because its reasoning is what the build
followed; this header records what changed on contact with the code.

- `lemmaProposals(word)` is the one proposer; `lemmaStripHtml` shows its output
  in the state it previously had nothing to say in — an EMPTY lemma field.
- `source/resources/citation_forms.json` is §3's table, **keyed by the canonical
  code `_corpusLangCode` resolves to** (`tr`, not `tur`). The first draft used
  ISO 639-3, which the app never produces, so the table was dead data and the
  guard passed because it asked with the same wrong key. `zh: {}` ships present
  and empty — §3's "it must be able to say nothing", as data.
- Turkish `-mAk` needed vowel harmony, which the sketch did not anticipate. It
  is expressed in the table (`harmony` + `alternants` + a per-language vowel
  class set), not in code, so a second language needs no edit to the app.
- Nothing writes. A proposal is text in a field; `_resolveOrCreateLemma` remains
  the only thing that turns a citation form into a record, and an accepted chip
  is stamped `derived` through `dataset.offerSrc` (B-165).
- Measured after building, against the live corpora: **29 un-lemmatised tokens
  would be offered a chip** — 28 from source 2, 1 from source 3, 0 from source 1
  (every linked token in these corpora already carries a lemma, so source 1 is
  mostly redundant with what is already filled — worth knowing before anyone
  builds more on it).

`lemma_proposal_test.js` holds all of it, 42 checks, 13 mutations.

*The sketch, as written at v3.14.352, follows.*

**Asked 2026-09-01.** The lemma field is typed by hand for every token. A chip
that proposes one would put it where the POS chip already is — but a lemma is not
a POS, and the ways it is not are the whole of this sketch.

## 1. Why this is not the POS chip again

The POS chip (B-166) offers a value **that already exists in the dictionary**,
found by exact form match. Every part of that is easy: the vocabulary is closed,
the lookup is exact, and a wrong offer is one keystroke to ignore.

A lemma proposal is none of those. The vocabulary is open — the answer may be a
lemma nobody has written yet. The lookup is inexact by nature: `gitti` and
`gitmek` share no prefix under a naive comparison, and `koştu`/`koşmak` do. And
a lemma is the **identity** of a lexeme, so a wrong one that is accepted quietly
merges two words for as long as the corpus lives.

So the design question is not "can we guess" but **what a guess is allowed to be
worth**, and the answer this project keeps reaching is the one D60 just reached:
propose, name the evidence, and let the annotator decide.

## 2. Four sources, in descending order of how much they know

The chip should not be one algorithm. It should be a **ranked list of proposals,
each carrying where it came from**, because the annotator's decision differs
completely by source. In order:

| # | source | what it knows | confidence |
|---|---|---|---|
| 1 | **the token's own dictionary entry** | `dict_id` → `lemma_id`. Not a guess at all | certain |
| 2 | **another token of the same form, already lemmatised** | this corpus, this annotator, this session | high |
| 3 | **a morpheme that is a root** | the parse says which part is the lexeme | good |
| 4 | **string similarity over existing lemmas** | nothing about language, only shape | low |

**1 is already built** and is not a suggestion: if the token is linked, the lemma
follows. What the chip adds is 2–4, and **2 is the one that pays.** L-034
measured 135 of 310 glossed-token decisions as re-decisions of a form already
decided; the same shape holds here, and a proposal that says *"`gitti` was
lemmatised `gitmek` an hour ago, by you"* needs no cleverness and cannot be
wrong in a way the annotator cannot see.

**3 is the linguistically honest one.** The morphological parse already names the
parts. A word parsed `git-ti` has a root morpheme `git`, and the lemma of the
lexeme is a citation form derived from that root — which is language-specific and
is where §3 comes in. It should be offered when the parse exists and the root is
identifiable, and not otherwise.

**4 is the one to be most careful with**, and possibly to leave out of the first
version. See §4.

## 3. The language-specific part, and where it already lives

`normalize.js` holds per-script fold profiles (`fold`, the `Latn`/`Arab`/`Hebr`/
`Hans` table) and `normForm` is the app's one folding rule. Any comparison here
goes through it — a lemma proposal that used `toLowerCase()` would be B-043
again, in the one place where Turkish `I`/`ı` is not a corner case but the
common case.

What `normalize.js` does **not** hold, and what a citation form needs, is a
per-language rule for **how a lemma is written**: Turkish verbs cite as
`root + -mAk`, nouns as the bare root; Korean verbs cite as `stem + -다`; English
verbs as the bare stem. This is a small table, it is data not code, and it belongs
beside `pos_tags.json` and `type_choices.json` in `source/resources/` rather than
inside a function — the same argument that put the POS vocabulary there.

**It must be optional.** A project working on a language with no rule written yet
gets sources 1–2 and no citation-form proposal, rather than a wrong one. A
suggestion mechanism that cannot say "I have nothing" is the one that gets
believed when it is wrong.

## 4. Fuzzy matching: what it would cost

Edit distance over the lemma list is cheap to write and hard to justify:

- **It does not know morphology.** `git`/`gid` (Turkish consonant alternation) is
  distance 1 and correct; `git`/`bit` is distance 1 and a different word. The
  measure cannot tell them apart, and the annotator has to check every proposal,
  which is most of the work the chip was meant to save.
- **It gets worse as the dictionary grows**, which is backwards: the more work
  has been done, the more near-misses there are to rank against.
- **It is the one source that can propose a lemma the token has nothing to do
  with**, and D60's argument applies with more force here than it did to a link,
  because a lemma is an identity claim.

If it ships, it should be: **last in the list, visibly labelled as a shape match,
capped at one proposal, and only when 2 and 3 have nothing.** A better use of the
same effort is to make the parse-based proposal work well, because the parse is
real information the annotator has already supplied.

## 5. The surface

The lemma strip already exists (`refreshLemmaStrip`), which is where this goes —
not a new panel. Each proposal is a chip carrying its **source**, because the
source is what makes it decidable:

```
lemma  [ gitmek ]                         ← typed, or already linked
       ┌ gitmek · you, 14 tokens ┐        ← source 2, the one that pays
       ┌ git- + -mek · from the parse ┐   ← source 3
       ┌ gitmek? · similar form ┐         ← source 4, if it ships at all
```

Taking a chip **fills the field; it does not resolve the lemma.** The existing
save path (`_resolveOrCreateLemma`, B-114) still runs and still decides between
an existing lemma and a new one, so this adds a proposal and changes no writer —
the same shape as the POS chip and as D60's offer.

**Provenance:** a taken chip is `derived`, and the field carries `dataset.offerSrc`
the way `_fillMorphRows` does, so B-165's rule holds — a lemma the app proposed is
not recorded as the annotator's judgement.

## 6. What would have to be decided before building

1. **Does source 4 ship at all in v1?** My inclination is no: 2 and 3 are real
   information, 4 is a guess dressed as one, and the first version sets what the
   chip is believed to be worth.
2. **Where does the citation-form table live and what is its shape?** A per-
   language map of POS → affix, in `source/resources/`, is the smallest thing
   that could work — but it needs one real second language to be designed against,
   and Mandarin (D58's replacement fixture) has no citation morphology at all,
   which is itself the useful test: the table must be able to say "nothing".
3. **What happens on a corpus with no dictionary yet?** Source 2 works from the
   corpus alone, source 1 and 4 need the dictionary. The chip should be useful on
   day one of a project, which argues for building 2 first and alone.

## 7. Smallest version worth building

**Source 2 only.** A chip that says *"this form was lemmatised `X`, N tokens"*,
from the corpus's own tokens, through `normForm`, with the count and no
cleverness. It needs no new resource file, no language rule, no fuzzy measure,
and it addresses the measured cost — re-deciding a form already decided. If it
turns out to carry most of the value, sources 3 and 4 can be judged against
something real instead of against a hope.
