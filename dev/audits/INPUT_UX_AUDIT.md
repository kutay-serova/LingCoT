# INPUT UX AUDIT: what a person clicks and types into, and whether the app asks twice in two ways
**Updated:** 2026-08-28 · **Version:** v3.14.158 · §3.4 corrected at v3.14.160 · **part two added at v3.14.164**
*Frozen. The version is the build this was written against, not the current one.*

**Date:** 2026-08-28 · **Against:** v3.14.158 · **Status:** findings only, nothing changed.
This is **D38**. Bugs filed: none new; three findings are severe enough to file if
they are not scheduled.

**Method.** Pass 1 was **executed**, not read: `dev/tools/input_inventory.py`
walks `LingCoT.html` and `source/modules/*.js`, counts every input control and
attributes each to the function that emits it. Passes 2 and 3 are that inventory
collapsed and compared. Pass 4 is a **reading** of the first-run path, not a
session with the app; it is labelled as such throughout, because the difference
matters and the earlier audits kept it.

**Departure from the plan.** D38 said *do not start before B-033's consumers are
settled*, because F1–F6 will change what several fields do. It was started early
on the judgement that the audit changes what F2–F4 should be, which is the
opposite dependency. §6 is that argument. The risk the plan named is real: the
gloss field and the morpheme rows are the fields most likely to move, and the
inventory rows for them will need re-checking after any of F2, F3 or F5 ships.

---

## 1. Inventory (pass 1)

118 input controls, matching the rough count in the DEV_PLAN entry exactly.

| widget | count |
|---|---|
| `<input type="text">` | 67 |
| `<input type="checkbox">` | 7 |
| `<input>` other (search, radio, untyped) | 6 |
| `<textarea>` | 18 |
| `<select>` | 10 |
| `<datalist>` | 9 |
| `contenteditable` | 1 |

Distribution is not even, and the shape of the unevenness is the first finding.

| owner | controls |
|---|---|
| `renderDictAdd` | 15 |
| `renderDictEdit` | 14 |
| static page markup (header, modals, panels) | 20 |
| `renderWordEdit` | 8 |
| the five row builders in `participants.js` | 16 |
| the other 17 views | 3 or fewer each |

**Two views hold a quarter of the app's inputs.** `renderDictAdd` and
`renderDictEdit` are 29 controls between them; the sentence, paragraph, section
and document editors are 2 or 3 each. Dictionary entry is where a new annotator
meets the most fields at once, and it is also the surface with no progressive
disclosure of any kind.

Beyond the widgets, the surrounding vocabulary:

| mechanism | count |
|---|---|
| distinct `data-action` values | 78 |
| `click` listeners | 89 |
| `input` listeners | 15 |
| `keydown` listeners | 13 |
| `change` listeners | 5 |
| `chipRowHtml` call sites | 10 |
| `alert()` | 27, of which 9 are validation: 8 required fields and 1 precondition |
| `confirm()` | 7, plus 5 `confirmAnnotationLoss` |
| `prompt()` | 0 |

---

## 2. Taxonomy (pass 2)

The hypothesised six kinds survive contact with the inventory, with one addition.

| kind | instances | representative |
|---|---|---|
| free text | 41 | `#cn-title`, `.comment-text` |
| constrained text with suggestions | 14 | `#ew-gloss`, `.ac-input`, the 5 `list=` fields |
| single choice from a closed set | 10 `<select>` + 10 chip rows | dep relation, `.sel-status`, POS chips |
| repeated rows | 5 editors | comments, transliterations, allomorphs, selections, translations |
| direct manipulation | 3 | POS/type chips, the dependency arc editor, `+ dict` links |
| confirmation | 12 | `confirm()` ×7, `confirmAnnotationLoss` ×5 |
| **boolean read at save time** | **7** | `#ew-push-dict`, the per-morpheme boxes (v3.14.157) |

The seventh is not a variant of the others. A checkbox here is neither a field
nor a command: it is an instruction attached to a *later* Save, and nothing about
its presentation says so. That it needed its own row is a small finding in itself.

---

## 3. Heterogeneity (pass 3)

### 3.1 *Add another one of these*: five near-copies

The five repeated-row editors are the clearest duplication in the app. Each has
its own row builder, its own `render*Editor(containerId, list)`, its own
`read*Editor(containerId)`, its own add and remove `data-action`, and its own
handler in `events.js`. The handlers differ **only** in the row builder called,
the row class removed, and the child focused:

```js
rowsEl.insertAdjacentHTML('beforeend', _commentRowHtml(null));
rowsEl.lastElementChild?.querySelector('.comment-text')?.focus();
```

That block appears five times. The `read*` functions are the same shape five
times: query the rows, map each to an object, drop the ones whose key field is
empty. The copy-paste is visible in the markup as well: the allomorph and
selection remove buttons both carry `class="translit-remove"`.

**What it costs.** Not bytes. Every fix to row behaviour has five sites, and
nothing enforces that they stay aligned. Keyboard behaviour is the live example:
none of the five commits a row on Enter, none supports reordering, and adding
either would be five edits or a divergence.

