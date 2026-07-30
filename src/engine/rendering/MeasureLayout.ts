import type { Score, Measure, Clef } from '@/types/music'
import { fracIsZero } from '@/utils/fraction'
import { type StaffClefs } from '@/utils/clefUtils'
import { getStaves, staffMeasureView } from '@/engine/models/staffContent'
import { cautionaryAllowedOf, cautionaryClefAllowedOf, keyStaffId, measureUserSpacePx, measureStretch } from '../models/engravingOverrides'
import { LAYOUT_CONFIG, type MeasureWidthInfo, type ViewMode } from './layoutConfig'
import { resolveSurface, SKETCH_CANVAS, type SurfaceMetrics } from '@/engine/layout/surface'
import type { MeasureWidthCache } from './MeasureWidthCache'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { clefResolverFor, measureColumns, measureLeadIn } from '@/engine/layout/measureColumns'
import { cautionaryExtent, headerExtent, inlineClefExtent } from '@/engine/layout/headerInk'
import { naturalWidth, minimumWidth } from '@/engine/layout/spacing'
import { EMPTY_BAR_FLOOR_PX } from '@/engine/layout/spacingPadding'
import { renderProbe } from '@/engine/RenderProbe' // TEMPORARY — the §9 layout-breakdown probes
import { drawsTimeSignature } from './NoteBuilder'

/**
 * Measure-width math — the two-pass proportional layout that decides each measure's
 * minimum/final width and which line it lands on, plus the cautionary clef/TS width
 * reservations at line breaks.
 *
 * Pure over `(score, clefsByStaff)`: holds no renderer state and writes no per-render lookup maps.
 *
 * ⭐ **And framework-agnostic again as of P2.** It used to build throwaway VexFlow voices and ask
 * `Formatter.preCalculateMinTotalWidth` how wide a bar's ink was — a coupling this file quarantined
 * rather than removed. The spacing model removed it: a bar's width is now the rule
 * (`engine/layout/spacing.ts`) summed over its columns (`engine/layout/measureColumns.ts`), and
 * neither knows what VexFlow is. ⚠️ P3 brings a measurement back when real ink extents arrive — but
 * as `EventExtent` numbers handed IN, not as a formatter called from here.
 */

/**
 * The horizontal space a measure's notes need — **the spacing rule, summed over its columns**
 * (docs/spacing-model-plan.md P2). Two numbers: what the music asks for, and what it will not go
 * below.
 *
 * ⭐⭐ **This is where DURATION finally enters bar width.** It used to be
 * `max(preCalculateMinTotalWidth × 1.15, laneColumns × MIN_NOTE_SPACING)` — pure ink and a flat
 * floor, with no duration term anywhere, and P0 measured what that produced: an eighth drawn 3.36
 * staff spaces against a quarter's 1.94, because an unbeamed eighth carries a *flag* at width time
 * and a quarter carries nothing, so ink was the only quantity that varied and it varied the wrong
 * way (docs/spacing-model-research.md §6). Now a quarter earns Gould's 3½ spaces because it is a
 * quarter.
 *
 * ⚠️ **PER MEASURE, not per lane** — the max-over-staves became a MERGE. A column is a position in
 * the *system*, so staff 1's beat 2 and staff 2's beat 2 are one column paid for once, and two
 * voices at one beat are one column rather than two. See {@link measureColumns}.
 *
 * ⭐⭐ **AND SILENCE IS MUSIC HERE — an empty bar is spaced by the rule like everything else.** It
 * used to be the one exception: `EMPTY_LANE_NOTE_SPACE`, a flat 4 staff spaces of note area **whatever
 * meter the bar was in and whatever else it carried**. That default is what made a system-opening
 * empty bar read wrong (his report): 4 spaces of music plus a 6.6-space header came to 10.25, the
 * `MIN_MEASURE_WIDTH` floor was already past it on the header alone, and so the bar's whole minimum
 * went on its clef and meter — **3.78** spaces of drawn music against a mid-line bar's 8.85.
 *
 * A bar of silence has a duration, and the rule has an answer for a duration: its one whole-bar-rest
 * column earns `followingSpace(the bar)` — 6.0 staff spaces in 4/4, 4.8 in 2/4, 6.7 in 12/8. That is
 * what LilyPond does (`MultiMeasureRest.space-increment` = 2.0 — *"each doubling of the duration adds
 * `space-increment` to the length of the bar"*) and it is why an empty bar in a big meter should not be
 * the same width as one in a small meter. `MIN_MEASURE_WIDTH` stays what it was, a floor on the bar as
 * SEEN; it now only decides bars the rule leaves narrower than a sliver.
 *
 * ⚠️ **The cache is not consulted here, and that is not an oversight.** `MeasureWidthCache` existed
 * to memoize the VexFlow `Formatter`, which is no longer in this path: what replaced it is a walk
 * over the slots and some exact arithmetic, and `laneFingerprint` — a `JSON.stringify` of the whole
 * measure — costs more than the thing it would be saving. It comes back at P3, when measuring real
 * ink makes this expensive again. ⛔ Do not re-add it before then on the assumption that a memo is
 * free; the render-perf census exists to answer that with a number.
 */
function noteSpaceForMeasure(
  measure: Measure,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  firstStaffId: string | undefined,
): { natural: number; floor: number } {
  // TEMPORARY probe — the §9 question (see {@link RenderProbe.layoutSub}). The bucket is still
  // called `format`; what it times is no longer a formatter but the width term it replaced.
  const probing = renderProbe().recording
  const t0 = probing ? performance.now() : 0
  const columns = measureColumns(measure, clefResolverFor(measure, clefsByStaff, firstStaffId))
  // ⚠️ Staff spaces out, pixels in: the rule is written in the unit Gould's table is, and the
  // casting-off works in px. ⚠️ A staff drawn small should multiply this by its own size — the same
  // open P3 as the four width constants in `layoutConfig` (docs/staff-size-plan.md §6).
  // ⭐ P5 — no fan term. A fanned slot's members are ordinary columns in `columns` (their beats come
  // from `fanMemberBeats`), so the sum above already asks for exactly the room their heads take.
  // What used to be here was `laneColumns × MIN_NOTE_SPACING`, covering the span `fanRoom` bought
  // from the formatter on the fan's behalf — a proxy several times larger than the ramp for a steep
  // one, and the reason a fanned bar was the widest thing on any page it appeared on.
  const answer = {
    natural: naturalWidth(columns) * STAFF_SPACE_PX,
    // ⭐ **A bar of pure silence keeps a LOWER floor than its own ink** — {@link EMPTY_BAR_FLOOR_PX},
    //   not the rest glyph's extent. Deliberate, and the one thing left of the old special case: an
    //   empty bar is allowed to get out of a neighbour's way completely (docs/bar-width-plan.md §2),
    //   which is a statement about a bar nobody has written into, not about how wide a rest is.
    floor: isEmptyBar(measure) ? EMPTY_BAR_FLOOR_PX : minimumWidth(columns) * STAFF_SPACE_PX,
  }
  if (probing) renderProbe().layoutSub('format', performance.now() - t0)
  return answer
}

