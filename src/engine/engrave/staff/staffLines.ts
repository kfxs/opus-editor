/**
 * ⭐⭐ **THE STAFF'S OWN FIVE LINES, AS INK — P5a** (`docs/own-engraving-engine.md` P5).
 *
 * ## ⭐ What a staff line IS, as ink
 *
 * > A **horizontal bar** running the width of the stave, occupying `[y, y + thickness]` — downward
 * > from the line's own y, ⛔ never centred on it.
 *
 * That downward convention is not a choice made here; it is read off the second owner. See below.
 *
 * ## 🚨 Why this was worth a module: TWO OWNERS, TWO PRIMITIVES, AND THEY AGREE BY ACCIDENT
 *
 * | who draws a staff line | with what |
 * |---|---|
 * | `Stave.draw()` (VexFlow) | **strokes a path** at `y + 0.5`, at whatever width the context carries |
 * | `KeySignaturePass.drawOpenStaffTail` | **fills a rect** at `y`, `STAVE_LINE_WIDTH_PX` tall |
 *
 * ⭐ A 1px stroke centred on `y + 0.5` covers `[y, y + 1]`; a 1px `fillRect` at `y` covers `[y, y+1]`.
 * **They land in the same place** — which is why nobody ever noticed they are different drawings —
 * ⚠️ **but only because the thickness is exactly 1.** VexFlow's correction is
 * `lineWidth % 2 === 0 ? 0 : 0.5`, a canvas crispness idiom for ODD INTEGER widths; it is `0.5` for
 * *any* odd width and never becomes `w / 2`. ⇒ 🚨 **the day the thickness stops being 1, the two
 * owners come apart** — at Bravura's 0.13 sp (1.3 px) VexFlow would stroke `[y − 0.15, y + 1.15]`
 * while the tail fills `[y, y + 1.3]`.
 *
 * ⭐⭐ **So {@link staffLineStrokeY} derives the offset from the thickness itself** (`y + t/2`), which
 * is *numerically identical at t = 1* — P5a moves no pixel — and stays correct when the thickness
 * changes. ⛔ It does not CHANGE the thickness: that is an open question with a live disagreement
 * (Bravura 0.13 sp vs our 1 px = 0.1 sp) and it is HIS, exactly as `STAVE_LINE_WIDTH_PX`'s own comment
 * has said all along.
 *
 * ## ⭐ …and the second half of P5's brief, named
 *
 * The parent plan calls P5 *"the two-sets-of-numbers problem in its last hiding place"*. This module
 * is one of those pairs closed: the thickness that decides the STROKE OFFSET and the thickness
 * actually STROKED used to come from two places (VexFlow's `getStyle().lineWidth ?? 1` for the
 * former, the context's current `lineWidth` for the latter). Here they are one argument.
 *
 * ⛔ **No DOM, no vexflow** (`lint:boundary`).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * One staff line's ink — the bar it occupies, ⛔ not the path used to make it.
 *
 * ⚠️ `y` is the LINE's own y (what `Stave.getYForLine` answers), and the ink hangs DOWNWARD from it
 * by {@link thickness}. See the module header for where that convention is read from.
 */
export interface StaffLineInk {
  x: number
  y: number
  width: number
  thickness: number
}

/**
 * ⭐⭐ **THE MIDDLE OF A STAFF LINE'S INK** — the line's own y is the TOP of the bar, so its middle is
 * half a thickness below it.
 *
 * ⭐ **One expression, two readers, and naming it is what keeps them one rule.** A stroke is centred
 * on what it covers, so {@link staffLineStrokeY} IS this number; and a BARLINE stops at the middle of
 * the outer line it connects rather than at its edge, so `engrave/staff/barlineExtent` stops here
 * too. ⚠️ Those are different statements about the same point — ⛔ writing `y + t / 2` in the second
 * place would have been the "second owner" this module was extracted to prevent.
 */
export function staffLineMidY(y: number, thickness: number): number {
  return y + thickness / 2
}

/**
 * ⭐ **The BOTTOM of a staff line's ink** — its own y plus the thickness it hangs by.
 *
 * ⚠️ **The staff's outer edge, and ⛔ not where a BARLINE stops** — those are two different rules and
 * this module owns only the first. A mark FLUSH with the staff ends here (the brace and the bracket's
 * rod, `rendering/systemStart`); a barline stops half a thickness earlier, at
 * {@link staffLineMidY} (`./barlineExtent`, and LilyPond makes exactly this distinction).
 *
 * 🚨 It exists because VexFlow's `Stave.getBottomLineBottomY()` answers `y + (getStyle().lineWidth ??
 * 1)` — a hard **1** that was ITS staff-line thickness, not ours, from P5c onward.
 */
export function staffLineInkBottomY(y: number, thickness: number): number {
  return y + thickness
}

/**
 * ⭐ **Where to STROKE so the ink lands on `[y, y + thickness]`** — the centre of that bar.
 *
 * ⚠️ At `thickness = 1` this is `y + 0.5`, which is VexFlow's `lineWidthCorrection` exactly, so
 * nothing moves. ⛔ It is NOT a transcription of that expression — see the module header for why the
 * two stop agreeing above 1.
 */
