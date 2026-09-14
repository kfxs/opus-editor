/**
 * ⭐⭐ **THE SIGNS AT A SYSTEM'S LEFT EDGE** — everything drawn to the left of, and joining, the
 * staves a system opens with. P1 of docs/braces-brackets-plan.md.
 *
 * Today that is exactly one member: the **systemic barline**, the vertical line joining a system's
 * top and bottom staves (the grand-staff look). ⏭️ The **brace** and the **bracket** join it here
 * (P3/P4 of the plan), which is why this module exists before either of them is drawn — the family
 * gets **ONE OWNER** the way the barlines did (`docs/barline-types-plan.md` §4.6), rather than the
 * second member arriving as a second slice in `VexFlowRenderer`.
 *
 * ⛔ **A new left-edge sign is a row in THIS module, never a `case` in the facade** (CLAUDE.md's
 * rule). What moved here is not only the drawing but the family's **selection rule** — *which*
 * system edges get a sign, and *when* under culling — because that is the part a second member
 * would otherwise have to copy.
 *
 * ## 🚨🚨 WHY THIS PASS MAY READ THE STAVE DIRECTLY, AND ALMOST NOTHING ELSE MAY
 *
 * A bar whose shape has not changed is **REUSED**: the renderer keeps the old `Stave` object and
 * moves the drawn group with a `transform`. Every score-level pass therefore has to take its
 * coordinates from the **placement** — this render's own plan — because the stave reports where the
 * bar *was last painted* (`BarlinePlacement.x`'s header; `rendering/barlineGap.ts`'s `staleShift`).
 *
 * ⭐ **This pass is the ONE exemption, and it is not a judgement call — it is a guard in the reuse
 * decision:**
 *
 * > `if (multiStaff && plan.isFirstInLine) return`
 *
 * sends a system's **opening bar** down the rebuild path, so the two staves a connector spans are
 * always freshly built and their staves are never stale. `barlineGap.ts` names this exemption from
 * the other side (*"⛔ do not conclude that this may"*) — ⚠️ **the two comments are one fact and
 * have to stay in step.** Everything drawn here stands at a system's opening bar and so inherits it;
 * ⛔ a left-edge sign that ever moved off that bar would lose the exemption with it.
 *
 * ## ⛔ Not inside `inStaffSpace`
 *
 * Every other pass outside a measure group belongs to ONE staff, so it can be drawn inside that
 * staff's own scale (`./staffScaleGroup`). These cannot: they run from the top staff's first line to
 * the bottom staff's last, and those two may be drawn at **different sizes**, so there is no single
 * scale to put them in. They speak the SVG's coordinates, composing each end through its own staff's
 * scale — the same rule, and the same reason, as `./barlineGap`.
 */
import type { Stave } from 'vexflow'
import { drawGlyph } from './glyphPainter'
import { compose, scaling, translation } from '@/engine/paint/Affine'
import { drawGroupOf } from './svgDrawGroup'
import type { Score } from '@/types/music'
import { THIN_BARLINE_PX, staffBarlineExtent } from './barlineInk'
import { STAVE_LINE_WIDTH_PX, staffLineInkBottomY } from '@/engine/engrave/staff/staffLines'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { groupsAt } from '@/engine/models/staffGroups'
import {
  systemStartColumn, SIGN_TO_BARLINE_SPACES, signOutwardReachSpaces,
  BRACKET_ROD_PROJECTION_SPACES, BRACKET_SERIF_INSET_SPACES,
  BRACKET_SERIF_WIDTH_SPACES, SUB_BRACKET_STROKE_SPACES, type PlacedSystemStartSign,
} from '@/engine/layout/systemStartColumn'
import { ENGRAVING_DEFAULTS } from '@/engine/fonts/bravuraMetrics'
import type { RenderPass } from './RenderPass'
import { measureGroupKey } from './VexFlowRenderer'
import { staveFrame } from './staveFrame'
import { staffBottomLineY, staffLineY } from '@/engine/engrave/staff/staffFrame'

/**
 * What this pass needs of a `MeasurePlacement`, declared **structurally** so the renderer that calls
 * it is not imported back by it — the shape `BarlineRenderer` and `PedalRenderer` already use.
 */
