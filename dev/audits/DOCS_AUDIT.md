# Documentation Audit
**Updated:** 2026-08-25 · **Version:** v3.14.100  
*Frozen. The version is the build this was written against, not the current one.*

**Opened:** 2026-08-25 against v3.14.94 · **Closed:** 2026-08-25 at v3.14.100
**Status: all six findings resolved.** This is now a record of what was wrong and
what was done, not a list of work outstanding.
**Scope:** every document a user or maintainer reads. Not `BUGS.md`, `DEV_PLAN.md`
or `edit_log.md`, those are current by construction and guarded by
`doc_integrity_test.js`.

---

## Outcome

| § | finding | outcome |
|---|---|---|
| 1 | README File Structure described a layout that did not exist | **fixed v3.14.96**, pinned by `readme_tree_test.js` |
| 2 | Five shipped features undocumented | **fixed v3.14.98** |
| 3 | Search chapters documented a deleted engine | **rewritten from `search_b.js`, v3.14.98.** 12 claims verified against source |
| 4 | `setup.md` had two wrong examples | **fixed v3.14.99.** and the examples were right about the code, which was wrong (**B-041**) |
| 5 | In-app help said nothing about the workspace | **rewritten and localised v3.14.95.** and my measurement of it was wrong; see below |
| 6 | Five audits described finished work with no marker | **status lines added v3.14.100** |

**Three bugs were found by auditing the documentation**, which was not the point
of the exercise: **B-038** (the search screen's help had been unreachable since
Search-A was retired), **B-039** (the help button floated over open menus), and
**B-041** (the CLI still wrote corpora into the repository, and with a filename
the app could not pair). Prose is a place bugs hide, because nothing runs it.

## What exists now

| file | size | verdict |
|---|---|---|
| `README.md` | 32 KB | Current. Tree guarded; Search written from the engine |
| `setup.md` | 8.0 KB | Current. Workspace, PDF tier, corrected examples |
| **in-app help** (locale) | 8.1 KB, 57 keys | Current. 22 views, translatable, guarded by `help_coverage_test.js` |
| `samples/README.md` | 4.0 KB | Current |
| `~/LingCoT/README.txt` | 425 B | Current |
| `dev/archive/README.md` | 4.0 KB | Current |
| `LICENSE.txt` | 4.0 KB | MIT, unchanged |
| `dev/audits/` × 7 | 80 KB | Each now states whether it is implemented, still open, or moot |

**Only `DICT_SENSE_AUDIT.md` remains an open finding.** it is DEV_PLAN §2 D28,
audit complete and not scheduled.

---

## 1. ~~The File Structure section describes a layout that no longer exists~~ · **fixed v3.14.96**

Rewritten from the real tree and pinned by `readme_tree_test.js`, which walks the
drawn tree and requires every path in it to exist. Original finding below.

Seven paths are listed at the repository root that actually live under `source/`:

| README says | reality |
|---|---|
| `LingCoT.html`, `LingCoT.pyw` | `source/` |
| `build_env.py`, `setup.py` | `source/` |
| `annotator_config.json` | `source/config/` |
| `scripts/` | `source/scripts/` |
| `data/language_codes.json` | `source/resources/language_codes.json`, **`data/` does not exist** |
| `scripts/lang_utils.py` | `source/resources/lang_utils.py` |

Absent entirely: `source/modules/` (five JS modules, ~360 KB, where most of the
app now lives), `LingCoT.css`, `log_setup.py`, `version.py`, `workspace.py`,
`resources/locale/`, `samples/`, `dev/`.

This is the section a new contributor reads first, and following it leads nowhere.

## 2. ~~Whole shipped features are undocumented~~ · **fixed v3.14.98**

Dependency parsing, selection relations, next/previous traversal and dictionary
senses now have sections; Search-B is documented in the rewritten Search chapters.

Searched the README for each; these return nothing:

| feature | shipped | README |
|---|---|---|
| **Search-B.** concordance, KWIC, frequency, collocates, sort-by-context | v3.14.15–38 | **absent** |
| **Dependency parse** (D25 P1/P2), head/dep_rel, arc diagram | v3.14.48+ | **absent** |
| **Selection relations** (D27 P1–P4) | v3.14.57 | **absent** |
| **Next/previous traversal** (D30) | v3.14.75 | **absent** |
| **Dictionary senses.** semantic domain, pinned examples, alternate forms (D23) | v3.14.44–47 | **absent** |

The words "dependency" and "selection" do appear, meaning Python packages and
the annotator picker. Nothing about the linguistic features of those names.

## 3. ~~The Search chapters may document a deleted engine~~ · **fixed v3.14.98**

Rewritten from `search_b.js` rather than patched, with twelve factual claims
verified against the source. Original finding below.

`## 8. Search` and `## Complex Search` (~90 lines) describe glob wildcards,
optional-segment `()`, Level/Field selectors and a Regex toggle. **Search-A was
deleted in v3.14.74**, 14 unreachable functions, 45 KB. Search-B replaced it.

