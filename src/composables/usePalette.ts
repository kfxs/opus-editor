import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectionController } from '../interactions/SelectionController'
import { PaletteController } from '../interactions/PaletteController'

/**
 * Vue adapter for PaletteController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function usePalette(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  renderScore: () => void,
  renderPreview: (coords: { x: number; y: number }) => void,
  getLastMousePosition: () => { x: number; y: number } | null,
  selection: SelectionController,
): PaletteController {
  return new PaletteController(
    () => engine.value,
    state,
    renderScore,
    renderPreview,
    getLastMousePosition,
    (id) => selection.selectNote(id),
  )
}
