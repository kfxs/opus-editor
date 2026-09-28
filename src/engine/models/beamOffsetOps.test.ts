/** Subject: `./beamOffsetOps` — a beam's hand nudge, RELATIVE to its stems, filed under its first note's slot. */
import { describe, expect, it } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { beamOffsetOverrideOf } from './engravingOverrides'
import { beamOffsetOf, beamOffsetSlotOf, nudgeBeamOffset, resetBeamOffset } from './beamOffsetOps'
import { fracCreate as frac } from '@/utils/fraction'

function setUp() {
  const m = new ScoreModel('beam')
  const note = m.addNote({ step: 'C', alter: 0, octave: 5, duration: '8', measure: 1, beat: frac(0, 1) })
  const slot = m.getScore().measures[0].slots.find(s => s.type === 'chord')!
  return { m, score: m.getScore(), anchor: note.id, slotId: slot.id }
}

describe('beamOffsetOps', () => {
  it('⭐ files the offset under the anchor pitch\'s SLOT — so the bar\'s redraw key carries it', () => {
    const { score, anchor, slotId } = setUp()
    expect(beamOffsetSlotOf(score, anchor)).toBe(slotId)
    nudgeBeamOffset(score, anchor, 1)
    expect(beamOffsetOverrideOf(score, slotId)).toEqual({ kind: 'beamOffset', away: 1 })
  })

  it('accumulates in staff spaces AWAY from the heads; a net zero deletes the entry', () => {
    const { score, anchor, slotId } = setUp()
    nudgeBeamOffset(score, anchor, 0.25)
    nudgeBeamOffset(score, anchor, 0.25)
    expect(beamOffsetOf(score, anchor)).toBe(0.5)
    nudgeBeamOffset(score, anchor, -0.5)
    expect(score.engravingOverrides?.[slotId]).toBeUndefined()
  })

  it('reset clears it, and says false when it was never moved; a rest or an unknown id has nothing to move', () => {
    const { score, anchor } = setUp()
    expect(resetBeamOffset(score, anchor)).toBe(false)
    nudgeBeamOffset(score, anchor, 1)
    expect(resetBeamOffset(score, anchor)).toBe(true)
    expect(beamOffsetOf(score, anchor)).toBe(0)
    const rest = score.measures[0].slots.find(s => s.type === 'rest')!
    expect(nudgeBeamOffset(score, rest.id, 1)).toBe(false)
    expect(nudgeBeamOffset(score, 'nope', 1)).toBe(false)
  })
})
