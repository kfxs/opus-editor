/**
 * ⭐⭐ **THE DYNAMICS LINE — one baseline per `(system, staff, placement)`, and every dynamic-family
 * mark on that staff sits on it.**
 *
 * The letters (`p`, `ff`), the expression words (`dolce`) and — later — the hairpins all share one
 * horizontal line per system. It is LilyPond's `DynamicLineSpanner`, Finale's *baseline*, Dorico's
 * dynamics baseline; every program has it, and we do not (docs/dynamics-line-and-hairpins-plan.md
 * §2.2): VexFlow places a `below` annotation from **the note's own lowest point**, so two `p`s in one
 * bar sit at different heights whenever their notes differ in pitch, and a high note gets its mark a
 * fixed distance under its own head — which can be *inside* the staff.
 *
 * ⭐⭐ **ONE LINE, AND A MARK DEVIATES WHERE ITS OWN MUSIC IS IN THE WAY** — his call, 2026-08-12,
 * and it is **LilyPond's default** rather than Dorico's. The line is stated from the STAFF (a
 * minimum clearance), so every mark over ordinary music lands on the same y and they read as one
 * line; a mark standing over a genuine dip clears that dip and only that mark moves. The rejected
 * alternative — the line clears the LOWEST ink anywhere in the system — means one low note in bar 3
 * drops bar 1's `p` too, which is level but generous, and by eye the local rule reads better.
 *
 * ⚠️ **What "its own music" means here: the mark's own COLUMN** — the ink at the rhythmic position
 * it is attached to, which is the same scope LilyPond's `DynamicLineSpanner` covers for a lone
 * dynamic. Not its bar (a dip three beats later is not under the mark), not the system. A SPANNER —
 * a hairpin — will hand in the columns it covers instead, which is the same function with a wider
 * slice.
 *
 * ## What this module is, and what it deliberately is not
 *
 * **Pure, and derived — stored nowhere.** In: the system's ink, which the spacing model already
 * measured. Out: a number. Nobody persists it, it never reaches JSON, and it is recomputed every
 * render — the same family as `measureColumns` and `pageCastOff` (plan §6, DESIGN-PRINCIPLES §3).
 * ⛔ No module-level state: no `Map` memoising a system's y, no "the current line".
 *
 * **⭐ The staff's SIZE is not an input, and that is worth stating** — the plan expected one. An
 * `InkBox`'s band (`top`/`bottom`) is measured in its own staff's spaces and never scaled
 * (`layout/kerning.ts`), and the mark is drawn *inside* that staff's `scale(k)` group, so a small
 * staff's dynamics close up with it for free. Everything here is in one staff's own spaces, and the
 * caller converts with that staff's stave. Multiply by a ratio anywhere in here and a small staff's
 * line lands twice-scaled.
 *
 * **⚠️ Its axis is `InkBox`'s: staff spaces BELOW the top stave line** — top line 0, middle 2, bottom
 * 4, above the staff negative. The same number VexFlow's `getYForLine` indexes, which is what makes
 * the conversion at the draw site `getYForLine(0) + staffSpacesToPixels(baseline, stave)`.
 *
 * **⚠️ Its y is a BASELINE, not a top edge.** A 30 px Bravura glyph and a 14 px Georgia italic look
 * aligned only when they share a baseline — which is how print sets `p dolce`, and how
 * `DYNAMIC_GLYPH_INK_ABOVE` / `_BELOW` are already defined (`rendering/dynamicStyle.ts`). So the mark's
 * own ink extent is an INPUT ({@link DynamicMarkInk}), not something computed here: measuring a glyph
 * needs the browser (jsdom returns zeros), and that measurement belongs to the e2e suite.
 *
 * **⛔ It does not know about articulations, beams or tuplet brackets.** The ink it reads is what
 * `measureColumns` models — noteheads, ledgers, dots, accidentals, stems and flags. If one of those
 * families must push the line, it becomes a ROW in that ink model, so the width and the line agree.
 * A second extent computed here would be a second answer to "how low does this bar reach".
 *
 * ⏭️ **One rung of a ladder** (plan §12). Above the staff every program keeps an ordered stack —
 * tempo marks, rehearsal marks, 8va brackets, technique text — each family on its own rung. Nothing
 * of that is built, and nothing here forbids it: the key is already `(staff, placement)`, so `above`
 * is a legal value on day one, and the ordering AMONG families is what stays missing.
 */
import type { Dynamic, Fraction } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import type { Column } from './spacing'
import type { InkBox } from './kerning'

/** Which side of the staff a line serves — the model's own word, so the two cannot drift. */
export type DynamicsPlacement = NonNullable<Dynamic['placement']>

