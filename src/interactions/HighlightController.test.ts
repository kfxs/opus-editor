// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'
import type { ViewMode } from '../engine/rendering/layoutConfig'

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
function runPartials(
  partialExtras: Partial<ElementInfo>[],
  selectedEndpoint: 'start' | 'end' | null = null,
  selectedSegment: EditorStateSegmentSel = null,
  viewMode: ViewMode = 'wrapped',
) {
  const registry = new ElementRegistry()
  for (const extra of partialExtras) {
    registry.add({ type: 'slur', id: 'S1', bbox: { x: 0, y: 0, width: 0, height: 0 }, ...extra })
  }
  const engine = {
    getElementRegistry: () => registry,
    getViewMode: () => viewMode,
  } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  state.selectedSlurId = 'S1'
  state.selectedSlurEndpoint = selectedEndpoint
  state.selectedSlurSegmentEndpoint = selectedSegment

  const hc = new HighlightController(() => engine, () => canvas, state)
  hc.applySlurHandles()

  return {
    handles: registry.getByType('slur-handle'),
    rounds: registry.getByType('slur-handle').length,
    squares: registry.getByType('slur-endpoint').length,
    segSquares: registry.getByType('slur-segment-endpoint'),
    circles: svg.querySelectorAll('circle').length,
    rects: svg.querySelectorAll('rect').length,
    selectedRects: svg.querySelectorAll('.slur-endpoint-handle--selected').length,
    selectedSegRects: svg.querySelectorAll('.slur-segment-endpoint-handle--selected').length,
  }
}
type EditorStateSegmentSel = ReturnType<typeof createEditorState>['selectedSlurSegmentEndpoint']
const run = (
  slurExtra: Partial<ElementInfo>,
  selectedEndpoint: 'start' | 'end' | null = null,
  selectedSegment: EditorStateSegmentSel = null,
) => runPartials([slurExtra], selectedEndpoint, selectedSegment)

