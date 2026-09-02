# Guard suite re-verification by mutation
**Updated:** 2026-08-30 · **Version:** v3.14.254  
*Frozen at the version its findings were acted on. Not bumped again.*

The evidence behind `UNIFIED_AUDIT.md` §4.3's re-verification: every mutation
run, per guard, with what survived. §4.3 carries the conclusions; this carries
the experiments, so a later reader can check them rather than believe them.
B-131 and B-132 were found here.


Scope: every claim in `dev/audits/UNIFIED_AUDIT.md` §4.3 that was measured at
v3.14.229 or v3.14.250. Method: copy the file under test to `/tmp`, mutate it,
run the affected guards and then `./dev/tests/run_all.sh`, restore, and confirm
the restore with `cmp`. Every experiment below ended with a byte-identical
restore and a clean `66 passed, 0 failed, 2 disabled`. Files mutated during the
work: `source/LingCoT.html`, `source/modules/events.js`,
`source/modules/field_spec.js`, `source/LingCoT.css`. All four verified
identical to their pre-mutation copies at the end. No file in the repository was
edited.

## 0. Baseline

| measure | v3.14.253 |
|---|---|
| executables | 68 (66 `*_test.js`, `log_triage.js`, `nllb_diag_test.py`) |
| lines in `dev/tests/` (guards + helpers) | 14,240 |
| runtime assertions across the JS guards | 1,667 |
| result | 66 passed, 0 failed, 2 disabled (`search_b_matcher`, `search_b_concordance`) |

Assertion counts below are runtime counts: every `ok`/`FAIL` line the guard
prints on a clean tree, not `check(` call sites in the file. Loops mean the two
differ, sometimes by a factor of three.

## 1. Every guard: assertion count and category

Category legend. `vm` = loads and runs the app through `_dom.js` or a `vm`
context. `eval` = extracts one or more functions from source and runs them.
`module` = requires a real module from `source/modules/`. `fixture` = parses a
corpus from `samples/` or the live corpus. `proc` = shells out to Python.
`source-only` = reads text and matches patterns; nothing under test executes.

| guard | assertions | category |
|---|---|---|
| affordance_test | 10 | source-only |
| annotator_select_test | 25 | eval |
| autolink_test | 19 | eval |
| autosave_target_test | 22 | source-only |
| boot_smoke_test | 9 | vm |
| chip_system_test | 20 | source-only |
| cli_schema_test | 12 | fixture + proc |
| compaction_test | 11 | vm |
| dep_arc_test | 19 | eval |
| dep_parse_test | 37 | eval |
| dep_root_test | 16 | fixture + eval |
| derived_prov_test | 11 | vm |
| dict_delete_refs_test | 21 | vm |
| doc_integrity_test | 45 | source-only |
| ensure_morphemes_test | 12 | vm |
| field_spec_test | 62 | fixture + module |
| form_render_test | 177 | vm + module |
| gitignore_test | 26 | proc |
| help_coverage_test | 9 | source-only |
| homograph_test | 17 | eval |
| id_sort_test | 11 | source-only |
| igt_align_test | 25 | vm |
| input_attrs_test | 9 | source-only |
| journal_binding_test | 10 | vm + fixture |
| journal_disk_test | 8 | vm + fixture |
| journal_record_test | 13 | vm |
| journal_replay_test | 8 | vm + fixture |
| lang_resolve_test | 31 | vm + module + eval |
| lemma_registry_test | 48 | vm + fixture + eval |
| license_assets_test | 14 | source-only |
| linking_s1s3_test | 34 | module (26 source-only, 8 executed) |
| locale_key_test | 15 | eval |
| locale_shadow_test | 1 | source-only |
| modal_conformance_test | 20 | module (table-driven, source-matched) |
| morph_type_test | 48 | eval |
| morpheme_merge_test | 10 | vm |
| nav_traversal_test | 28 | eval |
| normalize_test | 65 | module |
| prov_clock_test | 21 | eval (19 source-only, 2 executed) |
| prov_intern_test | 51 | vm + fixture + module |
| prov_presentation_test | 27 | vm + module |
| push_to_dict_test | 33 | vm |
| readme_tree_test | 8 | source-only |
| render_cache_test | 13 | eval |
| render_smoke_test | 27 | vm + fixture |
| render_untranslated_test | 3 | eval |
| required_marker_test | 56 | module (28 source-only, 20 table-data, 8 executed) |
| retokenize_align_test | 35 | vm + module |
| save_advance_test | 39 | vm + module |
| schema_conformance_test | 2 | fixture + module |
| search_b_concordance_test | 0 (disabled) | vm + fixture |
| search_b_matcher_test | 0 (disabled) | vm + fixture |
| search_b_test | 16 | vm + fixture |
| search_parity_test | 2 | vm + fixture |
| selection_test | 74 | eval |
| selector_audit_test | 4 | source-only |
| suggest_mechanism_test | 76 | vm + module (67 source-only, 5 table-data, 4 executed) |
| tag_control_test | 26 | source-only |
| theme_audit_test | 4 | source-only |
| ui_wiring_test | 12 | source-only |
| undefined_call_test | 6 | source-only |
| variation_fields_test | 21 | fixture + module |
| venv_tier_test | 14 | proc |
| word_edit_pos_test | 29 | vm |
| workspace_test | 44 | source-only + proc |
| xlate_settings_test | 45 | eval |
| log_triage | 1 | source-only |

