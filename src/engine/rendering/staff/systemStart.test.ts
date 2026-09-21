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
import type { EngravedStave } from '../engraved/EngravedStave'
import { renderSystemStarts, type SystemStartPlacement } from './systemStart'
import { thinBarlinePx } from './barlineInk'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { STAVE_LINE_WIDTH_PX, staffLineInkBottomY, staffLineMidY } from '@/engine/engrave/staff/staffLines'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import {
  BRACKET_DEPTH_SPACES, SIGN_SEPARATION_SPACES, SIGN_TO_BARLINE_SPACES, scoreSystemStartIndentPx,
  BRACKET_SERIF_INSET_SPACES, BRACE_DEPTH_SPACES, signOutwardReachSpaces,
  BRACKET_ROD_PROJECTION_SPACES,
} from '@/engine/layout/systemStartColumn'
import type { RenderPass } from '../RenderPass'
import type { Score } from '@/types/music'

/**
 * ⭐⭐ **THE TWO SPANS THIS FILE MEASURES AGAINST, and they are deliberately different.**
 *
 * The `grandStaff` fixture below puts staff 0's top line at y = 0 and staff 1's bottom line at
 * 200 + 4 × 10 = 240. From those two lines, two marks reach two different distances:
 *
 * - the **STAFF span** — outer edge to outer edge — is where a mark FLUSH with the staff stops: the
 *   brace, and the bracket's rod before its serifs project past it (Ross p. 155);
 * - the **BARLINE span** — line MIDDLE to line MIDDLE — is where the systemic connector stops, with
 *   every other barline in the score (`engrave/staff/barlineExtent`).
 *
 * ⚠️ They differ by half a staff line at each end, and ⛔ that is a rule rather than a rounding: it
 * is the same split LilyPond makes between `System_start_delimiter` (the staff symbol's own extent)
 * and `ly:bar-line::calc-bar-extent` (narrowed by half a line). 🚨 These specs used to measure the
 * brace and the bracket against the CONNECTOR's rect, which worked only while the two agreed.
 */
const SPAN_TOP = 0
const SPAN_BOTTOM = staffLineInkBottomY(240, STAVE_LINE_WIDTH_PX)
const BAR_TOP = staffLineMidY(0, STAVE_LINE_WIDTH_PX)
const BAR_BOTTOM = staffLineMidY(240, STAVE_LINE_WIDTH_PX)

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
  const groups: { cls: string; transform: string | null }[] = []
  const context = {
    openGroup: (cls: string) => {
      open.push(cls)
      const g = { cls, transform: null as string | null }
      groups.push(g)
      return { setAttribute: (k: string, v: string) => { if (k === 'transform') g.transform = v } }
    },
    closeGroup: () => { open.pop() },
    fillRect: (x: number, y: number, w: number, h: number) =>
      { rects.push({ x, y, w, h, group: open[open.length - 1] }) },
    // What `Element.renderText` needs of a context, and no more.
    setFont: () => undefined,
    fillText: (glyph: string, x: number, y: number) =>
      { stamps.push({ glyph, x, y, group: open[open.length - 1] }) },
  }
  // ⭐ The pen also FILES the sign's hit-box (`registerSignBox`) — recorded here so the spec can
  //   assert it, and because without a registry the pass would throw.
  const boxes: { type: string; id?: string; bbox: { x: number; y: number; width: number; height: number } }[] = []
  const elementRegistry = { add: (el: typeof boxes[number]) => { boxes.push(el) } }
  return { rects, stamps, groups, boxes, pass: { context, elementRegistry } as unknown as RenderPass }
}

/**
 * A stave whose line `n` sits at `top + n * 10`. Five lines, so line 4 is the bottom one —
 * the numbers `getYForLine` would return, with no font in the answer.
 */
