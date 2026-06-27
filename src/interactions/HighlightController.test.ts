// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * Guards slur-handle drawing across same-line AND cross-system slurs.
 *
 * Round (control-point) and square (endpoint) handles draw independently, BUT a round
 * handle now requires drag endpoints (`segmentEndpoints` for a cross-system segment, else
 * `slurEndpoints`) — a control point with no endpoints can't be inverted into a cps delta,
 * so it isn't drawn. A same-line slur is ONE partial (controlPoints + slurEndpoints) → one
 * round pair + squares. A cross-system slur is N partials, each with its own controlPoints
 * + segmentEndpoints (a round pair per segment), and the true ends on a single partial
 * (`slurEndpoints`) → the squares. `applySlurHandles` must LOOP all partials for rounds
 * (§4a) — a single `.find` would have served only the first segment.
 *
 * We fabricate the `slur` partial(s), run `applySlurHandles`, and count what it pushes back.
 */
function runPartials(partialExtras: Partial<ElementInfo>[], selectedEndpoint: 'start' | 'end' | null = null) {
  const registry = new ElementRegistry()
  for (const extra of partialExtras) {
    registry.add({ type: 'slur', id: 'S1', bbox: { x: 0, y: 0, width: 0, height: 0 }, ...extra })
  }
  const engine = { getElementRegistry: () => registry } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  state.selectedSlurId = 'S1'
  state.selectedSlurEndpoint = selectedEndpoint

  const hc = new HighlightController(() => engine, () => canvas, state)
  hc.applySlurHandles()

  return {
    handles: registry.getByType('slur-handle'),
    rounds: registry.getByType('slur-handle').length,
    squares: registry.getByType('slur-endpoint').length,
    circles: svg.querySelectorAll('circle').length,
    rects: svg.querySelectorAll('rect').length,
    selectedRects: svg.querySelectorAll('.slur-endpoint-handle--selected').length,
  }
}
const run = (slurExtra: Partial<ElementInfo>, selectedEndpoint: 'start' | 'end' | null = null) =>
  runPartials([slurExtra], selectedEndpoint)

const CPS: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 10, y: 20 }, { x: 30, y: 20 }]
const ENDS = { p0: { x: 5, y: 15 }, p1: { x: 40, y: 15 }, direction: -1 }
const SEG_ENDS = { p0: { x: 50, y: 15 }, p1: { x: 90, y: 15 }, direction: -1 }

describe('HighlightController slur-handle gate', () => {
  it('split slur with no shape (slurEndpoints only) → two squares, zero round handles', () => {
    const r = run({ slurEndpoints: ENDS })
    expect(r.squares).toBe(2)
    expect(r.rounds).toBe(0)
    expect(r.rects).toBe(2)
    expect(r.circles).toBe(0)
  })

  it('same-line slur (controlPoints + slurEndpoints) → both round and square handles', () => {
    const r = run({ controlPoints: CPS, slurEndpoints: ENDS })
    expect(r.rounds).toBe(2)
    expect(r.squares).toBe(2)
    expect(r.circles).toBe(2)
    expect(r.rects).toBe(2)
  })

  it('controlPoints with NO endpoints → no round handles (un-draggable, so not drawn)', () => {
    const r = run({ controlPoints: CPS })
    expect(r.rounds).toBe(0)
    expect(r.squares).toBe(0)
  })

  it('controlPoints + segmentEndpoints → round handles carrying the segment drag context', () => {
    const r = run({
      controlPoints: CPS, segmentEndpoints: SEG_ENDS,
      segmentRole: 'middle', segmentOrdinal: 1, staffSpacePx: 10, slurSpanCount: 3,
    })
    expect(r.rounds).toBe(2)
    expect(r.squares).toBe(0) // no slurEndpoints → no squares on this partial
    // The handle carries its own segment's context, read straight off it on mousedown.
    expect(r.handles[0]).toMatchObject({
      slurEndpoints: SEG_ENDS, controlPoints: CPS,
      segmentRole: 'middle', segmentOrdinal: 1, staffSpacePx: 10, slurSpanCount: 3,
    })
  })

  it('cross-system slur (§4a): loops ALL segment partials → a round pair each + 2 squares once', () => {
    // BEGIN carries the true ends (squares); every segment carries its own round-handle data.
    const begin = {
      controlPoints: CPS, segmentEndpoints: SEG_ENDS, slurEndpoints: ENDS,
      segmentRole: 'begin' as const, staffSpacePx: 10, slurSpanCount: 3,
    }
    const middle = {
      controlPoints: CPS, segmentEndpoints: SEG_ENDS,
      segmentRole: 'middle' as const, segmentOrdinal: 0, staffSpacePx: 10, slurSpanCount: 3,
    }
    const end = {
      controlPoints: CPS, segmentEndpoints: SEG_ENDS,
      segmentRole: 'end' as const, staffSpacePx: 10, slurSpanCount: 3,
    }
    const r = runPartials([begin, middle, end])
    expect(r.rounds).toBe(6)  // 2 per segment × 3 segments — the §4a loop, not a single .find
    expect(r.squares).toBe(2) // true ends drawn exactly once (from the partial with slurEndpoints)
    expect(r.circles).toBe(6)
    expect(r.rects).toBe(2)
    // Each segment's handles carry that segment's role.
    expect(r.handles.map(h => h.segmentRole).sort()).toEqual(
      ['begin', 'begin', 'end', 'end', 'middle', 'middle'],
    )
  })

  it('neither field → no handles drawn (nothing to draw)', () => {
    const r = run({})
    expect(r.rounds).toBe(0)
    expect(r.squares).toBe(0)
  })

  it('no armed endpoint → neither square gets the selected border', () => {
    const r = run({ slurEndpoints: ENDS })
    expect(r.rects).toBe(2)
    expect(r.selectedRects).toBe(0)
  })

  it('an armed endpoint → exactly that square gets the selected border', () => {
    const r = run({ slurEndpoints: ENDS }, 'start')
    expect(r.rects).toBe(2)         // still two squares, hit-boxes unchanged
    expect(r.squares).toBe(2)
    expect(r.selectedRects).toBe(1) // only the armed (start) square is highlighted
  })
})
