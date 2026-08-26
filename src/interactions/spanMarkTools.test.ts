import { describe, it, expect } from 'vitest'
import { SPAN_MARK_TOOLS } from './spanMarkTools'
import { SPAN_MARK_MODEL, type SpanMarkKind } from '../engine/models/spanMarkModel'

/**
 * ⭐⭐ **{@link SPAN_MARK_TOOLS} IS TOTAL, AND KEYED THE SAME WAY {@link SPAN_MARK_MODEL} IS** — the
 * span-mark plan's `[A4]`, the clause it says not to trade away.
 *
 * A registry earns its keep only when a kind that forgot its row cannot build. `tsc` is what enforces
 * that; this spec is the half a READER can see fail, and it is the one that notices the *other*
 * mistake — the two tables drifting apart, so that a kind the editor can drive is a kind the score
 * cannot describe (or the reverse).
 *
 * ⚠️ ⛔ If this ever has to become a `Partial`, an array or an index signature, the abstraction is
 * wrong and the plan says to STOP rather than work around it. A member only some kinds need is an
 * OPTIONAL member on the spec — the table stays total.
 *
 * ⭐ What each row DOES is pinned where it is driven: `./spanMarkKeys.test.ts`,
 * `./spanMarkStamp.pedal.test.ts`, `./SpanMarkGeometryController.pedal.test.ts`.
 */
describe('SPAN_MARK_TOOLS', () => {
  /** Every member the drivers reach for — a hand-written list is exactly what rots, so this is
   *  checked against a row rather than trusted (`reference_a_false_warning_teaches_readers_to_skip`). */
  const MEMBERS = [
    'armedStamp', 'onGeometrySet', 'nudgeEnd', 'nudgeWhole', 'walkEnd', 'walkWhole',
    'resetEnd', 'resetWhole', 'cycleEnd', 'verticalSign',
  ] as const

  it('⭐⭐ has a COMPLETE row for every kind — no member missing, none extra', () => {
    for (const kind of Object.keys(SPAN_MARK_TOOLS) as SpanMarkKind[]) {
      expect(Object.keys(SPAN_MARK_TOOLS[kind]).sort(), kind).toEqual([...MEMBERS].sort())
      for (const member of MEMBERS) {
        expect(typeof SPAN_MARK_TOOLS[kind][member], `${kind}.${member}`).toBe('function')
      }
    }
  })

  it('⭐⭐ is keyed by the SAME union as the model table — the two halves cannot drift', () => {
    expect(Object.keys(SPAN_MARK_TOOLS).sort()).toEqual(Object.keys(SPAN_MARK_MODEL).sort())
  })
})