/**
 * The two numbers the rule is made of, in staff spaces.
 *
 * ⚠️ **By eye, like the spacing model's** — these are where the tuning starts, not where it ends.
 * Both are LilyPond's `DynamicLineSpanner` defaults, which is the one engine that states them as
 * numbers: `padding` 0.6 and `minimum-space` 1.2.
 */
export const DYNAMICS_LINE = {
  /** Clearance between the music's lowest (or highest) ink and the marks' ink. LilyPond's
   *  `DynamicLineSpanner.padding`. */
  PADDING: 0.6,
  /**
   * ⭐⭐ **The least distance from the staff's near line to the marks' ink — and the number that
   * MAKES the line a line.**
   *
   * It is not a taste value: it is *one ordinary stem, cleared*. A note on the middle line stems
   * down to `STEM_REACH` (3.5) past its head, i.e. 1.5 spaces below the bottom line, and that is the
   * deepest ink single-voice music inside the staff produces. Add {@link DYNAMICS_LINE.PADDING} and
   * you have 2.1 — so every mark over staff-resident music, stem up or stem down, comes out at
   * EXACTLY this floor and they share one line by construction.
   *
   * ⚠️ That is what makes the local rule (see the module note) safe. Set it to LilyPond's own
   * `minimum-space` of 1.2 instead and a down-stemmed note beats the floor by 0.9 spaces, so a bar
   * of ordinary notes steps its dynamics up and down as the stems flip — the drunk line, arrived at
   * from the other direction. Below this, only genuinely low ink — a ledger line, a second voice —
   * moves a mark, which is the rule he asked for.
   */
  MIN_FROM_STAFF: 2.1,
} as const

/** The staff's own lines on {@link InkBox}'s axis — the top line is 0 and the bottom is 4. */
const STAFF_TOP = 0
const STAFF_BOTTOM = 4

/**
 * How far a mark's ink reaches from its own text baseline, in the staff's own spaces — positive both
 * ways, since each names a direction rather than a signed coordinate.
 *
 * Supplied by the caller because it is a FONT measurement: a glyph measures 0×0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a number computed here would be a number agreeing
 * with itself. `rendering/dynamicStyle.ts` holds the current proportions of the glyph size.
 */
export interface DynamicMarkInk {
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

/**
 * What one staff's music reaches over the columns handed in — `null` when that staff drew nothing
 * there. The SCOPE is the caller's: one column for a lone mark, a span's worth for a hairpin.
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
 * itself (0…4), which is inside {@link DYNAMICS_LINE.MIN_FROM_STAFF} either way, so neither can move
 * a line.
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
 * ⭐ **THE RULE.** Clear the staff's ink by {@link DYNAMICS_LINE.PADDING}, floor that at
 * {@link DYNAMICS_LINE.MIN_FROM_STAFF} from the staff itself, and put the baseline where the mark's
 * own ink starts exactly there. Mirrored for `above`.
 *
 * `band` is `null` for a staff with no ink at all (an empty system), and the floor is then the whole
 * answer — so there is always a line, and it is where a mark on a silent staff would want to be
 * anyway.
 *
 * @returns the shared text baseline, in staff spaces below the staff's top line.
 */
export function dynamicsLineBaseline(
  band: InkBand | null,
  placement: DynamicsPlacement,
  markInk: DynamicMarkInk,
): number {
  if (placement === 'above') {
    const clear = Math.min(band?.top ?? STAFF_TOP, STAFF_TOP) - DYNAMICS_LINE.PADDING
    return Math.min(clear, STAFF_TOP - DYNAMICS_LINE.MIN_FROM_STAFF) - markInk.below
  }
  const clear = Math.max(band?.bottom ?? STAFF_BOTTOM, STAFF_BOTTOM) + DYNAMICS_LINE.PADDING
  return Math.max(clear, STAFF_BOTTOM + DYNAMICS_LINE.MIN_FROM_STAFF) + markInk.above
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
 * The line for ONE mark: the rule, over the ink under it.
 *
 * The whole of the local rule in one call — and it is why every mark over ordinary music comes out
 * on the same y without anything having to compute "the system's line": the floor
 * ({@link DYNAMICS_LINE.MIN_FROM_STAFF}) is the same number for all of them.
 */
export function dynamicsLineAt(
  columns: readonly Column[],
  beat: Fraction,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  placement: DynamicsPlacement,
  markInk: DynamicMarkInk,
): number {
  return dynamicsLineBaseline(staffInkBand(columnsUnder(columns, beat), staffId, firstStaffId), placement, markInk)
}
