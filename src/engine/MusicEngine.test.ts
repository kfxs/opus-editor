import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { curveShapeOverrideOf, segmentCurveShapeOverrideOf, endpointOffsetOverrideOf, segmentEndpointOffsetOverrideOf } from './models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'
import { buildBeatMap, navBeatMap } from '@/utils/beatMap'
import { DEFAULT_TEMPO } from '@/utils/tempoMap'

// Stub VexFlowRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('./rendering/VexFlowRenderer', async (importOriginal) => ({
  // Keep the module's real constants (LAYOUT_CONFIG — the staff-spacing clamp reads it); only the
  // renderer class needs stubbing, since it wants a canvas/SVG.
  ...(await importOriginal<typeof import('./rendering/VexFlowRenderer')>()),
  VexFlowRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    setLayoutReusable = vi.fn()
    // P3's skip test (docs/render-performance-plan.md §5a) reads the view state off the
    // renderer. The stub's view state never changes, so `isRenderStale` here answers purely
    // "did the content change?" — which is exactly what the tests below exercise.
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    // Nothing is drawn, so there are no bounds to feed the coordinate mapper.
    getAllMeasureBounds = vi.fn(() => new Map())
    // Nothing is laid out in a stubbed renderer, so no measure opens a system: the per-system
    // staff-spacing key can't be resolved, exactly as before a first render.
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
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

