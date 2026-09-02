#!/usr/bin/env python3
# =============================================================================
# Linguistic Corpus Toolkit (LingCoT), corpus_optimize.py
# Copyright (c) 2026 Kutay Serova  |  SPDX-License-Identifier: MIT
# See LICENSE in the project root for the full license text.
# =============================================================================
#
# PURPOSE
#   Benchmarks NLLB-200 translation speed at multiple thread configurations on
#   the local CPU, identifies the fastest setting, and writes annotator_config.json
#   at the project root. corpus_annotate.py reads this file automatically.
#   Run once after downloading the NLLB model, or after moving to a new machine.
#
# STRUCTURE
#   load_sample_sentences(), built-in multi-language sample sentences for
#                              benchmarking, or user-supplied TXT/EPUB/JSONL
#   benchmark_nllb(), times NLLB across a grid of (inter_threads, intra_threads,
#                              beam_size) and returns the winner
#   benchmark_google(), optional Google Translate timing for comparison
#   write_config(), serialises the winning config to annotator_config.json
#   main(), argparse entry point
#
# L-030, corrected v3.14.365: this map named benchmark_config(), run_benchmark()
# and test_google(), none of which have ever existed here. A structure map is the
# first thing a reader uses to navigate a 700-line file, and three of its six
# entries pointed at nothing. The same defect was in the other two scripts.
#
# USAGE
#   python source/scripts/corpus_optimize.py
#   python source/scripts/corpus_optimize.py --sample-size 20 --quiet
#   python source/scripts/corpus_optimize.py --sample-file my_text.txt --test-google
#
# THIRD-PARTY TOOLS
#   NLLB-200  https://github.com/facebookresearch/fairseq/tree/nllb
#   NLLB Team (2022) "No Language Left Behind" https://arxiv.org/abs/2207.04672
# =============================================================================
# ── Environment bootstrap ─ B-179: byte-identical in all four scripts ─────────
# Re-exec with the venv Python if .venv/ exists and we are not already inside it,
# so nobody has to run "source .venv/bin/activate" by hand.
#
# THREE things this gets wrong if written the obvious way, and all three were
# live until v3.14.344:
#
#   1. It must not fire on IMPORT. os.execv never returns, so a module-level
#      re-exec replaces the process of ANYTHING that imports this file. Under
#      `python -c`, sys.argv is ['-c'] — the script text is not in argv — so the
#      re-exec built `python -c` with no argument and the caller got
#      "Argument expected for the -c option" in place of the module. Found by
#      workspace_test.js, which imports corpus_ingest.py to ask where the CLI
#      writes fieldwork (B-041) and got the argv error instead.
#   2. Windows keeps its interpreter at .venv\Scripts\python.exe. A bin/python
#      check is false there, so the venv is silently never adopted — the same
#      layout fork nllb_diag_test.py already checks for the NLLB launcher.
#   3. Four scripts carry this block, and they had already drifted in how they
#      computed the project root. Finding the venv by walking UP removes the one
#      line that differed, so the four are byte-identical and
#      venv_bootstrap_test.js holds them that way.
#
# sys.prefix, not the executable path: a venv Python is often a symlink back to
# the same binary as the system one, so a path comparison fails where a prefix
# comparison does not. The walk is bounded at four levels, or a stray .venv
# further up someone's home directory becomes this project's interpreter.
import sys as _sys, os as _os


def _lingcot_venv_bootstrap():
    """Replace this process with the project venv's Python, once, at startup."""
    from pathlib import Path
    sub = "Scripts" if _os.name == "nt" else "bin"
    exe = "python.exe" if _os.name == "nt" else "python"
    for up in list(Path(_os.path.abspath(__file__)).parents)[:4]:
        py = up / ".venv" / sub / exe
        if py.exists():
            if Path(_sys.prefix) != up / ".venv":
                _os.execv(str(py), [str(py)] + _sys.argv)
            return


if __name__ == "__main__":
    _lingcot_venv_bootstrap()
# ── end environment bootstrap ────────────────────────────────────────────────

