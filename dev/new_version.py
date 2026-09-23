#!/usr/bin/env python3
"""
new_version.py — start a version the way the conventions say, in one command.

    python3 dev/new_version.py b027_pos_values source/LingCoT.html source/scripts/dict_export.py
    python3 dev/new_version.py --type finding --examined "the exported ucak PDF"
    python3 dev/new_version.py --type decision --docs-only

ENTRY TYPES
    fix       closes a bug — put the B-nnn in the title
    feature   new capability
    finding   something learned by examining an artefact; no code diff.
              Requires --examined: the provenance. A finding whose basis is not
              recorded cannot be re-checked, and is then just an opinion.
    decision  a choice and its reasoning; binds future work
    chore     tooling, docs, archiving — no behaviour change

BRANCHES (v3.14.412)
    On main, a change gets its version number when it starts, as before.

    On any other branch the number is not assigned yet. The same command writes
    a change file, dev/changes/<slug>.md, holding the entry with
    `**Version:** pending`, archives the named files under the slug, and labels
    the build in source/version.py as `<base>+<slug>`. Commits on the branch
    carry `[<slug>]` (hooks/prepare-commit-msg). A change file is one batch of
    work, e.g. one D40 stage, not one commit.

        python3 dev/new_version.py d40a-index source/LingCoT.html   # on a branch
        python3 dev/new_version.py --add dev/BUGS.md                # grows the current change
        python3 dev/new_version.py --release                        # at the stage boundary
        python3 dev/new_version.py --relabel                        # after merging main in

    --release numbers every change file in the order it was started, prepends
    the entries to edit_log.md, stamps the docs once and moves each change file
    into its archive folder. Commit the result, then merge with --ff-only.
    A bug fixed on the branch goes in BUGS.md's Fixed table as fixed in
    `pending:<slug>`; --release writes the version there.

    Slugs on a branch are the build label, so they are short: lower case,
    digits, - and _, at most 16 characters.

    `finding` and `decision` imply --docs-only. A review that finds NOTHING is
    still worth an entry: "we looked at X and it was clean" is information, and
    its absence is why B-008 sat in a log unread for three months.

WHAT IT DOES
    1. Reads the current version from DEV_PLAN's header and bumps the patch.
    2. Creates dev/archive/changes/<slug>/ and copies every named file into it
       AS IT IS RIGHT NOW — before you edit. That ordering is the whole point.
    3. Prepends a stub entry to edit_log.md with the house headings and a
       **Touched:** line already filled in from the files you named.
    4. Updates DEV_PLAN's header to the new version.

WHY IT EXISTS
    Every part of this was already convention, and every part had been broken at
    least once by hand:
      · v3.14.83 edited three files and archived two — restoring it would have
        left JS referencing a locale key absent from en.json
      · the v3.14.76 tidy archived POST-edit copies, because the snapshot was
        taken after the work rather than before
      · the 2026-08-25 PDF review produced three findings and no entry at all
    doc_integrity_test.js now fails on the first two. This removes the chance to
    make them.

    Files that do not exist yet are recorded as `(new)` rather than skipped
    silently — a file left out looks identical to one forgotten, and telling
    those apart is the point of the completeness rule.
"""
import os
import re
import shutil
import subprocess
import sys
from datetime import date

TYPES = ('fix', 'feature', 'finding', 'decision', 'chore')

