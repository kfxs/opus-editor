/**
 * Slur (phrasing) rendering — extracted from {@link VexFlowRenderer}. Operates on
 * the passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Same-line spans draw a single cubic arc; cross-system spans draw two half-arcs.
 * Arc drawing routes through the shared {@link drawCurveArc} primitive (also used by
 * ties). Nesting, stem-aware endpoints and the auto arch shape live here.
 */
import { StaveNote } from 'vexflow'
import type { Score } from '@/types/music'
import { slurNestDepths } from '@/utils/slurs'
import type { ElementInfo } from '@/engine/ElementRegistry'
import type { RenderPass } from './RenderPass'
import { drawCurveArc } from './curveArc'
import { curveShapeOverrideOf } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'

// Vertical geometry shared by all slur arcs.
const SLUR_LIFT = 10   // gap between the notehead and the arc's endpoints
const SLUR_ARC = 14    // cross-system half-arc apex rise above its endpoint line
// Default cubic control-point bow height (the two symmetric `cps` deltas fed to
// Curve.renderCurve). A cubic's peak deviation is 0.75·H, so H≈9.3 reproduces the
// old quadratic's LIFT + ARC/2 = 17px peak. Phase 6 will let a slur override this.
const SLUR_BOW = 9.3        // base arch height (short slurs ≈ old look)
const SLUR_BOW_PER_PX = 0.06 // arch height grows with horizontal span…
const SLUR_BOW_MAX = 22      // …up to this ceiling (Gould: longer → taller, capped)
const SLUR_NEST_GAP = 10     // extra bow height per nesting level (concentric slurs)
const SLUR_THICKNESS = 1.5   // Curve.renderCurve return-pass offset (mid swell)

/** Measure number containing the chord-head / rest id, or undefined if absent. */
function measureOfNoteId(score: Score, noteId: string): number | undefined {
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type === 'chord' && s.notes.some(p => p.id === noteId)) return m.number
      if (s.type === 'rest' && s.id === noteId) return m.number
    }
  }
  return undefined
}

/**
 * Stem-aware slur endpoint Y for one anchor note (Gould): if the slur sits on the
 * **notehead side** (opposite the stems) it attaches at the notehead; if it sits on
 * the **stem side** (same side as the stems) it attaches at the **stem tip** instead,
 * so the arc springs from the stem end rather than crossing it. `direction` is the
 * slur's side (-1 above / +1 below); the note's own `getStemDirection()` (1 up / -1
 * down) decides which side the stem is on. Falls back to the notehead if there's no
 * usable stem extent (e.g. whole notes).
 */
function slurEndpointY(staveNote: StaveNote, noteIndex: number, direction: number): number {
  const ys = staveNote.getYs()
  const headY = ys[noteIndex] ?? ys[0]
  const stemUp = (staveNote.getStemDirection?.() ?? -1) === 1
  const slurAbove = direction === -1
  if (slurAbove === stemUp) {
    // Slur is on the stem side → attach at the stem tip.
    const tipY = staveNote.getStemExtents?.()?.topY
    if (tipY !== undefined && !isNaN(tipY)) return tipY
  }
  return headY
}

/**
 * Compute the cubic `cps` (control-point deltas for `Curve.renderCurve`) that bow the
 * arc by `SLUR_BOW` **vertically above the line between its endpoints** — the two control
 * points stay horizontally centered (no sideways shift) and lift straight up, *following*
 * the chord's slope. This is the engraving default (MuseScore: "slight contour asymmetry,
 * avoid forced tilt"):
 *  - flat / unison → symmetric `[{0,BOW},{0,BOW}]` (perfectly even);
 *  - small interval / close notes → full height, gentle lean, no sideways skew;
 *  - wide leap → clean arch parallel to the contour, no hook and no lopsided air-gap.
 *
 * An earlier *perpendicular* offset shifted the control points sideways by `∝ dy/len`,
 * which blew up for closely-spaced steps (seconds went flat-and-skewed) — hence the
 * vertical-above-chord-line formula here.
 *
 * `renderCurve` places each control point at `(endpointX ± dx/4, endpointY + cp.y·dir)`;
 * we target the chord line at 25%/75% lifted by `BOW`, then invert to recover the deltas.
 */
