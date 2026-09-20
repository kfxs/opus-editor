import { describe, it, expect } from 'vitest'
import { brokenSlurOpenRise } from './brokenSlurTilt'
import { BROKEN_SLUR_MAX_SLOPE, CURVE, CURVE_PX } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
/** A sixth, as diatonic steps — the interval Gould's own example spans. */
const ABOVE = -1
const BELOW = 1
const UP_A_SIXTH = 5
const DOWN_A_SIXTH = -5
/** Long enough that Verovio's anti-tie floor (`brokenSlurTieLikeSpan`) does not apply. */
const LONG = 20 * SP

describe('brokenSlurOpenRise — Gould p. 112, via Verovio and LilyPond', () => {
  it('⭐⭐ has NO fixed base: nothing to clear and nothing to lean toward is FLAT', () => {
    // ⚠️ This is the change of 2026-08-16. The base used to be `slurArc`, 1.4 spaces outward off the
    // ANCHORED note — a note that may be at the far end of the system, which is how a slur hanging
    // under a rising run ended up 2.95 spaces below the staff while its music had climbed away.
    // LilyPond measures the open end against the music BESIDE it; with no such music, flat.
    expect(brokenSlurOpenRise(0, 'begin', ABOVE, LONG)).toBe(0)
    expect(brokenSlurOpenRise(0, 'end', ABOVE, LONG)).toBe(0)
  })

  it('⭐ the two halves point AT each other — the whole slur tilts one way', () => {
    // Music resuming higher: the fragment running off the right edge climbs away, and the one
    // leading in on the next system does NOT — together they read as one gesture across the break.
    // ⚠️ Which of the pair moves depends on the side, because the lean only ever acts OUTWARD (see
    // below); above the staff a rising continuation is the begin half's case.
    expect(brokenSlurOpenRise(UP_A_SIXTH, 'begin', ABOVE, LONG)).toBeGreaterThan(0)
    expect(brokenSlurOpenRise(UP_A_SIXTH, 'end', ABOVE, LONG)).toBe(0)
  })

  it('…and mirror for a falling continuation', () => {
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', ABOVE, LONG)).toBe(0)
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'end', ABOVE, LONG)).toBeGreaterThan(0)
  })

  it('⭐⭐ the lean may only push the open end OUT — the music blocks the other way', () => {
    // The open end already hugs the note beside it, so a lean toward the staff has nowhere to go.
    // With a clearance of 1.5 spaces, an inward lean leaves it exactly there and an outward one adds.
    // ⚠️ Two steps and half a space of clearance, so the 2.0 sp ceiling does not bite.
    const clearance = 0.5 * SP
    expect(brokenSlurOpenRise(2, 'end', ABOVE, LONG, clearance)).toBe(clearance)
    expect(brokenSlurOpenRise(-2, 'end', ABOVE, LONG, clearance)).toBeCloseTo(clearance + 0.5 * SP, 6)
  })

  it('leans by Verovio\'s quarter space per diatonic step', () => {
    expect(brokenSlurOpenRise(2, 'begin', ABOVE, LONG) / SP).toBeCloseTo(2 * 0.25, 6)
    expect(CURVE.brokenSlurTiltPerStep).toBe(0.25)
  })

  it('⭐⭐ LilyPond: the open end sits where the nearest note on its own system leaves it', () => {
    // The clearance is the BASE the lean is measured from, not a constant off the far anchor.
    const clearance = 1.5 * SP
    expect(brokenSlurOpenRise(0, 'begin', BELOW, LONG, clearance)).toBe(clearance)
  })

  it('⭐⭐ …and that base may be NEGATIVE — the open end closer to the staff than its anchor', () => {
    // 🚨 HIS FIGURE, and the whole point. The slur is anchored to a LOW C4 and covers a run climbing
    // to F4, so the music beside the open end is a space and a half HIGHER than the anchor: the open
    // end belongs up there with it. The old fixed base drove it 1.4 spaces the other way, and the
    // white left between the arc and the run is what he reported as "the air in the measure before".
    expect(brokenSlurOpenRise(0, 'begin', BELOW, LONG, -SP)).toBe(-SP)
  })

  it('⭐ never flattens into something a reader would take for a TIE — but only when SHORT', () => {
    // Verovio's floor is conditional: `(abs(y1-y2) < 2*unit) && (abs(x1-x2) < 2*staffSize)`. A short
    // fragment is forced apart; a long one cannot be mistaken for a tie and is left alone. Applying
    // it unconditionally was half of the air his eye caught.
    const short = 4 * SP
    expect(brokenSlurOpenRise(0, 'begin', ABOVE, short)).toBe(CURVE_PX.brokenSlurMinRise)
    expect(brokenSlurOpenRise(0, 'begin', ABOVE, LONG)).toBe(0)
    expect(CURVE.brokenSlurMinRise).toBe(1.0)
    expect(CURVE.brokenSlurTieLikeSpan).toBe(8.0)
  })

  it('⭐ is CAPPED so a wide interval does not open a hole at the margin', () => {
    // ⚠️ Ours, not Verovio's: its clamp is geometric (never inside the staff), which does nothing for
    // music already outside the staff — exactly when it looks worst (his report, 2026-08-16).
    expect(brokenSlurOpenRise(14, 'begin', ABOVE, LONG)).toBe(CURVE_PX.brokenSlurMaxRise)
    expect(brokenSlurOpenRise(2, 'begin', ABOVE, LONG)).toBeLessThan(CURVE_PX.brokenSlurMaxRise)
  })

  it('⭐⭐ a SHORT fragment is FLAT, not a comma — the rise cannot outgrow its own length', () => {
    // A slur ending on the first note of a system has little room. A full space of drop across 0.6 of
    // one is a 60° tick; the slope clamp gives it 0.3, and it bounds the anti-tie floor too.
    const tiny = 0.6 * SP
    expect(brokenSlurOpenRise(4, 'end', ABOVE, tiny)).toBeCloseTo(tiny * 0.5, 6)
    expect(BROKEN_SLUR_MAX_SLOPE).toBe(0.5)
  })
})

describe('the SIDE flips the lean — his 2.25 sp correction, 2026-08-16', () => {
  const BASE = 1.5 * SP

  it('🚨 a slur BELOW a rising continuation does NOT drop its open end further', () => {
    // `rise` is measured along the slur's own side, so below the staff "more rise" means LOWER.
    // Gould's lean is toward the PITCH: a continuation that resumes higher pulls the begin half's
    // open end UP — which below the staff is inward, so it stays at the height the music gives it
    // instead of being driven down. Without the `-direction` factor it was driven down, and he
    // corrected that by hand by 2.25 sp before either of us knew why.
    expect(brokenSlurOpenRise(UP_A_SIXTH, 'begin', BELOW, LONG, BASE)).toBe(BASE)
    expect(brokenSlurOpenRise(UP_A_SIXTH, 'begin', ABOVE, LONG, BASE)).toBeGreaterThan(BASE)
  })

  it('…and mirrors again for a falling continuation', () => {
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', BELOW, LONG, BASE)).toBeGreaterThan(BASE)
    expect(brokenSlurOpenRise(DOWN_A_SIXTH, 'begin', ABOVE, LONG, BASE)).toBe(BASE)
  })
})