export interface SystemStartPlacement {
  measureNumber: number
  staffIndex: number
  stave: Stave
  /** SVG-space x of the bar's opening boundary. The staves of a system share it (barlines align),
   *  so it is taken from the placement rather than from either scaled stave. */
  x: number
  /** The staff's drawn scale — what composes this staff's own numbers into the SVG's space. */
  scale: number
  isFirstInLine: boolean
}

/**
 * **Draw the left-edge signs of every system this render put on the page.**
 *
 * @param staffCount how many staves the score has. ⭐ One staff is not a system: nothing here is
 *   drawn below two, which is also why a single-staff score sees no change from this module
 *   existing. (⏭️ Gould p. 516 says a single stave *in a full score* still takes both a bracket and
 *   a systemic barline — a P6 question, and ⛔ not a licence to relax this today.)
 * @param drawnKeys the measure-groups this render actually painted, or **`null` when culling is
 *   off** — in which case every placed system opens one. See {@link systemIsDrawn}.
 */
export function renderSystemStarts(
  pass: RenderPass,
  score: Score,
  placements: SystemStartPlacement[],
  staffCount: number,
  drawnKeys: Set<string> | null,
): void {
  if (staffCount < 1) return
  const byKey = new Map(placements.map(p => [measureGroupKey(p.measureNumber, p.staffIndex), p]))
  const bottomStaff = staffCount - 1

  for (const p of placements) {
    if (!p.isFirstInLine || p.staffIndex !== 0) continue
    const bottom = byKey.get(measureGroupKey(p.measureNumber, bottomStaff))
    if (!bottom) continue
    // A connector joins the TOP and BOTTOM staves of a system. Under vertical culling neither may be
    // on screen while the middle of the system is, so it is drawn whenever *any* staff of its
    // opening measure is — not when its own two endpoints happen to be.
    if (drawnKeys && !systemIsDrawn(p.measureNumber, staffCount, drawnKeys)) continue

    // ⭐⭐ **THE CONNECTOR NEEDS TWO STAVES; THE GROUPING SIGNS DO NOT** — his report, 2026-08-29:
    //   *"why the bracket and the brace not working on single staff score… it should work too."*
    //   ⛔ This whole pass used to return at `staffCount <= 1`, so a one-staff score got no sign
    //   either. A systemic barline JOINS staves and has nothing to join here; a bracket does not.
    //   ⭐ Gould p. 516: *"A score system of only one stave takes a square bracket as well as a
    //   systemic barline."*
    if (staffCount > 1) drawSystemConnector(pass, p, bottom)

    // ⭐ Then the GROUPING signs, standing to the left of it — innermost first, each already told
    //   where it goes by `layout/systemStartColumn` (the same numbers that bought the indent, so
    //   the ink and the room cannot disagree).
    for (const sign of systemStartColumn(groupsAt(score, p.measureNumber)).signs) {
      const top = byKey.get(measureGroupKey(p.measureNumber, sign.group.topStaffIndex))
      const bot = byKey.get(measureGroupKey(p.measureNumber, sign.group.bottomStaffIndex))
      if (!top || !bot) continue
      if (sign.group.symbol === 'bracket') drawBracket(pass, p, sign, top, bot)
      else if (sign.group.symbol === 'subBracket') drawSubBracket(pass, p, sign, top, bot)
      else drawBrace(pass, p, sign, top, bot)
      registerSignBox(pass, p, sign, top, bot)
    }
  }
}

/**
 * ⭐⭐ **THE SIGN'S HIT-BOX, IN SVG SPACE — registered from the PEN.**
 *
 * 🚨 His report, 2026-08-29: *"i'm not able to select bracket or brace… i should be able to click on
 * it and select."* P5 recorded selection as blocked because **`ElementRegistry.withScale` takes ONE
 * number** and the brace is drawn inside a NON-UNIFORM `scale(sx, sy)` — so a box filed through the
 * usual scaled path has no representation.
 *
 * ⭐ **The way round is to not go through it.** This function runs at the point of drawing, where the
 * sign's corners are already known in the SVG's own coordinates — the same numbers the `fillRect`
 * and the transform were built from. Nothing is scaled, so nothing needs unscaling.
 *
 * ⚠️ **A little wider than the ink, on purpose.** A brace is 0.89 sp of hairline curve and a
 * sub-bracket 0.10 sp of stroke; a box that hugged them would be unclickable. It is padded to the
 * sign's own COLUMN — the gap it keeps from the barline is dead space nothing else claims — which is
 * the `barlineInk` rule that *only ink is selectable* relaxed exactly where there is no rival ink.
 */
