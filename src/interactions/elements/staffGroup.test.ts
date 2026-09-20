// @vitest-environment jsdom
/**
 * What a selected GROUPING SIGN paints — the `highlight` row of {@link STAFF_GROUP_ELEMENT}: the
 * sign's own ink recoloured on every system, and the two resize squares with the entries a press
 * finds them by. WHERE the squares sit is `./staffGroupHandles`' own spec.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../HighlightController'
import { createEditorState } from '../EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import { STAFF_GROUP_ELEMENT } from './staffGroup'

const SVG_NS = 'http://www.w3.org/2000/svg'
// jsdom has no `CSS`; the ids here need no escaping.
;(globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s }

function paint(staffCount: number) {
  const registry = new ElementRegistry()
  registry.add({ type: 'staffGroupSign', id: 'g1', bbox: { x: 20, y: 100, width: 10, height: 200 } })
  const engine = {
    getElementRegistry: () => registry,
    getScore: () => ({ staves: Array.from({ length: staffCount }, (_, i) => ({ id: `s${i}` })) }),
  } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS(SVG_NS, 'svg')
  canvas.appendChild(svg)
  // The sign as two systems draw it, and a second group that must stay black.
  const signs = ['sys0-g1', 'sys1-g1', 'sys0-g2'].map(id => {
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', 'systemsign')
    g.setAttribute('id', id)
    g.appendChild(document.createElementNS(SVG_NS, 'rect'))
    svg.appendChild(g)
    return g.firstElementChild!
  })

  const state = createEditorState()
  state.selectedElement = { kind: 'staffGroup', groupId: 'g1', symbol: 'bracket' }
  const highlight = new HighlightController(() => engine, () => canvas, state)
  STAFF_GROUP_ELEMENT.highlight(highlight.context()!)
  return { svg, registry, highlight, signs }
}

describe('a selected grouping sign', () => {
  it('recolours its own ink on EVERY system, and no other group’s', () => {
    const { signs } = paint(3)
    expect(signs.map(el => el.getAttribute('fill'))).toEqual([ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_FILL, null])
  })

  it('draws the two resize squares and registers which END each is', () => {
    const { svg, registry } = paint(3)
    expect(svg.querySelectorAll('rect.staff-group-handle')).toHaveLength(2)
    expect(registry.getByType('staff-group-handle').map(h => [h.id, h.staff])).toEqual([['g1', 0], ['g1', 1]])
  })

  it('⛔ no squares on a one-staff system — the ink still lights', () => {
    const { svg, signs } = paint(1)
    expect(svg.querySelectorAll('rect.staff-group-handle')).toHaveLength(0)
    expect(signs[0].getAttribute('fill')).toBe(ELEMENT_SELECTION_FILL)
  })

  it('the colour and the squares come off with the highlight layer', () => {
    const { svg, registry, highlight, signs } = paint(3)
    highlight.clearHighlights()
    expect(registry.getByType('staff-group-handle')).toEqual([])
    expect(signs[0].getAttribute('fill')).toBeNull()
    expect(svg.querySelectorAll('rect.staff-group-handle')).toHaveLength(0)
  })
})
