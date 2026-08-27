/**
 * {@link keyOps} — the writes, and the one rule that makes them more than a setter: **a key change
 * that changes nothing is not stored.**
 *
 * ⭐ That normalization is `clefOps`' exactly, and it is what makes the model's history readable:
 * a `keys` entry always means "the signature changes HERE", never "someone clicked a button here".
 * It is also why removing one needs its own verb — see the ✕ door in the dev palette.
 */
import { describe, it, expect } from 'vitest'
import { ScoreModel } from './ScoreModel'
import { removeKeyAt, setKeyAt } from './keyOps'
import { C_MAJOR, fifthsOf, keyAt, keyFromFifths } from '@/utils/keySignature'
import type { Score } from '@/types/music'

function scoreOf(bars: number): Score {
  const model = new ScoreModel()
  while (model.getScore().measures.length < bars) model.addMeasure()
  return model.getScore()
}

/** The key changes STORED on a bar (not the one in force there). */
const stored = (score: Score, measureNumber: number) =>
  score.measures.find(m => m.number === measureNumber)?.keys

describe('setKeyAt', () => {
  it('writes a change at the head of the bar, and the walk sees it', () => {
    const score = scoreOf(3)
    expect(setKeyAt(score, 2, keyFromFifths(1))).toBe(true)

    expect(stored(score, 2)).toHaveLength(1)
    expect(stored(score, 2)![0].beat).toEqual({ num: 0, den: 1 })
    expect(fifthsOf(keyAt(score, 2))).toBe(1)
    expect(fifthsOf(keyAt(score, 3)), 'and carries forward').toBe(1)
    expect(fifthsOf(keyAt(score, 1)), 'and not backward').toBe(0)
  })

  it('⭐ stores NOTHING when the signature asked for is already in force', () => {
    const score = scoreOf(3)
    setKeyAt(score, 2, keyFromFifths(-2))

    expect(setKeyAt(score, 3, keyFromFifths(-2)), 'bar 3 is already B♭ major').toBe(false)
    expect(stored(score, 3)).toBeUndefined()
  })

  it('is idempotent — asking twice for the same change is one change', () => {
    const score = scoreOf(2)
    expect(setKeyAt(score, 2, keyFromFifths(3))).toBe(true)
    expect(setKeyAt(score, 2, keyFromFifths(3))).toBe(false)
    expect(stored(score, 2)).toHaveLength(1)
  })

  it('replaces a change already stored at that bar rather than stacking one beside it', () => {
    const score = scoreOf(2)
    setKeyAt(score, 2, keyFromFifths(1))
    const id = stored(score, 2)![0].id
    expect(setKeyAt(score, 2, keyFromFifths(-4))).toBe(true)

    expect(stored(score, 2)).toHaveLength(1)
    expect(stored(score, 2)![0].id, 'the same change, re-stated').toBe(id)
    expect(fifthsOf(keyAt(score, 2))).toBe(-4)
  })

  it('⭐ REVERTING a bar to what precedes it clears the change instead of storing a redundant one', () => {
    const score = scoreOf(3)
    setKeyAt(score, 2, keyFromFifths(2))
    expect(setKeyAt(score, 2, C_MAJOR), 'back to the key bar 1 was in').toBe(true)

    expect(stored(score, 2), 'so the bar holds nothing at all').toBeUndefined()
    expect(fifthsOf(keyAt(score, 2))).toBe(0)
  })

  it('at measure 1, C major stores nothing — it is what the score is in already', () => {
    const score = scoreOf(2)
    expect(setKeyAt(score, 1, C_MAJOR)).toBe(false)
    expect(stored(score, 1)).toBeUndefined()
    expect(keyAt(score, 1)).toEqual(C_MAJOR)
  })

  it('⭐⭐ …but an OPEN key at measure 1 IS stored: it is not C major, and only the model can say so', () => {
    const score = scoreOf(2)
    expect(setKeyAt(score, 1, { alterations: [], mode: 'open' })).toBe(true)
    expect(stored(score, 1)).toHaveLength(1)
    expect(keyAt(score, 1).mode).toBe('open')
  })

  it('takes a CUSTOM signature — one flat and one sharp, which no fifths value can express', () => {
    const score = scoreOf(2)
    const bartok = { alterations: [{ step: 'B' as const, alter: -1 as const }, { step: 'F' as const, alter: 1 as const }] }
    expect(setKeyAt(score, 2, bartok)).toBe(true)

    expect(fifthsOf(keyAt(score, 2)), 'no traditional name').toBeNull()
    expect(keyAt(score, 2).alterations.map(a => a.step), 'and the authored ORDER survives').toEqual(['B', 'F'])
  })

  it('refuses a bar that does not exist', () => {
    const score = scoreOf(2)
    expect(setKeyAt(score, 99, keyFromFifths(1))).toBe(false)
  })

  it('is PER-STAFF — one hand\'s signature is not the other\'s', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()
    const upper = score.staves![0].id

    expect(setKeyAt(score, 2, keyFromFifths(4), upper)).toBe(true)
    expect(setKeyAt(score, 2, keyFromFifths(-4), lower)).toBe(true)

    expect(stored(score, 2)).toHaveLength(2)
    expect(fifthsOf(keyAt(score, 2, upper))).toBe(4)
    expect(fifthsOf(keyAt(score, 2, lower))).toBe(-4)
  })
})

describe('removeKeyAt', () => {
  it('removes the change and lets the bar inherit again', () => {
    const score = scoreOf(4)
    setKeyAt(score, 2, keyFromFifths(1))
    setKeyAt(score, 3, keyFromFifths(-1))

    expect(removeKeyAt(score, 3)).toBe(true)
    expect(stored(score, 3), 'the array goes with its last member').toBeUndefined()
    expect(fifthsOf(keyAt(score, 3)), 'back to bar 2\'s G major').toBe(1)
  })

  it('⛔ refuses measure 1 — change only, never remove', () => {
    const score = scoreOf(2)
    setKeyAt(score, 1, keyFromFifths(2))
    expect(removeKeyAt(score, 1)).toBe(false)
    expect(fifthsOf(keyAt(score, 1))).toBe(2)
  })

  it('answers false where nothing is stored', () => {
    const score = scoreOf(2)
    expect(removeKeyAt(score, 2)).toBe(false)
  })

  it('removes only the addressed staff\'s change', () => {
    const model = new ScoreModel()
    model.addMeasure()
    const lower = model.addStaffBelow(0)
    const score = model.getScore()
    const upper = score.staves![0].id
    setKeyAt(score, 2, keyFromFifths(4), upper)
    setKeyAt(score, 2, keyFromFifths(-4), lower)

    expect(removeKeyAt(score, 2, lower)).toBe(true)
    expect(fifthsOf(keyAt(score, 2, upper)), 'the other hand is untouched').toBe(4)
    expect(fifthsOf(keyAt(score, 2, lower))).toBe(0)
  })
})
