// @vitest-environment jsdom
/**
 * The two endpoint squares a selected SPAN draws — `paintEndpointHandles`, asked through the
 * HAIRPIN's own `highlight` row (the first of the four kinds on it), then once per kind for what the
 * kind changes: the class and the registry entry.
 *
 * WHERE they sit is `./<kind>Handles` and has its own spec; what is asked here is that selecting a
 * wedge paints them at all, that the armed one reads as picked, and that each registers the hit-box
 * a press finds it by — under `hairpinId`, and only for as long as the highlight layer lives.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import { HAIRPIN_ELEMENT } from './hairpin'
import { paintEndpointHandles, type EndpointHandleKind } from './endpointHandles'

function paint(selectedId: string | null, endpoint?: 'start' | 'end') {
  const registry = new ElementRegistry()
  registry.add({
    type: 'hairpin', id: 'H1',
    bbox: { x: 100, y: 44, width: 100, height: 12 },
    points: [{ x: 100, y: 50 }, { x: 200, y: 44 }, { x: 200, y: 56 }, { x: 100, y: 50 }],
  })
  const engine = {
    getElementRegistry: () => registry,
    getHairpinSVGGroup: () => null,
    getHairpinById: () => ({ id: 'H1', voice: 0 }),
  } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  if (selectedId) state.selectedElement = { kind: 'hairpin', id: selectedId, endpoint }

  const highlight = new HighlightController(() => engine, () => canvas, state)
  HAIRPIN_ELEMENT.highlight(highlight.context()!)
  return { svg, registry, highlight }
}

describe('a selected hairpin', () => {
  it('draws one square at each end of the wedge', () => {
    const { svg } = paint('H1')
    const squares = svg.querySelectorAll('rect.hairpin-endpoint-handle')
    expect(squares).toHaveLength(2)
    // On the axis at each end (y − half), stepped OUTWARD by the module's gap and then back by the
    // slur squares' half-side of 6: 100 − 10 − 6 on the left, 200 + 10 − 6 on the right.
    expect([squares[0].getAttribute('x'), squares[0].getAttribute('y')]).toEqual(['84', '44'])
    expect([squares[1].getAttribute('x'), squares[1].getAttribute('y')]).toEqual(['204', '44'])
  })

  it('registers a hit-box per square, so a press can find one', () => {
    // ⚠️ Under `hairpinId`, never `id`: `getById` answers with the FIRST entry holding one, so a
    // handle sharing the wedge's id would shadow the wedge itself.
    const { registry } = paint('H1')
    const handles = registry.getByType('hairpin-endpoint')
    expect(handles.map(h => [h.hairpinId, h.endpoint])).toEqual([['H1', 'start'], ['H1', 'end']])
    expect(handles.every(h => h.id === undefined)).toBe(true)
  })

  it('⭐ the armed square reads as picked — bigger, darker, thicker ring; the hit-box unchanged', () => {
    const { svg, registry } = paint('H1', 'end')
    const squares = svg.querySelectorAll('rect.hairpin-endpoint-handle')
    expect(squares[0].getAttribute('fill')).toBe('#2563EB')
    expect(squares[1].getAttribute('fill')).toBe('#1D4ED8')
    expect(squares[1].getAttribute('class')).toContain('hairpin-endpoint-handle--selected')
    expect(Number(squares[1].getAttribute('width'))).toBeGreaterThan(Number(squares[0].getAttribute('width')))
    // What you can grab does not move when you grab it.
    const boxes = registry.getByType('hairpin-endpoint').map(h => h.bbox.width)
    expect(boxes[0]).toBe(boxes[1])
  })

  it('the registered boxes come off with the highlight layer — the render never drew them', () => {
    const { registry, highlight } = paint('H1')
    highlight.clearHighlights()
    expect(registry.getByType('hairpin-endpoint')).toEqual([])
  })

  it('draws none when no hairpin is selected', () => {
    const { svg } = paint(null)
    expect(svg.querySelectorAll('rect.hairpin-endpoint-handle')).toHaveLength(0)
  })

  it('draws none for a hairpin that is not the selected one', () => {
    const { svg } = paint('H2')
    expect(svg.querySelectorAll('rect.hairpin-endpoint-handle')).toHaveLength(0)
  })

  it('the squares come off with the rest of the highlight layer', () => {
    const { svg, highlight } = paint('H1')
    highlight.clearHighlights()
    expect(svg.querySelectorAll('rect.hairpin-endpoint-handle')).toHaveLength(0)
  })
})

describe('one painter, four kinds', () => {
  it.each<EndpointHandleKind>(['hairpin', 'ottava', 'pedal', 'trill'])(
    'a %s square carries its own class and registers under its own id field', kind => {
      const registry = new ElementRegistry()
      const engine = { getElementRegistry: () => registry } as unknown as MusicEngine
      const canvas = document.createElement('div')
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      canvas.appendChild(svg)
      const highlight = new HighlightController(() => engine, () => canvas, createEditorState())

      paintEndpointHandles(highlight.context()!, kind, { id: 'M1', endpoint: 'start' }, [
        { which: 'start', x: 10, y: 20 },
        { which: 'end', x: 90, y: 20 },
      ])

      expect(svg.querySelectorAll(`rect.${kind}-endpoint-handle`)).toHaveLength(2)
      expect(svg.querySelectorAll(`rect.${kind}-endpoint-handle--selected`)).toHaveLength(1)
      const entries = registry.getByType(`${kind}-endpoint`)
      expect(entries.map(e => [e[`${kind}Id`], e.endpoint, e.id])).toEqual([
        ['M1', 'start', undefined], ['M1', 'end', undefined],
      ])

      highlight.clearHighlights()
      expect(svg.querySelectorAll('rect')).toHaveLength(0)
      expect(registry.getByType(`${kind}-endpoint`)).toEqual([])
    })
})
