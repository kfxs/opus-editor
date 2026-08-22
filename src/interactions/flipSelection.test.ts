import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { flipSelection } from './flipSelection'
import { fracCreate as frac } from '../utils/fraction'

/**
 * What the `x` key flips.
 *
 * Subject: {@link flipSelection}, sitting beside this file — the table that replaced a six-branch
 * chain in `shortcutWiring` when the octave line would have made it seven. The `MusicEngine` is
 * REAL (each row calls a method that already records its own undo entry); the renderer and playback
 * are stubbed, since nothing here is about pixels.
 *
 * ⭐ The claims are the table's own: the selected element picks the row, a kind with no other side
 * DECLINES rather than doing something else, and the two tails — articulations, then the note stem —
 * are tried only when the table has no answer.
 */
vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('flipSelection — the `x` key', () => {
  let engine: MusicEngine
  let state: EditorState
  let noteIds: string[]

  beforeEach(() => {
    // No DOM needed — the renderer is stubbed above, so the container is never touched
    // (`ottavaStamp.test.ts`'s arrangement, which is why this file needs no jsdom environment).
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    state = createEditorState()
    noteIds = [0, 1].map(i =>
      engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
  })

  it('⭐⭐ an OTTAVA flips its DIRECTION — 8va → 8vb, his request of 2026-08-17', () => {
    const ottava = engine.createOttava([noteIds[0]], 1)!
    state.selectedElement = { kind: 'ottava', id: ottava.id }

    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getOttavas(1)[0].shift, 'now an 8vb').toBe(-1)
    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getOttavas(1)[0].shift, 'and back').toBe(1)
  })

  it('⭐⭐ a HAIRPIN flips its LANE — above the staff ⇄ below it (his ask, 2026-08-22)', () => {
    // 🚨 It flipped the TYPE until this date, because nothing else could reach the type. The
    //    Properties dropdown now can, so the key takes the side — which is what every other row in
    //    the table means by "flip". ⛔ And the type must NOT change with it.
    const hairpin = engine.createHairpin(noteIds, 'cresc')!
    state.selectedElement = { kind: 'hairpin', id: hairpin.id }

    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getHairpins(1)[0].placement, 'up out of the below-staff lane').toBe('above')
    expect(engine.getHairpins(1)[0].type, 'and it is still a crescendo').toBe('cresc')

    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getHairpins(1)[0].placement, 'and back down').toBe('below')
  })

  it('⭐ …and the translation drops the VERTICAL nudges, keeping the horizontal', () => {
    // The drag's own rule (`hairpinWalk.flipPlacement`), stated once in the op: a `y` measured below
    // the staff means nothing above it, while an `x` is how far along its span an end reaches — the
    // same statement on either side.
    const hairpin = engine.createHairpin(noteIds, 'cresc')!
    engine.nudgeHairpinEndpoint(hairpin.id, 'start', 2, -3)
    state.selectedElement = { kind: 'hairpin', id: hairpin.id }

    expect(flipSelection(state, engine)).toBe(true)
    const offset = engine.getScore().engravingOverrides?.[hairpin.id]
      ?.find(o => o.kind === 'hairpinEndpointOffset') as { start?: { x: number; y: number } }
    expect(offset.start, 'the reach survives, the lift does not').toEqual({ x: 2, y: 0 })
  })

  it('⭐⭐ a DYNAMIC — a level or an expression WORD — flips the same lane (his ask, 2026-08-22)', () => {
    // 🚨 `Dynamic.placement` rendered but had NO instrument before this: the trill's own argument for
    //    this key, *"a field with no way to set it is a dead field"*.
    const dynamic = engine.addDynamic(1, { text: 'dolce', beat: frac(0, 1) })!
    state.selectedElement = { kind: 'dynamic', id: dynamic.id }

    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getDynamics(1)[0].placement, 'up out of the below-staff lane').toBe('above')
    expect(engine.getDynamics(1)[0].text, '⛔ and the word itself is untouched').toBe('dolce')

    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getDynamics(1)[0].placement, 'and back down').toBe('below')
  })

  it('a TRILL flips its side — the same key, one meaning of "flip" across the table', () => {
    const trill = engine.createTrill([noteIds[0]])!
    state.selectedElement = { kind: 'trill', id: trill.id }
    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getTrills()[0].placement).toBe('below')
  })

  it('⚠️ DECLINES when nothing selected has two sides — the caller must not repaint', () => {
    expect(flipSelection(state, engine), 'nothing selected at all').toBe(false)
    // A selected element whose kind is absent from the table is NOT a decline on its own — it falls
    // through to the tails, and with no note selected either there is nothing left to flip. ⭐ That
    // fall-through is deliberate and pre-dates the table: a `measureRange` rides ALONGSIDE a
    // populated note selection (it is what a measure box-select leaves behind), so the notes under
    // the box are what `x` is about.
    state.selectedElement = { kind: 'measureRange', anchor: 1, focus: 1, staff: 0, boxStyle: 'single' }
    expect(flipSelection(state, engine), 'a kind absent from the table, and no notes under it').toBe(false)
  })

  it('falls back to the note STEM — the key’s own name, and the last thing tried', () => {
    state.selectedNoteId = noteIds[0]
    const before = engine.getNote(noteIds[0])!.stemDirection
    expect(flipSelection(state, engine)).toBe(true)
    expect(engine.getNote(noteIds[0])!.stemDirection).not.toBe(before)
  })
})
