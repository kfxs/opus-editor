# Marks outside the staff: vertical placement and glyph size (research, 2026-09-14)

**This is research, not a decision.** Every number below is a candidate **house-style preset row**. The
number the code runs today stays the default. This document recommends nothing and changes no code.
It is batch 1 of `docs/engraving-number-inventory.md` §6.

⛔ **Out of scope:** the nine glyph ink ratios that a font lookup answers (dynamic 0.68/0.18, trill
0.62/0.04, ottava 0.62/0.04, pedal 0.52/0.18, tempo ♩ 0.75), and the ladder ORDER, which is already
decided and sourced (`docs/above-staff-ladder.md`, `docs/ottava-plan.md` §1 rule 5 + P9).

---

## 0. The question, and the rows covered

The question for each number: **what value does each book and engine give, and what exactly does
that value measure?** The second half matters as much as the first. A "distance from the staff" is
ink-to-staff in one source, baseline-to-staff in another, and a starting offset in a third.

Units. Our glyph sizes are **points** handed to VexFlow. A point draws at 4/3 px
(`rendering/drawnFontSize.ts:43-52`), and our staff space is 10 px. So **1 pt = 0.1333 sp**, and
**1 SMuFL em = 4 sp = 30 pt** here.

| # | row (inventory §2 / §5b) | file:line | today | in sp |
|---|---|---|---|---|
| R1 | `TRILL_LINE.padding` (+ the source conflict) | `rendering/trillStyle.ts:157` | 0.5 | 0.5 sp |
| R2 | `TRILL_LINE.minFromStaff` | `rendering/trillStyle.ts:158` | 1.0 | 1.0 sp |
| R3 | `OTTAVA_LINE.padding` | `rendering/ottavaStyle.ts:167` | 0.5 | 0.5 sp |
| R4 | `OTTAVA_LINE.minFromStaff` | `rendering/ottavaStyle.ts:168` | 1.5 | 1.5 sp |
| R5 | `PEDAL_LINE.padding` | `rendering/pedalStyle.ts:107` | 0.6 | 0.6 sp |
| R6 | `PEDAL_LINE.minFromStaff` | `rendering/pedalStyle.ts:108` | 4.0 | 4.0 sp |
| R7 | `TEMPO_LINE.padding` | `rendering/tempoStyle.ts:106` | 0.8 | 0.8 sp |
| R8 | `TEMPO_LINE.minFromStaff` | `rendering/tempoStyle.ts:108` | 3.0 | 3.0 sp |
| R9 | `TRILL_GLYPH_SIZE` (`tr`) | `rendering/trillStyle.ts:112` | 26 pt | em 3.47 sp (0.867 SMuFL em) |
| R10 | `OTTAVA_GLYPH_SIZE` (`8va`/`8ba`) | `rendering/ottavaStyle.ts:102` | 26 pt | em 3.47 sp (0.867 em) |
| R11 | `PEDAL_GLYPH_SIZE` (`Ped.`) | `rendering/pedalStyle.ts:61` | 26 pt | em 3.47 sp (0.867 em) |
| R12 | `DYNAMIC_GLYPH_SIZE` (p/f/mf) | `rendering/dynamicStyle.ts:13` | 30 pt | em 4.0 sp (1.0 em) |
| R13 | `TEMPO_GLYPH_FONT_SIZE` (metronome ♩) | `rendering/tempoStyle.ts:38` | 20 pt | em 2.67 sp (0.667 em) |
| R14 | `TRILL_PAREN_SCALE` / `OTTAVA_PAREN_SCALE` | `trillStyle.ts:100` / `ottavaStyle.ts:88` | 0.52 × sign pt | 13.5 pt serif italic, em 1.80 sp |
| R15 | `TRILL_PAREN_RAISE` / `OTTAVA_PAREN_RAISE` | `trillStyle.ts:109` / `ottavaStyle.ts:97` | 0.22 | **0.30 sp as coded** (see §4.3) |
| R16 | `TEMPO_INK_BELOW` (text descender) | `rendering/tempoStyle.ts:78` | 0.22 × 18 pt drawn | 0.53 sp |
| R17 | co-located dynamics row `GAP` (`p dolce`) | `rendering/DynamicsLayout.ts:154` | 6 px @10 | 0.6 sp |

Covering docs, cited and not repeated: `docs/above-staff-ladder.md` (the mechanisms, and the pt-vs-px
fix), `docs/ottava-plan.md` §1 + §"HIS EYE, 2026-08-13" + §8 P0b, `docs/pedal-plan.md` §12,
`docs/trill-plan.md` §1 rule 8 + §10 P2, `docs/tempo-marks-research.md` §3, and `reference/README.md`.
The README's Q&A tables hold the ladder measurements from Gould pp. 29, 102, 135, 138 and 337.

---

## 1. Sources, and how to reach each page again

### Books (all in `reference/`, gitignored)

| book | offset | pages used here |
|---|---|---|
| **Gould, *Behind Bars*** | PDF = printed + 20 | p. 28 (PDF 48), p. 29 (49), p. 101 (121), pp. 182–183 (202–203), p. 333 (353), p. 335 (355) |
| **Ross, *Art of Music Engraving*** | PDF = printed + 12 | p. 197 (PDF 209), p. 201 (213), p. 203 (215), p. A-8 (PDF 230), p. A-46 (268) |
| **Gerou & Lusk** | 2-up PDF | pp. 98–99 = PDF 51 · pp. 104–105 = PDF 54 · pp. 142–143 = PDF 73 · pp. 152–153 = PDF 78 |
| **Stone** | 2-up PDF | text layer grepped only; nothing on these sizes or distances (see §6) |

How the pages were found: grep the `.txt` layer to locate the page, render it with
`pdftoppm -f N -l N -r 450 -png`, and read the PNG. Every quote below was checked against the
rendered scan, not the OCR.

How the plates were measured: the page was rendered at **450 dpi**, and PIL gave per-row ink
profiles, masking the staff-line rows. The staff space was measured per plate:

- Gould: 19.75–20.25 px per staff space.
- Ross: 25.4 px on p. 203 and 25 px on p. 197.
- Gerou & Lusk: 23.3–37.5 px, because their figure staves vary in size.

