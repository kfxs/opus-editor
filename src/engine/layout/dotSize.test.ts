import { describe, it, expect, afterEach } from 'vitest'
import {
  ACTIVE_DOT_SIZE_RULE, DOT_SIZE_RULES, armedDotSize, dotInkRadius, dotInkWidth, dotSizeGeneration, dotSizeScale,
  dotSizeSettings, resetDotSizeRule, setDotSizeRule,
} from './dotSize'
import { glyphBox } from '@/engine/fonts/fontMetrics'

afterEach(() => resetDotSizeRule())

describe('the dot’s size (docs/plans/multiple-dots-plan.md R6)', () => {
  it('✅ ships `gould` — 0.49 sp, her plates; every row names its source', () => {
    expect(ACTIVE_DOT_SIZE_RULE).toBe('gould')
    expect(dotInkWidth()).toBeCloseTo(0.49, 10)
    expect(dotInkRadius()).toBeCloseTo(0.245, 10)
    for (const row of Object.values(DOT_SIZE_RULES)) expect(row.source.length).toBeGreaterThan(0)
  })

  it('the glyph is SCALED to the size — Bravura’s 0.40 dot by 1.225', () => {
    expect(dotSizeScale()).toBeCloseTo(0.49 / glyphBox('augmentationDot').right, 10)
  })

  it('`font` is what we drew: the face’s own glyph, unscaled', () => {
    setDotSizeRule('font')
    expect(armedDotSize()).toBeNull()
    expect(dotSizeScale()).toBe(1)
    expect(dotInkWidth()).toBe(glyphBox('augmentationDot').right)
  })

  it('arming bumps the generation (a WIDTH); an unknown row is refused', () => {
    const before = dotSizeGeneration()
    expect(setDotSizeRule('ross')).toBe(true)
    expect(dotInkWidth()).toBeCloseTo(1 / 3, 10)
    expect(dotSizeGeneration()).toBeGreaterThan(before)
    expect(setDotSizeRule('nope' as never)).toBe(false)
    expect(dotSizeSettings().rule).toBe('ross')
  })
})
