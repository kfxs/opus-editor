/**
 * ⭐ **THE TUPLET's COMMANDS** — the edits the editor makes to a tuplet that already stands in the score,
 * built from a {@link CommandContext}; `MusicEngine` keeps `readonly tuplet = tupletCommands(ctx)`, and a
 * caller writes `engine.tuplet.setFormat(…)`. The dynamic's arrangement (`./dynamicCommands`).
 * Everything a tuplet IS lives in `engine/models/tupletOps`; CREATING one is note entry's
 * (`NoteEntryCoordinator`).
 */
import { dbg } from '@/utils/debug'
import { getTuplet, setTupletFormat, setTupletPlacement, type TupletFormatEdit } from '../models/tupletOps'
import { tupletOffsetOverrideOf } from '../models/engravingOverrides'
import { nudgeTupletOffset, resetMarkOffset } from '../models/overrideOps'
import type { CommandContext } from './commandContext'

export type TupletCommands = ReturnType<typeof tupletCommands>

export function tupletCommands(ctx: CommandContext) {
  return {
    /**
     * ⭐ The FORMAT — what the mark prints, the bracket (`auto` / `always` / `never`), where it ends (his ask,
     * 2026-09-25: *"the user should be able to select for the brackets: auto, show, hide"*, then *"the other
     * formats … should be able to reconfigure manually by the user in the properties"*). ONE undo entry for
     * the edit, however many fields. ⛔ An edit that changes nothing (a `<select>` re-pick) writes NOTHING: an
     * undo entry that takes back a no-op is a step nobody can see. @returns true when something changed.
     */
    setFormat(id: string, edit: TupletFormatEdit): boolean {
      const score = ctx.model().getScore()
      const current = getTuplet(score, id)
      if (!current) return false
      const changes: string[] = []
      if (edit.numberStyle !== undefined && (current.numberStyle ?? 'auto') !== edit.numberStyle) changes.push(`number ${edit.numberStyle}`)
      if (edit.bracket !== undefined && (current.bracket ?? 'auto') !== edit.bracket) changes.push(`bracket ${edit.bracket}`)
      if (edit.bracketEnd !== undefined && current.bracketEnd !== edit.bracketEnd) changes.push(`bracket end ${edit.bracketEnd}`)
      if (!changes.length) return false
      setTupletFormat(score, id, edit)
      ctx.mutate(`Tuplet ${changes.join(', ')}`)
      dbg(`✓ Tuplet ${changes.join(', ')} | ${id}`)
      return true
    },

    /**
     * ⭐ Nudge the bracket and its number VERTICALLY by `dy` staff-spaces, SCREEN-signed (+ down) — ↑/↓ on a
     * selected tuplet (his ask, 2026-09-25). One undo entry per press. ⚠️ The page limit is asked, and
     * ANSWERS "allow" today: it finds the drawn ink by `id`, and a tuplet is filed under `tupletId` — noted,
     * ⛔ not worked around here (the limit's own seam is the place).
     */
    nudgeOffset(id: string, dy: number): boolean {
      if (dy === 0) return false
      const score = ctx.model().getScore()
      if (!getTuplet(score, id)) return false
      if (!ctx.limits.nudgeStaysOnPage('tuplet', id, 0, dy)) return false
      nudgeTupletOffset(score, id, dy)
      ctx.mutate('Nudge tuplet')
      dbg(`[Tuplet] nudge ${id} by ${dy} → offset y ${tupletOffsetOverrideOf(score, id)?.y ?? 0} staff-space(s)`)
      return true
    },

    /** `Ctrl+Backspace`: the engraver's own place back. DECLINES (false) when nothing was nudged. */
    resetOffset(id: string): boolean {
      const ok = resetMarkOffset(ctx.model().getScore(), id, 'tupletOffset')
      if (ok) ctx.mutate('Reset tuplet nudge')
      return ok
    },

    /**
     * Flip the mark's SIDE with a Sibelius-style `x` toggle: auto ↔ flipped. A tuplet carrying an explicit
     * `placement` goes back to the auto (voice/stem) rule; one on auto pins the side OPPOSITE to whatever
     * was last DRAWN (read from the registry), so the first press always visibly flips, and two presses
     * round-trip to auto. One undo step. @returns true if it flipped. (Moved from the facade, 2026-09-25.)
     */
    flip(id: string): boolean {
      const score = ctx.model().getScore()
      const current = getTuplet(score, id)
      if (!current) return false
      if (current.placement !== undefined) {
        setTupletPlacement(score, id, undefined)
        ctx.mutate('Reset tuplet to auto')
        return true
      }
      // A stubbed / headless renderer has no drawing: fall back to "above" (LOCATION_TOP = 1).
      // 🚨 The registry files a tuplet under `tupletId`, ⛔ not `id` (his report, 2026-09-25: *"press x but x
      //    is not working"* — a lookup by `id` found nothing, assumed "above", and pinned the side it was on).
      const drawn = ctx.registry().getByType?.('tuplet')?.find(el => el.tupletId === id)
      const currentDir = drawn?.tupletGeometry?.location ?? 1
      setTupletPlacement(score, id, currentDir === 1 ? 'below' : 'above')
      ctx.mutate('Flip tuplet')
      return true
    },
  }
}
