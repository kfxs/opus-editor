import { onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectionController } from '../interactions/SelectionController'
import type { RenderController } from '../interactions/RenderController'
import type { PaletteController } from '../interactions/PaletteController'
import type { TextEditController } from '../interactions/TextEditController'
import type { ClipboardController } from '../interactions/ClipboardController'
import { MouseController } from '../interactions/MouseController'

/**
 * Vue adapter for MouseController.
 * The only Vue-specific concern here is wiring controller lifecycle to component lifecycle.
 */
export function useMouseInteraction(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  scoreCanvas: Ref<HTMLElement | null>,
  selection: SelectionController,
  render: RenderController,
  palette: PaletteController,
  textEdit: TextEditController,
  clipboard: ClipboardController,
  panBy: (dx: number, dy: number) => void,
): MouseController {
  const controller = new MouseController(
    () => engine.value,
    () => scoreCanvas.value,
    state,
    selection,
    render,
    () => palette.getPendingArticulations(),
    () => textEdit,
    clipboard,
    panBy,
  )

  onMounted(() => controller.setup())
  onUnmounted(() => controller.teardown())

  return controller
}
