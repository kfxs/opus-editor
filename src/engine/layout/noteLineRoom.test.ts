/**
 * {@link noteLineRoom} — every note-to-note line's request in a bar, one list (today: the glissando's).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGlissando } from '@/engine/models/glissandoOps'
import { noteLineRoom } from './noteLineRoom'
import { glissandoRoomIn } from './glissandoRoom'
import { fracCreate as frac } from '@/utils/fraction'

describe('noteLineRoom', () => {
  it('is the glissandi\'s requests, and empty in a bar with none', () => {
    const model = new ScoreModel()
    const c = model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    model.addNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const bar = model.getMeasure(1)!
    expect(noteLineRoom(model.getScore(), bar)).toEqual([])
    addGlissando(model.getScore(), c.id)
    expect(noteLineRoom(model.getScore(), bar)).toEqual(glissandoRoomIn(model.getScore(), bar))
    expect(noteLineRoom(model.getScore(), bar)).toHaveLength(1)
  })
})
