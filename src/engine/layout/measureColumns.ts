/**
 * A measure's COLUMNS — the bridge from the music to the spacing rule (docs/spacing-model-plan.md
 * P2). Pure: a `Measure` in, {@link Column}s out, no VexFlow and no DOM.
 *
 * ⭐⭐ **A column is a rhythmic position at which something starts, holding every event that starts
 * there — across all voices AND all staves.** One x per column, shared by every staff in the system.
 * That sentence is the whole module, and it is what makes this a *merge* rather than the
 * max-over-staves the width used to take: staff 1's `♩♩♩♩` under staff 2's `𝅗𝅥𝅗𝅥` is four columns, not
 * four-or-two whichever is wider, and a note at beat 2 on both staves is ONE position that must be
 * paid for once.
 *
 * ⚠️ **Two voices at the same beat are ONE column**, which is a visible change on every piano score:
 * the width path used to count SLOTS, so a two-voice bar of `♩♩♩♩` over `♩♩♩♩` claimed 8 columns and
 * now claims 4. One x per beat is the whole point of the model, and the narrowing is the model
 * working — but it is the thing to look at by eye first (plan §P2).
 *
 * ⭐ **A FAN's members are ordinary columns.** `fanMemberBeats` already gives each an exact rational,
 * and that address is the same one the drawing, playback and rebar all use — so a fanned group asks
 * the bar for the room its heads actually take, with no constant of its own. This is what makes
 * `fanColumns`, `FAN_MAX_SPAN_STRETCH` and the rest of §2's list redundant rather than merely
 * unfashionable; P5 deletes them.
 *
 * ⛔ **It does NOT model rest-fill, and does not need to**: `ScoreModel` fills a bar's silent spans
 * with real rest slots, so every drawn column is already in `measure.slots`. The one exception is a
 * bar holding no slots at all, which draws a single measure rest — one column, at beat 0.
 */
import type { Measure, Fraction, ChordRest, NotePitch, Clef } from '@/types/music'
import { fracCompare, fracCreate, fracIsZero, fracSub } from '@/utils/fraction'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fanSpanRods } from './fanRampRoom'
import { displayedAccidentals } from '@/utils/accidentalState'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { voiceOf } from '@/utils/lanes'
import { beamRoleAt, isBeamableDuration } from '@/utils/beaming'
import { getMeterInfo } from '@/utils/meter'
import { staffLineForSpelling, type StaffClefs } from '@/utils/clefUtils'
import { INK, INK_HEIGHT, STEM_REACH, accidentalExtent, accidentalHeight, dotExtent, pairPadding, restBand, restExtent } from './spacingPadding'
import { edgeKind, mergedReach, type InkBox } from './kerning'
import type { Column } from './spacing'

/** Canonical key for an exact beat — `fracCreate` reduces, so equal beats stringify equally. */
const beatKey = (beat: Fraction): string => `${beat.num}/${beat.den}`

/**
 * A column's ink: every drawn piece at that rhythmic position, **located** — each box's reach either
 * side of the column's x plus the vertical band it occupies (`layout/kerning.ts`).
 *
 * ⭐ It used to be one merged reach per edge (`{left, right, leftKind, rightKind}`), which is all the
 * width needs while ink is treated as a solid column of stuff. It cannot answer *"is this accidental
 * clear of that notehead"*, so the pieces are kept apart and the merge became a projection
 * ({@link mergedReach}) — one source, no second representation to disagree with the first.
 *
 * ⚠️ A column holds every voice AND staff at its beat, so its boxes come from several slots and each
 * carries the staff it was measured on.
 */
type ColumnInk = InkBox[]

/** A box as the builders below write it — in the staff's OWN spaces, before {@link sized}. */
type RawInk = Omit<InkBox, 'size'>[]

