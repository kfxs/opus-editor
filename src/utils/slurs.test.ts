import { describe, it, expect } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import { legatoChordIds } from './slurs'

/** Build a one-measure score with quarter notes at the given beats; returns the
 *  model plus the chord id at each beat for slur anchoring. */
function modelWithNotes(beats: number[]): { model: ScoreModel; chordIdAt: (beat: number) => string } {
  const model = new ScoreModel()
  for (const b of beats) {
    model.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
  }
  const chordIdAt = (beat: number) => {
    const slot = model.getScore().measures[0].slots.find(
      s => s.type === 'chord' && s.beat.num / s.beat.den === beat,
    )
    if (!slot) throw new Error(`no chord at beat ${beat}`)
    return slot.id
  }
  return { model, chordIdAt }
}

/** The head (NotePitch) id of the chord at a beat — what a slur anchors to. */
function headIdAt(model: ScoreModel, beat: number): string {
  const slot = model.getScore().measures[0].slots.find(
    s => s.type === 'chord' && s.beat.num / s.beat.den === beat,
  )
  if (!slot || slot.type !== 'chord') throw new Error(`no chord at beat ${beat}`)
  return slot.notes[0].id
}

describe('legatoChordIds', () => {
  it('returns empty when there are no slurs', () => {
    const { model } = modelWithNotes([0, 1, 2, 3])
    expect(legatoChordIds(model.getScore()).size).toBe(0)
  })

  it('marks every chord from the start up to (not including) the end', () => {
    const { model, chordIdAt } = modelWithNotes([0, 1, 2, 3])
    model.getScore().slurs = [
      { id: 's1', startNoteId: headIdAt(model, 0), endNoteId: headIdAt(model, 2) },
    ]

    const legato = legatoChordIds(model.getScore())
    expect(legato.has(chordIdAt(0))).toBe(true)  // start → connects forward
    expect(legato.has(chordIdAt(1))).toBe(true)  // middle → connects forward
    expect(legato.has(chordIdAt(2))).toBe(false) // end → nothing after to bind
    expect(legato.has(chordIdAt(3))).toBe(false) // outside the span
  })

  it('handles multiple slurs, unioning their spans', () => {
    const { model, chordIdAt } = modelWithNotes([0, 1, 2, 3])
    model.getScore().slurs = [
      { id: 's1', startNoteId: headIdAt(model, 0), endNoteId: headIdAt(model, 1) },
      { id: 's2', startNoteId: headIdAt(model, 2), endNoteId: headIdAt(model, 3) },
    ]

    const legato = legatoChordIds(model.getScore())
    expect([...legato].sort()).toEqual([chordIdAt(0), chordIdAt(2)].sort())
  })

  it('ignores a slur whose anchors cannot be resolved', () => {
    const { model } = modelWithNotes([0, 1])
    model.getScore().slurs = [
      { id: 'bad', startNoteId: 'nope', endNoteId: 'also-nope' },
    ]
    expect(legatoChordIds(model.getScore()).size).toBe(0)
  })
})
