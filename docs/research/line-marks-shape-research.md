# Line marks — horizontal shape and ends: research (2026-09-14)

> **What this is.** Sourced alternatives for the numbers that shape a line mark (ottava, trill, pedal
> and hairpin) along the horizontal. Each number is going to become a user-selectable **house-style
> preset**. The number running today stays the default, and nothing here recommends a value or
> changes code. Batch 2 of `docs/research/engraving-number-inventory.md` §6.
>
> ⛔ **Out of scope:** vertical placement (padding / minFromStaff / glyph size, which is batch 1),
> line thickness (decided in `rendering/thinLineWeight.ts` and `docs/research/staff-line-research.md`), and
> hairpin aperture 1.5–2 sp (sourced in `docs/plans/dynamics-line-and-hairpins-plan.md` §2.4b–d).

---

## 0. The question and the rows covered

For each number: **how long, how far and where it stops**, as stated or drawn by the treatises and as
coded by the engines. The rows come from the inventory (§2, "Trills / ottava / pedal" and
"Hairpins"; §5b for `OTTAVA_NUMERAL_GAP` and `OTTAVA_CONTINUATION_INSET`).

| # | name | today | file:line | inventory class |
|---|---|---|---|---|
| 1 | `OTTAVA_DASH_LENGTH` / `OTTAVA_DASH_GAP` | 0.5 / 0.4 sp | `rendering/ottavaStyle.ts:205-206` | T |
| 2 | `OTTAVA_HOOK` | 0.8 sp | `rendering/ottavaStyle.ts:285` | T |
| 3 | `OTTAVA_END_AIR` | 0.5 sp | `rendering/ottavaStyle.ts:258` | T (the RULE is his, the value is not) |
| 4 | `OTTAVA_MIN_LINE` | 1.0 sp | `rendering/ottavaStyle.ts:275` | T |
| 5 | `OTTAVA_NUMERAL_GAP` | 0.3 sp | `rendering/ottavaStyle.ts:173` | ? |
| 6 | `OTTAVA_CONTINUATION_INSET` | 2.0 sp | `rendering/ottavaStyle.ts:229` | ? |
| 7 | `TRILL_CONTINUATION_INSET` | 2.0 sp | `rendering/trillStyle.ts:183` | T |
| 8 | `PEDAL_CONTINUATION_INSET` | 2.0 sp | `rendering/pedalStyle.ts:121` | T |
| 9 | `TRILL_END_INSET` | 0.5 sp | `rendering/trillStyle.ts:209` | T (the RULE is his, the value is not) |
| 10 | `PEDAL_BARLINE_AIR` | 0.4 sp | `rendering/pedalStyle.ts:152` | T |
| 11 | `PEDAL_MIN_SPAN` (`Ped.`→✻) | 3.4 sp | `rendering/pedalStyle.ts:136` | T |
| 12 | `PEDAL_SIGN_GAP` | 0.5 sp | `rendering/pedalStyle.ts:161` | T |
| 13 | `HAIRPIN.END_INSET` | 0.25 sp per end | `rendering/hairpinShape.ts:276` | T (the RULE is his, the value is open) |
| 14 | `HAIRPIN.GROWTH_PER_SPACE` | 0.012 sp/sp (from `GROWTH_FROM_SPACES` 36) | `rendering/hairpinShape.ts:189` (`:176`) | T (fitted to his eye, PROVISIONAL) |
| 15 | squeezed-wedge sliver | 1 sp | `rendering/HairpinRenderer.ts:559` | T |

**Existing docs this builds on, and does not repeat:**
- `docs/plans/ottava-plan.md` §1 (rules) and §"HIS EYE, 2026-08-13": the air before the hook and the
  continuation's direction are his; the dash, hook and min line are listed as still open.
- `docs/plans/pedal-plan.md` §5.1a–5.3 and §12 (the five numbers owed to his eye).
- `docs/plans/trill-plan.md` §1 rule 6 (the continuation label and its position) and §4.
- `docs/plans/dynamics-line-and-hairpins-plan.md` §2.4b–d (engines, books, the ramp) and §13.1 (settled
  vs open).
- `reference/README.md`: Gould pp. 333/335 pedal alignment (measured 2026-08-18), p. 29, p. 101–102.

---

## 1. Sources and how to reach each page again

**Books** (all in `reference/`, gitignored; see `reference/README.md`):

| source | page offset | used here |
|---|---|---|
| Gould, *Behind Bars* (PDF 249 MB) | PDF = printed + 20 | pp. 28–31 octave signs; pp. 103–105 hairpins; pp. 136–137 trill line; pp. 333–337 pedalling |
| Ross, *Art of Music Engraving* | PDF = printed + 12 | p. 187 wedge; p. 197 trill; p. 201 pedal; p. 203 octaves (text only) |
| Stone, *Music Notation in the 20th Century* | 2-UP (PDF 23 ≈ pp. 24–25; PDF 49 ≈ p. 77) | p. 25 wavy lines; p. 77 *Ending a Trill* |
| Gerou & Lusk, *Essential Dictionary* | 2-UP | pp. 97–101 octave signs; pp. 105–107 pedal marks |

**Rendering a Gould page to measure** (1 staff space ≈ 20 px at 450 dpi on every plate used here,
checked against the staff lines on each crop):

```bash
P="reference/Behind Bars The Definitive Guide to Music Notation (Elaine Gould) (z-library.sk, 1lib.sk, z-lib.sk) (2).pdf"
pdftoppm -f 50 -l 50 -r 450 -png "$P" /tmp/claude-1000/wave2-line-marks/g   # printed p. 30
```

