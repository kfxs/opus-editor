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
import type { Column } from './spacing'
import {
  clearanceBaseline, columnsUnder, staffInkBand,
  type Clearance, type InkBand, type MarkInk,
} from './inkBand'

/** Which side of the staff a line serves — the model's own word, so the two cannot drift. */
export type DynamicsPlacement = NonNullable<Dynamic['placement']>

/**
 * The two numbers the rule is made of, in staff spaces.
 *
 * ⚠️ **By eye, like the spacing model's** — these are where the tuning starts, not where it ends.
 * Both are LilyPond's `DynamicLineSpanner` defaults, which is the one engine that states them as
 * numbers: `padding` 0.6 and `minimum-space` 1.2.
 */
export const DYNAMICS_LINE: Clearance = {
  /** Clearance between the music's lowest (or highest) ink and the marks' ink. LilyPond's
   *  `DynamicLineSpanner.padding`. */
  padding: 0.6,
  /**
   * ⭐⭐ **The least distance from the staff's near line to the marks' ink — and the number that
   * MAKES the line a line.**
   *
   * It is not a taste value: it is *one ordinary stem, cleared*. A note on the middle line stems
   * down to `STEM_REACH` (3.5) past its head, i.e. 1.5 spaces below the bottom line, and that is the
   * deepest ink single-voice music inside the staff produces. Add {@link DYNAMICS_LINE}.padding and
   * you have 2.1 — so every mark over staff-resident music, stem up or stem down, comes out at
   * EXACTLY this floor and they share one line by construction.
   *
   * ⚠️ That is what makes the local rule (see the module note) safe. Set it to LilyPond's own
   * `minimum-space` of 1.2 instead and a down-stemmed note beats the floor by 0.9 spaces, so a bar
   * of ordinary notes steps its dynamics up and down as the stems flip — the drunk line, arrived at
   * from the other direction. Below this, only genuinely low ink — a ledger line, a second voice —
   * moves a mark, which is the rule he asked for.
   */
  minFromStaff: 2.1,
}


/**
 * ⭐ **THE RULE, for the dynamics family** — {@link clearanceBaseline} with {@link DYNAMICS_LINE}'s
 * two numbers, and nothing else. The arithmetic moved to `./inkBand` when the trill became its
 * second client (docs/trill-plan.md §4): the rule is one sentence for every outside-staff family
 * and only the constants differ, so a copy here with two other numbers would be a second answer to
 * "how far from the staff".
 *
 * @returns the shared text baseline, in staff spaces below the staff's top line.
 */
export function dynamicsLineBaseline(
  band: InkBand | null,
  placement: DynamicsPlacement,
  markInk: MarkInk,
): number {
  return clearanceBaseline(band, placement, markInk, DYNAMICS_LINE)
}

/**
 * The line for ONE mark: the rule, over the ink under it.
 *
 * The whole of the local rule in one call — and it is why every mark over ordinary music comes out
 * on the same y without anything having to compute "the system's line": the floor
 * ({@link DYNAMICS_LINE}.minFromStaff) is the same number for all of them.
 */
export function dynamicsLineAt(
  columns: readonly Column[],
  beat: Fraction,
  staffId: string | undefined,
  firstStaffId: string | undefined,
  placement: DynamicsPlacement,
  markInk: MarkInk,
): number {
  return dynamicsLineBaseline(staffInkBand(columnsUnder(columns, beat), staffId, firstStaffId), placement, markInk)
}