/**
 * Minimum width of a measure — its columns' own demand, plus **the widest staff's** overhead.
 *
 * ⭐ **The note space is a MERGE over the staves, and used to be a max** (docs/spacing-model-plan.md
 * §1.2). A measure spans every staff and they share barlines, so a rhythmic position is a position
 * in the *system*: beat 2 on staff 1 and beat 2 on staff 2 are ONE column at ONE x, paid for once.
 * The old max-over-staves was the best available answer while each staff was formatted alone — it
 * replaced something worse still (pouring every staff's notes into one voice set, which reserved
 * room for 25 staves interleaved into an imaginary stream, docs/render-performance-plan.md §3) — but
 * it cannot express "these two staves want the same x", which is what a grand staff is.
 *
 * The clef terms stay per-staff and OUTSIDE that, because a clef really is per-staff (staff 1 may
 * change clef where staff 2 does not). The time-signature and barline padding are shared by every
 * staff, so they sit outside too.
 *
 * Returns **four** numbers, not one: the clamped total the layout casts off on, the measure's note
 * space alone (what a bar stretch multiplies — client #11, docs/bar-width-plan.md §2), its overhead,
 * and its incompressible floor. The overhead is deliberately NOT in the note space — a bar pays a
 * full clef only while it opens a line, so a stretch over the overhead would buy a different number
 * of pixels after every re-wrap.
 */
function calculateMinimumMeasureWidth(
  score: Score,
  measure: Measure,
  isFirstInLine: boolean,
  clefsByStaff: Map<string | undefined, StaffClefs>,
): { total: number; noteSpace: number; overhead: number; spacingFloor: number } {
  const staffIds = staffIdsOf(score, clefsByStaff)

  // Shared by every staff: the bar's LEAD-IN, and the meter glyph where one is drawn (measure 1 +
  // changes).
  //
  // ⭐ The lead-in is the model's now, not a constant — `barline↔note` (or ↔accidental, ↔rest) plus
  //   the first column's own left extent, which nothing counted before: `naturalWidth` sums the gaps
  //   BETWEEN columns, so an accidental on a bar's first note bought no room at all and the drawing
  //   took it out of everything else in the bar.
  // ⚠️ And it replaces `BARLINE_PADDING × 2`, which was DOUBLE-COUNTING since P3: the trailing side
  //   became the barline COLUMN's gap (`note↔barline`), so a bar was reserving three spaces of
  //   barline padding where it owes two.
  const leadIn = measureLeadIn(measure, clefResolverFor(measure, clefsByStaff, staffIds[0]))
  const sharedOverhead = (leadIn.padding + leadIn.extent) * STAFF_SPACE_PX
  const meter = drawsTimeSignature(measure) ? measure.timeSignature : undefined

  // At N=1 the lane IS the measure (every slot matches the only staff), so skip the filter —
  // it would copy four arrays per measure per render to arrive back at what it was given.
  const single = staffIds.length === 1

  // ⭐ ONE answer for the whole measure — the columns are the system's, not a staff's. Both numbers
  //   come out of the same column list, and they MUST: the floor is the sum of the gaps' minimums
  //   and the width is the sum of `max(rule, minimum)`, so a floor counted any other way could
  //   exceed the width it is a floor on and make the bar incompressible. (That is exactly what the
  //   old pair did the other way round — it counted SLOTS in both, so a two-voice bar's floor
  //   matched its slot-built width.)
  const { natural: noteSpace, floor: spacingFloor } = noteSpaceForMeasure(measure, clefsByStaff, staffIds[0])

  let widestOverhead = 0
  for (const staffId of staffIds) {
    // TEMPORARY probe — see {@link RenderProbe.layoutSub}.
    const probe = renderProbe()
    const tView = probe.recording ? performance.now() : 0
    const lane = single ? measure : staffMeasureView(measure, staffId, score)
    if (probe.recording) probe.layoutSub('laneView', performance.now() - tView)
    const staffClefs = clefsByStaff.get(staffId)
    const clef = staffClefs?.opening.get(measure.number) ?? 'treble'

    // ⭐ This staff's HEADER, as ink (`engine/layout/headerInk.ts`) rather than as two constants. A
    //   line-opening measure draws a full clef on every staff; mid-line, a staff draws a small clef
    //   only where ITS clef changes across the barline — i.e. differs from the previous measure's
    //   *ending* clef (a mid-measure change already showed its clef inline in that measure).
    //
    // ⚠️ The clef and the meter are measured TOGETHER, and that is the point: a meter costs 2.4
    //   staff spaces alone and 3.4 after a clef, so summing two constants could not have been right
    //   whatever the constants were.
    const prevEndClef = measure.number > 1 ? staffClefs?.ending.get(measure.number - 1) : undefined
    const headerClef = isFirstInLine
      ? { clef, small: false }
      : prevEndClef !== undefined && clef !== prevEndClef
        ? { clef, small: true }
        : undefined
    // Each mid-measure (inline) clef change on THIS staff draws its own small clef — inside the
    // music, so it is not part of the header, only of the room the bar needs.
    const midClefs = (lane.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
    const staffHeader = headerExtent({ clef: headerClef, meter })
      + midClefs * inlineClefExtent(clef)

    widestOverhead = Math.max(widestOverhead, staffHeader * STAFF_SPACE_PX)
  }

  const totalWidth = noteSpace + widestOverhead + sharedOverhead
  // ⭐ **THE CAP IS A PREFERENCE; THE FLOOR IS THE MUSIC.** `MAX_MEASURE_WIDTH` says "one measure
  // must not dominate a line", which is a taste about bars that could be narrower — and it was being
  // applied last, so it also clamped bars that could NOT. A fan of eight thirty-seconds asks for 21
  // columns, the cap held its bar at 40 staff-spaces, and everything that did not fit was drawn
  // straight through the barline (his screenshot; the rests measured 56px and 69px outside their own
  // bar). His question, and it is the right one: *"there is still space in the line… the bar can grow
  // more."* So the incompressible demand — every lane's columns, plus the clefs and meter that must
  // be drawn — is the floor under the cap, and a bar that genuinely needs more room takes it. The
  // line then carries fewer bars, which is what casting-off is for.
  const incompressible = spacingFloor + widestOverhead + sharedOverhead
  return {
    total: Math.max(
      Math.min(
        Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH),
        LAYOUT_CONFIG.MAX_MEASURE_WIDTH,
      ),
      incompressible,
    ),
    noteSpace,
    overhead: widestOverhead + sharedOverhead,
    spacingFloor,
  }
}

