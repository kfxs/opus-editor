/**
 * ⭐⭐ **WHAT AN OUTSIDE-STAFF FAMILY HAS ALREADY TAKEN** — the accumulator an OUTER family reads so
 * it can clear an INNER one, and the whole of the "ladder" that `docs/above-staff-ladder.md` §1(3)
 * describes as a priority number elsewhere.
 *
 * P0a of docs/ottava-plan.md. `./inkBand` answers *how far does the MUSIC reach*; this answers *and
 * what has been put there since*. An outer family merges the two and calls
 * {@link clearanceBaseline} exactly as it does today — so nothing here is a second placement rule,
 * it is a wider input to the one that exists.
 *
 * ## ⛔⛔ It is NOT a row in `./measureColumns`' ink, and that distinction is the module
 *
 * The first draft of the ottava plan said the dynamics line should "become a row in the ink model".
 * `Column.ink` is `./spacing`'s `inkFloor` input — **the WIDTH's** — and putting a placed mark in it
 * breaks two things at once:
 *
 * - **bar widths change**, because a mark that costs no horizontal room starts claiming some. That
 *   is the exact distinction `rendering/MeasureRedrawKey.ts` calls "the classic way to get this
 *   wrong": the width key *pointedly excludes dynamics, because a `mf` costs no width*;
 * - **it is circular** — `dynamicsLineAt` derives its y from `staffInkBand` over those same columns,
 *   so the line would be clearing itself.
 *
 * ⭐ So this is a SECOND, LATER collection: seeded by nothing, appended to by each family **as it is
 * placed**, and read only by families placed after it. The ORDER of the ladder is therefore the
 * order the passes already run in — ⛔ **there is no priority-number table here and there must never
 * be one**, which is `docs/above-staff-ladder.md` §2's argument surviving intact.
 *
 * ## The two axes, because mixing them is what this kind of module gets wrong
 *
 * **Horizontal: ABSOLUTE QUARTER-BEATS from the score's start** ({@link measureStartOffsets}) — the
 * same axis `rendering/dynamicsLinePlan.ts` already levels chains on, and it is shared rather than
 * re-derived so two families cannot disagree about where bar 7 begins. ⛔ **Not pixels.** A pixel x
 * is in one system's coordinates and is scaled by its staff's size; a beat is neither, and every
 * producer and consumer here knows its own musical extent already.
 *
 * **Vertical: `InkBox`'s axis** — staff spaces BELOW the top stave line, top line 0, bottom 4, above
 * the staff negative. Identical to {@link InkBand}, so a music band and an occupied band merge with
 * {@link mergeInkBands} and no conversion.
 *
 * ## Lifetime
 *
 * ⛔ **No module-level state**, the rule every layout module here states about itself. The collection
 * is one array created per render (`RenderPass.occupiedBands`) and thrown away with it — the
 * arrangement `RenderPass.solvedColumns` already uses for the same reason: the writer and the reader
 * are different passes, several steps apart, and neither calls the other.
 */
import type { Fraction, Score } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { measureStartOffsets as measureStarts } from '@/utils/measureCapacity'
import { mergeInkBands, type InkBand, type MarkInk, type StaffSide } from './inkBand'

/**
 * One placed family's claim on the space outside a staff: *this much of this system, on this side,
 * is taken down to here*.
 *
 * ⚠️ **`line` is part of the identity, not decoration.** A wedge split over a system break is two
 * claims in two places (`dynamicsLinePlan` keys its fragments `id@line` for the same reason), and a
 * claim on system 2 must be invisible to a mark on system 1 even though the two share every beat of
 * their bars' numbering.
 */
export interface OccupiedSpan {
  /** The system it was placed on. */
  line: number
  /** The staff it was placed against — a `StaffInfo` id, `undefined` for the first staff. */
  staffId: string | undefined
  /** Which side of that staff. */
  side: StaffSide
  /** Start, in absolute quarter-beats from the score's start ({@link measureStartOffsets}). */
  from: Fraction
  /** End, same axis. Equal to `from` for a mark standing at one point (a `p`, a tempo word). */
  to: Fraction
  /** What it occupies vertically, in the staff's own spaces on `InkBox`'s axis. */
  band: InkBand
}

/**
 * Cumulative quarter-beat offset of each measure's start — **the shared horizontal axis**.
 *
 * Lives here rather than in any one family's module because it is the axis claims are STATED on:
 * two marks either side of a barline, or in different families, can only be compared on one, and a
 * second copy of this walk is a second answer to where bar 7 begins.
 *
 * (It was `rendering/dynamicsLinePlan.ts`'s private helper first, where chaining needed exactly this
 * and nothing else did.)
 */
export const measureStartOffsets = (score: Score): Map<number, Fraction> =>
  measureStarts(score.measures)

/**
 * What a mark sitting on `baseline` actually occupies, from the ink extents it reports either side
 * of that baseline.
 *
 * ⚠️ Both of {@link MarkInk}'s numbers name a DIRECTION and are positive; the axis here is
 * downward-positive. So the mark's top is `baseline - above` and its bottom `baseline + below`,
 * whichever side of the staff it is on — the side changed where the baseline landed, not which way
 * the glyph grew from it.
 */
export function markBand(baseline: number, ink: MarkInk): InkBand {
  return { top: baseline - ink.above, bottom: baseline + ink.below }
}

/**
 * ⭐ **THE READ.** Everything already placed on this `(line, staff, side)` that overlaps the beats
 * `[from, to]`, merged into one band — `null` when nothing has been.
 *
 * The caller merges it with the music's own band ({@link staffInkBand}) and hands the result to
 * {@link clearanceBaseline}; that is the entire consumer side, and it is why this module has no
 * placement rule of its own.
 *
 * ⚠️⚠️ **The staff comparison is normalised through `firstStaffId`, for `staffInkBand`'s reason** —
 * a claim recorded against the first staff may carry `undefined` while the consumer knows that staff
 * by its real id (or the reverse), and a strict comparison would silently return `null`: the outer
 * family would then draw straight through the inner one, on exactly the scores that have staff ids.
 *
 * ⭐ **Overlap is CLOSED, so touching counts.** A letter is a point (`from === to`) and a half-open
 * test would make it invisible to every consumer; and for a clearance question, counting a mark that
 * merely abuts the span errs by pushing the outer family further out, which is the safe direction.
 */
export function bandOver(
  occupied: readonly OccupiedSpan[],
  line: number,
  staffId: string | undefined,
  side: StaffSide,
  from: Fraction,
  to: Fraction,
  firstStaffId: string | undefined,
): InkBand | null {
  const wanted = staffId ?? firstStaffId
  let band: InkBand | null = null
  for (const entry of occupied) {
    if (entry.line !== line || entry.side !== side) continue
    if ((entry.staffId ?? firstStaffId) !== wanted) continue
    // Closed-interval overlap: `entry.from <= to && from <= entry.to`.
    if (fracCompare(entry.from, to) > 0 || fracCompare(from, entry.to) > 0) continue
    band = mergeInkBands(band, entry.band)
  }
  return band
}
