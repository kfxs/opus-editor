import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { buildBeatMap, navBeatMap } from '@/utils/beatMap'

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

describe('MusicEngine.flipArticulation — articulation side override', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('notes default to auto placement (no override stored)', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.toggleArticulation(note.id, 'staccato')
    expect(engine.getNote(note.id)!.articulationPlacement).toBeUndefined()
  })

  it('Sibelius toggle: first flip pins a side, second flip returns to auto', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.toggleArticulation(note.id, 'accent')

    const first = engine.flipArticulation(note.id)!.articulationPlacement
    expect(first === 'above' || first === 'below').toBe(true)

    // Second press clears the override back to the context-aware auto default.
    const second = engine.flipArticulation(note.id)!.articulationPlacement
    expect(second).toBeUndefined()
  })

  it('the stored side is the opposite of the auto (stem-derived) side', () => {
    // C4 sits below the treble middle line → stem up → articulations auto BELOW,
    // so the first flip must store 'above'.
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.toggleArticulation(note.id, 'tenuto')
    expect(engine.flipArticulation(note.id)!.articulationPlacement).toBe('above')
  })

  it('is a no-op (returns null) for a note with no articulations', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(engine.flipArticulation(note.id)).toBeNull()
    expect(engine.getNote(note.id)!.articulationPlacement).toBeUndefined()
  })

  it('clearArticulations removes every articulation (and the side override) at once', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.toggleArticulation(note.id, 'staccato')
    engine.toggleArticulation(note.id, 'accent')
    engine.flipArticulation(note.id)
    expect(engine.getNote(note.id)!.articulations).toEqual(['staccato', 'accent'])

    engine.clearArticulations(note.id)
    expect(engine.getNote(note.id)!.articulations).toEqual([])
    expect(engine.getNote(note.id)!.articulationPlacement).toBeUndefined()
  })

  it('clearArticulations is a no-op (returns null) when there are none', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(engine.clearArticulations(note.id)).toBeNull()
  })

  it('flip is undoable', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.toggleArticulation(note.id, 'accent')
    engine.flipArticulation(note.id)
    expect(engine.getNote(note.id)!.articulationPlacement).toBe('above')
    engine.undo()
    expect(engine.getNote(note.id)!.articulationPlacement).toBeUndefined()
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

  it('undo restores music re-barred by a meter change', () => {
    // makeEngine starts with 2 measures. Four quarters fill measure 1 (4/4);
    // switching to 3/4 re-bars the 4th quarter into measure 2.
    for (let b = 0; b < 4; b++) {
      addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(b, 1) })
    }
    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const after = engine.getScore().measures
    expect(after[0].slots.filter(s => s.type === 'chord').map(c => fracToNumber(c.beat))).toEqual([0, 1, 2])
    expect(after[1].slots.filter(s => s.type === 'chord').map(c => fracToNumber(c.beat))).toEqual([0])

    expect(engine.undo()).toBe(true)
    const m = engine.getScore().measures
    expect(m[0].timeSignature).toEqual({ numerator: 4, denominator: 4 })
    expect(m[0].slots.filter(s => s.type === 'chord')).toHaveLength(4) // all four back in measure 1
  })

  it('setMeasureActualDuration creates a pickup and undo/redo restores it', () => {
    expect(engine.setMeasureActualDuration(1, frac(1, 1))).toBe(true)
    const overrideOf = () => engine.getScore().measures.find(m => m.number === 1)!.actualDurationOverride

    expect(overrideOf()).toMatchObject({ num: 1, den: 1 })
    expect(engine.undo()).toBe(true)
    expect(overrideOf()).toBeUndefined()
    expect(engine.redo()).toBe(true)
    expect(overrideOf()).toMatchObject({ num: 1, den: 1 })
  })

  it('removeTimeSignatureChange undoes a mid-score change', () => {
    engine.setTimeSignature(2, { numerator: 3, denominator: 4 })
    expect(engine.removeTimeSignatureChange(2)).toBe(true)
    expect(engine.getScore().measures.find(m => m.number === 2)!.timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })
  })

  it('setTimeSignatureHidden hides the glyph and undo/redo restores visibility', () => {
    const hiddenOf = () => engine.getScore().measures.find(m => m.number === 1)!.timeSignatureHidden
    expect(engine.setTimeSignatureHidden(1, true)).toBe(true)
    expect(hiddenOf()).toBe(true)
    // Meter is untouched — only the glyph is suppressed.
    expect(engine.getScore().measures.find(m => m.number === 1)!.timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })

    expect(engine.undo()).toBe(true)
    expect(hiddenOf()).toBeFalsy()
    expect(engine.redo()).toBe(true)
    expect(hiddenOf()).toBe(true)
  })

  it('push-forward rebar is a single undo that restores the prior layout', () => {
    // m1 & m2 each full of 16 sixteenths in 4/4; 5/8 at m2, then 2/4 at m1.
    for (const m of [1, 2]) {
      for (let k = 0; k < 16; k++) {
        addNote(engine, { step: 'C', alter: 0, octave: 4, duration: '16', measure: m, beat: frac(k, 4) })
      }
    }
    engine.setTimeSignature(2, { numerator: 5, denominator: 8 })
    const measuresBefore = engine.getScore().measures.length // m1(4/4) + m2,m3(5/8)
    const tsBefore = engine.getScore().measures.map(m => `${m.timeSignature.numerator}/${m.timeSignature.denominator}`)

    engine.setTimeSignature(1, { numerator: 2, denominator: 4 })
    // The 5/8 change was pushed to m3 (a bar inserted), not crammed into m1.
    expect(engine.getScore().measures.find(m => m.number === 3)!.timeSignature)
      .toEqual({ numerator: 5, denominator: 8 })
    expect(engine.getScore().measures.length).toBe(measuresBefore + 1)

    // One undo restores the whole push-forward.
    expect(engine.undo()).toBe(true)
    expect(engine.getScore().measures.length).toBe(measuresBefore)
    expect(engine.getScore().measures.map(m => `${m.timeSignature.numerator}/${m.timeSignature.denominator}`))
      .toEqual(tsBefore)
  })
})

