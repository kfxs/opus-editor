import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { dragOttavaBody, dragOttavaEndpoint, walkOttavaBody, walkOttavaEndpoint } from './ottavaWalk'
import { ottavaOffsetOverrideOf } from '../engine/models/engravingOverrides'
import type { Ottava } from '../types/music'
import { soundingShiftAt } from '../utils/soundingShift'
import { fracCreate as frac, fracToNumber } from '../utils/fraction'

/**
 * ←/→ on an ARMED SQUARE moves that end's INK, and carries that end of the BRACKET along once the
 * ink arrives at the next onset of the lane.
 *
 * Subject: {@link ottavaWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s, proven from four ends now (the dynamic's, the tempo's, the wedge's and the
 * trill's chapters exercise the same code). The `MusicEngine` is real, but the REGISTRY is
 * fabricated: the walk reads two drawn x's and a staff-space size off the last render, and jsdom
 * draws nothing (`reference_jsdom_cannot_measure_glyphs`). The noteheads are 100 px apart at 10 px
 * per staff-space, so a gap is exactly 10 staff-spaces and a 1-space press has to be taken ten times
 * to cross it.
 *
 * ⭐ What this chapter owns, over the other families': the two ends measure against DIFFERENT EDGES
 * of their onsets (numeral left, hook right — Gould's rule 2), and the END's anchor is the LAST
 * COVERED slot rather than the span's exclusive end, which reaches a whole note further.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as {
    type: string; id?: string; staff?: number; measure?: number
    bbox: { x: number; y: number; width: number; height: number }
  }[],
  lineSpacing: 10 as number | null,
  /** Per measure: the staff's top-line y — which system that bar was drawn on. */
  systemTop: {} as Record<number, number>,
  /** ⭐ The PAINTED staves. Two by default, one per system: the BAND limit measures the room a mark
   *  may be lifted into from the gap to its neighbours (`layout/systemBand`), and a score with a
   *  single staff falls back to a much tighter guess — real, but not the case under test here. */
  bands: [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }] as { top: number; bottom: number }[],
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
        lineYPositions: [drawn.systemTop[m] ?? 40, 50, 60, 70, 80],
        noteStartX: 90, noteEndX: 430,
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

