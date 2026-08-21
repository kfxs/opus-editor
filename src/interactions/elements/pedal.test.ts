import { describe, it, expect, vi } from 'vitest'
import { PEDAL_ELEMENT } from './pedal'
import { ELEMENT_HIT_ORDER } from './chain'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which pedal a press resolves to — the decision, on a stubbed registry.
 *
 * The registry is faked because the question is not where anything was DRAWN (that is
 * `e2e/pedal.e2e.ts`, which needs a real font) but what the rule does with a set of candidate boxes.
 * `OTTAVA_ELEMENT`'s spec is the template, and ⭐ **the one test that matters here is the one that
 * INVERTS its star test**: a press between the signs must MISS.
 *
 * ⭐ A pedal registers one box PER GLYPH — `Ped.`, the `✻`, and a `(Ped.)` for every system it
 * resumes on — all carrying the same id, so the hit-test is a `find` and any sign answers for the
 * whole pedal.
 */

/** One registered GLYPH box, as `PedalRenderer.registerGlyph` writes it. */
function sign(id: string, x0: number, x1: number, y0 = 40, y1 = 52): ElementInfo {
  return {
    type: 'pedal', id, measure: 1, staff: 0,
    bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    points: [
      { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    ],
  } as ElementInfo
}

function ctx(signs: ElementInfo[], x: number, y: number): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'pedal' ? signs : []),
  } as unknown as ElementRegistry
  return { registry, x, y, closestElement: null } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps {
  return {
    pick: vi.fn(() => true as const),
    armPedalOffsetDrag: vi.fn(),
  } as unknown as ElementChainDeps
}

/** A whole pedal as drawn: `Ped.` at 100–140, `✻` at 380–400, nothing between. */
const PED = sign('p1', 100, 140)
const STAR = sign('p1', 380, 400)

describe('PEDAL_ELEMENT.hit', () => {
  it('selects the pedal from a press on `Ped.`, and ARMS the body drag with it', () => {
    // ⭐ Click = select, drag = move the whole pedal (2026-08-21) — one press, two readings, and the
    // chain decides between them on the first move. ⚠️ A press on one of the SQUARES never reaches
    // here: `armPedalEndpointAt` is a pre-step in `MouseController` and consumes it.
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 120, 46), d)).toBe(true)
    // The arm runs only if the chain calls back — the drag is not started by the press itself.
    expect(d.armPedalOffsetDrag).not.toHaveBeenCalled()
    ;(d.pick as unknown as { mock: { calls: [unknown, () => void][] } }).mock.calls[0][1]()
    expect(d.armPedalOffsetDrag).toHaveBeenCalledWith('p1', 120, 46, undefined)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'pedal', id: 'p1' }, expect.any(Function))
  })

  it('⭐ …and the SAME pedal from a press on the release — either sign answers for the whole', () => {
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 390, 46), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'pedal', id: 'p1' }, expect.any(Function))
  })

  it('⭐⭐ a press BETWEEN the signs MISSES — a press may only reach INK', () => {
    // The inversion of `OTTAVA_ELEMENT`'s star test, and the whole reason this module exists. There
    // is no ink at all between `Ped.` and `✻`; a band test would hand the pedal every press over the
    // music it merely passes over, and those presses belong to the notes.
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 250, 46), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('a press just outside a sign still hits — the pad, since a pointer cannot be aimed to the pixel', () => {
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 144, 46), d)).toBe(true)
  })

  it('…but the pad does not reach across the gap', () => {
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 160, 46), d)).toBe(false)
  })

  it('a press above or below the signs does not hit', () => {
    for (const y of [20, 80]) {
      const d = deps()
      expect(PEDAL_ELEMENT.hit(ctx([PED, STAR], 120, y), d)).toBe(false)
    }
  })

  it('⭐ ANY sign of a split pedal resolves to the same pedal', () => {
    // System 1 carries `Ped.`; system 2 carries `(Ped.)` and the release. All three are one
    // statement, and clicking the resumption must not select "nothing".
    const first = sign('p1', 700, 740)
    const resumed = sign('p1', 50, 120, 300, 312)
    const released = sign('p1', 380, 400, 300, 312)
    for (const [x, y] of [[720, 46], [80, 306], [390, 306]] as const) {
      const d = deps()
      expect(PEDAL_ELEMENT.hit(ctx([first, resumed, released], x, y), d)).toBe(true)
      expect(d.pick).toHaveBeenCalledWith({ kind: 'pedal', id: 'p1' }, expect.any(Function))
    }
  })

  it('picks the pedal whose sign was actually pressed, with two on one system', () => {
    const other = sign('p2', 500, 540)
    const d = deps()
    expect(PEDAL_ELEMENT.hit(ctx([PED, STAR, other], 520, 46), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'pedal', id: 'p2' }, expect.any(Function))
  })

  it('ignores an entry with no outline rather than guessing from the bbox', () => {
    const d = deps()
    const noPoints = { ...PED, points: undefined } as unknown as ElementInfo
    expect(PEDAL_ELEMENT.hit(ctx([noPoints], 120, 46), d)).toBe(false)
  })
})

describe('the pedal sits AFTER the ottava in the press chain', () => {
  it('ottava first, pedal immediately after', () => {
    // ⚠️ Unlike the ottava-after-trill pair, this order is nearly free — the pedal is drawn below the
    // staff and an 8va above it. It is pinned anyway so a reorder stays deliberate.
    const kinds = ELEMENT_HIT_ORDER.map(s => s.kind)
    expect(kinds.indexOf('pedal')).toBe(kinds.indexOf('ottava') + 1)
  })
})
