import { Voice, Formatter } from 'vexflow'
import type { Score, Measure, Clef } from '@/types/music'
import { fracCompare, fracIsZero } from '@/utils/fraction'
import { type StaffClefs } from '@/utils/clefUtils'
import { getStaves, staffMeasureView } from '@/engine/models/staffContent'
import { measureCapacityFrac } from '@/utils/musicUtils'
import { laneColumns } from '@/utils/fannedBeam'
import { cautionaryAllowedOf, cautionaryClefAllowedOf, keyStaffId, measureUserSpacePx, measureStretch } from '../models/engravingOverrides'
import { LAYOUT_CONFIG, type MeasureWidthInfo, type ViewMode } from './layoutConfig'
import { laneFingerprint, type MeasureWidthCache } from './MeasureWidthCache'
import { renderCensus } from '@/dev/renderCensus' // TEMPORARY — the §9 layout-breakdown probes
import {
  createStaveNotesFromSlots,
  makeClefResolver,
  createTupletsForMeasure,
  chooseVoiceMode,
  drawsTimeSignature,
} from './NoteBuilder'

/**
 * Measure-width math — the two-pass proportional layout that decides each measure's
 * minimum/final width and which line it lands on, plus the cautionary clef/TS width
 * reservations at line breaks.
 *
 * Pure over `(score, clefsByStaff)`: holds no renderer state and writes no
 * per-render lookup maps. It does build throwaway VexFlow voices and uses
 * `Formatter.preCalculateMinTotalWidth`, so it is NOT framework-agnostic — it
 * quarantines that VexFlow coupling rather than removing it. The note-building it
 * needs comes from {@link ./NoteBuilder}.
 */

/** The note area a lane gets when it holds nothing at all, and the floor under a bar of pure
 *  silence — an empty bar should not collapse to the width of its one rest glyph. */
export const EMPTY_LANE_NOTE_SPACE = 40

/**
 * The horizontal space **one staff's lane** needs for its notes — the expensive half of the
 * width calc, and the only half that depends on the staff.
 *
 * `laneView` is a {@link staffMeasureView}: the measure narrowed to one staff, so its slots,
 * clefs and tuplets are that staff's only. Voices *within* the lane are still grouped and
 * formatted together — a two-voice bar must reserve room for both interleaved streams.
 *
 * Memoized on the lane's content when a cache is given (P2). This is the ONLY expensive step in
 * the layout, and it is exactly the one that doesn't change when you edit some other bar — so
 * with a cache the formatter runs on the measure you touched and on nothing else. The overhead
 * (clefs, meter, line position) deliberately stays outside the memo: see {@link MeasureWidthCache}.
 */
