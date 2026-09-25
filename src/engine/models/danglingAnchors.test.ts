/**
 * {@link repairDanglingAnchors} — ONE call runs every note-anchored mark's sweep, so an op that removes
 * notes cannot forget one. A `ScoreModel` is the fixture.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { repairDanglingAnchors } from './danglingAnchors'
import { fracCreate as frac } from '@/utils/fraction'

describe('repairDanglingAnchors', () => {
  it('prunes a slur, a trill and a glissando whose anchors are gone, and severs a tie', () => {
    const model = new ScoreModel()
    const a = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = model.addNote({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const score = model.getScore()
    score.slurs = [{ id: 's', startNoteId: a.id, endNoteId: 'gone' }]
    score.trills = [{ id: 't', startNoteId: 'gone' }]
    score.glissandi = [{ id: 'g', noteId: 'gone' }, { id: 'kept', noteId: b.id }]
    const head = score.measures[0].slots.find(s => s.type === 'chord' && s.notes[0].id === a.id)
    if (head?.type === 'chord') head.notes[0].tiedTo = 'gone'

    repairDanglingAnchors(score)

    expect(score.slurs).toEqual([])
    expect(score.trills).toEqual([])
    expect(score.glissandi).toEqual([{ id: 'kept', noteId: b.id }])
    if (head?.type === 'chord') expect(head.notes[0].tiedTo).toBeUndefined()
  })
})