**What should win.** One `rowEditor` descriptor per collection —
`{ rowClass, build, fields, keep }` — with one add handler, one remove handler
and one reader driven by it. **Consolidation.** No new concepts, five sites
deleted, and the D39 keyboard work then has one place to land.

### 3.2 *Choose one of these*: three mechanisms, and the reason is real

`<select>` ×10, chip rows ×10, free text with a suggestion list ×14. The split
is defensible and mostly principled, stated once in the source at
`SELECTION_STATUSES`: a genuine closed enum stays a `<select>`; anything a
linguist may need to extend is free text with suggestions.

Two leaks:

- `chipRowHtml` emits `data-pos-target` and `data-pos` for **every** chip family,
  including `type-select`. A type chip announces itself as a part of speech.
  Cosmetic, but it is the kind of naming that makes the next reader wrong.
- The dependency editor uses `<select>` for the head and free text with a
  `<datalist>` for the relation, in adjacent columns of one row. Both are
  extensible vocabularies; only one is treated as such.

### 3.3 What commits a value: better than expected

An explicit **Save** button in all 22 views, 13 distinct `save-*` actions
dispatched through one `switch` in `events.js`. Nothing commits on blur.
Enter commits in exactly three places: the two modals, and the Search B query
bar. Nowhere else does Enter do anything.

**This is the most consistent thing in the app, and the consistency is invisible.**
A person who learns that Save commits will be right every time, and there is
nothing anywhere that tells them, nor any indication that their typing has not
yet been kept. See §3.5.

### 3.4 What happens to a value the app will not accept

**Corrected at v3.14.160.** This section first said five required fields, from a
grep of `LingCoT.html` alone. There are **eight**, plus one precondition guard;
four of them live in `events.js` and `participants.js`. The corrected count makes
the finding worse, not better, so it is recorded rather than quietly amended.

Eight fields are required. All eight enforce it identically, at save time:

```js
if (!title) { alert(t('alert.validation.title_required')); return; }
```

| # | field | view / surface | save path | marked `*` |
|---|---|---|---|---|
| 1 | `#cn-title` | corpus-new | `saveNewCorpus` | yes, style A |
| 2 | `#de-title` | document-edit | `saveDocument` | yes, style A |
| 3 | `#pa-text` | paragraph-add | `saveParagraphAdd` | **no** |
| 4 | `#sa-text` | sentence-add | `saveSentenceAdd` | **no** |
| 5 | `#da-form` | dict-add | `saveNewDictEntry` | **no** |
| 6 | the quick-lemma form field | inline panel, word-edit | `ql-save` handler | **no** |
| 7 | `#am-name` | add-annotator modal | `saveAnnModal` | yes, style B |
| 8 | `#sm-name` | add-source modal | `saveSrcModal` | yes, style B |

**Half are marked, and the marker has two spellings**, neither of them a class:

```html
<span style="color:var(--accent);font-weight:700">*</span>   <!-- A: 1, 2 -->
<span style="color:var(--accent)">*</span>                   <!-- B: 7, 8 -->
```

All four marked labels put the word before the marker as a **hardcoded English
literal** — `Title`, `Name` — so the only labels that say a field is required
are also the only ones that cannot be translated. That is §4's i18n finding and
this one landing on the same four elements.

Checks 3 and 4 also report something other than the field: `no_text_lines` fires
when the paragraph text produces no sentences after splitting, which is not the
same claim as "this box is empty", and the alert does not distinguish them.

**Separately, one precondition guard.** `requireAnnotator()` is called from **12**
save paths and blocks before any field is read:

```js
function requireAnnotator() {
  readAnnotator();
  if (_activeAnnotatorId || _activeAnnotatorName) return true;
  alert(t('alert.validation.no_annotator'));
  return false;
}
```

This one is a different kind and I1 should treat it as such: there is no field to
put a notice under, and the right surface is the annotator bar it already reads.
Grouping it with the eight would produce a notice with nowhere to live.

The way a new annotator meets any of the nine is the same: fill a form, press
Save, and receive a modal dialog covering the field it is about.

Meanwhile the app already has **three** better ways to say something in place:
`linkNote` / `reportLinkNotes`, the lemma strip under `#ew-lemma`, and
`#save-status-flash`. Field validation uses none of them.

### 3.5 What does not exist at all

- **No undo.** One occurrence of the word in the entire source, in a comment.
- **No dirty state.** Nothing tracks whether an open editor has unsaved changes,
  so Cancel, the breadcrumb and every navigation link discard silently. There is
  no `beforeunload`. `confirmAnnotationLoss` protects against re-tokenization
  destroying annotation, which is a different and much narrower thing.
- **No optional/required distinction** beyond the two asterisks in §3.4.
- **No loading state** on any input surface.

The combination is worth stating plainly: an annotator can spend ten minutes in
`renderDictEdit`'s 14 fields, click the breadcrumb, and lose all of it without
being asked.

### 3.6 Suggestions: four mechanisms proposing a value

This is the finding that matters most for what is scheduled next.

