import { describe, it, expect } from 'vitest'
import { pageBoxAt, stepLeavesPage, nudgeFitsOnPage, edgeStepFitsOnPage, type PageBox } from './pageBounds'
import { resolveSurface, A4_NORMAL, SKETCH_CANVAS } from './surface'
import { PAGE_GAP_PX } from '../rendering/PagePass'

/**
 * {@link pageBounds} — how far a hand-nudged object may be pushed before the paper runs out.
 *
 * ⭐⭐ **The claim these exist to protect is the one his second message made**: the limit refuses the
 * WRITE rather than clamping the drawing, so the stored offset never accumulates past the edge and
 * there is no dead zone to press back through. That behaviour is `MusicEngine`'s to wire (one row per
 * offset client); what is pinned here is the arithmetic it asks — which sheet a point is on, and
 * whether a step pushes ink further off it.
 *
 * ⚠️ No glyphs and no render: every box is handed in, so nothing here measures anything jsdom cannot.
 */
const PAGE = resolveSurface(A4_NORMAL)
const CANVAS = resolveSurface(SKETCH_CANVAS)

/** A box, in the drawing's own pixels. */
const ink = (x: number, y: number, width = 20, height = 10) => ({ x, y, width, height })

describe('pageBoxAt', () => {
  it('gives the first sheet for a point on it', () => {
    expect(pageBoxAt(PAGE, 50, 50)).toEqual({
      left: 0, right: PAGE.widthPx, top: 0, bottom: PAGE.heightPx,
    })
  })

  it('⭐ finds the SECOND sheet for a point past the gap — the spread is not one page', () => {
    const pitch = PAGE.widthPx + PAGE_GAP_PX
    const box = pageBoxAt(PAGE, pitch + 10, 50)!
    expect(box.left).toBeCloseTo(pitch, 5)
    expect(box.right).toBeCloseTo(pitch + PAGE.widthPx, 5)
  })

  it('⚠️ a point in the GAP between sheets belongs to the one before it — so it reads as OUT', () => {
    const inGap = PAGE.widthPx + PAGE_GAP_PX / 2
    const box = pageBoxAt(PAGE, inGap, 50)!
    expect(box.left).toBe(0)
    expect(inGap, 'past that sheet\'s right edge').toBeGreaterThan(box.right)
  })

  it('⛔ answers NULL on a canvas — his call: no boundaries in the linear view, so no limit', () => {
    // ⭐ And it falls out of the surface model rather than a view-mode flag: `heightPx === null` IS
    // "this is not paper" (see `./surface`).
    expect(CANVAS.heightPx).toBeNull()
    expect(pageBoxAt(CANVAS, 5000, 5000)).toBeNull()
  })
})

describe('stepLeavesPage', () => {
  const box: PageBox = { left: 100, right: 300, top: 100, bottom: 300 }

  it('⭐ allows every direction while the ink is INSIDE — the limit is not a cage', () => {
    const inside = ink(150, 150)
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      expect(stepLeavesPage(box, inside, dx, dy), `d(${dx},${dy})`).toBe(false)
    }
  })

  it('⭐⭐ refuses only the direction that pushes ink FURTHER OUT — coming back is always allowed', () => {
    const offLeft = ink(80, 150)   // its left edge is past the sheet's
    expect(stepLeavesPage(box, offLeft, -1, 0), 'further left: refused').toBe(true)
    expect(stepLeavesPage(box, offLeft, 1, 0), '⭐ back toward the page: ALLOWED').toBe(false)
    // ⭐⭐ That asymmetry IS the fix for his dead zone: the value never ran past the edge, so the
    // very first press the other way moves the ink.
  })

  it('judges each edge on its own', () => {
    expect(stepLeavesPage(box, ink(290, 150), 1, 0), 'right edge over').toBe(true)
    expect(stepLeavesPage(box, ink(150, 90), 0, -1), 'above the top').toBe(true)
    expect(stepLeavesPage(box, ink(150, 295), 0, 1), 'below the bottom').toBe(true)
    expect(stepLeavesPage(box, ink(150, 90), 0, 1), 'above the top, heading down').toBe(false)
  })

  it('⭐⭐ a step from INSIDE that would CROSS the edge is refused — the object cannot leave the paper', () => {
    // The rule became forward-looking on his second report; before that this step was allowed once,
    // because nothing knew the ink had crossed until it had.
    const nearRight = ink(280, 150) // right edge at 300, exactly the sheet's
    expect(stepLeavesPage(box, nearRight, 1, 0), 'one pixel over: refused').toBe(true)
    expect(stepLeavesPage(box, ink(270, 150), 5, 0), 'still inside: allowed').toBe(false)
  })

  it('⭐⭐ …and a BIG typed delta cannot leap the boundary — his Properties case', () => {
    // A keypress is small enough that a backwards-looking test stopped it within a step. A typed
    // value is `next − current`, which can be any size at all: *"the offset limit should also be true
    // of properties… I now test with note offset and I see we can go out of the page."*
    expect(stepLeavesPage(box, ink(150, 150), 9000, 0)).toBe(true)
    expect(stepLeavesPage(box, ink(150, 150), -9000, 0)).toBe(true)
  })

  it('⭐ coming BACK is allowed even while still hanging off — the overhang only has to shrink', () => {
    const wayOff = ink(-100, 150)
    expect(stepLeavesPage(box, wayOff, 50, 0), 'still off the sheet, but less so').toBe(false)
    expect(stepLeavesPage(box, wayOff, -1, 0), 'further off: refused').toBe(true)
  })

  it('⚠️ a DIAGONAL is refused when EITHER axis is blocked', () => {
    // Sliding along an edge while leaving the sheet on the other axis is still leaving the sheet,
    // and storing "the part that fits" would write a delta nobody pressed.
    const offLeft = ink(80, 150)
    expect(stepLeavesPage(box, offLeft, -1, 1)).toBe(true)
  })

  it('⚠️ the ink is measured by its own EDGES, not its centre', () => {
    // A wide mark whose centre is comfortably inside can still have a corner off the sheet.
    expect(stepLeavesPage(box, ink(250, 150, 60), 1, 0), 'right edge at 310').toBe(true)
    expect(stepLeavesPage(box, ink(250, 150, 20), 1, 0), 'right edge at 270').toBe(false)
  })
})