Sixteen guards execute nothing under test: `affordance`, `autosave_target`,
`chip_system`, `doc_integrity`, `help_coverage`, `id_sort`, `input_attrs`,
`license_assets`, `locale_shadow`, `readme_tree`, `selector_audit`,
`tag_control`, `theme_audit`, `ui_wiring`, `undefined_call`, `log_triage`.
That is 202 assertions. Adding the source-only majorities inside
`required_marker` (28), `suggest_mechanism` (67), `linking_s1s3` (26) and
`modal_conformance` (20) brings the static total to about 343. The audit's "14
files, ~300 assertions" is the right order of magnitude and slightly low at the
current version. Being static is not itself the defect — `theme_audit`,
`selector_audit`, `undefined_call`, `id_sort` and `doc_integrity` are checking
properties of the text, which is what they should do. The defect is a static
guard standing in for a behavioural one, which is claims 1 and 2.

## 2. Claim 1 — `linking_s1s3_test` is "proven hollow"

**Confirmed, with a correction to the count.** The guard names eight functions,
not five: `resolveLemma`, `saveDictEntry`, `saveNewDictEntry`, `lemmaStripHtml`,
`takeOffer`, `linkNote`, `reportLinkNotes`, and `saveWord` (via `fnSrc`).

Each body replaced with `{ return null; }`, one at a time:

| gutted | linking_s1s3 result |
|---|---|
| `resolveLemma` | 34 passed, 0 failed |
| `takeOffer` | 34 passed, 0 failed |
| `lemmaStripHtml` | 34 passed, 0 failed |
| `linkNote` | 34 passed, 0 failed |
| `reportLinkNotes` | 34 passed, 0 failed |
| `saveDictEntry` | 33 passed, 1 failed |
| `saveNewDictEntry` | 33 passed, 1 failed |
| `saveWord` | 33 passed, 1 failed |

The five that survive, gutted together: **34 passed, 0 failed.** Run against the
whole suite, that mutation is caught only by `morph_type_test` and
`suggest_mechanism_test`, and both catch it for the wrong reason — a body-text
regex stopped matching, not a behaviour changing.

The three that fail do so because the guard greps the function's own body for a
literal (`_resolveOrCreateLemma(`, `dict_id: rowDictId || undefined`). Deleting
the body deletes the literal. That is detection of deletion, not of defect.

**The decisive experiment.** Instead of deleting bodies, prepend `return null;`
to ten functions, leaving every byte the guards match intact:
`resolveLemma`, `takeOffer`, `lemmaStripHtml`, `requiredMark`, `wantedMark`,
`showGlossAC`, `focusOfferChip`, `refreshMorphSuggest`, `renderMorphSuggestPanel`,
`offerStripHtml`, `stampFieldProv`. Result:

