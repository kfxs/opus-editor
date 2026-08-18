import { describe, it, expect, beforeEach } from 'vitest'
import {
  pedalEndpointHandles, armPedalEndpointAt, cyclePedalEndpoint, pedalDragTargetAt,
  PEDAL_HANDLE_GAP_PX as GAP,
} from './pedalHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected pedal's two endpoint squares sit.
 *
 * Subject: {@link pedalHandles}, sitting beside this file. The REGISTRY is the fixture, the ottava's
 * and hairpin's arrangement next door — the glyph boxes are what `PedalRenderer` measured, so with
 * them handed in the answer is ordinary arithmetic rather than a glyph measurement (jsdom measures
 * none: `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is
 * `HighlightController`'s.
 */

/** One drawn SIGN as the renderer registers it — the grain of this family (⚠️ per GLYPH, not per
 *  fragment), which is exactly what these tests are about. */
const sign = (
  which: 'down' | 'up',
  x: number,
  width: number,
  top: number,
  bottom: number,
  id = 'P1',
): ElementInfo => ({
  type: 'pedal',
  id,
  pedalSign: which,
  bbox: { x, y: top, width, height: bottom - top },
  points: [
    { x, y: top },
    { x: x + width, y: top },
    { x: x + width, y: bottom },
    { x, y: bottom },
  ],
} as ElementInfo)

/** An unbroken pedal: `Ped.` at 100 (26 wide), `✻` right-aligned on the lift at 300 (12 wide).
 *  Both signs share one baseline, so both boxes share one band — 84…101. */
const PED = () => sign('down', 100, 26, 84, 101)
const STAR = () => sign('up', 288, 12, 84, 101)

describe('pedalEndpointHandles', () => {
  it('⭐ steps each square OUTWARD — the AIR, so neither sits on a sign', () => {
    expect(pedalEndpointHandles([PED(), STAR()], 'P1')).toEqual([
      // left of the `Ped.`'s LEFT edge…
      { which: 'start', x: 100 - GAP, y: 92.5 },
      // …and right of the `✻`'s RIGHT edge, which is the lift x itself (the release is
      // right-aligned on it, so its ink runs backwards from there).
      { which: 'end', x: 288 + 12 + GAP, y: 92.5 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre: the
    // squares are 6px half-side (`SLUR_HANDLE_R + 1`), so anything at or under 6 overlaps.
    expect(GAP).toBeGreaterThan(6)
  })

  it('⭐⭐ names the two signs, ⛔ never counts entries — the START is the FIRST `Ped.`', () => {
    // A pedal broken across a system break registers `Ped.` · `(Ped.)` · `✻`. A resumption is a
    // reminder that the damper is still down, not a second beginning, so the middle sign carries no
    // square — and reading "the first entry and the last one" would put the END square on it if the
    // release were ever registered before it.
    const resumed = sign('down', 40, 40, 484, 501)
    const lift = sign('up', 200, 12, 484, 501)
    expect(pedalEndpointHandles([PED(), resumed, lift], 'P1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92.5 },
      { which: 'end', x: 200 + 12 + GAP, y: 492.5 },
    ])
  })

  it('⚠️ takes the two ends from DIFFERENT systems\' coordinates when the pedal is broken', () => {
    // Each square rides its own sign's box, so the release on the next system draws its square there
    // — reading both off one entry would put the second square in the wrong system.
    const lift = sign('up', 200, 12, 484, 501)
    expect(pedalEndpointHandles([PED(), lift], 'P1').map(h => h.y)).toEqual([92.5, 492.5])
  })

  it('⚠️ draws ONE square when the release was not drawn — ⛔ it never invents the missing end', () => {
    // Two squares on one `Ped.` would say the pedal both begins and ends there.
    expect(pedalEndpointHandles([PED()], 'P1')).toEqual([{ which: 'start', x: 100 - GAP, y: 92.5 }])
    expect(pedalEndpointHandles([STAR()], 'P1')).toEqual([{ which: 'end', x: 300 + GAP, y: 92.5 }])
    // ⭐⭐ THE BREAK-TEST FOR THE WHOLE `pedalSign` FIELD: a broken pedal whose final fragment the
    // cutter dropped registers `Ped.` · `(Ped.)` and no release. "The first entry and the last one"
    // passes every case above and puts the END square on the RESUMPTION here — a square claiming to
    // be the lift, several bars before the damper comes up.
    const resumed = sign('down', 40, 40, 484, 501)
    expect(pedalEndpointHandles([PED(), resumed], 'P1'))
      .toEqual([{ which: 'start', x: 100 - GAP, y: 92.5 }])
  })

  it('ignores another pedal\'s signs entirely', () => {
    const other = sign('up', 10, 12, 84, 101, 'P2')
    expect(pedalEndpointHandles([other, PED(), STAR()], 'P1').map(h => h.x))
      .toEqual([100 - GAP, 300 + GAP])
  })

  it('draws nothing for a pedal that is not on screen, and nothing for an unnamed box', () => {
    expect(pedalEndpointHandles([], 'P1')).toEqual([])
    const unnamed = { type: 'pedal', id: 'P1', bbox: { x: 0, y: 0, width: 10, height: 10 } } as ElementInfo
    expect(pedalEndpointHandles([unnamed], 'P1')).toEqual([])
  })
})

/** A registry holding one drawn pedal plus the squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(PED())
  registry.add(STAR())
  for (const h of pedalEndpointHandles(registry.getByType('pedal'), 'P1')) {
    registry.add({
      type: 'pedal-endpoint', pedalId: 'P1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armPedalEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'pedal', id: 'P1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armPedalEndpointAt(state, registry, 300 + GAP, 92.5)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    const before = state.selectedElement
    armPedalEndpointAt(state, registry, 100 - GAP, 92.5)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1', endpoint: 'start' })
  })

  it('a press between the squares — over the music the pedal passes over — DECLINES', () => {
    expect(armPedalEndpointAt(state, registry, 200, 92.5)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1' })
  })

  it('⛔ does not answer for an OTTAVA\'s squares — the families read their own type', () => {
    registry.add({
      type: 'ottava-endpoint', ottavaId: 'O1', endpoint: 'end',
      bbox: { x: 491, y: 83, width: 18, height: 18 },
    } as ElementInfo)
    expect(armPedalEndpointAt(state, registry, 500, 92)).toBe(false)
  })

  it('declines when no squares are drawn (no pedal selected, so none registered)', () => {
    expect(armPedalEndpointAt(state, new ElementRegistry(), 100, 92)).toBe(false)
  })
})

describe('cyclePedalEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cyclePedalEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'pedal', id: 'P1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('⚠️ a pedal whose release was not drawn has ONE stop, and the walk stays on it', () => {
    registry = new ElementRegistry()
    registry.add(PED())
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('start')
  })

  it('declines with no pedal selected, leaving Tab to the other walks (then the browser)', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
    state.selectedElement = { kind: 'ottava', id: 'O1' }
    expect(walk(1)).toBe(false)
  })

  it('declines when the pedal is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1' })
  })
})

/**
 * ⭐⭐ {@link pedalDragTargetAt} — which address a dragged square is over.
 *
 * The registry is the fixture again: the drawn note boxes are what the render measured, so "which
 * onset is the cursor nearest" is arithmetic.
 *
 * ⭐⭐ **Two claims that are this family's own, and both are recorded traps if copied from a
 * neighbour.** (1) BOTH ends measure against notehead LEFT edges — the ottava's end measures against
 * RIGHT edges, because its hook is drawn there and a pedal's signs are not. (2) The END has one
 * candidate MORE than there are onsets: the lift is a moment in time, so the last note can be cut
 * off or held, and only the extra candidate names the second.
 */
function dragEngine(notes: Array<{
  id: string; left: number; y: number; measure: number; beat: number; voice?: number; staff?: number
}>, pedal: { staffId?: string } = {}, signs: ElementInfo[] = []) {
  const registry = new ElementRegistry()
  for (const s of signs) registry.add(s)
  for (const n of notes) {
    registry.add({
      type: 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getPedalById: () => ({ id: 'P1', beat: { num: 0, den: 1 }, length: { num: 1, den: 1 }, ...pedal }),
    getScore: () => ({ staves: [{ id: 's0' }, { id: 's1' }] }),
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, measure: n.measure, beat: { num: n.beat, den: 1 }, voice: n.voice, staff: n.staff } : null
    },
  } as unknown as Parameters<typeof pedalDragTargetAt>[0]
}

/** Three quarters, 12px wide, at x = 100 / 200 / 300 on one system. */
const THREE = [
  { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
  { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
  { id: 'n3', left: 300, y: 50, measure: 1, beat: 2 },
]

describe('pedalDragTargetAt', () => {
  it('⭐⭐ the LIFT measures against notehead LEFT edges — where the `✻`\'s x is read from', () => {
    // ⭐⭐ THE BREAK-TEST AGAINST THE OTTAVA'S RULE: 258 is past the midpoint of the LEFT edges (250)
    // but not of the RIGHT ones (212 / 312, midpoint 262). Measuring the lift on right edges — the
    // bracket's rule — would answer n2 here and lag the cursor by a notehead.
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'end', 258, 50))
      .toEqual({ at: 'end', after: false, measure: 1, beat: { num: 2, den: 1 } })
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'end', 246, 50))
      .toEqual({ at: 'end', after: false, measure: 1, beat: { num: 1, den: 1 } })
  })

  it('the PRESS measures against the same left edges — one grid for both signs', () => {
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'start', 246, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'start', 254, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('⭐⭐ dragging the lift PAST the last note holds it — the `after` address no onset names', () => {
    // The last notehead offers BOTH its edges (left 300, right 312), so the answer flips at their
    // midpoint — the head's own centre, 306. Before it the `✻` lands on the note and the note is
    // dry; past it the pedal holds the note. ⛔ The ottava has no such candidate: its every
    // draggable address is a covered slot.
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'end', 304, 50))
      .toEqual({ at: 'end', after: false, measure: 1, beat: { num: 2, den: 1 } })
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'end', 308, 50))
      .toEqual({ at: 'end', after: true, measure: 1, beat: { num: 2, den: 1 } })
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'end', 340, 50))
      .toEqual({ at: 'end', after: true, measure: 1, beat: { num: 2, den: 1 } })
    // …and the PRESS gets no such candidate — a foot goes down when a note is struck, and "just
    // after the last note" is not a press anyone can play.
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'start', 340, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('⭐⭐ takes EVERY VOICE of its staff — one damper, one foot', () => {
    const notes = [...THREE, { id: 'n4', left: 250, y: 50, measure: 1, beat: 3, voice: 1 }]
    expect(pedalDragTargetAt(dragEngine(notes), 'P1', 'start', 250, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 3, den: 1 } })
  })

  it('⭐ stays on ITS OWN staff', () => {
    const notes = [
      { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
      { id: 'low', left: 150, y: 50, measure: 1, beat: 1, staff: 1 },
    ]
    // The lower-staff note sits EXACTLY under the cursor and must still lose.
    expect(pedalDragTargetAt(dragEngine(notes), 'P1', 'start', 150, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 0, den: 1 } })
    expect(pedalDragTargetAt(dragEngine(notes, { staffId: 's1' }), 'P1', 'start', 150, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
  })

  it('⚠️ uses BOTH axes, so a similar x on another SYSTEM cannot win', () => {
    const notes = [
      { id: 'up', left: 200, y: 50, measure: 1, beat: 0 },
      { id: 'down', left: 200, y: 450, measure: 3, beat: 0 },
    ]
    expect(pedalDragTargetAt(dragEngine(notes), 'P1', 'start', 205, 470))
      .toMatchObject({ measure: 3 })
  })

  it('answers nothing when the cursor is nowhere near the music, and nothing with no music at all', () => {
    expect(pedalDragTargetAt(dragEngine(THREE), 'P1', 'start', 2000, 50)).toBeNull()
    expect(pedalDragTargetAt(dragEngine([]), 'P1', 'start', 100, 50)).toBeNull()
  })

  it('declines for an id no pedal has', () => {
    const engine = { ...dragEngine(THREE), getPedalById: () => null } as never
    expect(pedalDragTargetAt(engine, 'nope', 'start', 100, 50)).toBeNull()
  })
})

/**
 * 🚨🚨 **THE CURSOR IS ON THE PEDAL'S LINE, NOT ON THE MUSIC** — his report, 2026-08-18: *"I'm
 * dragging in the y of the pedal, aligned to it, but it interprets I'm in the system below … to drag
 * well I have to place the mouse in the staff, and that is not good UX."*
 *
 * ⭐⭐ The fixture is the whole point and it must be LOPSIDED, exactly like the ladder's: the pedal
 * is the outermost below-staff family, so its line sits ~10 staff spaces under its own music and is
 * genuinely NEARER the next system's noteheads. A fixture with the systems far apart would pass with
 * the translation deleted.
 */
describe('pedalDragTargetAt — the drag is measured from the SIGN\'s line', () => {
  /** System 1's music at y=50, system 2's at y=210. The `Ped.` is drawn at y≈153.5 — 103.5px under
   *  its OWN notes and only 56.5px above the next system's. */
  const TWO_SYSTEMS = [
    { id: 'a1', left: 100, y: 50, measure: 1, beat: 0 },
    { id: 'a2', left: 200, y: 50, measure: 1, beat: 1 },
    { id: 'a3', left: 300, y: 50, measure: 1, beat: 2 },
    { id: 'b1', left: 100, y: 210, measure: 5, beat: 0 },
    { id: 'b2', left: 200, y: 210, measure: 5, beat: 1 },
    { id: 'b3', left: 300, y: 210, measure: 5, beat: 2 },
  ]
  /** The `Ped.` as `PedalRenderer` registers it: left-aligned on the first note, on the pedal line. */
  const DRAWN = [sign('down', 100, 26, 145, 162), sign('up', 288, 12, 145, 162)]
  const LINE_Y = 153.5   // the squares' y — the sign box's middle
  const engine = () => dragEngine(TWO_SYSTEMS, {}, DRAWN)

  it('🚨 answers the pedal\'s OWN system when the cursor is on the pedal\'s line', () => {
    // ⭐⭐ THE BREAK-TEST FOR THE WHOLE TRANSLATION: raw-y distance from (200, 153.5) is 103.5 to
    // system 1's note and 56.5 to system 2's — the WRONG row is nearer, so this is not a tolerance
    // that could be widened out of trouble. It is also the break-test for the "only onsets ABOVE the
    // square" rule inside the offset: measuring against the nearest onset in either direction picks
    // system 2's note, and the translation then lands exactly on it.
    expect(pedalDragTargetAt(engine(), 'P1', 'start', 200, LINE_Y))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
    expect(pedalDragTargetAt(engine(), 'P1', 'end', 300, LINE_Y))
      .toEqual({ at: 'end', after: false, measure: 1, beat: { num: 2, den: 1 } })
  })

  it('⭐ and the NEXT system when the cursor is dragged down to ITS pedal line', () => {
    // 210 + the same measured gap. Crossing systems still works — the translation moves the whole
    // ruler, it does not pin the drag to one row.
    expect(pedalDragTargetAt(engine(), 'P1', 'start', 200, 210 + 103.5))
      .toEqual({ at: 'start', measure: 5, beat: { num: 1, den: 1 } })
  })

  it('⭐ the y picks the SYSTEM and the x picks the NOTE — a pitch difference cannot outvote x', () => {
    // `a2` is four ledger lines up, 40px above its neighbours. The cursor at x=245 is 45px from it
    // and 55px from `a3` — so on x it belongs to `a2`, plainly. ⭐⭐ THE BREAK-TEST: one hypotenuse
    // over both axes makes that hypot(45,40)=60.2 against hypot(55,0)=55 and answers `a3` instead —
    // the note under the cursor losing to one further away because it is drawn higher.
    const high = TWO_SYSTEMS.map(n => (n.id === 'a2' ? { ...n, y: 10 } : n))
    expect(pedalDragTargetAt(dragEngine(high, {}, DRAWN), 'P1', 'start', 245, LINE_Y))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
  })

  it('answers NOTHING when the cursor is on no system\'s music at all', () => {
    // No change is the honest frame — ⛔ better than snapping to whichever row happens to be least
    // far away when the cursor is nowhere near either.
    expect(pedalDragTargetAt(engine(), 'P1', 'start', 200, -400)).toBeNull()
  })

  it('⚠️ falls back to the raw cursor y when the pedal drew no sign to measure from', () => {
    // The honest "I don't know": with nothing on screen there is no gap to read, so the cursor is
    // taken at face value rather than shifted by a guess.
    expect(pedalDragTargetAt(dragEngine(TWO_SYSTEMS), 'P1', 'start', 200, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
  })
})
