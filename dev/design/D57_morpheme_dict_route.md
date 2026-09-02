# D57: the morpheme route into the dictionary
**Updated:** 2026-08-31 · **Version:** v3.14.324
*Design record, written before the work and closed after it. **Built v3.14.331,
all three stages.** Read it before touching `addDictForMorpheme`,
`candidateRows`'s merge, or `openAddDictModal`'s bail-out.*

**Re-specced 2026-08-31**, from the report *"`+dict` did not do anything"* and
the instruction that followed it: **`+ dict` on a morpheme should open an
editable view, not a blind write of data the user cannot see or fix.**

D51 (v3.14.263–271) built that editable view and routed `+ dict` through it. This
spec exists because one of the three routes into it does not arrive, and because
the instruction asks a second question D51 left open.

---

## 0 · What was actually wrong, and the correction to the first diagnosis

**The first diagnosis (B-163 as filed at v3.14.322) was wrong.** It read the log
line `token pushed to dictionary (0 new entries)` and concluded the push was a
silent fill-only upsert. That line comes from `_finishSave` — the **word-save
checkbox** path — which opens the D51 panel, shows what it will fill, and works
as designed. It is not the control the report names. `+ dict` is the literal
label of `btn.editor.morph_add_dict`, the link under a morpheme column, and that
is a different route with a different defect.

The lesson is the one PRACTICES §6 already states and this session did not
follow: **the log said which function ran, and I matched it to the report by
plausibility instead of by name.** Two controls both "add to the dictionary"; the
log distinguishes them and the diagnosis did not.

**The real defect.** `+ dict` on the only morpheme of a monomorphemic word does
nothing at all — no panel, no write, no log line.

```
addDictForMorpheme(:10353)   rows = candidateRows({word}).filter(r => r.link === m)
candidateRows(:4458)         rows[merged].mergedInto = 0        ← B-111, when the word
                                                                  has ONE morpheme whose
                                                                  form folds to its own
openAddDictModal(:10201)     _pkDraw = visibleRows(_pkRows)     ← drops it
openAddDictModal(:10205)     if (!_pkDraw.length) { onDone(null); return; }
openAddDict(:10327)          if (!picked) { opts.onSkip?.(); return; }   ← undefined
```

Five correct lines composing into a no-op. **Measured** against `turkish-test`
with an empty dictionary — the state a first session is in, and when `+ dict` is
used most — **3 of 19 morphemes are silent no-ops**: `Güneş`/`güneş`, `daha`,
`ileri`. Every one of them is a monomorphemic word, which is to say the simplest
word in the corpus and the one an annotator is likeliest to add by hand.

The render gate hides the rest of the failure and is why this survived: the
column offers `+ dict` only when `lookupDict(m.form)` is empty (`:8172`), so the
same click on a form already in the dictionary shows `dict →` and works. The
broken case is invisible the moment the corpus has been annotated once.

## 1 · Why the merge belongs to the push and not to the model

B-111 is right about what it fixed: on the word-save push, a monomorphemic word
offers the word form and its identical morpheme as two ticked rows, and asking
the annotator to choose between duplicates is the defect. `mergedInto` marks the
second, `visibleRows` hides it, and `:10265` gives it the answer the surviving
row got. All correct **for a surface that offers several forms at once**.

`+ dict` is not that surface. It names one morpheme, by index, on purpose. There
is nothing to deduplicate, and hiding the only row asked for leaves the panel
with nothing to draw.

**Decision: a merged row hands off to the row it was merged into.** The merge's
own claim is that the two rows are *one lexeme*; taking it at its word makes
`+ dict` on the hidden row mean `+ dict` on the surviving one.

```js
let row = candidateRows({ word: r.word }).find(x => x.link === m);
if (row && row.mergedInto !== undefined) row = all[row.mergedInto];
```

**Not a second seed path.** The obvious alternative — build the row from
`{ seeds: [...] }` in `addDictForMorpheme` — would restate B-069's type rules and
B-068's defaults in a second place, which is PRACTICES §4 and the exact shape
D51 §5 was written to prevent. B-148's carry already moves the morpheme's own
`type`, `gloss` and `part_of_speech` onto the surviving seed, so the handoff
loses nothing: verified against all three cases, which arrive carrying
`NOUN/sun`, `PART/more`, `PART/forwards` from the morphemes they came from.

**Verified**: with the handoff, 0 of 19 morphemes fail; without it, 3.

## 2 · The bail-out that turned a defect into a silence

`openAddDictModal`'s early return exists for a real reason — no overlay element
means a headless or half-built DOM, and losing the annotator's work to a missing
`<div>` would be worse than proceeding on the defaults. It then reuses that path
for `!_pkDraw.length`, where "the defaults" are *nothing*, and calls `onDone(null)`
— which every caller reads as "the annotator skipped".

