import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  nudgeArmedSlurControlPoint, resetArmedSlurHandle, cpsFromDrawnControlPoints,
} from './slurHandleNudge'
import { createEditorState, type EditorState } from './EditorState'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'
import type { CurveControlPointDeltas, SlurSegmentAddress } from '../types/music'

/**
 * The arrow keys reshape a selected slur's arc.
 *
 * Subject: {@link slurHandleNudge}, sitting beside this file. Like Tab's walk next door, the REGISTRY
 * is the fixture — the module's whole job is to read the DRAWN arc, move one control point, and hand
 * the model staff-spaces — so a fabricated registry and a stub engine say everything. ⚠️ Nothing here
 * asserts where ink landed (jsdom measures no glyphs); the numbers below are the arithmetic of
 * `renderCurve`'s control-point math, which is exactly what this module inverts.
 */

/** A drawn same-line arc ABOVE the staff: ends at y=50, both control points 20px up, 10px/space. */
const P0 = { x: 100, y: 50 }
const P1 = { x: 200, y: 50 }
const SS = 10
/** `renderCurve` places C0 at `p0.x + (p1.x-p0.x)/4 + cp.x`, `p0.y + cp.y·dir` — 20px of lift above. */
const DRAWN_ABOVE: [{ x: number; y: number }, { x: number; y: number }] = [
  { x: 125, y: 30 }, { x: 175, y: 30 },
]

function handle(over: Partial<ElementInfo> = {}): ElementInfo {
  return {
    type: 'slur-handle',
    slurId: 'S1',
    cpIndex: 0,
    controlPoints: DRAWN_ABOVE,
    slurEndpoints: { p0: P0, p1: P1, direction: -1 },
    staffSpacePx: SS,
    bbox: { x: 121, y: 26, width: 8, height: 8 },
    ...over,
  } as ElementInfo
}

interface Recorded {
  id: string
  cps: CurveControlPointDeltas
  segment?: SlurSegmentAddress
  spanCount?: number
}

/** The engine calls this module makes, and nothing else — see `ShapeEngine` in the module. The three
 *  resets answer `authored`, so the "nothing to take back" decline can be driven. */
function stubEngine(registry: ElementRegistry, authored = true) {
  const shapes: Recorded[] = []
  const commit = vi.fn()
  const reset = vi.fn((_id: string, _segment?: SlurSegmentAddress, _spanCount?: number) => authored)
  const resetEnd = vi.fn((_id: string, _which: 'start' | 'end') => authored)
  const resetJoin = vi.fn((_id: string, _address: unknown, _spanCount: number) => authored)
  const engine = {
    getElementRegistry: () => registry,
    previewSlurShape: (id: string, cps: CurveControlPointDeltas, segment?: SlurSegmentAddress, spanCount?: number) => {
      shapes.push({ id, cps, segment, spanCount })
      return true
    },
    commitSlurShape: commit,
    resetSlurShape: reset,
    resetSlurEndpointOffset: resetEnd,
    resetSlurSegmentEndpointOffset: resetJoin,
  } as unknown as MusicEngine
  return { engine, shapes, commit, reset, resetEnd, resetJoin }
}

describe('cpsFromDrawnControlPoints', () => {
  it('inverts renderCurve back to the pixel deltas that drew the arc', () => {
    expect(cpsFromDrawnControlPoints(DRAWN_ABOVE, { p0: P0, p1: P1, direction: -1 }))
      .toEqual([{ x: 0, y: 20 }, { x: 0, y: 20 }])
  })

  it('reads the same lift as POSITIVE on a slur below the staff (arc space, not screen space)', () => {
    const below: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 125, y: 70 }, { x: 175, y: 70 }]
    expect(cpsFromDrawnControlPoints(below, { p0: P0, p1: P1, direction: 1 }))
      .toEqual([{ x: 0, y: 20 }, { x: 0, y: 20 }])
  })
})

