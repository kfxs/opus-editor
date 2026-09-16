# Tremolo and tuplet numbers — the sourced alternatives (2026-09-14)

Research for the house-style presets. **It recommends nothing and changes no code**: every number that
runs today stays the default (a number is never a blocker), and each row below lists what the books,
the plates and the engines would put in its place. Values are in staff spaces (**sp**) unless marked.

---

## 0. The question, and the rows it covers

`docs/engraving-number-inventory.md` filed these as taste (T) or unsure (?) — this document answers them:

| inventory row | inventory line | code |
|---|---|---|
| stroke stack centred on the free stem (a RULE) | §2 Tremolo, :149 | `rendering/CenteredTremolo.ts:27` |
| `TREMOLO_FLAG_STEM_STRETCH` 0.25 × stem | :150 | `CenteredTremolo.ts:55` |
| `TREMOLO_STROKE_CLEARANCE` 0.25 sp each end | :151 | `CenteredTremolo.ts:65` |
| `PAIR_STROKE_CLEARANCE_SPACES` 1 sp | :152 | `rendering/TwoNoteTremolo.ts:34` |
| `PAIR_STROKE_CLEARANCE_RATIO` 0.25 × gap | :153 | `TwoNoteTremolo.ts:35` |
| `PAIR_STROKE_MAX_CLEARANCE_RATIO` 0.35 × gap | :154 | `TwoNoteTremolo.ts:42` |
| two-note tip offset ×1.5 | §5b, :287 | `rendering/VexFlowRenderer.ts:1226-1227` |
| `TUPLET_FONT_SIZE` 26 | §2 Tuplets, :160 | `rendering/ScoreTuplet.ts:20` |
| `NOTE_GLYPH_SCALE` 0.55 | :161 | `ScoreTuplet.ts:32` |
| `MARK_SPACE_EM` 0.15 | :162 | `ScoreTuplet.ts:38` |
| `BRACKET_END_GAP` 6 px | :163 | `VexFlowRenderer.ts:3220` |
| `GHOST_TUPLET_NUMBER_GAP` 1.5 sp | :164 | `rendering/GhostRenderer.ts:81` |
| bracket air 5 px | §5b, :288 | `ScoreTuplet.ts:147-148`, `VexFlowRenderer.ts:3304` |
| bracket leg 10 px | :289 | `ScoreTuplet.ts:180-181` |
| bracket thickness 1 px ⚠️ conflict | :290 | `ScoreTuplet.ts:170-181`, `VexFlowRenderer.ts:3331` |

It also gives rows for four numbers the inventory counts as sourced or as font facts but which a preset
will expose anyway: stroke step, stroke thickness, slope and width, and the two-note stroke weight.

**Read these first. This document cites them and does not repeat them:**
- `docs/tremolo-plan.md` §4: why the stack is centred, the FIT and FLAG stretches, and the bbox trap.
- `docs/two-note-tremolo-plan.md` §2: the tip anchor, the beam spending a stroke, and joined/open.
- `docs/tuplet-extension-plan.md` §9: the mark as runs, and the three bracket-end modes.
- `docs/tuplet-control-plan.md` §1–2: VexFlow's `Tuplet` boundary and its hard walls.
- `docs/staff-line-research.md` §4.3: the thin-line family's blast radius.

---

## 1. Sources, and how to reach each one again

Per `reference/README.md` (read first; nothing here was fetched from the web).

| source | pages used | how to reach it |
|---|---|---|
| **Gould, *Behind Bars*** | tuplet numeral + bracket **printed 193–199 = PDF 213–219**; tremolos **printed 221–228 = PDF 241–248** (offset +20) | `grep -n` `reference/gould-behind-bars-fulltext.txt` (tuplets ≈ lines 11791–12235, tremolos ≈ 13536–13900) to locate; `pdftoppm -f N -l N -r 450 -png "<pdf>" out` to read. ⛔ OCR not quoted — every quote below was read off the rendered page. |
| **Ross, *Art of Music Engraving*** | triplet **p. 159 (PDF 171), p. 161 (PDF 173)**; tremolo **p. 200 (PDF 212)**; vertical-spacing example **p. 68 (PDF 80)** (offset +12) | `ross-art-of-music-engraving-fulltext.txt` lines 9722–9990 (triplet), 11790–11830 (tremolo) |
| **Gerou & Lusk** | tremolo **pp. 151–153 (PDF 78, 2-UP)**; tuplets **pp. 156–157 (PDF 80, 2-UP)** | `.txt` lines 6209–6360, 6397–6560; PDF rendered at 300 dpi |
| **Stone** | irregular note divisions, graphic characteristics (OCR page markers **27–29**); stems, double-stemmed case (**p. 48**, PDF 35) | `.txt` lines 2590–2800, 3925–3945 — OCR only, not rendered |
| **MuseScore** `~/dev/engine-sources/MuseScore` @ `929d1e9` | `src/engraving/style/styledef.cpp`; `rendering/score/tremololayout.cpp`, `tupletlayout.cpp`, `stemlayout.cpp`; `dom/tremolosinglechord.cpp` | spatium-relative (`_sp`) |
| **LilyPond** `~/dev/engine-sources/lilypond` @ `beedbfa` | `scm/define-grobs.scm` (StemTremolo, Beam, TupletBracket, TupletNumber); `lily/stem-tremolo.cc`, `stem.cc`, `tuplet-bracket.cc`, `beam.cc`; `scm/paper.scm` | internal unit = staff space |
| **Verovio** `~/dev/engine-sources/verovio` @ `efff0bc` | `src/view_tuplet.cpp`, `adjusttupletsyfunctor.cpp`, `view_beam.cpp` (FTrem), `stem.cpp` (BTrem), `options.cpp`, `doc.cpp`; `data/Bravura.xml` + `data/Bravura/E220.xml` (glyph boxes/outline) | `drawingUnit` = **½ sp** |
| **VexFlow 5.0.0** `node_modules/vexflow/build/esm/src` | `tremolo.js`, `tuplet.js`, `metrics.js` | px at `STAVE_LINE_DISTANCE = 10` (`tables.js:647`) |
| **Bravura** | `src/engine/fonts/bravuraMetrics.ts`; glyph units 250 = 1 sp | |

