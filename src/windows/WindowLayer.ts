import { WindowManager } from './WindowManager'
import { Window, type ResizeEdges, type WindowOptions } from './Window'
import type { Widget } from './content/Widget'

/**
 * The window primitive — vanilla DOM, ZERO framework.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
 * │  🚨 NOTHING ABOUT A WINDOW IS EVER WRITTEN IN App.vue.                                        │
 * │                                                                                              │
 * │  Defining a window is COMPOSING WIDGETS — plain TS, nothing to do with Vue. Every window      │
 * │  lives in its own .ts module (see demo/loremWindows.ts) and a .vue file may only CALL it.     │
 * │                                                                                              │
 * │  App.vue's entire share is TWO lines, forever — mount() and destroy() — and only because Vue  │
 * │  owns the DOM node and the lifecycle hooks. The LAYER ITSELF lives in windows/index.ts, so    │
 * │  any plain-TS module can import it and open a window without the component's help.            │
 * │                                                                                              │
 * │  WHY: this system imports no framework, so it ports for free. The moment a window's           │
 * │  DEFINITION sits in App.vue, THAT WINDOW DOES NOT PORT — you keep the engine and throw away   │
 * │  every actual window. The value of framework-agnostic is not in WindowLayer; it is in the     │
 * │  WINDOWS.  (docs/windows-design.md)                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Creates a frame when a window opens and REMOVES it when it closes (closed means the nodes are
 * gone, not hidden — docs/windows-design.md rule 4), and writes styles straight onto the element
 * while dragging, which never touches a reactive system.
 *
 * It imports no framework, so there is nothing to port: this file runs unchanged in a Vue, React or
 * hand-rolled app. The only thing the app supplies is a DOM node to mount into, and the only thing
 * it gets back from `open()` is a DOM node to fill. What goes in that box is not this file's
 * business.
 *
 * Two placement rules it exists to enforce (windows-design.md, rules 1 and 2):
 *   - The layer fills the score VIEWPORT — a sibling of the scroll box, so it is OUTSIDE that box
 *     and OUTSIDE the `transform: scale(zoom)` layer inside it. A window therefore neither scrolls
 *     away with the music nor scales with it (window size is UI scale, score zoom is music scale),
 *     while still living *in* the viewport: the host's `overflow-hidden` clips it there, and the
 *     drag arithmetic is bounded by the host's box, so a window cannot be dragged out of the score
 *     area. The whole application is meant to live inside the viewport.
 *   - The layer is `pointer-events: none` and each window is `pointer-events: auto`, or the overlay
 *     would swallow every click meant for the score.
 */

const STYLE_ID = 'window-layer-styles'

