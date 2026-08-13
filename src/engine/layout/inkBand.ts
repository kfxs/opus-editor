/**
 * ⭐⭐ **HOW FAR THE MUSIC REACHES, AND WHERE A MARK CLEARS IT** — the shared vertical arithmetic
 * behind every family that sits outside the staff.
 *
 * Extracted from `./dynamicsLine.ts` when the TRILL became its second client
 * (docs/trill-plan.md §4, P2). The dynamics line was here first and named every piece after itself;
 * what the split found is that only the two CONSTANTS were ever dynamics-specific. The rule —
 * *clear the ink by `padding`, floor that at `minFromStaff` from the staff, mirrored for `above`* —
 * is the same sentence for a `p`, a wedge and a `tr`.
 *
 * ⛔ **So a new outside-staff family calls {@link clearanceBaseline} with its own two numbers. It
 * does NOT copy these six lines.** A duplicated rule imports nothing, so no lint can see it, and the
 * result is two answers to "how far from the staff" — the exact thing
 * docs/dynamics-line-and-hairpins-plan.md exists to prevent. `docs/above-staff-ladder.md` §4 states
 * the same rule from the other side: a new family must either join a baseline, or read the ink band
 * the way the trill does.
 *
 * ## What this module is, and what it deliberately is not
 *
 * **Pure, and derived — stored nowhere.** In: the ink the spacing model already measured. Out: a
 * number. Recomputed every render, never persisted, never in JSON (DESIGN-PRINCIPLES §3). ⛔ No
 * module-level state.
 *
 * **⚠️ Its axis is `InkBox`'s: staff spaces BELOW the top stave line** — top line 0, middle 2,
 * bottom 4, above the staff NEGATIVE. The same number VexFlow's `getYForLine` indexes, which is what
 * makes the conversion at a draw site `getYForLine(0) + staffSpacesToPixels(baseline, stave)`.
 *
 * **⚠️ A baseline, not a top edge.** A 30 px Bravura glyph and a 14 px italic look aligned only when
 * they share a baseline. So a mark's own ink extent is an INPUT ({@link MarkInk}), never measured
 * here: measuring a glyph needs a browser (jsdom returns zeros), so the number comes from the
 * rendering layer and the measurement belongs to the e2e suite.
 *
 * **⭐ The staff's SIZE is not an input.** An `InkBox`'s band is measured in its own staff's spaces
 * and never scaled (`./kerning`), and marks are drawn INSIDE that staff's `scale(k)` group, so a
 * small staff closes up for free. Multiply by a ratio anywhere in here and a small staff's line
 * lands twice-scaled.
 *
 * **⛔ It does not know about articulations, slurs or tuplet brackets.** The ink it reads is what
 * `./measureColumns` models — noteheads, ledgers, dots, accidentals, stems and flags. If one of
 * those families must push a line, it becomes a ROW in that ink model, so the width and the line
 * agree. A second extent computed at a draw site would be a second answer to how far a bar reaches.
 * (`docs/above-staff-ladder.md`, "Known and accepted limitation".)
 */
import type { Fraction } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import type { Column } from './spacing'
import type { InkBox } from './kerning'

/** Which side of the staff something sits on. The model's families each derive their own alias from
 *  their own type (`DynamicsPlacement`, `Trill['placement']`); structurally they are this. */
export type StaffSide = 'above' | 'below'

/** The staff's own lines on {@link InkBox}'s axis — the top line is 0 and the bottom is 4. */
export const STAFF_TOP = 0
export const STAFF_BOTTOM = 4

/**
 * How far a mark's ink reaches from its own text baseline, in the staff's own spaces — positive both
 * ways, since each names a direction rather than a signed coordinate.
 *
 * Supplied by the caller because it is a FONT measurement: a glyph measures 0×0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a number computed here would be a number agreeing
 * with itself. `rendering/dynamicStyle.ts` holds the dynamics' proportions; the trill's are
 * `rendering/trillStyle.ts`'s.
 */
export interface MarkInk {
  /** Baseline → the mark's topmost ink (upward). */
  above: number
  /** Baseline → the mark's lowest ink (downward). */
  below: number
}

/** The vertical band one staff's music occupies — its highest and lowest ink, in that staff's own
 *  spaces below its top line. */
export interface InkBand {
  top: number
  bottom: number
}

/** The two numbers a family's rule is made of, in staff spaces — what makes one family's line sit
 *  nearer the staff than another's. See {@link clearanceBaseline}. */
export interface Clearance {
  /** Between the music's nearest ink and the mark's ink. LilyPond calls it `padding`. */
  padding: number
  /** The least distance from the staff's near line to the mark's ink. LilyPond's `staff-padding` /
   *  `minimum-space` — and the number that makes a family's marks line up with each other. */
  minFromStaff: number
}

