import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GlyphMarkController } from './GlyphMarkController'
import { bus } from '@/bus'
import type { MusicEngine } from '../../engine/MusicEngine'

/**
 * {@link GlyphMarkController} — the apply half of the Symbols window's Add symbol button
 * (docs/plans/symbol-plan.md P2): a request becomes `engine.glyphMark.add`, and only a real add repaints.
 */
describe('GlyphMarkController', () => {
  let controller: GlyphMarkController
  let render: ReturnType<typeof vi.fn<() => void>>
  const glyphMark = { add: vi.fn(() => ({ id: 'g1' }) as unknown) }

  beforeEach(() => {
    vi.clearAllMocks()
    render = vi.fn<() => void>()
    controller = new GlyphMarkController(() => ({ glyphMark }) as unknown as MusicEngine, render)
  })
  afterEach(() => { controller.destroy() })

  it('adds the glyph to the named event and repaints', () => {
    bus.glyphMarkAdd.set({ noteId: 'n1', glyph: 'pictGlsp' })
    expect(glyphMark.add).toHaveBeenCalledWith('n1', 'pictGlsp')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('a refused add repaints nothing', () => {
    glyphMark.add.mockReturnValueOnce(null)
    bus.glyphMarkAdd.set({ noteId: 'n1', glyph: 'controlBeginBeam' })
    expect(render).not.toHaveBeenCalled()
  })
})
