/**
 * ⭐⭐ **SUSTAIN PEDALS — `Ped.` and its release `✻`, drawn.** P2 of docs/pedal-plan.md.
 *
 * A score-level pass after the measures, exactly like `renderHairpins` / `renderTrills` /
 * `renderOttavas` and for the same reason: a pedal spans bars, so it cannot be drawn inside any one
 * bar's group. `./OttavaRenderer` is the template and most of this file is its shape.
 *
 * ## The four things that are genuinely different, and each is a rule rather than a preference
 *
 * ⭐⭐ **1. It is the OUTERMOST family below the staff, and that is expressed by WHEN it runs.**
 * `renderPedals` is called after every other below-staff pass, so `layout/outsideStaffBand` has
 * already been told what the dynamics line, the hairpins, the trills and the octave lines took, and
 * this pass clears the lot (§1 rule 1; Dorico: pedal lines go below the bottom staff and outside
 * everything; LilyPond's pedal spanners are `outside-staff-priority` 1000 against the dynamics' 250).
 * ⛔ The rung is the PASS ORDER, not a number: move the call and you change the ladder.
 *
 * ⭐⭐ **2. The end is the LIFT — a point in TIME.** ⚠️ This is the family's THIRD end rule and it is
 * neither neighbour's: a trill's ink ends at the end of the note's DURATION, an ottava's at the last
 * NOTEHEAD, and a pedal's at a column x that no note need occupy at all (§5.2). Where the lift lands
 * on a barline the x is the bar's `noteEndX` — *just inside* the line, which is Gould's own rule
 * arriving for free rather than as a clamp. ⛔ Do not "fix" this by copying either neighbour.
 *
 * ⭐ **3. It has no VOICE and no SIDE.** A pedal governs the staff (one damper, one foot), so its x's
 * are read from the earliest and latest slots of that staff whatever voice they are in — and it is
 * always BELOW, so unlike the trill and the ottava there is nothing to derive and nothing to flip.
 *
 * ⭐ **4. Two glyphs, no line between them — so the REGISTRY grain is the GLYPH, not the fragment.**
 * Every other span here registers one box per drawn fragment; a `Ped.✻` pedal would then claim a wide
 * empty strip under music it merely passes over, and *a press may only reach INK*
 * (docs/barline-selection.md). So each drawn sign registers its own box, all carrying the pedal's id.
 * ⭐ When the bracket style arrives the line becomes ink and the boxes merge back into one per
 * fragment — here and in `interactions/elements/pedal.ts`, nowhere else.
 *
 * ## The two coordinate spaces, because mixing them is the recurring bug here
 *
 * Everything drawn runs inside `inStaffSpace`, i.e. the staff's own `scale(k)` group: note and stave
 * coordinates are in it already. A SYSTEM EDGE is not — `measureBounds` says where a bar landed in
 * the SVG — so it is divided by the scale on the way in, the same conversion `planSlurSegments`
 * makes. `OttavaRenderer`'s note, and it applies here verbatim.
 */
