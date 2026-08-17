import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { OttavaGeometryController } from './OttavaGeometryController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '@/types/music'

/**
 * {@link OttavaGeometryController} — the apply half of the Properties ottava offset rows (his ask,
 * 2026-08-17). `HairpinGeometryController`'s twin, and what it owns is one conversion: the window
 * writes an ABSOLUTE number, the facade takes a RELATIVE nudge.
 *
 * ⭐ Going through `nudgeOttavaEndpoint` rather than writing the override directly is what puts the
 * panel behind the same PAGE LIMIT as the arrow keys (his report the same afternoon: *"the offset
 * limit should also be true of properties"*). ⛔ A controller that wrote the compartment itself would
 * be a second door past that gate.
 */
describe('OttavaGeometryController', () => {
  let controller: OttavaGeometryController
  let nudge: Mock<(id: string, which: 'start' | 'end', dx: number, dy: number) => boolean>
  let render: Mock<() => void>
  let score: Score

  beforeEach(() => {
    nudge = vi.fn(() => true)
    render = vi.fn()
    score = { id: 's', title: '', measures: [], engravingOverrides: {} } as unknown as Score
    const engine = { getScore: () => score, nudgeOttavaEndpoint: nudge } as unknown as MusicEngine
    controller = new OttavaGeometryController(() => engine, render)
  })
  afterEach(() => { controller.destroy() })

  /** Give the bracket a stored offset, as the model would hold it. */
  const stored = (o: { startX?: number; endX?: number; outward?: number }) => {
    score.engravingOverrides = { O1: [{ kind: 'ottavaOffset', ...o } as never] }
  }

  it('⭐ turns an ABSOLUTE end value into the delta from what is stored', () => {
    stored({ startX: 1 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'start', x: 3 })
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 2, 0)
    expect(render).toHaveBeenCalled()
  })

  it('reads the RIGHT end\'s number — `endX` is not `startX`', () => {
    stored({ startX: 5, endX: 1 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'end', x: 2 })
    expect(nudge).toHaveBeenCalledWith('O1', 'end', 1, 0)
  })

  it('treats an absent override as 0', () => {
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'end', x: -1.5 })
    expect(nudge).toHaveBeenCalledWith('O1', 'end', -1.5, 0)
  })

  it('⭐⭐ the VERTICAL is asked for without an end, and passes through UNFLIPPED', () => {
    // One number for the whole bracket: the request names no square, and the controller passes
    // 'start' only because a square has to be named — `OttavaOffsetOverride` has a single `outward`.
    // ⭐ And no sign is touched on this road: `nudgeOttavaEndpoint` speaks outward-from-the-staff too.
    // Only the KEYBOARD converts, because `↑` is a screen direction.
    stored({ outward: -1 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: -3 })
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 0, -2)
  })

  it('⛔ an outward request never moves an x, and an end request never moves the vertical', () => {
    stored({ startX: 2, outward: 2 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: 5 })
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 0, 3)
    nudge.mockClear()
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'start', x: 4 })
    expect(nudge).toHaveBeenCalledWith('O1', 'start', 2, 0)
  })

  it('does NOTHING when the value has not changed — no empty undo entry, no repaint', () => {
    stored({ startX: 1, outward: -2 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'start', x: 1 })
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: -2 })
    expect(nudge).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ does not repaint when the engine REFUSES — which is how the page limit reaches the panel', () => {
    nudge.mockReturnValue(false)
    bus.ottavaGeometry.set({ ottavaId: 'O1', which: 'start', x: 900 })
    expect(nudge).toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ …and the OUTWARD branch honours the refusal too — BOTH roads pass the same gate', () => {
    // ⚠️ Its own case because the two branches are two `return`s: a break-test that dropped only the
    // height branch's guard passed the case above untouched, since that one drives an END.
    nudge.mockReturnValue(false)
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: -900 })
    expect(nudge).toHaveBeenCalled()
    expect(render, 'nothing moved, so nothing repaints').not.toHaveBeenCalled()
  })

  it('⛔ is inert with no engine, and after destroy', () => {
    // ⚠️ The bus is a SINGLETON, so this one has to go first or both subscribers answer.
    controller.destroy()
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: 1 })
    expect(nudge, 'unsubscribed').not.toHaveBeenCalled()

    const orphan = new OttavaGeometryController(() => null, render)
    bus.ottavaGeometry.set({ ottavaId: 'O1', outward: 1 })
    expect(render, 'no engine to apply through').not.toHaveBeenCalled()
    orphan.destroy()
  })
})