### How the plates were measured (repeatable)

- Gould was rendered at 450 dpi (19.88–20.0 px/sp), Ross at 450 dpi (25.6–25.8 px/sp), Gerou & Lusk at 300 dpi (22.4 px/sp).
- Staff lines were found as long horizontal ink rows, and the staff space is (line 5 − line 1)/4.
- The staff lines were then erased, but only in columns where the vertical run was no thicker than a line. A mark crossing a line keeps its ink.
- **Extents** (numeral height, hook, gap, air) come from thresholded (<140) connected components. Anti-aliasing inflates a box by about **+0.05 sp**, so a bbox number reads slightly high.
- **Weights** come from threshold-free integrated ink: Σ(255−v)/255 down a column, as a median over columns. That is the `staff-line-research.md` §3 method, and those numbers are the trustworthy ones.
- Measurement windows were chosen so that any staff line inside was fully covered by the mark, so the line added no ink.
- Scratch scripts: `/tmp/claude-1000/wave2-tremolo-tuplet/{meas,tup,trem}.py` (temporary).

---

## 2. Books

### 2.1 Tremolo — single note

**Gould p. 221, *Design of the tremolo stroke*:**
> "Each stroke is a little thinner than a beam (see *Beams: Design*, p. 17). This is so that the spaces
> between the strokes are slightly wider than between beams (the spacing of strokes for both is the
> same). Thus the strokes are less likely to fill in and obscure a rhythm when placed against
> stave-lines."
> "The stroke is the width of a notehead, and is centred on the stem."
> "Strokes should not be too thin or they will be inconspicuous on the stave" — with a drawn
> *recommended / too thick / too thin* trio.

**Gould p. 221, *Position on the stave*:** *"A tremolo of only one stroke intersects a stave-line"*
and *"Two or more strokes must be at least one stave-space clear of a notehead, so as not to obscure
it"*. The second sentence comes with four correct drawings and two labelled *but not* / *nor*.

**Gould p. 222:**
- *"A stem should extend beyond the outermost stroke. It will need to be longer than normal to accommodate three (or more) strokes"*
- *"When a tremolo note has a tail or beam, extend a stem if necessary, so that the tremolo strokes are clear of tails and beams. Where there are one or two strokes, it is clearest if they centre on stave-lines"*
- *"Tremolo strokes must stay within the stave so as not to be confused with, nor collide with, a ledger line"*
- *"The semibreve has the same width of tremolo stroke as other note-values, which means the strokes are slightly shorter than the width of the notehead. Centre the semibreve strokes on the notehead, and place them above or below it according to the notional position of a stem"*

**Gould p. 223, *Angle of strokes*:**
> "Tremolo strokes slant diagonally from bottom left to top right, regardless of stem direction or beam
> angle"; "In some editions, the slant is slightly steeper than the steepest beam angle. In other
> editions, beamed groups take strokes of beam thickness … placed parallel to the beam" (*acceptable*).

**Ross p. 200:**
> "…a beam like symbol that is somewhat thinner than a beam and approximately the width of the note
> head. If only one symbol cuts the stem it usually passes thru a staff line (Example A below). If more
> than one symbol, they are placed for the greatest clarity (Example B below)."

**Gerou & Lusk:**
- p. 151: *"A short slanted line, ascending from left to right, through the stem"*.
- p. 152: *"(If placed on a beamed note, the beam counts as one of the lines.)"*
- p. 152, on whole notes: *"positioned as if there were a stem, but centered on the notehead"*.
- No numbers anywhere in these pages.

**Stone p. 48** (double-stemmed stems, OCR): stems are shortened ½–1 space *"except … when tremolo bars
are drawn through the stem"*. No tremolo geometry.

**⭐ MEASURED — Gould's tremolo plates** (1 sp = 20 px):

| plate | what | value |
|---|---|---|
| p. 221 thickness trio (integrated ink, vertical) | *recommended* stroke | **0.455 sp** |
| | *too thick* | 0.62 sp |
| | *too thin* | 0.23 sp |
| | staff line, same figure | 0.107 sp |
| p. 222 top figure (ink) | stroke, 3-stroke quarter | **0.457 / 0.476 sp** |
| p. 222 flagged/beamed figure (ink) | beam, same page | **0.513 / 0.546 sp** ⇒ stroke ≈ **0.87 ×** beam |
| p. 222 top (bbox) | step between strokes | **0.74–0.76 sp** |
| | slope (rise/run) | **0.22–0.23** |
| | stroke width vs notehead (thresholded) | 1.45 vs 1.20–1.25 sp (≈1.17 ×) |
| | stem length, plain quarter | 3.50 / 3.53 sp |
| | stem length, 3 strokes | 4.17 / 4.28 sp (**+0.65–0.75**) |
| | stem length, 4 strokes | 4.68 / 4.78 sp (**+1.2–1.25**) |
| | stem beyond the outermost stroke (ink) | **0.25–0.56 sp** |
| | ink gap, notehead → nearest stroke | **1.0–1.1 sp** |
| p. 221 clearance figure (ink gap notehead → nearest stroke) | correct: *(1) or (2)*, *and (3) or (4)* | **1.20 / 0.73**, **1.30 / 0.78** |
| | *but not* / *nor* | **0.0** (touching) / **≈0.3** |
| p. 222 beamed 16ths (2 strokes) | stroke centres | 2.25 / 3.04 sp below the top line, i.e. on lines 3 and 4 (±0.25) |
| | beam → top stroke | 0.41 sp |
| | bottom stroke → notehead | **0.64 sp** |

⭐ **What the plates say about the RULE.** Gould's stack is **not centred** on the free stem.

- It sits toward the tip: ≈0.25–0.55 sp of stem beyond the outer stroke, against ≈0.7–1.3 sp of air above the notehead.
- *"One stave-space clear"* is engraved as **one staff position free of strokes**. The minimal correct ink gap is 0.73 sp, because the notehead and the stroke each overlap a line.
- Once a beam occupies the tip, the note-side gap may shrink to 0.64 sp.

### 2.2 Tremolo — two notes

**Gould p. 225:** *"The two-note tremolo is notated with beams of ordinary beam thickness and centred
between the stems (or notional stems) of the relevant pitches."*

