/**
 * The SLUR's commands, driven through the facade (`engine.slur.…`) with the renderer and playback
 * stubbed — the chapter that was `MusicEngine.test.ts`'s until the commands left the facade: which
 * notes `createSlur` joins, and when an edit clears a hand-tuned shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from '../MusicEngine'
import { curveShapeOverrideOf, segmentCurveShapeOverrideOf, endpointOffsetOverrideOf, segmentEndpointOffsetOverrideOf } from '../models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '@/utils/fraction'

// Stub ScoreRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('../rendering/ScoreRenderer', async (importOriginal) => ({
  // Keep the module's real constants (LAYOUT_CONFIG — the staff-spacing clamp reads it); only the
  // renderer class needs stubbing, since it wants a canvas/SVG.
  ...(await importOriginal<typeof import('../rendering/ScoreRenderer')>()),
  ScoreRenderer: class {
    initialize = vi.fn()
    renderScore = vi.fn()
    getElementRegistry = vi.fn(() => fakeRegistry)
    setViewMode = vi.fn()
    setLinearStaffSpacing = vi.fn()
    setCullWindow = vi.fn()
    setLayoutReusable = vi.fn()
    // P3's skip test (docs/render-performance-plan.md §5a) reads the view state off the
    // renderer. The stub's view state never changes, so `isRenderStale` here answers purely
    // "did the content change?" — which is exactly what the tests below exercise.
    viewStateKey = vi.fn(() => 'stub-view-state')
    clearGhosts = vi.fn()
    // Nothing is drawn, so there are no bounds to feed the coordinate mapper.
    getAllMeasureBounds = vi.fn(() => new Map())
    // Nothing is laid out in a stubbed renderer, so no measure opens a system: the per-system
    // staff-spacing key can't be resolved, exactly as before a first render.
    getSystemOpeningMeasureNumber = vi.fn(() => undefined)
  },
}))
vi.mock('../audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn()
    play = vi.fn()
    pause = vi.fn()
    stop = vi.fn()
    setVolume = vi.fn()
    onStateChange = vi.fn()
  },
}))

function makeEngine(): MusicEngine {
  const container = {} as unknown as HTMLElement
  const engine = new MusicEngine({ container, width: 800, height: 400 })
  // Add a second measure for overflow tests
  engine.addMeasure()
  return engine
}

/** Add a note via addNoteAtBeat and assert it was placed */
function addNote(engine: MusicEngine, params: Parameters<MusicEngine['addNoteAtBeat']>[0]) {
  const note = engine.addNoteAtBeat(params)
  if (!note) throw new Error(`Failed to place note at measure ${params.measure} beat ${JSON.stringify(params.beat)}`)
  return note
}

