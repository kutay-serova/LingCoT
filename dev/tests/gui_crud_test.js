#!/usr/bin/env node
/* =============================================================================
   gui_crud_test.js, does using the app put the right bytes on disk?
   Run:  node dev/tests/gui_crud_test.js
   =============================================================================
   Every other guard in this directory asks a question about the SOURCE, or runs
   the app against a stub document and asks whether it threw. This one asks the
   question a user asks: I typed that, I pressed Save — is it in the file?

   THE SHAPE OF EVERY CHECK IS THE SAME, and it is the point:

       act through a control  →  press the button labelled Save
                              →  read the FILE  →  compare

   Not S.docs. The file. B-127 put seventeen versions of per-field provenance on
   disk as `field_prov: {}` while every guard asserted on the object the writer
   was handed, and the serializer dropped it on the way out. An assertion that
   stops at memory cannot see that class at all.

   THE DATA IS DELIBERATELY NOT LANGUAGE. `Alpha bravo charlie.` is not a
   sentence anyone is documenting; the corpus language is declared `zxx`, the
   ISO code for "no linguistic content". Every value typed below was chosen to
   probe one behaviour — whitespace, folding, markup, emptiness, ordering — and
   is unique enough to grep for in the file when a check fails. Real language
   data is what the fixtures in dev/fixtures/ are for; using it here would mean
   a failure told you a corpus was wrong instead of telling you which control.

   WHAT IT COSTS. Chromium, and about 40 s. It exits 2 (DISABLED) when Playwright
   is absent — see _gui.js, and run_all.sh on why that is not a pass.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const vm   = require('vm');
const { fnSrc } = require('./_source.js');
const { boot, readCorpus, walkWords, walkSents, appVersion } = require('./_gui.js');

/* ── tally ─────────────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else    { fail++; failures.push(label); console.log(`  FAIL ${label}`);
            if (detail !== undefined) console.log('       ' + detail); }
}
const eq = (got, want, label) =>
  check(JSON.stringify(got) === JSON.stringify(want), label,
        `got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`);

/* @fn gloss, what a reader of this file sees as a word's gloss.

   B-176/B-186: `word.gloss` holds only a value that DIFFERS from the join of the
   morphemes; one equal to it is composed on read. The word editor mirrors a typed
   word gloss down into the single morpheme row, so for most of the words these
   scenarios build, the value legitimately lives on the morpheme and the word
   carries no gloss key at all — which is what turned five of these checks red at
   v3.14.353 while the annotation itself was intact.

   So they ask the reader rather than the field, and the reader is the app's own
   `wordGloss`, sliced out rather than re-written here: a second implementation of
   the join would let the file and the guard drift, and the guard would end up
   asserting its own arithmetic. */
const _wgCtx = vm.createContext({ GLOSS_GAP: '\u2205' });
vm.runInContext(fnSrc('LingCoT.html', 'wordGloss'), _wgCtx);
const gloss = w => { _wgCtx.__w = w; return vm.runInContext('wordGloss(__w)', _wgCtx); };

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'lingcot-gui-'));

/* Every uncaught error from every scenario, asserted once at the end. Reported
   per scenario, one live ReferenceError failed five checks and looked like five
   defects. */
const allErrors = [];

/* ── the shared opening moves ───────────────────────────────────────────────── */

/* @fn startCorpus, File ▸ New Corpus with an annotator picked, through the
   controls. Returns once the document view is up. */
async function startCorpus(H, { title, language = 'zxx', metalang = 'eng', notes } = {}) {
  const { page } = H;
  await page.evaluate(() => { document.getElementById('file-btn').click();
                              document.getElementById('file-new-item').click(); });
  await page.waitForTimeout(250);
  await page.click('.ann-panel-btn');
  await page.click('#ann-add-btn');
  await page.waitForTimeout(150);
  await page.fill('#am-name', 'Guard Annotator');
  await page.check('#am-researcher');                       // checkbox modality
  await page.click('#ann-modal-save');
  await page.waitForTimeout(200);
  await page.fill('#f-document-title', title);
  await page.fill('#f-document-language', language);
  await page.fill('#f-document-translation_language', metalang);
  if (notes !== undefined) {
    /* `extra` fields sit behind a disclosure. Typing into one without opening it
       is not something a user can do, so neither does this. */
    await page.evaluate(() => document.querySelector('.edit-extra > summary')?.click());
    await page.waitForTimeout(120);
    await page.fill('#f-document-notes', notes);
  }
  await page.click('#save-corpus-new');
  await page.waitForTimeout(500);
  /* The autosave offer fires ~200 ms after the corpus is created (B-147 restored
     it). Decline it: the save paths are set explicitly by armAndSave below, and
     an armed autosave would write between checks and blur which save wrote what.
     Its backdrop swallows clicks while it is up, so this is not optional. */
  if (await page.$('#ncs-box:not([hidden])')) {
    await page.evaluate(() => document.getElementById('ncs-skip-btn')?.click());
    await page.waitForTimeout(250);
  }
}

