import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import type { ElementRegistry } from '../engine/ElementRegistry'
import { createEditorState, type EditorState } from './EditorState'
import { stampTrillAtClick } from './trillStamp'
import { fracCreate as frac } from '../utils/fraction'

/**
 * The trill stamp's click: a press on a note trills that note.
 *
 * Subject: {@link trillStamp}, sitting beside this file. The `MusicEngine` is real — the refusals
 * and the idempotence are its answers — but the HIT-TEST is stubbed: which note a pixel lands on
 * needs a rendered score, which jsdom cannot lay out (docs/ARCHITECTURE.md §"The browser suite").
 *
 * ⭐ **The chapter that matters is the one where this parts company with the slur stamp**: one click
 * makes a COMPLETE ornament with no end anchor, where `stampSlurAtClick` has to reach forward to the
 * next slot because an arc needs two ends. So the last note of the score still takes a trill.
 *
 * ⚠️ The stamped trill still DRAWS a wavy line — the line always shows (his call, 2026-08-13; see
 * the note on `TrillSpan`). What "one note" changes is the SPAN, not whether there is a line.
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

describe('stampTrillAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let ids: string[]

  /** A registry whose hit-test answers "the click landed on `id`" — or on nothing, for `null`. */
  const hits = (id: string | null): ElementRegistry => ({
    findClosestNoteOrRest: () => (id ? { id } : null),
    hitsNoteOrRestBody: () => id !== null,
  } as unknown as ElementRegistry)

  const trills = () => engine.getScore().trills ?? []

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    state = createEditorState()
    state.selectedMarkingTool = { kind: 'trill' }
    render = vi.fn()
  })

  it('declines the click with the tool not armed — it must fall through to note entry', () => {
    state.selectedMarkingTool = null
    expect(stampTrillAtClick(state, engine, hits(ids[0]), 10, 10, render)).toBe(false)
    expect(trills()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐⭐ trills the clicked note and NOTHING ELSE — the span is that note alone', () => {
    expect(stampTrillAtClick(state, engine, hits(ids[1]), 10, 10, render)).toBe(true)
    expect(trills()).toHaveLength(1)
    expect(trills()[0].startNoteId).toBe(ids[1])
    // The whole difference from the slur stamp: it does NOT reach to ids[2].
    expect(trills()[0].endNoteId).toBeUndefined()
    expect(engine.trillSpan(trills()[0].id)!.slotIds).toHaveLength(1)
    expect(render).toHaveBeenCalled()
  })

  it('⭐ …so the LAST note of the score takes one too, where a slur stamp makes nothing', () => {
    const last = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    expect(stampTrillAtClick(state, engine, hits(last.id), 10, 10, render)).toBe(true)
    expect(trills()).toHaveLength(1)
    expect(trills()[0].startNoteId).toBe(last.id)
  })

  it('leaves the tool ARMED — stamps are used in runs', () => {
    stampTrillAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(state.selectedMarkingTool).toEqual({ kind: 'trill' })
  })

  it('is idempotent: stamping the same note twice adds one trill', () => {
    stampTrillAtClick(state, engine, hits(ids[0]), 10, 10, render)
    stampTrillAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(trills()).toHaveLength(1)
  })

  it('CONSUMES a click that missed every note — a stray note under an armed tool is worse', () => {
    expect(stampTrillAtClick(state, engine, hits(null), 10, 10, render)).toBe(true)
    expect(trills()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('refuses a REST — there is no trill without a note', () => {
    const rest = engine.convertToRest(ids[1])!
    expect(stampTrillAtClick(state, engine, hits(rest.id), 10, 10, render)).toBe(true)
    expect(trills()).toHaveLength(0)
    expect(render).not.toHaveBeenCalled()
  })

  it('is ONE undo step: the stamp is taken back whole', () => {
    stampTrillAtClick(state, engine, hits(ids[0]), 10, 10, render)
    expect(trills()).toHaveLength(1)
    engine.undo()
    expect(trills()).toHaveLength(0)
  })
})
