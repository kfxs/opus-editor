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
quotations now sitting in `docs/plans/slur-plan.md`. Two agents spent a large part of their budget
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
| `Music Notation in the Twentieth Century A Practical Guidebook (Kurt Stone) (…).pdf` / `stone-notation-20th-century-fulltext.txt` | **Kurt Stone, *Music Notation in the Twentieth Century*, THE WHOLE BOOK** — 189 PDF pages, 88 MB; `.txt` 504 KB, extracted 2026-08-18. ⚠️ Dirtier OCR than Gould's (`Iyp ical`, `sp ace`). ❌ **What it does NOT answer, checked 2026-08-18 so nobody repeats it: hairpins.** His index has **no entry at all** for crescendo, diminuendo, wedge or hairpin; dynamics are pp. 16–19 (absolute vs individual, boxed, `±`, *subito*, niente, note-size dynamics) and pp. 32–33 (which side of the stave). Nothing on hairpin geometry or on a dynamic colliding with one. ⭐⭐ **What it DOES answer, found 2026-09-01: THE STEM — a complete chapter, `Stems → A. Stem Lengths`, printed pp. 47–49, in seven numbered cases** (single notes · intervals and chords · beamed groups · flagged notes · double-stemmed · grace · cues), plus `B. Stem Directions`. It is the most systematic stem statement in this library and nothing here had ever asked him. ⭐⭐ **And what it answers on the CLEF vs the METER at a barline, found 2026-09-13: printed p. 46, *General conventions* §§ B and C** — he is the **only** source in this library that states BOTH distances in prose, one paragraph apart (*"about one staff-line space before the barline"* for a clef change, *"one staff-line space after the barline"* for a time-signature change), and ⭐ his own plate draws what he wrote (measured 0.90/1.25 and 0.83/0.97 sp). Same page: *"There are no specific rules for clef changes within a measure."* Highlights: *"all stems must either cross the middle line or reach it"*; 3½ in a space / **3¼ on a line** for beamed notes; *"from three flags on"* for flag lengthening; grace ≈2½ sp, cue ≈3 sp. ⚠️ **PAGE OFFSET: THE PDF IS 2-UP.** Printed pp. 48–49 are PDF page **35** (left/right halves); printed 47 is the right half of PDF 34. ⛔ Not a simple `+n`. | added by hand, 2026-08-18 10:00 |
| `musescore-slurs-and-ties-handout.pdf` | 4pp MuseScore user handout. Minor; kept for completeness. | MuseScore docs |
| ⭐⭐ `snap-and-go-baudisch-chi2005.pdf` / `snap-and-go-fulltext.txt` | **Baudisch, Cutrell, Hinckley & Eversole, *Snap-and-go: helping users align objects without the modality of traditional snapping*, CHI 2005** — 10pp, full text, clean text layer. The technique behind the slur endpoint drag's HOLD (`interactions/MouseController`): ⛔ do not teleport within a radius; insert **motor space** at the anchor so every intermediate position stays reachable. What it answered (2026-08-19): the preferred friction widths (5/10/18/34 px tested, 8 of 9 users preferring 18/34, authors' range **20–30**); and 🚨 **it never repays the swallowed motor distance** — its 1-D code returns `x − w + 1` past an attractor, a permanent `w−1` offset per attractor, and it resyncs the *pointer* to the object instead (*"it misses code for updating the mouse pointer to keep knob and pointer together"*). | `patrickbaudisch.com/publications/2005-Baudisch-CHI05-SnapAndGo.pdf`, added 2026-08-19 |
| ⭐⭐ `oh-snap-fernquist-interact2011.pdf` / `oh-snap-fulltext.txt` | **Fernquist, Shoemaker & Booth, *"Oh Snap" – Helping Users Align Digital Objects on Touch Interfaces*, INTERACT 2011** — 8pp, full text. The CATCH-UP half. ⭐⭐ **The hold+catch-up pair IS this paper's own technique**, not a hybrid of the two: §3 *"The object remains stationary unless the user's finger travels a small distance (the snap-width)… Once the finger travels beyond the snap-width, the object starts moving at a rate faster than the finger."* Gain = `(snap + catchup)/catchup` (Eq. 1), recommended 10 px / 20 px. It positions itself **against** snap-and-go (Table 1 scores snap-and-go "No" on *mapping maintained*) and credits the velocity profile to Nacenta et al., GI 2009. 🚨 §2 states the debt problem outright — *"the more snap lines an object crosses, the farther the object would lag behind the finger… in effect 'losing' any direct object-finger correspondence"* — and §3.1 the opposite failure: as catch-up→0 the ratio→∞, objects *jump*, and the gain **quantises** reachable positions. ⚠️ §5.2 is the only inter-anchor rule found: *"future Oh Snap implementations would have to take great care not to overlap the snap and catch-up regions of different snappable lines."* ⭐⭐ **What it answered on 2026-08-20 (his question: it is a TOUCH paper, why are we using it on a mouse?):** §2 divides the world explicitly — *"Snap-and-go works well for relative input devices, such as mice… Unfortunately, snap-and-go is not suitable for direct touch interfaces"* — so by the papers' own account a mouse should use Baudisch and only touch needs this. ⭐ **The reason it transfers anyway is a WEB constraint, not a finger one:** snap-and-go repays its debt by WARPING THE POINTER to the object, and a web page cannot warp a cursor (no pointer warping outside Pointer Lock, which hides it). So on the web a mouse inherits touch's exact failure — the object lags a cursor you can see and nothing resyncs them — which is the failure Oh Snap exists for. ⚠️ Its NUMBERS are not ours to borrow: the study is on multi-touch tabletops, so 10/20 px is unvalidated for a mouse (the slur uses 0.8 × the gap ahead, capped 30 px, tuned by hand). | `cs.ubc.ca/labs/imager/tr/2011/OhSnap/ohsnap.pdf`, added 2026-08-19 |
| `using-sibelius-effectively-sample.pdf` | 20pp **SAMPLE** of *Using Sibelius Effectively*. ⚠️ A sample, not the book. | publisher sample |

### ⚠️ `gecko/` — NOT an engraving source: the BROWSER'S OWN LAYOUT CODE

| file | what it is | where it came from |
|---|---|---|
| `gecko/nLU.cpp` | **`nsLayoutUtils.cpp`** — 10,190 lines, 377 KB. Gecko's layout utility layer: where the geometry queries a script can ask for are actually served, and therefore where a **forced style/layout flush** is decided. | added by hand, 2026-08-22 07:59 |
| `gecko/EC.cpp` | **`EffectCompositor.cpp`** — 983 lines. The animation/restyle side of the same story. | added by hand, 2026-08-22 07:59 |

⭐ **Why they are here.** `docs/history/render-performance-plan.md` §12.7 measures the render one forced
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

### ⭐⭐ `belle/` — BELLE, BONNE, SAGE: the EYE-MUSIC precedent (and the two SPACING papers it led to)

**Added 2026-08-29, at his request.** ⛔⛔ **THIS IS NOT A SOURCE FOR TRADITIONAL ENGRAVING, AND IT
IS NOT A FOURTH ENGINE.** The engines asked *what did they engrave* are still, and only,
**Verovio · LilyPond · MuseScore** (the section below). Belle is asked exactly one kind of question:
**the one the other three cannot be asked at all** — *what does a drawing model have to look like so
that a score can be a bicycle, a spiral, or a bent staff, without giving up professional engraving?*
⛔ Do not cite Belle for a notehead's spacing, a slur's shape, a barline's thickness or any other
convention: the treatises and the three engines answer those, and Belle would only be a fourth
opinion with no plate behind it.

⭐ **Why it earns a place anyway.** `docs/plans/own-engraving-engine.md` plans a **SCENE** (§7.2), and the
open question in a scene is what a primitive is allowed to be *placed by*. Our stated goals are
professional engraving **and** contemporary music / graphic scores, with eye-music transformations
(a bent staff, a spiral staff, a staff around a wheel) as something the engine must not make
*impossible* — a score's author decides. Belle is the one **precedent** for that combination: it
exists because its author needed to engrave one piece of eye music and no tool would do it, and it
grew from there into a conventional engraver that *"strives to conform to typesetting guidelines set
forth in Behind Bars"*.