const CSS = `
.window-layer {
  /* Absolute, not fixed: the layer fills its host — the score viewport — and is clipped by it. */
  position: absolute;
  inset: 0;
  /* Rule 2: transparent to the pointer, so clicks fall through empty space to the score. */
  pointer-events: none;
  z-index: 1000;
}
.window-frame {
  position: absolute;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* The frame's ALPHA is the window's own (WindowOptions.opacity); the colour is the system's. A
     translucent window floats over the music instead of punching a hole in it — and the music behind
     it stays SHARP: no backdrop blur, because a blurred stave reads as a rendering fault. */
  background: rgba(31, 41, 55, var(--window-alpha, 1));
  color: #f3f4f6;
  border: 1px solid #4b5563;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  font-family: system-ui, sans-serif;
  /* A window is chrome, not a document: dragging one must not smear a text selection across it. */
  user-select: none;
}
/* A see-through window softens what is behind it — just enough that the stave stops competing with
   the keys on top of it, and not so much that the score looks out of focus. Opaque windows have no
   backdrop filter at all: it would be a cost with nothing to show. */
.window-frame[data-translucent="true"] {
  backdrop-filter: blur(1px);
}
/* …except where text selection IS the point. A field you cannot select inside is broken. */
.window-frame input,
.window-frame textarea {
  user-select: text;
}
.window-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  /* SOLID, whatever the window's opacity. The title bar is the handle you grab and the name you
     read; a see-through handle is a worse handle. Only the window's BODY is glass. */
  background: #374151;
  border-bottom: 1px solid #4b5563;
  cursor: move;
  user-select: none;
  flex: none;
}
.window-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.window-close {
  flex: none;
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #d1d5db;
  cursor: pointer;
  font-size: 14px;
}
.window-close:hover { background: #dc2626; color: #fff; }
/* The window pads its own box, so no widget has to remember to. A widget that takes over the
   scrolling (Columns, Column) keeps this padding and scrolls INSIDE it. */
.window-content {
  flex: 1;
  min-height: 0;
  /* A flex column, so a container widget fills it with flex:1 rather than height:100% — which
     would collapse to auto while the frame is measured for fitContent. */
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.5;
}
/* Eight grips. They sit just inside the frame, so they never widen it. */
.window-grip { position: absolute; }
.window-grip[data-edge="n"]  { top: -2px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.window-grip[data-edge="s"]  { bottom: -2px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.window-grip[data-edge="w"]  { left: -2px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.window-grip[data-edge="e"]  { right: -2px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.window-grip[data-edge="nw"] { top: -2px; left: -2px; width: 12px; height: 12px; cursor: nwse-resize; }
.window-grip[data-edge="ne"] { top: -2px; right: -2px; width: 12px; height: 12px; cursor: nesw-resize; }
.window-grip[data-edge="sw"] { bottom: -2px; left: -2px; width: 12px; height: 12px; cursor: nesw-resize; }
.window-grip[data-edge="se"] { bottom: -2px; right: -2px; width: 12px; height: 12px; cursor: nwse-resize; }
`

const GRIPS: Array<{ edge: string; edges: ResizeEdges }> = [
  { edge: 'n', edges: { north: true } },
  { edge: 's', edges: { south: true } },
  { edge: 'w', edges: { west: true } },
  { edge: 'e', edges: { east: true } },
  { edge: 'nw', edges: { north: true, west: true } },
  { edge: 'ne', edges: { north: true, east: true } },
  { edge: 'sw', edges: { south: true, west: true } },
  { edge: 'se', edges: { south: true, east: true } },
]

/** A live pointer drag: either the title bar (move) or one grip (resize). */
interface DragSession {
  win: Window
  pointerId: number
  lastX: number
  lastY: number
  edges: ResizeEdges | null
}

export class WindowLayer {
  readonly manager = new WindowManager()

  private layer: HTMLElement | null = null
  private host: HTMLElement | null = null
  private frames = new Map<string, HTMLElement>()
  private contents = new Map<string, Widget>()
  private drag: DragSession | null = null
  private unsubscribe: (() => void) | null = null
  private resizeObserver: ResizeObserver | null = null
  private pending: ((host: HTMLElement) => void)[] = []

  /**
   * Run something once the layer HAS a box — i.e. once the app has donated one. A window opened
   * before that has nowhere to be, so anything that wants to open on startup waits here instead of
   * racing the app's mount. If the layer is already up, it runs now.
   *
   * The HOST is handed through because the app donates exactly ONE box and other overlays want it
   * too — the menu layer mounts into the same element (docs/menus-design.md). Whoever needs the box
   * asks the layer that already has it, so `App.vue` never grows a third line.
   */
  whenMounted(fn: (host: HTMLElement) => void): void {
    if (this.host) fn(this.host)
    else this.pending.push(fn)
  }

