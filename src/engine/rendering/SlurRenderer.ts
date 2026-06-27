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
import type { Stave } from 'vexflow'
import type { Score, CurveControlPointDeltas, SlurEndpointOffsetOverride } from '@/types/music'
import { slurNestDepths } from '@/utils/slurs'
import type { ElementInfo } from '@/engine/ElementRegistry'
import type { RenderPass } from './RenderPass'
import { drawCurveArc } from './curveArc'
import { curveShapeOverrideOf, segmentCurveShapeOverrideOf, reconcileSegmentShape, endpointOffsetOverrideOf, segmentEndpointOffsetOverrideOf, reconcileSegmentEndpointOffset } from '@/engine/models/engravingOverrides'
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

/** The post-render lookup data the system-edge helpers + segment planner need. A
 *  narrow slice of {@link RenderPass} so they stay pure & trivially unit-testable. */
export type SlurLayoutLookup = Pick<RenderPass, 'measureLayoutInfo' | 'measureBounds'>

/** X of a system's LEFT margin = the `noteStartX` of the **first** measure that
 *  landed on `line`. Undefined if no measure (or no bounds) on that line. */
export function lineLeftEdgeX(pass: SlurLayoutLookup, line: number): number | undefined {
  let firstMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (firstMeasure === undefined || num < firstMeasure) firstMeasure = num
  }
  return firstMeasure === undefined ? undefined : pass.measureBounds.get(firstMeasure)?.noteStartX
}

/** X of a system's RIGHT margin = the `noteEndX` of the **last** measure that
 *  landed on `line`. Undefined if no measure (or no bounds) on that line. */
export function lineRightEdgeX(pass: SlurLayoutLookup, line: number): number | undefined {
  let lastMeasure: number | undefined
  for (const [num, info] of pass.measureLayoutInfo) {
    if (info.lineNumber !== line) continue
    if (lastMeasure === undefined || num > lastMeasure) lastMeasure = num
  }
  return lastMeasure === undefined ? undefined : pass.measureBounds.get(lastMeasure)?.noteEndX
}

/**
 * One drawn piece of a slur. A same-line slur is a single `single`; a slur crossing
 * N systems is `begin` + (N−2)×`middle` + `end`, each anchored to the **system**
 * edges (not the endpoint notes' own measures — that measure-vs-system confusion was
 * the original bug). `firstX`/`lastX` are the note tie-edge Xs; `leftX`/`rightX` are
 * the system margins from the helpers above.
 */
export type SlurSegment =
  | { type: 'single' }
  | { type: 'begin'; firstX: number; rightX: number }
  | { type: 'middle'; leftX: number; rightX: number; line: number }
  | { type: 'end'; leftX: number; lastX: number }

/**
 * Pure decision: given the start/end lines and the two note tie-edge Xs, return the
 * ordered segments to draw. No VexFlow / ctx / StaveNote — the heart of the
 * multi-system fix, so it's unit-testable in isolation. A line whose system edge
 * can't be resolved is skipped (defensive; shouldn't happen for a rendered line).
 */
export function planSlurSegments(
  pass: SlurLayoutLookup,
  fromLine: number,
  toLine: number,
  firstX: number,
  lastX: number,
): SlurSegment[] {
  if (fromLine === toLine) return [{ type: 'single' }]
  const segments: SlurSegment[] = []
  for (let line = fromLine; line <= toLine; line++) {
    if (line === fromLine) {
      const rightX = lineRightEdgeX(pass, line)
      if (rightX !== undefined) segments.push({ type: 'begin', firstX, rightX })
    } else if (line === toLine) {
      const leftX = lineLeftEdgeX(pass, line)
      if (leftX !== undefined) segments.push({ type: 'end', leftX, lastX })
    } else {
      const leftX = lineLeftEdgeX(pass, line)
      const rightX = lineRightEdgeX(pass, line)
      if (leftX !== undefined && rightX !== undefined) segments.push({ type: 'middle', leftX, rightX, line })
    }
  }
  return segments
}

/**
 * The two TRUE, anchorable endpoints of a slur — the beginning point `p0` and the end
 * point `p1` — in screen pixels. Pure geometry: mirrors the same-line `p0`/`p1` that
 * carry the square re-anchor handles, so a cross-system slur can expose the same two
 * endpoints WITHOUT the round-shape control points. `lift`/`direction` match the render
 * path (`firstX`/`lastX` are the note tie edges; `fromY`/`toY` the stem-aware anchor Ys).
 */