/**
 * ⭐ **The one place a staff's SIZE enters the spacing model.** A staff drawn at 0.7 has 0.7 of the
 * ink, so it asks for 0.7 of the room: every reach is multiplied here, once, and everything
 * downstream reads system staff spaces without knowing a size exists.
 *
 * ⛔ The BAND (`top`/`bottom`) is deliberately not touched — it is measured in the staff's own spaces
 * and only ever compared with another band on the same staff (`kerning.sameBand`).
 *
 * The rule and its sources (LilyPond skylines, Verovio's `staffSize/100`, GUIDO's rods) are in
 * docs/staff-size-plan.md §6a: the SPINE is global and size-blind, only the INK is per staff — and
 * because `inkFloor` refuses to compare boxes across staves, a column shared by a small staff and a
 * big one takes the big one's demand for free.
 */
function sized(boxes: RawInk, size: number): ColumnInk {
  if (size === 1) return boxes.map(box => ({ ...box, size }))
  return boxes.map(box => ({ ...box, size, left: box.left * size, right: box.right * size }))
}

/** ⭐ The vertical axis the boxes are on: staff spaces BELOW the top stave line, so the top line is 0,
 *  the middle 2, the bottom 4 — and a note above the staff is negative. `staffLineForSpelling` counts
 *  the other way (1 = bottom, 5 = top), which is the whole of the conversion. */
const yOfLine = (line: number): number => 5 - line

/** Which way the stem of this slot points — the same answer the drawing reaches, because the stem is
 *  what decides most kerning questions and a guess in the wrong direction unblocks a space that has a
 *  stem in it. Explicit first, then the multi-voice convention (odd voices up, even down), then
 *  Gould's rule about the middle line. */
function stemUp(slot: ChordRest, clef: Clef, multiVoice: boolean): boolean {
  if (slot.type === 'chord' && slot.stemDirection) return slot.stemDirection === 'up'
  const voice = voiceOf(slot)
  if (multiVoice) return voice % 2 === 1
  if (slot.type !== 'chord') return true
  const positions = (slot.notes ?? []).map(pitch => spellingDiatonicPos(pitch.step, pitch.octave))
  const outer = positions.length > 0 ? Math.max(...positions) : 0
  return staffLineForSpelling(
    (slot.notes ?? [])[positions.indexOf(outer)]?.step ?? 'B',
    (slot.notes ?? [])[positions.indexOf(outer)]?.octave ?? 4,
    clef,
  ) < 3
}

/**
 * Does a pitch sit far enough off the staff to be drawn on a ledger line?
 *
 * `staffLineForSpelling` counts the five stave lines 1–5 from the clef's own middle, so a ledger is
 * needed at ≥ 6 or ≤ 0 — the bound `restSupportingLedgerLine` states in the same words.
 */
const needsLedger = (pitch: NotePitch, clef: Clef): boolean => {
  const line = staffLineForSpelling(pitch.step, pitch.octave, clef)
  return line <= 0 || line >= 6
}

/**
 * What ONE slot draws, in staff spaces from its notehead x.
 *
 * ⚠️ `signs` is resolved by the caller through `displayedAccidentals`, never from `alter`: whether a
 * sharp is *drawn* is the running-accidental rule's answer, and a bar of four C♯s draws one sign and
 * three bare heads. Reading `alter` here would reserve room for three accidentals that never appear.
 *
 * ⚠️ **And `clef` is why this function reads where a note SITS**, which used to be forbidden in the
 * width path — see {@link measureColumns} for why that rule expired.
 */
