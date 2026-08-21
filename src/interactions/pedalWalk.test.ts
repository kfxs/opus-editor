import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { dragPedalBody, dragPedalEndpoint, walkPedalBody, walkPedalEndpoint } from './pedalWalk'
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
  /** ⭐ How far below staff 0 a SECOND staff of the same system was painted, or null for a
   *  single-staff score — the grand-staff case the BAND rule turns on. */
  secondStaffDrop: null as number | null,
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number, s = 0) => {
        if (drawn.lineSpacing === null || drawn.undrawn.includes(m)) return undefined
        // ⚠️ A staff the render did not paint has NO geometry — that is how the registry says which
        // staves this system actually has.
        if (s > 0 && drawn.secondStaffDrop === null) return undefined
        const top = (drawn.systemTop[m] ?? 40) + (s > 0 ? drawn.secondStaffDrop! : 0)
        return {
          lineSpacing: drawn.lineSpacing,
          lineYPositions: [top, top + 10, top + 20, top + 30, top + 40],
          noteStartX: 90, noteEndX: 430,
        }
      },
      getByMeasure: vi.fn(() => []),
      getByType: (t: string) => drawn.entries.filter(e => e.type === t),
      staffBands: () => [
        { top: 40, bottom: 80 },
        ...(drawn.secondStaffDrop === null
          ? [] : [{ top: 40 + drawn.secondStaffDrop, bottom: 80 + drawn.secondStaffDrop }]),
        { top: 240, bottom: 280 },
      ],
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
    drawn.secondStaffDrop = null
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

    it('⭐⭐ a DRAG wraps when the HAND passes the barline, ⛔ not when the ink does', () => {
      // His rule for the wedge: a drag has the pointer itself, which is both simpler and truer than
      // the ink — the ink only gets there if every frame on the way was accepted.
      const frame = dragPedalEndpoint(engine, pedalId, 'end', 440, 10)!
      expect(frame.wrapped, "the cursor is past this line's last ink (430)").toBe(true)
      expect(span(), 'the foot now comes up inside bar 2').toEqual({ beat: 0, length: 5 })
      // ⭐ And it lands a STUB inside the new line — ⛔ not the folded distance the KEYS re-base by.
      expect(offset('end')).toBeLessThan(0)
    })

    it('⭐ …and a frame short of the barline is ordinary ink', () => {
      const frame = dragPedalEndpoint(engine, pedalId, 'end', 420, 10)!
      expect(frame.wrapped).toBe(false)
      expect(span()).toEqual({ beat: 0, length: 4 })
    })

    it('⭐⭐ the WHOLE pedal wraps too, and takes its span with it', () => {
      // The body's stops are the press's, so the wrap is measured from the `Ped.`'s own system. Walk
      // the press to the last onset of the line, then push it off the end.
      for (let i = 0; i < 40; i++) walkPedalBody(engine, pedalId, 1)
      const pedal = engine.getPedalById(pedalId)!
      expect(fracToNumber(pedal.length), '⭐ the span is unchanged by every step of it').toBe(4)
      expect(engine.getScore().measures.find(m => m.number === 2)?.pedals?.length,
        'and it ended up filed under bar 2, on the next system').toBe(1)
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
   * {@link MusicEngine.pedalEndpointStepAllowed} carries the reasoning; what the walk owes is this:
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

  /**
   * ⭐⭐ THE DRAG — the same journey with the cursor's delta in pixels (his ask, 2026-08-21: *"i think
   * we should do the pedal drag walking"*). It used to SNAP the grabbed sign to the nearest address,
   * with a measured sign-to-music `y` to tell one system from another; what this chapter owns is that
   * a drag and N presses over the same distance land in ONE state, plus the two things only the mouse
   * has: the LATCH at offset zero and the repayment it owes.
   *
   * 10 px per staff-space, and the stops are 100 px apart — so one gap is one 100 px frame.
   */
  describe('the drag', () => {
    /** A frame at `cursorX`, having moved `dxPx` since the last accepted one. */
    const frame = (which: 'start' | 'end', cursorX: number, dxPx: number, dyPx = 0) =>
      dragPedalEndpoint(engine, pedalId, which, cursorX, dxPx, dyPx)

    it('moves INK while the hand is between two stops — ⛔ the foot does not move', () => {
      expect(frame('end', 330, 30)!.moved).toBe(true)
      expect(span(), 'the model is untouched').toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(3)
    })

    it('⭐ carries the foot when the ink ARRIVES, exactly as the arrows do', () => {
      frame('end', 400, 100)
      expect(span(), 'the damper comes up a beat later').toEqual({ beat: 0, length: 3 })
      expect(offset('end'), 'and the ink did not jump — the identity').toBeCloseTo(0)
    })

    it('⭐⭐ …and a drag lands where the PRESSES do, which is the point of one journey', () => {
      // ⚠️ The presses go first and the model is wound back by hand: a drag FRAME records no undo
      // entry (that is its whole difference), so `undo()` here would take back the pedal itself.
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'end', 1)
      const pressed = { ...span(), ink: offset('end') }
      engine.setPedalLength(pedalId, frac(2, 1))
      expect(span(), 'wound back').toEqual({ beat: 0, length: 2 })

      frame('end', 400, 100)
      expect({ ...span(), ink: offset('end') }).toEqual(pressed)
    })

    it('⭐ the PRESS square walks the same way, holding the lift', () => {
      frame('start', 200, 100)
      expect(span(), 'the foot goes down a beat later, the release stays put')
        .toEqual({ beat: 1, length: 1 })
      expect(offset('start')).toBeCloseTo(0)
    })

    it('⭐⭐ THE LATCH: the ink stops dead at offset zero, and REPORTS what it dropped', () => {
      // Two frames: the first parks the ink 3 spaces short of the next stop, the second would fly 5
      // past it. The latch cuts the move at the stop — where the engraver puts the sign — and the 2
      // spaces it swallowed come back as `droppedPx` for the caller to repay.
      frame('end', 370, 70)
      const latched = frame('end', 420, 50)!
      expect(span(), 'it crossed').toEqual({ beat: 0, length: 3 })
      expect(offset('end'), 'and stopped exactly on the column').toBeCloseTo(0)
      expect(latched.droppedPx, '⭐ in PIXELS, the caller\'s own unit').toBeCloseTo(20)
    })

    it('⛔ writes no undo entry of its own — the drop commits the gesture ONCE', () => {
      frame('end', 400, 100)
      expect(span()).toEqual({ beat: 0, length: 3 })
      engine.commitPedalDrag('end')
      engine.undo()
      expect(span(), 'one undo takes the whole drag back').toEqual({ beat: 0, length: 2 })
    })

    /**
     * ⭐⭐ THE VERTICAL — the drag carries both axes in one gesture, and the `y` lands on BOTH SIGNS
     * whichever square is under the hand: a pedal and its own release share ONE baseline (Gould
     * p. 333), so `PedalOffsetOverride` has a single vertical and both ends write it.
     *
     * ⛔ **No screen→outward conversion here, unlike the bracket's** — a pedal has one side
     * permanently, so `+ down` means the same thing everywhere it can be drawn.
     */
    describe('the vertical', () => {
      /** The pair's one stored height, in SCREEN staff-spaces (+ down). */
      const y = () => pedalOffsetOverrideOf(engine.getScore(), pedalId)?.y ?? 0

      it('⭐ follows the hand down, sign for sign — ⛔ nothing is flipped on this road', () => {
        expect(frame('end', 300, 0, 25)!.moved).toBe(true)
        expect(y()).toBeCloseTo(2.5)
      })

      it('⭐⭐ the START square writes the SAME field — the pair cannot tilt', () => {
        frame('start', 100, 0, 25)
        expect(y()).toBeCloseTo(2.5)
        // ⛔ Not a per-sign pair: one number, and the second square adds to it.
        frame('end', 300, 0, 15)
        expect(y()).toBeCloseTo(4)
      })

      it('⭐ rides along with a horizontal that CROSSES, and survives it', () => {
        frame('end', 400, 100, 10)
        expect(span(), 'the damper comes up a beat later').toEqual({ beat: 0, length: 3 })
        expect(y(), 'and the height came with it').toBeCloseTo(1)
      })

      /** The drawn `Ped.`'s own box — ⚠️ the registry is a FIXTURE, so it does not move when the
       *  model is written; a case that wants the ink somewhere else says so. */
      const pedalInk = () => drawn.entries.find(e => e.type === 'pedal')!.bbox

      it('🚨 STOPS where a sign would enter the SYSTEM BELOW\'s room — his rule', () => {
        // *"by the way on the drag we have to limit the pedal y offset"* (2026-08-21) — the sentence
        // that produced the band rule for the slur, the wedge and then the bracket, arriving at the
        // family that had no vertical drag to be judged until now. ⭐ The limit falls HALFWAY to the
        // neighbouring staff — 80 px under this one's foot, ⛔ not at its lines
        // (`layout/systemBand`) — and the fixture's `Ped.` is already 4 spaces down, so it has 3
        // left. ⚠️ That tightness is the fixture's, not the rule's: real systems are further apart.
        expect(frame('end', 300, 0, 25)!.moved, 'two and a half spaces down, still its own room').toBe(true)
        expect(y()).toBeCloseTo(2.5)
        expect(frame('end', 300, 0, 700)!.moved, '⛔ but not into the system below').toBe(false)
        expect(y(), 'and nothing was written — ⛔ the value never accumulates past the edge')
          .toBeCloseTo(2.5)
      })

      it('⭐ …and it is never STRANDED: the way home is always allowed', () => {
        // Ink already outside its band — a re-flow moved the system under it, or an older file was
        // saved that way. ⛔ Refusing both directions there would strand the pedal for good.
        pedalInk().y = 400
        expect(frame('end', 300, 0, 10)!.moved, '⛔ no further down').toBe(false)
        expect(frame('end', 300, 0, -10)!.moved, '⭐ but always back').toBe(true)
      })

      /**
       * 🚨🚨 **THE NEIGHBOUR IS ANOTHER SYSTEM, ⛔ NEVER THE OTHER STAFF OF MY OWN** — his report,
       * 2026-08-21: *"the band rule have a problem… look how the pedal is limit before the pedal
       * lane, rethink the band limit in general cause this should not happen"*.
       *
       * ⭐⭐ THE BREAK-TEST FOR THE WHOLE RULE, and it must be a GRAND STAFF: a pedal belongs below
       * its staff, and in a two-staff system that lane lies in the gap between the two — already past
       * halfway to the staff below. Judged against that staff, the mark is refused at its own
       * ENGRAVED HOME and cannot be dragged down at all; judged against the next SYSTEM, it has the
       * room its own system gives it.
       */
      it('🚨 uses ALL of its own system\'s gap, and stops at the partner STAFF', () => {
        // Staff 0 at 40…80 and its partner 100 px lower (140…180) — the pedal's ink at 120…130 sits
        // between them, where `PedalRenderer` puts it.
        //
        // ⭐⭐ TWO BREAK-TESTS IN ONE, one per report. Halfway-to-the-partner (110) is ABOVE the ink,
        // so the first rule refused every downward step at the mark's own engraved home — *"limit
        // before the pedal lane"*. Halfway-to-the-next-SYSTEM (160) let it sail across the partner
        // staff — *"too extreme"*. The partner's EDGE (140) is the answer to both.
        drawn.secondStaffDrop = 100
        engine.addStaffBelow(0)
        expect(frame('end', 300, 0, 5)!.moved, 'down into its own system\'s gap').toBe(true)
        expect(y()).toBeCloseTo(0.5)
        expect(frame('end', 300, 0, 30)!.moved, '⛔ but never onto the staff below').toBe(false)
        expect(y(), '⛔ and nothing accumulates past the edge').toBeCloseTo(0.5)
      })

      it('⛔ a purely vertical frame moves nothing horizontal', () => {
        frame('end', 300, 0, 25)
        expect(span()).toEqual({ beat: 0, length: 2 })
        expect(offset('end')).toBe(0)
      })
    })

    it('⛔ declines — null — when the pedal is not drawn, so there is no scale', () => {
      render([100, 200, 300, 400], null)
      expect(frame('end', 400, 100)).toBeNull()
    })
  })

  /**
   * ⭐⭐ **THE WHOLE PEDAL WALKS — nothing armed** (his ask, 2026-08-21: *"lets do the pedal shape
   * walking with keyboards"*). What this chapter owns over the two squares' is one claim: the stops
   * are the PRESS's and the LIFT is not held, so the span TRAVELS. Moving a mark, ⛔ not reshaping it.
   */
  describe('the body walk', () => {
    /** The ink both signs carry while the pedal is moved as one — read off the press. */
    const ink = () => offset('start')

    it('nudges the ink and leaves the pedal alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkPedalBody(engine, pedalId, 1)).toBe(true)
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(ink()).toBeCloseTo(9)
      expect(offset('end'), 'both signs, the same number').toBeCloseTo(9)
    })

    it('⭐⭐ the tenth press MOVES the whole pedal — ⛔ the LIFT is not held', () => {
      for (let i = 0; i < 10; i++) walkPedalBody(engine, pedalId, 1)
      expect(span(), 'a slot along, the SAME length').toEqual({ beat: 1, length: 2 })
      expect(ink(), 'and the ink did not jump — the identity').toBeCloseTo(0)
    })

    it('⭐⭐ …where the START square would have held it and shortened the pedal', () => {
      // The break-test for "moving is not reshaping": the same ten presses through the armed square
      // leave the damper coming up where it did.
      for (let i = 0; i < 10; i++) walkPedalEndpoint(engine, pedalId, 'start', 1)
      expect(span(), 'the lift stayed at beat 2').toEqual({ beat: 1, length: 1 })
    })

    it('⭐ it is AUDIBLE at the crossing, and only there', () => {
      for (let i = 0; i < 9; i++) walkPedalBody(engine, pedalId, 1)
      expect(span(), 'nine presses of pure ink').toEqual({ beat: 0, length: 2 })
      walkPedalBody(engine, pedalId, 1)
      expect(span(), 'the tenth says the damper falls a beat later').toEqual({ beat: 1, length: 2 })
    })

    it('⭐ a crossing press is ONE undo entry', () => {
      for (let i = 0; i < 10; i++) walkPedalBody(engine, pedalId, 1)
      expect(span().beat).toBe(1)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(ink()).toBeCloseTo(9)
    })

    it('walks back too, and stops at the start of the score — the ink carries on', () => {
      for (let i = 0; i < 10; i++) walkPedalBody(engine, pedalId, 1)
      for (let i = 0; i < 10; i++) walkPedalBody(engine, pedalId, -1)
      expect(span(), 'back where it began').toEqual({ beat: 0, length: 2 })
      for (let i = 0; i < 5; i++) walkPedalBody(engine, pedalId, -1)
      expect(span().beat, 'never off the front').toBe(0)
      expect(ink(), '⭐ and the ink is FREE past it').toBeCloseTo(-5)
    })

    it('⛔ never guesses the staff-space size — no measured staff means no crossing', () => {
      render([100, 200, 300, 400], null)
      for (let i = 0; i < 15; i++) walkPedalBody(engine, pedalId, 1)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })

    it('⛔ a zero press writes nothing', () => {
      expect(walkPedalBody(engine, pedalId, 0)).toBe(false)
    })
  })

  /**
   * ⭐⭐ **THE BODY DRAG — the whole pedal follows the hand** (his ask, 2026-08-21: *"lets do the pedal
   * shape drag walking, taking into account the y so we jump system"*). The bracket's chapter one lane
   * over; what is the pedal's own is that its side can never flip, there being only one.
   *
   * ⭐⭐ TWO KINDS OF VERTICAL: inside its own staff's room the `y` is plain INK; past halfway to the
   * neighbouring staff it is a JUMP (`./markSystemJump`), ⛔ decided at the halfway line and not at
   * the pentagram.
   */
  describe('the body drag', () => {
    /** The pair's shared height, in SCREEN staff-spaces (+down). */
    const y = () => pedalOffsetOverrideOf(engine.getScore(), pedalId)?.y ?? 0
    /** Which bar holds the pedal — the only way to say which SYSTEM it is on. */
    const pedalMeasure = () =>
      engine.getScore().measures.find(m => m.pedals?.some(p => p.id === pedalId))?.number
    /** The pedal's own drawn ink, which `markSystemJump` measures from. */
    const pedalInk = () => drawn.entries.find(e => e.type === 'pedal')!.bbox
    /** A second bar of music drawn on the NEXT system, so there is somewhere to jump to. */
    const twoSystemLane = () => {
      engine.addMeasure()
      drawn.systemTop = { 1: 40, 2: 240 }
      const next = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      next.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
    }
    /** A frame at `cursorX`, having moved (`dxPx`,`dyPx`) since the last accepted one. */
    const frame = (cursorX: number, dxPx: number, dyPx = 0) =>
      dragPedalBody(engine, pedalId, cursorX, dxPx, dyPx)

    it('carries the whole pedal sideways when the ink ARRIVES, span and all', () => {
      expect(frame(140, 30)!.moved).toBe(true)
      expect(span(), 'ink only so far').toEqual({ beat: 0, length: 2 })
      frame(210, 70)
      expect(span(), 'a slot along, the SAME length').toEqual({ beat: 1, length: 2 })
      expect(offset('start')).toBeCloseTo(0)
    })

    it('⭐ lifts the pair while the hand is in its own staff\'s room', () => {
      expect(frame(110, 0, -30)!.jumped, 'no jump — three spaces is its own room').toBe(false)
      expect(y(), 'screen-signed, ⛔ no outward conversion').toBeCloseTo(-3)
    })

    it('⭐⭐ JUMPS to the system below when the hand leaves that room — his ask', () => {
      twoSystemLane()
      const jump = frame(150, 0, 260)!
      expect(jump.jumped).toBe(true)
      expect(pedalMeasure(), 'it now lives on the next system').toBe(2)
    })

    it('⭐ …and it arrives where the ENGRAVER would put it — both offsets dropped', () => {
      twoSystemLane()
      frame(110, 0, -30)
      expect(y(), 'a lift first').toBeCloseTo(-3)
      frame(150, 0, 260)
      expect(y(), 'gone: over there it was never a lift').toBe(0)
      expect(offset('start')).toBe(0)
    })

    it('⛔ a jump ENDS THE FRAME, ⛔ not the gesture — the hand carries on down there', () => {
      twoSystemLane()
      expect(frame(150, 0, 260)!.jumped).toBe(true)
      // The very next frame moves the pedal on its NEW system, which is the whole point of not
      // ending the gesture (the square's wrap is the one that does).
      expect(frame(150, 0, -10)!.jumped, 'settled — this one is ordinary ink').toBe(false)
      expect(pedalMeasure(), 'and it stayed where it landed').toBe(2)
    })

    it('⛔ declines — null — when the pedal is not drawn', () => {
      render([100, 200, 300, 400], null)
      expect(frame(110, 30)).toBeNull()
    })

    it('⚠️ …and it never guesses a system with no picture — the ink is the evidence', () => {
      // No second system drawn: a huge downward frame is plain ink (bounded elsewhere), never a jump.
      pedalInk()
      expect(frame(150, 0, 400)!.jumped).toBe(false)
    })

    it('🚨⭐⭐ …and the OTHER FOOT of a grand staff is a landing, not only the next system', () => {
      // His ask, 2026-08-21, the fourth family in three days. ⭐ The rule never changed:
      // `markSystemJump` always chose between PAINTED STAVES, and the left hand was in the running
      // with no candidate on it — so the pedal sailed past it onto the system below.
      const lower = engine.addStaffBelow(0)
      const left = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 3, duration: 'q', measure: 1, beat: frac(i, 1), staff: 1 })!.id)
      // ONE system, two staves: 40…80 and 160…200. The pedal's ink is at 125, 45 below its own
      // staff, so its twin under the left hand is 245 and the switch falls at 185.
      drawn.secondStaffDrop = 120
      left.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 1, bbox: { x: 100 + i * 100, y: 170, width: 10, height: 10 },
      }))

      expect(frame(150, 0, 50)!.jumped, 'still its own room').toBe(false)
      expect(frame(150, 0, 70)!.jumped).toBe(true)
      // ⭐⭐ The LANDING NAMES A STAFF — and on this family that is more than placement: a pedal
      // governs the staff it is filed under, so moving it moves what it damps.
      expect(engine.getPedalById(pedalId)?.staffId, 'the left hand’s damper now').toBe(lower)
      expect(pedalMeasure(), 'the same system — it did not sail past').toBe(1)
      expect(span().length, 'the span is an amount of MUSIC and rides along').toBe(2)
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