| mechanism | where | shape |
|---|---|---|
| ~~`<datalist>`~~ | **0 — deleted v3.14.171** | native dropdown, no hints, WebKit ignores `label` |
| `#gloss-ac-drop` | `#ew-gloss`, `.morph-gloss-input`, `.ac-input` | custom dropdown, two modes (`leipzig`, `term`), keyboard-navigable, shows hints |
| chip rows | 10 sites | always-visible buttons, one click applies |
| the lemma strip | `#ew-lemma`, one site | a line under the field saying what will happen, with candidate chips |

**Two, since v3.14.172.** The dropdown and the strip; chip rows are a field's
closed vocabulary rather than a proposal. What follows is how it stood when the
audit was written, kept because the reasoning is what chose between them.

Four ways to propose a value, and the app already knows the native one is the
weakest: the custom dropdown exists **because** `<datalist>` would not open on an
empty field and WebKit ignores `<option label>`, which is also why the dependency
editor echoes relation names into a separate span. That migration was started and
not finished. Five fields are still on `<datalist>`.

The four are not interchangeable, and the difference is not cosmetic. A chip row
**applies**. A dropdown **completes**. The lemma strip **predicts**, and is the
only one of the four that says *what will happen if you do nothing*.

### 3.7 Keyboard

13 `keydown` listeners. D30's traversal is keyboard-driven and works. Inside the
editors: the autocomplete dropdown handles arrows, Enter and Tab; Escape closes
five panel types in a defined stacking order (C21); nothing else responds. No
editor has a keyboard path from one field to the next beyond native Tab order, no
row editor commits on Enter, no Save has a shortcut. D39 owns this and is
correctly scoped; the audit adds only that §3.1's five-way duplication is the
reason a row-level Enter has not been cheap to add.

---

## 4. The new-annotator walk (pass 4, read not run)

**First launch.** `renderEmpty` offers one primary button, *Open Corpus*.
Creating a corpus is possible but lives in the File menu; the empty state does
not mention it. A person with no `.jsonl` file has nothing to click.

Two strings on that screen are hardcoded English, not `t()` keys: `No Corpus
Loaded` and `Open a .jsonl or .json corpus file to get started.` The literal
`＋ Adding` in `renderSectionAdd` and the placeholder hint in
`morphEditRowsHtml` are the same. The very first screen a new user sees is
partly untranslatable, which is D24's problem arriving early.

**First document.** Corpus → section → paragraph → sentence is four separate
add-views. Paragraph-add takes raw text and splits it into sentences by line,
which is the right shape, and is explained only by a placeholder.

**First word.** Words appear from tokenization on sentence save, not by an add
action. Nothing on the sentence view says this, so "how do I add a word" has no
answer on screen; the answer is that you edit the sentence text.

**First dictionary entry.** 15 fields in `renderDictAdd`, one of them required,
no grouping into essential and optional, no progressive disclosure. This is the
densest screen in the app and one of the first a new annotator reaches, because
the `+ Lexicon` affordance is on the word view.

---

## 5. Findings, in implementation order

Each marked **[C]** consolidation, cheap, no new concepts, or **[N]** new
mechanism, needs its own decision.

| # | finding | kind | size |
|---|---|---|---|
| **I1** | **Label half done at v3.14.162.** Field validation reports through `alert()`. Route the **eight** required-field checks to an in-place notice under the field, reusing `linkNote` or the strip, and give `requireAnnotator()` its own notice on the annotator bar. Mark all eight in the label with one class, not the two inline styles, and key the four hardcoded label words | **[C]** | S–M |
| **I2** | Unify the five repeated-row editors behind one `rowEditor` descriptor. Prerequisite for any row keyboard work | **[C]** | S–M |
| ~~**I3**~~ | ✅ **Built v3.14.171–172** as part of D42. Filed as a separate item from I4; they were one job |  |  |
| ~~**I4**~~ | ✅ **Built v3.14.172** as D42, Option B: *if it responds to keystrokes it floats; if it describes the field's standing state it sits*. §3.6's four mechanisms become two. This section under-counted the precedent — `renderMorphSuggestPanel` is a second half-generalisation beside the lemma strip |  |  |
| **I5** | Dirty-state tracking, so Cancel and navigation can ask before discarding. Undo is a much larger promise and is **not** proposed here | **[N]** | M |
| **I6** | Split `renderDictAdd` into essential and optional groups. 15 fields on a first-run screen | **[C]** | S |
| ~~**I7**~~ | ✅ **v3.14.162.** Empty state offers *New Corpus*; six literals keyed, two more than §4 found | **[C]** | S |
| ~~**I8**~~ | ✅ **v3.14.173** with D44. `data-chip-target` / `data-chip`, and one refresh where there were two |  |  |

I1, I6 and I7 are the three that would be filed as bugs if they are not
scheduled: each is a defect a user meets, not a design preference.

---

## 6. What this changes about D35, D40 and F2–F4

The question the audit was brought forward to answer.

**It does not change D35.** Whether two tokens sharing a form are the same lexeme
is a data-model question, and nothing in the input vocabulary bears on it. D40's
gate on D35 stands, and so does D41's for the highlight rule.