| file | what it is | where it came from |
|---|---|---|
| ⭐⭐ `burnson-introducing-belle-bonne-sage-icmc2010.pdf` / `belle-icmc2010-fulltext.txt` | **Burnson, *Introducing Belle, Bonne, Sage*, ICMC 2010, pp. 482–485** — 4pp, clean embedded text layer, so the `.txt` is **quotable as it stands** (⛔ unlike Gould's OCR). ⭐ **The origin, stated in the abstract**: *"In the search for a suitable tool for notation to engrave his graphic symbol piece Bike Ride, the composer starts from scratch, developing a corpus of vector-graphics tools for music notation Belle, Bonne, Sage in deference to a 14th century piece of eye music under the same name by Baude Cordier. The technical problems posed by this feat, once solved, become solutions to other gaps in current music notation technology."* ⭐⭐ And §3 RENDERING is the part that matters to us: *everything* — glyphs, stems, lines, text — is converted to **filled vector paths** so that one scanline algorithm draws all of it, and a stemmed note is drawn as **a single union outline** so the join cannot show. | wayback → ICMC proceedings, 2026-08-29 |
| ⭐⭐ `bike-ride-icmc2010-p2-200dpi.png` / `…-450dpi.png` | **Figure 2 — *Bike Ride* (2007, rev. 2009) for solo piano, dedicated to Barry and Mary Hannigan, print 18″ × 32″** — page 483 rendered whole. ⭐ **Look at it before designing anything for eye music**: the two wheels are staves bent into circles with beamed music running round the rims, the spokes are drawn as radial lines, and *two* straight staves run along the bottom as the road. A SCAN beats a sentence here too — it shows what the geometry actually had to do. ⭐⭐ **And it was MEASURED on 2026-08-29** — `bike-ride-rim-detail-600dpi.png` and `bike-ride-beamgroup-detail-1200dpi.png` beside it: the staff lines are **true arcs**, the noteheads/accidentals/clefs/tuplet numerals/text are **rotated, never deformed**, and 🚨 **the beams are STRAIGHT chords crossing the arcs** — the rigid unit is the *beamed group*, rotated whole, with the curvature absorbed between groups. **Nothing in the piece is warped.** Written up as `docs/plans/own-engraving-engine.md` §7.5.5. | rendered from the PDF above |
| ⭐ `burnson-kaper-automatic-notation-icmc2010.pdf` / `burnson-kaper-icmc2010-fulltext.txt` | **Burnson, Kaper & Tipei, *Automatic Notation of Computer-Generated Scores for Instruments, Voices and Electro-Acoustic Sounds*, ICMC 2010** — Belle as the printing back-end for **DISSCO** (CMOD + LASS). Its subject is the interface between a *generated* score and an engraver, and its requirement list is the one we share: *"handling of both traditional, proportional, and graphic notation; dealing with instrumental/vocal parts as well as electro-acoustic sounds; and providing high quality, publishable documents"*. ⚠️ Only the abstract and §1 have been read (2026-08-29). | wayback → ICMC proceedings, 2026-08-29 |
| ⭐⭐ `solomon-horizontal-spacing-graphical-notation-icmc2011.pdf` / `solomon-icmc2011-fulltext.txt` | **Mike Solomon, *The Horizontal Spacing of Graphical Notation*, ICMC 2011, pp. 689ff** — ⭐⭐ **the single most useful thing in this folder for the "contemporary music" half of the goal**, and it is not by Burnson. It asks the question we will have to answer: *how does a GRAPHIC object take part in a normal spring/rod line of music?* Its answer is a **linear program** that stretches a vector graphic so it hits horizontal **"target points"** in the score while spreading the distortion over the whole graphic instead of at the anchors. ⭐ §2.2 is also a compact, sourced history of spacing itself — Gourlay's box-glue, **Haken & Blostein for the words *spring* and *rod***, Renz's "neighbourhoods", and a bulleted summary of **LilyPond's algorithm** (columns, one spring per adjacent pair, non-adjacent rods, `S → 2W`, `D(2S)=3W`, `D(4S)=4W`, the common-shortest-duration). ⭐ **What it answered (2026-08-29): `docs/research/spacing-model-research.md` §6f** — the sourced history, the bulleted LilyPond algorithm, and the *spanners across line breaks* argument for why a graphic must ride the piece-wide solve. It also **partly answers §6e's "nobody was found to have done this"**. ⚠️ §§1–3.1 read; the LP matrices later in §3 are unread. ⚠️ It is also mildly **critical of Belle** — *"context-agnostic tools such as this do not draw upon the many musical engraving conventions"* — which is exactly the trap our own engine has to avoid. | wayback → ICMC proceedings, 2026-08-29 |
| ⭐⭐ `haken-blostein-horizontal-spacing-icmc1995.pdf` + `haken-blostein-icmc1995-p1.png` / `-p2.png` | **Lippold Haken & Dorothea Blostein, *A New Algorithm for Horizontal Spacing of Printed Music*, ICMC 1995, pp. 118–119** — the algorithm used in the **Lime** editor, and ⭐⭐ **the primary source for the vocabulary `docs/plans/spacing-model-plan.md` already uses**: *springs* between simultaneities with a constant derived from the **shortest note sounding**, an **inverse-logarithmic** duration→constant function, *rods* spanning one or more springs, a very stiff spring standing for a barline's white space. 🚨 **2 pages, and it is a SCAN with NO text layer** (`pdftotext` yields nothing, `tesseract` is not installed) — read the two PNGs beside it. Reached from Solomon's bibliography and from Belle's own README, which links it as the source of its "spring spaces". ⭐ **Both pages read; what it answered is `docs/research/spacing-model-research.md` §6f** — incl. two details no summary of it states: the spring constant comes from the shortest note **sounding** (*"may be held over from a previous simultaneity"*), and the rod solve is a **greedy maximal-force sweep**, not a global one. ⚠️ **Gourlay 1987 itself is NOT on disk** — an OSU tech report, never fetched: ⛔ UNKNOWN, not silent. | wayback → ICMC proceedings, 2026-08-29 |
| `eye-music-wikipedia.html` / `.txt` | **Wikipedia, *Eye music*** — the term itself and its canon: Cordier's heart-shaped `Belle, bonne, sage` and circular `Tout par compas suy composés`, Josquin's blackened notation, Bull's circular canon, Marcello's enharmonic spellings, Telemann's `3/32` and `24/1` in the *Gulliver Suite*, and Crumb's circles/spirals/crosses. ⚠️ **A tertiary source** — fine for the vocabulary and for a list of what has been done, ⛔ never for a rule. | `en.wikipedia.org/wiki/Eye_music`, 2026-08-29 |

⭐ **The code is a CLONE, and it is NOT in this directory** — `~/dev/engine-sources/belle`,
`main` @ `25012b1` *"Belle 1.0.2: open-source release of Belle"*, 7.1 MB, same rule as the five
below. ⚠️ **The whole repo is ONE commit** — `git fetch --unshallow` returns nothing, so there is no
history to read. **BSD-2-Clause** (`Copyright 2007-2013, 2017 Andi; 2013-2016 Robert Taub`, per-file
headers) — i.e. the same *port-it-attributed* footing as VexFlow's MIT
(`docs/plans/own-engraving-engine.md` §6.7), ⛔ **not** the LGPL the 2010 paper announces. Note it is a
header-only C++ library in two halves: `include/prim-*.h` (the utility layer — `Affine`, `Path`,
`Bezier`, rationals) and `include/belle-*.h` (the music layer — `belle-engraver.h`,
`belle-spacing.h`, `belle-springs.h`, `belle-island.h`, `belle-house-style.h`, painters for PDF /
SVG / CoreGraphics / JUCE / MIDI).

🚨 **The finding that matters, measured in the clone on 2026-08-29: Belle's transform vocabulary is
AFFINE ONLY.** `belle-transform.h` defines `struct Affine` (a six-coefficient CTM) and
`AffineStack`; `belle-path.h`'s only transform entry point is `Path::Transform(Affine)`, and a grep
of all 200 headers for `warp` / `deform` / `distort` / `non-linear` returns **one hit — the General
MIDI patch name "Distortion Guitar"**. So *Bike Ride*'s circular staves are **many objects each
placed by its own affine** (rotated round a centre), ⛔ **not a warped staff**: nothing in Belle
bends a glyph. ⭐ That is a real design answer for our SCENE — *a per-primitive transform buys the
whole Bike Ride class of eye music*, and a genuinely **bent** staff is a further, separate step that
Belle never took (Solomon's LP above is the closest anyone in this folder gets to it).

⚠️ **Two different things share the name.** The 2010 paper describes a **vector-graphics library
with music glyphs** — the composer drew *Bike Ride* with it. The clone is the 2017 **Belle 1.0.2**,
by then a real engraver with a graph/"island" model, spring spacing, SMuFL support and MusicXML
import. ⛔ Do not quote the paper as a description of the code, or the code as evidence for the
paper.

🚨🚨 **THE ROUTE — `quod.lib.umich.edu` (the whole ICMC proceedings archive) IS CLOUDFLARE-GATED.**
Measured 2026-08-29: `WebFetch` → 403; `curl` with a browser User-Agent → **403 with a *"Just a
moment…"* interstitial**, the same silent-failure shape as `notat.io` below. ⭐ **What works is the
WAYBACK MACHINE'S `id_` FORM**, which serves the original bytes with no rewriting:

```
# 1. find the snapshot (the CDX API is NOT gated)
curl -sS "http://web.archive.org/cdx/search/cdx?url=quod.lib.umich.edu/cgi/p/pod/dod-idx/*&filter=original:.*<slug>.*&fl=timestamp,original,statuscode"
# 2. fetch it verbatim — note the "id_" after the timestamp
curl -sSL -o out.pdf "https://web.archive.org/web/<timestamp>id_/<original-url>"
```

⚠️ Wayback answers **503** under load; retry a few times before concluding anything. The PDF slug is
the paper's title in kebab-case plus `?c=icmc;idno=bbp2372.<year>.<paper>;format=pdf` — which means
**any ICMC paper is reachable this way**, not just these.

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
question is *what did she draw*, find a scan. `scoringnotes.com` and the `notat.io` forum both
reproduce printed pages, and notat.io additionally quotes
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
trill's claim across its whole system (fixed 2026-08-20, `docs/plans/trill-plan.md` §17). ⭐⭐ The lesson
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

## ⭐⭐ THE ENGINE SOURCES — on disk, and NOT in this directory

**`~/dev/engine-sources/{MuseScore,lilypond,verovio,inkscape,musxdom}`** — shallow clones; the three
engraving engines re-fetched 2026-08-18, Inkscape added 2026-08-22, **`musxdom` added 2026-08-28**.

⭐⭐ **`musxdom` (`rpatters1/musxdom`, MIT) is FINALE, and it is not an engine** — a C++17 DOM for
Finale's `.musx`/ENIGMA document model, **with 99 real Finale 27.4 fixtures**. Finale shipped no
source and was discontinued in 2024, so this is the closest thing to reading it. ⭐ It is a
**searchable map of Finale's whole document model**, and it is how the brace's numbers were got:
`pianoBraceBracketOptions` (12 fractional-EVPU fields) and the per-group `brackSpec`, measured across
all 99 files at 1 sp = 24 EVPU.
⭐ **Look here BEFORE cloning anything**: they have now been lost twice to `/tmp` being cleared
(2026-08-16 and again before 2026-08-18), and each rediscovery costs an agent its budget.

⭐⭐ **A SIXTH checkout since 2026-08-29: `~/dev/engine-sources/belle`** — *Belle, Bonne, Sage*,
BSD-2-Clause, one commit. ⛔ **It is NOT a fourth engraving opinion**: for what a convention is,
the three above remain the whole list. Belle is asked only what none of them can be asked — how a
score gets to be a bicycle. Everything about it, including the four ICMC papers now on disk, is in
the `belle/` section above.

⭐⭐ **VexFlow 5.0.0, TWO copies since 2026-09-19 — the library this editor was built on and REMOVED**
(`docs/history/vexflow-removal-map.md`). Kept because much of our engine is a TRANSCRIPTION of it: a port's
comment says *"`Clef.getPoint` (`clef.js:98`)"*, and once the package leaves `package.json` (S14) that
citation must still resolve. ⛔ **Not an engraving opinion either** — it is where OUR inherited defaults
came from, asked *"what did the code we replaced do, exactly?"*, never *"what is right?"*.
- `~/dev/engine-sources/vexflow-5.0.0-npm/package` — ⭐ **the published npm build, byte-identical to what
  `node_modules/vexflow` held** (checked with `diff -rq`). ⭐ **This is the one the port comments cite**:
  their line numbers are `build/esm/src/*.js`, the compiled JavaScript we read and transcribed.
- `~/dev/engine-sources/vexflow` — the TypeScript source at tag `5.0.0` (`8879d09`, "Release VexFlow
  5.0.0"), for history, tests and types. ⚠️ Its line numbers are NOT the ones the comments cite.

⚠️ **Inkscape answers a DIFFERENT KIND of question** and is filed here only because it lives in the
same directory. The other three are asked *what did they engrave*; Inkscape is asked **how does an
interactive vector editor stay fast while you drag something** — see
`docs/history/render-performance-research.md`. ⛔ It knows nothing about music.

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
| **VexFlow** source — ⚠️ the REMOVED library | `~/dev/engine-sources/vexflow` (32 MB) | tag `5.0.0` @ `8879d09` (2026-09-19) | `git clone --depth 1 --branch 5.0.0 https://github.com/vexflow/vexflow.git` |
| **VexFlow** npm build — ⭐ what the port comments cite | `~/dev/engine-sources/vexflow-5.0.0-npm/package` (22 MB) | `vexflow@5.0.0` | `mkdir vexflow-5.0.0-npm && cd $_ && npm pack vexflow@5.0.0 && tar xzf vexflow-5.0.0.tgz` |

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
   `docs/plans/slur-plan.md` and the `src/engine/rendering/` doc comments stay honest about *which* source
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

📄 **The answers are digested in `docs/research/key-signature-research.md`** — go there, not to the scratchpad,
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
engine checkouts (⛔ not this library — see `docs/plans/key-signature-plan.md` §8.5d for that half).

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
`docs/plans/key-signature-plan.md` §8.6a).

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

### What was asked of it on 2026-08-28 (third question), and what came back

The question was **BRACES and BRACKETS** — which sign for which ensemble, the nesting order, and the
geometry of each. Five parallel agents read the engines, SMuFL and the standards (⛔ not this library;
they are in `docs/research/braces-brackets-research.md`). ⭐⭐ **Almost every NUMBER here is a MEASUREMENT, not
a quotation** — §3.8 of that document lists what the books state in words, and it is almost nothing.

| asked | source | answer |
|---|---|---|
| WHICH SIGN | **Gould pp. 514–519**, **Ross p. 155**, **Gerou & Lusk p. 43** | **Brace** = one instrument / one performer on 2+ staves (keyboard, harp, marimba, organ manuals) — *"but not to the pedal stave in organ music"* (Gould pp. 342–3). **Square bracket** = a section or family of SEPARATE players. **Thin secondary bracket** = a sub-group inside a section (Gould p. 518). *"An instrumental section of only one stave takes a square bracket. A score system of only one stave takes a square bracket as well as a systemic barline"* (p. 516); timpani, single percussion, soloists and solo vocal lines take **none**. |
| ⭐⭐ the NESTING ORDER | **Gould p. 509 Table 2 (a)+(c)** and **p. 518**, **Ross pp. 155–6** (all measured) + **Stone p. 6** | **THE SMALLER THE GROUP, THE FURTHER LEFT ITS SIGN**: `[innermost] [outer] [section bracket] [systemic barline]`. Stated: *"A brace should only ever be used as the **outermost** bracket"* (Gould p. 516). Stone, independently, on organ: *"the curly brace covers the two manual staves only, while **the straight line that follows** must always connect all three"*. ⭐ This settled a question **three engine code-reads disagreed on** — LilyPond and Verovio match her, MuseScore is the odd one out. |
| BRACKET thickness | **Gould p. 516** + **p. 21**, **Ross p. 155** | **0.50 sp**, *stated identically by both*: *"the square bracket is beam thickness"* + *"beam thickness is ½ stave-space"*; Ross, *"a vertical line half a space thick (the same as a beam)"*. ⭐ It is **Bravura's `bracketThickness` exactly**. 🚨 Measured, Gould draws **0.50** and **Ross 0.52–0.62** — fat against his own sentence, the same drawing-beats-the-sentence pattern as his wedge. |
| ⭐ the bracket's PROJECTION past the staves | measured (Gould Table 2, Ross p. 155) | **≈1.0 sp each way** — 0.99 / 1.05 and 0.90 / 1.04 (up to 1.35 in Ross's larger schematics). ⛔ **No book states it.** It settles a number no font specifies and no two engines agree on (LilyPond ≈1.59, Verovio ≈1.47, MuseScore 0.25 + tips). Serifs hook **right**, overhanging the barline; clearance to the systemic barline **0.35–0.45 sp**. |
| ⭐⭐ the BRACE's depth | **Gould p. 331 Table 1**, measured; **Ross p. 155** stated | **CONSTANT — 0.89 / 0.89 / 0.84 sp for 2 / 3 / 4 staves. It stretches ONLY vertically.** And it runs **flush from the top staff-line to the bottom staff-line, no overshoot** (*"from the top line of one staff to the bottom line of the staff below"*), measured in all six examples to within 0.15 sp; cusp at the exact midpoint; clearance to the barline 0.24–0.49 sp. 🚨🚨 **This CONTRADICTS SMuFL**, which says a brace *"should be scaled proportionally (i.e. in both dimensions, not only in the vertical dimension)"*. ⭐ **The scan beats the sentence, a fourth time.** |
| the SUB-BRACKET | **Gould p. 518**, measured | A **hairline OUTLINE: 0.10 sp stroke, 0.60 sp wide, NO serifs** — ⛔ not merely a thinner rod. 🚨 **Ross p. 156's "second bracket" is 0.63 sp, identical to his main one.** Gould + all three engines (~0.10–0.11) against Ross, and all four against Bravura's `subBracketThickness` **0.16**. ⛔ The term *"sub-brace"* appears in **no source**. |
| the SYSTEMIC barline | **Gould p. 38** + **p. 516** + **p. 521**, **Ross pp. 151–2** | *"A barline connects all staves at the beginning of a system… **A single-stave part does not have this barline. (A single stave in a full score does, however)**"* (p. 38, verbatim). It **accompanies** the bracket and is never replaced by it — *"as well as a systemic barline"* (p. 516). Ross pp. 151–2 has the fullest seven-case list. ⚠️ **One drawn exception**: *"In most modern typographically printed hymnals, the bracket replaces the systemic barline"* (Ross p. 157). |
| on WHICH systems | **Gould p. 509 Table 2 col. (c)**, **p. 239**, **Stone p. 6** | **Every one.** Table 2's third column is headed *"Subsequent page"* and carries identical brackets, sub-brackets and braces (measured); *"restate margin brackets… restate the curly brace"*; *"the brace at the beginning of each line"*. |
| ⚠️ a brace for Vln I + II | **Ross p. 155** vs **Gould pp. 516/518** vs **G&L p. 120** | **A real disagreement.** Ross lists it as a *main use*; Gould calls it *"now rarely used"* and *"1st and 2nd violins… are not joined by a secondary bracket"*; Gerou & Lusk side with Gould — *"In all cases a bracket should be used, not a brace."* |
| ⛔ the INDENTED first system | — | **UNKNOWN — nothing anywhere**, checked Gould pp. 486–7 and 507, Gerou p. 117. ⭐ A parallel agent searching MusicXML, MEI, Dorico, Sibelius and Finale found the same silence. **Two independent searches, no source.** |
| ❌ **STONE** on brace/bracket | **Stone**, index + pp. 6–7, 257–8, 274, 217 | **Essentially nothing, and he says so**: no index entry for brace or bracket; pp. 257–8 (piano) and 274 (organ) are figures with no geometry; **p. 217 refuses outright** — *"The lengths of vertical brackets at the beginning of the lines… must be decided from case to case."* ⛔ Do not check Stone for bracket geometry again. |
| ❌ **GEROU & LUSK** on geometry | **G&L pp. 43–44, 75, 120** | **Definitions only, no geometry** — the signs are named and their uses listed (p. 75: *"joined by a brace and a systemic barline"*), and not one measurement is given. |

### What was asked of it on 2026-08-31, and what came back

The question was **the VERTICAL POSITION OF RESTS WHEN A STAFF CARRIES MORE THAN ONE VOICE** — asked
because `public/examples/prelude-bwv846.json` carried **67 hand-placed `restShift` overrides**, one
per rest, because we ship a fixed per-voice ladder that is blind to the other voice. ⭐ **New ground
for this library** — nothing here had been asked about rests before. A parallel pass read the four
engines (⛔ not this library; they are in `docs/research/multi-voice-rest-position.md` §4).

| asked | source | answer |
|---|---|---|
| the NEUTRAL position, per rest kind | **Gould pp. 34–35**, measured | *"The semibreve hangs from the second line down; the minim rest sits on the centre stave-line"*; crotchet *"starts in the top stave-space and finishes in the bottom space"*; quaver *"sits above the middle stave-line and extends down to the second stave-line from the bottom"*; *"each hook is in a separate stave-space"*. Crotchet measures **3.02 sp** tall, centred to **0.08 sp**. ⭐ Already implemented — `engine/layout/restPlacement.ts` cites p. 34. |
| ⭐⭐ TWO VOICES — and there are **two systems** | **Gould pp. 35–37** vs **Ross pp. 173–174**, **G&L p. 114**, **Stone p. 135** | **A (Gould): minimum displacement, quantised** — *"From the centre of the stave, rests move an exact number of stave-spaces up or down"*; *"upper-part rests… above the centre stave-line, lower-part rests below"*; *"Semibreve and minim rests must never stray across the centre stave-line"*. Measured on her p. 36 same-music-twice figure: **±1 sp = ±2 staff positions**. **B (the other three): a fixed outer line, whole+half only** — *"the fifth line for the top part and the first line for the bottom"* (G&L). Measured: upper whole **+1 sp**, lower **−3 sp**; upper half **+2 sp**, lower **−2 sp**. ⭐⭐ Gould reports B as others' practice (p. 37, *"Many editions place all minim and semibreve rests on only the outside stave-lines"*) **and engraves it herself on p. 312**. ⛔ **No source adjudicates.** |
| ⭐⭐ is it CONTEXT-DEPENDENT? | **Gould pp. 36–37**, **Ross p. 176**, **G&L p. 115** | **Yes, unanimously.** *"The space in which a rest centres… should be on the same level as surrounding pitches"*; *"When the position of a rest is displaced by a note of the other part, the rest moves further away from the stave"*; *"When a note is on a ledger line, place the rests above the top stave-space"*. G&L: *"The rest may be completely outside the staff."* ⇒ **sign positional, magnitude derived, result quantised.** |
| a CONSTANT height per voice? | **Gould p. 37**, measured | **No** — *"the semibreve rests in the following example move lines to reflect the changing position of surrounding pitches"*; her 12/8 figure has rests at **six different heights**. Where context does not change, neither does the height (p. 312 identical to the pixel across bars 1 and 3). The alignment that IS required is horizontal: *"Rests that are part of a beat should align horizontally"*. |
| ⭐⭐ **our exact texture, engraved** | **Gould p. 312**, measured | *Whole-bar rests for extended part-writing* prints a bass staff with an upper voice of held minims over a lower voice of 8th-note/8th-rest pairs — the prelude's texture. Upper voice's crotchet rest **+3 sp (+6 staff positions)**, wholly above the top line; its whole-bar rest hangs from the **top** line (+1 sp); lower voice's crotchet+quaver **−2 sp**, exact to the pixel; its whole-bar rest hangs from the **bottom** line (−3 sp). |
| 🚨 Ross's whole rest | **Ross p. 173** prose vs **p. 174** plate, measured | **The prose is wrong.** He writes *"placed beneath the third staff line"*; his own engraving hangs it from the **second line from the top**. ⭐ The **fifth** drawing-beats-the-sentence in this library. |
| ⛔ three and four voices | **Gould p. 313**, **G&L p. 118** | **UNKNOWN — no rest-height rule anywhere.** Gould handles four parts as **2+2 on two staves** (*"usually two voices are allocated to each stave, rests placed above or below the middle line"*); her *Three parts on a stave* is stems and horizontal displacement only. G&L: *"avoid combining three instruments on one staff."* |
| ⛔ crossing voices · a NUMBER for clearance | — | **UNKNOWN.** The books say *"further away"* and never quantify it; the only numbers are the engines' own (LilyPond 0.75 sp, MuseScore 0.35/0.55 sp). |
| ❌ **STONE** beyond whole rests | **Stone p. 135** | Whole rests only — *"whole rests for the upper part should hang from the top staff-line"*, with an `Incorrect` pair. Nothing on shorter rests. |

### What was asked of it on 2026-09-01, and what came back

The question was **the STEM — its LENGTH above all, then its ATTACHMENT and THICKNESS** — asked
because `docs/plans/note-engraving-plan.md` P3c took the stem's INK and deliberately left the LENGTH, on
the parent plan's rule that a re-implementation with no stated rule is worse than a dependency.
Written up in full as **`docs/research/stem-length-research.md`**. ⭐⭐ **THE FINDING THAT MATTERS FOR THIS
MANIFEST: STONE HAS A COMPLETE STEM-LENGTH CHAPTER (printed pp. 47–49, seven numbered cases) AND WE
HAD NEVER ASKED HIM ANYTHING.** He is the most systematic source in the library on this question.
⚠️ **Stone's PDF is 2-UP** — printed pp. 48–49 are PDF page **35**, left and right halves; printed
p. 47 is the right half of PDF 34. That is a new offset fact, unlike Gould (+20) and Ross (+12).

| asked | source | answer |
|---|---|---|
| ⭐⭐ the DEFAULT length | **Gould p. 14**, **Ross p. 83**, **Stone p. 47**, **G&L p. 137** | **Four for four, no dissent: one octave = 3½ stave-spaces, measured FROM THE CENTRE OF THE NOTEHEAD.** ⭐ Ross's footnote reconciles the trade's other phrasing: *"Plate engravers, who say that the stem length is three spaces, measure from the end of the stem to the nearest point on the notehead."* |
| the same, as a RULER | **Gould p. 14** (measured, 450 dpi, 1 sp = 20 px) | Her *Stem length* figure draws a **bracket ruler of 1 + 1 + 1 + ½ spaces** from the stem tip down to the notehead's **centre**. ⭐ The drawing states the measurement convention in ink. |
| far above/below the stave | **Stone p. 48** (the cleanest), + **Gould p. 14**, **Ross p. 86**, **G&L pp. 83/137** | *"**all stems must either cross the middle line or reach it** (except, of course, in double stemming)"*. Threshold: Gould *"more than one ledger line"*, Ross *"on or above the second leger line"*, G&L *"beyond one leger line"* — all bite at 8 half-spaces out. ⛔ Lengthen only. |
| ⭐⭐ the FORCED direction (double-stemmed, chords outside the stave) | **Gould p. 14**, **Stone p. 49**, **G&L p. 137** | *"progressively shortened. The shortest stem length is a sixth (2½ stave-spaces): **no stem should ever be shorter than this**"* (Gould) · *"shortened by ½ to 1 space, i.e., from an octave to a seventh or sixth"* (Stone) · *"getting progressively shorter as the notes go higher. The shortest stem length is 2½ spaces (interval of a 6th)"* (G&L). |
| ⭐⭐ …and the RAMP'S SLOPE | **nothing states one; five sources give five** | Gould names 3 values and **draws 6**; Ross **quantises** to 3½/3/2½ by staff degree; Stone gives a **range**; G&L say *"relative to surrounding notes"* and then — ⭐ the one sentence in the library addressed to software — *"For the computer, a setting should be chosen that works well for most situations."* |
| ⭐⭐ what Gould DRAWS | **Gould p. 14**, *Double-stemmed writing* (MEASURED, 1 sp = 19.75 px, head centre → stem tip) | A **continuous ramp**, the note climbing one staff degree per example: **3.47 · 3.22 · 2.96 · 2.76 · 2.56 · 2.41 sp** (up-stems; down-stems mirror within 0.15). ≈**¼ sp per staff degree**, easing near the floor. 🚨 The last example measures **2.41 — below her own stated 2½ floor.** ⛔ And the *"imaginary ledger lines"* she draws are a RULER for counting the interval: the stem tips do **not** land on them. |
| ⭐⭐ ROSS'S TABLE, by STAFF DEGREE | **Ross pp. 85–86** (three figures, MEASURED at 300 dpi against the local skewed staff) | *"the only **fifteen staff degrees** … have notes with normal 3½ space stems"* = **up-stems at −7…−1 and down-stems at 0…+7** half-spaces from the middle line. His footnote *"often more effective at 3¼"* marks exactly the three nearest the reversion place (up −1, down 0, down +1). 2½ applies to **up-stems +1 and up, down-stems −2 and down**; **3** to up-stem on the middle line and down-stem one degree below. ⭐ The most specific stem statement in the library. |
| BEAMS: the line/space alternation | **Gould pp. 18–19**, **Stone p. 48**, **Ross p. 99** | Three sources, one rule: notes **in a space → 3½**, notes **on a line → 3¼**, *"because the beam straddles a staff-line"* (Stone). Gould: *"The stem length (**including the width of the outer beam**) should be as close to 3½ spaces as possible."* |
| BEAMS: the innermost-beam floor | **Gould p. 19**, **Ross p. 121**, **Stone p. 48** | *"Beams should never be closer to the notehead than the correct position of the semiquaver beam (**2½ spaces**)"* · *"never … closer to the notehead than 2½ spaces (including the thickness of the beam)"* · *"the stem of the note(s) closest to the beam should not be shorter than the interval of a sixth"*. ⭐ The one rule three books state identically. |
| ⚠️ BEAMS: how much per EXTRA beam | **Stone p. 49** vs **G&L p. 32** | **½ space** (Stone, then *"no rigid rule is followed"*) vs **≈1 space** (G&L). Gould p. 19 gives no per-beam number, only drawn examples **3¾ · 4½ · 3¼ · 4**. |
| ⚠️ FLAGS/TAILS | **Stone p. 49** vs **Ross p. 86** vs **Gould pp. 15–16** | Stone: no change for 8th/16th, lengthen *"from three flags on"* (= LilyPond's `lengths` list exactly). Ross: *"A stem with a flag is normally never less than 3 spaces"* — a floor, not a bump. Gould: the constraint is the TAIL's own length (2½–3¼, *"3–3¼ is the norm"*), *"the stem should be lengthened for a longer tail"*, and a 16th *"most commonly remains the same length"* (drawn 3½). |
| GRACE / CUE | **Gould pp. 125 / 569** vs **Stone p. 49** | Gould: grace **2¼ sp** (⚠️ 2¼, not 2½ — the OCR's `2%` is ¼ on the page), cue **2–2½ sp**, *"stem lengths of both tend to be the same"*. Stone: grace **≈2½**, cue **≈3**. 🚨 The two books order grace and cue the opposite way round. |
| ATTACHMENT — which side | **Ross p. 83** (outright), **G&L p. 138** | *"A note on or below the second space has an up-stem on the **right side** of its notehead. A note on or above the middle staff line has a down-stem on the **left side**."* G&L, for a second: *"the upper note always to the right, the lower note always to the left"*. ⭐ Gould states the principle only for the SPECIAL heads — p. 11 *"A stem joins the diamond at the **side** of the notehead, and not at the central point"*, p. 12 *"joins the cross at the **edge** … not at its centre"*, *"attached to the centre of the base of the triangle"* — never for the ordinary oval. |
| ATTACHMENT — the exact point | **Gould p. 14** (measured) + the three engines | The stem's **OUTER edge is flush with the notehead's extremity** (measured: up-stem right edge = head's rightmost ink; down-stem left edge = head's leftmost). ⭐ That is the SMuFL `stemUpSE`/`stemDownNW` convention, and LilyPond's font README says the same in words (*"the lower right corner of this rectangle is attached to the glyph"*). ⛔ **No treatise gives a vertical attachment point** — every number (0.16–0.17 sp below/above centre) is the font's. |
| ⚠️⚠️ THICKNESS | **Gould p. 13**, **Ross p. 83**, **G&L pp. 25/137** — vs Gould's own PLATE | Three books say the stem is **thinner than a stave-line** and **none gives a number**. 🚨 **MEASURED on Gould p. 14 by ink coverage at 450 dpi: stems 0.106–0.120 sp, staff lines 0.107–0.116 sp — the same, to the scan's resolution.** ⭐ The **sixth** drawing-does-not-back-the-sentence in this library. Bravura (0.12/0.13) and Leland (0.10/0.11) engrave the sentence; 🚨 **LilyPond draws the stem 30% THICKER than its staff line (0.13/0.10) and Verovio 33% thicker (0.10/0.075).** |
| ❌ STONE on thickness or attachment | **Stone**, whole book | **Nothing.** Checked 2026-09-01 — ⛔ do not check again. |
| ⛔ CROSS-STAFF stems | **Gould p. 305** | *"a stem may extend from one stave to the other to take advantage of the other clef"* — a permission with **no geometry**, and that is the whole of it. Ross, Stone and G&L: **UNKNOWN**, searched and silent. |
| ⛔ a rule for the RAMP as a function · the stem's overlap INTO the head · whole-bar/stemless stems · non-5-line staves | — | **UNKNOWN** — see `docs/research/stem-length-research.md` §6 for exactly where each was looked for. |
| ⛔ **Gardner Read**, *Music Notation* | — | **Still not on disk** (see *Still missing* below) and the obvious fifth opinion here; LilyPond cites him by page elsewhere. **Not consulted.** |

⭐ **What the three ENGINES do is in `docs/research/stem-length-research.md` §4**, with `file:line` for every
number — including three Verovio defects found while reading it (the SMuFL flag extension is
commented out as crashing, the two-voice reduction its own header calls for is unimplemented, and
the chord path hard-codes a 5-line staff). ⚠️ **MuseScore has moved the algorithm again**: it is now
`src/engraving/rendering/score/stemlayout.cpp`, ⛔ no longer `chordlayout.cpp`.

### What was asked of it on 2026-09-01 (second question), and what came back

The question was **THE BEAM'S SLOPE**, asked for **P4b** of `docs/plans/beam-engraving-plan.md` — the same
gate the stem's length is behind. Written up in full as **`docs/research/beam-slope-research.md`**.
⭐⭐ **THE FINDING THAT MATTERS FOR THIS MANIFEST: ALL FOUR TREATISES ANSWER, AND TWO OF THEM POINT AT
THE THIRD.** Gould p. 21 — *"(For a detailed study of beam angles, see Ted Ross, The Art of Music
Engraving and Processing.)"* — and Stone p. 12's footnote names the same book **and the same pages**:
*"charts with close to 300 different two-note single beam slants alone! … pages 104 ff."*
⇒ **Ross pp. 104ff is the primary source for this question and the other books say so.**

| asked | source | answer |
|---|---|---|
| ⭐⭐ where a beam END may land | **Gould p. 20**, **Ross pp. 99–100**, **Stone pp. 10–11** | Unanimous: **sit on / hang from / straddle a stave-line — never mid-space.** *"Both ends of a slanted beam should be attached to a stave-line. This is the engraving tradition"* (Gould); *"Beams should never be centered between two staff-lines"* (Stone); Ross's whole 300-case chart is the enumeration of it, with `(¼)` marking the straddle's extra stem. 🚨 **VexFlow's `Beam` never consults the stave at all** — measured, §3 of the research doc. |
| ⭐⭐ the interval → RISE table | **Ross p. 102** | 2nd **¼** · 3rd **½–1** · 4th **½–1¼** · octave **up to 2** · anything past the first ledger line **never more than ½**. ⭐ MuseScore's `_maxSlopes` is exactly this, one row per diatonic step in quarter-spaces. |
| ⭐⭐ …and what Gould DRAWS | **Gould p. 19** (MEASURED at 1200 dpi) | Her *beam angle* figure has only two examples and no table: **B3→D4, a 3rd, labelled ½ (drawn 0.46)** and **G3→F4, a 7th, labelled 1 (drawn 1.02)**, both at ≈4½ spaces' spacing. ⭐ **The flattest reading in the library at the wide end** — MuseScore would give that 7th 1½. |
| ⭐⭐ the HORIZONTAL-distance rule | **Gould p. 20**, **Ross p. 101** | *"Notes spaced very close together horizontally (**closer than three spaces**) take only a slight angle (¼ or ½ space) **regardless of the interval**"* · *"beamed notes should be between **three or four spaces** apart to use normal beam slanting"*. ⭐ MuseScore's first width breakpoint is `< 3.0 → ¼` and Verovio's is `≤ 3 spaces → ¼`. ⛔ We have no such rule. |
| the CEILING | **Ross p. 99**, **Stone p. 12**, **Gould p. 20** | *"never exceeding a slant of **one space** up or down"* (Ross, as the apprentice's compromise) · *"**not more than one staff-space**"* (Stone) · Gould: short groups **one**, long groups *"one or possibly two"*. |
| a beam over LEDGER-LINE notes | **Gould p. 21**, **Ross p. 102**, **G&L p. 43** | Slight slope regardless of pitch: a 2nd **¼**, everything wider **½**. |
| 🚨 the beam GAP when SLANTED | **Stone p. 12**, **Gould p. 21 (c)** | *"the spaces between **three or more slanting beams** are generally widened to **half a staff-space** to avoid wedges"*, and outside the stave the normal **¼** returns. Gould offers the same as *"a good compromise"* against her (a): with a third beam, **slant a whole stave-space**. ⚠️ P4a's constant stride knows nothing of this. |
| ⚠️ **Gerou & Lusk** as a witness | **G&L pp. 40–43** | ⛔ **Read their preamble first**: *"approximate guidelines, **modified from the strict traditional rules**"*, because *"the consistency of the computer and the quality of modern printing make it no longer necessary to avoid the small 'wedges'"*. Their numbers are one step steeper throughout, by design. Their FLAT cases are still worth having. |
| ❌ a formula anywhere | all four | **None.** Every source is a table or an enumeration; the only formulas in existence are the engines' (LilyPond's `0.6·tanh(s)/damping`, MuseScore's two `min`s, Verovio's step ladder). |

### What was asked of it on 2026-09-01 (third question), and what came back

The question was **HORIZONTAL SPACING — what a note-value is actually worth**, asked because HE
noticed the dating: *"i think the research was done before we had the reference folder with the
books"*, and then *"before we had the repository with all the engines cloned"*. Both true —
`docs/research/spacing-model-research.md` is **2026-07-30**, Gould arrived **2026-08-17**, Ross/Stone/G&L
**2026-08-18**, the engine clones **2026-08-18**. ⇒ **every number in that document was second-hand**,
and it says so itself: Gould's table came *"via the facsimile in MuseScore's spacing paper"*.

⭐⭐ **THE FINDING THAT MATTERS FOR THIS MANIFEST: ROSS HAS A SPACING CHAPTER — *"Punctuation"*,
printed pp. 74–79 (PDF 86–91) — AND NOBODY HAD EVER OPENED IT.** He is the source usually credited
for the 3½, and both Gould (p. 21) and Stone (p. 12) defer to him on beam angles. It is deeper than
Gould on this subject.

| asked | source | answer |
|---|---|---|
| 🚨 the note-value TABLE | **Gould printed p. 39 = PDF 59** (read at 600 dpi) | **`2 · 2½ · 3 · 3½ · 4 · 5 · 6 · 7`** — ⛔ **the quaver is 2½, and this repo said 2¼ for five weeks** from the facsimile. ⭐ The figure is drawn exactly to its own numbers (unit constant to ±1.7%, one printed grid rule per unit) and is measured **centre-to-centre**. |
| …and independently | **Ross printed p. 77 = PDF 89** | ♪ **2½** · ♪. 3 · ♩ **3½** · 𝅗𝅥 4¾ · 𝅝 7¼ — ⭐ **the same table**, apart only at the two longest. ⚠️ He gives a SECOND set in prose two pages earlier (compass at 3½/2½/5, cramped 3/2), so **3½ is a starting setting, not a constant**. |
| ⛔ is the unit a stave-space? | **Gould p. 39** | ⛔ **She never says so** — *"units of relative measurement … a guide to the spacing PROPORTIONS"*, and **her figure has no stave at all**. Measured bounds on her schematic: **1.16–1.31 sp** per unit. ⭐ **It is ROSS who states them as spaces.** |
| ⭐⭐ what are they measured BETWEEN? | **Ross printed p. 75** | *"plate engravers **measure from the left side of the characters** … from the left side of the first notehead to the left side of the next"*; **machine engraving "from the center"**. ⛔ Not the white gap. |
| ⭐⭐ …and the BEAM threshold? | **Ross printed p. 112 = PDF 124** | *"notes that have **less than 3 spaces between noteheads or stems** … our beams in close spacing will slant ¼ to ½ space at all times"* ⇒ **the WHITE GAP**, and this is the source of Gould p. 20's sentence. 🚨 **So the two numbers use different conventions on purpose.** Converter: gap 3 sp ⇔ 4.2 sp centre-to-centre. |
| ⭐⭐ …and is it a TWO-NOTE rule? | **Ross p. 112**, + **Stone p. 12** | *"In normal spacing two notes and an interval dictate the amount of slant … in close spacing, almost without exception **one note alone serves as a dictator**"*; Stone: *"300 different **two-note** single beam slants alone"*. ⇒ **Gould dropped the qualifier**, and her own p. 490 six-note group is engraved at **1.08 sp** where her sentence allows ¼–½. |
| what the facsimile DROPPED | **Gould pp. 40–43 = PDF 60–63** | ⭐⭐ the consistency rule *"**Notes of equal duration require equal spacing for an entire system**"* AND its justification clause *"can vary from system to system according to the number of bars on that system"* · ⭐⭐ **the minimum: "not less than ½ stave-space"** · the ≥/= *"or at least as much"* licence for a non-decreasing curve · the optical back-to-back stem correction · the *Recommended distances before first note* table (2½ · 1½ · 1 …) · *"stems must never come closer to a barline than one space"*. |
| ⭐ REAL ENGRAVED MUSIC, measured | **Gould 489–490 = PDF 509–510**; **Ross 78–79 = PDF 90–91** | Real justified 32nds **2.38** and **2.72–2.81 sp** (same page, 16% apart — her *"vary from system to system"*, engraved); Bruckner crotchets **4.07–4.49**; Ross's *"Engraved In England"* plate: quavers **2.28–2.31**, crotchet ≈3.65. ⭐ An accidental costs **≈0.6–0.75 sp**, ⛔ not a doubling. |
| ❌ **STONE** on note-value spacing | **printed pp. 44–45 = PDF 33** (⚠️ 2-UP) | **NOTHING — checked, do not check again.** *"too complex to be included in these rather general guidelines\*"*, footnote: *"see engravers' manuals such as **The Art of Music Engraving and Processing by Ted Ross**."* ✅ He DOES give prefatory distances, and they are **not Gould's** (first note **1½ sp** where she says 2½) — a real house-style disagreement. |
| ❌ **GEROU & LUSK** on it | **printed pp. 131–133** | **NO NUMBERS AT ALL — checked.** Principle only: *"a half note … must get more space than a quarter note, but not twice as much"*. ⭐ One useful line, a third witness to the consistency rule: *"consecutive notes of equal value have equal space following each note"*. |
| ⛔ a clean justified passage of plain QUAVERS | both books | **UNKNOWN — none exists in either.** The measurable clean passages were 32nds and crotchets-with-graces. ⇒ the one measurement that would settle our own quaver directly was not available. |

### What was asked of it on 2026-09-01 (fourth question), and what came back

The question was the **FRACTIONAL BEAM — which side a "hook" points, and how long it is** (P4c of
`docs/plans/beam-engraving-plan.md`; the write-up is `docs/research/beam-hook-research.md`). ⭐⭐ **The single most
useful thing learned is the SEARCH TERM**: the object is a **fractional beam** in every book — Ross
also allows *broken beam*, LilyPond's source says *beamlet*, Verovio *partial flag*, VexFlow *partial
beam*. ⛔ Grepping these books for **"hook"** finds the **REST** chapters instead (a quaver rest has
hooks) and looks like a dead end when the topic is in fact covered by all four treatises.

⭐ Unlike the slope, this topic is **not a taste call** — the four books agree with each other, with
Gould's own plates, and with the engines.

| asked | source | answer |
|---|---|---|
| ⭐⭐ which SIDE does it point? | **Gould printed p. 157 = PDF 177** | *"This beam points in the direction of **the beat or division of the beat to which it belongs**"* — and the ⅜ / compound-time rider: *"a fractional beam that is part of a second quaver must point in the direction of the second quaver"*. |
| …independently | **Ross p. 124** (PDF 136, *section 9*) · **Gerou & Lusk p. 31** (PDF 17, ⚠️ 2-UP) · **Stone pp. 12–13** (⚠️ 2-UP) | Ross: *"always inside a group … **pointing in the direction of the note to which it is a fraction**"*. Stone: *"must point toward the note of which they are a fraction"* + *"in cases of syncopation … in the direction of the syncopated note"*. ⭐⭐ Stone alone makes it a METRE claim on a drawn Correct/Incorrect pair: *"It would be correct if the time signature were binary (⁶⁄₈)"*. |
| ⭐⭐ …and DRAWN, measured | **Gould p. 157, 600 dpi ink profile** | Her ⅜ pair: `♪. ♬ ♪` stub **LEFT**, `♪ ♬ ♪.` stub **RIGHT** — **same three note-values, opposite hooks**, which is the whole rule in one figure. The *correct/and not* pair above it: correct = both LEFT, rejected = both RIGHT (the last one leaving the group entirely). |
| ⭐ how LONG? | **all four books** + the plate | *"the length of a notehead"* (Gould **p. 17**), *"the exact width of the notehead"* (Ross), *"the same as the width of a notehead"* (G&L), *"as long as the note-head is wide"* (Stone). ⭐ **Measured on her own plate: stubs 102–103 px vs noteheads 105–106 px = 0.97** — the drawing agrees with the sentence. Bravura `noteheadBlack` = **1.18 sp**; MuseScore `beamMinLen` **1.1 sp**; LilyPond `beamlet-default-length` **1.1**; Verovio reads the glyph's width. 🚨 **We draw 0.9 sp** — agreeing with nobody. |
| next to a REST | **Gould p. 158** | ⭐ **The one open choice, and she opens it**: *"Fractional beams point away from a rest so as to stay inside the main beam"* … *"**It is equally acceptable to point beams towards the rests**, to clarify the metrical grouping"*. Verovio picks the first. |
| ⭐⭐ what do the ENGINES do? | `beaming-pattern.cc`, `beamlayout.cpp`, `view_beam.cpp` | **LilyPond has BOTH rules and a user switch**: `strict_beat_beaming_` chooses between *"which neighbour has more beams"* and *"does this note start on the beat"*, with `rhythmic_importance_` as tie-break. ⭐ **VexFlow implements only the first — LilyPond's non-default fallback.** MuseScore is structural but consults `calcBeamBreaks`, so the meter reaches it indirectly; Verovio is purely structural + one rest case. |
| 🚨 and what do WE draw? | measured through the SCENE, jsdom | Gould's ⅜ pair renders as **LEFT in both bars**. ⛔ Not a bug in a branch: `lookupBeamDirection(duration, prevTick, tick, nextTick, noteIndex)` **has no beat and no metre in its signature**, and the two bars present it identical neighbour durations. ⭐ `Beam.setPartialBeamSideAt` is public API and is checked first — but ⚠️ only on the `beamAlone` branch. |
| ⛔ MIXED stem directions in the group | — | **UNKNOWN.** Verovio has a whole `CalcPartialFlagPlace` for it; **no book we hold discusses it.** |

### What was asked of it on 2026-09-01 (fifth question), and what came back

The question was **THE STAFF AND ITS HEADER** — P5 of `docs/plans/own-engraving-engine.md`, asked in two
halves and written up as two documents: **`docs/research/staff-line-research.md`** (how thick a staff line is,
whether it scales, and what else in the repo rides that number) and
**`docs/research/header-spacing-research.md`** (every gap from the system's left edge through clef → key
signature → time signature to the first note).

⭐⭐ **THE FINDING THAT MATTERS FOR THIS MANIFEST: NOT ONE OF THE FOUR TREATISES STATES A STAFF-LINE
THICKNESS.** All four define the staff line as the *reference* for other lines — a stem is thinner, a
barline thicker, a hairpin equal, a ledger line heavier — and then never measure the reference. Ross
p. 72 explains why: on a plate it was *"controlled by the pressure exerted on the tilting arbor
plate."* ⇒ every number for it in this repo is a MEASUREMENT or a font's, never a quotation.

⭐ **And a second manifest-level fact: GOULD'S RASTRAL TABLE (p. 483) IS PRINTED AT ACTUAL SIZE.**
Rastral 0 measures 9.23 mm against its printed *"9.2mm"*, and all eight ratios hold to 2%. That makes
it a **ruler** — eight staff sizes on one page, drawn by her own engraver — and the one plate in the
library that can answer *"does this quantity scale with the staff?"* for anything.

| asked | source | answer |
|---|---|---|
| ⛔ how thick is a staff line? | **all four**, searched page by page | **UNKNOWN — no book states a number.** Gould p. 5 defines the stave-space *as* the unit; Ross p. 82 gives only *"each type of line has its own physique in relation to its staff"*; Gerou & Lusk p. 135 is the only *Staff* entry and says only *"thick enough to be clearly legible but thin enough for the notes… to be easily read"*; ❌ **Stone has nothing at all** — whole book searched 2026-09-01, ⛔ do not check again |
| ⭐⭐ …so what did they DRAW? | **Gould, 4 pages + her rastral table** (600 dpi ink integral) | **0.110–0.111 sp** on pp. 14, 26, 43 and 490 (nine staves, 250+ clean windows) and **0.110–0.127 sp** across the eight staves of p. 483. ⭐ The method is calibrated on the same plates against the one number all four books state — a beam of ½ sp — and reads **0.524**, i.e. **+5% high**. 🚨 **Bravura's 0.13 is the TOP of her range, and our 1 px = 0.10 sp is the bottom of it** — see the SMuFL row below |
| ⭐⭐ does the line weight SCALE with the staff? | **Gould p. 483 Table 2**, measured | **YES.** Across rastral 0→7 (sp 54.6 → 28.5 px) the absolute ink halves, 6.75 → 3.54 px, while the fraction stays flat at 0.110–0.127 sp with no trend. Her p. 5 sentence says the same: *"The size of every notational symbol is measured in proportion to the stave size."* ⚠️ **Ross p. 57's rastral chart says the opposite** (absolute ink ~constant across nine sizes) — ⛔ **not believed**: at that reproduction quality a 3-px and a 7-px line are not separable. ⭐ But **LilyPond deliberately behaves the Ross way** (§5.3 of the doc), so the position is not absurd — it is one engine's, on purpose |
| 🚨 the LEDGER line's weight | **Gould p. 26**, prose + plate | *"They are spaced the same distance apart as stave-lines, but they are **about twice as thick**"* — and her five drawn ledgers measure **0.243–0.280 sp against the same page's 0.110 staff line = 2.2–2.5×**. 🚨 **Bravura's ratio is 1.23× and it is what this repo draws.** ⚠️ Ross p. 182 says only *"somewhat thicker"* and Gerou & Lusk p. 83 *"the same line weight… or slightly heavier"* — a real three-way spread, with the only measured plate at the far end |
| ⛔ Gould's *"Rastral height… one stave-space"* | **p. 482 prose vs p. 483 Table 2** | 🚨 **The prose is wrong and her own table contradicts it.** The mm column is the **top-line-to-bottom-line height** (four spaces): rastral 0 = 9.2 mm ⇒ one space **2.30 mm**; rastral 3 ⇒ 1.75 mm; rastral 8 ⇒ 0.93 mm. ⭐ The **seventh** drawing-beats-the-sentence in this library |
| ⭐⭐ what are Gould's SPACING numbers measured between? | **p. 42**, her own brackets, measured | **WHITE GAPS, INK EDGE TO INK EDGE.** Six brackets in *Recommended distances before first note* each begin within 1–2 px of where the left glyph's ink ends and finish within 1–2 px of where the right glyph's ink begins. ⛔ Not origins, not advances. (Stone says the same for his in words: *"cutting edges of staff… to measure the gaps"*) |
| ⭐⭐ the FIRST-NOTE distance | **Gould p. 42** (table) vs **Stone p. 44** vs **Ross p. 145** | Gould: **2½** after a clef, **2½** after a key signature, **2** after a time signature — *"The greatest distance between symbols should precede the first note"* — measured on her plate at **2.60 / 2.59 / 2.11**. Stone: **1½** flat, for all three. Ross: 5½ / 3½ / 3½ **origin to origin**, which converts to ≈2.8 / ≈1.5 gap ⇒ ⭐ **Ross lands on Gould after a clef and on Stone after a meter.** ⛔ No source adjudicates |
| ⭐ the CLEF'S INDENT | **Gould p. 6**, **Ross p. 144**, **G&L p. 51** | Three sources, no dissent: *"indented into the stave by one stave-space or a little less"* (drawn **0.67–0.74**) · *"customarily indented from the open end of the staff (or from the systematic barline) by **½ to 1 space**"* · *"slightly indented"* (drawn **0.62–0.70**) ⇒ **0.6–0.8 sp** |
| ⭐ clef → key → meter | **Gould p. 41**, **Stone p. 44**, **Ross pp. 144–145** | Gould: *"Separate the clef, key signature, time signature by **1–1½** stave-spaces"* (drawn 1.02–1.31 and 1.57). Stone: **1 or a little less**, then **1**. Ross: **3½** and **2½** origin-to-origin ⇒ ≈0.8 and ≈1.5 gap |
| ⭐ MID-SYSTEM | **Gould p. 42–43**, **Ross pp. 74–75**, **Stone pp. 46–47** | *"Allow a stave-space after a clef and on either side of a barline… two spaces after a time signature or key signature"* (drawn 1.01–1.08) · *"Between the barline and the left side of the first note is **one space**"*, 1½ to its **centre** · *"one staff-line space before the barline"* for a clef change, *"one staff-line space after"* for a meter change. ⭐ Also her escape hatch: *"an accidental or grace note may be closed up to within **½ space** of a barline. Stems must never come closer to a barline than one space"* |
| the gap BETWEEN a signature's accidentals | **Ross p. 144** (the only source with numbers) | flat→flat **1 space**, sharp→sharp **1 or 1¼**, origin to origin — with the reason: *"expand the spacing between sharps so that the ends of these horizontal bars align vertically, rather than overlap"*. ⭐ Gerou & Lusk's p. 51 figure, measured, draws **1.09** sharp-to-sharp — a third witness. Gould p. 92 states only the prohibition |
| ⛔ inside a TIME SIGNATURE | all four, searched | **UNKNOWN as a spacing.** The only geometry anyone gives is **vertical**: Gould p. 152, *"**Time-signature numerals should exactly fill the height of the stave**"*, in *"a unique heavy font"*. ⛔ No horizontal gap between the figures, no digit-to-digit rule, no centring rule |
| ⛔ Ross's ledger lines / hairpins, measured | — | **UNKNOWN — not attempted.** His book is a 1970 photo-offset of engraved plates (paper 186, black 45 on p. 79) and its thin lines have visibly thinned; his staff line measured **0.081 sp** there against Gould's 0.110, which is a reproduction difference as much as a house one |
| 🚨🚨 what does SMuFL itself say a staff line is? | `http://smufl.formats.music/latest/specification/engravingdefaults.html` (fetched 2026-09-01) | **NOTHING — the specification publishes no default.** Its whole preamble is *"…defining recommended defaults for line widths etc., as follows, with all measurements expressed in staff spaces"*, and `staffLineThickness` is glossed only as *"The thickness of each staff line"*. A dummy JSON at the foot shows `0.1`, as illustration. ⇒ **0.13 is BRAVURA's number** (`Bravura.json:22`), and every comment in this repo reading *"SMuFL says 0.13"* names a font as a standard. ⚠️ ROUTE: the live page is `…/engravingdefaults.html` (**no hyphen**); `engraving-defaults.html` and `staves.html` both 404 |
| ⭐⭐ the FIRST-NOTE gap, from the engines | **MuseScore `style/styledef.cpp:225–226`**; LilyPond `scm/define-grobs.scm:924, 1997, 3955` | 🚨 **MuseScore's two constants ARE Gould's two numbers**: `systemHeaderDistance` **2.5** when the header ends in anything but a time signature, `systemHeaderTimeSigDistance` **2.0** when it ends in one. LilyPond keys it too, with three different `space-alist` tags. ⇒ **two of the three engines implement her distinction and we implement none of it** — our single `HEADER_TO_NOTE = 2.0` is LilyPond's time-signature row promoted to the only row |
| ⭐ the staff line, in the engines | LilyPond `scm/paper.scm:52–66`; MuseScore `styledef.cpp:277`; Verovio `src/options.cpp:1528`; VexFlow `stave.js:461` | **LilyPond 0.100 sp** at a 20 pt staff (⭐ *our* value exactly) · **MuseScore 0.11** (⭐ Gould's measured value exactly) · **Verovio 0.075 stated, 0.0722 drawn** (an `int` truncation in `doc.cpp:2057`) · **VexFlow 0.10**, and only because it never sets a stroke width and inherits the SVG default. 🚨 LilyPond's is an affine function of the staff space **in points**, so its relative weight GROWS as the staff shrinks — *"stafflinethickness is largely independent on staff size"* (`mf/feta-params.mf:31–32`) — the opposite of what Gould's rastral table draws |
| ⭐ the LEDGER line, in the engines | LilyPond `scm/define-grobs.scm:3399` | `ledger-line-thickness '(1.0 . 0.1)` = **the staff line plus 0.1 sp**, which at its default staff is **exactly 2.0×** — ⭐ Gould's *"about twice"*, reached by a different construction. Bravura's ratio is 1.23× |

### What was asked of it on 2026-09-13, and what came back

The question was **HOW FAR UP AND DOWN A BARLINE REACHES** — raised by P5b taking the opening
barline's ink, which exposed that every vertical line in the score ended at *"the bottom line's y
plus 1"*, VexFlow's staff-line thickness rather than ours. Written up in
`docs/plans/own-engraving-engine.md` P5b's fourth step; the rule lives in
`src/engine/engrave/staff/barlineExtent.ts`.

⭐⭐ **THE MANIFEST-LEVEL FACT: THE BOOKS DO NOT RESOLVE IT, AND THE ENGINES ARE UNANIMOUS.** This is
the clean case of a question the treatises answer one level coarser than the code needs — Ross says
*which lines* a barline connects, and the half-line-thickness question simply does not arise on a
plate, where an engraver's cut either meets the line or does not.

| asked | source | answer |
|---|---|---|
| ⛔ how far does a barline reach? | **Gould**, whole text searched | **UNKNOWN.** No statement of a barline's vertical extent at any precision. ⛔ Searched 2026-09-13, ⛔ do not repeat |
| ⭐ …and Ross? | **Ross p. 151** (printed; the *Barlines* chapter, between the page markers for 151 and 152 in the fulltext) | *"The lengths of barlines vary with different types of music. 1. For single-line music the barline connects the top and bottom lines of the staff."* ⚠️ Names **which lines**, ⛔ not which EDGE of them. The rest of the numbered list is about which STAVES a systemic barline joins (keyboard, three-stave organ, piano-vocal), ⛔ not about vertical extent |
| ⭐⭐ so what do the engines do? | LilyPond `scm/bar-line.scm:641` + `lily/staff-symbol.cc:346`; MuseScore `tlayout.cpp:1115`; Verovio `src/view_page.cpp:747` | **All three: line CENTRE to line CENTRE, exactly four staff spaces.** LilyPond takes the staff symbol's outer-edge extent and narrows it by half a line thickness at each end; MuseScore's `y2 − y1` is `4 × spatium` outright; Verovio's is `2 × (lines − 1) × unit`. 🚨 **The only engine spanning the outer EDGES is VexFlow** |
| ⭐⭐ …and one of them says WHY | **LilyPond**, source comment at `scm/bar-line.scm:648` | *"Due to rounding problems, bar lines extending to the outermost edges of the staff lines appear wrongly in on-screen display (and, to a lesser extent, in print) — they stick out a pixel. The solution is to extend bar lines only to the middle of the staff line — unless they have different colors, when it would be undesirable."* ⭐ A RESAMPLING argument, and this editor is the case it describes |
| ⭐ does a BRACE or BRACKET follow the same rule? | LilyPond `lily/system-start-delimiter.cc:114` | ⛔ **No, and deliberately.** A `System_start_delimiter` spans each staff symbol's OWN extent — the outer edges — while bar lines are narrowed. ⇒ the two marks differ by half a staff line at each end, which is what this repo now implements (Ross p. 155's *flush* brace against `barlineExtent`'s middles) |
| ⭐ what happens where a JOIN meets? | LilyPond `bar-line::widen-bar-extent-on-span` (`scm/bar-line.scm:691`) | The narrowing is **reverted on whichever side a span bar appears**, so the join and the line it joins are one stroke. ⚠️ Here it falls out of the geometry instead: `barlineGap` runs centre to centre too, so it overlaps the outer half of both lines |

### What was asked of it on 2026-09-13 (second question), and what came back

**Two questions, and ⭐ they are about TWO DIFFERENT OBJECTS.** (1) **How far after a BARLINE does a
MID-SYSTEM sign stand?** — a **clef change** or a **time-signature change** belonging to the bar that
the barline opens (⛔ *not* the system's left edge, whose 0.6–0.8 sp clef indent is already settled in
the 2026-09-01 fifth-question table above). (2) **How much air does a clef change get when it stands
INSIDE a bar, between two notes?** — the `beat > 0` case, drawn immediately before the note it
applies to, where the which-side-of-the-barline question does not arise at all.

⭐⭐ **THE MANIFEST-LEVEL FINDING: question (1) is, for the CLEF, a question all four books REFUSE.**
Gould, Ross, Stone and Gerou & Lusk agree with no dissent that a clef change belonging to the next bar
is drawn **BEFORE** that bar's barline and only the **time signature** stands **after** it — and two of
them forbid the other arrangement outright: Ross, *"A barline never precedes a clef sign unless it is
a systemic barline"* (p. 167), and Gerou & Lusk, *"Only a systemic barline can precede a clef sign"*
(p. 51). ⇒ *how far after a barline a clef stands* has **no rule in this library**, because in this
library a clef is not there. ⭐ **The second manifest-level fact: Stone printed p. 46 is the only page
in the library that states BOTH distances in prose**, in two adjacent paragraphs — and his own plate
draws what he wrote, which in this directory is worth recording on its own.

⚠️ **Method for every measurement below**: the page rendered with `pdftoppm` at the dpi named,
1 stave-space taken from the staff-line pitch **on the same plate**, a column ink profile with the
five staff-line row-bands masked, and ink edges read at two grey thresholds (a tight and a loose one)
so the figure is a **range**, not a false precision. All distances are **ink to ink** (white gap)
unless the row says otherwise. ✅ **All four page offsets in this manifest held and were re-verified
against the printed folio on the rendered page** — Gould +20 (printed 8 = PDF 28, 42–43 = 62–63,
152 = 172, 235 = 255), Ross +12 (printed 75 = PDF 87, 167–168 = 179–180), Stone 2-up
(printed 46/47 = PDF 34), Gerou & Lusk 2-up (printed 28/29 = PDF 16, 50/51 = PDF 27,
52/53 = PDF 28). ⛔ No route was found dead.

#### (1) A sign at the start of a MID-SYSTEM bar

| asked | source | answer |
|---|---|---|
| ⭐⭐ the CLEF: which side of the barline? | **Gould p. 8** (scan, *Ground rules ▸ Changing clef ▸ At the beginning of a bar*) | *"**The clef always goes before the barline, whether or not rests precede the entry**"* — with an `and` / `rather than` pair, ⭐ and the rejected drawing is a clef delayed to just before the entry, not a clef after the barline. Same page: *"The only time that clefs appear directly after a barline are clefs for cues (see* Positioning clef changes*, p. 573) and clef changes after repeat sections (see* Changes after a repeat*, p. 235)."* |
| the same, second source | **Ross p. 167** (*Change of clefs and time signatures*) | *"If a clef change affects an entire measure, the change is made **ahead of the barline** of the measure to be changed. **(A barline never precedes a clef sign unless it is a systemic barline.)**"* Restated in his *Barlines* chapter, **p. 151**: *"A barline never precedes a clef unless the barline comprises a complete system of music."* |
| the same, third source | **Stone p. 46** (*General conventions ▸ B. Clef Changes*) | *"At changes of clefs between measures, the new clef is placed about **one staff-line space before the barline**"* — with a cello figure, two arrowed instances. |
| the same, fourth source | **Gerou & Lusk pp. 28, 51, 52** | p. 28: *"The new clef (cue size) is placed **before the barline** if the clef changes mid-staff."* p. 51: *"If a clef change affects a complete measure, it is always placed before the barline"* + *"**Only a systemic barline can precede a clef sign.**"* p. 52: *"The rules for clef changes are not affected by the addition of a key change and/or time signature change. **The clef sign precedes the barline; the key signature and time signature follow the barline.**"* |
| ⭐⭐ the METER: which side? | **Gould p. 152**; **Ross p. 168**; **Stone p. 46**; **G&L p. 28** | Four sources, no dissent, and each is a whole sentence. Gould (*Placing time-signature changes*): *"**The new time signature is always placed after the barline.**"* Ross: *"Occasionally a time signature changes within a staff… As will be seen a **time signature change usually follows a bar line**. (A repeat bar is not considered a bar line although at times it serves the purpose.)"* Stone: *"Changes of time signatures must be placed **one staff-line space after the barline**, whether within a line or at the end of it."* G&L: *"The time signature is **placed after** the barline if the time signature changes mid-staff."* |
| ⇒ **so do the books distinguish clef from meter here?** | all four | ⭐⭐ **Yes — it is the sharpest distinction any of them draws in this neighbourhood.** The clef goes on the LEFT of the barline and the meter on the RIGHT, and G&L p. 52 says explicitly that adding a meter change does not move the clef. (Third witness already in this manifest: the 2026-08-27 key-signature table, Gould p. 92 / G&L p. 52 / Ross p. 168 — *clef before, key and meter after*.) |
| ⭐⭐ the number, in prose | **Gould p. 42** (*Spacing symbols ▸ Mid-system*) | *"**Allow a stave-space after a clef and on either side of a barline before a notational symbol. It is good practice to allow two spaces after a time signature or key signature.** Where a barline comes before the end of the stave, allow a stave-space at the end of the stave"* — verified verbatim on the scan; the lead was right. ⚠️ Note what it does and does not say: it prices the barline (1 sp each side) and the clef (1 sp after), and it never separates a clef at a bar's start from one inside the bar. |
| ⭐⭐ …and the same page, DRAWN and MEASURED | **Gould p. 43**, the *Mid-system* figure (600 dpi, 1 sp = 26.6 px) | ⭐ **This one figure engraves the whole question**: `& ‖: ♯♪ [beam] 9: │ 3/8 ♪. & │ ♭♭♭♭ ♩ 𝄾 │ ♮♪ [beam] │ 2/4`. Measured: **clef change → barline 1.01–1.13 sp** (bass clef) and **0.98–1.09 sp** (treble clef) · **barline → time signature 0.94–1.09 sp** (twice: mid-system, and again at the stave end) · **barline → key signature 0.79–0.90 sp** · barline → accidental 0.83–1.13 sp · time signature → note **1.99–2.10 sp** (✓ her stated two) · key signature → note **1.58–1.73 sp** (⚠️ short of the stated two) · after the last sign to the stave end 1.01–1.09 sp. |
| ⚠️ …and her own RULER is 6–10% long | the same figure | The figure prints its own key, `⌐ = 1 stave-space`, and thirteen brackets. Measured against the staff on the same plate, the eleven "1" brackets run **1.089–1.127 sp** and the two "2" brackets **2.10–2.14 sp**. ⇒ ⭐ **quote her drawn gaps as ≈1 sp, ⛔ never as 1.10** — the overshoot is the bracket's own two end-strokes plus anti-aliasing, not a wider gap. |
| 🚨 the one gap she did NOT bracket | the same figure | **barline → key signature.** Every other gap in the figure carries a `⌐`; the four-flat signature after the second barline has none, and it is also the tightest gap in the figure (0.79–0.90 sp). ⛔ No prose anywhere covers it. |
| the METER after a barline, drawn — second source | **Ross p. 168**, the *time signature changes within a staff* plate (450 dpi, 1 sp = 24.0 px) | `3/4 ⋯ ‖ 4/4 ‖: ⋯ │ 2/4 ⋯ 4/4 :‖`. **plain barline → time signature ≈0.9–1.15 sp ink** (≈1.2–1.4 sp origin-to-origin, which is Ross's own convention) · **thin double barline → time signature 1.46 sp**. ⚠️ A 1970 photo-offset with visibly thinned lines and dotted lines standing in for the music; treat as corroboration, ⛔ not as a number. |
| the METER after a barline, drawn — third source | **Stone p. 46**, the *Time Signature Changes* figure (600 dpi, 1 sp = 29.0 px) | Two arrowed instances: **barline → time signature 0.83 sp** (mid-line) and **0.97 sp** (at the line's end). ⭐ **His plate draws his sentence** — *"one staff-line space after the barline"*, and Stone's numbers are GAPS by his own statement (the 2026-08-27 key-signature table records that convention). |
| the CLEF before a barline, drawn — measured in three books | **Gould p. 8** · **Ross p. 167** · **Stone p. 46** | Gould (600 dpi, 1 sp = 26.75 px), two instances: **0.67–0.75 sp**. Ross (450 dpi, 1 sp = 25.5 px): **1.22 sp**. Stone (600 dpi, 1 sp = 28.75 px), two instances: **0.90 sp** and **1.25 sp**. ⇒ across three books the clef sits **0.7–1.25 sp** left of its barline, i.e. Stone's *"about one staff-line space"* is a fair description of all of them, and Gould's own p. 8 drawing is the tightest. |
| the METER after a barline, drawn — fourth source | **Gerou & Lusk p. 28** (400 dpi, 1 sp = 33.5 px) | The *With changing time signatures* figure, `& 2/4 │ 3/4`: **barline → time signature 0.75 sp**. |
| ⭐ all three signs at one barline, drawn | **G&L p. 29** *With multiple courtesy signs* (400 dpi, 1 sp = 34.25 px) | `& ♭♭ 2/4 │ ⋯ 9: ‖ ♯♯ 3/4` — clef **before** the thin double, key and meter **after** it. **clef → barline 0.67 sp · barline → key signature 0.67 sp · key signature → meter 0.85 sp**; the double barline's two lines are 0.38 sp left-edge to left-edge. |
| ⚠️ the same case in their *Clef signs* entry — and it is CRAMPED | **G&L p. 52** (400 dpi, 1 sp = 34.0 px) | `& ♯♯ 3/4 ♩. │ ♩. 9: ‖ ♯♯♯ 4/4` (open staff). **clef → double barline 0.21 sp · double barline → first sharp 0.18 sp.** ⛔ Do not read this as a spacing statement: it is a small dictionary cut in which the signs nearly touch. Recorded so nobody measures it again and believes it. |
| 🚨 what a book DRAWS when the figure is about something else | **Gould p. 152**, the *Size and placing* figure (600 dpi, 1 sp = 26.5 px) | `3/4 𝄻 │ 12/16 𝄻 │ 5/8` — **barline → time signature 0.49–0.64 sp**, i.e. **half** what her own p. 43 spacing plate gives. ⭐ The figure is about NUMERAL HEIGHT, not spacing, and it is cramped to fit the `not` counter-example beside it. ⛔ A plate only speaks for the question it was drawn to answer. |
| ⭐⭐ a sign AFTER a barline vs a CAUTIONARY one before a break | **Gould pp. 7, 93, 152** · **Stone p. 57** · **G&L pp. 28–29, 52** | ⭐ **The two families part company here, and it is the same parting as above.** The **clef** stays on the LEFT of the barline in both cases and the stave is **closed** (Gould p. 7 *"placing the new Clef at the end of the previous system before the barline"*; G&L p. 28 *"A courtesy clef is placed before the last barline of the staff"*). The **meter** stays on the RIGHT in both cases and the stave is **left open** (Gould p. 152 *"add a cautionary indication at the end of the first system, **after the last barline**"*; G&L p. 29 *"A courtesy time signature is placed **after** the last barline… leave open"*). ⇒ **the side never changes; only what follows the sign does.** |
| …and is the cautionary spaced DIFFERENTLY? | measured — ⛔ no source states one | **G&L**: courtesy meter **0.59 sp** after the last barline (p. 29) against **0.75 sp** for the mid-staff change (p. 28) — tighter, but the same order. **Gould p. 152**: the cautionary `2/4` sits **0.23 sp** after its barline, hard against it, at the stave's end. ⛔ **No book anywhere says the cautionary gets a different distance.** The 2026-08-28 second-question table above holds the other half of this (the ~1.9 sp of bare stave *after* a courtesy). |
| ⭐⭐ the one place Gould DOES draw a clef after a barline | **Gould p. 235** (*Changes after a repeat*), measured at 600 dpi, 1 sp = 26.5 px | *"A change that affects the music only after a repeat goes **after the repeat barline**"* — drawn as `9: 2/4 ‖: ⋯ :‖ & ♯♯ 3/4 ⋯`. Measured: **end-repeat thick line → treble clef 0.38–0.49 sp**, clef → first sharp 0.94 sp. ⚠️ A wavy-line schematic, and tight; but it is the only engraving in the library of a clef standing right of a barline mid-system. Same section, p. 234: *"When there is a new clef, key signature or time signature at the beginning of a repeated section, place the repeat marks **afterwards**."* |
| ⭐ …and the OTHER exception turns out not to be one | **Gould p. 573** (*Clefs for cues ▸ Positioning clef changes*) | p. 8 names cue clefs as a case where a clef appears after a barline; p. 573 then says *"**When a cue begins immediately after the barline, place the cue clef before the barline**"*, and the genuinely-after case is a different one: *"The cue clef should be as close to its cue notes as possible. Thus, where a bar has a new key signature or time signature, **place the cue clef after these changes**."* ⇒ at such a bar the order is **barline → key → meter → cue clef**. |
| how BIG is a mid-system clef | **Gould p. 7** · **G&L p. 51** · **Ross p. 167** | *"A change of clef placed after the beginning of the system is **two-thirds** of the size of the clef at the beginning of the stave"* · *"a **cue-size** clef is used (usually **75%** of the original clef size). Courtesy clefs are also cue size"* · *"use a clef **two or three sizes smaller** than normal. If this clef change continues on the following staff, the clef becomes normal size."* ⚠️ Relevant to the spacing because every gap above was measured against a clef already reduced. |
| ⭐ what a barline is WORTH, as an engraver states it | **Ross p. 74** (and the drawn measure on p. 75) | *"I consider the barline important enough for it to command space. The traditional engraving practice gives **one space for the barline** — a practice still employed by most plate engravers. (**This space is given after the barline prior to the first note of the measure.**)"*, then p. 75: *"Between the barline and the left side of the first note is **one space**"*, and for machine engraving *"one and one-half spaces following the barline"* to the note's **centre**. ⭐ So Ross's barline space is a **one-sided** budget, spent on the right; Gould p. 42's is **two-sided**. |
| ⛔ a NUMBER for barline → clef, in the cases where a clef *is* drawn after one | — | **UNKNOWN — no source states one.** Searched, page by page: Gould pp. 7–8, 41–43, 92–93, 151–153, 233–235, 573; Ross pp. 74–79, 143–152, 167–168; Stone pp. 44–47, 57; Gerou & Lusk pp. 25–29, 51–52, 78–81. Every number above for that case is a **measurement of one schematic** (Gould p. 235). |
| ⛔ Ross's spacing chapter on ANY mid-system distance | **Ross pp. 143–147** | **Searched and it is not there.** *Spacing for key signatures, accidentals, time signatures, first notes, and repeat bars* is entirely about the **system head** (clef→key 3½, key→meter 2½, meter→note 3½, all origin-to-origin) plus repeat bars following those signs. ⛔ Not one number for a barline mid-system. His only mid-system quantity is the **1 space after a barline before the first note** (p. 74–75). |
| ⛔ a mid-system meter change in REAL engraved music | — | **UNKNOWN — none was found to measure.** All four drawn instances in the library (Gould pp. 43 and 152, Ross p. 168, G&L pp. 28/29/52) are **schematics** — wavy or dotted lines standing in for the music — and they disagree with each other by a factor of two (0.5 → 1.15 sp). ⭐ That spread is itself the finding: only Gould p. 43's plate was drawn *to state a spacing*, and it is the one that agrees with the prose. |

#### (2) A clef change INSIDE a bar, between two notes

| asked | source | answer |
|---|---|---|
| ⭐⭐ **is Gould's *"a stave-space after a clef"* about the mid-BAR case, the bar-START case, or both?** | **Gould p. 42**, read in context on the scan | ⭐ **Both — it is written for neither in particular, and its plate only draws one of them.** The sentence sits under the heading **Mid-system** (the counterpart of *Beginning of the system* above it) and reads *"Allow a stave-space after a clef **and on either side of a barline before a notational symbol**"* — one clause covering any clef standing away from the system's head, with no mention of bars or beats. ⛔ **But every clef in the p. 43 plate that goes with it stands immediately before a barline**; there is **no mid-bar clef in that figure at all**, and the bracket printed *before* the bass clef (note → clef, 1.09 sp) and the one *after* it (clef → barline, 1.13 sp) are both bar-start instances. ⇒ the 1 sp is the general mid-system default; the mid-bar case is governed by the paragraph immediately below it, on the very next page-turn of the same section. |
| ⭐⭐ …which is the ½-space escape hatch, and it IS about this case | **Gould p. 43** (*Spacing symbols ▸ Additional clefs and accidentals*) | *"Where notes are spaced close together, the addition of **clef changes** and accidentals can distort the rhythmic spacing. Although it is sometimes better to increase the spacing between notes to accommodate the clefs and accidentals, this wider spacing can be unhelpful, as well as impractical. Instead, **reduce the space around clefs and accidentals to ½ space, to minimize distortion**"* — with a `rather than` pair. ⭐⭐ **So yes, the escape hatch applies here, and this is the paragraph it comes from**: it is stated *of clefs among close notes*, not borrowed from the accidental rule. (The other, weaker floor is p. 41: *"the distance between characters should not be less than ½ stave-space and no characters should collide"*.) |
| ⭐⭐⭐ …and the pair MEASURED — the rejected version is the 1-space one | **Gould p. 43**, the *Additional clefs and accidentals* figure (600 dpi, 1 sp = 26.75 px) | `9: ♪ ♪ & ♪ ♪ ♪ 9: ♭♪ ♪`, drawn twice. **RECOMMENDED (the "½ space" one)**: preceding note → clef **0.19 sp** (a ledger line reaches into the gap) and **0.64 sp**; clef → the symbol it precedes **0.64 sp** and **0.60 sp**. **REJECTED ("rather than")**: note → clef **0.45** and **1.01 sp**; clef → next symbol **1.08** and **0.97 sp**. ⭐⭐ **The version she rejects as too wide is engraved at ≈1.0 sp — the same stave-space the *Mid-system* paragraph one paragraph above asks for.** ⇒ the two paragraphs are not in tension: 1 sp is the default and this figure is the licence to spend 0.6 when the notes are close. |
| the same case, a second Gould plate | **Gould p. 8** (*Changing clef ▸ Mid-bar*), 600 dpi, 1 sp = 26.75 px | *"Place the new clef **between beats**, rather than in the middle of a beat. This is least disruptive to the spacing of the bar"* · *"Between beats, change the clef **after** rests"* · *"Should a new clef be unavoidable in the middle of a beat, position it between half-beats or another subdivision"* · and the pointer *"(For spacing with clef changes, see* Additional clefs and accidentals*, p. 43.)"* Measured on the recommended drawing: preceding note → clef **0.75** and **0.82 sp**; clef → the following symbol **0.79 sp**. |
| ⇒ **is the mid-bar case spaced DIFFERENTLY from a bar-start clef?** | **Gould pp. 42–43 + the two plates**; ⛔ no source states it | ⭐ **No source says so in prose** — searched Gould pp. 41–43 and 7–8, Ross pp. 74–79 and 167–168, Stone pp. 44–47, G&L pp. 25–29 and 51–52. **What the plates do is a different matter**: Gould's bar-start clefs measure **0.67–1.13 sp** either side and her mid-bar clefs **0.60–0.82 sp**, i.e. the mid-bar clef is drawn **tighter**, exactly as the p. 43 paragraph licenses. ⛔ That is a measured tendency across two of her figures, ⛔ **not a stated rule** — do not quote it as one. |
| the mid-bar rule in the other books | **Ross p. 167** · **G&L p. 51** · **Stone p. 46** | Ross: *"With few exceptions, the substituted clef is placed **immediately before the note involved**"*, and for the fractional-beat case *"the clef is placed prior to the rest marking the silent portion of the beat"*; when rests precede, *"the new clef sign is placed directly before the notes affected, if said notes fall on the beat."* G&L: *"If a clef change is within a measure, the clef is placed **directly before the first note involved**"*, with two further cases after rests (on the beat → before the note; off the beat → before the rest). ⛔ **Neither gives a number.** |
| ⛔ **Stone on the mid-bar case** | **Stone p. 46** | ⭐⭐ **He refuses it, in one sentence, immediately after stating the bar-start rule: *"There are no specific rules for clef changes within a measure."*** ⇒ the only source in the library that says *nothing is settled here* rather than being merely silent — worth more than a guess, and worth not re-reading him for. |
| ⛔ Ross's mid-bar plate, measured | **Ross p. 167**, first figure | ⚠️ **Attempted and abandoned.** The plate (a mid-bar bass clef between two notes) reproduces at 450 dpi with the staff lines, stems and clef running together at every usable threshold; the clef→note gap reads anywhere between **0.3 and 0.9 sp** depending on where the edge is called. ⛔ Not quotable. (Same cause as the 2026-09-01 note that his thin lines measure 0.081 sp against Gould's 0.110 — a reproduction difference.) |
| ⛔ a NUMBER for note → clef, from anyone | — | **UNKNOWN — no source states one.** Gould prices only the space *after* a clef (1 sp, p. 42) and the cramped floor *around* one (½ sp, p. 43); Ross, Stone and G&L give the clef's POSITION in the rhythm and no distance at all. Every note→clef figure above is a measurement. |

### What was asked of it on 2026-09-14 (the ACCIDENTAL and the DOT), and what came back

The question was the **ACCIDENTAL** and the **AUGMENTATION DOT** — their gaps, their vertical
anchors, a chord's accidental columns, and the dot on a line — asked because P3 took both glyphs'
INK on 2026-09-14 and left every one of their placements with VexFlow. Written up in full as
`docs/research/accidental-dot-research.md` (§2 per book, §3 unanimity, §4 what we draw, §5 the open
decisions). ⭐ Answered **entirely from the four books on disk**: no web route was used, so none was
found dead.

🚨 **A MANIFEST-LEVEL CORRECTION, and it affects every existing Gerou & Lusk citation: THEIR PDF IS
2-UP.** PDF page *n* holds printed pages **2n − 4** and **2n − 3** — verified twice, by reading the
running heads off PDF 5 (printed **6–7**, *Accidentals*) and PDF 70 (printed **136–137**, the
*Stems* entry `docs/research/stem-length-research.md` cites). ⛔ `docs/research/stem-length-research.md`'s header says
*"Gerou & Lusk's PDF is 1-up with its own printed numbers"* — **that is wrong**, and it is the
second 2-up PDF in this directory after Stone's.

| asked | source | answer |
|---|---|---|
| ⭐⭐ how far does an accidental stand off its notehead, and how far does an augmentation dot? | **Gould pp. 54, 77–78, 87–90** · **Ross pp. 131–135, 169–171** · **Stone pp. 45, 53, 125** · **Gerou & Lusk pp. 3–9, 21–24** — all MEASURED at 600 dpi | ⭐ **The DOT: Gould p. 54 states *"usually a half stave-space's distance"* and her plate draws 0.37–0.44 sp edge to edge; Ross p. 169 writes *"approximately a space"* and his own plate draws 0.33–0.53 sp — his DRAWING engraves her SENTENCE.** 🚨 And the double-dot gap this repo attributes to Gould is **not hers**: she gives no number (*"close together and evenly spaced"*) and draws 0.26 sp, tighter than her own first gap; the ½-space-between-dots figure is **ROSS p. 171** and the equal-gaps principle is **GEROU & LUSK p. 22**. ⭐ **The ACCIDENTAL: only Ross states a gap — p. 131, *"one space and a half before the note"*, and his plate carries a dotted ruler proving it is LEFT EDGE to LEFT EDGE (measured 1.51 sp ⇒ 0.54 sp of ink); Gould gives none and draws 0.19–0.38 sp, flats closer than sharps.** ⭐⭐ Her p. 88 states the column MINIMUM geometrically — *"the closest that two sharps may be placed together is so that the edges of their crossbars align vertically"* — drawn abutting at **0.98 sp** of pitch with no air, and the overlapped version drawn and rejected. 🚨 **The column-sharing threshold is the one place the books split three ways: Gould an OCTAVE (7th and 6th conditional on the glyph), Ross a flat SEVENTH, Gerou & Lusk GREATER THAN A SIXTH** — and VexFlow's `Accidental.checkCollision` (3.0 lines, 2.5 under a flat) is Gould p. 88 almost verbatim. ⛔ **UNKNOWN in every book: whether a ledger line shortens for an accidental** — only LilyPond's *Essay*, node *Ledger lines*, says it, with no amount and a Bärenreiter plate for evidence; Gould p. 26 and G&L p. 84 sanction shortening only for *cramped conditions* / touching leger lines. ⛔ **Stone removes himself in so many words** (p. 45: *"too complex to be included in these rather general guidelines"*, footnoted to Ross) |

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

## 🚨🚨 `notat.io` and `musescore.org` are CLOUDFLARE-GATED — and one workaround FAILS SILENTLY

**Corrected 2026-08-28**, superseding the *"needs a browser UA"* note above. Measured, all three:

- `WebFetch` → **403**.
- `curl` with a browser User-Agent → **403** as well. ⛔ The UA workaround no longer works.
- 🚨 **`r.jina.ai` returns HTTP 200 carrying Cloudflare's *"Just a moment…"* interstitial** — i.e. a
  **SILENT failure**: a success status wrapping a page with none of the content in it. ⛔ An agent
  that does not read the body will report the fetch as fine and quote nothing, or worse, fill the gap.

⭐ **What DOES work: `WebSearch`** — it surfaces their prose in snippets, which is how both Finale
brace quotations were got (2026-08-28). ⭐ And `usermanuals.finalemusic.com`'s versioned trees serve
fine, **images included** — a dialog screenshot is what settled Finale's nine bracket shapes.

⛔ `www.finaletips.nu` is **DNS-dead**; the Finale plug-in reference lives at `pdk.finalelua.com`.

### What was asked of it on 2026-09-14, and what came back

The question was **the SLUR and the TIE** — thickness, arch, attachment, avoidance, the system break
— for `docs/research/slur-tie-research.md`, written because the arc's INK became ours that day
(`engine/engrave/curves/curveInk.ts`) while its SHAPE was deliberately left open. ⭐ The first time
**Ross and Stone** were asked this: `docs/plans/slur-plan.md` §11.7 (2026-08-15) lists both as
*"not obtainable"*, and both have been on disk since 2026-08-18. **All four treatises answer.**

| asked | source | answer |
|---|---|---|
| ⭐⭐ **a page offset nobody had recorded** | **Gerou & Lusk**, the whole PDF | 🚨 **THE G&L PDF IS 2-UP**, like Stone's — printed page P sits on **PDF page P/2 + 2** (even LEFT, odd RIGHT), calibrated on PDF 62 = printed 120/121 and PDF 73 = printed 142/143. Slurs printed **pp. 121–127** = PDF 62–65; ties printed **pp. 143–148** = PDF 73–76. ⛔ Not a simple `+n`. |
| where the material is | all four | **Gould** ties pp. 60–72, slurs pp. 109–114 (PDF +20) · **Ross** *Ties, Slurs, and Phrase Marks* pp. 136–143 (PDF +12) · **Stone** *Slurs and Ties* pp. 35–39 (2-UP: pp. 36/37 = PDF 29, pp. 38/39 = PDF 30) · **G&L** as above. |
| ⭐⭐ the tie's *"1–1½ stave-spaces deep"* — apex or total reach? | **Gould p. 62**, MEASURED at 450 dpi | **The APEX over the chord.** Her page draws the SAME two-note tie three times, labelled *centre* / *edge* / *slightly after*: apex **1.52 / 0.97 / 0.47 sp**, i.e. the two ends of her own stated band in the first two. ⭐ This closes the ambiguity `docs/plans/slur-plan.md` §13.2 left open — and it closes it **against** every engine, none of which reaches 1 sp. ⛔ The tie's height is HIS decision (§13.1) and was not re-opened. |
| ⭐⭐ does her DRAWING match her endpoint sentence? | **Gould p. 62**, same plate | ✅ **Yes, for once.** *"Centre of the notehead"* draws the tip over the head's centre to **±0.27 sp**; *"edge of the notehead"* draws it on the edge to **±0.15 sp**. ⭐ And a third fact no book states and no engine models: the three variants differ in DEPTH by **3×** on the same two notes. |
| a slur/tie THICKNESS, from any book | **all four** | ⛔ **UNKNOWN — none gives a number.** Gould specifies a thickness for beams, hairpins, tenuto lines, barlines, ledger lines and rests, and for the curve says only *"tapered arc"*. Ross: *"a thick center which gradually tapers to uniformly thin ends"*, no figure. Stone and G&L: nothing. ⭐ **MEASURED instead**: Gould's own ties are **0.30 sp** at the belly (≈2.8× her 0.106 sp staff line), on both p. 61 and p. 62. |
| a slur ARCH HEIGHT, from any book | **all four** | ⛔ **UNKNOWN.** Gould constrains only the direction — *"the curve of a long slur is flattened … may be completely flat in the middle"* (p. 109) — and **Ross states the same thing independently**: *"A long slur is a straight line with both ends bending uniformly towards the enclosed notes"* (pp. 140–141). ⚠️ **G&L p. 145 is the dissent**, and only for the tie: *"Adjust curve for longer ties. Raise or lower the center of the curve to the next space"* — i.e. a LONG tie gets DEEPER, quantised to whole spaces. |
| 🚨 Stone's tie-direction rule, which READS as a contradiction | **Stone p. 37**, the PLATE (PDF 29, right half, 300 dpi) | *"If both tied note-heads point down, the tie also curves downward"* reads as *stem down ⇒ tie below* — the opposite of everyone. **It is not.** His plate draws **stems UP with the tie BELOW**: Stone's *"the note-head points down"* means *the head hangs at the bottom of its stem*. ⭐ Same rule as Gould/Ross/G&L. The scan did not overturn the sentence, it **disambiguated** one that would otherwise have been written up as a fourth opinion. |
| ⭐⭐ the one number for ties in a CHORD | **Gould p. 65** | *"Place ties that are in the same direction **a minimum of one stave-space apart**. This applies to ties both on and outside the stave."* The only inter-tie number in any book; we have none. |
| 🚨 the INNER tie of a chord — a real three-way split | **Gould p. 65** vs **Ross p. 138** + **G&L p. 147** | Ross and G&L both place inner ties **by position on the staff** (above the middle line ⇒ above). **Gould prints that rule and labels it *not recommended***, preferring even ⇒ equal numbers each way / odd ⇒ the majority away from the stem. ⇒ 2 books vs 1, with the 1 having read the 2. |
| may a TIE end on a STEM? | **Gould p. 60** vs **Ross p. 136** | Gould: no, definitionally — *"if one or both ends point to a stem, the arc becomes a slur"*. **Ross: yes, with a drawn example** — *"It is also possible for the tie to extend from stem to notehead"*. |
| ⭐ does the SLUR get the staff-line rule too? | **Gould p. 110** + **Ross pp. 139–140** | **Yes, and we only apply it to the tie.** Gould: *"On a stave, the arc should be placed in a stave-space in order to be most conspicuous"* (with an *and/not* pair). Ross draws a **NOT CLEAR / CLEAR** pair for a short slur crossing staff lines. |
| the two halves of a BROKEN curve — should they match? | **all four books** + all five engines | ⛔ **Nobody asks them to match.** Each book constrains each half's *own* shape and the *direction*: a broken **slur** must be **angled** (Gould p. 112, G&L p. 125, Stone p. 38), a broken **tie** must stay **level/symmetrical** (Gould p. 65 with a *"ties too flat"* counter-example, G&L p. 146). ⇒ the repo's belief is confirmed from the books as well as the code. |
| ⭐ Stone is the fullest source on the system break | **Stone pp. 37–39** | The only book covering a line that ends with a **time-signature change** or a **clef change** (*"stop just before the new clef"*), and the only one that admits the consequence out loud: keeping the direction across the break *"will occasionally result in **wrong-looking** slur and/or tie positions"*. |
| ⛔ Ross on the system break | **Ross pp. 136–143** | **UNKNOWN — silent.** Read in full plus a full-text grep for `line to line`, `next line`, `system`. ⛔ Do not check again. |
| ⛔ Stone on any shape number | **Stone pp. 35–39** + his index | **Nothing** — no thickness, no arch, no gap. His section is position, direction and the line break only. ⛔ Do not check again. |
| ⛔ Gould's SLUR arch, as a measured table | — | **NOT MEASURED.** Her slur plates run the arc over noteheads, stems and beams inside the same x-window, so a column ink profile cannot separate curve from music without hand-tracing. `gould-scans/` p. 111 stays the only slur plate this project has measured. A real piece of work, not done. |
| ⛔ a fifth treatise both our sources point at | **Wanske, *Musiknotation*** | **UNKNOWN — not on disk, never fetched.** LilyPond's tie-direction code cites it by name and page: `/* Default: Put the tie oppositie of the stem [Wanske p231] … The direction of the Tie is more complicated (See [Ross] p136 and further). */` (`lily/tie.cc:84-93`). ⭐ Note that its **other** citation, Ross p. 136ff, **is** on disk and was read for the first time today. |
