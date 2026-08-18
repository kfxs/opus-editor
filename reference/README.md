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
| ⭐⭐ `Behind Bars The Definitive Guide to Music Notation (Elaine Gould) (z-library.sk, 1lib.sk, z-lib.sk) (2).pdf` | **Gould, *Behind Bars*, THE WHOLE BOOK** — 696 PDF pages, 249 MB, scanned with an OCR text layer. Added **2026-08-17 16:25**, i.e. *after* the "how to reach Gould" section below was written. ⭐ **This is now the first stop for any Gould question.** What it has answered so far: the BELOW-STAFF LADDER (p. 29 octave signs incl. the whole-system exception; p. 101–102 dynamics go OUTSIDE octave signs, with the drawn correct/incorrect pair; p. 332–333 pedal below all other notation + Table 2's pedal stacking order; p. 337 a drawn `8`-under-`Ped.`-under-`Sost. Ped.` stack); the pedal's HORIZONTAL anchor (p. 333 *"depressed at the beginning of its symbol"*, p. 335 the roman-vs-traditional A/B pair, p. 336 half-pedalling — measured, 2026-08-18, see the second Q&A table below); and **TRILL vs SLUR** (p. 135 *"further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave"*, p. 121–122 the articulation-vs-slur endpoint rule, plus measured engravings on pp. 135/138/381 — third Q&A table below). | added by hand, 2026-08-17 |
| ⭐ `gould-behind-bars-fulltext.txt` | **Gould's whole OCR text layer, extracted** — 983 KB, 44,617 lines, the same book as the PDF above. ⭐ **GREP THIS FIRST**: finding which page discusses something took page-by-page rendering before, and this answers it in a second. ⚠️⚠️ **It is DIRTY OCR and ⛔ NOT quotable as it stands** — the first lines alone read `IVE G333”DE TO MU`, `FABERﬂMUSIC`, `Padstnw`. Use it to LOCATE a page, then render that page (`pdftoppm -r 450`) and read the scan for the wording. ⛔ And for anything DRAWN the scan is the only authority — a picture has no text layer. ⚠️ Page numbers are not marked in it; find the printed number on the rendered page. | extracted from the PDF above, 2026-08-18 |
| `gerou-lusk-essential-dictionary-of-music-notation.pdf` / `.txt` | **Gerou & Lusk, *Essential Dictionary of Music Notation*** (Alfred, 1996), 82pp, complete. The one full treatise we hold **besides Gould**. Slurs at pp. 121–124: placement by stem direction, "starts mid-stem, to the right of the stem", "never cross the beam with a slur", slope follows the phrase. Also: **damper pedal, p. 105** — *"always placed below the grand staff and are usually placed below all other musical elements"* (our second, independent source for the pedal being the outermost family); **octave signs, p. 98** — *"as close to the notes affected as possible"*, `8vb` is *"only a copyist's shorthand and should not be used in engraved music"*, and a drawn example putting the `8va` outside a slur. ⭐⭐ **pedal marks, pp. 105–107** — the one source that states the horizontal anchor OUTRIGHT: pedal-down at the notehead's **left edge**, pedal-change at its **centre**, pedal-up **flush left** with it, end-of-piece at the **final double barline's thin line**. ⭐ The `.txt` is already extracted — grep it before opening the PDF. | openly hosted: `musescore.org/sites/musescore.org/files/2022-02/EssentialDictionaryOfMusicNotation_0.pdf` |
| `gould-scans/gould.png`, `gould_good.png`, `gould_bad.png` | **Gould, *Behind Bars*, p. 111** — a scan of the printed page: the opposite-stem rule AND both music examples. ⭐ The examples are the payoff: they can be MEASURED, which is how we learned her drawing disagrees with the formula attributed to her. | scoringnotes.com, "Better Sibelius slurs for opposite stem direction on outer notes" |
| `gould-scans/att2528.jpg`, `att2528_music.png` | **p. 111, a second scan** carrying the qualifier sentence *"The slur should not, however, move too close to noteheads if there is room for it to be further away."* | notat.io thread `t=635`, posted by John Ruggero |
| ⭐ `the art of music engraving and processing (ted ross) (z-library.sk, 1lib.sk, z-lib.sk).pdf` / `ross-art-of-music-engraving-fulltext.txt` | **Ted Ross, *The Art of Music Engraving and Processing*, THE WHOLE BOOK** — 292 PDF pages, 13.6 MB, clean OCR layer; the `.txt` is 387 KB, extracted 2026-08-18. ⭐ **PAGE OFFSET: PDF page = printed page + 12** (calibrated PDF 199 = printed 187). What it has answered: **dynamics typography, p. 186** — *"the height of the ƒ is two and a half spaces, the **p** two spaces and the **m** one space"* (independently confirms Gould p. 101); **the wedge, p. 187** — *"Each of the lines that form the wedge shape is no thicker than a staff line. The width of the open end of the wedge is no more than a space and a half"* (⚠️ **Ross 1.5 sp vs Gould's 2 sp maximum, p. 103** — a real disagreement, and Gould's own drawings measure 1.51/1.56 sp, i.e. she engraves Ross's number), plus *"a sign is generally not used for a passage longer than three measures"*; **the four sign-with-mark rules, pp. 187–188**, of which ⭐⭐ **rule 3 — *"A mark should be aligned horizontally with a sign"*** — is the clearest one-sentence statement of the dynamics-line rule in any book we hold; p. 188 rule 4 covers hairpins across a system break. ⛔ The old second-hand p. 141 slur sentence below is superseded — read the book. | added by hand, 2026-08-18 10:00 |
| `Music Notation in the Twentieth Century A Practical Guidebook (Kurt Stone) (…).pdf` / `stone-notation-20th-century-fulltext.txt` | **Kurt Stone, *Music Notation in the Twentieth Century*, THE WHOLE BOOK** — 189 PDF pages, 88 MB; `.txt` 504 KB, extracted 2026-08-18. ⚠️ Dirtier OCR than Gould's (`Iyp ical`, `sp ace`). ❌ **What it does NOT answer, checked 2026-08-18 so nobody repeats it: hairpins.** His index has **no entry at all** for crescendo, diminuendo, wedge or hairpin; dynamics are pp. 16–19 (absolute vs individual, boxed, `±`, *subito*, niente, note-size dynamics) and pp. 32–33 (which side of the stave). Nothing on hairpin geometry or on a dynamic colliding with one. | added by hand, 2026-08-18 10:00 |
| `musescore-slurs-and-ties-handout.pdf` | 4pp MuseScore user handout. Minor; kept for completeness. | MuseScore docs |
| `using-sibelius-effectively-sample.pdf` | 20pp **SAMPLE** of *Using Sibelius Effectively*. ⚠️ A sample, not the book. | publisher sample |

## ⭐⭐ Gould is ON DISK — how to page into 249 MB without drowning

**Added 2026-08-17.** ⛔ **Read this before the web section below it**, which was written on 2026-08-17
at 12:09, four hours before the book arrived, and which sent one agent at Google Books for a question
the PDF answers directly.

- **⭐ THE PAGE OFFSET: `PDF page = printed page + 20`.** Calibrated against three landmarks — PDF 50 =
  printed 30 (*Across a system break*), PDF 122 = printed 102 (*Dynamics and articulation*), PDF 353 =
  printed 333 (*Piano notation: Pedalling*). 696 PDF pages, printed body runs to ~676.
- **Find the page cheaply, in text.** `pdftotext -f <pdf> -l <pdf> "<file>" -` on a range, or extract
  the whole book once — `pdftotext "<file>" gould.txt` takes ~1 s and yields ~980 KB — and grep that
  **in the scratch dir, never in the repo**. ⚠️ It is OCR: italics, music glyphs and the tables come
  out as noise (`ottavn bassn`, `92w` for `Ped.`), so grep on plain prose words.
- **⛔ The Read tool cannot open this PDF** — "exceeds maximum allowed size for text extraction
  (100MB)". **Render the page to PNG instead** and Read *that*:
  `pdftoppm -f <pdf> -l <pdf> -r 450 -png "<file>" out` (~0.2 s/page at 450 dpi, ~2765×4147 px).
- **⭐⭐ Then MEASURE it.** At 450 dpi one stave-space is **20 px**, so a per-row ink profile over an
  x-window turns any figure into stave-spaces: find the five staff lines (the rows with a huge ink
  count), then read off the rungs below them. That is how p. 102's and p. 337's ladders were measured
  (`docs/`-facing numbers, 2026-08-17). ⛔ `numpy` is not installed — plain PIL `load()` loops are
  fast enough on one page.

## ⭐⭐ How to reach Gould when the PDF is not to hand — the routes that work, and the one that does not

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

- ✅ **Re-verified live 2026-08-17 ~18:45** (`q=octave+sign`, `q=pedal+line`, `q=pedal+dynamics` all
  returned page-numbered snippets). It is how printed pp. 29 / 101 / 332 were *located* before the
  local PDF was known about — a good index, a poor reader.
- ⛔ **Not** `googleapis.com/books/v1` — quota-exhausted, returns 429.
- ⚠️ **Short terms only.** A long exact phrase returns zero hits; search two or three words and read
  the snippet around them.
- ⚠️ `…` in a snippet is a **real elision** — never quote across one.
- OCR inserts spaces around hyphens (`stave - space`).

⭐ **Third-party page scans, for anything with a picture.** Snippets are prose only; when the
question is *what did she draw*, find a scan. `scoringnotes.com` and the `notat.io` forum (needs a
browser UA — `WebFetch` gets 403) both reproduce printed pages, and notat.io additionally quotes
house styles **with numbers** and Ross with page numbers.

### What was asked of it on 2026-08-17, and what came back

The question was the **below-staff ladder**: does an `8vb` bracket, and does the sustain pedal, sit
inside or outside the dynamics? Recorded here because the answer contradicted our pass order.

| asked | source | answer |
|---|---|---|
| 8vb vs dynamics, below the staff | **Gould p. 101** (prose) | *"other markings — such as those for articulation, slurs, **octave signs** and tuplet brackets — are **required to be closer to notes**, so add these markings to the music **before positioning dynamics**"*. So the bracket is INSIDE. |
| the same, as a PICTURE | **Gould p. 102** (top figure) | The drawn correct/incorrect pair, and it is an ottava **bassa** under the staff with hairpins. Correct: slurs · `8- - -⌐` · `f< sf> p<` outward. **"but not"**: the dynamics tucked under the staff and the `8` pushed outside them. Measured at 450 dpi: dashed line **4.0 sp** below the bottom staff-line, dynamic ink from **≈5.5 sp**. |
| the exception | **Gould p. 29** | *"Place an extension line **for a whole system** outside all other notation (notes, short slurs, articulation and dynamics) … information that potentially changes (e.g. dynamics) is better placed closer to the stave. **Only tempo markings and piano pedal indications remain outside** an octave extension line that continues for a whole system."* ⭐ A whole-system line INVERTS the p. 101 order. |
| pedal vs everything | **Gould p. 332** | *"Place these beneath the lowest stave of the system, **below all other notation including an 8va bassa sign**."* Table 2's order = damper, sostenuto, una corda, staff-outward, *"this reflects their physical layout"*. |
| the same, as a PICTURE | **Gould p. 337** (2nd figure) | `8- - -⌐` under the bass staff, `Ped.` line below it, `Sost. Ped.` line below that. Measured: **3.25 / 7.25 / 10.5 sp** below the bottom staff-line. |
| the same, second source | **Gerou & Lusk p. 105** | *"always placed below the grand staff and are **usually placed below all other musical elements**."* |
| ⛔ pedal vs dynamics **as a picture** | — | **UNKNOWN.** Every pedal figure in Gould pp. 333–338 is piano, where dynamics go *between* the staves (p. 323), so the two never share a side. Only the prose above covers it. |

### What was asked of it on 2026-08-18, and what came back

The question was the pedal's **HORIZONTAL** anchor: where does `Ped.` sit relative to the note whose
sounding it sustains? Answered from the local Gould PDF (prose **and** measured engravings) plus
Gerou & Lusk, which turns out to state the rule outright.

| asked | source | answer |
|---|---|---|
| ⭐⭐ where does `Ped.` start | **Gould p. 333** (prose) | *"Pedal indications must be vertically aligned precisely beneath the relevant notes. **The pedal is depressed at the beginning of its symbol: on the 'P' of 'Ped.', on the 'S' of 'Sost. Ped.'** The upward vertical of an extension line most accurately indicates release points"*. |
| the same, as a PICTURE | **Gould pp. 333/335/336** (4 figures) | ⭐⭐ Measured at 450 dpi (1 sp = 20 px): the **leftmost ink of `Ped.` = the leftmost ink of the notehead**, Δ = **0 / −0.5 / −1 / +3 px** across four engraved instances, i.e. within **0.15 sp**. That puts it ≈ **0.55–0.70 sp LEFT of the notehead centre**. ⛔ NOT centred, NOT at the stem. |
| the same, second source | **Gerou & Lusk p. 105** | *"The **pedal-down marking begins vertically aligned with the left edge of the notehead**."* (figure captioned *"begin left of the notehead"*), with the footnote *"Some publishers center or align flush right. In any case, a style decision should be made."* |
| the pedal CHANGE / retake `Λ` | **Gerou & Lusk p. 105** + **Gould p. 335** (figure) | *"The point of the pedal-change marking is vertically aligned with the **center** of the notehead."* Gould's drawn retake apexes measure **1281 vs notehead centre 1281** and **1542 vs 1541** — the centre, to 0.08 sp. ⭐ So DOWN and CHANGE do **not** share an anchor. |
| the release, horizontally | **Gould p. 335** (prose) | *"When the pedal is released at the end of a bar and is not re-activated immediately, **the release sign aligns with the barline**. When a barline precedes a new attack, the release or retake sign aligns with, **or just after**, the following notes."* Measured: the p. 335 terminal upright sits **0.15 sp** left of the barline (flush against it); the p. 336 `✻` is **centred on** the rest it clears (centre 2264 vs 2264.5). |
| the same, second source | **Gerou & Lusk pp. 106–107** | pedal-up *"is vertically aligned **to the left of** the notehead"* (*"end flush left with the notehead"*); at the end of a piece *"aligned with the **thin line of the final double barline**"*; across a system break it begins *"immediately after the key signature"*. |
| ⭐ why roman `Ped.` and not `℘ed.` | **Gould p. 335** (prose + the A/B pair) | *"to show very precise alignment, an ordinary roman typeface is recommended … This allows a **vertically stemmed 'P'** to align more precisely under notes than the traditional sign"*. Measured on that very pair (same music, both styles): roman `Ped.` left ink = notehead left ink **exactly**; the ornate `℘ed.` starts **0.40 sp further left** because of its opening swash. Her own drawing demonstrates the sentence. |
| ⛔ Read / Stone / Ross on this | — | **UNKNOWN** — not on disk, and the archive.org routes for Ross and Gould are dead (above). Not checked online. |

### What was asked of it on 2026-08-18 (second question), and what came back

The question was the **TRILL vs the SLUR**: when a `tr` (with or without its wavy line) sits on a note
inside a slur's span, which mark is further from the stave — and what changes when the trilled note is
the slur's **first or last** note? Answered from the local Gould PDF: **one decisive sentence**, plus
**two engraved examples that were measured**. ⭐ The answer turns on the slur's **LENGTH**, which is why
the articulation rule alone does not settle it.

| asked | source | answer |
|---|---|---|
| ⭐⭐ the ladder at a trilled note | **Gould p. 135** (prose, *Trills → Design and placing*) | *"The trill (Italian: trillo) is represented by a stylized sign in bold italic: **tr**. The sign is always positioned above the stave except in double-stemmed writing. Place the sign flush with the left-hand edge of the notehead, **further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave.**"* ⭐ So: a **LONG slur arches OVER the trill**; everything else on that side (all articulation) stays **inside** it. |
| ⭐ therefore a SHORT slur | inferred from the same sentence + drawn twice (below) | The exemption names a **long** slur only, so a **short slur passes UNDER the trill** — the trill sits above it. ⚠️ Gould never defines "long"; both her drawn counter-examples are one-bar slurs. |
| the same, as a PICTURE (⭐ the ENDPOINT case) | **Gould p. 138**, ex. **(d)** of *Starting and finishing notes* | A trilled minim carrying `tr〜〜〜`, a slur **starting on that very trilled note** and running over the finishing grace notes to the next note. Measured at 450 dpi (1 sp = 20.1 px, above the top staff-line): `tr` glyph **3.0–4.1 sp** · wavy line **2.9–3.3 sp** · slur, in the x-window it shares with the wavy line, **1.5 → 2.3 sp**, apex **2.46 sp**. ⭐⭐ **The trill is OUTSIDE the slur by ≈0.55–1.35 sp, even though the trilled note is the slur's FIRST note.** |
| the same, second PICTURE | **Gould p. 381** (guitar, *Trills and two-note tremolos*, middle example) | A dotted *ligado* slur from the measured note to the bracketed trilling note, under a `tr〜〜〜`. Measured at 300 dpi (1 sp = 13.25 px): wavy line **2.6–3.1 sp**, dotted slur **0.15–1.13 sp** — the slur ≈**1.5–2.5 sp INSIDE** the trill line. |
| the WAVY LINE specifically | **Gould pp. 136–137, 139** | No separate vertical rule: the line is *"a shaded, wavy line, **placed directly after the trill sign**"*, i.e. it inherits the sign's height, and both measured examples above show the line — not just the `tr` — riding outside the curve. p. 139's *Change of trilling note* draws **ties** hugging the noteheads with the wavy line above them. ⛔ Gould nowhere discusses a wavy line **crossing** a slur's arc. |
| ⭐ the articulation rule, for comparison | **Gould pp. 121–122** | *"Usually, only tenuto lines and staccato marks may go inside the first and last notes of a slur"* (p. 121) and *"**Articulation marks in the middle of a slur go inside the slur. Accents at the beginning and end of a slur usually go outside the slur, so that the slur can remain closer to the noteheads**"* (p. 122), with the exception *"when they would otherwise be too far from a note to be immediately apparent"*. ⭐ This **CONFIRMS Gerou & Lusk** (`gerou-lusk-…txt`, Slurs) on both halves — mid-span inside, endpoints outside. |
| ⛔ does the ORNAMENT follow the ARTICULATION rule? | **NO** — Gould p. 135 vs p. 122 | The trill has its **own rung**, one step further out than every articulation mark, and it does **not** flip at the slur's endpoints the way an accent does. Her p. 138 (d) drawing is an endpoint case and the trill is outside there too. |
| the ladder as a PICTURE | **Gould p. 135** (double-trills figure, top-left) | Measured at 450 dpi above the stave: accent `>` **4.0–4.5 sp** · `tr〜〜〜` **5.9–6.4 sp** · hairpin + `f`/`p` **8.3–9.9 sp**. ⭐ Engraves the sentence: notehead → articulation → trill → dynamics. Combined with p. 101, the full above-stave order is **articulation → trill → long slur → octave sign → dynamics**. |
| a general "short slur hugs the notes" statement | **Gould p. 436** (vocal) | *"A short slur is usually best placed close to the noteheads, regardless of whether articulation appears above or below the stave"*. ⚠️ Said of **syllabic** slurs in vocal music, so it is corroboration, not the general rule. |
| ⛔ a LONG slur drawn over a trill | — | **UNKNOWN** — no such engraving was found. Searched every page of Gould that names both *slur* and *trill*/*ornament* (printed pp. 130, 135, 138, 229, 309, 381) plus the whole trills section pp. 134–140 and the slurs section pp. 109–114. The long-slur case rests on the p. 135 sentence alone. |
| ⛔ MORDENT / TURN / other ornaments | — | **UNKNOWN.** Gould's index sends `ORNAMENT 84–5, 504` → *see also trill*, and pp. 84–85 are about **accidentals** affecting ornaments, not placement. Only the trill gets a ladder rung. Gerou & Lusk's Trill entry likewise says only that *"the tr is always placed above the note, regardless of stem direction"* — silent on slurs. |
| ⛔ Read / Stone / Ross on this | — | **UNKNOWN** — not on disk; the archive.org routes are dead (above). Not checked online. |

### What was asked of it on 2026-08-18 (third question), and what came back

The question was the **DYNAMIC vs the HAIRPIN**: what happens when a dynamic mark falls inside a
hairpin's span, or hard against one of its ends? Answered from Gould (prose **and** measured
engravings), Ross and Gerou & Lusk — ⭐ the first question this library has answered from **four**
books at once, and the first where **Ross and Stone were read from disk**.

⭐⭐ **Gould's hairpin chapter is printed pp. 103–108** (index: `HAIRPINS 103–8, 323–4`), PDF 123–128
at the standing +20 offset: p. 103 typography/aperture/barline breaks · p. 104 horizontal placing +
**the shortening parenthesis** · p. 105 through barlines + **HORIZONTAL ALIGNMENT, with an
`incorrect` counter-example** · p. 106 signs vs text · **p. 107 INTERIM DYNAMICS** · p. 108 separator
strokes. ⛔ pp. 323–4 is keyboard-only (hairpins vs double-stemmed beams) and does not bear on this.

| asked | source | answer |
|---|---|---|
| ⭐⭐ a dynamic INSIDE a hairpin's span | **Gould p. 107** (prose + a drawn `and`/`not` pair) | *"A hairpin may be broken for an interim dynamic. **Maintain the same angle for the hairpin either side of the interim dynamic**, so that the hairpin is clearly one gradual dynamic change. It is unnecessary in this case to enclose the interim dynamic in brackets…"*. ⭐⭐ MEASURED at 450 dpi: extrapolating the first wedge's two edges across the `mf` lands within **0.14 sp** of where the second wedge's edges start — the two halves are **one wedge with a slice cut out of it**. The `not` drawing collapses 2.06 sp → 0.55 sp across the letter and doubles the angle. |
| the glyph inside the wedge's MOUTH | **Gerou & Lusk p. 61** + **Ross p. 187** | *"Musical elements should not be placed within the opening of the signs"* (drawn struck-through); *"A term should not be hidden inside a wedge; nor should it destroy the artistry of the work by causing the wedge to open too wide."* Gould p. 106 says the same of qualifying TEXT. |
| ⛔ a NON-transitional dynamic mid-span (an isolated `sf` inside a cresc.) | — | **UNKNOWN.** No prose and no drawing in Gould pp. 101–108, Ross pp. 186–188 or Gerou & Lusk pp. 60–65. What transfers is the collision prohibition, not the semantics. |
| ⭐⭐ do they share ONE horizontal line? | **Gould p. 105** (prose + an `incorrect` drawing) | *"When a sequence of changing dynamics involves hairpins, **keep such markings on the same horizontal plane** whenever possible. The eye most easily follows a progression of dynamics running parallel to the stave"* — and the counter-example, *"A sequence of dynamics at different vertical positions should be avoided as the dynamics will appear unconnected and be difficult to follow"*, is exactly vertical displacement, labelled **incorrect**. Second source: **Ross p. 188 rule 3**, *"A mark should be aligned horizontally with a sign."* Third: **Gould p. 494**. |
| ⭐⭐ aligned on WHAT, exactly | **Gould p. 105** (measured) | The wedge's centre-line and the dynamic's **x-height centre** coincide to **0.08 sp** (all four wedges share axis y = 2125; glyph bodies centre 2126–2127). ⛔ **NOT the baseline** — the descender of `p` hangs below the axis. Confirmed on p. 107 (0.1 sp). |
| ⭐ is the hairpin SHORTENED for it? | **Gould p. 104** (prose) | *"(If a dynamic symbol is present, **the hairpin starts later and finishes earlier**, so that the dynamic centres on the notehead or chord.)"* — the dynamic keeps its anchor, the wedge yields. There is no reciprocal permission to move a dynamic off its notehead; the only sanctioned move is **left, never right** (p. 103). |
| the gap, as a NUMBER | — (measured; no source states one) | **No book gives a number.** MEASURED across four figures: **0.25–1.10 sp**, and the gap at the closed TIP is consistently ≤ the gap at the open MOUTH (tip median ≈0.55 sp, mouth ≈0.80 sp). Ross p. 188's abstract figure is the cleanest: tips 0.34/0.41 sp vs mouths 1.10/0.83 sp. ⚠️ In Gould every gap is a RESIDUAL of two independent anchors, which is why she lets one get as tight as 0.25 sp. |
| when there is no room at all | **Gould p. 108** | *"Where there is not space to include* sub.*, use a vertical stroke or dotted line between each sudden dynamic change"* — a separator stroke, still on the one line. ⛔ Never a vertical displacement. |
| the aperture (the two books DISAGREE) | **Gould p. 103** vs **Ross p. 187** | Gould: *"The open end should not be more than two stave-spaces wide."* Ross: *"no more than a space and a half."* ⭐ MEASURED, Gould's own drawings are **1.51 / 1.56 sp** — she engraves Ross's number. |
| ❌ Stone on any of this | **Stone, whole book** | **Nothing.** His index has no crescendo / diminuendo / wedge / hairpin entry at all; dynamics are pp. 16–19 and 32–33. Checked 2026-08-18 — ⛔ do not check again. |

## ⭐⭐ THE THREE ENGINE SOURCES — on disk, and NOT in this directory

**`~/dev/engine-sources/{MuseScore,lilypond,verovio}`** — shallow clones, re-fetched 2026-08-18.
⭐ **Look here BEFORE cloning anything**: they have now been lost twice to `/tmp` being cleared
(2026-08-16 and again before 2026-08-18), and each rediscovery costs an agent its budget.

⭐ **Why not under `reference/`**: 846 MB of C++ inside the project directory is reachable by
ripgrep, editor indexing and every `find` we run — a grep for `hairpin` that silently starts matching
MuseScore's source is a confusing afternoon. One directory over, it can only be reached deliberately.
The split is this README's own: **the manifest is committed, the bytes are not.**

| repo | path | branch @ commit | re-fetch |
|---|---|---|---|
| **MuseScore** (645 MB) | `~/dev/engine-sources/MuseScore` | 🚨 **`main`** @ `929d1e9` (2026-08-18) | `git clone --depth 1 https://github.com/musescore/MuseScore.git` |
| **LilyPond** (92 MB) | `~/dev/engine-sources/lilypond` | `master` @ `beedbfa` | `git clone --depth 1 https://gitlab.com/lilypond/lilypond.git` |
| **Verovio** (109 MB) | `~/dev/engine-sources/verovio` | `develop` @ `efff0bc` | `git clone --depth 1 https://github.com/rism-digital/verovio.git` |

⚠️ **Where the layout logic actually lives**, since all three moved it at some point:

- **MuseScore 4** — ⛔ NOT in `dom/`. The model is `src/engraving/dom/*.cpp`, the layout is
  `src/engraving/rendering/score/` (`tlayout.cpp`, `dynamicslayout.cpp`, `alignmentlayout.cpp`,
  `autoplace.cpp`, `systemlayout.cpp`). There is **no `HairpinLayout` file** — hairpin layout is in
  `tlayout.cpp`. Style defaults are `src/engraving/style/styledef.cpp`, in **spatium**.
- **LilyPond** — the C++ in `lily/` is half the story; the constants are Scheme, in
  `scm/define-grobs.scm` / `scm/output-lib.scm`, and `Documentation/` states intent. Units are
  **staff-spaces**.
- **Verovio** — layout is FUNCTORS, `src/adjust*functor.cpp`. ⛔ **There is no `AdjustHairpinsFunctor`**
  (checked 2026-08-18 @ `efff0bc`); hairpin work is split across `preparedatafunctor.cpp` (linking),
  `view_control.cpp` (the shortening — *inside the drawing code*) and
  `adjustfloatingpositionerfunctor.cpp` (generic collisions). Its unit is `drawingUnit` = **half a
  staff space**.

⭐ **What they answered on 2026-08-18** (the dynamic-vs-hairpin question, alongside the books above):
**MuseScore** shortens at an endpoint to `dynamic ink ± 0.5 sp` (`autoplaceHairpinDynamicsDistance`),
finds the partner by **exact tick match**, aligns a snapping chain on a `0.46 × spatium` optical
centre — and `Autoplace::itemsShouldIgnoreEachOther` (`autoplace.cpp:406`) **unconditionally forbids**
a DYNAMIC × HAIRPIN_SEGMENT collision test, so a mid-span dynamic simply overlaps. **LilyPond** makes
the case unrepresentable — an absolute dynamic *terminates* an open hairpin (`dynamic-engraver.cc:102`)
— shortens to `text ink ∓ bound-padding` (**1.0 sp**; 0.333 sp between two wedges, **0** at a rest),
and its `DynamicLineSpanner` is `axes . (,Y)`, i.e. purely vertical, with `outside-staff-priority`
switched OFF inside a `Dynamics` context. **Verovio** shortens to `ink ± unit/2` (**0.25 sp**), links
by pointer identity at the endpoints only, and answers a mid-span dynamic by pushing the hairpin to a
**second line at full length** — which Gould p. 105 draws and labels *incorrect*.

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

✅ **Ross and Stone are NO LONGER missing — both are complete on disk since 2026-08-18** (rows in the
table above). ⚠️ Every "⛔ Read / Stone / Ross — UNKNOWN, not on disk" line in the Q&A tables above
was written BEFORE that and has **not** been re-checked against the books; treat those as *not yet
asked*, not as *asked and silent*.

Still genuinely missing: **Gardner Read** *Music Notation*, **Chlapik** *Die Praxis des
Notengraphikers* (no digital copy is known to exist), and Boosey & Hawkes' house manual. ⛔ When one
of these would have answered a question, the honest report is **UNKNOWN** — never "the books are
silent".

❌ **MOLA's Guidelines for Music Preparation genuinely say nothing** about slurs, ties or hairpins —
verified by extracting the whole PDF twice. Stop checking it.