- `linking_s1s3`: 34 passed, 0 failed
- `required_marker`: 56 passed, 0 failed
- `suggest_mechanism`: 76 passed, 0 failed
- whole suite: 64 passed, 2 failed — only `prov_intern` and `render_smoke`, the
  two that actually run the app.

166 assertions across three guards, and disabling ten of the functions they are
about changes none of them.

Of `linking_s1s3`'s 34 assertions, 8 execute anything: the seven `Intl.Collator`
checks (which test the V8 ICU tables, not this project) and one
`N.dictKeyIn()` comparison. The remaining 26 are regexes over `LingCoT.html`,
`events.js` and `en.json`.

## 3. Claim 2 — `required_marker` (56) and `suggest_mechanism` (76) assert existence

**Confirmed for `wantedMark`, and it generalises.**

| gutted | required_marker | suggest_mechanism |
|---|---|---|
| `wantedMark` | 56 passed, 0 failed | 76 passed, 0 failed |
| `requiredMark` | 56 passed, 0 failed | 76 passed, 0 failed |
| `requireIdentity` | 56 passed, 0 failed | 76 passed, 0 failed |
| `renderField` | 54 passed, 2 failed | 71 passed, 5 failed |

`renderField` is only caught because both guards regex its body text.

`required_marker` does have a live behavioural core, which the audit does not
credit. It requires `field_spec.js` and drives the identity-field loop from
`fieldsInTier` and `elementIdFor`:

| gutted in `field_spec.js` | required_marker |
|---|---|
| `elementIdFor` | 56 assertions, 7 failed |
| `fieldsInTier` | crashes (non-zero exit; detected) |
| `tierOf` | 0 failed (caught instead by `field_spec_test`, 11 failed) |
| `isEmptyValue` | 0 failed anywhere in the suite |
| `tagPoolOf` | 0 failed anywhere in the suite |

Breakdown of `required_marker`'s 56: 8 execute `field_spec` code; about 20 read
the field table or `en.json` as data (`declares an emptyMsg`, `exists in the
locale`, `is on a generated form`); the remaining 28 are regexes over
`LingCoT.html`, `LingCoT.css` and the modules. The whole of sections 2 through 7
— the marker, the modals, the gate call sites, the stylesheet, the quick-lemma
panel, the translated labels — is source text.

`suggest_mechanism`'s 76 are not all static either, but the executed part is
worse than static.

- 67 are regexes over decommented source and CSS. Ten of those are the five
  "retired class X is gone from the source / and from the stylesheet" pairs.
- 5 (`dict_entry.*  draws on the 'X' pool` and `4 generated dictionary fields
  name a pool`) drive off `field_spec.fieldsOf('dict_entry')` and then regex
  `renderField`'s body.
- 4 execute `_fillMorphRows` in a `vm` context: assertions 43 to 46, the B-082
  cases.

**Those four executed assertions do not catch B-082.** Restoring the original
bug — changing the gate from `el.dataset.original` back to `el.value` in
`mayFill` — leaves `suggest_mechanism` at 76 passed, 0 failed and the whole
suite green. The reason is in the fixtures: assertion 44 builds a row whose
shown POS is already `AFFIX` and asserts the result is `AFFIX`, so it holds
whether the offer wrote or did nothing. The row that would separate the two
cases (shown POS `NOUN` from a default, offer carrying `AFFIX`, expecting
`AFFIX`) is not there.

## 4. Claim 3 — the redundancy pairs

**All five refuted.** Each pair was tested by breaking what the supposedly
redundant guard covers and checking whether the supposedly superset guard
notices. `style_wiring_test.js` does not exist in `dev/tests/`; the audit's
mention of it is stale.

### `render_smoke` ← `render_untranslated` — not subsumed

Mutation: delete `${t('status.no_translation')}` from the three sites in
`LingCoT.html` that emit it. Nothing throws; the views still render.

- `render_untranslated`: 1 passed, 2 failed
- `render_smoke`: 27 passed, 0 failed
- whole suite: only `render_untranslated` fails

