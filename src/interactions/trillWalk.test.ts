import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { dragTrillBody, dragTrillEndpoint, walkArmedTrillEndpoint, walkTrillBody } from './trillWalk'
import { trillOffsetOverrideOf } from '../engine/models/engravingOverrides'
import { fracCreate as frac } from '../utils/fraction'

/**
 * ←/→ on an ARMED TRILL SQUARE moves that end's INK, and carries that end of the ORNAMENT along once
 * the ink arrives at the next note of the lane.
 *
 * Subject: {@link trillWalk} — the PORT beside this file; the arithmetic it hands to is
 * `./markWalk`'s, proven from three ends already (the dynamic, the tempo mark, the wedge). The
 * `MusicEngine` is real, but the REGISTRY is fabricated: the walk reads drawn x's and a staff-space
 * size off the last render, and jsdom draws nothing (`reference_jsdom_cannot_measure_glyphs`). The
 * noteheads' CENTRES sit 100 px apart at 10 px per staff-space, so a gap is exactly 10 staff-spaces
 * and a 1-space press has to be taken ten times to cross it.
 *
 * ⭐ What this chapter owns, over the other three marks':
 *  - the two ends measure against DIFFERENT x's — the sign on its note, the line on the note AFTER
 *    the trill — so the END's gaps are its successors' (`./trillLane`);
 *  - a step that CLEARS the end is priced where the ink lands, which on a TIED start is not the note
 *    the step names;
 *  - the bare `tr` is out of the walk's reach.
 */
