import { describe, it, expect } from 'vitest'
import { flattenRegion, relayEvents } from './rebar'
import { getMeterInfo } from './meter'
import { fracCreate } from './fraction'
import type { Chord, Measure, TimeSignature } from '@/types/music'

/**
 * Subject: `./rebar` — what the relay does with a chord's BRACKETED graces when it splits the note
 * (docs/plans/bracketed-grace-plan.md §1): the graces' rule for the graces' reason — what leads into
 * the attack rides the FIRST piece, what follows the note (the trill note, a bend's target) the LAST.
 */
const ts = (n: number, d: number): TimeSignature => ({ numerator: n, denominator: d })
const F = (n: number, d = 1) => fracCreate(n, d)
const p = (id: string, step: 'C' | 'D' | 'E' | 'B', octave = 4) => ({ id, step, alter: 0 as const, octave })

/** A half note on beat 3 of a 4/4 bar, laid out again with its start moved to beat 4 — so it splits. */
function splitHalf(chord: Partial<Chord>) {
  const measure: Measure = {
    id: 'm1', number: 1, timeSignature: ts(4, 4), tuplets: [],
    slots: [
      { id: 'r', type: 'rest', beat: F(0), duration: 'h', dots: 1, measure: 1 },
      { id: 'c', type: 'chord', beat: F(3), duration: 'h', measure: 1, notes: [p('n', 'E')], ...chord } as Chord,
    ],
  }
  const events = flattenRegion([measure], 0, { keepRests: true })
  const bars = relayEvents(events, getMeterInfo(ts(4, 4)), { targetBars: 2, bounded: false, respell: 'faithful' })
  return bars.flat().filter(piece => !piece.isRest)
}

describe('rebar — bracketed graces across a split', () => {
  it('BEFORE on the FIRST piece, AFTER on the LAST, fresh ids on both', () => {
    const pieces = splitHalf({
      bracketedBefore: [{ pitches: [p('b', 'B', 3)], duration: 'q' }],
      bracketedAfter: [{ pitches: [p('a', 'D', 5)], duration: 'q' }],
    })
    expect(pieces).toHaveLength(2)
    expect(pieces[0].bracketedBefore?.[0].pitches[0]).toMatchObject({ step: 'B', octave: 3 })
    expect(pieces[0].bracketedBefore![0].pitches[0].id).not.toBe('b')
    expect(pieces[0].bracketedAfter).toBeUndefined()
    expect(pieces[1].bracketedBefore).toBeUndefined()
    expect(pieces[1].bracketedAfter?.[0].pitches[0]).toMatchObject({ step: 'D', octave: 5 })
  })
})
