import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { walkHairpinEndpoint } from './hairpinWalk'
import { hairpinEndpointOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ←/→ on an ARMED SQUARE moves that end's INK, and carries that end of the WEDGE along once the ink
 * arrives at the next boundary of the lane.
 *
 * Subject: {@link hairpinWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s, proven from three ends now (the dynamic's and the tempo's chapters exercise the
 * same code). The `MusicEngine` is real, but the REGISTRY is fabricated: the walk reads two drawn
 * x's and a staff-space size off the last render, and jsdom draws nothing
 * (`reference_jsdom_cannot_measure_glyphs`). The notes' LEFT EDGES sit 100 px apart at 10 px per
 * staff-space, so a gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times to
 * cross it.
 *
 * ⭐ What this chapter owns, over the other two marks': a crossing HOLDS THE FAR END STILL (the
 * wedge shortens, it does not slide), it keeps the OTHER end's own nudge, and it stops where the two
 * ends would meet rather than collapsing the wedge. Both squares walk — his correction on the day
 * the left one shipped — so the fixture is read from both directions.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as {
    type: string; id?: string; staff?: number; measure?: number
    bbox: { x: number; y: number; width: number; height: number }
    points?: { x: number; y: number }[]
  }[],
  lineSpacing: 10 as number | null,
  /** Per measure: the staff's top-line y (which system it is on) and where its music ends. */
  systemTop: {} as Record<number, number>,
  noteEndX: {} as Record<number, number>,
  /** Bars the last render drew nothing for — no geometry, so nothing may be measured against them. */
  undrawn: [] as number[],
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number) => (drawn.lineSpacing === null || drawn.undrawn.includes(m) ? undefined : {
        lineSpacing: drawn.lineSpacing,
        lineYPositions: [drawn.systemTop[m] ?? 40, 50, 60, 70, 80],
        noteStartX: 90, noteEndX: drawn.noteEndX[m] ?? 430,
      }),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      staffBands: () => [{ top: 40, bottom: 80 }],
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('walkHairpinEndpoint', () => {
  let engine: MusicEngine
  let ids: string[]
  let wedgeId: string

  const offset = (which: 'start' | 'end') =>
    hairpinEndpointOffsetOverrideOf(engine.getScore(), wedgeId)?.[which] ?? { x: 0, y: 0 }
  /** Where the wedge begins and how much music it covers — `beat+length` is its END, which most of
   *  these assertions are really about. */
  const span = () => {
    const wedge = engine.getHairpinById(wedgeId)!
    return { beat: fracToNumber(wedge.beat), length: fracToNumber(wedge.length) }
  }

  /** Four noteheads whose LEFT EDGES are 100 px apart, and the drawn wedge (which is what carries a
   *  staff to measure). Pass `null` for a staff with no measured geometry. */
  const render = (xs = [100, 200, 300, 400], lineSpacing: number | null = 10, tipX = 400) => {
    drawn.lineSpacing = lineSpacing
    // ⭐ ONE system by default, whose music runs 90…430 in bar 1 and 90…830 in bar 2. Both numbers
    // matter now: a wedge ending on a BARLINE is drawn at its bar's own end, not on a note.
    drawn.systemTop = { 1: 40, 2: 40 }
    drawn.noteEndX = { 1: 430, 2: 830 }
    drawn.undrawn = []
    drawn.entries = ids.map((id, i) => ({ type: 'note', id, staff: 0, bbox: { x: xs[i], y: 50, width: 10, height: 10 } }))
    // ⭐ The drawn wedge carries its OUTLINE as well as a box: the tip's own x is the only thing that
    // can answer "where does it end" for a wedge that finishes on a barline (`hairpinLane.hairpinTipX`).
    // Here the bar's music ends at 410 and its barline sits at 500.
    drawn.entries.push({
      type: 'hairpin', id: wedgeId, staff: 0, measure: 1,
      bbox: { x: 100, y: 90, width: 400, height: 8 },
      points: [{ x: 100, y: 90 }, { x: tipX, y: 88 }, { x: tipX, y: 98 }, { x: 100, y: 94 }],
    })
  }

  /** The second bar's whole rest, drawn 100 px on — the lane does not stop at the fourth note, and
   *  what the render DREW is the only reason the walk can see it. */
  const renderSecondBar = (x = 500) => {
    drawn.entries.push({ type: 'rest', id: secondBarRestId(), staff: 0, bbox: { x, y: 50, width: 10, height: 10 } })
  }

  /** The id the second bar's whole rest is drawn under. */
  const secondBarRestId = () => engine.getScore().measures.find(m => m.number === 2)!.slots[0].id

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    // Beats 0 → 3: it covers the first three notes, so there are stops on both sides of its start.
    wedgeId = engine.addHairpin(1, { type: 'cresc', beat: frac(0, 1), length: frac(3, 1) })!.id
    render()
  })

  it('nudges the ink and leaves the wedge alone until the ink arrives', () => {
    for (let i = 0; i < 9; i++) expect(walkHairpinEndpoint(engine, wedgeId, 'start', 1)).toBe(true)
    expect(offset('start').x).toBeCloseTo(9)
    expect(span()).toEqual({ beat: 0, length: 3 })
  })

  it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
    // The whole design in one assertion: the tenth press moves the drawn tip by the same one space
    // as the other nine, but spends it on the WEDGE instead of the offset.
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span().beat).toBe(1)
    expect(offset('start').x).toBeCloseTo(0)
  })

  it('⭐⭐ the crossing HOLDS THE FAR END STILL — the wedge shortens, it does not slide', () => {
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    const { beat, length } = span()
    expect(beat + length, 'the end is where it was').toBe(3)
    expect(length, 'and the extent gave up exactly the beat the start took').toBe(2)
  })

  it('⭐ keeps the OTHER end’s own nudge through the crossing', () => {
    // The two ends are separate numbers, and a walk of one must not touch the other's shape.
    engine.nudgeHairpinEndpoint(wedgeId, 'end', 1.5, -2)
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span().beat, 'it did cross').toBe(1)
    expect(offset('end')).toEqual({ x: 1.5, y: -2 })
  })

  it('⛔ the vertical stays pure ink — ↑/↓ never walk', () => {
    for (let i = 0; i < 40; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 0)
    expect(span()).toEqual({ beat: 0, length: 3 })
    expect(offset('start')).toEqual({ x: 0, y: 0 })
  })

  it('🚨 refuses to cross when the next onset is not in this system — two x’s, two rulers', () => {
    render([100, 20, 120, 220])
    for (let i = 0; i < 30; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span()).toEqual({ beat: 0, length: 3 })
    expect(offset('start').x).toBeCloseTo(30)
  })

  it('⛔ never guesses the staff-space size — no measured staff means no crossing', () => {
    render([100, 200, 300, 400], null)
    for (let i = 0; i < 15; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span()).toEqual({ beat: 0, length: 3 })
    expect(offset('start').x).toBeCloseTo(15)
  })

  it('⭐ stops one slot short of the wedge’s own END, and the press stays a plain nudge', () => {
    // A start may not reach the end (`setHairpinStartAtSlot` refuses a non-positive length), so the
    // walk runs out of road at beat 2 — and the tip can still be pushed past it, which is what an
    // override is for.
    for (let i = 0; i < 40; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span()).toEqual({ beat: 2, length: 1 })
    expect(offset('start').x, 'the last 20 presses were ink').toBeCloseTo(20)
  })

  it('walks the other way too, and stops at the start of the score', () => {
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span().beat).toBe(1)
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', -1)
    expect(span(), 'back where it began, end held all the way').toEqual({ beat: 0, length: 3 })
    expect(offset('start').x).toBeCloseTo(0)
    for (let i = 0; i < 5; i++) walkHairpinEndpoint(engine, wedgeId, 'start', -1)
    expect(span().beat, 'never off the front').toBe(0)
    expect(offset('start').x).toBeCloseTo(-5)
  })

  it('⭐ a crossing press is ONE undo entry — the re-anchor and the re-base go back together', () => {
    for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'start', 1)
    expect(span().beat).toBe(1)
    engine.undo()
    expect(span()).toEqual({ beat: 0, length: 3 })
    expect(offset('start').x).toBeCloseTo(9)
  })
  /**
   * ⭐⭐ THE RIGHT SQUARE — the DURATION end (his name for it, 2026-08-20).
   *
   * The tip stands at the first note it does NOT cover, so this wedge's tip is drawn on the fourth
   * note's left edge (x = 400) and shrinking walks it back onto the third (x = 300) — ten presses of
   * a space. ⭐ Growing is the asymmetric one: past the last note there is no onset to stop before,
   * so the only stop left is COVERING it, at that note's own right edge.
   */
  describe('the tip', () => {
    it('nudges the ink and leaves the wedge alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkHairpinEndpoint(engine, wedgeId, 'end', -1)).toBe(true)
      expect(offset('end').x).toBeCloseTo(-9)
      expect(span()).toEqual({ beat: 0, length: 3 })
    })

    it('⭐ the tenth press SHRINKS the wedge by one slot, and the start never moves', () => {
      for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'end', -1)
      expect(span(), 'one slot less, beginning held').toEqual({ beat: 0, length: 2 })
      expect(offset('end').x).toBeCloseTo(0)
    })

    it('⭐ keeps the START’s own nudge through the crossing', () => {
      engine.nudgeHairpinEndpoint(wedgeId, 'start', -1.5, 1)
      for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'end', -1)
      expect(span().length, 'it did cross').toBe(2)
      expect(offset('start')).toEqual({ x: -1.5, y: 1 })
    })

    it('⭐ stops where the wedge would cover NO music — ⛔ a shrink never deletes it', () => {
      for (let i = 0; i < 40; i++) walkHairpinEndpoint(engine, wedgeId, 'end', -1)
      expect(span()).toEqual({ beat: 0, length: 1 })
      expect(offset('end').x, 'the presses that had nowhere to go were ink').toBeCloseTo(-20)
    })

    it('⭐⭐ grows to its BAR\'S END first — where the tip is drawn is where the stop is', () => {
      // The stop names the next bar's first note, but taking it leaves the wedge ending ON THE
      // BARLINE — which `hairpinSpan` reads as THIS bar's end, so the tip is drawn at 430, three
      // spaces on. 🚨 Pricing it at the note's x instead is what made a wedge at the end of a line
      // "cross" and then sit exactly where it was (*"it is never reaching the next system"*).
      for (let i = 0; i < 2; i++) expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1)).toBe(true)
      expect(span(), 'still ink').toEqual({ beat: 0, length: 3 })
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1)).toBe(true)
      expect(span(), 'the wedge now fills its bar').toEqual({ beat: 0, length: 4 })
      expect(offset('end').x).toBeCloseTo(0)
    })

    it('⭐⭐ …and past the last onset the only stop left is COVERING it', () => {
      // The tip is standing on the barline and the lane's final slot is the next bar's whole rest:
      // there is no onset to stop BEFORE any more, so the remaining boundary is that bar's own end.
      engine.setHairpinLength(wedgeId, frac(4, 1))
      renderSecondBar()
      drawn.noteEndX = { 1: 430, 2: 470 }
      for (let i = 0; i < 3; i++) walkHairpinEndpoint(engine, wedgeId, 'end', 1)
      expect(span(), 'still ink').toEqual({ beat: 0, length: 4 })
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1)).toBe(true)
      expect(span(), 'and it covers the whole lane').toEqual({ beat: 0, length: 8 })
    })

    it('⛔ …but never onto a bar the last render drew nothing for — no picture, no crossing', () => {
      engine.setHairpinLength(wedgeId, frac(4, 1))
      render([100, 200, 300, 400], 10, 425)
      drawn.undrawn = [2]
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1), 'refused, not guessed').toBe(false)
      expect(span()).toEqual({ beat: 0, length: 4 })
    })

    it('⛔ never guesses the staff-space size — no measured staff means no crossing', () => {
      render([100, 200, 300, 400], null)
      for (let i = 0; i < 15; i++) walkHairpinEndpoint(engine, wedgeId, 'end', -1)
      expect(span()).toEqual({ beat: 0, length: 3 })
      expect(offset('end').x).toBeCloseTo(-15)
    })

    it('⭐ a crossing press is ONE undo entry, on this end too', () => {
      for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'end', -1)
      expect(span().length).toBe(2)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 3 })
      expect(offset('end').x).toBeCloseTo(-9)
    })
  })

  /**
   * 🚨🚨 CROSSING A SYSTEM BREAK — his reports of 2026-08-20, in order: the wedge would not extend to
   * the next system; then it crossed in ONE press *"till the end"*; then it crossed once and never
   * reached the new line at all. One cause behind all three — the fold in the ruler — and the answer
   * is to unroll it: `(this line's end − the tip) + (the stop − that line's start)`.
   *
   * The fixture: bar 1 on the top line (music 90…430), bar 2 on the NEXT line (90…430, drawn 200 px
   * down) with four quarters of its own.
   */
  describe('a system break', () => {
    const twoSystems = (tipX = 400) => {
      render([100, 200, 300, 400], 10, tipX)
      drawn.systemTop = { 1: 40, 2: 240 }
      const next = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      next.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
    }

    it('🚨⭐⭐ the ink WRAPS at the barline — what would hang in the margin is drawn over there', () => {
      // His rule, 2026-08-20: *"after the barline, all the distance we are drawing in the old system
      // should be drawing in the beginning of the next system"*. Three presses fill bar 1 to its
      // barline (an ordinary step on this line), and the very next press leaves the line: the tip
      // re-appears one space past the NEXT system's start (90 → 100) rather than one space into this
      // one's margin.
      twoSystems()
      for (let i = 0; i < 3; i++) walkHairpinEndpoint(engine, wedgeId, 'end', 1)
      expect(span(), 'the wedge fills its own line').toEqual({ beat: 0, length: 4 })

      expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1), 'this press wraps').toBe(true)
      expect(span(), 'and the model now covers the next system’s first note').toEqual({ beat: 0, length: 5 })
      // The stop (that note's neighbour) is drawn at 200 and the line starts at 90, so an offset of
      // −10 spaces is exactly "one space in from the start of the line".
      expect(offset('end').x, 'the ink is re-based by the FOLDED distance').toBeCloseTo(-10)
    })

    it('⭐ …and every further press walks it on, until the ink reaches its anchor', () => {
      twoSystems()
      for (let i = 0; i < 4; i++) walkHairpinEndpoint(engine, wedgeId, 'end', 1)
      expect(offset('end').x).toBeCloseTo(-10)
      for (let i = 0; i < 10; i++) walkHairpinEndpoint(engine, wedgeId, 'end', 1)
      expect(offset('end').x, 'arrived at the stop the model already holds').toBeCloseTo(0)
      expect(span(), 'and nothing jumped on the way').toEqual({ beat: 0, length: 5 })
    })

    it('⭐⭐ …and it is SYMMETRIC — pushing back over the start wraps to the line before', () => {
      // *"is not symmetrical, i should offset also while going right"*. Backwards the edge is this
      // line's START and the far side is the previous line's END, so the same press-for-press price.
      twoSystems()
      for (let i = 0; i < 4; i++) walkHairpinEndpoint(engine, wedgeId, 'end', 1)   // wrapped
      expect(span().length).toBe(5)
      // The tip is one space in from the line's start; one press back puts it AT the start, the next
      // pushes past it and the wedge wraps home.
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', -1)).toBe(true)
      expect(span(), 'still on the new line').toEqual({ beat: 0, length: 5 })
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', -1), 'this one wraps back').toBe(true)
      expect(span(), 'and the wedge is back on the first line').toEqual({ beat: 0, length: 4 })
    })

    it('⭐ a crossing keeps the end’s own y — it is the wedge’s SHAPE, not a position', () => {
      twoSystems()
      engine.setHairpinLength(wedgeId, frac(4, 1))
      engine.nudgeHairpinEndpoint(wedgeId, 'end', 0, -2)
      walkHairpinEndpoint(engine, wedgeId, 'end', 1)
      expect(span().length, 'it wrapped').toBe(5)
      expect(offset('end').y).toBeCloseTo(-2)
    })

    it('⛔ …but with nothing to extend onto, the ink stops at the line’s end', () => {
      // Bar 2 undrawn: no way to show the stop is across a break rather than simply ahead, so the
      // limit applies and the press is REFUSED — ⛔ never clamped, and it may always come back.
      twoSystems(429)
      engine.setHairpinLength(wedgeId, frac(4, 1))
      drawn.undrawn = [2]
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', 1)).toBe(false)
      expect(walkHairpinEndpoint(engine, wedgeId, 'end', -1), 'back is allowed').toBe(true)
    })
  })
})
