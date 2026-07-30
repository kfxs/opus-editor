/**
 * ⭐⭐ **KERNING — two inks only need horizontal clearance where they share a vertical band.**
 *
 * The mechanism every other engine has: MuseScore's `Shape::minHorizontalDistance` +
 * `computeVerticalClearance` + `KerningType`, LilyPond's skylines. It is the honest answer to
 * *"accidentals in dense passages push the notes apart"* (`docs/vexflow-boundary.md` §5) — an
 * accidental low on the staff should be allowed to tuck under a preceding high notehead instead of
 * buying room nobody looks at.
 *
 * ## What this changes about the model's shape
 *
 * A column's ink was ONE reach either side of its x (`EventExtent`), merged over every voice and
 * staff. That cannot answer a vertical question, so a column now carries the same ink as a list of
 * **located boxes** ({@link InkBox}), and the gap's floor is a max over box PAIRS rather than over two
 * merged numbers:
 *
 * ```
 *   floor = max over (a ∈ left column, b ∈ right column) of  a.right + padding(a.kind, b.kind) + b.left
 * ```
 *
 * …skipping any pair that MAY kern and is vertically CLEAR. With nothing clear, the max is exactly the
 * old expression — which is the property `kerning.test.ts` pins, because it is what makes this
 * incapable of *widening* anything.
 *
 * ## ⛔ What may kern is a TABLE, not a judgement made at each site
 *
 * {@link MAY_KERN} — and the entry that matters most is the one that says NO: **two noteheads never
 * kern, however far apart they are vertically.** Successive noteheads that overlap horizontally read
 * as simultaneous, which is a rule about meaning rather than about ink, and no vertical clearance
 * makes it acceptable. That is MuseScore's `KerningType::NON_KERNING`, and forgetting it is how a
 * shape-based spacer starts drawing chords out of consecutive notes.
 *
 * ## ⚠️ Where the wins actually land, measured — and where they deliberately do not
 *
 * On **leaps**, across **voices**, and (later) across **staves**. NOT in a stepwise chromatic run: a
 * sharp a step below the previous notehead overlaps it, so the run keeps every bit of the room it has
 * today. That is correct engraving rather than a shortfall — but it means this does not make a dense
 * chromatic passage narrower, and the complaint that named this priority was about exactly such a
 * passage. The room there was bought back by P3 instead (the ink became a floor UNDER the duration
 * rule rather than a replacement for it).
 */

import { pairPadding, type InkKind } from './spacingPadding'

/**
 * One piece of drawn ink, located: how far it reaches either side of its COLUMN's x, and the vertical
 * band it occupies.
 *
 * ⚠️ `top`/`bottom` are in **staff spaces below the top stave line** of `staff` — the axis
 * `staffLineForSpelling` reads as `5 − line`, so the top line is 0, the middle 2 and the bottom 4, and
 * a note above the staff is negative. Only boxes on the SAME staff are ever compared vertically (see
 * {@link sameBand}).
 */
export interface InkBox {
  /** Reach LEFT of the column's x, as a positive number — an accidental, a ledger overhang. */
  left: number
  /** Reach RIGHT of the column's x — the notehead itself, a dot, a ledger overhang. */
  right: number
  /** Staff spaces below the top stave line; smaller is higher. */
  top: number
  bottom: number
  kind: InkKind
  /** Which staff's band this is measured on — the `staffId`, absent meaning the first staff, as
   *  everywhere else. Boxes on different staves are never compared (see {@link sameBand}). */
  staff: string | undefined
}

/**
 * How much vertical air two inks need before one may pass under the other, in staff spaces.
 *
 * A judgement rather than a measurement, like the paddings in `spacingPadding.ts` — and the same
 * number as the horizontal `note↔accidental` padding on purpose: *the clearance we ask for vertically
 * is the clearance we ask for horizontally*. MuseScore's own vertical clearance is in this range.
 */
export const KERN_CLEARANCE = 0.35

/**
 * ⭐ **Which pairs may share horizontal space at all**, keyed by (left ink, right ink) — the closed
 * question this module exists to answer, in one place.
 *
 * Only the RIGHT-hand accidental family kerns today, which is the reported case and the one the
 * tradition is unambiguous about. Everything absent from this table keeps the width it has always
 * had, so adding a row is how a family opts in — never a condition at a call site.
 *
 * ⛔ `note ↔ note` is deliberately NOT here, and neither is anything involving a `barline`: a barline
 * spans the whole staff, so it can never be vertically clear of anything, and a row for it would only
 * be a lie that happened to be harmless.
 */
