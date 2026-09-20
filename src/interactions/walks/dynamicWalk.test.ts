import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import { dragDynamic, settleDynamicLanding, walkDynamic } from './dynamicWalk'
import { dynamicOffsetOverrideOf } from '../../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../../utils/fraction'
import { levelToGlyphString } from '../../utils/dynamics'

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
const drawn = vi.hoisted(() => ({
  entries: [] as { type: string; id?: string; bbox: { x: number; y: number; width: number; height: number }; staffSpacePx?: number }[],
  /** The painted staves. ⚠️ ONE by default, so the jump never fires and every walk case below is
   *  about the WALK; the landing cases set two. */
  bands: [{ top: 40, bottom: 80 }] as { top: number; bottom: number }[],
}))

vi.mock('../../engine/rendering/ScoreRenderer', () => ({
  ScoreRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      // ⭐ WHICH staff the mark belongs to is `dynamicLane.test.ts`'s subject; what the cases here
      // ask is what the LANDING does once that rule has spoken.
      staffBands: () => drawn.bands,
      staffRuns: () => drawn.bands.map(b => ({ ...b, left: -Infinity, right: Infinity })),
    }))
  },
}))
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

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
    drawn.bands = [{ top: 40, bottom: 80 }]
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    // Four quarters in one bar, one voice: C4 D4 E4 F4, with an `f` on the second of them.
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    dynamicId = engine.dynamic.addDynamic(1, { beat: frac(1, 1), text: levelToGlyphString('f') })!.id
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
    engine.dynamic.nudgeDynamicOffset(dynamicId, 0, -2)
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

  it('⭐ the RUN is ONE undo entry, however many presses it took — the re-anchor and the re-base go back together', () => {
    // An undo that took back only half of it would leave the mark somewhere nobody put it.
    for (let i = 0; i < 10; i++) walkDynamic(engine, dynamicId, 1)
    expect(at()).toBe('1@2')
    // ⭐⭐ THE RUN IS THE UNDO ENTRY, ⛔ not the press — settle it first, as
    //   `shortcutWiring`'s 150 ms does in the app (`./keyRun`).
    engine.dynamic.commitDynamicDrag()
    engine.undo()
    expect(at()).toBe('1@1')
    expect(offsetX()).toBeCloseTo(0)
  })

  /**
   * ⚠️⚠️ **EXPLORATORY (2026-08-31) — THE LANDING, when the ink has crossed onto another staff.**
   * His report on the dynamic's drag: *"look how it jumps when going to the next staff… it jumps to
   * the ladder that is down, is not going to the upside"*, and *"the movement should be smooth"*.
   * ⛔ Not a settled rule; it is the wedge's (`hairpinWalk.jumpStaves`) arriving one lane over.
   *
   * WHICH staff the mark belongs to is `dynamicLane.test.ts`'s subject. These two ask what happens
   * once it has been given away.
   */
  describe('the landing on another staff', () => {
    /** A grand staff: lines 40…80 and 240…280, so the middle of the white space is 160. The lower
     *  hand's notes are drawn 30 px to the RIGHT of the upper's, which is what makes the anchor's
     *  own travel visible in the offset. */
    const grandStaff = () => {
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      const lower = engine.addStaffBelow(0)
      const left = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 3, duration: 'q', measure: 1, beat: frac(i, 1), staff: 1 })!.id)
      drawn.entries = ids.map((id, i) => ({
        type: 'note', id, bbox: { x: 100 + i * 100, y: 50, width: 10, height: 10 },
      }))
      left.forEach((id, i) => drawn.entries.push({
        type: 'note', id, bbox: { x: 130 + i * 100, y: 250, width: 10, height: 10 },
      }))
      // The mark's own ink: centred at 94, fourteen px under its staff.
      drawn.entries.push({
        type: 'dynamic', id: dynamicId, bbox: { x: 200, y: 90, width: 12, height: 8 }, staffSpacePx: 10,
      })
      return lower
    }

    it('🚨⭐⭐ arrives on the side it CAME FROM — one rung of the ladder, ⛔ not the far side', () => {
      // His report in one assertion: coming down, the next rung is ABOVE the staff below, which is
      // where the hand already has the ink. Landing below it skips a rung and drops the mark a whole
      // staff past the hand — *"it jumps to the ladder that is down"*.
      const lower = grandStaff()
      expect(dragDynamic(engine, dynamicId, 205, 0, 100)).toBe(true)
      const mark = engine.getScore().measures[0].dynamics![0]
      expect(mark.staffId, 'it is the left hand’s mark now').toBe(lower)
      expect(mark.placement).toBe('above')
    })

    it('⭐⭐ …and the RE-ANCHOR does not move the drawing — the anchor’s travel is paid back', () => {
      // *"the movement should be smooth"*. Measured on the Prelude: the anchor 257 → 201 with the
      // offset zeroed, so the mark leapt 5½ spaces left on a frame the hand had moved a pixel. Here
      // the two hands' columns are 30 px apart, so the landing owes exactly −3 spaces.
      grandStaff()
      expect(dragDynamic(engine, dynamicId, 205, 0, 100)).toBe(true)
      expect(at(), 'the slot nearest the mark’s own x, down there').toBe('1@1')
      expect(offsetX()).toBeCloseTo(-3, 6)
    })

    it('⭐⭐ …and what the other staff’s LADDER did with the ink is paid after the render', () => {
      // ⛔ A decision may not read a number its own outcome writes: the jump decides from the drawn
      // ink, and re-engraving the mark on another ladder is exactly what moves that ink. The residual
      // is unknowable before the render, so the caller draws and then settles — here the "render" has
      // put the mark at 224 where the hand had it at 194, a debt of 3 spaces up.
      grandStaff()
      dragDynamic(engine, dynamicId, 205, 0, 100)
      const mark = drawn.entries.find(e => e.type === 'dynamic')!
      mark.bbox = { x: 200, y: 220, width: 12, height: 8 }
      expect(settleDynamicLanding(engine, dynamicId)).toBe(true)
      expect(offsetY()).toBeCloseTo(-3, 6)
      expect(settleDynamicLanding(engine, dynamicId), 'once per landing').toBe(false)
    })
  })
})
