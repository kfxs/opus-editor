import { describe, it, expect, beforeEach } from 'vitest'
import { WindowManager } from './WindowManager'
import { Window, WINDOW_DEFAULTS } from './Window'

describe('WindowManager', () => {
  let m: WindowManager

  beforeEach(() => {
    m = new WindowManager()
    m.setBounds(1600, 900)
  })

  it('opens windows with distinct ids, and cascades them so a second one is visibly a second one', () => {
    const a = m.open()
    const b = m.open()
    expect(a.id).not.toBe(b.id)
    expect(b.rect.x).toBeGreaterThan(a.rect.x)
    expect(b.rect.y).toBeGreaterThan(a.rect.y)
  })

  // `center` is finished by the DOM layer (only it knows the fitted height); the manager's job is to
  // keep out of the way — the cascade must not stamp a position that would read as an explicit x/y.
  it('leaves a centred window unpositioned, and marks it for the layer to centre', () => {
    m.open() // one cascade step already spent, so the origin is not the answer by accident
    const win = m.open({ center: true, width: 200, height: 100 })
    expect(win.centerOnOpen).toBe(true)
    expect(win.rect.x).toBe(0)
    expect(win.rect.y).toBe(0)
  })

  it('lets an explicit position beat center, the same way it beats the cascade', () => {
    const win = m.open({ center: true, x: 40, y: 60 })
    expect(win.centerOnOpen).toBe(false)
    expect(win.rect).toMatchObject({ x: 40, y: 60 })
  })

  // Escape goes to the frontmost window that CLAIMS it. Not simply the frontmost window: the
  // standing panels (Keypad, Properties) are on the glass too, and clicking one raises it above an
  // open dialog — Escape must not stop cancelling that dialog because you touched a panel.
  describe('escapeTarget', () => {
    it('is nobody when no window claims Escape', () => {
      m.open()
      m.open()
      expect(m.escapeTarget()).toBeUndefined()
    })

    it('is the frontmost claimant', () => {
      const first = m.open({ onCancel: () => {} })
      const second = m.open({ onCancel: () => {} })
      expect(m.escapeTarget()).toBe(second)
      first.raise()
      expect(m.escapeTarget()).toBe(first)
    })

    it('skips a panel raised above the dialog', () => {
      const dialog = m.open({ onCancel: () => {} })
      const panel = m.open() // no claim — a Keypad
      panel.raise()
      expect(m.escapeTarget()).toBe(dialog)
    })
  })

  it('stacks each new window above the last', () => {
    const a = m.open()
    const b = m.open()
    expect(b.z).toBeGreaterThan(a.z)
    expect(m.list()).toEqual([a, b]) // list() is bottom-to-top
  })

  it('raises a window above the others, and reports no change when it is already on top', () => {
    const a = m.open()
    const b = m.open()
    a.raise()
    expect(m.list()).toEqual([b, a])
    expect(m.raise(a)).toBe(false) // already top — free, and emits nothing
  })

  it('lets a window close itself, and removes it from the list', () => {
    const a = m.open()
    const b = m.open()
    a.close()
    expect(m.list()).toEqual([b])
    expect(m.close(a)).toBe(false) // already gone
  })

  it('accepts a Window built by hand', () => {
    const win = m.open(new Window('custom', { title: 'Mine', x: 10, y: 20 }))
    expect(win.id).toBe('custom')
    expect(m.get('custom')).toBe(win)
  })

  it('notifies subscribers when the SET of windows, or a title, changes', () => {
    let calls = 0
    const off = m.subscribe(() => calls++)
    const a = m.open()
    expect(calls).toBe(1)
    a.setTitle('Renamed')
    expect(calls).toBe(2)
    a.setTitle('Renamed') // same title — nothing to tell the DOM
    expect(calls).toBe(2)
    a.close()
    expect(calls).toBe(3)
    off()
    m.open()
    expect(calls).toBe(3)
  })

  it('does NOT notify on a drag — dragging writes styles directly, it does not re-render', () => {
    const a = m.open()
    let calls = 0
    m.subscribe(() => calls++)
    a.moveBy(10, 10)
    a.resizeBy({ east: true }, 10, 0)
    expect(calls).toBe(0)
  })

  it('pulls windows back inside when the viewport shrinks, without shrinking them', () => {
    const a = m.open({ x: 1200, y: 700, width: 300, height: 200 })
    m.setBounds(800, 600)
    expect(a.rect).toEqual({ x: 500, y: 400, width: 300, height: 200 })
  })
})

describe('Window', () => {
  let m: WindowManager

  beforeEach(() => {
    m = new WindowManager()
    m.setBounds(1600, 900)
  })

  it('moves by a delta', () => {
    const a = m.open({ x: 100, y: 100 })
    a.moveBy(40, -25)
    expect(a.rect).toMatchObject({ x: 140, y: 75 })
  })

  it('clamps a move so a window can never be dragged out of reach', () => {
    const a = m.open({ x: 100, y: 100, width: 300, height: 200 })
    a.moveBy(-9999, -9999)
    expect(a.rect).toMatchObject({ x: 0, y: 0 })
    a.moveBy(9999, 9999)
    expect(a.rect).toMatchObject({ x: 1600 - 300, y: 900 - 200 })
  })

  it('resizes from the east/south edges without moving the origin', () => {
    const a = m.open({ x: 100, y: 100, width: 300, height: 200 })
    a.resizeBy({ east: true, south: true }, 50, 30)
    expect(a.rect).toEqual({ x: 100, y: 100, width: 350, height: 230 })
  })

  it('resizes from the west/north edges by moving the origin too', () => {
    const a = m.open({ x: 100, y: 100, width: 300, height: 200 })
    a.resizeBy({ west: true, north: true }, 40, 20)
    expect(a.rect).toEqual({ x: 140, y: 120, width: 260, height: 180 })
  })

  it('stops the ORIGIN when a west/north resize hits the floor — the window must not slide away', () => {
    const a = m.open({ x: 100, y: 100, width: 300, height: 200 })
    a.resizeBy({ west: true, north: true }, 9999, 9999)
    expect(a.rect.width).toBe(WINDOW_DEFAULTS.minWidth)
    expect(a.rect.height).toBe(WINDOW_DEFAULTS.minHeight)
    // The right/bottom edges stayed put: origin + size still lands on 400 / 300.
    expect(a.rect.x + a.rect.width).toBe(400)
    expect(a.rect.y + a.rect.height).toBe(300)
  })

  it('honours its OWN floor, not a global one — the property is per window', () => {
    const a = m.open({ width: 300, height: 200, minWidth: 250, minHeight: 180 })
    a.resizeBy({ east: true, south: true }, -9999, -9999)
    expect(a.rect).toMatchObject({ width: 250, height: 180 })
  })

  it('will not resize at all when it is not resizable', () => {
    const a = m.open({ width: 300, height: 200, resizable: false })
    a.resizeBy({ east: true, south: true }, 100, 100)
    expect(a.rect).toMatchObject({ width: 300, height: 200 })
  })
})
