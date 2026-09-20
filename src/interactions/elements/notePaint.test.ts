// @vitest-environment jsdom
/**
 * The NOTE pass — {@link paintSelectedNotes} — and what a selected note lights BESIDES its head and
 * stem: the tie it owns and the tremolo it carries, each through its own kind's painter; and the
 * fanned member, whose ink is one group of ours. That the layer comes OFF again exactly is
 * `HighlightController.test.ts`'s; the cases here that clear are about THIS ink's inverse.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ViewMode } from '@/engine/layout/layoutConfig'
import type { TremoloMark } from '@/types/music'
import { paintSelectedNotes } from './notePaint'
import { TREMOLO_ELEMENT } from './tremolo'

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

describe('a selected note lights the tie it owns', () => {
  /** `<g class="tie">` → the two paths renderCurve emits (it strokes AND fills). */
  function tieGroup(svg: SVGSVGElement): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'tie')
    for (const [attr, value] of [['fill', 'none'], ['stroke', 'none']] as const) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute(attr, value)
      g.appendChild(path)
    }
    svg.appendChild(g)
    return g
  }

  /** As `harness`, plus a tie owned by the selected note (or by nobody, when `tied` is false). */
  function tieHarness(tied: boolean) {
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)
    const group = noteGroup(svg, '#000000')
    const tie = tieGroup(svg)

    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 0 }),
      getElementById: () => ({ type: 'note' }),
      getStaveNoteSVGGroup: () => ({ group, noteIndex: 0, stem: null }),
    getFanMemberSVGGroup: () => null, // not a fanned member — the ordinary note path
      // Keyed by the FROM note: a note that ties to nothing has no group.
      getTieSVGGroup: (id: string) => (tied && id === 'N1' ? tie : undefined),
    } as unknown as MusicEngine

    const state = createEditorState()
    state.selectedItems.set('N1', { kind: 'note', id: 'N1' })
    return { hc: new HighlightController(() => engine, () => canvas, state), tie }
  }

  it('paints BOTH paths — renderCurve strokes and fills, so one alone leaves a black outline', () => {
    const { hc, tie } = tieHarness(true)
    paintSelectedNotes(hc.context()!)
    for (const path of Array.from(tie.querySelectorAll('path'))) {
      expect(path.getAttribute('fill')).toBe('#3B82F6')   // voice-0 blue, as the notehead
      expect(path.getAttribute('stroke')).toBe('#3B82F6')
    }
  })

  it('restores the arc exactly, including the none/none the two paths started with', () => {
    const { hc, tie } = tieHarness(true)
    paintSelectedNotes(hc.context()!)
    hc.clearHighlights()
    const paths = Array.from(tie.querySelectorAll('path'))
    expect(paths[0].getAttribute('fill')).toBe('none')
    expect(paths[1].getAttribute('stroke')).toBe('none')
    expect(paths.some(p => p.classList.contains('selected-tie'))).toBe(false)
  })

  it('paints nothing when the selected note ties to nothing', () => {
    const { hc, tie } = tieHarness(false)
    paintSelectedNotes(hc.context()!)
    for (const path of Array.from(tie.querySelectorAll('path'))) {
      expect(path.getAttribute('fill')).not.toBe('#3B82F6')
      expect(path.getAttribute('stroke')).not.toBe('#3B82F6')
    }
  })
})

/**
 * A selected note lights its TREMOLO too — head + stem + accidental + articulations + dots + tie +
 * mark. The strokes are found by GLYPH CHARACTER inside the note's group (they are `<text>`
 * elements, one per stroke, sharing the tremolo codepoint), which is what lets one lookup cover a
 * stack of five without a box per glyph.
 */
