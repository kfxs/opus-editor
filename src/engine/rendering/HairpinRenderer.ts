/**
 * ⭐⭐ **HAIRPINS — the crescendo / diminuendo wedges, drawn.** P3 of
 * docs/dynamics-line-and-hairpins-plan.md.
 *
 * A score-level pass after the measures, exactly like `renderSlurs` and for the same reason: a
 * wedge spans bars, so it cannot be drawn inside any one bar's group. It runs AFTER
 * `placeDynamicsOnLine`, because it asks the same module for the same line — a hairpin is a member
 * of the dynamics family, not a line of its own — and because it reads where the letters landed in
 * order to stop short of them.
 *
 * ## What it does NOT decide
 *
 * ⛔ **Not the line.** `engine/layout/dynamicsLine.ts` owns that, and this hands it the columns the
 * wedge SPANS rather than the one column a lone mark stands over — the wider slice that module's
 * own note promised. Two answers to "how far below the staff" is the thing the whole plan exists to
 * prevent.
 *
 * ⛔ **Not the mouth, the slant, or the stroke.** The mouth and slant come from
 * `./hairpinShape`'s resolver, so the day either becomes a user control it is a compartment client
 * and nothing here is rewritten (plan §6). The stroke is `./thinLineWeight`'s shared 0.16 — the
 * same weight as the thin barline, the ledger line and the tuplet bracket, because they are one
 * family and a page reads as one hand. ⚠️ A lighter hairpin was tried and rejected by eye on
 * 2026-08-15 against all four reference engines; that module records it, so it is not retried.
 *
 * ⛔ **Not VexFlow's `StaveHairpin`.** Rejected in §2.1: a fixed 20 px below the staff (so a small
 * staff breaks it), a fixed 10 px mouth, x from `getModifierStartXY` (which throws pre-draw), both
 * ends on ONE stave (so no system break) and no idea what else is on the line. What we would
 * inherit is three `lineTo`s.
 *
 * ## The two coordinate spaces, because mixing them is the recurring bug here
 *
 * Everything drawn runs inside `inStaffSpace`, i.e. the staff's own `scale(k)` group: note
 * coordinates, stave coordinates and the dynamics' drawn boxes are all in it already. A SYSTEM
 * EDGE is not — `measureBounds` says where a bar landed in the SVG — so it is divided by the scale
 * on the way in, which is the same conversion `planSlurSegments` makes and for the same reason
 * (a cross-system slur on a small staff used to stop 30% short of the margin).
 */
import type { Stave } from 'vexflow'
import type { Score, Measure, Hairpin, Fraction, HairpinEndpointOffsetOverride } from '@/types/music'
import type { Column } from '@/engine/layout/spacing'
import { hairpinSpan, type HairpinSpan } from '@/engine/models/hairpinOps'
import { hairpinEndpointOffsetOverrideOf, hairpinApertureOverrideOf } from '@/engine/models/engravingOverrides'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fracCompare, fracEq, fracGte } from '@/utils/fraction'
import { hairpinLineKey, type DynamicsLinePlan } from './dynamicsLinePlan'
import { voiceOf } from '@/utils/lanes'
import { MARK_INK } from './dynamicsLinePass'
import { dynamicMarkTranslate } from './dynamicMarkTransform'
import { HAIRPIN, fragmentOpening, resolveHairpinShape, type WedgeRole } from './hairpinShape'
import { breakWedgeAtGaps, rampAt, type WedgeGap } from './hairpinBreaks'
import { THIN_LINE_SPACES } from './thinLineWeight'
import { planSlurSegments } from './SlurRenderer'
import { inStaffSpace } from './staffScaleGroup'
import { staffSpacesToPixels } from './staffSpace'
import type { RenderPass } from './RenderPass'

/**
 * What the pass needs of a `MeasurePlacement`, declared structurally so the renderer that calls
 * this is not imported back by it (the shape `dynamicsLinePass` already uses, plus the number).
 */
export interface HairpinPlacement {
  /** This staff's own lane — so `view.hairpins` is already the staff's. */
  view: Measure
  measureNumber: number
  staffIndex: number
  line: number
  /** The measure's merged columns, shared by every staff of it. */
  system: { columns: Column[] }
  stave: Stave
  scale: number
}