The described *syntax* may well still be accurate, since Search-B was built to
parity (`search_parity_test.js`, 1715 comparisons), but the described **UI** is
Search-A's, and no one has checked these chapters against what the app now shows.
Until someone does, treat this section as unverified rather than wrong.

## 4. ~~`setup.md` has two wrong examples~~ · **fixed v3.14.99**

They were not stale. They documented real behaviour, and the behaviour was the
bug (B-041). Fixed in the code first, then the file. Original finding below.

Otherwise it is in better shape than the README, script paths are correct and it
describes `setup.py` accurately as the NLLB downloader. But:

```
.venv/bin/python3 source/scripts/corpus_annotate.py corpora/my_title/corpus.jsonl
```

Wrong twice: corpora live in `~/LingCoT/corpora/` since v3.14.77, and the file is
`my_title_corpus.jsonl`, not `corpus.jsonl`. Anyone copying this line gets a file
-not-found and no hint why.

It also never mentions the workspace, which is now the first thing to understand.

## 5. ~~The in-app help is the thinnest thing we have~~ · **corrected, then fixed**

**This finding was measured wrongly.** It counted the `help.*` keys in `en.json`
(11 keys, 1,555 chars) and missed `_HELP_CONTENT` in `events.js`, a **17 KB**
hardcoded object covering 20 views. The help was ten times larger than reported.

The *recommendation* held up: it said nothing about where data lives, which is
enforced by code and the subject of five versions of work, and the help panel is
where a stuck user looks.

**Fixed in v3.14.95**, and the investigation found two defects the audit had not:

- **B-038.** the search screen's help was keyed `search` while the view is
  `search-b`, unreachable since Search-A was retired. `annotators` and `sources`
  had none at all.
- **B-039.** `#help-btn` at `z-index: 400` floated in front of the File dropdown
  and every modal backdrop (300).

Help now lives in the locale files (`help.view.<view>.{title,body}`), rewritten
17,136 → 6,421 chars, and `help_coverage_test.js` pairs the keys against
`VIEW_RENDERERS` in both directions.

**Lesson worth keeping:** the audit measured the artefact it could find by name
rather than the one the user sees. Same shape as the guards that check what they
already know about.

## 6. ~~Five of six audits describe completed work~~ · **fixed v3.14.100**

Each of the six now opens with a status block (this audit makes seven):

| audit | status |
|---|---|
| `ANNOTATION_UX_AUDIT.md` | ✅ implemented. S1–S4 shipped as G33 |
| `DATA_MODEL_AUDIT.md` | ✅ implemented. G28–G34 shipped |
| `GUI_DESIGN_AUDIT.md` | ✅ mostly. S1–S6 shipped; **F1/F6/F9 are moot**, they analyse Search-A code deleted in v3.14.74 |
| `SEARCH_B_DESIGN.md` | ✅ built. F1–F7 shipped v3.14.15–38; kept as the spec of record |
| `DICT_SENSE_AUDIT.md` | ◻ **still open.** DEV_PLAN §2 D28 |
| `PIPELINE_AUDIT.md` | partly, §4 shipped; git and the version string were §1–§3, and the version string shipped in v3.14.88 |

The distinction that mattered was **implemented** versus **moot**: a finding whose
code has since been deleted is not fixed, and sending someone to read
`modules/search.js` for F6 wastes their afternoon.

## What was recommended, and what happened

All five, in the order proposed:

1. ~~File Structure~~ ✅ v3.14.96, and guarded, because it had rotted through two
   restructures unnoticed.
2. ~~In-app help on the workspace~~ ✅ v3.14.95, rewritten 17,136 → 6,421 chars
   and moved into the locale files, which also unblocked D24.
3. ~~Read the Search chapters against the running app~~ ✅ v3.14.98, done by
   reading `search_b.js` instead, which was cheaper and more reliable.
4. ~~Status lines on the stale audits~~ ✅ v3.14.100.
5. ~~Document the five missing features~~ ✅ v3.14.98.

**"Do not rewrite the README wholesale" held up.** Its schema, glossing-conventions
and language-code chapters needed no work; the damage was localised to three
sections, and treating it that way took hours rather than days.

## What this audit got wrong

Worth recording, since the same mistake is available next time.

**§5 measured the wrong artefact.** It reported the in-app help as "the thinnest
thing we have. 11 keys, 1,555 characters", having counted the `help.*` keys in
`en.json` and missed `_HELP_CONTENT` in `events.js`, a 17 KB hardcoded object
covering 20 views. The help was **ten times larger** than reported.

The recommendation survived because it rested on something else, the help said
nothing about where data lives, which was true, but the measurement was wrong, and
it was wrong in the project's characteristic way: **it counted the thing findable
by name rather than the thing the user sees.** That is the same failure as a guard
checking only what it already knows about.
