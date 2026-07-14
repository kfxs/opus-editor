import { describe, it, expect } from 'vitest'
import { placeFlyout, placeRoot } from './placement'

/**
 * The flip arithmetic, tested with no browser — which is the point of keeping it pure. jsdom cannot
 * measure a menu, but it does not have to: the DOM supplies the SIZE and this file decides the SPOT.
 */

const BOUNDS = { width: 800, height: 400 }
const MENU = { width: 200, height: 150 }

describe('placeRoot', () => {
  it('opens down-and-right from the click when there is room', () => {
    expect(placeRoot({ x: 100, y: 50 }, MENU, BOUNDS)).toEqual({ x: 100, y: 50 })
  })

  it('FLIPS left rather than clamping, so the menu never lands under the cursor', () => {
    // Clamping would give x = 600 and put the pointer INSIDE the menu; flipping puts it on the corner.
    expect(placeRoot({ x: 750, y: 50 }, MENU, BOUNDS).x).toBe(550)
  })

  it('flips up at the bottom edge', () => {
    expect(placeRoot({ x: 100, y: 380 }, MENU, BOUNDS).y).toBe(230)
  })

  it('flips both ways in the far corner', () => {
    expect(placeRoot({ x: 790, y: 390 }, MENU, BOUNDS)).toEqual({ x: 590, y: 240 })
  })

  it('clamps only when the menu cannot fit either side — it is bigger than the world', () => {
    const tall = { width: 200, height: 500 }
    expect(placeRoot({ x: 100, y: 300 }, tall, BOUNDS).y).toBe(0) // partly visible beats off-screen
  })
})

describe('placeFlyout', () => {
  const parent = { x: 100, y: 50, width: 180, height: 200 }

  it('opens to the right of its parent, level with the row that opened it', () => {
    expect(placeFlyout(parent, 90, MENU, BOUNDS)).toEqual({ x: 277, y: 90 })
  })

  it('flips to the LEFT of the parent when the right side would overflow', () => {
    const nearEdge = { x: 650, y: 50, width: 180, height: 200 }
    expect(placeFlyout(nearEdge, 90, MENU, BOUNDS).x).toBe(453)
  })

  it('slides up rather than flipping vertically — a flyout stays touching its own row', () => {
    // Flipping would hang it ABOVE the row, where it reads as some other row's menu.
    expect(placeFlyout(parent, 350, MENU, BOUNDS).y).toBe(250)
  })
})