describe('MusicEngine.setNoteAccidental / noteDisplaysAccidental', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('sets a sharp / flat (changes the pitch) and reports it displayed', () => {
    const note = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(engine.noteDisplaysAccidental(note.id, '#')).toBe(false)

    engine.setNoteAccidental(note.id, '#')
    expect(engine.getNote(note.id)!.alter).toBe(1)
    expect(engine.noteDisplaysAccidental(note.id, '#')).toBe(true)

    engine.setNoteAccidental(note.id, 'b')
    expect(engine.getNote(note.id)!.alter).toBe(-1)
    expect(engine.noteDisplaysAccidental(note.id, 'b')).toBe(true)
    expect(engine.noteDisplaysAccidental(note.id, '#')).toBe(false)
  })

  it('a courtesy natural (nothing to cancel) is forced, so its sign shows', () => {
    const note = addNote(engine, { step: 'D', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // A plain natural note shows no sign — nothing to cancel and not forced.
    expect(engine.noteDisplaysAccidental(note.id, 'n')).toBe(false)

    engine.setNoteAccidental(note.id, 'n')
    const updated = engine.getNote(note.id)!
    expect(updated.alter).toBe(0)
    expect(updated.forceAccidental).toBe(true)
    expect(engine.noteDisplaysAccidental(note.id, 'n')).toBe(true)
  })

  it('a natural that cancels an earlier same-bar accidental shows without forcing', () => {
    addNote(engine, { step: 'F', alter: 1, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const second = addNote(engine, { step: 'F', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    // Prevailing alter at the 2nd F is +1 (from the 1st), so its natural auto-shows — no force flag.
    engine.setNoteAccidental(second.id, 'n')
    const updated = engine.getNote(second.id)!
    expect(updated.alter).toBe(0)
    expect(updated.forceAccidental).toBeUndefined()
    expect(engine.noteDisplaysAccidental(second.id, 'n')).toBe(true)
  })

  it('is a no-op on a rest', () => {
    // Measure 2 is empty → auto-filled with a whole rest.
    const m2 = engine.getScore().measures.find(m => m.number === 2)!
    const restId = (m2.slots.find(s => s.type === 'rest') as { id: string }).id
    expect(engine.getNote(restId)!.isRest).toBe(true)
    expect(engine.setNoteAccidental(restId, '#')).toBeNull()
    expect(engine.noteDisplaysAccidental(restId, '#')).toBe(false)
  })
})

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

  it('overflow: 3 beats remaining is ONE dotted half, not a half tied to a quarter', () => {
    // Quarter at beat 1 → 3 beats available. Whole (4b) → overflow 1b.
    // Reported: this gave h + q (tied) in m1, then q in m2 — three pieces, two ties — where the
    // three beats are one dotted half. splitBeatsIntoLengths includes dots; the split now says
    // "the fewest values that span it".
    const note = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.updateNote(note.id, { duration: 'w' })

    // m1: ONE dotted half filling beats 1–4
    const n1 = engine.getNote(note.id)!
    expect(n1.duration).toBe('h')
    expect(n1.dots).toBe(1)
    expect(n1.measure).toBe(1)
    expect(n1.tiedTo).toBeTruthy()

    // m2: the quarter that overflowed, tied from it — and the chain ENDS there
    const n2 = engine.getNote(n1.tiedTo!)!
    expect(n2.duration).toBe('q')
    expect(n2.dots ?? 0).toBe(0)
    expect(n2.measure).toBe(2)
    expect(n2.tiedFrom).toBe(note.id)
    expect(n2.tiedTo).toBeUndefined()

    engine.renderScore() // both bars must still be exactly full
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

  // Multi-staff: dynamics are stamped with the placing staff's id so they render on that
  // staff (the placement paths resolve it via engine.staffIdForIndex). Index 0 → absent.
  it('staffIdForIndex follows the write convention (0 → absent, later → real id)', () => {
    engine.addStaffBelow(0)
    expect(engine.staffIdForIndex(0)).toBeUndefined()
    expect(engine.staffIdForIndex(1)).toBe(engine.getScore().staves![1].id)
  })

  it('stamps the staffId on a dynamic placed on a later staff', () => {
    engine.addStaffBelow(0)
    const staff1Id = engine.getScore().staves![1].id
    const d = engine.addDynamic(1, { beat: frac(0, 1), kind: 'level', level: 'f', staffId: staff1Id })
    expect(d?.staffId).toBe(staff1Id)
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

/**
 * convertToRest is NOT delete-then-refill: the rest keeps the slot's OWN authored length. Delete
 * leaves a gap and lets the meter-aware fill re-decide, which is right for a hole and wrong for a
 * silence that has a length. These tests pin the cases where the two would disagree.
 */
/**
 * A new REST evicts the same-voice rests it overlaps, exactly as a new chord does. It did not: the
 * rest branch of ScoreModel.addNote pushed and evicted nothing, so a quarter rest entered where a
 * half rest already sat left BOTH — the bar summed to 6 beats in 4/4 and only the render-time
 * integrity check noticed ("Δ +2 — OVERFULL"). Found live, from the console trace of a rest entered
 * at beat 2 of a bar holding a half rest there.
 *
 * `renderScore()` runs `repairAllMeasureGaps`, whose integrity check THROWS under Vitest — so these
 * tests fail loudly on a malformed bar rather than asserting a shape by hand.
 */
describe('MusicEngine — a new rest evicts the rests it overlaps', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('does not overfill the bar when a rest lands on a LONGER rest (the reported bug)', () => {
    // Two quarters at 0 and 1 leave an auto-filled half rest at beat 2 — the reported state.
    addNote(engine, { step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(1, 1) })
    const restAt2 = engine.getScore().measures[0].slots.find(s => fracToNumber(s.beat) === 2)!
    expect(restAt2.type).toBe('rest')
    expect(restAt2.duration).toBe('h') // the rest that gets landed on

    // A quarter rest at beat 2 must REPLACE that half rest, not stack on it.
    engine.addNoteAtBeat({ duration: 'q', measure: 1, beat: frac(2, 1), isRest: true })
    engine.renderScore() // throws if the bar is overfull

    const slots = engine.getScore().measures[0].slots
    expect(slots.filter(s => fracToNumber(s.beat) === 2)).toHaveLength(1)
  })

  it('replaces the whole-measure rest of an empty bar', () => {
    engine.addNoteAtBeat({ duration: 'q', measure: 1, beat: frac(0, 1), isRest: true })
    engine.renderScore()
    const atZero = engine.getScore().measures[0].slots.filter(s => fracToNumber(s.beat) === 0)
    expect(atZero).toHaveLength(1)
    expect(atZero[0].duration).toBe('q')
  })

  it('leaves the OTHER staff\'s rest alone', () => {
    engine.addStaffBelow(0)
    engine.addNoteAtBeat({ duration: 'q', measure: 1, beat: frac(0, 1), isRest: true, staff: 0 })
    engine.renderScore() // both staves must stay exactly full
    const staff1 = engine.getScore().measures[0].slots.filter(s => s.staffId === engine.getScore().staves![1].id)
    expect(staff1.length).toBeGreaterThan(0) // still has its own rest fill
  })
})

describe('MusicEngine.convertToRest', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('gives a rest of the note\'s own duration, at its beat', () => {
    const n = addNote(engine, { step: 'C', alter: 0, octave: 5, duration: 'h', measure: 1, beat: frac(2, 1) })
    const rest = engine.convertToRest(n.id)!
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('h')
    expect(fracToNumber(rest.beat)).toBe(2)
    expect(engine.getNote(n.id)).toBeFalsy() // the head is gone; the rest has a new id
  })

  it('keeps the DOTS — the fill would never invent a dotted rest in 4/4', () => {
    // A dotted quarter's silence is a dotted quarter rest. Deleting instead leaves [0,1.5) for
    // restFill, which in 4/4 answers with a quarter + an eighth (see the dotted-rests note): two
    // rests where the author wrote one length.
    const n = addNote(engine, { step: 'C', alter: 0, octave: 5, duration: 'q', dots: 1, measure: 1, beat: frac(0, 1) })
    const rest = engine.convertToRest(n.id)!
    expect(rest.duration).toBe('q')
    expect(rest.dots).toBe(1)
  })

  it('turns a whole CHORD into ONE rest — a rest cannot hold pitches', () => {
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    const rest = engine.convertToRest(c.id)!
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('q')
    expect(engine.getNote(e.id)).toBeFalsy() // the sibling head went with the slot
    const atBeat0 = engine.getScore().measures[0].slots.filter(s => fracToNumber(s.beat) === 0)
    expect(atBeat0).toHaveLength(1)
    expect(atBeat0[0].type).toBe('rest')
  })

  it('is a no-op on a rest — "un-rest this" would have to invent a pitch', () => {
    const n = addNote(engine, { step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = engine.convertToRest(n.id)!
    expect(engine.convertToRest(rest.id)).toBeNull()
  })

  it('keeps an ARRIVING tie, re-pointed at the rest (let-ring), and drops the LEAVING one', () => {
    // a —tie→ b, and b —tie→ c. Silencing b: a's arc survives onto the rest (the note rings into the
    // silence); b's own arc out to c dies, since a rest has nothing to carry.
    const a = addNote(engine, { step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(2, 1) })
    engine.toggleTie(a.id)
    engine.toggleTie(b.id)
    expect(engine.getNote(a.id)!.tiedTo).toBe(b.id)

    const rest = engine.convertToRest(b.id)!
    expect(engine.getNote(a.id)!.tiedTo).toBe(rest.id) // survived, re-pointed
    expect(engine.getNote(c.id)!.tiedFrom).toBeUndefined() // b's outgoing arc died with it
  })

  it('does not disturb the other staff\'s note at the same beat and voice', () => {
    // getChordNotesAt matches on (measure, beat, voice) only — two staves with a note at the same
    // beat in voice 0 is ordinary, and must not be mistaken for a chord.
    engine.addStaffBelow(0)
    const top = addNote(engine, { step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1), staff: 0 })
    const bottom = addNote(engine, { step: 'C', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), staff: 1 })
    const rest = engine.convertToRest(top.id)!
    expect(rest.isRest).toBe(true)
    expect(rest.duration).toBe('q')
    expect(engine.getNote(bottom.id)).toBeTruthy() // untouched
    expect(engine.getNote(bottom.id)!.isRest).toBeFalsy()
  })
})

describe('MusicEngine.toggleTie — staff scoping (multi-staff)', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
    engine.addStaffBelow(0)
  })

  it('ties within the source note\'s own staff, not across staves at the same position', () => {
    // Same pitch on BOTH staves at the next beat. Without staff scoping the tie would grab
    // whichever E3 the position-sorted search hit first (possibly staff 0); it must pick
    // the SAME-staff one.
    const s1a = addNote(engine, { step: 'E', alter: 0, octave: 3, duration: 'q', measure: 2, beat: frac(0, 1), staff: 1 })
    const s1b = addNote(engine, { step: 'E', alter: 0, octave: 3, duration: 'q', measure: 2, beat: frac(1, 1), staff: 1 })
    const s0b = addNote(engine, { step: 'E', alter: 0, octave: 3, duration: 'q', measure: 2, beat: frac(1, 1), staff: 0 })

    expect(engine.toggleTie(s1a.id)).toBe(true)
    expect(engine.getNote(s1a.id)!.tiedTo).toBe(s1b.id)
    expect(engine.getNote(s1b.id)!.tiedFrom).toBe(s1a.id)
    // The staff-0 note at the same beat is untouched.
    expect(engine.getNote(s0b.id)!.tiedFrom).toBeUndefined()
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

  it('toggleTie on a chord member ties to the matching pitch in the NEXT slot, not a sibling head', () => {
    // Chord G4 + D5 at beat 1, then a lone G4 at beat 2.
    const g1 = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const d5 = engine.addChordNote({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g2 = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    expect(engine.toggleTie(g1.id)).toBe(true)
    expect(engine.getNote(g1.id)!.tiedTo).toBe(g2.id)   // tied across to G4@2
    expect(engine.getNote(g1.id)!.tiedTo).not.toBe(d5.id) // NOT the chord sibling
    expect(engine.getNote(g2.id)!.tiedFrom).toBe(g1.id)
  })

  it('tieSelection ties EVERY selected note in a run, not just the last', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) }) // not selected

    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(true)
    expect(engine.getNote(a.id)!.tiedTo).toBe(b.id) // a → b
    expect(engine.getNote(b.id)!.tiedTo).toBe(c.id) // b → c
    expect(engine.getNote(c.id)!.tiedTo).toBeUndefined() // last selected note does NOT tie forward
  })

  it('tieSelection ties two chords pitch-for-pitch', () => {
    // Chord C4+E4 at beat 0, chord C4+E4 at beat 1.
    const c1 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e1 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c2 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const e2 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.tieSelection([c1.id, e1.id, c2.id, e2.id])).toBe(true)
    expect(engine.getNote(c1.id)!.tiedTo).toBe(c2.id) // C → C
    expect(engine.getNote(e1.id)!.tiedTo).toBe(e2.id) // E → E (not C)
    expect(engine.getNote(c2.id)!.tiedTo).toBeUndefined() // last chord not tied forward
    expect(engine.getNote(e2.id)!.tiedTo).toBeUndefined()
  })

  it('tieSelection on a single chord ties forward to the next slot', () => {
    const c1 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e1 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c2 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const e2 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Only the first chord selected → it ties to the next slot (single-position case).
    expect(engine.tieSelection([c1.id, e1.id])).toBe(true)
    expect(engine.getNote(c1.id)!.tiedTo).toBe(c2.id)
    expect(engine.getNote(e1.id)!.tiedTo).toBe(e2.id)
  })

  it('tieSelection toggles off when the whole run is already tied', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(true)
    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(false) // second press removes
    expect(engine.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedFrom).toBeUndefined()
  })

  it('toggleTie ties a chord member with no same pitch ahead to the next slot (let-ring)', () => {
    // Chord C4+C5 at beat 0, then a lone C4 at beat 1 — C5 has no partner.
    const c4 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c5 = engine.addChordNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c4next = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.toggleTie(c4.id)).toBe(true) // C4 → C4 (same pitch)
    expect(engine.getNote(c4.id)!.tiedTo).toBe(c4next.id)
    expect(engine.toggleTie(c5.id)).toBe(true) // C5 → next slot (let-ring), even without a C5
    expect(engine.getNote(c5.id)!.tiedTo).toBe(c4next.id)
  })

  it('deleting a target with TWO incoming ties reassigns BOTH to the replacement rest', () => {
    // Reproduces the reported bug: a chord C4+C5 tied forward to a lone C4 (C5 let-ring).
    const c4 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c5 = engine.addChordNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const target = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(engine.toggleTie(c4.id)).toBe(true)
    expect(engine.toggleTie(c5.id)).toBe(true)
    expect(engine.getNote(c4.id)!.tiedTo).toBe(target.id)
    expect(engine.getNote(c5.id)!.tiedTo).toBe(target.id)

    engine.deleteNote(target.id) // target becomes a rest

    const rest = engine.getScore().measures[0].slots.find(
      s => s.type === 'rest' && fracToNumber(s.beat) === 1,
    )!
    // BOTH ties survive and point at the rest — neither is dropped or left dangling.
    expect(engine.getNote(c4.id)!.tiedTo).toBe(rest.id)
    expect(engine.getNote(c5.id)!.tiedTo).toBe(rest.id)
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
  it('setSlurShape sets/clears the curve-shape override as one undo step', () => {
    // The shape now lives in the engraving-overrides compartment (staff-spaces), not on
    // the Slur. The engine/model pass the cps through verbatim — the px↔staff-space
    // conversion happens at the render/drag boundary, not here.
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(shapeOf(slur.id)).toBeUndefined() // default = auto shape

    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }]
    expect(engine.setSlurShape(slur.id, cps)).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps)

    expect(engine.undo()).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined() // undo reverts to auto

    expect(engine.redo()).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps)

    // Clearing with null drops the override back to auto.
    expect(engine.setSlurShape(slur.id, null)).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined()

    // Unknown id is a no-op.
    expect(engine.setSlurShape('nope', cps)).toBe(false)
  })

  it('nudgeSlurEndpoint accumulates the offset and saves exactly one undo step per press', () => {
    const offOf = (id: string) => endpointOffsetOverrideOf(engine.getScore(), id)?.start
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(offOf(slur.id)).toBeUndefined() // no nudge yet

    // Two presses → accumulated total, each undoable on its own.
    expect(engine.nudgeSlurEndpoint(slur.id, 'start', 0.25, 0)).toBe(true)
    expect(engine.nudgeSlurEndpoint(slur.id, 'start', 0.25, -0.5)).toBe(true)
    expect(offOf(slur.id)).toEqual({ x: 0.5, y: -0.5 })

    expect(engine.undo()).toBe(true) // undo the 2nd press only
    expect(offOf(slur.id)).toEqual({ x: 0.25, y: 0 })
    expect(engine.undo()).toBe(true) // undo the 1st press
    expect(offOf(slur.id)).toBeUndefined()

    // Unknown id is a no-op.
    expect(engine.nudgeSlurEndpoint('nope', 'start', 1, 1)).toBe(false)
  })

  it('nudgeSlurSegmentEndpoint accumulates the open-join offset and saves one undo step per press', () => {
    const beginOf = (id: string) => segmentEndpointOffsetOverrideOf(engine.getScore(), id)?.begin
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(beginOf(slur.id)).toBeUndefined()

    // Two presses on the BEGIN open right end → accumulated total, each individually undoable.
    expect(engine.nudgeSlurSegmentEndpoint(slur.id, { role: 'begin' }, 0, -0.25, 2)).toBe(true)
    expect(engine.nudgeSlurSegmentEndpoint(slur.id, { role: 'begin' }, 0, -0.25, 2)).toBe(true)
    expect(beginOf(slur.id)).toEqual({ x: 0, y: -0.5 })

    expect(engine.undo()).toBe(true)
    expect(beginOf(slur.id)).toEqual({ x: 0, y: -0.25 })
    expect(engine.undo()).toBe(true)
    expect(beginOf(slur.id)).toBeUndefined()

    expect(engine.nudgeSlurSegmentEndpoint('nope', { role: 'begin' }, 1, 1, 2)).toBe(false)
  })

  it('previewSlurShape (no undo) + commitSlurShape (one undo) = a single reshape step', () => {
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    expect(shapeOf(slur.id)).toBeUndefined()

    // Several live preview updates during a "drag" — none record undo.
    const cps1: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.1, y: 1.0 }, { x: 0.1, y: 1.0 }]
    const cps2: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.5, y: 1.8 }, { x: -0.2, y: 1.6 }]
    expect(engine.previewSlurShape(slur.id, cps1)).toBe(true)
    expect(engine.previewSlurShape(slur.id, cps2)).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps2)

    engine.commitSlurShape() // one undo entry for the whole drag

    expect(engine.undo()).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined() // reverts past the entire drag to the auto shape
    expect(engine.redo()).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps2) // redo restores the final dragged shape
  })

  it('previewSlurShape routes a segment address to the per-segment override, not curveShape', () => {
    const curveOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)
    const segOf = (id: string) => segmentCurveShapeOverrideOf(engine.getScore(), id)
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id])!
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.3, y: 1.2 }, { x: -0.1, y: 1.4 }]

    // A cross-system drag carries a segment address + the live span count → segmentCurveShape.
    expect(engine.previewSlurShape(slur.id, cps, { role: 'middle', ordinal: 0 }, 3)).toBe(true)
    expect(curveOf(slur.id)).toBeUndefined()                 // NOT the whole-arc shape
    expect(segOf(slur.id)).toMatchObject({ spanCount: 3, middles: { 0: cps } })

    // No address (a same-line drag) still routes to the single-arc curveShape.
    expect(engine.previewSlurShape(slur.id, cps)).toBe(true)
    expect(curveOf(slur.id)).toMatchObject({ cps })
  })

  // --- Phase 2: conservative auto-reset of the curve-shape override ---
  describe('curve-shape override auto-reset (Phase 2)', () => {
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }]
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps

    it('drops the override when the slur is deleted (and prunes the compartment)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.createSlur([a.id])!
      engine.setSlurShape(slur.id, cps)
      expect(shapeOf(slur.id)).toEqual(cps)

      expect(engine.removeSlur(slur.id)).toBe(true)
      expect(shapeOf(slur.id)).toBeUndefined()
      expect(engine.getScore().engravingOverrides).toBeUndefined() // pruned clean
    })

    it('drops the override when an endpoint note is deleted (re-anchored onto the replacement rest)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.createSlur([a.id, b.id])! // spans a → b
      engine.setSlurShape(slur.id, cps)
      expect(shapeOf(slur.id)).toEqual(cps)

      engine.deleteNote(b.id) // b → rest; slur re-anchors its end onto the rest (different element)
      expect(engine.getSlurById(slur.id)).not.toBeNull() // slur survives, re-anchored
      expect(shapeOf(slur.id)).toBeUndefined() // but its hand-tuned shape is gone
    })

    it('stays sticky across a non-breaking edit (anchors survive)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.createSlur([a.id])!
      engine.setSlurShape(slur.id, cps)

      // Add a note elsewhere — neither slur endpoint is touched, so the shape persists.
      addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
      expect(shapeOf(slur.id)).toEqual(cps)
    })
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

