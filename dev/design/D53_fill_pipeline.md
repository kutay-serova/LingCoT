# D53 — The fill pipeline
**Updated:** 2026-08-31 · **Version:** v3.14.297

Status: **complete — all six stages closed, v3.14.298–302.** B-033 with it. What remains of **B-033**;
the linking half finished at v3.14.108/138, this is the filling half from
`dev/audits/ANNOTATION_FILL_AUDIT.md` §7.

| Stage | What | Bug | State |
|---|---|---|---|
| A | one identity rule for the form index | **B-144** | ✅ v3.14.298 |
| C | show the derived value before it is written (F3) | — | ✅ v3.14.298 |
| B | gloss autocomplete from the lexicon (F2) | — | ✅ v3.14.299 |
| D | offer the lexicon's POS downward (F4) | — | ✅ v3.14.302 (offer: v3.14.266 + B-082) |
| E | the parse field as the primary surface (F5) | — | ✅ v3.14.300 |
| F | fill the gaps at export, not in the data (F6) | — | ✅ v3.14.301 (core: B-059, v3.14.132) |

**A and C shipped together** because they touch the same machinery and C waits on
nothing: it was the stage silently rewriting data on every save, so it went with
the first pass rather than fourth.

**A is a precondition, not a preference.** F1 states it: every stage below makes
the app write more automatically, and doing that on inconsistent matching spreads
the damage rather than causing it. B-057 ✅ v3.14.112 was the other half of F1;
B-144 is what is left of it.

## Measured, on the corpora being annotated now

Not the audit's figures — those describe corpora that have been replaced.

| | turkish-test | chinese-test |
|---|---|---|
| words / morphemes | 153 / 130 | 212 / 182 |
| morpheme glosses | 130/130 | 182/182 |
| word `dict_id` | 0 | 9 |
| morpheme `dict_id` | 0 | 19 |
| POS | 0 | 9 |
| **raw form keys vs folded** | **90 vs 85** | 94 vs 94 |

**The last row is stage A.** Five word forms and five morpheme forms in the
Turkish corpus are split across two index keys by sentence-initial capitalisation
alone — `Tilki`/`tilki`, `Tavşan`/`tavşan`, `Kaplumbağa`/`kaplumbağa`,
`Bir`/`bir`, `Tekrar`/`tekrar`. Those are the fable's content words: exactly the
forms an annotator asks "where else does this occur?" about.

Chinese loses nothing, because Chinese has no case. **A defect invisible in one
of the two corpora is the argument for fixing it before the fill stages read the
index**, not after.

## Stage A · one identity rule for the form index — built

`S.wordFormRefs` and `S.morphFormRefs` are keyed on `word.form` / `m.form`
verbatim (`:1419`, `:1422`), while every dictionary lookup keys on `normForm`
(B-043) and D40 settles identity there too. Two rules for one question.

**Built as three accessors, not five `normForm` calls.** `addFormRef`,
`removeFormRef` and `formRefs` (plus `formRefMap`/`clearFormRefs`) own both maps;
nothing else reaches them, and `form_index_test.js` holds that. Folding at five
sites would have left a sixth free to forget.

**Both halves fold.** `findExamplesOnDemand` is handed a dictionary entry's
STORED form, so folding the writer alone would have moved the miss to the reader
and made it total rather than five-in-ninety. Keys are internal and nothing is
stored, so there was no migration.

**Why it is S3 and still first.** The only consumer today displays rather than
asserts, so a miss reads as "no other occurrence" and nothing breaks loudly. It
stops being latent the moment D40's provider reads it — and stages B, D and E all
want the same "every occurrence of this form" question answered correctly.

## Stage B · gloss autocomplete from the lexicon (F2) — built

`AC_POOLS.gloss` offers what this project has already used, most-used first, then
the Leipzig abbreviations it does not already carry. Measured on `turkish-test`:
**72 rows from the corpus and 110 from Leipzig**, led by `fox` at 30×.

**Harvested by `tagUsage`, not by a walk of its own** — `gloss` joined the pass
that already counts POS and type, so it is one memo on `_dataGen` and the count
comes free. The count is the hint, which is what distinguishes a gloss in use
from one Leipzig proposes; the two never have to be told apart from memory.

**Deduped with `normMeta`.** A gloss is metalanguage: `PST` and `pst` are one
gloss with two spellings, and offering both is the disagreement the pool exists
to end. The uses are summed and the most-used spelling is the row shown — a fold
that hid one spelling and lost its uses would teach the wrong habit.

**Own first, Leipzig after.** F2 is "not *just* from Leipzig", not "instead of":
a list led by sixty standard abbreviations buries the consistency the stage is
for.

Wired on all four gloss controls — the word field, the morpheme rows, D51's push
panel, and the generated `dict_entry` field, which declares `pool: 'gloss'` in
`field_spec.js` rather than in a renderer (D48).

## Stage C · show the derived value before it is written (F3) — built

`_deriveWordFields` replaces an empty word field on every save and the annotator
saw the result only afterwards. A strip under each of the three fields says
*will derive from the morphemes: house-LOC*, which also makes IGT misalignment
visible when it is created rather than at export.

**The three join rules are named once** — `joinParse`, `joinGloss`,
`joinTranslit` — and the deriver and the preview both call them. Two copies of a
join fail quietly: the strip promises one string and the save writes another,
which is worse than no strip.

**It reports; it does not control.** Refusing a derivation would need somewhere
to record the refusal, and an empty field has to keep meaning "not filled in"
because D34 counts it.

