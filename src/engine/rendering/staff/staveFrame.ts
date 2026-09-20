import type { EngravedNote } from '../engraved/EngravedNote'
import type { EngravedStave } from '../engraved/EngravedStave'
import type { BarFrame, StaffFrame } from '@/engine/engrave/staff/staffFrame'

/**
 * ⭐ **THE ONE PLACE a staff's lines are read off a VexFlow `Stave`** — S2 of
 * `docs/history/vexflow-removal-map.md`. Everything else asks the frame (`engrave/staff/staffFrame`).
 *
 * A SEAM, not a port: the three numbers are the stave's own, so no reader's answer changes.
 *
 * ⭐⭐ **TWO frames for one bar, and the reader picks by WHERE ITS INK GOES** (S4e):
 *
 * | the frame | the coordinates | for |
 * |---|---|---|
 * | {@link staveFrame} / {@link barFrame} / `signRun` | where the bar was BUILT | ink INSIDE the bar's group, and tier 1 building it |
 * | {@link placedStaffFrame} / {@link placedBarFrame} / `placedSignRun` | where the bar IS this render | ink drawn OUTSIDE every bar's group — the score-level passes |
 *
 * They differ for exactly one kind of bar: one whose shape did not change is REUSED, not re-engraved.
 * The renderer keeps its old `Stave` and moves the drawn group with `transform: translate(dx, dy)`
 * (`replaySnapshot`), so the stave's own numbers are where the bar was last PAINTED. Ink inside the group
 * rides the transform and must use those (`dynamicsLinePass`'s and `tempoLinePass`'s own notes say so);
 * ink outside it does not ride anything, and asks the placement — the plan for THIS render. ⛔ A reader
 * never corrects one into the other itself: that was `staleShift`, three copies of it and then one, and
 * the trap it guarded (*"the final bar … stolen from the first stave"*) is now a choice of frame.
 */
export function staveFrame(stave: EngravedStave): StaffFrame {
  return {
    topLineY: stave.getYForLine(0),
    spacePx: stave.getSpacingBetweenLines(),
    lineCount: stave.getNumLines(),
  }
}

/**
 * ⭐ **The frame of the staff a NOTE is on** — S2c. `undefined` while the note has no stave (not yet
 * laid out), which every reader already treats as "nothing to convert against".
 */
export function noteFrame(note: EngravedNote): StaffFrame | undefined {
  const stave = maybeStaveOf(note)
  return stave ? staveFrame(stave) : undefined
}

/** …for a reader that cannot run without one: it throws exactly where `Note.checkStave` did. */
export function requireNoteFrame(note: EngravedNote): StaffFrame {
  return staveFrame(staveOf(note))
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
export function barFrame(stave: EngravedStave): BarFrame {
  return {
    get x() { return stave.getX() },
    get width() { return stave.getWidth() },
    get noteStartX() { return stave.getNoteStartX() },
    get noteEndX() { return stave.getNoteEndX() },
  }
}

/**
 * What a placed frame is built from — satisfied by `MeasurePlacement`. `x`/`y`/`width` are where the bar
 * lands in the SVG this render; the stave is built at `x/scale, y/scale, width/scale` inside a `scale(k)`
 * group (`registerTier1`), so every answer below is in the staff's OWN space, like {@link staveFrame}'s.
 */
export interface PlacedBar {
  x: number
  y: number
  width: number
  scale: number
  stave: EngravedStave
}

/**
 * ⭐⭐ **Where the staff's lines are THIS render** — S4e. For ink drawn OUTSIDE the bar's group; see the
 * header for which frame a reader asks.
 */
export function placedStaffFrame(placement: PlacedBar): StaffFrame {
  const built = staveFrame(placement.stave)
  return { ...built, topLineY: built.topLineY + carriedBy(placement).dy }
}

/**
 * ⭐⭐ **Where the bar sits along its staff THIS render** — S4e, the horizontal half of
 * {@link placedStaffFrame}. The edges are the placement's own; the note area is the walk's answer
 * (a fact of the bar's SHAPE, which a reused bar shares by definition), carried to where the bar now is.
 * ⚠️ Read when read, for {@link barFrame}'s reason.
 */
export function placedBarFrame(placement: PlacedBar): BarFrame {
  const built = barFrame(placement.stave)
  return {
    get x() { return placement.x / placement.scale },
    get width() { return placement.width / placement.scale },
    get noteStartX() { return built.noteStartX + carriedBy(placement).dx },
    get noteEndX() { return built.noteEndX + carriedBy(placement).dx },
  }
}

/**
 * How far this render carried the bar from where its stave was built — zero for every bar tier 1
 * rebuilt (it built the stave at the placement's own `x/scale, y/scale`), non-zero for exactly the
 * reused, translated ones.
 *
 * ⚠️ **Private, and added rather than re-derived.** An answer is `stave's + carried` instead of
 * `placement's + (stave's − stave's origin)` so that a rebuilt bar adds an exact 0 and every number it
 * produced before S4e comes out bit-identical. ⚠️ Exported for `./signRun`'s placed run alone —
 * ⛔ a reader asks a placed frame, never this.
 */
export function carriedBy(placement: PlacedBar): { dx: number; dy: number } {
  const { stave, scale } = placement
  return { dx: placement.x / scale - stave.getX(), dy: placement.y / scale - stave.getY() }
}

/** The stave's own box — its x, its y, its width, and down to the room below its last line. */
export function staveBox(stave: EngravedStave): { x: number; y: number; width: number; height: number } | undefined {
  const box = stave.getBoundingBox()
  return box ? { x: box.x, y: box.y, width: box.w, height: box.h } : undefined
}

/**
 * ⭐ **Stand a note on a stave** — `note.setStave(stave)`. Since S12j-d3 both are ours, so this is a
 * plain call (it was the one cast across VexFlow's note API from S12h).
 */
export function standOn<N extends EngravedNote>(note: N, stave: EngravedStave): N {
  note.setStave(stave)
  return note
}

/** The stave a note stands on. */
export function staveOf(note: EngravedNote): EngravedStave {
  return note.checkStave()
}

/** The stave a note stands on, if any. */
export function maybeStaveOf(note: EngravedNote): EngravedStave | undefined {
  return note.getStave()
}
