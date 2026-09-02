# D41: Reader Mode, the corpus read continuously rather than one sentence at a time
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Raised 2026-08-28.** Every view in the app is an *annotation* surface: it shows
one sentence, or one word, with its editors. There is no way to **read** a corpus.
Two modes are asked for, and they are different enough to build separately.

**A. Interlinear Mode.** The whole text as continuous IGT, with the tiers
toggleable, hover-highlighting for matching elements, and a click-popup showing
the fields the tiers do not.

**B. Column View.** Text in one column, translation in the other, aligned, with
the same hover-highlighting and popup.

**How much already exists, because it is more than it looks.**

| piece | where |
|---|---|
| the IGT renderer | the sentence view builds `.igt-word` columns with `data-wid` / `data-sid` and per-tier `field_prov` tooltips |
| a two-column source/translation layout | `renderParaBatch` already emits `.para-body` and `.para-body-trans` |
| sentence-level hover-highlighting | **already works.** `.s-span:hover, .s-span.hi` in the CSS, paired through `data-sid`, with `_sSpanCache` built lazily on first hover |
| lazy loading for long documents | `SECTION_PARA_BATCH = 30` paragraphs per batch |
| tier toggles | the sentence view's `showGloss` / `showTranslit` flags |

**So B is closer to a promotion than a build**: take the section view's existing
pairing, give it a reading layout without the annotation chrome, and add the
popup. **A is the larger half**, because per-word hover-highlighting needs an
identity rule and the IGT renderer has only ever run one sentence at a time.

**What each mode has to decide.**

- **What counts as "matching" for the highlight.** Same surface form, same
  `dict_id`, or same lemma? These give different answers on a homograph, which is
  **D35** again, and on a case variant, which `normForm` settles. Highlighting by
  form is cheapest and is a claim the data does not make; highlighting by
  `dict_id` is correct and only 10% of words carry one.
- **Read-only, or an entry point?** The click-popup showing "other fields" is one
  step from an editor. Keeping it read-only makes Reader Mode a safe surface to
  hand a consultant or a colleague; making it editable duplicates the word view.
  Read-only is the smaller promise and the one the name implies.
- **Scope: document or corpus?** D33 measured a 100k-word corpus at 23.5 MB and
  213 ms to parse; rendering that continuously is a different problem from
  rendering it in 30-paragraph batches. Document-scoped with the existing
  batching is the safe first version.
- **What the popup shows.** Everything the tiers omit is a long list: POS, lemma,
  dict link, morpheme breakdown, comments, per-field provenance, dependency
  relation. This is a density decision, and it overlaps **D31**.

**Two cheap wins fall out of it even if the modes are deferred.** The
`field_prov` tooltips already in the IGT make "who annotated this" readable
without a popup, and a read-only mode with no editors is the natural surface for
the **export preview** that LaTeX and PDF currently offer only as a file.

**Watch the render cache.** Any new view must appear in `VIEW_RENDERERS` and its
state must reach `_renderCacheKey`; tier toggles change what is on screen without
changing navigation state, which is precisely the B-008 / B-011 / B-019 family.
`render_cache_test.js` enforces it.

**Size: B is S–M, A is M–L. Prerequisite for the highlight rule: D35**, though a
form-based first version could ship before it if the highlight is presented as
"same spelling" rather than "same word". **D39** should settle Esc and the arrow
keys before a popup exists to trap them. Not scheduled.

---
