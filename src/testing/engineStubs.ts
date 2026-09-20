/**
 * SPEC SUPPORT — the two seams a `MusicEngine` spec stubs because jsdom draws nothing and plays
 * nothing (docs/plans/code-shape-plan-2026-09-19.md, Phase 5). Fifty-odd specs each spelled these classes.
 *
 * A `vi.mock` has to be written in the spec itself (vitest hoists it per file), so what is shared is
 * the FACTORY:
 *
 * ```ts
 * vi.mock('../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
 * vi.mock('../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())
 * ```
 *
 * ⛔ This file imports NOTHING of the engine's: it is loaded from inside those factories, while
 * `MusicEngine` is still being imported — an engine import here would be a cycle. The engine-side
 * builder is `./makeEngine`.
 *
 * ⚠️ Only the PLAIN stubs are here — a renderer that renders nothing over a registry that holds
 * nothing. A spec that needs its registry to ANSWER (a drawn box, a staff geometry) keeps its own.
 */
import { vi } from 'vitest'

/** A registry that holds nothing: every read answers empty. */
export function nullRegistry() {
  return {
    clear: vi.fn(), register: vi.fn(), getAll: vi.fn(() => []),
    findAt: vi.fn(() => null), getByNoteId: vi.fn(() => null), getById: vi.fn(() => null),
    registerStaffGeometry: vi.fn(), getStaffGeometry: vi.fn(() => null),
    getByMeasure: vi.fn(() => []),
  }
}

/** The module `ScoreRenderer` is mocked with: it renders nothing, over ONE {@link nullRegistry}. */
export function scoreRendererStub() {
  const registry = nullRegistry()
  return {
    ScoreRenderer: class {
      initialize = vi.fn(); renderScore = vi.fn(); getElementRegistry = vi.fn(() => registry)
    },
  }
}

/** The module `PlaybackEngine` is mocked with: it plays nothing. */
export function playbackEngineStub() {
  return {
    PlaybackEngine: class {
      setScore = vi.fn(); play = vi.fn(); pause = vi.fn(); stop = vi.fn(); setVolume = vi.fn(); onStateChange = vi.fn()
    },
  }
}