`render_smoke` asserts that each of 22 views produces "substantial markup" — a
character count. It says so in its own header: "Nothing here looks at the HTML
beyond whether there is any." `render_untranslated` is the only guard that
asserts the untranslated placeholder and the real translation both survive.
Deleting it loses 3 assertions, all of which are content assertions no other
guard makes. The two are complementary: `render_smoke` covers 22 views for
exceptions, `render_untranslated` covers 3 renderers for output.

### `dep_parse` ← `dep_root` — not subsumed, disjoint

| gutted | dep_parse | dep_root | dep_arc |
|---|---|---|---|
| `depRelOf` | 37/0 | 10 passed, 6 failed | 15 passed, 4 failed |
| `depLocalId` | crash | 16/0 | crash |
| `depResolveHead` | crash | 16/0 | 19/0 |
| `depHasParse` | 31 passed, 6 failed | 16/0 | 19/0 |
| `_depSweepHeads` | 31 passed, 6 failed | 16/0 | 19/0 |

No overlap in either direction. `dep_parse` covers `depLocalId`,
`depResolveHead`, `depHasParse`, `_depSweepHeads`; `dep_root` covers `depRelOf`
and the derived-root invariant plus a corpus data check. Merging them would be a
file merge, not a redundancy removal, and would lose nothing only if all 53
assertions were carried across.

### `affordance` ← `theme_audit`, `selector_audit` — not subsumed

Mutation in `LingCoT.css`: `.ann-table th[data-ann-sort] { cursor: pointer; }`
→ `.ann-table th { cursor: pointer; }`, which is exactly I9, the defect the
guard was written for.

- `affordance`: 9 passed, 1 failed
- `theme_audit`: 4 passed, 0 failed
- `selector_audit`: 4 passed, 0 failed
- whole suite: only `affordance` fails

The three guards check different things. `theme_audit` checks that colour
declarations and dark-mode tokens exist and pair up. `selector_audit` checks
that class selectors named in JS resolve in the CSS. `affordance` checks the
scoping of two specific rules and the absence of inline badge styles. Deleting
`affordance` loses 10 assertions, none of which is made anywhere else.

### `ui_wiring` ← `modal_conformance`, `chip_system` — not subsumed

| mutation | ui_wiring | modal_conformance | chip_system |
|---|---|---|---|
| gut `mutate()` | 10 passed, 2 failed | 20/0 | 20/0 |
| rename `id="am-name"` to `id="am-DEADFIELD"` | 12/0 | 17 passed, 3 failed | 20/0 |

Unique in both directions. `ui_wiring`'s 12 assertions cover the delegation
table, body-appended modals binding their own listeners, role/tabindex on
non-native clickables, the dictionary badge, `mutate()` as the chokepoint, and
the writer/flusher coverage sweep. `modal_conformance`'s 20 compare the two
modals against the field table. `chip_system`'s 20 are CSS and retired chip
spellings. The only assertions in the neighbourhood of each other are
`ui_wiring`'s "2 modals are appended to document.body" and
`modal_conformance`'s "ann-modal-box is in the markup", and they are not the
same assertion.

### `prov_intern` ← `prov_clock` — not subsumed, different subjects

Mutation: `localDate` rewritten to read `getUTCFullYear` / `getUTCMonth` /
`getUTCDate`, which is B-105 reintroduced.

- `prov_clock`: 19 passed, 2 failed
- `prov_intern`: 51 passed, 0 failed
- `prov_presentation`: 27 passed, 0 failed
- whole suite: only `prov_clock` fails

`prov_clock` is about which clock a stamp reads. `prov_intern` is about how a
stamp is serialized. They share the word "prov" and nothing else.

**However, `prov_clock` has a real weakness the audit did not find.** Its 21
assertions are 19 source regexes and 2 executed cases, and the executed cases
are timezone-dependent. Under the UTC mutation:

| TZ | result |
|---|---|
| UTC | 19 passed, 2 failed (both source regexes) |
| Asia/Tokyo | 19 passed, 2 failed (both source regexes) |
| America/Los_Angeles | 18 passed, 3 failed (the rollover case also fails) |

The rollover fixture is `new Date(2026, 11, 31, 20, 30)`. In UTC and in any
positive offset that is still 31 December in UTC, so the behavioural assertion
holds under the bug. The suite runs in UTC here, so the one assertion in this
guard that could catch B-105 by execution never does. Also, 8 of the 21
assertions are one rule (`toISOString().slice(0,10)`) applied once per module
file, which inflates the count without adding coverage.

