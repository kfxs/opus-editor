/**
 * **The arrows on a selected hairpin** — armed end against whole wedge, the walk on the horizontal
 * and the plain nudge on the vertical, and a reset that declines when there is nothing to take
 * back. How a key reaches this row is `shortcutWiring`'s; the walks are `hairpinWalk.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'

const handles = vi.hoisted(() => ({ cycleHairpinEndpoint: vi.fn(() => true) }))
vi.mock('./hairpinHandles', async importOriginal => ({ ...(await importOriginal<object>()), ...handles }))

const walk = vi.hoisted(() => ({
  walkHairpinEndpoint: vi.fn(() => true),
  walkHairpinBody: vi.fn(() => true),
}))
// Partial: importing `ELEMENT_SPECS` loads every kind, and the wedge's DRAG reads this module too.
vi.mock('../hairpinWalk', async importOriginal => ({ ...(await importOriginal<object>()), ...walk }))

import { HAIRPIN_KEYS } from './hairpinKeys'
import { ELEMENT_SPECS } from './chain'

describe('HAIRPIN_KEYS', () => {
  const engine = {
    nudgeHairpinEndpoint: vi.fn(() => true),
    nudgeHairpin: vi.fn(() => true),
    commitHairpinDrag: vi.fn(),
    commitHairpinOffsetDrag: vi.fn(),
    resetHairpinEndpointOffset: vi.fn(() => true),
    resetHairpinOffset: vi.fn(() => true),
    resizeHairpinBySlot: vi.fn(() => true),
    moveHairpinStartBySlot: vi.fn(() => true),
    getElementRegistry: vi.fn(() => 'the registry'),
  }
  let ctx: KeysCtx
  const whole = { kind: 'hairpin', id: 'H1' } as const
  const armed = { kind: 'hairpin', id: 'H1', endpoint: 'end' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    for (const fn of Object.values(engine)) fn.mockReturnValue(true as never)
    engine.getElementRegistry.mockReturnValue('the registry')
    handles.cycleHairpinEndpoint.mockReturnValue(true)
    walk.walkHairpinEndpoint.mockReturnValue(true)
    walk.walkHairpinBody.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: {} as KeysCtx['state'], render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the hairpin row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.hairpin.keys).toBe(HAIRPIN_KEYS)
  })

  it('⭐ an ARMED square: the horizontal WALKS that end, the vertical nudges it', () => {
    expect(HAIRPIN_KEYS.nudge!(ctx, armed, 0.25, 0)).toBe(true)
    expect(walk.walkHairpinEndpoint).toHaveBeenCalledWith(engine, 'H1', 'end', 0.25)
    expect(HAIRPIN_KEYS.nudge!(ctx, armed, 0, -0.25)).toBe(true)
    expect(engine.nudgeHairpinEndpoint).toHaveBeenCalledWith('H1', 'end', 0, -0.25)
    expect(walk.walkHairpinBody).not.toHaveBeenCalled()
  })

  it('⭐ NOTHING armed: the horizontal walks the WHOLE wedge, the vertical lifts it', () => {
    HAIRPIN_KEYS.nudge!(ctx, whole, -1, 0)
    expect(walk.walkHairpinBody).toHaveBeenCalledWith(engine, 'H1', -1)
    HAIRPIN_KEYS.nudge!(ctx, whole, 0, 1)
    expect(engine.nudgeHairpin).toHaveBeenCalledWith('H1', 0, 1)
    expect(walk.walkHairpinEndpoint).not.toHaveBeenCalled()
  })

  it('an accepted press is handed to the key RUN with THIS gesture\'s commit', () => {
    HAIRPIN_KEYS.nudge!(ctx, armed, 0.25, 0)
    const [kind, id, dx, dy, commit] = (ctx.afterMarkPress as ReturnType<typeof vi.fn>).mock.calls[0]
    expect([kind, id, dx, dy]).toEqual(['hairpin', 'H1', 0.25, 0])
    commit()
    expect(engine.commitHairpinDrag).toHaveBeenCalledWith('end')

    HAIRPIN_KEYS.nudge!(ctx, whole, 0.25, 0)
    ;(ctx.afterMarkPress as ReturnType<typeof vi.fn>).mock.calls[1][4]()
    expect(engine.commitHairpinOffsetDrag).toHaveBeenCalledTimes(1)
  })

  it('🚨 a REFUSED press DECLINES — nothing is drawn, and the key falls through', () => {
    walk.walkHairpinBody.mockReturnValue(false)
    expect(HAIRPIN_KEYS.nudge!(ctx, whole, 1, 0)).toBe(false)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()
  })

  it('⭐ reanchor: the armed SQUARE is the gate — END resizes, START moves the start, nothing armed DECLINES', () => {
    expect(HAIRPIN_KEYS.reanchor!(ctx, armed, 1)).toBe(true)
    expect(engine.resizeHairpinBySlot).toHaveBeenCalledWith('H1', 1)
    expect(HAIRPIN_KEYS.reanchor!(ctx, { kind: 'hairpin', id: 'H1', endpoint: 'start' }, -1)).toBe(true)
    expect(engine.moveHairpinStartBySlot).toHaveBeenCalledWith('H1', -1)
    expect(ctx.render).toHaveBeenCalledTimes(2)
    expect(HAIRPIN_KEYS.reanchor!(ctx, whole, 1)).toBe(false) // ⛔ never silently resized from one end
    expect(engine.resizeHairpinBySlot).toHaveBeenCalledTimes(1)
  })

  it('reanchor DECLINES, and draws nothing, when the model refuses (a wedge may not become non-positive)', () => {
    engine.resizeHairpinBySlot.mockReturnValue(false)
    ;(ctx.render as ReturnType<typeof vi.fn>).mockClear()
    expect(HAIRPIN_KEYS.reanchor!(ctx, armed, -1)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('cycle: `Tab` walks the two squares off the REGISTRY, and renders on a yes only', () => {
    expect(HAIRPIN_KEYS.cycle!(ctx, whole, 1)).toBe(true)
    expect(handles.cycleHairpinEndpoint).toHaveBeenCalledWith(ctx.state, 'the registry', 1)
    handles.cycleHairpinEndpoint.mockReturnValue(false)
    expect(HAIRPIN_KEYS.cycle!(ctx, whole, -1)).toBe(false)
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('reset: an armed end → that end; nothing armed → both; and it renders', () => {
    expect(HAIRPIN_KEYS.reset!(ctx, armed)).toBe(true)
    expect(engine.resetHairpinEndpointOffset).toHaveBeenCalledWith('H1', 'end')
    expect(HAIRPIN_KEYS.reset!(ctx, whole)).toBe(true)
    expect(engine.resetHairpinOffset).toHaveBeenCalledWith('H1')
    expect(ctx.render).toHaveBeenCalledTimes(2)
  })

  it('⛔ reset DECLINES when there was no nudge to take back', () => {
    engine.resetHairpinOffset.mockReturnValue(false)
    expect(HAIRPIN_KEYS.reset!(ctx, whole)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })
})