**Gould p. 226, *Positioning tremolo beams*:**
> "When beams and stems are separate, position the beams between the stems of the two pitches as if
> they were joined to the stems. However, the detached beams may move slightly closer to the noteheads
> than attached ones, so that stems are not forced to be greatly extended".

Also p. 226: *"Both stems must point in the same direction and enclose all the beams"*, and for an octave
or wider interval, beams between the notes *"slant in the direction of the interval"*.

**Gould p. 228, *Length of tremolo beams*:** *"Beams stop just short of each stem (or the notional
position of the stem on stemless notes). The distance from each stem should be the same."* And:
*"Beams for widely spaced tremolo notes may be uniformly shortened so as not to look ungainly."*

**Ross p. 200:** *"The secondary beams in the previous example should not touch the stems."*
**Gerou & Lusk p. 152:** *"connected with a beam, with incomplete beams placed between"*. No numbers.

**⭐ MEASURED — ink gap from a stem to the nearest stroke end** (row scans, 1 sp = 20 px):

| plate | case | left / right gap |
|---|---|---|
| p. 226 top | four crotchet pairs, 3 detached strokes | 0.76/0.70 · 0.75/0.86 · 0.71/0.86 · 0.75/0.76 sp |
| p. 226 *Minim tremolo notation* | fig. 2 (all detached) | **1.00 / 1.50** |
| | fig. 3 (outer beam joined) | **1.10 / 1.50** |
| p. 228 top | stem-up chord pair | 0.70 / 0.70 |
| | stem-down minims | 0.70 / 0.75 |
| | stem-down chord pair | 1.3–1.55 / 0.70 |

- Strokes, same plates: step **0.74–0.76 sp**; vertical thickness 0.55 sp (thresholded, so ≈ beam weight).
- 🚨 **Contradiction inside Gould.** p. 228 says the distance from each stem *"should be the same"*, but her own minim figures on p. 226 are **asymmetric by ≈0.5 sp**.
- The compact pairs (crotchets, chords) are symmetric at **≈0.7–0.85 sp**.

### 2.3 Tuplets — numeral and bracket

**Gould p. 193, *The tuplet numeral — Design and placing*:** *"The tuplet numeral is printed in italic …
The height of the numeral is 1½ stave-spaces."*

**Gould p. 194:**
- *"For legibility, place numerals wholly or partially outside the stave."*
- *The tuplet bracket — Design*: *"The numeral should be encompassed by a square bracket, and not the curved arc of older editions"*
- *"The bracket is broken for the numeral on which it centres vertically"*, drawn beside *bracket too high* and *bracket too low*.
- *"An unbroken bracket may be used and the numeral placed inside the bracket, but this arrangement takes up more vertical space than necessary."*

**Gould p. 195, *Length of brackets*:**
> "A bracket should extend from the left-hand edge of the first notehead or rest, to the right-hand edge
> of the final notehead or rest. … When a final note is up-stemmed and has a tail …, the bracket still
> finishes with the stem …, not with the tail"; "In some editions brackets finish just after the tail";
> "It is now usual to extend the bracket to the position of the hypothetical final division of the
> tuplet, so that the numeral occurs at the rhythmic centre of the group."

**Gould p. 197:** the bracket slant *"should not be too acute; match an equivalent beam slant"*, or it may
stay horizontal; over beamed notes it runs parallel to the beams.

**Gould p. 199:**
- *Proximity to the stave*: *"Always place the bracket outside the stave. The bracket ends and the edge of a numeral may intersect a stave-line"*, with a figure captioned *closest position of brackets to the stave*.
- *Double-stemmed writing*: brackets go *"further from the stave than articulation marks and also from slurs that are shorter than the brackets"*.

**Ross p. 159:** *"Its prime indication is the boldface italic numeral 3 approximately one and a third
spaces high."*

**Ross p. 161:**
> "A bracket line is as thick as a bar line (somewhat thicker than a staff-line). The length of the
> bracket is determined by the spacing of the triplet notes, and is measured from the left side of the
> first note, to the right side of the last note. If the last note in the triplet has a flagged
> up-stem, use the stem — not the flag — as the right-hand border."

**Ross p. 68** (a worked vertical-spacing chart): *"Provide two spaces for the '3' of the triplet … This
will leave ample room above and below the triplet."*

**Gerou & Lusk p. 156:**
- *"The numeral is larger than a finger number and is distinctly italic, preferably bold italic."*
- *"The bracket always begins flush left with the notehead and ends flush right with the notehead"*
- *"The bracket is broken to accommodate the number; the ends are always vertical."*

**Gerou & Lusk p. 157:** *"The tuplet unit is clearly seen if the bracket extends to include the entire
allotted space for the tuplet"* and *"The bracket does not extend to include the flag"*.

**Stone pp. 27–29** (OCR): numerals and brackets go on the stem side, and *"Phrasing and articulation marks
are always placed closer to the note-heads than the numerals and brackets"*. In more recent music, *"the
bracket extended to the right to show spatially the group's actual … duration"*. No numbers.

**⭐ MEASURED — tuplet plates:**

| quantity | Gould (p. 194 top; p. 199 ×2) | Ross (pp. 159/161) | G&L (p. 157) |
|---|---|---|---|
| numeral height (bbox, +≈0.05) | **1.56–1.66** (prose 1½) | **1.39–1.47** (prose 1⅓) | ≈1.21 |
| bracket line weight (integrated ink) | **0.106–0.116**; staff lines on the same figures 0.107–0.119 ⇒ **ratio ≈ 1.0** | **0.179** against a staff line of 0.180 (p. 159) ⇒ **ratio 1.0** | too coarse (2 px) |
| hook (ink, line top → tip) | **0.85–0.91** | 0.77–0.97 (flat segments) | — (sloped brackets) |
| gap numeral ink ↔ bracket end, per side | **0.45–0.85** (mean ≈0.6; right side larger, italic lean) | 0.23–0.59 | 0.44–0.45 |
| numeral centre vs bracket line centre | **0.00–0.07** | — | — |
| hook tip → highest note ink under it | **0.50–0.70** | not measured | — |
| bracket line centre → that ink | **1.25–1.50** | not measured | — |
| closest to the staff (p. 199) | line **≈0.5** outside the outer staff line; hook tips and the numeral edge **0.25–0.30** *into* the staff | — | — |