function slotInk(slot: ChordRest, signs: Map<string, string | null>, clef: Clef, multiVoice: boolean, flagged: boolean, size: number): ColumnInk {
  const staff = slot.staffId
  if (slot.type !== 'chord') {
    // ⭐ A rest's band is its own, at last (`restBand`, docs/font-metrics-plan.md §3.4). It used to
    //   be the WHOLE STAFF — the honest answer while the extents were unknown, and a maximally
    //   conservative one. ⚠️ Nothing kerns against a rest yet (`MAY_KERN` has no rest row), so this
    //   moves no width; it makes the question askable.
    const band = restBand(slot.duration)
    return sized([{ left: 0, right: restExtent(slot.duration), ...band, kind: 'rest', staff }], size)
  }

  const pitches: NotePitch[] = slot.notes ?? []
  const drawn = pitches
    .map(pitch => ({ position: spellingDiatonicPos(pitch.step, pitch.octave), sign: signs.get(pitch.id) }))
    .filter((entry): entry is { position: number; sign: string } => typeof entry.sign === 'string')
  const accidental = accidentalExtent(drawn)

  // A SECOND in the chord displaces one head a full notehead to the side — Gould's rule, and the
  // one place a chord is wider than a single note without any modifier being involved.
  const positions = pitches.map(pitch => spellingDiatonicPos(pitch.step, pitch.octave)).sort((a, b) => a - b)
  const hasSecond = positions.some((position, i) => i > 0 && position - positions[i - 1] === 1)
  // ⚠️ TWO quantities, and they were one row until F2 (docs/font-metrics-plan.md §3.1a): the second
  //    head is DISPLACED by `secondDisplacement` — the head's ink less half the stem they share —
  //    and then draws its own full `notehead` of ink from there. ⛔ Not `2 × notehead`, which would
  //    count the shared stem twice the moment the ink row takes the font's 1.18.
  const heads = hasSecond ? INK.secondDisplacement + INK.notehead : INK.notehead
  const overhang = INK.ledgerRight - INK.notehead
  const dots = dotExtent(slot.dots ?? 0)

  const boxes: RawInk = []
  const lineOf = (pitch: NotePitch) => staffLineForSpelling(pitch.step, pitch.octave, clef)

  for (const pitch of pitches) {
    const y = yOfLine(lineOf(pitch))
    boxes.push({ left: 0, right: heads, top: y - INK_HEIGHT.notehead, bottom: y + INK_HEIGHT.notehead, kind: 'note', staff })

    // ⭐ A LEDGER LINE overhangs its notehead on BOTH sides — 1.80 spaces against a head's 1.13. Under
    //   a displaced chord it runs beneath both heads, so it is an overhang past the heads rather than
    //   a width of its own. Its BAND is the run from the note back to the staff, because that is where
    //   the lines are: one per line crossed, not one at the notehead.
    if (needsLedger(pitch, clef)) {
      const edge = y < 0 ? 0 : 4
      boxes.push({
        left: INK.ledgerLeft,
        right: heads + overhang,
        top: Math.min(y, edge) - INK_HEIGHT.ledger,
        bottom: Math.max(y, edge) + INK_HEIGHT.ledger,
        kind: 'ledger',
        staff,
      })
    }

    if (dots > 0) {
      boxes.push({ left: 0, right: dots, top: y - INK_HEIGHT.dot, bottom: y + INK_HEIGHT.dot, kind: 'dot', staff })
    }
  }

  // ⭐ Each DRAWN sign gets its own box at its own pitch — the point of the exercise, since a low
  //   accidental clearing a high notehead is the case kerning exists for.
  //
  // ⚠️ Every sign is given the whole chord's accidental reach rather than its own column's. That
  //    over-reserves for a chord whose signs stack into two columns, and it is the safe direction: a
  //    sign that cannot kern then asks for the room the drawing actually uses, and one that CAN kern
  //    is skipped entirely, so the surplus never reaches the picture.
  for (const { position, sign } of drawn) {
    const pitch = pitches.find(p => spellingDiatonicPos(p.step, p.octave) === position)
    if (!pitch) continue
    const y = yOfLine(lineOf(pitch))
    const height = accidentalHeight(sign)
    boxes.push({ left: accidental, right: 0, top: y - height.up, bottom: y + height.down, kind: 'accidental', staff })
  }

  // ⭐ THE STEM — no width of its own (it stands at the notehead's right edge), and the piece that
  //   decides most kerning questions. ⛔ A WHOLE note has none, and a BEAMED note's stem runs to a beam
  //   whose height is not a width-time fact, so that one is treated as reaching the far side of the
  //   staff: decline the kern rather than draw ink through ink.
  if (slot.duration !== 'w' && pitches.length > 0) {
    const lines = pitches.map(lineOf)
    const up = stemUp(slot, clef, multiVoice)
    const fromY = yOfLine(up ? Math.max(...lines) : Math.min(...lines))
    // A stem always reaches at least the middle line (y = 2), which for a note just outside the staff
    // is the same statement as `STEM_REACH`.
    const beamed = isBeamableDuration(slot.duration) && !flagged
    const tipY = beamed
      ? (up ? Math.min(0, fromY - STEM_REACH) : Math.max(4, fromY + STEM_REACH))
      : (up ? Math.min(2, fromY - STEM_REACH) : Math.max(2, fromY + STEM_REACH))
    boxes.push({
      left: 0,
      right: heads,
      top: Math.min(fromY, tipY),
      bottom: Math.max(fromY, tipY),
      kind: 'stem',
      staff,
    })

    // ⭐⭐ THE FLAG — the last piece of drawn ink the model could not see. It hangs from the stem TIP
    //   back toward the notehead ({@link INK_HEIGHT.flagFromTip}), and an UP flag is the one that buys
    //   room: its stem stands at the head's RIGHT edge, so the glyph reaches `INK.flagReach` past it.
    //   A DOWN flag's stem is at the head's LEFT edge, so its ink lands inside the head's own width.
    //
    // ⚠️ **Only where one is DRAWN**, which is `flagged` — the beaming rule's answer, not a guess from
    //    the duration. Counting a flag on every eighth is precisely the old ink path's error, and it is
    //    what made an eighth measure wider than a quarter (research §6).
    if (flagged) {
      boxes.push({
        left: 0,
        right: up ? INK.notehead + INK.flagReach : heads,
        top: up ? tipY : tipY - INK_HEIGHT.flagFromTip,
        bottom: up ? tipY + INK_HEIGHT.flagFromTip : tipY,
        kind: 'flag',
        staff,
      })
    }
  }

  return sized(boxes, size)
}

