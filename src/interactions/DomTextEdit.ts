import type { TextEditDom, TextEditInsertion, TextEditMountOptions } from './TextEditController'
import type { MenuItem } from '../menus/MenuItem'
import { textFirstFamily } from '../utils/fontStack'

/** Opens a menu at VIEWPORT coordinates. Injected (see the constructor) rather than imported, so
 *  this class keeps depending on nothing but the DOM. */
export type MenuOpener = (x: number, y: number, items: MenuItem[], opts?: { viaKeyboard?: boolean }) => void

/** Below this, a measured rect is treated as "no rect" rather than a real one. A collapsed range
 *  frequently reports a zero-height box, and trusting it parks the caret at 0,0 in the corner of the
 *  screen. The caret's SLANT lives in `.text-edit-caret` (notation.css) — CSS can skew, so it does. */
const CARET_MIN_HEIGHT_PX = 4

/** The slant of the serif italic the expression box is set in. Not derivable from a font at runtime,
 *  so it is a constant — but it is applied only to boxes that ARE italic (see {@link caretSkew}). */
const ITALIC_CARET_SKEW_DEG = 12

/**
 * How far the caret leans, from the font it will sit in. An upright caret in italic text reads as a
 * rendering fault — and so does a slanted one in upright text, which is exactly what happened when
 * this was hardcoded: `DomTextEdit` is shared, and a tempo mark is upright bold while a dynamic is
 * italic. The caret follows the type; it does not assume it.
 */
function caretSkew(fontStyle: string): string {
  const slanted = fontStyle === 'italic' || fontStyle.startsWith('oblique')
  return slanted ? `skewX(-${ITALIC_CARET_SKEW_DEG}deg)` : 'none'
}

/**
 * Real-DOM implementation of {@link TextEditDom}: a transparent, font-matched
 * `contentEditable` overlay positioned over the engraved mark. The browser gives
 * us caret, selection, backspace, arrows and clipboard for free, and because it's
 * a focusable editable node it trips `ShortcutManager`'s `isInInput` guard — so
 * note-entry keys (a–g, r, …) are suppressed while editing with no extra code.
 *
 * Commit/escape are surfaced as callbacks (Enter / Escape / click-away) so the
 * framework-agnostic {@link TextEditController} owns the state machine.
 */
export class DomTextEdit implements TextEditDom {
  private el: HTMLElement | null = null
  private opts: TextEditMountOptions | null = null
  /**
   * The caret, saved the moment the word menu is opened. Clicking a menu row moves focus off the
   * contentEditable and collapses its selection, so by the time `onSelect` runs there is no live
   * caret left to insert at — this is the one we put back. Null when no menu is pending.
   */
  private savedRange: Range | null = null
  /** The drawn italic caret (the native one is suppressed in CSS). Null while unmounted. */
  private caretEl: HTMLElement | null = null

  /**
   * @param openMenu opens the word menu; omit and the gesture stays the browser's.
   * @param isMenuOpen whether that menu is currently up. Required for the keyboard to work: while a
   *   menu is open it OWNS Enter, Escape and the arrows, and this box must keep its hands off them.
   */
  constructor(
    private openMenu?: MenuOpener,
    private isMenuOpen?: () => boolean,
  ) {}