describe('MusicEngine.insertMeasureAfter', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() }) // 2 measures

  it('inserts a measure and is undoable', () => {
    engine.insertMeasureAfter(1)
    expect(engine.getScore().measures).toHaveLength(3)
    expect(engine.getScore().measures.map(m => m.number)).toEqual([1, 2, 3])
    expect(engine.undo()).toBe(true)
    expect(engine.getScore().measures).toHaveLength(2)
  })
})

describe('MusicEngine — measure rest duration change (regression)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  it('changing the default measure rest to an 8th leaves no leftover whole rest', () => {
    const m1 = engine.getScore().measures.find(m => m.number === 1)!
    const mr = m1.slots.find(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)!
    engine.updateNote(mr.id, { duration: '8' })

    const slots = engine.getScore().measures.find(m => m.number === 1)!.slots
    // The whole-bar measure rest is gone.
    expect(slots.some(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)).toBe(false)
    // Exactly one 8th rest sits at beat 0 (the formerly-whole rest, now individualised).
    const eighthsAt0 = slots.filter(s => s.type === 'rest' && s.duration === '8' && s.beat.num === 0)
    expect(eighthsAt0).toHaveLength(1)
  })

  it('exposes isMeasureRest on the flat note so callers can avoid inheriting the nominal "w"', () => {
    const m1 = engine.getScore().measures.find(m => m.number === 1)!
    const mrSlot = m1.slots.find(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)!
    const flat = engine.getNote(mrSlot.id)!
    expect(flat.isMeasureRest).toBe(true)
  })

  it('converting a measure rest to a note with an explicit duration sizes the bar correctly (3/4)', () => {
    // Mirrors keyboard edit-in-place: the measure rest must NOT become a whole
    // note (redonda) — using the chosen duration keeps the 3/4 bar = 3 quarters.
    engine.setTimeSignature(1, { numerator: 3, denominator: 4 })
    const mr = engine.getScore().measures.find(m => m.number === 1)!
      .slots.find(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)!
    engine.updateNote(mr.id, { step: 'A', alter: 0, octave: 3, isRest: false, duration: 'q' })

    const slots = engine.getScore().measures.find(m => m.number === 1)!.slots
    const chord = slots.find(s => s.type === 'chord')!
    expect(chord.duration).toBe('q')               // not 'w'
    expect(slots.every(s => s.duration !== 'w')).toBe(true)
    const total = slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    expect(total).toBeCloseTo(3, 5)                 // bar stays exactly 3 quarters
  })

  it('refills a shortened measure rest to the actual bar length in a non-4/4 meter', () => {
    // 6/8 bar = 3 quarter-beats. Changing its whole-bar rest to a quarter must
    // leave a bar that sums to exactly 3 quarters — not 4 (the nominal 'w').
    engine.setTimeSignature(1, { numerator: 6, denominator: 8 })
    const mr = engine.getScore().measures.find(m => m.number === 1)!
      .slots.find(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)!
    engine.updateNote(mr.id, { duration: 'q' })

    const slots = engine.getScore().measures.find(m => m.number === 1)!.slots
    const total = slots.reduce((sum, s) => sum + fracToNumber(s.actualDuration!), 0)
    expect(total).toBeCloseTo(3, 5)            // exactly the 6/8 bar length
    expect(slots.some(s => s.type === 'rest' && (s as { isMeasureRest?: boolean }).isMeasureRest)).toBe(false)
  })
})

