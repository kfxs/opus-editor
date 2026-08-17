/**
 * ⭐⭐ **OCTAVE LINES — the numeral and its dashed bracket, drawn.** P3 of docs/ottava-plan.md.
 *
 * A score-level pass after the measures, exactly like `renderSlurs` / `renderHairpins` /
 * `renderTrills` and for the same reason: an ottava spans bars, so it cannot be drawn inside any one
 * bar's group. `./TrillRenderer` is the template and most of this file is its shape.
 *
 * ## The four things that are genuinely different, and each is a rule rather than a preference
 *
 * ⭐⭐ **1. It READS the ladder as well as writing to it.** The trill is the innermost outside-staff
 * family and never asks what is above it. The ottava sits outside the dynamics line and the trill
 * (LilyPond's `outside-staff-priority` 400 against 250 and 50; Gould: octave lines go *outside all
 * other notations*), so it merges `layout/outsideStaffBand`'s claims with the music's own ink —
 * exactly as `./tempoLinePass` does — and then files its own claim, because tempo is outside IT.
 * ⛔ The rung is the PASS ORDER, not a number: move this call and you change the ladder.
 *
 * ⭐⭐ **2. The line stops at the LAST NOTEHEAD — not at the end of that note's duration.** Gould is
 * explicit, and calls the other reading incorrect: continuing an octave sign for the value of a long
 * note is found in some editions and is wrong (§1 rule 2, with the one exception being a trill).
 * ⚠️ **This is the OPPOSITE of our trill's and hairpin's x rule** ("read to the slot's end"), so the
 * end here is a notehead's RIGHT edge rather than the next slot's left one. Copying the neighbour
 * would be wrong by the book, which is why {@link spanX} says so at the site.
 *
 * ⭐ **3. It has no VOICE.** An ottava governs the whole staff, so its x runs from the earliest
 * notehead in the span on that staff to the latest, whatever voices they are in — the one span in
 * this codebase whose lane is a staff rather than a `(staff, voice)`.
 *
 * ⭐ **4. Its SIDE is derived, never stored.** `shift > 0` → above. §1 rule 4, and it must be derived:
 * the side is half of what tells a reader the direction, so a stored side could contradict the
 * stored shift.
 *
 * ⛔ **Not VexFlow's `TextBracket`.** It is the right SHAPE — start/stop notes, dashed line,
 * `showBracket`, a `position` — and four of the five reasons it loses are the ones that killed
 * `VibratoBracket` for the trill: y from `getYForTopText` (a fixed rung, blind to the ledger lines an
 * 8va guarantees), both ends on ONE stave so no system break and no repeated `(8)`, no SMuFL (it sets
 * `text` + a 0.714× superscript in the ordinary font stack), and a hook tied to that fixed rung.
 * ✅ The one thing it gets right is ending at `stop.getAbsoluteX() + stop.getGlyphWidth()` — the last
 * notehead — which is rule 2 for free, and is the rule we take from it.
 *
 * ## The two coordinate spaces, because mixing them is the recurring bug here
 *
 * Everything drawn runs inside `inStaffSpace`, i.e. the staff's own `scale(k)` group: note and stave
 * coordinates are in it already. A SYSTEM EDGE is not — `measureBounds` says where a bar landed in
 * the SVG — so it is divided by the scale on the way in, the same conversion `planSlurSegments`
 * makes. `TrillRenderer`'s note, and it applies here verbatim.
 */