/**
 * Is this a bar nobody has written into — one rest per staff sitting in the middle, and nothing
 * else? It decides which way a stretch acts on the bar (see {@link measureWidthParts}).
 *
 * ⚠️ **Asked of the CONTENT, never of a measured width.** The first version asked whether the bar's
 * note space had come out at the flat empty-bar default (40 px, since deleted) — which compares a
 * number the *formatter* produced. Under jsdom the text metrics are stubbed to zero, so every empty
 * bar measured 40 and the tests were green; in a real browser a whole rest measures wider than that,
 * the bar was classified as having music, and the feature silently did nothing. A structural question
 * has the same answer in both places.
 *
 * Not "has no notes": a bar of eight authored eighth-rests has eight columns and is governed by them
 * like any other music. And a bar carrying a dynamic, a tempo or an inline clef is not empty either
 * — there is something in it that needs room, whatever the rhythm says.
 */
function isEmptyBar(measure: Measure): boolean {
  if (measure.dynamics?.length) return false
  if (measure.tempos?.length) return false
  if ((measure.clefs ?? []).some(c => !fracIsZero(c.beat))) return false
  const perLane = new Map<string | undefined, number>()
  for (const slot of measure.slots) {
    if (slot.type === 'chord') return false
    const seen = (perLane.get(slot.staffId) ?? 0) + 1
    if (seen > 1) return false // more than the one auto-filled rest: authored rhythm
    perLane.set(slot.staffId, seen)
  }
  return true
}

/**
 * The measure's **intrinsic** width plus whatever horizontal space the user authored into it —
 * a leading space per column (client #10 — docs/note-spacing-plan.md §2) and/or a stretch on the
 * whole bar (client #11 — docs/bar-width-plan.md §2). One `minWidth`, split three ways so §3 can
 * tell them apart: the intrinsic part is the engraver's and may be squeezed, the authored parts are
 * the user's and are handed back.
 *
 * ⚠️ **The stretch multiplies the NOTE SPACE, not the intrinsic width.** The bar's overhead (clef,
 * meter, barline padding) is reflow-dependent — 45px while the bar opens a line, 30 for a mid-line
 * clef change, 0 otherwise — so folding it in would make the *same stored stretch* buy a different
 * number of pixels the moment a re-wrap makes the bar line-opening, destroying the one thing the
 * multiplier was chosen for (it keeps the intent through edits). `stretch × noteSpace` also means
 * what the gesture says: this bar's *music* gets 1.5× the room, with the clef costing what a clef
 * costs.
 *
 * Two ordering facts, both load-bearing (and both apply to the stretch for the same reasons):
 *
 * - **The user space is added AFTER the clamps**, not before. `MIN_MEASURE_WIDTH`/
 *   `MAX_MEASURE_WIDTH` are caps on what the *music* needs; leave the authored space inside them
 *   and a drag dies silently at 400px with no feedback.
 * - **It is added OUTSIDE `noteSpaceForLane`'s memo**, where `clefOverhead` already sits. The
 *   overrides live on `score`, not on `Measure`, so `laneFingerprint` cannot see them — and must
 *   not. Fold them in and every drag frame re-runs the VexFlow formatter on the bar, which is the
 *   one thing that makes this drag unaffordable: unlike the other four, a spacing change always
 *   re-runs the casting-off (it sets `modelDirty`, so `layoutCache` is bypassed), so the width
 *   pass runs on every frame and only the memo keeps it cheap.
 */
