/**
 * **The arrows on a selected inline clef** — horizontal only, at the clef's exact address, and the
 * engine's word on whether this clef may be offset at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { beatToFrac } from '../../utils/musicUtils'
import type { KeysCtx } from './keys'
import { CLEF_KEYS } from './clefKeys'
import { ELEMENT_SPECS } from './chain'

describe('CLEF_KEYS', () => {
  const engine = { nudgeClefOffset: vi.fn(() => true), resetClefOffset: vi.fn(() => true) }
  let ctx: KeysCtx
  const clef = { kind: 'clef', measure: 3, beat: 1.5, staff: 1 } as const

  beforeEach(() => {
    vi.clearAllMocks()
    engine.nudgeClefOffset.mockReturnValue(true)
    engine.resetClefOffset.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the clef row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.clef.keys).toBe(CLEF_KEYS)
  })

  it('a horizontal arrow nudges the clef at its own measure, beat and STAFF — and renders', () => {
    expect(CLEF_KEYS.nudge!(ctx, clef, -0.25, 0)).toBe(true)
    expect(engine.nudgeClefOffset).toHaveBeenCalledWith(3, beatToFrac(1.5), 1, -0.25)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('⛔ a VERTICAL arrow DECLINES without asking the engine — the key goes on to the pitch edit', () => {
    expect(CLEF_KEYS.nudge!(ctx, clef, 0, -0.25)).toBe(false)
    expect(engine.nudgeClefOffset).not.toHaveBeenCalled()
  })

  it('⚠️ a HEADER clef declines — the ENGINE says so, from the ink — and nothing is drawn', () => {
    engine.nudgeClefOffset.mockReturnValue(false)
    expect(CLEF_KEYS.nudge!(ctx, clef, 0.25, 0)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('reset renders when it took a nudge back, and DECLINES when there was none', () => {
    expect(CLEF_KEYS.reset!(ctx, clef)).toBe(true)
    expect(engine.resetClefOffset).toHaveBeenCalledWith(3, beatToFrac(1.5), 1)
    engine.resetClefOffset.mockReturnValue(false)
    expect(CLEF_KEYS.reset!(ctx, clef)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