import type { Stave } from 'vexflow'
import { Element } from 'vexflow'
import type { Score, Pedal, Measure, Fraction } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import type { GuideLine } from '@/engine/ElementRegistry'
import { pedalSpan, type PedalSpan } from '@/engine/models/pedalOps'
import { pedalOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { pedalDrawStaff } from '@/utils/pedalScope'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand, type InkBand } from '@/engine/layout/inkBand'
import { bandOver, markBand, measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracAdd, fracCompare } from '@/utils/fraction'
import { planSlurSegments } from './SlurRenderer'
import { wrapReleaseOntoNextLine } from './pedalReleaseWrap'
import { onsetXOf } from '@/engine/layout/measureRestOnset'
import { inStaffSpace } from './staffScaleGroup'
import { staffSpacesToPixels } from './staffSpace'
import {
  PEDAL_BARLINE_AIR, PEDAL_CONTINUATION_INSET, PEDAL_DOWN_GLYPH, PEDAL_GLYPH_SIZE, PEDAL_LINE,
  PEDAL_MARK_INK, PEDAL_MIN_SPAN, PEDAL_PAREN_LEFT, PEDAL_PAREN_RIGHT, PEDAL_SIGN_GAP, PEDAL_UP_GLYPH,
} from './pedalStyle'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement`, declared structurally so the renderer that calls this
 * is not imported back by it — the shape `OttavaRenderer` and `TrillRenderer` already use.
 */
export interface PedalPlacement {
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

/** One drawn piece of a pedal: an x range, WHICH SYSTEM, and the two things a fragment has to know
 *  about itself — whether it is a resumption and whether it carries the lift. */
interface PedalPiece {
  x0: number
  x1: number
  line: number
  /** ⭐ Did the pedal go down on an EARLIER system? Its `Ped.` is parenthesised — the reader
   *  arriving here must be told the damper is still down and that it did not start here (§5.3). */
  continuation: boolean
  /** ⭐ Does this fragment carry the LIFT? Only that one draws the `✻`. */
  final: boolean
}

const ZERO: Fraction = { num: 0, den: 1 }

/** The id `staveNoteMap` is keyed by for a slot — the first PITCH id for a chord, the slot id for a
 *  rest. `OttavaRenderer`'s convention, and it must match or nothing resolves. */
function drawnIdOf(slot: Measure['slots'][number]): string | undefined {
  return slot.type === 'chord' ? slot.notes[0]?.id : slot.id
}

/** A rendered notehead's LEFT edge, in its staff's own space, or undefined if that bar was not drawn. */
function noteLeftX(pass: RenderPass, noteId: string | undefined): number | undefined {
  if (!noteId) return undefined
  const note = pass.staveNoteMap.get(noteId)?.staveNote
  if (!note) return undefined
  const head = (note as unknown as { getNoteHeadBeginX?: () => number }).getNoteHeadBeginX
  return head ? head.call(note) : note.getTieLeftX()
}

/**
 * The left x of the first slot of this bar's lane at or after `beat` — ⭐ **"at or after", and over
 * EVERY VOICE**, which is where this differs from `TrillRenderer.slotIdAfter`.
 *
 * *At* or after, because a pedal's ends are points in time that a slot normally lands exactly on (a
 * lift is usually the next note's onset), where the trill is asking a different question — where the
 * note it decorates stops. Every voice, because a pedal has no voice to narrow to (§3.1); the
 * earliest onset wins, since that is where the ink of that column begins.
 */
function slotXAtOrAfter(
  pass: RenderPass,
  view: Measure,
  beat: Fraction,
  /** ⭐ That bar's `noteStartX`, in the STAFF's own space — see {@link onsetXOf}: a measure rest is
   *  drawn centred, so its glyph says "this bar is empty" rather than where its time is. */
  barStartX: number | undefined,
): number | undefined {
  const candidates = view.slots
    .filter(s => fracCompare(s.beat, beat) >= 0)
    .sort((a, b) => fracCompare(a.beat, b.beat))
  for (const slot of candidates) {
    const x = noteLeftX(pass, drawnIdOf(slot))
    // ⚠️ Only a REST can be a measure rest — a `Chord` has no such field, which is the model saying
    // the same thing this rule does.
    if (x !== undefined) {
      return onsetXOf(x, slot.type === 'rest' && slot.isMeasureRest, barStartX)
    }
  }
  return undefined
}

/**
 * ⭐⭐ **WHERE THE FOOT GOES DOWN AND COMES UP, in x.**
 *
 * Start: the column the press lands on. End: the column the LIFT lands on — **or, when the lift
 * lands on a barline, that bar's `noteEndX`**, which is the last x the music reaches before the line.
 *
 * ⭐ That fallback IS §1 rule 3 (*the release lands at or before the barline, never after it*), and
 * it costs nothing: it is `TrillRenderer.spanX`'s own fallback, reached here by the ordinary case
 * rather than by an exception. ⚠️ A lift beat with no slot on this staff is NORMAL, not degenerate —
 * a whole note in this staff while the lift is at beat 3, or any bar where the other voice carries
 * the motion — and it falls through to the same place.
 *
 * ⛔ Not `CoordinateMapper.beatToPixelX`, which interpolates a bar's width linearly and knows nothing
 * about where the spacing solve put the columns.
 */
function spanX(
  pass: RenderPass,
  span: PedalSpan,
  from: PedalPlacement,
  to: PedalPlacement,
): { startX: number; endX: number } | null {
  const barStart = (at: PedalPlacement) => {
    const x = pass.measureBounds.get(at.measureNumber)?.noteStartX
    return x === undefined ? undefined : x / at.scale
  }
  const startX = slotXAtOrAfter(pass, from.view, span.startBeat, barStart(from))
  if (startX === undefined) return null

  // ⭐ The barline case, and the air is only here: `noteEndX` is where the music's space stops and
  // the line is drawn, so a release right-aligned exactly there has its ink leaning on the barline
  // (measured: 250 against 250). A mid-bar lift lands on its own column and wants no such nudge.
  const barEnd = pass.measureBounds.get(to.measureNumber)?.noteEndX
  const endX = slotXAtOrAfter(pass, to.view, span.endBeat, barStart(to))
    ?? (barEnd === undefined
      ? undefined
      : barEnd / to.scale - staffSpacesToPixels(PEDAL_BARLINE_AIR, to.stave))
  if (endX === undefined) return null

  // ⚠️ No `endX <= startX` guard, for `TrillRenderer.spanX`'s reason: across a system break the two
  // x's live in different systems' coordinates and comparing them says nothing. A degenerate
  // SAME-SYSTEM span is dropped by {@link cutIntoPieces}, which is the only place both are known to
  // be on one row.
  return { startX, endX }
}

/**
 * ⭐ The slice of ONE bar the pedal covers, in that bar's own beats — the first bar from the press,
 * the last bar to the lift, everything between it whole.
 *
 * Shared by {@link baselineFor} (what ink is in there) and {@link pedalFragmentClaim} (what beats the
 * fragment took), so what the pedal CLEARED and what it CLAIMS cannot drift apart. `OttavaRenderer`
 * makes the same pairing for the same reason.
 */
function barSlice(p: Pick<PedalPlacement, 'view' | 'measureNumber'>, span: PedalSpan): { from: Fraction; to: Fraction } {
  return {
    from: p.measureNumber === span.startMeasure ? span.startBeat : ZERO,
    to: p.measureNumber === span.endMeasure ? span.endBeat : measureCapacityFrac(p.view),
  }
}

/**
 * ⭐⭐ **THE PEDAL'S OWN Y — and it is the ladder's last consumer.**
 *
 * Two bands merged: the MUSIC's ink over the bars of THIS FRAGMENT (`layout/inkBand`), and everything
 * every other below-staff family has already claimed there (`layout/outsideStaffBand`). ⭐ That merge
 * IS "outside everything"; there is no priority table, and the order is the order the passes run in.
 *
 * ⚠️ **Per FRAGMENT, not per span** — the family's rule (`OttavaRenderer`, `TrillRenderer`), and it
 * is what makes §1 rule 2 true where the book asks for it: a pedal and ITS OWN release share one
 * baseline because an unbroken pedal is ONE fragment. A pedal split by a system break has two
 * pictures and two baselines, and the pair rule has nothing to say about signs on different systems.
 * ⛔ Not a baseline per glyph.
 */
function baselineFor(
  pass: RenderPass,
  here: readonly PedalPlacement[],
  span: PedalSpan,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  line: number,
  starts: Map<number, Fraction>,
): number {
  let music: InkBand | null = null
  let taken: InkBand | null = null
  for (const p of here) {
    const { from, to } = barSlice(p, span)
    music = mergeInkBands(music, staffInkBand(columnsBetween(p.system.columns, from, to), staffId, firstStaffId))
    const base = starts.get(p.measureNumber)
    if (base === undefined) continue
    taken = mergeInkBands(taken, bandOver(
      pass.occupiedBands, line, staffId, 'below',
      fracAdd(base, from), fracAdd(base, to), firstStaffId))
  }
  return clearanceBaseline(mergeInkBands(music, taken), 'below', PEDAL_MARK_INK, PEDAL_LINE)
}

/**
 * ⭐ **What one fragment took**, on the ladder's absolute-beat axis — `null` when the fragment covers
 * no bar this render drew.
 *
 * ⚠️ Nothing reads it today: the pedal is the last below-staff pass, so this claim is filed for a
 * family that does not exist yet. It is written anyway for the reason the ladder exists — the order
 * is the pass order, and a family added after this one must find the space taken, not have to know
 * about pedals (`ottavaFragmentClaim`'s arrangement).
 *
 * Pure, and exported for its spec: the beats are the part of this that can be wrong, and they are
 * arithmetic rather than geometry.
 */
export function pedalFragmentClaim(
  here: readonly Pick<PedalPlacement, 'view' | 'measureNumber'>[],
  span: PedalSpan,
  line: number,
  staffId: string | undefined,
  baseline: number,
  starts: Map<number, Fraction>,
): OccupiedSpan | null {
  const bars = [...here].sort((a, b) => a.measureNumber - b.measureNumber)
  const first = bars[0]
  const last = bars[bars.length - 1]
  if (!first || !last) return null
  const firstStart = starts.get(first.measureNumber)
  const lastStart = starts.get(last.measureNumber)
  if (firstStart === undefined || lastStart === undefined) return null
  return {
    line,
    staffId,
    side: 'below',
    from: fracAdd(firstStart, barSlice(first, span).from),
    to: fracAdd(lastStart, barSlice(last, span).to),
    band: markBand(baseline, PEDAL_MARK_INK),
  }
}

/**
 * Cut the pedal into the pieces the systems make. `planSlurSegments` is reused verbatim — its name is
 * the only thing about it that says "slur": it answers *given two system numbers and two x's, what
 * pieces does this span break into*, which is a fact about systems.
 */
function cutIntoPieces(
  pass: RenderPass,
  fromLine: number,
  toLine: number,
  startX: number,
  endX: number,
  scale: number,
): PedalPiece[] {
  const pieces: PedalPiece[] = []
  for (const seg of planSlurSegments(pass, fromLine, toLine, startX, endX, scale)) {
    const range = seg.type === 'single' ? { x0: startX, x1: endX, line: fromLine }
      : seg.type === 'begin' ? { x0: seg.firstX, x1: seg.rightX, line: fromLine }
        : seg.type === 'middle' ? { x0: seg.leftX, x1: seg.rightX, line: seg.line }
          : { x0: seg.leftX, x1: seg.lastX, line: toLine }
    // ⚠️ `<`, not `<=`: a FINAL fragment may legitimately be a hair wide (a lift just inside a new
    // system's first bar), and dropping it would leave a pedal whose release is never drawn.
    if (range.x1 < range.x0) continue
    pieces.push({
      ...range,
      // `single` and `begin` carry the press; `middle` and `end` are resumptions.
      continuation: seg.type === 'middle' || seg.type === 'end',
      // ⭐ …and `single` and `end` carry the LIFT, which is the only place a `✻` may go.
      final: seg.type === 'single' || seg.type === 'end',
    })
  }
  return pieces
}

/** This pedal's stored `endX` nudge, in staff spaces — 0 when it carries none. Read here as well as
 *  in {@link drawPedal} because the WRAP has to ask about the ink actually on the page
 *  (`./pedalReleaseWrap`), and the drawing adds the same number again where the `✻` lands. */
function nudgeOf(pass: RenderPass, id: string): number {
  return pedalOffsetOverrideOf(pass.score, id)?.endX ?? 0
}

/** A glyph's drawn width, or 0 when the font cannot be measured (jsdom). */
function glyphWidth(el: Element): number {
  try {
    return el.getWidth() || 0
  } catch {
    return 0
  }
}

/** Draw every sustain pedal in the score, below the staff it is attached to, split at system
 *  breaks. */
export function renderPedals(
  pass: RenderPass,
  score: Score,
  placements: readonly PedalPlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  // The ladder's shared horizontal axis, walked once for the render rather than per pedal.
  const starts = measureStartOffsets(score)

  for (const measure of score.measures) {
    for (const pedal of measure.pedals ?? []) {
      const span = pedalSpan(score, pedal.id)
      if (!span) continue

      // ⭐ WHICH STAFF IT IS DRAWN UNDER is the seam's question, not `pedal.staffId`'s
      // (docs/pedal-plan.md §3.2) — today the attached staff, tomorrow the bottom one of its
      // instrument, and this call site does not change when that does.
      const drawStaff = pedalDrawStaff(score, pedal)
      const staffIndex = staffIds.findIndex(id => (id ?? staffIds[0]) === (drawStaff ?? staffIds[0]))
      if (staffIndex < 0) continue

      const covered = placements
        .filter(p => p.staffIndex === staffIndex
          && p.measureNumber >= span.startMeasure
          && p.measureNumber <= span.endMeasure)
        .sort((a, b) => a.measureNumber - b.measureNumber)
      // Both endpoint bars are span anchors (`VexFlowRenderer.spanAnchors`), so an empty list means
      // the bars genuinely were not rendered — not that they were translated with stale coordinates.
      const from = covered[0]
      const to = covered[covered.length - 1]
      if (!from || !to) continue

      const x = spanX(pass, span, from, to)
      if (!x) continue

      // ⭐⭐ **A RELEASE PUSHED PAST THE END OF ITS LINE IS DRAWN ON THE NEXT ONE** (his ask,
      // 2026-08-21) — `./pedalReleaseWrap`, and it moves the PICTURE only: the lift keeps its beat,
      // so the same notes ring. ⚠️ Asked with the hand's nudge in, answered without it, because the
      // drawing adds it again where the `✻` lands.
      const onStaff = placements.filter(p => p.staffIndex === staffIndex)
      const wrapped = wrapReleaseOntoNextLine(
        pass, to.line, x.endX + staffSpacesToPixels(nudgeOf(pass, pedal.id), to.stave),
        to.scale, line => onStaff.some(p => p.line === line))
      // ⭐ The wrapped fragment needs a stave of its own to be drawn on, and the pedal's own bars do
      // not reach that line — so the first bar the render put there stands for it.
      const reach = wrapped
        ? [...covered, ...onStaff.filter(p => p.line === wrapped.line).slice(0, 1)]
        : covered
      const endLine = wrapped?.line ?? to.line
      const endX = wrapped?.endX ?? x.endX

      try {
        // ⚠️ `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-pedal' here
        // would yield `class="vf-vf-pedal"`, the mistake the slur's comment records.
        const group = pass.context.openGroup?.('pedal', `pedal-${pedal.id}`) as SVGGElement | undefined
        inStaffSpace(pass, staffIndex, group, () => {
          drawPedal(pass, pedal, span, { startX: x.startX, endX }, reach, from, endLine,
            wrapped !== null, staffIds[staffIndex], staffIds[0], starts)
        })
        pass.context.closeGroup?.()
        if (group) pass.pedalGroupMap.set(pedal.id, group)
      } catch (e) {
        console.error('Could not render pedal:', e)
      }
    }
  }
}

