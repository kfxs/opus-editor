/**
 * Regenerates `src/engine/fonts/smuflGlyphTable.ts` — EVERY SMuFL glyph Bravura draws, as data.
 *
 *   node scripts/generate-smufl-glyph-table.mjs
 *
 * ⭐ **A second table, beside `bravuraMetrics.ts`, and deliberately not a widening of it.** That one's
 * list means *"what the editor draws"* and its generator refuses a glyph added "because it might be
 * useful". This one has a different reason, and it is total on purpose: the USER may place any SMuFL
 * glyph on the score as a symbol (docs/plans/symbol-plan.md, his call (j) 2026-09-28), so the engine
 * must know every glyph's codepoint, ink box and centre SYNCHRONOUSLY — layout and the jsdom tests
 * have nothing to await (`engine/fonts/fontMetrics.ts`'s header).
 *
 * Inputs — the same three files `generate-font-metrics.mjs` reads, for the same reasons:
 * `public/fonts/Bravura.otf` (the boxes and advances — the font we draw with), `public/smufl/
 * glyphnames.json` (name → codepoint: the list the Symbols window offers), `scripts/vendor/Bravura.json`
 * (the `opticalCenter` anchors, which no font file carries).
 *
 * ⛔ A glyph the OTF lacks, or one that draws no ink, gets NO row — and the run says which, and the
 * file's header records the count. A made-up row (`.notdef`'s box under a real name) would be believed.
 *
 * Bravura is SIL OFL 1.1 (`public/fonts/OFL.txt`, `scripts/vendor/PROVENANCE.md`).
 */
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'

const OTF = 'public/fonts/Bravura.otf'
const GLYPHNAMES = 'public/smufl/glyphnames.json'
const METADATA = 'scripts/vendor/Bravura.json'
const OUT = 'src/engine/fonts/smuflGlyphTable.ts'

const round = value => Number(value.toFixed(3))

const font = opentype.parse(readFileSync(OTF).buffer)
const glyphNames = JSON.parse(readFileSync(GLYPHNAMES, 'utf8'))
const metadata = JSON.parse(readFileSync(METADATA, 'utf8'))
const SPACE = font.unitsPerEm / 4

const rows = []
const notInFont = []
const noInk = []
let withCenter = 0

for (const [name, entry] of Object.entries(glyphNames)) {
  const codepoint = parseInt(entry.codepoint.replace('U+', ''), 16)
  const glyph = font.charToGlyph(String.fromCodePoint(codepoint))
  // ⚠️ `charToGlyph` never fails — an unmapped codepoint is glyph 0, `.notdef`. Check the index.
  if (!glyph || glyph.index === 0) { notInFont.push(name); continue }
  const box = glyph.getBoundingBox()
  if (box.x1 === 0 && box.x2 === 0 && box.y1 === 0 && box.y2 === 0) { noInk.push(name); continue }

  const row = [
    codepoint,
    round(-box.x1 / SPACE), round(box.x2 / SPACE), round(box.y2 / SPACE), round(-box.y1 / SPACE),
    round(glyph.advanceWidth / SPACE),
  ]
  const center = metadata.glyphsWithAnchors[name]?.opticalCenter
  if (center) { row.push(round(center[0]), round(center[1])); withCenter++ }
  rows.push([name, row])
}

const quote = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`)
const hex = cp => `0x${cp.toString(16).toUpperCase()}`
const revision = font.tables.head?.fontRevision
const total = Object.keys(glyphNames).length

const source = `/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** \`node scripts/generate-smufl-glyph-table.mjs\`
 *
 * ⭐ **Every SMuFL glyph Bravura draws** — ${rows.length} of the ${total} names in \`public/smufl/glyphnames.json\`,
 * so the user can place any of them as a symbol (docs/plans/symbol-plan.md, call (j)). ⛔ Not the editor's
 * own drawing table: that is \`./bravuraMetrics\`, whose list means *"what the editor draws"*. Read this
 * one through \`./smuflGlyphs\`, never directly.
 *
 * Left out, and why — a glyph with no row draws nothing and must not be offered as if it did:
 *   · ${notInFont.length} not in \`public/fonts/Bravura.otf\` (OTF ${revision})
 *   · ${noInk.length} in the font but drawing no ink${noInk.length ? `: ${noInk.join(', ')}` : ''}
 *
 * A row is \`[codepoint, left, right, up, down, advance, opticalCenterX?, opticalCenterY?]\` — the box
 * in staff spaces from the glyph's own origin (as \`GlyphBox\`), measured from the OTF; the optical
 * centre, where Bravura's metadata (${metadata.fontVersion}) declares one (${withCenter} glyphs), in staff spaces, y UP.
 *
 * Bravura — SIL OFL 1.1. Sources: \`public/fonts/OFL.txt\`, \`scripts/vendor/PROVENANCE.md\`.
 */

/** \`[codepoint, left, right, up, down, advance, opticalCenterX?, opticalCenterY?]\` — see the header. */
export type SmuflGlyphRow =
  | readonly [number, number, number, number, number, number]
  | readonly [number, number, number, number, number, number, number, number]

export const SMUFL_GLYPH_TABLE: Readonly<Record<string, SmuflGlyphRow>> = {
${rows.map(([name, r]) => `  ${quote(name)}: [${hex(r[0])}, ${r.slice(1).join(', ')}],`).join('\n')}
}
`
writeFileSync(OUT, source)
console.log(OUT)
console.log(`  ${rows.length} of ${total} glyphs · ${withCenter} with an optical centre`)
console.log(`  left out: ${notInFont.length} not in the OTF · ${noInk.length} draw no ink`)
