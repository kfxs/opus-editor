/**
 * WHAT the signs at a system's left edge take, and what the music is left with.
 *
 * Subject: {@link systemStartColumn}, {@link scoreSystemStartIndentSpaces}, {@link musicSurface}.
 * ⭐ Pure arithmetic in staff spaces — no drawing, so nothing here is jsdom-shy. The three facts
 * worth pinning: **no signs indents by ZERO** (what keeps every score in the repo where it is), the
 * indent is **the sum of what the signs take** (there is no constant to copy), and the music's
 * surface loses on the LEFT exactly what it gains in margin — ⛔ never into the paper.
 */
import { describe, it, expect } from 'vitest'
import {
  systemStartColumn, scoreSystemStartIndentSpaces, scoreSystemStartIndentPx, musicSurface,
  BRACE_DEPTH_SPACES, BRACKET_DEPTH_SPACES, SIGN_SEPARATION_SPACES, SIGN_TO_BARLINE_SPACES,
  SUB_BRACKET_WIDTH_SPACES, SUB_BRACKET_STROKE_SPACES,
} from './systemStartColumn'
import { groupsAt } from '@/engine/models/staffGroups'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { SurfaceMetrics } from './surface'
import type { Score, StaffGroup } from '@/types/music'
import { ENGRAVING_DEFAULTS } from '@/engine/fonts/bravuraMetrics'

const sign = (symbol: 'brace' | 'bracket' | 'subBracket', top = 0, bottom = 1) =>
  ({ group: { id: `g${top}-${bottom}`, staffIds: [] }, symbol, topStaffIndex: top, bottomStaffIndex: bottom })

const score = (staffCount: number, groups?: StaffGroup[], bars = 1): Score => ({
  id: 's', title: '',
  measures: Array.from({ length: bars }, (_, i) => ({ number: i + 1 })),
  staves: Array.from({ length: staffCount }, (_, i) => ({ id: `st${i}` })),
  ...(groups ? { staffGroups: groups } : {}),
}) as unknown as Score

describe('one sign', () => {
  it('⭐⭐ NO signs indents by ZERO — the case every score in the repo is in', () => {
    expect(systemStartColumn([])).toEqual({ signs: [], indentSpaces: 0 })
  })

  it('a brace stands its own depth beyond the separation from the systemic barline', () => {
    const { signs, indentSpaces } = systemStartColumn([sign('brace')])
    expect(signs[0].depthSpaces).toBe(BRACE_DEPTH_SPACES)
    expect(signs[0].leftSpaces).toBeCloseTo(SIGN_TO_BARLINE_SPACES + BRACE_DEPTH_SPACES, 10)
    // ⭐ The INDENT is one separation MORE than the sign's own reach — the air at the margin.
    expect(indentSpaces).toBeCloseTo(signs[0].leftSpaces + SIGN_SEPARATION_SPACES, 10)
  })

  it('⭐ a bracket takes only its ROD — its serifs hook RIGHT, over the barline, and cost nothing here', () => {
    const { indentSpaces } = systemStartColumn([sign('bracket')])
    expect(BRACKET_DEPTH_SPACES).toBe(0.5) // Gould p. 516 + Ross p. 155, = Bravura's bracketThickness
    expect(indentSpaces).toBeCloseTo(SIGN_TO_BARLINE_SPACES + 0.5 + SIGN_SEPARATION_SPACES, 10)
  })
})

describe('nested signs — ⭐⭐ THE SMALLER GROUP GOES FURTHER LEFT', () => {
  // research §3.2, measured in Gould p. 509/518, Ross pp. 155–6, Stone p. 6, and stated outright by
  // LilyPond: *"a piano context included within a staff group should cause the piano brace to be
  // drawn to the LEFT of the staff angle bracket"*. ⛔ MuseScore is the odd one out.
  //     [innermost sign] [outer sign] [section bracket] [systemic barline = the staves]

  it('⭐⭐ the WIDEST group takes the place next to the staves, the narrowest goes outermost', () => {
    // Handed innermost-first, as `groupsAt` promises: a 2-staff brace inside a 4-staff bracket.
    const { signs } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3)])
    const [brace, bracket] = signs
    expect(bracket.leftSpaces, 'the wider group is nearer the staves')
      .toBeLessThan(brace.leftSpaces)
    // The bracket clears the barline by the measured distance; the brace clears the bracket.
    expect(bracket.leftSpaces).toBeCloseTo(SIGN_TO_BARLINE_SPACES + BRACKET_DEPTH_SPACES, 10)
    expect(brace.leftSpaces).toBeCloseTo(
      bracket.leftSpaces + SIGN_SEPARATION_SPACES + BRACE_DEPTH_SPACES, 10)
  })

  it('the indent is still the SUM of every depth plus every gap', () => {
    const { signs, indentSpaces } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3)])
    const outermost = Math.max(...signs.map(s => s.leftSpaces))
    expect(indentSpaces).toBeCloseTo(outermost + SIGN_SEPARATION_SPACES, 10)
  })

  it('⭐ no sign’s ink overlaps its neighbour’s — right edge to left edge is the separation', () => {
    const { signs } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3), sign('bracket', 0, 5)])
    const byPosition = [...signs].sort((a, b) => a.leftSpaces - b.leftSpaces)
    for (let i = 1; i < byPosition.length; i++) {
      const innerLeft = byPosition[i - 1].leftSpaces
      const outerRight = byPosition[i].leftSpaces - byPosition[i].depthSpaces
      expect(outerRight - innerLeft).toBeCloseTo(SIGN_SEPARATION_SPACES, 10)
    }
  })

  it('⭐ `signs` comes back in the order it was HANDED IN — only the positions run outward-in', () => {
    const { signs } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3)])
    expect(signs.map(s => s.depthSpaces)).toEqual([BRACE_DEPTH_SPACES, BRACKET_DEPTH_SPACES])
  })
})

