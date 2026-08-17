# `reference/` — the engraving library, kept OFF the repo

**The files beside this one are gitignored and this README is not.** That split is the whole point:
the sources are third-party publications and do not belong in a git history, but *knowing which ones
exist, what each answered, and how to fetch it again* is the part that keeps costing us agent-hours
to rediscover. So the manifest is committed and the bytes are not.

⚠️ **Local research copies.** Nothing here is ours, nothing here gets redistributed, and nothing here
is quoted into user-facing output beyond what a citation needs.

## Why this directory exists at all

Every engraving number in `src/engine/rendering/` is supposed to cite a rule rather than a taste
(`docs/DESIGN-PRINCIPLES.md`, and the standing instruction that an invented rule *will* be caught).
That only works while the sources are reachable — and on **2026-08-17** the one we had leaned on
hardest stopped being reachable, mid-investigation, having already supplied most of the Gould
quotations now sitting in `docs/slur-plan.md`. Two agents spent a large part of their budget
rediscovering that it was gone. This directory is so the third one does not.

## What is here

| file | what it is | where it came from |
|---|---|---|
| `gerou-lusk-essential-dictionary-of-music-notation.pdf` / `.txt` | **Gerou & Lusk, *Essential Dictionary of Music Notation*** (Alfred, 1996), 82pp, complete. The one full treatise we hold. Slurs at pp. 121–124: placement by stem direction, "starts mid-stem, to the right of the stem", "never cross the beam with a slur", slope follows the phrase. | openly hosted: `musescore.org/sites/musescore.org/files/2022-02/EssentialDictionaryOfMusicNotation_0.pdf` |
| `gould-scans/gould.png`, `gould_good.png`, `gould_bad.png` | **Gould, *Behind Bars*, p. 111** — a scan of the printed page: the opposite-stem rule AND both music examples. ⭐ The examples are the payoff: they can be MEASURED, which is how we learned her drawing disagrees with the formula attributed to her. | scoringnotes.com, "Better Sibelius slurs for opposite stem direction on outer notes" |
| `gould-scans/att2528.jpg`, `att2528_music.png` | **p. 111, a second scan** carrying the qualifier sentence *"The slur should not, however, move too close to noteheads if there is room for it to be further away."* | notat.io thread `t=635`, posted by John Ruggero |
| `musescore-slurs-and-ties-handout.pdf` | 4pp MuseScore user handout. Minor; kept for completeness. | MuseScore docs |
| `using-sibelius-effectively-sample.pdf` | 20pp **SAMPLE** of *Using Sibelius Effectively*. ⚠️ A sample, not the book. | publisher sample |

## ⭐⭐ How to reach Gould now — the routes that work, and the one that does not

⛔ **`archive.org/details/behind-bars-by-elaine-gould` IS DEAD** (HTTP 200 with an empty `{}`
metadata body = a darkened item; `/download/` 404s, and the stale search index still lists it, which
is what makes agents keep trying). The lending IDs `behindbarsdefini0000goul`, `behindbars0000goul`,
`behindbarsguidet0000goul` are all empty too. **Do not send an agent at it.** Ted Ross
(`artofmusicengrav0000tedr`) went the same way — "Item not available", 403 even on search-inside.

⭐ **Google Books search-within-volume — verbatim text WITH page numbers, and reproducible:**

```
https://books.google.de/books?id=yBK_DwAAQBAJ&jscmd=SearchWithinVolume&num=100&q=<short+term>
```

with a browser User-Agent and `Referer: https://books.google.de/`. Returns
`{page_number, snippet_text}`. Caveats that decide whether it works:

- ⛔ **Not** `googleapis.com/books/v1` — quota-exhausted, returns 429.
- ⚠️ **Short terms only.** A long exact phrase returns zero hits; search two or three words and read
  the snippet around them.
- ⚠️ `…` in a snippet is a **real elision** — never quote across one.
- OCR inserts spaces around hyphens (`stave - space`).

⭐ **Third-party page scans, for anything with a picture.** Snippets are prose only; when the
question is *what did she draw*, find a scan. `scoringnotes.com` and the `notat.io` forum (needs a
browser UA — `WebFetch` gets 403) both reproduce printed pages, and notat.io additionally quotes
house styles **with numbers** and Ross with page numbers.

## ⭐ Adding a source

When a hunt turns up something real, it lands here — and **the row in the table above is the part
that matters**, not the file. A PDF nobody knows we have is worth the same as no PDF.

1. Drop the file in (or a `*-scans/` subdirectory for page images). It is gitignored by the
   `reference/*` + `!reference/README.md` pair in `.gitignore`; nothing further is needed.
2. **Add its row**: what it is, *which questions it actually answered*, and the URL it came from.
   The middle column is the one a future reader searches on — "Gerou & Lusk" means nothing to
   someone looking for whether a slur may cross a beam.
3. If it made a repo claim checkable, or refuted one, say so in the row. That is how
   `docs/slur-plan.md` and the `src/engine/rendering/` doc comments stay honest about *which* source
   each number came from.
4. ⛔ **A scan beats an OCR whenever the question is "what did they DRAW".** Snippet APIs return
   prose only, and a book's engraving can be measured — that is how Gould's p. 111 examples were
   found to disagree with the formula attributed to her. Keep the images.

⚠️ **Do not add something we cannot cite.** A file with no traceable origin is worse than nothing: it
reads as authority and cannot be checked, which is the exact failure mode this whole discipline
exists to prevent.

### ⭐ What an agent SHOULD pick up, and where the budget goes to die

**Take what you legitimately find.** A publicly readable archive.org item, a Google Books volume, a
publisher's sample, a PDF a project hosts openly (which is how we have Gerou & Lusk), a page a
library or a forum reproduces under quotation — use it, keep it, add its row. ⛔ **This directory
existing is not a reason to skip a source you found in passing**; the archive.org copy of *Behind
Bars* was exactly that kind of find, and it carried the slur and hairpin research for two days.

⛔ **What is NOT worth an agent's time is the file-locker sweep.** On 2026-08-17 one agent worked
through idoc.pub, vdoc.pub, kupdf, pdfcoffee, pdfdrive and a row of libgen mirrors looking for
*Behind Bars*. It spent the larger part of a **2.9-million-token, 50-minute** run on it and came back
with **nothing** — while the two routes that actually produced verbatim, page-numbered quotations
that same hour were Google Books and a forum thread. So: if a source is openly and plainly
available, take it; if it is only on mirrors, that is the signal to change tactic, not to keep
digging. The rules we need are answerable from snippets, scans and engravers who own the book.

## Still missing — UNKNOWN, not silent

**Ted Ross** *The Art of Music Engraving*, **Kurt Stone** *Music Notation in the Twentieth Century*,
**Gardner Read** *Music Notation*, **Chlapik** *Die Praxis des Notengraphikers* (no digital copy is
known to exist), and Boosey & Hawkes' house manual. ⛔ When one of these would have answered a
question, the honest report is **UNKNOWN** — never "the books are silent". The single sentence of
Ross we hold is second-hand, relayed by Ruggero on notat.io: *"Long slurs always start and end over
or under the center of a notehead"* (p. 141).

❌ **MOLA's Guidelines for Music Preparation genuinely say nothing** about slurs, ties or hairpins —
verified by extracting the whole PDF twice. Stop checking it.
