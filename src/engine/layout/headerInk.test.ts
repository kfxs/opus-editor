/**
 * {@link headerInk} — the **key** row, and the one thing about it that could go wrong everywhere at
 * once.
 *
 * ⚠️ This file is not a full spec of the header (the clef and meter numbers are measurements, and
 * `e2e/spacing.e2e.ts` is what re-measures them in a browser). It exists for the row P3 added and
 * for the trap that row carries: **an empty signature must cost nothing at all**, in a file whose
 * every part is charged a `BETWEEN_PARTS`.
 */
import { describe, it, expect } from 'vitest'
import {
  HEADER_TO_NOTE, HEADER_TO_NOTE_AFTER_SIGN,
  cautionaryExtent, headerExtent, headerKeyRoom, headerToNoteGap,
} from './headerInk'
import {
  CLEF_TO_KEY_INK, KEY_TO_METER_INK, METER_PART_LEFT_AIR, keySignatureExtent,
} from './keySignatureLayout'
import { C_MAJOR, keyFromFifths } from '@/utils/keySignature'

const CLEF = { clef: 'treble' as const, small: false }
const METER = { numerator: 4, denominator: 4 }
const BETWEEN_PARTS = 1.0

describe('headerExtent — the key part', () => {
  it('🚨🚨 an EMPTY signature adds NOTHING — not its extent, and not a BETWEEN_PARTS', () => {
    const withoutKey = headerExtent({ clef: CLEF, meter: METER })
    expect(headerExtent({ clef: CLEF, key: C_MAJOR, meter: METER })).toBe(withoutKey)
    expect(headerExtent({ clef: CLEF, key: { alterations: [], mode: 'open' }, meter: METER })).toBe(withoutKey)
    // …which is the whole point: this is EVERY bar of EVERY score today.
    expect(headerExtent({ key: C_MAJOR })).toBe(0)
  })

  it('⭐ a signature costs its own ink plus its TWO OWN gaps, less the one it displaced', () => {
    const withoutKey = headerExtent({ clef: CLEF, meter: METER })
    const withKey = headerExtent({ clef: CLEF, key: keyFromFifths(2), meter: METER })
    // clef→key (0.82, LilyPond/MuseScore/Ross) + the ink + key→meter (1.15 of white, less the 0.52
    // of air the meter's own extent carries) − the clef→meter padding it replaced.
    expect(withKey - withoutKey).toBeCloseTo(
      CLEF_TO_KEY_INK + keySignatureExtent(keyFromFifths(2)) + (KEY_TO_METER_INK - METER_PART_LEFT_AIR) - BETWEEN_PARTS,
      5,
    )
    // ⭐ …and that is exactly what the drawing is told to shift the meter by.
    expect(withKey - withoutKey).toBeCloseTo(headerKeyRoom(keyFromFifths(2)), 5)
  })

  it('a signature ALONE is its ink and no padding at all — the FIRST part pays no gap', () => {
    expect(headerExtent({ key: keyFromFifths(3) })).toBeCloseTo(keySignatureExtent(keyFromFifths(3)), 5)
  })

  it('⭐ more sharps cost more room, and the same count of flats costs less', () => {
    const four = headerExtent({ clef: CLEF, key: keyFromFifths(4), meter: METER })
    const two = headerExtent({ clef: CLEF, key: keyFromFifths(2), meter: METER })
    expect(four).toBeGreaterThan(two)
    expect(headerExtent({ clef: CLEF, key: keyFromFifths(-4), meter: METER })).toBeLessThan(four)
  })
})

describe('cautionaryExtent — a key takes the METER\'s branch', () => {
  it('⭐⭐ is drawn NORMAL size, not cue size like the clef (Gerou & Lusk p. 52)', () => {
    // The clef's branch shrinks its glyph; the key's does not — so a cautionary signature costs
    // exactly what the same signature costs at a system head, plus the padding.
    expect(cautionaryExtent({ key: keyFromFifths(3) }))
      .toBeCloseTo(keySignatureExtent(keyFromFifths(3)) + BETWEEN_PARTS, 5)
  })

  it('an empty signature still costs a padding here — a caller that asks has decided to draw', () => {
    // ⚠️ Deliberately unlike `headerExtent`: this function answers "how much does THIS cautionary
    // cost", and the decision not to draw one is the caller's, made before it asks.
    expect(cautionaryExtent({ key: C_MAJOR })).toBe(BETWEEN_PARTS)
  })
})

/**
 * ⭐⭐ **DECISION D — the gap before the first note is keyed on what ENDS the header**
 * (Gould p. 42; `docs/header-spacing-research.md` §8 D, his call 2026-09-01).
 *
 * 🚨 There was NO coverage of this gap before the decision — the single `HEADER_TO_NOTE` was applied
 * everywhere and nothing asserted it, so changing it broke not one test. That absence is why this
 * block exists.
 */
describe('headerToNoteGap — 2½ after a sign, 2 after a meter', () => {
  it('⭐ a header ending in a TIME SIGNATURE earns 2', () => {
    expect(headerToNoteGap({ clef: CLEF, meter: METER })).toBe(HEADER_TO_NOTE)
    expect(headerToNoteGap({ clef: CLEF, key: keyFromFifths(3), meter: METER })).toBe(HEADER_TO_NOTE)
    expect(headerToNoteGap({ meter: METER })).toBe(HEADER_TO_NOTE)
  })

  it('⭐⭐ a header ending in a CLEF or a KEY SIGNATURE earns 2½ — the case we never had', () => {
    // Every system after the first opens this way: a clef, no meter.
    expect(headerToNoteGap({ clef: CLEF })).toBe(HEADER_TO_NOTE_AFTER_SIGN)
    expect(headerToNoteGap({ clef: CLEF, key: keyFromFifths(3) })).toBe(HEADER_TO_NOTE_AFTER_SIGN)
  })

  it('🚨 the two are genuinely different — the pair is the decision, not either half', () => {
    expect(headerToNoteGap({ clef: CLEF })).not.toBe(headerToNoteGap({ clef: CLEF, meter: METER }))
    expect(HEADER_TO_NOTE_AFTER_SIGN - HEADER_TO_NOTE).toBeCloseTo(0.5, 10)
  })

  it('⭐ …and Gould\'s own drawn examples bracket both numbers', () => {
    // She measures 2.60 / 2.59 after a clef and a key signature, 2.11 after a meter (§3 of the
    // research). Pinned as a RANGE, because a plate is measured and not stated.
    expect(HEADER_TO_NOTE_AFTER_SIGN).toBeGreaterThan(2.11)
    expect(HEADER_TO_NOTE_AFTER_SIGN).toBeLessThanOrEqual(2.60)
    expect(HEADER_TO_NOTE).toBeLessThanOrEqual(2.11)
  })
})