DEV = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DEV)
PLAN = os.path.join(DEV, 'DEV_PLAN.md')
BUGS = os.path.join(DEV, 'BUGS.md')
# The LIVE docs: every one carries an Updated/Version stamp and the bump owns it.
# Frozen documents (audits, dev/archive/) carry the version they were written
# against and are deliberately not touched here.
PRACTICES  = os.path.join(DEV, 'PRACTICES.md')
DEVREADME  = os.path.join(DEV, 'README.md')
# v3.14.229: two audits joined the live set. The unified audit is the audit of
# record and AUDIT_INDEX says which of the frozen ones are still true, so both
# are meant to be current rather than to record the build they were written
# against. Every other file under dev/audits/ stays frozen.
UNIFIED    = os.path.join(DEV, 'audits', 'UNIFIED_AUDIT.md')
AUDITINDEX = os.path.join(DEV, 'audits', 'AUDIT_INDEX.md')
RENAMES    = os.path.join(DEV, 'RENAMES.md')
LOG_HDR    = os.path.join(DEV, 'edit_log.md')
# v3.14.399, B-208. Four LIVE documents outside dev/ that this script never
# owned, so none of them carried a stamp at all — README.md and setup.md are the
# two a cloner reads first.
RDM_ROOT   = os.path.join(ROOT, 'README.md')
QUICKSTART = os.path.join(ROOT, 'QUICKSTART.md')
SETUP_MD   = os.path.join(ROOT, 'setup.md')
SAMPLES_RM = os.path.join(ROOT, 'samples', 'README.md')
LOG = os.path.join(DEV, 'edit_log.md')
VERSION_PY = os.path.join(ROOT, 'source', 'version.py')

# Change files for work on a branch; see BRANCHES in the docstring.
CHANGES = os.path.join(DEV, 'changes')
MAIN_BRANCHES = ('main', 'master')
LABEL_RE = re.compile(r'[a-z0-9][a-z0-9_-]{0,15}')
VERSION_LINE = re.compile(r'^(__version__\s*=\s*")([^"]*)(")', re.M)


def current_version() -> str:
    m = re.search(r'\*\*Version:\*\*\s*(v[\d.]+)', open(PLAN, encoding='utf-8').read())
    if not m:
        sys.exit('Could not read the version from DEV_PLAN.md')
    return m.group(1)


def bump(v: str) -> str:
    parts = v.lstrip('v').split('.')
    parts[-1] = str(int(parts[-1]) + 1)
    return 'v' + '.'.join(parts)


