/**
 * Tie rendering — extracted from {@link VexFlowRenderer}. Operates entirely on the
 * passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * ⭐⭐ **ONE PRIMITIVE FOR EVERY TIE** (docs/slur-plan.md §12 Phase 3b, his call 2026-08-16:
 * *"vexflow draw something and us another? i dont like this inconsistence"*). A same-line tie, both
 * halves of one crossing a system break, the pending preview and the armed tool's ghost all draw
 * through {@link drawCurveArc} with the same bow and the same weight. Three of those four used to be
 * VexFlow `StaveTie`s — a **quadratic** with `cp1: 8 / cp2: 12`, i.e. a 4 px belly against our 2.7,
 * and below a length cutoff it silently swapped in `cp1Short: 2`, an apex of 0.1 sp where ours is
 * 0.4. The same tie changed shape when it crossed a break, and again the moment you committed it.
 *
 * WHICH WAY the arc bows is {@link ./tieDirection}; WHERE it attaches is {@link ./tieEndpoints};
 * whether a staff line runs through it is {@link ./tieStaffLineClearance}. This file draws.
 */
import { StaveNote } from 'vexflow'
import type { Stave } from 'vexflow'
import type { Score } from '@/types/music'
import { effectiveClefAt } from '@/utils/clefUtils'
import type { RenderPass } from './RenderPass'
import { drawCurveArc } from './curveArc'
import { CURVE_PX } from './curveStyle'
import { tieSide } from './tieDirection'
import { tieEndpointX, tieEndpointY, type TieHead } from './tieEndpoints'
import { tieArcGrowth } from './tieStaffLineClearance'
import { lineLeftCurveX, lineRightEdgeX } from './systemEdges'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { inStaffSpace } from './staffScaleGroup'

/** A cubic's drawn apex is 0.75 × its control height — the tie's 0.53 sp bow gives 0.40 sp. */
const APEX_OF_BOW = 0.75

/** The head extent + y a tie attaches to, for one end of it. */
function headOf(info: { staveNote: StaveNote; noteIndex: number }): TieHead | null {
  const ys = info.staveNote.getYs()
  const headY = ys[info.noteIndex] ?? ys[0]
  if (headY === undefined || isNaN(headY)) return null
  return {
    leftX: info.staveNote.getNoteHeadBeginX(),
    rightX: info.staveNote.getNoteHeadEndX(),
    headY,
  }
}

/** Every staff line's y, for the clearance test. Empty when the stave isn't laid out yet. */
function staffLineYs(stave: Stave | undefined): number[] {
  if (!stave) return []
  const ys: number[] = []
  for (let line = 0; line < stave.getNumLines(); line++) ys.push(stave.getYForLine(line))
  return ys
}

/**
 * Draw ONE tie arc — flat, symmetric, its apex at the X midpoint — and answer where its ink landed.
 *
 * A tie joins one pitch, so both endpoints share a y; each drawn piece is symmetric **within
 * itself**, which is what Gould's *"keeps its symmetrical shape"* across a system break asks for
 * (§13.7: all three engines draw the two halves as independent flat arcs, and none makes them
 * match). `stave` is only for the staff-line clearance — pass undefined to skip it, which is what
 * the cursor previews do.
 */
