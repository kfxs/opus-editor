// @vitest-environment jsdom
/**
 * The BARLINE JOIN drag (docs/plans/barline-join-plan.md P3): grab the blue square in the gap, drag it
 * past the middle of that gap, and the barline runs unbroken into the staff below — drag it back and
 * the two staves part again.
 *
 * ⭐ **One square, both directions** — his requirement from the first sketch: *"important disjoint
 * should be also managed here"*. And the decision is a POSITION, not a delta, which is why there is
 * no dead zone here to test: a press that never moves is still on its own side of the middle.
 *
 * The parts with a history are the two that keep the undo log honest: every frame is a PREVIEW (no
 * undo), and the drop commits **only if the gap ended up different from how it started** — a drag
 * that crossed the middle and came back wrote twice and changed nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEditorState, type EditorState } from './EditorState'
import { MouseController } from './MouseController'
import { fakeSvg } from '@/testing/fakeSvg'


/** Two staves, one bar: staff 0's lines span y 90–130, staff 1's start at 240. ⇒ the gap is
 *  130…240 and its MIDDLE — the whole gesture's threshold — is y 185. */
const BARLINE_TOP = { type: 'barline' as const, measure: 1, staff: 0, bbox: { x: 198, y: 90, width: 4, height: 40 } }
const BARLINE_BOTTOM = { type: 'barline' as const, measure: 1, staff: 1, bbox: { x: 198, y: 240, width: 4, height: 40 } }
/** The square the highlight registered under staff 0 — its centre is y 140, in the top half of the
 *  gap, so AWAY from its staff is DOWN. */
const JOIN_SQUARE = { type: 'barline-join' as const, measure: 1, staff: 0, bbox: { x: 191, y: 131, width: 18, height: 18 } }
const GAP_MIDDLE = 185

