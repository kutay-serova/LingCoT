/* =============================================================================
   field_spec.js — D48 stage A: what exists at each level, in what order, and
   how much it matters.
   =============================================================================
   B-091, B-092, B-093, B-094, B-099 and B-082 were one question asked in six
   places: what is a field, and how much does it matter. This is the one answer.

   WHAT THIS OWNS
     the field list for every level, the ORDER a view should ask for them in,
     one of six tiers per field, and — for a level the form renderer draws — the
     control and the locale keys for its label and placeholder.

   WHAT IT DOES NOT OWN
     how anything looks. Bespoke surfaces stay bespoke and say so with
     `surface:` — the morpheme rows, the dependency table, the transliteration
     multi-row editors. Declaring them here is how the missing-annotation
     counter knows a field exists without the renderer claiming to draw it. A
     table that generated those would be a framework, and worse than what is
     there.

   WHERE A FIELD IS, AND WHO WRITES IT (v3.14.262)
     A field can be drawn, read, validated and provenance-stamped and still
     never stored, because until now the ASSIGNMENT was the one half of the
     operation each save handler spelled out by hand. B-117 and B-118 are both
     that. Four keys close it:

       domId    the element id a hand-written surface gives this control. The
                two identity modals and the word editor; generated levels derive
                theirs from fieldId().
       domSel   the same binding as a selector, for controls that repeat per row
                (the morpheme rows). selectorFor() hides which kind it is.
       store    the bag the value lives in, when it is not the record itself.
                Only 'metadata', at document level, and applyForm() reads it.
       manual   applyForm() must not assign this one; the save handler owns it
                because the control's value is not the field's value.
                sentence.words is the only case.

     With those declared, read (readForm/readWordForm), assign (applyForm) and
     stamp (formProvMap) all come off this one list, and a field added here is
     saved without anyone editing a handler.

   THE TIERS
     identity  the object cannot be found again without it. Blocks the save,
               and is the ONLY thing that does. Not "important" — findable.
     core      the work. Empty means unfinished: counted, marked, and used to
               decide whether a token still needs a visit.
     aux       real annotation, offered, never counted as missing. Empty here
               is not evidence of anything.
     extra     specialist, or lives on another surface. Declared so it is not
               forgotten; never prompted for.
     derived   the app writes it; there is no control and there should not be.
               Listed so the next person does not "fix" its absence.
     (There was a sixth, `legacy`: present on records written before a model
      change, drawn by nothing and awaiting a decision to drop it. Added
      v3.14.196 because the fixture forced it — the guard walked real data and
      found seven keys the table did not admit existed. The decision came at
      D58 §3 and it was to drop them, so the tier went with its members at
      v3.14.386. It is described here because a tier that once existed is worth
      one paragraph to the next person who finds `tier: 'legacy'` in an
      archived file.)

   WHY ONLY IDENTITY BLOCKS
     Refusing a save does not produce a value, it produces a placeholder — and
     a placeholder is worse than an empty field HERE SPECIFICALLY, because
     hasAnnotation() and the auto-advance read emptiness as "not done". Junk
     typed to clear a dialog looks like annotation and breaks the one mechanism
     that reports what is left.

     Above that rule: prevent by construction where you can. tokenizeWords()
     filters empty strings, so a word cannot exist without a form and no check
     is needed for one.

   FIXED, BUT THROUGH ONE DOOR
     These tiers are LingCoT's answer, not a project's. A transcription corpus
     should not be told it is 0% glossed, and one day the corpus will say what
     kind of project it is. Every consumer asks tierOf(level, key) rather than
     carrying its own list, so that day is a change to one function instead of
     twenty views. D34 is the consumer that will force it.

   ASSUMED USE, because a tier is meaningless without one: text + translation,
   and text + gloss + dictionary. Transliteration therefore sits at `aux`, and
   is the first field a non-Latin-script project would promote.
   ============================================================================= */

/* D58 §3, v3.14.386: the `legacy` tier is gone, with the fourteen members it
   declared and the readers that fed them. PRACTICES §5 — a declaration is only
   as good as what it admits exists, and a tier with no instances anywhere is
   the table asserting that something is out there. Asked producer by producer,
   nothing had written any of them since v3.14.151 at the latest, and the last
   file carrying any was `samples/turkish-test`, retired at v3.14.384. */
const FIELD_TIERS = ['identity', 'core', 'aux', 'extra', 'derived'];

