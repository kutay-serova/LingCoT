# LingCoT: GUI Design Audit (B3)
**Updated:** 2026-08-25 · **Version:** v3.14.34  
*Frozen. The version is the build this was written against, not the current one.*

> ### ✅ Mostly implemented, status added 2026-08-25
> **S1 shipped** (`--content-max` + `viewHeader()`, v3.14.34); **S2–S6 shipped**
> 2026-06-20/21.
>
> **Some findings are now moot rather than fixed.** F1, F6 and F9 concern
> Search-A. Its two-button header, its 21-block help wall, its toggle idioms.
> **Search-A was deleted in v3.14.74** (14 unreachable functions, 45 KB), so the
> code they analyse no longer exists. Do not go looking for it.

**Date:** 2026-06-13 · **Status:** audit + ranked proposals (no code change). For DEV_PLAN §B3.
**Method:** read of the 23 `VIEW_RENDERERS` surfaces, the header/nav markup, and `LingCoT.css` (layout, button/chip families, widths, palette). Lenses, per the B3 brief: **intuitiveness · navigation · crowdedness · sleekness/consistency · colour palette · general appearance.**
**Scale reminder:** corpora are tiny (korean-test = 12 sentences / ~200 words). None of this is a performance problem, it's polish + coherence.

---

## 0. What's already working (keep)

- **One readable column.** `#content` is centred at `max-width: 860px` with generous padding, the core reading/annotation surface is calm and legible.
- **Consistent provenance + IGT vocabulary.** Form/gloss/translit tiers, prov badges, and field-prov hints are visually consistent across views.
- **The token-vs-lexicon split is now coherent** (post G33/S3): one Annotate surface, a labelled "+ Lexicon", tooltips + hint.
- **A real design token system.** After B1 the palette is fully tokenised with light/dark parity, a strong foundation to standardise against.
- **Phosphor icon sprite** gives a consistent icon language in buttons.

---

## 1. Findings

### Intuitiveness
- **F1. Two "Search" buttons in the header.** `#search-btn` (Search) and `#search-b-btn` (Search-B, beta) sit side by side. Transitional, but right now a user sees two near-identical magnifier buttons and can't tell which to use. *Resolves itself at F7 (Search-A retires); until then it's the single most confusing header element.*
- **F2. Back-button + breadcrumb redundancy.** Most views render both an in-view `.back-btn` ("← Sentence") **and** the header `#breadcrumb` path. Two back affordances for the same hierarchy; the relationship (one-level-up vs full-path) is never explained and they can disagree visually.
- **F3. Empty/zero states are thin.** `renderDict` "no entry" and similar states are a bare sentence. New users get little guidance on what to do next (vs. the rich Search-A help wall, see F6, the opposite problem).

### Navigation
- **F4. Inconsistent content widths jump between views.** `#content` 860px · `.srch-view` 900px · `.sb-view` **1100px**. Moving Corpus → Search → Search-B visibly reflows the page width, which reads as three different apps rather than three tabs of one.
- **F5. Header is doing a lot.** Title+subtitle, breadcrumb, dict-status pill, save-flash, Search, Search-B, Project▾, Save, separator, Open, New Corpus, plus the new fixed theme toggle bottom-right. On a narrow window the right-side button cluster (6 buttons) crowds the breadcrumb.

### Crowdedness
- **F6. The Search-A help wall.** `modules/search.js` renders **21** `.srch-help-card` blocks inline below the query, a large scroll of documentation competing with results. (Mooted when Search-A retires, but worth not reproducing in Search-B.)
- **F7. Dense stacked boxes in the sentence view.** `renderSentence` stacks Translations, Transliterations, Comments, Annotators, and the IGT each as its own labelled box; with everything populated the view becomes a tall ribbon of section labels. Spacing is fine; the *number* of always-expanded sections is the load.
- **F8. Button/chip style proliferation.** ~30 distinct button/chip classes (`edit-btn`, `btn-save`, `hdr-btn`, `sb-toggle`, `srch-toggle`, `sb-run`, `srch-go-btn`, `pos-chip`, `dict-type-chip`, `morph-chip`, `lp-chip`, `ann-chip`, `src-chip`, …). Many are near-duplicates with slightly different padding/radius, the main driver of "not quite sleek."