describe('nudgeArmedSlurControlPoint', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = new ElementRegistry()
    registry.add(handle())
    registry.add(handle({ cpIndex: 1, bbox: { x: 171, y: 26, width: 8, height: 8 } }))
    state.selectedElement = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 0 } }
  })

  it('⭐ starts from the DRAWN arc, not from zero — one press moves the dot by the delta', () => {
    // The auto arch is 2 spaces up (20px ÷ 10); ↑ by ¼ leaves 2.25, NOT 0.25. Getting this wrong
    // flings the control point onto the chord line the first time an un-edited slur is nudged.
    const { engine, shapes } = stubEngine(registry)
    expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(true)
    expect(shapes).toHaveLength(1)
    expect(shapes[0].cps).toEqual([{ x: 0, y: 2.25 }, { x: 0, y: 2 }])
  })

  it('moves ONLY the armed dot — the other rides through at its drawn value', () => {
    state.selectedElement = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 1 } }
    const { engine, shapes } = stubEngine(registry)
    nudgeArmedSlurControlPoint(state, engine, 0.25, 0)
    expect(shapes[0].cps).toEqual([{ x: 0, y: 2 }, { x: 0.25, y: 2 }])
  })

  it('⚠️ ↑ lifts the dot on screen on BOTH sides — so the stored delta FLIPS with `direction`', () => {
    // Screen-down is +y; arc space is "away from the notes". The same ↑ press therefore has to ADD
    // to a slur above (2 → 2.25, drawn 2.5px higher) and SUBTRACT from one below (2 → 1.75, drawn
    // 2.5px higher again). ⭐ Asserted as a PAIR: drop the `· direction` and both become 1.75, which
    // each half alone would still accept.
    const below = new ElementRegistry()
    below.add(handle({
      controlPoints: [{ x: 125, y: 70 }, { x: 175, y: 70 }],
      slurEndpoints: { p0: P0, p1: P1, direction: 1 },
    }))
    const above = stubEngine(registry)
    const under = stubEngine(below)
    nudgeArmedSlurControlPoint(state, above.engine, 0, -0.25)
    nudgeArmedSlurControlPoint(state, under.engine, 0, -0.25)
    expect(above.shapes[0].cps[0]).toEqual({ x: 0, y: 2.25 })
    expect(under.shapes[0].cps[0]).toEqual({ x: 0, y: 1.75 })
  })

  it('records exactly one undo entry per press', () => {
    const { engine, commit } = stubEngine(registry)
    nudgeArmedSlurControlPoint(state, engine, 0, -0.25)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('routes a cross-system slur to the armed SEGMENT, with the live span count', () => {
    const cross = new ElementRegistry()
    cross.add(handle({ segmentRole: 'middle', segmentOrdinal: 1, slurSpanCount: 3 }))
    state.selectedElement = {
      kind: 'slur', id: 'S1',
      controlPoint: { cpIndex: 0, segmentRole: 'middle', segmentOrdinal: 1 },
    }
    const { engine, shapes } = stubEngine(cross)
    expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(true)
    expect(shapes[0].segment).toEqual({ role: 'middle', ordinal: 1 })
    expect(shapes[0].spanCount).toBe(3)
  })

  it('does not light a dot on every system: the armed segment picks its own handle', () => {
    const cross = new ElementRegistry()
    cross.add(handle({ segmentRole: 'begin', slurSpanCount: 2 }))
    cross.add(handle({
      segmentRole: 'end', slurSpanCount: 2,
      controlPoints: [{ x: 425, y: 40 }, { x: 475, y: 40 }],
      slurEndpoints: { p0: { x: 400, y: 50 }, p1: { x: 500, y: 50 }, direction: -1 },
    }))
    state.selectedElement = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 0, segmentRole: 'end' } }
    const { engine, shapes } = stubEngine(cross)
    nudgeArmedSlurControlPoint(state, engine, 0, 0)
    // The END segment's own 10px lift, not the BEGIN segment's 20px.
    expect(shapes[0].cps[0]).toEqual({ x: 0, y: 1 })
    expect(shapes[0].segment).toEqual({ role: 'end' })
  })

  describe('DECLINES, leaving the arrow key its normal job', () => {
    it('with no slur selected', () => {
      state.selectedElement = null
      const { engine, commit } = stubEngine(registry)
      expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(false)
      expect(commit).not.toHaveBeenCalled()
    })

    it('with a slur selected but a SQUARE armed — that end has its own nudge', () => {
      state.selectedElement = { kind: 'slur', id: 'S1', endpoint: 'start' }
      const { engine } = stubEngine(registry)
      expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(false)
    })

    it('when the armed dot is not drawn (linear view registers no handles at all)', () => {
      const { engine } = stubEngine(new ElementRegistry())
      expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(false)
    })

    it('⛔ rather than guess a staff-space size the handle did not carry', () => {
      const noScale = new ElementRegistry()
      noScale.add(handle({ staffSpacePx: undefined }))
      const { engine } = stubEngine(noScale)
      expect(nudgeArmedSlurControlPoint(state, engine, 0, -0.25)).toBe(false)
    })
  })
})