"""
corpus_optimize.py  –  LingCoT system benchmark  v2.0.1

Benchmarks the NLLB-200 translation model (and optionally Google Translate)
on this machine and writes the optimal configuration to annotator_config.json.

corpus_annotate.py reads this config automatically on the next run, so you
only need to run this script once per machine (or after a hardware change).

NLLB-200 is a single 200-language neural model, no per-language downloads
needed.  It covers virtually any source language automatically.

Usage
-----
  # Quick auto-benchmark (uses built-in Chinese sentences, good proxy for any
  # language since NLLB handles all scripts through the same model)
  python source/scripts/corpus_optimize.py

  # Use sentences from a real corpus file for a more representative result
  python source/scripts/corpus_optimize.py --sample-file my_corpus.jsonl --sample-lang tur

  # Also benchmark Google Translate (needs internet, consumes API quota)
  python source/scripts/corpus_optimize.py --test-google --google-source-lang zho

  # Save config to a custom path
  python source/scripts/corpus_optimize.py --output my_config.json

Output
------
  source/config/annotator_config.json   (default output path)

  Example output:
    {
      "version": "2.0",
      "nllb": {
        "compute_type": "int8",
        "inter_threads": 1,
        "intra_threads": 2,
        "beam_size": 1,
        "rate_sent_per_s": 8.7
      },
      "google": { "batch_size": 50, "delay_between_batches": 2.0 },
      "default_translator": "nllb"
    }
"""

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional

# ── Logging ───────────────────────────────────────────────────────────────────
# log_setup.py lives in source/ (two levels up from source/scripts/).
# Per-run session logger: each optimize run gets its own timestamped file.
sys.path.insert(0, str(Path(__file__).parent.parent))
from log_setup import setup_session_logger as _setup_logger
_log = _setup_logger(Path(__file__).parent.parent.parent, prefix='scripts')

# ── Built-in sample sentences ──────────────────────────────────────────────────
# Keyed by NLLB flores200 language code.  These are used when no --sample-file
# is provided.  Chinese (zho_Hant) serves as the default benchmark language
# since it exercises both longer-token and shorter-token paths in the NMT model.
# NLLB uses one shared model for all languages, so benchmarking with any language
# gives a representative throughput estimate for the others.

