/**
 * ⭐⭐ **THE BARLINE THAT RUNS THROUGH THE GAP** — the piece of a continuous barline that belongs to
 * neither staff: the strokes crossing the space between one staff and the next one down.
 * P1 of docs/barline-join-plan.md.
 *
 * ## ⭐⭐ Why it is a MODULE and not a branch in `drawSign`
 *
 * 🚨🚨 **THE GAP SEGMENT MAY NOT BE DRAWN INSIDE `inStaffSpace`.** `BarlineRenderer.drawSign` paints
 * within a per-staff SCALE group, and a line crossing two staves belongs to neither — a 0.7 small
 * staff breaks it immediately (docs/small-staff-spacing.md's rule: a gap inside `scale(k)` must be
 * ÷ k). So this draws in SCORE space, which means it cannot live inside that call at all; the
 * per-staff sign keeps its own extent parameter (`SignStaff.topY/botY`) and is untouched by any of
 * this.
 *
 * ⭐ MuseScore takes the other road — the upper barline simply draws longer (`barline.cpp:284`) —
 * and it can, because it has no per-staff scale group to escape. LilyPond and Verovio both draw the
 * gap as its own thing, and so do we.
 *
 * ## ⭐⭐ THE LINES RUN THROUGH, THE DOTS DO NOT
 *
 * A repeat's dots stay on each staff and only its STROKES cross the gap — ours already
 * (docs/barline-types-plan.md §4.5, 3 of 3 engines) and confirmed in both sources: LilyPond makes
 * the `:` a literal-space replacement in the span glyph (`scm/bar-line.scm:1312`), Verovio's
 * `DrawBarLineDots` sits only inside the per-staff branch. ⇒ this pass draws `parts.strokes` and
 * ⛔ never `parts.dots`.
 */
import type { Score } from '@/types/music'
import { barlineSignParts, type BarlineSignKind } from '@/engine/layout/barlineSign'
import { barlineJoinsBelow } from '@/engine/models/barlineJoin'
import { staffIdAtIndex } from '@/engine/models/staffContent'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { dbg } from '@/utils/debug'
import type { BarlinePlacement } from './BarlineRenderer'
import { applyHiddenTreatment, type RenderAudience } from './hiddenElements'
import type { RenderPass } from './RenderPass'

/**
 * ⭐⭐ **THE GAP INK IS THE SCORE'S, NOT EITHER STAFF'S** — so its staff-space is the score's own
 * ({@link STAFF_SPACE_PX}) and it does **not** scale with a small staff.
 *
 * The question this settles has no other answer available: every part of a sign is stated in staff
 * spaces (thin 0.16, gap 0.32, thick 0.50), and between a size-1 and a size-0.7 staff there are two
 * staff-spaces and no third. ⭐ `VexFlowRenderer.drawSystemConnector` already decided it for the
 * line that joins the same two staves at the system's left edge — *"its width is deliberately NOT
 * scaled; a system bracket belongs to the system, not to either staff's ink"* — and that is
 * MuseScore's `Sid::scaleBarlines = false` in one sentence.
 *
 * ⚠️ **The visible consequence, on purpose:** a 0.7 staff draws its own line at 1.12 px while the
 * gap below it is 1.6 px. They share a LEFT EDGE (a plain sign's stroke sits at offset 0, which is
 * the boundary itself), so the join is continuous and the weight steps at the staff's edge.
 * `BarlineRenderer.drawSign`'s closing note names this as the day to revisit whether a per-staff
 * sign should scale at all; ⛔ until he decides that, this does not pre-empt it by scaling the gap.
 */
const GAP_SPACE = STAFF_SPACE_PX

/**
 * How far apart two staves' boundary x's may be and still be called one vertical line. Half a pixel
 * — below what a hinted stroke can express, so nothing that passes this can read as a kink.
 */
const X_AGREEMENT_PX = 0.5

/** Everything one gap segment is drawn from. `xAbove`/`xBelow` are in the SVG's own coordinates, as
 *  {@link BarlinePlacement.x} is — ⛔ never in a stave's local space, which is the one place the two
 *  staves genuinely disagree (they may be drawn at different scales). */