/* Order within a level is the order a view should ask for it. */
const FIELD_SPEC = {
  document: [
    /* Every fillable field at this level lives in `metadata`, not on the record
       itself. Declared rather than known by the save handler: applyForm() is
       the only writer, and it has to be told where the bag is. */
    { key: 'title', tier: 'identity', control: 'text', store: 'metadata',
      emptyMsg: 'alert.validation.title_required',
      label: 'label.editor.title', placeholder: 'placeholder.editor.corpus_title' },
    // B-097: an unbound fold context keyed a whole session wrong. This field
    // decides it, which is why it is core rather than aux.
    { key: 'language', tier: 'core', control: 'language', store: 'metadata',
      label: 'label.editor.language', placeholder: 'placeholder.editor.language' },
    /* B-072, created v3.14.217. The metalanguage the translations are written
       IN, which is not English: a Hawaiian project documents into Hawaiian.
       `core` for the same reason `language` is — the translation field is half
       of the first named use of this tool, and a corpus that does not say what
       language its translations are in cannot be read by anyone else. */
    { key: 'translation_language', tier: 'core', control: 'language', store: 'metadata',
      label: 'label.editor.translation_language',
      placeholder: 'placeholder.editor.translation_language' },
    { key: 'source_ids', tier: 'aux', control: 'sources', store: 'metadata',
      label: 'label.editor.sources', hint: 'hint.editor.doc_sources' },
    { key: 'comments', tier: 'aux', control: 'comments', store: 'metadata',
      label: 'label.editor.comments' },
    /* B-094: written by corpus_ingest.py from its flags and displayed nowhere,
       so a corpus ingested with --author carried a value nobody could see or
       correct. They render behind a disclosure: extra means never prompted, not
       never shown. */
    { key: 'authors', tier: 'extra', control: 'text', store: 'metadata',
      label: 'label.editor.authors' },
    { key: 'content_sources', tier: 'extra', control: 'text', store: 'metadata',
      label: 'label.editor.content_sources' },
    { key: 'content_date', tier: 'extra', control: 'text', store: 'metadata',
      label: 'label.editor.content_date' },
    { key: 'publisher', tier: 'extra', control: 'text', store: 'metadata',
      label: 'label.editor.publisher' },
    { key: 'notes', tier: 'extra', control: 'textarea', store: 'metadata',
      label: 'label.editor.notes' },
    /* Written by corpus_ingest.py and never by the app, and the SCHEMA block
       documents it beside the five bibliographic fields above. Declared at
       v3.14.237: deriving the conformance allow-lists from this table (B-037)
       showed the ingester producing a field the table did not admit, which is
       the same shape as the defect that guard was built for. `derived` because
       nothing prompts for it — it is the ingest date. */
    /* D34 stage E, v3.14.319: `{on: [...], off: [...]}` — the annotator's changes
       to the tracked set, stored on the DOCUMENT because "does this project
       transliterate" is a fact about the project and has to survive moving the
       corpus to another machine. `derived` because no form draws it: the panel
       writes it through `setTracked`, which is the only writer.

       Declared here rather than left implicit, because an undeclared key on disk
       is what `schema_conformance_test` refuses — and rightly: the first save
       after this shipped would have written a key the schema did not admit. */
    { key: 'tracked',              tier: 'derived' },
    { key: 'corpus_created',       tier: 'derived' },
    { key: 'dict_key_version',     tier: 'derived' },
    { key: 'metadata_prov',        tier: 'derived' },
    { key: 'field_prov',           tier: 'derived' },
  ],

  section: [
    { key: 'title', tier: 'identity', control: 'text', emptyMsg: 'alert.validation.title_required',
      label: 'label.editor.section_title', placeholder: 'placeholder.editor.section_title' },
    /* B-091. A section has two fields of its own; where the text came from is
       half the object, and a source recorded later is stamped by whoever came
       back rather than by whoever read it.

       `aux`, not `core`, since v3.14.318 — and the reason is that the tiers
       disagreed with each other. `source_ids` was `core` here and `aux` on the
       document, so the same question ("where did this text come from") was
       counted at one level and not the other. Measured, that made D34 nag about
       sources on 6 sections across the two live corpora while **both documents
       already recorded one**. One concept, one tier: aux everywhere, and a
       project that wants it counted turns it on. */
    { key: 'source_ids', tier: 'aux', control: 'sources',
      label: 'label.editor.sources' },
    /* Not a field — a section has two — but it holds a place in the order, so
       the table declares it with a surface and the renderer never draws it. */
    { key: 'ingest', tier: 'core', surface: 'ingest', stored: false },
  ],

  /* A container with no identity field of its own: its text is its sentences. */
  paragraph: [
    /* Not a field: the text a paragraph is created from, and on edit its
       sentence breaks. Declared with a surface so it keeps its place in the
       order and the form renderer does not claim to draw it. */
    { key: 'ingest', tier: 'core', surface: 'ingest', stored: false },
    { key: 'translations', tier: 'core', control: 'translations',
      label: 'label.editor.translations' },
    { key: 'transliterations', tier: 'aux', control: 'translits',
      label: 'label.editor.transliterations' },
    { key: 'comments', tier: 'aux', control: 'comments',
      label: 'label.editor.comments' },
  ],

  sentence: [
    { key: 'text', tier: 'identity', control: 'textarea', emptyMsg: 'alert.validation.sentence_text_required',
      label: 'label.editor.sentence_text', placeholder: 'placeholder.editor.sentence_text' },
    /* Second, not fourth. Segmentation is a decision made once and everything
       below depends on it — the same argument that puts the parse first at word
       level. Both orders are claims; D46 tests them. */
    /* `manual` because the control's value is a line of text and the field is an
       array of word objects carrying annotation. applyForm() must not assign it;
       the save handler aligns old words against the new forms (B-057). */
    { key: 'words', tier: 'core', control: 'tokenize', manual: true,
      label: 'label.editor.word_tokenization', placeholder: 'placeholder.editor.word_forms',
      hint: 'hint.sent.word_boundaries' },
    { key: 'translations', tier: 'core', control: 'translations',
      label: 'label.editor.translations' },
    { key: 'transliterations', tier: 'aux', control: 'translits',
      label: 'label.editor.transliterations' },
    { key: 'comments', tier: 'aux', control: 'comments',   // B-092
      label: 'label.editor.comments' },
    /* The dependency editor: edit-only, and bespoke. `head` and `dep_rel` on the
       WORD are the fields it writes; this is the surface that draws them.

       `aux`, not `extra`, and the difference is visible: extra renders inside
       the level's disclosure, and this editor already collapses itself. Putting
       it there filed the dependency parse under the document's bibliographic
       details, which is where the reporter found it at v3.14.198. */
    /* `filledWhen` (v3.14.318): a row the counter can report even though there is
       no field to read. The dependency parse IS stored — as `head` and `dep_rel`
       on each word — but at the level a person thinks about it, which is the
       sentence. Counting the word fields instead gives "130 words need a head",
       which is not how anyone asks the question.

       The predicate is named rather than written here: `depHasParse` already
       decides this for the editor's own fold and is guarded by
       `dep_parse_test.js`, including the case that makes it subtle — a root
       stores `head === null`, so `'head' in w` is the test and a truthiness
       check would miss every root. A second answer to "does this sentence have
       a parse" is the defect this project has now removed four times. */
    { key: 'deps',             tier: 'aux',     surface: 'deps', stored: false,
      filledWhen: 'hasDepParse', label: 'label.editor.dep_parse' },
    { key: 'sentence_index',   tier: 'derived' },
  ],

  /* THE ORDER HERE IS A CLAIM, not an observation: parse first because
     everything below derives from it, then the morphemes, then the word-level
     values the morphemes feed. D46 tests it against real annotation, and
     changing it is an edit to this array. */
  /* The word editor is hand-written and stays that way: autocomplete, the
     lemma offer strip and the morpheme rows are not what a generated form is
     for. What it does NOT get to keep is a private list of element names, so
     every field declares the id its control carries and `surface_conformance_test`
     holds the markup to it. Same contract as the two identity modals. */
  word: [
    { key: 'form',                tier: 'identity', control: 'readonly', domId: 'ew-form' },
    /* `vacuousWhen` (D34 stage B, v3.14.307): the record has nothing for this
       field to hold, which is not the same as the field being unfilled. A
       monomorphemic word has no parse — `joinParse` returns null for one
       morpheme — and 301 of them across the two live corpora is the number D34
       was written to stop the counter reporting. The NAME is stored rather than
       the predicate, the same as `tags:`, because this module is also required
       by Node and the predicate reads app state. */
    { key: 'morphological_parse', tier: 'core',     control: 'text',     domId: 'ew-parse',
      vacuousWhen: 'monomorphemic', label: 'label.editor.morph_parse' },
    { key: 'morphemes',           tier: 'core',     surface: 'morph-rows' },
    { key: 'part_of_speech',      tier: 'core',     control: 'tag', tags: 'POS_CHOICES',  fold: 'upper', domId: 'ew-pos',
      label: 'label.editor.part_of_speech' },
    { key: 'gloss',               tier: 'core',     control: 'text',     domId: 'ew-gloss',
      filledWhen: 'hasWordGloss', label: 'label.editor.gloss' },   // B-218
    /* `manual` for the same reason sentence.words is: the control hands back a
       typed citation form and the field holds a lemma id. Resolving one to the
       other creates records, which is a save handler's job, not a writer's. */
    { key: 'lemma_id',            tier: 'aux',      control: 'lemma', manual: true, domId: 'ew-lemma' },
    // Promoted to core by a non-Latin-script project; the first real case for
    // a per-project tier rather than a hypothetical one.
    /* B-045 ✅ v3.14.303: `ew-translit` is the multi-label editor's container now,
       not a single text box, so the declared control and the drawn one agree and
       `surface_conformance_test.js` no longer needs its exemption. */
    /* `counted: true` + `appliesWhen` (D34 stage B, v3.14.307) — this pair is
       UNIFIED conflict ⑧ resolved in the table. The tier is global and right:
       an assumed use of text + gloss + dictionary does not want a
       transliteration. Whether THIS project wants one is a different question
       with a different answer, and `appliesWhen` is where it is asked — "the
       object language is not written in the metalanguage's script", measured
       from the corpus rather than set per project and forgotten.

       Only the word level carries the pair. Sentence, paragraph and morpheme
       transliterations are empty in both corpora and nothing has measured
       whether a project wants them there; morpheme transliteration only became
       fillable at v3.14.303. Turning on three unmeasured levels at once is the
       expansion this project keeps having to undo. */
    { key: 'transliterations',    tier: 'aux',      control: 'translits', domId: 'ew-translit',
      counted: true, appliesWhen: 'scriptDiffers', label: 'label.editor.transliterations' },
    /* D48 stage D found this missing: hasAnnotation has always read comments at
       this level, and the table did not know the field existed. Same shape as
       stage A's discovery of the residue keys — a consumer built on a table
       that omits a field on disk is blind to it. */
    { key: 'comments',            tier: 'aux',      control: 'comments',  domId: 'ew-comments' },
    { key: 'head',                tier: 'extra',    surface: 'deps' },
    { key: 'dep_rel',             tier: 'extra',    surface: 'deps' },
    { key: 'dict_id',             tier: 'derived' },   // D35 A3 writes it
    { key: 'word_index',          tier: 'derived' },
  ],

  /* Morpheme controls repeat once per row, so there is no unique id to declare.
     `domSel` is the same contract expressed as a selector, scoped to a row. */
  morpheme: [
    { key: 'form',             tier: 'identity', control: 'readonly', domSel: '.morph-edit-form-label' },
    { key: 'gloss',            tier: 'core',     control: 'text',     domSel: '.morph-gloss-input',
      label: 'label.editor.gloss' },
    { key: 'part_of_speech',   tier: 'core',     control: 'tag', tags: 'POS_CHOICES',  fold: 'upper', domSel: '.morph-pos-input',
      label: 'label.editor.part_of_speech' },
    /* Never DEFAULTED (B-069: whether a stem is free or bound is a fact about
       the language, not a position in a string) but always ASKED. Unset is
       unfinished, not undecidable. */
    { key: 'type',             tier: 'core',     control: 'tag', tags: 'TYPE_CHOICES', fold: 'lower', domSel: '.morph-type-input',
      label: 'label.editor.type' },
    /* B-093 ✅ v3.14.303. It waited for D32 because a single box here would have
       recreated the shape B-045 objects to one level up; D32 decided the model,
       so the row carries the same multi-label editor every other level does. */
    { key: 'transliterations', tier: 'aux',      control: 'translits',
      domSel: '.morph-translits .transliterations-editor' },
    { key: 'comments',         tier: 'aux',      control: 'comments', domSel: '.morph-comments .comments-editor' },   // D48 stage D
    { key: 'dict_id',          tier: 'derived' },
  ],

  dict_entry: [
    { key: 'form', tier: 'identity', control: 'text', emptyMsg: 'alert.validation.form_required',
      label: 'label.editor.form', placeholder: 'placeholder.editor.da_form' },
    { key: 'type', tier: 'core', control: 'tag', tags: 'TYPE_CHOICES', fold: 'lower',
      label: 'label.editor.type', placeholder: 'placeholder.editor.type_pick' },
    { key: 'part_of_speech', tier: 'core', control: 'tag', tags: 'POS_CHOICES', fold: 'upper',
      label: 'label.editor.part_of_speech', placeholder: 'placeholder.editor.pos_long' },
    /* D53 stage B: the same gloss pool the hand-written word and morpheme rows
       use. Declared here rather than in the renderer, because `pool` is what the
       generated control reads and a second spelling would be D48's whole point
       undone. */
    { key: 'gloss', tier: 'core', control: 'text', cls: 'gloss-input', pool: 'gloss',
      label: 'label.editor.gloss', placeholder: 'placeholder.editor.gloss_morph' },
    { key: 'meaning', tier: 'aux', control: 'textarea',
      label: 'label.editor.definition' },
    { key: 'transliterations', tier: 'aux', control: 'translits',
      label: 'label.editor.transliterations', hint: 'hint.es.transliteration' },
    /* The lemma is one CONTROL, not a per-view block. It renders an input, the
       candidate strip and the quick-create panel from one generated id. It was
       three hand-written clusters, and two of them had already drifted:
       dict-add's strip was an empty div while dict-edit's was populated. Making
       it a control also gives D35 B5 one place to hang "the N entries in this
       group" rather than three. word-edit's cluster stays hand-written until
       that view is converted, if it ever is. */
    // `manual`, same as word.lemma_id: a citation form in, an id stored.
    { key: 'lemma_id', tier: 'aux', control: 'lemma', manual: true,
      label: 'label.editor.lemma', placeholder: 'placeholder.editor.lemma_form_long',
      hint: 'hint.es.lemma_link_morph' },
    { key: 'constituent_forms', tier: 'aux', control: 'list',
      label: 'label.editor.constituent_morphemes',
      placeholder: 'placeholder.editor.constituent_forms', hint: 'hint.es.morphemes_csv' },
    { key: 'comments', tier: 'aux', control: 'comments',
      label: 'label.editor.comments' },
    /* I6 is about this screen's density. Six fields are extra, which is what
       makes it splittable rather than merely long — they fold into the
       disclosure in BOTH modes now. The three bespoke ones are edit-only and
       say so by being surfaces the add view does not supply, which turns their
       absence from an accident into a declaration. */
    /* D58 §3, v3.14.386: `legacyKey` is gone, and this was its only user.
       B-044 renamed alternate_forms → variants at v3.14.138 and kept reading the
       old key, correctly — a rename without a read fallback silently empties
       every dictionary written before it. Nine versions of fixture later there
       is no such dictionary: 19 occurrences, all in `samples/turkish-test`, all
       retired at v3.14.384. The mechanism went with the last key that used it,
       so `renderField` has one way to find a value again. */
    { key: 'variants', tier: 'extra', control: 'list',
      label: 'label.editor.variants', placeholder: 'placeholder.editor.variants',
      hint: 'hint.es.variants' },
    { key: 'semantic_domain', tier: 'extra', control: 'text', pool: 'domain',
      label: 'label.editor.semantic_domain',
      placeholder: 'placeholder.editor.semantic_domain', hint: 'hint.es.semantic_domain' },
    { key: 'usage_notes', tier: 'extra', control: 'textarea',
      label: 'label.editor.usage_notes', placeholder: 'placeholder.editor.usage_notes',
      hint: 'hint.es.usage_notes' },
    { key: 'allomorphs',      tier: 'extra', surface: 'allomorphs' },
    { key: 'selection',       tier: 'extra', surface: 'selection' },
    { key: 'pinned_examples', tier: 'extra', surface: 'examples' },
    { key: 'homograph',       tier: 'derived' },   // D35 A1
    /* B-044: `variants` replaced it. Still READ at the one site that draws
       them, and now also migrated on load by `_migrateDictLegacy` (v3.14.249),
       so it no longer survives a load-then-save the way it did in `samples/`. */
    /* `meaning` replaced it. This comment used to say "read on load, never
       written", which was FALSE — nothing read it anywhere, so dropping the key
       would have silently emptied a pre-rename dictionary. `_migrateDictLegacy`
       copies it into `meaning` on load (v3.14.249). Found by grepping for the
       reader the comment promised. */
  ],

  /* D35 A2: a lemma names a group. It has no gloss, no part of speech and no
     analysis of its own, and nothing points at it as one. */
  lemma: [
    { key: 'form', tier: 'identity', control: 'text' , emptyMsg: 'alert.validation.lemma_form_required' },
    /* Everything below is residue. Until D35 A2 a lemma WAS a dictionary entry,
       and the migration keeps every field it carried rather than throwing away
       what a project typed. Nothing draws these, nothing counts them, and D35
       B5 decides whether they survive the group view. They are declared because
       they are on disk, and a table that pretended otherwise would make every
       consumer blind to them — which is the failure this tier exists to name. */
    /* B-119: the discriminator this record carried from v3.14.184 to
       v3.14.237. `record_type` replaced it and comes from UNIVERSAL_KEYS;
       this stays declared because files on disk still carry it until they are
       next saved, and a table that pretended otherwise would make the
       conformance guard reject data the app itself reads. */
    /* B-200. NOT residue — `homograph` is minted on a lemma today. `_indexLemma`
       numbers a citation-form bucket exactly as `_indexDictEntry` numbers a form
       bucket (B-114, D35 A1), and `dict_entry` has declared it `derived` since
       then. This level was never told, so every consumer of the table was blind
       to a field the app writes: `field_spec_test` reported it undeclared and
       `schema_conformance_test` called two live records drift.

       Invisible until a corpus had a numbered lemma pair, which is why it
       surfaced in the gate-1 rehearsal rather than in the suite — `samples/` has
       none, and D58 names that absence as a measured gap. The fixture doing its
       job before the swap is the whole argument for rehearsing. */
    { key: 'homograph',        tier: 'derived' },   // B-114 numbers lemmas too
    /* 4d: no longer minted on new lemmas, and dropped on load when empty.
       Declared because files on disk still carry it, and because a non-empty
       one is KEPT — this migration does not decide that a project's typing was
       a mistake. */
  ],

  /* The two identity modals are NOT generated: their markup is static in the
     body, translated by a data-i18n sweep and filled imperatively on open. They
     are also the only surfaces that never drifted, because one modal has always
     served both create and edit (audit section 14).

     So the table does not draw them, it SPECIFIES them, and
     `modal_conformance_test.js` holds the markup to it. `domId` ties the two
     together, because the shipped element ids predate the table and do not
     match the field keys: `am-birth` for `birth_decade`.

     The ORDER below is the SHIPPED order, not the one D48 first drafted. The
     markup is the reviewed reality and the draft order for these two levels was
     arbitrary. Where a tier disagrees with position — `publication_restrictions`
     is core but sits late in the source modal — the tier is what counts, since
     the tier is what the counter and the marking read. */
  /* B-119: the provenance event table, written as the FIRST line of a corpus or
     dictionary file since interning at v3.14.226 and declared nowhere until now.
     Not an annotation level — nothing draws it and nothing prompts for it — but
     it IS a stored record, and the conformance guard walks stored records. Its
     discriminator, `record_type`, comes from UNIVERSAL_KEYS like every other
     kind's. */
  prov_events: [
    { key: 'events', tier: 'derived' },
  ],

  annotator: [
    { key: 'name',         tier: 'identity', control: 'text',     domId: 'am-name' , emptyMsg: 'alert.validation.name_required' },
    { key: 'researcher',   tier: 'aux',      control: 'checkbox', domId: 'am-researcher' },
    { key: 'affiliation',  tier: 'aux',      control: 'text',     domId: 'am-affiliation' },
    { key: 'role',         tier: 'aux',      control: 'text',     domId: 'am-role' },
    { key: 'birth_decade', tier: 'extra',    control: 'text',     domId: 'am-birth' },
    { key: 'contact_info', tier: 'extra',    control: 'text',     domId: 'am-contact' },
    { key: 'other',        tier: 'extra',    control: 'textarea', domId: 'am-other' },
  ],

  source: [
    { key: 'name', tier: 'identity', control: 'text',   domId: 'sm-name' , emptyMsg: 'alert.validation.name_required' },
    { key: 'type', tier: 'core',     control: 'select', domId: 'sm-type' },
    /* Human-only. The modal shows or hides these as a group from the type
       dropdown (_srcModalUpdateFields). That condition stays there: nothing in
       the table consumes it yet, and declaring a rule no reader honours is
       worse than not declaring it. */
    { key: 'researcher',          tier: 'extra', control: 'checkbox', domId: 'sm-researcher' },
    { key: 'birth_decade',        tier: 'extra', control: 'text',     domId: 'sm-birth' },
    { key: 'gender',              tier: 'extra', control: 'text',     domId: 'sm-gender' },
    { key: 'language_background', tier: 'extra', control: 'textarea', domId: 'sm-langbg' },
    // Non-human only, the other half of the same condition.
    { key: 'citation_information', tier: 'aux', control: 'textarea', domId: 'sm-citation' },
    /* Decides whether a text may ship in samples/. Core, and late in the modal. */
    { key: 'publication_restrictions', tier: 'core', control: 'select', domId: 'sm-restrict' },
    { key: 'other_information', tier: 'aux', control: 'textarea', domId: 'sm-other' },
  ],

};

