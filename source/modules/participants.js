/*
  =============================================================================
  Linguistic Corpus Toolkit (LingCoT), modules/participants.js
  Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
  =============================================================================

  Participants module: annotator and source management, pickers, CRUD modals,
  comments/transliterations/translations editors, and annotators rollup.
  Loaded by LingCoT.html via: <script src="modules/participants.js"></script>

  Depends on globals from LingCoT.html: S, go(), render(), mutate(), prov(),
  esc(), escAttr(), _participantsPath, _activeAnnotatorId, _pwReady, etc.
  =============================================================================
*/

// @fn readAnnotator, reads the panel-selected annotator from the (now read-only) bar input.
// Only registered annotator IDs are accepted; free-typed names are no longer supported.
function readAnnotator() {
  const el = document.getElementById('edit-annotator');
  if (!el) return;
  const id = el.dataset.annId || '';
  const _raAnn = id ? S.annotatorsById.get(id) : null;
  if (_raAnn && !_raAnn.deleted) {
    _activeAnnotatorId   = id;
    _activeAnnotatorName = '';
  } else if (!el.value.trim()) {
    // Field was explicitly cleared, deselect session annotator for this edit
    _activeAnnotatorId   = '';
    _activeAnnotatorName = '';
  }
}

/* @fn selectAnnotator, B-095. Make one annotator the active one.

   Selection lives in TWO places: the module variable, and the bar input's value
   plus its data-ann-id, which is what readAnnotator() consults. Writing only the
   variable does not select anybody — worse, it un-selects them, because
   readAnnotator treats an empty bar as an explicit deselection and writes the
   emptiness back. That is what made a freshly created first annotator need
   picking a second time.

   The bar may legitimately be absent (the modal can be open over a view that has
   no annotator bar). The variable still holds, and the next render fills the bar
   from it. */
function selectAnnotator(ann) {
  if (!ann || ann.deleted) return;
  _activeAnnotatorId   = ann.id;
  _activeAnnotatorName = '';
  const el = document.getElementById(_annTarget || 'edit-annotator');
  if (el) { el.value = displayName(ann); el.dataset.annId = ann.id; }
}

// @fn requireAnnotator, reads the annotator bar and blocks the save with an alert
// if no annotator has been selected.  Returns true if save may proceed, false otherwise.
function requireAnnotator() {
  readAnnotator();   // sync the session state from the bar input
  if (_activeAnnotatorId || _activeAnnotatorName) return true;
  alert(t('alert.validation.no_annotator'));
  return false;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ANNOTATOR SYSTEM
   Participants file, annotator panel, add-annotator modal, first-use guard,
   prov history panel, and Annotators view.
══════════════════════════════════════════════════════════════════════════════ */

/* Load the participants JSONL file that lives alongside the corpus.
   Derives the path from the corpus absolute path (_corpus.jsonl → _participants.jsonl).
   Sets _participantsPath so autosave knows where to write. */
// @fn loadParticipants
async function loadParticipants(corpusAbsPath) {
  await _pwReady;
  // B-149: one derivation, shared with the Python opener and the save dialogs.
  _participantsPath = projectSibling(corpusAbsPath, 'participants');
  try {
    const text = await window.pywebview.api.read_abs(_participantsPath);
    applyParticipants(text);
  } catch (_) {
    // File doesn't exist yet, start empty
    S.annotators = [];
    _applyAnnotatorAutofill();
  }
}

/* Parse participants JSONL text and populate S.annotators and S.sources. */
// @fn applyParticipants
function applyParticipants(text) {
  if (!text || !text.trim()) {
    S.annotators = [];
    S.sources    = [];
    _rebuildParticipantMaps();
    _applyAnnotatorAutofill();
    return;
  }
  const records = parseJsonlText(text) || [];
  S.annotators = records.filter(r => r.record_type === 'annotator');
  S.sources    = records.filter(r => r.record_type === 'source');
  _rebuildParticipantMaps();
  _applyAnnotatorAutofill();
}

/* ── Annotator panel (mirrors Leipzig panel) ─────────────────────────────── */

/* Modal state. It lives up here with the panel's rather than beside the modal
   functions because the only gap down there falls between renderAnnChips and
   showAnnModal, and `render_cache_test.js` reads a declaration in that gap as
   state the renderer consumes. The grouping is better here anyway: this is all
   one surface's state. */
let _annModalCallback = null;   // called after saving a new annotator (for first-use guard)
let _annModalEditId   = null;   // ID of annotator being edited; null = new
/* B-095: whether a newly created annotator becomes the active one. It depends
   on why the modal was opened, and nothing else can tell:
     from the picker panel, or the first-use guard → yes, the point was to pick
     from the Annotators view                      → no, that is roster upkeep,
                                                     and someone adding a
                                                     colleague is not becoming them */
let _annModalSelect   = false;

let _annTarget    = null;   // ID string of the input the panel is serving
let _annOpenBtn   = null;   // the .ann-panel-btn that opened the panel
let _annFocusId   = null;   // annotator row to highlight when entering the Annotators view (from prov history links)
let _srcFocusId   = null;   // source row to highlight when entering the Sources view (from source chip links)
// Rank cache for displayName(), maps annotator id → {rank, count} among same-named active annotators.
// Rebuilt by _rebuildParticipantMaps() whenever S.annotators or S.sources changes.
let _annNameRanks = new Map();

/* Rebuild all four participant lookup structures in one pass:
     S.annotatorsById, annotatorId → annotator object (O(1) replaces .find)
     S.sourcesById, sourceId    → source object    (O(1) replaces .find in sourceById)
     _annNameRanks, annotatorId → {rank, count} among non-deleted same-name peers
                         consumed by displayName() to append " (2)", " (3)" etc.
   Call after any mutation to S.annotators or S.sources (load, push, delete). */
function _rebuildParticipantMaps() {
  S.annotatorsById.clear();
  S.sourcesById.clear();
  _annNameRanks.clear();

  for (const a of S.annotators) S.annotatorsById.set(a.id, a);
  for (const s of S.sources)    S.sourcesById.set(s.id, s);

  // Group non-deleted annotators by name to compute disambiguation ranks
  const nameGroups = new Map();
  for (const a of S.annotators) {
    if (a.deleted) continue;
    if (!nameGroups.has(a.name)) nameGroups.set(a.name, []);
    nameGroups.get(a.name).push(a);
  }
  for (const [, group] of nameGroups) {
    group.forEach((a, i) => _annNameRanks.set(a.id, { rank: i, count: group.length }));
  }
}

/* C16: set the source-picker header title to signal single- vs multi-select mode. */
function _setSrcPickHeader() {
  const titleEl = document.getElementById('src-pick-title');
  if (titleEl) titleEl.textContent = _srcPickMode === 'single'
    ? t('panel.src.title_single') : t('panel.src.title_multi');
}

/* C15: shared anchored-dropdown positioner. Places panelEl just below anchorEl
   (flipping above when there isn't room), clamped into the viewport. Used by the
   annotator / source-pick / Leipzig panels, which all had this block copy-pasted. */
function _positionDropdown(panelEl, anchorEl) {
  const rect       = anchorEl?.getBoundingClientRect() || { bottom: 200, top: 200, left: 8 };
  const panelH     = panelEl.offsetHeight || 220;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const top  = spaceBelow >= panelH ? rect.bottom + 6 : rect.top - panelH - 6;
  const left = Math.min(rect.left, window.innerWidth - panelEl.offsetWidth - 8);
  panelEl.style.top  = Math.max(8, top)  + 'px';
  panelEl.style.left = Math.max(8, left) + 'px';
}

/* @fn openAnnPanel, show the annotator chip panel anchored to the button */
function openAnnPanel(inputEl, btnEl) {
  const panel = document.getElementById('ann-panel');
  if (!panel) return;

  // Toggle: clicking the same button while open → close
  if (_annTarget === inputEl?.id && panel.classList.contains('ann-visible')) {
    closeAnnPanel(); return;
  }

  _annTarget  = inputEl?.id || null;
  _annOpenBtn = btnEl;

  const filterEl = document.getElementById('ann-filter');
  if (filterEl) filterEl.value = '';
  renderAnnChips('');

  panel.classList.add('ann-visible');
  _positionDropdown(panel, btnEl);

  if (_annOpenBtn) _annOpenBtn.classList.add('ann-open');
  if (filterEl) setTimeout(() => filterEl.focus(), 50);
}

/* @fn closeAnnPanel */
function closeAnnPanel() {
  const panel = document.getElementById('ann-panel');
  if (panel) panel.classList.remove('ann-visible');
  if (_annOpenBtn) _annOpenBtn.classList.remove('ann-open');
  _annTarget  = null;
  _annOpenBtn = null;
}

/* ── Annotator preview panel (read-only, used in edit views) ─────────────── */

let _annPreviewId = null;   // annotator ID currently shown in the preview panel

/* @fn openAnnPreviewPanel, show the read-only annotator info panel anchored to a chip.
   Clicking the same chip while open closes it (toggle). */
function openAnnPreviewPanel(annId, anchorEl) {
  const panel = document.getElementById('ann-preview-panel');
  if (!panel) return;

  // Toggle: clicking the same chip while open → close
  if (_annPreviewId === annId && panel.classList.contains('app-visible')) {
    closeAnnPreviewPanel(); return;
  }

  _annPreviewId = annId;
  const ann = S.annotatorsById.get(annId);
  if (!ann) return;

  /* B-174, v3.14.337: `app-name` was on TWO elements — this panel's span and the
     header's own title block — and `getElementById` returns the first in document
     order, which is the header. Opening an annotator preview therefore replaced
     "LingCoT / Linguistic Corpus Toolkit" with the annotator's name, for the rest
     of the session, and left this panel's span empty. */
  const nameEl = document.getElementById('about-app-name');
  if (nameEl) nameEl.textContent = displayName(ann);

  // Wire edit button to the existing Edit Annotator modal
  const editBtn = document.getElementById('app-edit-btn');
  if (editBtn) editBtn.dataset.annId = annId;

  // Populate non-empty fields
  const fieldsEl = document.getElementById('app-fields');
  if (fieldsEl) {
    const rows = [];
    if (ann.role)         rows.push([t('label.participants.role'),         ann.role]);
    if (ann.affiliation)  rows.push([t('label.participants.affiliation'),  ann.affiliation]);
    if (ann.birth_decade) rows.push([t('label.participants.birth_decade'), ann.birth_decade]);
    if (ann.contact_info) rows.push([t('label.participants.contact_info'), ann.contact_info]);
    if (ann.researcher)   rows.push([t('label.participants.researcher'),   t('label.participants.yes')]);
    if (ann.other)        rows.push([t('label.participants.notes'),        ann.other]);

    fieldsEl.innerHTML = rows.length
      ? rows.map(([k, v]) =>
          `<div class="app-row">
             <span class="app-key">${esc(k)}</span>
             <span class="app-val">${esc(String(v))}</span>
           </div>`).join('')
      : `<span style="font-size:0.81rem;color:var(--text-muted)">${t('label.participants.no_details')}</span>`;
  }

  // Position panel anchored near the chip
  panel.classList.add('app-visible');
  const rect       = anchorEl?.getBoundingClientRect() || { bottom: 200, top: 200, left: 8 };
  const panelH     = panel.offsetHeight || 180;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const top  = spaceBelow >= panelH ? rect.bottom + 6 : rect.top - panelH - 6;
  const left = Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8);
  panel.style.top  = Math.max(8, top)  + 'px';
  panel.style.left = Math.max(8, left) + 'px';
}

