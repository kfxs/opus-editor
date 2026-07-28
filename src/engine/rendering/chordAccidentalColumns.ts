/**
 * ⭐⭐ **CHORD ACCIDENTALS — the columns they stack into, left of the noteheads.**
 *
 * The engraving rule (Gould, *Behind Bars*, "Chords with adjacent notes", pp. 87–91): accidentals
 * in a chord form vertical COLUMNS to the left of it, packed as compactly as they can be read. The
 * conventional zig-zag decides the order: the HIGHEST accidental takes the column nearest the
 * chord, the LOWEST the next one out, and the rest work inwards alternately — top, bottom,
 * next-top, next-bottom. Two accidentals far enough apart vertically share a column instead of
 * opening a new one, which is what keeps a seven-note chord from growing seven columns.
 *
 * ⚠️ **This module exists for the same reason {@link chordHeadDisplacement} does**: a `StaveNote`
 * gets all of it from `Accidental.format`, and a hand-drawn head gets none. Every fanned member's
 * sign was drawn at `headX - width - gap` — one x, so a member chord with two accidentals printed
 * them on top of each other.
 *
 * Pure arithmetic over lines and measured widths, like {@link FannedBeam}: it never touches a
 * context, which is what lets it be a unit test rather than a drawn position.
 *
 * ⛔ Not a re-implementation of VexFlow's `Accidental.format`. That one needs `Accidental`s attached
 * to `Note`s inside a formatter's `state`, and a fan member has neither — it is a head at a
 * coordinate. The ORDER is the same rule; the packing is the simplest thing that obeys it.
 */

/** One accidental to place: the staff line of the head it belongs to, and its measured glyph width. */
export interface ChordAccidentalItem {
  line: number
  width: number
}

/** Where each accidental goes, in the caller's order — plus the room the whole stack needs. */
export interface ChordAccidentalLayout {
  /** The LEFT x to draw each glyph at, one per input item. */
  xs: number[]
  /** How far left of `chordLeftX` the stack reaches, gap included — 0 when there are none. */
  width: number
}

/**
 * How far apart two accidentals must be to share one column: **a sixth** — 5 steps, and the line
 * grid counts a step as 0.5 (see `staffLineForSpelling`). Closer than that and a sharp's or a
 * natural's arms run into the one above it, which is why the interval, not the glyph height, is the
 * number the convention is stated in.
 */
export const MIN_SHARED_COLUMN_LINES = 2.5

/**
 * The order accidentals are PLACED in: highest first, then lowest, then working inwards. It is the
 * order alone that produces the conventional picture — the topmost sign ends up nearest the chord,
 * because it is the first one offered the nearest column.
 */
function zigzagOrder(items: ChordAccidentalItem[]): number[] {
  const byLine = items
    .map((item, index) => ({ line: item.line, index }))
    .sort((a, b) => b.line - a.line || a.index - b.index)
  const out: number[] = []
  let top = 0
  let bottom = byLine.length - 1
  while (top <= bottom) {
    out.push(byLine[top++].index)
    if (top <= bottom) out.push(byLine[bottom--].index)
  }
  return out
}

/**
 * Lay one chord's accidentals out into columns.
 *
 * `chordLeftX` is the left edge of the chord's INK — the leftmost notehead, which for a stem-down
 * chord containing a second is the displaced head and not the column. `gap` separates the first
 * column from the noteheads and each column from the next.
 */
export function chordAccidentalLayout(
  items: ChordAccidentalItem[],
  chordLeftX: number,
  gap: number,
): ChordAccidentalLayout {
  if (!items.length) return { xs: [], width: 0 }

  // Each accidental takes the RIGHTMOST column it fits in — nearest the chord is always preferred,
  // and a new column is opened only when every existing one already has a neighbour too close.
  const columns: number[][] = []
  const columnOf = items.map(() => 0)
  for (const i of zigzagOrder(items)) {
    let c = columns.findIndex(col =>
      col.every(j => Math.abs(items[j].line - items[i].line) >= MIN_SHARED_COLUMN_LINES),
    )
    if (c < 0) {
      columns.push([])
      c = columns.length - 1
    }
    columns[c].push(i)
    columnOf[i] = c
  }

  // A column is as wide as its widest glyph and every sign in it is RIGHT-aligned, so the column
  // reads as one vertical line of ink however the flats and sharps are mixed.
  const widths = columns.map(col => Math.max(...col.map(j => items[j].width)))
  const rightEdges: number[] = []
  let right = chordLeftX - gap
  for (const width of widths) {
    rightEdges.push(right)
    right -= width + gap
  }

  const xs = items.map((item, i) => rightEdges[columnOf[i]] - item.width)
  const last = columns.length - 1
  return { xs, width: chordLeftX - (rightEdges[last] - widths[last]) }
}

/** Just the room the stack needs to the left of the chord — for the passes that reserve it. */
export function chordAccidentalWidth(items: ChordAccidentalItem[], gap: number): number {
  return chordAccidentalLayout(items, 0, gap).width
}