/* Keys every stored object carries. Not fields: no view renders them, no
   counter counts them, and listing them per level would be nine copies of the
   same line. */
/* The disclosure a level's `extra` fields sit behind. One label cannot serve
   every level: the document's extras are bibliographic, the dictionary entry's
   are analytical. Absent here means the generic label. */
const LEVEL_EXTRA_LABEL = {
  document:   'label.editor.bibliographic',
  dict_entry: 'label.editor.more_fields',
};

const UNIVERSAL_KEYS = ['id', 'prov', 'prov_history', 'field_prov', 'record_type', 'deleted'];

/* Container keys, the nesting itself. `words` is deliberately NOT here: the
   tokenization is a decision the annotator makes and can override, so it is a
   field of the sentence. `sections`/`paragraphs`/`sentences` are not. */
/* `metadata` is here because the document's fields live under it: the table's
   `document` row describes `doc.metadata`, not the wrapper. Nothing walks the
   wrapper today, so this changes no result; it makes the constant true. */
const CONTAINER_KEYS = ['sections', 'paragraphs', 'sentences', 'morphemes', 'metadata'];

/* Child lists, which are NOT the same set and must not be confused with it.
   CONTAINER_KEYS answers "is this key a field of the level, or the nesting
   itself" — a question about the field table, which is why `words` is absent
   from it and `metadata` is present. CHILD_KEYS answers "what does a walk
   descend into", where `words` obviously belongs and `metadata` obviously does
   not.

   Added at v3.14.240 after D50's replay used CONTAINER_KEYS to walk the tree and
   silently never reached a word: every journalled word edit came back
   unresolved, and a shallow put of a sentence still carried its whole word list.
   Caught by journal_disk_test.js on its first run. */