⚠️ The reader inflates every ink box by about 1 px per side (`reference_the_browser_ink_reader_inflates_every_box`
applies to any threshold reader). So at 20 px/sp, heights read about **0.1 sp large** and gaps about
0.1 sp small. The numbers below are raw.

### Engines (`~/dev/engine-sources`, plus `node_modules/vexflow`)

- **MuseScore** style defaults are in `src/engraving/style/styledef.cpp`, in spatium.
  - `spatium` = 1.75 mm (`styledef.cpp:797`), so **1 pt = 0.2016 sp**.
  - A SMuFL symbol at "standard size" is **4 sp** (`style/styledef.h:2319`).
- **LilyPond** grob defaults are in `scm/define-grobs.scm`, in staff spaces.
  - Text size is `staff-height/20 × 11` pt (`scm/paper.scm:78`), which is an **em of 2.2 sp**.
- **Verovio**'s unit is **half a staff space** (`src/options.cpp:1202`).
  - The music font is 8 units, an **em of 4 sp** (`src/doc.cpp:2420`).
  - Text uses `lyricSize` 4.5 units, an **em of 2.25 sp** (`doc.cpp:2400`, `options.cpp:1404`).
- **VexFlow** draws at a 10 px staff space.
  - A bare font size is in pt, and 30 pt is one SMuFL em.
  - Text y positions come from `stave.js:208-213`: `topTextPosition` 1 and `bottomTextPosition` =
    `numLines` (`stave.js:51,73`).

---

## 2. Books

### 2.1 What they state (verbatim from the scans)

**Octave sign.**
- **Gould p. 28:** *"The octave sign is written in italic, the numeral '8' is 1½ stave-spaces high.
  The optional 'va' is placed flush with the top of ottava sopra (8va), flush with the base of ottava
  bassa (8va)."*
- Gould p. 28, on the line: *"The line extends from the top edge of the 8 for 8 sopra and the base of
  the 8 for 8 bassa, and runs parallel to the stave."*
- Gould p. 29: *"Usually the octave sign will be outside all other notation. It must never cut through
  other symbols."* The whole-system exception is already in `reference/README.md`.
- **Ross p. 203:** *"This symbol is always in italic type, the 8 being approximately 1½ spaces in
  height with the va about ½ of that height, parallel with the top or bottom half of the 8. This symbol
  is always placed above the staff, high enough that the broken line following will not interfere with
  any notes in the passage."* On the bassa form: *"the word bassa matches the size of the 8."*
- **Gerou & Lusk p. 98:** *"The 8va or 8va bassa with its extender line should be clearly placed, to
  avoid conflict with as many musical elements as possible and yet be as close to the notes affected
  as possible."* No size is given.

**Dynamics.**
- **Gould p. 101:** *"Relative to the stave, the f is 2½ stave-spaces high, the p is 2 spaces. The m
  (as in mezzo), s and z (as in sf and fz) are the height of a stave-space. Other wording for dynamics
  such as cresc., dim., sempre, is the same size and should use lower-case italic but never a bold
  typeface."*
- **Ross p. 186** gives the same three heights (quoted in `reference/README.md`).

**Trill.**
- **Ross p. 197:** *"The trill sign is slightly less than two spaces high and is placed above the
  staff for single notes regardless of stem direction."*
- Gould p. 135 gives design and rung only: *"a stylized sign in bold italic … further from the note
  than any articulation marks"*. No size.
- Gerou & Lusk p. 153 gives placement only: *"The tr is always placed above the note, regardless of
  stem direction."*

**Pedal.**
- **Ross p. 201:** *"The abbreviation Ped. is placed beneath the lower staff vertically aligned with
  the note it affects. … The mark is approximately 2 spaces high and aligned horizontally."* This is
  said of the traditional `℘ed.` sign.
- **Gould p. 333:** *"Separate, short pedal markings for the same pedal should be brought in as close
  as possible to the lowest stave so that they are not overlooked. … the main consideration should be
  that no sign is too far below the stave – or it may go unnoticed."*
- **Gould p. 335:** *"to show very precise alignment, an ordinary roman typeface is recommended for
  the damper pedal symbol."* ⚠️ So Gould's own `Ped.` is roman TEXT, not the SMuFL glyph.

**Tempo.**
- **Gould p. 182:** *"Tempo indications are printed in bold roman type and are usually larger than
  other text so as to be very conspicuous."*
- Gould p. 182, on placing: *"Place all tempo indications above the uppermost stave, and above all
  other performance instructions. They should be well clear of slurs, octave signs and articulation."*
- **Ross p. A-8:** *"The tempo marking is put slightly above the top staff."*
- **Gerou & Lusk p. 142:** *"The type is bold Roman."*
- **Gerou & Lusk p. 143**, on metronome marks: *"The type is slightly smaller than that of the tempo
  and is usually enclosed in parentheses. The note is cue size or smaller."*
- Gerou & Lusk p. 104 defines cue size: *"The passage is cue size (65–75%)."*

### 2.2 What they drew: measured plates, new today

Notation used in the table:
- **Above/below** means staff spaces from the staff's near line, to the edge of the ink named.
- **Gap** means clear vertical space between two inks in the same x-window.
- ⚠️ Every one of these plates has music *under or over* the mark. Only the rows marked **floor**
  show a mark where the staff itself is the nearest ink.

