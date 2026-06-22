import type { StaveNote, Annotation, Tuplet as VexFlowTuplet } from 'vexflow'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { MeasureWidthInfo, MeasureBounds } from './VexFlowRenderer'

/**
 * The per-render state of a single `VexFlowRenderer.renderScore` pass, bundled into
 * one object so the sub-renderers (ties, slurs, dynamics, …) can be extracted into
 * their own modules without each reaching back into the renderer instance.
 *
 * ⚠ **Lifetime — these are NOT throwaway scratch maps.** Most of them are also the
 * renderer's *persistent post-render lookup tables*, read after the render by public
 * accessors that external collaborators call:
 *   - `measureBounds`     → `getMeasureBounds` / `getAllMeasureBounds` (CoordinateMapper, pixel↔position)
 *   - `staveNoteMap`      → `renderPendingTie` (tie preview), `getStaveNoteSVGGroup` (drag/highlight)
 *   - `slurGroupMap`      → `getSlurSVGGroup` (slur drag/highlight)
 *   - `tupletObjectMap`   → `getTupletSVGGroup`
 *   - `dynamicObjectMap`  → `getDynamicSVGGroup`
 *   - `elementRegistry`   → `getElementRegistry` (the authoritative hit-test registry)
 *
 * So a `RenderPass` must carry **references to the renderer's own instance-field maps**,
 * never fresh copies — otherwise those getters would read a different (empty) map than
 * the sub-renderers populated. The instance fields remain the canonical home; this
 * object is just a typed bundle of references threaded through one render.
 */
export interface RenderPass {
  /** The VexFlow SVG rendering context for this pass (rebuilt by `initialize`). */
  context: any
  /** Note/rest id → its rendered StaveNote (+ chord-head index), for ties & slurs. */
  staveNoteMap: Map<string, { staveNote: StaveNote; noteIndex: number }>
  /** Tuplet id → its rendered VexFlow Tuplet, for scoped highlight. */
  tupletObjectMap: Map<string, VexFlowTuplet>
  /** Dynamic id → its rendered VexFlow Annotation, for layout & scoped highlight. */
  dynamicObjectMap: Map<string, Annotation>
  /** Slur id → its `<g class="vf-slur">` SVG group, for scoped highlight. */
  slurGroupMap: Map<string, SVGGElement>
  /** Measure number → computed width/line info (which line a measure landed on, etc.). */
  measureLayoutInfo: Map<number, MeasureWidthInfo>
  /** Measure number → rendered geometry bounds (read post-render by CoordinateMapper). */
  measureBounds: Map<number, MeasureBounds>
  /** Authoritative registry of all rendered elements + positions (hit-testing). */
  elementRegistry: ElementRegistry
  /** Dynamic id currently being edited in the text overlay — skipped this render so
   *  the engraved glyph doesn't double under the editor (constant during a render). */
  suppressedDynamicId: string | null
}
