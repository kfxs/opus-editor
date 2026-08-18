import { describe, it, expect } from 'vitest'
import { pickSlurHandleAt } from './slurHandlePick'
import { ElementRegistry } from '../engine/ElementRegistry'

/**
 * Which of a selected slur's handles a press takes when their hit boxes overlap.
 *
 * Subject: {@link slurHandlePick}, sitting beside this file. Pure geometry over a FABRICATED
 * registry — the boxes are handed in, so nothing here asks jsdom where any glyph landed
 * (`reference_jsdom_cannot_measure_glyphs`).
 *
 * ⭐ His report, 2026-08-18: *"im trying to get the endpoint but i'm getting the control point"*. The
 * press path took the first box that contained the cursor and tested the arc dots first, so the dot
 * won every overlap. The boxes are 18 px wide and a short slur's second control point sits about
 * 20 px from its end square.
 */
const HIT = 9

/** A registry holding one arc dot and one end square, centred where the caller says. */
function handles(dotX: number, squareX: number, y = 100) {
  const registry = new ElementRegistry()
  const box = (x: number) => ({ x: x - HIT, y: y - HIT, width: HIT * 2, height: HIT * 2 })
  registry.add({
    type: 'slur-handle', slurId: 'S1', bbox: box(dotX), cpIndex: 1,
    controlPoints: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    slurEndpoints: { p0: { x: 0, y: 0 }, p1: { x: 0, y: 0 }, direction: -1 },
  })
  registry.add({ type: 'slur-endpoint', slurId: 'S1', bbox: box(squareX), endpoint: 'end' })
  return registry
}

describe('pickSlurHandleAt', () => {
  it('⭐ takes the NEAREST handle when both boxes cover the press — the square', () => {
    // 4 px from the square, 12 px from the dot: what the hand meant is not in doubt.
    const pick = pickSlurHandleAt(handles(88, 104), 'S1', 100, 100)
    expect(pick?.kind).toBe('endpoint')
  })

  it('…and the DOT when that is the nearer one, which is why this is distance and not an order', () => {
    // The mirror. Re-ordering the families would only move the unfairness to the other one.
    const pick = pickSlurHandleAt(handles(96, 112), 'S1', 100, 100)
    expect(pick?.kind).toBe('control')
  })

  it('gives a dead heat to the SQUARE — a position handle over a shape one', () => {
    // Same distance either side: the square moves where the slur ATTACHES, the dot only bends it, so
    // the square is the more consequential thing to have grabbed by accident.
    const pick = pickSlurHandleAt(handles(92, 108), 'S1', 100, 100)
    expect(pick?.kind).toBe('endpoint')
  })

  it('takes the only handle it touches, and none when it touches neither', () => {
    expect(pickSlurHandleAt(handles(40, 300), 'S1', 42, 100)?.kind).toBe('control')
    expect(pickSlurHandleAt(handles(40, 300), 'S1', 302, 100)?.kind).toBe('endpoint')
    expect(pickSlurHandleAt(handles(40, 300), 'S1', 170, 100)).toBeNull()
  })

  it('⛔ never answers with another slur’s handle', () => {
    // The caller dispatches on the pick alone, so a foreign entry winning the distance contest would
    // silently swallow the press.
    expect(pickSlurHandleAt(handles(96, 104), 'S2', 100, 100)).toBeNull()
  })

  it('⛔ …nor with an entry lacking the fields its gesture needs', () => {
    // Such an entry could never have been dispatched anyway; letting it win would drop the press.
    const registry = new ElementRegistry()
    const box = { x: 91, y: 91, width: HIT * 2, height: HIT * 2 }
    registry.add({ type: 'slur-handle', slurId: 'S1', bbox: box }) // no cpIndex/controlPoints
    registry.add({ type: 'slur-endpoint', slurId: 'S1', bbox: box }) // no `endpoint`
    expect(pickSlurHandleAt(registry, 'S1', 100, 100)).toBeNull()
  })
})