const CHILD_KEYS = ['sections', 'paragraphs', 'sentences', 'words', 'morphemes'];

/* @fn fieldId, the DOM id for a field's control.

   D48 stage B (option c): ids are generated from the level and key rather than
   hand-picked per view. Before this, `se-title`, `sna-title`, `de-title` and
   `da-form` were four conventions for the same idea, and every save handler and
   two guards named them literally — which is why an add form and its editor
   could read different elements without anything noticing.

   Nothing should build one of these by hand. readForm() and renderField() are
   the only callers, so the id is an implementation detail of the pair rather
   than a name the rest of the app has to keep in step. */
function fieldId(level, key) { return `f-${level}-${key}`; }

/* @fn isFillable, does this field get a control at all.
   `derived` is drawn by nothing; a `surface:` field is drawn by a bespoke
   component the caller supplies. Everything else the form renders. */
function isFillable(f) {
  /* `planned` names a field the table describes ahead of the work that creates
     it. Declaring it early is how the tier and the order get decided once;
     drawing a control for a field nothing stores would be a box that forgets
     what you type — which is exactly what document.translation_language became
     when the flag came off before a writer existed (B-117). Nothing carries the
     flag today; it stays because the next field added ahead of its writer needs
     it, and because that is cheaper than the bug. */
  return f && f.tier !== 'derived' && !f.surface && !f.planned;
}

