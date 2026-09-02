"""prov.py — the one place the CLI says who made a value.

B-157 / L-027, v3.14.365.

WHY THIS FILE EXISTS
--------------------
`make_prov` had two identical copies, in `corpus_ingest.py` and
`corpus_annotate.py`, and only the ingest copy had the `init_prov` twin that
writes `prov_history`. **B-134 was closed in one copy of two**, and no guard
named either function — so the fix that made the CLI write a provenance trail
reached one of the two programs that needed it.

More seriously, neither copy could say **that the app made a value rather than a
person**. `grep -rn "'derived'" source/scripts/` returned nothing: no Python in
this project had ever written the flag the app's `isDerived()` reads. So a
`corpus_annotate.py --translate` run stored an NLLB or Google translation with no
way for anything downstream to tell it from a human one, and `hasAnnotation` and
D34's progress panel duly counted machine output as finished human work.

THE SHAPES, AND WHY THEY MATCH THE APP EXACTLY
----------------------------------------------
The app writes two kinds of stamp and reads them with one test, `isDerived(rec)`
→ `rec.derived === true`:

    human    prov()               { annotator_id, date, time }
    derived  _derivedFieldProv()  { annotator_id: null, annotator, date, time,
                                    derived: true }

`derived_prov` below produces the second shape byte for byte. That is not
cosmetic: `thinProv` on the app side deletes `annotator` only when
`annotator_id` is truthy, so a derived stamp keeps its readable name through
interning, and a stamp missing `derived: true` is a stamp that says a person did
it. `cli_prov_test.py` holds both shapes against the app's own readers.

`make_prov` is deliberately unchanged — `{annotator, date}` — because the human
CLI stamp has been that shape since the format was written and changing it is a
migration, not a fix.

WHY THE DATE IS COMPUTED PER CALL
---------------------------------
Both scripts held `TODAY = date.today().isoformat()` at module level. A batch
translation of a large corpus runs for hours; one started before midnight
stamped every sentence after it with the previous day. A stamp that asserts
something untrue is the whole subject of B-141, and this was the same thing one
language over. The cost of asking the clock per stamp is nothing.
"""

from datetime import datetime

DEFAULT_ANNOTATOR = "automatically-parsed"


# @fn _now, the date and time this stamp is being made
def _now() -> tuple:
    n = datetime.now()
    return n.date().isoformat(), n.strftime("%H:%M:%S")


# @fn make_prov, a stamp naming a person or a named process
def make_prov(annotator: str = DEFAULT_ANNOTATOR) -> dict:
    """Return a schema-compliant provenance stamp.

    Unchanged in shape from the two copies this replaces. Use `derived_prov`
    instead for anything the machine decided.
    """
    today, _ = _now()
    return {"annotator": annotator, "date": today}


# @fn derived_prov, a stamp that says the machine made this
def derived_prov(annotator: str) -> dict:
    """Return a DERIVED provenance stamp, in the app's own shape.

    `derived: True` is the whole point: `isDerived()` in the app tests exactly
    that key and nothing else, and every consumer of "did a person do this" —
    `_humanField`, `hasAnnotation`, D34's counter, the provenance tooltip — is
    downstream of it.

    `annotator_id` is null because no person is being named; `annotator` carries
    the readable method (`auto-translated-nllb200-int8`), which survives interning
    precisely because `annotator_id` is null.
    """
    today, now = _now()
    return {"annotator_id": None, "annotator": annotator,
            "date": today, "time": now, "derived": True}


# @fn init_prov, the provenance keys every stored object carries at creation
def init_prov(annotator: str = DEFAULT_ANNOTATOR) -> dict:
    """The creation stamp and the trail that holds it, as one spread.

    B-134 (v3.14.276): no script had ever written `prov_history`, while the app's
    `initProv()` does and the field table declares it everywhere. A CLI-built
    object arrived with a creation stamp and no trail, and the app's first edit
    began the trail at the edit. Fixed in `corpus_ingest.py` only — which is why
    this now lives in one file that both programs import.
    """
    p = make_prov(annotator)
    return {"prov": p, "prov_history": [p], "field_prov": None}


# @fn stamp_element, put a stamp on one element of a list field
def stamp_element(el: dict, prov: dict) -> dict:
    """Write `prov` onto a list element, in place, and return it.

    B-138 put list-field provenance on the ELEMENT, because a stamp on the array
    can only say "someone last touched this list" and the ordinary case is two
    translations added by different people years apart. The app's `assignList`
    reads `el.prov`; anything the CLI writes without one is not merely unattributed
    but **actively re-attributed** — an element arriving with no `prov` falls
    through to `stampElement(el, moment)` on the next save, and is stamped with
    whoever saved it. The silence does not last: what replaces it is false.
    """
    if isinstance(el, dict) and prov is not None:
        el["prov"] = prov
    return el
