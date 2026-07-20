// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MenuLayer } from './MenuLayer'
import type { MenuItem } from './MenuItem'

/**
 * 2D arrow navigation over a palette. Up/Down walk a COLUMN, Left/Right cross columns — but only
 * where those keys had no prior meaning, since a submenu row's ▶ and a flyout's way back both
 * outrank the grid.
 */
describe('MenuLayer column navigation', () => {
  let host: HTMLElement
  let menus: MenuLayer

  /** Three tall / two short, so clamping a sideways step is exercised. */
  const palette = (): MenuItem[] => [
    { label: 'a1', onSelect: vi.fn() },
    { label: 'a2', onSelect: vi.fn() },
    { label: 'a3', onSelect: vi.fn() },
    { columnBreak: true },
    { label: 'b1', onSelect: vi.fn() },
    { label: 'b2', onSelect: vi.fn() },
  ]

  const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  /** The highlighted row of the FRONT panel — the one the keyboard is acting on. A parent panel
   *  keeps its own highlight while a flyout is open (it shows the path in), so a document-wide
   *  query would return the wrong row as soon as there is a chain. */
  const lit = () => {
    const panels = host.querySelectorAll('.menu-panel')
    const front = panels[panels.length - 1]
    return (front?.querySelector('.menu-row[data-highlight="true"]') as HTMLElement | null)?.textContent
  }

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    menus = new MenuLayer()
    menus.mount(host)
  })
  afterEach(() => { menus.destroy(); host.remove() })

  it('Down walks the column and STOPS at its foot — no wrap, no falling into the next', () => {
    menus.open({ x: 0, y: 0, items: palette() })
    key('ArrowDown'); expect(lit()).toBe('a1')
    key('ArrowDown'); expect(lit()).toBe('a2')
    key('ArrowDown'); expect(lit()).toBe('a3')
    key('ArrowDown'); expect(lit()).toBe('a3') // stays put: neither b1 nor back to a1
  })

  it('Up stops at the head of the column', () => {
    menus.open({ x: 0, y: 0, items: palette() })
    key('ArrowDown'); key('ArrowDown') // a2
    key('ArrowUp'); expect(lit()).toBe('a1')
    key('ArrowUp'); expect(lit()).toBe('a1') // no jump to the bottom
  })

  it('Right and Left cross columns, keeping the vertical position', () => {
    menus.open({ x: 0, y: 0, items: palette() })
    key('ArrowDown'); key('ArrowDown') // a2
    key('ArrowRight'); expect(lit()).toBe('b2') // same height, next column
    key('ArrowLeft'); expect(lit()).toBe('a2')
  })

  it('clamps to a shorter column instead of landing on nothing', () => {
    menus.open({ x: 0, y: 0, items: palette() })
    key('ArrowDown'); key('ArrowDown'); key('ArrowDown') // a3 — deeper than column 2 is tall
    key('ArrowRight'); expect(lit()).toBe('b2') // clamped to the last row there
  })

  it('does NOT wrap sideways — columns are spatial, not a loop', () => {
    menus.open({ x: 0, y: 0, items: palette() })
    key('ArrowDown')          // a1
    key('ArrowLeft'); expect(lit()).toBe('a1')  // already leftmost: stay
    key('ArrowRight')         // b1
    key('ArrowRight'); expect(lit()).toBe('b1') // already rightmost: stay
  })

  it('a submenu row keeps Right for its flyout — the arrow is a promise', () => {
    menus.open({ x: 0, y: 0, items: [
      { label: 'sub', items: [{ label: 'deep', onSelect: vi.fn() }] },
      { columnBreak: true },
      { label: 'other', onSelect: vi.fn() },
    ] })
    key('ArrowDown')  // 'sub'
    key('ArrowRight') // opens the flyout, does NOT step to 'other'
    expect(host.querySelectorAll('.menu-panel')).toHaveLength(2)
    expect(lit()).toBe('deep')
  })

  it('Right from nowhere lands on the first row instead of being swallowed', () => {
    menus.open({ x: 0, y: 0, items: palette(), viaKeyboard: true })
    key('ArrowRight')            // nothing highlighted yet
    expect(lit()).toBe('a1')     // landed, rather than doing nothing
    key('ArrowRight')
    expect(lit()).toBe('b1')     // and now it steps columns
  })

  it('an ordinary single-stack menu is just the one column', () => {
    menus.open({ x: 0, y: 0, items: [
      { label: 'one', onSelect: vi.fn() },
      { label: 'two', onSelect: vi.fn() },
    ] })
    key('ArrowDown'); expect(lit()).toBe('one')
    key('ArrowDown'); expect(lit()).toBe('two')
    key('ArrowDown'); expect(lit()).toBe('two')  // stops at the foot, like everywhere else
    key('ArrowRight'); expect(lit()).toBe('two') // no column to step to
  })
})

describe('MenuLayer music labels', () => {
  let host: HTMLElement
  let menus: MenuLayer

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    menus = new MenuLayer()
    menus.mount(host)
  })
  afterEach(() => { menus.destroy(); host.remove() })

  it('sets each label the way it will APPEAR — music, italic, or plain UI text', () => {
    menus.open({ x: 0, y: 0, items: [
      { label: '', labelFont: 'music', onSelect: vi.fn() }, // dynamicSforzato
      { label: 'dolce', labelFont: 'italic', onSelect: vi.fn() },
      { label: 'Plain', onSelect: vi.fn() },
    ] })

    const [glyph, word, plain] = [...host.querySelectorAll('.menu-row-label')] as HTMLElement[]
    // Without the music class the glyph renders as tofu in system-ui, which has no PUA codepoints.
    expect(glyph.classList.contains('menu-row-label-music')).toBe(true)
    expect(glyph.textContent).toBe('')
    // The score engraves expression text leaning, so the row that offers it leans too.
    expect(word.classList.contains('menu-row-label-italic')).toBe(true)
    expect(word.classList.contains('menu-row-label-music')).toBe(false)
    // An ordinary command row stays ordinary UI text.
    expect(plain.className).toBe('menu-row-label')
  })

  it('a submenu row is never music — a submenu is a word', () => {
    menus.open({ x: 0, y: 0, items: [{ label: 'sub', items: [{ label: 'deep', onSelect: vi.fn() }] }] })
    const label = host.querySelector('.menu-row-label') as HTMLElement
    expect(label.classList.contains('menu-row-label-music')).toBe(false)
  })
})
