/**
 * {@link stemOps} — **which way a stem points, and what `x` turns around** (his report, 2026-08-31:
 * *"the two notes are beamed and grouped with stem down so im flipin B and nothing hapends… in case
 * is a beamed group what the user expect is to flip the group"*).
 *
 * ⭐ The claim that matters is his bar, rebuilt: two beamed eighths whose GROUP points one way and
 * whose first note, alone, would point the other. The old flip measured the note and wrote the
 * direction the group already had — a key that worked perfectly and changed nothing, twice a press.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./stemOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Chord, Score } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac } from '@/utils/fraction'
import { beamGroupStemDirection, flipStems } from './stemOps'

describe('flipStems — the group is the unit', () => {
  let model: ScoreModel
  let score: Score

  /** The stem written on the slot at `beat`, as the model stores it (`undefined` = auto). */
  const stemAt = (beat: number) =>
    (score.measures[0].slots.find(s => s.beat.num / s.beat.den === beat) as Chord | undefined)?.stemDirection
  const idAt = (beat: number) =>
    score.measures[0].slots.find(s => s.beat.num / s.beat.den === beat)!.id

  beforeEach(() => {
    // 🚨 HIS BAR: an eighth B4 on the middle line, an eighth G4 under it, beamed as one group.
    //    ⭐ Alone, B4 reads DOWN (the middle-line convention). The GROUP reads UP, because the pitch
    //    furthest from the middle line is the G4 below it — and the group is what is drawn.
    model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(0, 1) } as never)
    model.addNote({ step: 'G', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(1, 2) } as never)
    score = model.getScore()
  })

  it('🚨🚨 flips BOTH notes of the beamed group — the press on one member turns the beam around', () => {
    expect(beamGroupStemDirection(score.measures[0].slots.slice(0, 2), 'treble'), 'drawn UP')
      .toBe(1)
    expect(flipStems(score, idAt(0))).toHaveLength(2)
    expect(stemAt(0), 'the note that was pressed').toBe('down')
    expect(stemAt(0.5), '…and its neighbour on the same beam').toBe('down')
  })

  it('⛔ …and ⛔ NEVER writes the direction the group is already drawn with', () => {
    // The whole of his bug in one assertion: B4's own pitch says "down", so the old rule wrote 'up'
    // — which is what the group already was. A flip that changes nothing is not a flip.
    flipStems(score, idAt(0))
    expect(stemAt(0)).not.toBe('up')
  })

  it('⭐ a second press lets the whole group go back to auto', () => {
    flipStems(score, idAt(0))
    flipStems(score, idAt(0.5))
    expect(stemAt(0)).toBeUndefined()
    expect(stemAt(0.5)).toBeUndefined()
  })

  it('⭐ …and a group only HALF pinned is turned around, ⛔ not released', () => {
    // The state the old per-note flip could leave behind: one member forced, the rest on auto.
    ;(score.measures[0].slots[0] as Chord).stemDirection = 'down'
    flipStems(score, idAt(0.5))
    expect(stemAt(0)).toBe('up')
    expect(stemAt(0.5)).toBe('up')
  })

  it('an UNBEAMED note still flips alone — a group of one, and the behaviour that was always there', () => {
    const model2 = new ScoreModel()
    model2.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(0, 1) } as never)
    const score2 = model2.getScore()
    const id = score2.measures[0].slots[0].id
    expect(flipStems(score2, id)).toEqual([id])
    // C4 sits below the middle line, so it is drawn UP and the flip turns it down.
    expect((score2.measures[0].slots[0] as Chord).stemDirection).toBe('down')
  })

  it('⛔ declines on a rest — nothing to point', () => {
    const model2 = new ScoreModel()
    const score2 = model2.getScore()
    const restId = score2.measures[0].slots[0]?.id
    expect(restId && flipStems(score2, restId)).toBeFalsy()
  })

  it('⛔ …and on an id the score does not hold', () => {
    expect(flipStems(score, 'nope')).toBeNull()
  })
})

describe('beamGroupStemDirection — one side per beam', () => {
  it('⭐ an explicit stem on ANY member is the group’s — which is what makes the flip legible', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'B', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(0, 1) } as never)
    model.addNote({ step: 'G', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(1, 2) } as never)
    const slots = model.getScore().measures[0].slots.slice(0, 2)
    ;(slots[1] as Chord).stemDirection = 'down'
    expect(beamGroupStemDirection(slots, 'treble')).toBe(-1)
  })

  it('⭐ …then the lane’s multi-voice default, ⛔ before the pitches', () => {
    const model = new ScoreModel()
    model.addNote({ step: 'G', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(0, 1) } as never)
    const slots = model.getScore().measures[0].slots.slice(0, 1)
    expect(beamGroupStemDirection(slots, 'treble'), 'on its own the low note points up').toBe(1)
    expect(beamGroupStemDirection(slots, 'treble', -1), 'voice 2 points down anyway').toBe(-1)
  })
})
