/**
 * ⭐⭐ **TRILLS — the `tr` and its wavy extension, drawn.** P2 of docs/trill-plan.md.
 *
 * A score-level pass after the measures, exactly like `renderSlurs` and `renderHairpins` and for the
 * same reason: a trill spans bars, so it cannot be drawn inside any one bar's group.
 *
 * ## What makes it different from the hairpin next door
 *
 * ⭐ **It is NOT a baseline family, so it asks `inkBand` directly.** A hairpin is a member of the
 * dynamics family and must level with the letters it meets, which is why it looks its y up in a
 * plan computed for the whole render. A trill is read individually at its own note — nobody scans a
 * row of trills — so it clears its OWN span and nothing else, with no chain and no plan
 * (docs/above-staff-ladder.md §1: the test for a baseline is *is it read as a row?*).
 *
 * ⭐ **Every fragment draws its own SIGN.** A cross-system trill is not one mark in pieces the way a
 * slur is: the reader arriving on the second system must be told what the wavy line means, so
 * LilyPond restarts the `tr` above the first note there, Sibelius prints a parenthesised `(tr)`, and
 * Dorico makes it an option. Ours is LilyPond's plain restart — the parenthesis is one constant away
 * if his eye prefers it (docs/trill-plan.md §1 rule 6).
 *
 * ⭐⭐ **THE LINE DRAWS BY DEFAULT, including on a single note** — his call, 2026-08-13, overruling
 * the plan's rule 5 (LilyPond's and Gould's "a single note needs no wavy line"). A bare `tr` leaves
 * the duration implied and he wants it shown. ⭐ The one exception is `Trill.extension: 'none'`, the
 * engraver asking for a bare `tr` (his ask, 2026-08-18) — absent on every ordinary trill. See
 * `trillOps.TrillSpan` for the full note; ⛔ do not restore rule 5 as the default.
 *
 * ⛔ **Not VexFlow's `Ornament`, and not `VibratoBracket`.** `Ornament` positions from the note's own
 * top — the exact defect the dynamics line exists to fix — and a note modifier cannot produce a
 * repeated head on each system. `VibratoBracket` brings the wrong glyph (U+EAB0, the *vibrato*
 * wiggle), a y from `stave.getYForTopText()` (a fixed rung that knows nothing about the music), both
 * ends on ONE stave, a length quantised to whole glyph repeats, and a `setVibratoWidth` that THROWS
 * when the glyph measures 0 — which is what jsdom does. What we would inherit is one `renderText`.
 *
 * ## The two coordinate spaces, because mixing them is the recurring bug here
 *
 * Everything drawn runs inside `inStaffSpace`, i.e. the staff's own `scale(k)` group: note
 * coordinates and stave coordinates are in it already. A SYSTEM EDGE is not — `measureBounds` says
 * where a bar landed in the SVG — so it is divided by the scale on the way in, which is the same
 * conversion `planSlurSegments` makes and for the same reason.
 */
