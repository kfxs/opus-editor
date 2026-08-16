import { describe, it, expect } from 'vitest'
import {
  BRAVURA,
  CLEF_GLYPHS,
  accidentalGlyph,
  anchor,
  engravingDefault,
  flagDropFromTip,
  flagGlyph,
  flagInkRight,
  glyphBox,
  ledgerExtension,
  noteheadGlyph,
  noteheadInk,
  restGlyph,
  secondDisplacement,
} from './fontMetrics'
import { GLYPH_BOXES } from './bravuraMetrics'
import type { NoteDuration } from '@/types/music'

/**
 * F1 of `docs/font-metrics-plan.md` — the font as data.
 *
 * ⭐⭐ **What is worth asserting here, and what is not.** Re-stating a generated number
 * (`expect(glyphBox('noteheadBlack').right).toBe(1.18)`) would be this file agreeing with itself:
 * the value came out of a script, and a test that copies it only pins the copy. The plan's §4.1 makes
 * the same point about deriving the ink table and then testing the derivation.
 *
 * So the assertions below are of three kinds, none of which a regeneration can satisfy by accident:
 *
 *  1. **Facts of NOTATION** the font must agree with — a notehead is one staff space tall, a sharp is
 *     symmetric about its line, a flat is not. If a regeneration broke these, the table would be
 *     wrong in a way that shows on paper.
 *  2. **The COMPOSITIONS** (plan §3.1b), where the arithmetic is ours and the operands are the
 *     font's — the part a lookup cannot check.
 *  3. **The AGREEMENT with the table we have drawn with for months** (plan §2): the numbers
 *     `spacingPadding.ts` was measured into in Chrome, now read out of the font instead.
 *
 * ⚠️ The last kind is the one that would catch a bad regeneration, and it is deliberately NOT a
 * `toBe`: the plan's whole finding is that our hand-measured numbers and the font's agree to within
 * a few hundredths, and pinning them tighter than that would be pinning the measuring session.
 */

const DURATIONS: NoteDuration[] = ['w', 'h', 'q', '8', '16', '32']

describe('the font, as data', () => {
  it('is stamped with the two Bravuras it is made of', () => {
    // ⚠️ They are not the same version, and the stamp exists so that stays visible: the boxes are
    //    measured off the OTF we ship, the anchors and weights come from Steinberg's metadata.
    expect(BRAVURA.name).toBe('Bravura')
    expect(BRAVURA.otfRevision).toBeGreaterThan(0)
    expect(BRAVURA.metadataVersion).toBeGreaterThan(0)
  })

  it('⭐ measures every glyph it claims to — no zero-width rows', () => {
    // A glyph that measured 0×0 is the jsdom/fallback-font failure written into the table, which is
    // exactly what this module exists to make impossible (`reference_jsdom_cannot_measure_glyphs`).
    for (const [name, box] of Object.entries(GLYPH_BOXES)) {
      expect(box.right - -box.left, `${name} draws ink horizontally`).toBeGreaterThan(0)
      expect(box.up + box.down, `${name} draws ink vertically`).toBeGreaterThan(0)
    }
  })

  it('⭐⭐ a NOTEHEAD is one staff space tall and half a space either side of its line', () => {
    // The oldest fact in the notation. If this moved, everything keyed on a staff space moved.
    for (const duration of DURATIONS) {
      const box = glyphBox(noteheadGlyph(duration))
      expect(box.up, `${duration} above the line`).toBeCloseTo(0.5, 2)
      expect(box.down, `${duration} below the line`).toBeCloseTo(0.5, 2)
    }
  })

  it('⭐⭐ a SHARP is symmetric about its line and a FLAT is not — the case one number cannot serve', () => {
    const sharp = glyphBox('accidentalSharp')
    expect(sharp.up).toBeCloseTo(sharp.down, 1)

    // A flat's bowl sits ABOVE the line: it reaches a space further up than down. This is the fact
    // `INK_HEIGHT`'s vertical half was built for, and the font states it outright.
    const flat = glyphBox('accidentalFlat')
    expect(flat.up).toBeGreaterThan(flat.down + 0.5)
  })

  it('⭐⭐ a WHOLE rest hangs BELOW its origin and a HALF rest sits ABOVE it', () => {
    // Notation's oldest asymmetry, and the row `INK_HEIGHT` has never had (plan §3.4). The two rests
    // are the SAME GLYPH SHAPE — identical widths — distinguished only by which side of the line it
    // sits on, which is why a single "a rest is this tall" would be wrong for both.
    const whole = glyphBox('restWhole')
    const half = glyphBox('restHalf')
    expect(whole.right).toBeCloseTo(half.right, 2)
    expect(whole.down).toBeGreaterThan(whole.up + 0.4)
    expect(half.up).toBeGreaterThan(half.down + 0.4)
  })

  it('⭐ the SHORT rests are the WIDE ones', () => {
    // Each extra flag leans further right, so a 16th rest is wider than a quarter — the finding that
    // replaced `REST_WIDTH`'s single 1.2 (`spacingPadding.ts`).
    expect(glyphBox('rest16th').right).toBeGreaterThan(glyphBox('restQuarter').right)
    expect(glyphBox('rest32nd').right).toBeGreaterThan(glyphBox('rest16th').right)
    expect(glyphBox('rest8th').right).toBeLessThan(glyphBox('restQuarter').right)
  })

  it('⚠️ a time signature DIGIT starts right of its origin — a NEGATIVE left reach, not a zero', () => {
    // The convention `GlyphBox.left` documents: a reach, positive leftward. Clamping this to 0 would
    // claim 0.08 spaces of ink that is not drawn.
    expect(glyphBox('timeSig4').left).toBeLessThan(0)
  })
})

