import { describe, it, expect } from 'vitest'
import { walkSigns, type WalkSign } from './signWalk'
import { BARLINE_ROWS, type BarlineKind } from './barlineMetrics'

/**
 * ⭐ The walk is VexFlow's `Stave.format()` transcribed (S4b1 of `docs/history/vexflow-removal-map.md`), so each
 * expectation below is that arithmetic done by hand on round numbers: a 200 px bar at x 0, a clef 30
 * wide, a meter 20 wide.
 */
const barline = (kind: BarlineKind): WalkSign => {
  const row = BARLINE_ROWS[kind]
  return { kind: 'barline', barline: kind, padding: row.padding, width: row.width, layout: row.layout }
}
const clef = (width = 30): WalkSign => ({ kind: 'clef', padding: 10, width })
const meter = (width = 20): WalkSign => ({ kind: 'meter', padding: 15, width })

describe('walkSigns — where a bar\'s signs stand', () => {
  it('opens with the barline ON the boundary, the clef after its width, the meter after the clef and its padding', () => {
    const walk = walkSigns(0, 200, [barline('single'), clef(), meter()], [barline('none')])
    expect(walk.opening).toEqual([0, 5, 50])
    expect(walk.noteStartX).toBe(70)
  })

  it('⭐ a mid-line clef change stands 5 px (0.5 sp) after the boundary — the barline\'s own width', () => {
    const walk = walkSigns(100, 200, [barline('none'), clef(20)], [barline('none')])
    expect(walk.opening[1]).toBe(105)
  })

  it('a bar that closes on its barline alone ends its notes at its edge', () => {
    const walk = walkSigns(0, 200, [barline('none')], [barline('none')])
    expect(walk.closing).toEqual([200])
    expect(walk.noteEndX).toBe(200)
  })

  it('a cautionary clef stands inside the edge, and the notes end before it', () => {
    const walk = walkSigns(0, 200, [barline('none')], [barline('none'), clef(20)])
    expect(walk.closing).toEqual([200, 175])
    expect(walk.noteEndX).toBe(175)
  })

  it('⭐ a cautionary meter sorts OUTSIDE the barline, and the walk starts from an invented one', () => {
    const walk = walkSigns(0, 200, [barline('none')], [barline('none'), meter()])
    expect(walk.closing).toEqual([170, 175])
    expect(walk.noteEndX).toBe(170)
  })

  it('signs are walked in kind order whatever order they were added in, and answered in the order given', () => {
    const walk = walkSigns(0, 200, [barline('single'), meter(), clef()], [barline('none')])
    expect(walk.opening).toEqual([0, 50, 5])
  })

  it('🚨 a sign with no width and no padding does not use up a padding place — so in jsdom the meter gets none', () => {
    // VexFlow's `offset--`: the clef measures 0 there, so the meter is walked as if it were second.
    const walk = walkSigns(0, 200, [barline('single'), clef(0), meter(0)], [barline('none')])
    expect(walk.opening).toEqual([0, 5, 5])
  })
})