function slurArchCps(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  direction: number,
  extraHeight = 0,
): [{ x: number; y: number }, { x: number; y: number }] {
  const dy = p1.y - p0.y
  // Arch height grows with horizontal span (Gould/MuseScore: a longer slur arcs higher),
  // floored at the base bow so seconds stay modest and capped so long slurs don't balloon.
  // `extraHeight` lifts an outer slur clear of the slur(s) nested inside it (Phase 8).
  const span = Math.abs(p1.x - p0.x)
  const H = Math.min(
    SLUR_BOW + span * SLUR_BOW_PER_PX,
    SLUR_BOW_MAX,
  ) + extraHeight
  return [
    { x: 0, y: H + 0.25 * dy * direction },
    { x: 0, y: H - 0.25 * dy * direction },
  ]
}

/**
 * Render phrasing slurs from {@link Score.slurs}. Each slur is anchored to a
 * start/end head id; both resolve through `staveNoteMap` to their containing
 * chord's StaveNote (a slur arcs over the whole event, not one pitch).
 *
 * Same-line spans draw one arc. Cross-system spans (endpoints on different lines)
 * draw **two half-arcs** (Gould / Sibelius): the first trails off the right edge
 * of the start note's system, the second leads in from the left edge of the end
 * note's system. Each slur (and both its partials) is wrapped in one
 * `<g class="vf-slur">` group for scoped highlight, and registered in the
 * ElementRegistry with sampled arc `points` for proximity hit-testing.
 */
