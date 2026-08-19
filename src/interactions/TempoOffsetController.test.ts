import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { TempoOffsetController } from './TempoOffsetController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '@/types/music'

/**
 * {@link TempoOffsetController} — the apply half of the Properties tempo-offset row (his ask,
 * 2026-08-19). `DynamicOffsetController`'s twin, and what it owns is one conversion: the window
 * writes an ABSOLUTE offset, the facade takes a RELATIVE nudge.
 *
 * ⭐ Routing the typed value through `nudgeTempoOffset` rather than writing the override directly is
 * what puts the panel behind the same page limit as the arrow keys — the last case pins it.
 */
describe('TempoOffsetController', () => {
  let controller: TempoOffsetController
  let nudge: Mock<(id: string, dx: number, dy: number) => boolean>
  let render: Mock<() => void>
  let score: Score

  beforeEach(() => {
    nudge = vi.fn(() => true)
    render = vi.fn()
    score = { id: 's', title: '', measures: [], engravingOverrides: {} } as unknown as Score
    const engine = { getScore: () => score, nudgeTempoOffset: nudge } as unknown as MusicEngine
    controller = new TempoOffsetController(() => engine, render)
  })
  afterEach(() => { controller.destroy() })

  /** Give the mark a stored offset, as the model would hold it. */
  const stored = (x: number, y: number) => {
    score.engravingOverrides = { T1: [{ kind: 'tempoOffset', x, y } as never] }
  }

  it('⭐ turns an ABSOLUTE ask into the delta from what is stored', () => {
    stored(1, 2)
    bus.tempoOffset.set('T1', 3, -1)
    expect(nudge).toHaveBeenCalledWith('T1', 2, -3)
    expect(render).toHaveBeenCalled()
  })

  it('treats an absent override as (0, 0)', () => {
    bus.tempoOffset.set('T1', 1.5, 0.5)
    expect(nudge).toHaveBeenCalledWith('T1', 1.5, 0.5)
  })

  it('⚠️ reads its OWN kind — a dynamic offset under the same id is not its business', () => {
    // One compartment, two kinds. Reading the wrong one would compute the delta from a number this
    // mark never had, and the first commit would fling it.
    score.engravingOverrides = { T1: [{ kind: 'dynamicOffset', x: 9, y: 9 } as never] }
    bus.tempoOffset.set('T1', 1, 1)
    expect(nudge).toHaveBeenCalledWith('T1', 1, 1)
  })

  it('⭐ ONE call for both axes — one commit is one undo entry, and one page-limit verdict', () => {
    stored(0, 0)
    bus.tempoOffset.set('T1', 2, -2)
    expect(nudge).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the value has not changed — no empty undo entry', () => {
    stored(1, 2)
    bus.tempoOffset.set('T1', 1, 2)
    expect(nudge).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐ a REFUSED nudge repaints nothing — the page limit is the engine\'s call, and it stands', () => {
    nudge.mockReturnValue(false)
    bus.tempoOffset.set('T1', 99, 99)
    expect(nudge).toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('stops listening once destroyed', () => {
    controller.destroy()
    bus.tempoOffset.set('T1', 5, 5)
    expect(nudge).not.toHaveBeenCalled()
  })
})
