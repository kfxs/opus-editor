import { describe, it, expect } from 'vitest'
import { limitSlurSlant } from './slurSlantLimit'
import { CURVE_PX, SLUR_MAX_SLANT_DEG } from './curveStyle'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

const SP = STAFF_SPACE_PX
const tiltOf = (span: number, rise: number) => Math.atan2(rise, span) * 180 / Math.PI

describe('limitSlurSlant — the ceiling (⚠️ HIS number, not an engraving rule)', () => {
  it('leaves an ordinary slur alone — almost every slur is inside the ceiling', () => {
    // A rising fifth over four spaces: 30°, half the ceiling.
    const r = limitSlurSlant({ x: 0, y: 40 }, { x: 4 * SP, y: 40 - 2.3 * SP })
    expect(r.fromY).toBe(40)
    expect(r.toY).toBe(40 - 2.3 * SP)
  })

  it('raises the LOWER end of a slur past 60° — Verovio moves an endpoint, never the curve', () => {
    // A two-space span with a five-space rise is 68°; the ceiling allows 3.46 spaces of it.
    const span = 2 * SP
    const r = limitSlurSlant({ x: 0, y: 5 * SP }, { x: span, y: 0 })
    expect(r.toY, 'the higher end never moves').toBe(0)
    expect(r.fromY).toBeLessThan(5 * SP)
    expect(tiltOf(span, r.fromY - r.toY)).toBeLessThan(69)
  })

  it('⚠️ …but never further from its own note than OUR cap allows', () => {
    // A near-vertical slur wants a huge lift; Verovio would give it one. Gould gives a MINIMUM
    // distance from the notehead and no maximum, so the cap here is ours and provisional.
    const r = limitSlurSlant({ x: 0, y: 20 * SP }, { x: 1 * SP, y: 0 })
    expect(20 * SP - r.fromY).toBe(CURVE_PX.slurSlantMaxTravel)
  })

  it('is symmetric — a falling slur raises its own lower end', () => {
    const r = limitSlurSlant({ x: 0, y: 0 }, { x: 2 * SP, y: 5 * SP })
    expect(r.fromY).toBe(0)
    expect(r.toY).toBeLessThan(5 * SP)
  })

  it('does nothing to a zero-length span', () => {
    const r = limitSlurSlant({ x: 10, y: 0 }, { x: 10, y: 50 })
    expect(r).toEqual({ fromY: 0, toY: 50 })
  })

  it('states the ceiling as the number he adopted', () => {
    expect(SLUR_MAX_SLANT_DEG).toBe(60)
  })
})