PDF pages rendered: 48–51 (pp. 28–31), 123–125 (pp. 103–105), 156–157 (pp. 136–137) and
353–357 (pp. 333–337). Measurements were taken with PIL ink runs (threshold 128) on crops of those
PNGs. The crop boxes, in full-page pixels, are:

- p. 30: system break `(440,980,2320,1300)`, length `(560,1760,2240,2140)`, trill `(860,3000,1900,3280)`
- p. 31: single notes `(1000,2640,1760,2920)`, short brackets `(380,1880,2380,2180)`
- p. 104: system break `(740,780,2200,1340)`, abutting wedges `(230,2500,2400,2780)`
- p. 105: `(540,1060,2250,1430)`
- p. 137: notch `(1040,980,1720,1240)`, system break `(360,1740,2400,1960)`
- p. 333: example `(360,3060,2540,3800)`, Table 2 `(1100,800,2540,1380)`
- p. 335: `(800,2780,1960,3380)`
- p. 337: `(400,1700,2400,2260)` and `(780,2740,2150,3360)`

⚠️ **Scan inflation.** A threshold-128 reader thickens every stroke by about 1 px per side, which is
about 0.05 sp. So a measured **dash** reads about 0.1 sp long, and a **white gap** about 0.1 sp short
(the same effect `reference_the_browser_ink_reader_inflates_every_box` records for the browser). The
raw ink figures are given, with the corrected figure where it matters.

**Engines** (in `~/dev/engine-sources`):

| engine | revision | units |
|---|---|---|
| MuseScore | `929d1e9` (2026-08-18) | `_sp` = staff spaces. A dash pattern is in **line widths** (`distributedDashPattern(dash, gap, length / lineWidth)`, `rendering/score/tdraw.cpp:1587-1593`, used at `:1925`) |
| LilyPond | `beedbfa` (2026-08-18) | staff spaces |
| Verovio | `efff0bc` | `unit` = **half** a staff space, `doubleUnit` = 1 sp |
| VexFlow | `node_modules/vexflow` 5.0.0 (⚠️ removed from the app 2026-09-19; the same build is at `~/dev/engine-sources/vexflow-5.0.0-npm/package`) | px at `STAVE_LINE_DISTANCE` 10 (`tables.js:647`), so 10 px = 1 sp |

---

## 2. Books

### 2.1 Gould — octave signs, printed pp. 28–31 (PDF 48–51)

**Prose, read off the scan:**
- p. 28: *"Indicate the extent of the transposition with a line of dashes (hereafter called a dotted
  line). The line extends from the top edge of the 8 for 8 alta and the base of the 8 for 8 bassa,
  and runs parallel to the stave."*
- p. 28, *Placing*: *"Place the numeral just left of the first note to which it applies."*
- p. 30, *Across a system break*: *"End of a system: extend the dotted line as far as the last
  barline (and not beyond it). Beginning of a system: place the 8 (optionally in brackets) just before
  or flush with the first note."*
- p. 30, *Length of the extension line*: *"Terminate the octave transposition with a corner ⌟ (rather
  than just a vertical stroke, as this is less visible). Place this **immediately after the last
  notehead(s), including duration dots**."* Then: *"Although the practice of some editions, avoid
  terminating the line at the end of the duration"*, with the exception of a trill with a wavy line,
  and repeated-bar abbreviations.
- p. 31, *Octave sign for single notes*: *"It is advisable to use an end corner after the 8, so that
  it is absolutely clear that only the single note is affected."*

⛔ **No dash length, gap, hook length or air is stated in words anywhere on pp. 28–31.** Every number
below is **measured** off her plates.

**Measured, at 20 px per staff space:**

| what | instances | value (ink) |
|---|---|---|
| **dash** | p. 30 ex. 1, ex. 3, system A, system B; p. 31 two brackets | **11–13 px = 0.55–0.65 sp** (≈ 0.5 sp corrected) |
| **gap** | same | **10–12 px = 0.5–0.6 sp** (≈ 0.6 sp corrected) |
| period | same | 22.4–22.6 px = **1.12–1.13 sp**, every plate |
| **hook**, outer extent including the line's own stroke | p. 30 ex. 1 / ex. 2 / ex. 3 / trill ex.; p. 31 ×2 | **0.8 / 0.9 / 0.8 / 0.95 / 0.95 / 0.95 sp** |
| **numeral (or its paren) → first dash** | p. 30 ex. 1, ex. 2 `(8)`, ex. 3, sys. A, sys. B, sys. C `(8)`; p. 31 ×3 | **0.25 / 0.3 / 0.15 / 0.2 / 0.2 / 0.2; 0.2 / 0.2 / 0.3 sp** |
| numeral → solid corner, single-note form | p. 31 ×2 | 0.4 / 0.4 sp |
| **air, last ink → hook** | p. 30 ex. 1 (from the **dots**) | 1.2 sp (hook centre) / 1.25 sp (outer) |
| | p. 30 ex. 2 (chord, from the noteheads) | 0.75 sp |
| | p. 30 ex. 3 (whole note) | 0.1 sp |
| **shortest closed bracket**: line start → hook | p. 30 `8‾⌝` over a trilled minim; p. 31 bar 4 `8‾⌝` | **1.75 sp** (one dash + corner), both |
| single-note corner, horizontal arm | p. 31 ×2 | **1.3–1.35 sp** |
| **end of system**: last dash vs barline | p. 30 system A | last dash right edge = barline right edge (**0 sp**) |
| **continuation, bare `8`**: numeral left edge vs first notehead left edge | p. 30 system B | **0.4 sp left** of it (0.45 sp right of the meter) |
| **continuation, `(8)`**: paren left edge vs first notehead left edge | p. 30 system C | **1.25 sp left** of it, **flush (0 sp)** against the meter's right edge |
| opening numeral, non-continuation | p. 30 system A | numeral left edge 0.3 sp left of the first notehead |

