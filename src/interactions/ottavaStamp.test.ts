import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import { createEditorState, type EditorState } from './EditorState'
import { stampOttavaAtClick } from './ottavaStamp'
import { soundingShiftAt } from '../utils/soundingShift'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * The ottava stamp's click: a press on a note puts an octave line over that note.
 *
 * Subject: {@link ottavaStamp}, sitting beside this file. The `MusicEngine` is real — the refusals
 * and the replacement rule are its answers — but the HIT-TEST is stubbed: which note a pixel lands
 * on needs a rendered score, which jsdom cannot lay out (docs/ARCHITECTURE.md §"The browser suite").
 *
 * ⭐ **Two chapters matter here that the trill stamp beside it has no equivalent of:**
 *  - one click's line covers exactly the note clicked, and the assertion is made in SOUND
 *    (`soundingShiftAt`) rather than in beats, because that is what an octave line is FOR;
 *  - pressing the other direction on the same note REPLACES the line rather than stacking, which is
 *    the model's per-(beat, staff) upsert surfacing as a gesture.
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

describe('stampOttavaAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let ids: string[]

  /** A registry whose hit-test answers "the click landed on `id`" — or on nothing, for `null`. */
  const hits = (id: string | null): ElementRegistry => ({
    findClosestNoteOrRest: () => (id ? { id } : null),
    hitsNoteOrRestBody: () => id !== null,
  } as unknown as ElementRegistry)

  const ottavas = () => engine.getScore().measures.flatMap(m => m.ottavas ?? [])

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    state = createEditorState()
    state.selectedMarkingTool = { kind: 'ottava', shift: 1 }
    render = vi.fn()
  })

  it('stands down entirely when the tool is not armed', () => {
    state.selectedMarkingTool = null
    expect(stampOttavaAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(false)
    expect(ottavas()).toHaveLength(0)
  })

  it('puts a line over the note clicked, and repaints', () => {
    expect(stampOttavaAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(true)
    expect(ottavas()).toHaveLength(1)
    expect(ottavas()[0].shift).toBe(1)
    expect(fracToNumber(ottavas()[0].beat)).toBe(1)
    expect(render).toHaveBeenCalled()
  })

  it('⭐ covers EXACTLY the note clicked — asserted in SOUND, which is what the line is for', () => {
    // Beats would prove the arithmetic; this proves the thing the user hears. The clicked D sounds
    // an octave up, and neither neighbour moves.
    stampOttavaAtClick(state, engine, hits(ids[1]), 10, 10, render)
    const score = engine.getScore()
    expect(soundingShiftAt(score, 1, frac(0, 1)), 'the note before').toBe(0)
    expect(soundingShiftAt(score, 1, frac(1, 1)), 'the note clicked').toBe(12)
    expect(soundingShiftAt(score, 1, frac(2, 1)), 'the note after').toBe(0)
  })

  it('an 8vb stamp puts the line the other way', () => {
    state.selectedMarkingTool = { kind: 'ottava', shift: -1 }
    stampOttavaAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(ottavas()[0].shift).toBe(-1)
    expect(soundingShiftAt(engine.getScore(), 1, frac(0, 1))).toBe(-12)
  })

  it('⭐ a second press with the OTHER direction REPLACES it — one beat cannot say both', () => {
    // The model's per-(beat, staff) upsert, reached through the gesture. Two contradictory octave
    // signs on one beat is not a stack, so the stamp cannot make one.
    stampOttavaAtClick(state, engine, hits(ids[0]), 10, 10, render)
    state.selectedMarkingTool = { kind: 'ottava', shift: -1 }
    stampOttavaAtClick(state, engine, hits(ids[0]), 10, 10, render)

    expect(ottavas(), 'one line, not two').toHaveLength(1)
    expect(ottavas()[0].shift).toBe(-1)
    expect(soundingShiftAt(engine.getScore(), 1, frac(0, 1))).toBe(-12)
  })

  it('CONSUMES a click that missed every note, and changes nothing', () => {
    // A near-miss must not fall through to note entry: a stray note appearing under an armed line
    // tool is worse than a click that does nothing.
    expect(stampOttavaAtClick(state, engine, hits(null), 10, 10, render)).toBe(true)
    expect(ottavas()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('⛔ refuses a REST — there is no sounding music to displace', () => {
    const rest = engine.addNoteAtBeat({ step: 'C', octave: 4, duration: 'q', measure: 2, beat: frac(0, 1), isRest: true })
    expect(stampOttavaAtClick(state, engine, hits(rest!.id), 10, 10, render)).toBe(true)
    expect(ottavas()).toHaveLength(0)
  })

  it('leaves the tool ARMED — lines are placed in runs', () => {
    stampOttavaAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(state.selectedMarkingTool).toEqual({ kind: 'ottava', shift: 1 })
  })

  it('⭐ the LAST note of the score still takes one — a line needs no second anchor', () => {
    // Where `stampSlurAtClick` has to reach forward to a next slot, this does not: the span is the
    // clicked note's own length, so the end of the music is not a special case.
    const last = ids[ids.length - 1]
    expect(stampOttavaAtClick(state, engine, hits(last), 10, 10, render)).toBe(true)
    expect(ottavas()).toHaveLength(1)
    expect(soundingShiftAt(engine.getScore(), 1, frac(3, 1))).toBe(12)
  })

  it('does NOT move the written pitch — the whole point of the model', () => {
    stampOttavaAtClick(state, engine, hits(ids[1]), 10, 10, render)
    const note = engine.getNote(ids[1])!
    expect([note.step, note.octave]).toEqual(['D', 4])
  })
})
