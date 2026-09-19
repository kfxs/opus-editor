/**
 * **The tempo mark's drag, as a gesture** — the GRAB (the hand carries the mark's anchor, as an
 * absolute reference), the vertical delta from the last accepted frame, and the drop. The snap
 * itself is `tempoDrag.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const snap = vi.hoisted(() => ({
  dragTempo: vi.fn(),
  tempoAnchorXOf: vi.fn<() => number | null>(() => 160),
}))
vi.mock('../tempoDrag', () => snap)

import { beginTempoDrag } from './tempo'

describe('beginTempoDrag', () => {
  const commit = vi.fn()
  const engine = { commitTempoDrag: commit } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    snap.tempoAnchorXOf.mockReturnValue(160)
    snap.dragTempo.mockReturnValue({ moved: true, inkPx: 0 })
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })
  afterEach(() => vi.useRealTimers())

  /** Press, hold, and take the baseline with the pointer at (200, 100) — 40px right of the anchor. */
  const grab = () => {
    const drag = beginTempoDrag(host, 'T1', () => null)
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    drag.move(engine, 200, 100)
    return drag
  }
  const asked = () => snap.dragTempo.mock.calls.map(c => [c[2], c[3]])

  it('⛔ a CLICK is still a click, and the baseline frame asks nothing of the snap', () => {
    const drag = beginTempoDrag(host, 'T1', () => null)
    drag.move(engine, 260, 100)
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    drag.move(engine, 200, 100)
    expect(snap.dragTempo).not.toHaveBeenCalled()
  })

  it('⭐⭐ THE HAND CARRIES THE ANCHOR: the snap is asked where the ANCHOR would be, ⛔ not the pointer', () => {
    const drag = grab()
    drag.move(engine, 230, 100)
    expect(asked()).toEqual([[190, 0]]) // 230 − the 40px grab
  })

  it('⭐ …an ABSOLUTE reference — refused frames do not make it drift', () => {
    snap.dragTempo.mockReturnValue({ moved: false, inkPx: 0 })
    const drag = grab()
    drag.move(engine, 230, 100)
    drag.move(engine, 260, 100)
    expect(asked().map(a => a[0])).toEqual([190, 220])
  })

  it('⚠️ the VERTICAL is a delta from the last ACCEPTED frame', () => {
    snap.dragTempo.mockReturnValueOnce({ moved: false, inkPx: 0 })
    const drag = grab()
    drag.move(engine, 200, 110) // refused
    drag.move(engine, 200, 125) // still measured from 100
    drag.move(engine, 200, 130) // accepted at 125 → 5
    expect(asked().map(a => a[1])).toEqual([10, 25, 5])
  })

  it('with no anchor to measure, the grab is 0 and the frames measure from the pointer', () => {
    snap.tempoAnchorXOf.mockReturnValue(null)
    const drag = grab()
    drag.move(engine, 230, 100)
    expect(asked()).toEqual([[230, 0]])
  })

  it('an accepted frame previews the TEMPO family; a refused one and an undrawn mark draw nothing', () => {
    snap.dragTempo.mockReturnValueOnce({ moved: true, inkPx: 3 })
      .mockReturnValueOnce({ moved: false, inkPx: 0 }).mockReturnValueOnce(null)
    const drag = grab()
    drag.move(engine, 210, 100)
    drag.move(engine, 220, 100)
    drag.move(engine, 230, 100)
    expect(host.render.previewMarks).toHaveBeenCalledTimes(1)
    expect(host.render.previewMarks).toHaveBeenCalledWith('tempo', 'T1')
  })

  it('the drop records ONE undo entry and renders for real; a press that stayed a click records none', () => {
    const drag = grab()
    drag.move(engine, 210, 100)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)

    beginTempoDrag(host, 'T1', () => null).end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(2)
  })
})