describe('MusicEngine tempo marks', () => {
  let engine: MusicEngine
  beforeEach(() => { engine = makeEngine() })

  const marksOf = (m: number) => engine.getTempoMarks(m)

  it('adds a word, a metronome, or both — the TEXT says which; the bpm says how fast', () => {
    // A word that sounds without printing its number; a bare metronome; both together. The mark is
    // its text, so "is the metronome printed?" is answered by looking at it — there is no flag.
    engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })
    engine.addTempoMark(1, { beat: frac(1, 1), text: '♩ = 120', unit: 'q', bpm: 120 })
    engine.addTempoMark(1, { beat: frac(2, 1), text: 'Adagio (♩ = 65)', unit: 'q', bpm: 65 })

    expect(marksOf(1).map(t => [t.text, t.bpm])).toEqual([
      ['Allegro', 144],
      ['♩ = 120', 120],
      ['Adagio (♩ = 65)', 65],
    ])
  })

  it('a word-only mark sounds at the prevailing tempo (it prints, it does not re-clock)', () => {
    engine.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })
    engine.addTempoMark(1, { beat: frac(2, 1), text: 'dolce' }) // no bpm
    expect(engine.getEffectiveTempoAt(1, frac(3, 1))).toBe(60)
  })

  it('resolves the tempo positionally, falling back to DEFAULT_TEMPO (no score.tempo)', () => {
    expect(engine.getEffectiveTempoAt(1, frac(0, 1))).toBe(DEFAULT_TEMPO)
    engine.addTempoMark(1, { beat: frac(2, 1), unit: 'h', bpm: 60 }) // 𝅗𝅥 = 60 → 120 qpm
    expect(engine.getEffectiveTempoAt(1, frac(1, 1))).toBe(DEFAULT_TEMPO) // before the mark
    expect(engine.getEffectiveTempoAt(1, frac(2, 1))).toBe(120) // the unit is half the meaning
  })

  it('replaces a mark already on the beat (one clock statement per point in time)', () => {
    engine.addTempoMark(1, { beat: frac(0, 1), text: 'Largo', bpm: 50 })
    engine.addTempoMark(1, { beat: frac(0, 1), text: 'Presto', bpm: 185 })
    expect(marksOf(1)).toHaveLength(1) // NOT stacked (that is the dynamics rule)
    expect(marksOf(1)[0].text).toBe('Presto')
  })

  it('rejects a bpm that would make the clock nonsense', () => {
    expect(() => engine.addTempoMark(1, { beat: frac(0, 1), bpm: 0 })).toThrow(/between 20 and 300/)
    expect(() => engine.addTempoMark(1, { beat: frac(0, 1), bpm: 500 })).toThrow(/between 20 and 300/)
    expect(marksOf(1)).toHaveLength(0)
  })

  it('editing the word leaves the bpm untouched, and vice versa (decision D2)', () => {
    const mark = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })!

    engine.updateTempoMark(mark.id, { text: 'Allegro con brio' })
    expect(marksOf(1)[0]).toMatchObject({ id: mark.id, text: 'Allegro con brio', bpm: 144 })

    engine.updateTempoMark(mark.id, { bpm: 152 })
    expect(marksOf(1)[0]).toMatchObject({ id: mark.id, text: 'Allegro con brio', bpm: 152 })
  })

  it('removes a mark, reverting to the previous tempo', () => {
    engine.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })
    const second = engine.addTempoMark(1, { beat: frac(2, 1), bpm: 180 })!

    expect(engine.removeTempoMark(second.id)).toBe(true)
    expect(engine.getEffectiveTempoAt(1, frac(3, 1))).toBe(60)
    expect(engine.removeTempoMark('nope')).toBe(false)
  })

  it('drops the array when the last mark is removed (no empty tempos: [] in JSON)', () => {
    const mark = engine.addTempoMark(1, { beat: frac(0, 1), bpm: 60 })!
    engine.removeTempoMark(mark.id)
    expect(engine.getScore().measures[0].tempos).toBeUndefined()
  })

  it('undo/redo restores and re-applies add, edit and remove', () => {
    const mark = engine.addTempoMark(1, { beat: frac(0, 1), text: 'Allegro', bpm: 144 })!
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)).toHaveLength(0) // the add is undone
    expect(engine.redo()).toBe(true)
    expect(marksOf(1)).toHaveLength(1)

    engine.updateTempoMark(marksOf(1)[0].id, { bpm: 60 })
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)[0].bpm).toBe(144) // the edit is undone

    engine.removeTempoMark(marksOf(1)[0].id)
    expect(marksOf(1)).toHaveLength(0)
    expect(engine.undo()).toBe(true)
    expect(marksOf(1)[0]).toMatchObject({ text: 'Allegro', bpm: 144 }) // the removal is undone
    void mark
  })
})

