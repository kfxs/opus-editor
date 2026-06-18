import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { Rect } from '../engine/ViewportModel'
import { SelectionController } from '../interactions/SelectionController'

/**
 * Vue adapter for SelectionController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function useSelection(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  ensureVisible: (rect: Rect) => void,
  renderScore: () => void,
): SelectionController {
  return new SelectionController(
    () => engine.value,
    state,
    ensureVisible,
    renderScore,
  )
}