// @fn fieldsOf, every declared field for a level, in view order
function fieldsOf(level) { return FIELD_SPEC[level] || []; }

/* @fn foldValue, apply a field's declared case fold. B-177.

   `fold:` has been on five fields since the table was written and NOTHING read
   it: the chip drawer folds inline with a literal argument, and every writer
   stored what was typed. So the two ways into one field disagreed — the chips
   gave `NOUN`, the keyboard gave `noun`, and one corpus could hold both. They
   are different values to every index, count and search in the app.

   DECIDED 2026-09-01: fold at the writer. Case is not information in a tag —
   `noun` and `NOUN` are the same claim and nobody means them differently — which
   is what separates this from a gloss, where the app rewriting the annotator's
   text would destroy a distinction they might mean (B-073, D53 stage F).

   Here rather than at each writer, because the declaration lives here and a
   second place that knows what `upper` means is the drift this closes. A field
   with no `fold` is returned untouched, which is most of them. */
// @fn foldValue
function foldValue(level, key, value) {
  if (value == null) return value;
  const fold = (fieldOf(level, key) || {}).fold;
  if (fold === 'upper') return String(value).toUpperCase();
  if (fold === 'lower') return String(value).toLowerCase();
  return value;
}

// @fn fieldOf, one field's whole declaration, or null
function fieldOf(level, key) {
  return fieldsOf(level).find(f => f.key === key) || null;
}

