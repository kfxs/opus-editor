import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { setRepeatStart, setRepeatEnd } from '../models/barlineOps'
import {
  buildPlayPlan, measureOrder, planDuration, planRepeats, planScoreBeatsAt, planSecondsAtMeasure,
} from './repeatPlan'
import { buildTempoMap } from '@/utils/tempoMap'
import type { Score } from '@/types/music'

/**
 * **The play order** — what a repeat means to PLAYBACK. §7 of docs/plans/barline-types-plan.md, his ask of
 * 2026-08-26.
 *
 * ⭐ Two halves, tested apart because they are two questions: {@link measureOrder} is the MUSICAL one
 * (which bars, in what order) and needs no clock at all; {@link buildPlayPlan} is the arithmetic that
 * hangs seconds off it. ⛔ Nothing here makes a sound — whether the notes reach an oscillator is
 * `PlaybackEngine`'s, which cannot be tested without an `AudioContext`.
 */
function scoreOf(bars = 8): Score {
  const model = new ScoreModel()
  while (model.getScore().measures.length < bars) model.addMeasure()
  return model.getScore()
}

/** The order as a readable string: `1–4 · 1–4 · 5–8`. */
const shape = (score: Score) => measureOrder(score).map(l => `${l.fromMeasure}–${l.toMeasure}`).join(' · ')

describe('measureOrder — ⭐ which bars sound, in what order', () => {
  it('a score with no repeats is ONE leg — the whole point of the shape', () => {
    // Every arithmetic downstream collapses to what it was before §7 existed.
    expect(shape(scoreOf(8))).toBe('1–8')
  })

  it('⭐ an end repeat with no open repeat repeats THE PIECE', () => {
    // Gould, and every engine: the jump goes back to bar 1 when nothing says otherwise.
    const score = scoreOf(4)
    setRepeatEnd(score, 4, true)
    expect(shape(score)).toBe('1–4 · 1–4')
  })

  it('⭐ an open repeat is where the jump goes back TO', () => {
    const score = scoreOf(8)
    setRepeatStart(score, 5, true)
    setRepeatEnd(score, 8, true)
    expect(shape(score)).toBe('1–8 · 5–8')
  })

  it('…and the passage between them plays twice, with the rest of the score after it', () => {
    const score = scoreOf(8)
    setRepeatStart(score, 3, true)
    setRepeatEnd(score, 5, true)
    expect(shape(score)).toBe('1–5 · 3–8')
  })

  it('⭐ `times` is the number of PLAYINGS in total — 3 means twice more', () => {
    const score = scoreOf(4)
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 3, true, { times: 3 })
    expect(shape(score)).toBe('1–3 · 2–3 · 2–4')
  })

  it('two repeats in a row each take their own jump', () => {
    const score = scoreOf(8)
    setRepeatStart(score, 1, true)
    setRepeatEnd(score, 4, true)
    setRepeatStart(score, 5, true)
    setRepeatEnd(score, 8, true)
    expect(shape(score)).toBe('1–4 · 1–8 · 5–8')
  })

  it('⭐ a NESTED repeat is replayed by the one enclosing it — a counter cleared, not a stack', () => {
    // Bars 2–3 repeat inside 1–6, so the inner pair sounds twice on each pass of the outer.
    const score = scoreOf(6)
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 3, true)
    setRepeatEnd(score, 6, true)
    expect(shape(score)).toBe('1–3 · 2–6 · 2–3 · 2–6')
  })

  it('⛔ a bar that both opens and closes a repeat plays itself twice, and terminates', () => {
    const score = scoreOf(3)
    setRepeatStart(score, 2, true)
    setRepeatEnd(score, 2, true)
    expect(shape(score)).toBe('1–2 · 2–3')
  })

  it('an empty score has no order at all', () => {
    expect(measureOrder({ id: 's', title: '', measures: [] } as unknown as Score)).toEqual([])
  })
})

