/** Subject: `./beamBody` — dragging a beam's own ink moves the whole beam (his ask, 2026-09-28). */
import { describe, expect, it, vi } from 'vitest'
import { ElementRegistry } from '@/engine/ElementRegistry'
import { beamLineBand } from '@/engine/rendering/beams/beamHitInk'
import type { DragHost } from './gesture'
import { beginBeamBodyDrag } from './beamBody'

const SP = 10
/** A stems-up beam over two stems of 4 and 3 spaces: the whole beam may give ½ space toward the heads. */
function setUp(offset = { start: 0, end: 0 }) {
  const registry = new ElementRegistry()
  registry.add({
    type: 'beamGroup', noteId: 'n1', measure: 1, staff: 0,
    points: beamLineBand({ startX: 100, startY: 50, endX: 140, endY: 50 }, 5), bbox: { x: 100, y: 50, width: 40, height: 5 },
  })
  registry.add({ type: 'stem', noteId: 'n1', measure: 1, staff: 0, bbox: { x: 100, y: 50, width: 1.5, height: 40 } })
  registry.add({ type: 'stem', noteId: 'n2', measure: 1, staff: 0, bbox: { x: 139, y: 50, width: 1.5, height: 30 } })
  vi.spyOn(registry, 'getStaffGeometry').mockReturnValue({ lineSpacing: SP } as never)
  const written: [number, number][] = []
  const engine = {
    getElementRegistry: () => registry,
    beam: {
      offsetOf: () => offset,
      previewBeamOffset: vi.fn((_id: string, start: number, end: number) => { written.push([start, end]); return true }),
      commitBeamDrag: vi.fn(),
    },
  }
  const host = { getEngine: () => engine, render: { renderScore: vi.fn(), previewMarks: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  return { engine, host: host as unknown as DragHost & typeof host, written }
}

describe('beginBeamBodyDrag', () => {
  it('a press that does not travel stays a click — nothing written, nothing recorded', () => {
    const { host, engine, written } = setUp()
    const drag = beginBeamBodyDrag(host, 'n1', 50)!
    expect(drag.move(engine as never, 120, 53)).toBe(false)
    drag.end()
    expect(written).toEqual([])
    expect(engine.beam.commitBeamDrag).not.toHaveBeenCalled()
  })

  it('⭐ both ends follow the hand together — the angle kept — and the drop records ONE entry', () => {
    const { host, engine, written } = setUp({ start: 0.5, end: -0.5 })
    const drag = beginBeamBodyDrag(host, 'n1', 50)!
    drag.move(engine as never, 120, 40) // 1 space up = away for a beam above its stems
    drag.move(engine as never, 120, 30)
    drag.end()
    expect(written).toEqual([[1.5, 0.5], [2.5, 1.5]])
    expect(engine.beam.commitBeamDrag).toHaveBeenCalledTimes(1)
  })

  it('⭐ toward the heads it stops where the SHORTEST stem reaches its floor', () => {
    const { host, engine, written } = setUp()
    const drag = beginBeamBodyDrag(host, 'n1', 50)!
    drag.move(engine as never, 120, 200)
    expect(written).toEqual([[-0.5, -0.5]])
  })
})
