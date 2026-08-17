/**
 * {@link dynamicMarkInk} — how far a mark's ink really reaches, per letter.
 *
 * Subject beside this file. ⭐ **No DOM and no render**, which is the point: the numbers come from
 * `engine/fonts` (Bravura, measured from the shipped OTF), so this is the one part of the mark's
 * geometry a unit test can state exactly — where the drawn `<text>` is concerned jsdom measures 0
 * (`reference_jsdom_cannot_measure_glyphs`).
 *
 * The claim under test is his report of 2026-08-17: the attachment line started in *"empty space"*
 * over a dynamic letter, because the box top is one fraction for every letter. These assertions are
 * what says the letters genuinely differ.
 */
import { describe, it, expect } from 'vitest'
import { dynamicInkReachSpaces } from './dynamicMarkInk'
import { levelToGlyphString } from '@/utils/dynamics'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { DYNAMIC_GLYPH_INK_ABOVE } from './dynamicStyle'
import { STAFF_SPACE_PX } from '../models/staffSize'

describe('dynamicInkReachSpaces', () => {
  it('reads the FONT, letter by letter — an `f` is much taller than a `p`', () => {
    const f = dynamicInkReachSpaces(levelToGlyphString('f'))!
    const p = dynamicInkReachSpaces(levelToGlyphString('p'))!
    expect(f.above).toBe(glyphBox('dynamicForte').up)
    expect(p.above).toBe(glyphBox('dynamicPiano').up)
    expect(f.above).toBeGreaterThan(p.above)
  })

  it('⭐⭐ …and the box constant is TALLER THAN BOTH — the air he reported, measured', () => {
    // `DYNAMIC_GLYPH_INK_ABOVE` is `0.68 × the glyph size`, in px at full staff size.
    const boxAboveSpaces = DYNAMIC_GLYPH_INK_ABOVE / STAFF_SPACE_PX
    const p = dynamicInkReachSpaces(levelToGlyphString('p'))!
    expect(boxAboveSpaces).toBeGreaterThan(p.above)
    // Nearly a whole staff space of nothing above a `p` — ~9px at full size, which is what the
    // guide was starting in. ⛔ If this ever drops near zero the constant has been made per-letter,
    // and `guideFrom` in DynamicsLayout can go.
    expect((boxAboveSpaces - p.above) * STAFF_SPACE_PX).toBeGreaterThan(5)
  })

  it('a MIXED level takes the tallest letter above and the deepest below', () => {
    const mf = dynamicInkReachSpaces(levelToGlyphString('mf'))!
    expect(mf.above, 'the f decides the top').toBe(glyphBox('dynamicForte').up)
    expect(mf.below, 'and the deeper descender the bottom')
      .toBe(Math.max(glyphBox('dynamicMezzo').down, glyphBox('dynamicForte').down))
  })

  it('answers NULL for prose — Bravura cannot speak for a serif word', () => {
    expect(dynamicInkReachSpaces('dolce')).toBeNull()
    expect(dynamicInkReachSpaces('')).toBeNull()
  })

  it('a mixed `mp dolce` still answers for its GLYPHS — the prose is skipped, not fatal', () => {
    const mixed = dynamicInkReachSpaces(`${levelToGlyphString('mp')} dolce`)!
    expect(mixed.above).toBe(Math.max(glyphBox('dynamicMezzo').up, glyphBox('dynamicPiano').up))
  })

  it('⚠️⚠️ plain ASCII letters are NOT levels — only the SMuFL glyphs are', () => {
    // ⭐ This assertion FOUND A BUG rather than confirming one: the first version read the string's
    // letters through `glyphsToLetters`, which leaves ASCII untouched, so typed prose came back with
    // a dynamics reach. A plain `p` is not piano — `utils/dynamics`' rule, the crux of the model.
    expect(dynamicInkReachSpaces('mf'), 'a typed "mf" is a word').toBeNull()
    expect(dynamicInkReachSpaces('sempre'), 'and "sempre" is not s + m + p + r').toBeNull()
  })
})