export interface BarlineGap {
  /** The staff whose gap-below this is. */
  above: BarlinePlacement
  /** The staff on the other side of that gap, at the same bar. */
  below: BarlinePlacement
  /** Where the sign stands on the upper staff, and on the lower one. Normally identical. */
  xAbove: number
  xBelow: number
  kind: BarlineSignKind
  /** Which end of the bar the sign was drawn at — only ever used to make the group's id unique,
   *  matching `BarlineRenderer`'s own ids. */
  side: 'end' | 'start'
  /**
   * ⭐⭐ **WHICH BAR THIS LINE ENDS — the identity a press on the gap ink resolves to**, or `null`
   * when the sign stands at no boundary at all.
   *
   * ⚠️ **Computed by the caller, because only that loop can.** A sign drawn at a bar's END ends that
   * bar; one drawn at its START is normally the boundary that ends the bar BEFORE it — but not
   * always, and the exceptions are exactly the two the drawing loop already distinguishes: a `|:`
   * DISPLACED past its own header stands inside the bar (`displacedRepeatX`), and a system-opening
   * `|:` stands at a line's left edge whose boundary lives at the end of the line above. ⛔ Neither is
   * a boundary a press may select, so both come through as `null` and register no hit box — the ink
   * is still drawn, it is simply not a barline you can click *here*.
   */
  endsMeasure: number | null
  audience: RenderAudience
}

/**
 * 🚨🚨 **WHERE THE STAFF'S LINES ACTUALLY ARE THIS RENDER**, in SVG coordinates.
 *
 * A reused bar keeps its old `Stave` and is moved with a transform, so everything the stave reports
 * is where it was last PAINTED ({@link BarlinePlacement.x}'s header, and the report that produced
 * it: *"the final bar … stolen from the first stave"*). The placement is this render's own plan, so
 * the difference between them is what has to be added back.
 *
 * ⚠️ **`drawSystemConnector` reads the stave directly and is still correct — ⛔ do not conclude that
 * this may.** Its exemption is a guard in the reuse decision: `if (multiStaff && plan.isFirstInLine)
 * return` sends a system's OPENING bar down the rebuild path, so a connector's two staves are always
 * freshly built. A gap segment is drawn at EVERY boundary, and a bar that is not first-in-line is
 * translated with its stale stave. That is exactly where the neighbour's shelter runs out.
 */
function lineY(p: BarlinePlacement, which: 'top' | 'bottom'): number {
  const dy = p.y / p.scale - p.stave.getY()
  const local = which === 'top' ? p.stave.getTopLineTopY() : p.stave.getBottomLineBottomY()
  return (local + dy) * p.scale
}

/**
 * **Draw the barline through one gap** — or decline, and say why.
 *
 * Three ways it declines, and none of them is a fallback:
 *  - the gap is not joined (the model said so, or there is no gap below this staff);
 *  - the two staves do not agree on where the sign stands, so there is no single vertical line to
 *    draw. ⭐ That is a real fact about the engraving, not a limitation papered over: a start repeat
 *    displaced past a header (`displacedRepeatX`) is positioned from THAT staff's own header ink, and
 *    two staves whose headers differ put their signs at different x. ⛔ Never split the difference —
 *    a guessing fallback gets believed.
 */
