import { describe, it, expect } from 'vitest'
import { apply, isTranslation } from '@/engine/paint/Affine'
import { circleSpine, placementAt, pointAt, straightSpine } from './staffSpine'

/**
 * ⭐ Pure arithmetic — a bent staff's whole contract runs in jsdom (`docs/plans/bent-staff-plan.md` A2).
 *
 * ⚠️ The thing that can be wrong in a way that looks right is a SENSE: which way travel goes round a
 * circle, and which side "down" is on. Each is pinned against a point where the two senses disagree.
 */

const close = (got: { x: number; y: number }, x: number, y: number) => {
  expect(got.x).toBeCloseTo(x, 9)
  expect(got.y).toBeCloseTo(y, 9)
}

describe('straightSpine — today’s staff is the simplest spine', () => {
  const spine = straightSpine(100, 50, 400)

  it('walks toward +x, at angle 0, and is open', () => {
    expect(spine.at(30)).toEqual({ x: 130, y: 50, angle: 0 })
    expect(spine.closed).toBe(false)
    expect(spine.length).toBe(400)
  })

  it('⭐ places a block by a pure TRANSLATION — the fast path every normal score keeps', () => {
    const m = placementAt(spine, 30)
    expect(isTranslation(m)).toBe(true)
    expect(apply(m, 0, 0)).toEqual({ x: 130, y: 50 })
  })

  it('an offset is the ordinary y below the line', () => {
    close(pointAt(spine, 30, 20), 130, 70)
    expect(spine.locate(130, 70)).toEqual({ s: 30, offset: 20 })
  })

  it('a slanted spine carries its angle, and "down" turns with it', () => {
    const down = straightSpine(0, 0, 100, Math.PI / 2)   // travelling toward +y
    close(down.at(10), 0, 10)
    close(pointAt(down, 10, 5), -5, 10)                  // "down" is now toward −x
  })
})

describe('circleSpine', () => {
  const spine = circleSpine(500, 500, 200)

  it('starts at twelve o’clock, travelling toward +x like a straight staff', () => {
    const start = spine.at(0)
    close(start, 500, 300)
    expect(start.angle).toBeCloseTo(0, 9)
  })

  // 🚨 THE SENSE TEST: a quarter of the way round, clockwise on the page is THREE o'clock (+x of the
  // centre) and travel points DOWN the page; anticlockwise would be nine o'clock.
  it('⭐⭐ travels CLOCKWISE on the page', () => {
    const quarter = spine.at(spine.length / 4)
    close(quarter, 700, 500)
    expect(quarter.angle).toBeCloseTo(Math.PI / 2, 9)
  })

  it('⭐⭐ "down" is INWARD — so a stems-up note points away from the centre, as on the plate', () => {
    close(pointAt(spine, 0, 40), 500, 340)               // below the top of the circle = nearer the centre
    close(pointAt(spine, 0, -40), 500, 260)
  })

  it('is closed: its length is the circumference, and s wraps', () => {
    expect(spine.closed).toBe(true)
    expect(spine.length).toBeCloseTo(2 * Math.PI * 200, 9)
    close(spine.at(spine.length), 500, 300)
  })

  it('⭐ a block’s origin lands on the circle and its x axis runs along the tangent', () => {
    const m = placementAt(spine, spine.length / 4)       // three o'clock, travelling down the page
    close(apply(m, 0, 0), 700, 500)
    close(apply(m, 10, 0), 700, 510)                     // along the block's x = down the page
    close(apply(m, 0, 10), 690, 500)                     // the block's "down" = toward the centre
  })

  it('⭐ locate is pointAt’s inverse all the way round', () => {
    for (const s of [0, 1, 123.4, spine.length / 2, spine.length - 1]) {
      for (const offset of [-30, 0, 45]) {
        const p = pointAt(spine, s, offset)
        const back = spine.locate(p.x, p.y)!
        expect(back.s).toBeCloseTo(s, 6)
        expect(back.offset).toBeCloseTo(offset, 6)
      }
    }
  })

  it('⛔ does not guess at its own centre — every s is equally near', () => {
    expect(spine.locate(500, 500)).toBeNull()
  })

  it('honours a start angle', () => {
    close(circleSpine(0, 0, 10, 0).at(0), 10, 0)         // three o'clock
  })
})