| plate | what was measured | value |
|---|---|---|
| **Gould p. 28**, treble `8` over a note above the staff | `8` ink height (line joins its top) | **1.77 sp** raw (≈1.65 after inflation) |
| | `8` bottom → top line / gap to the notehead under it | 2.15 sp above · **gap 0.61 sp** |
| | dashed line | 3.87 sp above (= top of the 8) |
| **Gould p. 28**, bass `8` under a ledger chord | `8` ink height | **1.72 sp** raw |
| | gap from the sharps' ink to the top of the `8` | **0.85 sp** |
| | dashed line (= base of the 8) | 5.3 sp below |
| **Gould p. 29**, "preferable" 8va | `8` ink height | 1.75 sp raw |
| | dashed line → topmost accent under the bracket | **gap 1.2 sp** (line 8.78, accent top 7.58 sp above) |
| **Gould p. 29**, bar 1 short `8` / bar 2 long `8` | numeral ink | 3.33–5.03 / 7.38–9.03 sp above (heights 1.70–1.75) |
| **Gould p. 29**, `f p sub.` (horizontal) | `p` ink → `s` ink | **0.55 sp** |
| **Gould p. 183**, ex. 1 `Allegro` over an accent | cap top / baseline / `g` descender, above the top line | 5.38 / **3.37** / 2.82 sp |
| | cap height · descender depth | **2.0 sp** raw · **0.55 sp** |
| | descender → accent top · baseline → accent top | **gap 1.21 sp** · 1.76 sp |
| | `= 100` over bar 3 (nothing above that staff; same row) | digits bottom 3.42 sp above, height 1.71 sp |
| **Gould p. 183**, ex. 2 `accel.` / `Presto` over a high note | baseline / ascender top | **4.52** / 6.49 sp above |
| | baseline → note top under `Presto` | gap 2.67 sp |
| **Gould p. 333**, roman `Ped.` under the bass staff | cap top / baseline, below the bottom line | **3.92 / 5.62 sp** · height 1.70 raw |
| | gap to the note ink over it (G, 0.47 sp below) | 3.45 sp |
| **Gould p. 335**, roman `Ped.` under two-ledger notes and a slur | cap top / baseline | **5.98 / 7.68 sp** · height 1.75 raw |
| | gap to the slur ink over it · to the lowest note | **0.95 sp** · 2.95 sp |
| **Ross p. 203**, `8va` over a ledger note | `8` height · `va` height | **1.26 sp** · 0.91 sp |
| | `8` bottom → note top · line → whole note's top | **gap 1.69 sp** · 1.06 sp |
| **Ross p. 197**, `tr` over a note in the top space | `tr` ink height | **1.55–1.59 sp** |
| | `tr` bottom above the top line (**floor**) | **0.63 sp** (over a whole note in the same space: 1.31) |
| **Gerou & Lusk p. 153**, `tr` over a note on the top line | `tr` height · gap to the notehead | 1.58 sp · **0.75 sp** |
| **Gerou & Lusk p. 153**, `tr` over a stem that reaches the top line | `tr` bottom above the top line (**floor**) | **0.63 sp** |
| **Gerou & Lusk p. 98**, 8va over a slur | `8` height | 1.36 sp |
| | line → slur apex · line → top note | **gap 0.43 sp** · 1.86 sp |
| **Gerou & Lusk p. 98**, 8va bassa | `8` height | 1.31 sp |
| | lowest note ink → dashed line | **gap 1.24 sp** (line at 3.62 sp below) |
| **Gerou & Lusk p. 99**, `(8va)` courtesy | paren ink height vs `8` height | **1.60–1.63 sp vs 1.39 sp** (ratio 1.15) |
| | paren top vs `8` top · paren bottom vs `8` bottom | +0.08 sp higher · **0.29 sp lower** |
| **Gerou & Lusk p. 142**, `Allegro` over a grand staff, nothing above the staff | ink bottom (`g`) / cap top, above the top line (**floor**) | **1.85 / 3.65 sp** (baseline not separated) |

Already measured by earlier work, cited from `reference/README.md` and not re-measured:
- Gould p. 102: 8vb line 4.0 sp below the staff, with the dynamic ink from ≈5.5 sp.
- Gould p. 337: `8` bracket / `Ped.` line / `Sost. Ped.` line at 3.25 / 7.25 / 10.5 sp below.
- Gould p. 135, double trills:
  - above: accent 4.0–4.5, trill line 5.9–6.4 sp;
  - below, note 1: accent 3.79–4.90, wavy 6.16–6.71 sp;
  - below, note 2: tenuto 2.29–3.49, wavy 4.15–4.70 sp.
- Gould p. 138 (d): `tr` 3.0–4.1 sp and wavy line 2.9–3.3 sp above a slur (apex 2.46).

---

## 3. Engines

### 3.1 Clearance and placement

