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
  const KINDS: SpanMarkKind[] = ['pedal']

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

  it('⭐⭐ says the pedal\'s vertical is SCREEN-signed — the family\'s odd one out', () => {
    // ⛔ Not `outward`: a pedalling is below the staff permanently, so the two spellings would differ
    // by a sign that never changes. The bracket and the trill answer `outward` when they join.
    expect(SPAN_MARK_MODEL.pedal.vertical).toBe('screen')
  })
})
