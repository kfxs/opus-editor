// @vitest-environment jsdom
/**
 * Subject: `./enclosure` — a PARENTHESISED head's brackets lit with their selected note
 * (parenthesised-note-plan P4), through the NOTE pass (`./notePaint`), and put back on clear.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import { ENCLOSURE_PAIR_GROUP, enclosurePairId } from '@/engine/rendering/EnclosurePass'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import { paintSelectedNotes } from './notePaint'
import { HEAD_ENCLOSURE_ELEMENT, paintSelectedEnclosure } from './enclosure'

const NS = 'http://www.w3.org/2000/svg'

function harness(selected: string) {
  const canvas = document.createElement('div')
  const svg = document.createElementNS(NS, 'svg')
  canvas.appendChild(svg)
  // The note: `<g>` → `<g class="notehead">` → `<text>`.
  const group = document.createElementNS(NS, 'g')
  const head = document.createElementNS(NS, 'g')
  head.setAttribute('class', 'notehead')
  head.appendChild(document.createElementNS(NS, 'text'))
  group.appendChild(head)
  svg.appendChild(group)
  // Two heads' pairs — N1's and N2's — each `(` and `)`.
  const pair = (id: string) => {
    const g = document.createElementNS(NS, 'g')
    g.setAttribute('class', ENCLOSURE_PAIR_GROUP)
    g.setAttribute('id', enclosurePairId(id))
    for (let i = 0; i < 2; i++) {
      const t = document.createElementNS(NS, 'text')
      t.setAttribute('fill', '#000000')
      g.appendChild(t)
    }
    svg.appendChild(g)
    return g
  }
  const mine = pair('N1')
  const other = pair('N2')
  const engine = {
    getElementRegistry: () => new ElementRegistry(),
    getViewMode: () => 'wrapped' as ViewMode,
    getNote: () => ({ voice: 0 }),
    getElementById: () => ({ type: 'note' }),
    getStaveNoteSVGGroup: () => ({ group, noteIndex: 0, stem: null }),
    getFanMemberSVGGroup: () => null,
    enclosure: { ownerOf: (id: string) => id }, // a head's brackets are filed under itself
    getTieSVGGroup: () => undefined,
  } as unknown as MusicEngine
  const state = createEditorState()
  state.selectedItems.set(selected, { kind: 'note', id: selected })
  return { hc: new HighlightController(() => engine, () => canvas, state), mine, other }
}

const fills = (g: Element) => Array.from(g.querySelectorAll('text')).map(t => t.getAttribute('fill'))

describe('a selected note lights its brackets', () => {
  it('⭐ both of ITS brackets in its voice colour — ⛔ not another head\'s', () => {
    const { hc, mine, other } = harness('N1')
    paintSelectedNotes(hc.context()!)
    expect(fills(mine)).toEqual(['#3B82F6', '#3B82F6'])
    expect(fills(other)).toEqual(['#000000', '#000000'])
  })

  it('puts them back on clear', () => {
    const { hc, mine } = harness('N1')
    paintSelectedNotes(hc.context()!)
    hc.clearHighlights()
    expect(fills(mine)).toEqual(['#000000', '#000000'])
  })

  it('a bare head has no pair: nothing is painted', () => {
    const { hc, mine, other } = harness('N3')
    paintSelectedNotes(hc.context()!)
    expect([...fills(mine), ...fills(other)].every(f => f === '#000000')).toBe(true)
  })
})

describe('the brackets on their own — the `headEnclosure` kind', () => {
  it('⭐ selected alone, they light in the voice colour; the note\'s head does not', () => {
    const { hc, mine } = harness('none')
    const ctx = hc.context()!
    ctx.state.selectedItems = new Map()
    ctx.state.selectedElement = { kind: 'headEnclosure', noteId: 'N1' }
    paintSelectedEnclosure(ctx)
    expect(fills(mine)).toEqual(['#3B82F6', '#3B82F6'])
  })

  /** A registry with one head at x = 100 and its `)` box 12 px right of it. */
  function hitHarness() {
    const registry = new ElementRegistry()
    registry.add({ type: 'note', id: 'N1', measure: 1, staff: 0, headX: 100, bbox: { x: 94, y: 95, width: 12, height: 10 } })
    registry.add({ type: 'headEnclosure', noteId: 'N1', measure: 1, staff: 0, bbox: { x: 115, y: 90, width: 6, height: 20 } })
    const picked: unknown[] = []
    const deps = { pick: (el: unknown) => { picked.push(el); return true as const } }
    const at = (x: number, y: number) =>
      HEAD_ENCLOSURE_ELEMENT.hit({ registry, x, y, engine: {} } as never, deps as never)
    return { at, picked }
  }

  it('⭐ a press on the bracket selects the brackets', () => {
    const { at, picked } = hitHarness()
    expect(at(118, 100)).toBe(true)
    expect(picked).toEqual([{ kind: 'headEnclosure', noteId: 'N1' }])
  })

  it('a press nearer the HEAD is the note\'s, and anywhere else is nobody\'s', () => {
    const { at, picked } = hitHarness()
    expect(at(104, 100)).toBe(false)
    expect(at(300, 100)).toBe(false)
    expect(picked).toEqual([])
  })
})
