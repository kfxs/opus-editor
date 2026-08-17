import { describe, it, expect, beforeEach } from 'vitest'
import { slurHandleOrder, cycleSlurHandle } from './slurHandleCycle'
import { createEditorState, type EditorState } from './EditorState'
import { ElementRegistry, type ElementInfo } from '../engine/ElementRegistry'

/**
 * Tab walks a selected slur's handles.
 *
 * Subject: {@link slurHandleCycle}, sitting beside this file. The REGISTRY is the list, so a
 * fabricated registry is the whole fixture — no renderer, and nothing here asserts a drawn position.
 * Where the handles land is `HighlightController`'s question and has its own spec; what is asked
 * here is the ORDER they are visited in and what a press does to the selection.
 */
const box = (x: number) => ({ x, y: 0, width: 8, height: 8 })

/** A same-line slur as drawn: two blue ends and one pair of round dots between them. */
const SINGLE: Partial<ElementInfo>[] = [
  { type: 'slur-endpoint', slurId: 'S1', endpoint: 'start', bbox: box(10) },
  { type: 'slur-endpoint', slurId: 'S1', endpoint: 'end', bbox: box(100) },
  { type: 'slur-handle', slurId: 'S1', cpIndex: 0, bbox: box(35) },
  { type: 'slur-handle', slurId: 'S1', cpIndex: 1, bbox: box(75) },
]

describe('slurHandleOrder', () => {
  it('⭐ same-line slur: start square → first dot → second dot → end square', () => {
    // Reading order, which for one system is also left-to-right.
    expect(slurHandleOrder(SINGLE as ElementInfo[], 'S1')).toEqual([
      { endpoint: 'start' },
      { controlPoint: { cpIndex: 0, segmentRole: undefined, segmentOrdinal: undefined } },
      { controlPoint: { cpIndex: 1, segmentRole: undefined, segmentOrdinal: undefined } },
      { endpoint: 'end' },
    ])
  })

  it('does not depend on the order the registry happens to hold them in', () => {
    const shuffled = [SINGLE[3], SINGLE[1], SINGLE[2], SINGLE[0]] as ElementInfo[]
    expect(slurHandleOrder(shuffled, 'S1')).toEqual(slurHandleOrder(SINGLE as ElementInfo[], 'S1'))
  })

  it('ignores another slur\'s handles entirely', () => {
    const withOther = [...SINGLE,
      { type: 'slur-handle', slurId: 'S2', cpIndex: 0, bbox: box(50) }] as ElementInfo[]
    expect(slurHandleOrder(withOther, 'S1')).toHaveLength(4)
  })

  it('a slur with no editable shape has no dots, and the walk is just its two ends', () => {
    expect(slurHandleOrder(SINGLE.slice(0, 2) as ElementInfo[], 'S1'))
      .toEqual([{ endpoint: 'start' }, { endpoint: 'end' }])
  })

  it('⭐⭐ cross-system: SEGMENT first, then x — and the true ends pin the walk', () => {
    // ⚠️ The second system's handles have SMALLER x than the first's. Sorting by x alone would
    // interleave the two systems; sorting by segment keeps each system's run together.
    // ⚠️ Both blue squares are registered by the FIRST partial, so the end square would sort into
    // the begin segment if it were not pinned last.
    const entries: Partial<ElementInfo>[] = [
      { type: 'slur-endpoint', slurId: 'S1', endpoint: 'start', bbox: box(500) },
      { type: 'slur-endpoint', slurId: 'S1', endpoint: 'end', bbox: box(200) },
      { type: 'slur-handle', slurId: 'S1', cpIndex: 0, segmentRole: 'begin', bbox: box(600) },
      { type: 'slur-handle', slurId: 'S1', cpIndex: 1, segmentRole: 'begin', bbox: box(800) },
      { type: 'slur-segment-endpoint', slurId: 'S1', segmentRole: 'begin', slurSpanCount: 2, bbox: box(900) },
      { type: 'slur-handle', slurId: 'S1', cpIndex: 0, segmentRole: 'end', bbox: box(80) },
      { type: 'slur-handle', slurId: 'S1', cpIndex: 1, segmentRole: 'end', bbox: box(150) },
      { type: 'slur-segment-endpoint', slurId: 'S1', segmentRole: 'end', slurSpanCount: 2, bbox: box(40) },
    ]
    const order = slurHandleOrder(entries as ElementInfo[], 'S1')
    expect(order[0]).toEqual({ endpoint: 'start' })
    expect(order[order.length - 1]).toEqual({ endpoint: 'end' })
    // The begin system's three, in x order, then the end system's three — NOT interleaved.
    expect(order.slice(1, 4).map(p => p.controlPoint?.cpIndex ?? 'join')).toEqual([0, 1, 'join'])
    expect(order.slice(4, 7).map(p => p.controlPoint?.cpIndex ?? 'join')).toEqual(['join', 0, 1])
  })

  it('a MIDDLE segment sorts by its ordinal, between begin and end', () => {
    const seg = (role: 'begin' | 'middle' | 'end', ordinal: number | undefined, x: number) =>
      ({ type: 'slur-handle', slurId: 'S1', cpIndex: 0, segmentRole: role, segmentOrdinal: ordinal, bbox: box(x) })
    const entries = [
      seg('end', undefined, 10), seg('middle', 1, 10), seg('begin', undefined, 10), seg('middle', 0, 10),
    ] as ElementInfo[]
    expect(slurHandleOrder(entries, 'S1').map(p => [p.controlPoint?.segmentRole, p.controlPoint?.segmentOrdinal]))
      .toEqual([['begin', undefined], ['middle', 0], ['middle', 1], ['end', undefined]])
  })
})

