/**
 * Tie rendering — extracted from {@link VexFlowRenderer}. Operates entirely on the
 * passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Same-line ties draw a flat cubic arc (via the shared {@link drawCurveArc}); ties
 * spanning a line break draw two partial `StaveTie`s. `getTieDirection` is also used
 * by the renderer's pending-tie preview, so it is exported.
 */
import { StaveNote, StaveTie } from 'vexflow'
import type { Score, Measure, Chord, NotePitch, Fraction } from '@/types/music'
import { fracEq } from '@/utils/fraction'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { middleLineDiatonicPos } from '@/utils/clefUtils'
import type { RenderPass } from './RenderPass'
import { drawCurveArc } from './curveArc'

// Tie geometry (same-line, flat). A tie joins one pitch, so both endpoints share a Y
// and the apex sits at the X midpoint. These reproduce the old hand-drawn quadratic
// (drawFlatTie: yShift 7, cp1 8, cp2 12) on the shared cubic path: a cubic's symmetric
// peak is 0.75·H, so BOW 5.3 → ~4px apex (old 0.5·cp1) and THICKNESS 2.7 → ~2px belly
// (old 0.5·(cp2−cp1)). Kept fuller than a slur — ties read heavier and hug the head.
const TIE_LIFT = 7        // gap between the notehead and the flat tie endpoints
const TIE_BOW = 5.3       // cubic control height → ~4px apex above the endpoint line
const TIE_THICKNESS = 2.7 // belly swell → ~2px at center, pinching to the tips

/**
 * Determine tie direction for a pitch within a chord.
 * Returns: -1 for UP (top note), 1 for DOWN (bottom note).
 * @param notePitch - the pitch being tied
 * @param beat - Beat position of the chord containing this pitch
 * @param measure - The measure to look up chord info in
 */
export function getTieDirection(notePitch: NotePitch, beat: Fraction, measure: Measure): number | undefined {
  // An explicit override (set by flipping the tie with `x`) wins over auto placement.
  if (notePitch.tieDirection !== undefined) return notePitch.tieDirection

  // Find the chord slot that CONTAINS this pitch. In a multi-voice bar each voice
  // has its own chord at the same beat, so matching on beat alone returns the wrong
  // voice's slot (usually voice 1's) — match by the pitch id, then fall back to beat.
  const chordAtBeat = (
    measure.slots.find(
      s => s.type === 'chord' && s.notes.some(p => p.id === notePitch.id),
    ) ?? measure.slots.find(s => s.type === 'chord' && fracEq(s.beat, beat))
  ) as Chord | undefined

  // Multi-voice default: a tie follows its VOICE's outer side so the two voices'
  // ties never collide in the middle — upper voice (V1) curves UP, lower voices
  // (V2) curve DOWN — regardless of the pitch's staff position. Mirrors the forced
  // stem / articulation side / tuplet-bracket rule (Gould). The pitch-based rule
  // below only applies when the bar has a single voice. (`x` override handled above.)
  const voiceCount = new Set(measure.slots.map(s => s.voice ?? 0)).size
  if (voiceCount > 1) {
    const voice = chordAtBeat?.voice ?? 0
    return voice === 0 ? -1 : 1
  }

  const thisDiatonic = spellingDiatonicPos(notePitch.step, notePitch.octave)

  if (!chordAtBeat || chordAtBeat.notes.length <= 1) {
    // Single note — tie direction based on diatonic distance from middle line (treble B4=34)
    const middleDiatonic = middleLineDiatonicPos('treble')
    return thisDiatonic >= middleDiatonic ? -1 : 1
  }

  // Sort all chord notes by diatonic staff position
  const sortedDiatonics = chordAtBeat.notes
    .map(n => spellingDiatonicPos(n.step, n.octave))
    .sort((a, b) => a - b)
  const lowestDiatonic  = sortedDiatonics[0]
  const highestDiatonic = sortedDiatonics[sortedDiatonics.length - 1]

  if (thisDiatonic === highestDiatonic) return -1  // Top note: tie curves UP
  if (thisDiatonic === lowestDiatonic)  return 1   // Bottom note: tie curves DOWN

  // Middle note: follow nearest outer voice
  const distToTop    = highestDiatonic - thisDiatonic
  const distToBottom = thisDiatonic    - lowestDiatonic
  return distToTop <= distToBottom ? -1 : 1
}

/**
 * Draw a tie arc where both endpoints share the source note's Y position.
 * Ties always connect the same pitch, so the arc is horizontally flat with its
 * apex at the X midpoint. Routes through the shared cubic `drawCurveArc` (same
 * `Curve.renderCurve` path as slurs); flat endpoints + symmetric `cps` keep the
 * peak centered, while tie-specific BOW/THICKNESS reproduce the old hand-drawn
 * quadratic look. Returns the bounding box of the drawn arc, or null on failure.
 */
