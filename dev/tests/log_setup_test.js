#!/usr/bin/env node
/* =============================================================================
   log_setup_test.js, session logs are pruned by age and tests never touch logs/
   Run:  node dev/tests/log_setup_test.js
   =============================================================================
   B-217: pruning sorted by file name, and the name carries local time. Logs
   written under another clock (a VM on UTC, travel, a DST change) sorted wrong,
   and a new session could delete its own log at startup.
   B-216: guards that import the app wrote their session logs into the repo's
   logs/, and the pruning above then deleted the author's real ones.
   Executed against the real log_setup.py in a temp directory.
   ============================================================================= */

const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot_logs_'));
const py = code => execFileSync('python3', ['-c', `import sys; sys.path.insert(0, ${JSON.stringify(SRC)})\n${code}`],
  { encoding: 'utf8', env: { ...process.env, LINGCOT_LOG_DIR: dir } }).trim();

console.log('\npruning keeps the newest by age, and never the current file\n');
{
  // 25 old logs named 23:xx (a UTC clock), older on disk than anything new.
  const now = Date.now() / 1000;
  for (let i = 0; i < 25; i++) {
    const f = path.join(dir, `app_2026-09-23_23${String(i).padStart(2, '0')}00.log`);
    fs.writeFileSync(f, 'old\n');
    fs.utimesSync(f, now - 3600 + i, now - 3600 + i);
  }
  // A session started on a local clock behind UTC: its name sorts first.
  const out = py(`
import log_setup, datetime
class D(datetime.datetime):
    @classmethod
    def now(cls, tz=None): return datetime.datetime(2026, 9, 23, 19, 17, 0)
log_setup.datetime = D
lg = log_setup.setup_session_logger(None, 'app')
lg.info('session line')
print([h.baseFilename for h in lg.handlers if hasattr(h, 'baseFilename')][0])`);
  const mine = path.basename(out);
  const left = fs.readdirSync(dir).filter(f => f.startsWith('app_'));
  check(mine === 'app_2026-09-23_191700.log', `the session log is named on its local clock (${mine})`);
  check(left.includes(mine), 'the new session keeps its own log, though its name sorts first');
  check(fs.existsSync(path.join(dir, mine)) && /session line/.test(fs.readFileSync(path.join(dir, mine), 'utf8')),
        'and writes to it');
  const MAX = Number(py('import log_setup; print(log_setup.MAX_SESSION_LOGS)'));
  check(left.length === MAX, `${MAX} logs retained (${left.length})`);
  check(!left.includes('app_2026-09-23_230000.log') && left.includes('app_2026-09-23_232400.log'),
        'the oldest by age went, the newest stayed');
}

console.log('\nLINGCOT_LOG_DIR moves the logs, and the suite sets it\n');
{
  check(fs.readdirSync(dir).length > 0, 'a logger started with LINGCOT_LOG_DIR writes there');
  check(!!process.env.LINGCOT_LOG_DIR && !process.env.LINGCOT_LOG_DIR.startsWith(path.join(SRC, '..')),
        `_source.js points guards away from the repo (${process.env.LINGCOT_LOG_DIR})`);
  const ra = fs.readFileSync(path.join(__dirname, 'run_all.sh'), 'utf8');
  check(/export LINGCOT_LOG_DIR=/.test(ra) && /logs\/ changed during the run/.test(ra),
        'run_all.sh exports it and fails if logs/ changed');
}

try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
