# D31: Ordering and prominence of multi-entry fields · REDUCED v3.14.273
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Most of this shipped without anyone marking it, and the rest has no data behind
it.** Measured 2026-08-30 across 561 annotatable objects in both corpora: **the
maximum length of any multi-entry list is 1.** Not one object carries two
transliterations, two translations, two comments, two variants, two allomorphs,
two constituent forms or two source ids. Every "which one comes first" question
here is currently unobservable.

**The storage half is done.** D31 refused to be an afternoon's work because
"order becomes stored data — provenance, migration". `assignList` (B-138,
v3.14.261) reconciles a rewritten list against the old one **by content, not
index**; its own comment says reordering costs nothing. So there is no migration
and no provenance work left.

**And it is smaller than it says.** Of its seven fields, only four are row
editors that a ▲▼ control could attach to — `transliterations`, `translations`,
`comments`, `allomorphs`. `constituent_forms` is a CSV text control and
`pinned_examples` is a bespoke surface.

**What survives: one ▲▼ control on one row editor, as a consumer of I2.**
Building it before I2 means writing the handler four times, which is I2's own
argument. The open question it still owns — **is position meaning, or is primacy
a flag?** — is worth answering once because **B-139** is decided by it for free.

---

## B-139, answered v3.14.372

It was, and the answer arrived from a direction this file did not expect.
**Position is meaning for exactly one of B-139's three fields, and there it means
the list is one value rather than three contributions**: `constituent_forms` is
read as `constituent_forms.join('-')` to seed a morphological parse.

For the other two, the deciding property turned out not to be order at all. It is
the **control**. B-138 stamps elements because a ROW EDITOR lets two people add
rows years apart; `variants` and `source_ids` are written whole — one CSV input,
one picker — so every element is one person's single act, and a per-element stamp
would record the same moment N times. No format change, no migration, no readers
to follow. **B-139's third option is right, and the ▲▼ control this file still
owns is unaffected**: it is for the row editors, which is where order can differ
from the order things were added in.

The premise — that the three are whole-value controls — is a fact about today's
app and not a rule, so it is asserted in `variation_fields_test.js` rather than
left in prose. Moving a list field to a row editor is one line, and it reopens
this.
