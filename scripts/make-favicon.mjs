/**
 * Regenerates `public/favicon.svg` — Bravura's alto clef, mirrored, knocked out of a disc.
 *
 *   node scripts/make-favicon.mjs
 *
 * The icon is not drawn, it is EXTRACTED: the outline comes from the same `public/fonts/Bravura.otf`
 * the editor engraves with, so the mark cannot drift from the notation it stands for. Hand-editing
 * the SVG would break that link silently — change the constants here and re-run instead.
 *
 * Bravura is SIL OFL 1.1 (`public/fonts/OFL.txt`). Embedding glyph outlines in a document is
 * expressly allowed by the licence; the font file itself is redistributed under it already.
 */
import opentype from 'opentype.js'
import { writeFileSync, readFileSync } from 'node:fs'

/** SMuFL `cClef` — the C clef, which at the middle line is the ALTO clef. */
const CODEPOINT = 0xe05c

/** The tile is a 100-unit square holding a full-bleed disc; every constant below is in those units. */
const TILE = 100
const R = TILE / 2

/**
 * How close the ink may come to the rim, as a fraction of the radius. 0.94 leaves a hair of disc
 * visible at the tightest point rather than letting the clef kiss the edge.
 */
const FILL = 0.94

/**
 * Optical centring. Geometric centre ≠ looks-centred here: mirrored, the clef's weight is the solid
 * vertical bar hard on the RIGHT while the left is the open C-bowls, so a mathematically centred
 * glyph reads as sitting right-of-centre. Negative nudges it left.
 */
const NUDGE_X = -3.5

/** The score viewport's own grey (Tailwind slate-200) — the icon is made of the app's materials. */
const DISC = '#e2e8f0'

const font = opentype.parse(readFileSync('public/fonts/Bravura.otf').buffer)
const glyph = font.charToGlyph(String.fromCodePoint(CODEPOINT))
if (!glyph || glyph.index === 0) throw new Error('U+E05C (cClef) not found in Bravura')

const path = glyph.getPath(0, 0, 1000)
const bb = path.getBoundingBox()
const d = path.toPathData(2)

/*
 * Fit against the CIRCLE, not a bounding box.
 *
 * Sizing by height alone would push the clef outside the disc: mirrored, the full-height vertical
 * bar sits hard against the right, and that is exactly where the rim curves back in. So take every
 * point of the outline, measure its distance from the glyph's centre, and scale by the WORST one —
 * the largest circle-inscribed size the shape actually allows.
 */
const cx = (bb.x1 + bb.x2) / 2
const cy = (bb.y1 + bb.y2) / 2
let worst = 0
for (const c of path.commands) {
  // Control points too: they bound the curve, so fitting them fits the curve (very slightly small).
  for (const [px, py] of [[c.x, c.y], [c.x1, c.y1], [c.x2, c.y2]]) {
    if (px === undefined || py === undefined) continue
    worst = Math.max(worst, Math.hypot(px - cx, py - cy))
  }
}
const s = (R * FILL) / worst
// Mirrored: x' = tx − s·x, so the glyph's centre lands on the tile centre when tx = TILE/2 + s·cx.
const tx = TILE / 2 + s * cx + NUDGE_X
const ty = TILE / 2 - s * cy

/*
 * NEGATIVE SPACE: the clef is a HOLE in the disc (a mask), so the tab strip shows through it. One
 * flat disc colour and no prefers-color-scheme rule — the disc supplies its own contrast, so the
 * mark reads on a light strip and a dark one without inverting.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}">
  <!-- Bravura's alto clef (SMuFL cClef, U+E05C), outlined from public/fonts/Bravura.otf, mirrored
       about the vertical axis and knocked OUT of the disc, so the clef is the tab strip showing
       through. The disc is the score viewport's own grey (Tailwind slate-200). Bravura is SIL OFL
       1.1 — see public/fonts/OFL.txt. Generated, not drawn: regenerate rather than hand-edit. -->
  <mask id="clef">
    <circle cx="${TILE / 2}" cy="${TILE / 2}" r="${TILE / 2}" fill="#fff"/>
    <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${(-s).toFixed(5)} ${s.toFixed(5)})">
      <path fill="#000" d="${d}"/>
    </g>
  </mask>
  <circle cx="${TILE / 2}" cy="${TILE / 2}" r="${TILE / 2}" fill="${DISC}" mask="url(#clef)"/>
</svg>
`

writeFileSync('public/favicon.svg', svg)
console.log(
  `✓ public/favicon.svg — clef fitted to ${(FILL * 100).toFixed(0)}% of the radius ` +
    `(drawn ${(bb.y2 - bb.y1) * s ? ((bb.y2 - bb.y1) * s).toFixed(1) : '?'} of ${TILE} tall), ` +
    `nudged ${NUDGE_X} left, disc ${DISC}`,
)
