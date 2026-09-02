#!/usr/bin/env node
/* =============================================================================
   word_gloss_source_test.js — where a word's gloss comes from, and what it says
   Run:  node dev/tests/word_gloss_source_test.js
   =============================================================================
   One field, two ways to acquire a value, and a rule about which of them the
   record may claim.

     B-191  `#ew-gloss` is filled with `wordGloss(word)` — the DERIVED join, for
            a word that stores no gloss of its own (B-187). `storedWordGloss`
            then asked whether that value equalled the join of the morphemes AS
            THEY ARE AFTER THE SAVE, and after a segmentation it never does:
            `in the afternoon` is not `noon-ABL`. So the app's own derivation was
            stored as though typed, signed with the annotator's stamp, and from
            then on overrode the segmentation beneath it. Three words were in
            that state in the live corpora and provenance could not tell them
            from a deliberate choice. The honest test is not about the morphemes
            at all: did the person touch the field.

     L-040  Which leaves a real question, because the derivation WAS the
            annotator's answer — it lived on the whole-word morpheme, and in
            `turkish-test` that was the only copy of 123 glosses. So a
            segmentation PROMOTES it to the word, deliberately, carrying its
            original stamp: the words are the same words, written when they were
            written. Nothing is lost, so the confirm has nothing to ask about.

     DECIDED  A stored word gloss and the morpheme join may legitimately differ
            (`下午` = `down-noon` = `afternoon`). The word gloss stays primary;
            the join gets its own interlinear line, drawn only where they
            disagree, so neither claim is invisible.

   WHAT IS EXECUTED, AND WHAT IS NOT. The plan, the loss test and the interlinear
   are run — sections 1–3 build words, call the real functions, and read what
   comes back. `saveWord`'s wiring is asserted against the source in section 4,
   because reaching it needs the whole word-editor DOM; `gui_crud_test.js` is
   where that path is exercised for real. The division is stated rather than
   blurred: a source assertion is weaker evidence and should look like it.
   ============================================================================= */

const vm = require('vm');
const { read, decomment } = require('./_source.js');
const { appSources, makeCtx, loadApp } = require('./_dom.js');

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; console.log(`  FAIL ${label}`); if (detail) console.log(detail); }
};

const ctx = makeCtx({ hasId: () => true });
const errs = loadApp(ctx, appSources());
check(errs.length === 0, 'the app loads into the stub DOM',
      errs.map(([f, e]) => `         ${f}: ${e.message}`).join('\n'));
const run = expr => vm.runInContext(expr, ctx);

/* The state ingest leaves: one morpheme equal to the word, the gloss on it, and
   nothing stored on the word itself. 301 of 365 words in the live corpora. */
const wholeWord = (extra = {}) => ({
  id: 'w1', form: 'öğleden', morphological_parse: 'öğleden',
  morphemes: [{ id: 'w1.m_001', form: 'öğleden', gloss: 'in.the.afternoon',
                transliterations: [], field_prov: { gloss: 3 }, ...extra }],
});

console.log('\n1 · executed: what the promotion takes, and when');

{
  const w = wholeWord();
  const plan = ctx.wholeWordGlossPlan(w, ['öğle', 'den']);
  check(!!plan && plan.take.gloss === 'in.the.afternoon',
        'segmenting a whole-word morpheme promotes its gloss to the word',
        `         got ${JSON.stringify(plan)}`);
  check(plan && plan.morpheme === w.morphemes[0],
        'the plan names the morpheme it takes from',
        '         the loss test asks what would remain ON THAT OBJECT');
  check(w.gloss === undefined && w.morphemes[0].gloss === 'in.the.afternoon',
        'and NOTHING has moved yet',
        '         a plan, not a write: the annotator has not agreed yet, and a\n'
      + '         cancelled confirm must leave the stored morpheme untouched');
}

check(ctx.wholeWordGlossPlan(wholeWord(), ['öğleden']) === null,
      'a morpheme that survives the pairing is not promoted',
      '         nothing is being discarded, so nothing needs carrying');