/* @fn addSection, the Add Section form, ingesting raw text for the auto-parser. */
async function addSection(H, title, text) {
  const { page } = H;
  await page.evaluate(() => go('document'));
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-go="section-add"]')?.click());
  await page.waitForTimeout(200);
  await page.fill('#f-section-title', title);
  await page.fill('#f-section-ingest', text);
  await page.click('#save-section-add');
  await page.waitForTimeout(250);
}

/* @fn armAndSave, put the three files on disk through the save panel.
   Export Corpus FIRST: with no path set it runs chooseSavePath(true), which is
   the only thing in the app that sets _autoSave, and compact() returns without
   writing when that is false. Setting the paths first writes nothing at all. */
async function armAndSave(H, prefix) {
  const { page } = H;
  H.api.saveAs = {};                     // built below from what the app offers
  const open = async () => { await page.evaluate(() => {
      document.getElementById('file-btn').click();
      document.getElementById('file-save-item').click(); });
    await page.waitForTimeout(200); };
  /* Whatever the app suggests, the annotator types the convention-conforming
     name; the three files have to share a prefix or open_project cannot pair
     them. That rename is a real thing a user does in the dialog. */
  H.api.saveAs = new Proxy({}, { get: (_, n) => {
    if (typeof n !== 'string') return undefined;
    if (n.includes('participants')) return `${prefix}_participants.jsonl`;
    if (n.includes('dictionary'))   return `${prefix}_dictionary.jsonl`;
    return `${prefix}_corpus.jsonl`;
  }, has: () => true });
  await open();
  await page.evaluate(() => document.getElementById('sp-save-now')?.click());
  await page.waitForTimeout(500);
  await open();
  await page.evaluate(() => document.getElementById('sp-change-participants-file')?.click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('sp-change-dict-file')?.click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('sp-save-now')?.click());
  await page.waitForTimeout(900);
}

/* @fn editWord, open one token's editor, run `fillIn`, press Save. */
async function editWord(H, ref, fillIn) {
  const { page } = H;
  await page.evaluate(o => go('word-edit', { wordId: o.wid, sentId: o.sid,
                                             sectIdx: o.si, paraIdx: o.pi }), ref);
  await page.waitForTimeout(120);
  await fillIn(page);
  await page.evaluate(() => document.getElementById('save-word').click());
  await page.waitForTimeout(150);
}

/* @fn editSentence, same for a sentence. */
async function editSentence(H, ref, fillIn) {
  const { page } = H;
  await page.evaluate(o => go('sentence-edit', { sentId: o.sid, sectIdx: o.si, paraIdx: o.pi }), ref);
  await page.waitForTimeout(120);
  await fillIn(page);
  await page.evaluate(() => document.getElementById('save-sentence').click());
  await page.waitForTimeout(200);
}

/* @fn refs, addresses for every token, read out of the live app. */
const tokenRefs = page => page.evaluate(() => {
  const out = [];
  S.docs[0].sections.forEach((s, si) => s.paragraphs.forEach((p, pi) =>
    p.sentences.forEach(q => q.words.forEach(w =>
      out.push({ si, pi, sid: q.id, wid: w.id, form: w.form })))));
  return out;
});
const sentRefs = page => page.evaluate(() => {
  const out = [];
  S.docs[0].sections.forEach((s, si) => s.paragraphs.forEach((p, pi) =>
    p.sentences.forEach(q => out.push({ si, pi, sid: q.id, text: q.text,
                                        forms: q.words.map(w => w.form) }))));
  return out;
});

