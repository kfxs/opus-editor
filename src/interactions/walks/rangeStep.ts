/**
 * ⭐ **Shift+←/→ — one step of a RANGE selection**, the way a text editor's Shift+arrow works (his ask,
 * 2026-09-29: *"if i go to the right of the first note we add … at the end, if we go back pull notes,
 * if i pass the selected note [going left] then we add from the beginning"*).
 *
 * A range has a FIXED end (the note the range began on) and a MOVING end (the head — `selectedNoteId`,
 * the note the arrows walk from). Each press moves the head one stop along the lane; the selection is
 * everything between the two. Moving the head back toward the fixed end shrinks the range, and moving
 * it past that end grows the range on the other side.
 *
 * ⭐ The fixed end is not stored: it is the end of the current selection FARTHEST from the head. On a
 * single note both ends are the head, so the first press decides the side — which is exactly how a
 * range that shrank back onto its first note grows the other way.
 *
 * Pure: indices into a lane's stops (`./graceStops`), no score, no state.
 */
export interface RangeStep {
  /** The fixed end's stop index. */
  anchor: number
  /** The moving end's new stop index. */
  head: number
}

/**
 * @param selected the lane indices of the selected notes (any order, repeats fine; -1s ignored)
 * @param head the moving end's index now
 * @returns null when the head would step off the lane — the range stays as it is
 */
export function rangeStep(
  selected: readonly number[], head: number, direction: 1 | -1, laneLength: number,
): RangeStep | null {
  const onLane = [...selected.filter(i => i >= 0), head]
  const lo = Math.min(...onLane), hi = Math.max(...onLane)
  const anchor = head >= hi ? lo : hi
  const next = head + direction
  if (next < 0 || next >= laneLength) return null
  return { anchor, head: next }
}
