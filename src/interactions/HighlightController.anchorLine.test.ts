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

/** A selected dynamic whose box, ink point and anchor are given, and the line that comes out. */
function anchorLineFor(
  bbox: { x: number; y: number; width: number; height: number },
  guideFrom?: { x: number; y: number },
) {
  const registry = new ElementRegistry()
  registry.add({ type: 'dynamic', id: 'D1', bbox, anchor: { x: 140, y: 60 }, ...(guideFrom ? { guideFrom } : {}) })
  const engine = { getElementRegistry: () => registry } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  state.selectedElement = { kind: 'dynamic', id: 'D1' }

  new HighlightController(() => engine, () => canvas, state).applyAnchorGuideLine()
  return svg.querySelector('line.dynamic-anchor-line')
}

describe('the dynamic anchor line', () => {
  it('⭐ leaves the mark’s BEGINNING — its LEFT edge, not the right (his call)', () => {
    // A wide mark, so the two corners are 100px apart and the assertion cannot pass by luck of
    // geometry: an expression word is exactly the case where the old corner read wrong.
    const line = anchorLineFor({ x: 100, y: 80, width: 100, height: 12 })
    expect(line).not.toBeNull()
    expect(line!.getAttribute('x1'), 'the left edge, not 200').toBe('100')
  })

  it('⭐⭐ leaves the INK point when the render captured one — not the box top (his second report)', () => {
    // The box top is one fraction of the glyph size for every letter, so over a `p` it floats ~9px
    // above anything drawn and the guide started in blank space. `DynamicsLayout` measures the real
    // reach off the font and hands it over as `guideFrom`; this is the half that USES it.
    const line = anchorLineFor({ x: 100, y: 80, width: 20, height: 26 }, { x: 100, y: 89.4 })!
    expect(line.getAttribute('y1'), 'the ink’s top, not the box’s 80').toBe('89.4')
    expect(line.getAttribute('x1')).toBe('100')
  })

  it('falls back to the box for a mark the font cannot speak for — an expression WORD', () => {
    // Prose is set in a serif face the Bravura table knows nothing about, so no ink point is
    // captured; the box top is about right there, which is the half he said "does not look bad".
    const line = anchorLineFor({ x: 100, y: 80, width: 100, height: 12 })!
    expect(line.getAttribute('y1')).toBe('80')
  })

  it('ends at the note anchor the render captured', () => {
    const line = anchorLineFor({ x: 100, y: 80, width: 100, height: 12 })!
    expect(line.getAttribute('x2')).toBe('140')
    expect(line.getAttribute('y2')).toBe('60')
  })

  it('draws nothing for a dynamic with no captured anchor — a guide is never a guess', () => {
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
})
