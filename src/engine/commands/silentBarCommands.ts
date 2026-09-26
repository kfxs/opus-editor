/**
 * ⭐ **THE STAMPED FULL-BAR REST's commands** — the editor's half: the ops call and the undo entry.
 * Reached as `engine.silentBar.<command>(…)`. What the stamp does to the bar is `engine/models/barRestOps`
 * (docs/plans/voice-measure-rest-plan.md).
 *
 * ⛔ No `mutate` when nothing changed: stamping a lane that already holds its stamped rest is no edit.
 */
import { stampBarRest, stampedBarRestAt } from '../models/barRestOps'
import type { CommandContext } from './commandContext'

export type SilentBarCommands = ReturnType<typeof silentBarCommands>

export function silentBarCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /** The lane's stamped full-bar rest in that bar — its id, or null. `voice` is the model's (0-based). */
    at: (measure: number, staff: number, voice: number): string | null =>
      stampedBarRestAt(score(), measure, staff, voice)?.id ?? null,

    /** Stamp one — ONE undo entry. @returns the new rest's id, or null when nothing changed. */
    stamp(measure: number, staff: number, voice: number): string | null {
      const rest = stampBarRest(score(), measure, staff, voice)
      if (!rest) return null
      ctx.mutate(`Full-bar rest (voice ${voice + 1}) at measure ${measure}`)
      return rest.id
    },

    /**
     * Stamp several lanes — each `{ measure, staff, voice }` once — as ONE undo entry.
     * @returns the stamped rest of every lane (new or already there), and how many lanes CHANGED
     *   (0 ⇒ no entry).
     */
    stampLanes(lanes: readonly { measure: number; staff: number; voice: number }[]): { ids: string[]; changed: number } {
      const seen = new Set<string>()
      const ids: string[] = []
      let changed = 0
      for (const { measure, staff, voice } of lanes) {
        const key = `${measure}|${staff}|${voice}`
        if (seen.has(key)) continue
        seen.add(key)
        const rest = stampBarRest(score(), measure, staff, voice)
        if (rest) changed++
        const id = rest?.id ?? stampedBarRestAt(score(), measure, staff, voice)?.id
        if (id) ids.push(id)
      }
      if (changed) {
        const bars = [...new Set(lanes.map(l => l.measure))].sort((x, y) => x - y)
        const where = bars.length === 1 ? `measure ${bars[0]}` : `measures ${bars[0]}–${bars[bars.length - 1]}`
        ctx.mutate(`Full-bar rest at ${where}`)
      }
      return { ids, changed }
    },

    /** Every bar × staff of a passage (the selected bars), in one voice — {@link stampLanes}. @returns lanes changed. */
    stampPassage(
      passage: { fromMeasure: number; toMeasure: number; fromStaff: number; toStaff: number },
      voice: number,
    ): number {
      const lanes: { measure: number; staff: number; voice: number }[] = []
      for (let m = passage.fromMeasure; m <= passage.toMeasure; m++) {
        for (let staff = passage.fromStaff; staff <= passage.toStaff; staff++) lanes.push({ measure: m, staff, voice })
      }
      return this.stampLanes(lanes).changed
    },
  }
}
