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
 *
 * 🚨 …and every coordinate is ROUNDED HERE FIRST, because opentype's own rounding cannot do it.
 * `roundDecimal` is written as string arithmetic — `+(Math.round(decimalPart + 'e+' + places) +
 * 'e-' + places)` — so a fractional part small enough to STRINGIFY IN EXPONENTIAL FORM (below about
 * 1e-6) makes `"1.9073486e-7e+3"`, whose `Math.round` is NaN. The coordinate is then written as the
 * text `NaN` and the browser draws NOTHING AT ALL — no error, no partial shape, a blank picture.
 * A measured position carries exactly that noise (a browser hands back float32, so 11.3 comes back
 * as 11.300000190734863, and a shift of −4 lands on 9.000000190734863), which is how the keypad's
 * dot key came out invisible on 2026-09-23. Rounding to the places we are about to print costs the
 * output nothing — a value that survives prints the same either way.
 */
export function glyphPathData(path: Path, decimalPlaces = 3): string {
  // ⚠️ The cast: `@types/opentype.js` is 1.3's and knows only `toPathData(decimalPlaces)`; the options
  // form is opentype.js 2.0's, which is what is installed.
  const write = path.toPathData as unknown as (options: { decimalPlaces: number; optimize: boolean; flipY: boolean }) => string
  const unit = 10 ** decimalPlaces
  const round = (v: unknown): unknown => (typeof v === 'number' ? Math.round(v * unit) / unit : v)
  // ⛔ Not in place: the caller's path is its own. `toPathData` reads `this.commands` and nothing
  // else at `flipY: false`, so a plain object carrying the cleaned commands is all it needs.
  const commands = path.commands.map(c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, round(v)])))
  return write.call({ commands } as unknown as Path, { decimalPlaces, optimize: false, flipY: false })
}
