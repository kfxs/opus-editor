import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { fracToNumber } from '@/utils/fraction'
import { KeyboardController } from './KeyboardController'
import { getMeasureNotes } from '../utils/musicUtils'
import { fracCreate as frac, fracEq } from '@/utils/fraction'

// Characterization tests: they describe what KeyboardController DOES today, so the
// Tier 2 decomposition can lean on them. They assert observable outcomes (engine
// state, cursor advance, tool transitions), not internals.

// Stub VexFlowRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio).
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    // Enough of the renderer for engine.renderScore() to run: it is the only way to reach
    // repairAllMeasureGaps, whose integrity check THROWS under Vitest — so a test that renders
    // fails on a malformed bar instead of asserting the shape by hand.
    setLayoutReusable = vi.fn()
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    getAllMeasureBounds = vi.fn(() => new Map())
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn()
    setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}

const measure1 = (engine: MusicEngine) => engine.getScore().measures.find(m => m.number === 1)!
const notesAtBeat = (engine: MusicEngine, beatNum: number) =>
  getMeasureNotes(measure1(engine)).filter(n => !n.isRest && fracEq(n.beat, frac(beatNum, 1)))

describe('KeyboardController', () => {
  let engine: MusicEngine
  let state: EditorState
  let kb: KeyboardController
  let renderCount: number

  // Build a controller whose setSelectedNote also mirrors into state (the real app
  // routes through SelectionController, which keeps state.selectedNoteId in sync).
  const makeController = (contextPitch = 60) => {
    renderCount = 0
    return new KeyboardController(
      () => engine,
      state,
      () => undefined,               // pending articulations
      () => { renderCount++ },        // renderScore
      (id) => { state.selectedNoteId = id },  // setSelectedNote (cursor)
      () => contextPitch,             // context pitch (C4 = 60)
    )
  }

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    kb = makeController()
  })

  describe('enterNoteByLetter — edit in place (selection mode)', () => {
    it('replaces the selected note in place and switches to entry mode', () => {
      const id = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      state.selectedTool = 'selection'
      state.selectedNoteId = id

      kb.enterNoteByLetter('d')

      const note = engine.getNote(id)!
      expect(note.step).toBe('D')        // same id, edited in place
      expect(note.octave).toBe(4)        // nearest D to context pitch 60 → D4
      expect(note.isRest).toBe(false)
      expect(state.selectedTool).toBe('entry') // selection → keyboard entry mode
      expect(renderCount).toBe(1)
    })

    it('turns a selected rest into a note in place', () => {
      // beat 1 left as a rest after placing a note on beat 0
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const rest = getMeasureNotes(measure1(engine)).find(n => n.isRest && fracEq(n.beat, frac(1, 1)))!
      state.selectedTool = 'selection'
      state.selectedNoteId = rest.id

      kb.enterNoteByLetter('e')

      expect(engine.getNote(rest.id)!.isRest).toBe(false)
      expect(engine.getNote(rest.id)!.step).toBe('E')
    })

    it('is a no-op with no selected note', () => {
      state.selectedTool = 'selection'
      state.selectedNoteId = null
      kb.enterNoteByLetter('d')
      expect(renderCount).toBe(0)
    })

    it('ignores non-letter keys', () => {
      const id = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      state.selectedTool = 'selection'
      state.selectedNoteId = id
      kb.enterNoteByLetter('z')
      expect(engine.getNote(id)!.step).toBe('C') // unchanged
      expect(renderCount).toBe(0)
    })
  })

  describe('enterNoteByLetter — cursor placement (entry mode)', () => {
    it('places a new note at the beat after the cursor and advances the cursor', () => {
      const n0 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      state.selectedTool = 'entry'
      state.selectedNoteId = n0

      kb.enterNoteByLetter('e')  // entry mode → enterNoteAtCursorPosition

      const placed = notesAtBeat(engine, 1)
      expect(placed).toHaveLength(1)
      expect(placed[0].step).toBe('E')
      // cursor advanced onto the newly placed note
      expect(state.selectedNoteId).toBe(placed[0].id)
      expect(state.selectedNoteId).not.toBe(n0)
    })

    it('flows a secondary voice into the next measure even when that voice is empty there', () => {
      // Two measures; voice 2 fills measure 1 (a whole note) but has NO content in
      // measure 2. The voice-2 beat stream therefore ends at the m1 barline.
      while (engine.getScore().measures.length < 2) engine.addMeasure()
      const v2 = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'w', measure: 1, beat: frac(0, 1), voice: 1 })!.id
      state.selectedTool = 'entry'
      state.selectedDuration = 'q'
      state.selectedNoteId = v2

      kb.enterNoteByLetter('d') // entry mode → enterNoteAtCursorPosition

      // The note must land at the downbeat of measure 2, in voice 2 (not stall at the barline).
      const m2 = engine.getScore().measures.find(m => m.number === 2)!
      const placed = getMeasureNotes(m2).filter(n => !n.isRest && (n.voice ?? 0) === 1)
      expect(placed).toHaveLength(1)
      expect(placed[0].step).toBe('D')
      expect(fracEq(placed[0].beat, frac(0, 1))).toBe(true)
      expect(state.selectedNoteId).toBe(placed[0].id) // cursor followed into measure 2
    })
  })

  describe('addChordNoteByLetter (Shift + letter)', () => {
    it('adds a higher note to the chord at the selected note', () => {
      const id = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      state.selectedTool = 'selection'
      state.selectedNoteId = id

      kb.addChordNoteByLetter('e')

      const chord = notesAtBeat(engine, 0)
      expect(chord).toHaveLength(2)
      expect(chord.some(n => n.step === 'C')).toBe(true)
      expect(chord.some(n => n.step === 'E' && n.octave === 4)).toBe(true)
    })

    it('stacks the chord note in the SELECTED note\'s voice (multi-voice)', () => {
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1), voice: 0 })
      const v2 = engine.addNoteAtBeat({ step: 'A', alter: 0, octave: 3, duration: 'q', measure: 1, beat: frac(0, 1), voice: 1 })!.id
      state.selectedTool = 'selection'
      state.selectedNoteId = v2

      kb.addChordNoteByLetter('c') // C above the A3 in voice 2

      const chord = notesAtBeat(engine, 0)
      const added = chord.find(n => n.step === 'C' && n.octave === 4 && (n.voice ?? 0) === 1)
      expect(added).toBeDefined()                 // landed in voice 2, not voice 1
      // voice 1 still just its single C4; the new note did not merge there
      expect(chord.filter(n => (n.voice ?? 0) === 0)).toHaveLength(1)
      expect(chord.filter(n => (n.voice ?? 0) === 1)).toHaveLength(2)
    })

    it('falls back to edit-in-place when a rest is selected', () => {
      engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const rest = getMeasureNotes(measure1(engine)).find(n => n.isRest && fracEq(n.beat, frac(1, 1)))!
      state.selectedTool = 'selection'
      state.selectedNoteId = rest.id

      kb.addChordNoteByLetter('d')

      expect(engine.getNote(rest.id)!.isRest).toBe(false) // became a note (no chord on a rest)
      expect(notesAtBeat(engine, 1)).toHaveLength(1)
    })
  })
})

/**
 * A note that overflows the bar is split into tied pieces. The caret must land after the LAST of
 * them — you typed one note, so the next one comes after all of it.
 */
describe('KeyboardController — cursor after a tie-split entry', () => {
  let engine: MusicEngine
  let state: EditorState
  let kb: KeyboardController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    kb = new KeyboardController(
      () => engine, state, () => undefined, () => {},
      (id) => { state.selectedNoteId = id }, () => 60,
    )
  })

  it('lands on the LAST tied piece, not the head (reported)', () => {
    // Reported: G4 quarter at beat 0, then a WHOLE from beat 1 of 4/4 → h@1 tied to q@3 tied to
    // q@m2b0. The caret landed on the h at beat 1 — inside the note just typed — so the next entry
    // would overwrite it.
    const g = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'entry'
    state.selectedNoteId = g.id
    state.selectedDuration = 'w'

    kb.enterNoteAtCursorPosition('A')

    const landed = engine.getNote(state.selectedNoteId!)!
    expect(landed.measure).toBe(2)              // the tail, in the NEXT bar
    expect(fracToNumber(landed.beat)).toBe(0)
    expect(landed.tiedTo).toBeUndefined()       // genuinely the end of the chain
  })
})
