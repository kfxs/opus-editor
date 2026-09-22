// @vitest-environment jsdom
/**
 * 🚨 A slur on a GRACE HUNG ON A REST is drawn (his report, 2026-09-22: *"im trying to make a slur but
 * i see nothing on screen"*). `measureOfNoteId` read grace pitches on CHORDS only, so the slur had no
 * measure and was skipped without a word — created, undoable, invisible.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../../models/ScoreModel'
import { addGrace } from '../../models/graceOps'
import { ScoreRenderer } from '../ScoreRenderer'
import { fracCreate as frac } from '@/utils/fraction'

function build() {
  const model = new ScoreModel()
  model.addNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
  const rest = model.getMeasure(1)!.slots.find(s => s.type === 'rest')!
  const score = model.getScore()
  const a = addGrace(score, rest.id, 'before', { step: 'A', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
  const f = addGrace(score, rest.id, 'before', { step: 'F', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
  return { model, rest, a: a.pitches[0].id, f: f.pitches[0].id }
}

function slurPaths(model: ScoreModel): number {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const renderer = new ScoreRenderer(container)
  renderer.initialize(1200, 800)
  renderer.renderScore(model.getScore())
  return renderer.getSVGElement()!.querySelectorAll('g.slur path').length
}

describe('renderSlurs — a grace on a REST', () => {
  it('⭐ grace → grace of the same group is drawn', () => {
    const { model, a, f } = build()
    model.addSlur({ startNoteId: a, endNoteId: f, voice: 0 })
    expect(slurPaths(model)).toBeGreaterThan(0)
  })

  it('⭐ the last grace → its rest is drawn', () => {
    const { model, rest, f } = build()
    model.addSlur({ startNoteId: f, endNoteId: rest.id, voice: 0 })
    expect(slurPaths(model)).toBeGreaterThan(0)
  })
})