/* ═══════════════════════════════════════════════════════════════════════════
   A. INPUT MODALITIES. One control, one behaviour, one line in the file.
   ═════════════════════════════════════════════════════════════════════════ */
async function scenarioA() {
  console.log('\n\x1b[1m── A. input modalities ──\x1b[0m');
  const dir = path.join(OUT, 'A');
  const H = await boot({ outDir: dir, corpusPath: path.join(dir, 'a_corpus.jsonl') });
  const { page } = H;

  const NOTES = 'line one\nline two\n\nline four';           // A8: newlines
  const LONG  = 'L'.repeat(2000);                            // A9: long value
  await startCorpus(H, { title: 'GUI Guard A', notes: NOTES });
  await addSection(H, 'Section Alpha', 'Alpha bravo charlie. Delta echo foxtrot.');

  const refs = await tokenRefs(page);
  /* forms: Alpha bravo charlie . Delta echo foxtrot . */
  const byForm = f => refs.find(r => r.form === f);

  // A1 leading/trailing whitespace is trimmed by the reader
  await editWord(H, byForm('Alpha'), p => p.fill('#ew-gloss', '   padded   '));
  // A2 whitespace only is EMPTY, not a value
  await editWord(H, byForm('bravo'), p => p.fill('#ew-gloss', '     '));
  // A3 markup is data, never markup
  await editWord(H, byForm('charlie'), p => p.fill('#ew-gloss', '<b>x</b> & "q" — <script>'));
  // A4 a tag control folds its value (POS is fold:'upper')
  await editWord(H, byForm('Delta'), async p => { await p.fill('#ew-gloss', 'tagged');
                                                  await p.fill('#ew-pos', 'noun'); });
  // A9 a long value survives the round trip
  await editWord(H, byForm('echo'), p => p.fill('#ew-gloss', LONG));
  // A10 NFC and NFD are different strings and must stay different
  await editWord(H, byForm('foxtrot'), p => p.fill('#ew-gloss', 'Zoë|Zoë'));

  await armAndSave(H, 'a');
  const file = path.join(dir, 'a_corpus.jsonl');
  const C = readCorpus(file);
  check(!!C && !!C.doc, 'the corpus was written at all', file);
  if (!C || !C.doc) { await H.close(); return; }
  const W = Object.fromEntries(walkWords(C.doc).map(x => [x.w.form, x.w]));

  eq(gloss(W.Alpha), 'padded',                'A1  a text input is trimmed on the way to disk');
  check(gloss(W.bravo) == null,               'A2  a whitespace-only value is stored as empty, not as spaces',
        JSON.stringify(gloss(W.bravo)));
  eq(gloss(W.charlie), '<b>x</b> & "q" — <script>',
                                             'A3  markup typed into a field is stored verbatim, not escaped or stripped');
  eq(W.Delta.part_of_speech, 'NOUN',         'A4  a tag control folds its value (fold: upper) before storing');
  check(gloss(W.echo) === LONG,               'A9  a 2000-character value survives the round trip',
        `length ${gloss(W.echo) && gloss(W.echo).length}`);
  eq(gloss(W.foxtrot), 'Zoë|Zoë',  'A10 NFC and NFD are preserved as typed, not normalised together');
  eq(C.doc.metadata.notes, NOTES,            'A8  a textarea keeps its newlines');
  eq(C.doc.metadata.language, 'zxx',         'A7  a language control stores the code it was given');

  /* A3b: stored verbatim is only half of it. The RENDER view must escape it, or
     a gloss is a script tag. Ask the live DOM, not the file. */
  await page.evaluate(() => go('document'));
  await page.waitForTimeout(300);
  const injected = await page.evaluate(() =>
    !!document.querySelector('.igt-gloss b, .gloss b, script[data-from-gloss]'));
  check(!injected, 'A3b typed markup renders as text, not as elements');

  allErrors.push(...H.errors);
  await H.close();
}

/* ═══════════════════════════════════════════════════════════════════════════
   B. ROW EDITORS. Add, order, empty-drop, remove — the shape shared by
      translations, transliterations and comments.
   ═════════════════════════════════════════════════════════════════════════ */
