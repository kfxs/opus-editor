/**
 * WHICH system edges get a left-edge sign, and where its ink lands.
 *
 * Subject: {@link renderSystemStarts}. ⭐ Two things are being pinned, and the second is why this
 * spec moved out of the facade with the code: the **drawing** (one rect, top staff's first line to
 * bottom staff's last, each end composed through its OWN staff's scale) and the family's
 * **selection rule** — one sign per system, and the culling gate that asks about the whole system
 * rather than about its two endpoints.
 *
 * ⚠️ jsdom draws nothing and measures every glyph at 0×0, so this asserts the ARITHMETIC and the
 * addressing only ([[reference_jsdom_cannot_measure_glyphs]]). There is no glyph here to measure —
 * a connector is a rectangle — and `Stave.getYForLine` is arithmetic on the stave's own numbers, not
 * a font question. That the rect then lands on the drawn staves is the browser suite's
 * (`e2e/staffSize.e2e.ts`).
 */
import { describe, it, expect } from 'vitest'
import type { Stave } from 'vexflow'
import { renderSystemStarts, type SystemStartPlacement } from './systemStart'
import { THIN_BARLINE_PX } from './barlineInk'
import type { RenderPass } from './RenderPass'

interface Rect { x: number; y: number; w: number; h: number; group: string | undefined }

/** A recording context: what was filled, and inside which open group. */
function recorder() {
  const rects: Rect[] = []
  const open: string[] = []
  const context = {
    openGroup: (cls: string) => { open.push(cls); return undefined },
    closeGroup: () => { open.pop() },
    fillRect: (x: number, y: number, w: number, h: number) =>
      { rects.push({ x, y, w, h, group: open[open.length - 1] }) },
  }
  return { rects, pass: { context } as unknown as RenderPass }
}

/**
 * A stave whose line `n` sits at `top + n * 10`. Five lines, so line 4 is the bottom one —
 * the numbers `getYForLine` would return, with no font in the answer.
 */
function stave(top: number, numLines = 5): Stave {
  return {
    getYForLine: (line: number) => top + line * 10,
    getNumLines: () => numLines,
  } as unknown as Stave
}

function at(
  measureNumber: number, staffIndex: number, staveTop: number,
  { x = 100, scale = 1, isFirstInLine = true } = {},
): SystemStartPlacement {
  return { measureNumber, staffIndex, stave: stave(staveTop), x, scale, isFirstInLine }
}

/** A two-staff system opening at bar 1: top staff at y 0, bottom at y 200. */
const grandStaff = [at(1, 0, 0), at(1, 1, 200)]

describe('the systemic barline — where its ink lands', () => {
  it('runs from the top staff’s FIRST line to the bottom staff’s LAST', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, grandStaff, 2, null)
    expect(rects).toHaveLength(1)
    // top line of staff 0 = 0; bottom line of staff 1 = 200 + 4*10 = 240, +1 for its own thickness.
    expect(rects[0].y).toBe(0)
    expect(rects[0].h).toBe(241)
  })

  it('⭐ takes x from the PLACEMENT, and the barline’s own weight — ⛔ never a scaled stave’s word', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, [at(1, 0, 0, { x: 73.5 }), at(1, 1, 200, { x: 73.5 })], 2, null)
    expect(rects[0].x).toBe(73.5)
    expect(rects[0].w).toBe(THIN_BARLINE_PX)
  })

  it('⭐⭐ composes EACH END through its OWN staff’s scale — the reason this cannot sit in `inStaffSpace`', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, [
      at(1, 0, 100, { scale: 1 }),      // full size: top line at 100
      at(1, 1, 300, { scale: 0.5 }),    // a SMALL staff: its bottom line at (300+40+1) × 0.5
    ], 2, null)
    expect(rects[0].y).toBe(100)
    expect(rects[0].h).toBeCloseTo(341 * 0.5 - 100, 6)
  })

  it('⚠️ draws inside a `stavebarline` group, which is the handle `hintBarlines` collects', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, grandStaff, 2, null)
    expect(rects[0].group).toBe('stavebarline')
  })
})

describe('the selection rule — which system edges get a sign', () => {
  it('⛔ nothing below two staves: one staff is not a system', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, [at(1, 0, 0)], 1, null)
    expect(rects).toHaveLength(0)
  })

  it('one per SYSTEM — a bar that does not open a line draws none', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, [
      ...grandStaff,
      at(2, 0, 0, { isFirstInLine: false }), at(2, 1, 200, { isFirstInLine: false }),
      at(3, 0, 500), at(3, 1, 700),
    ], 2, null)
    expect(rects).toHaveLength(2)
  })

  it('⛔ only staff 0 opens it — the bottom staff’s own placement is the OTHER end, not a second sign', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, grandStaff, 2, null)
    expect(rects).toHaveLength(1)
  })

  it('draws nothing when the bottom staff was not placed at all', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, [at(1, 0, 0)], 2, null)
    expect(rects).toHaveLength(0)
  })
})

describe('the culling gate — asked of the SYSTEM, not of its endpoints', () => {
  const threeStaff = [at(1, 0, 0), at(1, 1, 200), at(1, 2, 400)]

  it('⭐⭐ drawn when a MIDDLE staff is on screen though BOTH endpoints are culled', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, threeStaff, 3, new Set(['m1-s1']))
    expect(rects).toHaveLength(1)
  })

  it('skipped when no staff of the opening measure was painted', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, threeStaff, 3, new Set(['m2-s0']))
    expect(rects).toHaveLength(0)
  })

  it('⚠️ a null set means culling is OFF — ⛔ not "nothing was drawn"', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, threeStaff, 3, null)
    expect(rects).toHaveLength(1)
  })
})
