// @vitest-environment jsdom
/**
 * The note an ARMED slur endpoint is anchored to wears the endpoint's blue.
 *
 * Subject: {@link HighlightController}, a chapter beside `HighlightController.test.ts` (slur
 * handles) and `.anchorLine.test.ts`. His ask, 2026-08-18: *"when reanchoring with keyboard we dont
 * highlight the note… that is the way to let know the user the new anchor"* — the drag has tinted
 * its candidate since it was written, and the keyboard re-anchor (`slurReanchor`) moved the arc with
 * nothing to say which note it had landed on. The candidate tint is gone now — the drag carries the
 * anchor live, so this one pass answers for both devices.
 *
 * ⚠️ Nothing here measures a glyph: the DOM is FABRICATED and the assertions are on which node got
 * recoloured (`reference_jsdom_cannot_measure_glyphs`). What is under test is the CHOICE of note —
 * start vs end vs none — not where any ink is.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState, type EditorState } from './EditorState'
import { ElementRegistry } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'

/** One `vf-stavenote` group per note id, and the head inside it we assert the colour on. */
function fabricateScore() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const heads = new Map<string, SVGElement>()
  const groups = new Map<string, SVGElement>()
  for (const id of ['N1', 'N2', 'N3']) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'vf-stavenote')
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    head.setAttribute('class', 'vf-notehead')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    head.appendChild(path)
    group.appendChild(head)
    svg.appendChild(group)
    heads.set(id, path)
    groups.set(id, group)
  }
  const canvas = document.createElement('div')
  canvas.appendChild(svg)

  const engine = {
    getSlurById: (id: string) => (id === 'S1' ? { id: 'S1', startNoteId: 'N1', endNoteId: 'N3' } : null),
    getStaveNoteSVGGroup: (id: string) => {
      const group = groups.get(id)
      return group ? { group, noteIndex: 0, stem: null } : null
    },
    getFanMemberSVGGroup: () => null,
    getElementById: () => null,
    getNote: () => null,
    getTieSVGGroup: () => null,
    getElementRegistry: () => new ElementRegistry(),
  } as unknown as MusicEngine

  return { canvas, engine, heads }
}

/** Run the pass over a fabricated score and report which of the three heads came out blue. */
function tintedBy(arm: (state: EditorState) => void): string[] {
  const { canvas, engine, heads } = fabricateScore()
  const state = createEditorState()
  arm(state)
  new HighlightController(() => engine, () => canvas, state).applyArmedSlurAnchorNote()
  return [...heads].filter(([, head]) => head.getAttribute('fill') === '#2563EB').map(([id]) => id)
}

describe('the armed slur endpoint’s anchor note', () => {
  it('tints the START note when the start square is armed — and only that note', () => {
    expect(tintedBy(s => { s.selectedElement = { kind: 'slur', id: 'S1', endpoint: 'start' } })).toEqual(['N1'])
  })

  it('tints the END note when the end square is armed', () => {
    // ⭐ The pair is the point: the tint answers "which end am I holding, and where is it attached",
    // so a slur whose two ends tinted the same note would say nothing at all.
    expect(tintedBy(s => { s.selectedElement = { kind: 'slur', id: 'S1', endpoint: 'end' } })).toEqual(['N3'])
  })

  it('tints nothing when the slur is selected but no square is armed', () => {
    // Selecting the ARC is not holding an endpoint: the arrows nudge nothing, so there is no anchor
    // being edited to point at (`elements/slur` — carrying no endpoint IS the disarm).
    expect(tintedBy(s => { s.selectedElement = { kind: 'slur', id: 'S1' } })).toEqual([])
  })

  it('⭐ serves the MOUSE too — there is no second tint for a drag any more', () => {
    // The drag used to paint a CANDIDATE (the note it would snap onto if released), because it
    // re-anchored by snapping and the ink jumped there. Since the drag became the same carried move
    // as the arrows there is no candidate distinct from the anchor — so a mid-drag frame paints
    // exactly this, and exactly once.
    expect(tintedBy(s => { s.selectedElement = { kind: 'slur', id: 'S1', endpoint: 'end' } })).toEqual(['N3'])
  })
})
