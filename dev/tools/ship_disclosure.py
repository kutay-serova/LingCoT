#!/usr/bin/env python3
"""
ship_disclosure.py — what would this repository publish about people?

Run ONCE, deliberately, immediately before `git init`. It prints; it decides
nothing, excludes nothing, and returns no verdict to act on automatically.

    python3 dev/tools/ship_disclosure.py

WHY THIS IS A DISCLOSURE AND NOT A GUARD
    `samples/` ships a participants file on purpose: it is the file structure a
    user will actually have — corpus, dictionary, participants, journal — and a
    sample set missing one of the four teaches the wrong shape. Whether its
    contents are genuine is a fieldwork decision, and the repository cannot make
    it: no pattern separates a synthetic name from a real one, and a tool that
    claimed to would be making a claim about what a real name can look like.
    That is the same kind of claim as `POS_VISIBLE_MORPH`, and wrong the same
    way. So this enumerates, and a person signs off.

    It is deliberately NOT in `run_all.sh`. A guard that reads participant data
    would print it on every run, and would become a guard that cannot fail on
    the day the data is clean. This runs once, before an irreversible act.

WHY IT DOES NOT SCOPE ITSELF TO `*_participants.jsonl`
    Measured 2026-08-31: `samples/turkish-test_participants.jsonl` holds THREE
    named records, and the corpus and dictionary beside it hold 269 occurrences
    of those same names inlined in provenance — 205 and 64. A check scoped by
    filename would have read 3 records and missed 269 strings.

    Both live corpora hold zero, because interning (v3.14.225-226) thins
    provenance into a per-file `prov_events` table and `samples/` predates it.
    So the gate-1 corpus swap is expected to fix this by construction; this tool
    is how that is verified rather than assumed.

TWO RULES IT FOLLOWS
    ASK GIT.  What ships is decided by `git check-ignore` against a scratch
    repository holding the real `.gitignore`, the technique `gitignore_test.js`
    established after a commented pattern silently shipped 601 MB. A tool that
    parsed the file would be guessing at git's behaviour, and a check that
    disagrees with the commit about what is being committed is two writers of
    one thing.

    TAKE THE NAMES FROM THE DATA.  The search set is every `name` on every
    `annotator` and `source` record that would ship — derived from what is
    there, not from a pattern of what to look for.

OUTPUT GOES TO A TERMINAL AND NOWHERE ELSE. It is never written to `logs/`,
and it is not designed to be piped into a file.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

DEV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(DEV)

# Personal fields, as `field_spec.js` declares them for `annotator` and `source`.
# Listed here because this tool is Python and that table is JS; the twin is
# `_PROJECT_ROLES` in LingCoT.pyw, which has the same shape and the same reason.
PERSON_FIELDS = ['name', 'affiliation', 'role', 'birth_decade', 'contact_info',
                 'other', 'gender', 'language_background', 'citation_information',
                 'other_information', 'researcher', 'publication_restrictions']


def shipping_paths():
    """Every file git would carry, asked of git rather than inferred."""
    tmp = tempfile.mkdtemp(prefix='lingcot-ship-')
    try:
        subprocess.run(['git', '-C', tmp, 'init', '-q', '.'], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.copyfile(os.path.join(ROOT, '.gitignore'),
                        os.path.join(tmp, '.gitignore'))
        rels = []
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d != '.git']
            for f in files:
                rels.append(os.path.relpath(os.path.join(base, f), ROOT))
        # One call, one line per path: check-ignore answers about a PATH and
        # needs no file present in the scratch repo.
        r = subprocess.run(['git', '-C', tmp, 'check-ignore', '--no-index', '--stdin'],
                           input='\n'.join(rels), capture_output=True, text=True)
        ignored = set(r.stdout.splitlines())
        return sorted(p for p in rels if p not in ignored)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def records(path):
    try:
        with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
            for line in fh:
                if line.strip():
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        continue
    except (OSError, UnicodeDecodeError):
        return


def main():
    ship = shipping_paths()
    jsonl = [p for p in ship if p.endswith('.jsonl')]
    print(f'\n{len(ship)} file(s) would be committed; {len(jsonl)} of them are .jsonl.\n')

    # ── 1. every person-shaped record that would ship, field by field ────────
    people = []            # (path, record_type, name)
    print('─' * 72)
    print('PEOPLE RECORDS THAT WOULD SHIP')
    print('─' * 72)
    found_any = False
    for p in jsonl:
        rows = [r for r in records(p)
                if r.get('record_type') in ('annotator', 'source')
                or r.get('record') in ('annotator', 'source')]
        if not rows:
            continue
        found_any = True
        print(f'\n  {p}')
        for r in rows:
            kind = r.get('record_type') or r.get('record') or '?'
            print(f'    · {kind}')
            for k in PERSON_FIELDS:
                if r.get(k) not in (None, '', [], {}):
                    print(f'        {k:24} {r[k]!r}')
            extra = [k for k in r
                     if k not in PERSON_FIELDS
                     and k not in ('id', 'record', 'record_type', 'prov',
                                   'prov_history', 'field_prov', 'deleted')
                     and r.get(k) not in (None, '', [], {})]
            if extra:
                print(f'        {"(other keys)":24} {", ".join(extra)}')
            if r.get('name'):
                people.append((p, kind, r['name']))
    if not found_any:
        print('\n  none.')

    # ── 2. where those same names appear in everything else that ships ───────
    print()
    print('─' * 72)
    print('THOSE NAMES, ELSEWHERE IN WHAT SHIPS')
    print('─' * 72)
    if not people:
        print('\n  no names to look for.')
    else:
        names = sorted({n for _, _, n in people})
        print(f'\n  searching for {len(names)} name(s) across {len(ship)} shipping file(s).')
        print('  A participants file is not the only place a name lives: provenance')
        print('  inlined it until interning (v3.14.225-226) moved it to a table.\n')
        total = 0
        for p in ship:
            try:
                with open(os.path.join(ROOT, p), encoding='utf-8', errors='ignore') as fh:
                    blob = fh.read()
            except OSError:
                continue
            hits = [(n, blob.count(n)) for n in names if n in blob]
            if not hits:
                continue
            n_here = sum(c for _, c in hits)
            total += n_here
            src = ' (the participants file itself)' if any(p == pp for pp, _, _ in people) else ''
            print(f'    {n_here:6}  {p}{src}')
            for n, c in sorted(hits, key=lambda x: -x[1]):
                print(f'            {c:5} × {n!r}')
        print(f'\n  {total} occurrence(s) in total.')

    # ── 2b. what this tool CANNOT read, named so the gap is not silent ───────
    # v3.14.393. Section 2 greps text. A screenshot of the application showing a
    # real annotator's name, a real speaker's sentence or a filesystem path is
    # invisible to it, and so is a name in font metadata. This was found the only
    # way it could be: a person opened docs/images/sentence-view.png and looked
    # at it, immediately before the first push. The tool cannot close this gap —
    # it can refuse to let the gap go unmentioned, which is PRACTICES §5.
    TEXTUAL = ('.md', '.js', '.py', '.pyw', '.json', '.jsonl', '.css', '.html',
               '.txt', '.cff', '.toml', '.lock', '.sh', '.bat', '.command',
               '.yml', '.yaml', '.gitignore', '.cursor')
    # An EMPTY file carries nothing, so listing it is noise that trains the
    # reader to skim the one list that must not be skimmed (logs/.gitkeep).
    opaque = [p for p in ship
              if not p.lower().endswith(TEXTUAL)
              and os.path.basename(p) != 'pre-commit'
              and os.path.getsize(os.path.join(ROOT, p)) > 0]
    if opaque:
        print()
        print('-' * 72)
        print('WHAT THIS TOOL COULD NOT READ')
        print('-' * 72)
        print()
        print(f'  {len(opaque)} file(s) ship that section 2 did not search, because they')
        print('  are not text. A name inside a SCREENSHOT is invisible to a grep:')
        print()
        for p in opaque:
            print(f'    {p}')
        print()
        print('  Open each one and look at it before you push. A screenshot of the')
        print('  app can carry an annotator name, a speaker\'s sentence, or a home')
        print('  directory in a title bar, and none of those are searchable here.')

    # ── 3. the question, asked rather than answered ──────────────────────────
    print()
    print('=' * 72)
    print('  Nothing above is a verdict. A committed file lives in every fork')
    print('  forever, so the question is yours to answer, and it is:')
    print()
    print('    is every value printed above one you are content to publish')
    print('    permanently, under a licence that lets anyone redistribute it?')
    print()
    print('  If yes, record that in the `git init` version\'s entry — its')
    print('  --examined line is what shows this was run. If no, change the DATA;')
    print('  do not add an exclusion, because the names above are in four files')
    print('  and an exclusion would only cover one of them.')
    print()
    print('  The names above are the ones that are SEARCHABLE. Anything under')
    print('  "what this tool could not read" is yours to open and check by eye.')
    print('=' * 72)
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
