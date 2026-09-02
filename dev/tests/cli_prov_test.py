#!/usr/bin/env python3
"""
cli_prov_test.py — the CLI can say what it made, and says it in the app's shape
Run:  python3 dev/tests/cli_prov_test.py

WHY THIS EXISTS
---------------
B-157 / L-027. `corpus_annotate.py --translate` stored an NLLB or Google
translation with no element-level provenance, so the app read it as a person's
work — `hasAnnotation` and D34's progress panel counted machine output as
finished human annotation. The cause was not a bug in the app: **no Python in
this project had ever written the `derived` flag**, so the CLI had no way to say
otherwise. `grep -rn "'derived'" source/scripts/` returned zero.

The audit's closing line was that the JS side has had `derived_prov_test.js`
since B-061 and the Python side has had nothing. This is that.

WHAT IT HOLDS, AND WHY EACH PART
--------------------------------
1. One definition. `make_prov` had two identical copies and only one had the
   `init_prov` twin, so B-134 was closed in one of two programs. A guard that
   only checked behaviour would let them diverge again silently.
2. The DERIVED shape, against the app's own reader. `isDerived()` tests
   `derived === true` and nothing else; a stamp that merely NAMES the machine
   ("auto-translated-nllb200-int8") is not a flag. This asserts the exact key set
   the app writes for the same thing.
3. The element, not the field. `_humanField` reads list provenance from the
   ELEMENT (B-138). A stamp in `field_prov['translations']` is read by nothing.
4. No `label`. The documented schema for a translation is
   `{text, source_id, date}`; only a transliteration carries a label. The old
   writer added one, and because `_listKeyOf` reconciles by an identity that
   INCLUDES `label`, a CLI translation could never match the app's own rebuild of
   it — which turned the re-stamp in §5 from a risk into a certainty.
5. The consequence that made this S2 rather than cosmetic: `assignList` stamps
   any element arriving without a `prov` with the moment of whoever saves next.
   The silence did not last, and what replaced it was false.

The app-side halves are read from `LingCoT.html` rather than re-implemented: a
copy of `isDerived` here would test the copy.
"""

import ast
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SRC  = ROOT / "source"

_pass = _fail = 0


def check(ok, label, detail=None):
    global _pass, _fail
    if ok:
        _pass += 1
        print(f"  ok   {label}")
    else:
        _fail += 1
        print(f"  FAIL {label}")
        if detail is not None:
            print(f"         {detail}")


def code_only(text):
    """
    Strip docstrings and comments before looking for code.

    Every check below asks whether the SOURCE does something, and three of them
    passed against a docstring on the first run: this file's own prose names
    `label` and `TODAY` while explaining why neither belongs, and the guard read
    its own explanation as the thing it forbids. `theme_audit_test` learned this
    from a CSS comment and `hidden_attr_test` shipped with it; here it took one
    run to repeat.

    Only \"\"\" docstrings are handled, because this project's Python uses no
    other kind — a stripper that quietly handled a form nobody writes would be
    untested code inside a guard.
    """
    text = re.sub(r'"""[\s\S]*?"""', '\"\"', text)
    return re.sub(r'^\s*#[^\n]*', '', text, flags=re.M)


APP      = (SRC / "LingCoT.html").read_text(encoding="utf-8")
ANNOTATE = (SRC / "scripts/corpus_annotate.py").read_text(encoding="utf-8")
INGEST   = (SRC / "scripts/corpus_ingest.py").read_text(encoding="utf-8")
PROV_PY  = (SRC / "prov.py").read_text(encoding="utf-8")

print("\n1 · one definition, imported by both programs")

defs = {}
for name, text in (("corpus_annotate.py", ANNOTATE), ("corpus_ingest.py", INGEST),
                   ("prov.py", PROV_PY)):
    tree = ast.parse(text)
    defs[name] = {n.name for n in ast.walk(tree)
                  if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}

for fn in ("make_prov", "init_prov", "derived_prov", "stamp_element"):
    check(fn in defs["prov.py"], f"prov.py defines {fn}()")

