// @vitest-environment jsdom
/**
 * The barline selection highlight is PAINTED — our own mark at a position the registry knows —
 * rather than recoloured onto VexFlow's engraved rects. Every bug this had was a *finding* failure:
 * one barline is two drawn rects, the second is not always in the next measure's group, and a
 * reused measure carries a `translate` that makes its rects' own coordinates stale.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '@/engine/MusicEngine'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import type { EditorState } from './EditorState'

describe('barline selection highlight', () => {
  let engine: MusicEngine
  let container: HTMLElement
  let state: EditorState
  let highlight: HighlightController

  const marks = () => [...container.querySelectorAll('rect.selected-barline')]

  /** Does the painted mark cover the engraved barline? The line VexFlow draws spans
   *  [noteEndX, noteEndX + 1]; a mark that merely touches it leaves black showing, which IS the
   *  reported symptom, so coverage — not a centre-point — is the thing to assert. */
  const covers = (mark: Element, noteEndX: number): boolean => {
    const left = Number(mark.getAttribute('x'))
    const right = left + Number(mark.getAttribute('width'))
    return left <= noteEndX && right >= noteEndX + 1
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 24) engine.addMeasure()
    engine.renderScore()
    state = createEditorState()
    highlight = new HighlightController(() => engine, () => container, state)
  })

  it('marks nothing when no barline is selected', () => {
    highlight.applyBarlineSelectionHighlight()
    expect(marks()).toHaveLength(0)
  })

  it('⭐ lands on the barline the REGISTRY reports, not on a coordinate read off the DOM', () => {
    // The registry is offset-corrected for measures that were moved without being redrawn; the
    // rects' own x is not. Asserting against the registry is asserting the thing that was wrong.
    for (const measure of [1, 5, 12, 20]) {
      highlight.clearHighlights()
      state.selectedElement = { kind: 'barline', measure: measure }
      highlight.applyBarlineSelectionHighlight()
      const geometry = engine.getElementRegistry().getStaffGeometry(measure, 0)!
      expect(marks()).toHaveLength(1)
      expect(covers(marks()[0], geometry.noteEndX)).toBe(true)
    }
  })

  it('⭐ survives a width change that MOVES neighbouring bars without redrawing them', () => {
    // The reported bug, stated as its cause: stretch a bar, and the bars after it are reused and
    // translated. A recolour read their stale rect coordinates and left half the barline black.
    state.selectedElement = { kind: 'barline', measure: 12 }
    engine.setBarWidth(3, 4.5)
    engine.renderScore()
    highlight.clearHighlights()
    highlight.applyBarlineSelectionHighlight()
    const geometry = engine.getElementRegistry().getStaffGeometry(12, 0)!
    expect(marks()).toHaveLength(1)
    expect(covers(marks()[0], geometry.noteEndX)).toBe(true)
  })

  it('⭐ states stroke:none — a rect INHERITS the score root\'s black stroke, and a stroke adds weight', () => {
    // Two bugs in one line. Unsaid, the mark comes out orange inside a black outline. Stroked in
    // the fill colour, it is the right colour but straddles the edge and draws fatter than every
    // other line on the page. The width has to be the whole of the geometry.
    state.selectedElement = { kind: 'barline', measure: 4 }
    highlight.applyBarlineSelectionHighlight()
    const mark = marks()[0]
    expect(mark.getAttribute('stroke')).toBe('none')
    expect(Number(mark.getAttribute('width'))).toBeLessThanOrEqual(2)
  })

  it('clears completely — the mark is a node we own, so removal is deleting it', () => {
    state.selectedElement = { kind: 'barline', measure: 4 }
    highlight.applyBarlineSelectionHighlight()
    expect(marks()).toHaveLength(1)
    highlight.clearHighlights()
    expect(marks()).toHaveLength(0)
  })
})