function registerSignBox(
  pass: RenderPass,
  at: SystemStartPlacement,
  sign: PlacedSystemStartSign,
  top: SystemStartPlacement,
  bottom: SystemStartPlacement,
): void {
  const leftX = at.x - sign.leftSpaces * STAFF_SPACE_PX
  // ⭐⭐ **THE INK'S extent, ⛔ not the SPAN's** — his report, 2026-08-29: *"in the brace the squares
  //   are good in position, but in the brackets the squares vertically are too close."* A bracket's
  //   serif reaches ~1.5 sp past each staff line, so a box that stopped at the line put the handle
  //   inside the ink — and left the serif itself unclickable. A brace is flush and reaches 0, which
  //   is why only the bracket looked wrong ({@link signOutwardReachSpaces}).
  const reach = signOutwardReachSpaces(sign.group.symbol) * STAFF_SPACE_PX
  const topY = spanTopY(top) - reach
  const bottomY = spanBottomY(bottom) + reach
  // Its own depth plus the clearance it keeps from whatever stands to its right.
  const width = (sign.depthSpaces + SIGN_TO_BARLINE_SPACES) * STAFF_SPACE_PX
  pass.elementRegistry.add({
    type: 'staffGroupSign',
    id: sign.group.group.id,
    measure: at.measureNumber,
    staff: sign.group.topStaffIndex,
    bbox: { x: leftX, y: topY, width, height: bottomY - topY },
  })
}

/** The y a system-spanning sign starts at: the TOP staff's first line, in the SVG's space. */
function spanTopY(top: SystemStartPlacement): number {
  return staffLineY(staveFrame(top.stave), 0) * top.scale
}

/**
 * …and where it ends: the BOTTOM staff's last line, plus that line's own thickness — the staff's
 * OUTER edge, which is where a mark flush with the staff stops.
 *
 * ⚠️⚠️ **⛔ NOT where {@link drawSystemConnector} stops, and the difference is a rule rather than an
 * oversight.** A brace or a bracket is flush with the STAFF (Ross p. 155); a barline — the systemic
 * connector included — stops at the MIDDLE of each outer line (`engrave/staff/barlineExtent`). So the
 * two differ by half a staff line at each end, exactly as they do in LilyPond, where a
 * `System_start_delimiter` spans the staff symbol's own extent while `calc-bar-extent` narrows.
 * 🚨 This used to add a hand-written `1` and say it was the same hair the connector added. It was —
 * and both were VexFlow's staff-line thickness rather than ours (P5c: 1.1 px).
 */
function spanBottomY(bottom: SystemStartPlacement): number {
  const last = staffBottomLineY(staveFrame(bottom.stave))
  return staffLineInkBottomY(last, STAVE_LINE_WIDTH_PX) * bottom.scale
}

