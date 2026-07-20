import { Window, WINDOW_DEFAULTS, type WindowHost, type WindowOptions } from './Window'

/**
 * The list of open windows, and the z-order. Pure state, ZERO DOM.
 *
 * A {@link Window} owns its own properties and its own geometry; the manager owns only what a single
 * window cannot know — who else is open, who is on top, and how big the world is. It is the windows'
 * {@link WindowHost}: they call back into it to close and to raise themselves.
 *
 * See docs/windows-design.md.
 */

/** Each new window steps down-right from the last, so a second one is visibly a second one. */
const CASCADE_STEP = 28
const CASCADE_ORIGIN = { x: 40, y: 40 }
const CASCADE_WRAP = 8

export class WindowManager implements WindowHost {
  private windows: Window[] = []
  private nextId = 1
  private topZ = 0
  private opened = 0
  /** The area windows are kept inside. The DOM layer supplies it; the manager just holds it. */
  private box = { width: Infinity, height: Infinity }
  private listeners = new Set<() => void>()

  /** Notified when the SET of windows, the z-order, or a title changes — NOT on every drag frame. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }

  setBounds(width: number, height: number): void {
    this.box = { width, height }
    for (const w of this.windows) w.reclamp()
  }

  bounds(): { width: number; height: number } {
    return this.box
  }

  /** Bottom-to-top: iterate in stacking order. */
  list(): readonly Window[] {
    return [...this.windows].sort((a, b) => a.z - b.z)
  }

  get(id: string): Window | undefined {
    return this.windows.find((w) => w.id === id)
  }

  /** Open a new window, or an existing one you built yourself. */
  open(optsOrWindow: WindowOptions | Window = {}): Window {
    const win =
      optsOrWindow instanceof Window
        ? optsOrWindow
        : new Window(`win-${this.nextId++}`, this.cascade(optsOrWindow))

    win.attach(this)
    win.z = ++this.topZ
    win.reclamp()
    this.windows.push(win)
    this.emit()
    return win
  }

  /**
   * The window Escape belongs to: the FRONTMOST one that declares an {@link WindowOptions.onCancel},
   * or none.
   *
   * Frontmost-that-declares, rather than simply the frontmost window, because the standing panels
   * are always on the glass too — clicking the Keypad raises it above an open dialog, and Escape
   * must not stop cancelling that dialog just because you touched a panel on the way. Panels declare
   * no handler, so they are transparent to the key rather than in front of it.
   */
  escapeTarget(): Window | undefined {
    return this.frontmostWith((w) => w.onCancel !== null)
  }

  /** The window Enter belongs to — the same rule as {@link escapeTarget}, for the default button. */
  acceptTarget(): Window | undefined {
    return this.frontmostWith((w) => w.onAccept !== null)
  }

  private frontmostWith(claims: (win: Window) => boolean): Window | undefined {
    // list() is bottom-to-top and readonly; a key wants the top, so walk it backwards.
    const stack = this.list()
    for (let i = stack.length - 1; i >= 0; i--) {
      if (claims(stack[i])) return stack[i]
    }
    return undefined
  }

  close(win: Window | string): boolean {
    const id = typeof win === 'string' ? win : win.id
    const i = this.windows.findIndex((w) => w.id === id)
    if (i === -1) return false
    this.windows.splice(i, 1)
    this.emit()
    return true
  }

  closeAll(): void {
    if (!this.windows.length) return
    this.windows = []
    this.emit()
  }

  /** Bring to front. No-op (and no event) if already there, so a click on the top window is free. */
  raise(win: Window | string): boolean {
    const w = typeof win === 'string' ? this.get(win) : win
    if (!w || w.z === this.topZ) return false
    w.z = ++this.topZ
    this.emit()
    return true
  }

  /** A window changed something the DOM must be told about — a title, mainly. Geometry does not come here. */
  changed(): void {
    this.emit()
  }

  /** Give a window that did not ask for a position one that does not sit exactly on the last one. */
  private cascade(opts: WindowOptions): WindowOptions {
    if (opts.x !== undefined && opts.y !== undefined) return opts
    // A centred window asks for a position of its own; stamping the cascade on it here would read as
    // an explicit x/y and cancel the centring before the layer ever sees it.
    if (opts.center) return opts
    const step = this.opened % CASCADE_WRAP
    this.opened++
    return {
      ...opts,
      x: opts.x ?? CASCADE_ORIGIN.x + step * CASCADE_STEP,
      y: opts.y ?? CASCADE_ORIGIN.y + step * CASCADE_STEP,
    }
  }
}

export { Window, WINDOW_DEFAULTS }
export type { WindowOptions }
export type { ResizeEdges, Rect } from './Window'
