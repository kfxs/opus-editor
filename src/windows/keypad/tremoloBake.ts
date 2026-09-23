/**
 * Bake a hand-stacked glyph drawing into ONE self-contained `<svg>`.
 *
 * This is the "render each drawing to replace it" step. It takes the SAME layers recipe the Beams/Tremolos page has
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
type Layer = { glyph: string; size?: number; dx?: number; dy?: number; rotate?: number }

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
    const rotate = layer.rotate ?? 0
    // ⚠️ The rotation turns about the box's CENTRE, which is where every layer is anchored — so a
    // rotated glyph spins in place instead of swinging away from the origin. It is written INSIDE the
    // translate so the slide still happens in the box's own axes.
    const moves = [dx || dy ? `translate(${dx}, ${dy})` : '', rotate ? `rotate(${rotate}, ${REF / 2}, ${REF / 2})` : '']
    if (moves[0] || moves[1]) text.setAttribute('transform', moves.filter(Boolean).join(' '))
    text.textContent = layer.glyph
    svg.appendChild(text)
  }

  return svg
}

/**
 * ⭐ **The key a baked drawing is filed under: its RECIPE.** Not its name — so the moment a number in a
 * recipe changes, the outlines baked from the old numbers stop matching and the widget falls back to
 * the live text drawing above. Tuning therefore shows at once, and `npm run bake:keypad` makes it
 * permanent. Used by the bake step, the generated file's reader and the widget alike.
 */
export function bakeRecipeKey(layers: Layer[]): string {
  // ⚠️ A layer with NO rotation keys exactly as it did before rotation existed — four fields, not
  // five. The key is what finds a BAKED drawing, so widening it for every layer would have missed
  // every outline already baked and dropped the whole panel back to the live text form (his report,
  // 2026-09-23). Only a turned layer says so.
  return JSON.stringify(layers.map(l => {
    const base = [l.glyph.codePointAt(0), l.size ?? REF, l.dx ?? 0, l.dy ?? 0]
    return l.rotate ? [...base, l.rotate] : base
  }))
}

/**
 * The BAKED form: the same picture as {@link bakeGlyphStack}, as fixed OUTLINES in the 26-unit box.
 *
 * 🚨 Why it exists (his report, 2026-09-20): the text form asks the BROWSER to lay each glyph out —
 * font size, `text-anchor`, `dominant-baseline: central` off the font's metrics — and a browser ZOOM
 * re-rounds all of that, so the strokes slid against their note at some zoom levels. An outline has
 * no layout left to redo: it is coordinates, and it scales like any other path.
 */
export function bakedPathsSvg(paths: readonly string[]): SVGElement {
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('xmlns', SVGNS)
  svg.setAttribute('viewBox', `0 0 ${REF} ${REF}`)
  svg.style.overflow = 'visible'
  // ⭐ TWO paths for the whole drawing, ⛔ not one per glyph — by what KIND of edge a glyph has.
  //
  //  · Glyphs filled one by one are each anti-aliased on their own, so where two beam bars abut or
  //    overlap the edges blend TWICE and a seam shows (his report, 2026-09-20: the `/` and `8` keys at
  //    90% zoom). As sub-paths of ONE shape the overlap is filled once (`nonzero`: every outer
  //    contour in the font winds the same way).
  //  · 🚨 …and an outline has no HINTING. A beam bar is ~3½ px tall at key size with a 2 px gap to
  //    the next; drawn anti-aliased, wherever its edges miss the pixel grid the gap fills with grey
  //    and two bars read as one (his second report: right at 110%, strange at 100%). The text form
  //    never showed it because the font rasteriser snaps such edges. So the glyphs made ONLY of
  //    horizontal and vertical edges — the bars, a bare stem — are drawn `crispEdges`, which snaps
  //    them to whole pixels at every zoom; everything with a curve or a slant stays smooth, since
  //    a snapped notehead is a staircase.
  const straight = paths.filter(isAxisAligned)
  const curved = paths.filter(d => !isAxisAligned(d))
  for (const [ds, rendering] of [[curved, 'geometricPrecision'], [straight, 'crispEdges']] as const) {
    if (ds.length === 0) continue
    const path = document.createElementNS(SVGNS, 'path')
    path.setAttribute('d', ds.join(''))
    path.setAttribute('fill', 'currentColor')
    path.setAttribute('fill-rule', 'nonzero')
    path.setAttribute('shape-rendering', rendering)
    svg.appendChild(path)
  }
  return svg
}

/** Is this outline a BAR — only horizontal and vertical edges, and thick enough to snap? Pure: it reads
 *  the path data the bake wrote (`M`/`L`/`Z`, absolute; any curve answers no). */
export function isAxisAligned(d: string): boolean {
  if (/[CQSTAcqsta]/.test(d)) return false
  const points = [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,]?(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])])
  if (points.length < 3) return false
  const straight = points.every(([x, y], i) => {
    const [px, py] = points[(i + points.length - 1) % points.length]
    return Math.abs(x - px) < 1e-6 || Math.abs(y - py) < 1e-6
  })
  if (!straight) return false
  // ⚠️ …and THICK enough to be a bar. A bare stem is ~0.6 px wide at key size: snapped, it becomes a
  // solid 1 px line and reads as heavier than the grey hairline of the stems the NOTE glyphs carry
  // beside it (his report: "the stems are like more thick"). Below this it stays smooth, like them.
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= MIN_SNAPPED_UNITS
}

/** The thinnest shape worth snapping, in the 26-unit box — a beam bar is 3.75, a bare stem 0.66. */
const MIN_SNAPPED_UNITS = 2
