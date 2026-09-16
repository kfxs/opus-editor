/**
 * ⭐⭐ **WHICH COLUMN EACH ACCIDENTAL OF A CHORD TAKES, AND WHERE THAT COLUMN STANDS** — S9d of
 * `docs/vexflow-removal-map.md` (`Accidental.format` + `Accidental.checkCollision` +
 * `Tables.accidentalColumnsTable`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **Signs that would touch go in different columns; signs far enough apart share one.** Two lines
 * > collide when they are less than 3 lines apart — 2½ when the upper one holds only flats, or only
 * > double sharps (a double sharp below also buys half a line). A run of colliding lines is laid out by
 * > a table chosen by its size and shape (the familiar 1-3-2 of a triad); seven or more repeat the
 * > shortest non-colliding pattern. Each column is as wide as its widest line.
 *
 * Lines are walked from the TOP down, and a line holding several signs (a unison with different
 * spellings) packs them side by side.
 *
 * ## ⛔ What is NOT here
 *
 * - **The gap from the notehead** — `rendering/accidentalPlacement` moves the whole stack to the armed
 *   row after this runs (`__accidentals`), and `rendering/ledgerAccidentalClearance` steps it out past
 *   a ledger line.
 * - **The ink** — `./accidental`.
 * - **Gould's column rule** — `rendering/chordAccidentalColumns` is ours and the FAN uses it; the
 *   ordinary chord still packs by THIS table. Switching it is a picture change, ⛔ not a port.
 *   The research is `docs/accidental-dot-research.md` A3/A4.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact, because tidying any of them moves a sign:
 * - the seven-or-more pattern search runs over the WHOLE chord, not the colliding run;
 * - the room a left-displaced head needs is the largest over every note of the column, and it
 *   shifts EVERY sign, including the first column's;
 * - a line's `line` is the note's staff line when its note has no stave, and a rounded y (which runs
 *   the other way up) when it has one — see {@link StackedAccidental.line}.
 */
import {
  ACCIDENTAL_LEFT_PADDING_PX, ACCIDENTAL_NOTEHEAD_PADDING_PX, ACCIDENTAL_SPACING_PX,
} from '@/engine/engrave/inheritedDefaults'

/** One sign, as the rule needs it. */
export interface StackedAccidental {
  /**
   * ⚠️ The line the rule sorts and compares by. Without a stave it is the note's key line (up is
   * larger); with one, VexFlow's `round(y / space × 2) / 2` of that key line's y (DOWN is larger) —
   * the adapter decides which, as `Accidental.format` did.
   */
  line: number
  /** VexFlow's accidental code: `'#'`, `'b'`, `'n'`, `'##'`, `'bb'`… */
  type: string
  /** The sign's own width, px. */
  width: number
  /** Room its note's left-displaced heads need past the note's own x shift, px (may be ≤ 0). */
  displacedRoom: number
}

/** A line of the chord as the layout sees it. */
interface LineMetric {
  line: number
  /** Every sign on it is a flat or a double flat. */
  flatLine: boolean
  /** Every sign on it is a double sharp. */
  dblSharpLine: boolean
  numAcc: number
  width: number
  column: number
}

type EndCase = 'a' | 'b' | 'secondOnBottom' | 'spacedOutTetrachord' | 'spacedOutPentachord'
  | 'verySpacedOutPentachord' | 'spacedOutHexachord' | 'verySpacedOutHexachord'

/**
 * ⭐ Which column (1 = nearest the note) each line of a colliding run takes, by the run's length and
 * shape — `Tables.accidentalColumnsTable`. `a`: the run's ends collide too; `b`: they do not.
 */
export const ACCIDENTAL_COLUMN_TABLE: Readonly<Record<number, Partial<Record<EndCase, readonly number[]>>>> = {
  1: { a: [1], b: [1] },
  2: { a: [1, 2] },
  3: { a: [1, 3, 2], b: [1, 2, 1], secondOnBottom: [1, 2, 3] },
  4: { a: [1, 3, 4, 2], b: [1, 2, 3, 1], spacedOutTetrachord: [1, 2, 1, 2] },
  5: {
    a: [1, 3, 5, 4, 2], b: [1, 2, 4, 3, 1],
    spacedOutPentachord: [1, 2, 3, 2, 1], verySpacedOutPentachord: [1, 2, 1, 2, 1],
  },
  6: {
    a: [1, 3, 5, 6, 4, 2], b: [1, 2, 4, 5, 3, 1],
    spacedOutHexachord: [1, 3, 2, 1, 3, 2], verySpacedOutHexachord: [1, 2, 1, 2, 1, 2],
  },
}

/** How close two lines may come before their signs collide, in lines. */
export const ACCIDENTAL_CLEARANCE = { default: 3, flatOrDoubleSharp: 2.5, doubleSharpBelow: 0.5 } as const

/** `Accidental.checkCollision`. */
function collides(line1: LineMetric, line2: LineMetric): boolean {
  let clearance = line2.line - line1.line
  let required: number
  if (clearance > 0) {
    required = line2.flatLine || line2.dblSharpLine ? ACCIDENTAL_CLEARANCE.flatOrDoubleSharp : ACCIDENTAL_CLEARANCE.default
    if (line1.dblSharpLine) clearance -= ACCIDENTAL_CLEARANCE.doubleSharpBelow
  } else {
    required = line1.flatLine || line1.dblSharpLine ? ACCIDENTAL_CLEARANCE.flatOrDoubleSharp : ACCIDENTAL_CLEARANCE.default
    if (line2.dblSharpLine) clearance -= ACCIDENTAL_CLEARANCE.doubleSharpBelow
  }
  return Math.abs(clearance) < required
}

