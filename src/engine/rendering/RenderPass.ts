import type { EngravedNote } from './EngravedNote'
import type { SvgPainter } from './SvgPainter'
import type { EngravedAnnotation } from './EngravedAnnotation'
import type { ScoreTuplet } from './ScoreTuplet'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { Score } from '@/types/music'
import type { SpacedColumns } from './spacingPass'
import type { OccupiedSpan } from '@/engine/layout/outsideStaffBand'
import type { DrawnCurve } from '@/engine/layout/curveObstacleBand'
import type { MeasureWidthInfo } from '@/engine/layout/layoutConfig'
import type { MeasureBounds } from './renderTypes'

/**
 * The per-render state of a single `ScoreRenderer.renderScore` pass, bundled into
 * one object so the sub-renderers (ties, slurs, dynamics, …) can be extracted into
 * their own modules without each reaching back into the renderer instance.
 *
 * ⚠ **Lifetime — these are NOT throwaway scratch maps.** Most of them are also the
 * renderer's *persistent post-render lookup tables*, read after the render by public
 * accessors that external collaborators call:
 *   - `measureBounds`     → `getMeasureBounds` / `getAllMeasureBounds` (CoordinateMapper, pixel↔position)
 *   - `staveNoteMap`      → `renderPendingTie` (tie preview), `getStaveNoteSVGGroup` (drag/highlight)
 *   - `slurGroupMap`      → `getSlurSVGGroup` (slur drag/highlight)
 *   - `hairpinGroupMap`   → `getHairpinSVGGroup` (hairpin highlight)
 *   - `trillGroupMap`     → `getTrillSVGGroup` (trill highlight)
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
  staveNote: EngravedNote
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
   *  vertical shifts; see docs/plans/rest-shift-plan.md §6.8). */
  score: Score
  /**
   * ⭐⭐ **THE SURFACE THIS PASS DRAWS ON** (rebuilt by `initialize`) — our own type, `paint/`'s
   * {@link DrawContext}, satisfied by our `SvgPainter` (S13b; VexFlow's `SVGContext` until then), the
   * object behind it. `docs/plans/own-engraving-engine.md` P1b.
   *
   * ⭐ Every pass that only *draws* takes this and no longer names a VexFlow type. Reach for
   * {@link RenderPass.painter} only for the two things this cannot do — see there.
   */
  context: DrawContext
  /**
   * ⭐ **THE PAINTER ITSELF** (S13b) — the same object as {@link RenderPass.context} outside a recorded
   * render, named for the two things a surface cannot do: **reach the PAGE** (`.svg`, for a DOM
   * read-back) and **rewind the ambient ink** (`state` / `attributes`, `markPreviewPass`). Until S13b this
   * was `painter: SVGContext`, and the migration's progress bar; nothing of VexFlow's is behind it now.
   * ⚠️ A beam's and a stem's draw are handed it too — the painter rather than a recorder, as before.
   */
  painter: SvgPainter
  /** Note/rest id → its rendered StaveNote (+ chord-head index), for ties & slurs. */
  staveNoteMap: Map<string, { staveNote: EngravedNote; noteIndex: number }>
  /**
   * FANNED MEMBER pitch id → where its head was actually drawn, so a SLUR can anchor to one
   * (docs/plans/fanned-beam-pitches-plan.md). A member has no `StaveNote` of its own, and everything a
   * slur endpoint needs is geometry the fan renderer already computed: the head's edges and centre,
   * the stem tip it hangs from, and the SLOT's note. ⭐ (The note used to be needed only to
   * CONSTRUCT VexFlow's `Curve`; since U1 the arc takes no note at all — just its endpoints.)
   */
  fanMemberAnchorMap: Map<string, FanMemberAnchor>
  /**
   * FANNED MEMBER pitch id → the `<g class="fanhead">` its ink was drawn into, and which head
   * inside it belongs to that pitch — the member's answer to `staveNoteMap`, since a member has no
   * `StaveNote` of its own and a highlight has to resolve through something. Filled by
   * {@link FanPass}, read back by `ScoreRenderer.getFanMemberSVGGroup`.
   */
  fanMemberGroupMap: Map<string, { group: SVGGElement; noteIndex: number }>
  /** Tuplet id → its rendered VexFlow Tuplet, for scoped highlight. */
  tupletObjectMap: Map<string, ScoreTuplet>
  /** Dynamic id → its rendered VexFlow Annotation, for layout & scoped highlight. */
  dynamicObjectMap: Map<string, EngravedAnnotation>
  /** Slur id → its `<g class="slur">` SVG group, for scoped highlight. */
  slurGroupMap: Map<string, SVGGElement>
  /** Hairpin id → its `<g class="hairpin">` SVG group, for scoped highlight. Like the slur's,
   *  one group per hairpin even when the wedge is split across systems — the fragments are drawn
   *  into the same group, so recolouring it colours the whole wedge. */
  hairpinGroupMap: Map<string, SVGGElement>
  /** Trill id → its `<g class="trill">` SVG group, for scoped highlight. One group per trill even
   *  when the ornament repeats on a continuation system — the fragments are drawn into the same
   *  group, so recolouring it colours the whole trill (`hairpinGroupMap`'s arrangement). */
  trillGroupMap: Map<string, SVGGElement>
  /** Ottava id → its `<g class="ottava">` SVG group, for scoped highlight. One group per octave
   *  line even when the bracket is split across systems, so recolouring it colours every fragment
   *  including the parenthesised continuation numeral (`trillGroupMap`'s arrangement). */
  ottavaGroupMap: Map<string, SVGGElement>
  /** Pedal id → its `<g class="pedal">` SVG group, for scoped highlight. One group per pedal even
   *  when it is split across systems — every fragment's signs are drawn into it, so recolouring the
   *  group colours the `Ped.`, its `(Ped.)` resumptions and the `✻` together
   *  (`ottavaGroupMap`'s arrangement). */
  pedalGroupMap: Map<string, SVGGElement>
  /** Tie from-note id → its `<g class="tie">` SVG group, for scoped highlight. */
  tieGroupMap: Map<string, SVGGElement>
  /** Measure number → computed width/line info (which line a measure landed on, etc.). */
  measureLayoutInfo: Map<number, MeasureWidthInfo>
  /**
   * ⭐ Measure number → WHERE THE COLUMN SOLVE PUT EVERY COLUMN of that bar, filled by the spacing
   * pass as each bar is placed.
   *
   * It is here rather than handed down an argument list because the reader is not the caller: a
   * FAN's members have no tick context of their own, so the pass cannot write their x's, and
   * `FanPass` — which draws them, several steps later and from a different loop — is the only thing
   * that can spend the room the bar granted them (`engine/layout/fanRampRoom.ts`). A pass-scoped bag
   * is exactly what `measureLayoutInfo` beside it is for.
   */
  solvedColumns: Map<number, SpacedColumns>
  /**
   * ⭐⭐ **WHAT THE OUTSIDE-STAFF FAMILIES HAVE ALREADY TAKEN**, appended to by each as it is placed
   * and read by the ones placed after it (`engine/layout/outsideStaffBand.ts`, docs/plans/ottava-plan.md
   * P0a). This is the LADDER: the order is the order the passes run in, and there is no priority
   * table anywhere.
   *
   * Here for `solvedColumns`' reason — the writer and the reader are different passes several steps
   * apart, and neither calls the other. ⚠️ Unlike its neighbours it is **throwaway scratch**: a
   * fresh array per render, referenced by nothing after it (see the lifetime note above, which does
   * not apply to this one).
   */
  occupiedBands: OccupiedSpan[]
  /**
   * ⭐⭐ **THE CURVES THAT HAVE BEEN DRAWN** — every slur arc, slur segment and tie, filed by the
   * pass that drew it so the outside-staff families can clear one
   * (`engine/layout/curveObstacleBand.ts`, docs/plans/trill-slur-clearance-plan.md P1).
   *
   * ⭐ Its own collection rather than a read of the `ElementRegistry`, which holds the same sampled
   * points for hit-testing. Two reasons, and both bit: the registry stores them SCALED into SVG
   * space (`withScale`) while every family's arithmetic is in the staff's own space, and a registry
   * slur entry cannot say which staff or which system it is on — each partial of a cross-system
   * slur carries the whole slur's `fromMeasure`/`toMeasure`. Filing them here keeps the layout
   * question and the hit-testing question apart, which is what stops the two drifting.
   *
   * ⚠️ Throwaway scratch, like `occupiedBands`: a fresh array per render, and ⛔ **only meaningful
   * to a pass that runs after `renderSlurs`** — which is why the ladder is now planned after it.
   */
  drawnCurves: DrawnCurve[]
  /** Measure number → rendered geometry bounds (read post-render by CoordinateMapper). */
  measureBounds: Map<number, MeasureBounds>
  /** Authoritative registry of all rendered elements + positions (hit-testing). */
  elementRegistry: ElementRegistry
  /** Dynamic id currently being edited in the text overlay — skipped this render so
   *  the engraved glyph doesn't double under the editor (constant during a render). */
  suppressedDynamicId: string | null
  /**
   * ⭐⭐ **How wide the OVERLAY's text currently is, in the score's own pixels** — null when nothing
   * is being edited, or when the editor could not measure itself.
   *
   * 🚨 Because a suppressed mark is NOT DRAWN, so everything that asks where its ink is gets nothing
   * back and concludes the space is free: the wedge closes its hole and draws straight through the
   * editor (his report, 2026-08-18). The mark's remembered ink covers where it WAS; this covers
   * where it is GOING, since the text changes size under the user's hands.
   *
   * ⚠️ It is a WIDTH, not a box, and deliberately: the overlay is `position: fixed` at the mark's
   * own left edge and grows RIGHTWARD, so the only thing that moves is how far it reaches. A box
   * would need the DOM→staff-space conversion this avoids.
   */
  suppressedDynamicInkWidth: number | null
  /**
   * ⭐ **THE LAST INK EACH MARK WAS MEASURED AT**, by dynamic id — owned by the renderer and
   * therefore alive ACROSS renders, unlike everything else on this object.
   *
   * A mark hidden behind its editor still occupies the page; this is how the passes that read ink
   * off the DOM (`HairpinRenderer`) can answer for one that is not there this time round. ⚠️ Stale
   * entries for deleted marks are harmless: nothing looks up an id that is not in a measure's own
   * dynamics list.
   */
  markInkMemory: Map<string, { left: number; right: number; top: number; bottom: number }>
  /** Tempo mark currently being edited in the text overlay — skipped while it is open,
   *  so the engraved word isn't drawn under the DOM input. Mirrors suppressedDynamicId. */
  suppressedTempoId: string | null
  /**
   * **How big a staff is DRAWN**, by 0-based index — 1 for full size (docs/plans/staff-size-plan.md).
   *
   * Every pass that draws OUTSIDE a measure group needs it, because everything it reads back off
   * the drawn notes is in that staff's own scaled space (§4.3 — see `inStaffSpace`). A function
   * rather than an array so a caller cannot index it wrongly, and so the renderer stays the single
   * place that decides what a staff's size is.
   */
  staffScale: (staffIndex: number) => number
}
