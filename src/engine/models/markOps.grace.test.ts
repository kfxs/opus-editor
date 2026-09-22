import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace } from './graceOps'
import { flipArticulationPlacement } from './markOps'
import { fracCreate as frac } from '@/utils/fraction'

describe('markOps.flipArticulationPlacement — on a GRACE (its marks are its own attack\'s)', () => {
  it('⭐ flips auto (below — a grace\'s stem is always up) to above and back, touching nothing else', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const grace = addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    grace.articulations = ['staccato']
    const id = grace.pitches[0].id
    expect(flipArticulationPlacement(model.getScore(), id)?.id).toBe(id)
    expect(grace.articulationPlacement).toBe('above')
    flipArticulationPlacement(model.getScore(), id)
    expect('articulationPlacement' in grace).toBe(false)
    expect(model.getNote(host.id)?.articulationPlacement, 'the host is not touched').toBeUndefined()
  })
})
