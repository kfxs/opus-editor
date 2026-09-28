// @vitest-environment jsdom
/** Subject: `./glyphMark` — where a press finds a user symbol, and how a selected one lights (docs/plans/symbol-plan.md P3). */
import { describe, it, expect, vi } from 'vitest'
import { GLYPH_MARK_ELEMENT } from './glyphMark'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import type { ElementChainDeps, MouseDownCtx } from './chain'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'

const NS = 'http://www.w3.org/2000/svg'

describe('GLYPH_MARK_ELEMENT.hit', () => {
  const press = (x: number, y: number) => {
    const registry = new ElementRegistry()
    registry.add({ type: 'glyphMark', id: 'g1', measure: 1, staff: 0, bbox: { x: 100, y: 20, width: 30, height: 12 } })
    const pick = vi.fn(() => true as const)
    const hit = GLYPH_MARK_ELEMENT.hit(
      { registry, x, y, closestElement: null, event: new MouseEvent('mousedown') } as unknown as MouseDownCtx,
      { pick } as unknown as ElementChainDeps,
    )
    return { hit, pick }
  }

  it('selects the symbol a press lands on — its ink, a few pixels padded — by its own id', () => {
    const { hit, pick } = press(110, 25)
    expect(hit).toBe(true)
    expect(pick).toHaveBeenCalledWith({ kind: 'glyphMark', id: 'g1' }, expect.any(Function)) // …arming its drag
    expect(press(132, 34).hit).toBe(true) // inside the pad
  })

  it('declines a press outside it', () => {
    const { hit, pick } = press(110, 60)
    expect(hit).toBe(false)
    expect(pick).not.toHaveBeenCalled()
  })
})

describe('GLYPH_MARK_ELEMENT.ink', () => {
  it('fills the named symbol’s own glyph, and clears back exactly', () => {
    const canvas = document.createElement('div')
    const svg = document.createElementNS(NS, 'svg')
    canvas.appendChild(svg)
    const group = document.createElementNS(NS, 'g')
    group.setAttribute('id', 'g1')
    const glyph = document.createElementNS(NS, 'text')
    group.appendChild(glyph)
    svg.appendChild(group)
    const other = document.createElementNS(NS, 'text')
    svg.appendChild(other)
    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
    } as unknown as MusicEngine
    const state = createEditorState()
    state.selectedElement = { kind: 'glyphMark', id: 'g1' }
    const hc = new HighlightController(() => engine, () => canvas, state)

    GLYPH_MARK_ELEMENT.ink!(hc.context()!, 'g1')
    expect(glyph.getAttribute('fill')).toBe(ELEMENT_SELECTION_FILL)
    expect(other.getAttribute('fill')).toBeNull()
    hc.clearHighlights()
    expect(glyph.getAttribute('fill')).toBeNull()
  })
})