**It changes what F2 and F4 are.** F2 proposed corpus glosses in the gloss
autocomplete; F4 proposed the lexicon's POS as a chip. Read against §3.6, these
are not two small features. They are **two more suggestions arriving through two
different mechanisms**, in an app that already has four and has an unfinished
migration between two of them. Building both would leave the gloss field
completing from one list, the POS field applying from a chip row, and the lemma
field predicting in a strip, with three different provenance stories. The audit's
answer is that **I3 comes first**, and F2 and F4 are then trivial: the same
mechanism pointed at two more pools.

**It promotes F3 and changes its shape.** F3 was going to hand-roll a second
strip under the gloss field, and was recommended as the cheap standalone win.
That was wrong in one respect: hand-rolling it produces a **second** one-off
predictor, exactly the pattern §3.6 complains about. F3 should instead be the
first consumer of **I4**, the generalised offer component. That makes F3 slightly
larger and much more valuable, because I4 is also what D40 needs and what F2 and
F4 should render into.

**It reorders the group.** Previously: F3 cheap and standalone, F2 medium, F4
gated behind D40, D40 gated behind D35. Now:

1. **I4** (generalise the strip into an offer component) — unblocks the rest
2. **F3** as its first consumer, and the one that needs no matching rule
3. **I3** (one suggestion mechanism) — after which F2 and F4 are small
4. **D40** still behind **D35**, but its *interface* half is I4, already built

> **Superseded 2026-08-28 by D42.** Steps 1 and 3 are one job, not two: this
> section reasoned about them separately and the specimens showed why that was
> wrong — completion and offering differ by *when*, not by *what*. The order is
> now D42, then F3, F2 and F4 as its consumers. See `DEV_PLAN.md` D42.

The net effect is that **the mechanism work is the shared prerequisite that was
being paid for three times**, and that D40 stops being a large item: with I4 in
place, what remains of D40 is a lookup that already exists and a matching
decision that D35 owns.

---

## 7. Checked and found correct

- One commit gesture, an explicit Save, in all 22 views, through one dispatch.
- The `<select>` vs free-text rule is principled and stated in the source.
- `chipRowHtml` is a real shared builder across 10 call sites, hint text and
  overflow handling included. It is the model the other mechanisms should follow.
- Escape's stacking order (C21) is defined, deliberate, and leaves edit views
  alone so a keypress cannot discard work.
- `confirmAnnotationLoss` fires on all four paths that can destroy annotation.
- The autocomplete dropdown is keyboard-navigable and announces itself with
  `role="listbox"` and an `aria-label`.

---

# PART TWO: the shape of the UI around the inputs

**Added 2026-08-28 at v3.14.164**, §15 at v3.14.166. Part one asked what a person types into. This
asks what surrounds it: the anatomy of a view, the surfaces that record who said
something, and the chip, which turned out to be eight things wearing one name.

**Method.** The view inventory is scripted (`dev/tools/input_inventory.py` gained
nothing; this pass used a one-off walk of `VIEW_RENDERERS`, reproduced in §9).
Every chip class in the markup was checked against `LingCoT.css` rather than
assumed. Nothing here is an impression: each count is a grep that can be re-run.

---

## 9. View anatomy

22 views. Five structural elements are available to them: `viewHeader()` for the
back/cancel row, a page title, a state badge, `edit-group` blocks, and an
`edit-actions` row with a Save.

### 9.1 The eleven edit views are already uniform

| view | header | title | badge | groups | actions | save |
|---|---|---|---|---|---|---|
| corpus-new · section-add · paragraph-add · sentence-add | y | y | y | 2–4 | y | y |
| document-edit · section-edit · paragraph-edit · sentence-edit | y | y | y | 4–6 | y | y |
| word-edit | y | y | y | 7 | y | y |
| dict-add | y | y | y | 11 | y | y |
| dict-edit | y | y | y | 14 | y | y |

**Eleven for eleven.** This is the most consistent region of the app and it
should be said plainly, because the rest of this section is about departures from
it. The only variable is group count, and that is the density finding (I6), not a
structural one.

### 9.2 The seven read views agree on less

| view | title row | edit button | prov footer | add row |
|---|---|---|---|---|
| document · section · paragraph | y | y | y | y |
| sentence | y | y | y | — |
| word | y | y | y | — |
| dict | **—** | y | **—** | — |
| dict-browse | **—** | **—** | **—** | — |

`renderDict` and `renderDictBrowse` are the two views with no title row, and the
two with no provenance footer. Every other read view tells you who last touched
the object; the dictionary, which is the shared artefact several annotators write
into, does not. **That is a finding, not a style difference** — it is the surface
where "who claimed this" matters most.

### 9.3 Three views are not built like views at all

`annotators`, `sources` and `search-b` live in modules, and none of them calls
`viewHeader()`. The count is exact: **19 calls in `LingCoT.html`, 0 in the
modules.** The identity views hand-roll the back row instead:

```js
<div class="back-btn" data-go="${backTarget}">${icon('arrow-left')} …</div>
```

`viewHeader()` was created by B3 S1 precisely to end this, and 18 sites were
converted. These two were missed because they are in another file. The output is
close but not identical, and nothing keeps it close.

---

## 10. The identity surfaces: annotators and sources