async function scenarioB() {
  console.log('\n\x1b[1m── B. row editors: add, order, drop, remove ──\x1b[0m');
  const dir = path.join(OUT, 'B');
  const H = await boot({ outDir: dir, corpusPath: path.join(dir, 'b_corpus.jsonl') });
  const { page } = H;
  await startCorpus(H, { title: 'GUI Guard B' });
  await addSection(H, 'Section Bravo', 'Golf hotel india. Juliett kilo.');
  const sents = await sentRefs(page);

  /* @fn rows, click the add button N times and fill the fields by index. */
  const addRows = async (container, action, values) => {
    for (const v of values) {
      await page.evaluate(([c, a]) =>
        document.querySelector(`#${c} [data-action="${a}"]`)?.click(), [container, action]);
      await page.waitForTimeout(60);
      await page.evaluate(([c, val]) => {
        const rows = document.querySelectorAll(`#${c}-rows > div`);
        const row  = rows[rows.length - 1];
        if (!row) return;
        const set = (sel, x) => { const el = row.querySelector(sel); if (el && x != null) el.value = x; };
        set('.translation-text', val.text); set('.translit-text', val.text);
        set('.comment-text', val.text);     set('.translit-label', val.label);
      }, [container, v]);
      await page.waitForTimeout(40);
    }
  };

  // Sentence 1: three translation rows, the middle one left empty
  await editSentence(H, sents[0], async () => {
    await addRows('f-sentence-translations', 'translation-add',
      [{ text: 'ROW-ONE' }, { text: '   ' }, { text: 'ROW-THREE' }]);
  });
  // Sentence 2: two translit rows and a comment, then remove the FIRST translit
  await editSentence(H, sents[1], async () => {
    await addRows('f-sentence-transliterations', 'translit-add',
      [{ label: 'SysA', text: 'TL-ONE' }, { label: 'SysB', text: 'TL-TWO' }]);
    await addRows('f-sentence-comments', 'comment-add', [{ text: 'NOTE-KEEP' }]);
    /* the remove button on the FIRST row — deletion as a user performs it */
    await page.evaluate(() =>
      document.querySelector('#f-sentence-transliterations-rows .translit-remove')?.click());
    await page.waitForTimeout(80);
  });

  await armAndSave(H, 'b');
  const C = readCorpus(path.join(dir, 'b_corpus.jsonl'));
  check(!!C && !!C.doc, 'the corpus was written at all');
  if (!C || !C.doc) { await H.close(); return; }
  const Q = walkSents(C.doc).map(x => x.q);

  eq((Q[0].translations || []).map(t => t.text), ['ROW-ONE', 'ROW-THREE'],
     'B1  two filled rows are stored in the order they were added');
  check((Q[0].translations || []).length === 2,
     'B2  a row left empty is dropped rather than stored as a blank',
     JSON.stringify(Q[0].translations));
  eq((Q[1].transliterations || []).map(t => [t.label, t.text]), [['SysB', 'TL-TWO']],
     'B3  removing the first of two rows leaves the SECOND, not the first');
  eq((Q[1].comments || []).map(c => c.text), ['NOTE-KEEP'],
     'B4  a comment row reaches the file');

  allErrors.push(...H.errors);
  await H.close();
}

/* ═══════════════════════════════════════════════════════════════════════════
   C. EDIT MODALITY, including the one edit that destroys data:
      re-tokenising a sentence whose words carry annotation (B-057).
   ═════════════════════════════════════════════════════════════════════════ */
