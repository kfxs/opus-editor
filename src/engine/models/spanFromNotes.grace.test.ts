import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace } from './graceOps'
import { nextDistinctSlot, spanFromNotes } from './spanFromNotes'
import { fracCreate as frac } from '@/utils/fraction'

describe('spanFromNotes — a GRACE (his report: "slur is not working for grace")', () => {
  const setup = () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g1 = addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    const g2 = addGrace(model.getScore(), host.id, 'before', { step: 'F', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    return { model, host, g1: g1.pitches[0].id, g2: g2.pitches[0].id }
  }

  it('⭐ from a lone grace BEFORE, the next thing is the next grace — and from the last, its MAIN note', () => {
    const { model, host, g1, g2 } = setup()
    expect(nextDistinctSlot(model, model.getNote(g1)!)?.id).toBe(g2)
    expect(nextDistinctSlot(model, model.getNote(g2)!)?.id).toBe(host.id)
  })

  it('⭐ grace + its note, clicked in EITHER order, read grace → note', () => {
    const { model, host, g1 } = setup()
    for (const ids of [[g1, host.id], [host.id, g1]]) {
      const span = spanFromNotes(model, ids, { byVoice: true, sounding: false })!
      expect([span.start.id, span.end.id]).toEqual([g1, host.id])
    }
  })
})