### Sleekness / consistency
- **F9. Three+ "toggle/chip" idioms for the same job.** Search-A `.srch-toggle`, Search-B `.sb-toggle`, and the shared `.pos-chip`/`chipRowHtml` all express "pick one of N" but look different. Same for "run search" buttons (`.sb-run` vs `.srch-go-btn`).
- **F10. Mixed corner radii / weights.** `--r` is 6px, but pills (chips) use 14–20px and various one-off radii appear inline. Font-weight 700 is used for emphasis in several spots where the rest of the app uses 500–600.
- **F11. Inline styles scattered in render strings.** Section boxes use `style="margin-top:12px"` etc. inline rather than classes, makes spacing inconsistent and hard to tune globally.

### Colour palette
- **F12. Palette is solid (post-B1); a few dead/ad-hoc spots remain.** `.es-pill-*` (retired Entry Sheet) is dead CSS. A handful of legend/IGT hues (`--trans-color` brown, translit greens) are close in hue and can read as "muddy" together on dark. Otherwise the warm-paper/ink system is coherent.
- **F13. Accent overload.** Slate-blue accent, purple dict-accent, amber edit, brown translation, plus red/green/blue status families, six+ semantic hues. Mostly justified, but the word view can show 4 at once (accent gloss, purple +Lexicon, amber edit, yellow highlight), which dilutes the "primary action" signal.

### General appearance
- **F14. Typographic scale is mostly ad-hoc.** Font sizes are set per-component (0.7–1.6rem) inline rather than from a small scale, so headings/labels across views don't align to shared sizes.
- **F15. The new theme toggle floats over content.** Fixed bottom-right; it can overlap the Search-B result-cap message and long tables' last row. Minor, but it's an un-docked control with no home in the header.

---

## 2. Recommendations (ranked: quick wins → larger)