/**
 * What one staff's music reaches over the columns handed in — `null` when that staff drew nothing
 * there. The SCOPE is the caller's: one column for a lone mark, a span's worth for a hairpin or a
 * trill.
 *
 * ⚠️⚠️ **A box's `staff` is `undefined` for the FIRST staff even when the score has staff ids**, so
 * both sides are normalised through `firstStaffId` before they are compared. This is not
 * hypothetical and it is silent: on a two-staff score the upper staff's noteheads carry no `staff`
 * while the lower staff's carry its id (`slotInk` copies `slot.staffId`, and "absent means the first
 * one" is the convention everywhere — `utils/lanes`; a staff added *below* deliberately does not
 * stamp the existing music, only a prepend does). Compare strictly, as `kerning.sameBand` does, and
 * the upper staff's line is computed from an empty band the moment its caller knows the staff by its
 * real id.
 *
 * ⭐ It is `models/staffContent.matchesStaff` — the membership test every per-staff filter already
 * shares — with the first staff's id passed in instead of the whole `Score`, because a derived-view
 * function that has the ink in hand has no other use for the score.
 *
 * ⭐ The staff-LESS boxes that are genuinely system-wide — the barline, an empty bar's measure rest —
 * therefore fold into the first staff's band. Harmless by construction: both span exactly the staff
 * itself (0…4), which is inside every family's `minFromStaff` either way, so neither can move a line.
 *
 * @param columns the columns to measure — a measure's are the MERGED ones, holding every staff's ink
 *   at each position, which is why each box carries the staff it was measured on.
 */
export function staffInkBand(
  columns: readonly Column[],
  staffId: string | undefined,
  firstStaffId: string | undefined,
): InkBand | null {
  const wanted = staffId ?? firstStaffId
  let top = Infinity
  let bottom = -Infinity
  for (const column of columns) {
    for (const box of column.ink as readonly InkBox[]) {
      if ((box.staff ?? firstStaffId) !== wanted) continue
      if (box.top < top) top = box.top
      if (box.bottom > bottom) bottom = box.bottom
    }
  }
  return Number.isFinite(top) ? { top, bottom } : null
}

/**
 * ⭐ **THE RULE.** Clear the staff's ink by `clearance.padding`, floor that at
 * `clearance.minFromStaff` from the staff itself, and put the baseline where the mark's own ink
 * starts exactly there. Mirrored for `above`.
 *
 * `band` is `null` for a staff with no ink at all (an empty system), and the floor is then the whole
 * answer — so there is always a line, and it is where a mark on a silent staff would want to be
 * anyway.
 *
 * ⭐ **The floor is what makes a family's marks agree with each other.** Pick it so that ordinary
 * staff-resident music comes out exactly on it (for the dynamics that is one cleared stem: 1.5 + 0.6
 * = 2.1) and every mark over ordinary music lands on the same y by construction, with only genuinely
 * unusual ink moving one. Pick it lower and the marks step up and down as the stems flip.
 *
 * @returns the shared text baseline, in staff spaces below the staff's top line.
 */
export function clearanceBaseline(
  band: InkBand | null,
  side: StaffSide,
  markInk: MarkInk,
  clearance: Clearance,
): number {
  if (side === 'above') {
    const clear = Math.min(band?.top ?? STAFF_TOP, STAFF_TOP) - clearance.padding
    return Math.min(clear, STAFF_TOP - clearance.minFromStaff) - markInk.below
  }
  const clear = Math.max(band?.bottom ?? STAFF_BOTTOM, STAFF_BOTTOM) + clearance.padding
  return Math.max(clear, STAFF_BOTTOM + clearance.minFromStaff) + markInk.above
}

/**
 * ⭐ **The columns a mark standing at `beat` is measured against** — its own, and nothing else.
 *
 * The column exactly at that beat, else the next one after it: the same fall-forward
 * `attachDynamicsToSlots` uses to pick the note a mark hangs off, so the ink the line clears is the
 * ink of the note the mark is actually attached to. Empty past the last column.
 *
 * ⛔ Deliberately not a WINDOW around the beat, and not the bar. A mark is a few spaces wide and
 * belongs to its note; a dip three beats later is not underneath it, and clearing it would put the
 * mark down there for no visible reason — which is the whole complaint against the system-wide rule.
 */
export function columnsUnder(columns: readonly Column[], beat: Fraction): Column[] {
  let best: Column | undefined
  for (const column of columns) {
    if (fracCompare(column.beat, beat) < 0) continue
    if (!best || fracCompare(column.beat, best.beat) < 0) best = column
  }
  return best ? [best] : []
}

/**
 * ⭐ **The columns a SPANNER covers** — the wider slice, and the hairpin's and trill's answer to
 * {@link columnsUnder}.
 *
 * Every column in `[from, to)` — half-open, because a wedge covering "two beats from beat 1" reaches
 * to beat 3 without standing over whatever begins there. A hairpin ending at a bar's barline hands
 * in that bar's capacity as `to` and so takes every column of it, which is what the eye expects.
 *
 * ⚠️ It takes ONE measure's columns, because that is the unit they come in — a spanner crossing bars
 * asks each bar for its own and the caller merges the bands. Merging is the caller's job on purpose:
 * a spanner split over a system break has one band per SEGMENT, not one for the whole span, or a low
 * note on the second system would push the first system's fragment down.
 */
export function columnsBetween(columns: readonly Column[], from: Fraction, to: Fraction): Column[] {
  return columns.filter(c => fracCompare(c.beat, from) >= 0 && fracCompare(c.beat, to) < 0)
}

/**
 * The widest band of two — either may be `null` (a staff with no ink over that slice), and two
 * `null`s stay `null` so {@link clearanceBaseline}'s floor still answers.
 *
 * ⭐ Exists because a spanner's band is the union over the bars it crosses, and "the lowest ink
 * anywhere under this wedge" has to be ONE number: the wedge is a straight line, so a dip under its
 * middle has to move the whole segment or the line would cross the notes it spans. That is not the
 * system-wide rule the local one replaced — the scope is still exactly what the mark covers.
 */
export function mergeInkBands(a: InkBand | null, b: InkBand | null): InkBand | null {
  if (!a) return b
  if (!b) return a
  return { top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) }
}
