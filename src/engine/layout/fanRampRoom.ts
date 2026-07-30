import type { Fraction, FanMark, Measure } from '@/types/music'
import { fracAdd, fracEq, fracLt, fracSub } from '@/utils/fraction'
import { fanMembers } from '@/utils/fannedBeam'
import { slotLength } from '@/utils/durations'
import { INK, MIN_COLUMN_GAP } from './spacingPadding'
import { followingSpace, type Column } from './spacing'

/**
 * ⭐⭐ **HOW WIDE A FAN'S RAMP IS, and how much of the bar's room it gets** — the two halves of one
 * question, kept in one module so the RESERVATION and the DRAWING cannot disagree.
 *
 * ⭐ **A FAN'S MEMBERS ARE NOT COLUMNS. The ramp is the slot's own INK.** They used to be columns —
 * `measureColumns` added one per member beat, which bought the room but bought it for the whole
 * SYSTEM, since a column is one x on every staff (that is the rule, and his own report). So a fan on
 * the upper staff dictated where the lower staff's notes fell: sixteen even sixteenths under an
 * `accel.`+`rit.` pair came out at gaps of 21.5, 21.5, 36.3, 36.3, 21.5, … — perfectly regular music
 * drawn unevenly, because each member beat wedged into their grid at an accelerating rational.
 *
 * His rule, and the model this file states: *"the source of truth in the time space is the staff
 * below, not the staff above — but both should look nice"*. The fan's OWNER is a real point in the
 * grid (its slot's beat, its slot's duration, one column like any other note). What the members are
 * is the ink that column carries to its right — a group of noteheads occupying the room after it.
 *
 * That keeps everything the columns bought:
 *  - ink is a FLOOR in the spring solve, so a bar still cannot crush a fan, and a dense one still
 *    makes its bar wider — which is the case `534dcc4` fixed (a collapsed passage drawn as wide as
 *    the notes it came from);
 *  - the room the solve actually granted is still readable back ({@link fanRampRoomSpaces}), so the
 *    ramp stretches with a widened bar;
 *  - and the other staves get their own even grid, because the fan adds no columns to it.
 */

/**
 * The ramp's natural size, in STAFF SPACES: how far the members reach right of the owner's notehead,
 * and how much of that reach is the TAIL nothing may be drawn in.
 *
 * `ramp` is the spacing rule applied to each member's own duration — the very sum `FannedBeam` lays
 * the heads out with (there in px), so the room asked for is the room spent. `tail` is the last
 * member's own head, which is ink like any other: the next column has to clear it.
 */
export function fanRampSpaces(fan: FanMark, slotLength: Fraction): { ramp: number; tail: number } {
  const members = fanMembers(fan, slotLength)
  let ramp = 0
  for (let k = 0; k + 1 < members.length; k++) ramp += followingSpace(members[k].quarters)
  return { ramp, tail: INK.notehead }
}

/**
 * ⭐⭐ **THE RAMP'S WIDTH, HANDED TO THE GAPS IT CROSSES** — one number per gap of the bar's grid, in
 * staff spaces, for `Column.minGap`.
 *
 * A fan's members fall on rationals nobody else in the system shares, so they are not columns; but
 * they are ink, and the room they need is spread over however many gaps of the grid their slot spans.
 * So each gap is handed the width of the members that cross IT: the spacing rule over exactly those
 * members, plus the last one's head where the fan's own time runs out.
 *
 * ⭐ That is the general shape his rule asks for — *"some music will be fixed in the time-space of
 * the score and other elements not"*. Fixed music makes columns. Unfixed music makes demands on the
 * gaps it crosses, and the two meet in the solve without either having to know about the other.
 */
