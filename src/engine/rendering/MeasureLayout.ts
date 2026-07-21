import { Voice, Formatter } from 'vexflow'
import type { Score, Measure, Clef } from '@/types/music'
import { fracCompare, fracIsZero } from '@/utils/fraction'
import { type StaffClefs } from '@/utils/clefUtils'
import { getStaves, staffMeasureView } from '@/engine/models/staffContent'
import { measureCapacityFrac } from '@/utils/musicUtils'
import { cautionaryAllowedOf, cautionaryClefAllowedOf, keyStaffId, measureUserSpacePx } from '../models/engravingOverrides'
import { LAYOUT_CONFIG, type MeasureWidthInfo, type ViewMode } from './layoutConfig'
import { laneFingerprint, type MeasureWidthCache } from './MeasureWidthCache'
import { renderCensus } from '@/dev/renderCensus' // TEMPORARY — the §9 layout-breakdown probes
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
 * Pure over `(score, clefsByStaff)`: holds no renderer state and writes no
 * per-render lookup maps. It does build throwaway VexFlow voices and uses
 * `Formatter.preCalculateMinTotalWidth`, so it is NOT framework-agnostic — it
 * quarantines that VexFlow coupling rather than removing it. The note-building it
 * needs comes from {@link ./NoteBuilder}.
 */

/** The note area a lane gets when it holds nothing at all, and the floor under a bar of pure
 *  silence — an empty bar should not collapse to the width of its one rest glyph. */
const EMPTY_LANE_NOTE_SPACE = 40

/**
 * The horizontal space **one staff's lane** needs for its notes — the expensive half of the
 * width calc, and the only half that depends on the staff.
 *
 * `laneView` is a {@link staffMeasureView}: the measure narrowed to one staff, so its slots,
 * clefs and tuplets are that staff's only. Voices *within* the lane are still grouped and
 * formatted together — a two-voice bar must reserve room for both interleaved streams.
 *
 * Memoized on the lane's content when a cache is given (P2). This is the ONLY expensive step in
 * the layout, and it is exactly the one that doesn't change when you edit some other bar — so
 * with a cache the formatter runs on the measure you touched and on nothing else. The overhead
 * (clefs, meter, line position) deliberately stays outside the memo: see {@link MeasureWidthCache}.
 */