/** The drawing itself, once the span and the two x's are known. */
function drawPedal(
  pass: RenderPass,
  pedal: Pedal,
  span: PedalSpan,
  x: { startX: number; endX: number },
  covered: readonly PedalPlacement[],
  from: PedalPlacement,
  /** ⭐ The line the RELEASE is drawn on — the lift's own bar's line, unless its ink ran off the end
   *  of that line and `./pedalReleaseWrap` sent it to the next one. */
  endLine: number,
  /** ⚠️ True when that wrap fired, and then `x.endX` is already DRAWN ink: the hand's `endX` nudge is
   *  inside it and must ⛔ not be added again below. */
  releaseWrapped: boolean,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  starts: Map<number, Fraction>,
): void {
  const ctx = pass.context

  // ⭐⭐ THE HAND-NUDGED INK — the two squares' own category of edit ({@link PedalOffsetOverride}).
  // Three numbers, not two pairs: `y` is ONE quantity for the pair, because a pedal and its own
  // release share a baseline (Gould p. 333). So the vertical is applied to `baseline` inside the
  // loop — every fragment alike, in its own staff's spaces — and the two x's at the two sites marked
  // below.
  //
  // ⛔⛔ **THE X NUDGES ARE APPLIED AFTER EVERY AUTOMATIC DECISION, AND THAT IS A RECORDED SCAR.**
  // The bracket's start nudge was once added before `Math.max(…, barLeft)` — a clamp that exists to
  // stop the automatic continuation inset reaching back onto the clef — and it ate the hand nudge
  // dead (*"i cannot offset the right side from a limit"*). Both of this pass's x's go through
  // exactly such a `Math.max`, so both nudges land outside them. ⭐ A machine's guess is worth
  // clamping; the engraver's own instruction is not.
  const nudge = pedalOffsetOverrideOf(pass.score, pedal.id)

  let firstPiece = true
  for (const piece of cutIntoPieces(pass, from.line, endLine, x.startX, x.endX, from.scale)) {
    // ⭐ THIS FRAGMENT'S OWN SYSTEM — its stave, its own bands, its staff-space size.
    const here = covered.filter(p => p.line === piece.line)
    const stave = here[0]?.stave ?? from.stave
    const px = (spaces: number) => staffSpacesToPixels(spaces, stave)
    const baseline = baselineFor(
      pass, here.length ? here : covered, span, staffId, firstStaffId, piece.line, starts)
    // ⭐⭐ THE SHARED VERTICAL NUDGE, on every fragment alike — which is what keeps the pair on one
    // baseline across a system break as well as within one. ⚠️ Screen-signed and added as it is
    // stored: a pedal is always BELOW, so there is no side to convert for (the bracket's `outward`
    // exists only because `x` can flip its side).
    const y = stave.getYForLine(0) + px(baseline) + px(nudge?.y ?? 0)

    // ⭐ THE LADDER CLAIM — filed for whatever is placed outside this one day. ⚠️ Per FRAGMENT, in
    // that fragment's own beats.
    const claim = pedalFragmentClaim(
      here.length ? here : covered, span, piece.line, staffId, baseline, starts)
    if (claim) pass.occupiedBands.push(claim)

    // ⭐ EVERY FRAGMENT OPENS WITH `Ped.`, parenthesised when it is a resumption (§5.3) — a reader
    // arriving on a new system has to be told the damper is still down, and the brackets say it did
    // not go down here.
    //
    // ⭐ A RESUMED sign starts LEFT of where the music does ({@link PEDAL_CONTINUATION_INSET}):
    // `planSlurSegments`' left edge is `noteStartX`, which would put `(Ped.)` on top of the first
    // notehead. ⚠️ Clamped at the bar's own left edge so it can never reach back past the stave and
    // collide with the clef.
    const barLeft = here[0] ? pass.measureBounds.get(here[0].measureNumber)?.measureX : undefined
    const inset = piece.continuation ? px(PEDAL_CONTINUATION_INSET) : 0
    const autoSignX = barLeft === undefined
      ? piece.x0 - inset
      : Math.max(piece.x0 - inset, barLeft / (here[0]?.scale ?? 1))
    // ⭐ …and the START square's own nudge on top of that clamp, never inside it — see the note above
    // the loop. ⚠️ Only on the piece carrying the real press: a continuation `(Ped.)` is a reminder
    // the reader gets for free, not the sign the user grabbed.
    const signX = autoSignX + (piece.continuation ? 0 : px(nudge?.startX ?? 0))

    const downWidth = drawPedalSign(ctx, signX, y, piece.continuation)
    // ⭐⭐ THE ATTACHMENT GUIDE — the sixth kind (docs/dynamic-offset-plan.md), and it rides the
    // `Ped.` because that is the sign the gesture BEGINS with.
    //
    // ⭐ Its far end is a PLACE, like the hairpin's and the octave line's: a pedal governs a region —
    // every voice on the staff, every note struck while the damper is down — so it belongs to no one
    // pitch. ⛔ Not the trill's rule, whose ornament is computed from its note.
    //
    // ⭐ It runs UP to the staff's BOTTOM line, this being the one family engraved BELOW everything,
    // and it leaves the sign's ink TOP — the corner facing that line, so it never crosses the glyph.
    // ⚠️ First fragment only: a `(Ped.)` on a later system is a reminder that the damper is still
    // down, not a second attachment.
    const guides = firstPiece
      ? [{
        from: { x: signX, y: y - px(PEDAL_MARK_INK.above) },
        to: { x: x.startX, y: stave.getYForLine(4) },
      }]
      : undefined
    registerGlyph(pass, pedal.id, from, signX, y, downWidth, px, 'down', guides)
    firstPiece = false

    if (!piece.final) continue

    // ⭐⭐ THE RELEASE — RIGHT-ALIGNED on the lift x, and that alignment is what makes §5.2 true as
    // DRAWN rather than merely as computed: the lift x is often the bar's `noteEndX`, so a
    // left-aligned `✻` would put its ink straight through the barline Gould says it must stay
    // inside of.
    const up = new Element('PedalRenderer.up')
    up.setText(PEDAL_UP_GLYPH)
    up.setFontSize(PEDAL_GLYPH_SIZE)
    const upWidth = glyphWidth(up)

    // ⚠️ …but never so close that the two signs collide. Two floors, both in staff spaces: air after
    // the `Ped.`'s own ink ({@link PEDAL_SIGN_GAP}) and a least total width for the pair
    // ({@link PEDAL_MIN_SPAN}) — the one place this drawing knowingly overruns the lift x, and only
    // where obeying it exactly would print one smudge.
    //
    // ⭐⭐ **THE END SQUARE'S NUDGE GOES *INSIDE* THOSE FLOORS — the OCTAVE BRACKET'S OWN MECHANISM**
    // (`OttavaRenderer`: `Math.max(piece.x1 + nudge.endX, lineStart + OTTAVA_MIN_LINE)`), and his
    // observation that found it, 2026-08-21: *"the hook of the ottava never crosses the 8, so there
    // must be a prevention mechanism that should be applied to the pedal"*.
    //
    // 🚨 It was OUTSIDE for a day — *"a hand that asks for less air than that has said so
    // deliberately"* — and that is the whole of how a `✻` reached an `endX` of **−67 staff-spaces**,
    // printing far to the LEFT of its own `Ped.` An add after the floor escapes every floor.
    //
    // ⭐⭐ **A FLOOR IS THE RIGHT SHAPE OF PREVENTION, AND A REFUSED WRITE IS THE WRONG ONE.** The
    // write-time rule that briefly replaced this ({@link MusicEngine.pedalEndpointStepAllowed})
    // stopped the crossing and broke the GESTURE: a refused ink step makes every press hand the
    // anchor a whole stop along, so the walk went from 1 space per press to 24. Drawn floors refuse
    // nothing, so the walk never changes gear — which is why the bracket has never shown either
    // fault. ⭐ And because the first floor is measured from `signX`, a press nudged rightward pushes
    // the `✻` ahead of it for free: the pair can close up, and can never overlap.
    // ⚠️ `releaseWrapped` ⇒ the nudge is already in `piece.x1` (`./pedalReleaseWrap` answers in ink,
    // and its header carries the report that made that the rule). The FLOORS still apply, measured
    // from the resumed `(Ped.)` on the new line.
    const upX = Math.max(
      piece.x1 - upWidth + (releaseWrapped ? 0 : px(nudge?.endX ?? 0)),
      signX + downWidth + px(PEDAL_SIGN_GAP),
      signX + px(PEDAL_MIN_SPAN) - upWidth,
    )
    up.renderText(ctx, upX, y)
    registerGlyph(pass, pedal.id, from, upX, y, upWidth, px, 'up')
  }
}

