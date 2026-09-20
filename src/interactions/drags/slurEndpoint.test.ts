/**
 * **The slur's ENDPOINT drag, as a gesture** — the row it hands `beginHeldDrag`: what the walk's
 * answer becomes, that a frame renders the score, and what the drop records. The frame (the hold
 * included) is `heldDrag.test.ts`; the walk is `slurEndpointWalk.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { EditorState } from '../EditorState'
import { DRAG_TIME_THRESHOLD_MS, type DragHost } from './gesture'

const walk = vi.hoisted(() => ({ dragArmedSlurEndpoint: vi.fn() }))
vi.mock('../slurEndpointWalk', () => walk)

import { beginSlurEndpointDrag } from './slurEndpoint'

describe('beginSlurEndpointDrag', () => {
  const state = {} as EditorState
  const commit = vi.fn()
  const engine = { slur: { commitSlurEndpoint: commit } } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    walk.dragArmedSlurEndpoint.mockReturnValue({ crossings: 0, gapAhead: 0, latched: false, discarded: 0 })
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })
  afterEach(() => vi.useRealTimers())

  const grab = () => {
    const drag = beginSlurEndpointDrag(host, state, 'S1', 'end', 300, 80)
    vi.advanceTimersByTime(DRAG_TIME_THRESHOLD_MS + 1)
    return drag
  }
  const deltas = () => walk.dragArmedSlurEndpoint.mock.calls.map(c => [c[2], c[3]])

  it('⭐ the gesture starts where the press LANDED: the first frame carries the delta from there', () => {
    const drag = grab()
    drag.move(engine, 312, 74)
    expect(walk.dragArmedSlurEndpoint).toHaveBeenCalledWith(state, engine, 12, -6)
  })

  it('⭐ a frame renders the SCORE — the anchor note\'s tint and the guide line move too', () => {
    const drag = grab()
    drag.move(engine, 312, 80)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
    expect(host.render.previewMarks).not.toHaveBeenCalled()
  })

  it('🚨 the walk answering null is a REFUSAL: the anchor stays put, and nothing is drawn', () => {
    walk.dragArmedSlurEndpoint.mockReturnValue(null)
    const drag = grab()
    drag.move(engine, 330, 80)
    drag.move(engine, 340, 80)
    expect(deltas()).toEqual([[30, 0], [40, 0]])
    expect(host.render.renderScore).not.toHaveBeenCalled()
  })

  it('⭐ a LATCH takes the hold from the walk\'s own report — the next frames are absorbed', () => {
    walk.dragArmedSlurEndpoint.mockReturnValueOnce({ crossings: 1, gapAhead: 40, latched: true, discarded: 4 })
    const drag = grab()
    drag.move(engine, 320, 80) // latches: the hold is 30px
    drag.move(engine, 330, 80)
    drag.move(engine, 340, 80)
    expect(walk.dragArmedSlurEndpoint, 'the note has the ink').toHaveBeenCalledTimes(1)
  })

  it('the drop records ONE undo entry; a bare press records none', () => {
    const drag = grab()
    drag.move(engine, 310, 80)
    drag.move(engine, 320, 80)
    drag.end()
    expect(commit).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalledTimes(1)

    beginSlurEndpointDrag(host, state, 'S1', 'end', 300, 80).end()
    expect(commit).toHaveBeenCalledTimes(1)
  })
})
