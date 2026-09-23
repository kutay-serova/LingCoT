# LingCoT — Quickstart

**Updated:** 2026-09-23 · **Version:** v3.14.419

**A guided first session.** You will build a corpus from your own text and try
each of the things LingCoT does: glossing, the dictionary, translation,
dependency parsing, search, and getting your work back out.

Work through it in order — each part uses what the one before it made. Half an
hour, unhurried.

Not installed yet? Do [Setup](setup.md) first. Everything in full detail is in
[README.md](README.md); this is the tour, not the reference.

**Have a short text ready**, in the language you work on. A paragraph or two is
plenty, and your own material is far better than a sample.

**If you get lost, click `?`** at the top right of any screen. It explains
whatever you are looking at.

---

# Part 1 · Your first corpus

## 1 · Open LingCoT

Double-click **`LingCoT.command`** (macOS) or **`LingCoT.bat`** (Windows).

*macOS may refuse the first time. Right-click the file → **Open** → **Open** in
the dialog that appears. Once only.*

Choose **New Corpus** on the home screen.

## 2 · Say who you are, and what the text is

**Add yourself as an annotator first** — the button is right on the form.
LingCoT records who made every annotation and will not save an edit from
nobody, so this is the one step that will stop you if you skip it.

Then fill in:

- **Title** — anything. *Field notes, March* is fine.
- **Language** — a name or a code both work: `Turkish`, `tur` and `tr` are all
  understood, and if it cannot place what you typed it suggests close matches.
- **Translation language** — the language *you* write translations in. Often
  English, but a Hawaiian project may well document into Hawaiian.

Click **Save**. When LingCoT offers to **autosave**, say **yes**.

## 3 · Put your text in

You are on the document view. Click **Add Section** — a section is a chapter, a
story, one recording session; whatever division suits your material.

Give it a title, then **paste your whole text into the Section text box.** Do not
break it up by hand:

- **blank lines** become paragraph breaks
- **. ! ?** and their equivalents in other scripts become sentence breaks
- **spaces** become word breaks

Click **Save**. Your text is now a corpus you can click into: sections,
paragraphs, sentences, words.

*Languages written without spaces — Chinese, Japanese, Thai — get empty word
slots instead, for you to fill by hand. That is expected, not a fault.*

---

# Part 2 · Annotating

## 4 · Gloss your first word

Click a paragraph, then a sentence. You will see the sentence, room for its
translation, and the interlinear gloss beneath it.

**Click a word**, then **Edit**. Nothing here is required and you can always come
back, so fill in what you know:

- **Transliteration** — a romanization, or any other script you work in. Give
  the scheme a name if you use more than one.
- **Part of speech** — a chip row, so it is one click.
- **Word Gloss** — what the whole word means. Type an **uppercase** sequence
  such as `NOM`, `PST` or `PL` and a panel of standard Leipzig abbreviations
  opens; click one to insert it. Leave it blank and it is composed from the
  morphemes below instead.
- **Morphological parse** — the word split into parts, written with hyphens:
  `bahçe-DA`. Saving this creates the morpheme rows below, each with its own
  gloss.
- **Lemma** — the dictionary form. It comes last because it is read off the
  stem, which the parse gives you.

Click **Save**.

**Notice where you land: the next word, ready to type.** Saving advances, which
is the rhythm the whole app is built around. **← →** and the arrow keys move the
same way, across paragraph and section boundaries, skipping punctuation.

## 5 · Build a dictionary as you go

This is the part that repays itself, so it is worth doing early.

Open a word that has morphemes. Beside each morpheme row is a **+ dict** button —
it opens an editable entry rather than writing silently, so you can see and fix
what gets stored. Add a couple of the parts you have just glossed: a stem, a
suffix.

Now open **a different word that shares one of those parts.** Above the fields a
strip of suggestions appears, marked **take:** — one chip per dictionary entry
that fits. Click a chip and it does the work: an entry whose form sits inside
this word splits the word there, giving you the parse without typing it; one that
matches a parse you already have fills in its gloss and transliteration.

The more you enter, the less you type. The **Dictionary** badge at the top right
opens the browser, where you can edit entries, merge two that turned out to be
the same, and **Link unlinked tokens** to connect words you glossed before the
entry existed.