import type { Stave } from 'vexflow'
import { Element } from 'vexflow'
import type { Score, Trill, TrillContinuationLabel, Measure, Fraction } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { trillSpan, type TrillSpan } from '@/engine/models/trillOps'
import { trillOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { lineLeftEdgeX, lineRightEdgeX, type SystemEdgeLookup } from './systemEdges'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand, type InkBand } from '@/engine/layout/inkBand'
import { curveObstacleBand } from '@/engine/layout/curveObstacleBand'
import { markBand, measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracAdd, fracCompare, fracGt } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { planSlurSegments } from './SlurRenderer'
import { inStaffSpace } from './staffScaleGroup'
import { staffSpacesToPixels } from './staffSpace'
import {
  TRILL_CONTINUATION_INSET, TRILL_END_INSET, TRILL_GLYPH_SIZE, TRILL_LINE, TRILL_MARK_INK,
  TRILL_PAREN_LEFT, TRILL_PAREN_RIGHT,
  TRILL_PAREN_FONT, TRILL_PAREN_RAISE, TRILL_PAREN_SCALE, TRILL_SIGN_GAP, TRILL_SIGN_GLYPH,
  TRILL_WIGGLE_GLYPH,
} from './trillStyle'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement`, declared structurally so the renderer that calls this
 * is not imported back by it — the shape `HairpinRenderer` already uses.
 */
/**
 * ⛔⛔ **`TrillBandPlacement` IS GONE, 2026-08-18, and that is a deliberate trade worth recording.**
 *
 * It was `Pick<TrillPlacement, 'view' | 'measureNumber' | 'staffIndex' | 'line' | 'system'>` — the
 * point being what was ABSENT: no `stave`, no `scale`, no drawn x. A trill's vertical came from the
 * layout's columns and from beats alone, which is what let {@link planTrillBands} run above the
 * measure loop.
 *
 * ⭐ **We gave that up to clear the SLUR** (docs/trill-slur-clearance-plan.md). An arc's height is
 * not derivable from columns and beats — it exists only once drawn — so the plan now runs after
 * `renderTies`/`renderSlurs` and takes the full {@link TrillPlacement}, stave and all. ⚠️ The
 * pixel-freeness bought exactly one thing, the hoist; the hoist bought exactly one thing, an early
 * plan for a family drawn inside the measure loop — and no such family ever existed (`VexFlowRenderer`
 * records the measurement). What it cost was the `tr` drawn through the arc, which is a picture he
 * can see.
 *
 * ⛔ So do not "restore" the narrow type: it would put the plan back above the curves.
 */

/** Where a fragment's height is filed — one trill, one entry per SYSTEM it crosses. */
export function trillBandKey(trillId: string, line: number): string {
  return `${trillId}@${line}`
}

/** What {@link planTrillBands} hands the drawing: the baseline each fragment was placed at. */
export type TrillBandPlan = Map<string, number>

export interface TrillPlacement {
  /** This staff's own lane. */
  view: Measure
  measureNumber: number
  staffIndex: number
  line: number
  /** The measure's merged columns, shared by every staff of it. */
  system: { columns: Column[] }
  stave: Stave
  scale: number
}

/** One drawn piece of a trill: an x range and — the part that is easy to forget — WHICH SYSTEM. */
interface TrillPiece {
  x0: number
  x1: number
  line: number
  /** ⭐ Is this a RESUMED fragment — i.e. the trill began on an earlier system? Its sign is
   *  parenthesised, `(tr)`, so the reader knows the ornament did not start here (his call; see
   *  {@link TRILL_PAREN_LEFT}). False for the piece carrying the trill's true start. */
  continuation: boolean
}

/** The slot at or after `beat` in this lane, by the fall-forward rule the hairpin uses. */
function slotIdAt(view: Measure, voice: number, beat: Fraction): string | undefined {
  const lane = view.slots.filter(s => voiceOf(s) === voice).sort((a, b) => fracCompare(a.beat, b.beat))
  const hit = lane.find(s => fracCompare(s.beat, beat) >= 0)
  // `staveNoteMap` is keyed by the PITCH id for a chord and by the slot id for a rest.
  return hit ? (hit.type === 'chord' ? hit.notes[0]?.id : hit.id) : undefined
}

/** The slot STRICTLY after `beat` in this lane — how the end of a slot's sounding span is found
 *  without this module ever needing to know a duration (tuplets and ties both complicate that). */
function slotIdAfter(view: Measure, voice: number, beat: Fraction): string | undefined {
  const lane = view.slots.filter(s => voiceOf(s) === voice).sort((a, b) => fracCompare(a.beat, b.beat))
  const hit = lane.find(s => fracGt(s.beat, beat))
  return hit ? (hit.type === 'chord' ? hit.notes[0]?.id : hit.id) : undefined
}

/** A rendered note's LEFT edge, in its staff's own space, or undefined if that bar was not drawn. */
function noteLeftX(pass: RenderPass, noteId: string | undefined): number | undefined {
  if (!noteId) return undefined
  const note = pass.staveNoteMap.get(noteId)?.staveNote
  if (!note) return undefined
  // ⭐ Rule 4: the trill sign LEFT-ALIGNS to the left edge of the NOTEHEAD — every other ornament
  // centres on it, and the dynamics' "a level is centred on its notehead" is the wrong rule to
  // borrow here. `getNoteHeadBeginX` is that edge; `getTieLeftX` (the hairpin's) is the same point
  // for our purposes but is named for a different question.
  const head = (note as unknown as { getNoteHeadBeginX?: () => number }).getNoteHeadBeginX
  return head ? head.call(note) : note.getTieLeftX()
}

/**
 * ⭐ **WHERE THE TRILL STARTS AND STOPS, in x.**
 *
 * Start: the left edge of the trilled notehead (rule 4). End: the end of the LAST trilled slot's
 * sounding span — the next slot's x if the music goes on, else the bar's own end. That is the same
 * "read to the slot's END" the hairpin uses, and it is why a trill over a whole note covers the bar
 * rather than the notehead.
 *
 * ⛔ **Not `CoordinateMapper.beatToPixelX`**, which interpolates a bar's width linearly and has
 * nothing to do with where the spacing solve actually put the columns.
 */
function spanX(
  pass: RenderPass,
  span: TrillSpan,
  voice: number,
  from: TrillPlacement,
  to: TrillPlacement,
): { startX: number; endX: number } | null {
  const startX = noteLeftX(pass, slotIdAt(from.view, voice, span.startBeat))
  if (startX === undefined) return null

  const next = noteLeftX(pass, slotIdAfter(to.view, voice, span.endBeat))
  const barEnd = pass.measureBounds.get(to.measureNumber)?.noteEndX
  const endX = next ?? (barEnd === undefined ? undefined : barEnd / to.scale)
  if (endX === undefined) return null
  // ⚠️⚠️ **NO `endX <= startX` GUARD HERE, and that is not an oversight — it was a BUG.**
  // Across a SYSTEM BREAK the two x's live in different systems' coordinates: a trill starting in
  // the last bar of one system and ending in the first bar of the next has an `endX` far to the
  // LEFT of its `startX`, and comparing them says nothing. The guard discarded exactly the case the
  // whole cross-system machinery exists for (his report: a trill tied over a break drew nothing).
  // `HairpinRenderer.spanX` has never had this test, for the same reason.
  //
  // ⭐ A genuinely degenerate SAME-SYSTEM span is still handled — `cutIntoPieces` drops any piece
  // whose `x1 <= x0`, which is where that question belongs, because only there are both x's known
  // to be on one system.
  return { startX, endX }
}

/**
 * ⭐⭐ **WHERE THE TRILL IS DRAWN, ONCE** — its two x's and the pieces the systems cut it into.
 *
 * ⚠️ **Both passes ask this, and that is the point.** {@link planTrillBands} needs the pieces to know
 * which stretch of drawn x to look for a slur over; {@link drawTrill} needs them to draw. Computing
 * them in each would be two answers to *where is this trill*, and the pair would drift the first time
 * one of them learned about a new inset — the same argument {@link barSlice} makes for the beats.
 *
 * Deterministic between the two calls: it reads `staveNoteMap` and `measureBounds`, both filled by
 * the measure loop and untouched by anything between the two passes.
 *
 * ⭐ `TRILL_END_INSET` is applied to the SPAN's end BEFORE cutting, which is what keeps the air off a
 * system break: a fragment that ends at the margin is created by the cut, so it never sees it.
 * ⚠️ The "never past the start" clamp is SAME-SYSTEM ONLY, for `spanX`'s reason — across a break the
 * two x's are in different systems' coordinates, so `startX + inset` is a number from another row.
 */
function trillGeometry(
  pass: RenderPass,
  span: TrillSpan,
  voice: number,
  from: TrillPlacement,
  to: TrillPlacement,
  /** ⭐ THE TWO SQUARES' OWN NUDGES, in staff-spaces — folded in HERE rather than added to the drawn
   *  sign and the last piece at draw time, because past the end of a line either of them changes
   *  WHICH PIECES THERE ARE ({@link foldPastSystemEnd}). */
  nudge: { startX?: number; endX?: number } = {},
): { startX: number; endX: number; fromLine: number; toLine: number; pieces: TrillPiece[] } | null {
  const x = spanX(pass, span, voice, from, to)
  if (!x) return null
  const inset = staffSpacesToPixels(TRILL_END_INSET, from.stave)

  // ⭐⭐ **THE SIGN FOLDS TOO** — his report, 2026-08-20: the sign walked to the last note of a system
  // and *"the walk just stops… it should not stop, it should go as offset"*. A trill's stops are
  // notes, so a lane that runs out leaves the ink as the only way onward; without this the `tr` slid
  // into the right margin instead, and the page limit eventually froze it there.
  const start = foldPastSystemEnd(
    pass, from.line, x.startX + staffSpacesToPixels(nudge.startX ?? 0, from.stave), from.scale)

  const insetEnd = x.endX - inset
  const clamped = from.line === to.line ? Math.max(insetEnd, x.startX + inset) : insetEnd
  // ⛔ AFTER every automatic decision, never inside one — the recorded scar in `drawTrill`.
  const nudged = clamped + staffSpacesToPixels(nudge.endX ?? 0, to.stave)
  const end = foldPastSystemEnd(pass, to.line, nudged, from.scale)

  // 🚨🚨 **A PIECE MUST SURVIVE, OR THE SIGN GOES WITH IT.** His report, 2026-08-20: an `endX` of
  // −5 spaces and *"the `tr` disappears, this should not happen"*. `cutIntoPieces` drops any piece
  // whose end has crossed its own start — right for a degenerate span — and once the nudges were
  // folded in HERE (they have to be, for the fold), a hand-nudge dragging one end past the other
  // deleted the only piece there was, and with it the `tr`, its hit-box and both squares.
  // ⭐ So the CUT is floored at the sign; the DRAWING still shows no wiggle, because `drawsLine`
  // asks whether anything is left after the sign and its gap. Pushing the two ends past each other
  // is a way of asking for a bare sign, ⛔ not for no ornament.
  //
  // ⚠️ **A SIGN PUSHED PAST ITS OWN LINE takes the line with it**: the ornament is then one piece on
  // the sign's line, because a wavy line that ended on an earlier system than its `tr` is not a
  // drawing of anything.
  const past = start.line > end.line
  const toLine = past ? start.line : end.line
  const endX = past || start.line === toLine
    ? Math.max(end.endX, start.endX + inset)
    : end.endX
  return {
    startX: start.endX,
    endX,
    fromLine: start.line,
    toLine,
    pieces: cutIntoPieces(pass, start.line, toLine, start.endX, endX, from.scale),
  }
}

/**
 * 🚨🚨 **THE FOLD — ink pushed past the end of a line CONTINUES AT THE START OF THE NEXT ONE.**
 *
 * His rule, 2026-08-20, after watching the end square's nudge walk the wavy line into the right
 * margin and off the sheet: *"look how the offset works — here all the empty measures; in the case of
 * a system jump, same thing: **no anchor to a note but offset in the next system**"*.
 *
 * ⭐⭐ **It is the OFFSET that crosses the break, ⛔ not the anchor.** A trill's anchors are notes, so
 * a passage of empty bars offers nothing to re-anchor to — and a score that runs out in rests could
 * otherwise never have its line carried onward at all. The ink is `anchor + offset` as it always
 * was; this only says where that lands once the offset runs off the end of a line.
 *
 * ⚠️ **So a trill can DRAW on systems its SPAN does not cover.** Both passes therefore widen their
 * `covered` placements to the folded lines — without a stave over there a fragment would be drawn at
 * the FIRST system's height, on the second system's x's.
 *
 * ⚠️ A loop, not a single step: a big nudge (or a wide zoom-out) may fold over several lines. It
 * stops at the last line the render drew, which is where the ink genuinely has nowhere to go — and
 * `interactions/trillWalk` refuses the press there rather than letting it run off the page.
 */
export function foldPastSystemEnd(
  pass: SystemEdgeLookup,
  line: number,
  endX: number,
  scale: number,
): { line: number; endX: number } {
  for (let guard = 0; guard < 64; guard++) {
    // ⚠️ Every edge comes from `measureBounds`, i.e. the SVG's own space; everything here is in the
    // staff's (`SlurRenderer.planSlurSegments` makes the same conversion for the same reason).
    const right = lineRightEdgeX(pass, line)
    const left = lineLeftEdgeX(pass, line)
    const nextLeft = lineLeftEdgeX(pass, line + 1)
    const previousRight = lineRightEdgeX(pass, line - 1)
    if (right !== undefined && nextLeft !== undefined && endX > right / scale) {
      endX = nextLeft / scale + (endX - right / scale)
      line += 1
      continue
    }
    // ⭐⭐ **AND BACKWARDS** — his report, 2026-08-20: *"the cross staff is not working in the
    // opposite direction for the begin endpoint"*, on a `tr` nudged 51 spaces LEFT. Ink pushed past
    // a line's START continues at the END of the previous one. The two directions are one rule read
    // twice, and only the forward half had been written.
    if (left !== undefined && previousRight !== undefined && endX < left / scale) {
      endX = previousRight / scale - (left / scale - endX)
      line -= 1
      continue
    }
    break
  }
  return { line, endX }
}

/**
 * ⭐ **THE TRILL'S OWN Y** — clear the ink over the columns it covers **and any curve arching over
 * them**, floored at {@link TRILL_LINE}'s minimum, mirrored for `below`.
 *
 * ⚠️ **The band is the union over the bars of THIS FRAGMENT, not of the whole span.** A trill split
 * over a system break has one band per SEGMENT — otherwise a low note on the second system would
 * push the first system's `tr` up for no visible reason. Same rule the hairpin's fragments follow.
 */
function baselineFor(
  pass: RenderPass,
  covered: readonly TrillPlacement[],
  span: TrillSpan,
  voice: number,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  side: 'above' | 'below',
  /** ⭐ THIS fragment's drawn x range ({@link trillGeometry}) — what the curve band is read over.
   *  Absent only when the fragment was not drawn, and then the curves are simply not consulted. */
  piece?: Pick<TrillPiece, 'x0' | 'x1'>,
): number {
  let band: InkBand | null = null
  for (const p of covered) {
    const { from, to } = barSlice(p, span, voice)
    band = mergeInkBands(band, staffInkBand(columnsBetween(p.system.columns, from, to), staffId, firstStaffId))
  }
  return clearanceBaseline(
    mergeInkBands(band, curveBandUnder(pass, covered, piece)), side, TRILL_MARK_INK, TRILL_LINE)
}

/**
 * ⭐⭐ **THE SLUR (AND THE TIE) AS INK** — docs/trill-slur-clearance-plan.md P2, and the whole reason
 * this pass runs after the curves are drawn.
 *
 * > Gould p. 135: the trill sits *"further from the note than any articulation marks. Only a long
 * > slur, a pause or octave sign goes further from the stave."* Her p. 138 (d) draws it at the hardest
 * > case — a slur STARTING on the trilled note — and the `tr` is still outside, by 0.55–1.35 sp.
 *
 * ⭐ **Merged, not maxed, and there is no new constant.** The arc becomes a third band beside the
 * music's and (for families outside this one) the ladder's, and `clearanceBaseline` applies the
 * family's own `TRILL_LINE` to all of them together. That gives the 0.5 sp gap the three engines
 * agree on — MuseScore's `Sid::trillMinDistance` 0.5, Verovio's margin 0.5, LilyPond's 0.46 — from
 * the padding the trill already uses to clear a notehead. ⛔ A second constant of the same value,
 * tuned separately, is two answers to one question (`inkBand`'s rule).
 *
 * ⭐ **Both sides for free**, which is what P2 asked for: the band is the arc's real extent, and
 * `clearanceBaseline` mirrors. Nothing here knows which way is out.
 *
 * ⚠️ Read over the fragment's UN-NUDGED x's. A hand nudge moves the ink and not the claim — the
 * family's rule (`HairpinRenderer`, `OttavaRenderer`), so that dragging a `tr` sideways cannot shove
 * its neighbours.
 */
function curveBandUnder(
  pass: RenderPass,
  covered: readonly TrillPlacement[],
  piece?: Pick<TrillPiece, 'x0' | 'x1'>,
): InkBand | null {
  const here = covered[0]
  if (!piece || !here) return null
  const spacePx = here.stave.getSpacingBetweenLines()
  return curveObstacleBand(
    pass.drawnCurves,
    { staff: here.staffIndex, line: here.line, fromX: piece.x0, toX: piece.x1 },
    { topLineY: here.stave.getYForLine(0), spacePx },
  )
}

/**
 * ⭐ The slice of ONE bar the trill actually covers: from its start beat in the first bar, from 0
 * thereafter; and in the LAST bar only to where the trill stops — the onset of the slot after the
 * last trilled one, since the trill runs to that slot's edge. Reading the whole last bar would let a
 * low note the trill does not cover push the sign up.
 *
 * Shared by {@link baselineFor} (which asks what ink is in there) and the ladder claim (which asks
 * what beats the fragment took), so the two cannot come to disagree about the trill's own extent.
 */
function barSlice(
  p: Pick<TrillPlacement, 'view' | 'measureNumber'>,
  span: TrillSpan,
  voice: number,
): { from: Fraction; to: Fraction } {
  const capacity = measureCapacityFrac(p.view)
  return {
    from: p.measureNumber === span.startMeasure ? span.startBeat : ZERO,
    to: p.measureNumber === span.endMeasure
      ? (beatAfter(p.view, voice, span.endBeat) ?? capacity)
      : capacity,
  }
}

/**
 * ⭐ **What one fragment took**, on the ladder's absolute-beat axis
 * (`engine/layout/outsideStaffBand.ts`) — `null` when the fragment covers no bar this render drew.
 *
 * The fragment's musical extent is the trill's span clipped to the bars it landed on: the first
 * bar's {@link barSlice} start to the last bar's end. ⭐ That is the SAME slice {@link baselineFor}
 * measured the ink over, so what the trill CLEARED and what it CLAIMS are one stretch of music and
 * cannot drift apart.
 *
 * Pure, and exported for its spec: the beats are the part of this that can be wrong, and they are
 * arithmetic rather than geometry — so they belong in a unit test rather than in the browser suite
 * with the drawing.
 */
export function trillFragmentClaim(
  here: readonly Pick<TrillPlacement, 'view' | 'measureNumber'>[],
  span: TrillSpan,
  voice: number,
  line: number,
  staffId: string | undefined,
  side: 'above' | 'below',
  baseline: number,
  starts: Map<number, Fraction>,
): OccupiedSpan | null {
  const bars = [...here].sort((a, b) => a.measureNumber - b.measureNumber)
  const first = bars[0]
  const last = bars[bars.length - 1]
  if (!first || !last) return null
  const firstStart = starts.get(first.measureNumber)
  const lastStart = starts.get(last.measureNumber)
  if (!firstStart || !lastStart) return null
  return {
    line,
    staffId,
    side,
    from: fracAdd(firstStart, barSlice(first, span, voice).from),
    to: fracAdd(lastStart, barSlice(last, span, voice).to),
    band: markBand(baseline, TRILL_MARK_INK),
  }
}

const ZERO: Fraction = { num: 0, den: 1 }

/** The onset of the slot STRICTLY after `beat` in this lane, or undefined past the bar's music. */
function beatAfter(view: Measure, voice: number, beat: Fraction): Fraction | undefined {
  return view.slots
    .filter(s => voiceOf(s) === voice && fracGt(s.beat, beat))
    .sort((a, b) => fracCompare(a.beat, b.beat))[0]?.beat
}

/**
 * Cut the trill into the pieces the systems make. `planSlurSegments` is reused verbatim — its name
 * is the only thing about it that says "slur": it answers *given two system numbers and two x's,
 * what pieces does this span break into*, which is a fact about systems.
 */
function cutIntoPieces(
  pass: RenderPass,
  fromLine: number,
  toLine: number,
  startX: number,
  endX: number,
  scale: number,
): TrillPiece[] {
  const pieces: TrillPiece[] = []
  for (const seg of planSlurSegments(pass, fromLine, toLine, startX, endX, scale)) {
    const range = seg.type === 'single' ? { x0: startX, x1: endX, line: fromLine }
      : seg.type === 'begin' ? { x0: seg.firstX, x1: seg.rightX, line: fromLine }
        : seg.type === 'middle' ? { x0: seg.leftX, x1: seg.rightX, line: seg.line }
          : { x0: seg.leftX, x1: seg.lastX, line: toLine }
    if (range.x1 <= range.x0) continue
    // ⭐ `single` and `begin` carry the trill's real start; `middle` and `end` are resumptions.
    pieces.push({ ...range, continuation: seg.type === 'middle' || seg.type === 'end' })
  }
  return pieces
}

/** A glyph's drawn width, or 0 when the font cannot be measured (jsdom). */
function glyphWidth(el: Element): number {
  try {
    return el.getWidth() || 0
  } catch {
    return 0
  }
}

/**
 * Draw every trill in the score, above (or below) the music it covers, split at system breaks.
 */
/**
 * ⭐⭐ **WHERE EVERY TRILL SITS — computed after the curves are drawn and before every other
 * outside-staff family is placed.** `renderTrills` below only draws what this decided.
 *
 * ⭐ **The trill is the INNERMOST outside-staff family**, so of the LADDER it reads nothing; it exists
 * to FILE the claim early enough for the families outside it to see. Until 2026-08-17 the trill
 * claimed while drawing — after `planDynamicsLines` had already run — which was harmless while the
 * dynamics read nothing, and became a hole the moment they started to. ⚠️ So this pass is not a
 * refactor: it is what makes *"dynamics clear a trill"* true at all.
 *
 * ⭐⭐ **…and since 2026-08-18 it reads the DRAWN CURVES** ({@link curveBandUnder}) — the one input
 * that cannot be had from columns and beats. That is why it no longer runs above the measure loop,
 * and why the trill's lift needs no cascade: everything that has to clear a lifted `tr` is placed
 * after this, so it reads the lifted number rather than a snapshot of where the `tr` used to be.
 * ⛔ Move this above `renderSlurs` and the trill goes back through the arc.
 *
 * ⚠️ One entry per SYSTEM ({@link trillBandKey}) — a low note, or a high arc, on the second system
 * must not lift the first system's `tr`.
 */
export function planTrillBands(
  pass: RenderPass,
  score: Score,
  placements: readonly TrillPlacement[],
  staffIds: readonly (string | undefined)[],
): TrillBandPlan {
  const plan: TrillBandPlan = new Map()
  const trills = score.trills
  if (!trills?.length) return plan
  const starts = measureStartOffsets(score)

  for (const trill of trills) {
    const span = trillSpan(score, trill.id)
    if (!span) continue
    // The staff the trill lives on is its START note's — resolved through the placement holding it.
    const from = placements.find(p =>
      p.measureNumber === span.startMeasure && p.view.slots.some(s => s.id === span.slotIds[0]))
    if (!from) continue

    const voice = voiceOf(trill)
    const side = trill.placement ?? 'above'
    const staffId = staffIds[from.staffIndex]
    // ⭐ WHERE IT WILL BE DRAWN — the same arithmetic the drawing does ({@link trillGeometry}), asked
    // here because a curve is found by its x. ⚠️ `null` when the span's bars were not drawn; the
    // fragment then keeps its music-only band rather than losing its claim.
    const to = placements.find(p =>
      p.measureNumber === span.endMeasure && p.staffIndex === from.staffIndex)
    const geometry = to
      ? trillGeometry(pass, span, voice, from, to, trillOffsetOverrideOf(score, trill.id) ?? {})
      : null
    const covered = coveredPlacements(
      placements, span, from, geometry?.fromLine ?? from.line, geometry?.toLine ?? from.line)

    for (const line of new Set(covered.map(p => p.line))) {
      const here = covered.filter(p => p.line === line)
      const piece = geometry?.pieces.find(p => p.line === line)
      const baseline = baselineFor(pass, here, span, voice, staffId, staffIds[0], side, piece)
      plan.set(trillBandKey(trill.id, line), baseline)
      const claim = trillFragmentClaim(here, span, voice, line, staffId, side, baseline, starts)
      if (claim) pass.occupiedBands.push(claim)
    }
  }
  return plan
}

export function renderTrills(
  pass: RenderPass,
  score: Score,
  placements: readonly TrillPlacement[],
  staffIds: readonly (string | undefined)[],
  /** Where {@link planTrillBands} put each fragment. ⛔ Not recomputed here. */
  bands: TrillBandPlan,
): void {
  const trills = score.trills
  if (!trills?.length) return

  // ⛔ No `measureStartOffsets` here any more: the ladder's beat axis belongs to `planTrillBands`,
  // which files the claims. This pass only draws.
  for (const trill of trills) {
    const span = trillSpan(score, trill.id)
    if (!span) continue

    // The staff the trill lives on is its START note's — resolved through the placement holding it.
    const from = placements.find(p =>
      p.measureNumber === span.startMeasure && p.view.slots.some(s => s.id === span.slotIds[0]))
    const to = from && placements.find(p =>
      p.measureNumber === span.endMeasure && p.staffIndex === from.staffIndex)
    // Both endpoint bars are span anchors (`VexFlowRenderer.spanAnchors`), so a missing one means
    // the bar genuinely was not rendered — not that it was translated with stale coordinates.
    if (!from || !to) continue

    const voice = voiceOf(trill)
    // ⭐ The same geometry `planTrillBands` measured the curves over — one answer to where this trill
    // is, asked by both passes (see {@link trillGeometry}).
    const geometry = trillGeometry(
      pass, span, voice, from, to, trillOffsetOverrideOf(score, trill.id) ?? {})
    if (!geometry) continue

    const covered = coveredPlacements(placements, span, from, geometry.fromLine, geometry.toLine)

    try {
      // ⚠️ `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-trill' here
      // would yield `class="vf-vf-trill"`, the mistake the slur's comment records.
      const group = pass.context.openGroup?.('trill', `trill-${trill.id}`) as SVGGElement | undefined
      inStaffSpace(pass, from.staffIndex, group, () => {
        drawTrill(pass, trill, span, voice, geometry, covered, from, staffIds[from.staffIndex], staffIds[0], bands)
      })
      pass.context.closeGroup?.()
      if (group) pass.trillGroupMap.set(trill.id, group)
    } catch (e) {
      console.error('Could not render trill:', e)
    }
  }
}

