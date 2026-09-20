# The slur residue — the eight slur numbers that still had no source (2026-09-14)

Research only. It recommends nothing and changes no code. Every number below is a candidate
**house-style preset row**; the value running today stays the default.

## 0. The question and the rows covered

`docs/research/engraving-number-inventory.md` §2 "Slurs & ties" (lines 135–143) and §6 batch 3 (lines 282–284,
317–319) list eight slur numbers with no source, or with a source that is only half there:

| # | row | today | defined | consumed |
|---|---|---|---|---|
| 1 | `CURVE.slurLift` | 1.0 sp | `rendering/curveStyle.ts:40` | `SlurRenderer.ts:46`, `:586`, `:654` (added to the anchor y from `staveNote.getYs()`, i.e. the **notehead centre**, `SlurRenderer.ts:140`; or from the stem tip) |
| 2 | `CURVE.brokenSlurMaxRise` | 2.0 sp | `curveStyle.ts:78` | `brokenSlurTilt.ts:110` |
| 3 | `BROKEN_SLUR_MAX_SLOPE` | 0.5 (rise ÷ fragment length) | `curveStyle.ts:325` | `brokenSlurTilt.ts:110`, `:117` |
| 4 | `CURVE.slurNestGap` | 1.0 sp per nesting level | `curveStyle.ts:121` | `SlurRenderer.ts:47`, `:742` → `slurArchHeight.ts:70` (`extraHeight`) |
| 5 | `CURVE.slurSlantMaxTravel` | 1.0 sp | `curveStyle.ts:170` | `slurSlantLimit.ts:58` |
| 6 | `SLUR_ARCH_TILT` | 0.25 × dy | `curveStyle.ts:337` | `slurArchHeight.ts:99` → `SlurRenderer.ts:414-470` |
| 7 | `CURVE.slurStemOvershoot` | 1.0 sp | `curveStyle.ts:221` | `slurStemEndpoint.ts:188` |
| 8 | accidental avoid point, **double sharp** | 0 (the glyph's centre) | `slurAccidentalPoint.ts:69` | `accidentalAvoidPoint`, same file |

**Units.** sp = staff spaces. Verovio's `unit` is half a staff space. LilyPond slur coordinates are in
staff spaces. MuseScore `spatium` is one staff space.

## 1. What `slur-tie-research.md` and `slur-plan.md` already answer

| row | already on record | what was still open |
|---|---|---|
| `slurLift` | research §5 row 8 (Gould p. 110 minimum ½ sp; MuseScore 0.9; LilyPond "0.5"; Verovio 0.625; VexFlow 1.0); plan §11.9 row 1; plan §12.1 | a plate measurement; and ⚠️ **§5 row 8 compares numbers taken from different origins** (see §3.1) |
| `brokenSlurMaxRise` | plan Phase 5, fault table row 4 ("⚠️ ours"); research §5 row 15; research §4.2 "system break" row already records MuseScore's `continuedSlurMaxDiff` 2.5 sp, without connecting it to this row | the connection, plus Gould's plates |
| `BROKEN_SLUR_MAX_SLOPE` | plan Phase 5, fault table row 1; research §4.2 (`constrainLeftAnchor` 0.25 sp) | a plate, and the engines' slope terms |
| `slurNestGap` | plan §8 Phase 8 (born as 10 px, "Gould" cited with no page); research §2.1 C (the p. 113 sentence); research §4.1 (`free-slur-distance` 0.8) | a plate, Verovio's and MuseScore's mechanisms |
| `slurSlantMaxTravel` | plan §12 Phase 6 ("ours and provisional"); plan §11.5 | the engines' equivalent bounds |
| `SLUR_ARCH_TILT` | plan §"The lean could invert a control" (its **bound**, `SLUR_ARCH_TILT_LIMIT`, his hand, decided); plan Phase 8 (the solver must know the lean) | the value 0.25 itself — answered in §4.2 below: it is geometry, not taste |
| `slurStemOvershoot` | plan §12.1: *"The clamp is the stem end plus one space … our `slurStemOvershoot`, confirmed"* — the formula is quoted, the line number is not | the line number (§3.2) |
| double sharp | research §8.8: *"The double sharp is OURS — LilyPond's table has three branches and no ##"* | what LilyPond actually does for `##` (§3.1): it is not "ours" |

## 2. The books

Checked: Gould *Behind Bars* pp. 110–113 (PDF 130–133, rendered at 450 dpi and read as images);
Ross pp. 136–143 (full-text lines 8459–8800); Gerou & Lusk pp. 121–125 (full-text lines 5008–5210);
Stone pp. 35–39 (already recorded silent on shape numbers, research §7). No book states a number for
any of the eight rows. What they state:

- **Gould p. 110–111** (PDF 130–131): *"The ends of a slur may be placed as close as half a
  stave-space from the centre of noteheads, including where ties are placed at the edge of noteheads
  (a). Where there is plenty of space, the tie starts and finishes at the centre of the notehead; in
  this case, the slur must move further from the note, so that its ends can also centre on it (b)."*
  This is a **minimum**. Its figure is measured in §2.1.
- **Gould p. 111**: *"The slur should not, however, move too close to noteheads if there is room for
  it to be further away."* A sentence against too little distance. Nothing about a maximum.
- **Gould p. 112** (PDF 132): a broken half *"must be angled in the direction of the final pitch …
  so as to look clearly open-ended"*. No amount. Its figures are measured in §2.2.
- **Gould p. 113** (PDF 133), *Slurs within slurs*: *"The shorter slur goes closest to the notes."*
  No distance. Its figure is measured in §2.3.
- **Gerou & Lusk p. 122**: at the notehead the slur *"should be centered on the notehead. It should
  not touch the notehead."* No distance. p. 125: a continuation *"ends at a slight angle"* /
  *"continues at a slight angle"*. No amount.
- **Ross p. 140–141**: a short slur must *"clear the staff"*; *"A long slur is a straight line with
  both ends bending uniformly towards the enclosed notes"*. No number for lean, rise or gap.

### 2.1 Gould p. 111 (a)/(b) — the slur endpoint's height above the notehead, MEASURED

Method (all §2.x): `pdftoppm -r 450`, PIL, dark means value < 128. Staff lines are rows more than 70%
dark, giving 1 sp = 20.0–20.25 px. A curve is traced column by column, with staff-line rows masked.
Values are taken at the stroke's centre line. Threshold blur is about 1 px per side, i.e. about 0.05 sp.
Script: `/tmp/claude-1000/wave2-slurs/measure.py`.

| figure | slur's left end, above the notehead centre | end x vs head centre | note |
|---|---|---|---|
| (a) ties at the head's edge | **≈ 1.0 sp** (±0.15: the slur and tie ink merge over the last 0.3 sp) | ≈ +0.2 sp | first note D5, head centre y 751, end ≈ y 730–735 |
| (b) ties on the head's middle | **1.5 sp** | +0.25 sp | end (1513, 721.5), head centre y 752 |

So the prose minimum is ½ sp. Her drawing uses about 1.0 sp where a tie shares the end, and 1.5 sp
where the tie is centred.

The same figure also gives the white gap **between the slur and the tie beneath it**: (b) 0.50–0.55 sp
over the tie's first half, widening to 1.8 sp toward the slur's middle; (a) 0.25 sp at the merge,
0.5 sp about 1 sp in.

### 2.2 Gould p. 112 — broken halves: open-end rise and slope, MEASURED

Rise = how far the **open** end's stroke centre sits outward (away from the staff) of the anchored
end's stroke centre. That is the quantity `brokenSlurOpenRise` returns. Slope = |rise| ÷ half length.
The traced ends were drawn back onto the page and checked by eye (`ov112small.png`, `ov112long.png`).

| half | where | length | open-end rise | slope |
|---|---|---|---|---|
| G | top figure, end of system (bass, slur above) | 22.9 sp | +1.43 sp | 0.06 |
| H | top figure, beginning of new system | 22.9 sp | **+2.00 sp** | 0.09 |
| A | bottom figure, end of system, above C | 4.85 sp | +1.23 sp | 0.25 |
| B | same, below F | 6.05 sp | +0.75 sp | 0.12 |
| C | beginning, above ♯C | 3.45 sp | +0.97 sp | 0.28 |
| D | beginning, below | 2.70 sp | −0.85 sp (toward the staff) | 0.31 |
| E | "slurs" row, end of system, above ♮B | 3.15 sp | +1.45 sp | **0.46** |
| F | "slurs" row, beginning, above ♭B | 2.85 sp | +1.38 sp | **0.48** |

Largest rise drawn: **2.00 sp**. Steepest slope drawn: **0.48**, on the shortest halves. These are one
page's drawings, not stated limits.

### 2.3 Gould p. 113 — slurs within slurs, MEASURED

Left figure (two short slurs inside one long one, all below). 1 sp = 20.0 px.

| where along the inner slur | white gap inner → outer | stroke centre → centre |
|---|---|---|
| inner slur's middle third (x 660–725) | **0.55–0.70 sp** | ≈ 0.85 sp |
| toward the inner slur's end, where the outer keeps descending | 0.8 → 1.25 sp | — |
| second inner slur, its middle | 0.65–0.85 sp | — |

One figure, one level of nesting. Deeper nesting was not drawn.

## 3. The engines

### 3.1 Per row

**`slurLift` — endpoint height above the head.** Every value below has been converted to the
head-centre origin that ours uses:

| engine | as written | from the head CENTRE | where |
|---|---|---|---|
| MuseScore | `po.y = note.y + 0.9 sp` (y is the head's centre) | **0.9 sp** | `slurtielayout.cpp:613` |
| LilyPond | head **extent** + 0.5 sp; +0.15 sp more if that lands on a line | **≈ 1.0 sp** (0.5 half-head + 0.5) | `slur-scoring.cc:556-557`; research §4.1 |
| Verovio | drawing **top** + 1.25 unit = +0.625 sp | **≈ 1.125 sp** | `slur.cpp:1000`, `:1004` |
| VexFlow `Curve` | `yShift` 10 px | 1.0 sp | `curve.js:23` (research §4.4) |

⚠️ The LilyPond and Verovio conversions assume a notehead half-height of 0.5 sp. That is Bravura's
`noteheadBlack` (`fonts/bravuraMetrics.ts:124`). Feta's own was not measured.
⚠️ **Research §5 row 8 lists LilyPond as "0.5 sp" beside our from-centre 1.0.** LilyPond's 0.5 is
measured from the head's edge. From the centre it is about 1.0, the same as ours.

**`slurStemOvershoot` — the slide's ceiling past the stem tip.**
- **MuseScore:** `po.ry() = std::max(po.y() + yd, sc->downNote()->pos().y() - sh - _spatium)`
  (`slurtielayout.cpp:710`), mirrored below at `:712` and at the end side (research §4.2, `:828`).
  That is stem tip + **1.0 sp**. `sh` is the stem height measured from the chord's far note. This is
  the line the inventory said was missing.
- **LilyPond:** candidate endpoints are searched out to
  `max(base + region-size, note-column extent + 1)` (`slur-scoring.cc:497-503`), with `region-size`
  **4** (`scm/layout-slur.scm:39`). The column extent includes the stem, so the search reaches
  **stem tip + 1.0 sp** (or 4 sp from the base, whichever is further). Candidates are scored, not
  clamped.
- **Verovio:** has no slide along the stem (it attaches beside the stem, `slur.cpp:669-721`), so this
  row does not apply.

**`slurSlantMaxTravel` — how far the slant ceiling may lift an end.**
- **Verovio:** unbounded. `GetAdjustedSlurAngle` sets the endpoint's y directly
  (`slur.cpp:567-596`).
- **LilyPond:** `region-size` **4.0 sp** is the furthest any endpoint candidate goes from its base
  (`slur-scoring.cc:497-512`, `layout-slur.scm:39`). Steepness is a penalty, not a clamp: `max-slope`
  1.1 × `max-slope-factor` 10 (`slur-configuration.cc:494-498`). When a candidate is steeper than
  `max-slope`, LilyPond drops the stem attachment and returns the x to the head's centre
  (`slur-scoring.cc:765-776`).
- **MuseScore:** has no slant clamp at all (research §4.2 "slant" row), so this row does not apply.

**`SLUR_ARCH_TILT`.** The engines build the arch in a frame rotated onto the chord, so they have no
per-dy lean:
- LilyPond: `slur-configuration.cc:140-147`, plus a horizontal nudge
  `−dir·headWidth·sin(angle)/3` marked *"TODO: parameter"* (`slur-scoring.cc:781-793`).
- Verovio: rotate, make symmetric, rotate back (`slur.cpp:1145-1155`).
- MuseScore: symmetric shoulders `c(1∓W)/2` in the chord frame (research §4.2).
- VexFlow `Curve`: places each control relative to **its own** endpoint
  (`curve.js:53-56`: `firstY + cp0y`, `lastY + cp1y`). Equal `cps` therefore means a lean of **0**.

**`slurNestGap` — nested slurs.**
- **LilyPond:** `free-slur-distance` **0.8 sp**, added outward from the inner slur's **midpoint**
  (`curve_point(0.5)`), which becomes an avoid point for the outer slur (`slur-scoring.cc:680-693`;
  `layout-slur.scm:30`). The doc string says it *"only works for PhrasingSlur"* (`lily/slur.cc:498-499`),
  i.e. a slur inside a phrasing slur.
- **Verovio:** `AdjustOuterSlur` (`adjustslursfunctor.cpp:227-268`). Each inner slur is sampled at
  t = 0, .25, .5, .75, 1. The outer slur's control points must clear those samples by `slurMargin`
  **0.5 sp** (`options.cpp:1478-1480`; `:769-805`), ignoring samples near its ends
  (`|0.5 − ratio| < 0.45`). Its endpoints must clear the inner slur's start, middle and end by
  1.5 × margin = **0.75 sp** (`:837`, `:849`, `:861`).
- **MuseScore:** no arch rule for a nested slur was found. Grepping `slurtielayout.cpp` for slur
  segments finds only `adjustOverlappingSlurs` (`:1836`). When two slurs share an endpoint, the outer
  one's endpoint moves **0.65 sp** (`:1850`, `:1880-1895`); two slurs meeting end to start each step
  0.2 sp sideways. ⚠️ `avoidCollisions` was not read line by line, so read this as "not found".

**`brokenSlurMaxRise`.**
- **MuseScore:** `continuedSlurMaxDiff` **2.5 sp** (`slurtielayout.cpp:65`), which clamps a BEGIN
  half's open end against its anchored end (`:266-270`).
- **Verovio:** no distance. Its bound is geometric: the open end is kept at the staff's own outer line
  (`std::max(staffTop, y2)` / `std::min(staffBottom, y2)`, `slur.cpp:926-935`, `:966-976`).
- **LilyPond:** no cap. The open end sits at the nearest note column's extent + 0.5 sp
  (`slur-scoring.cc:596-605`).

**`BROKEN_SLUR_MAX_SLOPE`.**
- **MuseScore:** no slope. When the system's first chord **is** the slur's end chord, the open end
  is pinned **0.25 sp** outward of the anchored end (`slurtielayout.cpp:165-167`, `:317-319`).
  Separately, style `angleHangingSlursAwayFromStaff` (default **false**, `styledef.cpp:608`) forces at
  least 1.0 sp of height difference when on (`:336-357`); that is a minimum, not a maximum.
- **LilyPond:** `max-slope` **1.1**, a penalty with factor 10. It still applies to broken halves:
  `slur-configuration.cc:494-498` and `:508-512` are not gated by `is_broken_`, unlike the three
  melodic terms at `:505`, `:516` and `:519`.
- **Verovio:** the ordinary `slurMaxSlope` **60°** covers every slur (`options.cpp:1483`,
  `slur.cpp:1142`), which is a slope of tan 60° ≈ **1.73**.

**Double sharp avoid point.**
- **LilyPond:** `Real xp = 0.0;` (`slur-scoring.cc:858`). The branches at `:865-877` handle FLAT,
  DOUBLE_FLAT, SHARP and NATURAL. `DOUBLE_SHARP_ALTERATION` exists (`lily/include/pitch.hh:100`) but has
  no branch, so a double sharp **falls through to 0**, the centre of `linear_combination`. LilyPond's
  effective value is therefore **0**, the same as ours. The same fall-through applies to any styled,
  parenthesised or restored accidental (`slur-scoring.cc:865-877`).
- **Verovio:** its Bravura data gives `accidentalDoubleSharp` **no cut-outs**
  (`verovio/data/Bravura.xml:345`), where the double flat has `cutOutNE`/`cutOutSE` (`:346-349`).
  Under Verovio's cut-out rule, a double sharp is its full rectangle.
- **MuseScore:** accidentals enter the slur's obstacle shape as boxes (research §4.2, "under a slur"
  row, `:1328-1356`).
- **The glyph:** Bravura's box is 0.988 wide, +0.508 / −0.5 tall (`fonts/bravuraMetrics.ts:136`),
  vertically symmetric.

### 3.2 Line numbers this document fixes

- `slurStemOvershoot`: `slurtielayout.cpp:710`/`:712` (plan §12.1 had the formula without a line).
- `continuedSlurMaxDiff`: `slurtielayout.cpp:65`, applied at `:266-270`.

## 4. What this repo draws today

### 4.1 The eight rows

- **`slurLift` 1.0 sp** — from the notehead centre (`getYs()`, `SlurRenderer.ts:140`), or from the stem
  tip at a stem-tip end. Also the base lift that `slurArticulationEndpoint` builds on
  (`SlurRenderer.ts:774-775`).
- **`slurStemOvershoot` 1.0 sp** — `reach = |stemTip − head| + overshoot`; the half-interval slide is
  `min(halfInterval, reach)` (`slurStemEndpoint.ts:188-189`).
- **`slurSlantMaxTravel` 1.0 sp** — past `SLUR_MAX_SLANT_DEG`, the lower end rises by
  `min(wanted, 1.0 sp)` (`slurSlantLimit.ts:57-61`).
- **`SLUR_ARCH_TILT` 0.25** — see §4.2.
- **`slurNestGap` 1.0 sp** — `nestLift = depth × 1.0 sp` (`SlurRenderer.ts:742`) is added to the
  **control height** `H` (`slurArchHeight.ts:70`), then scaled by the obstacle `fit`
  (`SlurRenderer.ts:446-450`). Its drawn effect is **+0.75 sp at the apex per level** (a cubic's apex
  is 0.75 × its control height). It is applied whether or not the inner slur actually reaches under
  the outer one. ⚠️ So it is **not a gap**, and the book and engine values in §5 row 4 measure
  something different.
- **`brokenSlurMaxRise` 2.0 sp** and **`BROKEN_SLUR_MAX_SLOPE` 0.5** — the two ceilings in
  `rise = min(wanted, length × 0.5, 2.0 sp)` (`brokenSlurTilt.ts:110`). The slope also caps the
  anti-tie floor (`:117`).
- **Double sharp 0** — `slurAccidentalPoint.ts:69`.

### 4.2 `SLUR_ARCH_TILT` 0.25 is geometry, not taste

`curveControlPoints` puts the controls at `p0.x + span/(cps.length+2)` and
`p1.x − span/(cps.length+2)` (`engrave/curves/curveInk.ts:65-71`, which is VexFlow's
`controlPointSpacing`, `curve.js:53-56`). With two controls that fraction is **1/4**.

`slurArchCps` sets `cps.y = H ± 0.25·dy·direction` (`SlurRenderer.ts:446-450`). The first control then
lands at `y0 + H·dir + dy/4`. That is exactly the chord's height at `x0 + span/4`, plus H. The second
control is likewise H above the chord at `x1 − span/4`. **A tilt of 0.25 is the value that puts both
controls vertically above the chord line**, which the renderer's own comment states: *"we target the
chord line at 25%/75% lifted by `BOW`"* (`SlurRenderer.ts:411-412`). The inventory's "(no citation)" is
true of `curveStyle.ts:337`, but the derivation is written in `SlurRenderer.ts`.

⚠️ **A coupling worth knowing about, recorded and not changed.** The console indent knob
(`slurShapeExperiment.ts:111`, default 0.25) moves the controls sideways through `cps.x` only. At any
indent f ≠ 0.25, the controls sit `(f − 0.25)·dy` off the chord line, because the tilt stays 0.25. For
the "vertically above the chord" reading to hold at every indent, the tilt would have to equal f.

### 4.3 Decided rows in the same family, not reopened

| row | pointer |
|---|---|
| `SLUR_ARCH_TILT_LIMIT` 0.693 | his hand; plan §"The lean could invert a control" |
| `SLUR_MAX_SLANT_DEG` 60 | his call, Verovio's default; plan Phase 6 |
| `slurHeightLimit` 2.0 / `SLUR_HEIGHT_RATIO` 0.25 | his call, LilyPond; `slurArchHeight.ts` header, plan Phase 2 |
| `curveFromHeader` 0 | his eye; plan Phase 5 §A |
| the accidental-as-one-point mechanism | his call; research §8.8 |
| the obstacle `fit` factor + `SLUR_EDGE_DISCOUNT_SPACES` | his call; research §8.6, plan Phase 8 |
| `tieLift`, `tieBow`, `tieEndpointInset` | his calls; plan §13 |

## 5. PRESET ROWS

The first row of each table is today's default. "Measures" names the quantity in the source's own
terms. Where it differs from what our constant measures, the difference is stated: a preset must
convert, not copy.

### 5.1 `slurLift` — endpoint ↔ its notehead centre (or stem tip)

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **1.0 sp** | head centre → endpoint | `curveStyle.ts:40` |
| Gould, stated minimum | 0.5 sp | head centre → endpoint, a floor | Gould p. 110–111 (PDF 130–131) |
| Gould plate (a), tie at head edge | ≈ 1.0 sp (±0.15) | head centre → stroke centre | Gould p. 111 (PDF 131), measured §2.1 |
| Gould plate (b), tie centred | 1.5 sp | head centre → stroke centre | Gould p. 111 (PDF 131), measured §2.1 |
| MuseScore | 0.9 sp | head centre → endpoint | `slurtielayout.cpp:613` |
| LilyPond | 0.5 sp past the head's **edge** (≈ 1.0 sp from the centre), +0.15 sp off a staff line | head extent → endpoint | `slur-scoring.cc:556-557` |
| Verovio | 0.625 sp past the head's **top** (≈ 1.125 sp from the centre) | drawing top → endpoint | `slur.cpp:1000`, `:1004` |
| VexFlow | 1.0 sp | `yShift` | `curve.js:23` |

### 5.2 `slurStemOvershoot` — how far past the stem tip the p. 111 slide may reach

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **1.0 sp** | stem tip → furthest slid endpoint | `curveStyle.ts:221` |
| MuseScore | 1.0 sp | far note − stem height − 1 sp | `slurtielayout.cpp:710`, `:712` |
| LilyPond | 1.0 sp past the note column's extent (search limit; or 4 sp from the base if further) | a candidate search window, scored | `slur-scoring.cc:497-503`; `layout-slur.scm:39` |

### 5.3 `slurSlantMaxTravel` — how far the slant ceiling may move an endpoint

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **1.0 sp** | lift of the lower end | `curveStyle.ts:170` |
| Verovio | unbounded (off) | — | `slur.cpp:567-596` |
| LilyPond | 4.0 sp | max endpoint travel from its base attachment (search window; slope is only penalised) | `layout-slur.scm:39`; `slur-scoring.cc:497-512` |

### 5.4 `slurNestGap` — the outer of two nested slurs

⚠️ Ours is a **control-height increment per level** (apex +0.75 sp per level). Every other row here is
a **clearance** measured against the inner slur. As a preset, those rows need a different mechanism,
not a different number.

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **1.0 sp / level** | added control height (≈ 0.75 sp at the apex) | `curveStyle.ts:121`; `SlurRenderer.ts:742` |
| Gould plate | 0.55–0.70 sp | white gap along the inner slur's middle (≈ 0.85 sp centre to centre) | Gould p. 113 (PDF 133), measured §2.3 |
| Gould plate, slur over a tie | 0.50–0.55 sp | white gap over the tie's first half | Gould p. 111 (b) (PDF 131), measured §2.1 |
| LilyPond | 0.8 sp | from the inner slur's midpoint, as an avoid point (PhrasingSlur only) | `layout-slur.scm:30`; `slur-scoring.cc:680-693`; `slur.cc:498-499` |
| Verovio, arch | 0.5 sp | outer control-point clearance over 5 samples of the inner slur | `options.cpp:1478-1480`; `adjustslursfunctor.cpp:769-805` |
| Verovio, endpoints | 0.75 sp | 1.5 × margin at the inner slur's start / middle / end | `adjustslursfunctor.cpp:837`, `:849`, `:861` |
| MuseScore | 0.65 sp | outer endpoint offset, **only** when the two slurs share an endpoint | `slurtielayout.cpp:1850`, `:1880-1895` |

### 5.5 `SLUR_ARCH_TILT` — how the two controls follow the chord

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **0.25** | controls vertically above the chord (= the control spacing 1/(cps+2)) | `curveStyle.ts:337`; derivation `curveInk.ts:65-71` + `SlurRenderer.ts:411-412`, §4.2 |
| VexFlow native | 0 | each control at its own endpoint's height + H | `curve.js:53-56` |
| indent-tracking | = the indent fraction f | keeps the controls on the chord at any indent | derived, §4.2 |
| rotated frame | not a ratio (height perpendicular to the chord, H·cosθ vertical) | a different shape | LilyPond `slur-configuration.cc:140-147`; Verovio `slur.cpp:1145-1155`; MuseScore research §4.2 |

### 5.6 `brokenSlurMaxRise` — the open end's furthest rise outward of its anchored end

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **2.0 sp** | open end vs anchored end | `curveStyle.ts:78` |
| MuseScore | 2.5 sp | `continuedSlurMaxDiff`, BEGIN half | `slurtielayout.cpp:65`, `:266-270` |
| Gould plate, largest drawn | 2.00 sp (on a 22.9 sp half) | stroke centre, open end vs anchored end | Gould p. 112 (PDF 132), half H, §2.2 |
| Verovio | the staff's own outer line (geometric, no distance) | — | `slur.cpp:926-935`, `:966-976` |
| LilyPond | none (open end = nearest column extent + 0.5 sp) | — | `slur-scoring.cc:596-605` |

### 5.7 `BROKEN_SLUR_MAX_SLOPE` — the open end's rise ÷ the half's length

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **0.5** | rise ÷ fragment length, hard cap | `curveStyle.ts:325` |
| Gould plate, steepest drawn | 0.48 (2.85 sp half), 0.46 (3.15 sp half) | rise ÷ length | Gould p. 112 (PDF 132), halves F, E, §2.2 |
| LilyPond | 1.1 | slope penalty (factor 10), still active on broken halves | `layout-slur.scm:36-37`; `slur-configuration.cc:494-498` |
| Verovio | 1.73 (60°) | hard slant cap for every slur | `options.cpp:1483` |
| MuseScore | a fixed 0.25 sp, not a slope | open end when the system's first chord is the end chord | `slurtielayout.cpp:165-167`, `:317-319` |

### 5.8 Double-sharp avoid point — where along its width a slur meets a `##`

| preset | value | measures | citation |
|---|---|---|---|
| **today** | **0** (centre, full box reach) | `linear_combination` fraction | `slurAccidentalPoint.ts:69` |
| LilyPond (effective) | 0 | its `xp` initialiser; `##` has no branch | `slur-scoring.cc:858`, `:865-877` |
| rectangle (Verovio: no cut-out; MuseScore: box) | whole width | the full box at every x | `verovio/data/Bravura.xml:345`; research §4.2 — ⚠️ the mechanism he retired on 2026-09-14 (research §8.8) |

## 6. UNKNOWN

- **A book number for any of the eight rows.** Gould pp. 110–113, Ross pp. 136–143, Gerou & Lusk
  pp. 121–125 and Stone pp. 35–39 state constraints only. Every value in §5 attributed to Gould is a
  **measurement of a drawing**, not a stated rule.
- **Deeper nesting.** Gould p. 113 draws one level. A second or third level's gap is UNKNOWN.
- **Gould p. 111 (a) endpoint**: ±0.15 sp, because the slur and tie ink merge within 0.3 sp of the
  end.
- **Feta's notehead half-height.** LilyPond's and Verovio's from-centre lifts assume Bravura's 0.5 sp.
  Not measured.
- **The double sharp's outline reach as a function of x.** Only the Bravura box was read. Whether an
  edge point would read better than the centre has no source.
- **MuseScore's nested-slur arch.** None found by grep. `avoidCollisions` (`slurtielayout.cpp:1029-1158`)
  was not read line by line.
- **Gedan and Wanske** — not on disk (research §7).

## Contradictions with existing comments or records (reported, not fixed)

1. `slurAccidentalPoint.ts:66-68` says the double sharp is *"NOT in LilyPond's table … OURS"*, and
   research §8.8 says the same. The table has no row for it, but LilyPond's own code gives `##` the same
   0 through its initialiser (`slur-scoring.cc:858`). So the value matches LilyPond's behaviour.
2. Research §5 row 8 lists LilyPond's lift as "0.5 sp" next to our from-centre 1.0. LilyPond's 0.5 is
   measured from the head's **edge**; from the centre it is about 1.0.
3. The inventory (§2 line 142) says `SLUR_ARCH_TILT` has "no citation". 0.25 is the control spacing
   1/(cps+2), and `SlurRenderer.ts:411-412` already says the controls target the chord line at 25%/75%.
   The indent experiment breaks that identity whenever f ≠ 0.25 (§4.2).
4. The inventory (§6 line 283) says `slurStemOvershoot` quotes "no MuseScore line". The line is
   `slurtielayout.cpp:710` (below: `:712`), and the value is 1.0 sp.
5. `curveStyle.ts:121` describes `slurNestGap` as a gap "so concentric slurs don't collide". It is a
   control-height increment (+0.75 sp at the apex), applied by nesting depth whether or not the inner
   slur is actually under the outer one.
