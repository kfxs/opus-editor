/**
 * {@link reanchorSlurs} — what happens to the slurs hanging off a head that is deleted or replaced.
 * A bare `Score` is enough: the function reads `score.slurs` and the overrides compartment, nothing
 * a `ScoreModel` computes.
 */
import { describe, it, expect } from 'vitest'
import type { Score } from '@/types/music'
import { reanchorSlurs } from './slurOps'
import { setEngravingOverride } from './overrideOps'
import { engravingOverridesOf } from './engravingOverrides'

function scoreWith(slurs: { id: string; startNoteId: string; endNoteId: string }[]): Score {
  return { id: 's', title: '', measures: [], slurs: slurs.map(s => ({ ...s, voice: 0 })) } as unknown as Score
}

const SHAPE = { kind: 'curveShape', cps: [{ x: 0, y: 1 }, { x: 0, y: 1 }] } as never
const OFFSET = { kind: 'slurOffset', x: 1, y: 0 } as never

describe('reanchorSlurs', () => {
  it('re-points BOTH roles onto the replacement — a start here, an end there', () => {
    const score = scoreWith([
      { id: 'A', startNoteId: 'old', endNoteId: 'x' },
      { id: 'B', startNoteId: 'y', endNoteId: 'old' },
    ])
    reanchorSlurs(score, 'old', 'new')
    expect(score.slurs!.map(s => [s.startNoteId, s.endNoteId])).toEqual([['new', 'x'], ['y', 'new']])
  })

  it('null = no surviving anchor: the slur is DROPPED, and only the ones that touched it', () => {
    const score = scoreWith([
      { id: 'A', startNoteId: 'old', endNoteId: 'x' },
      { id: 'B', startNoteId: 'y', endNoteId: 'z' },
    ])
    reanchorSlurs(score, 'old', null)
    expect(score.slurs!.map(s => s.id)).toEqual(['B'])
  })

  it('⛔ a re-anchor that COLLAPSES the span (start === end) drops the slur too', () => {
    const score = scoreWith([{ id: 'A', startNoteId: 'old', endNoteId: 'new' }])
    reanchorSlurs(score, 'old', 'new')
    expect(score.slurs).toEqual([])
  })

  it('⭐ a re-point clears the span-relative SHAPE and keeps the rest; a drop clears everything', () => {
    const score = scoreWith([
      { id: 'A', startNoteId: 'old', endNoteId: 'x' },
      { id: 'B', startNoteId: 'gone', endNoteId: 'x' },
    ])
    for (const id of ['A', 'B']) {
      setEngravingOverride(score, id, SHAPE)
      setEngravingOverride(score, id, OFFSET)
    }
    reanchorSlurs(score, 'old', 'new')
    reanchorSlurs(score, 'gone', null)
    expect(engravingOverridesOf(score, 'A').map(o => o.kind)).toEqual(['slurOffset'])
    expect(engravingOverridesOf(score, 'B')).toEqual([])
  })

  it('a score with no slurs at all is a no-op', () => {
    const score = { id: 's', title: '', measures: [] } as unknown as Score
    expect(() => reanchorSlurs(score, 'old', 'new')).not.toThrow()
  })
})