/**
 * Linear view's staff-spacing VIEW KNOB (docs/linear-view-plan.md §4.2b). The point of the
 * feature is what it does NOT do: it moves the staves you are looking at, and touches neither the
 * score nor the undo stack. These tests exist to keep it that way — the moment one of them has to
 * be relaxed, the knob has stopped being a view knob and belongs in a real layout scope.
 */
describe('MusicEngine — linear-view staff spacing (the view knob)', () => {
  it('moves the staves in linear view, and writes NOTHING to the score', () => {
    const engine = makeEngine()
    engine.addStaffBelow(0)
    engine.setViewMode('linear')

    expect(engine.nudgeStaffSpacing(1, 1, 4)).toBe(true)
    expect(engine.getStaffSpacingAbove(1, 1)).toBe(4) // the view moved…

    // …and the score did not. No engravingOverrides, nothing in the JSON at all.
    expect(engine.getScore().engravingOverrides).toBeUndefined()
    expect(engine.exportJSON()).not.toContain('taffSpacing')
  })

  it('records no undo step — nothing about the score changed', () => {
    const engine = makeEngine()
    engine.addStaffBelow(0)
    engine.setViewMode('linear')

    const before = engine.canUndo()
    engine.nudgeStaffSpacing(1, 1, 4)
    engine.previewStaffSpacing(1, 1, 7)
    engine.commitStaffSpacing()
    expect(engine.canUndo()).toBe(before)
  })

  it('is invisible to wrapped view, and survives a round trip back to linear', () => {
    const engine = makeEngine()
    engine.addStaffBelow(0)
    engine.setViewMode('linear')
    engine.nudgeStaffSpacing(1, 1, 4)

    // Wrapped view resolves its own (unset) spacing — the knob does not leak into it.
    engine.setViewMode('wrapped')
    expect(engine.getStaffSpacingAbove(1, 1)).toBe(0)

    // Back in linear, it is still where the user left it (ephemeral, but not amnesiac).
    engine.setViewMode('linear')
    expect(engine.getStaffSpacingAbove(1, 1)).toBe(4)
  })

  it('resets back to the score-derived spacing', () => {
    const engine = makeEngine()
    engine.addStaffBelow(0)
    engine.setViewMode('linear')
    engine.nudgeStaffSpacing(1, 1, 4)

    expect(engine.resetStaffSpacing(1, 1)).toBe(true)
    expect(engine.getStaffSpacingAbove(1, 1)).toBe(0)
    expect(engine.resetStaffSpacing(1, 1)).toBe(false) // nothing left to reset
  })
})

