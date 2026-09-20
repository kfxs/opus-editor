/**
 * ⭐⭐ **WHERE EACH AUGMENTATION DOT OF A COLUMN STANDS** — S9c of `docs/history/vexflow-removal-map.md`
 * (`Dot.format`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **A dot sits in a SPACE.** A note on a line lifts its dot half a space — unless the note just
 * > above it (a second) already took that space, or the space was the last one a dot took, in which
 * > case it drops half a space instead. A note's dots start past any head displaced to the right, and
 * > a note's second dot on the same line (a unison) stands to the right of its first.
 *
 * The column's dots are walked from the TOP line down (`line` descending), which is what makes
 * "the note just above" well-defined.
 *
 * ## ⛔ What is NOT here
 *
 * - **The gap from the notehead** — `rendering/dotPlacement` moves every dot by the armed standoff
 *   after this runs (the `__dots` knob; `layout/dotGap`).
 * - **The ink** — `./augmentationDot`.
 * - **Which rule the books prefer for a chord's dots** — `docs/research/accidental-dot-research.md` B2 (Gould,
 *   Ross, Gerou & Lusk). This is VexFlow's rule, kept as it drew; the research is its preset menu.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact, because tidying either moves a dot:
 * - a REST's shift is ADDED to what it had, and it is the lift the note walked before it took (a rest
 *   never computes its own);
 * - a note's horizontal start is the largest of its dots' starts, and a zero start counts as
 *   "not yet seen" (`map[key] || shift`).
 * - the column's own right shift is never read for a stave note: the first dot always resets to its
 *   note's start. VexFlow's `Dot.format` reads it only for tablature, which this editor does not draw.
 */

/** One dot, as the rule needs it. */
export interface ColumnDot {
  /** The staff line of the head it belongs to (VexFlow's units: a space is a half). */
  line: number
  /** Identifies the NOTE it belongs to — two dots of one chord share it. */
  noteKey: string
  /** Whether that note is a rest. */
  isRest: boolean
  /** Where the note's dots start, px right of the head: the room a right-displaced head takes. */
  firstDotPx: number
  /** The dot glyph's own width, px. */
  width: number
  /** The dot's vertical shift before this rule, in staff spaces — ⚠️ a rest's is ADDED to. */
  shiftY: number
}

/** Where a dot ended up. */
export interface PlacedDot {
  /** px right of the note's modifier start. */
  xShift: number
  /** In staff spaces; negative is UP. */
  shiftY: number
}

/** The gap between two dots of one note on one line, px. `Dot.format`'s `dotSpacing`. */
export const UNISON_DOT_SPACING_PX = 1

/**
 * ⭐ Every dot of one column — `placed[i]` answers `dots[i]` — and how much room they take to the
 * right (the column's `rightShift` grows by `width`).
 */
export function stackDots(dots: readonly ColumnDot[]): { placed: PlacedDot[]; width: number } {
  const placed: PlacedDot[] = dots.map(d => ({ xShift: 0, shiftY: d.shiftY }))
  if (dots.length === 0) return { placed, width: 0 }

  const startOf = new Map<string, number>()
  for (const dot of dots) {
    startOf.set(dot.noteKey, Math.max(startOf.get(dot.noteKey) || dot.firstDotPx, dot.firstDotPx))
  }
  // Top line first. ⚠️ A stable sort, as `Array.prototype.sort` is.
  const order = dots.map((_, i) => i).sort((a, b) => dots[b].line - dots[a].line)

  let dotShift = 0
  let width = 0
  let lastLine: number | null = null
  let lastNote: string | null = null
  let lastIsRest = false
  let prevDottedSpace: number | null = null
  let halfShiftY = 0
  for (const i of order) {
    const { line, noteKey, isRest } = dots[i]
    if (line !== lastLine || noteKey !== lastNote) dotShift = startOf.get(noteKey)!
    if (!isRest && line !== lastLine) {
      if (Math.abs(line % 1) === 0.5) {
        halfShiftY = 0
      } else {
        halfShiftY = 0.5
        if (lastNote !== null && !lastIsRest && lastLine !== null && lastLine - line === 0.5) {
          halfShiftY = -0.5
        } else if (line + halfShiftY === prevDottedSpace) {
          halfShiftY = -0.5
        }
      }
    }
    placed[i].shiftY = isRest ? placed[i].shiftY + -halfShiftY : -halfShiftY
    prevDottedSpace = line + halfShiftY
    placed[i].xShift = dotShift
    dotShift += dots[i].width + UNISON_DOT_SPACING_PX
    width = dotShift > width ? dotShift : width
    lastLine = line
    lastNote = noteKey
    lastIsRest = isRest
  }
  return { placed, width }
}
