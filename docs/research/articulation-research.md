# Articulations — the complete research: slurs, order, sides, DISTANCES, x, engines, ours (2026-09-27)

> ⚠️ **A MENU OF SOURCED OPTIONS, not a decision and not a work list.** What we do is his call.
> Every row carries its citation; where no source answered, the row says **UNKNOWN**. Every number is
> a house style's default (CLAUDE.md: *"an engraving NUMBER is never a blocker"*) — the rows are the
> preset menu.
>
> ⭐ **Read with `docs/research/slur-tie-research.md` §8** (2026-09-14), which already settled the
> slur ↔ articulation question from four books and three engines and measured eight plates. §1 here
> summarises it and adds LilyPond's full `avoid-slur` table; everything else is new.
>
> **Units.** `sp` = staff space. Verovio's "MEI unit" = **½ sp** (`src/doc.cpp:2027-2035`: a staff line
> is `2 × unit` apart). VexFlow's and our px: **10 px = 1 sp** (`STAVE_LINE_DISTANCE_PX`,
> `src/engine/engrave/inheritedDefaults.ts:76`). *Clear gap* = white between the two inks.

## Contents

0. Sources consulted (and the unreachable ones)
1. Inside or outside a SLUR
2. ORDER when a note carries several
3. SIDE and ORIENTATION, per articulation
4. ⭐ DISTANCES, in staff spaces
5. HORIZONTAL position
6. Special cases: chords, stemless notes, beams, ties, grace and cue notes
7. The engines' own values, file:line
8. What OUR engine does today, file:line
9. Differences from our engine (facts, not proposals)
10. UNKNOWN

---

## 0. Sources consulted

