// =============================================================================
// LingCoT, modules/normalize.js
// The dictionary matching key, defined once.
//
// B-043. Before v3.14.103 the key was `(f || '').toLowerCase()` and nothing
// else. In Turkish `"İstanbul".toLowerCase()` is "i" + U+0307 COMBINING DOT
// ABOVE, which is not "istanbul"; `"Isparta".toLowerCase()` is "isparta", not
// "ısparta", so a capitalised sentence-initial token never matched its own
// lemma, and because `_resolveOrCreateLemma`'s miss branch IS its create
// branch, the failure produced a duplicate entry instead of an error.
//
// FOUR LAYERS, and case is the shallowest:
//
//   L0  Unicode form (NFC)          every script          한글 = 2 chars NFC, 6 NFD
//   L1  case                        cased scripts         İ / I
//   L2  script orthographic folding per SCRIPT            Arabic أ إ آ → ا
//   L3  fieldwork spelling variation. NOT SOLVED HERE, and not solvable by a
//       key. Two annotators spell one word two ways; the language may have no
//       standard orthography at all. That is handled by making a MISS PROPOSE
//       rather than silently create, see B-033 / audits/retired/LINKING_AUDIT.md
//       §8 S1 (the audit was retired at v3.14.230; only §8 supports this, its
//       §2 describes the create-and-discard split this rule exists to stop).
//       Nothing in
//       this file should ever grow to try to guess at L3.
//
// WHY THE SPLIT IS LANGUAGE-FOR-CASE, SCRIPT-FOR-FOLDING:
// casing is a property of a language (tr and az lowercase differently from
// every other Latin-script language), while orthographic folding is a property
// of a script (the Arabic alef rule is identical for Arabic, Persian, Urdu,
// Pashto and Kurdish). Keying folding on language would mean writing the same
// profile twenty-five times.
//
// KEY vs FORM: `entry.form` is always stored exactly as typed. Only the map key
// is folded. Folding away Arabic harakat is therefore not data loss, it means a
// vocalised token finds its unvocalised dictionary entry, which is how Arabic
// dictionaries are keyed in the first place.
//
// Loaded via <script src="modules/normalize.js"> before the main script.
// All declarations are global (classic script tag, not ES module).
// =============================================================================

/* Bump when any rule below changes. Corpora record the version they were keyed
   under, so a key change is DETECTABLE rather than silent, the app can then
   offer a rebuild+dedupe instead of quietly matching differently than before.
   v1 = the pre-v3.14.103 bare toLowerCase(). */
const DICT_KEY_VERSION = 2;

/* ── L1 · case tailoring ───────────────────────────────────────────────────────
   Unicode's DEFAULT case mapping is language-independent and correct for every
   cased script, including cases people assume need a table: Greek final sigma
   ("ΟΔΟΣ".toLowerCase() === "οδος".toLowerCase()) and German ẞ both work.
   Exactly three locales need a tailoring, and this is the complete list. Do not
   add to it without a Unicode SpecialCasing.txt citation. */
const CASE_TAILORED_LOCALES = {
  tr: 'tr',   // dotted/dotless I
  az: 'az',   // same rule as Turkish
  lt: 'lt'    // retained dot above in combining sequences
};

/* ── L2 · script folding profiles ─────────────────────────────────────────────
   Keyed by ISO 15924 script code. `fold` may be null, which is a POSITIVE
   statement, "nothing should be folded here", not a to-do. The empty ones are
   load-bearing documentation: they exist to stop a future contributor adding a
   rule that looks helpful and destroys a distinction.

   `vectors` are executed by dev/tests/normalize_test.js. A profile with no
   vectors is not trusted; a profile whose vectors are not derived from real
   orthographic rules is worse than no profile, because it fails invisibly. */
