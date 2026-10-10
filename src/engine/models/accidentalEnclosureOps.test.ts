import { describe, it, expect, beforeEach } from 'vitest'
import { ScoreModel } from './ScoreModel'
import * as ops from './accidentalEnclosureOps'
import * as graceOps from './graceOps'
import { moveNoteToVoice } from './voiceOps'
import { fracCreate as frac, fracCompare } from '@/utils/fraction'
import type { Chord } from '@/types/music'

/**
 * Subject: `./accidentalEnclosureOps` — the brackets a pitch's ACCIDENTAL wears (alteration-signs-plan K3):
 * which pitches may carry them, the toggle's rule, the report on load, and that the field TRAVELS with
 * its pitch through the model's copies.
 */
describe('accidentalEnclosureOps', () => {
  let model: ScoreModel
  beforeEach(() => { model = new ScoreModel() })
  const score = () => model.getScore()
  const add = (step: 'C' | 'E' | 'G', beat: number, duration: 'q' | 'h' = 'q') =>
    model.addNote({ step, octave: 4, duration, measure: 1, beat: frac(beat, 1) })
  const pitchOf = (id: string) =>
    score().measures.flatMap(m => m.slots).filter((s): s is Chord => s.type === 'chord').flatMap(s => s.notes).find(p => p.id === id)!

  it('a chord head: set writes the shape, null DELETES the field', () => {
    const n = add('C', 0)
    expect(ops.setAccidentalEnclosure(score(), [n.id], 'round')).toBe(1)
    expect(ops.accidentalEnclosureOf(score(), n.id)).toBe('round')
    expect(ops.setAccidentalEnclosure(score(), [n.id], null)).toBe(1)
    expect('accidentalEnclosure' in pitchOf(n.id)).toBe(false)
  })

  it('the toggle: any bare ⇒ all get them; all bracketed ⇒ all lose them', () => {
    const c = add('C', 0)
    const e = add('E', 1)
    ops.setAccidentalEnclosure(score(), [c.id], 'round')
    expect(ops.toggleAccidentalEnclosure(score(), [c.id, e.id])).toBe('round')
    expect(ops.accidentalEnclosureOf(score(), e.id)).toBe('round')
    expect(ops.toggleAccidentalEnclosure(score(), [c.id, e.id])).toBeNull()
    expect(ops.accidentalEnclosureOf(score(), c.id)).toBeUndefined()
  })

  it('⛔ a GRACE pitch is not a main head — skipped, and the toggle has nothing to vote', () => {
    const host = add('C', 0)
    const grace = graceOps.addGrace(score(), host.id, 'before', { step: 'D', octave: 4 }, 'appoggiatura', { duration: '8' })!
    expect(ops.setAccidentalEnclosure(score(), [grace.pitches[0].id], 'round')).toBe(0)
    expect(ops.toggleAccidentalEnclosure(score(), [grace.pitches[0].id])).toBeUndefined()
  })

  it('reports, never repairs: an unknown shape, and brackets on a grace', () => {
    const n = add('C', 0)
    const grace = graceOps.addGrace(score(), n.id, 'before', { step: 'D', octave: 4 }, 'appoggiatura', { duration: '8' })!
    ;(pitchOf(n.id) as { accidentalEnclosure?: string }).accidentalEnclosure = 'square'
    ;(grace.pitches[0] as { accidentalEnclosure?: string }).accidentalEnclosure = 'round'
    const problems = ops.signEnclosureProblems(score())
    expect(problems).toHaveLength(2)
    expect(pitchOf(n.id).accidentalEnclosure).toBe('square') // untouched
  })

  describe('the field TRAVELS with its pitch', () => {
    const headsOf = (measureNumber: number) =>
      [...(model.getMeasure(measureNumber)?.slots ?? [])]
        .sort((a, b) => fracCompare(a.beat, b.beat))
        .filter((s): s is Chord => s.type === 'chord')
        .flatMap(s => s.notes)

    it('a re-bar keeps it', () => {
      const n = add('C', 0, 'h')
      add('E', 2, 'h')
      ops.setAccidentalEnclosure(score(), [n.id], 'round')
      model.setTimeSignature(1, { numerator: 3, denominator: 4 })
      expect(headsOf(1).filter(p => p.accidentalEnclosure === 'round').map(p => p.step)).toEqual(['C'])
    })

    it('a move to another voice keeps it', () => {
      const n = add('C', 0)
      ops.setAccidentalEnclosure(score(), [n.id], 'round')
      expect(moveNoteToVoice(score(), n.id, 1)).toBe(true)
      expect(ops.accidentalEnclosureOf(score(), n.id)).toBe('round')
    })

    it('the flat note projects it', () => {
      const n = add('C', 0)
      expect(model.getNote(n.id)!.accidentalEnclosure).toBeUndefined()
      ops.setAccidentalEnclosure(score(), [n.id], 'round')
      expect(model.getNote(n.id)!.accidentalEnclosure).toBe('round')
    })

    it('a JSON round trip keeps it', () => {
      const n = add('C', 0)
      ops.setAccidentalEnclosure(score(), [n.id], 'round')
      const back = ScoreModel.fromJSON(model.toJSON())
      expect(ops.accidentalEnclosureOf(back.getScore(), n.id)).toBe('round')
    })
  })
})
