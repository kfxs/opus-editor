import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { DynamicOffsetController } from './DynamicOffsetController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '@/types/music'

/**
 * {@link DynamicOffsetController} — the apply half of the Properties dynamic-offset row (his ask,
 * 2026-08-17). `NoteOffsetController`'s twin, and what it owns is one conversion: the window writes
 * an ABSOLUTE offset, the facade takes a RELATIVE nudge.
 *
 * ⭐ Routing the typed value through `nudgeDynamicOffset` rather than writing the override directly
 * is what puts the panel behind the same page limit as the arrow keys — his report the same
 * afternoon, *"the offset limit should also be true of properties"*. The last case pins it.
 */
describe('DynamicOffsetController', () => {
  let controller: DynamicOffsetController
  let nudge: Mock<(id: string, dx: number, dy: number) => boolean>
  let render: Mock<() => void>
  let score: Score

  beforeEach(() => {
    nudge = vi.fn(() => true)
    render = vi.fn()
    score = { id: 's', title: '', measures: [], engravingOverrides: {} } as unknown as Score
    const engine = { getScore: () => score, nudgeDynamicOffset: nudge } as unknown as MusicEngine
    controller = new DynamicOffsetController(() => engine, render)
  })
  afterEach(() => { controller.destroy() })

  /** Give the dynamic a stored offset, as the model would hold it. */
  const stored = (x: number, y: number) => {
    score.engravingOverrides = { D1: [{ kind: 'dynamicOffset', x, y } as never] }
  }

  it('⭐ turns an ABSOLUTE ask into the delta from what is stored', () => {
    stored(1, 2)
    bus.dynamicOffset.set('D1', 3, -1)
    expect(nudge).toHaveBeenCalledWith('D1', 2, -3)
    expect(render).toHaveBeenCalled()
  })

  it('treats an absent override as (0, 0)', () => {
    bus.dynamicOffset.set('D1', 1.5, 0.5)
    expect(nudge).toHaveBeenCalledWith('D1', 1.5, 0.5)
  })

  it('⚠️ ONE call, not one per axis — one commit is one undo entry', () => {
    // Two nudges would also let the page limit judge the halves separately, so a diagonal that must
    // be refused whole could get its x through.
    bus.dynamicOffset.set('D1', 2, 2)
    expect(nudge).toHaveBeenCalledTimes(1)
  })

  it('does NOTHING when the value has not changed — no empty undo entry, no repaint', () => {
    stored(1, 2)
    bus.dynamicOffset.set('D1', 1, 2)
    expect(nudge).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ does not repaint when the engine REFUSES — which is how the page limit reaches the panel', () => {
    // The engine declines a nudge that would push the mark off the sheet. Nothing changed, so nothing
    // repaints — and the panel's own rule (put the box back on commit) is what keeps the typed number
    // from lingering on screen.
    nudge.mockReturnValue(false)
    bus.dynamicOffset.set('D1', 900, 0)
    expect(nudge).toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⛔ is inert with no engine, and after destroy', () => {
    // ⚠️ The bus is a SINGLETON, so this one has to go first or both subscribers answer.
    controller.destroy()
    bus.dynamicOffset.set('D1', 7, 7)
    expect(nudge, 'unsubscribed').not.toHaveBeenCalled()

    const orphan = new DynamicOffsetController(() => null, render)
    bus.dynamicOffset.set('D1', 5, 5)
    expect(render, 'no engine to apply through').not.toHaveBeenCalled()
    orphan.destroy()
  })
})
