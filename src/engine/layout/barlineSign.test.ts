/**
 * **The sign a boundary carries, and what it is made of** — P2 of docs/barline-types-plan.md.
 *
 * ⭐ Everything here is arithmetic and precedence, which is exactly what a unit test can hold. ⛔ What
 * it cannot hold is where the ink LANDED: jsdom has no layout and no fonts, so a drawn position
 * measures zeros and agrees with itself. That half is `e2e/barlineTypes.e2e.ts`.
 */
import { describe, it, expect } from 'vitest'
import { barlineSignParts, barlineSignExtent, dotLines, signAtBoundary } from './barlineSign'
import type { Measure } from '@/types/music'

/** A bar carrying only the barline statements under test — nothing else here reads a measure. */
function bar(fields: Partial<Measure> = {}): Measure {
  return { id: 'm', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], ...fields }
}

const THIN = 0.16
const THICK = 0.5
const SEPARATION = 0.32
const DOT = 0.4
const DOT_SEPARATION = 0.16

describe('signAtBoundary — ⭐⭐ a boundary carries ONE sign', () => {
  it('a bar ends here and said nothing: the plain single line', () => {
    expect(signAtBoundary(bar(), bar())).toBe('plain')
  })

  it('nothing ends here: NO sign — a system\'s opening edge is the stave\'s own begin bar', () => {
    expect(signAtBoundary(undefined, bar())).toBeNull()
  })

  it('a final barline, when that is what the bar stores', () => {
    expect(signAtBoundary(bar({ barline: { style: 'final' } }), bar())).toBe('final')
  })

  it('an end repeat belongs to the bar that CLOSES it', () => {
    expect(signAtBoundary(bar({ repeatEnd: {} }), bar())).toBe('repeatEnd')
  })

  it('a start repeat belongs to the bar that OPENS it — and suppresses the line before it', () => {
    // 🚨 The whole reason this is a score-level pass: the left bar drew a plain line here until its
    // neighbour's field was consulted, and no per-measure render key can consult it.
    expect(signAtBoundary(bar(), bar({ repeatStart: {} }))).toBe('repeatStart')
  })

  it('⭐ back-to-back: two model facts, ONE combined drawing', () => {
    expect(signAtBoundary(bar({ repeatEnd: {} }), bar({ repeatStart: {} }))).toBe('repeatBoth')
  })

  it('⭐ a bar carrying BOTH a final style and an end repeat draws the repeat — it subsumes it', () => {
    // Gould p. 39: a repeat "uses the final double barline design together with repeat dots", so the
    // repeat IS the final bar plus something. Drawing both would be drawing the thin+thick twice.
    expect(signAtBoundary(bar({ barline: { style: 'final' }, repeatEnd: {} }), bar())).toBe('repeatEnd')
  })

  it('⚠️ the neighbour is passed as ABSENT when it is on another system — so nothing is suppressed', () => {
    // The caller drops a neighbour that is not on this system, which is how the system condition
    // stays local to this function. A repeat opening the NEXT line leaves this line's own last
    // barline standing, which is what all three engines do.
    expect(signAtBoundary(bar(), undefined)).toBe('plain')
    expect(signAtBoundary(bar({ repeatEnd: {} }), undefined)).toBe('repeatEnd')
  })
})