async function scenarioC() {
  console.log('\n\x1b[1m── C. edit, re-edit, and re-tokenisation ──\x1b[0m');
  const dir = path.join(OUT, 'C');
  const H = await boot({ outDir: dir, corpusPath: path.join(dir, 'c_corpus.jsonl') });
  const { page } = H;
  await startCorpus(H, { title: 'GUI Guard C' });
  await addSection(H, 'Section Charlie', 'Mike november oscar. Papa quebec romeo.');
  let refs = await tokenRefs(page);
  const at = f => refs.find(r => r.form === f);

  // C1 an edit replaces, it does not append
  await editWord(H, at('Mike'), p => p.fill('#ew-gloss', 'FIRST'));
  await editWord(H, at('Mike'), p => p.fill('#ew-gloss', 'SECOND'));
  /* C2a, B-187. Before the field can be cleared it has to show something. Since
     B-186 a word gloss equal to the morpheme join is not stored, and for a
     monomorphemic word that is the ordinary case — so an editor reading the
     stored key drew an EMPTY box over a word that had a gloss. The annotator was
     shown nothing to clear, cleared nothing, and the gloss stood. C2 reported
     that for two versions and was read as a storage problem both times.

     Asked of the live DOM, because the defect is what is on the screen. */
  await editWord(H, at('november'), p => p.fill('#ew-gloss', 'TEMP'));
  await page.evaluate(o => go('word-edit', { wordId: o.wid, sentId: o.sid,
                                             sectIdx: o.si, paraIdx: o.pi }), at('november'));
  await page.waitForTimeout(150);
  const shown = await page.evaluate(() => ({
    word: document.getElementById('ew-gloss')?.value,
    morph: document.getElementById('ew-mg-0')?.value,
  }));
  eq(shown.word, 'TEMP', 'C2a reopening a glossed word shows its gloss in the word field');
  eq(shown.morph, 'TEMP', 'C2b and the morpheme row it is composed from agrees');
  await page.evaluate(() => go('word', {}));
  await page.waitForTimeout(100);

  // C2 clearing a field empties it — the gloss is already TEMP from C2a above
  await editWord(H, at('november'), p => p.fill('#ew-gloss', ''));
  // annotate two tokens of sentence 2, then re-tokenise around them
  await editWord(H, at('Papa'),   p => p.fill('#ew-gloss', 'KEEP-PAPA'));
  await editWord(H, at('romeo'),  p => p.fill('#ew-gloss', 'DOOMED-ROMEO'));

  const sents = await sentRefs(page);
  const idsBefore = await page.evaluate(() => {
    const q = S.docs[0].sections[0].paragraphs[0].sentences[0];
    return q.words.map(w => w.id);
  });

  // C3 saving with the tokenisation UNTOUCHED must not rebuild the words (B-057 L0)
  await editSentence(H, sents[0], async () => { /* touch nothing */ });
  const idsAfter = await page.evaluate(() => {
    const q = S.docs[0].sections[0].paragraphs[0].sentences[0];
    return q.words.map(w => w.id);
  });
  eq(idsAfter, idsBefore, 'C3  saving a sentence without touching `words` does not rebuild them (B-057 L0)');

  // C4 adding a token keeps the annotation on the forms that survive (B-057 L1)
  await editSentence(H, sents[1], p =>
    p.fill('#f-sentence-words', 'Papa quebec romeo sierra .'));
  /* Asserted HERE, not after the save: C6 below deliberately removes tokens from
     this same sentence, and an assertion made after it would be checking the
     wrong moment. */
  const afterAdd = await page.evaluate(() =>
    S.docs[0].sections[0].paragraphs[0].sentences[1].words.map(w => w.form));
  check(afterAdd.includes('sierra'),
        'C4a a token added by re-tokenisation appears in the sentence', JSON.stringify(afterAdd));
  // C5 dropping an ANNOTATED token, and answering the confirm with NO
  H.ctl.confirmAnswer = false;
  const dialogsBefore = H.dialogs.length;
  await editSentence(H, sents[1], p => p.fill('#f-sentence-words', 'Papa quebec .'));
  const asked = H.dialogs.slice(dialogsBefore).some(d => d.type === 'confirm');
  check(asked, 'C5a dropping an annotated token asks before discarding it (B-057 L2)',
        JSON.stringify(H.dialogs.slice(dialogsBefore).map(d => d.type)));
  const stillThere = await page.evaluate(() =>
    S.docs[0].sections[0].paragraphs[0].sentences[1].words.map(w => w.form));
  check(stillThere.includes('romeo'),
        'C5b answering No to that confirm leaves the annotated token in place',
        JSON.stringify(stillThere));

  // C6 the same edit, answered Yes
  H.ctl.confirmAnswer = true;
  await editSentence(H, sents[1], p => p.fill('#f-sentence-words', 'Papa quebec .'));

  await armAndSave(H, 'c');
  const C = readCorpus(path.join(dir, 'c_corpus.jsonl'));
  check(!!C && !!C.doc, 'the corpus was written at all');
  if (!C || !C.doc) { await H.close(); return; }
  const W = walkWords(C.doc);
  const g = f => (W.find(x => x.w.form === f) || {}).w;

  eq(gloss(g('Mike')), 'SECOND',  'C1  re-editing a field replaces the value');
  check(gloss(g('november')) == null, 'C2  clearing a field empties it on disk',
        JSON.stringify(g('november') && gloss(g('november'))));
  eq(gloss(g('Papa')), 'KEEP-PAPA','C4b annotation survives on the tokens the re-tokenisation kept');
  check(!g('romeo'),             'C6  a token dropped with the annotator\'s consent is gone from the file');

  allErrors.push(...H.errors);
  await H.close();
}

