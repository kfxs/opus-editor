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
 * ⭐⭐ **THE LINE ALWAYS DRAWS, including on a single note** — his call, 2026-08-13, overruling the
 * plan's rule 5 (LilyPond's and Gould's "a single note needs no wavy line"). A bare `tr` leaves the
 * duration implied and he wants it shown. See `trillOps.TrillSpan` for the full note; ⛔ do not
 * restore the flag from the sources.
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
import { clearanceBaseline, columnsBetween, mergeInkBands, staffInkBand, type InkBand } from '@/engine/layout/inkBand'
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
 * ⭐ **THE TRILL'S OWN Y** — clear the ink over the columns it covers, floored at
 * {@link TRILL_LINE}'s minimum, mirrored for `below`.
 *
 * ⚠️ **The band is the union over the bars of THIS FRAGMENT, not of the whole span.** A trill split
 * over a system break has one band per SEGMENT — otherwise a low note on the second system would
 * push the first system's `tr` up for no visible reason. Same rule the hairpin's fragments follow.
 */
function baselineFor(
  covered: readonly TrillPlacement[],
  span: TrillSpan,
  voice: number,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  side: 'above' | 'below',
): number {
  let band: InkBand | null = null
  for (const p of covered) {
    const { from, to } = barSlice(p, span, voice)
    band = mergeInkBands(band, staffInkBand(columnsBetween(p.system.columns, from, to), staffId, firstStaffId))
  }
  return clearanceBaseline(band, side, TRILL_MARK_INK, TRILL_LINE)
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
export function renderTrills(
  pass: RenderPass,
  score: Score,
  placements: readonly TrillPlacement[],
  staffIds: readonly (string | undefined)[],
): void {
  const trills = score.trills
  if (!trills?.length) return

  // The ladder's shared horizontal axis, walked once for the render rather than per trill.
  const starts = measureStartOffsets(score)

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
    const x = spanX(pass, span, voice, from, to)
    if (!x) continue

    const covered = placements.filter(p =>
      p.staffIndex === from.staffIndex
      && p.measureNumber >= span.startMeasure
      && p.measureNumber <= span.endMeasure)

    try {
      // ⚠️ `openGroup` prefixes both class and id with `vf-` itself — passing 'vf-trill' here
      // would yield `class="vf-vf-trill"`, the mistake the slur's comment records.
      const group = pass.context.openGroup?.('trill', `trill-${trill.id}`) as SVGGElement | undefined
      inStaffSpace(pass, from.staffIndex, group, () => {
        drawTrill(pass, trill, span, voice, x, covered, from, to, staffIds[from.staffIndex], staffIds[0], starts)
      })
      pass.context.closeGroup?.()
      if (group) pass.trillGroupMap.set(trill.id, group)
    } catch (e) {
      console.error('Could not render trill:', e)
    }
  }
}