| source | route | status |
|---|---|---|
| **Gould, *Behind Bars*** | `reference/` PDF (printed = PDF − 20). OCR used only to LOCATE; every quotation read on the **scan**: pp. 115, 117, 118, 120, 121, 130, 188, 427 (+ 119, 122, 189 via OCR checked against earlier scans). **p. 121's two figures MEASURED** at 450 dpi (§4c) | ✅ |
| **Ross, *The Art of Music Engraving*** | `reference/` PDF (printed = PDF − 12). pp. 128–130 (PDF 140–142), 171–172 (PDF 183–184), 184–185 (PDF 196–197), 200 (PDF 212). Scans read for pp. 129, 184; the rest from his clean OCR layer | ✅ ⚠️ **Ross's names differ**: his *"marcato accent"* is **`>`**, his *"sforzando"* is **`^`** |
| **Stone, *Music Notation in the 20th Century*** | `reference/` PDF (2-up: PDF n = printed 2n−22 / 2n−21). pp. 5–6 (PDF 13–14, scan), 42–43 (PDF 32) | ✅ |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/` PDF (2-up: PDF n = printed 2n−4 / 2n−3). pp. 14–20 (PDF 9–12, scans), 128 | ✅ |
| **LilyPond** `beedbfa` | `~/dev/engine-sources/lilypond` | ✅ |
| **MuseScore** `929d1e9` | `~/dev/engine-sources/MuseScore/src/engraving` | ✅ |
| **Verovio** `efff0bc` | `~/dev/engine-sources/verovio` | ✅ (⚠️ its FERMATA is a separate element — not examined) |
| **VexFlow 5.0.0** npm build | `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/{articulation,tables}.js` — where OUR rows came from, ⛔ not an engraving opinion | ✅ |
| Gardner Read, Powell, Chlapik, B&H house manual | not on disk (`reference/README.md` §"Still missing") | ⛔ **UNKNOWN** |
| Sibelius, Dorico, Finale | not asked this session (no web route tried) | ⛔ **UNKNOWN** |

---

## 1. Inside or outside a SLUR

### 1a. Books

| source | answer | citation |
|---|---|---|
| **Gould** | *"Usually, only tenuto lines and staccato marks may go inside the first and last notes of a slur"* | p. 121 (scan) |
| **Gould** | *"Articulation marks in the middle of a slur go inside the slur. Accents at the beginning and end of a slur usually go outside the slur, so that the slur can remain closer to the noteheads"*; exception *"when they would otherwise be too far from a note to be immediately apparent"* | p. 122 |
| **Gould** (drawn) | *"The smallest signs go closest to the notehead"* figure: the slur end passes **between the tenuto and the accent**; `>` and `^` outside it | p. 121 figure (PDF 141, measured §4c) |
| **Gould** | pause: *"Mid-phrase, a pause is positioned inside a slur"* | p. 189 |
| **Gould** | harmonic circles and open-string signs *"may be fitted inside a slur where they would otherwise appear too far from their notes"* | p. 427 (scan) |
| **Gould** | trill *"further from the note than any articulation marks. Only a long slur, a pause or octave sign goes further from the stave"* | p. 135 |
| **Ross** | *"With the exception of the beginning and ending of a phrase, all marks or articulation should appear inside of a slur"* (⚠️ his plate draws only accents and fermatas outside) | p. 130 |
| **Ross** | *"Marcato accents* [= `>`] *are placed outside of a tie. Staccato dots and tenuto accents are usually placed within the tie or slur"*; fermata *"placed below a long phrase mark"* | pp. 130–131 (OCR, page not verified on the scan) · p. 185 |
| **Stone** | *"the slur should begin and end between the note-head (or stem-end) and the accent. All other accents, etc., should be covered by the slur"* · *"Fermatas in slurred passages are treated like accents"* | pp. 42–43 |
| **Stone** | staccato + tenuto *"should all appear between the note-heads (or stem-ends) and the slur (this applies equally to the first and last notes)"*; very wide slurred intervals: *"the first or last accent should be placed between the note-head and the slur"* | p. 43 |
| **Gerou & Lusk** | *"The beginning or ending of a slur is placed outside staccato and tenuto marks"*; *"Articulations between the beginning and ending notes remain inside the slur"* | p. 128 |

⭐ **Four books agree**: staccato + tenuto **inside** everywhere (incl. the end notes); accents (and
fermatas, Stone) **inside in the middle, outside at the two ends**.

### 1b. Engines

| engine | inside | outside / around | mechanism | citation |
|---|---|---|---|---|
| **LilyPond** | `inside`: staccato, staccatissimo, tenuto, **marcato**, stopped, turn, reverseturn, slashturn, haydnturn | `around` (moved only on collision): **accent, portato, espressivo, fermatas, up/down bow**, flageolet, mordents, pralls, heel/toe. `outside` (always moved): **trill**, open, halfopen, snappizzicato, coda, segno. `ignore`: accentus, circulus, ictus, commas | `inside` ⇒ the slur's `extra-encompass` (SLUR yields); `outside`/`around` ⇒ an offset callback moves the MARK past the curve | `scm/script.scm:20-513`; `lily/slur.cc:365-406`, `:259-330`; `scm/define-grob-properties.scm:70-78` |
| **MuseScore** | `layoutCloseToNote()` = staccato or tenuto (not their combined glyphs; not staccato on TAB) | every other mark on the slur's **start/end chord** moved clear by `articulationMinDistance` **0.4 sp**; nothing moves mid-slur | close marks → slurs → `layoutArticulations3` | `dom/articulation.cpp:263-271`; `rendering/score/chordlayout.cpp:1177-1215` |
| **Verovio** | all not in `s_outStaffArtic` (staccato, staccatissimo, tenuto, spiccato…) | `s_outStaffArtic`: accent, soft accent, **marcato**, up/down bow, harmonic, snap, fingernail, damp, dampall, lhpizz, open, stop | an inside mark on the start note ⇒ **"portato slur"** (endpoint over the mark); outside marks on boundary notes pushed clear | `src/artic.cpp:29-36, 84-94`; `src/slur.cpp:1058-1086` |

⚠️ **Marcato** is where they part: LilyPond inside; MuseScore + Verovio outside; Gould's p. 121 figure outside.

---

## 2. ORDER when a note carries several

### 2a. Books

| source | answer | citation |
|---|---|---|
| **Gould** | *"The smallest signs go closest to the notehead"* — drawn, from the head out: **staccato → tenuto → accent `>` → marcato `^`**, both on the notehead side and the stem side | p. 121 figure (measured §4c) |
| **Gould** | portato: **dot nearest, tenuto outside** (and wedge + tenuto the same) | p. 115 (scan) |
| **Gould** | pause *"further from the stave than other markings stacked on the notehead, except for the octave sign"* | p. 188 (scan) |
| **Gould** | strings, from the note out: **articulation → open string / harmonic circle → fingering → string indication → pause → `⊓` and `V` (furthest)** | p. 427 (scan) |
| **Gould** | bowing: *"above all other markings"* | p. 405 |
| **Gould** | Schoenberg stress signs *"outside any articulation marks"* | p. 115 |
| **Stone** | tenuto + staccato: *"the dot (which is closest to the note-head)"*; the sign table draws **accented tenuto** as tenuto nearest, `>` outside | p. 6 (PDF 14) · p. 5 table (scan) |
| **Ross** | `^` with a dot: *"the open end of the accent sits just above or below the dot"*; plate (f): dot nearest, `>` outside; *"When an accent is used in conjunction with a fermata, the fermata goes above the accent"* | pp. 129–130 (scan) · p. 184 |
| **Gerou & Lusk** | as a CATEGORY: **durational** (staccato, tenuto) nearest, **force** (accent, marcato) outside — drawn `.`+`-`, `.`+`>`, `.`+`^`, `-`+`>`, `-`+`^`; tenuto + staccato: the tenuto *"has the function of an articulation of force"* and goes outside | pp. 18–19 (scan) |
| **Gerou & Lusk** | *"Keep the two combined articulations together (on the same side of the note)"*; never combined: staccatissimo + staccato, accent + marcato | pp. 19–20 (scan) |

⭐ **Every book gives the same order**: staccato → tenuto → accent → marcato → (trill →) fermata →
bowing; an octave sign further still (Gould p. 188). Gould's reason is SIZE, G&L's is FUNCTION;
they agree on every pair both cover.

### 2b. Engines

| engine | order | citation |
|---|---|---|
| **LilyPond** | `script-priority`, *"Smaller means closer to the head"*, + the input index: **staccato −100** (also accentus, circulus, ictus, semicirculus) → **tenuto −50** → **accent, marcato, portato, staccatissimo, … 0** (default = input index = **user order**) → flageolet 50 → **trill 150** → **fermatas 175** → **up/down bow 180** | `define-grob-properties.scm:1063-1066`; `lily/script-engraver.cc:123-156`; `lily/script-column.cc:145`; `script.scm:397, 418, 120, 434, 451, 86` |
| **MuseScore** | **staccato always first**, then tenuto, then the rest in **insertion order**; accent and marcato replace each other | `dom/chord.cpp:704-721`, `:1837-1848` |
| **Verovio** | **encoding order** — no sort (`grep sort` in `artic.cpp`, `adjustarticfunctor.cpp`, `calcarticfunctor.cpp` finds none); each mark piled on the previous one | `src/convertfunctor.cpp:1277-1307`; `src/adjustarticfunctor.cpp:64-82` |
| **VexFlow** | the order the modifiers were ADDED | `articulation.js` `format`, transcribed in ours `articulationStack.ts:79-111` |

---

## 3. SIDE and ORIENTATION, per articulation

### 3a. The general rule

| source | answer | citation |
|---|---|---|
| **Gould** | *"Articulation goes where it is most conspicuous: to the notehead. Except in double-stemmed writing … never place articulation below down-stems"*; two parts: *"at the end of each stem"*, never on the stave | p. 117 (scan) |
| **Gould** | *"When space below the stave is limited, all articulation may be placed above"* | p. 117 (scan) |
| **Ross** | staccato *"directly above or below the note head"*; two parts: *"the dot is placed on the stem side"* | p. 171 |
| **LilyPond** | `side-relative-direction DOWN` (= opposite the stem = notehead side): accent, staccato, staccatissimo, tenuto, marcato, portato, espressivo; `direction UP` forced: fermatas, trill, bows, stopped, open, harmonics, turns, mordents | `script.scm` rows |
| **MuseScore** | multi-voice ⇒ the stem side; single voice ⇒ the notehead side; **marcato forced UP** (*"Gould, p. 117: strong accents above staff"*); ornaments by voice parity | `chordlayout.cpp:825-840` |
| **Verovio** | the layer's stem side when there are layers; else opposite the stem; outside marks in `s_aboveStaffArtic` flipped above | `calcarticfunctor.cpp:37-77`; `artic.cpp:34-36` |

### 3b. Per articulation

| mark | side | orientation / glyph | sources |
|---|---|---|---|
| **staccato** (dot) | notehead side | symmetric. *"smaller than the duration dot"* (Gould p. 116) | Gould pp. 116–117; Ross p. 171 |
| **staccatissimo** | notehead side | **wedge** points at the note. Gould: *"staccato wedge or dash: a heavy staccato"*, *"Staccatissimo … is best indicated verbally together with staccato dots"*; G&L: *"always wedge-shaped"*; Stone: dot = light, wedge = *"hard, heavy staccato (sometimes called staccatissimo)"*. Verovio maps `stacciss` → SMuFL **E4A8 wedge**, `spicc` → **E4A6** | Gould p. 115; G&L p. 14; Stone p. 5; `verovio/src/artic.cpp:173-175` |
| **tenuto** | notehead side | symmetric; *"thicker than a stave-line … the width of a notehead"* | Gould p. 116; Ross p. 128 |
| **portato** (tenuto + dot) | notehead side | dot nearest the head | Gould p. 115; Stone p. 6; G&L p. 19 |
| **accent `>`** | notehead side; Ross: *"it might be more appropriate to keep all the accents above … preferably above"* when stems change | *"slightly wider than a notehead"*, equal-thickness lines (Gould p. 116); Ross *"approximately two spaces wide … opening of one space"* | Gould pp. 116–117; Ross p. 129 |
| **marcato `^`** | **above the stave regardless of stem** (Gould, G&L, MuseScore, Verovio); Ross: head side usually; LilyPond: notehead side | below it inverts to `v`, which *"may look like an up-bow symbol"* (Gould) — the reason to keep it above; *"thicker on one side"* (Gould p. 116) | Gould pp. 116–117; G&L p. 17; Ross p. 130 |
| **fermata** | *"Always place the pause above the stave, except in double-stemmed writing"*; lower part inverted below | ≈ **1 sp high, 2 sp wide** (Gould) · *"approximately one half space high, and slightly more than two spaces wide"* (Ross — ⚠️ scan says ½, disagreeing with Gould's 1) | Gould p. 188; Ross p. 184 |
| **stopped `+` / open `o`** | LilyPond forces UP; `stopped` inside a slur, `open` outside | — | `script.scm:409, 256` · books: **UNKNOWN** (not searched in the brass chapter) |
| **up-bow `V` / down-bow `⊓`** | *"over the stave … above all other markings"*; a lower part's bowing inverted below (not recommended) | Ross: up-bow ≈ 1 sp wide × 2 sp high, down-bow ≈ 1½ sp square | Gould p. 405; Ross p. 200 |

---

## 4. ⭐ DISTANCES, in staff spaces

### 4a. The books' stated numbers

| distance | source → value | citation |
|---|---|---|
| **notehead → mark, inside the staff** | Gould: *"no closer than the first clear stave-space from the note. Centre tenuto lines and staccato dots in a stave-space"* — note in a space ⇒ *"placed in the space next to the note"*; on a line ⇒ *"the next clear space"* | Gould p. 119 |
| … as a number | Stone: *"Staccato dots are one or 1½ spaces from the center of the note-head, depending on whether the note-head is in a space or on a line"* — **1 sp (space note) / 1.5 sp (line note), centre to centre**. Ross: dot *"never nearer than a third to the note head and never further than a fourth"* (= **1–1.5 sp**); tenuto *"not less than an interval of a third and not more than an interval of a fourth"* | Stone p. 6; Ross pp. 171–172, 129 |
| **notehead → mark, outside the staff** | Stone: *"For note-heads outside the staff, the staccato dots should never be closer than one full staff-space from the center of the note-head"* (**≥ 1 sp centre-to-centre**) | Stone p. 6 |
| **stem end → mark** | Gould: *"Within the stave, place articulation marks in the first clear stave-space beyond the end of the stem. Articulation outside the stave should be about **half a stave-space** from each stem"*; *"Only staccato dots and wedges may fall within the length of the stem"* | Gould p. 121 (scan) |
| … | Ross: dot *"approximately one half space from the tip of the stem unless a staff line interferes"*; tenuto *"can be one-half space from the end of the stem"*; `>` *"approximately one-half space from the end of the stem"*; fermata tip *"even with, or slightly above, the stem end"* | Ross pp. 172, 129, 184 |
| **between stacked marks** | Gould: *"An additional mark takes a separate stave-space further from the note. Do not cram more than one articulation mark into a stave-space"* (inside the staff). Stone: dot → tenuto *"one staff-space"* | Gould p. 120 (scan); Stone p. 6 |
| **accents inside the staff** | Stone: *"should appear in a space rather than on a line and should never be closer to the note-head than a fourth"* (**≥ 1.5 sp**). Ross (`>`): *"never be closer to the note head than an interval of a fourth, measuring from the center of the note head to the center of the accent"*; outside the staff the gap may reach *"an interval of a seventh"* (3 sp) | Stone p. 6; Ross p. 129 |
| **staff lines** | Gould: *"A stave-line must never obscure the articulation"*; `>` *"clearest when centred in a space"*; **`^` and the wedge *"should intersect a stave-line"***, the `^`'s top crossing it *"so that the white space at the peak shows through"* | Gould p. 120 (scan) |
| … | Ross: dot *"always … in a space when inside the staff and never on a line"*; tenuto *"within the staff … always falls within a space"*; `>` in the staff *"in a space and not on a line"*; `^` placed so *"the white space between the sides"* is not bisected | Ross pp. 172, 128–130 |
| … | G&L: staccato, staccatissimo and tenuto *"Placement is in the next space from the notehead, whether the note is on a line or space"* | G&L pp. 14–15 (scan) |
| **ledger-line notes** | Gould: articulation between notehead and stave *"no closer to the notes than the outermost stave-spaces"*; tenuto lines *"even further from ledger lines"* | Gould pp. 120–121 |
| **fermata** | Ross: *"placed just above the staff"* when the note is in it; for a note outside, *"the interval of a third above or below (measurements are made from the dot of the fermata)"* (**1 sp**); in the staff, its dot in a space | Ross p. 184 |
| **inside vs outside the staff** | Gould: `>`, `^` and wedges *"usually best placed outside the stave"*, may come in *"when they would otherwise be a long way from the note"*; *"a series of accents is best placed outside"*. Stone: `>` *"almost always appears outside the staff"*. G&L: accent *"Preferred placement is outside the staff"*, marcato *"outside the staff and above"*. Ross: *"preferable to keep the marcato accent* [`>`] *outside the staff lines"* | Gould p. 120; Stone p. 5; G&L pp. 16–17; Ross p. 129 |
| **minimum outside the staff** | ⛔ **UNKNOWN as a stated number** — no book gives a mark-to-staff clearance (Ross's fermata *"just above the staff"* is the nearest) | — |
| **slur ↔ mark** | no book states it; Gould's plates measure **≈0.6 sp** at the slur ends, ≈1.2–1.3 at the apex; Stone 0.55; Ross 0.2; G&L 0.8 | slur-tie-research §8.2a |

### 4b. The engines' numbers

| distance | LilyPond | MuseScore | Verovio | VexFlow |
|---|---|---|---|---|
| head/stem → first mark | `padding` **0.20 sp** (fermatas **0.40**, portato **0.45**) — a clear gap from the support (`add-stem-support #t`), then quantized | outside staff: head edge + `propertyDistanceHead` **0.4**; stem tip + `propertyDistanceStem` **0.4**; inside staff: head on a line ⇒ **1.5 sp**, in a space ⇒ **1 sp** (centre to centre, `((line & ~1) + 3) × ½ sp`) | inside marks start at the note's drawing top/bottom (incl. stem + flag), then snapped; above/below the staff `topMarginArtic`/`bottomMarginArtic` **0.75 unit = 0.375 sp** | origin **1 sp** from the head (centre), **0.5 sp** from a stem tip (`getInitialOffset`), then snapped |
| between stacked marks | `padding` 0.20 each (side-position stacking) | inside the staff: **+1 sp** per mark; outside: previous height + `articulationMinDistance` **0.4**; staccato+accent outside the staff kerned **0.2** closer | previous mark's content edge + 0.375 sp | next text line: `round-half(height/10 + 0.5)` |
| staff lines | `quantize-position #t` (staccato, staccatissimo, tenuto, marcato…): inside the staff snapped to a space, off a line by ½ sp | close marks placed between lines (line maths); beamed: a stem-side mark keeps ≥ 0.4 sp even inside | inside marks: nearest inter-line position, + ½ sp if on a line | `snapLineToStaff`: inside the staff, a mark on a line moves ½ sp outward |
| min outside the staff | `staff-padding` **0.25 sp** for non-quantized marks (accent, portato, fermata…) | non-close marks start at `propertyDistance` **0.4 sp** outside the staff | outside marks start at the staff edge + 0.375 | `INITIAL_OFFSET` **−0.5** text line (½ sp) for `betweenLines: false` |
| slur | `slur-padding` **0.2** (marks moved outside a slur) | slur tip `0.5 sp` past an end mark; `articulationClearance` **0.20** | `slurMargin` 1.0 unit = **0.5 sp** | — |
| tie | — | `leaveSpaceForTie`: staccato **+0.4**, tenuto **+0.6** outside the staff; inside, the next space | — | — |
| citation | `script.scm` rows; `define-grobs.scm:3007-3008`; `side-position-interface.cc:403-455` | `styledef.cpp:307-309, 2041`; `chordlayout.cpp:788-796, 849-1003, 1043, 1054`; `slurtielayout.cpp:896, 1331` | `options.cpp:1678-1680, 1836-1838, 1478-1480`; `adjustarticfunctor.cpp:30-117` | `articulation.js:12-45, 110-122, 137-139, 253-281` |

