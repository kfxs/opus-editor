/**
 * **The sign a boundary carries** — precedence read off the model, and which signs may carry wings.
 * What the sign is made of is `layout/barlineSign.test.ts`, which also holds {@link wingsAllowed}'s
 * table to the drawn parts.
 */
import { describe, it, expect } from 'vitest'
import { signAtBoundary, wingsAllowed } from './boundarySign'
import type { Measure } from '@/types/music'

/** A bar carrying only the barline statements under test — nothing else here reads a measure. */
function bar(fields: Partial<Measure> = {}): Measure {
  return { id: 'm', number: 1, slots: [], timeSignature: { numerator: 4, denominator: 4 }, tuplets: [], ...fields }
}

describe('signAtBoundary — ⭐⭐ a boundary carries ONE sign', () => {
  it('a bar ends here and said nothing: the plain single line', () => {
    expect(signAtBoundary(bar(), bar())).toBe('plain')
  })

  it('nothing ends here: NO sign — a system\'s opening edge is the stave\'s own begin bar', () => {
    expect(signAtBoundary(undefined, bar())).toBeNull()
  })

  it('a final barline, when that is what the bar stores', () => {
    expect(signAtBoundary(bar({ barline: { style: 'final' } }), bar())).toBe('final')
  })

  it('an end repeat belongs to the bar that CLOSES it', () => {
    expect(signAtBoundary(bar({ repeatEnd: {} }), bar())).toBe('repeatEnd')
  })

  it('a start repeat belongs to the bar that OPENS it — and suppresses the line before it', () => {
    // 🚨 The whole reason this is a score-level pass: the left bar drew a plain line here until its
    // neighbour's field was consulted, and no per-measure render key can consult it.
    expect(signAtBoundary(bar(), bar({ repeatStart: {} }))).toBe('repeatStart')
  })

  it('⭐ back-to-back: two model facts, ONE combined drawing', () => {
    expect(signAtBoundary(bar({ repeatEnd: {} }), bar({ repeatStart: {} }))).toBe('repeatBoth')
  })

  it('⭐ a bar carrying BOTH a final style and an end repeat draws the repeat — it subsumes it', () => {
    // Gould p. 39: a repeat "uses the final double barline design together with repeat dots", so the
    // repeat IS the final bar plus something. Drawing both would be drawing the thin+thick twice.
    expect(signAtBoundary(bar({ barline: { style: 'final' }, repeatEnd: {} }), bar())).toBe('repeatEnd')
  })

  it('⚠️ the neighbour is passed as ABSENT when it is on another system — so nothing is suppressed', () => {
    // The caller drops a neighbour that is not on this system, which is how the system condition
    // stays local to this function. A repeat opening the NEXT line leaves this line's own last
    // barline standing, which is what all three engines do.
    expect(signAtBoundary(bar(), undefined)).toBe('plain')
    expect(signAtBoundary(bar({ repeatEnd: {} }), undefined)).toBe('repeatEnd')
  })
})

describe('wingsAllowed — ⭐⭐ only a sign with a THICK line can carry wings', () => {
  it('the three the user asked for, and the back-to-back form with them', () => {
    // His rule, 2026-08-26: *"this is for open repeat, for end repeat and for final; other barlines
    // do not allow wings."* ⚠️ He asked for the FINAL, where MuseScore wings only the repeats.
    for (const kind of ['final', 'repeatEnd', 'repeatStart', 'repeatBoth'] as const) {
      expect(wingsAllowed(kind), kind).toBe(true)
    }
  })

  it('⛔ …and not a bare line, which has nothing to flare', () => {
    expect(wingsAllowed('plain')).toBe(false)
    expect(wingsAllowed('invisible')).toBe(false)
  })
})