/**
 * ⭐⭐ **THE SQUARE BRACKET** — a rod with a serif at each end. P3 of docs/braces-brackets-plan.md.
 *
 * | | | source |
 * |---|---|---|
 * | rod thickness | **0.50 sp** | Gould p. 516 + p. 21 and Ross p. 155 state it *identically*, and it is Bravura's own `bracketThickness`. ⛔ VexFlow's 0.30 is the outlier |
 * | rod extent | top staff-line → bottom staff-line | the serifs are what project past them |
 * | serif | `bracketTop` / `bracketBottom` at natural size | ⭐ the SAME two glyphs we already stamp as the winged repeat's tips (`BarlineRenderer.drawWing`) |
 *
 * ## ⏳ THE PROJECTION — a decision, and it is 1.18 sp rather than the books' ≈1.0
 *
 * ⚠️ **Two measurements that one uniform scale cannot both satisfy.** Gould's tip reaches **1.75 sp**
 * right of the rod's left edge and projects **0.99 / 1.05 sp** above the line (Ross: 0.90 / 1.04).
 * Bravura's `bracketTop` is **1.876 × 1.180 sp** — an aspect of 1.59 against her drawn 1.75. Scale it
 * to project 1.0 and the serif shrinks to 1.59 sp wide, *below* everything she draws.
 *
 * ⭐ **So the glyph is stamped at natural size and the projection is whatever its ink is** — the
 * argument the brace's own mechanism note makes: *a glyph is ink a type designer drew*, and scaling
 * it to hit one measurement distorts the relationship the designer set. 1.18 sp sits inside the
 * spread real engraving shows (Ross's larger schematics reach **1.35**), and three of the four
 * engines project further still (LilyPond 1.59, Verovio 1.47).
 * ⏳ **It is one call, in one place, if his eye disagrees.**
 *
 * ## ⏳ Both serifs, and that too is open
 *
 * Gould draws curved ends unconditionally; Ross says they are *"sometimes omitted entirely"*; and
 * Gould's own p. 518 figures draw a **TOP SERIF ONLY** (research §3.7). Both are drawn here, which is
 * her stated practice — ⏭️ the taste call is noted in the plan and is not settled by this code.
 */
function drawBracket(
  pass: RenderPass,
  at: SystemStartPlacement,
  sign: PlacedSystemStartSign,
  top: SystemStartPlacement,
  bottom: SystemStartPlacement,
): void {
  const ctx = pass.context
  if (!ctx) return
  // ⭐⭐ The rod runs PAST each outer staff line before its tip is stamped on the end — see
  //   {@link BRACKET_ROD_PROJECTION_SPACES}. ⛔ Not scaled: the projection is the SYSTEM's, like
  //   everything else here, and one sign may span two staves of different sizes.
  const project = BRACKET_ROD_PROJECTION_SPACES * STAFF_SPACE_PX
  const topY = spanTopY(top) - project
  const bottomY = spanBottomY(bottom) + project
  // ⛔ NOT scaled by either staff: `leftSpaces` came from `systemStartColumn`, which reserved the
  //   room in the SYSTEM's spaces for `drawSystemConnector`'s reason — a sign that spans two staves
  //   of different sizes has no staff whose scale it could take.
  const leftX = at.x - sign.leftSpaces * STAFF_SPACE_PX

  // ⭐ Its OWN group, ⛔ deliberately not the connector's `stavebarline` — see {@link SYSTEM_SIGN_GROUP}.
  ctx.openGroup(SYSTEM_SIGN_GROUP, `bracket-${sign.group.group.id}-m${at.measureNumber}`)
  try {
    ctx.fillRect(leftX, topY, sign.depthSpaces * STAFF_SPACE_PX, bottomY - topY)
    // The serifs spring from the rod's own top and bottom and hook RIGHT, over the systemic barline:
    // each glyph's box runs rightward from its origin (`left: 0, right: 1.876`) and outward from the
    // line it stands on (`up: 1.18` / `down: 1.18`), so the origin is simply the rod's corner.
    // ⭐⭐ The wings are stamped HALF A STAFF LINE INSIDE the rod's ends, so each overlaps its
    //   corner rather than perching on it — Verovio's `offset`, and the reason its two y expressions
    //   differ ({@link BRACKET_SERIF_INSET_SPACES}).
    const inset = BRACKET_SERIF_INSET_SPACES * STAFF_SPACE_PX
    const serifScale = BRACKET_SERIF_WIDTH_SPACES / glyphBox('bracketTop').right
    stampGlyph(ctx, BRACKET_SERIF.top, leftX, topY + inset, serifScale)
    stampGlyph(ctx, BRACKET_SERIF.bottom, leftX, bottomY - inset, serifScale)
  } finally {
    ctx.closeGroup()
  }
}

