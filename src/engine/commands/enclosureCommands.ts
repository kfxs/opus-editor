/**
 * ⭐ **PARENTHESISED NOTES' commands** — the editor's half of an edit to a head's brackets: the ops
 * call and the undo entry. Reached as `engine.enclosure.<command>(…)`. What the brackets ARE, and what
 * refuses them, is `engine/models/enclosureOps` (`docs/plans/parenthesised-note-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import type { HeadEnclosure } from '@/types/music'
import {
  enclosureHeads, enclosureOf, enclosureOwner, enclosureProblems, enclosureSpanState, setEnclosure, setEnclosureSpan, toggleEnclosure,
} from '../models/enclosureOps'
import type { CommandContext } from './commandContext'

export type EnclosureCommands = ReturnType<typeof enclosureCommands>

export function enclosureCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /** The brackets this head wears (undefined = none). */
    of: (pitchId: string): HeadEnclosure | undefined => enclosureOf(score(), pitchId),

    /** Put `shape` on each head, or take the brackets off (`null`). ONE undo entry.
     *  @returns how many heads changed. */
    set(pitchIds: readonly string[], shape: HeadEnclosure | null): number {
      const changed = setEnclosure(score(), pitchIds, shape)
      if (changed) ctx.mutate(shape ? 'Parenthesise notes' : 'Remove parentheses')
      return changed
    },

    /**
     * ⭐ The button: any head without brackets ⇒ all get them; all with ⇒ all lose them
     * (`enclosureOps.toggleEnclosure`). ONE undo entry.
     * @returns what was written, or undefined when no id named a head (nothing recorded).
     */
    toggle(pitchIds: readonly string[], shape: HeadEnclosure = 'round'): HeadEnclosure | null | undefined {
      const before = pitchIds.map(id => enclosureOf(score(), id))
      const next = toggleEnclosure(score(), pitchIds, shape)
      if (next === undefined) return undefined
      if (pitchIds.some((id, i) => enclosureOf(score(), id) !== before[i])) ctx.mutate(next ? 'Parenthesise notes' : 'Remove parentheses')
      return next
    },

    /** ⭐ P5 — the chord's one-pair switch: one pair round the whole chord, or `null` for a pair per head.
     *  ⛔ Refused (no undo entry) unless every head wears brackets. */
    setSpan(pitchId: string, span: 'chord' | null): boolean {
      if (!setEnclosureSpan(score(), pitchId, span)) return false
      ctx.mutate(span ? 'Brackets round the chord' : 'Brackets per note')
      return true
    },

    /** The heads a selected pair covers (this one, or the whole chord's when its one pair is in force). */
    headsOf: (pitchId: string): string[] => enclosureHeads(score(), pitchId),

    /** The head whose id names the drawn pair this head's brackets are in. */
    ownerOf: (pitchId: string): string => enclosureOwner(score(), pitchId),

    /** The chord's switch as the Properties row shows it — see `enclosureSpanState`. */
    spanOf: (pitchId: string) => enclosureSpanState(score(), pitchId),

    /** What a loaded file says that this build cannot draw — see `enclosureProblems`. */
    problems: (): string[] => enclosureProblems(score()),
  }
}