_BUILTIN_SAMPLES: dict[str, list[str]] = {
    "zho_Hant": [
        "做完黑市的交易，我們去市長家後門，打算賣掉剩下的那半草莓。",
        "市長的女兒馬奇為我們打開門。",
        "她今年十六歲，烏黑的頭髮編成辮子，穿著一件藍色連衣裙。",
        "我知道她的名字，因為我們在同一所學校上學，但我們從未說過話。",
        "她的父親是市長，而我的父親是礦工，這使我們之間隔著一道無形的牆。",
        "我把草莓遞給她，她低頭看了看，然後抬起頭微笑著說謝謝。",
        "那一刻，我突然意識到，即使在這個充滿苦難的世界裡，美好的事物依然存在。",
        "我們每天都在為生存而戰，但有些東西是無法被剝奪的。",
        "回到家，我把賣草莓的錢交給了媽媽，她的眼睛裡充滿了感激。",
        "弟弟們圍坐在桌子旁，等待著晚餐。",
        "今晚的晚餐比平時豐盛，因為我們賣出了一個好價錢。",
        "夜晚降臨，我躺在床上，望著窗外的星空，思考著未來。",
        "明天又是新的一天，又是新的挑戰，但我已經準備好了。",
        "在這個世界裡，只有強者才能生存，而我決定成為其中之一。",
        "我閉上眼睛，慢慢地進入夢鄉，夢裡充滿了希望和光明。",
        "早晨，太陽升起，照亮了整個山谷。",
        "我和蓋爾一起出發，去森林裡打獵。",
        "我們必須在日落之前回到城裡，否則會受到懲罰。",
        "獵物今天不多，但我們還是收穫了幾隻兔子和一些漿果。",
        "蓋爾說，有一天我們一定能逃出這個地方，過上自由的生活。",
    ],
    "tur_Latn": [
        "Çocuklar okula giderken yağmur yağmaya başladı.",
        "Türkiye, Asya ve Avrupa arasında köprü görevi görür.",
        "Bu kitabı okumayı çok sevdim, özellikle son bölüm.",
        "Sabah erken kalkmak sağlık için iyidir.",
        "İstanbul, tarihi yapıları ve kültürüyle ünlü bir şehirdir.",
        "Dünyanın en uzun nehri hangisidir?",
        "Bilim insanları yeni bir ilaç keşfettiklerini açıkladı.",
        "Müzik ruhun ilacıdır ve insanı rahatlatır.",
        "Güneş her sabah doğudan doğar ve batıdan batar.",
        "Teknoloji hayatımızı kolaylaştırırken bazı zorluklar da getiriyor.",
        "Annem her akşam bize yemek pişirir ve masayı kurar.",
        "Kütüphanede binlerce kitap var, hepsini okumak istiyorum.",
        "Çevre kirliliği günümüzün en önemli sorunlarından biridir.",
        "Arkadaşım bana çok güzel bir doğum günü sürprizi yaptı.",
        "Matematik ve dil öğrenmek beyin gelişimi için çok faydalıdır.",
        "Şehirde yaşamak köyde yaşamaktan çok farklıdır.",
        "Her sabah gazete okumayı alışkanlık haline getirdim.",
        "Deniz kenarında yürüyüş yapmak çok keyiflidir.",
        "Gelecekte uçan arabalar kullanacak mıyız?",
        "Bu ülkede insanlar birbirine çok saygılı davranıyor.",
    ],
    "ara_Arab": [
        "ذهبت إلى السوق لشراء الخضروات الطازجة.",
        "اللغة العربية هي إحدى أقدم اللغات في العالم.",
        "يحب الأطفال اللعب في الحديقة بعد المدرسة.",
        "القاهرة مدينة عريقة تجمع بين الحضارة والتاريخ.",
        "الصحة أغلى من المال في نظر كثير من الناس.",
        "تعلم لغة جديدة يفتح آفاقاً واسعة أمام الإنسان.",
        "الشمس تشرق من الشرق وتغرب في الغرب.",
        "قرأت كتاباً رائعاً عن تاريخ الحضارات القديمة.",
        "الصداقة الحقيقية نعمة كبيرة في حياة الإنسان.",
        "يسعى الناس دائماً إلى تحقيق السعادة والرفاهية.",
        "الرياضة مهمة للحفاظ على الصحة الجسدية والنفسية.",
        "يحتاج العالم إلى مزيد من التعاون والتفاهم بين الشعوب.",
        "المدن الكبيرة تواجه تحديات في مجال المرور والبيئة.",
        "التكنولوجيا الحديثة غيرت طريقة حياتنا بشكل جذري.",
        "الأم هي أغلى إنسان في حياة كل شخص.",
        "يجب على الجميع الحفاظ على البيئة وعدم تلويثها.",
        "السفر وسيلة رائعة لاكتشاف ثقافات وحضارات جديدة.",
        "العلم نور يضيء درب الإنسان في الحياة.",
        "الوقت ثمين ويجب استثماره بالشكل الأمثل.",
        "الابتسامة لغة عالمية تتجاوز الحدود والثقافات.",
    ],
}

# Maps ISO 639-3 / BCP-47 source codes → NLLB flores200 codes.
# Used to resolve --sample-lang to the correct NLLB language token.
_ISO3_TO_NLLB: dict[str, str] = {
    'zho': 'zho_Hant', 'chi': 'zho_Hant', 'zh': 'zho_Hant',
    'zh-tw': 'zho_Hant', 'zh-cn': 'zho_Hans',
    'tur': 'tur_Latn', 'tr': 'tur_Latn',
    'ara': 'ara_Arab', 'ar': 'ara_Arab',
    'hin': 'hin_Deva', 'hi': 'hin_Deva',
    'kor': 'kor_Hang', 'ko': 'kor_Hang',
    'jpn': 'jpn_Jpan', 'ja': 'jpn_Jpan',
    'rus': 'rus_Cyrl', 'ru': 'rus_Cyrl',
    'fra': 'fra_Latn', 'fre': 'fra_Latn', 'fr': 'fra_Latn',
    'deu': 'deu_Latn', 'ger': 'deu_Latn', 'de': 'deu_Latn',
    'spa': 'spa_Latn', 'es': 'spa_Latn',
    'por': 'por_Latn', 'pt': 'por_Latn',
    'vie': 'vie_Latn', 'vi': 'vie_Latn',
    'eng': 'eng_Latn', 'en': 'eng_Latn',
}

