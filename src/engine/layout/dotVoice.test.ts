import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOT_VOICE_RULE, DOT_VOICE_RULES, armedDotVoice, dotVoiceGeneration, dotVoiceSettings, resetDotVoiceRule, setDotVoiceRule,
} from './dotVoice'

afterEach(() => resetDotVoiceRule())

describe('two voices: which way a line note’s dot goes (docs/plans/multiple-dots-plan.md R3)', () => {
  it('✅ ships `gould` — below the lower part, lifted where the parts overlap', () => {
    expect(ACTIVE_DOT_VOICE_RULE).toBe('gould')
    expect(armedDotVoice()).toMatchObject({ downStemBelow: true, overlapLifts: true })
  })

  it('`vexflow` is what we drew: no two-part rule at all', () => {
    setDotVoiceRule('vexflow')
    expect(armedDotVoice()).toMatchObject({ downStemBelow: false, overlapLifts: false })
  })

  it('every row names its source; arming bumps the generation; an unknown row is refused', () => {
    for (const row of Object.values(DOT_VOICE_RULES)) expect(row.source.length).toBeGreaterThan(0)
    const before = dotVoiceGeneration()
    expect(setDotVoiceRule('verovio')).toBe(true)
    expect(dotVoiceGeneration()).toBeGreaterThan(before)
    expect(setDotVoiceRule('nope' as never)).toBe(false)
    expect(dotVoiceSettings().rule).toBe('verovio')
  })
})
