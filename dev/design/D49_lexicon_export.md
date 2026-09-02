# D49: Machine-parseable lexicon export · GATED behind D35 stage B and B-106
**Updated:** 2026-08-30 · **Version:** v3.14.274

*Moved out of `DEV_PLAN.md` §2 at v3.14.274, verbatim. The plan carries the
row and the decision; this file carries the reasoning. FROZEN: stamped with the
version it was written against, not bumped with the build.*

---

**Decided 2026-08-29** (see `dev/design/file_layout_options.md` §4). The
dictionary export modal already exists and already collects everything a data
export needs — the B-084 type filter, a sort key, per-field selection, the entry
set, and corpus-pinned example sentences. It writes PDF only, through
`export_dict_pdf` in `source/scripts/dict_export.py`. The work is a format
selector plus a second writer behind the same options object, which is why this
is small.

**One-way by design.** The export is for other tools, not for importing into
another corpus. Portability and interchange are different problems and only
interchange has the identity problem; attempting it would buy a silent
wrong-link mode in exchange for saving some retyping.

**Named targets:** FLEx, ELAN, Praat. Timestamp handling for the last two is a
discussion of its own and does not block the format choice.

**Two decisions deliberately left open**, to be taken when the writer is built:

| | |
|---|---|
| format | TSV plus a JSON sidecar, CLDF, LIFT, or plain JSON. Not chosen |
| attribution | interning made the dictionary PI-free — of a file the app *writes*, only since **B-129** ✅ v3.14.244, which is when `thinProv` started running in the serializer as well as at load; before that any object a session touched was written with the display name inline. A writer that re-expands `annotator_id` into a display name would undo that on the one surface meant for sharing. This is a publication decision, not a formatting one |

**Why it is gated.** The dictionary is two-level and the linkage is incomplete.
Re-measured on the live dictionary 2026-08-30, after B-119 settled the
discriminator on `record_type`: 33 `record_type: "lemma"` headwords, 52 sense
entries, **14 of 52** carrying `lemma_id` — so 38 senses have no lemma and 19
lemmas have no members. The 2026-08-29 figures were 29 / 46 / 14; annotation
since has widened the gap rather than closed it. Exporting now flattens a hierarchy that is already
broken and publishes the flattening as the model. D35 stage B (B5 especially,
the lemma group view) and **B-106** come first.

**Not scheduled, noted for later:** a *seed import* that reads an exported
lexicon and creates new entries, never linking to foreign ids. It claims no
identity, so it cannot produce a wrong link; it only saves retyping. Worth
building only if lexicon reuse turns out to be real.

**Size: S**, once the gate opens.
