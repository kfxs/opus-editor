import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { walkArmedSlurEndpoint } from './slurEndpointWalk'
import { endpointOffsetOverrideOf, curveShapeOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac } from '../utils/fraction'

/**
 * ←/→ moves an armed slur endpoint's INK, and carries the ANCHOR along once the ink arrives.
 *
 * Subject: {@link slurEndpointWalk}, sitting beside this file. The `MusicEngine` is real (what a
 * re-anchor keeps or drops is its answer, and the undo behaviour is the claim in the last test), but
 * the REGISTRY is fabricated: the walk reads two notehead x's and a staff-space size off the last
 * render, and jsdom draws nothing (`reference_jsdom_cannot_measure_glyphs`). Fabricating them is
 * what makes the arithmetic testable — the notes sit 100px apart at 10px per staff-space, so the
 * gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times to cross it.
 */
const drawn = vi.hoisted(() => ({ entries: [] as { type: string; id?: string; bbox: { x: number; y: number; width: number; height: number }; slurId?: string; staffSpacePx?: number }[] }))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('walkArmedSlurEndpoint', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]
  let slurId: string

  const slur = () => engine.getSlurById(slurId)!
  const offsetX = () => endpointOffsetOverrideOf(engine.getScore(), slurId)?.end?.x ?? 0
  const offsetY = () => endpointOffsetOverrideOf(engine.getScore(), slurId)?.end?.y ?? 0

  /** Four noteheads 100px apart, and one drawn arc handle to carry the staff-space size. Pass
   *  `null` for a handle that carries none — ⚠️ NOT `undefined`, which the default would swallow. */
  const render = (xs = [100, 200, 300, 400], staffSpacePx: number | null = 10) => {
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, bbox: { x: xs[i], y: 50, width: 10, height: 10 } }))
    drawn.entries.push({
      type: 'slur-handle', slurId, bbox: { x: 0, y: 0, width: 1, height: 1 },
      ...(staffSpacePx === null ? {} : { staffSpacePx }),
    })
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Four quarters in one bar, one voice: C4 D4 E4 F4.
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    slurId = engine.createSlur([ids[0], ids[2]])!.id // C4 → E4, so the END has F4 to walk onto
    state = createEditorState()
    state.selectedElement = { kind: 'slur', id: slurId, endpoint: 'end' }
    render()
  })

  it('DECLINES with no endpoint armed, so the arrow falls through to its other tenants', () => {
    state.selectedElement = { kind: 'slur', id: slurId } // the arc, no square
    expect(walkArmedSlurEndpoint(state, engine, 1)).toBe(false)
    expect(offsetX()).toBe(0)
  })

  it('nudges the ink and leaves the anchor alone until the ink arrives', () => {
    // Nine 1-space presses over a 10-space gap: the offset grows, the anchor does not move.
    for (let i = 0; i < 9; i++) expect(walkArmedSlurEndpoint(state, engine, 1)).toBe(true)
    expect(offsetX()).toBeCloseTo(9)
    expect(slur().endNoteId).toBe(ids[2])
  })

  it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
    // The whole design in one assertion: the tenth press moves the drawn point by the same one space
    // as the other nine, but spends it on the ANCHOR instead of the offset — so the ink does not
    // jump, and the stored offset re-zeroes itself at the note it has walked onto.
    for (let i = 0; i < 10; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId).toBe(ids[3])
    expect(offsetX()).toBeCloseTo(0)
  })

  it('⭐⭐ keeps the vertical nudge and the hand-tuned arc THROUGH the crossing', () => {
    // The reason this walk needed a model op of its own: the ordinary re-anchor drops both (it is
    // right for "not that note", wrong for a ¼-space press that steps over a notehead).
    engine.nudgeSlurEndpoint(slurId, 'end', 0, -2)
    engine.setSlurShape(slurId, [{ x: 0, y: -3 }, { x: 0, y: -3 }])
    for (let i = 0; i < 10; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId, 'it did cross').toBe(ids[3])
    expect(offsetY(), 'the lift survives').toBeCloseTo(-2)
    expect(curveShapeOverrideOf(engine.getScore(), slurId), 'the arc survives').toBeDefined()
  })

  it('🚨 refuses to cross when the next note is not in this system — two x’s, two rulers', () => {
    // F4 drawn to the LEFT of E4 is what a system break looks like from here: the next note in TIME
    // is at the next system's left margin. Subtracting those x's is meaningless, so the press stays
    // a plain nudge however far the ink has been pushed.
    render([100, 200, 300, 20])
    for (let i = 0; i < 30; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId).toBe(ids[2])
    expect(offsetX()).toBeCloseTo(30)
  })

  it('⛔ never guesses the staff-space size — no drawn handle means no crossing', () => {
    // A small staff beside a normal one makes this a ratio, not a constant: a guessed scale would
    // re-base by the wrong distance, quietly, and only on the staff that guessed.
    render([100, 200, 300, 400], null)
    for (let i = 0; i < 15; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId).toBe(ids[2])
    expect(offsetX()).toBeCloseTo(15)
  })

  it('walks the other way too, and stops before it reaches its partner', () => {
    // The END walking left: one stop back is D4 (the gap is negative), and the stop after that is
    // C4 — the slur's own start — which the candidate rule refuses, so the ink just keeps nudging.
    for (let i = 0; i < 10; i++) walkArmedSlurEndpoint(state, engine, -1)
    expect(slur().endNoteId).toBe(ids[1])
    expect(offsetX()).toBeCloseTo(0)
    for (let i = 0; i < 20; i++) walkArmedSlurEndpoint(state, engine, -1)
    expect(slur().endNoteId, 'never onto its own start note').toBe(ids[1])
    expect(offsetX()).toBeCloseTo(-20)
  })

  it('⭐ a crossing press is ONE undo entry — the re-point and the re-base go back together', () => {
    // An undo that took back only half of it would leave the ink somewhere nobody put it.
    for (let i = 0; i < 10; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId).toBe(ids[3])
    engine.undo()
    expect(slur().endNoteId).toBe(ids[2])
    expect(offsetX()).toBeCloseTo(9)
  })
})