/* @fn tierOf, THE accessor. Every consumer goes through this rather than
   reading FIELD_SPEC, so a per-project override later is a change here and
   nowhere else. An undeclared key returns null, which is not the same as
   'derived': null means the table does not know about it, and the guard
   treats that as a failure rather than a default. */
function tierOf(level, key) {
  const f = fieldOf(level, key);
  return f ? f.tier : null;
}

// @fn fieldsInTier, the fields of a level at one tier, in view order
function fieldsInTier(level, tier) {
  return fieldsOf(level).filter(f => f.tier === tier);
}

/* @fn blocksSave, the whole of the save rule. Identity, and nothing else. */
function blocksSave(level, key) { return tierOf(level, key) === 'identity'; }

/* @fn tagPoolOf, the vocabulary a tag field draws on, or null.
   B-027. Three of the five `control: 'tag'` fields declared no pool, which is
   the same half-declaration this table has produced at every stage: the two
   dictionary fields named theirs and the word and morpheme rows, whose markup
   is hand-written, did not. A field whose values are checked against nothing is
   how `CONJ` and `affix` reached a published dictionary. The NAME is stored
   rather than the array, because the arrays are loaded from
   `resources/*.json` at runtime and this module is also required by Node. */
function tagPoolOf(level, key) {
  const f = fieldOf(level, key);
  return (f && f.tags) || null;
}

