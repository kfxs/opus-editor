/**
 * {@link glissandoPieces} — a glissando across a system break, in two pieces (docs/plans/glissando-plan.md
 * P2, G7a). SP = 10 px; system 1's staff top at y 100, system 2's at y 300.
 */
import { describe, it, expect } from 'vitest'
import { GLISSANDO_BREAK_RULES, GLISSANDO_END_RULES, GLISSANDO_SQUEEZE_RULES, glissandoPieces } from './glissandoLine'

const SP = 10
const edges = { fromTopY: 100, toTopY: 300, barlineX: 500, headerInkX: 60 }
// Rising: the source 4 spaces below system 1's top line, the target 1 space below system 2's.
const from = { y: 140, inkRightX: 400 }
const to = { y: 310, inkLeftX: 150 }
const gould = GLISSANDO_END_RULES.gould
const squeeze = GLISSANDO_SQUEEZE_RULES.shrinkGaps

describe('glissandoPieces — Gould (armed): EACH piece spans the whole interval', () => {
  const [a, b] = glissandoPieces(from, to, edges, SP, 1, gould, GLISSANDO_BREAK_RULES.gould, squeeze)

  it('the first piece stops 0.5 sp before the barline, rising to the TARGET\'s staff position', () => {
    expect(a!.x2).toBeCloseTo(500 - 0.5 * SP)
    expect(a!.y1).toBeCloseTo(140 - 0.25 * SP) // leaning toward the target, as on one system
    expect(a!.y2).toBeCloseTo(110 + 0.25 * SP) // 1 space below system 1's top, leaned back
  })

  it('the second starts 1 sp after the header, from the SOURCE\'s staff position, to the target', () => {
    expect(b!.x1).toBeCloseTo(60 + 1.0 * SP)
    expect(b!.y1).toBeCloseTo(340 - 0.25 * SP)
    expect(b!.x2).toBeCloseTo(150 - 0.3 * SP)
    expect(b!.y2).toBeCloseTo(310 + 0.25 * SP)
  })

  it('⭐ so the two slopes DIFFER (her rule: the gradient reflects the whole interval)', () => {
    const slope = (s: NonNullable<typeof a>) => (s.y2 - s.y1) / (s.x2 - s.x1)
    expect(slope(a!)).not.toBeCloseTo(slope(b!))
  })
})

describe('glissandoPieces — `continuous` (MuseScore, LilyPond): one line, cut at the break', () => {
  const [a, b] = glissandoPieces(from, to, edges, SP, 1, gould, GLISSANDO_BREAK_RULES.musescore, squeeze)

  it('both pieces lie on ONE slope, and together rise the interval once', () => {
    const slope = (s: NonNullable<typeof a>) => (s.y2 - s.y1) / (s.x2 - s.x1)
    expect(slope(a!)).toBeCloseTo(slope(b!))
    // Staff-relative: the first piece's end and the second's start are one line continued.
    const riseTotal = (a!.y1 - 100) - (b!.y2 - 300)
    const risePieces = (a!.y1 - a!.y2) + (b!.y1 - b!.y2)
    expect(risePieces).toBeLessThan(riseTotal)
  })

  it('cut 0.5 sp before the barline and resumed 1 sp after the header', () => {
    expect(a!.x2).toBeCloseTo(495)
    expect(b!.x1).toBeCloseTo(70)
  })
})

describe('glissandoPieces — no room', () => {
  it('a piece with no room on its system is null; the other still draws', () => {
    const [a, b] = glissandoPieces({ y: 140, inkRightX: 499 }, to, edges, SP, 1, gould,
      GLISSANDO_BREAK_RULES.gould, GLISSANDO_SQUEEZE_RULES.vanish)
    expect(a).toBeNull()
    expect(b).not.toBeNull()
  })
})