/**
 * ⭐⭐ **THE SUB-BRACKET — a hairline `[`, ⛔ NOT a thinner rod and ⛔ NOT a glyph.** P6 of
 * docs/braces-brackets-plan.md.
 *
 * The thin secondary sign grouping a subset inside a bracket — divisi strings under the section's
 * own bracket. 🚨 **SMuFL has no glyph for it**, so it is drawn: **three rectangles**, which is
 * exactly Verovio's `View::DrawSquareBracket` (`src/view_graph.cpp`) — one vertical stroke and two
 * arms, ⛔ never a closed outline.
 *
 * ⚠️ **It reads as a closed rectangle on Gould's plate because its open side abuts the main
 * bracket** — that is the shape confirmed off p. 509 Table 2, along with **square ends and NO
 * serifs**. ⛔ What that plate could NOT confirm is the WEIGHT: it is a miniature schematic at 9.0 px
 * per staff space, where a 0.10 sp stroke is under one pixel. The numbers are
 * {@link SUB_BRACKET_WIDTH_SPACES} and {@link SUB_BRACKET_STROKE_SPACES}, which carry their sources.
 *
 * ⭐ **The arms are a STAFF LINE thick**, thinner than the vertical — Verovio passes
 * `staffLineWidth` as its `horizontalThickness` while the vertical takes `subBracketThickness`. Two
 * different weights in one sign, which is why this is three rectangles and not a stroked path.
 *
 * ⛔ **Flush, like the brace**: the arms sit ON the outer staff lines. There is no projection to
 * decide — the sign has no terminal that reaches past them.
 */
function drawSubBracket(
  pass: RenderPass,
  at: SystemStartPlacement,
  sign: PlacedSystemStartSign,
  top: SystemStartPlacement,
  bottom: SystemStartPlacement,
): void {
  const ctx = pass.context
  if (!ctx) return
  const topY = spanTopY(top)
  const bottomY = spanBottomY(bottom)
  const leftX = at.x - sign.leftSpaces * STAFF_SPACE_PX
  const stroke = SUB_BRACKET_STROKE_SPACES * STAFF_SPACE_PX
  const arm = ENGRAVING_DEFAULTS.staffLineThickness * STAFF_SPACE_PX
  const width = sign.depthSpaces * STAFF_SPACE_PX

  ctx.openGroup(SYSTEM_SIGN_GROUP, `subbracket-${sign.group.group.id}-m${at.measureNumber}`)
  try {
    // The vertical, and the two arms reaching RIGHT toward the staves — Verovio's three rectangles.
    ctx.fillRect(leftX, topY - arm / 2, stroke, (bottomY - topY) + arm)
    ctx.fillRect(leftX, topY - arm / 2, width, arm)
    ctx.fillRect(leftX, bottomY - arm / 2, width, arm)
  } finally {
    ctx.closeGroup()
  }
}

/**
 * ⭐⭐ **THE PIANO BRACE** — P4b of docs/braces-brackets-plan.md.
 *
 * | | | source |
 * |---|---|---|
 * | **flush**, top staff-line to bottom staff-line, ⛔ NO overshoot | | Ross p. 155 *stated*, and measured in **all six examples to within 0.15 sp** (research §3.4). ⭐ Agrees with MuseScore and LilyPond, both of which give the brace **zero** overshoot |
 * | **depth CONSTANT** at {@link BRACE_DEPTH_SPACES} | 0.89 sp | Gould p. 331 Table 1 measured **0.89 / 0.89 / 0.84** for 2/3/4 staves — flat |
 * | cusp at the exact vertical midpoint | | measured |
 *
 * 🚨 **IT STRETCHES ONLY IN Y, AND SMuFL SAYS THE OPPOSITE.** The spec instructs that a brace *"should
 * be scaled proportionally (i.e. in both dimensions, not only in the vertical dimension)"* — **and
 * her engraving does not**: a proportional scale would have widened the four-staff brace by half
 * again, and Gould's is *narrower* than her two-staff one. ⭐ **The scan beats the sentence**, for the
 * fourth time in this repo. **Four independent confirmations** (§3.4): Gould measured · Ross stated ·
 * Verovio a flat 1.0 sp in code · **Finale exactly 1.00 sp across 99 real files, with no per-group
 * width field to vary it.** ⛔ Against: only MuseScore's `magx` and LilyPond's 576-glyph ladder.
 *
 * ## ⚠️ THE MECHANISM: a NON-UNIFORM transform, which nothing else in this renderer draws
 *
 * A y-only stretch at a constant depth is `scale(sx, sy)` with **sx ≠ sy** — roughly `scale(2.6, 3.6)`
 * for a two-staff brace. ⛔ `Element.setFontSize` scales uniformly and `./staffScaleGroup` is
 * deliberately uniform-only, so this opens its own group and writes the transform.
 *
 * 🚨 **AND IT COSTS THE HIT-BOX.** `ElementRegistry.withScale` takes ONE number, so **under a
 * `scale(sx, sy)` group a box has no representation**. ⏭️ When P5 makes the sign selectable, the
 * brace's box must be computed in SVG space and registered OUTSIDE this transform — ⛔ it is not the
 * free `ELEMENT_SPECS` row the plan's P5 assumes.
 *
 * ⏳ **Which VARIANT is decision 6 and is still open** — `braceSmall` is the WIDEST (0.412 sp) and
 * `braceFlat` the narrowest (0.224), the name saying which SPAN it is for, so a taller brace wants a
 * narrower drawing: the x-scale back to 0.89 sp then thins the stroke less. This draws plain `brace`
 * until his eye has seen the ladder.
 */