### 4c. ⭐ MEASURED — Gould p. 121 (PDF 141, 450 dpi, 1 sp = 19.88 px from the plate's own staff)

Method: connected components with staff-line rows masked (`reference/README.md`'s recipe). ⚠️ The
*smallest signs* figure has no staff; it is calibrated on the plate above it on the same page, and
its tenuto measures 1.41 sp wide on both — the same scale. Gaps are clear white, ink to ink.

**(i) *Distance from stems* plate — stem tip → mark:**

| chord | mark, side | position | gap |
|---|---|---|---|
| 2 | tenuto above / below | outside the staff | **0.55 / 0.55 sp** |
| 3 | dot below | outside | **0.55** |
| 3 | dot above | stem ends inside space 1 ⇒ dot goes ABOVE the staff (centre −0.70 sp) | 0.95 (the rule is *"first clear space"*, not a distance) |
| 4 | tenuto above, in the top space (centre 0.53 sp) / tenuto below, outside | inside / outside | 0.46 / **0.60** |
| 5 | tenuto above in the top space / below outside | inside / outside | 0.81 / **0.60** |
| 6 | dot above, centre 1.54 sp (= a space centre) / dot below outside | inside / outside | 0.35 / **0.56** |
| 1 | accent above / below (measured at the stem's column, the `>` hangs left of it) | outside | ≈0.48 / ≈0.35 |

⇒ outside the staff: **0.55–0.60 sp** from the stem tip for dots and tenutos (her prose: *"about
half a stave-space"*). Inside: the marks sit **centred in spaces (0.53, 1.54 sp)**, whatever the gap.

**(ii) *The smallest signs go closest* figure — the stack:**

| gap | notehead side (left, below) | notehead side (middle, above) | stem side (right, above / below) |
|---|---|---|---|
| head / stem tip → dot | 0.51 (head) | 0.55 (head) | 0.20 (stem tip) / 0.30 (head) |
| dot → tenuto | **0.45** | **0.45** | **0.45 / 0.45** |
| tenuto → accent (a SLUR end passes between) | 1.56 | 1.51 | 1.26 / 1.01 |
| accent → marcato | — (marcato at the stem tip, 0.55 clear of it) | **0.25** | **0.25** / 0.50 (`v` below) |

⇒ Gould's stack: **dot → tenuto 0.45 sp**, **accent → marcato 0.25 sp**, and a slur between
tenuto and accent opens the stack to 1.0–1.6 sp. Head → dot 0.3–0.55 (slur-tie-research §8.2a
measured 0.55 on three other plates).

---

## 5. HORIZONTAL position

| case | source → answer | citation |
|---|---|---|
| general | Gould: *"Articulation is centred in line with the notehead, whether positioned next to a notehead or a stem"*; *"(Some editions do, however, centre articulation on the stem.)"* | Gould p. 118 (scan) |
| **staccato alone, stem side** | Gould: *"Staccato dots and wedges by themselves look best centred on a stem … although many editions do centre them on the notehead"*; *"may move beside the stem in cramped conditions"* | Gould p. 118 (scan) |
| **staccato combined, stem side** | Gould: *"When staccato dots or wedges are combined with other articulation marks – which are always centred on the notehead – staccato dots should be centred too"*. G&L: a combined staccato *"is centered on the notehead, even when it is on the stem side"*. Ross: a dot with `>` on the stem side *"is placed vertically with the note head"*; ⚠️ but with `^` both *"shall be aligned vertically with the stem"* | Gould p. 118; G&L p. 20; Ross pp. 129–130 |
| staccato / staccatissimo stem side (alone) | G&L: *"Center on the stem for opposite stem direction"*. Ross: two parts ⇒ *"aligned with the stem"* | G&L pp. 14–15; Ross p. 171 |
| tenuto, accent, marcato, fermata | notehead-centred on either side: G&L (tenuto *"Also center to the notehead, not the stem"*; accent/marcato *"centered on the notehead"*), Ross (tenuto, `>`, fermata *"with the notehead, not with the stem"*), Gould p. 188 (pause *"centres on the notehead (regardless of stem direction)"*) | G&L pp. 15–17; Ross pp. 128–129, 184; Gould p. 188 |
| double-stemmed | Gould: *"in double-stemmed writing, the articulation aligns vertically between the parts"* | Gould p. 118 |
| **LilyPond** | staccato + staccatissimo `toward-stem-shift` **1.0** (on the stem) and `toward-stem-shift-in-column` **0.0** (on the head when in a column with others) — **Gould's rule**; every other script 0.0 | `script.scm:386-408`; `define-grob-properties.scm:1375-1385` |
| **MuseScore** | `articulationStemHAlign` default **AVERAGE** (halfway between stem and head), options STEM / NOTEHEAD; head side: head centre | `styledef.cpp:316`; `chordlayout.cpp:856-873`, `:1023-1036` |
| **Verovio** | head centre; staccato/staccatissimo on the stem side moved to the stem **only when the note has ONE artic** (unless `staccatoCenter`, default false) | `calcarticfunctor.cpp:174-198`; `options.cpp:1160-1163` |
| **VexFlow** | `getModifierStartXY(ABOVE/BELOW)` = the head centre; no stem case | ours `EngravedArticulation.ts:193` |

---

## 6. Special cases

| case | source → answer | citation |
|---|---|---|
| **chords** | Gould: *"Centre articulation on the notehead that is on the correct side of the stem"* (adjacent/unison chords). Ross: *"above or below the note-head furthest from the end of the stem"* | Gould p. 119; Ross p. 171 |
| **stemless notes** | Gould: *"Place articulation as if the note were stemmed. Notes on the centre line or chords equidistant from the centre line are usually treated as if they had down-stems"*; two parts ⇒ *"moves in close to the noteheads"*. Stone: *"Articulation signs on whole notes are centered above or below the note(s), as if the notes had stems"* | Gould p. 119; Stone p. 6 |
| **beamed notes** | Gould p. 121's *"first clear stave-space beyond the end of the stem"* covers a beam end. MuseScore: *"beams can give stems weird unpredictable lengths"* ⇒ a stem-side mark keeps ≥ `propertyDistanceStem` even inside the staff. Verovio: the stem-side start includes the flag | Gould p. 121; `chordlayout.cpp:886-896, 947-956`; `adjustarticfunctor.cpp:40-58` |
| **ties** | Gould: tie ends *"align with the edge of the notehead … or else start slightly after and finish slightly before"* *"so that a tie does not collide with articulation"*. Ross: `>` *"further from the note head"* with a tie; fermata *"raised"* over a tie or slur. MuseScore: +0.4 / +0.6 sp (above) | Gould p. 62; Ross pp. 129, 185 |
| **grace notes** | Gould: *"Place articulation for grace notes where it will be most conspicuous — this will usually be outside the stave since scaled-down articulation is difficult to see on the stave"*; *"Tails, beams, articulation and accidentals are also scaled down proportionally"* | Gould p. 130 (scan); p. 125 as quoted in `src/engine/rendering/GracePass.ts:404-405` (not re-read) |
| — engines | LilyPond grace: `Script font-size −3` (≈ ×0.71); MuseScore `graceNoteMag` **0.7**; Verovio `graceFactor` **0.75** | `music-functions.scm:686`; `styledef.cpp:517`; `options.cpp:1326-1328` |
| **cue notes** | Gould: *"All notation symbols that are part of the cue (including rests, accidentals, articulation and dynamics) are scaled down"* | Gould p. 569 (via `reference/README.md`) |
| — engines | MuseScore `smallNoteMag` **0.7** (scales the chord, marks inherit `mag`); Verovio cue = `graceFactor` | `styledef.cpp:515`; `doc.cpp:2111-2118` |

---

## 7. The engines' own values, file:line

### LilyPond (`scm/script.scm`, Script grob `scm/define-grobs.scm:2996-3017`)

| property | value | rows |
|---|---|---|
| `padding` | 0.20 (almost all) · **0.40** fermatas · **0.45** portato · 0.8 bachschleifer | `script.scm:123, 177, 186, 223, 359, 507, 516` (0.40) · `:276` (0.45) · `:51` |
| `script-priority` | staccato −100 · tenuto −50 · (default = input index) · flageolet 50 · trill 150 · fermatas 175 · bows 180 | `:408, 424, 136, 441, 126, 94, 458` |
| `side-relative-direction DOWN` | accent, staccato, staccatissimo, tenuto, marcato, portato, espressivo, accentus, circulus, ictus | rows |
| `direction` forced | UP: fermatas, trill, bows, stopped, open, turns, mordents, pralls · DOWN: ictus, lheel, ltoe | rows |
| `quantize-position #t` | staccato, staccatissimo, tenuto, marcato, accentus, circulus, ictus, semicirculus, commas | rows |
| `toward-stem-shift` / `-in-column` | 1.0 / 0.0 for staccato and staccatissimo | `:395-396, 404-405` |
| `staff-padding` | **0.25** (all scripts; skipped when `quantize-position`) | `define-grobs.scm:3008`; `side-position-interface.cc:214-221` |
| `slur-padding` · `horizon-padding` | **0.2** · 0.1 | `define-grobs.scm:3007, 3003` |
| grace | `Script font-size −3` | `music-functions.scm:686` |

### MuseScore (`src/engraving/style/styledef.cpp`)

| style | default | line |
|---|---|---|
| `propertyDistanceHead` · `propertyDistanceStem` · `propertyDistance` | **0.4 sp** each | `:307-309` |
| `articulationMag` | 1.0 | `:311` |
| `articulationStemHAlign` | AVERAGE | `:316` |
| `articulationKeepTogether` | true (close marks keep near staff-anchored ones) | `:317` |
| `articulationAnchorDefault` · `…Other` | AUTO · TOP | `:313, 315` |
| `articulationMinDistance` | **0.4 sp** | `:2041` |
| `fermataPosAbove` / `Below` · `fermataMinDistance` | (0, −0.5) / (0, 0.5) · **0.4 sp** | `:2035-2037` |
| `graceNoteMag` · `smallNoteMag` | 0.7 · 0.7 | `:517, 515` |
| hard-coded | `stacAccentKern` **0.2 sp** (`chordlayout.cpp:1043`); tie room staccato **0.4** / tenuto **0.6 sp** (`:795-796`); slur tip past an end mark **0.5 sp** (`slurtielayout.cpp:896`); slur↔mark `articulationClearance` **0.20 sp** (`:1331`) | |

### Verovio (`src/options.cpp`)

| option | default | line |
|---|---|---|
| `topMarginArtic` / `bottomMarginArtic` | **0.75 unit = 0.375 sp** | `:1836-1838` / `:1678-1680` |
| `staccatoCenter` | false | `:1160-1163` |
| `slurMargin` | 1.0 unit = 0.5 sp | `:1478-1480` |
| `graceFactor` (also the cue size) | 0.75 | `:1326-1328`; `doc.cpp:2111-2118` |

### VexFlow 5.0.0 (`build/esm/src/articulation.js`, `tables.js`)

| value | | line |
|---|---|---|
| `getInitialOffset` | **1** sp from the head, **0.5** sp at a stem tip | `articulation.js:110-122` |
| stack step | `round-half(height/10 + margin)`, `margin = 0.5` | `:137-139` |
| snap | inside the staff, a line ⇒ ± `HALF_STAFF_SPACE` 0.5 | `:31-45` |
| `INITIAL_OFFSET` | −0.5 (text line ½ sp outside the staff, for `betweenLines: false`) | `:281`, used `:253-261` |
| `betweenLines` | `a.` `av` `a>` `a-` **true**; `a^` fermatas bows harmonics **false** | `tables.js:185-231` |

---

## 8. What OUR engine does today (`main` + working tree, 2026-09-27)

| what | value | file:line |
|---|---|---|
| marks that exist | `accent · staccato · tenuto` only (`'a>' 'a.' 'a-'`) | `src/types/notes.ts:14`; `engraved/NoteBuilder.ts:341` |
| ⭐ **ORDER** | `['staccato', 'tenuto', 'accent']`, *"first = closest to note head"* (commit `ca5ce6db`, 2026-04-03) | `engine/rendering/engraved/NoteBuilder.ts:67`; applied `:357-364`, `ScoreRenderer.ts:2940-2945`, `ghosts/MarkGhost.ts:65`, `beams/fanArticulations.ts:164` |
| side | one side for all of a slot's marks: single voice ⇒ notehead side; multi-voice ⇒ the voice's outer side; `articulationPlacement` override | `NoteBuilder.ts:342-356` |
| first mark from the note | **1 sp** from the outer head's centre, **0.5 sp** from a stem tip (VexFlow's `getInitialOffset`) | `engine/engrave/notes/articulationPlacement.ts:72-77` |
| origin | outside the staff: the mark's inner edge on that point (`origin [0.5, 1]` above, `[0.5, 0]` below); inside: centred | `articulationStack.ts:100, 108`; `articulationPlacement.ts:84`; `EngravedArticulation.ts:210` |
| staff lines | inside the staff: snapped to a half line, a mark on a LINE moved **½ sp** outward; outside: nearest half line | `articulationPlacement.ts:65-70, 81-83`; `articulationLines.ts` |
| inside-the-staff permission | `betweenLines: true` for **all three, the accent included** (VexFlow's rows) | `engraved/EngravedArticulation.ts:75-79` |
| min outside the staff | `ARTICULATION_OUTSIDE_ROW = −0.5` (½ sp) — reached only by `betweenLines: false`, i.e. **by none of our marks** | `articulationPlacement.ts:55-56, 78` |
| between stacked marks | next text line = `round-half(mark height in sp + ARTICULATION_STEP_MARGIN 0.5)` (up/down while inside the staff) | `engine/engrave/notes/articulationStack.ts:72, 88-89` |
| x | the chord's key 0 `getModifierStartXY` (head centre) — tenuto, accent AND staccato, both sides | `EngravedArticulation.ts:193` |
| x on the stem side | per-note flag `articulationStemAlign` ⇒ every stem-side mark of the note on the stem | `ScoreRenderer.ts:2213`; memory `project_articulation_stem_align` |
| slur ends | the endpoint moves outside **every** mark on the end note (accent included), gap `slurArticulationGap` **0.5 sp** | `curves/slurArticulationEndpoint.ts:45, 59-70`; `curves/curveStyle.ts:154`; `curves/SlurRenderer.ts:55, 643-644` (⚠️ modified in the working tree) |
| slur middle | marks are obstacles; the slur goes over; no mark ever moves | `curves/slurObstacles.ts` |
| 🚧 slur search (uncommitted) | `ARTICULATION_AVOID`: `a.`/`a-` inside, `a>` around (the curve clears it; ⚠️ *ours*, LilyPond moves the mark) | `curves/slurSearchProblem.ts:51-56` |
| tie | ⛔ no articulation/tie rule found | — |
| grace | glyph ×`graceScale()` (house **2/3**) AND the step out × the same (`outwardScale`) | `GracePass.ts:415-440`; `layout/graceRoom.ts:65-70, 91-93`; `EngravedArticulation.ts:119-125, 207` |
| cue | glyph × the note's `glyphScale` (cue default **0.75**, `gouldRoss`); the step out is **not** scaled (NoteBuilder sets no `outwardScale`) | `EngravedModifier.ts:139-145`; `layout/cueSize.ts:26-32`; `NoteBuilder.ts:364` |

---

## 9. Differences from our engine (facts, not proposals)

1. **ORDER — none for the marks we have.** `staccato → tenuto → accent` matches every book and
   LilyPond / MuseScore. ⚠️ No row for marcato, staccatissimo, fermata, trill, bowing; the sources
   order them marcato outside accent, fermata outermost but for bowing (Gould pp. 121, 188, 427).
2. **An accent at a slur's END goes INSIDE in ours** (`slurArticulationEndpoint.ts:59-70` takes
   every mark). Gould p. 122, Stone p. 42, Ross p. 130, G&L p. 128 put it **outside** at the ends;
   LilyPond and MuseScore move it out.
3. **We never MOVE a mark to clear a slur** (LilyPond `around`/`outside`, MuseScore end chords do).
4. **The accent may stand INSIDE the staff in ours** (`betweenLines: true`). All four books prefer it
   outside; all three engines place it outside by default (LilyPond `staff-padding`, MuseScore
   `propertyDistance`, Verovio `s_outStaffArtic`).
5. **Stem-side staccato x**: Gould p. 118 / G&L pp. 14–15 / LilyPond / Verovio put a LONE staccato
   on the stem and a combined one on the head; MuseScore averages. Ours: head by default, the flag
   moves all of a note's stem-side marks together.
6. **Stacked gap**: Gould's plate measures dot → tenuto **0.45 sp** clear; Stone says one staff-space
   (dot to line); MuseScore +1 sp inside / 0.4 outside; LilyPond 0.2. Ours is a rounded text-line step
   (height + 0.5, to the half) — font-dependent, not measured here.
7. **Stem tip → mark**: Gould ≈½ sp (plate 0.55–0.60), Ross ½; ours starts **0.5 sp** from the tip
   then snaps (VexFlow's).
8. **Cue marks' distance** is not scaled in ours while the glyph is; grace marks scale both. The
   books say only that the MARK is scaled (Gould pp. 125, 569).
9. **No tie rule** in ours; MuseScore adds 0.4 / 0.6 sp, Ross moves `>` and fermata further out.

## 10. UNKNOWN

- Gardner Read, Powell, Chlapik, B&H house manual — not on disk.
- Sibelius, Dorico, Finale values — not asked (no web route tried this session).
- Verovio's FERMATA (a separate element) — not examined.
- A **book** number for the minimum mark-to-staff clearance outside the staff — none found.
- Books on stopped `+` / open `o` placement — not searched (brass chapters).
- Ross's fermata height: the scan says *"one half space high"*, Gould says ≈1 sp — not resolved.
- Our own rendered gaps (e.g. the actual clear gap between our dot and tenuto) — not measured; it
  needs the browser (jsdom glyphs are 0-wide).
