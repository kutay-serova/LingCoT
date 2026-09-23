/* =============================================================================
   _gui.js, the browser the app is actually SHIPPED in
   =============================================================================
   `_dom.js` is a stub: enough of a document for top-level evaluation and the
   renderers to run, deliberately thin, and it says so. It answers "does this
   code throw". It cannot answer "does clicking that button put the right bytes
   on disk", because nothing in it lays anything out, dispatches a real event,
   or has a value to read back.

   This is the other half. It runs LingCoT.html in headless Chromium and
   supplies the ONE thing a browser does not have — window.pywebview.api, the
   Python bridge — backed by a real directory. Everything above that line is the
   shipped app: real DOM, real listeners, real renderers, real save handlers,
   and real files written by the real serializer.

   WHAT THIS COSTS. Chromium. `boot()` exits the process with code 2 (DISABLED,
   see run_all.sh) when Playwright or its browser is absent, rather than
   failing, because a machine without it has not discovered a defect. Install
   with:  npm i -D playwright && npx playwright install chromium

   WHAT THIS IS NOT. It is not a rendering test — nothing here looks at a pixel.
   It is not a replacement for any guard: a static check that reads every module
   in 40 ms should stay a static check. It is for the class of defect that only
   exists between a control and a file.
   ============================================================================= */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { SRC, disabled } = require('./_source.js');

/* @fn appVersion, which build this run actually drove.
   Audit GUI_MODALITY_2026-08-31 §4: a first draft of that audit filed two bugs
   that had been fixed six versions earlier, because the run had been pointed at
   an older copy of source/. A browser can be aimed anywhere; the output has to
   say where. Printed by every driver, before anything else. */
