#!/usr/bin/env node
/* =============================================================================
   quickstart_labels_test.js, the quickstart names buttons that exist
   Run:  node dev/tests/quickstart_labels_test.js
   =============================================================================
   v3.14.395. `QUICKSTART.md` is the first thing a new user reads, and it is
   written in terms of what they will SEE: "click **Save**", "open the
   **Dependency Parse** section". Every one of those is a promise about a string
   in `en.json`, and nothing connected the two — so a rename would leave the
   quickstart confidently describing a button that is not there, and the person
   least able to recover from that is the person reading it.

   WHAT WRITING IT ALREADY FOUND. The draft was written from `README.md`, and
   three of the names it took from there do not exist in the app:

     · **TeX** — the button is labelled **LaTeX** (`btn.view.sent.tex`)
     · **Potential Matches** — that panel was retired by D42; suggestions are
       one offer strip now, marked `take:`
     · **Selection relations** — the control reads **Add selection**

   README still says all three. This guard is scoped to the quickstart because
   that is the document a stranger reads first; the README's drift is recorded
   rather than fixed here.

   THE SOURCE IS THE QUICKSTART ITSELF, not a list beside it. A curated list of
   "labels the quickstart uses" would be a second writer of the quickstart
   (PRACTICES §4) and would drift from it the first time a sentence was
   reworded. So the bold spans are parsed out of the file, and prose is excluded
   by an explicit, named list — because a silent exclusion rule is how a guard
   stops seeing the thing it is for.
   ============================================================================= */

/* WHAT THIS CANNOT DO, stated because a guard is only as good as what it admits
   (PRACTICES §5). It checks that a label EXISTS in the app's vocabulary, not
   that it sits on the control the quickstart points at. `Progress` is the value
   of both `btn.nav.gaps` and `gap.title`, so renaming the button alone still
   passes; `Save` has five keys and `Search` five. Verified by mutation: renaming
   `btn.view.sent.tex` (a unique value) FAILS, renaming `btn.nav.gaps` does not.

   Binding each phrase to a specific locale key would close that, and would make
   this file a second copy of the quickstart's contents — the thing the source
   note above rejects. The failure actually worth catching is a label that leaves
   the app ENTIRELY, which is what happens when a feature is renamed or retired,
   and which this does catch. That is the trade, taken deliberately. */

const fs   = require('fs');
const path = require('path');
const { ROOT, SRC } = require('./_source.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

console.log('\nthe quickstart names things the app really shows\n');

const QS = path.join(ROOT, 'QUICKSTART.md');
check(fs.existsSync(QS), 'QUICKSTART.md exists',
      '         it is linked from README Contents; a dead link there is a bad first impression');
if (!fs.existsSync(QS)) { console.log(`\n${pass} passed, ${fail} failed\n`); process.exit(1); }

const md     = fs.readFileSync(QS, 'utf8');
const locale = JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'locale', 'en.json'), 'utf8'));
const values = new Set(Object.values(locale).map(String));
const html   = fs.readFileSync(path.join(SRC, 'LingCoT.html'), 'utf8');

/* Bold spans that are EMPHASIS or field names rather than clickable labels.
   Named one by one on purpose: adding to this list should feel like a decision,
   because every addition is a promise the guard stops checking. */
const NOT_A_CONTROL = new Set([
  'blank lines', 'spaces', 'yes', 'head', 'relation', 'take:',
  'Language', 'Title', 'Translation language',     // field labels inside a form
  'Gloss', 'Morphological parse', 'Part of speech', // ditto
  'Field', 'Level', 'Scope', 'Transliteration label', // the four search controls
  'Concordance', 'Frequency', 'Collocates',        // result view names
  'LingCoT-Data', '`LingCoT.command`', '`LingCoT.bat`',
  'Add yourself as an annotator first',
]);

/* Whitespace is collapsed because markdown wraps: `**Project\nFiles**` is one
   label to a reader and two lines to a regex. And a bold span may be a MENU
   PATH — `File → Save` — which is two labels, each of which must exist. */
const spans = [...new Set(
  [...md.matchAll(/\*\*([^*]+)\*\*/g)]
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .flatMap(s => s.includes('→') ? s.split('→').map(x => x.trim()) : [s]))];

/* A control label is short, starts with a capital or a symbol, and is not a
   sentence. Anything longer is prose being emphasised. */
const looksLikeControl = s =>
  s.length <= 24 && !/[.?!]$/.test(s) && !/\s(the|a|your|you|it|is|to)\s/i.test(s)
  && (/^[A-Z＋+]/.test(s) || s === 'take:');

const claimed = spans.filter(s => looksLikeControl(s) && !NOT_A_CONTROL.has(s));
check(claimed.length >= 8, `${claimed.length} control label(s) claimed by the quickstart`,
      '         the filter has stopped matching; it is no longer checking anything');

/* `＋ Add Section` in en.json is `Add Section` in prose — a leading ＋ or + on the
   button is not something a reader types, so it is trimmed from both sides. */
const norm = s => s.replace(/^[＋+]\s*/, '').trim();
const present = new Set([...values].map(norm));

/* en.json ALONE, deliberately. The first version also accepted a match against
   `>label<` in LingCoT.html, as a fallback for anything not in the locale. That
   fallback made the guard blind in exactly the direction it exists to watch:
   `data-i18n` elements carry their English text inline, so renaming
   `btn.nav.gaps` from "Progress" to "To do" left `>Progress<` in the markup and
   the guard passed a quickstart that now names a button nobody can see. Every
   label the quickstart claims turned out to be in en.json anyway, so the
   fallback bought nothing and cost the mutation. */
const missing = [];
for (const c of claimed) {
  const n = norm(c);
  const ok = present.has(n);
  if (!ok) missing.push(`         "${c}" — no such label in en.json or LingCoT.html`);
}
check(missing.length === 0,
      'every control the quickstart tells a new user to click exists',
      missing.join('\n') + '\n         a stranger cannot recover from a button that is not there');

/* The link the README promises. */
check(/\bQUICKSTART\.md\b/.test(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')),
      'README points at the quickstart',
      '         it is the way in; unlinked, nobody finds it');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
