import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { fracCreate as frac } from '../utils/fraction'
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_BEAMS } from '../utils/fannedBeam'
import type { FanMark } from '../types/music'

/**
 * A FAN TRAVELS WITH THE NOTE — the same explicit field lists `tremoloTravel.test.ts` pins, walked
 * again for the new slot field, because anything they do not name is dropped **in silence**
 * (docs/fanned-beams-plan.md §0). One difference, and it is the whole reason this file exists
 * separately: on a TIE-SPLIT the tremolo goes on both halves and **the fan goes on the first only**.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
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

const FAN: FanMark = { direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS }

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

/** The model (no engine wrapper yet — P0 is the model layer; P2 wires the button). */
const model = (engine: MusicEngine) =>
  (engine as unknown as { scoreModel: { setFan(id: string, fan: FanMark | null): unknown } }).scoreModel

/** C4 D4 E4 F4 on beats 0..3 of measure `m`; returns their (pitch) ids. */
function fourNotes(engine: MusicEngine, m: number): string[] {
  const steps = ['C', 'D', 'E', 'F'] as const
  return steps.map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: m, beat: frac(i, 1) })!.id,
  )
}

/** The fan on the CHORD at (measure, beat) — the re-tiled/pasted slot has a fresh id. */
function fanAt(engine: MusicEngine, m: number, beat: number, voice = 0): FanMark | undefined {
  const measure = engine.getScore().measures.find(mm => mm.number === m)
  const slot = measure?.slots.find(s =>
    s.beat.num === beat && s.beat.den === 1 && s.type === 'chord' && (s.voice ?? 0) === voice)
  return slot?.type === 'chord' ? slot.fan : undefined
}

describe('fan — survives a rebar', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follows the music when a meter change re-tiles the bars', () => {
    const ids = fourNotes(engine, 1)
    model(engine).setFan(ids[0], FAN)
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(fanAt(engine, 1, 0)).toEqual(FAN)
  })

  it('re-lands on the bar the note moved to, and does not smear onto its neighbours', () => {
    const ids = fourNotes(engine, 1)
    model(engine).setFan(ids[2], FAN) // E4 at absolute beat 2
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(fanAt(engine, 2, 0)).toEqual(FAN)
    expect(fanAt(engine, 1, 0)).toBeUndefined()
  })

  it('⭐ keeps the mark on the FIRST half only when a rebar tie-splits the note', () => {
    // The opposite of the tremolo's rule, on purpose: a tremolo interrupted at a barline is still
    // being played across it, but a fan cut in half is not a fan — it is the cross-barline fan
    // docs/fanned-beams-plan.md §4 excludes, and copying would mint one on both halves.
    const head = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!
    model(engine).setFan(head.id, FAN)
    engine.setTimeSignature(1, { numerator: 1, denominator: 4 })
    expect(fanAt(engine, 1, 0)).toEqual(FAN)
    expect(fanAt(engine, 2, 0)).toBeUndefined()
  })
})

describe('fan — copy/paste', () => {
  it('travels with a pasted passage (the clip lanes ARE rebar events)', () => {
    const engine = makeEngine()
    const ids = fourNotes(engine, 1)
    model(engine).setFan(ids[1], FAN)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(2, frac(0, 1), clip.lanes, clip.spanBeats, 0, [], [], 0, clip.dynamics, clip.slurs)
    expect(fanAt(engine, 2, 1)).toEqual(FAN)
    expect(fanAt(engine, 2, 0)).toBeUndefined()
  })
})

describe('fan — the voice move (Alt+1/2)', () => {
  it('carries the mark into the new voice', () => {
    const engine = makeEngine()
    const ids = fourNotes(engine, 1)
    model(engine).setFan(ids[0], FAN)
    engine.moveNoteToVoice(ids[0], 1)
    expect(fanAt(engine, 1, 0, 1)).toEqual(FAN)
  })
})