function noteSpaceForLane(laneView: Measure, clef: Clef, cache?: MeasureWidthCache): number {
  // A lane is empty when it holds NO SLOTS. It used to ask "no chords?", which called a bar of
  // rests empty: eight eighth-rests were measured as an empty bar and drew crammed on top of each
  // other, narrower than a bar holding ONE whole rest (reported, with a screenshot). That was true
  // while an all-rest bar could only ever be a single auto-filled measure rest; the rest tool made
  // bars of authored rests and the assumption broke.
  if (laneView.slots.length === 0) return EMPTY_LANE_NOTE_SPACE
  const hasNotes = laneView.slots.some(s => s.type === 'chord')

  // TEMPORARY probes — the §9 question (see renderCensus.layoutSub). `recording` is false in every
  // ordinary session, so this is one boolean read, not a clock call.
  const probing = renderCensus.recording
  const t0 = probing ? performance.now() : 0
  const key = cache ? laneFingerprint(laneView) : undefined
  if (probing) renderCensus.layoutSub('fingerprint', performance.now() - t0)
  if (key !== undefined) {
    const hit = cache!.get(key)
    renderCensus.layoutCacheProbe(hit !== undefined)
    if (hit !== undefined) return hit
  }
  const tFormat = probing ? performance.now() : 0

  const sorted = [...laneView.slots].sort((a, b) => fracCompare(a.beat, b.beat))
  const clefResolver = makeClefResolver(laneView, clef)
  const capacity = measureCapacityFrac(laneView)
  const voiceIds = [...new Set(sorted.map(s => s.voice ?? 0))].sort((a, b) => a - b)

  const voices = voiceIds.map(v => {
    const slots = sorted.filter(s => (s.voice ?? 0) === v)
    const sn = createStaveNotesFromSlots(slots, clefResolver)
    // Create VexFlow Tuplets BEFORE adding notes to voice (adjusts tick values)
    createTupletsForMeasure(laneView, slots, sn)
    const voice = new Voice({
      numBeats: laneView.timeSignature.numerator,
      beatValue: laneView.timeSignature.denominator,
    }).setMode(chooseVoiceMode(slots, capacity))
    voice.addTickables(sn)
    return voice
  })

  try {
    const formatter = new Formatter()
    formatter.joinVoices(voices)
    const minNoteWidth = formatter.preCalculateMinTotalWidth(voices)

    // Safety buffer (15%), floored at a minimum spacing per EVENT — and the floor is what actually
    // spaces music: VexFlow's own minimum is ~9px an event, far too tight to read, so this is the
    // number that decides how wide a bar is. It counted CHORDS, so rests earned no space at all and
    // a bar of them collapsed. A rest occupies a beat exactly as a note does.
    //
    // 🚨 COLUMNS, not slots: a FANNED slot is drawn as `fan.count` noteheads across its own span
    // (docs/fanned-beams-plan.md §3), so it claims that many events' worth of room. One slot's 18px
    // for six heads is the silent version of this bug — the formatter's own answer above cannot see
    // the fan either, because the fan is drawn by us and not by VexFlow.
    const minSpacingWidth = laneColumns(laneView.slots) * LAYOUT_CONFIG.MIN_NOTE_SPACING
    // …and a bar of pure SILENCE keeps its presence: one whole rest formats to less than this, and
    // an empty bar should not collapse to the width of its one glyph. Only for lanes with no notes,
    // though — as a floor on EVERY lane it clamps small bars and hides real differences (it swallowed
    // the ~1px an accidental adds to a two-note bar, which the width control tests caught at once).
    const silenceFloor = hasNotes ? 0 : EMPTY_LANE_NOTE_SPACE
    const noteSpace = Math.max(minNoteWidth * 1.15, minSpacingWidth, silenceFloor)
    if (key !== undefined) cache!.set(key, noteSpace)
    if (probing) renderCensus.layoutSub('format', performance.now() - tFormat)
    return noteSpace
  } catch (error) {
    console.warn(`Could not calculate width for measure ${laneView.number}:`, error)
    return EMPTY_LANE_NOTE_SPACE
  }
}

/**
 * Minimum width of a measure — **the max over its staves**, not the sum of them.
 *
 * A measure spans every staff (they share barlines), so its width is the width of its *widest*
 * staff. The old code poured every staff's notes into one voice set and formatted them together,
 * which is both wrong (it engraves a width nobody asked for — a 25-staff bar reserved room for
 * 25 staves' notes interleaved into one imaginary stream) and the reason layout cost scaled with
 * the staff axis: the formatter was fed N× the notes. See docs/render-performance-plan.md §3.
 *
 * The clef terms live *inside* the max because a clef is per-staff (staff 1 may change clef where
 * staff 2 does not). The time-signature and barline padding are shared by every staff, so they sit
 * outside it.
 *
 * Returns **two** numbers, not one: the clamped total the layout casts off on, and — beside it —
 * the widest lane's *note space alone*, which is what a bar stretch multiplies (client #11,
 * docs/bar-width-plan.md §2). The extra max costs nothing (same loop), and the two maxima may
 * legitimately land on different staves: `noteSpace` is "the most room any lane's music needs",
 * which is exactly what a stretch stretches. The overhead is deliberately NOT in it — a bar pays a
 * full clef only while it opens a line, so a stretch over the overhead would buy a different number
 * of pixels after every re-wrap.
 */
