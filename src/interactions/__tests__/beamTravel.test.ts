import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { buildClipboardFromSelection } from '../clipboard'
import { fracCreate as frac, fracToNumber } from '../../utils/fraction'
import type { BeamMode } from '../../types/music'

/**
 * AN AUTHORED BEAM TRAVELS WITH THE MUSIC — the beam twin of `tremoloTravel.test.ts`, and there
 * for the reason that file states: a slot field is free in JSON and named-or-dropped everywhere
 * else, so each explicit field list needs its own test.
 *
 * The beam is the sharpest case of it. Dropping it is not just losing a mark: the automatic beat
 * rules immediately fill the silence, so the passage comes back BEAMED — differently — and looks
 * intentional. That is what a paste did until 2026-07-28.
 *
 * ⚠️ Which piece of a TIE-SPLIT keeps the statement is the mode's own question (`relayEvents`),
 * so the split cases live beside the rule, in `utils/rebar.test.ts`.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
  getByMeasure: vi.fn(() => []),
}
vi.mock('../../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('../../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

/** Four C4 eighths on beats 0, 0.5, 1, 1.5 of measure `m`; returns their (pitch) ids. */
function fourEighths(engine: MusicEngine, m: number): string[] {
  return [0, 1, 2, 3].map(i =>
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: m, beat: frac(i, 2) })!.id,
  )
}

/** The chord slot at (measure, beat) — a re-tiled/pasted slot has a fresh id, so read by position. */
function chordAt(engine: MusicEngine, m: number, beat: number) {
  const measure = engine.getScore().measures.find(mm => mm.number === m)
  const slot = measure?.slots.find(s => s.type === 'chord' && fracToNumber(s.beat) === beat)
  return slot?.type === 'chord' ? slot : undefined
}

const beamAt = (engine: MusicEngine, m: number, beat: number): BeamMode | undefined =>
  chordAt(engine, m, beat)?.beam

describe('beam — survives a rebar', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follows the music when a meter change re-tiles the bars', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[0], { beam: 'begin' })
    engine.updateNote(ids[3], { beam: 'end' })
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    // 4/4 → 2/4 keeps all four eighths inside bar 1 (they occupy two beats).
    expect(beamAt(engine, 1, 0)).toBe('begin')
    expect(beamAt(engine, 1, 1.5)).toBe('end')
    expect(beamAt(engine, 1, 0.5)).toBeUndefined() // and does not smear onto its neighbours
  })

  it('re-lands on the bar the note moved to', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[2], { beam: 'begin' }) // absolute beat 1
    // 4/4 → 1/4: bar 1 = beats 0–0.5, bar 2 = beats 1–1.5. The marked note opens bar 2.
    engine.setTimeSignature(1, { numerator: 1, denominator: 4 })
    expect(beamAt(engine, 2, 0)).toBe('begin')
    expect(beamAt(engine, 1, 0)).toBeUndefined()
  })
})

describe('beam — copy/paste', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('travels with a pasted passage (the reported case)', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[1], { beam: 'begin' })
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    expect(beamAt(engine, 2, 0.5)).toBe('begin')
    // Only the note that carried it: an auto-beamed neighbour must not arrive marked.
    expect(beamAt(engine, 2, 0)).toBeUndefined()
    expect(beamAt(engine, 2, 1)).toBeUndefined()
    // …and the source is untouched.
    expect(beamAt(engine, 1, 0.5)).toBe('begin')
  })

  it('carries a whole begin…end group, in order', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[0], { beam: 'begin' })
    engine.updateNote(ids[1], { beam: 'continue' })
    engine.updateNote(ids[3], { beam: 'end' })
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    expect([0, 0.5, 1, 1.5].map(b => beamAt(engine, 2, b)))
      .toEqual(['begin', 'continue', undefined, 'end'])
  })

  it('carries the secondary break — the other authored beaming statement', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[2], { secondaryBreak: true })
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    expect(chordAt(engine, 2, 1)?.secondaryBreak).toBe(true)
    expect(chordAt(engine, 2, 0.5)?.secondaryBreak).toBeUndefined()
  })

  it('carries `single` — the statement that a note is NOT beamed', () => {
    const ids = fourEighths(engine, 1)
    engine.updateNote(ids[1], { beam: 'single' })
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })

    // Without this the auto rules re-beam it into the beat group it was pulled out of.
    expect(beamAt(engine, 2, 0.5)).toBe('single')
  })
})
