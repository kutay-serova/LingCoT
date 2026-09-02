# D48: one field table — what exists, in what order, and how much it matters
**Updated:** 2026-08-30 · **Version:** v3.14.262  
*Frozen at v3.14.252, when it was moved out of DEV_PLAN. Reopened once, at
v3.14.262, because the table grew a fourth job — see the last section.*

**Design record. Moved out of `dev/DEV_PLAN.md` at v3.14.252**, when the plan's
entry had grown to 11.7 KB describing work that is done. Every stage A to C
shipped between v3.14.196 and v3.14.210. The table itself lives in
`source/modules/field_spec.js`, which is the authority; this file is why it looks
the way it does.

Read it before adding a field, changing a tier, or touching a generated form.
`field_spec_test.js`, `surface_conformance_test.js`, `required_marker_test.js`
and `form_render_test.js` all hold the code to what is decided here.

**One item is still open**, and it is in `DEV_PLAN.md` rather than here:
`transliterations` is declared `aux` and waits on D32, which is also conflict
⑦/⑧ in the unified audit and blocks D34.

---

**Decided 2026-08-29**, after B-091 to B-094, B-099 and B-082 turned out to be
one question asked in six places. Assumes the two uses the tool is actually for:
**text + translation**, and **text + gloss + dictionary**.

#### Two decisions this rests on

**1 · Obligatory means identity, not importance.** A save is blocked only when
the object could not be found again without the field. Everything else is
allowed to be empty, because in fieldwork it legitimately is, and refusing the
save does not produce the value — it produces a placeholder. A placeholder is
worse than an empty field here specifically: `hasAnnotation(o, deep, human)` and
the auto-advance both read emptiness as "not done", so junk typed to get past a
dialog looks like annotation and silently breaks the one mechanism that says
what is left.

Above that rule sits a better one: **prevent by construction where you can.**
`tokenizeWords` filters empty strings, so a word cannot exist without a form and
no check is needed. `alert.validation.word_form_required` is a message with no
call site, and should be deleted rather than wired up.

**2 · The tiers are fixed, in one table, read through one accessor.** LingCoT
decides them; every corpus gets the same answer. But every consumer asks
`tierOf(level, key)` rather than carrying its own list, so making them
per-project later — a transcription corpus should not be told it is 0% glossed
— is a change to one function instead of twenty views. Not built now. The seam
is what matters, and D34 is the consumer that will force the question.

#### The tiers

| tier | meaning | what reads it |
|---|---|---|
| `identity` | the object cannot be found again without it | blocks the save; carries the required marker |
| `core` | this is the work. Empty means unfinished | D34's counter, B-099's signalling, auto-advance |
| `aux` | real annotation, offered, never counted as missing | rendered; silent |
| `extra` | specialist, or lives on another surface | declared so it is not forgotten; never prompted |
| `derived` | the app writes it; there is no control | listed so nobody adds one |
| `legacy` | written before a model change; carried, drawn by nothing | added at stage A, because the fixture forced it |

`derived` earns its place: it is why `dict_id` has no field, and it stops the
next person "fixing" that.

**`legacy` was not in the draft.** Stage A's guard walked the fixture and found
seven keys the table did not admit existed — the lemma residue A2's migration
deliberately preserves, plus `alternate_forms` and `definition`. They are not
derived (the app does not write them) and not extra (no surface owns them).
Carried, drawn by nothing. The table had to say so, because a consumer built on
a table that omits a field on disk is blind to it — which is B-093 and B-094's
failure mode from the inside.

**Two of them were decided at v3.14.249 (D50 stage 4d).** `_migrateDictLegacy`
copies `alternate_forms` into `variants` and `definition` into `meaning` on load
and drops both keys, so neither survives a load-then-save any more. The stage A
note said `definition` was "read on load, never written"; that was wrong —
nothing read it anywhere, which is why dropping the key without a migration would
have emptied every pre-rename dictionary. Both stay declared `legacy` because
files on disk still carry them until they are next opened. Empty lemma residue is
dropped on load too; a non-empty one is kept, and **D35 B5** decides it.

#### The table

Order within each level is the order the view asks for it.

**document**

| field | tier | note |
|---|---|---|
| title | identity | |
| language | core | drives the fold context; B-097 showed what an unbound one costs |
| translation_language | core | declared and drawn since v3.14.217; **B-117** is that neither save handler stores what is typed |
| source_ids | aux | |
| comments | aux | |
| authors · content_sources · content_date · publisher · notes | extra | **B-094**: written by the CLI, displayed nowhere. Extra, but shown |
| dict_key_version · metadata_prov · field_prov | derived | |

