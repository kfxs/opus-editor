import { describe, it, expect, beforeEach } from 'vitest'
import {
  pedalEndpointHandles, armPedalEndpointAt, cyclePedalEndpoint,
  PEDAL_HANDLE_GAP_PX as GAP,
} from './pedalHandles'
import { ElementRegistry, type ElementInfo } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../EditorState'

/**
 * Where a selected pedal's two endpoint squares sit.
 *
 * Subject: {@link pedalHandles}, sitting beside this file. The REGISTRY is the fixture, the ottava's
 * and hairpin's arrangement next door — the glyph boxes are what `PedalRenderer` measured, so with
 * them handed in the answer is ordinary arithmetic rather than a glyph measurement (jsdom measures
 * none: `reference_jsdom_cannot_measure_glyphs`). What the squares LOOK like is
 * `HighlightController`'s.
 */

/** One drawn SIGN as the renderer registers it — the grain of this family (⚠️ per GLYPH, not per
 *  fragment), which is exactly what these tests are about. */
const sign = (
  which: 'down' | 'up',
  x: number,
  width: number,
  top: number,
  bottom: number,
  id = 'P1',
): ElementInfo => ({
  type: 'pedal',
  id,
  pedalSign: which,
  bbox: { x, y: top, width, height: bottom - top },
  points: [
    { x, y: top },
    { x: x + width, y: top },
    { x: x + width, y: bottom },
    { x, y: bottom },
  ],
} as ElementInfo)

/** An unbroken pedal: `Ped.` at 100 (26 wide), `✻` right-aligned on the lift at 300 (12 wide).
 *  Both signs share one baseline, so both boxes share one band — 84…101. */
const PED = () => sign('down', 100, 26, 84, 101)
const STAR = () => sign('up', 288, 12, 84, 101)

describe('pedalEndpointHandles', () => {
  it('⭐ steps each square OUTWARD — the AIR, so neither sits on a sign', () => {
    expect(pedalEndpointHandles([PED(), STAR()], 'P1')).toEqual([
      // left of the `Ped.`'s LEFT edge…
      { which: 'start', x: 100 - GAP, y: 92.5 },
      // …and right of the `✻`'s RIGHT edge, which is the lift x itself (the release is
      // right-aligned on it, so its ink runs backwards from there).
      { which: 'end', x: 288 + 12 + GAP, y: 92.5 },
    ])
    // …and far enough that the square's inner EDGE clears the ink, not merely its centre: the
    // squares are 6px half-side (`SLUR_HANDLE_R + 1`), so anything at or under 6 overlaps.
    expect(GAP).toBeGreaterThan(6)
  })

  it('⭐⭐ names the two signs, ⛔ never counts entries — the START is the FIRST `Ped.`', () => {
    // A pedal broken across a system break registers `Ped.` · `(Ped.)` · `✻`. A resumption is a
    // reminder that the damper is still down, not a second beginning, so the middle sign carries no
    // square — and reading "the first entry and the last one" would put the END square on it if the
    // release were ever registered before it.
    const resumed = sign('down', 40, 40, 484, 501)
    const lift = sign('up', 200, 12, 484, 501)
    expect(pedalEndpointHandles([PED(), resumed, lift], 'P1')).toEqual([
      { which: 'start', x: 100 - GAP, y: 92.5 },
      { which: 'end', x: 200 + 12 + GAP, y: 492.5 },
    ])
  })

  it('⚠️ takes the two ends from DIFFERENT systems\' coordinates when the pedal is broken', () => {
    // Each square rides its own sign's box, so the release on the next system draws its square there
    // — reading both off one entry would put the second square in the wrong system.
    const lift = sign('up', 200, 12, 484, 501)
    expect(pedalEndpointHandles([PED(), lift], 'P1').map(h => h.y)).toEqual([92.5, 492.5])
  })

  it('⚠️ draws ONE square when the release was not drawn — ⛔ it never invents the missing end', () => {
    // Two squares on one `Ped.` would say the pedal both begins and ends there.
    expect(pedalEndpointHandles([PED()], 'P1')).toEqual([{ which: 'start', x: 100 - GAP, y: 92.5 }])
    expect(pedalEndpointHandles([STAR()], 'P1')).toEqual([{ which: 'end', x: 300 + GAP, y: 92.5 }])
    // ⭐⭐ THE BREAK-TEST FOR THE WHOLE `pedalSign` FIELD: a broken pedal whose final fragment the
    // cutter dropped registers `Ped.` · `(Ped.)` and no release. "The first entry and the last one"
    // passes every case above and puts the END square on the RESUMPTION here — a square claiming to
    // be the lift, several bars before the damper comes up.
    const resumed = sign('down', 40, 40, 484, 501)
    expect(pedalEndpointHandles([PED(), resumed], 'P1'))
      .toEqual([{ which: 'start', x: 100 - GAP, y: 92.5 }])
  })

  it('ignores another pedal\'s signs entirely', () => {
    const other = sign('up', 10, 12, 84, 101, 'P2')
    expect(pedalEndpointHandles([other, PED(), STAR()], 'P1').map(h => h.x))
      .toEqual([100 - GAP, 300 + GAP])
  })

  it('draws nothing for a pedal that is not on screen, and nothing for an unnamed box', () => {
    expect(pedalEndpointHandles([], 'P1')).toEqual([])
    const unnamed = { type: 'pedal', id: 'P1', bbox: { x: 0, y: 0, width: 10, height: 10 } } as ElementInfo
    expect(pedalEndpointHandles([unnamed], 'P1')).toEqual([])
  })
})

