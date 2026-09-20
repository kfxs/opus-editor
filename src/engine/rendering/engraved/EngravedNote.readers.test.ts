// @vitest-environment jsdom
/**
 * The note's own readers and writers (S12j-d2) — `StaveNote` / `StemmableNote`, transcribed. ⚠️ That the
 * page is unchanged was proved by the broad and the tuplet A/Bs (`docs/history/vexflow-removal-map.md` S12j-d2).
 * Pinned here is the arithmetic, and the row table they read.
 */
import { describe, it, expect } from 'vitest'
import { EngravedNote } from './EngravedNote'
import { EngravedStave } from './EngravedStave'
import { standOn } from '../staff/staveFrame'

const note = (keys: string[], duration: string, stem = 1) => {
  const n = new EngravedNote({ keys, duration })
  n.setStemDirection(stem)
  return n
}

describe('EngravedNote — readers and writers (S12j-d2)', () => {
  it('reads its duration\'s row: a rest is a rest, a whole note has no stem, an eighth a flag and one beam', () => {
    expect(note(['b/4'], 'qr').isRest()).toBe(true)
    expect(note(['c/5'], 'w').hasStem()).toBe(false)
    const eighth = note(['c/5'], '8')
    expect([eighth.hasFlag(), eighth.getBeamCount()]).toEqual([true, 1])
    expect(note(['c/5'], 'q').getBeamCount()).toBeUndefined()
  })

  it('⭐ its lines: the lowest and highest key, a chord\'s rest line is its middle', () => {
    const chord = note(['c/5', 'g/5'], 'q')
    expect([chord.getLineNumber(), chord.getLineNumber(true)]).toEqual([3.5, 5.5])
    expect(chord.getLineForRest()).toBe(4.5)
  })

  it('⭐ picks the stem direction by the keys\' middle against the middle line', () => {
    expect(note(['c/4'], 'q').calculateOptimalStemDirection()).toBe(1)
    expect(note(['a/5'], 'q').calculateOptimalStemDirection()).toBe(-1)
  })

  it('⭐ a stem set to a length is that long; a stem pointing its optimal way lengthens past an octave', () => {
    expect(note(['c/5'], 'q', -1).setStemLength(50).getStemLength()).toBe(50)
    const high = standOn(note(['a/6'], 'q', -1), new EngravedStave(0, 0, 200)) // A6 stands on line 9.5
    expect(high.getStemLength()).toBe(35 + (9.5 - 3 - 3.5) * 10)
  })
})