# Google source language map (kept separate. Google uses BCP-47, not flores200)
_GOOGLE_LANG_MAP: dict[str, str] = {
    'zho': 'zh-TW', 'chi': 'zh-TW', 'zh': 'zh-TW',
    'zh-tw': 'zh-TW', 'zh-cn': 'zh-CN',
    'tur': 'tr', 'tr': 'tr',
    'ara': 'ar', 'ar': 'ar',
    'hin': 'hi', 'hi': 'hi',
    'kor': 'ko', 'ko': 'ko',
    'jpn': 'ja', 'ja': 'ja',
    'rus': 'ru', 'ru': 'ru',
    'fra': 'fr', 'fre': 'fr', 'fr': 'fr',
    'deu': 'de', 'ger': 'de', 'de': 'de',
    'spa': 'es', 'es': 'es',
    'por': 'pt', 'pt': 'pt',
}


# ── Sample extraction ──────────────────────────────────────────────────────────

# @fn load_sample_sentences
def load_sample_sentences(sample_file: Optional[Path],
                          lang_code: Optional[str],
                          n: int = 20) -> tuple[str, list[str]]:
    """
    Return (nllb_src_code, sentences).
    Extracts from file if given; otherwise falls back to built-in samples.
    """
    nllb_code = _ISO3_TO_NLLB.get((lang_code or 'zho').lower(), 'zho_Hant')

    if sample_file and sample_file.exists():
        ext = sample_file.suffix.lower()
        if ext == '.epub':
            sents = _from_epub(sample_file, n)
        elif ext == '.jsonl':
            sents = _from_jsonl(sample_file, n)
        else:
            sents = _from_txt(sample_file, n)
        return nllb_code, sents[:n]

    # Fall back to built-in samples, use the closest available key
    key = nllb_code if nllb_code in _BUILTIN_SAMPLES else 'zho_Hant'
    return nllb_code, _BUILTIN_SAMPLES[key][:n]


# @fn _from_epub
def _from_epub(path: Path, n: int) -> list[str]:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup
    import unicodedata
    book = epub.read_epub(str(path), options={"ignore_ncx": True})
    sents = []
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), 'html.parser')
        text = unicodedata.normalize('NFC', soup.get_text('\n').replace('\r\n', '\n'))
        for line in text.splitlines():
            line = line.strip()
            if len(line) > 10:
                sents.append(line)
            if len(sents) >= n:
                return sents
    return sents


# @fn _from_jsonl
def _from_jsonl(path: Path, n: int) -> list[str]:
    """Extract raw sentence text from an existing corpus JSONL file."""
    sents = []
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            for sec in doc.get('sections', []):
                for para in sec.get('paragraphs', []):
                    for sent in para.get('sentences', []):
                        t = sent.get('text', '').strip()
                        if len(t) > 10:
                            sents.append(t)
                        if len(sents) >= n:
                            return sents
    return sents


# @fn _from_txt
def _from_txt(path: Path, n: int) -> list[str]:
    import unicodedata
    text = unicodedata.normalize('NFC', path.read_text(encoding='utf-8', errors='replace'))
    sents = [l.strip() for l in text.splitlines() if len(l.strip()) > 10]
    return sents[:n]


# ── NLLB benchmark ─────────────────────────────────────────────────────────────

# Thread configurations to test: (inter_threads, intra_threads)
# Reduced to the three configs that consistently matter on 2-8 core machines.
# inter × intra should not exceed total CPU cores.
# Tested with beam=1 only (greedy is faster and nearly identical quality for
# corpus annotation purposes; users can override with --beam-size 2 in annotate).
_NLLB_CONFIGS = [
    (1, 1),   # single-threaded baseline
    (1, 2),   # one job, two decode threads, best on 4-core in benchmarks
    (2, 2),   # two parallel jobs × two threads, good on 8+ core machines
]


# @fn _find_nllb_model
def _find_nllb_model(nllb_root: Path) -> Optional[Path]:
    """Return the first nllb-200-* weights directory found, or None."""
    if not nllb_root.exists():
        return None
    dirs = sorted(d for d in nllb_root.iterdir()
                  if d.is_dir() and d.name.startswith("nllb-200-"))
    return dirs[0] if dirs else None


