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
| ⭐⭐ `Behind Bars The Definitive Guide to Music Notation (Elaine Gould) (z-library.sk, 1lib.sk, z-lib.sk) (2).pdf` | **Gould, *Behind Bars*, THE WHOLE BOOK** — 696 PDF pages, 249 MB, scanned with an OCR text layer. Added **2026-08-17 16:25**, i.e. *after* the "how to reach Gould" section below was written. ⭐ **This is now the first stop for any Gould question.** What it has answered so far: the BELOW-STAFF LADDER (p. 29 octave signs incl. the whole-system exception; p. 101–102 dynamics go OUTSIDE octave signs, with the drawn correct/incorrect pair; p. 332–333 pedal below all other notation + Table 2's pedal stacking order; p. 337 a drawn `8`-under-`Ped.`-under-`Sost. Ped.` stack); the pedal's HORIZONTAL anchor (p. 333 *"depressed at the beginning of its symbol"*, p. 335 the roman-vs-traditional A/B pair, p. 336 half-pedalling — measured, 2026-08-18, see the second Q&A table below); and **TRILL vs SLUR** (p. 135 *"further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave"*, p. 121–122 the articulation-vs-slur endpoint rule, plus measured engravings on pp. 135/138/381 — third Q&A table below); and ⭐⭐ **the LADDER'S HORIZONTAL SCOPE** (2026-08-20, last Q&A table): p. 105's *"a **sequence** of changing dynamics"* is the whole of the levelling scope, p. 323 *"as close as possible to the part they affect"* is the tie-breaker, pp. 487–489 put the system-wide response in the STAVE'S POSITION, and **p. 135 *Double trills*** — *"In double-stemmed parts, the trill sign for the lower part goes below the stave. Where there is room, place any dynamic markings further from the stave"* — is the direct sentence for the below-staff ladder, with a *"cramped conditions"* figure that INVERTS it. | added by hand, 2026-08-17 |
| ⭐ `gould-behind-bars-fulltext.txt` | **Gould's whole OCR text layer, extracted** — 983 KB, 44,617 lines, the same book as the PDF above. ⭐ **GREP THIS FIRST**: finding which page discusses something took page-by-page rendering before, and this answers it in a second. ⚠️⚠️ **It is DIRTY OCR and ⛔ NOT quotable as it stands** — the first lines alone read `IVE G333”DE TO MU`, `FABERﬂMUSIC`, `Padstnw`. Use it to LOCATE a page, then render that page (`pdftoppm -r 450`) and read the scan for the wording. ⛔ And for anything DRAWN the scan is the only authority — a picture has no text layer. ⚠️ Page numbers are not marked in it; find the printed number on the rendered page. | extracted from the PDF above, 2026-08-18 |
| `gerou-lusk-essential-dictionary-of-music-notation.pdf` / `.txt` | **Gerou & Lusk, *Essential Dictionary of Music Notation*** (Alfred, 1996), 82pp, complete. The one full treatise we hold **besides Gould**. Slurs at pp. 121–124: placement by stem direction, "starts mid-stem, to the right of the stem", "never cross the beam with a slur", slope follows the phrase. Also: **damper pedal, p. 105** — *"always placed below the grand staff and are usually placed below all other musical elements"* (our second, independent source for the pedal being the outermost family); **octave signs, p. 98** — *"as close to the notes affected as possible"*, `8vb` is *"only a copyist's shorthand and should not be used in engraved music"*, and a drawn example putting the `8va` outside a slur. ⭐⭐ **pedal marks, pp. 105–107** — the one source that states the horizontal anchor OUTRIGHT: pedal-down at the notehead's **left edge**, pedal-change at its **centre**, pedal-up **flush left** with it, end-of-piece at the **final double barline's thin line**. ⭐ The `.txt` is already extracted — grep it before opening the PDF. | openly hosted: `musescore.org/sites/musescore.org/files/2022-02/EssentialDictionaryOfMusicNotation_0.pdf` |
| `gould-scans/gould.png`, `gould_good.png`, `gould_bad.png` | **Gould, *Behind Bars*, p. 111** — a scan of the printed page: the opposite-stem rule AND both music examples. ⭐ The examples are the payoff: they can be MEASURED, which is how we learned her drawing disagrees with the formula attributed to her. | scoringnotes.com, "Better Sibelius slurs for opposite stem direction on outer notes" |
| `gould-scans/att2528.jpg`, `att2528_music.png` | **p. 111, a second scan** carrying the qualifier sentence *"The slur should not, however, move too close to noteheads if there is room for it to be further away."* | notat.io thread `t=635`, posted by John Ruggero |
| ⭐ `the art of music engraving and processing (ted ross) (z-library.sk, 1lib.sk, z-lib.sk).pdf` / `ross-art-of-music-engraving-fulltext.txt` | **Ted Ross, *The Art of Music Engraving and Processing*, THE WHOLE BOOK** — 292 PDF pages, 13.6 MB, clean OCR layer; the `.txt` is 387 KB, extracted 2026-08-18. ⭐ **PAGE OFFSET: PDF page = printed page + 12** (calibrated PDF 199 = printed 187). What it has answered: **dynamics typography, p. 186** — *"the height of the ƒ is two and a half spaces, the **p** two spaces and the **m** one space"* (independently confirms Gould p. 101); **the wedge, p. 187** — *"Each of the lines that form the wedge shape is no thicker than a staff line. The width of the open end of the wedge is no more than a space and a half"* (⚠️ **Ross 1.5 sp vs Gould's 2 sp maximum, p. 103** — a real disagreement, and Gould's own drawings measure 1.51/1.56 sp, i.e. she engraves Ross's number), plus *"a sign is generally not used for a passage longer than three measures"*; **the four sign-with-mark rules, pp. 187–188**, of which ⭐⭐ **rule 3 — *"A mark should be aligned horizontally with a sign"*** — is the clearest one-sentence statement of the dynamics-line rule in any book we hold; p. 188 rule 4 covers hairpins across a system break. ⛔ The old second-hand p. 141 slur sentence below is superseded — read the book. | added by hand, 2026-08-18 10:00 |
| `Music Notation in the Twentieth Century A Practical Guidebook (Kurt Stone) (…).pdf` / `stone-notation-20th-century-fulltext.txt` | **Kurt Stone, *Music Notation in the Twentieth Century*, THE WHOLE BOOK** — 189 PDF pages, 88 MB; `.txt` 504 KB, extracted 2026-08-18. ⚠️ Dirtier OCR than Gould's (`Iyp ical`, `sp ace`). ❌ **What it does NOT answer, checked 2026-08-18 so nobody repeats it: hairpins.** His index has **no entry at all** for crescendo, diminuendo, wedge or hairpin; dynamics are pp. 16–19 (absolute vs individual, boxed, `±`, *subito*, niente, note-size dynamics) and pp. 32–33 (which side of the stave). Nothing on hairpin geometry or on a dynamic colliding with one. | added by hand, 2026-08-18 10:00 |
| `musescore-slurs-and-ties-handout.pdf` | 4pp MuseScore user handout. Minor; kept for completeness. | MuseScore docs |
| ⭐⭐ `snap-and-go-baudisch-chi2005.pdf` / `snap-and-go-fulltext.txt` | **Baudisch, Cutrell, Hinckley & Eversole, *Snap-and-go: helping users align objects without the modality of traditional snapping*, CHI 2005** — 10pp, full text, clean text layer. The technique behind the slur endpoint drag's HOLD (`interactions/MouseController`): ⛔ do not teleport within a radius; insert **motor space** at the anchor so every intermediate position stays reachable. What it answered (2026-08-19): the preferred friction widths (5/10/18/34 px tested, 8 of 9 users preferring 18/34, authors' range **20–30**); and 🚨 **it never repays the swallowed motor distance** — its 1-D code returns `x − w + 1` past an attractor, a permanent `w−1` offset per attractor, and it resyncs the *pointer* to the object instead (*"it misses code for updating the mouse pointer to keep knob and pointer together"*). | `patrickbaudisch.com/publications/2005-Baudisch-CHI05-SnapAndGo.pdf`, added 2026-08-19 |
| ⭐⭐ `oh-snap-fernquist-interact2011.pdf` / `oh-snap-fulltext.txt` | **Fernquist, Shoemaker & Booth, *"Oh Snap" – Helping Users Align Digital Objects on Touch Interfaces*, INTERACT 2011** — 8pp, full text. The CATCH-UP half. ⭐⭐ **The hold+catch-up pair IS this paper's own technique**, not a hybrid of the two: §3 *"The object remains stationary unless the user's finger travels a small distance (the snap-width)… Once the finger travels beyond the snap-width, the object starts moving at a rate faster than the finger."* Gain = `(snap + catchup)/catchup` (Eq. 1), recommended 10 px / 20 px. It positions itself **against** snap-and-go (Table 1 scores snap-and-go "No" on *mapping maintained*) and credits the velocity profile to Nacenta et al., GI 2009. 🚨 §2 states the debt problem outright — *"the more snap lines an object crosses, the farther the object would lag behind the finger… in effect 'losing' any direct object-finger correspondence"* — and §3.1 the opposite failure: as catch-up→0 the ratio→∞, objects *jump*, and the gain **quantises** reachable positions. ⚠️ §5.2 is the only inter-anchor rule found: *"future Oh Snap implementations would have to take great care not to overlap the snap and catch-up regions of different snappable lines."* ⭐⭐ **What it answered on 2026-08-20 (his question: it is a TOUCH paper, why are we using it on a mouse?):** §2 divides the world explicitly — *"Snap-and-go works well for relative input devices, such as mice… Unfortunately, snap-and-go is not suitable for direct touch interfaces"* — so by the papers' own account a mouse should use Baudisch and only touch needs this. ⭐ **The reason it transfers anyway is a WEB constraint, not a finger one:** snap-and-go repays its debt by WARPING THE POINTER to the object, and a web page cannot warp a cursor (no pointer warping outside Pointer Lock, which hides it). So on the web a mouse inherits touch's exact failure — the object lags a cursor you can see and nothing resyncs them — which is the failure Oh Snap exists for. ⚠️ Its NUMBERS are not ours to borrow: the study is on multi-touch tabletops, so 10/20 px is unvalidated for a mouse (the slur uses 0.8 × the gap ahead, capped 30 px, tuned by hand). | `cs.ubc.ca/labs/imager/tr/2011/OhSnap/ohsnap.pdf`, added 2026-08-19 |
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
| ⭐⭐ do they share ONE horizontal line? | **Gould p. 105** (prose + an `incorrect` drawing) | *"When a sequence of changing dynamics involves hairpins, **keep such markings on the same horizontal plane** whenever possible. The eye most easily follows a progression of dynamics running parallel to the stave"* — and the counter-example, *"A sequence of dynamics at different vertical positions should be avoided as the dynamics will appear unconnected and be difficult to follow"*, is exactly vertical displacement, labelled **incorrect**. Second source: **Ross p. 188 rule 3**, *"A mark should be aligned horizontally with a sign."* ~~Third: **Gould p. 494**.~~ 🚨 **CORRECTED 2026-08-20 — p. 494 does NOT support this and never did.** It is about *simile* marks and repeated instructions; read in full. There are TWO sources for this rule, not three. ⚠️ And see the 2026-08-20 table below for what the rule's SCOPE turns out to be — *"a sequence"* is a connected run, not a system. |
| ⭐⭐ aligned on WHAT, exactly | **Gould p. 105** (measured) | The wedge's centre-line and the dynamic's **x-height centre** coincide to **0.08 sp** (all four wedges share axis y = 2125; glyph bodies centre 2126–2127). ⛔ **NOT the baseline** — the descender of `p` hangs below the axis. Confirmed on p. 107 (0.1 sp). |
| ⭐ is the hairpin SHORTENED for it? | **Gould p. 104** (prose) | *"(If a dynamic symbol is present, **the hairpin starts later and finishes earlier**, so that the dynamic centres on the notehead or chord.)"* — the dynamic keeps its anchor, the wedge yields. There is no reciprocal permission to move a dynamic off its notehead; the only sanctioned move is **left, never right** (p. 103). |
| the gap, as a NUMBER | — (measured; no source states one) | **No book gives a number.** MEASURED across four figures: **0.25–1.10 sp**, and the gap at the closed TIP is consistently ≤ the gap at the open MOUTH (tip median ≈0.55 sp, mouth ≈0.80 sp). Ross p. 188's abstract figure is the cleanest: tips 0.34/0.41 sp vs mouths 1.10/0.83 sp. ⚠️ In Gould every gap is a RESIDUAL of two independent anchors, which is why she lets one get as tight as 0.25 sp. |
| when there is no room at all | **Gould p. 108** | *"Where there is not space to include* sub.*, use a vertical stroke or dotted line between each sudden dynamic change"* — a separator stroke, still on the one line. ⛔ Never a vertical displacement. |
| the aperture (the two books DISAGREE) | **Gould p. 103** vs **Ross p. 187** | Gould: *"The open end should not be more than two stave-spaces wide."* Ross: *"no more than a space and a half."* ⭐ MEASURED, Gould's own drawings are **1.51 / 1.56 sp** — she engraves Ross's number. |
| ❌ Stone on any of this | **Stone, whole book** | **Nothing.** His index has no crescendo / diminuendo / wedge / hairpin entry at all; dynamics are pp. 16–19 and 32–33. Checked 2026-08-18 — ⛔ do not check again. |

### What was asked of it on 2026-08-19, and what came back

The question was **where a TEMPO MARK is anchored horizontally** — the user's guess was the barline.
Answered from Gould (prose **and** measured alignment guides), Ross, Gerou & Lusk, Stone, and all
three engine checkouts. ⭐ The first question answered from four books *and* three engines at once,
and the answer is **the opposite of the guess**.

| asked | source | answer |
|---|---|---|
| ⭐⭐ a mark on a bar that prints a TIME SIGNATURE | **Gould p. 183** (printed; PDF 203) | *"When a tempo marking coincides with a time signature indication, align the tempo with the left edge of the time signature"*. Same in **Gerou & Lusk p. 142**: *"The left edge of the tempo mark is vertically aligned to the left edge of the time signature."* |
| ⭐⭐ a mark on a downbeat with NO time signature | **Gould p. 183** | *"When there is no new time signature, align the tempo marking with the first element of the notation (e.g. a note or accidental) after the clef and key signature. **Note that when the tempo change is at the start of the bar, the marking is not placed on the barline**"* — the barline is forbidden in so many words. |
| mid-bar | **Gould p. 183** | *"Tempo indications mid-bar also align with the first notational element of the respective beat"* (Ross p. A-46 agrees: aligned with *"the affected beat"*). |
| ⭐ aligned on WHAT, exactly | **Gould p. 183** (MEASURED at 450 dpi off her own dashed guides) | **Left ink edge to left ink edge, within 0.05 sp** across all four figures. Her downbeat examples put the mark **1.65 sp** right of the barline in a plain bar and **7.85 sp** right when a key change intervenes. |
| a repeat sign at the mark | **Gould p. 183** | *"When a repeat sign acts as a barline, the tempo aligns with the following first element of the notation. When the repeat sign is not acting as a barline, the tempo aligns with it"* (measured: +0.05 sp). |
| ⚠️ the one DISSENT | **Ross p. A-46** (PDF 268) | *"When appearing during a composition it is placed vertically **with or slightly past a bar line**"* — the only source that allows the barline, and only for a mid-piece downbeat. First page: aligned to the time signature (p. A-8). |
| ❌ Stone on any of this | **Stone**, pp. 32, 46–47, 128, 159 | **Nothing.** Vertical placement and which staff only; the metronome section is spatial notation (*"centered between beats"*). Checked 2026-08-19 — ⛔ do not check again. |
| ⭐⭐ what the ENGINES do | **LilyPond** `scm/define-grobs.scm:2336–2367`; **MuseScore** `rendering/score/tlayout.cpp:5739–5786`; **Verovio** `src/adjusttempofunctor.cpp:36–68` | All three implement Gould, none offers "align to barline". LilyPond's `MetronomeMark` is `break-align-symbols = (time-signature)` — ⛔ **not** `staff-bar` — falling back to `currentMusicalColumn` (the first non-breakable item); its code cites **Gardner Read, *Music Notation*, p. 278** verbatim for the rule. MuseScore shifts back at `rtick == 0` **only if the measure has a TimeSig segment**. Verovio aligns to the METERSIG alignment at measure start, else to the leftmost bbox of the start element. |
| ⭐ …and what DOES take the barline | **Gould p. 485**; `define-grobs.scm:2885`; `tlayout.cpp:4585–4642` | The **REHEARSAL MARK**, in the book and in both engines (`break-align-symbols = (staff-bar key-signature clef)`). *"When coinciding with a tempo indication, the rehearsal mark goes first, so as to remain closest to the barline; the tempo aligns after it."* ⇒ the barline rule the guess reached for is a real rule about a different mark. |
| ⛔ Gardner Read p. 278 (LilyPond's own citation) | — | **UNKNOWN** — not on disk, second-hand through the code comment only. |
| ⛔ a NUMBER for any padding between mark and anchor | — | **None given by any source.** Every measurement above is a residual of the left-edge-to-left-edge rule. |

### What was asked of it on 2026-08-20, and what came back

The question was **HOW FAR HORIZONTALLY an outside-staff mark's claim on vertical space reaches**.
His report, with a screenshot: a below-staff `tr〜〜〜` in **bar 6** was pushing the **bar 3** hairpin,
`f` and `Ped.` down — *"the trill is not even close horizontally… for me it looks very strange, but i
don't want to make assumptions"*. ⭐ The books answer it by PICTURE (no source states the rule as
prose), and all four sources plus all three engines agree: **no**.

| asked | source | answer |
|---|---|---|
| ⭐⭐ what is the SCOPE of *"the same horizontal plane"* | **Gould p. 105** | *"When a **sequence** of changing dynamics involves hairpins, keep such markings on the same horizontal plane whenever possible"*. ⛔ No wider scope is stated: the words *sequence* and *progression* are all there is — **neither "bar" nor "system" nor "page" appears anywhere in the section**, and *"whenever possible"* makes it conditional. |
| the scope, second source | **Gerou & Lusk p. 65** | *"The **level at the beginning of the sign** is the same as **the dynamic last indicated** in the music."* ⭐ The clearest scope statement we hold: a hairpin inherits from the PRECEDING dynamic — the unit is a chain, read backwards. |
| the scope, third source | **Ross p. 188 rule 3** | *"A mark should be aligned horizontally with a sign."* — a mark-and-its-sign **pair**. Nothing wider. |
| ⭐⭐ the TIE-BREAKER when levelling and proximity disagree | **Gould p. 323** | *"The overriding consideration should be that dynamics are **as close as possible to the part they affect**."* ⇒ proximity WINS. p. 102 adds the space-saving move she does sanction: a dynamic may *"encroach into the outer stave-spaces"* — i.e. move INWARD; never level the whole line outward. |
| ⭐⭐ how much spread is actually allowed | **Gould p. 105**, all three examples (MEASURED, 450 dpi, sp below the bottom staff-line) | **(A) "correct", levelled**: every glyph top on pixel row 2100, spread **0.00 sp**. **(B) sanctioned, sloping to the contour** (*"a hairpin may slope to follow the contour of the pitches"*, NOT labelled incorrect): spread **1.60 sp** across one system. **(C) labelled `incorrect`**: spread **4.56 sp**. ⭐ So the fault in (C) is MAGNITUDE and arbitrariness, not "not identical". |
| ⭐⭐⭐ **the user's case, DRAWN** — a below-staff trill and dynamics in one system | **Gould p. 135**, *Double trills*, left figure (MEASURED) | Over **note 1**: accent 3.79–4.90 → trill wavy **6.16–6.71** → dim hairpin 7.31–8.32 → `p` 7.31–**9.17**. Over **note 2**: tenuto 2.29–3.49 → trill wavy **4.15–4.70** → cresc hairpin **5.75–6.81**. ⭐⭐ **Deepest ink 9.17 sp left vs 6.81 sp right — 2.36 sp apart inside ONE system on ONE staff**, and the two hairpins belong to the same `… p <` sequence. ⛔ She does not flatten the right half down to the left's depth. |
| ⭐⭐⭐ the same, a SECOND way | **Gould p. 29**, the figure under the longest-duration rule (MEASURED, sp ABOVE the top line) | **Bar 1**: tuplet bracket 7.62–9.12 · slur 5.17–7.62 · short `8` bracket **3.17–5.62**. **Bar 2**: long `8` bracket **8.28–9.03** · tuplet bracket 5.42–7.42. ⭐ Two `8` brackets in one system **≈4.4 sp apart**; bar 2's outermost ink at 9.03 does not lift bar 1's `8` off 5.62. |
| ⭐ …and the ordering rule that goes with it | **Gould p. 29** | *"When there are phrase marks or tuplet brackets as well as octave signs, **whichever covers the longest duration goes on the outside**"* — the ladder's order is decided by HORIZONTAL EXTENT, locally. ⭐ The whole-system 8va rule on the same page is the limiting case of this, not a separate principle. |
| ⭐⭐ what IS system-wide, then | **Gould pp. 487–489** | *"When a page requires text or notation symbols that extend some distance above the top stave or below the bottom stave, match the outer margins … by lowering the top stave or raising the bottom stave slightly"* + *"Adjust the distance between staves **from system to system, according to the demands of the notation**."* ⭐⭐ An outlier moves **the stave on the page**; it does not move the other marks. All three engines do exactly this (their staff-to-staff spacing reads a system-wide max; their mark placement does not). |
| ⭐⭐ **a BELOW-STAFF TRILL vs dynamics — the direct sentence we did not have** | **Gould p. 135**, *Double trills* | *"In double-stemmed parts, the trill sign for the lower part goes below the stave. **Where there is room, place any dynamic markings further from the stave**:"* ✅ Confirms our below-staff ladder (staff → trill → … → dynamics) from PROSE, where it previously rested on transitivity through p. 101–102 + p. 332. |
| ⚠️ …but the ladder's order is NOT absolute | **Gould p. 135**, the *"in cramped conditions"* figure (MEASURED) | The same music with the ladder **INVERTED** — dynamics 3.24–4.30 sp, trill wavy lines 6.16–6.71 sp, both pairs identical to the pixel. Deepest ink 7.06 sp vs the roomy version's 9.17. ⭐ To save height she swaps the rungs; ⛔ she does not push the dynamics out to clear the worst case. |
| how much separation stops two marks competing | — | **No book states a number, or the condition at all** — no source states the competition *mechanism*; Gould only ever states orderings. Checked in full: Gould pp. 29–30, 101–108, 135, 323–324, 487–489, 494, 523–524; Ross pp. 186–188; Gerou & Lusk pp. 60–65, 105–107. The ENGINES give it: LilyPond `outside-staff-horizontal-padding` **0** by default (0.2 sp for `TextScript`), MuseScore `skylineMinHorizontalClearance` **0.25 sp**, Verovio a plain rect test with margin **0**. All "a hair of slack on a true x-interval test". |
| ⛔ a below-staff trill in **SINGLE-stemmed** writing | — | **UNKNOWN**, and it is the case he actually has on screen. Gould sanctions a below-staff trill *only* for the lower part of double-stemmed writing (p. 135); Gerou & Lusk say *"the tr is always placed above the note, regardless of stem direction"*. Checked Gould pp. 134–140, the Gerou & Lusk *Trill* entry, and Ross. |
| ⛔ Dorico's Engraving Options → Dynamics → Vertical Position defaults | — | **UNKNOWN** — the Steinberg reference page did not surface in four searches. ⚠️ Notably no option named for aligning dynamics across a system appeared, but absence from search is not a documented "no". What IS documented: Dorico's automatic unit is a *"group of dynamics"* — *"They immediately follow each other horizontally on the staff"* — and anything wider is the MANUAL Engrave-mode `Align Dynamics`. ⭐ Gould's *sequence*, exactly. |
| ⛔ Sibelius's Magnetic Layout group extent | — | **UNKNOWN** — the 2018.1 Reference Guide PDF exceeds the fetch limit; §8.3 would need a local download. ⚠️ **The one dissenting design**: Spreadbury says Magnetic Layout *"operates on a whole system of music at once"* and that a primary group is *"typically horizontal, i.e. aligned across some of or all of the width of a staff"* — but it propagates along an explicit GROUP, and how wide that group gets is exactly what is not documented. |
| ⛔ a publisher HOUSE-STYLE manual on this | — | **UNKNOWN** — not found in one search. ⏭️ Unopened lead: the UE Style Guide and the A-R Editions guide are reportedly shared on `notat.io/viewtopic.php?t=1128`. |

⭐ **What it changed in the repo**: nothing about the ladder's design — `layout/dynamicsLine.ts` already
rejects the system-wide reading in its own module note, `dynamicsChain.ts` already chains only
*touching* spans (Gould's *sequence*), and `outsideStaffBand.bandOver` already does a closed-interval
overlap test. The leak was a BUG one layer up: `TrillRenderer.coveredPlacements` published every
trill's claim across its whole system (fixed 2026-08-20, `docs/trill-plan.md` §17). ⭐⭐ The lesson
worth keeping from a research trip that found a bug instead of a rule: **the books agreed with the
code's stated intent, so the disagreement was between the code and itself.**

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

⭐⭐ **What they answered on 2026-08-20** (does a horizontally REMOTE outside-staff mark push the
dynamics line? **All three: NO** — and each does it at the same place in its pipeline, the *distance*
function, by windowing on x):

- **LilyPond** — ⭐ the cleanest mechanism, and the one worth stealing. A `Skyline` is a sorted list of
  `Building{x_interval, y_intercept, slope}` in which **empty x is a −∞ building**
  (`lily/skyline.cc:256`), so `internal_distance` (`:617–646`) — an O(n+m) merge walk taking the max
  of the *pointwise sum* — returns `-infinity_f` for x-disjoint pairs with no special case.
  `axis-group-interface.cc:665–673` turns that into an **empty** forbidden interval, so
  `translate_axis(0, Y_AXIS)`. ⭐ Its tolerance is `horizon_padding`, which widens the skyline itself
  and **fades linearly to nothing within `2 × horizon_padding`** (`skyline.cc:543–611`); the default
  is **0** for `DynamicLineSpanner`. ⭐⭐ And its `DynamicLineSpanner` is **not per-system**: a lone
  `\f` opens and closes one in the same timestep (`dynamic-align-engraver.cc:196`, `bool end = line_
  && running_.empty ()`), its `X-extent` being `ly:axis-group-interface::width` over its own members
  — Gould's *sequence*, in code. Priorities: `TrillSpanner` **50** < `DynamicLineSpanner` **250** <
  `OttavaBracket` **400** < pedal spanners **1000** < `MetronomeMark` **1300**. ⚠️ A bare `tr`
  `Script` has **no** `outside-staff-priority` at all — only fermatas (75) opt in. ⭐ Its two piles
  are a `Drul_array` keyed by DIRECTION, so above and below never see each other *structurally*.
- **MuseScore** — `Shape::minVerticalDistance` (`infrastructure/shape.cpp:239–264`) is a rect-pair
  double loop gated by `intersects(ax1, ax2, bx1, bx2, minHorizontalClearance)`; with no overlap it
  returns `-DBL_MAX` and `autoplace.cpp:103`'s `if (d > -minDistance)` never fires. Clearance
  `Sid::skylineMinHorizontalClearance` = **0.25 sp** (`style/styledef.cpp:795`). ⛔ **`alignSystemDynamics`
  / `alignDynamics` DO NOT EXIST** at `929d1e9` — don't hunt for them again; dynamics use
  `alignItemsWithTheirSnappingChain`, whose group is the `itemSnappedBefore/After` linked list, minted
  only at **equal ticks**. ⚠️ The skyline is `src/engraving/infrastructure/`, **not** `dom/` and **not**
  `rendering/`. ⭐⭐ **The counterexample that proves it is deliberate: PEDALS *are* levelled per system,
  horizontally blind** (`systemlayout.cpp:1349`, `processLines(…, align=true)`) — MuseScore knows how
  to do the system-wide thing and chose not to for dynamics.
- **Verovio** — `AdjustFloatingPositionerFunctor` gates on `HasHorizontalOverlapWith`
  (`floatingobject.cpp:430`) before `CalcDrawingYRel`. ⛔ **`adjustfloatingpositionergrpsfunctor.cpp`
  DOES NOT EXIST**; the Grps class is inside `adjustfloatingpositionerfunctor.cpp:299–431`, and it IS
  horizontally blind — but its class list is `{DYNAM, HAIRPIN}` and membership needs a non-zero
  `GetDrawingGrpId()` (MEI `@vgrp`, or an equal-timestamp dynam↔hairpin link), so **TRILL is never a
  member**. The remote trill survives only in the scalar `m_overflowBelow`, which feeds the
  **system's height** — and is read as a y-source for exactly two families, **lyrics and figured
  bass**.

⚠️ Symbols that do NOT exist at these commits, so nobody hunts them twice: LilyPond
`lily/trill-spanner-engraver.cc` (the `TrillSpanner` is made in `scm/scheme-engravers.scm:1816`) and
`\dynamicsAlignment`; MuseScore `alignSystemDynamics`/`alignDynamics`; Verovio
`CalcXMinMaxOverlap` and the Grps file above.

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
