/**
 * **The arrows on a selected slur** — one kind, four readings told apart by what is armed, and the
 * one asymmetry between them: an armed END or JOIN always consumes the key, a shape handle and the
 * whole curve decline on a refusal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { KeysCtx } from './keys'

const endpointWalk = vi.hoisted(() => ({ walkArmedSlurEndpoint: vi.fn() }))
const handleNudge = vi.hoisted(() => ({
  nudgeArmedSlurControlPoint: vi.fn(() => true),
  resetArmedSlurHandle: vi.fn(() => true),
}))
// Partial: importing `ELEMENT_SPECS` loads every kind, and the slur's DRAGS read these modules too.
vi.mock('../slurEndpointWalk', async importOriginal => ({ ...(await importOriginal<object>()), ...endpointWalk }))
vi.mock('../slurHandleNudge', async importOriginal => ({ ...(await importOriginal<object>()), ...handleNudge }))

import { SLUR_KEYS } from './slurKeys'
import { ELEMENT_SPECS } from './chain'

describe('SLUR_KEYS', () => {
  const engine = {
    nudgeSlurEndpoint: vi.fn(() => true),
    nudgeSlurSegmentEndpoint: vi.fn(() => true),
    nudgeSlur: vi.fn(() => true),
    resetSlurOffset: vi.fn(() => true),
  }
  let ctx: KeysCtx
  const whole = { kind: 'slur', id: 'S1' } as const
  const end = { kind: 'slur', id: 'S1', endpoint: 'end' } as const
  const join = { kind: 'slur', id: 'S1', segmentEndpoint: { segment: { role: 'begin' }, which: 'end' }, segmentSpanCount: 3 } as never
  const dot = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 0 } } as never

  beforeEach(() => {
    vi.clearAllMocks()
    for (const fn of Object.values(engine)) fn.mockReturnValue(true)
    handleNudge.nudgeArmedSlurControlPoint.mockReturnValue(true)
    handleNudge.resetArmedSlurHandle.mockReturnValue(true)
    ctx = { engine: engine as unknown as MusicEngine, state: { tag: 'state' } as never, render: vi.fn(), afterMarkPress: vi.fn() }
  })

  it('is the slur row of ELEMENT_SPECS', () => {
    expect(ELEMENT_SPECS.slur.keys).toBe(SLUR_KEYS)
  })

  it('⭐ a TRUE END: the horizontal WALKS it (the anchor may come along), the vertical nudges its ink', () => {
    SLUR_KEYS.nudge!(ctx, end, 0.25, 0)
    expect(endpointWalk.walkArmedSlurEndpoint).toHaveBeenCalledWith(ctx.state, engine, 0.25)
    SLUR_KEYS.nudge!(ctx, end, 0, -0.25)
    expect(engine.nudgeSlurEndpoint).toHaveBeenCalledWith('S1', 'end', 0, -0.25)
  })

  it('an OPEN JOIN nudges that join, passing the captured span count as the reset signature', () => {
    SLUR_KEYS.nudge!(ctx, join, 0.25, 0)
    expect(engine.nudgeSlurSegmentEndpoint).toHaveBeenCalledWith('S1', expect.anything(), 0.25, 0, 3)
    expect(endpointWalk.walkArmedSlurEndpoint).not.toHaveBeenCalled()
  })

  it('a SHAPE handle goes to its own module; NOTHING armed moves the whole curve, screen-signed', () => {
    SLUR_KEYS.nudge!(ctx, dot, 0, -1)
    expect(handleNudge.nudgeArmedSlurControlPoint).toHaveBeenCalledWith(ctx.state, engine, 0, -1)
    SLUR_KEYS.nudge!(ctx, whole, 1, -1)
    expect(engine.nudgeSlur).toHaveBeenCalledWith('S1', 1, -1)
  })

  it('⚠️ an armed END or JOIN always CONSUMES the key and renders — even when the engine refused', () => {
    engine.nudgeSlurEndpoint.mockReturnValue(false)
    engine.nudgeSlurSegmentEndpoint.mockReturnValue(false)
    expect(SLUR_KEYS.nudge!(ctx, end, 0, 1)).toBe(true)
    expect(SLUR_KEYS.nudge!(ctx, join, 0, 1)).toBe(true)
    expect(ctx.render).toHaveBeenCalledTimes(2)
  })

  it('…while a shape handle and the whole curve DECLINE on a refusal, and draw nothing', () => {
    handleNudge.nudgeArmedSlurControlPoint.mockReturnValue(false)
    engine.nudgeSlur.mockReturnValue(false)
    expect(SLUR_KEYS.nudge!(ctx, dot, 1, 0)).toBe(false)
    expect(SLUR_KEYS.nudge!(ctx, whole, 1, 0)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })

  it('⛔ no key RUN: a slur press is its own write and its own render', () => {
    SLUR_KEYS.nudge!(ctx, whole, 0.25, 0)
    expect(ctx.afterMarkPress).not.toHaveBeenCalled()
    expect(ctx.render).toHaveBeenCalledTimes(1)
  })

  it('reset: ANY armed handle → that handle; nothing armed → the whole curve; declines when nothing was authored', () => {
    for (const armed of [end, join, dot]) SLUR_KEYS.reset!(ctx, armed)
    expect(handleNudge.resetArmedSlurHandle).toHaveBeenCalledTimes(3)
    expect(engine.resetSlurOffset).not.toHaveBeenCalled()
    expect(SLUR_KEYS.reset!(ctx, whole)).toBe(true)
    expect(engine.resetSlurOffset).toHaveBeenCalledWith('S1')

    engine.resetSlurOffset.mockReturnValue(false)
    ;(ctx.render as ReturnType<typeof vi.fn>).mockClear()
    expect(SLUR_KEYS.reset!(ctx, whole)).toBe(false)
    expect(ctx.render).not.toHaveBeenCalled()
  })
})