🚨 **Ross contradicts his own plate.** His prose says the bracket is *"as thick as a bar line (somewhat
thicker than a staff-line)"*. His engraving on p. 159 carries exactly a staff line's ink. Gould's plates
agree with Ross's plate, not with his prose.

---

## 3. Engines (values converted to sp)

### 3.1 Single-note tremolo

| | MuseScore | LilyPond | Verovio | VexFlow |
|---|---|---|---|---|
| stroke width | 1.2 (`styledef.cpp:744`) | 1.5; 1.0 if beamed or up-stem flag (`stem-tremolo.cc:93`) | Bravura glyph: 1.2 | Bravura E220: 1.2 |
| stroke thickness | 0.5 (`styledef.cpp:746`, *"was 0.35"*) | 0.48 (`define-grobs.scm:3500`) | glyph: 0.5 vertical | glyph: **0.5 vertical** (`data/Bravura/E220.xml`: 125/250 u) |
| step | 0.8 (`styledef.cpp:747`) | 0.81 unbeamed, else the beam's stride (`stem-tremolo.cc:124`) | glyph stack (Bravura `tremolo2/3`: **0.748 / 0.742**, `bravuraMetrics.ts:195-196`) | **7 px = 0.70** (`metrics.js:212`) |
| slope | lw/(2·w/2) = **0.417** (`tremolosinglechord.cpp:191`) | **0.25**; 0.40 for a down-stem with flag (`stem-tremolo.cc:77-78`) | glyph: 0.207 | glyph: **0.207** (E220 outline, 62/300 u) |
| outer end | **0.5 inside the stem tip** (`styledef.cpp:751`, `tremololayout.cpp:122`) | first stroke one step in from the stem end (`stem-tremolo.cc:339`) | stack centre at 1 sp (+0.5 on a line) + ½ glyph from the note centre (`stem.cpp:227-236`) | anchored at the tip, one step in if ≤3 strokes (`tremolo.js:23`) |
| note side | **1.25** from the note (`styledef.cpp:750`; stemless `tremololayout.cpp:95-99`) | whole note: 1.5 from the notehead (`stem-tremolo.cc:364`) | as above | — |
| flag / beam allowance | flag −1.5 (up) / −1.0 (down) / −0.75 (straight flags), −0.5 more for ≥2 beams; beamed −(beams×0.75−0.25) (`tremololayout.cpp:132-141`) | strokes shift (durlog−2) steps, +½ step on up-stems (`stem-tremolo.cc:344-346`) | stem lengthened in ¼-sp steps when <¼ sp of stem would remain beyond the glyph (`stem.cpp:176-185`) | none |
| stem lengthening | min stem = stack + 1.25 + 0.5, in ¼-sp steps (`stemlayout.cpp:427-429`) | length ≥ 1 + 2×stack + 1, plus 2(durlog−1.5) steps with flags, +1 step up (`stem.cc:568-585`) | ≥ ¼ sp beyond (above) | none |
| staff clamp | strokes clamped inside the staff (`tremololayout.cpp:147-153`) | — | ledger-line adjust (`stem.cpp` after :236) | — |

### 3.2 Two-note tremolo

| | MuseScore | LilyPond | Verovio |
|---|---|---|---|
| stroke thickness | beam 0.5 (`styledef.cpp:296`) | beam 0.48 (`define-grobs.scm:479`) | beam 1 unit = **0.5** (`doc.cpp:2395`) |
| step | **0.75** (non-wide beams, `tremololayout.cpp:384`) | the beam stride | 0.5 + 0.25 white = **0.75** (`doc.cpp:2395-2396`) |
| end clearance from the stem | **1.0**, shrinking toward a **0.4** floor when the stroke would be under 0.6 long (`tremololayout.cpp:333, 349-352`); 0 for the joined style | Beam `gap` **0.8** for gapped tremolo beams (`define-grobs.scm:529`, `beam.cc:403-426`) | floating bars inset **one beam width = 0.5** (`view_beam.cpp:178, 210`); stemless: **1.0** at one end (`:181`) |
| which bars attach | style setting | `gap-count` | note-value beams attached, the rest floating (`view_beam.cpp`, `fullBars = dur − 4`) |
| stems | one stem extended when the two tips differ by >1 sp (`tremololayout.cpp:318-322`) | — | — |

⚠️ No engine expresses the end clearance as a **fraction of the gap** (our 0.25 / 0.35 ratios).
MuseScore's short-stroke shrink is the only width-dependent rule, and its source comment calls it
*"TODO: This should be a style setting, to replace tremoloStrokeLengthMultiplier"*
(`tremololayout.cpp:332`; `tremoloStrokeLengthMultiplier` 0.62 at `styledef.cpp:749` is otherwise unread).

### 3.3 Tuplets