/**
 * The `Ped.` sign — parenthesised when this fragment is a resumption. @returns the total width drawn.
 *
 * ⚠️ Each glyph is placed from the MEASURED width of the one before it, never from a guessed advance:
 * the parens and the sign are three glyphs of three widths, and a fixed step would leave a gap in one
 * font and an overlap in another. In jsdom every width is 0, so all three land at the same x and the
 * total is 0 — which is why the parenthesis assertion lives in the browser suite.
 *
 * ⭐ Unlike the ottava's, all three are MUSIC glyphs on one baseline: SMuFL ships parens drawn for
 * this job (U+E676/E677), so there is no second font and no raise to tune — see {@link
 * PEDAL_PAREN_LEFT} for the trade, and for the ottava's warning that his eye may still move this to
 * italic text.
 *
 * ⚠️ Exported for ONE caller outside this pass: the cursor ghost (`./PedalGhost`), which draws the
 * plain sign at the pointer. It goes through this rather than through {@link PEDAL_DOWN_GLYPH} so
 * the preview and the engraved mark are the same glyph at the same size by construction — the same
 * arrangement `TrillRenderer.drawTrillSign` and `OttavaRenderer.drawOttavaNumeral` make.
 */
export function drawPedalSign(
  ctx: RenderPass['context'],
  x: number,
  y: number,
  parenthesised: boolean,
): number {
  const glyph = (text: string, at: number): number => {
    const el = new Element('PedalRenderer.sign')
    el.setText(text)
    el.setFontSize(PEDAL_GLYPH_SIZE)
    el.renderText(ctx, at, y)
    return glyphWidth(el)
  }
  if (!parenthesised) return glyph(PEDAL_DOWN_GLYPH, x)

  let width = glyph(PEDAL_PAREN_LEFT, x)
  width += glyph(PEDAL_DOWN_GLYPH, x + width)
  width += glyph(PEDAL_PAREN_RIGHT, x + width)
  return width
}

