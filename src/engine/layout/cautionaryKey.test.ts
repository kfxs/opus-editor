import { describe, it, expect } from 'vitest'
import {
  BARLINE_TO_CAUTIONARY_KEY_INK, CAUTIONARY_KEY_TO_LINE_END, cautionaryKeyAt, cautionaryKeyRoom,
} from './cautionaryKey'
import { keySignatureExtent } from './keySignatureLayout'
import { C_MAJOR, keyFromFifths, type StaffKeys } from '@/utils/keySignature'
import type { KeySignature } from '@/types/music'

/**
 * The cautionary key signature at a system break — P6 of docs/key-signature-plan.md.
 *
 * Subject: {@link cautionaryKey}, sitting beside this file. ⚠️ The WALK is faked (a `StaffKeys` is two
 * maps, and building one by hand is what lets a two-staff break be stated in four lines); what is
 * being tested is the DECISION and the ROOM, neither of which needs a score. Where the ink lands is
 * the browser suite's — `e2e/keySignature.e2e.ts` measures it against Gould's own figure.
 */
function walk(entries: Record<number, KeySignature>): StaffKeys {
  const opening = new Map<number, KeySignature>()
  const ending = new Map<number, KeySignature>()
  for (const [n, key] of Object.entries(entries)) {
    opening.set(Number(n), key)
    ending.set(Number(n), key)
  }
  return { opening, ending }
}

const G = keyFromFifths(1)
const E_FLAT = keyFromFifths(-3)

describe('cautionaryKeyAt', () => {
  it('answers NULL when no staff changes key across the break — nothing to warn about', () => {
    const keys = new Map([[undefined, walk({ 9: G, 10: G })]])
    expect(cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)).toBeNull()
  })

  it('⭐ gives the row the change would draw, on the staff that changes', () => {
    const keys = new Map([[undefined, walk({ 9: G, 10: E_FLAT })]])
    const plan = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)!
    expect(plan.rows[0]?.alterations.map(a => a.step)).toEqual(['B', 'E', 'A'])
  })

  it('⭐⭐ carries the CANCELLING NATURALS when the new key is C major — Gould p. 93', () => {
    // *"the cancelling naturals and the new key signature go at the end of the first system"* — with
    // an empty new signature the naturals are the whole of what is drawn, and without them the break
    // would announce nothing at all.
    const keys = new Map([[undefined, walk({ 9: E_FLAT, 10: C_MAJOR })]])
    const plan = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)!
    expect(plan.rows[0]?.alterations.every(a => a.alter === 0)).toBe(true)
    expect(plan.rows[0]?.alterations).toHaveLength(3)
  })

  it('⭐ is PER STAFF — one hand may change while the other does not', () => {
    const keys = new Map([
      ['top', walk({ 9: G, 10: E_FLAT })],
      ['bottom', walk({ 9: G, 10: G })],
    ])
    const plan = cautionaryKeyAt(keys, ['top', 'bottom'], () => 'treble', 9, 10)!
    expect(plan.rows[0], 'the hand that changes').toBeDefined()
    expect(plan.rows[1], 'the hand that does not').toBeUndefined()
  })

  it('⭐ the LINE pays once, for the WIDEST row — the courtesies sit at one x', () => {
    const keys = new Map([
      ['top', walk({ 9: C_MAJOR, 10: keyFromFifths(7) })],   // seven sharps
      ['bottom', walk({ 9: C_MAJOR, 10: G })],               // one
    ])
    const plan = cautionaryKeyAt(keys, ['top', 'bottom'], () => 'treble', 9, 10)!
    const widest = keySignatureExtent(keyFromFifths(7))
    expect(plan.room).toBeCloseTo(BARLINE_TO_CAUTIONARY_KEY_INK + widest + CAUTIONARY_KEY_TO_LINE_END, 5)
  })

  it('the room is the two measured gaps plus the ink, converted at the staff space', () => {
    const keys = new Map([[undefined, walk({ 9: C_MAJOR, 10: G })]])
    const plan = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)!
    // ⭐ The barline-side gap is Gould's p. 93 figure, measured (0.75 sp); the TRAILING gap is 0.5,
    //   which all three engines state in source (MuseScore `systemTrailerRightMargin`, LilyPond's
    //   `right-edge` extra-space, Verovio's `rightMarginKeySig`) — his call of 2026-08-28 (*"i think
    //   we dont need that much space"*) and the engines landing on the same answer.
    expect(cautionaryKeyRoom(plan, 10)).toBeCloseTo(plan.room * 10, 5)
    // ⭐ 0.75 — HIS choice, deliberately between Gould's measured 1.9 and the three engines' 0.5
    //   (*"a good compromise between gould and what the engines say"*). ⛔ Neither source moves it
    //   alone; a change needs his eye.
    expect(CAUTIONARY_KEY_TO_LINE_END, 'the chosen middle').toBe(0.75)
    expect(plan.room).toBeGreaterThan(BARLINE_TO_CAUTIONARY_KEY_INK + CAUTIONARY_KEY_TO_LINE_END)
  })

  it('⛔ is UNCONDITIONAL — the clef’s and the meter’s courtesies need an authored allowance, this does not', () => {
    // Gould p. 93 offers no option to omit, MOLA requires it, Dorico cannot switch it off (plan §4.2).
    // ⚠️ What a test can show is that a bare change across a break — nothing authored anywhere, no
    // score even passed in — still produces the courtesy. That the function takes no ALLOWANCE
    // argument is a claim about its shape, kept by the module's own note and by review.
    const keys = new Map([[undefined, walk({ 9: G, 10: E_FLAT })]])
    expect(cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)).not.toBeNull()
  })
})

describe('the AUTHORED trailing gap (his ask, 2026-08-28)', () => {
  it('⭐ REPLACES the default rather than adding to it — the hairpin aperture’s rule', () => {
    const keys = new Map([[undefined, walk({ 9: C_MAJOR, 10: G })]])
    const auto = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10)!
    const authored = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10, 3)!
    expect(authored.trailing).toBe(3)
    expect(authored.room - auto.room).toBeCloseTo(3 - CAUTIONARY_KEY_TO_LINE_END, 5)
  })

  it('🚨 a gap of ZERO is a real answer, not "absent" — `??`, never `||`', () => {
    const keys = new Map([[undefined, walk({ 9: C_MAJOR, 10: G })]])
    const plan = cautionaryKeyAt(keys, [undefined], () => 'treble', 9, 10, 0)!
    expect(plan.trailing, 'no tail at all, because that is what was asked for').toBe(0)
  })
})
