import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { buildClipboardFromSelection } from './clipboard'
import { fracCreate as frac } from '../utils/fraction'
import type { TremoloMark } from '../types/music'

/**
 * A tremolo TRAVELS WITH THE NOTE (docs/tremolo-plan.md §6, P1).
 *
 * JSON is free — a slot field is serialized directly. Everything else is an explicit field list, and
 * anything not named in one is dropped **in silence**: the hole `beamOver` fell into. There are three
 * such lists, and this file is one test per link in them:
 *   - the rebar relay (slot → `RebarEvent` → `RebarPiece` → `Chord`), which a meter change AND a paste
 *     both ride;
 *   - `moveNoteToVoice`'s own payload, re-applied by hand at both `insertPitch` branches;
 *   - `placeSpanningNote`, which builds every tie continuation from `{step, alter, octave, voice,
 *     staff}` alone.
 *
 * These are worth pinning precisely because the failure is invisible: nothing throws, nothing logs,
 * the mark is just gone the next time the bar is re-tiled.
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

function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

/** C4 D4 E4 F4 on beats 0..3 of measure `m`; returns their (pitch) ids. */
function fourNotes(engine: MusicEngine, m: number): string[] {
  const steps = ['C', 'D', 'E', 'F'] as const
  return steps.map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: m, beat: frac(i, 1) })!.id,
  )
}

/** The tremolo on the CHORD at (measure, beat) — the re-tiled/pasted slot has a fresh id. */
function tremoloAt(engine: MusicEngine, m: number, beat: number): TremoloMark | undefined {
  const measure = engine.getScore().measures.find(mm => mm.number === m)
  const slot = measure?.slots.find(s => s.beat.num === beat && s.beat.den === 1 && s.type === 'chord')
  return slot?.type === 'chord' ? slot.tremolo : undefined
}

describe('tremolo — survives a rebar', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('follows the music when a meter change re-tiles the bars', () => {
    const ids = fourNotes(engine, 1)
    engine.setTremolo(ids[0], 3)
    // 4/4 → 2/4 splits the bar; C4 stays at absolute beat 0 (bar 1, beat 0).
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(tremoloAt(engine, 1, 0)).toBe(3)
  })

  it('re-lands on the bar the note moved to', () => {
    const ids = fourNotes(engine, 1)
    engine.setTremolo(ids[2], 2) // E4 at absolute beat 2
    // 4/4 → 2/4: bar 1 = C(0) D(1), bar 2 = E(0) F(1). E4 now opens bar 2.
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(tremoloAt(engine, 2, 0)).toBe(2)
    expect(tremoloAt(engine, 1, 0)).toBeUndefined() // and does not smear onto its neighbours
  })

  it('carries the Penderecki value, not just a stroke count', () => {
    const ids = fourNotes(engine, 1)
    engine.setTremolo(ids[0], 'penderecki')
    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    expect(tremoloAt(engine, 1, 0)).toBe('penderecki')
  })

  it('keeps the mark on BOTH halves when a rebar tie-splits the note', () => {
    // One half note over beats 0–1, then a meter change that cuts the bar at beat 1.
    const head = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!
    engine.setTremolo(head.id, 4)
    engine.setTimeSignature(1, { numerator: 1, denominator: 4 })
    // A tremolo interrupted at a barline is still being played across it.
    expect(tremoloAt(engine, 1, 0)).toBe(4)
    expect(tremoloAt(engine, 2, 0)).toBe(4)
  })
})

describe('tremolo — copy/paste', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('travels with a pasted passage (the clip lanes ARE rebar events)', () => {
    const ids = fourNotes(engine, 1)
    engine.setTremolo(ids[1], 5)
    const clip = buildClipboardFromSelection(engine.getScore(), ids)!
    engine.addMeasure()
    engine.pasteEvents(clip, { measure: 2, beat: frac(0, 1), voice: 0 })
    expect(tremoloAt(engine, 2, 1)).toBe(5)
    expect(tremoloAt(engine, 2, 0)).toBeUndefined()
  })
})

