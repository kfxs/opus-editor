import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { curveShapeOverrideOf, endpointOffsetOverrideOf, migrateLegacySlurCps, reconcileSegmentShape, reconcileSegmentEndpointOffset, segmentCurveShapeOverrideOf, segmentEndpointOffsetOverrideOf, restPositionKey, restShiftOverrideOf, restHiddenOf, staffSpacingOverrideOf, staffSpacingAbove, staffSystemSpacingKey, perSystemStaffSpacingOf, resolveStaffSpacingAbove, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from './engravingOverrides'
import type { EngravingOverride, CurveShapeOverride, SegmentCurveShapeOverride, SegmentEndpointOffsetOverride, CurveControlPointDeltas, Score, Slur } from '@/types/music'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Phase 0 of the engraving-overrides plan: the compartment is pure infrastructure —
 * id-keyed storage + accessors + JSON round-trip, NO clients yet. These tests pin the
 * accessor contract (upsert, get, clear, pruning) and the "absent = none, JSON stays
 * clean, rides the undo snapshot for free" invariants. The concrete `curveShape` kind
 * arrives in Phase 1; here we use a stand-in kind so the storage layer is exercised
 * without depending on a schema that is intentionally not yet pinned.
 */
describe('ScoreModel engraving overrides (Phase 0 compartment)', () => {
  let model: ScoreModel

  // A stand-in override; Phase 0 only typed the `kind` discriminator, so extra data
  // rides along as an opaque payload.
  const nudge = (dy: number): EngravingOverride => ({ kind: 'offset', dy } as EngravingOverride)
  const reshape = (): EngravingOverride => ({ kind: 'curveShape' } as EngravingOverride)

  beforeEach(() => {
    model = new ScoreModel('Test Score', 120)
  })

  it('starts empty: no compartment on a fresh score, accessors degrade to none', () => {
    expect(model.getScore().engravingOverrides).toBeUndefined()
    expect(model.getEngravingOverrides('note-1')).toEqual([])
    expect(model.getEngravingOverride('note-1', 'offset')).toBeUndefined()
  })

  it('set creates the compartment lazily and stores by element id', () => {
    model.setEngravingOverride('note-1', nudge(2))
    expect(model.getScore().engravingOverrides).toBeDefined()
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 2 })
    expect(model.getEngravingOverrides('note-1')).toHaveLength(1)
  })

  it('set upserts by kind: same kind replaces, different kind appends', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-1', nudge(5)) // same kind → replace
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 5 })
    expect(model.getEngravingOverrides('note-1')).toHaveLength(1)

    model.setEngravingOverride('note-1', reshape()) // different kind → append
    expect(model.getEngravingOverrides('note-1')).toHaveLength(2)
    expect(model.getEngravingOverride('note-1', 'curveShape')).toBeDefined()
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 5 })
  })

  it('keeps overrides on different elements isolated', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-2', nudge(9))
    expect(model.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 2 })
    expect(model.getEngravingOverride('note-2', 'offset')).toEqual({ kind: 'offset', dy: 9 })
  })

  it('clear(id, kind) removes just that kind; clear(id) removes all for the element', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.setEngravingOverride('note-1', reshape())

    expect(model.clearEngravingOverride('note-1', 'offset')).toBe(true)
    expect(model.getEngravingOverride('note-1', 'offset')).toBeUndefined()
    expect(model.getEngravingOverride('note-1', 'curveShape')).toBeDefined()

    expect(model.clearEngravingOverride('note-1')).toBe(true)
    expect(model.getEngravingOverrides('note-1')).toEqual([])
  })

  it('clear returns false when there is nothing to remove', () => {
    expect(model.clearEngravingOverride('ghost')).toBe(false)
    model.setEngravingOverride('note-1', nudge(2))
    expect(model.clearEngravingOverride('note-1', 'curveShape')).toBe(false) // wrong kind
    expect(model.clearEngravingOverride('note-2', 'offset')).toBe(false) // wrong id
  })

  it('prunes empty entries and the whole compartment so absent = none', () => {
    model.setEngravingOverride('note-1', nudge(2))
    model.clearEngravingOverride('note-1', 'offset')
    // last kind on the element gone → element entry pruned, compartment pruned
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('round-trips through JSON unchanged (export/import) and stays absent when empty', () => {
    // Empty score → no engravingOverrides key in the JSON.
    expect(model.toJSON()).not.toContain('engravingOverrides')

    model.setEngravingOverride('note-1', nudge(3))
    model.setEngravingOverride('note-1', reshape())
    model.setEngravingOverride('note-2', nudge(-1))

    const restored = ScoreModel.fromJSON(model.toJSON())
    expect(restored.getEngravingOverride('note-1', 'offset')).toEqual({ kind: 'offset', dy: 3 })
    expect(restored.getEngravingOverride('note-1', 'curveShape')).toBeDefined()
    expect(restored.getEngravingOverride('note-2', 'offset')).toEqual({ kind: 'offset', dy: -1 })
  })

  it('rides the whole-score JSON snapshot (the undo currency) unchanged', () => {
    model.setEngravingOverride('note-1', nudge(4))
    // Mirror UndoRedoManager's deep copy: structuredClone-free JSON round-trip.
    const snapshot = JSON.parse(JSON.stringify(model.getScore()))
    expect(snapshot.engravingOverrides['note-1']).toEqual([{ kind: 'offset', dy: 4 }])
  })
})

