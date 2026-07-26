import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('⭐ every member starts as the note you typed — and one press is one set of pitches per note', () => {
    // `pressFan` hands the SAME mark object to every selected note, so the materialisation has to
    // happen per slot: two notes sharing one members array is two heads with one pitch id.
    const a = blanca(0)
    const b = blanca(2)
    select(a, b)
    palette.pressFan('accel')
    const ma = fanOf(a)!.members!
    const mb = fanOf(b)!.members!
    expect(ma).toHaveLength(DEFAULT_FAN_COUNT - 1)
    expect(ma.every(m => m.length === 1 && m[0].step === 'C' && m[0].octave === 4)).toBe(true)
    const ids = [...ma, ...mb].flat().map(p => p.id)
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

  function select(...ids: string[]) {
    state.selectedNoteId = ids[0] ?? null
    state.selectedItems = new Map(ids.map(id => [`note:${id}`, { kind: 'note' as const, id }]))
  }

  const fourQuarters = () => (['C', 'D', 'E', 'F'] as const).map((step, i) =>
    engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)

  it('fans every selected note — a fan is a property, so five notes are five groups', () => {
    const ids = fourQuarters()
    select(...ids)
    palette.pressFan('accel')
    for (const id of ids) expect(engine.getNote(id)?.fan?.direction).toBe('accel')
  })

  it('decides the direction for the selection AS A WHOLE', () => {
    const ids = fourQuarters()
    select(ids[0])
    palette.pressFan('accel') // only the first is fanned…
    select(...ids)
    palette.pressFan('accel') // …so this SETS all four rather than clearing the one
    for (const id of ids) expect(engine.getNote(id)?.fan?.direction).toBe('accel')
    palette.pressFan('accel') // now they all have it — this clears them
    for (const id of ids) expect(engine.getNote(id)?.fan).toBeUndefined()
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
    const memberId = slot.type === 'chord' ? slot.fan!.members![0][0].id : ''

    // Owner + one of its own members. Counted, the member would answer "no fan here" and turn the
    // clearing press into a re-apply at the default shape.
    select(note, memberId)
    palette.pressFan('accel')
    expect(engine.getNote(note)?.fan).toBeUndefined()
  })

  /**
   * ⭐ THE BEAM KEYS ARE REFUSED ON A FANNED SLOT (his call). Its beam is the ramp — one
   * self-contained feathered group — so there is no "which notes beam together" left to say. A
   * written mode would be inert while the fan is on and ALIVE the moment it came off, which is the
   * resurrection trap the two-note tremolo avoids the same way: by not writing.
   */
  describe('the beam operations on a fanned slot', () => {
    let note: string
    beforeEach(() => {
      note = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: '8', measure: 1, beat: frac(0, 1) })!.id
      select(note)
      palette.pressFan('accel')
    })

    it('setBeam writes nothing', () => {
      palette.setBeam('begin')
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
    const memberId = slot.type === 'chord' ? slot.fan!.members![0][0].id : ''

    state.selectedNoteId = memberId
    state.selectedItems = new Map([[`note:${memberId}`, { kind: 'note' as const, id: memberId }]])
    expect(fanHighlight(state, engine)).toBeNull()

    state.selectedNoteId = id
    state.selectedItems = new Map([[`note:${id}`, { kind: 'note' as const, id }]])
    expect(fanHighlight(state, engine)).toBe('rit')
  })
})
