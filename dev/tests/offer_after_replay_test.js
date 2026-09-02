#!/usr/bin/env node
/* =============================================================================
   offer_after_replay_test.js — what the load OFFERS is asked of the final state
   Run:  node dev/tests/offer_after_replay_test.js
   =============================================================================
   B-192. Reported from use: "the chinese corpus prompts for auto-fill, I accept
   them, and the next open reprompts."

   THE ORDER IS THE BUG, and every part of it is individually correct.
   `loadProject` applies the corpus, applies the dictionary, and replays the
   journal LAST — deliberately, because one action can write to both stores and a
   journalled record naming a dictionary entry has to find it. But
   `offerDictFill()` is called from inside `applyDict`, so the proposal was
   computed one step too early: against the corpus as it sits on disk, before the
   journal carrying the previous session's ACCEPTED fills was applied.

   So every fill the annotator had already taken was offered again, on every
   open, for as long as no full write compacted the journal into the base. On the
   reported corpus that was two days.

   THE CLASS, not the instance. The block this fix joins already existed and
   already says why: *"a journal carries record BODIES as some earlier version
   wrote them, and replay puts those bodies back onto a tree the load-time
   migrations have already cleaned. Every migration has that hole."* The offer
   has the same hole. Section 3 holds the general rule — anything computed from
   the whole corpus during the load has to be recomputed after the replay — so
   the next thing added to `applyDict` is covered without an edit here.

   EXECUTED AGAINST A REAL JOURNAL. The harness builds a corpus, accepts the
   offer, journals the acceptance the way `mutate` does, and reloads from the
   base + journal. A shape check could not have found this: every function
   involved is right, and only their order is wrong.
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
ctx.__loc = JSON.parse(read('resources/locale/en.json'));
run('_LOCALE = __loc;');

/* One word, one morpheme, no gloss — and a dictionary entry that can supply one.
   That is the whole of what the offer is for. */
const DOCS = [{
  id: 'doc1', metadata: { title: 't', language: 'zho' },
  sections: [{ id: 's1', title: 's', paragraphs: [{ id: 'p1', sentences: [{
    id: 'sent1', text: '只', words: [
      { id: 'w1', form: '只', morphemes: [{ id: 'w1.m_001', form: '只' }] }] }] }] }],
}];
const DICT = [{ id: 'd1', form: '只', type: 'word', part_of_speech: 'CLF',
                gloss: 'classifier' }];

ctx.__docs = JSON.parse(JSON.stringify(DOCS));
ctx.__dict = DICT;
const offered = () => run("(offerCounts(dictFillProposal()) || {}).morphemes || 0");

console.log('\n1 · the offer, and taking it');

run("applyCorpus(__docs, 'b192'); applyDict(__dict, 'b192');");
check(offered() === 1, 'an unglossed morpheme the dictionary can fill is offered',
      `         got ${offered()}`);

run("__taken = acceptFillGroups(dictFillProposal());");
check(offered() === 0, 'accepting it clears the offer',
      `         got ${offered()} — if this fails the rest measures nothing`);
check(run("__taken.words") === 1, 'and it reports what it wrote');

console.log('\n2 · the acceptance survives a reload only through the journal');

/* The base is the corpus as it was BEFORE the acceptance — which is the state on
   disk until a full write compacts the journal. That gap is the bug's whole
   habitat, and the reported corpus sat in it for two days. */
ctx.__base = JSON.parse(JSON.stringify(DOCS));
const jrnl = run(`(() => {
  const w = findWord('w1').word;
  return JSON.stringify({ record_type: 'journal_head', corpus: null, dict: null,
                          opened: '2026-09-02 01:34' })
       + '\\n' + JSON.stringify({ op: 'put', t: 'corpus', id: w.id, rec: expandProv(w) });
})()`);
ctx.__jrnl = jrnl;
check(/"gloss":"classifier"/.test(jrnl),
      'the journal record carries the accepted fill',
      `         ${String(jrnl).slice(0, 160)}`);

