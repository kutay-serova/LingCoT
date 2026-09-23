# =============================================================================
#  version.py, the application's version, defined once
#  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# =============================================================================
#  Until v3.14.88 the version existed ONLY in prose: the DEV_PLAN header and the
#  newest edit-log entry. It was not in the code, not in the UI, and not in the
#  session log. The consequence is concrete, a bug report could not be tied to a
#  build. On 2026-08-25 four bugs were diagnosed from user logs, and which build
#  produced them had to be inferred from FILE TIMESTAMPS.
#
#  TWO STREAMS, BOTH CORRECT. This project carries two independent version
#  numbers and they must not be reconciled:
#
#    __version__ here      the APPLICATION. LingCoT.html and its modules.
#    pyproject.toml        the PACKAGING stream (setup.py, build_env.py,
#                          requirements, README, corpus_*.py CLI tools). Last
#                          moved in April at 1.2.0, and accurate for what it
#                          versions.
#
#  Anyone "fixing" pyproject.toml to match this file is making things worse.
#  See dev/archive/README.md and dev/audits/PIPELINE_AUDIT.md section 2.
#
#  Bumped by dev/new_version.py. doc_integrity_test.js asserts this string, the
#  DEV_PLAN header and the newest edit-log entry all agree, three places that
#  could otherwise drift silently, which is how the archive ended up
#  non-monotonic across an abandoned v4.0 renumbering.
# =============================================================================

__version__ = "3.14.419+tb-prep"

# Not semantic versioning, and it should not pretend to be: the patch field is a
# build counter. Twenty bumps landed on 2026-08-24, several for documentation.
# That is fine for an application; it is recorded here so nobody reads meaning
# into a patch bump that is not there.
__version_scheme__ = "build-counter"