/**
 * P3 — a selection change must not redraw the score (docs/render-performance-plan.md §5a).
 *
 * The skip is only safe if `isRenderStale()` is honest about *content*: a missed dirty-flag is a
 * measure that renders stale forever. So the contract is pinned here — including the three live-drag
 * paths (`preview*`) that mutate the model but defer their undo entry, and therefore never pass
 * through `saveUndoState`, the one place that used to set the flag.
 */
describe('isRenderStale (P3 skip test)', () => {
  it('is clean right after a render, and no selection-shaped read dirties it', () => {
    const engine = makeEngine()
    engine.renderScore()
    expect(engine.isRenderStale()).toBe(false)

    // The whole point: reading the score / looking things up is not a content change.
    engine.getScore()
    engine.getNote('nope')
    expect(engine.isRenderStale()).toBe(false)
  })

  it('goes stale on an edit, and clean again once rendered', () => {
    const engine = makeEngine()
    engine.renderScore()

    const note = addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    expect(engine.isRenderStale()).toBe(true)

    engine.renderScore()
    expect(engine.isRenderStale()).toBe(false)

    engine.deleteNote(note.id)
    expect(engine.isRenderStale()).toBe(true)
  })

  it('goes stale on undo and redo', () => {
    const engine = makeEngine()
    addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    engine.renderScore()

    expect(engine.undo()).toBe(true)
    expect(engine.isRenderStale()).toBe(true)
    engine.renderScore()

    expect(engine.redo()).toBe(true)
    expect(engine.isRenderStale()).toBe(true)
  })

  it('goes stale on a live slur-shape drag — which defers its undo entry, so nothing else flags it', () => {
    const engine = makeEngine()
    const a = addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id, b.id])!
    engine.renderScore()
    expect(engine.isRenderStale()).toBe(false)

    engine.previewSlurShape(slur.id, [{ x: 1, y: 2 }, { x: 3, y: 4 }])
    expect(engine.isRenderStale()).toBe(true)
  })

  it('the DROP of a drag is undoable but not stale — the picture is already on screen', () => {
    // commitSlurShape records history; it changes no content (previewSlurShape already did, and
    // its render already showed it). Flagging it dirty re-engraved the whole score to paint what
    // was already there — a full render on every drag release.
    const engine = makeEngine()
    const a = addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.createSlur([a.id, b.id])!

    engine.previewSlurShape(slur.id, [{ x: 1, y: 2 }, { x: 3, y: 4 }])
    expect(engine.isRenderStale()).toBe(true) // the drag itself DOES need a redraw
    engine.renderScore()

    engine.commitSlurShape()

    expect(engine.canUndo()).toBe(true)
    expect(engine.getUndoDescription()).toBe('Reshape slur') // history recorded…
    expect(engine.isRenderStale()).toBe(false)               // …but nothing to redraw
  })

  it('goes stale on a live staff-spacing drag (same deferred-undo shape)', () => {
    const engine = makeEngine()
    engine.addStaffBelow(0)
    engine.renderScore()
    expect(engine.isRenderStale()).toBe(false)

    engine.previewStaffSpacing(1, 1, 3)
    expect(engine.isRenderStale()).toBe(true)
  })
})