describe('barlineSignParts — the reading order IS the layout', () => {
  it('the plain line is the one sign whose ink is to the RIGHT of the boundary', () => {
    const parts = barlineSignParts('plain')
    expect(parts.strokes).toEqual([{ x: 0, width: THIN }])
    expect(parts.extent).toEqual({ left: 0, right: THIN })
    expect(parts.dots).toHaveLength(0)
  })

  it('⭐⭐ a final bar grows LEFT: thin, gap, THICK, with the thick line ending on the boundary', () => {
    const parts = barlineSignParts('final')
    const [thin, thick] = parts.strokes
    expect(thick).toEqual({ x: -THICK, width: THICK })
    expect(thick.x + thick.width).toBe(0)                       // the divider IS the boundary
    expect(thin.x + thin.width).toBeCloseTo(thick.x - SEPARATION, 10)
    expect(parts.strokes[parts.divider]).toBe(thick)
    expect(parts.extent.right).toBe(0)                          // ⛔ nothing past the staff lines' end
    expect(parts.extent.left).toBeCloseTo(THIN + SEPARATION + THICK, 10)
  })

  it('⭐ …and its total is Gould\'s measured ≈1.00, not the font\'s 1.06', () => {
    // Her engraved finals: thin 0.15–0.20 · gap 0.30–0.35 · thick 0.45–0.50. Bravura's own
    // `barlineFinal` glyph is 1.06 wide, which is SMuFL's 0.40 separation. Her drawing wins.
    expect(barlineSignExtent('final').left).toBeCloseTo(0.98, 10)
  })

  it('an end repeat is the final bar plus dots, all of it inside the bar it ends', () => {
    const parts = barlineSignParts('repeatEnd')
    const [thin, thick] = parts.strokes
    expect(thick).toEqual(barlineSignParts('final').strokes[1])
    expect(thin).toEqual(barlineSignParts('final').strokes[0])
    expect(parts.dots).toHaveLength(1)
    // The dots precede the thin line, separated from it by SMuFL's own dot separation.
    expect(parts.dots[0].x + parts.dots[0].width).toBeCloseTo(thin.x - DOT_SEPARATION, 10)
    expect(parts.extent.right).toBe(0)
  })

  it('⭐ a start repeat is that MIRRORED — all of it inside the bar it opens', () => {
    const parts = barlineSignParts('repeatStart')
    expect(parts.extent.left).toBe(0)
    expect(parts.strokes[parts.divider]).toEqual({ x: 0, width: THICK })
    expect(parts.extent.right).toBeCloseTo(barlineSignExtent('repeatEnd').left, 10)
  })

  it('⭐ …and the repeat\'s total corroborates on two independent sources', () => {
    // Ross p. 147's footnote decomposes it as "one and a half spaces"; Bravura's precomposed
    // `repeatLeft` glyph is 1.464 wide. Ours is the parts added up, and lands between them.
    const total = THICK + SEPARATION + THIN + DOT_SEPARATION + DOT
    expect(barlineSignExtent('repeatStart').right).toBeCloseTo(total, 10)
    expect(total).toBeGreaterThan(1.4)
    expect(total).toBeLessThan(1.6)
  })

  it('⭐⭐ back-to-back shares ONE thick line, centred on the boundary — never two whole signs', () => {
    const parts = barlineSignParts('repeatBoth')
    const thick = parts.strokes[parts.divider]
    expect(thick.width).toBe(THICK)
    expect(thick.x + thick.width / 2).toBeCloseTo(0, 10)        // centred, because it divides both
    expect(parts.strokes).toHaveLength(3)                       // thin · THICK · thin
    expect(parts.dots).toHaveLength(2)                          // one pair each side
    expect(parts.extent.left).toBeCloseTo(parts.extent.right, 10)
  })

  it('every sign\'s extent is derived from its own parts, so ink and reserved room cannot drift', () => {
    for (const kind of ['plain', 'final', 'repeatEnd', 'repeatStart', 'repeatBoth'] as const) {
      const parts = barlineSignParts(kind)
      const inkLeft = Math.max(0, ...parts.strokes.map(s => -s.x), ...parts.dots.map(d => -d.x))
      const inkRight = Math.max(0, ...parts.strokes.map(s => s.x + s.width), ...parts.dots.map(d => d.x + d.width))
      expect(parts.extent).toEqual({ left: inkLeft, right: inkRight })
    }
  })
})

describe('dotLines — ⭐⭐ the dots go in SPACES, on every staff', () => {
  it('five lines: the 2nd and 3rd spaces from the bottom', () => {
    // Gould p. 234 measures their centres at 1.48 / 2.48 above the bottom line and Bravura's
    // precomposed `repeatDots` agrees to 0.01 — which is lines 2.5 and 1.5 counted from the top.
    expect(dotLines(5)).toEqual([1.5, 2.5])
  })

  it('🚨 four lines: NOT the middle ± half a space, which would land them ON two lines', () => {
    // No middle LINE on an even staff — the middle is a space — so its neighbours are a whole space
    // out. These are MuseScore's numbers for the same staff.
    expect(dotLines(4)).toEqual([0.5, 2.5])
  })

  it('three lines, and one line: still two space centres straddling the middle', () => {
    expect(dotLines(3)).toEqual([0.5, 1.5])
    expect(dotLines(1)).toEqual([-0.5, 0.5])
  })

  it('every result is a SPACE centre — a half-integer line number — whatever the count', () => {
    for (let lines = 1; lines <= 8; lines++) {
      for (const line of dotLines(lines)) {
        expect(Math.abs(line % 1), `${lines}-line staff put a dot on a LINE at ${line}`).toBe(0.5)
      }
    }
  })
})
