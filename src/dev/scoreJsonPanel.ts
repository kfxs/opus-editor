import type { MusicEngine } from '../engine/MusicEngine'

/**
 * The live Score-JSON panel — development scaffolding, deliberately kept (docs/remove-vue-plan.md).
 *
 * It POLLS rather than subscribing, and always has: the engine's ScoreModel is a plain object with
 * no change-notification of its own, so there is nothing to listen to. That was true under Vue too —
 * a `computed` never saw an edit, which is why the Vue version polled into a ref. Losing the
 * framework costs this panel nothing; the ref just became a text node.
 */
const POLL_MS = 400

export interface ScoreJsonPanelHandle {
  destroy(): void
}

export function mountScoreJsonPanel(
  host: HTMLElement,
  getEngine: () => MusicEngine | null,
): ScoreJsonPanelHandle {
  const heading = document.createElement('h3')
  heading.className = 'text-xl mb-2'
  heading.textContent = 'Score JSON:'

  const pre = document.createElement('pre')
  pre.className = 'bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96'
  pre.textContent = '{}'

  host.append(heading, pre)

  const timer = setInterval(() => {
    pre.textContent = getEngine()?.exportJSON() || '{}'
  }, POLL_MS)

  return {
    destroy(): void {
      clearInterval(timer)
      heading.remove()
      pre.remove()
    },
  }
}