describe('MusicEngine — dynamics', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const dynsOf = (m: number) => engine.getScore().measures.find(x => x.number === m)!.dynamics

  it('adds a dynamic and returns it with an id', () => {
    const d = engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
    expect(d?.id).toBeTruthy()
    expect(engine.getDynamics(1)).toHaveLength(1)
  })

  it('undo/redo restores and re-applies an added dynamic', () => {
    engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'f' })
    expect(dynsOf(1)).toHaveLength(1)

    expect(engine.undo()).toBe(true)
    expect(dynsOf(1)).toBeUndefined()

    expect(engine.redo()).toBe(true)
    expect(dynsOf(1)![0].level).toBe('f')
  })

  it('updates a dynamic and undo restores the prior value', () => {
    const d = engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })!
    engine.updateDynamic(d.id, { level: 'f' })
    expect(engine.getDynamics(1)[0].level).toBe('f')

    expect(engine.undo()).toBe(true)
    expect(engine.getDynamics(1)[0].level).toBe('p')
  })

  it('removes a dynamic and undo restores it', () => {
    const d = engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })!
    expect(engine.removeDynamic(d.id)).toBe(true)
    expect(engine.getDynamics(1)).toEqual([])

    expect(engine.undo()).toBe(true)
    expect(engine.getDynamics(1)).toHaveLength(1)
  })

  it('resolves the active level through the engine', () => {
    engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'p' })
    expect(engine.getActiveLevel(1, frac(2, 1))).toBe('p')
    expect(engine.getActiveLevel(2, frac(0, 1))).toBe('p') // inherited into measure 2
  })
})

