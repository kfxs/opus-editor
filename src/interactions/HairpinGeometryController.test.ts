import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HairpinGeometryController } from './HairpinGeometryController'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '../types/music'

/**
 * The apply half of the Properties hairpin rows.
 *
 * Subject: {@link HairpinGeometryController}, sitting beside this file. The window's half is
 * `windows/properties/PropertiesWidget.hairpin.test.ts`; what is asked here is the translation, where
 * the risk lives: the panel speaks ABSOLUTE offsets and the engine's verb ACCUMULATES, so a wrong
 * reading of "current" moves the end by the wrong amount — silently, and only once it already carries
 * a nudge.
 */
function stubEngine(score: Score) {
  const nudge = vi.fn(() => true)
  const reset = vi.fn(() => true)
  const engine = {
    getScore: () => score,
    nudgeHairpinEndpoint: nudge,
    resetHairpinEndpointOffset: reset,
  } as unknown as MusicEngine
  return { engine, nudge, reset }
}

/** A score whose wedge already carries a reshape on its right-hand end. */
const scoreWithOffset = (): Score => ({
  id: 's', title: 'T', measures: [],
  engravingOverrides: {
    'H1': [{ kind: 'hairpinEndpointOffset', end: { x: 1, y: -0.5 } }],
  },
} as unknown as Score)

describe('HairpinGeometryController', () => {
  let controller: HairpinGeometryController
  let rendered: number

  const wire = (engine: MusicEngine) => {
    rendered = 0
    controller = new HairpinGeometryController(() => engine, () => { rendered++ })
  }
  afterEach(() => controller.destroy())
  beforeEach(() => { rendered = 0 })

  it('⭐ turns a typed ABSOLUTE into the engine\'s relative nudge', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'end', value: { x: 2.5 } })
    // Stored 1, wanted 2.5 → move by 1.5. Reading the request as a delta would land on 3.5.
    expect(nudge).toHaveBeenCalledWith('H1', 'end', 1.5, 0)
    expect(rendered).toBe(1)
  })

  it('an absent axis is "leave it" — a zero delta, never a move to 0', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'end', value: { y: -0.5 } })
    // y already −0.5, so the whole request is a no-op — and x must not be dragged to 0.
    expect(nudge).not.toHaveBeenCalled()
  })

  it('an end with no reshape yet reads as 0, so the typed value IS the delta', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'start', value: { x: -1, y: 2 } })
    expect(nudge).toHaveBeenCalledWith('H1', 'start', -1, 2)
  })

  it('re-typing the same number changes nothing, and leaves no empty undo entry', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'end', value: { x: 1, y: -0.5 } })
    expect(nudge).not.toHaveBeenCalled()
    expect(rendered).toBe(0)
  })

  it('a null value resets that end rather than nudging it to zero', () => {
    const { engine, nudge, reset } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'end', value: null })
    expect(reset).toHaveBeenCalledWith('H1', 'end')
    expect(nudge).not.toHaveBeenCalled()
    expect(rendered).toBe(1)
  })

  it('does not repaint when the engine declines (nothing authored to reset)', () => {
    const { engine, reset } = stubEngine(scoreWithOffset())
    ;(reset as unknown as { mockReturnValue: (v: boolean) => void }).mockReturnValue(false)
    wire(engine)
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'start', value: null })
    expect(rendered).toBe(0)
  })

  it('does nothing at all without an engine', () => {
    controller = new HairpinGeometryController(() => null, () => { rendered++ })
    bus.hairpinGeometry.set({ hairpinId: 'H1', which: 'end', value: { x: 1 } })
    expect(rendered).toBe(0)
  })
})