/**
 * ⭐ ONE REGISTRY ENTRY PER DRAWN GLYPH, all carrying the pedal's id — so `Ped.` and `✻` are each
 * clickable and a hit on either resolves to the whole pedal.
 *
 * ⚠️ **Per GLYPH, not per fragment**, which is where this family parts from the trill's and the
 * ottava's: there is no ink at all between the two signs, and a box spanning both would claim every
 * press over the music between them (§6.2 — *a press may only reach INK*).
 *
 * ⭐ …and because the grain is the glyph, each box says WHICH SIGN it is: the endpoint squares of a
 * selected pedal are beyond two different MARKS rather than at two ends of one fragment, so
 * `interactions/elements/pedalHandles` reads {@link ElementInfo.pedalSign} instead of counting
 * entries. ⚠️ A `(Ped.)` resumption is a `'down'` like the press it restates — it is the same sign,
 * and what makes it not the beginning is that an earlier one exists.
 */
function registerGlyph(
  pass: RenderPass,
  id: string,
  from: PedalPlacement,
  x: number,
  baselineY: number,
  width: number,
  px: (spaces: number) => number,
  sign: 'down' | 'up',
  /** The attachment guide, on the `Ped.` of the FIRST fragment only — the lift and every resumed
   *  sign register without one, and the drawer reads every entry under the id. */
  guides?: GuideLine[],
): void {
  const top = baselineY - px(PEDAL_MARK_INK.above)
  const bottom = baselineY + px(PEDAL_MARK_INK.below)
  pass.elementRegistry.add({
    type: 'pedal',
    id,
    pedalSign: sign,
    staff: from.staffIndex,
    measure: from.measureNumber,
    bbox: { x, y: top, width, height: bottom - top },
    points: [
      { x, y: top },
      { x: x + width, y: top },
      { x: x + width, y: bottom },
      { x, y: bottom },
    ],
    ...(guides ? { guides } : {}),
  })
}
