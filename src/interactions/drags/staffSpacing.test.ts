/**
 * **The staff-spacing drag, as a gesture** — above all its SCALE: the grabbed staff's own line
 * spacing, measured at the press, so a pixel of hand is a pixel of staff on a small staff too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'
import { beginStaffSpacingDrag } from './staffSpacing'

describe('beginStaffSpacingDrag', () => {
  let lineSpacing: number | undefined
  let stored: number
  const preview = vi.fn<(staff: number, measure: number, above: number) => boolean>(() => true)
  const commit = vi.fn()
  const geometryAsked = vi.fn()
  const engine = {
    getStaffSpacingAbove: () => stored,
    getElementRegistry: () => ({
      getStaffGeometry: (measure: number, staff: number) => {
        geometryAsked(measure, staff)
        return lineSpacing === undefined ? undefined : { lineSpacing }
      },
    }),
    previewStaffSpacing: preview,
    commitStaffSpacing: commit,
  } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    preview.mockReturnValue(true)
    lineSpacing = 10
    stored = 2
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn() }
  })
  afterEach(() => vi.useRealTimers())

  const grab = (staff = 1, measure = 5) => {
    const drag = beginStaffSpacingDrag(host, staff, measure, 300)!
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }

  it('the space is the BASELINE plus the hand\'s travel since the press, in staff-spaces', () => {
    const drag = grab()
    drag.move!(engine, 0, 330) // +30px down at 10px per space, on top of the 2 already there
    expect(preview).toHaveBeenCalledWith(1, 5, 5)
    drag.move!(engine, 0, 290) // measured from the PRESS again, ⛔ not from the last frame
    expect(preview).toHaveBeenLastCalledWith(1, 5, 1)
  })

  it('⭐⭐ the scale is the GRABBED staff\'s own spacing — a small staff follows the hand 1:1', () => {
    lineSpacing = 7.5
    const drag = grab(1, 5)
    expect(geometryAsked).toHaveBeenCalledWith(5, 1)
    drag.move!(engine, 0, 330) // the same 30px is 4 of THIS staff's spaces, not 3
    expect(preview).toHaveBeenCalledWith(1, 5, 6)
  })

  it('⭐ …measured ONCE, at the press — what the registry says later is not this gesture\'s scale', () => {
    lineSpacing = 7.5
    const drag = grab()
    lineSpacing = 10
    drag.move!(engine, 0, 330)
    expect(preview).toHaveBeenCalledWith(1, 5, 6)
  })

  it('a staff nothing has measured yet falls back to a full-size staff\'s spacing', () => {
    lineSpacing = undefined
    grab().move!(engine, 0, 330)
    expect(preview).toHaveBeenCalledWith(1, 5, 5)
  })

  it('⛔ a CLICK is still a click — nothing is written inside the time threshold', () => {
    beginStaffSpacingDrag(host, 1, 5, 300)!.move!(engine, 0, 360)
    expect(preview).not.toHaveBeenCalled()
  })

  it('an accepted frame renders the score; a refused one (the clamp) draws nothing', () => {
    const drag = grab()
    drag.move!(engine, 0, 330)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
    preview.mockReturnValue(false)
    drag.move!(engine, 0, 900)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
  })

  it('the drop records ONE undo entry — and NONE for a press that only wiggled sideways', () => {
    const drag = grab()
    drag.move!(engine, 0, 320)
    drag.move!(engine, 0, 340)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)

    const tap = grab()
    tap.move!(engine, 40, 300) // sideways: the space is still the baseline
    tap.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(2)
  })
})
