import type { EditorState } from './EditorState'
import { selectedOf } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { resolveStaffSize, DEFAULT_STAFF_SIZE } from '../engine/models/staffSize'
import { staffIdAtIndex } from '../engine/models/staffContent'
import { dbg } from '../utils/debug'

/**
 * The staff-size control — still **deliberately crude** (docs/staff-size-plan.md P1): two values, one
 * of which is this module's choice, exercising the infrastructure while it is iterated on.
 *
 * ⚠️ It lived in `dev/` until the bar's Staff menu offered it (Staff ▸ Small Staff). That menu SHIPS,
 * and nothing that ships may import `dev/` — the shell has to stay deletable — so the rule moved here
 * and the dev toolbar's button became the second caller rather than the only one. The crudeness is
 * unchanged and so is the plan: whatever the real control turns out to be writes the same ratio
 * through the same `MusicEngine.setStaffSize`.
 *
 * Click empty space in a bar (the SINGLE box) to say which staff, then press it: that staff flips
 * between full size and small. Same gesture and same target as the `+ Above` / `+ Below` staff
 * buttons beside it — a staff-structure edit relative to the clicked staff.
 *
 * ⭐ **The two values are the BUTTON's business, never the model's.** What is stored is a ratio
 * (`StaffInfo.size`), and every positive number is legal; a toggle needs to pick two of them, and
 * picking them here is what keeps the model from learning that a staff is "small" or "normal".
 * The real control — whatever it turns out to be, a Properties field or a staff context menu — will
 * write the same number through the same `MusicEngine.setStaffSize`, so it costs one call site.
 *
 * The logic is here rather than inline in `devToolbar` for the ordinary reason: the toolbar is a
 * strip of one-line buttons, and "which staff, and what does pressing it mean" is neither.
 */

/** The size the button flips TO. Scaffolding's choice of a small staff — a cue-size part is
 *  conventionally engraved around 0.7 of full size. Nothing in the model knows this number. */
export const DEV_SMALL_STAFF_SIZE = 0.7

/** Which staff the button would act on, and how big it is drawn today. */
export interface StaffSizeTarget {
  /** 0-based index into `score.staves` — what the selection box carries. */
  staffIndex: number
  /** Its durable id — what the model is keyed by. */
  staffId: string
  /** The ratio in force right now (1 = full size). */
  size: number
}

/**
 * The staff of the plain-click-selected bar, or `null` when there is no such selection (nothing
 * selected, or a Ctrl+Shift+click measure-RANGE box, which is a measure-structure gesture and says
 * nothing about a staff). Mirrors `PaletteController.staffContext`, deliberately: two gestures,
 * two meanings, and this is the staff one.
 */
export function staffSizeTarget(state: EditorState, engine: MusicEngine | null): StaffSizeTarget | null {
  if (!engine) return null
  const box = selectedOf(state, 'measureRange')
  if (!box || box.boxStyle !== 'single') return null
  const staffId = staffIdAtIndex(engine.getScore(), box.staff)
  if (staffId === undefined) return null
  return { staffIndex: box.staff, staffId, size: resolveStaffSize(engine.getScore(), staffId) }
}

/**
 * Is the selected bar's staff drawn at anything other than full size? The button's lit state, asked
 * of the MODEL rather than pushed by the click — so undo, a reload and a future second control all
 * show the truth. Nothing selected reads as "no", not as "unknown": the button is simply dark.
 *
 * ⚠️ Deliberately `!== 1`, not `=== 0.7`. The stored value is a ratio and something else may well
 * have written 0.55; a light that only knows the button's own two numbers would go dark on a staff
 * that is visibly small.
 */
export function isSelectedStaffSmall(state: EditorState, engine: MusicEngine | null): boolean {
  const target = staffSizeTarget(state, engine)
  return target !== null && target.size !== DEFAULT_STAFF_SIZE
}

/**
 * Flip the selected bar's staff between small and full size, as ONE undo entry (the engine's).
 * A no-op when no bar is plain-click-selected. @returns whether the score changed — the caller
 * repaints on true.
 */
export function toggleSelectedStaffSize(state: EditorState, engine: MusicEngine | null): boolean {
  const target = staffSizeTarget(state, engine)
  if (!target || !engine) {
    dbg('[StaffSize] no bar selected (click empty space in a bar first)')
    return false
  }
  // Anything that is not full size goes back to full size — see isSelectedStaffSmall on why the
  // question is "small?" and not "0.7?".
  const next = target.size === DEFAULT_STAFF_SIZE ? DEV_SMALL_STAFF_SIZE : DEFAULT_STAFF_SIZE
  const changed = engine.setStaffSize(target.staffIndex, next)
  dbg(`[StaffSize] staff ${target.staffIndex} ${target.size} → ${next}${changed ? '' : ' (refused)'}`)
  return changed
}
