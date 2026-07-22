import { CHROME } from '../../utils/chromeColors'

/** Bravura first: these are glyphs, not text, so the music font MUST lead the stack. */
export const MUSIC_FONT = "Bravura, Academico, 'Noto Music', serif"

/**
 * A glyph in a box of its own — the one way this window draws music, used by the chart's cells and
 * by the detail bar's big specimen.
 *
 * ⚠️ SVG and not a `<span>`, for the reason `widgets.ts` learned the hard way: an HTML line box is
 * sized by the font's line metrics and CLIPS a note's stem. In SVG we state the box ourselves and
 * put the baseline where we want it. `overflow: visible` lets the genuinely huge glyphs (brackets,
 * octave lines) bleed out rather than be cut in half — a chart that lies about a glyph's shape is
 * worse than one that is briefly untidy.
 */
export function glyphSvgMarkup(
  char: string,
  opts: { box: number; size: number; outline?: boolean; attrs?: string; title?: string },
): string {
  const { box, size, outline = false, attrs = '', title } = opts
  // 0.875 em above the baseline is where a font's ink starts; centring the EM SQUARE in the box
  // (rather than the ink) is what keeps a row of glyphs sitting on one line.
  const baseline = (box - size) / 2 + size * 0.875
  // Half-pixel offsets so the hairline lands inside one pixel row instead of straddling two and
  // painting a soft 2px band — the rule the clef picker's staff lines follow.
  const frame = outline
    ? `<rect x="0.5" y="0.5" width="${box - 1}" height="${box - 1}" fill="none"
             stroke="${CHROME.edge}" stroke-width="1" />`
    : ''
  // SVG's own tooltip element — an HTML `title` attribute does nothing on an SVG node.
  const tip = title === undefined ? '' : `<title>${escapeXml(title)}</title>`
  return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" overflow="visible" ${attrs}>
    ${tip}
    ${frame}
    <text x="${box / 2}" y="${baseline}" text-anchor="middle"
          font-family="${MUSIC_FONT}" font-size="${size}"
          fill="${CHROME.ink}">${escapeXml(char)}</text>
  </svg>`
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
