/**
 * ⭐⭐ **LilyPond's one-point accidental** — his call, 2026-09-14 (`docs/research/slur-tie-research.md` §8.8).
 *
 * ⭐ Pure, so all of it runs in jsdom: the rule is a table plus one linear interpolation, and the
 * ink box it places the point on is the caller's (`EngravedAccidental.drawnInk()`).
 */
import { describe, it, expect } from 'vitest'
import { accidentalAvoidFraction, accidentalAvoidPoint } from './slurAccidentalPoint'

const ABOVE = -1
const BELOW = 1
/** A sharp-sized glyph: 1 sp wide, 1.4 sp up from a baseline at y = 100. */
const ink = { x: 200, y: 86, width: 10, height: 28 }

describe('where along its width an accidental is met', () => {
  it('⭐⭐ a FLAT at its LEFT — its bulk is low and left, so the curve meets the ascender', () => {
    expect(accidentalAvoidFraction('flat', ABOVE)).toBe(-1)
    expect(accidentalAvoidFraction('flat', BELOW)).toBe(-1)
    expect(accidentalAvoidFraction('doubleFlat', ABOVE)).toBe(-1)
  })

  it('⭐ a SHARP half-way into the half the slur comes from — and it FLIPS with the side', () => {
    expect(accidentalAvoidFraction('sharp', ABOVE)).toBe(0.5)
    expect(accidentalAvoidFraction('sharp', BELOW)).toBe(-0.5)
  })

  it('⭐ a NATURAL at the edge, and it flips too — its two ends are diagonal', () => {
    expect(accidentalAvoidFraction('natural', ABOVE)).toBe(-1)
    expect(accidentalAvoidFraction('natural', BELOW)).toBe(1)
  })

  it('⚠️ a DOUBLE SHARP is ours, not LilyPond’s — the centre, and marked as such', () => {
    expect(accidentalAvoidFraction('doubleSharp', ABOVE)).toBe(0)
  })

  it('⛔ a sign with no row answers null so the caller can fall back, ⛔ never a guess', () => {
    // A sign the table gains before this rule learns it — the type forbids one today, hence the cast.
    expect(accidentalAvoidFraction('quarterToneSharp' as never, ABOVE)).toBeNull()
  })

  it('🚨 the sign convention is OURS — LilyPond’s `dir_` is the opposite, converted once', () => {
    // Theirs: sharp = 0.5·dir_ with dir_ = +1 ABOVE. Ours: direction = −1 above ⇒ −0.5·direction.
    expect(accidentalAvoidFraction('sharp', ABOVE)).toBe(-0.5 * ABOVE)
    expect(accidentalAvoidFraction('natural', ABOVE)).toBe(ABOVE)
  })
})

describe('the point it puts under the curve', () => {
  it('⭐⭐ carries the glyph’s FULL reach — ⛔ the notch is expressed in the x, never in the y', () => {
    // The whole point of replacing `accidentalCutOut`: no allowance is subtracted from the height.
    expect(accidentalAvoidPoint(ink, 'sharp', ABOVE)!.y).toBe(ink.y)
    expect(accidentalAvoidPoint(ink, 'flat', BELOW)!.y).toBe(ink.y + ink.height)
  })

  it('⭐ a flat stands at the LEFT edge of its own ink', () => {
    expect(accidentalAvoidPoint(ink, 'flat', ABOVE)!.x).toBe(200)
  })

  it('⭐ a sharp under a slur ABOVE stands three quarters of the way across', () => {
    expect(accidentalAvoidPoint(ink, 'sharp', ABOVE)!.x).toBe(207.5)
  })

  it('⭐ it IS a point — zero width and zero height', () => {
    const p = accidentalAvoidPoint(ink, 'sharp', ABOVE)!
    expect([p.width, p.height]).toEqual([0, 0])
  })

  it('⛔ null for an unknown sign, and for ink that is not finite', () => {
    expect(accidentalAvoidPoint(ink, 'quarterToneSharp' as never, ABOVE)).toBeNull()
    expect(accidentalAvoidPoint({ ...ink, y: NaN }, 'sharp', ABOVE)).toBeNull()
  })
})
