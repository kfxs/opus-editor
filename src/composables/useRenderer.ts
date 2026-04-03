import type { Ref } from 'vue'
import type { EditorState } from '../interactions/EditorState'
import type { MusicEngine } from '../engine/MusicEngine'
import type { HighlightController } from '../interactions/HighlightController'
import { RenderController } from '../interactions/RenderController'

/**
 * Vue adapter for RenderController.
 * Bridges Vue ref getters into the framework-agnostic controller.
 */
export function useRenderer(
  state: EditorState,
  engine: Ref<MusicEngine | null>,
  highlight: HighlightController,
): RenderController {
  return new RenderController(
    () => engine.value,
    state,
    highlight,
  )
}