## 5. Claim 4 — "59 assertion sites assert absence"

The figure is close to right but the category needs splitting, and only one of
the two halves is the problem the audit describes.

Counted at v3.14.253:

- **~54 direct source-absence assertions** of the form
  `check(!/pattern/.test(source), ...)`. A pattern-match sweep finds 64 sites,
  of which about ten are artefacts of multi-clause `check(` calls where the
  negation is a secondary conjunct rather than the assertion. 59 is within the
  measurement noise of this count and there is no evidence it has changed.
- **107 sweep-style assertions** of the form `check(offenders.length === 0)`,
  where `offenders` is built by scanning the source or the corpus. These are
  lint rules over a computed set, not fixed-string absence, and they are a
  different category.

Load-bearing, verified by reintroducing the pattern:

- `id_sort_test`, "no comparator sorts by `.id`". Adding
  `[].sort((a,b) => a.id < b.id ? -1 : 1)` to `events.js` produces
  `10 passed, 1 failed`. Two live variable-key comparators exist
  (`_getDictSorted`, `renderAnnotatorsView`), so this is one key assignment
  away from a violation.
- `id_sort_test`, "none of the sortable columns is id". Adding
  `{ key: 'id', label: 'ID' }` to the dictionary browse column list produces
  `10 passed, 1 failed`.
- `prov_clock`, "localDate reads no UTC field" — caught the B-105 mutation
  above and was one of only two assertions in the suite that did.
- `affordance`, "the cursor is scoped to `[data-ann-sort]`" — caught the I9
  mutation.
- `suggest_mechanism`, "no field uses a native `<datalist>`". `list="x"` is four
  characters and a hand-written input would reintroduce it.
- `workspace`'s `\bROOT\b` checks, `xlate_settings`'s `target_lang: 'en'` and
  `tl=en`, `lemma_registry`'s `comments: []`, `linking_s1s3`'s bare-lookup
  check: all name spellings that a plausible future edit could produce.

Permanently green, with no live producer. For each of these the forbidden token
appears in **zero** files under `source/` (it appears only in `dev/archive/`,
which is history):

`chip-toggle`, `src-sel-remove`, `trans-src-chip-set`, `spc-type-old`
(`chip_system`, 4 assertions); `lemma-strip-ok`, `lemma-strip-new`,
`morph-suggest-chips`, `morph-suggest-label`, `mc-used`, `mc-parse`
(`suggest_mechanism`, 10 assertions, each name checked twice — once in the
source, once in the stylesheet); `es-expand-btn`, `dex-type-filter`
(`tag_control`, plus a duplicate `es-expand-btn` check in `word_edit_pos`);
`showProv` (`prov_presentation`); `_HELP_CONTENT` (`help_coverage`);
`qlDatalist` (`suggest_mechanism`); `syncPushDictState` (`morph_type`).

That is roughly 20 of the ~54 direct absence assertions pinning identifiers that
exist nowhere in the shipped source. They are cheap and they document completed
migrations, but they cannot go red without someone retyping a name that has no
remaining referent. `es-expand-btn` is additionally asserted twice, in
`tag_control_test` and `word_edit_pos_test`.

The 107 sweep assertions are a different matter and should not be counted with
these. `theme_audit`'s four, `selector_audit`'s four, `undefined_call`'s
`missing.length === 0`, `prov_intern`'s `undeclared.length === 0` and
`readme_tree`'s three are all computed over a set that grows with the codebase,
so they go red the moment a new violation is introduced. They are the good case.

## 6. Claim 5 — the seven D50 guards

All seven were mutation-tested against the function each is about. Six of the
seven are behavioural and each detects its own subject; the seventh is
source-regex and still catches both realistic shapes of the defect it names.

