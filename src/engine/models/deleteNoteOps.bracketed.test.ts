import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addBracketed } from './bracketedGraceOps'
import { addGrace } from './graceOps'
import { deleteNoteWithRepair } from './deleteNoteOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./deleteNoteOps` — a BRACKETED grace deletes as ITSELF (bracketed-grace-plan P2b): its host
 * and the bar stay exactly as they were.
 */
describe('deleteNoteWithRepair — a bracketed grace', () => {
  it('⭐ removes the bracketed grace only — the note it stood before is untouched', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const made = addBracketed(model.getScore(), note.id, 'before', { step: 'D', alter: 0, octave: 5 })!
    const bar = JSON.stringify(model.getMeasure(1)!.slots.map(s => [s.type, s.beat, s.duration]))
    expect(deleteNoteWithRepair(model, made.pitches[0].id)).toBe(true)
    const f = findSlot(model.getScore(), note.id)
    expect(f?.type === 'chord' && 'bracketedBefore' in f.chord).toBe(false)
    expect(JSON.stringify(model.getMeasure(1)!.slots.map(s => [s.type, s.beat, s.duration]))).toBe(bar)
  })

  it('⭐ B4: on a grace inside a group, deleting it IS the merge — the group was one all along', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    addGrace(model.getScore(), note.id, 'before', { step: 'G', alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })
    const g2 = addGrace(model.getScore(), note.id, 'before', { step: 'A', alter: 0, octave: 4 }, 'acciaccatura', { duration: '8' })!
    const made = addBracketed(model.getScore(), g2.pitches[0].id, 'before', { step: 'B', alter: -1, octave: 4 })!
    deleteNoteWithRepair(model, made.pitches[0].id)
    const f = findSlot(model.getScore(), note.id)
    expect(f?.type === 'chord' && f.chord.graceBefore?.notes).toHaveLength(2)
    expect('bracketedBefore' in g2).toBe(false)
  })
})
