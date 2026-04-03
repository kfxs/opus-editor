import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectionController } from '../interactions/SelectionController'
import type { PaletteController } from '../interactions/PaletteController'
import { KeyboardController } from '../interactions/KeyboardController'

/**
 * Vue adapter for KeyboardController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function useKeyboardEntry(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  palette: PaletteController,
  renderScore: () => void,
  selection: SelectionController,
): KeyboardController {
  return new KeyboardController(
    () => engine.value,
    state,
    () => palette.getPendingArticulations(),
    renderScore,
    (id) => selection.setSelectedNote(id),
    () => selection.getContextPitch(),
  )
}
