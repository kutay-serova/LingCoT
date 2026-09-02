/* =============================================================================
   _source.js, one place that knows where the source lives
   =============================================================================
   Twenty-seven guards each computed `path.join(__dirname, '.', '.', 'source')`
   and read the same files themselves. Two costs, both paid:

     · Moving the guards into dev/tests/ broke 26 path anchors at once, and the
       fix was 26 identical edits. The next move will do it again.
     · LingCoT.html is 448 KB and was read ~15 times per suite run.

   Guards should require ROOT/SRC and the readers from here rather than deriving
   paths themselves. Memoised, so the suite reads each file once.

   Deliberately NOT a test framework. It resolves paths and caches file contents;
   every guard keeps its own assertions and its own reasoning, because that is
   where the value is.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC  = path.join(ROOT, 'source');
const DEV  = path.join(ROOT, 'dev');

const _cache = new Map();

/* @fn read, file contents relative to source/, memoised.
   Throws on a missing file rather than returning '': a guard that silently
   scans an empty string reports success having checked nothing, which is the
   failure this project has hit fourteen times. */
function read(rel) {
  const p = path.join(SRC, rel);
  if (!_cache.has(p)) {
    if (!fs.existsSync(p)) throw new Error(`_source.read: no such file ${rel} (looked in ${SRC})`);
    _cache.set(p, fs.readFileSync(p, 'utf8'));
  }
  return _cache.get(p);
}

/* @fn readRoot, same, but relative to the repository root (README.md, etc.). */
function readRoot(rel) {
  const p = path.join(ROOT, rel);
  if (!_cache.has(p)) {
    if (!fs.existsSync(p)) throw new Error(`_source.readRoot: no such file ${rel}`);
    _cache.set(p, fs.readFileSync(p, 'utf8'));
  }
  return _cache.get(p);
}

/* @fn moduleFiles, every JS module, as [name, contents]. Several guards sweep
   these; doing it here means a new module is picked up without touching them. */
function moduleFiles() {
  return fs.readdirSync(path.join(SRC, 'modules'))
           .filter(f => f.endsWith('.js'))
           .map(f => [f, read(path.join('modules', f))]);
}

/* Lazy accessors for the files read most often. */
const lazy = {};
for (const [name, rel] of [
  ['html', 'LingCoT.html'], ['css', 'LingCoT.css'], ['pyw', 'LingCoT.pyw'],
  ['events', 'modules/events.js'], ['participants', 'modules/participants.js'],
  ['search', 'modules/search.js'],
  ['languageMaps', 'modules/language_maps.js'],
]) {
  Object.defineProperty(lazy, name, { get: () => read(rel), enumerable: true });
}

/* @fn locale, en.json, parsed. */
function locale() { return JSON.parse(read(path.join('resources', 'locale', 'en.json'))); }

/* @fn decomment, strip comments and docstrings before scanning for CODE.
   Lives here because three guards need it and one of them (workspace_test) was
   written twice: guards in this project have repeatedly matched their own
   explanatory prose and passed for the wrong reason. */
function decomment(s, python = false) {
  let out = s.replace(/"""[\s\S]*?"""/g, ' ').replace(/'''[\s\S]*?'''/g, ' ')
             .replace(/\/\*[\s\S]*?\*\//g, ' ');
  return out.split('\n')
            .map(l => (python ? l.replace(/#.*$/, '') : l.replace(/\/\/.*$/, '')))
            .join('\n');
}

/* @fn _bodyStart, the index of the `{` that opens a function BODY at `from`.
   Not simply the next `{`: a default parameter (`function f(a, opts = {})`)
   puts a balanced pair in the signature, and a naive brace walk closes on it
   and returns a 41-character "function". Four guards carried that bug and one
   of them reported success on a truncated slice. Walk the parameter list to
   its matching `)` first. */
function _bodyStart(src, from) {
  const open = src.indexOf('(', from);
  if (open === -1) return src.indexOf('{', from);
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '(') depth++;
    else if (src[k] === ')' && --depth === 0) return src.indexOf('{', k);
  }
  return -1;
}

/* @fn bodyOf, the brace-matched body of a function starting at `from`. */
function bodyOf(src, from) {
  let depth = 0;
  const start = _bodyStart(src, from);
  if (start === -1) return '';
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(from, k + 1);
  }
  return '';
}

/* @fn fnSrc, one named function's full source out of a file.
   Five guards each wrote this loop; they now share one, which is also the only
   copy that has to get the default-parameter case right. Throws rather than
   returning empty: a guard that silently checks nothing is worse than one that
   fails. */
function fnSrc(file, name) {
  const src = read(file);
  const i = src.indexOf(`function ${name}(`);
  if (i === -1) throw new Error(`${name} not found in ${file}`);
  const body = bodyOf(src, i);
  if (!body) throw new Error(`${name} unterminated in ${file}`);
  return body;
}

/* ── What a CLONE has, which is not what this machine has ────────────────────
   Added v3.14.135 after running the suite against a simulated clone: four
   guards failed, and every failure was the guard's fault. Two asked whether a
   gitignored path existed (it cannot), and two needed dev/archive/, which is
   103 MB of pre-edit snapshots and is deliberately not distributed.

   A guard must hold on a fresh clone or say plainly that it cannot. Failing
   because the repository is correct is worse than not running: it teaches a new
   contributor that red is normal. */

const _GITIGNORE = (() => {
  try { return fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'); }
  catch { return ''; }
})();

/* @fn ignoredDirs, directory patterns .gitignore excludes (trailing slash). */
function ignoredDirs() {
  return _GITIGNORE.split('\n')
    .map(l => l.split('#')[0].trim())
    .filter(l => l && l.endsWith('/') && !l.startsWith('!'));
}

/* @fn isGitignored, would a clone be missing this repo-relative path?
   Directory patterns only, plus the file globs that matter to the guards. Note
   git does not track empty directories either, so a directory whose only
   contents are ignored is absent from a clone as surely as an ignored one. */
function isGitignored(rel) {
  const r = rel.replace(/^\.\//, '').replace(/\/$/, '');
  return ignoredDirs().some(d => r === d.slice(0, -1) || r.startsWith(d))
      || /\.(pyc|pyo|log|cursor)$/.test(r)
      || /(^|\/)(\.venv|__pycache__|\.DS_Store)(\/|$)/.test(r);
}

/* @fn archiveAvailable, is dev/archive/ present?
   False on any clone. A guard that needs it must exit 2 (DISABLED), never 0:
   the suite's whole value is that green means checked. */
function archiveAvailable() {
  return fs.existsSync(path.join(DEV, 'archive', 'changes'));
}

/* @fn disabled, print why and exit 2. One wording, so run_all.sh's DISABLED
   line reads the same whatever the missing input is. */
function disabled(what, why) {
  console.log(`\n  DISABLED: ${what}`);
  console.log(`            ${why}`);
  process.exit(2);
}

module.exports = { ROOT, SRC, DEV, read, readRoot, moduleFiles, locale, decomment,
                   bodyOf, fnSrc, lazy, ignoredDirs, isGitignored, archiveAvailable, disabled };