**Decision: separate the two.** No overlay stays as it is. **No drawable row is a
defect and says so** — one `logEvent('warn', …)` naming the form and the caller.
A surface asked to draw nothing has been handed a bad question, and after §1 it
cannot happen; the log line is what makes it not happen *silently* if it ever
does again.

This is the same rule `_fillMorphRows` already follows at `:3855` — *"B-082 was
reported from annotation and could not be reproduced by reading"* — and for the
same reason.

## 3 · See, and fix: what the instruction asks beyond the bug

The panel is already honest about the fill-only rule, and more honest than the
report assumed: a stored field renders `readonly` (`ro()` at `:10103`), and
`pkFillsHtml` says either which fields the push will fill or **"will fill:
none"**. So the annotator can see exactly what is about to happen.

What they cannot do from there is **fix** it. Stored values are readonly because
`createEntries` is fill-only (`:4315`, `if (!existing[f] && c[f])`), so a typed
correction would be silently dropped — the panel refuses the edit rather than
accepting it and discarding it, which is the right of the two wrongs.

**The fill-only rule stays.** An entry is shared; a push that overwrote what
somebody curated is the defect S3/LINKING_AUDIT §8 named, and making this panel
able to overwrite would make it a second entry editor, which is B-058's shape.

**Decision: give the row a door instead.** A row whose `existing` is set gets an
explicit **"Edit entry →"** control that leaves the panel and opens
`renderDictEdit` for that entry. Three reasons it belongs on the row and not in
the footer: it is a property of *that* form, the panel can hold several rows with
different answers, and D51's "create here, refine there" already ends this way —
`openAddDict` navigates to the entry after Add (`:10344`), but only after the
annotator has committed to a write they may not want. The door makes the exit
reachable *before* the write, and reachable at all, which today it is not.

**Open, not decided here:** whether leaving by that door should offer to carry
the panel's typed values into the editor. It is D51 §7's B-112 extension in a new
place, and it is a question about two surfaces sharing a draft — worth recording,
not worth blocking this on.

## 4 · The homograph door, deliberately out of scope

`+ dict` renders only when the form is absent from the dictionary, so there is no
route from a morpheme column to *a second entry for a form that already has one*.
That is the same shape as **B-161** at the lemma level, and the same answer will
want to serve both — `new_anyway` already exists on the candidate (`:4299`) and
`pkStateHtml` already draws the sibling state. **Left to B-161's fix**, so that
one decision covers both surfaces rather than two half-answers landing apart.

## 5 · Order, and the guard

Data before pixels, as D51 §6 had it.

| | stage | why here |
|---|---|---|
| **1** | the guard | It fails today, by name, on three forms. Written first because §2 removes the silence that hid this, and a guard added after the fix would only ever have seen green |
| **2** | §1's handoff and §2's warning | The whole of the defect. Behavioural, no DOM |
| **3** | §3's "Edit entry →" | A row control and a `go('dict', …)`; nothing else moves |

**The guard is behavioural and general, not three named forms**: for every
morpheme of every word in a loaded corpus, `+ dict` yields at least one drawable
row. It is `candidateRows` + `visibleRows` + the link filter, run over the fixture
corpus, with **no dictionary loaded** — because the empty dictionary is the state
that makes the case reachable, and a guard run against an annotated corpus passes
while the bug is present. That last clause is the whole of why this survived
D51's six stages and their falsification runs.

**Mutation-tested** by restoring the `filter` without the handoff: the guard must
fail naming `güneş`, `daha`, `ileri`, not merely fail.

---

## 7 · Built, v3.14.331

All three stages, in the order §5 set. **B-163 closed.**

**§1's handoff** is one line in `addDictForMorpheme`, and B-148's carry made it
lossless as predicted — the surviving row arrives with the morpheme's own `type`,
`gloss` and `part_of_speech`. **§2's split** separates a missing element (survivable,
take the defaults) from a bad question (a warning, then null). **§3's door** sits
on the row's summary and is offered only where an entry exists.

**Measured after, against both live corpora with an empty dictionary** — the state
that makes the case reachable: **134 `+ dict` links offered in Turkish and 182 in
Mandarin, 0 dead clicks.** Before: 3 dead of 19 morphemes.

**What the guard cost, and it is the entry's lesson.** The first draft
reimplemented the selection inside the test and asserted against its own copy —
so replacing the handoff with `row = row` restored B-163 with every check green.
Caught by mutation, and the fix was to load `addDictForMorpheme` itself and stub
only its edges (the corpus lookup, the panel, the log), asserting what it hands
over. Five mutations now fail by name; two more assertions were rewritten because
they matched a string that survived elsewhere in the same function.