describe('nudgeFitsOnPage', () => {
  it('⛔ allows anything on a canvas — there is no boundary to be outside of', () => {
    expect(nudgeFitsOnPage(CANVAS, [ink(-9000, -9000)], -1, -1)).toBe(true)
  })

  it('⚠️ allows an element with NO drawn ink — refusing on no evidence makes it unmovable', () => {
    expect(nudgeFitsOnPage(PAGE, [], -1, 0)).toBe(true)
  })

  it('refuses when the only drawn piece is already over the edge on the pushing side', () => {
    expect(nudgeFitsOnPage(PAGE, [ink(-5, 50)], -1, 0)).toBe(false)
    expect(nudgeFitsOnPage(PAGE, [ink(-5, 50)], 1, 0), 'and lets it come back').toBe(true)
  })

  it('⭐⭐ the PREDICTION is judged against the sheet the ink is on NOW, not the one it would reach', () => {
    // A jump big enough to clear the gap would otherwise land "inside" the next sheet and be waved
    // through — the ink would have teleported across a page boundary rather than been limited.
    const pitch = PAGE.widthPx + PAGE_GAP_PX
    expect(nudgeFitsOnPage(PAGE, [ink(200, 100)], pitch + 100, 0)).toBe(false)
  })

  it('⭐ judges each fragment against ITS OWN sheet — a span can cross a page break', () => {
    const pitch = PAGE.widthPx + PAGE_GAP_PX
    const onPage1 = ink(50, 50)
    // Comfortably inside sheet TWO. Measured against sheet ONE's edges it would read as far off the
    // right — which is the bug this case exists to refuse.
    const onPage2 = ink(pitch + 50, 50)
    expect(nudgeFitsOnPage(PAGE, [onPage1, onPage2], 1, 0)).toBe(true)
    // …and a piece genuinely off sheet two's right edge still blocks the shared offset.
    const offPage2 = ink(pitch + PAGE.widthPx - 5, 50)
    expect(nudgeFitsOnPage(PAGE, [onPage1, offPage2], 1, 0)).toBe(false)
  })
})

/**
 * ⭐⭐ ONE MOVING EDGE — the same rule asked of a press that moves one END of a span, which is what
 * broke his octave bracket on 2026-08-21 (see {@link edgeStepFitsOnPage}).
 */
describe('edgeStepFitsOnPage', () => {
  it('refuses a step that would push THAT EDGE off the sheet, and lets it come back', () => {
    expect(edgeStepFitsOnPage(PAGE, { x: -5, y: 50 }, -1)).toBe(false)
    expect(edgeStepFitsOnPage(PAGE, { x: -5, y: 50 }, 1)).toBe(true)
  })

  it('🚨🚨 …and says NOTHING about the other end — the deadlock this exists to end', () => {
    // A bracket hanging off BOTH edges: the whole-object rule refuses every direction, because one
    // box grows on the left and the same box grows on the right. Asked per edge, each end can still
    // come home.
    const left = { x: -5, y: 50 }
    const right = { x: PAGE.widthPx + 5, y: 50 }
    expect(nudgeFitsOnPage(PAGE, [ink(-5, 50, PAGE.widthPx + 20)], 1, 0), 'the old question').toBe(false)
    expect(edgeStepFitsOnPage(PAGE, left, 1), 'the beginning comes home').toBe(true)
    expect(edgeStepFitsOnPage(PAGE, right, -1), 'and so does the end').toBe(true)
  })
})
