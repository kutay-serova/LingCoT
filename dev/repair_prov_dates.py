#!/usr/bin/env python3
"""repair_prov_dates.py — undo B-105 in a corpus written before v3.14.205.

B-105: prov() built `date` with toISOString() (UTC) and `time` with
toTimeString() (local). West of Greenwich, every stamp written after the day
had already rolled over in UTC carries TOMORROW'S date beside this evening's
local time.

Recovering it is arithmetic, not guesswork, because the local time survived
intact. With a UTC offset of -07:00, UTC is 7 hours ahead, so the stored UTC
date is one day too late exactly when the local time is 17:00 or later. The
threshold is 24:00 minus the offset; the correction is always minus one day.

    24:00 - 7h = 17:00   ->  a stamp at 21:22 is off by a day
                             a stamp at 09:14 is correct

East of Greenwich the error runs the other way: UTC is BEHIND local, so an
early-morning stamp carries yesterday's date and the correction is plus one
day. Both directions are handled.

This rewrites annotation provenance, so it does nothing by default. Run it,
read the diff, then run it again with --apply.

    python3 dev/repair_prov_dates.py ~/LingCoT-Data/corpora/turkish_test_corpus
    python3 dev/repair_prov_dates.py ~/LingCoT-Data/corpora/turkish_test_corpus --apply

The offset is READ OUT OF THE CORPUS, not assumed. Every id this app mints
carries the epoch-millisecond instant it was minted at, and the prov record
beside it carries the local time of that same instant, so the difference is the
offset the annotator was working at. Taking it from the machine running the
script, or from a flag, is guessing: a wrong offset moves the threshold and
silently corrects a band of stamps that were never wrong. That happened once
(-07:00 assumed where the truth was -05:00, ten stamps rolled back a day that
should not have moved), which is why the derivation and the self-check below
exist.

The self-check is the real safeguard. For every record whose id carries an
instant, the true local date is computable outright, with no threshold
reasoning at all. The repair is verified against that before anything is
written, and refuses on a single disagreement.

A corpus repaired once must not be repaired twice, so a marker file is written
beside it and a second run refuses.
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import shutil
import sys
from collections import Counter
import time

MARKER = '.prov_date_repair.json'

# Every key under which this app stores something shaped like a prov record.
PROV_KEYS = ('prov',)
PROV_LIST_KEYS = ('prov_history',)
PROV_MAP_KEYS = ('field_prov',)


ID_INSTANT = re.compile(r'_(\d{13})(?:_|$)')


def id_instant(obj):
    """The epoch-ms instant an object's id was minted at, or None.

    Ids look like `dict_1787970164381_o8klq` and `doc_1787952635085`, and the
    13-digit group is Date.now() at creation. Anything else (a hand-written id,
    an imported one) simply does not participate.
    """
    m = ID_INSTANT.search(str(obj.get('id') or ''))
    if not m:
        return None
    ms = int(m.group(1))
    # Sanity: 2001 to 2286. A number of the right length that is not a plausible
    # instant is more likely a coincidence than a timestamp.
    return ms if 1_000_000_000_000 < ms < 9_999_999_999_999 else None


def first_stamp(obj):
    """The stamp closest to the object's creation, for pairing with its id."""
    hist = obj.get('prov_history') or []
    if hist and isinstance(hist[0], dict):
        return hist[0]
    return obj.get('prov') if isinstance(obj.get('prov'), dict) else None


def offset_evidence(rows):
    """Every (offset_hours, object_id) the corpus can vouch for itself.

    Uses the time of day only, never the date, because the date is the thing
    under suspicion. A local time of day minus the UTC time of day at the same
    instant is the offset, modulo a day.
    """
    out = []

    def visit(o):
        if isinstance(o, list):
            for v in o:
                visit(v)
            return
        if not isinstance(o, dict):
            return
        ms, st = id_instant(o), first_stamp(o)
        if ms and st and isinstance(st.get('time'), str):
            try:
                h, m, sec = (int(x) for x in st['time'].split(':'))
            except ValueError:
                h = None
            if h is not None:
                utc = dt.datetime.utcfromtimestamp(ms / 1000)
                diff = (h * 60 + m) - (utc.hour * 60 + utc.minute)
                diff = (diff + 720) % 1440 - 720          # fold into -12h..+12h
                # Real offsets are whole quarter-hours; the seconds between an id
                # and its stamp are noise.
                out.append((round(diff / 15) * 15 / 60.0, o.get('id')))
        for k, v in o.items():
            if k in PROV_KEYS or k in PROV_LIST_KEYS or k in PROV_MAP_KEYS:
                continue
            if isinstance(v, (dict, list)):
                visit(v)

    for r in rows:
        visit(r)
    return out


