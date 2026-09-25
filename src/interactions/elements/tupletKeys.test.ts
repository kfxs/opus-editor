/**
 * **The arrows on a selected tuplet** — vertical only, screen-signed straight through, and a reset that
 * declines when there is nothing to take back (his ask, 2026-09-25).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'
import { TUPLET_KEYS } from './tupletKeys'
import { ELEMENT_SPECS } from './chain'

describe('TUPLET_KEYS', () => {
  const engine = { tuplet: { nudgeOffset: vi.fn(() => true), resetOffset: vi.fn(() => true) } }
  let ctx: KeysCtx
  const mark = { kind: 'tuplet', id: 'T1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    engine.tuplet.nudgeOffset.mockReturnValue(true)
    engine.tuplet.resetOffset.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the tuplet row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.tuplet.keys).toBe(TUPLET_KEYS)
  })

  it('⭐ ↑/↓: the screen dy goes through unchanged, and the picture is redrawn', () => {
    expect(TUPLET_KEYS.nudge!(ctx, mark, 0, -0.25)).toBe(true)
    expect(engine.tuplet.nudgeOffset).toHaveBeenCalledWith('T1', -0.25)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('⛔ a HORIZONTAL press declines — the bracket has no x of its own', () => {
    expect(TUPLET_KEYS.nudge!(ctx, mark, 0.25, 0)).toBe(false)
    expect(engine.tuplet.nudgeOffset).not.toHaveBeenCalled()
  })

  it('a refused nudge (the page limit) declines without a render', () => {
    engine.tuplet.nudgeOffset.mockReturnValue(false)
    expect(TUPLET_KEYS.nudge!(ctx, mark, 0, 1)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('Ctrl+Backspace resets, and DECLINES when nothing was nudged', () => {
    expect(TUPLET_KEYS.reset!(ctx, mark)).toBe(true)
    engine.tuplet.resetOffset.mockReturnValue(false)
    expect(TUPLET_KEYS.reset!(ctx, mark)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
