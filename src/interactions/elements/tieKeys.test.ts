/**
 * **The arrows on a selected tie** — vertical only; a horizontal press declines; a refused vertical
 * step still consumes the key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'
import { TIE_KEYS } from './tieKeys'
import { ELEMENT_SPECS } from './chain'

describe('TIE_KEYS', () => {
  const engine = { tie: { nudgeTie: vi.fn(() => true), resetTieOffset: vi.fn(() => true) } }
  const tie = { kind: 'tie', fromNoteId: 'N1' } as const
  let ctx: KeysCtx

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = { engine: engine as unknown as MusicEngine, state: {} as never, render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the `keys` column of the tie’s row', () => {
    expect(ELEMENT_SPECS.tie.keys).toBe(TIE_KEYS)
  })

  it('⭐ ↑/↓ move the arc — screen-signed straight through — and render', () => {
    expect(TIE_KEYS.nudge!(ctx, tie, 0, -0.25)).toBe(true)
    expect(engine.tie.nudgeTie).toHaveBeenCalledWith('N1', -0.25)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('⛔ ←/→ DECLINE: a tie’s ends are its noteheads, there is no horizontal to author', () => {
    expect(TIE_KEYS.nudge!(ctx, tie, 0.25, 0)).toBe(false)
    expect(engine.tie.nudgeTie).not.toHaveBeenCalled()
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('⚠️ a REFUSED vertical step still consumes the key — it must not fall through to a pitch edit', () => {
    engine.tie.nudgeTie.mockReturnValueOnce(false)
    expect(TIE_KEYS.nudge!(ctx, tie, 0, 1)).toBe(true)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('reset renders when something was dropped, and DECLINES when nothing was', () => {
    expect(TIE_KEYS.reset!(ctx, tie)).toBe(true)
    expect(ctx.render).toHaveBeenCalledTimes(1)
    engine.tie.resetTieOffset.mockReturnValueOnce(false)
    expect(TIE_KEYS.reset!(ctx, tie)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
