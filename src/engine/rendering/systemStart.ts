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
import { THIN_BARLINE_PX } from './barlineInk'
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
  }
}

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
