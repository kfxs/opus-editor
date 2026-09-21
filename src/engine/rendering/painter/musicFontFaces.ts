/**
 * ⭐⭐ **WE INSTALL THE SCORE'S FONTS — not VexFlow's import.** S1 of `docs/history/vexflow-removal-map.md`.
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
import { FONT_FILES, fontFileUrl, type FontFile } from '@/engine/fonts/fontFiles'
import { DEFAULT_MUSIC_FONT, MUSIC_FONTS, activeMusicFont } from '@/engine/fonts/musicFont'

let registered: Promise<void> | undefined
const ours = new Set<FontFace>()
const loadedFamilies = new Map<string, Promise<void>>()

function install(row: FontFile): Promise<unknown> {
  const face = new FontFace(row.family, `url(${fontFileUrl(row.file)})`, { weight: row.weight, display: row.display })
  document.fonts.add(face)
  ours.add(face)
  return face.load()
}

function hasFontLoading(): boolean {
  return typeof document !== 'undefined' && typeof FontFace !== 'undefined' && !!document.fonts
}

/**
 * Add the faces the page opens with — the words, the DEFAULT music face (every other music face's
 * fallback) and the active one — and resolve once each has loaded or failed. Memoized: installed
 * once per document. ⭐ A music face nobody has chosen is not fetched: {@link loadMusicFont} brings
 * it in when the dev shell picks it (`docs/plans/music-font-switch-plan.md` A4).
 *
 * Resolves immediately where there is no font loading API (jsdom, node) — there is nothing to
 * install and no glyph a unit test may measure anyway.
 */
export function registerMusicFontFaces(): Promise<void> {
  registered ??= (() => {
    if (!hasFontLoading()) return Promise.resolve()
    const defaultFamily = MUSIC_FONTS.find(row => row.id === DEFAULT_MUSIC_FONT)!.family
    const opening = FONT_FILES.filter(row => row.role === 'text' || row.family === defaultFamily)
    for (const row of opening) loadedFamilies.set(row.family, Promise.resolve())
    const loads = opening.map(install)
    return Promise.allSettled([...loads, loadMusicFont(activeMusicFont().family)]).then(() => undefined)
  })()
  return registered
}

/**
 * Install one music face's file and resolve once it has loaded or failed — ⛔ a render in a face
 * that has not arrived engraves Bravura (the stack's fallback) and MEASURES it, so a switch awaits
 * this first. Memoized per family; resolves immediately for a face already in, and in jsdom.
 */
export function loadMusicFont(family: string): Promise<void> {
  if (!hasFontLoading()) return Promise.resolve()
  let pending = loadedFamilies.get(family)
  if (!pending) {
    const rows = FONT_FILES.filter(row => row.family === family)
    pending = Promise.allSettled(rows.map(install)).then(() => undefined)
    loadedFamilies.set(family, pending)
  }
  return pending
}

/** Whether a face in `document.fonts` is one we installed — what the browser suite deletes around. */
export function isOwnFontFace(face: FontFace): boolean {
  return ours.has(face)
}
