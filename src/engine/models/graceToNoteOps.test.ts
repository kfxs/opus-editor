import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { addGrace } from './graceOps'
import { convertNoteToGrace } from './noteToGraceOps'
import { clearGraceGroup, graceToNote, wholeGroupSelected } from './graceToNoteOps'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

/** The inverse of P4 (his rules, 2026-09-22). A `ScoreModel` is the fixture. */
describe('graceToNoteOps', () => {
  const setup = () => {
    const model = new ScoreModel()
    model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const score = model.getScore()
    const slotAt1 = () => model.getMeasure(1)!.slots.find(s => fracToNumber(s.beat) === 1)!
    const grace = (step: 'D' | 'F' | 'G' | 'A') =>
      addGrace(score, e.id, 'before', { step, alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })!.pitches[0].id
    return { model, score, e, slotAt1, grace }
  }

  it('⭐ the ROUND TRIP: a note made a grace, toggled off, is the same note again', () => {
    const { score, e, slotAt1 } = setup()
    const chord = slotAt1()
    if (chord.type === 'chord') chord.articulations = ['accent']
    convertNoteToGrace(score, e.id, 'acciaccatura')
    expect(slotAt1().type).toBe('rest')
    expect(graceToNote(score, e.id)).toBe(e.id)
    const back = slotAt1()
    expect(back.type).toBe('chord')
    expect(back.type === 'chord' && back.notes.map(p => [p.id, p.step, p.octave])).toEqual([[e.id, 'E', 5]])
    expect(back.duration).toBe('q')
    expect(back.type === 'chord' && back.articulations).toEqual(['accent'])
    expect(back.graceBefore).toBeUndefined()
  })

  it('⭐ on a REAL note: its slot keeps its duration and takes the grace\'s pitch — the old pitch goes', () => {
    const { score, e, slotAt1, grace } = setup()
    const d = grace('D')
    graceToNote(score, d)
    const slot = slotAt1()
    expect(slot.type === 'chord' && slot.notes.map(p => p.step)).toEqual(['D'])
    expect(slot.duration).toBe('q')
    expect(slot.type === 'chord' && slot.notes.some(p => p.id === e.id)).toBe(false)
  })

  it('⭐ one of a GROUP: the graces AFTER it go, the ones BEFORE it stay the note\'s group', () => {
    const { score, slotAt1, grace } = setup()
    const [d, f, g] = [grace('D'), grace('F'), grace('G')]
    graceToNote(score, f)
    const slot = slotAt1()
    expect(slot.type === 'chord' && slot.notes[0].id).toBe(f)
    expect(slot.graceBefore!.notes.map(n => n.pitches[0].id)).toEqual([d])
    expect(slot.graceBefore!.notes.some(n => n.pitches[0].id === g)).toBe(false)
  })

  it('⭐ a WHOLE group: it just goes — the main note untouched', () => {
    const { score, e, slotAt1, grace } = setup()
    const ids = [grace('D'), grace('F')]
    expect(wholeGroupSelected(score, ids[0], new Set(ids))).toBe(true)
    expect(wholeGroupSelected(score, ids[0], new Set([ids[0]]))).toBe(false)
    expect(clearGraceGroup(score, ids[0])).toBe(true)
    const slot = slotAt1()
    expect(slot.graceBefore).toBeUndefined()
    expect(slot.type === 'chord' && slot.notes[0].id).toBe(e.id)
  })

  it('a slur on the old main pitch moves to the new note', () => {
    const { model, score, e, grace } = setup()
    const c = model.getMeasure(1)!.slots[0]
    const cId = c.type === 'chord' ? c.notes[0].id : ''
    model.addSlur({ startNoteId: cId, endNoteId: e.id, voice: 0 })
    const d = grace('D')
    graceToNote(score, d)
    expect(score.slurs![0].endNoteId).toBe(d)
  })
})
