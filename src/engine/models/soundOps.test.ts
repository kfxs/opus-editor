import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { applySound, clearSound, resolveSound, getSoundAssignments, DEFAULT_SOUND } from './soundOps'
import { fracFromInt } from '@/utils/fraction'
import type { Score, SoundRef } from '@/types/music'

/**
 * The sound is SCORE data, positional and anchored — this file answers for all three. The audio side
 * of it (which program actually loads) is `PlaybackEngine`'s and is not testable in jsdom.
 */
const OBOE: SoundRef = { kind: 'gm', program: 68 }
const CELLO: SoundRef = { kind: 'gm', program: 42 }

function scoreOf(bars = 1): Score {
  const model = new ScoreModel()
  for (let i = 1; i < bars; i++) model.addMeasure()
  return model.getScore()
}

describe('resolveSound', () => {
  it('is the DEFAULT when nothing has been said', () => {
    expect(resolveSound(scoreOf())).toEqual(DEFAULT_SOUND)
  })

  it('is what was applied', () => {
    const score = scoreOf()
    applySound(score, OBOE)
    expect(resolveSound(score)).toEqual(OBOE)
  })

  /**
   * ⭐⭐ THE WHOLE REASON THIS IS POSITIONAL. A sound is not a property of the score; it is a
   * statement made at a point, and a later one supersedes it FROM THERE — not everywhere.
   */
  it('walks BACK to the most recent statement, so a later bar can sound different', () => {
    const score = scoreOf(4)
    applySound(score, OBOE)
    applySound(score, CELLO, { measureId: score.measures[2].id })

    expect(resolveSound(score, { measureId: score.measures[0].id })).toEqual(OBOE)
    expect(resolveSound(score, { measureId: score.measures[1].id })).toEqual(OBOE)
    expect(resolveSound(score, { measureId: score.measures[2].id })).toEqual(CELLO)
    expect(resolveSound(score, { measureId: score.measures[3].id })).toEqual(CELLO)
  })

  it('reads a beat inside the bar the statement is in', () => {
    const score = scoreOf(2)
    applySound(score, OBOE)
    applySound(score, CELLO, { measureId: score.measures[1].id, beat: fracFromInt(2) })

    const bar2 = score.measures[1].id
    expect(resolveSound(score, { measureId: bar2, beat: fracFromInt(1) })).toEqual(OBOE)
    expect(resolveSound(score, { measureId: bar2, beat: fracFromInt(2) })).toEqual(CELLO)
    expect(resolveSound(score, { measureId: bar2, beat: fracFromInt(3) })).toEqual(CELLO)
  })

  /**
   * ⭐⭐ WHY THE ANCHOR IS AN ID AND NOT A NUMBER. Insert a bar in front and every measure NUMBER
   * changes, so a `measure: 2` anchor would silently start governing different music.
   *
   * ⚠️ The discriminating assertion is the INSERTED bar, not the moved one. Both models keep the
   * moved bar sounding right (a walk-back from a later number still finds an earlier statement);
   * only the id model leaves the NEW bar 2 alone — under number-keying the statement says "bar 2"
   * and the inserted bar now IS bar 2, so it would take a sound that was never meant for it.
   */
  it('survives a bar being inserted in front of it — the anchor is an ID', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const score = model.getScore()
    const second = score.measures[1]
    applySound(score, CELLO, { measureId: second.id })

    model.insertMeasureAfter(0) // a new bar 1, pushing the rest along
    expect(score.measures.findIndex(m => m.id === second.id)).toBe(2) // it moved…
    expect(resolveSound(score, { measureId: second.id })).toEqual(CELLO) // …and kept its sound
    // The bar that was pushed INTO the statement's old number is untouched by it.
    expect(resolveSound(score, { measureId: score.measures[1].id })).toEqual(DEFAULT_SOUND)
    expect(resolveSound(score, { measureId: score.measures[0].id })).toEqual(DEFAULT_SOUND)
  })

  it('answers for the start of the score when the anchor is gone', () => {
    const score = scoreOf(2)
    applySound(score, OBOE)
    const orphan = 'a-measure-that-was-deleted'
    expect(resolveSound(score, { measureId: orphan })).toEqual(OBOE)
  })

  /** Report-never-repair: a later version's sound is KEPT in the score and ignored for playback. */
  it('falls back to the default for a kind this build cannot realise, without dropping it', () => {
    const score = scoreOf()
    score.playback = {
      sounds: [{ measureId: score.measures[0].id, beat: fracFromInt(0), sound: { kind: 'synth', patch: 'x' } as unknown as SoundRef }],
    }
    expect(resolveSound(score)).toEqual(DEFAULT_SOUND)
    expect(getSoundAssignments(score)).toHaveLength(1)
  })
})

describe('applySound', () => {
  it('writes ONE assignment at the start of the score', () => {
    const score = scoreOf(3)
    applySound(score, OBOE)
    expect(getSoundAssignments(score)).toEqual([
      { measureId: score.measures[0].id, beat: fracFromInt(0), sound: OBOE },
    ])
  })

  it('REPLACES the statement at that anchor — auditioning timbres leaves no trail', () => {
    const score = scoreOf()
    applySound(score, OBOE)
    applySound(score, CELLO)
    applySound(score, OBOE)
    expect(getSoundAssignments(score)).toHaveLength(1)
    expect(resolveSound(score)).toEqual(OBOE)
  })
})

describe('the N=1 invariant', () => {
  /**
   * ⭐ A sketch nobody has chosen a sound for must serialize exactly as it did before this feature
   * existed: "piano" is the ABSENCE of a statement. A `playback: {}` left behind would make every
   * fresh file claim otherwise.
   */
  it('adds no key to a score nobody has chosen a sound for', () => {
    const score = scoreOf()
    expect('playback' in score).toBe(false)
    expect(JSON.stringify(score)).not.toContain('playback')
  })

  it('takes the compartment away again with its last assignment', () => {
    const score = scoreOf()
    applySound(score, OBOE)
    expect(clearSound(score)).toBe(true)
    expect('playback' in score).toBe(false)
    expect(resolveSound(score)).toEqual(DEFAULT_SOUND)
  })

  it('says so when there was nothing to clear', () => {
    expect(clearSound(scoreOf())).toBe(false)
  })
})
