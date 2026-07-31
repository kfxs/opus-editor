import { ViewportModel, type PinnedGutter, type Point, type Rect } from '../engine/ViewportModel'
import { openingScroll, paddedSize, pasteboardMargins, type OpeningAlign } from '../engine/pasteboard'

/** Pasteboard left showing above the page when the score first appears, in layout px. */
const OPENING_TOP_GAP = 24

/** An element this host reads at call time. The app owns the DOM; the host only observes it. */
type ElementSource = () => HTMLElement | null

/** Is this the same pinned strip, field for field? (Both null counts.) See `setPinnedGutter`. */
function samePin(a: PinnedGutter | null, b: PinnedGutter | null): boolean {
  if (a === null || b === null) return a === b
  return a.width === b.width && a.inset === b.inset && a.overhang === b.overhang
}

/**
 * DOM host for {@link ViewportModel} — the *only* DOM-aware piece of the viewport stack.
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
 * Nothing here is framework-specific: the elements arrive as getters and the lifecycle is two
 * explicit calls, {@link ViewportHost.attach} and {@link ViewportHost.detach}. The app calls them
 * once its DOM exists.
 */
export interface ViewportHost {
  model: ViewportModel
  /** Start observing the DOM (scroll listener + the three observers). The elements must exist. */
  attach(): void
  /** Stop observing and drop every listener/observer. Safe to call twice. */
  detach(): void
  /** Set scroll (screen coords), clamp via the model, and apply to the element. */
  scrollTo(x: number, y: number): void
  /** Scroll by a delta (screen coords), clamp via the model, and apply to the element. */
  scrollBy(dx: number, dy: number): void
  /** Scroll `rect` (layout coords) into view via the model, then apply to the element. */
  ensureVisible(rect: Rect, padding?: number): void
  /**
   * How much desk the page floats on, in layout px — the app's decision (`PASTEBOARD_MARGIN`). The
   * host turns it into the per-axis margins the surface actually uses and re-sizes everything.
   */
  setPasteboard(baseLayoutPx: number): void
  /**
   * Declare (or clear) the strip pinned over the viewport's leading edge — linear view's frozen
   * gutter. It narrows the model's horizontal scroll range, so the element is re-synced: switching
   * it on while the music is panned off to the right pulls the view back onto the paper.
   */
  setPinnedGutter(gutter: PinnedGutter | null): void
  /** Set absolute zoom (keeps the top-left content corner fixed) and re-apply to the DOM. */
  setZoom(z: number): void
  /** Zoom by `factor` about `focal` (viewport-relative screen point) and re-apply to the DOM. */
  zoomAt(factor: number, focal: Point): void
  /** Snap to the next/prev ladder stop about `focal` and re-apply to the DOM. */
  zoomToStop(dir: 1 | -1, focal: Point): void
}