function drawBrace(
  pass: RenderPass,
  at: SystemStartPlacement,
  sign: PlacedSystemStartSign,
  top: SystemStartPlacement,
  bottom: SystemStartPlacement,
): void {
  const ctx = pass.context
  if (!ctx) return
  // ⭐ FLUSH: the brace's ink runs exactly line to line, so ⛔ no projection term here — unlike the
  //   bracket, whose rod passes the line before its wing caps it.
  const topY = spanTopY(top)
  const bottomY = spanBottomY(bottom)
  const box = glyphBox('braceLarge')

  // The glyph's ink, at the natural size {@link stampGlyph} draws it: `right - left` wide and `up`
  // tall, in staff spaces. The two scales are what take that to the depth and span we want.
  const sx = sign.depthSpaces / (box.right - box.left)
  const sy = (bottomY - topY) / (box.up * STAFF_SPACE_PX)
  const leftX = at.x - sign.leftSpaces * STAFF_SPACE_PX

  const group = drawGroupOf(
    ctx.openGroup?.(SYSTEM_SIGN_GROUP, `brace-${sign.group.group.id}-m${at.measureNumber}`))
  try {
    // ⭐ The glyph is stamped at the ORIGIN and the group carries everything: the origin sits at the
    //   ink's BOTTOM-left (`down: 0`, so the ink rises from the baseline), which is the bottom of the
    //   span. `-box.left` puts the ink's own left edge on `leftX` rather than the glyph's origin.
    // ⭐ Scale THEN translate — `compose(p, q)` is "p then q", which is the order the SVG attribute
    //   `translate(...) scale(...)` reads in (the translation applies to already-scaled ink).
    group?.setPlacement(compose(
      scaling(sx, sy),
      translation(leftX + (-box.left) * STAFF_SPACE_PX * sx, bottomY)))
    stampGlyph(ctx, BRACE_GLYPH, 0, 0)
  } finally {
    ctx.closeGroup?.()
  }
}

