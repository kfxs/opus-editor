import { describe, expect, it } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { clampSpineStretch, measureIdOfNumber, SPINE_STRETCH_MIN, spineStretchOf } from './spineBarStretch'

describe('spineBarStretch', () => {
  it('a bar with no row is ×1', () => {
    expect(spineStretchOf(undefined, 'm1')).toBe(1)
    expect(spineStretchOf(new Map([['m2', 1.5]]), 'm1')).toBe(1)
    expect(spineStretchOf(new Map([['m1', 1.5]]), 'm1')).toBe(1.5)
  })

  it('⛔ a value that is not a number is refused; a tiny one is held at the minimum; steps come out clean', () => {
    expect(clampSpineStretch(NaN)).toBeNull()
    expect(clampSpineStretch(Infinity)).toBeNull()
    expect(clampSpineStretch(-3)).toBe(SPINE_STRETCH_MIN)
    expect(clampSpineStretch(1.1 + 0.1)).toBe(1.2)
  })

  it('a selected barline names its bar by NUMBER — the stretch is kept by the bar\'s id', () => {
    const m = new ScoreModel('stretch')
    m.addMeasure()
    const score = m.getScore()
    expect(measureIdOfNumber(score, 2)).toBe(score.measures[1].id)
    expect(measureIdOfNumber(score, 9)).toBeUndefined()
  })
})
