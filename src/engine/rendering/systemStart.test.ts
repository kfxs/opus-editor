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
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import {
  BRACKET_DEPTH_SPACES, SIGN_SEPARATION_SPACES, SIGN_TO_BARLINE_SPACES, scoreSystemStartIndentPx,
  BRACKET_SERIF_INSET_SPACES,
  BRACKET_ROD_PROJECTION_SPACES,
} from '@/engine/layout/systemStartColumn'
import type { RenderPass } from './RenderPass'
import type { Score } from '@/types/music'

/** A two-staff score with NO grouping symbol — so only the systemic barline is ever drawn. */
const noSigns = { id: 's', title: '', measures: [], staves: [{ id: 'a' }, { id: 'b' }] } as unknown as Score

interface Rect { x: number; y: number; w: number; h: number; group: string | undefined }
/** ⚠️ WHICH glyph was stamped WHERE — its ORIGIN, ⛔ never its ink. jsdom measures every glyph at
 *  0×0, so where the serif's own box then puts it is the browser suite's question. */
interface Stamp { glyph: string; x: number; y: number; group: string | undefined }

/** A recording context: what was filled and stamped, and inside which open group. */
function recorder() {
  const rects: Rect[] = []
  const stamps: Stamp[] = []
  const open: string[] = []
  const context = {
    openGroup: (cls: string) => { open.push(cls); return undefined },
    closeGroup: () => { open.pop() },
    fillRect: (x: number, y: number, w: number, h: number) =>
      { rects.push({ x, y, w, h, group: open[open.length - 1] }) },
    // What `Element.renderText` needs of a context, and no more.
    setFont: () => undefined,
    fillText: (glyph: string, x: number, y: number) =>
      { stamps.push({ glyph, x, y, group: open[open.length - 1] }) },
  }
  return { rects, stamps, pass: { context } as unknown as RenderPass }
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
    renderSystemStarts(pass, noSigns, grandStaff, 2, null)
    expect(rects).toHaveLength(1)
    // top line of staff 0 = 0; bottom line of staff 1 = 200 + 4*10 = 240, +1 for its own thickness.
    expect(rects[0].y).toBe(0)
    expect(rects[0].h).toBe(241)
  })

  it('⭐ takes x from the PLACEMENT, and the barline’s own weight — ⛔ never a scaled stave’s word', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [at(1, 0, 0, { x: 73.5 }), at(1, 1, 200, { x: 73.5 })], 2, null)
    expect(rects[0].x).toBe(73.5)
    expect(rects[0].w).toBe(THIN_BARLINE_PX)
  })

  it('⭐⭐ composes EACH END through its OWN staff’s scale — the reason this cannot sit in `inStaffSpace`', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [
      at(1, 0, 100, { scale: 1 }),      // full size: top line at 100
      at(1, 1, 300, { scale: 0.5 }),    // a SMALL staff: its bottom line at (300+40+1) × 0.5
    ], 2, null)
    expect(rects[0].y).toBe(100)
    expect(rects[0].h).toBeCloseTo(341 * 0.5 - 100, 6)
  })

  it('⚠️ draws inside a `stavebarline` group, which is the handle `hintBarlines` collects', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, grandStaff, 2, null)
    expect(rects[0].group).toBe('stavebarline')
  })
})

describe('the selection rule — which system edges get a sign', () => {
  it('⛔ nothing below two staves: one staff is not a system', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [at(1, 0, 0)], 1, null)
    expect(rects).toHaveLength(0)
  })

  it('one per SYSTEM — a bar that does not open a line draws none', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [
      ...grandStaff,
      at(2, 0, 0, { isFirstInLine: false }), at(2, 1, 200, { isFirstInLine: false }),
      at(3, 0, 500), at(3, 1, 700),
    ], 2, null)
    expect(rects).toHaveLength(2)
  })

  it('⛔ only staff 0 opens it — the bottom staff’s own placement is the OTHER end, not a second sign', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, grandStaff, 2, null)
    expect(rects).toHaveLength(1)
  })

  it('draws nothing when the bottom staff was not placed at all', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [at(1, 0, 0)], 2, null)
    expect(rects).toHaveLength(0)
  })
})

describe('the culling gate — asked of the SYSTEM, not of its endpoints', () => {
  const threeStaff = [at(1, 0, 0), at(1, 1, 200), at(1, 2, 400)]

  it('⭐⭐ drawn when a MIDDLE staff is on screen though BOTH endpoints are culled', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, threeStaff, 3, new Set(['m1-s1']))
    expect(rects).toHaveLength(1)
  })

  it('skipped when no staff of the opening measure was painted', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, threeStaff, 3, new Set(['m2-s0']))
    expect(rects).toHaveLength(0)
  })

  it('⚠️ a null set means culling is OFF — ⛔ not "nothing was drawn"', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, threeStaff, 3, null)
    expect(rects).toHaveLength(1)
  })
})

