/**
 * ⭐ **The user's SYMBOLS — commands** (docs/plans/symbol-plan.md P2): the editor's half of an edit to a
 * glyph mark — the one check the score layer may not make, the ops call, and the undo entry. Reached as
 * `engine.glyphMark.<command>(…)`. What a glyph mark IS is `engine/models/glyphMarkOps`.
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import { addGlyphMarkToEvent } from '../models/glyphMarkOps'
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
  }
}