| engine | family | value | what it measures | file:line |
|---|---|---|---|---|
| LilyPond | TrillSpanner | `padding` 0.5 · `staff-padding` 1.0 | padding = *"extra space between objects that are next to each other"* (`define-grob-properties.scm:935`), against skylines · staff-padding = *"space between **reference points** and the staff"* (`define-grob-properties.scm:1251-1254`; code `lily/side-position-interface.cc:403,434-451`) | `define-grobs.scm:4087,4089` |
| LilyPond | OttavaBracket | `padding` 0.5 · `staff-padding` 2.0 | same | `define-grobs.scm:2720,2722` |
| LilyPond | SustainPedalLineSpanner | `padding` 1.2 · `staff-padding` 1.2 · `minimum-space` 1.0 | same, plus minimum-space = *"Minimum distance that the victim should move (after padding)"* (`define-grob-properties.scm:791`) | `define-grobs.scm:3605,3607,3603` |
| LilyPond | MetronomeMark | `padding` 0.8 · **no** staff-padding | same | `define-grobs.scm:2348` (entry 2336–2352) |
| MuseScore | trill | `trillPosAbove` −0.5 · `trillMinDistance` 0.5 | pos = the default **offset** from the staff edge before autoplace · minDistance = shape-to-skyline clearance (`rendering/score/autoplace.cpp:75,100-104`). The skyline includes the staff lines (`systemlayout.cpp:1680-1681`), so this is ink-shape to music-or-staff | `styledef.cpp:392,2051` |
| MuseScore | ottava | `ottavaPosAbove` −2.0 / `PosBelow` +2.0 · `ottavaMinDistance` 0.7 | same; text aligned TOP above, BASELINE below (`styledef.cpp:732-733`); a below segment starts at the staff height (`tlayout.cpp:5930-5931`) | `styledef.cpp:716-717,2045` |
| MuseScore | pedal | `pedalPosBelow` +2.5 · `pedalMinDistance` 0.7 | same; text BASELINE (`styledef.cpp:374`) | `styledef.cpp:361,2047` |
| MuseScore | tempo | `tempoPosAbove` −2.0 · `tempoMinDistance` 0.5 | same; text BASELINE (`styledef.cpp:1215`) | `styledef.cpp:1218,1220` |
| MuseScore | dynamics / expression | `dynamicsPosBelow` 2.0, `PosAbove` −1.0, `dynamicsMinDistance` 0.5 · `expressionMinDistance` 0.5 | same | `styledef.cpp:809-810,814,1206` |
| Verovio | all floating marks | `defaultTopMargin` / `defaultBottomMargin` 0.5 unit = **0.25 sp** | the gap between **stacked groups of floating objects** (`adjustfloatingpositionerfunctor.cpp:415-423`) — ⚠️ not a clearance from the music | `options.cpp:1661,1673`; `doc.cpp:2221-2234` |
| Verovio | octave (below) | `bottomMarginOctave` 1.0 unit = **0.5 sp** | same | `options.cpp:1687`; `doc.cpp:2225` |
| Verovio | dynam | `dynamDist` 1.0 vu = **0.5 sp** | minimum staff distance (`floatingobject.cpp:477`) | `options.cpp:1281`; `doc.cpp:2254-2271` |
| Verovio | tempo | `@tempo.dist` from the MEI only, **no default** | minimum staff distance | `doc.cpp:2292-2303` |
| VexFlow | StaveTempo | baseline **2 sp above** the top line | a fixed baseline (`getYForTopText(1)`) | `stavetempo.js:59`; `stave.js:208-209` |
| VexFlow | TextBracket (8va) | baseline 2 sp above / **3 sp below** the bottom line | fixed baseline (`TEXT_HEIGHT_OFFSET_HACK` = 1, `tables.js:648`) | `textbracket.js:77,80` |
| VexFlow | PedalMarking | baseline **4 sp below** the bottom line | fixed (`getYForBottomText(line+3)`) | `pedalmarking.js:70` |
| VexFlow | TextDynamics | line −3 = 3 sp above the top line | fixed | `textdynamics.js:48` |

### 3.2 Glyph and text sizes