describe('a selected note lights the tremolo it carries', () => {
  /** As `harness`, plus `strokes` tremolo glyphs drawn in the note's group, and a decoy glyph. */
  function tremoloHarness(mark: TremoloMark | undefined, strokes: number) {
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)
    const group = noteGroup(svg, '#000000')
    const glyph = mark === 'penderecki' ? '\uE22B' : '\uE220'
    for (let i = 0; i < strokes; i++) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.textContent = glyph
      text.setAttribute('fill', '#000000')
      group.appendChild(text)
    }
    // A sharp in the same group: the character match must not touch it.
    const decoy = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    decoy.textContent = '\uE262' // an accidental
    decoy.setAttribute('fill', '#000000')
    group.appendChild(decoy)

    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 0, tremolo: mark }),
      getElementById: () => ({ type: 'note' }),
      getStaveNoteSVGGroup: () => ({ group, noteIndex: 0, stem: null }),
    getFanMemberSVGGroup: () => null, // not a fanned member — the ordinary note path
      getTieSVGGroup: () => undefined,
    } as unknown as MusicEngine

    const state = createEditorState()
    state.selectedItems.set('N1', { kind: 'note', id: 'N1' })
    const hc = new HighlightController(() => engine, () => canvas, state)
    // Counts STROKES only — filtered by the glyph, because the notehead in the same group is
    // painted the same blue by the note highlight and would otherwise be counted as a stroke.
    const painted = () => Array.from(group.querySelectorAll('text'))
      .filter(t => t.textContent === glyph && t.getAttribute('fill') === '#3B82F6')
    return { hc, painted, decoy, state }
  }

  it('paints EVERY stroke of the stack, and only the strokes', () => {
    const { hc, painted, decoy } = tremoloHarness(3, 3)
    paintSelectedNotes(hc.context()!)
    expect(painted().length).toBe(3)
    expect(decoy.getAttribute('fill')).toBe('#000000') // the accidental beside it is untouched
  })

  it('the Penderecki sign lights the same way — one glyph, same lookup', () => {
    const { hc, painted } = tremoloHarness('penderecki', 1)
    paintSelectedNotes(hc.context()!)
    expect(painted().length).toBe(1)
  })

  it('paints nothing when the note carries no mark', () => {
    const { hc, painted } = tremoloHarness(undefined, 2) // glyphs drawn, but the note has no tremolo
    paintSelectedNotes(hc.context()!)
    expect(painted().length).toBe(0)
  })

  it('clearHighlights is an exact inverse over the whole stack', () => {
    const { hc, painted } = tremoloHarness(4, 4)
    paintSelectedNotes(hc.context()!)
    expect(painted().length).toBe(4)
    hc.clearHighlights()
    expect(painted().length).toBe(0)
  })

  it('selecting the MARK alone lights the same strokes (the shared colouring pass)', () => {
    const { hc, painted, state } = tremoloHarness(2, 2)
    state.selectedItems.clear()
    state.selectedElement = { kind: 'tremolo', noteId: 'N1' }
    TREMOLO_ELEMENT.highlight(hc.context()!)
    expect(painted().length).toBe(2)
  })
})

/**
 * ⭐ A SELECTED FANNED MEMBER (docs/plans/fanned-beam-pitches-plan.md §2 P3) — its ink is ours, drawn into
 * one group, so the highlight is an ordinary recolour rather than a painted rectangle.
 *
 * ⚠️ What is really pinned here is the fill/stroke split: **a glyph is filled, never stroked.**
 * Giving the accidental a stroke as well as a fill outlines it, and an outlined glyph reads as BOLD
 * — which is exactly how it looked (his report).
 */
describe('the fanned-member highlight', () => {
  function memberHarness() {
    const canvas = document.createElement('div')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.appendChild(svg)

    // What `drawFannedBeams` paints into one member's group: a notehead subgroup, the accidental
    // glyph as a direct `<text>`, and the stem + ledger line as direct `<path>`s.
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'fanhead')
    const headGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    headGroup.setAttribute('class', 'notehead')
    const headGlyph = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    headGroup.appendChild(headGlyph)
    const accidental = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    group.append(headGroup, accidental, stem)
    svg.appendChild(group)

    const engine = {
      getElementRegistry: () => new ElementRegistry(),
      getViewMode: () => 'wrapped' as ViewMode,
      getNote: () => ({ voice: 0 }),
      getElementById: () => ({ type: 'note' }),
      getStaveNoteSVGGroup: () => null,
      getFanMemberSVGGroup: () => ({ group, noteIndex: 0 }),
      getTieSVGGroup: () => undefined,
    } as unknown as MusicEngine

    const state = createEditorState()
    state.selectedItems.set('M1', { kind: 'note', id: 'M1' })
    const hc = new HighlightController(() => engine, () => canvas, state)
    return { hc, group, headGlyph, accidental, stem }
  }

  it('⭐ fills the ACCIDENTAL and never strokes it — a stroked glyph reads as bold', () => {
    const { hc, accidental } = memberHarness()
    paintSelectedNotes(hc.context()!)
    expect(accidental.getAttribute('fill')).toBeTruthy()
    expect(accidental.getAttribute('stroke')).toBeNull()
  })

  it('fills the notehead and strokes the stem — the same split as an ordinary note', () => {
    const { hc, headGlyph, stem } = memberHarness()
    paintSelectedNotes(hc.context()!)
    expect(headGlyph.getAttribute('fill')).toBeTruthy()
    expect(headGlyph.getAttribute('stroke')).toBeNull()
    expect(stem.getAttribute('stroke')).toBeTruthy()
  })

  it('clearHighlights is an exact inverse here too', () => {
    const { hc, accidental, stem, headGlyph } = memberHarness()
    paintSelectedNotes(hc.context()!)
    hc.clearHighlights()
    for (const el of [accidental, stem, headGlyph]) {
      expect(el.getAttribute('fill')).toBeNull()
      expect(el.getAttribute('stroke')).toBeNull()
      expect(el.classList.contains('selected-note')).toBe(false)
    }
  })
})
