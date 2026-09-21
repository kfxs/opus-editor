/**
 * ⭐ **A CROSSED head's accidental steps clear of the OTHER staff's own accidental** — a draw-time
 * pass, and ⚠️ **a QUICK FIX by his word** (2026-09-21): *"lets try to fix this example and then we
 * can make the review later"*. The review it is owed is the accidental STACK's
 * (`engrave/notes/accidentalStack` — VexFlow's `Accidental.format`, transcribed).
 *
 * 🚨 His report, the Gymnopédie, bar 72: a left-hand chord's F♮4 is written on the TREBLE staff
 * (cross-staff), and the treble's own C♮5 stands in the same column. The two naturals were stamped
 * on one x, overlapping — where the engraving he compared against staggers them, the right hand's
 * sign next to its head and the crossed chord's signs stepping out to the left.
 *
 * ## Why they collided
 *
 * Accidentals are stacked per COLUMN of ONE bar of ONE staff (`format/modifierColumns`): every sign
 * at that tick in that staff's voices is handed to the stack together. A crossed head is drawn on
 * the other staff but still belongs to its HOME bar's voice, so the two signs were stacked by two
 * stacks that never heard of each other, and each took column 1.
 *
 * ## What this does
 *
 * After the home bar is formatted: for each note with a crossed head, look at the notes the
 * DESTINATION staff has at the same beat. Where one of their signs stands within the stack's own
 * clash distance ({@link ACCIDENTAL_CLEARANCE}) of a crossed sign — both lines counted on the same
 * staff, so they compare directly — the crossed note's WHOLE column of signs steps out past it.
 * ⭐ Whole column, the ledger clearance's rule: a per-sign shift would rake a chord's signs apart.
 * The destination staff's own sign keeps the place next to its head.
 *
 * ## ⚠️ What it does NOT do — the review's
 *
 * - It buys no ROOM: the bar's width does not know the signs stepped out (`layout/measureColumns`
 *   prices a crossed head on its home staff), so in a tight bar they can reach the note before.
 * - It needs the destination bar ALREADY BUILT, so it only serves a head crossing to a staff drawn
 *   earlier in the render — upward, the Gymnopédie's case. A head crossed DOWNWARD is not dodged.
 * - One step, not a re-stack: three staggered signs on the destination side are cleared by their
 *   furthest reach, not interleaved with the crossed chord's.
 */
import type { ChordRest, Measure } from '@/types/music'
import { ACCIDENTAL_CLEARANCE, stackAccidentals, type StackedAccidental } from '@/engine/engrave/notes/accidentalStack'
import { fracEq } from '@/utils/fraction'
import { accidentalsOn, type EngravedAccidental } from '../engraved/EngravedAccidental'
import type { EngravedNote } from '../engraved/EngravedNote'

/** A little air between the destination's sign and the crossed column, px. ⚠️ Unsourced — the gap
 *  the stack itself leaves between two columns is what the review should hand this. */
const BETWEEN_COLUMNS_PX = 2

/**
 * @param notes / slots  The home bar's notes and their slots, parallel.
 * @param measure        The WHOLE measure (every staff's slots), ⛔ not the home lane.
 * @param builtNoteOf    A pitch id → the note it was built into, for bars built earlier this render.
 */
