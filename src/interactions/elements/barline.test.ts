import { describe, it, expect, vi } from 'vitest'
import { BARLINE_ELEMENT } from './barline'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which barline a press resolves to — the decision, on a stubbed registry.
 *
 * The registry is faked because the question is not where anything was drawn (that is
 * `e2e/barlineSelection.e2e.ts`, which needs a real cull window) but what the rule DOES with a set
 * of candidates: skip the ones with no ink, and among the rest take the one aimed at.
 */
function box(measure: number, x: number, staff = 0): ElementInfo {
  return { type: 'barline', measure, staff, bbox: { x, y: 0, width: 4, height: 40 } } as ElementInfo
}

/** `painted` lists the measures tier 2 drew; everything else is registered but invisible. */
function ctx(boxes: ElementInfo[], painted: number[], x: number): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'barline' ? boxes : []),
    isPainted: (measure: number) => painted.includes(measure),
    hitsNoteOrRestBody: () => false,
  } as unknown as ElementRegistry
  return { registry, x, y: 20, closestElement: null } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps & { picked: (() => void)[] } {
  const picked: (() => void)[] = []
  return {
    pick: vi.fn((_element, arm?: () => void) => { if (arm) picked.push(arm); return true as const }),
    armBarWidthDrag: vi.fn(),
    picked,
  } as unknown as ElementChainDeps & { picked: (() => void)[] }
}

describe('BARLINE_ELEMENT.hit', () => {
  it('selects the barline under the press', () => {
    const d = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'barline', measure: 5 }, expect.any(Function))
  })

  it('⭐ DECLINES a box with no ink behind it — a culled bar is not there to be clicked', () => {
    const d = deps()
    // Bar 5's box is registered by tier 1 and painted by nobody: the press must fall through, not
    // select a barline the user cannot see and then refuse to move it.
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [], 101), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('reaches past an invisible box to the real barline underneath it', () => {
    const d = deps()
    // Two boxes cover the press; only bar 40 is painted. His words: "the system should be smart to
    // get the real barline".
    expect(BARLINE_ELEMENT.hit(ctx([box(9, 100), box(40, 101)], [40], 102), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'barline', measure: 40 }, expect.any(Function))
  })

  it('between two REAL barlines, takes the nearer one — not the lower-numbered bar', () => {
    const d = deps()
    // Registration order is by bar, so the old `find` always handed this to bar 9.
    expect(BARLINE_ELEMENT.hit(ctx([box(9, 100), box(40, 110)], [9, 40], 111), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'barline', measure: 40 }, expect.any(Function))
  })

  it('arms the width drag on the bar it actually selected', () => {
    const d = deps()
    BARLINE_ELEMENT.hit(ctx([box(9, 100), box(40, 101)], [40], 102), d)
    d.picked[0]()
    expect(d.armBarWidthDrag).toHaveBeenCalledWith(40, 102)
  })

  it('declines when nothing is in range at all', () => {
    const d = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 500), d)).toBe(false)
  })

  it('does not steal a press that lands on a note or rest body', () => {
    const d = deps()
    const c = ctx([box(5, 100)], [5], 101)
    ;(c.registry as unknown as { hitsNoteOrRestBody: () => boolean }).hitsNoteOrRestBody = () => true
    ;(c as { closestElement: ElementInfo | null }).closestElement = { type: 'note' } as ElementInfo
    expect(BARLINE_ELEMENT.hit(c, d)).toBe(false)
  })
})