describe('barline join drag', () => {
  let state: EditorState
  let canvas: HTMLElement
  let svg: SVGSVGElement
  let mc: MouseController
  let engine: Record<string, unknown>
  let render: { renderScore: ReturnType<typeof vi.fn> }
  let joined: boolean

  const ev = (over: Partial<{ clientX: number; clientY: number }> = {}) =>
    ({ clientX: 0, clientY: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false,
      target: svg, preventDefault: () => {}, ...over }) as unknown as MouseEvent

  /** Press on the square, then move the pointer to `y`. */
  const grabAndMove = (y: number) => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 140 }))
    mc.handleMouseMove(ev({ clientX: 200, clientY: y }))
  }

  beforeEach(() => {
    state = createEditorState()
    state.selectedTool = 'selection'
    // The barline is selected — that is what put the square on the page in the first place.
    state.selectedElement = { kind: 'barline', measure: 1, staff: 0, pressedAt: 'bottom' }
    svg = fakeSvg()
    canvas = document.createElement('div')
    canvas.querySelector = ((sel: string) => (sel === 'svg' ? svg : null)) as typeof canvas.querySelector

    joined = false
    const registry = {
      findClosestNoteOrRest: () => null,
      getTupletAt: () => null,
      hitsNoteOrRestBody: () => false,
      findStemAt: () => null,
      findTremoloAt: () => null,
      getByType: (t: string) =>
        t === 'barline' ? [BARLINE_TOP, BARLINE_BOTTOM] : t === 'barline-join' ? [JOIN_SQUARE] : [],
      isPainted: () => true,
      getByMeasure: () => [],
      getTupletById: () => null,
      staffIndexAtY: () => 0,
      getStaffGeometry: () => ({ lineSpacing: 10, noteStartX: 50 }),
      noteOrRestHitDistance: () => Infinity,
    }

    engine = {
      getElementRegistry: () => registry,
      getNote: () => undefined,
      getScore: () => ({ measures: [] }),
      pixelToMeasure: () => 1,
      isRenderStale: () => false,
      // Only the 'missed the square' press gets this far — it falls through to the plain
      // measure-click, which asks where the bars are.
      getMeasureRect: () => null,
      barlineJoinsBelow: vi.fn(() => joined),
      previewBarlineJoinBelow: vi.fn((_staff: number, on: boolean) => {
        if (on === joined) return false
        joined = on
        return true
      }),
      commitBarlineJoin: vi.fn(),
    }
    render = { renderScore: vi.fn() }

    mc = new MouseController(
      () => engine as never, () => canvas, state,
      { selectNote: vi.fn() } as never, render as never,
      () => undefined, () => null, { pasteAt: vi.fn() } as never,
      () => {}, () => {}, vi.fn(), () => 1,
    )
  })

  it('⭐ the press keeps the barline selected — a join square selects nothing of its own', () => {
    // There is no `SelectedElement` kind for a square, and the barline staying picked is what keeps
    // the square painted for the whole drag.
    mc.handleMouseDown(ev({ clientX: 200, clientY: 140 }))
    expect(state.selectedElement).toEqual({ kind: 'barline', measure: 1, staff: 0, pressedAt: 'bottom' })
  })

  it('⭐⭐ dragging PAST THE MIDDLE of the gap joins it, and redraws', () => {
    grabAndMove(GAP_MIDDLE + 20)
    expect(engine.previewBarlineJoinBelow).toHaveBeenCalledWith(0, true)
    expect(render.renderScore).toHaveBeenCalled()
  })

  it('…and short of the middle nothing happens — the line has not crossed the space', () => {
    grabAndMove(GAP_MIDDLE - 20)
    expect(engine.previewBarlineJoinBelow).not.toHaveBeenCalled()
  })

  it('⭐⭐ pulling an ALREADY JOINED gap past the middle takes it APART — the gesture flips the state', () => {
    // His rule, 2026-08-28: *"the gesture should be oposite to the state… if i go to the second and
    // go up i should be able to disjoin cause is already joined"*.
    joined = true
    grabAndMove(GAP_MIDDLE + 20)
    expect(engine.previewBarlineJoinBelow).toHaveBeenCalledWith(0, false)
  })

  it('…and a joined gap left alone on its own side of the middle stays joined', () => {
    joined = true
    grabAndMove(GAP_MIDDLE - 20)
    expect(engine.previewBarlineJoinBelow).not.toHaveBeenCalled()
  })

  it('writes only when the answer CHANGES — wandering inside one half costs nothing', () => {
    grabAndMove(GAP_MIDDLE + 20)
    mc.handleMouseMove(ev({ clientX: 200, clientY: GAP_MIDDLE + 40 }))
    mc.handleMouseMove(ev({ clientX: 200, clientY: GAP_MIDDLE + 60 }))
    expect(engine.previewBarlineJoinBelow).toHaveBeenCalledTimes(1)
  })

  it('the drop records ONE undo entry', () => {
    grabAndMove(GAP_MIDDLE + 20)
    mc.handleMouseUp(ev())
    expect(engine.commitBarlineJoin).toHaveBeenCalledTimes(1)
  })

  it('⭐⭐ …and NONE when the gesture ended where it began — crossed the middle and came back', () => {
    grabAndMove(GAP_MIDDLE + 20)
    mc.handleMouseMove(ev({ clientX: 200, clientY: GAP_MIDDLE - 20 }))
    mc.handleMouseUp(ev())
    // It wrote twice and changed nothing; an undo entry for that is a step that undoes nothing.
    expect(engine.previewBarlineJoinBelow).toHaveBeenCalledTimes(2)
    expect(engine.commitBarlineJoin).not.toHaveBeenCalled()
  })

  it('a press that never moves is still just a click', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 140 }))
    mc.handleMouseUp(ev())
    expect(engine.previewBarlineJoinBelow).not.toHaveBeenCalled()
    expect(engine.commitBarlineJoin).not.toHaveBeenCalled()
  })

  it('⭐⭐ the square TELEPORTS to the far staff when the drag crosses the middle', () => {
    // *"so is clear visually of the gesture"* — the selection's `staff`+`pressedAt` pair IS which of
    // the gap's two squares the highlight draws, so moving the pair moves the square.
    grabAndMove(GAP_MIDDLE + 20)
    expect(state.selectedElement).toEqual({ kind: 'barline', measure: 1, staff: 1, pressedAt: 'top' })
  })

  it('…and hops home when the drag comes back over the middle', () => {
    grabAndMove(GAP_MIDDLE + 20)
    mc.handleMouseMove(ev({ clientX: 200, clientY: GAP_MIDDLE - 20 }))
    expect(state.selectedElement).toEqual({ kind: 'barline', measure: 1, staff: 0, pressedAt: 'bottom' })
  })

  it('⛔ and it does not move while the pointer stays on its own side of the middle', () => {
    grabAndMove(GAP_MIDDLE - 20)
    expect(state.selectedElement).toEqual({ kind: 'barline', measure: 1, staff: 0, pressedAt: 'bottom' })
  })

  it('a press that misses the square arms nothing', () => {
    mc.handleMouseDown(ev({ clientX: 200, clientY: 300 }))
    mc.handleMouseMove(ev({ clientX: 200, clientY: GAP_MIDDLE + 20 }))
    expect(engine.previewBarlineJoinBelow).not.toHaveBeenCalled()
  })
})
