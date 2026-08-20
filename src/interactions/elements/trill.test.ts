import { describe, it, expect, vi } from 'vitest'
import { TRILL_ELEMENT } from './trill'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which trill a press resolves to — the decision, on a stubbed registry.
 *
 * The registry is faked because the question is not where anything was DRAWN (that is
 * `e2e/trill.e2e.ts`, which needs a real font) but what the rule does with a set of candidate
 * bands: a press inside one is a hit, a press just outside it is still a hit, and a press well
 * clear of it is not.
 *
 * ⭐ The case worth having: a trill repeated on a continuation system registers TWICE, both entries
 * carrying the same id — so a press on EITHER band must resolve to the same ornament. That is the
 * whole reason the hit-test is a `find` over all entries rather than a lookup.
 */

/** One registered fragment: a band from (x0,y0) to (x1,y1), as `TrillRenderer` writes it. */
function band(id: string, x0: number, x1: number, y0 = 0, y1 = 12): ElementInfo {
  return {
    type: 'trill', id, measure: 1, staff: 0,
    bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    points: [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ],
  } as ElementInfo
}

function ctx(bands: ElementInfo[], x: number, y: number): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'trill' ? bands : []),
  } as unknown as ElementRegistry
  return { registry, x, y, closestElement: null } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps {
  return {
    pick: vi.fn(() => true as const),
    armTrillOffsetDrag: vi.fn(),
  } as unknown as ElementChainDeps
}

describe('TRILL_ELEMENT.hit', () => {
  it('selects the trill under the press', () => {
    const d = deps()
    expect(TRILL_ELEMENT.hit(ctx([band('t1', 100, 200)], 150, 6), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'trill', id: 't1' }, expect.any(Function))
  })

  it('⭐ a press INSIDE the band hits — the ornament is a solid run of glyphs, not two thin arms', () => {
    // The middle of a tall band is ~6px from any edge here, but a real trill's band is taller than
    // the pad, so proximity alone would leave its centre cold. This is the hairpin's difference.
    const d = deps()
    expect(TRILL_ELEMENT.hit(ctx([band('t1', 100, 400, 0, 40)], 250, 20), d)).toBe(true)
  })

  it('a press just OUTSIDE still hits — the pad, since a pointer cannot be aimed to the pixel', () => {
    expect(TRILL_ELEMENT.hit(ctx([band('t1', 100, 200)], 96, 6), deps())).toBe(true)
  })

  it('DECLINES a press well clear of the band', () => {
    const d = deps()
    expect(TRILL_ELEMENT.hit(ctx([band('t1', 100, 200)], 300, 6), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('⭐⭐ either FRAGMENT of a cross-system trill resolves to the SAME ornament', () => {
    // Two bands, one per system, both carrying id `t1` — what `TrillRenderer` registers when the
    // trill repeats its sign on a new system.
    const fragments = [band('t1', 500, 700, 0, 12), band('t1', 40, 300, 200, 212)]
    for (const [x, y] of [[600, 6], [100, 206]] as const) {
      const d = deps()
      expect(TRILL_ELEMENT.hit(ctx(fragments, x, y), d)).toBe(true)
      expect(d.pick).toHaveBeenCalledWith({ kind: 'trill', id: 't1' }, expect.any(Function))
    }
  })

  it('declines an entry with no registered outline rather than guessing from the bbox', () => {
    const naked = { type: 'trill', id: 't1', measure: 1, staff: 0, bbox: { x: 0, y: 0, width: 9, height: 9 } } as ElementInfo
    expect(TRILL_ELEMENT.hit(ctx([naked], 4, 4), deps())).toBe(false)
  })

  /**
   * ⭐⭐ **CLICK SELECTS, DRAG MOVES THE WHOLE ORNAMENT** (his ask, 2026-08-20) — the second argument
   * `pick` is handed is what a press turns into if it becomes a drag. ⚠️ A press on one of the
   * SQUARES never reaches here: `armTrillEndpointAt` is a pre-step in `MouseController`.
   */
  it('⭐ hands `pick` the BODY drag to arm if the press becomes one', () => {
    const d = deps()
    TRILL_ELEMENT.hit!(ctx([band('t1', 100, 300)], 200, 6), d)
    const arm = (d.pick as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as () => void
    arm()
    expect(d.armTrillOffsetDrag).toHaveBeenCalledWith('t1', 200, 6, undefined)
  })
})
