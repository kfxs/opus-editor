/**
 * ⭐⭐ **WE INSTALL THE SCORE'S FONTS — not VexFlow's import.** S1 of `docs/vexflow-removal-map.md`.
 *
 * Every row of `fonts/fontFiles` becomes a `FontFace` in `document.fonts`, from the file we ship.
 * VexFlow's entry still installs its own embedded copies on import, and will until the package goes
 * (S14); ours are added later, and for two faces with the same family, weight and style the browser
 * uses the one added LAST — so ours are what the page draws with. `e2e/musicFontFaces.e2e.ts`
 * measures both halves of that claim: words set in Academico measure like OUR file, and the music
 * still renders with every face that is not ours deleted from the page.
 *
 * ⚠️ Registered from {@link musicFontReady}, the gate every engraving path already waits on (the
 * editor's `RenderController`, the PDF/SVG export, the geometry harness) — so no path can engrave
 * before our faces are in, and none needs its own call.
 */
import { FONT_FILES, fontFileUrl } from '@/engine/fonts/fontFiles'

let registered: Promise<void> | undefined
const ours = new Set<FontFace>()

/**
 * Add every face we ship to the page and resolve once each has loaded or failed. Memoized: the
 * faces are installed once per document.
 *
 * Resolves immediately where there is no font loading API (jsdom, node) — there is nothing to
 * install and no glyph a unit test may measure anyway.
 */
export function registerMusicFontFaces(): Promise<void> {
  registered ??= (() => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) {
      return Promise.resolve()
    }
    const loads = FONT_FILES.map(row => {
      const face = new FontFace(row.family, `url(${fontFileUrl(row.file)})`, { weight: row.weight, display: row.display })
      document.fonts.add(face)
      ours.add(face)
      return face.load()
    })
    return Promise.allSettled(loads).then(() => undefined)
  })()
  return registered
}

/** Whether a face in `document.fonts` is one we installed — what the browser suite deletes around. */
export function isOwnFontFace(face: FontFace): boolean {
  return ours.has(face)
}