describe('cycleSlurHandle', () => {
  let state: EditorState
  let registry: ElementRegistry

  const armed = () => {
    const el = state.selectedElement
    if (el?.kind !== 'slur') return null
    return el.endpoint ?? (el.controlPoint ? `cp${el.controlPoint.cpIndex}` : el.segmentEndpoint?.role) ?? null
  }

  beforeEach(() => {
    state = createEditorState()
    registry = new ElementRegistry()
    for (const e of SINGLE) registry.add(e as ElementInfo)
    state.selectedElement = { kind: 'slur', id: 'S1' }
  })

  it('DECLINES with no slur selected — which is what leaves Tab to the browser', () => {
    state.selectedElement = null
    expect(cycleSlurHandle(state, registry, 1)).toBe(false)
    expect(state.selectedElement).toBeNull()
  })

  it('DECLINES when the slur is selected but nothing was drawn (linear view)', () => {
    expect(cycleSlurHandle(state, new ElementRegistry(), 1)).toBe(false)
  })

  it('⭐ with nothing armed, Tab takes the FIRST handle and Shift+Tab the LAST', () => {
    expect(cycleSlurHandle(state, registry, 1)).toBe(true)
    expect(armed()).toBe('start')

    state.selectedElement = { kind: 'slur', id: 'S1' }
    expect(cycleSlurHandle(state, registry, -1)).toBe(true)
    expect(armed()).toBe('end')
  })

  it('walks the whole cycle and WRAPS', () => {
    const seen: (string | null)[] = []
    for (let i = 0; i < 5; i++) {
      cycleSlurHandle(state, registry, 1)
      seen.push(armed())
    }
    expect(seen).toEqual(['start', 'cp0', 'cp1', 'end', 'start'])
  })

  it('Shift+Tab walks back through the same order', () => {
    cycleSlurHandle(state, registry, 1)  // start
    cycleSlurHandle(state, registry, 1)  // cp0
    cycleSlurHandle(state, registry, -1)
    expect(armed()).toBe('start')
    cycleSlurHandle(state, registry, -1) // wraps
    expect(armed()).toBe('end')
  })

  it('⭐ arming one handle DROPS the last — the three fields are mutually exclusive', () => {
    // Built from the id alone rather than spread from the old selection: a spread would leave the
    // previous handle's field sitting beside the new one, and two handles would paint as picked.
    cycleSlurHandle(state, registry, 1) // endpoint 'start'
    cycleSlurHandle(state, registry, 1) // controlPoint 0
    const el = state.selectedElement
    expect(el?.kind === 'slur' && el.endpoint).toBeUndefined()
    expect(el?.kind === 'slur' && el.controlPoint?.cpIndex).toBe(0)
  })

  it('keeps the slur itself selected throughout', () => {
    cycleSlurHandle(state, registry, 1)
    cycleSlurHandle(state, registry, 1)
    expect(state.selectedElement).toMatchObject({ kind: 'slur', id: 'S1' })
  })
})
