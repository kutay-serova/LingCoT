# D62: List fields — per-element identity, and what a read-only list looks like
**Updated:** 2026-09-03 · **Version:** v3.14.408

*Written against v3.14.408. FROZEN: stamped with the version it was written
against, not bumped with the build. Follows L-043 to L-046 in `UNIFIED_AUDIT`
and takes the three decisions those findings left open.*

---

## 1 · Where this comes from

`UNIFIED_AUDIT` §2.7 inventoried every array-shaped field: **21 fields, six
declared controls, three fields with none**. Four findings came out of it.

| | finding | state |
|---|---|---|
| L-043 | the inventory itself | open, the frame for the rest |
| L-044 | `list` edits an array through one comma-separated text box | open |
| L-045 | five row collections, five CSS rules, two borrowed | closed v3.14.407 |
| L-046 | four read-only typographies for one data shape | half closed v3.14.407 |

L-045 is closed because it was a cleanup with one right answer. The three
decisions below are the rest, and none of them is a cleanup.

---

## 2 · Decision A — a list element records who added it and when

**The decision.** The five list fields whose elements are bare strings become
lists of objects, each element carrying its own annotator id and timestamp.

| field | level | measured, both shipped corpora |
|---|---|---|
| `source_ids` | document, section | 8 present, **2 non-empty** |
| `variants` | dict entry | 77 present, **0 non-empty** |
| `constituent_forms` | dict entry | 3 present, **0 non-empty** |
| `allomorphs` | dict entry | 0 non-empty |
| `pinned_examples` | dict entry | 0 non-empty |

Two non-empty instances in the whole shipped corpus set. A string-to-object
migration costs two rewrites today and costs a migration path the first time a
tester types a variant.

**Why the window matters more than the feature.** This is the same asymmetry
D58 §3 recorded about deleting the legacy readers: the version in which a format
change is free is identifiable, and it is always the one before the data exists.
Gate 2 puts the app in front of testers. Testers fill fields. The decision has
to be taken on this side of that.

**What it is worth.** A dialect variant is an observation, and an observation
without a source is not usable evidence. Two people annotate one dictionary over
two years; one adds `gündüz` as a variant and the other does not know whether it
came from a speaker, a grammar, or a guess. The corpus already answers that
question for every comment and every translation. It cannot answer it for a
variant, and there is no principled reason for the difference — only the order
the fields were written in.

**This reverses B-139, and the reason B-139 gave is still correct for its own
scope.** B-139 was decided at v3.14.372 as *not to build*: these lists are
written by whole-value controls (one CSV input, one picker), so every element is
one person's single act, and N identical stamps say less than one field stamp.
That argument is sound **given that control**. It is an argument about the
editor, presented as an argument about the data. Change the control to a row
editor — which L-044 says it should be anyway, because a value containing a
comma cannot currently be entered — and the premise is gone: two people can then
add rows years apart, which is exactly the condition B-138 stamps for.

So the two decisions are one decision, and the order is fixed:

1. `variants`, `constituent_forms` and `source_ids` move from the `list`
   control to a row editor (`ROW_EDITORS`, one more descriptor).
2. The element becomes `{ value, annotator_id, date }`.
3. `allomorphs` and `pinned_examples`, which L-043 lists as declaring no control
   at all, join the same descriptor rather than staying hand-drawn.

Step 1 alone fixes L-044's comma. Step 2 without step 1 would be the stamp
B-139 correctly refused.

**Cost.** One migration in `save_migration`, five field declarations, one
descriptor, one guard. Gate 3, and it should be the first item in gate 3 rather
than a later one, because everything after it in gate 3 is cheaper on the new
shape than on the old.

**Alternatives considered.**

- *Field-level stamp only, as B-139 decided.* Answers "somebody edited the
  variants list on this date". Does not answer "who added this variant", which
  is the question a second annotator asks. Correct while the control is a CSV
  box; wrong once it is not.
- *Defer until testers report wanting it.* The reporting would arrive after the
  data. Deferral converts a free change into a migration, and the whole content
  of this decision is that the two differ only in timing.
- *Object elements everywhere, including the row editors that already have
  `source_id` and `date`.* Comments and translations already carry attribution
  in their own keys; a second scheme beside the first is PRACTICES rule 4, two
  writers of one thing.

---

## 3 · Decision B — dispatch-on-shape waits for D28 or D37

**The decision.** Presentation stays a property of the render function until a
new list field is added. It becomes a declared property in `field_spec.js` at
that point, and not before.

**Why not now.** The value of a declaration is that the *next* field cannot
invent a sixth treatment. There is no next field queued. Building it now means
touching all 83 declarations across three to four versions to prevent a problem
nothing is currently causing, and the two versions that would pay for it —
**D28** and **D37** — are both unscheduled.

**Why it is not "never".** L-043 measured six controls for one shape and three
fields declaring none, which is what an undeclared property looks like after
three years. Deferring is a bet that the count stops growing; the trigger names
the moment the bet is settled.

