import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { getMeasureNotes } from '../utils/musicUtils'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
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

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure() // a second measure for paste targets
  return engine
}

const flat = (engine: MusicEngine, m: number) =>
  getMeasureNotes(engine.getScore().measures.find(x => x.number === m)!)

const pitches = (engine: MusicEngine, m: number) =>
  flat(engine, m).filter(n => !n.isRest).map(n => `${n.step}${n.octave}@${fracToNumber(n.beat)}`)

describe('clipboard — copy/paste of notes', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  /** Add C4 D4 E4 F4 on beats 0..3 of measure 1; return their ids. */
  const fillM1 = () => [
    engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id,
    engine.addNoteAtBeat({ step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id,
    engine.addNoteAtBeat({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })!.id,
    engine.addNoteAtBeat({ step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id,
  ]

  it('copies the selected span and pastes it verbatim into an empty bar', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    expect(payload.events).toHaveLength(4)
    expect(fracToNumber(payload.spanBeats)).toBe(4)

    engine.pasteEvents(2, frac(0, 1), payload.events, payload.spanBeats)
    expect(pitches(engine, 2)).toEqual(['C4@0', 'D4@1', 'E4@2', 'F4@3'])
  })

  it('overwrites forward (existing content in the target window is replaced)', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    // Put a different note into measure 2 first.
    engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 2, beat: frac(0, 1) })
    expect(pitches(engine, 2)).toEqual(['G4@0'])

    engine.pasteEvents(2, frac(0, 1), payload.events, payload.spanBeats)
    expect(pitches(engine, 2)).toEqual(['C4@0', 'D4@1', 'E4@2', 'F4@3']) // G4 gone
  })

  it('returns the pasted note ids (for selecting them)', () => {
    const ids = fillM1()
    const payload = buildClipboardFromSelection(engine.getScore(), ids)!
    const pasted = engine.pasteEvents(2, frac(0, 1), payload.events, payload.spanBeats)
    expect(pasted).toHaveLength(4)
    const m2Ids = new Set(flat(engine, 2).map(n => n.id))
    for (const id of pasted) expect(m2Ids.has(id)).toBe(true)
  })

  it('round-trips a chord', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const e = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) }).id
    const payload = buildClipboardFromSelection(engine.getScore(), [c, e])!
    engine.pasteEvents(2, frac(0, 1), payload.events, payload.spanBeats)

    const m2 = flat(engine, 2).filter(n => !n.isRest && fracToNumber(n.beat) === 0)
    expect(new Set(m2.map(n => `${n.step}${n.octave}`))).toEqual(new Set(['C4', 'E4']))
  })

  it('splits a note across a barline with a tie when pasted near the bar end', () => {
    // Copy a single half note (2 beats).
    const h = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    const payload = buildClipboardFromSelection(engine.getScore(), [h])!
    expect(fracToNumber(payload.spanBeats)).toBe(2)

    // Paste at beat 3 of measure 2: 2 beats from beat 3 overflows the 4/4 bar.
    engine.pasteEvents(2, frac(3, 1), payload.events, payload.spanBeats)

    const m2 = flat(engine, 2).find(n => !n.isRest && fracToNumber(n.beat) === 3)!
    const m3 = flat(engine, 3).find(n => !n.isRest && fracToNumber(n.beat) === 0)!
    expect(m2.duration).toBe('q')
    expect(m3.duration).toBe('q')
    expect(m2.tiedTo).toBe(m3.id)   // first piece ties to the continuation
    expect(m3.tiedFrom).toBe(m2.id)
  })

  it('returns null when nothing is selected', () => {
    fillM1()
    expect(buildClipboardFromSelection(engine.getScore(), [])).toBeNull()
  })
})
