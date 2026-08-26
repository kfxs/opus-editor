import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bus } from '@/bus'
import { wirePlayRepeatsSync } from './playRepeatsSync'
import type { MusicEngine } from '@/engine/MusicEngine'

/**
 * The PLAY REPEATS seam — `bus.playRepeats` ⇄ the engine.
 *
 * ⭐ The claim worth pinning is the one the store exists for: **two surfaces, one value.** The dev
 * toolbar's checkbox and the bar's Play ▸ Play Repeats row both press this store and both read its
 * highlight, so a press on either moves the other. The engine is stubbed — whether repeats actually
 * sound is `repeatPlan`'s, which has its own file.
 */
function fakeEngine(): MusicEngine & { on: boolean } {
  const engine = {
    on: true,
    setRepeatsEnabled(value: boolean) { engine.on = value },
    getRepeatsEnabled() { return engine.on },
  }
  return engine as unknown as MusicEngine & { on: boolean }
}

describe('wirePlayRepeatsSync', () => {
  let engine: MusicEngine & { on: boolean }
  let stop: () => void
  /**
   * ⚠️ EVERY subscription, disposed after every test — `bus` is a module singleton, so a wiring left
   * alive leaks into the next test. And it does not merely linger: its `getEngine` closes over the
   * `engine` binding, which `beforeEach` REASSIGNS, so a leaked listener keeps writing to whichever
   * engine is current. (This file's own first draft had it, and the dispose test is what caught it.)
   */
  const wired: Array<() => void> = []
  const wire = (getEngine: () => MusicEngine | null): (() => void) => {
    const dispose = wirePlayRepeatsSync(getEngine)
    wired.push(dispose)
    return dispose
  }

  beforeEach(() => {
    bus.playRepeats.setHighlight(null)
    engine = fakeEngine()
    stop = wire(() => engine)
  })

  afterEach(() => {
    for (const dispose of wired.splice(0)) dispose()
  })

  it('⭐ opens with repeats ON — the default, and the true answer rather than a placeholder', () => {
    expect(bus.playRepeats.get()).toBe(true)
  })

  it('a press reaches the engine', () => {
    bus.playRepeats.press(false)
    expect(engine.getRepeatsEnabled()).toBe(false)
  })

  it('🚨 …and the HIGHLIGHT follows, which is what keeps the two surfaces in step', () => {
    // The bug the store fixes: the dev checkbox read the engine and synced on the editor's state
    // notification, and toggling repeats writes no state — so the menu could turn them off and leave
    // the box still ticked.
    bus.playRepeats.press(false)
    expect(bus.playRepeats.get()).toBe(false)
    bus.playRepeats.press(true)
    expect(bus.playRepeats.get()).toBe(true)
  })

  it('⭐ mirrors what the ENGINE reports, ⛔ never the value pressed', () => {
    // A highlight showing the request would be showing a wish. Here the engine refuses to turn off.
    const stubborn = { setRepeatsEnabled: vi.fn(), getRepeatsEnabled: () => true } as unknown as MusicEngine
    stop()
    stop = wire(() => stubborn)
    bus.playRepeats.press(false)
    expect(bus.playRepeats.get(), 'what is in force, not what was asked for').toBe(true)
  })

  it('survives a press before the engine exists — App.ts wires this first', () => {
    stop()
    stop = wire(() => null)
    expect(bus.playRepeats.get(), 'a score plays its repeats unless told otherwise').toBe(true)
    expect(() => bus.playRepeats.press(false)).not.toThrow()
  })

  it('disposes its subscription', () => {
    stop()
    bus.playRepeats.press(false)
    expect(engine.getRepeatsEnabled(), 'nothing listening any more').toBe(true)
  })
})
