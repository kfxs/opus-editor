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

/** Serif stack for custom-text dynamics — has a true italic face (the music font
 *  doesn't), so expression text actually slants. Styling will be user-configurable later. */
export const DYNAMIC_TEXT_FONT = 'Georgia, "Times New Roman", Times, serif'
