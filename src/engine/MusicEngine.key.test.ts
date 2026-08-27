import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fifthsOf } from '@/utils/keySignature'
import { keyFromFifths } from '@/utils/keySignature'

/**
 * `MusicEngine.setKeyAt` / `removeKeyAt` — the EDITOR half of the key writes: staff INDEX rather
 * than staff id, and **undo**.
 *
 * ⚠️ The undo assertions are the reason this file exists at all. A mutator that skips its undo
 * snapshot costs two things at once and neither of them throws: the edit cannot be taken back, and
 * the score never repaints, because the same call is what tells the app the model moved. `keyOps`'
 * own spec proves the write; only this one proves it was COMMITTED.
 */
vi.mock('./rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('MusicEngine key signatures', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addMeasure()
  })

  it('sets a key and reads it back through the walk', () => {
    expect(engine.setKeyAt(2, keyFromFifths(1))).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(1)
    expect(fifthsOf(engine.getKeyAt(3)), 'carried forward').toBe(1)
    expect(fifthsOf(engine.getKeyAt(1))).toBe(0)
  })

  it('⭐ UNDO takes the key change back, and redo puts it there again', () => {
    engine.setKeyAt(2, keyFromFifths(-3))
    expect(fifthsOf(engine.getKeyAt(2))).toBe(-3)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'gone').toBe(0)
    expect(engine.getScore().measures[1].keys).toBeUndefined()

    expect(engine.redo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'back').toBe(-3)
  })

  it('⭐ undo reaches a REMOVAL too', () => {
    engine.setKeyAt(2, keyFromFifths(2))
    expect(engine.removeKeyAt(2)).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(0)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2))).toBe(2)
  })

  it('⛔ a write that changes nothing commits nothing — there is no empty entry to undo past', () => {
    engine.setKeyAt(2, keyFromFifths(1))
    expect(engine.setKeyAt(3, keyFromFifths(1)), 'already in force at bar 3').toBe(false)

    expect(engine.undo()).toBe(true)
    expect(fifthsOf(engine.getKeyAt(2)), 'one undo is enough to clear the one real edit').toBe(0)
  })

  it('addresses a staff by INDEX, which is the editor\'s unit', () => {
    engine.addStaffBelow(0)
    expect(engine.setKeyAt(2, keyFromFifths(4), 0)).toBe(true)
    expect(engine.setKeyAt(2, keyFromFifths(-4), 1)).toBe(true)

    expect(fifthsOf(engine.getKeyAt(2, 0))).toBe(4)
    expect(fifthsOf(engine.getKeyAt(2, 1))).toBe(-4)
  })
})