---

# Part 3 · The sentence

## 6 · Translate

In sentence view, click **Translate** for a machine draft to correct rather than
type from nothing. It needs an internet connection, or the optional offline model
(see [setup.md](setup.md)).

A machine translation is marked as machine-made, so it never gets mistaken later
for something you wrote.

## 7 · Parse a sentence

Open the **Dependency Parse** section. Give each word a **head** — the word it
hangs from — and a **relation** naming the link (`nsubj`, `obj`, `amod`…). The list is a
starting point, not a fence: you may type a relation that is not in it.

**Exactly one word has no head.** That is the root, and leaving it blank is how
you say so.

An **arc diagram** draws the result above the sentence, stacking arcs so crossing
dependencies stay readable.

**Add selection** is the other half of this: pick two or more words and
record what connects them — determination, quantification, agreement — for
annotation that is about a *relationship* rather than a property of one word.

---

# Part 4 · What your corpus can tell you

## 8 · Search it

Click **Search** in the header. Four controls decide what is searched:

- **Field** — Text, Gloss, Transliteration, Translation, or Lemma
- **Level** — Word, Morpheme, or Sentence
- **Scope** — within one sentence, or across a sentence boundary
- **Transliteration label** — when you have more than one scheme

Patterns match a whole token by default: `get` finds `get` and nothing else. Then

| | |
|---|---|
| `*` | any sequence — `getir*` finds `getir`, `getirildi`, `getiriyor` |
| `(x)` | optional — `(un)happy` finds both |
| a space | consecutive words — `bir ev` |
| `<BREAK>` | across a sentence boundary |

There is a **regex** toggle if you want one.

**Lemma search is different in kind.** It finds dictionary entries, then every
token belonging to them — so searching `gitmek` finds `gidiyor` and `gitti`,
by membership rather than by spelling.

Read the hits three ways: **Concordance** (each hit centred in its context —
sorting by the word to the right is how you see what a form keeps company with),
**Frequency** (counts, by form and by section), and **Collocates** (what occurs
nearby). Click any result to jump to that sentence.

## 9 · See what is left

Click **Progress** in the header. It counts what is still unannotated, and
clicking a row takes you to the first item that needs it.

It counts honestly: a field that does not apply to your language is not
"missing", and neither is one that is derived. You choose what it tracks, so it
follows your priorities rather than the software's.

---

# Part 5 · Getting your work out

## 10 · Export

- **LaTeX**, in sentence view, copies the sentence as a ready-to-paste
  interlinear gloss, in both `linguex` and `gb4e` form.
- **Export PDF**, in the dictionary browser, prints the current filtered list
  with the fields you choose. *(An optional install — see [setup.md](setup.md).)*

## 11 · Where your work lives

In a **`LingCoT-Data`** folder inside your home folder — **never inside the
LingCoT application folder.** Back up `LingCoT-Data`; copying the application
folder will not save your work.

With autosave on, edits reach disk about half a second after you make them, and
the top of the window flashes **✓ Autosaved**. **File → Save** opens **Project
Files**, where autosave and file locations live.

To reassure yourself: close LingCoT, open it again, choose **Open Corpus File**,
and pick your corpus. Everything should be as you left it.

---

## What I would like to hear about

This is a first tester's build. The most useful report is not only "it broke":

- **Where did you stop?** Any moment you did not know what to click next is worth
  more to me than a crash, and much harder for me to find on my own.
- **What did you expect a field to mean?** Especially *type*, *transliteration*,
  and the difference between a word's gloss and its morphemes' glosses.
- **What order did you want to fill things in?** The forms ask in a fixed order,
  and I want to know whether it matches the order you actually work in.
- **Which of the parts above did you not reach?** If you never got to search or
  the dictionary, that tells me something about the first four parts.
- **Anything that made you afraid of losing work.**
- Crashes and wrong output, of course — please say which sentence or word.

You cannot break anything outside your own corpus folder, and you can always
start again with a new corpus.

## Then what

- [README.md](README.md) — every view and field, in full
- [setup.md](setup.md) — offline translation and PDF export, both optional
- The `samples` folder inside the application folder holds two finished corpora,
  Turkish and Mandarin. Open one to read it rather than to edit it.