describe('walkOttavaEndpoint', () => {
  let engine: MusicEngine
  let ids: string[]
  let bracketId: string

  const offset = (which: 'start' | 'end') =>
    ottavaOffsetOverrideOf(engine.getScore(), bracketId)?.[which === 'start' ? 'startX' : 'endX'] ?? 0
  /** Where the bracket begins and how much music it displaces. */
  const span = () => {
    const ottava = engine.getOttavaById(bracketId)!
    return { beat: fracToNumber(ottava.beat), length: fracToNumber(ottava.length) }
  }

  /** Four noteheads 100 px apart, and the drawn bracket (which is what carries a staff to measure).
   *  Pass `null` for a staff with no measured geometry. */
  const render = (xs = [100, 200, 300, 400], lineSpacing: number | null = 10) => {
    drawn.lineSpacing = lineSpacing
    drawn.systemTop = { 1: 40, 2: 40 } // ⭐ ONE system by default
    drawn.bands = [{ top: 40, bottom: 80 }, { top: 240, bottom: 280 }]
    drawn.entries = ids.map((id, i) => ({
      type: 'note', id, staff: 0, bbox: { x: xs[i], y: 50, width: 10, height: 10 },
    }))
    drawn.entries.push({
      type: 'ottava', id: bracketId, staff: 0, measure: 1,
      bbox: { x: 100, y: 20, width: 200, height: 10 },
    })
  }

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    // Beats 0 → 2: it covers the first TWO notes, so the hook closes around the second (x 200…210)
    // and there are stops on both sides of either end.
    bracketId = engine.addOttava(1, { shift: 1, beat: frac(0, 1), length: frac(2, 1) })!.id
    render()
  })

  describe('the beginning', () => {
    it('nudges the ink and leaves the bracket alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkOttavaEndpoint(engine, bracketId, 'start', 1)).toBe(true)
      expect(offset('start')).toBeCloseTo(9)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })

    it('⭐ re-anchors on the press that arrives, and takes the gap back out of the offset', () => {
      // The whole design in one assertion: the tenth press moves the drawn numeral by the same one
      // space as the other nine, but spends it on the BRACKET instead of the offset.
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      expect(span().beat).toBe(1)
      expect(offset('start')).toBeCloseTo(0)
    })

    it('⭐⭐ the crossing HOLDS THE FAR END STILL — the bracket shortens, it does not slide', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      const { beat, length } = span()
      expect(beat + length, 'the end is where it was').toBe(2)
      expect(length, 'and the extent gave up exactly the beat the beginning took').toBe(1)
    })

    it('⭐ keeps the OTHER end’s own nudge through the crossing', () => {
      engine.nudgeOttavaEndpoint(bracketId, 'end', 1.5, 0)
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      expect(span().beat, 'it did cross').toBe(1)
      expect(offset('end')).toBeCloseTo(1.5)
    })

    it('⭐⭐ walks THROUGH its own end — the beginning PUSHES it, and the right end re-anchors', () => {
      // His rule, 2026-08-21: *"when the left anchor push the right anchor then the right anchor
      // should reanchor"*. 🚨 It was a REFUSAL before, and a refusal stops the walk dead — his score
      // had the bracket parked on one note with `startX` 63 spaces off the page.
      for (let i = 0; i < 30; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      expect(span(), 'on the last note of the lane, one slot long').toEqual({ beat: 3, length: 1 })
      expect(offset('start'), 'the presses past the end of the road were ink').toBeCloseTo(0)
    })

    it('walks the other way too, and stops at the start of the score', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      expect(span().beat).toBe(1)
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', -1)
      expect(span(), 'back where it began, end held all the way').toEqual({ beat: 0, length: 2 })
      expect(offset('start')).toBeCloseTo(0)
      for (let i = 0; i < 5; i++) walkOttavaEndpoint(engine, bracketId, 'start', -1)
      expect(span().beat, 'never off the front').toBe(0)
      expect(offset('start'), 'those presses were ink — ⭐ which is FREE, see the header').toBeCloseTo(-5)
    })

    it('⭐ a crossing press is ONE undo entry — the re-anchor and the re-base go back together', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', 1)
      expect(span().beat).toBe(1)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('start')).toBeCloseTo(9)
    })
  })

  /**
   * ⭐⭐ THE HOOK — and its anchor is the LAST COVERED notehead, ⛔ not where `beat + length` lands.
   * This bracket covers beats 0 and 1, so its hook is drawn at the SECOND note's right edge (210)
   * and growing walks it to the third's (310) — ten presses of a space.
   */
  describe('the end', () => {
    it('nudges the ink and leaves the bracket alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkOttavaEndpoint(engine, bracketId, 'end', 1)).toBe(true)
      expect(offset('end')).toBeCloseTo(9)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })

    it('⭐ the tenth press GROWS the bracket by one slot, and the beginning never moves', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span(), 'one slot more, beginning held').toEqual({ beat: 0, length: 3 })
      expect(offset('end')).toBeCloseTo(0)
    })

    it('⭐ keeps the BEGINNING’s own nudge through the crossing', () => {
      engine.nudgeOttavaEndpoint(bracketId, 'start', -1.5, 0)
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span().length, 'it did cross').toBe(3)
      expect(offset('start')).toBeCloseTo(-1.5)
    })

    it('⭐ shrinks the other way, and ⛔ never as far as covering NO music', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', -1)
      expect(span(), 'the hook fell back onto the first note').toEqual({ beat: 0, length: 1 })
      for (let i = 0; i < 20; i++) walkOttavaEndpoint(engine, bracketId, 'end', -1)
      expect(span(), 'a shrink never deletes the line').toEqual({ beat: 0, length: 1 })
      expect(offset('end'), 'the presses that had nowhere to go were ink').toBeCloseTo(-20)
    })

    it('⭐ stops at the end of the lane, and the press stays a plain nudge', () => {
      for (let i = 0; i < 30; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span(), 'it reached the last note of the staff').toEqual({ beat: 0, length: 4 })
      expect(offset('end'), 'the last 10 presses were ink').toBeCloseTo(10)
    })

    it('⭐ a crossing press is ONE undo entry, on this end too', () => {
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span().length).toBe(3)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(9)
    })
  })

  /**
   * 🚨🚨 CROSSING A SYSTEM BREAK — his ask, 2026-08-21: *"what about the cross system issue?"*
   *
   * The rule and its four rejected cuts are the wedge's (`./markBreakWrap`); what this chapter pins
   * is the BRACKET's port into it. The fixture: bar 1 on the top line (music 90…430), bar 2 on the
   * next line (drawn 200 px down) with four quarters of its own, and the bracket covering all of
   * bar 1 so its hook stands on the last note of the line.
   */
  describe('a system break', () => {
    const twoSystems = () => {
      render()
      drawn.systemTop = { 1: 40, 2: 240 }
      const next = (['G', 'A', 'B', 'C'] as const).map((step, i) =>
        engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 2, beat: frac(i, 1) })!.id)
      next.forEach((id, i) => drawn.entries.push({
        type: 'note', id, staff: 0, bbox: { x: 100 + i * 100, y: 250, width: 10, height: 10 },
      }))
      // The bracket now covers the whole of bar 1: its hook is on the fourth note (right edge 410),
      // two spaces short of where the line's music ends.
      engine.resizeOttavaBySlot(bracketId, 1)
      engine.resizeOttavaBySlot(bracketId, 1)
      expect(span()).toEqual({ beat: 0, length: 4 })
    }

    beforeEach(() => {
      engine.addMeasure()
      twoSystems()
    })

    it('⭐ the presses BEFORE the edge are ordinary ink', () => {
      for (let i = 0; i < 2; i++) expect(walkOttavaEndpoint(engine, bracketId, 'end', 1)).toBe(true)
      expect(span(), 'nothing has moved yet').toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(2)
    })

    it('⭐⭐ the press that passes the line\'s end WRAPS onto the next system', () => {
      for (let i = 0; i < 3; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      // The hook now closes around bar 2's first note — a whole bar of bracket in the MODEL…
      expect(span(), 'it covers bar 2\'s first quarter').toEqual({ beat: 0, length: 5 })
      // …and the DRAWING shows a stub: the one space of ink that would have hung in the right
      // margin re-appears just inside the new line, which is the whole of his rule.
      expect(offset('end')).toBeCloseTo(-1)
    })

    it('⭐ a crossing press is ONE undo entry here too', () => {
      for (let i = 0; i < 3; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span().length).toBe(5)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(2)
    })

    it('⭐⭐ …and it is symmetric: the BEGINNING wraps back onto the line above', () => {
      // Move the bracket's beginning onto bar 2, then walk it left off the front of that line.
      engine.moveOttavaStartToSlot(bracketId, { measure: 2, beat: frac(1, 1) })
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'start', -1)
      expect(engine.getOttavaById(bracketId)!.beat, 'back onto bar 2\'s first note').toEqual(frac(0, 1))
    })

    it('⭐⭐ a DRAG wraps when the HAND passes the barline, ⛔ not when the ink does', () => {
      // His rule for the wedge: a drag has the pointer itself, which is both simpler and truer than
      // the ink — the ink only gets there if every frame on the way was accepted.
      const frame = dragOttavaEndpoint(engine, bracketId, 'end', 440, 10)!
      expect(frame.wrapped, "the cursor is past this line's last ink (430)").toBe(true)
      expect(span(), "the hook took bar 2's first note").toEqual({ beat: 0, length: 5 })
      // ⭐ And it lands a STUB inside the new line — ⛔ not the folded distance the KEYS re-base by.
      expect(offset('end')).toBeCloseTo(0)
    })

    it('⭐ …and a frame short of the barline is ordinary ink', () => {
      const frame = dragOttavaEndpoint(engine, bracketId, 'end', 420, 10)!
      expect(frame.wrapped).toBe(false)
      expect(span()).toEqual({ beat: 0, length: 4 })
    })

    it('⭐ the BODY crosses a break too — the whole bracket, by its beginning', () => {
      // Its stops are the START's, so the walk is over once the beginning reaches the last note of
      // this line; the press after that is the wrap.
      for (let i = 0; i < 30; i++) walkOttavaBody(engine, bracketId, 1)
      expect(engine.getOttavaById(bracketId)!.beat, 'the last onset of bar 1').toEqual(frac(3, 1))
      for (let i = 0; i < 4; i++) walkOttavaBody(engine, bracketId, 1)
      expect(engine.getScore().measures.find(m => m.number === 2)?.ottavas?.length,
        'and it now lives on the next system').toBe(1)
    })

    it('⛔ never onto a bar the last render drew nothing for', () => {
      drawn.entries = drawn.entries.filter(e => e.bbox.y < 200)
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span(), 'ink only — no picture, no wrap').toEqual({ beat: 0, length: 4 })
      expect(offset('end')).toBeCloseTo(10)
    })
  })

  /**
   * ⭐⭐ THE DRAG — the same journey with the cursor's delta in pixels (his ask, 2026-08-21: *"now
   * lets do the drag walking"*). It used to SNAP the grabbed end to the nearest onset; what this
   * chapter owns is that a drag and N presses over the same distance land in ONE state, plus the two
   * things only the mouse has: the LATCH at offset zero and the repayment it owes.
   *
   * 10 px per staff-space, and the onsets are 100 px apart — so one gap is one 100 px frame.
   */
  describe('the drag', () => {
    /** A frame at `cursorX`, having moved `dxPx` since the last accepted one. */
    const frame = (which: 'start' | 'end', cursorX: number, dxPx: number, dyPx = 0) =>
      dragOttavaEndpoint(engine, bracketId, which, cursorX, dxPx, dyPx)

    it('moves INK while the hand is between two onsets — ⛔ the bracket does not jump', () => {
      expect(frame('end', 240, 30)!.moved).toBe(true)
      expect(span(), 'the model is untouched').toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(3)
    })

    it('⭐ carries the bracket when the ink ARRIVES, exactly as the arrows do', () => {
      frame('end', 310, 100)
      expect(span(), 'the hook took the next note').toEqual({ beat: 0, length: 3 })
      expect(offset('end'), 'and the ink did not jump — the identity').toBeCloseTo(0)
    })

    it('⭐⭐ …and a drag lands where the PRESSES do, which is the point of one journey', () => {
      // ⚠️ The presses go first and the model is wound back by hand: a drag FRAME records no undo
      // entry (that is its whole difference), so `undo()` here would take back the bracket itself.
      for (let i = 0; i < 10; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      const pressed = { ...span(), ink: offset('end') }
      engine.resizeOttavaBySlot(bracketId, -1)
      expect(span(), 'wound back').toEqual({ beat: 0, length: 2 })

      frame('end', 310, 100)
      expect({ ...span(), ink: offset('end') }).toEqual(pressed)
    })

    it('⭐⭐ THE LATCH: the ink stops dead at offset zero, and REPORTS what it dropped', () => {
      // Two frames: the first parks the ink 3 spaces short of the next onset, the second would fly
      // 5 past it. The latch cuts the move at the onset — where the engraver puts the hook — and the
      // 2 spaces it swallowed come back as `droppedPx` for the caller to repay.
      frame('end', 240, 70)
      const latched = frame('end', 290, 50)!
      expect(span(), 'it crossed').toEqual({ beat: 0, length: 3 })
      expect(offset('end'), 'and stopped exactly on the note').toBeCloseTo(0)
      expect(latched.droppedPx, '⭐ in PIXELS, the caller\'s own unit').toBeCloseTo(20)
    })

    it('⛔ writes no undo entry of its own — the drop commits the gesture ONCE', () => {
      frame('end', 310, 100)
      frame('end', 410, 100)
      expect(span()).toEqual({ beat: 0, length: 4 })
      engine.commitOttavaDrag('end')
      engine.undo()
      expect(span(), 'one undo takes the whole drag back').toEqual({ beat: 0, length: 2 })
    })

    /**
     * ⭐⭐ THE VERTICAL (his ask, 2026-08-21: *"now for the drag we have to make the y offset"*).
     *
     * Two claims, and the second is the bracket's own: the drag carries BOTH axes in one gesture,
     * and the `y` lands on the WHOLE line — ⛔ never on the square under the hand — because
     * `OttavaOffsetOverride` has a single vertical. ⚠️ And it is stored OUTWARD from the staff, so an
     * 8vb's number goes UP as the hand goes DOWN.
     */
    describe('the vertical', () => {
      /** The bracket's one stored height, in staff-spaces OUTWARD from the staff. */
      const outward = () => ottavaOffsetOverrideOf(engine.getScore(), bracketId)?.outward ?? 0
      /** Flip the fixture to an 8vb, which hangs BELOW the staff. */
      const below = () => { (engine.getOttavaById(bracketId) as Ottava).shift = -1 }

      it('⭐ lifts an 8va when the hand goes UP — screen becomes OUTWARD here and nowhere else', () => {
        expect(frame('end', 210, 0, -25)!.moved).toBe(true)
        expect(outward(), '2.5 spaces further from the staff').toBeCloseTo(2.5)
      })

      it('⭐⭐ …and an 8vb goes further out as the hand goes DOWN — the same stored number', () => {
        below()
        frame('end', 210, 0, 25)
        expect(outward()).toBeCloseTo(2.5)
      })

      it('⭐⭐ the START square writes the SAME field — the bracket cannot tilt', () => {
        frame('start', 110, 0, -25)
        expect(outward()).toBeCloseTo(2.5)
        // ⛔ Not a per-end pair: one number, and the second square adds to it.
        frame('end', 210, 0, -15)
        expect(outward()).toBeCloseTo(4)
      })

      it('⭐ rides along with a horizontal that CROSSES, and survives it', () => {
        frame('end', 310, 100, -10)
        expect(span(), 'the hook took the next note').toEqual({ beat: 0, length: 3 })
        expect(outward(), 'and the height came with it').toBeCloseTo(1)
      })

      /** The drawn bracket's own box — ⚠️ the registry is a FIXTURE, so it does not move when the
       *  model is written; a case that wants the ink somewhere else says so. */
      const bracketInk = () => drawn.entries.find(e => e.type === 'ottava')!.bbox

      it('🚨 STOPS where the bracket would enter the SYSTEM ABOVE\'s room — his rule', () => {
        // *"we should not go crazy, we have to limit the user somehow here in the y so the ottava is
        // on the system it belongs to"* (2026-08-21) — the same sentence that produced the band rule
        // for the slur and then the wedge, arriving a third time. ⭐ The limit falls HALFWAY to the
        // neighbouring staff, ⛔ not at its lines (`layout/systemBand`).
        expect(frame('end', 210, 0, -60)!.moved, 'six spaces up, still its own room').toBe(true)
        expect(outward()).toBeCloseTo(6)
        expect(frame('end', 210, 0, -700)!.moved, '⛔ but not into the system above').toBe(false)
        expect(outward(), 'and nothing was written — ⛔ the value never accumulates past the edge')
          .toBeCloseTo(6)
      })

      it('⭐ …and it is never STRANDED: the way home is always allowed', () => {
        // Ink already outside its band — a re-flow moved the system under it, or an older file was
        // saved that way. ⛔ Refusing both directions there would strand the bracket for good.
        bracketInk().y = -200
        expect(frame('end', 210, 0, -10)!.moved, '⛔ no further out').toBe(false)
        expect(frame('end', 210, 0, 10)!.moved, '⭐ but always back').toBe(true)
      })

      it('⛔ a purely vertical frame moves nothing horizontal', () => {
        frame('end', 210, 0, -25)
        expect(span()).toEqual({ beat: 0, length: 2 })
        expect(offset('end')).toBe(0)
      })
    })

    it('⛔ declines — null — when the bracket is not drawn, so there is no scale', () => {
      render([100, 200, 300, 400], null)
      expect(frame('end', 310, 100)).toBeNull()
    })
  })

  /**
   * ⭐⭐ THE BODY — the arrows with the bracket selected and NO square armed (his ask, 2026-08-21:
   * *"now we have to do the shape key walking (when no endpoint is selected)"*).
   *
   * ⭐ What this chapter owns over the two squares': the far end is **NOT held**. A square reshapes
   * the bracket; the body MOVES it, length and all — which is the whole difference between the two
   * gestures, and it is audible at the crossing either way.
   */
  describe('the body', () => {
    /** The offset both ends carry while the bracket is moved as one. */
    const ink = () => offset('start')

    /**
     * ⭐⭐ THE BODY'S DRAG (his ask, 2026-08-21: *"now we have to do the shape drag walking… we also
     * have to take into account the y, that means that we can jump system vertically"*).
     *
     * ⭐ Two kinds of vertical, and that is the design: within its own staff's room the `y` is plain
     * INK; past halfway to the neighbouring staff it is a JUMP (`./markSystemJump`), because two
     * systems' x's are not one ruler and there is nothing continuous to travel through.
     */
    describe('dragged', () => {
      /** The bracket's one stored height, OUTWARD from the staff. */
      const outward = () => ottavaOffsetOverrideOf(engine.getScore(), bracketId)?.outward ?? 0
      /** Which bar holds the bracket — the only way to say which SYSTEM it is on. */
      const ottavaMeasure = () =>
        engine.getScore().measures.find(m => m.ottavas?.some(o => o.id === bracketId))?.number
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
        dragOttavaBody(engine, bracketId, cursorX, dxPx, dyPx)

      it('carries the whole bracket sideways when the ink ARRIVES, length and all', () => {
        expect(frame(240, 30)!.moved).toBe(true)
        expect(span(), 'ink only so far').toEqual({ beat: 0, length: 2 })
        frame(310, 70)
        expect(span(), 'a slot along, the SAME length').toEqual({ beat: 1, length: 2 })
        expect(ink()).toBeCloseTo(0)
      })

      it('⭐ lifts the bracket while the hand is in its own staff\'s room', () => {
        expect(frame(210, 0, -30)!.jumped, 'no jump — three spaces is its own room').toBe(false)
        expect(outward()).toBeCloseTo(3)
      })

      it('⭐⭐ JUMPS to the system below when the hand leaves that room — his ask', () => {
        // The fixture's systems are 160 px apart, so the switch falls 80 px down; the bracket's own
        // ink is at y 25 and bar 2's notes are drawn on the lower staff.
        twoSystemLane()
        const jump = frame(150, 0, 260)!
        expect(jump.jumped).toBe(true)
        expect(ottavaMeasure(), 'it now lives on the next system').toBe(2)
      })

      it('⭐ …and it arrives where the ENGRAVER would put it — both offsets dropped', () => {
        twoSystemLane()
        frame(210, 0, -30)
        expect(outward(), 'a lift first').toBeCloseTo(3)
        frame(150, 0, 260)
        expect(outward(), 'gone: over there it was never a lift').toBe(0)
        expect(ink()).toBe(0)
      })

      it('⛔ NEVER flips the side — that would be a change to the MUSIC', () => {
        // An 8va hangs above its staff and an 8vb below, and the side is DERIVED from `shift`. The
        // wedge flips because it has a `placement`; turning an 8va into an 8vb is `toggleOttavaDirection`.
        twoSystemLane()
        frame(150, 0, 260)
        expect(engine.getOttavaById(bracketId)!.shift, 'still an 8va').toBe(1)
      })

      it('⛔ declines — null — when the bracket is not drawn', () => {
        render([100, 200, 300, 400], null)
        expect(frame(210, 30)).toBeNull()
      })
    })

    it('nudges the ink and leaves the bracket alone until the ink arrives', () => {
      for (let i = 0; i < 9; i++) expect(walkOttavaBody(engine, bracketId, 1)).toBe(true)
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(ink()).toBeCloseTo(9)
      expect(offset('end'), 'both ends, the same number').toBeCloseTo(9)
    })

    it('⭐⭐ the tenth press MOVES the whole bracket — ⛔ the far end is not held', () => {
      for (let i = 0; i < 10; i++) walkOttavaBody(engine, bracketId, 1)
      expect(span(), 'a slot along, the SAME length').toEqual({ beat: 1, length: 2 })
      expect(ink(), 'and the ink did not jump — the identity').toBeCloseTo(0)
    })

    it('⭐ it is AUDIBLE at the crossing, and only there', () => {
      for (let i = 0; i < 9; i++) walkOttavaBody(engine, bracketId, 1)
      expect(soundingShiftAt(engine.getScore(), 1, frac(2, 1)), 'still the first two notes').toBe(0)
      walkOttavaBody(engine, bracketId, 1)
      expect(soundingShiftAt(engine.getScore(), 1, frac(2, 1)), 'now the third is displaced').toBe(12)
      expect(soundingShiftAt(engine.getScore(), 1, frac(0, 1)), 'and the first is not').toBe(0)
    })

    it('⭐ a crossing press is ONE undo entry', () => {
      for (let i = 0; i < 10; i++) walkOttavaBody(engine, bracketId, 1)
      expect(span().beat).toBe(1)
      engine.undo()
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(ink()).toBeCloseTo(9)
    })

    it('walks back too, and stops at the start of the score — the ink carries on', () => {
      for (let i = 0; i < 10; i++) walkOttavaBody(engine, bracketId, 1)
      for (let i = 0; i < 10; i++) walkOttavaBody(engine, bracketId, -1)
      expect(span(), 'back where it began').toEqual({ beat: 0, length: 2 })
      for (let i = 0; i < 5; i++) walkOttavaBody(engine, bracketId, -1)
      expect(span().beat, 'never off the front').toBe(0)
      expect(ink(), '⭐ and the ink is FREE past it').toBeCloseTo(-5)
    })

    it('⛔ never guesses the staff-space size — no measured staff means no crossing', () => {
      render([100, 200, 300, 400], null)
      for (let i = 0; i < 15; i++) walkOttavaBody(engine, bracketId, 1)
      expect(span()).toEqual({ beat: 0, length: 2 })
    })
  })

  describe('what it refuses', () => {
    it('⛔ the vertical stays pure ink — ↑/↓ never walk', () => {
      for (let i = 0; i < 40; i++) expect(walkOttavaEndpoint(engine, bracketId, 'end', 0)).toBe(false)
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBe(0)
    })

    it('🚨 refuses to cross when the next onset is not in this system — two x’s, two rulers', () => {
      // The third note is drawn far to the LEFT (a new line), so the gap's sign disagrees with the
      // direction of travel and `markWalk` declines rather than subtracting two rulers.
      render([100, 200, 20, 120])
      for (let i = 0; i < 30; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span(), 'the bracket did not move').toEqual({ beat: 0, length: 2 })
      expect(offset('end'), 'ink, every one of them').toBeCloseTo(30)
    })

    it('⛔ never guesses the staff-space size — no measured staff means no crossing', () => {
      render([100, 200, 300, 400], null)
      for (let i = 0; i < 15; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(15)
    })

    it('⛔ …and never crosses a slot the last render drew nothing for', () => {
      // The third note was not drawn, so there is no x to price the step at.
      render([100, 200, 300, 400])
      drawn.entries = drawn.entries.filter(e => e.id !== ids[2])
      for (let i = 0; i < 15; i++) walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span()).toEqual({ beat: 0, length: 2 })
      expect(offset('end')).toBeCloseTo(15)
    })

    it('⭐⭐ …and it never limits the INK to the music — his rule, the offset is FREE', () => {
      // 2026-08-21, rejecting a limit that stopped the ink at the system's own first note: *"you are
      // restricted the ottava offset to the measure, the user should be able to offset it at will"*.
      // ⛔ The only stop is the PAGE's edge, and that is the engine's (`layout/pageBounds`).
      for (let i = 0; i < 40; i++) walkOttavaEndpoint(engine, bracketId, 'start', -1)
      expect(offset('start'), 'forty spaces off the front of the music').toBeCloseTo(-40)
    })

    it('⚠️ crosses at most ONE slot per press, however far ahead the ink has been pushed', () => {
      // The trill's report, 2026-08-20: an end nudged far past its own note is already beyond every
      // stop between, and an unbounded loop would hop them all in one keystroke — invisibly.
      engine.nudgeOttavaEndpoint(bracketId, 'end', 40, 0)
      walkOttavaEndpoint(engine, bracketId, 'end', 1)
      expect(span().length, 'exactly one slot').toBe(3)
    })
  })
})