/**
 * Which clef governs a slot — its staff's, at its beat. Supplied by the caller because resolving it
 * needs the whole score's clef inheritance, which this module deliberately does not import.
 */
export type ClefResolver = (slot: ChordRest) => Clef

/**
 * ⭐ How big the staff a slot is on is DRAWN (1 = full size) — the model's one size input.
 *
 * Supplied by the caller for the same reason {@link ClefResolver} is: resolving it needs the whole
 * score (and, one day, the system), which this module does not import. Defaults to 1 everywhere, so
 * a caller that has no sizes gets exactly the arithmetic it got before this existed.
 */
export type StaffSizeResolver = (staffId: string | undefined) => number

/**
 * Every column in this measure, in order, with the BARLINE as the last one.
 *
 * ## ⚠️ THE CLEF IS AN INPUT NOW, and it used to be forbidden
 *
 * `reference_spacing_rules_must_be_clef_independent` and `MeasureLayout.clefWidthIndependence
 * .test.ts` both said a bar's width may not read where a note SITS. That rule rested on two claims,
 * and both have expired:
 *
 *  1. **Cost.** With the clef in the width-cache key, changing one clef re-ran the VexFlow formatter
 *     on every later bar — 293 ms, 47% of all layout time, and again on every mouse-move of a drag.
 *     ⭐ There is no formatter and no memo in this path any more (P2): re-widthing 260 bars is now a
 *     walk over their slots, well under a millisecond.
 *  2. **"A clef cannot change the answer."** It could not, while the ink was a notehead and an
 *     accidental — a clef moves every head the same distance *vertically*, and accidental stacking
 *     depends on the notes' relative positions. ⭐ **LEDGER LINES broke that**: whether a note has
 *     one is a fact about where it sits, it is 0.67 spaces of ink wider than a bare head, and under
 *     an octave clef the same notes need a different number of them.
 *
 * So the claim is now simply false, and holding the invariant would mean drawing ledger lines
 * through each other — which is what it was doing. The SHAPE key already carries the clef
 * (`MeasureRedrawKey`), so incremental redraw was never the thing at risk.
 *
 * The barline is a column like any other: it has a position, it can carry ink, and the gap before it
 * is the same question as every other gap. That is what turns `BARLINE_PADDING` from a constant into
 * a row in P3's pair table (note↔barline, rest↔barline).
 *
 * ⚠️ Each column's `duration` is **the distance to the NEXT column, not the event's own written
 * value** — so under a two-voice bar where voice 2 has an eighth beneath voice 1's quarter, the
 * quarter's column earns an eighth's space. It is still a quarter and still drawn as one; space
 * belongs to the gap, not to the notehead.
 */