import type { Stave } from 'vexflow'
import { Element } from 'vexflow'
import type { Score, Ottava, Measure, Fraction } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { ottavaSpan, type OttavaSpan } from '@/engine/models/ottavaOps'
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand, type InkBand } from '@/engine/layout/inkBand'
import { bandOver, markBand, measureStartOffsets, type OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracAdd, fracCompare } from '@/utils/fraction'
import { planSlurSegments } from './SlurRenderer'
import { inStaffSpace } from './staffScaleGroup'
import { staffSpacesToPixels } from './staffSpace'
import { THIN_LINE_SPACES } from './thinLineWeight'
import {
  OTTAVA_CONTINUATION_INSET, OTTAVA_DASH_GAP, OTTAVA_DASH_LENGTH, OTTAVA_END_AIR, OTTAVA_GLYPH_SIZE,
  OTTAVA_HOOK, OTTAVA_LINE,
  OTTAVA_LINE_RAISE_ABOVE, OTTAVA_LINE_RAISE_BELOW, OTTAVA_MARK_INK, OTTAVA_MIN_LINE, OTTAVA_NUMERAL_GAP, OTTAVA_NUMERAL_GLYPHS,
  OTTAVA_PAREN_FONT, OTTAVA_PAREN_LEFT, OTTAVA_PAREN_RAISE, OTTAVA_PAREN_RIGHT, OTTAVA_PAREN_SCALE,
} from './ottavaStyle'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement`, declared structurally so the renderer that calls this
 * is not imported back by it — the shape `TrillRenderer` and `HairpinRenderer` already use.
 */
export interface OttavaPlacement {
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

/** One drawn piece of an octave line: an x range, WHICH SYSTEM, and the two things a fragment has to
 *  know about itself — whether it is a resumption and whether it carries the span's true end. */
interface OttavaPiece {
  x0: number
  x1: number
  line: number
  /** ⭐ Did the line begin on an EARLIER system? Its numeral is parenthesised — the documented
   *  convention, and SMuFL ships the glyphs for it (§1 rule 6). */
  continuation: boolean
  /** ⭐ Does this fragment carry the span's real END? Only that one gets the closing hook —
   *  §1 rule 3, *never a dangling hook*. */
  final: boolean
}

const ZERO: Fraction = { num: 0, den: 1 }

/**
 * The slots of ONE bar that the ottava covers, in beat order — **every voice**, because an ottava
 * governs the staff (§4: it is the one span in our model that carries no voice).
 *
 * The slice is the trill's `barSlice` question with the ottava's own half-open answer: from the start
 * beat in the first bar, from 0 thereafter; up to (but not including) the end beat in the last bar.
 */
function coveredSlots(p: OttavaPlacement, span: OttavaSpan): Measure['slots'] {
  const from = p.measureNumber === span.startMeasure ? span.startBeat : ZERO
  const to = p.measureNumber === span.endMeasure ? span.endBeat : measureCapacityFrac(p.view)
  return p.view.slots
    .filter(s => fracCompare(s.beat, from) >= 0 && fracCompare(s.beat, to) < 0)
    .sort((a, b) => fracCompare(a.beat, b.beat))
}

/** The id `staveNoteMap` is keyed by for a slot — the first PITCH id for a chord, the slot id for a
 *  rest. `TrillRenderer`'s convention, and it must match or nothing resolves. */
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
 * A rendered notehead's RIGHT edge — ⭐ **the quantity Gould's rule 2 is stated in**, and the reason
 * this function exists next to {@link noteLeftX} rather than being folded into it.
 *
 * `getNoteHeadEndX` is exactly the far side of the head. The fallback is `getTieRightX`, which is the
 * same point for our purposes but named for a different question (it is where a tie would leave the
 * note), kept only so a VexFlow build without the newer method still draws something sane.
 */
function noteRightX(pass: RenderPass, noteId: string | undefined): number | undefined {
  if (!noteId) return undefined
  const note = pass.staveNoteMap.get(noteId)?.staveNote
  if (!note) return undefined
  const end = (note as unknown as { getNoteHeadEndX?: () => number }).getNoteHeadEndX
  return end ? end.call(note) : note.getTieRightX()
}

/**
 * ⭐ **WHERE THE BRACKET STARTS AND STOPS, in x.**
 *
 * Start: the left edge of the FIRST notehead the span covers. End: the right edge of the LAST one.
 *
 * ⭐⭐ **The end is a notehead's RIGHT EDGE, and that is the whole of §1 rule 2.** Gould: continuing
 * an octave sign for the value of a long note is *incorrect*. So an 8va over a single whole note is
 * one notehead wide plus its numeral — it does NOT run to the barline, which is what the hairpin and
 * the trill next door both do. ⚠️ Do not "fix" this by copying `TrillRenderer.spanX`.
 *
 * ⚠️ **The last notehead is searched BACKWARDS through the covered bars, not read off the end bar.**
 * The span's last bar may hold nothing but rests (or nothing at all) inside the slice, and the line
 * still has to stop at the last note that IS under it.
 *
 * ⛔ **Not `CoordinateMapper.beatToPixelX`**, which interpolates a bar's width linearly and has
 * nothing to do with where the spacing solve actually put the columns.
 */
function spanX(
  pass: RenderPass,
  span: OttavaSpan,
  covered: readonly OttavaPlacement[],
): { startX: number; endX: number } | null {
  let startX: number | undefined
  for (const p of covered) {
    for (const slot of coveredSlots(p, span)) {
      startX = noteLeftX(pass, drawnIdOf(slot))
      if (startX !== undefined) break
    }
    if (startX !== undefined) break
  }
  if (startX === undefined) return null

  let endX: number | undefined
  for (let i = covered.length - 1; i >= 0 && endX === undefined; i--) {
    const slots = coveredSlots(covered[i], span)
    for (let k = slots.length - 1; k >= 0; k--) {
      endX = noteRightX(pass, drawnIdOf(slots[k]))
      if (endX !== undefined) break
    }
  }
  if (endX === undefined) return null

  // ⚠️ No `endX <= startX` guard, for `TrillRenderer.spanX`'s reason: across a system break the two
  // x's live in different systems' coordinates and comparing them says nothing. A degenerate
  // SAME-SYSTEM span is dropped by {@link cutIntoPieces}, which is the only place both x's are known
  // to be on one row.
  return { startX, endX }
}

/**
 * ⭐⭐ **THE OTTAVA'S OWN Y — and this is the consumer half of the ladder.**
 *
 * Two bands merged: the MUSIC's ink over the bars of THIS FRAGMENT (`layout/inkBand`), and everything
 * the families placed before it have already claimed there (`layout/outsideStaffBand` — the dynamics
 * line and the trill, filed as they were placed). ⭐ That merge IS the ladder; there is no priority
 * table, and the order is the order the passes run in.
 *
 * ⚠️ **Per FRAGMENT, not per span** — the trill's rule, for its reason: a low note on the second
 * system must not push the first system's numeral up for no visible reason.
 */
function baselineFor(
  pass: RenderPass,
  here: readonly OttavaPlacement[],
  span: OttavaSpan,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  side: 'above' | 'below',
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
      pass.occupiedBands, line, staffId, side,
      fracAdd(base, from), fracAdd(base, to), firstStaffId))
  }
  return clearanceBaseline(mergeInkBands(music, taken), side, OTTAVA_MARK_INK, OTTAVA_LINE)
}

/**
 * ⭐ The slice of ONE bar the ottava covers, in that bar's own beats — the first bar from the start
 * beat, the last bar to the end beat, everything between it whole.
 *
 * Shared by {@link baselineFor} (what ink is in there) and {@link ottavaFragmentClaim} (what beats
 * the fragment took), so what the line CLEARED and what it CLAIMS cannot drift apart. `TrillRenderer`
 * makes the same pairing for the same reason.
 */
function barSlice(p: Pick<OttavaPlacement, 'view' | 'measureNumber'>, span: OttavaSpan): { from: Fraction; to: Fraction } {
  return {
    from: p.measureNumber === span.startMeasure ? span.startBeat : ZERO,
    to: p.measureNumber === span.endMeasure ? span.endBeat : measureCapacityFrac(p.view),
  }
}

/**
 * ⭐ **What one fragment took**, on the ladder's absolute-beat axis — `null` when the fragment covers
 * no bar this render drew.
 *
 * Written so TEMPO can clear it: the ottava reads the two families inside it and is itself read by
 * the one outside it, which is the whole of being a middle rung.
 *
 * Pure, and exported for its spec: the beats are the part of this that can be wrong, and they are
 * arithmetic rather than geometry — so they belong in a unit test rather than in the browser suite
 * with the drawing. (`trillFragmentClaim`'s arrangement.)
 */
export function ottavaFragmentClaim(
  here: readonly Pick<OttavaPlacement, 'view' | 'measureNumber'>[],
  span: OttavaSpan,
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
    from: fracAdd(firstStart, barSlice(first, span).from),
    to: fracAdd(lastStart, barSlice(last, span).to),
    band: markBand(baseline, OTTAVA_MARK_INK),
  }
}

/**
 * Cut the bracket into the pieces the systems make. `planSlurSegments` is reused verbatim — its name
 * is the only thing about it that says "slur": it answers *given two system numbers and two x's, what
 * pieces does this span break into*, which is a fact about systems.
 */
function cutIntoPieces(
  pass: RenderPass,
  fromLine: number,
  toLine: number,
  startX: number,
  endX: number,
  scale: number,
): OttavaPiece[] {
  const pieces: OttavaPiece[] = []
  for (const seg of planSlurSegments(pass, fromLine, toLine, startX, endX, scale)) {
    const range = seg.type === 'single' ? { x0: startX, x1: endX, line: fromLine }
      : seg.type === 'begin' ? { x0: seg.firstX, x1: seg.rightX, line: fromLine }
        : seg.type === 'middle' ? { x0: seg.leftX, x1: seg.rightX, line: seg.line }
          : { x0: seg.leftX, x1: seg.lastX, line: toLine }
    if (range.x1 <= range.x0) continue
    pieces.push({
      ...range,
      // `single` and `begin` carry the line's real start; `middle` and `end` are resumptions.
      continuation: seg.type === 'middle' || seg.type === 'end',
      // ⭐ …and `single` and `end` carry its real END, which is the only place a hook may go.
      final: seg.type === 'single' || seg.type === 'end',
    })
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

/** Draw every octave line in the score, above (8va) or below (8vb) the music it governs, split at
 *  system breaks. */
export function renderOttavas(
  pass: RenderPass,
  score: Score,
  placements: readonly OttavaPlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  // The ladder's shared horizontal axis, walked once for the render rather than per ottava.
  const starts = measureStartOffsets(score)

  for (const measure of score.measures) {
    for (const ottava of measure.ottavas ?? []) {
      const span = ottavaSpan(score, ottava.id)
      if (!span) continue

      const staffIndex = staffIds.findIndex(id => (id ?? staffIds[0]) === (ottava.staffId ?? staffIds[0]))
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

      const x = spanX(pass, span, covered)
      if (!x) continue

      try {
        // ⚠️ `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-ottava' here
        // would yield `class="vf-vf-ottava"`, the mistake the slur's comment records.
        const group = pass.context.openGroup?.('ottava', `ottava-${ottava.id}`) as SVGGElement | undefined
        inStaffSpace(pass, staffIndex, group, () => {
          drawOttava(pass, ottava, span, x, covered, from, to, staffIds[staffIndex], staffIds[0], starts)
        })
        pass.context.closeGroup?.()
        if (group) pass.ottavaGroupMap.set(ottava.id, group)
      } catch (e) {
        console.error('Could not render ottava:', e)
      }
    }
  }
}