describe('tremolo — the voice move (Alt+1/2)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  /** The tremolo on the chord at (measure, beat) in a given voice. */
  const tremoloInVoice = (m: number, beat: number, voice: number) => {
    const measure = engine.getScore().measures.find(mm => mm.number === m)!
    const slot = measure.slots.find(s =>
      s.beat.num === beat && s.beat.den === 1 && s.type === 'chord' && (s.voice ?? 0) === voice)
    return slot?.type === 'chord' ? slot.tremolo : undefined
  }

  it('carries the mark into the new voice', () => {
    const ids = fourNotes(engine, 1)
    engine.setTremolo(ids[0], 3)
    engine.moveNoteToVoice(ids[0], 1)
    expect(tremoloInVoice(1, 0, 1)).toBe(3)
  })

  it('does NOT clobber a mark the destination chord already carries', () => {
    // Two notes at the same beat in different voices, each with its own tremolo.
    const v0 = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const v1 = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!
    engine.setTremolo(v0.id, 1)
    engine.setTremolo(v1.id, 5)
    engine.moveNoteToVoice(v0.id, 1) // merges into the voice-1 chord
    // A note has ONE tremolo, so the destination keeps its own — the same rule the beam follows.
    expect(tremoloInVoice(1, 0, 1)).toBe(5)
  })
})

describe('tremolo — the tie-split across a barline', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('reaches the continuation when a duration change overflows the bar', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!
    engine.setTremolo(note.id, 2)
    // A quarter on beat 3 grown to a half overflows 4/4 by one beat → head + tied continuation.
    engine.updateNote(note.id, { duration: 'h' })
    expect(tremoloAt(engine, 1, 3)).toBe(2) // the head, reused via updateNote
    expect(tremoloAt(engine, 2, 0)).toBe(2) // the continuation, carried explicitly
  })
})

/**
 * Entering a note WITH a mark (docs/tremolo-plan.md §10) — the engine half of the note-entry flow.
 *
 * A `tremolo` in `NoteParams` rather than a `setTremolo` after the fact, so the note is BORN with it:
 * one undo entry, and the cross-barline split carries it to every piece the way the stamp's does.
 * (The palette side — which press means "enter with" vs "stamp onto" — is `tremoloEntry.test.ts`.)
 */
describe('tremolo — entered with the note', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('lands on the slot the note creates', () => {
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), tremolo: 3 })
    expect(tremoloAt(engine, 1, 0)).toBe(3)
  })

  it('marks the CHORD when the note joins an existing one — the mark is a slot property', () => {
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.addNoteAtBeat({ step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), tremolo: 2 })
    expect(tremoloAt(engine, 1, 0)).toBe(2)
  })

  it('⭐ reaches EVERY piece when the entered note overflows the bar', () => {
    // A half note entered on beat 3 of 4/4 splits into a quarter + a tied quarter in bar 2. A mark
    // interrupted at a barline is still being played across it, so both halves wear it.
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(3, 1), tremolo: 4 })
    expect(tremoloAt(engine, 1, 3)).toBe(4)
    expect(tremoloAt(engine, 2, 0)).toBe(4)
  })

  it('is ONE undo entry — the mark is part of the entry, not a second edit', () => {
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), tremolo: 5 })
    engine.undo()
    expect(engine.getScore().measures[0].slots.some(s => s.type === 'chord')).toBe(false)
  })

  it('⭐ combines with the other armed entry values — it is ONE MORE state of the entry note', () => {
    // Accidental + dots + articulation + tremolo, all armed at once and all landing on the one note.
    // The whole point of making it a NoteParams field rather than a mode of its own: it composes.
    const note = engine.addNoteAtBeat({
      step: 'C', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1),
      dots: 1, articulations: ['accent'], tremolo: 3,
    })!
    expect(note.alter).toBe(1)
    expect(note.dots).toBe(1)
    expect(note.articulations).toEqual(['accent'])
    expect(tremoloAt(engine, 1, 0)).toBe(3)
  })

  it('a REST ignores it — you cannot tremolo silence', () => {
    engine.addNoteAtBeat({ duration: 'q', measure: 1, beat: frac(0, 1), isRest: true, tremolo: 3 })
    expect(tremoloAt(engine, 1, 0)).toBeUndefined()
  })
})