export function renderSlurs(pass: RenderPass, score: Score): void {
  if (!pass.context || !score.slurs) return

  const LIFT = SLUR_LIFT
  const ARC = SLUR_ARC
  // Nesting level per slur → extra bow height so concentric slurs don't collide.
  const nestDepths = slurNestDepths(score)

  for (const slur of score.slurs) {
    const fromInfo = pass.staveNoteMap.get(slur.startNoteId)
    const toInfo = pass.staveNoteMap.get(slur.endNoteId)
    if (!fromInfo?.staveNote || !toInfo?.staveNote) continue

    const fromMeasure = measureOfNoteId(score, slur.startNoteId)
    const toMeasure = measureOfNoteId(score, slur.endNoteId)
    if (fromMeasure === undefined || toMeasure === undefined) continue

    const fromLine = pass.measureLayoutInfo.get(fromMeasure)?.lineNumber ?? 0
    const toLine = pass.measureLayoutInfo.get(toMeasure)?.lineNumber ?? 0

    // Placement (direction -1 = arc above the notes, +1 = below):
    //  - explicit `placement` override always wins;
    //  - in a MULTI-VOICE bar, follow the VOICE's outer side (Gould): upper voice
    //    (V1) above, lower voices (V2) below — regardless of stem/contour — so the
    //    two voices' slurs spread apart instead of colliding. Mirrors the tie /
    //    stem / articulation / tuplet-bracket rule;
    //  - otherwise (single voice) follow the stems, notehead-side (Gould): stems up →
    //    slur below, stems down → slur above. VexFlow getStemDirection() is 1 (up) /
    //    -1 (down), which maps directly onto our +1 (below) / -1 (above).
    const fromMeasureData = score.measures.find(m => m.number === fromMeasure)
    const startSlot = fromMeasureData?.slots.find(
      s => s.type === 'chord' && s.notes.some(p => p.id === slur.startNoteId),
    )
    const slurVoice = startSlot?.voice ?? slur.voice ?? 0
    const multiVoice = fromMeasureData
      ? new Set(fromMeasureData.slots.map(s => s.voice ?? 0)).size > 1
      : false
    const autoDir = multiVoice
      ? (slurVoice === 0 ? -1 : 1)
      : ((fromInfo.staveNote.getStemDirection?.() ?? -1) === 1 ? 1 : -1)
    const direction = slur.placement === 'below' ? 1
      : slur.placement === 'above' ? -1
      : autoDir

    // Endpoint anchor Ys — stem-aware (Gould): a slur on the NOTEHEAD side attaches at
    // the notehead; on the STEM side it attaches at the stem tip. Each endpoint uses
    // its own note's stem, so a flipped (stem-side) slur springs from the stem tips.
    const fromY = slurEndpointY(fromInfo.staveNote, fromInfo.noteIndex, direction)
    const toY = slurEndpointY(toInfo.staveNote, toInfo.noteIndex, direction)
    if (fromY === undefined || toY === undefined || isNaN(fromY) || isNaN(toY)) continue

    const registerPartial = (
      half: { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[] },
      partialType?: 'start' | 'end',
      extra?: Partial<ElementInfo>,
    ) => pass.elementRegistry.add({
      type: 'slur', id: slur.id, fromNoteId: slur.startNoteId, toNoteId: slur.endNoteId,
      fromMeasure, toMeasure, bbox: half.bbox, points: half.points, slurDirection: direction,
      ...(partialType ? { isPartial: true, partialType } : {}),
      ...extra,
    })

    try {
      // One SVG group per slur (both partials live inside it) so the selection
      // highlight can recolor exactly this slur without a bbox path-scan.
      const group = pass.context.openGroup?.('vf-slur', `vf-slur-${slur.id}`) as SVGGElement | undefined

      const fromNote = fromInfo.staveNote
      const toNote = toInfo.staveNote
      // Outer slurs (those enclosing nested slurs) arch higher so concentric arcs
      // don't collide. A manual `cps` shape opts out — the user controls that height.
      const nestLift = (nestDepths.get(slur.id) ?? 0) * SLUR_NEST_GAP

      if (fromLine === toLine) {
        // Same line: a single arc from the start note to the end note.
        const firstX = fromNote.getTieRightX()
        const lastX = toNote.getTieLeftX()
        const startY = fromY + LIFT * direction
        const endY = toY + LIFT * direction
        const p0 = { x: firstX, y: startY }
        const p1 = { x: lastX, y: endY }
        // A hand-edited shape in the engraving-overrides compartment (stored in
        // staff-spaces) overrides the auto arch; absent → auto. Convert the override's
        // deltas to pixels against the live stave (resolution-independent storage).
        const stave = fromNote.getStave()
        const override = curveShapeOverrideOf(score, slur.id)
        const cps = override && stave
          ? [
              { x: staffSpacesToPixels(override.cps[0].x, stave), y: staffSpacesToPixels(override.cps[0].y, stave) },
              { x: staffSpacesToPixels(override.cps[1].x, stave), y: staffSpacesToPixels(override.cps[1].y, stave) },
            ] as [{ x: number; y: number }, { x: number; y: number }]
          : slurArchCps(p0, p1, direction, nestLift)
        const arc = drawCurveArc(pass, p0, p1, cps, direction, SLUR_THICKNESS, fromNote, toNote)
        // Store the on-screen control points + endpoint geometry so a selected slur can
        // show draggable handles (Phase 7), plus the stave's staff-space size so a handle
        // drag can convert the new pixel shape back to staff-spaces for storage. Same-line
        // only — a split slur shares one shape, so it gets no handles.
        registerPartial(arc, undefined, {
          controlPoints: [arc.c0, arc.c1],
          slurEndpoints: { p0, p1, direction },
          staffSpacePx: stave?.getSpacingBetweenLines(),
        })
      } else {
        // Cross-system: two half-arcs.
        const fromStave = fromNote.getStave()
        const toStave = toNote.getStave()
        if (fromStave && toStave) {
          // First (trailing) half: from the start note rising to the system's right edge.
          const firstX = fromNote.getTieRightX()
          const rightEdge = fromStave.getNoteEndX()
          const startY = fromY + LIFT * direction
          const apex1 = startY + ARC * direction
          const h1p0 = { x: firstX, y: startY }
          const h1p1 = { x: rightEdge, y: apex1 }
          registerPartial(
            drawCurveArc(pass, h1p0, h1p1, slurArchCps(h1p0, h1p1, direction, nestLift), direction, SLUR_THICKNESS, fromNote, toNote),
            'end',
          )
          // Second (leading) half: from the next system's left edge down into the end note.
          const lastX = toNote.getTieLeftX()
          const leftEdge = toStave.getNoteStartX()
          const endY = toY + LIFT * direction
          const apex2 = endY + ARC * direction
          const h2p0 = { x: leftEdge, y: apex2 }
          const h2p1 = { x: lastX, y: endY }
          registerPartial(
            drawCurveArc(pass, h2p0, h2p1, slurArchCps(h2p0, h2p1, direction, nestLift), direction, SLUR_THICKNESS, fromNote, toNote),
            'start',
          )
        }
      }

      pass.context.closeGroup?.()
      if (group) pass.slurGroupMap.set(slur.id, group)
    } catch (e) {
      console.error('Could not render slur:', e)
    }
  }
}