/** The drawing itself, once the span and the two x's are known. */
function drawOttava(
  pass: RenderPass,
  ottava: Ottava,
  span: OttavaSpan,
  x: { startX: number; endX: number },
  covered: readonly OttavaPlacement[],
  from: OttavaPlacement,
  to: OttavaPlacement,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  starts: Map<number, Fraction>,
): void {
  // ⭐ DERIVED, never stored (§1 rule 4 / §4): up → above the staff, down → below.
  const side: 'above' | 'below' = ottava.shift > 0 ? 'above' : 'below'
  const ctx = pass.context

  // ⭐ AIR AFTER THE LAST NOTE — his call; see {@link OTTAVA_END_AIR}. ⚠️ Added to the SPAN's end
  // BEFORE cutting into pieces, which is what keeps it off a system break: a fragment that ends at
  // the margin is created by the cut, so it never sees this.
  const endX = x.endX + staffSpacesToPixels(OTTAVA_END_AIR, from.stave)

  let firstPiece = true
  for (const piece of cutIntoPieces(pass, from.line, to.line, x.startX, endX, from.scale)) {
    // ⭐ THIS FRAGMENT'S OWN SYSTEM — its stave, its own bands, its staff-space size.
    const here = covered.filter(p => p.line === piece.line)
    const stave = here[0]?.stave ?? from.stave
    const px = (spaces: number) => staffSpacesToPixels(spaces, stave)
    const baseline = baselineFor(
      pass, here.length ? here : covered, span, staffId, firstStaffId, side, piece.line, starts)
    const y = stave.getYForLine(0) + px(baseline)

    // ⭐ THE LADDER CLAIM — so the tempo mark, which is placed after every family, clears this
    //   bracket. ⚠️ Per FRAGMENT, in that fragment's own beats.
    const claim = ottavaFragmentClaim(
      here.length ? here : covered, span, piece.line, staffId, side, baseline, starts)
    if (claim) pass.occupiedBands.push(claim)

    // ⭐ EVERY FRAGMENT DRAWS ITS NUMERAL, parenthesised when it is a resumption (§1 rule 6) — the
    // reader arriving on a new system has to be told the passage is still displaced, and the
    // brackets say it did not start here.
    //
    // ⭐ A RESUMED numeral starts LEFT of where the music does (his call; see
    // {@link OTTAVA_CONTINUATION_INSET}): `planSlurSegments`' left edge is `noteStartX`, which put
    // the `(8va)` on top of the first notehead. ⚠️ Clamped at the bar's own left edge so it can
    // never reach back past the stave and collide with the clef.
    const barLeft = here[0] ? pass.measureBounds.get(here[0].measureNumber)?.measureX : undefined
    const inset = piece.continuation ? px(OTTAVA_CONTINUATION_INSET) : 0
    const startX = barLeft === undefined
      ? piece.x0 - inset
      : Math.max(piece.x0 - inset, barLeft / (here[0]?.scale ?? 1))

    const numeralWidth = drawOttavaNumeral(ctx, startX, y, ottava.shift, piece.continuation)

    // The dashed line runs from after the numeral to the fragment's end, at the numeral's mid-height.
    //
    // ⚠️⚠️ **Never MIRRORED — but per SIDE, and the difference took two of his reports to find.** A
    // glyph grows the same way from its baseline on either side of the staff (`markBand` states it),
    // so `baseline + raise` under the staff put the 8vb's line beneath its own numeral. What the
    // sides genuinely differ in is WHERE THE BRACKET ATTACHES: it closes toward the staff, so an
    // 8va's hook turns down and its horizontal runs along the numeral's TOP, while an 8vb's hook
    // turns up and its horizontal runs along the numeral's FOOT. See {@link OTTAVA_LINE_RAISE_ABOVE}.
    const lineY = y - px(side === 'above' ? OTTAVA_LINE_RAISE_ABOVE : OTTAVA_LINE_RAISE_BELOW)
    const lineStart = startX + numeralWidth + px(OTTAVA_NUMERAL_GAP)
    // ⭐ A fragment carrying the span's END is never shorter than {@link OTTAVA_MIN_LINE} past its
    // numeral, so the bracket can always CLOSE — see that constant for the case that forces it (a
    // `(8)` wider than the single notehead it covers) and for why this is the one place the drawing
    // knowingly overruns Gould's rule 2. A non-final fragment runs to the margin and needs nothing.
    const lineEnd = piece.final ? Math.max(piece.x1, lineStart + px(OTTAVA_MIN_LINE)) : piece.x1
    const hasLine = lineEnd > lineStart
    if (hasLine) drawDashes(ctx, lineStart, lineEnd, lineY, px)

    // ⭐⭐ §1 rule 3 — NEVER A DANGLING HOOK. Only the fragment carrying the span's true end may
    // close, and only if it actually drew a horizontal to close: a hook alone would tell the reader
    // the line stopped there, which at a system break is exactly the wrong thing to say.
    if (piece.final && hasLine) {
      ctx.setLineWidth(px(THIN_LINE_SPACES))
      ctx.beginPath()
      ctx.moveTo(lineEnd, lineY)
      // Turns TOWARD the staff — down under an 8va, up over an 8vb.
      ctx.lineTo(lineEnd, side === 'above' ? lineY + px(OTTAVA_HOOK) : lineY - px(OTTAVA_HOOK))
      ctx.stroke()
    }

    // ⭐ ONE REGISTRY ENTRY PER FRAGMENT, all carrying the ottava's id — so either half of a split
    // bracket is clickable and a hit resolves to the whole line (`TrillRenderer`'s arrangement).
    const top = Math.min(y - px(OTTAVA_MARK_INK.above), lineY)
    const bottom = Math.max(y + px(OTTAVA_MARK_INK.below), lineY)
    const right = Math.max(lineEnd, startX + numeralWidth)
    pass.elementRegistry.add({
      type: 'ottava',
      id: ottava.id,
      staff: from.staffIndex,
      measure: from.measureNumber,
      bbox: { x: startX, y: top, width: right - startX, height: bottom - top },
      points: [
        { x: startX, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: startX, y: bottom },
      ],
      // ⭐ THE BRACKET'S AXIS on this system, for the two endpoint handles a SELECTED ottava draws
      // (`interactions/elements/ottavaHandles`). ⚠️ Measured here rather than derived from the band
      // above, because `lineY` is NOT the band's middle: it rides the numeral's top under an 8va and
      // its foot under an 8vb — see {@link ElementInfo.ottavaAxis}.
      // ⭐ `startX` is the NUMERAL's left edge (the bracket's beginning as the reader sees it), not
      // `lineStart`, which is the dashed line's — the handle belongs beside the whole mark.
      ottavaAxis: { y: lineY, startX, endX: right },
      // ⭐⭐ THE ATTACHMENT GUIDE — the fifth kind (docs/dynamic-offset-plan.md).
      //
      // ⭐ **Its far end is a PLACE, not a note**, which puts the octave line with the hairpin and
      // the tempo mark: it governs a REGION — every voice, every note in it, including notes typed
      // into it later (§4's "clef-shaped statement") — so there is no one note it belongs to. ⛔ The
      // trill's rule is the other one, and for its own reason: an ornament's auxiliary is computed
      // from its note's pitch.
      //
      // ⭐ **And the SIDE follows the shift**, as everything else about this bracket does: an 8va
      // hangs above the staff, so the guide runs down to the TOP line; an 8vb runs up to the BOTTOM
      // one. The numeral's end is its ink corner facing that same line, so the guide never crosses
      // the glyph it leaves.
      //
      // ⚠️ Beginning only, first fragment only — his rule for the hairpin, and the same reasons: a
      // bracket's extent is already visible as ink, and a continuation `(8va)` is a reminder rather
      // than a second attachment.
      ...(firstPiece
        ? {
          guides: [{
            from: {
              x: startX,
              y: side === 'above' ? y + px(OTTAVA_MARK_INK.below) : y - px(OTTAVA_MARK_INK.above),
            },
            to: { x: x.startX, y: stave.getYForLine(side === 'above' ? 0 : 4) },
          }],
        }
        : {}),
    })
    firstPiece = false
  }
}

