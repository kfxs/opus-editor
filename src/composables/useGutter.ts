import { watch, onUnmounted, type Ref } from 'vue'
import type { MusicEngine } from '../engine/MusicEngine'
import { GutterController } from '../interactions/GutterController'
import type { ViewportHost } from './useViewport'

/**
 * Vue adapter for {@link GutterController} — the linear-view frozen gutter.
 * Bridges Vue refs into the framework-agnostic controller; all the logic lives there.
 */
export function useGutter(
  engine: Ref<MusicEngine | null>,
  gutterEl: Ref<HTMLElement | null>,
  contentEl: Ref<HTMLElement | null>,
  viewport: ViewportHost,
): GutterController {
  const controller = new GutterController(
    () => engine.value,
    () => gutterEl.value,
    () => contentEl.value,
    viewport.model,
  )

  // The element only exists in linear view (v-if), so paint it when it appears and drop the
  // renderer when it goes — a kept renderer would hold a detached node.
  watch(gutterEl, (el) => {
    if (el) controller.refresh()
    else controller.detach()
  })

  onUnmounted(() => controller.detach())

  return controller
}