# @fn benchmark_nllb
def benchmark_nllb(nllb_root: Path, sentences: list[str], src_lang: str,
                   cpu_cores: int, verbose: bool = True) -> list[dict]:
    """
    Benchmark NLLB-200 across all (inter_threads × intra_threads × beam_size)
    combinations that fit within the available CPU cores.

    Returns result dicts sorted best-first by throughput (sent/s).
    Each result includes the full config needed to reproduce the result.
    """
    try:
        import ctranslate2
        import sentencepiece as spm
    except ImportError:
        print("  ctranslate2 / sentencepiece not installed — skipping NLLB benchmark.")
        return []

    sp_path   = nllb_root / "flores200_sacrebleu_tokenizer_spm.model"
    model_dir = _find_nllb_model(nllb_root)

    if not sp_path.exists() or not model_dir:
        print(f"  NLLB model not found under {nllb_root} — skipping.")
        print(f"  Expected: flores200_sacrebleu_tokenizer_spm.model + nllb-200-*/")
        return []

    tgt_lang = "eng_Latn"

    # Load the shared flores200 tokeniser once
    sp = spm.SentencePieceProcessor()
    sp.Load(str(sp_path))

    # Pre-tokenise all sentences: [src_lang] + tokens + [</s>]
    tokenized = [
        [src_lang] + sp.Encode(s, out_type=str) + ["</s>"]
        for s in sentences
    ]

    results = []

    for inter, intra in _NLLB_CONFIGS:
        # Skip configs that exceed available cores (wasteful on this machine)
        if inter * intra > cpu_cores:
            continue

        # Benchmark only beam=1 (greedy). It's 28% faster than beam=2 with
        # negligible quality loss for corpus annotation. Users can override
        # with --beam-size in corpus_annotate.py if needed.
        for beam in [1]:
            try:
                ct = ctranslate2.Translator(
                    str(model_dir), device="cpu",
                    compute_type="int8",
                    inter_threads=inter,
                    intra_threads=intra,
                )
            except (ValueError, RuntimeError) as exc:
                if verbose:
                    print(f"    inter={inter} intra={intra} beam={beam}  — unsupported: {exc}")
                continue

            # Warm-up: first 2 sentences to amortise any JIT or cache priming
            ct.translate_batch(
                tokenized[:2],
                target_prefix=[[tgt_lang]] * 2,
                beam_size=beam,
            )

            t0 = time.perf_counter()
            ct.translate_batch(
                tokenized,
                target_prefix=[[tgt_lang]] * len(tokenized),
                beam_size=beam,
            )
            elapsed = time.perf_counter() - t0
            del ct  # release before loading next config

            rate = len(sentences) / elapsed
            entry = {
                "compute_type":   "int8",
                "inter_threads":  inter,
                "intra_threads":  intra,
                "beam_size":      beam,
                "elapsed_s":      round(elapsed, 2),
                "rate_sent_per_s": round(rate, 2),
            }
            results.append(entry)

            if verbose:
                print(
                    f"    inter={inter} intra={intra} beam={beam}  "
                    f"{elapsed:5.1f}s  {rate:5.1f} sent/s"
                )

    results.sort(key=lambda r: r['rate_sent_per_s'], reverse=True)
    return results


# ── Google benchmark ───────────────────────────────────────────────────────────

# @fn benchmark_google
def benchmark_google(sentences: list[str], source_lang: str,
                     batch_sizes: list[int] = None,
                     verbose: bool = True) -> list[dict]:
    """
    Benchmark Google Translate with a range of batch sizes.
    Returns results sorted best-first, or empty list on import failure.
    """
    batch_sizes = batch_sizes or [25, 50, 100]
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        print("  deep-translator not installed — skipping Google benchmark.")
        return []

    google_src = _GOOGLE_LANG_MAP.get(source_lang.lower(), source_lang)
    results = []

    for bsize in batch_sizes:
        gt = GoogleTranslator(source=google_src, target='en')
        ok = fail = 0
        t0 = time.perf_counter()
        for start in range(0, len(sentences), bsize):
            chunk = sentences[start:start + bsize]
            try:
                out = gt.translate_batch(chunk)
                ok += sum(1 for x in (out or []) if x)
            except Exception as exc:
                fail += len(chunk)
                print(f"      batch_size={bsize} chunk failed: {exc}")
        elapsed = time.perf_counter() - t0
        rate = len(sentences) / elapsed if elapsed > 0 else 0
        entry = {
            "batch_size":      bsize,
            "elapsed_s":       round(elapsed, 2),
            "rate_sent_per_s": round(rate, 2),
            "failures":        fail,
        }
        results.append(entry)
        if verbose:
            print(
                f"    batch_size={bsize:3d}  {elapsed:5.1f}s  "
                f"{rate:5.1f} sent/s  failures={fail}"
            )

    results.sort(key=lambda r: r['rate_sent_per_s'], reverse=True)
    return results


