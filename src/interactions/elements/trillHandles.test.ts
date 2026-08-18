import { describe, it, expect, beforeEach } from 'vitest'
import {
  trillEndpointHandles, armTrillEndpointAt, cycleTrillEndpoint,
  TRILL_HANDLE_GAP_PX as GAP,
} from './trillHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected trill's two endpoint squares sit.
 *
 * Subject: {@link trillHandles}, sitting beside this file. The REGISTRY is the fixture, the pedal's
 * and the bracket's arrangement next door — the drawn band is what `TrillRenderer` measured, so with
 * it handed in the answer is ordinary arithmetic rather than a glyph measurement (jsdom measures
 * none: `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is
 * `HighlightController`'s.
 */

/** One drawn FRAGMENT as the renderer registers it: the band from the `tr` to the line's end.
 *
 *  ⚠️ The band is deliberately NOT symmetric about the baseline — the `tr`'s ink runs 1.6 staff
 *  spaces up and 0.1 down (`TRILL_MARK_INK`) — so a handle reading the baseline rather than the
 *  band's middle lands somewhere else. */
const piece = (x0: number, x1: number, top: number, bottom: number, id = 'T1'): ElementInfo => ({
  type: 'trill',
  id,
  bbox: { x: x0, y: top, width: x1 - x0, height: bottom - top },
  points: [
    { x: x0, y: top },
    { x: x1, y: top },
    { x: x1, y: bottom },
    { x: x0, y: bottom },
  ],
} as ElementInfo)

/** One unbroken trill: `tr` at 100, wiggle running to 300, baseline 100 (ink 84…101). */
const TRILL = () => piece(100, 300, 84, 101)

describe('trillEndpointHandles', () => {
  it('⭐ steps each square OUTWARD — the AIR, so neither sits on the `tr` or the last wiggle', () => {
    expect(trillEndpointHandles([TRILL()], 'T1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92.5 },
      { which: 'end', x: 300 + GAP, y: 92.5 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre: the
    // squares are 6px half-side (`SLUR_HANDLE_R + 1`), so anything at or under 6 overlaps.
    expect(GAP).toBeGreaterThan(6)
  })

  it('⚠️ takes the two ends from DIFFERENT fragments when the trill crosses a system break', () => {
    // The continuation restarts at its own system's left margin — reading both ends off one entry
    // would draw the second square in the wrong system.
    expect(trillEndpointHandles([
      piece(600, 780, 84, 101),    // first system, runs to the right margin
      piece(80, 300, 484, 501),    // next system, from the left margin
    ], 'T1')).toEqual([
      { which: 'start', x: 600 - GAP, y: 92.5 },
      { which: 'end', x: 300 + GAP, y: 492.5 },
    ])
  })

  it('⭐ both squares ride the BAND\'S MIDDLE, not its top or its baseline', () => {
    // The band is asymmetric about the baseline by construction, so reading either edge is visibly
    // different from reading the middle — this pins which one.
    expect(trillEndpointHandles([piece(100, 300, 60, 100)], 'T1').map(h => h.y)).toEqual([80, 80])
  })

  it('ignores another trill\'s fragments entirely', () => {
    const other = piece(10, 40, 84, 101, 'T2')
    expect(trillEndpointHandles([other, TRILL()], 'T1').map(h => h.x)).toEqual([100 - GAP, 300 + GAP])
  })

  it('draws nothing for an ornament that is not on screen', () => {
    expect(trillEndpointHandles([], 'T1')).toEqual([])
  })
})

/** A registry holding one drawn trill plus the two squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(TRILL())
  for (const h of trillEndpointHandles(registry.getByType('trill'), 'T1')) {
    registry.add({
      type: 'trill-endpoint', trillId: 'T1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armTrillEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'trill', id: 'T1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armTrillEndpointAt(state, registry, 300 + GAP, 92.5)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    const before = state.selectedElement
    armTrillEndpointAt(state, registry, 100 - GAP, 92.5)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1', endpoint: 'start' })
  })

  it('a press on the wiggle itself DECLINES, so the chain gets it', () => {
    expect(armTrillEndpointAt(state, registry, 200, 92.5)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1' })
  })

  it('⛔ does not answer for a PEDAL\'s squares — the families read their own type', () => {
    registry.add({
      type: 'pedal-endpoint', pedalId: 'P1', endpoint: 'end',
      bbox: { x: 491, y: 83, width: 18, height: 18 },
    } as ElementInfo)
    expect(armTrillEndpointAt(state, registry, 500, 92)).toBe(false)
  })

  it('declines when no squares are drawn (no trill selected, so none registered)', () => {
    expect(armTrillEndpointAt(state, new ElementRegistry(), 100, 92)).toBe(false)
  })
})

describe('cycleTrillEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cycleTrillEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'trill', id: 'T1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'trill', id: 'T1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('declines with no trill selected, leaving Tab to the other walks (then the browser)', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    expect(walk(1)).toBe(false)
  })

  it('declines when the ornament is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'trill', id: 'T1' })
  })
})