The user's own example, and the widest divergence in the app.

### 10.1 They are the only objects added through a modal

Every other object in the corpus is created through a **full-page add view**:
`corpus-new`, `section-add`, `paragraph-add`, `sentence-add`, `dict-add`.
Annotators and sources are created through a **floating modal**, opened from a
table view that already had the whole page available.

So the app has two answers to "how do I make a new one of these", and which one
you get depends on whether the thing is a linguistic object or a person. Nothing
in the interface explains that, and the two answers differ in every respect that
matters: a modal traps focus, closes on Escape and on a backdrop click, commits
on Enter, and has its own close button; an add view has a breadcrumb, a Cancel
that navigates, no Enter handling, and a Save in an `edit-actions` row.

**This is the sharpest structural inconsistency the audit found.** It is also the
one with a real argument on both sides: identity records are edited *while* you
are in the middle of something else, which is what modals are for. The finding is
not that the modal is wrong; it is that nobody wrote down which kind of object
gets which, so the next new record type has no rule to follow.

### 10.2 What the two identity views share, and where they drift

The two views are the same table with the same four-part shape. They diverge in
five places, and only the first is deliberate:

| | annotators | sources |
|---|---|---|
| column sorting | **yes** — `data-ann-sort`, `sorted-asc/desc` | **no** |
| topbar class | `.ann-view-topbar` | `.src-view-topbar` — a byte-identical duplicate |
| table class | `.ann-table` | `.ann-table` — borrowed |
| add-button icon | `user-plus` | `plus-circle` |
| row focus class | `.ann-row-focus` | `.src-row-focus` |

**And a live defect falls out of the borrow.** `.ann-table th:hover { color:
var(--accent) }` was written for sortable headers. The sources table reuses
`.ann-table`, so **its column headers highlight on hover and do nothing when
clicked.** An affordance that lies is worse than one that is missing.

The modals, by contrast, went the other way and are the better outcome: the
source modal uses the annotator modal's classes throughout (`ann-modal-header`,
`ann-modal-field`, `ann-modal-label`, `ann-modal-input`), so the two forms are
genuinely identical. Where sources borrowed, the app is consistent; where sources
got their own copy, it drifted. That is the whole lesson of §3.1 restated on
different code.

### 10.3 Source attribution is three different components

"Which source does this come from" is asked in three places and answered three
ways.

| where | component | shape | remove |
|---|---|---|---|
| corpus-new, document-edit, section-edit | `renderSourcePicker` → `.src-sel-chip` | filled accent chip, one per source, each with an `×` | per chip |
| comment rows, translation rows | `.trans-src-chip` | a **plain text span**, not a chip | via a `— no source —` option inside the panel |
| the picker panel itself | `.src-pick-chip` | full-width list row, `.spc-sel` when chosen | n/a |

The comment row's source element is called `trans-src-chip` — comments borrow the
*translation* row's class, the same copy-paste tell as the allomorph row's
`translit-remove` button in §3.1. So the answer to the user's question is yes:
comment sources and field sources are different components, and the comment one
is a borrowed copy of a third.

Two more details of that borrow:

- `.src-sel-chips`, the container holding the selected chips, **has no CSS rule
  at all.** It works by accident of its parent's flex layout.
- `— no source —` is a hardcoded English literal in three places, and it uses a
  spaced em-dash convention the docs abandoned at v3.14.115.

---

## 11. The chip is eight things

`chip` names one visual idea in the app and eight implementations of it. Checked
class by class against the stylesheet:

**Superseded v3.14.173 by D44:** two kinds, one radius, one chosen-state. The
table below is what was measured, and is why.

| class | radius | resting | means "chosen" by | click does |
|---|---|---|---|---|
| `.chip.chip-toggle` | 12px | border + `--surface-dim` | **filled `--accent`** | sets the field |
| `.morph-suggest-chips .chip` | 20px | `--surface` + `--dict-accent` | **opacity 0.55** (`.mc-used`) | fills matching rows |
| `.chip.mc-parse` | 20px | `--surface` + `--accent` | opacity 0.55 + `--accent-dim` | fills one row |
| `.src-sel-chip` | 12px | **always** `--accent-dim` filled | **its existence** | nothing; the `×` removes |
| `.src-pick-chip` | list row | plain | `--accent-dim` (`.spc-sel`) | toggles selection |
| `.trans-src-chip` | none | `--text-muted` text | **text turns `--text`** | nothing |
| `.ann-rollup-chip` | 10px | border + `--surface-dim` | — | opens a panel, sometimes |
| `.seg` | joined group | flat | filled `--accent` | switches a mode |

**Five radii** (none, 6px, 10px, 12px, 20px — this section first said four; `.src-pick-chip` and the `.seg` group are both 6px, corrected 2026-08-28). **Five ways of saying chosen**: a filled
accent, 55% opacity, an accent-dim fill, a text-colour change, and mere presence.
**Three accents** for the same gesture. And clickability is not predictable from
appearance: `.src-sel-chip` and `.trans-src-chip` look like the others and do
nothing.

Part one recorded two radii and three chosen-states. That was the suggestion
mechanisms alone; across the whole UI the numbers are four and five.

