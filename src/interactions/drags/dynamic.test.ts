/**
 * **The dynamic's drag, as a gesture** — the row it hands `beginBodyDrag`: the late baseline (the
 * mark is its own handle), the walk's three answers, and a landing settled after the draw. The
 * frame is `bodyDrag.test.ts`; the walk is `dynamicWalk.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const walk = vi.hoisted(() => ({
  dragDynamic: vi.fn<(...args: unknown[]) => boolean | null>(() => true),
  settleDynamicLanding: vi.fn(() => false),
}))
vi.mock('../dynamicWalk', () => walk)

import { beginDynamicDrag } from './dynamic'

describe('beginDynamicDrag', () => {
  const commit = vi.fn()
  const engine = { commitDynamicDrag: commit } as unknown as MusicEngine
  let host: DragHost
  let previews: number

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    walk.dragDynamic.mockReturnValue(true)
    walk.settleDynamicLanding.mockReturnValue(false)
    previews = 0
    host = {
      getEngine: () => engine,
      render: { previewMarks: vi.fn(() => { previews++ }), renderScore: vi.fn() },
      release: vi.fn(),
    }
  })
  afterEach(() => vi.useRealTimers())

  /** Press, hold past the threshold, and give the gesture its baseline frame at (200, 100). */
  const grab = () => {
    const drag = beginDynamicDrag(host, 'D1')
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    drag.move!(engine, 200, 100)
    return drag
  }

  it('⭐ the baseline is the first frame PAST the threshold — the travel before it is charged to nobody', () => {
    const drag = beginDynamicDrag(host, 'D1')
    drag.move!(engine, 180, 90) // still a click
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    drag.move!(engine, 200, 100) // the baseline: nothing is asked of the walk
    expect(walk.dragDynamic).not.toHaveBeenCalled()
    drag.move!(engine, 212, 95)
    expect(walk.dragDynamic).toHaveBeenCalledWith(engine, 'D1', 212, 12, -5)
  })

  it('an accepted frame MOVES the dynamics (a preview), and advances the anchor', () => {
    const drag = grab()
    drag.move!(engine, 210, 100)
    drag.move!(engine, 225, 100)
    expect(walk.dragDynamic.mock.calls.map(c => c[3])).toEqual([10, 15])
    expect(host.render.previewMarks).toHaveBeenCalledWith('dynamic', 'D1')
  })

  it('🚨 a REFUSAL (false) and an undrawn mark (null) both leave the anchor put, and draw nothing', () => {
    walk.dragDynamic.mockReturnValueOnce(false).mockReturnValueOnce(null)
    const drag = grab()
    drag.move!(engine, 230, 100)
    drag.move!(engine, 240, 100)
    drag.move!(engine, 250, 100)
    expect(walk.dragDynamic.mock.calls.map(c => c[3])).toEqual([30, 40, 50])
    expect(previews).toBe(1)
  })

  it('⭐ a LANDING is settled after the draw, and drawn again inside the same event', () => {
    walk.settleDynamicLanding.mockReturnValue(true)
    const drag = grab()
    drag.move!(engine, 210, 140)
    expect(walk.settleDynamicLanding).toHaveBeenCalledWith(engine, 'D1')
    expect(previews).toBe(2)
  })

  it('the drop records ONE undo entry and renders for real; a press that stayed a click records none', () => {
    const drag = grab()
    drag.move!(engine, 210, 100)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)

    beginDynamicDrag(host, 'D1').end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(2)
  })
})