{
  const w = wholeWord();
  w.form = 'başka';               // the morpheme is no longer word-sized
  check(ctx.wholeWordGlossPlan(w, ['a', 'b']) === null,
        'a morpheme that is not the whole word is not promoted',
        '         `in the afternoon` is what ÖĞLEDEN means; carrying a partial\n'
      + '         segment\'s gloss up to the word would assert something false');
}

{
  const w = wholeWord();
  w.morphemes.push({ id: 'w1.m_002', form: 'x' });
  check(ctx.wholeWordGlossPlan(w, ['a', 'b']) === null,
        'a word with two morphemes is not promoted from');
}

{
  const w = wholeWord();
  w.gloss = 'the annotator typed this';
  const plan = ctx.wholeWordGlossPlan(w, ['öğle', 'den']);
  check(!plan || !plan.take.gloss,
        'the annotator\'s own word gloss is never overwritten by a promotion',
        `         got ${JSON.stringify(plan)}`);
}

{
  const w = wholeWord({ part_of_speech: 'NOUN' });
  const plan = ctx.wholeWordGlossPlan(w, ['öğle', 'den']);
  check(plan && plan.take.part_of_speech === 'NOUN',
        'a part of speech is promoted too — it is a claim about the same form');
  const w2 = wholeWord({ type: 'word', dict_id: 'dict_1' });
  const plan2 = ctx.wholeWordGlossPlan(w2, ['öğle', 'den']);
  check(plan2 && !('type' in plan2.take) && !('dict_id' in plan2.take),
        'type and dict_id are NOT — they are facts about a morpheme',
        '         a word cannot carry "this is bound" or "this links to that\n'
      + '         morpheme record" without changing what the claim means');
}

console.log('\n2 · executed: the confirm asks about what would be LOST');

{
  const w = wholeWord();
  const plan = ctx.wholeWordGlossPlan(w, ['öğle', 'den']);
  check(ctx.unpairedMorphemes(w.morphemes, ['öğle', 'den'], plan).length === 0,
        'a morpheme whose whole content is being carried is not a loss',
        '         this is L-040 itself: the dialog fired on 3 of 11 words, on\n'
      + '         exactly the ones where the segmentation work is');
  check(ctx.unpairedMorphemes(w.morphemes, ['öğle', 'den'], null).length === 1,
        'and without the plan it still is — the plan is what makes it safe',
        '         if this passes with null too, the check below proves nothing');
}

{
  const w = wholeWord({ dict_id: 'dict_1' });
  const plan = ctx.wholeWordGlossPlan(w, ['öğle', 'den']);
  check(ctx.unpairedMorphemes(w.morphemes, ['öğle', 'den'], plan).length === 1,
        'a dictionary link that is NOT carried still raises the confirm',
        '         25 of 123 Turkish whole-word morphemes carry one; the dialog\n'
      + '         is truthful for those and must not be suppressed with the rest');
}

console.log('\n3 · executed: both glosses are shown, and only where they differ');

ctx.__docs = [{
  id: 'doc1', metadata: { title: 't' },
  sections: [{ id: 's1', title: 's', paragraphs: [{ id: 'p1', sentences: [{
    id: 'sent1', text: 'öğleden bir', words: [
      /* Stored word gloss DISAGREEING with its morphemes — B-191's live case. */
      { id: 'w1', form: 'öğleden', gloss: 'noon', morphological_parse: 'öğle-DAn',
        morphemes: [{ id: 'm1', form: 'öğle', gloss: 'noon' },
                    { id: 'm2', form: 'DAn', gloss: 'ABL' }] },
      /* An ordinary word: no stored gloss at all. */
      { id: 'w2', form: 'bir', morphemes: [{ id: 'm3', form: 'bir', gloss: 'one' }] },
    ] }] }] }],
}];
run("applyCorpus(__docs, 'gloss-src');");
run("S.view = 'sentence'; S.sentId = 'sent1'; S.sectIdx = 0; S.paraIdx = 0;");
check(run('!!doc()'), 'the fixture is loaded');

let igt = '';
try { igt = String(run('renderSentence()')); }
catch (err) { check(false, 'renderSentence runs', `         ${err.message}`); }

check(/igt-t-gloss[^>]*>noon</.test(igt.replace(/\s+/g, ' ')),
      'the stored word gloss is on the gloss line — it is the primary one',
      `         ${(igt.match(/igt-t-gloss[\s\S]{0,80}/) || [''])[0]}`);
