// @vitest-environment jsdom
/**
 * ⭐⭐ **WHAT COLOUR A SELECTED MARK PAINTS IN** — his call, 2026-08-19: *"8va, pedal and hairpin …
 * should have the color of tempo and dynamic … the case of the trill is not the same, a trill is
 * always associated to a note, so the trill has the color of the note voice it is anchored to"*.
 *
 * Subject: {@link HighlightController}, a chapter beside `.hairpin.test.ts` and `.anchorLine.test.ts`.
 * The question is a RULE, not a hex: a mark that governs a region takes the element ink, and only ink
 * that belongs to one voice's notes takes a voice colour (`utils/selectionColors`).
 *
 * ⚠️ jsdom draws nothing, so the engine hands back real (empty) SVG groups with one child each —
 * which is all the recolour touches. No geometry is asserted here; that is the browser suite's.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState, type SelectedElement } from './EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { ELEMENT_SELECTION_FILL } from '../utils/selectionColors'
import { voiceFillColor } from '../utils/voiceColors'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A group holding one `<path>` and one `<text>` — the two node kinds the recolours touch. */
function markGroup(): SVGGElement {
  const group = document.createElementNS(SVG_NS, 'g')
  group.appendChild(document.createElementNS(SVG_NS, 'path'))
  group.appendChild(document.createElementNS(SVG_NS, 'text'))
  return group
}

/**
 * Paint `selected` with an engine that answers for every mark kind, and return its group.
 *
 * ⚠️ `scope` is the SCOPE of the dynamic/hairpin the engine hands back — **omitted means the mark
 * has no `voice` at all**, i.e. it governs every voice of its staff, which is what the stamps write
 * (`utils/dynamicScope`). Passing `0` is a mark deliberately narrowed to voice 1, a different thing.
 */
function paint(
  selected: SelectedElement,
  opts: { anchorVoice?: 0 | 1 | 2 | 3; scope?: 0 | 1 | 2 | 3 } = {},
) {
  const group = markGroup()
  const scoped = { ...(opts.scope !== undefined ? { voice: opts.scope } : {}) }
  const engine = {
    getHairpinSVGGroup: () => group,
    getHairpinById: () => ({ id: 'H1', ...scoped }),
    getDynamicSVGGroup: () => group,
    getDynamicById: () => ({ id: 'D1', text: 'p', ...scoped }),
    getOttavaSVGGroup: () => group,
    getPedalSVGGroup: () => group,
    getTrillSVGGroup: () => group,
    getTrillById: () => ({ id: 'T1', startNoteId: 'n1', voice: 0 }),
    getNote: () => ({ id: 'n1', voice: opts.anchorVoice }),
    getElementRegistry: () => ({ getAll: () => [] }),
  } as unknown as MusicEngine

  const canvas = document.createElement('div')
  canvas.appendChild(document.createElementNS(SVG_NS, 'svg'))
  const state = createEditorState()
  state.selectedElement = selected

  const highlight = new HighlightController(() => engine, () => canvas, state)
  if (selected.kind === 'hairpin') highlight.applyHairpinSelectionHighlight()
  if (selected.kind === 'dynamic') highlight.applyDynamicSelectionHighlight()
  if (selected.kind === 'ottava') highlight.applyOttavaSelectionHighlight()
  if (selected.kind === 'pedal') highlight.applyPedalSelectionHighlight()
  if (selected.kind === 'trill') highlight.applyTrillSelectionHighlight()
  return group
}

const strokeOf = (g: SVGGElement) => g.querySelector('path')!.getAttribute('stroke')
const fillOf = (g: SVGGElement) => g.querySelector('text')!.getAttribute('fill')

describe('a mark that governs a REGION takes the element ink', () => {
  it('⭐ the HAIRPIN, when it governs every voice of its staff', () => {
    // The wedge is stroked, never filled (two open polylines), so the stroke is its ink.
    const group = paint({ kind: 'hairpin', id: 'H1' })
    expect(strokeOf(group)).toBe(ELEMENT_SELECTION_FILL)
    expect(strokeOf(group), 'not voice 1 blue').not.toBe(voiceFillColor(0))
  })

  it('⭐ the DYNAMIC, likewise', () => {
    expect(fillOf(paint({ kind: 'dynamic', id: 'D1' }))).toBe(ELEMENT_SELECTION_FILL)
  })

  it('⭐ the 8va — its bracket and its text', () => {
    const group = paint({ kind: 'ottava', id: 'O1' })
    expect(strokeOf(group)).toBe(ELEMENT_SELECTION_FILL)
    expect(fillOf(group)).toBe(ELEMENT_SELECTION_FILL)
  })

  it('⭐ the PEDAL — its two signs', () => {
    const group = paint({ kind: 'pedal', id: 'P1' })
    expect(fillOf(group)).toBe(ELEMENT_SELECTION_FILL)
    expect(fillOf(group), 'not voice 1 blue').not.toBe(voiceFillColor(0))
  })
})

describe('a mark that belongs to a NOTE takes that note’s voice colour', () => {
  it('⭐ the TRILL follows the voice of the note it is anchored to', () => {
    expect(fillOf(paint({ kind: 'trill', id: 'T1' }, { anchorVoice: 1 }))).toBe(voiceFillColor(1))
    expect(fillOf(paint({ kind: 'trill', id: 'T1' }, { anchorVoice: 2 }))).toBe(voiceFillColor(2))
  })

  it('…and falls back to voice 1 when the note carries no voice (absent = the first)', () => {
    expect(fillOf(paint({ kind: 'trill', id: 'T1' }))).toBe(voiceFillColor(0))
  })
})

/**
 * ⭐⭐ P2 of docs/dynamic-voice-scope-plan.md — for these two kinds the rule stops being a list and
 * becomes a question the model answers. ⚠️ Only these two: an 8va and a pedal have no voice field to
 * ask, and the trill asks its anchor note instead (both above, unchanged).
 */
describe('the DYNAMICS FAMILY asks its SCOPE, because it is the only kind that has one', () => {
  it('a wedge narrowed to a voice takes that voice’s colour', () => {
    expect(strokeOf(paint({ kind: 'hairpin', id: 'H1' }, { scope: 1 }))).toBe(voiceFillColor(1))
    expect(strokeOf(paint({ kind: 'hairpin', id: 'H1' }, { scope: 2 }))).toBe(voiceFillColor(2))
  })

  it('a dynamic narrowed to a voice takes that voice’s colour', () => {
    expect(fillOf(paint({ kind: 'dynamic', id: 'D1' }, { scope: 3 }))).toBe(voiceFillColor(3))
  })

  // 🚨 The distinction the old code could not make: `voice: 0` is a mark someone NARROWED to voice
  // 1, and absent is a mark that governs the staff. They must not paint alike.
  it('voice 0 is a NARROWED mark, not an unscoped one — and they differ', () => {
    const narrowed = strokeOf(paint({ kind: 'hairpin', id: 'H1' }, { scope: 0 }))
    const all = strokeOf(paint({ kind: 'hairpin', id: 'H1' }))
    expect(narrowed).toBe(voiceFillColor(0))
    expect(narrowed).not.toBe(all)
  })
})
