import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { stampFanAtClick, featherSelectedNote, featherContext } from './fanStamp'
import { fracCreate as frac } from '../utils/fraction'
import { DEFAULT_FAN_BEAMS } from '../utils/fannedBeam'

/**
 * The feather stamp's click: ONE press writes a note AND the fan on it.
 *
 * Subject: {@link fanStamp}, sitting beside this file. The `MusicEngine` is real (the fan, the undo
 * batch and the refusal are all its answers) but the PIXEL→POSITION step is stubbed: mapping a click
 * to a slot needs a rendered score, which jsdom cannot lay out (docs/ARCHITECTURE.md §"The browser
 * suite"). Where a click lands is `NoteEntryCoordinator`'s question and has its own tests; what is
 * asked here is what the stamp does with the note it gets back.
 */
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getById: vi.fn(() => null),
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

describe('stampFanAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void

  /** The armed feather the Feathered Beam window's OK produces, at its opening values. */
  const armFeather = (over: Partial<Extract<EditorState['selectedMarkingTool'], { kind: 'fan' }>> = {}) => {
    state.selectedMarkingTool = { kind: 'fan', attacks: 6, unit: 'h', dots: 0, direction: 'accel', ...over }
  }

  /** Stand in for the pixel→position step: every click lands on beat 0 of bar 1, at C4. The id it
   *  placed is what the assertions read back through `engine.getNote`. */
  let placedId: string
  const clickLandsOnBeat0 = () =>
    vi.spyOn(engine, 'addNoteAtPosition').mockImplementation((_coords, duration, _acc, dots) => {
      const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration, dots, measure: 1, beat: frac(0, 1) })
      if (note) placedId = note.id
      return note
    })

  /** The note the stamp placed, as the model now holds it. */
  const placed = () => engine.getNote(placedId)

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    state = createEditorState()
    render = vi.fn()
  })

  it('does not touch a click when the tool is not armed', () => {
    const spy = vi.spyOn(engine, 'addNoteAtPosition')
    expect(stampFanAtClick(state, engine, 100, 100, render)).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐ places the dialog\'s note AND its fan in one click', () => {
    armFeather()
    clickLandsOnBeat0()

    expect(stampFanAtClick(state, engine, 100, 100, render)).toBe(true)

    const note = placed()!
    expect(note.duration).toBe('h')
    expect(note.fan).toMatchObject({ direction: 'accel', count: 6, beams: DEFAULT_FAN_BEAMS })
    // Absent, and that is the model's spelling of "exactly this note's duration" — the dialog said
    // `in the time of a half` and placed a half, so there is no second span to store.
    expect(note.fan?.length).toBeUndefined()
    // `setFan` mints the members, each carrying its own pitches (a member IS a chord —
    // docs/fanned-beam-pitches-plan.md), so all six attacks arrive at the clicked pitch and are
    // editable from the moment they are stamped. `count - 1` of them: member 0 IS the slot itself.
    expect(note.fan?.members).toHaveLength(5)
    expect(render).toHaveBeenCalled()
  })

  it('carries the dialog\'s own answers — attacks, dotted value, direction', () => {
    armFeather({ attacks: 9, unit: 'q', dots: 1, direction: 'rit' })
    clickLandsOnBeat0()

    stampFanAtClick(state, engine, 100, 100, render)

    const note = placed()!
    expect(note.duration).toBe('q')
    expect(note.dots).toBe(1)
    expect(note.fan?.direction).toBe('rit')
    expect(note.fan?.count).toBe(9)
  })

  it('⭐ ONE undo takes back the whole act — never a plain note left behind', () => {
    armFeather()
    clickLandsOnBeat0()
    stampFanAtClick(state, engine, 100, 100, render)

    engine.undo()

    expect(placed(), 'the note went with the fan — not a plain note left behind').toBeUndefined()
  })

  it('stays armed, and drops the caret — a stamp is used in runs', () => {
    armFeather()
    clickLandsOnBeat0()
    state.selectedNoteId = 'whatever-was-under-the-caret'

    stampFanAtClick(state, engine, 100, 100, render)

    expect(state.selectedMarkingTool).toEqual({ kind: 'fan', attacks: 6, unit: 'h', dots: 0, direction: 'accel' })
    expect(state.selectedNoteId).toBeNull()
  })

  it('consumes the click even when the engine refuses the note — it must not fall through to entry', () => {
    armFeather()
    vi.spyOn(engine, 'addNoteAtPosition').mockReturnValue(null)

    expect(stampFanAtClick(state, engine, 100, 100, render)).toBe(true)
    expect(render).not.toHaveBeenCalled()
  })

  /**
   * ⭐ THE DIALOG'S OK WITH ONE NOTE SELECTED — his rule: *"we create the fan in the position of the
   * note, with the characteristics of the dialog and the pitch of the note."*
   */
  describe('featherSelectedNote', () => {
    const ARMED = { attacks: 6, unit: 'h' as const, dots: 0, direction: 'accel' as const }
    /** Select one note the way a click does — the id plus the selection SET the rule reads. */
    const select = (...ids: string[]) => {
      state.selectedNoteId = ids[0] ?? null
      state.selectedItems = new Map(ids.map(id => [`note:${id}`, { kind: 'note' as const, id }]))
    }

    it('⭐ turns the SELECTED note into the dialog’s feather, keeping its pitch and its place', () => {
      const id = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
      select(id)

      expect(featherSelectedNote(state, engine, ARMED, render)).toBe(true)

      const note = engine.getNote(id)!
      expect(note.step, 'the note’s own pitch').toBe('E')
      expect(note.octave).toBe(5)
      expect(note.beat, 'and its own place').toEqual(frac(1, 1))
      expect(note.duration, 'the dialog’s value').toBe('h')
      expect(note.fan).toMatchObject({ direction: 'accel', count: 6, beams: DEFAULT_FAN_BEAMS })
      expect(render).toHaveBeenCalled()
    })

    it('⭐ ONE undo takes the whole conversion back — the value and the mark are one act', () => {
      const id = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      select(id)
      featherSelectedNote(state, engine, ARMED, render)

      engine.undo()

      const note = engine.getNote(id)!
      expect(note.duration, 'back to the quarter it was').toBe('q')
      expect(note.fan).toBeUndefined()
    })

    it('⛔ refuses a REST, a MULTI-selection and nothing selected — the window then ARMS instead', () => {
      expect(featherSelectedNote(state, engine, ARMED, render), 'nothing selected').toBe(false)

      const a = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      const b = engine.addNoteAtBeat({ step: 'D', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
      select(a, b)
      expect(featherSelectedNote(state, engine, ARMED, render), 'two notes is not one note').toBe(false)

      const restSlot = engine.getScore().measures[0].slots.find(slot => slot.type === 'rest')!
      select(restSlot.id)
      expect(featherSelectedNote(state, engine, ARMED, render), 'a rest carries no fan').toBe(false)
      expect(render).not.toHaveBeenCalled()
    })

    it('a value that does not fit goes through the ORDINARY entry path, and still gets its fan', () => {
      // A whole note asked for on the last quarter of the bar: `updateNote` decides what that means,
      // exactly as it does for a typed note — his call, so there is no second rule here.
      const id = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) })!.id
      select(id)

      expect(featherSelectedNote(state, engine, { ...ARMED, unit: 'w' }, render)).toBe(true)
      expect(engine.getNote(id)?.fan, 'the mark landed on the piece that kept the id').toBeTruthy()
    })
  })

  /**
   * ⭐ WHAT THE SELECTION ANSWERS — the numbers the dialog greys out and shows (his rule: with a
   * passage selected, the attacks and the length are facts, not questions).
   */
  describe('featherContext', () => {
    const select = (...ids: string[]) => {
      state.selectedNoteId = ids[0] ?? null
      state.selectedItems = new Map(ids.map(id => [`note:${id}`, { kind: 'note' as const, id }]))
    }

    it('counts the notes and sums their written lengths', () => {
      const ids = [0, 1, 2].map(k =>
        engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(k, 2) })!.id)
      select(...ids)
      expect(featherContext(state, engine)).toEqual({ notes: 3, quarters: 1.5 })
    })

    it('⛔ counts NOTES only — a rest is not an attack', () => {
      const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
      const rest = engine.getScore().measures[0].slots.find(slot => slot.type === 'rest')!.id
      select(note, rest)
      expect(featherContext(state, engine).notes).toBe(1)
    })

    it('answers nothing for an empty selection or no engine', () => {
      expect(featherContext(state, engine)).toEqual({ notes: 0, quarters: 0 })
      expect(featherContext(state, null)).toEqual({ notes: 0, quarters: 0 })
    })
  })
})
