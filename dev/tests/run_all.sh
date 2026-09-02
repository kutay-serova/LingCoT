#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_all.sh — the whole guard suite, one command.
#
#   ./dev/tests/run_all.sh          run everything except the slow ones
#   ./dev/tests/run_all.sh --slow   run everything, including them
#   ./dev/tests/run_all.sh dep      run only guards whose name contains "dep"
#
# Every guard is self-contained and exits non-zero on failure. This script
# adds nothing but a tally and a non-zero exit if any of them failed, so it
# stays useful whether or not the project ever gains a CI runner.
#
# EXIT 2 = DISABLED. A guard whose INPUT is missing exits 2 and is
# tallied separately. THREE things go missing: a corpus fixture; dev/archive/,
# which is developer history and is not distributed, so four guards were failing
# on every fresh clone until v3.14.135; and, since v3.14.340, a browser —
# gui_crud_test.js needs a Chromium a clone does not have.
#
# That third reason was added by the guard and not by this summary, which went on
# naming two for nine versions. A tally that lists its own causes is a
# declaration, and a declaration is only as good as what it admits exists
# (PRACTICES.md §5).
# It is deliberately NOT counted as a pass: this project has
# had fourteen guards report success while checking nothing, and a suite that
# quietly absorbs a disabled guard is the same defect wearing a tidier face.
# The final line names every disabled guard and why, on every run, so the cost
# of leaving one off stays visible.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# SLOW GUARDS. `nllb_diag_test.py` is 14.4 s of a 19.3 s suite, 75% of it, and
# the time is real sleeps in stub subprocesses: it starts a server, waits for it
# to fail the way the real one fails, and reads what was captured. That is what
# makes it worth having and it is not reducible without testing something else.
#
# So it runs on demand, not on every save. The cost of leaving it out is printed
# on every run, the same way a DISABLED guard's is, because a guard nobody runs
# is the failure mode this split could introduce. `new_version.py` prints the
# --slow line among its closing reminders; it does not run it, because it runs
# BEFORE the edit and would be testing the previous state.
#
# `gui_crud_test.js` is out of the default run for a different reason, and the
# difference matters. It is not slow because it waits; it is slow because it
# drives a real browser (~42 s), and it needs one — Playwright plus a 195 MB
# Chromium that a clone does not have and that CI would have to install. On a
# machine without it the guard exits 2, DISABLED, so leaving it in the default
# run would put a permanent yellow line under every save for most checkouts.
#
# It is also the only guard that asserts on FILES the app wrote rather than on
# source text or on a stub-DOM run, so it is a release check, not a save check:
# the defects it finds are ones that survive a green suite, and none of them
# appear between one save and the next. See PRACTICES.md §6.
#
# Measured v3.14.254: 19.3 s all in, 4.9 s without it.
# Measured v3.14.340: +42 s for gui_crud_test.js, browser already installed.
# ---------------------------------------------------------------------------
SLOW="nllb_diag_test.py gui_crud_test.js"

cd "$(dirname "$0")" || exit 1
filter="${1:-}"
run_slow=0
if [ "$filter" = "--slow" ]; then run_slow=1; filter=""; fi
# An explicit filter naming a slow guard runs it: asking for it by name is asking.
[ -n "$filter" ] && [[ "$SLOW" == *"$filter"* ]] && run_slow=1
pass=(); fail=(); skip=(); slow_skipped=()

for f in *_test.js log_triage.js *_test.py; do
  [ -e "$f" ] || continue
  [ -n "$filter" ] && [[ "$f" != *"$filter"* ]] && continue
  if [ $run_slow -eq 0 ] && [[ " $SLOW " == *" $f "* ]]; then
    slow_skipped+=("$f"); continue
  fi
  case "$f" in *.py) cmd=(python3 "$f");; *) cmd=(node "$f");; esac
  printf '\n\033[1m── %s\033[0m\n' "$f"
  "${cmd[@]}"; rc=$?
  case $rc in
    0) pass+=("$f");;
    2) skip+=("$f");;
    *) fail+=("$f");;
  esac
done

printf '\n\033[1m%d passed, %d failed, %d disabled\033[0m\n' \
  "${#pass[@]}" "${#fail[@]}" "${#skip[@]}"
if [ ${#skip[@]} -gt 0 ]; then
  printf '  \033[33mDISABLED:\033[0m %s\n' "${skip[*]}"
  printf '  \033[33m         these are NOT passing. Each names its own reason above:\n'
  printf '  \033[33m         a missing corpus fixture; dev/archive/, which a clone does not\n'
  printf '  \033[33m         have; or a browser that is not installed.\033[0m\n'
fi
if [ ${#slow_skipped[@]} -gt 0 ]; then
  printf '  \033[33mNOT RUN (slow):\033[0m %s\n' "${slow_skipped[*]}"
  printf '  \033[33m         nllb_diag_test.py is 14.4 s of real subprocess waits;\n'
  printf '  \033[33m         gui_crud_test.js is ~42 s and needs a Chromium a clone does not have.\n'
  printf '  \033[33m         Run ./dev/tests/run_all.sh --slow before a release.\n'
  printf '  \033[33m         new_version.py prints the reminder.\033[0m\n'
fi
if [ ${#fail[@]} -gt 0 ]; then
  printf '  \033[31mFAILED:\033[0m %s\n' "${fail[*]}"
  exit 1
fi