export function staffLineStrokeY(y: number, thickness: number): number {
  return staffLineMidY(y, thickness)
}

/** Every visible line of one stave, as ink, given each line's own y. */
export function staffLinesInk(
  x: number,
  width: number,
  lineYs: readonly number[],
  thickness: number,
): StaffLineInk[] {
  return lineYs.map(y => ({ x, y, width, thickness }))
}

/**
 * ⭐ Stroke a run of staff lines.
 *
 * ⚠️ **It sets the line width itself**, from the same number that positioned the stroke — that is the
 * pair this module exists to collapse. The renderer used to pin the context's width before every
 * stave instead, because a preceding `Stem.draw()` leaves it at 1.5 and would otherwise thicken the
 * next staff; that pin is now this line, and it still runs before the stave's modifiers for the same
 * reason it did there.
 */
export function drawStaffLines(ctx: DrawContext, lines: readonly StaffLineInk[]): void {
  for (const line of lines) {
    ctx.setLineWidth(line.thickness)
    const y = staffLineStrokeY(line.y, line.thickness)
    ctx.beginPath()
    ctx.moveTo(line.x, y)
    ctx.lineTo(line.x + line.width, y)
    ctx.stroke()
  }
}

/**
 * ⭐ The same ink as a FILLED BAR, for the caller that already draws it that way — the open staff
 * tail under a cautionary key signature (`KeySignaturePass`), which continues these very lines past
 * the last barline.
 *
 * ⛔ Kept as a second entry point rather than being converted to a stroke: the tail is inside the key
 * signature's own group and a `<rect>` there is what ships today, while the stave's lines are read as
 * `g.vf-stave path` by the browser harness and the spacing census. ⭐ The POINT is that both now take
 * their y and their extent from this module, so the accident described in the header becomes an
 * agreement by construction.
 */
export function fillStaffLine(ctx: DrawContext, line: StaffLineInk): void {
  ctx.fillRect(line.x, line.y, line.width, line.thickness)
}

/**
 * ⭐⭐ **HOW THICK A STAFF LINE IS DRAWN — one owner, and it is OURS rather than VexFlow's default.**
 *
 * `Stave.draw()` used to stroke its five lines with whatever `lineWidth` the context happened to
 * carry, so this was pinned before every stave (a preceding stem leaves it at 1.5, which used to
 * thicken the next staff); since P5a {@link drawStaffLines} sets it from this number directly. ⭐ Named because a SECOND place needs the same answer: the open staff TAIL under a
 * cautionary key signature (`KeySignaturePass.drawOpenStaffTail`), which continues these very lines
 * past the last barline. A tail of a different weight is visible instantly.
 *
 * 🚨🚨 **CORRECTED 2026-09-01 — this used to read "SMuFL says 0.13", and SMuFL says NOTHING.**
 * `docs/staff-line-research.md` §5.1 checked the spec live: it defines `staffLineThickness` only as
 * *"expressed in staff spaces"* and publishes **no default**. ⭐ **0.13 is BRAVURA's own number**, and
 * calling it a standard promoted one font to one. ⚠️ And we are not an outlier: the field is
 * LilyPond **0.100** (our value exactly), MuseScore **0.11**, Verovio **0.0722**, Bravura **0.13** —
 * so 0.13 is the TOP of the range, ⛔ not its middle. ⭐ Gould's own engraved staves measure
 * **0.110–0.111 sp**, which is MuseScore's number.
 *
 * ⭐ **P5a moved it here, from `rendering/VexFlowRenderer`**, which is what the old ⏭️ note was
 * waiting for: the engine now draws the lines, so the number lives beside them.
 *
 * ## ✅ HIS DECISION, 2026-09-01: **GOULD — 0.11 staff spaces**
 *
 * > *"lets do gould"* — decision **A** of `docs/staff-line-research.md` §8, taken after the research.
 *
 * ⭐ **0.11 sp is what Gould's own engraved staves MEASURE** — four pages, nine staves, calibrated
 * against her own beam thicknesses (`staff-line-research.md` §3.1) — and it is MuseScore's
 * `Sid::staffLineWidth` exactly. ⛔ It is deliberately **not** Bravura's 0.13: no book states a
 * thickness at all (Ross p. 72 says why — on a plate it was *"controlled by the pressure exerted on
 * the tilting arbor plate"*), so the printed evidence beats the font here.
 *
 * ⚠️ **This is a DEFAULT, ⛔ not a law — his standing instruction with the same breath:** *"remember
 * in the future the user will be able to change this, we will be able to apply in general other
 * engraving rules… but for the moment the default is gould."* ⇒ ⭐ treat every number in this family
 * as **one house style's answer**, and ⛔ never write code that assumes it cannot move: the eventual
 * shape is a swappable set of engraving defaults, the direction `__beams.rule(…)` and
 * `__spacing.law(…)` already point in. See `project_engraving_defaults_are_a_house_style`.
 */
export const STAVE_LINE_WIDTH_PX = 0.11 * STAFF_SPACE_PX