| | MuseScore | LilyPond | Verovio | VexFlow |
|---|---|---|---|---|
| number face / size | Edwin italic **9 pt**, spatium-dependent (`styledef.cpp:771-776`); at the default spatium 1.75 mm = 4.96 pt (`:797`) that is a **≈1.81 sp em** | text italic, `font-size −2` (`define-grobs.scm:4140-4141`) on 11 pt at a 20 pt staff (`paper.scm:78`) ⇒ **≈1.75 sp em** | SMuFL tuplet digits at **full staff size** (`view_tuplet.cpp:185`) ⇒ Bravura digit **1.53 sp** tall (`data/Bravura.xml:678`, 383 u) | SMuFL digits at fontSize **30** (`metrics.js:63`) ⇒ **1.53 sp** |
| bracket thickness | **0.1** (`styledef.cpp:767`) | 1.6 × line-thickness (`define-grobs.scm:4120`; line-thickness = 0.5 pt = 0.1 sp at 20 pt, `paper.scm:52-66, 84`) = **0.16** | 0.2 unit = **0.1** (`options.cpp:1573`, `view_tuplet.cpp:104-105`) | **1 px = 0.1** (`tuplet.js:196-199`) |
| hook | **0.75** (`styledef.cpp:780`) | edge-height **0.7** (`define-grobs.scm:4111`) | ½ numeral height ≈ **0.77**; 0.6 with no number (`view_tuplet.cpp:121-122, 137`) | **10 px = 1.0** (`tuplet.js:198-199`) |
| gap around the number, per side | **0.35** (`tupletlayout.cpp:588`) | (width + 1.0)/2 ⇒ **0.5**, +0.1 right for the italic (`tuplet-bracket.cc:332, 407`) | unit/2 = **0.25** (`view_tuplet.cpp:116-117`) | **5 px = 0.5** (`tuplet.js:194`) |
| air to the notes | head 0.5 / stem 0.5 (`styledef.cpp:761-762`); autoplace min 0.5 (`:2055`) | `padding` **1.1**, `staff-padding` **0.25** (`define-grobs.scm:4114, 4118`) | `verticalMargin` 2 units = **1.0** (`adjusttupletsyfunctor.cpp:125`); number alone 1.0 (`:173`) | above: min(top line −1.5; stem-up tip −1.0; stem-down head −2.0); below: max(bottom line +2.0; stem-up head +2.0; stem-down tip +1.0) (`tuplet.js:132-165`) |
| horizontal ends | note-left/right **0.0**, stem-left/right **0.5** (`styledef.cpp:763-766`) | `shorten-pair −0.2` ⇒ extends 0.2 (`define-grobs.scm:4116`) | — | **5 px = 0.5** beyond the tie-left/right x (`tuplet.js:186-187`) |
| end-of-duration bracket | padding **0.6** before the next segment (`tupletlayout.cpp:767`); off by default (`styledef.cpp:789`) | `full-length-padding` 1.0 (`tuplet-bracket.cc:217-218`) | — | — |
| number vertical | centred on the bracket line (hook tip − hook height, `tupletlayout.cpp:563`) | on the bracket | centred (`view_tuplet.cpp:202`) | baseline = line + textHeight/2 ∓ **0.2** (`tuplet.js:202`, `metrics.js:216`) |
| ratio-mark note glyph | `tupletMusicalSymbolsScale` 1.0 (`styledef.cpp:775`), `tupletMusicalSymbolSize` 9.0 (`:2160`) — how these combine was not traced | — | — | — |

---

## 4. What this repo draws today

Converted at a 10 px staff space (`models/staffSize.ts:37`). Pixel literals do **not** follow the staff
size, except through a small staff's `scale(k)` group.

**Single-note tremolo**
- **Glyph:** VexFlow `Tremolo` draws N copies of Bravura E220 at fontSize 30 (`metrics.js:63`; `CenteredTremolo.ts:161`). Font facts: vertical thickness **0.5**, width **1.2**, slope **0.207**; bbox `bravuraMetrics.ts:194`.
- **Step:** `Tremolo.spacing` 7 px = **0.70** (`CenteredTremolo.ts:149, 198`).
  - VexFlow's number, not the font's. Bravura's own `tremolo2/3` glyphs step 0.748/0.742.
- **Placement rule:** the stack's ink centre sits at the middle of the usable stem, from the notehead edge to the tip (`CenteredTremolo.ts:219, 233`).
  - The x is the stem's; a stemless note uses the notehead's centre (`:207-209`).
  - ⭐ Decided behaviour, not a number: centring and *"nothing moves unless it has to"* are his rules (`tremolo-plan.md` §4, `VexFlowRenderer.ts` comment at `:1032-1034`).