const MAY_KERN: readonly (readonly [InkKind, InkKind])[] = [
  ['note', 'accidental'],
  ['dot', 'accidental'],
  ['ledger', 'accidental'],
  ['stem', 'accidental'],
  // ⭐ A FLAG is the case this table was waiting for: it hangs from the stem TIP, three staff spaces
  //   from the notehead, so a following accidental at the other end of the staff is plainly clear of
  //   it — and a flag is the widest thing an unbeamed short note draws.
  ['flag', 'accidental'],
]

const mayKern = (left: InkKind, right: InkKind): boolean =>
  MAY_KERN.some(([a, b]) => a === left && b === right)

/**
 * Do these two boxes occupy the same vertical band — i.e. is neither clear of the other?
 *
 * ⭐⭐ **Ink on DIFFERENT STAVES is always clear, and this is where most of the winning happens.** Two
 * staves of a system are separated by a whole stave height plus its clearance, so a bass-staff
 * accidental and a treble-staff notehead cannot touch — yet the column merges them, so before this
 * every left-hand accidental was buying room in the right hand's gaps. A piano score pays that on
 * almost every beat.
 *
 * ⚠️ **The assumption, stated so it can be found:** that the staves really are far apart. A note
 * hanging two octaves below its own staff on ledger lines can reach into the staff beneath it, and
 * this will happily kern against it. That collision is vertical, it exists today whatever the
 * horizontal spacing does, and staff distance is not something this module is given — see
 * `docs/staff-spacing-plan.md`.
 */
function sameBand(left: InkBox, right: InkBox): boolean {
  if (left.staff !== right.staff) return false
  return !(right.top > left.bottom + KERN_CLEARANCE || right.bottom < left.top - KERN_CLEARANCE)
}

/**
 * The least ink-free space between two columns, in staff spaces — a max over every pair of boxes that
 * cannot get out of each other's way.
 *
 * ⚠️ Returns 0 for a column with no boxes at all, which is what a duration-only fixture wants
 * ({@link plainColumn}) — the caller's `max(spring, floor)` then leaves the rule in charge.
 */
export function inkFloor(left: readonly InkBox[], right: readonly InkBox[]): number {
  let floor = 0
  for (const a of left) {
    for (const b of right) {
      if (mayKern(a.kind, b.kind) && !sameBand(a, b)) continue
      const need = a.right + pairPadding(a.kind, b.kind) + b.left
      if (need > floor) floor = need
    }
  }
  return floor
}

/**
 * The merged reach of a list of boxes — the `EventExtent` the rest of the model still speaks in (the
 * bar's lead-in, and where the drawing puts the first note).
 *
 * ⭐ **Derived, never stored twice.** The boxes ARE the ink; this is a projection of them, so the two
 * cannot disagree — and `kerning.test.ts` pins that projecting them reproduces the extents the
 * horizontal-only model computed, which is what says the boxes are the same ink and only located.
 */
export function mergedReach(boxes: readonly InkBox[]): { left: number; right: number } {
  let left = 0
  let right = 0
  for (const box of boxes) {
    if (box.left > left) left = box.left
    if (box.right > right) right = box.right
  }
  return { left, right }
}

/**
 * The widest box at one edge, and therefore WHAT is at that edge — the key into the pair table.
 *
 * Two cases where nothing reaches past the column at all, and they want different answers:
 *
 * - ⚠️ **A box that reaches NOWHERE on either side is a MARKER and names itself** — the barline.
 *   Answering `note` there made every bar's closing gap `note↔note` (0.3) instead of `note↔barline`
 *   (1.0), i.e. it quietly deleted the run-out at the end of every bar.
 * - **A box that reaches only on the OTHER side leaves this side bare**, and the pair table calls a
 *   bare side `note`. A rest is the case: it reaches right and not left.
 *
 * ⏭️ **A LATENT BUG this makes visible, left alone deliberately.** That second rule is what the merged
 * `leftKind`/`rightKind` did before the ink was located — a rest's left reach is 0, so it never
 * replaced the default — which means `barline↔rest` (1.65 against a note's 1.2) has never applied to a
 * bar that OPENS with a rest, only to one that ends with one. Delivering it widens every such bar by
 * 0.45 staff spaces and moves the measure rest a quarter space off centre, so it is a change to make on
 * purpose and by eye, not a side effect of locating the ink.
 */
export function edgeKind(boxes: readonly InkBox[], edge: 'left' | 'right'): InkKind {
  let best: InkBox | undefined
  for (const box of boxes) {
    if (box[edge] <= 0) continue
    if (!best || box[edge] > best[edge]) best = box
  }
  if (best) return best.kind
  return boxes.find(box => box.left <= 0 && box.right <= 0)?.kind ?? 'note'
}