/**
 * The bars this ornament is DRAWN over — its span's, ⭐ **plus every line its ink was FOLDED onto**
 * ({@link foldPastSystemEnd}).
 *
 * ⚠️ Without the second half a folded fragment finds no placement on its line, so it borrows the
 * FIRST system's stave: its wiggle would be drawn at that system's height over the next system's
 * x's, and its band would be planned there too.
 */
function coveredPlacements(
  placements: readonly TrillPlacement[],
  span: TrillSpan,
  from: TrillPlacement,
  fromLine: number,
  toLine: number,
): TrillPlacement[] {
  // ⚠️ `fromLine` may be EARLIER than the span's own line — a sign folded BACKWARDS — so the window
  // is taken from both folded ends rather than grown forward from the span.
  const first = Math.min(fromLine, from.line)
  const last = Math.max(toLine, from.line)
  return placements.filter(p =>
    p.staffIndex === from.staffIndex
    && ((p.measureNumber >= span.startMeasure && p.measureNumber <= span.endMeasure)
      || (p.line >= first && p.line <= last)))
}

/** The drawing itself, once {@link trillGeometry} has said where the ornament goes. */
function drawTrill(
  pass: RenderPass,
  trill: Trill,
  span: TrillSpan,
  voice: number,
  geometry: { startX: number; endX: number; fromLine: number; toLine: number; pieces: TrillPiece[] },
  covered: readonly TrillPlacement[],
  from: TrillPlacement,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  bands: TrillBandPlan,
): void {
  const side = trill.placement ?? 'above'
  const ctx = pass.context

  // ⭐ AIR AT THE END, and the cut into system fragments, both live in {@link trillGeometry} — this
  // pass no longer computes either, because `planTrillBands` needs the same answer to know which
  // stretch of x to look for a slur over. ⛔ Do not re-derive them here.

  // ⭐⭐ THE ATTACHMENT GUIDE'S FAR END — the trilled NOTE, captured once for the whole ornament.
  //
  // ⭐ **A trill's anchor really is a note**, which puts it with the dynamic and against the tempo
  // mark (whose anchor is a place in time — see docs/dynamic-offset-plan.md). The distinction is not
  // a style choice: this ornament is DEFINED by that note. Its auxiliary is a step above THAT pitch
  // (`utils/trillPitch`), so a guide that pointed at a staff line instead would be pointing away
  // from the thing the trill is computed from.
  const anchor = trilledNoteAnchor(pass, from, voice, span, side === 'above')

  // ⭐⭐ THE HAND-NUDGED INK — the two squares' own category of edit ({@link TrillOffsetOverride}).
  // Three numbers, not two pairs: `outward` is ONE quantity for the ornament, because the sign and
  // the wiggle are drawn on one baseline. So the vertical is applied to `baseline` inside the loop —
  // every fragment alike, in its own staff's spaces — and the two x's at the two sites marked below.
  //
  // ⛔⛔ **THE X NUDGES ARE APPLIED AFTER EVERY AUTOMATIC DECISION, AND THAT IS A RECORDED SCAR.**
  // The bracket's start nudge was once added before `Math.max(…, barLeft)` — the clamp that stops the
  // automatic continuation inset reaching back onto the clef — and it ate the hand nudge dead (*"i
  // cannot offset the right side from a limit"*). ⭐ A machine's guess is worth clamping; the
  // engraver's own instruction is not.
  const nudge = trillOffsetOverrideOf(pass.score, trill.id)

  const pieces = geometry.pieces
  let firstPiece = true
  for (const piece of pieces) {
    // ⭐ THIS FRAGMENT'S OWN SYSTEM — its stave, its own ink band, its staff-space size. All three
    // are facts about the system the piece landed on, not about where the trill began.
    const here = covered.filter(p => p.line === piece.line)
    const stave = here[0]?.stave ?? from.stave
    const px = (spaces: number) => staffSpacesToPixels(spaces, stave)
    // ⛔ READ, never recomputed — and ⛔ NO CLAIM IS FILED HERE. `planTrillBands` did both before the
    // dynamics line was planned, which is what lets the dynamics clear this `tr`. A second claim for
    // one fragment would push everything outside it a band further out, and would compile.
    const baseline = bands.get(trillBandKey(trill.id, piece.line))
      ?? baselineFor(pass, here.length ? here : covered, span, voice, staffId, firstStaffId, side, piece)
    // ⭐⭐ THE SHARED VERTICAL NUDGE, on every fragment alike — which is what keeps the sign and the
    // wiggle on one baseline across a system break as well as within one.
    //
    // ⭐⭐ **`outward` is a distance FROM THE STAFF, so it is negated above it** — one of the two
    // places that convert (the page limit is the other). `baseline` is screen-relative and already
    // signed per side; the stored number is not, so that `x` (flip the side) cannot invert a nudge
    // the user already made. See {@link TrillOffsetOverride}.
    const lift = (nudge?.outward ?? 0) * (side === 'above' ? -1 : 1)
    const y = stave.getYForLine(0) + px(baseline + lift)

    // ⭐ EVERY FRAGMENT DRAWS ITS OWN SIGN (rule 6) — a continuation system has to say what the
    // wavy line means, so this is outside any "first piece only" condition on purpose.
    //
    // ⭐⭐ …and a RESUMED fragment labels itself by the trill's OWN choice — `(tr)` by default, a
    // plain `tr`, or nothing at all (see `Trill.continuationLabel` for who does which).
    const label: TrillContinuationLabel = trill.continuationLabel ?? 'parenthesised'
    const drawsSign = !(piece.continuation && label === 'none')

    // ⭐⭐ **WHERE the resumed sign goes depends on WHICH sign it is** — his rule, 2026-08-13, and it
    // is a real distinction rather than a tidy-up:
    //
    //  - `(tr)` is a REMINDER that a trill is still running, so it belongs at the system's left
    //    edge, exactly where an `(8)` continuation sits. That is what a bracketed label IS.
    //  - a plain `tr` is THE SIGN RESTARTING, so it belongs on its note — which is also what both
    //    independent sources do: LilyPond ("restart exactly above the first note on the new line")
    //    and the Cotta Op. 111 plates, where the repeated `tr` sits hard against the first notehead.
    //
    // ⚠️ Under `'plain'` the stretch from the margin to that note therefore draws NOTHING. The trill
    // is announced at its note, not led up to — drawing wiggle first and the sign after it would
    // read as a line that acquires a label halfway along.
    const restartOnNote = piece.continuation && label === 'plain'
    // ⭐ A PARENTHESISED reminder sits LEFT of where the music begins — see
    // {@link TRILL_CONTINUATION_INSET} for why `piece.x0` alone was not the margin it claimed to be.
    // ⚠️ Clamped at the bar's own left edge, so it can never reach back onto the clef; and ⛔ never
    // applied to a plain restart, which is anchored to its note by the rule above.
    const remindsAtMargin = piece.continuation && label === 'parenthesised'
    const barLeft = here[0] ? pass.measureBounds.get(here[0].measureNumber)?.measureX : undefined
    const marginX = remindsAtMargin
      ? (barLeft === undefined
        ? piece.x0 - px(TRILL_CONTINUATION_INSET)
        : Math.max(piece.x0 - px(TRILL_CONTINUATION_INSET), barLeft / (here[0]?.scale ?? 1)))
      : piece.x0
    const autoSignX = (restartOnNote ? firstNoteXOnLine(pass, here, voice) : undefined) ?? marginX
    // ⭐ …and the START square's own nudge on top of every clamp above, never inside one — see the
    // note before the loop. ⚠️ Only on the piece carrying the real beginning: a continuation `(tr)`
    // is a reminder the reader gets for free, not the end the user grabbed.
    // ⭐ The START square's nudge is already IN `piece.x0` — {@link trillGeometry} folds it in
    // before the pieces are cut, exactly as it does the end's. ⛔ Adding it again here would double
    // every sign nudge.
    const signX = autoSignX
    const signWidth = drawsSign
      ? drawTrillSign(ctx, signX, y, piece.continuation && label === 'parenthesised')
      : 0

    // ⚠️ No sign means no GAP either — the gap exists to separate the line from the sign, so keeping
    // it under `'none'` would indent the wiggle from the margin for no visible reason.
    const lineStart = drawsSign ? signX + signWidth + px(TRILL_SIGN_GAP) : piece.x0
    // ⭐ The END square's nudge is already IN `piece.x1` — {@link trillGeometry} folds it in before
    // the pieces are cut, because past the end of a line it changes which pieces there are (the
    // FOLD). ⛔ Adding it again here would double every end nudge.
    const lineEnd = piece.x1
    // ⭐⭐ **THE LINE DRAWS BY DEFAULT — his call, 2026-08-13**, overruling docs/trill-plan.md §1
    // rule 5 ("a single note needs no wavy line"), which was LilyPond's and Gould's. A bare `tr`
    // leaves the duration implied; he wants it shown, on one note as much as on twenty.
    //
    // ⭐ Two things suppress it, and they are different in kind: `extension: 'none'` is the ENGRAVER
    // asking for a bare `tr` (his ask, 2026-08-18 — {@link Trill.extension}), while `lineEnd >
    // lineStart` is a geometric fact, no room left after the sign. ⛔ Don't merge them into one
    // "should we draw" flag: one is a decision the score records and the other is arithmetic.
    const drawsLine = trill.extension !== 'none' && lineEnd > lineStart
    if (drawsLine) {
      drawWiggle(pass, lineStart, lineEnd, y, stave)
    }

    // ⭐ ONE REGISTRY ENTRY PER FRAGMENT, all carrying the trill's id — so either half of a split
    // trill is clickable and a hit resolves to the whole ornament. `points` walk the drawn band
    // rather than a bbox spanning bars of music underneath (`HairpinRenderer`'s reasoning).
    const top = y - px(TRILL_MARK_INK.above)
    const bottom = y + px(TRILL_MARK_INK.below)
    // ⭐⭐ WHERE THIS FRAGMENT'S INK ACTUALLY STARTS AND STOPS — ⛔ NOT `piece.x0`, which is where the
    // fragment's SPAN begins.
    //
    // 🚨 His report, 2026-08-18: *"the left endpoint does not move with the offset."* The box was
    // built from `piece.x0` at both ends, so a `startX` nudge moved the drawn `tr` and left its
    // hit-box — and the START square hanging off it — exactly where they were. The END square moved
    // all along, because `lineEnd` carries its own nudge, which is why only one of the two looked
    // broken. ⭐ The registry describes the INK; the sign's own x is where the ink begins.
    //
    // ⚠️ It also fixes a smaller pre-existing lie: a continuation `(tr)` is drawn LEFT of `piece.x0`
    // by {@link TRILL_CONTINUATION_INSET}, and its box never covered that.
    //
    // ⚠️ A bare `tr` stops at the sign — otherwise the box would claim a strip of empty staff where
    // the line would have been.
    const inkLeft = drawsSign ? signX : piece.x0
    const inkRight = drawsLine ? Math.max(lineEnd, inkLeft + signWidth) : inkLeft + signWidth
    pass.elementRegistry.add({
      type: 'trill',
      id: trill.id,
      staff: from.staffIndex,
      measure: from.measureNumber,
      bbox: { x: inkLeft, y: top, width: inkRight - inkLeft, height: bottom - top },
      points: [
        { x: inkLeft, y: top },
        { x: inkRight, y: top },
        { x: inkRight, y: bottom },
        { x: inkLeft, y: bottom },
      ],
      // ⭐ The guide's two ends, on the FIRST fragment only — `getById` answers with the first entry
      // registered under an id, and the first fragment is the one holding the start note. ⛔ Putting
      // them on every fragment would be writing a second answer nothing reads; a continuation `(tr)`
      // on a later system is a reminder, not a second attachment.
      // ⚠️ Both are in this staff's own scaled space, like every other coordinate here.
      // The sign's ink corner NEAREST the staff — its BOTTOM for an above-staff trill, its top for a
      // `below` one. The same rule the dynamic and the tempo mark follow, which is what keeps the
      // guide from crossing the glyph it leaves.
      // ⭐⭐ **ALWAYS, however far the sign has been nudged or FOLDED** — his call, 2026-08-20:
      // *"I want to see the anchor point of the `tr`, so we should draw it always, regarding the
      // anchor element the `tr` is drawn for — that is what it is"*. A sign offset onto a later
      // system draws a long diagonal back to its note, and that is the honest picture of what the
      // ornament belongs to. ⛔ Suppressing it (my first answer to his report) hid the very fact he
      // was asking about; the report was about the guide pointing at the WRONG PLACE, which was
      // {@link trilledNoteAnchor}'s x, not about the line existing.
      ...(firstPiece && anchor
        ? { guides: [{ from: { x: signX, y: side === 'above' ? bottom : top }, to: anchor }] }
        : {}),
    })
    firstPiece = false
  }
}