function measureWidthParts(
  score: Score,
  measure: Measure,
  isFirstInLine: boolean,
  clefsByStaff: Map<string | undefined, StaffClefs>,
): { minWidth: number; userSpace: number; stretchSpace: number; noteSpace: number; overhead: number; stretchScalesShare: boolean; floorWidth: number; naturalWidth: number } {
  const empty = isEmptyBar(measure)
  const parts = calculateMinimumMeasureWidth(score, measure, isFirstInLine, clefsByStaff)
  const { total: intrinsic, noteSpace, overhead, spacingFloor } = parts
  const userSpace = measureUserSpacePx(score, measure.id)
  const stretch = measureStretch(score, measure.id)

  // ⚠️ **An EMPTY bar's stretch scales its SHARE of the line; every other bar's is added on top.**
  // Reported from use, and the reason is structural rather than a constant being wrong. A bar's
  // drawn width is mostly its justified share, which `distributeLineWidths` hands out in proportion
  // to `intrinsic` — and `intrinsic` is what the reserved-space model never touches. So a bar could
  // give back its note space (40px, all an empty bar has) and still sit there 165px wide, unable to
  // get out of the way of a long neighbour. It never looked organic because nothing about the bar's
  // *claim on the line* had changed.
  //
  // For a bar with music that model is right: its music sets its claim, and shrinking stops at the
  // engraver's own floor of `MIN_NOTE_SPACING` per column. **An empty bar has nobody's music to
  // answer to.** Its width is the rule's answer for a bar-long silence and, below that,
  // `MIN_MEASURE_WIDTH` — a floor about how a bar READS, not about anything written in it — so the
  // user asking for it to be narrow is overruling a default, and it should give way completely.
  // Hence: fold the stretch INTO the intrinsic (so the share moves with it) and reserve nothing.
  //
  // The overhead is kept out of the scaling for the reason §2 gives — a line-opening empty bar must
  // keep room for its clef and meter whatever its stretch — and the scalable part stops at one
  // column's `MIN_NOTE_SPACING`, which is the same floor a bar with music gets, per column.
  //
  // A bar that later gains a note changes model, so its stored number starts meaning the other
  // thing. That is deliberate: it also stops being a bar whose width was a default.
  // 🔴 KNOWN-INCOMPLETE: this branch is better than the reserved model here and still does not
  // shrink an empty bar as far as it should — reported three times, postponed rather than solved.
  // See docs/bar-width-plan.md "Known issues" #1 before assuming the behaviour below is correct.
  // ⭐ **A SHRINK lowers the bar's claim on the line; a GROWTH takes room from its neighbours.**
  // Asymmetric on purpose, because the two gestures mean different things. "Make this bar wider" is
  // a demand on the neighbours, so it is handed over as a transfer and they pay for it. "I need less
  // of the system" is not a demand on anyone — it is the bar standing down, so its `naturalWidth`
  // falls with it and the whole line re-shares. Treat a shrink as a transfer too and it arrives
  // uselessly small: a bar handing back its 56px of note space still drew 230px, because its CLAIM
  // had not moved. That was the original complaint about empty bars, and this is where it is
  // answered — `naturalWidth` carries the shrink and does not carry the growth.
  //
  // How far the bar may be FORCED, as against the `intrinsic` it asks for. One formula covers both
  // models: nothing below the overhead plus `MIN_NOTE_SPACING` per column is compressible. An empty
  // bar has one column, so it floors at `overhead + 18` — everything between that and its
  // `MIN_MEASURE_WIDTH` intrinsic is room it merely HAS rather than room it uses, which is exactly
  // the room a growing neighbour should be able to take. Never above the intrinsic it floors (a bar
  // clamped by `MAX_MEASURE_WIDTH` would otherwise be incompressible).
  const floorOf = (intrinsicPart: number) => Math.min(intrinsicPart, overhead + spacingFloor)

  if (empty) {
    const scalable = Math.max(0, intrinsic - overhead)
    const scaled = Math.max(EMPTY_BAR_FLOOR_PX, scalable * stretch)
    return {
      minWidth: overhead + scaled + userSpace,
      userSpace,
      overhead,
      stretchSpace: 0, // nothing reserved — the stretch IS the share
      noteSpace: scalable, // what the multiplier multiplies, so px↔ratio still converts
      stretchScalesShare: true,
      floorWidth: floorOf(overhead + scaled),
      naturalWidth: stretch >= 1 ? overhead + scalable + userSpace : overhead + scaled + userSpace,
    }
  }

  const floorWidth = floorOf(intrinsic)
  // ⚠️ **A SHRINK lowers the bar's claim, but never below its own INK.** `distributeLineWidths`
  // shares the line out in proportion to `naturalWidth` and only ever *takes* down to `floorWidth`,
  // so a claim that is already under the floor is never put back — the bar is simply drawn too
  // narrow, and its last notehead comes out on the barline. `e2e/barWidth.e2e.ts` found it the
  // moment P3 lowered the floor from a flat 1.8 staff spaces a column to the ink's own 1.43: a
  // single −500 px press on a bar of four quarters bottomed out at `BAR_STRETCH_MIN` and drew five
  // spaces of music into four. The clamp was always owed; the old constant was generous enough to
  // hide it.
  //
  // ⭐ Clamped on the SPACE and not on the width, so `minWidth` and `naturalWidth` stay equal for a
  // shrink and `distributeLineWidths`'s invariant — *"`growthOf` is never negative: a shrink rides
  // `naturalWidth` and is already in the baseline"* — still holds. A press past this point is dead,
  // which is the lesser evil: the alternative is a press that moves a number and not the picture.
  const stretchSpace = Math.max(noteSpace * (stretch - 1), floorWidth - intrinsic - userSpace)
  return {
    minWidth: intrinsic + userSpace + stretchSpace,
    userSpace,
    stretchSpace,
    noteSpace,
    overhead,
    stretchScalesShare: false,
    floorWidth,
    naturalWidth: stretch >= 1 ? intrinsic + userSpace : intrinsic + userSpace + stretchSpace,
  }
}

/** The staves to lay out. A hand-built staveless score still has one (undefined) lane, which is
 *  how `staffMeasureView` addresses "all the content that carries no staffId". */
function staffIdsOf(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
): (string | undefined)[] {
  const staves = getStaves(score)
  if (staves.length > 0) return staves.map(s => s.id)
  return clefsByStaff.size > 0 ? [...clefsByStaff.keys()] : [undefined]
}


/**
 * How much of a line the user may claim with authored space. The rest is the music's, and it is
 * why the cap exists at all: `available` is finite, and nothing in `distributeLineWidths` stops
 * `Σ userSpace` reaching it. At or past `available` the justify target goes to zero or negative
 * and every bar on the line comes out with a negative width; and since pass 1 puts an oversized
 * bar alone on its own line, one bar carrying 900px of space would squeeze its music to nothing
 * and *still* hand the 900px back whole — straight through the right margin.
 *
 * So the authored space is scaled down proportionally once the line's total passes this. "The gap
 * you drag is the gap you get" holds up to the cap, and degrades smoothly past it.
 */
export const USER_SPACE_LINE_FRACTION = 0.6

/**
 * How much of each authored pool a line actually hands back — 1 when nothing binds.
 *
 * Two pools, and keeping them apart is the whole difference between the two clients that have
 * width:
 *
 * - **`userSpace` (leading spaces, client #10) is capped** at {@link USER_SPACE_LINE_FRACTION}.
 *   It is a *dead gap*, and a line whose gaps claim all of it has no music left.
 * - **`stretchSpace` (bar width, client #11) is NOT.** It is live music room, so "this bar takes
 *   most of the line" is the legitimate case rather than the pathological one — an empty bar is a
 *   rest with white space either side of it, and there is a line's worth of room to give it.
 *   Capping it made the gesture visibly slow to a crawl and then jump, reported from use
 *   (docs/bar-width-plan.md §3).
 *
 * Uncapping the stretch is safe because pass 1 already bounds it: a bar joins a line only while the
 * line's Σ `minWidth` still fits, and authored ≤ `minWidth`, so Σ `stretchSpace` ≤ `availableWidth`
 * on any line holding two or more bars. The exception is the bar pass 1 puts **alone** on its line,
 * which may be worth more than the line — that is all `stretchScale` is for, and it hands such a
 * bar exactly the line, never a pixel through the right margin.
 *
 * Exported because `MusicEngine.barWidthRoom` has to know when a scale is biting: past it the
 * closed form it inverts no longer describes the picture. One definition, two readers — the
 * alternative was the gesture and the layout disagreeing about the same line.
 */
export function authoredScales(
  measureInfos: MeasureWidthInfo[],
  availableWidth: number,
): { userScale: number; stretchScale: number } {
  // A NEGATIVE total is never scaled: it hands width back to the music rather than taking it,
  // which is always affordable.
  const userTotal = measureInfos.reduce((sum, m) => sum + (m.userSpace ?? 0), 0)
  const cap = availableWidth * USER_SPACE_LINE_FRACTION
  const userScale = userTotal > cap ? cap / userTotal : 1

  const stretchTotal = measureInfos.reduce((sum, m) => sum + (m.stretchSpace ?? 0), 0)
  const stretchRoom = availableWidth - userTotal * userScale
  const stretchScale = stretchTotal > stretchRoom ? Math.max(0, stretchRoom / stretchTotal) : 1

  return { userScale, stretchScale }
}