describe('slurCommands.createSlur — endpoint resolution, through the facade', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
  })

  it('single note slurs to the NEXT slot (note or rest)', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.slur.createSlur([a.id])).toMatchObject({ startNoteId: a.id, endNoteId: b.id, voice: 0 })
    expect(engine.getSlurs()).toHaveLength(1)
  })

  it('range slurs first→last in SCORE order, regardless of id order passed', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    // Pass ids out of order: last, first, middle.
    expect(engine.slur.createSlur([c.id, a.id])).toMatchObject({ startNoteId: a.id, endNoteId: c.id })
  })

  it('a single chord member slurs to the next EVENT, not a sibling head at the same beat', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    // Stack a second pitch on the same beat → a chord (sibling head of `a`).
    const sibling = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const next = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const slur = engine.slur.createSlur([a.id])!
    expect(slur.startNoteId).toBe(a.id)
    expect(slur.endNoteId).not.toBe(sibling.id) // NOT the sibling at the same beat
    expect(slur.endNoteId).toBe(next.id)
  })

  it('toggleTie on a chord member ties to the matching pitch in the NEXT slot, not a sibling head', () => {
    // Chord G4 + D5 at beat 1, then a lone G4 at beat 2.
    const g1 = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const d5 = engine.addChordNote({ step: 'D', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })
    const g2 = addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    expect(engine.toggleTie(g1.id)).toBe(true)
    expect(engine.getNote(g1.id)!.tiedTo).toBe(g2.id)   // tied across to G4@2
    expect(engine.getNote(g1.id)!.tiedTo).not.toBe(d5.id) // NOT the chord sibling
    expect(engine.getNote(g2.id)!.tiedFrom).toBe(g1.id)
  })

  it('tieSelection ties EVERY selected note in a run, not just the last', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(3, 1) }) // not selected

    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(true)
    expect(engine.getNote(a.id)!.tiedTo).toBe(b.id) // a → b
    expect(engine.getNote(b.id)!.tiedTo).toBe(c.id) // b → c
    expect(engine.getNote(c.id)!.tiedTo).toBeUndefined() // last selected note does NOT tie forward
  })

  it('tieSelection ties two chords pitch-for-pitch', () => {
    // Chord C4+E4 at beat 0, chord C4+E4 at beat 1.
    const c1 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e1 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c2 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const e2 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.tieSelection([c1.id, e1.id, c2.id, e2.id])).toBe(true)
    expect(engine.getNote(c1.id)!.tiedTo).toBe(c2.id) // C → C
    expect(engine.getNote(e1.id)!.tiedTo).toBe(e2.id) // E → E (not C)
    expect(engine.getNote(c2.id)!.tiedTo).toBeUndefined() // last chord not tied forward
    expect(engine.getNote(e2.id)!.tiedTo).toBeUndefined()
  })

  it('tieSelection on a single chord ties forward to the next slot', () => {
    const c1 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const e1 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c2 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const e2 = engine.addChordNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    // Only the first chord selected → it ties to the next slot (single-position case).
    expect(engine.tieSelection([c1.id, e1.id])).toBe(true)
    expect(engine.getNote(c1.id)!.tiedTo).toBe(c2.id)
    expect(engine.getNote(e1.id)!.tiedTo).toBe(e2.id)
  })

  it('tieSelection toggles off when the whole run is already tied', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(true)
    expect(engine.tieSelection([a.id, b.id, c.id])).toBe(false) // second press removes
    expect(engine.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedFrom).toBeUndefined()
  })

  it('tieSelection is ONE undo step of its own: undo takes the ties and leaves the notes', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const b = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const c = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })

    engine.renderScore()
    engine.tieSelection([a.id, b.id, c.id])
    expect(engine.isRenderStale()).toBe(true) // the next render may not be skipped

    expect(engine.undo()).toBe(true)
    // The ties went…
    expect(engine.getNote(a.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedTo).toBeUndefined()
    expect(engine.getNote(b.id)!.tiedFrom).toBeUndefined()
    // …and the undo did not take the edit BEFORE them instead.
    expect(engine.getNote(c.id)).toBeTruthy()

    expect(engine.redo()).toBe(true)
    expect(engine.getNote(a.id)!.tiedTo).toBe(b.id)
    expect(engine.getNote(b.id)!.tiedTo).toBe(c.id)
  })

  it('the undo invariant is ARMED on a real engine: a mutator that stops asking throws', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    // `toggleTie` asks through `commit`; with that silenced it is exactly the bug `tieSelection` had.
    ;(engine as unknown as { commit: () => void }).commit = () => {}
    expect(() => engine.toggleTie(a.id)).toThrow(/undo invariant/)
  })

  it('toggleTie ties a chord member with no same pitch ahead to the next slot (let-ring)', () => {
    // Chord C4+C5 at beat 0, then a lone C4 at beat 1 — C5 has no partner.
    const c4 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c5 = engine.addChordNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c4next = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    expect(engine.toggleTie(c4.id)).toBe(true) // C4 → C4 (same pitch)
    expect(engine.getNote(c4.id)!.tiedTo).toBe(c4next.id)
    expect(engine.toggleTie(c5.id)).toBe(true) // C5 → next slot (let-ring), even without a C5
    expect(engine.getNote(c5.id)!.tiedTo).toBe(c4next.id)
  })

  it('deleting a target with TWO incoming ties reassigns BOTH to the replacement rest', () => {
    // Reproduces the reported bug: a chord C4+C5 tied forward to a lone C4 (C5 let-ring).
    const c4 = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    const c5 = engine.addChordNote({ step: 'C', alter: 0, octave: 5, duration: 'q', measure: 1, beat: frac(0, 1) })
    const target = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(engine.toggleTie(c4.id)).toBe(true)
    expect(engine.toggleTie(c5.id)).toBe(true)
    expect(engine.getNote(c4.id)!.tiedTo).toBe(target.id)
    expect(engine.getNote(c5.id)!.tiedTo).toBe(target.id)

    engine.deleteNote(target.id) // target becomes a rest

    const rest = engine.getScore().measures[0].slots.find(
      s => s.type === 'rest' && fracToNumber(s.beat) === 1,
    )!
    // BOTH ties survive and point at the rest — neither is dropped or left dangling.
    expect(engine.getNote(c4.id)!.tiedTo).toBe(rest.id)
    expect(engine.getNote(c5.id)!.tiedTo).toBe(rest.id)
  })

  it('is create-only and idempotent — pressing s again does NOT add a duplicate or remove', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const first = engine.slur.createSlur([a.id])!
    expect(engine.getSlurs()).toHaveLength(1)
    const second = engine.slur.createSlur([a.id])! // same span again
    expect(second.id).toBe(first.id)          // returns the existing slur
    expect(engine.getSlurs()).toHaveLength(1) // still exactly one — no toggle-off, no dup
  })

  it('returns null when there is no next slot to slur to', () => {
    // Fill both measures, then target the very last note — nothing follows it.
    for (let m = 1; m <= 2; m++) {
      for (let b = 0; b < 4; b++) {
        addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: m, beat: frac(b, 1) })
      }
    }
    const all = engine.getScore().measures.flatMap(m => m.slots.filter(s => s.type === 'chord'))
    const lastChord = all[all.length - 1] as { notes: { id: string }[] }
    const lastId = lastChord.notes[0].id

    expect(engine.slur.createSlur([lastId])).toBeNull()
    expect(engine.getSlurs()).toHaveLength(0)
  })

  it('create then removeSlur are each one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })

    const slur = engine.slur.createSlur([a.id])!
    expect(engine.getSlurs()).toHaveLength(1)
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(0) // undo removes the add
    expect(engine.redo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1) // redo restores it

    expect(engine.slur.removeSlur(slur.id)).toBe(true)
    expect(engine.getSlurs()).toHaveLength(0)
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurs()).toHaveLength(1) // undo restores the removed slur
  })
  it('setSlurShape sets/clears the curve-shape override as one undo step', () => {
    // The shape now lives in the engraving-overrides compartment (staff-spaces), not on
    // the Slur. The engine/model pass the cps through verbatim — the px↔staff-space
    // conversion happens at the render/drag boundary, not here.
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    expect(shapeOf(slur.id)).toBeUndefined() // default = auto shape

    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }]
    expect(engine.slur.setSlurShape(slur.id, cps)).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps)

    expect(engine.undo()).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined() // undo reverts to auto

    expect(engine.redo()).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps)

    // Clearing with null drops the override back to auto.
    expect(engine.slur.setSlurShape(slur.id, null)).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined()

    // Unknown id is a no-op.
    expect(engine.slur.setSlurShape('nope', cps)).toBe(false)
  })

  it('nudgeSlurEndpoint accumulates the offset and saves exactly one undo step per press', () => {
    const offOf = (id: string) => endpointOffsetOverrideOf(engine.getScore(), id)?.start
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    expect(offOf(slur.id)).toBeUndefined() // no nudge yet

    // Two presses → accumulated total, each undoable on its own.
    expect(engine.slur.nudgeSlurEndpoint(slur.id, 'start', 0.25, 0)).toBe(true)
    expect(engine.slur.nudgeSlurEndpoint(slur.id, 'start', 0.25, -0.5)).toBe(true)
    expect(offOf(slur.id)).toEqual({ x: 0.5, y: -0.5 })

    expect(engine.undo()).toBe(true) // undo the 2nd press only
    expect(offOf(slur.id)).toEqual({ x: 0.25, y: 0 })
    expect(engine.undo()).toBe(true) // undo the 1st press
    expect(offOf(slur.id)).toBeUndefined()

    // Unknown id is a no-op.
    expect(engine.slur.nudgeSlurEndpoint('nope', 'start', 1, 1)).toBe(false)
  })

  it('nudgeSlurSegmentEndpoint accumulates the open-join offset and saves one undo step per press', () => {
    const beginOf = (id: string) => segmentEndpointOffsetOverrideOf(engine.getScore(), id)?.begin
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    expect(beginOf(slur.id)).toBeUndefined()

    // Two presses on the BEGIN open right end → accumulated total, each individually undoable.
    expect(engine.slur.nudgeSlurSegmentEndpoint(slur.id, { role: 'begin' }, 0, -0.25, 2)).toBe(true)
    expect(engine.slur.nudgeSlurSegmentEndpoint(slur.id, { role: 'begin' }, 0, -0.25, 2)).toBe(true)
    expect(beginOf(slur.id)).toEqual({ x: 0, y: -0.5 })

    expect(engine.undo()).toBe(true)
    expect(beginOf(slur.id)).toEqual({ x: 0, y: -0.25 })
    expect(engine.undo()).toBe(true)
    expect(beginOf(slur.id)).toBeUndefined()

    expect(engine.slur.nudgeSlurSegmentEndpoint('nope', { role: 'begin' }, 1, 1, 2)).toBe(false)
  })

  it('previewSlurShape (no undo) + commitSlurShape (one undo) = a single reshape step', () => {
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    expect(shapeOf(slur.id)).toBeUndefined()

    // Several live preview updates during a "drag" — none record undo.
    const cps1: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.1, y: 1.0 }, { x: 0.1, y: 1.0 }]
    const cps2: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.5, y: 1.8 }, { x: -0.2, y: 1.6 }]
    expect(engine.slur.previewSlurShape(slur.id, cps1)).toBe(true)
    expect(engine.slur.previewSlurShape(slur.id, cps2)).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps2)

    engine.slur.commitSlurShape() // one undo entry for the whole drag

    expect(engine.undo()).toBe(true)
    expect(shapeOf(slur.id)).toBeUndefined() // reverts past the entire drag to the auto shape
    expect(engine.redo()).toBe(true)
    expect(shapeOf(slur.id)).toEqual(cps2) // redo restores the final dragged shape
  })

  it('previewSlurShape routes a segment address to the per-segment override, not curveShape', () => {
    const curveOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)
    const segOf = (id: string) => segmentCurveShapeOverrideOf(engine.getScore(), id)
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.3, y: 1.2 }, { x: -0.1, y: 1.4 }]

    // A cross-system drag carries a segment address + the live span count → segmentCurveShape.
    expect(engine.slur.previewSlurShape(slur.id, cps, { role: 'middle', ordinal: 0 }, 3)).toBe(true)
    expect(curveOf(slur.id)).toBeUndefined()                 // NOT the whole-arc shape
    expect(segOf(slur.id)).toMatchObject({ spanCount: 3, middles: { 0: cps } })

    // No address (a same-line drag) still routes to the single-arc curveShape.
    expect(engine.slur.previewSlurShape(slur.id, cps)).toBe(true)
    expect(curveOf(slur.id)).toMatchObject({ cps })
  })

  // --- Phase 2: conservative auto-reset of the curve-shape override ---
  describe('curve-shape override auto-reset (Phase 2)', () => {
    const cps: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0.2, y: 1.4 }, { x: -0.3, y: 1.6 }]
    const shapeOf = (id: string) => curveShapeOverrideOf(engine.getScore(), id)?.cps

    it('drops the override when the slur is deleted (and prunes the compartment)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.slur.createSlur([a.id])!
      engine.slur.setSlurShape(slur.id, cps)
      expect(shapeOf(slur.id)).toEqual(cps)

      expect(engine.slur.removeSlur(slur.id)).toBe(true)
      expect(shapeOf(slur.id)).toBeUndefined()
      expect(engine.getScore().engravingOverrides).toBeUndefined() // pruned clean
    })

    it('drops the override when an endpoint note is deleted (re-anchored onto the replacement rest)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      const b = addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.slur.createSlur([a.id, b.id])! // spans a → b
      engine.slur.setSlurShape(slur.id, cps)
      expect(shapeOf(slur.id)).toEqual(cps)

      engine.deleteNote(b.id) // b → rest; slur re-anchors its end onto the rest (different element)
      expect(engine.getSlurById(slur.id)).not.toBeNull() // slur survives, re-anchored
      expect(shapeOf(slur.id)).toBeUndefined() // but its hand-tuned shape is gone
    })

    it('stays sticky across a non-breaking edit (anchors survive)', () => {
      const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
      addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
      const slur = engine.slur.createSlur([a.id])!
      engine.slur.setSlurShape(slur.id, cps)

      // Add a note elsewhere — neither slur endpoint is touched, so the shape persists.
      addNote(engine, { step: 'G', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(2, 1) })
      expect(shapeOf(slur.id)).toEqual(cps)
    })
  })
  it('flipSlur toggles auto ↔ flipped as one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    const slur = engine.slur.createSlur([a.id])!
    expect(slur.placement).toBeUndefined() // auto

    // First flip from auto sets an explicit side (opposite of last drawn; default-above → below).
    expect(engine.slur.flipSlur(slur.id)).toBe(true)
    const after = engine.getSlurById(slur.id)!.placement
    expect(after === 'above' || after === 'below').toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.slur.flipSlur(slur.id)
    expect(engine.getSlurById(slur.id)!.placement).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit side.
    expect(engine.undo()).toBe(true)
    expect(engine.getSlurById(slur.id)!.placement).toBe(after)

    expect(engine.slur.flipSlur('nope')).toBe(false) // unknown id
  })
  it('flipTie inverts the tie curve direction as one undo step', () => {
    const a = addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
    addNote(engine, { step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(1, 1) })
    expect(engine.toggleTie(a.id)).toBe(true) // tie C → C

    const dirOf = () => {
      const score = JSON.parse(engine.exportJSON())
      for (const m of score.measures)
        for (const s of m.slots)
          if (s.type === 'chord')
            for (const p of s.notes) if (p.id === a.id) return p.tieDirection
      return undefined
    }
    expect(dirOf()).toBeUndefined() // auto (no override yet)

    // First flip from auto stores an explicit ±1 direction.
    expect(engine.flipTie(a.id)).toBe(true)
    const after = dirOf()
    expect(after === -1 || after === 1).toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.flipTie(a.id)
    expect(dirOf()).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit direction.
    expect(engine.undo()).toBe(true)
    expect(dirOf()).toBe(after)

    expect(engine.flipTie('nope')).toBe(false) // unknown id
  })

  it('flipTuplet toggles auto ↔ flipped as one undo step', () => {
    const tuplet = engine.createTupletAtBeat(1, 0, '8', { step: 'E', alter: 0, octave: 4 }, 3, 2, 0)!.tuplet
    const find = () => engine.getScore().measures[0].tuplets!.find(t => t.id === tuplet.id)!
    expect(find().placement).toBeUndefined() // auto

    // First flip from auto pins an explicit side.
    expect(engine.flipTuplet(tuplet.id)).toBe(true)
    const after = find().placement
    expect(after === 'above' || after === 'below').toBe(true)

    // Second flip round-trips back to auto (Sibelius-style x).
    engine.flipTuplet(tuplet.id)
    expect(find().placement).toBeUndefined()

    // Undo reverts the reset (one step) → back to the explicit side.
    expect(engine.undo()).toBe(true)
    expect(find().placement).toBe(after)

    expect(engine.flipTuplet('nope')).toBe(false) // unknown id
  })
  // (JSON round-trip of slurs is covered in ScoreModel.test.ts — the engine's
  //  loadJSON triggers a full render, which the renderer stub here can't satisfy.)
})