  /**
   * @param host the element the layer fills — the score viewport. It must be a positioning context
   * (`position: relative`), and if it clips (`overflow: hidden`) then so are the windows, which is
   * the point: windows live *inside* the viewport.
   */
  mount(host: HTMLElement): void {
    if (this.layer) return

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    const layer = document.createElement('div')
    layer.className = 'window-layer'
    host.appendChild(layer)
    this.layer = layer
    this.host = host

    // Windows are clamped to the HOST's box, not the browser's: dragging cannot take one out of
    // the score area. ResizeObserver rather than window.onresize, because the viewport can change
    // size on its own (a zoom of the app, a layout change) with no window resize event.
    this.resizeObserver = new ResizeObserver(() => this.syncBounds())
    this.resizeObserver.observe(host)
    this.syncBounds()

    // Pointer events on the LAYER, not per grip: a fast drag outruns the element under the cursor.
    layer.addEventListener('pointermove', this.onPointerMove)
    layer.addEventListener('pointerup', this.onPointerUp)
    layer.addEventListener('pointercancel', this.onPointerUp)

    this.unsubscribe = this.manager.subscribe(() => this.sync())

    const pending = this.pending
    this.pending = []
    for (const fn of pending) fn(host)
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.unsubscribe?.()
    this.unsubscribe = null
    // Explicitly, and BEFORE closeAll: we just unsubscribed, so sync() will not run to do it for us.
    for (const content of this.contents.values()) content.destroy?.()
    this.contents.clear()
    this.manager.closeAll()
    this.layer?.remove()
    this.layer = null
    this.host = null
    this.frames.clear()
  }

  /**
   * Open a window and hand back the {@link Window} itself — hold it, `setTitle()` it, `close()` it.
   *
   * Its content is whatever you passed in `opts.content`: a string, a DOM tree, a framework
   * component. The window system does not know and does not ask. `destroy()` is called on it when
   * the window closes. If you'd rather fill the box by hand, `win.box` is the element.
   */
  open(opts: WindowOptions = {}): Window {
    const win = this.manager.open(opts)
    if (!this.frames.has(win.id)) {
      throw new Error(`WindowLayer.open: no frame for ${win.id} — is the layer mounted?`)
    }
    return win
  }

  /** The content box of an open window, for filling by hand instead of with a Widget. */
  box(win: Window): HTMLElement | null {
    return this.frames.get(win.id)?.querySelector('.window-content') ?? null
  }

  /** Reconcile the DOM with the manager's state: add what's new, remove what's gone, restack. */
  private sync(): void {
    if (!this.layer) return
    const live = new Set<string>()

    for (const win of this.manager.list()) {
      live.add(win.id)
      let frame = this.frames.get(win.id)
      if (!frame) {
        frame = this.createFrame(win)
        this.frames.set(win.id, frame)
        this.layer.appendChild(frame)
        // BEFORE the content goes in: the frame must already be its real WIDTH, or `fitContent`
        // measures the height of text wrapped to the wrong width. An absolutely-positioned frame with
        // no width shrink-to-fits against the whole layer, so the text wraps into far fewer lines than
        // it will at the window's actual width — and the window opens too short, clipping its content.
        this.applyGeometry(win)
        // Mount content only once the frame is IN the document: content that relies on a percentage
        // height needs a laid-out box to resolve against.
        if (win.content) {
          this.contents.set(win.id, win.content)
          win.content.mount(frame.querySelector('.window-content') as HTMLElement)
        }
        if (win.fitContent) this.fitToContent(win, frame)
      }
      const label = frame.querySelector('.window-title') as HTMLElement
      if (label.textContent !== win.title) label.textContent = win.title
      frame.style.zIndex = String(win.z)
      this.applyGeometry(win)
    }

    for (const [id, frame] of this.frames) {
      if (live.has(id)) continue
      this.contents.get(id)?.destroy?.() // let content release what it owns, before its DOM goes
      this.contents.delete(id)
      frame.remove() // closed means the nodes are GONE
      this.frames.delete(id)
    }
  }

