import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { ViewportModel, type Rect } from '../engine/ViewportModel'

/**
 * Vue host adapter for {@link ViewportModel} — the *only* DOM-aware piece of the viewport stack.
 * It keeps the pure model and the real scroll element in sync in both directions:
 *
 *  - **DOM → model:** a `scroll` listener mirrors user scrolling into the model, and two
 *    `ResizeObserver`s mirror size changes — the outer box resizing (window/layout) and the inner
 *    content surface resizing (the SVG growing as the score gains lines). Sizes are read straight
 *    off the scroll element's `client*`/`scroll*` geometry so the model's `maxScroll` matches what
 *    the browser will actually allow, padding and scrollbars included.
 *  - **model → DOM:** `scrollTo`/`ensureVisible` update the model and then write the result onto the
 *    element, guarded so the resulting `scroll` event doesn't echo back as a redundant model update.
 *
 * A React/Svelte port reimplements only this file; the model and its tests travel unchanged.
 * (The `scrollTo`/`ensureVisible` wrappers have no caller yet — Phase 4 of
 * docs/navigation-viewport-plan.md routes `scrollSelectedNoteIntoView` through `ensureVisible`.)
 */
export interface ViewportHost {
  model: ViewportModel
  /** Set scroll (content coords), clamp via the model, and apply to the element. */
  scrollTo(x: number, y: number): void
  /** Scroll `rect` into view via the model, then apply the result to the element. */
  ensureVisible(rect: Rect, padding?: number): void
}

export function useViewport(
  /** Outer scroll box — the fixed-height viewport (the `scoreCanvas` ref). */
  viewportEl: Ref<HTMLElement | null>,
  /** Inner content surface that hosts the SVG (the `scoreContent` ref). */
  contentEl: Ref<HTMLElement | null>,
): ViewportHost {
  const model = new ViewportModel()
  // True while we are writing the model's scroll onto the element, so the `scroll` event it
  // triggers is ignored instead of being mirrored straight back into the model.
  let applying = false
  let viewportRO: ResizeObserver | null = null
  let contentRO: ResizeObserver | null = null

  // Pull the live DOM geometry into the model. viewport = client box; content = full scrollable
  // extent — so maxScroll = content - viewport mirrors the browser exactly.
  function syncSizes(): void {
    const el = viewportEl.value
    if (!el) return
    model.setViewportSize(el.clientWidth, el.clientHeight)
    model.setContentSize(el.scrollWidth, el.scrollHeight)
    syncScrollFromElement()
  }

  function syncScrollFromElement(): void {
    const el = viewportEl.value
    if (!el || applying) return
    model.scrollTo(el.scrollLeft, el.scrollTop)
  }

  function applyScrollToElement(): void {
    const el = viewportEl.value
    if (!el) return
    const { x, y } = model.getScroll()
    if (el.scrollLeft === x && el.scrollTop === y) return
    applying = true
    el.scrollLeft = x
    el.scrollTop = y
    // The programmatic scroll fires its `scroll` event asynchronously; drop the guard next frame.
    requestAnimationFrame(() => { applying = false })
  }

  function onScroll(): void {
    syncScrollFromElement()
  }

  function attach(): void {
    const vp = viewportEl.value
    if (!vp) return
    vp.addEventListener('scroll', onScroll, { passive: true })
    viewportRO = new ResizeObserver(syncSizes)
    viewportRO.observe(vp)
    const content = contentEl.value
    if (content) {
      contentRO = new ResizeObserver(syncSizes)
      contentRO.observe(content)
    }
    syncSizes()
  }

  function detach(): void {
    viewportEl.value?.removeEventListener('scroll', onScroll)
    viewportRO?.disconnect()
    viewportRO = null
    contentRO?.disconnect()
    contentRO = null
  }

  onMounted(() => {
    if (viewportEl.value) {
      attach()
      return
    }
    // Ref not populated yet — attach once it is, then stop watching.
    const stop = watch(viewportEl, (el) => {
      if (el) {
        attach()
        stop()
      }
    })
  })

  onUnmounted(detach)

  return {
    model,
    scrollTo(x, y) {
      model.scrollTo(x, y)
      applyScrollToElement()
    },
    ensureVisible(rect, padding) {
      model.ensureVisible(rect, padding)
      applyScrollToElement()
    },
  }
}