Dimming at 55% is the one to remove first. Every other convention in the app uses
reduced opacity for **disabled** — `.seg.chip-disabled` is 0.4 in the same
stylesheet — so `.mc-used` says "you cannot use this" when it means "you already
did".

---

## 12. Style decisions living in the markup

64 inline `style=` attributes: 56 in `LingCoT.html`, 8 in `participants.js`.
Most are one-off spacing, but one is a component defined by copy-paste.

The **state badge** (`.edit-badge`, 11 uses) has two variants and only one class.
The "editing" variant uses the class alone. The "adding/new" variant overrides it
with the same three declarations inline, **five times**:

```html
style="background:var(--accent-dim);color:var(--accent);border-color:var(--accent)"
```

Four are identical; the fifth swaps in `--dict-dim` / `--dict-accent` for the
dictionary. The `＋` prefix is on three of the five and not the other two. This is
the required-marker defect of §3.4 exactly, on a different component, and it was
still being written after that one was found.

---

## 13. Findings, in implementation order

Continuing part one's numbering. **[C]** consolidation, **[N]** new mechanism.

| # | finding | kind | size |
|---|---|---|---|
| ~~**I9**~~ | ✅ **v3.14.167.** Scoped to `[data-ann-sort]`. The `cursor: pointer` was on the same rule, so the Sources headers also showed a hand cursor — one more than this line recorded | **[C]** | XS |
| ~~**I10**~~ | ✅ **v3.14.173** with D44: two kinds, 12px, filled accent, opacity reserved for disabled. The count was corrected first — **five** radii, not four |  |  |
| ~~**I11**~~ | ✅ **v3.14.167.** Both classes defined, five inline copies deleted, `＋` moved to a `::before`. Inline `style=` in the html: 56 → 51 | **[C]** | XS |
| **I12** | One source-attribution component for all three sites, single and multi being a mode rather than two shapes. Folds `.trans-src-chip` and `.src-sel-chip` together, gives `.src-sel-chips` a rule, and keys `— no source —` | **[C]** | S–M |
| **I13** | `renderAnnotatorsView` and `renderSourcesView` call `viewHeader()`; `.src-view-topbar` deleted in favour of `.ann-view-topbar`, renamed to something neither owns | **[C]** | S |
| **I14** | `renderDict` gets a title row and a provenance footer, like every other read view. The shared artefact is the one that should say who wrote it | **[C]** | S |
| ~~**I15**~~ | ✅ **Decided v3.14.197**, §17. Modal for a short self-contained record; view when creation ingests bulk content, needs the corpus visible, or has enough fields to scroll. The rule ratifies every current assignment, so nothing moves | **[C]** | S |
| ~~**I16**~~ | ✅ **Decided v3.14.166, built v3.14.168**, §15. Provenance moves to hover: the 21 `fieldProvHint` lines and the `.igt-t-prov` tier are replaced by `provTipAttr`, which already exists and is used twice. `.derived` stays visible on the value. The IGT's `title=` attrs stay, because a scroll container clips a CSS tooltip | **[C]** | S |

I9 and I14 would be filed as bugs if they are not scheduled: an affordance that
does nothing, and a missing provenance footer on the one surface where
provenance is the point.

---

## 14. Checked and found correct, part two

- The two identity **modals** share one set of classes and are genuinely
  identical. Borrowing worked here; it is the un-borrowed copies that drifted.
- All eleven edit views have the same five-part anatomy.
- `.seg` is a properly built segmented control with a disabled state, a group
  wrapper, and no duplicate.
- The source picker's single mode can clear a selection, through the prepended
  `— no source —` option. It is easy to miss in the code and it is there.
- `data-action` dispatch is one delegated listener per family, not one per site.

---

## 15. Provenance is spending the best space in the app

**Decided 2026-08-28 at v3.14.166:** provenance moves to hover. Recorded here
because the counts changed what the change has to include.

### 15.1 There are four presentations, not one

| presentation | where | sites |
|---|---|---|
| `.field-prov-hint` — **a dedicated line under the field** | edit views | **21** |
| `[data-prov-tip]::after` — a CSS hover tooltip | `renderSentence`, `renderWord` | 2 |
| `title=` — the native tooltip | the IGT tiers | 3 |
| `.igt-t-prov` — **a whole dedicated tier** | the IGT, gated by `showProv` | 1 tier |

The mechanism being asked for **already exists and works**: `provTipAttr()` plus
`[data-prov-tip]` in `LingCoT.css`. It is used twice. The dedicated line is used
twenty-one times.

Where the 21 lines fall is the point:

| view | prov lines | groups |
|---|---|---|
| `renderDictEdit` | 10 | 14 |
| `renderWordEdit` | 5 | 7 |
| `morphEditRowsHtml` | 2 per morpheme row | — |
| `renderDocumentEdit` | 2 | 6 |
| `renderSentenceEdit` · `renderSectionEdit` | 1 each | 6 · 4 |

Ten of the fourteen groups on the densest screen in the app carry a permanent
line of 0.68rem monospace naming a person and a date. In a four-morpheme word,
`morphEditRowsHtml` adds eight more. This is the density finding I6 is about,
and provenance is its largest single contributor.

