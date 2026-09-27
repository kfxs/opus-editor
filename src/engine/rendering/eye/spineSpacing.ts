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
import { HEADER_TO_REPEAT, repeatStartRoom } from '@/engine/layout/barlineSign'
import { headerToNoteGap } from '@/engine/layout/headerInk'
import { INK } from '@/engine/layout/spacingPadding'
import { clefResolverFor, keyResolverFor, measureColumns, measureLeadIn } from '@/engine/layout/measureColumns'
import { noteLineRoom } from '@/engine/layout/noteLineRoom'
import { naturalWidth, spaceColumns, type Column } from '@/engine/layout/spacing'
import type { Fraction } from '@/utils/fraction'
import { fracCompare } from '@/utils/fraction'
import { resolveStaffClefs, type StaffClefs } from '@/utils/clefUtils'
import { resolveStaffKeys, type StaffKeys } from '@/utils/keySignature'
import type { Measure, Score } from '@/types/music'
import { type SpineHeader, spineHeaderColumns, spineSystemHeaders } from './spineHeader'
import { spineStaffTops, staffIdsOf } from './spineStaves'

/** One bar's room along the spine, in px of `s`. */
export interface SpineBar {
  /** Where the bar begins — the barline (or the header) behind it. */
  start: number
  /** Where its own barline stands. */
  end: number
  /** `s` of the column at `beat` — a notehead's CENTRE, which is what a block is placed by. */
  columnAt(beat: Fraction): number
  /** Where the bar's music begins — its first column's anchor (the page's `noteStartX`). */
  musicStart: number
  /** The bar's COLUMNS as the page measures them — the ink the outside-staff lines clear (`./spineMarks`). */
  columns: readonly Column[]
}

interface AskedBar {
  columns: Column[]
  /** px from the bar's start to its first column's anchor. */
  leadIn: number
  /** px the columns ask for, first column to barline, unjustified. */
  natural: number
}

function ask(score: Score, measure: Measure, index: number): AskedBar {
  // ⭐ EVERY staff's clefs and keys (port map #12): a column holds every staff at its beat, so its ink is
  //    measured on each staff's own clef and key — the page's resolvers, built the page's way.
  const staves = spineStaffLanes(score)
  const firstStaffId = staves[0].id
  const clefs = new Map(staves.map(staff => [staff.id, staff.clefs]))
  const keys = new Map(staves.map(staff => [staff.id, staff.keys]))
  const clefFor = clefResolverFor(measure, clefs, firstStaffId)
  const keyFor = keyResolverFor(measure, keys, firstStaffId)
  const columns = measureColumns(measure, clefFor, () => 1, keyFor, noteLineRoom(score, measure))
  const lead = measureLeadIn(measure, clefFor, () => 1, keyFor)
  // ⭐ A bar that draws a HEADER (`./spineHeader` — the staff's head, or a clef / key / meter change)
  //    owes the header's own spine, then the page's header→note gap in place of the barline's
  //    padding (`MeasureLayout`'s swap). A `|:` stands between the two: after the header by
  //    `HEADER_TO_REPEAT` (Gould p. 234 — the repeat goes AFTER a new clef, key or meter), else on
  //    the boundary. The END sign's reach is already in the columns.
  //    ⭐ With several staves the header is the SYSTEM's — every staff's signs lined up
  //    (`spineHeaderColumns`) — and the gap after it the largest any staff's last sign asks.
  const headers = spineSystemHeaders(score, staves, index)
  const drawn = headers.filter((header): header is SpineHeader => header !== undefined)
  const opensRepeat = measure.repeatStart !== undefined
  const before = drawn.length > 0
    ? spineHeaderColumns(headers).width / STAFF_SPACE_PX + (opensRepeat ? HEADER_TO_REPEAT : 0)
      + Math.max(...drawn.map(header => headerToNoteGap(header, lead.accidentals)))
    : lead.padding
  return {
    columns,
    leadIn: (before + lead.extent + repeatStartRoom(measure)) * STAFF_SPACE_PX,
    natural: naturalWidth(columns) * STAFF_SPACE_PX,
  }
}

/** Each staff of the system with its clef and key walks — what a bar's columns and headers are read on. */
export function spineStaffLanes(score: Score): { id: string | undefined; clefs: StaffClefs; keys: StaffKeys }[] {
  return staffIdsOf(score).map(id => ({ id, clefs: resolveStaffClefs(score, id), keys: resolveStaffKeys(score, id) }))
}

/** How long a spine the score's bars ask for, in px — what an open spine takes and a circle is sized from. */
export function naturalSpineLength(score: Score): number {
  return score.measures.reduce((total, measure, index) => {
    const bar = ask(score, measure, index)
    return total + bar.leadIn + bar.natural
  }, 0)
}

/**
 * ⭐ How far below the spine the score's DEEPEST ink reaches, in px — never less than the staff itself
 * (the clef and the meter fill it). What {@link spaceBarsOnSpine}'s `innerRatio` is asked of.
 */
export function deepestInkPx(score: Score): number {
  const STAFF_DEPTH_SPACES = 4
  // ⭐ Each box is measured on its OWN staff (`Column` ink carries it); a lower staff's stands that much
  //    further down (`./spineStaves`). A box with no staff is the first staff's.
  const tops = spineStaffTops(score)
  let deepest = Math.max(...tops.values()) + STAFF_DEPTH_SPACES * STAFF_SPACE_PX
  score.measures.forEach((measure, index) => {
    for (const column of ask(score, measure, index).columns) {
      for (const box of column.ink) deepest = Math.max(deepest, (tops.get(box.staff) ?? 0) + box.bottom * STAFF_SPACE_PX)
    }
  })
  return deepest
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
    return inner.map(bar => ({
      start: out(bar.start), end: out(bar.end), columnAt: beat => out(bar.columnAt(beat)),
      musicStart: out(bar.musicStart), columns: bar.columns,
    }))
  }
  const asked = score.measures.map((measure, index) => ask(score, measure, index))
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
      musicStart: first,
      columns: bar.columns,
    }
    start = end
    return room
  })
}
