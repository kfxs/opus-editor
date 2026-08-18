/**
 * Slur (phrasing) rendering — extracted from {@link VexFlowRenderer}. Operates on
 * the passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Same-line spans draw a single cubic arc; cross-system spans draw two half-arcs.
 * Arc drawing routes through the shared {@link drawCurveArc} primitive (also used by
 * ties). Nesting and the auto arch shape live here; WHICH SIDE the slur sits on is
 * `./slurDirection` and WHERE IT ATTACHES at each end is `./slurStemEndpoint`.
 */
import { StaveNote } from 'vexflow'
import type { Stave } from 'vexflow'
import type { Score, CurveControlPointDeltas, SlurEndpointOffsetOverride } from '@/types/music'
import { slurNestDepths } from '@/utils/slurs'
import type { ElementInfo } from '@/engine/ElementRegistry'
import type { RenderPass } from './RenderPass'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { inStaffSpace } from './staffScaleGroup'
import { drawCurveArc } from './curveArc'
import { CURVE_PX, SLUR_ARCH_TILT } from './curveStyle'
import { curveShapeOverrideOf, segmentCurveShapeOverrideOf, reconcileSegmentShape, endpointOffsetOverrideOf, segmentEndpointOffsetOverrideOf, reconcileSegmentEndpointOffset } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'
import { coveredChordIds, slurSideFromStems } from './slurDirection'
import { slurAttachments, type SlurAttachment } from './slurStemEndpoint'
import { encompassCeiling } from './slurEncompass'
import { tiltWithThePitches } from './slurMelodicTilt'
import { slurArchHeight } from './slurArchHeight'
import { limitSlurSlant } from './slurSlantLimit'
import { slurArchClearance, type SlurObstacle } from './slurObstacles'
import { brokenSlurOpenRise } from './brokenSlurTilt'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { lineLeftCurveX, lineLeftEdgeX, lineRightEdgeX, type SystemEdgeLookup } from './systemEdges'
import { voiceOf } from '@/utils/lanes'

// Vertical geometry shared by all slur arcs, in pixels — ⛔ authored in STAFF SPACES in
// `./curveStyle`, where each number carries the research it answers to (docs/slur-plan.md §11–§13).
// A cubic's peak deviation is 0.75·H, so the 0.93 sp BOW reproduces the old quadratic's
// LIFT + ARC/2 peak. Phase 2 of §12 is the one that may replace this height law outright.
const SLUR_LIFT = CURVE_PX.slurLift       // gap between the notehead and the arc's endpoints
const SLUR_NEST_GAP = CURVE_PX.slurNestGap // extra bow height per nesting level (concentric slurs)
// ⭐ The arch HEIGHT is no longer here either: `./slurArchHeight` owns the law that turns a span into
// a bow. The slur's WEIGHT is not here: it is `CURVE_PX.thickness`, shared
// with ties, because the two are one weight and only the arch differs. This file used to set
// `SLUR_THICKNESS = 1.5` against the tie's 2.7, which drew visibly undernourished slurs beside
// well-fed ties.

/** Measure number containing the chord-head / rest id, or undefined if absent. */
function measureOfNoteId(score: Score, noteId: string): number | undefined {
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type === 'chord' && s.notes.some(p => p.id === noteId)) return m.number
      if (s.type === 'rest' && s.id === noteId) return m.number
      // A FANNED MEMBER lives inside the slot, not in `slot.notes` — and a slur can be anchored to
      // one (docs/fanned-beam-pitches-plan.md), so it has to name its measure like any other end.
      if (s.type === 'chord' && (s.fan?.members ?? []).some(mm => mm.pitches.some(p => p.id === noteId))) return m.number
    }
  }
  return undefined
}

/**
 * ⭐ ONE SLUR ENDPOINT, whatever it is anchored to — an ordinary note or a FANNED MEMBER.
 *
 * A member has no `StaveNote`: its head is drawn by hand, so the geometry a slur needs comes from
 * the anchor the fan renderer recorded (`RenderPass.fanMemberAnchorMap`). The `staveNote` it carries
 * is the SLOT's, and it is used for exactly two things — constructing VexFlow's `Curve` and asking
 * for the `Stave` — never for x or y. The endpoints reach `renderCurve` explicitly, which is what
 * makes anchoring to something VexFlow never drew possible at all.
 */
