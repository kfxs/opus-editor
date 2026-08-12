import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import { createEditorState, type EditorState } from './EditorState'
import { stampSlurAtClick } from './slurStamp'
import { fracCreate as frac } from '../utils/fraction'

/**
 * The slur stamp's click: a press on a note slurs it to the next slot.
 *
 * Subject: {@link slurStamp}, sitting beside this file. The `MusicEngine` is real — the span, the
 * idempotence and the refusals are all its answers — but the HIT-TEST is stubbed: which note a pixel
 * lands on needs a rendered score, which jsdom cannot lay out (docs/ARCHITECTURE.md §"The browser
 * suite"). Where a click lands is `ElementRegistry`'s question and has its own tests; what is asked
 * here is what the stamp does with the note it is handed.
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

describe('stampSlurAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let ids: string[]

  /** A registry whose hit-test answers "the click landed on `id`" — or on nothing, for `null`. */
  const hits = (id: string | null): ElementRegistry => ({
    findClosestNoteOrRest: () => (id ? { id } : null),
    hitsNoteOrRestBody: () => id !== null,
  } as unknown as ElementRegistry)

  const slurs = () => engine.getScore().slurs ?? []

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = ['C', 'D', 'E', 'F'].map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    state = createEditorState()
    state.selectedMarkingTool = { kind: 'slur' }
    render = vi.fn()
  })

  it('declines the click with the tool not armed — it must fall through to note entry', () => {
    state.selectedMarkingTool = null
    expect(stampSlurAtClick(state, engine, hits(ids[0]), 10, 10, render)).toBe(false)
    expect(slurs()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('slurs the clicked note to the NEXT slot', () => {
    expect(stampSlurAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(true)
    expect(slurs()).toHaveLength(1)
    expect(slurs()[0]).toMatchObject({ startNoteId: ids[1], endNoteId: ids[2] })
    expect(render).toHaveBeenCalled()
  })

  it('leaves the tool ARMED — stamps are used in runs', () => {
    stampSlurAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(state.selectedMarkingTool).toEqual({ kind: 'slur' })
  })

  it('is idempotent: stamping the same note twice adds one slur', () => {
    stampSlurAtClick(state, engine, hits(ids[0]), 10, 10, render)
    stampSlurAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(slurs()).toHaveLength(1)
  })

  it('CONSUMES a click that missed every note — a stray note under an armed spanner is worse', () => {
    expect(stampSlurAtClick(state, engine, hits(null), 10, 10, render)).toBe(true)
    expect(slurs()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('refuses a REST: a phrase mark spans sounding notes', () => {
    const rest = engine.convertToRest(ids[1])!
    expect(stampSlurAtClick(state, engine, hits(rest.id), 10, 10, render)).toBe(true)
    expect(slurs()).toHaveLength(0)
  })

  it('reaches ACROSS the barline — the next slot is the engine\'s answer, not the bar\'s', () => {
    // The fixture has a second (empty) bar, so the last note of bar 1 has somewhere to go: `s` on
    // one selected note spans exactly this way, and the stamp must not invent a different rule.
    expect(stampSlurAtClick(state, engine, hits(ids[3]), 10, 10, render)).toBe(true)
    expect(slurs()).toHaveLength(1)
    expect(slurs()[0].startNoteId).toBe(ids[3])
  })

  it('makes nothing on the last note of the SCORE — there is no next slot to reach', () => {
    const last = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    expect(stampSlurAtClick(state, engine, hits(last.id), 10, 10, render)).toBe(true)
    expect(slurs()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('is ONE undo step: the stamp is taken back whole', () => {
    stampSlurAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(engine.undo()).toBe(true)
    expect(slurs()).toHaveLength(0)
  })
})
