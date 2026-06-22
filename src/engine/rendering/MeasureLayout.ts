import { Voice, Formatter } from 'vexflow'
import type { Score, Measure, Clef } from '@/types/music'
import { fracCompare, fracIsZero } from '@/utils/fraction'
import { measureEndingClef } from '@/utils/clefUtils'
import { measureCapacityFrac } from '@/utils/musicUtils'
import { LAYOUT_CONFIG, type MeasureWidthInfo } from './layoutConfig'
import {
  createStaveNotesFromSlots,
  makeClefResolver,
  createTupletsForMeasure,
  chooseVoiceMode,
  drawsTimeSignature,
} from './NoteBuilder'

/**
 * Measure-width math — the two-pass proportional layout that decides each measure's
 * minimum/final width and which line it lands on, plus the cautionary clef/TS width
 * reservations at line breaks.
 *
 * Pure over `(score, effectiveClefs)`: holds no renderer state and writes no
 * per-render lookup maps. It does build throwaway VexFlow voices and uses
 * `Formatter.preCalculateMinTotalWidth`, so it is NOT framework-agnostic — it
 * quarantines that VexFlow coupling rather than removing it. The note-building it
 * needs comes from {@link ./NoteBuilder}.
 */

/**
 * Calculate minimum width needed for a single measure based on its content.
 * Uses VexFlow's Formatter to estimate space needed for notes.
 */
function calculateMinimumMeasureWidth(
  measure: Measure,
  isFirstInLine: boolean,
  clef: Clef,
  hasClefChange: boolean = false
): number {
  // Start with base overhead
  let overhead = LAYOUT_CONFIG.BARLINE_PADDING * 2

  // Add clef width for first measure of each line
  if (isFirstInLine) {
    overhead += LAYOUT_CONFIG.CLEF_WIDTH
  } else if (hasClefChange) {
    // Mid-line clef change renders a smaller clef at the measure start
    overhead += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
  }

  // Add time signature width wherever a TS glyph is drawn (measure 1 + changes)
  if (drawsTimeSignature(measure)) {
    overhead += LAYOUT_CONFIG.TIME_SIG_WIDTH
  }

  // Budget width for each mid-measure (inline) clef change
  const midClefCount = (measure.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
  overhead += midClefCount * LAYOUT_CONFIG.CLEF_CHANGE_WIDTH

  // If measure has no notes or only rests, use minimum width
  const actualNotes = measure.slots.filter(s => s.type === 'chord')
  if (actualNotes.length === 0) {
    return Math.max(LAYOUT_CONFIG.MIN_MEASURE_WIDTH, overhead + 40)
  }

  // Create temporary voice to calculate width
  const sortedSlots = [...measure.slots].sort((a, b) => fracCompare(a.beat, b.beat))
  const staveNotes = createStaveNotesFromSlots(sortedSlots, makeClefResolver(measure, clef))

  // Create VexFlow Tuplets BEFORE adding notes to voice (adjusts tick values)
  createTupletsForMeasure(measure, sortedSlots, staveNotes)

  const voice = new Voice({
    numBeats: measure.timeSignature.numerator,
    beatValue: measure.timeSignature.denominator,
  }).setMode(chooseVoiceMode(sortedSlots, measureCapacityFrac(measure)))

  try {
    voice.addTickables(staveNotes)

    // Use VexFlow's formatter to calculate minimum width
    const formatter = new Formatter()
    formatter.joinVoices([voice])
    const minNoteWidth = formatter.preCalculateMinTotalWidth([voice])

    // Add safety buffer (15%) and ensure minimum note spacing
    const noteCount = sortedSlots.filter(s => s.type === 'chord').length
    const minSpacingWidth = noteCount * LAYOUT_CONFIG.MIN_NOTE_SPACING
    const calculatedWidth = Math.max(minNoteWidth * 1.15, minSpacingWidth)

    // Total width = note space + overhead
    let totalWidth = calculatedWidth + overhead

    // Apply min/max constraints
    totalWidth = Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH)
    totalWidth = Math.min(totalWidth, LAYOUT_CONFIG.MAX_MEASURE_WIDTH)

    return totalWidth
  } catch (error) {
    // If calculation fails, fall back to minimum width
    console.warn(`Could not calculate width for measure ${measure.number}:`, error)
    return LAYOUT_CONFIG.MIN_MEASURE_WIDTH
  }
}

/**
 * Distribute available width proportionally among measures on a line
 */
function distributeLineWidths(
  measureInfos: MeasureWidthInfo[],
  availableWidth: number
): void {
  if (measureInfos.length === 0) return

  const totalMinWidth = measureInfos.reduce((sum, m) => sum + m.minWidth, 0)

  if (totalMinWidth >= availableWidth) {
    // Need to compress - distribute proportionally to minimum widths
    const compressionRatio = availableWidth / totalMinWidth
    if (compressionRatio < 0.7) {
      console.warn(`Severe measure compression (${(compressionRatio * 100).toFixed(0)}%) on line - measures may be crowded`)
    }
    for (const info of measureInfos) {
      info.finalWidth = info.minWidth * compressionRatio
    }
  } else {
    // Have extra space - distribute proportionally
    const extraSpace = availableWidth - totalMinWidth
    for (const info of measureInfos) {
      const proportion = info.minWidth / totalMinWidth
      info.finalWidth = info.minWidth + (extraSpace * proportion)
    }
  }
}

