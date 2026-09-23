/**
 * ⭐ **BRACKETED GRACES' commands** — the editor's half of an edit to one: the ops call and the undo
 * entry. Reached as `engine.bracketed.<command>(…)`. What a bracketed grace IS, and what it refuses,
 * is `engine/models/bracketedGraceOps` (`docs/plans/bracketed-grace-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import type { BracketedGrace, Fraction, NoteDuration, NotePitch } from '@/types/music'
import { beatRestAt } from '../models/restGraceOps'
import { bracketedToGrace, bracketedToNote, convertNoteToBracketed, graceToBracketed } from '../models/noteToBracketedOps'
import type { GraceForm } from '../models/graceOps'
import type { BracketedSide } from '@/utils/bracketedGraces'
import {
  addBracketed, addBracketedPitch, bracketedProblems, findBracketed, isBracketedGrace, removeBracketed, setBracketedPitch,
  setBracketedSide, setBracketedWritten,
  type BracketedSpelling, type FoundBracketed,
} from '../models/bracketedGraceOps'
import type { CommandContext } from './commandContext'
import { offsetTargetOf } from '../models/slotLookup'
import { nudgeNoteOffset } from '../models/overrideOps'
import { noteOffsetOverrideOf } from '../models/engravingOverrides'

export type BracketedCommands = ReturnType<typeof bracketedCommands>

export function bracketedCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /**
     * Put a bracketed grace beside the target `targetNoteId` names — see {@link addBracketed}. ⭐ On a
     * whole-bar REST, `beat` (the click's) names the beat it belongs to: the rest becomes a one-beat rest
     * there first (`restGraceOps.beatRestAt`, the grace's rule), in the same undo entry.
     */
    add(
      targetNoteId: string, side: BracketedSide, spelling: BracketedSpelling, index?: number, beat?: Fraction,
      /** What its head is drawn as (B7 revised); absent = a quarter's black head. */
      duration?: NoteDuration,
    ): BracketedGrace | null {
      const target = beat ? beatRestAt(score(), targetNoteId, beat)?.id ?? targetNoteId : targetNoteId
      const made = addBracketed(score(), target, side, spelling, index, duration)
      if (made) ctx.mutate('Add bracketed grace')
      return made
    },

    /** A second head in a bracketed grace — see {@link addBracketedPitch}. */
    addPitch(bracketedPitchId: string, spelling: BracketedSpelling): NotePitch | null {
      const made = addBracketedPitch(score(), bracketedPitchId, spelling)
      if (made) ctx.mutate('Add bracketed pitch')
      return made
    },

    /**
     * ⭐ The `bracket.` button with NOTES selected (his rule, 2026-09-23) — each becomes a bracketed grace
     * before the rest that takes its place (`models/noteToBracketedOps`). ONE undo entry for all of them.
     * @returns the new bracketed graces' first pitch ids (the notes' own), for the caller to select.
     */
    convertNotes(noteIds: readonly string[]): string[] {
      const made = noteIds.flatMap(id => convertNoteToBracketed(score(), id)?.bracketedId ?? [])
      if (made.length) ctx.mutate(made.length > 1 ? `Convert ${made.length} notes to bracketed graces` : 'Convert note to bracketed grace')
      return made
    },

    /**
     * ⭐ The `bracket.` button with GRACES selected (his rule, 2026-09-23): each becomes a bracketed grace
     * whose target is what stands to its right (`noteToBracketedOps.graceToBracketed`); the rest of its
     * group stays. ONE undo entry. @returns the new bracketed graces' first pitch ids, for the selection.
     */
    convertGraces(gracePitchIds: readonly string[]): string[] {
      const made = gracePitchIds.flatMap(id => graceToBracketed(score(), id) ?? [])
      if (made.length) ctx.mutate(made.length > 1 ? `Convert ${made.length} graces to bracketed graces` : 'Convert grace to bracketed grace')
      return made
    },

    /**
     * ⭐ A GRACE button with bracketed graces selected (his rule, 2026-09-23): each becomes a grace, keeping
     * its target (`noteToBracketedOps.bracketedToGrace`). ONE undo entry. @returns the new graces' ids.
     */
    toGraces(pitchIds: readonly string[], form: GraceForm): string[] {
      const made = pitchIds.flatMap(id => bracketedToGrace(score(), id, form) ?? [])
      if (made.length) ctx.mutate(made.length > 1 ? `Convert ${made.length} bracketed graces to graces` : 'Convert bracketed grace to grace')
      return made
    },

    /**
     * ⭐ The `bracket.` button toggled OFF with bracketed graces selected (his rule, 2026-09-23): each one's
     * TARGET takes its pitch, keeping its value, and the bracketed grace goes (`noteToBracketedOps.bracketedToNote`).
     * ONE undo entry. @returns the re-pitched notes' first pitch ids, for the caller to select.
     */
    toNotes(pitchIds: readonly string[]): string[] {
      const made = pitchIds.flatMap(id => bracketedToNote(score(), id) ?? [])
      if (made.length) ctx.mutate(made.length > 1 ? `Convert ${made.length} bracketed graces to notes` : 'Convert bracketed grace to note')
      return made
    },

    /** Take bracketed pitches out — ONE undo entry for all of them. @see removeBracketed */
    remove(pitchIds: readonly string[]): boolean {
      let changed = false
      for (const id of pitchIds) changed = removeBracketed(score(), id) || changed
      if (changed) ctx.mutate('Delete bracketed grace')
      return changed
    },

    /** The written value of every one of these bracketed graces — ONE undo entry, none when nothing changed. */
    setWritten(pitchIds: readonly string[], duration: NoteDuration): boolean {
      let changed = false
      for (const id of pitchIds) changed = setBracketedWritten(score(), id, duration) || changed
      if (changed) ctx.mutate('Bracketed grace value')
      return changed
    },

    /** Re-spell a bracketed pitch in place — see {@link setBracketedPitch}. */
    setPitch(pitchId: string, spelling: BracketedSpelling): boolean {
      const changed = setBracketedPitch(score(), pitchId, spelling)
      if (changed) ctx.mutate('Bracketed pitch')
      return changed
    },

    /**
     * ⭐ One FRAME of a bracketed grace's horizontal drag: set its offset to `x` staff spaces, recording no
     * undo entry — {@link commitOffset} records the one on drop. The grace's `previewOffset`, for the
     * grace's reason: it has no column of its own, so the drag that spaces a note's column offsets it.
     * @returns whether the offset changed — refused when not a bracketed grace, unchanged, or off the page.
     */
    previewOffset(pitchId: string, x: number): boolean {
      const s = score()
      if (!isBracketedGrace(s, pitchId)) return false
      const target = offsetTargetOf(s, pitchId)
      if (!target) return false
      const dx = Math.round(x * 100) / 100 - (noteOffsetOverrideOf(s, target.key)?.x ?? 0)
      if (dx === 0 || !ctx.limits.nudgeStaysOnPage('note', pitchId, dx, 0)) return false
      nudgeNoteOffset(s, target.key, dx)
      ctx.markDirty()
      return true
    },

    /** The ONE undo entry for an offset drag whose frames went through {@link previewOffset}. */
    commitOffset(): void {
      ctx.commitPreviewed('Nudge bracketed grace')
    },

    /** ⭐ P6 — move it to the other side of its target (the Properties control). ONE undo entry; none refused. */
    setSide(pitchId: string, side: BracketedSide): boolean {
      const moved = setBracketedSide(score(), pitchId, side)
      if (moved) ctx.mutate(side === 'after' ? 'Bracketed grace after its note' : 'Bracketed grace before its note')
      return moved
    },

    /** Is this id a bracketed grace's pitch? */
    isBracketed: (pitchId: string): boolean => isBracketedGrace(score(), pitchId),
    /** Where a bracketed pitch lives. */
    find: (pitchId: string): FoundBracketed | null => findBracketed(score(), pitchId),
    /** What a loaded file says that this build cannot hold (report, never repair). */
    problems: (): string[] => bracketedProblems(score()),
  }
}