/**
 * ⭐ The wedge's vertical CENTRE, given the shared text baseline.
 *
 * The line is a text baseline (§3), and a wedge has no baseline — it has an axis. Gould puts the
 * mouth on the letters' OPTICAL CENTRE, so a `p` and the wedge beside it look level rather than
 * merely sharing a number. That centre is the midpoint of a glyph's own ink, which we already state
 * either side of the baseline: `above` up, `below` down.
 *
 * ⛔ Not a new constant, and deliberately: any number invented here would be a second opinion about
 * how big a dynamic is, which is exactly how the hit-box and the line would drift apart.
 */
function axisOffsetSpaces(): number {
  // A mark's ink runs from `baseline − above` to `baseline + below`, so its middle is half the
  // difference — negative for a dynamic glyph, which sits mostly above its baseline.
  return (MARK_INK.below - MARK_INK.above) / 2
}

/** The slot a (voice, beat) address resolves to, by the fall-forward rule `attachDynamicsToSlots`
 *  uses — exactly at the beat, else the next slot in that voice. Undefined past the last one. */
function slotIdAt(view: Measure, voice: number, beat: Fraction): string | undefined {
  const lane = view.slots.filter(s => voiceOf(s) === voice).sort((a, b) => fracCompare(a.beat, b.beat))
  const hit = lane.find(s => fracEq(s.beat, beat)) ?? lane.find(s => fracGte(s.beat, beat))
  if (!hit) return undefined
  // `staveNoteMap` is keyed by the PITCH id for a chord and by the slot id for a rest — the same
  // split `SlurRenderer.measureOfNoteId` walks.
  return hit.type === 'chord' ? hit.notes[0]?.id : hit.id
}

/** A rendered note's left edge, in its staff's own space, or undefined if that bar was not drawn. */
function noteLeftX(pass: RenderPass, noteId: string | undefined): number | undefined {
  if (!noteId) return undefined
  const note = pass.staveNoteMap.get(noteId)?.staveNote
  return note ? note.getTieLeftX() : undefined
}

/**
 * ⭐ **WHERE THE WEDGE STARTS AND STOPS, in x** — Gould p.104: from the left-hand edge of its first
 * note to the right-hand edge of its last.
 *
 * The END is the trap the plan names twice. It is the end of the last covered SLOT, which means the
 * x of the column AT the end beat — not the start of the last note, and not the next note after it.
 * A wedge over a whole note therefore spans the bar rather than the notehead, which is what
 * "an amount of music" has to look like. Past the bar's music it is the bar's own `noteEndX`.
 *
 * ⛔ **Not `CoordinateMapper.beatToPixelX`.** That divides the bar's usable width by its quarters —
 * a LINEAR interpolation with nothing to do with where the spacing solve actually put the columns,
 * so a wedge drawn from it would visibly disagree with the notes it spans.
 */
function spanX(
  pass: RenderPass,
  span: HairpinSpan,
  hairpin: Hairpin,
  from: HairpinPlacement,
  to: HairpinPlacement,
): { startX: number; endX: number } | null {
  const voice = voiceOf(hairpin)
  const startX = noteLeftX(pass, slotIdAt(from.view, voice, span.startBeat))
  if (startX === undefined) return null

  // The end: the column at the end beat if the music reaches that far, else the bar's end. Both are
  // brought into the staff's own space — `noteEndX` is where the bar landed in the SVG.
  const atEnd = fracCompare(span.endBeat, measureCapacityFrac(to.view)) < 0
    ? noteLeftX(pass, slotIdAt(to.view, voice, span.endBeat))
    : undefined
  const barEnd = pass.measureBounds.get(to.measureNumber)?.noteEndX
  const endX = atEnd ?? (barEnd === undefined ? undefined : barEnd / to.scale)
  if (endX === undefined) return null
  return { startX, endX }
}