for script in ("corpus_annotate.py", "corpus_ingest.py"):
    dupes = {"make_prov", "init_prov", "derived_prov"} & defs[script]
    check(not dupes, f"{script} defines none of them itself",
          f"redefines {sorted(dupes)} — B-134 was closed in one copy of two "
          f"because this was allowed once")

check("from prov import" in ANNOTATE and "from prov import" in INGEST,
      "both scripts import from the one module")

print("\n2 · the derived stamp is the shape the app reads")

sys.path.insert(0, str(SRC))
import prov as P  # noqa: E402

d = P.derived_prov("auto-translated-nllb200-int8")
h = P.make_prov("ann_001")

check(d.get("derived") is True,
      "derived_prov() sets derived=True",
      f"got {d!r}")
check(set(d) == {"annotator_id", "annotator", "date", "time", "derived"},
      "and exactly the app's key set for a derived stamp",
      f"got {sorted(d)}")
# `.get`, not `[]`: a mutation that returned a different shape made this line
# raise instead of report, and a guard that crashes tells you less than one
# that names what it wanted.
check(d.get("annotator_id") is None
      and d.get("annotator") == "auto-translated-nllb200-int8",
      "naming the method, with no person", d)

# The app's own writer, read rather than re-implemented.
# `[^)]*` stopped at the paren INSIDE the default `'auto (lexicon)'`.
m = re.search(r"function _derivedFieldProv\([\s\S]*?\n\}", APP)
check(bool(m), "the app's _derivedFieldProv found")
app_keys = set(re.findall(r"(\w+):", m.group(0).split("return")[1])) if m else set()
check(app_keys == set(d),
      "the two writers agree, key for key",
      f"python {sorted(set(d))} vs app {sorted(app_keys)}")

check("derived" not in h,
      "make_prov() is NOT derived — it names a person or a named process",
      f"got {h!r}")
check(set(h) == {"annotator", "date"},
      "and keeps the shape the format has always had",
      f"got {sorted(h)}")

# The reader, from the app.
mi = re.search(r"function isDerived\(rec\)\s*\{([^}]*)\}", APP)
check(bool(mi) and "derived === true" in mi.group(1),
      "the app tests `derived === true` and nothing else",
      "so a readable name like 'auto-translated-…' is not a flag")

print("\n2b · and the translate path ASKS for it")

# Testing the writer is not testing the caller. A mutation swapping
# `derived_prov` for `make_prov` at the one call site passed every check above,
# because they all built the stamp themselves. This reads the call site.
# Indentation-agnostic: the first anchor counted eight spaces and the code has
# twelve, so this failed on a clean tree — a guard pinned to whitespace again.
flush = re.search(r"def flush_batch\(\)[\s\S]*?Atomic commit", ANNOTATE)
check(bool(flush), "the translate batch writer found")
fb = code_only(flush.group(0)) if flush else ""
check("derived_prov(" in fb,
      "it builds a DERIVED stamp for the batch",
      "the backend name is already `auto-translated-…`, which is a label and "
      "not a flag")
check("make_prov(" not in fb,
      "and does not build a human one",
      "one call site, and it decides whether the corpus tells the truth")

print("\n3 · the stamp goes on the ELEMENT")

sent = {"id": "s1", "text": "x"}
sys.modules.pop("corpus_annotate", None)
ann_src = ANNOTATE
m2 = re.search(r"def set_sent_translation\(sent[\s\S]*?\n\n\n", ann_src)
check(bool(m2), "set_sent_translation found")
body = code_only(m2.group(0)) if m2 else ""

check("stamp_element(" in body,
      "it stamps the element",
      "a stamp in field_prov['translations'] is read by NOTHING for a list field")
check("field_prov']['translations'] = prov" not in body
      and 'field_prov"]["translations"] = prov' not in body,
      "and no longer writes the field-level stamp that nothing read")

print("\n4 · the app's element shape, exactly — no label")

