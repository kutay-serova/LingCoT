#!/usr/bin/env node
/* =============================================================================
   variation_fields_test.js, the two variation fields mean different things
   Run:  node dev/tests/variation_fields_test.js
   =============================================================================
   B-044. `alternate_forms` was stored on every save, rendered as chips, editable
   in two panels and provenance-tracked, and **read by nothing**. 0 of 238
   entries populated: not annotator neglect, but what the field was worth.

   It was also ambiguous. Nothing told the annotator whether `gitti` under
   `gitmek` was an inflected form, a dialect variant, or a typo, and those want
   three different fates. FLEx splits them on CONDITIONING: allomorphs are
   principled alternations and carry an environment; variants are unconditioned.

   THE SPLIT, decided 2026-08-27:
     allomorphs  { form, environment }   conditioned. The environment is what
                                         makes it conditioned, so it is required
                                         for the field to mean anything.
     variants    [ form ]                unconditioned. DOCUMENTATION ONLY.
     inflected forms                     neither — D37 paradigms.

   THE RULE THIS GUARD HOLDS: **neither field is matchable.**

   ── Edited deliberately at v3.14.282, which is D35 stage C ───────────────────
   The rule used to read "while D35 is open", and D35 stage B closed at
   v3.14.282. That clause expiring is the whole reason stage C exists as a named
   step: a guard whose stated reason has lapsed gets repaired in passing by
   whoever meets it next, and repaired means weakened.

   **The assertion does not change. The reason does.** D35 removed the stated
   blocker and not the actual one. B-044 decided what these fields ARE:
   `variants` is DOCUMENTATION ONLY and inflected forms were sent to D37. So
   matching a token against a variant is not an ambiguity question that D35's
   chooser now answers — it is a claim that a surface form belongs to a lexeme,
   which is a PARADIGM question, and D37 has not yet said what an inflected form
   even is. Owned by D37 (and D40, which would consume it), not by D35.

   That reasoning is standing, not a countdown. If it is ever overturned, the
   overturning belongs in D37's design document and this comment gets rewritten
   from there, not deleted here.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const { SRC, ROOT, read, fnSrc, locale, decomment } = require('./_source.js');
const { loadCompanion, companionsIn, corpusDir } = require('./_fixture.js');
// B-128, one dictionary parse. B-169: and one answer to WHICH dictionaries.

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const html = read('LingCoT.html');
const ev   = read('modules/events.js');
const LOC  = locale();

console.log('\nthe rename is complete, and old data still opens\n');
{
  /* v3.14.262: the field is written by applyForm from the table rather than by a
     line naming it, so the question this asks had to change with the mechanism.
     What still has to be true is that the field is DECLARED fillable and not
     opted out of the writer — a `manual` or `surface` variants field would be
     one nothing stores, which is the defect this guard exists for. */
  const FS = require('../../source/modules/field_spec.js');
  const vf = FS.fieldOf('dict_entry', 'variants');
  check(!!vf && FS.isFillable(vf) && !vf.manual && !vf.surface,
        'saveDictEntry writes `variants`, through the table and applyForm',
        '         a field the writer skips is a field the save drops');
  /* D58 §3, v3.14.386: the rename is FINISHED, and this section asserts that
     rather than asserting the fallback that carried it.

     B-044 renamed `alternate_forms` → `variants` at v3.14.138 and kept three
     things reading the old key: an inline fallback in the dict view, a
     `legacyKey` declaration feeding `renderField`, and a `delete` on save. All
     three were right while a dictionary written before the rename existed. The
     19 occurrences were all in `samples/turkish-test`, retired at v3.14.384, and
     no writer has emitted the key since. So the question the guard asks moves
     from "is the fallback present" to "is the old key gone from every reader,
     every writer and every file" — which is the same question B-044 asked, one
     stage further on. */
  const F = require('../../source/modules/field_spec.js');
  const variants = F.fieldOf('dict_entry', 'variants');
  check(!('legacyKey' in (variants || {})),
        'no field declares a legacyKey, and `variants` was the only one that did',
        `got ${variants?.legacyKey}`);
  check(!/f\.legacyKey/.test(read('LingCoT.html')),
        'and renderField no longer has the mechanism to honour one',
        '         a mechanism with no declaration left is the shape D58 §3 exists to close');
  check(!/alternate_forms/.test(decomment(html)),
        'no reader, writer or save path in the app names `alternate_forms`',
        '         one surviving reference would be the rename half-finished for a third time');
  check(!/alternate_forms/.test(ev), 'events.js creates entries with `variants`');
  /* And the DATA, which the code check says nothing about: a shipped dictionary
     still carrying the old key would now render and save as empty. */
  {
    const offenders = [];
    for (const p of companionsIn('dictionary'))
      for (const r of loadCompanion(p, 'variants rename').records)
        if (r && typeof r === 'object' && 'alternate_forms' in r)
          offenders.push(`${path.basename(p)}:${r.id || '(no id)'}`);
    check(offenders.length === 0,
          'and no shipped dictionary row still carries it',
          `         ${offenders.length}: ${offenders.slice(0, 5).join(', ')}`);
  }
  check(typeof LOC['label.editor.variants'] === 'string'
     && !Object.keys(LOC).some(k => k.endsWith('alternate_forms')),
        'the locale carries `variants` and no longer carries the old keys');
}

