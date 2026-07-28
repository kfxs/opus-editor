/**
 * {@link slurOps} — the slur's four setters, and the rules by which they clear each other.
 *
 * All three chapters here are about the same decision: WHICH hand-authored edits survive which
 * change. A re-anchor drops the span-relative shapes (they were drawn against the old endpoints)
 * and keeps the note-anchored `endpointOffset` (it rides onto the new anchor); a segment edit made
 * against a different system count drops its stale MIDDLES and keeps begin/end. None of that is
 * geometry — it is storage plus a staleness rule, which is why it can be checked with no renderer.
 *
 * A `ScoreModel` is the FIXTURE. Extracted from `engravingOverrides.test.ts` on 2026-07-28 by the
 * modularity plan's Phase 3, under Phase 0's rule that *a spec moves with its module*.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { curveShapeOverrideOf, endpointOffsetOverrideOf, segmentCurveShapeOverrideOf, segmentEndpointOffsetOverrideOf } from './engravingOverrides'
import type { CurveControlPointDeltas } from '@/types/music'

describe('ScoreModel.setSlurSegmentShape + setSlurEndpoint clear (P0 storage)', () => {
  let model: ScoreModel
  let slurId: string
  const cp = (n: number): CurveControlPointDeltas => [{ x: n, y: n }, { x: -n, y: n }]
  const seg = (id: string) => segmentCurveShapeOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score')
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

describe('ScoreModel.setSlurEndpointOffset', () => {
  let model: ScoreModel
  let slurId: string
  const off = (id: string) => endpointOffsetOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score')
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

describe('ScoreModel.setSlurSegmentEndpointOffset', () => {
  let model: ScoreModel
  let slurId: string
  const segOff = (id: string) => segmentEndpointOffsetOverrideOf(model.getScore(), id)

  beforeEach(() => {
    model = new ScoreModel('Test Score')
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
