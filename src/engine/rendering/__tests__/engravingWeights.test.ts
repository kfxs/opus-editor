import { describe, it, expect } from 'vitest'
import { engravingDefault } from '@/engine/fonts/fontMetrics'
import { THIN_LINE_SPACES } from '../thinLineWeight'
import { THIN_BARLINE_SPACES } from '../barlineInk'
import { CURVE } from '../curveStyle'
import { CROSS_SYSTEM_BEAM_WIDTH } from '../beamInk'
import { LEDGER_LINE_STYLE } from '../layoutConfig'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * ⭐⭐ **HOW THICK A LINE IS, AND WHO SAYS SO** — F3 of docs/font-metrics-plan.md.
 *
 * A feature test rather than one module's: the claim spans five files and belongs to none of them.
 * Every structural weight the editor draws with now comes out of Bravura's `engravingDefaults`
 * (`engine/fonts/`), where before each was a hand-typed copy of a number whose own comment already
 * named the font as its source.
 *
 * ## ⚠️ Why these DERIVE while the ink table only gets CHECKED
 *
 * `layout/spacingPadding.font.test.ts` keeps its literals and merely holds them against the font,
 * and that is not an inconsistency — the two kinds of number are different:
 *
 * - an **ink extent** is our own MEASUREMENT of what we draw, and it diverges from the font on
 *   purpose in places (a clearance is rounded OUT, because a generous clearance is safe where a
 *   tight one collides). The literal is a claim of its own, so it stays and is checked.
 * - a **weight** is a TRANSCRIPTION of the font's own statement. There is no independent claim to
 *   keep, so the only thing a literal can add is a typo.
 *
 * ## ⚠️ What these tests can and cannot defend — said plainly, because it is easy to overclaim
 *
 * ⛔ They cannot prove a constant is still *wired* to the font. `THIN_LINE_SPACES = 0.16` typed by
 * hand would pass every assertion here, because 0.16 is what the font says. A derivation agreeing
 * with its source is a tautology, and pretending otherwise is the trap §4.1 of the plan is about.
 *
 * ⭐ What they DO defend is the thing our one-constant-per-family decisions actually rest on: **the
 * font's own internal agreements**, which are facts about Bravura and not about us —
 *
 * - the five thin-line names really are one value, which is what lets one constant serve all of
 *   them;
 * - `tie*Thickness` really does equal `slur*Thickness`, which is what lets one `CURVE` serve both;
 * - `hairpinThickness` really does sit in the family, which is what makes deriving it safe given
 *   that his eye, not the font, is the authority there.
 *
 * If a font upgrade broke any of those, the constant it justifies would have to split — and that is
 * exactly when these fail.
 */

describe('the thin-line family', () => {
  it('⭐ is the font\'s one thin-line weight, and every member shares it', () => {
    // Bravura gives the SAME value to all five, which is the statement that these marks are one
    // weight. If a future font disagreed with itself here, the family would need splitting — so the
    // assertion is that they still agree, not what they agree on.
    const family = [
      'thinBarlineThickness',
      'legerLineThickness',
      'octaveLineThickness',
      'tupletBracketThickness',
      'hairpinThickness',
    ] as const
    for (const name of family) {
      expect(engravingDefault(name), `${name} is in the family`).toBe(THIN_LINE_SPACES)
    }
  })

  it('the barline is the same number under its own name', () => {
    // `THIN_BARLINE_SPACES` is the alias the family was first extracted from; it must not drift.
    expect(THIN_BARLINE_SPACES).toBe(THIN_LINE_SPACES)
  })

  it('⚠️ the HAIRPIN is in this family by HIS EYE, not only by the font', () => {
    // ⛔ Read `thinLineWeight.ts` before touching this. All four reference engines override SMuFL
    //    downward for a hairpin by about half, it was taken out of the family on 2026-08-15 on that
    //    evidence, and his eye rejected both Verovio/LilyPond's 0.10 ("now the line is too thin")
    //    and MuseScore's 0.12 — so it went back the same day. The font agrees with him here, which
    //    is why deriving the family is safe; ⚠️ if a font ever disagreed, HIS answer wins and the
    //    hairpin leaves the family with its own constant.
    expect(engravingDefault('hairpinThickness')).toBe(THIN_LINE_SPACES)
  })
})

describe('the curve weights', () => {
  it('⭐ a slur\'s middle and its tip are Bravura\'s two slur thicknesses', () => {
    expect(CURVE.thickness).toBe(engravingDefault('slurMidpointThickness'))
    expect(CURVE.outline).toBe(engravingDefault('slurEndpointThickness'))
  })

  it('⭐⭐ a TIE is drawn at the SLUR\'s weight, and the font is why that is allowed', () => {
    // The two used to be tuned apart — SLUR_THICKNESS 1.5 against TIE_THICKNESS 2.7 — on the
    // reasoning that ties read heavier. Bravura gives the pair identical values, and LilyPond and
    // MuseScore share one weight between them too. ⭐ THIS is the assertion that justifies one
    // constant serving both: if a font ever split them, `CURVE` would have to split as well.
    expect(engravingDefault('tieMidpointThickness')).toBe(engravingDefault('slurMidpointThickness'))
    expect(engravingDefault('tieEndpointThickness')).toBe(engravingDefault('slurEndpointThickness'))
  })

  it('the tip is thinner than the middle — the taper is what makes a curve read as drawn', () => {
    expect(CURVE.outline).toBeLessThan(CURVE.thickness)
  })
})

describe('the beam', () => {
  it('⭐ is Bravura\'s `beamThickness`, converted once', () => {
    expect(CROSS_SYSTEM_BEAM_WIDTH).toBe(engravingDefault('beamThickness') * STAFF_SPACE_PX)
  })

  it('⚠️ and is the 5 px it has always been — F3 moved no pixel here', () => {
    // The value this replaced, kept as an assertion because F3's promise is "no visible change by
    // construction, and if anything moves a transcription was wrong". Nothing moved.
    expect(CROSS_SYSTEM_BEAM_WIDTH).toBe(5)
  })
})

describe('the ledger line — the one weight that is a RATIO, not a thickness', () => {
  it('⛔ is NOT the font\'s absolute weight, which would be too heavy', () => {
    // 0.16 spaces is 1.6 px at our staff size. Taking it would put a ledger line more than half
    // again over the 1 px staff line VexFlow draws beside it.
    const absolute = engravingDefault('legerLineThickness') * STAFF_SPACE_PX
    expect(LEDGER_LINE_STYLE.lineWidth).toBeLessThan(absolute)
  })

  it('⭐⭐ is the font\'s ledger-to-staff-line RATIO, against the staff line VexFlow draws', () => {
    // The distinction F3 turned up: a weight from the font only agrees with its neighbours while
    // the neighbours come from the font too, and VexFlow's staff lines are the SVG context's
    // default stroke-width — 1 px — not `staffLineThickness`.
    const ratio = engravingDefault('legerLineThickness') / engravingDefault('staffLineThickness')
    expect(LEDGER_LINE_STYLE.lineWidth).toBeCloseTo(ratio, 10)
    // …and the two things the ratio claims: heavier than a staff line, nowhere near VexFlow's 2.
    expect(LEDGER_LINE_STYLE.lineWidth).toBeGreaterThan(1)
    expect(LEDGER_LINE_STYLE.lineWidth).toBeLessThan(1.5)
  })

  it('is still black — the other half of that override', () => {
    expect(LEDGER_LINE_STYLE.strokeStyle).toBe('#000000')
  })
})
