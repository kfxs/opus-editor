import { isSeparator, isSubmenu, type MenuItem } from './MenuItem'
import { placeFlyout, placeRoot, type Point, type Rect } from './placement'

/**
 * The menu primitive — vanilla DOM, ZERO framework. Sibling to `Window`, never a kind of one.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
 * │  A menu is not a window, and the test is the window doc's own: ask what a subclass would      │
 * │  OVERRIDE. Nearly everything. A menu has no title bar and no grips, is never dragged, is      │
 * │  never stacked (there is one chain, or none), is placed AT THE POINTER, FLIPS instead of      │
 * │  clamping, and dies on Escape / outside click / selection. Spelling that through              │
 * │  WindowOptions costs four booleans that secretly cannot be combined — the exact disease       │
 * │  windows-design.md's "behaviour varies by callback, never by flag" exists to prevent.         │
 * │                                                                                              │
 * │  It DOES inherit the window's four rules whole: outside the zoom layer and the scroll box;    │
 * │  the layer is transparent to the pointer; content never knows where it is; closed means the   │
 * │  nodes are GONE.  (docs/menus-design.md)                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * It takes `(x, y, items)` and nothing else. It does not decide WHICH menu belongs to what was
 * clicked, and it looks nothing up — that is the caller's business, which is what keeps this same
 * primitive able to serve a menu bar later: a File menu is just another item tree, anchored at the
 * bottom-left corner of a button instead of at a click.
 */

const STYLE_ID = 'menu-layer-styles'

/**
 * Hover intent. A diagonal path from a submenu row down to the flyout it opened passes OVER the
 * sibling rows in between; without a delay each one of those would tear the flyout down before the
 * pointer arrived. So a row's claim on the chain is scheduled, and re-entering the flyout (whose
 * rows are deeper) cancels it.
 */
const HOVER_DELAY_MS = 140

const CSS = `
.menu-layer {
  position: absolute;
  inset: 0;
  /* Rule 2, inherited: transparent to the pointer, so an idle layer never eats a click meant for the
     score. The SCRIM below is the one deliberate exception, and it exists only while a menu is up. */
  pointer-events: none;
  /* Above the window layer (1000): a menu is never behind a window — including one opened FROM a
     window. There is no z-order among menus, because there is only ever one chain. */
  z-index: 1100;
}
/* The dismissing click is SWALLOWED. This transparent sheet is what swallows it: click outside the
   menu and the menu closes AND THE CLICK GOES NO FURTHER — it can never also drop a note on the
   paper. The cost, accepted: dismiss-then-act is two clicks. Every real editor charges this. */
.menu-scrim {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
.menu-panel {
  position: absolute;
  pointer-events: auto;
  min-width: 180px;
  max-width: 320px;
  padding: 4px;
  /* Glass, like the Keypad — the music stays visible under a menu instead of having a hole punched
     in it. But LESS glass than the Keypad's 0.45: that panel is a picture of state you glance at,
     and this is TEXT you must read. A stave showing through a label is a label you read twice. The
     blur does the other half of the job: it stops the stave lines competing with the rows on top of
     them. Heavier here (4px) than under the Keypad (1px) for that reason — a menu is READ, and it is
     transient, so the music going soft behind it for a moment is not read as a rendering fault. */
  background: rgba(31, 41, 55, 0.85);
  backdrop-filter: blur(4px);
  color: #f3f4f6;
  border: 1px solid #4b5563;
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  /* Explicit, because alignment INHERITS: the panel sits inside the score wrapper, and whatever
     centres the music was centring the rows too. A menu is a list you scan down the left edge of —
     ragged-right is what makes the labels line up as a column. */
  text-align: left;
  /* A menu is chrome, not a document: dragging across it must not smear a text selection. */
  user-select: none;
  /* Taller than the world only if the world is tiny — then it scrolls rather than hanging off it. */
  overflow-y: auto;
}
.menu-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: default;
  white-space: nowrap;
}
.menu-row-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-row-arrow {
  flex: none;
  color: #9ca3af;
  font-size: 10px;
}
/* TWO sources of highlight, and a menu needs both.
   :hover  — the row under the pointer. Reading a menu IS hovering it; a row you cannot see yourself
             on is a row you are not sure you are about to click.
   [data-active] — the row that OWNS the open flyout. Set by the layer, because that row must stay
             lit once the pointer has left it FOR its flyout, where :hover no longer holds. */
.menu-row:hover,
.menu-row[data-active="true"] { background: #2563eb; }
.menu-row:hover .menu-row-arrow,
.menu-row[data-active="true"] .menu-row-arrow { color: #dbeafe; }
.menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: #4b5563;
}
`

/** One open panel in the chain: root at depth 0, its flyout at 1, and so on. */
interface Panel {
  el: HTMLElement
  /** The row that opened THIS panel, so it can be un-lit when the panel goes. Null for the root. */
  opener: HTMLElement | null
}

export interface MenuOptions {
  /** Viewport pixels — the click, or a menu-bar button's bottom-left corner. */
  x: number
  y: number
  items: MenuItem[]
}

export class MenuLayer {
  private layer: HTMLElement | null = null
  private scrim: HTMLElement | null = null
  private chain: Panel[] = []
  private hoverTimer: ReturnType<typeof setTimeout> | null = null

  /** @param host the score viewport — the same box the app already donated to the window layer. */
  mount(host: HTMLElement): void {
    if (this.layer) return

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    const layer = document.createElement('div')
    layer.className = 'menu-layer'
    host.appendChild(layer)
    this.layer = layer

    document.addEventListener('keydown', this.onKeyDown)
    // Scrolling or resizing the world moves the paper out from under a menu that was opened ON it.
    // A menu that stayed put would then be pointing at nothing.
    window.addEventListener('resize', this.close)
    host.addEventListener('wheel', this.close, { passive: true })
  }

