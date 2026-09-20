/**
 * TIES through the facade — what `MusicEngine` adds over `models/tieOps` (whose rule has its own
 * spec): ONE undo entry per press, that the undo invariant is armed, that deleting a tie's target
 * re-links every incoming tie, and the flip. ⚠️ These cases were filed under the `createSlur`
 * chapter of `MusicEngine.test.ts` from the day they were written; they are ties, not slurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MusicEngine } from './MusicEngine'
import { fracCreate as frac } from '@/utils/fraction'

// Stub ScoreRenderer (needs canvas/SVG) and PlaybackEngine (needs Web Audio)
const fakeRegistry = {
  clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
  findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null),
  registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
}
vi.mock('./rendering/ScoreRenderer', async (importOriginal) => ({
  // Keep the module's real constants (LAYOUT_CONFIG — the staff-spacing clamp reads it); only the
  // renderer class needs stubbing, since it wants a canvas/SVG.
  ...(await importOriginal<typeof import('./rendering/ScoreRenderer')>()),
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
vi.mock('./audio/PlaybackEngine', () => ({
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

describe('MusicEngine — ties', () => {
  let engine: MusicEngine

  beforeEach(() => {
    engine = makeEngine()
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
    // `toggleTie` asks through `mutate`; with that silenced it is exactly the bug `tieSelection` had.
    ;(engine as unknown as { mutate: () => void }).mutate = () => {}
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
})
