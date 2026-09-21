/**
 * ⭐⭐ **A HEAD WRITTEN ON ANOTHER STAFF, as the renderer sees it** — docs/plans/cross-staff-plan.md
 * Phase 2. The score says WHICH staff (`NotePitch.displayStaffId`, `engine/models/crossStaffOps`);
 * this module turns that into the two facts a note is engraved from: the CLEF the head is read in
 * there, and how many staff lines that staff stands above the note's own (`KeyRow.lift`).
 *
 * Two halves, in the order a render meets them:
 *
 * 1. {@link attachCrossStaffNeighbours} — once the staves of one measure have their y's, each bar
 *    holding a crossed head is told where its neighbours stand. ⭐ The staff gap is an INPUT here
 *    (`layout/staffStride` + the spacing override), known before a note is built — which is why
 *    there is no second pass of the kind Verovio (`AdjustCrossStaffYPos`) and MuseScore
 *    (`updateCrossBeams`) carry.
 * 2. {@link crossingResolver} — what `NoteBuilder` asks per head.
 *
 * ⚠️ **Equal staff SIZES only.** The lift is counted in the home staff's spaces and the head is
 * drawn inside the home bar's scaled group, so a head crossing onto a staff of another size lands
 * on the right line at the wrong size. ⏭️ Written down, not solved (plan, "Open").
 */
import type { Chord, Clef, Fraction, NotePitch } from '@/types/music'
import type { KeyCrossing } from '@/engine/engrave/notes/keyLines'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { fracCompare, fracLte } from '@/utils/fraction'
import type { CrossStaffNeighbour, MeasurePlacement } from './renderTypes'

/**
 * Fill {@link MeasurePlacement.crossStaff} on every bar of ONE measure that holds a crossed head.
 * `bars` are that measure's placements, one per staff; `staffIds` names them in the same order.
 * A bar with no crossed head is left without the field — which is every bar of every score so far.
 */
export function attachCrossStaffNeighbours(
  bars: Array<Pick<MeasurePlacement, 'view' | 'y' | 'clef' | 'crossStaff'>>,
  staffIds: readonly (string | undefined)[],
): void {
  for (const bar of bars) {
    const wanted = new Set<string>()
    for (const slot of bar.view.slots) {
      if (slot.type !== 'chord') continue
      for (const pitch of slot.notes) if (pitch.displayStaffId !== undefined) wanted.add(pitch.displayStaffId)
    }
    if (wanted.size === 0) continue
    const neighbours: CrossStaffNeighbour[] = []
    for (const staffId of wanted) {
      const other = bars[staffIds.indexOf(staffId)]
      // An id naming no staff of this score: the head is drawn at HOME (`crossStaffOps` reports it).
      if (!other || other === bar) continue
      neighbours.push({ staffId, dy: other.y - bar.y, clef: other.clef, clefs: other.view.clefs ?? [] })
    }
    if (neighbours.length) bar.crossStaff = neighbours
  }
}

/** The clef a neighbour reads in at `beat` — its opening clef, then each change up to the beat. */
function clefAt(neighbour: CrossStaffNeighbour, beat: Fraction): Clef {
  let clef = neighbour.clef
  for (const change of [...neighbour.clefs].sort((a, b) => fracCompare(a.beat, b.beat))) {
    if (fracLte(change.beat, beat)) clef = change.clef
  }
  return clef
}

/**
 * What `NoteBuilder` asks for each head: `undefined` for a head on its own staff (every head but a
 * crossed one), else where it is written. `scale` is the home bar's own — the bar draws inside a
 * group carrying it, so a page distance is that many times smaller in the note's frame.
 */
export function crossingResolver(
  neighbours: CrossStaffNeighbour[] | undefined,
  scale: number,
): ((slot: Chord, pitch: NotePitch) => KeyCrossing | undefined) | undefined {
  if (!neighbours?.length) return undefined
  return (slot, pitch) => {
    const neighbour = neighbours.find(n => n.staffId === pitch.displayStaffId)
    if (!neighbour) return undefined
    // Up the page is a smaller y and a HIGHER line, hence the sign.
    return { clef: clefAt(neighbour, slot.beat), lift: -neighbour.dy / scale / STAFF_SPACE_PX }
  }
}
