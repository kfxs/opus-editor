// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { HighlightController } from './HighlightController'
import { createEditorState } from './EditorState'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'
import type { MusicEngine } from '../engine/MusicEngine'

/**
 * Guards the slur-handle gate decoupling: round (control-point) and square (endpoint)
 * handles draw INDEPENDENTLY. Same-line slurs carry both `controlPoints` + `slurEndpoints`
 * → both kinds; split (cross-system) slurs carry only `slurEndpoints` → squares only.
 * We fabricate a `slur` registry entry, run `applySlurHandles`, and count the handle
 * entries it pushes back into the registry (and the SVG nodes it appends).
 */
function run(slurExtra: Partial<ElementInfo>) {
  const registry = new ElementRegistry()
  registry.add({
    type: 'slur', id: 'S1', bbox: { x: 0, y: 0, width: 0, height: 0 }, ...slurExtra,
  })
  const engine = { getElementRegistry: () => registry } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  state.selectedSlurId = 'S1'

  const hc = new HighlightController(() => engine, () => canvas, state)
  hc.applySlurHandles()

  return {
    rounds: registry.getByType('slur-handle').length,
    squares: registry.getByType('slur-endpoint').length,
    circles: svg.querySelectorAll('circle').length,
    rects: svg.querySelectorAll('rect').length,
  }
}

const CPS: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 10, y: 20 }, { x: 30, y: 20 }]
const ENDS = { p0: { x: 5, y: 15 }, p1: { x: 40, y: 15 }, direction: -1 }

describe('HighlightController slur-handle gate', () => {
  it('split slur (slurEndpoints only) → two squares, zero round handles', () => {
    const r = run({ slurEndpoints: ENDS })
    expect(r.squares).toBe(2)
    expect(r.rounds).toBe(0)
    expect(r.rects).toBe(2)
    expect(r.circles).toBe(0)
  })

  it('same-line slur (both fields) → both round and square handles', () => {
    const r = run({ controlPoints: CPS, slurEndpoints: ENDS })
    expect(r.rounds).toBe(2)
    expect(r.squares).toBe(2)
    expect(r.circles).toBe(2)
    expect(r.rects).toBe(2)
  })

  it('controlPoints only (no endpoints) → round handles, zero squares', () => {
    const r = run({ controlPoints: CPS })
    expect(r.rounds).toBe(2)
    expect(r.squares).toBe(0)
  })

  it('neither field → no handles drawn (gate finds nothing)', () => {
    const r = run({})
    expect(r.rounds).toBe(0)
    expect(r.squares).toBe(0)
  })
})