/**
 * Phase 1: the `curveShape` kind (client #1) + the legacy `Slur.cps` forward-migration.
 */
describe('curveShape override + legacy Slur.cps migration (Phase 1)', () => {
  // A minimal score carrying a legacy pixel-space slur cps inline (pre-Phase-1 shape).
  const legacyScore = (cps: [{ x: number; y: number }, { x: number; y: number }]): Score => ({
    id: 's', title: 't', tempo: 120,
    keySignature: { key: 'C', accidentals: 0 },
    defaultTimeSignature: { numerator: 4, denominator: 4 },
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

describe('ScoreModel.setSlurSegmentShape + setSlurEndpoint clear (P0 storage)', () => {
  let model: ScoreModel
  let slurId: string
  const cp = (n: number): CurveControlPointDeltas => [{ x: n, y: n }, { x: -n, y: n }]
  const seg = (id: string) => segmentCurveShapeOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score', 120)
    slurId = model.addSlur({ startNoteId: 'n-a', endNoteId: 'n-b' }).id
  })

  it('returns false for an unknown slur', () => {
    expect(model.setSlurSegmentShape('ghost', { role: 'begin' }, cp(1), 3)).toBe(false)
  })

  it('writes begin / end / middle[ordinal] into one override with the live spanCount', () => {
    model.setSlurSegmentShape(slurId, { role: 'begin' }, cp(1), 3)
    model.setSlurSegmentShape(slurId, { role: 'end' }, cp(2), 3)
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 0 }, cp(3), 3)
    expect(seg(slurId)).toEqual({
      kind: 'segmentCurveShape', spanCount: 3, begin: cp(1), end: cp(2), middles: { 0: cp(3) },
    })
  })

  it('a same-count edit preserves the other segments', () => {
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 0 }, cp(3), 3)
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 1 }, cp(4), 3)
    expect(seg(slurId)!.middles).toEqual({ 0: cp(3), 1: cp(4) })
  })

  it('a count-changed edit drops stale middles but keeps durable begin/end', () => {
    model.setSlurSegmentShape(slurId, { role: 'begin' }, cp(1), 3)
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 0 }, cp(3), 3)
    // Re-edit end at a NEW span count → middles authored at count 3 are stale.
    model.setSlurSegmentShape(slurId, { role: 'end' }, cp(2), 2)
    expect(seg(slurId)).toEqual({
      kind: 'segmentCurveShape', spanCount: 2, begin: cp(1), end: cp(2), middles: {},
    })
  })

  it('null clears just the addressed segment; pruning removes an emptied override', () => {
    model.setSlurSegmentShape(slurId, { role: 'begin' }, cp(1), 3)
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 0 }, cp(3), 3)
    model.setSlurSegmentShape(slurId, { role: 'middle', ordinal: 0 }, null, 3)
    expect(seg(slurId)!.middles).toEqual({})
    expect(seg(slurId)!.begin).toEqual(cp(1))

    model.setSlurSegmentShape(slurId, { role: 'begin' }, null, 3) // last edit gone
    expect(seg(slurId)).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('setSlurEndpoint re-anchor clears the segment shape (begin/end were on the old anchor)', () => {
    model.setSlurSegmentShape(slurId, { role: 'begin' }, cp(1), 3)
    expect(seg(slurId)).toBeDefined()
    model.setSlurEndpoint(slurId, 'end', 'n-z')
    expect(seg(slurId)).toBeUndefined()
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
  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

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

describe('ScoreModel.setSlurEndpointOffset', () => {
  let model: ScoreModel
  let slurId: string
  const off = (id: string) => endpointOffsetOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score', 120)
    slurId = model.addSlur({ startNoteId: 'n-a', endNoteId: 'n-b' }).id
  })

  it('returns false for an unknown slur', () => {
    expect(model.setSlurEndpointOffset('ghost', 'start', 1, 1)).toBe(false)
  })

  it('creates the offset for one end, leaving the other absent', () => {
    expect(model.setSlurEndpointOffset(slurId, 'end', 1, 2)).toBe(true)
    expect(off(slurId)).toEqual({ kind: 'endpointOffset', end: { x: 1, y: 2 } })
  })

  it('ACCUMULATES repeated nudges on the same end (one running total)', () => {
    model.setSlurEndpointOffset(slurId, 'start', 0.25, 0)
    model.setSlurEndpointOffset(slurId, 'start', 0.25, -0.5)
    model.setSlurEndpointOffset(slurId, 'start', 0, -0.5)
    expect(off(slurId)!.start).toEqual({ x: 0.5, y: -1 })
  })

  it('keeps the two ends independent', () => {
    model.setSlurEndpointOffset(slurId, 'start', 1, 1)
    model.setSlurEndpointOffset(slurId, 'end', -2, 3)
    expect(off(slurId)).toEqual({
      kind: 'endpointOffset', start: { x: 1, y: 1 }, end: { x: -2, y: 3 },
    })
  })

  it('SURVIVES a re-anchor (anchor-relative) while curveShape/segmentCurveShape are cleared', () => {
    model.setSlurEndpointOffset(slurId, 'start', 0.5, 0.5)
    model.setSlurShape(slurId, [{ x: 1, y: 1 }, { x: 1, y: 1 }])
    model.setSlurSegmentShape(slurId, { role: 'begin' }, [{ x: 2, y: 2 }, { x: 2, y: 2 }], 3)

    model.setSlurEndpoint(slurId, 'end', 'n-z')

    // The span-relative shapes were authored against the old geometry → gone.
    expect(curveShapeOverrideOf(model.getScore(), slurId)).toBeUndefined()
    expect(segmentCurveShapeOverrideOf(model.getScore(), slurId)).toBeUndefined()
    // The endpoint nudge is anchor-relative → it rides onto the new anchor, untouched.
    expect(off(slurId)!.start).toEqual({ x: 0.5, y: 0.5 })
  })

  it('dies with the slur (removeSlur clears all kinds, including the offset)', () => {
    model.setSlurEndpointOffset(slurId, 'start', 1, 1)
    model.removeSlur(slurId)
    expect(off(slurId)).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
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

describe('ScoreModel.setSlurSegmentEndpointOffset', () => {
  let model: ScoreModel
  let slurId: string
  const segOff = (id: string) => segmentEndpointOffsetOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score', 120)
    slurId = model.addSlur({ startNoteId: 'n-a', endNoteId: 'n-b' }).id
  })

  it('returns false for an unknown slur', () => {
    expect(model.setSlurSegmentEndpointOffset('ghost', { role: 'begin' }, 1, 1, 3)).toBe(false)
  })

  it('writes begin / end / middle[ordinal].side with the live spanCount', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 1, -1, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'end' }, 2, -2, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'middle', ordinal: 0, side: 'right' }, 3, -3, 3)
    expect(segOff(slurId)).toEqual({
      kind: 'segmentEndpointOffset', spanCount: 3,
      begin: { x: 1, y: -1 }, end: { x: 2, y: -2 }, middles: { 0: { right: { x: 3, y: -3 } } },
    })
  })

  it('ACCUMULATES repeated nudges on the same open join', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 0.25, 0, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 0.25, -0.5, 3)
    expect(segOff(slurId)!.begin).toEqual({ x: 0.5, y: -0.5 })
  })

  it('keeps a middle’s left and right ends independent', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'middle', ordinal: 0, side: 'left' }, 1, 1, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'middle', ordinal: 0, side: 'right' }, -2, 3, 3)
    expect(segOff(slurId)!.middles![0]).toEqual({ left: { x: 1, y: 1 }, right: { x: -2, y: 3 } })
  })

  it('a count-changed edit drops stale middles but keeps durable begin/end', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 1, 1, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'middle', ordinal: 0, side: 'left' }, 3, 3, 3)
    model.setSlurSegmentEndpointOffset(slurId, { role: 'end' }, 2, 2, 2) // new span count
    expect(segOff(slurId)).toEqual({
      kind: 'segmentEndpointOffset', spanCount: 2, begin: { x: 1, y: 1 }, end: { x: 2, y: 2 }, middles: {},
    })
  })

  it('setSlurEndpoint re-anchor clears the open-join offsets (margin-bound, span-relative)', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 1, 1, 3)
    expect(segOff(slurId)).toBeDefined()
    model.setSlurEndpoint(slurId, 'end', 'n-z')
    expect(segOff(slurId)).toBeUndefined()
  })

  it('dies with the slur (removeSlur clears all kinds)', () => {
    model.setSlurSegmentEndpointOffset(slurId, { role: 'begin' }, 1, 1, 3)
    model.removeSlur(slurId)
    expect(segOff(slurId)).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
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
})

