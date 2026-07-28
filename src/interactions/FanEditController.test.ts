import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { FanEditController } from './FanEditController'
import { bus } from '@/bus'
import { fracCreate as frac } from '../utils/fraction'
import { MAX_FAN_BEAMS, MAX_FAN_COUNT, MAX_FAN_SPREAD, clampFanBeams, clampFanCount } from '../utils/fannedBeam'
import type { FanMark } from '../types/music'

/**
 * P4 — the Properties inputs change a fan's SHAPE (docs/fanned-beams-plan.md §3). The window is a
 * dumb publisher; this is the controller that holds the engine, so these tests drive the seam the
 * way the inputs do.
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

const FAN: FanMark = { direction: 'accel', count: 6, beams: 3 }

describe('FanEditController', () => {
  let engine: MusicEngine
  let controller: FanEditController
  let renders: number

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    renders = 0
    controller = new FanEditController(() => engine, () => { renders++ })
  })
  afterEach(() => controller.destroy())

  /** A fanned blanca at bar 1 beat 0. */
  function fanned(fan: FanMark = FAN): string {
    const id = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.setFan(id, fan)
    return id
  }
  const fanOf = (id: string) => engine.getNote(id)?.fan

  it('changes the member count, leaving the direction and the beams alone', () => {
    const id = fanned()
    bus.fanEdit.set({ noteId: id, count: 9 })
    expect(fanOf(id)).toMatchObject({ direction: 'accel', count: 9, beams: 3 })
    expect(renders).toBe(1)
  })

  it('changes the beams the same way', () => {
    const id = fanned()
    bus.fanEdit.set({ noteId: id, beams: 2 })
    expect(fanOf(id)).toMatchObject({ direction: 'accel', count: 6, beams: 2 })
  })

  it('⭐ a typed count grows or shrinks the members — it does not throw the pitches away', () => {
    // The controller SPREADS the current mark, so `normalizeFan` sees the members it already has.
    // Rebuilding the mark field by field would silently re-materialise all of them from the typed
    // note, and every edited pitch would vanish on the next keystroke.
    const id = fanned()
    const grown = () => fanOf(id)!.members!
    expect(grown()).toHaveLength(5)

    // Mark one member so it can be recognised after the count moves.
    grown()[0].pitches[0].step = 'G'
    const markedId = grown()[0].pitches[0].id

    bus.fanEdit.set({ noteId: id, count: 9 })
    expect(grown()).toHaveLength(8)
    expect(grown()[0].pitches[0].step).toBe('G')
    expect(grown()[0].pitches[0].id).toBe(markedId) // a surviving member keeps its identity

    bus.fanEdit.set({ noteId: id, count: 3 })
    expect(grown()).toHaveLength(2)
    expect(grown()[0].pitches[0].id).toBe(markedId) // shrinking drops from the END
  })

  it('⭐ NEVER makes a fan — a note without one is a no-op', () => {
    // Creating and removing them is the accel./rit. press. An edit box that could conjure a notation
    // out of a typed number would be a second owner of that question.
    const id = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    bus.fanEdit.set({ noteId: id, count: 9 })
    expect(fanOf(id)).toBeUndefined()
    expect(renders).toBe(0)
  })

  it('the same value again is not an edit — no repaint, no empty undo entry', () => {
    const id = fanned()
    const before = engine.exportJSON()
    bus.fanEdit.set({ noteId: id, count: 6, beams: 3 })
    expect(renders).toBe(0)
    expect(engine.exportJSON()).toBe(before)
  })

  it('one edit is one undo', () => {
    const id = fanned()
    bus.fanEdit.set({ noteId: id, count: 9 })
    expect(engine.undo()).toBe(true)
    expect(fanOf(id)?.count).toBe(6)
  })

  it('clamps what is typed rather than refusing it', () => {
    const id = fanned()
    bus.fanEdit.set({ noteId: id, count: 9999 })
    expect(fanOf(id)?.count).toBe(MAX_FAN_COUNT)
    bus.fanEdit.set({ noteId: id, beams: 0 })
    expect(fanOf(id)?.beams).toBe(1)
    bus.fanEdit.set({ noteId: id, beams: 99 })
    expect(fanOf(id)?.beams).toBe(MAX_FAN_BEAMS)
  })

  /**
   * ⭐ THE RAMP RANGE (docs/fan-ramp-range-plan.md P2). The window publishes 0-based indices — it
   * does the 1-based conversion itself — so these tests drive the seam exactly as it arrives.
   */
  describe('the ramp range', () => {
    it('sets where the wedge starts and ends, one end at a time', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, rampTo: 3 })
      expect(fanOf(id)).toMatchObject({ count: 6, beams: 3, rampFrom: 0, rampTo: 3 })
      bus.fanEdit.set({ noteId: id, rampFrom: 1 })
      expect(fanOf(id)).toMatchObject({ rampFrom: 1, rampTo: 3 }) // the other end held
    })

    it('🚨 a range-only edit is a REAL edit — it repaints and it undoes', () => {
      // The guard used to ask only about `count` and `beams`, so this returned before `setFan` and
      // the whole control did nothing.
      const id = fanned()
      bus.fanEdit.set({ noteId: id, rampTo: 3 })
      expect(renders).toBe(1)
      expect(engine.undo()).toBe(true)
      expect(fanOf(id)?.rampTo).toBeUndefined()
    })

    it('⭐ typing the ends it already has is not an edit — absence and "the whole group" are one', () => {
      // The window always publishes a number, so a fan with no range publishes 0 and count-1. Those
      // say exactly what absence says; minting an undo entry for them would leave nothing on the
      // page to undo.
      const id = fanned()
      const before = engine.exportJSON()
      bus.fanEdit.set({ noteId: id, rampFrom: 0 })
      bus.fanEdit.set({ noteId: id, rampTo: 5 })
      expect(renders).toBe(0)
      expect(engine.exportJSON()).toBe(before)
    })

    it('a range that spans the whole group again comes back out ABSENT', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, rampFrom: 2 })
      expect(fanOf(id)?.rampFrom).toBe(2)
      bus.fanEdit.set({ noteId: id, rampFrom: 0 })
      expect(fanOf(id)?.rampFrom).toBeUndefined()
      expect(fanOf(id)?.rampTo).toBeUndefined()
    })

    it('⭐ clamped by `normalizeFan`, not here — the count is what holds it', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, rampTo: 99 })
      expect(fanOf(id)?.rampTo).toBeUndefined() // 99 → 5 → the whole group → dropped
      bus.fanEdit.set({ noteId: id, rampFrom: 1, rampTo: 4 })
      bus.fanEdit.set({ noteId: id, count: 3 })
      expect(fanOf(id)).toMatchObject({ count: 3, rampFrom: 1, rampTo: 2 }) // pulled back in
    })

    it('a count edit that strands the range keeps its members in step too', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, rampFrom: 3, rampTo: 5 })
      bus.fanEdit.set({ noteId: id, count: 2 })
      const fan = fanOf(id)!
      expect(fan.members).toHaveLength(1)
      expect([fan.rampFrom, fan.rampTo]).toEqual([undefined, undefined]) // 0…1 IS the whole group
    })
  })

  /**
   * ⭐ THE SPREAD — how far the wedge opens, and the one fan field that changes only the drawing.
   */
  describe('the spread', () => {
    it('🚨 a spread-only edit is a REAL edit — the guard is where a new field ships dead', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, spread: 2 })
      expect(fanOf(id)).toMatchObject({ count: 6, beams: 3, spread: 2 })
      expect(renders).toBe(1)
      expect(engine.undo()).toBe(true)
      expect(fanOf(id)?.spread).toBeUndefined()
    })

    it('⭐ typing the gap it already has is not an edit — absence and 1 are one', () => {
      const id = fanned()
      const before = engine.exportJSON()
      bus.fanEdit.set({ noteId: id, spread: 1 })
      expect(renders).toBe(0)
      expect(engine.exportJSON()).toBe(before)
    })

    it('back to 1 comes out ABSENT, and a typed 99 is clamped', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, spread: 3 })
      bus.fanEdit.set({ noteId: id, spread: 1 })
      expect(fanOf(id)?.spread).toBeUndefined()
      bus.fanEdit.set({ noteId: id, spread: 99 })
      expect(fanOf(id)?.spread).toBe(MAX_FAN_SPREAD)
    })

    it('holds while the other three are edited — one number, one owner', () => {
      const id = fanned()
      bus.fanEdit.set({ noteId: id, spread: 2 })
      bus.fanEdit.set({ noteId: id, count: 9 })
      bus.fanEdit.set({ noteId: id, rampFrom: 2 })
      expect(fanOf(id)).toMatchObject({ count: 9, rampFrom: 2, spread: 2 })
    })
  })

  it('a missing note is a no-op, not a throw', () => {
    expect(() => bus.fanEdit.set({ noteId: 'no-such-id', count: 4 })).not.toThrow()
  })

  it('stops listening once destroyed', () => {
    const id = fanned()
    controller.destroy()
    bus.fanEdit.set({ noteId: id, count: 9 })
    expect(fanOf(id)?.count).toBe(6)
  })
})

describe('the clamps are guards, not notation', () => {
  it('holds a count in 1…MAX and a beam count in 1…MAX', () => {
    expect(clampFanCount(0)).toBe(1)
    expect(clampFanCount(6.4)).toBe(6)
    expect(clampFanCount(1e9)).toBe(MAX_FAN_COUNT)
    expect(clampFanCount(NaN)).toBe(1)
    expect(clampFanBeams(-3)).toBe(1)
    expect(clampFanBeams(99)).toBe(MAX_FAN_BEAMS)
  })
})
