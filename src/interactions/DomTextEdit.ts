import type { TextEditDom, TextEditInsertion, TextEditMountOptions } from './TextEditController'
import { textFirstFamily } from '../utils/fontStack'

/**
 * Real-DOM implementation of {@link TextEditDom}: a transparent, font-matched
 * `contentEditable` overlay positioned over the engraved mark. The browser gives
 * us caret, selection, backspace, arrows and clipboard for free, and because it's
 * a focusable editable node it trips `ShortcutManager`'s `isInInput` guard — so
 * note-entry keys (a–g, r, …) are suppressed while editing with no extra code.
 *
 * Commit/cancel are surfaced as callbacks (Enter / Escape / click-away) so the
 * framework-agnostic {@link TextEditController} owns the state machine.
 */
export class DomTextEdit implements TextEditDom {
  private el: HTMLElement | null = null
  private opts: TextEditMountOptions | null = null

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
    // Capture-phase so we see (and can swallow) the click-away BEFORE the canvas does.
    document.addEventListener('mousedown', this.onDocPointerDown, true)
    document.body.appendChild(el)
    this.el = el

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
    document.removeEventListener('mousedown', this.onDocPointerDown, true)
    this.el = null
    this.opts = null
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      this.opts?.onCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.opts?.onCancel()
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
        i.key.toLowerCase() === e.key.toLowerCase() &&
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
    const el = this.el
    const sel = window.getSelection?.()
    if (!el || !sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return // caret escaped the overlay

    const template = document.createElement('span')
    template.innerHTML = html
    const fragment = document.createDocumentFragment()
    fragment.append(...template.childNodes)
    const last = fragment.lastChild

    range.deleteContents()
    range.insertNode(fragment)

    if (last) {
      range.setStartAfter(last)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
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
    if (e.target instanceof Node && el.contains(e.target)) return // inside the editor

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
