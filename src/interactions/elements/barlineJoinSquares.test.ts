// @vitest-environment jsdom
/**
 * The JOIN SQUARES a selected barline draws in the gaps between its staves (P2 of
 * docs/plans/barline-join-plan.md).
 *
 * WHAT the selection recolours is `HighlightController.barline.test.ts`; the same square one family
 * over is `endpointHandles.test.ts`. WHERE the squares sit is `./barlineJoinHandles`' own spec; what
 * is asked here is that selecting a barline paints them at all, that each registers the hit-box a
 * press finds it by — under the staff ABOVE its gap — and that they come off with the highlight layer.
 */
import { describe, it, expect } from 'vitest'
import { HighlightController } from '../controllers/HighlightController'
import { createEditorState } from '../state/EditorState'
import { ElementRegistry } from '@/engine/ElementRegistry'
import type { MusicEngine } from '@/engine/MusicEngine'
import { paintBarlineJoinSquares } from './barlineJoinSquares'

const MEASURE = 3

/** Three staves at the default stride, each with a plain barline box straddling x 300. */
function paint(
  selected: 'barline' | 'repeatStart' | null,
  staffCount = 3,
  pressedAt?: { staff: number; pressedAt?: 'top' | 'bottom' },
) {
  const registry = new ElementRegistry()
  for (let staff = 0; staff < staffCount; staff++) {
    registry.add({
      type: 'barline',
      measure: MEASURE,
      staff,
      bbox: { x: 298, y: 100 + staff * 150, width: 4, height: 40 },
    })
    registry.markPainted(MEASURE, staff)
  }
  // Four bars of plain lines — the sign standing on the boundary is what the square centres on.
  const measures = Array.from({ length: 4 }, (_, i) => ({ number: i + 1 }))
  const engine = {
    getElementRegistry: () => registry,
    getScore: () => ({ measures }),
  } as unknown as MusicEngine

  const canvas = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  canvas.appendChild(svg)

  const state = createEditorState()
  if (selected) state.selectedElement = { kind: selected, measure: MEASURE, ...pressedAt }

  const highlight = new HighlightController(() => engine, () => canvas, state)
  paintBarlineJoinSquares(highlight.context()!)
  return { svg, registry, highlight }
}

const squares = (svg: SVGElement) => [...svg.querySelectorAll('rect.barline-join-handle')]

describe('a selected barline', () => {
  it('⭐⭐ draws ONE square — at the staff and the end that were pressed', () => {
    // His calls, 2026-08-28: *"just in the stave we clicked"*, then *"the spot to click is
    // critical"*. Sibelius's gesture, and MuseScore's single grip.
    const { svg } = paint('barline', 3, { staff: 1, pressedAt: 'bottom' })
    expect(squares(svg)).toHaveLength(1)
    expect(squares(svg)[0].getAttribute('class')).toContain('barline-join-handle--below')
  })

  it('…and none when that end has no gap behind it — the top of the first staff', () => {
    expect(squares(paint('barline', 3, { staff: 0, pressedAt: 'top' }).svg)).toHaveLength(0)
  })

  it('a selection with no press behind it narrows nothing: every gap\'s squares', () => {
    // The keyboard walk, and playback's start line — ⛔ a guessed spot would hide handles.
    const { svg } = paint('barline')
    expect(squares(svg)).toHaveLength(4)
  })

  it('draws none when the score has one staff: no gap, no square', () => {
    const { svg } = paint('barline', 1)
    expect(squares(svg)).toHaveLength(0)
  })

  it('draws none when no barline is selected', () => {
    expect(squares(paint(null).svg)).toHaveLength(0)
  })

  it('⛔ and none for a selected OPEN REPEAT — the join squares hang off the `barline` selection', () => {
    expect(squares(paint('repeatStart').svg)).toHaveLength(0)
  })

  it('⭐ every square looks the same — the ink in the gap says whether it is joined, not the handle', () => {
    // His call, 2026-08-28: *"always the same square"*. Nothing here is ARMED either: a join square
    // is not a selectable element, so there is no picked one to draw bigger.
    const { svg } = paint('barline')
    const looks = squares(svg).map(sq => [
      sq.getAttribute('fill'), sq.getAttribute('stroke'), sq.getAttribute('stroke-width'),
      sq.getAttribute('width'), sq.getAttribute('height'),
    ])
    expect(new Set(looks.map(l => l.join('|'))).size).toBe(1)
    expect(looks[0]).toEqual(['#2563EB', '#ffffff', '1.5', '12', '12'])
  })

  it('registers a hit-box per square, keyed by the staff ABOVE its gap', () => {
    // ⚠️ Both squares of one gap register the SAME (measure, staff) pair — that pair is
    // `barlineJoinBelow`'s key, and a P3 press writes one fact whichever square it grabbed.
    const { registry } = paint('barline')
    const entries = registry.getByType('barline-join')
    expect(entries.map(e => [e.measure, e.staff])).toEqual([[3, 0], [3, 0], [3, 1], [3, 1]])
  })

  it('the registered boxes come off with the highlight layer — the render never drew them', () => {
    const { registry, highlight } = paint('barline')
    highlight.clearHighlights()
    expect(registry.getByType('barline-join')).toEqual([])
  })

  it('and so do the squares themselves', () => {
    const { svg, highlight } = paint('barline')
    highlight.clearHighlights()
    expect(squares(svg)).toHaveLength(0)
  })
})
