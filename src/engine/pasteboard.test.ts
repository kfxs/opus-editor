import { describe, it, expect } from 'vitest'
import { paddedSize, openingScroll, PASTEBOARD_MARGIN } from './pasteboard'

describe('paddedSize', () => {
  it('adds the margin to BOTH sides of both axes', () => {
    expect(paddedSize({ w: 800, h: 1000 }, { x: 400, y: 400 })).toEqual({ w: 1600, h: 1800 })
  })

  it('is the identity at margin 0 — the model default, so a host that never opts in is unchanged', () => {
    expect(paddedSize({ w: 800, h: 1000 }, { x: 0, y: 0 })).toEqual({ w: 800, h: 1000 })
  })
})

describe('openingScroll', () => {
  const viewport = { w: 1000, h: 600 }

  it('centres the page horizontally: equal pasteboard either side', () => {
    // Surface 1600 wide in a 1000 viewport → 600 of overhang, half of it on each side.
    const { x } = openingScroll({ w: 1600, h: 1800 }, viewport, 400, 24)
    expect(x).toBe(300)
    // Which is the page's own left edge (400) minus the slack that centres it (100).
    expect(400 - x).toBe(100)
  })

  it('opens at the TOP of the page, not the middle of it', () => {
    const { y } = openingScroll({ w: 1600, h: 1800 }, viewport, 400, 24)
    // Just above the page's top edge — NOT (1800-600)/2 = 600, which would open the editor looking
    // at the middle of the page with the first system off-screen.
    expect(y).toBe(376)
    expect(y).toBeLessThan(400)
  })

  it('leaves exactly topGap of pasteboard showing above the page', () => {
    const { y } = openingScroll({ w: 1600, h: 1800 }, viewport, 400, 24)
    expect(400 - y).toBe(24)
  })

  it("aligned to the START, opens at 0 — the strip's beginning, not the desk's middle", () => {
    // Linear view: the music runs off to the right, so there is no middle to centre on. It asks for
    // 0 rather than for the gutter's pan limit — placing the view against that limit is the
    // viewport's job (ViewportModel.setPinnedGutter), and clamping 0 lands exactly there.
    const { x, y } = openingScroll({ w: 1600, h: 1800 }, viewport, 400, 24, 'start')
    expect(x).toBe(0)
    expect(y).toBe(376) // the vertical is the same decision either way: the top of the music
  })

  it('never returns a negative scroll when the viewport is larger than the surface', () => {
    const huge = { w: 4000, h: 4000 }
    expect(openingScroll({ w: 1600, h: 1800 }, huge, 400, 24)).toEqual({ x: 0, y: 376 })
  })

  it('scales with zoom, because the caller passes screen px', () => {
    // Same page at 2× — every input doubles, so the centred scroll doubles too.
    const at1 = openingScroll({ w: 1600, h: 1800 }, viewport, 400, 24)
    const at2 = openingScroll({ w: 3200, h: 3600 }, { w: 2000, h: 1200 }, 800, 48)
    expect(at2.x).toBe(at1.x * 2)
    expect(at2.y).toBe(at1.y * 2)
  })
})

describe('PASTEBOARD_MARGIN', () => {
  it('is stated in layout px — a positive number the host multiplies by zoom', () => {
    expect(PASTEBOARD_MARGIN).toBeGreaterThan(0)
  })
})