### 15.2 Why the IGT case is different, and stays different

`.igt-wrap` is `overflow-x: auto`, and a CSS absolutely-positioned tooltip is
clipped by a scroll container. That is why the IGT already uses `title=` rather
than `data-prov-tip`, and the reason is written in the source at line 4076. The
native tooltip is the correct exception, not an inconsistency to remove.

`.igt-t-prov`, the dedicated provenance **tier**, is a different matter. It is
one row of the interlinear block spent on annotator and date, gated on
`showProv`, in a view whose whole purpose is aligning linguistic tiers. It should
go: the per-tier `title=` attributes beside it already carry the same information
on hover.

### 15.3 What hover alone would lose, and the part of the line that stays

Provenance is this project's central claim, and one bit of it is not detail — it
changes how the value should be read. **Whether a value was derived or typed** is
the difference B-061 was about, and today it is visible at a glance because
`fieldProvHint` colours an automated annotator differently (`.fph-claude`).

The app already has the convention for keeping that visible without a line:
`.derived` — dimmed and italic — used on `.s-span`, on `.sent-card .trl`, and on
`.igt-t-translit`. It is a value-level marker, costs no vertical space, and is
already in the stylesheet.

**So the decision is two-part:** who and when move to hover; *derived rather than
typed* stays visible, as `.derived` on the value itself, extended from the three
places that have it to every field that can be derived.

A hover-only tooltip is invisible to the keyboard, which matters because
`[data-prov-tip]` is CSS-only and has no focus state. **D39 owns this** — the
fix is `[data-prov-tip]:focus-within::after` alongside the `:hover` rule and a
`tabindex` on the value, and it is one line of CSS if it is remembered. Noted
here so it is.

### 15.4 Three things building it found that this section had not

Recorded because each would have been a wrong assumption in the next audit.

**There were five presentations, not four.** §15.1 missed `.morph-col-prov`, a
third permanent line, in the expanded morpheme column of the word view. It was
found by grepping for the variable that fed the IGT tier, not by re-reading the
table. Retired with the other two at v3.14.168.

**The tooltip cannot sit on the value.** The bubble is a `::after`, and a
replaced element — a text control — has no pseudo-elements. §15 said "on the
value itself", which is unbuildable for every field in an edit view. The
attribute goes on the element that encloses the field instead, which also gives
a far larger hover target than the value would have. Only the `.derived` half
lands on the value, through a descendant selector.

**MT provenance has no `derived` flag.** `_derivedFieldProv()` sets
`derived: true`, but machine translation stamps only `annotator: 'auto-<method>'`.
A derived test reading the flag alone would have left every MT value looking
hand-written — the same class of error as B-061, arrived at from the other
direction. The shipped test matches either shape, and the guard asserts both.

---

## 16. What can be set at creation time

**Audited 2026-08-28 at v3.14.187**, prompted by a report that adding a section
offers no source. It does not, and it is not the only one. The question the
audit asks of every object the app can create: *of the fields this object may
carry, which can be filled at the moment it is created, and which require going
back and editing it afterwards?*

The distinction matters more here than in most applications. Annotation is done
in one pass through a text. A field that can only be set by re-opening the
object is a field that will mostly stay empty, because the annotator has moved
on and has no reason to come back. Provenance makes this concrete: a value
entered at creation is stamped once, by the person who was looking at the
source. A value added later is stamped later, by someone who may be
reconstructing.

### 16.1 The table

`+` settable at creation · `E` edit only · `—` nowhere in the app

| object | field | create | edit | note |
|---|---|---|---|---|
| **document** | title | + | + | |
| | language | + | + | |
| | source_ids | + | + | |
| | comments | + | + | |
| | authors, content_sources, content_date, publisher, notes | — | — | written by `corpus_ingest.py`, carried through, shown nowhere |
| **section** | title | + | + | |
| | **source_ids** | **—** | + | **the reported gap** |
| **paragraph** | (body text) | + | + | |
| | translations | partial | + | one plain box at creation; no source, no date |
| | transliterations | — | + | |
| | comments | — | + | |
| **sentence** | text | + | + | |
| | tokenization | + | + | |
| | translations | + | + | |
| | transliterations | + | + | |
| | comments | — | + | |
| **word** | every field | n/a | + | created by tokenization; there is no word-add form, and that is right |
| | head, dep_rel | n/a | E* | *a different view (the dependency editor), not word-edit |
| **morpheme** | gloss, part_of_speech | n/a | + | created from the parse string |
| | **type** | n/a | **—** | not in the morpheme row; only ever inherited from the dictionary (B-089) |
| | **transliterations** | n/a | **—** | preserved across a save, editable nowhere since v4.0.9 |
| **dict entry** | form, pos, type, translit, gloss, variants, semantic_domain, usage_notes, constituent_forms, meaning, lemma | + | + | |
| | allomorphs, selection, comments | — | + | |
| **lemma** | form | + | + | the quick-create panel |
| | (nothing else) | | | D35 A2 left the lemma with only an id and a citation form; the panel still collects a POS and a gloss that nothing reads |
| **annotator** | all seven fields | + | + | one modal serves both |
| **source** | all nine fields | + | + | one modal serves both |

