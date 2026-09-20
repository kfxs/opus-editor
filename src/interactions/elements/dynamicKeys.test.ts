/**
 * **The arrows on a selected dynamic** — the walk on the horizontal, a plain offset on the
 * vertical, and a reset that declines when there is nothing to take back. Its twin is
 * `tempoKeys.test.ts`; what differs between the two is the vertical's SIGN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'

const walk = vi.hoisted(() => ({ walkDynamic: vi.fn(() => true) }))
// Partial: importing `ELEMENT_SPECS` loads every kind, and the mark's DRAG reads this module too.
vi.mock('../walks/dynamicWalk', async importOriginal => ({ ...(await importOriginal<object>()), ...walk }))

import { DYNAMIC_KEYS } from './dynamicKeys'
import { ELEMENT_SPECS } from './chain'

describe('DYNAMIC_KEYS', () => {
  const engine = {
    dynamic: {
      moveDynamicBySlot: vi.fn(() => true), nudgeDynamicOffset: vi.fn(() => true),
      resetDynamicOffset: vi.fn(() => true), commitDynamicDrag: vi.fn(),
    },
  }
  let ctx: KeysCtx
  const mark = { kind: 'dynamic', id: 'D1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    engine.dynamic.nudgeDynamicOffset.mockReturnValue(true)
    engine.dynamic.resetDynamicOffset.mockReturnValue(true)
    walk.walkDynamic.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the dynamic row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.dynamic.keys).toBe(DYNAMIC_KEYS)
  })

  it('⭐ the HORIZONTAL walks the mark, ⛔ not a plain nudge', () => {
    DYNAMIC_KEYS.nudge!(ctx, mark, 0.25, 0)
    expect(walk.walkDynamic).toHaveBeenCalledWith(engine, 'D1', 0.25)
    expect(engine.dynamic.nudgeDynamicOffset).not.toHaveBeenCalled()
  })

  it('`↑` (a NEGATIVE screen dy) is stored as it comes — a dynamic\'s offset is screen-signed', () => {
    DYNAMIC_KEYS.nudge!(ctx, mark, 0, -0.25)
    expect(engine.dynamic.nudgeDynamicOffset).toHaveBeenCalledWith('D1', 0, -0.25)
  })

  it('an accepted press is handed to the key RUN — in SCREEN terms — with the mark\'s own commit', () => {
    DYNAMIC_KEYS.nudge!(ctx, mark, 0, -0.25)
    const [kind, id, dx, dy, commit] = (ctx.afterMarkPress as ReturnType<typeof vi.fn>).mock.calls[0]
    expect([kind, id, dx, dy]).toEqual(['dynamic', 'D1', 0, -0.25])
    commit()
    expect(engine.dynamic.commitDynamicDrag).toHaveBeenCalledTimes(1)
  })

  it('🚨 a REFUSED press DECLINES, and hands nothing to the run', () => {
    walk.walkDynamic.mockReturnValue(false)
    expect(DYNAMIC_KEYS.nudge!(ctx, mark, 1, 0)).toBe(false)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()
  })

  it('⭐ reanchor moves the WHOLE mark through the music by one stop — no armed-square gate: it is a point', () => {
    engine.dynamic.moveDynamicBySlot.mockReturnValue(true)
    expect(DYNAMIC_KEYS.reanchor!(ctx, mark, 1)).toBe(true)
    expect(engine.dynamic.moveDynamicBySlot).toHaveBeenCalledWith('D1', 1)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('reanchor DECLINES, and draws nothing, when the model refuses — the chord falls through', () => {
    engine.dynamic.moveDynamicBySlot.mockReturnValue(false)
    expect(DYNAMIC_KEYS.reanchor!(ctx, mark, -1)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('⛔ has no handles for `Tab` to walk', () => {
    expect(DYNAMIC_KEYS.cycle).toBeUndefined()
  })

  it('reset renders when it took a nudge back, and DECLINES — without rendering — when there was none', () => {
    expect(DYNAMIC_KEYS.reset!(ctx, mark)).toBe(true)
    expect(ctx.render).toHaveBeenCalledTimes(1)
    engine.dynamic.resetDynamicOffset.mockReturnValue(false)
    expect(DYNAMIC_KEYS.reset!(ctx, mark)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })
})
