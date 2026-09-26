// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { ScoreModel } from '@/engine/models/ScoreModel'
import { spineConsole, type SpineConsole } from './spineConsole'

/**
 * Subject: `./spineConsole` — the panel's SIZE knob (his ask, 2026-09-25: *"we are not controlling the staff
 * size … the size of the score in the spine"*): the music at `size`, the radius in screen px. ⚠️ jsdom has no
 * fonts, so this asserts the group's transform, the panel's box and the circle's radius — never ink.
 */
let console_: SpineConsole | null = null
afterEach(() => { console_?.clear(); console_ = null })

function openConsole() {
  const model = new ScoreModel('spine')
  model.addNote({ step: 'C', octave: 5, duration: 'q', measure: 1, beat: { num: 0, den: 1 } })
  console_ = spineConsole({
    getScore: () => model.getScore(),
    exportJSON: () => model.toJSON(),
    load: () => { /* only `circle()` loads; these specs use `show` / `straight` on the model above */ },
  })
  return console_
}
const panel = () => document.querySelector<HTMLElement>('.spine-demo-panel')!
const svg = () => panel().querySelector('svg')!
const sizeGroup = () => svg().querySelector<SVGGElement>('g.spine-size')
/** The spine's radius in the GROUP's units, off the first staff line's start: the circle starts at its top,
 *  `M cx (cy − r)` with cx = cy, so r = x − y. */
const drawnRadius = () => {
  const d = svg().querySelector('path')!.getAttribute('d')!
  const m = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d)!
  return parseFloat(m[1]) - parseFloat(m[2])
}
/** Room around the spine — `spineConsole`'s own MARGIN_PX, in the music's units. */
const MARGIN = 90

describe('__spine — `size` is the MUSIC’s, `zoom` the CANVAS’s (his report, 2026-09-25: a size is not a zoom)', () => {
  it('at 1 · 1 (the default) there is NO wrapper: the drawing is byte-identical to what it was', () => {
    openConsole().show()
    expect(sizeGroup()).toBeNull()
  })

  it('⭐ ZOOM: the whole picture in one group placed by scale(z), the panel z× — circle and all', () => {
    const c = openConsole()
    c.show()
    const full = parseFloat(svg().getAttribute('width')!)
    const auto = drawnRadius()
    c.show({ zoom: 2 })
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/scale\(2/)
    expect(parseFloat(svg().getAttribute('width')!)).toBeCloseTo(full * 2, 6)
    expect(drawnRadius(), 'the radius in the group’s units is unchanged: on screen it doubled').toBeCloseTo(auto, 3)
  })

  it('⭐ SIZE: the music at k on the SAME circle — the radius sized from the music does NOT follow it', () => {
    const c = openConsole()
    c.show()
    const auto = drawnRadius() // canvas px at 1 · 1
    c.show({ size: 0.5 })
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/scale\(0\.5/)
    expect(drawnRadius() * 0.5, 'on screen, the circle is the one the page-size music asked for').toBeCloseTo(auto, 3)
    expect(parseFloat(svg().getAttribute('width')!), 'only the MARGIN (music) shrank: 2·(R + margin·k)').toBeCloseTo(2 * (auto + MARGIN * 0.5), 3)
  })

  it('⭐ a radius HE gives is in canvas px whatever the size — divided by k inside the group', () => {
    openConsole().show({ radius: 200, size: 0.5 })
    expect(drawnRadius(), 'in the group’s units, 400 — on screen 200').toBeCloseTo(400, 3)
    expect(parseFloat(svg().getAttribute('width')!)).toBeCloseTo(2 * (200 + MARGIN * 0.5), 6)
  })

  it('size and zoom compose: one group, scale(zoom · size); the panel follows the zoom alone', () => {
    const c = openConsole()
    c.show({ radius: 200, size: 0.5 })
    const unzoomed = parseFloat(svg().getAttribute('width')!)
    c.show({ radius: 200, size: 0.5, zoom: 2 })
    // ⚠️ They compose to scale(1) — and the group is STILL there, since the radius was divided by `size` for
    //    it. An identity placement writes NO transform attribute (the painter's own rule).
    expect(sizeGroup()).not.toBeNull()
    expect(sizeGroup()!.getAttribute('transform')).toBeNull()
    expect(drawnRadius(), 'the radius in the group’s units: 200 / 0.5').toBeCloseTo(400, 3)
    expect(parseFloat(svg().getAttribute('width')!)).toBeCloseTo(unzoomed * 2, 6)
  })

  it('⛔ a factor that is not a positive number is refused — the armed one kept (1 when fresh)', () => {
    openConsole().show({ size: 0, zoom: Number.NaN })
    expect(sizeGroup()).toBeNull()
  })

  it('the straight control takes both too', () => {
    openConsole().straight({ size: 0.75 })
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/scale\(0\.75/)
  })
})

