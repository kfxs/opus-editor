// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MenuLayer } from './MenuLayer'
import type { MenuItem } from './MenuItem'

/**
 * Keyboard-vs-pointer arbitration. The menu has three highlight sources (:hover, the flyout owner,
 * the arrow-key row) and only ONE of them may ever look like "the row Enter commits".
 */
describe('MenuLayer keyboard mode', () => {
  let host: HTMLElement
  let menus: MenuLayer

  const items = (): MenuItem[] => [
    { label: 'one', onSelect: vi.fn() },
    { label: 'two', onSelect: vi.fn() },
    { label: 'sub', items: [{ label: 'deep', onSelect: vi.fn() }] },
  ]
  const layerEl = () => host.querySelector('.menu-layer') as HTMLElement
  const rows = () => [...host.querySelectorAll('.menu-row')] as HTMLElement[]
  const arrowDown = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  const movePointer = (x: number, y: number) =>
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    menus = new MenuLayer()
    menus.mount(host)
  })

  afterEach(() => {
    menus.destroy()
    host.remove()
  })

  it('an arrow key hides the cursor and mutes hover', () => {
    menus.open({ x: 0, y: 0, items: items() })
    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(false)

    arrowDown()
    // The class carries both halves: `cursor: none` on the layer, and a :hover override on the rows.
    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(true)
  })

  // The bug this whole mode exists for: a panel opening under a STATIONARY pointer fires
  // pointerenter, which would otherwise hand control back to a mouse nobody touched.
  it('a pointerenter with no movement does NOT steal the highlight', () => {
    menus.open({ x: 0, y: 0, items: items() })
    arrowDown() // highlight lands on row 0
    expect(rows()[0].dataset.highlight).toBe('true')

    rows()[1].dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))

    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(true)
    expect(rows()[0].dataset.highlight).toBe('true') // still the keyboard's row
  })

  it('real movement hands control straight back', () => {
    menus.open({ x: 0, y: 0, items: items() })
    movePointer(100, 100) // establish where the pointer is resting
    arrowDown()
    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(true)

    movePointer(101, 100) // jitter, below the wake threshold
    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(true)

    movePointer(140, 130) // a deliberate move
    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(false)
    expect(rows()[1].dataset.highlight).toBeUndefined()
  })

  it('does not persist across menus — a fresh one starts pointer-driven', () => {
    menus.open({ x: 0, y: 0, items: items() })
    arrowDown()
    menus.close()
    menus.open({ x: 0, y: 0, items: items() })

    expect(layerEl().classList.contains('menu-layer-keyboard')).toBe(false)
  })
})
