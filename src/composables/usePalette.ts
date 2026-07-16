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
  /** Draw the preview for whatever is armed — RenderController.renderToolGhost, the SAME function
   *  the mouse calls on every move. Not `renderPreview`, which only ever draws a ghost NOTE and so
   *  cannot preview a marking tool. */
  renderArmedGhost: (coords: { x: number; y: number }) => void,
  getLastMousePosition: () => { x: number; y: number } | null,
  selection: SelectionController,
): PaletteController {
  return new PaletteController(
    () => engine.value,
    state,
    renderScore,
    renderArmedGhost,
    getLastMousePosition,
    (id) => selection.selectNote(id),
    () => selection.deselectAll(),
  )
}