/**
 * ⭐ How much room the bar owes BEFORE its first column — the lead-in, in staff spaces.
 *
 * Two things nobody was paying for, and they are the same thing:
 *
 * 1. **The gap after the barline.** `BARLINE_PADDING` reserved a flat 1 space at each end of every
 *    bar. The end is now the barline COLUMN's business (`note↔barline`, `rest↔barline`), so that
 *    constant was double-counting the trailing side and guessing the leading one.
 * 2. **⚠️ The FIRST column's own left extent, which the width never counted at all.**
 *    {@link naturalWidth} sums the gaps BETWEEN columns, so `columns[0].extent.left` appears in no
 *    gap: an accidental on a bar's first note bought exactly no room, and the drawing made room for
 *    it anyway out of everything else in the bar. That is one of the two ways an accidental was
 *    "stealing space from the notes" (his report, measured on his own fragment).
 *
 * ⏭️ What this does NOT decide is where the first note is actually DRAWN. VexFlow starts a bar's
 * notes 1.7 staff spaces in (5 px of stave start + a 12 px `Stave.padding`), whatever we reserve,
 * and moving that is the renderer taking over x — P4.
 */
export function measureLeadIn(
  measure: Measure,
  clefFor: ClefResolver = () => 'treble',
  sizeFor: StaffSizeResolver = () => 1,
): LeadIn {
  const opening = openingInk(measure, clefFor, sizeFor)
  return { padding: pairPadding('barline', edgeKind(opening, 'left')), extent: mergedReach(opening).left }
}

/**
 * The lead-in, in two parts — because its two readers need different halves of it.
 *
 * ⚠️ **The WIDTH reserves `padding + extent`; the DRAWING positions on `padding` alone.** VexFlow's
 * formatter already shifts a bar's first tick context right by that column's own left ink, so a
 * renderer that also moved the stave's note-start by `extent` would pay for the accidental twice —
 * which is exactly what the first version of this did, and the blank came out WIDER than before.
 */
export interface LeadIn {
  /** `barline↔note` (or ↔accidental, ↔rest): the blank owed between the line and the first ink. */
  padding: number
  /** How far left of its notehead the first column reaches — an accidental, or a ledger line. */
  extent: number
}

/** The ink of whatever the bar opens with — every slot at its earliest beat. */
function openingInk(measure: Measure, clefFor: ClefResolver, sizeFor: StaffSizeResolver): ColumnInk {
  const first = measure.slots.reduce<Fraction | null>(
    (earliest, slot) => (earliest === null || fracCompare(slot.beat, earliest) < 0 ? slot.beat : earliest),
    null,
  )
  if (first === null) return [MEASURE_REST_INK()]

  const signs = displayedSigns(measure)
  const multiVoice = hasSeveralVoices(measure)
  const flagged = flaggedSlots(measure)
  const boxes: ColumnInk = []
  for (const slot of measure.slots) {
    if (fracCompare(slot.beat, first) !== 0) continue
    boxes.push(...slotInk(slot, signs, clefFor(slot), multiVoice, flagged.has(slot.id), sizeFor(slot.staffId)))
  }
  return boxes
}

/** The one rest an untouched bar draws, as ink — a band over the whole staff, since nothing kerns
 *  against a rest and its drawn position is not a width-time fact. */