describe('⭐ __spine REMEMBERS — each call keeps what the last one set (his report, 2026-09-25)', () => {
  it('a size, then a zoom: both are armed', () => {
    const c = openConsole()
    c.show({ size: 0.5 })
    c.show({ zoom: 2 })
    expect(c.dump()).toMatchObject({ kind: 'circle', size: 0.5, zoom: 2 })
    expect(sizeGroup()?.getAttribute('transform'), 'scale(zoom · size) = 1: the group with no transform').toBeNull()
    expect(sizeGroup()).not.toBeNull()
  })

  it('a radius survives a size change, a straight() in between, and a new circle() score', () => {
    const c = openConsole()
    c.show({ radius: 200 })
    c.show({ size: 0.5 })
    expect(drawnRadius(), '200 / 0.5 in the group’s units').toBeCloseTo(400, 3)
    c.straight()
    c.show()
    expect(c.dump()).toMatchObject({ kind: 'circle', radius: 200, size: 0.5 })
    c.circle({ notes: 4 })
    expect(c.dump()).toMatchObject({ radius: 200, size: 0.5 })
  })

  it("`radius: 'auto'` goes back to the circle the music asks for; clear() forgets everything", () => {
    const c = openConsole()
    c.show()
    const auto = drawnRadius()
    c.show({ radius: 200 })
    c.show({ radius: 'auto' })
    expect(drawnRadius()).toBeCloseTo(auto, 3)
    c.show({ size: 0.5, zoom: 2, radius: 150 })
    c.clear()
    c.show()
    expect(c.dump()).toEqual({ kind: 'circle', radius: 'auto', size: 1, zoom: 1 })
  })

  it('⛔ a refused factor keeps the LAST value rather than resetting it', () => {
    const c = openConsole()
    c.show({ size: 0.5 })
    c.show({ size: -1, zoom: Number.NaN })
    expect(c.dump()).toMatchObject({ size: 0.5, zoom: 1 })
  })
})

describe('__spine — drag a CORNER: the canvas grows, the drawing keeps its size (his ask, 2026-09-26)', () => {
  const corner = (key: 'nw' | 'ne' | 'sw' | 'se') => panel().querySelector<HTMLElement>(`.spine-demo-corner-${key}`)!
  const drag = (el: HTMLElement, dx: number, dy: number) => {
    el.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }))
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + dx, clientY: 100 + dy, bubbles: true }))
    el.dispatchEvent(new MouseEvent('pointerup', { clientX: 100 + dx, clientY: 100 + dy, bubbles: true }))
  }
  /** Let a frame-throttled redraw land. */
  const frame = () => new Promise(resolve => setTimeout(resolve, 50))
  const size = () => ({ width: parseFloat(svg().getAttribute('width')!), height: parseFloat(svg().getAttribute('height')!) })

  it('four corner handles, and a redraw keeps them', async () => {
    const c = openConsole()
    c.show()
    expect(panel().querySelectorAll('.spine-demo-corner')).toHaveLength(4)
    c.show({ zoom: 2 })
    expect(panel().querySelectorAll('.spine-demo-corner')).toHaveLength(4)
  })

  it('⭐ the SE corner grows the CANVAS; the music keeps its size AND its place — ⛔ not a zoom, ⛔ not re-centred', async () => {
    const c = openConsole()
    c.show()
    const before = size()
    const radius = drawnRadius()
    drag(corner('se'), 200, 100)
    await frame()
    expect(size().width).toBeCloseTo(before.width + 200, 6)
    expect(size().height).toBeCloseTo(before.height + 100, 6)
    expect(sizeGroup(), 'nothing moved: at 1 · 1 and no offset there is still no wrapper').toBeNull()
    expect(drawnRadius(), 'the circle is the same size').toBeCloseTo(radius, 3)
  })

  it('the NW corner grows it the other way and MOVES the panel by what it grew', async () => {
    const c = openConsole()
    c.show()
    const before = size()
    const left = parseFloat(getComputedStyle(panel()).left) || 0
    drag(corner('nw'), -80, -40)
    await frame()
    expect(size().width).toBeCloseTo(before.width + 80, 6)
    expect(parseFloat(panel().style.left)).toBeCloseTo(left - 80, 6)
    // …and the drawing is pushed in by the same 80 × 40, so on screen it has not moved.
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/translate\(80,? ?40\)|matrix\(1,? ?0,? ?0,? ?1,? ?80,? ?40\)/)
  })

  it('⛔ the corner handles are invisible — a grab area, no grey square (his word)', () => {
    openConsole().show()
    for (const handle of panel().querySelectorAll<HTMLElement>('.spine-demo-corner')) expect(handle.style.background).toBe('')
  })

  it('the chosen canvas survives a show(); clear() forgets it', async () => {
    const c = openConsole()
    c.show()
    const before = size()
    drag(corner('se'), 150, 150)
    await frame()
    c.show({ size: 0.5 })
    expect(size().width).toBeCloseTo(before.width + 150, 6)
    c.clear()
    c.show()
    expect(size().width).toBeCloseTo(before.width, 6)
  })
})

