import { describe, it, expect, vi } from 'vitest'
import { KEY_SIGNATURE_ELEMENT } from './keySignature'
import { ELEMENT_HIT_ORDER, ELEMENT_SPECS } from './chain'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which signature a press resolves to — the decision, on a stubbed registry, beside
 * `./repeatStart.test.ts` and for its reason: the question is not WHERE the row of signs was drawn
 * (the browser suite's, which needs real glyphs) but what the rule does with a set of candidates.
 *
 * ⭐ The structural claims are the two that separate this kind from the clef beside it in the chain:
 * the box is registered by the DRAWING pass (so there is no `isPainted` filter to get wrong), and it
 * carries its STAFF, because a key change is stored per staff.
 */
function box(measure: number, x: number, width = 30, staff = 0): ElementInfo {
  return { type: 'keySignature', measure, staff, bbox: { x, y: 0, width, height: 40 } } as ElementInfo
}

function ctx(boxes: ElementInfo[], x: number, y = 20): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'keySignature' ? boxes : []),
  } as unknown as ElementRegistry
  return { registry, x, y } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps {
  return { pick: vi.fn(() => true as const) } as unknown as ElementChainDeps
}

describe('KEY_SIGNATURE_ELEMENT.hit', () => {
  it('selects the signature under the press, named by its bar AND its staff', () => {
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([box(5, 100)], 110), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'keySignature', measure: 5, staff: 0 })
  })

  it('⭐ carries the STAFF the row of signs was drawn on — Bartók’s two hands differ', () => {
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([box(5, 100, 30, 1)], 110), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'keySignature', measure: 5, staff: 1 })
  })

  it('⛔ takes no press outside its ink — the box is the row, from first sign to last', () => {
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([box(5, 100)], 99), d)).toBe(false)
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([box(5, 100)], 131), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('⛔ and none off the staff it is drawn on — a press between two staves is on no signature', () => {
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([box(5, 100)], 110, 60), d)).toBe(false)
  })

  it('declines when nothing was drawn — no `isPainted` filter, because the PASS registers only ink', () => {
    // The clef and the meter beside it in the chain both filter, because their boxes are tier-1
    // records written for every bar in the score. This box is written by the pen: an empty registry
    // IS "nothing was painted here".
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([], 110), d)).toBe(false)
  })

  it('a C-major signature is unreachable — it draws no ink, so it registers no box', () => {
    // The first kind whose valid state is zero glyphs (plan §5). Nothing to click, which is what the
    // SIGNPOST is owed for — ⛔ and deliberately not patched with an invisible hit box.
    const d = deps()
    expect(KEY_SIGNATURE_ELEMENT.hit(ctx([], 110), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('is in both tables — the chain that resolves a press and the paint that is total', () => {
    expect(ELEMENT_HIT_ORDER.map(e => e.kind)).toContain('keySignature')
    expect(ELEMENT_SPECS.keySignature).toBe(KEY_SIGNATURE_ELEMENT)
    expect(typeof ELEMENT_SPECS.keySignature.highlight).toBe('function')
  })
})
