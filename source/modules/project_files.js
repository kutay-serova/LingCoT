/* =============================================================================
   project_files.js, the one place that knows what a project's files are called
   =============================================================================
   B-149 and B-150 (v3.14.289). A project is four files sharing a prefix:

       <prefix>_corpus.jsonl
       <prefix>_dictionary.jsonl
       <prefix>_participants.jsonl
       <prefix>.journal.jsonl

   That convention was spelled out in SIX places before this file existed —
   `setup_corpus_dir` and `open_project` on the Python side, `loadParticipants`,
   `journalPath` and the three save dialogs on this one — and no two of them
   agreed about every case. The dialogs offered `chinese-test_corpus_participants
   .jsonl` for a project opened from disk and `dictionary.jsonl` for a dictionary
   built in the app, and `journalPath` wrote `X.jsonl.journal.jsonl` where the
   reader looked for `X.journal.jsonl`. None of those was a typo: each was a
   correct-looking guess made where the convention was not written down.

   THE CONTRACT
     A PREFIX is the shared stem. It never carries a role suffix and never an
     extension. `S._corpusFilename` and `S._dictFilename` hold a prefix, which
     is a change from v3.14.288 and earlier, where `applyCorpus` stored the full
     basename (`chinese-test_corpus`) and `newCorpus` stored a bare slug
     (`chinese_test`) — one variable meaning two things, which is why the corpus
     dialog and the participants dialog were each correct exactly when the other
     was wrong.

     Everything else is derived. Nothing outside this file may write a role
     suffix or `.jsonl` into a name; `project_files_test.js` holds that, and
     holds this table against the Python one, because the convention crosses a
     language boundary and neither side can check the other by itself.
   ============================================================================= */

/* Role → suffix. The Python side carries the same table in `_PROJECT_ROLES`;
   the guard compares them literally. Order matters for `projectPrefix`: the
   longest match must be tried first, or `_corpus` inside `_corpusx` would win. */
const PROJECT_ROLES = {
  corpus:       '_corpus.jsonl',
  dictionary:   '_dictionary.jsonl',
  participants: '_participants.jsonl',
  journal:      '.journal.jsonl',
};

/* The stem for a project that has not been named yet. NOT 'corpus': a fallback
   that is itself a role name produces `corpus_corpus.jsonl`, which is the shape
   `participants_participants.jsonl` had and the tell that a default had been
   pressed into service as a name. */
const UNTITLED_PREFIX = 'untitled';

/* @fn projectFile, the filename for one role of one project. */
function projectFile(prefix, role) {
  const suffix = PROJECT_ROLES[role];
  if (!suffix) throw new Error(`projectFile: unknown role ${role}`);
  return String(prefix || UNTITLED_PREFIX) + suffix;
}

/* @fn projectPrefix, the shared stem, from any of the project's own filenames.

   Accepts a bare name or a full path and returns the stem only, so a caller can
   hand it whatever it happens to be holding. A name carrying no role suffix
   loses its extension and is used as-is, which is what `open_project` does and
   is how a file named by hand still opens. */
function projectPrefix(nameOrPath) {
  const base = String(nameOrPath || '').replace(/\\/g, '/').split('/').pop();
  for (const role of Object.keys(PROJECT_ROLES)) {
    const suffix = PROJECT_ROLES[role];
    if (base.length > suffix.length && base.endsWith(suffix))
      return base.slice(0, -suffix.length);
  }
  return base.replace(/\.jsonl?$/i, '');
}

/* @fn projectSibling, one project file's path given another's.
   Folder and prefix both come from the path handed in, so a project that lives
   anywhere keeps its four files together. */
function projectSibling(absPath, role) {
  const parts  = String(absPath || '').replace(/\\/g, '/').split('/');
  const fname  = parts.pop();
  const folder = parts.join('/');
  const name   = projectFile(projectPrefix(fname), role);
  return folder ? folder + '/' + name : name;
}

/* @fn projectRole, which of the four a filename is, or null.

   B-184. The counterpart of `projectFile`: that one builds a name from a role,
   this one reads the role back out. It belongs here because this module is the
   one place the four suffixes are written down, and a loader that matched them
   itself would be the second writer of that list.

   Longest suffix first. `_corpus.jsonl` and `.journal.jsonl` cannot collide, but
   a role added later might, and "the first one that matched" is not a rule. */
function projectRole(nameOrPath) {
  const base = String(nameOrPath || '').replace(/\\/g, '/').split('/').pop();
  const roles = Object.keys(PROJECT_ROLES)
    .sort((a, b) => PROJECT_ROLES[b].length - PROJECT_ROLES[a].length);
  for (const role of roles) {
    const suffix = PROJECT_ROLES[role];
    if (base.length > suffix.length && base.endsWith(suffix)) return role;
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { PROJECT_ROLES, UNTITLED_PREFIX, projectFile, projectPrefix,
                     projectSibling, projectRole };
