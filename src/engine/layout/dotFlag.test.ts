import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOT_FLAG_RULE, DOT_FLAG_RULES, dotFlagGeneration, dotFlagSettings, dotLevelWithFlag, flagPushedFirstDot,
  resetDotFlagRule, setDotFlagRule,
} from './dotFlag'
import { flagGlyph, flagInkRight, glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { MODIFIER_RIGHT_GAP_PX } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

afterEach(() => resetDotFlagRule())

/** A G4 eighth: on a line, its dot lifted into the space above — level with the flag's tail. */
const ON_A_LINE = { dotY: -0.5, stemLength: 3.5 }
/** An A4 eighth: in a space, its dot beside the head — below the flag's tail. */
const IN_A_SPACE = { dotY: 0, stemLength: 3.5 }

describe('dots and a stem-up flag (docs/plans/multiple-dots-plan.md R2)', () => {
  it('✅ ships `gould`; every row names its source', () => {
    expect(ACTIVE_DOT_FLAG_RULE).toBe('gould')
    for (const row of Object.values(DOT_FLAG_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('LEVEL: a dot lifted off a line meets an eighth’s tail; a dot in a space sits below it', () => {
    expect(dotLevelWithFlag('8', ON_A_LINE)).toBe(true)
    expect(dotLevelWithFlag('8', IN_A_SPACE)).toBe(false)
  })

  it('⭐ `gould` pushes only a LEVEL dot, to 0.30 past the flag’s ink', () => {
    expect(flagPushedFirstDot('8', ON_A_LINE)).toBeCloseTo(flagInkRight('8', true) + 0.3, 10)
    expect(flagPushedFirstDot('8', IN_A_SPACE)).toBeNull()
  })

  it('an `always` row pushes both (Ross, Gerou & Lusk)', () => {
    setDotFlagRule('ross')
    expect(flagPushedFirstDot('8', IN_A_SPACE)).toBeCloseTo(flagInkRight('8', true) + 0.2, 10)
  })

  it('`vexflow` is what we drew: the head, VexFlow’s 2 px and the flag’s width, level or not', () => {
    setDotFlagRule('vexflow')
    const old = noteheadInk('8') + MODIFIER_RIGHT_GAP_PX / STAFF_SPACE_PX + glyphBox(flagGlyph('8', true)!).right
    expect(flagPushedFirstDot('8', IN_A_SPACE)).toBeCloseTo(old, 10)
  })

  it('no flag, no push; unknown geometry is taken as LEVEL (the safe side)', () => {
    expect(flagPushedFirstDot('q', ON_A_LINE)).toBeNull()
    expect(flagPushedFirstDot('8')).not.toBeNull()
  })

  it('arming bumps the generation (a WIDTH); an unknown row is refused', () => {
    const before = dotFlagGeneration()
    expect(setDotFlagRule('lilypond')).toBe(true)
    expect(dotFlagGeneration()).toBeGreaterThan(before)
    expect(setDotFlagRule('nope' as never)).toBe(false)
    expect(dotFlagSettings().rule).toBe('lilypond')
  })
})