/**
 * ⭐ **THE HORIZONTAL SKYLINE — a wedge stops short of a dynamic it runs into** (Gould: about a
 * space; LilyPond's `bound-padding`).
 *
 * Read off the letters as DRAWN, not from the model, because a dynamic deliberately has zero layout
 * width (`setWidth(0)`, so text never pushes notes apart) — its extent exists only in the SVG. That
 * also makes this a browser-only refinement: in jsdom every glyph measures 0×0, so the gap simply
 * does not appear and nothing pretends otherwise.
 *
 * ⚠️ **A mark being TEXT-EDITED is not drawn** (`suppressedDynamicId`), so it contributes nothing
 * here and the wedge grows by the width of one glyph while you type. That is §11.10, still open:
 * the recommended fix is the mark's LAST registered box, which needs the previous render's snapshot
 * threaded in. Recorded rather than papered over — the alternative shapes (freeze the end while an
 * edit is open, or map the overlay's own rect back through the inverse CTM) are both bigger than
 * this pass.
 */
function markInkX(pass: RenderPass, view: Measure, beat: Fraction): { left: number; right: number } | null {
  let left = Infinity
  let right = -Infinity
  for (const dyn of view.dynamics ?? []) {
    if (!fracEq(dyn.beat, beat)) continue
    const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGraphicsElement | undefined
    const text = el?.querySelector?.('text') as SVGTextElement | null
    const box = text?.getBBox ? text.getBBox() : null
    if (!box || box.width === 0) continue
    // 🚨🚨 **THROUGH THE MARK'S OWN TRANSLATE.** `getBBox()` measures the `<text>` before the
    // `translate` on its group, and a LEVEL carries a big one: it is pulled back half its own width
    // to straddle the notehead (`dynamicMarkAnchor`). Comparing that unmoved box against a wedge
    // drawn in the same local space put the clearance a half-glyph to the right of the letter —
    // his report, 2026-08-18: *"the white is not even, there is more white on the right side"*, and
    // *"with text it is not a problem, the problem is with the dynamic glyphs"* (prose is anchored
    // where it was drawn, so its translate is zero and nothing looked wrong).
    const moved = el ? dynamicMarkTranslate(el).x : 0
    left = Math.min(left, box.x + moved)
    right = Math.max(right, box.x + box.width + moved)
  }
  return Number.isFinite(left) ? { left, right } : null
}

/**
 * ⭐⭐ **THE SLICES A WEDGE IS BROKEN AT — every dynamic INSIDE its span** (Gould printed p. 107,
 * *"A hairpin may be broken for an interim dynamic"*; `./hairpinBreaks` carries the quotation and
 * the measurement).
 *
 * ⭐ **STRICTLY inside.** A mark ON either end is the endpoint skyline's business — it shortens the
 * wedge from that end rather than cutting a hole in it — and letting both rules see the same mark
 * would take the padding out twice.
 *
 * ⭐ **The wedge's OWN LANE.** A dynamic governs a voice ({@link Dynamic.voice}), so a mark in
 * another voice is not in this wedge's way; the staff is already settled, since `covered` is
 * filtered to the hairpin's own staff index.
 *
 * ⚠️ Each gap carries the SYSTEM it is on: a wedge cut across a break has fragments in different
 * systems' coordinates, and x's from two systems are not one ruler.
 *
 * ⚠️ Read off the letters as DRAWN, via {@link markInkX} — so this is browser-only in exactly the
 * way the endpoint skyline is, and in jsdom it returns nothing and the wedge draws whole.
 */
function interiorMarkGaps(
  pass: RenderPass,
  hairpin: Hairpin,
  span: HairpinSpan,
  covered: readonly HairpinPlacement[],
  pad: number,
): WedgeGap[] {
  const voice = voiceOf(hairpin)
  const after = (measure: number, beat: Fraction, m: number, b: Fraction) =>
    measure !== m ? measure > m : fracCompare(beat, b) > 0

  const gaps: WedgeGap[] = []
  for (const placement of covered) {
    const seen: Fraction[] = []
    for (const dyn of placement.view.dynamics ?? []) {
      if ((dyn.voice ?? 0) !== voice) continue
      if (!after(placement.measureNumber, dyn.beat, span.startMeasure, span.startBeat)) continue
      if (!after(span.endMeasure, span.endBeat, placement.measureNumber, dyn.beat)) continue
      // Co-located marks (`p dolce`) share a beat and merge into one box, so ask once per beat.
      if (seen.some(b => fracEq(b, dyn.beat))) continue
      seen.push(dyn.beat)
      const ink = markInkX(pass, placement.view, dyn.beat)
      if (ink) gaps.push({ line: placement.line, left: ink.left - pad, right: ink.right + pad })
    }
  }
  return gaps
}

