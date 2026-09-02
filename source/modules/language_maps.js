// =============================================================================
// LingCoT, modules/language_maps.js
// Dynamic language alias lookup tables, built from language_codes.json at startup.
//
// LANG_TO_CANONICAL, any alias/name → canonical ISO code (e.g. "Korean" → "ko")
// CANONICAL_TO_GOOGLE, canonical code → Google BCP-47 (e.g. "ko" → "ko")
//
// Both maps start empty and are populated by loadLanguageMaps(), which is called
// fire-and-forget from DOMContentLoaded.  They are ready before any user action
// can trigger translation.
//
// Source of truth: source/resources/language_codes.json
// Python side uses the same file via lang_utils.py (_load).
//
// Build logic mirrors lang_utils.py _load():
//   canonical_code → canonical_code  (exact + lowercase)
//   each alias     → canonical_code  (exact + lowercase)
//   iso639_1       → canonical_code  (exact + lowercase)
//   iso639_3       → canonical_code  (exact + lowercase)
//   nllb_code      → canonical_code  (exact + lowercase)
//   google_bcp47   → entry in CANONICAL_TO_GOOGLE (non-null only)
//
// Loaded via <script src="modules/language_maps.js"> before the main script.
// All declarations are global (classic script tag, not ES module).
// =============================================================================

// Initialised empty; populated by loadLanguageMaps() at startup.
let LANG_TO_CANONICAL  = {};
let CANONICAL_TO_GOOGLE = {};

// @fn loadLanguageMaps
// Reads resources/language_codes.json via PyWebView and builds LANG_TO_CANONICAL
// and CANONICAL_TO_GOOGLE.  Called once from DOMContentLoaded (fire-and-forget).
// On failure, both maps remain empty and translation language resolution is
// disabled (checkLangForBackend will report the language as unrecognised).
async function loadLanguageMaps() {
  await _pwReady;
  try {
    const text = await window.pywebview.api.read_file('resources/language_codes.json');
    const data = JSON.parse(text);
    const langs = data.languages || {};

    const ltc = {};  // alias → canonical code
    const ctg = {};  // canonical code → Google BCP-47

    for (const [code, info] of Object.entries(langs)) {
      // Canonical code maps to itself (exact + lowercase for case-insensitive lookup)
      ltc[code]             = code;
      ltc[code.toLowerCase()] = code;

      // All aliases (English names, native names, BCP-47 variants, etc.)
      for (const alias of (info.aliases || [])) {
        ltc[alias]              = code;
        ltc[alias.toLowerCase()] = code;
      }

      // ISO 639-1 and ISO 639-3 codes as additional aliases
      for (const field of ['iso639_1', 'iso639_3']) {
        const c = info[field];
        if (c) {
          ltc[c]              = code;
          ltc[c.toLowerCase()] = code;
        }
      }

      // NLLB flores200 code as alias (users sometimes paste these directly)
      if (info.nllb_code) {
        ltc[info.nllb_code]              = code;
        ltc[info.nllb_code.toLowerCase()] = code;
      }

      // Google BCP-47 (null means language not supported by Google Translate)
      const g = info.google_bcp47;
      if (g !== null && g !== undefined && g !== 'null') {
        ctg[code] = g;
      }
    }

    // Assign atomically so a half-built map is never visible to concurrent reads
    LANG_TO_CANONICAL  = ltc;
    CANONICAL_TO_GOOGLE = ctg;

    logEvent('debug', 'Language maps loaded from JSON',
      Object.keys(ltc).length + ' aliases, ' + Object.keys(ctg).length + ' Google codes');
  } catch (e) {
    logEvent('warn', 'Language maps failed to load; translation language resolution disabled', e?.message);
  }
}


// =============================================================================
//  Language suggestion. B-031
// =============================================================================
//  "Cannot reach Google Translate" was reported on a machine that was online.
//  The real mechanism: translateText() gates Google on `!!googleSrc`, so a
//  Language field that does not resolve means Google is never called at all and
//  the user is told it could not be reached. A typo is indistinguishable from an
//  outage.
//
//  Resolution itself is in good shape, all 71 languages resolve from their
//  canonical code, ISO 639-1/3, NLLB code, English name and native name. What was
//  missing is any help when the input is CLOSE to one of those and not equal.
//
//  Deliberately rudimentary: Levenshtein plus prefix/substring, over the alias
//  table that already exists. No new data, no dependency. The goal is to turn a
//  dead end into a question ("did you mean Turkish?"), not to guess for the user.
// =============================================================================

// @fn _editDistance
// Levenshtein, two-row. Bounded by `max` so a scan over ~1500 aliases stays cheap:
// once a row's best possible score exceeds max we stop, since the caller only
// cares about near misses.
function _editDistance(a, b, max = 4) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// @fn _foldDiacritics
// "Türkçe" -> "turkce". Someone typing on a keyboard without the right layout
// should still reach the language whose native name they are half-remembering.
function _foldDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// @fn suggestLanguage
// Returns { canonical, exact, suggestions } for a user-typed language string.
//   canonical, resolved code, or null
//   exact, true when the input resolved without guessing
//   suggestions, [{ label, canonical, why }] best first, at most `limit`
// Never throws and never returns null; an empty suggestion list is a valid answer.
function suggestLanguage(input, limit = 3) {
  const raw = (input || '').trim();
  const out = { canonical: null, exact: false, suggestions: [] };
  if (!raw) return out;

  const direct = LANG_TO_CANONICAL[raw] || LANG_TO_CANONICAL[raw.toLowerCase()];
  if (direct) { out.canonical = direct; out.exact = true; return out; }

  const needle = _foldDiacritics(raw);
  const seen = new Map();   // canonical -> best {score, label, why}
  const offer = (canonical, label, score, why) => {
    const cur = seen.get(canonical);
    if (!cur || score < cur.score) seen.set(canonical, { score, label, why, canonical });
  };

  for (const [alias, canonical] of Object.entries(LANG_TO_CANONICAL)) {
    const folded = _foldDiacritics(alias);
    if (!folded) continue;
    if (folded === needle)            { offer(canonical, alias, 0, 'diacritics'); continue; }
    if (folded.startsWith(needle) && needle.length >= 2)
                                      { offer(canonical, alias, 1, 'prefix');     continue; }
    if (needle.length >= 4 && folded.includes(needle))
                                      { offer(canonical, alias, 2, 'contains');   continue; }
    // Edit distance only for comparable lengths, "en" is not a typo for "Persian".
    if (Math.abs(folded.length - needle.length) <= 3) {
      const d = _editDistance(needle, folded, needle.length <= 4 ? 1 : 2);
      if (d <= (needle.length <= 4 ? 1 : 2)) offer(canonical, alias, 3 + d, 'typo');
    }
  }

  out.suggestions = [...seen.values()]
    .sort((a, b) => a.score - b.score || a.label.length - b.label.length)
    .slice(0, limit)
    .map(({ label, canonical, why }) => ({ label, canonical, why }));
  return out;
}

// @fn googleCodeFor, canonical code -> Google BCP-47, or null when Google cannot
// do this language at all. 15 of the 71 entries have no google_bcp47; telling the
// user that plainly is better than reporting a connection failure.
function googleCodeFor(canonical) {
  if (!canonical) return null;
  return CANONICAL_TO_GOOGLE[canonical]
      || CANONICAL_TO_GOOGLE[String(canonical).toLowerCase()]
      || null;
}