**section**

| field | tier | note |
|---|---|---|
| title | identity | |
| source_ids | core | **B-091**. A section has two fields; where the text came from is half of it |

**paragraph** — a container with no identity field of its own; its text is its sentences.

| field | tier |
|---|---|
| translations | core |
| transliterations | aux |
| comments | aux |

**sentence**

| field | tier | note |
|---|---|---|
| text | identity | |
| words | core | the tokenization, auto-derived and overridable |
| translations | core | the first of the two named uses |
| transliterations | aux | |
| comments | aux | **B-092**: absent from sentence-add today |
| sentence_index · annotations | derived | `annotations` is legacy, stripped on load |

**word** — the order here is a claim, and **D46 tests it against real annotation**.

| field | tier | note |
|---|---|---|
| form | identity | shown, not editable; retokenize to change it |
| morphological_parse | core | first, because everything below derives from it |
| *morpheme rows* | core | see below |
| part_of_speech | core | |
| gloss | core | derived from the morphemes; editable |
| lemma_id | aux | |
| transliterations | aux | promoted to core by a non-Latin-script project — the first real case for the per-project override |
| head · dep_rel | extra | `surface: 'deps'`, the dependency editor |
| morphemes · dict_id · word_index | derived | |

**morpheme**

| field | tier | note |
|---|---|---|
| form | identity | from the parse; not editable in the row |
| gloss | core | |
| part_of_speech | core | |
| type | core | never DEFAULTED (B-069) but always ASKED. Unset is unfinished, not undecidable |
| transliterations | aux | **B-093**'s open half; blocked on **D32** |
| dict_id | derived | |

**dictionary entry**

| field | tier | note |
|---|---|---|
| form | identity | |
| type | core | |
| part_of_speech | core | |
| gloss | core | |
| meaning | aux | |
| transliterations · lemma_id · constituent_forms · comments | aux | |
| variants · allomorphs · selection · semantic_domain · usage_notes · pinned_examples | extra | **I6**: this is the 15-field screen. Six of them are extra, which is what makes it splittable |
| homograph | derived | D35 A1 |

**lemma record** — form, identity, and nothing else. D35 A2.

**annotator**

| field | tier |
|---|---|
| name | identity |
| role · affiliation · researcher | aux |
| birth_decade · contact_info · other | extra |

**source**

| field | tier | note |
|---|---|---|
| name | identity | |
| type | core | |
| publication_restrictions | core | it decides whether a text may ship in `samples/`. Currently as quiet as `other_information` |
| other_information · citation_information | aux | |
| birth_decade · gender · language_background · researcher | extra | human-only |

#### What falls out

| | becomes |
|---|---|
| ~~**B-091 · B-092 · B-094**~~ ✅ v3.14.198 | impossible by construction. With one field list per level there is no second place for a field to be missing from |
| ~~**D47**~~ ✅ v3.14.198–201 | the renderer that reads the table. Create and edit stop being two templates that happen to agree |
| ~~**B-099**~~ ✅ v3.14.210 | a `core` field that is empty is marked. One rule, every view, rather than a decision per box. `wantedMark()`, deliberately not an asterisk: the two marks say different things |
| **B-093** | `type` core and present ✅ v3.14.193; `transliterations` aux and open, waiting on D32 |
| ~~**I1**~~ ✅ v3.14.210 | the eight alerts become the `identity` tier plus D42's `stop` state, said before the click instead of after. `requireIdentity(level)`, called from nine save paths. Two alerts survive on purpose and the guard names both |
| **D34** | counts `core` fields. The list it would otherwise hand-maintain is this table |
| ~~**B-083**~~ ✅ v3.14.211 | `hasAnnotation` reads the table instead of its own field list. **Not `core`, as this row first said**: it feeds the prompt before re-tokenization discards a morpheme, and a transliteration or a comment is somebody's work whether or not the object is finished. It reads every tier that holds annotation; `core` is the counter's question |
| **B-082** ◑ → **B-108** | B-082 closed at v3.14.206 on its other two halves, the missing `type` and the dropdown the fill opened. **This half was never built**, and closing B-082 left it with no number: an offer that would change nothing is not an offer, and D42 dropped the already-used styling without replacing it. Filed as **B-108** on 2026-08-29, on noticing this row still promised it, and ✅ fixed v3.14.213: `offerFillsNothing` asks the stored morphemes, and `.offer-taken` turned out to need no sibling — the chip you just took is exactly a chip that now offers nothing new |

#### Scope, and where it stops

