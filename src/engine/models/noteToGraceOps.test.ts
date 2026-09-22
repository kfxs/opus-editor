import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace } from './graceOps'
import { convertNoteToGrace } from './noteToGraceOps'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

/**
 * P4 — a note becomes a grace (his rule, 2026-09-22): the note's slot becomes a rest of its length and
 * the note's pitches a grace BEFORE that rest. A `ScoreModel` is the fixture.
 */
describe('convertNoteToGrace', () => {
  const setup = () => {
    const model = new ScoreModel()
    const c = model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const d = model.addNote({ step: 'D', octave: 5, duration: '8', dots: 1, measure: 1, beat: frac(1, 1) })
    const score = model.getScore()
    const bar = () => model.getMeasure(1)!.slots
    const shape = () => bar().map(s => `${s.type}@${fracToNumber(s.beat)}:${s.duration}${s.dots ? '.' : ''}`)
    return { model, score, c, d, bar, shape }
  }

  it('⭐ the note\'s place becomes a REST of its own length — nothing after it moves', () => {
    const { score, d, shape } = setup()
    const before = shape()
    const made = convertNoteToGrace(score, d.id, 'appoggiatura')!
    expect(made.graceId).toBe(d.id) // the note's own pitch id
    expect(shape()).toEqual(before.map(s => (s.startsWith('chord@1:') ? s.replace('chord', 'rest') : s)))
  })

  it('⭐ …and the note is a grace BEFORE that rest, written as it was: pitches, dotted value, marks', () => {
    const { score, d, bar } = setup()
    const chord = bar().find(s => s.id !== undefined && s.type === 'chord' && s.notes[0].id === d.id)!
    if (chord.type === 'chord') chord.articulations = ['staccato']
    const { restId } = convertNoteToGrace(score, d.id, 'acciaccatura')!
    const rest = bar().find(s => s.id === restId)!
    expect(rest.type).toBe('rest')
    const group = rest.graceBefore!
    expect(group.slash).toBe(true)
    expect(group.notes).toEqual([{ pitches: [{ id: d.id, step: 'D', alter: 0, octave: 5 }], duration: '8', dots: 1, articulations: ['staccato'] }])
  })

  it('⭐ a note that ALREADY has graces: they stay, and it joins the END of the group (his rule)', () => {
    const { score, d, bar } = setup()
    const g = addGrace(score, d.id, 'before', { step: 'E', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    const { restId } = convertNoteToGrace(score, d.id, 'appoggiatura')!
    const rest = bar().find(s => s.id === restId)!
    expect(rest.graceBefore!.notes.map(n => n.pitches[0].id)).toEqual([g.pitches[0].id, d.id])
  })

  it('a CHORD becomes a grace chord; its ties go (a grace is not tied)', () => {
    const { model, score, c, bar } = setup()
    model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const chord = bar()[0]
    if (chord.type === 'chord') chord.notes[0].tiedTo = 'somewhere'
    const { restId } = convertNoteToGrace(score, c.id, 'appoggiatura')!
    const grace = bar().find(s => s.id === restId)!.graceBefore!.notes[0]
    expect(grace.pitches.map(p => p.step).sort()).toEqual(['C', 'E'])
    expect(grace.pitches.some(p => 'tiedTo' in p || 'tiedFrom' in p)).toBe(false)
  })

  it('⛔ refuses a rest and a grace', () => {
    const { score, d, bar } = setup()
    const rest = bar().find(s => s.type === 'rest')!
    expect(convertNoteToGrace(score, rest.id, 'appoggiatura')).toBeNull()
    const g = addGrace(score, d.id, 'before', { step: 'E', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!
    expect(convertNoteToGrace(score, g.pitches[0].id, 'appoggiatura')).toBeNull()
  })
})
