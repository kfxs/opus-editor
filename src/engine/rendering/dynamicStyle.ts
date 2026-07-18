/*
 * Shared styling constants for dynamics rendered as Annotations — the single
 * source of truth for both the VexFlow renderer (engraving) and the in-canvas
 * text editor (the overlay must font-match the engraving exactly).
 *
 * Font sizes are in px. Level marks use the SMuFL music glyph at music-glyph
 * size; custom text uses a smaller italic text size. The level glyph *family* is
 * deliberately VexFlow's global stack (Bravura + text fallback) so it follows the
 * score's engraving font — only custom text pins a serif face (below).
 */

export const DYNAMIC_GLYPH_SIZE = 30
export const DYNAMIC_TEXT_SIZE = 14

/*
 * Tight VERTICAL ink extent of a level glyph, measured from its text baseline, in px.
 *
 * `getBBox()` on the annotation `<g>` unions in VexFlow's transparent POINTER-RECT — an opacity-0
 * `pointer-events:auto` hit-area whose height is VexFlow's font-metric box (~2.5× the glyph, spanning
 * from up near the note down past the mark). So the raw group box balloons above AND below the "f".
 * That inflated box was the dynamic's hit-box AND the anchor-line corner: you could click well above
 * a glyph and select it, and the attachment line started too high. `registerDynamics` therefore
 * rebuilds the box's y/height from the `<text>` BASELINE (reliable) plus these two offsets, ignoring
 * the group height entirely (horizontal extent is left as measured). First-cut proportions of the
 * glyph size — tune to taste.
 */
export const DYNAMIC_GLYPH_INK_ABOVE = DYNAMIC_GLYPH_SIZE * 0.68 // baseline → glyph top
export const DYNAMIC_GLYPH_INK_BELOW = DYNAMIC_GLYPH_SIZE * 0.18 // baseline → glyph bottom

/** Serif stack for custom-text dynamics — has a true italic face (the music font
 *  doesn't), so expression text actually slants. Styling will be user-configurable later. */
export const DYNAMIC_TEXT_FONT = 'Georgia, "Times New Roman", Times, serif'