const SCRIPT_PROFILES = {

  Arab: {
    note: 'strip vocalisation and tatweel; unify alef and yeh/kaf variants',
    fold: s => s
      .replace(/[ً-ٰٟۖ-ۭ]/g, '')  // harakat + Qur'anic marks
      .replace(/ـ/g, '')                              // tatweel (kashida)
      .replace(/[آأإٱ]/g, 'ا')    // آ أ إ ٱ → ا
      .replace(/[یى]/g, 'ي')                // ی ى → ي  (Farsi/Urdu yeh)
      .replace(/ک/g, 'ك'),                       // ک → ك   (Farsi keheh)
    /* DELIBERATELY NOT DONE: ة → ه and ؤ/ئ → ء. Those are standard in Arabic
       information retrieval and wrong for a linguistic corpus, taa marbuta is a
       morpheme, not a spelling variant of haa. */
    vectors: [
      ['كِتَاب', 'كتاب', 'harakat folded away'],
      ['كــتاب', 'كتاب', 'tatweel folded away'],
      ['أحمد',  'احمد',  'alef with hamza above unified'],
      ['إسلام', 'اسلام', 'alef with hamza below unified'],
      ['فارسی', 'فارسي', 'Farsi yeh unified to Arabic yeh'],
      ['کتاب',  'كتاب',  'Farsi keheh unified to Arabic kaf']
    ],
    distinct: [['مدرسة', 'مدرسه', 'taa marbuta is NOT folded to haa']]
  },

  Hebr: {
    note: 'strip niqqud and cantillation; letters only',
    fold: s => s.replace(/[֑-ׇֽֿׁׂׅׄ]/g, ''),
    vectors: [
      ['שָׁלוֹם', 'שלום', 'niqqud folded away'],
      ['בְּרֵאשִׁית', 'בראשית', 'niqqud + dagesh folded away']
    ],
    distinct: [['שלום', 'שלם', 'consonants are never folded']]
  },

  Deva: {
    note: 'decompose the eight precomposed nukta letters',
    /* NFC does NOT compose these, they sit in Unicode's composition exclusion
       list, so क़ can legitimately arrive either as U+0958 or as U+0915 U+093C
       and the two never unify on their own. This is the one Devanagari case that
       genuinely needs an explicit rule. */
    fold: s => s
      .replace(/क़/g, 'क़').replace(/ख़/g, 'ख़')
      .replace(/ग़/g, 'ग़').replace(/ज़/g, 'ज़')
      .replace(/ड़/g, 'ड़').replace(/ढ़/g, 'ढ़')
      .replace(/फ़/g, 'फ़').replace(/य़/g, 'य़'),
    vectors: [
      ['क़', 'क़', 'precomposed qa decomposes to ka + nukta'],
      ['य़', 'य़', 'precomposed yya decomposes to ya + nukta']
    ],
    distinct: [['क', 'ख', 'distinct consonants stay distinct']]
  },

  Jpan: {
    note: 'fold half-width kana to full width (width only — never kana class)',
    /* NFKC on the half-width kana block only. Applying NFKC to the whole string
       would also fold full-width Latin and compatibility CJK ideographs, which
       is more than we mean. Hiragana and katakana are NEVER folded into each
       other: そら and ソラ are a real orthographic contrast in Japanese. */
    fold: s => s.replace(/[｡-ﾟ]+/g, m => m.normalize('NFKC')),
    vectors: [
      ['ｶﾀｶﾅ', 'カタカナ', 'half-width katakana widened'],
      ['ｶﾞ',   'ガ',       'half-width voiced mark composes']
    ],
    distinct: [['そら', 'ソラ', 'hiragana and katakana are NOT folded together']]
  },

  /* ── Intentionally empty. Each of these is a decision, not an omission. ───── */

  Latn: {
    note: 'nothing beyond case — diacritics are NEVER stripped',
    /* é vs e, ñ vs n, ø vs o are distinct letters in the languages that use
       them. Stripping them is a search-engine habit that would merge real
       minimal pairs in exactly the fieldwork languages this tool exists for. */
    fold: null,
    distinct: [['résumé', 'resume', 'diacritics are a letter distinction']]
  },

  Cyrl: {
    note: 'nothing — ё/е folding is Russian-specific and wrong elsewhere',
    /* Russian typography often treats ё as an optional spelling of е, but in
       Belarusian ё is a distinct letter with its own place in the alphabet. A
       script-level rule cannot tell them apart, so this stays a language-level
       question and is not answered here. */
    fold: null,
    distinct: [['ёж', 'еж', 'ё is not folded to е at script level']]
  },

  Grek: {
    note: 'nothing beyond case — final sigma is already handled by case mapping',
    /* Polytonic → monotonic is an editorial decision about a text, not a
       normalisation, and it is destructive for Ancient Greek. */
    fold: null,
    distinct: [['ᾆ', 'ἆ', 'polytonic diacritics are preserved']]
  },

  Hang: {
    note: 'nothing beyond NFC — L0 already does the work',
    /* Korean's real hazard is NFC vs NFD (한글 is 2 code points composed, 6
       decomposed) and L0 handles it for every script at once. */
    fold: null
  },

  Hans: { note: 'nothing — simplified/traditional is a language choice, not normalisation', fold: null },
  Hant: { note: 'nothing — see Hans', fold: null },
  Thai: { note: 'nothing — no case, no standard folding', fold: null },
  Armn: { note: 'nothing beyond case', fold: null },
  Taml: { note: 'nothing — no case, no composition exclusions in use', fold: null },
  Telu: { note: 'nothing — see Taml', fold: null }
};

