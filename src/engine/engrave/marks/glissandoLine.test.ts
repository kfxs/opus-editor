/**
 * {@link glissandoStroke} and the glissando's rule rows (docs/plans/glissando-plan.md §0.1, G12–G13).
 * Pure arithmetic — a staff space of 10 px keeps the numbers readable.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  GLISSANDO_END_RULES, GLISSANDO_SQUEEZE_RULES, armedGlissandoEndRule, setGlissandoAccidentalGap, glissandoSettings, glissandoStroke, glissandoThicknessSpaces, resetGlissandoRules,
  setGlissandoEndRule, setGlissandoThicknessRule, type GlissandoEndRuleName,
} from './glissandoLine'

const SP = 10
// A rising line: the source head's centre at y 40, the target's at y 10 (y grows DOWN).
const from = { y: 40, inkRightX: 100 }
const to = { y: 10, inkLeftX: 200 }

afterEach(() => resetGlissandoRules())

describe('glissandoStroke — Gould (armed)', () => {
  const gould = GLISSANDO_END_RULES.gould

  it('stands clear of both heads, measured across the page', () => {
    const s = glissandoStroke(from, to, SP, 1, gould)!
    expect(s.x1).toBeCloseTo(100 + 0.2 * SP)
    expect(s.x2).toBeCloseTo(200 - 0.3 * SP)
  })

  it('⭐ leans each end TOWARD the other note — steeper than the centres\' join', () => {
    const s = glissandoStroke(from, to, SP, 1, gould)!
    expect(s.y1).toBeCloseTo(40 - 0.25 * SP)
    expect(s.y2).toBeCloseTo(10 + 0.25 * SP)
    // …and a falling line leans the other way.
    const down = glissandoStroke({ y: 10, inkRightX: 100 }, { y: 40, inkLeftX: 200 }, SP, -1, gould)!
    expect(down.y1).toBeCloseTo(10 + 0.25 * SP)
    expect(down.y2).toBeCloseTo(40 - 0.25 * SP)
  })

  it('⛔ the two leans never cross — a step smaller than both is shared out', () => {
    const s = glissandoStroke({ y: 40, inkRightX: 100 }, { y: 37, inkLeftX: 200 }, SP, 1, gould)!
    expect(s.y1).toBeGreaterThanOrEqual(s.y2)
  })

  it('stops 0.8 sp short of a target ACCIDENTAL (her plate, measured), not of its head', () => {
    const s = glissandoStroke(from, { ...to, accidentalLeftX: 185 }, SP, 1, gould)!
    expect(s.x2).toBeCloseTo(185 - 0.8 * SP)
  })

  it('⭐ `truncate` (hers): cut short of the accidental, the line STILL AIMED AT THE HEAD — its angle unchanged', () => {
    const plain = glissandoStroke(from, to, SP, 1, gould)!
    const cut = glissandoStroke(from, { ...to, accidentalLeftX: 185 }, SP, 1, gould)!
    const slope = (s: typeof plain) => (s.y2 - s.y1) / (s.x2 - s.x1)
    expect(slope(cut)).toBeCloseTo(slope(plain))
    expect(cut.y2).toBeGreaterThan(plain.y2) // stopped lower down the same line, not at the head's height
  })

  it('`reangle` (LilyPond): it ends short of the accidental at the head\'s own height — a steeper line', () => {
    const r = { ...GLISSANDO_END_RULES.lilypond, gapMeasure: 'x' as const }
    const s2 = glissandoStroke(from, { ...to, accidentalLeftX: 185 }, SP, 1, r)!
    expect(s2.x2).toBeCloseTo(185 - 0.5 * SP)
    expect(s2.y2).toBeCloseTo(10)
  })

  it('⭐ squeezed (armed `shrinkGaps`): the gaps give way and the line keeps HALF the room', () => {
    const s = glissandoStroke(from, { y: 10, inkLeftX: 104 }, SP, 1, gould)!
    // 4 px of room; the gaps (2 + 3 px) shrink to fill the other half: ×2/5 → 0.8 and 1.2.
    expect(s.x1).toBeCloseTo(100.8)
    expect(s.x2).toBeCloseTo(102.8)
    expect(s.x2 - s.x1).toBeCloseTo(2)
  })

  it('`vanish` (P1\'s behaviour): no room for the gaps, no line', () => {
    expect(glissandoStroke(from, { y: 10, inkLeftX: 104 }, SP, 1, gould, GLISSANDO_SQUEEZE_RULES.vanish)).toBeNull()
  })

  it('a line with room to spare is untouched by the squeeze rule', () => {
    expect(glissandoStroke(from, to, SP, 1, gould)).toEqual(glissandoStroke(from, to, SP, 1, gould, GLISSANDO_SQUEEZE_RULES.vanish))
  })

  it('touching or overlapping inks: nothing to draw, whatever the rule', () => {
    expect(glissandoStroke(from, { y: 10, inkLeftX: 100 }, SP, 1, gould)).toBeNull()
  })
})

describe('glissandoStroke — the engines\' rows', () => {
  it('⭐ MuseScore AIMS through the head CENTRES and is cut back along that line (source-checked)', () => {
    const r = GLISSANDO_END_RULES.musescore
    const f = { ...from, centreX: 94 }
    const t = { ...to, centreX: 206 }
    const s2 = glissandoStroke(f, t, SP, 1, r)!
    const centreSlope = (10 - 40) / (206 - 94)
    expect((s2.y2 - s2.y1) / (s2.x2 - s2.x1)).toBeCloseTo(centreSlope)
    expect(s2.x1).toBeCloseTo(100 + 0.25 * SP)
    expect(s2.x2).toBeCloseTo(200 - 0.25 * SP)
  })

  it('MuseScore tilts two heads at one height ±0.25 sp', () => {
    const flat = glissandoStroke({ y: 30, inkRightX: 100 }, { y: 30, inkLeftX: 200 }, SP, 1, GLISSANDO_END_RULES.musescore)!
    expect(flat.y1).toBeGreaterThan(30) // F → F♯: starts LOWER, ends HIGHER
    expect(flat.y2).toBeLessThan(30)
  })

  it('⭐ Verovio SLIDES: stopped ¼ sp before the sign, then walked forward along the line while it clears', () => {
    const r = GLISSANDO_END_RULES.verovio
    // A rising line to a head whose sharp stands left of it and only reaches down to y 5.
    const t = { y: 10, inkLeftX: 200, centreX: 206, accidentalLeftX: 180, accidentalTopY: -10, accidentalBottomY: 5 }
    const f = { ...from, centreX: 94 }
    const stopped = glissandoStroke(f, t, SP, 1, { ...r, accidental: 'truncate' })!
    const slid = glissandoStroke(f, t, SP, 1, r)!
    expect(stopped.x2).toBeCloseTo(180 - 0.25 * SP)
    expect(slid.x2).toBeGreaterThan(stopped.x2)
    expect((slid.y2 - slid.y1) / (slid.x2 - slid.x1)).toBeCloseTo((stopped.y2 - stopped.y1) / (stopped.x2 - stopped.x1))
  })

  it.each(['verovio', 'lilypond'] as GlissandoEndRuleName[])('%s measures its 0.5 sp gaps ALONG the line', name => {
    const s = glissandoStroke(from, to, SP, 1, GLISSANDO_END_RULES[name])!
    const len = Math.hypot(100, 30)
    expect(Math.hypot(s.x1 - 100, s.y1 - 40)).toBeCloseTo(0.5 * SP)
    expect(Math.hypot(200 - s.x2, 10 - s.y2)).toBeCloseTo(0.5 * SP)
    expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(len - SP)
  })
})

describe('the armed rows', () => {
  it('ship HOUSE ends (his: Gould\'s angle, a shorter stop before an accidental) and Gould\'s thickness', () => {
    expect(glissandoSettings()).toMatchObject({ end: 'house', thickness: 'gould', squeeze: 'shrinkGaps' })
    const { house, gould: g } = GLISSANDO_END_RULES
    expect({ ...house, accidentalGap: 0, accidental: '', source: '' }).toEqual({ ...g, accidentalGap: 0, accidental: '', source: '' })
    expect(house.accidental).toBe('clear')
    expect(house.accidentalGap).toBeLessThan(g.accidentalGap)
  })

  it('Gould\'s thickness is a STAFF LINE\'s (≈0.11 sp under Bravura); the engines\' are numbers', () => {
    expect(glissandoThicknessSpaces()).toBeGreaterThan(0.1)
    expect(glissandoThicknessSpaces()).toBeLessThan(0.13)
    setGlissandoThicknessRule('musescore')
    expect(glissandoThicknessSpaces()).toBe(0.15)
  })

  it('a re-arm bumps the generation (the render key); ⛔ an unknown row is refused', () => {
    const g = glissandoSettings().generation
    expect(setGlissandoEndRule('musescore')).toBe(true)
    expect(glissandoSettings().generation).toBe(g + 1)
    expect(setGlissandoEndRule('nope' as GlissandoEndRuleName)).toBe(false)
    expect(glissandoSettings().end).toBe('musescore')
  })
})

describe('⭐ `clear` (house): the SAME space before an accidental at every angle — his report', () => {
  const house = GLISSANDO_END_RULES.house
  // A sharp standing left of a head at y 10: its box x 180…200, y −4…24 (≈1.4 sp either side).
  const target = { y: 10, inkLeftX: 200, accidentalLeftX: 180, accidentalTopY: -4, accidentalBottomY: 24 }
  const boxDistance = (x: number, y: number) =>
    Math.hypot(Math.max(180 - x, 0, x - 200), Math.max(-4 - y, 0, y - 24))

  it('a shallow line and a steep one both stop 0.3 sp from the sign\'s box', () => {
    const shallow = glissandoStroke({ y: 30, inkRightX: 100 }, target, SP, 1, house)!
    const steep = glissandoStroke({ y: 90, inkRightX: 100 }, target, SP, 1, house)!
    expect(boxDistance(shallow.x2, shallow.y2)).toBeCloseTo(0.3 * SP, 0)
    expect(boxDistance(steep.x2, steep.y2)).toBeCloseTo(0.3 * SP, 0)
  })

  it('…where `truncate` (Gould\'s x-measured stop) leaves the steep line further from the sign', () => {
    const cut = { ...house, accidental: 'truncate' as const }
    const shallow = glissandoStroke({ y: 30, inkRightX: 100 }, target, SP, 1, cut)!
    const steep = glissandoStroke({ y: 90, inkRightX: 100 }, target, SP, 1, cut)!
    expect(boxDistance(steep.x2, steep.y2)).toBeGreaterThan(boxDistance(shallow.x2, shallow.y2))
  })

  it('the line keeps its angle', () => {
    const cleared = glissandoStroke({ y: 90, inkRightX: 100 }, target, SP, 1, house)!
    const open = glissandoStroke({ y: 90, inkRightX: 100 }, { y: 10, inkLeftX: 200 }, SP, 1, house)!
    expect((cleared.y2 - cleared.y1) / (cleared.x2 - cleared.x1)).toBeCloseTo((open.y2 - open.y1) / (open.x2 - open.x1))
  })
})

describe('⭐⭐ `clear` against the REAL OUTLINE: the space AHEAD of the line, the same at every angle', () => {
  const house = GLISSANDO_END_RULES.house
  // A comb, like a sharp's left side (y DOWN): two teeth reaching left to x 180 at y 2…6 and y 14…18, the
  // body from x 184. Its head is at y 10, left edge 200.
  const comb: Array<Array<readonly [number, number]>> = [[
    [184, -4], [196, -4], [196, 24], [184, 24], [184, 18], [180, 18], [180, 14], [184, 14],
    [184, 6], [180, 6], [180, 2], [184, 2],
  ]]
  const target = { y: 10, inkLeftX: 200, accidentalLeftX: 180, accidentalTopY: -4, accidentalBottomY: 24, accidentalOutline: comb }
  /** How far the stroke, carried on, travels before it touches the comb. */
  const ahead = (s: { x1: number; y1: number; x2: number; y2: number }) => {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), ux = (s.x2 - s.x1) / L, uy = (s.y2 - s.y1) / L
    const inside = (x: number, y: number) => {
      let n = 0
      for (let i = 0, j = comb[0].length - 1; i < comb[0].length; j = i++) {
        const [xi, yi] = comb[0][i], [xj, yj] = comb[0][j]
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) n++
      }
      return n % 2 === 1
    }
    let t = 0
    while (t < 100 && !inside(s.x2 + ux * t, s.y2 + uy * t)) t += 0.01
    return t
  }

  it('lines at three angles each stop 0.3 sp before the ink they are heading for', () => {
    for (const fromY of [14, 40, 90]) {
      const s = glissandoStroke({ y: fromY, inkRightX: 100 }, target, SP, 1, house)!
      expect(ahead(s)).toBeCloseTo(0.3 * SP, 1)
    }
  })

  it('`clearBox` (the simple twin) stops 0.3 sp before the BOX, so ahead of the real teeth there is more', () => {
    const r = GLISSANDO_END_RULES.houseBox
    const s = glissandoStroke({ y: 90, inkRightX: 100 }, target, SP, 1, r)!
    expect(ahead(s)).toBeGreaterThan(0.3 * SP + 0.5) // enters the box through its bottom, below the teeth
  })

  it('a line that would pass between the teeth runs on, to the head\'s own gap', () => {
    const between = glissandoStroke({ y: 10, inkRightX: 100 }, { ...target, accidentalOutline: [[[184, -4], [196, -4], [196, 24], [184, 24]]] }, SP, 0, house)!
    expect(between.x2).toBeCloseTo(184 - 0.3 * SP, 1) // the body, 0.3 sp ahead — not the teeth's x 180
  })
})

describe('the accidental-gap knob (his eye)', () => {
  it('overrides the armed row\'s stop; null gives it back; reset clears it; ⛔ a negative is refused', () => {
    expect(setGlissandoAccidentalGap(0.1)).toBe(true)
    expect(armedGlissandoEndRule().accidentalGap).toBe(0.1)
    const s = glissandoStroke(from, { ...to, accidentalLeftX: 185 }, SP, 1, { ...armedGlissandoEndRule(), accidental: 'truncate' })!
    expect(s.x2).toBeCloseTo(185 - 0.1 * SP)
    expect(setGlissandoAccidentalGap(-1)).toBe(false)
    expect(setGlissandoAccidentalGap(null)).toBe(true)
    expect(armedGlissandoEndRule().accidentalGap).toBe(GLISSANDO_END_RULES.house.accidentalGap)
    setGlissandoAccidentalGap(0.2)
    resetGlissandoRules()
    expect(armedGlissandoEndRule().accidentalGap).toBe(GLISSANDO_END_RULES.house.accidentalGap)
  })
})