function calculateMinimumMeasureWidth(
  score: Score,
  measure: Measure,
  isFirstInLine: boolean,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  cache?: MeasureWidthCache,
): { total: number; noteSpace: number; overhead: number; spacingFloor: number } {
  // Shared by every staff: the barline padding, and the meter glyph where one is drawn
  // (measure 1 + changes).
  let sharedOverhead = LAYOUT_CONFIG.BARLINE_PADDING * 2
  if (drawsTimeSignature(measure)) sharedOverhead += LAYOUT_CONFIG.TIME_SIG_WIDTH

  const staffIds = staffIdsOf(score, clefsByStaff)

  // At N=1 the lane IS the measure (every slot matches the only staff), so skip the filter —
  // it would copy four arrays per measure per render to arrive back at what it was given.
  const single = staffIds.length === 1

  let widest = 0
  let widestNoteSpace = 0
  let widestOverhead = 0
  // The incompressible part of the note area: `MIN_NOTE_SPACING` per column, the same rule
  // `noteSpaceForLane` floors its answer with — counted the same way (per SLOT, so two voices at one
  // beat count twice) precisely BECAUSE that is how the width was built. Count columns properly here
  // and the floor could exceed the width it is a floor on, making a two-voice bar incompressible. A
  // lane with no slots still gets one column: something is drawn there.
  // ⚠️ Which is also why `laneColumns` — the fan's extra columns — has to be applied to BOTH: it
  // widens the number above, so a floor still counting raw slots would no longer be the same rule.
  let widestSpacingFloor = 0
  for (const staffId of staffIds) {
    // TEMPORARY probe — see renderCensus.layoutSub.
    const tView = renderCensus.recording ? performance.now() : 0
    const lane = single ? measure : staffMeasureView(measure, staffId, score)
    if (renderCensus.recording) renderCensus.layoutSub('laneView', performance.now() - tView)
    const staffClefs = clefsByStaff.get(staffId)
    const clef = staffClefs?.opening.get(measure.number) ?? 'treble'

    // This staff's own clef overhead. A line-opening measure draws a full clef on every staff;
    // mid-line, a staff draws a small clef only where ITS clef changes across the barline — i.e.
    // differs from the previous measure's *ending* clef (a mid-measure change already showed its
    // clef inline in that measure).
    let clefOverhead = 0
    if (isFirstInLine) {
      clefOverhead += LAYOUT_CONFIG.CLEF_WIDTH
    } else {
      const prevEndClef = measure.number > 1
        ? staffClefs?.ending.get(measure.number - 1)
        : undefined
      if (prevEndClef !== undefined && clef !== prevEndClef) {
        clefOverhead += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
      }
    }
    // Each mid-measure (inline) clef change on THIS staff draws its own small clef.
    const midClefs = (lane.clefs ?? []).filter(c => !fracIsZero(c.beat)).length
    clefOverhead += midClefs * LAYOUT_CONFIG.CLEF_CHANGE_WIDTH

    const noteSpace = noteSpaceForLane(lane, clef, cache)
    widest = Math.max(widest, noteSpace + clefOverhead)
    widestNoteSpace = Math.max(widestNoteSpace, noteSpace)
    widestOverhead = Math.max(widestOverhead, clefOverhead)
    widestSpacingFloor = Math.max(widestSpacingFloor, Math.max(1, laneColumns(lane.slots)) * LAYOUT_CONFIG.MIN_NOTE_SPACING)
  }

  const totalWidth = widest + sharedOverhead
  return {
    total: Math.min(
      Math.max(totalWidth, LAYOUT_CONFIG.MIN_MEASURE_WIDTH),
      LAYOUT_CONFIG.MAX_MEASURE_WIDTH,
    ),
    noteSpace: widestNoteSpace,
    overhead: widestOverhead + sharedOverhead,
    spacingFloor: widestSpacingFloor,
  }
}