### 2.2 Gould — trill line, printed pp. 136–137 (PDF 156–157)

**Prose:**
- p. 136: *"The trill line – a shaded, wavy line, placed directly after the trill sign"*; *"In the
  middle of a bar, the trill line continues **right up to the following notehead or its accidental**
  (if it has one)"*; *"The trill line stops at a barline"*; *"At the end of a system, the trill line
  stops with the barline. (In score layout, the line stops **just before the barline** so as not to
  collide with it.)"*
- p. 137: *"terminate the trill line with a vertical notch. Place the cut-off point **before an
  accidental** for the following note; at the end of a bar, place it **on the barline**"*; *"The trill
  sign should, ideally, be repeated on a new system, above the first entry and in brackets."*

**Measured (p. 137):**
- **Notch → next accidental:** 0.2 sp white (notch right edge to the ♯'s left edge; 0.3 sp from the
  notch centre).
- **Notch → barline:** 0.45 sp white, although the prose says *"on the barline"*.
- **Continuation `(tr)`:** its left paren is 1.5 sp left of the first notehead's left edge and 1.3 sp
  right of the meter. The wavy line starts directly after `)`, with no gap.

### 2.3 Gould — hairpins, printed pp. 103–105 (PDF 123–125)

**Prose:**
- p. 104: *"A hairpin stops with the final barline and begins with the first note of the new system
  (or just before)"*; *"start the hairpin on the left-hand edge of the note and to finish it on the
  right-hand edge of a note"*.
- p. 105: *"A hairpin may cut through a barline, but should not start nor finish on a barline. It is
  neatest if a hairpin that terminates at the beginning of a bar **stops short of the barline**"*.
- p. 103: aperture ceiling 2 sp, *"maintains the same width regardless of dynamic"*. No growth rate
  and no minimum are stated.

**Measured:**

