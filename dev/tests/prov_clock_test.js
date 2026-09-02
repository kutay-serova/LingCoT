#!/usr/bin/env node
/* =============================================================================
   prov_clock_test.js, a provenance stamp comes off one clock
   Run:  node dev/tests/prov_clock_test.js
   =============================================================================
   B-105. A provenance record carries a date and a time. They were computed from
   different clocks: the date through toISOString(), which converts to UTC first,
   the time through toTimeString(), which does not. West of Greenwich that makes
   every evening session read as tomorrow at yesterday's hour, and nothing about
   the file says so. 303 of the 522 stamps in the Turkish test corpus were wrong
   before this was noticed.

   The rule this guards is narrow and mechanical: no calendar date anywhere in
   this app is formatted through toISOString(). Times were never the problem, so
   toISOString may still appear for anything that is genuinely an instant.
   ============================================================================= */

const { read, fnSrc, decomment, moduleFiles } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log('       ' + detail); }
};

const html  = read('LingCoT.html');
const files = [['LingCoT.html', html], ...moduleFiles()];

/* ── 1. no date is cut out of a UTC string ──────────────────────────────────
   slice(0, 10) of an ISO string is the calendar date, and that is the shape
   that was wrong. */
for (const [name, src] of files) {
  const hits = [...decomment(src).matchAll(/toISOString\(\)\s*\.?\s*slice\(\s*0\s*,\s*10\s*\)/g)];
  check(hits.length === 0,
        `${name} formats no date through toISOString()`,
        `${hits.length} site(s) left; use localDate() instead`);
}

/* ── 2. the helpers exist and read the local fields ─────────────────────────*/
check(/function localDate\s*\(/.test(html), 'localDate() is defined');
check(/function localTime\s*\(/.test(html), 'localTime() is defined');

const ld = fnSrc('LingCoT.html', 'localDate') || '';
for (const m of ['getFullYear', 'getMonth', 'getDate'])
  check(ld.includes(m), `localDate reads ${m}(), the local field`);
check(!/getUTC/.test(ld), 'localDate reads no UTC field');

/* ── 3. every stamp takes both halves from the same clock ───────────────────
   A stamp is any object literal carrying a date: and a time: together. Both
   must come from the local helpers. */
const src = decomment(html);
const stamps = [...src.matchAll(/date:\s*([^\n,]+),\s*\n\s*time:\s*([^\n,]+),/g)];
check(stamps.length >= 2, `found ${stamps.length} provenance stamp(s) to check`);
for (const m of stamps) {
  check(/localDate\(/.test(m[1]) && /localTime\(/.test(m[2]),
        `a stamp takes date and time from the local helpers: ${m[1].trim()}`,
        'mixing clocks is exactly B-105');
}

/* ── 4. today() is the same clock as a stamp's date ─────────────────────────*/
check(/const today\s*=\s*\(\)\s*=>\s*localDate\(\)/.test(html),
      "today() is localDate()",
      'a translation dated by one clock and stamped by another disagree with themselves');

/* ── 5. run the helper against a date that straddles the rollover ───────────
   Reading cannot show that 31 December at 20:00 local is still 31 December. */
{
  const fn = new Function(`${ld}\nreturn localDate;`)();
  const d  = new Date(2026, 11, 31, 20, 30, 0);   // local, deliberately late
  check(fn(d) === '2026-12-31',
        'an evening on the last day of the year stays on that day', `got ${fn(d)}`);
  const e = new Date(2026, 0, 5, 23, 59, 0);
  check(fn(e) === '2026-01-05', 'and one minute before midnight is still today', `got ${fn(e)}`);
  const f = new Date(2026, 8, 9, 0, 1, 0);
  check(fn(f) === '2026-09-09', 'single-digit month and day are padded', `got ${fn(f)}`);

  /* v3.14.254: the three checks above run in whatever timezone the machine is
     set to, and B-105 was a WEST-of-Greenwich bug — `toISOString()` for the date
     beside `toTimeString()` for the hour, so an evening stamp carried tomorrow's
     date. Under UTC a UTC-reading `localDate` answers identically and all three
     pass, which is what this environment does: mutation-tested, a UTC-reading
     `localDate` passed in UTC and Asia/Tokyo and failed only in
     America/Los_Angeles. So on a CI box set to UTC, nothing here guarded B-105.

     Run it again in a child process under a fixed offset either side of
     Greenwich. Node honours TZ, so this reproduces the exact condition rather
     than hoping the developer's machine is in the right hemisphere. */
  const { execFileSync } = require('child_process');
  const probe = `${ld}\nconst d = new Date(Date.UTC(2027, 0, 1, 3, 30));\n`
              + `process.stdout.write(localDate(d));`;
  for (const [tz, expect, why] of [
    ['America/Los_Angeles', '2026-12-31', 'west of Greenwich, where B-105 lived: 03:30 UTC is the previous evening'],
    ['Asia/Tokyo',          '2027-01-01', 'east of it, where the same instant is already the next day'],
  ]) {
    let got = '';
    try {
      got = execFileSync(process.execPath, ['-e', probe],
                         { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim();
    } catch (err) { got = `(threw: ${err.message})`; }
    check(got === expect,
          `and in ${tz} the same instant reads ${expect}`,
          `         got ${got} — ${why}.\n`
          + '         A date read from the UTC fields and a time read from the local ones\n'
          + '         is B-105, and it is invisible to a check run in UTC.');
  }
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