describe('MusicEngine.runBatch — atomic multi-element undo', () => {
  let engine: MusicEngine

  const liveNotes = (m: number) =>
    engine.getScore().measures.find(x => x.number === m)!.slots.filter(s => s.type !== 'rest')

  beforeEach(() => {
    engine = makeEngine()
  })

  it('deleting 3 notes in a batch is ONE undo step that restores all of them', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    expect(liveNotes(1)).toHaveLength(3)

    const pushed = engine.runBatch('Delete 3 note(s)', () => {
      engine.deleteNote(a.id); engine.deleteNote(b.id); engine.deleteNote(c.id)
    })
    expect(pushed).toBe(true)
    expect(liveNotes(1)).toHaveLength(0)

    // A SINGLE undo restores the whole group (not note-by-note).
    expect(engine.undo()).toBe(true)
    expect(liveNotes(1)).toHaveLength(3)
  })

  it('an empty batch (no change) pushes nothing and is not undoable', () => {
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const undoableBefore = engine.canUndo()
    const pushed = engine.runBatch('noop', () => { /* nothing */ })
    expect(pushed).toBe(false)
    // History unchanged: the noop added no new entry.
    expect(engine.canUndo()).toBe(undoableBefore)
  })

  it('redo replays the whole batched group', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.runBatch('Delete 2 note(s)', () => { engine.deleteNote(a.id); engine.deleteNote(b.id) })

    engine.undo()
    expect(liveNotes(1)).toHaveLength(2)
    expect(engine.redo()).toBe(true)
    expect(liveNotes(1)).toHaveLength(0)
  })
})

describe('MusicEngine.moveNoteToVoice — facade (Phase 1)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const voiceOf = (m: number, id: string) => {
    for (const s of engine.getScore().measures.find(x => x.number === m)!.slots) {
      if (s.type === 'chord' && s.notes.some(n => n.id === id)) return s.voice ?? 0
    }
    return undefined
  }

  it('moves a note to another voice, preserving its id, in one undo step', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(voiceOf(1, note.id)).toBe(0)

    expect(engine.moveNoteToVoice(note.id, 1)).toBe(true)
    expect(voiceOf(1, note.id)).toBe(1) // moved, same id

    expect(engine.undo()).toBe(true)
    expect(voiceOf(1, note.id)).toBe(0) // restored in one step
  })

  it('returns false (no undo entry) for a no-op move', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const couldUndo = engine.canUndo()
    expect(engine.moveNoteToVoice(note.id, 0)).toBe(false)
    expect(engine.canUndo()).toBe(couldUndo) // history unchanged
  })
})

describe('MusicEngine.moveSelectionToVoice — atomic multi-note move (Phase 3)', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const voiceOf = (m: number, id: string) => {
    for (const s of engine.getScore().measures.find(x => x.number === m)!.slots) {
      if (s.type === 'chord' && s.notes.some(n => n.id === id)) return s.voice ?? 0
    }
    return undefined
  }

  it('moves several notes to a voice in ONE undo step, ids preserved', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    expect(engine.moveSelectionToVoice([c.id, a.id, b.id], 1)).toBe(true)
    expect(voiceOf(1, a.id)).toBe(1)
    expect(voiceOf(1, b.id)).toBe(1)
    expect(voiceOf(1, c.id)).toBe(1)

    // ONE undo restores all three to voice 0.
    expect(engine.undo()).toBe(true)
    expect(voiceOf(1, a.id)).toBe(0)
    expect(voiceOf(1, b.id)).toBe(0)
    expect(voiceOf(1, c.id)).toBe(0)
  })

  it('returns false (no undo entry) when every note is a no-op', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const couldUndo = engine.canUndo()
    expect(engine.moveSelectionToVoice([a.id], 0)).toBe(false) // already voice 0
    expect(engine.canUndo()).toBe(couldUndo)
  })

  it('ignores rest ids in the selection', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // The bar has filler rests after the quarter; grab one's id.
    const restId = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!.id
    expect(engine.moveSelectionToVoice([a.id, restId], 1)).toBe(true)
    expect(voiceOf(1, a.id)).toBe(1) // the note moved; the rest id was harmlessly skipped
  })

  it('keeps a tie when BOTH tied notes move together (surviving span)', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.toggleTie(a.id) // tie a → b

    expect(engine.moveSelectionToVoice([a.id, b.id], 1)).toBe(true)

    // Both moved to voice 1 and the tie survived (partner co-moved, not dropped).
    expect(voiceOf(1, a.id)).toBe(1)
    expect(voiceOf(1, b.id)).toBe(1)
    expect(engine.getNote(a.id)!.tiedTo).toBe(b.id)
    expect(engine.getNote(b.id)!.tiedFrom).toBe(a.id)
  })

  it('still drops the tie when only ONE of the tied notes moves', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.toggleTie(a.id)

    expect(engine.moveSelectionToVoice([a.id], 1)).toBe(true)
    expect(engine.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedFrom).toBeUndefined()
  })
})