console.log('\nthe two fields are documented as different things\n');
{
  const schema = html.slice(html.indexOf('DICTIONARY ENTRY'), html.indexOf('Locale strings'));
  check(/variants/.test(schema) && /allomorphs/.test(schema),
        'both fields appear in the schema block');
  check(/UNCONDITIONED/.test(schema) && /CONDITIONED/.test(schema),
        'and the schema states the distinction, which is the whole point of the split',
        '         B-044 existed because nobody had written down what the field meant');
  check(!/\[ entry\.id/.test(schema),
        'the schema no longer claims entry ids where the code writes strings',
        '         that contradiction stood for months and nothing checked it');

  const hint = LOC['hint.es.allomorphs'] || '';
  check(/condition/i.test(hint) && /environment/i.test(hint),
        'the allomorph hint names conditioning and the environment');
  check(/variants/i.test(hint),
        'and points unconditioned variation at the other field',
        '         a user who cannot tell the fields apart will use neither');
  check(/not inflected/i.test(LOC['placeholder.editor.variants'] || ''),
        'the variants placeholder rules out inflected forms (those are D37)');
}

console.log('\nneither field is matchable, and that is D37\u2019s decision to change\n');
{
  /* The check that matters. If either field is ever indexed or read by a lookup,
     this fails, and whoever did it has to come here and say why. */
  const idx = fnSrc('LingCoT.html', 'buildDictIndex');
  check(!/variants|alternate_forms|allomorphs/.test(idx),
        'buildDictIndex indexes neither variants nor allomorphs',
        '         indexing either one makes a surface form claim a lexeme, which is\n'
      + '         a PARADIGM claim (D37), not the ambiguity one D35 answered');

  /* Writing the field is fine (a new entry initialises `variants: []`); READING
     it in a lookup is the thing that must not happen. Strip initialisers before
     testing, otherwise the check fails on entry construction and gets weakened
     by whoever hits it next. */
  const stripInit = src => src.replace(/\b(variants|alternate_forms|allomorphs)\s*:\s*(\[\s*\]|null)/g, '');
  for (const fn of ['lookupDict', 'resolveDictEntry', '_resolveOrCreateLemma']) {
    const src = stripInit(fnSrc('LingCoT.html', fn));
    check(!/variants|alternate_forms|allomorphs/.test(src),
          `${fn}() does not read either field`,
          '         initialising the field is fine; matching on it is not');
  }

  /* v3.14.282: and the two resolvers D35 stage B added take the same rule. They
     are new token→entry paths, which is exactly the shape this guard exists for,
     so they join the list rather than being exempt from it by being newer. */
  for (const fn of ['dictResolution', 'resolveLemma']) {
    const src = stripInit(fnSrc('LingCoT.html', fn));
    check(!/variants|alternate_forms|allomorphs/.test(src),
          `${fn}() does not read either field either`,
          '         D35 stage B gave the app two more places to resolve a form from');
  }
}

console.log('\nallomorphs are visible wherever they can be entered\n');
{
  /* The editor was never gated; the view was gated to `isMorpheme`. So a word
     entry could be given allomorphs, saved, and never show them again. Stems
     have allomorphs too (Turkish köprü/köprü-sü, English knife/knive-), so the
     view was ungated rather than the editor gated. */
  const view = html.slice(html.indexOf('dict-allomorphs') - 200, html.indexOf('dict-allomorphs') + 200);
  check(!/isMorpheme && e\.allomorphs/.test(view),
        'the allomorph view is not gated to morpheme entries',
        '         gated view + ungated editor = data you can enter and never see');
  check(/renderAllomorphsEditor\('ed-allomorphs'/.test(html),
        'and the editor is still present on the entry form');
}

console.log('\nthe fixture agrees with the schema\n');
{
  /* B-169. This walked `samples/` by hand and was therefore the one
     corpus-reading guard that ignored `$LINGCOT_TEST_CORPUS` — so the gate-1
     swap rehearsal, which is the migration's whole safety, did not cover it. A
     candidate corpus with a malformed `variants` or `allomorphs` would have
     passed the rehearsal and failed after the swap, at the one moment the
     rehearsal exists to prevent.

     `companionsIn` is `_fixture`'s answer to "which corpora am I looking at",
     which is that module's question — the hand-rolled walk here was a second
     answer to it, and the two disagreed by construction. */
  const dicts = companionsIn('dictionary');
  check(dicts.length > 0,
        `${dicts.length} dictionary file(s) to check, in ${corpusDir() || '(none)'}`,
        '         zero means the walk broke, not that the tree is clean');
  const bad = [];
  for (const f of dicts)
    for (const e of loadCompanion(f, 'stored variant shapes').records) {
      for (const v of (e.variants || []))
        if (typeof v !== 'string') bad.push(`         ${e.form}: variant is ${typeof v}, expected a form string`);
      for (const a of (e.allomorphs || []))
        if (typeof a !== 'object' || !('form' in a)) bad.push(`         ${e.form}: allomorph has no form`);
    }
  check(bad.length === 0, 'every stored variant is a string and every allomorph has a form',
        bad.join('\n'));
}

/* ═══ B-139 · why a string list needs no per-element stamp ══════════════════
   B-139 asked whether `source_ids`, `variants` and `constituent_forms` should
   become arrays of objects so each element could carry provenance. Decided
   v3.14.372: no — and the bug had grouped them by their STORAGE SHAPE, which is
   not the property that decides it.

   The property is the CONTROL. B-138's argument for stamping elements is that
   "the ordinary case is two translations added by different people years
   apart", and that case exists only where each element is added, kept and
   removed on its own — a ROW EDITOR. The three string lists are written by
   whole-value controls: `list` is one text input holding `a, b, c`, and
   `sources` is a picker returning the whole selection. One person, one act,
   every element. A per-element stamp there records the same moment N times,
   which is what the field stamp already says.

   THE PREMISE IS A FACT ABOUT TODAY'S APP, NOT A RULE, which is the whole
   reason this section exists rather than a paragraph in BUGS.md. Moving a list
   field from `_ARRAY_CONTROLS` to a row editor is one line, and it puts a
   second contributor into a field with nowhere to record them. This fails on
   that line. */
console.log('\nB-139 — the split is by control, and the premise is checked\n');
{
  /* DECOMMENTED. The first draft read the raw source, and the comment in
     `assignList` that records this very decision quotes
     `constituent_forms.join('-')` — so the check for that call matched the
     PROSE explaining it and survived the call being replaced. This project has
     made that mistake in three guards now (`input_attrs_test`, `cli_prov_test`,
     here); a guard that reads its own justification is asserting nothing. */
  const html = decomment(read('LingCoT.html'));
  const spec = decomment(read('modules/field_spec.js'));

  const arr  = /const _ARRAY_CONTROLS\s*=\s*\[([^\]]*)\]/.exec(html);
  const prov = /const _PROV_LIST_CONTROLS\s*=\s*\[([^\]]*)\]/.exec(html);
  check(!!arr && !!prov, 'both control lists found in applyForm');
  const lit = m => [...(m ? m[1] : '').matchAll(/'([^']+)'/g)].map(x => x[1]);
  const whole = lit(arr), rows = lit(prov);
  check(whole.length && rows.length && !whole.some(c => rows.includes(c)),
        `${whole.length} whole-value control(s) and ${rows.length} row editor(s), disjoint`,
        `       whole: ${whole.join(', ')} · rows: ${rows.join(', ')}`);

  /* DERIVED: which fields the decision actually covers, read off the table
     rather than named here. A fourth string list added next month is asked the
     same question without an edit to this file. */
  const STRING_LISTS = ['source_ids', 'variants', 'constituent_forms'];
  const controlOf = key => {
    const m = new RegExp(`\\{ key: '${key}'[^}]*?control: '([a-z]+)'`, 's').exec(spec);
    return m ? m[1] : null;
  };
  for (const k of STRING_LISTS) {
    const c = controlOf(k);
    check(c && whole.includes(c),
          `${k} is written whole, by a '${c}' control`,
          '       a row editor here means each element is a separate act by a\n'
        + '       possibly different person, and B-138\'s argument applies:\n'
        + '       move the key to a row editor and it needs per-element\n'
        + '       provenance, which means changing the element to an object.\n'
        + '       That is B-139 reopened — reopen it rather than deleting this.');
  }

  /* And the composed one, which makes the point twice: the order IS the
     analysis, so the list is one value in three pieces rather than three
     contributions. */
  check(/constituent_forms\.join\('-'\)/.test(html),
        'constituent_forms is joined into a parse, so its order is meaning',
        '       if this is gone, the field is a set and the argument above is\n'
      + '       the only one left standing for it');

  /* The whole-value path must NOT reach assignList: stamping elements there
     would write the same moment onto each and imply a history that is not
     there. This is the assertion the decision rests on. */
  const apply = /function applyForm\([\s\S]*?\n\}/.exec(html);
  check(!!apply, 'applyForm found');
  const body = apply ? apply[0] : '';
  check(/_PROV_LIST_CONTROLS\.includes\(f\.control\)\) assignList\(/.test(body),
        'assignList is reached only through the row-editor list');
  check(/_ARRAY_CONTROLS\.includes\(f\.control\)\) bag\[f\.key\] = val/.test(body),
        'and a whole-value list is assigned whole, with no element stamps',
        '       N identical stamps is not more provenance than one field stamp');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
