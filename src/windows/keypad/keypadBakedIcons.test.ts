import { describe, it, expect } from 'vitest'
import { KEYPAD_BAKE_RECIPES } from './keypadLayouts'
import { KEYPAD_BAKED_ICONS, KEYPAD_BAKED_NAMES } from './keypadBakedIcons'
import { bakeRecipeKey, isAxisAligned } from './tremoloBake'

/**
 * The generated outlines against the recipes they were baked from. ⚠️ No geometry here — jsdom has
 * no fonts; that the outlines SIT on the drawing is proved by the bake step itself, in a browser,
 * before it writes the file.
 */
describe('keypadBakedIcons — every drawing of the Beams/Tremolos page is baked', () => {
  it.each(Object.keys(KEYPAD_BAKE_RECIPES))('%s is baked from the recipe as it is written NOW', name => {
    const baked = KEYPAD_BAKED_ICONS.get(bakeRecipeKey(KEYPAD_BAKE_RECIPES[name]))
    expect(baked, `\`${name}\` was tuned since the last bake (the keypad is drawing it as live text, which a`
      + ' browser zoom can shift) — run `npm run bake:keypad`').toBeDefined()
    expect(baked!.length).toBe(KEYPAD_BAKE_RECIPES[name].length)
    for (const d of baked!) expect(d.startsWith('M')).toBe(true)
  })

  it('holds nothing the page no longer draws', () => {
    expect([...KEYPAD_BAKED_NAMES].sort()).toEqual(Object.keys(KEYPAD_BAKE_RECIPES).sort())
  })
})

describe('tremoloBake.bakeRecipeKey', () => {
  it('changes when a number changes, and not with how a default is spelled', () => {
    const a = bakeRecipeKey([{ glyph: '', dy: -10 }])
    expect(bakeRecipeKey([{ glyph: '', size: 26, dx: 0, dy: -10 }])).toBe(a)
    expect(bakeRecipeKey([{ glyph: '', dy: -9 }])).not.toBe(a)
  })
})

describe('tremoloBake.isAxisAligned — which outlines are pixel-snapped', () => {
  it('a bar is: only horizontal and vertical edges', () => {
    expect(isAxisAligned('M18.135-0.340L7.875-0.340L7.875 3.410L18.135 3.410')).toBe(true)
  })
  it('⚠️ a bare STEM is not, though its edges are straight — snapped, a hairline reads heavy', () => {
    expect(isAxisAligned('M7.304-1.012L7.304-15.136L6.644-15.136L6.644-1.012')).toBe(false)
  })
  it('a slanted tremolo stroke is not — snapped, a slant is a staircase', () => {
    expect(isAxisAligned('M2 4L8 2L8 5L2 7')).toBe(false)
  })
  it('anything with a curve is not', () => {
    expect(isAxisAligned('M0 0C1 1 2 2 3 0L3 3L0 3')).toBe(false)
  })
  it('the baked page has BOTH kinds, so both branches of the renderer are live', () => {
    const all = [...KEYPAD_BAKED_ICONS.values()].flat()
    expect(all.some(isAxisAligned)).toBe(true)
    expect(all.some(d => !isAxisAligned(d))).toBe(true)
  })
})
