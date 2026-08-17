import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SlurGeometryController } from './SlurGeometryController'
import { createEditorState, type EditorState } from './EditorState'
import { bus } from '@/bus'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Score } from '../types/music'

/**
 * The apply half of the Properties slur rows.
 *
 * Subject: {@link SlurGeometryController}, sitting beside this file. The window's half — which rows
 * appear and what they publish — is `PropertiesWidget.slur.test.ts`; what is asked here is the
 * translation, which is where the real risk is: the panel speaks ABSOLUTE positions and the endpoint
 * facade is a NUDGE, so a wrong reading of "current" moves the end by the wrong amount, silently and
 * only when it already carried an offset.
 *
 * ⚠️ The engine is a stub. The arc path is `slurHandleNudge`'s (specced there against a fabricated
 * registry); everything below is about the arithmetic and the declines.
 */
function stubEngine(score: Score) {
  const nudge = vi.fn(() => true)
  const resetEnd = vi.fn(() => true)
  const engine = {
    getScore: () => score,
    nudgeSlurEndpoint: nudge,
    resetSlurEndpointOffset: resetEnd,
    // The arc path resolves its baseline from the registry; an empty one makes it DECLINE, which is
    // what this spec wants everywhere except the one test that asserts the routing.
    getElementRegistry: () => ({ getByType: () => [] }),
  } as unknown as MusicEngine
  return { engine, nudge, resetEnd }
}

/** A score whose slur already carries a start-end nudge — the case the delta arithmetic is about. */
const scoreWithOffset = (): Score => ({
  id: 's', title: 'T', measures: [],
  engravingOverrides: {
    'slur-1': [{ kind: 'endpointOffset', start: { x: 0.5, y: -1 } }],
  },
} as unknown as Score)

describe('SlurGeometryController', () => {
  let state: EditorState
  let controller: SlurGeometryController
  let rendered: number

  const wire = (engine: MusicEngine) => {
    rendered = 0
    controller = new SlurGeometryController(state, () => engine, () => { rendered++ })
  }

  beforeEach(() => { state = createEditorState() })
  afterEach(() => controller.destroy())

  it('⭐ turns a typed ABSOLUTE into the facade\'s relative nudge', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'start' }, value: { x: 2 } })
    // Stored 0.5, wanted 2 → move by 1.5. Reading the request as the delta would move it to 2.5.
    expect(nudge).toHaveBeenCalledWith('slur-1', 'start', 1.5, 0)
    expect(rendered).toBe(1)
  })

  it('an absent axis is "leave it" — its delta is zero, never a move to 0', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'start' }, value: { y: -1 } })
    // y is already −1, so this whole request is a no-op — and x, unnamed, must not be dragged to 0.
    expect(nudge).not.toHaveBeenCalled()
  })

  it('an end with no offset yet reads as 0, so the typed value IS the delta', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'end' }, value: { x: 1, y: 2 } })
    expect(nudge).toHaveBeenCalledWith('slur-1', 'end', 1, 2)
  })

  it('re-typing the same number changes nothing — and leaves no empty undo entry', () => {
    const { engine, nudge } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'start' }, value: { x: 0.5, y: -1 } })
    expect(nudge).not.toHaveBeenCalled()
    expect(rendered).toBe(0)
  })

  it('a null value resets that end rather than nudging it to zero', () => {
    const { engine, nudge, resetEnd } = stubEngine(scoreWithOffset())
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'start' }, value: null })
    expect(resetEnd).toHaveBeenCalledWith('slur-1', 'start')
    expect(nudge).not.toHaveBeenCalled()
    expect(rendered).toBe(1)
  })

  it('does not repaint when the engine declines (nothing to reset)', () => {
    const { engine, resetEnd } = stubEngine(scoreWithOffset())
    ;(resetEnd as unknown as { mockReturnValue: (v: boolean) => void }).mockReturnValue(false)
    wire(engine)
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'end' }, value: null })
    expect(rendered).toBe(0)
  })

  it('an ARC request never touches the endpoint verbs — it routes to the shape module', () => {
    const { engine, nudge, resetEnd } = stubEngine(scoreWithOffset())
    wire(engine)
    // No slur selected and no drawn handles, so the shape module declines; what matters here is that
    // the endpoint path was not taken on the way.
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'controlPoint', cpIndex: 0 }, value: { y: 3 } })
    expect(nudge).not.toHaveBeenCalled()
    expect(resetEnd).not.toHaveBeenCalled()
    expect(rendered).toBe(0)
  })

  it('does nothing at all without an engine', () => {
    rendered = 0
    controller = new SlurGeometryController(state, () => null, () => { rendered++ })
    bus.slurGeometry.set({ slurId: 'slur-1', target: { kind: 'endpoint', which: 'start' }, value: { x: 1 } })
    expect(rendered).toBe(0)
  })
})