/**
 * The numeral — parenthesised when this fragment is a resumption. @returns the total width drawn.
 *
 * ⚠️ Each glyph is placed from the MEASURED width of the one before it, never from a guessed advance:
 * the parens and the numeral are three glyphs of three widths, and a fixed step would leave a gap in
 * one font and an overlap in another. In jsdom every width is 0, so all three land at the same x and
 * the total is 0 — which is why the parenthesis assertion lives in the browser suite.
 *
 * ⚠️ **Two fonts, since his italic call**: the numeral is a MUSIC glyph and the parens are TEXT in a
 * family that owns a true italic (see {@link OTTAVA_PAREN_LEFT} for why they cannot be the SMuFL
 * ones), raised off the numeral's baseline because a text paren descends and `8va` does not. This is
 * `TrillRenderer.drawSign`'s apparatus, arrived at from the same requirement.
 *
 * ⚠️ Exported for ONE caller outside this pass: the cursor ghost (`./OttavaGhost`), which draws the
 * plain numeral at the pointer. It goes through this rather than through {@link OTTAVA_NUMERAL_GLYPHS}
 * so the preview and the engraved mark are the same glyph at the same size by construction — exactly
 * why `TrillRenderer.drawTrillSign` is exported beside it.
 */
export function drawOttavaNumeral(
  ctx: RenderPass['context'],
  x: number,
  y: number,
  /** ⭐ The SIGNED shift, because `8va` and `8ba` are different glyphs — see
   *  {@link OTTAVA_NUMERAL_GLYPHS}, and his call that made it so. */
  shift: Ottava['shift'],
  parenthesised: boolean,
): number {
  const glyph = (text: string, at: number): number => {
    const el = new Element('OttavaRenderer.numeral')
    el.setText(text)
    el.setFontSize(OTTAVA_GLYPH_SIZE)
    el.renderText(ctx, at, y)
    return glyphWidth(el)
  }
  const numeral = OTTAVA_NUMERAL_GLYPHS[shift]
  if (!parenthesised) return glyph(numeral, x)

  const size = OTTAVA_GLYPH_SIZE * OTTAVA_PAREN_SCALE
  const parenY = y - size * OTTAVA_PAREN_RAISE
  const paren = (text: string, at: number): number => {
    const el = new Element('OttavaRenderer.paren')
    el.setFont(OTTAVA_PAREN_FONT, size, 'normal', 'italic')
    el.setText(text)
    el.renderText(ctx, at, parenY)
    return glyphWidth(el)
  }

  let width = paren(OTTAVA_PAREN_LEFT, x)
  width += glyph(numeral, x + width)
  width += paren(OTTAVA_PAREN_RIGHT, x + width)
  return width
}

/**
 * ⭐ **THE DASHED LINE.**
 *
 * ⚠️⚠️ **The dash pattern is RESET to solid afterwards, and that line is load-bearing.** The context
 * is shared by every later pass, and `save`/`restore` are NO-OPS in our Gutter context
 * (`reference_vexflow_context_save_restore_are_noops`) — so leaving the pattern set would dash
 * whatever draws next, on the systems that happen to hold an ottava only.
 */
function drawDashes(
  ctx: RenderPass['context'],
  startX: number,
  endX: number,
  y: number,
  px: (spaces: number) => number,
): void {
  ctx.setLineWidth(px(THIN_LINE_SPACES))
  ctx.setLineDash([px(OTTAVA_DASH_LENGTH), px(OTTAVA_DASH_GAP)])
  ctx.beginPath()
  ctx.moveTo(startX, y)
  ctx.lineTo(endX, y)
  ctx.stroke()
  ctx.setLineDash([])
}
