// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '../../engine/ElementRegistry'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import { paintSlurHandles } from '../elements/slurHandles'
import { paintSelectedNotes } from '../elements/notePaint'
import { paintMeasureBox } from '../elements/measureRange'

/**
 * P3 — the highlight layer must be REMOVABLE without a redraw (docs/history/render-performance-plan.md §5a).
 *
 * Highlights used to reset themselves by being wiped along with the SVG ("Safe: the next render
 * rebuilds the SVG"). Now that a selection change can skip the render entirely, `clearHighlights()`
 * is the only thing that takes them back off — so it has to be an exact inverse. The three ways a
 * highlight touches the DOM each get a test, including the one the plan flagged as a trap: a
 * recolour must restore the PREVIOUS colour, not delete the attribute (voice 2 is green by default,
 * so deleting `fill` would blacken it).
 */
describe('clearHighlights — the inverse of a highlight pass', () => {
  /** A minimal note-shaped SVG: `<g>` (the stavenote) → `<g class="notehead">` → `<text>`. */
  function noteGroup(svg: SVGSVGElement, fill: string | null): SVGGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    head.setAttribute('class', 'notehead')
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
      getFanMemberSVGGroup: () => null, // not a fanned member — the ordinary note path
      enclosure: { ownerOf: (id: string) => id }, // a head's brackets are filed under itself
      getTieSVGGroup: () => undefined, // this note ties to nothing (see the tie tests below)
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

    paintSelectedNotes(hc.context()!)
    expect(glyph.getAttribute('fill')).not.toBe('#22C55E') // painted in the selection colour

    hc.clearHighlights()
    expect(glyph.getAttribute('fill')).toBe('#22C55E')     // back to green, not black
    expect(glyph.style.fill).toBe('')
    expect(glyph.classList.contains('selected-note')).toBe(false)
  })

  it('a glyph that had NO fill attribute ends up with none again', () => {
    const { hc, glyph } = harness(null)

    paintSelectedNotes(hc.context()!)
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

    paintMeasureBox(hc.context()!) // no measure range selected → adds nothing
    paintSelectedNotes(hc.context()!)
    expect(svg.lastChild).toBe(group) // raised to the front

    hc.clearHighlights()
    expect([...svg.children]).toEqual(before) // same nodes, same order
  })

  it('is idempotent — clearing twice, or clearing a pass that painted nothing, is a no-op', () => {
    const { hc, glyph } = harness('#22C55E')
    paintSelectedNotes(hc.context()!)
    hc.clearHighlights()
    hc.clearHighlights()
    expect(glyph.getAttribute('fill')).toBe('#22C55E')
  })

  /**
   * Selecting a tied note lights its ARC too, so the score agrees with the Keypad (whose Enter key
   * lights for exactly this note's forward tie). The arc is a separate SVG group from the notehead,
   * so it takes its own pass — and `clearHighlights` still has to be an exact inverse of it.
   */
  it('drops the slur hit-boxes it registered, so a skipped render cannot accumulate them', () => {
    const { hc, registry } = harness('#000000')
    registry.add({
      type: 'slur', id: 'S1', bbox: { x: 0, y: 0, width: 0, height: 0 },
      controlPoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      slurEndpoints: { p0: { x: 0, y: 0 }, p1: { x: 9, y: 9 }, direction: 1 },
    })
    const state = createEditorState()
    state.selectedElement = { kind: 'slur', id: 'S1' }
    const hc2 = new HighlightController(
      () => ({ getElementRegistry: () => registry, getViewMode: () => 'wrapped' as ViewMode } as unknown as MusicEngine),
      () => { const c = document.createElement('div'); c.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); return c },
      state,
    )

    paintSlurHandles(hc2.context()!)
    expect(registry.getByType('slur-handle').length).toBe(2)
    expect(registry.getByType('slur-endpoint').length).toBe(2)

    hc2.clearHighlights()
    expect(registry.getByType('slur-handle').length).toBe(0)
    expect(registry.getByType('slur-endpoint').length).toBe(0)
    expect(registry.getByType('slur').length).toBe(1) // the engraved slur itself survives
    void hc
  })
})