/**
 * Where the guide points: the trilled note's own notehead, nearest the sign.
 *
 * ⚠️ `undefined` when the start note was not drawn (its bar is culled, or the lane is empty there) —
 * the caller then registers no guide at all rather than one ending at a guessed point. A guide is
 * never a guess (`feedback` on fallbacks that get believed).
 *
 * ⭐ The x is the SPAN's own start — the notehead's left edge (rule 4), already computed for the
 * drawing — so the guide and the sign agree about where the trill begins by construction.
 */
function trilledNoteAnchor(
  pass: RenderPass,
  from: TrillPlacement,
  voice: number,
  span: TrillSpan,
  above: boolean,
): { x: number; y: number } | undefined {
  const slotId = slotIdAt(from.view, voice, span.startBeat)
  const note = pass.staveNoteMap.get(slotId ?? '')?.staveNote
  const ys = note?.getYs?.()
  const x = noteLeftX(pass, slotId)
  if (!ys?.length || x === undefined) return undefined
  // 🚨🚨 **BOTH COORDINATES COME FROM THE NOTE**, and the x used to be handed in as the geometry's
  // `startX`. That was fine while `startX` was the span's own beginning; the moment the START
  // square's nudge (and the FOLD) moved into the geometry, the guide's TARGET travelled with the
  // sign instead of staying on the notehead — his report, 2026-08-20: *"why do I see the anchor line
  // running even in the empty measures in the first system?"*. ⭐ A guide points at a NOTE, so it
  // asks the note.
  //
  // The notehead FACING the sign: the topmost for a trill above the staff, the lowest for one below
  // — a chord's other heads are further from it, and the guide should stop at the first ink it meets.
  return { x, y: above ? Math.min(...ys) : Math.max(...ys) }
}