export function drawBarlineGap(pass: RenderPass, score: Score, gap: BarlineGap): void {
  const { above, below, xAbove, xBelow, kind, side, audience } = gap

  if (!barlineJoinsBelow(score, staffIdAtIndex(score, above.staffIndex), above.measureNumber)) return

  // ⚠️ Written as a NEGATED "they agree", ⛔ never as `> X_AGREEMENT_PX`: the lower staff may have
  // no answer at all (a header on one staff alone displaces one sign and not the other), and every
  // comparison with a NaN is false — so the `>` form would sail past the one case this guards.
  if (!(Math.abs(xAbove - xBelow) <= X_AGREEMENT_PX)) {
    dbg(`Barline gap below staff ${above.staffIndex} at bar ${above.measureNumber} NOT drawn: `
      + `the two staves put the sign at x=${xAbove.toFixed(1)} and x=${xBelow.toFixed(1)} — `
      + `there is no one vertical line to draw`)
    return
  }

  const top = lineY(above, 'bottom')
  const bottom = lineY(below, 'top')
  // Staves out of order, or overlapping: nothing to fill. Not an error — vertical culling can
  // present a system whose lower staff was never placed where this one expects it.
  if (!(bottom > top)) return

  const ctx = pass.context
  const parts = barlineSignParts(kind)
  const group = ctx.openGroup('stavebarline', `barline-gap-${above.measureNumber}-${above.staffIndex}-${side}`) as SVGGElement | undefined
  try {
    for (const stroke of parts.strokes) {
      ctx.fillRect(xAbove + stroke.x * GAP_SPACE, top, stroke.width * GAP_SPACE, bottom - top)
      // ⭐⭐ **EACH PIECE OF INK SAYS WHOSE IT IS** — `data-half`, `paintBarlineSign`'s rule and read
      // back by the same two selection highlights, so a `:||:`'s gap ink lights the half that was
      // clicked exactly as its staff ink does. Written by reading the group's last child back,
      // because a context's drawing calls return the context and not the node.
      group?.lastElementChild?.setAttribute('data-half', stroke.half)
    }
  } finally {
    // ALWAYS close: an open group swallows the whole rest of the render (`renderMeasure`'s note).
    ctx.closeGroup()
  }

  // ⭐⭐ **HINTED EXACTLY AS THE SIGN ABOVE IT IS, or the join is not one line.** `hintBarlines`
  // rounds a thin line onto the device-pixel grid; a composite sign opts out (`data-no-hint`)
  // because aligning one stroke of two would change its own white gap. The gap segment must make
  // the SAME choice as the staff strokes it continues — hinted for a plain line, opted out for a
  // composite one — or the two pieces of one stroke land on different sub-pixel phases and the join
  // reads as a step exactly where the eye is looking.
  if (group && kind !== 'plain' && kind !== 'invisible') group.dataset.noHint = '1'

  // ⭐ An invisible line is invisible in the gap too: TINTED for the editor, REMOVED for print
  // (`./hiddenElements`). Without this the one thing hiding is for would fail between the staves.
  if (group && kind === 'invisible') applyHiddenTreatment(group, audience)

  registerGapHit(pass, gap, xAbove, top, bottom, parts.strokes)
}

/**
 * ⭐⭐ **THE GAP INK, MADE CLICKABLE** — his ask, 2026-08-28: *"if the barline is join and i click on
 * in the empty space of the two staves i want to be able to select it too and move and do the normal
 * barline operations"*.
 *
 * ⭐ **Registered where it is DRAWN**, `registerRepeatStart`'s rule and for its reason: this is the
 * only place that knows both that the join is on and that the ink actually landed. So the entry's
 * existence IS the "is it there?" test, and an unjoined gap — or one this module declined — registers
 * nothing at all.
 *
 * ⚠️ **The box is the STROKES' span, ⛔ not the sign's full extent**: the dots never cross the gap
 * (see the header), so a box that reserved room for them would answer presses over blank paper.
 * `interactions/elements/barline.ts` pads it to a clickable size, exactly as it pads the staff ink's.
 */
function registerGapHit(
  pass: RenderPass,
  gap: BarlineGap,
  xAbove: number,
  top: number,
  bottom: number,
  strokes: readonly { x: number; width: number }[],
): void {
  if (gap.endsMeasure === null || strokes.length === 0) return
  const left = Math.min(...strokes.map(s => s.x))
  const right = Math.max(...strokes.map(s => s.x + s.width))
  pass.elementRegistry.add({
    type: 'barline-gap',
    measure: gap.endsMeasure,
    // ⭐ The staff ABOVE the gap — `barlineJoinBelow`'s own key, so a press here names the same gap
    // the join squares do.
    staff: gap.above.staffIndex,
    bbox: { x: xAbove + left * GAP_SPACE, y: top, width: (right - left) * GAP_SPACE, height: bottom - top },
  })
}
