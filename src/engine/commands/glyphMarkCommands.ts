/**
 * ⭐ **The user's SYMBOLS — commands** (docs/plans/symbol-plan.md P2): the editor's half of an edit to a
 * glyph mark — the one check the score layer may not make, the ops call, and the undo entry. Reached as
 * `engine.glyphMark.<command>(…)`. What a glyph mark IS is `engine/models/glyphMarkOps`.
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { addGlyphMark, addGlyphMarkToEvent, flipGlyphMarkPlacement, removeGlyphMark } from '../models/glyphMarkOps'
import { smuflGlyph } from '../fonts/smuflGlyphs'
import type { GlyphMark } from '@/types/music'
import type { CommandContext } from './commandContext'

export type GlyphMarkCommands = ReturnType<typeof glyphMarkCommands>

export function glyphMarkCommands(ctx: CommandContext) {
  const score = () => ctx.model().getScore()
  return {
    /**
     * Whether a symbol of this glyph can be drawn at all — the question the score layer may not ask
     * (it imports no font, `lint:boundary`). False for a name the engine's glyph table has no row for:
     * not in the font, or drawing no ink — a symbol that could never be seen, selected or deleted.
     */
    canDraw: (glyph: string): boolean => smuflGlyph(glyph) !== null,

    /**
     * Add a symbol of `glyph` to the event `noteId` belongs to (a chord head or a rest). ONE undo entry.
     * @returns the mark, or null when the glyph cannot be drawn or the id names no event.
     */
    add(noteId: string, glyph: string): GlyphMark | null {
      if (smuflGlyph(glyph) === null) return null
      const mark = addGlyphMarkToEvent(score(), noteId, glyph)
      if (mark) ctx.mutate('Add symbol')
      return mark
    },

    /**
     * Add a symbol at an ADDRESS rather than on a named event — the element paste's door, whose anchor is a
     * place (`clipboard/pasteAnchor`). ONE undo entry. @returns the mark, or null when refused.
     */
    addAt(measure: number, mark: Omit<GlyphMark, 'id'>): GlyphMark | null {
      if (smuflGlyph(mark.glyph) === null) return null
      const created = addGlyphMark(score(), measure, mark)
      if (created) ctx.mutate('Paste symbol')
      return created
    },

    /** Delete a symbol (and any override keyed by it). ONE undo entry. @returns false when there was none. */
    remove(id: string): boolean {
      const removed = removeGlyphMark(score(), id)
      if (removed) ctx.mutate('Delete symbol')
      return removed
    },

    /** Move a symbol to the other side of the staff. ONE undo entry. @returns false when there was none. */
    flip(id: string): boolean {
      const flipped = flipGlyphMarkPlacement(score(), id)
      if (flipped) ctx.mutate('Flip symbol')
      return flipped
    },
  }
}