/**
 * Is this a bar nobody has written into — one rest per staff sitting in the middle, and nothing
 * else? It decides which way a stretch acts on the bar (see {@link measureWidthParts}).
 *
 * ⚠️ **Asked of the CONTENT, never of a measured width.** The first version asked whether the bar's
 * note space had come out at the {@link EMPTY_LANE_NOTE_SPACE} floor — which compares a number the
 * *formatter* produced. Under jsdom the text metrics are stubbed to zero, so every empty bar
 * measured 40 and the tests were green; in a real browser a whole rest measures wider than that, the
 * bar was classified as having music, and the feature silently did nothing. A structural question
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
  cache?: MeasureWidthCache,
): { minWidth: number; userSpace: number; stretchSpace: number; noteSpace: number; stretchScalesShare: boolean; floorWidth: number; naturalWidth: number } {
  const empty = isEmptyBar(measure)
  const parts = calculateMinimumMeasureWidth(score, measure, isFirstInLine, clefsByStaff, cache)
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
  // engraver's own floor of `MIN_NOTE_SPACING` per column. **An empty bar has no music to set one.**
  // Its width comes from `MIN_MEASURE_WIDTH` and the `EMPTY_LANE_NOTE_SPACE` floor — defaults, not
  // content — so the user asking for it to be narrow is asking to overrule a default, and it should
  // give way completely. Hence: fold the stretch INTO the intrinsic (so the share moves with it) and
  // reserve nothing.
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
    const scaled = Math.max(LAYOUT_CONFIG.MIN_NOTE_SPACING, scalable * stretch)
    return {
      minWidth: overhead + scaled + userSpace,
      userSpace,
      stretchSpace: 0, // nothing reserved — the stretch IS the share
      noteSpace: scalable, // what the multiplier multiplies, so px↔ratio still converts
      stretchScalesShare: true,
      floorWidth: floorOf(overhead + scaled),
      naturalWidth: stretch >= 1 ? overhead + scalable + userSpace : overhead + scaled + userSpace,
    }
  }

  const stretchSpace = noteSpace * (stretch - 1)
  return {
    minWidth: intrinsic + userSpace + stretchSpace,
    userSpace,
    stretchSpace,
    noteSpace,
    stretchScalesShare: false,
    floorWidth: floorOf(intrinsic),
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
  // `natural × room / total` IS the old formula written shorter: `n + (room − T)·n/T` collapses to
  // it. So an untouched line comes out pixel-identical to what it always did, in both directions
  // (this one expression replaces the old squeeze/stretch branch pair).
  const widths = new Map(measureInfos.map(m => [m, naturalOf(m) * room / totalNatural]))

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
      anyOnThisMeasure = true
    })

    if (!anyOnThisMeasure) continue
    current.minWidth += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
    // …and the FLOOR with it: a courtesy clef is overhead, not note space, so it is not room the
    // justifier may take back.
    if (current.floorWidth !== undefined) current.floorWidth += LAYOUT_CONFIG.CLEF_CHANGE_WIDTH
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
    current.minWidth += LAYOUT_CONFIG.TIME_SIG_WIDTH
    // Overhead, like the cautionary clef above — the floor rises with it.
    if (current.floorWidth !== undefined) current.floorWidth += LAYOUT_CONFIG.TIME_SIG_WIDTH
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
  cache?: MeasureWidthCache,
): Map<number, MeasureWidthInfo> {
  const results = new Map<number, MeasureWidthInfo>()

  score.measures.forEach((measure, index) => {
    const { minWidth, userSpace, stretchSpace, noteSpace, stretchScalesShare, floorWidth, naturalWidth } = measureWidthParts(score, measure, index === 0, clefsByStaff, cache)

    results.set(measure.number, {
      measureNumber: measure.number,
      minWidth,
      userSpace,
      stretchSpace,
      noteSpace,
      stretchScalesShare,
      floorWidth,
      naturalWidth,
      finalWidth: minWidth, // intrinsic width + authored space/stretch — nothing to justify to
      lineNumber: 0,
    })
  })

  return results
}

/**
 * Calculate widths for all measures using a two-pass algorithm.
 * Pass 1: Calculate minimum widths and group into lines.
 * Pass 2: Distribute available space proportionally within each line.
 *
 * In `linear` mode both passes are skipped — see {@link calculateLinearMeasureWidths}.
 */
export function calculateMeasureWidths(
  score: Score,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  mode: ViewMode = 'wrapped',
  cache?: MeasureWidthCache,
  justifyLastLine = false,
): Map<number, MeasureWidthInfo> {
  if (mode === 'linear') return calculateLinearMeasureWidths(score, clefsByStaff, cache)

  const results = new Map<number, MeasureWidthInfo>()
  const margin = LAYOUT_CONFIG.MARGIN
  const availableWidth = LAYOUT_CONFIG.CONTAINER_WIDTH - (margin * 2)

  // Pass 1: Calculate minimum widths and assign to lines
  let currentLine = 0
  /** The line's capacity so far, in ASKED-FOR-UNGROWN width — see the `fits` test below. */
  let currentLineNatural = 0
  let currentLineMeasures: MeasureWidthInfo[] = []

  for (const measure of score.measures) {
    const isFirstInLine = currentLineMeasures.length === 0
    const { minWidth, userSpace, stretchSpace, noteSpace, stretchScalesShare, floorWidth, naturalWidth } = measureWidthParts(score, measure, isFirstInLine, clefsByStaff, cache)

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
      const newParts = measureWidthParts(score, measure, true, clefsByStaff, cache)

      const info: MeasureWidthInfo = {
        measureNumber: measure.number,
        minWidth: newParts.minWidth,
        userSpace: newParts.userSpace,
        stretchSpace: newParts.stretchSpace,
        noteSpace: newParts.noteSpace,
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