/* @fn closeAnnPreviewPanel */
function closeAnnPreviewPanel() {
  const panel = document.getElementById('ann-preview-panel');
  if (panel) panel.classList.remove('app-visible');
  _annPreviewId = null;
}

/* @fn renderAnnChips, rebuild the chip list, optionally filtered */
function renderAnnChips(filterStr) {
  const container = document.getElementById('ann-chips');
  if (!container) return;
  const q    = filterStr.trim().toLowerCase();
  const list = annotatorList();
  const items = q ? list.filter(a => displayName(a).toLowerCase().includes(q)) : list;

  if (!items.length) {
    container.innerHTML = `<span style="color:var(--text-muted);font-size:.82rem;padding:4px 2px">${t('status.panel.ann.none_match')}</span>`;
    return;
  }

  container.innerHTML = items.map(a => {
    const name = displayName(a);
    const isActive = a.id === _activeAnnotatorId;
    return `<div class="chip chip-choice${isActive ? ' active' : ''}"
                 role="option" data-ann-id="${esc(a.id)}" title="${esc(a.affiliation||'')}">
              ${esc(name)}
            </div>`;
  }).join('');
}

/* ── Add / Edit annotator modal ──────────────────────────────────────────── */

/* @fn showAnnModal, open the Add/Edit Annotator modal.
   editId  null = Add new;  string = edit existing.
   onSaved optional callback fired after a new annotator is saved.
   select  B-095, true when a new annotator should become the active one. */
function showAnnModal(editId, onSaved, select = false) {
  _annModalEditId   = editId;
  _annModalCallback = onSaved || null;
  _annModalSelect   = !!select || !!onSaved;
  const existing = editId ? (S.annotatorsById.get(editId) || null) : null;

  const titleEl = document.getElementById('ann-modal-title');
  if (titleEl) titleEl.textContent = t(existing ? 'modal.ann.title.edit' : 'modal.ann.title.add');

  // Fill fields
  const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  f('am-name',        existing?.name || '');
  f('am-affiliation', existing?.affiliation || '');
  f('am-role',        existing?.role || '');
  f('am-birth',       existing?.birth_decade || '');
  f('am-contact',     existing?.contact_info || '');
  f('am-other',       existing?.other || '');
  const resEl = document.getElementById('am-researcher');
  if (resEl) resEl.checked = existing?.researcher ?? false;

  document.getElementById('ann-modal-backdrop').classList.add('ann-modal-open');
  document.getElementById('ann-modal-box').style.display = 'block';
  setTimeout(() => document.getElementById('am-name')?.focus(), 60);
}

/* @fn closeAnnModal */
function closeAnnModal() {
  _annModalSelect = false;
  document.getElementById('ann-modal-backdrop').classList.remove('ann-modal-open');
  document.getElementById('ann-modal-box').style.display = 'none';
  _annModalCallback = null;
  _annModalEditId   = null;
}

/* @fn nextParticipantId, the next free id in a `prefix_NNN` series.
   B-054. Both call sites used `list.length + 1`, under a comment that said
   "skip deleted to preserve stable IDs" while `.length` counted everything.
   Harmless only because nothing writes `.deleted` today: `annotator_id` is
   stamped into provenance on every annotated object, so a collision silently
   reattributes somebody's work to another person.

   Two ways it breaks. A delete that splices the array makes the next id collide
   with an existing one. And a participants file whose ids are not contiguous
   (`ann_001` + `ann_003`) gives `length + 1 = 3`, minting a duplicate straight
   away, with no delete involved at all.

   So it derives from the highest number actually in use, and ignores ids that
   do not match the pattern rather than letting them drag the maximum to zero:
   a hand-written or imported id is somebody else's convention, not a counter. */