/** A registry holding one drawn pedal plus the squares the highlight pass put on it. */
function withHandles(): ElementRegistry {
  const registry = new ElementRegistry()
  registry.add(PED())
  registry.add(STAR())
  for (const h of pedalEndpointHandles(registry.getByType('pedal'), 'P1')) {
    registry.add({
      type: 'pedal-endpoint', pedalId: 'P1', endpoint: h.which,
      bbox: { x: h.x - 9, y: h.y - 9, width: 18, height: 18 },
    })
  }
  return registry
}

describe('armPedalEndpointAt', () => {
  let state: EditorState
  let registry: ElementRegistry

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'pedal', id: 'P1' }
  })

  it('a press inside a square arms that end', () => {
    expect(armPedalEndpointAt(state, registry, 300 + GAP, 92.5)).toBe(true)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1', endpoint: 'end' })
  })

  it('⚠️ REASSIGNS the selection whole — the observable Proxy only traps the SET', () => {
    const before = state.selectedElement
    armPedalEndpointAt(state, registry, 100 - GAP, 92.5)
    expect(state.selectedElement).not.toBe(before)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1', endpoint: 'start' })
  })

  it('a press between the squares — over the music the pedal passes over — DECLINES', () => {
    expect(armPedalEndpointAt(state, registry, 200, 92.5)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1' })
  })

  it('⛔ does not answer for an OTTAVA\'s squares — the families read their own type', () => {
    registry.add({
      type: 'ottava-endpoint', ottavaId: 'O1', endpoint: 'end',
      bbox: { x: 491, y: 83, width: 18, height: 18 },
    } as ElementInfo)
    expect(armPedalEndpointAt(state, registry, 500, 92)).toBe(false)
  })

  it('declines when no squares are drawn (no pedal selected, so none registered)', () => {
    expect(armPedalEndpointAt(state, new ElementRegistry(), 100, 92)).toBe(false)
  })
})

describe('cyclePedalEndpoint', () => {
  let state: EditorState
  let registry: ElementRegistry
  const walk = (step: 1 | -1) => cyclePedalEndpoint(state, registry, step)
  const armed = () => (state.selectedElement as { endpoint?: string } | null)?.endpoint

  beforeEach(() => {
    state = createEditorState()
    registry = withHandles()
    state.selectedElement = { kind: 'pedal', id: 'P1' }
  })

  it('Tab with none armed takes the FIRST, Shift+Tab the LAST — either key is a way in', () => {
    expect(walk(1)).toBe(true)
    expect(armed()).toBe('start')
    state.selectedElement = { kind: 'pedal', id: 'P1' }
    walk(-1)
    expect(armed()).toBe('end')
  })

  it('⭐ WRAPS, so a repeated Tab is a loop and not a dead end', () => {
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('end')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('end')
  })

  it('⚠️ a pedal whose release was not drawn has ONE stop, and the walk stays on it', () => {
    registry = new ElementRegistry()
    registry.add(PED())
    walk(1); expect(armed()).toBe('start')
    walk(1); expect(armed()).toBe('start')
    walk(-1); expect(armed()).toBe('start')
  })

  it('declines with no pedal selected, leaving Tab to the other walks (then the browser)', () => {
    state.selectedElement = null
    expect(walk(1)).toBe(false)
    state.selectedElement = { kind: 'ottava', id: 'O1' }
    expect(walk(1)).toBe(false)
  })

  it('declines when the pedal is not on screen — the REGISTRY is the list', () => {
    registry = new ElementRegistry()
    expect(walk(1)).toBe(false)
    expect(state.selectedElement).toEqual({ kind: 'pedal', id: 'P1' })
  })
})
