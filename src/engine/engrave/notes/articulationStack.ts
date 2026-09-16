/**
 * ⭐⭐ **HOW A COLUMN'S ARTICULATIONS STACK** — S9e of `docs/vexflow-removal-map.md`
 * (`Articulation.format`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **Each mark takes the next TEXT LINE on its side, and a mark that may not sit inside the staff
 * > skips past it.** A mark's step is its own height in staff spaces plus half a space, rounded to a
 * > half — UP while the stack is still inside the staff above (DOWN below), to the nearest outside.
 * > A mark that must not sit between the lines (`betweenLines` false) is pushed out until it clears
 * > the staff, counting from the note's outer head — past the stem when the stem points that way.
 * > The column widens by half of whatever the widest mark overhangs.
 *
 * The side's stacked height is the column's `topTextLine` (above) or `textLine` (below) — shared with
 * the annotations that run after this, and read by the tuplet (`../marks/tupletPlacement`).
 *
 * ## ⛔ What is NOT here
 *
 * - **Where the mark is drawn from its text line** — `Articulation.draw`'s placement (the snap to a
 *   line or a space, the initial offset) is still VexFlow's; see `rendering/EngravedArticulation`.
 * - **The ink** — `./articulation`.
 * - **Which side a mark goes on** — the note builder decides it and it arrives as `side`.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact: a stemless note counts as stem-UP; the stem's height is
 * counted whenever the note has a stem OBJECT (a whole note has one), and the width reduce starts
 * from the first mark.
 */

/** Which side of the note a mark stands on — VexFlow's `Modifier.Position` ABOVE/BELOW, or neither. */
export type ArticulationSide = 'above' | 'below' | 'other'

/** One articulation, as the rule needs it — the note's numbers travel with each mark. */
export interface StackedArticulation {
  side: ArticulationSide
  /** The mark's own height, px. */
  height: number
  /** The mark's own width, px. */
  width: number
  /** Whether the mark may sit between the staff lines (a staccato may; an accent, as VexFlow has it, may too). */
  betweenLines: boolean
  /** The note's head glyph width, px. */
  noteGlyphWidth: number
  /** `1` up, `-1` down — ⚠️ a note without a stem answers UP. */
  stemDirection: number
  /** The note's stem length in staff spaces, 0 when it has no stem object. */
  stemSpaces: number
  /** How many lines the note's staff has (5 when it has no stave yet). */
  staffLines: number
  /** The note's TOP head line and its BOTTOM head line (VexFlow's `getLineNumber(true / false)`). */
  topLine: number
  bottomLine: number
}

/** The column state the rule reads and writes. */
export interface ArticulationColumnState {
  leftShift: number
  rightShift: number
  textLine: number
  topTextLine: number
}

/** What a mark came out with. */
export interface PlacedArticulation {
  /** The text line it stands on — `null` for a mark on neither side, which the rule leaves alone. */
  textLine: number | null
  /** The origin VexFlow sets for its side (`setOrigin`), or `null`. */
  origin: readonly [number, number] | null
}

/** The air added to a mark's own height before its step is rounded, in staff spaces. */
export const ARTICULATION_STEP_MARGIN = 0.5

const UP = 1
const DOWN = -1

const roundToNearestHalf = (fn: (x: number) => number, value: number): number => fn(value / 0.5) * 0.5

/** Inside the staff: at or below line 5 above it, at or above line 1 below it. */
const isWithinLines = (line: number, side: 'above' | 'below'): boolean =>
  side === 'above' ? line <= 5 : line >= 1

const roundingFor = (line: number, side: 'above' | 'below'): ((x: number) => number) =>
  isWithinLines(line, side) ? (side === 'above' ? Math.ceil : Math.floor) : Math.round

/** ⭐ Every mark of one column — `placed[i]` answers `marks[i]` — and the column state after. */
export function stackArticulations(
  marks: readonly StackedArticulation[],
  before: ArticulationColumnState,
): { placed: PlacedArticulation[]; state: ArticulationColumnState } {
  const state = { ...before }
  const placed: PlacedArticulation[] = marks.map(() => ({ textLine: null, origin: null }))
  if (marks.length === 0) return { placed, state }

  let maxGlyphWidth = 0
  const step = (mark: StackedArticulation, line: number, side: 'above' | 'below') =>
    roundToNearestHalf(roundingFor(line, side), mark.height / 10 + ARTICULATION_STEP_MARGIN)

  marks.forEach((mark, i) => {
    maxGlyphWidth = Math.max(mark.noteGlyphWidth, maxGlyphWidth)
    const lines = mark.staffLines
    if (mark.side === 'above') {
      let noteLine = mark.topLine
      if (mark.stemDirection === UP) noteLine += mark.stemSpaces
      let increment = step(mark, state.topTextLine, 'above')
      const curTop = noteLine + state.topTextLine + 0.5
      if (!mark.betweenLines && curTop < lines) increment += lines - curTop
      placed[i] = { textLine: state.topTextLine, origin: [0.5, 1] }
      state.topTextLine += increment
    } else if (mark.side === 'below') {
      let noteLine = Math.max(lines - mark.bottomLine, 0)
      if (mark.stemDirection === DOWN) noteLine += mark.stemSpaces
      let increment = step(mark, state.textLine, 'below')
      const curBottom = noteLine + state.textLine + 0.5
      if (!mark.betweenLines && curBottom < lines) increment += lines - curBottom
      placed[i] = { textLine: state.textLine, origin: [0.5, 0] }
      state.textLine += increment
    }
  })

  const width = marks.map(m => m.width).reduce((max, w) => Math.max(w, max))
  const overlap = Math.min(
    Math.max(width - maxGlyphWidth, 0),
    Math.max(width - (state.leftShift + state.rightShift), 0),
  )
  state.leftShift += overlap / 2
  state.rightShift += overlap / 2
  return { placed, state }
}