check(/igt-t-mgloss/.test(igt),
      'the morpheme join gets a line of its own',
      '         without it a segmentation can sit under a word gloss written\n'
    + '         before it and nothing says so — which is how B-191 went unseen');
check(/noon-ABL/.test(igt),
      'and that line says what the morphemes actually join to',
      `         ${(igt.match(/igt-t-mgloss[\s\S]{0,90}/) || [''])[0]}`);

/* One row per tier across every column, or the tiers stop lining up — which is
   the one thing this view exists to do. */
const cols = (igt.match(/class="igt-word/g) || []).length;
const mrows = (igt.match(/class="igt-t-mgloss"/g) || []).length;
check(cols > 1 && mrows === cols,
      `every column draws the row (${mrows} of ${cols}), blank where there is nothing to say`,
      '         a column one line shorter than its neighbours breaks the\n'
    + '         alignment the interlinear block is for');

/* And it is not drawn at all when nothing disagrees.

   SET AFTER THE LOAD, deliberately. Putting an agreeing gloss in the fixture and
   calling `applyCorpus` measured nothing: B-186's migration drops a stored word
   gloss that equals the morpheme join on the way in, so the state under test was
   gone before the render — a mutation that removed the de-duplication passed.
   Stored data cannot hold this case; the in-memory moment between a save and the
   next load can, and that is the one the line has to be right for. */
run("findWord('w1').word.gloss = 'noon-ABL';");
const agreed = String(run('renderSentence({ force: true }) || renderSentence()'));
check(!/igt-t-mgloss/.test(agreed),
      'a word whose gloss agrees with its morphemes adds no second line',
      '         an ordinary word must gain nothing to read past');

console.log('\n4 · read, not executed: what saveWord does with the box');

const html = decomment(read('LingCoT.html'));
const save = (html.match(/function saveWord\([\s\S]*?\n\}/) || [''])[0];
check(save.length > 0, 'saveWord found');

check(/_glossTouched\s*=\s*!!_glossEl && _glossEl\.value\.trim\(\) !== \(_glossEl\.dataset\.original \|\| ''\)\.trim\(\)/.test(save),
      'the question asked is whether the person touched the field',
      '         not whether the value equals a join — that comparison is what\n'
    + '         stored the app\'s own derivation as an answer (B-191)');

check(/_explicitGloss = _glossTouched \? wGloss\s*\n?\s*:\s*\(_glossPlan && _glossPlan\.take\.gloss\) \|\| undefined/.test(save),
      'exactly two sources for a stored word gloss: typed, or promoted',
      '         `undefined` is the third state and must stay reachable — it means\n'
    + '         "not addressed", which leaves an existing stored gloss alone');

check(/explicit: \{ parse: wParse, translits: wTranslits, gloss: _explicitGloss \}/.test(save),
      'and that is what the deriver is given',
      '         passing `wGloss` here is the bug itself');

check(/if \(wPos\)\s+word\.part_of_speech = wPos;[\s\S]{0,200}?else if \(_posPromoted\)[\s\S]{0,80}?else\s+delete word\.part_of_speech;/.test(save),
      'the promoted part of speech goes through the ONE writer of that key',
      '         assigned before it, the `else delete` removes it again on the\n'
    + '         same save — which an earlier draft of this change did');

check(/const idx = _glossPlan\.morpheme\.field_prov\?\.\[key\];[\s\S]{0,200}?stampField\(word, key, moment\)/.test(save),
      'a promoted value carries its original stamp',
      '         re-signing it with the moment of the segmentation would make the\n'
    + '         record say the gloss was written later than it was — B-141 on purpose');

/* `\s*=\s*`, not a literal space. The version that wrote this guard had just
   loosened the same brittleness in `igt_align_test` and then committed it here
   an hour later: the source aligns the assignment, and a guard that fails on
   alignment is a guard about formatting. */
check(/_glossPlan\s*=\s*wholeWordGlossPlan\(word, _rowForms\);[\s\S]{0,400}?if \(!confirmAnnotationLoss/.test(save),
      'the plan is computed before the confirm, and applied after it',
      '         a cancelled confirm must leave the stored morpheme as it was');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