  mount(opts: TextEditMountOptions): void {
    this.opts = opts

    const el = document.createElement('div')
    el.className = 'text-edit-overlay'
    el.setAttribute('contenteditable', 'true')
    el.setAttribute('spellcheck', 'false')
    // A source may supply pre-styled seed HTML (per-run fonts/sizes — a dynamic's big glyph
    // beside small italic words). It is source-built and trusted; `getText()` still reads the
    // plain text back off `textContent`. Otherwise seed as plain text.
    if (opts.html != null) el.innerHTML = opts.html
    else el.textContent = opts.text

    const { rect, font } = opts
    const s = el.style
    s.position = 'fixed'
    s.left = `${rect.x}px`
    s.top = `${rect.y}px`
    s.fontFamily = textFirstFamily(font.fontFamily)
    s.fontSize = font.fontSize
    s.fontStyle = font.fontStyle
    if (font.fontWeight) s.fontWeight = font.fontWeight
    s.color = font.color

    el.addEventListener('keydown', this.onKeyDown)
    // On the DOCUMENT, not the overlay: the box is only a few characters wide, and asking someone to
    // land a right-click inside it is a worse target than the menu is worth. While an edit is open
    // the editor OWNS right-click anywhere — capture phase so it wins over the score's own context
    // menu, which would otherwise offer Insert▸ commands over a live text edit.
    if (opts.buildContextMenu && this.openMenu) {
      document.addEventListener('contextmenu', this.onContextMenu, true)
    }
    // Capture-phase so we see (and can swallow) the click-away BEFORE the canvas does.
    document.addEventListener('mousedown', this.onDocPointerDown, true)
    document.body.appendChild(el)
    this.el = el

    // Our own caret: no CSS can slant the native one, and expression text is italic. It leans only
    // as far as THIS box's font does — upright for a tempo mark, slanted for a dynamic.
    // `selectionchange` is the only event that fires for every way the caret can move — typing,
    // arrows, clicking, our own menu insertions — so one listener covers them all.
    const caret = document.createElement('div')
    caret.className = 'text-edit-caret'
    caret.style.transform = caretSkew(font.fontStyle)
    document.body.appendChild(caret)
    this.caretEl = caret
    document.addEventListener('selectionchange', this.syncCaret)

    // Only now that it's laid out can we ask where its baseline landed, and slide the box
    // so that baseline sits exactly where the engraved one did.
    if (opts.baselineY !== undefined) this.alignBaseline(el, rect.y, opts.baselineY)

    // Focus + place the caret at the end on the next frame: doing it synchronously
    // inside the opening mousedown can race with the browser's own focus handling.
    // By the next frame the click sequence is done, so focus sticks. The text is NOT
    // selected — the caret sits at the end and the user edits from there.
    requestAnimationFrame(() => {
      if (this.el !== el) return // closed already
      el.focus()
      this.caretToEnd(el)
    })
  }

  getText(): string {
    return (this.el?.textContent ?? '').trim()
  }

  unmount(): void {
    const el = this.el
    if (el) {
      el.removeEventListener('keydown', this.onKeyDown)
      el.remove()
    }
    document.removeEventListener('contextmenu', this.onContextMenu, true)
    document.removeEventListener('mousedown', this.onDocPointerDown, true)
    document.removeEventListener('selectionchange', this.syncCaret)
    this.caretEl?.remove()
    this.caretEl = null
    this.el = null
    this.opts = null
    this.savedRange = null
  }

  /**
   * Right-click ANYWHERE while an edit is open shows the source's word menu (Sibelius's word menu).
   *
   * It is anchored to the EDITOR BOX, not to the pointer — deliberately. The menu belongs to the
   * text being edited, so it should appear in the same place every time regardless of where the
   * click landed; and since the gesture is now allowed anywhere on the page, following the pointer
   * would put the menu somewhere with no relationship to the words it edits. Anchored at the box's
   * bottom-left, like a menu-bar button, so it drops directly under the mark.
   *
   * The caret is saved FIRST — see {@link savedRange} — and the browser's own menu is suppressed.
   */
  private onContextMenu = (e: MouseEvent): void => {
    if (!this.canOpenWordMenu()) return
    e.preventDefault()
    // Capture-phase stop: the score's own contextmenu handler must not also open the Insert menu.
    e.stopPropagation()
    this.openWordMenu()
  }

  private canOpenWordMenu(): boolean {
    return !!(this.opts?.buildContextMenu && this.openMenu && this.el)
  }

  /**
   * Show the word menu, anchored at the editor box's bottom-left. Shared by the two gestures that
   * ask for it — right-click and the Menu key — so they can never drift apart, and so the menu lands
   * in the same place whichever one you used.
   */
  private openWordMenu(viaKeyboard = false): void {
    const build = this.opts?.buildContextMenu
    const el = this.el
    if (!build || !this.openMenu || !el) return

    this.savedRange = this.currentRangeInBox()

    // The overlay is position:fixed, so its client rect IS viewport pixels — what the opener wants.
    const box = el.getBoundingClientRect?.()
    this.openMenu(box?.left ?? 0, box?.bottom ?? 0, build({
      text: (t) => this.insertAtSavedCaret(() => document.createTextNode(t)),
      html: (h) => this.insertAtSavedCaret(() => this.fragmentFromHtml(h)),
    }), { viaKeyboard })
  }