- **FIT stretch:** the shortfall plus `TREMOLO_STROKE_CLEARANCE` **0.25** at each end (`VexFlowRenderer.ts:1028`).
- **FLAG stretch:** `TREMOLO_FLAG_STEM_STRETCH` **0.25 × stem length** (`:1031`), ≈0.875 sp on a 3.5 sp stem. The strokes do not follow it.
- **Within the stave** (Gould's rule 3): ⛔ not implemented (`CenteredTremolo.ts:35-36`).

**Two-note tremolo**
- **Stroke:** a beam quad, thickness Bravura `beamThickness` **0.5** (`bravuraMetrics.ts:343`, `beamInk.ts:48`, `VexFlowRenderer.ts:1176`).
- **Step:** ×1.5 = **0.75** (`TwoNoteTremolo.ts:52, 142`).
- **End clearance:** min(**1 sp**, **0.25 × gap**), with a floor of the notehead glyph width when the pair is drawn apart with flags (`VexFlowRenderer.ts:1173`), capped at **0.35 × gap** (`TwoNoteTremolo.ts:129-133`). The joined style uses 0.
- **Tip offset:** drawn-value flags × 0.5 × 1.5 = **0.75 per beam level** (`VexFlowRenderer.ts:1226-1227`).
- ⭐ Decided: no stem stretch for a pair (his call, `two-note-tremolo-plan.md` §2, 2026-07-25); joined/open is a user setting on the drawn minim (same §).

**Tuplets**
- **Digits:** `TUPLET_FONT_SIZE` 26 (`ScoreTuplet.ts:20`) gives a digit **1.33 sp** tall (26/30 × 1.532).
- **Ratio-mark note:** `NOTE_GLYPH_SCALE` 0.55 (`:32`) on `metNoteQuarterUp`, which is 3.316 sp tall at full size (`data/Bravura.xml`, ECA5, 829 u), comes to **1.58 sp**.
- **Mark space:** `MARK_SPACE_EM` 0.15 × 26 is added as px (`ScoreTuplet.ts:70`): 3.9 px = **0.39 sp**.
- **Bracket horizontal:** 5 px = **0.5** beyond the tie-left/right x at each end (`:147-148`; mirrored `VexFlowRenderer.ts:3304`).
- **Gap around the number:** 5 px = **0.5** per side (`ScoreTuplet.ts:172-175`).
- **Line:** **1 px = 0.10** (`ScoreTuplet.ts:170, 174-175`); legs 1 px wide.
- **Legs:** 10 px = **1.0** (`:180-181`; mirrored `VexFlowRenderer.ts:3313`).
- **Height:** ⭐ **ours as of S8a** — `engrave/marks/tupletPlacement`, a transcription of VexFlow's `getYPosition()` (§3.3) including the 1.5 sp nesting step (`tuplet.js:19`). ⭐ **U4–U6 below are now this module's preset menu**: the airs are its named `TUPLET_AIR` table, and Gould's two disagreements (U4's stave-line intersection, U5's flush bracket) are written into its header awaiting HIS call.
  - The inner-flip correction reuses VexFlow's per-note terms of 1 and 2 lines (`NoteBuilder.ts:477, 483`).
- **`beforeNext` end:** 6 px = **0.6** (`VexFlowRenderer.ts:3220`).
- **Ghost number:** **1.5 sp** above the tip or head to the baseline (`GhostRenderer.ts:81`).

### 🚨 The bracket-thickness conflict (reported, not resolved)

1. **Drawn:** 1 px. `ScoreTuplet.ts:170` `ctx.fillRect(xPos, yPos, this.width, 1)`, `:174-175` the two halves at height 1, `:180-181` legs 1 wide. The registry records `bracketThickness: 1` (`VexFlowRenderer.ts:3331`). At 10 px/sp that is **0.10 sp**.
2. **Claimed:** `rendering/thinLineWeight.ts:6` and `:23` name `tupletBracketThickness` and *"tuplet brackets"* as members of the one weight. `:84` says *"`THIN_LINE_SPACES` remains the one weight for barlines, ledger lines, octave lines and tuplet brackets"*, and `:60` sets that weight to the font's **0.16 sp**. `docs/staff-line-research.md:390-391` repeats the claim.
3. Nothing in `ScoreTuplet.ts` imports `THIN_LINE_SPACES`. Its importers are `OttavaRenderer.ts`, `barlineSign.ts` and `barlineInk.ts`.
4. **The two families of evidence split the same way:**
   - **0.16:** Bravura `tupletBracketThickness` (`bravuraMetrics.ts:368`) and LilyPond.
   - **0.10:** MuseScore, Verovio and VexFlow.
   - **Staff-line weight** (ratio ≈1.0 on the plates): Gould's plates and Ross's plate. That is ≈0.11 in Gould's absolute terms, and the repo's staff line is 0.11 (`staff-line-research.md` §8 A).
   - **Heavier than a staff line:** Ross's prose.

---

## 5. ⭐ PRESET ROWS

Each table's first row is **today's default**. A row marked *(plate)* is our measurement of an engraving,
with the stated method bias. A row marked *(prose)* states a rule and gives no number.

### T1 — where the single-note stroke stack sits (the RULE)

| preset | rule | citation |
|---|---|---|
| **ours (default)** | ink centre of the stack at the middle of the usable stem (notehead edge → tip) | `CenteredTremolo.ts:219, 233` |
| VexFlow | anchored at the stem tip; first stroke one 0.7 sp step in when ≤3 strokes | `tremolo.js:23` |
| Gould (prose) | 1–2 strokes centre on stave-lines; ≥1 stave-space clear of the notehead; stem extends beyond the outer stroke; strokes stay within the stave | pp. 221–222 |
| Gould (plate) | toward the tip: **0.25–0.56** of stem beyond the outer stroke, **≈1.0** ink air above the notehead (min correct **0.73**); beamed: **0.41** below the beam, **0.64** above the head | pp. 221, 222 |
| Ross (prose) | one stroke through a staff line; more *"for the greatest clarity"* | p. 200 |
| MuseScore | outer end **0.5** inside the tip; flag/beam offsets; clamped to the staff | `styledef.cpp:751`; `tremololayout.cpp:122-153` |
| LilyPond | first stroke one step (0.81) inside the stem end; flag shift (durlog−2) steps | `stem-tremolo.cc:339-346` |
| Verovio | stack centre 1.0 sp (1.5 on a line) + ½ glyph from the note centre | `stem.cpp:227-236` |

### T2 — `TREMOLO_STROKE_CLEARANCE` (air the FIT stretch keeps at each end)

| preset | note side | tip side | citation |
|---|---|---|---|
| **ours** | **0.25** | **0.25** | `CenteredTremolo.ts:65` |
| Gould (prose + plate) | ≥1 stave-space (ink **0.73–1.3**) | stem beyond the outer stroke (ink **0.25–0.56**) | pp. 221–222 |
| MuseScore | **1.25** (from the note) | **0.5** | `styledef.cpp:750-751`; `stemlayout.cpp:427-429` |
| LilyPond | stem ≥ 1 + 2×stack + 1 | (same) | `stem.cc:568, 585` |
| Verovio | 1.0 / 1.5 from the note centre | ≥ **0.25** of stem beyond, in ¼-sp steps | `stem.cpp:176-185, 227-236` |

### T3 — `TREMOLO_FLAG_STEM_STRETCH` (making a flag clear the strokes)

| preset | value | citation |
|---|---|---|
| **ours** | **0.25 × stem length**; the strokes stay put | `CenteredTremolo.ts:55`; `VexFlowRenderer.ts:1031` |
| Gould (prose) | *"extend a stem if necessary"*, no number | p. 222 |
| Gould (plate) | 3 strokes **+0.65–0.75**, 4 strokes **+1.2–1.25** over 3.5 (unflagged quarters; a flagged single note was not measured) | p. 222 |
| MuseScore | strokes pulled **1.5** (up flag) / **1.0** (down) / **0.75** (straight flags) from the tip, **+0.5** with ≥2 beams | `tremololayout.cpp:132-139` |
| LilyPond | stem +2(durlog−1.5)×0.81, **+0.81** on up-stems; strokes shift (durlog−2)×0.81 (+0.405 up) | `stem.cc:577-583`; `stem-tremolo.cc:344-346` |

### T4 — stroke step (single note)

| preset | value | citation |
|---|---|---|
| **ours** | **0.70** | `metrics.js:212`; `CenteredTremolo.ts:198` |
| Gould | the same as beam spacing (prose); **0.74–0.76** (plate) | p. 221; p. 222 |
| Bravura (font) | **0.748 / 0.742** (its own 2- and 3-stroke glyphs) | `bravuraMetrics.ts:195-196` |
| MuseScore | **0.8** | `styledef.cpp:747` |
| LilyPond | **0.81** | `stem-tremolo.cc:124` |

### T5 — stroke thickness (vertical)

| preset | value | citation |
|---|---|---|
| **ours** | **0.5** (Bravura E220) | `data/Bravura/E220.xml` |
| Gould | *"a little thinner than a beam"* (prose); **0.455–0.476** ink = **0.87 ×** her beam (plate); too thick 0.62, too thin 0.23 | p. 221 |
| Ross | *"somewhat thinner than a beam"* | p. 200 |
| MuseScore | **0.5** | `styledef.cpp:746` |
| LilyPond | **0.48** | `define-grobs.scm:3500` |

### T6 — stroke slope

| preset | value | citation |
|---|---|---|
| **ours** | **0.207** (E220) | `data/Bravura/E220.xml` |
| Gould | bottom-left → top-right regardless of stem or beam; *"some editions"* steeper than the steepest beam (prose); **0.22–0.23** (plate) | p. 223; p. 222 |
| MuseScore | **0.417** | `tremolosinglechord.cpp:191` |
| LilyPond | **0.25**; **0.40** on a down-stem with flag | `stem-tremolo.cc:77-78` |

### T7 — stroke width

| preset | value | citation |
|---|---|---|
| **ours** | **1.2** (E220) | `bravuraMetrics.ts:194` |
| Gould | *"the width of a notehead"* (prose); plate ≈**1.17 ×** notehead | p. 221; p. 222 |
| Ross | *"approximately the width of the note head"* | p. 200 |
| MuseScore | **1.2** | `styledef.cpp:744` |
| LilyPond | **1.5**; **1.0** beamed or up-flag | `stem-tremolo.cc:93` |

### T8 — two-note end clearance (`PAIR_STROKE_CLEARANCE_SPACES` / `_RATIO` / `_MAX_CLEARANCE_RATIO`)

| preset | value | citation |
|---|---|---|
| **ours** | min(**1.0**, **0.25 × gap**), max **0.35 × gap** | `TwoNoteTremolo.ts:34-42, 129-133` |
| Gould (prose) | *"just short of each stem"*, equal both sides; widely spaced pairs *"may be uniformly shortened"* | p. 228 |
| Gould (plate) | **0.70–0.86** (crotchets, chords, stem-down minims); **1.0–1.1 / 1.5** (minims, asymmetric) | pp. 226, 228 |
| Ross (prose) | *"should not touch the stems"* | p. 200 |
| MuseScore | **1.0**, shrinking to ≥**0.4** when the stroke would be <0.6 | `tremololayout.cpp:333, 349-352` |
| LilyPond | **0.8** | `define-grobs.scm:529` |
| Verovio | **0.5** (one beam width); stemless **1.0** at one end | `view_beam.cpp:178, 181, 210` |

### T9 — two-note tip offset (strokes start past the note value's beam lines)

| preset | value | citation |
|---|---|---|
| **ours** | **0.75 per beam level** (flags × 0.5 × 1.5) | `VexFlowRenderer.ts:1226-1227` |
| Gould (prose) | *"as if they were joined to the stems. However, the detached beams may move slightly closer to the noteheads"* (amount **UNKNOWN**) | p. 226 |
| MuseScore / Verovio | the same beam stride, **0.75** | `tremololayout.cpp:384`; `doc.cpp:2395-2396` |

### T10 — two-note stroke weight and step

| preset | thickness / step | citation |
|---|---|---|
| **ours** | **0.5 / 0.75** | `bravuraMetrics.ts:343`; `TwoNoteTremolo.ts:52` |
| Gould | *"ordinary beam thickness"* (prose); step **0.74–0.76** (plate) | p. 225; p. 226 |
| MuseScore | **0.5 / 0.75** | `styledef.cpp:296`; `tremololayout.cpp:384` |
| LilyPond | **0.48** / the beam stride | `define-grobs.scm:479` |
| Verovio | **0.5 / 0.75** | `doc.cpp:2395-2396` |

### U1 — tuplet numeral size (`TUPLET_FONT_SIZE`)

Conversion: VexFlow size = 30 × *h* / 1.532, where *h* is the wanted Bravura digit height in sp.

| preset | digit height | size | citation |
|---|---|---|---|
| **ours** | **1.33** | **26** | `ScoreTuplet.ts:20` |
| Ross | **1⅓** (prose); 1.39–1.47 (plate bbox) | 26 | p. 159 |
| Gould | **1½** (prose); 1.56–1.66 (plate bbox) | ≈29.4 | p. 193; pp. 194, 199 |
| VexFlow / Verovio | **1.53** (full staff size) | 30 | `metrics.js:63`; `view_tuplet.cpp:185` |
| G&L | *"larger than a finger number"*; ≈1.21 (plate) | ≈23.7 | p. 156; p. 157 |
| MuseScore | 9 pt Edwin italic ≈ 1.81 sp **em** (digit height UNKNOWN) | — | `styledef.cpp:771-776, 797` |
| LilyPond | italic, font-size −2 ≈ 1.75 sp **em** (digit height UNKNOWN) | — | `define-grobs.scm:4140-4141`; `paper.scm:78` |

### U2 — ratio-mark note glyph scale (`NOTE_GLYPH_SCALE`)

| preset | value | citation |
|---|---|---|
| **ours** | **0.55 ×** figure size ⇒ note **1.58** against digits 1.33 | `ScoreTuplet.ts:32` |
| MuseScore | `tupletMusicalSymbolsScale` 1.0; semantics not traced | `styledef.cpp:775, 2160` |
| books | none found — **UNKNOWN** | — |

### U3 — space between mark runs (`MARK_SPACE_EM`)

| preset | value | citation |
|---|---|---|
| **ours** | **0.15 × 26 = 3.9 px = 0.39** | `ScoreTuplet.ts:38, 70` |
| any source | **UNKNOWN** | — |

### U4 — bracket air to the notes and the staff

| preset | value | citation |
|---|---|---|
| **ours (VexFlow)** | line at stem tip −**1.0** / notehead −**2.0** / top line −**1.5** (above); +**1.0** / +**2.0** / bottom line +**2.0** (below) | `tuplet.js:132-165` |
| Gould (plate) | hook tip **0.50–0.70** clear; line **1.25–1.50** clear; closest to the staff: line **≈0.5** outside it, hooks and numeral edge **0.25–0.30** inside | pp. 194, 199 |
| Gould (prose) | *"Always place the bracket outside the stave. The bracket ends and the edge of a numeral may intersect a stave-line"* | p. 199 |
| MuseScore | **0.5** from head and stem; min distance **0.5** | `styledef.cpp:761-762, 2055` |
| LilyPond | padding **1.1**; staff-padding **0.25** | `define-grobs.scm:4114, 4118` |
| Verovio | **1.0** | `adjusttupletsyfunctor.cpp:125` |

### U5 — bracket horizontal overhang past the noteheads

| preset | value | citation |
|---|---|---|
| **ours (VexFlow)** | **0.5** each end | `ScoreTuplet.ts:147-148` |
| Gould | **0** — first notehead's left edge to the last notehead's right edge; stem not tail; *"some editions … just after the tail"* | p. 195 |
| Ross | **0** — left side of the first note to the right side of the last | p. 161 |
| G&L | **0** — *"flush left … flush right with the notehead"* | p. 156 |
| MuseScore | notes **0.0**; stems **0.5** | `styledef.cpp:763-766` |
| LilyPond | extends **0.2** (`shorten-pair −0.2`) | `define-grobs.scm:4116` |

### U6 — bracket leg (hook)

| preset | value | citation |
|---|---|---|
| **ours** | **1.0** | `ScoreTuplet.ts:180-181` |
| Gould (plate) | **0.85–0.91** (ink incl. line) | pp. 194, 199 |
| Ross (plate) | 0.77–0.97 | p. 161 |
| G&L (prose) | *"the ends are always vertical"*, no length | p. 156 |
| MuseScore | **0.75** | `styledef.cpp:780` |
| LilyPond | **0.7** | `define-grobs.scm:4111` |
| Verovio | ½ numeral height ≈**0.77**; **0.6** without a number | `view_tuplet.cpp:121-122, 137` |

### U7 — bracket thickness (⚠️ see the conflict in §4)

| preset | value | citation |
|---|---|---|
| **ours (drawn)** | **1 px = 0.10** | `ScoreTuplet.ts:170-181` |
| ours (claimed) | 0.16 via `THIN_LINE_SPACES` | `thinLineWeight.ts:60, 84` |
| Gould (plate) | = staff line (ratio ≈1.0; ≈**0.11**) | pp. 194, 199 |
| Ross (prose) | *"as thick as a bar line (somewhat thicker than a staff-line)"* | p. 161 |
| Ross (plate) | = staff line (ratio 1.0) | p. 159 |
| Bravura `tupletBracketThickness` | **0.16** | `bravuraMetrics.ts:368` |
| MuseScore | **0.1** | `styledef.cpp:767` |
| LilyPond | **0.16** | `define-grobs.scm:4120`; `paper.scm:84` |
| Verovio | **0.1** | `options.cpp:1573` |

### U8 — gap between the numeral and the bracket ends

| preset | per side | citation |
|---|---|---|
| **ours** | **0.5** | `ScoreTuplet.ts:172-175` |
| Gould (plate) | **0.45–0.85** (mean ≈0.6); bracket *"broken for the numeral on which it centres vertically"* (centre offset ≤0.07) | p. 194; pp. 194, 199 |
| Ross (plate) | **0.23–0.59** | p. 161 |
| G&L (plate) | **0.44–0.45** | p. 157 |
| MuseScore | **0.35** | `tupletlayout.cpp:588` |
| LilyPond | **0.5** (+0.1 right) | `tuplet-bracket.cc:332, 407` |
| Verovio | **0.25** | `view_tuplet.cpp:116-117` |

### U9 — `BRACKET_END_GAP` (the `beforeNext` end)

| preset | value | citation |
|---|---|---|
| **ours** | **0.6** before the next note | `VexFlowRenderer.ts:3220` |
| MuseScore | **0.6** before the next segment (end-of-duration mode) — same number | `tupletlayout.cpp:767` |
| Gould (prose) | extend to *"the hypothetical final division"*; no gap stated | p. 195 |
| G&L (prose) | *"include the entire allotted space"* | p. 157 |
| Stone (prose) | *"extended to the right to show spatially the group's actual … duration"* | pp. 28–29 |

### U10 — `GHOST_TUPLET_NUMBER_GAP` (preview only)

| preset | value | citation |
|---|---|---|
| **ours** | **1.5** from the tip or head to the baseline | `GhostRenderer.ts:81` |
| Verovio | number alone **1.0** from the notes or beam | `adjusttupletsyfunctor.cpp:173` |
| MuseScore | **0.5** | `styledef.cpp:761-762` |
| Ross | *"two spaces for the '3'"* of vertical room (a spacing chart, not a clearance) | p. 68 |

---

## 6. UNKNOWN — not silent, not found

- **A FLAG stretch as a number or ratio in any book.** Gould says only *"if necessary"* (p. 222). The flagged single-note plate on p. 222 was not measured for stem length.
- **A two-note clearance as a fraction of the gap** (our 0.25 / 0.35). No book and no engine states one.
- **How much *"slightly closer to the noteheads"*** detached two-note beams move (Gould p. 226). The p. 226 figure was not measured against attached beams.
- **Why Gould's minim plates on p. 226 are asymmetric** when p. 228 demands equal distances. Measured, not explained.
- **The size of a ratio-mark note glyph, and the space inside a ratio mark.** No book or engine rule found. MuseScore's `tupletMusicalSymbolsScale` / `tupletMusicalSymbolSize` were not traced to their use.
- **Digit heights for MuseScore (Edwin) and LilyPond's text font.** Only the em is known; the faces were not measured.
- **Stone:** no tremolo or bracket numbers (checked via OCR, pp. 27–29 and 48; not rendered).
- **Gerou & Lusk tremolo plates (pp. 151–153), Ross's p. 200 tremolo plate, and Ross's bracket air.** Not measured.
- **Gould's rule 3 (strokes within the stave)** as geometry. Stated on p. 222; not measured.
- **Two-note beam slope limits** (Gould p. 226: *"slant in the direction of the interval"*). No number stated; the plates were not measured for slope.
- **The Penderecki sign's scale** (`tremolo-plan.md` §4 ⏭️). Not researched.
- **Plate bias.** Bbox extents read ≈+0.05 sp high from anti-aliasing. The weights (integrated ink) do not carry that bias. Ross's and Gerou & Lusk's scans are coarser than Gould's (`staff-line-research.md` §3.4).
