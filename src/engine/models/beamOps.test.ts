/**
 * Subject: `./beamOps` — what a note says about its own beam.
 *
 * ⭐ The point of every case here is that **absent is auto**: clearing the override must remove the
 * key rather than write a side, so a score nobody has hand-edited is engraved wholly by the metric
 * rule (`docs/beam-hook-research.md`).
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { setFractionalBeamSide } from './beamOps'
import { fracCreate as frac } from '@/utils/fraction'
import type { Chord } from '@/types/music'

function scoreWithNote() {
  const model = new ScoreModel()
  const note = model.addNote({ step: 'C', octave: 5, duration: '16', measure: 1, beat: frac(0, 1) })!
  return { score: model.getScore(), model, noteId: note.id }
}

const slotOf = (score: ReturnType<ScoreModel['getScore']>) =>
  score.measures[0].slots.find(s => s.type === 'chord') as Chord

describe('setFractionalBeamSide', () => {
  it('stores an explicit side', () => {
    const { score, noteId } = scoreWithNote()
    expect(setFractionalBeamSide(score, noteId, 'right')).not.toBeNull()
    expect(slotOf(score).fractionalBeamSide).toBe('right')
  })

  it('⭐ null REMOVES the key — auto is absence, ⛔ not a third stored value', () => {
    const { score, noteId } = scoreWithNote()
    setFractionalBeamSide(score, noteId, 'left')
    setFractionalBeamSide(score, noteId, null)
    expect('fractionalBeamSide' in slotOf(score)).toBe(false)
  })

  it('replaces one side with the other', () => {
    const { score, noteId } = scoreWithNote()
    setFractionalBeamSide(score, noteId, 'left')
    setFractionalBeamSide(score, noteId, 'right')
    expect(slotOf(score).fractionalBeamSide).toBe('right')
  })

  it('⛔ a rest has no stub to aim, so it is a no-op', () => {
    const model = new ScoreModel()
    const score = model.getScore()
    const rest = score.measures[0].slots.find(s => s.type === 'rest')
    expect(rest, 'the empty bar is rest-filled').toBeDefined()
    expect(setFractionalBeamSide(score, rest!.id, 'left')).toBeNull()
  })

  it('returns null for an id that resolves to nothing', () => {
    const { score } = scoreWithNote()
    expect(setFractionalBeamSide(score, 'no-such-note', 'left')).toBeNull()
  })

  it('⭐ round-trips through the facade, and the projection reports it back', () => {
    const { model, noteId } = scoreWithNote()
    model.setFractionalBeamSide(noteId, 'right')
    expect(model.getNote(noteId)?.fractionalBeamSide).toBe('right')
    model.setFractionalBeamSide(noteId, null)
    expect(model.getNote(noteId)?.fractionalBeamSide).toBeUndefined()
  })
})