/** A two-staff score whose group carries a `bracket` — the half a user authors. */
const bracketed = {
  id: 's', title: '', measures: [],
  staves: [{ id: 'a' }, { id: 'b' }],
  staffGroups: [{ id: 'g1', staffIds: ['a', 'b'], symbol: 'bracket' }],
} as unknown as Score

describe('the BRACKET — ⭐ the rod; its serifs are the browser suite’s', () => {
  /** The rod is the rect that is NOT the connector: it is the one in the sign group. */
  const rod = (rects: Rect[]) => rects.find(r => r.group === 'systemsign')

  it('⭐⭐ stands its own group — ⛔ NOT `stavebarline`, which `hintBarlines` would pixel-snap', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    expect(rects).toHaveLength(2)
    expect(rects.map(r => r.group).sort()).toEqual(['stavebarline', 'systemsign'])
  })

  it('is 0.50 staff spaces thick — Gould p. 516 + Ross p. 155, = Bravura’s `bracketThickness`', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    expect(rod(rects)!.w).toBeCloseTo(BRACKET_DEPTH_SPACES * STAFF_SPACE_PX, 6)
  })

  it('⭐⭐ stands LEFT of the systemic barline, clear of it by the separation the room reserved', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const r = rod(rects)!
    // Its right edge is `SIGN_SEPARATION_SPACES` clear of the barline at x = 100.
    expect(100 - (r.x + r.w)).toBeCloseTo(SIGN_TO_BARLINE_SPACES * STAFF_SPACE_PX, 6)
    // ⭐ …and the INDENT reaches one separation further still — the air at the page margin, which
    //   is why the rod's left edge is NOT the indent (his report, *"almost touching the border"*).
    expect(scoreSystemStartIndentPx(bracketed) - (100 - r.x))
      .toBeCloseTo(SIGN_SEPARATION_SPACES * STAFF_SPACE_PX, 6)
  })

  it('⭐⭐ the rod spans the same staves the connector does, and PROJECTS past each outer line', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const connector = rects.find(r => r.group === 'stavebarline')!
    const project = BRACKET_ROD_PROJECTION_SPACES * STAFF_SPACE_PX
    // ⭐⭐ **The rod EXCEEDS the staff line before its wing caps it** — his correction, 2026-08-29:
    //    *"the problem is how much the LINE of the bracket exceeds the limit"*. Verovio's split,
    //    taken whole because it is the engine that builds this sign exactly as we do
    //    ({@link BRACKET_ROD_PROJECTION_SPACES}).
    expect(BRACKET_ROD_PROJECTION_SPACES).toBeGreaterThan(0)
    expect(rod(rects)!.y).toBeCloseTo(connector.y - project, 6)
    expect(rod(rects)!.h).toBeCloseTo(connector.h + 2 * project, 6)
  })

  it('⛔ a group with no symbol draws no rod — the gate, reaching all the way to the pen', () => {
    const { rects, pass } = recorder()
    const noSymbol = { ...bracketed, staffGroups: [{ id: 'g1', staffIds: ['a', 'b'] }] } as unknown as Score
    renderSystemStarts(pass, noSymbol, grandStaff, 2, null)
    expect(rects).toHaveLength(1)
    expect(rod(rects)).toBeUndefined()
  })

  it('⚠️ is culled with the system it belongs to', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, new Set(['m2-s0']))
    expect(rects).toHaveLength(0)
  })
})

describe('the bracket’s SERIFS — ⚠️ which glyph, at which origin; ⛔ never their ink', () => {
  it('⭐ stamps the SAME two glyphs the winged repeat already draws — `bracketTop` / `bracketBottom`', () => {
    const { stamps, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    // ⛔ Written as ESCAPES, `BarlineRenderer`'s rule: a private-use character is invisible in
    // every editor and diff, so the source has to say which one it is.
    expect(stamps.map(s => s.glyph)).toEqual(['\uE003', '\uE004']) // bracketTop, bracketBottom
  })

  it('⭐⭐ each springs from the ROD’S OWN CORNER — so the hook runs RIGHT, over the barline', () => {
    const { rects, stamps, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const rod = rects.find(r => r.group === 'systemsign')!
    expect(stamps[0].x).toBeCloseTo(rod.x, 6)
    expect(stamps[1].x).toBeCloseTo(rod.x, 6)
    // ⭐ …and HALF A STAFF LINE inside the rod's ends, so each wing overlaps its corner rather than
    //   perching on it — Verovio's `offset` ({@link BRACKET_SERIF_INSET_SPACES}).
    const inset = BRACKET_SERIF_INSET_SPACES * STAFF_SPACE_PX
    expect(stamps[0].y).toBeCloseTo(rod.y + inset, 6)
    expect(stamps[1].y).toBeCloseTo(rod.y + rod.h - inset, 6)
  })

  it('they belong to the sign’s group, not the barline’s', () => {
    const { stamps, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    expect(stamps.every(s => s.group === 'systemsign')).toBe(true)
  })
})
