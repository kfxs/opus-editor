/**
 * **The arrows on a selected inline clef** — horizontal only, at the clef's exact address, and the
 * engine's word on whether this clef may be offset at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { beatToFrac } from '../../utils/musicUtils'
import type { KeysCtx } from './keys'
import { fracCreate as frac } from '../../utils/fraction'

const beatMap = vi.hoisted(() => ({ buildBeatMap: vi.fn() }))
vi.mock('../../utils/beatMap', async importOriginal => ({ ...(await importOriginal<object>()), ...beatMap }))

import { CLEF_KEYS } from './clefKeys'
import { ELEMENT_SPECS } from './chain'

describe('CLEF_KEYS', () => {
  const engine = {
    nudgeClefOffset: vi.fn(() => true), resetClefOffset: vi.fn(() => true),
    getScore: () => ({}), moveClef: vi.fn(() => true), commitClefMove: vi.fn(),
  }
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

  describe('reanchor — `Ctrl+Shift+←/→` moves the clef through the music', () => {
    // The clef stands at bar 3, beat 1.5; the staff's beat map has a stop either side of it.
    const stops = [
      { measureNumber: 3, beat: frac(1, 1) },
      { measureNumber: 3, beat: frac(3, 2) },
      { measureNumber: 4, beat: frac(0, 1) },
    ]
    beforeEach(() => {
      engine.moveClef.mockReturnValue(true)
      beatMap.buildBeatMap.mockReturnValue({ beats: stops })
      ctx.state = { selectedElement: clef } as never
    })

    it('⭐ steps to the NEXT stop of the clef\'s own STAFF — across the barline — and commits as the drag does', () => {
      expect(CLEF_KEYS.reanchor!(ctx, clef, 1)).toBe(true)
      expect(beatMap.buildBeatMap).toHaveBeenCalledWith(expect.anything(), undefined, 1)
      expect(engine.moveClef).toHaveBeenCalledWith(3, beatToFrac(1.5), 4, frac(0, 1))
      expect(engine.commitClefMove).toHaveBeenCalledWith(4, frac(0, 1))
    })

    it('⭐ the selection FOLLOWS the clef — reassigned, on the same staff', () => {
      CLEF_KEYS.reanchor!(ctx, clef, -1)
      expect(ctx.state.selectedElement).toEqual({ kind: 'clef', measure: 3, beat: 1, staff: 1 })
    })

    it('⛔ DECLINES off the end of the map, and when the model refuses — committing and selecting nothing', () => {
      expect(CLEF_KEYS.reanchor!(ctx, { ...clef, measure: 4, beat: 0 }, 1)).toBe(false)
      engine.moveClef.mockReturnValue(false)
      expect(CLEF_KEYS.reanchor!(ctx, clef, 1)).toBe(false)
      expect(engine.commitClefMove).not.toHaveBeenCalled()
      expect(ctx.state.selectedElement).toBe(clef)
    })
  })

  it('reset renders when it took a nudge back, and DECLINES when there was none', () => {
    expect(CLEF_KEYS.reset!(ctx, clef)).toBe(true)
    expect(engine.resetClefOffset).toHaveBeenCalledWith(3, beatToFrac(1.5), 1)
    engine.resetClefOffset.mockReturnValue(false)
    expect(CLEF_KEYS.reset!(ctx, clef)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
