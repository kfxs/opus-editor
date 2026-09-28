/** Subject: `./glyphMark` — dragging a symbol moves its hand offset; ONE undo entry on the drop (symbol plan P4). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { DragHost } from './gesture'
import { beginGlyphMarkDrag } from './glyphMark'

describe('beginGlyphMarkDrag', () => {
  const glyphMark = {
    offsetOf: vi.fn(() => ({ x: 0.5, y: 0 })),
    previewOffset: vi.fn(() => true),
    commitDrag: vi.fn(),
  }
  const registry = {
    getById: vi.fn(() => ({ measure: 1, staff: 0 })),
    getStaffGeometry: vi.fn(() => ({ lineSpacing: 10 })),
  }
  const engine = { glyphMark, getElementRegistry: () => registry } as unknown as MusicEngine
  let host: DragHost

  beforeEach(() => {
    vi.clearAllMocks()
    host = { getEngine: () => engine, render: { previewMarks: vi.fn(), renderScore: vi.fn() }, release: vi.fn(), setCursor: vi.fn() }
  })

  it('stays a click inside the dead zone, then follows the pointer in staff spaces from where it stood', () => {
    const drag = beginGlyphMarkDrag(host, 'G1', { x: 100, y: 50 })!
    expect(drag.move(engine, 102, 51)).toBe(false) // still a click
    expect(glyphMark.previewOffset).not.toHaveBeenCalled()
    drag.move(engine, 120, 40) // +2 sp right, -1 sp (up)
    expect(glyphMark.previewOffset).toHaveBeenLastCalledWith('G1', 2.5, -1)
    expect(host.render.renderScore).toHaveBeenCalledTimes(1)
    drag.end()
    expect(glyphMark.commitDrag).toHaveBeenCalledTimes(1)
    expect(host.release).toHaveBeenCalled()
  })

  it('a press that never moved records nothing', () => {
    const drag = beginGlyphMarkDrag(host, 'G1', { x: 100, y: 50 })!
    drag.end()
    expect(glyphMark.commitDrag).not.toHaveBeenCalled()
  })

  it('declines when the symbol is not drawn', () => {
    registry.getById.mockReturnValueOnce(null as never)
    expect(beginGlyphMarkDrag(host, 'G1', { x: 0, y: 0 })).toBeNull()
  })
})
