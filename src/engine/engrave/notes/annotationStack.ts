/**
 * ⭐⭐ **HOW A COLUMN'S TEXT ANNOTATIONS STACK** — S9f of `docs/history/vexflow-removal-map.md`
 * (`Annotation.format`, MIT, transcribed). In this editor the only annotations are the DYNAMICS
 * (`rendering/marks/dynamics/DynamicsLayout.buildDynamicAnnotation`).
 *
 * ## ⭐ What the rule IS
 *
 * > **A text takes the next text line on its side — and one that would still sit inside the staff is
 * > moved clear of it first.** Its height is its font size plus 2 px, in staff spaces. Counting from
 * > the note's outer head (past the stem when the stem points that way): above, if the stack so far
 * > would still sit below the staff's top, the text jumps to just above the staff; below, likewise
 * > under the bottom. The column widens by whatever the text overhangs on each side of its note.
 *
 * It runs AFTER the articulations and reads the same counters, so a dynamic stands outside them.
 *
 * ## ⛔ What is NOT here
 *
 * - **Where the text is drawn from its text line** — `Annotation.draw`, still VexFlow's.
 * - **The dynamics LANE** — the text lines this sets are overruled by `rendering/marks/dynamics/dynamicsLinePass`,
 *   which puts every dynamic of a system on one line; what survives is the column's counters.
 *
 * ⚠️ Transcribed with VexFlow's quirks intact: a stemless note counts as stem-UP; the stem is counted
 * only for an ordinary note (`noteType` `'n'`), not a rest; a right-justified text pads its left
 * width AFTER the max, a centred one after halving; a text with neither vertical side takes the
 * lower counter without advancing it.
 */
import { NOTEHEAD_MIN_PADDING_PX, STAVE_LINE_DISTANCE_PX } from '@/engine/engrave/inheritedDefaults'

/** How the text sits along the note — VexFlow's `AnnotationHorizontalJustify`. */
export type AnnotationAlign = 'left' | 'center' | 'right' | 'centerStem'
/** Which side of the note — VexFlow's `AnnotationVerticalJustify` TOP / BOTTOM, or neither. */
export type AnnotationSide = 'top' | 'bottom' | 'other'

/** One annotation, as the rule needs it — the note's numbers travel with each text. */
export interface StackedAnnotation {
  align: AnnotationAlign
  side: AnnotationSide
  /** The text's font size in px. */
  fontPx: number
  /** The text's own width, px. */
  width: number
  noteGlyphWidth: number
  /** `1` up, `-1` down — ⚠️ a note without a stem answers UP. */
  stemDirection: number
  /** The stem's length in staff spaces — 0 for a rest or a note with no stem object. */
  stemSpaces: number
  staffLines: number
  topLine: number
  bottomLine: number
}

export interface AnnotationColumnState {
  leftShift: number
  rightShift: number
  textLine: number
  topTextLine: number
}

/** The px a text's line height adds to its font size before it is counted in staff spaces. */
export const ANNOTATION_TEXT_LEADING_PX = 2

const UP = 1
const DOWN = -1

/** ⭐ Every text of one column — `textLines[i]` answers `texts[i]` — and the column state after. */
export function stackAnnotations(
  texts: readonly StackedAnnotation[],
  before: AnnotationColumnState,
): { textLines: number[]; state: AnnotationColumnState } {
  const state = { ...before }
  const textLines = texts.map(() => 0)
  if (texts.length === 0) return { textLines, state }

  let leftWidth = 0
  let rightWidth = 0
  let maxLeftGlyphWidth = 0
  let maxRightGlyphWidth = 0
  texts.forEach((text, i) => {
    let verticalSpaceNeeded = (ANNOTATION_TEXT_LEADING_PX + text.fontPx) / STAVE_LINE_DISTANCE_PX
    const { noteGlyphWidth: glyphWidth, width: textWidth, staffLines: lines } = text
    if (text.align === 'right') {
      maxLeftGlyphWidth = Math.max(glyphWidth, maxLeftGlyphWidth)
      leftWidth = Math.max(leftWidth, textWidth) + NOTEHEAD_MIN_PADDING_PX
    } else if (text.align === 'left') {
      maxRightGlyphWidth = Math.max(glyphWidth, maxRightGlyphWidth)
      rightWidth = Math.max(rightWidth, textWidth)
    } else {
      leftWidth = Math.max(leftWidth, textWidth / 2) + NOTEHEAD_MIN_PADDING_PX
      rightWidth = Math.max(rightWidth, textWidth / 2)
      maxLeftGlyphWidth = Math.max(glyphWidth / 2, maxLeftGlyphWidth)
      maxRightGlyphWidth = Math.max(glyphWidth / 2, maxRightGlyphWidth)
    }

    if (text.side === 'top') {
      let noteLine = text.topLine
      if (text.stemDirection === UP) noteLine += text.stemSpaces
      const curTop = noteLine + state.topTextLine + 0.5
      if (curTop < lines) {
        textLines[i] = lines - noteLine
        verticalSpaceNeeded += lines - noteLine
        state.topTextLine = verticalSpaceNeeded
      } else {
        textLines[i] = state.topTextLine
        state.topTextLine += verticalSpaceNeeded
      }
    } else if (text.side === 'bottom') {
      let noteLine = lines - text.bottomLine
      if (text.stemDirection === DOWN) noteLine += text.stemSpaces
      const curBottom = noteLine + state.textLine + 1
      if (curBottom < lines) {
        textLines[i] = lines - curBottom
        verticalSpaceNeeded += lines - curBottom
        state.textLine = verticalSpaceNeeded
      } else {
        textLines[i] = state.textLine
        state.textLine += verticalSpaceNeeded
      }
    } else {
      textLines[i] = state.textLine
    }
  })

  const rightOverlap = Math.min(Math.max(rightWidth - maxRightGlyphWidth, 0), Math.max(rightWidth - state.rightShift, 0))
  const leftOverlap = Math.min(Math.max(leftWidth - maxLeftGlyphWidth, 0), Math.max(leftWidth - state.leftShift, 0))
  state.leftShift += leftOverlap
  state.rightShift += rightOverlap
  return { textLines, state }
}
