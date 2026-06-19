import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import { ViewportModel, type Point, type Rect } from '../engine/ViewportModel'

/**
 * Vue host adapter for {@link ViewportModel} — the *only* DOM-aware piece of the viewport stack.
 * It keeps the pure model and the real scroll element in sync in both directions, and owns the
 * zoom DOM (the `sizer` + `zoomLayer` pair, see docs/zoom-plan.md §3):
 *
 *  - **DOM → model:** a `scroll` listener mirrors user scrolling into the model; a `ResizeObserver`
 *    on the outer box mirrors viewport (window/layout) resizes; and a `ResizeObserver` on the
 *    rendered `<svg>` tracks the *natural* (unscaled) content size as the score gains lines/measures.
 *    The svg node is recreated on renderer re-init, so a `MutationObserver` on the stable content
 *    host re-binds the svg observer when the element changes.
 *  - **model → DOM:** `scrollTo`/`ensureVisible`/`setZoom`/`zoomAt` update the model and then write
 *    the result onto the element, guarded so the resulting `scroll` event doesn't echo back.
 *
 * The viewport works entirely in **screen (scaled) pixels** (§2): `contentSize = naturalSvgSize ×
 * zoom`, single-sourced by `applyZoom` here — the `sizer` carries that size (so the scroll bars get
 * their range) and the `zoomLayer` carries the matching `transform: scale(zoom)` (so the visuals
 * scale without a re-render). Both derive from the same `naturalSize × zoom`, so they never disagree.
 *
 * A React/Svelte port reimplements only this file; the model and its tests travel unchanged.
 */
export interface ViewportHost {
  model: ViewportModel
  /** Set scroll (screen coords), clamp via the model, and apply to the element. */
  scrollTo(x: number, y: number): void
  /** Scroll by a delta (screen coords), clamp via the model, and apply to the element. */
  scrollBy(dx: number, dy: number): void
  /** Scroll `rect` (layout coords) into view via the model, then apply to the element. */
  ensureVisible(rect: Rect, padding?: number): void
  /** Set absolute zoom (keeps the top-left content corner fixed) and re-apply to the DOM. */
  setZoom(z: number): void
  /** Zoom by `factor` about `focal` (viewport-relative screen point) and re-apply to the DOM. */
  zoomAt(factor: number, focal: Point): void
  /** Snap to the next/prev ladder stop about `focal` and re-apply to the DOM. */
  zoomToStop(dir: 1 | -1, focal: Point): void
}

export function useViewport(
  /** Outer scroll box — the fixed-height viewport (the `scoreCanvas` ref). */
  viewportEl: Ref<HTMLElement | null>,
  /** Inner content surface that hosts the SVG (the `scoreContent` ref). */
  contentEl: Ref<HTMLElement | null>,
  /** The `sizer` — explicit size = naturalSvgSize × zoom; gives the scroll bars their range. */
  sizerEl: Ref<HTMLElement | null>,
  /** The `zoomLayer` — carries `transform: scale(zoom)` above the content surface. */
  zoomLayerEl: Ref<HTMLElement | null>,
): ViewportHost {
  const model = new ViewportModel()
  // True while we are writing the model's scroll onto the element, so the `scroll` event it
  // triggers is ignored instead of being mirrored straight back into the model.
  let applying = false
  // The natural (unscaled) extent of the rendered SVG — the layout-space content size. Screen-space
  // content size is always this × zoom; that product is the single source for sizer + contentSize.
  const naturalSize = { w: 0, h: 0 }
  let viewportRO: ResizeObserver | null = null
  let svgRO: ResizeObserver | null = null
  let contentMO: MutationObserver | null = null
  let observedSvg: SVGElement | null = null

  // --- Viewport (outer box) size → model ---

  function syncViewportSize(): void {
    const el = viewportEl.value
    if (!el) return
    model.setViewportSize(el.clientWidth, el.clientHeight)
    syncScrollFromElement()
  }

  // --- Natural SVG size → naturalSize, then re-apply zoom (the single contentSize writer) ---

  function readNaturalSize(): void {
    const svg = observedSvg
    if (!svg) return
    const w = parseFloat(svg.getAttribute('width') || '0')
    const h = parseFloat(svg.getAttribute('height') || '0')
    if (w === naturalSize.w && h === naturalSize.h) return
    naturalSize.w = w
    naturalSize.h = h
    applyZoom()
  }

  /**
   * The one place `contentSize` and the zoom DOM are written: screen content size = natural × zoom.
   * The `sizer` takes that size (scroll range), the `zoomLayer` takes the matching transform, and the
   * model's `contentSize` is set to the same value (re-clamping scroll). Called after every zoom
   * change and every natural-size change, so the two paths never derive a base from each other.
   */
  function applyZoom(): void {
    const z = model.getZoom()
    const w = naturalSize.w * z
    const h = naturalSize.h * z
    const sizer = sizerEl.value
    if (sizer) {
      sizer.style.width = `${w}px`
      sizer.style.height = `${h}px`
    }
    const layer = zoomLayerEl.value
    if (layer) {
      layer.style.transformOrigin = '0 0'
      layer.style.transform = `scale(${z})`
    }
    model.setContentSize(w, h)
    applyScrollToElement()
  }

  // --- Scroll sync ---

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

  // --- SVG observer binding (the svg node is recreated on renderer re-init) ---

  function bindSvg(): void {
    const svg = contentEl.value?.querySelector('svg') ?? null
    if (svg === observedSvg) return
    if (observedSvg) svgRO?.unobserve(observedSvg)
    observedSvg = svg
    if (svg) {
      svgRO?.observe(svg)
      readNaturalSize()
    }
  }

  function attach(): void {
    const vp = viewportEl.value
    if (!vp) return
    vp.addEventListener('scroll', onScroll, { passive: true })
    viewportRO = new ResizeObserver(syncViewportSize)
    viewportRO.observe(vp)
    // Natural size: observe the rendered svg's (untransformed) border box; RO ignores ancestor
    // transforms, so this stays in layout space at any zoom.
    svgRO = new ResizeObserver(readNaturalSize)
    const content = contentEl.value
    if (content) {
      // The svg node is replaced on renderer re-init; re-bind the size observer when it changes.
      contentMO = new MutationObserver(bindSvg)
      contentMO.observe(content, { childList: true })
    }
    syncViewportSize()
    bindSvg()
  }

  function detach(): void {
    viewportEl.value?.removeEventListener('scroll', onScroll)
    viewportRO?.disconnect()
    viewportRO = null
    svgRO?.disconnect()
    svgRO = null
    contentMO?.disconnect()
    contentMO = null
    observedSvg = null
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
    scrollBy(dx, dy) {
      model.scrollBy(dx, dy)
      applyScrollToElement()
    },
    ensureVisible(rect, padding) {
      model.ensureVisible(rect, padding)
      applyScrollToElement()
    },
    setZoom(z) {
      model.setZoom(z)
      applyZoom()
    },
    zoomAt(factor, focal) {
      model.zoomAt(factor, focal)
      applyZoom()
    },
    zoomToStop(dir, focal) {
      model.zoomToStop(dir, focal)
      applyZoom()
    },
  }
}
