/**
 * Bake a hand-stacked glyph drawing into ONE self-contained `<svg>`.
 *
 * This is the "render each drawing to replace it" step. It takes the SAME layers recipe page 2 has
 * always used — a stack of music-font glyphs, each with a `size`/`dx`/`dy` against a 26-unit reference
 * — and reproduces the span-stack's layout in SVG. It is a MECHANICAL transcription, not a re-drawing:
 * same font, same glyphs, same positions, so the baked picture is the hand-stacked picture.
 *
 * It MUST match how {@link renderIcon} lays out `{ layers }` today, which is the whole point:
 *   - each glyph is centred in a GLYPH×GLYPH box (flex-centre), then slid by `dx`/`dy`;
 *   - font-size and offsets are quoted against 26 and scaled by GLYPH (`GLYPH * v / 26`).
 * So here we draw in a fixed 26-unit viewBox with the glyphs centred at (13,13) and let the caller size
 * the svg to GLYPH — then `1 unit == GLYPH/26 px`, exactly the spans' arithmetic. The glyph overflows
 * the little box the same way it overflows its span box (overflow is left visible; the key clips it).
 *
 * It lives here, beside the widget, because it builds DOM. The recipe itself stays pure data in
 * keypadLayouts — the layout declares WHAT to draw; this draws it.
 */

const SVGNS = 'http://www.w3.org/2000/svg'

/** The reference the whole panel quotes against — a glyph's `size`/`dx`/`dy` are all against this. */
const REF = 26

/** One glyph in a stack — mirrors keypadLayouts' GlyphSpec, kept local so the baker owns no data type. */
type Layer = { glyph: string; size?: number; dx?: number; dy?: number }

/**
 * Build the stack as an `<svg>` in the 26-unit box. No cropping and no measuring — the caller sizes the
 * svg to GLYPH and the viewBox does the scaling, so the result lands pixel-for-pixel where the spans do.
 */
export function bakeGlyphStack(layers: Layer[], fontFamily: string): SVGElement {
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('xmlns', SVGNS)
  svg.setAttribute('viewBox', `0 0 ${REF} ${REF}`)
  // The glyphs are taller than the 26 box (a note's stem runs past it) — same as the spans, which
  // overflow their box too. Let it show; the button's own overflow:hidden clips it to the key.
  svg.style.overflow = 'visible'

  for (const layer of layers) {
    const text = document.createElementNS(SVGNS, 'text')
    // Centred on the box's middle, then slid by dx/dy — the spans' "shared centre, then offset".
    text.setAttribute('x', String(REF / 2))
    text.setAttribute('y', String(REF / 2))
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('font-family', fontFamily)
    text.setAttribute('font-size', String(layer.size ?? REF))
    text.setAttribute('fill', 'currentColor')
    const dx = layer.dx ?? 0
    const dy = layer.dy ?? 0
    if (dx || dy) text.setAttribute('transform', `translate(${dx}, ${dy})`)
    text.textContent = layer.glyph
    svg.appendChild(text)
  }

  return svg
}