describe('the vocabulary — our words to the font\'s names', () => {
  it('has a rest and a notehead for every duration we can write', () => {
    for (const duration of DURATIONS) {
      expect(() => glyphBox(restGlyph(duration)), duration).not.toThrow()
      expect(glyphBox(restGlyph(duration))).toBeDefined()
      expect(glyphBox(noteheadGlyph(duration))).toBeDefined()
    }
    // ⚠️ Only three durations are written with the same black head; the other two have their own.
    expect(noteheadGlyph('w')).toBe('noteheadWhole')
    expect(noteheadGlyph('h')).toBe('noteheadHalf')
    expect(noteheadGlyph('32')).toBe('noteheadBlack')
  })

  it('has the five accidental signs `spacingPadding` is keyed by, and NULL for anything else', () => {
    for (const sign of ['#', 'b', 'n', '##', 'bb']) {
      expect(accidentalGlyph(sign), sign).not.toBeNull()
    }
    // ⛔ Not a sharp. A guessing fallback gets believed; a null makes the caller decide in the open.
    expect(accidentalGlyph('###')).toBeNull()
    expect(accidentalGlyph('')).toBeNull()
  })

  it('flags exist for the flagged durations and NOT for the others', () => {
    expect(flagGlyph('8', true)).toBe('flag8thUp')
    expect(flagGlyph('8', false)).toBe('flag8thDown')
    expect(flagGlyph('q', true)).toBeNull()
    expect(flagGlyph('w', false)).toBeNull()
  })

  it('⭐ an UP flag and a DOWN flag are different glyphs of different widths', () => {
    // Not a mirror image, which is why the column arithmetic cannot use one number for both.
    expect(glyphBox('flag8thDown').right).toBeGreaterThan(glyphBox('flag8thUp').right)
  })

  it('names a clef glyph for each of ours, alto and tenor sharing the C clef', () => {
    expect(CLEF_GLYPHS.treble).toBe('gClef')
    expect(CLEF_GLYPHS.bass).toBe('fClef')
    expect(CLEF_GLYPHS.alto).toBe(CLEF_GLYPHS.tenor)
  })
})

describe('anchors', () => {
  it('⭐ a notehead knows where its stem attaches — P3\'s prerequisite', () => {
    const up = anchor('noteheadBlack', 'stemUpSE')
    expect(up).not.toBeNull()
    // The stem goes up on the RIGHT of the head, at the head's own right edge.
    expect(up![0]).toBeCloseTo(glyphBox('noteheadBlack').right, 2)
    expect(up![1]).toBeGreaterThan(0)

    const down = anchor('noteheadBlack', 'stemDownNW')
    expect(down).not.toBeNull()
    // …and down on the LEFT, at the anchor itself.
    expect(down![0]).toBeCloseTo(0, 2)
    expect(down![1]).toBeLessThan(0)
  })

  it('⛔ returns NULL for an anchor a glyph does not have, never a plausible [0, 0]', () => {
    expect(anchor('noteheadBlack', 'thereIsNoSuchAnchor')).toBeNull()
    expect(anchor('augmentationDot', 'stemUpSE')).toBeNull()
  })
})

