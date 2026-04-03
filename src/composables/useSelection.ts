import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import { SelectionController } from '../interactions/SelectionController'

/**
 * Vue adapter for SelectionController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function useSelection(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  scoreCanvas: Ref<HTMLElement | null>,
  renderScore: () => void,
): SelectionController {
  return new SelectionController(
    () => engine.value,
    state,
    () => scoreCanvas.value,
    renderScore,
  )
}
