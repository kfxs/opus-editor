import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { walkArmedSlurEndpoint, dragArmedSlurEndpoint } from './slurEndpointWalk'
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

  it('⭐⭐ the DRAG is the same journey — one 10-press frame lands exactly where 10 presses do', () => {
    // The claim that makes the mouse and the keyboard one gesture rather than two roads to
    // nearly-the-same score: 100 px at 10 px per space is the ten 1-space presses of the test above.
    expect(dragArmedSlurEndpoint(state, engine, 100, 0), 'one crossing, and it latched there')
      .toEqual({ crossings: 1, gapAhead: 0, latched: true, discarded: 0 })
    expect(slur().endNoteId).toBe(ids[3])
    expect(offsetX()).toBeCloseTo(0, 6)
  })

  it('⭐⭐ …and ONE frame may cross SEVERAL notes — a fast drag does not leave the anchor behind', () => {
    // A key press can cross at most one note; a frame of a quick drag can fly over many, and
    // re-anchoring once per frame would let the cursor outrun the anchor. Put the end on F4 and drag
    // it two whole gaps left in a single frame: it must land on D4, not on E4.
    engine.setSlurEndpointKeepingEdits(slurId, 'end', ids[3])
    // ⭐ The count and the gap are what the caller holds the ink by, so both must be the truth.
    expect(dragArmedSlurEndpoint(state, engine, -200, 0))
      .toEqual({ crossings: 2, gapAhead: 0, latched: true, discarded: 0 })
    expect(slur().endNoteId).toBe(ids[1])
    expect(offsetX()).toBeCloseTo(0, 6)
  })

  it('⭐⭐ a DRAG settles the vertical at a crossing, where a key press carries it through', () => {
    // The one place the two devices differ on purpose. A lift is tuned to clear the note it sits on
    // — its stem, its beam, its accidentals — so dragging past that note leaves it stale, while a
    // deliberate arrow press has no business dropping it.
    engine.nudgeSlurEndpoint(slurId, 'end', 0, -2)
    dragArmedSlurEndpoint(state, engine, 100, 0) // one whole gap right → crosses onto F4
    expect(slur().endNoteId, 'it crossed').toBe(ids[3])
    expect(offsetY(), 'and arrived at the new note’s own height').toBeCloseTo(0, 6)
  })

  it('…and ten presses covering the same ground KEEP that lift', () => {
    // The mirror of the test above, and the reason the flag exists rather than one rule for both.
    engine.nudgeSlurEndpoint(slurId, 'end', 0, -2)
    for (let i = 0; i < 10; i++) walkArmedSlurEndpoint(state, engine, 1)
    expect(slur().endNoteId).toBe(ids[3])
    expect(offsetY()).toBeCloseTo(-2, 6)
  })

  it('⭐⭐ the drag LATCHES coming back to its own anchor, not only when reaching a new one', () => {
    // His ask, 2026-08-18. Both events are "the ink reached the place the engraver would have put
    // this end", so both stop it there — otherwise the one position most likely to be wanted is the
    // one you can only hit by luck.
    dragArmedSlurEndpoint(state, engine, 50, 0) // out to +5 spaces, no crossing (the gap is 10)
    expect(offsetX()).toBeCloseTo(5, 6)
    const back = dragArmedSlurEndpoint(state, engine, -80, 0) // would overshoot to −3
    expect(offsetX(), 'stopped dead on the note').toBeCloseTo(0, 6)
    expect(back).toEqual({ crossings: 0, gapAhead: 100, latched: true, discarded: 30 })
  })

  it('…and the ink can still LEAVE a note it is latched on', () => {
    // ⛔ The guard that makes the latch a stop rather than a trap: at offset 0 every direction
    // "passes through" zero, so latching there unconditionally would pin the endpoint for good.
    dragArmedSlurEndpoint(state, engine, 50, 0)
    dragArmedSlurEndpoint(state, engine, -80, 0)
    expect(offsetX()).toBeCloseTo(0, 6)
    expect(dragArmedSlurEndpoint(state, engine, -20, 0)?.latched).toBe(false)
    expect(offsetX()).toBeCloseTo(-2, 6)
  })

  it('⭐ a drag frame records NO undo entry — the drop commits the whole gesture once', () => {
    dragArmedSlurEndpoint(state, engine, 12, -3)
    // …and it moved BOTH axes: the vertical is a plain offset, there being no anchor above to reach.
    expect(offsetY()).toBeCloseTo(-0.3, 6)
    // Decisive: if the frame had pushed a snapshot, this undo would take back the frame. It takes
    // back the slur's creation instead, because the frame pushed nothing.
    engine.undo()
    expect(engine.getSlurById(slurId)).toBeNull()
  })

  it('⛔ the drag declines with nothing armed, so the press falls through to its other meanings', () => {
    // ⚠️ null, not 0: a number is a crossing COUNT, and 0 is an ordinary frame that moved only ink.
    state.selectedElement = { kind: 'slur', id: slurId }
    expect(dragArmedSlurEndpoint(state, engine, 50, 0)).toBeNull()
    expect(offsetX()).toBe(0)
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
