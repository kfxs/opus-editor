import { describe, it, expect, vi } from 'vitest'
import { OTTAVA_ELEMENT } from './ottava'
import { ELEMENT_HIT_ORDER } from './chain'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which octave line a press resolves to — the decision, on a stubbed registry.
 *
 * The registry is faked because the question is not where anything was DRAWN (that is
 * `e2e/ottava.e2e.ts`, which needs a real font) but what the rule does with a set of candidate
 * bands. `TRILL_ELEMENT`'s spec is the template; what is different here is worth its own file:
 *
 * ⭐ **The bracket's ink is a numeral and a DASHED line, so most of its band is literally empty.**
 * Containment has to answer, not proximity — a rule that only measured distance to drawn ink would
 * make the gaps between dashes cold, and nothing tells the reader where those are.
 *
 * ⭐ **A line crossing a system break registers twice**, both entries carrying the same id, so a
 * press on either fragment resolves to the same line. That is why the hit-test is a `find`.
 */

/** One registered fragment: a band from (x0,y0) to (x1,y1), as `OttavaRenderer` writes it. */
function band(id: string, x0: number, x1: number, y0 = 0, y1 = 12): ElementInfo {
  return {
    type: 'ottava', id, measure: 1, staff: 0,
    bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    points: [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ],
  } as ElementInfo
}

function ctx(bands: ElementInfo[], x: number, y: number): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'ottava' ? bands : []),
  } as unknown as ElementRegistry
  return { registry, x, y, closestElement: null } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps {
  return { pick: vi.fn(() => true as const) } as unknown as ElementChainDeps
}

describe('OTTAVA_ELEMENT.hit', () => {
  it('selects the octave line under the press', () => {
    const d = deps()
    expect(OTTAVA_ELEMENT.hit(ctx([band('o1', 100, 200)], 150, 6), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'ottava', id: 'o1' })
  })

  it('⭐ a press in a GAP BETWEEN DASHES hits — the band is the target, not the ink', () => {
    // The one thing this rule must get right that the trill's does not have to. A dashed line is
    // mostly not there; asking the pointer to find the ink would make the bracket feel broken.
    const d = deps()
    expect(OTTAVA_ELEMENT.hit(ctx([band('o1', 100, 400, 0, 40)], 250, 20), d)).toBe(true)
  })

  it('a press just OUTSIDE still hits — the pad, since a pointer cannot be aimed to the pixel', () => {
    const d = deps()
    expect(OTTAVA_ELEMENT.hit(ctx([band('o1', 100, 200)], 204, 6), d)).toBe(true)
  })

  it('a press well clear of it does not', () => {
    const d = deps()
    expect(OTTAVA_ELEMENT.hit(ctx([band('o1', 100, 200)], 400, 6), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('⭐ EITHER fragment of a split line resolves to the same octave line', () => {
    // Both bands carry one id: the bracket on system 1 and its parenthesised continuation on
    // system 2 are one statement, and clicking the second must not select "nothing".
    const first = band('o1', 700, 900, 0, 12)
    const second = band('o1', 50, 200, 300, 312)
    for (const [x, y] of [[800, 6], [120, 306]] as const) {
      const d = deps()
      expect(OTTAVA_ELEMENT.hit(ctx([first, second], x, y), d)).toBe(true)
      expect(d.pick).toHaveBeenCalledWith({ kind: 'ottava', id: 'o1' })
    }
  })

  it('ignores an entry with no outline rather than guessing from the bbox', () => {
    const d = deps()
    const noPoints = { ...band('o1', 100, 200), points: undefined } as unknown as ElementInfo
    expect(OTTAVA_ELEMENT.hit(ctx([noPoints], 150, 6), d)).toBe(false)
  })
})

/**
 * ⭐⭐ **The chain position, asserted here as well as in `chain.test.ts`** — because for this pair it
 * is not a tie-break that will never fire. An 8va is drawn DIRECTLY ABOVE the trill it clears (the
 * ladder puts it there), so the two bands are stacked by construction and a press near the trill is
 * inside the ottava's padded band. The inner mark must win, or trills under an octave line become
 * unselectable.
 */
describe('the ottava sits AFTER the trill in the press chain', () => {
  it('trill first, ottava immediately after', () => {
    const kinds = ELEMENT_HIT_ORDER.map(s => s.kind)
    expect(kinds.indexOf('ottava')).toBe(kinds.indexOf('trill') + 1)
  })
})
