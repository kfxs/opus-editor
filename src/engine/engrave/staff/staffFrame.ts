/**
 * ⭐⭐ **WHERE A STAFF'S LINES ARE — the one module that does staff-line arithmetic.**
 * S2 of `docs/vexflow-removal-map.md`; rules 5 and 6 of `docs/own-engraving-engine.md` §0.3.
 *
 * Every "where is line n", "how big is a space", "which line is this y on" used to be asked of a
 * VexFlow `Stave` (`getYForLine`, `getSpacingBetweenLines`, `getYForNote`…) in two dozen files, and
 * the editor's registry answered the inverse with its own copy of the sum. A reader now asks a
 * {@link StaffFrame} through the functions below, and ⛔ never writes `top + line × space` itself.
 *
 * ## ⭐ The circle test (§0.4)
 *
 * *"If the staff were a circle, how many files would have to change?"* — the answer must be two: the
 * module that draws the staff and the one that places music on it. The straight staff's arithmetic
 * therefore lives HERE and nowhere else: {@link StaffFrame}'s fields are the straight staff's
 * description, and a reader that reached into them to do its own sum would be the third file.
 *
 * ## ⚠️ Line numbering — two conventions, both inherited, both stated here
 *
 * - A **staff line** counts from the TOP line, 0, downward, one per space — fractional lines are the
 *   spaces between ({@link staffLineY}, {@link staffLineAtY}). `Stave.getYForLine`'s numbering.
 * - A **note line** counts from the BOTTOM line of a five-line staff, 1, upward — `E4` in treble clef is
 *   1, `F5` is 5 ({@link noteLineY}). `Stave.getYForNote`'s numbering, and VexFlow's key lines'.
 *
 * ⚠️ All of it is in the stave's OWN space: a small staff's frame is not scaled, the group it is drawn
 * in is (`MeasurePlacement.scale`).
 */

/** A straight staff: its top line, its space, and how many lines it has. */
export interface StaffFrame {
  /** The TOP line's y — its own y, not its ink's middle (`./staffLines` owns the thickness). */
  readonly topLineY: number
  /** One staff space, in px of the stave's own space. */
  readonly spacePx: number
  /** How many lines are drawn — 5, or 0 for the ghosts' line-less staves. */
  readonly lineCount: number
}

/** The lines a note line is numbered against — `Stave.getYForNote`'s literal `5` (`stave.js:217`). */
const NOTE_LINE_STAFF_LINES = 5

/** The y of staff line `line`, counted from the top line (0) down; fractional lines are spaces. */
export function staffLineY(frame: StaffFrame, line: number): number {
  return frame.topLineY + line * frame.spacePx
}

/** The y of the BOTTOM line — the last of {@link StaffFrame.lineCount}. */
export function staffBottomLineY(frame: StaffFrame): number {
  return staffLineY(frame, frame.lineCount - 1)
}

/** ⭐ The inverse: which staff line (from the top, fractional) a y is on. Rule 5's one owner. */
export function staffLineAtY(frame: StaffFrame, y: number): number {
  return (y - frame.topLineY) / frame.spacePx
}

/** The y of NOTE line `line` — the bottom line of a five-line staff is 1 (`Stave.getYForNote`). */
export function noteLineY(frame: StaffFrame, line: number): number {
  return staffLineY(frame, NOTE_LINE_STAFF_LINES - line)
}

/**
 * The baseline of text row `row` above the staff — row 0 one space above the top line, each further
 * row a space higher (`Stave.getYForTopText`, whose `topTextPosition` is 1).
 */
export function textRowAboveY(frame: StaffFrame, row: number): number {
  return staffLineY(frame, -row - 1)
}