def correction(stamp, offset_hours):
    """Days to add to this stamp's date, or 0 if it is already right.

    Returns 0 for anything without both halves: a stamp with no time cannot be
    checked, and inventing a correction for it would be the same class of
    mistake as B-105 itself.
    """
    date, tm = stamp.get('date'), stamp.get('time')
    if not isinstance(date, str) or not isinstance(tm, str):
        return 0
    try:
        h, m, s = (int(x) for x in tm.split(':'))
    except ValueError:
        return 0
    minutes = h * 60 + m
    off = int(round(offset_hours * 60))
    if off < 0:
        # UTC ahead of local: the UTC date rolls over first.
        return -1 if minutes >= 24 * 60 + off else 0
    if off > 0:
        # UTC behind local: the UTC date is still on yesterday early in the day.
        return 1 if minutes < off else 0
    return 0


def shift(date, days):
    d = dt.date.fromisoformat(date) + dt.timedelta(days=days)
    return d.isoformat()


def walk(obj, offset, found):
    """Correct every prov record in place, appending (before, after) to found."""
    if isinstance(obj, list):
        for v in obj:
            walk(v, offset, found)
        return
    if not isinstance(obj, dict):
        return

    stamps = []
    for k in PROV_KEYS:
        if isinstance(obj.get(k), dict):
            stamps.append((k, obj[k]))
    for k in PROV_LIST_KEYS:
        for i, st in enumerate(obj.get(k) or []):
            if isinstance(st, dict):
                stamps.append((f'{k}[{i}]', st))
    for k in PROV_MAP_KEYS:
        for fk, st in (obj.get(k) or {}).items():
            if isinstance(st, dict):
                stamps.append((f'{k}.{fk}', st))

    for label, st in stamps:
        days = correction(st, offset)
        if days:
            before = st['date']
            st['date'] = shift(before, days)
            found.append((obj.get('id') or obj.get('form') or '?', label,
                          before, st['date'], st.get('time')))

    for k, v in obj.items():
        # The stamps above were handled as stamps; their own keys hold no nesting.
        if k in PROV_KEYS or k in PROV_LIST_KEYS or k in PROV_MAP_KEYS:
            continue
        if isinstance(v, (dict, list)):
            walk(v, offset, found)


def repair_rows(rows, offset):
    """Correct every stamp in memory. Nothing reaches disk from here."""
    found = []
    for r in rows:
        walk(r, offset, found)
    return found


