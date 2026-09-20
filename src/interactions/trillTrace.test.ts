/**
 * {@link traceTrillHandVsInk} / {@link endTrillHandTrace} — ⏱ temporary tracing, so what is pinned is
 * only what must hold while it lives: it is SILENT and reads nothing with debugging off (it sits on
 * a drag's per-frame path), and with it on it reports the gesture's cumulative residual.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const debug = vi.hoisted(() => ({ dbg: vi.fn(), debugEnabled: vi.fn(() => false) }))
vi.mock('../utils/debug', () => debug)

import { traceTrillHandVsInk, endTrillHandTrace } from './trillTrace'

function fakeEngine(inkX: { value: number | null }) {
  const registry = {
    getByType: vi.fn(() => (inkX.value === null ? [] : [{ id: 't1', bbox: { x: inkX.value, y: 0, width: 10, height: 10 } }])),
  }
  return {
    getElementRegistry: vi.fn(() => registry),
    getTrillById: vi.fn(() => null),
    getNote: vi.fn(() => null),
    getScore: vi.fn(() => ({ measures: [] })),
  }
}
type Engine = Parameters<typeof traceTrillHandVsInk>[0]
const lastLine = () => debug.dbg.mock.calls[debug.dbg.mock.calls.length - 1][0] as string

describe('trillTrace — the hand-vs-ink comparison', () => {
  beforeEach(() => {
    debug.dbg.mockClear()
    debug.debugEnabled.mockReturnValue(false)
    endTrillHandTrace()
  })

  it('with debugging OFF it reads nothing and says nothing — it is on a drag\'s frame path', () => {
    const engine = fakeEngine({ value: 100 })
    traceTrillHandVsInk(engine as unknown as Engine, 't1', 50)
    expect(engine.getElementRegistry).not.toHaveBeenCalled()
    expect(debug.dbg).not.toHaveBeenCalled()
  })

  it('reports the cumulative RESIDUAL, and counts a frame that moved the hand alone', () => {
    debug.debugEnabled.mockReturnValue(true)
    const ink = { value: 100 as number | null }
    const engine = fakeEngine(ink) as unknown as Engine
    traceTrillHandVsInk(engine, 't1', 50)  // the grab
    ink.value = 104
    traceTrillHandVsInk(engine, 't1', 60)  // hand +10, ink +4
    traceTrillHandVsInk(engine, 't1', 65)  // hand +5, ink +0
    const last = lastLine()
    expect(last).toContain('RESIDUAL 11.0px')
    expect(last).toContain('1/2 frames moved the HAND and not the INK')

    endTrillHandTrace()
    expect(lastLine()).toContain('gesture ends')
  })

  it('says so when nothing was drawn, instead of comparing against a guess', () => {
    debug.debugEnabled.mockReturnValue(true)
    traceTrillHandVsInk(fakeEngine({ value: null }) as unknown as Engine, 't1', 50)
    expect(debug.dbg.mock.calls[0][0]).toContain('nothing drawn')
  })
})
