import { describe, it, expect } from 'vitest'
import {
  noteLineY,
  staffBottomLineY,
  staffLineAtY,
  staffLineY,
  textRowAboveY,
  textRowBelowY,
  type StaffFrame,
} from './staffFrame'

/**
 * ⭐ The staff frame answers the questions a `Stave` used to — `getYForLine`, `getYForNote`,
 * `getYForTopText` — with the same numbering, so S2 of `docs/vexflow-removal-map.md` moved no pixel.
 * A stave at y = 40 with the default 4 spaces of headroom has its top line at 80.
 */
const frame: StaffFrame = { topLineY: 80, spacePx: 10, lineCount: 5 }

describe('the staff frame', () => {
  it('counts staff lines from the top line down, a space each, fractions between', () => {
    expect(staffLineY(frame, 0)).toBe(80)
    expect(staffLineY(frame, 4)).toBe(120)
    expect(staffLineY(frame, 2.5)).toBe(105)
    expect(staffBottomLineY(frame)).toBe(120)
  })

  it('the bottom line follows the line count', () => {
    expect(staffBottomLineY({ ...frame, lineCount: 1 })).toBe(80)
  })

  it('inverts a y into its staff line — the one owner of that sum (rule 5)', () => {
    expect(staffLineAtY(frame, 105)).toBe(2.5)
    expect(staffLineY(frame, staffLineAtY(frame, 93))).toBeCloseTo(93)
  })

  it('counts note lines from the bottom line of a five-line staff, which is 1', () => {
    expect(noteLineY(frame, 1)).toBe(120) // E4 in treble clef — the bottom line
    expect(noteLineY(frame, 5)).toBe(80) // F5 — the top line
    expect(noteLineY(frame, 0)).toBe(130) // C4's ledger line
  })

  it('puts text row 0 one space above the top line, each further row a space higher', () => {
    expect(textRowAboveY(frame, 0)).toBe(70)
    expect(textRowAboveY(frame, 1)).toBe(60)
  })

  it('puts text row 0 one space BELOW the bottom line (`Stave.getYForBottomText`), and follows the line count', () => {
    expect(textRowBelowY(frame, 0)).toBe(130)
    expect(textRowBelowY(frame, -0.5)).toBe(125) // an articulation's floor: half a space outside
    expect(textRowBelowY({ ...frame, lineCount: 1 }, 0)).toBe(90)
  })
})