/* ═══════════════════════════════════════════════════════════════════════════
   D. DELETION. Both answers to the confirm, because a delete that ignores
      Cancel and a delete that ignores OK are the same bug wearing two faces.
   ═════════════════════════════════════════════════════════════════════════ */
async function scenarioD() {
  console.log('\n\x1b[1m── D. deletion, and what Cancel means ──\x1b[0m');
  const dir = path.join(OUT, 'D');
  const H = await boot({ outDir: dir, corpusPath: path.join(dir, 'd_corpus.jsonl') });
  const { page } = H;
  await startCorpus(H, { title: 'GUI Guard D' });
  await addSection(H, 'SEC-KEEP',   'Sierra tango. Uniform victor.');
  await addSection(H, 'SEC-CANCEL', 'Whiskey xray.');
  await addSection(H, 'SEC-DELETE', 'Yankee zulu.');

  /* The section list with its delete buttons lives in the DOCUMENT editor. */
  const openDocEditor = async () => {
    await page.evaluate(() => go('document-edit'));
    await page.waitForTimeout(250);
  };

  /* @fn clickDelete, press one section's delete button and report whether the
     app ASKED. Asking is the precondition for everything below: a delete that
     silently does nothing leaves the section in place, which is exactly what a
     naive "is it still there?" check calls a pass. This project has had ten
     guards pass for the wrong reason; this is the shape that produces them. */
  const clickDelete = async (title) => {
    const before = H.dialogs.length;
    const found  = await page.evaluate(t => {
      const row = [...document.querySelectorAll('.sec-edit-row')]
        .find(r => r.querySelector('input')?.value === t);
      const btn = row && row.querySelector('[data-arr="del"]');
      if (!btn) return 'no button';
      btn.click();
      return 'clicked';
    }, title);
    await page.waitForTimeout(300);
    return { found, asked: H.dialogs.slice(before).some(d => d.type === 'confirm') };
  };

  await openDocEditor();
  H.ctl.confirmAnswer = false;
  const r1 = await clickDelete('SEC-CANCEL');
  check(r1.found === 'clicked', 'D0a the section editor draws a delete button', r1.found);
  check(r1.asked, 'D0b pressing that button asks the annotator before deleting anything',
        'no confirm() was raised — the button did nothing at all');
  H.ctl.confirmAnswer = true;
  const r2 = await clickDelete('SEC-DELETE');
  check(r2.asked, 'D0c the same, with the annotator about to answer Yes',
        'no confirm() was raised — the button did nothing at all');
  await page.evaluate(() => document.getElementById('save-document').click());
  await page.waitForTimeout(400);

  await armAndSave(H, 'd');
  const C = readCorpus(path.join(dir, 'd_corpus.jsonl'));
  check(!!C && !!C.doc, 'the corpus was written at all');
  if (!C || !C.doc) { await H.close(); return; }
  const titles = (C.doc.sections || []).map(s => s.title);
  check(titles.includes('SEC-CANCEL'),
        'D1  a section delete answered No leaves the section on disk', JSON.stringify(titles));
  check(!titles.includes('SEC-DELETE'),
        'D2  a section delete answered Yes removes it from disk', JSON.stringify(titles));
  check(titles.includes('SEC-KEEP'),
        'D3  the sections nobody touched are untouched', JSON.stringify(titles));

  /* D4. `merge` mutates the model as soon as it is clicked, while `del` only
     removes a DOM row and lets the save reconcile. So a merge followed by
     Cancel should be asked about: did leaving the editor undo it? */
  const beforeMerge = await page.evaluate(() =>
    S.docs[0].sections.map(s => s.paragraphs.length));
  await openDocEditor();
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.sec-edit-row')][0];
    row?.querySelector('[data-arr="merge"]')?.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => go('document'));                  // leave WITHOUT saving
  await page.waitForTimeout(250);
  const afterCancel = await page.evaluate(() =>
    S.docs[0].sections.map(s => s.paragraphs.length));
  eq(afterCancel, beforeMerge,
     'D4  merging two sections and then leaving the editor without saving does not merge them');

  allErrors.push(...H.errors);
  await H.close();
}