function drawFlatTie(
  pass: RenderPass,
  fromInfo: { staveNote: StaveNote; noteIndex: number },
  toInfo: { staveNote: StaveNote; noteIndex: number },
  direction: number,
): { x: number; y: number; width: number; height: number } | null {
  if (!pass.context) return null
  try {
    const firstX = fromInfo.staveNote.getTieRightX()
    const lastX = toInfo.staveNote.getTieLeftX()
    const ys = fromInfo.staveNote.getYs()
    const y = ys[fromInfo.noteIndex] ?? ys[0]
    if (y === undefined || isNaN(y)) return null

    // Flat endpoints, both lifted off the notehead by TIE_LIFT. Symmetric control
    // heights (same Y, dy=0) → the cubic's peak lands exactly at the X midpoint.
    const tieY = y + TIE_LIFT * direction
    const p0 = { x: firstX, y: tieY }
    const p1 = { x: lastX, y: tieY }
    const bow = TIE_BOW
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: bow },
      { x: 0, y: bow },
    ]
    const arc = drawCurveArc(
      pass, p0, p1, cps, direction, TIE_THICKNESS,
      fromInfo.staveNote, toInfo.staveNote,
    )
    return arc.bbox
  } catch (e) {
    console.error('Could not draw flat tie:', e)
    return null
  }
}

/**
 * Render ties between notes that have tiedTo/tiedFrom properties
 */
export function renderTies(pass: RenderPass, score: Score): void {
  if (!pass.context) return

  // Track which ties we've already processed to avoid duplicates
  const processedTies = new Set<string>()

  // Find all notes with ties by iterating chord slots directly
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      for (const pitch of slot.notes) {
        if (!pitch.tiedTo) continue

        const tieKey = `${pitch.id}->${pitch.tiedTo}`
        if (processedTies.has(tieKey)) continue
        processedTies.add(tieKey)

        const fromInfo = pass.staveNoteMap.get(pitch.id)
        const toInfo = pass.staveNoteMap.get(pitch.tiedTo)

        if (fromInfo?.staveNote && toInfo?.staveNote) {
          try {
            const fromMeasure = slot.measure
            // Find the measure containing the target pitch
            let toMeasure: number | undefined
            outer: for (const m of score.measures) {
              for (const s of m.slots) {
                if (s.type === 'chord' && s.notes.some(p => p.id === pitch.tiedTo)) {
                  toMeasure = m.number
                  break outer
                }
                if (s.type === 'rest' && s.id === pitch.tiedTo) {
                  toMeasure = m.number
                  break outer
                }
              }
            }

            const fromLayout = pass.measureLayoutInfo.get(fromMeasure)
            const toLayout = toMeasure ? pass.measureLayoutInfo.get(toMeasure) : undefined
            const fromLine = fromLayout?.lineNumber ?? 0
            const toLine = toLayout?.lineNumber ?? 0
            const sameLine = fromLine === toLine

            const tieDirection = getTieDirection(pitch, slot.beat, measure)
            // note alias for registry callbacks below
            const note = { id: pitch.id, tiedTo: pitch.tiedTo, measure: fromMeasure }

            if (sameLine) {
              // Same line: draw flat arc anchored at the source note's Y
              // (ties always connect the same pitch, so both endpoints share the same Y)
              const bbox = drawFlatTie(pass, fromInfo, toInfo, tieDirection ?? 1)
              if (bbox) {
                pass.elementRegistry.add({
                  type: 'tie',
                  fromNoteId: note.id,
                  toNoteId: note.tiedTo!,
                  fromMeasure: fromMeasure,
                  toMeasure: toMeasure!,
                  tieDirection: tieDirection ?? 1,
                  bbox,
                })
              }
            } else {
              // Different lines (line break): two partial ties
              // First partial: from note to end of line
              const firstPartialTie = new StaveTie({
                firstNote: fromInfo.staveNote,
                firstIndexes: [fromInfo.noteIndex],
              })
              if (tieDirection !== undefined) {
                firstPartialTie.setDirection(tieDirection)
              }
              firstPartialTie.setContext(pass.context!).draw()

              // Register first partial tie
              try {
                const box = firstPartialTie.getBoundingBox()
                if (box) {
                  pass.elementRegistry.add({
                    type: 'tie',
                    fromNoteId: note.id,
                    toNoteId: note.tiedTo!,
                    fromMeasure: fromMeasure,
                    toMeasure: toMeasure!,
                    isPartial: true,
                    partialType: 'end', // ends at line break
                    tieDirection: tieDirection ?? 1,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })
                }
              } catch (e) {
                // getBoundingBox may fail
              }

              // Second partial: from start of line to note
              const secondPartialTie = new StaveTie({
                lastNote: toInfo.staveNote,
                lastIndexes: [toInfo.noteIndex],
              })
              if (tieDirection !== undefined) {
                secondPartialTie.setDirection(tieDirection)
              }
              secondPartialTie.setContext(pass.context!).draw()

              // Register second partial tie
              try {
                const box = secondPartialTie.getBoundingBox()
                if (box) {
                  pass.elementRegistry.add({
                    type: 'tie',
                    fromNoteId: note.id,
                    toNoteId: note.tiedTo!,
                    fromMeasure: fromMeasure,
                    toMeasure: toMeasure!,
                    isPartial: true,
                    partialType: 'start', // starts at line break
                    tieDirection: tieDirection ?? 1,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })
                }
              } catch (e) {
                // getBoundingBox may fail
              }
            }
          } catch (e) {
            console.error('Could not render tie:', e)
          }
        }
      }
    }
  }
}