describe('MusicEngine.createSlur — endpoint resolution', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('single note slurs to the NEXT slot (note or rest)', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.createSlur([a.id])).toMatchObject({ startNoteId: a.id, endNoteId: b.id, voice: 0 })
    expect(engine.getSlurs()).toHaveLength(1)
  })

  it('range slurs first→last in SCORE order, regardless of id order passed', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    // Pass ids out of order: last, first, middle.
    expect(engine.createSlur([c.id, a.id])).toMatchObject({ startNoteId: a.id, endNoteId: c.id })
  })

  it('a single chord member slurs to the next EVENT, not a sibling head at the same beat', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // Stack a second pitch on the same beat → a chord (sibling head of `a`).
    const sibling = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const next = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const slur = engine.createSlur([a.id])!
    expect(slur.startNoteId).toBe(a.id)
    expect(slur.endNoteId).not.toBe(sibling.id) // NOT the sibling at the same beat
    expect(slur.endNoteId).toBe(next.id)
  })

  it('is create-only and idempotent — pressing s again does NOT add a duplicate or remove', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const first = engine.createSlur([a.id])!
    expect(engine.getSlurs()).toHaveLength(1)
    const second = engine.createSlur([a.id])! // same span again
    expect(second.id).toBe(first.id)          // returns the existing slur
    expect(engine.getSlurs()).toHaveLength(1) // still exactly one — no toggle-off, no dup
  })

  it('returns null when there is no next slot to slur to', () => {
    // Fill both measures, then target the very last note — nothing follows it.
    for (let m = 1; m <= 2; m++) {
      for (let b = 0; b < 4; b++) {
        addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1) })
      }
    }
    const all = engine.getScore().measures.flatMap(m => m.slots.filter(s => s.type === 'chord'))
    const lastChord = all[all.length - 1] as { notes: { id: string }[] }
    const lastId = lastChord.notes[0].id

    expect(engine.createSlur([lastId])).toBeNull()
    expect(engine.getSlurs()).toHaveLength(0)
  })

  it('create then removeSlur are each one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const slur = engine.createSlur([a.id])!
    expect(engine.getSlurs()).toHaveLength(1)
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(0) // undo removes the add
    expect(engine.redo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1) // redo restores it

    expect(engine.removeSlur(slur.id)).toBe(true)
    expect(engine.getSlurs()).toHaveLength(0)
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1) // undo restores the removed slur
  })
  it('setSlurShape sets/clears cps as one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(slur.cps).toBeUndefined() // default = auto shape

    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 2, y: 14 }, { x: -3, y: 16 }]
    expect(engine.setSlurShape(slur.id, cps)).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toEqual(cps)

    expect(engine.undo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toBeUndefined() // undo reverts to auto

    expect(engine.redo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toEqual(cps)

    // Clearing with null drops the override back to auto.
    expect(engine.setSlurShape(slur.id, null)).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toBeUndefined()

    // Unknown id is a no-op.
    expect(engine.setSlurShape('nope', cps)).toBe(false)
  })

  it('previewSlurShape (no undo) + commitSlurShape (one undo) = a single reshape step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(slur.cps).toBeUndefined()

    // Several live preview updates during a "drag" — none record undo.
    const cps1: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 1, y: 10 }, { x: 1, y: 10 }]
    const cps2: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 5, y: 18 }, { x: -2, y: 16 }]
    expect(engine.previewSlurShape(slur.id, cps1)).toBe(true)
    expect(engine.previewSlurShape(slur.id, cps2)).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toEqual(cps2)

    engine.commitSlurShape() // one undo entry for the whole drag

    expect(engine.undo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toBeUndefined() // reverts past the entire drag to the auto shape
    expect(engine.redo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.cps).toEqual(cps2) // redo restores the final dragged shape
  })
  it('flipSlur toggles auto ↔ flipped as one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(slur.placement).toBeUndefined() // auto

    // First flip from auto sets an explicit side (opposite of last drawn; default-above → below).
    expect(engine.flipSlur(slur.id)).toBe(true)
    const after = engine.getSlurById(slur.id)!.placement
    expect(after === 'above' || after === 'below').toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.flipSlur(slur.id)
    expect(engine.getSlurById(slur.id)!.placement).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit side.
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.placement).toBe(after)

    expect(engine.flipSlur('nope')).toBe(false) // unknown id
  })
  it('flipTie inverts the tie curve direction as one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(engine.toggleTie(a.id)).toBe(true) // tie C → C

    const dirOf = () => {
      const score = JSON.parse(engine.exportJSON())
      for (const m of score.measures)
        for (const s of m.slots)
          if (s.type === 'chord')
            for (const p of s.notes) if (p.id === a.id) return p.tieDirection
      return undefined
    }
    expect(dirOf()).toBeUndefined() // auto (no override yet)

    // First flip from auto stores an explicit ±1 direction.
    expect(engine.flipTie(a.id)).toBe(true)
    const after = dirOf()
    expect(after === -1 || after === 1).toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.flipTie(a.id)
    expect(dirOf()).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit direction.
    expect(engine.undo()).toBe(true)
    expect(dirOf()).toBe(after)

    expect(engine.flipTie('nope')).toBe(false) // unknown id
  })

  it('flipTuplet toggles auto ↔ flipped as one undo step', () => {
    const tuplet = engine.createTupletAtBeat(1, 0, '8', { step: 'E', alter: 0, octave: 4 }, 3, 2, 0)!.tuplet
    const find = () => engine.getScore().measures[0].tuplets!.find(t => t.id === tuplet.id)!
    expect(find().placement).toBeUndefined() // auto

    // First flip from auto pins an explicit side.
    expect(engine.flipTuplet(tuplet.id)).toBe(true)
    const after = find().placement
    expect(after === 'above' || after === 'below').toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.flipTuplet(tuplet.id)
    expect(find().placement).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit side.
    expect(engine.undo()).toBe(true)
    expect(find().placement).toBe(after)

    expect(engine.flipTuplet('nope')).toBe(false) // unknown id
  })
  // (JSON round-trip of slurs is covered in ScoreModel.test.ts — the engine's
  //  loadJSON triggers a full render, which the renderer stub here can't satisfy.)
})