# ── Config writer ──────────────────────────────────────────────────────────────

# @fn write_config
def write_config(output_path: Path,
                 nllb_results: list[dict],
                 google_results: list[dict],
                 src_lang: str,
                 n_sentences: int,
                 cpu_cores: int) -> dict:
    """
    Build and write annotator_config.json.
    NLLB is recommended whenever the model is available (offline, 200 languages,
    no rate limits).  Google is the fallback when NLLB is not installed.
    """
    best_nllb   = nllb_results[0]   if nllb_results   else None
    best_google = google_results[0] if google_results else None

    # Always prefer NLLB when available: no rate limits, no API key, 200 languages
    if best_nllb:
        recommendation = "nllb"
    elif best_google:
        recommendation = "google"
    else:
        # No confirmed working translator. Default to google (network-only, no
        # native libs needed) so corpus_annotate.py can actually run.
        # If ctranslate2 is later installed and the model is present, re-run
        # this script to update the config.
        recommendation = "google"

    config = {
        "version":    "2.0",
        "benchmarked": date.today().isoformat(),
        "system": {
            "cpu_cores": cpu_cores,
        },
        "sample": {
            "src_lang":    src_lang,
            "tgt_lang":    "eng_Latn",
            "n_sentences": n_sentences,
        },
        "nllb": {
            "compute_type":    best_nllb["compute_type"]    if best_nllb else "int8",
            "inter_threads":   best_nllb["inter_threads"]   if best_nllb else 1,
            "intra_threads":   best_nllb["intra_threads"]   if best_nllb else 2,
            "beam_size":       best_nllb["beam_size"]        if best_nllb else 1,
            "rate_sent_per_s": best_nllb["rate_sent_per_s"] if best_nllb else None,
            "all_results":     nllb_results,
        },
        "google": {
            "batch_size":            best_google["batch_size"]      if best_google else 50,
            "delay_between_batches": 2.0,
            "rate_sent_per_s":       best_google["rate_sent_per_s"] if best_google else None,
            "all_results":           google_results,
        },
        "default_translator": recommendation,
    }

    output_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    return config


# ── CLI ────────────────────────────────────────────────────────────────────────

# @fn parse_args
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Benchmark NLLB-200 (and optionally Google) translation on this machine\n"
            "and save the optimal configuration to annotator_config.json.\n\n"
            "NLLB-200 covers ~200 languages through a single model — no per-language\n"
            "downloads needed.  corpus_annotate.py reads this config automatically."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        '--sample-file', metavar='FILE',
        help='.epub / .txt / .jsonl to draw test sentences from. '
             'Defaults to built-in sentences for the chosen --sample-lang.'
    )
    p.add_argument(
        '--sample-lang', default='zho', metavar='LANG',
        help='ISO 639-3 / BCP-47 language of the sample sentences (default: zho). '
             'Built-in samples available for: zho, tur, ara. '
             'Any language works with --sample-file.'
    )
    p.add_argument(
        '--sample-size', type=int, default=10, metavar='N',
        help='Number of sentences to use in the benchmark (default: 10). '
             '10 is sufficient for ranking configs; use 20+ for tighter speed estimates.'
    )
    p.add_argument(
        '--test-google', action='store_true',
        help='Also benchmark Google Translate (uses real API quota).'
    )
    p.add_argument(
        '--google-batch-sizes', default='25,50,100', metavar='N,N,...',
        help='Comma-separated batch sizes to test for Google (default: 25,50,100).'
    )
    p.add_argument(
        '--google-source-lang', default=None, metavar='LANG',
        help='Source language for the Google benchmark (defaults to --sample-lang).'
    )
    p.add_argument(
        '--nllb-dir', default=None, metavar='PATH',
        help='Path to the NLLB model directory (default: models/nllb/ next to this script).'
    )
    p.add_argument(
        '--output', default=None, metavar='PATH',
        help='Config output path (default: annotator_config.json next to this script).'
    )
    p.add_argument(
        '--quiet', '-q', action='store_true',
        help='Suppress per-run output; only print the final summary.'
    )
    return p.parse_args()