/**
 * Distribute available width proportionally among measures on a line — justifying the
 * **intrinsic** widths only, and handing the user's authored space back on top
 * (docs/note-spacing-plan.md §3, "the gap you drag is the gap you get").
 *
 * Feeding the authored space through the stretcher instead would be wrong twice over: it would
 * dilute a 20px drag to ~13px, *and* shuffle every other bar on the line to pay for a change the
 * user made in one of them. So the space is reserved off the top, the engraver's widths share what
 * is left, and the reserved amount is added back to the bar that authored it. The total still
 * lands exactly on `availableWidth`.
 *
 * ⭐ **Growth is a TRANSFER, not a smaller pot.** Reported, and the distinction is the whole
 * feature: "we don't want to auto-shrink bars that have music because of another bar's width
 * action unless it is really necessary". Shrinking the pot everyone shares makes every bar on the
 * line lose in lockstep — measured, a bar of music gave up 9px while the empty bars beside it still
 * had 64px of give each. So the line is computed TWICE:
 *
 * 1. **The baseline** — where every bar would sit if nobody had touched a width (`naturalWidth`).
 *    Proportional, exactly as it always was, so a page with no gesture on it is unchanged.
 * 2. **The transfer** — each grown bar is handed its growth, and that many pixels are taken back
 *    from the others in priority order: **spare empty bars first**, down to `floorWidth`; bars with
 *    music only once the silence is exhausted; a uniform squeeze only if even that is not enough.
 *
 * So a bar of music does not move at all while any empty bar on its line still has room to give.
 * A *shrink* runs the same machinery backwards — and arrives undiluted, which the old proportional
 * model could not do (an empty bar pushed to its floor still drew ~87px because justification handed
 * a share of the surplus straight back).
 */
function distributeLineWidths(
  measureInfos: MeasureWidthInfo[],
  availableWidth: number
): void {
  if (measureInfos.length === 0) return

  // Dead gaps (leading spaces) are still reserved off the top and handed back whole — they are not
  // part of the transfer, because a space is room the bar genuinely needs rather than room it has
  // claimed from anyone.
  const { userScale } = authoredScales(measureInfos, availableWidth)
  const userOf = (m: MeasureWidthInfo) => (m.userSpace ?? 0) * userScale
  const room = availableWidth - measureInfos.reduce((sum, m) => sum + userOf(m), 0)

  // ── 1. The baseline: the line with every gesture taken back out ────────────────────────────────
  const naturalOf = (m: MeasureWidthInfo) => (m.naturalWidth ?? m.minWidth) - (m.userSpace ?? 0)
  const totalNatural = measureInfos.reduce((sum, m) => sum + naturalOf(m), 0)
  if (totalNatural <= 0) return
  const surplus = room - totalNatural

  /**
   * ⭐⭐ **A LINE'S SURPLUS IS SHARED BY THE MUSIC, because only the music can absorb it.**
   *
   * This used to be `natural × room / total` — every bar's WHOLE width scaled by one factor. But a
   * bar's width is *music + overhead*, and **overhead does not stretch**: a clef is 4.5 staff spaces
   * whether the line is justified or not. So the whole of a bar's share landed on its music, and a
   * bar's music actually stretched by `k + (k−1) × overhead/music` — the more clef and meter it
   * carried, the more its notes were pulled apart.
   *
   * ⚠️ **Measured on his own fragment**, one line, two bars of the same music: a quarter came out
   * **4.28** staff spaces in the system-opening bar and **3.96** two bars later, where the rule says
   * 3.6 for both. Bar 1 carried 8.1 spaces of clef, meter and lead-in against 14.4 of music, so it
   * was handed a share sized for a 22.5-space bar with only 14.4 spaces to put it in — `1.122 +
   * 0.122 × 8.1/14.4` = **×1.19** against bar 2's ×1.10. It hits every system-opening bar, always in
   * the same direction, and hardest when that bar has the least music.
   *
   * ⭐ Sharing by `noteSpace` — the part that CAN stretch — makes every bar's music stretch by the
   * same factor, so **the same duration is drawn the same width everywhere on a line**. That is the
   * consistency rule MuseScore 4's whole rewrite existed to establish
   * (docs/spacing-model-research.md §4), and the clef then costs exactly what a clef costs.
   *
   * ⛔ **Only a SURPLUS is shared this way; a DEFICIT keeps the old proportional squeeze.** They are
   * different questions. Handing out room is a spring problem — the springs take it. Taking room
   * back is a *policy* problem, and this editor already has a policy for it, reported into existence:
   * empty bars give way before bars of music (the tiers below). Squeezing by `noteSpace` would
   * invert it, taking most from the bar with the most music.
   */
  // ⚠️ `natural − overhead`, NOT `noteSpace`. For an EMPTY bar `noteSpace` is deliberately the
  //    UNSCALED multiplicand (so px↔ratio still converts for the gesture), so a bar shrunk to 0.3
  //    would still claim a full share of the surplus and undo its own shrink — measured, on the
  //    "the empty bar gets OUT OF THE WAY" test. `natural − overhead` is the music the bar is
  //    actually claiming right now, which is the thing that can stretch.
  const stretchOf = (m: MeasureWidthInfo) => Math.max(0, naturalOf(m) - (m.overhead ?? 0))
  const totalStretch = measureInfos.reduce((sum, m) => sum + stretchOf(m), 0)
  const widths = new Map(measureInfos.map(m => [
    m,
    surplus > 0 && totalStretch > 0
      ? naturalOf(m) + surplus * (stretchOf(m) / totalStretch)
      // The squeeze, unchanged: `natural × room / total` is `n + (room − T)·n/T` written shorter.
      : naturalOf(m) * room / totalNatural,
  ]))

  // ── 2. The transfer: hand out the growth, then take it back from the others ───────────────────
  const growthOf = (m: MeasureWidthInfo) => (m.minWidth - (m.userSpace ?? 0)) - naturalOf(m)
  let debt = 0
  for (const info of measureInfos) {
    const growth = growthOf(info)
    if (growth === 0) continue
    widths.set(info, widths.get(info)! + growth)
    debt += growth
  }

  // `growthOf` is never negative — a shrink rides `naturalWidth` and is already in the baseline —
  // so there is only ever a debt to collect, never a surplus to hand back.
  if (debt > 1e-9) {
    const floorOf = (m: MeasureWidthInfo) => Math.min(widths.get(m)!, m.floorWidth ?? 0)
    /** A grown bar never pays: being wide is the thing that was asked for. */
    const untouched = measureInfos.filter(m => growthOf(m) <= 1e-9)

    // Take `want` px from one group, in proportion to each bar's slack above its own floor. Because
    // the shares are slack-proportional, no bar is driven below its floor here — it stops exactly
    // there. Returns what could NOT be taken, for the next tier down.
    const takeFrom = (group: MeasureWidthInfo[], want: number): number => {
      if (want <= 1e-9) return 0
      const slack = group.map(m => Math.max(0, widths.get(m)! - floorOf(m)))
      const total = slack.reduce((sum, v) => sum + v, 0)
      if (total <= 0) return want
      const taken = Math.min(want, total)
      group.forEach((m, i) => widths.set(m, widths.get(m)! - taken * (slack[i] / total)))
      return want - taken
    }

    // ⚠️ Tier 1 is empty bars NOBODY GREW. The classifier is the layout's own —
      // `stretchScalesShare` comes from `isEmptyBar`, a STRUCTURAL question about content, never a
      // measured width (see its doc for why that has already bitten once). A grown bar is excluded
      // however empty it is: its growth lives in its own intrinsic, so it would otherwise be the
      // first thing squeezed away and would undo itself.
    const silence = untouched.filter(m => m.stretchScalesShare)
    let want = takeFrom(silence, debt)
    want = takeFrom(untouched.filter(m => !m.stretchScalesShare), want)
    // Nothing on the line has anything left to give and it still does not fit. NOW the line is
    // genuinely crowded, which is what makes this warning mean something — it used to fire on any
    // 30% squeeze, including ones paid for entirely out of empty bars.
    if (want > 1e-6) {
      const remaining = measureInfos.reduce((sum, m) => sum + widths.get(m)!, 0)
      const ratio = remaining > 0 ? Math.max(0, (remaining - want) / remaining) : 0
      if (ratio < 0.7) {
        console.warn(`Severe measure compression (${(ratio * 100).toFixed(0)}%) on line - measures may be crowded`)
      }
      for (const info of measureInfos) widths.set(info, widths.get(info)! * ratio)
    }
  }

  for (const info of measureInfos) {
    info.finalWidth = widths.get(info)! + userOf(info)
  }
}

