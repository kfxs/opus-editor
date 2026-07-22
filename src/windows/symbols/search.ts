import type { Glyph, RangeBlock } from './smufl'

/**
 * What the search box means (P1 of docs/symbols-window-plan.md).
 *
 * Two searches in one field, because the window has two audiences and they arrive with different
 * things in their hands:
 *
 *   - a WORD — matched against the canonical name and the spec's description. "notehead", "fermata",
 *     "quarter". This is MuseScore's search, and what a musician types.
 *   - a CODEPOINT — `E0A4`, `U+E0A4`, `0xE0A4` or `\uE0A4`. This is what a DEVELOPER has: a literal
 *     out of `tempoMenu.ts` or a value in a message, and the question "what does this draw?".
 *
 * The field decides which you meant; there is no mode to set. Four-to-six hex digits with an
 * optional prefix is a codepoint and nothing else — nothing in SMuFL is *named* `E0A4`. Fewer than
 * four digits stays a word search, so `fa` finds `fermata` rather than being read as hex 0x00FA.
 */

export interface SearchResult {
  /** Only the blocks with at least one match, each holding only its matching glyphs. */
  blocks: RangeBlock[]
  /** How many glyphs matched — the `showing N of M` count. */
  matched: number
}

/**
 * `E0A4` / `U+E0A4` / `0xE0A4` / `\uE0A4` → `"U+E0A4"`, the spelling `glyphnames.json` uses.
 * Anything else → null, meaning "this is a word".
 */
export function parseCodepointQuery(query: string): string | null {
  const match = /^(?:u\+|0x|\\u)?([0-9a-f]{4,6})$/i.exec(query.trim())
  return match ? `U+${match[1].toUpperCase()}` : null
}

/** Filter the chart. An empty query returns the chart untouched — not a copy of it. */
export function filterBlocks(blocks: RangeBlock[], query: string): SearchResult {
  const trimmed = query.trim()
  if (trimmed === '') {
    return { blocks, matched: blocks.reduce((n, block) => n + block.glyphs.length, 0) }
  }

  const codepoint = parseCodepointQuery(trimmed)
  const needle = trimmed.toLowerCase()
  const matches = codepoint
    ? (glyph: Glyph) => glyph.codepoint === codepoint
    : (glyph: Glyph) =>
        glyph.name.toLowerCase().includes(needle) ||
        (glyph.description?.toLowerCase().includes(needle) ?? false)

  let matched = 0
  const filtered: RangeBlock[] = []
  for (const block of blocks) {
    const glyphs = block.glyphs.filter(matches)
    if (glyphs.length === 0) continue
    matched += glyphs.length
    // The block keeps its identity — same id, same heading, same span — so a filtered chart still
    // says WHERE its glyphs live. A flat list of hits would drop the one fact the chart is for.
    filtered.push({ ...block, glyphs })
  }
  return { blocks: filtered, matched }
}
