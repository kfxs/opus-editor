/**
 * ⭐⭐ **A HELD KEY IS A GESTURE, so it is ONE undo entry and ONE render** — his rule, 2026-08-30,
 * given for the trill and then for all of them: *"for the undo with the key held is easy, cause we
 * don't have to record all changes with the key held, just know what was the previous state before
 * the held, so we go back — it is just a walking"*, and then *"we should apply the same solution of
 * the held to all walkings: pedal, ottava, hairpin, dynamics and tempo"*.
 *
 * ## What a run costs, and what it used to
 *
 * 🚨 Measured on his Prelude (35 bars, 450 KB of score), holding `Ctrl+←` on a trill:
 *
 * ```
 * [Trill key] press 50.4ms = walk 25.6ms + render 24.8ms      against a ~33ms key repeat
 * ```
 *
 * Both halves were the same mistake — **treating a repeat as an isolated edit**. The render
 * re-derived 35 bars of music that had not changed, and the walk's model write recorded an undo
 * entry, which is a SNAPSHOT of the whole score, thirty times a second. A drag has never paid
 * either: its frames write through `preview*` ops and its DROP commits once
 * (docs/history/render-performance-plan.md §12.5a). A key run had no drop — so this is it.
 *
 * ## The run
 *
 * Each accepted press draws the cheap picture and re-arms one timer. When the repeats stop, the run
 * settles: **one commit** (the family's own `commit…Drag`, which pushes the state the walk arrived
 * at, so a single `Ctrl+Z` returns to where the key went down) and **one real render** (which is
 * also what re-stacks the ladder and re-casts the page, exactly as a drop does — a preview
 * deliberately does neither).
 *
 * ⚠️ **A run belongs to one mark**: a press on another mark, or another kind, settles the run in
 * flight before starting its own. ⛔ Otherwise the second mark's commit would take the first one's
 * edit with it.
 *
 * ⚠️ **Only the WALKS are runs so far** — the horizontal, which is what he named. The verticals
 * (`nudgeWhole` / `nudgeEnd`) still record an entry per press and render for real; they have the
 * same freeze and should follow, but they are a different set of ops and his eye has not asked yet.
 */
import { dbg } from '../../utils/debug'

/**
 * ⏱ How long after the LAST press a run waits before settling. ⚠️ Comfortably longer than a key
 * repeat (~33 ms) so a held key settles once, and short enough that letting go feels immediate.
 */
export const KEY_RUN_SETTLE_MS = 150

/** What one family hands the run — see {@link keyRunTick}. */
export interface KeyRunSpec {
  /** ⭐ Which mark this run belongs to. A different value settles the run in flight first. */
  key: string
  /** The family's `commit…Drag`: ONE undo entry for the whole run. */
  commit: () => void
  /** The cheap per-press picture (`RenderController.previewMarks`). */
  preview: () => void
  /** The real render, paid once when the repeats stop. */
  render: () => void
}

let open: (KeyRunSpec & { timer: ReturnType<typeof setTimeout>; presses: number }) | null = null

/**
 * ⭐ **ONE ACCEPTED PRESS** — draw it cheaply and (re-)arm the settle. ⛔ Call it only when the walk
 * actually wrote something: a refused press must not open a run, or the settle commits an entry for
 * an edit that never happened.
 */
export function keyRunTick(spec: KeyRunSpec): void {
  if (open && open.key !== spec.key) settleKeyRun()
  const presses = (open?.presses ?? 0) + 1
  if (open) clearTimeout(open.timer)
  spec.preview()
  open = { ...spec, presses, timer: setTimeout(settleKeyRun, KEY_RUN_SETTLE_MS) }
}

/**
 * ⭐⭐ **THE RUN'S DROP** — the commit, then the render, in that order: `commitPreviewed` records
 * history and deliberately does NOT re-engrave (it would paint a picture already on screen), so the
 * render that follows is the one that re-casts the page.
 *
 * Exported for the caller that knows the run is over before the timer does — a spec, or a gesture
 * that must not be interleaved with one.
 *
 * @returns true when a run was settled.
 */
export function settleKeyRun(): boolean {
  if (!open) return false
  const run = open
  open = null
  clearTimeout(run.timer)
  run.commit()
  run.render()
  dbg(`[Key run] ${run.key} settled after ${run.presses} press${run.presses === 1 ? '' : 'es'}`
    + ' — ONE undo entry, ONE real render')
  return true
}

/**
 * ⛔ **A RUN'S `runBatch`: there is no undo entry to batch.** `markDrive` opens a batch so a crossing
 * press's two writes land as ONE entry — but a run's presses write through `preview*` ops and record
 * nothing, and `runBatch` costs the very snapshot the run exists to avoid. **The RUN is the entry**
 * ({@link settleKeyRun}).
 */
export function withoutAnEntry(_description: string, fn: () => void): boolean {
  fn()
  return true
}
