# D52 — Merging two dictionary entries
**Updated:** 2026-08-31 · **Version:** v3.14.288

Status: **A–C built at v3.14.291.** Opened by **B-155**, reported from annotation
("two 的 lemmas I can't fuse"). Stage D is queue step 4, B-154's repair.

| Stage | What | State |
|---|---|---|
| A | `repointDictEntryRefs` / `_rewriteDictEntryRefs`, one walker with the clear | ✅ v3.14.291 |
| B | `mergeDictEntries(survivorId, mergedId)`, `mergeProvTrails` | ✅ v3.14.291 |
| C | "Merge into…" on an entry with a same-form sibling | ✅ v3.14.291 |
| D | `danglingLemmas` / `repairDanglingLemma`, and the repair strip | ✅ v3.14.292 |

**What B-143 turned out not to be.** This document said stage C needed B-143
because the picker would draw identical rows. B-143 was real and is fixed, but
the reported 的 pair was numbered all along — both were created in-session, so
`_indexDictEntry` numbered them. Checking the file rather than the reasoning is
what found that.

## The problem

`chinese-test` holds two `dict_entry` rows for 的, identical in form, `type`,
`part_of_speech` and `gloss`, both on lemma `dict_1788136185228_lzudu`. There is
no operation that makes them one. `deleteDictEntry` **clears** the references it
counts — tokens lose their `dict_id`, entries lose their `lemma_id` — so the
choice today is two duplicates, or one entry and orphaned tokens.

`clearDictEntryRefs` predicted this in comment: *"re-pointing is a merge, which
belongs with the homograph work (D35), not on a delete button."* D35 closed at
v3.14.282 without it.

## Stage A · repoint — built

`dictEntryRefs(id)` already returns exactly the four reference kinds a merge has
to move — `words` (`dict_id`), `morphemes` (`m.dict_id`), `lemmaWords`
(`lemma_id`), `entries` (citing entries' `lemma_id`). The repoint is
`clearDictEntryRefs`'s body with an assignment where the `delete` is, and
`_setWordLemma` for the lemma side so `corpusLemmaRefs` is patched rather than
left stale.

**One writer.** `clearDictEntryRefs` and `repointDictEntryRefs` differ only in
the destination — `null` against an id. Written as two functions over one
walker, or the clear becomes a second opinion about what a reference is.

## Stage B · merge — built

`mergeDictEntries(survivorId, mergedId)`:

1. Fill the survivor's **empty** fields from the merged one. Never overwrite —
   the same fill-only rule `createEntries` and the push already keep, for the
   same reason: a stored value is somebody's, and a merge is not the moment to
   discard it.
2. Repoint every reference (stage A).
3. Carry `prov_history`, so the merged entry's revision trail is not lost with
   the row. `appendProv`/`carryProv` is the one rule for extending a trail.
4. Delete the merged record, and re-run `assignHomographs(form)` — the bucket
   just lost a member and may now hold one.

**Refuses** a merge of two entries with different `type` values without the
annotator saying so: `metin` as `word` and as `bound.morpheme` is a genuine pair,
not a duplicate, and that is the case `samples/` actually carries. Different
FORMS are refused outright — that is not a merge whatever was clicked.

**A move is not a link, and `linkTo` says so.** The repoint changes a token's
`dict_id` and leaves its stamp alone, through a `moveFrom` mode inside `linkTo`
itself rather than a second writer beside it. `dict_id` is still assigned in
exactly one function, which is the property `autolink_test.js` holds and the one
worth keeping; restamping would record whoever pressed Merge as the author of a
link the annotator made — B-121's damage in the other direction, and
unrepairable the same way. `moveFrom` must name the id being replaced, so a move
cannot become a blind unstamped write.

## Stage C · the surface — built

The duplicate-form report already lists same-form entries together and is where
the annotator is looking when they notice. Merge is offered there, not on the
entry page: a merge needs two entries on screen and the entry page has one.

Built as a `<select>` on the entry page, between Edit and Delete, drawn only
where `homographSiblings` finds a sibling: an operation offered where it cannot
be performed teaches the annotator to ignore the control. Options carry the
sibling's number, type and gloss.

Direction is "merge THIS into that" — the entry on screen disappears — because
it reads the way the delete beside it does, and the entry on screen is the one
the annotator has decided about.

Confirm names what moves, the shape `deleteDictEntry`'s confirm already uses, and
a type mismatch asks a second time before it.

## Stage D · the dangling case (B-154) — built

Built as the opposite of the repoint. A reference whose target is gone could be
repointed at a record the annotator names, or cleared — but both throw away what
the references are *evidence of*: somebody put these forms on one lemma. So the
record is put back instead, under the id that is already cited, which is what
makes every reference resolve the moment it exists.

The citation form is the app's guess — an entry's form before a token's, because
an entry is a lexeme and a token is an inflected occurrence of one — and the
record is stamped **derived**, because the app named it and the annotator did
not. The confirm says both, and the record is editable afterwards.

`danglingCompanions` had counted these since D50 3d and nothing could act on one.
The repair strip is drawn on the dictionary browse, and only when there is
something to repair.

## What this must not break

- **Fill-only.** No stored value is overwritten by a merge, ever.
- **Ids never change** (`:179`). The survivor keeps its id; the merged id is
  gone, not reassigned.
- **`dictFileItems()` stays the one writer** of the dictionary file.
- The reference count before and after is equal — nothing is dropped in transit.
  That is the guard's central assertion.