/**
 * ⭐⭐ **`braceLarge` — U+F401, and the choice is MEASURED, not a taste call.**
 *
 * Decision 6 of docs/braces-brackets-plan.md was *"which of the five variants, and at what height"*,
 * and the plan expected to settle it by his eye on a rendered ladder. ⭐ **It did not have to be**:
 * all five were drawn at our own grand-staff span and their stroke profiles measured against
 * **Gould p. 331's engraved brace, measured off the scan at 450 dpi** (20.25 px per staff space):
 *
 * | variant | drawn depth | tip | belly 25% | **cusp** | belly 75% | mean err |
 * |---|---|---|---|---|---|---|
 * | `brace` | 0.850 | 0.175 | 0.487 | **0.200** | 0.475 | 0.0337 |
 * | `braceSmall` | 0.887 | 0.163 | 0.537 | 0.312 | 0.537 | 0.0661 |
 * | ✅ **`braceLarge`** | **0.887** | 0.175 | 0.475 | **0.163** | 0.463 | **0.0262** |
 * | `braceLarger` | 0.875 | 0.188 | 0.388 | 0.125 | 0.375 | 0.0530 |
 * | `braceFlat` | 0.875 | 0.138 | 0.175 | 0.087 | 0.175 | 0.1322 |
 * | **GOULD** | **0.889** | **0.148** | **0.444** | **0.148** | **0.494** | — |
 *
 * 🚨 **His question was *"is the thickness of the brace correct?"*** and it was not: stamping plain
 * `brace` put the **cusp 35% over** Gould's (0.200 against 0.148) and the tips 27% over, while the
 * bellies matched. ⭐ That is exactly the distortion this plan predicted before the code existed —
 * *"the cusp and the tips, where the curve runs horizontally, thicken with the stretch"* — and the
 * five variants are what SMuFL provides to absorb it. `braceLarge` takes the cusp to 0.163 and the
 * drawn depth to 0.887 against her 0.889.
 *
 * ⭐ **And the choice is SPAN-INDEPENDENT, which falls out of the constant-depth rule**: `sx` is
 * always `BRACE_DEPTH_SPACES ÷ the glyph's own ink width`, so the horizontal stroke profile above
 * never changes with how tall the brace is. ⛔ Unlike MuseScore, which picks by staff count
 * (2 → `brace`, 3 → `braceLarge`) — but its mapping is paired with its own widening `magx`, a
 * different construction, and we are matching her plate rather than its policy.
 *
 * ⚠️ What DOES grow with the span is the stroke weight measured VERTICALLY — the cusp and tips
 * scale with `sy`. ⏭️ If a very tall brace ever looks wrong, that is the axis to measure, and the
 * ladder above is the method.
 *
 * ## 🚨🚨 THE DEPTH IS RIGHT BY THIS GLYPH'S PROPERTY, ⛔ NOT BY CONSTRUCTION
 *
 * `sx` is `BRACE_DEPTH_SPACES ÷ (box.right − box.left)`, which assumes the reported ink box is what
 * the font actually renders. **For `brace` it is not**: asking for 0.89 draws **0.85**, a 4.5%
 * shortfall — measured, and stable across ink thresholds from <100 to <250, so ⛔ not an artifact of
 * where the black cut-off was put. `braceLarge`'s box matches its ink, and the same arithmetic lands
 * on **0.887** against Gould's 0.889.
 *
 * ⚠️ ⛔ **So a future variant change silently moves the DEPTH as well as the weight**, and the
 * constant will still read 0.89 while the page says otherwise. ⇒ **re-measure the drawn ink after any
 * change here** — render the brace large, threshold it, and check the width against
 * {@link BRACE_DEPTH_SPACES}. The ladder above is the same procedure and takes a minute.
 *
 * ⭐ Written as an escape for `BarlineRenderer`'s reason: a private-use character is invisible in
 * every editor and diff, so the source has to say which one it is.
 */
const BRACE_GLYPH = '\uF401'

/** `bracketTop` / `bracketBottom` — ⭐ the very glyphs the winged repeat already stamps
 *  (`BarlineRenderer`'s `WING_GLYPHS.right`), written as escapes for that file's reason: a
 *  private-use character is invisible in every editor and diff. */
const BRACKET_SERIF = { top: '\uE003', bottom: '\uE004' } as const

/**
 * One glyph at its NATURAL size, in the SYSTEM's spaces.
 *
 * `3 × space` is {@link drawnFontSize}'s arithmetic and `BarlineRenderer.drawWing`'s: a SMuFL em is
 * 4 staff spaces and VexFlow reads a bare font size as POINTS at 4/3 px each, so 3 × space draws the
 * glyph at exactly one staff's height. ⛔ `STAFF_SPACE_PX` rather than a staff's own — these signs
 * belong to the system.
 */
function stampGlyph(
  ctx: RenderPass['context'], glyph: string, x: number, y: number, scale = 1,
): void {
  drawGlyph(ctx, 'systemStart.sign', glyph, x, y, 3 * STAFF_SPACE_PX * scale)
}

