# UX cluster audit: D31, D32, D33, D35, D37, D40 · 2026-08-30
**Updated:** 2026-08-30 · **Version:** v3.14.272
*Written against v3.14.272; the re-spec landed at v3.14.273. Frozen.*

Commissioned as "audit these for a re-spec". Everything below was measured
against **both** corpora — `turkish_test_corpus` (162 words, 77 morphemes, 52
dict entries + 33 lemma records) and `samples/turkish-test` (98 words, 20
morphemes, 22 + 10) — through the app's own `normForm` and `field_spec.js`
rather than a re-implementation.

**Three of the six specs changed shape because the data contradicted their
premise.** That is the point of the document: each of them was internally
coherent and had been argued carefully, and none of them had been checked
against the corpus it describes.

---

## 1 · No multi-entry list has more than one entry

Across **561 annotatable objects** in the two corpora, the maximum length of
`transliterations`, `translations`, `comments`, `variants`, `allomorphs`,
`constituent_forms` or `source_ids` is **1**.

| field | non-empty, live | non-empty, samples | any with >1 |
|---|---|---|---|
| transliterations | 33 word | 6 word · 3 sentence | **0** |
| translations | 2 para · 10 sentence | 13 sentence | **0** |
| comments | 2 para | 1 sentence | **0** |
| variants | 0 | 0 | 0 |
| allomorphs | 0 | 0 | 0 |
| constituent_forms | 0 | 0 | 0 |
| source_ids | 1 section | 1 section | **0** |

**Consequences.** D31's ordering question and D32's "what does a compact view
show when several labels exist" have zero instances in the data. B-042's
show-two-fold-the-rest control (v3.14.—, sentence view) has never fired on real
data. B-139's "not urgent" conclusion survives, though its stated fact — that all
three string lists are empty — is wrong for `source_ids`.

**And the storage half of D31 already shipped.** `assignList` (B-138, v3.14.261)
reconciles a rewritten list against the old one by CONTENT, not index. Its own
comment says reordering costs nothing. D31 refused to be an afternoon's work
because "order becomes stored data — provenance, migration"; that objection was
answered by a different bug's fix, and nobody noticed.

---

## 2 · The transliteration derivation is stored, and signed by the wrong person

`_deriveWordFields` (`LingCoT.html:1869-1877`) writes
`word.transliterations = [{ label: 'Translit', text: … }]` in **two** cases:
when the annotator types into `#ew-translit`, and when they leave it empty and
the morphemes supply one. The same minted label in both, so the file cannot say
which happened. `saveWord` then stamps the field (`:9798`) by diffing
`data-original` against the current value, with `prov()` — the human's moment.

| | live | samples |
|---|---|---|
| word transliteration elements | 33 | 6 |
| labelled `Translit` | **33** | **6** |
| carrying a `field_prov.transliterations` stamp | 30 | 6 |
| of those, marked `derived` | **0** | **0** |
| of those, signed by a person | **30** | **6** |

**39 of the 42 transliteration elements in both corpora are machine-derived,
stored, and attributed to the annotator.** The other three are the only
hand-typed labels anywhere — and two of them disagree with the third on case.

This is **B-061's defect, third occurrence**. B-061 was a gloss inherited from
the lexicon signed by the annotator; B-137 generalised the writer so a provider
*cannot* forget, because `_derivedFieldProv` and `stampField` do it. This path
predates that contract and never joined it: the derivation is not an offer taken
through `takeOffer`, so nothing marks the field and `stampFieldProv` has no way
to know. Filed **B-141**.

**Why it re-specced D32.** D32 asks whether a word's transliteration is authored
or derived. The app does both, always has, and the data cannot distinguish them.
The provenance fix has to precede the model decision, or the decision is taken
against evidence the defect coloured.

Two smaller findings from the same surface: the box **cannot clear the field**
(**B-142**), and `_indexWordLabels` harvests labels from **words and morphemes
only**, so three of the five levels contribute nothing to the suggestion pool —
which is why `samples/` carries `"test system"` and `"Test System"` with no
mechanism that could have caught it (**B-145**).

---

## 3 · D40's premise, measured

Grouping by `dictKey()`, which is D40's own identity rule. Disagreement = two or
more distinct non-empty values among tokens sharing a key, compared NFC-folded so
pure casing does not count.

| | live | samples |
|---|---|---|
| word forms occurring more than once | 22 (85 of 162 tokens) | 18 (66 of 98) |
| of those, disagreeing on gloss / POS / parse | **1** | **0** |
| morpheme forms occurring more than once | 12 | 3 |
| of those, disagreeing | **1** | 0 |
| tokens that would RECEIVE an offer (gloss) | 17 of 162 | 19 of 98 |
| morphemes that would receive one | **0 of 77** | 0–1 of 20 |

**The one disagreement is a homograph, both times the same one.** Word level:
`yüzdüm` → `swim-PST-1.SG` and `peel-PST-1.SG`. Morpheme level: `yüz` → glosses
`hundred`, `swim`, `peel`; POS `NUM` and `VERB`. A silent copy would be wrong 1
time in 22, and wrong exactly where the language is hardest — so D35's gate on
D40 is measured rather than cautious.

