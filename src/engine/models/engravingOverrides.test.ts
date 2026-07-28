import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { curveShapeOverrideOf, endpointOffsetOverrideOf, migrateLegacySlurCps, reconcileSegmentShape, reconcileSegmentEndpointOffset, restPositionKey, staffSpacingOverrideOf, staffSpacingAbove, staffSystemSpacingKey, perSystemStaffSpacingOf, resolveStaffSpacingAbove, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from './engravingOverrides'
import type { CurveShapeOverride, SegmentCurveShapeOverride, SegmentEndpointOffsetOverride, CurveControlPointDeltas, Score, Slur } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Phase 1: the `curveShape` kind (client #1) + the legacy `Slur.cps` forward-migration.
 */
describe('curveShape override + legacy Slur.cps migration (Phase 1)', () => {
  // A minimal score carrying a legacy pixel-space slur cps inline (pre-Phase-1 shape).
  const legacyScore = (cps: [{ x: number; y: number }, { x: number; y: number }]): Score => ({
    id: 's', title: 't',
    measures: [],
    slurs: [{ id: 'slur-1', startNoteId: 'n-a', endNoteId: 'n-b', cps } as unknown as Slur],
  })

  it('moves inline pixel cps into the compartment as staff-spaces (px / default spacing)', () => {
    const score = legacyScore([{ x: 20, y: 10 }, { x: -5, y: 30 }])
    migrateLegacySlurCps(score)
    const k = VEXFLOW_DEFAULT_STAFF_SPACE_PX
    expect(curveShapeOverrideOf(score, 'slur-1')?.cps).toEqual([
      { x: 20 / k, y: 10 / k },
      { x: -5 / k, y: 30 / k },
    ])
    // The legacy inline field is stripped.
    expect((score.slurs![0] as { cps?: unknown }).cps).toBeUndefined()
  })

  it('is a no-op for a new-format score (no inline cps, no compartment churn)', () => {
    const score = legacyScore([{ x: 1, y: 1 }, { x: 1, y: 1 }])
    delete (score.slurs![0] as { cps?: unknown }).cps // already migrated / fresh
    migrateLegacySlurCps(score)
    expect(score.engravingOverrides).toBeUndefined()
  })

  it('does not clobber an existing new-format curveShape override', () => {
    const score = legacyScore([{ x: 99, y: 99 }, { x: 99, y: 99 }])
    const existing: CurveShapeOverride = { kind: 'curveShape', cps: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }] }
    score.engravingOverrides = { 'slur-1': [existing] }
    migrateLegacySlurCps(score)
    // New-format entry wins; the legacy inline cps is still cleared.
    expect(curveShapeOverrideOf(score, 'slur-1')?.cps).toEqual([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }])
    expect((score.slurs![0] as { cps?: unknown }).cps).toBeUndefined()
  })

  it('curveShapeOverrideOf returns undefined when the element has no curve shape', () => {
    const score = legacyScore([{ x: 1, y: 1 }, { x: 1, y: 1 }])
    delete (score.slurs![0] as { cps?: unknown }).cps
    expect(curveShapeOverrideOf(score, 'slur-1')).toBeUndefined()
  })
})

/**
 * P0 of the multi-system slur per-segment shape plan: the `segmentCurveShape` kind (client
 * #2) + the pure read-only `reconcileSegmentShape` apply rule + the `setSlurSegmentShape`
 * model mutator + the `setSlurEndpoint` clear of the new kind. No VexFlow / render here —
 * just storage + the count-signature staleness rule.
 */
describe('reconcileSegmentShape (pure apply rule, plan §3)', () => {
  const cp = (n: number): CurveControlPointDeltas => [{ x: n, y: n }, { x: -n, y: n }]
  const override = (spanCount: number): SegmentCurveShapeOverride => ({
    kind: 'segmentCurveShape', spanCount, begin: cp(1), end: cp(2), middles: { 0: cp(3), 1: cp(4) },
  })

  it('no override → nothing applied, empty middles', () => {
    expect(reconcileSegmentShape(undefined, 3)).toEqual({ middles: {} })
  })

  it('matching span count → begin, end, AND middles all applied', () => {
    expect(reconcileSegmentShape(override(3), 3)).toEqual({
      begin: cp(1), end: cp(2), middles: { 0: cp(3), 1: cp(4) },
    })
  })

  it('differing span count → begin + end applied, middles dropped (stale margins)', () => {
    expect(reconcileSegmentShape(override(3), 2)).toEqual({
      begin: cp(1), end: cp(2), middles: {},
    })
  })

  it('does not mutate the override (returns a fresh middles object)', () => {
    const o = override(3)
    const r = reconcileSegmentShape(o, 3)
    r.middles[0] = cp(99)
    expect(o.middles![0]).toEqual(cp(3)) // original untouched
  })
})