/**
 * Where the FIRST note of a system sits, in the trill's own lane — the anchor a plain restarted `tr`
 * hangs off (see the rule in {@link drawTrill}).
 *
 * ⚠️ `undefined` when the bar was not drawn or the lane is empty there, and the caller falls back to
 * the margin. A restart that cannot find its note is better at the edge than not at all.
 */
function firstNoteXOnLine(
  pass: RenderPass,
  onThisLine: readonly TrillPlacement[],
  voice: number,
): number | undefined {
  const first = [...onThisLine].sort((a, b) => a.measureNumber - b.measureNumber)[0]
  if (!first) return undefined
  return noteLeftX(pass, slotIdAt(first.view, voice, ZERO))
}

/**
 * The `tr` — parenthesised when this fragment is a resumption. @returns the total width drawn.
 *
 * ⚠️ Each glyph is placed from the MEASURED width of the one before it, never from a guessed
 * advance: the parentheses and the `tr` are three different glyphs of three different widths, and a
 * fixed step would leave a visible gap in one font and an overlap in another. In jsdom every width
 * is 0, so all three land at the same x and the total is 0 — which is why the parenthesis assertion
 * lives in the browser suite.
 *
 * ⚠️ Exported for ONE caller outside this pass: the cursor ghost (`./TrillGhost`), which draws the
 * plain sign at the pointer. It goes through this rather than through the two constants so the
 * preview and the engraved mark are the same glyph at the same size by construction — the tempo
 * ghost shares `drawTempoText` for the same reason.
 */