/**
 * Add a cautionary clef to the last measure of any line whose *next* line opens
 * with a different clef. The warning shows the upcoming clef just before the
 * line break (standard engraving). Runs after line assignment, so it reserves
 * width on the affected measure and re-distributes that line only — line
 * membership is never changed (no re-wrapping).
 */
function applyCautionaryClefs(
  score: Score,
  effectiveClefs: Map<number, Clef>,
  results: Map<number, MeasureWidthInfo>,
  availableWidth: number
): void {
  const linesToRedistribute = new Set<number>()

  for (let i = 0; i < score.measures.length - 1; i++) {
    const current = results.get(score.measures[i].number)
    const next = results.get(score.measures[i + 1].number)
    if (!current || !next || next.lineNumber <= current.lineNumber) continue

    // The next line opens here; warn only if the clef actually changes across
    // the break (its opening clef differs from this measure's ending clef).
    const nextOpeningClef = effectiveClefs.get(next.measureNumber) || 'treble'
    if (nextOpeningClef === measureEndingClef(score, current.measureNumber)) continue

    current.cautionaryEndClef = nextOpeningClef
    current.minWidth += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
    linesToRedistribute.add(current.lineNumber)
  }

  // Re-distribute each affected line so the reserved width shrinks note spacing
  // rather than overflowing the margin.
  for (const lineNumber of linesToRedistribute) {
    const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
    distributeLineWidths(lineMeasures, availableWidth)
  }
}

/**
 * Add a cautionary (courtesy) time signature to the last measure of any line
 * whose *next* line opens with a meter change. The warning shows the upcoming
 * time signature just before the line break, after the final barline (standard
 * engraving). Drawn FULL size, unlike the cautionary clef.
 *
 * Runs after line assignment, so it reserves width on the affected measure and
 * re-distributes that line only — line membership is never changed (no re-wrap).
 */
function applyCautionaryTimeSignatures(
  score: Score,
  results: Map<number, MeasureWidthInfo>,
  availableWidth: number
): void {
  const linesToRedistribute = new Set<number>()

  for (let i = 0; i < score.measures.length - 1; i++) {
    const current = results.get(score.measures[i].number)
    const next = results.get(score.measures[i + 1].number)
    if (!current || !next || next.lineNumber <= current.lineNumber) continue

    // The next line opens here; warn only when it actually begins a meter change
    // (same condition that draws the TS glyph at the new line's start).
    const nextMeasure = score.measures[i + 1]
    if (!nextMeasure.timeSignatureChange) continue

    current.cautionaryEndTimeSig = nextMeasure.timeSignature
    current.minWidth += LAYOUT_CONFIG.TIME_SIG_WIDTH
    linesToRedistribute.add(current.lineNumber)
  }

  for (const lineNumber of linesToRedistribute) {
    const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
    distributeLineWidths(lineMeasures, availableWidth)
  }
}

/**
 * Calculate widths for all measures using a two-pass algorithm.
 * Pass 1: Calculate minimum widths and group into lines.
 * Pass 2: Distribute available space proportionally within each line.
 */
export function calculateMeasureWidths(
  score: Score,
  effectiveClefs: Map<number, Clef>
): Map<number, MeasureWidthInfo> {
  const results = new Map<number, MeasureWidthInfo>()
  const margin = LAYOUT_CONFIG.MARGIN
  const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

  // Pass 1: Calculate minimum widths and assign to lines
  let currentLine = 0
  let currentLineWidth = 0
  let currentLineMeasures: MeasureWidthInfo[] = []

  for (const measure of score.measures) {
    const isFirstInLine = currentLineMeasures.length === 0
    const clef = effectiveClefs.get(measure.number) || 'treble'
    // Redraw the clef at a mid-line measure start only when it actually changes
    // across the barline — i.e. differs from the previous measure's *ending*
    // clef (a mid-measure change already shows its clef inline in that measure).
    const prevEndClef = measure.number > 1 ? measureEndingClef(score, measure.number - 1) : undefined
    const hasClefChange = prevEndClef !== undefined && clef !== prevEndClef
    const minWidth = calculateMinimumMeasureWidth(measure, isFirstInLine, clef, hasClefChange)

    // Check if measure fits on current line
    if (currentLineWidth + minWidth > availableWidth && currentLineMeasures.length > 0) {
      // Finalize current line
      distributeLineWidths(currentLineMeasures, availableWidth)
      for (const info of currentLineMeasures) {
        results.set(info.measureNumber, info)
      }

      // Start new line
      currentLine++
      currentLineWidth = 0
      currentLineMeasures = []

      // Recalculate width for new line (first-in-line gets a full clef, so a
      // clef change is absorbed into the line-start clef — no extra width)
      const newMinWidth = calculateMinimumMeasureWidth(measure, true, clef)

      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth: newMinWidth,
        finalWidth: newMinWidth,
        lineNumber: currentLine,
      }
      currentLineMeasures.push(info)
      currentLineWidth = newMinWidth
    } else {
      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth,
        finalWidth: minWidth,
        lineNumber: currentLine,
      }
      currentLineMeasures.push(info)
      currentLineWidth += minWidth
    }
  }

  // Finalize last line
  if (currentLineMeasures.length > 0) {
    distributeLineWidths(currentLineMeasures, availableWidth)
    for (const info of currentLineMeasures) {
      results.set(info.measureNumber, info)
    }
  }

  applyCautionaryClefs(score, effectiveClefs, results, availableWidth)
  applyCautionaryTimeSignatures(score, results, availableWidth)

  return results
}