describe('resetArmedSlurHandle', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = new ElementRegistry()
    registry.add(handle())
    state.selectedElement = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 0 } }
  })

  it('hands a same-line arc back to the automatic shape — no address, the slur\'s own override', () => {
    const { engine, reset } = stubEngine(registry)
    expect(resetArmedSlurHandle(state, engine)).toBe(true)
    expect(reset).toHaveBeenCalledWith('S1')
  })

  it('⭐ an armed TRUE END drops that end\'s nudge — and only that end\'s', () => {
    state.selectedElement = { kind: 'slur', id: 'S1', endpoint: 'end' }
    const { engine, resetEnd, reset } = stubEngine(registry)
    expect(resetArmedSlurHandle(state, engine)).toBe(true)
    expect(resetEnd).toHaveBeenCalledWith('S1', 'end')
    expect(reset).not.toHaveBeenCalled() // the arc's shape is a different edit, left alone
  })

  it('⭐ an armed OPEN JOIN drops that join\'s nudge, keyed by the span count it was armed at', () => {
    state.selectedElement = {
      kind: 'slur', id: 'S1',
      segmentEndpoint: { role: 'middle', ordinal: 1, side: 'left' },
      segmentSpanCount: 3,
    }
    const { engine, resetJoin } = stubEngine(registry)
    expect(resetArmedSlurHandle(state, engine)).toBe(true)
    expect(resetJoin).toHaveBeenCalledWith('S1', { role: 'middle', ordinal: 1, side: 'left' }, 3)
  })

  it('resets only the ARMED SEGMENT of a cross-system slur, at the drawn span count', () => {
    const cross = new ElementRegistry()
    cross.add(handle({ segmentRole: 'middle', segmentOrdinal: 1, slurSpanCount: 3 }))
    state.selectedElement = {
      kind: 'slur', id: 'S1',
      controlPoint: { cpIndex: 0, segmentRole: 'middle', segmentOrdinal: 1 },
    }
    const { engine, reset } = stubEngine(cross)
    expect(resetArmedSlurHandle(state, engine)).toBe(true)
    expect(reset).toHaveBeenCalledWith('S1', { role: 'middle', ordinal: 1 }, 3)
  })

  describe('DECLINES, leaving the key to the note-spacing / bar-width resets it shares', () => {
    it('with the slur selected but NO handle armed', () => {
      state.selectedElement = { kind: 'slur', id: 'S1' }
      const { engine, reset, resetEnd, resetJoin } = stubEngine(registry)
      expect(resetArmedSlurHandle(state, engine)).toBe(false)
      expect(reset).not.toHaveBeenCalled()
      expect(resetEnd).not.toHaveBeenCalled()
      expect(resetJoin).not.toHaveBeenCalled()
    })

    it('with no slur selected at all', () => {
      state.selectedElement = null
      const { engine } = stubEngine(registry)
      expect(resetArmedSlurHandle(state, engine)).toBe(false)
    })

    it('when the armed handle carries no hand edit to take back', () => {
      const { engine } = stubEngine(registry, false)
      expect(resetArmedSlurHandle(state, engine)).toBe(false)
    })

    it('when a cross-system segment\'s span count is not on screen to key the reset with', () => {
      const cross = new ElementRegistry()
      cross.add(handle({ segmentRole: 'begin', slurSpanCount: undefined }))
      state.selectedElement = { kind: 'slur', id: 'S1', controlPoint: { cpIndex: 0, segmentRole: 'begin' } }
      const { engine, reset } = stubEngine(cross)
      expect(resetArmedSlurHandle(state, engine)).toBe(false)
      expect(reset).not.toHaveBeenCalled()
    })
  })
})
