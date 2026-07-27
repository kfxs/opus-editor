import type { StaveNote, Annotation, Tuplet as VexFlowTuplet, SVGContext } from 'vexflow'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { Score } from '@/types/music'
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
 *   - `tieGroupMap`       → `getTieSVGGroup` (tie highlight)
 *   - `tupletObjectMap`   → `getTupletSVGGroup`
 *   - `dynamicObjectMap`  → `getDynamicSVGGroup`
 *   - `elementRegistry`   → `getElementRegistry` (the authoritative hit-test registry)
 *
 * So a `RenderPass` must carry **references to the renderer's own instance-field maps**,
 * never fresh copies — otherwise those getters would read a different (empty) map than
 * the sub-renderers populated. The instance fields remain the canonical home; this
 * object is just a typed bundle of references threaded through one render.
 */
/** Where one fanned member's head landed — a slur endpoint's worth of geometry. */
export interface FanMemberAnchor {
  /** The SLOT's rendered note. Used for the `Curve` object and for `getStave()`, never for x/y. */
  staveNote: StaveNote
  /** Left/right edges of THIS member's notehead (the tie edges a slur springs from). */
  leftX: number
  rightX: number
  /** The head's own centre y. */
  headY: number
  /** The member's stem tip — where a stem-side slur attaches instead of the head. */
  tipY: number
  /** +1 stems up, −1 down: the GROUP's direction, since a beam has one side. */
  stemDirection: number
}

export interface RenderPass {
  /** The score being rendered this pass — read for engraving-override lookups (e.g. per-rest
   *  vertical shifts; see docs/rest-shift-plan.md §6.8). */
  score: Score
  /** The VexFlow SVG rendering context for this pass (rebuilt by `initialize`). */
  context: SVGContext
  /** Note/rest id → its rendered StaveNote (+ chord-head index), for ties & slurs. */
  staveNoteMap: Map<string, { staveNote: StaveNote; noteIndex: number }>
  /**
   * FANNED MEMBER pitch id → where its head was actually drawn, so a SLUR can anchor to one
   * (docs/fanned-beam-pitches-plan.md). A member has no `StaveNote` of its own, and everything a
   * slur endpoint needs is geometry the fan renderer already computed: the head's edges and centre,
   * the stem tip it hangs from, and the SLOT's note — which VexFlow's `Curve` only needs in order
   * to be constructed (the endpoints are passed to `renderCurve` explicitly).
   */
  fanMemberAnchorMap: Map<string, FanMemberAnchor>
  /**
   * FANNED MEMBER pitch id → the `<g class="vf-fanhead">` its ink was drawn into, and which head
   * inside it belongs to that pitch — the member's answer to `staveNoteMap`, since a member has no
   * `StaveNote` of its own and a highlight has to resolve through something. Filled by
   * {@link FanPass}, read back by `VexFlowRenderer.getFanMemberSVGGroup`.
   */
  fanMemberGroupMap: Map<string, { group: SVGGElement; noteIndex: number }>
  /** Tuplet id → its rendered VexFlow Tuplet, for scoped highlight. */
  tupletObjectMap: Map<string, VexFlowTuplet>
  /** Dynamic id → its rendered VexFlow Annotation, for layout & scoped highlight. */
  dynamicObjectMap: Map<string, Annotation>
  /** Slur id → its `<g class="vf-slur">` SVG group, for scoped highlight. */
  slurGroupMap: Map<string, SVGGElement>
  /** Tie from-note id → its `<g class="vf-tie">` SVG group, for scoped highlight. */
  tieGroupMap: Map<string, SVGGElement>
  /** Measure number → computed width/line info (which line a measure landed on, etc.). */
  measureLayoutInfo: Map<number, MeasureWidthInfo>
  /** Measure number → rendered geometry bounds (read post-render by CoordinateMapper). */
  measureBounds: Map<number, MeasureBounds>
  /** Authoritative registry of all rendered elements + positions (hit-testing). */
  elementRegistry: ElementRegistry
  /** Dynamic id currently being edited in the text overlay — skipped this render so
   *  the engraved glyph doesn't double under the editor (constant during a render). */
  suppressedDynamicId: string | null
  /** Tempo mark currently being edited in the text overlay — skipped while it is open,
   *  so the engraved word isn't drawn under the DOM input. Mirrors suppressedDynamicId. */
  suppressedTempoId: string | null
}
