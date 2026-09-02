# LEMMA LAYER AUDIT: the citation form is an entry, and it costs more than it earns
**Updated:** 2026-08-27 · **Version:** v3.14.139  

> **RETIRED at v3.14.230 — answered.** D35 A2 (v3.14.184) implemented the third
> option this audit floated in passing and called *"probably the honest one"*,
> so its §5 framing of A and B as "the two options" no longer describes the
> decision that was taken. Its headline count is false (29 lemma records live, 0
> duplicated entry forms, not "4 of 22"), `_resolveOrCreateLemma` no longer
> creates the shell it describes, and all five `type !== 'lemma'` filters in §3
> are gone — every cited line now holds unrelated code.
>
> **Still worth reading:** §4.1, the argument for a stable `lemma_id`, which is
> why the lemma layer survived at all. The decision itself is recorded better in
> the code, at `source/LingCoT.html:1110-1119`.
>
> Current status: `dev/audits/AUDIT_INDEX.md`. The live lemma work is B-106,
> B-114 and D35 stage B.
*Frozen. The version is the build this was written against, not the current one.*

**Status:** findings only, nothing changed. Opened because B-044 raised the
question "should we add a citation form?" and the answer turned out to be that
one already exists, badly.

**Examined:** the lemma paths in `source/LingCoT.html`, every entry in
`samples/turkish-test`, and `LINKING_AUDIT.md` §6.

---

## 0. The finding, in one line

**All 8 lemma entries in the shipped fixture carry no content beyond `form` and
`type`, and 4 of 22 distinct forms in the dictionary are duplicated because of
them.** Every one of those duplicates is a homograph in `dictByForm` that the
annotator did not create and cannot see.

---

## 1. What was measured

```
dictionary entries          27   (9 word · 10 bound.morpheme · 8 lemma)
distinct forms              22
forms carried by >1 entry    4   — and every one is lemma-versus-something
lemma entries with any content beyond form+type   0 of 8   (0%)
```

The duplicated forms:

| form | entries sharing it |
|---|---|
| `metin` | lemma · bound.morpheme · word |
| `Drama` | lemma · word |
| `köprü` | lemma · bound.morpheme |
| `dA` | lemma · bound.morpheme |

`Drama` is the clearest case, because the two records differ only in `type`:

```json
{"form": "Drama", "type": "lemma"}
{"form": "Drama", "type": "word", "part_of_speech": "PROPN", "gloss": "Drama",
 "lemma_id": "dict_1787705649168_e9ogh",
 "meaning": "Name of a town in Northern Macedonia."}
```

The lemma record holds nothing. The word record holds everything, and points at
the empty one. Same form, same case, same corpus.

---

## 2. Why this is not a data-entry problem

`_resolveOrCreateLemma()` creates the shell:

```js
const lemma = {
  id: `dict_…`, form: c, type: 'lemma', part_of_speech: null, gloss: null,
  variants: [], comments: [], transliterations: [], ...initProv()
};
```

Every field is empty by construction, and the annotator is never asked to fill
one. So a lemma entry is not an entry that happens to be sparse; it is a
**citation form wearing the shape of an entry**. The 0% is the design, not
neglect.

---

## 3. What it costs, counted

**Five lemma-exclusion filters.** Because lemma shells sit in `dictByForm`
alongside real entries, ordinary lookups have to exclude them by type:

| site | code |
|---|---|
| `_pushTokenToDict` candidates (`:1029`) | `lookupDict(form).filter(e => e.type !== 'lemma')` |
| the near-match strip (`:1545`) | `if (e.type !== 'lemma') continue;` |
| `resolveDictEntry` (`:1622`) | `lookupDict(obj.form).find(e => e.type !== 'lemma')` |
| morpheme backfill (`:1732`) | `lookupDict(m.form).find(e => e.type !== 'lemma')` |
| the entry form (`:5655`) | a lemma entry must not show a Lemma field |

Each is correct. Together they are the tax: **every lookup has to know that one
of the things it might find is not a real answer.** A filter that is forgotten
is a bug, and the shape of that bug (silently taking the wrong entry) is
precisely **D35**.

**A manufactured homograph class.** D35 is filed for distinct objects that share
a form, and is marked urgent. 4 of the 22 forms here are homographs *created by
the lemma machinery itself*. D35 is therefore partly self-inflicted, and any fix
it proposes must handle a case that need not exist.

---

## 4. What it earns

This is not a one-sided finding. Lemma-as-entry buys three things:

1. **A stable id.** `lemma_id` survives a form edit; a citation *string* would
   not. That is the whole argument of B-043 and it is not a small argument.
2. **Search by citation form.** `search_b.js:537` selects lemma entries by form
   and expands to their members through `dictByLemmaId`. This works, and it is
   the only way to search "all forms of *gitmek*".
3. **A place to put content later.** A lemma could carry a POS, a gloss, a
   paradigm (D37). Nothing does yet, but the slot exists.

Point 3 is the crux. If lemma entries are ever going to hold content, they are
entries and the duplication is a UI problem. If they are not, they are a field
and the duplication is a data-model problem.

---

## 5. The two options, with what each would cost

**A. Promote.** Keep lemma entries first-class; stop creating empty ones. The
lemma editor asks for at least a POS, and `_resolveOrCreateLemma` either fills
from the token or prompts. Duplication in `dictByForm` remains, so the five
filters remain and D35 still inherits the homograph class. Small change, keeps
every id, resolves nothing structurally.

**B. Demote.** `citation_form` becomes a string on the entry; grouping is by
that value, as FLEx does it. The homograph class disappears, the five filters
disappear, and the model matches the tool most fieldworkers already know. Costs:
a migration of every existing `lemma_id`; the loss of the stable id, which
B-043's whole argument says matters; and `dictByLemmaId`, `corpusLemmaRefs`,
`_resolveOrCreateLemma`, `_setWordLemma`, `_indexWordLemma`, `lookupLemma`, the
lemma strip in three editors, and the Search-B lemma field all have to be
rebuilt on a string key.

**B is not obviously right.** Grouping by a normalised string reintroduces
exactly what B-043 fixed for `dictByForm`: two spellings of a citation form
become two groups. A hybrid, keep the id, drop the *entry* (an id that names a
group rather than a record) is a third option and is probably the honest one,
but it needs its own design pass.

---

## 6. What this audit does NOT claim

- **One corpus.** 27 entries in one language. The duplication rate (4 of 22)
  should be re-measured on the second fixture before it is treated as typical.
- **No user harm observed.** Nothing has gone wrong because of this yet; the
  filters all work. This is a cost that has been paid quietly, not a defect
  report.
- **Not a blocker.** Nothing here blocks the corpora, `git init`, or D35 itself.

---

## 7. Recommendation

**Take this to D35 as an input, not as a separate work item.** D35 must decide
how an ambiguous form resolves; it should decide with the knowledge that a fifth
of the ambiguity in the fixture is generated by the lemma layer and could be
removed rather than resolved.

Before then, one cheap thing is worth doing on its own: **stop creating a lemma
entry whose form already has a word entry with the same normalised key.** In the
fixture that is `Drama`, where the word entry could carry the citation role
itself. That removes the self-referential case without deciding anything.
