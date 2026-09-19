/**
 * **The trill's BODY drag, as a gesture** — what the frame does around `trillWalk.dragTrillBody`:
 * the click threshold, the last accepted anchor, the hold's ledger, the second draw after a
 * rung-change, and the wrap that ends the gesture from inside a frame. The walk itself is
 * `trillWalk.test.ts`; the ledger's arithmetic is `dragHold.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const walk = vi.hoisted(() => ({
  dragTrillBody: vi.fn(),
  settleTrillLanding: vi.fn(() => false),
  beginTrillBodySpan: vi.fn(),
  endTrillBodySpan: vi.fn(),
  endTrillHandTrace: vi.fn(),
  traceTrillHandVsInk: vi.fn(),
}))
const lane = vi.hoisted(() => ({ trillStaffSpacePx: vi.fn<() => number | null>(() => 10) }))
vi.mock('../trillWalk', () => walk)
vi.mock('../trillLane', () => lane)

import { beginTrillBodyDrag } from './trillBody'

const FRAME = { moved: true, jumped: false, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0 }

describe('beginTrillBodyDrag', () => {
  let order: string[]
  let host: DragHost
  const commit = vi.fn(() => { order.push('commit') })
  const engine = { getElementRegistry: () => ({}), commitTrillDrag: commit } as unknown as MusicEngine

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    order = []
    lane.trillStaffSpacePx.mockReturnValue(10)
    walk.dragTrillBody.mockReturnValue(FRAME)
    walk.settleTrillLanding.mockReturnValue(false)
    host = {
      getEngine: () => engine,
      render: {
        previewMarks: vi.fn((kind, id) => { order.push(`preview:${kind}:${id}`) }),
        renderScore: vi.fn(() => { order.push('render') }),
      },
      release: vi.fn(() => { order.push('release') }),
    }
  })
  afterEach(() => vi.useRealTimers())

  const grab = () => {
    const drag = beginTrillBodyDrag(host, 'T1', 100, 50)!
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }
  const deltas = () => walk.dragTrillBody.mock.calls.map(c => [c[3], c[4]])

  it('⛔ DECLINES to arm when the ornament is not measurably drawn — and measures nothing', () => {
    lane.trillStaffSpacePx.mockReturnValue(null)
    expect(beginTrillBodyDrag(host, 'T1', 100, 50)).toBeNull()
    expect(walk.beginTrillBodySpan).not.toHaveBeenCalled()
  })

  it('⭐ measures the ornament\'s MUSIC at the PRESS, ⛔ not on the first frame', () => {
    beginTrillBodyDrag(host, 'T1', 100, 50)
    expect(walk.beginTrillBodySpan).toHaveBeenCalledWith(engine, 'T1')
    expect(walk.dragTrillBody).not.toHaveBeenCalled()
  })

  it('⛔ a CLICK is still a click — no frame runs inside the time threshold', () => {
    const drag = beginTrillBodyDrag(host, 'T1', 100, 50)!
    drag.move!(engine, 160, 90)
    expect(walk.dragTrillBody).not.toHaveBeenCalled()
  })

  it('each frame carries the delta since the last ACCEPTED one, and draws the trills', () => {
    const drag = grab()
    drag.move!(engine, 110, 50)
    drag.move!(engine, 130, 44)
    expect(deltas()).toEqual([[10, 0], [20, -6]])
    expect(order).toEqual(['preview:trill:T1', 'preview:trill:T1'])
  })

  it('🚨 a REFUSED frame leaves the anchor put — and is still TRACED, which is the whole point of the trace', () => {
    walk.dragTrillBody.mockReturnValue({ ...FRAME, moved: false })
    const drag = grab()
    drag.move!(engine, 130, 50)
    drag.move!(engine, 140, 50)
    expect(deltas()).toEqual([[30, 0], [40, 0]])
    expect(order).toEqual([])
    expect(walk.traceTrillHandVsInk).toHaveBeenCalledTimes(2)
  })

  it('⭐ THE HOLD: after a latch the hand moves and the ornament does not — then it is paid back', () => {
    walk.dragTrillBody.mockReturnValueOnce({ ...FRAME, latched: true, droppedPx: 6, gapAheadPx: 40 })
    const drag = grab()
    drag.move!(engine, 120, 50) // latches: the hold is min(0.8 × 40, 30) = 30px
    drag.move!(engine, 130, 50) // …absorbed whole
    drag.move!(engine, 140, 50)
    drag.move!(engine, 150, 50)
    expect(walk.dragTrillBody, 'a frame the ledger swallows never reaches the walk').toHaveBeenCalledTimes(1)

    drag.move!(engine, 160, 50) // the hold is spent; +10px of hand…
    const [dx] = deltas()[1]
    expect(dx, '…arrives as MORE than 10: the catch-up hands the absorbed pixels back').toBeGreaterThan(10)
  })

  it('⭐ a RUNG-CHANGE that settles is drawn a second time, inside the same event', () => {
    walk.dragTrillBody.mockReturnValue({ ...FRAME, jumped: true })
    walk.settleTrillLanding.mockReturnValue(true)
    const drag = grab()
    drag.move!(engine, 100, 20)
    expect(order).toEqual(['preview:trill:T1', 'preview:trill:T1'])
  })

  it('⭐⭐ a WRAP ends the gesture from inside the frame — and the release that follows finds it over', () => {
    walk.dragTrillBody.mockReturnValue({ ...FRAME, wrapped: true })
    const drag = grab()
    drag.move!(engine, 110, 50)
    expect(order).toEqual(['preview:trill:T1', 'commit', 'render', 'release'])
    expect(commit).toHaveBeenCalledWith('start')

    drag.move!(engine, 150, 50) // the hand is still down and still moving
    drag.end()                  // …and then comes up
    expect(walk.dragTrillBody).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(1)
  })

  it('the drop: ONE undo entry, a REAL render, the span forgotten, the release', () => {
    const drag = grab()
    drag.move!(engine, 110, 50)
    drag.move!(engine, 120, 50)
    order.length = 0
    drag.end()
    expect(order).toEqual(['commit', 'render', 'release'])
    expect(walk.endTrillBodySpan).toHaveBeenCalledTimes(1)
  })

  it('⛔ a press that never became a drag records nothing — but forgets its span and releases', () => {
    const drag = beginTrillBodyDrag(host, 'T1', 100, 50)!
    drag.end()
    expect(order).toEqual(['release'])
    expect(walk.endTrillBodySpan).toHaveBeenCalledTimes(1)
  })
})
