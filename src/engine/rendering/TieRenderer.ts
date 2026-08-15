/**
 * Tie rendering — extracted from {@link VexFlowRenderer}. Operates entirely on the
 * passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Same-line ties draw a flat cubic arc (via the shared {@link drawCurveArc}); ties
 * spanning a line break draw two partial `StaveTie`s. WHICH WAY the arc bows is not
 * decided here — that is {@link ./tieDirection}, shared with the pending-tie preview.
 */
import { StaveNote, StaveTie } from 'vexflow'
import type { Score } from '@/types/music'
import { effectiveClefAt } from '@/utils/clefUtils'
import type { RenderPass } from './RenderPass'
import { drawCurveArc, CURVE_THICKNESS } from './curveArc'
import { tieSide } from './tieDirection'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { inStaffSpace } from './staffScaleGroup'

// Tie geometry (same-line, flat). A tie joins one pitch, so both endpoints share a Y
// and the apex sits at the X midpoint. These reproduce the old hand-drawn quadratic
// (drawFlatTie: yShift 7, cp1 8, cp2 12) on the shared cubic path: a cubic's symmetric
// peak is 0.75·H, so BOW 5.3 → ~4px apex (old 0.5·cp1).
//
// The BOW is the tie's own — flat, hugging the noteheads, where a slur arches. The WEIGHT is not:
// it moved to {@link CURVE_THICKNESS}, shared with slurs, when the two were reconciled (this file
// used to carry `TIE_THICKNESS = 2.7` and claim ties should read heavier; they should not).
const TIE_LIFT = 7               // gap between the notehead and the flat tie endpoints
// Exported so the ghost tie (VexFlowRenderer.renderScoreWithTieGhost) is engraved from the SAME
// numbers as a real tie — arm the tool and the arc under the cursor IS the arc you get.
export const TIE_BOW = 5.3       // cubic control height → ~4px apex above the endpoint line

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
      pass, p0, p1, cps, direction, CURVE_THICKNESS,
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

            // WHICH WAY IT BOWS (`./tieDirection`): away from the stems as DRAWN — both of them,
            // since a tie has two ends and Gould's fallback (p. 64) is the case where they
            // disagree — and, when they do, away from the middle line of the clef in force. That
            // clef is read positionally like every other; it used to be the literal 'treble'.
            const stems = [fromInfo.staveNote, toInfo.staveNote]
              .map(n => n.getStemDirection?.())
              .filter((d): d is number => d !== undefined)
            const tieDirection = tieSide(
              pitch, slot.beat, measure,
              effectiveClefAt(score, fromMeasure, slot.beat, slot.staffId),
              stems,
            )
            // note alias for registry callbacks below
            const note = { id: pitch.id, tiedTo: pitch.tiedTo, measure: fromMeasure }

            // One SVG group per tie (keyed by its from-note id; both cross-line partials
            // live inside it) so the selection highlight can recolor exactly this tie
            // without a document-wide bbox path-scan — that scan bled onto staff lines
            // whose bbox fell inside the tie's rectangle (mirrors the slur fix).
            // `openGroup` prefixes class and id with `vf-` itself (see SlurRenderer).
            const tieGroup = pass.context.openGroup?.('tie', `tie-${pitch.id}`) as SVGGElement | undefined

            // A tie is drawn from the two notes' own coordinates, and those are in their staff's
            // space — so the tie is drawn in it too (docs/staff-size-plan.md §4.3). Both ends of a
            // tie are the same pitch on the same staff, including across a system break, so one
            // scale covers the whole thing.
            inStaffSpace(pass, staffIndexOfId(score, slot.staffId), tieGroup, () => {
              if (sameLine) {
                // Same line: draw flat arc anchored at the source note's Y
                // (ties always connect the same pitch, so both endpoints share the same Y)
                const bbox = drawFlatTie(pass, fromInfo, toInfo, tieDirection)
                if (bbox) {
                  pass.elementRegistry.add({
                    type: 'tie',
                    fromNoteId: note.id,
                    toNoteId: note.tiedTo!,
                    fromMeasure: fromMeasure,
                    toMeasure: toMeasure!,
                    tieDirection: tieDirection,
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
              firstPartialTie.setDirection(tieDirection)
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
                    tieDirection: tieDirection,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })
                }
              } catch (_e) {
                // getBoundingBox may fail
              }

              // Second partial: from start of line to note
              const secondPartialTie = new StaveTie({
                lastNote: toInfo.staveNote,
                lastIndexes: [toInfo.noteIndex],
              })
              secondPartialTie.setDirection(tieDirection)
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
                    tieDirection: tieDirection,
                    bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
                  })
                }
              } catch (_e) {
                // getBoundingBox may fail
              }
            }
            })

            pass.context.closeGroup?.()
            if (tieGroup) pass.tieGroupMap.set(pitch.id, tieGroup)
          } catch (e) {
            console.error('Could not render tie:', e)
          }
        }
      }
    }
  }
}