/* Script detection, from the TEXT rather than the language tag. Deliberate: it
   needs no language metadata (which corpora disagree about, one says
   "Turkish", another says "kor"), and it is correct for languages written in
   more than one script (Serbian, Kurdish, Punjabi). Returns null when no script
   dominates, in which case no L2 folding is applied. */
const _SCRIPT_TESTS = [
  ['Arab', /\p{Script=Arabic}/u],   ['Hebr', /\p{Script=Hebrew}/u],
  ['Deva', /\p{Script=Devanagari}/u], ['Hang', /\p{Script=Hangul}/u],
  ['Grek', /\p{Script=Greek}/u],    ['Cyrl', /\p{Script=Cyrillic}/u],
  ['Thai', /\p{Script=Thai}/u],     ['Armn', /\p{Script=Armenian}/u],
  ['Taml', /\p{Script=Tamil}/u],    ['Telu', /\p{Script=Telugu}/u],
  ['Latn', /\p{Script=Latin}/u]
];
// @fn detectScript
function detectScript(text) {
  const s = (text || '').slice(0, 4000);
  if (!s) return null;
  // Japanese first: it mixes Han with kana, and the kana are what identify it.
  if (/[぀-ヿ｡-ﾟ]/.test(s)) return 'Jpan';
  if (/\p{Script=Han}/u.test(s)) return 'Hans';
  for (const [code, re] of _SCRIPT_TESTS) if (re.test(s)) return code;
  return null;
}

/* The active fold context. Set once when a corpus loads (and again if its
   language or text changes), because every normForm() call site is a bare
   normForm(form) and threading a locale through 31 of them would be a large
   diff for no gain. Changing this MUST be followed by buildDictIndex(), an
   index built under one context and probed under another is B-043 again. */
let _foldLocale = null;   // BCP-47 locale for L1, or null for the default mapping
let _foldScript = null;   // ISO 15924 code for L2, or null for none

// @fn setFoldContext, returns { locale, script } for logging
function setFoldContext(canonicalLang, sampleText) {
  const lc = (canonicalLang || '').toLowerCase().split(/[-_]/)[0];
  _foldLocale = CASE_TAILORED_LOCALES[lc] || null;
  _foldScript = detectScript(sampleText);
  return { locale: _foldLocale, script: _foldScript };
}

// @fn getFoldContext
function getFoldContext() { return { locale: _foldLocale, script: _foldScript }; }

/* The key itself. Pure, the context is passed explicitly so guards and the
   dedupe report can exercise every locale/script without global state. */
// @fn dictKeyIn
function dictKeyIn(form, locale, script) {
  let s = (form || '').normalize('NFC');                       // L0
  const prof = script ? SCRIPT_PROFILES[script] : null;
  if (prof && prof.fold) s = prof.fold(s);                     // L2
  s = locale ? s.toLocaleLowerCase(locale) : s.toLowerCase();  // L1
  return s.normalize('NFC');
}

/* Bound to the active corpus. This is what normForm() delegates to. */
// @fn dictKey
function dictKey(form) { return dictKeyIn(form, _foldLocale, _foldScript); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DICT_KEY_VERSION, CASE_TAILORED_LOCALES, SCRIPT_PROFILES,
                     detectScript, setFoldContext, getFoldContext, dictKeyIn, dictKey };
}