interface SlurEnd {
  staveNote: StaveNote
  /**
   * ⭐ Where the arc springs from / lands: the **CENTRE of the notehead** (docs/slur-plan.md §12
   * Phase 2). It used to be the note's tie EDGES — `getTieRightX()`/`getTieLeftX()` — which made a
   * slur span the gap BETWEEN two heads instead of reaching over them, roughly 0.6 sp short at each
   * end. All three engines anchor at the centre by three different constructions (MuseScore
   * `hw1 × 0.5`, LilyPond `first_head.extent.center()`, Verovio `drawingX += startRadius`), and Ross
   * p. 141 says it in words. ⛔ The TIE keeps the edges: its field is genuinely split (§13.3).
   */
  centerX: number
  /** The head, the stem's far end and its direction — what {@link slurAttachmentYs} decides from,
   *  and the one shape a fanned member and a real note can both be stated in. */
  attach: SlurAttachment
}

/**
 * The far end of a note's stem, or undefined when it has none to offer — so the attachment rule can
 * take absence as an answer rather than as a coordinate.
 *
 * 🚨 **`hasStem()` FIRST, and it is not defensive — it is the whole point.** A whole note has no
 * stem, but VexFlow builds a `Stem` object for it anyway and `getStemExtents()` answers with the
 * coordinates that stem WOULD have had. Asking a stemless note where its stem ends therefore returns
 * a number rather than nothing, and the endpoint rule then floats the slur up a stem the reader
 * cannot see: a slur between two whole notes a sixth apart left its first notehead by 2.25 sp of
 * empty air (his report, 2026-08-16). Both engines answer this the same way and neither by accident
 * — MuseScore skips its whole stem block when `stem1` is null (`slurtielayout.cpp:617`), and Verovio
 * tests `startStemLen == 0` in the *same condition* as a stem pointing away (`slur.cpp:677`).
 */
function stemTipOf(staveNote: StaveNote): number | undefined {
  try {
    if (!staveNote.hasStem?.()) return undefined
    const tipY = staveNote.getStemExtents?.()?.topY
    return tipY !== undefined && !isNaN(tipY) ? tipY : undefined
  } catch (_e) {
    return undefined
  }
}