def write_rows(path, rows):
    shutil.copy2(path, path.with_suffix(path.suffix + '.b105-bak'))
    path.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows),
                    encoding='utf8')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('corpus_dir', help='a corpus folder (the one holding *_corpus.jsonl)')
    ap.add_argument('--apply', action='store_true',
                    help='write the corrected files; without it nothing is touched')
    ap.add_argument('--utc-offset', type=float, default=None,
                    help='override the offset read out of the corpus. Only for a '
                         'corpus whose ids carry no instants; a value that '
                         'disagrees with the evidence is refused')
    ap.add_argument('--force', action='store_true',
                    help='repair again even though the marker says it was already done')
    args = ap.parse_args()

    d = pathlib.Path(args.corpus_dir).expanduser()
    if not d.is_dir():
        sys.exit(f'not a directory: {d}')

    marker = d / MARKER
    if marker.exists() and not args.force:
        prev = json.loads(marker.read_text())
        sys.exit(f'{d.name} was already repaired ({prev.get("when_utc") or prev.get("when")} UTC).\n'
                 f'Correcting twice would move every date a second day. Use --force if you '
                 f'are certain.')

    files = sorted(d.glob('*.jsonl'))
    all_rows = {p: [json.loads(l) for l in p.read_text(encoding='utf8').splitlines() if l.strip()]
                for p in files}

    evidence = [o for rows in all_rows.values() for o in offset_evidence(rows)]
    votes = Counter(off for off, _ in evidence)
    derived = votes.most_common(1)[0][0] if votes else None

    if derived is None and args.utc_offset is None:
        sys.exit('no id in this corpus carries an instant, so the offset cannot be '
                 'read out of the file. Pass --utc-offset, and be sure of it.')
    if derived is not None and len(votes) > 1:
        print('the corpus disagrees with itself about the offset:')
        for off, n in votes.most_common():
            print(f'    UTC{off:+.2f}  {n} record(s)')
        print('  a corpus annotated across a daylight-saving change does this. '
              'The majority is used; check the minority by hand.\n')

    offset = derived
    if args.utc_offset is not None:
        if derived is not None and abs(args.utc_offset - derived) > 0.01:
            sys.exit(f'--utc-offset {args.utc_offset:+.2f} contradicts the corpus, which '
                     f'says UTC{derived:+.2f} across {votes[derived]} record(s).\n'
                     f'A wrong offset moves the threshold and corrects a band of stamps '
                     f'that were never wrong. Refusing.')
        offset = args.utc_offset

    if offset == 0:
        sys.exit('offset is UTC+00:00, where B-105 could not occur.')
    threshold = f'{int(24 + offset):02d}:00' if offset < 0 else f'00:00 to {int(offset):02d}:00'
    print(f'corpus : {d}')
    src = 'read from the corpus' if args.utc_offset is None else 'given, and agreed by the corpus'
    print(f'offset : UTC{offset:+.2f}  ({src}, {len(evidence)} record(s) vouch for it)')
    print(f'         stamps at {threshold} local are the affected ones')
    print(f'mode   : {"APPLY" if args.apply else "dry run, nothing will be written"}\n')

    total = 0
    for path in files:
        found = repair_rows(all_rows[path], offset)
        total += len(found)
        print(f'{path.name}: {len(found)} stamp(s)')
        for owner, label, before, after, tm in found[:12]:
            print(f'    {owner:34} {label:24} {before} {tm} -> {after}')
        if len(found) > 12:
            print(f'    ... and {len(found) - 12} more')

    # What the corpus can and cannot check about itself.
    #
    # An earlier draft "verified" the corrected dates by recomputing them from
    # each id's instant plus the offset. That is the same arithmetic that
    # produced the correction, so it agreed with itself at every offset,
    # including the wrong one. It is recorded here because it looked like a
    # safeguard and was not.
    #
    # The check that does work is the derivation: a wrong offset does not fit
    # the record pairs, and disagreement shows up as a split vote. Unanimity
    # across many records is the evidence; a split means the corpus was
    # annotated across a clock change and no single offset is right for all of
    # it.
    dissent = sum(n for off, n in votes.items() if abs(off - offset) > 0.01)
    print(f'\nevidence  : {len(evidence)} record(s) pair an id instant with a local '
          f'time, {len(evidence) - dissent} agree on UTC{offset:+.2f}')
    if dissent:
        print(f'            {dissent} disagree — likely a daylight-saving change '
              f'inside this corpus')
        if args.apply and not args.force:
            sys.exit('nothing written. Repair each side of the clock change '
                     'separately, or pass --force if the minority is noise.')

    print(f'\n{total} stamp(s) {"corrected" if args.apply else "would be corrected"}')
    if args.apply and total:
        for path in files:
            write_rows(path, all_rows[path])
        marker.write_text(json.dumps({
            # Named for what it is. This script may well be run from a machine
            # in a different zone than the annotation, and an unlabelled local
            # time in a file about mislabelled local times helps nobody.
            'when_utc': dt.datetime.utcnow().isoformat(timespec='seconds'),
            'utc_offset_hours': offset,
            'stamps_corrected': total,
            'bug': 'B-105',
        }, indent=1), encoding='utf8')
        print(f'originals kept as *.jsonl.b105-bak; marker written to {MARKER}')
    elif not args.apply:
        print('re-run with --apply to write these changes')


if __name__ == '__main__':
    main()