function appVersion() {
  try {
    const v = fs.readFileSync(path.join(SRC, 'version.py'), 'utf8');
    return (/__version__\s*=\s*['"]([^'"]+)/.exec(v) || [])[1] || 'unknown';
  } catch { return 'unknown'; }
}

/* ── Finding playwright without putting it in the repo ───────────────────────
   This repository has no `package.json` and no `node_modules`: every other guard
   runs on Node builtins alone, and a clone needs nothing installed. That is
   worth keeping, so this guard looks for its one dependency OUTSIDE the tree
   before it looks inside, and works with any of these:

     ~/.lingcot-dev/         the documented home. mkdir, npm init -y,
                             npm i playwright — once per machine, 19 MB
     npm i -g playwright     a global install
     $LINGCOT_PLAYWRIGHT     an explicit path, for anywhere else
     node_modules/           a local install, if you would rather

   The BROWSER is a separate 195 MB and is already out of the repo wherever it
   is installed from: playwright puts it in ~/Library/Caches/ms-playwright on
   macOS, ~/.cache/ms-playwright on Linux, shared by every project on the
   machine and downloaded once. `PLAYWRIGHT_BROWSERS_PATH` moves it. Neither
   path is ever inside this tree.
   ─────────────────────────────────────────────────────────────────────────── */
const os = require('os');
const { execFileSync } = require('child_process');

/* @fn playwrightRoots, where to look, nearest-intent first. */
function playwrightRoots() {
  const roots = [];
  if (process.env.LINGCOT_PLAYWRIGHT) roots.push(process.env.LINGCOT_PLAYWRIGHT);
  roots.push(path.join(os.homedir(), '.lingcot-dev', 'node_modules'));
  try {
    roots.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim());
  } catch { /* no npm on PATH; the other roots may still hold */ }
  return roots.filter(Boolean);
}

/* @fn requirePlaywright, or exit 2 saying exactly what is missing and where it looked. */
function requirePlaywright() {
  const tried = [];
  const attempt = spec => {
    try { const m = require(spec); if (m && m.chromium) return m.chromium; }
    catch (e) { tried.push(`${spec} — ${e.code === 'MODULE_NOT_FOUND' ? 'not there' : e.message}`); }
    return null;
  };
  /* Normal resolution first: a local install, or NODE_PATH, is an explicit choice. */
  let chromium = attempt('playwright') || attempt('playwright-core');
  for (const root of playwrightRoots()) {
    if (chromium) break;
    chromium = attempt(path.join(root, 'playwright'))
            || attempt(path.join(root, 'playwright-core'));
  }
  if (!chromium) {
    disabled('playwright is not installed, so nothing was checked',
             'this guard drives the real app in a real browser; without one it can\n'
           + '            check nothing, and a pass would be a lie. Install it ONCE,\n'
           + '            outside the repo — this tree has no node_modules and should not:\n\n'
           + '              mkdir -p ~/.lingcot-dev && cd ~/.lingcot-dev\n'
           /* `npm init -y` derives the package name from the folder, and npm
              rejects one starting with a dot — so the recipe printed here
              failed on its first line for anyone who followed it. The folder
              name is not negotiable: it is the path this file looks in. */
           + '              printf \'{"name":"lingcot-dev","private":true}\' > package.json\n'
           + '              npm i playwright\n'
           + '              npx playwright install chromium\n\n'
           + '            Looked in: ' + tried.map(t => '\n              ' + t).join(''));
  }
  try { const p = chromium.executablePath(); if (!fs.existsSync(p)) throw new Error(p); }
  catch (e) {
    disabled('playwright is installed but its browser is not',
             `${e.message}\n            npx playwright install chromium\n`
           + '            The browser is cached per MACHINE, not per project — once is enough.');
  }
  return chromium;
}

/* @fn makeBridge, the Api surface Python provides, backed by a real directory.
   Every method the app calls is here; an unknown one THROWS rather than
   returning undefined, because a bridge that silently answers nothing turns a
   missing method into a wrong result three steps later. */
function makeBridge(outDir, corpusPath) {
  const writes = [];
  fs.mkdirSync(outDir, { recursive: true });
  const api = {
    read_file:  rel => { const p = path.join(SRC, rel);
                         return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; },
    read_abs:   abs => fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null,
    list_locales: () => fs.readdirSync(path.join(SRC, 'resources', 'locale'))
      .filter(f => f.endsWith('.json') && !f.startsWith('settings'))
      .map(f => ({ locale: f.slice(0, -5), language: JSON.parse(fs.readFileSync(path.join(SRC, 'resources', 'locale', f), 'utf8'))._meta.language })),
    read_user_file:  name => { const p = path.join(outDir, '_user', name);
                               return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; },
    write_user_file: (name, t) => { writes.push(['write_user_file', name, (t||'').length]);
                                    const p = path.join(outDir, '_user', name);
                                    fs.mkdirSync(path.dirname(p), { recursive: true });
                                    fs.writeFileSync(p, t || ''); return true; },
    write_abs:  (abs, t) => { writes.push(['write_abs', path.basename(abs), (t||'').length]);
                              fs.mkdirSync(path.dirname(abs), { recursive: true });
                              fs.writeFileSync(abs, t || ''); return true; },
    append_abs: (abs, t) => { writes.push(['append_abs', path.basename(abs), (t||'').length]);
                              fs.mkdirSync(path.dirname(abs), { recursive: true });
                              fs.appendFileSync(abs, t || ''); return (t||'').length; },
    truncate_abs: abs => { try { fs.truncateSync(abs, 0); } catch {} return true; },
    setup_corpus_dir: safe => {
      const d = path.join(outDir, safe);
      fs.mkdirSync(d, { recursive: true });
      return { folder: d,
               corpusPath:       path.join(d, safe + '_corpus.jsonl'),
               dictPath:         path.join(d, safe + '_dictionary.jsonl'),
               participantsPath: path.join(d, safe + '_participants.jsonl') };
    },
    get_workspace:     () => outDir,
    get_app_info:      () => ({ version: 'gui-guard', python: '0', pywebview: 'node',
                                platform: process.platform }),
    get_server_status: () => ({ running: false, port: 5001 }),
    open_dialog: () => [api.openPath || corpusPath],
    /* A real dialog hands back a path built from the name it offered, and the
       user may rename it. `saveAs` is that rename. Returning ONE fixed path
       made every companion file save over the corpus — a stub wrong in a way
       the app cannot see. */
    save_dialog: suggested => {
      let n = String(suggested || 'corpus.jsonl').split(/[\\/]/).pop();
      if (!n.endsWith('.jsonl')) n += '.jsonl';
      if (api.saveAs && api.saveAs[n]) n = api.saveAs[n];
      return path.join(path.dirname(corpusPath), n);
    },
    zip_export: () => true,
    export_dict_pdf: () => ({ ok: false, reason: 'no bridge' }),
    start_nllb_server: () => ({ ok: false }),
    stop_nllb_server:  () => ({ ok: true }),
    log_js: () => true,
    open_project: anyPath => {
      const folder = path.dirname(anyPath), base = path.basename(anyPath);
      const prefix = base.replace(/_(corpus|dictionary|participants)\.jsonl$/, '');
      const missing = [];
      const rd = n => { const p = path.join(folder, n);
                        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
                        missing.push(n); return ''; };
      const j = path.join(folder, prefix + '.journal.jsonl');
      return { corpusText: rd(prefix + '_corpus.jsonl'),
               dictText: rd(prefix + '_dictionary.jsonl'),
               participantsText: rd(prefix + '_participants.jsonl'),
               journalText: fs.existsSync(j) ? fs.readFileSync(j, 'utf8') : '',
               corpusPath: path.join(folder, prefix + '_corpus.jsonl'),
               dictPath: path.join(folder, prefix + '_dictionary.jsonl'),
               participantsPath: path.join(folder, prefix + '_participants.jsonl'),
               missing, oversize: [], prefix };
    },
  };
  return { api, writes };
}

/* @fn boot, serve source/, open the app, install the bridge, wait for ready. */
async function boot({ outDir, corpusPath, headed = false } = {}) {
  const chromium = requirePlaywright();
  const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                 '.json':'application/json' };
  const server = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'LingCoT.html';
    const p = path.join(SRC, rel);
    if (!p.startsWith(SRC) || !fs.existsSync(p)) { r.writeHead(404); return r.end(''); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    r.end(fs.readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const { api, writes } = makeBridge(outDir, corpusPath);
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  /* Anything the app throws, and anything it puts on the console as an error.
     A run that ends green having swallowed a ReferenceError checked nothing —
     the whole point of B-102. */
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  /* alert / confirm. pywebview shows these; headless Chromium blocks on them.
     `confirmAnswer` decides what a confirm() returns, because half the delete
     paths in this app are guarded by one and BOTH answers are behaviour worth
     checking. Every dialog is recorded: an alert is the app refusing something,
     which is a result, not noise. */
  const dialogs = [];
  const ctl = { confirmAnswer: true };
  page.on('dialog', async d => {
    dialogs.push({ type: d.type(), message: d.message() });
    if (d.type() === 'confirm') return ctl.confirmAnswer ? d.accept() : d.dismiss();
    await d.accept();
  });

  await page.exposeFunction('__pyCall', async (m, a) => {
    if (!api[m]) throw new Error(`the app called pywebview.api.${m}, which the bridge does not have`);
    return api[m](...a);
  });
  await page.addInitScript(() => {
    const names = ['read_file','read_abs','read_user_file','write_user_file','list_locales','write_abs','append_abs','truncate_abs',
                   'setup_corpus_dir','get_workspace','get_app_info','get_server_status',
                   'open_dialog','save_dialog','zip_export','export_dict_pdf',
                   'start_nllb_server','stop_nllb_server','log_js','open_project'];
    const b = {}; for (const n of names) b[n] = (...a) => window.__pyCall(n, a);
    window.pywebview = { api: b };
  });

  await page.goto(`http://127.0.0.1:${port}/LingCoT.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.dispatchEvent(new Event('pywebviewready')));
  await page.waitForTimeout(400);

  return { page, browser, server, errors, dialogs, writes, api, ctl,
           close: async () => { await browser.close(); server.close(); } };
}

/* ── Reading back what was WRITTEN, which is the only thing that counts ─────── */

/* @fn readCorpus, the saved file as the app's own loader would see it.
   NOT S.docs: the assertion has to survive serialization, or a field that is
   right in memory and dropped by the writer passes (B-127, seventeen versions
   of field_prov written as `{}`). */
function readCorpus(file) {
  if (!fs.existsSync(file)) return null;
  const recs = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim())
                 .map(l => JSON.parse(l));
  const doc = recs.find(r => r.sections || r.metadata);
  const events = (recs.find(r => r.record_type === 'prov_events') || {}).events || null;
  return { recs, doc, events };
}

/* @fn walkWords, every token in document order, with where it came from. */
function walkWords(doc) {
  const out = [];
  (doc.sections || []).forEach((s, si) => (s.paragraphs || []).forEach((p, pi) =>
    (p.sentences || []).forEach(q => (q.words || []).forEach(w =>
      out.push({ w, sent: q, para: p, sec: s, si, pi })))));
  return out;
}
function walkSents(doc) {
  const out = [];
  (doc.sections || []).forEach((s, si) => (s.paragraphs || []).forEach((p, pi) =>
    (p.sentences || []).forEach(q => out.push({ q, si, pi }))));
  return out;
}

module.exports = { boot, makeBridge, readCorpus, walkWords, walkSents, appVersion, SRC };