describe('the score’s indent', () => {
  it('🚨 zero for a score whose group has NO symbol — the auto-writer must move nothing', () => {
    expect(scoreSystemStartIndentSpaces(score(2, [{ id: 'g', staffIds: ['st0', 'st1'] }], 8))).toBe(0)
  })

  it('zero for a score with no groups at all', () => {
    expect(scoreSystemStartIndentSpaces(score(2, undefined, 8))).toBe(0)
  })

  it('⭐⭐ a ONE-STAFF score with a sign DOES indent — his report, 2026-08-29', () => {
    // Gould p. 516: a score system of only one stave takes a square bracket. ⛔ This asserted zero
    // until then, on a `< 2` guard of mine rather than a source's.
    expect(scoreSystemStartIndentSpaces(score(1, [{ id: 'g', staffIds: ['st0'], symbol: 'bracket' }])))
      .toBeGreaterThan(0)
  })

  it('the braced grand staff’s indent, in spaces and in pixels', () => {
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'brace' }], 8)
    const expected = SIGN_TO_BARLINE_SPACES + BRACE_DEPTH_SPACES + SIGN_SEPARATION_SPACES
    expect(scoreSystemStartIndentSpaces(s)).toBeCloseTo(expected, 10)
    expect(scoreSystemStartIndentPx(s)).toBeCloseTo(expected * STAFF_SPACE_PX, 10)
  })

  it('⭐ answers even with NO measures — the bar-less call is the seed, not a special case', () => {
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'brace' }], 0)
    expect(scoreSystemStartIndentSpaces(s))
      .toBeCloseTo(SIGN_TO_BARLINE_SPACES + SIGN_SEPARATION_SPACES + BRACE_DEPTH_SPACES, 10)
  })

  it('⭐⭐ it is the MAXIMUM over bars — asked of every bar, because per-system would be CIRCULAR', () => {
    // Today `groupsAt` answers the same at every bar, so the max is that answer — the point is that
    // the loop exists at all, so a measure range later changes nothing here.
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'brace' }], 40)
    const perBar = s.measures.map(m => systemStartColumn(groupsAt(s, m.number)).indentSpaces)
    expect(scoreSystemStartIndentSpaces(s)).toBeCloseTo(Math.max(...perBar), 10)
  })
})

describe('the air at the MARGIN — 🚨 his report, *"almost touching the border"*', () => {
  it('⭐⭐ the outermost sign stands as clear of the margin as every sign does of its neighbour', () => {
    const { signs, indentSpaces } = systemStartColumn([sign('bracket')])
    // The indent is where the STAVES start; the sign's own left edge is `leftSpaces` from them. What
    // is left over is the air before the page margin — ⛔ it was 0.00 sp, measured, before this.
    expect(indentSpaces - signs[0].leftSpaces).toBeCloseTo(SIGN_SEPARATION_SPACES, 10)
  })

  it('⛔ …and NO signs still indents by exactly zero — no air where there is nothing to clear', () => {
    expect(systemStartColumn([]).indentSpaces).toBe(0)
  })
})

describe('the MUSIC’s surface — ⛔ not the page’s', () => {
  const page: SurfaceMetrics = {
    widthPx: 1000, heightPx: 1400, marginLeftPx: 40, marginRightPx: 40,
    marginTopPx: 40, marginBottomPx: 40, contentWidthPx: 920,
  } as unknown as SurfaceMetrics

  it('⭐ a score with no sign gets the SAME OBJECT back — byte-identical, nothing to compare', () => {
    expect(musicSurface(page, score(2, undefined, 4))).toBe(page)
  })

  it('⭐⭐ the margin gains exactly what the content width loses — ⛔ never into the paper', () => {
    const s = score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'brace' }], 4)
    const music = musicSurface(page, s)
    const indent = scoreSystemStartIndentPx(s)
    expect(music.marginLeftPx).toBeCloseTo(40 + indent, 10)
    expect(music.contentWidthPx).toBeCloseTo(920 - indent, 10)
    // The right edge does not move: left margin + content + right margin still spans the page.
    expect(music.marginLeftPx + music.contentWidthPx + music.marginRightPx).toBeCloseTo(page.widthPx, 10)
  })

  it('⛔ the PAGE’s own numbers are untouched — the paper does not shrink', () => {
    const music = musicSurface(page, score(2, [{ id: 'g', staffIds: ['st0', 'st1'], symbol: 'bracket' }]))
    expect(music.widthPx).toBe(page.widthPx)
    expect(music.heightPx).toBe(page.heightPx)
    expect(music.marginRightPx).toBe(page.marginRightPx)
    expect(page.contentWidthPx).toBe(920) // ⚠️ and the input was not mutated
  })
})

