/**
 * SPEC SUPPORT — a `MusicEngine` with one bar, no page and no sound. The spec mocks the renderer and
 * playback seams first (`./engineStubs`); this is only the construction fourteen specs spelled.
 */
import { MusicEngine } from '@/engine/MusicEngine'

export function makeEngine(): MusicEngine {
  const engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
  engine.addMeasure()
  return engine
}