function noteSpaceForLane(laneView: Measure, clef: Clef, cache?: MeasureWidthCache): number {
  // A lane is empty when it holds NO SLOTS. It used to ask "no chords?", which called a bar of
  // rests empty: eight eighth-rests were measured as an empty bar and drew crammed on top of each
  // other, narrower than a bar holding ONE whole rest (reported, with a screenshot). That was true
  // while an all-rest bar could only ever be a single auto-filled measure rest; the rest tool made
  // bars of authored rests and the assumption broke.
  if (laneView.slots.length === 0) return EMPTY_LANE_NOTE_SPACE
  const hasNotes = laneView.slots.some(s => s.type === 'chord')

  // TEMPORARY probes — the §9 question (see renderCensus.layoutSub). `recording` is false in every
  // ordinary session, so this is one boolean read, not a clock call.
  const probing = renderCensus.recording
  const t0 = probing ? performance.now() : 0
  const key = cache ? laneFingerprint(laneView) : undefined
  if (probing) renderCensus.layoutSub('fingerprint', performance.now() - t0)
  if (key !== undefined) {
    const hit = cache!.get(key)
    renderCensus.layoutCacheProbe(hit !== undefined)
    if (hit !== undefined) return hit
  }
  const tFormat = probing ? performance.now() : 0

  const sorted = [...laneView.slots].sort((a, b) => fracCompare(a.beat, b.beat))
  const clefResolver = makeClefResolver(laneView, clef)
  const capacity = measureCapacityFrac(laneView)
  const voiceIds = [...new Set(sorted.map(s => s.voice ?? 0))].sort((a, b) => a - b)

  const voices = voiceIds.map(v => {
    const slots = sorted.filter(s => (s.voice ?? 0) === v)
    const sn = createStaveNotesFromSlots(slots, clefResolver)
    // Create VexFlow Tuplets BEFORE adding notes to voice (adjusts tick values)
    createTupletsForMeasure(laneView, slots, sn)
    const voice = new Voice({
      numBeats: laneView.timeSignature.numerator,
      beatValue: laneView.timeSignature.denominator,
    }).setMode(chooseVoiceMode(slots, capacity))
    voice.addTickables(sn)
    return voice
  })

  try {
    const formatter = new Formatter()
    formatter.joinVoices(voices)
    const minNoteWidth = formatter.preCalculateMinTotalWidth(voices)

    // Safety buffer (15%), floored at a minimum spacing per EVENT — and the floor is what actually
    // spaces music: VexFlow's own minimum is ~9px an event, far too tight to read, so this is the
    // number that decides how wide a bar is. It counted CHORDS, so rests earned no space at all and
    // a bar of them collapsed. A rest occupies a beat exactly as a note does.
    const minSpacingWidth = laneView.slots.length * LAYOUT_CONFIG.MIN_NOTE_SPACING
    // …and a bar of pure SILENCE keeps its presence: one whole rest formats to less than this, and
    // an empty bar should not collapse to the width of its one glyph. Only for lanes with no notes,
    // though — as a floor on EVERY lane it clamps small bars and hides real differences (it swallowed
    // the ~1px an accidental adds to a two-note bar, which the width control tests caught at once).
    const silenceFloor = hasNotes ? 0 : EMPTY_LANE_NOTE_SPACE
    const noteSpace = Math.max(minNoteWidth * 1.15, minSpacingWidth, silenceFloor)
    if (key !== undefined) cache!.set(key, noteSpace)
    if (probing) renderCensus.layoutSub('format', performance.now() - tFormat)
    return noteSpace
  } catch (error) {
    console.warn(`Could not calculate width for measure ${laneView.number}:`, error)
    return EMPTY_LANE_NOTE_SPACE
  }
}

/**
 * Minimum width of a measure — **the max over its staves**, not the sum of them.
 *
 * A measure spans every staff (they share barlines), so its width is the width of its *widest*
 * staff. The old code poured every staff's notes into one voice set and formatted them together,
 * which is both wrong (it engraves a width nobody asked for — a 25-staff bar reserved room for
 * 25 staves' notes interleaved into one imaginary stream) and the reason layout cost scaled with
 * the staff axis: the formatter was fed N× the notes. See docs/render-performance-plan.md §3.
 *
 * The clef terms live *inside* the max because a clef is per-staff (staff 1 may change clef where
 * staff 2 does not). The time-signature and barline padding are shared by every staff, so they sit
 * outside it.
 */
