/**
 * **The slur's BODY drag, as a gesture** — the row it hands `beginBodyDrag`: the scale measured at
 * the press, the cursor's delta converted with it, and a refusal leaving the anchor put. The
 * arithmetic itself is `slurBodyDrag.test.ts`; the shared frame is `bodyDrag.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'
import { beginSlurBodyDrag } from './slurBody'

describe('beginSlurBodyDrag', () => {
  let staffSpacePx: number | undefined
  const preview = vi.fn<(id: string, dx: number, dy: number) => boolean>(() => true)
  const commit = vi.fn()
  const engine = {
    getElementRegistry: () => ({
      getByType: () => [{ id: 'S1', type: 'slur', staffSpacePx }],
      getStaffGeometry: () => undefined,
    }),
    previewSlurOffset: preview,
    commitSlurOffsetDrag: commit,
  } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    preview.mockReturnValue(true)
    staffSpacePx = 10
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })
  afterEach(() => vi.useRealTimers())

  const grab = () => {
    const drag = beginSlurBodyDrag(host, 'S1', 200, 100)!
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }

  it('⛔ DECLINES to arm when the drawn curve offers no measured scale', () => {
    staffSpacePx = undefined
    expect(beginSlurBodyDrag(host, 'S1', 200, 100)).toBeNull()
  })

  it('⭐ a frame writes the cursor\'s delta in STAFF-SPACES, and redraws the slurs', () => {
    const drag = grab()
    drag.move!(engine, 230, 80) // +30px, −20px at 10px per staff-space
    expect(preview).toHaveBeenCalledWith('S1', 3, -2)
    expect(host.render.previewMarks).toHaveBeenCalledWith('slur', 'S1')
  })

  it('⭐ the scale is the one measured at the PRESS — a small staff writes a bigger number', () => {
    staffSpacePx = 7.5
    const drag = grab()
    staffSpacePx = 10 // whatever the registry says later is not this gesture's scale
    drag.move!(engine, 230, 100)
    expect(preview).toHaveBeenCalledWith('S1', 4, 0)
  })

  it('each frame moves by the delta since the LAST accepted one — the write accumulates', () => {
    const drag = grab()
    drag.move!(engine, 210, 100)
    drag.move!(engine, 230, 100)
    expect(preview.mock.calls).toEqual([['S1', 1, 0], ['S1', 2, 0]])
  })

  it('🚨 a REFUSED frame (the page or band limit) leaves the anchor put, and draws nothing', () => {
    preview.mockReturnValue(false)
    const drag = grab()
    drag.move!(engine, 230, 100)
    drag.move!(engine, 240, 100)
    expect(preview.mock.calls).toEqual([['S1', 3, 0], ['S1', 4, 0]]) // ⛔ not [3, 1]
    expect(host.render.previewMarks).not.toHaveBeenCalled()
  })

  it('⛔ a move that goes nowhere writes nothing', () => {
    const drag = grab()
    drag.move!(engine, 200, 100)
    expect(preview).not.toHaveBeenCalled()
  })

  it('the drop records ONE undo entry and renders for real; a bare press records none', () => {
    const drag = grab()
    drag.move!(engine, 210, 100)
    drag.move!(engine, 220, 100)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)

    beginSlurBodyDrag(host, 'S1', 200, 100)!.end()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
