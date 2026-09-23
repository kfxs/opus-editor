import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addBracketed } from './bracketedGraceOps'
import { findSlot } from './slotLookup'
import { convertSlotToRest } from './convertToRestOps'
import { fracCreate as frac } from '@/utils/fraction'

/**
 * Subject: `./restGraceOps` — a REST's BRACKETED graces ride the graces' hand-over (B10 reversed, his
 * report 2026-09-23): entered first on an empty beat, taken over by the note that takes the rest's place.
 */
const Bb4 = { step: 'B' as const, alter: -1 as const, octave: 4 }

describe('restGraceOps — bracketed graces on a rest', () => {
  it('⭐ a note entered at the rest\'s beat TAKES its bracketed graces', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest' && s.beat.num === 1 && s.beat.den === 1)!
    const made = addBracketed(model.getScore(), rest.id, 'before', Bb4)!
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const found = findSlot(model.getScore(), note.id)
    if (found?.type !== 'chord') throw new Error('expected a chord')
    expect(found.chord.bracketedBefore).toEqual([made])
    expect(model.getMeasure(1)!.slots.some(s => s.type === 'rest' && s.bracketedBefore)).toBe(false)
  })

  it('⭐ …and the rule run backwards: a note SILENCED keeps its bracketed graces on the rest', () => {
    const model = new ScoreModel()
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const made = addBracketed(model.getScore(), note.id, 'before', Bb4)!
    addBracketed(model.getScore(), note.id, 'after', Bb4)
    convertSlotToRest(model, note.id)
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest' && s.bracketedBefore)!
    expect(rest.bracketedBefore).toEqual([made])
    expect('bracketedAfter' in rest).toBe(false)
  })
})