**The table owns what exists, in what order, and how much it matters. It does
not own how everything looks.** The generic renderer handles the ordinary
controls — text, tag, sources, comments, translations. Bespoke surfaces stay
bespoke and are declared with a `surface:` key so the counter and the audit know
the field exists: the morpheme rows, the dependency table, the transliteration
multi-row editors, the offer strips.

A table that tried to generate all of those would be a framework, and would
produce something worse than what is there now.

#### Staging

| | | |
|---|---|---|
| A ✅ v3.14.196 | the table and `tierOf()`, consumed by nothing | additive, no behaviour change |
| B1 ✅ v3.14.198 | the renderer, the reader, and the **section** pair | closes **B-091** by construction |
| B2 ✅ v3.14.198 | the paragraph and sentence pairs | closes **B-092** |
| B3 ✅ v3.14.198 | the document pair | closes **B-094** entirely, not half: the fields are editable, not merely shown |
| B4 ✅ v3.14.201 | dict-add and dict-edit | the 14-field pair. Its six `extra` fields fold into the disclosure, which is most of what **I6** wanted; the lemma cluster became one control, giving **D35 B5** a single place to hang the group link |
| B5 ✅ v3.14.202 | the two identity modals held to the field table | **Not** converted, deliberately. They are the surfaces that never drifted, so regenerating 104 lines of working markup would risk two working screens to prevent a failure they are built not to have. The table SPECIFIES them and a conformance guard holds the markup to it — which also closes the exposure that mattered: their fields live in markup, so `field_spec_test` could not see them, and a field added to a modal and not to the table is invisible to the counter, the marking and the audit |
| C ✅ v3.14.210 | **B-099**'s marking, **I1**'s alerts into the strip | Done. Two marks derived from the tier, `requireIdentity(level)` replacing eight hand-written checks across nine save paths, and the refusal said live at the field. Starting from the table found **B-107**: three save paths that validated nothing at all |
| D ◑ v3.14.211 | **D34** and `hasAnnotation` read it | `hasAnnotation` done: it reads `annotationKeys(level)` and the level is passed rather than inferred. **D34's half cannot be built, because D34 does not exist yet** — it is still a planned feature, so this becomes a constraint on D34 rather than work now: when it is built it counts `core`, and this table is the list it would otherwise hand-maintain. The per-project tier question arrives with it, not before |

**Size: C is S, D is S; A and B are done.** **Prerequisite: I15** ✅ decided
v3.14.197, so B is unblocked. **D46 may reorder the word level**, which is a
change to one array.

---


---

## v3.14.262 · the table also says where a field is and who writes it

D48 gave the table three jobs: what exists, in what order, and how much it
matters. A fourth was missing, and the settability survey found what its absence
cost. Five fields were declared and could not be set, in two shapes:

- a level whose surface is **hand-written** had nothing binding it to the table.
  Generated levels cannot have that gap — `form_render_test.js` renders both
  modes and diffs the ids against the table — and the identity modals could not,
  because stage B5 gave them `modalId`. Word, morpheme and lemma could, and did.
- reading (`readForm`) and stamping (`formProvMap`) were both derived from the
  table while the **assignment** was written out by hand in ten save handlers. So
  a field could be drawn, read, validated and provenance-stamped and never be
  stored. B-117 and B-118 are both that, and both looked like working features
  because every other half of the operation worked.

Four keys close it, and `applyForm(level, obj, values, moment)` is the writer:

| key | says |
|---|---|
| `domId` | the element id a hand-written surface gives this control. `modalId` renamed: one idea, not two |
| `domSel` | the same binding as a selector, for a control that repeats per row. `selectorFor()` hides which kind it is |
| `store` | the bag the value lives in when it is not the record. Only `metadata`, at document level |
| `manual` | the save handler owns this one, because the control's value is not the field's value. `sentence.words` (a line of text against an array of annotated word objects) and both `lemma_id`s (a citation form against an id) |

**The writer's rule**, one for every level: a key the form did not produce is
left alone, a list field always writes an array, a scalar that comes back empty
deletes its key. One shape for unset, and smaller files.

**What this did not do.** The word editor was not converted to a generated form.
The conversion was the unified audit's §4.2 row 2 and it stays available, but the
declaration bought most of what it was for at a fraction of the risk, so the
argument for it is now the marking and the field order rather than drift.

The guard is `surface_conformance_test.js`, widened from the two modals to every
hand-written surface. It deliberately does **not** check the control kind against
the markup: on a bespoke surface the control is the surface's business, and
`word.transliterations` — declared `translits`, drawn as one box — is D32's
question, not the guard's.