/**
 * P0 of the slur endpoint-offset plan (docs/slur-endpoint-offset-plan.md): the
 * `endpointOffset` kind (client #3) + the `endpointOffsetOverrideOf` reader +
 * `setSlurEndpointOffset` (accumulate) + the deliberate "survives a re-anchor" exception
 * to the §3.3 auto-reset. Pure storage — no VexFlow / render here.
 */
describe('endpointOffsetOverrideOf reader', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('returns undefined when the slur has no endpoint offset', () => {
    const id = model.addSlur({ startNoteId: 'n-a', endNoteId: 'n-b' }).id
    expect(endpointOffsetOverrideOf(model.getScore(), id)).toBeUndefined()
  })

  it('returns the stored offset once set', () => {
    const id = model.addSlur({ startNoteId: 'n-a', endNoteId: 'n-b' }).id
    model.setSlurEndpointOffset(id, 'start', 0.25, -0.5)
    expect(endpointOffsetOverrideOf(model.getScore(), id)).toEqual({
      kind: 'endpointOffset', start: { x: 0.25, y: -0.5 },
    })
  })
})

/**
 * P0 of the multi-system slur segment-endpoint offset plan
 * (docs/multisystem-slur-segment-endpoint-offset-plan.md): the `segmentEndpointOffset` kind
 * (client #4) + the `reconcileSegmentEndpointOffset` apply rule (twin of reconcileSegmentShape)
 * + the `setSlurSegmentEndpointOffset` accumulate mutator + the `setSlurEndpoint` clear. Pure
 * storage + the count-signature staleness rule; no VexFlow / render here.
 */
describe('reconcileSegmentEndpointOffset (pure apply rule, open-join twin)', () => {
  const p = (n: number) => ({ x: n, y: -n })
  const override = (spanCount: number): SegmentEndpointOffsetOverride => ({
    kind: 'segmentEndpointOffset', spanCount, begin: p(1), end: p(2),
    middles: { 0: { left: p(3), right: p(4) }, 1: { left: p(5) } },
  })

  it('no override → nothing applied, empty middles', () => {
    expect(reconcileSegmentEndpointOffset(undefined, 3)).toEqual({ middles: {} })
  })

  it('matching span count → begin, end, AND middles all applied', () => {
    expect(reconcileSegmentEndpointOffset(override(3), 3)).toEqual({
      begin: p(1), end: p(2), middles: { 0: { left: p(3), right: p(4) }, 1: { left: p(5) } },
    })
  })

  it('differing span count → begin + end applied, middles dropped (stale margins)', () => {
    expect(reconcileSegmentEndpointOffset(override(3), 2)).toEqual({
      begin: p(1), end: p(2), middles: {},
    })
  })

  it('does not mutate the override (returns a fresh middles object)', () => {
    const o = override(3)
    const r = reconcileSegmentEndpointOffset(o, 3)
    r.middles[0] = { left: p(99) }
    expect(o.middles![0]).toEqual({ left: p(3), right: p(4) }) // original untouched
  })
})

/**
 * Client #5: the rest-shift override (docs/rest-shift-plan.md). Unlike every other client it
 * is POSITION-keyed (`restPositionKey`), not element-id-keyed — rests have no durable id. Here
 * we pin the pure key builder + reader + the `nudgeRestShift` accumulate/clear mutator. The
 * travel-across-rebar/paste behavior lives in ScoreModel.test.ts / clipboard.test.ts.
 */