/**
 * One drawn piece of a wedge: an x range, WHICH SYSTEM it is on, and which fragment of the whole it
 * is (the role that decides how far its mouth is open — {@link fragmentOpening}).
 *
 * ⚠️ `line` is here because everything vertical is a fact about the system, not about the wedge: its
 * stave, its own dynamics line, and the pixel size of a staff space. Drawing every fragment against
 * the START bar's stave puts the continuation on top of the first system, which is exactly what the
 * browser suite caught.
 *
 * ⚠️ And no APERTURE here, deliberately: the mouth is sized from the wedge's total DRAWN length,
 * which is only known once every piece exists. See {@link drawWedge}.
 */
interface WedgePiece {
  x0: number
  x1: number
  line: number
  role: WedgeRole
}

/**
 * Cut the wedge into the pieces the systems make, each fragment opening by the fractions
 * {@link fragmentOpening} states — LilyPond's and Verovio's identical thirds.
 *
 * ⭐ `planSlurSegments` is reused verbatim, and its name is the only thing about it that says
 * "slur": it is *given two system numbers and two x's, what pieces does this span break into*,
 * which is a fact about systems. Its `type` maps one-to-one onto a fragment's role, which is why
 * there is no second planner here to drift out of step with it.
 */
function cutIntoPieces(
  pass: RenderPass,
  fromLine: number,
  toLine: number,
  startX: number,
  endX: number,
  scale: number,
): WedgePiece[] {
  const pieces: WedgePiece[] = []
  for (const seg of planSlurSegments(pass, fromLine, toLine, startX, endX, scale)) {
    // ⚠️ Only a MIDDLE segment carries its line — the other three are implied by which end they
    // are, which is why this mapping is spelled out rather than read off `seg`.
    const range = seg.type === 'single' ? { x0: startX, x1: endX, line: fromLine }
      : seg.type === 'begin' ? { x0: seg.firstX, x1: seg.rightX, line: fromLine }
        : seg.type === 'middle' ? { x0: seg.leftX, x1: seg.rightX, line: seg.line }
          : { x0: seg.leftX, x1: seg.lastX, line: toLine }
    if (range.x1 <= range.x0) continue
    pieces.push({ ...range, role: seg.type })
  }
  return pieces
}

/**
 * Draw every hairpin in the score, on the dynamics line, split at system breaks.
 *
 * `placements` is every drawn (measure, staff); `plan` is where every mark of the render goes,
 * levelled by chain (`./dynamicsLinePlan`). The staff-id normalisation the ink boxes need lives
 * there now, with the rest of the vertical decision.
 */
export function renderHairpins(
  pass: RenderPass,
  score: Score,
  placements: readonly HairpinPlacement[],
  plan: DynamicsLinePlan,
): void {
  const byMeasureStaff = new Map<string, HairpinPlacement>()
  for (const p of placements) byMeasureStaff.set(`${p.measureNumber}:${p.staffIndex}`, p)

  for (const from of placements) {
    for (const hairpin of from.view.hairpins ?? []) {
      const span = hairpinSpan(score, hairpin.id)
      if (!span || span.startMeasure !== from.measureNumber) continue
      const to = byMeasureStaff.get(`${span.endMeasure}:${from.staffIndex}`)
      // Both endpoint bars are span anchors (`VexFlowRenderer.spanAnchors`), so a missing one means
      // the bar genuinely was not rendered — not that it was translated with stale coordinates.
      if (!to) continue

      const x = spanX(pass, span, hairpin, from, to)
      if (!x) continue

      // Every bar the wedge covers on this staff — the input both to the per-system line and to
      // finding a stave for each fragment's own system.
      const covered = placements.filter(p =>
        p.staffIndex === from.staffIndex
        && p.measureNumber >= span.startMeasure
        && p.measureNumber <= span.endMeasure)

      try {
        // ⚠️ `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-hairpin' here
        // would yield `class="vf-vf-hairpin"`, the mistake the slur's comment records.
        const group = pass.context.openGroup?.('hairpin', `hairpin-${hairpin.id}`) as SVGGElement | undefined
        inStaffSpace(pass, from.staffIndex, group, () => {
          drawWedge(pass, hairpin, span, x, covered, plan, from, to)
        })
        pass.context.closeGroup?.()
        if (group) pass.hairpinGroupMap.set(hairpin.id, group)
      } catch (e) {
        console.error('Could not render hairpin:', e)
      }
    }
  }
}

