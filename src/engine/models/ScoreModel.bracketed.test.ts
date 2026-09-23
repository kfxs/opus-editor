import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addBracketed } from './bracketedGraceOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * Subject: `./ScoreModel` — `getNote` / `updateNote` on a BRACKETED pitch (bracketed-grace-plan P2b):
 * it projects as ITSELF, and takes a PITCH and nothing else, so its host never moves.
 */
describe('ScoreModel — a bracketed pitch through the note API', () => {
  const setup = () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const made = addBracketed(model.getScore(), note.id, 'before', { step: 'B', alter: -1, octave: 4 }, undefined, 'h')!
    const chord = (): Chord => {
      const f = findSlot(model.getScore(), note.id)
      if (f?.type !== 'chord') throw new Error('expected a chord')
      return f.chord
    }
    return { model, note, made, id: made.pitches[0].id, chord }
  }

  it('⭐ getNote projects it as ITSELF — its pitch, its written value, its host\'s place; none of the host\'s marks', () => {
    const { model, note, id } = setup()
    model.updateNote(note.id, { articulations: ['staccato'] })
    const flat = model.getNote(id)!
    expect(flat).toMatchObject({ id, step: 'B', alter: -1, octave: 4, duration: 'h', measure: 1 })
    expect(flat.beat).toEqual(frac(1, 1))
    expect(flat.isRest).toBeUndefined()
    expect(flat.articulations).toBeUndefined()
    expect(model.getNotePitch(id)).not.toBeNull()
  })

  it('⭐ updateNote takes the PITCH (the arrows\' path) — and ⛔ ignores a duration, so the HOST never moves', () => {
    const { model, id, chord } = setup()
    model.updateNote(id, { step: 'C', alter: 0, octave: 5, duration: 'w', articulations: ['accent'] })
    expect(model.getNote(id)).toMatchObject({ step: 'C', alter: 0, octave: 5 })
    expect(chord().duration).toBe('q')
    expect(chord().articulations).toBeUndefined()
  })
})
