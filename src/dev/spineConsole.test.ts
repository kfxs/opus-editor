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