export function fanSpanDemands(measure: Measure, positions: Fraction[]): number[] {
  const demands = positions.map(() => 0)
  for (const slot of measure.slots) {
    if (slot.type !== 'chord' || !slot.fan) continue
    const length = slotLength(slot)
    const end = fracAdd(slot.beat, length)

    // The gaps this fan's own time crosses, and what the grid already gives them.
    const span: number[] = []
    let natural = 0
    for (let k = 0; k + 1 < positions.length; k++) {
      if (fracLt(positions[k + 1], slot.beat) || !fracLt(positions[k], end)) continue
      span.push(k)
      natural += followingSpace(fracSub(positions[k + 1], positions[k]))
    }
    if (!span.length || !(natural > 0)) continue

    // ⭐⭐ **A DEMAND ON THE SPAN, SHARED BY WHAT EACH GAP ALREADY EARNS** — never a demand per member.
    //
    // Per member it lumped at the fan's dense end: an `accel.` crowds its last members into one gap
    // of the grid, so that gap alone was floored wide and the staff below came out uneven all over
    // again (25.1 against 21.5, measured — better than the 36.3 the columns gave, and still wrong).
    //
    // ⭐ The ramp needs its width ACROSS ITS OWN TIME, not inside any one gap of somebody else's grid.
    // So: if the grid already spans at least that much, ask for NOTHING — the fan fits into the music
    // around it, which is his rule (*"the source of truth in the time space is the staff below"*). If
    // it does not, every gap in the span grows by the same factor, so the bar opens EVENLY rather
    // than at the fan's dense end.
    const { ramp, tail } = fanRampSpaces(slot.fan, length)
    const wanted = ramp + tail
    if (natural >= wanted) continue
    const force = wanted / natural
    for (const k of span) {
      demands[k] = Math.max(demands[k], followingSpace(fracSub(positions[k + 1], positions[k])) * force)
    }
  }
  return demands
}

/**
 * ⭐ **THE ROOM THE BAR ACTUALLY GAVE THIS RAMP**, in staff spaces — read back off the solved
 * columns so the drawing can spend exactly what the reservation earned.
 *
 * The fan holds ONE column, so the room is the gap from it to **where its own duration ends** — and
 * the ramp takes its SHARE of that, its natural size over the gap's natural size.
 *
 * ⚠️ **To the END OF THE SLOT, not to the next column.** The columns are the SYSTEM's, so the next one
 * may belong to another staff a sixteenth later — and measuring to that gave a fan sharing a grand
 * staff a sixteenth's worth of room, which crushed every member into the left of its own half note
 * (his screenshot, mid-change). A fan occupies its written value like any other note; the room it may
 * spend runs to the end of that value.
 *
 * ⭐ The denominator is the whole natural gap: the ramp, plus the last member's head and the ordinary
 * note↔note padding after it ({@link MIN_COLUMN_GAP} is exactly that pair). So at a bar's natural
 * width — where the ink floor is what binds — the share comes out at the ramp's own size, exactly;
 * and a bar stretched ×3 hands the ramp ×3, exactly. The ratio IS the force the solve applied, which
 * is the whole reason to read it back rather than re-derive it.
 *
 * ⚠️ Undefined when the fan's own beat has no column, or is the last one: that is not this bar's
 * solve, and answering a number from half a match would be worse than answering none — the ramp's
 * own durations are a sound fallback, and silence is how it asks for them.
 */
export function fanRampRoomSpaces(
  columns: Column[],
  xs: number[],
  /** The fanned slot's own beat — its column, and the grid point his rule keeps. */
  slotBeat: Fraction,
  fan: FanMark,
  slotLength: Fraction,
): number | undefined {
  if (columns.length !== xs.length) return undefined
  const i = columns.findIndex(column => fracEq(column.beat, slotBeat))
  if (i === -1 || i + 1 >= columns.length) return undefined

  // Where the slot's own time is up — the first column at or after it, which is the barline when
  // nothing follows in the bar. Never itself, so a zero-length answer is impossible.
  const endBeat = fracAdd(slotBeat, slotLength)
  const endIndex = columns.findIndex((column, k) => k > i && !fracLt(column.beat, endBeat))
  const gap = xs[endIndex === -1 ? columns.length - 1 : endIndex] - xs[i]
  if (!(gap > 0)) return undefined

  const { ramp } = fanRampSpaces(fan, slotLength)
  const natural = ramp + MIN_COLUMN_GAP
  if (!(natural > 0)) return undefined
  return gap * (ramp / natural)
}