/**
 * Who pays for the NEXT pixel that `growingMeasure` grows by, and what fraction of it each pays.
 * Keyed by measure number; the shares sum to 1 (or the map is empty when the line has nothing left
 * to give).
 *
 * Exported because `MusicEngine.barWidthRoom` has to inverse this to answer "how far must the
 * stretch travel to move the barline by `d` px". ONE definition, two readers — the alternative is
 * the gesture and the layout disagreeing about the same line, which is exactly what a barline
 * sliding out from under the pointer looks like. It mirrors the tiers in {@link
 * distributeLineWidths} marginally: whichever tier still has slack is the one paying right now.
 */
export function growthPayerShares(
  line: MeasureWidthInfo[],
  growingMeasure: number,
): Map<number, number> {
  const slackOf = (m: MeasureWidthInfo) =>
    Math.max(0, m.finalWidth - (m.userSpace ?? 0) - (m.floorWidth ?? 0))
  // A bar the user has already grown never pays, and neither does the bar being grown right now.
  const untouched = line.filter(m => m.measureNumber !== growingMeasure && !claimsRoom(m))
  const silence = untouched.filter(m => m.stretchScalesShare)
  const tier = silence.reduce((sum, m) => sum + slackOf(m), 0) > 1e-9
    ? silence
    : untouched.filter(m => !m.stretchScalesShare)
  const total = tier.reduce((sum, m) => sum + slackOf(m), 0)
  const shares = new Map<number, number>()
  if (total <= 1e-9) return shares
  for (const m of tier) shares.set(m.measureNumber, slackOf(m) / total)
  return shares
}

/**
 * Add a cautionary clef to the last measure of any line whose *next* line opens
 * with a different clef. The warning shows the upcoming clef just before the
 * line break (standard engraving). Runs after line assignment, so it reserves
 * width on the affected measure and re-distributes that line only — line
 * membership is never changed (no re-wrapping).
 */
function applyCautionaryClefs(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  staffIds: (string | undefined)[],
  results: Map<number, MeasureWidthInfo>,
  availableWidth: number
): void {
  const linesToRedistribute = new Set<number>()

  for (let i = 0; i < score.measures.length - 1; i++) {
    const current = results.get(score.measures[i].number)
    const next = results.get(score.measures[i + 1].number)
    if (!current || !next || next.lineNumber <= current.lineNumber) continue

    // EVERY staff is asked, because a clef is per staff: a piano score whose left hand changes to
    // treble across a break must warn on the lower staff and stay silent on the upper. The width,
    // though, is charged ONCE — the courtesies sit at the same x on different staves, so one
    // clef's width covers however many of them there are.
    let anyOnThisMeasure = false
    /** The widest courtesy clef any staff draws here — they sit at one x, so the bar pays once. */
    let widestCautionaryClef: Clef = 'treble'

    staffIds.forEach((staffId, staffIndex) => {
      const clefs = clefsByStaff.get(staffId)
      if (!clefs) return

      // The next line opens here; warn only if the clef actually changes across
      // the break (its opening clef differs from this measure's ending clef).
      const nextOpeningClef = clefs.opening.get(next.measureNumber) || 'treble'
      if (nextOpeningClef === clefs.ending.get(current.measureNumber)) return
      // …and only when the change ALLOWS one. Keyed by the measure the change starts at, like the
      // meter's: which bar ends a system moves on every reflow, and the author's decision must not.
      if (!cautionaryClefAllowedOf(score, score.measures[i + 1].id, keyStaffId(staffIndex, staffId))) return

      current.cautionaryEndClefs ??= []
      current.cautionaryEndClefs[staffIndex] = nextOpeningClef
      if (cautionaryExtent({ clef: nextOpeningClef }) > cautionaryExtent({ clef: widestCautionaryClef })) {
        widestCautionaryClef = nextOpeningClef
      }
      anyOnThisMeasure = true
    })

    if (!anyOnThisMeasure) continue
    const cautionaryClefPx = cautionaryExtent({ clef: widestCautionaryClef }) * STAFF_SPACE_PX
    current.minWidth += cautionaryClefPx
    // …and the FLOOR with it: a courtesy clef is overhead, not note space, so it is not room the
    // justifier may take back.
    if (current.floorWidth !== undefined) current.floorWidth += cautionaryClefPx
    linesToRedistribute.add(current.lineNumber)
  }

  // Re-distribute each affected line so the reserved width shrinks note spacing
  // rather than overflowing the margin.
  for (const lineNumber of linesToRedistribute) {
    const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
    distributeLineWidths(lineMeasures, availableWidth)
  }
}

