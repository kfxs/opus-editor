import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  hairpinEndpointHandles, armHairpinEndpointAt, cycleHairpinEndpoint, hairpinDragTargetAt,
  hairpinMouthEnd, nudgeArmedHairpinMouth, resetArmedHairpinMouth, hairpinStaffSpacePx,
  HAIRPIN_HANDLE_GAP_PX as GAP,
} from './hairpinHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected hairpin's two endpoint squares sit.
 *
 * Subject: {@link hairpinHandles}, sitting beside this file. The REGISTRY is the fixture, as it is
 * for the slur's handles next door — the outline `points` are what `HairpinRenderer` measured, so
 * with those handed in the answer is ordinary arithmetic and not a glyph measurement (jsdom measures
 * none: `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is
 * `HighlightController`'s and has its own chapter.
 */

/** One drawn fragment, as the renderer registers it: top arm, then the mouth, then back. */
const piece = (x0: number, x1: number, axis: number, h0: number, h1: number): ElementInfo => ({
  type: 'hairpin',
  id: 'H1',
  bbox: { x: x0, y: axis - Math.max(h0, h1), width: x1 - x0, height: 2 * Math.max(h0, h1) },
  points: [
    { x: x0, y: axis - h0 },
    { x: x1, y: axis - h1 },
    { x: x1, y: axis + h1 },
    { x: x0, y: axis + h0 },
  ],
} as ElementInfo)

describe('hairpinEndpointHandles', () => {
  it('⭐ puts each handle on the wedge AXIS, not on an arm', () => {
    // A crescendo: closed at the left (h0 = 0), open at the right. Both squares land on the centre
    // line — a corner would sit on the top arm and read as belonging to it.
    const handles = hairpinEndpointHandles([piece(100, 200, 50, 0, 6)], 'H1')
    expect(handles.map(h => h.y)).toEqual([50, 50])
  })

  it('⭐ steps each square OUTWARD, so neither sits on the wedge (his correction, 2026-08-17)', () => {
    // The beginning goes LEFT of the tip and the end RIGHT of the mouth — both away from the ink,
    // never both the same way, which would put one square inside the wedge it is marking.
    const handles = hairpinEndpointHandles([piece(100, 200, 50, 0, 6)], 'H1')
    expect(handles).toEqual([
      { which: 'start', x: 100 - GAP, y: 50 },
      { which: 'end', x: 200 + GAP, y: 50 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre.
    expect(GAP).toBeGreaterThan(6)
  })

  it('follows a slanted wedge — each end reads its OWN axis height', () => {
    const slanted: ElementInfo = {
      ...piece(100, 200, 50, 2, 8),
      points: [{ x: 100, y: 48 }, { x: 200, y: 36 }, { x: 200, y: 52 }, { x: 100, y: 52 }],
    } as ElementInfo
    expect(hairpinEndpointHandles([slanted], 'H1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 50 },
      { which: 'end', x: 200 + GAP, y: 44 },
    ])
  })

  it('⚠️ takes the two ends from DIFFERENT fragments when the wedge is split across a break', () => {
    // The continuation restarts at its own system's left margin — reading both ends off one entry
    // would draw the second square in the wrong system.
    const handles = hairpinEndpointHandles([
      piece(600, 780, 50, 0, 4),   // first system, runs to the right margin
      piece(80, 300, 400, 4, 8),   // next system, from the left margin
    ], 'H1')
    expect(handles).toEqual([
      { which: 'start', x: 600 - GAP, y: 50 },
      { which: 'end', x: 300 + GAP, y: 400 },
    ])
  })

  it('ignores another hairpin\'s fragments entirely', () => {
    const other = { ...piece(10, 40, 20, 0, 3), id: 'H2' } as ElementInfo
    expect(hairpinEndpointHandles([other, piece(100, 200, 50, 0, 6)], 'H1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 50 },
      { which: 'end', x: 200 + GAP, y: 50 },
    ])
  })

  it('draws nothing for a wedge that is not on screen, and nothing for a fragment with no outline', () => {
    expect(hairpinEndpointHandles([], 'H1')).toEqual([])
    const noPoints = { type: 'hairpin', id: 'H1', bbox: { x: 0, y: 0, width: 10, height: 10 } } as ElementInfo
    expect(hairpinEndpointHandles([noPoints], 'H1')).toEqual([])
  })
})

/** A registry holding one drawn wedge plus the two squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(piece(100, 200, 50, 0, 6))
  for (const h of hairpinEndpointHandles(registry.getByType('hairpin'), 'H1')) {
    registry.add({
      type: 'hairpin-endpoint', hairpinId: 'H1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armHairpinEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armHairpinEndpointAt(state, registry, 200 + GAP, 50)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'hairpin', id: 'H1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    // Mutating `.endpoint` in place would change the value and repaint nothing.
    const before = state.selectedElement
    armHairpinEndpointAt(state, registry, 100 - GAP, 50)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'hairpin', id: 'H1', endpoint: 'start' })
  })

  it('a press between the squares — on the wedge itself — DECLINES, so the chain gets it', () => {
    expect(armHairpinEndpointAt(state, registry, 150, 50)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'hairpin', id: 'H1' })
  })

  it('declines when no squares are drawn (no hairpin selected, so none registered)', () => {
    expect(armHairpinEndpointAt(state, new ElementRegistry(), 100, 50)).toBe(false)
  })
})

describe('cycleHairpinEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cycleHairpinEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('declines with no hairpin selected, leaving Tab to the browser', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
  })

  it('declines when the wedge is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'hairpin', id: 'H1' })
  })
})

/**
 * ⭐⭐ {@link hairpinDragTargetAt} — which BOUNDARY a dragged square is over.
 *
 * The registry is the fixture again: the drawn note boxes are what the render measured, so "which
 * boundary is the cursor nearest" is arithmetic.
 *
 * ⭐⭐ **The claim that matters is which x's are candidates at all.** A wedge's two tips are drawn at
 * a note's LEFT EDGE (`HairpinRenderer.spanX`), never at its head — so the tip's possible positions
 * are the lane's ONSETS, and a drag that snapped to notehead centres (the slur's rule, right for the
 * slur because its end is drawn ON the head) jumps half a notehead early and, for the end, a whole
 * note late. That was his report — *"sometimes it jumps before x mouse reach the target"* — and this
 * chapter is what keeps it fixed.
 */
function dragEngine(notes: Array<{
  id: string; left: number; y: number; measure: number; beat: number; voice?: number; staff?: number
}>, hairpin: { voice?: 0 | 1 | 2 | 3; staffId?: string } = {}) {
  const registry = new ElementRegistry()
  for (const n of notes) {
    registry.add({
      type: 'note', id: n.id, staff: n.staff ?? 0,
      bbox: { x: n.left, y: n.y - 5, width: 12, height: 10 },
    } as ElementInfo)
  }
  return {
    getHairpinById: () => ({ id: 'H1', type: 'cresc', beat: { num: 0, den: 1 }, length: { num: 1, den: 1 }, ...hairpin }),
    getScore: () => ({ staves: [{ id: 's0' }, { id: 's1' }] }),
    getElementRegistry: () => registry,
    getNote: (id: string) => {
      const n = notes.find(x => x.id === id)
      return n ? { id, measure: n.measure, beat: { num: n.beat, den: 1 }, voice: n.voice, staff: n.staff } : null
    },
  } as unknown as Parameters<typeof hairpinDragTargetAt>[0]
}

/** Three quarters at x = 100 / 200 / 300, all on one system. */
const THREE = [
  { id: 'n1', left: 100, y: 50, measure: 1, beat: 0 },
  { id: 'n2', left: 200, y: 50, measure: 1, beat: 1 },
  { id: 'n3', left: 300, y: 50, measure: 1, beat: 2 },
]

describe('hairpinDragTargetAt', () => {
  it('⭐ the END tip lands on the boundary the cursor is nearest — the note there is NOT covered', () => {
    // Cursor just left of the third note: the tip goes to that note's left edge, i.e. the wedge ends
    // BEFORE it. Covering it instead would draw the tip a whole note further right than the pointer.
    expect(hairpinDragTargetAt(dragEngine(THREE), 'H1', 'end', 290, 90))
      .toEqual({ at: 'endBefore', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('⭐ …and does NOT jump until the cursor is past the midpoint of the two boundaries', () => {
    const engine = dragEngine(THREE)
    // 249 still belongs to n2's boundary; 251 has crossed to n3's.
    expect(hairpinDragTargetAt(engine, 'H1', 'end', 249, 55)).toMatchObject({ beat: { num: 1, den: 1 } })
    expect(hairpinDragTargetAt(engine, 'H1', 'end', 251, 55)).toMatchObject({ beat: { num: 2, den: 1 } })
  })

  it('⭐ dragged PAST the last note, the end COVERS it — the one boundary that is not an onset', () => {
    // Every other target is an onset; the music has none after its last, so "cover everything" is a
    // candidate of its own at that note's right edge, or the last note could never be included.
    expect(hairpinDragTargetAt(dragEngine(THREE), 'H1', 'end', 316, 55))
      .toEqual({ at: 'endCovering', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('the START snaps to the same boundaries, and takes the onset as its own', () => {
    expect(hairpinDragTargetAt(dragEngine(THREE), 'H1', 'start', 205, 90))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
  })

  it('⛔ a START dragged past all the music answers nothing — only a tip can go there', () => {
    expect(hairpinDragTargetAt(dragEngine(THREE), 'H1', 'start', 316, 55)).toBeNull()
  })

  it('⚠️ uses BOTH axes, so a similar x on another SYSTEM cannot win', () => {
    // Cross-system x's are not one ruler: the note directly above the cursor must beat the one at a
    // nearly identical x two systems up.
    const engine = dragEngine([
      { id: 'up', left: 205, y: 50, measure: 1, beat: 0 },
      { id: 'here', left: 220, y: 400, measure: 5, beat: 3 },
    ])
    expect(hairpinDragTargetAt(engine, 'H1', 'end', 210, 430)).toMatchObject({ measure: 5 })
  })

  it('takes its boundaries from its STAFF — every voice of it', () => {
    const engine = dragEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ])
    // The cursor sits ON the voice-1 note's edge, and the fixture's wedge carries no `voice`.
    expect(hairpinDragTargetAt(engine, 'H1', 'start', 174, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('⭐⭐ …and a wedge NARROWED to a voice reaches the SAME boundary', () => {
    // Scope is about loudness; a tip is dragged onto a COLUMN, and a column belongs to the staff.
    const engine = dragEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, voice: 0 },
      { id: 'theirs', left: 174, y: 50, measure: 1, beat: 2, voice: 1 },
    ], { voice: 0 })
    expect(hairpinDragTargetAt(engine, 'H1', 'start', 174, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 2, den: 1 } })
  })

  it('…and its own STAFF', () => {
    const engine = dragEngine([
      { id: 'mine', left: 180, y: 50, measure: 1, beat: 0, staff: 1 },
      { id: 'other', left: 174, y: 50, measure: 1, beat: 2, staff: 0 },
    ], { staffId: 's1' })
    expect(hairpinDragTargetAt(engine, 'H1', 'start', 174, 50))
      .toEqual({ at: 'start', measure: 1, beat: { num: 0, den: 1 } })
  })

  it('a CHORD is one boundary — its leftmost head, which is the edge the wedge is drawn against', () => {
    const engine = dragEngine([
      { id: 'low', left: 200, y: 50, measure: 1, beat: 1 },
      { id: 'high', left: 208, y: 40, measure: 1, beat: 1 },
    ])
    expect(hairpinDragTargetAt(engine, 'H1', 'start', 201, 55))
      .toEqual({ at: 'start', measure: 1, beat: { num: 1, den: 1 } })
  })

  it('answers null when nothing in the lane is near enough — no jump across the page', () => {
    expect(hairpinDragTargetAt(dragEngine(THREE), 'H1', 'end', 900, 800)).toBeNull()
  })
})

/**
 * ⭐⭐ THE MOUTH KEYS — `Shift+↑/↓` and `Shift+Backspace` on the mouth-bearing square (his ask,
 * 2026-08-17; the chord moved from `Shift+←/→` after he tried it, so the direction lives in
 * `shortcutWiring` and this module only takes a signed delta).
 *
 * Two claims carry the feature. **WHICH square answers**: the open end, which is the wedge's TYPE
 * rather than a side of the score — a tip has no aperture, so the closed end declines and the key
 * stays the barline gap's. And **where a step starts**: from what is DRAWN, authored or not, clamped
 * into `authoredApertureRange`, so the keyboard and the Properties input cannot reach different values.
 */
function mouthEngine(
  type: 'cresc' | 'dim',
  drawn?: { apertureSpaces?: number; hairpinLengthSpaces?: number },
) {
  const registry = new ElementRegistry()
  if (drawn) registry.add({ type: 'hairpin', id: 'H1', bbox: { x: 0, y: 0, width: 10, height: 10 }, ...drawn } as ElementInfo)
  const set = vi.fn((_id: string, _aperture: number | null) => true)
  const engine = {
    getHairpinById: () => ({ id: 'H1', type }),
    getElementRegistry: () => registry,
    setHairpinAperture: set,
  } as unknown as Parameters<typeof nudgeArmedHairpinMouth>[1]
  return { engine, set }
}

describe('hairpinMouthEnd', () => {
  it('⭐ is the OPEN end — right on a crescendo, left on a diminuendo', () => {
    expect(hairpinMouthEnd('cresc')).toBe('end')
    expect(hairpinMouthEnd('dim')).toBe('start')
  })
})

describe('nudgeArmedHairpinMouth', () => {
  let state: EditorState
  const DRAWN = { apertureSpaces: 1.5, hairpinLengthSpaces: 40 } // range 1 … 2

  beforeEach(() => {
    state = createEditorState()
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
  })

  it('⭐ steps from what is DRAWN, in either direction', () => {
    const { engine, set } = mouthEngine('cresc', DRAWN)
    expect(nudgeArmedHairpinMouth(state, engine, 0.05)).toBe(true)
    expect(set).toHaveBeenCalledWith('H1', 1.55)
    nudgeArmedHairpinMouth(state, engine, -0.05)
    expect(set).toHaveBeenLastCalledWith('H1', 1.45)
  })

  it('⛔ declines on the CLOSED end — a tip has no aperture', () => {
    // The same armed square that answers on a crescendo is the tip of a diminuendo.
    const { engine, set } = mouthEngine('dim', DRAWN)
    expect(nudgeArmedHairpinMouth(state, engine, 0.05)).toBe(false)
    expect(set).not.toHaveBeenCalled()
    // …and its own open end does answer.
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'start' }
    expect(nudgeArmedHairpinMouth(state, engine, 0.05)).toBe(true)
  })

  it('⚠️ CLAMPS into the authored range, so the keys and the panel cannot disagree', () => {
    const { engine, set } = mouthEngine('cresc', { apertureSpaces: 1.98, hairpinLengthSpaces: 40 })
    nudgeArmedHairpinMouth(state, engine, 0.05)
    expect(set).toHaveBeenCalledWith('H1', 2) // not 2.03
  })

  it('⛔ declines AT the bound rather than writing the same value again', () => {
    const { engine, set } = mouthEngine('cresc', { apertureSpaces: 2, hairpinLengthSpaces: 40 })
    expect(nudgeArmedHairpinMouth(state, engine, 0.05)).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('⛔ declines when no square is armed, and when the wedge is not on screen to measure', () => {
    const { engine } = mouthEngine('cresc', DRAWN)
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
    expect(nudgeArmedHairpinMouth(state, engine, 0.05)).toBe(false)

    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
    expect(nudgeArmedHairpinMouth(state, mouthEngine('cresc').engine, 0.05)).toBe(false)
  })

  it('does not accumulate float dust across steps', () => {
    const { engine, set } = mouthEngine('cresc', { apertureSpaces: 1.6500000000000001, hairpinLengthSpaces: 40 })
    nudgeArmedHairpinMouth(state, engine, 0.05)
    expect(set).toHaveBeenCalledWith('H1', 1.7)
  })
})

describe('resetArmedHairpinMouth', () => {
  let state: EditorState
  beforeEach(() => {
    state = createEditorState()
    state.selectedElement = { kind: 'hairpin', id: 'H1', endpoint: 'end' }
  })

  it('hands the mouth back to automatic from the mouth-bearing square', () => {
    const { engine, set } = mouthEngine('cresc')
    expect(resetArmedHairpinMouth(state, engine)).toBe(true)
    expect(set).toHaveBeenCalledWith('H1', null)
  })

  it('⛔ declines on the closed end, so Shift+Backspace stays the barline gap\'s', () => {
    const { engine, set } = mouthEngine('dim')
    expect(resetArmedHairpinMouth(state, engine)).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('⛔ …and declines when the engine says there was nothing authored', () => {
    const registry = new ElementRegistry()
    const engine = {
      getHairpinById: () => ({ id: 'H1', type: 'cresc' }),
      getElementRegistry: () => registry,
      setHairpinAperture: () => false,
    } as unknown as Parameters<typeof resetArmedHairpinMouth>[1]
    expect(resetArmedHairpinMouth(state, engine)).toBe(false)
  })
})

/**
 * ⭐ {@link hairpinStaffSpacePx} — the divisor a BODY drag converts its pixels with (his ask,
 * 2026-08-18: dragging a selected wedge with no square armed moves the whole thing's ink).
 *
 * ⭐⭐ The claim is that it comes off the DRAWN staff, not off a constant: a wedge on a small staff
 * moves fewer pixels per staff-space, and a hard-coded 10 would move a cue staff's hairpin twice as
 * far as a full one's for the same gesture.
 */
describe('hairpinStaffSpacePx', () => {
  const registryWith = (opts: { lineSpacing?: number; measure?: number; staff?: number } = {}) => {
    const registry = new ElementRegistry()
    registry.add({
      type: 'hairpin', id: 'H1', measure: opts.measure ?? 1, staff: opts.staff ?? 0,
      bbox: { x: 0, y: 0, width: 100, height: 10 },
    } as ElementInfo)
    if (opts.lineSpacing !== undefined) {
      registry.setStaffGeometry({
        measure: opts.measure ?? 1, staff: opts.staff ?? 0,
        lineYPositions: [0, 10, 20, 30, 40], lineSpacing: opts.lineSpacing,
        noteStartX: 50, noteEndX: 400, clef: 'treble',
      })
    }
    return registry
  }

  it('⭐ answers with the spacing of the staff the wedge was DRAWN on', () => {
    expect(hairpinStaffSpacePx(registryWith({ lineSpacing: 10 }), 'H1')).toBe(10)
  })

  it('⭐⭐ …so a SMALL staff scales the gesture — the number is not a constant', () => {
    expect(hairpinStaffSpacePx(registryWith({ lineSpacing: 7.5 }), 'H1')).toBe(7.5)
  })

  it('⭐ reads the wedge\'s OWN staff in a multi-staff system', () => {
    const registry = registryWith({ lineSpacing: 10, staff: 1 })
    registry.setStaffGeometry({
      measure: 1, staff: 0, lineYPositions: [0, 10, 20, 30, 40], lineSpacing: 20,
      noteStartX: 50, noteEndX: 400, clef: 'treble',
    })
    expect(hairpinStaffSpacePx(registry, 'H1')).toBe(10) // ⛔ not staff 0's 20
  })

  it('⛔ answers NOTHING when the wedge is not on screen — no picture, no scale', () => {
    expect(hairpinStaffSpacePx(new ElementRegistry(), 'H1')).toBeNull()
  })

  it('⛔ …and nothing when its staff has no measured geometry, so no drag is armed', () => {
    expect(hairpinStaffSpacePx(registryWith(), 'H1')).toBeNull()
  })
})
