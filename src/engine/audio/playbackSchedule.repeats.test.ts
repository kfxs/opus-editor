import { describe, it, expect } from 'vitest'
import { ScoreModel } from '../models/ScoreModel'
import { setRepeatEnd } from '../models/barlineOps'
import { collectScheduledNotes, playableOverPlan } from './playbackSchedule'
import { buildPlayPlan } from './repeatPlan'
import { buildTempoMap } from '@/utils/tempoMap'
import { fracCreate as frac } from '@/utils/fraction'
import type { Score } from '@/types/music'

/**
 * **What a PLAY ORDER sounds** — `playableOverPlan`, a chapter of {@link playbackSchedule} beside its
 * siblings (docs/plans/barline-types-plan.md §7, his ask of 2026-08-26).
 *
 * ⭐ The claim worth pinning is the one that makes the whole design safe: **a score with no repeats
 * comes out byte for byte as it did before this existed.** The rest is that a repeated note sounds
 * twice, at the right two times.
 */
function scoreWithNotes(bars: number): Score {
  const model = new ScoreModel('P') // one 4/4 bar, one staff
  while (model.getScore().measures.length < bars) model.addMeasure()
  // One quarter on the downbeat of each bar, so every leg has exactly one onset per bar.
  for (let bar = 1; bar <= bars; bar++) {
    model.addNote({ step: 'C', octave: 4, duration: 'q', measure: bar, beat: frac(0, 1) })
  }
  return model.getScore()
}

describe('playableOverPlan', () => {
  const notesOf = (score: Score, repeats = true) => {
    const map = buildTempoMap(score)
    return playableOverPlan(collectScheduledNotes(score, map), map, buildPlayPlan(score, map, repeats))
  }

  it('⭐⭐ a score with NO repeats is unchanged — one leg, and the arithmetic cancels', () => {
    const score = scoreWithNotes(4)
    const played = notesOf(score)
    expect(played, 'one note per bar, once each').toHaveLength(4)
    // 4/4 at the default tempo: each bar is 4 quarters, each downbeat one bar-length apart.
    const gaps = played.slice(1).map((n, i) => n.atSeconds - played[i].atSeconds)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10)
  })

  it('🚨 a repeated passage sounds its notes AGAIN — the whole feature, in one assertion', () => {
    const score = scoreWithNotes(4)
    setRepeatEnd(score, 4, true)
    const played = notesOf(score)
    expect(played, 'four bars, twice').toHaveLength(8)
  })

  it('…and the second pass lands exactly one pass-length later', () => {
    const score = scoreWithNotes(4)
    setRepeatEnd(score, 4, true)
    const played = notesOf(score).sort((a, b) => a.atSeconds - b.atSeconds)
    const passLength = played[4].atSeconds
    for (let i = 0; i < 4; i++) {
      expect(played[i + 4].atSeconds - played[i].atSeconds).toBeCloseTo(passLength, 6)
    }
  })

  it('⭐ the checkbox OFF gives the score straight through — the same notes, once', () => {
    const score = scoreWithNotes(4)
    setRepeatEnd(score, 4, true)
    expect(notesOf(score, false)).toHaveLength(4)
  })

  it('⭐ only the REPEATED bars come twice — the tail of the score is played once', () => {
    // `|: 1 2 :|` then 3, 4 straight through.
    const score = scoreWithNotes(4)
    setRepeatEnd(score, 2, true)
    expect(notesOf(score), '1,2 · 1,2,3,4').toHaveLength(6)
  })

  it('⛔ nothing sounds before the start point — a play from mid-performance drops what precedes it', () => {
    const score = scoreWithNotes(4)
    setRepeatEnd(score, 4, true)
    const map = buildTempoMap(score)
    const plan = buildPlayPlan(score, map)
    const all = playableOverPlan(collectScheduledNotes(score, map), map, plan)
    // Start at the top of the second pass: half the notes remain, and none has a negative onset.
    const fromSecondPass = playableOverPlan(collectScheduledNotes(score, map), map, plan, plan[1].atSeconds)
    expect(fromSecondPass).toHaveLength(all.length / 2)
    for (const note of fromSecondPass) expect(note.atSeconds).toBeGreaterThanOrEqual(0)
  })
})
