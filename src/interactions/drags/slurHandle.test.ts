/**
 * **The slur's control-point drag, as a gesture** — the grabbed dot is wherever the hand is, the
 * other stays where the press found it, and the shape is written in staff-spaces for the segment
 * the handle belongs to.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ElementInfo } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import { cpsFromDrawnControlPoints } from '../slurHandleNudge'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'
import { beginSlurHandleDrag } from './slurHandle'

describe('beginSlurHandleDrag', () => {
  const slurEndpoints = { p0: { x: 100, y: 200 }, p1: { x: 300, y: 200 }, direction: -1 }
  const controlPoints: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 150, y: 170 }, { x: 250, y: 170 }]
  const handle = (over: Partial<ElementInfo> = {}) =>
    ({ cpIndex: 0, slurEndpoints, controlPoints, staffSpacePx: 10, ...over }) as ElementInfo

  const preview = vi.fn<MusicEngine['previewSlurShape']>(() => true)
  const commit = vi.fn()
  const engine = { previewSlurShape: preview, commitSlurShape: commit } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    preview.mockReturnValue(true)
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })
  afterEach(() => vi.useRealTimers())

  const grab = (h: ElementInfo) => {
    const drag = beginSlurHandleDrag(host, 'S1', h)!
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }

  it('⛔ DECLINES when the handle does not carry what a reshape needs', () => {
    expect(beginSlurHandleDrag(host, 'S1', handle({ cpIndex: undefined }))).toBeNull()
    expect(beginSlurHandleDrag(host, 'S1', handle({ slurEndpoints: undefined }))).toBeNull()
  })

  it('⛔ a CLICK is still a click — nothing is written inside the time threshold', () => {
    beginSlurHandleDrag(host, 'S1', handle())!.move!(engine, 160, 150)
    expect(preview).not.toHaveBeenCalled()
  })

  it('⭐ the grabbed dot goes where the hand IS, in STAFF-SPACES; the other stays as the press found it', () => {
    const baseline = cpsFromDrawnControlPoints(controlPoints, slurEndpoints)
    grab(handle()).move!(engine, 160, 150)
    // cp0: x − p0.x − (p1.x − p0.x)/4 = 160 − 100 − 50 = 10px; y: (150 − 200) × −1 = 50px
    expect(preview).toHaveBeenCalledWith(
      'S1', [{ x: 1, y: 5 }, { x: baseline[1].x / 10, y: baseline[1].y / 10 }], undefined, undefined)
  })

  it('…and the SECOND dot is measured from the far end', () => {
    const baseline = cpsFromDrawnControlPoints(controlPoints, slurEndpoints)
    grab(handle({ cpIndex: 1 })).move!(engine, 270, 160)
    // cp1: x − p1.x + 50 = 20px; y: (160 − 200) × −1 = 40px
    expect(preview).toHaveBeenCalledWith(
      'S1', [{ x: baseline[0].x / 10, y: baseline[0].y / 10 }, { x: 2, y: 4 }], undefined, undefined)
  })

  it('⭐ a SMALL staff writes a bigger number for the same pixels', () => {
    grab(handle({ staffSpacePx: 5 })).move!(engine, 160, 150)
    expect(preview.mock.calls[0][1][0]).toEqual({ x: 2, y: 10 })
  })

  it('⭐ a cross-system slur\'s handle reshapes ITS segment, with the live span count', () => {
    grab(handle({ segmentRole: 'middle', segmentOrdinal: 2, slurSpanCount: 4 })).move!(engine, 160, 150)
    expect(preview.mock.calls[0].slice(2)).toEqual([{ role: 'middle', ordinal: 2 }, 4])
    preview.mockClear()
    grab(handle({ segmentRole: 'begin', slurSpanCount: 2 })).move!(engine, 160, 150)
    expect(preview.mock.calls[0].slice(2)).toEqual([{ role: 'begin' }, 2])
  })

  it('an accepted frame renders the score (the handles move); a refused one draws nothing', () => {
    const drag = grab(handle())
    drag.move!(engine, 160, 150)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
    preview.mockReturnValue(false)
    drag.move!(engine, 170, 150)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
  })

  it('the drop records ONE undo entry if the shape changed, none otherwise — and always releases', () => {
    const drag = grab(handle())
    drag.move!(engine, 160, 150)
    drag.move!(engine, 165, 150)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)

    beginSlurHandleDrag(host, 'S1', handle())!.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(2)
  })
})