const MEASURE_REST_INK = (): InkBox =>
  // Size 1: this is the bar NOBODY has written into, so there is no staff whose size to ask. The
  // moment a bar holds slots, every box goes through `sized` with its own staff's.
  ({ left: 0, right: restExtent('w'), top: 0, bottom: 4, kind: 'rest', staff: undefined, size: 1 })

/**
 * ⭐ **Which slots DRAW A FLAG** — by slot id, resolved the way the drawing resolves it: per LANE
 * (staff + voice), because a beam group is a run inside one voice of one staff.
 *
 * A flag is drawn on a flaggable duration that no beam claims — `beamRoleAt` answering `'single'`. ⛔
 * Not derivable from `slot.beam`: `auto` means *nobody authored anything*, and on four auto eighths
 * beamed 2+2 every one of them reads `auto` while two begin beams and two end them.
 */
function flaggedSlots(measure: Measure): Set<string> {
  const flagged = new Set<string>()
  const meter = getMeterInfo(measure.timeSignature)
  for (const lane of lanesOf(measure).values()) {
    const ordered = [...lane].sort((a, b) => fracCompare(a.beat, b.beat))
    ordered.forEach((slot, index) => {
      if (slot.type !== 'chord' || !isBeamableDuration(slot.duration)) return
      if (beamRoleAt(ordered, meter, index) === 'single') flagged.add(slot.id)
    })
  }
  return flagged
}

/** The measure's slots grouped by LANE — `staffId:voice`, the scope a beam group and a running
 *  accidental are both resolved in. */
function lanesOf(measure: Measure): Map<string, ChordRest[]> {
  const lanes = new Map<string, ChordRest[]>()
  for (const slot of measure.slots) {
    const key = `${slot.staffId ?? ''}:${voiceOf(slot)}`
    const lane = lanes.get(key) ?? []
    lane.push(slot)
    lanes.set(key, lane)
  }
  return lanes
}

/** Does this measure hold more than one voice? The stem convention depends on it (voice 1 up, voice 2
 *  down), and the stem is what decides whether a following accidental may tuck. */
function hasSeveralVoices(measure: Measure): boolean {
  const voices = new Set(measure.slots.map(voiceOf))
  return voices.size > 1
}

/**
 * Which sign each pitch of this measure actually DRAWS — resolved PER LANE, exactly as the drawing
 * resolves it: one `displayedAccidentals` walk per (staff, voice), because that is the scope
 * `NoteBuilder` uses when it decides. Ask it at any other scope and the width reserves room for an
 * accidental the drawing suppresses, or forgets one it shows.
 */
function displayedSigns(measure: Measure): Map<string, string | null> {
  const signs = new Map<string, string | null>()
  for (const lane of lanesOf(measure).values()) {
    const ordered = [...lane].sort((a, b) => fracCompare(a.beat, b.beat))
    for (const [id, sign] of displayedAccidentals(ordered)) signs.set(id, sign)
  }
  return signs
}

/**
 * ⭐ **Which clef governs each slot** — its own staff's opening clef, moved on by any INLINE clef
 * change on that staff at or before the slot's beat.
 *
 * The width needs it because a LEDGER LINE is ink and whether a note has one is a fact about where it
 * SITS (see the note above on why that stopped being forbidden). An absent `staffId` means the first
 * staff, as everywhere else.
 *
 * ⚠️ **One definition, two readers, and that is the point.** The width path
 * (`MeasureLayout.noteSpaceForMeasure`) and the DRAWING (`spacingPass`, through the renderer) must ask
 * this the same way or they space the same bar differently — which is exactly the bug that put a grand
 * staff's two hands at different x's for the same beat: the renderer was resolving a LANE while the
 * width resolved the MEASURE.
 */
