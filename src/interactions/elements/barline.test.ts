import { describe, it, expect, vi } from 'vitest'
import { BARLINE_ELEMENT } from './barline'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { MouseDownCtx, ElementChainDeps, GestureDoor } from './chain'

const drag = vi.hoisted(() => ({ beginBarWidthDrag: vi.fn((..._args: unknown[]) => null) }))
vi.mock('../drags/barWidth', () => drag)

/** The gesture the press would arm: run the builder `deps.arm` was handed, through a door whose
 *  host is {@link HOST}. */
const HOST = { host: 'the drag host' } as unknown as GestureDoor
/** The press context's engine — the bar-width gesture measures its room off it. */
const ENGINE = { engine: 'the engine' }
function armedWith(d: ElementChainDeps): unknown[] {
  const [build] = (d.arm as unknown as { mock: { calls: [(door: GestureDoor) => unknown, unknown][] } }).mock.calls.slice(-1)[0]
  build(HOST)
  return drag.beginBarWidthDrag.mock.calls.slice(-1)[0]
}

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

/** The piece of a JOINED line crossing the gap below `staffAbove`, registered by the drawing pass
 *  (`engine/rendering/barlineGap`) — `measure` is the bar the line ENDS, and the box is the space
 *  between the two staves. Here: staff 0's lines end at y 40, staff 1's begin at y 190. */
function gapBox(measure: number, x: number, staffAbove = 0): ElementInfo {
  return { type: 'barline-gap', measure, staff: staffAbove, bbox: { x, y: 40, width: 1.6, height: 150 } } as ElementInfo
}

/** `painted` lists the measures tier 2 drew; everything else is registered but invisible. */
function ctx(boxes: ElementInfo[], painted: number[], x: number, y = 20, gaps: ElementInfo[] = []): MouseDownCtx {
  const registry = {
    getByType: (type: string) => (type === 'barline' ? boxes : type === 'barline-gap' ? gaps : []),
    isPainted: (measure: number) => painted.includes(measure),
    hitsNoteOrRestBody: () => false,
  } as unknown as ElementRegistry
  return { engine: ENGINE, registry, x, y, closestElement: null } as unknown as MouseDownCtx
}

function deps(): ElementChainDeps & { picked: (() => void)[] } {
  const picked: (() => void)[] = []
  return {
    pick: vi.fn((_element, arm?: () => void) => { if (arm) picked.push(arm); return true as const }),
    arm: vi.fn(),
    picked,
  } as unknown as ElementChainDeps & { picked: (() => void)[] }
}

describe('BARLINE_ELEMENT.hit', () => {
  it('selects the barline under the press', () => {
    const d = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101), d)).toBe(true)
    // ⚠️ `staff`/`pressedAt` ride along for the JOIN SQUARES only — the selection is still the one
    // system-wide boundary (`SelectedElement`'s `barline`). The default press is at y 20, the
    // bottom half of a 0…40 box.
    expect(d.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'bottom' }, expect.any(Function))
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
    expect(d.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 40, staff: 0, pressedAt: 'bottom' }, expect.any(Function))
  })

  it('between two REAL barlines, takes the nearer one — not the lower-numbered bar', () => {
    const d = deps()
    // Registration order is by bar, so the old `find` always handed this to bar 9.
    expect(BARLINE_ELEMENT.hit(ctx([box(9, 100), box(40, 110)], [9, 40], 111), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 40, staff: 0, pressedAt: 'bottom' }, expect.any(Function))
  })

  it('⭐⭐ the HALF of the line pressed in names the END — which join square is offered', () => {
    // His call, 2026-08-28: *"the spot to click is critical… if the user click in that area we show
    // the blue square related with that"*. Sibelius's *"click carefully at the top or bottom"*
    // (§4.5 p. 343), made forgiving: the END is the HALF. The box is the five staff lines, 0…40.
    const top = deps()
    BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, 8), top)
    expect(top.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'top' }, expect.any(Function))

    const bottom = deps()
    BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, 33), bottom)
    expect(bottom.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'bottom' }, expect.any(Function))
  })

  it('names the STAFF the press landed on, not the first one registered', () => {
    const d = deps()
    BARLINE_ELEMENT.hit(ctx([box(5, 100, 2)], [5], 101), d)
    expect(d.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 2, pressedAt: 'bottom' }, expect.any(Function))
  })

  it('⭐ answers a press a few px PAST the staff\'s last line — his *"less tight"*, 2026-08-28', () => {
    // A barline is 1.6 px of ink and the ENDS of it are where the hand aims (the join squares live
    // there). Missing by two pixels used to fall through to the bar behind it and select the whole
    // measure. ⚠️ The box is y 0…40, so 40 + a little is still the line.
    const above = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, -4), above)).toBe(true)
    expect(above.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'top' }, expect.any(Function))

    const below = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, 44), below)).toBe(true)
    expect(below.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'bottom' }, expect.any(Function))
  })

  it('⛔ …and a press well clear of the line is still on no barline at all', () => {
    // ⛔ Not the staff BAND's 12 px (`../staffBand`): a press out in the gap between two staves
    // reaches the music behind it, exactly as before.
    const d = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, 60), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('⭐⭐ a press on the line where it CROSSES THE GAP selects the same barline — his ask, 2026-08-28', () => {
    // *"if the barline is join and i click on in the empty space of the two staves i want to be able
    // to select it too and move and do the normal barline operations"*. One line to the eye, one
    // line to the hand: same boundary, same width drag.
    const d = deps()
    // ⚠️ The bar is NOT in `painted` — a gap box is registered by the drawing pass, so its existence
    // is already proof, and the bar a gap's line ends is not always the bar that drew it.
    expect(BARLINE_ELEMENT.hit(ctx([], [], 101, 100, [gapBox(5, 100)]), d)).toBe(true)
    expect(d.pick).toHaveBeenCalledWith(
      { kind: 'barline', measure: 5, staff: 0, pressedAt: 'gap' }, expect.any(Function))
  })

  it('⭐⭐ …and a press out in the gap shows NO square — a handle marks the END of a staff\'s line', () => {
    // His call, 2026-08-28: *"when i select the barline in the midle, in the white space i dont need
    // to see the square, the square is related just to the stave"*. `'gap'` is what says so, and it
    // is ⛔ not the same as an absent spot (which means nobody said where the press was).
    for (const y of [50, 100, 180]) {
      const d = deps()
      BARLINE_ELEMENT.hit(ctx([], [], 101, y, [gapBox(5, 100)]), d)
      expect(d.pick).toHaveBeenCalledWith(
        expect.objectContaining({ pressedAt: 'gap' }), expect.any(Function))
    }
  })

  it('arms the width drag from the gap too — the normal barline operations, from the new ink', () => {
    const d = deps()
    BARLINE_ELEMENT.hit(ctx([], [], 102, 100, [gapBox(5, 100)]), d)
    d.picked[0]()
    expect(armedWith(d)).toEqual([HOST.host, ENGINE, 5, 102])
  })

  it('⛔ an UNJOINED gap answers nothing — nothing is drawn there, so nothing is registered', () => {
    const d = deps()
    expect(BARLINE_ELEMENT.hit(ctx([box(5, 100)], [5], 101, 100), d)).toBe(false)
    expect(d.pick).not.toHaveBeenCalled()
  })

  it('arms the width drag on the bar it actually selected', () => {
    const d = deps()
    BARLINE_ELEMENT.hit(ctx([box(9, 100), box(40, 101)], [40], 102), d)
    d.picked[0]()
    expect(armedWith(d)).toEqual([HOST.host, ENGINE, 40, 102])
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
