// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { DomTextEdit } from './DomTextEdit'
import type { MenuItem } from '../menus/MenuItem'

/** Mount options with only what these tests exercise. */
function mountOpts(over: Partial<Parameters<DomTextEdit['mount']>[0]> = {}) {
  return {
    text: 'espr.',
    rect: { x: 10, y: 10, width: 40, height: 20 },
    font: { fontFamily: 'serif', fontSize: '14pt', fontStyle: 'italic', color: '#000' },
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
}

describe('DomTextEdit word menu', () => {
  let openMenu: Mock<(x: number, y: number, items: MenuItem[]) => void>
  let menuOpen: boolean
  let dom: DomTextEdit

  beforeEach(() => {
    openMenu = vi.fn()
    menuOpen = false
    dom = new DomTextEdit(openMenu, () => menuOpen)
  })

  afterEach(() => {
    dom.unmount()
    document.querySelectorAll('.menu-layer').forEach(n => n.remove())
  })

  // The native caret is suppressed in CSS (no property can slant one), so the drawn replacement is
  // the ONLY caret there is — if it leaks or fails to appear, the editor has no cursor at all.
  describe('the italic caret', () => {
    const caret = () => document.querySelector('.text-edit-caret') as HTMLElement | null

    it('exists while mounted and is GONE after unmount', () => {
      dom.mount(mountOpts())
      expect(caret()).not.toBeNull()
      dom.unmount()
      expect(caret()).toBeNull() // a leaked caret would blink over the score forever
    })

    // Regression: the slant was hardcoded, which slanted the TEMPO caret too — DomTextEdit is
    // shared, and a tempo mark is upright bold while a dynamic is italic.
    it('leans only as far as the box it serves', () => {
      dom.mount(mountOpts({ font: { fontFamily: 'serif', fontSize: '14pt', fontStyle: 'italic', color: '#000' } }))
      expect(caret()!.style.transform).toContain('skew')
      dom.unmount()

      dom.mount(mountOpts({ font: { fontFamily: 'serif', fontSize: '14pt', fontStyle: 'normal', color: '#000' } }))
      expect(caret()!.style.transform).not.toContain('skew') // upright text, upright caret
    })

    it('hides when the caret is not in this box', () => {
      dom.mount(mountOpts())
      const outside = document.createElement('div')
      outside.textContent = 'elsewhere'
      document.body.appendChild(outside)

      const r = document.createRange()
      r.selectNodeContents(outside)
      r.collapse(true)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(r)
      document.dispatchEvent(new Event('selectionchange'))

      expect(caret()!.style.display).toBe('none')
      outside.remove()
    })

    it('hides while text is SELECTED — a caret beside a highlight reads as a second one', () => {
      dom.mount(mountOpts({ text: 'dolce' }))
      const el = overlay()
      const r = document.createRange()
      r.selectNodeContents(el) // a RANGE, not a collapsed caret
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(r)
      document.dispatchEvent(new Event('selectionchange'))

      expect(caret()!.style.display).toBe('none')
    })
  })

  const overlay = () => document.querySelector('.text-edit-overlay') as HTMLElement

  it('right-click ANYWHERE opens the menu — the box is too small to have to hit', () => {
    dom.mount(mountOpts({ buildContextMenu: () => [{ label: 'dolce', onSelect: vi.fn() }] }))

    // Far away from the overlay, on an unrelated element.
    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    const e = new MouseEvent('contextmenu', { clientX: 900, clientY: 700, bubbles: true, cancelable: true })
    elsewhere.dispatchEvent(e)

    expect(openMenu).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true) // the browser menu would otherwise cover ours
    elsewhere.remove()
  })

  it('anchors to the EDITOR box, not the pointer — same place every time', () => {
    const overlayBox = { left: 40, bottom: 90, x: 40, y: 70, top: 70, right: 80, width: 40, height: 20, toJSON: () => ({}) }
    dom.mount(mountOpts({ buildContextMenu: () => [] }))
    overlay().getBoundingClientRect = () => overlayBox as DOMRect

    for (const [cx, cy] of [[900, 700], [5, 5]]) {
      document.body.dispatchEvent(new MouseEvent('contextmenu', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }))
    }

    // Both clicks — wildly different pointers — anchor at the box's bottom-left.
    expect(openMenu.mock.calls.map(c => [c[0], c[1]])).toEqual([[40, 90], [40, 90]])
  })

  // A right-click's mousedown lands before its contextmenu event. Treating that as click-away
  // committed and unmounted the box a moment before the menu it asked for could open.
  it('a right-click does NOT count as click-away, and is swallowed whole', () => {
    const opts = mountOpts({ buildContextMenu: () => [] })
    dom.mount(opts)

    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    const downstream = vi.fn()
    elsewhere.addEventListener('mousedown', downstream)

    const e = new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true })
    elsewhere.dispatchEvent(e)

    expect(opts.onCommit).not.toHaveBeenCalled()
    // Swallowed, not merely declined: letting it through reached canvas handlers that do not all
    // check `editingText`, and moved focus out of the box — which is what killed the live edit.
    expect(downstream).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(true)
    elsewhere.remove()
  })

  it('the Menu key opens it too — no reaching for the mouse mid-word', () => {
    dom.mount(mountOpts({ buildContextMenu: () => [{ label: 'dolce', onSelect: vi.fn() }] }))

    const e = new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })
    overlay().dispatchEvent(e)

    expect(openMenu).toHaveBeenCalledTimes(1)
    // Stopped, so the score's own Menu-key handler does not also open the Insert menu over a live edit.
    expect(e.defaultPrevented).toBe(true)
  })

  it('the Menu key and right-click anchor to the same place', () => {
    const box = { left: 40, bottom: 90, x: 40, y: 70, top: 70, right: 80, width: 40, height: 20, toJSON: () => ({}) }
    dom.mount(mountOpts({ buildContextMenu: () => [] }))
    overlay().getBoundingClientRect = () => box as DOMRect

    overlay().dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }))
    document.body.dispatchEvent(new MouseEvent('contextmenu', { clientX: 900, clientY: 700, bubbles: true, cancelable: true }))

    const [byKey, byMouse] = openMenu.mock.calls
    expect([byKey[0], byKey[1]]).toEqual([byMouse[0], byMouse[1]])
  })

  it('does NOT open a menu when the source declares none — right-click stays the browser default', () => {
    dom.mount(mountOpts()) // no buildContextMenu
    const e = new MouseEvent('contextmenu', { clientX: 1, clientY: 1, bubbles: true, cancelable: true })
    document.body.dispatchEvent(e)

    expect(openMenu).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  // The regression this guard exists for: menu panels live in the menu LAYER, outside the overlay,
  // so a press on a row looks exactly like click-away. Without the guard the box commits and
  // unmounts before the row's own click handler runs, and the insert lands in a dead editor.
  it('a press inside the menu layer is NOT click-away — it must not commit', () => {
    const opts = mountOpts({ buildContextMenu: () => [] })
    dom.mount(opts)

    const layer = document.createElement('div')
    layer.className = 'menu-layer'
    const row = document.createElement('div')
    layer.appendChild(row)
    document.body.appendChild(layer)

    row.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }))

    expect(opts.onCommit).not.toHaveBeenCalled()
  })

  it('a press genuinely outside still commits (the guard is not a blanket exemption)', () => {
    const opts = mountOpts({ buildContextMenu: () => [] })
    dom.mount(opts)

    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    elsewhere.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }))

    expect(opts.onCommit).toHaveBeenCalledTimes(1)
    elsewhere.remove()
  })

  // Reported from real use: navigating the menu with the arrows and pressing Enter did not insert
  // the word — it committed the EDIT and closed the box. This listener is on the overlay, so it runs
  // before MenuLayer's document-level one; it must stand down while a menu is up or it eats the key
  // and the highlighted row never fires.
  it('stands down from the keyboard while the menu is open', () => {
    const opts = mountOpts({ buildContextMenu: () => [] })
    dom.mount(opts)
    menuOpen = true

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    overlay().dispatchEvent(enter)
    expect(opts.onCommit).not.toHaveBeenCalled()
    expect(enter.defaultPrevented).toBe(false) // left alone, so it bubbles on to the menu

    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    overlay().dispatchEvent(esc)
    expect(opts.onCancel).not.toHaveBeenCalled() // Escape closes the MENU, not the edit
  })

  it('takes the keyboard back once the menu is gone', () => {
    const opts = mountOpts({ buildContextMenu: () => [] })
    dom.mount(opts)
    menuOpen = false

    overlay().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(opts.onCommit).toHaveBeenCalledTimes(1)
  })

  it('choosing a row inserts that word as PLAIN text — never a glyph chip', () => {
    dom.mount(mountOpts({
      text: '',
      buildContextMenu: (insert) => [{ label: 'dolce', onSelect: () => insert.text('dolce') }],
    }))
    document.body.dispatchEvent(new MouseEvent('contextmenu', { clientX: 5, clientY: 5, bubbles: true, cancelable: true }))

    const items = openMenu.mock.calls[0][2]
    const dolce = items[0] as { label: string; onSelect: () => void }
    expect(dolce.label).toBe('dolce')

    dolce.onSelect()

    expect(overlay().textContent).toContain('dolce')
    // A word is ordinary editable prose: no atomic chip, so it backspaces one character at a time
    // and can never be mistaken for a dynamic.
    expect(overlay().querySelector('[contenteditable="false"]')).toBeNull()
  })
})
