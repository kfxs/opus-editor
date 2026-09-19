/**
 * **The frame every body drag shares** — what `beginBodyDrag` does with a family's row, whatever
 * the family. How a press reaches it, and the px→staff-space conversion of a real walk, are
 * `MouseController.hairpinBodyDrag.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { beginBodyDrag, type BodyDragSpec, type BodyFrame } from './bodyDrag'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const engine = {} as MusicEngine

describe('beginBodyDrag', () => {
  let order: string[]
  let step: ReturnType<typeof vi.fn<(e: MusicEngine, id: string, x: number, dx: number, dy: number) => BodyFrame>>
  let host: DragHost
  let spec: BodyDragSpec

  beforeEach(() => {
    vi.useFakeTimers()
    order = []
    step = vi.fn(() => ({ moved: true, jumped: false }))
    host = {
      getEngine: () => engine,
      render: {
        previewMarks: vi.fn((kind, id) => { order.push(`preview:${kind}:${id}`) }),
        renderScore: vi.fn(() => { order.push('render') }),
      },
      release: vi.fn(() => { order.push('release') }),
      setCursor: vi.fn(),
    }
    spec = {
      kind: 'pedalBody', family: 'pedal', label: 'Pedal', step,
      commit: vi.fn(() => { order.push('commit') }),
    }
  })
  afterEach(() => vi.useRealTimers())

  const held = () => vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)

  it('⛔ a CLICK is still a click — no frame runs inside the time threshold', () => {
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    drag.move(engine, 160, 90)
    expect(step).not.toHaveBeenCalled()
  })

  it('hands the walk the cursor and its delta since the last ACCEPTED frame, and draws the family', () => {
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 110, 50)
    drag.move(engine, 130, 45)
    expect(step.mock.calls.map(c => c.slice(1))).toEqual([['P1', 110, 10, 0], ['P1', 130, 20, -5]])
    expect(order).toEqual(['preview:pedal:P1', 'preview:pedal:P1'])
  })

  it('🚨 a REFUSED frame leaves the anchor put, so the gesture re-synchronises — and draws nothing', () => {
    step.mockReturnValue({ moved: false, jumped: false })
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 130, 50)
    drag.move(engine, 140, 50)
    expect(step.mock.calls.map(c => c[3])).toEqual([30, 40]) // ⛔ not [30, 10]
    expect(order).toEqual([])
  })

  it('⛔ a mark that is not drawn (null) drops the frame and leaves the anchor alone', () => {
    step.mockReturnValueOnce(null)
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 130, 50)
    drag.move(engine, 140, 50)
    expect(step.mock.calls.map(c => c[3])).toEqual([30, 40])
  })

  it('⭐ with NO press position the baseline is the first frame PAST the threshold — no opening jump', () => {
    const drag = beginBodyDrag(host, spec, 'P1')
    drag.move(engine, 140, 80) // inside the threshold: charged to nobody
    held()
    drag.move(engine, 150, 85) // the baseline
    drag.move(engine, 160, 85)
    expect(step.mock.calls.map(c => c.slice(1))).toEqual([['P1', 160, 10, 0]])
  })

  it('⭐ `afterFrame` runs after the draw, and a second write is drawn in the same event', () => {
    step.mockReturnValue({ moved: true, jumped: true })
    spec.afterFrame = vi.fn((_e, _id, frame) => { order.push('after'); return frame.jumped })
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 110, 50)
    expect(order).toEqual(['preview:pedal:P1', 'after', 'preview:pedal:P1'])
  })

  it('…and draws once when `afterFrame` wrote nothing', () => {
    spec.afterFrame = () => false
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 110, 50)
    expect(order).toEqual(['preview:pedal:P1'])
  })

  it('⭐ the drop: the settlement, then ONE undo entry, then a REAL render, then the release', () => {
    spec.beforeCommit = vi.fn(() => { order.push('settle') })
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 110, 50)
    drag.move(engine, 120, 50)
    order.length = 0
    drag.end()
    expect(order).toEqual(['settle', 'commit', 'render', 'release'])
  })

  it('⛔ a press that never became a drag records nothing and renders nothing — but still releases', () => {
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    drag.end()
    expect(order).toEqual(['release'])
  })

  it('…and so does a gesture whose every frame was refused', () => {
    step.mockReturnValue({ moved: false, jumped: false })
    const drag = beginBodyDrag(host, spec, 'P1', { x: 100, y: 50 })
    held()
    drag.move(engine, 130, 50)
    drag.end()
    expect(order).toEqual(['release'])
  })
})
