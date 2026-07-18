import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { fracToNumber } from '@/utils/fraction'
import { KeyboardController } from './KeyboardController'
import { SelectionController } from './SelectionController'
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
 * SPACE in keyboard entry: the typewriter. Types a rest of the current duration at the caret and
 * moves on — armed OR not, so fast note+rest entry needs no tool switch. Shares fitRestDuration with
 * the mouse stamp, so a barline means the same thing to both.
 */
describe('KeyboardController.enterRestAtCursor (SPACE)', () => {
  let engine: MusicEngine
  let state: EditorState
  let kb: KeyboardController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    // Drive the REAL SelectionController — the app wires keyboard entry to selection.moveCaretTo
    // (useKeyboardEntry). A hand-mirrored stub was what made these tests lie: one that only moved
    // the caret hid the clobber, and one patched to sync duration+dots would now (with the restore
    // deleted) reintroduce it. The real moveCaretTo leaves the palette alone, so the armed length
    // survives an advance the way the app does — and any regression that re-syncs it fails here.
    const selection = new SelectionController(() => engine, state, () => {}, () => {})
    kb = new KeyboardController(
      () => engine, state, () => undefined, () => {},
      (id) => selection.moveCaretTo(id),
      () => 60,
    )
  })

  /** Put the caret on a note at beat 0 of bar 1, in keyboard entry with the rest stamp armed. */
  const armAtBeat0 = () => {
    const n = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'entry'
    state.selectedNoteId = n.id
    state.selectedMarkingTool = { kind: 'rest' }
    return n
  }

  const restAt = (measure: number, beat: number) =>
    getMeasureNotes(engine.getScore().measures.find(m => m.number === measure)!)
      .find(n => n.isRest && fracToNumber(n.beat) === beat)

  it('types a rest even when the stamp is NOT armed — SPACE is the fast-entry shortcut', () => {
    // The whole point: in entry mode you type letters for notes and tap SPACE for a rest of the same
    // length, without first selecting the rest tool. It uses the armed palette duration.
    armAtBeat0()
    state.selectedMarkingTool = null   // no rest tool armed — pure note entry
    state.selectedDuration = 'q'
    expect(kb.enterRestAtCursor()).toBe(true)
    expect(restAt(1, 1)!.duration).toBe('q')
  })

  it('declines outside keyboard entry — SPACE keeps its selection-mode job', () => {
    armAtBeat0()
    state.selectedTool = 'selection'
    expect(kb.enterRestAtCursor()).toBe(false)
  })

  it('types the armed rest at the caret and advances onto it', () => {
    armAtBeat0()
    state.selectedDuration = 'q'
    expect(kb.enterRestAtCursor()).toBe(true)
    const rest = restAt(1, 1)!
    expect(rest.duration).toBe('q')
    expect(state.selectedNoteId).toBe(rest.id) // the caret followed what was typed
  })

  it('types the same rest again — the armed length is not consumed', () => {
    armAtBeat0()
    state.selectedDuration = 'q'
    kb.enterRestAtCursor()
    kb.enterRestAtCursor()
    expect(restAt(1, 1)!.duration).toBe('q')
    expect(restAt(1, 2)!.duration).toBe('q')
  })

  it('types a DOTTED rest when one is armed', () => {
    armAtBeat0()
    state.selectedDuration = 'q'
    state.selectedDots = 1
    kb.enterRestAtCursor()
    const rest = restAt(1, 1)!
    expect(rest.duration).toBe('q')
    expect(rest.dots).toBe(1)
  })

  it('caps at the barline to the longest value that fits — 3 beats is a DOTTED HALF', () => {
    // Caret on the quarter at beat 0 of 4/4 → the rest lands at beat 1 with 3 beats left. A whole
    // does not fit, and the answer is one dotted half, not a half + a quarter.
    armAtBeat0()
    state.selectedDuration = 'w'
    kb.enterRestAtCursor()
    const rest = restAt(1, 1)!
    expect(rest.duration).toBe('h')
    expect(rest.dots).toBe(1)
  })

  it('never splits across the barline — the bar stays exactly full', () => {
    armAtBeat0()
    state.selectedDuration = 'w'
    kb.enterRestAtCursor()
    engine.renderScore() // integrity check throws under Vitest if the bar is malformed
    expect(getMeasureNotes(engine.getScore().measures[1]).every(n => n.isRest)).toBe(true) // bar 2 untouched
  })

  it('keeps the ARMED length when a cap trims one entry — a cap is not a choice', () => {
    // Reported: arm a WHOLE, SPACE (capped to a dotted half at beat 1, filling bar 1), SPACE again —
    // and bar 2 got a dotted half instead of the whole that fits there. The caret landing on the
    // capped rest synced the palette TO it (SelectionController.syncPaletteToNote), so the cap
    // silently became the armed length.
    armAtBeat0()
    state.selectedDuration = 'w'
    kb.enterRestAtCursor()
    expect(restAt(1, 1)!.dots).toBe(1)          // trimmed to a dotted half, as it must be
    expect(state.selectedDuration).toBe('w')    // …but the WHOLE is still what is armed
    expect(state.selectedDots).toBe(0)

    kb.enterRestAtCursor()                 // bar 2 is empty: the whole fits
    const rest = restAt(2, 0)!
    expect(rest.duration).toBe('w')
    expect(rest.dots ?? 0).toBe(0)
  })

  it('DISARMS when a note is typed — the panel must not say "rests" while notes come out', () => {
    armAtBeat0()
    kb.enterNoteByLetter('a')
    expect(state.selectedMarkingTool).toBeNull()
    expect(state.selectedTool).toBe('entry') // still typing, just notes now
  })

  it('disarms on a chord note too (Shift+letter is still typing a note)', () => {
    armAtBeat0()
    kb.addChordNoteByLetter('e')
    expect(state.selectedMarkingTool).toBeNull()
  })

  it('leaves the armed LENGTH alone when it disarms', () => {
    armAtBeat0()
    state.selectedDuration = 'h'
    kb.enterNoteByLetter('a')
    expect(state.selectedDuration).toBe('h') // the quarter you were resting is the quarter you note
  })

  it('lands the caret in the NEXT measure once the rest finishes the bar', () => {
    // The dotted half above fills beats 1–4, so the next SPACE must land at bar 2 beat 0.
    armAtBeat0()
    state.selectedDuration = 'w'
    kb.enterRestAtCursor()   // dotted half at beat 1 → bar 1 is full
    state.selectedDuration = 'q'
    kb.enterRestAtCursor()   // → the carriage has moved on
    expect(restAt(2, 0)).toBeTruthy()
    expect(state.selectedNoteId).toBe(restAt(2, 0)!.id)
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
    // Real SelectionController + moveCaretTo, mirroring the app (useKeyboardEntry). See the note on
    // the SPACE suite above: the fix lives in moveCaretTo NOT re-arming the palette, so the armed
    // length must be checked against the real controller, not a stub of the thing under test.
    const selection = new SelectionController(() => engine, state, () => {}, () => {})
    kb = new KeyboardController(
      () => engine, state, () => undefined, () => {},
      (id) => selection.moveCaretTo(id),
      () => 60,
    )
  })

  it('KEEPS the armed length after a split — the Keypad must not show the tail (reported)', () => {
    // Reported: arm a WHOLE, enter it on beat 1 of 4/4 → a dotted half tied to a quarter. The caret
    // lands on the QUARTER (correctly — it is the end of the note), and the palette synced to it, so
    // the Keypad said "negra" and the next note came out a quarter. The split is what the barline
    // allowed; the armed length is what you asked for.
    const g = engine.addNoteAtBeat({ step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'entry'
    state.selectedNoteId = g.id
    state.selectedDuration = 'w'

    kb.enterNoteAtCursorPosition('A')

    expect(state.selectedDuration).toBe('w')  // still the whole you armed
    expect(state.selectedDots).toBe(0)
    // …and the caret really is on the quarter tail, so the sync had something to clobber with.
    expect(engine.getNote(state.selectedNoteId!)!.duration).toBe('q')
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

/**
 * §6 of the caret-is-not-a-selection plan: an armed accidental must last exactly ONE note. It used
 * to leak onto every note after it — enterNoteAtCursorPosition clears selectedAccidental to null,
 * but the old setSelectedNote immediately synced it BACK from the A# the caret landed on, so a sharp
 * armed for one note stuck forever. Only the REAL SelectionController shows this — a stub that syncs
 * only duration/dots (the last bug's shape) reads "no leak" and lies. Drive the real thing.
 */
describe('KeyboardController — an armed accidental does not leak past its note (§6)', () => {
  let engine: MusicEngine
  let state: EditorState
  let kb: KeyboardController

  beforeEach(() => {
    engine = makeEngine()
    state = createEditorState()
    const selection = new SelectionController(() => engine, state, () => {}, () => {})
    kb = new KeyboardController(
      () => engine, state, () => undefined, () => {},
      (id) => selection.moveCaretTo(id),
      () => 60,
    )
  })

  it('arms #, types A (→ A#), then B comes out NATURAL and the sharp is disarmed', () => {
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'entry'
    state.selectedNoteId = c.id
    state.selectedDuration = 'q'
    state.selectedAccidental = '#'          // arm a sharp

    kb.enterNoteAtCursorPosition('A')        // → A# at beat 1

    const a = getMeasureNotes(measure1(engine)).find(n => !n.isRest && n.step === 'A')!
    expect(a.alter).toBe(1)                  // the sharp DID apply to the note it was armed for
    expect(state.selectedAccidental).toBeNull() // …and cleared after entry — the null now STICKS

    kb.enterNoteAtCursorPosition('B')        // → B at beat 2, nobody armed a sharp for it

    const b = getMeasureNotes(measure1(engine)).find(n => !n.isRest && n.step === 'B')!
    expect(b.alter).toBe(0)                  // NATURAL — the sharp did not leak forward
    expect(state.selectedAccidental).toBeNull()
  })

  it('chord entry (Shift+letter) clears the armed accidental too — same rule as plain entry', () => {
    // A chord note is still keyboard entry, so the accidental must behave identically: apply to this
    // note, then clear. Otherwise chord entry keeps the sharp while plain entry drops it — two rules.
    const c = engine.addNoteAtBeat({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!
    state.selectedTool = 'entry'
    state.selectedNoteId = c.id
    state.selectedAccidental = '#'          // arm a sharp

    kb.addChordNoteByLetter('e')            // stack E# onto the C

    const e = getMeasureNotes(measure1(engine)).find(n => !n.isRest && n.step === 'E')!
    expect(e.alter).toBe(1)                  // the sharp applied to the chord note it was armed for
    expect(state.selectedAccidental).toBeNull() // …and cleared after, not left sticky
  })
})
