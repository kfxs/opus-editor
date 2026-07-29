import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { PaletteController } from './PaletteController'
import { createEditorState, type EditorState } from './EditorState'
import { fanHighlight } from './keypadSync'
import { fracCreate as frac } from '../utils/fraction'
import { DEFAULT_FAN_BEAMS, DEFAULT_FAN_COUNT } from '../utils/fannedBeam'

/**
 * The `accel.` / `rit.` press (docs/fanned-beams-plan.md §3, P2) — one button, three jobs: apply,
 * turn round, and clear. And the lit state, which is READ from the selection and never pushed.
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

describe('pressFan', () => {
  let engine: MusicEngine
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    state = createEditorState()
    state.selectedTool = 'selection'
    palette = new PaletteController(
      () => engine,
      state,
      () => {},   // renderScore
      () => {},   // renderArmedGhost
      () => null, // getLastMousePosition
      () => {},   // selectNote
    )
  })

  /** Select `ids` the way a click does — the id plus the selection SET the palette reads. */
  function select(...ids: string[]) {
    state.selectedNoteId = ids[0] ?? null
    state.selectedItems = new Map(ids.map(id => [`note:${id}`, { kind: 'note' as const, id }]))
  }

  const fanOf = (noteId: string) => engine.getNote(noteId)?.fan

  const blanca = (beat = 0) =>
    engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(beat, 1) })!.id

  it('applies the default fan to the selected note', () => {
    const id = blanca()
    select(id)
    palette.pressFan('accel')
    expect(fanOf(id)).toMatchObject({ direction: 'accel', count: DEFAULT_FAN_COUNT, beams: DEFAULT_FAN_BEAMS })
  })

  it('⭐ every member starts as the note you typed, and each head gets its OWN pitch id', () => {
    // The materialisation happens per slot: members sharing one pitch object would be N heads with
    // one id, and every command that resolves a member by id addresses whichever comes first.
    const a = blanca(0)
    select(a)
    palette.pressFan('accel')
    const members = fanOf(a)!.members!
    expect(members).toHaveLength(DEFAULT_FAN_COUNT - 1)
    expect(members.every(m => m.pitches.length === 1 && m.pitches[0].step === 'C' && m.pitches[0].octave === 4)).toBe(true)
    const ids = members.flatMap(m => m.pitches).map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('the OTHER direction turns it round rather than clearing it', () => {
    const id = blanca()
    select(id)
    palette.pressFan('accel')
    palette.pressFan('rit')
    expect(fanOf(id)?.direction).toBe('rit')
  })

  it('the SAME direction again clears it — back to the note you typed', () => {
    const id = blanca()
    select(id)
    palette.pressFan('accel')
    palette.pressFan('accel')
    expect(fanOf(id)).toBeUndefined()
    expect(engine.getNote(id)?.duration).toBe('h')
  })

  it('one press, one undo — and undo puts the note back', () => {
    const id = blanca()
    select(id)
    palette.pressFan('accel')
    expect(engine.undo()).toBe(true)
    expect(fanOf(id)).toBeUndefined()
  })

  it('does nothing with nothing selected — a fan has nothing to apply to', () => {
    const id = blanca()
    const before = engine.exportJSON()
    palette.pressFan('accel')
    expect(fanOf(id)).toBeUndefined()
    expect(engine.exportJSON()).toBe(before) // and no undo entry: the score never changed
  })

  it('does nothing on a selected REST — you cannot accelerate silence', () => {
    blanca(2)
    const rest = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!
    select(rest.id)
    const before = engine.exportJSON()
    palette.pressFan('accel')
    expect(engine.exportJSON()).toBe(before)
  })
})

