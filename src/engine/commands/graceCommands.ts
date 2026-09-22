/**
 * ⭐ **GRACE NOTES' commands** — the editor's half of an edit to one: the ops call and the undo entry.
 * Reached as `engine.grace.<command>(…)`. What a grace IS, and what it refuses, is
 * `engine/models/graceOps` (`docs/plans/grace-notes-plan.md` §2).
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { addGrace, addGracePitch, flipGraceStems, isGraceNote, setGraceForm, setGraceWritten, type GraceForm, type GraceSpelling, type GraceWritten } from '../models/graceOps'
import type { ArticulationType, Fraction, GraceGroup, GraceNote, GraceSide, NotePitch } from '@/types/music'
import { beatRestAt } from '../models/restGraceOps'
import { convertNoteToGrace } from '../models/noteToGraceOps'
import { clearGraceGroup, graceGroupAt, graceToNote, wholeGroupSelected } from '../models/graceToNoteOps'
import { findSlot, offsetTargetOf } from '../models/slotLookup'
import type { CommandContext } from './commandContext'
import { nudgeNoteOffset } from '../models/overrideOps'
import { noteOffsetOverrideOf } from '../models/engravingOverrides'

export type GraceCommands = ReturnType<typeof graceCommands>

export function graceCommands(ctx: CommandContext) {
  return {
    /**
     * Hang a grace of `spelling` on the slot holding `hostNoteId` — a chord, or a REST (D7 reversed) —
     * see {@link addGrace}. ⭐ On a whole-bar rest, `beat` (the click's) names the beat it belongs to:
     * the rest becomes a one-beat rest there first (`restGraceOps.beatRestAt`), in the same undo entry.
     */
    addGrace(
      hostNoteId: string, side: GraceSide, spelling: GraceSpelling, form: GraceForm, written: GraceWritten, beat?: Fraction,
      /** The articulations armed for it — note entry's, in the same undo entry. */
      marks?: ArticulationType[],
      /** Where it stands in the group (the clicked gap); absent = the end. @see addGrace */
      index?: number,
    ): GraceNote | null {
      const score = ctx.model().getScore()
      const host = beat ? beatRestAt(score, hostNoteId, beat)?.id ?? hostNoteId : hostNoteId
      const grace = addGrace(score, host, side, spelling, form, written, index)
      if (!grace) return null
      if (marks?.length) grace.articulations = [...marks]
      ctx.mutate(form === 'acciaccatura' ? 'Add acciaccatura' : 'Add appoggiatura')
      return grace
    },

    /**
     * ⭐ The WRITTEN value of every one of these graces — a duration or dot key with graces selected
     * (his report, 2026-09-22: *"i select some graces and changed the duration but it is only affecting
     * the first"*). A grace's value is never counted, so nothing is rebarred. ONE undo entry; none when
     * nothing changed. @see setGraceWritten
     */
    setGraceWritten(gracePitchIds: readonly string[], written: Partial<GraceWritten>): boolean {
      const score = ctx.model().getScore()
      let changed = false
      for (const id of gracePitchIds) changed = setGraceWritten(score, id, written) || changed
      if (changed) ctx.mutate('Grace value')
      return changed
    },

    /**
     * ⭐ A grace button with NOTES selected — each becomes a grace before the rest that takes its place
     * (P4, his rule; `models/noteToGraceOps`). ONE undo entry for all of them.
     * @returns the new graces' first pitch ids (the notes' own), for the caller to select.
     */
    convertNotesToGraces(noteIds: readonly string[], form: GraceForm): string[] {
      const score = ctx.model().getScore()
      const made = noteIds.flatMap(id => convertNoteToGrace(score, id, form)?.graceId ?? [])
      if (made.length) ctx.mutate(made.length > 1 ? `Convert ${made.length} notes to graces` : 'Convert note to grace')
      return made
    },

    /**
     * ⭐ A grace BUTTON pressed with GRACES selected (plan §3 rule 2, his rules of 2026-09-22) — per GROUP,
     * once: the OTHER form → the group takes it; its OWN form → TOGGLED OFF: a whole group of TWO OR MORE
     * selected → the group goes (`clearGraceGroup`); otherwise (a lone grace too) the FIRST selected grace
     * becomes its main slot's note
     * and the graces after it go (`graceToNote`). ONE undo entry; none when nothing changed.
     * @returns the notes made (their first pitch ids — the graces' own), for the caller to select.
     */
    pressGraceForm(gracePitchIds: readonly string[], form: GraceForm): { changed: boolean; madeNotes: string[] } {
      const score = ctx.model().getScore()
      const selected = new Set(gracePitchIds)
      const done = new Set<GraceGroup>()
      const madeNotes: string[] = []
      let changed = false
      for (const id of gracePitchIds) {
        const at = graceGroupAt(score, id)
        if (!at || done.has(at.group)) continue
        done.add(at.group)
        const own: GraceForm = at.group.slash ? 'acciaccatura' : 'appoggiatura'
        if (own !== form) {
          changed = setGraceForm(score, id, form) || changed
        } else if (at.group.notes.length > 1 && wholeGroupSelected(score, id, selected)) {
          // ⚠️ A GROUP of two or more, all selected. A LONE grace is a whole group too — but his first
          //    case: it becomes the note, below.
          changed = clearGraceGroup(score, id) || changed
        } else {
          // The FIRST selected grace of this group (the lowest index) is the one that becomes the note.
          const first = gracePitchIds
            .map(g => ({ g, at: graceGroupAt(score, g) }))
            .filter(x => x.at?.group === at.group)
            .sort((a, b) => a.at!.index - b.at!.index)[0]?.g ?? id
          const made = graceToNote(score, first)
          if (made) { madeNotes.push(made); changed = true }
        }
      }
      if (changed) ctx.mutate(madeNotes.length ? 'Grace to note' : 'Grace form')
      return { changed, madeNotes }
    },

    /**
     * ⭐ `X` on selected graces — their groups' stems up ↔ down (P6), ONE undo entry.
     * @see flipGraceStems
     */
    flipGraceStems(gracePitchIds: readonly string[]): boolean {
      if (!flipGraceStems(ctx.model().getScore(), gracePitchIds)) return false
      ctx.mutate('Flip grace stems')
      return true
    },

    /**
     * ⭐ The FORM of the groups these graces belong to — a grace button pressed with graces SELECTED
     * (his rule, 2026-09-22; plan §3 rule 2). ONE undo entry; ⛔ none when nothing changed.
     * @see setGraceForm
     */
    setGraceForm(gracePitchIds: readonly string[], form: GraceForm): boolean {
      const score = ctx.model().getScore()
      let changed = false
      for (const id of gracePitchIds) changed = setGraceForm(score, id, form) || changed
      if (changed) ctx.mutate(form === 'acciaccatura' ? 'Make acciaccatura' : 'Make appoggiatura')
      return changed
    },

    /**
     * ⭐ A click in a grace's column — its pitch joins that grace, a grace CHORD (P2a, note entry's chord
     * rule) — see {@link addGracePitch}. The armed articulations join the grace's own, as a chord's do.
     * ⛔ A refusal (the same pitch) leaves no undo entry.
     */
    addGracePitch(
      gracePitchId: string, spelling: GraceSpelling, written?: GraceWritten, marks?: ArticulationType[],
    ): NotePitch | null {
      const score = ctx.model().getScore()
      const pitch = addGracePitch(score, gracePitchId, spelling, written)
      if (!pitch) return null
      const grace = findSlot(score, pitch.id, { graceNotes: true })?.grace?.note
      if (grace && marks?.length) grace.articulations = [...new Set([...(grace.articulations ?? []), ...marks])]
      ctx.mutate('Add grace chord note')
      return pitch
    },

    /**
     * ⭐ A live DRAG frame of a grace's horizontal offset: set it to `x` staff spaces (+right), no undo
     * entry — {@link commitOffset} records the one on drop. The same override the note-offset keys
     * write (`MusicEngine.nudgeNoteOffset`), at the grace's own key (`slotLookup.offsetTargetOf`).
     * A grace has no column of its own, so the drag that SPACES a note's column offsets a grace.
     * @returns whether the offset changed — refused when not a grace, unchanged, or off the page.
     */
    previewOffset(noteId: string, x: number): boolean {
      const score = ctx.model().getScore()
      if (!isGraceNote(score, noteId)) return false
      const target = offsetTargetOf(score, noteId)
      if (!target) return false
      const dx = Math.round(x * 100) / 100 - (noteOffsetOverrideOf(score, target.key)?.x ?? 0)
      if (dx === 0 || !ctx.limits.nudgeStaysOnPage('note', noteId, dx, 0)) return false
      nudgeNoteOffset(score, target.key, dx)
      ctx.markDirty()
      return true
    },

    /** The ONE undo entry for a grace-offset drag whose frames went through {@link previewOffset}. */
    commitOffset(): void {
      ctx.commitPreviewed('Nudge grace')
    },
  }
}
