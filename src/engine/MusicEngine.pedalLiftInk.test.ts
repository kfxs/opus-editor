import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { pedalOffsetOverrideOf } from './models/engravingOverrides'
import { fracCreate as frac } from '../utils/fraction'
import { PEDAL_SIGN_GAP } from './rendering/pedalStyle'

/**
 * ⭐⭐ **THE RELEASE'S NUDGE IS NOT WRITTEN WHERE THE DRAWING WOULD IGNORE IT** — subject:
 * {@link MusicEngine.pedalLiftInkWouldMove}, reached through its only door,
 * `nudgePedalEndpoint(id, 'end', …)`.
 *
 * 🚨 His report, 2026-08-21: *"the `✻` goes back a lot and then we have to re-establish this till I
 * can go in the other direction"* — `endX` at **−39 staff-spaces** after one held keypress, forty
 * presses owed to walk it back. `PedalRenderer` floors the `✻` at the `Ped.`'s ink plus
 * {@link PEDAL_SIGN_GAP}, so every press past that point moved nothing and stored something.
 *
 * ⚠️ The REGISTRY is fabricated: this rule reads two drawn boxes and a staff-space size off the last
 * render, and jsdom draws nothing (`reference_jsdom_cannot_measure_glyphs`). 10 px per staff space,
 * so the floor is 5 px of air between the two glyphs' ink.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as {
    type: string; id?: string; staff?: number; measure?: number; pedalSign?: string
    bbox: { x: number; y: number; width: number; height: number }
  }[],
  /** Per measure: the staff's top-line y — which system that bar was drawn on. */
  systemTop: {} as Record<number, number>,
}))

vi.mock('./rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number) => ({
        lineSpacing: 10,
        lineYPositions: [drawn.systemTop[m] ?? 40, 50, 60, 70, 80],
        noteStartX: 90, noteEndX: 430,
      }),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      staffBands: () => [{ top: 40, bottom: 80 }],
    }))
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('MusicEngine — the release keeps no nudge the drawing would floor away', () => {
  let engine: MusicEngine
  let pedalId: string

  const endX = () => pedalOffsetOverrideOf(engine.getScore(), pedalId)?.endX ?? 0

  /** The pair as DRAWN. `air` is the clear space between the two glyphs' ink, in PIXELS. */
  const render = (air: number, upMeasure = 1) => {
    drawn.systemTop = { 1: 40, 2: 40 }
    drawn.entries = [
      { type: 'pedal', id: pedalId, staff: 0, measure: 1, pedalSign: 'down',
        bbox: { x: 100, y: 120, width: 35, height: 10 } },
      { type: 'pedal', id: pedalId, staff: 0, measure: upMeasure, pedalSign: 'up',
        bbox: { x: 135 + air, y: 120, width: 13, height: 10 } },
    ]
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    for (let i = 0; i < 4; i++) {
      engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })
    }
    pedalId = engine.addPedal(1, { beat: frac(0, 1), length: frac(2, 1) })!.id
    render(60)
  })

  it('⭐ writes freely while the drawing still has air to give', () => {
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0)).toBe(true)
    expect(endX()).toBeCloseTo(-1)
  })

  it('🚨🚨 ⛔ REFUSES the leftward step once the floor is binding — ⛔ no invisible debt', () => {
    render(PEDAL_SIGN_GAP * 10) // exactly the floor: no air left to give
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0)).toBe(false)
    expect(endX(), 'nothing stored').toBe(0)
  })

  it('⭐⭐ …but NEVER the step that mends it — the way out is open on the first press', () => {
    render(0) // already past the floor, as a saved file may be
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0)).toBe(false)
    expect(engine.nudgePedalEndpoint(pedalId, 'end', 1, 0), 'rightward always').toBe(true)
    expect(endX()).toBeCloseTo(1)
  })

  it('⛔ says nothing about the START — its floor is measured FROM the `Ped.`, so that ink shows', () => {
    render(0)
    expect(engine.nudgePedalEndpoint(pedalId, 'start', -1, 0)).toBe(true)
    expect(engine.nudgePedalEndpoint(pedalId, 'start', 1, 0)).toBe(true)
  })

  it('⛔ allows freely across a SYSTEM BREAK — two systems are not one ruler', () => {
    // The real cut picture: the `Ped.` near the end of one line, the `✻` near the start of the next.
    // Their two x's say the pair is crossed by 500 px, and that reading means nothing.
    const cut = (upTop: number) => {
      drawn.systemTop = { 1: 40, 2: upTop }
      drawn.entries = [
        { type: 'pedal', id: pedalId, staff: 0, measure: 1, pedalSign: 'down',
          bbox: { x: 600, y: 120, width: 35, height: 10 } },
        { type: 'pedal', id: pedalId, staff: 0, measure: 2, pedalSign: 'up',
          bbox: { x: 100, y: 320, width: 13, height: 10 } },
      ]
    }
    cut(240)
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0), 'a break is not a floor').toBe(true)

    // ⭐ Break the test's own fixture: put both bars back on ONE line and the same two boxes are
    // read as a crossed pair, which is the reading the ruler check exists to refuse.
    cut(40)
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0)).toBe(false)
  })

  it('⛔ allows freely when the last render drew no signs at all', () => {
    drawn.entries = []
    expect(engine.nudgePedalEndpoint(pedalId, 'end', -1, 0)).toBe(true)
  })
})
