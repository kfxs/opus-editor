import type { Formatter, Voice } from 'vexflow'
import type { Column } from '@/engine/layout/spacing'
import { spaceColumns } from '@/engine/layout/spacing'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐⭐ **THE RENDERER TAKES OVER X** (docs/spacing-model-plan.md P4) — the pass that stops VexFlow's
 * softmax deciding where inside a bar the notes go.
 *
 * P2 gave the bar the width the rule asks for; P3 gave the ink its minimums. Neither touched the
 * SPLIT: VexFlow shares a bar's room out by `softmax(ticks / voice.totalTicks)`, so a quarter came
 * out 1.54× a 16th where Gould's rule says 2.0, and half a bar of silence got 9% of the width for
 * 50% of the time (both measured on his own scores). This writes the model's answer onto the tick
 * contexts instead.
 *
 * ## Why a `setX` after `format()` is the last word
 *
 * `note.getAbsoluteX()` is `tickContext.getX() + stave.getNoteStartX() + Metrics.get('Stave.padding')`,
 * read **lazily at draw time** — and nothing between `format()` and `draw()` reads or rewrites
 * `TickContext.x`. So the last `setX` wins, full stop. (⚠️ Not, as the plan first said, because
 * `postFormat()` runs inside `format()`: it only does `if (opts.stave)` and we pass none, and
 * `TickContext.postFormat` is a no-op latch anyway.) Everything downstream follows for free:
 *
 * - every voice at that tick moves together — `joinVoices` gives them ONE shared TickContext;
 * - beams, tuplets, ties and slurs read note x at draw time;
 * - `ElementRegistry` registers post-draw, so hit-testing needs nothing extra.
 *
 * ## ⭐ How the staves stay aligned without one shared Formatter
 *
 * A column is a position in the SYSTEM, so beat 2 must be one x on every staff. VexFlow can express
 * that directly — one `Formatter`, `joinVoices` per staff, and `createTickContexts` is stave-blind —
 * but `drawMeasureContent` runs per (measure, staff) and culling, the per-staff scale groups and
 * `openGroup` identity all hang off that. It does not need to: **every staff is handed the same
 * merged column list and writes the same x's**, so they agree by construction and the per-staff
 * formatter can stay. A staff with no event at a column simply has no context to write there.
 *
 * 🚨 **That paragraph was ASPIRATIONAL until 2026-07-30 — the caller was handing each staff its own
 * LANE.** `drawMeasureContent` opens with `const { view: measure } = placement`, so
 * `measureColumns(measure)` and `measureLeadIn(measure)` both answered about one staff's slice: the
 * upper staff's eight eighths shared the bar with themselves and the lower staff's three notes with
 * themselves. Reported on a grand staff — *"vertically the second stave doesn't match with the first,
 * this is wrong notation"* — and measured at **1.0, 1.7 and 2.4 staff spaces** of drift across one bar:
 * a shift (the lane's own lead-in) plus a scale (the lane's own column list). Both now ride on
 * `MeasurePlacement.system`, resolved once per measure where every staff's clefs are in hand.
 *
 * ⚠️ So the invariant this module rests on is **the caller's** to keep, and nothing in here can check
 * it: hand `applySpacingPass` a per-staff column list and it will faithfully place a per-staff grid.
 * `e2e/systems.e2e.ts` pins the two hands landing on the same x to three decimals.
 *
 * ⭐ **A bar holding a FAN is no longer an exception** (P5). It used to be skipped — a fan's members
 * were drawn across a span `fanRoom` bought from the formatter, and moving the group's tick context
 * out from under that span would have broken it. `fanRoom` is gone: the members are columns of this
 * solve like anything else, the fanned slot's own context takes its first member's column, and the
 * room the rest of them were granted is read back by `engine/layout/fanRampRoom.ts` — the only way
 * out for a column no tick context can be written to.
 */

/** What the pass needs to know about the bar it is placing, in the units each is natural in. */
export interface SpacingTarget {
  /** The measure's merged columns, barline last — `engine/layout/measureColumns.ts`. */
  columns: Column[]
  /**
   * Where the FIRST column's notehead goes, in staff spaces past the stave's note start.
   *
   * ⚠️ Not zero, and this is the one place the lead-in has to be said twice. VexFlow's own formatter
   * shifts the first tick context right by that column's left ink, so an accidental on a bar's first
   * note lands inside the bar. Writing x's ourselves throws that shift away — so the ink has to be
   * put back here, or the sign draws to the LEFT of its own barline.
   */
  firstX: number
  /** Room from the first column to the barline column, in staff spaces. */
  targetWidth: number
  /** The bar's length in quarters — how a column's beat becomes a VexFlow tick. */
  meterQuarters: number
}

/**
 * ⭐ WHERE THE SOLVE PUT EVERY COLUMN — including the ones nothing is drawn at.
 *
 * The pass writes an x for each column that HAS a tick context, and a fan's members have none (a
 * fanned slot is one `StaveNote`, so there is no context at member beat k). Their solved positions
 * are computed all the same — `measureColumns` counts a member like any other column — and they are
 * the only record of the room the bar granted the ramp. Returning them is what lets `FanPass` spend
 * that room instead of re-deriving it from whatever happens to sit after the group
 * (`engine/layout/fanRampRoom.ts`).
 */
export interface SpacedColumns {
  /** The columns as handed in, barline last. */
  columns: Column[]
  /** `xs[i]` is column i's notehead x, in STAFF SPACES from the first column (so `xs[0] === 0`). */
  xs: number[]
}

/**
 * Place every column at the x the model gives it. Returns the solved columns, or `null` when the bar
 * could not be placed (no contexts, a meter that makes no sense), leaving VexFlow's own answer
 * untouched.
 */
export function applySpacingPass(formatter: Formatter, voices: Voice[], target: SpacingTarget): SpacedColumns | null {
  const { columns, firstX, targetWidth, meterQuarters } = target
  if (voices.length === 0 || columns.length < 2 || !(meterQuarters > 0)) return null

  const contexts = formatter.getTickContexts()
  if (!contexts) return null
  const { map, resolutionMultiplier } = contexts

  // Ticks per quarter, asked of VexFlow rather than assumed: a Voice's total ticks is
  // numBeats/beatValue in VexFlow's own resolution, so dividing by the same meter in quarters
  // cancels the resolution out — exact in 4/4, 6/8 and 7/16 alike. (`Tables.RESOLUTION` is not on
  // the package's public entry, cf. `Glyphs`, which is CJS-only and undefined in the browser.)
  const ticksPerQuarter = (voices[0].getTotalTicks().value() / meterQuarters) * resolutionMultiplier
  if (!(ticksPerQuarter > 0)) return null

  const xs = spaceColumns(columns, targetWidth)

  let placed = 0
  for (const [i, column] of columns.entries()) {
    // The BARLINE column is a position, not an event: nothing is drawn there and no context exists.
    if (i === columns.length - 1) break
    const tick = Math.round((column.beat.num / column.beat.den) * ticksPerQuarter)
    const context = map[tick]
    if (!context) continue // this staff has nothing starting here — another one does
    context.setX((firstX + xs[i]) * STAFF_SPACE_PX)
    placed++
  }
  return placed > 0 ? { columns, xs } : null
}