# @fn main
def main():
    args        = parse_args()
    script_dir   = Path(__file__).parent                    # source/scripts/
    project_root = script_dir.parent.parent                  # project root (LingCoT/)
    nllb_root    = Path(args.nllb_dir) if args.nllb_dir else project_root / 'source' / 'models' / 'nllb'
    output_path  = Path(args.output)   if args.output   else project_root / 'source' / 'config' / 'annotator_config.json'
    verbose     = not args.quiet
    cpu_cores   = os.cpu_count() or 1

    print(f"{'='*60}")
    print(f"  Corpus Optimizer  —  {date.today()}")
    print(f"  CPU cores: {cpu_cores}   NLLB model: {nllb_root}")
    print(f"{'='*60}\n")

    # ── Sample sentences ──────────────────────────────────────────────────────
    sample_file = Path(args.sample_file) if args.sample_file else None
    src_lang, sentences = load_sample_sentences(
        sample_file, args.sample_lang, args.sample_size
    )
    _log.info(f"Optimize started — cpu_cores: {cpu_cores} | nllb_root: {nllb_root} | output: {output_path}")
    print(f"Sample: {len(sentences)} sentences  (src={src_lang}  tgt=eng_Latn)")
    if not sentences:
        print("Error: no sample sentences. Provide --sample-file.", file=sys.stderr)
        _log.error("No sample sentences available — exiting.")
        sys.exit(1)

    # ── NLLB benchmark ────────────────────────────────────────────────────────
    model_dir = _find_nllb_model(nllb_root)
    if model_dir:
        print(f"\nNLLB benchmark  ({model_dir.name}, {args.sample_size} sentences):")
        print(f"  Testing {len(_NLLB_CONFIGS)} thread configs (beam=1) …\n")
        nllb_results = benchmark_nllb(nllb_root, sentences, src_lang,
                                      cpu_cores, verbose=verbose)
    else:
        print(f"\nNLLB model not found at {nllb_root} — skipping NLLB benchmark.")
        print("  Place model files under models/nllb/ to enable offline translation.")
        nllb_results = []

    # ── Google benchmark (optional) ───────────────────────────────────────────
    google_results = []
    if args.test_google:
        google_src = args.google_source_lang or args.sample_lang
        batch_sizes = [int(x) for x in args.google_batch_sizes.split(',') if x.strip()]
        print(f"\nGoogle benchmark  ({args.sample_size} sentences, batches={batch_sizes}):")
        google_results = benchmark_google(sentences, google_src,
                                          batch_sizes, verbose=verbose)

    # ── Write config ──────────────────────────────────────────────────────────
    config = write_config(
        output_path, nllb_results, google_results,
        src_lang, len(sentences), cpu_cores
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  Results:")

    if nllb_results:
        best = nllb_results[0]
        print(
            f"    NLLB best:    inter={best['inter_threads']} intra={best['intra_threads']}"
            f"  beam={best['beam_size']}  →  {best['rate_sent_per_s']:.1f} sent/s"
        )
        if len(nllb_results) > 1:
            worst = nllb_results[-1]
            speedup = best['rate_sent_per_s'] / max(worst['rate_sent_per_s'], 0.01)
            print(
                f"    Speedup over worst (inter={worst['inter_threads']} "
                f"intra={worst['intra_threads']} beam={worst['beam_size']}): "
                f"{speedup:.2f}×"
            )
    else:
        print("    NLLB: no results (model not installed or ctranslate2 missing)")
        print("          → corpus_annotate.py will fall back to Google Translate")

    if google_results:
        best_g = google_results[0]
        print(
            f"    Google best:  batch_size={best_g['batch_size']}"
            f"  →  {best_g['rate_sent_per_s']:.1f} sent/s"
            f"  (failures={best_g['failures']})"
        )
    elif args.test_google:
        print("    Google: no results")

    print(f"\n  Recommended default translator: {config['default_translator'].upper()}")
    _log.info(f"Config written: {output_path} | recommended: {config['default_translator']}")
    print(f"\n  Config written to: {output_path}")
    print(f"  corpus_annotate.py will use this config automatically on the next run.")


if __name__ == '__main__':
    main()