/** The drawing itself, once the span and the two x's are known. */
function drawTrill(
  pass: RenderPass,
  trill: Trill,
  span: TrillSpan,
  voice: number,
  x: { startX: number; endX: number },
  covered: readonly TrillPlacement[],
  from: TrillPlacement,
  to: TrillPlacement,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  starts: Map<number, Fraction>,
): void {
  const side = trill.placement ?? 'above'
  const ctx = pass.context

  // ⭐ AIR AT THE END — stand the line off whatever it runs up to (his call; see TRILL_END_INSET).
  // ⚠️ Applied to the SPAN's end BEFORE cutting into pieces, which is what keeps it off a system
  // break: a fragment that ends at the margin is created by the cut, so it never sees this.
  const inset = staffSpacesToPixels(TRILL_END_INSET, from.stave)
  // ⚠️ The "never past the start" clamp is SAME-SYSTEM ONLY, for `spanX`'s reason: across a break
  // the two x's are in different systems' coordinates, so `startX + inset` is not a floor — it is a
  // number from another row, and clamping to it threw the end of the line back to the wrong place.
  const insetEnd = x.endX - inset
  const endX = from.line === to.line ? Math.max(insetEnd, x.startX + inset) : insetEnd

  // ⭐⭐ THE ATTACHMENT GUIDE'S FAR END — the trilled NOTE, captured once for the whole ornament.
  //
  // ⭐ **A trill's anchor really is a note**, which puts it with the dynamic and against the tempo
  // mark (whose anchor is a place in time — see docs/dynamic-offset-plan.md). The distinction is not
  // a style choice: this ornament is DEFINED by that note. Its auxiliary is a step above THAT pitch
  // (`utils/trillPitch`), so a guide that pointed at a staff line instead would be pointing away
  // from the thing the trill is computed from.
  const anchor = trilledNoteAnchor(pass, from, voice, span, x.startX, side === 'above')

  let firstPiece = true
  for (const piece of cutIntoPieces(pass, from.line, to.line, x.startX, endX, from.scale)) {
    // ⭐ THIS FRAGMENT'S OWN SYSTEM — its stave, its own ink band, its staff-space size. All three
    // are facts about the system the piece landed on, not about where the trill began.
    const here = covered.filter(p => p.line === piece.line)
    const stave = here[0]?.stave ?? from.stave
    const px = (spaces: number) => staffSpacesToPixels(spaces, stave)
    const baseline = baselineFor(here.length ? here : covered, span, voice, staffId, firstStaffId, side)
    const y = stave.getYForLine(0) + px(baseline)

    // ⭐ THE LADDER CLAIM (docs/ottava-plan.md P0a). The trill is the INNERMOST outside-staff family,
    //   so it never reads this collection — but being innermost is no excuse for not WRITING to it:
    //   an 8va bracket (LilyPond 400 against the trill's 50) has to clear exactly this fragment.
    //   ⚠️ Per FRAGMENT, in that fragment's own beats — one claim for the whole trill would put the
    //   second system's `tr` on the first system's beats.
    const claim = trillFragmentClaim(
      here.length ? here : covered, span, voice, piece.line, staffId, side, baseline, starts)
    if (claim) pass.occupiedBands.push(claim)

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
    const signX = (restartOnNote ? firstNoteXOnLine(pass, here, voice) : undefined) ?? marginX
    const signWidth = drawsSign
      ? drawTrillSign(ctx, signX, y, piece.continuation && label === 'parenthesised')
      : 0

    // ⚠️ No sign means no GAP either — the gap exists to separate the line from the sign, so keeping
    // it under `'none'` would indent the wiggle from the margin for no visible reason.
    const lineStart = drawsSign ? signX + signWidth + px(TRILL_SIGN_GAP) : piece.x0
    const lineEnd = piece.x1
    // ⭐⭐ **THE LINE ALWAYS DRAWS — his call, 2026-08-13**, overruling docs/trill-plan.md §1 rule 5
    // ("a single note needs no wavy line"), which was LilyPond's and Gould's. A bare `tr` leaves the
    // duration implied; he wants it shown, on one note as much as on twenty. The ONLY thing that
    // suppresses the wiggle is having no room left after the sign — a real geometric fact, not a
    // rule — which is what this guard is and all it is.
    if (lineEnd > lineStart) {
      drawWiggle(pass, lineStart, lineEnd, y, stave)
    }

    // ⭐ ONE REGISTRY ENTRY PER FRAGMENT, all carrying the trill's id — so either half of a split
    // trill is clickable and a hit resolves to the whole ornament. `points` walk the drawn band
    // rather than a bbox spanning bars of music underneath (`HairpinRenderer`'s reasoning).
    const top = y - px(TRILL_MARK_INK.above)
    const bottom = y + px(TRILL_MARK_INK.below)
    pass.elementRegistry.add({
      type: 'trill',
      id: trill.id,
      staff: from.staffIndex,
      measure: from.measureNumber,
      bbox: { x: piece.x0, y: top, width: Math.max(lineEnd, piece.x0 + signWidth) - piece.x0, height: bottom - top },
      points: [
        { x: piece.x0, y: top },
        { x: Math.max(lineEnd, piece.x0 + signWidth), y: top },
        { x: Math.max(lineEnd, piece.x0 + signWidth), y: bottom },
        { x: piece.x0, y: bottom },
      ],
      // ⭐ The guide's two ends, on the FIRST fragment only — `getById` answers with the first entry
      // registered under an id, and the first fragment is the one holding the start note. ⛔ Putting
      // them on every fragment would be writing a second answer nothing reads; a continuation `(tr)`
      // on a later system is a reminder, not a second attachment.
      // ⚠️ Both are in this staff's own scaled space, like every other coordinate here.
      // The sign's ink corner NEAREST the staff — its BOTTOM for an above-staff trill, its top for a
      // `below` one. The same rule the dynamic and the tempo mark follow, which is what keeps the
      // guide from crossing the glyph it leaves.
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
  startX: number,
  above: boolean,
): { x: number; y: number } | undefined {
  const note = pass.staveNoteMap.get(slotIdAt(from.view, voice, span.startBeat) ?? '')?.staveNote
  const ys = note?.getYs?.()
  if (!ys?.length) return undefined
  // The notehead FACING the sign: the topmost for a trill above the staff, the lowest for one below
  // — a chord's other heads are further from it, and the guide should stop at the first ink it meets.
  return { x: startX, y: above ? Math.min(...ys) : Math.max(...ys) }
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