/**
 * ⭐⭐ **THE WEDGE'S RESHAPE, resolved to pixels** — a {@link HairpinEndpointOffsetOverride} (staff-
 * spaces, per end) against each end's OWN stave, since a split wedge's two ends can be on
 * differently-sized ones. A missing offset — or a not-yet-laid-out stave — yields 0, so the caller
 * adds it unconditionally without risking a throw inside `staffSpacesToPixels`.
 *
 * Pure, and exported for its own spec: jsdom measures no glyphs, but this is arithmetic on two
 * numbers the model holds and one the stave reports. The twin of `slurEndpointOffsetPx`.
 */
export function hairpinEndpointOffsetPx(
  offset: HairpinEndpointOffsetOverride | undefined,
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

/** The drawing itself, once the span and the two x's are known. */
function drawWedge(
  pass: RenderPass,
  hairpin: Hairpin,
  span: HairpinSpan,
  x: { startX: number; endX: number },
  covered: readonly HairpinPlacement[],
  plan: DynamicsLinePlan,
  from: HairpinPlacement,
  to: HairpinPlacement,
): void {
  const px = (spaces: number, stave: Stave) => staffSpacesToPixels(spaces, stave)
  const pad = px(HAIRPIN.BOUND_PADDING, from.stave)

  // Stop short of a dynamic at either end — the skyline. A mark at the START pushes the wedge
  // right; one at the END pulls it left.
  const atStart = markInkX(pass, from.view, span.startBeat)
  const atEnd = markInkX(pass, to.view, span.endBeat)
  let startX = atStart ? Math.max(x.startX, atStart.right + pad) : x.startX
  let endX = atEnd ? Math.min(x.endX, atEnd.left - pad) : x.endX

  // ⭐⭐ …and a little air at BOTH ends, always: a wedge never quite touches what it runs up
  // against, so two wedges that abut leave twice this between them and neither has to know the
  // other exists (his call — see `HAIRPIN.END_INSET`). Each end is inset against ITS OWN stave,
  // because the two ends of a split wedge can be on differently-sized staves.
  startX += px(HAIRPIN.END_INSET, from.stave)
  endX -= px(HAIRPIN.END_INSET, to.stave)

  // ⭐⭐ THE USER'S OWN RESHAPE, on top of everything the engraver decided — his ask, 2026-08-17.
  // Applied HERE, after the automatic placement and before the pieces are cut, so a nudged end
  // carries through the cut, the aperture (which is sized from the DRAWN width) and the registered
  // outline — and therefore through the handles, which are read off that outline. An offset applied
  // per piece afterwards would move the ink and leave the squares behind.
  const nudge = hairpinEndpointOffsetPx(
    hairpinEndpointOffsetOverrideOf(pass.score, hairpin.id), from.stave, to.stave)
  startX += nudge.startX
  endX += nudge.endX
  // …but never past each other: a wedge squeezed to nothing by its neighbours keeps a sliver rather
  // than turning inside out, which is what a negative width would draw.
  //
  // ⚠️⚠️ **Only when both ends are on the SAME SYSTEM — the two x's are otherwise not comparable.**
  // Every system restarts at the left margin, so a wedge from late in one system to early in the
  // next has `endX < startX` while being perfectly well-formed. Running the rescue on it replaced
  // the END's x with a number from the START's system, and the continuation was then drawn from the
  // left margin out to that foreign x — a fragment stretching most of the second system, and (since
  // the two now sat a space apart) an aperture the angle cap crushed to nothing, so BOTH fragments
  // drew as flat lines. The browser suite missed it because its fixture starts in bar 1, where
  // `startX` happens to be the smaller number anyway.
  if (from.line === to.line && endX <= startX) {
    startX = x.startX
    endX = Math.max(x.endX, startX + px(1, from.stave))
  }

  // ⚠️ The aperture is decided ONCE, from the whole span, and then divided among the fragments —
  // never per fragment. Sizing each piece by its own width would open the short half of a split
  // wedge differently from the long half, i.e. two wedges rather than one broken one.
  //
  // ⭐ Which is why the pieces are cut FIRST: the length that feeds the angle cap is how much wedge
  // is actually DRAWN — the sum of the fragments — and `endX − startX` is only that number when the
  // span fits on one system.
  const pieces = cutIntoPieces(pass, from.line, to.line, startX, endX, from.scale)
  // ⚠️ The ramp is sized from the pieces BEFORE anything is cut out of them, and the interior gaps
  // are taken out afterwards — Gould p. 107's collinearity. See `hairpinBreaks`.
  const drawnWidth = pieces.reduce((sum, p) => sum + (p.x1 - p.x0), 0)
  // ⭐ The hand-set mouth where there is one, else the automatic length-aware aperture. The steepness
  // cap inside `resolveHairpinShape` applies to both, so an authored mouth on a short wedge is still
  // pulled back from an arrowhead.
  const lengthSpaces = drawnWidth / from.stave.getSpacingBetweenLines()
  const shape = resolveHairpinShape(hairpinApertureOverrideOf(pass.score, hairpin.id), lengthSpaces)
  if (!(shape.aperture > 0)) return

  // ⭐⭐ **BROKEN FOR AN INTERIM DYNAMIC** — Gould p. 107. The marks inside the span cut slices out
  // of the pieces; each remaining segment remembers WHERE it sat, so the two arms carry straight
  // across the gap instead of restarting. ⛔ Browser-only, like the endpoint skyline above and for
  // the same reason: in jsdom a glyph measures 0×0, there are no gaps, and the wedge draws whole.
  const segments = breakWedgeAtGaps(
    pieces,
    // ⚠️ `HAIRPIN.BREAK_PADDING`, ⛔ never the `pad` the two ENDS use: a window cut in a continuous
    // wedge needs far less air than the gap between two separate objects (his call, 2026-08-18).
    interiorMarkGaps(pass, hairpin, span, covered, px(HAIRPIN.BREAK_PADDING, from.stave)),
    px(HAIRPIN.MIN_FRAGMENT, from.stave))

  const ctx = pass.context
  for (const piece of segments) {
    const role = fragmentOpening(piece.role, hairpin.type)
    // ⭐ The piece's own share of its role's range — 0→1 for anything the gaps did not touch, so an
    // unbroken wedge is drawn by exactly the arithmetic it always was.
    const open = { start: rampAt(role.start, role.end, piece.t0), end: rampAt(role.start, role.end, piece.t1) }
    // ⭐ THIS FRAGMENT'S OWN SYSTEM — its stave, its dynamics line, its staff-space size. All three
    // are facts about the system the piece landed on, not about where the wedge began.
    const here = covered.filter(p => p.line === piece.line)
    const stave = here[0]?.stave ?? from.stave
    // ⭐ Looked up per FRAGMENT, never recomputed: a wedge's baseline depends on the CHAIN it is in
    //   — the wedge it meets on a barline, the `f` it runs into — which nothing walking one bar can
    //   see. `dynamicsLinePlan` levels the whole render's marks before either pass draws.
    const baseline = plan.get(hairpinLineKey(hairpin.id, piece.line))
    if (baseline === undefined) continue
    const axis = stave.getYForLine(0) + px(baseline + axisOffsetSpaces(), stave)

    // The two arms, mirrored about the axis. The slant is TWO endpoint deltas (`hairpinShape`), so
    // each end's y is the axis plus its own — never one angle about a pivot.
    // ⚠️ The vertical nudge belongs to the wedge's TRUE ends, so a split wedge takes the start's on
    // its first piece and the end's on its last — a middle fragment has neither, and applying both
    // to every piece would bend the wedge at each system break.
    // ⭐ The slant is a ramp too, and interpolating it at the cut is what keeps the ARMS collinear —
    // giving every segment the whole span's two deltas would step the wedge at each gap.
    const y0 = axis + px(rampAt(shape.startY, shape.endY, piece.t0), stave)
      + (piece === segments[0] ? nudge.startY : 0)
    const y1 = axis + px(rampAt(shape.startY, shape.endY, piece.t1), stave)
      + (piece === segments[segments.length - 1] ? nudge.endY : 0)
    const h0 = px(shape.aperture * open.start, stave) / 2
    const h1 = px(shape.aperture * open.end, stave) / 2
    ctx.setLineWidth(px(THIN_LINE_SPACES, stave))
    for (const sign of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(piece.x0, y0 + sign * h0)
      ctx.lineTo(piece.x1, y1 + sign * h1)
      ctx.stroke()
    }

    // ⭐ ONE REGISTRY ENTRY PER FRAGMENT, all carrying the hairpin's id — so either half of a split
    // wedge is clickable and a hit resolves to the whole hairpin. `points` walk the OUTLINE (top
    // arm, then the mouth, then the bottom arm back) rather than the bbox: a wedge spanning four
    // bars has a bounding rectangle sitting under every note in them, and selecting by that band
    // would steal presses from all of them.
    pass.elementRegistry.add({
      type: 'hairpin',
      id: hairpin.id,
      staff: from.staffIndex,
      measure: from.measureNumber,
      // ⭐ What the wedge was actually DRAWN at, in staff-spaces — the resolved mouth (authored or
      // automatic, after the steepness cap) and the length that decided it. The Properties mouth
      // input reads both: it shows the effective number so stepping starts from what is on screen
      // rather than from zero, and the length gives its upper bound (`authoredApertureRange`).
      apertureSpaces: shape.aperture,
      hairpinLengthSpaces: lengthSpaces,
      bbox: {
        x: piece.x0,
        y: Math.min(y0 - h0, y1 - h1),
        width: piece.x1 - piece.x0,
        height: Math.max(y0 + h0, y1 + h1) - Math.min(y0 - h0, y1 - h1),
      },
      points: [
        { x: piece.x0, y: y0 - h0 },
        { x: piece.x1, y: y1 - h1 },
        { x: piece.x1, y: y1 + h1 },
        { x: piece.x0, y: y0 + h0 },
      ],
      // ⭐⭐ THE ATTACHMENT GUIDE — the fourth kind (his call, 2026-08-17), and the first SPAN to
      // draw one.
      //
      // ⭐ **AT THE BEGINNING ONLY — his call**, where MuseScore draws one line per END of a
      // spanner (`LineSegment::gripAnchorLines` returns two). A wedge's extent is already visible as
      // ink, so what the guide adds is where the gesture is ANCHORED, and that is its start. ⛔ Do
      // not add the end line "for symmetry": it was asked for and declined.
      //
      // ⚠️ On the FIRST fragment, which is where the start beat is — a wedge cut across a system
      // break has fragments in different systems' coordinates, and the drawer reads every entry
      // under the id, so a continuation fragment simply carries none.
      //
      // The two ends: the wedge's own tip at its near-staff side (a hairpin lives BELOW the staff,
      // so that is the TOP arm), and the staff's BOTTOM line at the beat the span starts on — a
      // POSITIONAL span attaches to a place, like the tempo mark and unlike the trill (which is
      // defined by a note's pitch). See docs/dynamic-offset-plan.md for that split.
      ...(piece === segments[0]
        ? { guides: [{ from: { x: piece.x0, y: y0 - h0 }, to: { x: x.startX, y: stave.getYForLine(4) } }] }
        : {}),
    })
  }
}
