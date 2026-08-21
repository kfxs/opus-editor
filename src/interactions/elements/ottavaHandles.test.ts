import { describe, it, expect, beforeEach } from 'vitest'
import {
  ottavaEndpointHandles, armOttavaEndpointAt, cycleOttavaEndpoint,
  OTTAVA_HANDLE_GAP_PX as GAP,
} from './ottavaHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected ottava's two endpoint squares sit.
 *
 * Subject: {@link ottavaHandles}, sitting beside this file. The REGISTRY is the fixture, the
 * hairpin's arrangement next door — `ottavaAxis` is what `OttavaRenderer` measured, so with it
 * handed in the answer is ordinary arithmetic rather than a glyph measurement (jsdom measures none:
 * `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is `HighlightController`'s.
 */

/**
 * One drawn fragment as the renderer registers it.
 *
 * ⚠️ The BAND and the AXIS are given separately and deliberately do not agree: the numeral's ink box
 * is the band, and the dashed line rides its top under an 8va and its foot under an 8vb. Every
 * fixture here keeps them apart so a handle reading the band's midpoint fails.
 */
const piece = (
  startX: number,
  endX: number,
  lineY: number,
  band: { top: number; bottom: number },
): ElementInfo => ({
  type: 'ottava',
  id: 'O1',
  bbox: { x: startX, y: band.top, width: endX - startX, height: band.bottom - band.top },
  points: [
    { x: startX, y: band.top },
    { x: endX, y: band.top },
    { x: endX, y: band.bottom },
    { x: startX, y: band.bottom },
  ],
  ottavaAxis: { y: lineY, startX, endX },
} as ElementInfo)

/** An 8va: baseline 100, ink from 84 to 101, its line along the numeral's TOP. */
const alta = (startX = 100, endX = 300) => piece(startX, endX, 92, { top: 84, bottom: 101 })
/** An 8vb: the same numeral, its line along the numeral's FOOT — 7.5px off the band's middle. */
const bassa = (startX = 100, endX = 300) => piece(startX, endX, 100, { top: 84, bottom: 101 })

describe('ottavaEndpointHandles', () => {
  it('⭐ puts both squares on the BRACKET\'S LINE, not on the band\'s midpoint', () => {
    expect(ottavaEndpointHandles([alta()], 'O1').map(h => h.y)).toEqual([92, 92])
    // ⭐⭐ THE BREAK-TEST FOR THE WHOLE FIELD: an 8vb's band is identical to an 8va's (a glyph grows
    // the same way from its baseline either side), so a handle reading `(top + bottom) / 2` would
    // pass the case above and put both squares 7.5px above the line here. Only the measured axis
    // separates the two.
    expect(ottavaEndpointHandles([bassa()], 'O1').map(h => h.y)).toEqual([100, 100])
    expect((84 + 101) / 2).not.toBe(100)
  })

  it('⭐ steps each square OUTWARD — the AIR, so neither sits on the numeral or the hook', () => {
    expect(ottavaEndpointHandles([alta(100, 300)], 'O1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92 },
      { which: 'end', x: 300 + GAP, y: 92 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre: the
    // squares are 6px half-side (`SLUR_HANDLE_R + 1`), so anything at or under 6 overlaps.
    expect(GAP).toBeGreaterThan(6)
  })

  it('⚠️ takes the two ends from DIFFERENT fragments when the bracket crosses a system break', () => {
    // The continuation restarts at its own system's left margin — reading both ends off one entry
    // would draw the second square in the wrong system.
    expect(ottavaEndpointHandles([
      piece(600, 780, 92, { top: 84, bottom: 101 }),   // first system, runs to the right margin
      piece(80, 300, 492, { top: 484, bottom: 501 }),  // next system, from the left margin
    ], 'O1')).toEqual([
      { which: 'start', x: 600 - GAP, y: 92 },
      { which: 'end', x: 300 + GAP, y: 492 },
    ])
  })

  it('ignores another ottava\'s fragments entirely', () => {
    const other = { ...alta(10, 40), id: 'O2' } as ElementInfo
    expect(ottavaEndpointHandles([other, alta(100, 300)], 'O1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92 },
      { which: 'end', x: 300 + GAP, y: 92 },
    ])
  })

  it('draws nothing for a bracket that is not on screen, and nothing for a fragment with no axis', () => {
    expect(ottavaEndpointHandles([], 'O1')).toEqual([])
    const noAxis = { type: 'ottava', id: 'O1', bbox: { x: 0, y: 0, width: 10, height: 10 } } as ElementInfo
    expect(ottavaEndpointHandles([noAxis], 'O1')).toEqual([])
  })
})

/** A registry holding one drawn bracket plus the two squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(alta(100, 300))
  for (const h of ottavaEndpointHandles(registry.getByType('ottava'), 'O1')) {
    registry.add({
      type: 'ottava-endpoint', ottavaId: 'O1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armOttavaEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'ottava', id: 'O1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armOttavaEndpointAt(state, registry, 300 + GAP, 92)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'ottava', id: 'O1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    const before = state.selectedElement
    armOttavaEndpointAt(state, registry, 100 - GAP, 92)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'ottava', id: 'O1', endpoint: 'start' })
  })

  it('a press between the squares — on the bracket itself — DECLINES, so the chain gets it', () => {
    expect(armOttavaEndpointAt(state, registry, 200, 92)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'ottava', id: 'O1' })
  })

  it('⛔ does not answer for a HAIRPIN\'s squares — the two families read their own type', () => {
    registry.add({
      type: 'hairpin-endpoint', hairpinId: 'H1', endpoint: 'end',
      bbox: { x: 491, y: 83, width: 18, height: 18 },
    } as ElementInfo)
    expect(armOttavaEndpointAt(state, registry, 500, 92)).toBe(false)
  })

  it('declines when no squares are drawn (no ottava selected, so none registered)', () => {
    expect(armOttavaEndpointAt(state, new ElementRegistry(), 100, 92)).toBe(false)
  })
})

describe('cycleOttavaEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cycleOttavaEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'ottava', id: 'O1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'ottava', id: 'O1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('declines with no ottava selected, leaving Tab to the slur and hairpin walks (then the browser)', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
    state.selectedElement = { kind: 'hairpin', id: 'H1' }
    expect(walk(1)).toBe(false)
  })

  it('declines when the bracket is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'ottava', id: 'O1' })
  })
})

/**
 * ⛔ **THE SNAP'S CHAPTER WENT WITH THE SNAP, 2026-08-21** — `ottavaDragTargetAt` answered *"which
 * onset is the cursor over"*, and the drag now WALKS instead (`../ottavaWalk.dragOttavaEndpoint`,
 * with its own spec). What its cases claimed lives on in two places: the two ends read DIFFERENT
 * EDGES → `../ottavaLane.test.ts`, and the walk's own journey → `../ottavaWalk.test.ts`.
 *
 * ⚠️ A SPEC MOVES WITH ITS MODULE — the parent keeping the assertions is how a split grows back
 * (docs/test-layout-plan.md).
 */
