import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { dragDynamic, walkDynamic } from './dynamicWalk'
import { dynamicOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'
import { levelToGlyphString } from '../utils/dynamics'

/**
 * ←/→ moves a selected dynamic's INK, and carries the ANCHOR along once the ink arrives.
 *
 * Subject: {@link dynamicWalk}, sitting beside this file. The `MusicEngine` is real (what a crossing
 * keeps or drops is its answer, and the undo behaviour is the claim in the last case), but the
 * REGISTRY is fabricated: the walk reads two notehead x's and a staff-space size off the last
 * render, and jsdom draws nothing (`reference_jsdom_cannot_measure_glyphs`). Fabricating them is
 * what makes the arithmetic testable — the notes sit 100 px apart at 10 px per staff-space, so the
 * gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times to cross it.
 */
const drawn = vi.hoisted(() => ({ entries: [] as { type: string; id?: string; bbox: { x: number; y: number; width: number; height: number }; staffSpacePx?: number }[] }))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      // One system in this fixture: no second staff to cross onto, so the jump never fires and
      // every case below is about the WALK. `dynamicLane.test.ts` owns the crossing.
      staffBands: () => [{ top: 40, bottom: 80 }],
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('walkDynamic', () => {
  let engine: MusicEngine
  let ids: string[]
  let dynamicId: string

  const offsetX = () => dynamicOffsetOverrideOf(engine.getScore(), dynamicId)?.x ?? 0
  const offsetY = () => dynamicOffsetOverrideOf(engine.getScore(), dynamicId)?.y ?? 0
  /** Where the mark is anchored now, as `measure@beat`. */
  const at = () => {
    for (const measure of engine.getScore().measures) {
      const dyn = measure.dynamics?.find(d => d.id === dynamicId)
      if (dyn) return `${measure.number}@${fracToNumber(dyn.beat)}`
    }
    return 'gone'
  }

  /** Four noteheads 100 px apart, and the drawn mark carrying the staff-space size. Pass `null` for
   *  a mark that carries none — ⚠️ NOT `undefined`, which the default would swallow. */
  const render = (xs = [100, 200, 300, 400], staffSpacePx: number | null = 10) => {
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, bbox: { x: xs[i], y: 50, width: 10, height: 10 } }))
    drawn.entries.push({
      type: 'dynamic', id: dynamicId, bbox: { x: 0, y: 90, width: 12, height: 8 },
      ...(staffSpacePx === null ? {} : { staffSpacePx }),
    })
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Four quarters in one bar, one voice: C4 D4 E4 F4, with an `f` on the second of them.
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    dynamicId = engine.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f') })!.id
    render()
  })

  it('nudges the ink and leaves the anchor alone until the ink arrives', () => {
    // Nine 1-space presses over a 10-space gap: the offset grows, the mark does not move.
    for (let i = 0; i < 9; i++) expect(walkDynamic(engine, dynamicId, 1)).toBe(true)
    expect(offsetX()).toBeCloseTo(9)
    expect(at()).toBe('1@1')
  })

  it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
    // The whole design in one assertion: the tenth press moves the drawn mark by the same one space
    // as the other nine, but spends it on the ANCHOR instead of the offset — so the ink does not
    // jump, and the stored offset re-zeroes itself at the note it has walked onto.
    for (let i = 0; i < 10; i++) walkDynamic(engine, dynamicId, 1)
    expect(at()).toBe('1@2')
    expect(offsetX()).toBeCloseTo(0)
  })

  it('⭐⭐ keeps the mark’s hand-set LIFT through the crossing', () => {
    // The reason this walk needed a model op of its own: the ordinary re-anchor (`Ctrl+Shift+←/→`)
    // drops the whole offset, which is right for "not that note" and wrong for a ¼-space press that
    // happens to step over a notehead.
    engine.nudgeDynamicOffset(dynamicId, 0, -2)
    for (let i = 0; i < 10; i++) walkDynamic(engine, dynamicId, 1)
    expect(at(), 'it did cross').toBe('1@2')
    expect(offsetY(), 'the lift survives').toBeCloseTo(-2)
  })

  it('🚨 refuses to cross when the next slot is not in this system — two x’s, two rulers', () => {
    // E4 drawn to the LEFT of D4 is what a system break looks like from here: the next slot in TIME
    // is at the next system's left margin. Subtracting those x's is meaningless, so the press stays
    // a plain nudge however far the ink has been pushed.
    render([100, 200, 20, 120])
    for (let i = 0; i < 30; i++) walkDynamic(engine, dynamicId, 1)
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(30)
  })

  it('⛔ never guesses the staff-space size — no drawn mark means no crossing', () => {
    // A small staff beside a normal one makes this a ratio, not a constant: a guessed scale would
    // re-base by the wrong distance, quietly, and only on the staff that guessed.
    render([100, 200, 300, 400], null)
    for (let i = 0; i < 15; i++) walkDynamic(engine, dynamicId, 1)
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(15)
  })

  it('walks the other way too, and stops at the end of the lane', () => {
    for (let i = 0; i < 10; i++) walkDynamic(engine, dynamicId, -1)
    expect(at()).toBe('1@0')
    expect(offsetX()).toBeCloseTo(0)
    // Nothing lies before the bar's first slot, so the ink just keeps nudging left.
    for (let i = 0; i < 20; i++) walkDynamic(engine, dynamicId, -1)
    expect(at(), 'never off the front of the lane').toBe('1@0')
    expect(offsetX()).toBeCloseTo(-20)
  })

  it('⭐⭐ the DRAG is the same journey — one 10-press frame lands exactly where 10 presses do', () => {
    // The claim that makes the mouse and the keyboard one gesture rather than two roads to
    // nearly-the-same score: 100 px at 10 px per space is the ten 1-space presses two tests up.
    expect(dragDynamic(engine, dynamicId, 0, 100, 0)).toBe(true)
    expect(at()).toBe('1@2')
    expect(offsetX()).toBeCloseTo(0, 6)
  })

  it('⭐⭐ …and ONE frame may cross SEVERAL slots — a fast drag does not leave the anchor behind', () => {
    // A key press can cross at most one slot; a frame of a quick drag can fly over many, and
    // re-anchoring once per frame would let the cursor outrun the anchor.
    expect(dragDynamic(engine, dynamicId, 0, 200, 0)).toBe(true)
    expect(at()).toBe('1@3')
    expect(offsetX()).toBeCloseTo(0, 6)
  })

  it('⛔ the drag DECLINES (null) when the mark is not drawn — ⚠️ null, not false', () => {
    // false is "the model said no"; null is "there is no scale to convert the cursor's pixels
    // with", and the caller must leave its cursor baseline alone rather than treat it as a refusal.
    render([100, 200, 300, 400], null)
    expect(dragDynamic(engine, dynamicId, 0, 100, 0)).toBeNull()
    expect(offsetX()).toBe(0)
  })

  it('⭐ a drag frame records NO undo entry — the drop commits the whole gesture once', () => {
    dragDynamic(engine, dynamicId, 0, 30, 0)
    // Decisive: if the frame had pushed a snapshot, this undo would take back the frame. It takes
    // back the dynamic's creation instead, because the frame pushed nothing.
    engine.undo()
    expect(at()).toBe('gone')
  })

  it('⭐ the drag moves BOTH axes — the y is a plain ink offset, and SURVIVES a crossing', () => {
    // His ask, mid-build. The two axes are different kinds of move: 100 px right walks the anchor a
    // whole slot, while 30 px down is 3 staff-spaces of lift that no crossing has any reason to drop
    // (a dynamic's lift is measured off the dynamics LINE, not tuned to one note's stem — which is
    // exactly why the slur's drag settles ITS y and this one does not).
    expect(dragDynamic(engine, dynamicId, 0, 100, 30)).toBe(true)
    expect(at()).toBe('1@2')
    expect(offsetX()).toBeCloseTo(0, 6)
    expect(offsetY()).toBeCloseTo(3, 6)
  })

  it('⭐ a crossing press is ONE undo entry — the re-anchor and the re-base go back together', () => {
    // An undo that took back only half of it would leave the mark somewhere nobody put it.
    for (let i = 0; i < 10; i++) walkDynamic(engine, dynamicId, 1)
    expect(at()).toBe('1@2')
    engine.undo()
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(9)
  })
})