describe('buildPlayPlan — ⭐⭐ the two clocks', () => {
  const tempo = (score: Score) => buildTempoMap(score)

  it('a leg carries where it comes from in SCORE beats and when it happens in PERFORMANCE seconds', () => {
    const score = scoreOf(4)
    setRepeatEnd(score, 4, true)
    const plan = buildPlayPlan(score, tempo(score))
    expect(plan).toHaveLength(2)
    // Both legs are the same music — same score beats — at different times in the performance.
    expect(plan[0].fromBeats).toBe(plan[1].fromBeats)
    expect(plan[0].toBeats).toBe(plan[1].toBeats)
    expect(plan[0].atSeconds).toBe(0)
    expect(plan[1].atSeconds).toBeCloseTo(plan[0].seconds, 10)
  })

  it('⭐ `toBeats` is the END of the last bar, ⛔ not its downbeat', () => {
    const score = scoreOf(4)
    const [leg] = buildPlayPlan(score, tempo(score))
    expect(leg.toBeats, '4 bars of 4/4').toBe(16)
  })

  it('🚨 the DURATION is the performance\'s, not the score\'s — that is what the auto-stop reads', () => {
    const plain = scoreOf(4)
    const repeated = scoreOf(4)
    setRepeatEnd(repeated, 4, true)
    const one = planDuration(buildPlayPlan(plain, tempo(plain)))
    const two = planDuration(buildPlayPlan(repeated, tempo(repeated)))
    expect(two).toBeCloseTo(one * 2, 6)
  })

  it('⭐ `repeats: false` collapses it to the one leg the score used to be — his checkbox', () => {
    const score = scoreOf(4)
    setRepeatEnd(score, 4, true)
    const off = buildPlayPlan(score, tempo(score), false)
    expect(off).toHaveLength(1)
    expect(planRepeats(off)).toBe(false)
    expect(planDuration(off)).toBeCloseTo(planDuration(buildPlayPlan(scoreOf(4), tempo(score))), 6)
  })
})

describe('the two lookups the transport needs', () => {
  it('⭐ "play from bar N" is the FIRST time it comes round', () => {
    // Ambiguous in a repeated passage, and every editor answers this way — the reading a user can
    // predict, and the second pass follows from it anyway.
    const score = scoreOf(8)
    setRepeatStart(score, 5, true)
    setRepeatEnd(score, 8, true)
    const map = buildTempoMap(score)
    const plan = buildPlayPlan(score, map)
    // Bar 5 starts 16 quarters in; at the default tempo that is its first pass, inside leg 0.
    const at = planSecondsAtMeasure(plan, map, 16)
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(plan[1].atSeconds)
  })

  it('the top of the score is 0, and an unknown position falls back to it', () => {
    const score = scoreOf(4)
    const map = buildTempoMap(score)
    const plan = buildPlayPlan(score, map)
    expect(planSecondsAtMeasure(plan, map, 0)).toBe(0)
    expect(planSecondsAtMeasure(plan, map, 9999)).toBe(0)
  })

  it('🚨 the playhead reads BACK through the plan — the second pass lights the same bars again', () => {
    const score = scoreOf(4)
    setRepeatEnd(score, 4, true)
    const map = buildTempoMap(score)
    const plan = buildPlayPlan(score, map)
    const legSeconds = plan[0].seconds

    // A quarter of the way into each leg is the same place in the SCORE, twice over.
    const first = planScoreBeatsAt(plan, map, legSeconds * 0.25)
    const second = planScoreBeatsAt(plan, map, legSeconds * 1.25)
    expect(second).toBeCloseTo(first, 6)
    expect(first).toBeGreaterThan(0)
  })

  it('past the end it answers the last leg\'s end, so the final frame lights a real bar', () => {
    const score = scoreOf(4)
    const map = buildTempoMap(score)
    const plan = buildPlayPlan(score, map)
    expect(planScoreBeatsAt(plan, map, 99999)).toBe(16)
  })

  it('an empty plan answers 0 rather than throwing', () => {
    expect(planScoreBeatsAt([], buildTempoMap(scoreOf(1)), 5)).toBe(0)
    expect(planDuration([])).toBe(0)
  })
})