check("label" not in body,
      "no `label` key on a translation element",
      "the schema is {text, source_id, date}; only a TRANSLITERATION has a label")
for key in ("text", "source_id", "date"):
    check(f'"{key}"' in body, f"and it writes `{key}`")

# The app's reader, which is what the shape has to match.
mr = re.search(r"function readTranslationsEditor\(containerId\)[\s\S]*?\n\}",
               (SRC / "modules/participants.js").read_text(encoding="utf-8"))
check(bool(mr) and "label" not in mr.group(0),
      "the app's own editor writes no label either — the shapes now match",
      "if they differ, _listKeyOf cannot reconcile them and every save re-stamps")

print("\n5 · why an unstamped element could not simply be left alone")

ml = re.search(r"function assignList\(obj, key, next, moment\)[\s\S]*?\n\}", APP)
check(bool(ml), "assignList found")
check(bool(ml) and "stampElement(el, moment)" in ml.group(0),
      "an element with no prov is stamped with the SAVER's moment",
      "which is why the CLI's silence became a false positive claim on the next "
      "save, not a permanent absence")

print("\n6 · the date is asked for when the stamp is made")

# Asked of the TREE, not of a string. The first version looked for the literal
# `date.today()` before `def _now`, and a mutation that hoisted
# `datetime.now()` into a module constant walked straight past it. Any call to
# a clock outside a function body is the defect, whatever it is spelled.
CLOCKS = {"now", "today", "utcnow", "time"}
mod = ast.parse(PROV_PY)
fn_nodes = {id(n) for f in mod.body
            if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef))
            for n in ast.walk(f)}
top_clocks = [ast.unparse(n) for n in ast.walk(mod)
              if isinstance(n, ast.Call) and id(n) not in fn_nodes
              and getattr(n.func, "attr", None) in CLOCKS]
check(not top_clocks,
      "prov.py asks the clock only inside a function",
      f"module-level {top_clocks} — a batch run crossing midnight then stamps "
      f"every later sentence with the day it started")
check(re.search(r"^TODAY\s*=", code_only(ANNOTATE), re.M) is None,
      "corpus_annotate.py no longer carries one either",
      "a batch run crossing midnight stamped every later sentence with the "
      "previous day — B-141's subject, one language over")

print("\n7 · executed: a real --translate write, end to end")

s2 = {"id": "s1", "text": "bir", "translations": [], "field_prov": {"translations": {"annotator": "old"}}}
code = (
    f"import sys; sys.path.insert(0, {str(SRC)!r}); sys.path.insert(0, {str(SRC / 'scripts')!r});\n"
    "import json, re, pathlib\n"
    f"src = pathlib.Path({str(SRC / 'scripts/corpus_annotate.py')!r}).read_text(encoding='utf-8')\n"
    "m = re.search(r'def set_sent_translation[\\s\\S]*?\\n\\n\\n', src)\n"
    "from prov import derived_prov, stamp_element\n"
    "ns = {'stamp_element': stamp_element}\n"
    "exec(m.group(0), ns)\n"
    f"sent = {json.dumps(s2)}\n"
    "ns['set_sent_translation'](sent, 'one', derived_prov('auto-translated-google'))\n"
    "print(json.dumps(sent))\n"
)
out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
check(out.returncode == 0, "the writer runs", out.stderr.strip()[-300:])
if out.returncode == 0:
    got = json.loads(out.stdout)
    el = got["translations"][0]
    check(el.get("text") == "one", "the translation is written", el)
    check(isinstance(el.get("prov"), dict) and el["prov"].get("derived") is True,
          "carrying a DERIVED element stamp — the whole of B-157",
          el)
    check("label" not in el, "with no label", el)
    check(set(el) == {"text", "source_id", "date", "prov"},
          "and nothing else", sorted(el))
    check("translations" not in (got.get("field_prov") or {}),
          "the field-level stamp is gone", got.get("field_prov"))

print(f"\n{_pass} passed, {_fail} failed\n")
sys.exit(1 if _fail else 0)
