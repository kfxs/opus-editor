import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { walkTempo } from './tempoWalk'
import { tempoOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ←/→ moves a selected tempo mark's INK, and carries the ANCHOR along once the ink arrives.
 *
 * ⚠️ **THE KEYS ONLY, since 2026-08-31** — the mouse is a SNAP now and has its own module and its own
 * chapter (`tempoDrag.test.ts`, where these drag cases went).
 *
 * Subject: {@link tempoWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s and is proven from both ends (the dynamic's chapter exercises the same code).
 * The `MusicEngine` is real, but the REGISTRY is fabricated: the walk reads two drawn x's and a
 * staff-space size off the last render, and jsdom draws nothing
 * (`reference_jsdom_cannot_measure_glyphs`). The notes sit 100 px apart at 10 px per staff-space, so
 * the gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times to cross it.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as { type: string; id?: string; staff?: number; bbox: { x: number; y: number; width: number; height: number }; staffSpacePx?: number }[],
  /**
   * ⭐⭐ **WHERE THE ENGRAVER WOULD PUT A MARK ANCHORED AT `measure:beat`** — what the render
   * publishes (`TempoLayout` → `ElementRegistry.tempoAnchorX`) and the walk now asks for, 2026-08-31.
   *
   * 🚨 It is a SEPARATE table from the noteheads on purpose, because that is the whole point: a
   * downbeat mark anchors to the bar's TIME SIGNATURE, ⛔ not to the note (`TempoLayout.anchorX`), so
   * the two lists genuinely differ and a fixture that reused one for both could not tell the walk
   * apart from the bug it had. The default fills it FROM the noteheads (no meter in this fixture);
   * the meter case sets it by hand.
   */
  anchors: new Map<string, number>(),
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      tempoAnchorX: (measure: number, beat: number) => drawn.anchors.get(`${measure}:${beat}`) ?? null,
      // One system in this fixture: nothing to jump to, so every case is about the WALK and the
      // LATCH. `markSystemJump.test.ts` owns the crossing between systems.
      staffBands: () => [{ top: 240, bottom: 280 }],
      staffRuns: () => ([{ top: 240, bottom: 280 }]).map(b => ({ ...b, left: -Infinity, right: Infinity })),
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
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, staff: 0, bbox: { x: xs[i], y: 250, width: 10, height: 10 } }))
    drawn.entries.push({
      type: 'tempo', id: markId, bbox: { x: 0, y: 210, width: 40, height: 12 },
      ...(staffSpacePx === null ? {} : { staffSpacePx }),
    })
    // ⭐ No meter in this bar, so the engraver's anchor IS the notehead — the two tables agree and
    //   every case below reads exactly as it did before the walk stopped guessing.
    drawn.anchors = new Map(xs.map((x, i) => [`1:${i}`, x + 5]))
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

  it('🚨⭐⭐ the gap is the ENGRAVER\u2019s distance — a downbeat anchors to the TIME SIGNATURE', () => {
    // ⚠️⚠️ **THE CASE THAT WAS MISSING, and the bug it hid** (2026-08-31). His report: *"i\u2019m moving
    // the hand and the tempo is not moving on certain occasions"* — the occasions being bars that
    // print a meter. `TempoLayout.anchorX` puts a downbeat mark on the time signature (Gould p. 183;
    // LilyPond, MuseScore and Verovio all do the same), so beat 0\u2019s base is nowhere near beat 0\u2019s
    // notehead. The walk used to measure note-to-note, wrote the offset against an origin the drawing
    // never used, and left the mark ~45 px from the hand until the drop re-drew it.
    // ⭐ Here the meter sits 4.5 spaces left of the first note, so crossing onto beat 0 is a 14.5-space
    //   journey, ⛔ not the 10 the noteheads would suggest.
    drawn.anchors.set('1:0', 60)
    for (let i = 0; i < 14; i++) walkTempo(engine, markId, -1)
    expect(at(), 'the notes\u2019 10 spaces would have crossed by now').toBe('1@1')
    walkTempo(engine, markId, -1)
    expect(at(), 'the engraver\u2019s 14.5 have').toBe('1@0')
    // ⭐ And the crossing pair is still an IDENTITY: the anchor absorbed 14.5 spaces, so the offset
    //   gives exactly those back and the drawn mark does not move.
    expect(offsetX()).toBeCloseTo(-15 + 14.5, 6)
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

  it('⭐ the RUN is ONE undo entry, however many presses it took', () => {
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@2')
    // ⭐⭐ **THE RUN IS THE UNDO ENTRY, ⛔ not the press** (his rule, 2026-08-30) — so it has to be
    //   settled before there is anything to undo, which in the app is `shortcutWiring`'s 150 ms
    //   settle (`./keyRun`). ⭐ And the ink presses go back with it: one undo returns to where the
    //   key went down, where the old rule left the nine nudges standing at 9 spaces.
    engine.commitTempoDrag()
    engine.undo()
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(0)
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

  it('⭐⭐ …and the LIFT is the walk’s business either way — ↑/↓ stay a pure offset', () => {
    // ⚠️ The horizontal is all this device has: `walkTempo` takes one `dx` and nothing else, so a
    //    mark's OUTWARD `y` cannot be touched by a press that crosses.
    engine.nudgeTempoOffset(markId, 0, -1.5)
    for (let i = 0; i < 10; i++) walkTempo(engine, markId, 1)
    expect(at()).toBe('1@2')
    expect(offsetY()).toBeCloseTo(-1.5)
  })
})
