import type { Score, EngravingOverride, CurveShapeOverride, SegmentCurveShapeOverride, SlurEndpointOffsetOverride, CurveControlPointDeltas } from '@/types/music'

/**
 * Pure reads over the engraving-overrides compartment (a sub-tree of `Score`; see
 * docs/engraving-overrides-plan.md). {@link ScoreModel} owns the mutators and
 * delegates its reads here; the renderer — which holds a `Score`, not a `ScoreModel` —
 * imports these directly to fetch an override at draw time.
 */

/** Every override recorded for an element id (the live array, or [] if none). */
export function engravingOverridesOf(score: Score, elementId: string): EngravingOverride[] {
  return score.engravingOverrides?.[elementId] ?? []
}

/** The override of a given `kind` on an element, or undefined when absent. */
export function engravingOverrideOf(score: Score, elementId: string, kind: string): EngravingOverride | undefined {
  return score.engravingOverrides?.[elementId]?.find(o => o.kind === kind)
}

/**
 * The element's hand-edited curve shape, if any (client #1 — slurs today). The `cps`
 * are in **staff-spaces**, anchor-relative; the renderer converts them to pixels at
 * draw time. Absent = the auto arch.
 */
export function curveShapeOverrideOf(score: Score, elementId: string): CurveShapeOverride | undefined {
  return engravingOverrideOf(score, elementId, 'curveShape') as CurveShapeOverride | undefined
}

/**
 * The element's per-segment cross-system slur shape, if any (client #2 — cross-system
 * slurs). See docs/multisystem-slur-segment-shape-plan.md. Absent = every segment draws
 * its auto arch. Read it through {@link reconcileSegmentShape} to apply the count-signature
 * staleness rule before using the `middles`.
 */
export function segmentCurveShapeOverrideOf(score: Score, elementId: string): SegmentCurveShapeOverride | undefined {
  return engravingOverrideOf(score, elementId, 'segmentCurveShape') as SegmentCurveShapeOverride | undefined
}

/**
 * The slur's hand-nudged endpoint offsets, if any (client #3 — see
 * docs/slur-endpoint-offset-plan.md). Each `start`/`end` `{x,y}` is in **staff-spaces**,
 * anchor-relative; the renderer converts to pixels against that end's own stave and adds
 * it to the auto endpoint position. Durable — both ends are note-anchored, so this reads
 * straight through (no reconcile rule, unlike {@link reconcileSegmentShape}). Absent = no
 * nudge.
 */
export function endpointOffsetOverrideOf(score: Score, elementId: string): SlurEndpointOffsetOverride | undefined {
  return engravingOverrideOf(score, elementId, 'endpointOffset') as SlurEndpointOffsetOverride | undefined
}

/** The cps to apply per segment of a cross-system slur, after the staleness rule. A field
 *  left undefined means "no override for that segment → draw the auto arch". */
export interface ResolvedSegmentShapes {
  begin?: CurveControlPointDeltas
  end?: CurveControlPointDeltas
  /** MIDDLE cps by ordinal. Empty when the override is absent OR its `spanCount` is stale. */
  middles: Record<number, CurveControlPointDeltas>
}

/**
 * Pure read-only apply rule for a {@link SegmentCurveShapeOverride} (plan §3). Given the
 * override (or undefined) and the **live** system count, decide which segment cps to use:
 *  - no override → nothing applied (all auto);
 *  - `spanCount` matches the live count → `begin`/`end`/`middles` all applied;
 *  - `spanCount` differs → `begin`/`end` applied, **`middles` ignored** (they are anchored
 *    to system margins that no longer exist; begin/end are note-anchored so they survive).
 *
 * No mutation — staleness is decided fresh every render, so this is correct without ever
 * writing back. (The optional lazy *clear* is out of scope; see plan §3.) Pure & VexFlow-free
 * for isolated unit testing, mirroring `planSlurSegments` / `slurTrueEndpoints`.
 */
export function reconcileSegmentShape(
  override: SegmentCurveShapeOverride | undefined,
  liveSpanCount: number,
): ResolvedSegmentShapes {
  if (!override) return { middles: {} }
  const sameCount = override.spanCount === liveSpanCount
  return {
    begin: override.begin,
    end: override.end,
    middles: sameCount ? { ...(override.middles ?? {}) } : {},
  }
}

/**
 * The line spacing (px) a VexFlow `Stave` uses by default — `getSpacingBetweenLines()`
 * returns this unless a stave is explicitly built with a different `spacingBetweenLinesPx`,
 * which this editor never does (zoom is a CSS transform on a layer above the rendered
 * surface, not a stave-spacing change). The old `Slur.cps` was therefore authored in pixels
 * at exactly this spacing, so it is the correct divisor when migrating that legacy data
 * forward to staff-spaces (no live stave is in hand at JSON-load time).
 */
export const VEXFLOW_DEFAULT_STAFF_SPACE_PX = 10

/** A pre-Phase-1 slur that may still carry a pixel-space `cps` shape inline. */
type LegacySlur = Score['slurs'] extends (infer S)[] | undefined
  ? S & { cps?: CurveControlPointDeltas }
  : never

/**
 * One-time forward migration of the pre-Phase-1 `Slur.cps` (pixel-space, stored inline on
 * the slur) into the engraving-overrides compartment as a {@link CurveShapeOverride} in
 * staff-spaces. Runs at JSON load (see {@link ScoreModel.fromJSON}); a no-op for scores
 * already in the new format. Mutates `score` in place.
 */
export function migrateLegacySlurCps(score: Score): void {
  for (const slur of (score.slurs ?? []) as LegacySlur[]) {
    if (!slur.cps) continue
    const cps = slur.cps
    const ss: CurveControlPointDeltas = [
      { x: cps[0].x / VEXFLOW_DEFAULT_STAFF_SPACE_PX, y: cps[0].y / VEXFLOW_DEFAULT_STAFF_SPACE_PX },
      { x: cps[1].x / VEXFLOW_DEFAULT_STAFF_SPACE_PX, y: cps[1].y / VEXFLOW_DEFAULT_STAFF_SPACE_PX },
    ]
    if (!score.engravingOverrides) score.engravingOverrides = {}
    // Don't clobber a new-format override if both somehow coexist — new wins.
    const list = score.engravingOverrides[slur.id] ?? (score.engravingOverrides[slur.id] = [])
    const override: CurveShapeOverride = { kind: 'curveShape', cps: ss }
    if (!list.some(o => o.kind === 'curveShape')) list.push(override)
    delete slur.cps
  }
}
