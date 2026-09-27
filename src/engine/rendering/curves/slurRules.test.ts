/** The armed rows of the slur compromise (`./slurRules`, docs/plans/slur-search-plan.md P8). */
import { afterEach, describe, it, expect } from 'vitest'
import { resetSlurRules, setSlurRule, slurRules, slurRulesGeneration } from './slurRules'
import { LILYPOND_SLUR_RULES } from '@/engine/engrave/curves/slurSearch/searchDetails'

afterEach(() => resetSlurRules())

describe('slurRules', () => {
  it('⭐ every row starts at its default — LilyPond\'s choice, except `midAccent` (his T1 rule)', () => {
    expect(slurRules()).toEqual(LILYPOND_SLUR_RULES)
    expect(slurRules().stemSideEnd).toBe('head')
    expect(slurRules().midAccent).toBe('inside')
  })

  it('arms a row, and the view key moves', () => {
    const before = slurRulesGeneration()
    expect(setSlurRule('stemSideEnd', 'stem')).toBe(true)
    expect(slurRules().stemSideEnd).toBe('stem')
    expect(slurRulesGeneration()).toBeGreaterThan(before)
  })

  it('⛔ refuses an unknown row or choice', () => {
    expect(setSlurRule('stemSideEnd', 'stme')).toBe(false)
    expect(setSlurRule('toString', 'head')).toBe(false)
    expect(slurRules()).toEqual(LILYPOND_SLUR_RULES)
  })

  it('hands out a copy — changing it changes nothing', () => {
    const r = slurRules()
    r.stemSideEnd = 'stem'
    expect(slurRules().stemSideEnd).toBe('head')
  })
})
