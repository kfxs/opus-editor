import { describe, it, expect } from 'vitest'
import { SPAN_MARK_MODEL, type SpanMarkKind } from './spanMarkModel'
import type { Score } from '@/types/music'

/**
 * ⭐ {@link SPAN_MARK_MODEL} — what a SCORE can say about a span mark, sitting beside this file.
 *
 * ⭐⭐ **The first case is the table's whole reason for existing**: every kind in the union has a row,
 * checked here as well as by `tsc`, because the compile-time half is invisible in a review and the
 * runtime half is what a reader can see fail. A kind added to `SpanMarkKind` without a row breaks the
 * build; a row that forgot a MEMBER breaks this.
 *
 * ⚠️ The rest is `offsetOf`'s one job: three questions (two ends and a shared vertical) answered off
 * the ENGRAVING COMPARTMENT, with **0 where the mark carries no nudge** — the engraver's own value,
 * ⛔ never `undefined`, so no caller has to spell the fallback a second time.
 */
describe('SPAN_MARK_MODEL', () => {
  const KINDS: SpanMarkKind[] = ['pedal', 'ottava', 'trill']

  /** A score whose only override is one span mark's stored nudge. */
  const scoreWith = (o: Record<string, unknown>): Score =>
    ({ id: 's', title: '', measures: [], engravingOverrides: { M1: [o] } } as unknown as Score)

  it('⭐⭐ is TOTAL — every kind in the union states a complete row', () => {
    expect(Object.keys(SPAN_MARK_MODEL).sort()).toEqual([...KINDS].sort())
    for (const kind of KINDS) {
      const spec = SPAN_MARK_MODEL[kind]
      expect(spec.noun, `${kind} names itself`).toBeTruthy()
      expect(spec.endNoun, `${kind} names its ends`).toBeTruthy()
      expect(['screen', 'outward'], `${kind} says how its vertical is signed`).toContain(spec.vertical)
      expect(typeof spec.offsetOf).toBe('function')
    }
  })

  it("⭐ reads each of the pedal's three numbers off the compartment", () => {
    const score = scoreWith({ kind: 'pedalOffset', startX: 1.5, endX: -2, y: 0.75 })
    const { offsetOf } = SPAN_MARK_MODEL.pedal
    expect(offsetOf(score, 'M1', 'start')).toBe(1.5)
    expect(offsetOf(score, 'M1', 'end')).toBe(-2)
    expect(offsetOf(score, 'M1', 'vertical')).toBe(0.75)
  })

  it('⚠️ answers 0 — the engraver\'s own value — for a mark with no override, and for a missing field', () => {
    const { offsetOf } = SPAN_MARK_MODEL.pedal
    const bare = scoreWith({ kind: 'pedalOffset', startX: 1 })
    expect(offsetOf(bare, 'M1', 'end'), 'field absent').toBe(0)
    expect(offsetOf(bare, 'M1', 'vertical'), 'field absent').toBe(0)
    expect(offsetOf(bare, 'NOPE', 'start'), 'no override at all').toBe(0)
  })

  it("⭐ reads the ottava's three numbers too — and its vertical is the `outward` one", () => {
    const score = scoreWith({ kind: 'ottavaOffset', startX: 0.5, endX: 3, outward: 2 })
    const { offsetOf } = SPAN_MARK_MODEL.ottava
    expect(offsetOf(score, 'M1', 'start')).toBe(0.5)
    expect(offsetOf(score, 'M1', 'end')).toBe(3)
    expect(offsetOf(score, 'M1', 'vertical'), 'reads `outward`, ⛔ not a `y`').toBe(2)
  })

  it('⭐⭐ the two kinds SPELL THEIR VERTICAL DIFFERENTLY, and the table is where that is said', () => {
    // ⛔ The pedal's is not `outward`: a pedalling is below the staff permanently, so the two
    // spellings would differ by a sign that never changes. The bracket's side is DERIVED from
    // `shift` and `x` flips it, so an outward number is what survives the flip.
    expect(SPAN_MARK_MODEL.pedal.vertical).toBe('screen')
    expect(SPAN_MARK_MODEL.ottava.vertical).toBe('outward')
    // ⭐ The trill's is `outward` for the PEDAL's reason (a sign and a wiggle read as one) rather
    // than the bracket's (a straight rule that could tilt) — but it can change SIDES, which is what
    // decides the spelling.
    expect(SPAN_MARK_MODEL.trill.vertical).toBe('outward')
  })
})