describe('pressFan across a selection', () => {
  let engine: MusicEngine
  let state: EditorState
  let palette: PaletteController
  let selectNote: Mock<(id: string | null) => void>

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    state = createEditorState()
    state.selectedTool = 'selection'
    selectNote = vi.fn((_id: string | null) => {})
    palette = new PaletteController(
      () => engine,
      state,
      () => {},   // renderScore
      () => {},   // renderArmedGhost
      () => null, // getLastMousePosition
      selectNote,
    )
  })

  function select(...ids: string[]) {
    state.selectedNoteId = ids[0] ?? null
    state.selectedItems = new Map(ids.map(id => [`note:${id}`, { kind: 'note' as const, id }]))
  }

  const fourQuarters = () => (['C', 'D', 'E', 'F'] as const).map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)

  it('⭐ COLLAPSES the selection into ONE group — four notes are one gesture, not four', () => {
    const ids = fourQuarters()
    select(...ids)
    palette.pressFan('accel')

    // One slot left, spanning the four beats they spanned, with one attack each at their pitches.
    const chords = engine.getScore().measures[0].slots.filter(s => s.type === 'chord')
    expect(chords).toHaveLength(1)
    const fan = engine.getNote(ids[0])!.fan!
    expect(fan).toMatchObject({ direction: 'accel', count: 4 })
    expect(fan.members!.map(m => m.pitches[0].step)).toEqual(['D', 'E', 'F'])
    expect(engine.getNote(ids[0])?.duration).toBe('w')
  })

  it('…and leaves the survivor selected — the others are members now', () => {
    const ids = fourQuarters()
    select(...ids)
    palette.pressFan('accel')
    expect(selectNote).toHaveBeenCalledWith(ids[0])
  })

  it('the SAME direction again clears the group it just made', () => {
    const ids = fourQuarters()
    select(...ids)
    palette.pressFan('accel')
    select(ids[0]) // what the press left selected
    palette.pressFan('accel')
    expect(engine.getNote(ids[0])?.fan).toBeUndefined()
    expect(engine.getNote(ids[0])?.duration).toBe('w') // the collapsed length stays; only the mark went
  })

  it('⚠️ a selection that is NOT a passage does nothing at all — no fans, no undo entry', () => {
    const ids = fourQuarters()
    select(ids[0], ids[2]) // a hole: the note between them was not chosen
    const before = engine.exportJSON()
    palette.pressFan('accel')
    expect(engine.exportJSON()).toBe(before)
    // …and no EMPTY undo entry either: the next undo is the last note's, not the press's.
    engine.undo()
    expect(engine.exportJSON()).not.toBe(before)
  })

  it('⚠️ …including a selection containing a note that is already fanned', () => {
    const ids = fourQuarters()
    select(ids[0])
    palette.pressFan('rit') // one fanned note…
    select(ids[0], ids[1]) // …plus its neighbour: not all have it, so this is a collapse press
    const before = engine.exportJSON()
    palette.pressFan('accel')
    expect(engine.exportJSON()).toBe(before) // …and collapsing a fan into a fan is refused
  })

  it('is ONE undo entry for the whole selection', () => {
    const ids = fourQuarters()
    select(...ids)
    palette.pressFan('accel')
    engine.undo()
    for (const id of ids) expect(engine.getNote(id)?.fan).toBeUndefined()
  })

  it('skips the rests in a mixed selection rather than refusing it', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })!.id
    const rest = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!
    select(note, rest.id)
    palette.pressFan('rit')
    expect(engine.getNote(note)?.fan?.direction).toBe('rit')
  })

  it('⭐ skips a fanned MEMBER too — and its vote does not skew the all-or-nothing read', () => {
    const note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    select(note)
    palette.pressFan('accel')
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    const memberId = slot.type === 'chord' ? slot.fan!.members![0].pitches[0].id : ''

    // Owner + one of its own members. Counted, the member would answer "no fan here" and turn the
    // clearing press into a re-apply at the default shape.
    select(note, memberId)
    palette.pressFan('accel')
    expect(engine.getNote(note)?.fan).toBeUndefined()
  })

  /**
   * ⭐ THE BEAM KEYS ARE REFUSED ON A FANNED SLOT (his call) — all but one. Its beam is the ramp,
   * one self-contained feathered group, so there is no "which notes beam together" left to say. A
   * written mode would be inert while the fan is on and ALIVE the moment it came off, which is the
   * resurrection trap the two-note tremolo avoids the same way: by not writing.
   *
   * ⭐ The one is `continue` — the JOIN to the group on the left (docs/fan-beam-join-plan.md §0).
   * On a fan the word reads exactly as it does anywhere else: a beam comes in AND a beam goes out,
   * and the outgoing one is the ramp. `begin` is what an unjoined fan already means, `end` and
   * `single` are impossible, so `continue` is the only choice left to make.
   */
  describe('the beam operations on a fanned slot', () => {
    let note: string
    beforeEach(() => {
      note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })!.id
      select(note)
      palette.pressFan('accel')
    })

    it('setBeam writes nothing — for `begin`, `end` and `single`', () => {
      for (const mode of ['begin', 'end', 'single'] as const) {
        palette.setBeam(mode)
        expect(engine.getNote(note)?.beam).toBeUndefined()
      }
    })

    it('⭐ …but `continue` writes the JOIN, and pressing it again UNJOINS', () => {
      palette.setBeam('continue')
      expect(engine.getNote(note)?.beam).toBe('continue')
      // `auto` has no key on the pad, so the same press is the only way back.
      palette.setBeam('continue')
      expect(engine.getNote(note)?.beam).toBeUndefined()
    })

    it('the subdivide toggle writes nothing', () => {
      expect(palette.toggleSecondaryBreak()).toBe(false)
      expect(engine.getNote(note)?.secondaryBreak).toBeUndefined()
    })

    it('…and the notes AROUND it still take both', () => {
      const other = engine.addNoteAtBeat({ step: 'D', octave: 4, duration: '8', measure: 1, beat: frac(0.5, 1) })!.id
      select(note, other)
      palette.setBeam('end')
      expect(engine.getNote(other)?.beam).toBe('end')
      expect(engine.getNote(note)?.beam).toBeUndefined()
    })
  })
})

