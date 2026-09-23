## D40 stage A: find the sentences with the same text (2026-09-23)
**Version:** pending · **Type:** feature · **Archives:** `dev/archive/changes/d40a-index/` (v3.14.412)
**Touched:** source/LingCoT.html · dev/BUGS.md · dev/tests/sent_key_test.js (new) · dev/PRACTICES.md · dev/design/D40_repeat_reuse.md
**Change:** `d40a-index` · **Order:** 1

**What changed.** `sentKey(text)` folds a sentence to its runs of letters,
digits and combining marks, each through `normForm`. `sentTextIndex()` maps
that key to sentence ids across every document, and `sameTextSentences()`
reads it, from a stored sentence or a bare text. Built lazily on `_dataGen` and
a new `_foldGen`, which `refreshFoldContext` bumps; each sentence's key is
memoised against its text. Nothing is stored and nothing on screen changes yet.
B-210 filed.

**Why.** Stages B and C look up sentences by this key. The plan had the index
maintained by five save paths; a lazy cache has one writer and cannot drift.
D40 plan §3 A updated.

**Guard.** `sent_key_test.js`, 23 checks: what folds (case, punctuation,
spacing between tokens, Turkish i/ı) and what does not (a space inside a
token); a sentence never matches itself; B-057's two identical sentences are
two entries; the cache rebuilds on `_dataGen` and on `_foldGen` and not
otherwise. Four mutations, four failures. The fold-change one first escaped: a
lookup from one side passed against a stale index by coincidence, so the check
asks from both sides.

**Verification.** `./dev/tests/run_all.sh` — **94 passed, 0 failed, 0 disabled.**