/* ═══════════════════════════════════════════════════════════════════════════
   E. THE ROUND TRIP. Everything above is worthless if the app cannot read
      back what it wrote.
   ═════════════════════════════════════════════════════════════════════════ */
async function scenarioE() {
  console.log('\n\x1b[1m── E. what was written can be opened ──\x1b[0m');
  const dir = path.join(OUT, 'E');
  const corpus = path.join(dir, 'e_corpus.jsonl');
  const H = await boot({ outDir: dir, corpusPath: corpus });
  const { page } = H;
  await startCorpus(H, { title: 'GUI Guard E' });
  await addSection(H, 'Section Echo', 'Alfa bravo. Charlie delta.');
  const refs = await tokenRefs(page);
  await editWord(H, refs[0], p => p.fill('#ew-gloss', 'ROUNDTRIP'));
  await armAndSave(H, 'e');
  await H.close();

  const before = readCorpus(corpus);
  check(!!before && !!before.doc, 'E1  a corpus was written');
  if (!before || !before.doc) return;

  /* Reopen it the way the next session does: the app's own Open button. */
  const H2 = await boot({ outDir: path.join(dir, 'reopen'), corpusPath: corpus });
  H2.api.openPath = corpus;
  await H2.page.click('#open-empty');
  await H2.page.waitForTimeout(1400);
  const reopened = await H2.page.evaluate(() => S.docs.length);
  const refused  = H2.dialogs.filter(d => d.type === 'alert').map(d => d.message.split('\n')[0]);
  check(reopened === 1, 'E2  the app can OPEN the file it just saved',
        refused.length ? 'the app refused it: ' + refused[0] : `S.docs.length = ${reopened}`);

  if (reopened === 1) {
    /* B-176/B-186: the word gloss the annotator typed here is also what the
       morphemes join to — the editor mirrors it down into the single row — so it
       is composed on read and not stored. Asking the STORED field would be
       asking about the storage decision; what has to survive is the annotation,
       which is what a reader gets and what the annotator sees. */
    const g = await H2.page.evaluate(() =>
      wordGloss(S.docs[0].sections[0].paragraphs[0].sentences[0].words[0]));
    eq(g, 'ROUNDTRIP', 'E3  an annotation survives save → open unchanged');
    /* And the authorship survives with it, on the morpheme where the value now
       lives. D60 accepted losing this for a typed value identical to the join;
       this is the check that says how much was actually given up. */
    const stamped = await H2.page.evaluate(() => {
      const w = S.docs[0].sections[0].paragraphs[0].sentences[0].words[0];
      return !!(w.morphemes || []).some(m => m.field_prov && m.field_prov.gloss !== undefined);
    });
    check(stamped, 'E3b and it is still stamped, on the morpheme that carries it');

    /* E4: saving again without touching anything must not change the content. */
    await armAndSave(H2, 'e');
    const after = readCorpus(corpus);
    const strip = d => JSON.parse(JSON.stringify(d));
    eq(strip(after.doc), strip(before.doc),
       'E4  saving an untouched corpus a second time produces the same document');
  }
  allErrors.push(...H2.errors);
  await H2.close();
}

/* ── F. the add-to-dictionary tick ───────────────────────────────────────────
   B-183, twice. The tick sat inside the row's `<summary>`, and opening a
   `<details>` is the summary's ACTIVATION BEHAVIOUR — the default action of the
   click. `stopPropagation` cannot cancel a default action, so the first fix did
   nothing; `preventDefault` cancels BOTH defaults, and a checkbox's canceled
   activation restores the state the browser flipped before any listener ran, so
   the second fix stopped the tick moving at all. Both shipped. Both had a guard
   that asserted the SHAPE of the handler and passed.

   Only a real click settles this, which is why it is here and not in a stub. The
   panel is opened directly rather than through a save, so the scenario tests one
   thing and cannot fail for a reason belonging to the push. */