describe('the SUB-BRACKET — ⭐ P6, a hairline `[`', () => {
  it('takes its own measured WIDTH, ⛔ not the bracket’s rod thickness', () => {
    const { signs } = systemStartColumn([sign('subBracket')])
    expect(signs[0].depthSpaces).toBeCloseTo(SUB_BRACKET_WIDTH_SPACES, 10)
    expect(SUB_BRACKET_WIDTH_SPACES, 'Gould, measured — research §3.3').toBe(0.60)
  })

  it('🚨 its stroke is 0.10 sp — Gould + all three engines, ⛔ NOT Bravura’s 0.16', () => {
    expect(SUB_BRACKET_STROKE_SPACES).toBe(0.10)
    // Bravura's own default disagrees, and four drawings outvote it. Pinned so a later "read it
    // from the font" refactor has to argue with this line rather than silently win.
    expect(ENGRAVING_DEFAULTS.subBracketThickness, 'the font says otherwise').toBe(0.16)
  })

  it('🚨 nests OUTSIDE its own section bracket — the smaller group goes further left', () => {
    // ⛔ This drew INSIDE the bracket until 2026-08-29: `systemStartColumn` walked innermost-first
    //    and placed the first sign nearest the staves. Invisible until two signs could coexist, and
    //    a three-staff render showed it at once.
    const { signs } = systemStartColumn([sign('subBracket', 1, 2), sign('bracket', 0, 5)])
    const [sub, bracket] = signs
    expect(sub.depthSpaces).toBe(SUB_BRACKET_WIDTH_SPACES)
    expect(sub.leftSpaces, 'the divisi sign stands OUTSIDE the section bracket')
      .toBeGreaterThan(bracket.leftSpaces)
  })
})

describe('⭐⭐ the stacking is a SKYLINE — 🚨 his report, 2026-08-29', () => {
  // *"The brace somehow is displacing the position of the bracket but there is no reason for this…
  //  both are independent, applied to independent groups."* ⛔ The walk used to give every sign its
  //  own column. §2.2 named the fix before it was built: LilyPond stacks by SKYLINE
  //  (`side-position-interface.cc`), so **vertically disjoint signs can share an x**.

  it('two signs on DISJOINT staves sit at the SAME distance from the barline', () => {
    // ⚠️ Their RIGHT edges, not their left: `leftSpaces` is the sign's own left edge, and a brace is
    //    deeper than a bracket — so two signs standing against the same barline differ on the left.
    const { signs } = systemStartColumn([sign('bracket', 0, 0), sign('brace', 1, 1)])
    const rightEdge = (s: { leftSpaces: number; depthSpaces: number }) => s.leftSpaces - s.depthSpaces
    expect(rightEdge(signs[0])).toBeCloseTo(rightEdge(signs[1]), 10)
    expect(rightEdge(signs[0])).toBeCloseTo(SIGN_TO_BARLINE_SPACES, 10)
  })

  it('…and neither is pushed out — each clears only the BARLINE', () => {
    const { signs } = systemStartColumn([sign('bracket', 0, 0), sign('brace', 1, 1)])
    const bracket = signs.find(s => s.depthSpaces === BRACKET_DEPTH_SPACES)!
    expect(bracket.leftSpaces).toBeCloseTo(SIGN_TO_BARLINE_SPACES + BRACKET_DEPTH_SPACES, 10)
  })

  it('⭐ but OVERLAPPING signs still stack — the nesting rule is untouched', () => {
    const { signs } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3)])
    expect(signs[0].leftSpaces).toBeGreaterThan(signs[1].leftSpaces)
  })

  it('⭐ a sign overlapping ONE of two disjoint neighbours clears only that one', () => {
    // brackets on staves 0 and 3 share nothing; a brace over 0–1 must clear the first, not the second.
    const { signs } = systemStartColumn([
      sign('brace', 0, 1), sign('bracket', 0, 0), sign('bracket', 3, 3),
    ])
    const [brace, first, far] = signs
    expect(first.leftSpaces).toBeCloseTo(far.leftSpaces, 10) // the disjoint pair share an x
    expect(brace.leftSpaces).toBeGreaterThan(first.leftSpaces)
  })

  it('the INDENT is the widest reach of any sign, ⛔ not the last one placed', () => {
    const { signs, indentSpaces } = systemStartColumn([
      sign('brace', 0, 1), sign('bracket', 0, 3), sign('bracket', 5, 5),
    ])
    expect(indentSpaces).toBeCloseTo(
      Math.max(...signs.map(s => s.leftSpaces)) + SIGN_SEPARATION_SPACES, 10)
  })
})
