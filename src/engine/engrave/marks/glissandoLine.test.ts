/**
 * {@link glissandoStroke} and the glissando's rule rows (docs/plans/glissando-plan.md §0.1, G12–G13).
 * Pure arithmetic — a staff space of 10 px keeps the numbers readable.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  GLISSANDO_END_RULES, GLISSANDO_SQUEEZE_RULES, glissandoSettings, glissandoStroke, glissandoThicknessSpaces, resetGlissandoRules,
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

  it('stops ≈0.7 sp short of a target ACCIDENTAL, not of its head', () => {
    const s = glissandoStroke(from, { ...to, accidentalLeftX: 185 }, SP, 1, gould)!
    expect(s.x2).toBeCloseTo(185 - 0.7 * SP)
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
  it('MuseScore joins the head CENTRES, and tilts two heads at one height ±0.25 sp', () => {
    const r = GLISSANDO_END_RULES.musescore
    const s = glissandoStroke(from, to, SP, 1, r)!
    expect([s.y1, s.y2]).toEqual([40, 10])
    const flat = glissandoStroke({ y: 30, inkRightX: 100 }, { y: 30, inkLeftX: 200 }, SP, 1, r)!
    expect(flat.y1).toBeCloseTo(30 + 0.25 * SP) // F → F♯: starts LOWER, ends HIGHER
    expect(flat.y2).toBeCloseTo(30 - 0.25 * SP)
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
  it('ship Gould — ends and thickness', () => {
    expect(glissandoSettings()).toMatchObject({ end: 'gould', thickness: 'gould', squeeze: 'shrinkGaps' })
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
