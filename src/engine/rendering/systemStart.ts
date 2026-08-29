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
import { Element } from 'vexflow'
import type { Stave } from 'vexflow'
import type { Score } from '@/types/music'
import { THIN_BARLINE_PX } from './barlineInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { groupsAt } from '@/engine/models/staffGroups'
import {
  systemStartColumn, BRACKET_ROD_PROJECTION_SPACES, BRACKET_SERIF_INSET_SPACES,
  BRACKET_SERIF_WIDTH_SPACES, type PlacedSystemStartSign,
} from '@/engine/layout/systemStartColumn'
import type { RenderPass } from './RenderPass'
import { measureGroupKey } from './VexFlowRenderer'

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
  if (staffCount <= 1) return
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
    drawSystemConnector(pass, p, bottom)

    // ⭐ Then the GROUPING signs, standing to the left of it — innermost first, each already told
    //   where it goes by `layout/systemStartColumn` (the same numbers that bought the indent, so
    //   the ink and the room cannot disagree).
    for (const sign of systemStartColumn(groupsAt(score, p.measureNumber)).signs) {
      const top = byKey.get(measureGroupKey(p.measureNumber, sign.group.topStaffIndex))
      const bot = byKey.get(measureGroupKey(p.measureNumber, sign.group.bottomStaffIndex))
      if (!top || !bot) continue
      if (sign.group.symbol === 'bracket') drawBracket(pass, p, sign, top, bot)
    }
  }
}

/** The y a system-spanning sign starts at: the TOP staff's first line, in the SVG's space. */
function spanTopY(top: SystemStartPlacement): number {
  return top.stave.getYForLine(0) * top.scale
}

/** …and where it ends: the BOTTOM staff's last line, `+ 1` for that line's own thickness — the same
 *  hair {@link drawSystemConnector} adds, and for the same reason. */
function spanBottomY(bottom: SystemStartPlacement): number {
  return (bottom.stave.getYForLine(bottom.stave.getNumLines() - 1) + 1) * bottom.scale
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
  const el = new Element('systemStart.sign')
  el.setText(glyph)
  el.setFontSize(3 * STAFF_SPACE_PX * scale)
  el.renderText(ctx, x, y)
}

/**
 * ⭐⭐ **THE GROUPING SIGNS GET THEIR OWN GROUP, AND ⛔ NOT THE CONNECTOR'S `stavebarline`.**
 *
 * 🚨 `stavebarline` is a **COLLECTOR, not a label**, and four readers sweep it:
 * `barlineInk.inkBarlines` widens any thin rect in it · **`barlineInk.hintBarlines` snaps every rect
 * in it onto whole DEVICE PIXELS** · `e2e/harness.barlines()` counts them · and
 * `e2e/staffSize.e2e.ts` finds the connector as *the tall rect* in it.
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
  const topY = top.stave.getYForLine(0) * top.scale
  // `+ 1` for the bottom line's own thickness (`Tables.STAVE_LINE_THICKNESS`, what VexFlow adds
  // here), in that staff's ink and so at its scale — otherwise the line stops a hair short of the
  // staff it is joining.
  const bottomY = (bottom.stave.getYForLine(bottom.stave.getNumLines() - 1) + 1) * bottom.scale
  // The staves share an x (barlines align), and it is already in SVG coordinates on the
  // placement — no need to take the scaled staff's word for it.
  //
  // ⚠️ Drawn inside a `stavebarline` group ON PURPOSE, though VexFlow is not drawing it: that is
  // the handle `hintBarlines` collects, and a connector left outside it would be the one line of
  // the system still landing between pixels while every barline it joins is crisp.
  //
  // 🔎 ⚠️ **That group is a COLLECTOR, not a label** — `inkBarlines` widens any thin rect in it and
  // `hintBarlines` snaps every rect in it onto whole device pixels. ⛔ A future left-edge sign whose
  // WEIGHT is engraved (the bracket's rod, at Bravura's 0.5 spaces) must not be put here without
  // deciding that it wants to be pixel-snapped too — docs/braces-brackets-plan.md P3.
  ctx.openGroup('stavebarline')
  try {
    ctx.fillRect(top.x, topY, THIN_BARLINE_PX, bottomY - topY)
  } finally {
    ctx.closeGroup()
  }
}
