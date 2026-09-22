/**
 * ⭐ GRACES ON RESTS — D7 reversed (his call, 2026-09-22): the grace is entered FIRST, on a rest, and
 * the note typed there after it takes it over. Driven through a real `ScoreModel`, one spec per path a
 * rest can leave the bar by.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace } from './graceOps'
import { beatRestAt } from './restGraceOps'
import { findSlot } from './slotLookup'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import type { ChordRest, Rest } from '@/types/music'

const D5 = { step: 'D' as const, alter: 0 as const, octave: 5 }
const EIGHTH = { duration: '8' as const }

describe('restGraceOps — a grace waits on a rest for its note', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel('Graces') })

  const slots = () => model.getMeasure(1)!.slots
  const shape = () => slots().map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}${s.graceBefore ? '+grace' : ''}`)
  /** The empty bar's rest turned into a one-beat rest at `beat`, with a grace on it. */
  const graceOnBeat = (beat: number): Rest => {
    const rest = beatRestAt(model.getScore(), slots()[0].id, frac(beat, 1))!
    addGrace(model.getScore(), rest.id, 'before', D5, 'appoggiatura', EIGHTH)
    return rest
  }

  it('⭐ rule 1 — a whole-bar rest becomes a ONE-BEAT rest at the beat, the bar refilled by the meter', () => {
    graceOnBeat(2)
    expect(shape()).toEqual(['rest@0:h', 'rest@2:q+grace', 'rest@3:q'])
  })

  it('…in 6/8 the beat is a DOTTED quarter', () => {
    model.setTimeSignature(1, { numerator: 6, denominator: 8 })
    const rest = beatRestAt(model.getScore(), slots()[0].id, frac(2, 1))!
    expect(fracToNumber(rest.beat)).toBe(1.5)
    expect([rest.duration, rest.dots]).toEqual(['q', 1])
  })

  it('⭐⭐ rule 2 — a NOTE entered at that beat takes the grace (the mouse path)', () => {
    graceOnBeat(1)
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const found = findSlot(model.getScore(), note.id)
    expect(found?.type === 'chord' && found.chord.graceBefore?.notes).toHaveLength(1)
    expect(shape()).toEqual(['rest@0:q', 'chord@1:q+grace', 'rest@2:h'])
  })

  it('⭐⭐ …and a pitch TYPED over the rest takes it (the keyboard\'s edit-in-place)', () => {
    const rest = graceOnBeat(1)
    model.updateNote(rest.id, { isRest: false, step: 'E', alter: 0, octave: 5 })
    expect(shape()).toEqual(['rest@0:q', 'chord@1:q+grace', 'rest@2:h'])
  })

  it('a note entered ELSEWHERE leaves the grace on its rest — even when the fill rebuilds that rest', () => {
    graceOnBeat(2)
    model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(shape().find(s => s.includes('+grace'))).toBe('rest@2:q+grace')
  })

  it('⚠️ a note that COVERS the beat (entered earlier, longer) drops the grace — nothing starts there any more', () => {
    graceOnBeat(1)
    model.addNote({ step: 'E', octave: 5, duration: 'h', measure: 1, beat: frac(0, 1) })
    expect(shape().some(s => s.includes('+grace'))).toBe(false)
  })

  it('⭐ the reverse — silencing a note keeps its grace on the rest that replaces it', () => {
    const note = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    addGrace(model.getScore(), note.id, 'before', D5, 'appoggiatura', EIGHTH)
    model.convertToRest(note.id)
    expect(shape()).toContain('rest@1:q+grace')
  })

  it('a METER change carries the rest and its grace through the relay', () => {
    graceOnBeat(1)
    model.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const graced = model.getScore().measures.flatMap(m => m.slots).filter((s: ChordRest) => s.graceBefore)
    expect(graced).toHaveLength(1)
    expect(graced[0].type).toBe('rest')
    expect(fracToNumber(graced[0].beat)).toBe(1)
  })

  it('survives the JSON round trip — which is what undo restores through', () => {
    graceOnBeat(1)
    const loaded = ScoreModel.fromJSON(model.toJSON())
    expect(loaded.getMeasure(1)!.slots.find(s => s.graceBefore)?.type).toBe('rest')
  })
})