| engine | mark | size | em in sp | file:line |
|---|---|---|---|---|
| MuseScore | `tr` (trill line's `ornamentTrill`) | the symbol at the score's magnification | 4 sp (standard) | `tlayout.cpp:6512` |
| MuseScore | `8va` sym inside ottava text | `DEFAULT_SMUFL_POINT_SIZE` × `ottavaMusicalSymbolsScale` 1.0 | **4 sp** | `textbase.cpp:885-889,3403-3411`; `styledef.cpp:690,729` |
| MuseScore | `Ped.` sym inside pedal text | same, `pedalMusicalSymbolsScale` 1.0 | **4 sp** | `styledef.cpp:371,382` |
| MuseScore | dynamics | `dynamicsSize` 1.0 × standard | **4 sp** | `styledef.cpp:807`; `textbase.cpp:885-889` |
| MuseScore | tempo text · metronome sym | `tempoFontSize` 12 pt bold · `tempoMusicalSymbolSize` 20 pt | **2.42 sp · 4.03 sp** (ratio 1.67) | `styledef.cpp:1210,1213,2156` |
| MuseScore | expression text | `expressionFontSize` 10 pt italic | 2.02 sp | `styledef.cpp:1190` |
| LilyPond | `tr` | `\musicglyph "scripts.trill"`, font-size 0 | natural music-font size (Emmentaler, not SMuFL) | `define-grobs.scm` TrillSpanner `bound-details` (entry 4057–) |
| LilyPond | ottava | TEXT `"8"` in bold italic, font-size 0 | **2.2 sp** text em | `define-grobs.scm:2716-2717`; `translation-functions.scm:1145-1153` |
| LilyPond | `Ped.` | feta glyph `pedal.Ped` at font-size 0 | natural | `lily/sustain-pedal.cc:62-68` |
| LilyPond | metronome | text at font-size 0; the note is `make-smaller-markup` (font-size −1) | text 2.2 sp; note one step under natural | `translation-functions.scm:118-124`; `define-markup-commands.scm:3636-3639` |
| Verovio | `8va` numeral · parens | SMuFL glyphs, music font | **4 sp** | `view_control.cpp:866,874-880` |
| Verovio | dynamic symbols | music font | **4 sp** | `view_control.cpp:1919` |
| Verovio | `Ped.` · `tr` | music font | **4 sp** | `view_control.cpp:2578,2859` |
| Verovio | tempo text | `lyricSize` | 2.25 sp | `view_control.cpp:2779-2781` |
| Verovio | a SMuFL glyph inside text | text size × music/lyric ratio = the music size | 4 sp | `view_text.cpp:125` (the dynam path; ⚠️ tempo sharing it is unverified) |
| VexFlow | StaveTempo text · glyph | 14 pt · 25 pt | 1.87 · **3.33 sp** (ratio 1.79) | `metrics.js:152-159` |
| VexFlow | TextBracket text | 15 pt italic; superscript × 0.714286 | 2.0 sp | `metrics.js:202-205`; `textbracket.js:36` |
| VexFlow | root font size | 30 pt | 4 sp | `metrics.js:63` (⚠️ that Ornament and TextDynamics read it is unverified) |

### 3.3 Paren glyphs and the dynamic + word gap

- **MuseScore, pedal continuation:** `keyboardPedalParensLeft` + `Ped` + `keyboardPedalParensRight`,
  all one symbol run at the same scale. So the scale is **1.0**, the raise is **0**, and the font's
  design does the alignment (`styledef.cpp:384-385`).
- **MuseScore, ottava continuation:** the bare symbol, with **no parens** (`styledef.cpp:691`).
- **MuseScore, trill continuation:** the middle segment draws no sign (`tlayout.cpp:6512-6515`).
- **Verovio, octave continuation:** `octaveParensLeft` / `Right` at the numeral's own size and its own
  y. Scale **1.0**, raise **0** (`view_control.cpp:874-880`).
- **Verovio, trill:** enclosing glyphs at the trill's size, drawn at `y + trillHeight/2`
  (`view_control.cpp:2862-2863`).
- **MuseScore, an expression snapped to a dynamic:** *"We are essentially faking the kerning behaviour
  of dynamic VS expression text"*. The distance is `(endsWith f ? 0.2 : 0.5) × spatium × 0.5 ×
  (symbolScale + size/10)`, which is **0.5 sp** at defaults and **0.2 sp** after an `f`
  (`dom/expression.cpp:78-84`).

---

## 4. What this repo draws today

### 4.1 What the numbers measure

`layout/inkBand.ts:149-161`, `clearanceBaseline`, defines both clearance numbers:

- `padding` is **INK↔INK**: from the music's or an already-placed family's nearest ink, to the mark's
  ink.
- `minFromStaff` is **STAFF→INK**: from the staff's near line to the mark's nearest ink.
- The mark's ink comes from the out-of-scope ratios (`MarkInk`).

Consequences for comparing sources:
- MuseScore's `minDistance` is one skyline clearance that covers both of ours at once.
- LilyPond's `staff-padding` goes to a **reference point**, not ink.
- MuseScore's `pos*` and VexFlow's `getYFor*Text` are **starting offsets or baselines**.

Glyph sizes are `setFont` points (`drawnFontSize.ts:23-29`). The sign and its wiggle both draw at
26 pt: `TrillRenderer.ts:918-919` passes `TRILL_GLYPH_SIZE/10` sp → 26 px, which reaches
`measureGlyph` as `sizePt` 26.

### 4.2 Already decided by him (pointers only)

- `TRILL_PAREN_SCALE` 0.52 is **his eye**: *"0.85 definitely too big, 0.62 still a tiny big"*
  (`trillStyle.ts:96-100`; inventory §3).
- Italic TEXT parens for the ottava are **his call** (`docs/ottava-plan.md` §"HIS EYE, 2026-08-13"
  item 3).
- The `8va`/`8ba` glyphs are his (item 1), and so is `OTTAVA_LINE_RAISE_*` (item 4).
- The tempo words at 18 pt were set after his *"too small"* report (`tempoStyle.ts:53-55`).
  `TEMPO_TEXT_FONT_SIZE` is an S row; it appears here only as the ♩'s reference.
- Still **owed to his eye**:
  - `TRILL_LINE` (`docs/trill-plan.md` §10 P2);
  - `OTTAVA_LINE`, the ottava paren scale/raise and the glyph size (ottava-plan "still open");
  - `PEDAL_LINE` and the pedal glyph size (`docs/pedal-plan.md` §12.1–3);
  - `TEMPO_LINE` (ottava-plan §8 P0b).

### 4.3 Where a code comment disagrees with what was found

1. **`TRILL_LINE.padding`: the source conflict** (inventory §5b).
   - `trillStyle.ts:140-141` says the pair is *"LilyPond's `TrillSpanner` defaults"*.
   - `ottavaStyle.ts:164` says the trill's 0.5/1.0 *"were tuned by looking"*.
   - **The values ARE LilyPond's**: `padding` 0.5 at `define-grobs.scm:4087`, `staff-padding` 1.0 at
     `:4089`. `docs/trill-plan.md` §1 rule 8 took them as starting numbers. So the ottava comment is
     wrong about the origin.
   - ⚠️ **But the quantity differs.** LilyPond's `staff-padding` runs staff → reference point, while
     our `minFromStaff` runs staff → ink. `inkBand.ts:85-86` equates them (*"LilyPond's `staff-padding`
     / `minimum-space`"*).
   - For a glyph that sits on its baseline the two nearly coincide: Bravura `ornamentTrill` descends
     0.04 sp at 1 em (`fonts/bravuraMetrics.ts:188`). How far feta's `scripts.trill` descends is UNKNOWN.
   - Verdict: **sourced value, re-interpreted quantity, never checked by eye.**
2. **The paren RAISE is not "a fraction of their own size".**
   - The comments say it is (`trillStyle.ts:103`, `ottavaStyle.ts:91`).
   - The code computes `parenY = y - size * RAISE`, with `size` in **points** and `y` in **px**
     (`TrillRenderer.ts:893-894`, `OttavaRenderer.ts:682-683`).
   - The raise is therefore 0.22 × 13.52 = **2.97 px = 0.30 sp**, i.e. 0.165 of the drawn size. The
     comment's reading would be 0.40 sp.
   - This is the same pt-vs-px class that `drawnFontSize.ts` fixed for the ink tables.
3. **"px" in the glyph-size comments.**
   - `trillStyle.ts:111`, `ottavaStyle.ts:99` and `pedalStyle.ts:53` call the 26 a px value. It is pt,
     drawn at 34.7 px, an em of 3.47 sp.
   - `pedalStyle.ts:56-58` and `docs/pedal-plan.md` §12 item 3 say *"at `STAFF_SPACE_PX` = 10 this is
     2.6"* against *"the 2.02–2.42 sp band"*. Both halves are off:
     - after the unit fix, 26 pt is **3.47 sp**;
     - that band is MuseScore's and LilyPond's **text** em (`reference_engraving_text_sizes`), not a
       music-glyph size. Every engine that draws `Ped.` as a SMuFL glyph draws it at a **4 sp** em
       (§3.2).
4. **`ottavaStyle.ts:100-101`** says Gould's numeral-height page is *"unread … a first cut, not her
   number"*. It is now read: **p. 28, "1½ stave-spaces high"**, and Ross p. 203 says the same.
5. **`DynamicsLayout.ts:152`** says *"0.6 staff-spaces of INK"*, but the row spaces the SVG groups'
   `getBBox()` boxes (`DynamicsLayout.ts:159-163`). Whether that box equals the ink horizontally is
   **UNVERIFIED**. `dynamicStyle.ts:42-48` records that VexFlow's pointer-rect inflates it vertically.
6. **`tempoStyle.ts:24-27`** says *"Printed metronome marks size the note to roughly the word's own
   height"*, with no source.
   - What was found instead: Gerou & Lusk p. 143, *"The note is cue size or smaller"*.
   - The engines are far larger relative to the words: MuseScore 1.67× (`styledef.cpp:1210,2156`),
     VexFlow 1.79× (`metrics.js:152-159`). Ours is 1.11×.

---

## 5. ⭐ PRESET ROWS

Quantity tags. ⚠️ **Two rows with different tags are not interchangeable without a conversion.**

| tag | meaning |
|---|---|
| **I↔I** | clear gap, the mark's ink to the nearest other ink |
| **S→I** | staff near line → the mark's nearest ink |
| **S→B** | staff near line → the mark's baseline or reference point |
| **SKY** | MuseScore shape-to-skyline minimum (the staff lines are in the skyline) |
| **OFF** | a default starting offset, pushed further by collision avoidance |
| **STK** | a gap between stacked outside-staff objects only |
| **EM** | font em |
| **INK-H** | the glyph's ink height |

**Bravura-equivalent pt** converts a book's ink height through Bravura's own box
(`fonts/bravuraMetrics.ts:169-191`, heights at 1 em: `tr` 1.60, `8va` 1.892, `Ped.` 2.252, `f` 2.384,
`p` 1.664 sp). It is marked **DERIVED**, and a different font changes it.

### R1 `TRILL_LINE.padding` (today 0.5)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.5 sp | I↔I | `trillStyle.ts:157`; `inkBand.ts:156` |
| LilyPond | 0.5 sp | padding vs skyline (≈I↔I) | `define-grobs.scm:4087` |
| MuseScore | 0.5 sp | SKY | `styledef.cpp:2051` |
| Verovio | 0.25 sp | STK only | `options.cpp:1673` |
| Gerou & Lusk | **0.75 sp** measured (`tr` over a note on the top line) | I↔I | p. 153 |
| Gould | 0.66 / 1.26 sp measured (wavy line outside tenuto / accent, below the staff); ≈1.4 above | I↔I (the **line**, not the sign) | p. 135, via `reference/README.md` |
| Gould | ≈0.55–1.35 sp measured (sign and line outside a short slur) | I↔I | p. 138 (d), via `reference/README.md` |
| Ross | UNKNOWN (no trill over ledger music) | — | p. 197 |

### R2 `TRILL_LINE.minFromStaff` (today 1.0)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 1.0 sp | S→I | `trillStyle.ts:158`; `inkBand.ts:157` |
| LilyPond | 1.0 sp | ⚠️ S→B (reference point) | `define-grobs.scm:4089`; `side-position-interface.cc:403` |
| MuseScore | −0.5 sp start + 0.5 sp minimum | OFF + SKY (effective floor 0.5 S→I) | `styledef.cpp:392,2051` |
| Ross | **0.63 sp** measured (1.31 over a whole note in the same space) | S→I, floor | p. 197 |
| Gerou & Lusk | **0.63 sp** measured | S→I, floor | p. 153 |
| Verovio · VexFlow · Gould | UNKNOWN (no trill staff distance; `ornament.js:145` not reduced to sp; no staff-resident Gould plate) | — | §6 |

### R3 `OTTAVA_LINE.padding` (today 0.5)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.5 sp | I↔I | `ottavaStyle.ts:167` |
| LilyPond | 0.5 sp | padding vs skyline | `define-grobs.scm:2720` |
| MuseScore | 0.7 sp | SKY | `styledef.cpp:2045` |
| Verovio | 0.25 sp above / 0.5 sp below | STK only | `options.cpp:1673,1687` |
| Gould | **0.61 sp** (numeral → notehead) · 0.85 sp (sharps → numeral, bassa) · **1.2 sp** (line → accent) | I↔I | pp. 28, 29 |
| Ross | **1.69 sp** (numeral → note) · 1.06 sp (line → whole note) | I↔I | p. 203 |
| Gerou & Lusk | **0.43 sp** (line → slur apex) · 1.86 (line → note) · 1.24 (note → bassa line) | I↔I | p. 98 |

⚠️ Context, not an ottava padding: the 1.5 sp from the 8vb line to the dynamic on Gould p. 102 is the
*dynamics'* clearance beyond the bracket.

### R4 `OTTAVA_LINE.minFromStaff` (today 1.5)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 1.5 sp | S→I | `ottavaStyle.ts:168` |
| LilyPond | 2.0 sp | ⚠️ S→B | `define-grobs.scm:2722` |
| MuseScore | −2.0 above / +2.0 below start + 0.7 minimum | OFF (text TOP-aligned above, BASELINE below) + SKY | `styledef.cpp:716-717,732-733,2045` |
| VexFlow | 2 sp above / 3 sp below | S→B (fixed) | `textbracket.js:77,80` |
| Books | UNKNOWN as a floor. Every plate measured has ledger music under the bracket (Gould pp. 28, 29, 102, 337; Ross p. 203; G&L pp. 98–99), so the positions measure padding, not the floor | — | §2.2 |
| Verovio | UNKNOWN (octave is not in `GetStaffDistance`, `doc.cpp:2241-2303`) | — | — |

### R5 `PEDAL_LINE.padding` (today 0.6)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.6 sp | I↔I | `pedalStyle.ts:107` |
| LilyPond | 1.2 sp (+ `minimum-space` 1.0) | padding vs skyline | `define-grobs.scm:3605,3603` |
| MuseScore | 0.7 sp | SKY | `styledef.cpp:2047` |
| Verovio | 0.25 sp | STK only | `options.cpp:1661` |
| Gould | **0.95 sp** (slur ink → roman `Ped.`) · 2.95 sp (lowest note → `Ped.`) | I↔I | p. 335 |
| Gould | 3.45 sp (note → `Ped.`, in a levelled pedal row) | I↔I | p. 333 |
| Ross · Gerou & Lusk | UNKNOWN (no measurable `Ped.`-under-music plate) | — | §6 |

### R6 `PEDAL_LINE.minFromStaff` (today 4.0)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 4.0 sp | S→I | `pedalStyle.ts:108` |
| LilyPond | 1.2 sp | ⚠️ S→B | `define-grobs.scm:3607` |
| MuseScore | +2.5 sp start + 0.7 minimum | OFF (BASELINE) + SKY | `styledef.cpp:361,374,2047` |
| VexFlow | 4 sp | S→B (fixed) | `pedalmarking.js:70` |
| Gould | cap top **3.92** / baseline 5.62 (p. 333) · cap top **5.98** / baseline 7.68 (p. 335) · line 7.25 under an `8` (p. 337) | S→I positions over music, not floors | §2.2; `reference/README.md` |
| Gould (prose) | *"as close as possible to the lowest stave"* — no number | — | p. 333 |
| Verovio | UNKNOWN | — | — |

### R7 `TEMPO_LINE.padding` (today 0.8)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.8 sp | I↔I | `tempoStyle.ts:106` |
| LilyPond | 0.8 sp | padding vs skyline | `define-grobs.scm:2348` |
| MuseScore | 0.5 sp | SKY | `styledef.cpp:1220` |
| Verovio | 0.25 sp | STK only | `options.cpp:1673` |
| Gould | **1.21 sp** (`g` descender → accent) · 1.76 sp (baseline → accent) · 2.67 sp (baseline → high note) | I↔I (the first); baseline-based (the others) | p. 183 |
| Gould (prose) | *"well clear of slurs, octave signs and articulation"* | — | p. 182 |

### R8 `TEMPO_LINE.minFromStaff` (today 3.0)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 3.0 sp | S→I | `tempoStyle.ts:108` |
| MuseScore | −2.0 sp start + 0.5 minimum | OFF (BASELINE) + SKY | `styledef.cpp:1218,1215,1220` |
| VexFlow (the repo's pre-P0b constant) | 2 sp | S→B | `stavetempo.js:59`; `stave.js:208-209` |
| Gerou & Lusk | **1.85 sp** (`g` ink bottom; cap top 3.65) over a staff with nothing above | S→I, floor | p. 142 |
| Gould | baseline **3.37**, descender 2.82 sp. The row is shared: `= 100` sits over an empty-above bar with its digits' bottom at 3.42 | S→B / S→I (row-levelled) | p. 183 |
| Ross (prose) | *"slightly above the top staff"* | — | p. A-8 |
| LilyPond | no `staff-padding`, so no separate floor. ⚠️ UNKNOWN whether the 0.8 padding applies to the bare staff | — | `define-grobs.scm:2336-2352` |
| Verovio | none by default (`@tempo.dist` only) | — | `doc.cpp:2292-2303` |

### R9 `TRILL_GLYPH_SIZE` (today 26 pt, em 3.47 sp; Bravura `tr` ink 1.39 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 26 pt | EM 3.47 sp | `trillStyle.ts:112` |
| MuseScore · Verovio | 1 SMuFL em | EM 4 sp = **30 pt** | `tlayout.cpp:6512`; `view_control.cpp:2859` |
| LilyPond | font-size 0 `scripts.trill` | EM = natural Emmentaler (not convertible) | `define-grobs.scm` TrillSpanner |
| Ross | *"slightly less than two spaces high"*; measured **1.55–1.59** | INK-H → DERIVED **29–30 pt** | p. 197 |
| Gerou & Lusk | measured **1.56–1.58** | INK-H → DERIVED **29 pt** | p. 153 |
| Gould | measured **1.1** | INK-H → DERIVED **20.6 pt** | p. 138 (d), via `reference/README.md` |

### R10 `OTTAVA_GLYPH_SIZE` (today 26 pt; Bravura `8va` ink 1.64 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 26 pt | EM 3.47 sp | `ottavaStyle.ts:102` |
| **Gould** | **"1½ stave-spaces high"** (measured 1.70–1.77 raw) | INK-H of the `8` → DERIVED **23.8 pt** | p. 28 |
| **Ross** | **"approximately 1½ spaces"**, `va` ≈ ½ of it (measured 1.26 / 0.91) | INK-H → DERIVED 23.8 pt (stated) / 20 pt (drawn) | p. 203 |
| Gerou & Lusk | measured 1.31–1.39 | INK-H → DERIVED 20.8–22 pt | pp. 98–99 |
| MuseScore · Verovio | 1 SMuFL em | EM 4 sp = **30 pt** | `styledef.cpp:729`; `textbase.cpp:885-889`; `view_control.cpp:866` |
| LilyPond | bold italic TEXT at font-size 0 | EM 2.2 sp (text face; ink height UNKNOWN) | `define-grobs.scm:2716-2717`; `paper.scm:78` |
| VexFlow | 15 pt italic text | EM 2.0 sp | `metrics.js:202-205` |

### R11 `PEDAL_GLYPH_SIZE` (today 26 pt; Bravura `Ped.` ink 1.95 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 26 pt | EM 3.47 sp | `pedalStyle.ts:61` |
| **Ross** | **"approximately 2 spaces high"** (the `℘ed.` sign) | INK-H → DERIVED **26.6 pt** | p. 201 |
| Gould | roman `Ped.` measured 1.70–1.75 raw | INK-H of a ⚠️ **text** design → DERIVED 22.6–23.3 pt | pp. 333, 335 |
| MuseScore · Verovio | 1 SMuFL em | EM 4 sp = **30 pt** | `styledef.cpp:371,382`; `view_control.cpp:2578` |
| LilyPond | feta `pedal.Ped`, font-size 0 | natural | `sustain-pedal.cc:62-68` |
| VexFlow | UNKNOWN (only a 12 pt italic text style found) | — | `metrics.js:108-113` |

### R12 `DYNAMIC_GLYPH_SIZE` (today 30 pt = 1 em; Bravura `f` 2.38, `p` 1.66 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 30 pt | EM 4 sp | `dynamicStyle.ts:13` |
| **Gould** | **`f` 2½ · `p` 2 · `m s z` 1 sp** | INK-H → DERIVED **31.5 pt** (f-matched) / **36 pt** (p-matched) | p. 101 |
| **Ross** | same three heights | INK-H → same | p. 186 (`reference/README.md`) |
| MuseScore · Verovio | 1 SMuFL em | EM 4 sp = 30 pt | `styledef.cpp:807`; `view_control.cpp:1919` |
| LilyPond | font-size 0 feta dynamics | natural | `define-grobs.scm` DynamicText (entry 1434–) |

⚠️ No single em satisfies Gould's `f` and `p` together in Bravura: Bravura's `p` is relatively smaller
than hers.

### R13 `TEMPO_GLYPH_FONT_SIZE` (today 20 pt, em 2.67 sp, 1.11× the 18 pt words)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 20 pt | EM 2.67 sp (0.667 em) | `tempoStyle.ts:38`; `TempoLayout.ts:53` |
| **Gerou & Lusk** | *"The note is cue size or smaller"*; cue = *"65–75%"* | DERIVED EM 0.65–0.75 × 4 sp = **19.5–22.5 pt** | pp. 143, 104 |
| MuseScore | 20 pt at a 1.75 mm spatium | EM 4.03 sp = **30.2 pt** (1.67× text) | `styledef.cpp:2156` |
| VexFlow | 25 pt | EM 3.33 sp = **25 pt** (1.79× text) | `metrics.js:152-159` |
| LilyPond | `make-smaller` note (font-size −1) | one step under natural | `translation-functions.scm:120` |
| Verovio | the music size inside text (⚠️ tempo path unverified) | EM 4 sp = 30 pt | `view_text.cpp:125` |
| Gould | UNKNOWN (the ♩ stem was not isolated; the `= 100` digits' ink is 1.71 sp) | — | p. 183 |

### R14 paren SCALE (today 0.52 × sign pt; trill = his eye, ottava = borrowed)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.52 of the sign's pt, as serif italic **text** | EM ratio | `trillStyle.ts:100`; `ottavaStyle.ts:88` |
| Gerou & Lusk | paren ink **1.15×** the `8`'s ink height | INK-H ratio | p. 99 `(8va)` |
| MuseScore | pedal: SMuFL pedal parens at the sign's scale (**1.0**); ottava and trill: no parens | EM ratio | `styledef.cpp:384-385,691`; `tlayout.cpp:6512-6515` |
| Verovio | octave: SMuFL `octaveParens*` at the numeral's size (**1.0**); trill: enclosing glyphs at the trill's size (1.0) | EM ratio | `view_control.cpp:874-880,2862-2863` |
| Gould · LilyPond | UNKNOWN | — | §6 |

### R15 paren RAISE (today 0.22; **0.30 sp** as coded)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.22 × paren **pt**, applied in px = 0.30 sp up | offset of the paren baseline | `TrillRenderer.ts:894`; `OttavaRenderer.ts:683` (see §4.3 item 2) |
| Gerou & Lusk | paren bottom **0.29 sp below** the `8`'s bottom, paren top 0.08 above | INK position | p. 99 |
| MuseScore (pedal) · Verovio (octave) | **0**: same baseline, alignment designed into the SMuFL parens | glyph design | `styledef.cpp:384-385`; `view_control.cpp:874-880` |
| Verovio (trill) | enclosure placed at `y + trillHeight/2` | centred on the sign | `view_control.cpp:2863` |

### R16 `TEMPO_INK_BELOW` (today 0.53 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.22 × 24 px = 0.53 sp | constant descender | `tempoStyle.ts:78` |
| Gould | **0.55 sp** (bold roman `g`, with a cap height ≈2.0 sp) | INK below the baseline | p. 183 |
| MuseScore · LilyPond · Verovio | no constant; the text's own shape enters the skyline or box | measured from the font | `autoplace.cpp:100-104`; `define-grobs.scm:2352` (`vertical-skylines` from stencil); `adjustfloatingpositionerfunctor.cpp:415` |

### R17 co-located dynamics `GAP` (today 0.6 sp)

| source | value | measures | citation |
|---|---|---|---|
| **this repo** | 0.6 sp | between `getBBox()` boxes (⚠️ the comment says ink) | `DynamicsLayout.ts:152-154` |
| Gould | **0.55 sp** (`p` → `sub.`) | I↔I horizontal | p. 29 |
| MuseScore | **0.5 sp** (0.2 after a trailing `f`) | layout distance, dynamic → expression | `dom/expression.cpp:82-83` |

---

## 6. UNKNOWN: checked, and not answered

- **A floor for the ottava, pedal or tempo in Gould or Ross.** Every measured plate has music pushing
  the mark (§2.2, R4, R6). Only Gerou & Lusk p. 142 (tempo) and Ross p. 197 and G&L p. 153 (trill)
  show a mark over bare staff.
- **The metronome ♩ size in Gould** (p. 183): the stem was not isolated.
- **Gould's paren size or raise** for an octave continuation. Her pp. 28–34 contents list *optional
  parentheses* (`docs/ottava-plan.md` §1), but no parenthesised plate was measured.
- **LilyPond, all of the following:**
  - its parenthesised octave or trill continuation;
  - the gap between a dynamic and its word;
  - the ink height of its bold-italic `8`, which is a text-face metric;
  - whether MetronomeMark's `padding` applies to bare staff lines;
  - the descent of `scripts.trill` below its reference point.
- **Verovio:**
  - a trill or ottava staff distance (not in `GetStaffDistance`);
  - whether tempo's SMuFL ♩ takes the `view_text.cpp:125` scaling;
  - the identity of the trill's enclosing glyphs (`Trill::GetEnclosingGlyphs`, not read).
- **VexFlow:**
  - the size at which `PedalMarking` draws its glyph;
  - whether `Ornament` and `TextDynamics` inherit the root 30 pt;
  - the ornament's y in staff spaces (`ornament.js:145`, not reduced).
- **Whether our 0.6 sp `GAP` box equals ink** (`DynamicsLayout.ts:159-163`).
- **Stone:** grepped for octave sign, pedal, trill, tempo and metronome, and found no size or distance.
  The tempo-placement sentences were located by OCR only and not verified on a scan.
- **Gerou & Lusk:** the pedal-bracket plate on p. 105 was not measured (bracket style, no `Ped.`
  text), and the p. 142 `Allegro` baseline could not be separated from its descender.
- **Dorico, Sibelius, Finale** defaults for any row: not on disk, not checked.
- **Leland's own ink boxes** (MuseScore's font) for `tr`, `8va` and `Ped.`. The derived pt rows use
  Bravura's boxes.