/**
 * ⭐ Every sign of one column — `xShifts[i]` answers `accidentals[i]`, px LEFT of the note's modifier
 * start (VexFlow's `setXShift` value) — and the column's new left shift.
 */
export function stackAccidentals(
  accidentals: readonly StackedAccidental[],
  leftShiftBefore: number,
): { xShifts: number[]; leftShift: number } {
  const xShifts = accidentals.map(() => 0)
  const leftShift = leftShiftBefore + ACCIDENTAL_NOTEHEAD_PADDING_PX

  // Top line first. ⚠️ A stable sort, as `Array.prototype.sort` is.
  const order = accidentals.map((_, i) => i).sort((a, b) => accidentals[b].line - accidentals[a].line)

  const lines: LineMetric[] = []
  let maxExtra = 0
  for (const i of order) {
    const { line, type, width, displacedRoom } = accidentals[i]
    const prior = lines[lines.length - 1]
    let current: LineMetric
    if (!prior || prior.line !== line) {
      current = { line, flatLine: true, dblSharpLine: true, numAcc: 0, width: 0, column: 0 }
      lines.push(current)
    } else {
      current = prior
    }
    if (type !== 'b' && type !== 'bb') current.flatLine = false
    if (type !== '##') current.dblSharpLine = false
    current.numAcc++
    current.width += width + ACCIDENTAL_SPACING_PX
    maxExtra = Math.max(displacedRoom, maxExtra)
  }

  let totalColumns = 0
  for (let i = 0; i < lines.length; i++) {
    let noFurtherConflicts = false
    const groupStart = i
    let groupEnd = i
    while (groupEnd + 1 < lines.length && !noFurtherConflicts) {
      if (collides(lines[groupEnd], lines[groupEnd + 1])) groupEnd++
      else noFurtherConflicts = true
    }
    const at = (k: number) => lines[groupStart + k]
    const lineDifference = (a: number, b: number) => at(a).line - at(b).line
    const notColliding = (...pairs: [number, number][]) => pairs.every(([a, b]) => !collides(at(a), at(b)))
    const groupLength = groupEnd - groupStart + 1
    let endCase: EndCase = collides(lines[groupStart], lines[groupEnd]) ? 'a' : 'b'
    switch (groupLength) {
      case 3:
        if (endCase === 'a' && lineDifference(1, 2) === 0.5 && lineDifference(0, 1) !== 0.5) endCase = 'secondOnBottom'
        break
      case 4:
        if (notColliding([0, 2], [1, 3])) endCase = 'spacedOutTetrachord'
        break
      case 5:
        if (endCase === 'b' && notColliding([1, 3])) {
          endCase = 'spacedOutPentachord'
          if (notColliding([0, 2], [2, 4])) endCase = 'verySpacedOutPentachord'
        }
        break
      case 6:
        if (notColliding([0, 3], [1, 4], [2, 5])) endCase = 'spacedOutHexachord'
        if (notColliding([0, 2], [2, 4], [1, 3], [3, 5])) endCase = 'verySpacedOutHexachord'
        break
      default:
        break
    }

    if (groupLength >= 7) {
      let patternLength = 2
      let collisionDetected = true
      while (collisionDetected) {
        collisionDetected = false
        for (let line = 0; line + patternLength < lines.length; line++) {
          if (collides(lines[line], lines[line + patternLength])) {
            collisionDetected = true
            patternLength++
            break
          }
        }
      }
      for (let member = i; member <= groupEnd; member++) {
        const column = ((member - i) % patternLength) + 1
        lines[member].column = column
        totalColumns = totalColumns > column ? totalColumns : column
      }
    } else {
      for (let member = i; member <= groupEnd; member++) {
        // ⚠️ VexFlow indexes the table unguarded: a length-2 run whose ends do NOT collide cannot
        // happen (a run of two is two colliding lines), so `2.b` is absent there too.
        const column = ACCIDENTAL_COLUMN_TABLE[groupLength][endCase]![member - i]
        lines[member].column = column
        totalColumns = totalColumns > column ? totalColumns : column
      }
    }
    i = groupEnd
  }

  const columnWidths: number[] = []
  const columnXOffsets: number[] = []
  for (let c = 0; c <= totalColumns; c++) {
    columnWidths[c] = 0
    columnXOffsets[c] = 0
  }
  columnWidths[0] = leftShift + maxExtra
  columnXOffsets[0] = leftShift
  for (const line of lines) {
    if (line.width > columnWidths[line.column]) columnWidths[line.column] = line.width
  }
  for (let c = 1; c < columnWidths.length; c++) {
    columnXOffsets[c] = columnWidths[c] + columnXOffsets[c - 1]
  }
  const totalShift = columnXOffsets[columnXOffsets.length - 1]

  let accCount = 0
  for (const line of lines) {
    let lineWidth = 0
    const lastOnLine = accCount + line.numAcc
    for (; accCount < lastOnLine; accCount++) {
      const i = order[accCount]
      xShifts[i] = columnXOffsets[line.column - 1] + lineWidth + maxExtra
      lineWidth += accidentals[i].width + ACCIDENTAL_SPACING_PX
    }
  }
  return { xShifts, leftShift: totalShift + ACCIDENTAL_LEFT_PADDING_PX }
}
