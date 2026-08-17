// @vitest-environment jsdom
/**
 * The dashed ATTACHMENT LINE a selected dynamic draws to the note it hangs off.
 *
 * Subject: {@link HighlightController}, a chapter beside `HighlightController.test.ts` (slur handles)
 * and `.barline.test.ts`. The registry is FABRICATED, which is what makes this testable in jsdom at
 * all: the line is drawn from `ElementInfo.bbox` and `ElementInfo.anchor`, two numbers the engine
 * measures at render — so with those handed in, WHICH corner the line leaves from is ordinary
 * arithmetic and not a glyph measurement (`reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐ The claim is his, 2026-08-17: the line leaves the mark's BEGINNING. It used to leave the END —
 * *"the line starts in the x axis at the end of the expression… change that point to the beginning"*
 * — which on an expression WORD sent it back across the whole word to reach a note near its start.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import { ElementRegistry } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'

/** A selected dynamic with the given guide, and the line that comes out. */
function anchorLineFor(from: { x: number; y: number }, to = { x: 140, y: 60 }) {
  const registry = new ElementRegistry()
  registry.add({
    type: 'dynamic', id: 'D1',
    bbox: { x: 100, y: 80, width: 100, height: 12 },
    guides: [{ from, to }],
  })
  const engine = { getElementRegistry: () => registry } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  state.selectedElement = { kind: 'dynamic', id: 'D1' }

  new HighlightController(() => engine, () => canvas, state).applyAnchorGuideLine()
  return svg.querySelector('line.dynamic-anchor-line')
}

describe('the attachment guide', () => {
  it('draws exactly the segment the render measured — both ends, no arithmetic of its own', () => {
    // ⭐ The whole division of labour: the RENDER decides where a guide starts and ends (per letter
    // off the font for a dynamic, off the drawn tip for a wedge), and this method only draws it.
    const line = anchorLineFor({ x: 100, y: 89.4 })!
    expect(line.getAttribute('x1')).toBe('100')
    expect(line.getAttribute('y1'), 'the ink point, not a box corner').toBe('89.4')
    expect(line.getAttribute('x2')).toBe('140')
    expect(line.getAttribute('y2')).toBe('60')
  })

  it('draws nothing when the render measured none — a guide is never a guess', () => {
    const registry = new ElementRegistry()
    registry.add({ type: 'dynamic', id: 'D1', bbox: { x: 100, y: 80, width: 20, height: 12 } })
    const engine = { getElementRegistry: () => registry } as unknown as MusicEngine
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)
    const state = createEditorState()
    state.selectedElement = { kind: 'dynamic', id: 'D1' }

    new HighlightController(() => engine, () => canvas, state).applyAnchorGuideLine()
    expect(svg.querySelector('line.dynamic-anchor-line')).toBeNull()
  })

  it('⭐ draws EVERY fragment’s guides — a span is registered once per system', () => {
    // A hairpin cut across a break registers an entry per fragment under one id, and each carries
    // the guides belonging to ITS system. Reading only the first entry would drop them.
    const registry = new ElementRegistry()
    registry.add({
      type: 'hairpin', id: 'H1', bbox: { x: 0, y: 0, width: 10, height: 10 },
      guides: [{ from: { x: 1, y: 2 }, to: { x: 3, y: 4 } }],
    })
    registry.add({
      type: 'hairpin', id: 'H1', bbox: { x: 500, y: 0, width: 10, height: 10 },
      guides: [{ from: { x: 501, y: 2 }, to: { x: 503, y: 4 } }],
    })
    const engine = { getElementRegistry: () => registry } as unknown as MusicEngine
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)
    const state = createEditorState()
    state.selectedElement = { kind: 'hairpin', id: 'H1' }

    new HighlightController(() => engine, () => canvas, state).applyAnchorGuideLine()
    expect(svg.querySelectorAll('line.dynamic-anchor-line')).toHaveLength(2)
  })
})
