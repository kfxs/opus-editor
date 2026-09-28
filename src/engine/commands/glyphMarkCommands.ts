/**
 * ⭐ **The user's SYMBOLS — commands** (docs/plans/symbol-plan.md P2): the editor's half of an edit to a
 * glyph mark — the one check the score layer may not make, the ops call, and the undo entry. Reached as
 * `engine.glyphMark.<command>(…)`. What a glyph mark IS is `engine/models/glyphMarkOps`.
 *
 * ⛔ No `mutate` on a refusal: an edit that changed nothing leaves no undo entry.
 */
import {
  addGlyphMark, addGlyphMarkToEvent, flipGlyphMarkPlacement, glyphMarkOffsetOf, nudgeGlyphMarkOffset, removeGlyphMark,
  setGlyphMarkOffset,
} from '../models/glyphMarkOps'
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

    /** A symbol's hand offset in staff spaces (`x` +right, `y` +down) — (0, 0) when it has none. */
    offsetOf(id: string): { x: number; y: number } {
      const o = glyphMarkOffsetOf(score(), id)
      return { x: o?.x ?? 0, y: o?.y ?? 0 }
    },

    /**
     * The arrows (P4): move a symbol's ink by (`dx`, `dy`) staff spaces, screen-signed. ONE undo entry.
     * ⛔ Refused — no write, no entry — when the move would take its drawn ink off the page.
     */
    nudge(id: string, dx: number, dy: number): boolean {
      if (!ctx.limits.nudgeStaysOnPage('glyphMark', id, dx, dy)) return false
      if (!nudgeGlyphMarkOffset(score(), id, dx, dy)) return false
      ctx.mutate('Move symbol')
      return true
    },

    /** The Properties boxes: set the offset to exactly (`x`, `y`). ONE undo entry; the same page limit. */
    setOffset(id: string, x: number, y: number): boolean {
      const now = glyphMarkOffsetOf(score(), id)
      const dx = x - (now?.x ?? 0)
      const dy = y - (now?.y ?? 0)
      if (dx === 0 && dy === 0) return false
      if (!ctx.limits.nudgeStaysOnPage('glyphMark', id, dx, dy)) return false
      if (!setGlyphMarkOffset(score(), id, x, y)) return false
      ctx.mutate('Move symbol')
      return true
    },

    /** `Ctrl+Backspace`: back to where the ladder put it. DECLINES (false, no entry) when it was never moved. */
    reset(id: string): boolean {
      if (!glyphMarkOffsetOf(score(), id)) return false
      setGlyphMarkOffset(score(), id, 0, 0)
      ctx.mutate('Reset symbol position')
      return true
    },

    /** One drag frame: the offset set to (`x`, `y`) with NO undo entry — the drop's {@link commitDrag} records it. */
    previewOffset(id: string, x: number, y: number): boolean {
      if (!setGlyphMarkOffset(score(), id, x, y)) return false
      ctx.markDirty()
      return true
    },

    /** The drop of a drag the screen already shows: ONE undo entry. */
    commitDrag(): void {
      ctx.commitPreviewed('Move symbol')
    },

    /** Move a symbol to the other side of the staff. ONE undo entry. @returns false when there was none. */
    flip(id: string): boolean {
      const flipped = flipGlyphMarkPlacement(score(), id)
      if (flipped) ctx.mutate('Flip symbol')
      return flipped
    },
  }
}
