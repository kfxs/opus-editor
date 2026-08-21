import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { walkPedalEndpoint } from './pedalWalk'
import { pedalOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ←/→ on an ARMED SQUARE moves that sign's INK, and carries the FOOT along once the ink arrives at
 * the next stop of the lane.
 *
 * Subject: {@link pedalWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s and the wrap is `./markBreakWrap`'s, both proven from five ends already. The
 * `MusicEngine` is real, but the REGISTRY is fabricated: the walk reads two drawn x's and a
 * staff-space size off the last render, and jsdom draws nothing
 * (`reference_jsdom_cannot_measure_glyphs`). The noteheads are 100 px apart at 10 px per staff-space,
 * so a gap between two columns is exactly 10 staff-spaces and a 1-space press has to be taken ten
 * times to cross it.
 *
 * ⭐⭐ What this chapter owns, over the other families': **the LIFT is a moment in time, not a note.**
 * Two of its cases exist only here — the release standing on the BARLINE (an address no onset names,
 * priced at `noteEndX` less the air, which is a gap of 2.6 spaces rather than 10), and the press that
 * PUSHES the lift instead of being refused by it.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as {
    type: string; id?: string; staff?: number; measure?: number
    bbox: { x: number; y: number; width: number; height: number }
  }[],
  lineSpacing: 10 as number | null,
  /** Per measure: the staff's top-line y — which system that bar was drawn on. */
  systemTop: {} as Record<number, number>,
  /** Bars the last render drew NOTHING for — no geometry at all, which is how a real registry
   *  answers for a bar that was never painted. */
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
        noteStartX: 90, noteEndX: 430,
      }),
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      staffBands: () => [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }],
    }))
  },
}))
vi.mock('../engine/audio/PlaybackEngine', () => ({
  PlaybackEngine: class {
    setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
  },
}))

