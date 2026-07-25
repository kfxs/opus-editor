import type { TremoloMark } from '@/types/music'

/**
 * The SMuFL codepoints a tremolo mark is DRAWN with.
 *
 * Here rather than in the renderer because both sides of the mark need them and only one side has
 * VexFlow: `CenteredTremolo` draws with them, and the selection highlight recognises a drawn stroke
 * by them (the strokes are `<text>` glyphs inside the note's group — matching the character finds
 * all of a stack and nothing else). A util keeps the interactions layer clear of the library.
 *
 * ⚠️ Written out, never read from VexFlow's `Glyphs` map: that map is not re-exported from the
 * package, so a lookup resolves under Vitest and is `undefined` in the browser, silently
 * (`reference_vexflow_glyphs_esm_vs_cjs`). SMuFL codepoints are spec-stable.
 */

/** `tremolo1` — the single stroke, stacked `num` times for a measured tremolo. */
export const TREMOLO_STROKE = '\uE220'

/** `pendereckiTremolo` — as fast as possible AND irregular. One glyph, not a stack.
 *  ⚠️ E22A is the buzz roll and E22C the dedicated unmeasured sign; neither is this one. */
export const PENDERECKI_TREMOLO = '\uE22B'

/** The glyph a mark is drawn with: the Penderecki sign, or the stroke it repeats. */
export function tremoloGlyph(mark: TremoloMark): string {
  return mark === 'penderecki' ? PENDERECKI_TREMOLO : TREMOLO_STROKE
}