run("applyCorpus(__base, 'reopen'); applyDict(__dict, 'reopen');");
check(offered() === 1,
      'on the BASE alone the fill is missing, so the offer is right to fire',
      '         this is the state applyDict sees, and why the order matters');

console.log('\n3 · after the replay, the offer reflects the final state');

const rep = JSON.parse(run("JSON.stringify(replayJournal(__jrnl))"));
check(rep.applied === 1, `the journal replays (${rep.applied} applied)`, JSON.stringify(rep));
check(run("findWord('w1').word.morphemes[0].gloss") === 'classifier',
      'and the accepted gloss is back on the morpheme');
check(offered() === 0,
      'THE OFFER IS NOW EMPTY — nothing is proposed twice',
      `         got ${offered()}: the annotator would be asked again for a fill\n`
    + '         they already took, on every open until a full write');

console.log('\n4 · the load recomputes it, in the block that exists for this');

const src = decomment(read('LingCoT.html'));
const after = src.match(/const rep = replayJournal\(project\.journalText\);[\s\S]{0,1400}?\n  \}/);
check(!!after, 'the post-replay block found');
const blk = after ? after[0] : '';
for (const [call, why] of [
  ['_migrateCorpusRecords(S.docs)', 'the record migrations (B-176)'],
  ['buildCorpusIndex()',            'the corpus index'],
  ['buildDictIndex()',              'the dictionary index'],
  ['offerDictFill()',               'AND the offer (B-192)'],
])
  check(blk.includes(call), `it re-runs ${why}`,
        `         ${call} is missing — anything derived from the whole corpus\n`
      + '         during the load is stale until it is asked again here');

/* The ordering itself: the offer must be recomputed AFTER the replay, not before.
   Both calls exist in the file, so presence alone proves nothing. */
const iReplay = src.indexOf('const rep = replayJournal(project.journalText);');
const iOffer  = src.indexOf('offerDictFill()', iReplay);
check(iReplay > 0 && iOffer > iReplay && iOffer - iReplay < 1400,
      'and does so after the replay, not before it',
      '         computing it earlier is the bug, not a style choice');

console.log('\n5 · the rule, so the next addition is covered');

/* `applyDict` is where the offer is normally raised, and that is right for a
   dictionary opened on its own. What must not happen is a SECOND thing being
   added there that the load path then never recomputes. */
const applyDictSrc = (src.match(/function applyDict\(data, basename\)[\s\S]*?\n\}/) || [''])[0];
const raised = [...applyDictSrc.matchAll(/^\s{2}([a-zA-Z_]\w*)\(\);?$/gm)].map(m => m[1]);
/* Classified, not just listed — the question this guard asks is whether a call
   derives anything from the CORPUS, and a bare name cannot answer it. Checked at
   v3.14.366:
     offerDictFill          DOES — it is B-192, and the post-replay block re-runs it
     buildDictIndex         the dictionary only, which the replay may also touch;
                            the post-replay block re-runs it for that reason
     updateDictStatus       a count of dictionary entries
     refreshSavePanelPaths  file paths and filenames; no corpus read
     journalReset           clears the pending buffer; no corpus read
     render / reportLinkNotes / refreshLemmaStrip / hideCompanionBanner  view only */
const KNOWN = new Set(['offerDictFill', 'buildDictIndex', 'updateDictStatus',
                       'refreshLemmaStrip', 'render', 'buildCorpusIndex',
                       'hideCompanionBanner', 'refreshSavePanel', 'reportLinkNotes',
                       'refreshSavePanelPaths', 'journalReset']);
const novel = raised.filter(r => !KNOWN.has(r));
check(novel.length === 0,
      `applyDict raises only things this guard knows about (${raised.length} call(s))`,
      `         new: ${novel.join(', ')} — if it derives anything from the CORPUS,\n`
    + '         it is computed before the journal replays and needs a line in the\n'
    + '         post-replay block. Add it there, then add it to KNOWN here.');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