  /**
   * Move the drawn caret to wherever the real (invisible) one is. Bound to `selectionchange`, which
   * covers every way it can move — typing, arrows, clicking, our own insertions — so nothing has to
   * remember to call this.
   *
   * Hidden when the caret is not in this box, or when text is SELECTED: a caret drawn at the edge of
   * a highlight looks like a second, stationary one, and the selection already shows where you are.
   */
  private syncCaret = (): void => {
    const el = this.el
    const caret = this.caretEl
    if (!el || !caret) return

    const sel = window.getSelection?.()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const live = !!range && range.collapsed && el.contains(range.commonAncestorContainer)
    if (!live) {
      caret.style.display = 'none'
      return
    }

    const spot = this.caretRect(range, el)
    if (!spot) {
      caret.style.display = 'none'
      return
    }
    caret.style.display = 'block'
    caret.style.left = `${spot.left}px`
    caret.style.top = `${spot.top}px`
    caret.style.height = `${spot.height}px`
    // Restart the blink so the caret is solid the instant it moves — a caret that happens to be
    // mid-off-phase when you type reads as dropped input.
    caret.style.animation = 'none'
    void caret.offsetHeight
    caret.style.animation = ''
  }

  /**
   * Where to draw the caret, in viewport pixels. A COLLAPSED range often has no client rects at all
   * (an empty box, or a position between nodes), which is why this falls back to the box itself
   * rather than trusting a zeroed rect — a caret parked at 0,0 in the corner of the screen is the
   * failure mode to avoid.
   */
  private caretRect(range: Range, el: HTMLElement): { left: number; top: number; height: number } | null {
    if (typeof range.getBoundingClientRect !== 'function') return null // no layout (tests)
    const r = range.getBoundingClientRect()
    if (r.height > CARET_MIN_HEIGHT_PX) return { left: r.left, top: r.top, height: r.height }

    // A collapsed range at a node BOUNDARY — just after an inserted note glyph or a dynamics chip —
    // often reports an empty rect. Recover the caret from the edge of a neighbouring character
    // rather than falling through to the box edge below, which flings the caret to the END of what
    // was actually a mid-string insert. (This is why a shortcut inserted mid-string looked like it
    // jumped to the end — in BOTH the tempo and the expression editor.)
    const boundary = this.boundaryCaretRect(range)
    if (boundary) return boundary

    const box = el.getBoundingClientRect()
    if (box.height <= CARET_MIN_HEIGHT_PX) return null
    // Nothing to measure at all (an empty box): the start edge when empty, the end otherwise.
    const atEnd = (el.textContent ?? '').length > 0
    return { left: atEnd ? box.right : box.left, top: box.top, height: box.height }
  }

  /**
   * The x/height of a collapsed range that has no rect of its own, taken from the character on one
   * side of it: the RIGHT edge of the text just before the caret, else the LEFT edge of the text
   * just after. Covers a caret inside a text node AND one at an element boundary (between child
   * nodes — where `insertNodeAtCaret`'s `setStartAfter` leaves it). Null when neither side is text
   * (an empty box, or a caret wedged between two non-text nodes) — the box fallback takes over.
   */
  private boundaryCaretRect(range: Range): { left: number; top: number; height: number } | null {
    if (typeof document.createRange !== 'function') return null
    const edge = (node: Node, from: number, to: number, side: 'left' | 'right') => {
      const probe = document.createRange()
      try { probe.setStart(node, from); probe.setEnd(node, to) } catch { return null }
      const r = probe.getBoundingClientRect()
      if (r.height <= CARET_MIN_HEIGHT_PX) return null
      return { left: side === 'right' ? r.right : r.left, top: r.top, height: r.height }
    }
    const len = (n: Node) => n.textContent?.length ?? 0
    const c = range.startContainer
    const o = range.startOffset

    if (c.nodeType === Node.TEXT_NODE) {
      const before = o > 0 ? edge(c, 0, o, 'right') : null
      return before ?? (o < len(c) ? edge(c, o, len(c), 'left') : null)
    }
    // Element container: the caret sits between children o-1 and o.
    const prev = c.childNodes[o - 1]
    const next = c.childNodes[o]
    const fromPrev = prev?.nodeType === Node.TEXT_NODE ? edge(prev, 0, len(prev), 'right') : null
    return fromPrev ?? (next?.nodeType === Node.TEXT_NODE ? edge(next, 0, len(next), 'left') : null)
  }