function resolveSlurEnd(pass: RenderPass, noteId: string): SlurEnd | undefined {
  const member = pass.fanMemberAnchorMap.get(noteId)
  if (member) {
    return {
      staveNote: member.staveNote,
      centerX: (member.leftX + member.rightX) / 2,
      // A member's head and the point where its stem meets the beam mean exactly what a real note's
      // do, so the same rule reaches it with no branch of its own (docs/slur-plan.md §12.0 #7).
      attach: {
        headYs: [member.headY],
        stemTipY: member.tipY,
        stemDirection: member.stemDirection,
        headHalfWidth: (member.rightX - member.leftX) / 2,
      },
    }
  }
  const info = pass.staveNoteMap.get(noteId)
  if (!info?.staveNote) return undefined
  const { staveNote } = info
  // ⭐ ALL the chord's head ys — the arc springs from the OUTER one on the side it takes, which is
  // `slurStemEndpoint`'s call to make (§12 Phase 7). `noteIndex` is the pitch the user anchored to
  // and no longer decides the geometry.
  const ys = staveNote.getYs()
  // The head's own extent, which is where the arc belongs — NOT `getTieRightX()`, which adds the
  // glyph width AND any modifier shift, i.e. the far side of everything hanging off the note.
  const headLeft = staveNote.getNoteHeadBeginX()
  const headRight = staveNote.getNoteHeadEndX()
  return {
    staveNote,
    centerX: (headLeft + headRight) / 2,
    attach: {
      headYs: ys.length ? ys : [0],
      stemTipY: stemTipOf(staveNote),
      stemDirection: staveNote.getStemDirection?.() ?? -1,
      headHalfWidth: (headRight - headLeft) / 2,
    },
  }
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
  pass: SystemEdgeLookup,
  fromLine: number,
  toLine: number,
  firstX: number,
  lastX: number,
  /**
   * ⚠️ **How big the slur's staff is drawn** (1 = full size), and it is not optional in spirit.
   *
   * `firstX`/`lastX` come off the notes, so they are in the staff's OWN space — but a system edge
   * comes from `measureBounds`, which is where the bar landed in the SVG. Mixing the two was a real
   * defect for exactly one shape of music: a slur crossing a system break on a staff drawn small
   * stopped at `edge × k` instead of the edge, i.e. 30% short of the margin. Everything here is
   * handed to the drawing, which happens inside the staff's scale group, so the edges are converted
   * INTO that space here — the one place both kinds of number meet.
   */
  scale: number,
  /**
   * ⭐ **Which left boundary this family resumes at** — the one thing a CURVE and a LINE disagree
   * about at a system start, so it is the caller's to say and everything else here is shared.
   *
   * A slur or tie resumes after the header's INK ({@link lineLeftCurveX}, Gould p. 112 / p. 65). The
   * bracket families — ottava, pedal, trill, hairpin — keep the default, the MUSIC's own margin: each
   * already shifts its resumed label left of it by its own eye-tuned inset, and a boundary that moved
   * under them would move the labels onto the clef.
   */
  leftEdgeX: (pass: SystemEdgeLookup, line: number) => number | undefined = lineLeftEdgeX,
): SlurSegment[] {
  if (fromLine === toLine) return [{ type: 'single' }]
  const toLocal = (x: number | undefined): number | undefined => (x === undefined ? undefined : x / scale)
  const segments: SlurSegment[] = []
  for (let line = fromLine; line <= toLine; line++) {
    if (line === fromLine) {
      const rightX = toLocal(lineRightEdgeX(pass, line))
      if (rightX !== undefined) segments.push({ type: 'begin', firstX, rightX })
    } else if (line === toLine) {
      // ⭐⭐ **AFTER the clef, key and meter** — Gould p. 112, verbatim: *"At the beginning of the new
      // system, the slur starts after the clef, key signature and time signature, but before any
      // accidental."* Gerou & Lusk say the same independently, and all three engines land there
      // (⚠️ including Verovio, whose `GetLeftBarLineXRel` is AFTER the header — its alignment enum
      // orders the score-def clef before the left barline, which I misread as "before the clef" and
      // briefly copied). ⚠️ Which x that IS is `leftEdgeX`'s to say: `noteStartX` is the padded
      // boundary and measured equal to the first notehead, so a curve passes `lineLeftCurveX`.
      const leftX = toLocal(leftEdgeX(pass, line))
      if (leftX !== undefined) segments.push({ type: 'end', leftX, lastX })
    } else {
      const leftX = toLocal(leftEdgeX(pass, line))
      const rightX = toLocal(lineRightEdgeX(pass, line))
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
 * ⭐ **WHAT THE SLUR HAS TO CLEAR — collected from what VexFlow actually DREW** (§12 Phase 8).
 *
 * The covered chords come from `coveredChordIds`, the same scan `./slurDirection` uses to decide the
 * side: one lane, one span, rests excluded. For each, the note's own bounding box — which VexFlow
 * fills in post-draw and which deliberately spans head + stem + beam, so a beam over a run is in the
 * list without us hunting for `Beam` objects the render pass never kept.
 *
 * ⚠️ **Post-layout, and only post-layout.** These boxes are meaningless before the notes are drawn;
 * slurs render last, which is what makes this legal at all.
 * ⚠️ A note missing from `staveNoteMap` — anything that failed to draw — contributes nothing rather
 * than a zero box at the origin.
 */
function slurObstaclesOf(
  pass: RenderPass,
  score: Score,
  slur: { startNoteId: string; endNoteId: string },
): SlurObstacle[] {
  const boxes: SlurObstacle[] = []
  for (const id of coveredChordIds(score, slur.startNoteId, slur.endNoteId)) {
    const note = pass.staveNoteMap.get(id)?.staveNote
    if (!note) continue
    try {
      const b = note.getBoundingBox?.()
      if (b && !isNaN(b.x) && !isNaN(b.y) && b.w > 0) {
        boxes.push({ x: b.x, y: b.y, width: b.w, height: b.h })
      }
    } catch (_e) {
      // A note whose geometry VexFlow cannot answer for is simply not an obstacle.
    }
  }
  return boxes
}

/**
 * ⭐⭐ **WHAT A BROKEN HALF'S OPEN END HAS TO CLEAR — the nearest note ON ITS OWN SYSTEM**
 * (LilyPond's broken-bound rule; see `./brokenSlurTilt`). Returns that note's outer edge on the
 * slur's own side, in the same space the endpoint ys are in.
 *
 * ⭐ **The system is identified by the STAVE'S OWN TOP LINE, not by a measure number.** Every bar on
 * one system shares it, and it is a number the renderer already has for every drawn note — which is
 * the same reason `planSlurSegments` works off drawn edges rather than off the model.
 *
 * ⚠️ `getBoundingBox()` deliberately spans head + stem + beam, so on the stem side the edge is the
 * stem tip and on the notehead side the notehead — which is exactly what the curve must clear.
 * ⚠️ Undefined when nothing on that system could be measured; the caller then falls back to
 * LilyPond's own one-note case, a flat fragment.
 */
function nearestCoveredOuterY(
  pass: RenderPass,
  score: Score,
  slur: { startNoteId: string; endNoteId: string },
  /** The `getYForLine(0)` of the fragment's own stave — the system's identity. */
  systemTopY: number,
  /** `begin` takes the LAST covered note on that system, `end` the FIRST — the one its open end leaves. */
  half: 'begin' | 'end',
  /** −1 above / +1 below: which edge of the box is the slur's side. */
  direction: number,
): number | undefined {
  const found: { x: number; outer: number }[] = []
  for (const id of coveredChordIds(score, slur.startNoteId, slur.endNoteId)) {
    const note = pass.staveNoteMap.get(id)?.staveNote
    if (!note) continue
    try {
      const stave = note.getStave?.()
      if (!stave || Math.abs(stave.getYForLine(0) - systemTopY) > 1) continue
      const b = note.getBoundingBox?.()
      if (!b || isNaN(b.x) || isNaN(b.y) || !(b.w > 0)) continue
      found.push({ x: b.x, outer: direction === -1 ? b.y : b.y + b.h })
    } catch (_e) {
      // A note whose geometry VexFlow cannot answer for simply does not constrain the open end.
    }
  }
  if (found.length === 0) return undefined
  found.sort((a, b) => a.x - b.x)
  return (half === 'begin' ? found[found.length - 1] : found[0]).outer
}

/**
 * ⭐ **The slur's own melodic interval, in DIATONIC STEPS** — positive when the music resumes higher.
 *
 * 🚨 **From the MODEL, never from the drawn ys** (§12.0 #5): the two ends of a broken slur are on
 * different systems, so their y's differ by the distance between two staves and whatever the page
 * cast-off did. Cross-system coordinates are not one ruler.
 *
 * `undefined` when either end is not a pitched note — a slur anchored to a rest has no interval, and
 * the caller falls back to the flat base rise.
 */
function slurDiatonicInterval(score: Score, startNoteId: string, endNoteId: string): number | undefined {
  const posOf = (noteId: string): number | undefined => {
    for (const m of score.measures) {
      for (const slot of m.slots) {
        if (slot.type !== 'chord') continue
        const pitch = slot.notes.find(p => p.id === noteId)
          ?? (slot.fan?.members ?? []).flatMap(mm => mm.pitches).find(p => p.id === noteId)
        if (pitch?.step !== undefined && pitch.octave !== undefined) {
          return spellingDiatonicPos(pitch.step, pitch.octave)
        }
      }
    }
    return undefined
  }
  const from = posOf(startNoteId)
  const to = posOf(endNoteId)
  return from === undefined || to === undefined ? undefined : to - from
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
  lift: { c0: number; c1: number } = { c0: 0, c1: 0 },
): [{ x: number; y: number }, { x: number; y: number }] {
  const dy = p1.y - p0.y
  // HOW TALL is `./slurArchHeight` — a law, not a constant, and the one number in the family with no
  // published source (docs/slur-plan.md §12 Phase 2). `extraHeight` lifts an outer slur clear of the
  // slur(s) nested inside it (Phase 8).
  //
  // ⏭️ A short, steeply tilted slur should be rounder than this law asks (Verovio's minimum control
  // angle) — measured, costed and NOT built: see the tail of `./slurSlantLimit` for why it is a
  // shape decision rather than an import.
  const H = slurArchHeight(p1.x - p0.x, extraHeight)
  // ⭐ The two obstacle lifts are per-CONTROL (`./slurObstacles`) — the whole point of solving them
  // separately is that they may differ, so they are added here rather than folded into `H`.
  return [
    { x: 0, y: H + SLUR_ARCH_TILT * dy * direction + lift.c0 },
    { x: 0, y: H - SLUR_ARCH_TILT * dy * direction + lift.c1 },
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
  lift: { c0: number; c1: number } = { c0: 0, c1: 0 },
): [{ x: number; y: number }, { x: number; y: number }] {
  if (override && stave) {
    return [
      { x: staffSpacesToPixels(override[0].x, stave), y: staffSpacesToPixels(override[0].y, stave) },
      { x: staffSpacesToPixels(override[1].x, stave), y: staffSpacesToPixels(override[1].y, stave) },
    ]
  }
  return slurArchCps(p0, p1, direction, extraHeight, lift)
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
  // Nesting level per slur → extra bow height so concentric slurs don't collide.
  const nestDepths = slurNestDepths(score)

  for (const slur of score.slurs) {
    const fromEnd = resolveSlurEnd(pass, slur.startNoteId)
    const toEnd = resolveSlurEnd(pass, slur.endNoteId)
    if (!fromEnd || !toEnd) continue

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
    //    ⭐ Read across EVERY note the slur covers (`./slurDirection`), not just its first —
    //    LilyPond, MuseScore and Verovio all scan, and a one-note sample makes the answer
    //    depend on which end you started from.
    const fromMeasureData = score.measures.find(m => m.number === fromMeasure)
    const startSlot = fromMeasureData?.slots.find(
      s => s.type === 'chord' && (
        s.notes.some(p => p.id === slur.startNoteId)
        || (s.fan?.members ?? []).some(mm => mm.pitches.some(p => p.id === slur.startNoteId))),
    )
    const slurVoice = startSlot?.voice ?? voiceOf(slur)
    const multiVoice = fromMeasureData
      ? new Set(fromMeasureData.slots.map(s => voiceOf(s))).size > 1
      : false
    // The stems as DRAWN, over the whole span: a beam forces its group's direction, so the model's
    // answer and VexFlow's differ. A covered chord that was not rendered contributes nothing.
    const coveredIds = coveredChordIds(score, slur.startNoteId, slur.endNoteId)
    const coveredStems = coveredIds
      .map(id => pass.staveNoteMap.get(id)?.staveNote.getStemDirection?.())
      .filter((d): d is number => d !== undefined)
    // ⭐⭐ …and the same scan, one step further: the covered notes as INK, so the attachment can be
    // told what the slur has to get over (`./slurEncompass`). The two ANCHORED columns drop out —
    // the slur is attached to them, and an anchor that counted as an obstacle would push the slur
    // off its own note (LilyPond excludes them by the same test).
    // ⚠️ Identified by the STAVE NOTE, not by id: a covered id and an anchor id can be two pitches
    // of the same chord, and that column is the anchor's — one drawn note, one obstacle or none.
    const interiorInk = coveredIds
      .map(id => resolveSlurEnd(pass, id))
      .filter((e): e is SlurEnd =>
        e !== undefined && e.staveNote !== fromEnd.staveNote && e.staveNote !== toEnd.staveNote)
      .map(e => e.attach)
    const autoDir = multiVoice
      ? (slurVoice % 2 === 0 ? -1 : 1)
      : slurSideFromStems(coveredStems.length ? coveredStems : [fromEnd.attach.stemDirection])
    const direction = slur.placement === 'below' ? 1
      : slur.placement === 'above' ? -1
      : autoDir

    // Endpoint anchor Ys — `./slurStemEndpoint`, which owns all three of Gould's cases at once: the
    // notehead side attaches at the notehead, the stem side at the stem end, and when the two stems
    // OPPOSE (p. 111) the stem-side end slides down its stem until the slur tilts at half the
    // melodic interval instead of contradicting it. ⭐ It takes both ends together because that
    // last rule cannot be answered one end at a time.
    const placement = slurAttachments(
      fromEnd.attach, toEnd.attach, direction, LIFT,
      encompassCeiling(interiorInk, direction),
    )
    // ⚠️⚠️ A CEILING ON THE SLANT (`./slurSlantLimit`, §12 Phase 6) — HIS number, not an engraving
    // rule, and it lands HERE: after the attachment (Phase 1, which is what fixed our real slant
    // faults) and BEFORE the user's endpoint nudge, so a hand drag is still the last word.
    // ⭐⭐ …and then the slur is not allowed to run DOWNHILL against a rising phrase
    // (`./slurMelodicTilt`, Gould p. 112). It lands between the attachment and the slant ceiling
    // because it can only ever REDUCE the slant — the limiter below has less to do, never more.
    const tilted = tiltWithThePitches(
      fromEnd.attach, toEnd.attach, placement.from.y, placement.to.y, direction,
    )
    const slanted = limitSlurSlant(
      { x: fromEnd.centerX, y: tilted.fromY },
      { x: toEnd.centerX, y: tilted.toY },
    )
    let fromY = slanted.fromY
    let toY = slanted.toY
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
      // `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-slur' here would
      // yield `class="vf-vf-slur"`, which is what this used to do.
      const group = pass.context.openGroup?.('slur', `slur-${slur.id}`) as SVGGElement | undefined
      const slurStaffIndex = staffIndexOfId(score, startSlot?.staffId)

      // A slur is built from its two notes' own coordinates, which live in their staff's scaled
      // space — so it is drawn there too (docs/staff-size-plan.md §4.3). That covers its ARC, its
      // thickness, and the handles + sampled points it registers for hit-testing, all at once.
      // A slur never spans two staves today (cross-staff slurring is not modelled), so the start
      // note's staff is the slur's.
      inStaffSpace(pass, slurStaffIndex, group, () => {

        // ⭐⭐ **THE ARC, FILED AS AN OBSTACLE** — docs/trill-slur-clearance-plan.md P1. Every drawn
        // arc (this slur's, or each of a split slur's segments) goes on the render's curve
        // collection, so the outside-staff ladder planned after this pass can clear it: Gould p. 135
        // puts the trill outside all but a long slur, and until now nothing above the staff knew a
        // slur existed at all.
        //
        // ⚠️ **Filed HERE, inside `inStaffSpace`, on purpose.** These are the numbers the curve was
        // drawn from — the staff's own space — which is the space the reading families work in. The
        // registry's copies of the very same points are SCALED into SVG space by `withScale`, and
        // carry neither the staff nor the system, so they cannot answer this question
        // (`engine/layout/curveObstacleBand.ts` explains both).
        const fileCurve = (points: { x: number; y: number }[], line: number) =>
          pass.drawnCurves.push({ staff: slurStaffIndex, line, points })

        const fromNote = fromEnd.staveNote
        const toNote = toEnd.staveNote
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
        // …and the stem dodge (`./slurStemEndpoint`) rides along on the same two x's: an endpoint
        // that landed beside a stem steps past it, so the arc leaves from beyond the stem rather
        // than across it. It is 0 for every end with no stem in the way.
        const off = slurEndpointOffsetPx(endpointOffsetOverrideOf(score, slur.id), fromNote.getStave(), toNote.getStave())
        const firstX = fromEnd.centerX + off.startX + placement.from.dx
        const lastX = toEnd.centerX + off.endX + placement.to.dx
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
          // ⭐ PHASE 8, first pass: raise the arch over anything it covers (`./slurObstacles`).
          // ⛔ Only the AUTO arch — a hand-edited shape is the user's and opts out, the same rule the
          // nest lift follows, so the lift is folded in as extra height rather than applied after.
          const shapeOverride = curveShapeOverrideOf(score, slur.id)?.cps
          const clearance = shapeOverride
            ? { c0: 0, c1: 0 }
            : slurArchClearance(p0, p1, slurArchHeight(p1.x - p0.x, nestLift), direction,
              slurObstaclesOf(pass, score, slur))
          const cps = resolveCps(shapeOverride, stave, p0, p1, direction, nestLift, clearance)
          const arc = drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness, fromNote, toNote)
          fileCurve(arc.points, fromLine)
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
            /** ⭐ THIS SEGMENT's own system — the one thing the registry entry cannot say, since
             *  every partial carries the whole slur's `fromMeasure`/`toMeasure`. The obstacle
             *  collection needs it, so it is passed rather than re-derived. */
            line: number,
            segEnds: { p0: { x: number; y: number }; p1: { x: number; y: number }; direction: number },
            stave: Stave | undefined,
            segmentRole: 'begin' | 'middle' | 'end',
            segmentOrdinal?: number,
          ) => {
            fileCurve(arc.points, line)
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
          // ⭐ Gould p. 112: each open end leans toward the pitch on the other side of the break —
          // read from the MODEL, since the two ends' y's are on different systems (§12.0 #5). A slur
          // anchored to a rest has no interval, and leans by nothing.
          const steps = slurDiatonicInterval(score, slur.startNoteId, slur.endNoteId)
          // ⭐⭐ …and it leans from the height of the music BESIDE it (LilyPond), not from a constant
          // off the far anchor — `nearestCoveredOuterY` + `./brokenSlurTilt`. `startY` is the
          // fragment's own anchored endpoint, so the clearance comes back in the same rise unit.
          const openRise = (half: 'begin' | 'end', lengthPx: number, startY: number, stave: Stave | undefined) => {
            const outer = stave === undefined ? undefined
              : nearestCoveredOuterY(pass, score, slur, stave.getYForLine(0), half, direction)
            const clearance = outer === undefined ? 0 : (outer - startY) * direction + LIFT
            return brokenSlurOpenRise(steps ?? 0, half, direction, lengthPx, clearance)
          }
          let middleOrdinal = 0
          for (const seg of planSlurSegments(pass, fromLine, toLine, firstX, lastX, pass.staffScale(slurStaffIndex), lineLeftCurveX)) {
            if (seg.type === 'begin') {
              // Start note → system right edge, rising to an OPEN right end that leans toward the
              // music on the next system (`./brokenSlurTilt`, Gould p. 112).
              const startY = fromY + LIFT * direction
              const stave = fromNote.getStave()
              const p0 = { x: seg.firstX, y: startY }
              const p1 = {
                x: seg.rightX,
                y: startY + openRise('begin', seg.rightX - seg.firstX, startY, stave) * direction,
              }
              // Open RIGHT end nudge (the true start p0 carries `endpointOffset` instead).
              const o = segmentEndpointOffsetPx(segEndOff.begin, stave)
              p1.x += o.x; p1.y += o.y
              const cps = resolveCps(segShape.begin, stave, p0, p1, direction, nestLift)
              registerSeg(
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness, fromNote, toNote),
                'end', fromLine, { p0, p1, direction }, stave, 'begin',
              )
            } else if (seg.type === 'end') {
              // System left edge → end note, the mirror of BEGIN. THIS is the 2-line
              // fix: leftX is the SYSTEM's left margin, not the end note's measure edge. Its open
              // LEFT end leans the opposite way, so the two fragments point at each other.
              const endY = toY + LIFT * direction
              const stave = toNote.getStave()
              // ⛔ NO vertical dodge around the clef: the fragment starts after it, so there is
              // nothing to dodge. LilyPond makes the same point in the strongest available form — it
              // EXCLUDES Clef, KeySignature and TimeSignature from the code that lifts a slur's
              // endpoint (`slur-scoring.cc:302–308`), while still letting them score against the
              // curve. Raising a slur to clear the clef is the wrong fix, and I shipped it once.
              const p0 = {
                x: seg.leftX,
                y: endY + openRise('end', seg.lastX - seg.leftX, endY, stave) * direction,
              }
              const p1 = { x: seg.lastX, y: endY }
              // Open LEFT end nudge (the true end p1 carries `endpointOffset` instead).
              const o = segmentEndpointOffsetPx(segEndOff.end, stave)
              p0.x += o.x; p0.y += o.y
              const cps = resolveCps(segShape.end, stave, p0, p1, direction, nestLift)
              registerSeg(
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness, fromNote, toNote),
                'start', toLine, { p0, p1, direction }, stave, 'end',
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
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness, fromNote, toNote),
                'middle', seg.line, { p0, p1, direction }, stave, 'middle', ordinal,
              )
            }
          }
        }

      })

      pass.context.closeGroup?.()
      if (group) pass.slurGroupMap.set(slur.id, group)
    } catch (e) {
      console.error('Could not render slur:', e)
    }
  }
}
