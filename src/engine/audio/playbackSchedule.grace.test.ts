import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { addGrace } from '../models/graceOps'
import { collectScheduledNotes } from './playbackSchedule'
import { fracCreate as frac } from '@/utils/fraction'
import { pitchToMidi } from '@/utils/pitchSpelling'
import type { GraceForm } from '../models/graceOps'
import type { NoteDuration } from '@/types/music'

/**
 * P3 — the GRACES sound (`docs/plans/grace-notes-plan.md` §6; the timing is `./graceAttacks`, MuseScore's
 * preset). A `ScoreModel` is the fixture; the subject is what `collectScheduledNotes` emits.
 */
const E5 = 76, D5 = 74

function graced(form: GraceForm, written: NoteDuration = '16') {
  const model = new ScoreModel('G')
  const main = model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
  const grace = addGrace(model.getScore(), main.id, 'before', { step: 'D', alter: 0, octave: 5 }, form, { duration: written })!
  return { model, grace }
}
const at = (model: ScoreModel, midi: number) => collectScheduledNotes(model.getScore()).filter(e => pitchToMidi(e.pitch) === midi)

describe('collectScheduledNotes — graces (P3)', () => {
  it('⭐ an APPOGGIATURA sounds ON the beat, its written value; the main note starts after it, shorter', () => {
    const { model } = graced('appoggiatura', '16')
    const [grace] = at(model, D5)
    const [main] = at(model, E5)
    expect(grace.startBeats).toBe(1)
    expect(grace.durationBeats).toBe(0.25)
    expect(main.startBeats).toBe(1.25)
    expect(main.durationBeats).toBe(0.75)
  })

  it('⭐ an ACCIACCATURA is crushed to a 64th', () => {
    const { model } = graced('acciaccatura', '8')
    const [grace] = at(model, D5)
    const [main] = at(model, E5)
    expect(grace.durationBeats).toBe(1 / 16)
    expect(main.startBeats).toBe(1 + 1 / 16)
  })

  it('a grace\'s OWN marks shape it — a staccato grace is shorter than its plain twin', () => {
    const plain = graced('appoggiatura', '16')
    const marked = graced('appoggiatura', '16')
    marked.grace.articulations = ['staccato']
    expect(at(marked.model, D5)[0].durationBeats).toBeLessThan(at(plain.model, D5)[0].durationBeats)
  })

  it('⭐ a grace on a REST sounds on the rest\'s beat', () => {
    const model = new ScoreModel('G')
    model.addNote({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
    addGrace(model.getScore(), rest.id, 'before', { step: 'D', alter: 0, octave: 5 }, 'appoggiatura', { duration: '16' })
    const [grace] = at(model, D5)
    expect(grace.startBeats).toBe(1)
    expect(grace.durationBeats).toBe(0.25)
  })

  it('a grace CHORD strikes all its pitches together', () => {
    const { model, grace } = graced('appoggiatura', '16')
    grace.pitches.push({ id: 'g2', step: 'F', alter: 0, octave: 5 })
    expect(at(model, D5)[0].startBeats).toBe(at(model, 77)[0].startBeats)
  })
})
