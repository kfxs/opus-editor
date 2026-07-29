import { VexFlowRenderer, LAYOUT_CONFIG } from '../rendering/VexFlowRenderer'
import { resolveSurface, SKETCH_CANVAS, type Surface } from '@/engine/layout/surface'
import type { Score } from '@/types/music'

/**
 * A clean, whole-score SVG — the thing an export starts from, and the half every export format
 * shares. It is deliberately NOT the SVG you are looking at:
 *
 *  - the on-screen renderer CULLS (only the bars in the viewport are painted — `setCullWindow`),
 *    so its SVG is a window onto the score, not the score;
 *  - it carries the editor's marks: selection recolouring, the armed tool's ghost, the caret,
 *    the linear-view gutter and the play cursor all live on or over that SVG — and the gray of
 *    every element the user has HIDDEN, which is an editing affordance and not engraving.
 *
 * So an export gets its OWN renderer on its OWN detached-ish container: cull window never set
 * (⇒ every bar drawn), wrapped view (⇒ the surface's column, cast off exactly as on screen), no
 * ghost, nothing selected, and the **print audience** (⇒ a hidden
 * element leaves no ink at all rather than gray ink — `engine/rendering/hiddenElements.ts`).
 * Zoom needs no undoing — it is a CSS transform on the app's layer, so this SVG is always at
 * scale 1.
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
/**
 * @param surface What to engrave onto (`engine/layout/surface.ts`). An **argument**, not something
 * threaded from the editor's renderer: this function builds its own renderer, so the surface has no
 * other way in — and an export's surface is a legitimately separate question from the one the
 * editor is drawing (docs/layout-plan.md P0.3). Defaults to today's sketching canvas.
 */
export async function renderScoreSvg(score: Score, surface: Surface = SKETCH_CANVAS): Promise<ScoreSvgRender> {
  const metrics = resolveSurface(surface)
  const host = document.createElement('div')
  // Off the left edge of the world, but in the layout: see the ⚠️ above.
  host.style.cssText =
    `position:absolute; left:-10000px; top:0; width:${metrics.widthPx}px;` +
    ' pointer-events:none; background:#ffffff;'
  // 🚨 FIRST in the document, and only while the render runs — see the note below the function.
  document.body.insertBefore(host, document.body.firstChild)
  const dispose = () => host.remove()

  try {
    await document.fonts?.ready
    const renderer = new VexFlowRenderer(host)
    // Paper, not screen: hidden elements are omitted rather than grayed. See the ⚠️ in
    // `hiddenElements.ts` — they still take their space, they just leave no ink.
    renderer.setAudience('print')
    renderer.setSurface(surface)
    // Any size will do — `renderScore` resizes the SVG to the music it just cast off.
    renderer.initialize(metrics.widthPx, LAYOUT_CONFIG.STAVE_HEIGHT)
    renderer.renderScore(score)
    // The render is over; stand out of the live score's light again.
    document.body.appendChild(host)

    const svg = host.querySelector('svg')
    if (!svg) throw new Error('Export render produced no SVG')
    return { svg: svg as SVGSVGElement, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

/**
 * ## Why the export host is inserted FIRST, then moved to the end
 *
 * Some engraving happens *after* VexFlow has drawn, by reaching back for the element it drew —
 * `applyMixedDynamicRuns` re-lays a dynamic's glyph run at music size that way, and the co-location
 * row, the hand-nudged offsets and the registered hit-boxes all follow the same path. VexFlow finds
 * that element with **`document.getElementById`** (`Element.getSVGElement`), and the id it looks up
 * is `vf-` + the element's id — which for a dynamic IS THE MODEL'S OWN ID (`DynamicsLayout` calls
 * `annotation.setAttribute('id', dyn.id)`).
 *
 * So while an export render is on the page there are two elements with that id: the editor's and
 * ours. `getElementById` returns the first in **tree order**, so an export host appended to the end
 * of `<body>` loses every one of those lookups to the live score — and the export silently keeps
 * the un-enlarged glyph. That was the bug: an `f` two-and-a-bit times too small in the PDF, with
 * the editor showing it correctly the whole time. (The dynamic's own offset and co-location layout
 * went the same way, less visibly.)
 *
 * Being first in tree order wins those lookups back. It is safe because `renderScore` is
 * **synchronous**: nothing else can render while we hold that position, and we give it up the
 * moment the call returns — so a live render that lands during the export's async tail (fonts,
 * outlining, PDF writing) finds the editor's own elements first, as it must.
 *
 * ⛔ Do not "simplify" this to a plain `appendChild`.
 */

/** The rendered surface's size in CSS pixels, read off the SVG the renderer just sized. */
export function svgPixelSize(svg: SVGSVGElement): { width: number; height: number } {
  return {
    width: parseFloat(svg.getAttribute('width') || '0'),
    height: parseFloat(svg.getAttribute('height') || '0'),
  }
}