def git_branch():
    """Current branch name, or None outside git or on a detached HEAD."""
    try:
        out = subprocess.run(['git', '-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'],
                             capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    return None if out in ('', 'HEAD') else out


def read_version_py():
    """(number, label) from source/version.py; label is None on main."""
    m = VERSION_LINE.search(open(VERSION_PY, encoding='utf-8').read())
    if not m:
        return None, None
    num, _, label = m.group(2).partition('+')
    return num, (label or None)


def set_version_py(value):
    txt = open(VERSION_PY, encoding='utf-8').read()
    new = VERSION_LINE.sub(lambda m: m.group(1) + value + m.group(3), txt, count=1)
    if new == txt and f'"{value}"' not in txt:
        print('  !! could not set source/version.py — check it by hand')
        return
    open(VERSION_PY, 'w', encoding='utf-8').write(new)
    print(f'  source/version.py -> {value}')


def stamp_docs(old, new):
    """Move every live doc's Version/Updated header from old to new."""
    # BUGS.md carries the same stamp as DEV_PLAN. It was added by hand at
    # v3.14.133 and would have rotted by the next version if the bump did not
    # own it, which is the whole reason DEV_PLAN's is stamped here.
    # v3.14.389: RENAMES.md joined this list the version after it was created.
    # v3.14.399, B-208: README.md, setup.md, QUICKSTART.md and samples/README.md
    # carried no stamp at all. `doc_integrity_test.js` now asserts this list
    # against the tree instead of trusting anyone to remember.
    for label, doc in (('DEV_PLAN', PLAN), ('BUGS', BUGS),
                       ('PRACTICES', PRACTICES), ('dev/README', DEVREADME),
                       ('edit_log', LOG_HDR), ('RENAMES', RENAMES),
                       ('UNIFIED_AUDIT', UNIFIED), ('AUDIT_INDEX', AUDITINDEX),
                       ('README', RDM_ROOT), ('QUICKSTART', QUICKSTART),
                       ('setup.md', SETUP_MD), ('samples/README', SAMPLES_RM)):
        if not os.path.exists(doc):
            continue
        text = open(doc, encoding='utf-8').read()
        text = text.replace(f'**Version:** {old}', f'**Version:** {new}', 1)
        text = re.sub(r'\*\*Updated:\*\*\s*[\d-]+',
                      f'**Updated:** {date.today().isoformat()}', text, count=1)
        open(doc, 'w', encoding='utf-8').write(text)
        print(f'  {label} {old} -> {new}')


def entry_headings(entry_type):
    if entry_type == 'finding':
        return ("**What was examined.**\n\n**What was found.**\n\n"
                "**What follows.** (bugs filed, or explicitly nothing)\n")
    if entry_type == 'decision':
        return ("**The decision.**\n\n**Alternatives considered, and why not.**\n\n"
                "**What this binds.**\n")
    return ("**What changed.**\n\n**Why.**\n\n**Guard.**\n\n"
            "**Verification.** `./dev/tests/run_all.sh` —\n")


def change_files():
    """Open change files as dicts, in the order they were started."""
    out = []
    if not os.path.isdir(CHANGES):
        return out
    for name in os.listdir(CHANGES):
        if not name.endswith('.md') or name == 'README.md':
            continue
        path = os.path.join(CHANGES, name)
        text = open(path, encoding='utf-8').read()
        m = re.search(r'\*\*Order:\*\*\s*(\d+)', text)
        out.append({'slug': name[:-3], 'path': path, 'text': text,
                    'order': int(m.group(1)) if m else 0})
    return sorted(out, key=lambda c: c['order'])


def start_change(slug, entry_type, examined, files, docs_only):
    """Branch path: a change file instead of a version number."""
    if not LABEL_RE.fullmatch(slug):
        sys.exit(f'"{slug}": on a branch the slug is the build label — '
                 'lower case, digits, - and _, at most 16 characters (e.g. d40a-index)')
    base = current_version()
    frag = os.path.join(CHANGES, f'{slug}.md')
    arc_dir = os.path.join(DEV, 'archive', 'changes', slug)
    if os.path.exists(frag) or os.path.exists(arc_dir):
        sys.exit(f'{slug} is already in use — pick another slug, or --add to it.')

    touched = []
    if docs_only and not files:
        arc_ref = 'none — documentation only'
        touched_line = '— documentation only'
    else:
        os.makedirs(arc_dir)
        for f in files:
            src = os.path.join(ROOT, f)
            if not os.path.exists(src):
                touched.append(f'{f} (new)')
                continue
            name, ext = os.path.splitext(os.path.basename(f))
            shutil.copy2(src, os.path.join(arc_dir, f'{name}_pre_{slug}{ext}'))
            touched.append(f)
        arc_ref = f'`dev/archive/changes/{slug}/` ({base})'
        touched_line = ' · '.join(touched)
        print(f'  archived {len([t for t in touched if not t.endswith("(new)")])} file(s) -> {arc_dir}')

    order = max([c['order'] for c in change_files()] or [0]) + 1
    meta = f"**Version:** pending · **Type:** {entry_type} · **Archives:** {arc_ref}\n"
    meta += f"**Touched:** {touched_line}\n"
    meta += f"**Change:** `{slug}` · **Order:** {order}\n"
    if entry_type == 'finding':
        meta += f"**Examined:** {examined}\n**Filed:** \n"
    os.makedirs(CHANGES, exist_ok=True)
    with open(frag, 'w', encoding='utf-8') as fh:
        fh.write(f"## TITLE ({date.today().isoformat()})\n{meta}\n{entry_headings(entry_type)}")
    print(f'  wrote dev/changes/{slug}.md — replace TITLE and fill the headings')

    num, _ = read_version_py()
    set_version_py(f'{num or base.lstrip("v")}+{slug}')
    print(f'\n{slug} started on branch {git_branch()}. No version number until --release.')
    print('When done:  node dev/tests/doc_integrity_test.js')
    print('            ./dev/tests/run_all.sh')
    return 0


def relabel():
    """Point the build label at the newest change file, e.g. after merging main."""
    frags = change_files()
    num = current_version().lstrip('v')
    set_version_py(f'{num}+{frags[-1]["slug"]}' if frags else num)
    return 0


def release():
    """Number the open change files and write them into edit_log.md."""
    branch = git_branch()
    if branch in MAIN_BRANCHES:
        sys.exit('--release runs on the feature branch, before the fast-forward merge.')
    frags = change_files()
    if not frags:
        sys.exit('no change files in dev/changes/ — nothing to release')
    unfinished = [c['slug'] for c in frags if re.match(r'## TITLE\b', c['text'])]
    if unfinished:
        sys.exit(f'give these a title first: {", ".join(unfinished)}')

    old = current_version()
    new = old
    released = []
    for c in frags:
        new = bump(new)
        text = c['text'].replace('**Version:** pending', f'**Version:** {new}', 1)
        # The order only matters until the number is assigned.
        text = re.sub(r' · \*\*Order:\*\*\s*\d+', '', text, count=1)
        released.append((new, c, text.rstrip('\n') + '\n'))

    # Newest first, so the last change started sits at the top.
    log = open(LOG, encoding='utf-8').read()
    head_end = log.index('\n---\n') + len('\n---\n')
    block = ''.join(f'\n{text}\n---\n' for _, _, text in reversed(released))
    open(LOG, 'w', encoding='utf-8').write(log[:head_end] + block + log[head_end:])
    print(f'  edit_log: {len(released)} entr{"y" if len(released) == 1 else "ies"}, '
          f'{released[0][0]} to {new}')

    set_version_py(new.lstrip('v'))
    stamp_docs(old, new)

    # A bug fixed on the branch is listed in BUGS.md as fixed in `pending:<slug>`.
    if os.path.exists(BUGS):
        text = open(BUGS, encoding='utf-8').read()
        for v, c, _ in released:
            text = text.replace(f'pending:{c["slug"]}', v)
        open(BUGS, 'w', encoding='utf-8').write(text)

    # Moved, not deleted: the archive keeps the change file as it was written.
    for _, c, _ in released:
        arc_dir = os.path.join(DEV, 'archive', 'changes', c['slug'])
        os.makedirs(arc_dir, exist_ok=True)
        os.replace(c['path'], os.path.join(arc_dir, f'change_{c["slug"]}.md'))

    versions = ', '.join(v for v, _, _ in released)
    titles = '; '.join(re.match(r'## (.+?)(?: \(\d{4}-\d\d-\d\d\))?\s*$',
                                t.split('\n', 1)[0]).group(1) for _, _, t in released)
    print(f'\nReleased {versions}. Next:')
    print('  node dev/tests/doc_integrity_test.js && ./dev/tests/run_all.sh')
    print(f'  git add -A && git commit -m "{versions} — {titles}"')
    print(f'  git switch main && git merge --ff-only {branch} && git push')
    return 0


def main() -> int:
    argv = list(sys.argv[1:])

    if '--release' in argv:
        return release()
    if '--relabel' in argv:
        return relabel()

    def take(flag):
        if flag not in argv:
            return None
        i = argv.index(flag)
        if i + 1 >= len(argv):
            sys.exit(f'{flag} needs a value')
        val = argv[i + 1]
        del argv[i:i + 2]
        return val

    def _slug_of_entry(version):
        """The archive slug the in-progress entry names, or None for docs-only.

        v3.14.257. Reads the entry rather than guessing, so --add lands in the
        same folder the entry already points at."""
        try:
            log_text = open(LOG, encoding='utf-8').read()
        except OSError:
            return None
        at = log_text.find(f'**Version:** {version} ')
        if at < 0:
            return None
        line_end = log_text.find('\n', at)
        m = re.search(r'dev/archive/changes/([A-Za-z0-9._-]+)/', log_text[at:line_end])
        return m.group(1) if m else None

    # --add: archive files against the version already in progress. Work rarely
    # knows its whole file list at the start; without this the honest record is
    # "(no pre-copy)", which doc_integrity_test.js accepts but nobody wants.
    if '--add' in argv:
        i = argv.index('--add')
        files = argv[i + 1:]
        if not files:
            sys.exit('--add needs at least one file')
        # On a branch the build label names the change in progress.
        _, label = read_version_py()
        if label and os.path.exists(os.path.join(CHANGES, f'{label}.md')):
            target = os.path.join(DEV, 'archive', 'changes', label)
            os.makedirs(target, exist_ok=True)
            for f in files:
                src = os.path.join(ROOT, f)
                if not os.path.exists(src):
                    print(f'  {f} does not exist — record it as (new) instead')
                    continue
                name, ext = os.path.splitext(os.path.basename(f))
                dest = os.path.join(target, f'{name}_pre_{label}{ext}')
                if os.path.exists(dest):
                    print(f'  {f} already archived for {label}')
                    continue
                shutil.copy2(src, dest)
                print(f'  archived {f} -> {os.path.relpath(dest, ROOT)}')
            print(f'\nAdd these to the **Touched:** line in dev/changes/{label}.md.')
            return 0

        cur = current_version()
        slug_dirs = [d for d in os.listdir(os.path.join(DEV, 'archive', 'changes'))
                     if os.path.isdir(os.path.join(DEV, 'archive', 'changes', d))]
        # the folder whose newest file carries this version
        target = None
        for d in slug_dirs:
            p = os.path.join(DEV, 'archive', 'changes', d)
            if any(cur.lstrip('v') in f for f in os.listdir(p)):
                target = p
                break
        if not target:
            # v3.14.257: a docs-only version creates no folder, so --add used to
            # dead-end here with "start the version first" when the version WAS
            # started. There was then nowhere to put a pre-edit copy even for
            # someone reaching for one before editing, and the only honest record
            # left was "(no pre-copy)". Three of those were filed in one session.
            #
            # The slug is recoverable: the entry in progress names it, or names
            # none because it is docs-only, in which case one is derived from the
            # version. Creating the folder here is safe — it is empty, and the
            # copy about to be written is a genuine pre-edit copy of a file the
            # docs-only path never offered to take.
            slug_now = _slug_of_entry(cur) or f"v{cur.lstrip('v')}-docs"
            target = os.path.join(DEV, 'archive', 'changes', slug_now)
            os.makedirs(target, exist_ok=True)
            print(f'  {cur} had no archive folder (docs-only); created {slug_now}/')
            print(f'  set the entry\'s **Archives:** to `dev/archive/changes/{slug_now}/`')
        for f in files:
            src = os.path.join(ROOT, f)
            if not os.path.exists(src):
                print(f'  {f} does not exist — record it as (new) instead')
                continue
            base, ext = os.path.splitext(os.path.basename(f))
            dest = os.path.join(target, f'{base}_pre_{cur}{ext}')
            if os.path.exists(dest):
                print(f'  {f} already archived for {cur}')
                continue
            shutil.copy2(src, dest)
            print(f'  archived {f} -> {os.path.relpath(dest, ROOT)}')
        print(f'\nAdd these to the **Touched:** line for {cur}.')
        return 0

    entry_type = take('--type') or 'fix'
    examined = take('--examined')
    if entry_type not in TYPES:
        sys.exit(f'--type must be one of: {", ".join(TYPES)}')

    docs_only = '--docs-only' in argv or entry_type in ('finding', 'decision')
    argv = [a for a in argv if a != '--docs-only']

    if entry_type == 'finding' and not examined:
        sys.exit('a finding needs --examined "<what you looked at>" — '
                 'a finding whose basis is not recorded cannot be re-checked')

    if not docs_only and len(argv) < 2:
        sys.exit(__doc__)
    slug = argv[0] if argv else 'notes'
    files = argv[1:]

    # --main forces a version number on a branch, e.g. for a fix that must land
    # before the branch is released.
    force_main = '--main' in sys.argv
    files = [f for f in files if f != '--main']
    branch = git_branch()
    if not force_main and ('--fragment' in sys.argv or
                           (branch and branch not in MAIN_BRANCHES)):
        return start_change(slug, entry_type, examined,
                            [f for f in files if f != '--fragment'], docs_only)

    old = current_version()
    new = bump(old)

    # ── 1. archive, BEFORE anything is edited ────────────────────────────────
    touched = []
    if docs_only and not files:
        arc_ref = 'none — documentation only'
        touched_line = '— documentation only'
    elif docs_only:
        # v3.14.257: docs-only means files are OPTIONAL, not forbidden. Naming
        # them used to be accepted and then silently ignored, so a finding that
        # edited an existing audit got no pre-edit copy and no warning that it
        # had not been taken. Same path as below now, so the copies are real.
        arc_dir = os.path.join(DEV, 'archive', 'changes', slug)
        if os.path.exists(arc_dir):
            sys.exit(f'{arc_dir} already exists — pick another slug, or finish that version first.')
        os.makedirs(arc_dir)
        for f in files:
            src = os.path.join(ROOT, f)
            if not os.path.exists(src):
                touched.append(f'{f} (new)')
                continue
            base, ext = os.path.splitext(os.path.basename(f))
            shutil.copy2(src, os.path.join(arc_dir, f'{base}_pre_{new}{ext}'))
            touched.append(f)
        arc_ref = f'`dev/archive/changes/{slug}/` ({old})'
        touched_line = ' · '.join(touched)
        print(f'  archived {len([t for t in touched if not t.endswith("(new)")])} file(s) -> {arc_dir}')
    else:
        arc_dir = os.path.join(DEV, 'archive', 'changes', slug)
        if os.path.exists(arc_dir):
            sys.exit(f'{arc_dir} already exists — pick another slug, or finish that version first.')
        os.makedirs(arc_dir)
        for f in files:
            src = os.path.join(ROOT, f)
            if not os.path.exists(src):
                touched.append(f'{f} (new)')          # nothing to copy; say so
                continue
            base, ext = os.path.splitext(os.path.basename(f))
            shutil.copy2(src, os.path.join(arc_dir, f'{base}_pre_{new}{ext}'))
            touched.append(f)
        arc_ref = f'`dev/archive/changes/{slug}/` ({old})'
        touched_line = ' · '.join(touched)
        print(f'  archived {len([t for t in touched if not t.endswith("(new)")])} file(s) -> {arc_dir}')

    # ── 2. stub the entry ────────────────────────────────────────────────────
    log = open(LOG, encoding='utf-8').read()
    head_end = log.index('\n---\n') + len('\n---\n')
    meta = f"**Version:** {new} · **Type:** {entry_type} · **Archives:** {arc_ref}\n"
    meta += f"**Touched:** {touched_line}\n"
    if entry_type == 'finding':
        meta += f"**Examined:** {examined}\n**Filed:** \n"

    entry = f"""
## TITLE ({date.today().isoformat()})
{meta}
{entry_headings(entry_type)}
---
"""
    open(LOG, 'w', encoding='utf-8').write(log[:head_end] + entry + log[head_end:])
    print(f'  stubbed edit_log entry for {new} — replace TITLE and fill the headings')

    # ── 3. bump source/version.py, the shipped string ────────────────────────
    # Must move with the docs. A version.py left behind mislabels every log line
    # and bug report the build produces.
    if os.path.exists(VERSION_PY):
        set_version_py(new.lstrip('v'))

    # ── 4. bump the doc headers ──────────────────────────────────────────────
    stamp_docs(old, new)

    print(f'\n{new} started. Edit freely — the pre-edit copies are already safe.')
    print('When done:  node dev/tests/doc_integrity_test.js')
    print('            ./dev/tests/run_all.sh')
    # v3.14.254: the suite skips nllb_diag_test.py by default, 14.4 s of real
    # subprocess waits and 75% of the runtime. It is not run from here, because
    # this script runs BEFORE the edit and would test the previous state. The
    # reminder is the mechanism: a guard nobody runs is what the split risks.
    print('            ./dev/tests/run_all.sh --slow   (before a release)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
