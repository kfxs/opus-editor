import { describe, it, expect } from 'vitest'
import { trillAttacks, TRILL_PERIOD_SECONDS } from './trillAttacks'
import { midiToSpelling, pitchToMidi } from '@/utils/pitchSpelling'

/**
 * {@link trillAttacks} — the alternation itself, over two opaque pitches.
 *
 * ⭐ The chapter worth having is the LAST attack: a trill that overhangs its note collides with what
 * follows, and the ear hears the overhang as a wrong note rather than as a long trill. Everything
 * else here is arithmetic, and cheap to pin because the module takes no score.
 */
describe('trillAttacks', () => {
  // ⭐ The module never reads a pitch — it alternates between two opaque values — so the fixture
  //   states them as spellings and the assertions read them back through the interpret step's
  //   own conversion. C4 and D4.
  const base = {
    mainPitch: midiToSpelling(60), auxPitch: midiToSpelling(62), startBeats: 0, periodBeats: 0.25,
  }

  it('alternates main → auxiliary → main, starting on the MAIN note', () => {
    const out = trillAttacks({ ...base, durationBeats: 1 })
    expect(out.map(a => pitchToMidi(a.pitch))).toEqual([60, 62, 60, 62])
  })

  it('lays the attacks end to end, one period apart', () => {
    const out = trillAttacks({ ...base, durationBeats: 1 })
    expect(out.map(a => a.startBeats)).toEqual([0, 0.25, 0.5, 0.75])
    expect(out.every(a => a.durationBeats === 0.25)).toBe(true)
  })

  it('⭐ CLAMPS the last attack to the end of the span — a trill never overhangs its note', () => {
    const out = trillAttacks({ ...base, durationBeats: 0.6 })
    expect(out).toHaveLength(3)
    const last = out[out.length - 1]
    expect(last.startBeats + last.durationBeats).toBeCloseTo(0.6, 10)
  })

  it('does not gain a zero-length attack when the span divides exactly', () => {
    // The floating-point case the epsilon exists for: 4 × 0.25 is exactly 1.
    expect(trillAttacks({ ...base, durationBeats: 1 })).toHaveLength(4)
  })

  it('⭐ the RATE does not depend on the note\'s length — only the COUNT does', () => {
    // A trill on a semibreve and one on a quaver run at the same speed; this is the whole reason
    // the period is physical rather than a subdivision of the written value.
    const short = trillAttacks({ ...base, durationBeats: 0.5 })
    const long = trillAttacks({ ...base, durationBeats: 4 })
    expect(short[1].startBeats - short[0].startBeats)
      .toBeCloseTo(long[1].startBeats - long[0].startBeats, 10)
    expect(long.length).toBeGreaterThan(short.length)
  })

  it('applies the articulation length factor per attack — a staccato trill is staccato', () => {
    const out = trillAttacks({ ...base, durationBeats: 1, durationFactor: 0.5 })
    expect(out.every(a => a.durationBeats === 0.125)).toBe(true)
    // …but the ONSETS are untouched: staccato shortens notes, it does not speed the trill up.
    expect(out.map(a => a.startBeats)).toEqual([0, 0.25, 0.5, 0.75])
  })

  it('makes nothing from a non-positive span or period', () => {
    expect(trillAttacks({ ...base, durationBeats: 0 })).toEqual([])
    expect(trillAttacks({ ...base, durationBeats: -1 })).toEqual([])
    expect(trillAttacks({ ...base, durationBeats: 1, periodBeats: 0 })).toEqual([])
  })

  it('a span shorter than one period still sounds ONCE, on the main note', () => {
    const out = trillAttacks({ ...base, durationBeats: 0.1 })
    expect(out).toHaveLength(1)
    expect(pitchToMidi(out[0].pitch)).toBe(60)
    expect(out[0].durationBeats).toBeCloseTo(0.1, 10)
  })

  it('the period constant is a SPEED in seconds, in the range a player can actually trill', () => {
    // ⚠️ By ear, not derived — pinned only so a careless edit has to be deliberate. A real trill is
    // roughly 8–14 notes a second; anything outside that is a different ornament.
    expect(1 / TRILL_PERIOD_SECONDS).toBeGreaterThan(7)
    expect(1 / TRILL_PERIOD_SECONDS).toBeLessThan(15)
  })
})