/* @fn annotationKeys, the fields whose presence means somebody worked on this.
   D48 stage D. `hasAnnotation` carried its own list of nine field names, which
   is the second hand-maintained field list this table exists to delete.

   Every tier that holds real annotation counts, not just `core`. The question
   here is "is there work here", and the caller that matters most is the prompt
   before re-tokenization discards a morpheme: a transliteration or a comment is
   somebody's work whether or not the object is finished. "Is it finished" is a
   different question, reads `core`, and belongs to D34's counter.

   Four exclusions, all declared rather than guessed:
     identity   what the object IS. A sentence always has text.
     derived    the app wrote it. `dict_id` is handled by the caller, which
                counts a link when asked about the machine and not when asked
                about a person.
     containers the structure annotation hangs on. A parsed word has morphemes
                and a tokenized sentence has words; neither is annotation, and
                counting them would make every object look annotated.

   `surface` fields are deliberately NOT excluded: the dependency pair lives on
   another screen, and it is still annotation. isFillable() answers a different
   question — whether renderField draws a control — and using it here would have
   silently dropped head and dep_rel. */
function annotationKeys(level) {
  return fieldsOf(level)
    .filter(f => f.tier !== 'identity' && f.tier !== 'derived'
                 && !f.planned
                 && f.control !== 'tokenize'
                 && f.stored !== false
                 && !CONTAINER_KEYS.includes(f.key))
    .map(f => f.key);
}

/* @fn resolveTracked, the fields THIS project counts — the default, plus what
   the annotator changed. D34 stage E, v3.14.319.

   `overrides` is `{ on: ['word.transliterations'], off: ['sentence.words'] }`,
   read from `doc.metadata.tracked`.

   THE OVERRIDES ARE STORED, NOT THE RESOLVED LIST, and that is the whole design
   decision. A project that saved `['word.gloss', 'morpheme.type', …]` would
   silently fail to track a `core` field added to this table next year — the
   hand-written-list failure, which this project has now removed four times.
   Storing only the difference means the default keeps deriving from the table
   forever, and an override survives a field being retired by simply matching
   nothing.

   `on` admits only TRACKABLE keys. A file naming a `derived` field —
   hand-edited, or written by a future version that declared more — is ignored
   rather than honoured: the tracker must not be a way to count `field_prov`.

   Pure, and takes the overrides as an argument rather than reading app state,
   so the rule is testable without a document and lives beside the table it
   derives from. */
function resolveTracked(level, overrides) {
  const on  = new Set((overrides && overrides.on)  || []);
  const off = new Set((overrides && overrides.off) || []);
  const keys = new Set(countedKeys(level));
  for (const k of trackableKeys(level)) if (on.has(`${level}.${k}`)) keys.add(k);
  for (const k of [...keys]) if (off.has(`${level}.${k}`)) keys.delete(k);
  /* Table order, always: the queue and the fold must not reshuffle because a
     field was turned on and off again. */
  return fieldsOf(level).map(f => f.key).filter(k => keys.has(k));
}

/* @fn toggleTracked, one field on or off, returned as a NEW overrides object.
   Pure for the same reason `resolveTracked` is, and it CANCELS rather than
   accumulates: turning a default-on field off and on again leaves `{}`, not
   `{on:[x], off:[x]}`. A stored override that merely restates the default is
   a claim about the table that will be wrong the day the table changes. */
function toggleTracked(level, key, want, overrides) {
  const id  = `${level}.${key}`;
  const on  = new Set((overrides && overrides.on)  || []);
  const off = new Set((overrides && overrides.off) || []);
  const byDefault = countedKeys(level).includes(key);
  on.delete(id); off.delete(id);
  if (want !== byDefault) (want ? on : off).add(id);
  const out = {};
  if (on.size)  out.on  = [...on].sort();
  if (off.size) out.off = [...off].sort();
  return out;
}

/* @fn labelKeyOf, the locale key that NAMES a field, wherever it is drawn.
   D34 stage C, v3.14.308. The word and morpheme rows are hand-written surfaces
   and carried no `label:` because nothing generated their markup — so the panel
   that has to write "words need a part of speech" had nowhere to read the name
   from, and would have grown the fourth hand-maintained field list. Every key
   points at an entry en.json already had; this adds no strings, only the link
   between a field and its name. A field with no label is named by its key,
   which is a visible defect rather than a crash. */
function labelKeyOf(level, key) {
  const f = fieldOf(level, key);
  return (f && f.label) || null;
}

