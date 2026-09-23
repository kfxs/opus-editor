import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { addGrace } from '@/engine/models/graceOps'
import { addBracketed } from '@/engine/models/bracketedGraceOps'
import { fracCreate as frac } from '@/utils/fraction'
import { noteReportKind } from './noteReportKind'

describe('noteReportKind', () => {
  it('⭐ a grace is reported as a GRACE, its main note as a note, a rest as a rest', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const g = addGrace(model.getScore(), host.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '8' })!
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    const score = model.getScore()
    expect(noteReportKind(score, model.getNote(g.pitches[0].id)!)).toBe('grace')
    expect(noteReportKind(score, model.getNote(host.id)!)).toBe('note')
    expect(noteReportKind(score, model.getNote(rest.id)!)).toBe('rest')
  })

  it('⭐ a BRACKETED grace is reported as what it is — its panel is the grace\'s (the offset)', () => {
    const model = new ScoreModel()
    const host = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addBracketed(model.getScore(), host.id, 'before', { step: 'B', alter: -1, octave: 4 })!
    expect(noteReportKind(model.getScore(), model.getNote(b.pitches[0].id)!)).toBe('bracketed')
  })
})
