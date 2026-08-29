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
} from './systemStartColumn'
import { groupsAt } from '@/engine/models/staffGroups'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { SurfaceMetrics } from './surface'
import type { Score, StaffGroup } from '@/types/music'

const sign = (symbol: 'brace' | 'bracket', top = 0, bottom = 1) =>
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

describe('nested signs — ⭐⭐ the indent is the SUM of what they take', () => {
  it('the second sign clears the first, and the total is every depth plus every gap', () => {
    const { signs, indentSpaces } = systemStartColumn([sign('brace', 0, 1), sign('bracket', 0, 3)])
    // innermost brace, then the bracket outside it
    expect(signs[0].leftSpaces).toBeCloseTo(SIGN_TO_BARLINE_SPACES + BRACE_DEPTH_SPACES, 10)
    expect(signs[1].leftSpaces).toBeCloseTo(
      SIGN_TO_BARLINE_SPACES + BRACE_DEPTH_SPACES + SIGN_SEPARATION_SPACES + BRACKET_DEPTH_SPACES, 10)
    expect(indentSpaces).toBeCloseTo(signs[1].leftSpaces + SIGN_SEPARATION_SPACES, 10)
  })

  it('⭐ each sign’s ink never overlaps its neighbour’s — right edge to left edge is the separation', () => {
    const { signs } = systemStartColumn([sign('brace'), sign('bracket'), sign('bracket')])
    for (let i = 1; i < signs.length; i++) {
      const innerLeft = signs[i - 1].leftSpaces
      const outerRight = signs[i].leftSpaces - signs[i].depthSpaces
      expect(outerRight - innerLeft).toBeCloseTo(SIGN_SEPARATION_SPACES, 10)
    }
  })

  it('order is preserved — this module places what it is handed, ⛔ it does not re-sort', () => {
    const { signs } = systemStartColumn([sign('bracket', 0, 5), sign('brace', 0, 1)])
    expect(signs.map(s => s.depthSpaces)).toEqual([BRACKET_DEPTH_SPACES, BRACE_DEPTH_SPACES])
  })
})

describe('the score’s indent', () => {
  it('🚨 zero for a score whose group has NO symbol — the auto-writer must move nothing', () => {
    expect(scoreSystemStartIndentSpaces(score(2, [{ id: 'g', staffIds: ['st0', 'st1'] }], 8))).toBe(0)
  })

  it('zero for a score with no groups at all, and for a one-staff score', () => {
    expect(scoreSystemStartIndentSpaces(score(2, undefined, 8))).toBe(0)
    expect(scoreSystemStartIndentSpaces(score(1, [{ id: 'g', staffIds: ['st0'], symbol: 'brace' }]))).toBe(0)
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
