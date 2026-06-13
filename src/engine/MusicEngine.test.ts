import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

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

describe('MusicEngine.toggleSlur — endpoint resolution', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('single note slurs to the NEXT slot (note or rest)', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.toggleSlur([a.id])).toBe(true)
    const slurs = engine.getSlurs()
    expect(slurs).toHaveLength(1)
    expect(slurs[0]).toMatchObject({ startNoteId: a.id, endNoteId: b.id, voice: 0 })
  })

  it('range slurs first→last in SCORE order, regardless of id order passed', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    // Pass ids out of order: last, first, middle.
    expect(engine.toggleSlur([c.id, a.id, b.id])).toBe(true)
    expect(engine.getSlurs()[0]).toMatchObject({ startNoteId: a.id, endNoteId: c.id })
  })

  it('a single chord member slurs to the next EVENT, not a sibling head at the same beat', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // Stack a second pitch on the same beat → a chord (sibling head of `a`).
    const sibling = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const next = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.toggleSlur([a.id])).toBe(true)
    const slur = engine.getSlurs()[0]
    expect(slur.startNoteId).toBe(a.id)
    // NOT the sibling at the same beat:
    expect(slur.endNoteId).not.toBe(sibling.id)
    expect(slur.endNoteId).toBe(next.id)
  })

  it('pressing s again on the same span toggles the slur off', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.toggleSlur([a.id])).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1)
    expect(engine.toggleSlur([a.id])).toBe(false)
    expect(engine.getSlurs()).toHaveLength(0)
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

    expect(engine.toggleSlur([lastId])).toBeNull()
    expect(engine.getSlurs()).toHaveLength(0)
  })

  it('add / remove are each one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    engine.toggleSlur([a.id])
    expect(engine.getSlurs()).toHaveLength(1)
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(0) // undo removes the add
    expect(engine.redo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1) // redo restores it
  })
  // (JSON round-trip of slurs is covered in ScoreModel.test.ts — the engine's
  //  loadJSON triggers a full render, which the renderer stub here can't satisfy.)
})
