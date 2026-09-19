/**
 * **The frame a latching drag runs in** — the hold's ledger, the last accepted anchor, the second
 * draw, and the wrap that ends the gesture from inside a frame. Its rows are `markEnd.test.ts` (by
 * way of `MouseController.markEndDrag.test.ts`) and `trillBody.test.ts`; the ledger's arithmetic is
 * `dragHold.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { beginHeldDrag, type HeldDragSpec, type HeldFrame } from './heldDrag'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const engine = {} as MusicEngine
const FRAME = { moved: true, wrapped: false, crossings: 0, latched: false, droppedPx: 0, gapAheadPx: 0 }

describe('beginHeldDrag', () => {
  let order: string[]
  let step: ReturnType<typeof vi.fn<(e: MusicEngine, x: number, dx: number, dy: number) => HeldFrame>>
  let host: DragHost
  let spec: HeldDragSpec

  beforeEach(() => {
    vi.useFakeTimers()
    order = []
    step = vi.fn(() => FRAME)
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
      kind: 'markEnd', family: 'ottava', label: 'Ottava end', id: 'O1', step,
      commit: vi.fn(() => { order.push('commit') }),
      done: vi.fn(() => { order.push('done') }),
    }
  })
  afterEach(() => vi.useRealTimers())

  const grab = () => {
    const drag = beginHeldDrag(host, spec, 100, 50)
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }
  const deltas = () => step.mock.calls.map(c => [c[2], c[3]])

  it('⛔ a CLICK is still a click — no frame runs inside the time threshold', () => {
    const drag = beginHeldDrag(host, spec, 100, 50)
    drag.move!(engine, 160, 90)
    expect(step).not.toHaveBeenCalled()
  })

  it('each frame carries the delta since the last ACCEPTED one, and draws its family only', () => {
    const drag = grab()
    drag.move!(engine, 110, 50)
    drag.move!(engine, 130, 44)
    expect(deltas()).toEqual([[10, 0], [20, -6]])
    expect(order).toEqual(['preview:ottava:O1', 'preview:ottava:O1'])
  })

  it('🚨 a REFUSED frame leaves the anchor put and draws nothing — but is still TRACED', () => {
    step.mockReturnValue({ ...FRAME, moved: false })
    spec.trace = vi.fn()
    const drag = grab()
    drag.move!(engine, 130, 50)
    drag.move!(engine, 140, 50)
    expect(deltas()).toEqual([[30, 0], [40, 0]])
    expect(order).toEqual([])
    expect(spec.trace).toHaveBeenCalledTimes(2)
  })

  it('⛔ a mark that is not drawn (null) drops the frame and leaves the anchor alone', () => {
    step.mockReturnValueOnce(null)
    const drag = grab()
    drag.move!(engine, 130, 50)
    drag.move!(engine, 140, 50)
    expect(deltas()).toEqual([[30, 0], [40, 0]])
  })

  it('⭐ THE HOLD: after a latch the hand moves and the mark does not — then it is paid back', () => {
    step.mockReturnValueOnce({ ...FRAME, latched: true, droppedPx: 6, gapAheadPx: 40 })
    const drag = grab()
    drag.move!(engine, 120, 50) // latches: the hold is min(0.8 × 40, 30) = 30px
    drag.move!(engine, 130, 50) // …absorbed whole
    drag.move!(engine, 140, 50)
    drag.move!(engine, 150, 50)
    expect(step, 'a frame the ledger swallows never reaches the walk').toHaveBeenCalledTimes(1)

    drag.move!(engine, 160, 50) // the hold is spent; +10px of hand…
    // 10 of hand + 30 repaid at the derived gain (hold 30 of a 40 gap ⇒ G = 4). ⛔ Had a swallowed
    // frame NOT advanced the anchor, the third move would have carried 30 and reached the walk.
    expect(deltas()[1][0]).toBe(40)
  })

  it('⛔ the VERTICAL is never held — the hand can still lift the mark while an anchor has it', () => {
    step.mockReturnValueOnce({ ...FRAME, latched: true, droppedPx: 0, gapAheadPx: 40 })
    const drag = grab()
    drag.move!(engine, 120, 50)
    drag.move!(engine, 125, 30) // 5px across is absorbed; 20px up is not
    expect(deltas()[1]).toEqual([0, -20])
  })

  it('⭐ a fresh ledger per gesture: a hold taken in one drag swallows nothing of the next', () => {
    step.mockReturnValueOnce({ ...FRAME, latched: true, droppedPx: 0, gapAheadPx: 40 })
    const first = grab()
    first.move!(engine, 120, 50)
    first.end()
    step.mockClear()

    const second = grab()
    second.move!(engine, 110, 50)
    expect(deltas()).toEqual([[10, 0]])
  })

  it('⭐ `afterFrame` runs after the draw, and a second write is drawn in the same event', () => {
    spec.afterFrame = () => true
    const drag = grab()
    drag.move!(engine, 110, 50)
    expect(order).toEqual(['preview:ottava:O1', 'preview:ottava:O1'])
  })

  it('⭐⭐ a WRAP ends the gesture from inside the frame — and the release that follows finds it over', () => {
    step.mockReturnValue({ ...FRAME, wrapped: true })
    const drag = grab()
    drag.move!(engine, 110, 50)
    expect(order).toEqual(['preview:ottava:O1', 'commit', 'render', 'done', 'release'])

    drag.move!(engine, 150, 50) // the hand is still down and still moving
    drag.end()                  // …and then comes up
    expect(step).toHaveBeenCalledTimes(1)
    expect(spec.commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(1)
  })

  it("⭐ `family: 'score'` renders the SCORE each frame — and the drop draws nothing more", () => {
    spec.family = 'score'
    const drag = grab()
    drag.move!(engine, 110, 50)
    drag.move!(engine, 120, 50)
    expect(order).toEqual(['render', 'render'])
    order.length = 0
    drag.end()
    expect(order).toEqual(['commit', 'done', 'release']) // ⛔ no third render: the last frame IS the picture
  })

  it('⛔ a press that never became a drag records nothing — but is still done, and releases', () => {
    const drag = beginHeldDrag(host, spec, 100, 50)
    drag.end()
    expect(order).toEqual(['done', 'release'])
  })
})
