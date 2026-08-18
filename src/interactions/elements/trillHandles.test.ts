import { describe, it, expect, beforeEach } from 'vitest'
import {
  trillEndpointHandles, armTrillEndpointAt, cycleTrillEndpoint, trillDragTargetAt,
  TRILL_HANDLE_GAP_PX as GAP,
} from './trillHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected trill's two endpoint squares sit.
 *
 * Subject: {@link trillHandles}, sitting beside this file. The REGISTRY is the fixture, the pedal's
 * and the bracket's arrangement next door — the drawn band is what `TrillRenderer` measured, so with
 * it handed in the answer is ordinary arithmetic rather than a glyph measurement (jsdom measures
 * none: `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is
 * `HighlightController`'s.
 */

/** One drawn FRAGMENT as the renderer registers it: the band from the `tr` to the line's end.
 *
 *  ⚠️ The band is deliberately NOT symmetric about the baseline — the `tr`'s ink runs 1.6 staff
 *  spaces up and 0.1 down (`TRILL_MARK_INK`) — so a handle reading the baseline rather than the
 *  band's middle lands somewhere else. */
const piece = (x0: number, x1: number, top: number, bottom: number, id = 'T1'): ElementInfo => ({
  type: 'trill',
  id,
  bbox: { x: x0, y: top, width: x1 - x0, height: bottom - top },
  points: [
    { x: x0, y: top },
    { x: x1, y: top },
    { x: x1, y: bottom },
    { x: x0, y: bottom },
  ],
} as ElementInfo)

/** One unbroken trill: `tr` at 100, wiggle running to 300, baseline 100 (ink 84…101). */
const TRILL = () => piece(100, 300, 84, 101)

describe('trillEndpointHandles', () => {
  it('⭐ steps each square OUTWARD — the AIR, so neither sits on the `tr` or the last wiggle', () => {
    expect(trillEndpointHandles([TRILL()], 'T1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92.5 },
      { which: 'end', x: 300 + GAP, y: 92.5 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre: the
    // squares are 6px half-side (`SLUR_HANDLE_R + 1`), so anything at or under 6 overlaps.
    expect(GAP).toBeGreaterThan(6)
  })

  it('⚠️ takes the two ends from DIFFERENT fragments when the trill crosses a system break', () => {
    // The continuation restarts at its own system's left margin — reading both ends off one entry
    // would draw the second square in the wrong system.
    expect(trillEndpointHandles([
      piece(600, 780, 84, 101),    // first system, runs to the right margin
      piece(80, 300, 484, 501),    // next system, from the left margin
    ], 'T1')).toEqual([
      { which: 'start', x: 600 - GAP, y: 92.5 },
      { which: 'end', x: 300 + GAP, y: 492.5 },
    ])
  })

  it('⭐ both squares ride the BAND\'S MIDDLE, not its top or its baseline', () => {
    // The band is asymmetric about the baseline by construction, so reading either edge is visibly
    // different from reading the middle — this pins which one.
    expect(trillEndpointHandles([piece(100, 300, 60, 100)], 'T1').map(h => h.y)).toEqual([80, 80])
  })

  it('ignores another trill\'s fragments entirely', () => {
    const other = piece(10, 40, 84, 101, 'T2')
    expect(trillEndpointHandles([other, TRILL()], 'T1').map(h => h.x)).toEqual([100 - GAP, 300 + GAP])
  })

  it('draws nothing for an ornament that is not on screen', () => {
    expect(trillEndpointHandles([], 'T1')).toEqual([])
  })
})

/** A registry holding one drawn trill plus the two squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(TRILL())
  for (const h of trillEndpointHandles(registry.getByType('trill'), 'T1')) {
    registry.add({
      type: 'trill-endpoint', trillId: 'T1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armTrillEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'trill', id: 'T1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armTrillEndpointAt(state, registry, 300 + GAP, 92.5)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    const before = state.selectedElement
    armTrillEndpointAt(state, registry, 100 - GAP, 92.5)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1', endpoint: 'start' })
  })

  it('a press on the wiggle itself DECLINES, so the chain gets it', () => {
    expect(armTrillEndpointAt(state, registry, 200, 92.5)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1' })
  })

  it('⛔ does not answer for a PEDAL\'s squares — the families read their own type', () => {
    registry.add({
      type: 'pedal-endpoint', pedalId: 'P1', endpoint: 'end',
      bbox: { x: 491, y: 83, width: 18, height: 18 },
    } as ElementInfo)
    expect(armTrillEndpointAt(state, registry, 500, 92)).toBe(false)
  })

  it('declines when no squares are drawn (no trill selected, so none registered)', () => {
    expect(armTrillEndpointAt(state, new ElementRegistry(), 100, 92)).toBe(false)
  })
})

describe('cycleTrillEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cycleTrillEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'trill', id: 'T1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'trill', id: 'T1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('declines with no trill selected, leaving Tab to the other walks (then the browser)', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    expect(walk(1)).toBe(false)
  })

  it('declines when the ornament is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1' })
  })
})

/**
 * ⭐⭐ {@link trillDragTargetAt} — which NOTE a dragged square is over.
 *
 * The registry is the fixture: the drawn note boxes are what the render measured, so "which note is
 * the cursor nearest" is arithmetic.
 *
 * ⭐⭐ **The claim that matters is which x each end is measured against.** `TrillRenderer.spanX`
 * draws the sign on the start note's LEFT edge and stops the wavy line at the left edge of the
 * **first note AFTER** the trill — the third end rule. Measuring the end against its own notehead
 * would leave the square a whole note behind the cursor, which is the hairpin's recorded *"it jumps
 * before x mouse reach the target"* by the same route (a tip drawn at the first uncovered note).
 */
function dragEngine(
  notes: Array<{ id: string; left: number; y: number; voice?: number; staff?: number; isRest?: boolean }>,
  trill: { placement?: 'above' | 'below' } = {},
  drawn: ElementInfo[] = [],
) {
  const registry = new ElementRegistry()
  for (const d of drawn) registry.add(d)
  for (const n of notes) {
    registry.add({
      type: 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getTrillById: () => ({ id: 'T1', startNoteId: 'n1', voice: 0, ...trill }),
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, voice: n.voice, staff: n.staff, isRest: n.isRest } : null
    },
  } as unknown as Parameters<typeof trillDragTargetAt>[0]
}

/** Four notes, 12px wide, at x = 100 / 200 / 300 / 400 on one system. */
const FOUR = [
  { id: 'n1', left: 100, y: 50 },
  { id: 'n2', left: 200, y: 50 },
  { id: 'n3', left: 300, y: 50 },
  { id: 'n4', left: 400, y: 50 },
]

describe('trillDragTargetAt', () => {
  it('⭐ the START is measured against the note it sits ON', () => {
    expect(trillDragTargetAt(dragEngine(FOUR), 'T1', 'start', 205, 50))
      .toEqual({ at: 'start', noteId: 'n2' })
    expect(trillDragTargetAt(dragEngine(FOUR), 'T1', 'start', 290, 50))
      .toEqual({ at: 'start', noteId: 'n3' })
  })

  it('⭐⭐ the END is measured against the note AFTER it — where the wavy line stops', () => {
    // ⭐⭐ THE BREAK-TEST: a cursor at 305 sits on n3's notehead. Measured against its OWN note it
    // would answer n3; measured where the LINE would stop for each candidate — n2's line stops at
    // n3's left edge, 300 — it answers n2, which is the note the drawing says is trilled.
    expect(trillDragTargetAt(dragEngine(FOUR), 'T1', 'end', 305, 50))
      .toEqual({ at: 'end', noteId: 'n2' })
    expect(trillDragTargetAt(dragEngine(FOUR), 'T1', 'end', 405, 50))
      .toEqual({ at: 'end', noteId: 'n3' })
  })

  it('⚠️ the LAST note has no note after it, so its own right edge stands in for the bar\'s end', () => {
    // The renderer falls back to the bar's `noteEndX` there; the right edge is the nearest thing the
    // interaction layer can see, and it keeps the last note REACHABLE, which is what matters.
    expect(trillDragTargetAt(dragEngine(FOUR), 'T1', 'end', 412, 50))
      .toEqual({ at: 'end', noteId: 'n4' })
  })

  it('⛔ RESTS are not candidates — a trill attaches to a note', () => {
    const withRest = [...FOUR, { id: 'r1', left: 250, y: 50, isRest: true }]
    expect(trillDragTargetAt(dragEngine(withRest), 'T1', 'start', 250, 50))
      .toEqual({ at: 'start', noteId: 'n2' })
  })

  it('⭐ stays in the START note\'s own lane — the keys reach the same notes', () => {
    const other = [...FOUR, { id: 'v2', left: 250, y: 50, voice: 1 }]
    expect(trillDragTargetAt(dragEngine(other), 'T1', 'start', 250, 50))
      .toEqual({ at: 'start', noteId: 'n2' })
  })

  it('answers nothing with no music at all, and declines for an id no trill has', () => {
    expect(trillDragTargetAt(dragEngine([]), 'T1', 'start', 100, 50)).toBeNull()
    const engine = { ...dragEngine(FOUR), getTrillById: () => null } as never
    expect(trillDragTargetAt(engine, 'nope', 'start', 100, 50)).toBeNull()
  })
})

/**
 * 🚨🚨 **THE CURSOR IS ON THE ORNAMENT'S LINE, NOT ON THE MUSIC** — the pedal's report of
 * 2026-08-18, applied to the family's fifth drag. ⭐⭐ Here the offset is SIGNED by the trill's
 * side, which the pedal never had to think about.
 */
describe('trillDragTargetAt — the drag is measured from the SIGN\'s line', () => {
  /** System 1's music at y=210, with an ABOVE trill whose band rides at 120 — 90px over its own
   *  notes and only 70px under the previous system's, at y=50. */
  const TWO_SYSTEMS = [
    { id: 'up1', left: 100, y: 50 },
    { id: 'up2', left: 200, y: 50 },
    { id: 'n1', left: 100, y: 210 },
    { id: 'n2', left: 200, y: 210 },
    { id: 'n3', left: 300, y: 210 },
  ]
  const band = (y: number): ElementInfo => ({
    type: 'trill', id: 'T1',
    bbox: { x: 100, y: y - 9, width: 212, height: 18 },
  } as ElementInfo)

  it('🚨 an ABOVE trill answers its OWN system, though the system above is nearer in raw pixels', () => {
    // ⭐⭐ THE BREAK-TEST, and it doubles as the one for the SIDE: looking for the anchor's music
    // ABOVE it (a `below` trill's rule) finds the previous system and lands there instead.
    const engine = dragEngine(TWO_SYSTEMS, { placement: 'above' }, [band(120)])
    expect(trillDragTargetAt(engine, 'T1', 'start', 200, 120))
      .toEqual({ at: 'start', noteId: 'n2' })
  })

  it('⭐ a BELOW trill is the MIRROR — its music is the system above its line', () => {
    const below = [
      { id: 'n1', left: 100, y: 50 },
      { id: 'n2', left: 200, y: 50 },
      { id: 'low', left: 200, y: 210 },
    ]
    const engine = dragEngine(below, { placement: 'below' }, [band(140)])
    expect(trillDragTargetAt(engine, 'T1', 'start', 200, 140))
      .toEqual({ at: 'start', noteId: 'n2' })
  })

  it('answers NOTHING when the cursor is on no system\'s music at all', () => {
    const engine = dragEngine(TWO_SYSTEMS, { placement: 'above' }, [band(120)])
    expect(trillDragTargetAt(engine, 'T1', 'start', 200, -400)).toBeNull()
  })
})

/**
 * ⭐⭐ **THE BARE `tr` BY MOUSE** — the end square dragged LEFT PAST the start, the drag twin of the
 * keyboard's step past the collapse (his ask, 2026-08-18).
 */
describe('trillDragTargetAt — dragged past the start', () => {
  /** The trill starts on `n2`, so `n1` is to its left. */
  const FROM_N2 = (over: Parameters<typeof dragEngine>[0] = FOUR) =>
    dragEngine(over, {}, []) as ReturnType<typeof dragEngine>

  it('⭐ the END dragged left PAST the start asks for no line at all', () => {
    const engine = {
      ...FROM_N2(),
      getTrillById: () => ({ id: 'T1', startNoteId: 'n2', voice: 0 }),
    } as never
    // The cursor is out at n1 — earlier in the lane than the start.
    expect(trillDragTargetAt(engine, 'T1', 'end', 100, 50))
      .toEqual({ at: 'end', noteId: 'n2', lineOff: true })
  })

  it('⛔ …and the START square never asks for it — a trill without a sign is not a trill', () => {
    const engine = {
      ...FROM_N2(),
      getTrillById: () => ({ id: 'T1', startNoteId: 'n2', voice: 0 }),
    } as never
    expect(trillDragTargetAt(engine, 'T1', 'start', 100, 50))
      .toEqual({ at: 'start', noteId: 'n1' })
  })

  it('⭐ dragging the end AS FAR AS the start is the ordinary collapse, not the bare sign', () => {
    const engine = {
      ...FROM_N2(),
      getTrillById: () => ({ id: 'T1', startNoteId: 'n2', voice: 0 }),
    } as never
    // ⚠️ The candidate x for "the trill ends on n2" is n3's left edge (300) — where the line WOULD
    // stop, the third end rule. So 300 is the collapse and `setTrillEnd` clears the end; 200 is
    // already "ends on n1", which is past the start and therefore the bare sign (above).
    expect(trillDragTargetAt(engine, 'T1', 'end', 300, 50))
      .toEqual({ at: 'end', noteId: 'n2' })
    expect(trillDragTargetAt(engine, 'T1', 'end', 200, 50))
      .toEqual({ at: 'end', noteId: 'n2', lineOff: true })
  })
})
