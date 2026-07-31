import { isColumnBreak, isSeparator, isSubmenu, type MenuItem } from './MenuItem'
import { placeFlyout, placeRoot, type Point, type Rect } from './placement'
import { CHROME } from '../utils/chromeColors'

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

/** How far the pointer must actually travel to take control back from the keyboard. A few pixels of
 *  slack absorbs the jitter and the synthetic events a stationary mouse still emits. */
const POINTER_WAKE_PX = 4

/** The keys that mean "the keyboard is driving now" — everything the menu itself acts on. */
const KEYBOARD_DRIVING_KEYS = new Set(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'])

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
  background: rgba(${CHROME.glassRgb}, 0.85);
  backdrop-filter: blur(4px);
  color: ${CHROME.ink};
  border: 1px solid ${CHROME.edge};
  border-radius: 6px;
  box-shadow: ${CHROME.shadow};
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
.menu-panel-columns {
  /* A palette lays its groups out SIDE BY SIDE. Stacked, the expression menu's two groups run off
     the bottom of the viewport; in columns the same rows fit on screen at once — which is the whole
     reason for the wide shape, not fidelity to Sibelius for its own sake. */
  display: flex;
  align-items: flex-start;
  gap: 4px;
  /* The single-column cap is what keeps an ordinary menu from growing into a banner. A palette is
     deliberately wide, so it opts out — placement is pure and size-driven, so a wider panel still
     flips and clamps correctly with no arithmetic of its own. */
  max-width: none;
}
.menu-column {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}
.menu-column + .menu-column {
  border-left: 1px solid ${CHROME.edge};
  padding-left: 4px;
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
/* A label that IS music: set in the score's own font so the row shows the mark you will get, not a
   description of it. Bravura leads here — unlike anywhere text is being SET, where a music font
   first would lend its notation-sized spaces and line box to ordinary type (see utils/fontStack).
   These labels are nothing but glyphs, so that trade does not arise; the sans stays behind it only
   to catch a stray letter. Sized up because SMuFL glyphs are drawn against a staff, not a text line,
   and at label size a dynamic is a smudge. */
.menu-row-label-music {
  font-family: Bravura, system-ui, sans-serif;
  font-size: 1.7em;
  /* The glyphs are tall and the rows must stay a tight palette, so the line box is pinned rather
     than left to the font's own generous metrics. */
  line-height: 0.85;
  overflow: visible;
}
/* A note-VALUE glyph (metNote / text-note family). Unlike a dynamic it is drawn to sit INLINE in
   tempo text, so it is smaller — and it carries ALL its ink above the baseline (notehead on the
   line, stem and flags up), which a row centred by its line box leaves riding high above the
   Ctrl+Num text. Smaller size keeps the tall glyphs (the 32nd's three flags) from towering, and the
   nudge drops the notehead onto the row's centre. Kerning lives here, not on the dynamics above:
   the beamed groups (note + continuation + fractional-beam note) only join when it is applied. */
.menu-row-label-note {
  font-family: Bravura, system-ui, sans-serif;
  font-size: 1.35em;
  line-height: 0.9;
  overflow: visible;
  transform: translateY(0.16em);
  font-kerning: normal;
  font-feature-settings: "kern" 1;
}
/* Expression words, set as the score sets them: the same serif italic the engraver uses, so the row
   is a specimen of the mark rather than a description of it. The family is spelled here rather than
   imported from the renderer's DYNAMIC_TEXT_FONT — a menu reaching into the engine for a font stack
   would be a far worse coupling than one duplicated list of serif names. */
.menu-row-label-italic {
  font-family: Georgia, "Times New Roman", Times, serif;
  font-style: italic;
  font-size: 1.15em;
}
/* Tempo words, set as the score sets them: upright bold serif, the same specimen-not-description
   reasoning as the italic above. The engraver draws tempo text bold (VexFlow's StaveTempo), and a
   row reading a word like Allegro in the thin UI sans would describe the mark rather than BE it. */
.menu-row-label-bold {
  font-family: Georgia, "Times New Roman", Times, serif;
  font-weight: 700;
  font-size: 1.15em;
}
.menu-row-arrow {
  flex: none;
  color: ${CHROME.inkMuted};
  font-size: 10px;
}
.menu-row-shortcut {
  flex: none;
  color: ${CHROME.inkMuted};
  font-size: 12px;
  font-style: italic;
}
/* THREE sources of highlight, and a menu needs all three.
   :hover  — the row under the pointer. Reading a menu IS hovering it; a row you cannot see yourself
             on is a row you are not sure you are about to click.
   [data-active] — the row that OWNS the open flyout. Set by the layer, because that row must stay
             lit once the pointer has left it FOR its flyout, where :hover no longer holds.
   [data-highlight] — the row the ARROW KEYS are on. The pointer's :hover for the keyboard: this is
             the row Enter would commit and Right would open, so it must look exactly like the one a
             mouse is over. */
/* KEYBOARD MODE. Once the arrows are driving, the pointer stops voting: its :hover is suppressed and
   the cursor is hidden outright, so wherever it happens to be resting cannot look like the row Enter
   would commit. It comes straight back the moment the mouse actually MOVES — this is a mode the
   keyboard enters, never one the user has to leave. */
.menu-layer-keyboard { cursor: none; }
.menu-layer-keyboard .menu-row:hover { background: transparent; }
.menu-layer-keyboard .menu-row:hover .menu-row-arrow,
.menu-layer-keyboard .menu-row:hover .menu-row-shortcut { color: ${CHROME.inkMuted}; }
.menu-row:hover,
.menu-row[data-active="true"],
.menu-row[data-highlight="true"] { background: ${CHROME.accent}; }
.menu-row:hover .menu-row-arrow,
.menu-row[data-active="true"] .menu-row-arrow,
.menu-row[data-highlight="true"] .menu-row-arrow,
.menu-row:hover .menu-row-shortcut,
.menu-row[data-active="true"] .menu-row-shortcut,
.menu-row[data-highlight="true"] .menu-row-shortcut { color: #dbeafe; }
.menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: ${CHROME.edge};
}
`

/** A leaf or a submenu — every menu item except the two that are pure LAYOUT (a separator, a column
 *  break). Those are the things a row can be that the keyboard can neither highlight, open nor
 *  commit, so keeping them out of this type is what makes `rows` safe to walk. */
type SelectableItem = Exclude<MenuItem, { separator: true } | { columnBreak: true }>

/** Anything that paints an actual row. A column break never gets here — it is consumed while the
 *  panel is being laid out, and the type says so. */
type RowItem = Exclude<MenuItem, { columnBreak: true }>

/** A row the arrow keys can land on — its element, paired with the item it paints. Separators are
 *  not in this list: you cannot highlight, open or commit a divider. */
interface RowRef {
  el: HTMLElement
  item: SelectableItem
  /** Which column it sits in (0 for an ordinary single-stack menu) and how far down that column.
   *  Together these make `rows` a GRID the arrows can walk, while it stays a flat list in reading
   *  order for everything else — building, hovering, committing. */
  column: number
  row: number
}

/** One open panel in the chain: root at depth 0, its flyout at 1, and so on. */
interface Panel {
  el: HTMLElement
  /** The row that opened THIS panel, so it can be un-lit when the panel goes. Null for the root. */
  opener: HTMLElement | null
  /** The selectable rows, top to bottom — what the arrow keys walk. Separators are excluded. */
  rows: RowRef[]
  /** Index into `rows` of the arrow-key highlight, or -1 when the keyboard has not landed here yet. */
  highlight: number
}

export interface MenuOptions {
  /** Viewport pixels — the click, or a menu-bar button's bottom-left corner. */
  x: number
  y: number
  items: MenuItem[]
  /**
   * Opened by a KEYSTROKE rather than a click. The menu then starts in keyboard mode: cursor hidden,
   * hover muted, from the moment it appears.
   *
   * Without this, a menu summoned by a key lands under wherever the mouse happened to be resting and
   * that row lights up — a selection the keyboard does not own and cannot act on, so the first arrow
   * press appears to jump somewhere else entirely. Whoever opens the menu knows which input asked
   * for it; the layer cannot tell.
   */
  viaKeyboard?: boolean
  /**
   * This menu has gone — dismissed, Escaped, committed, or replaced by another. Fires exactly once.
   *
   * The MENU BAR is why it exists: the title that owns the open menu stays lit while the pointer is
   * anywhere else, and the five ways a menu can die are all the LAYER's business, not the opener's.
   * Whoever anchors a menu to something visible needs to be told when to put that thing out.
   */
  onClose?: () => void
}

export class MenuLayer {
  private layer: HTMLElement | null = null
  private scrim: HTMLElement | null = null
  private chain: Panel[] = []
  private hoverTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * True once the arrows are driving. While set, the pointer neither highlights nor opens anything
   * and the cursor is hidden — otherwise a mouse resting over row 7 lights up alongside the row the
   * keyboard is on, and both look like the one Enter commits.
   */
  private keyboardMode = false
  /** Latest real pointer position, and where it was when keyboard mode began. Movement AWAY from
   *  that spot is what hands control back — see {@link onPointerMove}. */
  private pointerAt: Point | null = null
  private pointerArmedAt: Point | null = null
  /** The current menu's `onClose`, held until it fires. Cleared as it fires, so it cannot fire twice
   *  (a `close()` on an already-closed layer is a no-op, and must stay one). */
  private onClose: (() => void) | null = null

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
    // Tracked always, so that when the keyboard takes over we already know where the pointer was —
    // only movement AWAY from that spot may hand control back.
    document.addEventListener('pointermove', this.onPointerMove, true)
    // Scrolling or resizing the world moves the paper out from under a menu that was opened ON it.
    // A menu that stayed put would then be pointing at nothing.
    window.addEventListener('resize', this.close)
    host.addEventListener('wheel', this.close, { passive: true })
  }

  destroy(): void {
    this.close()
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('pointermove', this.onPointerMove, true)
    window.removeEventListener('resize', this.close)
    this.layer?.remove()
    this.layer = null
  }

  get isOpen(): boolean {
    return this.chain.length > 0
  }

  /**
   * The box the layer fills, or null before mount. Exposed so a caller working in VIEWPORT pixels
   * can convert into the host-relative coordinates `open` expects — the layer's own arithmetic is
   * host-relative, which is what keeps a menu from scrolling with the music or scaling with the
   * zoom. Read-only on purpose: the host is donated once, at mount.
   */
  get host(): HTMLElement | null {
    return this.layer?.parentElement ?? null
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
    // AFTER the close() above, which is what fires the previous menu's own onClose.
    this.onClose = opts.onClose ?? null

    this.pushPanel(opts.items, null, (size) => placeRoot({ x: opts.x, y: opts.y }, size, this.bounds()))
    // After pushPanel, so the class lands on a layer that already holds the panel — and after the
    // close() above, which clears the mode from any previous menu.
    if (opts.viaKeyboard) this.setKeyboardMode(true)
  }

  close = (): void => {
    this.clearHoverTimer()
    this.setKeyboardMode(false)
    // Closed means the nodes are GONE — rule 4, inherited. Nothing is parked with display:none.
    while (this.chain.length) this.popPanel()
    this.scrim?.remove()
    this.scrim = null
    // LAST, and taken off the field first: the callback may open another menu (the menu bar's
    // slide-along does exactly that), and it must find a layer that is already fully closed.
    const notify = this.onClose
    this.onClose = null
    notify?.()
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

    const rows: RowRef[] = []
    // Columns are opt-in: without a break the panel is exactly the single stack it always was, so an
    // ordinary menu pays nothing for the palette's existence. `rows` stays FLAT and in reading order
    // either way — the keyboard walks it top-to-bottom, then on into the next column.
    const columns = items.some(isColumnBreak)
    let sink: HTMLElement = el
    if (columns) {
      el.classList.add('menu-panel-columns')
      sink = this.startColumn(el)
    }

    let column = 0
    let rowInColumn = 0
    for (const item of items) {
      if (isColumnBreak(item)) {
        sink = this.startColumn(el)
        column++
        rowInColumn = 0
        continue
      }
      const rowEl = this.buildRow(item, depth)
      sink.appendChild(rowEl)
      if (!isSeparator(item)) rows.push({ el: rowEl, item, column, row: rowInColumn++ })
    }

    // Off-screen for the measure, so a panel is never seen at 0,0 before it is placed.
    el.style.visibility = 'hidden'
    this.layer!.appendChild(el)
    const { x, y } = place({ width: el.offsetWidth, height: el.offsetHeight })
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.visibility = 'visible'

    if (opener) opener.dataset.active = 'true'
    this.chain.push({ el, opener, rows, highlight: -1 })
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

  /** Append a fresh column to a palette panel and return it as the new row sink. */
  private startColumn(panel: HTMLElement): HTMLElement {
    const col = document.createElement('div')
    col.className = 'menu-column'
    panel.appendChild(col)
    return col
  }

  private buildRow(item: RowItem, depth: number): HTMLElement {
    if (isSeparator(item)) {
      const sep = document.createElement('div')
      sep.className = 'menu-separator'
      return sep
    }

    const row = document.createElement('div')
    row.className = 'menu-row'

    const label = document.createElement('div')
    // `labelFont` rides the leaf variant only — a submenu is a word.
    const labelFont = 'labelFont' in item ? item.labelFont : undefined
    label.className = labelFont ? `menu-row-label menu-row-label-${labelFont}` : 'menu-row-label'
    label.textContent = item.label
    row.appendChild(label)

    if (isSubmenu(item)) {
      const arrow = document.createElement('div')
      arrow.className = 'menu-row-arrow'
      arrow.textContent = '▶'
      row.appendChild(arrow)
    } else if (item.shortcut) {
      // A leaf's accelerator, echoed muted at the right so the menu teaches the keystroke. Mutually
      // exclusive with the arrow: a submenu is not a keystroke (guaranteed by the union — `shortcut`
      // rides the leaf variant only).
      const hint = document.createElement('div')
      hint.className = 'menu-row-shortcut'
      hint.textContent = item.shortcut
      row.appendChild(hint)
    }

    row.addEventListener('pointerenter', () => {
      // A panel opening UNDER a stationary pointer fires this without the mouse having moved. While
      // the keyboard is driving that must not steal the highlight, or arrowing into a submenu would
      // hand control back to a mouse nobody touched.
      if (this.keyboardMode) return
      this.clearHoverTimer()
      // The pointer takes the highlight from the keyboard: two lit rows in one panel — one hovered,
      // one arrowed-to — would each look like "the row Enter commits", and only one can be.
      const panel = this.chain[depth]
      if (panel) this.setHighlight(panel, -1)
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
      if (isSubmenu(item)) this.openSubmenu(item.items, row, depth)
      else this.commitLeaf(item)
    })

    return row
  }

  /** Open (or re-open) the flyout a submenu row owns, collapsing anything already deeper first. */
  private openSubmenu(items: MenuItem[], row: HTMLElement, depth: number): void {
    this.clearHoverTimer()
    this.collapseTo(depth)
    if (!this.chain[depth + 1]) this.openFlyout(items, row, depth)
  }

  /**
   * Commit a leaf. The menu is gone BEFORE the callback runs, so whatever it does — open a dialog, a
   * window, another menu — is not fighting a menu that is still up.
   */
  private commitLeaf(item: { onSelect: () => void }): void {
    this.close()
    item.onSelect()
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

  /**
   * Enter or leave keyboard mode. The class goes on the LAYER, not a panel, so it covers the scrim
   * too — the cursor must stay hidden while the pointer is anywhere over the menu, not only when it
   * is over a row.
   */
  private setKeyboardMode(on: boolean): void {
    if (this.keyboardMode === on) return
    this.keyboardMode = on
    this.pointerArmedAt = on ? this.pointerAt : null
    this.layer?.classList.toggle('menu-layer-keyboard', on)
  }

  /**
   * Real mouse movement hands control back to the pointer. Gated on DISTANCE from where the pointer
   * sat when the keyboard took over, because a stationary mouse still produces pointer events — a
   * flyout opening underneath it is the common one — and treating those as intent would undo
   * keyboard mode the instant a submenu appeared under the cursor.
   */
  private onPointerMove = (e: PointerEvent): void => {
    this.pointerAt = { x: e.clientX, y: e.clientY }
    if (!this.keyboardMode) return
    const from = this.pointerArmedAt
    // No baseline yet — the menu was opened from the keyboard before the pointer had ever reported
    // in. Adopt this position as the baseline instead of treating it as movement, or the first
    // stray event would hand control to a mouse that has not been touched.
    if (!from) { this.pointerArmedAt = this.pointerAt; return }
    if (Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y) > POINTER_WAKE_PX) {
      this.setKeyboardMode(false)
    }
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer === null) return
    clearTimeout(this.hoverTimer)
    this.hoverTimer = null
  }

  /** The panel the keyboard acts on — always the deepest, the one whose rows are in front. */
  private deepest(): Panel | undefined {
    return this.chain[this.chain.length - 1]
  }

  /** Move a panel's arrow-key highlight to `index` (-1 clears it), repainting both rows it touches. */
  private setHighlight(panel: Panel, index: number): void {
    if (panel.highlight >= 0 && panel.rows[panel.highlight]) {
      delete panel.rows[panel.highlight].el.dataset.highlight
    }
    panel.highlight = index
    if (index >= 0) {
      const el = panel.rows[index].el
      el.dataset.highlight = 'true'
      // Keep the highlighted row in view when the panel is taller than the world and scrolls.
      el.scrollIntoView?.({ block: 'nearest' })
    }
  }

  /** Indices into `panel.rows` of one column, top to bottom. */
  private columnIndices(panel: Panel, column: number): number[] {
    const out: number[] = []
    panel.rows.forEach((r, i) => { if (r.column === column) out.push(i) })
    return out
  }

  /**
   * Walk the highlight down (+1) or up (-1), WITHIN THE CURRENT COLUMN, skipping nothing —
   * separators were never put in `rows`. From nowhere, down lands on the first row, up on the last.
   *
   * STOPS at the ends; it does not wrap. A menu is a list you read down, and running off the bottom
   * back to the top moves the highlight the entire height of the panel in the direction opposite to
   * the key — you lose your place, and at the foot of a long list you cannot tell whether Down did
   * nothing or did everything. The same reasoning already governs ←/→ across columns: nothing in
   * this grid wraps, in either axis.
   *
   * Column-scoped rather than walking the flat list, because ←/→ are what cross columns: if Down
   * ALSO fell into the next column, two different keys would do the same thing and the panel would
   * stop reading as a grid. For an ordinary single-stack menu every row is in column 0, so this is
   * simply "the list".
   */
  private moveHighlight(delta: number): void {
    const panel = this.deepest()
    if (!panel || panel.rows.length === 0) return
    if (panel.highlight === -1) {
      this.setHighlight(panel, delta > 0 ? 0 : panel.rows.length - 1)
      return
    }
    const indices = this.columnIndices(panel, panel.rows[panel.highlight].column)
    const at = indices.indexOf(panel.highlight)
    const next = Math.max(0, Math.min(indices.length - 1, at + delta))
    this.setHighlight(panel, indices[next])
  }

  /**
   * Move one column left (-1) or right (+1), keeping the vertical position — clamped to the end of a
   * shorter column, so a sideways step never lands on nothing. Returns false when there is no such
   * column, which is what lets ←/→ fall back to their submenu meanings.
   *
   * Like Up/Down, this STOPS rather than wrapping — the rows are genuinely side by side on screen,
   * and jumping from the last column back to the first would fling the highlight the full width of
   * the panel in the direction opposite to the key.
   */
  private moveColumn(delta: number): boolean {
    const panel = this.deepest()
    if (!panel || panel.rows.length === 0) return false
    // From nowhere, a sideways key lands on the first row rather than being swallowed. Pressing an
    // arrow at a menu that has just opened must always DO something — the alternative is a key that
    // silently no-ops while a hovered row sits there looking selected.
    if (panel.highlight < 0) {
      this.setHighlight(panel, 0)
      return true
    }
    const current = panel.rows[panel.highlight]
    const indices = this.columnIndices(panel, current.column + delta)
    if (indices.length === 0) return false
    this.setHighlight(panel, indices[Math.min(current.row, indices.length - 1)])
    return true
  }

  /** Open the flyout of the highlighted row, if it is a submenu, and land on its first row.
   *  Returns whether it actually opened one — Right uses that to decide if it should instead move a
   *  column, so a submenu row keeps its arrow's promise and every other row gets the grid. */
  private openHighlightedSubmenu(): boolean {
    const panel = this.deepest()
    if (!panel || panel.highlight < 0) return false
    const { el, item } = panel.rows[panel.highlight]
    if (!isSubmenu(item)) return false
    const depth = this.chain.length - 1
    this.openSubmenu(item.items, el, depth)
    const flyout = this.chain[depth + 1]
    if (flyout) this.setHighlight(flyout, 0)
    return true
  }

  /** Enter: a submenu opens (same as Right), a leaf commits. Nothing highlighted → nothing happens. */
  private commitHighlighted(): void {
    const panel = this.deepest()
    if (!panel || panel.highlight < 0) return
    const { item } = panel.rows[panel.highlight]
    if (isSubmenu(item)) this.openHighlightedSubmenu()
    else this.commitLeaf(item)
  }

  /**
   * The whole keyboard for an open menu. Every branch stops the event: an open menu OWNS the arrows
   * and Enter, so they never also scroll the page or fall through to an editing shortcut.
   *
   *   ↓/↑     move the highlight within the current COLUMN of the front panel (stops at the ends)
   *   →       open the highlighted submenu; failing that, step to the next column (clamped)
   *   ←       back out of a flyout to its parent; on a root panel, step to the previous column
   *   Enter   open the highlighted submenu, or commit a leaf
   *   Escape  close ONE level — the flyout you are in, not the whole chain you were reading
   */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return

    // Any of these keys means the keyboard is driving now. Set BEFORE the move, so the highlight it
    // is about to place is the only lit row — including when the flyout it opens lands under the
    // pointer.
    if (KEYBOARD_DRIVING_KEYS.has(e.key)) this.setKeyboardMode(true)

    switch (e.key) {
      case 'ArrowDown':
        this.moveHighlight(1)
        break
      case 'ArrowUp':
        this.moveHighlight(-1)
        break
      case 'ArrowRight':
        // The submenu meaning WINS. A row showing ▶ has promised Right opens it, and that promise
        // outranks the grid; every other row has nothing to open, so Right is free to move a column.
        if (!this.openHighlightedSubmenu()) this.moveColumn(1)
        break
      case 'ArrowLeft':
        // Likewise: inside a flyout, Left means "back out" — that is the way you came in. Only on a
        // root panel, where Left previously did nothing at all, does it step a column.
        if (this.chain.length > 1) this.popPanel()
        else this.moveColumn(-1)
        break
      case 'Enter':
        this.commitHighlighted()
        break
      case 'Escape':
        if (this.chain.length > 1) this.popPanel()
        else this.close()
        break
      default:
        return
    }

    e.preventDefault()
    e.stopPropagation()
  }
}
