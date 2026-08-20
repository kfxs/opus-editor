import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../engine/MusicEngine'
import { createEditorState, type EditorState } from './EditorState'
import { walkArmedTrillEndpoint } from './trillWalk'
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

  /** Where the drawn end actually is: its stop's base plus its own nudge. Bar 2's whole note is the
   *  last slot of its bar, so its base is that bar's end — 830. */
  const inkXOnSystemTwo = () => 830 + offset('end') * 10

  it('🚨🚨 THE INK WRAPS ONTO THE NEXT SYSTEM — one press, and it lands where it can be SEEN', () => {
    wrapFixture()
    arm('end')
    // ⭐ The end is on bar 1's last note, so its line already reaches that system's end (430) and
    // there is no ink left to push: the first rightward press IS the crossing. ⛔ Unlike the wedge's
    // tip, which parks at the line's end while stops remain on the same line.
    expect(press(1)).toBe(true)
    expect(engine.getNote(trill().endNoteId!)?.measure, 'the trill now covers bar 2').toBe(2)
    // 🚨 The honest landing is what the press pushed past the edge — ONE space. His report on the
    // first cut: at that size there is NOTHING TO SEE (`TRILL_END_INSET` eats it and the fragment is
    // dropped). So it is held to `WRAP_STUB_SS`, two spaces into the new line's music (90).
    expect(inkXOnSystemTwo(), 'two spaces past the new system\'s start').toBeCloseTo(110)
  })

  it('⭐ …and a LONG press keeps its own distance — the stub is a floor, not a landing', () => {
    wrapFixture()
    arm('end')
    expect(press(6), 'six spaces past the edge').toBe(true)
    expect(inkXOnSystemTwo(), 'six spaces in, ⛔ not clamped back to the floor').toBeCloseTo(150)
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

  it('⭐ a crossing press is ONE undo entry — both halves or neither', () => {
    arm('start')
    presses(10, -1)
    expect(idx(trill().startNoteId)).toBe(0)
    engine.undo()
    expect(idx(trill().startNoteId), 'back on D4').toBe(1)
    expect(offset('start'), 'with the nine-space nudge intact').toBeCloseTo(-9)
  })
})
