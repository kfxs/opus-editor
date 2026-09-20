/**
 * ⭐ **THE DYNAMIC's COMMANDS** — every edit the editor can make to a dynamic or an expression word,
 * built from a {@link CommandContext}; `MusicEngine` keeps `readonly dynamic = dynamicCommands(ctx)`,
 * and a caller writes `engine.dynamic.nudgeDynamicOffset(…)`. The ottava's arrangement.
 *
 * Everything a dynamic IS lives in `engine/models/dynamicOps`. ⚠️ A dynamic is a POINT mark, so it
 * has no ends and no squares: what it has is a slot (which beat, which staff), a side, and one
 * two-axis ink offset — and an edit to its LEVEL changes what plays, where an edit to its ink does not.
 */
import type { Dynamic } from '@/types/music'
import { dbg } from '@/utils/debug'
import { dynamicLabel } from '@/utils/dynamics'
import type { DynamicSlotTarget, DynamicStaffSlotTarget } from '../models/dynamicOps'
import { dynamicOffsetOverrideOf } from '../models/engravingOverrides'
import type { CommandContext } from './commandContext'

export type DynamicCommands = ReturnType<typeof dynamicCommands>

export function dynamicCommands(ctx: CommandContext) {
  return {
    /**
     * Add a dynamic at (measure, dynamic.beat). `beat` must be a slot-boundary beat.
     * Replaces any existing dynamic at the same (beat, voice). Interpreted level
     * marks affect playback loudness; custom text marks are silent. Saves undo state
     * when added.
     * @returns the stored Dynamic, or null if the measure does not exist.
     */
    addDynamic(measureNumber: number, dynamic: Omit<Dynamic, 'id'>): Dynamic | null {
      const created = ctx.model().addDynamic(measureNumber, dynamic)
      if (created) {
        ctx.mutate(`Add dynamic ${dynamicLabel(created)} at measure ${measureNumber}`)
      }
      return created
    },

    /**
     * Edit an existing dynamic (level / text / placement / beat / voice) by id.
     * Saves undo state when found. @returns the updated Dynamic, or null if missing.
     */
    updateDynamic(id: string, updates: Partial<Omit<Dynamic, 'id'>>): Dynamic | null {
      const updated = ctx.model().updateDynamic(id, updates)
      if (updated) {
        ctx.mutate(`Edit dynamic ${dynamicLabel(updated)}`)
      }
      return updated
    },

    /**
     * ⭐⭐ Move a dynamic — a level or an expression WORD, the same object — to the other lane: above
     * the staff ⇄ below it (his ask, 2026-08-22). The wedge's key, one family over;
     * `dynamicOps.flipDynamicPlacement` carries the rule about which offsets survive.
     *
     * ⚠️ A CONTENT edit — which side a mark stands on is engraving the writer authored, not a nudge —
     * so it saves undo state. @returns the side it now sits on.
     */
    flipDynamicPlacement(id: string): 'above' | 'below' | null {
      const placement = ctx.model().flipDynamicPlacement(id)
      if (placement) ctx.mutate(`Move dynamic ${placement} the staff`)
      return placement
    },

    /**
     * Remove a dynamic by id. Saves undo state when removed.
     * @returns true if a dynamic was removed.
     */
    removeDynamic(id: string): boolean {
      const removed = ctx.model().removeDynamic(id)
      if (removed) {
        ctx.mutate('Remove dynamic')
      }
      return removed
    },

    moveDynamicBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().moveDynamicBySlot(id, direction)
      if (ok) {
        ctx.mutate(direction === -1 ? 'Move dynamic back' : 'Move dynamic on')
        dbg(`[Dynamic] re-anchored ${id} ${direction === -1 ? 'back' : 'on'} one slot`)
      }
      return ok
    },

    /** Record ONE undo entry after a dynamic drag settles. */
    commitDynamicDrag(): void {
      ctx.commitPreviewed('Move dynamic')
    },

    /**
     * Live (preview) re-anchor of a dragged dynamic onto `target` — writes the model but records no
     * undo; {@link commitDynamicDrag} records the gesture once on the drop.
     *
     * ⚠️ **The whole-slot flavour**, so it drops the mark's sideways nudge like any re-anchor: the
     * drag reaches for this only when the ink has crossed onto ANOTHER STAFF
     * (`interactions/dynamicLane.systemSlotFor`), which is a jump and not a walk. Ordinary
     * within-lane crossings go through {@link previewDynamicSlotKeepingOffset} below, where the
     * whole point is that nothing visibly changes.
     *
     * ⭐ `target` names a STAFF as well as an address (2026-08-21): the staff below is a place a
     * dragged mark can land, not only the system below (`dynamicOps.setDynamicAtStaffSlot`).
     */
    previewDynamicSlot(id: string, target: DynamicStaffSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitDynamicDrag
      return ctx.model().setDynamicAtStaffSlot(id, target)
    },

    /** Hand a dynamic onto the lane slot at `target` KEEPING its hand-nudged offset, where
     *  {@link moveDynamicBySlot} drops it — one crossing of the mark's walk (`interactions/dynamicWalk`).
     *  No undo entry: {@link commitDynamicDrag} records the whole gesture once. */
    previewDynamicSlotKeepingOffset(id: string, target: DynamicSlotTarget): boolean {
      ctx.markDirty() // live drag, undo deferred to commitDynamicDrag
      return ctx.model().setDynamicAtSlotKeepingOffset(id, target)
    },

    /** The walk's RE-BASE: bookkeeping, not a hand nudge, so ⛔ never judged by the page limit
     *  ({@link previewHairpinEndpointRebase} has the reason). No undo entry of its own.
     *  ⚠️ EXPLORATORY (2026-08-31): a `dy` too, for the same reason `previewHairpinOffsetRebase` has
     *  one — a landing on another staff pays back what the ladder over there gave it, and that
     *  payment leaves the DRAWN mark exactly where the hand has it. */
    previewDynamicOffsetRebase(dynamicId: string, dx: number, dy = 0): boolean {
      if (!ctx.model().getDynamicById(dynamicId)) return false
      ctx.markDirty()
      return ctx.model().nudgeDynamicOffset(dynamicId, dx, dy)
    },

    /** Live (preview) side of the staff a dynamic is drawn on, no undo entry — the drop commits once.
     *  `previewHairpinPlacement`'s twin, and the drag's only writer of it: {@link
     *  flipDynamicPlacement} is the KEY's, and commits. */
    previewDynamicPlacement(id: string, placement: 'above' | 'below'): boolean {
      ctx.markDirty()
      return !!ctx.model().updateDynamic(id, { placement })
    },

    /** The undo-free twin of {@link nudgeDynamicOffset} — accumulates the same way, keeps the same
     *  page limit, records no undo step. One frame of a dynamic drag. */
    previewDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('dynamic', dynamicId, dx, dy)) return false
      if (!ctx.model().getDynamicById(dynamicId)) return false
      ctx.markDirty()
      return ctx.model().nudgeDynamicOffset(dynamicId, dx, dy)
    },

    /** Where {@link moveDynamicBySlot} would put the mark, without putting it there — the walk reads
     *  it to measure how far away the next stop is drawn (`dynamicOps.nextDynamicSlot`). */
    nextDynamicSlot(id: string, direction: 1 | -1): DynamicSlotTarget | null {
      return ctx.model().nextDynamicSlot(id, direction)
    },

    /**
     * Nudge a selected dynamic's position offset by `(dx, dy)` staff-spaces and save ONE undo step
     * (the ←→↑↓ / Ctrl+arrow keyboard fine-positioning — see docs/dynamic-offset-plan.md). The
     * override is element-id-keyed (dynamics have durable ids), so this delegates straight to the
     * model with the dynamic id. A no-op for a missing id.
     * @returns true if the dynamic was nudged.
     */
    nudgeDynamicOffset(dynamicId: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('dynamic', dynamicId, dx, dy)) return false
      if (!ctx.model().getDynamicById(dynamicId)) return false
      const ok = ctx.model().nudgeDynamicOffset(dynamicId, dx, dy)
      if (ok) {
        ctx.mutate('Nudge dynamic')
        const off = dynamicOffsetOverrideOf(ctx.model().getScore(), dynamicId)
        dbg(`[Dynamic] nudge ${dynamicId} by (${dx}, ${dy}) → offset (${off?.x ?? 0}, ${off?.y ?? 0}) staff-space(s)`)
      }
      return ok
    },

    /**
     * `Ctrl+Backspace` on a selected DYNAMIC / TEMPO mark: drop its hand nudge (his report,
     * 2026-08-19 — *"the ctr backspace is not working for me"*, on the tempo offset built that day;
     * the dynamic had the same hole since its own offset shipped).
     * @returns false when the mark carries no nudge, so the key falls through to its other tenants.
     */
    resetDynamicOffset(id: string): boolean {
      const ok = ctx.model().resetDynamicOffset(id)
      if (ok) ctx.mutate('Reset dynamic nudge')
      return ok
    },
  }
}