export function drawTieArc(
  pass: Pick<RenderPass, 'context'>,
  geom: { firstX: number; lastX: number; y: number; direction: number },
  notes: { from: StaveNote; to: StaveNote },
  stave?: Stave,
): { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[] } | null {
  if (!pass.context) return null
  try {
    // A staff line running ALONGSIDE the arc is the fault (Gould p. 61). The repair makes the arc
    // ROUNDER and leaves the tips on their noteheads — his eye, 2026-08-16, on a translation that
    // had lifted them off (`./tieStaffLineClearance`).
    const growth = tieArcGrowth({
      endpointY: geom.y,
      apexRise: APEX_OF_BOW * CURVE_PX.tieBow,
      inkThickness: APEX_OF_BOW * CURVE_PX.thickness + CURVE_PX.outline,
      direction: geom.direction,
      lineYs: staffLineYs(stave),
    })
    const bow = CURVE_PX.tieBow + growth / APEX_OF_BOW
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: bow },
      { x: 0, y: bow },
    ]
    const arc = drawCurveArc(
      pass, { x: geom.firstX, y: geom.y }, { x: geom.lastX, y: geom.y }, cps,
      geom.direction, CURVE_PX.thickness, notes.from, notes.to,
    )
    return { bbox: arc.bbox, points: arc.points }
  } catch (e) {
    console.error('Could not draw tie arc:', e)
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

            const fromHead = headOf(fromInfo)
            const toHead = headOf(toInfo)
            if (!fromHead || !toHead) continue

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
            const staffIndex = staffIndexOfId(score, slot.staffId)
            inStaffSpace(pass, staffIndex, tieGroup, () => {
              const notes = { from: fromInfo.staveNote, to: toInfo.staveNote }
              const register = (
                arc: { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[] } | null,
                /** ⭐ THIS arc's own system — a cross-system tie draws one on each, and the obstacle
                 *  collection cannot tell them apart afterwards (the registry entry carries the
                 *  whole tie's two measures). */
                line: number,
                partial?: 'start' | 'end',
              ) => {
                if (!arc) return
                // ⭐⭐ **THE ARC, FILED AS AN OBSTACLE** — docs/trill-slur-clearance-plan.md P1, the
                // slur's twin next door. The tie is the case Gould draws (p. 139, *Change of
                // trilling note*: ties hugging the noteheads with the wavy line above them), and a
                // trill's span runs *through* ties by definition, so this is the commoner of the
                // two collisions rather than the exotic one.
                // ⚠️ In the staff's own space — these are the drawn numbers, not the registry's
                // scaled copies (`engine/layout/curveObstacleBand.ts`).
                pass.drawnCurves.push({ staff: staffIndex, line, points: arc.points })
                pass.elementRegistry.add({
                  type: 'tie',
                  fromNoteId: note.id,
                  toNoteId: note.tiedTo!,
                  fromMeasure,
                  toMeasure: toMeasure!,
                  tieDirection,
                  bbox: arc.bbox,
                  // ⭐ The sampled arc, so a press lands on the INK — a tie used to be the one span
                  // element selectable by the empty air under its curve (§12 Phase 7, folded in
                  // here because the migration hands us these points for free).
                  points: arc.points,
                  ...(partial ? { isPartial: true, partialType: partial } : {}),
                })
              }

              if (sameLine) {
                register(drawTieArc(pass, {
                  firstX: tieEndpointX(fromHead, 'from'),
                  lastX: tieEndpointX(toHead, 'to'),
                  y: tieEndpointY(fromHead.headY, tieDirection),
                  direction: tieDirection,
                }, notes, fromInfo.staveNote.getStave()), fromLine)
              } else {
                // ⭐ Across a system break: two independent flat arcs, each running to its own
                // system's margin — the same construction the SLUR uses (`./systemEdges`), where
                // this used to be VexFlow's `StaveTie` deciding its own extent. A system edge comes
                // from `measureBounds`, i.e. where the bar landed in the SVG, so it is converted
                // into the staff's own space here (the small-staff rule, docs/staff-size-plan.md).
                const scale = pass.staffScale(staffIndex)
                const rightEdge = lineRightEdgeX(pass, fromLine)
                // ⭐ Gould p. 65 gives the tie the slur's own rule — *"at the start of a new system
                // the tie begins after the clef, key signature and time signature"* — so it resumes
                // after the header's INK, not at the padded `noteStartX` (`./systemEdges`).
                const leftEdge = lineLeftCurveX(pass, toLine)
                if (rightEdge !== undefined) {
                  register(drawTieArc(pass, {
                    firstX: tieEndpointX(fromHead, 'from'),
                    lastX: rightEdge / scale,
                    y: tieEndpointY(fromHead.headY, tieDirection),
                    direction: tieDirection,
                  }, notes, fromInfo.staveNote.getStave()), fromLine, 'end')
                }
                if (leftEdge !== undefined) {
                  register(drawTieArc(pass, {
                    firstX: leftEdge / scale,
                    lastX: tieEndpointX(toHead, 'to'),
                    y: tieEndpointY(toHead.headY, tieDirection),
                    direction: tieDirection,
                  }, notes, toInfo.staveNote.getStave()), toLine, 'start')
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
