import type { MusicEngine } from '../engine/MusicEngine'
import { fanEditSelection, type FanEditRequest } from './fanEditSelection'
import { clampFanBeams, clampFanCount, fanRampRange, fanSpread } from '../utils/fannedBeam'
import { dbg } from '../utils/debug'
import type { FanMark } from '../types/music'

/**
 * Applies a Properties-panel fan edit to the engine (docs/fanned-beams-plan.md §3, P4). The window is
 * a **dumb publisher**: it writes `{noteId, count?, beams?}` to {@link fanEditSelection}, and this
 * controller — the one place that holds `getEngine` — merges it into the fan the note is wearing and
 * repaints.
 *
 * ⭐ It CHANGES a fan, it never makes one. A note with no fan is a no-op: creating and removing them
 * is the `accel.` / `rit.` press, which is also where the direction lives. Two surfaces, one for
 * "is this note a fan" and one for "what shape is it" — an edit box that could conjure a notation
 * out of a typed number would be a third answer to a question already settled.
 *
 * The same shape as {@link NoteOffsetController}, and for the same boundary reason: a content widget
 * never holds the engine, and App.ts stays construction-only.
 */
export class FanEditController {
  private unsubscribe: () => void

  constructor(
    private getEngine: () => MusicEngine | null,
    private renderScore: () => void,
  ) {
    this.unsubscribe = fanEditSelection.onSet((req) => this.apply(req))
  }

  private apply({ noteId, count, beams, rampFrom, rampTo, spread }: FanEditRequest): void {
    const engine = this.getEngine()
    if (!engine) return
    const current = engine.getNote(noteId)?.fan
    if (!current) return // nothing to change — see the class note

    // ⚠️ SPREAD, so the members come along — a typed count is a change to the group's size, not an
    // instruction to throw its pitches away. `ScoreModel.setFan` runs them through `normalizeFan`,
    // which is what actually grows or shrinks the list; rebuilding the mark field-by-field here
    // would silently re-materialise every member from the typed note (plan §1).
    // `current` is the LIVE `chord.fan` (`toFlatNote` hands out the reference), so nothing below may
    // mutate it — and `normalizeFan` is pure for exactly that reason.
    const next: FanMark = {
      ...current,
      count: clampFanCount(count ?? current.count),
      beams: clampFanBeams(beams ?? current.beams),
    }
    // ⚠️ The ramp range is NOT clamped here, and that is deliberate: holding it inside the count
    // needs the count, and `setFan` → `normalizeFan` is the one place that has it *and* is allowed
    // to write it (docs/fan-ramp-range-plan.md §1). This merges; it does not decide.
    if (rampFrom !== undefined) next.rampFrom = rampFrom
    if (rampTo !== undefined) next.rampTo = rampTo
    if (spread !== undefined) next.spread = spread

    // No change → no edit, and no empty undo entry (the rule `NoteOffsetController` follows).
    //
    // 🚨 **The range is compared RESOLVED, not field-for-field.** Absence and "the whole group" are
    // the same assertion spelled two ways, and the window always publishes a number — so typing the
    // ends it already has would otherwise look like a change here, mint an undo entry, and be
    // dropped again by `normalizeFan` with nothing on the page to show for it.
    // 🚨 …and the SPREAD is compared resolved for the identical reason: absence IS 1, and the window
    // publishes a number. This guard is where a new fan field ships dead — it returns before `setFan`
    // on every press that changed nothing it knows about, so a field it does not know about changes
    // nothing, ever, with nothing red to show for it.
    const before = fanRampRange(current)
    const after = fanRampRange(next)
    if (
      next.count === current.count && next.beams === current.beams
      && after.from === before.from && after.to === before.to
      && fanSpread(next) === fanSpread(current)
    ) return

    // `runBatch` for the undo entry, `setFan` for the write — the same pair `pressFan` uses, so a
    // typed number and a button press are one kind of edit in the history. The range is named in the
    // description only when it is inset, 1-based to match what he typed.
    const inset = after.from > 0 || after.to < next.count - 1
    const wide = fanSpread(next) !== 1 ? ` ×${fanSpread(next)}` : ''
    const label = `Fan ${next.count}×${next.beams}${inset ? ` ${after.from + 1}–${after.to + 1}` : ''}${wide}`
    if (!engine.runBatch(label, () => { engine.setFan(noteId, next) })) return
    this.renderScore()
    dbg(`[Fan] Properties set ${noteId} → ${next.count} notes, ${next.beams} beams, ramp ${after.from}…${after.to}, spread ${fanSpread(next)}`)
  }

  /** Dispose the subscription when the app tears down, like every wire. */
  destroy(): void {
    this.unsubscribe()
  }
}
