import { describe, it, expect, afterEach } from 'vitest'
import {
  CUE_SIZE_RULES, cueScale, cueSizeGeneration, cueSizeSettings, ledgerWeightScale, resetCueSize, setCueLedger, setCueSize, slotScale,
} from './cueSize'

/** Subject: `./cueSize` — the cue presets (cue-size-plan C2, C6): his defaults, arming, refusals, the width generation. */
describe('cueSize', () => {
  afterEach(() => resetCueSize())

  it('⭐ his defaults: gouldRoss ¾, gould ledgers (thinner by the size)', () => {
    expect(cueSizeSettings()).toEqual({ rule: 'gouldRoss', value: 0.75, ledger: 'gould' })
    expect(ledgerWeightScale(0.75)).toBe(0.75)
  })

  it('slotScale: 1 for a full slot, the armed size for a cue one', () => {
    expect(slotScale({})).toBe(1)
    expect(slotScale({ cue: true })).toBe(0.75)
  })

  it('arms a row by name, or a number 0.3–1; each arming bumps the WIDTH generation', () => {
    const g = cueSizeGeneration()
    expect(setCueSize('gouldDrawn')).toBe(true)
    expect(cueScale()).toBe(CUE_SIZE_RULES.gouldDrawn.value)
    expect(setCueSize(0.68)).toBe(true)
    expect(cueSizeSettings().rule).toBe('custom')
    expect(cueSizeGeneration()).toBe(g + 2)
  })

  it('⛔ a typo or an out-of-range size is REFUSED, and moves nothing', () => {
    const g = cueSizeGeneration()
    expect(setCueSize('gould' as never)).toBe(false)
    expect(setCueSize(1.2)).toBe(false)
    expect(setCueLedger('thin' as never)).toBe(false)
    expect(cueSizeGeneration()).toBe(g)
    expect(cueScale()).toBe(0.75)
  })

  it('the `full` ledger row keeps the system’s weight', () => {
    setCueLedger('full')
    expect(ledgerWeightScale(0.75)).toBe(1)
  })
})
