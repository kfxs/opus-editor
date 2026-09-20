/**
 * Slur (phrasing) rendering — extracted from {@link ScoreRenderer}. Operates on
 * the passed-in {@link RenderPass} + score (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Same-line spans draw a single cubic arc; cross-system spans draw two half-arcs.
 * Arc drawing routes through the shared {@link drawCurveArc} primitive (also used by
 * ties). Nesting and the auto arch shape live here; WHICH SIDE the slur sits on is
 * `./slurDirection` and WHERE IT ATTACHES at each end is `./slurStemEndpoint`.
 */
import type { EngravedNote } from '../engraved/EngravedNote'
import type { Score, CurveControlPointDeltas, SlurEndpointOffsetOverride } from '@/types/music'
import { slurNestDepths } from '@/utils/slurs'
import type { ElementInfo, GuideLine } from '@/engine/ElementRegistry'
import type { RenderPass } from '../RenderPass'
import { drawGroupOf, svgNode } from '../painter/svgDrawGroup'
import { staffIndexOfId } from '@/engine/models/staffContent'
import { inStaffSpace } from '../staff/staffScaleGroup'
import { curveArcPoints } from '@/engine/engrave/curves/curveInk'
import { drawCurveArc } from './curveArc'
import { CURVE_PX } from './curveStyle'
import { articulationEdge, endpointLiftOverMark } from './slurArticulationEndpoint'
import { curveShapeOverrideOf, segmentCurveShapeOverrideOf, reconcileSegmentShape, endpointOffsetOverrideOf, slurOffsetOverrideOf, segmentEndpointOffsetOverrideOf, reconcileSegmentEndpointOffset } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from '../staff/staffSpace'
import { coveredChordIds, slurSideFromStems } from './slurDirection'
import { slurAttachments, type SlurAttachment } from './slurStemEndpoint'
import { encompassCeiling } from './slurEncompass'
import { tiltWithThePitches } from './slurMelodicTilt'
import { archLean, slurArchHeightFor } from './slurArchHeight'
import { slurIndentFraction } from './slurShapeExperiment'
import { limitSlurSlant } from './slurSlantLimit'
import { slurArchFit, type SlurObstacle } from './slurObstacles'
import { accidentalAvoidPoint } from './slurAccidentalPoint'
import { accidentalsOn } from '../engraved/EngravedAccidental'
import { noteInkBox } from '../engraved/noteInkBox'
import { brokenSlurOpenRise } from './brokenSlurTilt'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { lineLeftCurveX } from '../staff/systemEdges'
import { planSpanSegments } from '../marks/spanSegments'
import { voiceOf } from '@/utils/lanes'
import { noteFrame } from '../staff/staveFrame'
import { staffBottomLineY, staffLineY, type StaffFrame } from '@/engine/engrave/staff/staffFrame'
import { STAFF_BOTTOM_EDGE_PX } from '@/engine/engrave/inheritedDefaults'
import { noteRuler } from '../engraved/noteRuler'
import type { NoteRuler } from '@/engine/engrave/notes/noteRuler'

// Vertical geometry shared by all slur arcs, in pixels — ⛔ authored in STAFF SPACES in
// `./curveStyle`, where each number carries the research it answers to (docs/plans/slur-plan.md §11–§13).
// A cubic's peak deviation is 0.75·H, so the 0.93 sp BOW reproduces the old quadratic's
// LIFT + ARC/2 peak. Phase 2 of §12 is the one that may replace this height law outright.
const SLUR_LIFT = CURVE_PX.slurLift       // gap between the notehead and the arc's endpoints
const SLUR_NEST_GAP = CURVE_PX.slurNestGap // extra bow height per nesting level (concentric slurs)
// ⭐ …and the air an endpoint leaves beyond its OWN note's staccato/tenuto — `./slurArticulationEndpoint`.
const SLUR_ARTIC_GAP = CURVE_PX.slurArticulationGap
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
      // one (docs/plans/fanned-beam-pitches-plan.md), so it has to name its measure like any other end.
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
 * is the SLOT's, and since U1 it is used for exactly ONE thing — asking for the `Stave` (it used to
 * construct VexFlow's `Curve` too) — never for x or y. The endpoints reach the arc explicitly, which is what
 * makes anchoring to something VexFlow never drew possible at all.
 */
