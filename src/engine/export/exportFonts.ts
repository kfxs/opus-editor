import { parse, type Font } from 'opentype.js'

/**
 * The two fonts the engraving is made of, as REAL font files — the export's answer to the one
 * genuine obstacle in the way of a vector PDF.
 *
 * ## Why a second copy of a font the app already has
 *
 * Every glyph VexFlow draws is a `<text>` in Bravura (with Academico behind it for words), and
 * VexFlow ships both as base64 **woff2** installed into `document.fonts`. That is perfect for the
 * screen and useless for a PDF: no PDF writer embeds woff2 (it is brotli-compressed, and undoing
 * that in the browser means shipping a decompressor), and jsPDF cannot embed OTF/CFF outlines as
 * *text* at all. So the export does not embed a font — it **outlines** the glyphs into paths, and
 * for that it needs the outlines, which means the .otf itself (opentype.js reads OTF/CFF happily).
 *
 * `public/fonts/*.otf` are the upstream VexFlow font files (SIL OFL 1.1 — see OFL.txt beside
 * them), the same faces the woff2s were built from, so an outlined glyph is the shape you were
 * looking at, not a lookalike.
 *
 * ## What is NOT here
 *
 * Text set in a system stack — dynamics words are `Georgia, "Times New Roman", Times, serif`
 * (see dynamicStyle.ts) — has no file to outline and does not need one: those runs stay TEXT in
 * the PDF and are drawn with one of the standard PDF faces. Only the music travels as outlines.
 */

/** CSS family name → the file under `public/fonts/`. Matched case-insensitively. */
const FONT_FILES: Record<string, string> = {
  bravura: 'Bravura.otf',
  academico: 'Academico.otf',
}

/** Parsed fonts, keyed by lowercased family. One fetch+parse per family per page load. */
const cache = new Map<string, Promise<Font>>()

/** Vite's base path, so the fetch is right under a non-root deployment too. */
function baseUrl(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return env?.BASE_URL ?? '/'
}

/** Load one of {@link FONT_FILES}, or null if the family is not one we ship. */
export function loadExportFont(family: string): Promise<Font> | null {
  const key = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  const file = FONT_FILES[key]
  if (!file) return null

  let pending = cache.get(key)
  if (!pending) {
    pending = fetch(`${baseUrl()}fonts/${file}`)
      .then(async response => {
        if (!response.ok) throw new Error(`Cannot load ${file} (HTTP ${response.status})`)
        return parse(await response.arrayBuffer())
      })
    cache.set(key, pending)
  }
  return pending
}

/** Every font we ship, parsed — resolved once so the outliner can work synchronously. */
export async function loadAllExportFonts(): Promise<Map<string, Font>> {
  const entries = await Promise.all(
    Object.keys(FONT_FILES).map(async key => [key, await loadExportFont(key)!] as const),
  )
  return new Map(entries)
}