const drawn = vi.hoisted(() => ({
  entries: [] as {
    type: string; id?: string; staff?: number; measure?: number
    headX?: number
    bbox: { x: number; y: number; width: number; height: number }
  }[],
  lineSpacing: 10 as number | null,
  /** Per measure: the staff's top line (which SYSTEM it is on) and where its music runs. */
  systems: {} as Record<number, { top: number; min: number; max: number }>,
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: (m: number) => {
        const system = drawn.systems[m]
        if (drawn.lineSpacing === null || !system) return undefined
        return {
          lineSpacing: drawn.lineSpacing,
          lineYPositions: [system.top, system.top + 10, system.top + 20, system.top + 30, system.top + 40],
          noteStartX: system.min, noteEndX: system.max,
        }
      },
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

describe('walkArmedTrillEndpoint', () => {
  let engine: MusicEngine
  let state: EditorState
  let ids: string[]
  let trillId: string

  const trill = () => engine.getTrillById(trillId)!
  const idx = (noteId: string | undefined) => (noteId === undefined ? null : ids.indexOf(noteId))
  const offset = (which: 'start' | 'end') =>
    trillOffsetOverrideOf(engine.getScore(), trillId)?.[which === 'start' ? 'startX' : 'endX'] ?? 0

  const arm = (endpoint: 'start' | 'end') => {
    state.selectedElement = { kind: 'trill', id: trillId, endpoint }
  }
  /** One press, in staff-spaces — `Ctrl`+arrow's whole space, so ten of them cross one gap. */
  const press = (dx: number) => walkArmedTrillEndpoint(state, engine, dx)
  const presses = (n: number, dx: number) => { for (let i = 0; i < n; i++) press(dx) }

  /**
   * Four noteheads 100 px apart, the second bar's whole rest **300 px** further on, and the drawn
   * ornament (which is what carries a staff to measure).
   *
   * ⭐⭐ **THE REST IS DELIBERATELY FAR OFF.** The wavy line stops at the next SLOT whatever it is,
   * so the last note's successor — and therefore where the END square is drawn — is that rest. With
   * the lane evenly spaced, a successor gap and a note-to-note gap are the same number BY LUCK and
   * every assertion below would pass with `trillLane`'s successor rule deleted. Here they are 10 and
   * 30 staff-spaces, and they cannot be confused.
   */
  const render = (lineSpacing: number | null = 10) => {
    drawn.lineSpacing = lineSpacing
    // ⭐ ONE system by default — bar 1's music runs 90…430, bar 2's 90…830.
    drawn.systems = { 1: { top: 40, min: 90, max: 430 }, 2: { top: 40, min: 90, max: 830 } }
    drawn.entries = ids.map((id, i) => ({
      type: 'note', id, staff: 0, measure: 1, headX: 100 + i * 100,
      bbox: { x: 95 + i * 100, y: 50, width: 10, height: 10 },
    }))
    drawn.entries.push({
      type: 'rest', id: secondBarRestId(), staff: 0, measure: 2, headX: 700,
      bbox: { x: 695, y: 50, width: 10, height: 10 },
    })
    drawn.entries.push({
      type: 'trill', id: trillId, staff: 0, measure: 1,
      bbox: { x: 200, y: 20, width: 200, height: 10 },
    })
  }

  /** The id the second bar's whole rest is drawn under. */
  const secondBarRestId = () => engine.getScore().measures.find(m => m.number === 2)!.slots[0].id

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    engine.addMeasure()
    engine.addMeasure()
    ids = (['C', 'D', 'E', 'F'] as const).map((step, i) =>
      engine.addNoteAtBeat({ step, octave: 4, duration: 'q', measure: 1, beat: frac(i, 1) })!.id)
    trillId = engine.createTrill([ids[1], ids[2]])!.id // D4 → E4, room to walk either way
    state = createEditorState()
    render()
  })

  it('DECLINES with no square armed — the chord must fall through to its other tenants', () => {
    expect(press(-1)).toBe(false)
    state.selectedElement = { kind: 'trill', id: trillId } // the trill itself, no square armed
    expect(press(-1)).toBe(false)
  })

  it('⭐ nine presses are INK, and the anchor has not moved', () => {
    arm('start')
    presses(9, -1)
    expect(offset('start')).toBeCloseTo(-9)
    expect(idx(trill().startNoteId), 'still on D4').toBe(1)
  })

  it('⭐⭐ the TENTH press hands the START onto the previous note, and the ink does not jump', () => {
    arm('start')
    presses(10, -1)
    expect(idx(trill().startNoteId), 'D4 → C4').toBe(0)
    // The identity: the anchor absorbed the whole 10-space gap, so the offset gives it back.
    expect(offset('start'), 'offset re-zeroed at the note it arrived on').toBeCloseTo(0)
    expect(idx(trill().endNoteId), 'the far end held').toBe(2)
  })

  it('⭐⭐ THE END MEASURES AGAINST ITS SUCCESSOR — E4\'s line is at F4, F4\'s at the BARLINE', () => {
    // 🚨 The break-test for `trillLane`'s whole reason to exist, and it cuts both ways here:
    //  - the end on E4 draws its line at F4 (400);
    //  - the end on F4 — the bar's LAST slot — draws it at the bar's own end (430), ⛔ not at the
    //    next bar's rest.
    // So the gap is THREE spaces where the two noteheads are ten apart. Measured note-to-note the
    // press would cross at ten and the drawn end would jump 70 px backwards.
    arm('end')
    presses(2, 1)
    expect(idx(trill().endNoteId), 'two presses of ink').toBe(2)
    expect(press(1), 'the third reaches the barline and hands it on').toBe(true)
    expect(idx(trill().endNoteId), 'E4 → F4').toBe(3)
    expect(offset('end')).toBeCloseTo(0)
  })

  it('⭐⭐ walking the END back onto the START CLEARS it — the one-note trill, invisibly', () => {
    arm('end')
    presses(10, -1)
    expect(trill().endNoteId, 'absent, ⛔ not equal to the start').toBeUndefined()
    expect(offset('end'), 'and the ink stayed where the hand left it').toBeCloseTo(0)
  })

  it('⭐⭐ …but with a TIE there is nowhere to arrive, so the collapse stays the JUMP\'s', () => {
    // 🚨 THE PRICING BREAK-TEST. Tie D4 into E4: clearing the end then leaves a one-note trill whose
    // line still stops at E4's successor — exactly where the end is drawn right now. The step is
    // priced WHERE THE INK LANDS, so the gap is zero and no press can arrive at it; priced at the
    // note the step names (D4) it would read as 10 spaces and the ink would jump the whole tie.
    // `Ctrl+Shift+←` (`./trillReanchor`) still collapses it — a walk is not the only route.
    engine.toggleTie(ids[1])
    arm('end')
    presses(15, -1)
    expect(trill().endNoteId, 'still explicit — nothing was crossed').toBe(ids[2])
    expect(offset('end'), 'every press was ink').toBeCloseTo(-15)
  })

  it('⛔ the BARE `tr` does not walk — its end square has no line to carry', () => {
    engine.setTrillAnchor(trillId, 'end', null)
    engine.setTrillExtension(trillId, 'none')
    arm('end')
    presses(20, 1)
    expect(trill().extension, 'still a bare sign').toBe('none')
    expect(trill().endNoteId, 'and no end grew out of the walk').toBeUndefined()
    expect(offset('end'), 'the press stayed the plain ink nudge it has always been').toBeCloseTo(20)
  })

  it('⛔ it stops where the model refuses — the start may not pass the end', () => {
    arm('start')
    presses(10, 1)
    expect(idx(trill().startNoteId), 'D4 → E4, collapsing onto the end').toBe(2)
    expect(trill().endNoteId).toBeUndefined()
    // …and off the end of the lane there is nothing to arrive at, so the ink simply keeps going.
    arm('start')
    presses(20, 1)
    expect(idx(trill().startNoteId), 'the last note of the lane holds').toBe(3)
    expect(offset('start'), 'ten presses crossed onto F4, ten more were ink').toBeCloseTo(10)
  })

  it('⛔ REFUSES TO GUESS a staff-space size — with no measured staff the press is plain ink', () => {
    // `./markWalk`'s no-fallback rule: a guessed scale would re-base by the wrong distance, quietly,
    // and only on a staff that is not the default size.
    render(null)
    arm('start')
    presses(20, -1)
    expect(idx(trill().startNoteId), 'nothing crossed').toBe(1)
    expect(offset('start')).toBeCloseTo(-20)
  })

  /**
   * 🚨🚨 **A SYSTEM BREAK after bar 1**, with a whole note over there to walk onto. His ask,
   * 2026-08-20: *"we should be able to handle cross system similar to hairpin"*.
   *
   * ⭐ The end starts on bar 1's LAST note, where its line is drawn at that bar's own end — which is
   * the system's end too, so the ink has nowhere left to go and the next press must either wrap or
   * do nothing at all.
   */
  const wrapFixture = () => {
    // A whole NOTE in bar 2 — a rest is not a stop, and with none the walk has nowhere to go.
    const there = engine.addNoteAtBeat({ step: 'G', octave: 4, duration: 'w', measure: 2, beat: frac(0, 1) })!
    engine.setTrillAnchor(trillId, 'end', ids[3])   // the end on bar 1's LAST note
    render()
    drawn.systems[2] = { top: 140, min: 90, max: 830 }
    drawn.entries.push({
      type: 'note', id: there.id, staff: 0, measure: 2, headX: 150,
      bbox: { x: 145, y: 150, width: 10, height: 10 },
    })
  }

  it('🚨🚨 THE INK CROSSES ONTO THE NEXT SYSTEM — one RIBBON, so a break is not an event', () => {
    // ⭐⭐ His rule, 2026-08-20: *"no anchor to a note but offset in the next system"*. The drawing
    // FOLDS ink past a line's end onto the next line, so the ink travels ONE continuous distance and
    // the walk measures it on that ribbon (`trillLane.trillRibbonX`). Here bar 1's music runs 90…430
    // and bar 2's, a line down, 90…830 — so the end sitting at bar 1's barline (ribbon 340) is 74
    // spaces from where its line would stop if it covered bar 2's note (ribbon 1080).
    //
    // 🚨 It replaces a per-line "wrap" that could only count ONE line hop: his report, on a trill
    // offset across three systems — *"it never was re-anchored to the note 3 systems below"*.
    wrapFixture()
    arm('end')
    presses(73, 1)
    expect(engine.getNote(trill().endNoteId!)?.measure, 'still bar 1 — the ink is folded, not the anchor').toBe(1)
    expect(offset('end'), 'seventy-three spaces of pure ink').toBeCloseTo(73)

    expect(press(1), 'the seventy-fourth arrives at the note over there').toBe(true)
    expect(engine.getNote(trill().endNoteId!)?.measure, 'the trill now covers bar 2').toBe(2)
    expect(offset('end'), 'and the ink did not jump — the anchor absorbed the whole ribbon gap')
      .toBeCloseTo(0)
  })

  it('⭐ …and one big press crosses in one go, keeping what is left over', () => {
    wrapFixture()
    arm('end')
    expect(press(80)).toBe(true)
    expect(engine.getNote(trill().endNoteId!)?.measure).toBe(2)
    expect(offset('end'), 'six spaces past the note it landed on').toBeCloseTo(6)
  })

  it('🚨 ON THE LAST LINE the ink is REFUSED at its end — ⛔ it does not run off the page', () => {
    // His report, 2026-08-20: *"now it goes off the page but doesn't land in the next system"* — on a
    // score whose music simply stops. A trill's stops are NOTES, so a lane continuing in whole rests
    // offers nothing to walk onto; without a limit every press pushed the wiggle further into the
    // margin. ⭐ …and it may always come BACK, which is what makes this a refusal and not a clamp.
    // ⚠️ ONE system, and the end parked on its last note — so the line already reaches that system's
    // end and there is no further line for the renderer to FOLD the ink onto.
    drawn.systems = { 1: { top: 40, min: 90, max: 430 } }
    engine.setTrillAnchor(trillId, 'end', ids[3])
    arm('end')
    expect(press(1), 'nothing to extend onto').toBe(false)
    expect(offset('end'), 'and nothing written').toBeCloseTo(0)
    expect(press(-1), '⭐ but back into the system is always allowed').toBe(true)
  })

  it('⭐⭐ EVERY PRESS MOVES THE INK, and takes the anchor ONE note at a time — his rule', () => {
    // *"the re-anchor is completely broken"* / *"with the keyboard the walking must work properly"*
    // (2026-08-20). An ink nudged far ahead of its note is already PAST every stop between the two,
    // and `carryMark`'s loop crossed them ALL in one keystroke — the anchor left its bar for one
    // eight bars later, hopping another trill's notehead on the way. ⭐ Nothing moved on screen (the
    // identity working), which is exactly what made it unreadable.
    //
    // ⭐⭐ THE RULE: a press crosses AT MOST ONE stop, and the ink still travels its own step. The
    // anchor walks back up to the ink a note per press, visibly.
    engine.nudgeTrillEndpoint(trillId, 'start', 25, 0)   // the sign is 25 spaces ahead of its note
    arm('start')
    expect(press(0.25)).toBe(true)
    expect(idx(trill().startNoteId), 'ONE note along, ⛔ not all the way to F4').toBe(2)
    // 10 spaces of gap absorbed by the anchor, plus this press's own quarter — so the drawn sign
    // moved exactly the quarter space that was asked for.
    expect(offset('start')).toBeCloseTo(25 - 10 + 0.25)

    expect(press(0.25), 'and the next press takes the next note').toBe(true)
    expect(idx(trill().startNoteId)).toBe(3)
  })

  it('⭐ a crossing press is ONE undo entry — both halves or neither', () => {
    arm('start')
    presses(10, -1)
    expect(idx(trill().startNoteId)).toBe(0)
    engine.undo()
    expect(idx(trill().startNoteId), 'back on D4').toBe(1)
    expect(offset('start'), 'with the nine-space nudge intact').toBeCloseTo(-9)
  })

  /**
   * ⭐⭐ **THE DRAG IS THE SAME GESTURE WITH A CURSOR IN IT** — his ask, 2026-08-20: *"now the
   * walking with the mouse drag… behaviour similar to hairpins, just using the proper re-anchor for
   * the trill"*.
   *
   * ⭐ It used to SNAP (`trillDragTargetAt`, deleted with this): the nearest note within 150 px,
   * re-anchored outright every frame. The claim now is the family's: **a drag and N presses covering
   * the same distance leave the model in the SAME state**, rather than in two that merely look alike.
   */
  describe('dragTrillEndpoint', () => {
    /** One frame of `dxPx`, repaying whatever the latch dropped — the caller's own rule. */
    const drag = (id: string, which: 'start' | 'end', dxPx: number) =>
      dragTrillEndpoint(engine, id, which, 0, dxPx)

    it('⭐⭐ a drag and the arrows land in the SAME state over the same distance', () => {
      // Ten spaces of ink is 100 px at this fixture's scale, and the start's gap to C4 is exactly
      // that — so both routes must cross once and re-zero the offset.
      arm('start')
      presses(10, -1)
      const byKeys = { anchor: idx(trill().startNoteId), offset: offset('start') }

      engine.undo() // back to where the trill began
      expect(idx(trill().startNoteId), 'the fixture really did reset').toBe(1)
      drag(trillId, 'start', -100)
      expect(idx(trill().startNoteId), 'the drag crossed too').toBe(byKeys.anchor)
      expect(offset('start')).toBeCloseTo(byKeys.offset)
    })

    it('⭐⭐ THE LATCH stops the ink dead on a note, and REPORTS what it dropped', () => {
      // 🚨 Those pixels were made by the hand: a caller that swallows them leaves the ink behind the
      // cursor a little at every stop, for ever (Baudisch's own complaint about snap-and-go).
      arm('start')
      drag(trillId, 'start', -50)                       // five spaces in, ink only
      expect(offset('start')).toBeCloseTo(-5)
      const frame = drag(trillId, 'start', -80)!        // …would carry it 3 spaces PAST C4
      expect(idx(trill().startNoteId), 'it crossed').toBe(0)
      expect(offset('start'), 'and stopped dead on the note').toBeCloseTo(0)
      // ⚠️ SIGNED, in the direction of travel — the caller holds its cursor anchor back by exactly
      // this (`lastX = x - droppedPx`), so the next frame presents those pixels again.
      expect(frame.droppedPx, 'the overshoot is handed back to the caller').toBeCloseTo(-30)
    })

    it('⭐ a frame writes NO undo entry of its own — the drop commits once', () => {
      arm('start')
      drag(trillId, 'start', -30)
      drag(trillId, 'start', -30)
      engine.commitTrillDrag('start')
      engine.undo()
      expect(offset('start'), 'both frames came back in ONE step').toBeCloseTo(0)
    })

    it('⛔ declines — null — when the ornament is not drawn, so there is no scale', () => {
      render(null)
      expect(drag(trillId, 'end', 40)).toBeNull()
    })

    it('a frame that moved nothing reports so, and writes nothing', () => {
      arm('end')
      expect(drag(trillId, 'end', 0)).toEqual({ moved: false, jumped: false, droppedPx: 0 })
      expect(offset('end')).toBe(0)
    })
  })

  /**
   * ⭐⭐ **THE VERTICAL IS A LADDER** — …above staff N, below staff N, above staff N+1… — and a drag
   * takes ONE rung at a time. His ask, 2026-08-20: *"the mouse drag [must] change the `tr` y offset,
   * and of course we have to be aware of the system jump in the y, similar to hairpin"*.
   */
  describe('dragTrillEndpoint — the vertical', () => {
    /** The staff's five lines, so the fixture can say where "across the staff" is. */
    const STAFF = { top: 40, bottom: 80 }

    it('⭐ an ordinary frame writes the height as OUTWARD, ⛔ not screen-down', () => {
      // ⚠️ `outward` is a distance FROM the staff: dragging an ABOVE trill UP (−y) must grow it.
      arm('start')
      dragTrillEndpoint(engine, trillId, 'start', 0, 0, -20)
      expect(trillOffsetOverrideOf(engine.getScore(), trillId)?.outward, 'two spaces further out')
        .toBeCloseTo(2)
    })

    it('⭐⭐ crossing its OWN staff flips the side, and the height goes with it', () => {
      // The band sits ABOVE the staff (the fixture draws it at y 20…30), so dragging down past the
      // bottom line is the first rung — ⛔ not a jump to the staff below.
      arm('start')
      dragTrillEndpoint(engine, trillId, 'start', 0, 0, -20)          // give it a height first
      const frame = dragTrillEndpoint(engine, trillId, 'start', 0, 0, STAFF.bottom + 20)!
      expect(frame.jumped, 'a rung ends the gesture').toBe(true)
      expect(engine.getTrillById(trillId)?.placement).toBe('below')
      expect(trillOffsetOverrideOf(engine.getScore(), trillId)?.outward ?? 0,
        'a height measured above the staff means nothing below it').toBeCloseTo(0)
    })

    it('⛔ …and a frame that stays on its own side of the staff does not flip', () => {
      arm('start')
      const frame = dragTrillEndpoint(engine, trillId, 'start', 0, 0, 10)!
      expect(frame.jumped).toBe(false)
      expect(engine.getTrillById(trillId)?.placement ?? 'above').toBe('above')
    })
  })

  /**
   * ⭐⭐ **THE WHOLE ORNAMENT WALKS** — his ask, 2026-08-20: *"now we should do the `tr` shape
   * walking — I mean, trill selected but NOT endpoints"*. The family's rule, from the wedge's body:
   * **something armed → that end; nothing armed → the whole mark** — and now with the same walk
   * under both, so a nudge and a re-anchor are one gesture wherever they meet.
   */
  describe('walkTrillBody', () => {
    const body = (dx: number) => walkTrillBody(engine, trillId, dx)

    it('⭐ nine presses are INK — both ends together, and nothing re-anchored', () => {
      presses(9, 0)                                   // (no-op: the body takes no armed square)
      for (let i = 0; i < 9; i++) body(1)
      expect(offset('start')).toBeCloseTo(9)
      expect(offset('end'), 'the far end moved the same — it is ONE gesture').toBeCloseTo(9)
      expect(idx(trill().startNoteId), 'still on D4').toBe(1)
    })

    it('⭐⭐ the TENTH takes the ornament onto the next note, EXTENT AND ALL', () => {
      for (let i = 0; i < 10; i++) body(1)
      expect(idx(trill().startNoteId), 'D4 → E4').toBe(2)
      expect(idx(trill().endNoteId), 'and the far end came too, one note along').toBe(3)
      expect(offset('start'), 'the ink did not jump').toBeCloseTo(0)
    })

    it('⭐ it walks on THROUGH where its own end stood — the ornament is one object', () => {
      // ⚠️ The armed START may never pass the end; the BODY carries the end with it, so the question
      // never arises — which is why the candidate rule's `'body'` case has no clamp at all. ⛔ That
      // branch is NOT what this proves (with the extent carried, the end is always one stop ahead of
      // the step, so the start's clamp would allow it too); what this proves is that the ornament
      // arrives whole, three notes along, having passed the note its end began on.
      for (let i = 0; i < 30; i++) body(1)
      expect(idx(trill().startNoteId), 'three notes along, over the old end').toBe(3)
    })

    it('⚠️ a span pushed off the end of the lane arrives SHORTENED, ⛔ not refused', () => {
      engine.setTrillAnchor(trillId, 'start', ids[2])   // E4 → F4, the last two notes
      engine.setTrillAnchor(trillId, 'end', ids[3])
      for (let i = 0; i < 10; i++) body(1)
      expect(idx(trill().startNoteId), 'onto F4, the last note').toBe(3)
      expect(trill().endNoteId, 'and the end had nowhere to go — the one-note trill').toBeUndefined()
    })
  })

  /**
   * ⭐⭐ **THE SHAPE DRAG** — the whole ornament grabbed by its own ink, both axes in one gesture.
   * His ask, 2026-08-20: *"now the shape drag walking, and taking into consideration also the
   * vertical axis for the target"*.
   */
  describe('dragTrillBody', () => {
    it('⭐⭐ a drag and N presses over the same distance land in the SAME state', () => {
      for (let i = 0; i < 10; i++) walkTrillBody(engine, trillId, 1)
      const byKeys = { anchor: idx(trill().startNoteId), end: idx(trill().endNoteId) }
      engine.undo()

      dragTrillBody(engine, trillId, 0, 100, 0)
      expect(idx(trill().startNoteId), 'the drag crossed too').toBe(byKeys.anchor)
      expect(idx(trill().endNoteId), 'and carried the extent').toBe(byKeys.end)
    })

    it('⭐ the vertical writes the height as OUTWARD, and BOTH ends move as one', () => {
      dragTrillBody(engine, trillId, 0, 40, -20)
      expect(trillOffsetOverrideOf(engine.getScore(), trillId)?.outward, 'two spaces further out')
        .toBeCloseTo(2)
      expect(offset('start'), 'and the horizontal is the whole ornament\'s').toBeCloseTo(offset('end'))
    })

    it('⛔ declines — null — when the ornament is not drawn', () => {
      render(null)
      expect(dragTrillBody(engine, trillId, 0, 40, 0)).toBeNull()
    })
  })
})