function stave(top: number, numLines = 5): EngravedStave {
  return {
    getYForLine: (line: number) => top + line * 10,
    getSpacingBetweenLines: () => 10,
    getNumLines: () => numLines,
  } as unknown as EngravedStave
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
    // ⭐ A BARLINE's extent: the MIDDLE of staff 0's top line to the MIDDLE of staff 1's bottom one,
    //   so exactly the 240 between those two lines — ⛔ not the 241 the staff's outer edges span.
    expect(rects[0].y).toBeCloseTo(BAR_TOP, 10)
    expect(rects[0].h).toBeCloseTo(BAR_BOTTOM - BAR_TOP, 10)
    expect(rects[0].h, 'four staff spaces per staff, plus the gap between them').toBeCloseTo(240, 10)
  })

  it('⭐ takes x from the PLACEMENT, and the barline’s own weight — ⛔ never a scaled stave’s word', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [at(1, 0, 0, { x: 73.5 }), at(1, 1, 200, { x: 73.5 })], 2, null)
    expect(rects[0].x).toBe(73.5)
    expect(rects[0].w).toBe(thinBarlinePx())
  })

  it('⭐⭐ composes EACH END through its OWN staff’s scale — the reason this cannot sit in `inStaffSpace`', () => {
    const { rects, pass } = recorder()
    renderSystemStarts(pass, noSigns, [
      at(1, 0, 100, { scale: 1 }),      // full size: top line at 100
      at(1, 1, 300, { scale: 0.5 }),    // a SMALL staff: its bottom line's middle at 340.55 × 0.5
    ], 2, null)
    const top = staffLineMidY(100, STAVE_LINE_WIDTH_PX)
    expect(rects[0].y).toBeCloseTo(top, 10)
    expect(rects[0].h).toBeCloseTo(staffLineMidY(340, STAVE_LINE_WIDTH_PX) * 0.5 - top, 6)
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
    const project = BRACKET_ROD_PROJECTION_SPACES * STAFF_SPACE_PX
    // ⭐⭐ **The rod EXCEEDS the staff line before its wing caps it** — his correction, 2026-08-29:
    //    *"the problem is how much the LINE of the bracket exceeds the limit"*. Verovio's split,
    //    taken whole because it is the engine that builds this sign exactly as we do
    //    ({@link BRACKET_ROD_PROJECTION_SPACES}).
    expect(BRACKET_ROD_PROJECTION_SPACES).toBeGreaterThan(0)
    // ⚠️ Past the STAFF's outer lines, ⛔ not past the connector: a barline stops half a line short
    //   of them (see SPAN_TOP / BAR_TOP above), so the connector is the wrong ruler for this.
    expect(rod(rects)!.y).toBeCloseTo(SPAN_TOP - project, 6)
    expect(rod(rects)!.h).toBeCloseTo((SPAN_BOTTOM - SPAN_TOP) + 2 * project, 6)
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

/** A two-staff score whose group carries a `brace`. */
const braced = {
  id: 's', title: '', measures: [],
  staves: [{ id: 'a' }, { id: 'b' }],
  staffGroups: [{ id: 'g1', staffIds: ['a', 'b'], symbol: 'brace' }],
} as unknown as Score

describe('the BRACE — ⭐⭐ one glyph, stretched in y ALONE', () => {
  const braceGroup = (gs: { cls: string; transform: string | null }[]) =>
    gs.find(g => g.cls === 'systemsign')!

  /**
   * ⭐ **THE BRACE'S PLACEMENT, read out of the attribute** — `{ sx, sy, tx, ty }`.
   *
   * ⚠️ It arrives as `matrix(...)` since P1c (`docs/plans/own-engraving-engine.md`): the pass now writes an
   * {@link Affine} through `DrawGroup.setPlacement`, and a scale composed with a translate has no
   * shorthand form. ⛔ The engraving facts below are unchanged — the brace is still non-uniform, its
   * depth still constant, its foot still flush — only the notation they are written in moved, which
   * is why this reader exists rather than three edited regexes.
   */
  const placementOf = (gs: { cls: string; transform: string | null }[]) => {
    const attr = braceGroup(gs).transform ?? ''
    const m = /matrix\(([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+)\)/.exec(attr)
    expect(m, `a placement was written — got ${attr}`).not.toBeNull()
    const n = m!.slice(1).map(Number)
    return { sx: n[0], sy: n[3], tx: n[4], ty: n[5] }
  }

  it('stamps `braceLarge` (U+F401), ⛔ and draws no rod — a brace is one glyph, not a rule and two tips', () => {
    const { rects, stamps, pass } = recorder()
    renderSystemStarts(pass, braced, grandStaff, 2, null)
    // ⭐⭐ The VARIANT is measured, ⛔ not chosen: `braceLarge` matches Gould p. 331's engraved
    //    stroke profile best of the five (mean error 0.026 sp against `brace`'s 0.034), and it takes
    //    the cusp from 35% over her weight to 10%. See the drawBrace glyph constant for the ladder.
    expect(stamps.map(s => s.glyph)).toEqual(['\uF401'])
    // Only the connector's rect — the brace contributes none.
    expect(rects.map(r => r.group)).toEqual(['stavebarline'])
  })

  it('⭐⭐ its transform is NON-UNIFORM — the thing nothing else in this renderer draws', () => {
    const { groups, pass } = recorder()
    renderSystemStarts(pass, braced, grandStaff, 2, null)
    const { sx, sy } = placementOf(groups)
    expect(sx).not.toBeCloseTo(sy, 3)
    expect(sy, 'stretched MORE vertically than horizontally').toBeGreaterThan(sx)
  })

  it('⭐⭐ THE DEPTH IS CONSTANT — ⛔ it does NOT widen with the span (Gould p. 331, measured)', () => {
    const box = glyphBox('braceLarge')
    const depthOf = (placements: SystemStartPlacement[], staffCount: number) => {
      const { groups, pass } = recorder()
      const score = {
        ...braced,
        staves: Array.from({ length: staffCount }, (_, i) => ({ id: `s${i}` })),
        staffGroups: [{ id: 'g1', staffIds: Array.from({ length: staffCount }, (_, i) => `s${i}`), symbol: 'brace' }],
      } as unknown as Score
      renderSystemStarts(pass, score, placements, staffCount, null)
      return placementOf(groups).sx * (box.right - box.left)
    }
    // Two staves, then four — a span more than twice as tall.
    const two = depthOf(grandStaff, 2)
    const four = depthOf([at(1, 0, 0), at(1, 1, 200), at(1, 2, 400), at(1, 3, 600)], 4)
    expect(two).toBeCloseTo(BRACE_DEPTH_SPACES, 6)
    expect(four, '🚨 SMuFL says scale proportionally; her engraving does not').toBeCloseTo(two, 6)
  })

  it('⭐ FLUSH — line to line, ⛔ no overshoot (Ross p. 155, and both engines agree)', () => {
    const { groups, rects, pass } = recorder()
    renderSystemStarts(pass, braced, grandStaff, 2, null)
    // The group is translated to the ink's BOTTOM — the STAFF's own outer edge. ⛔ Not the
    // connector's, which stops half a staff line higher because it is a barline.
    expect(placementOf(groups).ty).toBeCloseTo(SPAN_BOTTOM, 6)
    expect(rects.find(r => r.group === 'stavebarline')!.y + rects.find(r => r.group === 'stavebarline')!.h,
      'and the connector really is the shorter of the two').toBeLessThan(SPAN_BOTTOM)
  })
})

describe('the sign’s HIT-BOX — 🚨 registered from the PEN, in SVG space', () => {
  it('⭐⭐ files a box carrying the GROUP’s id, so a press can name the group', () => {
    const { boxes, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const box = boxes.find(b => b.type === 'staffGroupSign')
    expect(box, 'a grouping sign registers a hit-box').toBeDefined()
    expect(box!.id).toBe('g1')
  })

  it('⭐⭐ covers the sign’s INK, ⛔ not just its span — his report about the squares', () => {
    // *"in the brace the squares are good in position, but in the brackets the squares vertically
    //  are too close."* A bracket's serifs reach ~1.5 sp past each staff line; a box that stopped at
    //  the line put the handle inside the ink and left the serif unclickable.
    const { boxes, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const box = boxes.find(b => b.type === 'staffGroupSign')!
    const reach = signOutwardReachSpaces('bracket') * STAFF_SPACE_PX
    expect(reach, 'a bracket reaches past the staff line').toBeGreaterThan(0)
    expect(box.bbox.y).toBeCloseTo(SPAN_TOP - reach, 6)
    expect(box.bbox.height).toBeCloseTo((SPAN_BOTTOM - SPAN_TOP) + 2 * reach, 6)
  })

  it('⭐ …and a BRACE, being flush, reaches nothing — which is why only the bracket looked wrong', () => {
    const { boxes, pass } = recorder()
    renderSystemStarts(pass, braced, grandStaff, 2, null)
    const box = boxes.find(b => b.type === 'staffGroupSign')!
    expect(signOutwardReachSpaces('brace')).toBe(0)
    expect(box.bbox.y).toBeCloseTo(SPAN_TOP, 6)
  })

  it('⚠️ is WIDER than the ink — a 0.89 sp hairline would be unclickable', () => {
    const { boxes, rects, pass } = recorder()
    renderSystemStarts(pass, bracketed, grandStaff, 2, null)
    const box = boxes.find(b => b.type === 'staffGroupSign')!
    const rod = rects.find(r => r.group === 'systemsign')!
    expect(box.bbox.width).toBeGreaterThan(rod.w)
    // ⭐ Its own depth plus the clearance it keeps from the barline — dead space nothing else claims.
    expect(box.bbox.width).toBeCloseTo((BRACKET_DEPTH_SPACES + SIGN_TO_BARLINE_SPACES) * STAFF_SPACE_PX, 6)
  })

  it('⛔ no sign, no box — the `symbol` gate reaches the registry too', () => {
    const { boxes, pass } = recorder()
    renderSystemStarts(pass, noSigns, grandStaff, 2, null)
    expect(boxes.filter(b => b.type === 'staffGroupSign')).toHaveLength(0)
  })
})
