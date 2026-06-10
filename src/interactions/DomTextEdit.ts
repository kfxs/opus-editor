import type { TextEditDom, TextEditMountOptions } from './TextEditController'

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
    el.textContent = opts.text

    const { rect, font } = opts
    const s = el.style
    s.position = 'fixed'
    s.left = `${rect.x}px`
    s.top = `${rect.y}px`
    s.fontFamily = font.fontFamily
    s.fontSize = font.fontSize
    s.fontStyle = font.fontStyle
    s.color = font.color

    el.addEventListener('keydown', this.onKeyDown)
    // Capture-phase so we see (and can swallow) the click-away BEFORE the canvas does.
    document.addEventListener('mousedown', this.onDocPointerDown, true)
    document.body.appendChild(el)
    this.el = el

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
    }
    // Other keys flow into the contentEditable as normal typing; ShortcutManager's
    // isInInput guard keeps them away from note entry.
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