export function dodgeDestinationAccidentals(
  notes: readonly EngravedNote[],
  slots: readonly ChordRest[],
  measure: Measure,
  builtNoteOf: (pitchId: string) => EngravedNote | undefined,
): void {
  notes.forEach((note, i) => {
    const slot = slots[i]
    if (!slot || slot.type !== 'chord' || !note.hasCrossedHead()) return
    const props = note.getKeyProps()
    const crossedSigns = accidentalsOn(note).filter(sign => (props[sign.checkIndex()]?.lift ?? 0) !== 0)
    if (crossedSigns.length === 0) return
    const destinationIds = new Set(slot.notes.map(p => p.displayStaffId).filter((id): id is string => id !== undefined))

    let reach = 0
    const theirSigns: { note: EngravedNote; sign: EngravedAccidental }[] = []
    for (const other of measure.slots) {
      if (other === slot || other.type !== 'chord' || !fracEq(other.beat, slot.beat)) continue
      for (const pitch of other.notes) {
        const built = builtNoteOf(pitch.id)
        // ⚠️ "On the destination staff" is asked of what was BUILT there, not of `staffId` (absent on
        //    the first staff): a note that stands on the staff the crossed head is written on has
        //    lift 0 there, and the crossed head's own line is counted on that same staff.
        if (!built || built === note || !standsOnADestination(other, destinationIds, measure)) continue
        const otherProps = built.getKeyProps()
        for (const theirs of accidentalsOn(built)) {
          const theirLine = otherProps[theirs.checkIndex()]?.line
          if (theirLine === undefined) continue
          theirSigns.push({ note: built, sign: theirs })
          const clashes = crossedSigns.some(ours =>
            Math.abs((props[ours.checkIndex()]?.line ?? 0) - theirLine) < ACCIDENTAL_CLEARANCE.default)
          // ⚠️ `getXShift()` of a LEFT modifier is stored NEGATED (`EngravedModifier.setXShift`).
          if (clashes) reach = Math.max(reach, -theirs.getXShift() + theirs.getWidth() + BETWEEN_COLUMNS_PX)
        }
      }
    }
    if (reach <= 0) return
    // ⭐ FIRST CHOICE — ONE stack over both staves' signs, the rule the books draw: the stack's own
    //    zigzag lets a sign an octave under the destination's tuck back into the first column, where
    //    stepping the whole column out would push it a third column away (seen on his bar: the low
    //    C♮ landed on the rest beside it). Taken only when it leaves the destination's signs where
    //    they already stand — that bar is drawn, they cannot move.
    if (restackTogether(note, crossedSigns, theirSigns)) return
    // …else the whole crossed column steps out by the same amount — see the header.
    for (const sign of accidentalsOn(note)) sign.setXShift(-sign.getXShift() + reach)
  })
}

/** A sign as the stack wants it. ⚠️ `line` is DOWN-is-larger, the convention `modifierColumns` hands
 *  the stack on a stave; only differences and order matter, so the key line negated serves. */
const stacked = (note: EngravedNote, sign: EngravedAccidental): StackedAccidental => ({
  line: -(note.getKeyProps()[sign.checkIndex()]?.line ?? 0),
  type: sign.type,
  width: sign.getWidth(),
  displacedRoom: note.getLeftDisplacedHeadPx() - note.getXShift(),
})

/**
 * Stack the destination's signs and the crossed signs as ONE column (`engrave/notes/accidentalStack`)
 * and move the CROSSED ones to where it puts them. Declines — false — when the joint stack would
 * want a destination sign somewhere other than where its own stack already put it.
 *
 * ⚠️ The armed accidental GAP (`placeAccidentals`) has already moved every sign by one common amount;
 * it is read back off the destination's first sign and added to the crossed ones.
 */
function restackTogether(
  note: EngravedNote,
  crossedSigns: readonly EngravedAccidental[],
  theirSigns: readonly { note: EngravedNote; sign: EngravedAccidental }[],
): boolean {
  if (theirSigns.length === 0) return false
  const alone = stackAccidentals(theirSigns.map(t => stacked(t.note, t.sign)), 0).xShifts
  const joint = stackAccidentals(
    [...theirSigns.map(t => stacked(t.note, t.sign)), ...crossedSigns.map(sign => stacked(note, sign))], 0,
  ).xShifts
  if (alone.some((x, i) => Math.abs(x - joint[i]) > 0.01)) return false
  const armedDelta = -theirSigns[0].sign.getXShift() - alone[0]
  crossedSigns.forEach((sign, i) => sign.setXShift(joint[theirSigns.length + i] + armedDelta))
  return true
}

/** Is `slot` a slot of one of the staves these heads are written on? The first staff's slots carry
 *  no `staffId`, so it is the staff whose id NO slot of the measure names. */
function standsOnADestination(slot: ChordRest, destinationIds: ReadonlySet<string>, measure: Measure): boolean {
  if (slot.staffId !== undefined) return destinationIds.has(slot.staffId)
  const named = new Set(measure.slots.map(s => s.staffId).filter((id): id is string => id !== undefined))
  return [...destinationIds].some(id => !named.has(id))
}
