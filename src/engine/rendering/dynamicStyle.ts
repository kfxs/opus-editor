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
import { drawnFontPx } from './drawnFontSize'

export const DYNAMIC_GLYPH_SIZE = 30
/**
 * ⭐ The size of the ITALIC PROSE beside a level — `dolce`, `espressivo`, `sempre` — in points.
 *
 * ⭐⭐ **Set from the references, 2026-08-13** (his report: the text read too small). Every program
 * states text against a REFERENCE STAFF HEIGHT, so the portable unit is the staff space:
 *
 * | | stated | staff spaces |
 * |---|---|---|
 * | MuseScore `expressionFontSize` (source: `styledef.cpp`, with `spatium` 24.8 = 1.75 mm) | 10 pt | **2.02** |
 * | MuseScore `staffTextFontSize` / `systemTextFontSize` / `dynamicsFontSize` | 10 pt | 2.02 |
 * | LilyPond `TextScript` — which IS its expressive text; it declares **no** `font-size`, so it takes
 *   the default `staff-height / 20 * 11` | 11 pt @ 20 pt staff | **2.20** |
 *
 * ⚠️ Our staff space is `STAFF_SPACE_PX` 10 px = 7.5 pt, so the band is 15.1–16.5 pt. 16 sits near
 * the top of it. It was **14 = 1.87 spaces — below every reference**.
 *
 * ⭐ **Raising this does NOT resize the glyphs nor move the dynamics line**, and that is by
 * construction rather than luck: the glyph runs are grown by the RATIO
 * {@link DYNAMIC_GLYPH_SIZE}/this (`DynamicsLayout`, `DynamicTextSource`), so a `p` lands at
 * `DYNAMIC_GLYPH_SIZE` whatever the prose does; and the line is stated off
 * {@link DYNAMIC_GLYPH_INK_ABOVE}/`_BELOW`, which are fractions of the glyph size alone.
 * ⛔ So do not "fix" that ratio into a constant — it is what keeps the two independent.
 */
export const DYNAMIC_TEXT_SIZE = 16

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
export const DYNAMIC_GLYPH_INK_ABOVE = drawnFontPx(DYNAMIC_GLYPH_SIZE) * 0.68 // baseline → glyph top
export const DYNAMIC_GLYPH_INK_BELOW = drawnFontPx(DYNAMIC_GLYPH_SIZE) * 0.18 // baseline → glyph bottom

/** Serif stack for custom-text dynamics — has a true italic face (the music font
 *  doesn't), so expression text actually slants. Styling will be user-configurable later. */
export const DYNAMIC_TEXT_FONT = 'Georgia, "Times New Roman", Times, serif'