function calculateMinimumMeasureWidth(
  score: Score,
  measure: Measure,
  isFirstInLine: boolean,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  cache?: MeasureWidthCache,
): number {
  // Shared by every staff: the barline padding, and the meter glyph where one is drawn
  // (measure 1 + changes).
  let sharedOverhead = LAYOUT_CONFIG.BARLINE_PADDING * 2
  if (drawsTimeSignature(measure)) sharedOverhead += LAYOUT_CONFIG.TIME_SIG_WIDTH

  const staffIds = staffIdsOf(score, clefsByStaff)

  // At N=1 the lane IS the measure (every slot matches the only staff), so skip the filter —
  // it would copy four arrays per measure per render to arrive back at what it was given.
  const single = staffIds.length === 1

  let widest = 0
  for (const staffId of staffIds) {
    // TEMPORARY probe — see renderCensus.layoutSub.
    const tView = renderCensus.recording ? performance.now() : 0
    const lane = single ? measure : staffMeasureView(measure, staffId, score)
    if (renderCensus.recording) renderCensus.layoutSub('laneView', performance.now() - tView)
    const staffClefs = clefsByStaff.get(staffId)
    const clef = staffClefs?.opening.get(measure.number) ?? 'treble'

    // This staff's own clef overhead. A line-opening measure draws a full clef on every staff;
    // mid-line, a staff draws a small clef only where ITS clef changes across the barline — i.e.
    // differs from the previous measure's *ending* clef (a mid-measure change already showed its
    // clef inline in that measure).
    let clefOverhead = 0
    if (isFirstInLine) {
      clefOverhead += LAYOUT_CONFIG.CLEF_WIDTH
    } else {
      const prevEndClef = measure.number > 1
        ? staffClefs?.ending.get(measure.number - 1)
        : undefined
      if (prevEndClef !== undefined && clef !== prevEndClef) {
        clefOverhead += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
      }
    }
    // Each mid-measure (inline) clef change on THIS staff draws its own small clef.
    const midClefs = (lane.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
    clefOverhead += midClefs * LAYOUT_CONFIG.CLEF_CHANGE_WIDTH

    widest = Math.max(widest, noteSpaceForLane(lane, clef, cache) + clefOverhead)
  }

  const totalWidth = widest + sharedOverhead
  return Math.min(
    Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH),
    LAYOUT_CONFIG.MAX_MEASURE_WIDTH,
  )
}

/**
 * The measure's **intrinsic** width plus whatever horizontal space the user authored into it
 * (client #10 — docs/note-spacing-plan.md §2). One `minWidth`, split so §3 can tell the halves
 * apart: the intrinsic half is the engraver's and may be squeezed, the authored half is the
 * user's and is handed back.
 *
 * Two ordering facts, both load-bearing:
 *
 * - **The user space is added AFTER the clamps**, not before. `MIN_MEASURE_WIDTH`/
 *   `MAX_MEASURE_WIDTH` are caps on what the *music* needs; leave the authored space inside them
 *   and a drag dies silently at 400px with no feedback.
 * - **It is added OUTSIDE `noteSpaceForLane`'s memo**, where `clefOverhead` already sits. The
 *   overrides live on `score`, not on `Measure`, so `laneFingerprint` cannot see them — and must
 *   not. Fold them in and every drag frame re-runs the VexFlow formatter on the bar, which is the
 *   one thing that makes this drag unaffordable: unlike the other four, a spacing change always
 *   re-runs the casting-off (it sets `modelDirty`, so `layoutCache` is bypassed), so the width
 *   pass runs on every frame and only the memo keeps it cheap.
 */
function measureWidthParts(
  score: Score,
  measure: Measure,
  isFirstInLine: boolean,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  cache?: MeasureWidthCache,
): { minWidth: number; userSpace: number } {
  const intrinsic = calculateMinimumMeasureWidth(score, measure, isFirstInLine, clefsByStaff, cache)
  const userSpace = measureUserSpacePx(score, measure.id)
  return { minWidth: intrinsic + userSpace, userSpace }
}

/** The staves to lay out. A hand-built staveless score still has one (undefined) lane, which is
 *  how `staffMeasureView` addresses "all the content that carries no staffId". */
function staffIdsOf(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
): (string | undefined)[] {
  const staves = getStaves(score)
  if (staves.length > 0) return staves.map(s => s.id)
  return clefsByStaff.size > 0 ? [...clefsByStaff.keys()] : [undefined]
}


/**
 * How much of a line the user may claim with authored space. The rest is the music's, and it is
 * why the cap exists at all: `available` is finite, and nothing in `distributeLineWidths` stops
 * `Σ userSpace` reaching it. At or past `available` the justify target goes to zero or negative
 * and every bar on the line comes out with a negative width; and since pass 1 puts an oversized
 * bar alone on its own line, one bar carrying 900px of space would squeeze its music to nothing
 * and *still* hand the 900px back whole — straight through the right margin.
 *
 * So the authored space is scaled down proportionally once the line's total passes this. "The gap
 * you drag is the gap you get" holds up to the cap, and degrades smoothly past it.
 */