**The trigger, precisely.** The first version that adds an array-shaped field to
`field_spec.js` declares its presentation, and converts the existing 21 in the
same version. Whoever writes that version should read §4 below first: the
vocabulary is already worked out.

---

## 4 · Decision C — what a read-only list should look like

L-046 is half closed. The containers are unified; the row typography is not, and
it is a design question rather than a cleanup, which is why it was left.

### 4.1 What is there now, re-measured v3.14.407

| row | row rule | secondary part |
|---|---|---|
| `.comment-view-row` | `padding: 6px 0`, 1px bottom rule, `0.88rem` | meta below, `0.77rem`, muted |
| `.translation-view-row` | `padding: 5px 0`, 1px bottom rule, `0.9rem`, italic | meta below, `0.76rem`, muted, upright |
| `.translit-view-row` | flex, `gap: 8px`, `0.87rem`, `padding: 3px 0` | label beside, `0.75rem`, weight 600, muted, bordered pill |
| `.allomorph-view-row` | flex, `gap: 8px`, baseline, `0.85rem` | env beside, muted `0.78rem`; form in `--mono` `0.83rem` |

Four sizes between 0.85 and 0.9 rem for the same data shape. Three separator
conventions. Two secondary placements. None of these differences was chosen
against the other three; each was chosen against nothing.

### 4.2 The proposal

Four properties, and every one of the four views falls out of them. The first is
already declared, on `ROW_EDITORS`, so the read-only side reuses the editor's
own answer rather than restating it.

| property | values | rule |
|---|---|---|
| `layout` | `inline` \| `stacked` | already declared. Inline separates rows with whitespace; stacked separates them with a 1px rule, `:last-child` dropping it |
| `primary` | `prose` \| `segment` | prose takes the body face; segment takes `--mono`, because a segment string is read character by character and a length mark or a schwa has to survive the font |
| `secondary` | `attribution` \| `qualifier` \| `scheme` | attribution renders below the primary, muted, `source · date`; qualifier renders beside it, muted, plain; scheme renders beside it as a bordered pill, because a scheme name is drawn from a closed set and repeats down the column |
| `emphasis` | `none` \| `meta-language` | `meta-language` is italic. It is a linguistic convention, not decoration: it marks the text as not being in the object language |

Applied:

| view | layout | primary | secondary | emphasis |
|---|---|---|---|---|
| comments | stacked | prose | attribution | none |
| translations | stacked | prose | attribution | meta-language |
| transliterations | inline | **segment** | scheme | none |
| allomorphs | inline | segment | qualifier | none |

One size for the primary, one for the secondary. `0.88rem` and `0.77rem`, which
are the comment view's, because that view has the most text in it and is the one
whose sizes were set against reading rather than against fitting.

### 4.3 The one substantive change

**Transliteration text becomes monospace.** It is the only row in the table that
changes appearance beyond a rounding of sizes.

The allomorph form is already mono, and the argument for it applies unchanged to
a transliteration: both are strings where the identity of each character is the
information. `ɨ` against `i`, `aː` against `a`, a combining diacritic against a
precomposed one — a proportional face is free to make those pairs look alike,
and in a romanization column the reader is comparing exactly those pairs. That
the two fields differ today is an artefact of `renderAllomorphsView` having been
written after `renderTransliterationsView`.

The counter-argument, recorded because it is not weak: a transliteration of a
whole word is longer than an allomorph and mono is wider, so a long romanization
in a narrow column wraps sooner. Answer: it wraps, and the row is `flex` with
the pill on its own line already. Legibility of the character wins over the
line count, which is the same call B-073 took for the gloss hyphen: the app does not edit the annotator's text to protect a line count.

### 4.4 What stays outside the family

`renderSelectionView` emits a `<table>`, not rows. Its data is nested — frames,
each with selects, plus an optional note that spans them — and the nesting is
load-bearing (D27: `give` is one frame with three selects, `eat` is two frames).
A flat row list cannot express it. It is not a fifth variation of one thing; it
is a different thing, and the declaration should not pretend otherwise.

### 4.5 The guard

`row_editor_test` already asserts every `.row-ed*`, `.row-x`, `.row-add` and
`*-view` selector is declared **exactly once** — a count, not a presence check,
added at v3.14.407 after `.allomorphs-view` turned out to be declared twice 1000
lines apart with the later one silently winning. The same check extends to the
view properties: every view declares all four, every declared value has a rule,
and no `*-view-row` rule sets a font size of its own.

**Sizes are the thing to guard, not the look.** The finding was four sizes for
one shape. A guard that asserts the four rows share one size cannot pass while
that recurs, and cannot fail for a reason nobody cares about.

---

## 5 · What this binds

- **Gate 3 opens with Decision A**, before anything else in gate 3.
- **L-044 is absorbed into Decision A** and stops being a separate task: the
  comma is fixed by the control change that Decision A requires anyway.
- **B-139 is superseded**, not wrong. Its reasoning holds for the control it was
  decided against and is recorded here for the version that changes it.
- **Decision B's trigger is D28 or D37**, whichever is scheduled first.
- **Decision C is unblocked** and can be built at any time; it is CSS and four
  render functions, no format change, no migration.
