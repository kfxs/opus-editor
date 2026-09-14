import type { Stave } from 'vexflow'
import type { BarFrame, StaffFrame } from '@/engine/engrave/staff/staffFrame'

/**
 * ⭐ **THE ONE PLACE a staff's lines are read off a VexFlow `Stave`** — S2 of
 * `docs/vexflow-removal-map.md`. Everything else asks the frame (`engrave/staff/staffFrame`).
 *
 * A SEAM, not a port: the three numbers are the stave's own, so no reader's answer changes. That
 * includes a REUSED bar's stave, which still reports where it was last painted — the frame carries the
 * same staleness, and the readers that correct for it ({@link staleShift}) keep doing so. ⏭️ When the
 * stave object goes (S4) this is built from the placement instead, and those corrections go with it.
 */
export function staveFrame(stave: Stave): StaffFrame {
  return {
    topLineY: stave.getYForLine(0),
    spacePx: stave.getSpacingBetweenLines(),
    lineCount: stave.getNumLines(),
  }
}

/**
 * ⭐ **Where the bar sits along its staff**, read off the stave — S2b. The horizontal half of
 * {@link staveFrame}, and a seam for the same reason.
 *
 * ⚠️ **Each field is read WHEN IT IS READ, ⛔ never copied up front.** `getNoteStartX()` formats the
 * stave as a side effect, and `applyLeadIn` overwrites the answer after the stave is built — so a
 * snapshot taken early would be wrong, and one taken by a reader that only wanted `x` would format a
 * stave nobody had finished building. The getters keep every read exactly where it was.
 */
export function barFrame(stave: Stave): BarFrame {
  return {
    get x() { return stave.getX() },
    get width() { return stave.getWidth() },
    get noteStartX() { return stave.getNoteStartX() },
    get noteEndX() { return stave.getNoteEndX() },
  }
}

/**
 * 🚨 **How far this render moved the bar since its stave was built** — the ONE copy of it (S2b; there
 * were three, in `./BarlineRenderer`, `./KeySignaturePass` and `./barlineGap`).
 *
 * A bar whose shape has not changed is REUSED rather than re-engraved: the renderer keeps the old
 * `Stave` object and moves the drawn group with a `transform: translate(dx, dy)` (`replaySnapshot`).
 * The stave's own numbers are therefore **where the bar was last PAINTED** — and a score-level pass
 * draws OUTSIDE that group, so nothing carries its ink along. The placement is the plan for THIS
 * render, so the difference between the two is what has to be added back.
 *
 * Zero for every bar that was re-engraved (the stave was built at the plan's own coordinates), and
 * non-zero for exactly the bars that were reused and translated. ⚠️ In the stave's OWN space — the
 * placement is SVG-space, hence the divide by its scale.
 */
export function staleShift(
  placement: { x: number; y: number; scale: number; stave: Stave },
): { dx: number; dy: number } {
  const { stave, scale } = placement
  return { dx: placement.x / scale - stave.getX(), dy: placement.y / scale - stave.getY() }
}

/** The stave's own box — its x, its y, its width, and down to the room below its last line. */
export function staveBox(stave: Stave): { x: number; y: number; width: number; height: number } | undefined {
  const box = stave.getBoundingBox()
  return box ? { x: box.x, y: box.y, width: box.w, height: box.h } : undefined
}