export function drawTrillSign(ctx: RenderPass['context'], x: number, y: number, parenthesised: boolean): number {
  const glyph = (text: string, at: number): number => {
    const el = new Element('TrillRenderer.sign')
    el.setText(text)
    el.setFontSize(TRILL_GLYPH_SIZE)
    el.renderText(ctx, at, y)
    return glyphWidth(el)
  }
  if (!parenthesised) return glyph(TRILL_SIGN_GLYPH, x)

  // ⚠️ The parens are TEXT and the sign is a music GLYPH, so each needs its own font — and the
  // family must OWN an italic face, or `font-style: italic` renders upright (see TRILL_PAREN_FONT).
  // Raised off the sign's baseline because a text paren descends and a `tr` does not.
  const size = TRILL_GLYPH_SIZE * TRILL_PAREN_SCALE
  const parenY = y - size * TRILL_PAREN_RAISE
  const paren = (text: string, at: number): number => {
    const el = new Element('TrillRenderer.paren')
    el.setFont(TRILL_PAREN_FONT, size, 'normal', 'italic')
    el.setText(text)
    el.renderText(ctx, at, parenY)
    return glyphWidth(el)
  }

  let width = paren(TRILL_PAREN_LEFT, x)
  width += glyph(TRILL_SIGN_GLYPH, x + width)
  width += paren(TRILL_PAREN_RIGHT, x + width)
  return width
}

