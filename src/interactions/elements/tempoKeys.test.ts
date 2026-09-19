/**
 * **The arrows on a selected tempo mark** — the walk on the horizontal, a plain offset on the
 * vertical, and a reset that declines when there is nothing to take back. Its twin is
 * `dynamicKeys.test.ts`; what differs between the two is the vertical's SIGN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'

const walk = vi.hoisted(() => ({ walkTempo: vi.fn(() => true) }))
// Partial: importing `ELEMENT_SPECS` loads every kind, and the mark's DRAG reads this module too.
vi.mock('../tempoWalk', async importOriginal => ({ ...(await importOriginal<object>()), ...walk }))

import { TEMPO_KEYS } from './tempoKeys'
import { ELEMENT_SPECS } from './chain'

describe('TEMPO_KEYS', () => {
  const engine = { moveTempoBySlot: vi.fn(() => true), nudgeTempoOffset: vi.fn(() => true), resetTempoOffset: vi.fn(() => true), commitTempoDrag: vi.fn() }
  let ctx: KeysCtx
  const mark = { kind: 'tempo', id: 'T1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    engine.nudgeTempoOffset.mockReturnValue(true)
    engine.resetTempoOffset.mockReturnValue(true)
    walk.walkTempo.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the tempo row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.tempo.keys).toBe(TEMPO_KEYS)
  })

  it('⭐ the HORIZONTAL walks the mark, ⛔ not a plain nudge', () => {
    TEMPO_KEYS.nudge!(ctx, mark, 0.25, 0)
    expect(walk.walkTempo).toHaveBeenCalledWith(engine, 'T1', 0.25)
    expect(engine.nudgeTempoOffset).not.toHaveBeenCalled()
  })

  it('🚨 `↑` (a NEGATIVE screen dy) is stored OUTWARD — positive — ⛔ not as it comes', () => {
    TEMPO_KEYS.nudge!(ctx, mark, 0, -0.25)
    expect(engine.nudgeTempoOffset).toHaveBeenCalledWith('T1', 0, 0.25)
  })

  it('an accepted press is handed to the key RUN — in SCREEN terms — with the mark\'s own commit', () => {
    TEMPO_KEYS.nudge!(ctx, mark, 0, -0.25)
    const [kind, id, dx, dy, commit] = (ctx.afterMarkPress as ReturnType<typeof vi.fn>).mock.calls[0]
    expect([kind, id, dx, dy]).toEqual(['tempo', 'T1', 0, -0.25])
    commit()
    expect(engine.commitTempoDrag).toHaveBeenCalledTimes(1)
  })

  it('🚨 a REFUSED press DECLINES, and hands nothing to the run', () => {
    walk.walkTempo.mockReturnValue(false)
    expect(TEMPO_KEYS.nudge!(ctx, mark, 1, 0)).toBe(false)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()
  })

  it('⭐ reanchor moves the WHOLE mark through the music by one stop — no armed-square gate: it is a point', () => {
    engine.moveTempoBySlot.mockReturnValue(true)
    expect(TEMPO_KEYS.reanchor!(ctx, mark, 1)).toBe(true)
    expect(engine.moveTempoBySlot).toHaveBeenCalledWith('T1', 1)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('reanchor DECLINES, and draws nothing, when the model refuses — the chord falls through', () => {
    engine.moveTempoBySlot.mockReturnValue(false)
    expect(TEMPO_KEYS.reanchor!(ctx, mark, -1)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('⛔ has no handles for `Tab` to walk', () => {
    expect(TEMPO_KEYS.cycle).toBeUndefined()
  })

  it('reset renders when it took a nudge back, and DECLINES — without rendering — when there was none', () => {
    expect(TEMPO_KEYS.reset!(ctx, mark)).toBe(true)
    expect(ctx.render).toHaveBeenCalledTimes(1)
    engine.resetTempoOffset.mockReturnValue(false)
    expect(TEMPO_KEYS.reset!(ctx, mark)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
