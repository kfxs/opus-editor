/**
 * ⭐ **HOW A SYMBOL SITS — the rows** (docs/plans/symbol-plan.md P1). Each number is one house style's
 * DEFAULT, sourced and changeable; ⛔ none is a finding about what a symbol must be.
 */
import type { Clearance, MarkInk } from '@/engine/layout/inkBand'
import { smuflGlyph } from '@/engine/fonts/smuflGlyphs'
import { MUSIC_FONT_SIZE_PT } from '@/engine/engrave/inheritedFonts'

/**
 * Where the stack's first mark stands — LilyPond's `TextScript`, the grob a free `\markup` on a note
 * is (`scm/define-grobs.scm`: `padding` 0.3, `staff-padding` 0.5; docs/research/symbol-anchoring-engines-research.md).
 * ⚠️ No treatise states a number for a symbol with no meaning (the industry research: UNKNOWN).
 */
export const GLYPH_MARK_LINE: Clearance = {
  /** Between the nearest ink (the music, or a family already placed) and the symbol's. */
  padding: 0.3,
  /** The least distance from the staff's near line to the symbol's ink. */
  minFromStaff: 0.5,
}

/**
 * Between two symbols of one stack, ink to ink — MuseScore's `articulationMinDistance` 0.4, its gap
 * between stacked marks OUTSIDE the staff (docs/research/articulation-research.md). Gould's *"a separate
 * stave-space"* (p. 120) is about marks INSIDE the staff, so it is not this row.
 */
export const GLYPH_MARK_STACK_GAP = 0.4

/** Drawn at the music font's own size — the size a notehead is (1 em = 4 staff spaces). */
export const GLYPH_MARK_SIZE_PT = MUSIC_FONT_SIZE_PT

/** How far a symbol's ink reaches from its baseline — its glyph's box; null for an unknown glyph. */
export function glyphMarkInk(glyph: string): MarkInk | null {
  const g = smuflGlyph(glyph)
  return g ? { above: g.box.up, below: g.box.down } : null
}
