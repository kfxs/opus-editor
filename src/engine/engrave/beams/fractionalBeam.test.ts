/**
 * ⭐⭐ **THE FRACTIONAL BEAM'S SIDE — the books, as assertions** (`docs/beam-hook-research.md`).
 *
 * ⭐ The two headline cases are **Gould's own ⅜ pair, p. 157**: the same three note-values, drawn
 * with OPPOSITE fractional beams. They are the whole reason P4c exists, and they are the pair the
 * incumbent rule cannot tell apart — see `EngravedBeam.fractionalBeam.test.ts` for the same two bars
 * measured through a real render.
 */
import { describe, it, expect } from 'vitest'
import {
  ACTIVE_FRACTIONAL_BEAM_SIDE_RULE,
  coversHalfOfDivision,
  fractionalBeamDivision,
  fractionalBeamSide,
  fractionalBeamSides,
} from './fractionalBeam'
import { fracCreate as frac } from '@/utils/fraction'
import { durationToFraction } from '@/utils/durations'
import type { NoteDuration } from '@/types/music'

/** A note's place, built the way the renderer builds it. */
const place = (start: [number, number], duration: NoteDuration, dots = 0) => ({
  start: frac(...start),
  length: durationToFraction(duration, dots),
  division: fractionalBeamDivision(duration)!,
})

describe('the division a note is a fraction of', () => {
  it('is one beam level coarser than the note — ⛔ dots ignored', () => {
    expect(fractionalBeamDivision('16')).toEqual(frac(1, 2)) // a quaver
    expect(fractionalBeamDivision('32')).toEqual(frac(1, 4)) // a semiquaver
    expect(fractionalBeamDivision('8')).toEqual(frac(1, 1)) // a crotchet
  })

  it('⭐ …so an undotted note covers exactly HALF of it — which is why the rule needs no tie-break', () => {
    for (const d of ['8', '16', '32'] as NoteDuration[]) {
      expect(coversHalfOfDivision(place([0, 1], d)), d).toBe(true)
    }
  })

  it('is null for a value with nothing coarser to be a fraction of', () => {
    expect(fractionalBeamDivision('w')).toBeNull()
  })
})

describe("⭐⭐ Gould p. 157 — the ⅜ pair, which is the whole rule in one figure", () => {
  // Bar 1: ♪. ♬ ♪ — the semiquaver is the 4th, COMPLETING the second quaver.
  it('a semiquaver that ENDS on a quaver division points LEFT', () => {
    expect(fractionalBeamSide(place([3, 4], '16'))).toBe('left')
  })

  // Bar 2: ♪ ♬ ♪. — the semiquaver is the 3rd, STARTING the second quaver.
  it('a semiquaver that STARTS on a quaver division points RIGHT', () => {
    expect(fractionalBeamSide(place([1, 2], '16'))).toBe('right')
  })

  it('🚨 the two differ, and that is the defect P4c fixes', () => {
    expect(fractionalBeamSide(place([3, 4], '16'))).not.toBe(fractionalBeamSide(place([1, 2], '16')))
  })
})

describe('⭐ Gould p. 157 — the crotchet-beat figure (`♪. ♬ ♪. ♬`)', () => {
  it('both semiquavers complete their own beat, so both point LEFT', () => {
    expect(fractionalBeamSide(place([3, 4], '16'))).toBe('left')
    expect(fractionalBeamSide(place([7, 4], '16'))).toBe('left')
  })
})

describe('demisemiquavers use the semiquaver grid', () => {
  it('one starting a semiquaver points right, one completing it points left', () => {
    expect(fractionalBeamSide(place([1, 4], '32'))).toBe('right')
    expect(fractionalBeamSide(place([3, 8], '32'))).toBe('left')
  })
})

describe('⛔ where the rule has NO opinion it says so, rather than guessing', () => {
  it('abstains when neither end lands on a division', () => {
    // The MIDDLE note of a semiquaver triplet: spans 1/6 → 1/3, and the quaver grid is 1/2.
    expect(
      fractionalBeamSide({ start: frac(1, 6), length: frac(1, 6), division: frac(1, 2) }),
    ).toBeNull()
  })

  it('⭐ …but it still answers a tuplet note that DOES land on one, which is the rule degrading well', () => {
    // The LAST of that triplet ends exactly on the quaver line, so it completes it: left.
    expect(
      fractionalBeamSide({ start: frac(1, 3), length: frac(1, 6), division: frac(1, 2) }),
    ).toBe('left')
  })

  it('the `neighbours` row abstains ALWAYS — it is "let VexFlow decide", not a rival rule', () => {
    expect(fractionalBeamSide(place([1, 2], '16'), 'neighbours')).toBeNull()
    expect(fractionalBeamSide(place([3, 4], '16'), 'neighbours')).toBeNull()
  })

  it('⭐ and `beat` is what ships', () => {
    expect(ACTIVE_FRACTIONAL_BEAM_SIDE_RULE).toBe('beat')
  })
})

describe('⚠️ a whole group — the FIRST and LAST slots are never ours to answer', () => {
  const bar2 = [
    { start: frac(0, 1), duration: '8' as NoteDuration },
    { start: frac(1, 2), duration: '16' as NoteDuration },
    { start: frac(3, 4), duration: '8' as NoteDuration, dots: 1 },
  ]

  it('answers only the interior note (containment forces the other two — Ross p. 124)', () => {
    expect(fractionalBeamSides(bar2)).toEqual([null, 'right', null])
  })

  it('⛔ a rest carries no fractional beam even when the beam runs over it', () => {
    const withRest = [
      { start: frac(0, 1), duration: '8' as NoteDuration },
      { start: frac(1, 2), duration: '16' as NoteDuration, isRest: true },
      { start: frac(3, 4), duration: '8' as NoteDuration, dots: 1 },
    ]
    expect(fractionalBeamSides(withRest)).toEqual([null, null, null])
  })

  it('⚠️ a tuplet is judged by its SOUNDING length, not its written one', () => {
    const triplet = [
      { start: frac(0, 1), duration: '8' as NoteDuration },
      { start: frac(1, 6), duration: '16' as NoteDuration, actualLength: frac(1, 6) },
      { start: frac(1, 2), duration: '8' as NoteDuration },
    ]
    // Written, that semiquaver would span 1/6 → 5/12; sounding, 1/6 → 1/3. Neither is on the
    // quaver grid, so the rule abstains — ⛔ but it must abstain for the RIGHT reason.
    expect(fractionalBeamSides(triplet)).toEqual([null, null, null])
    // …and with the written length it would have abstained too, so break-test the distinction on a
    // case where the two disagree: sounding 1/4 lands on no quaver line, written 3/8 lands on none
    // either — the pair that separates them is a dotted note, below.
    expect(
      fractionalBeamSides([
        { start: frac(0, 1), duration: '8' as NoteDuration },
        { start: frac(1, 4), duration: '16' as NoteDuration, dots: 1, actualLength: frac(1, 4) },
        { start: frac(1, 2), duration: '8' as NoteDuration },
      ]),
    ).toEqual([null, 'left', null]) // sounding 1/4 → 1/2, completing the quaver
  })
})