/**
 * `runBatch` used to answer "did `fn` change anything?" by stringifying the WHOLE SCORE before
 * and after and comparing — two full serializations per batched edit, on top of the deep clone
 * `pushState` already does (docs/render-performance-plan.md §7). Every mutation that wants an undo
 * entry already calls `saveUndoState`, which counts the request even while suppressed, so the
 * answer was there for free.
 */
describe('runBatch — change detection without serializing the score', () => {
  it('a batch that edits pushes ONE undo entry for the whole group', () => {
    const engine = makeEngine()
    addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const before = engine.getUndoDescription()

    const changed = engine.runBatch('Batch of edits', () => {
      addNote(engine, { step: 'E', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      addNote(engine, { step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    })

    expect(changed).toBe(true)
    expect(engine.getUndoDescription()).toBe('Batch of edits') // one entry, not two
    expect(engine.getUndoDescription()).not.toBe(before)

    // …and ONE undo takes the whole group back: three chords → one.
    const chords = () => engine.getScore().measures[0].slots.filter(s => s.type === 'chord').length
    expect(chords()).toBe(3)
    expect(engine.undo()).toBe(true)
    expect(chords()).toBe(1)
  })

  it('a batch that does nothing pushes nothing', () => {
    const engine = makeEngine()
    addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const before = engine.getUndoDescription()

    const changed = engine.runBatch('Nothing happens', () => {
      engine.getScore()                 // a read
      engine.deleteNote('no-such-note') // a no-op
    })

    expect(changed).toBe(false)
    expect(engine.getUndoDescription()).toBe(before) // no entry pushed
  })

  it('a nested batch is flattened — only the outermost pushes', () => {
    const engine = makeEngine()

    engine.runBatch('Outer', () => {
      const inner = engine.runBatch('Inner', () => {
        addNote(engine, { step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      })
      expect(inner).toBe(false) // the outer batch owns the snapshot
    })

    expect(engine.getUndoDescription()).toBe('Outer')
  })

  /**
   * REGRESSION. `runBatch` asks "did anything ASK to be saved?", so a mutator that changes the model
   * without calling `saveUndoState` is invisible to it: the batch pushes nothing, and — because
   * `saveUndoState` is the ONLY caller of `markModelDirty()` — the model is never flagged dirty
   * either. The next render is then skipped as "nothing changed".
   *
   * `toggleRestHidden` was written exactly that way, on the reasoning that the batch would own its
   * snapshot. Hiding a rest therefore did nothing visible until some *other* edit forced a redraw,
   * and Ctrl+Z could not bring it back.
   */
  it('hiding a rest inside a batch marks the score dirty AND is undoable', () => {
    const engine = makeEngine()
    // A quarter note at beat 0 leaves rests filling the rest of the bar.
    addNote(engine, { step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const rest = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!
    engine.renderScore() // settle: the render below must be provoked by the hide, not by the note

    const changed = engine.runBatch('Hide/Show 1 rest(s)', () => {
      expect(engine.toggleRestHidden(rest.id)).toBe(true)
    })

    // The batch must SEE the mutation...
    expect(changed, 'the batch did not notice the rest was hidden').toBe(true)
    // ...so the next render actually happens...
    expect(engine.isRenderStale(), 'the hide would not repaint until some other edit').toBe(true)
    // ...and it is undoable.
    expect(engine.getUndoDescription()).toBe('Hide/Show 1 rest(s)')
  })
})

/**
 * P6 — the virtualization window (docs/render-performance-plan.md §8).
 *
 * The whole risk of culling is that it turns scrolling — today a free CSS scroll — into a redraw. It
 * doesn't, and this is why: the engine draws a window *larger* than the viewport, and only re-cuts it
 * when the viewport escapes what it already drew. `setVisibleRect` answering `false` IS the promise
 * that a scroll costs nothing.
 */
describe('MusicEngine.setVisibleRect — P6 virtualization window', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  const VIEW = { x: 1000, y: 1000, width: 800, height: 600 }

  it('the FIRST sighting always owes a render — nothing has been culled yet', () => {
    expect(engine.setVisibleRect(VIEW)).toBe(true)
  })

  it('a small scroll owes NOTHING — it stays inside the overscan already drawn', () => {
    engine.setVisibleRect(VIEW)
    // 50px down, well inside a 0.5-viewport (300px) overscan margin.
    expect(engine.setVisibleRect({ ...VIEW, y: VIEW.y + 50 })).toBe(false)
  })

  it('a scroll that ESCAPES the drawn window owes a render', () => {
    engine.setVisibleRect(VIEW)
    // Past the bottom of the overscan: bars below have never been engraved.
    expect(engine.setVisibleRect({ ...VIEW, y: VIEW.y + 1000 })).toBe(true)
  })

  it('a viewport with no size yet culls NOTHING — the whole score still draws', () => {
    // Before layout the DOM reports 0×0. Culling against that would erase the score.
    expect(engine.setVisibleRect({ x: 0, y: 0, width: 0, height: 0 })).toBe(false)
  })

  it('zooming out far enough to see everything re-cuts the window', () => {
    engine.setVisibleRect(VIEW)
    // Ctrl+- to 25%: the same screen box now covers 4× the music (§8's inverted cost curve).
    expect(engine.setVisibleRect({ x: 0, y: 0, width: 3200, height: 2400 })).toBe(true)
  })
})