**S1. Unify content width + a shared view shell. _(High value, low risk.)_ ✅ DONE v3.14.34.**
_Note on F4:_ on inspection the `.srch-view` 900 / `.sb-view` 1100 max-widths were **dead** (capped by `#content`'s 860), so there was no visible jump, the fix was tidying to one source. Implemented: `--content-max: 900px` token drives `#content`; dead per-view max-widths + bespoke padding removed so all views share one frame. For F2 (decision: **keep both, unify styling**): `viewHeader(attrs, label, extra)` is now the single definition of the in-view back/cancel row (18 sites converted, byte-identical output); the breadcrumb stays as the full-path navigator. _(Original suggestion of removing one affordance was not taken, user chose to keep both.)_

**S2. Consolidate the button/chip system. _(Highest sleekness payoff; medium effort.)_ → PLANNED (Option C), deferred to post-F7. Full plan in §4.**
Reduce ~30 button/chip classes to a small set. **Decision: Option C** (segmented controls for "pick one of N"), implemented **after F7** so the `.srch-*` half deletes itself. Detailed taxonomy, class mapping, and migration in §4.

**S3. Tame the header. _(Medium.)_**
After Search-A retires, the two search buttons collapse to one (F1). Consider moving Save/Open/New into the Project▾ menu (or a left "File" menu), leaving the header = title · breadcrumb · Search · Project. Dock the theme toggle into Project▾ or the header instead of floating it (F5/F15).

**S4. Collapse the dense stacks. _(Medium.)_**
In the sentence view, make Transliterations/Comments/Annotators collapsible (summary chip → expand) so the IGT + translation lead and the rest is opt-in (F7). Don't port the Search-A help wall to Search-B; replace with a single "?" popover (F6).

**S5. Typography + spacing scale. _(Low risk, ongoing.)_**
Define a 5-step type scale and 3 spacing tokens; replace inline `font-size`/`margin` in render strings with classes (F11/F14). Mechanical, improves alignment everywhere.

**S6. Palette polish. _(Low.)_**
Delete dead `.es-pill-*`; nudge the brown/green legend hues apart for dark mode; consider demoting one semantic hue so the primary action is unmistakable per view (F12/F13).

---

## 3. Recommendation / sequencing

Most of the *consistency* wins (S2, S3) are cheapest **after F7 retires Search-A**, because that deletes the largest pile of duplicate button/chip/help CSS for free, so the natural order is: **finish F7 → S1 (shared shell + width) → S2 (button/chip consolidation) → S3 (header) → S4/S5/S6 as polish.**

If only one thing is done now (before F7): **S1**. Unifying content width and the view-header shell removes the strongest "three different apps" impression at low risk.

Nothing here is broken; this is coherence and polish. The B1 token system is the right substrate to standardise onto. Most of S2/S5/S6 is "point existing components at shared tokens/classes," not redesign.

---

## 4. S2 implementation plan: Option C (segmented controls), post-F7

**Decision (2026-06-13):** visual direction = **Option C** (buttons stay close to current; the pervasive "pick one of N" rows become joined segmented controls). **Timing:** implement **after F7 retires Search-A**, which deletes every `.srch-*` class so only the `.sb-*`/core set needs migrating. Built on the B1 tokens (auto light/dark).

### 4.1 Target taxonomy (the whole system)
- **Buttons.** `.btn` base + modifiers: `.btn-primary` (accent fill + `--on-accent`), `.btn-ghost` (transparent, accent text), `.btn-danger` (red border/text. Dark overrides already exist), `.btn-sm` (compact), `.btn-icon` (square icon-only). Radius `--r`; weights 400/500 only (no 700).
- **Segmented control.** `.segmented` container + `.seg` items + `.seg-active`. For small fixed pick-one sets: Search-B Level / Field / Scope / Context / sort, and the result tabs (KWIC | Sentences | Frequency | Collocates). Container radius `--r`, inner segments divided by `--border`, active = `--accent` fill + `--on-accent`.
- **Chips.** keep `.chip` + `.chip-toggle` (+ active) for **large or expandable** pick sets where a segmented control won't fit: the POS picker (`chipRowHtml`, 18 + "…"), Leipzig picker, source pickers. Pill radius. `chipRowHtml` already generates these, just rename its classes.
- **Badges (non-interactive).** `.badge` (+ semantic modifiers) for prov badges, dict-morph badges, dict-status pill. Not buttons; split out so they stop borrowing chip styles.

### 4.2 Class mapping (current → new)
| Current | New |
|---|---|
| `.btn-save`, `.sb-run`, ~~`.srch-go-btn`~~, `.xlate-modal-save`, `.companion-btn-load` | `.btn.btn-primary` |
| `.edit-btn`, `.hdr-btn`, `.latex-btn`, `.translate-btn`, `.companion-btn-skip`, `.help-faq-btn`, `.*-add-btn` | `.btn` / `.btn-ghost` |
| `.dict-delete-btn`, `.sec-del-btn` | `.btn.btn-danger` |
| `.leipzig-btn`, `.es-expand-btn`, `.sec-arr-btn`, `.sec-go-btn`, `.sec-merge-btn`, `.latex-copy-btn`, `.ann-clear-btn` | `.btn.btn-sm` / `.btn-icon` |
| `.sb-toggle`, ~~`.srch-toggle`~~, `.dict-type-chip` (filter row) | `.segmented`/`.seg` |
| `.sb-tab` (+ `.sb-tabs`) | `.segmented` (or `.tabs`/`.tab` underline, pick during build) |
| `.pos-chip`(+`-row`,`pc-active`), `.lp-chip`, `.morph-chip`, `.src-*-chip`, `.ann-chip` | `.chip` / `.chip-toggle` |
| `.prov-*`, `.dict-morph-badge`, `#dict-status` | `.badge` (+ modifier) |
| `.back-btn` | keep (it's the `viewHeader` nav element; optionally `.btn-ghost` styling) |
_(struck-through = `.srch-*`, gone at F7.)_

### 4.3 Migration (low-risk, staged)
1. **After F7.** Confirm `.srch-*` is deleted; re-count the remaining set.
2. **Add the new base classes** in CSS (additive, nothing renamed yet).
3. **Bridge:** group the surviving old selectors onto the new rules (e.g. `.btn-save, .sb-run { /* = .btn-primary */ }`) so the app looks identical while markup still uses old names, verify no visual change.
4. **Swap markup** in render strings + helpers: add a `segmentedRow(items, current, action)` helper (mirrors `chipRowHtml`); point Search-B's Level/Field/Scope/tabs at it; rename `chipRowHtml`'s output classes to `.chip-toggle`. Migrate buttons view-by-view.
5. **Delete** the old class rules once unreferenced; grep-verify zero stragglers.
6. **Verify:** a `dark_preview`-style gallery page (light + dark) for visual regression; `node --check`; suites.

### 4.4 Effort / risk
Medium. The risk is breadth (many render sites), not depth, each change is a class rename. The bridge step (3) makes it reversible at every point. Chips are already centralised in `chipRowHtml`, so the biggest set is one helper. Segmented controls are the only genuinely new CSS.