export function createViewportHost(
  /** Outer scroll box — the fixed-height viewport (`scoreCanvas`). */
  viewportEl: ElementSource,
  /** Inner content surface that hosts the SVG (`scoreContent`). */
  contentEl: ElementSource,
  /** The `sizer` — explicit size = naturalSvgSize × zoom; gives the scroll bars their range. */
  sizerEl: ElementSource,
  /** The `zoomLayer` — carries `transform: scale(zoom)` above the content surface. */
  zoomLayerEl: ElementSource,
  /**
   * Called after any scroll / zoom / viewport-resize settles. The linear-view gutter listens
   * here: it must repaint when the window onto the music moves, and it is the one thing on
   * screen that scrolling changes without the score itself re-rendering.
   */
  onViewChange?: () => void,
  /**
   * How the FIRST view of the score is aligned horizontally, read at opening time (not at
   * construction — the view mode is live). Linear view answers `'start'`: the music runs off to the
   * right and its frozen gutter is pinned at the leading edge, so the beginning is the only place
   * worth opening at. Everything else gets the page centred on its desk. See `openingScroll`.
   */
  openingAlign?: () => OpeningAlign,
): ViewportHost {
  const model = new ViewportModel()
  const notify = () => onViewChange?.()
  // True while we are writing the model's scroll onto the element, so the `scroll` event it
  // triggers is ignored instead of being mirrored straight back into the model.
  let applying = false
  // The natural (unscaled) extent of the rendered SVG — the layout-space content size. Screen-space
  // content size is always this × zoom; that product is the single source for sizer + contentSize.
  const naturalSize = { w: 0, h: 0 }
  /** Latched by the first real natural size — the opening scroll happens once, never on re-render. */
  let hasOpened = false
  /** The strip currently pinned over the leading edge, as last declared — see `setPinnedGutter`. */
  let pinned: PinnedGutter | null = null
  /** The app's stated desk width in layout px; `pasteboardMargins` turns it into the two margins
   *  actually used, which is why this is kept rather than the pair. 0 until the app opts in. */
  let pasteboardBase = 0
  let viewportRO: ResizeObserver | null = null
  let svgRO: ResizeObserver | null = null
  let contentMO: MutationObserver | null = null
  let observedSvg: SVGElement | null = null

  // --- Viewport (outer box) size → model ---

  function syncViewportSize(): void {
    const el = viewportEl()
    if (!el) return
    model.setViewportSize(el.clientWidth, el.clientHeight)
    // The vertical desk is a viewport tall, so a resize changes the SURFACE — not just what is
    // visible of it. applyZoom re-derives the margins, re-sizes the sizer and re-clamps.
    applyZoom()
    syncScrollFromElement()
  }

  // --- Natural SVG size → naturalSize, then re-apply zoom (the single contentSize writer) ---

  function readNaturalSize(): void {
    const svg = observedSvg
    if (!svg) return
    let w = parseFloat(svg.getAttribute('width') || '0')
    let h = parseFloat(svg.getAttribute('height') || '0')
    // scoreContent's own padding (Tailwind p-4) wraps the SVG inside the zoom layer. The sizer's
    // scroll range must include it on all four sides, or the right/bottom padding overflows past the
    // sizer and gets clipped — leaving a visible margin on the left/top only. The padding lives in
    // the (unscaled) zoom layer, so it belongs in the natural size; applyZoom multiplies by zoom.
    const content = contentEl()
    if (content) {
      const cs = getComputedStyle(content)
      w += parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      h += parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    }
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
    // The scroll surface is the page PLUS the pasteboard it floats in (src/engine/pasteboard.ts).
    // The margin is layout-space, so it is multiplied by zoom here exactly like the music: the
    // pasteboard is a fixed amount of paper, not a fixed amount of screen. Per axis, and the
    // VERTICAL one depends on the viewport (a window's worth of desk, so the music can be placed
    // anywhere in it) — which is why a viewport resize comes back through here.
    const vp = model.getViewportSize()
    const margin = pasteboardMargins(pasteboardBase, { w: vp.w / z, h: vp.h / z })
    model.setPasteboard(margin)
    const padded = paddedSize(naturalSize, margin)
    const w = padded.w * z
    const h = padded.h * z
    const insetX = margin.x * z
    const insetY = margin.y * z
    const sizer = sizerEl()
    if (sizer) {
      sizer.style.width = `${w}px`
      sizer.style.height = `${h}px`
    }
    const layer = zoomLayerEl()
    if (layer) {
      layer.style.transformOrigin = '0 0'
      // translate BEFORE scale reading left-to-right: the point is scaled, then pushed in by the
      // already-scaled margin. One transform, so the layer keeps its single containing-block role
      // for the play cursor.
      layer.style.transform = `translate(${insetX}px, ${insetY}px) scale(${z})`
    }
    model.setContentSize(w, h)
    // The opening view: centred horizontally, page-top vertically. Once only — after that the
    // scroll position is the user's, and a re-render (which changes natural size whenever a bar
    // grows) must never yank the view back.
    if (!hasOpened && naturalSize.w > 0 && naturalSize.h > 0 && pasteboardBase > 0) {
      hasOpened = true
      const open = openingScroll(
        { w, h },
        vp,
        insetY,
        OPENING_TOP_GAP * z,
        openingAlign?.() ?? 'center',
      )
      model.scrollTo(open.x, open.y)
    }
    applyScrollToElement()
    notify()
  }

  // --- Scroll sync ---

  function syncScrollFromElement(): void {
    const el = viewportEl()
    if (!el || applying) return
    model.scrollTo(el.scrollLeft, el.scrollTop)
    // The model may have CLAMPED what the element reported — the pinned gutter narrows the range
    // to less than the surface (see ViewportModel.setPinnedGutter), and a wheel or a scrollbar drag
    // reaches the surface's own end regardless. Push the clamp back, or the element sits where the
    // model says it does not and the two disagree for as long as the user keeps scrolling.
    //
    // ⚠️ To the nearest PIXEL, not exactly. A limit is a fractional number (a layout px times the
    // zoom) and `scrollLeft` holds what the element can actually hold, so exact equality can be
    // false forever — and this branch writes, which notifies, which lands back here.
    const { x, y } = model.getScroll()
    if (Math.abs(el.scrollLeft - x) > 0.5 || Math.abs(el.scrollTop - y) > 0.5) {
      applyScrollToElement()
      return
    }
    notify()
  }

  function applyScrollToElement(): void {
    const el = viewportEl()
    if (!el) return
    const { x, y } = model.getScroll()
    if (el.scrollLeft === x && el.scrollTop === y) return
    applying = true
    el.scrollLeft = x
    el.scrollTop = y
    notify()
    // The programmatic scroll fires its `scroll` event asynchronously; drop the guard next frame.
    requestAnimationFrame(() => { applying = false })
  }

  function onScroll(): void {
    syncScrollFromElement()
  }

  // --- SVG observer binding (the svg node is recreated on renderer re-init) ---

  function bindSvg(): void {
    const svg = contentEl()?.querySelector('svg') ?? null
    if (svg === observedSvg) return
    if (observedSvg) svgRO?.unobserve(observedSvg)
    observedSvg = svg
    if (svg) {
      svgRO?.observe(svg)
      readNaturalSize()
    }
  }

  function attach(): void {
    const vp = viewportEl()
    if (!vp) return
    vp.addEventListener('scroll', onScroll, { passive: true })
    viewportRO = new ResizeObserver(syncViewportSize)
    viewportRO.observe(vp)
    // Natural size: observe the rendered svg's (untransformed) border box; RO ignores ancestor
    // transforms, so this stays in layout space at any zoom.
    svgRO = new ResizeObserver(readNaturalSize)
    const content = contentEl()
    if (content) {
      // The svg node is replaced on renderer re-init; re-bind the size observer when it changes.
      contentMO = new MutationObserver(bindSvg)
      contentMO.observe(content, { childList: true })
    }
    syncViewportSize()
    bindSvg()
  }

  function detach(): void {
    viewportEl()?.removeEventListener('scroll', onScroll)
    viewportRO?.disconnect()
    viewportRO = null
    svgRO?.disconnect()
    svgRO = null
    contentMO?.disconnect()
    contentMO = null
    observedSvg = null
  }

  // No "wait for the element to appear" dance: the app builds its DOM before it calls attach(),
  // where a Vue component had to survive a render pass in which the refs were still null.
  return {
    model,
    attach,
    detach,
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
    setPasteboard(baseLayoutPx) {
      pasteboardBase = baseLayoutPx
      applyZoom()
    },
    setPinnedGutter(gutter) {
      // ⚠️ **Declaring the same strip again is not an event.** The owner of the strip re-declares it
      // on every repaint — which happens on every view change — so this is called constantly, and
      // the re-sync below notifies, which is itself a view change. Without this guard that is an
      // infinite recursion (refresh → apply → notify → refresh), and it will not terminate on
      // "the scroll didn't move" either: the limit is fractional and `scrollLeft` rounds.
      if (samePin(pinned, gutter)) return
      pinned = gutter
      const before = model.getScroll()
      model.setPinnedGutter(gutter)
      const after = model.getScroll()
      // Only when the new limit actually MOVED the view: the element must be put where the model
      // now says it is, and nothing else has any reason to touch the DOM.
      if (after.x !== before.x || after.y !== before.y) applyScrollToElement()
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