const runLinear = (slurExtra: Partial<ElementInfo>) => runPartials([slurExtra], null, null, 'linear')

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

  // Slur geometry is read-only in linear view: the shape is relative to endpoints whose
  // horizontal span differs between the views (docs/linear-view-plan.md §4.2). Drawing no
  // handles is also what keeps them out of the registry, so there is nothing to grab.
  it('linear view → no handles drawn, and none registered to grab', () => {
    const r = runLinear({ controlPoints: CPS, slurEndpoints: ENDS })
    expect(r.rounds).toBe(0)
    expect(r.squares).toBe(0)
    expect(r.circles).toBe(0)
    expect(r.rects).toBe(0)
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
    // Orange OPEN-join squares: begin right (1) + middle both (2) + end left (1) = 4.
    expect(r.segSquares.length).toBe(4)
    expect(r.rects).toBe(6)   // 2 blue true-end squares + 4 orange open-join squares
    // Each segment's round handles carry that segment's role.
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

/**
 * The orange OPEN-join squares (segment-endpoint nudge handles) of a cross-system slur —
 * docs/multisystem-slur-segment-endpoint-offset-plan.md. One per BEGIN (right) / END (left),
 * two per MIDDLE; carried as `slur-segment-endpoint` registry entries with the nudge address.
 */
describe('HighlightController orange open-join squares', () => {
  it('a same-line slur draws NO orange squares (no segments)', () => {
    const r = run({ controlPoints: CPS, slurEndpoints: ENDS })
    expect(r.segSquares.length).toBe(0)
  })

  it('BEGIN partial → one orange square addressed {role:begin}, no side', () => {
    const r = run({ segmentEndpoints: SEG_ENDS, segmentRole: 'begin', slurSpanCount: 2 })
    expect(r.segSquares.length).toBe(1)
    expect(r.segSquares[0]).toMatchObject({
      type: 'slur-segment-endpoint', slurId: 'S1', segmentRole: 'begin', slurSpanCount: 2,
    })
    expect(r.segSquares[0].segmentSide).toBeUndefined()
  })

  it('MIDDLE partial → two orange squares, left and right, carrying ordinal + side', () => {
    const r = run({ segmentEndpoints: SEG_ENDS, segmentRole: 'middle', segmentOrdinal: 0, slurSpanCount: 3 })
    expect(r.segSquares.length).toBe(2)
    expect(r.segSquares.map(s => s.segmentSide).sort()).toEqual(['left', 'right'])
    for (const s of r.segSquares) {
      expect(s).toMatchObject({ segmentRole: 'middle', segmentOrdinal: 0, slurSpanCount: 3 })
    }
  })

  it('an armed open join → exactly that orange square gets the selected border', () => {
    const r = run(
      { segmentEndpoints: SEG_ENDS, segmentRole: 'middle', segmentOrdinal: 0, slurSpanCount: 3 },
      null,
      { role: 'middle', ordinal: 0, side: 'left' },
    )
    expect(r.rects).toBe(2)            // two orange squares (no blue — this partial has no slurEndpoints)
    expect(r.selectedSegRects).toBe(1) // only the armed (middle/0/left) square is highlighted
  })
})

/**
 * P3 — the highlight layer must be REMOVABLE without a redraw (docs/render-performance-plan.md §5a).
 *
 * Highlights used to reset themselves by being wiped along with the SVG ("Safe: the next render
 * rebuilds the SVG"). Now that a selection change can skip the render entirely, `clearHighlights()`
 * is the only thing that takes them back off — so it has to be an exact inverse. The three ways a
 * highlight touches the DOM each get a test, including the one the plan flagged as a trap: a
 * recolour must restore the PREVIOUS colour, not delete the attribute (voice 2 is green by default,
 * so deleting `fill` would blacken it).
 */
describe('clearHighlights — the inverse of a highlight pass', () => {
  /** A minimal note-shaped SVG: `<g>` (the stavenote) → `<g class="vf-notehead">` → `<text>`. */
  function noteGroup(svg: SVGSVGElement, fill: string | null): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    head.setAttribute('class', 'vf-notehead')
    const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    if (fill !== null) glyph.setAttribute('fill', fill)
    head.appendChild(glyph)
    group.appendChild(head)
    svg.appendChild(group)
    return group
  }

  function harness(noteFill: string | null) {
    const registry = new ElementRegistry()
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)
    const group = noteGroup(svg, noteFill)

    const engine = {
      getElementRegistry: () => registry,
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 1 }),
      getElementById: () => ({ type: 'note' }),
      getStaveNoteSVGGroup: () => ({ group, noteIndex: 0, stem: null }),
    } as unknown as MusicEngine

    const state = createEditorState()
    state.selectedItems.set('N1', { kind: 'note', id: 'N1' })

    const hc = new HighlightController(() => engine, () => canvas, state)
    const glyph = svg.querySelector('text')!
    return { hc, svg, glyph, group, registry }
  }

  it('restores a voice-coloured notehead to ITS OWN colour, not to black', () => {
    // Voice 2 renders green by default. The trap: clearing by removing `fill` would blacken it.
    const { hc, glyph } = harness('#22C55E')

    hc.applySelectionHighlight()
    expect(glyph.getAttribute('fill')).not.toBe('#22C55E') // painted in the selection colour

    hc.clearHighlights()
    expect(glyph.getAttribute('fill')).toBe('#22C55E')     // back to green, not black
    expect(glyph.style.fill).toBe('')
    expect(glyph.classList.contains('selected-note')).toBe(false)
  })

  it('a glyph that had NO fill attribute ends up with none again', () => {
    const { hc, glyph } = harness(null)

    hc.applySelectionHighlight()
    expect(glyph.hasAttribute('fill')).toBe(true)

    hc.clearHighlights()
    expect(glyph.hasAttribute('fill')).toBe(false)
  })

  it('removes the nodes the highlight layer added, and restores sibling order', () => {
    const { hc, svg, group } = harness('#000000')
    // A second note group AFTER ours: highlighting raises ours above it (the unison-notehead
    // fix), which must be undone or the SVG slowly permutes.
    const sibling = noteGroup(svg, '#000000')
    const before = [...svg.children]
    expect(svg.lastChild).toBe(sibling)

    hc.applyMeasureBox() // no measure range selected → adds nothing
    hc.applySelectionHighlight()
    expect(svg.lastChild).toBe(group) // raised to the front

    hc.clearHighlights()
    expect([...svg.children]).toEqual(before) // same nodes, same order
  })

  it('is idempotent — clearing twice, or clearing a pass that painted nothing, is a no-op', () => {
    const { hc, glyph } = harness('#22C55E')
    hc.applySelectionHighlight()
    hc.clearHighlights()
    hc.clearHighlights()
    expect(glyph.getAttribute('fill')).toBe('#22C55E')
  })

  it('drops the slur hit-boxes it registered, so a skipped render cannot accumulate them', () => {
    const { hc, registry } = harness('#000000')
    registry.add({
      type: 'slur', id: 'S1', bbox: { x: 0, y: 0, width: 0, height: 0 },
      controlPoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      slurEndpoints: { p0: { x: 0, y: 0 }, p1: { x: 9, y: 9 }, direction: 1 },
    })
    const state = createEditorState()
    state.selectedSlurId = 'S1'
    const hc2 = new HighlightController(
      () => ({ getElementRegistry: () => registry, getViewMode: () => 'wrapped' as ViewMode } as unknown as MusicEngine),
      () => { const c = document.createElement('div'); c.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); return c },
      state,
    )

    hc2.applySlurHandles()
    expect(registry.getByType('slur-handle').length).toBe(2)
    expect(registry.getByType('slur-endpoint').length).toBe(2)

    hc2.clearHighlights()
    expect(registry.getByType('slur-handle').length).toBe(0)
    expect(registry.getByType('slur-endpoint').length).toBe(0)
    expect(registry.getByType('slur').length).toBe(1) // the engraved slur itself survives
    void hc
  })
})
