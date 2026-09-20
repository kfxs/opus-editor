/**
 * The beam-slope knob — his experiment (2026-09-01).
 *
 * ⛔ No spec here asserts that a RULE is right: which one this editor should use is open. What is
 * pinned is the instrument's own contract — arming works, typos are refused, and the generation
 * reaches the render key (without which the console call would draw nothing).
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  armedBeamSlopeRule, beamSlopeGeneration, beamSlopeSettings, resetBeamSlope, setBeamSlopeRule,
} from './beamSlopeExperiment'
import { ACTIVE_BEAM_SLOPE_RULE } from '@/engine/engrave/beams/beamSlope'

afterEach(() => resetBeamSlope())

describe('beamSlopeExperiment', () => {
  it('⛔ changes nothing by default — a session that never opens the console draws what shipped', () => {
    expect(armedBeamSlopeRule()).toBe(ACTIVE_BEAM_SLOPE_RULE)
  })

  it('⭐ arming a rule takes effect', () => {
    expect(setBeamSlopeRule('vexflow')).toBe(true)
    expect(armedBeamSlopeRule()).toBe('vexflow')
    expect(beamSlopeSettings().rule).toBe('vexflow')
  })

  it('⛔ a name that is not a rule is REFUSED, not silently ignored', () => {
    setBeamSlopeRule('vexflow')
    expect(setBeamSlopeRule('sibelius' as never), 'not a row — and it must say so').toBe(false)
    expect(armedBeamSlopeRule(), 'the armed rule is untouched by a refusal').toBe('vexflow')
  })

  // 🚨 THE ONE THAT MATTERS. A slope is a PICTURE change with no model change, so if this number
  // does not move, `isRenderStale()` answers "no" and `__beams.rule(…)` redraws NOTHING — the
  // console would look like it worked and the page would not change
  // (`reference_only_a_stale_render_runs`). The renderer's `viewStateKey` reads it.
  it('🚨 every write bumps the generation — or the console call never reaches the page', () => {
    const before = beamSlopeGeneration()
    setBeamSlopeRule('vexflow')
    expect(beamSlopeGeneration()).toBeGreaterThan(before)
    const armed = beamSlopeGeneration()
    expect(setBeamSlopeRule('nope' as never)).toBe(false)
    expect(beamSlopeGeneration(), 'a REFUSED write moves nothing').toBe(armed)
    resetBeamSlope()
    expect(beamSlopeGeneration()).toBeGreaterThan(armed)
  })

  it('⭐ reset goes back to what shipped', () => {
    setBeamSlopeRule('vexflow')
    resetBeamSlope()
    expect(armedBeamSlopeRule()).toBe(ACTIVE_BEAM_SLOPE_RULE)
  })
})
