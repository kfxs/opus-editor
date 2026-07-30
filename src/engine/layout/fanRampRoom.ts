import type { Fraction } from '@/types/music'
import { fracEq } from '@/utils/fraction'
import type { Column } from './spacing'

/**
 * ⭐ **THE ROOM THE BAR ACTUALLY GAVE A FAN'S RAMP** — first member column to last, as the column
 * solve placed them.
 *
 * A fan reserves room like anything else: `measureColumns` adds a column per member beat, and the
 * spring solve stretches those gaps by the same force it stretches every other gap in the bar. What
 * was missing is the other half — nothing SPENT that answer. A fanned slot is one `StaveNote`, so
 * there is no tick context at a member's beat and `spacingPass` cannot write the member x's; the
 * ramp therefore built itself from its members' own durations alone and the bar's extra width piled
 * up as air after the last head. Widen a bar by dragging its barline and everything in it spread —
 * except the fan, which is what he reported.
 *
 * So this reads the same numbers back out: the distance between the fan's FIRST and LAST member
 * columns, in staff spaces, exactly as solved. `FannedBeam` scales its earned ramp to fit that, and
 * the fan spreads with the bar because it is answering the bar's own solve rather than a second
 * rule.
 *
 * ⚠️ **A RATIO'S WORTH OF TRUTH, not the final positions.** The solved x's do NOT include the
 * authored spaces (`measureColumns` writes `authored: 0` on every column and `applyLeadingSpaces`
 * shifts contexts *after* the solve) nor a member's authored offset. That is why this returns one
 * SPAN and not a position per member: the span is the elastic part, which is precisely the part the
 * ramp is allowed to share out — an authored nudge still comes off the top and keeps its whole
 * width (`FanGeometryOptions.memberSpaces`).
 *
 * ⚠️ It is also NOT the fan's licence to fill whatever follows. `spanEndX` remains the hard clamp
 * (the next note's ink, less any space authored before it), so a bar that could not pay still
 * compresses the group and the space bought by dragging the note AFTER a fan still lands where he
 * asked it to — between the group and that note.
 */
export function fanRampRoomSpaces(
  columns: Column[],
  xs: number[],
  /** The fan's member beats, member 0 (the slot's own beat) first — `utils/fannedBeam.fanMemberBeats`. */
  memberBeats: Fraction[],
): number | undefined {
  if (memberBeats.length < 2 || columns.length !== xs.length) return undefined

  const xAt = (beat: Fraction): number | undefined => {
    const i = columns.findIndex(column => fracEq(column.beat, beat))
    return i === -1 ? undefined : xs[i]
  }

  const first = xAt(memberBeats[0])
  const last = xAt(memberBeats[memberBeats.length - 1])
  // A member beat with no column of its own means this is not the solve that placed this fan (a
  // stale pass, another lane's bar). Answering a number from half a match would be worse than
  // answering none: the ramp's own durations are a sound fallback, and silence is how it asks for it.
  if (first === undefined || last === undefined) return undefined

  const room = last - first
  return room > 0 ? room : undefined
}