const USER_SPACE_LINE_FRACTION = 0.6

/**
 * Distribute available width proportionally among measures on a line — justifying the
 * **intrinsic** widths only, and handing the user's authored space back on top
 * (docs/note-spacing-plan.md §3, "the gap you drag is the gap you get").
 *
 * Feeding the authored space through the stretcher instead would be wrong twice over: it would
 * dilute a 20px drag to ~13px, *and* shuffle every other bar on the line to pay for a change the
 * user made in one of them. So the space is reserved off the top, the engraver's widths share what
 * is left, and the reserved amount is added back to the bar that authored it. The total still
 * lands exactly on `availableWidth`.
 *
 * Compression takes the same shape: squeeze the intrinsic part, hand the authored part back. The
 * intrinsic part keeps `MIN_MEASURE_WIDTH` inside it (it was clamped upstream), so a bar can never
 * be driven to nothing and leave only its authored space standing.
 */
function distributeLineWidths(
  measureInfos: MeasureWidthInfo[],
  availableWidth: number
): void {
  if (measureInfos.length === 0) return

  // Reserve the authored space off the top — capped, and scaled proportionally when the cap bites
  // so no single bar's drag is singled out. A NEGATIVE total is not capped: it hands width back to
  // the music rather than taking it, which is always affordable.
  const rawUserSpace = measureInfos.reduce((sum, m) => sum + (m.userSpace ?? 0), 0)
  const cap = availableWidth * USER_SPACE_LINE_FRACTION
  const userScale = rawUserSpace > cap ? cap / rawUserSpace : 1
  const reserved = rawUserSpace * userScale
  const justifyTarget = availableWidth - reserved

  const intrinsicOf = (m: MeasureWidthInfo) => m.minWidth - (m.userSpace ?? 0)
  const totalIntrinsic = measureInfos.reduce((sum, m) => sum + intrinsicOf(m), 0)
  if (totalIntrinsic <= 0) return

  if (totalIntrinsic >= justifyTarget) {
    // Need to compress - distribute proportionally to intrinsic widths
    const compressionRatio = justifyTarget / totalIntrinsic
    if (compressionRatio < 0.7) {
      console.warn(`Severe measure compression (${(compressionRatio * 100).toFixed(0)}%) on line - measures may be crowded`)
    }
    for (const info of measureInfos) {
      info.finalWidth = intrinsicOf(info) * compressionRatio + (info.userSpace ?? 0) * userScale
    }
  } else {
    // Have extra space - distribute proportionally
    const extraSpace = justifyTarget - totalIntrinsic
    for (const info of measureInfos) {
      const proportion = intrinsicOf(info) / totalIntrinsic
      info.finalWidth = intrinsicOf(info) + (extraSpace * proportion) + (info.userSpace ?? 0) * userScale
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
  clefsByStaff: Map<string | undefined, StaffClefs>,
  staffIds: (string | undefined)[],
  results: Map<number, MeasureWidthInfo>,
  availableWidth: number
): void {
  const linesToRedistribute = new Set<number>()

  for (let i = 0; i < score.measures.length - 1; i++) {
    const current = results.get(score.measures[i].number)
    const next = results.get(score.measures[i + 1].number)
    if (!current || !next || next.lineNumber <= current.lineNumber) continue

    // EVERY staff is asked, because a clef is per staff: a piano score whose left hand changes to
    // treble across a break must warn on the lower staff and stay silent on the upper. The width,
    // though, is charged ONCE — the courtesies sit at the same x on different staves, so one
    // clef's width covers however many of them there are.
    let anyOnThisMeasure = false

    staffIds.forEach((staffId, staffIndex) => {
      const clefs = clefsByStaff.get(staffId)
      if (!clefs) return

      // The next line opens here; warn only if the clef actually changes across
      // the break (its opening clef differs from this measure's ending clef).
      const nextOpeningClef = clefs.opening.get(next.measureNumber) || 'treble'
      if (nextOpeningClef === clefs.ending.get(current.measureNumber)) return
      // …and only when the change ALLOWS one. Keyed by the measure the change starts at, like the
      // meter's: which bar ends a system moves on every reflow, and the author's decision must not.
      if (!cautionaryClefAllowedOf(score, score.measures[i + 1].id, keyStaffId(staffIndex, staffId))) return

      current.cautionaryEndClefs ??= []
      current.cautionaryEndClefs[staffIndex] = nextOpeningClef
      anyOnThisMeasure = true
    })

    if (!anyOnThisMeasure) continue
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
    // …and only when the change ALLOWS one. The two halves of the rule meet here: the flag belongs
    // to the change, this loop supplies the other half (does that change open a system). Keyed by
    // the measure the change starts at, not by this one — which bar ends a system moves every time
    // the music reflows, and the author's decision must not move with it.
    if (!cautionaryAllowedOf(score, nextMeasure.id)) continue

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
 * Linear view's break policy: there isn't one. Every measure lands on line 0 at its intrinsic
 * width — never break, never justify (docs/linear-view-plan.md §P1). Only the very first
 * measure opens a line, so only it carries a full clef; every later measure pays the smaller
 * mid-line clef-change width, and only when the clef actually changes across the barline.
 *
 * No cautionary clef/TS pass: those are drawn at line breaks, and there are none — they
 * self-disable rather than being suppressed.
 */
function calculateLinearMeasureWidths(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  cache?: MeasureWidthCache,
): Map<number, MeasureWidthInfo> {
  const results = new Map<number, MeasureWidthInfo>()

  score.measures.forEach((measure, index) => {
    const { minWidth, userSpace } = measureWidthParts(score, measure, index === 0, clefsByStaff, cache)

    results.set(measure.number, {
      measureNumber: measure.number,
      minWidth,
      userSpace,
      finalWidth: minWidth, // intrinsic width + authored space — nothing to justify to
      lineNumber: 0,
    })
  })

  return results
}

/**
 * Calculate widths for all measures using a two-pass algorithm.
 * Pass 1: Calculate minimum widths and group into lines.
 * Pass 2: Distribute available space proportionally within each line.
 *
 * In `linear` mode both passes are skipped — see {@link calculateLinearMeasureWidths}.
 */
export function calculateMeasureWidths(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  mode: ViewMode = 'wrapped',
  cache?: MeasureWidthCache,
): Map<number, MeasureWidthInfo> {
  if (mode === 'linear') return calculateLinearMeasureWidths(score, clefsByStaff, cache)

  const results = new Map<number, MeasureWidthInfo>()
  const margin = LAYOUT_CONFIG.MARGIN
  const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

  // Pass 1: Calculate minimum widths and assign to lines
  let currentLine = 0
  let currentLineWidth = 0
  let currentLineMeasures: MeasureWidthInfo[] = []

  for (const measure of score.measures) {
    const isFirstInLine = currentLineMeasures.length === 0
    const { minWidth, userSpace } = measureWidthParts(score, measure, isFirstInLine, clefsByStaff, cache)

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
      const newParts = measureWidthParts(score, measure, true, clefsByStaff, cache)

      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth: newParts.minWidth,
        userSpace: newParts.userSpace,
        finalWidth: newParts.minWidth,
        lineNumber: currentLine,
      }
      currentLineMeasures.push(info)
      currentLineWidth = newParts.minWidth
    } else {
      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth,
        userSpace,
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

  applyCautionaryClefs(score, clefsByStaff, staffIdsOf(score, clefsByStaff), results, availableWidth)
  applyCautionaryTimeSignatures(score, results, availableWidth)

  return results
}
