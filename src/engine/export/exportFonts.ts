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

/**
 * CSS family name → the files under `public/fonts/`, per weight. Matched case-insensitively.
 *
 * Weight is a **separate file**, not a synthesised effect: VexFlow registers Academico's bold as a
 * real face (`Font.load('Academico', AcademicoBold, {weight: 'bold'})`) and a tempo mark is set in
 * it — so outlining a bold word from the regular face silently un-bolds it, which is exactly what
 * the first cut did. Bravura has one weight and needs no more; music glyphs are never bold.
 */
const FONT_FILES: Record<string, { regular: string; bold?: string }> = {
  bravura: { regular: 'Bravura.otf' },
  academico: { regular: 'Academico.otf', bold: 'AcademicoBold.otf' },
}

/** `family` or `family|bold` — how a weighted face is named in the loaded map. */
export function fontKey(family: string, bold: boolean): string {
  const name = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  return bold ? `${name}|bold` : name
}

/** Parsed fonts, keyed by {@link fontKey}. One fetch+parse per face per page load. */
const cache = new Map<string, Promise<Font>>()

/** Vite's base path, so the fetch is right under a non-root deployment too. */
function baseUrl(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return env?.BASE_URL ?? '/'
}

/** Load one face of one of {@link FONT_FILES}, or null if we ship no such face. */
export function loadExportFont(family: string, bold = false): Promise<Font> | null {
  const name = fontKey(family, false)
  const files = FONT_FILES[name]
  const file = bold ? files?.bold : files?.regular
  if (!file) return null

  const key = fontKey(family, bold)
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

/** Every face we ship, parsed and keyed by {@link fontKey} — resolved once so the outliner can
 *  work synchronously. */
export async function loadAllExportFonts(): Promise<Map<string, Font>> {
  const wanted: Array<[string, boolean]> = []
  for (const [family, files] of Object.entries(FONT_FILES)) {
    wanted.push([family, false])
    if (files.bold) wanted.push([family, true])
  }
  const entries = await Promise.all(
    wanted.map(async ([family, bold]) =>
      [fontKey(family, bold), await loadExportFont(family, bold)!] as const),
  )
  return new Map(entries)
}