### 16.2 What the shape of that table says

**The participants surfaces got it right and the corpus levels did not.**
`showAnnModal` and `showSrcModal` each take an optional id: absent means create,
present means edit, and the form is the same object either way. It is
impossible for those two to drift, because there is only one of each. Every
corpus level instead has a *pair* of renderers — `renderSectionAdd` and
`renderSectionEdit`, `renderParagraphAdd` and `renderParagraphEdit` — and every
pair has drifted, in the same direction: the add form is the smaller one.

That is not a coincidence, it is what happens when the add form is written
first, as the minimum needed to bring an object into existence, and fields are
then added to the editor as they are needed. Nobody goes back to the add form,
because the object can already be created without them.

**The gaps are not evenly distributed.** Sentence-add is missing one field.
Section-add is missing the only field a section has besides its title.
Paragraph-add is missing three of four. The worst case is a section, where
"create" collects half the object.

**Two fields are settable nowhere at all**, and both are on the morpheme:
`type` and `transliterations`. `type` is reachable only by inheritance from a
dictionary entry, which is why B-089 mattered so much more than its size
suggested: it was the *only* path, and it ran once per project open.
`transliterations` had its input removed from the morpheme row in v4.0.9; the
value is carefully preserved through every save and cannot be entered.

**Five document fields are written by the CLI and shown nowhere.** Not a
creation gap so much as a display gap, but it belongs in the same table: a
corpus ingested with `--author` and `--publisher` carries them, and an annotator
working in the app cannot see or correct them.

### 16.3 Filed

- **B-091 · S2** — section-add collects no source
- **B-092 · S3** — paragraph-add collects no transliteration or comment, and its
  translation is a bare string with no source or date
- **B-093 · S2** — a morpheme's `type` and `transliterations` cannot be set
  anywhere in the app
- **B-094 · S3** — five document bibliographic fields are stored and never shown
- **D47** — one renderer per object rather than an add/edit pair, following the
  participant modals. The four bugs above are symptoms; this is the cause, and
  fixing them individually leaves the next field to be added in the same
  position.

### 16.4 Checked and found correct

**There is no word-add form and there should not be.** Words come from
tokenizing a sentence. A form that created one word outside a sentence would
have to invent its index and its position, and both are properties of the
sentence.

**The quick-lemma panel is a create-only surface with no editor, and after D35
A2 that is nearly harmless**: a lemma is an id and a citation form, and the
citation form can be changed by typing a different one on any member entry.
Nearly, not entirely — there is no way to rename a lemma in place, so renaming
one means re-pointing every member. Folded into D35 stage B5 rather than filed
separately, since B5 is building the group view anyway.

---

## 17. Modal or view: the rule, and what it turned out to be about

**Decided 2026-08-29 at v3.14.197**, closing I15. The audit had said "the rule
matters more than which way it goes", which was honest and unhelpful. D48 supplied
the missing basis: look at what creation actually collects.

### The rule

**A modal** when creation is a short record the annotator fills in and returns
from, and nothing in the surrounding view needs to stay visible while they do it.

**A view** when creation ingests bulk content, or needs the corpus on screen, or
carries enough fields that an overlay would scroll.

Applied to what exists:

| object | what creation collects | |
|---|---|---|
| annotator | identity + 3 aux + 3 extra, **no core at all** | modal |
| source | identity + 2 core, self-contained | modal |
| lemma | identity only | quick-create panel |
| document | identity + 2 core, and it is the empty-state entry point | view |
| section | identity + 1 core **+ the section's text** | view |
| paragraph | core translations **+ text that becomes sentences** | view |
| sentence | identity + a tokenization you have to see | view |
| dictionary entry | fourteen fields | view |

**It ratifies every current assignment.** I15 turns out to be "write down the rule
you are already following", not "change six surfaces" — which is the cheapest
possible outcome and was not the expected one.

**Section was the one close call**, and the reporter settled it in favour of a
view for a reason the field count does not show: a section is a plausible home
for texts from *different sources*, so its field list is the one most likely to
grow. A surface chosen for today's two fields would be the wrong surface for
that.

### What the question was really about

Working it through exposed a mis-framing worth correcting before D47 builds.

An add view is **not** "the edit view with fewer fields". `renderSectionAdd`
collects a title and **the section's text**, which is then split into paragraphs
and sentences. That text is not a field of a section at all — a section has two
fields and text is not one of them. It is an **operation**: ingest and segment.
`renderParagraphAdd` does the same at its level, and `renderSentenceAdd`'s
tokenization is the same thing again.

So the difference between creating and editing should be **exactly one declared
thing, a create-only ingest step**. Everything else that currently differs
between an add form and its editor is not a design decision; it is the drift
§16 measured.

This is what makes D47 small. The renderer takes `(level, object|null, {ingest})`
and **"which fields" stops being a parameter at all** — it comes from D48's table
either way. The modal-versus-view choice becomes purely presentational, and two
objects may legitimately differ without any risk of their forms diverging.