/**
 * ⭐⭐ **THE GROUPING SIGNS GET THEIR OWN GROUP, AND ⛔ NOT THE CONNECTOR'S `stavebarline`.**
 *
 * 🚨 `stavebarline` is a **COLLECTOR, not a label**, and three readers sweep it:
 * **`barlineInk.hintBarlines` snaps every rect in it onto whole DEVICE PIXELS** ·
 * `e2e/harness.barlines()` counts them · and `e2e/staffSize.e2e.ts` finds the connector as *the tall
 * rect* in it. (⭐ A fourth, `barlineInk.inkBarlines`, widened any thin rect in it until P5b made
 * every barline draw at its own weight — 2026-09-13.)
 *
 * ⭐ **The second is the engraving reason.** Hinting exists because a HAIRLINE at different
 * sub-pixel phases looks like a different line — measured, on 1.6 px barlines. A bracket's rod is
 * **0.50 sp**, a number four sources state identically; rounding it to a whole device pixel at every
 * zoom would overrule all four for a crispness a 5 px rod has no need of. ⇒ the rod keeps its weight
 * and stays out of the collector.
 *
 * ⭐ The connector STAYS in `stavebarline` for the opposite reason: it *is* barline-weight, and it
 * has to read continuous with the lines it joins.
 */
const SYSTEM_SIGN_GROUP = 'systemsign'

/** Is any staff of this measure being painted? (The system connector's own two staves may both be
 *  culled while the system is on screen — see {@link renderSystemStarts}.) */
function systemIsDrawn(measureNumber: number, numStaves: number, drawnKeys: Set<string>): boolean {
  for (let s = 0; s < numStaves; s++) {
    if (drawnKeys.has(measureGroupKey(measureNumber, s))) return true
  }
  return false
}

/**
 * The single vertical line joining a system's top and bottom staves (the grand-staff look).
 *
 * ⛔ **Drawn by hand rather than with `StaveConnector`, and this is the one place in
 * docs/staff-size-plan.md §4.3 where that is the answer.** See this module's header for why it
 * cannot live inside `inStaffSpace`.
 *
 * The line itself is what VexFlow's `singleLeft` draws — `fillRect(x, topY, 1, height)`
 * (staveconnector.js:70, :144) — so nothing is lost by drawing it: it is a rectangle, not an
 * engraved glyph. Its width is deliberately NOT scaled; a system bracket belongs to the system,
 * not to either staff's ink. It takes the same {@link THIN_BARLINE_PX} the barlines it joins do,
 * so the join and the lines it joins read as one continuous stroke.
 */
function drawSystemConnector(
  pass: RenderPass, top: SystemStartPlacement, bottom: SystemStartPlacement,
): void {
  const ctx = pass.context
  if (!ctx) return
  // ⭐⭐ **The same extent the barlines it joins have** — top line's MIDDLE to bottom line's MIDDLE
  // (`engrave/staff/barlineExtent`), each in its own staff's ink and so at its own scale.
  // 🚨 This used to add a hand-written `+ 1` for "the bottom line's own thickness", naming
  // `Tables.STAVE_LINE_THICKNESS` — VexFlow's number, and a SECOND copy of the one
  // `Stave.getBottomLineBottomY()` adds. Both stopped being ours when P5c made a staff line 1.1 px.
  const topY = staffBarlineExtent(staveFrame(top.stave)).topY * top.scale
  const bottomY = staffBarlineExtent(staveFrame(bottom.stave)).bottomY * bottom.scale
  // The staves share an x (barlines align), and it is already in SVG coordinates on the
  // placement — no need to take the scaled staff's word for it.
  //
  // ⚠️ Drawn inside a `stavebarline` group ON PURPOSE, though VexFlow is not drawing it: that is
  // the handle `hintBarlines` collects, and a connector left outside it would be the one line of
  // the system still landing between pixels while every barline it joins is crisp.
  //
  // 🔎 ⚠️ **That group is a COLLECTOR, not a label** — `hintBarlines` snaps every rect in it onto
  // whole device pixels. ⛔ A future left-edge sign whose
  // WEIGHT is engraved (the bracket's rod, at Bravura's 0.5 spaces) must not be put here without
  // deciding that it wants to be pixel-snapped too — docs/braces-brackets-plan.md P3.
  ctx.openGroup('stavebarline')
  try {
    ctx.fillRect(top.x, topY, THIN_BARLINE_PX, bottomY - topY)
  } finally {
    ctx.closeGroup()
  }
}
