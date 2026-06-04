import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac } from '@/utils/fraction'

// Stub VexFlowRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('./rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
  },
}))
vi.mock('./audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn()
    play = vi.fn()
    pause = vi.fn()
    stop = vi.fn()
    setVolume = vi.fn()
    onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  // Add a second measure for overflow tests
  engine.addMeasure()
  return engine
}

/** Add a note via addNoteAtBeat and assert it was placed */
function addNote(engine: MusicEngine, params: Parameters<MusicEngine['addNoteAtBeat']>[0]) {
  const note = engine.addNoteAtBeat(params)
  if (!note) throw new Error(`Failed to place note at measure ${params.measure} beat ${JSON.stringify(params.beat)}`)
  return note
}

describe('MusicEngine.updateNote — overflow handling', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('no overflow: extending a note that fits does not create a tie', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const updated = engine.updateNote(note.id, { duration: 'h' })

    expect(updated.duration).toBe('h')
    expect(updated.tiedTo).toBeUndefined()

    // No notes in measure 2 (only the auto-fill whole rest)
    const score = engine.getScore()
    const m2 = score.measures.find(m => m.number === 2)!
    const m2NonRests = m2.slots.filter(s => s.type !== 'rest')
    expect(m2NonRests).toHaveLength(0)
  })

  it('overflow: extends across barline and creates a tied continuation (basic)', () => {
    // Quarter at beat 2 in 4/4 → 2 beats available. Extend to whole (4b) → overflow 2b
    const note = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    engine.updateNote(note.id, { duration: 'w' })

    // Original note should now be a half, tied to continuation
    const m1Note = engine.getNote(note.id)!
    expect(m1Note.duration).toBe('h')
    expect(m1Note.tiedTo).toBeTruthy()

    // Continuation should be a half in measure 2, tied back
    const m2Note = engine.getNote(m1Note.tiedTo!)!
    expect(m2Note.duration).toBe('h')
    expect(m2Note.measure).toBe(2)
    expect(m2Note.tiedFrom).toBe(note.id)
    expect(m2Note.step).toBe('E')
  })

  it('overflow: 3 beats remaining splits into two notes within current measure', () => {
    // Quarter at beat 1 → 3 beats available. Whole (4b) → overflow 1b
    // Current measure: h + q (3b). Next measure: q (1b)
    const note = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.updateNote(note.id, { duration: 'w' })

    // First note in m1: half
    const n1 = engine.getNote(note.id)!
    expect(n1.duration).toBe('h')
    expect(n1.measure).toBe(1)
    expect(n1.tiedTo).toBeTruthy()

    // Second note in m1: quarter
    const n2 = engine.getNote(n1.tiedTo!)!
    expect(n2.duration).toBe('q')
    expect(n2.measure).toBe(1)
    expect(n2.tiedFrom).toBe(note.id)
    expect(n2.tiedTo).toBeTruthy()

    // Continuation in m2: quarter
    const n3 = engine.getNote(n2.tiedTo!)!
    expect(n3.duration).toBe('q')
    expect(n3.measure).toBe(2)
    expect(n3.tiedFrom).toBe(n2.id)
    expect(n3.tiedTo).toBeUndefined()
  })

  it('overflow: dotted note that overflows is split correctly', () => {
    // Quarter at beat 3 in 4/4 → 1 beat available. Dotted half (3b) → overflow 2b
    const note = addNote(engine, { step: 'A', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })
    engine.updateNote(note.id, { duration: 'h', dots: 1 })

    const m1Note = engine.getNote(note.id)!
    expect(m1Note.duration).toBe('q') // 1 beat fits → quarter
    expect(m1Note.tiedTo).toBeTruthy()

    // Continuation in m2: 2 beats worth of notes
    const next = engine.getNote(m1Note.tiedTo!)!
    expect(next.measure).toBe(2)
    expect(next.step).toBe('A')
  })

  it('non-overflowing extension at beat 0 does not create a tie', () => {
    // Quarter at beat 0; extend to half (2b) — fits fine in 4/4
    const note = addNote(engine, { step: 'B', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const updated = engine.updateNote(note.id, { duration: 'h' })
    expect(updated.duration).toBe('h')
    expect(updated.tiedTo).toBeUndefined()

    const score = engine.getScore()
    const m2 = score.measures.find(m => m.number === 2)!
    const m2NonRests = m2.slots.filter(s => s.type !== 'rest')
    expect(m2NonRests).toHaveLength(0)
  })
})

describe('BeamMode — storage and retrieval', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('note created with beam:begin stores the value', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), beam: 'begin' })
    expect(note.beam).toBe('begin')
  })

  it('note created without beam has no beam value', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    expect(note.beam).toBeUndefined()
  })

  it('updateNote sets beam on a chord', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })
    const updated = engine.updateNote(note.id, { beam: 'end' })
    expect(updated.beam).toBe('end')
  })

  it('updateNote with beam:auto clears the beam value', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), beam: 'begin' })
    const updated = engine.updateNote(note.id, { beam: 'auto' })
    expect(updated.beam).toBeUndefined()
  })

  it('all five BeamMode values round-trip correctly', () => {
    const modes = ['single', 'begin', 'continue', 'end'] as const
    for (const mode of modes) {
      const note = addNote(engine, { step: 'D', alter: 0, octave: 4, duration: '8', measure: 1, beat: frac(0, 1), beam: mode })
      expect(note.beam).toBe(mode)
      // reset for next iteration
      engine.updateNote(note.id, { beam: 'auto' })
    }
  })
})

describe('MusicEngine.setTimeSignature', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('sets the signature and reports the change', () => {
    expect(engine.setTimeSignature(1, { numerator: 3, denominator: 4 })).toBe(true)
    expect(engine.getScore().measures.find(m => m.number === 1)!.timeSignature)
      .toEqual({ numerator: 3, denominator: 4 })
  })

  it('undo/redo restores and re-applies a time-signature change', () => {
    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const tsOf = () => engine.getScore().measures.find(m => m.number === 1)!.timeSignature

    expect(engine.undo()).toBe(true)
    expect(tsOf()).toEqual({ numerator: 4, denominator: 4 })

    expect(engine.redo()).toBe(true)
    expect(tsOf()).toEqual({ numerator: 3, denominator: 4 })
  })

  it('removeTimeSignatureChange undoes a mid-score change', () => {
    engine.setTimeSignature(2, { numerator: 3, denominator: 4 })
    expect(engine.removeTimeSignatureChange(2)).toBe(true)
    expect(engine.getScore().measures.find(m => m.number === 2)!.timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })
  })
})
