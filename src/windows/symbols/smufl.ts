/**
 * The SMuFL metadata — the Symbols window's whole data source (docs/symbols-window-plan.md).
 *
 * The files under `public/smufl/` are the specification's own, verbatim, and they are FETCHED on
 * first open rather than imported: `glyphnames.json` alone is 300 KB, and a chart nobody has opened
 * must cost the editor's startup nothing. `engine/export/exportFonts.ts` fetches the OTFs the same
 * way and for the same reason — a module-level promise, one request per page load.
 *
 * ⚠️ The three files answer three DIFFERENT questions and none of them substitutes for another:
 *   - `ranges.json`   — where a glyph is PRINTED. The chart's structure: 131 blocks, in order.
 *   - `glyphnames.json` — what a glyph IS CALLED, plus its codepoint and the spec's own description.
 *   - `classes.json`  — what a glyph IS. Cross-cutting: one glyph is in many classes, or none.
 * A glyph belongs to exactly one range and any number of classes, so the two can never be merged.
 * (P0 uses the first two; `classes.json` ships now because it is 100 KB and the detail bar in P2
 * is the only reason any of this is here.)
 */

/** One entry of `glyphnames.json`. `codepoint` is spec-style text — `"U+E0A4"`, not a number. */
export interface GlyphName {
  codepoint: string
  description?: string
  alternateCodepoint?: string
}

/** One entry of `ranges.json`: a block of the chart, with the glyph names it contains, in order. */
export interface Range {
  description: string
  glyphs: string[]
  range_start: string
  range_end: string
}

/** A range with its key and its glyphs resolved — what the grid actually draws. */
export interface RangeBlock {
  /** The SMuFL range id, e.g. `noteheads`. */
  id: string
  /** The heading: `Noteheads`. */
  title: string
  /** `U+E0A0–U+E0FF`, for the detail bar and for orientation inside a filtered grid. */
  span: string
  glyphs: Glyph[]
}

/** One glyph, everything the window knows about it in one object. */
export interface Glyph {
  /** Canonical SMuFL name — `noteheadBlack`. The id everywhere else in the app. */
  name: string
  /** The character itself, ready to put in a `<text>`. */
  char: string
  /** `U+E0A4` — the spec's spelling, which is also what the copy chip hands out. */
  codepoint: string
  description?: string
  alternateCodepoint?: string
}

export interface Smufl {
  /** The chart, in codepoint order — NOT the order the JSON happens to be keyed in. */
  blocks: RangeBlock[]
  /** Every glyph by canonical name, for the detail bar and search. */
  byName: Map<string, Glyph>
  /** Which range each glyph is printed in — the detail bar's "where am I". */
  rangeOf: Map<string, RangeBlock>
  /** Which classes each glyph belongs to. Many, or none: a class is not a range. */
  classesOf: Map<string, string[]>
}

/** Vite's base path, so the fetch is right under a non-root deployment too (as exportFonts does). */
function baseUrl(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return env?.BASE_URL ?? '/'
}

/** `"U+E0A4"` → the character. Returns null for anything that is not a codepoint, rather than
 *  guessing: a wrong character here would draw a plausible WRONG glyph, which is worse than a gap. */
export function codepointToChar(codepoint: string): string | null {
  const match = /^U\+([0-9A-Fa-f]{4,6})$/.exec(codepoint.trim())
  if (!match) return null
  return String.fromCodePoint(parseInt(match[1], 16))
}

let pending: Promise<Smufl> | null = null

/** Load (once) and index the metadata. Every caller shares the one promise and the one result. */
export function loadSmufl(): Promise<Smufl> {
  if (!pending) pending = fetchSmufl()
  return pending
}

async function fetchSmufl(): Promise<Smufl> {
  const [names, ranges, classes] = await Promise.all([
    fetchJson<Record<string, GlyphName>>('glyphnames.json'),
    fetchJson<Record<string, Range>>('ranges.json'),
    fetchJson<Record<string, string[]>>('classes.json'),
  ])
  return indexSmufl(names, ranges, classes)
}

/** The whole transformation, pure — the two JSON files in, the chart out. Exported for its test:
 *  the ordering rule below is a decision, and a decision that only shows up 40 blocks down a
 *  scroller is one nobody notices has broken. */
export function indexSmufl(
  names: Record<string, GlyphName>,
  ranges: Record<string, Range>,
  classes: Record<string, string[]> = {},
): Smufl {
  const byName = new Map<string, Glyph>()
  for (const [name, entry] of Object.entries(names)) {
    const char = codepointToChar(entry.codepoint)
    if (char === null) continue
    byName.set(name, {
      name,
      char,
      codepoint: entry.codepoint,
      description: entry.description,
      alternateCodepoint: entry.alternateCodepoint,
    })
  }

  const blocks = Object.entries(ranges)
    // ⚠️ `ranges.json` is keyed ALPHABETICALLY — read in that order the chart opens on "Accordion"
    // and scatters the noteheads through the middle of it. The spec's order is by codepoint, which
    // is also the order every printed chart uses, so sort by where the range STARTS.
    .sort((a, b) => codepointValue(a[1].range_start) - codepointValue(b[1].range_start))
    .map(([id, range]) => ({
      id,
      title: range.description,
      span: `${range.range_start}–${range.range_end}`,
      // A range lists glyphs the font may not name (the spec adds glyphs faster than it reissues
      // the tables). Drop the unresolvable ones instead of drawing a blank cell for them.
      glyphs: range.glyphs.map(name => byName.get(name)).filter((g): g is Glyph => g !== undefined),
    }))

  const rangeOf = new Map<string, RangeBlock>()
  for (const block of blocks) {
    for (const glyph of block.glyphs) rangeOf.set(glyph.name, block)
  }

  // Inverted: the file is class → glyphs, and every question this window asks is glyph → classes.
  const classesOf = new Map<string, string[]>()
  for (const [className, members] of Object.entries(classes)) {
    for (const member of members) {
      const existing = classesOf.get(member)
      if (existing) existing.push(className)
      else classesOf.set(member, [className])
    }
  }

  return { blocks, byName, rangeOf, classesOf }
}

function codepointValue(codepoint: string): number {
  const match = /^U\+([0-9A-Fa-f]{4,6})$/.exec(codepoint.trim())
  return match ? parseInt(match[1], 16) : Number.MAX_SAFE_INTEGER
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${baseUrl()}smufl/${file}`)
  if (!response.ok) throw new Error(`Cannot load ${file} (HTTP ${response.status})`)
  return (await response.json()) as T
}