  destroy(): void {
    this.close()
    document.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('resize', this.close)
    this.layer?.remove()
    this.layer = null
  }

  get isOpen(): boolean {
    return this.chain.length > 0
  }

  /** Open a menu at a point. Any menu already open is closed first — there is one chain, or none. */
  open(opts: MenuOptions): void {
    if (!this.layer) throw new Error('MenuLayer.open: the layer is not mounted')
    this.close()

    const scrim = document.createElement('div')
    scrim.className = 'menu-scrim'
    // pointerdown, not click: the menu must be gone before anything downstream reacts to the press,
    // and a right-click that reopens the menu elsewhere still reaches the host's contextmenu handler
    // (the scrim is a DESCENDANT of the host, so the event bubbles up to it).
    scrim.addEventListener('pointerdown', (e) => {
      e.preventDefault() // no text-selection drag starting under a menu
      this.close()
    })
    this.layer.appendChild(scrim)
    this.scrim = scrim

    this.pushPanel(opts.items, null, (size) => placeRoot({ x: opts.x, y: opts.y }, size, this.bounds()))
  }

  close = (): void => {
    this.clearHoverTimer()
    // Closed means the nodes are GONE — rule 4, inherited. Nothing is parked with display:none.
    while (this.chain.length) this.popPanel()
    this.scrim?.remove()
    this.scrim = null
  }

  /** The world is the layer's box — the viewport, never the browser. */
  private bounds(): { width: number; height: number } {
    return {
      width: this.layer?.clientWidth ?? 0,
      height: this.layer?.clientHeight ?? 0,
    }
  }

  /**
   * Build a panel, measure it, then place it. Measured in the DOM because only the DOM knows how wide
   * a row of text is — but the ITEMS are never told the answer: the number goes to `placement.ts`,
   * which is pure, and the result is written onto the panel element. Rule 3 holds.
   */
  private pushPanel(items: MenuItem[], opener: HTMLElement | null, place: (size: { width: number; height: number }) => Point): void {
    const el = document.createElement('div')
    el.className = 'menu-panel'
    el.style.maxHeight = `${this.bounds().height}px`
    const depth = this.chain.length

    for (const item of items) {
      el.appendChild(this.buildRow(item, depth))
    }

    // Off-screen for the measure, so a panel is never seen at 0,0 before it is placed.
    el.style.visibility = 'hidden'
    this.layer!.appendChild(el)
    const { x, y } = place({ width: el.offsetWidth, height: el.offsetHeight })
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.visibility = 'visible'

    if (opener) opener.dataset.active = 'true'
    this.chain.push({ el, opener })
  }

  private popPanel(): void {
    const panel = this.chain.pop()
    if (!panel) return
    if (panel.opener) delete panel.opener.dataset.active
    panel.el.remove()
  }

  /** Tear the chain back down to `depth` panels — i.e. everything deeper than the row hovered. */
  private collapseTo(depth: number): void {
    while (this.chain.length > depth + 1) this.popPanel()
  }

  private buildRow(item: MenuItem, depth: number): HTMLElement {
    if (isSeparator(item)) {
      const sep = document.createElement('div')
      sep.className = 'menu-separator'
      return sep
    }

    const row = document.createElement('div')
    row.className = 'menu-row'

    const label = document.createElement('div')
    label.className = 'menu-row-label'
    label.textContent = item.label
    row.appendChild(label)

    if (isSubmenu(item)) {
      const arrow = document.createElement('div')
      arrow.className = 'menu-row-arrow'
      arrow.textContent = '▶'
      row.appendChild(arrow)
    }

    row.addEventListener('pointerenter', () => {
      this.clearHoverTimer()
      // Every row's claim is DELAYED, not just a submenu's: an immediate collapse on entering a plain
      // sibling row is what kills a flyout you were diagonally on your way to. Entering the flyout
      // (deeper rows) cancels this before it fires.
      this.hoverTimer = setTimeout(() => {
        this.collapseTo(depth)
        if (isSubmenu(item)) this.openFlyout(item.items, row, depth)
      }, HOVER_DELAY_MS)
    })

    // Clicking a submenu row opens it NOW — hover intent is for the pointer that is still travelling.
    row.addEventListener('click', () => {
      this.clearHoverTimer()
      if (isSubmenu(item)) {
        this.collapseTo(depth)
        if (!this.chain[depth + 1]) this.openFlyout(item.items, row, depth)
        return
      }
      // A leaf commits: the menu is gone BEFORE the callback runs, so whatever it does — open a
      // dialog, a window, another menu — is not fighting a menu that is still up.
      this.close()
      item.onSelect()
    })

    return row
  }

  private openFlyout(items: MenuItem[], row: HTMLElement, depth: number): void {
    const parent = this.chain[depth]
    if (!parent) return
    const parentRect: Rect = {
      x: parent.el.offsetLeft,
      y: parent.el.offsetTop,
      width: parent.el.offsetWidth,
      height: parent.el.offsetHeight,
    }
    // The flyout's top lines up with its own row, wherever that row sits inside a scrolled panel.
    const rowY = parentRect.y + row.offsetTop - parent.el.scrollTop
    this.pushPanel(items, row, (size) => placeFlyout(parentRect, rowY, size, this.bounds()))
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer === null) return
    clearTimeout(this.hoverTimer)
    this.hoverTimer = null
  }

  /** Escape closes ONE level — the flyout you are in, not the whole chain you were reading. */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.isOpen) return
    e.preventDefault()
    e.stopPropagation()
    if (this.chain.length > 1) this.popPanel()
    else this.close()
  }
}
