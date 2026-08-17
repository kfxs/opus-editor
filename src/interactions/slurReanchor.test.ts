import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { reanchorArmedSlurEndpoint } from './slurReanchor'
import { endpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac } from '../utils/fraction'

/**
 * Ctrl+Shift+←/→ walks an armed slur endpoint onto the previous/next note.
 *
 * Subject: {@link slurReanchor}, sitting beside this file. The `MusicEngine` is real — which note
 * the walk lands on, and what a re-anchor clears, are its answers — and nothing here needs a
 * renderer: the walk reads the BEAT MAP, not pixels. (The mouse's version of the same gesture snaps
 * to a notehead and so does need one; that is `MouseController`'s, not this module's.)
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

describe('reanchorArmedSlurEndpoint', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]
  let slurId: string

  /** The live slur, re-read each time (the model is replaced wholesale by undo). */
  const slur = () => engine.getSlurById(slurId)!

  /** Arm one end of the slur, the way clicking its square does. */
  const arm = (endpoint: 'start' | 'end') => {
    state.selectedElement = { kind: 'slur', id: slurId, endpoint }
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Four quarters in one bar, one voice: C4 D4 E4 F4.
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    slurId = engine.createSlur([ids[1], ids[2]])!.id // D4 → E4, room to walk either way
    state = createEditorState()
  })

  it('DECLINES with no slur endpoint armed — the chord must fall through to the note offset', () => {
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(false)
    state.selectedElement = { kind: 'slur', id: slurId } // the slur itself, no square armed
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(false)
    expect(slur()).toMatchObject({ startNoteId: ids[1], endNoteId: ids[2] })
  })

  it('DECLINES for an armed OPEN JOIN — the orange square has no note to anchor to', () => {
    state.selectedElement = { kind: 'slur', id: slurId, segmentEndpoint: { role: 'begin' }, segmentSpanCount: 2 }
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(false)
  })

  it('walks the START end back one note', () => {
    arm('start')
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(true)
    expect(slur()).toMatchObject({ startNoteId: ids[0], endNoteId: ids[2] })
  })

  it('walks the END end on one note', () => {
    arm('end')
    expect(reanchorArmedSlurEndpoint(state, engine, 1)).toBe(true)
    expect(slur()).toMatchObject({ startNoteId: ids[1], endNoteId: ids[3] })
  })

  it('DECLINES at the edge of the lane rather than wrapping or clamping in place', () => {
    arm('start')
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(true) // → C4, the first note
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(false) // nowhere left to go
    expect(slur().startNoteId).toBe(ids[0])
  })

  it('DECLINES the step that would REACH the other end — a slur may not collapse', () => {
    arm('start')
    expect(reanchorArmedSlurEndpoint(state, engine, 1)).toBe(false) // D4 → E4 IS the end
    expect(slur().startNoteId).toBe(ids[1])
  })

  it('DECLINES the step that would CROSS the other end', () => {
    arm('end')
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(false) // E4 → D4 IS the start
    expect(slur().endNoteId).toBe(ids[2])
  })

  it('DECLINES landing on the other end’s BEAT even when that end is a chord member', () => {
    // ⚠️ The two refusals above are also enforced downstream (the model rejects `start === end` by
    // id), so this is the case that isolates the clamp: the far end sits on the UPPER note of a
    // chord, so the walk's destination — the chord's lowest note — is a different id, and only a
    // POSITION comparison can see that the two ends would land on the same moment.
    const upper = engine.addChordNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    engine.previewSlurEndpoint(slurId, 'end', upper.id)
    arm('start')

    expect(reanchorArmedSlurEndpoint(state, engine, 1)).toBe(false)
    expect(slur().startNoteId).toBe(ids[1])
  })

  it('CLEARS the moved end’s nudge and keeps the other’s', () => {
    engine.nudgeSlurEndpoint(slurId, 'start', 0.5, -0.25)
    engine.nudgeSlurEndpoint(slurId, 'end', 1, 1)
    arm('start')

    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(true)

    const off = endpointOffsetOverrideOf(engine.getScore(), slurId)
    expect(off?.start).toBeUndefined() // tuned against the note just left behind
    expect(off?.end).toEqual({ x: 1, y: 1 }) // that end never moved
  })

  it('records exactly ONE undo step per press', () => {
    arm('start')
    reanchorArmedSlurEndpoint(state, engine, -1)
    expect(engine.undo()).toBe(true)
    expect(slur().startNoteId).toBe(ids[1])
    expect(engine.redo()).toBe(true)
    expect(slur().startNoteId).toBe(ids[0])
  })

  it('steps from a CHORD member the beat map does not list — the anchor is found by POSITION', () => {
    // G4 stacked on the D4 the slur starts at. The beat map keeps the chord's LOWEST note (D4), so
    // an endpoint anchored on the upper one is not on the map by id at all.
    const upper = engine.addChordNote({ step: 'G', octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    engine.previewSlurEndpoint(slurId, 'start', upper.id)
    arm('start')

    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(true)
    expect(slur().startNoteId).toBe(ids[0])
  })

  it('walks OVER a rest — a phrase mark spans silence, it does not end on it', () => {
    engine.convertToRest(ids[1]) // the note the slur started on is gone; re-anchor onto E4→F4 first
    const restBar = engine.createSlur([ids[2], ids[3]])!
    state.selectedElement = { kind: 'slur', id: restBar.id, endpoint: 'start' }

    // E4's neighbour going back is the BAR's rest at beat 1 — skipped, so the walk lands on C4.
    expect(reanchorArmedSlurEndpoint(state, engine, -1)).toBe(true)
    expect(engine.getSlurById(restBar.id)!.startNoteId).toBe(ids[0])
  })
})