function nextParticipantId(list, prefix) {
  const re = new RegExp(`^${prefix}_(\\d+)$`);
  let max = 0;
  for (const p of list || []) {
    const m = re.exec(String((p && p.id) || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  // Width follows the existing convention, and grows past 999 rather than
  // truncating: padStart never shortens.
  return `${prefix}_${String(max + 1).padStart(3, '0')}`;
}

/* @fn saveAnnModal, validate and persist the annotator from the modal */
function saveAnnModal() {
  const name = document.getElementById('am-name')?.value.trim() || '';
  if (!requireIdentity('annotator')) return;     // I1: the rule lives in the table

  const researcher  = document.getElementById('am-researcher')?.checked ?? false;
  const affiliation = document.getElementById('am-affiliation')?.value.trim() || null;
  const role        = document.getElementById('am-role')?.value.trim()        || null;
  const birth       = document.getElementById('am-birth')?.value.trim()       || null;
  const contact     = document.getElementById('am-contact')?.value.trim()     || null;
  const other       = document.getElementById('am-other')?.value.trim()       || null;

  if (_annModalEditId) {
    // Edit existing
    const ann = S.annotatorsById.get(_annModalEditId);
    if (ann) {
      Object.assign(ann, { name, researcher, affiliation, role,
                           birth_decade: birth, contact_info: contact, other });
      _rebuildParticipantMaps();   // refresh rank cache after name may have changed
    }
  } else {
    // Add new. B-054: the next FREE id, not the count.
    const newId   = nextParticipantId(S.annotators, 'ann');
    const newAnn  = {
      record_type: 'annotator', id: newId, name, researcher,
      affiliation, role, birth_decade: birth, contact_info: contact, other,
    };
    S.annotators.push(newAnn);
    _rebuildParticipantMaps();   // add new entry to Maps
    /* B-095: this used to write _activeAnnotatorId and nothing else, which does
       not select anybody — the bar input is what readAnnotator reads, and an
       empty bar is read as a deselection. Go through the one function that sets
       both. Still only when the modal was opened in order to pick, and still
       never over an annotator already chosen. */
    if (_annModalSelect && !_activeAnnotatorId) selectAnnotator(newAnn);
  }

  // Persist to disk and update view.
  // B-055: mutate('parts') rather than triggerAutoSave(), autosave now skips
  // targets nothing has touched, so a write that never bumps a generation would
  // be silently skipped. Going through the chokepoint is what marks it dirty.
  const cb = _annModalCallback;   // grab BEFORE closeAnnModal() clears it
  mutate('parts');
  closeAnnModal();
  if (cb) cb();                   // fire first-use guard continuation

  // If the Annotators view is open, re-render it
  if (S.view === 'annotators') render();
}

/* ── The two participant tables sort the same way ─────────────────────────────
   B-115. The annotators view sorted and the sources view did not, and the two
   are the same table — `.ann-table`, the same header row, the same edit column.
   The stylesheet even carried the divergence as a rule: I9 scoped the pointer
   cursor to `[data-ann-sort]` *because* the Sources headers offered a click that
   did nothing.

   Copying the sort block into the second view would have made two of them, which
   is the shape I13 is open about. One sorter, one header cell, one attribute,
   and a per-view state object.

   SORTED ON WHAT IS DISPLAYED, not on what is stored. A source's type renders
   through `srcTypeLabel` and an annotator's `researcher` renders as a tick, so
   ordering by the raw value would order by something the reader cannot see. The
   column map is where a view says what its cells actually show. */
function participantSort(list, state, cols) {
  /* Written as an arrow that CALLS the map by subscript rather than as a local
     holding the looked-up function: `undefined_call_test` reads a bare
     lowercase `get(...)` as a call to nothing defined, and it is right to —
     B-062 was exactly that shape, and a reader cannot tell a table lookup from
     a typo. Same correction as `_fieldApplies` at v3.14.308. */
  const get = r => (cols && cols[state.col] ? cols[state.col](r) : r[state.col]);
  return [...list].sort((a, b) => {
    const cmp = String(get(a) ?? '').localeCompare(String(get(b) ?? ''));
    return state.dir === 'asc' ? cmp : -cmp;
  });
}

/* @fn participantTh, one sortable header cell.
   Returns the whole element rather than an opening tag: a helper that emits half
   of one is a helper the next caller closes differently. */
function participantTh(state, col, label) {
  const cls = state.col === col ? `sorted-${state.dir}` : '';
  return `<th class="${cls}" data-psort="${esc(col)}">${esc(label)}</th>`;
}

/* @fn participantSortClick, the toggle. Mutated in place, because both views
   hold their state in a const the delegated handler picks between. */
function participantSortClick(state, col) {
  if (state.col === col) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  else { state.col = col; state.dir = 'asc'; }
}

/* ── Annotators view ─────────────────────────────────────────────────────── */

const _annViewSort = { col: 'name', dir: 'asc' };

/* What each column SHOWS, which is what it is ordered by. */
const _ANN_SORT_COLS = {
  name:         a => displayName(a),
  researcher:   a => (a.researcher ? '✓' : ''),
  affiliation:  a => a.affiliation || '',
  role:         a => a.role || '',
  birth_decade: a => a.birth_decade || '',
};

/* @fn renderAnnotatorsView */
function renderAnnotatorsView() {
  const list = participantSort(
    [...S.annotators].filter(a => !a.deleted), _annViewSort, _ANN_SORT_COLS);

  const rows = list.length ? list.map(a => {
    const name     = esc(displayName(a));
    const isActive = a.id === _activeAnnotatorId;
    const isFocus  = a.id === _annFocusId;          // navigated from a prov history link
    const rowCls   = isFocus ? ' class="ann-row-focus"' : '';
    return `<tr${rowCls} data-ann-id="${esc(a.id)}">
      <td>${name}${isActive ? `<span class="ann-active-badge">${t('badge.ann.active')}</span>` : ''}</td>
      <td style="text-align:center">${a.researcher ? icon('check-circle') : ''}</td>
      <td>${esc(a.affiliation || '')}</td>
      <td>${esc(a.role || '')}</td>
      <td>${esc(a.birth_decade || '')}</td>
      <td><button class="edit-btn" data-action="ann-edit" data-ann-id="${esc(a.id)}">${icon('note-pencil')} ${t('btn.panel.ann.row_edit')}</button></td>
    </tr>`;
  }).join('')
  : `<tr><td colspan="6" style="color:var(--text-muted);padding:20px 12px;font-style:italic">${t('status.panel.ann.empty')}</td></tr>`;

  // Go back to the document view if a corpus is loaded, otherwise the empty state.
  const backTarget = S.docs.length ? 'document' : 'empty';
  return `
    <div class="back-btn" data-go="${backTarget}">${icon('arrow-left')} ${t('nav.back.generic')}</div>
    <div class="ann-view-topbar">
      <div class="edit-page-title"><span>${t('btn.nav.annotators_view')}</span></div>
      <button class="btn btn-primary btn-lg" data-action="ann-add-new">${icon('user-plus')} ${t('btn.panel.ann.panel_add')}</button>
    </div>
    <table class="ann-table">
      <thead>
        <tr>
          ${participantTh(_annViewSort, 'name', t('label.participants.name'))}
          ${participantTh(_annViewSort, 'researcher', t('label.participants.researcher'))}
          ${participantTh(_annViewSort, 'affiliation', t('label.participants.affiliation'))}
          ${participantTh(_annViewSort, 'role', t('label.participants.role'))}
          ${participantTh(_annViewSort, 'birth_decade', t('label.participants.birth_decade'))}
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SOURCES. CRUD, VIEW, PICKER
   ─────────────────────────────────────────────────────────────────────────────
   Sources are stored as { record_type: "source".. } in the participants JSONL
   alongside annotators.  S.sources holds them in memory.

   Source picker: a reusable inline component for edit forms.
   renderSourcePicker(containerId, sourceIds) → HTML string
   readSourcePicker(containerId)              → [src_id..]
══════════════════════════════════════════════════════════════════════════════ */

/* Return non-deleted sources sorted alphabetically. */
// @fn sourceList
function sourceList() {
  return S.sources.filter(s => !s.deleted).sort((a, b) => a.name.localeCompare(b.name));
}

/* Look up a source by ID (including deleted). O(1) via S.sourcesById Map. */
// @fn sourceById
function sourceById(id) {
  return S.sourcesById.get(id) || null;
}

/* Human-readable label for a source type value. */
// @fn srcTypeLabel
function srcTypeLabel(type) {
  const key = { human: 'option.src_type.human', text: 'option.src_type.text', media: 'option.src_type.media' }[type];
  return key ? t(key) : (type || '');
}

/* Human-readable label for a publication restriction value. */
// @fn srcRestrictLabel
function srcRestrictLabel(r) {
  const map = {
    do_not_publish:             'option.pub_restrict.do_not_publish',
    do_not_share:               'option.pub_restrict.do_not_share',
    share_with_authorization:   'option.pub_restrict.share_with_auth',
    publish_with_authorization: 'option.pub_restrict.publish_with_auth',
    no_restriction:             'option.pub_restrict.no_restriction',
  };
  return map[r] ? t(map[r]) : (r || '');
}

/* Render a compact read-only chip for a source (used in render views).
   When the source has an id, the chip is a hyperlink to the Sources view. */
// @fn renderSourceChip
function renderSourceChip(src) {
  if (!src) return '';
  const linkAttrs = src.id
    ? ` data-action="go-source" data-src-id="${escAttr(src.id)}" title="${t('title.row.src.go')}"`
    : '';
  return `<span class="chip"${linkAttrs}>${esc(src.name)}<span class="chip-meta">${esc(srcTypeLabel(src.type))}</span></span>`;
}

/* ── Sources view ─────────────────────────────────────────────────────────── */

/* B-115: the sources table sorts too, through the same three helpers. `name` is
   the default, which is the order `sourceList()` already returned — so nothing
   moves until a header is clicked. */
const _srcViewSort = { col: 'name', dir: 'asc' };

const _SRC_SORT_COLS = {
  name:                    s => s.name || '',
  type:                    s => srcTypeLabel(s.type),
  publication_restrictions: s => (s.publication_restrictions
                                  && s.publication_restrictions !== 'no_restriction')
                                 ? srcRestrictLabel(s.publication_restrictions) : '',
};

/* @fn renderSourcesView */
function renderSourcesView() {
  const list = participantSort(sourceList(), _srcViewSort, _SRC_SORT_COLS);
  const backTarget = S.docs.length ? 'document' : 'empty';

  const rows = list.length ? list.map(s => {
    const restrict = s.publication_restrictions !== 'no_restriction' && s.publication_restrictions
      ? `<span style="color:var(--text-muted);font-size:0.78rem">${esc(srcRestrictLabel(s.publication_restrictions))}</span>` : '';
    const isFocus = s.id === _srcFocusId;  // navigated from a source chip link
    const rowCls  = isFocus ? ' class="src-row-focus"' : '';
    return `<tr data-src-id="${esc(s.id)}"${rowCls}>
      <td>${esc(s.name)}</td>
      <td>${esc(srcTypeLabel(s.type))}</td>
      <td>${restrict}</td>
      <td><button class="edit-btn" data-action="src-edit" data-src-id="${esc(s.id)}">${icon('note-pencil')} ${t('btn.panel.src.row_edit')}</button></td>
    </tr>`;
  }).join('')
  : `<tr><td colspan="4" style="color:var(--text-muted);padding:20px 12px;font-style:italic">${t('status.panel.src.empty')}</td></tr>`;

  return `
    <div class="back-btn" data-go="${backTarget}">${icon('arrow-left')} ${t('nav.back.generic')}</div>
    <div class="src-view-topbar">
      <div class="edit-page-title"><span>${t('btn.nav.sources_view')}</span></div>
      <button class="btn btn-primary btn-lg" data-action="src-add-new">${icon('plus-circle')} ${t('btn.panel.src.panel_add')}</button>
    </div>
    <table class="ann-table">
      <thead>
        <tr>
          ${participantTh(_srcViewSort, 'name', t('label.participants.name'))}
          ${participantTh(_srcViewSort, 'type', t('label.participants.type'))}
          ${participantTh(_srcViewSort, 'publication_restrictions', t('label.participants.restrictions'))}
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── Sources modal (Add / Edit) ──────────────────────────────────────────── */

let _srcModalEditId   = null;   // ID of source being edited; null = new
let _srcModalCallback = null;   // fired with newId after a new source is saved (mirrors the annotator modal's)

/* @fn showSrcModal, open Add/Edit Source modal.
   editId   null = Add new;  string = edit existing.
   onSaved  optional callback(newId) fired after a new source is saved, used by the
            source picker to auto-select the new source and reopen the panel. */
function showSrcModal(editId, onSaved) {
  _srcModalEditId   = editId;
  _srcModalCallback = onSaved || null;
  const ex = editId ? sourceById(editId) : null;

  const titleEl = document.getElementById('src-modal-title');
  if (titleEl) titleEl.textContent = t(ex ? 'modal.src.title.edit' : 'modal.src.title.add');

  // Fill all fields
  const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  f('sm-name',     ex?.name     || '');
  f('sm-other',    ex?.other_information || '');

  // Type selector
  const typeEl = document.getElementById('sm-type');
  if (typeEl) typeEl.value = ex?.type || 'human';

  // Restriction selector
  const restrictEl = document.getElementById('sm-restrict');
  if (restrictEl) restrictEl.value = ex?.publication_restrictions || 'no_restriction';

  // Human-only fields
  f('sm-birth',    ex?.birth_decade       || '');
  f('sm-gender',   ex?.gender             || '');
  f('sm-langbg',   ex?.language_background || '');
  const resEl = document.getElementById('sm-researcher');
  if (resEl) resEl.checked = ex?.researcher ?? false;

  // Non-human field
  f('sm-citation', ex?.citation_information || '');

  // Show/hide conditional fields based on current type
  _srcModalUpdateFields();

  document.getElementById('src-modal-backdrop').classList.add('ann-modal-open');
  setTimeout(() => document.getElementById('sm-name')?.focus(), 60);
}

/* @fn closeSrcModal */
function closeSrcModal() {
  document.getElementById('src-modal-backdrop').classList.remove('ann-modal-open');
  _srcModalEditId   = null;
  _srcModalCallback = null;
}

/* Show/hide human-only and non-human fields based on the type dropdown. */
// @fn _srcModalUpdateFields
function _srcModalUpdateFields() {
  const type      = document.getElementById('sm-type')?.value || 'human';
  const isHuman   = type === 'human';
  const humanDiv  = document.getElementById('sm-human-fields');
  const nonHumDiv = document.getElementById('sm-nonhuman-fields');
  if (humanDiv)  humanDiv.style.display  = isHuman ? '' : 'none';
  if (nonHumDiv) nonHumDiv.style.display = isHuman ? 'none' : '';
}

/* @fn saveSrcModal, validate and persist the source from the modal */
function saveSrcModal() {
  const name = document.getElementById('sm-name')?.value.trim() || '';
  if (!requireIdentity('source')) return;        // I1

  const type        = document.getElementById('sm-type')?.value        || 'human';
  const restrict    = document.getElementById('sm-restrict')?.value    || 'no_restriction';
  const other       = document.getElementById('sm-other')?.value.trim()    || null;
  const isHuman     = type === 'human';
  const birth       = isHuman ? (document.getElementById('sm-birth')?.value.trim()  || null) : null;
  const gender      = isHuman ? (document.getElementById('sm-gender')?.value.trim() || null) : null;
  const langbg      = isHuman ? (document.getElementById('sm-langbg')?.value.trim() || null) : null;
  const researcher  = isHuman ? (document.getElementById('sm-researcher')?.checked ?? false) : null;
  const citation    = !isHuman ? (document.getElementById('sm-citation')?.value.trim() || null) : null;

  let savedNewId = null;   // set below when adding new; used for callback

  if (_srcModalEditId) {
    // Edit existing
    const src = sourceById(_srcModalEditId);
    if (src) {
      Object.assign(src, { name, type, publication_restrictions: restrict,
        other_information: other,
        birth_decade: birth, gender, language_background: langbg, researcher,
        citation_information: citation });
      // No _rebuildParticipantMaps() needed for edits: the object reference in the
      // Map is the same object, so mutation is automatically reflected.
    }
  } else {
    // Add new. B-054, same rule as the annotator side.
    savedNewId    = nextParticipantId(S.sources, 'src');
    S.sources.push({
      record_type: 'source', id: savedNewId, name, type,
      publication_restrictions: restrict, other_information: other,
      birth_decade: birth, gender, language_background: langbg, researcher,
      citation_information: citation,
    });
    _rebuildParticipantMaps();   // add new source to S.sourcesById
  }

  // Grab callback before closeSrcModal() clears it
  const cb = _srcModalCallback;
  mutate('parts');   // B-055: see saveAnnotator, must bump the 'parts' generation
  closeSrcModal();
  if (S.view === 'sources') render();
  // If triggered from a picker, auto-select the new source and resume the flow
  if (cb && savedNewId) cb(savedNewId);
}

/* ── Source Picker (Step 3) ──────────────────────────────────────────────── */
/* A reusable inline component.  Each edit form that needs source assignment
   calls renderSourcePicker(containerId, currentSourceIds) and embeds the
   returned HTML.  readSourcePicker(containerId) reads the current selection. */

/* Build the HTML for an inline source picker.
   containerId, a unique string used as the base for child element IDs.
   sourceIds, array of currently-assigned source IDs (may be empty). */
// @fn renderSourcePicker
function renderSourcePicker(containerId, sourceIds) {
  const ids   = Array.isArray(sourceIds) ? sourceIds : [];
  const chips = ids.map(id => {
    const src = sourceById(id);
    const label = src ? esc(src.name) : esc(id);
    // D44: a token — a source already attached, with the × that detaches it.
    return `<span class="chip chip-token src-sel-chip" data-src-id="${esc(id)}">
      <span class="chip-label">${label}</span>
      <button class="chip-x" type="button"
              data-action="src-pick-remove"
              data-src-id="${esc(id)}"
              data-container="${esc(containerId)}"
              title="${t('title.row.src.remove')}">×</button>
    </span>`;
  }).join('');

  return `<div class="src-picker-wrap" id="${esc(containerId)}">
    <div class="src-sel-chips" id="${esc(containerId)}-sel">${chips}</div>
    <button class="src-add-btn" type="button"
            data-action="open-src-pick"
            data-container="${esc(containerId)}">${t('btn.panel.src.pick')}</button>
  </div>`;
}

/* Read the currently selected source IDs from a picker's DOM.
   Returns an array of source ID strings. */
// @fn readSourcePicker
function readSourcePicker(containerId) {
  const sel = document.getElementById(containerId + '-sel');
  if (!sel) return [];
  return [...sel.querySelectorAll('.src-sel-chip[data-src-id]')]
    .map(el => el.dataset.srcId)
    .filter(Boolean);
}

/* ── Source picker panel (multi-select and single-select) ───────────────────
   _srcPickMode 'multi', toggles chips in a multi-source picker (doc/section edit)
                'single', selects one source and closes (translation rows)        */

let _srcPickTarget  = null;    // containerId the panel is currently serving
let _srcPickOpenBtn = null;    // the "Pick sources" button that opened the panel
let _srcPickMode    = 'multi'; // 'multi' | 'single'

/* Counters for unique IDs on dynamically-generated row src pickers */
let _transRowCounter   = 0;
let _commentRowCounter = 0;

/* @fn openSrcPickPanel, show the floating picker anchored to a button */
function openSrcPickPanel(containerId, btnEl) {
  const panel = document.getElementById('src-pick-panel');
  if (!panel) return;

  // Toggle: same button while open → close
  if (_srcPickTarget === containerId && panel.classList.contains('spp-visible')) {
    closeSrcPickPanel(); return;
  }

  _srcPickTarget  = containerId;
  _srcPickOpenBtn = btnEl;
  // Read mode from the button's data-single attribute: single-select for translation rows
  _srcPickMode    = btnEl?.dataset.single ? 'single' : 'multi';

  const filterEl = document.getElementById('src-pick-filter');
  if (filterEl) filterEl.value = '';
  _renderSrcPickChips('');

  panel.classList.add('spp-visible');
  _setSrcPickHeader();            // C16: mode-aware header (Select source vs Add sources)
  _positionDropdown(panel, btnEl);

  // Mark the trigger button as open (mirrors ann-panel's ann-open pattern)
  if (_srcPickOpenBtn) _srcPickOpenBtn.classList.add('spp-open');

  if (filterEl) setTimeout(() => filterEl.focus(), 50);
}

/* @fn closeSrcPickPanel */
function closeSrcPickPanel() {
  const panel = document.getElementById('src-pick-panel');
  if (panel) panel.classList.remove('spp-visible');
  if (_srcPickOpenBtn) _srcPickOpenBtn.classList.remove('spp-open');
  _srcPickTarget  = null;
  _srcPickOpenBtn = null;
  _srcPickMode    = 'multi';   // reset to default
}

/* Rebuild the chip list inside the picker panel, respecting a filter string
   and marking already-selected sources. */
// @fn _renderSrcPickChips
function _renderSrcPickChips(filterStr) {
  const container = document.getElementById('src-pick-chips');
  if (!container) return;
  const q    = filterStr.trim().toLowerCase();
  const list = sourceList();
  const items = q ? list.filter(s => s.name.toLowerCase().includes(q)) : list;

  // Find currently selected IDs, multi reads the chip list; single reads trans-src-chip
  let selIds;
  if (_srcPickMode === 'single') {
    const wrap  = _srcPickTarget ? document.getElementById(_srcPickTarget) : null;
    const curId = wrap?.querySelector('.trans-src-chip')?.dataset.srcId || '';
    selIds = curId ? new Set([curId]) : new Set();
  } else {
    selIds = new Set(_srcPickTarget ? readSourcePicker(_srcPickTarget) : []);
  }

  let html = '';

  // In single-select mode, prepend a "- no source -" option to allow clearing
  if (_srcPickMode === 'single') {
    const noneSelected = selIds.size === 0;
    html += `<div class="src-pick-chip${noneSelected ? ' spc-sel' : ''}"
                  data-action="src-pick-toggle" data-src-id="">
               <span>${esc(t('label.src.none'))}</span>
             </div>`;
  }

  if (!items.length) {
    container.innerHTML = html + `<span style="color:var(--text-muted);font-size:.82rem;padding:4px 6px">${t('status.panel.src.empty_picker')}</span>`;
    return;
  }

  html += items.map(s => {
    const isSel = selIds.has(s.id);
    const typeLabel = srcTypeLabel(s.type);
    return `<div class="src-pick-chip${isSel ? ' spc-sel' : ''}"
                 data-action="src-pick-toggle"
                 data-src-id="${esc(s.id)}">
              <span>${esc(s.name)}</span>
              <span class="spc-type">${esc(typeLabel)}</span>
            </div>`;
  }).join('');

  container.innerHTML = html;
}

/* Toggle a source in/out of the target picker when its chip is clicked in the panel. */
// @fn _srcPickToggle
function _srcPickToggle(srcId) {
  if (!_srcPickTarget) return;
  const sel  = document.getElementById(_srcPickTarget + '-sel');
  if (!sel) return;

  const existing = sel.querySelector(`.src-sel-chip[data-src-id="${CSS.escape(srcId)}"]`);
  if (existing) {
    // Already selected, remove it
    existing.remove();
  } else {
    // Add chip
    const src   = sourceById(srcId);
    const label = src ? esc(src.name) : esc(srcId);
    const chip  = document.createElement('span');
    chip.className  = 'chip chip-token src-sel-chip';
    chip.dataset.srcId = srcId;
    chip.innerHTML  = `<span class="chip-label">${label}</span>
      <button class="chip-x" type="button"
              data-action="src-pick-remove"
              data-src-id="${esc(srcId)}"
              data-container="${esc(_srcPickTarget)}"
              title="${t('title.row.src.remove')}">×</button>`;
    sel.appendChild(chip);
  }
  // Refresh panel chips to reflect new selection state
  const filterEl = document.getElementById('src-pick-filter');
  _renderSrcPickChips(filterEl?.value || '');
}

/* @fn _srcPickSingleSelect, set one source on a translation-row picker and close.
   In single mode, each row has a .trans-src-chip that stores the selection via
   data-src-id; there is no separate chip list like the multi-select picker. */
function _srcPickSingleSelect(srcId) {
  if (!_srcPickTarget) return;
  const wrap = document.getElementById(_srcPickTarget);
  if (!wrap) return;
  const chip = wrap.querySelector('.trans-src-chip');
  if (!chip) return;

  /* D44: the chip is a token now, so the label lives in a child and the
     attached/empty distinction is a class rather than a text colour. */
  chip.dataset.srcId = srcId;
  const label = chip.querySelector('.chip-label') || chip;
  if (srcId) {
    const src = sourceById(srcId);
    label.textContent = src ? src.name : srcId;
    chip.classList.remove('chip-empty');
  } else {
    label.textContent = t('label.src.none');
    chip.classList.add('chip-empty');
  }

  // Update the toggle button label to reflect whether a source is set
  const btn = wrap.querySelector('[data-action="open-src-pick"]');
  if (btn) btn.innerHTML = `${icon('stack')} ${srcId ? t('btn.row.trans.change_source') : t('btn.row.trans.add_source')}`;

  closeSrcPickPanel();
}

/* @fn _srcPickApply, dispatch to single- or multi-select handler based on mode.
   Called from both the panel chip-click handler and the "+ New source" callback. */
function _srcPickApply(srcId) {
  if (_srcPickMode === 'single') _srcPickSingleSelect(srcId);
  else _srcPickToggle(srcId);
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMMENTS EDITOR, shared reusable component (Step 4)
   ─────────────────────────────────────────────────────────────────────────────
   Schema: comments = [ { text, source_id, date }.. ]
   Each entry has a text textarea, a single-source <select>, and a date field.
   Add/remove rows are handled by delegated click handlers on #content.

   renderCommentsEditor(containerId, comments) → HTML string
   readCommentsEditor(containerId)             → [ { text, source_id, date }.. ]
   renderCommentsView(comments)                → read-only HTML for render views
══════════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════════
   ROW EDITORS — one descriptor per repeated-row collection (I2, v3.14.404)
   ─────────────────────────────────────────────────────────────────────────────
   INPUT_UX_AUDIT §3.1 measured five near-copies: each collection had its own row
   builder, its own `render*Editor`, its own `read*Editor`, its own add and
   remove `data-action`, and its own handler in `events.js` — and the handlers
   differed in exactly three things: the builder called, the class removed, and
   the child focused. The copy-paste was visible in the markup, where the
   allomorph and selection remove buttons both wear `class="translit-remove"`
   and `.translit-remove` is the only rule styling any of them.

   WHAT IT COST, which is the reason this is worth doing and not tidying: every
   change to row behaviour had five sites and nothing kept them aligned. None
   committed on Enter, none supported reordering, and adding either was five
   edits or a divergence. **D39 is blocked on this** and D31 is written as "a
   consumer of I2" — the smallest reordering feature had nowhere to land.

   WHAT A DESCRIPTOR HAS TO EXPRESS. Four of the five are the same shape. The
   fifth, `sel`, differs in two ways that are real rather than accidental: its
   rows are found through the enclosing frame instead of by container id, and a
   frame may never be left with zero rows. Excluding it would have been the easy
   move and the wrong one — those two facts are what `rows` and `minOne` are for,
   and a descriptor that cannot say them is not describing the app.

   NOT INCLUDED, deliberately: `sel-frame` (frames carry collapse state, a
   derived summary and templates — a different thing that contains rows), and the
   morpheme and section row editors in `LingCoT.html`, which carry their own
   parse and ingest logic. The audit scoped I2 to these five; widening it here
   would be scope the audit never measured.
══════════════════════════════════════════════════════════════════════════════ */

/* @fn _copyMarks, a copied row's origin (D40 stage B), read back with its
   values. Only present on a row filled from an offer; takeCopyMarks removes
   them before anything is stored. */
function _copyMarks(row) {
  if (!row.dataset.copyFrom) return {};
  const m = { _copyFrom: row.dataset.copyFrom, _copyText: row.dataset.copyText || '' };
  if (row.dataset.copyLabel !== undefined) m._copyLabel = row.dataset.copyLabel;
  return m;
}

/* @fn _copyAttrs, the same marks written onto a row, plus a "from P1 S2" note */
function _copyAttrs(row) {
  if (!row?._copyFrom) return { attrs: '', note: '' };
  let attrs = ` data-copy-from="${esc(row._copyFrom)}" data-copy-text="${esc(row._copyText || '')}"`;
  if (row._copyLabel !== undefined) attrs += ` data-copy-label="${esc(row._copyLabel)}"`;
  return { attrs, note: `<div class="row-copy-note text-sm text-muted">${t('hint.copy.from', { loc: sentPosLabel(row._copyFrom) })}</div>` };
}

/* @const ROW_EDITORS, the whole of what differs between the row collections.
   `build` and `fields` are the two halves nothing else can supply: one writes a
   row, the other reads one back. Everything else is a string or a predicate. */
const ROW_EDITORS = {
  comment: {
    rowClass: 'comment-row', focus: '.comment-text', layout: 'stacked',
    build: v => _commentRowHtml(v),
    fields: row => ({
      text:      row.querySelector('.comment-text')?.value.trim() || '',
      source_id: row.querySelector('.trans-src-chip')?.dataset.srcId || null,
      date:      row.querySelector('.comment-date')?.value.trim() || null,
    }),
    normalise: v => ({ ...v, source_id: v.source_id || null, date: v.date || null }),
    keep: v => !!v.text,
  },
  translit: {
    rowClass: 'translit-row', focus: '.translit-label', layout: 'inline',
    build: v => _translitRowHtml(v),
    fields: row => ({
      label: row.querySelector('.translit-label')?.value.trim() || '',
      text:  row.querySelector('.translit-text')?.value.trim()  || '',
      ..._copyMarks(row),
    }),
    keep: v => !!(v.label || v.text),
  },
  allomorph: {
    rowClass: 'allomorph-row', focus: '.allomorph-form', layout: 'inline',
    build: v => _allomorphRowHtml(v),
    fields: row => ({
      form:        row.querySelector('.allomorph-form')?.value.trim() || '',
      environment: row.querySelector('.allomorph-env')?.value.trim()  || '',
    }),
    keep: v => !!v.form,
  },
  translation: {
    rowClass: 'translation-row', focus: '.translation-text', layout: 'stacked',
    build: v => _translationRowHtml(v),
    fields: row => ({
      text:      row.querySelector('.translation-text')?.value.trim() || '',
      source_id: row.querySelector('.trans-src-chip')?.dataset.srcId || null,
      date:      row.querySelector('.translation-date')?.value.trim() || null,
      ..._copyMarks(row),
    }),
    normalise: v => ({ ...v, source_id: v.source_id || null, date: v.date || null }),
    keep: v => !!v.text,
  },
  /* D27 P1. The two exceptions, declared rather than special-cased in a handler. */
  sel: {
    rowClass: 'sel-row', focus: '.sel-cat', layout: 'inline',
    build: v => _selRowHtml(v),
    /* Rows live inside the frame the button belongs to, not under an id. */
    rows: btn => btn.closest('.sel-frame')?.querySelector('.sel-rows'),
    /* A frame with no selects is unreadable and would be dropped on save. */
    minOne: true,
    /* Reading frames is `readSelectionEditor`'s job: it walks two levels and
       omits empty keys rather than storing "". Left where it is. */
  },
};

/* @fn rowsElFor, the rows container a row button acts on.
   Default is `<container>-rows` by id, which four of the five use. */
function rowsElFor(kind, btn) {
  const d = ROW_EDITORS[kind];
  if (!d) return null;
  if (d.rows) return d.rows(btn);
  return document.getElementById(btn.dataset.container + '-rows');
}

/* @fn addRowTo, the ONE add. Was five copies of three lines. */
function addRowTo(kind, btn) {
  const d = ROW_EDITORS[kind];
  const rowsEl = rowsElFor(kind, btn);
  if (!d || !rowsEl) return false;
  rowsEl.insertAdjacentHTML('beforeend', d.build(null));
  rowsEl.lastElementChild?.querySelector(d.focus)?.focus();
  return true;
}

/* @fn removeRowFrom, the ONE remove, including `minOne`. */
function removeRowFrom(kind, btn) {
  const d = ROW_EDITORS[kind];
  if (!d) return false;
  const row = btn.closest('.' + d.rowClass);
  const rowsEl = row?.parentElement;
  row?.remove();
  if (d.minOne && rowsEl && !rowsEl.querySelector('.' + d.rowClass))
    rowsEl.insertAdjacentHTML('beforeend', d.build(null));
  return true;
}

/* @fn readRowEditor, the ONE reader: query the rows, map each, drop the ones
   the collection says not to keep. Was the same shape four times. */
function readRowEditor(kind, containerId) {
  const d = ROW_EDITORS[kind];
  const rowsEl = document.getElementById(containerId + '-rows');
  if (!d || !d.fields || !rowsEl) return [];
  return [...rowsEl.querySelectorAll('.' + d.rowClass)]
    .map(row => { const v = d.fields(row); return d.normalise ? d.normalise(v) : v; })
    .filter(d.keep);
}

/* @fn rowEditorHtml, the ONE render. `addClass` is passed rather than declared
   the add button. v3.14.407: one `row-add` class for every collection, so the
   caller no longer passes one. */
function rowEditorHtml(kind, containerId, list, opts) {
  const d = ROW_EDITORS[kind];
  if (!d) return '';
  const { editorClass, rowsClass, addIcon, addLabel } = opts;
  const items = Array.isArray(list) ? list : [];
  return `<div class="${editorClass}" id="${esc(containerId)}">
    <div class="${rowsClass}" id="${esc(containerId)}-rows">${items.map(d.build).join('')}</div>
    <button class="row-add" type="button"
            data-action="${kind}-add"
            data-container="${esc(containerId)}">${icon(addIcon)} ${t(addLabel)}</button>
  </div>`;
}

/* @const LIST_VIEWS, the read-only half of what ROW_EDITORS declares (D62 C).
   Four render*View functions drew the same list shape four ways: four font
   sizes between 0.85 and 0.9 rem, three separator conventions, two placements
   for the secondary part. None of them was chosen against the other three.

   `layout` is NOT restated here — it is read off ROW_EDITORS, because the
   editor and the view are two presentations of one collection and a second
   copy is a second thing to keep in step.

   primary    prose | segment. A segment string is read character by character
              (a length mark, a schwa, a combining diacritic against a
              precomposed one) so it takes --mono. Prose takes the body face.
   secondary  attribution | qualifier | scheme. Attribution goes below the
              primary; the other two go beside it, and `scheme` LEADS because a
              scheme name is a closed set repeating down the column, so it reads
              as a column header rather than a suffix.
   emphasis   meta-language means the text is not in the object language:
              italic, and quoted. A convention, not decoration.

   The per-collection row classes (.comment-view-row and its three siblings) are
   gone rather than kept: nothing queried them, and once the layout is declared
   they would be four names with no rule, which is the half of L-046 this
   closes. Target `.comments-view .lv-row` if one of them ever needs its own. */
const LIST_VIEWS = {
  comment: {
    container: 'comments-view',
    primary: 'prose', secondary: 'attribution', emphasis: 'none',
    keep: c => !!c.text,
    read: c => ({ primary: c.text, secondary: _srcDateMeta(c) }),
  },
  translation: {
    container: 'translations-view',
    primary: 'prose', secondary: 'attribution', emphasis: 'meta-language',
    keep: t => !!t.text,
    read: t => ({ primary: t.text, secondary: _srcDateMeta(t) }),
  },
  translit: {
    container: 'transliterations-view',
    primary: 'segment', secondary: 'scheme', emphasis: 'none',
    keep: t => !!t.text,
    read: t => ({ primary: t.text, secondary: t.label || '' }),
  },
  allomorph: {
    container: 'allomorphs-view',
    primary: 'segment', secondary: 'qualifier', emphasis: 'none',
    keep: a => !!a.form,
    read: a => ({ primary: a.form, secondary: a.environment || '' }),
  },
};

/* `source · date`, the attribution line both stacked views carry. */
// @fn _srcDateMeta
function _srcDateMeta(v) {
  const src = v.source_id ? sourceById(v.source_id) : null;
  return [src ? src.name : null, v.date || null].filter(Boolean).join(' \u00b7 ');
}

// @fn listViewHtml, read-only HTML for one list collection
function listViewHtml(kind, list) {
  const d = LIST_VIEWS[kind];
  if (!d || !Array.isArray(list) || !list.length) return '';
  const layout = (ROW_EDITORS[kind] || {}).layout || 'inline';
  const meta   = d.emphasis === 'meta-language';
  const rows = list.filter(d.keep).map(v => {
    const { primary, secondary } = d.read(v);
    const prim = `<span class="lv-primary lv-primary--${d.primary}">${
      meta ? "'" + esc(primary) + "'" : esc(primary)}</span>`;
    const sec  = secondary
      ? `<span class="lv-secondary lv-secondary--${d.secondary}">${esc(secondary)}</span>`
      : '';
    return `<div class="lv-row lv-row--${layout}${meta ? ' lv-row--meta' : ''}">${
      d.secondary === 'scheme' ? sec + prim : prim + sec}</div>`;
  }).join('');
  return rows ? `<div class="${d.container}">${rows}</div>` : '';
}

/* Build HTML for a single comment row.
   comment may be { text, source_id, date } or null for a blank new row.
   Source selection uses the same single-select chip picker as translation rows
   (trans-src-wrap / trans-src-chip) so _srcPickSingleSelect works without changes. */
// @fn _commentRowHtml
function _commentRowHtml(comment) {
  const text      = comment?.text      || '';
  const srcId     = comment?.source_id || '';
  const date      = comment?.date      || '';
  const uid       = 'cm-src-' + (++_commentRowCounter);
  const src       = srcId ? sourceById(srcId) : null;
  const srcLabel  = src ? esc(src.name) : (srcId ? esc(srcId) : '');
  const hasSource = !!srcId;
  return `<div class="comment-row row-ed row-ed--stacked">
    <textarea ${LING_ATTRS} class="comment-text" placeholder="${t('placeholder.row.comment')}" dir="auto">${esc(text)}</textarea>
    <div class="comment-meta">
      <div class="trans-src-wrap" id="${esc(uid)}">
        <span class="chip chip-token trans-src-chip${hasSource ? '' : ' chip-empty'}"
              data-src-id="${esc(srcId)}"><span class="chip-label">${srcLabel || t('label.src.none')}</span></span>
        <button class="src-add-btn" type="button"
                data-action="open-src-pick"
                data-container="${esc(uid)}"
                data-single="true"
                title="${t('title.row.src.select')}">${icon('stack')} ${hasSource ? t('btn.row.trans.change_source') : t('btn.row.trans.add_source')}</button>
      </div>
      <input ${LING_ATTRS} class="comment-date" type="text" value="${esc(date)}" placeholder="${t('placeholder.row.date')}">
      <button class="row-x" type="button"
              data-action="comment-remove" title="${t('title.row.comment.remove')}">${icon('x')}</button>
    </div>
  </div>`;
}

/* Render the full comments editor for an edit form.
   containerId, unique base ID; comments, array or null/undefined. */
// @fn renderCommentsEditor
function renderCommentsEditor(containerId, comments) {
  return rowEditorHtml('comment', containerId, comments, {
    editorClass: 'comments-editor', rowsClass: 'comment-rows',
    addIcon: 'chat-text', addLabel: 'btn.row.comment.add' });
}

/* Read back the current comments from the editor DOM.
   Returns an array of { text, source_id, date }, empty-text rows are skipped. */
// @fn readCommentsEditor
function readCommentsEditor(containerId) { return readRowEditor('comment', containerId); }

/* Render comments as a compact read-only block for render views.
   Returns '' if there are no comments. */
// @fn renderCommentsView
function renderCommentsView(comments) { return listViewHtml('comment', comments); }

/* ══════════════════════════════════════════════════════════════════════════════
   TRANSLITERATIONS EDITOR, shared reusable component (Step 5)
   ─────────────────────────────────────────────────────────────────────────────
   Schema: transliterations = [ { label, text }.. ]
   Each row: a label field (romanization system name) + a text field.

   renderTransliterationsEditor(containerId, transliterations) → HTML string
   readTransliterationsEditor(containerId)                   → [ { label, text }.. ]
   renderTransliterationsView(transliterations)                → read-only HTML
══════════════════════════════════════════════════════════════════════════════ */

/* Build HTML for a single transliteration row.
   t may be { label, text } or null for a blank new row. */
// @fn _translitRowHtml
function _translitRowHtml(row) {
  const label = row?.label || '';
  const text  = row?.text  || '';
  const cp    = _copyAttrs(row);
  return `<div class="translit-row row-ed row-ed--inline"${cp.attrs}>
    <input class="translit-label ac-input" data-ac-pool="translit_label" type="text" ${LING_ATTRS} dir="ltr" value="${esc(label)}" placeholder="${t('placeholder.row.translit_system')}">
    <input class="translit-text" type="text" ${LING_ATTRS} dir="auto" value="${esc(text)}" placeholder="${t('placeholder.row.translit_text')}">
    <button class="row-x" type="button"
            data-action="translit-remove" title="${t('title.row.translit.remove')}">${icon('x')}</button>
    ${cp.note}
  </div>`;
}

/* @fn renderTransliterationsEditor */
function renderTransliterationsEditor(containerId, transliterations) {
  return rowEditorHtml('translit', containerId, transliterations, {
    editorClass: 'transliterations-editor', rowsClass: 'translit-rows',
    addIcon: 'text-aa', addLabel: 'btn.row.translit.add' });
}

/* Read back transliterations from the editor DOM.
   Rows where both label and text are empty are dropped. */
// @fn readTransliterationsEditor
function readTransliterationsEditor(containerId) { return readRowEditor('translit', containerId); }

/* Render transliterations as labeled rows for render views.
   Returns '' if the list is empty. */
// @fn renderTransliterationsView
function renderTransliterationsView(transliterations) { return listViewHtml('translit', transliterations); }

/* ══════════════════════════════════════════════════════════════════════════════
   ALLOMORPHS EDITOR, {form, environment} rows for morpheme/affix entries (D23 P1)
   ─────────────────────────────────────────────────────────────────────────────
   Schema: allomorphs = [ { form, environment }.. ]
   Public API:
   renderAllomorphsEditor(containerId, allomorphs) → HTML string
   readAllomorphsEditor(containerId)               → [ { form, environment }.. ]
   renderAllomorphsView(allomorphs)                → read-only HTML
══════════════════════════════════════════════════════════════════════════════ */

// Build HTML for a single allomorph row. row may be {form, environment} or null.
// @fn _allomorphRowHtml
function _allomorphRowHtml(row) {
  const form = row?.form        || '';
  const env  = row?.environment || '';
  return `<div class="allomorph-row row-ed row-ed--inline">
    <input class="allomorph-form edit-input" type="text" ${LING_ATTRS} dir="auto" value="${esc(form)}" placeholder="${t('placeholder.row.allomorph_form')}">
    <input class="allomorph-env edit-input" type="text" ${LING_ATTRS} dir="ltr" value="${esc(env)}" placeholder="${t('placeholder.row.allomorph_env')}">
    <button class="row-x" type="button"
            data-action="allomorph-remove" title="${t('title.row.allomorph.remove')}">${icon('x')}</button>
  </div>`;
}

// @fn renderAllomorphsEditor
function renderAllomorphsEditor(containerId, allomorphs) {
  return rowEditorHtml('allomorph', containerId, allomorphs, {
    editorClass: 'allomorphs-editor', rowsClass: 'allomorph-rows',
    addIcon: 'plus-circle', addLabel: 'btn.row.allomorph.add' });
}

// Read allomorphs back from editor DOM. Rows with no form are dropped.
// @fn readAllomorphsEditor
function readAllomorphsEditor(containerId) { return readRowEditor('allomorph', containerId); }

// Render allomorphs as a labeled table for read-only dict views.
// @fn renderAllomorphsView
function renderAllomorphsView(allomorphs) { return listViewHtml('allomorph', allomorphs); }

/* ══════════════════════════════════════════════════════════════════════════════
   SELECTION EDITOR (D27 P1)
   ─────────────────────────────────────────────────────────────────────────────
   Records what an entry COMBINES WITH, not just verb arguments.  Adjectives
   select nouns, adverbs select verbs or clauses, nouns take clausal complements
   (`rumour that he left`), adpositions select nominals.

   Schema: entry.selection = [ Frame.. ]
     Frame  = { label?, notes?, selects: [ Select.. ] }
     Select = { category, relation, status }

   Each FRAME is one alternative, and the nesting is load-bearing: `give` is one
   frame with three selects, whereas `eat` (transitive or intransitive) is two
   frames.  A flat list could not tell "three arguments together" apart from
   "three competing analyses".

   No word order is recorded anywhere, linear position is a property of the
   utterance, not the lexical entry, and encoding it would be wrong for
   free-order languages.

   renderSelectionEditor(containerId, selection, pos) → HTML string
   readSelectionEditor(containerId)                   → [ Frame.. ]
   selDeriveLabel(frame)                              → "noun subject + clause complement"
══════════════════════════════════════════════════════════════════════════════ */

/* Human-readable summary of a frame, used wherever `label` is blank.
   Same relationship wordGloss() has to morphemes: an explicit value wins, the
   derivation fills the gap.  Requiring annotators to name every frame would
   produce drift (transitive / trans / TR) that makes the field useless for
   filtering anyway. */
// @fn selDeriveLabel
function selDeriveLabel(frame) {
  const parts = (frame?.selects || [])
    .filter(s => s && s.category)
    .map(s => {
      const cat = String(s.category).toLowerCase();
      return s.relation ? `${cat} ${s.relation}` : cat;
    });
  return parts.join(' + ');
}

/* Canonical string form of a frame list, used ONLY for change detection.
   stampFieldProv compares strings, and `selection` is structured, so both sides
   of the comparison must be serialised the same way.  Raw JSON.stringify would
   not do: frames loaded from JSONL carry whatever key order the file had, while
   readSelectionEditor builds its own, so an untouched entry would look edited
   and re-stamp provenance on every save.  Fixed key order fixes that. */
// @fn selCanonical
function selCanonical(frames) {
  if (!Array.isArray(frames) || !frames.length) return '';
  const kept = frames.map(f => ({
    label:   f?.label || '',
    notes:   f?.notes || '',
    selects: (f?.selects || []).filter(s => s && s.category).map(s => ({
      category: s.category || '',
      relation: s.relation || '',
      status:   s.status   || '',
    })),
  })).filter(f => f.selects.length);
  // Must collapse to '' rather than '[]' when everything filters out, or an
  // entry whose frames were all emptied would compare unequal to the no-frames
  // case and re-stamp provenance for a non-change.
  return kept.length ? JSON.stringify(kept) : '';
}

/* One selection, rendered as a phrase rather than a grid row: it reads
   "obligatory NOUN as subject", so it needs no column headers or hint text on a
   dict form that already carries thirteen fields.
   `status` stays a <select>, a genuine closed enum with nothing to complete.
   `category` / `relation` carry .ac-input + data-ac-pool, which is what the
   shared autocomplete keys off (see AC_MODES.term in LingCoT.html). */
// @fn _selRowHtml
function _selRowHtml(sel) {
  const cat    = sel?.category || '';
  const rel    = sel?.relation || '';
  const status = sel?.status   || '';
  const statusOpts = ['', ...SELECTION_STATUSES].map(v =>
    `<option value="${escAttr(v)}"${v === status ? ' selected' : ''}>${
      v ? esc(t('label.sel.status.' + v)) : esc(t('label.sel.status.unset'))
    }</option>`).join('');
  return `<div class="sel-row row-ed row-ed--inline">
    <select class="edit-input sel-status" aria-label="${escAttr(t('label.sel.status'))}">${statusOpts}</select>
    <input class="edit-input ac-input sel-cat" type="text" data-ac-pool="category"
           ${LING_ATTRS_UPPER} autocomplete="off"
           value="${escAttr(cat)}" placeholder="${escAttr(t('placeholder.sel.category'))}"
           aria-label="${escAttr(t('label.sel.category'))}">
    <span class="sel-as">${esc(t('label.sel.as'))}</span>
    <input class="edit-input ac-input sel-rel" type="text" data-ac-pool="relation"
           ${LING_ATTRS} autocomplete="off"
           value="${escAttr(rel)}" placeholder="${escAttr(t('placeholder.sel.relation'))}"
           aria-label="${escAttr(t('label.sel.relation'))}">
    <button class="row-x" type="button" data-action="sel-remove"
            title="${escAttr(t('title.sel.remove_selection'))}">${icon('x')}</button>
  </div>`;
}

/* One frame.  Collapsed frames show only their label (or derived summary) and a
   count, without this a three-frame verb is a very tall block.  Existing
   frames render collapsed on open; a newly added one renders expanded. */
// @fn _selFrameHtml
function _selFrameHtml(frame, collapsed) {
  const rows = (frame?.selects || []).map(s => _selRowHtml(s)).join('')
            || _selRowHtml(null);
  const label   = frame?.label || '';
  const notes   = frame?.notes || '';
  const derived = selDeriveLabel(frame);
  const count   = (frame?.selects || []).filter(s => s && s.category).length;
  return `<div class="sel-frame${collapsed ? ' collapsed' : ''}">
    <div class="sel-frame-head">
      <button class="sel-fold-btn" type="button" data-action="sel-frame-toggle"
              aria-label="${escAttr(t('title.sel.toggle_frame'))}">${icon('caret-right')}</button>
      <input ${LING_ATTRS} class="edit-input sel-label" type="text" value="${escAttr(label)}" placeholder="${escAttr(t('placeholder.sel.label'))}" aria-label="${escAttr(t('label.sel.frame_label'))}">
      <span class="sel-derived">${esc(derived)}</span>
      <span class="sel-summary">${esc(label || derived || t('label.sel.empty_frame'))}</span>
      <span class="sel-count">${esc(t('label.sel.count', { n: count }))}</span>
      <button class="row-x" type="button" data-action="sel-frame-remove"
              title="${escAttr(t('title.sel.remove_frame'))}">${icon('x')}</button>
    </div>
    <div class="sel-frame-body">
      <div class="sel-rows">${rows}</div>
      <button class="row-add" type="button" data-action="sel-add">${icon('plus-circle')} ${t('btn.sel.add_selection')}</button>
      <textarea ${LING_ATTRS} class="edit-textarea sel-notes" rows="2" placeholder="${escAttr(t('placeholder.sel.notes'))}" aria-label="${escAttr(t('label.sel.notes'))}">${esc(notes)}</textarea>
    </div>
  </div>`;
}

/* Template chips, FILTERED by the entry's PoS but never restricted to it, "show all" is always present, so trends are surfaced without removing
   anything.  Templates are theory-laden by nature, which is why they live in a
   user-editable resource file rather than in code. */
// @fn _selTemplatesHtml
function _selTemplatesHtml(pos) {
  if (!SELECTION_TEMPLATES.length) return '';
  const up = (pos || '').toUpperCase();
  const chip = (tpl, i, off) =>
    `<button class="chip sel-tpl${off ? ' sel-tpl-other' : ''}" type="button"
             data-action="sel-template" data-tpl-idx="${i}">${esc(selTplLabel(tpl))}</button>`;
  const mine  = [], others = [];
  SELECTION_TEMPLATES.forEach((tpl, i) => {
    ((tpl.pos || '').toUpperCase() === up && up ? mine : others).push(chip(tpl, i, !(up && (tpl.pos || '').toUpperCase() === up)));
  });
  // No PoS set, or none match: show everything rather than an empty row.
  const showAll = mine.length === 0;
  return `<div class="sel-templates${showAll ? ' sel-show-all' : ''}">
    ${up && mine.length ? `<span class="sel-tpl-pos">${esc(up.toLowerCase())}</span>` : ''}
    ${mine.join('')}${others.join('')}
    ${mine.length ? `<button class="chip sel-tpl-toggle" type="button" data-action="sel-tpl-all">${t('btn.sel.show_all')}</button>` : ''}
    <button class="chip" type="button" data-action="sel-frame-add">${t('btn.sel.blank')}</button>
  </div>`;
}

// @fn renderSelectionEditor
function renderSelectionEditor(containerId, selection, pos) {
  const frames = Array.isArray(selection) ? selection : [];
  // Existing frames are "completed", so they open collapsed.
  const framesHtml = frames.map(f => _selFrameHtml(f, true)).join('');
  // data-original holds the loaded value in canonical form so saveDictEntry can
  // diff a structured field with stampFieldProv, which only compares strings.
  const orig = selCanonical(frames);
  return `<div class="selection-editor" id="${esc(containerId)}" data-original="${escAttr(orig)}">
    ${_selTemplatesHtml(pos)}
    <div class="sel-frames" id="${esc(containerId)}-frames">${framesHtml}</div>
  </div>`;
}

/* Recompute a collapsed frame's summary line from the live DOM.  Called on
   collapse only, the summary is invisible while expanded, and the rows can
   only change while expanded. */
// @fn _selRefreshSummary
function _selRefreshSummary(frameEl) {
  if (!frameEl) return;
  const selects = [...frameEl.querySelectorAll('.sel-row')].map(r => ({
    category: r.querySelector('.sel-cat')?.value.trim() || '',
    relation: r.querySelector('.sel-rel')?.value.trim() || '',
  })).filter(s => s.category);
  const label   = frameEl.querySelector('.sel-label')?.value.trim() || '';
  const derived = selDeriveLabel({ selects });
  const summary = frameEl.querySelector('.sel-summary');
  const count   = frameEl.querySelector('.sel-count');
  if (summary) summary.textContent = label || derived || t('label.sel.empty_frame');
  if (count)   count.textContent   = t('label.sel.count', { n: selects.length });
  const derivedEl = frameEl.querySelector('.sel-derived');
  if (derivedEl) derivedEl.textContent = derived;
}

/* Keep the section header's frame count honest as frames are added/removed. */
// @fn _selRefreshCount
function _selRefreshCount() {
  const framesEl = document.getElementById('ed-selection-frames');
  const countEl  = document.querySelector('.sel-fold-count');
  if (framesEl && countEl) {
    countEl.textContent = t('label.sel.frames', { n: framesEl.querySelectorAll('.sel-frame').length });
  }
}

/* Read frames back from the DOM.  Deliberately sparse: a select with no
   category is dropped, a frame with no surviving selects is dropped, and empty
   label/notes keys are omitted rather than stored as "", an entry nobody
   annotates gains nothing. */
// @fn readSelectionEditor
function readSelectionEditor(containerId) {
  const root = document.getElementById(containerId + '-frames');
  if (!root) return [];
  const out = [];
  for (const fr of root.querySelectorAll('.sel-frame')) {
    const selects = [...fr.querySelectorAll('.sel-row')].map(r => {
      const s = {
        category: r.querySelector('.sel-cat')?.value.trim()    || '',
        relation: r.querySelector('.sel-rel')?.value.trim()    || '',
        status:   r.querySelector('.sel-status')?.value.trim() || '',
      };
      if (!s.relation) delete s.relation;
      if (!s.status)   delete s.status;
      return s;
    }).filter(s => s.category);
    if (!selects.length) continue;
    const frame = { selects };
    const label = fr.querySelector('.sel-label')?.value.trim() || '';
    const notes = fr.querySelector('.sel-notes')?.value.trim() || '';
    if (label) frame.label = label;
    if (notes) frame.notes = notes;
    out.push(frame);
  }
  return out;
}

/* Read-only render of an entry's selection frames for the dictionary view
   (D27 P2).  One table for the whole entry rather than one per frame, so
   alternations line up and can be compared at a glance, seeing that `believe`
   has two frames is most of the point of having frames at all.

   Layout decisions, each with a reason:
   · LABEL COLUMN, accented, spanning its frame's rows.  Omitted entirely when
     no frame carries an explicit label, a column that is empty on most rows
     isn't earning its width (the same reasoning that removed a Status column).
   · NO derived label here.  The rule is: derive when the rows are hidden, leave
     blank when they're visible.  Collapsed frames in the P1 editor show
     selDeriveLabel() because it stands in for hidden rows; here the rows sit
     immediately to the right, so the derivation would only restate them, and
     it's the one string long enough to wrap badly in a narrow column.
   · STATUS as a muted tag on `optional` only.  Obligatory stays silent, which
     keeps the common case quiet, and an UNANNOTATED status renders bare and so
     is visibly distinct from obligatory.  Parenthesising optionals, the usual
     linguistic convention, would have collapsed those two into one appearance.
   · NOTES as a row spanning the category and relation columns, inside the
     frame's block.  Spanning all three columns instead would read as a note on
     the whole section rather than on one frame.
   · NO headers.  "NOUN / subject" reads as itself; a Category | Relation header
     restates the cells, and repeating it per frame is noise. */
// @fn renderSelectionView
function renderSelectionView(selection) {
  const frames = (Array.isArray(selection) ? selection : [])
    .filter(f => f && (f.selects || []).some(s => s && s.category));
  if (!frames.length) return '';

  const anyLabel = frames.some(f => (f.label || '').trim());

  const rows = frames.map((frame, fi) => {
    const selects = (frame.selects || []).filter(s => s && s.category);
    const note    = (frame.notes || '').trim();
    // Label spans every row of this frame, including the notes row when present.
    const span    = selects.length + (note ? 1 : 0);
    const label   = (frame.label || '').trim();

    const selectRows = selects.map((s, si) => {
      const tag = s.status === 'optional'
        ? `<span class="dsel-tag">${esc(t('label.sel.status.optional'))}</span>`
        : '';
      // The divider rule marks frame boundaries; first row of each frame after
      // the first carries it.
      const cls = (si === 0 && fi > 0) ? ' class="dsel-boundary"' : '';
      const labelCell = (si === 0 && anyLabel)
        ? `<td class="dsel-label" rowspan="${span}">${esc(label)}</td>`
        : '';
      return `<tr${cls}>${labelCell}
        <td class="dsel-cat">${esc(s.category)}</td>
        <td class="dsel-rel">${esc(s.relation || '')}${tag}</td>
      </tr>`;
    }).join('');

    const noteRow = note
      ? `<tr><td class="dsel-note" colspan="2">${esc(note)}</td></tr>`
      : '';

    return selectRows + noteRow;
  }).join('');

  return `<table class="dsel-table${anyLabel ? '' : ' dsel-nolabel'}"><tbody>${rows}</tbody></table>`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   TRANSLATIONS EDITOR, shared reusable component (Step 6)
   ─────────────────────────────────────────────────────────────────────────────
   Schema: translations = [ { text, source_id, date }.. ]
   Each row: a text textarea, single-source <select>, and date field.
   Mirrors the comments editor layout but stores translations, not commentary.

   renderTranslationsEditor(containerId, translations) → HTML string
   readTranslationsEditor(containerId)                 → [ { text, source_id, date }.. ]
   renderTranslationsView(translations)                → read-only HTML
══════════════════════════════════════════════════════════════════════════════ */

/* Build HTML for a single translation row.
   t may be { text, source_id, date } or null for a blank new row.
   Source selection uses the single-select chip picker (data-single="true") so the
   user can pick from existing sources or create a new one inline. */
// @fn _translationRowHtml
function _translationRowHtml(row) {
  const text  = row?.text      || '';
  const srcId = row?.source_id || '';
  const date  = row?.date      || '';
  // Unique container ID for this row's single-select source picker
  const uid   = 'tr-src-' + (++_transRowCounter);
  const src   = srcId ? sourceById(srcId) : null;
  const srcLabel = src ? esc(src.name) : (srcId ? esc(srcId) : '');
  const hasSource = !!srcId;
  const cp    = _copyAttrs(row);
  return `<div class="translation-row row-ed row-ed--stacked"${cp.attrs}>
    <textarea ${LING_ATTRS} class="translation-text" dir="auto" placeholder="${t('placeholder.row.translation')}">${esc(text)}</textarea>
    <div class="translation-meta">
      <div class="trans-src-wrap" id="${uid}">
        <span class="chip chip-token trans-src-chip${hasSource ? '' : ' chip-empty'}"
              data-src-id="${esc(srcId)}"><span class="chip-label">${srcLabel || t('label.src.none')}</span></span>
        <button class="src-add-btn" type="button"
                data-action="open-src-pick"
                data-container="${uid}"
                data-single="true"
                title="${t('title.row.src.select')}">${icon('stack')} ${hasSource ? t('btn.row.trans.change_source') : t('btn.row.trans.add_source')}</button>
      </div>
      <input ${LING_ATTRS} class="translation-date" type="text" value="${esc(date)}" placeholder="${t('placeholder.row.date')}">
      <button class="row-x" type="button"
              data-action="translation-remove" title="${t('title.row.translation.remove')}">${icon('x')}</button>
    </div>
    ${cp.note}
  </div>`;
}

/* @fn renderTranslationsEditor */
function renderTranslationsEditor(containerId, translations) {
  return rowEditorHtml('translation', containerId, translations, {
    editorClass: 'translations-editor', rowsClass: 'translation-rows',
    addIcon: 'translate', addLabel: 'btn.row.trans.add' });
}

/* Read back translations from the editor DOM.
   Rows with no text are dropped. */
// @fn readTranslationsEditor
function readTranslationsEditor(containerId) { return readRowEditor('translation', containerId); }

/* Render translations as italicised rows for render views.
   Returns '' if the list is empty. */
// @fn renderTranslationsView
function renderTranslationsView(translations) { return listViewHtml('translation', translations); }

/* ══════════════════════════════════════════════════════════════════════════════
   ANNOTATORS ROLLUP. Step 7
   ─────────────────────────────────────────────────────────────────────────────
   The rollup is COMPUTED, never stored.  It walks prov_history on an object
   and an optional flat list of descendant objects, collects unique annotator
   IDs, and renders them as read-only chips.

   Callers flatten their own children via the _flatten* helpers below so the
   core function stays generic and testable.
══════════════════════════════════════════════════════════════════════════════ */

/* Collect unique annotator IDs from prov_history of obj + each descendant. */
// @fn collectAnnotatorIds
/* C13: cache the rollup per object, keyed by the global mutation generation, so the
   render path stops re-flattening + re-scanning the whole subtree ~10×/render. The
   descendants argument may be a thunk (`() => [..]`) so the (expensive) flatten only
   runs on a cache miss. Returned arrays are treated read-only by callers. */
const _annIdsCache = new WeakMap();   // rollup object → { gen, ids }
function collectAnnotatorIds(obj, descendants = []) {
  if (obj) {
    const cached = _annIdsCache.get(obj);
    if (cached && cached.gen === _dataGen) return cached.ids;
  }
  const ids  = new Set();
  /* D50 stage 4a: through the resolver, so an interned history still rolls up.
     Read it directly and an interned corpus would report zero annotators on
     every object — a silent, total loss of the attribution display. */
  const scan = o => { for (const p of provHistory(o)) if (p.annotator_id) ids.add(p.annotator_id); };
  scan(obj);
  const list = typeof descendants === 'function' ? descendants() : (descendants || []);
  for (const d of list) scan(d);
  const arr = [...ids];
  if (obj) _annIdsCache.set(obj, { gen: _dataGen, ids: arr });
  return arr;
}

/* Flatten all sentence objects inside a paragraph. */
// @fn _flattenParagraph
function _flattenParagraph(para) {
  return para.sentences || [];
}

/* Flatten all paragraphs + sentences inside a section. */
// @fn _flattenSection
function _flattenSection(sec) {
  const result = [];
  for (const para of (sec.paragraphs || [])) {
    result.push(para);
    result.push(..._flattenParagraph(para));
  }
  return result;
}

/* Flatten all sections + their paragraphs + sentences inside a document. */
// @fn _flattenDocument
function _flattenDocument(d) {
  const result = [];
  for (const sec of (d.sections || [])) {
    result.push(sec);
    result.push(..._flattenSection(sec));
  }
  return result;
}

/* Render annotator IDs as a read-only chip row.
   Pass the pre-collected ID array from collectAnnotatorIds().
   Returns a '-' placeholder when no annotators are found. */
// @fn renderAnnotatorsRollup
// editMode true  → chips fire "preview-annotator" (floating info panel; used in edit views)
// editMode false → chips fire "go-annotator"      (navigate to Annotators view; used in read views)
function renderAnnotatorsRollup(ids, editMode = false) {
  if (!ids || !ids.length) {
    return '<span style="color:var(--text-muted);font-size:0.82rem">—</span>';
  }
  const chips = ids.map(id => {
    const ann  = S.annotatorsById.get(id) || null;
    const name = ann ? esc(displayName(ann)) : esc(id);
    let linkAttrs = '';
    if (ann) {
      linkAttrs = editMode
        ? ` data-action="preview-annotator" data-ann-id="${escAttr(id)}" title="${t('title.annotator.view_details')}"`
        : ` data-action="go-annotator"      data-ann-id="${escAttr(id)}" title="${t('title.annotator.go')}"`;
    }
    return `<span class="ann-rollup-chip"${linkAttrs}>${name}</span>`;
  }).join('');
  return `<div class="ann-rollup-wrap">${chips}</div>`;
}