**Morpheme level gains nothing**: 0 of 77 live morpheme glosses are empty. The
level is saturated and drops out of D40's scope.

**A prerequisite D40 did not know it had.** `S.wordFormRefs` is keyed on the raw
`word.form` (`LingCoT.html:1379`), not `normForm`. Live: 101 raw keys against 99
folded. The index D40 names cannot answer D40's question, and a miss looks like
"no other occurrence". Filed **B-144**.

---

## 4 · The lemma layer, and what B-106 is actually choosing between

| | live | samples |
|---|---|---|
| dict entries (non-lemma) | 52 | 22 |
| `record_type: "lemma"` records | 33 | 0 — its 10 are legacy `type:"lemma"`, migrated on load |
| entries carrying `lemma_id` | 14 (26.9%) | 9 (40.9%) |
| lemmas pointed at by ≥1 **entry** | **14 of 33** | 9 of 10 |
| lemmas pointed at by ≥1 **token** | **33 of 33** | 10 of 10 |
| dangling `lemma_id` | 0 | 0 |
| forms with >1 dict entry (real homographs) | **0** | **1** (`metin`) |
| entries carrying a `homograph` number | **0** | **0** |
| words with `dict_id` | 16 (9.9%) | 12 (12.2%) |
| morphemes with `dict_id` | 76 of 77 (98.7%) | 19 of 20 |
| dangling `dict_id` | 0 | 0 |

**B-106's choice is between two indexes that both already exist and are both
already maintained** — `dictByLemmaId` for entries, `corpusLemmaRefs`
(`LingCoT.html:507`) for tokens. Nothing renders the second. An entry-only group
view shows **nineteen empty groups out of thirty-three**; a view that asks both
shows thirty-three populated ones. Decided v3.14.273: **it asks both.** The
alternative — linking the root morpheme's entry when a push creates no word entry
— needs the app to name the root, which **B-069 established it cannot justify**.

**B-143, found here.** `assignHomographs` is called from `_indexDictEntry` and
from the form-edit path — the two paths that CREATE or rename. `buildDictIndex`
(`:3799-3826`) rebuilds every index and does not call it, so **an entry loaded
from a file is never numbered**. `samples/` carries a genuine homograph that
therefore has no number and never will. D35 A1 chose a stored number over a
derived one so that a number would survive; a number never assigned survives
nothing.

**One correction.** B-106 says the group view is "the one the search-by-lemma
request depends on". It is not: `_sbRunLemma` matches `word.lemma_id` directly
and lemma search already works.

---

## 5 · B-053, at real size and at synthetic size

Exact port of `tagUsage` (`LingCoT.html:4218-4235`), `process.hrtime.bigint()`,
two warm-ups, mean of 3,000–5,000 iterations.

| | live | samples |
|---|---|---|
| `tagUsage()` full rebuild | **0.034 ms** | 0.014 ms |
| `AC_POOLS.pos` per keystroke | **0.027 ms** | 0.009 ms |
| `AC_POOLS.domain` (uncached) | 0.0016 ms | 0.0011 ms |

**1/1500th of a human inter-keystroke gap.** The entry's own S3 filing is better
supported by this than by its text.

Synthetic: 50,000 words → `tagUsage` **16.2 ms** (entry says 22); 300,000 →
**69.9 ms** (entry says 131, ~1.9× high); `AC_POOLS.domain` at 50,000 entries →
**4.9 ms** (entry says 2.5, ~2× low). **The ranking the entry asserts holds;
none of its absolute numbers reproduce.**

Also: D33's remainder named "the browser's cost of materialising very large
datalists" as an open measurement. **There are no `<datalist>` elements left** —
D42 deleted all five at v3.14.171. Retired.

---

## 6 · D34, since it will be asked next

Under `annotationKeys(level)` and the app's own `isEmptyValue`:

| level | n | ≥1 annotation key empty | ≥1 **core** field empty |
|---|---|---|---|
| sentence | 12 | **12** | 2 |
| word | 162 | **162** | **128** |
| morpheme | 77 | **77** | 6 |

**A naive counter reads 100% and is useless**, because `comments` is an
annotation key and nothing carries comments (162 of 162 empty), and `head` /
`dep_rel` are empty on every live word. The counter that means something reads
the `core` tier — 128 of 162 words — which is what `field_spec.js`'s own comment
already says D34's counter should do. D34's second design question, "is missing
the same as empty", is answered empirically: no, and the gap between 162 and 128
is the nag it is worried about.

---

## 7 · What the six specs collapse into

| container | holds | why |
|---|---|---|
| **D32** | B-045, B-093, B-141, B-142, B-145, D48's open tier | all block on "authored or derived", and none can be built first without being built twice |
| **D35 stage B5** | B-106, B-114, B-143, D37, D49, D28 | the addressable unit of the lexicon; B5 is where a lemma stops being an id and becomes a thing on screen |
| **I2's `rowEditor`** | D31's ▲▼, I5, I12, I13, B-115, D39's row half | six items, all in code that is already duplicated rather than code that would be new |

**D40 stands alone**, re-scoped to word level and still gated on D35.
**B-123 expires** and should go before either container: it is safe only while no
dictionary form is ambiguous, and `samples/` already has one.
