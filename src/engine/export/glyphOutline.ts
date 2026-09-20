import type { Path } from 'opentype.js'

/**
 * ⭐ THE ONE PLACE an opentype.js path becomes SVG path data — for the PDF export (`./outlineText`)
 * and the keypad's bake (`e2e/keypadIcons.bake.ts`).
 *
 * 🚨 Why it is not just `path.toPathData(3)`: that call's default OPTIMISER drops a contour's last
 * point when it lies within 1 unit of the contour's start — meant to remove a redundant closing
 * line, but measured in OUTPUT units, so on a thin shape drawn small a REAL corner is "close enough"
 * and goes. Bravura's bare stem (E204) is four points and no `Z`; at size 26 it came out a wedge
 * (found 2026-09-20 by the keypad bake's picture proof). Measured over the font: at the score's
 * size (40) 70 of 2,932 glyphs lose a corner — none of the score's usual ones, so the PDF was not
 * visibly wrong, only waiting for a small staff or a rarer glyph; at 26, 179 do.
 *
 * ⚠️ `flipY: false` too: the OPTIONS form of `toPathData` flips the picture unless told not to (the
 * bare-number form does not), and `getPath` has already put the glyph the right way up.
 */
export function glyphPathData(path: Path, decimalPlaces = 3): string {
  // ⚠️ The cast: `@types/opentype.js` is 1.3's and knows only `toPathData(decimalPlaces)`; the options
  // form is opentype.js 2.0's, which is what is installed.
  const write = path.toPathData as unknown as (options: { decimalPlaces: number; optimize: boolean; flipY: boolean }) => string
  return write.call(path, { decimalPlaces, optimize: false, flipY: false })
}
