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
}))

vi.mock('../engine/rendering/VexFlowRenderer', () => ({
  VexFlowRenderer: class {
    initialize = vi.fn(); renderScore = vi.fn()
    getElementRegistry = vi.fn(() => ({
      clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
      findAt: vi.fn(() => null), getById: vi.fn(() => null),
      registerStaffGeometry: vi.fn(),
      getStaffGeometry: () => (drawn.lineSpacing === null ? undefined : {
        lineSpacing: drawn.lineSpacing,
        lineYPositions: [40, 50, 60, 70, 80],
        noteStartX: 90, noteEndX: 430,
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

  it('⭐⭐ THE END MEASURES AGAINST ITS SUCCESSOR — its gap is F4→the rest, ⛔ not E4→F4', () => {
    // 🚨 The break-test for `trillLane`'s whole reason to exist. The end sits on E4, so its line is
    // drawn at F4 (400) and would be drawn at the rest (700) one note along: THIRTY staff-spaces,
    // where the two noteheads are ten apart. Measured note-to-note the tenth press would cross and
    // the drawn end would jump 200 px — the crossing this family exists to make invisible.
    arm('end')
    presses(10, 1)
    expect(idx(trill().endNoteId), 'ten presses — a note-to-note gap would have crossed here').toBe(2)
    presses(19, 1)
    expect(idx(trill().endNoteId), 'and twenty-nine are still ink').toBe(2)
    expect(press(1)).toBe(true)
    expect(idx(trill().endNoteId), 'the thirtieth hands it on: E4 → F4').toBe(3)
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

  it('⭐ a crossing press is ONE undo entry — both halves or neither', () => {
    arm('start')
    presses(10, -1)
    expect(idx(trill().startNoteId)).toBe(0)
    engine.undo()
    expect(idx(trill().startNoteId), 'back on D4').toBe(1)
    expect(offset('start'), 'with the nine-space nudge intact').toBeCloseTo(-9)
  })
})