describe('engraving defaults', () => {
  it('⭐⭐ states the weights two modules already adopted BY HAND — and states them the same', () => {
    // `rendering/thinLineWeight.ts` says THIN_LINE_SPACES 0.16 IS the font's one thin-line weight,
    // and names five defaults that share it. `rendering/curveStyle.ts` says 0.22 IS
    // slurMidpointThickness and 0.10 IS slurEndpointThickness. Those are transcriptions; this is the
    // source. ⭐ If one of them was mistyped, THIS is the test that says so (plan §F3).
    for (const name of [
      'thinBarlineThickness',
      'legerLineThickness',
      'octaveLineThickness',
      'tupletBracketThickness',
      'hairpinThickness',
    ] as const) {
      expect(engravingDefault(name), name).toBeCloseTo(0.16, 3)
    }
    expect(engravingDefault('slurMidpointThickness')).toBeCloseTo(0.22, 3)
    expect(engravingDefault('slurEndpointThickness')).toBeCloseTo(0.1, 3)
  })

  it('carries the weights P3 will draw with', () => {
    expect(engravingDefault('stemThickness')).toBeCloseTo(0.12, 3)
    expect(engravingDefault('beamThickness')).toBeCloseTo(0.5, 3)
    expect(engravingDefault('staffLineThickness')).toBeCloseTo(0.13, 3)
  })
})

describe('⭐ the compositions — where the arithmetic is ours and the operands are the font\'s', () => {
  it('⭐⭐ a notehead\'s INK and a chord\'s DISPLACEMENT are different numbers', () => {
    // Plan §3.1a: `INK.notehead = 1.13` has always been the second of these, measured off VexFlow's
    // drawing; the font's head is 1.18. The gap is half a stem, and it is not an error — it is two
    // questions that had one name.
    const ink = noteheadInk('q')
    const displaced = secondDisplacement('q')
    expect(ink).toBeGreaterThan(displaced)
    expect(ink - displaced).toBeCloseTo(engravingDefault('stemThickness') / 2, 3)

    // ⭐ And the displacement is what we have drawn with for months, to a hundredth (plan §2).
    expect(displaced).toBeCloseTo(1.13, 1)
  })

  it('⭐⭐ a FLAG\'s reach is a composition of three numbers, not a glyph width', () => {
    // Plan §3.1b. The flag's own box is measured from the STEM's x, so the bare lookup is adrift by
    // exactly the distance the stem stands inside the head's right edge.
    const reach = flagInkRight('8', true)
    const bare = glyphBox('flag8thUp').right
    expect(reach).not.toBeCloseTo(bare, 2)
    expect(reach).toBeCloseTo(noteheadInk('8') - engravingDefault('stemThickness') + bare, 3)

    // ⭐ …and it lands on the 2.13 the browser measured into `INK.notehead + INK.flagReach`.
    expect(reach).toBeCloseTo(2.13, 1)
  })

  it('⭐ a DOWN flag lands inside the notehead\'s own width — which is why it buys no room', () => {
    // Its stem stands at the head's LEFT edge, i.e. at the anchor, so the flag starts there too.
    const down = flagInkRight('8', false)
    expect(down).toBeCloseTo(glyphBox('flag8thDown').right, 3)
    // Barely past the head, and the head has always covered it.
    expect(down - noteheadInk('8')).toBeLessThan(0.1)
  })

  it('a flag hangs the same distance from the TIP whatever its hook count', () => {
    // Each extra hook thickens the glyph rather than lengthening it — the measured claim behind
    // `INK_HEIGHT.flagFromTip`, now read off the font for all three.
    const drops = ['8', '16', '32'].map(d => flagDropFromTip(d as NoteDuration, true))
    for (const drop of drops) expect(drop).toBeCloseTo(drops[0], 1)
    // ⚠️ And it agrees with the 3.3 we measured, to within the rounding OUT that number carries —
    //    the font says 3.24 (`INK_HEIGHT.flagFromTip`, plan §2). ⛔ Not a `toBe`: pinning it tighter
    //    would be pinning the measuring session rather than checking the agreement.
    expect(Math.abs(drops[0] - 3.3)).toBeLessThan(0.1)
    expect(flagDropFromTip('q', true)).toBe(0)
  })

  it('a LEDGER LINE overhangs its notehead on both sides', () => {
    const overhang = ledgerExtension()
    expect(overhang).toBeGreaterThan(0)
    // −0.40 to +1.58 around the anchor, against a bare head's 0 to 1.18: wider than the head on
    // BOTH sides, which is the fact `INK.ledgerLeft`/`ledgerRight` exist for.
    expect(overhang + noteheadInk('q') + overhang).toBeCloseTo(1.98, 2)
  })
})