| guard | assertions | category | mutation | caught? |
|---|---|---|---|---|
| `journal_replay` | 8 | vm + fixture | gut `expandProv` | yes, 6 passed 2 failed |
| `journal_disk` | 8 | vm + fixture | gut `journalWrite` | yes, 4 passed 4 failed |
| `journal_record` | 13 | vm | gut `journalReset` | yes, 5 passed 8 failed |
| `compaction` | 11 | vm | gut `compact` | yes, 7 passed 4 failed |
| `journal_binding` | 10 | vm + fixture | gut `journalBaseMismatch` | yes, 9 passed 1 failed |
| `morpheme_merge` | 10 | vm | `mergeMorpheme` → bare spread | yes, 7 passed 3 failed |
| `id_sort` | 11 | source-only | comparator by `.id` | yes, 10 passed 1 failed |

Two of these were tested with a semantic mutation that leaves the source text
plausible, which is the harder test:

- **`compaction`.** Moving the journal truncation to before `await
  Promise.all(tasks)` — that is, emptying the journal while the base write is
  still in flight, the exact ordering its header says makes an interrupted
  compaction unsurvivable — produces `9 passed, 2 failed`
  ("the journal is NOT emptied while the base write is still in flight",
  "only after every write has actually landed"). This guard would catch the
  defect it was written for.
- **`morpheme_merge`.** Replacing the merge loop with
  `return { ...(existing || {}), ...managed };` — the "bare spread" its header
  names as the opposite failure — produces `7 passed, 3 failed`, one per key
  the panel deliberately clears. This guard would catch the defect it was
  written for, in both directions.

`id_sort` is the one source-only guard of the seven, and it is a justified one:
its own header explains that a variable-key comparator cannot be read off its
body, so it checks the two places the key can come from (the sortable column
lists) and the comparator bodies. Both halves were verified by reintroduction.

Cross-coverage among these seven is low and deliberate: gutting `expandProv`
fails `journal_replay` and crashes `journal_disk` and `journal_record`, but
`compaction` and `journal_binding` stay green, and vice versa. Gutting
`adoptProvEvents` is caught by none of the seven — `prov_intern` and
`render_smoke` catch it instead.

## 7. Recommendations, ranked

### 1. Rewrite `suggest_mechanism`'s B-082 block. Highest value, smallest change.

Four assertions execute `_fillMorphRows` and none of them distinguishes filling
from not filling. Restoring B-082 verbatim leaves the whole suite green. Fix the
row fixtures so the expected value differs from the pre-existing value:

- assertion 44 currently builds `mkRow('de','','','','AFFIX')` and asserts the
  POS is `AFFIX`. Build `mkRow('de','','','','NOUN')` and assert `AFFIX` —
  a defaulted POS that the offer must overwrite.
- assertion 46 has the mirror problem and should assert that a *saved* `NOUN`
  survives an offer carrying `AFFIX`, which it currently cannot distinguish.

Evidence: `mayFill` gate reverted from `el.dataset.original` to `el.value`,
76 passed, 0 failed, suite green.

### 2. Give `linking_s1s3` a behavioural half, or fold it into `render_smoke`.

Five of the eight functions it names can be disabled with the file's text
intact and all 34 assertions stay green. The three that fail do so on body-text
greps.

The cheapest real coverage: `takeOffer`, `resolveLemma` and `lemmaStripHtml` are
callable in a `vm` the way `suggest_mechanism` already calls `_fillMorphRows`
and `morpheme_merge` calls `mergeMorpheme`. Assert that taking an offer writes
`row.dataset.dictId`, and that a lemma miss produces a note rather than a silent
resolution — the two properties the header says the guard exists for.

What must be kept if the file is merged elsewhere: the seven `Intl.Collator`
assertions (they document a counter-intuitive Turkish tailoring and are the only
place it is recorded) and the icon-sprite sweep, which duplicates
`selector_audit`'s "27 icon name(s) used, all present in the sprite" and could be
dropped instead.

### 3. Rewrite `required_marker`'s sections 2–7 to execute `renderField`.

28 of its 56 assertions are source regexes, and gutting `wantedMark`,
`requiredMark` or `requireIdentity` fails none of them. Sections 1's 8 executed
assertions are worth keeping as they are: gutting `elementIdFor` fails 7 of
them, and gutting `fieldsInTier` crashes the guard.

