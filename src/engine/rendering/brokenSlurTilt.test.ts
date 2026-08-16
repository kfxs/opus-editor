import { describe, it, expect } from 'vitest'
import { brokenSlurOpenRise } from './brokenSlurTilt'
import { BROKEN_SLUR_MAX_SLOPE, CURVE, CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
/** A sixth up, as diatonic steps — the interval Gould's own example spans. */
const ABOVE = -1
const BELOW = 1
const UP_A_SIXTH = 5
const DOWN_A_SIXTH = -5

describe('brokenSlurOpenRise — Gould p. 112, via Verovio', () => {
  it('is FLAT for a slur that resumes on the same pitch', () => {
    expect(brokenSlurOpenRise(0, 'begin', ABOVE)).toBe(CURVE_PX.slurArc)
    expect(brokenSlurOpenRise(0, 'end', ABOVE)).toBe(CURVE_PX.slurArc)
  })

  it('⭐ the two halves point AT each other — the whole slur tilts one way', () => {
    // Music resuming higher: the fragment running off the right edge climbs, and the one leading in
    // on the next system starts lower. Together they read as one gesture across the break.
    const begin = brokenSlurOpenRise(UP_A_SIXTH, 'begin', ABOVE)
    const end = brokenSlurOpenRise(UP_A_SIXTH, 'end', ABOVE)
    expect(begin).toBeGreaterThan(CURVE_PX.slurArc)
    expect(end).toBeLessThan(CURVE_PX.slurArc)
  })

  it('…and mirror for a falling continuation', () => {
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', ABOVE)).toBeLessThan(CURVE_PX.slurArc)
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'end', ABOVE)).toBeGreaterThan(CURVE_PX.slurArc)
  })

  it('leans by Verovio\'s quarter space per diatonic step', () => {
    // ⚠️ Two steps, so the cap (2.0 sp) does not bite: 1.4 + 0.5 = 1.9.
    expect((brokenSlurOpenRise(2, 'begin', ABOVE) - CURVE_PX.slurArc) / SP).toBeCloseTo(2 * 0.25, 6)
    expect(CURVE.brokenSlurTiltPerStep).toBe(0.25)
  })

  it('⭐ never flattens into something a reader would take for a TIE', () => {
    // A two-octave fall would drive the begin half's open end below its own note; Verovio's floor —
    // "Make sure that broken slurs do not look like ties" — is Gould's parenthesis as a number.
    expect(brokenSlurOpenRise(-14, 'begin', ABOVE)).toBe(CURVE_PX.brokenSlurMinRise)
    expect(brokenSlurOpenRise(14, 'end', ABOVE)).toBe(CURVE_PX.brokenSlurMinRise)
    expect(CURVE.brokenSlurMinRise).toBe(1.0)
  })

  it('⭐ is CAPPED so a wide interval does not open a hole at the margin', () => {
    // ⚠️ Ours, not Verovio's: its clamp is geometric (never inside the staff), which does nothing for
    // music already outside the staff — exactly when it looks worst (his report, 2026-08-16).
    expect(brokenSlurOpenRise(14, 'begin', ABOVE)).toBe(CURVE_PX.brokenSlurMaxRise)
    expect(brokenSlurOpenRise(2, 'begin', ABOVE)).toBeLessThan(CURVE_PX.brokenSlurMaxRise)
  })

  it('⭐⭐ a SHORT fragment is FLAT, not a comma — the rise cannot outgrow its own length', () => {
    // A slur ending on the first note of a system: 0.6 sp of room. A full space of drop there is a
    // 60° tick; the slope clamp gives it 0.3. MuseScore reaches the same place with
    // `constrainLeftAnchor`, which names the case instead of scaling with the room.
    const tiny = 0.6 * SP
    expect(brokenSlurOpenRise(4, 'end', ABOVE, tiny)).toBeCloseTo(tiny * 0.5, 6)
    expect(BROKEN_SLUR_MAX_SLOPE).toBe(0.5)
    // …and a fragment with room is unaffected by it.
    expect(brokenSlurOpenRise(4, 'end', ABOVE, 20 * SP)).toBe(brokenSlurOpenRise(4, 'end', ABOVE))
  })
})

describe('the SIDE flips the lean — his 2.25 sp correction, 2026-08-16', () => {
  it('🚨 a slur BELOW a rising continuation raises its open end, it does not drop it', () => {
    // `rise` is measured along the slur's own side, so below the staff "more rise" means LOWER.
    // Gould's lean is toward the PITCH: a continuation that resumes higher must pull the begin
    // half's open end UP — which below the staff means LESS rise, not more.
    const below = brokenSlurOpenRise(UP_A_SIXTH, 'begin', BELOW)
    const above = brokenSlurOpenRise(UP_A_SIXTH, 'begin', ABOVE)
    expect(below).toBeLessThan(CURVE_PX.slurArc)
    expect(above).toBeGreaterThan(CURVE_PX.slurArc)
  })

  it('…and mirrors again for a falling continuation', () => {
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', BELOW)).toBeGreaterThan(CURVE_PX.slurArc)
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', ABOVE)).toBeLessThan(CURVE_PX.slurArc)
  })
})
