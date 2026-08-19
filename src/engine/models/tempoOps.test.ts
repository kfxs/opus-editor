/**
 * {@link tempoOps} — **a tempo mark walks the music**, the model write behind `Ctrl+Shift+←/→`
 * (his ask, 2026-08-19).
 *
 * ⭐ The claims are the four the step can silently get wrong: it walks ONSETS rather than a lane (a
 * tempo has no voice and no staff — it governs the clock), a step over a barline RE-FILES the mark
 * under the bar it lands in with the same id, a beat another mark already holds is REFUSED rather
 * than overwritten, and the step drops the mark's sideways nudge while keeping its lift.
 *
 * A `ScoreModel` is the FIXTURE; the subject is the free functions in `./tempoOps`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Score } from '@/types/music'
import { ScoreModel } from './ScoreModel'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { moveTempoBySlot, nextTempoSlot } from './tempoOps'
import { tempoOffsetOverrideOf } from './engravingOverrides'
import { effectiveTempoAt } from '@/utils/tempoMap'

describe('moveTempoBySlot — the mark walks the onsets', () => {
  let model: ScoreModel
  let score: Score
  let id: string

  beforeEach(() => {
    model = new ScoreModel() // measure 1, 4/4 by default
    model.addMeasure()
    for (const m of [1, 2]) {
      for (const b of [0, 1, 2, 3]) {
        model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: m, beat: frac(b, 1) } as never)
      }
    }
    score = model.getScore()
    id = model.addTempoMark(1, { beat: frac(2, 1), text: 'Allegro', bpm: 144 })!.id
  })

  /** Where the mark is now, as `measure@beat`. */
  const at = (markId: string) => {
    for (const measure of score.measures) {
      const mark = measure.tempos?.find(t => t.id === markId)
      if (mark) return `${measure.number}@${fracToNumber(mark.beat)}`
    }
    return 'gone'
  }

  it('⭐ steps ON to the next onset, and BACK to the previous one', () => {
    expect(moveTempoBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('1@3')
    expect(moveTempoBySlot(score, id, -1)).toBe(true)
    expect(moveTempoBySlot(score, id, -1)).toBe(true)
    expect(at(id)).toBe('1@1')
  })

  it('⭐ a step across the BARLINE re-files the mark under the bar it lands in', () => {
    moveTempoBySlot(score, id, 1) // 1@3, the bar's last onset
    expect(moveTempoBySlot(score, id, 1)).toBe(true)
    expect(at(id)).toBe('2@0')
    expect(score.measures[0].tempos, 'and the bar it left drops the list entirely').toBeUndefined()
  })

  it('⚠️ keeps the SAME id across that move — the selection is holding it', () => {
    moveTempoBySlot(score, id, 1)
    moveTempoBySlot(score, id, 1)
    expect(model.getTempoMarkById(id)).not.toBeNull()
    expect(at(id)).toBe('2@0')
  })

  it('⭐⭐ it is AUDIBLE — the tempo map moves with the mark', () => {
    // The whole reason this chord is the MUSIC one. ♩=144 from bar 1 beat 2; step it on and beat 2
    // is back to the score's default while beat 3 is fast.
    expect(effectiveTempoAt(score, 1, frac(2, 1))).toBe(144)
    moveTempoBySlot(score, id, 1)
    expect(effectiveTempoAt(score, 1, frac(2, 1)), 'beat 2 is back to the default').not.toBe(144)
    expect(effectiveTempoAt(score, 1, frac(3, 1)), 'and beat 3 is fast').toBe(144)
  })

  it('⭐⭐ walks EVERY staff and voice — a tempo has no lane, it governs the clock', () => {
    // ⛔ Not the dynamic's rule (its own voice on its own staff). A left-hand chord under a
    // right-hand rest is a moment the clock can change at, so it is a stop.
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: '8', measure: 1, beat: frac(5, 2), voice: 1 } as never)
    expect(moveTempoBySlot(score, id, 1)).toBe(true)
    expect(at(id), 'the voice-1 onset at 2.5 IS a stop').toBe('1@2.5')
  })

  it('⭐ a column sounded by several voices is ONE stop, not one per notehead', () => {
    model.addNote({ step: 'E', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(3, 1), voice: 1 } as never)
    moveTempoBySlot(score, id, 1)
    expect(at(id)).toBe('1@3')
    // …and the next press leaves the bar rather than landing on beat 3 a second time.
    moveTempoBySlot(score, id, 1)
    expect(at(id)).toBe('2@0')
  })

  it('⛔ REFUSES a beat another tempo mark already holds — one mark per beat, no overwrite', () => {
    // ⛔ Neither stacks (a contradiction the tempo map would resolve by array order) nor overwrites
    // (silent data loss). It declines, and the walk stops there.
    const other = model.addTempoMark(1, { beat: frac(3, 1), text: 'Presto' })!.id
    expect(moveTempoBySlot(score, id, 1)).toBe(false)
    expect(at(id)).toBe('1@2')
    expect(model.getTempoMarkById(other)).not.toBeNull()
  })

  it('⛔ DECLINES at either end of the score, touching nothing', () => {
    const first = model.addTempoMark(2, { beat: frac(0, 1), text: 'x' })!.id
    for (let i = 0; i < 4; i++) moveTempoBySlot(score, first, -1)
    // 1@2 is taken by `id`, so walking back stops the press BEFORE it — one mark per beat.
    expect(at(first)).toBe('1@3')
    const last = model.addTempoMark(2, { beat: frac(3, 1), text: 'y' })!.id
    expect(moveTempoBySlot(score, last, 1)).toBe(false)
    expect(at(last)).toBe('2@3')
  })

  it('⛔ DECLINES for an id no longer in the score', () => {
    expect(moveTempoBySlot(score, 'nope', 1)).toBe(false)
  })

  it('⭐⭐ CLEARS the sideways nudge and KEEPS the lift', () => {
    // `dynamicOps`' rule and its reason: the x answered "that element", the y answers the row.
    model.nudgeTempoOffset(id, 1.5, -2)
    expect(moveTempoBySlot(score, id, 1)).toBe(true)
    expect(tempoOffsetOverrideOf(score, id)).toEqual({ kind: 'tempoOffset', x: 0, y: -2 })
  })

  it('⚠️ …and drops the override entirely when the lift was all that was in it', () => {
    model.nudgeTempoOffset(id, 1.5, 0)
    moveTempoBySlot(score, id, 1)
    expect(tempoOffsetOverrideOf(score, id)).toBeUndefined()
  })

  it('leaves the owning measure\'s list sorted by beat', () => {
    model.addTempoMark(2, { beat: frac(2, 1), text: 'p' })
    moveTempoBySlot(score, id, 1) // 1@3
    moveTempoBySlot(score, id, 1) // 2@0, in front of the one already there
    expect(score.measures[1].tempos?.map(t => fracToNumber(t.beat))).toEqual([0, 2])
  })
})

describe('nextTempoSlot — the stop one step away', () => {
  it('⭐ names it without moving anything, and answers null at the ends', () => {
    const model = new ScoreModel()
    for (const b of [0, 1, 2, 3]) {
      model.addNote({ step: 'C', octave: 4, alter: 0, duration: 'q', measure: 1, beat: frac(b, 1) } as never)
    }
    const score = model.getScore()
    const id = model.addTempoMark(1, { beat: frac(2, 1), text: 'Allegro' })!.id

    expect(nextTempoSlot(score, id, 1)).toEqual({ measure: 1, beat: frac(3, 1) })
    expect(nextTempoSlot(score, id, -1)).toEqual({ measure: 1, beat: frac(1, 1) })
    expect(score.measures[0].tempos?.[0].beat).toEqual(frac(2, 1))

    const last = model.addTempoMark(1, { beat: frac(3, 1), text: 'p' })!.id
    expect(nextTempoSlot(score, last, 1)).toBeNull()
    expect(nextTempoSlot(score, 'nope', 1)).toBeNull()
  })
})