interface SlurEnd {
  staveNote: EngravedNote
  /**
   * ⭐ Where the arc springs from / lands: the **CENTRE of the notehead** (docs/plans/slur-plan.md §12
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
function stemTipOf(ruler: NoteRuler): number | undefined {
  try {
    if (!ruler.hasStem) return undefined
    const tipY = ruler.stemTipY
    return !isNaN(tipY) ? tipY : undefined
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
      // do, so the same rule reaches it with no branch of its own (docs/plans/slur-plan.md §12.0 #7).
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
  const ruler = noteRuler(staveNote)
  const ys = ruler.headYs
  // The head's own extent, which is where the arc belongs — NOT `getTieRightX()`, which adds the
  // glyph width AND any modifier shift, i.e. the far side of everything hanging off the note.
  const headLeft = ruler.headLeftX
  const headRight = ruler.headRightX
  return {
    staveNote,
    centerX: (headLeft + headRight) / 2,
    attach: {
      headYs: ys.length ? [...ys] : [0],
      stemTipY: stemTipOf(ruler),
      stemDirection: ruler.stemDirection,
      headHalfWidth: (headRight - headLeft) / 2,
    },
  }
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
 *
 * 🚨🚨 **THE BOX IS `./noteInkBox`'s, ⛔ never `StaveNote.getBoundingBox()`** — his report,
 * 2026-08-21: a dynamic dropped under a note the slur covers changed the arch, because a dynamic is
 * attached to its note as an `Annotation` and VexFlow unions every modifier into the note's box. A
 * mark the dynamics line will translate somewhere else is not what the slur is bowing over.
 */
/** VexFlow's category for the signs `./slurAccidentalPoint` measures one at a time instead. */
const ACCIDENTAL_ONLY: ReadonlySet<string> = new Set(['Accidental'])

function slurObstaclesOf(
  pass: RenderPass,
  score: Score,
  slur: { startNoteId: string; endNoteId: string },
  /** −1 above / +1 below — which edge of each box the curve is looking at (`./accidentalCutOut`). */
  direction: number,
): SlurObstacle[] {
  const boxes: SlurObstacle[] = []
  for (const id of coveredChordIds(score, slur.startNoteId, slur.endNoteId)) {
    const note = pass.staveNoteMap.get(id)?.staveNote
    if (!note) continue
    // ⭐⭐ **THE NOTE WITHOUT ITS ACCIDENTALS IS A BOX; EACH ACCIDENTAL IS A POINT** — LilyPond's
    //    rule, his call 2026-09-14 (`./slurAccidentalPoint`, which carries the why). The head, the
    //    stem and the beam are a rectangle honestly; an accidental is a shape whose tall part is at
    //    one end, and a rectangle around it either over-reserves or — as ours did — lets the curve
    //    in. ⛔ `accidentalCutOut`'s tuck was DELETED with this: it granted a notch earned at one
    //    corner across the whole box.
    const box = noteInkBox(note, ACCIDENTAL_ONLY)
    if (box) boxes.push(box)
    for (const modifier of accidentalsOn(note)) {
      const ink = modifier.drawnInk()
      if (!ink) continue
      const point = accidentalAvoidPoint(ink, modifier.type, direction)
      if (point) boxes.push(point)
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
 * the same reason `planSpanSegments` works off drawn edges rather than off the model.
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
  /** The top line of the fragment's own staff (`staffLineY(frame, 0)`) — the system's identity. */
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
      const frame = noteFrame(note)
      if (!frame || Math.abs(staffLineY(frame, 0) - systemTopY) > 1) continue
      // 🚨 The note's OWN ink — a dynamic hanging off it is not what the open end has to clear
      // (`./noteInkBox`, and the same report the obstacle scan above carries).
      const b = noteInkBox(note)
      if (!b) continue
      found.push({ x: b.x, outer: direction === -1 ? b.y : b.y + b.height })
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
 * The staff frame of any chord/rest rendered on `line`, used only for a MIDDLE
 * segment's vertical reference (staff top/bottom line). Returns undefined if the
 * line has no rendered element in `staveNoteMap` (e.g. not yet laid out).
 */
function representativeFrameOnLine(
  pass: RenderPass, score: Score, line: number,
): StaffFrame | undefined {
  for (const m of score.measures) {
    if ((pass.measureLayoutInfo.get(m.number)?.lineNumber ?? 0) !== line) continue
    for (const s of m.slots) {
      const id = s.type === 'rest' ? s.id : s.type === 'chord' ? s.notes[0]?.id : undefined
      const staveNote = id ? pass.staveNoteMap.get(id)?.staveNote : undefined
      const frame = staveNote ? noteFrame(staveNote) : undefined
      if (frame) return frame
    }
  }
  return undefined
}

/**
 * Compute the cubic `cps` (control-point deltas for `engrave/curves/curveInk`) that bow the
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
 * `curveControlPoints` places each control point at `(endpointX ± dx/4, endpointY + cp.y·dir)`;
 * we target the chord line at 25%/75% lifted by `BOW`, then invert to recover the deltas.
 */
function slurArchCps(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  direction: number,
  extraHeight = 0,
  /** ⭐ How much taller the obstacles under it make the whole arch — `./slurObstacles.slurArchFit`. */
  fit = 1,
): [{ x: number; y: number }, { x: number; y: number }] {
  const dy = p1.y - p0.y
  // HOW TALL is `./slurArchHeight` — a law, not a constant, and the one number in the family with no
  // published source (docs/plans/slur-plan.md §12 Phase 2). `extraHeight` lifts an outer slur clear of the
  // slur(s) nested inside it (Phase 8).
  //
  // ⏭️ A short, steeply tilted slur should be rounder than this law asks (Verovio's minimum control
  // angle) — measured, costed and NOT built: see the tail of `./slurSlantLimit` for why it is a
  // shape decision rather than an import.
  const H = slurArchHeightFor(p0, p1, extraHeight)
  // ⭐ The two obstacle lifts are per-CONTROL (`./slurObstacles`) — the whole point of solving them
  // separately is that they may differ, so they are added here rather than folded into `H`.
  // ⭐⭐ …and the LEAN is bounded by the arch it leans (`./slurArchHeight.archLean`, his report of
  // 2026-08-31: unbounded, it put one control through the chord line and drew a bent stick).
  const lean = archLean(dy, direction, H)
  // ⚠️ EXPERIMENT, HIS (2026-08-31): the INDENT — how far in from each end the controls sit — is
  //    VexFlow's own `span/4` unless the console says otherwise (`./slurShapeExperiment`; both
  //    engines vary it with length and we never have). `cps.x` is an ADDITIVE delta on top of that
  //    `span/4` in `curveControlPoints`, the one owner of both, so the difference is what goes
  //    in — and 0.25 puts a 0 there, which is what shipped.
  const indent = (slurIndentFraction() - 0.25) * (p1.x - p0.x)
  // ⭐⭐ **THE OBSTACLE FACTOR SCALES BOTH CONTROLS BY THE SAME NUMBER** — LilyPond's, and the
  //    property is the point: multiplying a pair by one scalar cannot change their RATIO, so the
  //    arch keeps its shape and only its size answers the music under it (`./slurObstacles`).
  //    ⛔ Never two separate lifts — that is what bent his slur (`docs/research/slur-tie-research.md` §8.1).
  return [
    { x: indent, y: (H + lean) * fit },
    // ⚠️ `0 - indent`, ⛔ not `-indent`: the default puts a NEGATIVE ZERO there, and `toEqual`
    //    tells the two apart — a spec failing on the sign of nothing.
    { x: 0 - indent, y: (H - lean) * fit },
  ]
}

/**
 * Resolve the cubic `cps` for one arc: a hand-edited override (stored in **staff-spaces**,
 * anchor-relative) converted to pixels against the staff's `frame`, else the auto arch. Shared
 * by the single-arc path and each cross-system segment (BEGIN/MIDDLE/END), so the
 * staff-space→pixel conversion lives in exactly one place. `extraHeight` only affects the
 * auto arch (a manual shape is fully authored — no nest lift on top).
 */
export function resolveCps(
  override: CurveControlPointDeltas | undefined,
  frame: StaffFrame | undefined,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  direction: number,
  extraHeight: number,
  fit = 1,
): [{ x: number; y: number }, { x: number; y: number }] {
  if (override && frame) {
    return [
      { x: staffSpacesToPixels(override[0].x, frame), y: staffSpacesToPixels(override[0].y, frame) },
      { x: staffSpacesToPixels(override[1].x, frame), y: staffSpacesToPixels(override[1].y, frame) },
    ]
  }
  return slurArchCps(p0, p1, direction, extraHeight, fit)
}

/**
 * Resolve a slur's endpoint nudge (a {@link SlurEndpointOffsetOverride}, stored in
 * **staff-spaces**, anchor-relative) to per-end PIXEL deltas against each end's OWN stave
 * (see docs/plans/slur-endpoint-offset-plan.md). A missing offset for an end — or a
 * not-yet-laid-out stave (`undefined`) — yields 0 for that end, so the caller can add the
 * result unconditionally without risking a throw inside `staffSpacesToPixels`. Pure +
 * VexFlow-light (reads only the stave's space, through `./staveFrame`), mirroring `resolveCps`.
 */
export function slurEndpointOffsetPx(
  offset: SlurEndpointOffsetOverride | undefined,
  fromFrame: StaffFrame | undefined,
  toFrame: StaffFrame | undefined,
): { startX: number; startY: number; endX: number; endY: number } {
  const conv = (o: { x: number; y: number } | undefined, frame: StaffFrame | undefined) =>
    o && frame
      ? { x: staffSpacesToPixels(o.x, frame), y: staffSpacesToPixels(o.y, frame) }
      : { x: 0, y: 0 }
  const s = conv(offset?.start, fromFrame)
  const e = conv(offset?.end, toFrame)
  return { startX: s.x, startY: s.y, endX: e.x, endY: e.y }
}

/**
 * ⭐⭐ **THE WHOLE CURVE'S OWN OFFSET, IN PIXELS** — a {@link SlurOffsetOverride} (staff-spaces,
 * screen-signed) against one stave. `{0,0}` for a slur that carries none, or a stave that has not been
 * laid out yet, so a caller adds it unconditionally (`slurEndpointOffsetPx`'s rule).
 *
 * 🚨 **WHERE it is added is the entire feature.** It goes on the endpoints AFTER `resolveCps`, never
 * before: the cps are endpoint-relative deltas, so adding it last translates the drawn curve rigidly,
 * while adding it first would feed `slurArchClearance` moved endpoints and re-solve the obstacle lift —
 * a slur raised clear of the noteheads it was arched over would FLATTEN as it rose. His words for the
 * requirement (2026-08-18): *"the arc conserve the same shape, so we dont recalculate"*.
 *
 * ⚠️ Converted per STAVE rather than once, because the two ends of a cross-system slur can sit on
 * staves of different sizes (`project_small_staff_spacing`) and a staff-space is not the same number of
 * pixels on both.
 */
function slurOffsetPx(
  offset: { x?: number; y?: number } | undefined,
  frame: StaffFrame | undefined,
): { x: number; y: number } {
  if (!offset || !frame) return { x: 0, y: 0 }
  return {
    x: staffSpacesToPixels(offset.x ?? 0, frame),
    y: staffSpacesToPixels(offset.y ?? 0, frame),
  }
}

/**
 * ⭐⭐ **THE LINE BACK TO THE ENGRAVER'S POINT** — a displaced slur endpoint draws a dotted guide
 * from where it IS to where it would have been, or none at all when it has not been moved.
 *
 * ⭐ The `to` end is the endpoint's OWN un-nudged position — `drawn − offset` — and not the notehead
 * centre every other kind points at. Two reasons, and they are the same reason: it is exact (the
 * base already sits where §12 phase 7 put it, on the head or past the stem, which a notehead centre
 * would only approximate), and it states the quantity the user is actually editing — the line IS the
 * offset vector. MuseScore draws its grip anchor line off the same pair, `ups().p` versus
 * `ups().p + ups().off` (`slurtie.cpp:103-142`).
 *
 * ⭐ Why a slur needs one at all, when the arc plainly starts at a note: since the interpolating walk
 * (`interactions/slurEndpointWalk`) an endpoint's ink can sit a whole note-gap from its anchor, so
 * the arc can be drawn springing from a note the slur does not span — and every engine surveyed
 * (Dorico, Sibelius, Finale, MuseScore) answers that with a dashed line to the true anchor rather
 * than by forbidding the displacement.
 *
 * ⚠️ Returns null for an unmoved end. That is the registry's own rule — *a guide is never a guess* —
 * and it also keeps the common case free of a zero-length line drawn on top of the notehead.
 */
export function endpointGuide(
  drawn: { x: number; y: number },
  offset: { x: number; y: number },
): GuideLine | null {
  if (offset.x === 0 && offset.y === 0) return null
  return { from: drawn, to: { x: drawn.x - offset.x, y: drawn.y - offset.y } }
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
  frame: StaffFrame | undefined,
): { x: number; y: number } {
  if (!offset || !frame) return { x: 0, y: 0 }
  return { x: staffSpacesToPixels(offset.x, frame), y: staffSpacesToPixels(offset.y, frame) }
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
 * `<g class="slur">` group for scoped highlight, and registered in the
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
      .map(id => { const note = pass.staveNoteMap.get(id)?.staveNote; return note ? noteRuler(note).stemDirection : undefined })
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
      const group = drawGroupOf(pass.context.openGroup?.('slur', `slur-${slur.id}`))
      const slurStaffIndex = staffIndexOfId(score, startSlot?.staffId)

      // A slur is built from its two notes' own coordinates, which live in their staff's scaled
      // space — so it is drawn there too (docs/plans/staff-size-plan.md §4.3). That covers its ARC, its
      // thickness, and the handles + sampled points it registers for hit-testing, all at once.
      // A slur never spans two staves today (cross-staff slurring is not modelled), so the start
      // note's staff is the slur's.
      inStaffSpace(pass, slurStaffIndex, group, () => {

        // ⭐⭐ **THE ARC, FILED AS AN OBSTACLE** — docs/plans/trill-slur-clearance-plan.md P1. Every drawn
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
        //
        // 🚨🚨 **WHAT IS FILED IS THE ARC THE ENGRAVER DREW — ⛔ NOT the one the hand moved.** His
        // rule, 2026-08-22: *"an offset is something deliberate a user does… the user with the offset
        // is overwriting the engine engraving rules cause they wanted different, so the slur offset
        // should not push the lane (the user moved it so he is the responsible after this to fix any
        // possible collision)"*. Dragging a slur up used to shove the trill lane — and every mark
        // above it — out of the way, so a nudge meant to fix one collision silently re-engraved the
        // page. ⭐ The same sentence the whole-curve move and the arch solve already obey
        // ({@link slurOffsetPx}): the shape a slur has is the shape it keeps, and now the FOOTPRINT
        // it leaves on other families is the one it would have had.
        //
        // ⭐ Each site below therefore files {@link autoArc} — the very cubic that was drawn,
        // re-sampled at the ends BEFORE the hand's translations (the true-endpoint nudge and the
        // whole-curve offset). ⛔ The one hand move that stays in is a SPLIT slur's open-JOIN nudge:
        // that one is applied *before* `resolveCps` on purpose, so it re-arches rather than
        // translating, and there is no engraver's arc left underneath it to file. It also sits at a
        // system margin, where no lane is competing.
        const fileCurve = (points: { x: number; y: number }[], line: number) =>
          pass.drawnCurves.push({ staff: slurStaffIndex, line, points })
        /** The drawn cubic, sampled at the ends the engraver chose. See {@link fileCurve}. */
        const autoArc = (
          p0: { x: number; y: number },
          p1: { x: number; y: number },
          cps: [{ x: number; y: number }, { x: number; y: number }],
          direction: number,
        ) => curveArcPoints({ p0, p1, cps, direction }).points

        const fromNote = fromEnd.staveNote
        const toNote = toEnd.staveNote
        // Outer slurs (those enclosing nested slurs) arch higher so concentric arcs
        // don't collide. A manual `cps` shape opts out — the user controls that height.
        const nestLift = (nestDepths.get(slur.id) ?? 0) * SLUR_NEST_GAP

        // Endpoint nudge (docs/plans/slur-endpoint-offset-plan.md): a free anchor-relative offset
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
        const off = slurEndpointOffsetPx(endpointOffsetOverrideOf(score, slur.id), noteFrame(fromNote), noteFrame(toNote))
        // ⭐⭐ …and the WHOLE curve's own offset (`SlurOffsetOverride`), which is NOT folded in here:
        // it is added to the resolved endpoints below, once each branch has solved its shape, so the
        // curve translates instead of re-arching. See `slurOffsetPx` for why the order is the feature.
        const wholeOffset = slurOffsetOverrideOf(score, slur.id)
        const wholeFrom = slurOffsetPx(wholeOffset, noteFrame(fromNote))
        const wholeTo = slurOffsetPx(wholeOffset, noteFrame(toNote))
        const firstX = fromEnd.centerX + off.startX + placement.from.dx
        const lastX = toEnd.centerX + off.endX + placement.to.dx
        fromY += off.startY
        toY += off.endY

        // ⭐⭐ **THE ENDPOINT CLEARS ITS OWN MARK** (`./slurArticulationEndpoint`, his report of
        // 2026-09-14). A staccato or tenuto on the first or last note stands between that note and
        // the slur, so the endpoint's lift is measured from the MARK rather than from the notehead.
        // ⭐ It moves the ENDS, which translates the curve; ⛔ it never touches the cps, which would
        // re-arch it — *"they should not change the slur angle but move it up a little"*.
        // ⚠️ Computed HERE, after the hand's endpoint nudge and before the shape is solved, so the
        // arch, its lean and the obstacle solve all see the ends the engraver actually chose.
        const liftFrom = endpointLiftOverMark(fromY, LIFT, articulationEdge(fromNote, direction), direction, SLUR_ARTIC_GAP)
        const liftTo = endpointLiftOverMark(toY, LIFT, articulationEdge(toNote, direction), direction, SLUR_ARTIC_GAP)

        if (fromLine === toLine) {
          // Same line: a single arc from the start note to the end note.
          const startY = fromY + liftFrom * direction
          const endY = toY + liftTo * direction
          const p0 = { x: firstX, y: startY }
          const p1 = { x: lastX, y: endY }
          // A hand-edited shape in the engraving-overrides compartment (stored in
          // staff-spaces) overrides the auto arch; absent → auto. Convert the override's
          // deltas to pixels against the live stave (resolution-independent storage).
          const frame = noteFrame(fromNote)
          // ⭐ PHASE 8, first pass: raise the arch over anything it covers (`./slurObstacles`).
          // ⛔ Only the AUTO arch — a hand-edited shape is the user's and opts out, the same rule the
          // nest lift follows, so the lift is folded in as extra height rather than applied after.
          const shapeOverride = curveShapeOverrideOf(score, slur.id)?.cps
          // 🚨🚨 **THE SHAPE IS SOLVED FROM THE ENGRAVER'S ENDS, ⛔ NEVER THE HAND-MOVED ONES** — his
          // report, 2026-08-21: *"the problem is the arch, and not that the endpoint of the slur is in
          // a wrong position"*, and *"i remember we fix this before"*. He did: it is the rule stated
          // twelve lines below for the WHOLE-curve offset — *"above the clearance solve it would
          // re-arch instead"* — and the ENDPOINT offset was the one that still went in first.
          //
          // ⭐ What that cost, measured in the browser (`e2e/slur.e2e.ts`): pushing one end down 10,
          // 30 and 50 staff-spaces sent the arc's TOP to 41, −14 and −68 px — upward, off the sheet,
          // while both ends were far below it. The curve dives away from the notes it covers, the
          // solver reads the whole staff as an intrusion, and `deficit × up to 4` answers with
          // hundreds of pixels of lift. ⚠️ The limits could not catch it: they predict ink moving
          // RIGIDLY with the nudge ({@link MusicEngine.nudgeStaysOnPage}), and a re-solved arch does
          // not.
          //
          // ⭐ So the arch, its lean and its obstacle lift are all decided on `auto…` — where the
          // engraver would have put the ends — and the hand's nudge moves the drawn ink afterwards.
          // The shape a slur has is the shape it keeps, which is the same sentence the whole-curve
          // move already obeys.
          const autoP0 = { x: p0.x - off.startX, y: p0.y - off.startY }
          const autoP1 = { x: p1.x - off.endX, y: p1.y - off.endY }
          // ⭐⭐ ONE FACTOR over the whole arch (`./slurObstacles`), ⛔ never two control lifts.
          const archH = slurArchHeightFor(autoP0, autoP1, nestLift)
          const archLeanPx = archLean(autoP1.y - autoP0.y, direction, archH)
          const clearance = shapeOverride
            ? 1
            : slurArchFit(autoP0, autoP1, archH + archLeanPx, archH - archLeanPx,
              direction, slurObstaclesOf(pass, score, slur, direction))
          const cps = resolveCps(shapeOverride, frame, autoP0, autoP1, direction, nestLift, clearance)
          // ⭐⭐ THE RIGID MOVE, and this line's POSITION is the whole of it: the shape (arch, tilt,
          // obstacle lift, or the hand-edited cps) is already decided, and the cps are endpoint-
          // relative, so translating both endpoints now moves the drawn curve and changes nothing
          // about it. Above the clearance solve it would re-arch instead. Both ends take the same
          // delta — one offset, one curve — converted against each end's own stave.
          p0.x += wholeFrom.x; p0.y += wholeFrom.y
          p1.x += wholeTo.x; p1.y += wholeTo.y
          // ⭐ Filed from `autoP0`/`autoP1` — the ends before BOTH hand moves, which this branch
          // already had in hand for the arch solve.
          fileCurve(autoArc(autoP0, autoP1, cps, direction), fromLine)
          const arc = drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness)
          // Store the on-screen control points + endpoint geometry so a selected slur can
          // show draggable handles (Phase 7), plus the stave's staff-space size so a handle
          // drag can convert the new pixel shape back to staff-spaces for storage. Same-line
          // only — a split slur shares one shape, so it gets no handles.
          // Both true ends can be displaced independently, so each contributes its own guide (or
          // none). `p0`/`p1` already carry the nudge, and the offsets are the pixels that went in.
          // ⚠️ The guide points back to the ANCHOR, so it must undo BOTH displacements — the end's own
          // nudge and the whole curve's offset. A guide drawn off the per-end offset alone would stop
          // short of the note by exactly the whole-curve move.
          const guides = [
            endpointGuide(p0, { x: off.startX + wholeFrom.x, y: off.startY + wholeFrom.y }),
            endpointGuide(p1, { x: off.endX + wholeTo.x, y: off.endY + wholeTo.y }),
          ].filter((g): g is GuideLine => g !== null)
          registerPartial(arc, undefined, {
            controlPoints: [arc.c0, arc.c1],
            slurEndpoints: { p0, p1, direction },
            staffSpacePx: frame?.spacePx,
            ...(guides.length ? { guides } : {}),
          })
        } else {
          // Cross-system: one open-ended segment per system the slur crosses
          // (BEGIN + N×MIDDLE + END), each anchored to the **system** edges — not the
          // endpoint notes' own measures (that measure-vs-system confusion was the bug
          // that hid the arc on any non-boundary measure / dropped middle systems).
          // `firstX`/`lastX` (incl. the endpoint nudge) were lifted above the branch.
          // The two true endpoints (square re-anchor handles). Attach them to the FIRST
          // partial that actually registers — independent of which segment draws, since
          // planSpanSegments may defensively skip a system edge it can't resolve, so we
          // can't assume the BEGIN partial exists. NO controlPoints/staffSpacePx, so the
          // round shape handles stay off for a split slur (it has no single shared shape).
          const trueEnds = slurTrueEndpoints(firstX, lastX, fromY, toY, LIFT, direction)
          // ⭐ The whole-curve offset moves the SQUARES with the ink they belong to — done once, here,
          // rather than inside the fragment loop, because the registry keeps this object by reference
          // and a fragment that registered before its own end was translated would have published a
          // handle at the old place.
          trueEnds.p0.x += wholeFrom.x; trueEnds.p0.y += wholeFrom.y
          trueEnds.p1.x += wholeTo.x; trueEnds.p1.y += wholeTo.y
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
            frame: StaffFrame | undefined,
            segmentRole: 'begin' | 'middle' | 'end',
            segmentOrdinal?: number,
          ) => {
            // ⛔ The arc is NOT filed here, though it was until 2026-08-22 — and with it went the
            // `line` parameter that existed only to say which system to file it on. Each fragment's
            // own site files its ENGRAVER's arc instead, because only there are the hand's two
            // deltas visible (see {@link fileCurve}).
            // ⚠️ Each fragment carries only ITS OWN true end's guide — the start's on BEGIN, the
            // end's on END, a MIDDLE has neither. The registry's rule for a split span (two x's
            // from different systems are not on one ruler), and the reason this is not attached
            // beside `slurEndpoints` above: those squares are the whole slur's, these lines are
            // this system's. An open JOIN's own nudge draws none — it is margin-bound, so there is
            // no anchor for it to have left.
            const trueEndGuide
              = segmentRole === 'begin' ? endpointGuide(trueEnds.p0, { x: off.startX + wholeFrom.x, y: off.startY + wholeFrom.y })
              : segmentRole === 'end' ? endpointGuide(trueEnds.p1, { x: off.endX + wholeTo.x, y: off.endY + wholeTo.y })
              : null
            registerPartial(arc, partialType, {
              controlPoints: [arc.c0, arc.c1],
              segmentEndpoints: segEnds,
              staffSpacePx: frame?.spacePx,
              segmentRole,
              ...(segmentOrdinal !== undefined ? { segmentOrdinal } : {}),
              slurSpanCount: spanCount,
              ...(endpointsAttached ? {} : { slurEndpoints: trueEnds }),
              ...(trueEndGuide ? { guides: [trueEndGuide] } : {}),
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
          const openRise = (half: 'begin' | 'end', lengthPx: number, startY: number, frame: StaffFrame | undefined) => {
            const outer = frame === undefined ? undefined
              : nearestCoveredOuterY(pass, score, slur, staffLineY(frame, 0), half, direction)
            const clearance = outer === undefined ? 0 : (outer - startY) * direction + LIFT
            return brokenSlurOpenRise(steps ?? 0, half, direction, lengthPx, clearance)
          }
          let middleOrdinal = 0
          for (const seg of planSpanSegments(pass, fromLine, toLine, firstX, lastX, pass.staffScale(slurStaffIndex), lineLeftCurveX)) {
            if (seg.type === 'begin') {
              // Start note → system right edge, rising to an OPEN right end that leans toward the
              // music on the next system (`./brokenSlurTilt`, Gould p. 112).
              const startY = fromY + liftFrom * direction
              const frame = noteFrame(fromNote)
              const p0 = { x: seg.firstX, y: startY }
              const p1 = {
                x: seg.rightX,
                y: startY + openRise('begin', seg.rightX - seg.firstX, startY, frame) * direction,
              }
              // Open RIGHT end nudge (the true start p0 carries `endpointOffset` instead).
              const o = segmentEndpointOffsetPx(segEndOff.begin, frame)
              p1.x += o.x; p1.y += o.y
              const cps = resolveCps(segShape.begin, frame, p0, p1, direction, nestLift)
              // ⭐ Filed before the translation: this fragment carries the START end's own nudge,
              // and the whole-curve offset is still to come. Its open right end keeps `o` — that
              // one re-arched (see {@link fileCurve}).
              fileCurve(autoArc({ x: p0.x - off.startX, y: p0.y - off.startY }, p1, cps, direction), fromLine)
              // ⭐ The whole-curve offset, after this fragment's own resolve — the same-line branch's
              // rule (see `slurOffsetPx`), and it matters MORE here: this fragment's open end is
              // margin-bound and its rise is measured off `startY`, so translating before the solve
              // would restretch and re-lean the piece instead of moving it.
              p0.x += wholeFrom.x; p0.y += wholeFrom.y
              p1.x += wholeFrom.x; p1.y += wholeFrom.y
              registerSeg(
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness),
                'end', { p0, p1, direction }, frame, 'begin',
              )
            } else if (seg.type === 'end') {
              // System left edge → end note, the mirror of BEGIN. THIS is the 2-line
              // fix: leftX is the SYSTEM's left margin, not the end note's measure edge. Its open
              // LEFT end leans the opposite way, so the two fragments point at each other.
              const endY = toY + liftTo * direction
              const frame = noteFrame(toNote)
              // ⛔ NO vertical dodge around the clef: the fragment starts after it, so there is
              // nothing to dodge. LilyPond makes the same point in the strongest available form — it
              // EXCLUDES Clef, KeySignature and TimeSignature from the code that lifts a slur's
              // endpoint (`slur-scoring.cc:302–308`), while still letting them score against the
              // curve. Raising a slur to clear the clef is the wrong fix, and I shipped it once.
              const p0 = {
                x: seg.leftX,
                y: endY + openRise('end', seg.lastX - seg.leftX, endY, frame) * direction,
              }
              const p1 = { x: seg.lastX, y: endY }
              // Open LEFT end nudge (the true end p1 carries `endpointOffset` instead).
              const o = segmentEndpointOffsetPx(segEndOff.end, frame)
              p0.x += o.x; p0.y += o.y
              const cps = resolveCps(segShape.end, frame, p0, p1, direction, nestLift)
              // ⭐ The mirror of BEGIN: the true END's nudge comes off, the open left end's stays.
              fileCurve(autoArc(p0, { x: p1.x - off.endX, y: p1.y - off.endY }, cps, direction), toLine)
              p0.x += wholeTo.x; p0.y += wholeTo.y
              p1.x += wholeTo.x; p1.y += wholeTo.y
              registerSeg(
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness),
                'start', { p0, p1, direction }, frame, 'end',
              )
            } else if (seg.type === 'middle') {
              // A full-width bow across a system the slur merely passes over. Both ends
              // sit flat at a staff-relative baseline (above the top line / below the
              // bottom line per the slur's side); slurArchCps bows it symmetrically.
              const frame = representativeFrameOnLine(pass, score, seg.line)
              if (!frame) continue
              const baselineY = direction === -1
                ? staffLineY(frame, 0) - LIFT
                : staffBottomLineY(frame) + STAFF_BOTTOM_EDGE_PX + LIFT
              const p0 = { x: seg.leftX, y: baselineY }
              const p1 = { x: seg.rightX, y: baselineY }
              const ordinal = middleOrdinal++
              // Both open ends nudge independently (left + right) — ordinal-keyed, reset on a
              // count change with the rest of the middles.
              const mo = segEndOff.middles[ordinal]
              const ol = segmentEndpointOffsetPx(mo?.left, frame)
              const or = segmentEndpointOffsetPx(mo?.right, frame)
              p0.x += ol.x; p0.y += ol.y
              p1.x += or.x; p1.y += or.y
              const cps = resolveCps(segShape.middles[ordinal], frame, p0, p1, direction, nestLift)
              // ⭐ A MIDDLE has no true end at all, so only the whole-curve offset below is the
              // hand's — and it is filed before that lands.
              fileCurve(autoArc(p0, p1, cps, direction), seg.line)
              // ⚠️ A MIDDLE is anchored to nothing but its system's margins, and it takes the offset
              // all the same: the user moved the CURVE, and a fragment of it left behind would break
              // the line the eye follows across the break.
              const wholeMid = slurOffsetPx(wholeOffset, frame)
              p0.x += wholeMid.x; p0.y += wholeMid.y
              p1.x += wholeMid.x; p1.y += wholeMid.y
              registerSeg(
                drawCurveArc(pass, p0, p1, cps, direction, CURVE_PX.thickness),
                'middle', { p0, p1, direction }, frame, 'middle', ordinal,
              )
            }
          }
        }

      })

      pass.context.closeGroup?.()
      const node = svgNode(group)
      if (node) pass.slurGroupMap.set(slur.id, node)
    } catch (e) {
      console.error('Could not render slur:', e)
    }
  }
}