export function slurTrueEndpoints(
  firstX: number,
  lastX: number,
  fromY: number,
  toY: number,
  lift: number,
  direction: number,
): { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number } {
  return {
    p0: { x: firstX, y: fromY + lift * direction },
    p1: { x: lastX, y: toY + lift * direction },
    direction,
  }
}

/**
 * A live `Stave` from any chord/rest rendered on `line`, used only for a MIDDLE
 * segment's vertical reference (staff top/bottom line). Returns undefined if the
 * line has no rendered element in `staveNoteMap` (e.g. not yet laid out).
 */
function representativeStaveOnLine(
  pass: RenderPass, score: Score, line: number,
): Stave | undefined {
  for (const m of score.measures) {
    if ((pass.measureLayoutInfo.get(m.number)?.lineNumber ?? 0) !== line) continue
    for (const s of m.slots) {
      const id = s.type === 'rest' ? s.id : s.type === 'chord' ? s.notes[0]?.id : undefined
      const stave = id ? pass.staveNoteMap.get(id)?.staveNote.getStave?.() : undefined
      if (stave) return stave
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
 * Resolve the cubic `cps` for one arc: a hand-edited override (stored in **staff-spaces**,
 * anchor-relative) converted to pixels against the live `stave`, else the auto arch. Shared
 * by the single-arc path and each cross-system segment (BEGIN/MIDDLE/END), so the
 * staff-space→pixel conversion lives in exactly one place. `extraHeight` only affects the
 * auto arch (a manual shape is fully authored — no nest lift on top).
 */
export function resolveCps(
  override: CurveControlPointDeltas | undefined,
  stave: Stave | undefined,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  direction: number,
  extraHeight: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  if (override && stave) {
    return [
      { x: staffSpacesToPixels(override[0].x, stave), y: staffSpacesToPixels(override[0].y, stave) },
      { x: staffSpacesToPixels(override[1].x, stave), y: staffSpacesToPixels(override[1].y, stave) },
    ]
  }
  return slurArchCps(p0, p1, direction, extraHeight)
}

/**
 * Resolve a slur's endpoint nudge (a {@link SlurEndpointOffsetOverride}, stored in
 * **staff-spaces**, anchor-relative) to per-end PIXEL deltas against each end's OWN stave
 * (see docs/slur-endpoint-offset-plan.md). A missing offset for an end — or a
 * not-yet-laid-out stave (`undefined`) — yields 0 for that end, so the caller can add the
 * result unconditionally without risking a throw inside `staffSpacesToPixels`. Pure +
 * VexFlow-light (reads only `getSpacingBetweenLines`), mirroring `resolveCps`.
 */
export function slurEndpointOffsetPx(
  offset: SlurEndpointOffsetOverride | undefined,
  fromStave: Stave | undefined,
  toStave: Stave | undefined,
): { startX: number; startY: number; endX: number; endY: number } {
  const conv = (o: { x: number; y: number } | undefined, stave: Stave | undefined) =>
    o && stave
      ? { x: staffSpacesToPixels(o.x, stave), y: staffSpacesToPixels(o.y, stave) }
      : { x: 0, y: 0 }
  const s = conv(offset?.start, fromStave)
  const e = conv(offset?.end, toStave)
  return { startX: s.x, startY: s.y, endX: e.x, endY: e.y }
}

/**
 * Resolve ONE open-join offset (a {@link SegmentEndpointOffsetOverride} slot, in
 * **staff-spaces**, margin-relative) to a PIXEL delta against that segment's own stave. A
 * missing offset — or a not-yet-laid-out stave (`undefined`) — yields `{0,0}`, so the caller
 * adds it unconditionally without risking a throw inside `staffSpacesToPixels`. The single-
 * point twin of `slurEndpointOffsetPx`, used for each cross-system open join (begin right /
 * end left / both middle ends).
 */
export function segmentEndpointOffsetPx(
  offset: { x: number; y: number } | undefined,
  stave: Stave | undefined,
): { x: number; y: number } {
  if (!offset || !stave) return { x: 0, y: 0 }
  return { x: staffSpacesToPixels(offset.x, stave), y: staffSpacesToPixels(offset.y, stave) }
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
    let fromY = slurEndpointY(fromInfo.staveNote, fromInfo.noteIndex, direction)
    let toY = slurEndpointY(toInfo.staveNote, toInfo.noteIndex, direction)
    if (fromY === undefined || toY === undefined || isNaN(fromY) || isNaN(toY)) continue

    const registerPartial = (
      half: { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[] },
      partialType?: 'start' | 'end' | 'middle',
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

      // Endpoint nudge (docs/slur-endpoint-offset-plan.md): a free anchor-relative offset
      // (staff-spaces) on top of each note anchor. Applied ONCE here, before the
      // single-vs-cross branch, so every downstream consumer — the arc, the auto-arch cps,
      // `slurTrueEndpoints`, and therefore the blue squares — flows from the shifted values.
      // `slurEndpointOffsetPx` converts against each end's OWN stave and yields 0 for a
      // not-yet-laid-out stave (no throw). The note tie-edge Xs are identical in both
      // branches, so lift them out here; Y folds into fromY/toY (both branches derive from
      // those).
      const off = slurEndpointOffsetPx(endpointOffsetOverrideOf(score, slur.id), fromNote.getStave(), toNote.getStave())
      const firstX = fromNote.getTieRightX() + off.startX
      const lastX = toNote.getTieLeftX() + off.endX
      fromY += off.startY
      toY += off.endY

      if (fromLine === toLine) {
        // Same line: a single arc from the start note to the end note.
        const startY = fromY + LIFT * direction
        const endY = toY + LIFT * direction
        const p0 = { x: firstX, y: startY }
        const p1 = { x: lastX, y: endY }
        // A hand-edited shape in the engraving-overrides compartment (stored in
        // staff-spaces) overrides the auto arch; absent → auto. Convert the override's
        // deltas to pixels against the live stave (resolution-independent storage).
        const stave = fromNote.getStave()
        const cps = resolveCps(curveShapeOverrideOf(score, slur.id)?.cps, stave, p0, p1, direction, nestLift)
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
        // Cross-system: one open-ended segment per system the slur crosses
        // (BEGIN + N×MIDDLE + END), each anchored to the **system** edges — not the
        // endpoint notes' own measures (that measure-vs-system confusion was the bug
        // that hid the arc on any non-boundary measure / dropped middle systems).
        // `firstX`/`lastX` (incl. the endpoint nudge) were lifted above the branch.
        // The two true endpoints (square re-anchor handles). Attach them to the FIRST
        // partial that actually registers — independent of which segment draws, since
        // planSlurSegments may defensively skip a system edge it can't resolve, so we
        // can't assume the BEGIN partial exists. NO controlPoints/staffSpacePx, so the
        // round shape handles stay off for a split slur (it has no single shared shape).
        const trueEnds = slurTrueEndpoints(firstX, lastX, fromY, toY, LIFT, direction)
        const spanCount = toLine - fromLine + 1
        let endpointsAttached = false
        // Register one segment partial: its round-handle context (controlPoints + the
        // SEGMENT's own endpoints + staff spacing + segment address + spanCount) plus, on
        // the FIRST registered partial only, the slur's TRUE ends for the square re-anchor
        // handles. `slurEndpoints` (trueEnds) and `segmentEndpoints` are deliberately
        // separate: squares re-anchor the whole slur, round handles bend this one segment.
        const registerSeg = (
          arc: { bbox: { x: number; y: number; width: number; height: number }; points: { x: number; y: number }[]; c0: { x: number; y: number }; c1: { x: number; y: number } },
          partialType: 'start' | 'end' | 'middle',
          segEnds: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number },
          stave: Stave | undefined,
          segmentRole: 'begin' | 'middle' | 'end',
          segmentOrdinal?: number,
        ) => {
          registerPartial(arc, partialType, {
            controlPoints: [arc.c0, arc.c1],
            segmentEndpoints: segEnds,
            staffSpacePx: stave?.getSpacingBetweenLines(),
            segmentRole,
            ...(segmentOrdinal !== undefined ? { segmentOrdinal } : {}),
            slurSpanCount: spanCount,
            ...(endpointsAttached ? {} : { slurEndpoints: trueEnds }),
          })
          endpointsAttached = true
        }
        // Per-segment hand-edited shapes (plan §3): read the override and apply the live
        // span-count staleness rule. BEGIN/END are note-anchored (durable) and use their
        // own note's stave; MIDDLEs are keyed by ordinal (reset on a count change) and use
        // the system's representative stave. Absent/stale entries fall back to the auto arch.
        const segShape = reconcileSegmentShape(segmentCurveShapeOverrideOf(score, slur.id), spanCount)
        // Per-open-join hand nudges (orange squares): same staleness rule as segShape — begin/end
        // durable, middles dropped on a count change. Added to each segment's OPEN end below,
        // BEFORE resolveCps, so the arch follows the moved point (mirrors the true-end offset).
        const segEndOff = reconcileSegmentEndpointOffset(segmentEndpointOffsetOverrideOf(score, slur.id), spanCount)
        let middleOrdinal = 0
        for (const seg of planSlurSegments(pass, fromLine, toLine, firstX, lastX)) {
          if (seg.type === 'begin') {
            // Start note → system right edge, rising to an open (flat-ish) right end.
            const startY = fromY + LIFT * direction
            const p0 = { x: seg.firstX, y: startY }
            const p1 = { x: seg.rightX, y: startY + ARC * direction }
            const stave = fromNote.getStave()
            // Open RIGHT end nudge (the true start p0 carries `endpointOffset` instead).
            const o = segmentEndpointOffsetPx(segEndOff.begin, stave)
            p1.x += o.x; p1.y += o.y
            const cps = resolveCps(segShape.begin, stave, p0, p1, direction, nestLift)
            registerSeg(
              drawCurveArc(pass, p0, p1, cps, direction, SLUR_THICKNESS, fromNote, toNote),
              'end', { p0, p1, direction }, stave, 'begin',
            )
          } else if (seg.type === 'end') {
            // System left edge → end note, the mirror of BEGIN. THIS is the 2-line
            // fix: leftX is the SYSTEM's left margin, not the end note's measure edge.
            const endY = toY + LIFT * direction
            const p0 = { x: seg.leftX, y: endY + ARC * direction }
            const p1 = { x: seg.lastX, y: endY }
            const stave = toNote.getStave()
            // Open LEFT end nudge (the true end p1 carries `endpointOffset` instead).
            const o = segmentEndpointOffsetPx(segEndOff.end, stave)
            p0.x += o.x; p0.y += o.y
            const cps = resolveCps(segShape.end, stave, p0, p1, direction, nestLift)
            registerSeg(
              drawCurveArc(pass, p0, p1, cps, direction, SLUR_THICKNESS, fromNote, toNote),
              'start', { p0, p1, direction }, stave, 'end',
            )
          } else if (seg.type === 'middle') {
            // A full-width bow across a system the slur merely passes over. Both ends
            // sit flat at a staff-relative baseline (above the top line / below the
            // bottom line per the slur's side); slurArchCps bows it symmetrically.
            const stave = representativeStaveOnLine(pass, score, seg.line)
            if (!stave) continue
            const baselineY = direction === -1
              ? stave.getTopLineTopY() - LIFT
              : stave.getBottomLineBottomY() + LIFT
            const p0 = { x: seg.leftX, y: baselineY }
            const p1 = { x: seg.rightX, y: baselineY }
            const ordinal = middleOrdinal++
            // Both open ends nudge independently (left + right) — ordinal-keyed, reset on a
            // count change with the rest of the middles.
            const mo = segEndOff.middles[ordinal]
            const ol = segmentEndpointOffsetPx(mo?.left, stave)
            const or = segmentEndpointOffsetPx(mo?.right, stave)
            p0.x += ol.x; p0.y += ol.y
            p1.x += or.x; p1.y += or.y
            const cps = resolveCps(segShape.middles[ordinal], stave, p0, p1, direction, nestLift)
            registerSeg(
              drawCurveArc(pass, p0, p1, cps, direction, SLUR_THICKNESS, fromNote, toNote),
              'middle', { p0, p1, direction }, stave, 'middle', ordinal,
            )
          }
        }
      }

      pass.context.closeGroup?.()
      if (group) pass.slurGroupMap.set(slur.id, group)
    } catch (e) {
      console.error('Could not render slur:', e)
    }
  }
}
