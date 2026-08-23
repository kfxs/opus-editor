import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bus } from '@/bus'
import { wireSoundSync } from './soundSync'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { SoundRef } from '@/types/music'

/**
 * ⚠️⚠️ THE REGRESSION THIS FILE EXISTS FOR. The sound became score data, and this seam gained a
 * mirror so the picker would follow an import or an undo — but it was attached ONCE, at wiring time,
 * when App.ts has not built the engine yet. The subscription was therefore never made at all:
 * importing a score left both surfaces showing the sound of the score you had just replaced.
 *
 * So the assertions here are about WHEN the wiring happens, not about what it computes. The engine
 * is a stub for exactly that reason: this is a test about a lifecycle, and a real engine would hide
 * it behind a working one.
 */
function stubEngine(sound: SoundRef) {
  const listeners = new Set<() => void>()
  return {
    engine: {
      getScoreSound: () => sound,
      setScoreSound: vi.fn(),
      onModelChange: (fn: () => void) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    } as unknown as MusicEngine,
    /** What `loadJSON` / undo do: change the score, then notify. */
    change(next: SoundRef) {
      sound = next
      for (const fn of listeners) fn()
    },
  }
}

describe('wireSoundSync', () => {
  let stopState: Array<() => void>
  let stateListeners: Set<() => void>
  const onStateChange = (fn: () => void) => {
    stateListeners.add(fn)
    return () => stateListeners.delete(fn)
  }
  const fireStateChange = () => { for (const fn of [...stateListeners]) fn() }

  beforeEach(() => {
    stateListeners = new Set()
    stopState = []
    bus.sound.setHighlight(null)
  })

  /**
   * ⭐ The other half of the same bug: with the highlight left `null`, Play ▸ Score Sound showed no
   * TICK at all and the dev picker showed whatever its first option was. `DEFAULT_SOUND` is the true
   * answer before a score exists — a fresh score sounds like that — so both surfaces open honest.
   */
  it('opens on the DEFAULT even before there is an engine, so a row is ticked from the start', () => {
    stopState.push(wireSoundSync(() => null, onStateChange))
    expect(bus.sound.get()).toBe(0)
  })

  it('mirrors the score it is wired to', () => {
    const { engine } = stubEngine({ kind: 'gm', program: 68 })
    stopState.push(wireSoundSync(() => engine, onStateChange))
    expect(bus.sound.get()).toBe(68)
  })

  /** THE BUG: wired before the engine exists, which is what App.ts actually does. */
  it('subscribes to the model even though the engine did not exist at wiring time', () => {
    const { engine, change } = stubEngine({ kind: 'gm', program: 0 })
    let live: MusicEngine | null = null
    stopState.push(wireSoundSync(() => live, onStateChange))

    // …the app builds the engine, and something — anything — changes state afterwards.
    live = engine
    fireStateChange()

    // Now an IMPORT: the score changes with nobody pressing a thing.
    change({ kind: 'gm', program: 42 })
    expect(bus.sound.get()).toBe(42)
  })

  it('follows an undo the same way', () => {
    const { engine, change } = stubEngine({ kind: 'gm', program: 68 })
    stopState.push(wireSoundSync(() => engine, onStateChange))
    change({ kind: 'gm', program: 0 })
    expect(bus.sound.get()).toBe(0)
  })

  it('presses through to the score, and mirrors what the score then says', () => {
    const { engine } = stubEngine({ kind: 'gm', program: 68 })
    stopState.push(wireSoundSync(() => engine, onStateChange))
    bus.sound.press(42)
    expect(engine.setScoreSound).toHaveBeenCalledWith({ kind: 'gm', program: 42 })
    // The stub's score does not move, so the highlight is the SCORE's answer (68), never the press.
    // A highlight of 42 here would mean the seam was reporting what was asked for.
    expect(bus.sound.get()).toBe(68)
  })

  it('lets go of both subscriptions when disposed', () => {
    const { engine, change } = stubEngine({ kind: 'gm', program: 68 })
    const stop = wireSoundSync(() => engine, onStateChange)
    stop()
    change({ kind: 'gm', program: 42 })
    expect(bus.sound.get()).toBe(68)
    expect(stateListeners.size).toBe(0)
  })

  afterEach(() => {
    for (const stop of stopState) stop()
  })
})
