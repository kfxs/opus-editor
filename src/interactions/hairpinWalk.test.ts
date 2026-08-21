import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import {
  walkHairpinEndpoint, walkHairpinBody, dragHairpinEndpoint, dragHairpinBody,
} from './hairpinWalk'
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
    hairpinId?: string; endpoint?: 'start' | 'end'
    bbox: { x: number; y: number; width: number; height: number }
    points?: { x: number; y: number }[]
  }[],
  lineSpacing: 10 as number | null,
  /** Per measure: the staff's top-line y (which system it is on) and where its music ends. */
  systemTop: {} as Record<number, number>,
  /** Per STAFF INDEX: how far below the system's top line that staff's own top line is. Empty means
   *  one staff per system, which is every case but the grand-staff ones. */
  staffOffset: {} as Record<number, number>,
  noteEndX: {} as Record<number, number>,
  /** Bars the last render drew nothing for — no geometry, so nothing may be measured against them. */
  undrawn: [] as number[],
  /** The staves' drawn bands. One by default: nothing to bump into, so the band rule allows. */
  bands: [{ top: 40, bottom: 80 }] as { top: number; bottom: number }[],
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number, staff = 0) => (drawn.lineSpacing === null || drawn.undrawn.includes(m) ? undefined : {
        lineSpacing: drawn.lineSpacing,
        // ⚠️ FIVE lines from the system's own top — it used to be `[top, 50, 60, 70, 80]`, i.e. a
        // per-system top line with system 1's BOTTOM under it, which is not a staff. Harmless until
        // `hairpinLane` began classifying a candidate by the staff it was drawn on (2026-08-21).
        lineYPositions: [0, 10, 20, 30, 40].map(d => (drawn.systemTop[m] ?? 40) + (drawn.staffOffset[staff] ?? 0) + d),
        noteStartX: 90, noteEndX: drawn.noteEndX[m] ?? 430,
      }),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      staffBands: () => drawn.bands,
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
    drawn.staffOffset = {}
    drawn.bands = [{ top: 40, bottom: 80 }]
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
    // ⭐⭐ …and the INK carries on, freely — his rule, 2026-08-21: *"the trill and the hairpin offset
    // left endpoint is also limited to the first measure after the time signature, the user should
    // not have that limit"*. ⛔ The only stop on this side is the PAGE's edge, the engine's.
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

    it('🚨🚨 a START that has wrapped BACK can keep walking — the ink is `anchor + offset`', () => {
      // His report, 2026-08-20: walking the left square back over a break, every press after the wrap
      // was refused and the wedge froze. A wedge whose start has just wrapped begins at the very END
      // of the previous line, so the piece drawn there has NO WIDTH and is not registered — and
      // reading "the first fragment" then returned the piece on the NEXT system, a small x judged
      // against the previous system's edges. ⛔ Never read the ink off a fragment.
      twoSystems()
      // A second wedge, this one living on the LOWER system: from bar 2's second note, one beat long.
      const lower = engine.addHairpin(2, { type: 'cresc', beat: frac(1, 1), length: frac(1, 1) })!.id
      // …drawn on that system, so the walk has a staff-space size to measure with.
      drawn.entries.push({
        type: 'hairpin', id: lower, staff: 0, measure: 2,
        bbox: { x: 200, y: 290, width: 100, height: 8 },
        points: [{ x: 200, y: 290 }, { x: 300, y: 288 }, { x: 300, y: 298 }, { x: 200, y: 290 }],
      })
      const startOf = (id: string) => {
        for (const m of engine.getScore().measures) {
          const h = m.hairpins?.find(w => w.id === id)
          if (h) return { measure: m.number, beat: fracToNumber(h.beat) }
        }
        return null
      }
      const inkOf = (id: string) =>
        hairpinEndpointOffsetOverrideOf(engine.getScore(), id)?.start?.x ?? 0

      // Ten presses walk its start onto bar 2's first note; two more push the ink past that line's
      // own start, and it wraps over the break.
      for (let i = 0; i < 12; i++) walkHairpinEndpoint(engine, lower, 'start', -1)
      expect(startOf(lower), 'it wrapped onto the previous system').toEqual({ measure: 1, beat: 3 })

      // ⚠️ THE FIXTURE IS THE BUG: after the wrap the only piece with any width is the one on the
      // LOWER system, running from its left margin (90) — the piece on the upper system is a point at
      // that line's end and is not registered at all. Reading the ink off "the first fragment" then
      // measures 90 against the UPPER system's edges, and refuses every press.
      drawn.entries = drawn.entries.filter(e => e.id !== lower)
      drawn.entries.push({
        type: 'hairpin', id: lower, staff: 0, measure: 2,
        bbox: { x: 90, y: 290, width: 210, height: 8 },
        points: [{ x: 90, y: 290 }, { x: 300, y: 288 }, { x: 300, y: 298 }, { x: 90, y: 290 }],
      })

      // ⭐ The press that used to be refused: the walk needs no fragment to know where its ink is.
      const before = inkOf(lower)
      expect(walkHairpinEndpoint(engine, lower, 'start', -1), 'still moving').toBe(true)
      expect(inkOf(lower)).toBeLessThan(before)
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

  /**
   * ⭐⭐ THE DRAG — the same journey with the cursor's pixels (his ask, 2026-08-20: *"now lets do the
   * walk for the mouse"*). The claim that matters is that it is the SAME journey: a drag and the
   * presses covering the same distance must leave ONE state, not two that look alike.
   */
  describe('the mouse', () => {
    it('⭐⭐ one frame lands exactly where the same distance in presses does', () => {
      // Ten spaces = the gap between two boundaries, so both roads cross once and land on the stop.
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, -100))
        .toEqual({ moved: true, wrapped: false, droppedPx: 0 })
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end').x).toBeCloseTo(0, 6)
    })

    it('⭐ …and it can PARK the tip between two boundaries, which the old snap could not', () => {
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, -35)?.moved).toBe(true)
      expect(span(), 'the model has not moved').toEqual({ beat: 0, length: 3 })
      expect(offset('end').x, 'the ink has').toBeCloseTo(-3.5, 6)
    })

    it('⭐⭐ …and it LATCHES on a boundary, so the engraver’s own position is reachable EXACTLY', () => {
      // A tip is AIMED at a note's edge, unlike a dynamic (which has no latch — a label placed by
      // eye). Pushed 2 spaces out and dragged 4 back, the ink stops DEAD at offset zero rather than
      // sailing 2 past it. (⭐ 2 spaces, not 5: this bar's end is only 3 away, and a longer push
      // would cross onto it — which the next assertion would then be measuring instead.)
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, 20)
      expect(offset('end').x).toBeCloseTo(2, 6)
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, -40)?.moved).toBe(true)
      expect(offset('end').x, 'stopped dead on its anchor').toBeCloseTo(0, 6)
      expect(span(), 'and it did not cross').toEqual({ beat: 0, length: 3 })
    })

    it('🚨🚨 a LATCHED frame reports what it DROPPED, so the caller can repay it', () => {
      // His report, 2026-08-20: dragging the tip along a line, it fell further behind the cursor at
      // every stop and never reached the end. The latch cuts a move short at the boundary and the
      // dropped pixels were still made by the hand — so the frame reports it and `MouseController`
      // leaves its cursor anchor put, presenting them again next frame. ⛔ Unpaid, this is exactly
      // snap-and-go's own defect.
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, 20)          // 2 spaces out
      const frame = dragHairpinEndpoint(engine, wedgeId, 'end', 200, -40)  // 4 back, through zero
      expect(offset('end').x, 'stopped dead on the anchor').toBeCloseTo(0, 6)
      expect(frame?.droppedPx, 'the 2 spaces it did not spend are owed back').toBeCloseTo(-20, 6)

      // ⭐ …and the caller hands them back: the next 20 px of travel are already paid for, so this
      // frame leaves the anchor by the full 4 spaces rather than by 2.
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, -40)?.droppedPx).toBe(0)
      expect(offset('end').x).toBeCloseTo(-4, 6)
    })

    it('⭐ a drag frame records NO undo entry — the drop commits the whole gesture once', () => {
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, -100)
      engine.undo()
      expect(engine.getHairpinById(wedgeId), 'the undo took back the wedge itself').toBeNull()
    })

    it('⛔ DECLINES (null) when the wedge is not drawn — ⚠️ null, not false', () => {
      render([100, 200, 300, 400], null)
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, -100)).toBeNull()
      expect(offset('end').x).toBe(0)
    })

    it('⭐⭐ a frame that WRAPS says so, and that ends the gesture (the caller drops the drag)', () => {
      // His call, 2026-08-20: the tip is a line below and the hand is not, so the drag is over —
      // *"if the user wants to keep extending he has to go with the mouse to the next system"*.
      // ⛔ The KEYS do not stop, of course: they have no cursor to be in the wrong place.
      const notes = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      render([100, 200, 300, 400], 10, 400)
      drawn.systemTop = { 1: 40, 2: 240 }
      notes.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      engine.setHairpinLength(wedgeId, frac(4, 1))   // ends on bar 1's barline

      // ⭐ The CURSOR is what says the line has run out: 440 is past this line's music end (430).
      const frame = dragHairpinEndpoint(engine, wedgeId, 'end', 440, 10)
      expect(frame).toEqual({ moved: true, wrapped: true, droppedPx: 0 })
      // ⭐⭐ …and a DRAGGED wrap lands a STUB inside the new line — 2 spaces past its start (90), so
      // 110 − the stop's own x. ⛔ Not the folded distance the KEYS use: a mouse's overshoot at the
      // wrapping frame is one frame of travel, which drew a 2 px sliver or nothing at all (*"not
      // working"*), and ⛔ not the anchor either, which draws a whole bar of wedge at once.
      expect(offset('end').x, '2 staff-spaces into the line').toBeCloseTo((110 - 200) / 10, 6)
      expect(span(), 'and the wedge has its new piece over there').toEqual({ beat: 0, length: 5 })
    })

    it('🚨⭐⭐ …and the CURSOR is what says the line has ended, ⛔ not the ink', () => {
      // His rule, 2026-08-20: *"when the x of the mouse is major than the x of the barline we jump to
      // the other system"*. Here the ink has barely moved — one pixel — but the hand is past the
      // barline, and that is the fact the gesture is about.
      const notes = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      render([100, 200, 300, 400], 10, 400)
      drawn.systemTop = { 1: 40, 2: 240 }
      notes.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      engine.setHairpinLength(wedgeId, frac(4, 1))   // its tip is on bar 1's barline

      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 500, 1)?.wrapped, 'past 430 → wrapped').toBe(true)
      expect(span()).toEqual({ beat: 0, length: 5 })
    })

    it('⛔ …and a cursor still INSIDE the line does not wrap, however the ink is nudged', () => {
      const notes = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      render([100, 200, 300, 400], 10, 400)
      drawn.systemTop = { 1: 40, 2: 240 }
      notes.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      engine.setHairpinLength(wedgeId, frac(4, 1))

      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 420, 60)?.wrapped).toBe(false)
      expect(span(), 'the model held still').toEqual({ beat: 0, length: 4 })
    })

    it('⭐⭐ the vertical is a plain ink offset — a `y` on ONE end TILTS the wedge', () => {
      // His ask, 2026-08-20. ⚠️ Screen-down is +y and so is the stored number, so a cursor going DOWN
      // writes a POSITIVE offset — ⛔ no conversion here, unlike the tempo mark's outward `y`.
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, 30)?.moved).toBe(true)
      expect(offset('end')).toEqual({ x: 0, y: 3 })
      expect(span(), 'and the music is untouched by it').toEqual({ beat: 0, length: 3 })
    })

    it('⭐ …and it rides along with the horizontal, in one gesture', () => {
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, -35, -20)
      expect(offset('end')).toEqual({ x: -3.5, y: -2 })
    })

    it('⭐ …and the lift SURVIVES a crossing — it is the wedge’s SHAPE, not a note’s distance', () => {
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, 20)
      dragHairpinEndpoint(engine, wedgeId, 'end', 200, -100, 0)   // one whole boundary back
      expect(span(), 'it crossed').toEqual({ beat: 0, length: 2 })
      expect(offset('end').y, 'the lift is still there').toBeCloseTo(2, 6)
    })

    it('🚨 the VERTICAL stops at the neighbouring staff’s room — the slur’s own band limit', () => {
      // His ask, 2026-08-20: *"we should not go crazy… for the slur we have a y limit, we have to do
      // something similar here"*. The wedge's square is drawn 20 px below the staff and the next
      // staff starts at 240, so the ink may use the whole gap and stops at THAT EDGE — ⛔ no midpoint
      // any more (`layout/systemBand`, his two reports of 2026-08-21). The write is REFUSED, never
      // clamped, and the mark can always come back UP.
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      drawn.entries.push({
        type: 'hairpin-endpoint', hairpinId: wedgeId, endpoint: 'end', staff: 0,
        bbox: { x: 396, y: 96, width: 8, height: 8 },
      })

      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, 10)?.moved, 'a space down is fine').toBe(true)
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, 300)?.moved, 'into the next staff is not').toBe(false)
    })

    it('⭐ …and ink already outside its band may always come BACK', () => {
      // ⛔ The rule judges whether a step makes the overhang WORSE, never whether the ink is outside:
      // a score carrying a wild offset (a saved file, an undo away) must still be draggable back.
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      drawn.entries.push({
        type: 'hairpin-endpoint', hairpinId: wedgeId, endpoint: 'end', staff: 0,
        bbox: { x: 396, y: 300, width: 8, height: 8 },   // already past the staff below's top (240)
      })

      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, 10)?.moved, 'further down: no').toBe(false)
      expect(dragHairpinEndpoint(engine, wedgeId, 'end', 200, 0, -10)?.moved, 'back up: yes').toBe(true)
    })

    it('⭐ the LEFT square drags the same way', () => {
      expect(dragHairpinEndpoint(engine, wedgeId, 'start', 200, 100)?.moved).toBe(true)
      expect(span(), 'the start moved one slot, its end held').toEqual({ beat: 1, length: 2 })
    })
  })

  /**
   * ⭐⭐ THE BODY — the WHOLE wedge, where the squares move one end each (his ask, 2026-08-20: *"we
   * still have the offset with the mouse when no endpoint is selected… we must turn that into a
   * walk… and in the y axis we detect if there is another system so we go to there"*).
   *
   * Two claims: the horizontal is the same walk (ink, then the MUSIC at each boundary, length
   * unchanged), and the vertical is a JUMP to the system the wedge now belongs to.
   */
  describe('the body', () => {
    it('⭐ nudges the whole wedge’s ink, and the music only when the ink arrives', () => {
      expect(dragHairpinBody(engine, wedgeId, 200, 35, 0)?.moved).toBe(true)
      expect(span(), 'still ink').toEqual({ beat: 0, length: 3 })
      expect(offset('start').x).toBeCloseTo(3.5, 6)
      expect(offset('end').x, 'both ends move together — that IS the body’s ink').toBeCloseTo(3.5, 6)
    })

    it('⭐⭐ …and the whole wedge MOVES at the boundary, keeping its length', () => {
      expect(dragHairpinBody(engine, wedgeId, 200, 100, 0)?.moved).toBe(true)
      expect(span(), 'one slot on, same extent').toEqual({ beat: 1, length: 3 })
      expect(offset('start').x, 'and the ink is re-based, so nothing jumped').toBeCloseTo(0, 6)
    })

    it('⭐ the vertical is ink too, while it stays on this system', () => {
      expect(dragHairpinBody(engine, wedgeId, 200, 0, 20)?.moved).toBe(true)
      expect(offset('start').y).toBeCloseTo(2, 6)
      expect(offset('end').y).toBeCloseTo(2, 6)
    })

    it('⭐⭐ the ARROWS walk it too, so the two devices land in ONE state', () => {
      // His ask once the mouse had it. Ten presses of a space = the 100 px between two boundaries,
      // which is exactly the one drag frame the case above makes.
      for (let i = 0; i < 9; i++) expect(walkHairpinBody(engine, wedgeId, 1)).toBe(true)
      expect(span(), 'still ink').toEqual({ beat: 0, length: 3 })
      expect(walkHairpinBody(engine, wedgeId, 1)).toBe(true)
      expect(span(), 'one slot on, same extent').toEqual({ beat: 1, length: 3 })
      expect(offset('start').x).toBeCloseTo(0, 6)
      expect(offset('end').x, 'both ends re-based together').toBeCloseTo(0, 6)
    })

    it('⭐ a crossing press is ONE undo entry — and it takes the whole wedge back', () => {
      for (let i = 0; i < 10; i++) walkHairpinBody(engine, wedgeId, 1)
      expect(span().beat).toBe(1)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 3 })
      expect(offset('start').x).toBeCloseTo(9, 6)
    })

    it('🚨⭐⭐ dragged UP off its staff, the wedge goes ABOVE that staff — ⛔ not to the system over it', () => {
      // His report, 2026-08-20: *"it jumps to the upper system too quickly; we need a boundary —
      // remember we can draw a hairpin up or down the staff"*. The space above a staff is a place a
      // wedge BELONGS, so crossing its own five lines is the first step, and only then is another
      // system even a question.
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      engine.nudgeHairpinEndpoint(wedgeId, 'start', 0, 2)   // a lift, which the flip drops
      engine.nudgeHairpinEndpoint(wedgeId, 'end', 0, 2)

      // The wedge's ink is at y 94, below a staff whose lines run 40…80. A hand that has carried it
      // past the TOP line has moved it to the other side of the staff.
      const frame = dragHairpinBody(engine, wedgeId, 200, 0, -60)
      expect(frame).toEqual({ moved: true, jumped: true })
      expect(engine.getHairpinById(wedgeId)?.placement, 'above its OWN staff').toBe('above')
      expect(span(), 'and the music has not moved at all').toEqual({ beat: 0, length: 3 })
      expect(offset('start').y, 'a lift measured below the staff means nothing above it').toBeCloseTo(0, 6)
    })

    it('⭐ …and back DOWN across the bottom line returns it below', () => {
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      engine.updateHairpin(wedgeId, { placement: 'above' })
      expect(dragHairpinBody(engine, wedgeId, 200, 0, 40)?.jumped).toBe(true)
      expect(engine.getHairpinById(wedgeId)?.placement).toBe('below')
    })

    it('🚨⭐⭐ …but a hand that has come down to the NEXT SYSTEM is a JUMP', () => {
      // ⛔ Not a walk: two systems' x's are not one ruler, so there is nothing continuous to travel
      // through. `markSystemJump`'s rule decides — halfway between where the wedge sits and where it
      // would sit down there — and a jump lands it where the engraver would, both axes of the offset
      // gone.
      const below = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      render([100, 200, 300, 400], 10, 400)
      drawn.systemTop = { 1: 40, 2: 240 }
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      below.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      engine.nudgeHairpinEndpoint(wedgeId, 'start', 0, 1)   // a small lift, which the jump drops

      const frame = dragHairpinBody(engine, wedgeId, 210, 0, 200)
      expect(frame).toEqual({ moved: true, jumped: true })
      expect(span().beat, 'it landed on the slot nearest the hand, down there').toBe(1)
      expect(offset('start'), 'and where the engraver would put it').toEqual({ x: 0, y: 0 })
      // ⭐⭐ …ON THE SIDE IT CAME FROM: coming down, the next rung of the ladder is ABOVE the staff
      // below — ⛔ not below it, which skips a rung and puts the wedge past the hand.
      expect(engine.getHairpinById(wedgeId)?.placement).toBe('above')
    })

    it('🚨⭐⭐ …and the OTHER HAND of a grand staff is a landing too, not only the next system', () => {
      // His ask, 2026-08-21: *"we already did on dynamic correctly, now we should apply this also to
      // hairpin."* ⭐ The rule never changed — `markSystemJump` always chose between PAINTED STAVES
      // and the left hand was in the running with no candidate on it, so the wedge sailed past it.
      const lower = engine.addStaffBelow(0)
      const left = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 3, duration: 'q', measure: 1, beat: frac(i, 1), staff: 1 })!.id)
      render()
      // ONE system, two staves: 40…80 and 240…280. The wedge's ink is at 90, ten below its own
      // staff, so its twin under the left hand is 290 and the switch falls at 190.
      drawn.staffOffset = { 1: 200 }
      drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
      left.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 1, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))

      expect(dragHairpinBody(engine, wedgeId, 210, 0, 90), 'not yet').toEqual({ moved: true, jumped: false })
      expect(dragHairpinBody(engine, wedgeId, 210, 0, 200)).toEqual({ moved: true, jumped: true })
      // ⭐⭐ The LANDING NAMES A STAFF — that is the whole of what was missing.
      expect(engine.getHairpinById(wedgeId)?.staffId, 'it is the left hand’s wedge now').toBe(lower)
      expect(span().beat, 'the slot nearest the hand, over there').toBe(1)
      expect(span().length, 'the extent is an amount of MUSIC and rides along').toBe(3)
      expect(engine.getHairpinById(wedgeId)?.placement, 'one rung: above the staff below').toBe('above')
    })
  })
})
