import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import {
  trillLane, trillLaneIndexAt, trillRibbonLimits, trillRibbonX, trillSquareBaseX, trillStaffSpacePx,
} from './trillLane'
import { fracCreate as frac } from '../utils/fraction'
import type { ElementRegistry } from '../engine/ElementRegistry'

/**
 * Where a trill's two squares would be drawn, per candidate anchor.
 *
 * Subject: {@link trillLane}, sitting beside this file — the geometry `./trillWalk` measures its gaps
 * with, extracted so the keys, the drag and the panel cannot each answer *where would this end be if
 * it hung off that note* differently. The `MusicEngine` is real for the LANE (a beat map is model
 * arithmetic) and the registry is fabricated for the X's, since jsdom draws nothing.
 *
 * ⭐ The claim that matters is the asymmetry: the START is drawn on its note and the END on the note
 * AFTER it, so the two read the same lane and answer different numbers.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as { type: string; id?: string; measure?: number; staff?: number; headX?: number
    bbox: { x: number; y: number; width: number; height: number } }[],
  lineSpacing: 12 as number | null,
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number) => (drawn.lineSpacing === null ? undefined : {
        lineSpacing: drawn.lineSpacing,
        // ⭐ Bar 2 is a LINE DOWN in these fixtures (top 140), which is what makes the ribbon a
        // ribbon: 90…430 then 90…830, laid end to end.
        lineYPositions: m === 1 ? [40, 50, 60, 70, 80] : [140, 150, 160, 170, 180],
        noteStartX: 90, noteEndX: m === 1 ? 430 : 830,
      }),
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

describe('trillLane', () => {
  let engine: MusicEngine
  let ids: string[]
  let trillId: string
  const registry = () => engine.getElementRegistry() as unknown as ElementRegistry
  const lane = () => trillLane(engine, engine.getNote(ids[0])!)

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure() // the engine opens with one bar; this is the second, whose rest ends the lane
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    trillId = engine.createTrill([ids[1], ids[2]])!.id
    drawn.lineSpacing = 12
    drawn.entries = ids.map((id, i) => ({
      type: 'note', id, headX: 100 + i * 100, bbox: { x: 95 + i * 100, y: 50, width: 10, height: 10 },
    }))
    drawn.entries.push({
      type: 'trill', id: trillId, measure: 1, staff: 0,
      bbox: { x: 200, y: 20, width: 200, height: 10 },
    })
  })

  /** The id the second bar's whole rest is drawn under. */
  const restId = () => engine.getScore().measures.find(m => m.number === 2)!.slots[0].id

  it('⭐ A REST IS IN THE LANE — the wavy line stops at the next SLOT, whatever it is', () => {
    // ⛔ Not the same list as the walk's STOPS: a rest can never be an anchor (`./trillReanchor`
    // filters it out), but it is a legitimate successor, and the two lists come from one beat map.
    expect(lane().map(n => n.id)).toEqual([...ids, restId()])
  })

  it('is located by POSITION, not by id — a chord answers through its lowest note', () => {
    const d = engine.getNote(ids[1])!
    expect(trillLaneIndexAt(lane(), d.measure, d.beat)).toBe(1)
    expect(trillLaneIndexAt(lane(), 9, frac(0, 1)), 'nothing stands there').toBe(-1)
  })

  it('⭐⭐ the START is drawn ON its note and the END on the note AFTER it', () => {
    const l = lane()
    expect(trillSquareBaseX(registry(), l, 'start', 1, 0), 'D4 itself').toBe(200)
    expect(trillSquareBaseX(registry(), l, 'end', 1, 0), 'the slot after D4').toBe(300)
  })

  it('🚨🚨 THE SUCCESSOR IS SCOPED TO THE BAR — the LAST slot of one ends at its BARLINE', () => {
    // The renderer asks `slotIdAfter` of the END MEASURE's own view and falls back to that bar's
    // `noteEndX`, so a trill ending on the last note of a bar stops there — ⛔ never at the first
    // note of the next bar, which is often on a different SYSTEM. Reading across bars was the first
    // cut of this module and it invented phantom system crossings (his report, 2026-08-20).
    const l = lane()
    const lastOfBarOne = ids.length - 1
    expect(trillSquareBaseX(registry(), l, 'end', lastOfBarOne, 0), 'bar 1\'s own end, ⛔ not bar 2\'s rest')
      .toBe(430)
    expect(trillSquareBaseX(registry(), l, 'end', l.length - 1, 0), 'and bar 2\'s, at its last slot')
      .toBe(830)
  })

  it('⛔ answers NULL rather than guessing when the last render drew nothing there', () => {
    drawn.entries = []
    expect(trillSquareBaseX(registry(), lane(), 'start', 1, 0)).toBeNull()
    expect(trillStaffSpacePx(registry(), trillId), 'no drawn ornament, no staff to read').toBeNull()
  })

  it('⭐ the staff-space size is READ off the staff the ornament was drawn on', () => {
    expect(trillStaffSpacePx(registry(), trillId)).toBe(12)
    drawn.lineSpacing = null
    expect(trillStaffSpacePx(registry(), trillId), '⛔ never a fallback constant').toBeNull()
  })

  /**
   * ⭐⭐ **THE RIBBON** — every drawn line laid END TO END, which is the ruler the walk measures on.
   *
   * 🚨 It exists because the drawing FOLDS ink past a line's end onto the next one (his rule,
   * 2026-08-20: *"no anchor to a note but offset in the next system"*), so the ink travels one
   * continuous distance. Measuring per line could only ever count ONE hop — his report: a trill
   * offset across three systems *"never was re-anchored to the note 3 systems below"*.
   */
  describe('the ribbon', () => {
    it('⭐ a point on the FIRST line is its distance from that line\'s own start', () => {
      expect(trillRibbonX(engine, 0, 1, 90)).toBe(0)
      expect(trillRibbonX(engine, 0, 1, 300)).toBe(210)
    })

    it('⭐⭐ a point on the SECOND line carries the first line\'s WHOLE WIDTH in front of it', () => {
      // Line 1 is 340 wide (90…430), so bar 2's own start is 340 along the ribbon.
      expect(trillRibbonX(engine, 0, 2, 90)).toBe(340)
      expect(trillRibbonX(engine, 0, 2, 190)).toBe(440)
    })

    it('⚠️ ink FOLDED past a line\'s end reads as further along, which is where it lands', () => {
      // 30 px past line 1's end (430) is 370 on the ribbon — and 370 is also line 2's start plus 30,
      // which is exactly where `TrillRenderer.foldPastSystemEnd` puts it back down.
      expect(trillRibbonX(engine, 0, 1, 460)).toBe(370)
      expect(trillRibbonX(engine, 0, 2, 120)).toBe(370)
    })

    it('runs from 0 to the sum of the lines, and answers null with nothing drawn', () => {
      expect(trillRibbonLimits(engine, 0)).toEqual({ min: 0, max: 340 + 740 })
      drawn.lineSpacing = null
      expect(trillRibbonLimits(engine, 0)).toBeNull()
      expect(trillRibbonX(engine, 0, 1, 100)).toBeNull()
    })
  })
})