describe('fanHighlight — the buttons read the selection', () => {
  let engine: MusicEngine
  let state: EditorState

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    state = createEditorState()
    state.selectedTool = 'selection'
  })

  it('lights the direction the selected note carries, and only that one', () => {
    const id = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    state.selectedNoteId = id
    state.selectedItems = new Map([[`note:${id}`, { kind: 'note' as const, id }]])
    expect(fanHighlight(state, engine)).toBeNull()

    engine.setFan(id, { direction: 'rit', count: 4, beams: 2 })
    expect(fanHighlight(state, engine)).toBe('rit')
  })

  it('is dark with nothing selected', () => {
    expect(fanHighlight(state, engine)).toBeNull()
  })

  it('⭐ is DARK on a fanned MEMBER — the light belongs to the owner', () => {
    // A member is a pitch inside the group, and `setFan` refuses one. Lighting the key there offers
    // an edit that cannot happen — and reads as "this note carries a fan", which no member does.
    const id = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'h', measure: 1, beat: frac(0, 1) })!.id
    engine.setFan(id, { direction: 'rit', count: 4, beams: 2 })
    const slot = engine.getScore().measures[0].slots.find(s => s.type === 'chord')!
    const memberId = slot.type === 'chord' ? slot.fan!.members![0].pitches[0].id : ''

    state.selectedNoteId = memberId
    state.selectedItems = new Map([[`note:${memberId}`, { kind: 'note' as const, id: memberId }]])
    expect(fanHighlight(state, engine)).toBeNull()

    state.selectedNoteId = id
    state.selectedItems = new Map([[`note:${id}`, { kind: 'note' as const, id }]])
    expect(fanHighlight(state, engine)).toBe('rit')
  })
})