  /** The live caret, but only if it is actually inside this box — a range pointing anywhere else is
   *  worse than none, since restoring it would drop text into some other element. */
  private currentRangeInBox(): Range | null {
    const el = this.el
    const sel = window.getSelection?.()
    if (!el || !sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    return el.contains(range.commonAncestorContainer) ? range.cloneRange() : null
  }

  /**
   * Put a menu row's contribution in where the caret WAS when the menu opened. Restores the saved
   * range first, because the click that chose the row has since blurred the box. The node is built
   * LAZILY, after the caret is back — a word becomes a text node (ordinary prose you can backspace
   * through), a dynamic becomes its atomic chip, and the caller decides which.
   */
  private insertAtSavedCaret(makeNode: () => Node): void {
    const el = this.el
    if (!el) return
    el.focus()

    const sel = window.getSelection?.()
    if (sel && this.savedRange) {
      sel.removeAllRanges()
      sel.addRange(this.savedRange)
    }
    this.savedRange = null

    // If there is still no caret in the box — the selection was lost outright, or the menu was
    // opened before one was ever placed — put the word at the END rather than dropping it. Choosing
    // a menu row must always produce the word somewhere; silently doing nothing is the one outcome
    // that reads as broken.
    if (!this.currentRangeInBox()) this.caretToEnd(el)
    this.insertNodeAtCaret(makeNode())
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // While the word menu is up it owns the keyboard — Enter commits the highlighted ROW, Escape
    // closes the MENU, the arrows walk it. This listener sits on the overlay and therefore runs
    // BEFORE MenuLayer's document-level one, so without standing down here Enter would commit the
    // text edit and swallow the key, and the row you had highlighted would never fire. Returning
    // (rather than handling) lets the event bubble on to the menu, which is the whole point.
    if (this.isMenuOpen?.()) return

    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      this.opts?.onCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.opts?.onEscape()
      return
    } else if (e.key === 'ContextMenu' && this.canOpenWordMenu()) {
      // The Menu key opens the word menu without leaving the keyboard — the same key the score uses
      // for its own menu, which is exactly why it must be stopped here: while an edit is open, that
      // key means THIS menu. (installInsertMenu listens on document in the bubble phase; this
      // handler is on the overlay, so stopping propagation is enough to keep the Insert menu away.)
      e.preventDefault()
      e.stopPropagation()
      this.openWordMenu(true) // summoned by the Menu key: the mouse must not pre-select anything
      return
    }

    const insertion = this.matchInsertion(e)
    if (insertion) {
      // preventDefault BEFORE inserting: these are live browser shortcuts (Ctrl+F is Find),
      // and while the overlay is focused the editor's meaning must win.
      e.preventDefault()
      e.stopPropagation()
      this.insertHtmlAtCaret(insertion.html)
    }
    // Other keys flow into the contentEditable as normal typing; ShortcutManager's
    // isInInput guard keeps them away from note entry.
  }

  private matchInsertion(e: KeyboardEvent): TextEditInsertion | undefined {
    return this.opts?.insertions?.find(
      i =>
        // `code` (the physical key) wins when set — the keypad, which `key` cannot distinguish from
        // the top row; otherwise match the logical `key`, case-insensitively.
        (i.code ? i.code === e.code : (i.key ?? '').toLowerCase() === e.key.toLowerCase()) &&
        // metaKey so the same binding reads as Cmd+F on macOS.
        !!i.ctrl === (e.ctrlKey || e.metaKey) &&
        !!i.shift === e.shiftKey &&
        !!i.alt === e.altKey,
    )
  }

  /**
   * Drop a fixed fragment in at the caret, replacing any selection, and leave the caret
   * AFTER it so typing continues beside the inserted chip. Range surgery rather than
   * `execCommand('insertHTML')`: that one is deprecated and free to reshape the markup it
   * is handed, and a dynamics chip must survive verbatim — its `contenteditable=false`
   * span is what makes it atomic.
   */
  private insertHtmlAtCaret(html: string): void {
    this.insertNodeAtCaret(this.fragmentFromHtml(html))
  }

