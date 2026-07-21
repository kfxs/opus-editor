import { VexFlowRenderer, LAYOUT_CONFIG } from '../rendering/VexFlowRenderer'
import type { Score } from '@/types/music'

/**
 * A clean, whole-score SVG — the thing an export starts from, and the half every export format
 * shares. It is deliberately NOT the SVG you are looking at:
 *
 *  - the on-screen renderer CULLS (only the bars in the viewport are painted — `setCullWindow`),
 *    so its SVG is a window onto the score, not the score;
 *  - it carries the editor's marks: selection recolouring, the armed tool's ghost, the caret,
 *    the linear-view gutter and the play cursor all live on or over that SVG.
 *
 * So an export gets its OWN renderer on its OWN detached-ish container: cull window never set
 * (⇒ every bar drawn), wrapped view (⇒ the fixed `CONTAINER_WIDTH` column that is already a
 * page-width casting-off), no ghost, nothing selected. Zoom needs no undoing — it is a CSS
 * transform on the app's layer, so this SVG is always at scale 1.
 *
 * ⚠️ The host must be **laid out**, not `display: none`. Dynamics stacking (DynamicsLayout) and
 * tempo-mark placement (TempoLayout) ask the DOM for `getBBox()` and make real placement
 * decisions from the answer; in a `display: none` subtree every box reads 0×0 and the marks land
 * wrong. Off to the left of the world it is, then — laid out, painted, just not on screen.
 */
export interface ScoreSvgRender {
  /** The rendered SVG. Still IN the document — `getBBox`/`getComputedStyle` only answer for an
   *  attached element, and both the outliner and svg2pdf need them. Valid until `dispose()`. */
  svg: SVGSVGElement
  /** Removes the host from the document. Always call it (a `finally`), or the page leaks a
   *  full score's worth of SVG per export. */
  dispose(): void
}

/**
 * Render `score` to its own off-screen SVG. Async only because the music font has to be there
 * BEFORE the first measurement: VexFlow ships Bravura/Academico as web fonts and every glyph is a
 * `<text>`, so a render that beats `document.fonts.ready` measures fallback metrics and engraves
 * to them.
 */
export async function renderScoreSvg(score: Score): Promise<ScoreSvgRender> {
  const host = document.createElement('div')
  // Off the left edge of the world, but in the layout: see the ⚠️ above.
  host.style.cssText =
    `position:absolute; left:-10000px; top:0; width:${LAYOUT_CONFIG.CONTAINER_WIDTH}px;` +
    ' pointer-events:none; background:#ffffff;'
  document.body.appendChild(host)
  const dispose = () => host.remove()

  try {
    await document.fonts?.ready
    const renderer = new VexFlowRenderer(host)
    // Any size will do — `renderScore` resizes the surface to the music it just cast off.
    renderer.initialize(LAYOUT_CONFIG.CONTAINER_WIDTH, LAYOUT_CONFIG.STAVE_HEIGHT)
    renderer.renderScore(score)

    const svg = host.querySelector('svg')
    if (!svg) throw new Error('Export render produced no SVG')
    return { svg: svg as SVGSVGElement, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

/** The rendered surface's size in CSS pixels, read off the SVG the renderer just sized. */
export function svgPixelSize(svg: SVGSVGElement): { width: number; height: number } {
  return {
    width: parseFloat(svg.getAttribute('width') || '0'),
    height: parseFloat(svg.getAttribute('height') || '0'),
  }
}
