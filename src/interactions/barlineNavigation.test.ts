// @vitest-environment jsdom
/**
 * ←/→ on a selected barline walks to the previous/next one — dispatched on WHAT IS SELECTED, the
 * same seam `Shift+Alt+←/→` uses to mean note spacing on a note and bar width on a barline.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MusicEngine } from '@/engine/MusicEngine'
import { SelectionController } from './SelectionController'
import { createEditorState } from './EditorState'
import type { EditorState } from './EditorState'
import type { Rect } from '@/engine/ViewportModel'

describe('barline navigation', () => {
  let engine: MusicEngine
  let state: EditorState
  let selection: SelectionController
  let revealed: Rect[]
  let renders: number

  beforeEach(() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    engine = new MusicEngine({ container, width: 900, height: 500 })
    while (engine.getScore().measures.length < 6) engine.addMeasure()
    engine.renderScore()
    state = createEditorState()
    revealed = []
    renders = 0
    selection = new SelectionController(
      () => engine,
      state,
      (rect: Rect) => revealed.push(rect),
      () => { renders++ },
    )
  })

  it('declines when no barline is selected — the arrow belongs to note navigation', () => {
    expect(selection.navigateBarline(1)).toBe(false)
    expect(renders).toBe(0)
  })

  it('⭐ walks forward and back, naming the measure each barline ENDS', () => {
    state.selectedBarlineMeasure = 3
    expect(selection.navigateBarline(1)).toBe(true)
    expect(state.selectedBarlineMeasure).toBe(4)
    expect(selection.navigateBarline(-1)).toBe(true)
    expect(state.selectedBarlineMeasure).toBe(3)
  })

  it('re-renders, because the highlight is applied post-render (and that is what clears the old one)', () => {
    state.selectedBarlineMeasure = 2
    selection.navigateBarline(1)
    expect(renders).toBe(1)
  })

  it('scrolls the destination into view', () => {
    state.selectedBarlineMeasure = 1
    selection.navigateBarline(1)
    expect(revealed).toHaveLength(1)
  })

  it('⭐ CLAMPS at both ends rather than letting go of the selection', () => {
    // Note navigation deselects when it runs off the end; a barline must not. You are usually
    // holding one because you are working on it, and an arrow that means "no further" should not
    // cost you the selection.
    state.selectedBarlineMeasure = 6 // the last measure
    expect(selection.navigateBarline(1)).toBe(true) // consumed…
    expect(state.selectedBarlineMeasure).toBe(6)    // …and still held
    expect(renders).toBe(0)                         // nothing moved, nothing repainted

    state.selectedBarlineMeasure = 1
    expect(selection.navigateBarline(-1)).toBe(true)
    expect(state.selectedBarlineMeasure).toBe(1)
  })
})
