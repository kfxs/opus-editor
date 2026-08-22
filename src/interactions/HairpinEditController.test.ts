import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { HairpinEditController } from './HairpinEditController'
import { bus } from '@/bus'
import { fracCreate as frac } from '../utils/fraction'

/**
 * Subject: {@link HairpinEditController} — the apply behind the Properties type dropdown (his ask,
 * 2026-08-22). The window is a dumb publisher, so these tests drive the seam the way it does.
 *
 * ⭐ Two claims worth the file: the change is a CONTENT edit (it reaches the model and takes an undo
 * entry, ⛔ unlike the geometry seam next door, which writes an override), and re-choosing the value
 * a wedge already has writes NOTHING — a `<select>` fires `change` on a re-pick, and an undo step
 * whose effect nobody can see is worse than no step.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('HairpinEditController', () => {
  let engine: MusicEngine
  let controller: HairpinEditController
  let renders: number
  let hairpinId: string

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    hairpinId = engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(2, 1) })!.id
    renders = 0
    controller = new HairpinEditController(() => engine, () => { renders++ })
  })
  afterEach(() => controller.destroy())

  const typeOf = () => engine.getHairpinById(hairpinId)?.type

  it('⭐⭐ turns a crescendo into a diminuendo, and repaints', () => {
    bus.hairpinEdit.set({ hairpinId, type: 'dim' })
    expect(typeOf()).toBe('dim')
    expect(renders, 'the picture changed, so it is redrawn').toBe(1)
  })

  it('⭐ it is a CONTENT edit — one undo takes it back', () => {
    bus.hairpinEdit.set({ hairpinId, type: 'dim' })
    engine.undo()
    expect(typeOf(), 'the wedge is a crescendo again').toBe('cresc')
  })

  it('⛔ re-choosing the value it already has writes nothing', () => {
    bus.hairpinEdit.set({ hairpinId, type: 'cresc' })
    expect(renders, 'no repaint').toBe(0)
    // ⚠️ ⛔ Not `canUndo()` — the fixture's own `addHairpin` is a step. The claim is that the TOP of
    //    the stack is still that add, so one undo takes the wedge away rather than un-picking a
    //    type nobody changed.
    engine.undo()
    expect(engine.getHairpinById(hairpinId), 'the add was still the last thing done').toBeNull()
  })

  it('⛔ an id the score no longer has is a no-op, not a throw', () => {
    expect(() => bus.hairpinEdit.set({ hairpinId: 'ghost', type: 'dim' })).not.toThrow()
    expect(renders).toBe(0)
  })

  it('⛔ a request naming no field leaves the wedge alone', () => {
    bus.hairpinEdit.set({ hairpinId })
    expect(typeOf()).toBe('cresc')
    expect(renders).toBe(0)
  })

  it('⛔ …and after destroy it has let go of the seam', () => {
    controller.destroy()
    bus.hairpinEdit.set({ hairpinId, type: 'dim' })
    expect(typeOf(), 'nothing listening any more').toBe('cresc')
  })
})
