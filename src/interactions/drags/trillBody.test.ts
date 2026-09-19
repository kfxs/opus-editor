/**
 * **The trill's BODY drag, as a gesture** — what is this row's own: it declines without a measured
 * scale, measures the ornament's music at the press and forgets it at the end, settles a
 * rung-change, and commits the START. The frame it runs in is `heldDrag.test.ts`; the walk itself
 * is `trillWalk.test.ts`.
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