describe('ScoreModel.nudgeRestShift (accumulate / clear, position-keyed)', () => {
  let model: ScoreModel
  const key = restPositionKey('m1', 0, frac(1, 1))
  const shift = (k: string) => restShiftOverrideOf(model.getScore(), k)

  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

  it('reader returns undefined when no shift is stored', () => {
    expect(shift(key)).toBeUndefined()
  })

  it('ACCUMULATES up/down nudges into one running total', () => {
    model.nudgeRestShift(key, 1)
    model.nudgeRestShift(key, 1)
    expect(shift(key)).toEqual({ kind: 'restShift', steps: 2 })
    model.nudgeRestShift(key, -1)
    expect(shift(key)!.steps).toBe(1)
  })

  it('clears the entry (and prunes the compartment) when the net shift returns to 0', () => {
    model.nudgeRestShift(key, 2)
    model.nudgeRestShift(key, -2)
    expect(shift(key)).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('keeps per-voice seats independent (V1 up, V2 down on the same beat)', () => {
    const v0 = restPositionKey('m1', 0, frac(1, 1))
    const v1 = restPositionKey('m1', 1, frac(1, 1))
    model.nudgeRestShift(v0, 1)
    model.nudgeRestShift(v1, -1)
    expect(shift(v0)!.steps).toBe(1)
    expect(shift(v1)!.steps).toBe(-1)
  })
})

// Client #6 (rest hidden) — payloadless, presence-based toggle, position-keyed like #5.
describe('ScoreModel.toggleRestHidden (presence toggle, position-keyed)', () => {
  let model: ScoreModel
  const key = restPositionKey('m1', 0, frac(1, 1))
  const hidden = (k: string) => restHiddenOf(model.getScore(), k)

  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

  it('reader returns false when nothing is stored', () => {
    expect(hidden(key)).toBe(false)
  })

  it('toggles hidden on, then off (and prunes the compartment)', () => {
    model.toggleRestHidden(key)
    expect(hidden(key)).toBe(true)
    model.toggleRestHidden(key)
    expect(hidden(key)).toBe(false)
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('coexists with a rest shift at the same position (independent kinds)', () => {
    model.nudgeRestShift(key, 1)
    model.toggleRestHidden(key)
    expect(restShiftOverrideOf(model.getScore(), key)!.steps).toBe(1)
    expect(hidden(key)).toBe(true)
    // Clearing the shift leaves the hidden flag intact.
    model.nudgeRestShift(key, -1)
    expect(restShiftOverrideOf(model.getScore(), key)).toBeUndefined()
    expect(hidden(key)).toBe(true)
  })
})

// Client #7 (staff spacing) — id-keyed by the durable staffId, signed staff-spaces,
// clears on 0. See docs/staff-spacing-plan.md.
describe('staffSpacingAbove reader (convenience, 0 when absent)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

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

describe('ScoreModel.nudgeStaffSpacing (accumulate / clear, id-keyed)', () => {
  let model: ScoreModel
  const above = (id: string) => staffSpacingOverrideOf(model.getScore(), id)?.above ?? 0
  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

  it('ACCUMULATES up/down nudges into one running total', () => {
    model.nudgeStaffSpacing('staff-1', 1)
    model.nudgeStaffSpacing('staff-1', 4)
    expect(above('staff-1')).toBe(5)
    model.nudgeStaffSpacing('staff-1', -1)
    expect(above('staff-1')).toBe(4)
  })

  it('clears the entry (and prunes the compartment) when the net value returns to 0', () => {
    model.nudgeStaffSpacing('staff-1', 4)
    model.nudgeStaffSpacing('staff-1', -4)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('keeps per-staff seats independent', () => {
    model.nudgeStaffSpacing('staff-1', 2)
    model.nudgeStaffSpacing('staff-2', -3)
    expect(above('staff-1')).toBe(2)
    expect(above('staff-2')).toBe(-3)
  })
})

describe('ScoreModel.setStaffSpacing / resetStaffSpacing (absolute, id-keyed)', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Test Score', 120) })

  it('sets an absolute value and clears on 0', () => {
    model.setStaffSpacing('staff-1', 6)
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(6)
    model.setStaffSpacing('staff-1', 0)
    expect(staffSpacingOverrideOf(model.getScore(), 'staff-1')).toBeUndefined()
    expect(model.getScore().engravingOverrides).toBeUndefined()
  })

  it('resetStaffSpacing drops the override and reports whether anything was removed', () => {
    model.setStaffSpacing('staff-1', 5)
    expect(model.resetStaffSpacing('staff-1')).toBe(true)
    expect(staffSpacingAbove(model.getScore(), 'staff-1')).toBe(0)
    expect(model.resetStaffSpacing('staff-1')).toBe(false)
  })

  it('round-trips through JSON and rides the undo snapshot unchanged', () => {
    model.setStaffSpacing('staff-1', -2)
    const restored = ScoreModel.fromJSON(model.toJSON())
    expect(staffSpacingAbove(restored.getScore(), 'staff-1')).toBe(-2)
    const snapshot = JSON.parse(JSON.stringify(model.getScore()))
    expect(snapshot.engravingOverrides['staff-1']).toEqual([{ kind: 'staffSpacing', above: -2 }])
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
    const model = new ScoreModel('T', 120)
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-5')).toBeUndefined()
    model.setStaffSpacing(staffSystemSpacingKey('staff-1', 'm-5'), 3)
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-5')).toBe(3)
    // a different system is unaffected
    expect(perSystemStaffSpacingOf(model.getScore(), 'staff-1', 'm-9')).toBeUndefined()
  })

  it('resolve prefers the per-system value, else the global fallback, else 0', () => {
    const model = new ScoreModel('T', 120)
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
    const model = new ScoreModel('T', 120)
    model.setStaffSpacing(staffSystemSpacingKey('staff-1', 'm-orphan'), 5)
    // Resolving against a DIFFERENT opening measure (the reflowed system) never sees it → 0.
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', 'm-2')).toBe(0)
    // No opening measure resolvable at all (undefined) → global/0, never the orphan.
    expect(resolveStaffSpacingAbove(model.getScore(), 'staff-1', undefined)).toBe(0)
  })
})
