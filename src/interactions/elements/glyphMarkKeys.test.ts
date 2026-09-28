/** Subject: `./glyphMarkKeys` — the arrows nudge a symbol's ink; reset declines when never moved (symbol plan P4). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'
import { GLYPH_MARK_KEYS } from './glyphMarkKeys'
import { ELEMENT_SPECS } from './chain'

describe('GLYPH_MARK_KEYS', () => {
  const engine = { glyphMark: { nudge: vi.fn(() => true), reset: vi.fn(() => true) } }
  let ctx: KeysCtx
  const mark = { kind: 'glyphMark', id: 'G1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the symbol row of ELEMENT_SPECS, and has no reanchor — a symbol belongs to its event', () => {
    expect(ELEMENT_SPECS.glyphMark.keys).toBe(GLYPH_MARK_KEYS)
    expect(GLYPH_MARK_KEYS.reanchor).toBeUndefined()
  })

  it('an arrow nudges the ink by its step, screen-signed, and renders', () => {
    expect(GLYPH_MARK_KEYS.nudge!(ctx, mark, 0, -0.25)).toBe(true)
    expect(engine.glyphMark.nudge).toHaveBeenCalledWith('G1', 0, -0.25)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('a refused nudge (off the page) renders nothing; a reset that declines falls through', () => {
    engine.glyphMark.nudge.mockReturnValueOnce(false)
    expect(GLYPH_MARK_KEYS.nudge!(ctx, mark, 1, 0)).toBe(false)
    engine.glyphMark.reset.mockReturnValueOnce(false)
    expect(GLYPH_MARK_KEYS.reset!(ctx, mark)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })
})