  private createFrame(win: Window): HTMLElement {
    const frame = document.createElement('div')
    frame.className = 'window-frame'
    frame.dataset.windowId = win.id

    // The alpha of the frame's background. NOT `style.opacity`: that would fade the CONTENT too —
    // the glyphs, the text, the keys — and a panel you can see THROUGH is not the same thing as a
    // panel that has gone faint.
    frame.style.setProperty('--window-alpha', String(win.opacity))
    if (win.opacity < 1) frame.dataset.translucent = 'true'

    const bar = document.createElement('div')
    bar.className = 'window-titlebar'

    const label = document.createElement('div')
    label.className = 'window-title'
    label.textContent = win.title
    bar.appendChild(label)

    if (win.closable) {
      const close = document.createElement('button')
      close.className = 'window-close'
      close.type = 'button'
      close.textContent = '✕'
      close.setAttribute('aria-label', 'Close window')
      close.addEventListener('pointerdown', (e) => e.stopPropagation()) // don't start a move
      close.addEventListener('click', () => win.close())
      bar.appendChild(close)
    }

    bar.addEventListener('pointerdown', (e) => this.startDrag(e, win, null))

    const content = document.createElement('div')
    content.className = 'window-content'

    frame.append(bar, content)

    // A fixed-size window simply has no grips.
    if (win.resizable) {
      for (const grip of GRIPS) {
        const el = document.createElement('div')
        el.className = 'window-grip'
        el.dataset.edge = grip.edge
        el.addEventListener('pointerdown', (e) => this.startDrag(e, win, grip.edges))
        frame.appendChild(el)
      }
    }

    // Anywhere on the window raises it — including the content.
    frame.addEventListener('pointerdown', () => win.raise())

    return frame
  }

  /**
   * Open at exactly the height the content needs, so nothing has to scroll.
   *
   * Only the DOM knows how tall a paragraph is, so the measurement lives here and the *result* goes
   * back to the window — which keeps the rule intact: the content still never learns its own size,
   * it is the window that is told. Measured by letting the frame size to its content for one frame
   * (`height: auto`), then handing the number over; `applyGeometry` immediately writes an explicit
   * height back, so the window is a fixed box again and stays resizable.
   */
  private fitToContent(win: Window, frame: HTMLElement): void {
    const height = frame.style.height
    frame.style.height = 'auto'
    const natural = frame.offsetHeight
    frame.style.height = height
    // Never taller than the world: the viewport CLIPS, so a window that overflowed it would hide the
    // very content `fitContent` exists to reveal — and on a fixed-size window there is not even a
    // grip to drag it back. If the content genuinely doesn't fit, the window is too narrow: widen it.
    win.setSize(win.rect.width, Math.min(natural, this.manager.bounds().height))
  }

  /** Direct style writes, deliberately: a drag frame must not go through a reactive system. */
  private applyGeometry(win: Window): void {
    const frame = this.frames.get(win.id)
    if (!frame) return
    const { x, y, width, height } = win.rect
    frame.style.transform = `translate(${x}px, ${y}px)`
    frame.style.width = `${width}px`
    frame.style.height = `${height}px`
  }

  private startDrag(e: PointerEvent, win: Window, edges: ResizeEdges | null): void {
    if (e.button !== 0) return
    e.preventDefault()
    this.layer?.setPointerCapture(e.pointerId)
    this.drag = { win, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY, edges }
  }

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drag
    if (!drag || e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY

    // The window does its own arithmetic — it owns its geometry, and it knows its own floors.
    if (drag.edges) drag.win.resizeBy(drag.edges, dx, dy)
    else drag.win.moveBy(dx, dy)

    this.applyGeometry(drag.win)
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return
    this.layer?.releasePointerCapture(e.pointerId)
    this.drag = null
  }

  /** The host's box IS the world: windows are clamped to the viewport, never to the browser. */
  private syncBounds = (): void => {
    if (!this.layer) return
    this.manager.setBounds(this.layer.clientWidth, this.layer.clientHeight)
    for (const win of this.manager.list()) this.applyGeometry(win)
  }
}
