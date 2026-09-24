import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CueSizeController } from './CueSizeController'
import { bus } from '@/bus'
import type { MusicEngine } from '../../engine/MusicEngine'

/**
 * Subject: `./CueSizeController` — the one place the Properties "cue size" checkbox reaches the engine
 * (cue-size-plan P5): `bus.cueSize` → `engine.cue.set`, a repaint when it changed, ⛔ none when it did not.
 */
describe('CueSizeController', () => {
  let calls: { ids: readonly string[]; on: boolean }[]
  let changed: number
  let renders: number
  let controller: CueSizeController

  const engine = () => ({ cue: { set: (ids: readonly string[], on: boolean) => { calls.push({ ids, on }); return changed } } }) as unknown as MusicEngine

  beforeEach(() => {
    calls = []
    changed = 1
    renders = 0
    controller = new CueSizeController(() => engine(), () => { renders++ })
  })
  afterEach(() => controller.destroy())

  it('⭐ applies the request through `engine.cue.set`, then repaints', () => {
    bus.cueSize.set({ noteId: 'n1', cue: true })
    expect(calls).toEqual([{ ids: ['n1'], on: true }])
    expect(renders).toBe(1)
  })

  it('⛔ nothing changed ⇒ no repaint', () => {
    changed = 0
    bus.cueSize.set({ noteId: 'n1', cue: false })
    expect(renders).toBe(0)
  })

  it('stops listening once destroyed', () => {
    controller.destroy()
    bus.cueSize.set({ noteId: 'n1', cue: true })
    expect(calls).toEqual([])
  })
})