describe('MusicEngine — slur cleanup when an anchored note is deleted', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('re-anchors to the replacement rest when a single anchor note is deleted', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])! // a → b
    expect(slur.endNoteId).toBe(b.id)

    engine.deleteNote(b.id) // b becomes a rest with a NEW id
    const slurs = engine.getSlurs()
    expect(slurs).toHaveLength(1)               // slur survives
    expect(slurs[0].endNoteId).not.toBe(b.id)   // re-pointed onto the replacement rest
    // The new endpoint is a real slot at b's old (measure, beat).
    const end = engine.getNote(slurs[0].endNoteId)
    expect(end?.isRest).toBe(true)
  })

  it('re-anchors to a surviving sibling when a chord head anchor is deleted', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const sib = engine.addChordNote({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.createSlur([a.id]) // a (chord head) → b

    engine.deleteNote(a.id) // chord survives via `sib`
    const slurs = engine.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0].startNoteId).toBe(sib.id) // re-anchored to the sibling head
    expect(slurs[0].endNoteId).toBe(b.id)
  })
})

describe('MusicEngine — multi-voice (Phase 1)', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('entering a voice-2 note at an occupied beat does not clobber voice 1', () => {
    const v1 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const v2 = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    // Both notes survive as independent slots (not merged into one chord).
    expect(engine.getNote(v1.id)?.step).toBe('C')
    expect(engine.getNote(v2.id)?.step).toBe('E')

    const m1 = engine.getScore().measures[0]
    const chordsAtBeat0 = m1.slots.filter(s => s.type === 'chord' && fracToNumber(s.beat) === 0)
    expect(chordsAtBeat0).toHaveLength(2)

    // The second voice's stream is rest-filled for its remaining 3 beats.
    const v2Rests = m1.slots.filter(s => s.type === 'rest' && (s.voice ?? 0) === 1)
    expect(v2Rests.length).toBeGreaterThan(0)
    // Voice 1 keeps its own rests too (independent stream).
    const v1Rests = m1.slots.filter(s => s.type === 'rest' && (s.voice ?? 0) === 0)
    expect(v1Rests.length).toBeGreaterThan(0)
  })

  it('deleting the last note of voice 2 collapses the bar back to a single voice', () => {
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'w', measure: 1, beat: frac(0, 1) })
    const v2 = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })

    engine.deleteNote(v2.id)

    const m1 = engine.getScore().measures[0]
    const voice2Slots = m1.slots.filter(s => (s.voice ?? 0) === 1)
    expect(voice2Slots).toHaveLength(0) // collapsed — no leftover voice-2 rests
    // Voice 1 is untouched.
    expect(m1.slots.some(s => s.type === 'chord' && (s.voice ?? 0) === 0)).toBe(true)
  })

  it('deleting one of several voice-2 notes keeps voice 2 (rest replacement, no collapse)', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })
    addNote(engine, { step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })

    engine.deleteNote(a.id)

    const m1 = engine.getScore().measures[0]
    // Voice 2 still has the surviving note...
    const v2Chords = m1.slots.filter(s => s.type === 'chord' && (s.voice ?? 0) === 1)
    expect(v2Chords).toHaveLength(1)
    // ...and the deleted note became a voice-2 rest (stream stays full).
    const v2Rests = m1.slots.filter(s => s.type === 'rest' && (s.voice ?? 0) === 1)
    expect(v2Rests.length).toBeGreaterThan(0)
  })

  it('buildBeatMap scopes to a single voice (guards the getMeasureNotes voice projection)', () => {
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1), voice: 1 })
    const score = engine.getScore()

    const v1 = buildBeatMap(score, 0)
    expect(v1.allFlat.some(n => n.id === c.id)).toBe(true)
    expect(v1.allFlat.some(n => n.id === e.id)).toBe(false) // voice 2 excluded

    const v2 = buildBeatMap(score, 1)
    expect(v2.allFlat.some(n => n.id === e.id)).toBe(true)
    expect(v2.allFlat.some(n => n.id === c.id)).toBe(false) // voice 1 excluded
    expect(v2.allFlat.every(n => (n.voice ?? 0) === 1)).toBe(true)
  })

  it('navBeatMap falls back to all voices when the cursor sits on another voice', () => {
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const score = engine.getScore()

    // Active voice 2, but the cursor is a voice-1 note (just switched) → fall back so
    // the first voice-2 note can still be placed relative to it.
    const fallback = navBeatMap(score, c.id, 1)
    expect(fallback.allFlat.some(n => n.id === c.id)).toBe(true)

    // Cursor on a voice it belongs to → stays scoped to that voice.
    const scoped = navBeatMap(score, c.id, 0)
    expect(scoped.allFlat.every(n => (n.voice ?? 0) === 0)).toBe(true)
  })
})
