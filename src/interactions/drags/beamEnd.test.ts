/** Subject: `./beamEnd` — dragging a square of a selected beam tilts it (his ask, 2026-09-28). */
import { describe, expect, it, vi } from 'vitest'
import { ElementRegistry, type ElementInfo } from '@/engine/ElementRegistry'
import { beamLineBand } from '@/engine/rendering/beams/beamHitInk'
import type { DragHost } from './gesture'
import { beginBeamEndDrag } from './beamEnd'

const SP = 10
/** A stems-up beam over two stems, each 4 spaces long: floor for one end = 2.5 − 4 = −1.5 sp. */
function setUp(offset = { start: 0, end: 0 }) {
  const registry = new ElementRegistry()
  const lines: ElementInfo[] = [{
    type: 'beamGroup', noteId: 'n1', measure: 1, staff: 0,
    points: beamLineBand({ startX: 100, startY: 50, endX: 140, endY: 50 }, 5), bbox: { x: 100, y: 50, width: 40, height: 5 },
  }]
  for (const l of lines) registry.add(l)
  registry.add({ type: 'stem', noteId: 'n1', measure: 1, staff: 0, bbox: { x: 100, y: 50, width: 1.5, height: 40 } })
  registry.add({ type: 'stem', noteId: 'n2', measure: 1, staff: 0, bbox: { x: 139, y: 50, width: 1.5, height: 40 } })
  vi.spyOn(registry, 'getStaffGeometry').mockReturnValue({ lineSpacing: SP } as never)
  const written: [string, number][] = []
  const engine = {
    getElementRegistry: () => registry,
    beam: {
      offsetOf: () => offset,
      previewBeamEnd: vi.fn((_id: string, which: string, away: number) => { written.push([which, away]); return true }),
      commitBeamEndDrag: vi.fn(),
    },
  }
  const host = { getEngine: () => engine, render: { renderScore: vi.fn(), previewMarks: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  return { engine, host: host as unknown as DragHost & typeof host, written }
}

describe('beginBeamEndDrag', () => {
  it('a press that has not travelled is still a click — nothing written', () => {
    const { host, written, engine } = setUp()
    const drag = beginBeamEndDrag(host, 'n1', 'end', 50)!
    expect(drag.move(engine as never, 140, 52)).toBe(false)
    drag.end()
    expect(written).toEqual([])
    expect(engine.beam.commitBeamEndDrag).not.toHaveBeenCalled()
  })

  it('⭐ screen-UP is AWAY for a beam above its stems; each frame writes where the hand is; the drop commits ONCE', () => {
    const { host, written, engine } = setUp({ start: 0, end: 0.5 })
    const drag = beginBeamEndDrag(host, 'n1', 'end', 50)!
    drag.move(engine as never, 140, 40) // 1 space up
    drag.move(engine as never, 140, 30) // 2 spaces up
    drag.end()
    expect(written).toEqual([['end', 1.5], ['end', 2.5]])
    expect(engine.beam.commitBeamEndDrag).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalled()
  })

  it('⭐ toward the heads it stops at the FLOOR read at the press — however far the hand goes', () => {
    const { host, written, engine } = setUp()
    const drag = beginBeamEndDrag(host, 'n1', 'start', 50)!
    drag.move(engine as never, 100, 150) // 10 spaces down: toward the heads
    expect(written).toEqual([['start', -1.5]])
  })

  it('a gesture that wanders and comes back records nothing', () => {
    const { host, engine } = setUp()
    const drag = beginBeamEndDrag(host, 'n1', 'end', 50)!
    drag.move(engine as never, 140, 40)
    drag.move(engine as never, 140, 50)
    drag.end()
    expect(engine.beam.commitBeamEndDrag).not.toHaveBeenCalled()
  })
})
