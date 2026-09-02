/* =============================================================================
   _schema.js — what fields each kind of stored object may carry
   =============================================================================
   B-037. This was hand-typed in schema_conformance_test.js, mirroring the prose
   SCHEMA block in LingCoT.html, and cli_schema_test.js then obtained a THIRD
   copy by regex-scraping the second one and eval-ing it. Two of those copies
   drifted before anyone noticed:

     B-036  `head` and `dep_rel` documented for 45 versions, rejected here
     B-040  the four D23 sense fields, the same omission one list down
     and the `dict` list named `allomorphs` twice, which changes no result and
     is therefore exactly what unattended rot looks like

   One derivation, in one file, from `FIELD_SPEC` — which D48 calls the schema of
   record and which the value half of the conformance guard already consulted.
   The prose block in LingCoT.html stays as documentation for people; no code
   reads it, so it can no longer disagree with code.
   ============================================================================= */
const F = require('../../source/modules/field_spec.js');

/* Which table row describes each walked kind. `doc` is absent on purpose: it is
   the corpus file's root wrapper and has no row, because the table's `document`
   row describes doc.metadata — which is what `meta` is. */
const KIND_LEVEL = { meta: 'document', section: 'section', para: 'paragraph',
                     sent: 'sentence', word: 'word', morph: 'morpheme',
                     dict: 'dict_entry', lemma: 'lemma', prov_events: 'prov_events' };

/* The document hierarchy. NOT a second copy of the schema: FIELD_SPEC does not
   encode it — CONTAINER_KEYS says which keys are containers, not which level
   owns which — and it is the same tree the guards' walks descend. */
const NESTS = { doc: ['metadata', 'sections'], meta: [], section: ['paragraphs'],
                para: ['sentences'], sent: ['words'], word: ['morphemes'],
                morph: [], dict: [], lemma: [], prov_events: [] };

/* `stored: false` marks a surface holding no key of its own — an ingest panel,
   the dependency editor — so it must never become a permitted field. */
const ALLOW = Object.fromEntries(Object.keys(NESTS).map(kind => {
  const level = KIND_LEVEL[kind];
  const declared = level ? F.fieldsOf(level).filter(f => f.stored !== false).map(f => f.key) : [];
  return [kind, [...new Set([...declared, ...F.UNIVERSAL_KEYS, ...NESTS[kind]])]];
}));

/* @fn kindOf, which allow-list a row from a dictionary or corpus file belongs
   to. B-119: one discriminator, `record_type`, with the two spellings that
   preceded it still recognised because files on disk carry them until they are
   next saved. A row with no discriminator is a dictionary entry — which is safe
   only because each file holds one kind of thing, and is the reason the
   v3.14.233 decision to keep the files separate matters here. */
function kindOf(row, fallback) {
  const rt = row && (row.record_type || row.record || (row.type === 'lemma' ? 'lemma' : ''));
  if (rt === 'prov_events') return 'prov_events';
  if (rt === 'lemma') return 'lemma';
  return fallback;
}

module.exports = { ALLOW, KIND_LEVEL, NESTS, kindOf, FIELD_SPEC: F };