describe('restPositionKey (pure key builder)', () => {
  it('canonicalizes the beat fraction so 2/4 and 1/2 collapse to one key', () => {
    expect(restPositionKey('m1', 0, frac(2, 4))).toBe('m1:v0:b1/2')
    expect(restPositionKey('m1', 0, frac(2, 4))).toBe(restPositionKey('m1', 0, frac(1, 2)))
  })

  it('encodes the measure id and voice (independent seats)', () => {
    expect(restPositionKey('mA', 1, frac(0, 1))).toBe('mA:v1:b0/1')
    expect(restPositionKey('mA', 0, frac(0, 1))).not.toBe(restPositionKey('mB', 0, frac(0, 1)))
    expect(restPositionKey('mA', 0, frac(0, 1))).not.toBe(restPositionKey('mA', 1, frac(0, 1)))
  })

  it('separates staves — N staves share a measure, so the SAME bar/voice/beat is a DIFFERENT seat per staff', () => {
    // The multi-staff bleed bug: without the staffId a shift on staff 2 landed on staff 1's rest
    // at the same address. Staff-N carries a `:s…` segment; staff 0 (absent) does NOT, so its key
    // stays byte-identical to the pre-multistaff format.
    expect(restPositionKey('mA', 0, frac(0, 1), 'staff-2')).toBe('mA:sstaff-2:v0:b0/1')
    expect(restPositionKey('mA', 0, frac(0, 1), undefined)).toBe('mA:v0:b0/1') // staff 0 unchanged
    expect(restPositionKey('mA', 0, frac(0, 1), 'staff-2')).not.toBe(restPositionKey('mA', 0, frac(0, 1)))
    expect(restPositionKey('mA', 0, frac(0, 1), 'staff-2')).not.toBe(restPositionKey('mA', 0, frac(0, 1), 'staff-3'))
    // Still prefixed by `{measureId}:`, so MeasureRedrawKey.overridesFor keeps matching it.
    expect(restPositionKey('mA', 0, frac(0, 1), 'staff-2').startsWith('mA:')).toBe(true)
  })
})

// Client #7 (staff spacing) — id-keyed by the durable staffId, signed staff-spaces,
// clears on 0. See docs/staff-spacing-plan.md.
describe('staffSpacingAbove reader (convenience, 0 when absent)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score') })

  it('returns 0 when no override is stored', () => {
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(0)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toBeUndefined()
  })

  it('returns the stored above once set', () => {
    model.setStaffSpacing('staff-1', 3)
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(3)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toEqual({ kind: 'staffSpacing', above: 3 })
  })
})

// Per-system staff spacing (plan option C): keyed by staffId@openingMeasureId, resolves to the
// global-per-staff value as fallback, and self-heals when the anchor no longer opens a system.
describe('per-system staff spacing (staffSystemSpacingKey / resolveStaffSpacingAbove)', () => {
  it('builds a composite key that cannot collide with a bare id or a rest key', () => {
    expect(staffSystemSpacingKey('staff-1', 'm-9')).toBe('staff-1@m-9')
    expect(staffSystemSpacingKey('staff-1', 'm-9')).toContain('@')
    // distinct systems (opening measures) get distinct keys for the same staff
    expect(staffSystemSpacingKey('staff-1', 'm-1')).not.toBe(staffSystemSpacingKey('staff-1', 'm-5'))
  })

  it('perSystemStaffSpacingOf reads the entry under the composite key, undefined when absent', () => {
    const model = new ScoreModel('T')
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-5')).toBeUndefined()
    model.setStaffSpacing(staffSystemSpacingKey('staff-1', 'm-5'), 3)
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-5')).toBe(3)
    // a different system is unaffected
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-9')).toBeUndefined()
  })

  it('resolve prefers the per-system value, else the global fallback, else 0', () => {
    const model = new ScoreModel('T')
    const s = model.getScore()
    // nothing set → 0
    expect(resolveStaffSpacingAbove(s, 'staff-1', 'm-5')).toBe(0)
    // global only → global on every system
    model.setStaffSpacing('staff-1', 2)
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-5')).toBe(2)
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-9')).toBe(2)
    // per-system on m-5 overrides the global there, but not on m-9
    model.setStaffSpacing(staffSystemSpacingKey('staff-1', 'm-5'), 7)
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-5')).toBe(7)
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-9')).toBe(2)
  })

  it('self-heals: an override anchored to a measure that no longer opens a system is ignored', () => {
    const model = new ScoreModel('T')
    model.setStaffSpacing(staffSystemSpacingKey('staff-1', 'm-orphan'), 5)
    // Resolving against a DIFFERENT opening measure (the reflowed system) never sees it → 0.
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-2')).toBe(0)
    // No opening measure resolvable at all (undefined) → global/0, never the orphan.
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', undefined)).toBe(0)
  })
})