describe('walkPedalEndpoint', () => {
  let engine: MusicEngine
  let ids: string[]
  let pedalId: string

  const offset = (which: 'start' | 'end') =>
    pedalOffsetOverrideOf(engine.getScore(), pedalId)?.[which === 'start' ? 'startX' : 'endX'] ?? 0
  /** Where the foot goes down and how much music it holds, in quarter-beats of bar 1. */
  const span = () => {
    const pedal = engine.getPedalById(pedalId)!
    return { beat: fracToNumber(pedal.beat), length: fracToNumber(pedal.length) }
  }

  /** Four noteheads 100 px apart, and the drawn pedal (which is what carries a staff to measure).
   *  Pass `null` for a staff with no measured geometry. */
  const render = (xs = [100, 200, 300, 400], lineSpacing: number | null = 10) => {
    drawn.lineSpacing = lineSpacing
    drawn.undrawn = []
    drawn.systemTop = { 1: 40, 2: 40 } // ⭐ ONE system by default
    drawn.entries = ids.map((id, i) => ({
      type: 'note', id, staff: 0, bbox: { x: xs[i], y: 50, width: 10, height: 10 },
    }))
    drawn.entries.push({
      type: 'pedal', id: pedalId, staff: 0, measure: 1,
      bbox: { x: 100, y: 120, width: 30, height: 10 },
    })
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    // Beats 0 → 2: the press is on the first note (x 100) and the release stands on the THIRD
    // (x 300), which is where the damper falls — a lift is the next onset, not the last one held.
    pedalId = engine.addPedal(1, { beat: frac(0, 1), length: frac(2, 1) })!.id
    render()
  })

  describe('the press', () => {
    it('nudges the ink and leaves the pedal alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkPedalEndpoint(engine, pedalId, 'start', 1)).toBe(true)
      expect(offset('start')).toBeCloseTo(9)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })

    it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
      // The whole design in one assertion: the tenth press moves the drawn `Ped.` by the same one
      // space as the other nine, but spends it on the PEDAL instead of the offset.
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span().beat).toBe(1)
      expect(offset('start')).toBeCloseTo(0)
    })

    it('⭐⭐ the crossing HOLDS THE LIFT STILL — the pedal shortens, it does not slide', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      const { beat, length } = span()
      expect(beat + length, 'the damper still comes up where it did').toBe(2)
      expect(length, 'and the extent gave up exactly the beat the press took').toBe(1)
    })

    it('⭐ keeps the RELEASE’s own nudge through the crossing', () => {
      engine.nudgePedalEndpoint(pedalId, 'end', 1.5, 0)
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span().beat, 'it did cross').toBe(1)
      expect(offset('end')).toBeCloseTo(1.5)
    })

    it('⭐⭐ walks THROUGH its own lift — the press PUSHES it, and the release re-anchors', () => {
      // His rule, 2026-08-21, given for the bracket and stated about the two anchors. 🚨 It was a
      // REFUSAL here until that day, and a refusal stops the walk dead: every further press becomes
      // ink and the square leaves the page while the pedal stands still.
      for (let i = 0; i < 30; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span(), 'on the last note of the lane, holding that one quarter').toEqual({ beat: 3, length: 1 })
      expect(offset('start'), 'the presses past the end of the road were ink').toBeCloseTo(0)
    })

    it('walks the other way too, and stops at the start of the score', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span().beat).toBe(1)
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', -1)
      expect(span(), 'back where it began, lift held all the way').toEqual({ beat: 0, length: 2 })
      expect(offset('start')).toBeCloseTo(0)
      for (let i = 0; i < 5; i++) walkPedalEndpoint(engine, pedalId, 'start', -1)
      expect(span().beat, 'never off the front').toBe(0)
      expect(offset('start'), 'those presses were ink — ⭐ which is FREE, see the header').toBeCloseTo(-5)
    })

    it('⭐ a crossing press is ONE undo entry — the re-anchor and the re-base go back together', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span().beat).toBe(1)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('start')).toBeCloseTo(9)
    })
  })

  /**
   * ⭐⭐ THE RELEASE — a MOMENT, so its stops are lifts rather than noteheads. This pedal comes up at
   * beat 2, drawn on the THIRD note (300); growing reaches THROUGH that note, so the next stop is
   * beat 3, drawn on the fourth (400) — ten presses of a space.
   */
  describe('the lift', () => {
    it('nudges the ink and leaves the pedal alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkPedalEndpoint(engine, pedalId, 'end', 1)).toBe(true)
      expect(offset('end')).toBeCloseTo(9)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })

    it('⭐ the tenth press moves the damper by one slot, and the press never moves', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span(), 'one slot more, press held').toEqual({ beat: 0, length: 3 })
      expect(offset('end')).toBeCloseTo(0)
    })

    it('⭐ keeps the PRESS’s own nudge through the crossing', () => {
      engine.nudgePedalEndpoint(pedalId, 'start', -1.5, 0)
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span().length, 'it did cross').toBe(3)
      expect(offset('start')).toBeCloseTo(-1.5)
    })

    it('⭐⭐ the BARLINE is a stop, and it is priced where the `✻` is DRAWN', () => {
      // The pedal's own case, and the one no other family has: past the last onset of the bar the
      // release stands at `noteEndX` (430) less PEDAL_BARLINE_AIR (0.4 sp), i.e. 426 — so the gap
      // from the fourth note (400) is 2.6 spaces, not the 10 every other crossing here costs.
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span().length, 'the release is on the last note now').toBe(3)
      for (let i = 0; i < 2; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span().length, 'two spaces is short of 2.6 — still ink').toBe(3)
      walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span(), 'the third press lands the foot on the barline').toEqual({ beat: 0, length: 4 })
      expect(offset('end'), 'and the ink gave the 2.6 back').toBeCloseTo(0.4)
    })

    it('⭐ shrinks the other way, and ⛔ never as far as holding NO music', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', -1)
      expect(span(), 'the release fell back onto the second note').toEqual({ beat: 0, length: 1 })
      for (let i = 0; i < 20; i++) walkPedalEndpoint(engine, pedalId, 'end', -1)
      expect(span(), 'a shrink never deletes the pedal').toEqual({ beat: 0, length: 1 })
      expect(offset('end'), 'the presses that had nowhere to go were ink').toBeCloseTo(-20)
    })

    it('⭐ stops at the end of the lane, and the press stays a plain nudge', () => {
      for (let i = 0; i < 40; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span(), 'it reached the barline, with nothing beyond it in the score').toEqual({ beat: 0, length: 4 })
      expect(offset('end'), 'the presses past the end of the road were ink').toBeGreaterThan(0)
    })

    it('⭐ a crossing press is ONE undo entry, on this end too', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span().length).toBe(3)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(9)
    })
  })

  /**
   * 🚨🚨 CROSSING A SYSTEM BREAK — the rule and its four rejected cuts are the wedge's
   * (`./markBreakWrap`); what this chapter pins is the PEDAL's port into it. The fixture: bar 1 on
   * the top line (music 90…430), bar 2 on the next line (drawn 200 px down) with four quarters of
   * its own, and the pedal holding all of bar 1 so its release stands on that line's barline.
   */
  describe('a system break', () => {
    beforeEach(() => {
      engine.addMeasure()
      render()
      drawn.systemTop = { 1: 40, 2: 240 }
      const next = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      next.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      // The pedal now holds the whole of bar 1: the `✻` is at the barline (426), four px short of
      // where the line's music ends.
      engine.setPedalLength(pedalId, frac(4, 1))
      expect(span()).toEqual({ beat: 0, length: 4 })
    })

    it('⭐ the press before the edge is ordinary ink', () => {
      expect(walkPedalEndpoint(engine, pedalId, 'end', 0.25)).toBe(true)
      expect(span(), 'nothing has moved yet').toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(0.25)
    })

    it('⭐⭐ the press that passes the line\'s end WRAPS onto the next system', () => {
      walkPedalEndpoint(engine, pedalId, 'end', 1)
      // The foot now comes up a quarter into bar 2 — a whole bar of pedal in the MODEL…
      expect(span(), 'it holds into bar 2').toEqual({ beat: 0, length: 5 })
      // …and the DRAWING shows a stub: the ink that would have hung in the right margin re-appears
      // just inside the new line, which is the whole of his rule.
      expect(offset('end')).toBeLessThan(0)
    })

    it('⭐ a crossing press is ONE undo entry here too', () => {
      walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span().length).toBe(5)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(0)
    })

    it('⭐⭐ …and it is symmetric: the PRESS wraps back onto the line above', () => {
      // Move the press onto bar 2, then walk it left off the front of that line.
      engine.movePedalStartToSlot(pedalId, { measure: 2, beat: frac(1, 1) })
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', -1)
      expect(engine.getPedalById(pedalId)!.beat, 'back onto bar 2\'s first note').toEqual(frac(0, 1))
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', -1)
      expect(engine.getScore().measures.find(m => m.number === 1)?.pedals?.length,
        'and then back onto the system above').toBe(1)
    })

    it('⛔ never onto a bar the last render drew nothing for', () => {
      drawn.undrawn = [2]
      drawn.entries = drawn.entries.filter(e => e.bbox.y < 200)
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span(), 'ink only — no picture, no wrap').toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(10)
    })
  })

  /**
   * ⭐⭐ **THE TWO SIGNS' INK DOES NOT STOP THE WALK — the bracket's behaviour, and his call**
   * (2026-08-21: *"the behaviour of the pedal should be similar to the behaviour of the ottava"*,
   * *"in the ottava we never have this problem"*).
   *
   * 🚨 An order rule lived here for a day and produced two reports at once: *"i'm not able to walk
   * here"* (forty refusals in a row) and *"look how the pedal walk accelerates a lot in certain
   * spots"* — because a refused ink step makes every press hand the anchor a WHOLE STOP along.
   * {@link MusicEngine.pedalEndpointOffsetAllowed} carries the reasoning; what the walk owes is this:
   * touching glyphs change NOTHING about the pace.
   */
  describe('when the two signs are drawn touching', () => {
    /** The pair as DRAWN with no air at all: `Ped.`'s ink ends exactly where the `✻` begins. */
    const touching = () => {
      drawn.entries = drawn.entries.filter(e => e.type !== 'pedal')
      drawn.entries.push(
        { type: 'pedal', id: pedalId, staff: 0, measure: 1, pedalSign: 'down',
          bbox: { x: 100, y: 120, width: 35, height: 10 } } as never,
        { type: 'pedal', id: pedalId, staff: 0, measure: 1, pedalSign: 'up',
          bbox: { x: 135, y: 120, width: 13, height: 10 } } as never,
      )
    }

    it('⭐⭐ the press keeps its pace — one space of ink, and the LIFT does not move', () => {
      touching()
      expect(walkPedalEndpoint(engine, pedalId, 'start', 1)).toBe(true)
      expect(span(), 'nothing audible yet — this press was ink').toEqual({ beat: 0, length: 2 })
      expect(offset('start')).toBeCloseTo(1)
      // ⛔ The armed square walks ALONE — his rule, 2026-08-21: *"it should not move both side,
      // cause we are just walking the beginning endpoint"*.
      expect(offset('end')).toBe(0)
    })

    it('⭐ …and the tenth press hands the foot over exactly as it would with air', () => {
      touching()
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span().beat, 'the arrival is the ordinary one').toBe(1)
      expect(offset('start')).toBeCloseTo(0)
    })

    it('🚨🚨 ⛔ a press with NO foot to move and NO ink to move writes NOTHING', () => {
      // Shrink to one slot first: the model refuses to give up its last one, so there is no stop.
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', -1)
      expect(span()).toEqual({ beat: 0, length: 1 })
      const parked = offset('end')
      touching()

      // 🚨 His report, 2026-08-21: *"the `✻` goes back a lot and then we have to re-establish this
      // till I can go in the other direction"* — twenty presses of free ink the drawing floors away,
      // and twenty more to pay them back. ⭐ The floor is asked BEFORE the write now
      // ({@link MusicEngine.pedalLiftInkWouldMove}).
      for (let i = 0; i < 20; i++) {
        expect(walkPedalEndpoint(engine, pedalId, 'end', -1), 'a dead key writes nothing').toBe(false)
      }
      expect(offset('end'), 'no debt to walk back out of').toBeCloseTo(parked)
      expect(span(), 'and the pedal itself is untouched').toEqual({ beat: 0, length: 1 })
    })

    it('⭐ …and the way OUT is open on the very first press — it refuses only what makes it worse', () => {
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', -1)
      touching()
      expect(walkPedalEndpoint(engine, pedalId, 'end', -1)).toBe(false)
      expect(walkPedalEndpoint(engine, pedalId, 'end', 1), 'rightward is never refused').toBe(true)
    })
  })

  describe('what it declines', () => {
    it('⛔ writes nothing for a step of zero', () => {
      expect(walkPedalEndpoint(engine, pedalId, 'end', 0)).toBe(false)
    })

    it('⛔ is false for an id that has gone', () => {
      expect(walkPedalEndpoint(engine, 'nope', 'end', 1)).toBe(false)
    })

    it('⛔ never GUESSES a staff-space size — an unmeasured staff cannot CROSS', () => {
      // The no-fallback rule (`./markWalk`): a guessed size writes a re-base of the wrong size,
      // quietly, and only on a staff that is not the default one. ⭐ The press is still ink — a key
      // that did nothing at all would be worse than one that cannot re-anchor.
      render([100, 200, 300, 400], null)
      for (let i = 0; i < 20; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      expect(span(), 'nothing re-anchored').toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(20)
    })
  })
})