/**
 * ⭐ **THE WIGGLE — repeat the glyph to length, and put the remainder in the GAPS.**
 *
 * `N = round(span / unit)` copies, with the ≤ half-unit remainder distributed into the spacing
 * BETWEEN them, so the glyphs stay unscaled and the line ends exactly where it should. Repeating
 * without that is what makes VexFlow's vibrato overshoot its bracket; scaling instead would make one
 * trill's wave visibly coarser than another's.
 *
 * ⚠️ **A no-op without a measurable font.** In jsdom the glyph measures 0, so there is no unit to
 * repeat and this draws nothing rather than looping forever — which is also why every assertion
 * about the wiggle lives in the browser suite.
 */
function drawWiggle(pass: RenderPass, startX: number, endX: number, y: number, stave: Stave): void {
  const probe = new Element('TrillRenderer.wiggle')
  probe.setText(TRILL_WIGGLE_GLYPH)
  probe.setFontSize(staffSpacesToPixels(TRILL_GLYPH_SIZE / 10, stave))
  const unit = glyphWidth(probe)
  if (!(unit > 0)) return

  const width = endX - startX
  const count = Math.max(1, Math.round(width / unit))
  // The leftover, shared between the count−1 joins. One repeat has no join, so it simply sits at the
  // start and the line is as long as one glyph — the honest answer for a span barely wider than one.
  const slack = count > 1 ? (width - count * unit) / (count - 1) : 0

  for (let i = 0; i < count; i++) {
    const glyph = new Element('TrillRenderer.wiggle')
    glyph.setText(TRILL_WIGGLE_GLYPH)
    glyph.setFontSize(staffSpacesToPixels(TRILL_GLYPH_SIZE / 10, stave))
    glyph.renderText(pass.context, startX + i * (unit + slack), y)
  }
}
