import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { HighlightController } from '../interactions/HighlightController'

/**
 * Vue adapter for HighlightController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function useHighlight(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  scoreCanvas: Ref<HTMLElement | null>,
): HighlightController {
  return new HighlightController(
    () => engine.value,
    () => scoreCanvas.value,
    state,
  )
}