/**
 * Add a cautionary (courtesy) time signature to the last measure of any line
 * whose *next* line opens with a meter change. The warning shows the upcoming
 * time signature just before the line break, after the final barline (standard
 * engraving). Drawn FULL size, unlike the cautionary clef.
 *
 * Runs after line assignment, so it reserves width on the affected measure and
 * re-distributes that line only — line membership is never changed (no re-wrap).
 */
function applyCautionaryTimeSignatures(
  score: Score,
  results: Map<number, MeasureWidthInfo>,
  availableWidth: number
): void {
  const linesToRedistribute = new Set<number>()

  for (let i = 0; i < score.measures.length - 1; i++) {
    const current = results.get(score.measures[i].number)
    const next = results.get(score.measures[i + 1].number)
    if (!current || !next || next.lineNumber <= current.lineNumber) continue

    // The next line opens here; warn only when it actually begins a meter change
    // (same condition that draws the TS glyph at the new line's start).
    const nextMeasure = score.measures[i + 1]
    if (!nextMeasure.timeSignatureChange) continue
    // …and only when the change ALLOWS one. The two halves of the rule meet here: the flag belongs
    // to the change, this loop supplies the other half (does that change open a system). Keyed by
    // the measure the change starts at, not by this one — which bar ends a system moves every time
    // the music reflows, and the author's decision must not move with it.
    if (!cautionaryAllowedOf(score, nextMeasure.id)) continue

    current.cautionaryEndTimeSig = nextMeasure.timeSignature
    const cautionaryMeterPx = cautionaryExtent({ meter: nextMeasure.timeSignature }) * STAFF_SPACE_PX
    current.minWidth += cautionaryMeterPx
    // Overhead, like the cautionary clef above — the floor rises with it.
    if (current.floorWidth !== undefined) current.floorWidth += cautionaryMeterPx
    linesToRedistribute.add(current.lineNumber)
  }

  for (const lineNumber of linesToRedistribute) {
    const lineMeasures = [...results.values()].filter(m => m.lineNumber === lineNumber)
    distributeLineWidths(lineMeasures, availableWidth)
  }
}

/** The width fields pass 1 reasons about — so the bar it is *considering* can be asked the same
 *  questions as the bars already on the line, before it is an info with a line number. */
export type SqueezableWidth = Pick<MeasureWidthInfo, 'minWidth' | 'naturalWidth' | 'floorWidth' | 'userSpace' | 'stretchSpace'>

/** Has the user asked this bar to be wider than it naturally is? Then it is claiming room from the
 *  rest of its line — and is itself exempt from paying for anyone else's claim. */
function claimsRoom(info: SqueezableWidth): boolean {
  return info.naturalWidth !== undefined && info.minWidth > info.naturalWidth + 1e-9
}

/**
 * The narrowest a bar can be made while it still holds its music: its floor, plus the authored
 * space that is reserved off the top and never squeezed. What pass 1 asks to decide whether a
 * line can absorb a growing bar or has to break.
 *
 * **A bar that is itself being grown is not squeezable at all** — being wide is the whole point of
 * it, so it counts for its full `minWidth`. Without that a grown bar would be measured at its own
 * floor and the line would happily accept many more bars beside it.
 */
export function squeezedWidth(info: SqueezableWidth): number {
  if (claimsRoom(info)) return info.minWidth
  return (info.floorWidth ?? info.minWidth) + Math.max(0, info.stretchSpace ?? 0) + (info.userSpace ?? 0)
}

/**
 * Is a bar on this line being GROWN? Only then may its neighbours be pushed below the width they
 * ask for — the rule as he put it, and the difference between "the empty bars get out of the way"
 * and "every bar on the page is permanently narrow".
 *
 * ⚠️ **A bar stretch counts; an authored leading space does NOT** — the same split the two pools
 * make everywhere else in this file. A stretch is *live music room*: "give this bar more of the
 * line", which is exactly a claim on the neighbours. A leading space is a *dead gap* that genuinely
 * needs the room it asks for, and note spacing states as a design property that it reaches the
 * break pass (docs/note-spacing-plan.md §2 — "a space is not an offset, it has width"). Letting it
 * squeeze instead of wrap silently repealed that.
 *
 * A *shrink* does not count either: it hands room back rather than taking it, and a line of
 * deliberately narrowed bars should re-wrap to hold more, not squeeze the rest. That is why this
 * reads `claimsRoom` (`stretch > 1`) and not the reserved pool — an EMPTY bar's growth never
 * reaches `stretchSpace` at all.
 */
function lineIsClaimingRoom(line: MeasureWidthInfo[], incoming: SqueezableWidth): boolean {
  return claimsRoom(incoming) || line.some(claimsRoom)
}

/**
 * Linear view's break policy: there isn't one. Every measure lands on line 0 at its intrinsic
 * width — never break, never justify (docs/linear-view-plan.md §P1). Only the very first
 * measure opens a line, so only it carries a full clef; every later measure pays the smaller
 * mid-line clef-change width, and only when the clef actually changes across the barline.
 *
 * No cautionary clef/TS pass: those are drawn at line breaks, and there are none — they
 * self-disable rather than being suppressed.
 */
function calculateLinearMeasureWidths(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
): Map<number, MeasureWidthInfo> {
  const results = new Map<number, MeasureWidthInfo>()

  score.measures.forEach((measure, index) => {
    const { minWidth, userSpace, stretchSpace, noteSpace, overhead, stretchScalesShare, floorWidth, naturalWidth } = measureWidthParts(score, measure, index === 0, clefsByStaff)

    results.set(measure.number, {
      measureNumber: measure.number,
      minWidth,
      userSpace,
      stretchSpace,
      noteSpace,
      overhead,
      stretchScalesShare,
      floorWidth,
      naturalWidth,
      finalWidth: minWidth, // intrinsic width + authored space/stretch — nothing to justify to
      lineNumber: 0,
    })
  })

  return results
}

/** Everything about the *view* that the casting-off depends on. The score and its clefs are the
 *  two required arguments; these are the knobs, and they are named rather than positional because
 *  a fifth `, undefined, true` at a call site says nothing about what it turns on. */