  /** Parse trusted, source-built markup into nodes ready to drop at the caret. */
  private fragmentFromHtml(html: string): DocumentFragment {
    const template = document.createElement('span')
    template.innerHTML = html
    const fragment = document.createDocumentFragment()
    fragment.append(...template.childNodes)
    return fragment
  }

  /**
   * The shared caret surgery behind both insertion paths (a Ctrl+letter glyph chip and a word-menu
   * word). Replaces any selection and leaves the caret AFTER what was inserted, so typing carries on
   * beside it. A DocumentFragment empties when inserted, so the node to seek past is captured first.
   */
  private insertNodeAtCaret(node: Node): void {
    const el = this.el
    const sel = window.getSelection?.()
    if (!el || !sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return // caret escaped the overlay

    const last = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? node.lastChild : node

    range.deleteContents()
    range.insertNode(node)

    if (last) {
      range.setStartAfter(last)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    // `selectionchange` is not guaranteed to be synchronous, and the caret must not lag a frame
    // behind the glyph it was just told to sit after.
    this.syncCaret()
  }

  /**
   * A mousedown outside the overlay = click-away ⇒ commit. We swallow the trailing
   * click (capture phase, one-shot) so it never reaches the canvas — otherwise the
   * mouseup→click would plant a stray note/dynamic at the click point. preventDefault
   * stops the focus shift / canvas text-selection on the way out.
   */
  private onDocPointerDown = (e: MouseEvent): void => {
    const el = this.el
    if (!el) return
    // Click-away is a LEFT click. A right-click anywhere is the word-menu gesture, and its mousedown
    // arrives BEFORE the contextmenu event — so this must not commit, or the box would unmount a
    // moment before the menu it was asked for could open.
    //
    // Merely declining is not enough though: the press would then travel on to the canvas, where
    // only SOME handlers check `state.editingText`, and it would also move focus out of the
    // contentEditable and take the caret with it. So while a word menu is available the press is
    // SWALLOWED outright — right-click belongs to the editor for as long as the editor is open.
    if (e.button !== 0) {
      if (this.opts?.buildContextMenu && this.openMenu) {
        e.preventDefault() // keep focus (and therefore the caret) in the box
        e.stopPropagation() // the canvas never sees it
      }
      return
    }
    if (e.target instanceof Node && el.contains(e.target)) return // inside the editor
    // The word menu's panels live in the menu LAYER, outside this overlay — so without this guard a
    // press on one of its rows reads as click-away and commits, tearing the box down before the row's
    // own click handler ever runs (the insert would then land in a dead editor). Dismissing the menu
    // by clicking its scrim likewise leaves the edit alone: putting a menu away is not committing.

    if (e.target instanceof Element && e.target.closest('.menu-layer')) return

    e.preventDefault()
    e.stopPropagation()
    document.addEventListener('click', this.swallowNextClick, true)
    this.opts?.onCommit()
  }

  private swallowNextClick = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    document.removeEventListener('click', this.swallowNextClick, true)
  }

  /**
   * Sit the overlay's text on the engraved text's baseline.
   *
   * The offset between an HTML box's top and the baseline inside it depends on the font's
   * ascent and the line box's leading — numbers we'd have to guess at, and they'd change
   * with the font. So we don't compute it: we MEASURE it. A zero-height inline-block is
   * baseline-aligned by definition, so its rect sits precisely on the line's baseline. Drop
   * one in, read where the baseline actually is, shift the box by the difference, take it
   * out. True by construction for any font, any zoom.
   */
  private alignBaseline(el: HTMLElement, top: number, baselineY: number): void {
    if (typeof el.getBoundingClientRect !== 'function') return // no layout (tests)
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    el.appendChild(probe)
    const measured = probe.getBoundingClientRect().bottom
    probe.remove()
    if (!Number.isFinite(measured) || measured === 0) return
    el.style.top = `${top + (baselineY - measured)}px`
  }

  /** Place the caret at the end of the seeded text (collapsed — nothing selected). */
  private caretToEnd(el: HTMLElement): void {
    const sel = window.getSelection?.()
    if (!sel || typeof document.createRange !== 'function') return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false) // collapse to the end
    sel.removeAllRanges()
    sel.addRange(range)
  }
}
