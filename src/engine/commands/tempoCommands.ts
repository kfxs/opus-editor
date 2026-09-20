/**
 * ⭐ **THE TEMPO MARK's COMMANDS** — every edit the editor can make to one, built from a
 * {@link CommandContext}; `MusicEngine` keeps `readonly tempo = tempoCommands(ctx)`, and a caller
 * writes `engine.tempo.nudgeTempoOffset(…)`. The dynamic's arrangement (`./dynamicCommands`).
 *
 * Everything a tempo mark IS lives in `engine/models/tempoOps`. ⭐ It is SYSTEM-level — it governs
 * the clock, not a staff — so unlike the dynamic's, none of these takes a staff. ⚠️ Its vertical
 * offset is stored OUTWARD (+ is up, away from the staff), and the page limit is asked in screen
 * terms; the command is where the two meet.
 */
import type { TempoMark } from '@/types/music'
import { dbg } from '@/utils/debug'
import { tempoLabel } from '@/utils/tempoMap'
import { tempoOffsetOverrideOf } from '../models/engravingOverrides'
import type { Stop as TempoStop } from '../models/tempoOps'
import type { CommandContext } from './commandContext'

export type TempoCommands = ReturnType<typeof tempoCommands>

export function tempoCommands(ctx: CommandContext) {
  return {
    /**
     * Add a tempo mark at (measure, mark.beat) — a word ('Allegro'), a metronome (♩ = 120),
     * or both. `beat` must be a slot-boundary beat; an existing mark on that beat is
     * REPLACED (one clock statement per point in time). `text` is what gets PRINTED, `bpm` what
     * SOUNDS — and a mark can sound without printing its number (the word 'Allegro' quietly
     * meaning 144), which is why they are separate fields.
     * Saves undo state when added.
     * @returns the stored TempoMark, or null if the measure does not exist.
     * @throws if bpm is outside 20..300.
     */
    addTempoMark(measureNumber: number, mark: Omit<TempoMark, 'id'>): TempoMark | null {
      const created = ctx.model().addTempoMark(measureNumber, mark)
      if (created) {
        ctx.mutate(`Add tempo ${tempoLabel(created)} at measure ${measureNumber}`)
      }
      return created
    },

    /**
     * Edit an existing tempo mark by id (text / unit / dots / bpm / beat). The mark IS its text:
     * `text` is stored verbatim and `unit`/`dots`/`bpm` are the speed parsed out of it, so the two
     * are written together (utils/tempoText).
     * Saves undo state when found. @returns the updated TempoMark, or null if missing.
     */
    updateTempoMark(id: string, updates: Partial<Omit<TempoMark, 'id'>>): TempoMark | null {
      const updated = ctx.model().updateTempoMark(id, updates)
      if (updated) {
        ctx.mutate(`Edit tempo ${tempoLabel(updated)}`)
      }
      return updated
    },

    /**
     * Remove a tempo mark by id. The score reverts to the previous mark's tempo (or
     * DEFAULT_TEMPO if it was the only one). Saves undo state when removed.
     * @returns true if a mark was removed.
     */
    removeTempoMark(id: string): boolean {
      const removed = ctx.model().removeTempoMark(id)
      if (removed) {
        ctx.mutate('Remove tempo mark')
      }
      return removed
    },

    /**
     * Nudge a selected TEMPO mark's position offset by `(dx, dy)` staff-spaces and save ONE undo step
     * — the ←→↑↓ / Ctrl+arrow fine-positioning, his ask of 2026-08-19.
     *
     * {@link nudgeDynamicOffset} above in all but one respect: same page limit, same id-keyed override,
     * same accumulate-and-clear-at-zero in the model — but ⚠️ **`dy` is OUTWARD here, +up**, because a
     * tempo mark is always drawn above the staff and a number a human types about it means *how far
     * from the staff*. See {@link TempoOffsetOverride}; the sign is converted here and in the render,
     * nowhere else.
     * @returns true if the mark was nudged; false for an unknown id or a step the page refuses.
     */
    nudgeTempoOffset(tempoId: string, dx: number, dy: number): boolean {
      // 🚨 `dy` is OUTWARD (+up) for this mark alone — see `TempoOffsetOverride`. The page limit reasons
      // in SCREEN pixels, so the sign is flipped for it and only for it.
      if (!ctx.limits.nudgeStaysOnPage('tempo', tempoId, dx, -dy)) return false
      if (!ctx.model().getTempoMarkById(tempoId)) return false
      const ok = ctx.model().nudgeTempoOffset(tempoId, dx, dy)
      if (ok) {
        ctx.mutate('Nudge tempo mark')
        const off = tempoOffsetOverrideOf(ctx.model().getScore(), tempoId)
        dbg(`[Tempo] nudge ${tempoId} by (${dx}, ${dy}) → offset (${off?.x ?? 0}, ${off?.y ?? 0}) staff-space(s)`)
      }
      return ok
    },

    /**
     * Move a tempo mark one onset back (−1) or on (+1) — `Ctrl+Shift+←/→` with the mark selected, the
     * RE-ANCHOR (his ask, 2026-08-19).
     *
     * ⚠️ **A CONTENT edit, and an AUDIBLE one**, where the plain / `Ctrl` arrow on the same selection
     * writes an engraving override: the tempo applies from the beat this writes, so the tempo map and
     * every scheduled note after it move with the mark. Two chords, two categories — `moveDynamicBySlot`
     * above is the same arrangement on the letters. Saves ONE undo entry per press.
     * @returns true when the mark moved; false (declining the key) at either end of the score, when the
     *   stop it would land on already holds a mark, or for an id no longer in the score.
     */
    moveTempoBySlot(id: string, direction: 1 | -1): boolean {
      const ok = ctx.model().moveTempoBySlot(id, direction)
      if (ok) {
        ctx.mutate(direction === -1 ? 'Move tempo mark back' : 'Move tempo mark on')
        dbg(`[Tempo] re-anchored ${id} ${direction === -1 ? 'back' : 'on'} one onset`)
      }
      return ok
    },

    /** Hand a tempo mark onto `target` KEEPING its hand-nudged offset, where {@link moveTempoBySlot}
     *  drops it — one crossing of the mark's walk (`interactions/tempoWalk`). No undo entry:
     *  {@link commitTempoDrag} records the whole gesture once. */
    previewTempoSlotKeepingOffset(id: string, target: TempoStop): boolean {
      ctx.markDirty() // live drag, undo deferred to commitTempoDrag
      return ctx.model().setTempoAtSlotKeepingOffset(id, target)
    },

    /** The whole-stop flavour, undo-free: what a drag lands with when the ink has left the mark's own
     *  SYSTEM (`interactions/tempoWalk`), which is a jump and not a walk — so it drops the nudge. */
    previewTempoSlot(id: string, target: TempoStop): boolean {
      ctx.markDirty()
      return ctx.model().setTempoAtSlot(id, target)
    },

    /** The walk's RE-BASE: bookkeeping, not a hand nudge, so ⛔ never judged by the page limit
     *  ({@link previewHairpinEndpointRebase} has the reason). No undo entry of its own. ⚠️ `dx` only:
     *  no walk has a vertical, so the mark's OUTWARD `dy` never comes through here. */
    previewTempoOffsetRebase(id: string, dx: number): boolean {
      if (!ctx.model().getTempoMarkById(id)) return false
      ctx.markDirty()
      return ctx.model().nudgeTempoOffset(id, dx, 0)
    },

    /** The undo-free twin of {@link nudgeTempoOffset} — accumulates the same way, keeps the same page
     *  limit (and its OUTWARD `dy`), records no undo step. One frame of a tempo drag. */
    previewTempoOffset(id: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('tempo', id, dx, -dy)) return false
      if (!ctx.model().getTempoMarkById(id)) return false
      ctx.markDirty()
      return ctx.model().nudgeTempoOffset(id, dx, dy)
    },

    /** Record ONE undo entry after a tempo drag settles. */
    commitTempoDrag(): void {
      ctx.commitPreviewed('Move tempo mark')
    },

    /** Where {@link moveTempoBySlot} would put the mark, without putting it there — the walk reads it
     *  to measure how far away the next stop is drawn. */
    nextTempoSlot(id: string, direction: 1 | -1): TempoStop | null {
      return ctx.model().nextTempoSlot(id, direction)
    },

    resetTempoOffset(id: string): boolean {
      const ok = ctx.model().resetTempoOffset(id)
      if (ok) ctx.mutate('Reset tempo nudge')
      return ok
    },
  }
}
