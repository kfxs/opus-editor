import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { stampFanAtClick } from './fanStamp'
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
})
