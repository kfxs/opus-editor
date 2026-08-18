import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { PedalGeometryController } from './PedalGeometryController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '@/types/music'

/**
 * {@link PedalGeometryController} — the apply half of the Properties pedal offset rows (his ask,
 * 2026-08-18). `OttavaGeometryController`'s twin, and what it owns is one conversion: the window
 * writes an ABSOLUTE number, the facade takes a RELATIVE nudge.
 *
 * ⭐ Going through `nudgePedalEndpoint` rather than writing the override directly is what puts the
 * panel behind the same PAGE LIMIT as the arrow keys. ⛔ A controller that wrote the compartment
 * itself would be a second door past that gate.
 *
 * ⭐⭐ And one thing the bracket's twin has to do that this one must NOT: convert a sign. The model,
 * this seam and the facade all speak SCREEN here, so the vertical passes through untouched — the
 * flip lives in the panel's box alone.
 */
describe('PedalGeometryController', () => {
  let controller: PedalGeometryController
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let render: Mock<() => void>
  let score: Score

  beforeEach(() => {
    nudge = vi.fn(() => true)
    render = vi.fn()
    score = { id: 's', title: '', measures: [], engravingOverrides: {} } as unknown as Score
    const engine = { getScore: () => score, nudgePedalEndpoint: nudge } as unknown as MusicEngine
    controller = new PedalGeometryController(() => engine, render)
  })
  afterEach(() => { controller.destroy() })

  /** Give the pedal a stored offset, as the model would hold it. */
  const stored = (o: { startX?: number; endX?: number; y?: number }) => {
    score.engravingOverrides = { P1: [{ kind: 'pedalOffset', ...o } as never] }
  }

  it('⭐ turns an ABSOLUTE sign value into the delta from what is stored', () => {
    stored({ startX: 1 })
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'start', x: 3 })
    expect(nudge).toHaveBeenCalledWith('P1', 'start', 2, 0)
    expect(render).toHaveBeenCalled()
  })

  it('reads the RIGHT sign\'s number — the `✻`\'s is not the `Ped.`\'s', () => {
    stored({ startX: 5, endX: 1 })
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'end', x: 2 })
    expect(nudge).toHaveBeenCalledWith('P1', 'end', 1, 0)
  })

  it('treats an absent override as 0', () => {
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'end', x: -1.5 })
    expect(nudge).toHaveBeenCalledWith('P1', 'end', -1.5, 0)
  })

  it('⭐⭐ the VERTICAL is asked for without a sign, and passes through UNFLIPPED', () => {
    // One number for the pair: the request names no square, and the controller passes 'start' only
    // because a square has to be named — `PedalOffsetOverride` has a single `y`.
    // ⭐ And no sign is touched on this road. ⛔ Break-test against copying the bracket's controller:
    // a negation borrowed from it would send the panel's value the wrong way with nothing on screen
    // to say which layer was at fault.
    stored({ y: -1 })
    bus.pedalGeometry.set({ pedalId: 'P1', y: -3 })
    expect(nudge).toHaveBeenCalledWith('P1', 'start', 0, -2)
  })

  it('⛔ a vertical request never moves an x, and a sign request never moves the vertical', () => {
    stored({ startX: 2, y: 2 })
    bus.pedalGeometry.set({ pedalId: 'P1', y: 5 })
    expect(nudge).toHaveBeenCalledWith('P1', 'start', 0, 3)
    nudge.mockClear()
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'start', x: 4 })
    expect(nudge).toHaveBeenCalledWith('P1', 'start', 2, 0)
  })

  it('does NOTHING when the value has not changed — no empty undo entry, no repaint', () => {
    stored({ startX: 1, y: -2 })
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'start', x: 1 })
    bus.pedalGeometry.set({ pedalId: 'P1', y: -2 })
    expect(nudge).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ does not repaint when the engine REFUSES — which is how the page limit reaches the panel', () => {
    nudge.mockReturnValue(false)
    bus.pedalGeometry.set({ pedalId: 'P1', which: 'start', x: 900 })
    expect(nudge).toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ …and the VERTICAL branch honours the refusal too — BOTH roads pass the same gate', () => {
    // ⚠️ Its own case because the two branches are two `return`s: a break-test that dropped only the
    // height branch's guard passed the case above untouched, since that one drives a sign.
    nudge.mockReturnValue(false)
    bus.pedalGeometry.set({ pedalId: 'P1', y: 900 })
    expect(nudge).toHaveBeenCalled()
    expect(render, 'nothing moved, so nothing repaints').not.toHaveBeenCalled()
  })

  it('⛔ is inert with no engine, and after destroy', () => {
    // ⚠️ The bus is a SINGLETON, so this one has to go first or both subscribers answer.
    controller.destroy()
    bus.pedalGeometry.set({ pedalId: 'P1', y: 1 })
    expect(nudge, 'unsubscribed').not.toHaveBeenCalled()

    const orphan = new PedalGeometryController(() => null, render)
    bus.pedalGeometry.set({ pedalId: 'P1', y: 1 })
    expect(render, 'no engine to apply through').not.toHaveBeenCalled()
    orphan.destroy()
  })
})
