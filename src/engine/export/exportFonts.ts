import { parse, type Font } from 'opentype.js'
import { FONT_FILES, fontFileUrl } from '@/engine/fonts/fontFiles'

/**
 * The two fonts the engraving is made of, as REAL font files — the export's answer to the one
 * genuine obstacle in the way of a vector PDF.
 *
 * ## Why the PDF outlines instead of embedding
 *
 * Every glyph is a `<text>` in Bravura (with Academico behind it for words). Since S1 of
 * `docs/vexflow-removal-map.md` the screen draws with these same `.otf` files
 * (`rendering/musicFontFaces`, from `fonts/fontFiles`) — before that it drew with the base64 woff2
 * copies VexFlow installs on import, a different build of Academico. jsPDF cannot embed OTF/CFF
 * outlines as *text* at all. So the export does not embed a font — it **outlines** the glyphs into
 * paths, and for that it needs the outlines, which means the .otf itself (opentype.js reads OTF/CFF
 * happily).
 *
 * `public/fonts/*.otf` are the upstream VexFlow font files (SIL OFL 1.1 — see OFL.txt beside them).
 * ⚠️ They are NOT byte-for-byte the builds VexFlow embeds: measured 2026-09-14, Bravura's advances
 * agree glyph for glyph but Academico's differ by up to ~2%. What makes an outlined glyph the shape
 * you were looking at is that the screen now draws with these same files.
 *
 * ## What is NOT here
 *
 * Text set in a system stack — dynamics words are `Georgia, "Times New Roman", Times, serif`
 * (see dynamicStyle.ts) — has no file to outline and does not need one: those runs stay TEXT in
 * the PDF and are drawn with one of the standard PDF faces. Only the music travels as outlines.
 */

/**
 * The files under `public/fonts/`, per family and weight — ⭐ read from `fonts/fontFiles`, the ONE
 * table the screen's own font registration reads too, so the PDF outlines exactly the faces the
 * page was drawn with. Families match case-insensitively.
 *
 * Weight is a **separate file**, not a synthesised effect: a tempo mark is set in Academico's real
 * bold, so outlining a bold word from the regular face silently un-bolds it, which is exactly what
 * the first cut did. Bravura has one weight and needs no more; music glyphs are never bold.
 */
function fontFileOf(family: string, bold: boolean): string | undefined {
  const name = fontKey(family, false)
  return FONT_FILES.find(row => fontKey(row.family, false) === name && (row.weight === 'bold') === bold)?.file
}

/** `family` or `family|bold` — how a weighted face is named in the loaded map. */
export function fontKey(family: string, bold: boolean): string {
  const name = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  return bold ? `${name}|bold` : name
}

/** Parsed fonts, keyed by {@link fontKey}. One fetch+parse per face per page load. */
const cache = new Map<string, Promise<Font>>()

/** Load one face of one of {@link FONT_FILES}, or null if we ship no such face. */
function loadExportFont(family: string, bold = false): Promise<Font> | null {
  const file = fontFileOf(family, bold)
  if (!file) return null

  const key = fontKey(family, bold)
  let pending = cache.get(key)
  if (!pending) {
    pending = fetch(fontFileUrl(file))
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
  const wanted = FONT_FILES.map(row => [row.family, row.weight === 'bold'] as [string, boolean])
  const entries = await Promise.all(
    wanted.map(async ([family, bold]) =>
      [fontKey(family, bold), await loadExportFont(family, bold)!] as const),
  )
  return new Map(entries)
}