/* @fn countedKeys, the fields whose EMPTINESS is evidence of unfinished work.
   D34 stage A. The third consumer of this table that would otherwise carry a
   hand-written field list, after `hasAnnotation` (D48 stage D) and the
   conformance allow-lists (B-037).

   `annotationKeys` answers "did somebody work here" and reads every tier that
   holds annotation. This answers "is it finished", which is a narrower
   question with a narrower source: **`core` is the tier that means empty is
   unfinished**, and that is the tier's own definition, not an interpretation
   of it.

   Three exclusions, and each one is a rule already written down:
     stored: false   `ingest` is a surface, not a field. Nothing is on disk to
                     be empty.
     containers      the nesting. `word.morphemes` is out for the same reason
                     `annotationKeys` puts it out — a word is not unfinished for
                     having a structure.
     planned         a field declared ahead of its writer stores nothing, so
                     every record would count as missing it.

   `sentence.words` is deliberately IN, and it is the one place this list and
   `annotationKeys` disagree on purpose. Tokenization is not annotation, so
   "did somebody work here" says no; but an untokenized sentence is unfinished,
   and — the reason that matters — it contributes no words, so every word-level
   count silently under-reports it. Counting the sentences is what keeps the
   word-level numbers honest about what they could not see.

   THE FLAG THE SPEC EXPECTED IS NOT HERE, AND ITS OPPOSITE IS. D34 stage C
   proposed `counted: false` for "fields no person fills". Deriving the list
   showed no field needs one — everything that would have carried it is already
   excluded by a rule with a name. What was needed is the other direction:
   `counted: true`, which opts a field IN against its tier.

   That flag is UNIFIED conflict ⑧ in one word. The tier answers "does the
   assumed use want this field", globally and for every project; `counted: true`
   plus an `appliesWhen` test answers "does THIS corpus want it", which is a
   different question the tier was never asked. `word.transliterations` is the
   case: `aux` is the right global answer and wrong for a Mandarin project, and
   neither the tier nor a migration has to move for the counter to say so. */
function countedKeys(level) {
  return fieldsOf(level).filter(f => isCounted(level, f)).map(f => f.key);
}

/* @fn isCounted, the whole membership rule, so `countedKeys` and `trackableKeys`
   cannot disagree about what "counted" means.
   A field is counted by default when it is `core`, or when it opts in with
   `counted: true`. `stored: false` normally excludes it — nothing is on disk to
   be empty — UNLESS it declares `filledWhen`, which is how a row can be reported
   at the level a person asks about it while the data lives a level down
   (`sentence.deps`, v3.14.318). */
function isCounted(level, f) {
  if (!f || f.planned) return false;
  if (CONTAINER_KEYS.includes(f.key)) return false;
  if (f.stored === false && !f.filledWhen) return false;
  return f.tier === 'core' || f.counted === true;
}

/* @fn trackableKeys, every field an annotator may ASK to count, tracked or not.
   D34 stage E, v3.14.318. The counter's default set is `countedKeys`; this is the
   pool a project can add to. What is excluded is excluded because it could not be
   somebody's outstanding work:

     identity   the save already refuses without it
     derived    the app writes it
     containers the nesting itself
     surfaces   `stored: false` with no `filledWhen` — `ingest` has nothing on disk

   And one exclusion that is a judgement rather than a mechanism: **a level whose
   `extra` fields are declared BIBLIOGRAPHIC has none of them trackable.** Author,
   publisher, date and the rest are facts about the text as a publication, not
   annotation anybody is going to finish, and a picker offering "1 document needs
   a publisher" beside "171 words need a lemma" buries the second. Derived from
   `LEVEL_EXTRA_LABEL`, which already carries that grouping, rather than from a
   list of five field names — so a level that later declares the same grouping
   gets the same answer without anyone remembering. `word.head` and `word.dep_rel`
   are `extra` too and stay trackable, which is why the rule is about the
   grouping and not about the tier. */
const _BIBLIOGRAPHIC = 'label.editor.bibliographic';

function trackableKeys(level) {
  const biblio = LEVEL_EXTRA_LABEL[level] === _BIBLIOGRAPHIC;
  return fieldsOf(level)
    .filter(f => !f.planned
                 && f.tier !== 'identity' && f.tier !== 'derived'
                 && !CONTAINER_KEYS.includes(f.key)
                 && (f.stored !== false || f.filledWhen)
                 && !(biblio && f.tier === 'extra'))
    .map(f => f.key);
}

/* @fn elementIdFor, where a field's control actually lives in the DOM.
   D48 stage C. Five levels are generated and their ids are derived; every
   hand-written surface declares `domId` instead — the two identity modals since
   stage B5, the word editor since v3.14.262. A consumer that wants to reach a
   control should not have to know which kind of surface it is on, which is the
   whole reason the table carries the id. */
function elementIdFor(level, f) {
  return (f && f.domId) || fieldId(level, f && f.key);
}

/* @fn selectorFor, the same answer for surfaces whose controls repeat.
   A morpheme's controls exist once per row, so there is no unique id to hold
   them to; `domSel` says the same thing as a selector, matched inside one row.
   Everything else is an id, and this is the accessor that hides the difference. */
function selectorFor(level, f) {
  return (f && f.domSel) || ('#' + elementIdFor(level, f));
}

/* @fn isEmptyValue, one answer to "is this field filled in".
   D48 stage C. Both the marking and the save rule ask it, and they have to
   agree: a field marked as wanting a value that then blocks the save with a
   different notion of empty is worse than either alone. Whitespace is empty —
   a space bar pressed to get past a dialog is the placeholder problem D48's
   first decision is about. */
function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;                       // numbers and booleans are values
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FIELD_TIERS, FIELD_SPEC, LEVEL_EXTRA_LABEL, UNIVERSAL_KEYS, CONTAINER_KEYS, CHILD_KEYS,
                     fieldsOf, fieldOf, foldValue, tierOf, fieldsInTier, blocksSave,
                     fieldId, isFillable, elementIdFor, selectorFor, isEmptyValue,
                     annotationKeys, countedKeys, isCounted, trackableKeys,
                     resolveTracked, toggleTracked,
                     labelKeyOf, tagPoolOf };
}
