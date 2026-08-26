import { describe, it, expect, vi } from 'vitest'
import { REPEAT_START_ELEMENT } from './repeatStart'
import { BARLINE_ELEMENT } from './barline'
import { ELEMENT_HIT_ORDER } from './chain'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps } from './chain'

/**
 * Which `|:` a press resolves to — the decision, on a stubbed registry, beside `./barline.test.ts`.
 *
 * The registry is faked for that file's reason: the question is not where the sign was drawn (that
 * is the browser suite's, which needs real glyphs and a real cull window) but what the rule DOES
 * with a set of candidates. ⭐ The one structural claim here is the **absence** of an `isPainted`
 * filter — this box is registered by the DRAWING pass, so unlike the barline's it cannot exist for a
 * bar nothing was drawn for.
 */
function box(measure: number, x: number, width = 15, staff = 0): ElementInfo {
  return { type: 'repeatStart', measure, staff, bbox: { x, y: 0, width, height: 40 } } as ElementInfo
}

function ctx(boxes: ElementInfo[], x: number, y = 20, closestElement: ElementInfo | null = null,
             onNoteBody = false): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'repeatStart' ? boxes : []),
    hitsNoteOrRestBody: () => onNoteBody,
  } as unknown as ElementRegistry
  return { registry, x, y, closestElement } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps {
  return { pick: vi.fn(() => true as const) } as unknown as ElementChainDeps
}

describe('REPEAT_START_ELEMENT.hit', () => {
  it('selects the open repeat under the press, named by the bar it OPENS', () => {
    const d = deps()
    expect(REPEAT_START_ELEMENT.hit(ctx([box(5, 100)], 105), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'repeatStart', measure: 5 })
  })

  it('🚨 reaches the sign OPENING THE SCORE — the one no boundary can name', () => {
    // His report, 2026-08-26. Bar 1's repeat is displaced past its clef and meter, so it stands at no
    // boundary at all: nothing in `ELEMENT_HIT_ORDER` could resolve it before this module existed.
    const d = deps()
    expect(REPEAT_START_ELEMENT.hit(ctx([box(1, 80)], 88), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'repeatStart', measure: 1 })
  })

  it('⛔ takes no press OUTSIDE its ink — the box is the sign, unpadded', () => {
    const d = deps()
    // A plain barline's 4px box has to be padded to be clickable; 1.5 staff spaces of repeat does
    // not, and padding it would only steal from the divider on its left and the first note on its
    // right. 100…115 here.
    expect(REPEAT_START_ELEMENT.hit(ctx([box(5, 100)], 99), d)).toBe(false)
    expect(REPEAT_START_ELEMENT.hit(ctx([box(5, 100)], 116), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('⛔ and none outside the staff it is drawn on — a press between two staves is on no sign', () => {
    const d = deps()
    expect(REPEAT_START_ELEMENT.hit(ctx([box(5, 100)], 105, 60), d)).toBe(false)
  })

  it('between two signs, takes the nearer one — registration order is by bar, not by distance', () => {
    const d = deps()
    // Two systems' signs can both answer a press near a break.
    expect(REPEAT_START_ELEMENT.hit(ctx([box(9, 100), box(40, 106)], 112), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith({ kind: 'repeatStart', measure: 40 })
  })

  it('stands down for a press on a note body — a displaced `|:` sits right beside one', () => {
    const d = deps()
    const note = { type: 'note' } as ElementInfo
    expect(REPEAT_START_ELEMENT.hit(ctx([box(5, 100)], 105, 20, note, true), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('declines when nothing was drawn — no `isPainted` filter, because the pass registers only ink', () => {
    const d = deps()
    expect(REPEAT_START_ELEMENT.hit(ctx([], 105), d)).toBe(false)
  })

  it('🚨 comes BEFORE the barline in the chain — a press resolves to the SIGN it landed on', () => {
    // His report, 2026-08-26: *"I click on a repeat bar and sometimes it shows me repeat start and
    // sometimes it shows me barline, like we have two barlines."* A lone `|:` REPLACES the previous
    // bar's plain line — one sign, not a sign with a line under it — so it must claim its own ink
    // first. The barline keeps everything LEFT of the boundary, which at a `:||:` is the end
    // repeat's half and elsewhere is the line itself.
    const order = ELEMENT_HIT_ORDER.map(e => e.kind)
    expect(order.indexOf('repeatStart')).toBeLessThan(order.indexOf('barline'))
    expect(BARLINE_ELEMENT.kind).toBe('barline')
  })
})
