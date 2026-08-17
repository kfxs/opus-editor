/**
 * ⭐⭐ **WHAT THE SLUR HAS TO GET OVER — the notes BETWEEN its two ends.**
 *
 * Every other slur rule we have looks at the two anchored notes and nothing else. That is the gap
 * `docs/slur-plan.md` §11.6 names outright — *"All three have it; we have none"* — and it is what
 * produced his report of 2026-08-17: eight rising quarters, a slur from the 3rd to the 7th, and the
 * arc springing from **beside** the 3rd note's stem while the stems of the notes underneath stood a
 * full 3 staff spaces higher. Nothing in the pipeline had ever been told those notes were there.
 *
 * ## What the three engines encompass, and what they do with it
 *
 * | engine | how the covered ink enters |
 * |---|---|
 * | LilyPond | `get_encompass_info` (`slur-scoring.cc:111-160`) — ONE point per covered column: the **stem tip when that stem points the slur's way, else the outer notehead edge**. Fed to two places: `score_encompass` (a flat **30** demerits per stem the curve fails to clear, **1000** for a head) and `generate_avoid_offsets`, which pads each by `free-head-distance` **0.3 sp** and inflates the arch until it fits |
 * | MuseScore | an iterative solve — the ribbon sampled as 20 rectangles, collisions localized to thirds, up to 30 passes alternating shape and endpoints |
 * | Verovio | one feed-forward pass over "spanned elements", then a linear solve on the Bézier |
 *
 * ⭐ **We take LilyPond's *measurement* and not its *search*.** Its answer is reached by scoring ~81
 * candidate endpoint pairs; the same answer for the ordinary case is available in closed form,
 * because the scoring is lopsided by design — clearing an interior stem is worth 30 demerits and
 * climbing a staff space costs 0.8 when the end's own stem is unbeamed and points the slur's way. So
 * the endpoint goes to its stem tip whenever an interior note demands it, and the search only ever
 * confirms that. This module is the measurement half: **where the covered ink reaches**.
 *
 * ## ⭐⭐ AND GOULD NAMES THIS EXACT MOVE — recovered 2026-08-17, after the code was written
 *
 * > **p. 322:** *"…notes **must appear to be included in a slur** — notes a long way from the slur
 * > (marked ↑↓) fail to do this. **A slur may be placed at the stem end of the group's outer notes
 * > in order to achieve the required inclusive appearance**: rather than"*
 *
 * That is the case verbatim: over a GROUP the endpoints go to the outer notes' **stem ends**, and
 * the reason given is the interior notes — the same reason this module exists.
 *
 * ⭐ **And p. 111 is headed "SLURS AT STEM END", which reverses how we had been reading it.** The
 * stem end is the DEFAULT; coming down toward the noteheads is a concession she guards twice:
 * *"**Where other notes or stems will not be obstructed**, the slur may move slightly closer to the
 * noteheads"* … *"The slur should not, however, **move too close to noteheads if there is room for
 * it to be further away**."* So the ceiling below is not an addition to her rule — **it is her
 * guard**, and the version without it was the concession applied unconditionally.
 *
 * ⛔ **The two ANCHORED columns are not obstacles.** LilyPond excludes them explicitly
 * (`generate_avoid_offsets`: `if (extremes_[LEFT].note_column_ == encompasses[i] …) continue`), and
 * it is not a detail — the slur is *attached* to those notes, so counting them as ink to clear would
 * make every slur push itself off its own anchors.
 */
import type { SlurAttachment } from './slurStemEndpoint'

/**
 * ⭐ **The outer edge of ONE covered note, on the side the slur is passing.**
 *
 * LilyPond's `get_encompass_info`, verbatim in its two branches: `if ((stem_dir == dir_) && …)
 * ei.stem_ = stem->extent(…)[dir_]` … `else ei.stem_ = ei.head_`. That is: a stem pointing the
 * slur's way reaches further than its notehead and IS the obstacle; a stem pointing away is behind
 * the notehead and contributes nothing beyond it.
 *
 * ⚠️ Absence of a stem is an answer, not a gap — a whole note is its notehead and nothing more
 * (`stemTipOf` returns undefined for it deliberately; see `slurStemEndpoint`).
 */
function outerEdgeOf(col: SlurAttachment, direction: number): number {
  const head = direction === -1 ? Math.min(...col.headYs) : Math.max(...col.headYs)
  const stemPointsThisWay = (direction === -1) === (col.stemDirection === 1)
  if (!stemPointsThisWay || col.stemTipY === undefined) return head
  return direction === -1 ? Math.min(head, col.stemTipY) : Math.max(head, col.stemTipY)
}

/**
 * ⭐⭐ **HOW FAR OUT THE COVERED NOTES REACH** — the y a slur on `direction` would have to pass to
 * clear every note between its ends, or `undefined` when there are none between them.
 *
 * `interior` is the covered columns with **the two anchored ones already removed** (the caller owns
 * that, since only it knows which columns those are). `undefined` back is therefore the honest
 * answer for a two-note slur, and the reason every caller can treat "no interior notes" as "the
 * endpoint rules had it right" rather than as a special case to write out.
 *
 * ⛔ No clearance is added here. This is *where the ink is*; how much air a curve wants above it is
 * the curve's business (LilyPond pads by 0.3 sp only when building the arch's avoid-points, and by
 * nothing at all when scoring what the endpoints must clear).
 */
export function encompassCeiling(
  interior: readonly SlurAttachment[],
  direction: number,
): number | undefined {
  if (!interior.length) return undefined
  const edges = interior.map(col => outerEdgeOf(col, direction))
  return direction === -1 ? Math.min(...edges) : Math.max(...edges)
}
