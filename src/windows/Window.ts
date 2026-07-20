import type { Widget } from './content/Widget'

/**
 * A window. You instantiate it, you hold it, you act on it.
 *
 * ONE class, configured by PROPERTIES — never a subclass per kind of window. A window is never a
 * different kind of thing; it is the same frame with different settings. Subclassing forces you to
 * name every combination (`ResizableTwoColumnWindow`); properties compose for free. The variation
 * that matters lives in {@link Widget}, which is handed to a window, not inherited by it.
 *
 * Geometry lives here and never in the content (docs/windows-design.md, rule 3): content fills the
 * box it is handed and never reads its own x/y. Hence no DOM in this file — the window knows where
 * it is, and what is inside it does not.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowOptions {
  title?: string
  width?: number
  height?: number
  /** Omit to let the manager cascade the window from the last one. */
  x?: number
  y?: number
  /** Fixed-size window: the grips are not rendered. */
  resizable?: boolean
  /** No close button. (It can still be closed in code.) */
  closable?: boolean
  /** Below this the window is a useless sliver, and the resize arithmetic simply stops. */
  minWidth?: number
  minHeight?: number
  /**
   * Size the window to its content once, on open, instead of using `height` — so the content is
   * fully visible and nothing has to scroll. The window stays resizable afterwards; this only sets
   * the opening height. The DOM layer measures it, because only the DOM knows how tall text is.
   */
  fitContent?: boolean
  /**
   * Open in the MIDDLE of the box instead of on the cascade. Applied once, on open, and only after
   * `fitContent` has settled the height — centring against the requested height would leave a
   * fit-to-content window visibly off-centre. Afterwards the window is an ordinary one: dragging it
   * is not fought, and a later resize does not re-centre it.
   *
   * A dialog the user just summoned belongs where they are already looking; the cascade is for
   * windows that accumulate. Explicit `x`/`y` still win.
   */
  center?: boolean
  /**
   * How solid the window's BACKGROUND is, 0–1 — the title bar and the content stay as they are.
   * Below 1 the score shows through, so a panel that lives ON TOP of the music — a Keypad, a mixer —
   * does not take the music away while it is up. A window that must be READ stays at 1.
   *
   * A property and not a subclass, for the reason at the top of this file: it composes with every
   * other setting, and no one has to name the translucent-fixed-size-unclosable window.
   */
  opacity?: number
  content?: Widget
}

/** Which sides a resize drag is pulling. A corner pulls two. */
export interface ResizeEdges {
  north?: boolean
  south?: boolean
  east?: boolean
  west?: boolean
}

export const WINDOW_DEFAULTS = {
  title: 'Window',
  /** Modest on purpose: the world is the score viewport (~415px tall), not the browser. */
  width: 320,
  height: 200,
  resizable: true,
  closable: true,
  minWidth: 160,
  minHeight: 90,
  /** Solid: a window you can see through is the exception, and it has to ask. */
  opacity: 1,
}

/** Set by the manager, which owns the list and the stacking. A window never closes/raises itself. */
export interface WindowHost {
  close(win: Window): void
  raise(win: Window): void
  /** The box the window is kept inside — the viewport, never the browser. */
  bounds(): { width: number; height: number }
  /** The window changed in a way the DOM must be told about (title, z). Geometry does not go here. */
  changed(win: Window): void
}

/** An opacity outside 0–1 is a typo, not an intention: a window is never MORE than solid. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export class Window {
  readonly id: string
  readonly resizable: boolean
  readonly closable: boolean
  readonly minWidth: number
  readonly minHeight: number
  readonly fitContent: boolean
  /** Cleared the moment the layer has centred it — centring is an OPENING act, not a standing rule. */
  centerOnOpen: boolean
  /** 0–1. See {@link WindowOptions.opacity}. */
  readonly opacity: number
  readonly content: Widget | null

  rect: Rect
  /** Stacking order. Higher is nearer the viewer; the manager re-stamps it on raise. */
  z = 0

  private host: WindowHost | null = null
  private titleText: string

  constructor(id: string, opts: WindowOptions = {}) {
    this.id = id
    this.titleText = opts.title ?? WINDOW_DEFAULTS.title
    this.resizable = opts.resizable ?? WINDOW_DEFAULTS.resizable
    this.closable = opts.closable ?? WINDOW_DEFAULTS.closable
    this.minWidth = opts.minWidth ?? WINDOW_DEFAULTS.minWidth
    this.minHeight = opts.minHeight ?? WINDOW_DEFAULTS.minHeight
    this.fitContent = opts.fitContent ?? false
    // Explicit coordinates beat centring, the same way they beat the cascade.
    this.centerOnOpen = (opts.center ?? false) && opts.x === undefined && opts.y === undefined
    this.opacity = clamp01(opts.opacity ?? WINDOW_DEFAULTS.opacity)
    this.content = opts.content ?? null
    this.rect = {
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      width: opts.width ?? WINDOW_DEFAULTS.width,
      height: opts.height ?? WINDOW_DEFAULTS.height,
    }
  }

  /** Called by the manager when the window is opened. Not part of the public surface. */
  attach(host: WindowHost): void {
    this.host = host
  }

  get title(): string {
    return this.titleText
  }

  setTitle(title: string): void {
    if (title === this.titleText) return
    this.titleText = title
    this.host?.changed(this)
  }

  close(): void {
    this.host?.close(this)
  }

  raise(): void {
    this.host?.raise(this)
  }

  /** Drag by the title bar. Clamped, so a window can never be dropped out of reach. */
  moveBy(dx: number, dy: number): void {
    this.rect = this.clamp({ ...this.rect, x: this.rect.x + dx, y: this.rect.y + dy })
  }

  moveTo(x: number, y: number): void {
    this.rect = this.clamp({ ...this.rect, x, y })
  }

  /** Set the size outright — the floors and the bounds still apply. */
  setSize(width: number, height: number): void {
    this.rect = this.clamp({
      ...this.rect,
      width: Math.max(this.minWidth, width),
      height: Math.max(this.minHeight, height),
    })
  }

  /**
   * Drag an edge or a corner. Pulling `west`/`north` moves the origin as well as the size — and once
   * the size hits the floor the origin stops with it, so a window resized past its minimum stays put
   * instead of sliding away under the cursor.
   */
  resizeBy(edges: ResizeEdges, dx: number, dy: number): void {
    if (!this.resizable) return
    let { x, y, width, height } = this.rect

    if (edges.east) width += dx
    if (edges.west) {
      const next = Math.max(this.minWidth, width - dx)
      x += width - next
      width = next
    }
    if (edges.south) height += dy
    if (edges.north) {
      const next = Math.max(this.minHeight, height - dy)
      y += height - next
      height = next
    }

    this.rect = this.clamp({
      x,
      y,
      width: Math.max(this.minWidth, width),
      height: Math.max(this.minHeight, height),
    })
  }

  /** Re-clamp after the viewport changed size. */
  reclamp(): void {
    this.rect = this.clamp(this.rect)
  }

  /**
   * Keep the window inside the bounds — but never grow it, and never let the clamp itself shrink one
   * below its floor when the bounds are tiny (a 200px-tall viewport must not mangle geometry you
   * will get back when it is enlarged again).
   */
  private clamp(rect: Rect): Rect {
    const bounds = this.host?.bounds() ?? { width: Infinity, height: Infinity }
    const maxX = Math.max(0, bounds.width - rect.width)
    const maxY = Math.max(0, bounds.height - rect.height)
    return {
      ...rect,
      x: Math.min(Math.max(0, rect.x), maxX),
      y: Math.min(Math.max(0, rect.y), maxY),
    }
  }
}
