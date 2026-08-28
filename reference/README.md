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
| ⭐⭐ `Behind Bars The Definitive Guide to Music Notation (Elaine Gould) (z-library.sk, 1lib.sk, z-lib.sk) (2).pdf` | **Gould, *Behind Bars*, THE WHOLE BOOK** — 696 PDF pages, 249 MB, scanned with an OCR text layer. Added **2026-08-17 16:25**, i.e. *after* the "how to reach Gould" section below was written. ⭐ **This is now the first stop for any Gould question.** What it has answered so far: the BELOW-STAFF LADDER (p. 29 octave signs incl. the whole-system exception; p. 101–102 dynamics go OUTSIDE octave signs, with the drawn correct/incorrect pair; p. 332–333 pedal below all other notation + Table 2's pedal stacking order; p. 337 a drawn `8`-under-`Ped.`-under-`Sost. Ped.` stack); the pedal's HORIZONTAL anchor (p. 333 *"depressed at the beginning of its symbol"*, p. 335 the roman-vs-traditional A/B pair, p. 336 half-pedalling — measured, 2026-08-18, see the second Q&A table below); and **TRILL vs SLUR** (p. 135 *"further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave"*, p. 121–122 the articulation-vs-slur endpoint rule, plus measured engravings on pp. 135/138/381 — third Q&A table below); and ⭐⭐ **the LADDER'S HORIZONTAL SCOPE** (2026-08-20, last Q&A table): p. 105's *"a **sequence** of changing dynamics"* is the whole of the levelling scope, p. 323 *"as close as possible to the part they affect"* is the tie-breaker, pp. 487–489 put the system-wide response in the STAVE'S POSITION, and **p. 135 *Double trills*** — *"In double-stemmed parts, the trill sign for the lower part goes below the stave. Where there is room, place any dynamic markings further from the stave"* — is the direct sentence for the below-staff ladder, with a *"cramped conditions"* figure that INVERTS it. And ⭐⭐ the **BARLINE FAMILY** (2026-08-26, last Q&A table): the four paragraphs on printed **pp. 38–39** (*Single* / *Thin double* / *Final* / *Repeat*, with **no figure**), *Placing repeat barlines* **pp. 233–235** — incl. the **back-to-back two-design figure on p. 234**, measured — and *Da Capo/Dal Segno: Double barlines* **p. 240**. 🚨 Her stated **¾ stave-space** for a thin double is contradicted by her own five engraved thin doubles (≈0.5 sp left-to-left). | added by hand, 2026-08-17 |
| ⭐ `gould-behind-bars-fulltext.txt` | **Gould's whole OCR text layer, extracted** — 983 KB, 44,617 lines, the same book as the PDF above. ⭐ **GREP THIS FIRST**: finding which page discusses something took page-by-page rendering before, and this answers it in a second. ⚠️⚠️ **It is DIRTY OCR and ⛔ NOT quotable as it stands** — the first lines alone read `IVE G333”DE TO MU`, `FABERﬂMUSIC`, `Padstnw`. Use it to LOCATE a page, then render that page (`pdftoppm -r 450`) and read the scan for the wording. ⛔ And for anything DRAWN the scan is the only authority — a picture has no text layer. ⚠️ Page numbers are not marked in it; find the printed number on the rendered page. | extracted from the PDF above, 2026-08-18 |
| `gerou-lusk-essential-dictionary-of-music-notation.pdf` / `.txt` | **Gerou & Lusk, *Essential Dictionary of Music Notation*** (Alfred, 1996), 82pp, complete. The one full treatise we hold **besides Gould**. Slurs at pp. 121–124: placement by stem direction, "starts mid-stem, to the right of the stem", "never cross the beam with a slur", slope follows the phrase. Also: **damper pedal, p. 105** — *"always placed below the grand staff and are usually placed below all other musical elements"* (our second, independent source for the pedal being the outermost family); **octave signs, p. 98** — *"as close to the notes affected as possible"*, `8vb` is *"only a copyist's shorthand and should not be used in engraved music"*, and a drawn example putting the `8va` outside a slur. ⭐⭐ **pedal marks, pp. 105–107** — the one source that states the horizontal anchor OUTRIGHT: pedal-down at the notehead's **left edge**, pedal-change at its **centre**, pedal-up **flush left** with it, end-of-piece at the **final double barline's thin line**. ⭐ The `.txt` is already extracted — grep it before opening the PDF. | openly hosted: `musescore.org/sites/musescore.org/files/2022-02/EssentialDictionaryOfMusicNotation_0.pdf` |
| `gould-scans/gould.png`, `gould_good.png`, `gould_bad.png` | **Gould, *Behind Bars*, p. 111** — a scan of the printed page: the opposite-stem rule AND both music examples. ⭐ The examples are the payoff: they can be MEASURED, which is how we learned her drawing disagrees with the formula attributed to her. | scoringnotes.com, "Better Sibelius slurs for opposite stem direction on outer notes" |
| `gould-scans/att2528.jpg`, `att2528_music.png` | **p. 111, a second scan** carrying the qualifier sentence *"The slur should not, however, move too close to noteheads if there is room for it to be further away."* | notat.io thread `t=635`, posted by John Ruggero |
| ⭐ `the art of music engraving and processing (ted ross) (z-library.sk, 1lib.sk, z-lib.sk).pdf` / `ross-art-of-music-engraving-fulltext.txt` | **Ted Ross, *The Art of Music Engraving and Processing*, THE WHOLE BOOK** — 292 PDF pages, 13.6 MB, clean OCR layer; the `.txt` is 387 KB, extracted 2026-08-18. ⭐ **PAGE OFFSET: PDF page = printed page + 12** (calibrated PDF 199 = printed 187). What it has answered: **dynamics typography, p. 186** — *"the height of the ƒ is two and a half spaces, the **p** two spaces and the **m** one space"* (independently confirms Gould p. 101); **the wedge, p. 187** — *"Each of the lines that form the wedge shape is no thicker than a staff line. The width of the open end of the wedge is no more than a space and a half"* (⚠️ **Ross 1.5 sp vs Gould's 2 sp maximum, p. 103** — a real disagreement, and Gould's own drawings measure 1.51/1.56 sp, i.e. she engraves Ross's number), plus *"a sign is generally not used for a passage longer than three measures"*; **the four sign-with-mark rules, pp. 187–188**, of which ⭐⭐ **rule 3 — *"A mark should be aligned horizontally with a sign"*** — is the clearest one-sentence statement of the dynamics-line rule in any book we hold; p. 188 rule 4 covers hairpins across a system break. ⛔ The old second-hand p. 141 slur sentence below is superseded — read the book. ⭐⭐ **The repeat sign, decomposed — a FOOTNOTE on p. 147** (nothing in the index points at it): heavy line ½ space, white-space-plus-thin ½ space, the two dots ½ space, **total 1½ spaces**; plus the *Barlines* chapter **pp. 151–152** (double barlines *"approximately three-quarters of a space apart"*; the *fine* double *"spaced the same as a repeat sign"*) and the barline-to-first-note space on **p. 143**. | added by hand, 2026-08-18 10:00 |
| `Music Notation in the Twentieth Century A Practical Guidebook (Kurt Stone) (…).pdf` / `stone-notation-20th-century-fulltext.txt` | **Kurt Stone, *Music Notation in the Twentieth Century*, THE WHOLE BOOK** — 189 PDF pages, 88 MB; `.txt` 504 KB, extracted 2026-08-18. ⚠️ Dirtier OCR than Gould's (`Iyp ical`, `sp ace`). ❌ **What it does NOT answer, checked 2026-08-18 so nobody repeats it: hairpins.** His index has **no entry at all** for crescendo, diminuendo, wedge or hairpin; dynamics are pp. 16–19 (absolute vs individual, boxed, `±`, *subito*, niente, note-size dynamics) and pp. 32–33 (which side of the stave). Nothing on hairpin geometry or on a dynamic colliding with one. | added by hand, 2026-08-18 10:00 |
| `musescore-slurs-and-ties-handout.pdf` | 4pp MuseScore user handout. Minor; kept for completeness. | MuseScore docs |
| ⭐⭐ `snap-and-go-baudisch-chi2005.pdf` / `snap-and-go-fulltext.txt` | **Baudisch, Cutrell, Hinckley & Eversole, *Snap-and-go: helping users align objects without the modality of traditional snapping*, CHI 2005** — 10pp, full text, clean text layer. The technique behind the slur endpoint drag's HOLD (`interactions/MouseController`): ⛔ do not teleport within a radius; insert **motor space** at the anchor so every intermediate position stays reachable. What it answered (2026-08-19): the preferred friction widths (5/10/18/34 px tested, 8 of 9 users preferring 18/34, authors' range **20–30**); and 🚨 **it never repays the swallowed motor distance** — its 1-D code returns `x − w + 1` past an attractor, a permanent `w−1` offset per attractor, and it resyncs the *pointer* to the object instead (*"it misses code for updating the mouse pointer to keep knob and pointer together"*). | `patrickbaudisch.com/publications/2005-Baudisch-CHI05-SnapAndGo.pdf`, added 2026-08-19 |
| ⭐⭐ `oh-snap-fernquist-interact2011.pdf` / `oh-snap-fulltext.txt` | **Fernquist, Shoemaker & Booth, *"Oh Snap" – Helping Users Align Digital Objects on Touch Interfaces*, INTERACT 2011** — 8pp, full text. The CATCH-UP half. ⭐⭐ **The hold+catch-up pair IS this paper's own technique**, not a hybrid of the two: §3 *"The object remains stationary unless the user's finger travels a small distance (the snap-width)… Once the finger travels beyond the snap-width, the object starts moving at a rate faster than the finger."* Gain = `(snap + catchup)/catchup` (Eq. 1), recommended 10 px / 20 px. It positions itself **against** snap-and-go (Table 1 scores snap-and-go "No" on *mapping maintained*) and credits the velocity profile to Nacenta et al., GI 2009. 🚨 §2 states the debt problem outright — *"the more snap lines an object crosses, the farther the object would lag behind the finger… in effect 'losing' any direct object-finger correspondence"* — and §3.1 the opposite failure: as catch-up→0 the ratio→∞, objects *jump*, and the gain **quantises** reachable positions. ⚠️ §5.2 is the only inter-anchor rule found: *"future Oh Snap implementations would have to take great care not to overlap the snap and catch-up regions of different snappable lines."* ⭐⭐ **What it answered on 2026-08-20 (his question: it is a TOUCH paper, why are we using it on a mouse?):** §2 divides the world explicitly — *"Snap-and-go works well for relative input devices, such as mice… Unfortunately, snap-and-go is not suitable for direct touch interfaces"* — so by the papers' own account a mouse should use Baudisch and only touch needs this. ⭐ **The reason it transfers anyway is a WEB constraint, not a finger one:** snap-and-go repays its debt by WARPING THE POINTER to the object, and a web page cannot warp a cursor (no pointer warping outside Pointer Lock, which hides it). So on the web a mouse inherits touch's exact failure — the object lags a cursor you can see and nothing resyncs them — which is the failure Oh Snap exists for. ⚠️ Its NUMBERS are not ours to borrow: the study is on multi-touch tabletops, so 10/20 px is unvalidated for a mouse (the slur uses 0.8 × the gap ahead, capped 30 px, tuned by hand). | `cs.ubc.ca/labs/imager/tr/2011/OhSnap/ohsnap.pdf`, added 2026-08-19 |
| `using-sibelius-effectively-sample.pdf` | 20pp **SAMPLE** of *Using Sibelius Effectively*. ⚠️ A sample, not the book. | publisher sample |

### ⚠️ `gecko/` — NOT an engraving source: the BROWSER'S OWN LAYOUT CODE

| file | what it is | where it came from |
|---|---|---|
| `gecko/nLU.cpp` | **`nsLayoutUtils.cpp`** — 10,190 lines, 377 KB. Gecko's layout utility layer: where the geometry queries a script can ask for are actually served, and therefore where a **forced style/layout flush** is decided. | added by hand, 2026-08-22 07:59 |
| `gecko/EC.cpp` | **`EffectCompositor.cpp`** — 983 lines. The animation/restyle side of the same story. | added by hand, 2026-08-22 07:59 |

⭐ **Why they are here.** `docs/render-performance-plan.md` §12.7 measures the render one forced
reflow at a time — *"the flush is ~1.4 ms per frame, paid once, by whoever reads first"* — and four
predictions in that document have already died from reasoning about the browser instead of reading
it (the `hintBarlines` CTM memo is the last of them). These are the primary source for what a
`getBBox()` / `getScreenCTM()` actually costs and when it is free.

⚠️⚠️ **MPL-2.0, third-party, and they stay OUTSIDE `src/`.** Held here as a local research copy
exactly like the treatises above, under the same `.gitignore` rule (`reference/*`), so the bytes are
never committed. ⛔ Nothing from them may be pasted into this codebase — the npm-package goal
(`docs/`) assumes our own licence, and a copied helper would decide that question by accident.

⛔ **UNKNOWN: the revision.** They were copied without a version marker or a URL, so which
mozilla-central changeset they are from is not recorded and cannot be recovered from the files. ⭐ If
a number from them is ever cited, re-fetch the file from searchfox/hg first and quote the revision —
⛔ do not cite these copies as if their line numbers were stable.

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

### What was asked of it on 2026-08-26, and what came back

The question was the **BARLINE FAMILY** — how the final barline, the thin double and the two repeat
signs are actually set, in stave-spaces. ⭐ The first question this library has answered where the
decisive numbers came from a **footnote in Ross** and from **measuring five of Gould's own printed
barlines**, and where the two books' prose and Gould's own drawing **disagree** (again).

⭐⭐ **Where the sections are**: Gould's *Barlines* is printed **p. 38–39** (PDF 58–59) — *Single* ·
*Thin double* · *Final* · *Repeat*, four short paragraphs and **no figure at all**. *Placing repeat
barlines* is **pp. 233–235** (PDF 253–255), *Da Capo/Dal Segno: Double barlines* is **p. 240**.
Ross's *Barlines* chapter is printed **pp. 151–152** (PDF 163–164, at the standing +12 offset) and
the repeat sign's decomposition is a **footnote on p. 147** (PDF 159).

| asked | source | answer |
|---|---|---|
| ⭐⭐ the FINAL barline, in prose | **Gould p. 39** (scan) | *"The thick final line is of **beam thickness**. The thin barline is placed **½ stave-space** before it. The final double barline is used only at the end of a movement."* Beam thickness is fixed at **½ stave-space** on **p. 17** (*"Beam thickness is ½ stave-space"*), so the thick line is **0.5 sp**. ⛔ She gives **no** number for the thin line anywhere — only *"thicker than a stave-line"* (p. 38). |
| ⭐⭐ the same, **MEASURED** | **Gould pp. 238–239**, five engraved final barlines (450 dpi, 1 sp = 20 px) | thin **0.15–0.20 sp** · gap **0.30–0.35 sp** · thick **0.45–0.50 sp** · total ink **0.95–1.00 sp**. ⭐⭐ And **thin-LEFT-edge to thick-LEFT-edge is 0.50 sp in all five**, to the pixel — so her *"½ stave-space before it"* is a **left-edge-to-left-edge** distance, **not** the white gap. |
| where else a final barline is used | **Gould p. 39 + p. 240**; **Gerou & Lusk p. 26** | End of a **movement**, not only of the piece: *"Only the* Fine *bar, the actual end of the piece, takes a final double barline. This is regardless of whether the* Fine *is a whole or an incomplete bar"* (p. 240); G&L: *"Marks the end of a composition, or the end of a movement within a larger work."* ⛔ **The attacca exception**: *"When two movements follow one another without a break, the end of the first movement takes a **thin** double barline"* (Gould p. 39). |
| the THIN DOUBLE, in prose | **Gould p. 39**; **Ross p. 152** | Gould: *"These mark divisions between sections in a piece. They are of ordinary barline thickness, and are placed about **¾ stave-space apart**. It is misleading to use them with every metre change, as they will appear to indicate new sections."* Ross: *"Double barlines indicate the end of a section of music. The lines are approximately **three-quarters of a space** apart."* |
| 🚨🚨 the same, **MEASURED — the ¾ sp is not what she draws** | **Gould pp. 238–239**, five engraved thin doubles | Left-edge to left-edge **0.45–0.55 sp** (white gap ≈**0.30 sp**) — i.e. **the same spacing she gives the final barline's thin↔thick**, and ≈⅔ of the stated ¾. ⭐ All three engines side with the **DRAWING**, not the prose (gaps 0.30–0.40 sp, below). Same shape of finding as the p. 111 slur formula and the p. 103 hairpin aperture: **the number in the sentence is not the number on the plate.** |
| when a thin double is used | **Gould pp. 39, 153, 155, 240** | Before a **time-signature** change *"only when one coincides with a new musical section"* (p. 153); before a **key** change *"only if the key change coincides with a new musical section"* (p. 155); at *"the written end of the music when this is not the end of the piece"* (p. 240); between attacca movements (p. 39). ⛔ Gould p. 240 also forbids it at plain repetition/departure points: *"thin double barlines are **not** used at repetition and departure points that occur on barlines … unless these coincide with a new music section."* |
| ⭐⭐ the REPEAT SIGN decomposed, as NUMBERS | **Ross p. 147**, the footnote (read as a **scan**) | *"Remember that the heavy line in the repeat bar is as thick as a beam (**one-half space**); the white space, and the thin line following the heavy line, are **one-half space**; and the two dots following the thin line are also **one-half space**; this makes a total of **one and a half spaces**."* ⭐⭐ **The only decomposition in any treatise we hold.** Order for a START repeat: **THICK first**, then gap+thin, then dots. |
| the same, second source | **Gould p. 39** | *"These use the final double barline design together with repeat dots. At a barline, the repeat sign replaces the barline."* ⇒ the repeat **inherits** the final barline's geometry; she states no separate numbers. |
| ⭐⭐ WHICH stave-spaces the two dots sit in | **Gould p. 234** (MEASURED) + **Bravura `repeatDots`** | Dot centres **1.48 sp** and **2.48 sp** above the bottom stave-line = centred in the **2nd and 3rd spaces** of a 5-line stave, **1.0 sp apart**. Bravura's precomposed `repeatDots` bbox runs y **1.272 → 2.68**, i.e. centres 1.472 / 2.480 — agrees with her plate to **0.01 sp**. |
| dot DIAMETER, and dot↔thin-line distance | **Gould p. 234** (MEASURED) vs the fonts | Gould: dot ≈ **0.50 sp** wide × 0.55 sp tall (450 dpi, ±0.05, anti-aliasing inflates ~1 px), thin-line right edge → dot left edge **0.35 sp**. SMuFL/Bravura: `repeatDot` **0.40 × 0.40 sp**, `repeatBarlineDotSeparation` **0.16 sp**; MuseScore's style default for the same quantity is **0.37 sp**. ⛔ **No treatise states either number** — Ross's footnote only budgets ½ sp for "the two dots" as a column. |
| ⛔ dots on staves with other line counts | — | **UNKNOWN in the books.** The only rule found is an engine's: LilyPond `scm/bar-line.scm` `make-colon-bar-line` — the pair is **centred on the stave's vertical centre**, and goes in the first gap of the *folded* stave wide enough to hold a dot plus a stave-line; if no gap is, the dots go **outside** the stave. 5-line ⇒ ±0.5 sp (spaces 2 and 3); 4-line ⇒ ±1.0 sp. |
| ⭐⭐⭐ **BACK-TO-BACK repeats, DRAWN** | **Gould p. 234** (prose + a two-design figure, MEASURED) | *"To repeat adjacent sections, use repeat barlines back to back. **Either of the following designs may be used**:"* — and the two she engraves are **(A)** dots · thin **0.15** · THICK **0.50** · thin **0.15** · dots (junction gaps 0.40 / 0.35 sp), one **shared** thick; and **(B)** dots · THICK **0.50** · THICK **0.45** · dots, two thicks with a **0.40 sp** gap and **no thin at all** at the junction. ⛔ **Never two complete separate repeat signs.** |
| the same, in the engines | **LilyPond** `scm/bar-line.scm:1308–1311` + `ly/engraver-init.ly:840`; **MuseScore** `rendering/score/tdraw.cpp` `END_START_REPEAT` | LilyPond's glyph language is `:`=dots, `|`=thin, `.`=thick, and it predefines **both** of Gould's designs — `":|.|:"` = (A) and `":..:"` = (B) — plus `":|.:"` and `":.|.:"`. Its **default** `doubleRepeatBarType = ":..:"` is Gould's **(B)**. MuseScore's only combined type is `END_START_REPEAT`, which draws Gould's **(A)**. |
| ⭐⭐ a repeat at a SYSTEM BREAK | **Gould pp. 233–234, 487** | *"Where possible, the beginning of a repeat should coincide with a new system. This makes the section easiest to locate."* · *"Some editions place a **thin double barline at the end of a previous system** where a repeat barline starts the next system."* · p. 487: *"changes of section should coincide with a new system … as should the start of a repeat section or coda."* |
| the same, as CODE — ⭐ the break behaviour spelled out | **LilyPond** `scm/bar-line.scm:1279–1322`, `(define-bar-line bar eol bol span)` | `".|:"` → eol `#f`, bol `#t`: a **START repeat prints at the beginning of the new line and NOTHING at the end of the previous one**. `":|."` → eol `#t`, bol `#f`: an **END repeat prints at the line end and is not repeated at the next line's start**. `":..:"` → eol `":|."`, bol `".|:"`: the combined sign **SPLITS** across a break. ⭐ Gould's *"some editions"* variant is exactly LilyPond's `".|:-|"` / `".|:-||"` / `".|:-|."`, which choose what the **previous** line ends with. |
| may a FINAL barline fall mid-system | **Gould p. 240** | *"Ideally, a* Fine *bar in the written middle of the piece should be placed at the end of a system."* ⇒ permitted, but put at a line end where possible. Same page: *"It is helpful if sections to be returned to or skipped to can begin on a new system."* |
| ⭐ what a start repeat is placed AFTER | **Gould pp. 233–234** | *"When there is a new clef, key signature or time signature at the beginning of a repeated section, place the repeat marks **afterwards**"* (drawn). And *"Repeat barlines frame a section to be repeated, **except where the repeat is from the beginning of a piece, in which case no initial repeat barline is needed**."* |
| SPACING around one | **Gould pp. 42–43**; **Ross pp. 143, 147** | Gould: *"Allow a stave-space after a clef and **on either side of a barline** before a notational symbol … Where a barline comes before the end of the stave, allow a stave-space at the end of the stave"* (p. 42); *"an accidental or grace note may be closed up to within ½ space of a barline. **Stems must never come closer to a barline than one space**"* (p. 43). Ross: *"Between the barline and the left side of the first note is **one space**"* (1½ sp to the note's **centre**), p. 143; and p. 147 — a repeat bar sits **5½ sp** from a clef's left edge (**7 sp** to its dots) and **3½ sp** after a key signature or a time signature (**5 sp** to its dots). |
| ⛔ EXTRA space *because* a barline is final or a repeat | — | **UNKNOWN.** No such sentence in Gould pp. 38–43 / 233–235 / 240, Ross pp. 143–152, or Gerou & Lusk pp. 25–28. The engines don't have one either: MuseScore's `barNoteDistance` **1.25 sp** / `noteBarDistance` **1.5 sp** and LilyPond's `BarLine` `space-alist` are the same for **every** barline type — the sign is simply **WIDER**, and the width does the work. |
| ⭐⭐ multi-staff: do the DOTS run through the system? | **LilyPond** `scm/bar-line.scm:1312–1313`; **MuseScore** `tdraw.cpp drawDots` | ⭐ The **span-glyph** column is the answer: `".|:"`'s span glyph is `".|"` and `":|."`'s is `" |."` — **the LINES continue between staves, the DOTS do not.** MuseScore agrees structurally: `drawDots` is called per `BarLine` element and takes its y's from **that element's own stave's line count**, so every stave gets its own pair. |
| ⛔ a treatise sentence for that | — | **UNKNOWN.** Gould p. 521 covers only the **systemic** barline (*"the depth of a system is defined solely … by the barline that joins the left-hand edge of all staves"*); Ross pp. 151–152 gives seven cases for which staves a barline **connects** and says nothing about dots. No measured grand-stave repeat figure was hunted down — that is the cheap way to settle it if it ever matters. |
| ⚠️ Gerou & Lusk on the family | **pp. 25–28** | Prose only, **no numbers in stave-spaces**: *"The thickness of a barline is equal to, or greater than, the staff line thickness (staff lines being thicker than stems)"*; DOUBLE BARLINE *(thin/thin)* *"used to clarify the end of a section of music, such as in a Da Capo layout"*; FINAL DOUBLE BARLINE *(thin/thick)* *"Consists of a thin barline followed by a thick barline"*; *"A single staff should never begin with a barline."* |
| ⭐ the ENGINE numbers, in stave-spaces (**implementations, not authorities**) | LilyPond `scm/define-grobs.scm` `BarLine` + `scm/paper.scm`; MuseScore `style/styledef.cpp:177–187`; Verovio `src/options.cpp:1234–1241`; Bravura `engravingDefaults` | **thin**: LilyPond **0.19** (`hair-thickness` 1.9 × `line-thickness`, which `calc-line-thickness` fixes at **0.1 sp** at the default 20 pt stave) · MuseScore `barWidth` = `doubleBarWidth` **0.18** · Verovio `barLineWidth` **0.15** · SMuFL `thinBarlineThickness` **0.16**. **thick**: LilyPond **0.60** (`thick-thickness` 6.0) · MuseScore `endBarWidth` **0.55** · SMuFL `thickBarlineThickness` **0.50**. **gap**: LilyPond `kern` **0.30** (and `segno-kern` 0.30) · MuseScore `doubleBarDistance` = `endBarDistance` **0.37** · Verovio/SMuFL `barlineSeparation` **0.40**. **dots↔line**: SMuFL/Verovio **0.16** · MuseScore **0.37**. ⚠️ LilyPond's own comment on the grob reads *"Ross. page 151 lists other values for `kern`, `segno-kern`, and `hair-thickness`; **we opt for a leaner look**"* — it knows it is not engraving Ross's numbers. |
| ⭐ the same, as TOTAL widths | **MuseScore** `rendering/score/tlayout.cpp:1029–1060`; **Bravura** `glyphBBoxes` | MuseScore: final **1.10 sp** · thin double **0.73** · one repeat sign **1.87** · back-to-back **3.19**. Bravura precomposed: `barlineSingle` **0.144** · `barlineHeavy` **0.500** · `barlineDouble` **0.576** · `barlineFinal` **0.912** · `repeatLeft` / `repeatRight` **1.464** · `repeatRightLeft` **2.428**. ⭐⭐ **Bravura's `repeatLeft` is 1.464 sp — within 0.04 sp of Ross's stated 1½.** ⚠️ The precomposed glyphs are tighter than `engravingDefaults`: `barlineDouble` implies a **0.288 sp** gap where `barlineSeparation` says 0.40. ⛔ SMuFL 1.4's `thinThickBarlineSeparation` is **absent** from the Bravura **1.392** metadata both engine checkouts hold. |

⭐ **The two lessons worth keeping.** (1) **Ross's footnotes carry the numbers his body text does not** —
the whole repeat sign is decomposed in six point type at the bottom of p. 147, and nothing in the
index points at it. (2) **Gould's ¾ stave-space for the thin double is contradicted by her own five
engraved thin doubles** (≈0.5 sp left-to-left, ≈0.30 sp gap), and every engine draws what she drew
rather than what she wrote — the third time the SCAN has beaten the sentence in this directory.

## ⭐⭐ THE FOUR ENGINE SOURCES — on disk, and NOT in this directory

**`~/dev/engine-sources/{MuseScore,lilypond,verovio,inkscape}`** — shallow clones; the three
engraving engines re-fetched 2026-08-18, Inkscape added 2026-08-22.
⭐ **Look here BEFORE cloning anything**: they have now been lost twice to `/tmp` being cleared
(2026-08-16 and again before 2026-08-18), and each rediscovery costs an agent its budget.

⚠️ **Inkscape answers a DIFFERENT KIND of question** and is filed here only because it lives in the
same directory. The other three are asked *what did they engrave*; Inkscape is asked **how does an
interactive vector editor stay fast while you drag something** — see
`docs/render-performance-research.md`. ⛔ It knows nothing about music.

⭐ **Why not under `reference/`**: 846 MB of C++ inside the project directory is reachable by
ripgrep, editor indexing and every `find` we run — a grep for `hairpin` that silently starts matching
MuseScore's source is a confusing afternoon. One directory over, it can only be reached deliberately.
The split is this README's own: **the manifest is committed, the bytes are not.**

| repo | path | branch @ commit | re-fetch |
|---|---|---|---|
| **MuseScore** (645 MB) | `~/dev/engine-sources/MuseScore` | 🚨 **`main`** @ `929d1e9` (2026-08-18) | `git clone --depth 1 https://github.com/musescore/MuseScore.git` |
| **LilyPond** (92 MB) | `~/dev/engine-sources/lilypond` | `master` @ `beedbfa` | `git clone --depth 1 https://gitlab.com/lilypond/lilypond.git` |
| **Verovio** (109 MB) | `~/dev/engine-sources/verovio` | `develop` @ `efff0bc` | `git clone --depth 1 https://github.com/rism-digital/verovio.git` |
| **Inkscape** — ⚠️ not an engraver | `~/dev/engine-sources/inkscape` | `e1e8684` (2026-08-22) | `git clone --depth 1 https://gitlab.com/inkscape/inkscape.git` |

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

⭐⭐ **BARLINE TYPES, SECOND ROUND — asked on 2026-08-26 while P2 was being built**, and both
questions came from HIS eye rather than from the plan. Recorded here because each one changed code:

| asked | source | answer |
|---|---|---|
| **Is the sign a GLYPH or drawn?** (*"i think we are using bravura glyph, correct?… what are the other engines doing, especially musescore?"*) | the three engines, read in source | ⭐⭐ **A SPLIT, unanimously: lines DRAWN, dots STAMPED.** MuseScore `painter->drawLine()` off `Sid::barWidth`/`endBarWidth`/`endBarDistance` + `drawSymbol(SymId::repeatDot, …)` (`rendering/score/tdraw.cpp:668,692`); Verovio `DrawVerticalSegmentedLine()` off `m_barLineWidth`/`m_thickBarlineThickness` + `DrawSmuflCode(…, SMUFL_E044_repeatDot, …)` (`src/view_page.cpp:964–987`); LilyPond `bar-line::draw-filled-box` off `hair-thickness` + `ly:font-get-glyph … "dots.dot"` (`scm/bar-line.scm:227,300`). ⭐ Both C++ engines also **size the sign from the glyph's measured width** rather than a constant. ⇒ we draw the strokes and stamp `repeatDot` (U+E044). |
| **Why can the lines not be glyphs?** | `scripts/vendor/Bravura.json` `glyphBBoxes` | Because the precomposed barline glyphs are **exactly 4.0 staff spaces tall**: `barlineFinal` 1.06 × 4.0, `repeatLeft` 1.464 × 4.0, `repeatRight` 1.468 × 4.0. Four spaces is a five-line staff and nothing else, while a barline must span whatever it is drawn on. ⭐ Corroboration from the font's own design: SMuFL publishes `thinBarlineThickness` / `thickBarlineThickness` / `barlineSeparation` in `engravingDefaults` — a font does not tell you how thick to draw a glyph you are meant to stamp. |
| **Repeat dot geometry** | Bravura + both engines | `repeatDot` box **0.4 × 0.4**, identical to `augmentationDot`; the precomposed `repeatDots` pair sits at **1.472 / 2.480** above the bottom line, which is Gould's measured 1.48 / 2.48 to 0.01. ⭐ MuseScore computes the two heights from the staff's line count instead of hardcoding, and its formula lands on **space centres for every count** (5 lines → 1.5/2.5, 4 → 0.5/2.5, 1 → −0.5/0.5). ⚠️ Verovio deliberately differs: `3 - lines % 2` gives an EVEN staff **three** dots. |
| ⭐⭐ **Do the ENGINES let you put one on the first bar anyway?** (his follow-up: *"i know what gould do, but i also remember that sibelius allow to place it if the user want, what does musescore does?"*) | MuseScore, LilyPond, VexFlow, read in source | ⭐ **All three allow it; two differ only in the DEFAULT.** **MuseScore** — no first-measure exception exists: `MeasureLayout` (`rendering/score/measurelayout.cpp:315`) is `if (measure->repeatStart())` → create the `StartRepeatBarLine` segment, full stop. **LilyPond** — off by default, on by an explicit property: `Bar_engraver` (`lily/bar-engraver.cc:448`) reads `if (!first_time_ || printInitialRepeatBar)`, and its manual gives the musical reason — *"By default, a starting bar line is not automatically printed at the beginning of a piece, in accordance with classical engraving conventions. However, in some contexts, these bar lines are **traditionally added, such as in lead sheets for jazz standards**"* (`Documentation/en/notation/repeats.itely:160`). **VexFlow** — `setBegBarType(REPEAT_BEGIN)` on any stave; it has no notion of a first measure to special-case. ⛔ **Sibelius: UNKNOWN** — no source to read; his recollection that it allows one is consistent with the other three and is recorded as his, not as a checked fact. ⭐⭐ **And the reason WE need no switch:** LilyPond derives the sign from `\repeat volta` STRUCTURE, so it must decide whether to *infer* one at the start; we never infer — every sign is placed by hand — so there is nothing to suppress and nothing to switch back on. |
| ⭐⭐ **What if I deliberately want an open repeat on the FIRST bar?** | **Gould p. 234** + **Ross p. 147** | Two independent statements, same direction. Gould, *Placing changes of clef, key signature and time signature*: *"When there is a new clef, key signature or time signature at the beginning of a repeated section, place the repeat marks **afterwards**"* — with the parenthesis *"(If the example above were the opening of a piece, the initial repeat barline would be **unnecessary**.)"* And p. 233: *"Repeat barlines frame a section to be repeated, **except where the repeat is from the beginning of a piece, in which case no initial repeat barline is needed**."* Ross p. 147 gives the same ORDER as three numbered spacings — repeat bar after a clef (5½ spaces, clef-left to repeat-left), after a key signature (3½ from the last accidental), after a time signature (3½ from its left side). ⇒ **header first, then `|:`** — which is a rule about the DRAWING, and it also means a displaced repeat suppresses no line. ⭐ "Unnecessary" is advice to the composer, not a constraint on the editor: if it is asked for, it is drawn. |

⭐ **BARLINE TYPES — where each engine keeps them** (checked 2026-08-26, same three revisions):

- **MuseScore** — the enum is `src/engraving/types/types.h:460` (`BarLineType`, **bit flags**); the
  drawn item is `src/engraving/dom/barline.{h,cpp}`; the *widths* are `barLineWidth()` in
  `src/engraving/rendering/score/tlayout.cpp:1024`, the *strokes* `TDraw::draw(const BarLine*)` +
  `drawDots()` in `rendering/score/tdraw.cpp:668`, and the type is chosen in
  `rendering/score/measurelayout.cpp:807` (`createEndBarLines`). ⚠️ **A SMuFL font does NOT push its
  `engravingDefaults` into the style at load** — checked 2026-08-26 after an agent claimed it did.
  `EngravingFont::loadEngravingDefaults` (`src/engraving/internal/engravingfont.cpp:754`) parses the
  map, but the **only** consumer in the whole tree is `EditStyle::valueChanged`
  (`src/notationscene/widgets/editstyle.cpp:2370`) — the Style *dialog*, and only when the user
  changes the musical symbol font **with the "optimize style" box ticked**. So `styledef.cpp`'s
  0.18/0.55/0.37/0.37/0.37 sp is what MuseScore actually draws, whatever font is loaded. Those
  values equal Leland's (`fonts/leland/leland_metadata.json`) because Leland is the default font and
  they were chosen to match — ⛔ the causation does not run the other way. (Verovio is the opposite
  case: `src/options.cpp:2144` really does convert `engravingDefaults` into its options, but only
  from an explicitly supplied file — the shipped `data/*.xml` carry none.) Barline widths are also
  **not** scaled to staff size: `Sid::scaleBarlines` defaults `false` (`styledef.cpp:792`).
- **LilyPond** — ⛔ **`lily/bar-line.cc` DOES NOT EXIST**; it was ported to Scheme. The drawing is
  `scm/bar-line.scm` (the `define-bar-line` table at `:1279–1344`, one row per glyph with
  **end-of-line / begin-of-line / span** variants), the numbers are the `BarLine` grob at
  `scm/define-grobs.scm:261–317`, the *defaults per context* are `ly/engraver-init.ly:835–853`
  (`measureBarType`/`fineBarType`/`startRepeatBarType`/…), and the C++ is only the engraver,
  `lily/bar-engraver.cc` (`calc_bar_type` at `:183`). Thicknesses are multiples of `line-thickness`,
  which is **0.1 sp** at the default 20 pt staff (`scm/paper.scm:52`, `calc-line-thickness`).
- **Verovio** — the enum is `libmei/dist/atttypes.h:256` (`data_BARRENDITION`), the drawing
  `View::DrawBarLine` / `DrawBarLineDots` in `src/view_page.cpp:820`/`:951`, the numbers are
  **options**, not font data — `src/options.cpp:1236/1240/1458/1553` — and the shipped `data/*.xml`
  fonts carry **no `engravingDefaults`**, so those option values are what it actually draws. The
  left/right reconciliation is `Measure::SetDrawingBarLines`, `src/measure.cpp:644`.

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

## ⭐⭐ THE ONLINE SPECS — the routes, and the three that MOVED (2026-08-26)

Not treatises and not on disk, but the same kind of fact this manifest exists to hold: **where the
normative pages actually live now**. All three of these have moved off the URLs that search engines,
blog posts and older tooling still hand you, and each redirect chain costs a fetch to discover.

| spec | ⛔ the DEAD/stale route | ✅ what serves content |
|---|---|---|
| **SMuFL** | `w3c.github.io/smufl/*` → 301 → `w3c-cg.github.io/smufl/*` → 301 | **`smufl.formats.music/latest/`** — only the last hop serves |
| **MNX** | `w3c.github.io/mnx/docs/*`; the archived `/specification/common/` is **gone entirely** | **`mnx.formats.music/docs/`** |
| **Bravura metadata** | ⛔ `bravura_metadata.json` — the name in most blog posts and older tooling — **404s on every branch** | **`redist/Bravura.json`** in `steinbergmedia/bravura` |
| **MusicXML 4.0** | — | `w3.org/2021/06/musicxml40/musicxml-reference/` (elements / data-types / examples) |
| **MEI v5** | — | `music-encoding.org/guidelines/v5/` |

⚠️ **Version skew is real and bites**: the Bravura metadata in the two engine checkouts is **1.392**,
which has **no `thinThickBarlineSeparation`**; the shipped `redist/Bravura.json` at HEAD is **1.482**,
which does. Say which you read.

⭐ These are **implementations and interchange formats, not authorities** — the same standing caveat
as the engines. A spec says what a file may CONTAIN; only a treatise says what an engraver DRAWS.

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

### What was asked of it on 2026-08-27, and what came back

The question was the **KEY SIGNATURE**, whole: placement per clef, spacing, cancellation, cautionary
practice, and how the change is edited. Five passes ran in parallel (this library; the three engine
checkouts; MusicXML/MEI/SMuFL + the four applications; a UI survey).

📄 **The answers are digested in `docs/key-signature-research.md`** — go there, not to the scratchpad,
which does not survive. Only what is *about this library* is recorded here.

| asked | source | answer |
|---|---|---|
| the section itself | **Gould pp. 91–94** | `KEY SIGNATURES` — *Placing and order* 91, *Spacing* 92, *Key changes* 92–93, non-tonal 93–94. ⛔ **The horizontal numbers are NOT there** — they are in *Spacing symbols*, **pp. 41–43**. Cautionary/warning signatures: **pp. 233–235**. Glyph proportions + "same size as any accidental": **pp. 77–78**. |
| ⭐⭐ staff position per letter per clef | **Gerou & Lusk pp. 80–81** | 4 clefs × 7 sharps + 7 flats, **drawn with no prose at all** — the figure IS the specification. All 56 signs measured at 400 dpi; the table is in the research doc. ⭐ Gould's own four-clef figure (p. 91) and MuseScore's `ClefInfo::m_lines` array agree with it independently. |
| the tenor-clef exception | **Gould p. 91** + both figures | *"The arrangement is identical in each clef except for the tenor-clef layout of sharps"* — and the drawing says it is exactly **two signs**: F♯ and G♯ drop an octave. ⛔ **There is NO alto-clef exception**; A♯ is at A3, the plain shifted pattern. |
| ⛔ "keep the signs inside the staff" | **Gould, measured** | **No such rule.** Her bass 7-flat puts F♭2 *below* the bottom line and the treble 7-sharp puts G♯5 *above* the top line. What the drawings obey is the weaker **"never needs a ledger line"** — which no treatise states in prose. |
| ⭐ kerning a signature | **Gould p. 92** | **Forbidden, in as many words**: flats in ascending fourths *"will fit in very close to each other — but keep the key signature evenly spaced … Do not overlap the flats"*, with four dashed guides marking the even grid. (MuseScore tucks them into the SMuFL cut-out; that is the engine disagreeing with the treatise.) |
| ⭐ spacing, as an engraver states it | **Ross pp. 143–147** | His prose and his own engraving **AGREE** here (unlike the hairpin): flat→flat **1**, sharp→sharp **1 or 1¼** (he engraves 1.24), clef→1st accidental **3½**, last accidental→note **3½**. ⭐ He states the convention: every number is **left-of-character to left-of-character**. |
| 🚨 the same, from Stone | **Stone pp. 44–45** | **A DIFFERENT CONVENTION — his numbers are GAPS (white space), Ross's are ORIGINS.** Not a contradiction (his footnote defers to Ross by name), but mixing the two tables is a silent **~1 sp** bug. |
| ⭐⭐ is cancelling with naturals old-fashioned | **Ross p. 149** vs **G&L p. 79** | **A DATED SHIFT, which is better than an opinion.** Ross, 1970: *"At present, most engraved music employs cancellation signs."* Gerou & Lusk, 1996: *"Cancellations are no longer considered necessary, unless the new key is C major or A minor."* 1996's is where all five modern implementations landed. |
| a double barline at a key change | **Gould p. 92** | *"A double barline precedes the new key signature **only if the key change coincides with a new musical section**."* Every key change she draws uses a plain single barline. |
| a simultaneous clef + key change | **Gould p. 92**, **G&L p. 52**, **Ross p. 168** | Three sources, no dissent: the **clef goes BEFORE the barline, the key and meter AFTER it** — and the signature is spelled in the NEW clef. |
| 🚨 a courtesy accidental the key already covers | **Gould p. 81** | *"This practice holds good **even when a key signature corrects the accidental**"* — with a figure in E♭ major where an explicit ♭ is still written. ⛔ An accidental engine must not suppress it. |
| ⛔ does a key CHANGE reset in-bar accidentals | — | **UNKNOWN in all three treatises** — checked, not skipped. They say only that a BARLINE resets accidentals and never the signature (Stone p. 53, Ross p. 130). All three engines reset; that rule is taken from code, and it is recorded as such. |
| ⛔ octave-transposing clefs | — | **UNKNOWN.** Gould pp. 506–507 never mention key signatures; Ross and Stone have nothing. (The three engines all say "no effect".) |
| ⛔ vertical placement, from Ross or Stone | — | **Checked negatives, so nobody re-reads them**: Ross's index gives only *Key changes 148–149* and *Key signature spacing 143–147*, both read in full; Stone's only entry is *key signatures, 44–45*, which is spacing. |

⚠️ **TWO NEW PAGE OFFSETS, and neither is the simple `+n` the two books above have** — both were
worked out the hard way on 2026-08-27:

- **Gerou & Lusk: one PDF page is a two-page SPREAD.** `PDF n = printed 2n−4 / 2n−3`.
- **Stone: `PDF n = printed 2n−22 / 2n−21`.**

⭐ **And Gould's drawings CONFIRM Bravura's metrics**, which is worth knowing before hand-measuring
anything else: her key-signature sharp is **1.00 sp** wide against the font's 0.996 advance, her flat
0.85–0.90 against 0.904. (The natural is the one that differs — drawn 0.75 against 0.672.)

⛔ **Dead or moved routes found on 2026-08-27** (the same failure mode as the darkened Gould):

- **SMuFL's spec has moved TWICE** — `w3c.github.io/smufl` → `w3c-cg.github.io/smufl` → and only
  **`http://smufl.formats.music/latest/…`** serves content today.
- Bravura's metadata file is **`redist/Bravura.json`**, not `bravura_metadata.json` (404).
- **`steinberg.help` is a JavaScript reader** — curl and WebFetch get a nav shell, never a topic. The
  working route is **`archive.steinberg.help/dorico/v2|v4|v5/…`** (v4 has full bodies, v5's are stubs,
  v3/v3.5 are 404). Dorico ≥6 topic bodies: unreachable.
- `usermanuals.finalemusic.com/FinaleMac/…` 403s to curl; the **versioned** trees work.
- ❌ **MPA's *Standard Music Notation Practice* is image-only past p. 3 and has no key-signature
  section**; **MOLA is silent on cancellation** (checked) though it does require the end-of-line
  cautionary.

### What was asked of it on 2026-08-28, and what came back

The question was **the TIME SIGNATURE ACROSS STAVES**: where two staves of one system carry key
signatures of DIFFERENT widths (one has a key and the other none, or the two hands are in different
keys), is each staff's meter placed after its own signature, or are the meters aligned? Asked because
of a grand-staff screenshot in which the two meters did not line up. A second pass read the three
engine checkouts (⛔ not this library — see `docs/key-signature-plan.md` §8.5d for that half).

| asked | source | answer |
|---|---|---|
| ⭐⭐ are the two meters ALIGNED? | **Gould p. 326** (the Cowell *The Tides of Manaunaun* extract, under *Keyboard ▸ Note clusters*) | **YES, to the pixel.** Grand staff, **upper staff 6 flats, lower staff 1 flat**, both printing `4/2`. Measured off the 450 dpi scan (staff lines give 1 sp = 20 px exactly, ink-column profile with the staff-line rows masked): clef ink 302–359 / 303–358, key ink 380–**487** / 380–**397**, and `4/2` ink **513–543 on BOTH staves — Δ = 0.00 sp**. The one-flat staff's meter is not placed after its own key: it waits **5.80 sp**, where the six-flat staff waits 1.30. ⭐ Both signatures also BEGIN at the same x (380). |
| the sentence that licenses the case | **Gould p. 94** | *"An instrument on two (or more) staves can take an individual key signature for each stave. (Bartók employs this frequently, e.g. in 14 Bagatelles, op. 6; see also Cowell extract, p. 326.)"* ⚠️ p. 94 itself has **no figure** — the pointer to p. 326 IS the drawing. |
| ⛔ a PROSE statement of the alignment rule | — | **UNKNOWN.** Read and not found: Gould pp. 41–43, 91–94, 233–235; Ross pp. 143–152; Stone pp. 44–45; Gerou & Lusk pp. 78–81 (their whole alignment sentence is *"Key signatures appear after the clef but before the time signature"*). ⭐ So the rule rests on the measured p. 326 engraving — quote the measurement, ⛔ never an invented sentence. |
| the nearest prose PRINCIPLE (analogy only — it is about notes, not meters) | **Stone p. 45** | *"In music requiring two or more staves, the notes having accidentals (if any) are spaced according to the rules above, and the notes without accidentals must be aligned vertically with the notes having the accidentals, not with the accidentals"* — drawn on a grand staff with a dashed guide. |
| ⭐ key signature → time signature, a THIRD opinion (we use 1.15 sp, ink to ink, from LilyPond) | **Gould p. 41**, **Stone p. 45**, **Ross p. 145** | Gould: *"Separate the clef, key signature, time signature by 1–1½ stave-spaces"* (her p. 42 figure's brackets measure 1.0 and 1.53; ⚠️ her own engraving of it runs 1.88 sp ink-to-ink, and the Cowell staff measures 1.30). Stone: *"between the key signature and the time signature: one staff-space"*, and he says these are GAPS (*"With cutting edges of staff to show how to measure the gaps"*) — **1.00 sp ink-to-ink**, our convention exactly. Ross: *"the space between the left side of the last sharp or flat in the key signature, and the left side of the time signature, is two and a half spaces"* — ORIGIN to origin, so ≈**1.5 sp** in ink. ⇒ our 1.15 sits inside Gould's stated range and just above Stone; Ross is the outlier. |

### What was asked of it on 2026-08-28 (second question), and what came back

The question was **the BARE STAFF after a cautionary key signature at a system break** — how much, and
does the staff run to the right margin or stop after the signs? Asked because the first pass's 1.9 sp
looked long on screen. A parallel pass read the three engines (⛔ not this library; the numbers are in
`docs/key-signature-plan.md` §8.6a).

| asked | source | answer |
|---|---|---|
| ⭐⭐ how much bare staff after the courtesy | **Gould p. 93**, measured at **600 dpi** (1 sp = 26.5 px) | **≈1.9 sp**, confirmed on THREE instances of the figure independently: 1.89 (traditional practice), 1.85 (contemporary), 2.08 (simultaneous key + clef). Barline → first sign measures **0.64–0.72 sp**. ⚠️ **The first pass labelled this same measurement "450 dpi"** — 26.5 px/sp IS 600 dpi (450 would give 19.9). The number was right and the label was not; both are corrected in `engine/layout/cautionaryKey.ts`. |
| ⛔ does her staff reach the right margin? | **Gould p. 93** | **NO, and the figure cannot answer the question**: her staff ends at x = 2004 against a text measure of 3338, and so does the "new system" beside it. Both are labelled excerpts of unequal length. |
| ⭐⭐ the only MATCHED PAIR in the library | **Gerou & Lusk p. 78** (courtesy key) and **p. 52** (courtesy key + meter) | The courtesy staff and the staff below it are drawn to **the same right edge** (1761 vs 1763; 1731 vs 1731) — i.e. the staff runs the system's full width, with the signs **0.42 / 0.53 sp** from the end. ⇒ **the tail is a RESIDUAL, not a constant**, which is exactly what ours is. ⚠️ **p. 78, not p. 28** — the earlier pass mis-cited the courtesy-key rules; corrected in the plan and in `cautionaryKey.ts`. |
| ⛔ a stated DISTANCE for the tail | — | **UNKNOWN — no source states one.** G&L p. 78 rule 3 is *"The staff is left open after the courtesy key signature"*; Ross p. 148 *"a key change should be made at the end of a staff or system (the staff remains open)"*. The nearest prose is about a barline, not a courtesy — **Gould p. 42**: *"Where a barline comes before the end of the stave, allow a stave-space at the end of the stave"* (engraved 1.09 sp on p. 43, 1.13 on p. 152). |
| ⛔ signs drawn PAST the staff's end | — | **None found** in seven measured figures — ⚠️ which is not a prohibition: no source addresses it. (Our first build did exactly that, and his eye caught it: *"where is the pentagram?"*) |
| the courtesy METER's tail | **Gould p. 152** | *"add a cautionary indication at the end of the first system, after the last barline"* — measured tail **1.13 sp**, and no closing line. |
| ⭐⭐ the courtesy CLEF is the OPPOSITE, and three sources agree | **Gould p. 7**, **Stone p. 57**, **G&L p. 52** | *"placing the new Clef at the end of the previous system before the barline"* / *"placed at the end of the line before the barline"*. Measured: clef → barline **0.52 sp**, then a **full-height barline CLOSES the staff** (110 dark px). ⇒ key and meter are drawn after the line and left open; the clef is drawn before it and closed. |
| a closing mark after a courtesy key/meter | **Gould pp. 93 & 152, G&L pp. 78 & 52** | **None** — pixel-checked at each staff end (14 / 13 / 20 / 17 px = staff lines only). G&L p. 52 labels it in the figure: *"Also notice the **open staff** after the courtesy key signature and time signature."* |
| ⚠️ a DOUBLE barline before the courtesy | **Ross p. 148**, **G&L p. 78** vs **Gould p. 93** | Ross and G&L both engrave a **thin double** before it; Gould draws a **single** (0.30 sp). ⛔ We generate none — his standing decision (plan §4.2b), recorded because three of five sources disagree with us. |

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