export interface MeasureWidthOptions {
  mode?: ViewMode
  /**
   * ⚠️ **Accepted and NOT consulted, since P2 of the spacing model.** The memo existed for the
   * VexFlow `Formatter`, which is no longer in the width path at all — see
   * {@link noteSpaceForMeasure}, which explains why fingerprinting a measure now costs more than
   * the arithmetic it would save. It stays on the API because P3 puts it back: measuring real ink
   * extents makes this expensive again, and the renderer's cache is already wired to arrive here.
   */
  cache?: MeasureWidthCache
  justifyLastLine?: boolean
  /**
   * The **surface** the music is being cast off onto (`engine/layout/surface.ts`). Only
   * `contentWidthPx` is read here — the room between the margins, which is the one number the
   * two-pass layout has ever needed. Defaults to the sketch canvas, i.e. the 960 px this has
   * always worked in.
   */
  surface?: SurfaceMetrics
}

/**
 * Calculate widths for all measures using a two-pass algorithm.
 * Pass 1: Calculate minimum widths and group into lines.
 * Pass 2: Distribute available space proportionally within each line.
 *
 * In `linear` mode both passes are skipped — see {@link calculateLinearMeasureWidths}. Note that
 * the linear branch returns **before** the surface is read at all: linear view is a canvas whose
 * width policy is "as wide as the music", so no bar there is ever cast off against a width.
 */
export function calculateMeasureWidths(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  options: MeasureWidthOptions = {},
): Map<number, MeasureWidthInfo> {
  const { mode = 'wrapped', justifyLastLine = false, surface = resolveSurface(SKETCH_CANVAS) } = options
  if (mode === 'linear') return calculateLinearMeasureWidths(score, clefsByStaff)

  const results = new Map<number, MeasureWidthInfo>()
  const availableWidth = surface.contentWidthPx

  // Pass 1: Calculate minimum widths and assign to lines
  let currentLine = 0
  /** The line's capacity so far, in ASKED-FOR-UNGROWN width — see the `fits` test below. */
  let currentLineNatural = 0
  let currentLineMeasures: MeasureWidthInfo[] = []

  for (const measure of score.measures) {
    const isFirstInLine = currentLineMeasures.length === 0
    const { minWidth, userSpace, stretchSpace, noteSpace, overhead, stretchScalesShare, floorWidth, naturalWidth } = measureWidthParts(score, measure, isFirstInLine, clefsByStaff)

    const incoming = { minWidth, naturalWidth, floorWidth, userSpace, stretchSpace }
    // **How many bars fit is decided GROWTH-BLIND** — on `naturalWidth`, what each bar would ask
    // for at stretch 1. With nothing grown that is `minWidth` and this is the rule it has always
    // been (same bars per system, same default page). With something grown it is what stops the
    // growth from rewriting the casting-off: measure on `minWidth` and a grown bar pushes a
    // neighbour to the next system before anything gives way; measure on `floorWidth` and a grown
    // bar *recruits* bars onto its line, 23 empty ones where 9 belong. Growing a bar means neither.
    let fits = currentLineNatural + naturalWidth <= availableWidth
    // …but the line still has to be ABLE to hold it once everything gives what it can. This is what
    // re-wraps a system under a big stretch, and the order matters: the neighbours are squeezed
    // first, and the line breaks only when even their floors will not fit.
    if (fits && lineIsClaimingRoom(currentLineMeasures, incoming)) {
      const squeezedTotal = currentLineMeasures.reduce((sum, m) => sum + squeezedWidth(m), 0)
      fits = squeezedTotal + squeezedWidth(incoming) <= availableWidth
    }
    if (!fits && currentLineMeasures.length > 0) {
      // Finalize current line
      distributeLineWidths(currentLineMeasures, availableWidth)
      for (const info of currentLineMeasures) {
        results.set(info.measureNumber, info)
      }

      // Start new line
      currentLine++
      currentLineNatural = 0
      currentLineMeasures = []

      // Recalculate width for new line (first-in-line gets a full clef, so a
      // clef change is absorbed into the line-start clef — no extra width)
      const newParts = measureWidthParts(score, measure, true, clefsByStaff)

      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth: newParts.minWidth,
        userSpace: newParts.userSpace,
        stretchSpace: newParts.stretchSpace,
        noteSpace: newParts.noteSpace,
        overhead: newParts.overhead,
        stretchScalesShare: newParts.stretchScalesShare,
        floorWidth: newParts.floorWidth,
        naturalWidth: newParts.naturalWidth,
        finalWidth: newParts.minWidth,
        lineNumber: currentLine,
      }
      currentLineMeasures.push(info)
      currentLineNatural = newParts.naturalWidth
    } else {
      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth,
        userSpace,
        stretchSpace,
        noteSpace,
        overhead,
        stretchScalesShare,
        floorWidth,
        naturalWidth,
        finalWidth: minWidth,
        lineNumber: currentLine,
      }
      currentLineMeasures.push(info)
      currentLineNatural += naturalWidth
    }
  }

  // Finalize last line — the one line that may be left RAGGED.
  //
  // Justifying it stretches a half-empty final system across the page, which is what Finale and
  // Sibelius do and what this always did. LilyPond's `ragged-last` is true by default and MuseScore
  // makes it a setting, because a last system of one bar spread over the whole width reads as a
  // mistake rather than as music. Both are legitimate; which one you want is a matter of taste, so
  // it is a knob (view state — see `VexFlowRenderer.layoutStateKey`).
  //
  // ⚠️ Ragged means ragged-RIGHT, never ragged past the margin. A last line whose bars already ask
  // for more than the page has (a stretched bar, an authored space) is still distributed — the
  // squeeze is what keeps it inside the page, and skipping it would push music through the right
  // edge. So the knob only ever declines to ADD space.
  if (currentLineMeasures.length > 0) {
    const asked = currentLineMeasures.reduce((sum, m) => sum + m.minWidth, 0)
    if (justifyLastLine || asked > availableWidth) {
      distributeLineWidths(currentLineMeasures, availableWidth)
    }
    // Left ragged, each bar keeps the `finalWidth: minWidth` it was built with — the width it asks
    // for, which is exactly what linear view draws.
    for (const info of currentLineMeasures) {
      results.set(info.measureNumber, info)
    }
  }

  applyCautionaryClefs(score, clefsByStaff, staffIdsOf(score, clefsByStaff), results, availableWidth)
  applyCautionaryTimeSignatures(score, results, availableWidth)

  return results
}