async function scenarioF() {
  console.log('\n\x1b[1m── F. the add-to-dictionary tick ──\x1b[0m');
  const dir = path.join(OUT, 'F');
  const H = await boot({ outDir: dir, corpusPath: path.join(dir, 'f_corpus.jsonl') });
  const { page } = H;
  await startCorpus(H, { title: 'GUI Guard F' });

  const opened = await page.evaluate(() => {
    openAddDict([{ form: 'evde', type: 'word', on: true, fills: [], existing: null }], {});
    return !!document.querySelector('.pk-row input[type="checkbox"]');
  });
  check(opened, 'F0  the add-to-dictionary panel draws a row with a tick');
  if (!opened) { allErrors.push(...H.errors); await H.close(); return; }

  const before = await page.evaluate(() => {
    const cb = document.querySelector('.pk-row input[type="checkbox"]');
    return { checked: cb.checked, open: cb.closest('.pk-row').querySelector('.pk-cand').open };
  });
  await page.click('.pk-row input[type="checkbox"]');
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => {
    const cb = document.querySelector('.pk-row input[type="checkbox"]');
    const d  = cb.closest('.pk-row').querySelector('.pk-cand');
    return { checked: cb.checked, open: d.open, on: d.classList.contains('pk-on') };
  });

  check(after.checked === !before.checked,
        'F1  one click on the tick changes it',
        `       was ${before.checked}, is ${after.checked} — v3.14.350 could not\n`
      + '       move it at all, and v3.14.269 took two clicks');
  check(after.open === before.open,
        'F2  and does not fold the row',
        `       open was ${before.open}, is ${after.open}`);
  check(after.on === after.checked,
        'F3  and the row\'s state follows the tick',
        `       checked ${after.checked}, .pk-on ${after.on}`);

  /* Back again, because "it moved once" is what a double-toggle also looks like. */
  await page.click('.pk-row input[type="checkbox"]');
  await page.waitForTimeout(120);
  const back = await page.evaluate(() => {
    const cb = document.querySelector('.pk-row input[type="checkbox"]');
    return { checked: cb.checked, open: cb.closest('.pk-row').querySelector('.pk-cand').open };
  });
  check(back.checked === before.checked && back.open === before.open,
        'F4  and a second click puts it back, without folding anything');

  /* The disclosure still works on its own — the fix must not have cost it. */
  await page.click('.pk-row .pk-cand > summary');
  await page.waitForTimeout(120);
  const folded = await page.evaluate(() =>
    document.querySelector('.pk-row .pk-cand').open);
  check(folded === !before.open,
        'F5  and the summary still opens and closes the row',
        `       open was ${before.open}, is ${folded}`);

  allErrors.push(...H.errors);
  await H.close();
}

/* ── run ───────────────────────────────────────────────────────────────────── */
(async () => {
  const t0 = Date.now();
  console.log(`\n  driving LingCoT v${appVersion()} from ${require('./_gui.js').SRC}`);
  console.log(`  workspace: ${OUT}`);
  for (const s of [scenarioA, scenarioB, scenarioC, scenarioD, scenarioE, scenarioF]) {
    try { await s(); }
    catch (err) {
      fail++; failures.push(s.name + ' threw');
      console.log(`  FAIL ${s.name} threw: ${err.message}`);
    }
  }
  const uniq = [...new Set(allErrors)];
  console.log('\n\x1b[1m── X. nothing threw while any of that happened ──\x1b[0m');
  check(uniq.length === 0, 'X1  no uncaught error in any scenario',
        uniq.join('\n       '));

  console.log(`\n\x1b[1m  ${pass} passed, ${fail} failed\x1b[0m  (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  if (fail) {
    console.log('  \x1b[31mFAILED:\x1b[0m ' + failures.join('\n          '));
    console.log(`\n  The corpora each check ran against are still in ${OUT} —`);
    console.log('  open one and look at the field the check names.\n');
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
})();