describe('__spine — RIGHT-drag pans the drawing inside the canvas (his ask, 2026-09-26)', () => {
  const press = (button: number, dx: number, dy: number) => {
    const el = panel()
    el.dispatchEvent(new MouseEvent('pointerdown', { button, clientX: 100, clientY: 100, bubbles: true }))
    el.dispatchEvent(new MouseEvent('pointermove', { button, clientX: 100 + dx, clientY: 100 + dy, bubbles: true }))
    el.dispatchEvent(new MouseEvent('pointerup', { button, clientX: 100 + dx, clientY: 100 + dy, bubbles: true }))
  }
  const frame = () => new Promise(resolve => setTimeout(resolve, 50))

  it('⭐ the drawing moves by the drag; the canvas keeps its size and the panel its place', async () => {
    const c = openConsole()
    c.show()
    const width = svg().getAttribute('width')
    const left = panel().style.left
    press(2, 30, -20)
    await frame()
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/translate\(30,? ?-20\)|matrix\(1,? ?0,? ?0,? ?1,? ?30,? ?-20\)/)
    expect(svg().getAttribute('width')).toBe(width)
    expect(panel().style.left).toBe(left)
  })

  it('the LEFT button still moves the panel, not the drawing', async () => {
    const c = openConsole()
    c.show()
    press(0, 30, 20)
    await frame()
    expect(sizeGroup()).toBeNull()
  })

  it('the panel suppresses the browser\'s menu, so the right button is free', () => {
    openConsole().show()
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    panel().dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})

describe('__spine — CTRL + WHEEL zooms the PREVIEW, never the page (his ask, 2026-09-26)', () => {
  const wheel = (ctrlKey: boolean, deltaY: number) => {
    const e = new WheelEvent('wheel', { ctrlKey, deltaY, clientX: 0, clientY: 0, bubbles: true, cancelable: true })
    svg().dispatchEvent(e)
    return e
  }

  it('⭐ Ctrl + wheel up zooms IN — the drawing grows, the canvas keeps its size', () => {
    const c = openConsole()
    c.show()
    const width = svg().getAttribute('width')
    const e = wheel(true, -200)
    expect(e.defaultPrevented, 'not the browser\'s page zoom').toBe(true)
    expect(c.dump().zoom).toBeGreaterThan(1)
    expect(svg().getAttribute('width'), 'the canvas is pinned').toBe(width)
    expect(sizeGroup()?.getAttribute('transform')).toMatch(/scale|matrix/)
  })

  it('⭐ the point under the pointer stays put: zooming at the canvas\'s corner leaves no offset', () => {
    const c = openConsole()
    c.show()
    wheel(true, -200) // at (0, 0) — the canvas's own top-left in jsdom
    expect(sizeGroup()?.getAttribute('transform')).not.toMatch(/translate\((?!0,? ?0\))/)
  })

  it('⛔ the PAGE never sees a wheel over the preview — Ctrl or not', () => {
    const c = openConsole()
    c.show()
    let seen = 0
    const listener = () => { seen++ }
    window.addEventListener('wheel', listener)
    try {
      wheel(true, -100)
      wheel(false, -100)
    } finally {
      window.removeEventListener('wheel', listener)
    }
    expect(seen).toBe(0)
  })

  it('a PLAIN wheel is not a zoom — the browser keeps its scrolling', () => {
    const c = openConsole()
    c.show()
    const e = wheel(false, -200)
    expect(e.defaultPrevented).toBe(false)
    expect(c.dump().zoom).toBe(1)
  })
})