| case | page / example | value |
|---|---|---|
| ⭐ **two abutting wedges `< >`** around a minim chord, with her dashed guides | p. 104, "and not" pair, left | `<` ends on the guide at the minim's **left** edge; `>` starts on the guide at its **right** edge. **White between the wedges = 1.25 sp = the notehead's width** |
| first wedge start vs its guide (the note's left edge) | p. 104, same | 0 sp |
| wedge ending before the next bar's first note | p. 105 bars 1 / 2 | **0.55 / 0.65 sp** short of the barline |
| end of system | p. 104 top two | flush with the barline (0 / 0.05 sp) |
| start of the new system | p. 104 | 0 sp (on the first notehead's left edge) / **0.75 sp before** the first notehead |

### 2.4 Gould — pedalling, printed pp. 333–337 (PDF 353–357)

**Prose:**
- p. 334: *"An extension line terminating with an upward vertical line"*, *"solid to distinguish it
  from the dotted octave extension line"*.
- p. 335: *"the release sign aligns with the barline"* (see also `reference/README.md`).
- p. 333, Table 2: `(Ped.)` *"to confirm pedalling at the beginning of a new system"*. The table has
  no staff, so no position can be measured from it.

**Measured, at 20 px per staff space** (text-style bracket; our pedal draws no line today):

| what | instance | value |
|---|---|---|
| `Ped.` ink → start of the extension line | p. 335 / p. 333 `Ped.` #1 / #2 / `Sost. Ped.` | **0.4 / 0.55–0.65 / 0.5 / 0.65 sp** |
| upward hook above the line's top | p. 335 / p. 333 ×3 | **1.35 / 1.3 / 1.3 / 1.3 sp** (1.45–1.55 sp outer, including the stroke) |
| terminal hook vs barline (release at bar end) | p. 335 | hook right edge flush with the barline's left edge (0.05 sp; centre 0.12 sp left) |
| | p. 337 ex. 2, `Ped.` / `Sost. Ped.` | 0.45 / 0.3 sp inside the final barline |
| ✻ → `Ped.` in the **retake** `✻ Ped.` | p. 333 Table 2 | ≈ 14 px ≈ **0.75 sp** — ⚠️ the table has no staff, so the scale is DERIVED by assuming its ✻ is the same size as p. 337's (34 vs 36 px) |
| a **short** `Ped. … ✻` | — | **UNKNOWN**: the only drawn `Ped.…✻` (p. 337 ex. 1) spans six bars |

### 2.5 The other three books

| book | what it says | numbers |
|---|---|---|
| Gerou & Lusk pp. 97–99 | *"The end of the 8va bracket extends **slightly past** the last note affected"*; at a break *"aligned with the right barline"*, and *"The extender line begins again **just past the clef or key signature**"*, with an optional courtesy `(8va)` | none |
| Gerou & Lusk pp. 106–107 | pedal at end of piece *"aligned with the thin line of the final double barline"*; continuing pedal *"begin immediately after key signature"* | none |
| Ross p. 197 (PDF 209) | *"The wavy sign extends and ends above **the last affected note and not the duration of the last note**"*, which is the opposite of Gould p. 136 (a different end *rule*, not an inset) | none |
| Ross p. 201 (PDF 213) | *"The asterisk is placed **just after** the last note it affects"* | none |
| Ross p. 203 (PDF 215) | octave line *"broken line (sometimes dots)… ending with a downstroke"* | none on the line (numeral 1½ sp tall) |
| Ross p. 187 (PDF 199) | wedge thickness and mouth only | no end, gap or growth |
| Stone p. 77 (PDF 49) | *"The end of a trill should be indicated by a short vertical stroke… if the next note comes after the barline, the wavy line **must end at the barline**, regardless of the amount of space between the barline and the next note"* | none |
| Stone p. 25 (PDF 23) | octave line drawn dotted with a closing stroke | none; no hairpin geometry anywhere (`reference/README.md`) |

---

## 3. Engines

### 3.1 MuseScore (`src/engraving/`)

**Ottava**
- Hook 1.0 sp above and below (`style/styledef.cpp:718-719`).
- Dashed, dash 6 / gap 6 line widths at a line width of 0.11 sp, so **0.66 / 0.66 sp**
  (`styledef.cpp:720-723`). The gap is stretched so the line ends on a dash (`tdraw.cpp:1587-1593`).
- **End: 1 sp past the right edge of the end chord's shape** (dots and accidentals included), never
  past the next chord's x, minus half a line width (`dom/ottava.cpp:420-441`).
- Text → line gap 0.5 sp (`gapBetweenTextAndLine`, `dom/textlinebase.cpp:222`).
- No minimum line: a line shorter than its text is simply not drawn backwards
  (`rendering/score/tlayout.cpp`, `layoutTextLineBaseSegment` ≈`:6108`).

**Pedal**
- Hook 1.2 sp (`styledef.cpp:366`).
- Line start: the `Ped.` symbol starts 0.5 sp left of its segment (`dom/pedal.cpp:253-256`).
- **End: 0.75 sp before the end segment**, or 1.25 sp when another pedal follows at a chord. A lift
  at the bar end uses the barline segment, so **0.75 sp before the barline** (`dom/pedal.cpp:290-303`).
- ✻ (rosette) is right-aligned on the line end but **never left of the `Ped.` text's width** (a floor
  with 0 gap), and the line stops 0.5 sp before it (`tlayout.cpp:4481-4495`).
- Continuation text `(Ped.)` as SMuFL parens (`styledef.cpp:384-385`).

**Trill**
- End: **1 sp before the end segment**, plus any clef or grace-note offset (`dom/trill.cpp:309`).
- Middle and end segments repeat no sign (`docs/plans/trill-plan.md` rule 6).

**Hairpin**
- End: **1 sp before the end segment**, or before the barline segment when the end is at a bar start
  (`dom/hairpin.cpp:789-812`). Start: on the segment.
- Minimum drawn length 1 sp (`tlayout.cpp:3030-3032`).
- Distance to a snapped dynamic 0.5 sp (`styledef.cpp:799`).
- Aperture does not grow with length (`docs/plans/dynamics-line-and-hairpins-plan.md` §2.4b).

**Any line at a system break**
- A continuation segment starts at `firstNoteRestSegmentX(true)`: header right edge **+
  `headerToLineStartDistance` 1.0 sp**, capped at the first note (`tlayout.cpp:6836-6860`,
  `dom/measure.cpp:3346-3380`, `styledef.cpp:621`).
- An open end stops **`lineEndToBarlineDistance` 0.25 sp** before the last barline
  (`dom/measure.cpp:3405-3419`, `styledef.cpp:622`).
- The generic `SLine` end is segment x − 1 sp (`dom/line.cpp:937`).

### 3.2 LilyPond (`scm/define-grobs.scm`, `lily/`)

**`OttavaBracket`** (`define-grobs.scm:2712-2737`)
- `dash-fraction` 0.3 × default `dash-period` 1.0 → **dash 0.3 sp, gap 0.7 sp**. The dash count is
  rounded so the line begins and ends with a dash (`line-interface.cc:238-255`); the edges are solid
  (`bracket.cc:80-82`).
- `edge-height (0 . 0.8)` → **hook 0.8 sp**.
- `shorten-pair (-0.8 . -0.6)`: the bracket starts 0.8 sp left of the first notehead and **ends
  0.6 sp past the right edge of the last notehead, dots included** (`ottava-bracket.cc:82-121`).
- Text → line: text extent **+ 0.3 sp** (*"~ italic correction"*, `ottava-bracket.cc:126-130`).
- `minimum-length` **0.3 sp** of line past the text (`ottava-bracket.cc:131-134`).
- At a break the bound is the prefatory column's right edge and there is no shorten and no hook, so a
  continuation starts **flush after clef/key/meter (0 sp)** (`ottava-bracket.cc:111-116, 146-148`).

**`PianoPedalBracket`** (`:2859-2867`)
- `edge-height (1.0 . 1.0)` → **hook 1.0 sp**.
- `bound-padding` **1.0 sp** between the `Ped.` text and the bracket line
  (`piano-pedal-bracket.cc:76-87`).
- `shorten-pair` 0; a broken side gets no hook (`:58-70`).

**`SustainPedal`** text (`:3579-3597`)
- `self-alignment-X CENTER` on its column and `extra-spacing-width (+inf.0 . -inf.0)`: `Ped.` and ✻
  each centre on their own note and reserve no horizontal room. **No `Ped.`→✻ minimum exists.**

**`TrillSpanner`** (`:4057-4092`)
- Right bound: `attach-dir LEFT`, `adjust-on-neighbor`, `end-on-accidental`, and no padding. The line
  runs **to the left edge of the next note column or its accidental: 0 sp**
  (`line-spanner.cc:166-222`).
- `to-barline #t`. The `left-broken` side has `end-on-note`.
- ⚠️ `TrillSpanner` has **no `bound-padding`** property.

**`Hairpin`** (`:1778-1800`, `lily/hairpin.cc:184-288`)
- `bound-padding` 1.0 is applied **only** at:
  - a text (dynamic) bound, 1.0 sp (`:213-218`);
  - a non-musical bound such as the barline column, 1.0 sp (`:283-284`);
  - an adjacent hairpin sharing the column, **padding / 3 = 0.333 sp either side of the column
    centre** (`:258-259`).
- **0 sp** at a rest (`:269-271`). A plain note column gets its edge (`endpoint-alignments (LEFT .
  RIGHT)`, `:274-280`), with no padding.
- Broken left: prefatory edge + 1.0 sp. Broken right: − `broken-bound-padding`, which is 0, or 0.5 sp
  under a span bar (`:52-108, 191-209`).
- `minimum-length` 2.0 sp, enforced by a spacing **rod** that lengthens the music.

### 3.3 Verovio (`src/`, unit = ½ sp)

**Octave** (`view_control.cpp:815-962`)
- Line width 0.20 unit = **0.1 sp** (`options.cpp:1439-1441`, `octave.cpp:117-119`).
- `PEN_SHORT_DASH`: dash = 2 × width = **0.2 sp** and gap = 4 × width = **0.4 sp**, with square caps
  (`:893-913`, `devicecontext.cpp:157-159`, `svgdevicecontext.cpp:623,645`). The SVG square cap adds
  half a width at each end, so the visible ink is ≈ **0.3 / 0.3 sp**.
- Numeral → line **0.1 sp** (`x1 += lineWidth`, `:888-889`).
- **Hook 2 units = 1.0 sp** (`:917`), with a 1-unit horizontal arm (`:943-947`).
- Too short: no line, just the **0.5 sp corner** (`:919-925`).
- End: the end element's content right, **0 air** (`:844-849`).
- Continuation: first measure's **left barline** + half a whole-notehead + the paren width
  (`:262-266, 837-842`). Open end: the right barline (`:248-251`).

**Pedal**
- Bracket hook = doubleUnit = **1.0 sp** (`:1153-1154`).
- Line begins at the `Ped.` glyph's right edge, **0 gap** (`:1134-1140`).
- End at the end note's left + a stem width (`:1142-1144`).
- In `pedstar` form `Ped.` and ✻ each **centre on their note** (`:2535-2550`), so there is no minimum
  span.

**Trill extension**
- Ends **doubleUnit = 1.0 sp before** the end (`:1210-1214`).
- Starts half a `tr` width in (`:1205-1208`).

**Hairpin**
- 0.25 sp (`unit/2`) from a linked dynamic (`:672-678`).
- Kept ≥ 1.0 sp long, else the adjustment is dropped (`:683-694`).
- Kept **≥ 1.0 sp from a barline, 1.5 sp at a repeat or final barline** (`hairpin.cpp:172-219`,
  applied `view_control.cpp:697-699`).

### 3.4 VexFlow 5.0.0 (`build/esm/src/`, 10 px = 1 sp)

| class | numbers |
|---|---|
| `TextBracket` (its ottava) | `dash: [5]` = **0.5 / 0.5 sp**; `bracketHeight` 8 = **0.8 sp** hook (also dashed); text → line 5 px = 0.5 sp above the staff, 2 px = 0.2 sp below; end = stop note x + glyph width, i.e. **0 air** (`textbracket.js:40-48, 99-121`) |
| `PedalMarking` | `bracketHeight` 10 = **1.0 sp** hook; `textMarginRight` 6 = **0.6 sp** `Ped.` → line; release at next note − 5 px = **0.5 sp before** it, or the stave end − 0.5 sp (`pedalmarking.js:36-40, 82, 96-104`) |
| `VibratoBracket` | stops 5 px = **0.5 sp** before the stop note; at the stave end, 10 px = 1.0 sp (`vibratobracket.js:35-37`) |
| `StaveHairpin` | `leftShiftPx` / `rightShiftPx` 0 (`stavehairpin.js:38-45`) |

---

## 4. What this repo draws today

| # | where it is applied | decided? |
|---|---|---|
| 1 | `ctx.setLineDash([0.5, 0.4] sp)`, phase 0, no redistribution, so the line may end in a gap (`OttavaRenderer.ts:703-716`) | OPEN: `ottava-plan.md` §"HIS EYE" still-open list ("the dash pattern") |
| 2 | hook drawn only on the fragment carrying the true end, and only if a horizontal exists (`OttavaRenderer.ts:580-588`) | OPEN: same list ("the hook") |
| 3 | added to `noteRightX` = `getNoteHeadEndX()`, the **notehead's** right edge (`OttavaRenderer.ts:160-165, 204, 484`) | ⭐ RULE his (HIS EYE item 2, *"air after the end of the note"*); value taste |
| 4 | `lineEnd = max(nudged x1, lineStart + MIN_LINE)` (`OttavaRenderer.ts:574`) | OPEN ("the min line") |
| 5 | `lineStart = numeral right + gap` (`OttavaRenderer.ts:566`) | taste; the comment says "borrowed from the trill's LilyPond value" |
| 6 | `max(noteStartX − inset, bar measureX)` (`OttavaRenderer.ts:542-549`); measured from where the NOTES may begin, not from a notehead | ⭐ DIRECTION his (HIS EYE item 5); value open |
| 7 | parenthesised label only, same clamp (`TrillRenderer.ts:722-731`) | position rule his (`trill-plan.md` rule 6); value taste |
| 8 | same clamp (`PedalRenderer.ts:444-452`) | OPEN: `pedal-plan.md` §12 item 5 |
| 9 | subtracted from the next slot's note-left x, else from the bar's `noteEndX`, before cutting (`TrillRenderer.ts:166-172, 216-221`) | ⭐ RULE his (*unconditional*, 2026-08-13); value OPEN (`trill-plan.md` §10 P2) |
| 10 | only on the barline-fallback lift (`PedalRenderer.ts:173-177`) | OPEN: `pedal-plan.md` §12 item 4 |
| 11, 12 | floors on the ✻ x: `max(lift − width + nudge, signX + downWidth + SIGN_GAP, signX + MIN_SPAN − upWidth)` (`PedalRenderer.ts:513-517`) | OPEN: `pedal-plan.md` §12 item 6 |
| 13 | `startX += inset; endX −= inset`, per end, never at a break (`HairpinRenderer.ts:534-535`) | ⭐ RULE his (*"hardcode the air"*, 2026-08-12); value **STILL OPEN** (`dynamics-line-and-hairpins-plan.md` §13.1) |
| 14 | `min(2.0, 1.5 + 0.012 × max(0, len − 36))` (`hairpinShape.ts:351-361`) | ⚠️ PROVISIONAL, fitted to his seven verdicts (§2.4d, §13.1) |
| 15 | same-system crossed ends only: `endX = max(x.endX, startX + 1 sp)` (`HairpinRenderer.ts:555-560`); a rescue for a crossed wedge, not a minimum length | none |

---

## 5. ⭐ PRESET ROWS

Each row is one source's value in staff spaces, what it measures, and where it comes from.
**"ours"** is today's default. Gould figures are raw scan ink (§1 caveat).

### 5.1 Ottava dash / gap (`OTTAVA_DASH_LENGTH` / `OTTAVA_DASH_GAP`)

| source | dash | gap | measures | citation |
|---|---|---|---|---|
| **ours** | 0.5 | 0.4 | stroke dash array, phase 0 | `ottavaStyle.ts:205-206` |
| Gould (drawn) | 0.55–0.65 (≈ 0.5) | 0.5–0.6 (≈ 0.6) | ink, 6 plates, period 1.12–1.13 | pp. 30–31 (PDF 50–51) |
| MuseScore | 0.66 | 0.66 (stretched to end on a dash) | 6 / 6 × 0.11 sp line width | `styledef.cpp:720-723`, `tdraw.cpp:1587-1593` |
| LilyPond | 0.3 | 0.7 (rounded to begin and end with a dash) | fraction 0.3 of period 1.0 | `define-grobs.scm:2714`, `line-interface.cc:238-255` |
| Verovio | 0.2 (≈ 0.3 visible) | 0.4 (≈ 0.3 visible) | 2× / 4× a 0.1 sp line, square caps | `view_control.cpp:886-913`, `devicecontext.cpp:157-159` |
| VexFlow | 0.5 | 0.5 | `dash: [5]` px | `textbracket.js:42` |

### 5.2 Ottava hook (`OTTAVA_HOOK`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 0.8 | from the line's y | `ottavaStyle.ts:285` |
| Gould (drawn) | 0.8–0.95 | outer, including the line stroke, 6 instances | pp. 30–31 |
| MuseScore | 1.0 | hook height | `styledef.cpp:718-719` |
| LilyPond | 0.8 | `edge-height` right | `define-grobs.scm:2715` |
| Verovio | 1.0 | 2 units | `view_control.cpp:917` |
| VexFlow | 0.8 | `bracketHeight` 8 px | `textbracket.js:46` |

### 5.3 Ottava air after the last note (`OTTAVA_END_AIR`)

| source | sp | measured from | citation |
|---|---|---|---|
| **ours** | 0.5 | the **notehead's** right edge (dots excluded) | `ottavaStyle.ts:258`, `OttavaRenderer.ts:160-165` |
| Gould (prose) | "immediately after" | last notehead(s) **including duration dots** | p. 30 |
| Gould (drawn) | 0.1 / 0.75 / 1.2 | whole note / chord heads / dots | p. 30 exx. 3 / 2 / 1 |
| Gerou & Lusk | "slightly past" | last note | pp. 97, 99 |
| MuseScore | 1.0, capped at the next chord's x, − ½ line width | end chord's shape right edge (dots included) | `dom/ottava.cpp:426-441` |
| LilyPond | 0.6 | right edge of last notehead **incl. dots** | `define-grobs.scm:2721`, `ottava-bracket.cc:91-121` |
| Verovio | 0 | end element's content right | `view_control.cpp:844-849` |
| VexFlow | 0 | stop note x + glyph width | `textbracket.js:99` |

### 5.4 Shortest closed bracket (`OTTAVA_MIN_LINE`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 1.0 | line start → hook, final fragment only | `ottavaStyle.ts:275`, `OttavaRenderer.ts:574` |
| Gould (drawn, dashed) | 1.75 | line start → hook (one dash + corner), 2 instances | p. 30 trill ex.; p. 31 bar 4 |
| Gould (drawn, single-note corner) | 1.3–1.35 | horizontal arm of the solid `⌟` | p. 31 *Octave sign for single notes* ×2 |
| LilyPond | 0.3 | `minimum-length` past the text | `define-grobs.scm:2718`, `ottava-bracket.cc:131-134` |
| Verovio | 0.5 | corner arm when there is no room for a line | `view_control.cpp:919-925, 946` |
| MuseScore | none | a line shorter than its text is not drawn | `tlayout.cpp` `layoutTextLineBaseSegment` |
| VexFlow | none | — | `textbracket.js` |

### 5.5 Numeral → line (`OTTAVA_NUMERAL_GAP`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 0.3 | numeral advance → line start | `ottavaStyle.ts:173` |
| Gould (drawn) | 0.15–0.3 (≈ 0.2–0.4 corrected for inflation) | numeral or `)` ink → first dash ink, 9 instances | pp. 30–31 |
| Gould (drawn, solid corner) | 0.4 | numeral → corner | p. 31 |
| MuseScore | 0.5 | `gapBetweenTextAndLine` | `textlinebase.cpp:222` |
| LilyPond | 0.3 | text extent + *"~ italic correction"* | `ottava-bracket.cc:126-130` |
| Verovio | 0.1 | one line width | `view_control.cpp:888-889` |
| VexFlow | 0.5 above / 0.2 below | 5 px / 2 px | `textbracket.js:103-109` |

### 5.6 Continuation label position (`OTTAVA_` / `TRILL_` / `PEDAL_CONTINUATION_INSET`)

⚠️ **The reference point differs by source**, so a preset has to carry BOTH the number and what it is
measured from.

| source | value | measured from | citation |
|---|---|---|---|
| **ours** (all three) | 2.0 left | `noteStartX`, clamped at the bar's `measureX` | `ottavaStyle.ts:229`, `trillStyle.ts:183`, `pedalStyle.ts:121` |
| Gould, `(8)` | 1.25 left / flush 0 | first notehead's left edge / the meter's right edge | p. 30 system C |
| Gould, bare `8` | 0.4 left / 0.45 right | first notehead / meter | p. 30 system B |
| Gould, `(tr)` | 1.5 left / 1.3 right | first notehead / meter | p. 137 |
| Gould, `(Ped.)` | **UNKNOWN** | — | p. 333 Table 2 (no staff) |
| Gerou & Lusk | "just past the clef or key signature" (octave); "immediately after key signature" (pedal) | header | pp. 98–99, 107 |
| MuseScore | +1.0 right, capped at the first note | header's right edge (`headerToLineStartDistance`) | `measure.cpp:3346-3380`, `styledef.cpp:621` |
| LilyPond, octave | 0 | prefatory column's right edge | `ottava-bracket.cc:111-116` |
| LilyPond, hairpin (for comparison) | +1.0 | prefatory edge | `hairpin.cc:193-194` |
| Verovio, octave | + ½ whole-notehead + paren width | system's left **barline** | `view_control.cpp:262-266, 837-842` |

### 5.7 Trill line end (`TRILL_END_INSET`)

| source | sp | measured before | citation |
|---|---|---|---|
| **ours** | 0.5 | next note's left x, or the bar's `noteEndX` | `trillStyle.ts:209`, `TrillRenderer.ts:166-221` |
| Gould (prose) | 0 ("right up to") | following notehead **or its accidental**; at a system end "just before the barline" | p. 136 |
| Gould (drawn, notch) | 0.2 / 0.45 | next note's accidental / barline | p. 137 |
| Stone | 0 ("must end at the barline") | barline, when the next note is past it | p. 77 |
| Ross | — (a different end rule) | ends above the last note, not its duration | p. 197 |
| MuseScore | 1.0 (+ clef / grace offset) | end segment x | `dom/trill.cpp:309` |
| LilyPond | 0 | next column's left edge or its accidental | `define-grobs.scm:4080-4082`, `line-spanner.cc:176-222` |
| Verovio | 1.0 | end x | `view_control.cpp:1210-1214` |
| VexFlow `VibratoBracket` | 0.5 / 1.0 | stop note / stave end | `vibratobracket.js:36-37` |

### 5.8 Pedal release at a barline (`PEDAL_BARLINE_AIR`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 0.4 | ✻ right edge inside `noteEndX` | `pedalStyle.ts:152` |
| Gould (prose) | 0 ("aligns with the barline") | release sign vs barline | p. 335 |
| Gould (drawn) | 0.05 / 0.45 / 0.3 | hook right edge vs barline | p. 335; p. 337 ex. 2 ×2 |
| Gerou & Lusk | 0 ("aligned with the thin line of the final double barline") | pedal-up at end of piece | p. 107 |
| MuseScore | 0.75 | line end before the barline segment | `dom/pedal.cpp:290-303` |
| VexFlow | 0.5 | release before the stave end | `pedalmarking.js:96-104` |
| LilyPond / Verovio | no barline-specific rule found | — | `piano-pedal-bracket.cc:58-70`; `view_control.cpp:1142-1144` |

### 5.9 Shortest `Ped.`…✻ (`PEDAL_MIN_SPAN`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 3.4 | `Ped.` left → ✻ right | `pedalStyle.ts:136` |
| Gould | **UNKNOWN** | no short pedal drawn | pp. 333–337 |
| MuseScore | `Ped.` width + ✻ width (gap 0) | ✻ floored at the `Ped.` text width | `tlayout.cpp:4481-4495` |
| LilyPond | none | both signs centred on their notes, no horizontal room reserved | `define-grobs.scm:3581-3587` |
| Verovio | none | both centred on their notes | `view_control.cpp:2535-2550` |
| VexFlow | none | — | `pedalmarking.js` |

### 5.10 Gap after `Ped.` (`PEDAL_SIGN_GAP`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 0.5 | `Ped.` ink → ✻ | `pedalStyle.ts:161` |
| Gould (drawn) | ≈ 0.75 (scale derived) | ✻ → `Ped.` in the retake `✻ Ped.` | p. 333 Table 2 |
| Gould (drawn) | 0.4–0.65 | `Ped.` → extension line (bracket style) | pp. 333, 335 |
| MuseScore | 0 / 0.5 | ✻ floor / `Ped.` → line | `tlayout.cpp:4487-4491`, `textlinebase.cpp:222` |
| LilyPond | 1.0 | `Ped.` text → bracket line (`bound-padding`) | `define-grobs.scm:2861`, `piano-pedal-bracket.cc:76-87` |
| Verovio | 0 | `Ped.` glyph → line | `view_control.cpp:1134-1140` |
| VexFlow | 0.6 | `Ped.` → bracket (`textMarginRight`) | `pedalmarking.js:38, 82` |

⚠️ **Only the first two rows measure the join this constant controls today** (`Ped.` next to ✻). The
`Ped.`→line rows are for a future bracket style.

### 5.11 Hairpin end air (`HAIRPIN.END_INSET`)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 0.25 per end (0.5 between two wedges) | inset from the slot edges, unconditional | `hairpinShape.ts:276` |
| Gould (drawn) | **1.25 between two wedges** (= notehead width) | `<` ends at the pivot note's left edge, `>` starts at its right edge | p. 104 |
| Gould (drawn) | 0 | start vs its note's left edge | p. 104 |
| Gould (drawn) | 0.55–0.65 | end before a barline | p. 105 bars 1–2 |
| Dorico (second-hand) | a notehead width (≈ 1.18) between abutting wedges | — | `dynamics-line-and-hairpins-plan.md` §2.4c (not on disk) |
| MuseScore | 1.0 | before the end segment or barline | `dom/hairpin.cpp:789-812` |
| LilyPond | 0.333 / 1.0 / 1.0 / 0 | either side of a column shared with another wedge / a dynamic / a barline column / a rest | `hairpin.cc:213-284` |
| Verovio | 0.25 / ≥ 1.0 (1.5) | a linked dynamic / a barline (repeat, final) | `view_control.cpp:672-678`, `hairpin.cpp:172-219` |
| VexFlow | 0 | shift defaults | `stavehairpin.js:38-45` |

### 5.12 Hairpin growth rate (`HAIRPIN.GROWTH_PER_SPACE`)

| source | sp per sp | from length | citation |
|---|---|---|---|
| **ours** | 0.012 | 36 sp, to a 2.0 ceiling | `hairpinShape.ts:176-189` |
| Dorico (second-hand) | **0.0179** (1.0 → 1.5 sp over 8 → 36 sp) | 8 sp | Spreadbury, quoted in `dynamics-line-and-hairpins-plan.md` §2.4d (not on disk) |
| Sibelius / Finale | step (two apertures around a length threshold) | user setting | same §2.4d |
| LilyPond / MuseScore / GUIDO | 0 | — | same §2.4b |
| Verovio | 0 upward (it only narrows short wedges, via a 16° cap) | — | same §2.4b |
| Gould | 0 (no growth stated; ceiling 2 sp) | — | p. 103 |

### 5.13 Degenerate wedge (squeezed-wedge sliver)

| source | sp | measures | citation |
|---|---|---|---|
| **ours** | 1 | crossed same-system ends rescued to start + 1 | `HairpinRenderer.ts:559` |
| MuseScore | 1.0 | minimum drawn length | `tlayout.cpp:3030-3032` |
| Verovio | 1.0 | adjusted wedge refused below 2 units | `view_control.cpp:683-694` |
| LilyPond | 2.0 | `minimum-length`, by rod (moves the music) | `define-grobs.scm:1787` |
| Dorico (second-hand) | 3 | default minimum length | `dynamics-line-and-hairpins-plan.md` §2.4c |
| Gould | **UNKNOWN** | — | pp. 103–108 |

---

## 6. UNKNOWN

- **Gould, stated numbers for any of these rows.** Pp. 28–31, 103–105, 136–137 and 333–337 were read
  on the scan, and no dash, gap, hook, air, inset or growth figure is written there. Everything Gould
  in §5 is measured off her plates.
- **Gould, where `(Ped.)` goes at a system start.** Table 2 (p. 333) has no staff, and no continued
  pedal is drawn on pp. 333–337.
- **Gould, a short `Ped.…✻` pair.** None is drawn, so `PEDAL_MIN_SPAN` has no book value. The retake
  gap (§5.10) is scaled from a glyph-size assumption, and says so.
- **Gould, a degenerate or minimum-length wedge.**
- **Ross, Stone and Gerou & Lusk numbers** for every row: their texts give only the prose in §2.5.
- **Dorico and Sibelius** values are not on disk. They appear only as quoted in
  `dynamics-line-and-hairpins-plan.md`, and are marked second-hand.
- **LilyPond:** whether an `OttavaBracket` or a pedal re-prints its text on a broken piece was not
  checked. It does not change the x rows above.
- **Plate precision.** Figures are ±0.05 sp per edge, with dashes inflated and gaps deflated by about
  0.1 sp (§1). The three plate-to-plate air values in §5.3 (0.1–1.2 sp) are a genuine spread in her
  engraving, not a measurement error.