**It reads the rows as typed**, not the stored word, because the rows are what
the save reads. Transliteration is the exception and reads the stored morphemes:
there is no morpheme transliteration editor to type into (B-093).

## Stage D · offer the lexicon's POS downward (F4) — closed

**Both halves of F4's proposal were already built**, in pieces and under other
numbers: `_dictFillForForm` returns `part_of_speech` since v3.14.266 (F4's
"only `part_of_speech` was left out" is no longer true), the chip shows it and
delivers it since B-082, and stage E's bulk fill carries it. Offered, never
inherited — `ensureMorphemesFromParse` and `inheritMorphemeTypes` read every
other key and never this one, which the guard now asserts rather than the
comment.

**What was left was the half F4 ruled AGAINST.** `inferPos(gloss)` sat uncalled
in `renderWordView` from before v3.14.21 until v3.14.302 — the losing side of a
decision already taken, left where the next reader would find it and wire it.

It also asserted what it was not entitled to: its list ran `ATTR.PRES`,
`DECL.POL2`, `PST.DECL` — one language's gloss inventory — and returned `N` for
everything it did not recognise. That is the claim `tag_control_test.js` exists
to keep out. Deleted, and the guard refuses its return **by shape rather than by
name**, since renaming it would defeat a name check.

**Out of scope, deliberately:** offering the lexicon's POS for the WORD as well
as its morphemes. F4 says "for a matched morpheme", and a word's part of speech
is a claim about the token in its sentence rather than about a form in a
lexicon — the same reason B-069 refuses to mint a type from position.

## Stage E · the parse field as the primary surface (F5) — built

**`parseSegmentState(parse)`** reads the parse position by position and gives
each segment one of `linkTo`'s three states — `unique`, `ambiguous`, `none`.
`suggestParseEntries` could not do this: it dedupes and drops the misses, which
is right for a chip strip and useless for "which position is the gap".

**`parseGuideHtml`** draws the parse under the field, one cell per segment, with
the lexicon's gloss beneath each — blue where there is one entry, red where there
are several, grey italic where there is none.

**`fillParseFromLexicon`** takes every unambiguous segment at once, with the
gloss, part of speech, type and entry id, and **skips the ambiguous ones**. Their
chips remain. That is `linkTo`'s rule and B-122's lesson: the silent writer took
`cands[0]` and put 76 of 77 morpheme links there without asking, and a bulk fill
is where that costs most.

**Why not literal ghost text.** F5 says "shows its gloss inline as ghost text".
Real ghost text inside an `<input>` needs an overlay tracking the caret through a
proportional font in any script the corpus uses — a rendering project. The strip
is the established idiom, and it says the thing an overlay could not: **which
segments the lexicon has nothing for.** Those are the gaps, and the gaps are the
work.

**The one key is D39's.** The action exists and has a button; binding it to a
keystroke belongs with the shortcut scheme rather than ahead of it, or E invents
a convention D39 then has to honour or break.

## Stage F · fill the gaps at export, not in the data (F6) — closed

**The headline shipped as B-059 at v3.14.132**, 168 versions before this document
named it: `GLOSS_GAP` renders an un-glossed position, the data stays empty, and
`igt_align_test.js` states the rule — *rendered, never stored*. Stored emptiness
is what D34's panel counts.

Closing F at v3.14.301 took three answers rather than code.

**The gap → D54.** `dict_export.py` renders a corpus-pinned example as sentence
text plus a translation and **no gloss line at all**, while `buildLatexLinguex`
has produced correct four-line IGT since v3.14.132 — so the one artifact a
project hands outside itself is the one whose examples are not interlinear. Split
out because the work is column alignment in `fpdf`, which lays out text and not
columns. `dev/design/D54_igt_pinned_examples.md`.

**`-` inside a gloss → decided: warn, never rewrite.** The audit paired this with
the placeholder as the other half of one format question. Escaping or refusing
the hyphen would be the app deciding that a gloss may not contain a character
Leipzig uses inside one — `a lot-ACC` is a real gloss, and
`formatGlossForLatex` already handles it at the subpart level. The misreading is
real and worth saying; editing the annotator's text to protect a line count is
not the app's call. **The eventual control belongs to the annotator**, per
project or per gloss, not as an app-wide rule. Measured at v3.14.301: **0
glosses contain a hyphen** in either corpus, so the decision cost nothing today
and would have been a migration later.

**Search matches the compact gloss, not the gapped one → documented and
guarded.** `???` is a rendering, and a rendering must not be findable text:
searching the placeholder would return every partly-glossed word as though
somebody had annotated it. True by accident before — no caller said so — and
asserted now.

## Explicitly not proposed

Inferring glosses from morpheme forms · auto-applying lexicon POS without
confirmation · any bulk fill on load. All three write linguistic claims the
annotator did not make, into fields whose emptiness is the only record that the
work is unfinished.

**Note the asymmetry with B-123.** The backfill writes *links*, which are
statements about which entry a form matches and are stamped derived. These stages
would write *content* — a gloss, a part of speech. A wrong link is visible and
repairable; a wrong gloss becomes the record. That is why every stage here offers
and none applies.

## What this must not break

- **One identity rule.** After stage A, `normForm` is the only fold used to
  decide that two forms are the same. `normMeta`, `toUpperCase` and the collator
  keep their own jobs (`dev/audits/AUDIT_INDEX.md` §4 adjudicates the four).
- **Fill-only.** Nothing here overwrites a value the annotator typed.
- **Emptiness stays meaningful.** An unfilled field is the record that the work
  is unfinished, and D34 counts it.