export function clefResolverFor(
  measure: Measure,
  clefsByStaff: Map<string | undefined, StaffClefs>,
  firstStaffId: string | undefined,
): ClefResolver {
  const inline = (measure.clefs ?? []).filter(change => !fracIsZero(change.beat))
  return slot => {
    const staffId = slot.staffId ?? firstStaffId
    let clef = clefsByStaff.get(staffId)?.opening.get(measure.number) ?? 'treble'
    for (const change of inline) {
      if ((change.staffId ?? firstStaffId) !== staffId) continue
      if (fracCompare(change.beat, slot.beat) <= 0) clef = change.clef
    }
    return clef
  }
}

export function measureColumns(
  measure: Measure,
  clefFor: ClefResolver = () => 'treble',
  sizeFor: StaffSizeResolver = () => 1,
): Column[] {
  const capacity = measureCapacityFrac(measure)
  const beats = new Map<string, Fraction>()
  const ink = new Map<string, ColumnInk>()

  const add = (beat: Fraction, drawn?: ColumnInk): void => {
    // At or past the barline is not a column of this bar: the barline itself is the last one, and a
    // ramp that overruns its slot must not mint a column on the far side of it.
    if (fracCompare(beat, capacity) >= 0 || fracCompare(beat, fracCreate(0, 1)) < 0) return
    const key = beatKey(beat)
    if (!beats.has(key)) {
      beats.set(key, beat)
      ink.set(key, [])
    }
    // ⭐ Every slot's boxes are KEPT, not merged into one: a column holds each voice's and each
    //   staff's ink separately so `inkFloor` can ask about them one pair at a time.
    if (drawn) ink.get(key)!.push(...drawn)
  }

  const signs = displayedSigns(measure)
  const multiVoice = hasSeveralVoices(measure)
  const flagged = flaggedSlots(measure)

  for (const slot of measure.slots) {
    add(slot.beat, slotInk(slot, signs, clefFor(slot), multiVoice, flagged.has(slot.id), sizeFor(slot.staffId)))

  }

  // A bar holding nothing still draws a measure rest, and it starts at the beginning.
  if (beats.size === 0) {
    add(fracCreate(0, 1), [MEASURE_REST_INK()])
  }

  const positions = [...beats.values()].sort(fracCompare)
  const inks = positions.map(beat => ink.get(beatKey(beat))!)

  // ⭐ THE BARLINE IS A COLUMN. It has a position, it can carry ink, and the gap before it is the
  //   same question as every other gap — which is what turns `BARLINE_PADDING` from a constant into
  //   two rows in the pair table (note↔barline 1.0, rest↔barline 1.65, because a rest hangs closer
  //   to the line than a notehead does).
  positions.push(capacity)
  // ⛔ A barline's band is the whole staff on purpose: it can never be vertically clear of anything,
  //   so no kerning rule can ever tuck ink through a barline.
  //   Size 1 and it reaches nowhere anyway: a barline belongs to the system, not to a staff.
  inks.push([{ left: 0, right: 0, top: 0, bottom: 4, kind: 'barline', staff: undefined, size: 1 }])

  // ⭐⭐ A FAN'S RAMP IS A ROD OVER THE GAPS IT CROSSES, not a column of its own — see `Column.rod`
  //   and `engine/layout/fanRampRoom.ts`. Computed here, where the final grid is known: the members
  //   fall on rationals nobody else shares, so the ramp's width is imposed as a minimum over the span
  //   its own time covers, and the solve floors those gaps accordingly.
  const rods = fanSpanRods(measure, positions, sizeFor)

  return positions.map((beat, i) => ({
    beat,
    duration: i + 1 < positions.length ? fracSub(positions[i + 1], beat) : fracCreate(0, 1),
    extent: mergedReach(inks[i]),
    // Kept for the columns a FIXTURE builds by hand, which carry no located ink — see `Column.ink`.
    padding: i + 1 < positions.length ? pairPadding(edgeKind(inks[i], 'right'), edgeKind(inks[i + 1], 'left')) : 0,
    ink: inks[i],
    authored: 0,
    rod: rods[i] ?? 0,
  }))
}
