import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { dragTempo, walkTempo } from './tempoWalk'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ←/→ moves a selected tempo mark's INK, and carries the ANCHOR along once the ink arrives.
 *
 * Subject: {@link tempoWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s and is proven from both ends (the dynamic's chapter exercises the same code).
 * The `MusicEngine` is real, but the REGISTRY is fabricated: the walk reads two drawn x's and a
 * staff-space size off the last render, and jsdom draws nothing
 * (`reference_jsdom_cannot_measure_glyphs`). The notes sit 100 px apart at 10 px per staff-space, so
 * the gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times to cross it.
 */
const drawn = vi.hoisted(() => ({ entries: [] as { type: string; id?: string; staff?: number; bbox: { x: number; y: number; width: number; height: number }; staffSpacePx?: number }[] }))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      // One system in this fixture: nothing to jump to, so every case is about the WALK and the
      // LATCH. `markSystemJump.test.ts` owns the crossing between systems.
      staffBands: () => [{ top: 40, bottom: 80 }],
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('walkTempo', () => {
  let engine: MusicEngine
  let ids: string[]
  let markId: string

  const offsetX = () => tempoOffsetOverrideOf(engine.getScore(), markId)?.x ?? 0
  const offsetY = () => tempoOffsetOverrideOf(engine.getScore(), markId)?.y ?? 0
  /** Where the mark is anchored now, as `measure@beat`. */
  const at = () => {
    for (const measure of engine.getScore().measures) {
      const mark = measure.tempos?.find(t => t.id === markId)
      if (mark) return `${measure.number}@${fracToNumber(mark.beat)}`
    }
    return 'gone'
  }

  /** Four noteheads 100 px apart, and the drawn mark carrying the staff-space size. Pass `null` for
   *  a mark that carries none — ⚠️ NOT `undefined`, which the default would swallow. */
  const render = (xs = [100, 200, 300, 400], staffSpacePx: number | null = 10) => {
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, staff: 0, bbox: { x: xs[i], y: 50, width: 10, height: 10 } }))
    drawn.entries.push({
      type: 'tempo', id: markId, bbox: { x: 0, y: 10, width: 40, height: 12 },
      ...(staffSpacePx === null ? {} : { staffSpacePx }),
    })
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    markId = engine.addTempoMark(1, { beat: frac(1, 1), text: 'Allegro' })!.id
    render()
  })

  it('nudges the ink and leaves the anchor alone until the ink arrives', () => {
    for (let i = 0; i < 9; i++) expect(walkTempo(engine, markId, 1)).toBe(true)
    expect(offsetX()).toBeCloseTo(9)
    expect(at()).toBe('1@1')
  })

  it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
    // The whole design in one assertion: the tenth press moves the drawn mark by the same one space
    // as the other nine, but spends it on the ANCHOR instead of the offset.
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@2')
    expect(offsetX()).toBeCloseTo(0)
  })

  it('⭐⭐ keeps the mark’s hand-set LIFT through the crossing', () => {
    // ⚠️ `y` is OUTWARD here (+up), the one offset in the compartment that is — and the walk must not
    // touch it either way.
    engine.nudgeTempoOffset(markId, 0, 2)
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, 1)
    expect(at(), 'it did cross').toBe('1@2')
    expect(offsetY(), 'the lift survives').toBeCloseTo(2)
  })

  it('🚨 refuses to cross when the next onset is not in this system — two x’s, two rulers', () => {
    render([100, 200, 20, 120])
    for (let i = 0; i < 30; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(30)
  })

  it('⛔ never guesses the staff-space size — no drawn mark means no crossing', () => {
    render([100, 200, 300, 400], null)
    for (let i = 0; i < 15; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(15)
  })

  it('⛔ …and stops at an onset another tempo mark is sitting on', () => {
    // One mark per beat: the model refuses the crossing write, so the walk stops there — the same
    // answer it gives at the end of the score, and ⛔ never an overwrite.
    const other = engine.addTempoMark(1, { beat: frac(2, 1), text: 'Presto' })!.id
    for (let i = 0; i < 20; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@1')
    expect(engine.getTempoMarkById(other)).not.toBeNull()
  })

  it('walks the other way too, and stops at the start of the score', () => {
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, -1)
    expect(at()).toBe('1@0')
    expect(offsetX()).toBeCloseTo(0)
    for (let i = 0; i < 20; i++) walkTempo(engine, markId, -1)
    expect(at(), 'never off the front').toBe('1@0')
    expect(offsetX()).toBeCloseTo(-20)
  })

  it('⭐ a crossing press is ONE undo entry — the re-anchor and the re-base go back together', () => {
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@2')
    engine.undo()
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(9)
  })

  it('⭐⭐ it is AUDIBLE — a crossing moves the tempo map, an ink nudge does not', () => {
    engine.updateTempoMark(markId, { bpm: 144 })
    const before = engine.getEffectiveTempoAt(1, frac(1, 1))
    for (let i = 0; i < 9; i++) walkTempo(engine, markId, 1) // ink only
    expect(engine.getEffectiveTempoAt(1, frac(1, 1)), 'ink changes nothing').toBe(before)
    walkTempo(engine, markId, 1) // the crossing press
    expect(engine.getEffectiveTempoAt(1, frac(2, 1))).toBe(144)
    expect(engine.getEffectiveTempoAt(1, frac(1, 1))).not.toBe(144)
  })

  it('⭐⭐ the DRAG is the same journey — one 10-press frame lands where 10 presses do', () => {
    expect(dragTempo(engine, markId, 0, 100, 0)).toBe(true)
    expect(at()).toBe('1@2')
    expect(offsetX()).toBeCloseTo(0, 6)
  })

  it('⭐⭐ …and it LATCHES on the anchor, so Gould’s alignment is reachable EXACTLY', () => {
    // His call, 2026-08-19. The ink is pushed 5 spaces out and then dragged 8 back: it stops DEAD at
    // offset zero rather than sailing 3 spaces past, because that position — where the engraver put
    // the mark — is the one most likely to be wanted, and luck is no way to hit it.
    dragTempo(engine, markId, 0, 50, 0)
    expect(offsetX()).toBeCloseTo(5, 6)
    expect(dragTempo(engine, markId, 0, -80, 0)).toBe(true)
    expect(offsetX(), 'stopped dead on the anchor').toBeCloseTo(0, 6)
    expect(at(), 'and it did not cross').toBe('1@1')
  })

  it('…and the ink can still LEAVE an anchor it is latched on', () => {
    // ⛔ The guard that makes the latch a stop rather than a trap: at zero every direction "passes
    // through", so latching there unconditionally would pin the mark for good.
    dragTempo(engine, markId, 0, 50, 0)
    dragTempo(engine, markId, 0, -80, 0)
    dragTempo(engine, markId, 0, -20, 0)
    expect(offsetX()).toBeCloseTo(-2, 6)
  })

  it('⭐ the drag moves BOTH axes, and the vertical is OUTWARD — a cursor going DOWN lowers it', () => {
    // ⚠️ The one conversion this mark needs: the cursor is screen-down and the model is +up.
    dragTempo(engine, markId, 0, 0, 30)
    expect(offsetY(), 'dragging down is a NEGATIVE outward offset').toBeCloseTo(-3, 6)
  })

  it('⭐ …and the lift SURVIVES a crossing — a tempo’s y answers the ladder’s row', () => {
    // ⛔ Unlike the slur endpoint's drag, which settles its y at a crossing because that lift answers
    // one note's stem and beam.
    dragTempo(engine, markId, 0, 0, -20)   // 2 spaces up
    dragTempo(engine, markId, 0, 100, 0)   // one whole gap right → crosses
    expect(at()).toBe('1@2')
    expect(offsetY()).toBeCloseTo(2, 6)
  })

  it('⭐ a drag frame records NO undo entry — the drop commits the whole gesture once', () => {
    dragTempo(engine, markId, 0, 30, 0)
    engine.undo()
    expect(at(), 'the undo took back the mark itself, so the frame pushed nothing').toBe('gone')
  })

  it('⛔ the drag DECLINES (null) when the mark is not drawn — ⚠️ null, not false', () => {
    render([100, 200, 300, 400], null)
    expect(dragTempo(engine, markId, 0, 100, 0)).toBeNull()
    expect(offsetX()).toBe(0)
  })
})