`render_smoke` already loads the whole app with a real corpus. Calling
`renderField` on one identity-tier field and one empty core-tier field, and
asserting the emitted markup contains `class="required"` and `class="wanted"`
respectively, would replace roughly eight of the source regexes with assertions
that fail when the mark stops being produced.

### 4. Fix `prov_clock`'s rollover fixture, and collapse its per-module loop.

Its one behavioural assertion is vacuous in UTC and in every positive-offset
timezone; only the source regexes caught the B-105 mutation. Assert both
directions — a late evening (`20:30`) and an early morning (`03:30`) on
31 December — so the case fails under a UTC-reading `localDate` regardless of
where the suite is run.

Separately, 8 of its 21 assertions are the same `toISOString().slice(0,10)` rule
applied once per module file. One assertion naming the offending files in its
detail line says the same thing.

### 5. Delete or consolidate the retired-spelling absence assertions.

About 20 direct absence assertions pin identifiers that appear in zero files
under `source/`. Ten of them are `suggest_mechanism`'s five
"retired class X is gone from the source / and from the stylesheet" pairs, which
are a single migration recorded twice per name. `es-expand-btn` is asserted in
both `tag_control_test` and `word_edit_pos_test`.

These are not harmful, but they are the bulk of what the audit's "permanently
green" row is pointing at, and they should not be counted as coverage. Replacing
each cluster with one sweep — a list of retired names checked against the whole
of `source/` in a loop — keeps the property, keeps the failure message, and
costs one assertion per guard instead of ten.

### 6. Keep all five "redundancy pairs" as separate files.

Every one of the five merges the audit proposes would lose assertions nothing
else makes:

- deleting `render_untranslated` loses the only assertions that the untranslated
  placeholder and the real translation both appear in rendered output (3);
- deleting `dep_root` loses `depRelOf` coverage entirely, and `dep_parse` covers
  none of it (16);
- deleting `affordance` loses the `[data-ann-sort]` scoping rules and the
  inline-badge-style sweep (10);
- deleting `ui_wiring` loses the delegation table, the `mutate()` chokepoint and
  the writer/flusher sweep (12);
- deleting `prov_clock` loses the local-clock rule entirely (21, of which the
  two `localDate` checks are the ones that fire).

The audit says these were "verified by reading the guards' own headers". The
headers describe adjacent topics; the assertions do not overlap. If the goal is
fewer executables, these five pairs are the wrong eight files to merge, and the
executable count is not what costs 19 s anyway — `nllb_diag_test.py` is.

### 7. Keep the seven D50 guards as they are.

All seven detect their own subject, and two of them (`compaction`,
`morpheme_merge`) were verified against text-preserving semantic mutations of
the exact defect they were written for. `id_sort` is source-only and justified
in being so. No change recommended.

### 8. Re-measure the mutation score before quoting it.

The audit's "56% (17 of 39 mutants survived)" is from v3.14.229 and is not
reproducible from what is recorded. The 24 mutants run for this note give a
different picture per guard: the journal and merge guards score 6 of 6, the
static UI guards score by accident when body text disappears and score zero when
it does not. A single suite-wide percentage hides that. Report it per guard, and
run text-preserving mutations (prepend `return null;`) rather than body deletion
— body deletion flatters every guard that greps a body.

## 8. Corrections to §4.3 as written

- `style_wiring_test.js` does not exist. Remove it from the redundancy row.
- "gutting all five named functions including `takeOffer()`" — the guard names
  eight functions; five survive gutting, three fail on body-text greps. The
  conclusion holds, the count does not.
- `required_marker` is not purely existence-based: 8 of its 56 assertions
  execute `field_spec.js` and fail when `elementIdFor` is gutted. The other 48
  are as described.
- `suggest_mechanism` is not purely existence-based either: 4 of its 76 execute
  `_fillMorphRows`. Those four are worse than static, because they read as
  behavioural coverage of B-082 and do not provide it.
- The five redundancy pairs are all refuted by mutation. The row should be
  removed or restated as "adjacent in topic, disjoint in assertions".
- The "after" column's 53 executables and "−7 merged" rest on those pairs and
  should not be carried forward unchanged.
