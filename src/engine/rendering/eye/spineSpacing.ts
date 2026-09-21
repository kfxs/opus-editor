/**
 * ⭐⭐ **WHERE EACH COLUMN STANDS ALONG A SPINE — the PAGE's spacing, asked for one endless line**
 * (`docs/plans/bent-staff-plan.md` §5 row 14; his report, 2026-09-21: sixteenths piled on each other
 * round the circle, because the spine gave every quarter the same 48 px).
 *
 * ## Spacing is ONE-DIMENSIONAL — the path only maps it
 *
 * Checked in Belle's source the same day: its spacer (`belle-spacing.h`, `belle-springs.h` — minimum
 * widths plus springs) produces ONE number per instant, `TypesetX`, and placement
 * (`belle-placement.h:354`) merely consumes it. Nothing about spacing knows the shape of the staff.
 * So there is no "circle spacing" to invent: the columns (`layout/measureColumns` — each event's
 * measured INK and the padding its neighbours are owed) and the law (`layout/spacing` — Gould's
 * `3.5 × √t`, the spring solve) are the page's, untouched, and what they answer is distance ALONG
 * the path, `s`.
 *
 * ## The spine is ONE JUSTIFIED LINE
 *
 * A circle's length is fixed by its radius, and an open spine's staff lines end where the spine does
 * — so `eye/spineScore` justifies the whole score to the room it has, as ONE SYSTEM — exactly what the page
 * does to a line: each bar takes its share of the room in proportion to what it asks, and inside
 * the bar the springs stretch (or give, down to the ink's floor). ⚠️ Below that floor the music does
 * not fit the circle and ink will collide — the console sizes the radius from {@link naturalSpineLength}
 * so that does not happen unasked.
 *
 * ⚠️ `s` is measured along the spine's REFERENCE line (the top staff line). Ink INSIDE a circle has
 * less arc than that — by `(R − d) / R` at depth `d` — so on a tight radius low notes sit closer than
 * the numbers here say. ⏭️ Not corrected; named so the first crowded inner rim is not a mystery.
 *
 * ⛔ No DOM.
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { keyStaffId } from '@/engine/models/staffContent'
import { repeatStartRoom } from '@/engine/layout/barlineSign'
import { INK } from '@/engine/layout/spacingPadding'
import { clefResolverFor, keyResolverFor, measureColumns, measureLeadIn } from '@/engine/layout/measureColumns'
import { naturalWidth, spaceColumns, type Column } from '@/engine/layout/spacing'
import type { Fraction } from '@/utils/fraction'
import { fracCompare } from '@/utils/fraction'
import { resolveStaffClefs } from '@/utils/clefUtils'
import { resolveStaffKeys } from '@/utils/keySignature'
import type { Measure, Score } from '@/types/music'

/** One bar's room along the spine, in px of `s`. */
export interface SpineBar {
  /** Where the bar begins — the barline (or the header) behind it. */
  start: number
  /** Where its own barline stands. */
  end: number
  /** `s` of the column at `beat` — a notehead's CENTRE, which is what a block is placed by. */
  columnAt(beat: Fraction): number
}

interface AskedBar {
  columns: Column[]
  /** px from the bar's start to its first column's anchor. */
  leadIn: number
  /** px the columns ask for, first column to barline, unjustified. */
  natural: number
}

function ask(score: Score, measure: Measure): AskedBar {
  const firstStaffId = keyStaffId(score, 0)
  const clefs = new Map([[firstStaffId, resolveStaffClefs(score, firstStaffId)]])
  const keys = new Map([[firstStaffId, resolveStaffKeys(score, firstStaffId)]])
  const clefFor = clefResolverFor(measure, clefs, firstStaffId)
  const keyFor = keyResolverFor(measure, keys, firstStaffId)
  const columns = measureColumns(measure, clefFor, () => 1, keyFor)
  const lead = measureLeadIn(measure, clefFor, () => 1, keyFor)
  return {
    columns,
    // ⭐ A `|:` opening the bar stands between the boundary and the lead-in, as on the page
    //    (`MeasureLayout`'s `repeatStartRoom`). The END sign's reach is already in the columns.
    leadIn: (lead.padding + lead.extent + repeatStartRoom(measure)) * STAFF_SPACE_PX,
    natural: naturalWidth(columns) * STAFF_SPACE_PX,
  }
}

/** How long a spine the score's bars ask for, in px — what an open spine takes and a circle is sized from. */
export function naturalSpineLength(score: Score): number {
  return score.measures.reduce((total, measure) => {
    const bar = ask(score, measure)
    return total + bar.leadIn + bar.natural
  }, 0)
}

/**
 * ⭐ How far below the spine the score's DEEPEST ink reaches, in px — never less than the staff itself
 * (the clef and the meter fill it). What {@link spaceBarsOnSpine}'s `innerRatio` is asked of.
 */
export function deepestInkPx(score: Score): number {
  const STAFF_DEPTH_SPACES = 4
  let deepest = STAFF_DEPTH_SPACES
  for (const measure of score.measures) {
    for (const column of ask(score, measure).columns) {
      for (const box of column.ink) deepest = Math.max(deepest, box.bottom)
    }
  }
  return deepest * STAFF_SPACE_PX
}

/**
 * Every bar's room between `from` and `to` along the spine. `justify` makes the bars FILL that room;
 * otherwise each takes its natural width from `from` on and `to` is ignored.
 *
 * ⭐⭐ **`innerRatio` — the music is spaced where its DEEPEST INK stands** (his report, 2026-09-21: low
 * notes and their accidentals collided round the circle). `s` is measured on the spine, the TOP staff
 * line; ink inside a loop stands on a SHORTER arc (`staffSpine.innerLengthRatio`), so room that is
 * right on the top line is a third too little six spaces down. So the law is given the inner arc's
 * length — there, nothing stands closer than it would on the page — and each answer is mapped back
 * out to the spine by its angle (÷ ratio). Everything nearer the rim gets more room, which is what a
 * circle is. 1 on a straight spine: nothing changes.
 */
export function spaceBarsOnSpine(
  score: Score, from: number, to: number, justify: boolean, innerRatio: number = 1,
): SpineBar[] {
  if (innerRatio !== 1) {
    // Lay the bars out in the INNER arc's own distances, from 0 — then every `s` goes back out.
    const inner = spaceBarsOnSpine(score, 0, (to - from) * innerRatio, justify)
    const out = (s: number): number => from + s / innerRatio
    return inner.map(bar => ({ start: out(bar.start), end: out(bar.end), columnAt: beat => out(bar.columnAt(beat)) }))
  }
  const asked = score.measures.map(measure => ask(score, measure))
  const leadIns = asked.reduce((total, bar) => total + bar.leadIn, 0)
  const naturals = asked.reduce((total, bar) => total + bar.natural, 0)
  // ⭐ The lead-ins are RIGID (a barline's clearance is not a spring); the music shares what is left.
  const stretch = justify && naturals > 0 ? Math.max(0, to - from - leadIns) / naturals : 1
  const headHalf = (INK.notehead / 2) * STAFF_SPACE_PX

  let start = from
  return asked.map(bar => {
    const width = bar.natural * stretch
    const xs = spaceColumns(bar.columns, width / STAFF_SPACE_PX).map(x => x * STAFF_SPACE_PX)
    const first = start + bar.leadIn
    const end = first + width
    const room: SpineBar = {
      start,
      end,
      columnAt: beat => {
        const index = bar.columns.findIndex(column => fracCompare(column.beat, beat) === 0)
        return first + (index >= 0 ? xs[index] : 0) + headHalf
      },
    }
    start = end
    return room
  })
}
